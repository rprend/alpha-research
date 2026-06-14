import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  analyticalAvailability,
  auditsDir,
  processedDir,
  readJsonl,
  toCsv,
  writeJson,
  writeText,
} from "./kb-lib.mjs";

const tableSpecs = [
  {
    table: "works",
    jsonl: "works.jsonl",
    columns: ["local_id", "source_id", "source_native_id", "source_url", "title", "fetched_at", "type", "publication_year", "venue", "doi", "open_access", "publisher"],
  },
  {
    table: "objects",
    jsonl: "objects.jsonl",
    columns: ["local_id", "source_id", "source_native_id", "source_url", "title", "fetched_at", "type", "date", "creation_date", "department", "culture", "share_license_status", "rights"],
  },
  {
    table: "pages",
    jsonl: "pages.jsonl",
    columns: ["local_id", "source_id", "school", "department", "page_type", "source_url", "title", "fetched_at", "text_path", "text_chars", "status"],
  },
  {
    table: "departments",
    jsonl: "departments.jsonl",
    columns: ["local_id", "source_id", "school", "department", "homepage_url", "page_count", "first_seen_at", "last_seen_at"],
  },
  {
    table: "authors",
    jsonl: "authors.jsonl",
    columns: ["local_id", "source_id", "source_native_id", "source_url", "name", "fetched_at", "birth_year", "death_year", "institution", "occupation"],
    empty_ok: true,
  },
  {
    table: "institutions",
    jsonl: "institutions.jsonl",
    columns: ["local_id", "source_id", "source_native_id", "source_url", "name", "fetched_at", "type", "country", "region"],
    empty_ok: true,
  },
  {
    table: "venues",
    jsonl: "venues.jsonl",
    columns: ["local_id", "source_id", "source_native_id", "source_url", "name", "fetched_at", "type", "publisher", "issn", "issn_l"],
    empty_ok: true,
  },
  {
    table: "collections",
    jsonl: "collections.jsonl",
    columns: ["local_id", "source_id", "source_native_id", "source_url", "title", "fetched_at", "institution", "date_range", "rights"],
    empty_ok: true,
  },
  {
    table: "citations",
    jsonl: "citations.jsonl",
    columns: ["local_id", "source_id", "source_work_id", "cited_work_id", "source_url", "fetched_at", "citation_context", "confidence"],
    empty_ok: true,
  },
  {
    table: "topics",
    jsonl: "topics.jsonl",
    columns: ["local_id", "source_id", "source_native_id", "source_url", "label", "fetched_at", "vocabulary", "parent_label", "confidence"],
    empty_ok: true,
  },
  {
    table: "source_documents",
    jsonl: "source_documents.jsonl",
    columns: ["local_id", "source_id", "source_native_id", "source_url", "title", "fetched_at", "type", "publication_year", "venue", "doi", "open_access", "department", "description", "text_path", "text_chars"],
  },
  {
    table: "rights",
    jsonl: "rights.jsonl",
    columns: ["local_id", "source_id", "license", "redistribution_status", "full_text_allowed", "metadata_allowed", "rights_note", "quote_status"],
  },
];

const report = {
  generated_at: new Date().toISOString(),
  tables: [],
  sqlite: {
    path: "data/knowledge-base/processed/knowledge-base.sqlite",
    created: false,
    fts_created: false,
    fts_tables: ["source_documents_fts", "pages_fts"],
  },
  parquet: {
    created: false,
    writer: "scripts/kb-jsonl-to-parquet.py",
  },
};

for (const spec of tableSpecs) {
  const rows = await readJsonl(path.join(processedDir, spec.jsonl));
  const csvPath = path.join(processedDir, `${spec.table}.csv`);
  await writeText(csvPath, toCsv(rows, spec.columns));
  const parquetPath = path.join(processedDir, `${spec.table}.parquet`);
  writeParquet(spec, parquetPath);
  report.tables.push({
    table: spec.table,
    source: `data/knowledge-base/processed/${spec.jsonl}`,
    csv: `data/knowledge-base/processed/${spec.table}.csv`,
    parquet: `data/knowledge-base/processed/${spec.table}.parquet`,
    rows: rows.length,
    columns: spec.columns,
    empty_ok: spec.empty_ok === true,
  });
}
report.parquet.created = true;

