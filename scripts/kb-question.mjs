import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  loadRegistry,
  processedDir,
  readJsonl,
  rootDir,
  slug,
  writeJson,
  writeText,
} from "./kb-lib.mjs";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  throw new Error('Usage: pnpm kb:question "research question"');
}

const registry = await loadRegistry();
const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));
const blockedAudit = await readOptionalJson(path.join(rootDir, "data", "knowledge-base", "audits", "blocked-sources.json"));
const localDocumentCounts = countBy(sourceDocuments, "source_id");
const terms = tokenize(question);
const evidence = searchLocalEvidence(question, 12);
const evidenceSourceIds = new Set(evidence.results.map((result) => result.source_id));
const scored = registry.sources
  .map((source) => ({
    source,
    local_document_count: localDocumentCounts[source.source_id] ?? 0,
    score: scoreSource(source, terms, localDocumentCounts[source.source_id] ?? 0, evidenceSourceIds.has(source.source_id)),
  }))
  .filter((entry) => entry.score > 0)
  .sort((a, b) => b.score - a.score || b.local_document_count - a.local_document_count || a.source.source_id.localeCompare(b.source.source_id))
  .slice(0, 12);

const questionSlug = slug(question).slice(0, 80) || "question";
const outDir = path.join(rootDir, "docs", "research-briefs", questionSlug);
const sourceMap = {
  generated_at: new Date().toISOString(),
  question,
  local_evidence_count: evidence.results.length,
  matched_sources: scored.map(({ source, score, local_document_count }) => ({
    source_id: source.source_id,
    name: source.name,
    source_class: source.source_class,
    score,
    local_document_count,
    ingest_status: source.ingest_status,
    redistribution_status: source.redistribution_status,
    metadata_allowed: source.metadata_allowed,
    full_text_allowed: source.full_text_allowed,
    research_use_cases: source.research_use_cases,
    known_risks: source.known_risks,
  })),
};
const rightsMap = new Map(rights.map((row) => [row.local_id, row]));
const evidenceRows = evidence.results.map((result) => ({
  ...result,
  rights: rightsMap.get(result.local_id) ?? null,
}));
const studyDesign = buildStudyDesign(question, sourceMap, evidenceRows);

await writeJson(path.join(outDir, "source-map.json"), sourceMap);
await writeJson(path.join(outDir, "evidence.json"), {
  generated_at: sourceMap.generated_at,
  question,
  sqlite_path: evidence.sqlite_path,
  fts_query: evidence.fts_query,
  result_count: evidenceRows.length,
  results: evidenceRows,
});
await writeJson(path.join(outDir, "study-design.json"), studyDesign);
await writeText(path.join(outDir, "brief.md"), renderBrief(sourceMap, evidenceRows, studyDesign));
await writeText(path.join(outDir, "queries.sql"), renderQueries(sourceMap, evidence.fts_query));
await writeText(path.join(outDir, "missing-data.md"), renderMissingData(sourceMap, blockedAudit, evidenceRows));

console.log(`Wrote local KB research brief to docs/research-briefs/${questionSlug}/brief.md`);

function tokenize(value) {
  return new Set(
    String(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 2)
  );
}

function scoreSource(source, terms, localDocumentCount, hasEvidence) {
  const haystack = [
    source.source_id,
    source.name,
    source.source_class,
    source.license,
    source.redistribution_status,
    ...source.expected_fields,
    ...source.research_use_cases,
    ...source.known_risks,
  ].join(" ").toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) score += 1;
  }
  if (localDocumentCount > 0) score += 3;
  if (localDocumentCount >= 10) score += 1;
  if (localDocumentCount >= 100) score += 1;
  if (hasEvidence) score += 4;
  if (source.ingest_status === "seeded-from-experiment") score += 2;
  if (source.ingest_status === "active") score += 3;
  if (source.ingest_status === "blocked") score -= 2;
  return score;
}

