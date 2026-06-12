import path from "node:path";
import {
  defaultQueries,
  ensureDir,
  experimentDir,
  parseArgs,
  today,
  writeJson,
  writeManifest,
} from "./lib.mjs";

const args = parseArgs();
const limit = Number(args.limit ?? 500);
const perPage = Math.min(Number(args["per-page"] ?? 200), 200);
const fromDate = args.from ?? "2020-01-01";
const toDate = args.to ?? today();
const runDate = args["run-date"] ?? today();
const queries = String(args.queries ?? defaultQueries.slice(0, 8).join("|"))
  .split("|")
  .map((query) => query.trim())
  .filter(Boolean);

const source = "openalex";
const outDir = path.join(experimentDir, "data", "raw", source, runDate);
const startedAt = new Date().toISOString();
const requests = [];
const errors = [];
let recordCount = 0;

await ensureDir(outDir);

for (const query of queries) {
  if (recordCount >= limit) break;
  let cursor = "*";
  let page = 1;
  while (recordCount < limit) {
    const remaining = limit - recordCount;
    const pageSize = Math.min(perPage, remaining);
    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("search", query);
    url.searchParams.set("filter", `from_publication_date:${fromDate},to_publication_date:${toDate}`);
    url.searchParams.set("per-page", String(pageSize));
    url.searchParams.set("cursor", cursor);
    url.searchParams.set("mailto", "research@example.com");

    const response = await fetch(url);
    const responsePath = path.join(outDir, `${query.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${String(page).padStart(3, "0")}.json`);
    const requestInfo = {
      query,
      page,
      url: url.toString(),
      status: response.status,
      responsePath: path.relative(experimentDir, responsePath),
    };
    requests.push(requestInfo);

    if (!response.ok) {
      errors.push({ query, page, status: response.status, body: await response.text() });
      break;
    }

    const json = await response.json();
    await writeJson(responsePath, json);
    const results = Array.isArray(json.results) ? json.results : [];
    recordCount += results.length;
    cursor = json.meta?.next_cursor;
    if (!cursor || results.length === 0) break;
    page += 1;
  }
}

await writeManifest({
  source,
  runDate,
  startedAt,
  finishedAt: new Date().toISOString(),
  requests,
  recordCount,
  errors,
});

console.log(`Fetched ${recordCount} OpenAlex records into ${path.relative(process.cwd(), outDir)}`);
