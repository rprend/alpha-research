import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  analyticalAvailability,
  auditsDir,
  listFilesRecursive,
  processedDir,
  readJsonl,
  rawDir,
  slug,
  toCsv,
  writeJson,
  writeJsonl,
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
    columns: ["local_id", "source_id", "source_native_id", "source_url", "title", "fetched_at", "type", "date", "creation_date", "department", "culture", "classification", "medium", "artist", "accession_number", "accession_year", "share_license_status", "rights", "image_url", "description"],
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
    columns: ["local_id", "source_id", "source_native_id", "source_url", "title", "fetched_at", "type", "publication_year", "venue", "doi", "open_access", "department", "culture", "classification", "medium", "artist", "accession_number", "accession_year", "description", "text_path", "text_chars"],
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
    fts_text_rows: {},
  },
  parquet: {
    created: false,
    writer: "scripts/kb-jsonl-to-parquet.py",
  },
};

await deriveEntityTables();

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

const ftsInputs = await writeFtsInputs();
report.sqlite.fts_text_rows = Object.fromEntries(ftsInputs.map((input) => [input.table, input.rows_with_text_content]));

const sqlitePath = path.join(processedDir, "knowledge-base.sqlite");
if (existsSync(sqlitePath)) {
  await fs.rm(sqlitePath);
}

const sql = buildSql(tableSpecs, ftsInputs);
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

async function deriveEntityTables() {
  const [works, objects, pages, sourceDocuments] = await Promise.all([
    readJsonl(path.join(processedDir, "works.jsonl")),
    readJsonl(path.join(processedDir, "objects.jsonl")),
    readJsonl(path.join(processedDir, "pages.jsonl")),
    readJsonl(path.join(processedDir, "source_documents.jsonl")),
  ]);
  const { authors, citations } = await deriveAuthorsAndCitationsFromRaw();
  await writeJsonl(path.join(processedDir, "authors.jsonl"), authors);
  await writeJsonl(path.join(processedDir, "venues.jsonl"), deriveVenues([...works, ...sourceDocuments]));
  await writeJsonl(path.join(processedDir, "institutions.jsonl"), deriveInstitutions({ pages, objects }));
  await writeJsonl(path.join(processedDir, "collections.jsonl"), deriveCollections(objects));
  await writeJsonl(path.join(processedDir, "citations.jsonl"), citations);
  await writeJsonl(path.join(processedDir, "topics.jsonl"), deriveTopics(objects));
}

async function deriveAuthorsAndCitationsFromRaw() {
  const authors = new Map();
  const citations = new Map();
  const files = listFilesRecursive(rawDir).filter((file) =>
    file.endsWith(".json") && (file.includes(`${path.sep}openalex-humanities${path.sep}`) || file.includes(`${path.sep}crossref-humanities${path.sep}`))
  );
  for (const file of files) {
    if (file.endsWith(`${path.sep}manifest.json`)) continue;
    let payload;
    try {
      payload = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      continue;
    }
    if (file.includes(`${path.sep}openalex-humanities${path.sep}`)) {
      for (const row of payload.results ?? []) {
        const sourceWorkId = `openalex-humanities:${slugish(row.id)}`;
        for (const authorship of row.authorships ?? []) {
          const author = authorship.author ?? {};
          const name = cleanLabel(author.display_name || authorship.raw_author_name);
          if (!name) continue;
          const nativeId = author.id || authorship.raw_author_name || name;
          authors.set(`openalex-humanities:${slugish(nativeId)}`, {
            local_id: `openalex-humanities:author:${slugish(nativeId)}`,
            source_id: "openalex-humanities",
            source_native_id: nativeId,
            source_url: author.id || row.id || "",
            name,
            fetched_at: row.updated_date || row.publication_date || "",
            birth_year: "",
            death_year: "",
            institution: cleanLabel(authorship.institutions?.[0]?.display_name),
            occupation: "",
          });
        }
        for (const citedWorkId of row.referenced_works ?? []) {
          const cited = cleanLabel(citedWorkId);
          if (!cited) continue;
          citations.set(`${sourceWorkId}:cites:${slugish(cited)}`, {
            local_id: `${sourceWorkId}:cites:${slugish(cited)}`,
            source_id: "openalex-humanities",
            source_work_id: sourceWorkId,
            cited_work_id: cited,
            source_url: row.id || "",
            fetched_at: row.updated_date || row.publication_date || "",
            citation_context: "",
            confidence: "source-provided",
          });
        }
      }
    }
    if (file.includes(`${path.sep}crossref-humanities${path.sep}`)) {
      for (const row of payload.message?.items ?? []) {
        const doi = cleanLabel(row.DOI);
        const sourceWorkId = doi ? `crossref-humanities:${slugish(doi)}` : "";
        for (const author of row.author ?? []) {
          const name = cleanLabel([author.given, author.family].filter(Boolean).join(" ") || author.name);
          if (!name) continue;
          const nativeId = `${name}:${author.ORCID || ""}`;
          authors.set(`crossref-humanities:${slugish(nativeId)}`, {
            local_id: `crossref-humanities:author:${slugish(nativeId)}`,
            source_id: "crossref-humanities",
            source_native_id: author.ORCID || name,
            source_url: author.ORCID || (doi ? `https://doi.org/${doi}` : ""),
            name,
            fetched_at: crossrefDate(row.indexed) || crossrefDate(row.deposited) || "",
            birth_year: "",
            death_year: "",
            institution: cleanLabel(author.affiliation?.[0]?.name),
            occupation: cleanLabel(author.role?.[0]?.role),
          });
        }
        for (const reference of row.reference ?? []) {
          const cited = cleanLabel(reference.DOI || reference.doi || reference["article-title"] || reference.key);
          if (!sourceWorkId || !cited) continue;
          citations.set(`${sourceWorkId}:cites:${slugish(cited)}`, {
            local_id: `${sourceWorkId}:cites:${slugish(cited)}`,
            source_id: "crossref-humanities",
            source_work_id: sourceWorkId,
            cited_work_id: cited,
            source_url: doi ? `https://doi.org/${doi}` : "",
            fetched_at: crossrefDate(row.indexed) || crossrefDate(row.deposited) || "",
            citation_context: "",
            confidence: "source-provided",
          });
        }
      }
    }
  }
  return {
    authors: sortRows(authors.values(), "name"),
    citations: sortRows(citations.values(), "source_work_id"),
  };
}