function renderBrief(sourceMap, evidenceRows, studyDesign) {
  const localEvidence = sourceMap.matched_sources.filter((source) => source.local_document_count > 0);
  const plannedLeads = sourceMap.matched_sources.filter((source) => source.local_document_count === 0);
  const evidenceBySource = countBy(evidenceRows, "source_id");
  return [
    `# Local KB Brief: ${sourceMap.question}`,
    "",
    `Generated at: ${sourceMap.generated_at}`,
    "",
    "## Local Evidence Sources",
    "",
    localEvidence.length
      ? localEvidence.map((source) => `- ${source.source_id}: ${source.local_document_count} local docs; ${evidenceBySource[source.source_id] ?? 0} direct evidence hits (${source.source_class}, ${source.ingest_status}, ${source.redistribution_status})`).join("\n")
      : "No matched source has local documents yet.",
    "",
    "## Local Evidence Hits",
    "",
    evidenceRows.length
      ? evidenceRows.slice(0, 10).map((row) => `- ${row.source_id}: ${row.title || row.local_id} (${row.type}; ${row.source_url || "no URL"})`).join("\n")
      : "No direct SQLite FTS evidence hits for this question.",
    "",
    "## Preliminary Study Design",
    "",
    `- Unit of analysis: ${studyDesign.unit_of_analysis}`,
    `- Suggested method: ${studyDesign.suggested_method}`,
    `- Time handling: ${studyDesign.time_handling}`,
    `- Claim strength: ${studyDesign.claim_strength}`,
    "",
    "## Candidate Outputs",
    "",
    ...studyDesign.candidate_outputs.map((item) => `- ${item}`),
    "",
    "## Planned Or Missing Leads",
    "",
    plannedLeads.length
      ? plannedLeads.map((source) => `- ${source.source_id} (${source.source_class}, ${source.ingest_status}, ${source.redistribution_status})`).join("\n")
      : "No matched planned leads without local documents.",
    "",
    "## What Can Be Checked Locally First",
    "",
    "- Query the source registry for relevant source classes and rights constraints.",
    "- Check `data/knowledge-base/audits/kb-status.md` for local table and text availability.",
    "- Use existing experiment artifacts listed in `data/knowledge-base/audits/existing-experiment-inventory.md` before starting a new scrape.",
    "",
    "## Claim Boundaries",
    "",
    "- Treat `planned` sources as leads, not evidence.",
    "- Treat `seeded-from-experiment` sources as partial evidence until promoted into KB raw/processed tables.",
    "- Do not quote or redistribute full text unless the source rights fields allow it.",
    "",
  ].join("\n");
}

function renderQueries(sourceMap, ftsQuery) {
  const ids = sourceMap.matched_sources.map((source) => `'${source.source_id.replaceAll("'", "''")}'`).join(", ");
  return [
    "-- SQLite queries over the local humanities KB.",
    "",
    ids ? `-- Relevant source IDs: ${ids}` : "-- No relevant source IDs matched yet.",
    "",
    "SELECT *",
    "FROM source_documents",
    ids ? `WHERE source_id IN (${ids});` : "WHERE false;",
    "",
    "SELECT local_id, source_id, source_url, title, type, venue, department,",
    "       snippet(source_documents_fts, 3, '[', ']', '...', 18) AS snippet,",
    "       bm25(source_documents_fts) AS rank",
    "FROM source_documents_fts",
    `WHERE source_documents_fts MATCH '${ftsQuery.replaceAll("'", "''")}'`,
    "ORDER BY rank ASC",
    "LIMIT 25;",
    "",
  ].join("\n");
}

function renderMissingData(sourceMap, blockedAudit, evidenceRows) {
  const blocked = sourceMap.matched_sources.filter((source) => source.ingest_status === "blocked");
  const planned = sourceMap.matched_sources.filter((source) => source.ingest_status === "planned" && source.local_document_count === 0);
  const sourcesWithoutDirectEvidence = sourceMap.matched_sources
    .filter((source) => source.local_document_count > 0 && !evidenceRows.some((row) => row.source_id === source.source_id));
  const blockedById = new Map((blockedAudit?.blocked_sources ?? []).map((source) => [source.source_id, source]));
  return [
    `# Missing Data: ${sourceMap.question}`,
    "",
    "## Planned Sources That Need Ingest Jobs",
    "",
    planned.length ? planned.map((source) => `- ${source.source_id}: ${source.name}`).join("\n") : "No planned matched sources.",
    "",
    "## Blocked Or Rights-Constrained Sources",
    "",
    blocked.length ? blocked.map((source) => {
      const memo = blockedById.get(source.source_id);
      return `- ${source.source_id}: ${source.name}${memo ? `; ${memo.next_decision}` : ""}`;
    }).join("\n") : "No blocked matched sources.",
    "",
    "## Local Sources Without Direct Evidence Hits",
    "",
    sourcesWithoutDirectEvidence.length ? sourcesWithoutDirectEvidence.map((source) => `- ${source.source_id}: ${source.local_document_count} local docs, but no direct SQLite FTS hit for the question terms.`).join("\n") : "Every matched local source has at least one direct evidence hit, or no local sources matched.",
    "",
    "## Next Acquisition Decision",
    "",
    "Promote the highest-scoring planned source into a source-specific ingest only after checking rights, robots, expected fields, and whether an existing experiment artifact already covers the question.",
    "",
  ].join("\n");
}

