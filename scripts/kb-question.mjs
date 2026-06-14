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

const STOPWORDS = new Set([
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
  "does",
  "did",
  "are",
  "was",
  "were",
  "that",
  "this",
  "these",
  "those",
]);

const registry = await loadRegistry();
const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));
const blockedAudit = await readOptionalJson(path.join(rootDir, "data", "knowledge-base", "audits", "blocked-sources.json"));
const localDocumentCounts = countBy(sourceDocuments, "source_id");
const terms = tokenize(question);
const intent = inferQuestionIntent(question);
const evidence = searchLocalEvidence(question, 18, intent);
const evidenceSourceIds = new Set(evidence.results.map((result) => result.source_id));
const scored = registry.sources
  .map((source) => ({
    source,
    local_document_count: localDocumentCounts[source.source_id] ?? 0,
    score: scoreSource(source, terms, localDocumentCounts[source.source_id] ?? 0, evidenceSourceIds.has(source.source_id), intent),
  }))
  .filter((entry) => entry.score > 0)
  .sort((a, b) => b.score - a.score || b.local_document_count - a.local_document_count || a.source.source_id.localeCompare(b.source.source_id))
  .slice(0, 12);

const questionSlug = slug(question).slice(0, 80) || "question";
const outDir = path.join(rootDir, "docs", "research-briefs", questionSlug);
const sourceMap = {
  generated_at: new Date().toISOString(),
  question,
  inferred_intent: intent,
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
const dateCoverage = buildDateCoverage(sourceMap, sourceDocuments, evidenceRows);
const studyDesign = buildStudyDesign(question, sourceMap, evidenceRows, dateCoverage);
const identitySummary = buildIdentitySummary(question, terms);
const publicationConcept = buildPublicationConcept(question, sourceMap, evidenceRows, studyDesign);
const studyTemplate = buildStudyTemplate(question, sourceMap, evidenceRows, studyDesign, publicationConcept);

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
await writeJson(path.join(outDir, "date-coverage.json"), dateCoverage);
await writeJson(path.join(outDir, "identity-summary.json"), identitySummary);
await writeJson(path.join(outDir, "publication-concept.json"), publicationConcept);
await writeText(path.join(outDir, "brief.md"), renderBrief(sourceMap, evidenceRows, studyDesign, identitySummary));
await writeText(path.join(outDir, "queries.sql"), renderQueries(sourceMap, evidence.fts_query, identitySummary));
await writeText(path.join(outDir, "missing-data.md"), renderMissingData(sourceMap, blockedAudit, evidenceRows));
await writeText(path.join(outDir, "study-template.md"), renderStudyTemplate(studyTemplate));

console.log(`Wrote local KB research brief to docs/research-briefs/${questionSlug}/brief.md`);

function tokenize(value) {
  return new Set(
    String(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 2 && !STOPWORDS.has(term))
  );
}

function scoreSource(source, terms, localDocumentCount, hasEvidence, intent) {
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
  if (intent.preferred_source_classes.includes(source.source_class)) score += 8;
  if (intent.secondary_source_classes.includes(source.source_class)) score += 3;
  if (intent.deprioritized_source_classes.includes(source.source_class)) score -= 4;
  if (source.ingest_status === "seeded-from-experiment") score += 2;
  if (source.ingest_status === "active") score += 3;
  if (source.ingest_status === "blocked") score -= 2;
  return score;
}

function renderBrief(sourceMap, evidenceRows, studyDesign, identitySummary) {
  const localEvidence = sourceMap.matched_sources.filter((source) => source.local_document_count > 0);
  const plannedLeads = sourceMap.matched_sources.filter((source) => source.local_document_count === 0);
  const evidenceBySource = countBy(evidenceRows, "source_id");
  return [
    `# Local KB Brief: ${sourceMap.question}`,
    "",
    `Generated at: ${sourceMap.generated_at}`,
    `Inferred source priority: ${sourceMap.inferred_intent.preferred_source_classes.length ? sourceMap.inferred_intent.preferred_source_classes.join(", ") : "general KB search"}`,
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
    `- Date coverage: ${studyDesign.date_coverage_summary}`,
    `- Claim strength: ${studyDesign.claim_strength}`,
    "",
    "## Candidate Outputs",
    "",
    ...studyDesign.candidate_outputs.map((item) => `- ${item}`),
    "",
    "## Identity And Reference Leads",
    "",
    identitySummary.people.length || identitySummary.work_references.length
      ? [
        `- Candidate people matching question terms: ${identitySummary.people.length}`,
        `- Candidate work references matching question terms: ${identitySummary.work_references.length}`,
        ...identitySummary.people.slice(0, 5).map((row) => `- Person: ${row.canonical_name} (${row.confidence}; ${row.record_count} records; ${row.source_ids || "no source ids"})`),
        ...identitySummary.work_references.slice(0, 5).map((row) => `- Reference: ${row.reference_label} (${row.reference_type}; ${row.citation_count} citation edges; ${row.confidence})`),
      ].join("\n")
      : "No canonical person or work-reference rows matched the question terms directly.",
    "",
    "## Publication Concept",
    "",
    `- Working title: ${studyDesign.publication_concept.essay_title_options[0]}`,
    `- Why this matters: ${studyDesign.publication_concept.why_this_matters}`,
    `- Follow-up acquisition: ${studyDesign.publication_concept.suggested_follow_up_acquisition[0]}`,
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

function renderQueries(sourceMap, ftsQuery, identitySummary) {
  const ids = sourceMap.matched_sources.map((source) => `'${source.source_id.replaceAll("'", "''")}'`).join(", ");
  const preferredClasses = sourceMap.inferred_intent.preferred_source_classes.map((sourceClass) => `'${sourceClass.replaceAll("'", "''")}'`).join(", ");
  const identityWhere = identitySummary.sql_like_clauses.people || "1 = 0";
  const referenceWhere = identitySummary.sql_like_clauses.work_references || "1 = 0";
  return [
    "-- SQLite queries over the local humanities KB.",
    "",
    ids ? `-- Relevant source IDs: ${ids}` : "-- No relevant source IDs matched yet.",
    "",
    "SELECT *",
    "FROM source_documents",
    ids ? `WHERE source_id IN (${ids});` : "WHERE false;",
    "",
    "-- Source-class coverage for this question route.",
    "SELECT sd.source_id, COUNT(*) AS docs",
    "FROM source_documents sd",
    ids ? `WHERE sd.source_id IN (${ids})` : "WHERE false",
    "GROUP BY sd.source_id",
    "ORDER BY docs DESC;",
    "",
    preferredClasses ? `-- Preferred source classes: ${preferredClasses}` : "-- No preferred source class inferred.",
    "",
    "-- Date coverage by matched source.",
    "SELECT source_id,",
    "       COUNT(*) AS docs,",
    "       MIN(NULLIF(CAST(publication_year AS INTEGER), 0)) AS min_publication_year,",
    "       MAX(NULLIF(CAST(publication_year AS INTEGER), 0)) AS max_publication_year,",
    "       SUM(CASE WHEN publication_year IS NOT NULL AND publication_year != '' THEN 1 ELSE 0 END) AS docs_with_publication_year",
    "FROM source_documents",
    ids ? `WHERE source_id IN (${ids})` : "WHERE false",
    "GROUP BY source_id",
    "ORDER BY docs_with_publication_year DESC, docs DESC;",
    "",
    "SELECT local_id, source_id, source_url, title, type, venue, department,",
    "       snippet(source_documents_fts, -1, '[', ']', '...', 18) AS snippet,",
    "       bm25(source_documents_fts) AS rank",
    "FROM source_documents_fts",
    `WHERE source_documents_fts MATCH '${ftsQuery.replaceAll("'", "''")}'`,
    "ORDER BY rank ASC",
    "LIMIT 25;",
    "",
    "-- Candidate person identity clusters for this question.",
    "SELECT canonical_person_id, canonical_name, source_count, record_count, source_ids, institution_hints, confidence, notes",
    "FROM canonical_people",
    `WHERE ${identityWhere}`,
    "ORDER BY source_count DESC, record_count DESC, canonical_name ASC",
    "LIMIT 25;",
    "",
    "-- Candidate cited/reference work clusters for this question.",
    "SELECT canonical_reference_id, reference_label, reference_type, source_count, citation_count, source_ids, confidence, notes",
    "FROM work_references",
    `WHERE ${referenceWhere}`,
    "ORDER BY citation_count DESC, source_count DESC, reference_label ASC",
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

function buildDateCoverage(sourceMap, sourceDocuments, evidenceRows) {
  const preferred = sourceMap.inferred_intent.preferred_source_classes ?? [];
  const scopedSources = preferred.length
    ? sourceMap.matched_sources.filter((source) => preferred.includes(source.source_class))
    : sourceMap.matched_sources;
  const matchedIds = new Set(scopedSources.map((source) => source.source_id));
  const matchedRows = sourceDocuments.filter((row) => matchedIds.has(row.source_id));
  const rowsBySource = new Map();
  for (const row of matchedRows) {
    if (!rowsBySource.has(row.source_id)) rowsBySource.set(row.source_id, []);
    rowsBySource.get(row.source_id).push(row);
  }
  const sources = scopedSources.map((source) => {
    const rows = rowsBySource.get(source.source_id) ?? [];
    const extracted = rows.map(extractYears).filter((entry) => entry.years.length || entry.fetch_years.length);
    const contentYears = extracted.flatMap((entry) => entry.years);
    const fetchYears = extracted.flatMap((entry) => entry.fetch_years);
    const fields = countFields(extracted.flatMap((entry) => entry.fields));
    return {
      source_id: source.source_id,
      source_class: source.source_class,
      local_document_count: source.local_document_count,
      rows_checked: rows.length,
      rows_with_content_year: extracted.filter((entry) => entry.years.length).length,
      rows_with_fetch_year: extracted.filter((entry) => entry.fetch_years.length).length,
      min_content_year: contentYears.length ? Math.min(...contentYears) : null,
      max_content_year: contentYears.length ? Math.max(...contentYears) : null,
      min_fetch_year: fetchYears.length ? Math.min(...fetchYears) : null,
      max_fetch_year: fetchYears.length ? Math.max(...fetchYears) : null,
      date_fields: fields,
      longitudinal_ready: contentYears.length >= 20 && new Set(contentYears).size >= 5,
      date_note: dateNote(contentYears, fetchYears),
    };
  });
  const allContentYears = sources.flatMap((source) => rangeValues(source.min_content_year, source.max_content_year, source.rows_with_content_year));
  const evidenceYears = evidenceRows.flatMap((row) => extractYears(row).years);
  const longitudinalSources = sources.filter((source) => source.longitudinal_ready);
  const rating = longitudinalSources.length >= 2 ? "strong-enough-for-scoping" : longitudinalSources.length === 1 ? "source-specific-only" : allContentYears.length ? "thin-date-coverage" : "fetch-date-only-or-missing";
  const min = allContentYears.length ? Math.min(...allContentYears) : null;
  const max = allContentYears.length ? Math.max(...allContentYears) : null;
  return {
    generated_at: sourceMap.generated_at,
    question: sourceMap.question,
    scoped_source_classes: preferred,
    rating,
    summary: min && max
      ? `${allContentYears.length} matched local records carry content years spanning ${min}-${max}; ${longitudinalSources.length} matched sources look longitudinal-ready for scoping.`
      : "Matched local records lack enough content-date fields for longitudinal claims; use fetch dates only for crawl coverage, not historical interpretation.",
    time_handling: min && max
      ? `content-date coverage spans ${min}-${max}; use date-coverage.json to separate content years from fetch years before longitudinal claims`
      : "date coverage is weak; first normalize source-specific date fields and avoid longitudinal claims based only on fetch dates",
    evidence_years: evidenceYears.length ? {
      min: Math.min(...evidenceYears),
      max: Math.max(...evidenceYears),
      count: evidenceYears.length,
    } : null,
    sources,
  };
}

function buildIdentitySummary(question, terms) {
  const sqlitePath = path.join(processedDir, "knowledge-base.sqlite");
  const searchTerms = [...terms].filter((term) => term.length > 2).slice(0, 8);
  const peopleWhere = likeClause(["canonical_name", "source_author_ids", "institution_hints"], searchTerms);
  const referenceWhere = likeClause(["reference_label", "reference_key", "source_work_ids"], searchTerms);
  const people = querySqliteJson(sqlitePath, `
SELECT 'person' AS row_type, canonical_person_id, canonical_name, source_count, record_count, source_ids, source_author_ids, institution_hints, confidence, notes
FROM canonical_people
WHERE ${peopleWhere || "1 = 0"}
ORDER BY source_count DESC, record_count DESC, canonical_name ASC
LIMIT 12;
`);
  const workReferences = querySqliteJson(sqlitePath, `
SELECT 'work_reference' AS row_type, canonical_reference_id, reference_label, reference_type, source_count, citation_count, source_ids, source_work_ids, confidence, notes
FROM work_references
WHERE ${referenceWhere || "1 = 0"}
ORDER BY citation_count DESC, source_count DESC, reference_label ASC
LIMIT 12;
`);
  return {
    generated_at: new Date().toISOString(),
    question,
    sqlite_path: path.relative(rootDir, sqlitePath),
    terms: searchTerms,
    sql_like_clauses: {
      people: peopleWhere,
      work_references: referenceWhere,
    },
    people: people.rows,
    work_references: workReferences.rows,
    error: [people.error, workReferences.error].filter(Boolean).join("\n"),
    limitations: [
      "Person rows are deterministic candidate clusters by normalized name.",
      "Work-reference rows are strongest when keyed by DOI or OpenAlex ID.",
      "Use these leads for scoping, joins, and QA before manual authority review.",
    ],
  };
}

function extractYears(row) {
  const contentFields = ["publication_year", "date", "creation_date", "accession_year"];
  const fetchFields = ["fetched_at"];
  const years = [];
  const fetchYears = [];
  const fields = [];
  for (const field of contentFields) {
    for (const year of yearsFromValue(row[field])) {
      if (isReasonableYear(year)) {
        years.push(year);
        fields.push(field);
      }
    }
  }
  for (const field of fetchFields) {
    for (const year of yearsFromValue(row[field])) {
      if (isReasonableYear(year)) {
        fetchYears.push(year);
        fields.push(field);
      }
    }
  }
  return {
    years: [...new Set(years)],
    fetch_years: [...new Set(fetchYears)],
    fields: [...new Set(fields)],
  };
}

function yearsFromValue(value) {
  if (value == null || value === "") return [];
  const matches = String(value).match(/\b(1[4-9]\d{2}|20\d{2})\b/g) ?? [];
  return matches.map(Number);
}

function isReasonableYear(year) {
  const currentYear = new Date().getUTCFullYear() + 1;
  return Number.isInteger(year) && year >= 1400 && year <= currentYear;
}

function countFields(fields) {
  const counts = {};
  for (const field of fields) counts[field] = (counts[field] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function dateNote(contentYears, fetchYears) {
  if (contentYears.length) {
    return `${contentYears.length} rows have content years; do not mix with ${fetchYears.length} fetch-year rows.`;
  }
  if (fetchYears.length) return "Only fetch years were detected; useful for crawl freshness, not historical claims.";
  return "No usable years detected in normalized source-document fields.";
}

function rangeValues(min, max, count) {
  if (!min || !max || !count) return [];
  if (count === 1) return [min];
  return [min, max, ...Array(Math.max(0, count - 2)).fill(min)];
}

function searchLocalEvidence(query, limit, intent) {
  const sqlitePath = path.join(processedDir, "knowledge-base.sqlite");
  const ftsQuery = toFtsQuery(query);
  const sourceClassCase = buildSourceClassCase(intent);
  const sql = `
.mode json
WITH source_hits AS (
  SELECT 'source_document' AS result_type, local_id, source_id, source_url, title, type, venue, department, publication_year,
         snippet(source_documents_fts, -1, '[', ']', '...', 18) AS snippet,
         bm25(source_documents_fts) + ${sourceClassCase} AS rank
  FROM source_documents_fts
  WHERE source_documents_fts MATCH ${sqlString(ftsQuery)}
  LIMIT ${limit}
),
page_hits AS (
  SELECT 'page' AS result_type, local_id, source_id, source_url, title, page_type AS type, school AS venue, department, '' AS publication_year,
         snippet(pages_fts, -1, '[', ']', '...', 18) AS snippet,
         bm25(pages_fts) - ${intent.preferred_source_classes.includes("university-department-web") ? "8" : "0"} AS rank
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

function inferQuestionIntent(question) {
  const text = String(question).toLowerCase();
  const preferred = [];
  const secondary = [];
  const deprioritized = [];
  const explicitScholarly = /\b(journal|article|articles|scholarship|scholarly|literature|publication|publications|doi|citation|citations|author|authors|venue|venues)\b/.test(text);
  const explicitInstitutional = /\b(department|departments|university|universities|college|colleges|faculty|campus|center|centers|humanities division)\b/.test(text);
  if (explicitInstitutional || (/\bpublic humanities\b/.test(text) && !explicitScholarly)) {
    preferred.push("university-department-web");
    secondary.push("web-archives", "conference-programs");
    deprioritized.push("cultural-collections", "public-domain-texts");
  }
  if (explicitScholarly) {
    preferred.push("scholarly-metadata", "journals-and-reviews");
    secondary.push("conference-programs", "linked-open-data");
    if (!explicitInstitutional) deprioritized.push("university-department-web");
  }
  if (/\b(entity|entities|movement|movements|occupation|occupations|institution|institutions|field map|concept map|knowledge graph)\b/.test(text)) {
    preferred.unshift("linked-open-data");
    secondary.push("scholarly-metadata", "open-text-metadata");
  }
  if (/\b(museum|collection|collections|object|objects|art|artist|artists|acquisition|accession|exhibition|archive|archives)\b/.test(text)) {
    preferred.push("cultural-collections");
    secondary.push("linked-open-data", "open-text-metadata");
    deprioritized.push("scholarly-metadata");
  }
  if (/\b(book|books|novel|novels|poem|poetry|literary text|full text|public domain|gutenberg|canon)\b/.test(text)) {
    preferred.push("public-domain-texts", "open-text-metadata");
    secondary.push("linked-open-data", "scholarly-metadata");
  }
  return {
    preferred_source_classes: unique(preferred),
    secondary_source_classes: unique(secondary),
    deprioritized_source_classes: unique(deprioritized).filter((sourceClass) => !preferred.includes(sourceClass)),
  };
}

function buildSourceClassCase(intent) {
  const cases = [];
  for (const sourceClass of intent.preferred_source_classes) {
    const ids = sourceIdsForClass(sourceClass);
    if (ids) cases.push(`WHEN source_id IN (${ids}) THEN -8`);
  }
  for (const sourceClass of intent.deprioritized_source_classes) {
    const ids = sourceIdsForClass(sourceClass);
    if (ids) cases.push(`WHEN source_id IN (${ids}) THEN 4`);
  }
  if (!cases.length) return "0";
  return `(CASE ${cases.join(" ")} ELSE 0 END)`;
}

function sourceIdsForClass(sourceClass) {
  const ids = registry.sources
    .filter((source) => source.source_class === sourceClass)
    .map((source) => sqlString(source.source_id));
  return ids.length ? ids.join(", ") : "";
}

function unique(values) {
  return [...new Set(values)];
}

async function readOptionalJson(file) {
  try {
    return JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(file, "utf8")));
  } catch {
    return null;
  }
}

function buildStudyDesign(question, sourceMap, evidenceRows, dateCoverage) {
  const sourceClasses = new Set(sourceMap.matched_sources.map((source) => source.source_class));
  const preferredClasses = new Set(sourceMap.inferred_intent.preferred_source_classes);
  const outputClasses = preferredClasses.size ? preferredClasses : sourceClasses;
  const hasUniversity = preferredClasses.has("university-department-web") || (!preferredClasses.size && sourceClasses.has("university-department-web"));
  const hasScholarly = preferredClasses.has("scholarly-metadata") || preferredClasses.has("journals-and-reviews") || (!preferredClasses.size && (sourceClasses.has("scholarly-metadata") || sourceClasses.has("journals-and-reviews")));
  const hasCollections = preferredClasses.has("cultural-collections") || (!preferredClasses.size && sourceClasses.has("cultural-collections"));
  const hasTexts = preferredClasses.has("public-domain-texts") || preferredClasses.has("open-text-metadata");
  const hasLinkedData = preferredClasses.has("linked-open-data");
  const publicationConcept = buildPublicationConcept(question, sourceMap, evidenceRows, {
    source_classes: [...sourceClasses],
    claim_strength: evidenceRows.length >= 10 ? "moderate local evidence for scoping; needs source-specific normalization before publication claims" : evidenceRows.length ? "thin local evidence; useful for scoping, not yet for strong claims" : "no direct local evidence hits; use source map as acquisition plan",
  });
  return {
    question,
    unit_of_analysis: hasUniversity ? "source page or institutional document" : hasLinkedData ? "linked cultural entity, person, work, movement, institution, or concept" : hasScholarly ? "work/article metadata record" : hasCollections ? "collection object or public metadata record" : hasTexts ? "public-domain text or bibliographic metadata record" : "source document",
    suggested_method: hasUniversity ? "compare term frequencies and framing across institution, department, source type, and capture/fetch year" : hasLinkedData ? "build an entity table first, then join people, works, movements, institutions, and concepts to scholarly or collection records" : hasCollections ? "compare object metadata fields across institution, department, classification, date, rights, and image availability" : hasScholarly ? "start with source-stratified local evidence review, then convert matched records into a longitudinal publication/venue table" : hasTexts ? "build a rights-filtered text/metadata evidence table, then separate quote-ready full text from discovery-only records" : "start with source-stratified local evidence review, then convert matched records into a longitudinal table",
    time_handling: dateCoverage.time_handling,
    date_coverage_summary: dateCoverage.summary,
    date_coverage_rating: dateCoverage.rating,
    claim_strength: evidenceRows.length >= 10 ? "moderate local evidence for scoping; needs source-specific normalization before publication claims" : evidenceRows.length ? "thin local evidence; useful for scoping, not yet for strong claims" : "no direct local evidence hits; use source map as acquisition plan",
    candidate_outputs: [
      "source coverage table by source_id and rights status",
      "top matching records with URLs and quote restrictions",
      "time-series table after date normalization",
      "missing-data memo for blocked, planned, and low-evidence sources",
      ...candidateOutputsFor(outputClasses),
    ],
    publication_concept: publicationConcept,
  };
}

function candidateOutputsFor(sourceClasses) {
  if (sourceClasses.has("university-department-web")) {
    return [
      "term-frequency table by school, department, page_type, and fetch year",
      "institution-by-concept heatmap for department language",
      "page-type comparison table for home/about/news/events/faculty pages",
    ];
  }
  if (sourceClasses.has("scholarly-metadata") || sourceClasses.has("journals-and-reviews")) {
    return [
      "publication-year trend table by venue and source",
      "top venue and publisher table for matched works",
      "author/institution coverage table after identity normalization",
    ];
  }
  if (sourceClasses.has("cultural-collections")) {
    return [
      "object count table by institution, department, classification, and date",
      "rights/image availability table by collection source",
      "acquisition/accession-year trend table where source metadata supports it",
    ];
  }
  if (sourceClasses.has("public-domain-texts") || sourceClasses.has("open-text-metadata")) {
    return [
      "public-domain text hit table with source URLs and quote status",
      "genre/bookshelf coverage table",
      "term/context concordance table over reusable full text",
    ];
  }
  return [];
}

function buildPublicationConcept(question, sourceMap, evidenceRows, studyDesign) {
  const preferred = sourceMap.inferred_intent?.preferred_source_classes ?? [];
  const primarySources = sourceMap.matched_sources.filter((source) => preferred.includes(source.source_class));
  const topSourceNames = (primarySources.length ? primarySources : sourceMap.matched_sources).slice(0, 3).map((source) => source.name);
  const claimStrength = studyDesign.claim_strength ?? "unknown until local evidence is reviewed";
  const routeLabel = preferred.length ? preferred.join(", ") : "mixed humanities sources";
  return {
    essay_title_options: [
      titleCaseFromQuestion(question),
      `What Local Humanities Data Shows About ${shortTopic(question)}`,
      `A Field Map Of ${shortTopic(question)}`,
    ],
    candidate_charts_tables: candidateChartsFor(preferred),
    claim_strength_rating: claimStrength,
    missing_evidence_list: missingEvidenceList(sourceMap, evidenceRows),
    suggested_follow_up_acquisition: followUpAcquisitionFor(preferred, sourceMap),
    why_this_matters: `This question can now start from local ${routeLabel} evidence instead of fresh scraping, with ${evidenceRows.length} direct hits and top local sources including ${topSourceNames.join(", ") || "no matched local sources yet"}.`,
  };
}

function candidateChartsFor(preferredClasses) {
  if (preferredClasses.includes("university-department-web")) {
    return [
      "Department-page hit counts by school and page_type",
      "Concept frequency by department over fetch/archive year",
      "Matched source coverage by institution and rights status",
    ];
  }
  if (preferredClasses.includes("linked-open-data")) {
    return [
      "Entity counts by type, occupation, movement, institution, and source",
      "Co-occurrence table for people, works, movements, and concepts",
      "Coverage table for Wikidata-linked entities versus scholarly records",
    ];
  }
  if (preferredClasses.includes("scholarly-metadata")) {
    return [
      "Matched works by publication year",
      "Top venues and publishers for matched records",
      "Open-access and rights coverage by source",
    ];
  }
  if (preferredClasses.includes("cultural-collections")) {
    return [
      "Objects by institution and classification",
      "Creation/acquisition year coverage histogram",
      "Rights and image availability by source",
    ];
  }
  if (preferredClasses.includes("public-domain-texts")) {
    return [
      "Matched texts by author/date/genre",
      "Concordance table for key terms",
      "Public-domain quote-ready evidence table",
    ];
  }
  return [
    "Source coverage by source class",
    "Evidence hit table with rights status",
    "Missing evidence by source status",
  ];
}

function missingEvidenceList(sourceMap, evidenceRows) {
  const evidenceSourceIds = new Set(evidenceRows.map((row) => row.source_id));
  const missing = sourceMap.matched_sources
    .filter((source) => source.local_document_count === 0 || !evidenceSourceIds.has(source.source_id))
    .slice(0, 6)
    .map((source) => `${source.source_id}: ${source.local_document_count} local docs, ${evidenceSourceIds.has(source.source_id) ? "has direct hits" : "no direct hits"}`);
  return missing.length ? missing : ["No immediate missing source-class evidence among matched local sources; normalize dates/entities before stronger claims."];
}

function followUpAcquisitionFor(preferredClasses, sourceMap) {
  if (preferredClasses.includes("university-department-web")) {
    return [
      "Run deeper source-specific department crawlers for faculty/events/news/program pages on successful domains.",
      "Add replacement public routes or Wayback metadata for 403 department homepages.",
    ];
  }
  if (preferredClasses.includes("linked-open-data")) {
    return [
      "Expand Wikidata cultural-entity pulls for matched occupations, movements, works, institutions, and humanities concepts.",
      "Join entity IDs to OpenAlex/Crossref/DOAJ records before claiming field-level coverage.",
    ];
  }
  if (preferredClasses.includes("scholarly-metadata")) {
    return [
      "Expand OpenAlex/Crossref/DOAJ page limits for matched venues and concepts.",
      "Normalize authors, venues, years, DOI joins, and citation/reference edges before publication claims.",
    ];
  }
  if (preferredClasses.includes("cultural-collections")) {
    return [
      "Expand cultural-collection API pulls by institution, classification, and accession/acquisition fields.",
      "Record item-level rights and image availability before quoting or reproducing object descriptions.",
    ];
  }
  if (preferredClasses.includes("public-domain-texts")) {
    return [
      "Expand Project Gutenberg/public-domain text imports for matched authors, genres, and bookshelves.",
      "Store text-normalization manifests and boilerplate removal reports before close-reading outputs.",
    ];
  }
  return [
    "Promote the highest-scoring source class into a source-specific ingest after checking rights and local coverage.",
  ];
}

function buildStudyTemplate(question, sourceMap, evidenceRows, studyDesign, publicationConcept) {
  return {
    question,
    source_classes: sourceMap.inferred_intent.preferred_source_classes,
    local_tables: ["source_documents", "rights", "pages", "works", "objects", "venues", "authors", "canonical_people", "citations", "work_references", "topics"],
    unit_of_analysis: studyDesign.unit_of_analysis,
    claim_strength: studyDesign.claim_strength,
    date_coverage_summary: studyDesign.date_coverage_summary,
    date_coverage_rating: studyDesign.date_coverage_rating,
    minimum_next_steps: [
      "Review evidence.json for quote restrictions and source URLs.",
      "Run queries.sql against data/knowledge-base/processed/knowledge-base.sqlite.",
      "Normalize dates and source-specific identifiers before longitudinal claims.",
      "Use missing-data.md before any fresh scrape.",
    ],
    publication_concept: publicationConcept,
    evidence_count: evidenceRows.length,
  };
}

function renderStudyTemplate(template) {
  return [
    `# Study Template: ${template.question}`,
    "",
    "## Local Tables",
    "",
    ...template.local_tables.map((table) => `- ${table}`),
    "",
    "## Unit Of Analysis",
    "",
    template.unit_of_analysis,
    "",
    "## Claim Strength",
    "",
    template.claim_strength,
    "",
    "## Date Coverage",
    "",
    `${template.date_coverage_rating}: ${template.date_coverage_summary}`,
    "",
    "## Minimum Next Steps",
    "",
    ...template.minimum_next_steps.map((step) => `- ${step}`),
    "",
    "## Publication Concept",
    "",
    ...template.publication_concept.essay_title_options.map((title) => `- ${title}`),
    "",
    "## Candidate Charts And Tables",
    "",
    ...template.publication_concept.candidate_charts_tables.map((item) => `- ${item}`),
    "",
    "## Follow-Up Acquisition",
    "",
    ...template.publication_concept.suggested_follow_up_acquisition.map((item) => `- ${item}`),
    "",
    "## Why This Matters",
    "",
    template.publication_concept.why_this_matters,
    "",
  ].join("\n");
}

function titleCaseFromQuestion(question) {
  return shortTopic(question)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function shortTopic(question) {
  const words = String(question)
    .replace(/[?!.]+$/g, "")
    .split(/\s+/)
    .filter((word) => !/^(what|which|how|does|do|did|has|have|the|a|an|in|on|of|to|for|and|or|with)$/i.test(word));
  return words.slice(0, 8).join(" ") || "The Question";
}

function toFtsQuery(value) {
  const terms = [...new Set(
    String(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 2 && !STOPWORDS.has(term))
  )].slice(0, 8);
  return terms.length ? terms.map((term) => `"${term.replaceAll('"', '""')}"`).join(" OR ") : String(value).replaceAll('"', '""');
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function likeClause(columns, terms) {
  if (!terms.length) return "";
  return terms.map((term) => {
    const pattern = `%${term.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    return `(${columns.map((column) => `${column} LIKE ${sqlString(pattern)} ESCAPE '\\'`).join(" OR ")})`;
  }).join(" OR ");
}

function querySqliteJson(sqlitePath, selectSql) {
  const result = spawnSync("sqlite3", [sqlitePath], {
    input: `.mode json\n${selectSql}`,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return {
      rows: [],
      error: result.stderr || result.stdout,
    };
  }
  try {
    return {
      rows: result.stdout.trim() ? JSON.parse(result.stdout) : [],
      error: "",
    };
  } catch {
    return {
      rows: [],
      error: `Could not parse sqlite JSON output: ${result.stdout.slice(0, 200)}`,
    };
  }
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) {
    const value = row[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}