function deriveVenues(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const name = cleanLabel(row.venue);
    if (!name) continue;
    const key = `${row.source_id}:${name.toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing || String(row.fetched_at || "") > String(existing.fetched_at || "")) {
      byKey.set(key, {
        local_id: `${row.source_id}:venue:${slug(name)}`,
        source_id: row.source_id,
        source_native_id: name,
        source_url: row.source_url || "",
        name,
        fetched_at: row.fetched_at || "",
        type: row.type === "article" ? "journal-or-periodical" : row.type === "scholarly-work" ? "scholarly-venue" : "source-venue",
        publisher: row.publisher || "",
        issn: row.issn || "",
        issn_l: row.issn_l || "",
      });
    }
  }
  return sortRows(byKey.values(), "name");
}

function deriveInstitutions({ pages, objects }) {
  const byKey = new Map();
  for (const page of pages) {
    const name = cleanLabel(page.school);
    if (!name) continue;
    byKey.set(`school:${name.toLowerCase()}`, {
      local_id: `${page.source_id}:institution:${slug(name)}`,
      source_id: page.source_id,
      source_native_id: name,
      source_url: page.source_url || "",
      name,
      fetched_at: page.fetched_at || "",
      type: "university",
      country: "",
      region: "",
    });
  }
  for (const object of objects) {
    const name = institutionNameForSource(object.source_id);
    if (!name) continue;
    const key = `collection-holder:${object.source_id}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        local_id: `${object.source_id}:institution:${slug(name)}`,
        source_id: object.source_id,
        source_native_id: object.source_id,
        source_url: object.source_url || "",
        name,
        fetched_at: object.fetched_at || "",
        type: object.source_id === "library-of-congress" ? "library/archive" : "museum",
        country: "United States",
        region: "",
      });
    }
  }
  return sortRows(byKey.values(), "name");
}

function deriveCollections(objects) {
  const byKey = new Map();
  for (const object of objects) {
    const title = cleanLabel(object.department || object.type);
    if (!title) continue;
    const key = `${object.source_id}:${title.toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing || String(object.fetched_at || "") > String(existing.fetched_at || "")) {
      byKey.set(key, {
        local_id: `${object.source_id}:collection:${slug(title)}`,
        source_id: object.source_id,
        source_native_id: title,
        source_url: object.source_url || "",
        title,
        fetched_at: object.fetched_at || "",
        institution: institutionNameForSource(object.source_id),
        date_range: "",
        rights: object.rights || object.share_license_status || "",
      });
    }
  }
  return sortRows(byKey.values(), "title");
}

function deriveTopics(objects) {
  const byKey = new Map();
  for (const object of objects) {
    for (const subject of Array.isArray(object.subjects) ? object.subjects : []) {
      const label = cleanLabel(subject);
      if (!label) continue;
      const key = `${object.source_id}:${label.toLowerCase()}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          local_id: `${object.source_id}:topic:${slug(label)}`,
          source_id: object.source_id,
          source_native_id: label,
          source_url: object.source_url || "",
          label,
          fetched_at: object.fetched_at || "",
          vocabulary: "source-subject",
          parent_label: "",
          confidence: "source-provided",
        });
      }
    }
  }
  return sortRows(byKey.values(), "label");
}