const sqlitePath = path.join(processedDir, "knowledge-base.sqlite");
if (existsSync(sqlitePath)) {
  await fs.rm(sqlitePath);
}

const sql = buildSql(tableSpecs);
const result = spawnSync("sqlite3", [sqlitePath], {
  input: sql,
  encoding: "utf8",
});
if (result.status !== 0) {
  throw new Error(`sqlite3 failed: ${result.stderr || result.stdout}`);
}

report.sqlite.created = true;
report.sqlite.fts_created = true;
report.analytical_files = analyticalAvailability();

await writeJson(path.join(auditsDir, "analytical-tables.json"), report);
await writeText(path.join(auditsDir, "analytical-tables.md"), renderMarkdown(report));

console.log(`Built analytical CSV/Parquet tables and SQLite DB (${report.tables.map((table) => `${table.table}=${table.rows}`).join(", ")}).`);

function writeParquet(spec, parquetPath) {
  const result = spawnSync("python3", [
    path.join("scripts", "kb-jsonl-to-parquet.py"),
    "--input",
    path.join(processedDir, spec.jsonl),
    "--output",
    parquetPath,
    "--columns",
    spec.columns.join(","),
  ], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Parquet writer failed for ${spec.table}: ${result.stderr || result.stdout}`);
  }
}

function buildSql(specs) {
  const parts = [
    ".mode csv",
  ];
  for (const spec of specs) {
    const csvPath = path.join(processedDir, `${spec.table}.csv`);
    parts.push(`DROP TABLE IF EXISTS ${spec.table};`);
    parts.push(`CREATE TABLE ${spec.table} (${spec.columns.map((column) => `${column} TEXT`).join(", ")});`);
    parts.push(`.import --skip 1 ${JSON.stringify(csvPath)} ${spec.table}`);
  }
  parts.push("DROP TABLE IF EXISTS source_documents_fts;");
  parts.push("CREATE VIRTUAL TABLE source_documents_fts USING fts5(local_id UNINDEXED, source_id UNINDEXED, source_url UNINDEXED, title, type, publication_year, venue, doi, department, description, text_path UNINDEXED);");
  parts.push("INSERT INTO source_documents_fts(local_id, source_id, source_url, title, type, publication_year, venue, doi, department, description, text_path) SELECT local_id, source_id, source_url, title, type, publication_year, venue, doi, department, description, text_path FROM source_documents;");
  parts.push("DROP TABLE IF EXISTS pages_fts;");
  parts.push("CREATE VIRTUAL TABLE pages_fts USING fts5(local_id UNINDEXED, source_id UNINDEXED, source_url UNINDEXED, school, department, page_type, title, text_path UNINDEXED);");
  parts.push("INSERT INTO pages_fts(local_id, source_id, source_url, school, department, page_type, title, text_path) SELECT local_id, source_id, source_url, school, department, page_type, title, text_path FROM pages;");
  return `${parts.join("\n")}\n`;
}

function renderMarkdown(report) {
  return [
    "# KB Analytical Tables",
    "",
    `Generated at: ${report.generated_at}`,
    "",
    "| Table | Rows | CSV |",
    "| --- | ---: | --- |",
    ...report.tables.map((table) => `| ${table.table} | ${table.rows} | \`${table.csv}\` / \`${table.parquet}\` |`),
    "",
    "## SQLite",
    "",
    `- Path: \`${report.sqlite.path}\``,
    `- Created: ${report.sqlite.created}`,
    `- FTS created: ${report.sqlite.fts_created}`,
    `- FTS tables: ${report.sqlite.fts_tables.join(", ")}`,
    "",
    "## Parquet",
    "",
    `- Created: ${report.parquet.created}`,
    `- Writer: \`${report.parquet.writer}\``,
    "- Empty entity/relation tables are schema-valid placeholders until dedicated author, institution, venue, collection, citation, and topic ingests populate them.",
    "",
  ].join("\n");
}
