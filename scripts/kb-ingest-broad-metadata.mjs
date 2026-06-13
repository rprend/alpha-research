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
const runId = `broad-metadata-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const perSource = Number.parseInt(getArg("--per-source") ?? "250", 10);
const pageSize = Number.parseInt(getArg("--page-size") ?? "50", 10);
const timeoutMs = Number.parseInt(getArg("--timeout-ms") ?? "30000", 10);
const registry = await loadRegistry();
const registryById = new Map(registry.sources.map((source) => [source.source_id, source]));

const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const works = await readJsonl(path.join(processedDir, "works.jsonl"));
const objects = await readJsonl(path.join(processedDir, "objects.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));
const runRecords = [];

const jobs = [
  {
    source_id: "openalex-humanities",
    routes: openAlexRoutes(),
    normalize: normalizeOpenAlexWorks,
    sink: "works",
  },
  {
    source_id: "crossref-humanities",
    routes: crossrefRoutes(),
    normalize: normalizeCrossrefWorks,
    sink: "works",
  },
  {
    source_id: "internet-archive-metadata",
    routes: internetArchiveRoutes(),
    normalize: normalizeInternetArchive,
    sink: "works",
  },
  {
    source_id: "library-of-congress",
    routes: locRoutes(),
    normalize: normalizeLocItems,
    sink: "objects",
  },
  {
    source_id: "cleveland-museum-open-access",
    routes: clevelandRoutes(),
    normalize: normalizeClevelandArtworks,
    sink: "objects",
  },
  {
    source_id: "met-collection-api",
    routes: metRoutes(),
    normalize: normalizeMetStubs,
    sink: "objects",
  },
  {
    source_id: "nber-culture-history",
    routes: nberRoutes(),
    normalize: normalizeNber,
    sink: "works",
  },
];

for (const job of jobs) {
  job.registry = registryById.get(job.source_id) ?? {};
  const started = new Date().toISOString();
  const sourceDir = path.join(rawDir, job.source_id, runDate, runId);
  const rawOutputs = [];
  const processedRows = [];
  const errors = [];

  for (const [index, route] of job.routes.entries()) {
    const rawPath = path.join(sourceDir, `response-${String(index + 1).padStart(3, "0")}.json`);
    try {
      const payload = await fetchJson(route);
      await writeJson(rawPath, payload);
      rawOutputs.push(relative(rawPath));
      processedRows.push(...job.normalize(payload, job));
      if (processedRows.length >= perSource) break;
    } catch (error) {
      errors.push(`${route}: ${error.message}`);
    }
  }

  const normalized = dedupe(processedRows, "local_id").slice(0, perSource);
  sourceDocuments.push(...normalized);
  if (job.sink === "works") works.push(...normalized);
  if (job.sink === "objects") objects.push(...normalized);
  rights.push(...normalized.map((row) => rightsRow(row, job)));

  const status = normalized.length ? "success" : "failed";
  const record = {
    run_id: runId,
    source_id: job.source_id,
    started_at: started,
    completed_at: new Date().toISOString(),
    status,
    access_route: job.routes.join(" | "),
    raw_outputs: rawOutputs,
    processed_outputs: status === "success" ? processedOutputs(job.sink) : [],
    record_count: normalized.length,
    rights_review: status === "success"
      ? "Source registry rights fields apply; metadata only unless item-level rights allow more."
      : "Not reviewed because all fetches failed.",
    errors,
  };
  runRecords.push(record);
  if (status === "success") await writeJson(path.join(sourceDir, "manifest.json"), record);
  else await appendText(path.join(auditsDir, "failed-routes.jsonl"), `${JSON.stringify(record)}\n`);
}

await writeJsonl(path.join(processedDir, "source_documents.jsonl"), dedupe(sourceDocuments, "local_id"));
await writeJsonl(path.join(processedDir, "works.jsonl"), dedupe(works, "local_id"));
await writeJsonl(path.join(processedDir, "objects.jsonl"), dedupe(objects, "local_id"));
await writeJsonl(path.join(processedDir, "rights.jsonl"), dedupe(rights, "local_id"));
await appendText(path.join(auditsDir, "ingest-runs.jsonl"), `${runRecords.map((record) => JSON.stringify(record)).join("\n")}\n`);
await writeJson(path.join(auditsDir, "broad-metadata-last-run.json"), {
  run_id: runId,
  generated_at: new Date().toISOString(),
  per_source: perSource,
  page_size: pageSize,
  source_count: jobs.length,
  success_count: runRecords.filter((record) => record.status === "success").length,
  failed_count: runRecords.filter((record) => record.status === "failed").length,
  total_records: runRecords.reduce((sum, record) => sum + record.record_count, 0),
  records: runRecords,
});

console.log(`KB broad metadata ingest ${runId}: ${runRecords.filter((record) => record.status === "success").length}/${jobs.length} sources succeeded; ${runRecords.reduce((sum, record) => sum + record.record_count, 0)} records imported.`);

function openAlexRoutes() {
  const concepts = ["digital humanities", "literary criticism", "art history", "cultural history", "philosophy"];
  return concepts.map((term) => `https://api.openalex.org/works?search=${encodeURIComponent(term)}&per-page=${pageSize}&sort=cited_by_count:desc`);
}

function crossrefRoutes() {
  const terms = ["digital humanities", "literary criticism", "art history", "cultural history", "public humanities"];
  return terms.map((term, index) => `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(term)}&rows=${pageSize}&offset=${index * pageSize}`);
}

