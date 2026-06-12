import path from "node:path";
import {
  defaultQueries,
  ensureDir,
  experimentDir,
  parseArgs,
  today,
  writeManifest,
  writeText,
} from "./lib.mjs";

const args = parseArgs();
const limit = Number(args.limit ?? 300);
const pageSize = Math.min(Number(args.rows ?? 100), 100);
const runDate = args["run-date"] ?? today();
const queries = String(args.queries ?? defaultQueries.slice(0, 8).join("|"))
  .split("|")
  .map((query) => query.trim())
  .filter(Boolean);

const source = "arxiv";
const outDir = path.join(experimentDir, "data", "raw", source, runDate);
const startedAt = new Date().toISOString();
const requests = [];
const errors = [];
let recordCount = 0;

await ensureDir(outDir);

for (const query of queries) {
  if (recordCount >= limit) break;
  let start = 0;
  let page = 1;
  while (recordCount < limit) {
    const maxResults = Math.min(pageSize, limit - recordCount);
    const url = new URL("https://export.arxiv.org/api/query");
    url.searchParams.set("search_query", `all:${query}`);
    url.searchParams.set("start", String(start));
    url.searchParams.set("max_results", String(maxResults));
    url.searchParams.set("sortBy", "submittedDate");
    url.searchParams.set("sortOrder", "descending");

    const response = await fetch(url);
    const responsePath = path.join(outDir, `${query.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${String(page).padStart(3, "0")}.xml`);
    requests.push({
      query,
      page,
      url: url.toString(),
      status: response.status,
      responsePath: path.relative(experimentDir, responsePath),
    });

    const body = await response.text();
    if (!response.ok) {
      errors.push({ query, page, status: response.status, body });
      break;
    }

    await writeText(responsePath, body);
    const matches = body.match(/<entry>/g) ?? [];
    recordCount += matches.length;
    if (matches.length === 0 || matches.length < maxResults) break;
    start += matches.length;
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

console.log(`Fetched ${recordCount} arXiv records into ${path.relative(process.cwd(), outDir)}`);
