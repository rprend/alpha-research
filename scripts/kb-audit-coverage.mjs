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
const rightsById = new Map(rights.map((row) => [row.local_id, row]));
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
coverage.source_class_completeness = sourceClassCompleteness(sources, sourceDocuments, rightsById);

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
    "## Source-Class Completeness Gates",
    "",
    ...coverage.source_class_completeness.map((row) => `- ${row.source_class}: ${row.status} (rights ${pct(row.rights_coverage_rate)}, fetched ${pct(row.fetch_date_rate)}, content-date ${pct(row.content_date_rate)}; threshold ${pct(row.required_content_date_rate)})`),
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

function sourceClassCompleteness(sources, sourceDocuments, rightsById) {
  const sourceClassById = new Map(sources.map((source) => [source.source_id, source.source_class]));
  const thresholds = {
    "scholarly-metadata": { min_content_date_rate: 0.9 },
    "linked-open-data": { min_content_date_rate: 0.6 },
    "public-domain-texts": { min_content_date_rate: 0 },
    "open-text-metadata": { min_content_date_rate: 0.5 },
    "cultural-collections": { min_content_date_rate: 0.5 },
    "university-department-web": { min_content_date_rate: 0 },
    "conference-programs": { min_content_date_rate: 0.7 },
    "journals-and-reviews": { min_content_date_rate: 0.8 },
    "humanities-adjacent-policy-history": { min_content_date_rate: 0.9 },
    "web-archives": { min_content_date_rate: 1 },
    "experiment-derived": { min_content_date_rate: 0.5 },
  };
  const byClass = new Map();
  for (const row of sourceDocuments) {
    const sourceClass = sourceClassById.get(row.source_id);
    if (!sourceClass) continue;
    const current = byClass.get(sourceClass) ?? {
      source_class: sourceClass,
      document_count: 0,
      rights_rows: 0,
      metadata_allowed_rows: 0,
      quote_status_rows: 0,
      fetch_date_rows: 0,
      content_date_rows: 0,
    };
    const rights = rightsById.get(row.local_id);
    current.document_count += 1;
    if (rights) current.rights_rows += 1;
    if (rights?.metadata_allowed === true || rights?.metadata_allowed === "true") current.metadata_allowed_rows += 1;
    if (rights?.quote_status) current.quote_status_rows += 1;
    if (row.fetched_at) current.fetch_date_rows += 1;
    if (hasContentDate(row)) current.content_date_rows += 1;
    byClass.set(sourceClass, current);
  }
  return Array.from(byClass.values()).map((row) => {
    const threshold = thresholds[row.source_class] ?? { min_content_date_rate: 0 };
    const rates = {
      rights_coverage_rate: rate(row.rights_rows, row.document_count),
      metadata_allowed_rate: rate(row.metadata_allowed_rows, row.document_count),
      quote_status_rate: rate(row.quote_status_rows, row.document_count),
      fetch_date_rate: rate(row.fetch_date_rows, row.document_count),
      content_date_rate: rate(row.content_date_rows, row.document_count),
      required_content_date_rate: threshold.min_content_date_rate,
    };
    const passes = rates.rights_coverage_rate >= 1 &&
      rates.metadata_allowed_rate >= 0.95 &&
      rates.quote_status_rate >= 0.95 &&
      rates.fetch_date_rate >= 1 &&
      rates.content_date_rate >= threshold.min_content_date_rate;
    return {
      ...row,
      ...rates,
      status: passes ? "pass" : "fail",
      note: "Completeness regression gate for provenance dates and rights fields by source class; content-date thresholds are class-specific.",
    };
  }).sort((a, b) => a.source_class.localeCompare(b.source_class));
}

function hasContentDate(row) {
  return Boolean(
    row.publication_year ||
    row.date ||
    row.accession_year ||
    row.object_date ||
    row.snapshot_year ||
    /\b(?:18|19|20)\d{2}\b/.test(String(row.title ?? ""))
  );
}

function rate(numerator, denominator) {
  if (!denominator) return 1;
  return Number((numerator / denominator).toFixed(4));
}

function pct(value) {
  return `${Math.round(Number(value) * 100)}%`;
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
