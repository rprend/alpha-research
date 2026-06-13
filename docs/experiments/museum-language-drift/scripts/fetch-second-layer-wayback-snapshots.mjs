import fs from "node:fs/promises";
import path from "node:path";
import {
  cleanHtml,
  ensureDir,
  experimentDir,
  extractTitle,
  readJson,
  slug,
  today,
  writeJson,
  writeText,
} from "./lib.mjs";

const args = parseArgs();
const timeoutMs = Number(args.timeout ?? 15000);
const minWords = Number(args["min-words"] ?? process.env.MUSEUM_LANGUAGE_SECOND_LAYER_MIN_WORDS ?? 80);
const years = String(args.years ?? "2010,2015,2020")
  .split(",")
  .map((year) => Number(year.trim()))
  .filter(Boolean);
const runDate = args["run-date"] ?? today();
const cleanRun = args.clean === "true";
const resume = args.resume !== "false";
const pageTypeFilter = String(args["page-types"] ?? "")
  .split(",")
  .map((pageType) => pageType.trim())
  .filter(Boolean);
const maxSnapshots = Number(args["max-snapshots"] ?? 0);
const sourceLimit = Number(args.sources ?? 0);
const sourceConfig = args.targets ?? "second-layer-wayback-targets.json";
const sources = await readJson(path.join(experimentDir, "config", sourceConfig));
const retainedSources = sources
  .filter((source) => !pageTypeFilter.length || pageTypeFilter.includes(source.page_type))
  .slice(0, sourceLimit || sources.length);
const outDir = path.join(experimentDir, "data", "raw", "second-layer-wayback", runDate);
const manifest = {
  runDate,
  source: "Internet Archive Wayback Machine",
  sourceLayer: "wayback-second-layer",
  sourceConfig: `config/${sourceConfig}`,
  years,
  minWords,
  resume,
  pageTypeFilter,
  maxSnapshots,
  startedAt: new Date().toISOString(),
  requests: [],
  errors: [],
};

if (cleanRun) await fs.rm(outDir, { recursive: true, force: true });
await ensureDir(outDir);

