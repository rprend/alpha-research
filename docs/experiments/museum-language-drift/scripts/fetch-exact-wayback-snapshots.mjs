import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
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
const minWords = Number(args["min-words"] ?? 60);
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
  const pageDir = path.join(outDir, slug(`${snapshot.museum}-${snapshot.pageType}`), String(snapshot.year));
  const responsePath = path.join(pageDir, "index.html");
  const archiveUrl = `https://web.archive.org/web/${snapshot.timestamp}id_/${snapshot.url}`;
  await ensureDir(pageDir);

  let status = 0;
  let body = "";
  try {
    const fetched = await fetchTextWithFallback(archiveUrl, timeoutMs);
    status = fetched.status;
    body = fetched.body;
  } catch (error) {
    manifest.requests.push({ ...snapshot, archiveUrl, status: "fetch-error", responsePath: path.relative(experimentDir, responsePath) });
    manifest.errors.push({ ...snapshot, archiveUrl, error: error.message });
    continue;
  }

  const cleanText = cleanHtml(body);
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
  if (status < 200 || status >= 300 || wordCount < minWords) {
    const requestStatus = status >= 200 && status < 300 ? "quality-failed" : "http-error";
    manifest.requests.push({ ...snapshot, archiveUrl, status: requestStatus, httpStatus: status, wordCount, responsePath: path.relative(experimentDir, responsePath) });
    manifest.errors.push({ ...snapshot, archiveUrl, status: requestStatus, httpStatus: status, wordCount, body: body.slice(0, 1000) });
    continue;
  }

  await writeText(responsePath, body);
  await writeJson(path.join(pageDir, "metadata.json"), {
    ...snapshot,
    archiveUrl,
    status,
    bytes: Buffer.byteLength(body),
    wordCount,
    title: extractTitle(body),
    fetchedAt: new Date().toISOString(),
  });
  manifest.requests.push({
    ...snapshot,
    archiveUrl,
    status,
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

console.log(`Recorded ${manifest.recordCount} museum Wayback snapshots into ${path.relative(process.cwd(), outDir)} (${manifest.fetchedRecordCount} successful exact fetch records in manifest)`);

async function snapshotInventory(dir) {
  const files = await findFiles(dir, "metadata.json");
  return Promise.all(files.map(async (file) => {
    const metadata = await readJson(file);
    return {
      museum: metadata.museum,
      pageType: metadata.pageType,
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

async function fetchTextWithFallback(url, timeoutMs) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "alpha-research-museum-language-drift/0.1",
          accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      return { status: response.status, body: await response.text() };
    } catch (error) {
      if (attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  return await curlText(url, timeoutMs);
}

function curlText(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn("curl", [
      "-L",
      "--max-time",
      String(Math.ceil(timeoutMs / 1000)),
      "-A",
      "alpha-research-museum-language-drift/0.1",
      "-w",
      "\n__HTTP_STATUS__:%{http_code}",
      url,
    ]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (exitCode) => {
      if (exitCode !== 0) {
        reject(new Error(stderr.trim() || `curl exited ${exitCode}`));
        return;
      }
      const marker = "\n__HTTP_STATUS__:";
      const index = stdout.lastIndexOf(marker);
      if (index === -1) {
        reject(new Error("curl response missing status marker"));
        return;
      }
      resolve({
        body: stdout.slice(0, index),
        status: Number(stdout.slice(index + marker.length).trim()),
      });
    });
  });
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
