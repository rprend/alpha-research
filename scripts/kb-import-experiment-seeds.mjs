import path from "node:path";
import {
  auditsDir,
  processedDir,
  readJson,
  readJsonl,
  rootDir,
  writeJson,
  writeJsonl,
} from "./kb-lib.mjs";

const now = new Date().toISOString();
const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const works = await readJsonl(path.join(processedDir, "works.jsonl"));
const objects = await readJsonl(path.join(processedDir, "objects.jsonl"));
const pages = await readJsonl(path.join(processedDir, "pages.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));

const imported = {
  generated_at: now,
  sources: [],
};

await importUniversityPages();
await importMuseumPages();
await importLiteratureRadarWorks();
await importCanonWorks();

await writeJsonl(path.join(processedDir, "source_documents.jsonl"), dedupe(sourceDocuments, "local_id"));
await writeJsonl(path.join(processedDir, "works.jsonl"), dedupe(works, "local_id"));
await writeJsonl(path.join(processedDir, "objects.jsonl"), dedupe(objects, "local_id"));
await writeJsonl(path.join(processedDir, "pages.jsonl"), dedupe(pages, "local_id"));
await writeJsonl(path.join(processedDir, "rights.jsonl"), dedupe(rights, "local_id"));
await writeJson(path.join(auditsDir, "experiment-seed-import.json"), imported);

console.log(`Imported experiment seeds from ${imported.sources.length} experiment datasets.`);

async function importUniversityPages() {
  const file = "docs/experiments/university-mission-statement-drift/data/processed/second-layer-pages.json";
  const rows = await readJson(path.join(rootDir, file));
  const importedRows = rows.map((row, index) => {
    const sourceId = mapUniversitySource(row.institution);
    return {
      local_id: `${sourceId}:experiment-university-${slug(`${row.institution}-${row.source_genre}-${row.year}-${index}`)}`,
      source_id: sourceId,
      school: row.institution ?? "",
      department: row.source_genre ?? "institutional-page",
      page_type: row.source_genre ?? "institutional-page",
      source_url: row.url ?? row.archive_url ?? "",
      title: row.title ?? "",
      fetched_at: now,
      text_path: "",
      text_chars: Number(row.words ?? 0),
      status: String(row.status ?? ""),
      type: "experiment-university-page",
      description: row.text_preview ?? "",
      source_experiment: file,
    };
  });
  pages.push(...importedRows.map(stripPageFields));
  sourceDocuments.push(...importedRows);
  rights.push(...importedRows.map((row) => localAnalysisRights(row, "University page text preview imported from existing experiment output.")));
  imported.sources.push({ source: file, rows: importedRows.length });
}

async function importMuseumPages() {
  const file = "docs/experiments/museum-language-drift/data/processed/second-layer-pages.json";
  const rows = await readJson(path.join(rootDir, file));
  const importedRows = rows.map((row, index) => ({
    local_id: `museum-language-drift:experiment-museum-${slug(`${row.museum}-${row.page_type}-${row.year}-${index}`)}`,
    source_id: "museum-language-drift",
    source_native_id: row.url ?? row.archive_url ?? "",
    source_url: row.url ?? row.archive_url ?? "",
    title: row.title ?? "",
    fetched_at: now,
    type: "experiment-museum-page",
    publication_year: row.year ?? "",
    venue: row.museum ?? "",
    department: row.page_type ?? "",
    description: row.text_preview ?? "",
    source_experiment: file,
  }));
  sourceDocuments.push(...importedRows);
  objects.push(...importedRows.map((row) => ({
    ...row,
    type: "museum-institution-page",
  })));
  rights.push(...importedRows.map((row) => localAnalysisRights(row, "Museum page text preview imported from existing experiment output.")));
  imported.sources.push({ source: file, rows: importedRows.length });
}

async function importLiteratureRadarWorks() {
  const file = "docs/experiments/humanities-literature-radar/data/processed/works.json";
  const rows = (await readJson(path.join(rootDir, file))).slice(0, 500);
  const importedRows = rows.map((row) => ({
    local_id: `humanities-literature-radar:${slug(row.source_record_id ?? row.title ?? row.url)}`,
    source_id: mapLiteratureSource(row.source_name),
    source_native_id: row.source_record_id ?? "",
    source_url: row.url ?? row.source_url ?? "",
    title: row.title ?? "",
    fetched_at: now,
    type: "literature-radar-work",
    publication_year: row.year ?? row.publication_year ?? "",
    venue: row.venue ?? row.source_name ?? "",
    doi: row.doi ?? "",
    description: row.abstract ?? "",
    source_experiment: file,
  }));
  sourceDocuments.push(...importedRows);
  works.push(...importedRows);
  rights.push(...importedRows.map((row) => metadataRights(row, "Literature radar metadata imported from existing experiment output.")));
  imported.sources.push({ source: file, rows: importedRows.length, capped: true });
}

async function importCanonWorks() {
  const file = "docs/experiments/canon-drift-feasibility/data/processed/canon-openalex-sample-works.json";
  const rows = await readJson(path.join(rootDir, file));
  const importedRows = rows.map((row, index) => ({
    local_id: `canon-drift-feasibility:${slug(`${row.author}-${row.title}-${row.year}-${index}`)}`,
    source_id: "openalex-humanities",
    source_native_id: row.doi ?? row.url ?? "",
    source_url: row.url ?? "",
    title: row.title ?? "",
    fetched_at: now,
    type: "canon-drift-sample-work",
    publication_year: row.year ?? "",
    venue: row.venue ?? "",
    doi: row.doi ?? "",
    description: row.relevance_note ?? "",
    author: row.author ?? "",
    source_experiment: file,
  }));
  sourceDocuments.push(...importedRows);
  works.push(...importedRows);
  rights.push(...importedRows.map((row) => metadataRights(row, "Canon drift OpenAlex sample metadata imported from existing experiment output.")));
  imported.sources.push({ source: file, rows: importedRows.length });
}

function stripPageFields(row) {
  return {
    local_id: row.local_id,
    source_id: row.source_id,
    school: row.school,
    department: row.department,
    page_type: row.page_type,
    source_url: row.source_url,
    title: row.title,
    fetched_at: row.fetched_at,
    text_path: row.text_path,
    text_chars: row.text_chars,
    status: row.status,
  };
}

function metadataRights(row, note) {
  return {
    local_id: row.local_id,
    source_id: row.source_id,
    license: "Inherited from source experiment and source registry.",
    redistribution_status: "metadata-ok",
    full_text_allowed: false,
    metadata_allowed: true,
    quote_status: "metadata-only-no-quotes",
    rights_note: note,
  };
}

function localAnalysisRights(row, note) {
  return {
    local_id: row.local_id,
    source_id: row.source_id,
    license: "Public web page text; copyright retained by source institution.",
    redistribution_status: "local-analysis-only",
    full_text_allowed: false,
    metadata_allowed: true,
    quote_status: "needs-review",
    rights_note: note,
  };
}

function mapUniversitySource(institution = "") {
  const value = institution.toLowerCase();
  if (value.includes("harvard")) return "harvard-humanities-departments";
  if (value.includes("yale")) return "yale-humanities-departments";
  if (value.includes("princeton")) return "princeton-humanities-departments";
  if (value.includes("stanford")) return "stanford-humanities-departments";
  if (value.includes("chicago")) return "uchicago-humanities-departments";
  if (value.includes("columbia")) return "columbia-humanities-departments";
  return "humanities-centers-public-pages";
}

function mapLiteratureSource(source = "") {
  const value = source.toLowerCase();
  if (value.includes("doaj")) return "doaj-humanities";
  if (value.includes("crossref")) return "crossref-humanities";
  if (value.includes("openalex")) return "openalex-humanities";
  if (value.includes("hcommons")) return "humanities-literature-radar";
  if (value.includes("arxiv")) return "humanities-literature-radar";
  return "humanities-literature-radar";
}

function dedupe(rows, key) {
  const byKey = new Map();
  for (const row of rows) byKey.set(row[key], row);
  return Array.from(byKey.values());
}

function slug(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 140);
}
