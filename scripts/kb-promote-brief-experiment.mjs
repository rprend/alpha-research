import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  rootDir,
  slug,
  writeJson,
  writeText,
} from "./kb-lib.mjs";

const defaultBriefs = [
  "which-humanities-departments-have-visible-faculty-events-news-and-public-humanit",
  "what-scholarly-literature-discusses-digital-humanities-and-public-humanities",
  "how-do-museum-collections-describe-acquisition-classification-and-public-domain-",
  "which-cultural-entities-movements-authors-and-institutions-can-anchor-a-field-ma",
  "which-public-domain-texts-can-support-a-study-of-canon-drift-genre-and-recurring",
];

const requested = getArg("--brief")
  ? [getArg("--brief")]
  : process.argv.includes("--all")
    ? await listBriefs()
    : defaultBriefs;

const promoted = [];
for (const briefSlug of requested) {
  promoted.push(await promoteBrief(briefSlug));
}

await writeJson(path.join(rootDir, "data", "knowledge-base", "audits", "promoted-experiments.json"), {
  generated_at: new Date().toISOString(),
  promoted_count: promoted.length,
  promoted,
});
await writeText(path.join(rootDir, "data", "knowledge-base", "audits", "promoted-experiments.md"), renderPromotionIndex(promoted));

console.log(`Promoted ${promoted.length} KB briefs into first-pass experiments.`);

async function listBriefs() {
  const dir = path.join(rootDir, "docs", "research-briefs");
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(path.join(dir, name, "study-template.md")))
    .sort();
}

async function promoteBrief(briefSlug) {
  const briefDir = path.join(rootDir, "docs", "research-briefs", briefSlug);
  const required = ["brief.md", "source-map.json", "evidence.json", "queries.sql", "missing-data.md", "study-design.json", "publication-concept.json", "study-template.md"];
  for (const file of required) {
    if (!existsSync(path.join(briefDir, file))) {
      throw new Error(`Brief ${briefSlug} is missing ${file}`);
    }
  }

  const sourceMap = await readJson(path.join(briefDir, "source-map.json"));
  const evidence = await readJson(path.join(briefDir, "evidence.json"));
  const studyDesign = await readJson(path.join(briefDir, "study-design.json"));
  const publicationConcept = await readJson(path.join(briefDir, "publication-concept.json"));
  const identitySummary = await readOptionalJson(path.join(briefDir, "identity-summary.json"));
  const dateCoverage = await readOptionalJson(path.join(briefDir, "date-coverage.json"));
  const experimentId = `kb-${slug(shortExperimentName(sourceMap.question)).slice(0, 72)}`;
  const experimentDir = path.join(rootDir, "docs", "experiments", experimentId);
  const reportsDir = path.join(experimentDir, "reports");
  const configDir = path.join(experimentDir, "config");
  const dataDir = path.join(experimentDir, "data", "derived");
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.mkdir(configDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });

  const evidenceRows = evidence.results ?? [];
  const rightsSummary = summarizeRights(evidenceRows);
  const sourceSummary = summarizeSources(sourceMap, evidenceRows);
  const readiness = buildReadiness({ sourceMap, evidenceRows, studyDesign, publicationConcept, identitySummary, dateCoverage, rightsSummary });
  const plan = {
    experiment_id: experimentId,
    generated_at: new Date().toISOString(),
    source_brief: `docs/research-briefs/${briefSlug}/`,
    question: sourceMap.question,
    unit_of_analysis: studyDesign.unit_of_analysis,
    suggested_method: studyDesign.suggested_method,
    claim_strength: studyDesign.claim_strength,
    date_coverage_rating: studyDesign.date_coverage_rating ?? dateCoverage?.rating ?? "unknown",
    local_tables: tableListFor(sourceMap),
    source_summary: sourceSummary,
    rights_summary: rightsSummary,
    expected_outputs: [
      "reports/readiness.md",
      "reports/readiness.json",
      "reports/article-outline.md",
      "reports/claim-checklist.md",
      "config/source-map.json",
      "config/queries.sql",
      "data/derived/evidence-sample.json",
    ],
    next_actions: [
      "Run config/queries.sql against data/knowledge-base/processed/knowledge-base.sqlite.",
      "Review evidence sample and rights statuses before quoting any source text.",
      "Promote only claims marked publication-ready in reports/claim-checklist.md.",
      "Use the missing-data memo before starting any fresh scrape.",
    ],
  };

  await copy(path.join(briefDir, "queries.sql"), path.join(configDir, "queries.sql"));
  await copy(path.join(briefDir, "missing-data.md"), path.join(reportsDir, "missing-data.md"));
  await writeJson(path.join(configDir, "source-map.json"), sourceMap);
  await writeJson(path.join(configDir, "study-design.json"), studyDesign);
  await writeJson(path.join(configDir, "publication-concept.json"), publicationConcept);
  await writeJson(path.join(dataDir, "evidence-sample.json"), {
    generated_at: new Date().toISOString(),
    source_brief: `docs/research-briefs/${briefSlug}/evidence.json`,
    evidence_count: evidenceRows.length,
    sample: evidenceRows.slice(0, 50),
  });
  await writeJson(path.join(experimentDir, "experiment-plan.json"), plan);
  await writeJson(path.join(reportsDir, "readiness.json"), readiness);
  await writeText(path.join(experimentDir, "README.md"), renderReadme({ experimentId, briefSlug, plan, readiness, sourceMap, publicationConcept }));
  await writeText(path.join(reportsDir, "readiness.md"), renderReadiness(readiness));
  await writeText(path.join(reportsDir, "article-outline.md"), renderArticleOutline({ sourceMap, studyDesign, publicationConcept, sourceSummary, rightsSummary }));
  await writeText(path.join(reportsDir, "claim-checklist.md"), renderClaimChecklist({ sourceMap, studyDesign, evidenceRows, dateCoverage, identitySummary }));

  return {
    experiment_id: experimentId,
    question: sourceMap.question,
    source_brief: `docs/research-briefs/${briefSlug}/`,
    experiment_dir: `docs/experiments/${experimentId}/`,
    readiness_status: readiness.status,
    evidence_count: evidenceRows.length,
    matched_source_count: sourceMap.matched_sources?.length ?? 0,
  };
}

