import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const baselineSmokeRunId = args["baseline-smoke-run-id"] ?? "targeted-grounded-construction-dpo-prompt-repaired-qwen3b-smoke-v1";
const baselineNormRunId = args["baseline-normalization-run-id"] ?? "targeted-grounded-schema-normalization-audit-dpo-prompt-repaired-qwen3b-smoke-v1";
const numericSmokeRunId = args["numeric-smoke-run-id"] ?? "numeric-teacher-candidate-qwen3b-smoke-v1";
const numericNormRunId = args["numeric-normalization-run-id"] ?? "targeted-grounded-schema-normalization-audit-numeric-teacher-qwen3b-smoke-v1";
const runId = args["run-id"] ?? "numeric-teacher-smoke-postmortem-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const baselineSmoke = await readJson(path.join(runsDir, baselineSmokeRunId, "result.json"));
const numericSmoke = await readJson(path.join(runsDir, numericSmokeRunId, "result.json"));
const baselineNorm = await readJson(path.join(runsDir, baselineNormRunId, "result.json"));
const numericNorm = await readJson(path.join(runsDir, numericNormRunId, "result.json"));
const baselineScored = await readJsonl(path.join(runsDir, baselineNormRunId, "scored_predictions.jsonl"));
const numericScored = await readJsonl(path.join(runsDir, numericNormRunId, "scored_predictions.jsonl"));
const baselinePredictions = await readJsonl(path.join(runsDir, baselineSmokeRunId, "predictions.jsonl"));
const numericPredictions = await readJsonl(path.join(runsDir, numericSmokeRunId, "predictions.jsonl"));

const baselineById = new Map(baselineScored.map((row) => [row.example_id, row]));
const numericById = new Map(numericScored.map((row) => [row.example_id, row]));
const baselinePredictionById = new Map(baselinePredictions.map((row) => [row.example_id, row]));
const numericPredictionById = new Map(numericPredictions.map((row) => [row.example_id, row]));
const exampleIds = [...numericById.keys()];
const rows = exampleIds.map(compareExample);
const summary = summarize(rows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "numeric_teacher_smoke_postmortem",
  status: statusFor(summary),
  purpose: "Diagnose why the numeric-teacher Qwen 3B smoke failed the evidence-first contract and compare it against the stronger DPO-prompt-repaired diagnostic baseline.",
  source_runs: {
    baseline_smoke: baselineSmokeRunId,
    baseline_normalization: baselineNormRunId,
    numeric_smoke: numericSmokeRunId,
    numeric_normalization: numericNormRunId,
  },
  summary,
  baseline_metrics: {
    raw_eval: baselineSmoke.eval,
    normalized: baselineNorm.metrics,
  },
  numeric_metrics: {
    raw_eval: numericSmoke.eval,
    normalized: numericNorm.metrics,
  },
  conclusion: conclusionFor(summary),
  budget: {
    max_budget_usd: Number(budget.max_budget_usd),
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual),
    remaining_budget_usd: Number(budget.spend_usd?.remaining),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "This postmortem compares existing local prediction and normalization artifacts only.",
  },
  artifacts: {
    rows_jsonl: rel(path.join(outputDir, "rows.jsonl")),
    failures_jsonl: rel(path.join(outputDir, "failures.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "rows.jsonl"), rows);
await writeJsonl(path.join(outputDir, "failures.jsonl"), rows.filter((row) => !row.numeric.normalized_contract_correct));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  summary: result.summary,
  conclusion: result.conclusion,
  llm_budget: result.llm_budget,
}, null, 2));

