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
const timeoutMs = Number(args.timeout ?? 20000);
const minWords = Number(args["min-words"] ?? 80);
const runDate = args["run-date"] ?? today();
const snapshots = await readJson(path.join(experimentDir, "config", args.config ?? "wayback-exact-snapshots.json"));
const outDir = path.join(experimentDir, "data", "raw", "wayback-snapshots", runDate);
const manifestPath = path.join(outDir, "manifest.json");
const manifest = await readOptionalJson(manifestPath) ?? {
  runDate,
  source: "Internet Archive Wayback Machine",
  startedAt: new Date().toISOString(),
  requests: [],
  errors: [],
};

await ensureDir(outDir);

for (const snapshot of snapshots) {
  const institutionDir = path.join(outDir, slug(snapshot.institution), String(snapshot.year));
  const responsePath = path.join(institutionDir, "index.html");
  const archiveUrl = `https://web.archive.org/web/${snapshot.timestamp}id_/${snapshot.url}`;
  await ensureDir(institutionDir);

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
    manifest.requests.push({ ...snapshot, archiveUrl, status: "fetch-error", responsePath: path.relative(experimentDir, responsePath) });
    manifest.errors.push({ ...snapshot, archiveUrl, error: error.message });
    continue;
  }

  const cleanText = cleanHtml(body);
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
  if (!response.ok || wordCount < minWords) {
    const status = response.ok ? "quality-failed" : "http-error";
    manifest.requests.push({ ...snapshot, archiveUrl, status, httpStatus: response.status, wordCount, responsePath: path.relative(experimentDir, responsePath) });
    manifest.errors.push({ ...snapshot, archiveUrl, status, httpStatus: response.status, wordCount, body: body.slice(0, 1000) });
    continue;
  }

  await writeText(responsePath, body);
  await writeJson(path.join(institutionDir, "metadata.json"), {
    ...snapshot,
    archiveUrl,
    status: response.status,
    bytes: Buffer.byteLength(body),
    wordCount,
    title: extractTitle(body),
    fetchedAt: new Date().toISOString(),
  });
  manifest.requests.push({
    ...snapshot,
    archiveUrl,
    status: response.status,
    wordCount,
    responsePath: path.relative(experimentDir, responsePath),
    exactSnapshot: true,
  });
}

manifest.finishedAt = new Date().toISOString();
manifest.snapshots = await snapshotInventory(outDir);
manifest.existingRecordCount = manifest.snapshots.length;
manifest.fetchedRecordCount = manifest.requests.filter((request) => Number(request.status) >= 200 && Number(request.status) < 300).length;
manifest.recordCount = manifest.snapshots.length;
await writeJson(manifestPath, manifest);

console.log(`Recorded ${manifest.recordCount} Wayback snapshots into ${path.relative(process.cwd(), outDir)} (${manifest.fetchedRecordCount} successful exact fetch records in manifest)`);

async function snapshotInventory(dir) {
  const files = await findFiles(dir, "metadata.json");
  return Promise.all(files.map(async (file) => {
    const metadata = await readJson(file);
    return {
      institution: metadata.institution,
      year: metadata.year,
      url: metadata.url,
      archiveUrl: metadata.archiveUrl,
      timestamp: metadata.timestamp,
      status: metadata.status,
      wordCount: metadata.wordCount,
      responsePath: path.relative(experimentDir, path.join(path.dirname(file), "index.html")),
      metadataPath: path.relative(experimentDir, file),
    };
  }));
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

async function readOptionalJson(file) {
  try {
    return await readJson(file);
  } catch {
    return null;
  }
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
