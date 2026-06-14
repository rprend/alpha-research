import path from "node:path";
import {
  appendText,
  auditsDir,
  loadRegistry,
  processedDir,
  rawDir,
  readJsonl,
  relative,
  writeJson,
  writeJsonl,
} from "./kb-lib.mjs";

const runDate = new Date().toISOString().slice(0, 10);
const runId = `doaj-humanities-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const pageSize = Number.parseInt(getArg("--page-size") ?? "100", 10);
const maxPages = Number.parseInt(getArg("--max-pages") ?? "3", 10);
const timeoutMs = Number.parseInt(getArg("--timeout-ms") ?? "30000", 10);
const sourceId = "doaj-humanities";
const registry = await loadRegistry();
const source = registry.sources.find((entry) => entry.source_id === sourceId);
if (!source) throw new Error(`Missing source registry entry: ${sourceId}`);

const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const works = await readJsonl(path.join(processedDir, "works.jsonl"));
const venues = await readJsonl(path.join(processedDir, "venues.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));

const queries = [
  "humanities",
  "literature",
  "history",
  "philosophy",
  "art history",
  "digital humanities",
  "cultural studies",
  "language linguistics",
];

const jobs = [
  ...queries.flatMap((query) => pages("articles", query)),
  ...queries.flatMap((query) => pages("journals", query)),
];

const rawOutputs = [];
const records = [];
const errors = [];
const started = new Date().toISOString();
const sourceDir = path.join(rawDir, sourceId, runDate, runId);

for (const [index, job] of jobs.entries()) {
  const rawPath = path.join(sourceDir, `${job.kind}-${slugish(job.query)}-page-${job.page}.json`);
  try {
    const payload = await fetchJson(job.url);
    await writeJson(rawPath, payload);
    rawOutputs.push(relative(rawPath));
    const normalized = job.kind === "articles"
      ? normalizeArticles(payload, job)
      : normalizeJournals(payload, job);
    records.push(...normalized);
  } catch (error) {
    errors.push({
      route: job.url,
      message: error.message,
    });
  }
  if ((index + 1) % 5 === 0) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

const docs = dedupe(records, "local_id");
const articleDocs = docs.filter((row) => row.type === "scholarly-work");
const journalDocs = docs.filter((row) => row.type === "journal");

sourceDocuments.push(...docs);
works.push(...articleDocs);
venues.push(...journalDocs.map((row) => ({
  local_id: row.local_id,
  source_id: row.source_id,
  source_native_id: row.source_native_id,
  source_url: row.source_url,
  name: row.title,
  fetched_at: row.fetched_at,
  type: "journal",
  publisher: row.publisher ?? "",
  issn: row.issn ?? "",
  issn_l: "",
})));
rights.push(...docs.map((row) => rightsRow(row, source)));

await writeJsonl(path.join(processedDir, "source_documents.jsonl"), dedupe(sourceDocuments, "local_id"));
await writeJsonl(path.join(processedDir, "works.jsonl"), dedupe(works, "local_id"));
await writeJsonl(path.join(processedDir, "venues.jsonl"), dedupe(venues, "local_id"));
await writeJsonl(path.join(processedDir, "rights.jsonl"), dedupe(rights, "local_id"));

const record = {
  run_id: runId,
  source_id: sourceId,
  started_at: started,
  completed_at: new Date().toISOString(),
  status: docs.length ? "success" : "failed",
  access_route: jobs.map((job) => job.url).join(" | "),
  raw_outputs: rawOutputs,
  processed_outputs: [
    "data/knowledge-base/processed/source_documents.jsonl",
    "data/knowledge-base/processed/works.jsonl",
    "data/knowledge-base/processed/venues.jsonl",
    "data/knowledge-base/processed/rights.jsonl",
  ],
  record_count: docs.length,
  article_count: articleDocs.length,
  journal_count: journalDocs.length,
  page_size: pageSize,
  max_pages: maxPages,
  query_count: queries.length,
  rights_review: "DOAJ metadata import only. Full-text links are retained as source URLs, but full text is not stored by this script.",
  errors,
};

await writeJson(path.join(sourceDir, "manifest.json"), record);
await appendText(path.join(auditsDir, "ingest-runs.jsonl"), `${JSON.stringify(record)}\n`);
if (record.status === "failed") {
  await appendText(path.join(auditsDir, "failed-routes.jsonl"), `${JSON.stringify(record)}\n`);
}
await writeJson(path.join(auditsDir, "doaj-humanities-last-run.json"), {
  ...record,
  access_route: `${jobs.length} DOAJ API routes across articles and journals`,
});

console.log(`KB DOAJ ingest ${runId}: ${docs.length} records imported (${articleDocs.length} articles, ${journalDocs.length} journals).`);

function pages(kind, query) {
  return Array.from({ length: maxPages }, (_, index) => {
    const page = index + 1;
    return {
      kind,
      query,
      page,
      url: `https://doaj.org/api/search/${kind}/${encodeURIComponent(query)}?page=${page}&pageSize=${pageSize}`,
    };
  });
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "alpha-research-local-humanities-kb/0.1 mailto:research@alpharesearch.nyc",
        accept: "application/json",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeArticles(payload, job) {
  return (payload.results ?? []).map((row) => {
    const bib = row.bibjson ?? {};
    const doi = identifier(bib.identifier, "doi");
    const sourceUrl = firstFullTextUrl(bib.link) || (doi ? `https://doi.org/${doi}` : "");
    const title = cleanText(bib.title);
    return baseDoc(doi || row.id || title, title, sourceUrl, {
      type: "scholarly-work",
      publication_year: bib.year ?? "",
      venue: bib.journal?.title ?? "",
      doi,
      publisher: bib.journal?.publisher ?? "",
      description: cleanText(bib.abstract ?? ""),
      subjects: terms(bib.subject),
      keywords: Array.isArray(bib.keywords) ? bib.keywords.slice(0, 20) : [],
      doaj_query: job.query,
      doaj_kind: job.kind,
    });
  }).filter((row) => row.title || row.source_url);
}

