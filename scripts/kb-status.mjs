import path from "node:path";
import {
  auditsDir,
  countBy,
  indexesDir,
  listFilesRecursive,
  loadRegistry,
  processedStagingAvailability,
  rawDir,
  relative,
  sourceFreshness,
  tableAvailability,
  textDir,
  validateRegistry,
  writeJson,
  writeText,
} from "./kb-lib.mjs";

const { registry, errors } = await validateRegistry();
const sources = registry.sources ?? [];
const tables = tableAvailability();
const stagingTables = processedStagingAvailability();
const freshness = sourceFreshness(sources);
const rawFiles = listFilesRecursive(rawDir).filter((file) => !file.endsWith(".gitkeep"));
const textFiles = listFilesRecursive(textDir).filter((file) => !file.endsWith(".gitkeep"));
const indexFiles = listFilesRecursive(indexesDir).filter((file) => !file.endsWith(".gitkeep"));

const status = {
  generated_at: new Date().toISOString(),
  status: errors.length ? "invalid" : statusLabel({ rawFiles, stagingTables }),
  source_count: sources.length,
  source_classes: countBy(sources, "source_class"),
  ingest_statuses: countBy(sources, "ingest_status"),
  redistribution_statuses: countBy(sources, "redistribution_status"),
  metadata_allowed_count: sources.filter((source) => source.metadata_allowed).length,
  full_text_allowed_count: sources.filter((source) => source.full_text_allowed).length,
  stale_source_count: freshness.filter((source) => source.stale).length,
  stale_sources: freshness.filter((source) => source.stale),
  tables: {
    expected_count: tables.length,
    existing_count: tables.filter((table) => table.exists).length,
    missing: tables.filter((table) => !table.exists).map((table) => table.file),
    available: tables.filter((table) => table.exists),
  },
  staging_tables: {
    expected_count: stagingTables.length,
    existing_count: stagingTables.filter((table) => table.exists).length,
    missing: stagingTables.filter((table) => !table.exists).map((table) => table.file),
    available: stagingTables.filter((table) => table.exists),
  },
  local_files: {
    raw_count: rawFiles.length,
    text_count: textFiles.length,
    index_count: indexFiles.length,
  },
  validation_errors: errors,
};

await writeJson(path.join(auditsDir, "kb-status.json"), status);
await writeText(path.join(auditsDir, "kb-status.md"), renderMarkdown(status));

console.log(`Local humanities KB: ${status.status}`);
console.log(`Sources: ${status.source_count}`);
console.log(`Rights coverage: ${Object.entries(status.redistribution_statuses).map(([key, value]) => `${key}=${value}`).join(", ")}`);
console.log(`Processed tables: ${status.tables.existing_count}/${status.tables.expected_count}`);
console.log(`Processed staging JSONL: ${status.staging_tables.existing_count}/${status.staging_tables.expected_count}`);
console.log(`Raw files: ${status.local_files.raw_count}; text files: ${status.local_files.text_count}; index files: ${status.local_files.index_count}`);
if (errors.length) {
  process.exitCode = 1;
}

function statusLabel({ rawFiles, stagingTables }) {
  const stagingReady = stagingTables.some((table) => table.exists);
  if (rawFiles.length && stagingReady) return "phase-2-staging-active";
  return "ready-for-phase-2-ingests";
}

function renderMarkdown(status) {
  return [
    "# Local Humanities Knowledge Base Status",
    "",
    `Generated at: ${status.generated_at}`,
    `Status: ${status.status}`,
    `Sources: ${status.source_count}`,
    "",
    "## Source Classes",
    "",
    table(status.source_classes),
    "",
    "## Ingest Statuses",
    "",
    table(status.ingest_statuses),
    "",
    "## Rights Coverage",
    "",
    table(status.redistribution_statuses),
    "",
    "## Local Data Availability",
    "",
    `- Processed tables: ${status.tables.existing_count}/${status.tables.expected_count}`,
    `- Processed staging JSONL: ${status.staging_tables.existing_count}/${status.staging_tables.expected_count}`,
    `- Raw files: ${status.local_files.raw_count}`,
    `- Text files: ${status.local_files.text_count}`,
    `- Index files: ${status.local_files.index_count}`,
    "",
    "## Missing Processed Tables",
    "",
    ...status.tables.missing.map((file) => `- ${file}`),
    "",
    "## Missing Staging Tables",
    "",
    status.staging_tables.missing.length ? status.staging_tables.missing.map((file) => `- ${file}`).join("\n") : "No missing staging tables.",
    "",
    "## Stale Sources",
    "",
    status.stale_sources.length ? status.stale_sources.map((source) => `- ${source.source_id}: last checked ${source.last_checked_at}`).join("\n") : "No stale sources.",
    "",
    "## Validation",
    "",
    status.validation_errors.length ? status.validation_errors.map((error) => `- ${error}`).join("\n") : "Validation passed.",
    "",
  ].join("\n");
}

function table(counts) {
  const rows = Object.entries(counts);
  if (!rows.length) return "No entries.";
  return ["| Value | Count |", "| --- | ---: |", ...rows.map(([key, value]) => `| ${key} | ${value} |`)].join("\n");
}
