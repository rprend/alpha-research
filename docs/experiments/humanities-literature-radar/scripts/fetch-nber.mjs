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
const limit = Number(args.limit ?? 200);
const runDate = args["run-date"] ?? today();
const fallbackQueries =
  defaultQueries.filter((query) => /history|culture|institution|religion|economic/i.test(query)).join("|") ||
  "economic history culture";
const queries = String(args.queries ?? fallbackQueries)
  .split("|")
  .map((query) => query.trim())
  .filter(Boolean);

const source = "nber";
const outDir = path.join(experimentDir, "data", "raw", source, runDate);
const startedAt = new Date().toISOString();
const requests = [];
const errors = [];
let recordCount = 0;

await ensureDir(outDir);

for (const query of queries) {
  if (recordCount >= limit) break;
  const url = new URL("https://www.nber.org/papers");
  url.searchParams.set("page", "1");
  url.searchParams.set("perPage", String(Math.min(limit - recordCount, 50)));
  url.searchParams.set("sortBy", "public_date");
  url.searchParams.set("searchTerm", query);

  const response = await fetch(url, {
    headers: {
      "user-agent": "alpha-research-humanities-radar/0.1",
      accept: "text/html,application/xhtml+xml",
    },
  });
  const responsePath = path.join(outDir, `${query.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-001.html`);
  requests.push({
    query,
    page: 1,
    url: url.toString(),
    status: response.status,
    responsePath: path.relative(experimentDir, responsePath),
  });
  const body = await response.text();
  if (!response.ok) {
    errors.push({ query, page: 1, status: response.status, body: body.slice(0, 1000) });
    continue;
  }
  await writeText(responsePath, body);
  const ids = new Set([...body.matchAll(/\/papers\/(w\d+)/g)].map((match) => match[1]));
  recordCount += ids.size;
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

console.log(`Fetched ${recordCount} NBER page references into ${path.relative(process.cwd(), outDir)}`);
