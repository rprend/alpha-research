import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  processedDir,
  rootDir,
} from "./kb-lib.mjs";

const args = process.argv.slice(2);
const query = args.filter((arg) => !arg.startsWith("--")).join(" ").trim();
const limit = Number.parseInt(getArg("--limit") ?? "20", 10);
if (!query) {
  throw new Error('Usage: pnpm kb:search:sqlite "query terms" [--limit=20]');
}

const sqlitePath = path.join(processedDir, "knowledge-base.sqlite");
const ftsQuery = toFtsQuery(query);
const sql = `
.mode json
WITH source_hits AS (
  SELECT
    'source_document' AS result_type,
    local_id,
    source_id,
    source_url,
    title,
    type,
    venue,
    department,
    snippet(source_documents_fts, 3, '[', ']', '...', 18) AS snippet,
    bm25(source_documents_fts) AS rank
  FROM source_documents_fts
  WHERE source_documents_fts MATCH ${sqlString(ftsQuery)}
  LIMIT ${Number.isFinite(limit) ? limit : 20}
),
page_hits AS (
  SELECT
    'page' AS result_type,
    local_id,
    source_id,
    source_url,
    title,
    page_type AS type,
    school AS venue,
    department,
    snippet(pages_fts, 6, '[', ']', '...', 18) AS snippet,
    bm25(pages_fts) AS rank
  FROM pages_fts
  WHERE pages_fts MATCH ${sqlString(ftsQuery)}
  LIMIT ${Number.isFinite(limit) ? limit : 20}
)
SELECT *
FROM (
  SELECT * FROM source_hits
  UNION ALL
  SELECT * FROM page_hits
)
ORDER BY rank ASC, local_id ASC
LIMIT ${Number.isFinite(limit) ? limit : 20};
`;

const result = spawnSync("sqlite3", [sqlitePath], {
  input: sql,
  encoding: "utf8",
});
if (result.status !== 0) {
  throw new Error(`sqlite3 search failed: ${result.stderr || result.stdout}`);
}

const rows = result.stdout.trim() ? JSON.parse(result.stdout) : [];
console.log(JSON.stringify({
  query,
  fts_query: ftsQuery,
  generated_at: new Date().toISOString(),
  sqlite_path: path.relative(rootDir, sqlitePath),
  result_count: rows.length,
  results: rows,
}, null, 2));

function getArg(name) {
  const arg = args.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

function toFtsQuery(value) {
  const terms = String(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2)
    .slice(0, 8);
  if (!terms.length) return String(value).replaceAll('"', '""');
  return terms.map((term) => `"${term.replaceAll('"', '""')}"`).join(" AND ");
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