function compareExample(exampleId) {
  const baseline = baselineById.get(exampleId);
  const numeric = numericById.get(exampleId);
  const baselineRaw = baselinePredictionById.get(exampleId);
  const numericRaw = numericPredictionById.get(exampleId);
  const target = numeric?.target ?? baseline?.target ?? {};
  const baselineCorrect = Boolean(baseline?.normalized_contract?.contract_correct);
  const numericCorrect = Boolean(numeric?.normalized_contract?.contract_correct);
  const rawAnswerType = numericRaw?.raw_output ? rawAnswerTypeFromRaw(numericRaw.raw_output) : null;
  const rawEf = numericRaw?.prediction?.evidence_first;
  const rawTopLevelCitations = normalizeCitations(numericRaw?.prediction?.citations);
  const normalizedErrors = numeric?.normalized_contract?.evidence_first_errors ?? [];
  return {
    example_id: exampleId,
    target_answer_type: target.answer_type ?? null,
    bucket: bucketFor(baselineCorrect, numericCorrect),
    baseline: {
      normalized_contract_correct: baselineCorrect,
      answer_type_correct: baseline?.normalized_contract?.answer_type_correct === true,
      citation_set_exact: baseline?.normalized_contract?.citation_set_exact === true,
      evidence_first_valid: baseline?.normalized_contract?.evidence_first_valid === true,
    },
    numeric: {
      raw_answer_type: numericRaw?.prediction?.answer_type ?? null,
      raw_answer_type_literal: rawAnswerType,
      normalized_answer_type: numeric?.normalized_prediction?.answer_type ?? null,
      normalized_contract_correct: numericCorrect,
      answer_type_correct: numeric?.normalized_contract?.answer_type_correct === true,
      citation_set_exact: numeric?.normalized_contract?.citation_set_exact === true,
      evidence_first_valid: numeric?.normalized_contract?.evidence_first_valid === true,
      evidence_first_errors: normalizedErrors,
      raw_parse_error: numericRaw?.parse_error ?? null,
      raw_answer_preview: preview(numericRaw?.prediction?.answer),
      raw_citations: rawTopLevelCitations,
    },
    tags: tagsFor({ target, numericRaw, rawAnswerType, rawEf, rawTopLevelCitations, numeric }),
  };
}

function bucketFor(baselineCorrect, numericCorrect) {
  if (baselineCorrect && numericCorrect) return "both_contract_correct";
  if (!baselineCorrect && numericCorrect) return "numeric_recovery";
  if (baselineCorrect && !numericCorrect) return "numeric_regression_from_baseline";
  return "both_wrong";
}

function tagsFor({ target, numericRaw, rawAnswerType, rawEf, rawTopLevelCitations, numeric }) {
  const tags = new Set();
  const prediction = numericRaw?.prediction ?? {};
  if (rawAnswerType && !["grounded_answer", "abstain"].includes(rawAnswerType)) tags.add("invalid_answer_type_alias");
  if (target?.answer_type === "abstain" && prediction.answer_type === "grounded_answer") tags.add("over_answered_insufficient_evidence");
  if (target?.answer_type === "grounded_answer" && prediction.answer_type === "abstain") tags.add("false_abstention");
  if (prediction.answer_type === "abstain" && rawTopLevelCitations.length) tags.add("abstention_has_citations");
  if (prediction.answer_type === "abstain" && Array.isArray(rawEf?.citations) && rawEf.citations.length) tags.add("abstention_evidence_first_has_citations");
  if (prediction.answer_type === "grounded_answer" && (!rawEf || typeof rawEf !== "object" || Array.isArray(rawEf) || rawEf === true)) tags.add("grounded_missing_object_evidence_first");
  if (prediction.answer_type === "grounded_answer" && Array.isArray(rawEf?.supported_claims) && rawEf.supported_claims.length && !rawTopLevelCitations.length) tags.add("claims_without_top_level_citations");
  if (numeric?.normalized_contract?.answer_type_correct !== true) tags.add("answerability_error_survives_normalization");
  if (numeric?.normalized_contract?.citation_set_exact !== true) tags.add("citation_selection_error_survives_normalization");
  if (numeric?.normalized_contract?.evidence_first_valid !== true) tags.add("evidence_first_error_survives_normalization");
  return [...tags].sort();
}

