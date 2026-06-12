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
const rows = Math.min(Number(args.rows ?? 100), 1000);
const fromDate = args.from ?? "2020-01-01";
const toDate = args.to ?? today();
const runDate = args["run-date"] ?? today();
const queries = String(args.queries ?? defaultQueries.slice(0, 8).join("|"))
  .split("|")
  .map((query) => query.trim())
  .filter(Boolean);

const source = "crossref";
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
    const pageRows = Math.min(rows, limit - recordCount);
    const url = new URL("https://api.crossref.org/works");
    url.searchParams.set("query", query);
    url.searchParams.set("filter", `from-pub-date:${fromDate},until-pub-date:${toDate},type:journal-article`);
    url.searchParams.set("rows", String(pageRows));
    url.searchParams.set("cursor", cursor);
    url.searchParams.set("mailto", "research@example.com");

    const response = await fetch(url);
    const responsePath = path.join(outDir, `${query.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${String(page).padStart(3, "0")}.json`);
    requests.push({
      query,
      page,
      url: url.toString(),
      status: response.status,
      responsePath: path.relative(experimentDir, responsePath),
    });

    if (!response.ok) {
      errors.push({ query, page, status: response.status, body: await response.text() });
      break;
    }

    const json = await response.json();
    await writeJson(responsePath, json);
    const items = Array.isArray(json.message?.items) ? json.message.items : [];
    recordCount += items.length;
    cursor = json.message?.["next-cursor"];
    if (!cursor || items.length === 0) break;
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

console.log(`Fetched ${recordCount} Crossref records into ${path.relative(process.cwd(), outDir)}`);
