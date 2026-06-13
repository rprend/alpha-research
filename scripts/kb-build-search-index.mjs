import fs from "node:fs/promises";
import path from "node:path";
import {
  indexesDir,
  processedDir,
  readJsonl,
  writeJson,
} from "./kb-lib.mjs";

const sourceDocumentsPath = path.join(processedDir, "source_documents.jsonl");
const stopwords = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "this",
  "that",
  "are",
  "was",
  "were",
  "has",
  "have",
  "not",
  "digital",
]);

const rows = await readJsonl(sourceDocumentsPath);
const pages = await readJsonl(path.join(processedDir, "pages.jsonl"));
const documents = rows.map((row, index) => ({
  doc_id: row.local_id || `doc-${index}`,
  source_id: row.source_id || "",
  title: row.title || "",
  source_url: row.source_url || "",
  type: row.type || "",
  text: [row.title, row.type, row.venue, row.department, row.description, row.subjects?.join?.(" ")]
    .filter(Boolean)
    .join(" "),
})).concat(pages.map((row, index) => ({
  doc_id: row.local_id || `page-${index}`,
  source_id: row.source_id || "",
  title: row.title || "",
  source_url: row.source_url || "",
  type: row.page_type || "department-page",
  text: [row.school, row.department, row.page_type, row.title].filter(Boolean).join(" "),
})));

const postings = new Map();
for (const doc of documents) {
  for (const term of new Set(tokenize(doc.text))) {
    const entries = postings.get(term) ?? [];
    entries.push(doc.doc_id);
    postings.set(term, entries);
  }
}

const index = {
  generated_at: new Date().toISOString(),
  source: "data/knowledge-base/processed/source_documents.jsonl",
  document_count: documents.length,
  term_count: postings.size,
  documents: Object.fromEntries(documents.map((doc) => [doc.doc_id, {
    source_id: doc.source_id,
    title: doc.title,
    source_url: doc.source_url,
    type: doc.type,
  }])),
  postings: Object.fromEntries(Array.from(postings.entries()).sort(([a], [b]) => a.localeCompare(b))),
};

await writeJson(path.join(indexesDir, "source-documents-keyword-index.json"), index);
console.log(`Built KB keyword index: ${documents.length} documents, ${postings.size} terms.`);

function tokenize(value) {
  return String(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !stopwords.has(term));
}
