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
const localDocumentCounts = countBy(sourceDocuments, "source_id");
const terms = tokenize(question);
const scored = registry.sources
  .map((source) => ({
    source,
    local_document_count: localDocumentCounts[source.source_id] ?? 0,
    score: scoreSource(source, terms, localDocumentCounts[source.source_id] ?? 0),
  }))
  .filter((entry) => entry.score > 0)
  .sort((a, b) => b.score - a.score || b.local_document_count - a.local_document_count || a.source.source_id.localeCompare(b.source.source_id))
  .slice(0, 12);

const questionSlug = slug(question).slice(0, 80) || "question";
const outDir = path.join(rootDir, "docs", "research-briefs", questionSlug);
const sourceMap = {
  generated_at: new Date().toISOString(),
  question,
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

await writeJson(path.join(outDir, "source-map.json"), sourceMap);
await writeText(path.join(outDir, "brief.md"), renderBrief(sourceMap));
await writeText(path.join(outDir, "queries.sql"), renderQueries(sourceMap));
await writeText(path.join(outDir, "missing-data.md"), renderMissingData(sourceMap));

console.log(`Wrote local KB research brief to docs/research-briefs/${questionSlug}/brief.md`);

function tokenize(value) {
  return new Set(
    String(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 2)
  );
}

function scoreSource(source, terms, localDocumentCount) {
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
  if (source.ingest_status === "seeded-from-experiment") score += 2;
  if (source.ingest_status === "active") score += 3;
  if (source.ingest_status === "blocked") score -= 2;
  return score;
}

function renderBrief(sourceMap) {
  const localEvidence = sourceMap.matched_sources.filter((source) => source.local_document_count > 0);
  const plannedLeads = sourceMap.matched_sources.filter((source) => source.local_document_count === 0);
  return [
    `# Local KB Brief: ${sourceMap.question}`,
    "",
    `Generated at: ${sourceMap.generated_at}`,
    "",
    "## Local Evidence Sources",
    "",
    localEvidence.length
      ? localEvidence.map((source) => `- ${source.source_id}: ${source.local_document_count} local docs (${source.source_class}, ${source.ingest_status}, ${source.redistribution_status})`).join("\n")
      : "No matched source has local documents yet.",
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

function renderQueries(sourceMap) {
  const ids = sourceMap.matched_sources.map((source) => `'${source.source_id.replaceAll("'", "''")}'`).join(", ");
  return [
    "-- DuckDB sketch for this question once KB Parquet tables exist.",
    "-- The source registry is JSON today; later phases should expose it as source_registry.parquet.",
    "",
    ids ? `-- Relevant source IDs: ${ids}` : "-- No relevant source IDs matched yet.",
    "",
    "SELECT *",
    "FROM source_documents",
    ids ? `WHERE source_id IN (${ids});` : "WHERE false;",
    "",
  ].join("\n");
}

function renderMissingData(sourceMap) {
  const blocked = sourceMap.matched_sources.filter((source) => source.ingest_status === "blocked");
  const planned = sourceMap.matched_sources.filter((source) => source.ingest_status === "planned" && source.local_document_count === 0);
  return [
    `# Missing Data: ${sourceMap.question}`,
    "",
    "## Planned Sources That Need Ingest Jobs",
    "",
    planned.length ? planned.map((source) => `- ${source.source_id}: ${source.name}`).join("\n") : "No planned matched sources.",
    "",
    "## Blocked Or Rights-Constrained Sources",
    "",
    blocked.length ? blocked.map((source) => `- ${source.source_id}: ${source.name}`).join("\n") : "No blocked matched sources.",
    "",
    "## Next Acquisition Decision",
    "",
    "Promote the highest-scoring planned source into a source-specific ingest only after checking rights, robots, expected fields, and whether an existing experiment artifact already covers the question.",
    "",
  ].join("\n");
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) {
    const value = row[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}
