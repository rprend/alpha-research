import fs from "node:fs/promises";
import path from "node:path";
import {
  indexesDir,
  rootDir,
} from "./kb-lib.mjs";

const query = process.argv.slice(2).join(" ").trim();
if (!query) {
  throw new Error('Usage: pnpm kb:search "query terms"');
}

const index = JSON.parse(await fs.readFile(path.join(indexesDir, "source-documents-keyword-index.json"), "utf8"));
const terms = tokenize(query);
const scores = new Map();
for (const term of terms) {
  const docs = index.postings[term] ?? [];
  for (const docId of docs) scores.set(docId, (scores.get(docId) ?? 0) + 1);
}

const results = Array.from(scores.entries())
  .map(([docId, score]) => ({ doc_id: docId, score, ...index.documents[docId] }))
  .sort((a, b) => b.score - a.score || a.doc_id.localeCompare(b.doc_id))
  .slice(0, 20);

console.log(JSON.stringify({
  query,
  generated_at: new Date().toISOString(),
  result_count: results.length,
  index_path: path.relative(rootDir, path.join(indexesDir, "source-documents-keyword-index.json")),
  results,
}, null, 2));

function tokenize(value) {
  return String(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2);
}
