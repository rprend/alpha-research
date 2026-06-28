import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourceRunId = args["source-run"] ?? "contract-aware-candidate-selector-final-window-v1";
const runId = args["run-id"] ?? "calibrated-hybrid-selector-final-window-v1";
const qwenScoreThreshold = numericArg(args["qwen-score-threshold"], 0.6);
const qwenMinAnswerTokens = numericArg(args["qwen-min-answer-tokens"], 5);
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const sourceRows = await readJsonl(path.join(runsDir, sourceRunId, "rows.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const scaffoldRows = sourceRows.map(selectScaffoldPriority);
const hybridRows = sourceRows.map(selectHybrid);
const qwenOracleRows = sourceRows.map(selectQwenSwitchOracle);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "calibrated_hybrid_selector",
  status: statusFor(summarizeSelections(hybridRows)),
  source_run_id: sourceRunId,
  purpose: "Zero-call calibrated hybrid selector: preserve the scaffold-priority baseline unless a Qwen candidate clears strict independent contract and support-proxy margins.",
  policy: {
    base: "Start from claim_entailment_guard, then balanced_risk_gate, then direct_mini_repair.",
    qwen_switch: [
      "Only switch when the scaffold-priority candidate abstains.",
      "Do not switch on counterfactual/insufficient-evidence rows.",
      "Require a Qwen candidate with answer_type grounded_answer.",
      "Require valid top-level and inline answer citations.",
      `Require heuristic_score >= ${qwenScoreThreshold}.`,
      `Require at least ${qwenMinAnswerTokens} content tokens in the answer.`,
    ],
    rationale: "D230 showed unsupported Qwen answers should not displace supported scaffold answers; this policy only uses Qwen to recover answers from scaffold abstentions.",
  },
  examples: sourceRows.length,
  selection_metrics: {
    scaffold_priority: summarizeSelections(scaffoldRows),
    calibrated_hybrid: summarizeSelections(hybridRows),
    qwen_switch_oracle: summarizeSelections(qwenOracleRows),
  },
  switch_analysis: summarizeSwitches(hybridRows, scaffoldRows),
  gap_analysis: {
    hybrid_minus_scaffold_answer_rate: summarizeSelections(hybridRows).answer_rate - summarizeSelections(scaffoldRows).answer_rate,
    hybrid_minus_scaffold_answer_support_rate: summarizeSelections(hybridRows).answer_support_rate - summarizeSelections(scaffoldRows).answer_support_rate,
    hybrid_minus_scaffold_overall_correct_rate: summarizeSelections(hybridRows).overall_judged_correct_rate - summarizeSelections(scaffoldRows).overall_judged_correct_rate,
    qwen_oracle_minus_hybrid_supported_answers: supportedAnswerCount(qwenOracleRows) - supportedAnswerCount(hybridRows),
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

await writeJsonl(path.join(outputDir, "predictions.jsonl"), hybridRows);
await writeJsonl(path.join(outputDir, "scaffold_predictions.jsonl"), scaffoldRows);
await writeJsonl(path.join(outputDir, "qwen_switch_oracle_predictions.jsonl"), qwenOracleRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selection_metrics: result.selection_metrics,
  switch_analysis: result.switch_analysis,
  gap_analysis: result.gap_analysis,
}, null, 2));

function selectHybrid(row) {
  const base = scaffoldPriorityCandidate(row);
  if (base?.prediction?.answer_type === "grounded_answer") return selectionRow(row, base, "calibrated_hybrid_selector", "keep_scaffold_answer", []);
  const reasons = [];
  if (row.counterfactual) reasons.push("counterfactual_row");
  const qwenCandidates = row.candidates
    .filter((candidate) => candidate.family?.startsWith("qwen"))
    .filter((candidate) => candidate.prediction?.answer_type === "grounded_answer")
    .filter((candidate) => candidate.contract?.answer_citation_complete === true)
    .filter((candidate) => !row.counterfactual)
    .filter((candidate) => Number(candidate.heuristic_score ?? -Infinity) >= qwenScoreThreshold)
    .filter((candidate) => contentTokens(candidate.prediction.answer).length >= qwenMinAnswerTokens)
    .sort((a, b) => Number(b.heuristic_score ?? 0) - Number(a.heuristic_score ?? 0) || a.id.localeCompare(b.id));
  if (!qwenCandidates.length) return selectionRow(row, base, "calibrated_hybrid_selector", "keep_scaffold_abstention", reasons.length ? reasons : ["no_qwen_candidate_cleared_margin"]);
  return selectionRow(row, qwenCandidates[0], "calibrated_hybrid_selector", "switch_scaffold_abstention_to_qwen_answer", ["qwen_candidate_cleared_margin"]);
}

function selectQwenSwitchOracle(row) {
  const base = scaffoldPriorityCandidate(row);
  if (base?.prediction?.answer_type === "grounded_answer") return selectionRow(row, base, "qwen_switch_oracle", "keep_scaffold_answer", []);
  const supportedQwen = row.candidates
    .filter((candidate) => candidate.family?.startsWith("qwen"))
    .filter((candidate) => candidate.prediction?.answer_type === "grounded_answer")
    .filter((candidate) => candidate.contract?.answer_citation_complete === true)
    .filter((candidate) => candidate.supported_answer === true)
    .filter((candidate) => !row.counterfactual)
    .sort((a, b) => Number(b.heuristic_score ?? 0) - Number(a.heuristic_score ?? 0) || a.id.localeCompare(b.id));
  return selectionRow(row, supportedQwen[0] ?? base, "qwen_switch_oracle", supportedQwen[0] ? "oracle_switch_scaffold_abstention_to_qwen_answer" : "keep_scaffold_abstention", []);
}

function selectScaffoldPriority(row) {
  return selectionRow(row, scaffoldPriorityCandidate(row), "scaffold_priority_selector", "scaffold_priority", []);
}

function scaffoldPriorityCandidate(row) {
  return ["claim_entailment_guard", "balanced_risk_gate", "direct_mini_repair"]
    .map((id) => row.candidates.find((candidate) => candidate.id === id))
    .find(Boolean)
    ?? row.candidates[0];
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
    candidate_summary: Object.fromEntries(row.candidates.map((candidate) => [candidate.id, {
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

function summarizeSwitches(hybridRows, scaffoldRows) {
  const scaffoldById = new Map(scaffoldRows.map((row) => [row.example_id, row]));
  const switched = hybridRows.filter((row) => row.selected_candidate_id !== scaffoldById.get(row.example_id)?.selected_candidate_id);
  return {
    switches: switched.length,
    supported_qwen_switches: switched.filter((row) => row.selection_scores.supported_answer).length,
    unsupported_qwen_switches: switched.filter((row) => row.prediction?.answer_type === "grounded_answer" && !row.selection_scores.supported_answer).length,
    harmful_switches_from_correct_abstention: switched.filter((row) => scaffoldById.get(row.example_id)?.selection_scores.supported_abstention && !row.selection_scores.supported_answer).length,
    switch_ids: switched.map((row) => row.example_id),
  };
}

function statusFor(metrics) {
  if (metrics.answer_rate >= 0.7 && metrics.answer_support_rate >= 0.66 && metrics.overall_judged_correct_rate >= 0.75) {
    return "hybrid_selector_minimum_positive_not_amortized";
  }
  if (metrics.answer_rate >= 0.7 && metrics.answer_support_rate >= 0.66) return "hybrid_selector_support_positive_correctness_shortfall";
  if (metrics.answer_support_rate > 0.66) return "hybrid_selector_support_positive_coverage_shortfall";
  return "hybrid_selector_negative";
}

function supportedAnswerCount(rows) {
  return rows.filter((row) => row.prediction?.answer_type === "grounded_answer" && row.selection_scores.supported_answer).length;
}

function renderReport(result) {
  const metrics = result.selection_metrics;
  return `# Calibrated Hybrid Selector

Generated: ${result.generated_at}

## Metrics

| Surface | Answer rate | Answer support | Overall correct | Supported answers |
| --- | ---: | ---: | ---: | ---: |
| Scaffold priority | ${pct(metrics.scaffold_priority.answer_rate)} | ${pct(metrics.scaffold_priority.answer_support_rate)} | ${pct(metrics.scaffold_priority.overall_judged_correct_rate)} | ${metrics.scaffold_priority.supported_answers} |
| Calibrated hybrid | ${pct(metrics.calibrated_hybrid.answer_rate)} | ${pct(metrics.calibrated_hybrid.answer_support_rate)} | ${pct(metrics.calibrated_hybrid.overall_judged_correct_rate)} | ${metrics.calibrated_hybrid.supported_answers} |
| Qwen switch oracle | ${pct(metrics.qwen_switch_oracle.answer_rate)} | ${pct(metrics.qwen_switch_oracle.answer_support_rate)} | ${pct(metrics.qwen_switch_oracle.overall_judged_correct_rate)} | ${metrics.qwen_switch_oracle.supported_answers} |

## Switches

| Switches | Supported Qwen switches | Unsupported Qwen switches | Harmful switches from correct abstention |
| ---: | ---: | ---: | ---: |
| ${result.switch_analysis.switches} | ${result.switch_analysis.supported_qwen_switches} | ${result.switch_analysis.unsupported_qwen_switches} | ${result.switch_analysis.harmful_switches_from_correct_abstention} |

Status: \`${result.status}\`

This artifact makes no LLM calls and launches no compute. It is not a final amortized result because the candidate pool still includes OpenAI-mini scaffold candidates.
`;
}

function contentTokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
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