function summarize(rows) {
  const baselineCorrect = rows.filter((row) => row.baseline.normalized_contract_correct).length;
  const numericCorrect = rows.filter((row) => row.numeric.normalized_contract_correct).length;
  return {
    examples: rows.length,
    baseline_normalized_contract_correct: baselineCorrect,
    numeric_normalized_contract_correct: numericCorrect,
    delta_numeric_minus_baseline: numericCorrect - baselineCorrect,
    both_contract_correct: rows.filter((row) => row.bucket === "both_contract_correct").length,
    numeric_recoveries: rows.filter((row) => row.bucket === "numeric_recovery").length,
    numeric_regressions_from_baseline: rows.filter((row) => row.bucket === "numeric_regression_from_baseline").length,
    both_wrong: rows.filter((row) => row.bucket === "both_wrong").length,
    bucket_counts: countBy(rows, (row) => row.bucket),
    tag_counts: countTags(rows.flatMap((row) => row.tags)),
    target_answer_type_counts: countBy(rows, (row) => row.target_answer_type),
  };
}

function statusFor(summary) {
  if (summary.numeric_normalized_contract_correct <= 4 && summary.delta_numeric_minus_baseline < 0) return "numeric_teacher_smoke_regresses_diagnostic_baseline";
  if (summary.delta_numeric_minus_baseline > 0) return "numeric_teacher_smoke_improves_diagnostic_baseline";
  return "numeric_teacher_smoke_ties_diagnostic_baseline";
}

function conclusionFor(summary) {
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    keep_numeric_teacher_packet_for_qwen3b: false,
    try_constrained_scaffold_before_more_gpu: true,
    next_step: "Stop Qwen 3B SFT/DPO launches for this numeric-teacher packet. Prototype a deterministic constrained output scaffold or a stronger student on a tiny diagnostic surface before spending more GPU or OpenAI judge budget.",
    reason: `After deterministic normalization the numeric-teacher smoke gets ${summary.numeric_normalized_contract_correct}/${summary.examples} contract-correct rows, ${summary.delta_numeric_minus_baseline} versus the DPO-prompt-repaired baseline, with persistent answerability/citation errors rather than only schema errors.`,
  };
}

function renderReport(result) {
  const bucketRows = tableRows(result.summary.bucket_counts);
  const tagRows = tableRows(result.summary.tag_counts);
  return `# Numeric Teacher Smoke Postmortem

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls and launches no compute.

## Summary

| Metric | Count |
| --- | ---: |
| Examples | ${result.summary.examples} |
| Baseline normalized correct | ${result.summary.baseline_normalized_contract_correct} |
| Numeric normalized correct | ${result.summary.numeric_normalized_contract_correct} |
| Numeric - baseline | ${result.summary.delta_numeric_minus_baseline} |
| Numeric recoveries | ${result.summary.numeric_recoveries} |
| Numeric regressions from baseline | ${result.summary.numeric_regressions_from_baseline} |

## Buckets

| Bucket | Count |
| --- | ---: |
${bucketRows}

## Tags

| Tag | Count |
| --- | ---: |
${tagRows || "| none | 0 |"}

## Conclusion

- Launch Prime now: ${result.conclusion.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.conclusion.buy_openai_judgments_now ? "yes" : "no"}
- Keep numeric teacher packet for Qwen 3B: ${result.conclusion.keep_numeric_teacher_packet_for_qwen3b ? "yes" : "no"}
- Try constrained scaffold before more GPU: ${result.conclusion.try_constrained_scaffold_before_more_gpu ? "yes" : "no"}
- Reason: ${result.conclusion.reason}
- Next step: ${result.conclusion.next_step}
`;
}

function rawAnswerTypeFromRaw(rawOutput) {
  try {
    const parsed = JSON.parse(rawOutput);
    return parsed?.answer_type ?? null;
  } catch {
    return null;
  }
}

function tableRows(counts) {
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key, count]) => `| \`${key}\` | ${count} |`)
    .join("\n");
}

function countBy(rows, fn) {
  const counts = {};
  for (const row of rows) {
    const key = fn(row) ?? "missing";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function countTags(tags) {
  const counts = {};
  for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return counts;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation).replace(/^\[/, "").replace(/\]$/, "")).filter(Boolean);
}

function preview(value, length = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
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
