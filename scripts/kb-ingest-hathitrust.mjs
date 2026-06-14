import path from "node:path";
import {
  appendText,
  auditsDir,
  loadRegistry,
  processedDir,
  rawDir,
  readJsonl,
  relative,
  slug,
  writeJson,
  writeJsonl,
} from "./kb-lib.mjs";

const runDate = new Date().toISOString().slice(0, 10);
const runId = `hathitrust-bibliographic-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const sourceId = "hathitrust-bibliographic-metadata";
const limit = Number.parseInt(getArg("--limit") ?? "25", 10);
const candidateLimit = Number.parseInt(getArg("--candidate-limit") ?? "120", 10);
const timeoutMs = Number.parseInt(getArg("--timeout-ms") ?? "20000", 10);
const registry = await loadRegistry();
const source = registry.sources.find((entry) => entry.source_id === sourceId) ?? {};
const runDir = path.join(rawDir, sourceId, runDate, runId);

const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const works = await readJsonl(path.join(processedDir, "works.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));

const started = new Date().toISOString();
const documents = [];
const rawOutputs = [];
const errors = [];

const iaRoute = `https://archive.org/advancedsearch.php?q=${encodeURIComponent("subject:(humanities) AND mediatype:(texts)")}&fl[]=identifier&fl[]=title&fl[]=isbn&fl[]=lccn&fl[]=oclc_id&rows=${candidateLimit}&page=1&output=json`;
const iaPayload = await fetchJson(iaRoute);
const iaPath = path.join(runDir, "internet-archive-humanities-candidates.json");
await writeJson(iaPath, iaPayload);
rawOutputs.push(relative(iaPath));

const iaCandidates = (iaPayload.response?.docs ?? [])
  .filter((row) => row.identifier)
  .filter((row) => identifierQueries(row).length);

for (const candidate of iaCandidates) {
  if (documents.length >= limit) break;
  const identifiers = identifierQueries(candidate);
  for (const identifier of identifiers) {
    if (documents.length >= limit) break;
    const hathiRoute = `https://catalog.hathitrust.org/api/volumes/brief/${identifier.type}/${encodeURIComponent(identifier.value)}.json`;
    try {
      const hathiPayload = await fetchJson(hathiRoute);
      const hathiPath = path.join(runDir, "hathi-api", `${slug(`${identifier.type}-${identifier.value}`)}.json`);
      await writeJson(hathiPath, hathiPayload);
      rawOutputs.push(relative(hathiPath));

      const rows = normalizeHathiResponse(hathiPayload, candidate, identifier);
      documents.push(...rows);
      if (rows.length) break;
    } catch (error) {
      errors.push(`${candidate.identifier} ${identifier.type}:${identifier.value}: ${error.message}`);
    }
  }
}

const normalized = dedupe(documents, "local_id").slice(0, limit);
sourceDocuments.push(...normalized);
works.push(...normalized);
rights.push(...normalized.map((row) => rightsRow(row, source)));

await writeJsonl(path.join(processedDir, "source_documents.jsonl"), dedupe(sourceDocuments, "local_id"));
await writeJsonl(path.join(processedDir, "works.jsonl"), dedupe(works, "local_id"));
await writeJsonl(path.join(processedDir, "rights.jsonl"), dedupe(rights, "local_id"));

const record = {
  run_id: runId,
  source_id: sourceId,
  started_at: started,
  completed_at: new Date().toISOString(),
  status: normalized.length ? "success" : "failed",
  access_route: "Internet Archive identifiers -> HathiTrust Bibliographic API brief endpoint",
  raw_outputs: rawOutputs,
  processed_outputs: normalized.length ? [
    "data/knowledge-base/processed/source_documents.jsonl",
    "data/knowledge-base/processed/works.jsonl",
    "data/knowledge-base/processed/rights.jsonl",
  ] : [],
  record_count: normalized.length,
  rights_review: normalized.length
    ? "Metadata-only HathiTrust Bibliographic API enrichment; no HathiTrust full text is stored."
    : "No records created; inspect identifier coverage and route availability.",
  errors,
};

