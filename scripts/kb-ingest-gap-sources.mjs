import path from "node:path";
import {
  appendText,
  auditsDir,
  cleanHtml,
  extractTitle,
  loadRegistry,
  processedDir,
  rawDir,
  readJsonl,
  relative,
  writeJson,
  writeJsonl,
  writeText,
} from "./kb-lib.mjs";

const runDate = new Date().toISOString().slice(0, 10);
const runId = `gap-sources-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const limit = Number.parseInt(getArg("--limit") ?? "25", 10);
const timeoutMs = Number.parseInt(getArg("--timeout-ms") ?? "30000", 10);
const registry = await loadRegistry();
const registryById = new Map(registry.sources.map((source) => [source.source_id, source]));

const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const works = await readJsonl(path.join(processedDir, "works.jsonl"));
const objects = await readJsonl(path.join(processedDir, "objects.jsonl"));
const pages = await readJsonl(path.join(processedDir, "pages.jsonl"));
const departments = await readJsonl(path.join(processedDir, "departments.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));
const runRecords = [];

const jobs = [
  jsonJob("smithsonian-open-access", [
    `https://api.si.edu/openaccess/api/v1.0/search?api_key=DEMO_KEY&q=${encodeURIComponent("humanities")}&rows=${limit}`,
    `https://api.si.edu/openaccess/api/v1.0/search?api_key=DEMO_KEY&q=${encodeURIComponent("art history")}&rows=${limit}`,
  ], normalizeSmithsonian, "objects"),
  textJob("columbia-humanities-departments", [
    "https://history.columbia.edu/",
  ], normalizeColumbiaPage, "pages"),
  jsonJob("dh-conference-programs", [
    `https://dh2026.adho.org/wp-json/wp/v2/pages?per_page=${Math.min(limit, 50)}`,
    `https://dh2026.adho.org/wp-json/wp/v2/posts?per_page=${Math.min(limit, 50)}`,
  ], normalizeDhConference, "works"),
  jsonJob("journal-new-literary-history", [
    `https://api.crossref.org/journals/1080-661X/works?rows=${limit}`,
  ], normalizeCrossrefJournal("New Literary History"), "works"),
  jsonJob("journal-critical-inquiry", [
    `https://api.crossref.org/journals/0093-1896/works?rows=${limit}`,
    `https://api.crossref.org/works?query.container-title=${encodeURIComponent("Critical Inquiry")}&rows=${limit}`,
  ], normalizeCrossrefJournal("Critical Inquiry"), "works"),
  jsonJob("journal-pmla", [
    `https://api.crossref.org/journals/0030-8129/works?rows=${limit}`,
    `https://api.crossref.org/works?query.container-title=${encodeURIComponent("PMLA")}&rows=${limit}`,
  ], normalizeCrossrefJournal("PMLA"), "works"),
  textJob("mla-convention-programs", [
    "https://www.mla.org/Events/2027-MLA-Convention",
  ], normalizeMlaPage, "works"),
  jsonJob("aha-annual-meeting-programs", [
    `https://www.historians.org/wp-json/wp/v2/search?search=${encodeURIComponent("annual meeting program")}&per_page=${Math.min(limit, 50)}`,
    `https://www.historians.org/wp-json/wp/v2/pages?search=${encodeURIComponent("annual meeting program")}&per_page=${Math.min(limit, 50)}`,
  ], normalizeAhaProgramMetadata, "works"),
  blockedProbe("ssrn-humanities-adjacent", "https://api.ssrn.com/content/v1/papers?query=humanities"),
];

