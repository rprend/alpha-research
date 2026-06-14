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

const registrySourceIds = new Set(sources.map((source) => source.source_id));
const sourceIdsWithLocalDocs = new Set(sourceDocuments.map((row) => row.source_id).filter(Boolean));
const sourceDocumentsBySource = countBy(sourceDocuments, "source_id");
const registeredSourceIdsWithLocalDocs = Array.from(sourceIdsWithLocalDocs)
  .filter((sourceId) => registrySourceIds.has(sourceId))
  .sort();
const unregisteredSourceIdsWithLocalDocs = Array.from(sourceIdsWithLocalDocs)
  .filter((sourceId) => !registrySourceIds.has(sourceId))
  .sort();
const coverage = {
  generated_at: new Date().toISOString(),
  source_count: sources.length,
  source_classes: countBy(sources, "source_class"),
  source_ids_with_local_documents: registeredSourceIdsWithLocalDocs,
  source_count_with_local_documents: registeredSourceIdsWithLocalDocs.length,
  unregistered_source_ids_with_local_documents: unregisteredSourceIdsWithLocalDocs,
  unregistered_source_count_with_local_documents: unregisteredSourceIdsWithLocalDocs.length,
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
coverage.source_class_quality = sourceClassQuality(sources, sourceDocumentsBySource);

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
    `Unregistered local source IDs: ${coverage.unregistered_source_count_with_local_documents}`,
    "",
    "## Local Records",
    "",
    ...Object.entries(coverage.local_records).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Unregistered Local Source IDs",
    "",
    ...(coverage.unregistered_source_ids_with_local_documents.length
      ? coverage.unregistered_source_ids_with_local_documents.map((sourceId) => `- ${sourceId}`)
      : ["No unregistered local source IDs."]),
    "",
    "## Sources Without Local Documents",
    "",
    ...coverage.sources_without_local_documents.map((source) => `- ${source.source_id} (${source.source_class}, ${source.ingest_status}, ${source.redistribution_status})`),
    "",
    "## Source-Class Quality Gates",
    "",
    ...coverage.source_class_quality.map((row) => `- ${row.source_class}: ${row.status} (${row.sources_with_documents}/${row.required_sources_with_documents} sources, ${row.document_count}/${row.required_document_count} docs)`),
    "",
  ].join("\n");
}

function sourceClassQuality(sources, sourceDocumentsBySource) {
  const thresholds = {
    "scholarly-metadata": { min_sources_with_documents: 3, min_documents: 500 },
    "linked-open-data": { min_sources_with_documents: 1, min_documents: 250 },
    "public-domain-texts": { min_sources_with_documents: 1, min_documents: 100 },
    "open-text-metadata": { min_sources_with_documents: 1, min_documents: 100 },
    "cultural-collections": { min_sources_with_documents: 3, min_documents: 500 },
    "university-department-web": { min_sources_with_documents: 6, min_documents: 250 },
    "conference-programs": { min_sources_with_documents: 2, min_documents: 25 },
    "journals-and-reviews": { min_sources_with_documents: 4, min_documents: 75 },
    "humanities-adjacent-policy-history": { min_sources_with_documents: 2, min_documents: 50 },
    "web-archives": { min_sources_with_documents: 1, min_documents: 10 },
    "experiment-derived": { min_sources_with_documents: 2, min_documents: 25 },
  };
  const byClass = new Map();
  for (const source of sources) {
    const current = byClass.get(source.source_class) ?? {
      source_class: source.source_class,
      source_count: 0,
      blocked_source_count: 0,
      sources_with_documents: 0,
      document_count: 0,
      source_ids: [],
    };
    const count = sourceDocumentsBySource[source.source_id] ?? 0;
    current.source_count += 1;
    if (source.ingest_status === "blocked") current.blocked_source_count += 1;
    if (count > 0) current.sources_with_documents += 1;
    current.document_count += count;
    current.source_ids.push({ source_id: source.source_id, document_count: count, ingest_status: source.ingest_status });
    byClass.set(source.source_class, current);
  }
  return Array.from(byClass.values()).map((row) => {
    const threshold = thresholds[row.source_class] ?? { min_sources_with_documents: 1, min_documents: 1 };
    const requiredSources = Math.min(threshold.min_sources_with_documents, Math.max(0, row.source_count - row.blocked_source_count));
    const requiredDocs = row.source_count === row.blocked_source_count ? 0 : threshold.min_documents;
    const passes = row.sources_with_documents >= requiredSources && row.document_count >= requiredDocs;
    return {
      ...row,
      required_sources_with_documents: requiredSources,
      required_document_count: requiredDocs,
      status: passes ? "pass" : "fail",
      note: "Conservative regression gate for broad-enough local coverage by source class; not a claim of complete acquisition.",
    };
  }).sort((a, b) => a.source_class.localeCompare(b.source_class));
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