function normalizeJournals(payload, job) {
  return (payload.results ?? []).map((row) => {
    const bib = row.bibjson ?? {};
    const issn = [bib.pissn, bib.eissn].filter(Boolean).join("; ");
    const sourceUrl = bib.ref?.journal || bib.ref?.aims_scope || "";
    const title = cleanText(bib.title);
    return baseDoc(row.id || issn || title, title, sourceUrl, {
      type: "journal",
      publication_year: bib.oa_start ?? "",
      venue: title,
      publisher: bib.publisher ?? bib.institution?.name ?? "",
      issn,
      description: cleanText(bib.ref?.aims_scope ?? ""),
      subjects: terms(bib.subject),
      keywords: Array.isArray(bib.keywords) ? bib.keywords.slice(0, 20) : [],
      doaj_query: job.query,
      doaj_kind: job.kind,
    });
  }).filter((row) => row.title || row.source_url);
}

function baseDoc(nativeId, title, url, extra = {}) {
  return {
    local_id: `${sourceId}:${slugish(nativeId || title || url)}`,
    source_id: sourceId,
    source_native_id: nativeId || "",
    source_url: url || "",
    title: title || "",
    fetched_at: new Date().toISOString(),
    ...extra,
  };
}

function rightsRow(row, registrySource) {
  return {
    local_id: row.local_id,
    source_id: sourceId,
    license: registrySource.license ?? "",
    redistribution_status: registrySource.redistribution_status ?? "metadata-ok",
    full_text_allowed: false,
    metadata_allowed: true,
    quote_status: "metadata-only-no-quotes",
    rights_note: "DOAJ metadata record. Full text is not stored; inspect item-level license before quoting article text.",
  };
}

function identifier(values, type) {
  return (values ?? []).find((entry) => String(entry.type).toLowerCase() === type)?.id ?? "";
}

function firstFullTextUrl(values) {
  return (values ?? []).find((entry) => entry.url)?.url ?? "";
}

function terms(values) {
  return (values ?? []).map((entry) => cleanText(entry.term)).filter(Boolean).slice(0, 20);
}

function cleanText(value) {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function dedupe(rows, key) {
  const byKey = new Map();
  for (const row of rows) {
    if (row[key]) byKey.set(row[key], row);
  }
  return Array.from(byKey.values());
}

function slugish(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 140);
}

function getArg(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}
