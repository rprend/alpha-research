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

const runDate = process.env.HUMANITIES_DATASET_RUN_DATE ?? today();
const timeoutMs = Number(process.env.HUMANITIES_DATASET_TIMEOUT_MS ?? 15000);
const candidates = await readJson(path.join(experimentDir, "config", "candidates.json"));
const outDir = path.join(experimentDir, "data", "raw", "candidate-pages", runDate);
const manifest = {
  runDate,
  source: "humanities dataset candidate probes",
  startedAt: new Date().toISOString(),
  requests: [],
  errors: [],
};

await fs.rm(outDir, { recursive: true, force: true });
await ensureDir(outDir);

for (const candidate of candidates) {
  const candidateDir = path.join(outDir, slug(candidate.id));
  const isJson = expectsJson(candidate.url);
  const responsePath = path.join(candidateDir, isJson ? "response.json" : "index.html");
  await ensureDir(candidateDir);
  let response;
  let body = "";
  try {
    response = await fetch(candidate.url, {
      headers: {
        "user-agent": "alpha-research-humanities-dataset-registry/0.1",
        accept: isJson ? "application/json,text/html" : "text/html,application/xhtml+xml,application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    body = await response.text();
  } catch (error) {
    manifest.errors.push({ ...candidate, error: error.message });
    manifest.requests.push({ ...candidate, status: "fetch-error", responsePath: path.relative(experimentDir, responsePath) });
    continue;
  }

  if (!response.ok) {
    manifest.errors.push({ ...candidate, status: response.status, body: body.slice(0, 1000) });
    manifest.requests.push({
      ...candidate,
      status: "http-error",
      httpStatus: response.status,
      responsePath: path.relative(experimentDir, responsePath),
    });
    continue;
  }

  await writeText(responsePath, body);
  const parsed = parseResponse(candidate, body, isJson);
  await writeJson(path.join(candidateDir, "metadata.json"), {
    ...candidate,
    fetchedAt: new Date().toISOString(),
    status: response.status,
    bytes: Buffer.byteLength(body),
    title: parsed.title,
    wordCount: parsed.wordCount,
    parsedRecordCount: parsed.recordCount,
    parsedRecordCountSource: parsed.recordCountSource,
  });
  manifest.requests.push({
    ...candidate,
    status: response.status,
    wordCount: parsed.wordCount,
    parsedRecordCount: parsed.recordCount,
    parsedRecordCountSource: parsed.recordCountSource,
    responsePath: path.relative(experimentDir, responsePath),
  });
}

manifest.finishedAt = new Date().toISOString();
manifest.recordCount = manifest.requests.filter((request) => Number(request.status) >= 200 && Number(request.status) < 300).length;
await writeJson(path.join(outDir, "manifest.json"), manifest);

console.log(`Probed ${manifest.recordCount} humanities dataset candidates into ${path.relative(process.cwd(), outDir)}`);

function expectsJson(url) {
  return /api|format=json|fo=json|metadata|collectionapi|chroniclingamerica/i.test(url);
}

function parseResponse(candidate, body, isJson) {
  if (isJson) {
    try {
      const json = JSON.parse(body);
      return {
        title: candidate.name,
        wordCount: JSON.stringify(json).split(/\s+/).filter(Boolean).length,
        recordCount: inferJsonRecordCount(json),
        recordCountSource: "json-structure",
      };
    } catch {
      return { title: candidate.name, wordCount: body.split(/\s+/).filter(Boolean).length, recordCount: 0, recordCountSource: "json-parse-failed" };
    }
  }
  const text = cleanHtml(body);
  return {
    title: extractTitle(body) || candidate.name,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    recordCount: inferPageSignals(text),
    recordCountSource: "rough-page-signal-count",
  };
}

function inferJsonRecordCount(json) {
  if (Array.isArray(json)) return json.length;
  if (Array.isArray(json.results)) return Number(json.pagination?.total ?? json.results.length);
  if (Array.isArray(json.items)) return json.items.length;
  if (Array.isArray(json.records)) return Number(json.hits?.total ?? json.records.length);
  if (Array.isArray(json.data)) return Number(json.total_count ?? json.data.length);
  if (Array.isArray(json.objectIDs)) return json.total ?? json.objectIDs.length;
  if (json.total) return Number(json.total);
  if (json.total_count) return Number(json.total_count);
  if (json.numberOfResults) return Number(json.numberOfResults);
  if (json.metadata) return 1;
  return Object.keys(json).length;
}

function inferPageSignals(text) {
  const patterns = [
    /download/i,
    /api/i,
    /data/i,
    /dataset/i,
    /metadata/i,
    /collection/i,
    /license/i,
    /rights/i,
    /bulk/i,
    /search/i,
  ];
  return patterns.filter((pattern) => pattern.test(text)).length;
}
