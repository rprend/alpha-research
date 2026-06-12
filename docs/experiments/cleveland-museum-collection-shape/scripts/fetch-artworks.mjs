import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureDir,
  experimentDir,
  today,
  writeJson,
} from "./lib.mjs";

const args = parseArgs();
const runDate = args["run-date"] ?? process.env.CLEVELAND_COLLECTION_RUN_DATE ?? today();
const limit = Number(args.limit ?? 5000);
const pageSize = Number(args["page-size"] ?? 1000);
const timeoutMs = Number(args.timeout ?? 20000);
const outDir = path.join(experimentDir, "data", "raw", "api", runDate);
const manifest = {
  runDate,
  source: "Cleveland Museum of Art Open Access API",
  baseUrl: "https://openaccess-api.clevelandart.org/api/artworks/",
  limit,
  pageSize,
  startedAt: new Date().toISOString(),
  requests: [],
  errors: [],
};

await fs.rm(outDir, { recursive: true, force: true });
await ensureDir(outDir);

let fetched = 0;
let total = null;
for (let skip = 0; fetched < limit; skip += pageSize) {
  const currentLimit = Math.min(pageSize, limit - fetched);
  const url = new URL(manifest.baseUrl);
  url.searchParams.set("limit", String(currentLimit));
  url.searchParams.set("skip", String(skip));
  const responsePath = path.join(outDir, `artworks-${String(skip).padStart(6, "0")}.json`);
  let response;
  let json;
  try {
    response = await fetch(url, {
      headers: { "user-agent": "alpha-research-cleveland-collection-shape/0.1" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    json = await response.json();
  } catch (error) {
    manifest.errors.push({ skip, limit: currentLimit, url: String(url), error: error.message });
    manifest.requests.push({ skip, limit: currentLimit, url: String(url), status: "fetch-error", responsePath: path.relative(experimentDir, responsePath) });
    break;
  }
  if (!response.ok) {
    manifest.errors.push({ skip, limit: currentLimit, url: String(url), status: response.status, body: JSON.stringify(json).slice(0, 1000) });
    manifest.requests.push({ skip, limit: currentLimit, url: String(url), status: "http-error", httpStatus: response.status, responsePath: path.relative(experimentDir, responsePath) });
    break;
  }
  await writeJson(responsePath, json);
  const count = Array.isArray(json.data) ? json.data.length : 0;
  fetched += count;
  total = json.info?.total ?? total;
  manifest.requests.push({
    skip,
    limit: currentLimit,
    url: String(url),
    status: response.status,
    recordCount: count,
    total,
    responsePath: path.relative(experimentDir, responsePath),
  });
  if (count < currentLimit) break;
}

manifest.finishedAt = new Date().toISOString();
manifest.recordCount = fetched;
manifest.totalAvailable = total;
await writeJson(path.join(outDir, "manifest.json"), manifest);

console.log(`Fetched ${fetched} Cleveland Museum artwork records into ${path.relative(process.cwd(), outDir)}`);

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : "true";
  }
  return out;
}
