import fs from "node:fs/promises";
import path from "node:path";
import {
  escapeHtml,
  experimentDir,
  readJson,
  toCsv,
  writeJson,
  writeText,
} from "./lib.mjs";

const processedDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const manifest = await latestManifest();
const rows = manifest.requests.map((request) => {
  const accessible = Number(request.status) >= 200 && Number(request.status) < 300;
  const score = scoreCandidate(request, accessible);
  return {
    id: request.id,
    name: request.name,
    domain: request.domain,
    access_mode: request.accessMode,
    access_status: accessible ? "accessible" : request.status,
    http_status: request.httpStatus ?? request.status,
    records_or_signals: request.parsedRecordCount ?? 0,
    license_clarity: request.licenseClarity,
    structured_data: request.structuredData,
    time_depth: request.timeDepth,
    entity_richness: request.entityRichness,
    normalization_burden: request.normalizationBurden,
    essay_potential: request.essayPotential,
    readiness_score: score,
    readiness_bucket: bucket(score, accessible),
    starter_question: request.starterQuestion,
    quality_risk: request.qualityRisk,
    url: request.url,
  };
}).sort((a, b) => b.readiness_score - a.readiness_score || a.name.localeCompare(b.name));

const result = {
  generatedAt: new Date().toISOString(),
  candidates: rows.length,
  accessibleCandidates: rows.filter((row) => row.access_status === "accessible").length,
  readyCandidates: rows.filter((row) => row.readiness_bucket === "ready-now").length,
  needsWorkCandidates: rows.filter((row) => row.readiness_bucket === "needs-source-work").length,
  blockedCandidates: rows.filter((row) => row.readiness_bucket === "blocked-or-constrained").length,
  domains: summarize(rows, "domain"),
  accessModes: summarize(rows, "access_mode"),
  topCandidates: rows.slice(0, 8),
  rows,
  strongestFinding: "Humanities datasets become essay-ready when they combine public access, structured metadata, clear rights, time depth, and a question that respects coverage bias.",
  nextMoves: [
    "Run a first essay from one ready-now corpus such as Chronicling America, LOC collections, Project Gutenberg, or museum open-access APIs.",
    "Separate corpus availability from representativeness in all public writing.",
    "Add file-level probes for the highest-ranked candidates.",
    "Create study specs for the top three ready-now corpora.",
  ],
  caveats: [
    "A dataset being public does not mean it is representative of culture.",
    "License clarity, API access, and metadata structure are separate readiness dimensions.",
    "Aggregators can be analytically powerful but mix institutions, schemas, and rights statements.",
    "Many humanities corpora are useful only after domain-specific normalization.",
  ],
};

await writeJson(path.join(processedDir, "candidates.json"), rows);
await writeText(path.join(processedDir, "dataset-rankings.csv"), toCsv(rows, [
  "id",
  "name",
  "domain",
  "access_mode",
  "access_status",
  "records_or_signals",
  "license_clarity",
  "structured_data",
  "time_depth",
  "entity_richness",
  "normalization_burden",
  "essay_potential",
  "readiness_score",
  "readiness_bucket",
  "starter_question",
  "quality_risk",
  "url",
]));
await writeText(path.join(reportsDir, "source-inventory.csv"), toCsv(rows, [
  "id",
  "name",
  "domain",
  "access_mode",
  "access_status",
  "records_or_signals",
  "readiness_bucket",
  "url",
]));
await writeText(path.join(reportsDir, "source-inventory.md"), buildSourceInventory(rows));
await writeJson(path.join(reportsDir, "result.json"), result);
await writeText(path.join(reportsDir, "report.html"), buildHtml(result));
await writeText(path.join(reportsDir, "public-draft.md"), buildPublicDraft(result));
await writeText(path.join(reportsDir, "work.md"), buildWorkLog(result));

console.log(`Built humanities dataset registry report for ${rows.length} candidates`);

async function latestManifest() {
  const root = path.join(experimentDir, "data", "raw", "candidate-pages");
  const entries = await fs.readdir(root, { withFileTypes: true });
  const latest = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().at(-1);
  if (!latest) throw new Error("No candidate probe manifest found");
  return readJson(path.join(root, latest, "manifest.json"));
}

