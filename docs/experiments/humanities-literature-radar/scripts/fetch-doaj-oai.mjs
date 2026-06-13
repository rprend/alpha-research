import fs from "node:fs/promises";
import path from "node:path";
import {
  defaultQueries,
  ensureDir,
  experimentDir,
  parseArgs,
  today,
  writeJson,
  writeManifest,
  writeText,
} from "./lib.mjs";

const args = parseArgs();
const source = "doaj-oai";
const runDate = args["run-date"] ?? today();
const from = args.from ?? "2020-01-01";
const until = args.until ?? runDate;
const maxPages = Number(args["max-pages"] ?? 25);
const timeout = Number(args.timeout ?? 30000);
const resume = args.resume === "true";
const rawDir = path.join(experimentDir, "data", "raw", source, runDate);
const reportsDir = path.join(experimentDir, "reports");
const checkpointPath = path.join(rawDir, "checkpoint.json");
const startedAt = new Date().toISOString();
let requests = [];
let errors = [];
let recordCount = 0;
let page = 1;
let resumptionToken = "";
let resumedFromCheckpoint = false;

await ensureDir(rawDir);

if (resume) {
  const checkpoint = await readCheckpoint(checkpointPath);
  if (checkpoint?.nextPage) {
    requests = checkpoint.requests ?? [];
    errors = checkpoint.errors ?? [];
    recordCount = checkpoint.recordCount ?? 0;
    page = checkpoint.nextPage;
    resumptionToken = checkpoint.resumptionToken ?? "";
    resumedFromCheckpoint = true;
  }
}

while (page <= maxPages) {
  const url = new URL("https://doaj.org/oai.article");
  if (resumptionToken) {
    url.searchParams.set("verb", "ListRecords");
    url.searchParams.set("resumptionToken", resumptionToken);
  } else {
    url.searchParams.set("verb", "ListRecords");
    url.searchParams.set("metadataPrefix", "oai_dc");
    url.searchParams.set("from", from);
    url.searchParams.set("until", until);
  }

  const responsePath = path.join(rawDir, `records-${String(page).padStart(4, "0")}.xml`);
  let body = "";
  let status = "fetch-error";
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "alpha-research-humanities-radar-doaj-oai/0.1",
        accept: "application/xml,text/xml",
      },
      signal: AbortSignal.timeout(timeout),
    });
    status = response.status;
    body = await response.text();
  } catch (error) {
    errors.push({ page, url: url.toString(), error: error.message });
    requests.push({ page, url: url.toString(), status, responsePath: path.relative(experimentDir, responsePath) });
    break;
  }

  requests.push({ page, url: url.toString(), status, responsePath: path.relative(experimentDir, responsePath) });
  if (Number(status) < 200 || Number(status) >= 300) {
    errors.push({ page, url: url.toString(), status, body: body.slice(0, 1000) });
    break;
  }

  await writeText(responsePath, body);
  const pageRecords = (body.match(/<record[\s>]/g) ?? []).length;
  recordCount += pageRecords;
  resumptionToken = extractResumptionToken(body);
  await writeJson(checkpointPath, {
    source,
    runDate,
    from,
    until,
    maxPages,
    updatedAt: new Date().toISOString(),
    completed: !resumptionToken || page >= maxPages,
    lastFetchedPage: page,
    nextPage: page + 1,
    resumptionToken,
    recordCount,
    requests,
    errors,
  });
  if (!resumptionToken) break;
  page += 1;
}

const manifestPath = await writeManifest({
  source,
  runDate,
  startedAt,
  finishedAt: new Date().toISOString(),
  requests,
  recordCount,
  errors,
});

await writeJson(path.join(reportsDir, "doaj-oai-backfill-route.json"), {
  generatedAt: new Date().toISOString(),
  source,
  runDate,
  from,
  until,
  maxPages,
  resume,
  resumedFromCheckpoint,
  pagesFetched: requests.filter((request) => Number(request.status) >= 200 && Number(request.status) < 300).length,
  recordCount,
  manifestPath: path.relative(experimentDir, manifestPath),
  checkpointPath: path.relative(experimentDir, checkpointPath),
  route: "https://doaj.org/oai.article?verb=ListRecords&metadataPrefix=oai_dc&from=<YYYY-MM-DD>&until=<YYYY-MM-DD>",
  sourceDocs: "https://doaj.org/docs/oai-pmh/",
  corpusTier: maxPages >= 100 ? "broad-backfill-corpus" : maxPages >= 25 ? "pilot-corpus" : "schema-probe",
  nextActions: [
    "Run with --resume=true and a larger page budget, or without --max-pages, for the full 2020-present DOAJ article harvest.",
    "Filter and classify harvested Dublin Core records after normalization rather than constraining the fetch to keyword search results.",
    "Use the manifest request list and resumption-token pagination to resume or audit failed pages.",
  ],
  queryTermsNoLongerUsedForFetch: defaultQueries,
});

console.log(`Fetched ${recordCount} DOAJ OAI records across ${requests.length} page(s) into ${path.relative(process.cwd(), rawDir)}`);

function extractResumptionToken(xml) {
  const match = String(xml).match(/<resumptionToken(?:\s[^>]*)?>([\s\S]*?)<\/resumptionToken>/i);
  return match ? decodeXmlText(match[1].trim()) : "";
}

function decodeXmlText(value) {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

async function readCheckpoint(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}
