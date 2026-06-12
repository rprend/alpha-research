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

const runDate = process.env.CANON_DRIFT_RUN_DATE ?? today();
const timeoutMs = Number(process.env.CANON_DRIFT_TIMEOUT_MS ?? 15000);
const sources = await readJson(path.join(experimentDir, "config", "source-probes.json"));
const outDir = path.join(experimentDir, "data", "raw", "web-sources", runDate);
const manifest = {
  runDate,
  source: "canon drift web source probes",
  startedAt: new Date().toISOString(),
  requests: [],
  errors: [],
};

await fs.rm(outDir, { recursive: true, force: true });
await ensureDir(outDir);

for (const source of sources) {
  const sourceDir = path.join(outDir, slug(source.id));
  const responsePath = path.join(sourceDir, source.url.includes("fo=json") ? "response.json" : "index.html");
  await ensureDir(sourceDir);
  let response;
  let body = "";
  try {
    response = await fetch(source.url, {
      headers: {
        "user-agent": "alpha-research-canon-drift-feasibility/0.1",
        accept: source.url.includes("fo=json") ? "application/json,text/html" : "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    body = await response.text();
  } catch (error) {
    manifest.errors.push({ ...source, error: error.message });
    manifest.requests.push({ ...source, status: "fetch-error", responsePath: path.relative(experimentDir, responsePath) });
    continue;
  }

  if (!response.ok) {
    manifest.errors.push({ ...source, status: response.status, body: body.slice(0, 1000) });
    manifest.requests.push({
      ...source,
      status: "http-error",
      httpStatus: response.status,
      responsePath: path.relative(experimentDir, responsePath),
    });
    continue;
  }

  await writeText(responsePath, body);
  const text = source.url.includes("fo=json") ? body : cleanHtml(body);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const parsed = parseRecordCount(source, body);
  await writeJson(path.join(sourceDir, "metadata.json"), {
    ...source,
    fetchedAt: new Date().toISOString(),
    status: response.status,
    bytes: Buffer.byteLength(body),
    wordCount,
    title: source.url.includes("fo=json") ? source.label : extractTitle(body),
    parsedRecordCount: parsed.recordCount,
    parsedRecordCountSource: parsed.source,
  });
  manifest.requests.push({
    ...source,
    status: response.status,
    wordCount,
    parsedRecordCount: parsed.recordCount,
    parsedRecordCountSource: parsed.source,
    responsePath: path.relative(experimentDir, responsePath),
  });
}

manifest.finishedAt = new Date().toISOString();
manifest.recordCount = manifest.requests.filter((request) => Number(request.status) >= 200 && Number(request.status) < 300).length;
await writeJson(path.join(outDir, "manifest.json"), manifest);

console.log(`Probed ${manifest.recordCount} canon drift web sources into ${path.relative(process.cwd(), outDir)}`);

function parseRecordCount(source, body) {
  if (source.url.includes("loc.gov") && source.url.includes("fo=json")) {
    try {
      const json = JSON.parse(body);
      return { recordCount: Number(json.pagination?.total ?? json.results?.length ?? 0), source: "loc-json-pagination" };
    } catch {
      return { recordCount: 0, source: "loc-json-parse-failed" };
    }
  }
  const text = cleanHtml(body);
  const roughSignals = [
    /syllabus/i,
    /reading/i,
    /course/i,
    /contents/i,
    /collection/i,
    /catalog/i,
    /result/i,
  ].filter((pattern) => pattern.test(text)).length;
  return { recordCount: roughSignals, source: "rough-page-signal-count" };
}