function scoreCandidate(row, accessible) {
  let score = accessible ? 20 : 0;
  score += valueScore(row.licenseClarity, { high: 20, medium: 10, low: 0 });
  score += valueScore(row.structuredData, { high: 20, medium: 10, low: 0 });
  score += valueScore(row.timeDepth, { high: 15, medium: 8, low: 0 });
  score += valueScore(row.entityRichness, { high: 15, medium: 8, low: 0 });
  score += valueScore(row.essayPotential, { high: 20, medium: 10, low: 0 });
  score -= valueScore(row.normalizationBurden, { high: 15, medium: 7, low: 0 });
  return Math.max(0, score);
}

function valueScore(value, map) {
  return map[String(value).toLowerCase()] ?? 0;
}

function bucket(score, accessible) {
  if (!accessible) return "blocked-or-constrained";
  if (score >= 75) return "ready-now";
  if (score >= 50) return "needs-source-work";
  return "blocked-or-constrained";
}

function summarize(rows, key) {
  const out = {};
  for (const row of rows) out[row[key]] = (out[row[key]] ?? 0) + 1;
  return out;
}

function buildSourceInventory(rows) {
  return [
    "# Humanities Dataset Registry Source Inventory",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    "| Dataset | Domain | Access | Records/Signals | Bucket | URL |",
    "| --- | --- | --- | ---: | --- | --- |",
    ...rows.map((row) => `| ${row.name} | ${row.domain} | ${row.access_status} | ${row.records_or_signals} | ${row.readiness_bucket} | ${row.url} |`),
    "",
  ].join("\n");
}

function buildHtml(result) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Humanities Dataset Registry</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; margin: 40px auto; max-width: 1120px; color: #1f2933; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0 28px; }
    th, td { border-bottom: 1px solid #d9e2ec; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f0f4f8; }
    .stat { display: inline-block; border: 1px solid #d9e2ec; padding: 10px 12px; margin: 0 8px 8px 0; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Humanities Dataset Registry</h1>
  <p>${escapeHtml(result.strongestFinding)}</p>
  <p>
    <span class="stat"><strong>${result.candidates}</strong> candidates</span>
    <span class="stat"><strong>${result.accessibleCandidates}</strong> accessible</span>
    <span class="stat"><strong>${result.readyCandidates}</strong> ready-now</span>
  </p>
  <h2>Ranked Candidates</h2>
  ${table(result.rows, ["name", "domain", "access_mode", "readiness_score", "readiness_bucket", "starter_question", "quality_risk"])}
  <h2>Caveats</h2>
  <ul>${result.caveats.map((caveat) => `<li>${escapeHtml(caveat)}</li>`).join("")}</ul>
</body>
</html>
`;
}

function table(rows, columns) {
  const header = `<tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>`;
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column] ?? "")}</td>`).join("")}</tr>`).join("\n");
  return `<table>${header}${body}</table>`;
}

function buildPublicDraft(result) {
  return [
    "# What Counts As A Humanities Dataset?",
    "",
    "This is a research-agenda draft from a source-probed dataset registry.",
    "",
    "## Thesis To Test",
    "",
    "A humanities dataset is not just a pile of cultural material. It becomes analytically useful when access, rights, metadata structure, time depth, and coverage bias are all legible.",
    "",
    "## Corpus Note",
    "",
    `The current registry probes ${result.candidates} candidate corpora. ${result.accessibleCandidates} were accessible in the latest run, and ${result.readyCandidates} are ranked ready-now for a first essay or study spec.`,
    "",
    "## Central Finding",
    "",
    result.strongestFinding,
    "",
    "## What To Study Next",
    "",
    ...result.nextMoves.map((move) => `- ${move}`),
    "",
    "## Caveats",
    "",
    ...result.caveats.map((caveat) => `- ${caveat}`),
    "",
  ].join("\n");
}

function buildWorkLog(result) {
  return [
    "# Work Log",
    "",
    `Generated at: ${result.generatedAt}`,
    `Candidates: ${result.candidates}`,
    `Accessible candidates: ${result.accessibleCandidates}`,
    `Ready-now candidates: ${result.readyCandidates}`,
    "",
    "## Commands",
    "",
    "```bash",
    "node docs/experiments/humanities-dataset-registry/scripts/probe-candidates.mjs",
    "node docs/experiments/humanities-dataset-registry/scripts/build-report.mjs",
    "node docs/experiments/humanities-dataset-registry/scripts/check-readiness.mjs",
    "```",
    "",
  ].join("\n");
}
