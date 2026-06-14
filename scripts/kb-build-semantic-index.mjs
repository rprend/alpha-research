import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  auditsDir,
  indexesDir,
  processedDir,
  readJsonl,
  rootDir,
  writeJson,
  writeText,
} from "./kb-lib.mjs";

const dimensions = Number.parseInt(getArg("--dimensions") ?? "2048", 10);
const maxTextChars = Number.parseInt(getArg("--max-text-chars") ?? "20000", 10);
const stopwords = new Set([
  "the", "and", "for", "that", "this", "with", "from", "are", "was", "were", "has", "have", "had", "not", "but",
  "you", "your", "their", "they", "our", "can", "all", "any", "into", "over", "under", "between", "about", "more",
  "than", "which", "what", "when", "where", "who", "how", "why", "will", "would", "could", "should", "may", "might",
]);
const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const rightsRows = await readJsonl(path.join(processedDir, "rights.jsonl"));
const rightsById = new Map(rightsRows.map((row) => [row.local_id, row]));

const docs = [];
const documentFrequency = new Map();
for (const row of sourceDocuments) {
  const rights = rightsById.get(row.local_id) ?? {};
  if (!isRetrievable(row, rights)) continue;
  const text = await documentText(row, rights);
  const tokens = tokenize(text);
  if (!tokens.length) continue;
  const seen = new Set(tokens);
  for (const token of seen) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  docs.push({ row, rights, text_scope: textScope(row, rights), tokens });
}

const index = {
  version: 1,
  generated_at: new Date().toISOString(),
  kind: "local-hashed-tfidf",
  dimensions,
  document_count: docs.length,
  source_counts: countBy(docs.map((doc) => doc.row), "source_id"),
  rights_scope_counts: countBy(docs, "text_scope"),
  documents: docs.map((doc) => {
    const vector = vectorize(doc.tokens, documentFrequency, docs.length);
    const term_hashes = [...new Set(doc.tokens.map((token) => hashToken(token)))].sort((a, b) => a - b);
    return {
      local_id: doc.row.local_id,
      source_id: doc.row.source_id,
      source_url: doc.row.source_url ?? "",
      title: doc.row.title ?? "",
      type: doc.row.type ?? "",
      publication_year: doc.row.publication_year ?? "",
      venue: doc.row.venue ?? "",
      department: doc.row.department ?? "",
      text_path: doc.row.text_path ?? "",
      text_scope: doc.text_scope,
      redistribution_status: doc.rights.redistribution_status ?? "",
      quote_status: doc.rights.quote_status ?? "",
      token_count: doc.tokens.length,
      term_hashes,
      vector,
    };
  }),
};

await writeJson(path.join(indexesDir, "semantic-hash-index.json"), index);
await writeText(path.join(auditsDir, "semantic-index.md"), renderMarkdown(index));
console.log(`Built KB semantic hash index: ${index.document_count} documents, ${dimensions} dimensions.`);

function getArg(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

function isRetrievable(row, rights) {
  if (rights.metadata_allowed === false && rights.full_text_allowed !== true) return false;
  return Boolean(row.title || row.description || row.text_path);
}

async function documentText(row, rights) {
  const parts = [
    row.title,
    row.type,
    row.publication_year,
    row.venue,
    row.department,
    row.culture,
    row.classification,
    row.medium,
    row.artist,
    row.accession_number,
    row.accession_year,
    row.description,
  ].filter(Boolean);
  const localText = await readAllowedLocalText(row, rights);
  if (localText) parts.push(localText.slice(0, maxTextChars));
  return parts.join("\n");
}

async function readAllowedLocalText(row, rights) {
  if (!row.text_path) return "";
  const status = rights.redistribution_status ?? "";
  const locallyAllowed = rights.full_text_allowed === true || status === "public-domain-text-ok" || status === "local-analysis-only";
  if (!locallyAllowed) return "";
  const absolute = path.isAbsolute(row.text_path) ? row.text_path : path.join(rootDir, row.text_path);
  if (!existsSync(absolute)) return "";
  return fs.readFile(absolute, "utf8");
}

function textScope(row, rights) {
  if (!row.text_path) return "metadata-only";
  if (rights.full_text_allowed === true || rights.redistribution_status === "public-domain-text-ok") return "stored-full-text";
  if (rights.redistribution_status === "local-analysis-only") return "stored-local-analysis-text";
  return "metadata-only";
}

function tokenize(value) {
  const raw = String(value)
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));
  const tokens = [];
  for (let index = 0; index < raw.length; index += 1) {
    tokens.push(raw[index]);
    if (index > 0) tokens.push(`${raw[index - 1]}_${raw[index]}`);
  }
  return tokens;
}

function vectorize(tokens, df, totalDocs) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  const hashed = new Map();
  for (const [token, count] of counts.entries()) {
    const dim = hashToken(token) % dimensions;
    const weight = (1 + Math.log(count)) * idf(df.get(token) ?? 0, totalDocs);
    hashed.set(dim, (hashed.get(dim) ?? 0) + weight);
  }
  const norm = Math.sqrt([...hashed.values()].reduce((sum, value) => sum + value * value, 0)) || 1;
  return Object.fromEntries([...hashed.entries()]
    .map(([dim, value]) => [dim, Number((value / norm).toFixed(6))])
    .filter(([, value]) => value !== 0)
    .sort(([a], [b]) => Number(a) - Number(b)));
}

function idf(documentCount, totalDocs) {
  return Math.log((1 + totalDocs) / (1 + documentCount)) + 1;
}

function hashToken(token) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) {
    const value = typeof key === "function" ? key(row) : row[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function renderMarkdown(index) {
  return [
    "# KB Semantic Hash Index",
    "",
    `Generated at: ${index.generated_at}`,
    `Kind: ${index.kind}`,
    `Dimensions: ${index.dimensions}`,
    `Documents: ${index.document_count}`,
    "",
    "## Text Scope",
    "",
    table(index.rights_scope_counts),
    "",
    "## Sources",
    "",
    table(index.source_counts),
    "",
    "This is a local hashed TF-IDF retrieval layer over metadata plus rights-filtered stored text. It is deterministic and offline; it is not a neural embedding model.",
    "",
  ].join("\n");
}

function table(counts) {
  const rows = Object.entries(counts);
  if (!rows.length) return "No entries.";
  return ["| Value | Count |", "| --- | ---: |", ...rows.map(([key, value]) => `| ${key} | ${value} |`)].join("\n");
}
