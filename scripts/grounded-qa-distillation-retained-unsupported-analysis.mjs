import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "retained-unsupported-error-analysis-240-389-v1";
const tradeoffRunId = args["tradeoff-run-id"] ?? "risk-gate-tradeoff-240-389-v1";
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);

const windows = [
  {
    label: "241-320",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
    gateJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  },
  {
    label: "321-389",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    gateJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  },
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const tradeoffRows = await readJsonl(path.join(runDir, tradeoffRunId, "classified_examples.jsonl"));
const retainedRows = tradeoffRows.filter((row) => row.category === "retained_unsupported_answer");
const predictions = new Map();
const judgments = new Map();

for (const window of windows) {
  for (const row of await readJsonl(path.join(runDir, window.gateRun, "predictions.jsonl"))) {
    predictions.set(row.example_id, { ...row, window: window.label });
  }
  for (const row of await readJsonl(path.join(runDir, window.gateJudge, "judgments.jsonl"))) {
    judgments.set(row.example_id, { ...row, window: window.label });
  }
}

const examples = retainedRows.map((tradeoffRow) => {
  const predictionRow = predictions.get(tradeoffRow.example_id);
  const judgmentRow = judgments.get(tradeoffRow.example_id);
  if (!predictionRow || !judgmentRow) {
    throw new Error(`Missing prediction or judgment for ${tradeoffRow.example_id}`);
  }
  const prediction = predictionRow.prediction ?? {};
  const judgment = judgmentRow.judgment ?? {};
  const unsupportedClaims = arrayOfStrings(judgment.unsupported_claims);
  const missingCitations = arrayOfStrings(judgment.missing_citations);
  const evidenceText = [
    prediction.answer,
    ...(prediction.claim_table ?? []).map((claim) => `${claim.claim ?? ""} ${claim.support ?? ""}`),
    ...unsupportedClaims,
    ...missingCitations,
    judgment.notes,
  ].filter(Boolean).join("\n");
  const categories = categorizeFailure(evidenceText, judgment);
  const primaryCategory = categories[0] ?? "unsupported_relation";
  return {
    example_id: tradeoffRow.example_id,
    window: tradeoffRow.window,
    primary_category: primaryCategory,
    categories,
    support_score: tradeoffRow.support_score,
    gate_verdict: judgment.verdict ?? null,
    unsupported_claim_count: unsupportedClaims.length,
    missing_citation_count: missingCitations.length,
    answer_preview: compact(prediction.answer, 260),
    unsupported_claims: unsupportedClaims.map((claim) => compact(claim, 260)),
    missing_citations: missingCitations.map((claim) => compact(claim, 180)),
    judge_notes: compact(judgment.notes, 360),
    citations: prediction.citations ?? [],
  };
});

const categoryCounts = countBy(examples, (row) => row.primary_category);
const anyCategoryCounts = {};
for (const example of examples) {
  for (const category of example.categories) {
    anyCategoryCounts[category] = (anyCategoryCounts[category] ?? 0) + 1;
  }
}
const verdictCounts = countBy(examples, (row) => row.gate_verdict ?? "unknown");
const supportScores = examples.map((row) => row.support_score).filter((value) => Number.isFinite(value));
const highConfidenceFailures = examples.filter((row) => row.support_score >= 0.8).length;
const veryHighConfidenceFailures = examples.filter((row) => row.support_score >= 0.85).length;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  scope: "retained unsupported risk-gate answers on extended_temporal_future_holdout examples 241-389",
  source_tradeoff_run_id: tradeoffRunId,
  llm_calls: 0,
  run_cost_usd: 0,
  examples: examples.length,
  category_counts: sortCounts(categoryCounts),
  any_category_counts: sortCounts(anyCategoryCounts),
  verdict_counts: sortCounts(verdictCounts),
  support_score_summary: summarizeNumbers(supportScores),
  high_confidence_failures: highConfidenceFailures,
  very_high_confidence_failures: veryHighConfidenceFailures,
  top_examples: examples.slice(0, 12),
};

await writeJsonl(path.join(outputDir, "examples.jsonl"), examples);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result, examples));
await fs.writeFile(reportPath, renderReport(result, examples));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  summary_report: path.relative(rootDir, reportPath),
  examples: result.examples,
  category_counts: result.category_counts,
  support_score_summary: result.support_score_summary,
}, null, 2));

