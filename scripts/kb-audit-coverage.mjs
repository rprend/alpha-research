import path from "node:path";
import {
  auditsDir,
  countBy,
  loadRegistry,
  readJsonl,
  sourceFreshness,
  writeJson,
  writeText,
  processedDir,
} from "./kb-lib.mjs";

const registry = await loadRegistry();
const sources = registry.sources ?? [];
const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));
const pages = await readJsonl(path.join(processedDir, "pages.jsonl"));
const works = await readJsonl(path.join(processedDir, "works.jsonl"));
const objects = await readJsonl(path.join(processedDir, "objects.jsonl"));
const freshness = sourceFreshness(sources);

const sourceIdsWithLocalDocs = new Set(sourceDocuments.map((row) => row.source_id));
const coverage = {
  generated_at: new Date().toISOString(),
  source_count: sources.length,
  source_classes: countBy(sources, "source_class"),
  source_ids_with_local_documents: Array.from(sourceIdsWithLocalDocs).sort(),
  source_count_with_local_documents: sourceIdsWithLocalDocs.size,
  local_records: {
    source_documents: sourceDocuments.length,
    works: works.length,
    objects: objects.length,
    pages: pages.length,
    rights: rights.length,
  },
  sources_without_local_documents: sources
    .filter((source) => !sourceIdsWithLocalDocs.has(source.source_id))
    .map((source) => ({
      source_id: source.source_id,
      source_class: source.source_class,
      ingest_status: source.ingest_status,
      redistribution_status: source.redistribution_status,
    })),
};

const rightsSummary = {
  generated_at: coverage.generated_at,
  rights_rows: rights.length,
  registry_redistribution_statuses: countBy(sources, "redistribution_status"),
  local_redistribution_statuses: countBy(rights, "redistribution_status"),
  local_full_text_allowed_count: rights.filter((row) => row.full_text_allowed === true || row.full_text_allowed === "true").length,
  local_metadata_allowed_count: rights.filter((row) => row.metadata_allowed === true || row.metadata_allowed === "true").length,
  local_quote_statuses: countBy(rights, "quote_status"),
};

const stale = {
  generated_at: coverage.generated_at,
  stale_source_count: freshness.filter((source) => source.stale).length,
  stale_sources: freshness.filter((source) => source.stale),
};

await writeJson(path.join(auditsDir, "source-coverage.json"), coverage);
await writeText(path.join(auditsDir, "source-coverage.md"), renderCoverage(coverage));
await writeJson(path.join(auditsDir, "rights-summary.json"), rightsSummary);
await writeText(path.join(auditsDir, "rights-summary.md"), renderRights(rightsSummary));
await writeJson(path.join(auditsDir, "stale-sources.json"), stale);
await writeText(path.join(auditsDir, "stale-sources.md"), renderStale(stale));

console.log(`KB coverage audit: ${coverage.source_count_with_local_documents}/${coverage.source_count} sources have local documents.`);

function renderCoverage(coverage) {
  return [
    "# KB Source Coverage",
    "",
    `Generated at: ${coverage.generated_at}`,
    `Sources with local documents: ${coverage.source_count_with_local_documents}/${coverage.source_count}`,
    "",
    "## Local Records",
    "",
    ...Object.entries(coverage.local_records).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Sources Without Local Documents",
    "",
    ...coverage.sources_without_local_documents.map((source) => `- ${source.source_id} (${source.source_class}, ${source.ingest_status}, ${source.redistribution_status})`),
    "",
  ].join("\n");
}

function renderRights(summary) {
  return [
    "# KB Rights Summary",
    "",
    `Generated at: ${summary.generated_at}`,
    `Rights rows: ${summary.rights_rows}`,
    `Local metadata-allowed rows: ${summary.local_metadata_allowed_count}`,
    `Local full-text-allowed rows: ${summary.local_full_text_allowed_count}`,
    "",
    "## Local Redistribution Statuses",
    "",
    table(summary.local_redistribution_statuses),
    "",
    "## Local Quote Statuses",
    "",
    table(summary.local_quote_statuses),
    "",
  ].join("\n");
}

function renderStale(stale) {
  return [
    "# KB Stale Sources",
    "",
    `Generated at: ${stale.generated_at}`,
    `Stale source count: ${stale.stale_source_count}`,
    "",
    stale.stale_sources.length ? stale.stale_sources.map((source) => `- ${source.source_id}: ${source.age_days} days old`).join("\n") : "No stale sources.",
    "",
  ].join("\n");
}

function table(counts) {
  const entries = Object.entries(counts);
  if (!entries.length) return "No entries.";
  return ["| Value | Count |", "| --- | ---: |", ...entries.map(([key, value]) => `| ${key} | ${value} |`)].join("\n");
}