for (const job of jobs) {
  job.registry = registryById.get(job.source_id) ?? {};
  const started = new Date().toISOString();
  const sourceDir = path.join(rawDir, job.source_id, runDate, runId);
  const rawOutputs = [];
  const processedRows = [];
  const errors = [];

  for (const [index, route] of job.routes.entries()) {
    const rawPath = path.join(sourceDir, `response-${String(index + 1).padStart(3, "0")}.${job.format === "json" ? "json" : "txt"}`);
    try {
      const payload = job.format === "json" ? await fetchJson(route) : await fetchText(route);
      if (job.format === "json") await writeJson(rawPath, payload);
      else await writeText(rawPath, payload);
      rawOutputs.push(relative(rawPath));
      processedRows.push(...job.normalize(payload, job, route));
    } catch (error) {
      errors.push(`${route}: ${error.message}`);
    }
  }

  const normalized = dedupe(processedRows, "local_id").slice(0, limit);
  sourceDocuments.push(...normalized);
  if (job.sink === "works") works.push(...normalized);
  if (job.sink === "objects") objects.push(...normalized);
  if (job.sink === "pages") {
    pages.push(...normalized.map((row) => ({
      local_id: row.local_id,
      source_id: row.source_id,
      school: row.school ?? "",
      department: row.department ?? "",
      page_type: row.type ?? "",
      source_url: row.source_url,
      title: row.title,
      fetched_at: row.fetched_at,
      text_path: row.text_path ?? "",
      text_chars: row.text_chars ?? "",
      status: "200",
    })));
    departments.push(...departmentRows(normalized));
  }
  rights.push(...normalized.map((row) => rightsRow(row, job)));

  const status = normalized.length ? "success" : "failed";
  const record = manifestRecord(job, started, status, rawOutputs, normalized.length, errors);
  runRecords.push(record);
  if (status === "success") await writeJson(path.join(sourceDir, "manifest.json"), record);
  else await appendText(path.join(auditsDir, "failed-routes.jsonl"), `${JSON.stringify(record)}\n`);
}

await writeJsonl(path.join(processedDir, "source_documents.jsonl"), dedupe(sourceDocuments, "local_id"));
await writeJsonl(path.join(processedDir, "works.jsonl"), dedupe(works, "local_id"));
await writeJsonl(path.join(processedDir, "objects.jsonl"), dedupe(objects, "local_id"));
await writeJsonl(path.join(processedDir, "pages.jsonl"), dedupe(pages, "local_id"));
await writeJsonl(path.join(processedDir, "departments.jsonl"), dedupe(departments, "local_id"));
await writeJsonl(path.join(processedDir, "rights.jsonl"), dedupe(rights, "local_id"));
await appendText(path.join(auditsDir, "ingest-runs.jsonl"), `${runRecords.map((record) => JSON.stringify(record)).join("\n")}\n`);
await writeJson(path.join(auditsDir, "gap-sources-last-run.json"), {
  run_id: runId,
  generated_at: new Date().toISOString(),
  source_count: jobs.length,
  success_count: runRecords.filter((record) => record.status === "success").length,
  failed_count: runRecords.filter((record) => record.status === "failed").length,
  total_records: runRecords.reduce((sum, record) => sum + record.record_count, 0),
  records: runRecords,
});

console.log(`KB gap-source ingest ${runId}: ${runRecords.filter((record) => record.status === "success").length}/${jobs.length} sources succeeded; ${runRecords.reduce((sum, record) => sum + record.record_count, 0)} records imported.`);

function jsonJob(sourceId, routes, normalize, sink) {
  return { source_id: sourceId, routes, normalize, sink, format: "json" };
}

function textJob(sourceId, routes, normalize, sink) {
  return { source_id: sourceId, routes, normalize, sink, format: "text" };
}

function blockedProbe(sourceId, route) {
  return textJob(sourceId, [route], () => [], "works");
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url, "application/json"));
}

async function fetchText(url, accept = "text/html,application/xml,text/xml,application/json") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "alpha-research-local-humanities-kb/0.1 mailto:research@alpharesearch.nyc",
        accept,
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSmithsonian(payload, source) {
  const rows = payload.response?.rows ?? [];
  return rows.map((row) => baseDoc(source, row.id, row.title, `https://www.si.edu/object/${row.id}`, {
    type: "smithsonian-object",
    date: row.content?.indexedStructured?.date?.join?.("; ") ?? "",
    department: row.unitCode ?? "",
    culture: row.content?.indexedStructured?.culture?.join?.("; ") ?? "",
    description: cleanHtml(row.content?.descriptiveNonRepeating?.notes?.[0]?.content ?? ""),
  }));
}

function normalizeColumbiaPage(html, source, route) {
  const text = cleanHtml(html);
  return [baseDoc(source, route, extractTitle(html) || "Columbia History Department", route, {
    type: "department-home",
    school: "Columbia University",
    department: "History",
    description: text.slice(0, 1200),
    text_chars: text.length,
    text_path: "",
  })];
}