function categorizeFailure(text, judgment) {
  const lower = text.toLowerCase();
  const categories = [];
  const add = (category) => {
    if (!categories.includes(category)) categories.push(category);
  };
  if (matchesAny(lower, [
    /\b\d+(?:\.\d+)?\b/,
    /percent|percentage|%|fewer|more|less|higher|lower|increase|decrease|improve|drop|gain|rate|score|ratio|average|median|best|worse|better/,
  ])) add("numeric_or_comparison_overclaim");
  if (matchesAny(lower, [
    /not (?:directly |explicitly |fully )?support/,
    /does not (?:state|show|support|provide|mention|establish)/,
    /only (?:states|shows|mentions|provides|supports)/,
    /beyond the evidence|generaliz|overgeneraliz|specific|scope|insufficient/,
    /\ball\b|\balways\b|\bnone\b|\bonly\b|\bmust\b/,
  ])) add("scope_or_overgeneralization");
  if (matchesAny(lower, [
    /wrong (?:entity|paper|model|method|dataset|system|task|language|source)/,
    /different (?:entity|paper|model|method|dataset|system|task|language|source)/,
    /attribute|attribut(?:e|es|ed|ion)|confuses|misidentif|mismatch/,
  ])) add("entity_or_attribute_mismatch");
  if (matchesAny(lower, [
    /method|approach|baseline|experiment|result|finding|objective|task|training|evaluation/,
  ]) && matchesAny(lower, [
    /confus|instead|rather than|not the|unsupported|does not/,
  ])) add("method_result_confusion");
  if (matchesAny(lower, [
    /missing citation|citation.*missing|no citation|uncited|invalid citation|citation ids? valid.*false/,
  ]) || arrayOfStrings(judgment.missing_citations).length > 0) add("citation_contract_gap");
  if (matchesAny(lower, [
    /relation|relationship|correlation|caus|lead to|because|due to|therefore|implies|inference/,
  ])) add("unsupported_relation");
  if (!categories.length) add("unsupported_relation");
  return categories;
}

function renderReport(result, examples) {
  const categoryRows = Object.entries(result.category_counts)
    .map(([category, count]) => `| ${humanize(category)} | ${count} |`)
    .join("\n");
  const anyCategoryRows = Object.entries(result.any_category_counts)
    .map(([category, count]) => `| ${humanize(category)} | ${count} |`)
    .join("\n");
  const verdictRows = Object.entries(result.verdict_counts)
    .map(([verdict, count]) => `| ${verdict} | ${count} |`)
    .join("\n");
  const exampleRows = examples.slice(0, 8).map((row) => (
    `| \`${row.example_id}\` | ${humanize(row.primary_category)} | ${row.support_score.toFixed(3)} | ${escapeCell(row.judge_notes)} |`
  )).join("\n");
  return `# Retained Unsupported Error Analysis

Scope: ${result.scope}

This analysis makes no LLM calls. It inspects the ${result.examples} unsupported answers retained by the balanced support-risk gate, using existing risk-gate predictions and existing \`gpt-4o\` judge notes.

## Primary Failure Modes

| Category | Rows |
| --- | ---: |
${categoryRows}

## Any-Match Failure Signals

Rows can match more than one signal.

| Category | Rows |
| --- | ---: |
${anyCategoryRows}

## Judge Verdicts And Confidence

| Verdict | Rows |
| --- | ---: |
${verdictRows}

Support-risk scores among retained unsupported answers: min ${result.support_score_summary.min.toFixed(3)}, median ${result.support_score_summary.median.toFixed(3)}, max ${result.support_score_summary.max.toFixed(3)}. ${result.high_confidence_failures} of ${result.examples} failures score at least 0.800, and ${result.very_high_confidence_failures} score at least 0.850.

## Example Notes

| Example | Primary category | Support score | Judge note |
| --- | --- | ---: | --- |
${exampleRows}

## Interpretation

The retained unsupported answers are mostly high-confidence overclaims, not low-score threshold misses. Numeric/comparative statements and scope generalizations are the dominant local signals, so the next verifier should explicitly test claim-level entailment over cited evidence instead of adding another scalar threshold to the current lexical gate.
`;
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

function countBy(rows, fn) {
  const counts = {};
  for (const row of rows) counts[fn(row)] = (counts[fn(row)] ?? 0) + 1;
  return counts;
}

function sortCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function summarizeNumbers(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return { min: null, median: null, max: null, mean: null };
  return {
    min: sorted[0],
    median: quantile(sorted, 0.5),
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
  };
}

function quantile(sorted, q) {
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function compact(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function humanize(value) {
  return String(value).replaceAll("_", " ");
}

function escapeCell(value) {
  return compact(value, 240).replaceAll("|", "\\|");
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : true;
  }
  return parsed;
}