function institutionNameForSource(sourceId) {
  return {
    "met-collection-api": "Metropolitan Museum of Art",
    "cleveland-museum-open-access": "Cleveland Museum of Art",
    "library-of-congress": "Library of Congress",
  }[sourceId] || "";
}

function cleanLabel(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function crossrefDate(value) {
  return value?.["date-time"] || value?.["date-parts"]?.[0]?.filter(Boolean).join("-") || "";
}

function slugish(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 140);
}

function sortRows(rows, field) {
  return [...rows].sort((a, b) => String(a[field]).localeCompare(String(b[field])) || String(a.source_id).localeCompare(String(b.source_id)));
}

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

async function writeFtsInputs() {
  const sourceColumns = ["local_id", "source_id", "source_url", "title", "type", "publication_year", "venue", "doi", "department", "culture", "classification", "medium", "artist", "accession_number", "accession_year", "description", "text_path", "text_content"];
  const pageColumns = ["local_id", "source_id", "source_url", "school", "department", "page_type", "title", "text_path", "text_content"];
  const sourceRows = await enrichRowsWithText(await readJsonl(path.join(processedDir, "source_documents.jsonl")));
  const pageRows = await enrichRowsWithText(await readJsonl(path.join(processedDir, "pages.jsonl")));
  const sourcePath = path.join(processedDir, "source_documents_fts_input.csv");
  const pagesPath = path.join(processedDir, "pages_fts_input.csv");
  await writeText(sourcePath, toCsv(sourceRows, sourceColumns));
  await writeText(pagesPath, toCsv(pageRows, pageColumns));
  return [
    {
      table: "source_documents_fts",
      path: sourcePath,
      columns: sourceColumns,
      rows: sourceRows.length,
      rows_with_text_content: sourceRows.filter((row) => row.text_content).length,
    },
    {
      table: "pages_fts",
      path: pagesPath,
      columns: pageColumns,
      rows: pageRows.length,
      rows_with_text_content: pageRows.filter((row) => row.text_content).length,
    },
  ];
}

async function enrichRowsWithText(rows) {
  const enriched = [];
  for (const row of rows) {
    enriched.push({
      ...row,
      text_content: await readLocalText(row.text_path),
    });
  }
  return enriched;
}

async function readLocalText(textPath) {
  if (!textPath) return "";
  const absolute = path.isAbsolute(textPath) ? textPath : path.join(process.cwd(), textPath);
  if (!existsSync(absolute)) return "";
  return fs.readFile(absolute, "utf8");
}

function buildSql(specs, ftsInputs) {
  const parts = [
    ".mode csv",
  ];
  for (const spec of specs) {
    const csvPath = path.join(processedDir, `${spec.table}.csv`);
    parts.push(`DROP TABLE IF EXISTS ${spec.table};`);
    parts.push(`CREATE TABLE ${spec.table} (${spec.columns.map((column) => `${column} TEXT`).join(", ")});`);
    parts.push(`.import --skip 1 ${JSON.stringify(csvPath)} ${spec.table}`);
  }
  const sourceFts = ftsInputs.find((input) => input.table === "source_documents_fts");
  const pagesFts = ftsInputs.find((input) => input.table === "pages_fts");
  parts.push("DROP TABLE IF EXISTS source_documents_fts;");
  parts.push("CREATE VIRTUAL TABLE source_documents_fts USING fts5(local_id UNINDEXED, source_id UNINDEXED, source_url UNINDEXED, title, type, publication_year, venue, doi, department, culture, classification, medium, artist, accession_number, accession_year, description, text_path UNINDEXED, text_content);");
  parts.push(`.import --skip 1 ${JSON.stringify(sourceFts.path)} source_documents_fts`);
  parts.push("DROP TABLE IF EXISTS pages_fts;");
  parts.push("CREATE VIRTUAL TABLE pages_fts USING fts5(local_id UNINDEXED, source_id UNINDEXED, source_url UNINDEXED, school, department, page_type, title, text_path UNINDEXED, text_content);");
  parts.push(`.import --skip 1 ${JSON.stringify(pagesFts.path)} pages_fts`);
  return `${parts.join("\n")}\n`;
}

function renderMarkdown(report) {
  const emptyTables = report.tables.filter((table) => table.rows === 0).map((table) => table.table);
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
    `- FTS rows with local text content: ${Object.entries(report.sqlite.fts_text_rows).map(([table, count]) => `${table}=${count}`).join(", ")}`,
    "",
    "## Parquet",
    "",
    `- Created: ${report.parquet.created}`,
    `- Writer: \`${report.parquet.writer}\``,
    emptyTables.length
      ? `- Empty schema-valid tables pending dedicated ingests: ${emptyTables.join(", ")}.`
      : "- No empty analytical tables.",
    "",
  ].join("\n");
}