for (const source of retainedSources) {
  for (const year of years) {
    if (maxSnapshots && manifest.requests.filter(isSuccessfulSnapshot).length >= maxSnapshots) break;
    const pageDir = path.join(outDir, source.page_type, slug(source.museum), String(year));
    const responsePath = path.join(pageDir, "index.html");
    const metadataPath = path.join(pageDir, "metadata.json");
    if (resume && await exists(metadataPath) && await exists(responsePath)) {
      const metadata = await readJson(metadataPath);
      manifest.requests.push({
        ...metadata,
        status: metadata.status,
        responsePath: path.relative(experimentDir, responsePath),
        metadataPath: path.relative(experimentDir, metadataPath),
        resumed: true,
      });
      continue;
    }

    const snapshot = await closestSnapshot(source.url, year);
    await ensureDir(pageDir);

    if (!snapshot) {
      const row = {
        ...source,
        source_layer: "wayback-second-layer",
        source_url: source.url,
        year,
        status: "no-snapshot",
      };
      manifest.requests.push(row);
      manifest.errors.push({ ...row, error: "No CDX snapshot found" });
      continue;
    }

    const archiveUrl = `https://web.archive.org/web/${snapshot.timestamp}id_/${source.url}`;
    let response;
    let body = "";
    try {
      response = await fetch(archiveUrl, {
        headers: {
          "user-agent": "alpha-research-museum-second-layer-wayback/0.1",
          accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      body = await response.text();
    } catch (error) {
      const row = {
        ...source,
        source_layer: "wayback-second-layer",
        source_url: source.url,
        year,
        timestamp: snapshot.timestamp,
        archiveUrl,
        status: "fetch-error",
        responsePath: path.relative(experimentDir, responsePath),
      };
      manifest.requests.push(row);
      manifest.errors.push({ ...row, error: error.message });
      continue;
    }

    const cleanText = cleanHtml(body);
    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
    const baseRow = {
      ...source,
      source_layer: "wayback-second-layer",
      source_url: source.url,
      year,
      timestamp: snapshot.timestamp,
      originalStatus: snapshot.statuscode,
      archiveUrl,
      httpStatus: response.status,
      wordCount,
      title: extractTitle(body),
      responsePath: path.relative(experimentDir, responsePath),
      metadataPath: path.relative(experimentDir, metadataPath),
    };

    if (!response.ok) {
      const row = {
        ...baseRow,
        status: "http-error",
        error: `HTTP ${response.status}`,
        bodyPreview: body.slice(0, 500),
      };
      manifest.requests.push(row);
      manifest.errors.push(row);
      continue;
    }

    if (wordCount < minWords) {
      const row = {
        ...baseRow,
        status: "quality-failed",
        error: "Fetched archived page did not meet minimum readable word count",
      };
      manifest.requests.push(row);
      manifest.errors.push(row);
      continue;
    }

    await writeText(responsePath, body);
    await writeJson(metadataPath, {
      ...baseRow,
      status: response.status,
      fetchedAt: new Date().toISOString(),
      bytes: Buffer.byteLength(body),
    });
    manifest.requests.push({
      ...baseRow,
      status: response.status,
    });
  }
  if (maxSnapshots && manifest.requests.filter(isSuccessfulSnapshot).length >= maxSnapshots) break;
}

manifest.finishedAt = new Date().toISOString();
manifest.fetchedRecordCount = manifest.requests.filter(isSuccessfulSnapshot).length;
manifest.pageTypeCounts = countBy(manifest.requests.filter(isSuccessfulSnapshot), "page_type");
manifest.museumCounts = countBy(manifest.requests.filter(isSuccessfulSnapshot), "museum");
manifest.yearCounts = countBy(manifest.requests.filter(isSuccessfulSnapshot), "year");
manifest.snapshots = await readSnapshotMetadata(outDir);
manifest.existingRecordCount = manifest.snapshots.length;
manifest.recordCount = cleanRun ? manifest.fetchedRecordCount : manifest.existingRecordCount;

await writeJson(path.join(outDir, "manifest.json"), manifest);

console.log(`Recorded ${manifest.recordCount} museum second-layer Wayback snapshots into ${path.relative(process.cwd(), outDir)} (${manifest.fetchedRecordCount} fetched in this pass)`);

async function closestSnapshot(url, year) {
  const cdx = new URL("https://web.archive.org/cdx");
  cdx.searchParams.set("url", url);
  cdx.searchParams.set("from", `${year}0101`);
  cdx.searchParams.set("to", `${year}1231`);
  cdx.searchParams.set("output", "json");
  cdx.searchParams.set("fl", "timestamp,original,statuscode,mimetype,digest");
  cdx.searchParams.set("filter", "statuscode:200");
  cdx.searchParams.set("collapse", "digest");
  cdx.searchParams.set("limit", "20");
  try {
    const response = await fetch(cdx, {
      headers: { "user-agent": "alpha-research-museum-second-layer-wayback/0.1" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const json = await response.json();
    const rows = (Array.isArray(json) ? json.slice(1) : [])
      .map(([timestamp, original, statuscode, mimetype, digest]) => ({ timestamp, original, statuscode, mimetype, digest }))
      .filter((row) => /html/i.test(row.mimetype ?? ""));
    if (!rows.length) return null;
    const target = Number(`${year}0701000000`);
    return rows.sort((a, b) => Math.abs(Number(a.timestamp) - target) - Math.abs(Number(b.timestamp) - target))[0];
  } catch {
    return null;
  }
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readSnapshotMetadata(dir) {
  const files = await findFiles(dir, "metadata.json");
  const rows = [];
  for (const file of files) {
    const metadata = await readJson(file);
    rows.push({
      museum: metadata.museum,
      page_type: metadata.page_type,
      source_layer: metadata.source_layer,
      source_url: metadata.source_url,
      year: metadata.year,
      url: metadata.url,
      archiveUrl: metadata.archiveUrl,
      timestamp: metadata.timestamp,
      status: metadata.status,
      wordCount: metadata.wordCount,
      title: metadata.title,
      responsePath: path.relative(experimentDir, path.join(path.dirname(file), "index.html")),
      metadataPath: path.relative(experimentDir, file),
    });
  }
  return rows.sort((a, b) => a.museum.localeCompare(b.museum) || a.page_type.localeCompare(b.page_type) || a.year - b.year);
}

async function findFiles(dir, name) {
  const out = [];
  await walk(dir);
  return out;

  async function walk(current) {
    let entries = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name === name) out.push(full);
    }
  }
}

function isSuccessfulSnapshot(request) {
  return Number(request.status) >= 200 && Number(request.status) < 300;
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))));
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : "true";
  }
  return out;
}
