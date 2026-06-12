import fs from "node:fs/promises";
import path from "node:path";
import {
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
const timeoutMs = Number(args.timeout ?? 12000);
const targetConfig = args.targets ?? "wayback-targets.json";
const years = String(args.years ?? "2000,2005,2010,2015,2020")
  .split(",")
  .map((year) => Number(year.trim()))
  .filter(Boolean);
const runDate = today();
const targets = await readJson(path.join(experimentDir, "config", targetConfig));
const outDir = path.join(experimentDir, "data", "raw", "wayback-snapshots", runDate);
const manifest = {
  runDate,
  source: "Internet Archive Wayback Machine",
  years,
  targetConfig,
  startedAt: new Date().toISOString(),
  requests: [],
  errors: [],
};

await fs.rm(outDir, { recursive: true, force: true });
await ensureDir(outDir);

for (const target of targets) {
  for (const year of years) {
    const snapshot = await closestSnapshot(target.url, year);
    const institutionDir = path.join(outDir, slug(target.institution), String(year));
    await ensureDir(institutionDir);
    const responsePath = path.join(institutionDir, "index.html");
    if (!snapshot) {
      manifest.requests.push({ ...target, year, status: "no-snapshot" });
      manifest.errors.push({ ...target, year, error: "No CDX snapshot found" });
      continue;
    }

    const archiveUrl = `https://web.archive.org/web/${snapshot.timestamp}id_/${target.url}`;
    let response;
    let body = "";
    try {
      response = await fetch(archiveUrl, {
        headers: {
          "user-agent": "alpha-research-mission-statement-drift/0.1",
          accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      body = await response.text();
    } catch (error) {
      manifest.requests.push({ ...target, year, timestamp: snapshot.timestamp, archiveUrl, status: "fetch-error", responsePath: path.relative(experimentDir, responsePath) });
      manifest.errors.push({ ...target, year, timestamp: snapshot.timestamp, archiveUrl, error: error.message });
      continue;
    }

    manifest.requests.push({
      ...target,
      year,
      timestamp: snapshot.timestamp,
      originalStatus: snapshot.statuscode,
      archiveUrl,
      status: response.status,
      responsePath: path.relative(experimentDir, responsePath),
    });

    if (!response.ok) {
      manifest.errors.push({ ...target, year, timestamp: snapshot.timestamp, archiveUrl, status: response.status, body: body.slice(0, 1000) });
      continue;
    }

    await writeText(responsePath, body);
    await writeJson(path.join(institutionDir, "metadata.json"), {
      ...target,
      year,
      timestamp: snapshot.timestamp,
      archiveUrl,
      status: response.status,
      bytes: Buffer.byteLength(body),
      title: extractTitle(body),
      fetchedAt: new Date().toISOString(),
    });
  }
}

manifest.finishedAt = new Date().toISOString();
manifest.recordCount = manifest.requests.filter((request) => Number(request.status) >= 200 && Number(request.status) < 300).length;
await writeJson(path.join(outDir, "manifest.json"), manifest);

console.log(`Fetched ${manifest.recordCount} Wayback snapshots into ${path.relative(process.cwd(), outDir)}`);

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
  let json;
  try {
    const response = await fetch(cdx, {
      headers: { "user-agent": "alpha-research-mission-statement-drift/0.1" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    json = await response.json();
  } catch {
    return null;
  }
  const rows = Array.isArray(json) ? json.slice(1) : [];
  if (!rows.length) return null;
  const target = Number(`${year}0701000000`);
  const sorted = rows
    .map(([timestamp, original, statuscode, mimetype, digest]) => ({ timestamp, original, statuscode, mimetype, digest }))
    .filter((row) => /html/i.test(row.mimetype ?? ""))
    .sort((a, b) => Math.abs(Number(a.timestamp) - target) - Math.abs(Number(b.timestamp) - target));
  return sorted[0] ?? null;
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