function internetArchiveRoutes() {
  const queries = ["subject:(humanities) AND mediatype:(texts)", "subject:(literature) AND mediatype:(texts)", "subject:(philosophy) AND mediatype:(texts)"];
  return queries.map((query) => `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=collection&fl[]=licenseurl&rows=${pageSize}&page=1&output=json`);
}

function locRoutes() {
  const subjects = ["literature", "history", "art", "philosophy", "music"];
  return subjects.map((subject) => `https://www.loc.gov/books/?fo=json&c=${pageSize}&fa=subject:${encodeURIComponent(subject)}`);
}

function clevelandRoutes() {
  return [0, 1, 2, 3, 4].map((page) => `https://openaccess-api.clevelandart.org/api/artworks/?limit=${pageSize}&skip=${page * pageSize}&has_image=1`);
}

function metRoutes() {
  const terms = ["painting", "sculpture", "photograph", "textile", "drawing"];
  return terms.map((term) => `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(term)}`);
}

function nberRoutes() {
  const terms = ["culture history", "art culture", "education history", "religion history", "media culture"];
  return terms.map((term) => `https://www.nber.org/api/v1/working_page_listing/contentType/working_paper/_/_/search?search=${encodeURIComponent(term)}&page=1&perPage=${pageSize}`);
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

function normalizeOpenAlexWorks(payload, source) {
  return (payload.results ?? []).map((row) => baseDoc(source, row.id, row.title, row.id, {
    type: "scholarly-work",
    publication_year: row.publication_year ?? "",
    venue: row.primary_location?.source?.display_name ?? "",
    doi: row.doi ?? "",
    open_access: row.open_access?.is_oa ?? "",
    description: row.abstract_inverted_index ? "OpenAlex abstract index available." : "",
  }));
}

function normalizeCrossrefWorks(payload, source) {
  return (payload.message?.items ?? []).map((row) => baseDoc(source, row.DOI, first(row.title), row.URL, {
    type: "scholarly-work",
    publication_year: row.issued?.["date-parts"]?.[0]?.[0] ?? "",
    venue: first(row["container-title"]),
    doi: row.DOI ?? "",
    publisher: row.publisher ?? "",
  }));
}

function normalizeInternetArchive(payload, source) {
  return (payload.response?.docs ?? []).map((row) => baseDoc(source, row.identifier, row.title, `https://archive.org/details/${row.identifier}`, {
    type: "archive-text-metadata",
    publication_year: row.date ?? "",
    venue: asText(row.collection),
    creator: asText(row.creator),
    licenseurl: asText(row.licenseurl),
  }));
}

function normalizeLocItems(payload, source) {
  return (payload.results ?? []).map((row) => baseDoc(source, row.id, row.title, row.url, {
    type: "loc-item",
    date: Array.isArray(row.date) ? row.date.join("; ") : row.date ?? "",
    subjects: Array.isArray(row.subject) ? row.subject.slice(0, 12) : [],
    rights: row.rights ?? "",
  }));
}

function normalizeClevelandArtworks(payload, source) {
  return (payload.data ?? []).map((row) => baseDoc(source, row.id, row.title, row.url, {
    type: "museum-object",
    creation_date: row.creation_date ?? "",
    department: row.department ?? "",
    culture: Array.isArray(row.culture) ? row.culture.join("; ") : row.culture ?? "",
    share_license_status: row.share_license_status ?? "",
  }));
}

function normalizeMetStubs(payload, source) {
  return (payload.objectIDs ?? []).slice(0, pageSize).map((id) => baseDoc(source, id, `Met object ${id}`, `https://www.metmuseum.org/art/collection/search/${id}`, {
    type: "museum-object-stub",
  }));
}

function normalizeNber(payload, source) {
  const rows = payload.results ?? payload.data ?? payload.items ?? [];
  return rows.map((row) => baseDoc(source, row.id ?? row.nid ?? row.url ?? row.title, cleanText(row.title ?? row.name ?? ""), absoluteUrl(row.url ?? row.path), {
    type: "working-paper",
    publication_year: row.year ?? row.date ?? "",
    venue: "NBER",
    description: cleanText(row.abstract ?? row.search_api_excerpt ?? ""),
  })).filter((row) => row.title || row.source_url);
}

function baseDoc(source, nativeId, title, url, extra = {}) {
  return {
    local_id: `${source.source_id}:${slugish(nativeId || title || url)}`,
    source_id: source.source_id,
    source_native_id: nativeId || "",
    source_url: url || "",
    title: title || "",
    fetched_at: new Date().toISOString(),
    ...extra,
  };
}

function rightsRow(row, source) {
  return {
    local_id: row.local_id,
    source_id: source.source_id,
    license: source.registry?.license ?? "",
    redistribution_status: source.registry?.redistribution_status ?? "",
    full_text_allowed: false,
    metadata_allowed: source.registry?.metadata_allowed ?? true,
    quote_status: source.registry?.redistribution_status === "local-analysis-only" ? "needs-review" : "metadata-only-no-quotes",
    rights_note: "Broad metadata import; inspect source and item-level rights before publication use.",
  };
}

function processedOutputs(sink) {
  const outputs = [
    "data/knowledge-base/processed/source_documents.jsonl",
    "data/knowledge-base/processed/rights.jsonl",
  ];
  if (sink === "works") outputs.push("data/knowledge-base/processed/works.jsonl");
  if (sink === "objects") outputs.push("data/knowledge-base/processed/objects.jsonl");
  return outputs;
}

function getArg(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

function first(value) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function asText(value) {
  return Array.isArray(value) ? value.join("; ") : value ?? "";
}

function absoluteUrl(value) {
  if (!value) return "";
  try {
    return new URL(value, "https://www.nber.org").toString();
  } catch {
    return "";
  }
}

function cleanText(value) {
  return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