function normalizeDhConference(payload, source) {
  return payload.map((row) => baseDoc(source, row.id, cleanHtml(row.title?.rendered ?? ""), row.link, {
    type: row.type === "page" ? "conference-page" : "conference-post",
    publication_year: row.date ?? "",
    venue: "DH2026",
    description: cleanHtml(row.excerpt?.rendered ?? row.content?.rendered ?? "").slice(0, 1200),
  }));
}

function normalizeCrossrefJournal(venueName) {
  return (payload, source) => (payload.message?.items ?? []).map((row) => baseDoc(source, row.DOI, first(row.title), row.URL, {
    type: "journal-article-metadata",
    publication_year: row.issued?.["date-parts"]?.[0]?.[0] ?? "",
    venue: first(row["container-title"]) || venueName,
    doi: row.DOI ?? "",
    publisher: row.publisher ?? "",
  }));
}

function normalizeMlaPage(html, source, route) {
  const text = cleanHtml(html);
  return [baseDoc(source, route, extractTitle(html) || "MLA Convention", route, {
    type: "conference-page",
    publication_year: "2027",
    venue: "MLA Convention",
    description: text.slice(0, 1200),
  })];
}

function normalizeAhaProgramMetadata(payload, source) {
  const rows = Array.isArray(payload) ? payload : [];
  return rows.map((row) => {
    const title = cleanHtml(row.title?.rendered ?? row.title ?? "");
    const url = row.link ?? row.url ?? "";
    const description = cleanHtml(row.excerpt?.rendered ?? row.content?.rendered ?? row.description ?? "").slice(0, 1200);
    const publicationYear = String(row.date ?? row.modified ?? "").slice(0, 4);
    return baseDoc(source, row.id ?? url ?? title, title, url, {
      type: row.type === "page" || row.subtype === "page" ? "conference-page" : "conference-program-metadata",
      publication_year: publicationYear,
      venue: "American Historical Association Annual Meeting",
      description,
      route_replacement_note: "Imported from public WordPress JSON search/pages endpoints after the HTML annual-meeting page returned 403.",
    });
  }).filter((row) =>
    row.title &&
    /annual meeting|conference|program|session|cfp|call for proposals/i.test(`${row.title} ${row.description} ${row.source_url}`)
  );
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
  const localAnalysis = source.registry?.redistribution_status === "local-analysis-only";
  return {
    local_id: row.local_id,
    source_id: source.source_id,
    license: source.registry?.license ?? "",
    redistribution_status: source.registry?.redistribution_status ?? "",
    full_text_allowed: false,
    metadata_allowed: source.registry?.metadata_allowed ?? true,
    quote_status: localAnalysis ? "needs-review" : "metadata-only-no-quotes",
    rights_note: "Gap-source metadata import; inspect source and item-level rights before publication use.",
  };
}

function departmentRows(rows) {
  const byDept = new Map();
  for (const row of rows) {
    const key = `${row.source_id}:${slugish(`${row.school}-${row.department}`)}`;
    byDept.set(key, {
      local_id: key,
      source_id: row.source_id,
      school: row.school ?? "",
      department: row.department ?? "",
      homepage_url: row.source_url,
      page_count: 1,
      first_seen_at: row.fetched_at,
      last_seen_at: row.fetched_at,
    });
  }
  return Array.from(byDept.values());
}

function manifestRecord(job, started, status, rawOutputs, recordCount, errors) {
  return {
    run_id: runId,
    source_id: job.source_id,
    started_at: started,
    completed_at: new Date().toISOString(),
    status,
    access_route: job.routes.join(" | "),
    raw_outputs: rawOutputs,
    processed_outputs: status === "success" ? processedOutputs(job.sink) : [],
    record_count: recordCount,
    rights_review: status === "success" ? "Source registry rights fields apply; metadata only unless item-level rights allow more." : "No local records created; route replacement or terms review required.",
    errors,
  };
}

function processedOutputs(sink) {
  const outputs = [
    "data/knowledge-base/processed/source_documents.jsonl",
    "data/knowledge-base/processed/rights.jsonl",
  ];
  if (sink === "works") outputs.push("data/knowledge-base/processed/works.jsonl");
  if (sink === "objects") outputs.push("data/knowledge-base/processed/objects.jsonl");
  if (sink === "pages") outputs.push("data/knowledge-base/processed/pages.jsonl", "data/knowledge-base/processed/departments.jsonl");
  return outputs;
}

function getArg(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

function first(value) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
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