await appendText(path.join(auditsDir, "ingest-runs.jsonl"), `${JSON.stringify(record)}\n`);
if (normalized.length) await writeJson(path.join(runDir, "manifest.json"), record);
else await appendText(path.join(auditsDir, "failed-routes.jsonl"), `${JSON.stringify(record)}\n`);
await writeJson(path.join(auditsDir, "hathitrust-bibliographic-last-run.json"), {
  ...record,
  candidate_count: iaPayload.response?.docs?.length ?? 0,
  identifier_candidate_count: iaCandidates.length,
  imported_record_count: normalized.length,
});

console.log(`HathiTrust bibliographic ingest ${runId}: ${normalized.length} records imported from ${iaCandidates.length} Internet Archive candidates.`);

function identifierQueries(metadata) {
  const rows = [];
  for (const value of asList(metadata.oclc_id)) rows.push({ type: "oclc", value });
  for (const value of asList(metadata.lccn)) rows.push({ type: "lccn", value });
  for (const value of asList(metadata.isbn)) rows.push({ type: "isbn", value });
  const seen = new Set();
  return rows
    .map((row) => ({ ...row, value: String(row.value).trim() }))
    .filter((row) => row.value)
    .filter((row) => {
      const key = `${row.type}:${row.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function normalizeHathiResponse(payload, candidate, identifier) {
  const records = payload.records ?? {};
  const rows = [];
  for (const item of payload.items ?? []) {
    const record = records[item.fromRecord] ?? {};
    const title = first(record.titles) || candidate.title || item.htid;
    rows.push({
      local_id: `${sourceId}:${slug(item.htid || `${item.fromRecord}-${identifier.type}-${identifier.value}`)}`,
      source_id: sourceId,
      source_native_id: item.htid ?? item.fromRecord ?? "",
      source_url: item.itemURL ?? record.recordURL ?? "",
      title,
      fetched_at: new Date().toISOString(),
      type: "hathitrust-volume-metadata",
      venue: "HathiTrust Digital Library",
      source_identifier_type: identifier.type,
      source_identifier_value: identifier.value,
      linked_source_id: candidate.source_id ?? "internet-archive-metadata",
      linked_source_native_id: candidate.source_native_id ?? candidate.identifier,
      hathi_record_number: item.fromRecord ?? "",
      hathi_record_url: record.recordURL ?? "",
      rights_code: item.rightsCode ?? "",
      us_rights_string: item.usRightsString ?? "",
      last_update: item.lastUpdate ?? "",
      enumcron: item.enumcron || "",
      origin_institution: item.orig ?? "",
      isbns: (record.isbns ?? []).join("; "),
      issns: (record.issns ?? []).join("; "),
      oclcs: (record.oclcs ?? []).join("; "),
      lccns: (record.lccns ?? []).join("; "),
      description: `HathiTrust Bibliographic API metadata linked from Internet Archive humanities candidate ${candidate.source_native_id ?? candidate.identifier}.`,
    });
  }
  return rows;
}

function rightsRow(row, registrySource) {
  return {
    local_id: row.local_id,
    source_id: sourceId,
    license: registrySource.license ?? "HathiTrust metadata; item-level rights vary",
    redistribution_status: registrySource.redistribution_status ?? "metadata-only",
    full_text_allowed: false,
    metadata_allowed: true,
    quote_status: "metadata-only-no-quotes",
    rights_note: "HathiTrust Bibliographic API metadata only; do not store or redistribute HathiTrust full text from this ingest.",
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "alpha-research-local-humanities-kb/0.1 mailto:research@alpharesearch.nyc",
        "accept": "application/json",
      },
    });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function asList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : String(value).split(/[;,]/);
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

function getArg(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}
