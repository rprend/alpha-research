import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureDir,
  experimentDir,
  readJson,
  slug,
  today,
  writeJson,
} from "./lib.mjs";

const runDate = process.env.CANON_DRIFT_RUN_DATE ?? today();
const timeoutMs = Number(process.env.CANON_DRIFT_TIMEOUT_MS ?? 15000);
const cohort = await readJson(path.join(experimentDir, "config", "author-cohort.json"));
const outDir = path.join(experimentDir, "data", "raw", "openalex-authors", runDate);
const manifest = {
  runDate,
  source: "OpenAlex works search by author/name string",
  startedAt: new Date().toISOString(),
  requests: [],
  errors: [],
};

await fs.rm(outDir, { recursive: true, force: true });
await ensureDir(outDir);

for (const author of cohort) {
  const params = new URLSearchParams({
    search: author.openalexSearch,
    per_page: "25",
    sort: "cited_by_count:desc",
  });
  const url = `https://api.openalex.org/works?${params.toString()}`;
  const responsePath = path.join(outDir, `${slug(author.name)}.json`);
  let response;
  let json;
  try {
    response = await fetch(url, {
      headers: { "user-agent": "alpha-research-canon-drift-feasibility/0.1" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    json = await response.json();
  } catch (error) {
    manifest.errors.push({ ...author, url, error: error.message });
    manifest.requests.push({ ...author, url, status: "fetch-error", responsePath: path.relative(experimentDir, responsePath) });
    continue;
  }

  if (!response.ok) {
    manifest.errors.push({ ...author, url, status: response.status, body: JSON.stringify(json).slice(0, 1000) });
    manifest.requests.push({ ...author, url, status: "http-error", httpStatus: response.status, responsePath: path.relative(experimentDir, responsePath) });
    continue;
  }

  await writeJson(responsePath, json);
  const works = Array.isArray(json.results) ? json.results : [];
  const years = {};
  for (const work of works) {
    const year = work.publication_year ?? "unknown";
    years[year] = (years[year] ?? 0) + 1;
  }
  manifest.requests.push({
    ...author,
    url,
    status: response.status,
    resultCount: works.length,
    totalCount: json.meta?.count ?? works.length,
    topCitedByCount: works[0]?.cited_by_count ?? 0,
    years,
    responsePath: path.relative(experimentDir, responsePath),
  });
}

manifest.finishedAt = new Date().toISOString();
manifest.recordCount = manifest.requests.filter((request) => Number(request.status) >= 200 && Number(request.status) < 300).length;
await writeJson(path.join(outDir, "manifest.json"), manifest);

console.log(`Probed ${manifest.recordCount} OpenAlex author searches into ${path.relative(process.cwd(), outDir)}`);
