import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "extended_temporal_future_holdout";
const predictionRun = requiredArg("prediction-run");
const judgeRun = requiredArg("judge-run");
const runId = args["run-id"] ?? `support-failure-analysis-${predictionRun}-v1`;
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const referencesById = new Map(references.map((row) => [row.example_id, row]));
const predictions = await readJsonl(path.join(runDir, predictionRun, "predictions.jsonl"));
const judgments = await readJsonl(path.join(runDir, judgeRun, "judgments.jsonl"));
const predictionsById = new Map(predictions.map((row) => [row.example_id, row]));

const rows = judgments
  .filter((row) => row.prediction_answer_type === "grounded_answer")
  .map((judgmentRow) => {
    const predictionRow = predictionsById.get(judgmentRow.example_id);
    const reference = referencesById.get(judgmentRow.example_id);
    const prediction = normalizePrediction(predictionRow?.prediction ?? {});
    const judgment = judgmentRow.judgment ?? {};
    const supported = isSupported(judgment);
    const tags = supported ? ["supported"] : failureTags({ judgment, prediction, reference });
    return {
      example_id: judgmentRow.example_id,
      counterfactual: Boolean(reference?.input?.document_metadata?.counterfactual),
      reference_answer_type: reference?.output?.answer_type ?? null,
      verdict: judgment.verdict ?? "unknown",
      supported,
      tags,
      citations: prediction.citations,
      unsupported_claims: Array.isArray(judgment.unsupported_claims) ? judgment.unsupported_claims : [],
      notes: String(judgment.notes ?? ""),
      answer: prediction.answer,
      answer_preview: preview(prediction.answer),
    };
  });

const unsupportedRows = rows.filter((row) => !row.supported);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  prediction_run: predictionRun,
  judge_run: judgeRun,
  calls_made: 0,
  run_cost_usd: 0,
  examples: rows.length,
  supported_answers: rows.filter((row) => row.supported).length,
  unsupported_answers: unsupportedRows.length,
  support_rate: ratio(rows.filter((row) => row.supported).length, rows.length),
  verdict_counts: counts(rows.map((row) => row.verdict)),
  tag_counts: counts(unsupportedRows.flatMap((row) => row.tags)),
  counterfactual_unsupported_answers: unsupportedRows.filter((row) => row.counterfactual).length,
  non_counterfactual_unsupported_answers: unsupportedRows.filter((row) => !row.counterfactual).length,
  mean_unsupported_claims: mean(unsupportedRows.map((row) => row.unsupported_claims.length)),
  rows,
  interpretation: {
    cost_change: "No additional LLM calls. This analysis reuses existing prediction and judge artifacts.",
    limitation: "Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.",
  },
};

await writeJsonl(path.join(outputDir, "rows.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  rows: path.relative(rootDir, path.join(outputDir, "rows.jsonl")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  summary_report: path.relative(rootDir, path.join(reportDir, `${runId}.md`)),
  supported_answers: result.supported_answers,
  unsupported_answers: result.unsupported_answers,
  tag_counts: result.tag_counts,
}, null, 2));

function failureTags({ judgment, prediction, reference }) {
  const text = [
    prediction.answer,
    judgment.notes,
    ...(Array.isArray(judgment.unsupported_claims) ? judgment.unsupported_claims : []),
  ].join(" ").toLowerCase();
  const tags = [];
  if (reference?.input?.document_metadata?.counterfactual) tags.push("counterfactual_answered");
  if (judgment.verdict === "partial") tags.push("partial_support");
  if (judgment.citation_ids_valid === false) tags.push("invalid_citation_id");
  if (/\bbaseline|compared|comparison|outperform|higher|lower|better|worse|best|most\b/.test(text)) tags.push("unsupported_comparison_or_baseline");
  if (/\bcontext|discourse|pragmatic|evaluated|annotation|annotated|dataset\b/.test(text)) tags.push("unsupported_context_or_annotation");
  if (/\btask|experiment|benchmark|speaker|role|detection|modeling|prediction\b/.test(text)) tags.push("unsupported_task_or_experiment");
  if (/\bnot mention|does not mention|no evidence|not state|not specify|not directly supported\b/.test(text)) tags.push("missing_direct_evidence");
  if (contentTokens(prediction.answer).length <= 2) tags.push("too_short_or_yes_no");
  if (!tags.length) tags.push("other_unsupported_claim");
  return [...new Set(tags)];
}

function renderReport(result) {
  const tagRows = Object.entries(result.tag_counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => `| \`${tag}\` | ${count} |`);
  const examples = result.rows
    .filter((row) => !row.supported)
    .slice(0, 8)
    .map((row) => `- \`${row.example_id}\` (${row.verdict}; ${row.tags.join(", ")}): ${escapeMarkdown(row.answer_preview)}`);

  return `# Support Failure Analysis

## Setup

- Prediction run: \`${result.prediction_run}\`
- Judge run: \`${result.judge_run}\`
- Split: \`${result.split}\`
- LLM calls: ${result.calls_made}
- Run cost: $${result.run_cost_usd.toFixed(7)}

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| ${result.examples} | ${result.supported_answers} | ${result.unsupported_answers} | ${pct(result.support_rate)} | ${result.counterfactual_unsupported_answers} |

## Failure Tags

| Tag | Count |
| --- | ---: |
${tagRows.join("\n")}

## Examples

${examples.join("\n")}

${result.interpretation.limitation}
`;
}

function isSupported(judgment) {
  return String(judgment?.verdict ?? "").toLowerCase() === "supported"
    && judgment?.all_claims_supported === true
    && judgment?.citation_ids_valid !== false;
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : citations,
  };
}

function contentTokens(value) {
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function counts(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function mean(values) {
  const numeric = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : 0;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function preview(value, length = 220) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function escapeMarkdown(value) {
  return String(value).replaceAll("|", "\\|");
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function requiredArg(name) {
  const value = args[name];
  if (!value) throw new Error(`Missing --${name}=...`);
  return value;
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
