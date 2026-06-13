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
const minWords = Number(args["min-words"] ?? process.env.MISSION_DRIFT_SECOND_LAYER_MIN_WORDS ?? 80);
const runDate = args["run-date"] ?? today();
const cleanRun = args.clean === "true";
const resume = args.resume !== "false";
const genreFilter = String(args.genres ?? "")
  .split(",")
  .map((genre) => genre.trim())
  .filter(Boolean);
const sourceConfig = args.sources ?? "second-layer-historical-current-sources.json";
const sources = (await readJson(path.join(experimentDir, "config", sourceConfig)))
  .filter((source) => !genreFilter.length || genreFilter.includes(source.source_genre));
const outDir = path.join(experimentDir, "data", "raw", "second-layer-historical-current", runDate);
const manifest = {
  runDate,
  source: "Live historical university pages",
  sourceLayer: "historical-current",
  sourceConfig: `config/${sourceConfig}`,
  minWords,
  resume,
  genreFilter,
  startedAt: new Date().toISOString(),
  requests: [],
  errors: [],
};

if (cleanRun) await fs.rm(outDir, { recursive: true, force: true });
await ensureDir(outDir);

for (const source of sources) {
  const pageDir = path.join(outDir, source.source_genre, slug(source.institution), String(source.year), slug(source.source_id ?? source.url));
  const responsePath = path.join(pageDir, "index.html");
  const metadataPath = path.join(pageDir, "metadata.json");
  if (resume && await exists(metadataPath) && await exists(responsePath)) {
    const metadata = await readJson(metadataPath);
    manifest.requests.push({
      ...metadata,
      responsePath: path.relative(experimentDir, responsePath),
      metadataPath: path.relative(experimentDir, metadataPath),
      resumed: true,
    });
    continue;
  }

  await ensureDir(pageDir);
  let response;
  let body = "";
  try {
    response = await fetch(source.url, {
      headers: {
        "user-agent": "alpha-research-university-second-layer-historical-current/0.1",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    body = await response.text();
  } catch (error) {
    const row = {
      ...source,
      status: "fetch-error",
      responsePath: path.relative(experimentDir, responsePath),
      metadataPath: path.relative(experimentDir, metadataPath),
    };
    manifest.requests.push(row);
    manifest.errors.push({ ...row, error: error.message });
    continue;
  }

  const cleanText = cleanHtml(body);
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
  const baseRow = {
    ...source,
    source_url: source.url,
    status: response.status,
    ok: response.ok,
    wordCount,
    title: extractTitle(body),
    responsePath: path.relative(experimentDir, responsePath),
    metadataPath: path.relative(experimentDir, metadataPath),
  };

  if (!response.ok) {
    const row = {
      ...baseRow,
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
      ok: false,
      error: "Fetched historical page did not meet minimum readable word count",
    };
    manifest.requests.push(row);
    manifest.errors.push(row);
    continue;
  }

  await writeText(responsePath, body);
  await writeJson(metadataPath, {
    ...baseRow,
    fetchedAt: new Date().toISOString(),
    bytes: Buffer.byteLength(body),
  });
  manifest.requests.push(baseRow);
}

manifest.finishedAt = new Date().toISOString();
manifest.snapshots = await readSnapshotMetadata(outDir);
manifest.recordCount = manifest.snapshots.length;
manifest.genreCounts = countBy(manifest.snapshots, "source_genre");
manifest.institutionCounts = countBy(manifest.snapshots, "institution");
manifest.yearCounts = countBy(manifest.snapshots, "year");

await writeJson(path.join(outDir, "manifest.json"), manifest);

console.log(`Recorded ${manifest.recordCount} historical-current second-layer sources into ${path.relative(process.cwd(), outDir)}`);

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
      source_id: metadata.source_id,
      institution: metadata.institution,
      source_genre: metadata.source_genre,
      source_layer: metadata.source_layer,
      source_url: metadata.source_url,
      year: metadata.year,
      url: metadata.url,
      status: metadata.status,
      wordCount: metadata.wordCount,
      title: metadata.title,
      responsePath: path.relative(experimentDir, path.join(path.dirname(file), "index.html")),
      metadataPath: path.relative(experimentDir, file),
    });
  }
  return rows.sort((a, b) => a.institution.localeCompare(b.institution) || a.source_genre.localeCompare(b.source_genre) || a.year - b.year);
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
