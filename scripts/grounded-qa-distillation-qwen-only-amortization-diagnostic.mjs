import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourceRunId = args["source-run"] ?? "contract-aware-candidate-selector-final-window-v1";
const runId = args["run-id"] ?? "qwen-only-amortization-diagnostic-final-window-v1";
const qwenScoreThreshold = numericArg(args["qwen-score-threshold"], 0.6);
const qwenMinAnswerTokens = numericArg(args["qwen-min-answer-tokens"], 5);
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const sourceRows = await readJsonl(path.join(runsDir, sourceRunId, "rows.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const heuristicRows = sourceRows.map(selectQwenHeuristic);
const oracleRows = sourceRows.map(selectQwenOracle);
const highPrecisionRows = sourceRows.map((row) => selectQwenThreshold(row, 0.7, 5, "qwen_high_precision_threshold", "qwen_high_precision"));
const thresholdSweep = buildThresholdSweep(sourceRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen_only_amortization_diagnostic",
  status: statusFor(summarizeSelections(heuristicRows), summarizeSelections(oracleRows)),
  source_run_id: sourceRunId,
  purpose: "Zero-call diagnostic for whether the final-window threshold-clearing result survives when OpenAI-mini scaffold candidates are removed from the deployable candidate set.",
  policy: {
    qwen_only_candidate_set: "Only candidates whose family starts with qwen are selectable.",
    heuristic_selector: [
      "Do not answer counterfactual rows.",
      "Choose the highest-heuristic Qwen grounded answer with valid top-level and inline citations.",
      `Require heuristic_score >= ${qwenScoreThreshold}.`,
      `Require at least ${qwenMinAnswerTokens} content tokens in the answer.`,
      "Fallback to the highest-heuristic Qwen abstention when no answer clears the threshold.",
    ],
    oracle_selector: [
      "Upper bound that may use inherited judgments.",
      "Choose a supported, answer-citation-complete Qwen answer for non-counterfactual rows when one exists.",
      "Otherwise choose a supported Qwen abstention when one exists.",
      "This is an evaluation ceiling, not a deployable selector.",
    ],
  },
  examples: sourceRows.length,
  selection_metrics: {
    qwen_heuristic: summarizeSelections(heuristicRows),
    qwen_high_precision: summarizeSelections(highPrecisionRows),
    qwen_judged_oracle: summarizeSelections(oracleRows),
  },
  candidate_pool: summarizeQwenPool(sourceRows),
  threshold_sweep: thresholdSweep,
  gap_analysis: {
    oracle_minus_heuristic_supported_answers: supportedAnswerCount(oracleRows) - supportedAnswerCount(heuristicRows),
    oracle_minus_heuristic_answer_rate: summarizeSelections(oracleRows).answer_rate - summarizeSelections(heuristicRows).answer_rate,
    oracle_answer_rate_shortfall_to_70pct: 0.7 - summarizeSelections(oracleRows).answer_rate,
    heuristic_answer_support_shortfall_to_66pct: 0.66 - summarizeSelections(heuristicRows).answer_support_rate,
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), heuristicRows);
await writeJsonl(path.join(outputDir, "qwen_high_precision_predictions.jsonl"), highPrecisionRows);
await writeJsonl(path.join(outputDir, "qwen_judged_oracle_predictions.jsonl"), oracleRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selection_metrics: result.selection_metrics,
  candidate_pool: result.candidate_pool,
  gap_analysis: result.gap_analysis,
}, null, 2));

function selectQwenHeuristic(row) {
  return selectQwenThreshold(row, qwenScoreThreshold, qwenMinAnswerTokens, "qwen_only_heuristic_selector", "qwen_threshold_answer_else_abstain");
}

function selectQwenThreshold(row, threshold, minTokens, selectorType, decisionPrefix) {
  const qwenCandidates = qwenCandidateSet(row);
  const answerCandidates = qwenCandidates
    .filter((candidate) => candidate.prediction?.answer_type === "grounded_answer")
    .filter((candidate) => candidate.contract?.answer_citation_complete === true)
    .filter((candidate) => !row.counterfactual)
    .filter((candidate) => Number(candidate.heuristic_score ?? -Infinity) >= threshold)
    .filter((candidate) => contentTokens(candidate.prediction.answer).length >= minTokens)
    .sort(compareByHeuristic);
  if (answerCandidates.length) {
    return selectionRow(row, answerCandidates[0], selectorType, `${decisionPrefix}_answer`, ["qwen_answer_cleared_threshold"]);
  }
  return selectionRow(row, fallbackQwenAbstention(row, qwenCandidates), selectorType, `${decisionPrefix}_abstain`, row.counterfactual ? ["counterfactual_row"] : ["no_qwen_answer_cleared_threshold"]);
}