function shortExperimentName(question) {
  return String(question)
    .replace(/\b(how|what|which|does|do|did|has|have|the|a|an|in|on|of|to|for|and|or|with|local|corpus)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || "humanities-kb-experiment";
}

function summarizeRights(evidenceRows) {
  const counts = {};
  for (const row of evidenceRows) {
    const status = row.rights?.redistribution_status ?? "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function summarizeSources(sourceMap, evidenceRows) {
  const directHits = {};
  for (const row of evidenceRows) directHits[row.source_id] = (directHits[row.source_id] ?? 0) + 1;
  return (sourceMap.matched_sources ?? []).map((source) => ({
    source_id: source.source_id,
    source_class: source.source_class,
    local_document_count: source.local_document_count,
    direct_evidence_hits: directHits[source.source_id] ?? 0,
    ingest_status: source.ingest_status,
    redistribution_status: source.redistribution_status,
  }));
}

function buildReadiness({ sourceMap, evidenceRows, studyDesign, publicationConcept, identitySummary, dateCoverage, rightsSummary }) {
  const gates = [
    {
      gate: "local evidence",
      passed: evidenceRows.length >= 10,
      detail: `${evidenceRows.length} direct local evidence hits.`,
    },
    {
      gate: "source provenance",
      passed: (sourceMap.matched_sources ?? []).some((source) => source.local_document_count > 0),
      detail: `${(sourceMap.matched_sources ?? []).filter((source) => source.local_document_count > 0).length} matched sources have local documents.`,
    },
    {
      gate: "rights review",
      passed: Object.keys(rightsSummary).length > 0 && !rightsSummary["unknown"],
      detail: `Evidence rights statuses: ${Object.entries(rightsSummary).map(([key, value]) => `${key}=${value}`).join(", ") || "none"}.`,
    },
    {
      gate: "date handling",
      passed: !/longitudinal/i.test(String(studyDesign.suggested_method)) || !["fetch-date-only-or-missing", "unknown"].includes(studyDesign.date_coverage_rating ?? dateCoverage?.rating ?? "unknown"),
      detail: `${studyDesign.date_coverage_rating ?? dateCoverage?.rating ?? "unknown"}: ${studyDesign.date_coverage_summary ?? dateCoverage?.summary ?? "No date summary."}`,
    },
    {
      gate: "identity/reference caveats",
      passed: true,
      detail: identitySummary ? `${identitySummary.people?.length ?? 0} person leads and ${identitySummary.work_references?.length ?? 0} work-reference leads; candidate identity only.` : "No identity summary present; use source identifiers only.",
    },
  ];
  const failed = gates.filter((gate) => !gate.passed);
  return {
    generated_at: new Date().toISOString(),
    status: failed.length ? "scoping-ready-not-publication-ready" : "first-pass-experiment-ready",
    question: sourceMap.question,
    claim_strength: studyDesign.claim_strength,
    publication_concept: publicationConcept.essay_title_options?.[0] ?? sourceMap.question,
    gates,
    failed_gates: failed.map((gate) => gate.gate),
  };
}

function tableListFor(sourceMap) {
  const classes = new Set(sourceMap.inferred_intent?.preferred_source_classes ?? []);
  const tables = ["source_documents", "rights"];
  if (classes.has("university-department-web")) tables.push("pages", "departments");
  if (classes.has("scholarly-metadata") || classes.has("journals-and-reviews")) tables.push("works", "venues", "authors", "canonical_people", "citations", "work_references");
  if (classes.has("cultural-collections")) tables.push("objects", "collections");
  if (classes.has("linked-open-data")) tables.push("topics", "canonical_people");
  if (classes.has("public-domain-texts") || classes.has("open-text-metadata")) tables.push("works");
  return [...new Set(tables)];
}

function renderReadme({ experimentId, briefSlug, plan, readiness, sourceMap, publicationConcept }) {
  return [
    `# ${titleCase(experimentId.replace(/^kb-/, "").replace(/-/g, " "))}`,
    "",
    "First-pass experiment promoted from the local humanities knowledge base.",
    "",
    "## Research Question",
    "",
    sourceMap.question,
    "",
    "## Source Brief",
    "",
    `- Brief directory: \`docs/research-briefs/${briefSlug}/\``,
    `- Experiment plan: \`experiment-plan.json\``,
    `- Readiness: \`reports/readiness.md\``,
    `- SQL: \`config/queries.sql\``,
    "",
    "## Current Status",
    "",
    `- Readiness status: ${readiness.status}`,
    `- Claim strength: ${plan.claim_strength}`,
    `- Unit of analysis: ${plan.unit_of_analysis}`,
    `- Suggested method: ${plan.suggested_method}`,
    "",
    "## Runbook",
    "",
    "From the repository root:",
    "",
    "```bash",
    `sqlite3 data/knowledge-base/processed/knowledge-base.sqlite < docs/experiments/${experimentId}/config/queries.sql`,
    "```",
    "",
    "Review these before drafting:",
    "",
    "- `reports/claim-checklist.md`",
    "- `reports/article-outline.md`",
    "- `reports/missing-data.md`",
    "- `data/derived/evidence-sample.json`",
    "",
    "## Candidate Publication",
    "",
    ...(publicationConcept.essay_title_options ?? []).map((title) => `- ${title}`),
    "",
    "## Rights Boundary",
    "",
    "This experiment inherits source rights from the local KB. Do not quote or redistribute full source text unless `rights.redistribution_status`, `quote_status`, and source-specific review allow it.",
    "",
  ].join("\n");
}

function renderReadiness(readiness) {
  return [
    `# Readiness: ${readiness.question}`,
    "",
    `Generated at: ${readiness.generated_at}`,
    `Status: ${readiness.status}`,
    `Claim strength: ${readiness.claim_strength}`,
    "",
    "## Gates",
    "",
    ...readiness.gates.map((gate) => `- ${gate.passed ? "PASS" : "NEEDS WORK"}: ${gate.gate} - ${gate.detail}`),
    "",
  ].join("\n");
}

function renderArticleOutline({ sourceMap, studyDesign, publicationConcept, sourceSummary, rightsSummary }) {
  return [
    `# Article Outline: ${sourceMap.question}`,
    "",
    "## Thesis Placeholder",
    "",
    publicationConcept.why_this_matters ?? "Use the local KB evidence to decide the final thesis.",
    "",
    "## Method",
    "",
    studyDesign.suggested_method,
    "",
    "## Candidate Charts And Tables",
    "",
    ...(publicationConcept.candidate_charts_tables ?? studyDesign.candidate_outputs ?? []).map((item) => `- ${item}`),
    "",
    "## Source Coverage",
    "",
    ...sourceSummary.slice(0, 12).map((source) => `- ${source.source_id}: ${source.local_document_count} docs, ${source.direct_evidence_hits} direct hits, ${source.redistribution_status}`),
    "",
    "## Rights Snapshot",
    "",
    ...Object.entries(rightsSummary).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Follow-Up Acquisition",
    "",
    ...(publicationConcept.suggested_follow_up_acquisition ?? []).map((item) => `- ${item}`),
    "",
  ].join("\n");
}

function renderClaimChecklist({ sourceMap, studyDesign, evidenceRows, dateCoverage, identitySummary }) {
  return [
    `# Claim Checklist: ${sourceMap.question}`,
    "",
    "## Claims Allowed Now",
    "",
    "- The local KB contains evidence relevant to this question.",
    `- Direct local evidence hits in the promoted brief: ${evidenceRows.length}.`,
    `- Current claim strength: ${studyDesign.claim_strength}.`,
    "",
    "## Claims Requiring More Work",
    "",
    "- Longitudinal trend claims require date normalization and date-coverage review.",
    "- Person-level or citation-network claims require authority matching beyond deterministic candidate clusters.",
    "- Quotation-heavy claims require quote/rights review for the specific records used.",
    "",
    "## Date Caveat",
    "",
    dateCoverage ? `${dateCoverage.rating}: ${dateCoverage.summary}` : "No date coverage artifact was available.",
    "",
    "## Identity Caveat",
    "",
    identitySummary
      ? `Candidate identity leads: ${identitySummary.people?.length ?? 0} people, ${identitySummary.work_references?.length ?? 0} work references. Treat these as scoping leads.`
      : "No identity summary artifact was available.",
    "",
    "## Evidence Records To Review First",
    "",
    ...evidenceRows.slice(0, 15).map((row) => `- ${row.source_id}: ${row.title || row.local_id} (${row.source_url || "no URL"}; rights=${row.rights?.redistribution_status ?? "unknown"})`),
    "",
  ].join("\n");
}

function renderPromotionIndex(promoted) {
  return [
    "# KB Promoted Experiments",
    "",
    `Generated at: ${new Date().toISOString()}`,
    `Promoted experiments: ${promoted.length}`,
    "",
    ...promoted.map((row) => [
      `## ${row.experiment_id}`,
      "",
      `- Question: ${row.question}`,
      `- Source brief: \`${row.source_brief}\``,
      `- Experiment: \`${row.experiment_dir}\``,
      `- Readiness: ${row.readiness_status}`,
      `- Evidence hits: ${row.evidence_count}`,
      "",
    ].join("\n")),
  ].join("\n");
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readOptionalJson(file) {
  try {
    return await readJson(file);
  } catch {
    return null;
  }
}

async function copy(from, to) {
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.copyFile(from, to);
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] ?? "";
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : "";
}

function titleCase(value) {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
