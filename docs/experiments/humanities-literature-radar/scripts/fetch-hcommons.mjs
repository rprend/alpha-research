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
const pageSize = Math.min(Number(args["page-size"] ?? 50), 100);
const runDate = args["run-date"] ?? today();
const queries = String(args.queries ?? defaultQueries.slice(0, 8).join("|"))
  .split("|")
  .map((query) => query.trim())
  .filter(Boolean);

const source = "hcommons";
const outDir = path.join(experimentDir, "data", "raw", source, runDate);
const startedAt = new Date().toISOString();
const requests = [];
const errors = [];
let recordCount = 0;

await ensureDir(outDir);

for (const query of queries) {
  if (recordCount >= limit) break;
  let page = 1;
  while (recordCount < limit) {
    const url = new URL("https://works.hcommons.org/api/records");
    url.searchParams.set("q", query);
    url.searchParams.set("size", String(Math.min(pageSize, limit - recordCount)));
    url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      headers: {
        "user-agent": "alpha-research-humanities-radar/0.1",
        accept: "application/json",
      },
      signal: AbortSignal.timeout(Number(args.timeout ?? 15000)),
    });
    const responsePath = path.join(outDir, `${query.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${String(page).padStart(3, "0")}.json`);
    requests.push({
      query,
      page,
      url: url.toString(),
      status: response.status,
      responsePath: path.relative(experimentDir, responsePath),
    });

    if (!response.ok) {
      errors.push({ query, page, status: response.status, body: (await response.text()).slice(0, 1000) });
      break;
    }

    const json = await response.json();
    await writeJson(responsePath, json);
    const results = Array.isArray(json.hits?.hits) ? json.hits.hits : [];
    recordCount += results.length;
    if (!results.length || results.length < pageSize) break;
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

console.log(`Fetched ${recordCount} Humanities Commons records into ${path.relative(process.cwd(), outDir)}`);