function selectQwenOracle(row) {
  const qwenCandidates = qwenCandidateSet(row);
  const supportedAnswers = qwenCandidates
    .filter((candidate) => candidate.prediction?.answer_type === "grounded_answer")
    .filter((candidate) => candidate.contract?.answer_citation_complete === true)
    .filter((candidate) => candidate.supported_answer === true)
    .filter((candidate) => !row.counterfactual)
    .sort(compareByHeuristic);
  if (supportedAnswers.length) {
    return selectionRow(row, supportedAnswers[0], "qwen_judged_oracle", "oracle_supported_qwen_answer", []);
  }
  const supportedAbstentions = qwenCandidates
    .filter((candidate) => candidate.prediction?.answer_type === "abstain")
    .filter((candidate) => candidate.supported_abstention === true)
    .sort(compareByHeuristic);
  if (supportedAbstentions.length) {
    return selectionRow(row, supportedAbstentions[0], "qwen_judged_oracle", "oracle_supported_qwen_abstention", []);
  }
  return selectionRow(row, fallbackQwenAbstention(row, qwenCandidates), "qwen_judged_oracle", "oracle_no_supported_qwen_candidate", ["no_supported_qwen_candidate"]);
}

function fallbackQwenAbstention(row, qwenCandidates) {
  return qwenCandidates
    .filter((candidate) => candidate.prediction?.answer_type === "abstain")
    .sort(compareByHeuristic)[0]
    ?? qwenCandidates.sort(compareByHeuristic)[0]
    ?? null;
}

function qwenCandidateSet(row) {
  return row.candidates.filter((candidate) => candidate.family?.startsWith("qwen"));
}

function selectionRow(row, selected, selectorType, decision, reasons) {
  return {
    example_id: row.example_id,
    selector_type: selectorType,
    selected_candidate_id: selected?.id ?? null,
    selected_family: selected?.family ?? null,
    selection_decision: decision,
    selection_reasons: reasons,
    prediction: selected?.prediction ?? null,
    reference: row.reference,
    inherited_judgment: selected?.judgment ?? null,
    selection_scores: {
      supported_answer: selected?.supported_answer ?? false,
      supported_abstention: selected?.supported_abstention ?? false,
      judged_correct: selected?.supported_answer === true || selected?.supported_abstention === true,
      answer_type_correct: selected?.answer_type_correct ?? false,
      answer_citation_complete: selected?.contract?.answer_citation_complete ?? false,
      heuristic_score: selected?.heuristic_score ?? null,
    },
    qwen_candidate_summary: Object.fromEntries(qwenCandidateSet(row).map((candidate) => [candidate.id, {
      family: candidate.family,
      answered: candidate.answered,
      supported_answer: candidate.supported_answer,
      supported_abstention: candidate.supported_abstention,
      judged_correct: candidate.judged_correct,
      answer_citation_complete: candidate.contract?.answer_citation_complete ?? false,
      heuristic_score: candidate.heuristic_score,
    }])),
  };
}

function summarizeQwenPool(rows) {
  return {
    examples: rows.length,
    rows_with_qwen_candidate: rows.filter((row) => qwenCandidateSet(row).length > 0).length,
    rows_with_qwen_grounded_answer: rows.filter((row) => qwenCandidateSet(row).some((candidate) => candidate.prediction?.answer_type === "grounded_answer")).length,
    rows_with_qwen_answer_citation_complete_answer: rows.filter((row) => qwenCandidateSet(row).some((candidate) => candidate.prediction?.answer_type === "grounded_answer" && candidate.contract?.answer_citation_complete === true)).length,
    rows_with_non_counterfactual_supported_qwen_answer: rows.filter((row) => !row.counterfactual && qwenCandidateSet(row).some((candidate) => candidate.prediction?.answer_type === "grounded_answer" && candidate.contract?.answer_citation_complete === true && candidate.supported_answer === true)).length,
    rows_with_supported_qwen_abstention: rows.filter((row) => qwenCandidateSet(row).some((candidate) => candidate.prediction?.answer_type === "abstain" && candidate.supported_abstention === true)).length,
    candidate_family_mix: groupCount(rows.flatMap((row) => qwenCandidateSet(row).map((candidate) => candidate.family))),
    candidate_id_mix: groupCount(rows.flatMap((row) => qwenCandidateSet(row).map((candidate) => candidate.id))),
  };
}