function searchLocalEvidence(query, limit) {
  const sqlitePath = path.join(processedDir, "knowledge-base.sqlite");
  const ftsQuery = toFtsQuery(query);
  const sql = `
.mode json
WITH source_hits AS (
  SELECT 'source_document' AS result_type, local_id, source_id, source_url, title, type, venue, department, publication_year,
         snippet(source_documents_fts, 3, '[', ']', '...', 18) AS snippet,
         bm25(source_documents_fts) AS rank
  FROM source_documents_fts
  WHERE source_documents_fts MATCH ${sqlString(ftsQuery)}
  LIMIT ${limit}
),
page_hits AS (
  SELECT 'page' AS result_type, local_id, source_id, source_url, title, page_type AS type, school AS venue, department, '' AS publication_year,
         snippet(pages_fts, 6, '[', ']', '...', 18) AS snippet,
         bm25(pages_fts) AS rank
  FROM pages_fts
  WHERE pages_fts MATCH ${sqlString(ftsQuery)}
  LIMIT ${limit}
)
SELECT * FROM (
  SELECT * FROM source_hits
  UNION ALL
  SELECT * FROM page_hits
)
ORDER BY rank ASC, local_id ASC
LIMIT ${limit};
`;
  const result = spawnSync("sqlite3", [sqlitePath], { input: sql, encoding: "utf8" });
  if (result.status !== 0) {
    return {
      sqlite_path: path.relative(rootDir, sqlitePath),
      fts_query: ftsQuery,
      results: [],
      error: result.stderr || result.stdout,
    };
  }
  return {
    sqlite_path: path.relative(rootDir, sqlitePath),
    fts_query: ftsQuery,
    results: result.stdout.trim() ? JSON.parse(result.stdout) : [],
  };
}

async function readOptionalJson(file) {
  try {
    return JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(file, "utf8")));
  } catch {
    return null;
  }
}

function buildStudyDesign(question, sourceMap, evidenceRows) {
  const sourceClasses = new Set(sourceMap.matched_sources.map((source) => source.source_class));
  const years = evidenceRows
    .map((row) => String(row.publication_year ?? row.fetched_at ?? "").match(/\d{4}/)?.[0])
    .filter(Boolean);
  const hasUniversity = sourceClasses.has("university-department-web");
  const hasScholarly = sourceClasses.has("scholarly-metadata") || sourceClasses.has("journals-and-reviews");
  const hasCollections = sourceClasses.has("cultural-collections");
  return {
    question,
    unit_of_analysis: hasUniversity ? "source page or institutional document" : hasScholarly ? "work/article metadata record" : hasCollections ? "collection object or public metadata record" : "source document",
    suggested_method: hasUniversity ? "compare term frequencies and framing across institution, department, source type, and capture/fetch year" : "start with source-stratified local evidence review, then convert matched records into a longitudinal table",
    time_handling: years.length ? `local evidence includes year-like values from ${Math.min(...years.map(Number))} to ${Math.max(...years.map(Number))}; verify dates before longitudinal claims` : "date coverage is weak in direct hits; first normalize dates from matched source records",
    claim_strength: evidenceRows.length >= 10 ? "moderate local evidence for scoping; needs source-specific normalization before publication claims" : evidenceRows.length ? "thin local evidence; useful for scoping, not yet for strong claims" : "no direct local evidence hits; use source map as acquisition plan",
    candidate_outputs: [
      "source coverage table by source_id and rights status",
      "top matching records with URLs and quote restrictions",
      "time-series table after date normalization",
      "missing-data memo for blocked, planned, and low-evidence sources",
    ],
  };
}

function toFtsQuery(value) {
  const stopwords = new Set([
    "how",
    "has",
    "have",
    "the",
    "and",
    "for",
    "with",
    "from",
    "into",
    "over",
    "time",
    "changed",
    "change",
    "what",
    "which",
    "when",
    "where",
  ]);
  const terms = [...new Set(
    String(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 2 && !stopwords.has(term))
  )].slice(0, 8);
  return terms.length ? terms.map((term) => `"${term.replaceAll('"', '""')}"`).join(" OR ") : String(value).replaceAll('"', '""');
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) {
    const value = row[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}
