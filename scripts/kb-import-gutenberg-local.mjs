import fs from "node:fs/promises";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  auditsDir,
  processedDir,
  readJsonl,
  rootDir,
  textDir,
  writeJson,
  writeJsonl,
  writeText,
} from "./kb-lib.mjs";

const limit = Number.parseInt(getArg("--limit") ?? "20", 10);
const maxBytes = Number.parseInt(getArg("--max-bytes") ?? "250000", 10);
const cleanDir = path.join(rootDir, "docs", "experiments", "gutenberg-semantic-benchmark", ".local", "clean");
const catalogPath = path.join(rootDir, "docs", "experiments", "gutenberg-semantic-benchmark", ".local", "catalog", "pg_catalog.csv");

if (!existsSync(cleanDir)) {
  throw new Error(`Missing local Gutenberg clean text directory: ${cleanDir}`);
}
if (!existsSync(catalogPath)) {
  throw new Error(`Missing local Gutenberg catalog: ${catalogPath}`);
}

const catalog = new Map(parseCsv(await fs.readFile(catalogPath, "utf8")).map((record) => [record["Text#"], record]));
const candidates = readdirSync(cleanDir)
  .filter((file) => /^pg-\d+\.txt$/.test(file))
  .map((file) => ({ file, path: path.join(cleanDir, file), bytes: statSync(path.join(cleanDir, file)).size, id: file.match(/\d+/)?.[0] ?? "" }))
  .filter((entry) => entry.bytes <= maxBytes)
  .sort((a, b) => a.bytes - b.bytes)
  .slice(0, limit);

const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const works = await readJsonl(path.join(processedDir, "works.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));
const imported = [];

for (const candidate of candidates) {
  const record = catalog.get(candidate.id) ?? {};
  const localId = `project-gutenberg:pg-${candidate.id}`;
  const text = await fs.readFile(candidate.path, "utf8");
  const outPath = path.join(textDir, "public-domain-books", `pg-${candidate.id}.txt`);
  await writeText(outPath, text.endsWith("\n") ? text : `${text}\n`);
  const title = record.Title || `Project Gutenberg ${candidate.id}`;
  const author = record.Authors || "";
  const row = {
    local_id: localId,
    source_id: "project-gutenberg",
    source_native_id: candidate.id,
    source_url: `https://www.gutenberg.org/ebooks/${candidate.id}`,
    title,
    fetched_at: new Date().toISOString(),
    type: "public-domain-book",
    publication_year: "",
    venue: "Project Gutenberg",
    doi: "",
    open_access: true,
    publisher: "Project Gutenberg",
    author,
    language: record.Language || "",
    subjects: record.Subjects || "",
    bookshelves: record.Bookshelves || "",
    text_path: path.relative(rootDir, outPath),
    text_chars: text.length,
  };
  imported.push(row);
  sourceDocuments.push(row);
  works.push(row);
  rights.push({
    local_id: localId,
    source_id: "project-gutenberg",
    license: "Public domain in the United States for included texts; Gutenberg trademark/license notes apply",
    redistribution_status: "public-domain-text-ok",
    full_text_allowed: true,
    metadata_allowed: true,
    quote_status: "quote-public-domain",
    rights_note: "Public-domain text copied from the existing local Gutenberg corpus into the KB text corpus.",
  });
}

await writeJsonl(path.join(processedDir, "source_documents.jsonl"), dedupe(sourceDocuments, "local_id"));
await writeJsonl(path.join(processedDir, "works.jsonl"), dedupe(works, "local_id"));
await writeJsonl(path.join(processedDir, "rights.jsonl"), dedupe(rights, "local_id"));
await writeJson(path.join(auditsDir, "gutenberg-local-import.json"), {
  generated_at: new Date().toISOString(),
  source: "docs/experiments/gutenberg-semantic-benchmark/.local",
  limit,
  max_bytes: maxBytes,
  imported_count: imported.length,
  imported,
});

console.log(`Imported ${imported.length} local Project Gutenberg texts into the KB text corpus.`);

function getArg(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

function dedupe(rows, key) {
  const byKey = new Map();
  for (const row of rows) byKey.set(row[key], row);
  return Array.from(byKey.values());
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows.map((values) => Object.fromEntries(header.map((name, index) => [name, values[index] ?? ""])));
}