function buildThresholdSweep(rows) {
  const sweep = [];
  for (const threshold of [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75]) {
    for (const minTokens of [1, 5, 10]) {
      const selected = rows.map((row) => selectQwenThreshold(row, threshold, minTokens, "qwen_threshold_sweep", "sweep"));
      sweep.push({
        threshold,
        min_answer_tokens: minTokens,
        ...summarizeSelections(selected),
      });
    }
  }
  return sweep;
}

function summarizeSelections(rows) {
  const answered = rows.filter((row) => row.prediction?.answer_type === "grounded_answer");
  const abstained = rows.filter((row) => row.prediction?.answer_type === "abstain");
  const supportedAnswers = answered.filter((row) => row.selection_scores.supported_answer);
  const supportedAbstentions = abstained.filter((row) => row.selection_scores.supported_abstention);
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, rows.length),
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    abstention_support_rate: ratio(supportedAbstentions.length, abstained.length),
    overall_judged_correct_rate: ratio(supportedAnswers.length + supportedAbstentions.length, rows.length),
    answer_type_accuracy: ratio(rows.filter((row) => row.selection_scores.answer_type_correct).length, rows.length),
    answer_citation_complete_rate: ratio(answered.filter((row) => row.selection_scores.answer_citation_complete).length, answered.length),
    supported_answers: supportedAnswers.length,
    supported_abstentions: supportedAbstentions.length,
    policy_mix: groupCount(rows.map((row) => row.selected_candidate_id ?? "missing")),
    family_mix: groupCount(rows.map((row) => row.selected_family ?? "missing")),
  };
}

function statusFor(heuristicMetrics, oracleMetrics) {
  if (heuristicMetrics.answer_rate >= 0.7 && heuristicMetrics.answer_support_rate >= 0.66 && heuristicMetrics.overall_judged_correct_rate >= 0.75) {
    return "qwen_only_selector_minimum_positive";
  }
  if (oracleMetrics.answer_rate < 0.7) return "qwen_only_oracle_coverage_shortfall";
  if (heuristicMetrics.answer_support_rate < 0.66) return "qwen_only_selector_support_shortfall";
  return "qwen_only_selector_coverage_shortfall";
}

function supportedAnswerCount(rows) {
  return rows.filter((row) => row.prediction?.answer_type === "grounded_answer" && row.selection_scores.supported_answer).length;
}

function renderReport(result) {
  const metrics = result.selection_metrics;
  return `# Qwen-Only Amortization Diagnostic

Generated: ${result.generated_at}

## Metrics

| Surface | Answer rate | Answer support | Overall correct | Supported answers |
| --- | ---: | ---: | ---: | ---: |
| Qwen heuristic | ${pct(metrics.qwen_heuristic.answer_rate)} | ${pct(metrics.qwen_heuristic.answer_support_rate)} | ${pct(metrics.qwen_heuristic.overall_judged_correct_rate)} | ${metrics.qwen_heuristic.supported_answers} |
| Qwen high precision | ${pct(metrics.qwen_high_precision.answer_rate)} | ${pct(metrics.qwen_high_precision.answer_support_rate)} | ${pct(metrics.qwen_high_precision.overall_judged_correct_rate)} | ${metrics.qwen_high_precision.supported_answers} |
| Qwen judged oracle | ${pct(metrics.qwen_judged_oracle.answer_rate)} | ${pct(metrics.qwen_judged_oracle.answer_support_rate)} | ${pct(metrics.qwen_judged_oracle.overall_judged_correct_rate)} | ${metrics.qwen_judged_oracle.supported_answers} |

## Candidate Pool

Rows with non-counterfactual supported Qwen answers: ${result.candidate_pool.rows_with_non_counterfactual_supported_qwen_answer}/${result.examples}

Rows with supported Qwen abstentions: ${result.candidate_pool.rows_with_supported_qwen_abstention}/${result.examples}

Status: \`${result.status}\`

This artifact makes no LLM calls and launches no compute. It is an amortization diagnostic because OpenAI-mini scaffold candidates are removed from the selectable deployment pool.
`;
}

function contentTokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function compareByHeuristic(a, b) {
  return Number(b.heuristic_score ?? 0) - Number(a.heuristic_score ?? 0) || a.id.localeCompare(b.id);
}

function groupCount(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function numericArg(value, fallback) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric argument: ${value}`);
  return parsed;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
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
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
