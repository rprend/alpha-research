import path from "node:path";
import { indexesDir, readJson, rootDir } from "./kb-lib.mjs";

const args = process.argv.slice(2);
const query = args.filter((arg) => !arg.startsWith("--")).join(" ").trim();
const limit = Number.parseInt(getArg("--limit") ?? "10", 10);
const stopwords = new Set([
  "the", "and", "for", "that", "this", "with", "from", "are", "was", "were", "has", "have", "had", "not", "but",
  "you", "your", "their", "they", "our", "can", "all", "any", "into", "over", "under", "between", "about", "more",
  "than", "which", "what", "when", "where", "who", "how", "why", "will", "would", "could", "should", "may", "might",
]);
if (!query) {
  throw new Error('Usage: pnpm kb:search:semantic "query terms" [--limit=10]');
}

const indexPath = path.join(indexesDir, "semantic-hash-index.json");
const index = await readJson(indexPath);
const queryTokens = tokenize(query);
const queryTermHashes = new Set(queryTokens.map((token) => hashToken(token)));
const queryVector = vectorizeQuery(queryTokens, index);
const scored = [];
for await (const document of semanticDocuments(index)) {
  const overlap = exactOverlap(queryTermHashes, document.term_hashes ?? []);
  const vectorScore = cosine(queryVector, document.vector);
  const score = overlap.count > 0 ? vectorScore + overlap.score : 0;
  if (score <= 0) continue;
  scored.push({
    ...document,
    lexical_overlap: overlap.count,
    lexical_score: overlap.score,
    vector_score: vectorScore,
    score,
  });
}
const results = scored
  .sort((a, b) => b.score - a.score || b.lexical_overlap - a.lexical_overlap || a.local_id.localeCompare(b.local_id))
  .slice(0, Number.isFinite(limit) ? limit : 10);

console.log(JSON.stringify({
  query,
  generated_at: new Date().toISOString(),
  index_path: path.relative(rootDir, indexPath),
  index_kind: index.kind,
  index_shards: index.shards?.length ?? 0,
  result_count: results.length,
  results: results.map((document) => ({
    local_id: document.local_id,
    source_id: document.source_id,
    source_url: document.source_url,
    title: document.title,
    type: document.type,
    publication_year: document.publication_year,
    venue: document.venue,
    department: document.department,
    text_scope: document.text_scope,
    redistribution_status: document.redistribution_status,
    quote_status: document.quote_status,
    lexical_overlap: document.lexical_overlap,
    vector_score: Number(document.vector_score.toFixed(6)),
    score: Number(document.score.toFixed(6)),
  })),
}, null, 2));

function getArg(name) {
  const arg = args.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
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

function vectorizeQuery(tokens, index) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  const hashed = new Map();
  for (const [token, count] of counts.entries()) {
    const dim = hashToken(token) % index.dimensions;
    const weight = (1 + Math.log(count)) * (index.idf?.[token] ?? 1);
    hashed.set(dim, (hashed.get(dim) ?? 0) + weight);
  }
  const norm = Math.sqrt([...hashed.values()].reduce((sum, value) => sum + value * value, 0)) || 1;
  return Object.fromEntries([...hashed.entries()]
    .map(([dim, value]) => [dim, value / norm])
    .filter(([, value]) => value !== 0));
}

async function* semanticDocuments(index) {
  if (Array.isArray(index.documents)) {
    yield* index.documents;
    return;
  }
  for (const shardInfo of index.shards ?? []) {
    const shardPath = path.join(indexesDir, shardInfo.path);
    const shard = await readJson(shardPath);
    yield* (shard.documents ?? []);
  }
}

function cosine(left, right) {
  let score = 0;
  for (const [dim, value] of Object.entries(left)) {
    score += value * (right[dim] ?? 0);
  }
  return score;
}

function exactOverlap(queryTerms, documentTerms) {
  let count = 0;
  let weighted = 0;
  for (const term of documentTerms) {
    if (!queryTerms.has(term)) continue;
    count += 1;
    weighted += 1;
  }
  return {
    count,
    score: queryTerms.size ? weighted / queryTerms.size : 0,
  };
}

function hashToken(token) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
