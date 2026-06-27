import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "candidate-selector-cross-window-240-320-to-321-389-v1";
const outputDir = path.join(runsDir, runId);

const trainSpec = {
  id: "240-320",
  directRunId: "citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
  riskRunId: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  guardRunId: "claim-entailment-guard-balanced-risk-gate-240-389-v1",
  guardWindow: "241-320",
  directJudgeRunId: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
  riskJudgeRunId: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  guardJudgeRunId: "openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1",
};
const evalSpec = {
  id: "321-389",
  directRunId: "citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
  riskRunId: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  guardRunId: "claim-entailment-guard-balanced-risk-gate-240-389-v1",
  guardWindow: "321-389",
  directJudgeRunId: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
  riskJudgeRunId: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  guardJudgeRunId: "openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1",
};

const thresholdGrid = [0, 0.2, 0.3, 0.4, 0.5, 0.55, 0.6, 0.625, 0.65, 0.675, 0.7, 0.725, 0.75, 0.8, 0.85, 0.9, 0.95, 1.01];
const answerRateFloor = 0.7;

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const train = await loadSplit(trainSpec);
const evaluation = await loadSplit(evalSpec);
const candidates = [];

for (const threshold of thresholdGrid) {
  for (const useClaimGuard of [false, true]) {
    const trainRows = applyRule(train.rows, { threshold, useClaimGuard });
    const trainMetrics = summarize(trainRows);
    if (trainMetrics.answer_rate < answerRateFloor) continue;
    candidates.push({
      threshold,
      use_claim_guard: useClaimGuard,
      train_metrics: trainMetrics,
    });
  }
}

const selectedRule = candidates.sort(compareRules)[0] ?? {
  threshold: 0,
  use_claim_guard: false,
  train_metrics: summarize(applyRule(train.rows, { threshold: 0, useClaimGuard: false })),
};
const trainSelectedRows = applyRule(train.rows, { threshold: selectedRule.threshold, useClaimGuard: selectedRule.use_claim_guard });
const evalRows = applyRule(evaluation.rows, { threshold: selectedRule.threshold, useClaimGuard: selectedRule.use_claim_guard });
const directEvalRows = evaluation.rows.map((row) => chooseCandidate(row, "direct"));
const riskEvalRows = evaluation.rows.map((row) => chooseCandidate(row, "risk"));
const guardEvalRows = evaluation.rows.map((row) => chooseCandidate(row, "guard"));
const trainMetrics = summarize(trainSelectedRows);
const evalMetrics = summarize(evalRows);
const directEvalMetrics = summarize(directEvalRows);
const riskEvalMetrics = summarize(riskEvalRows);
const guardEvalMetrics = summarize(guardEvalRows);

const status = evalMetrics.answer_rate >= answerRateFloor && evalMetrics.answer_support_rate > directEvalMetrics.answer_support_rate
  ? "selector_transfers_under_coverage"
  : "selector_does_not_transfer_under_coverage";

const predictions = evalRows.map((row) => ({
  example_id: row.example_id,
  selected_policy: row.selected_policy,
  selected_reason: row.selected_reason,
  support_score: row.support_score,
  prediction: row.prediction,
  inherited_judgment: row.judgment,
  scores: {
    supported_answer: row.supported_answer,
    supported_abstention: row.supported_abstention,
    overall_correct: row.overall_correct,
  },
}));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "candidate_selector_cross_window",
  status,
  purpose: "Train a deployable no-LLM candidate-selection rule on one judged temporal window and evaluate it on the held-out final window without using final-window labels for selection.",
  train_split: describeSplit(trainSpec, train),
  eval_split: describeSplit(evalSpec, evaluation),
  search_space: {
    answer_rate_floor: answerRateFloor,
    thresholds: thresholdGrid,
    use_claim_guard_values: [false, true],
    selected_rule: {
      threshold: selectedRule.threshold,
      use_claim_guard: selectedRule.use_claim_guard,
    },
    selection_objective: "Among train rules with answer_rate >= 70%, maximize overall judged correctness, then answer support, then answer rate, then prefer lower thresholds.",
  },
  baselines_on_eval: {
    direct_mini_citation_repair: directEvalMetrics,
    balanced_support_risk_gate: riskEvalMetrics,
    claim_entailment_guard: guardEvalMetrics,
  },
  selected_rule_metrics: {
    train: trainMetrics,
    eval: evalMetrics,
  },
  result_interpretation: {
    supports_selection_as_final_amortized_scaffold: false,
    selection_only_still_insufficient: true,
    reason: status === "selector_transfers_under_coverage"
      ? "The learned rule modestly improves answer support while preserving the 70% answer-rate floor on held-out examples, but it is only a zero-call selector over direct-mini outputs and does not create new supported answers."
      : "The learned rule does not improve held-out answer support over direct citation-repaired mini while preserving the 70% answer-rate floor, so selection remains a weak substitute for repair/regeneration training.",
    qwen3b_implication: "Keep the Qwen 3B joint-action smoke focused on generating or repairing supported answers, not only choosing among current direct/gate/guard outputs.",
  },
  artifacts: {
    predictions_jsonl: path.relative(rootDir, path.join(outputDir, "predictions.jsonl")),
    report_md: path.relative(rootDir, path.join(outputDir, "report.md")),
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    external_compute_actual_usd: budget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This selector reuses existing predictions and already-paid judge artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "predictions.jsonl"), `${predictions.map((row) => JSON.stringify(row)).join("\n")}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_rule: result.search_space.selected_rule,
  eval: result.selected_rule_metrics.eval,
}, null, 2));

async function loadSplit(spec) {
  const directRows = byId(await readJsonl(path.join(runsDir, spec.directRunId, "predictions.jsonl")));
  const riskRows = byId(await readJsonl(path.join(runsDir, spec.riskRunId, "predictions.jsonl")));
  const guardRows = byId((await readJsonl(path.join(runsDir, spec.guardRunId, "predictions.jsonl"))).filter((row) => row.window === spec.guardWindow));
  const directJudgments = byId(await readJsonl(path.join(runsDir, spec.directJudgeRunId, "judgments.jsonl")));
  const riskJudgments = byId(await readJsonl(path.join(runsDir, spec.riskJudgeRunId, "judgments.jsonl")));
  const guardJudgments = byId((await readJsonl(path.join(runsDir, spec.guardJudgeRunId, "judgments.jsonl"))).filter((row) => guardRows.has(row.example_id)));
  const ids = [...directRows.keys()].filter((id) => riskRows.has(id) && guardRows.has(id));
  return {
    rows: ids.map((id) => ({
      example_id: id,
      support_score: Number(riskRows.get(id).metadata?.support_score),
      claim_guard_fired: guardRows.get(id).metadata?.claim_guard_fired === true,
      candidates: {
        direct: candidate("direct", directRows.get(id), directJudgments.get(id)),
        risk: candidate("risk", riskRows.get(id), riskJudgments.get(id)),
        guard: candidate("guard", guardRows.get(id), guardJudgments.get(id)),
      },
    })),
  };
}

function candidate(policy, predictionRow, judgmentRow) {
  return {
    policy,
    prediction: predictionRow.prediction,
    judgment: judgmentRow?.judgment ?? null,
  };
}

function applyRule(rows, rule) {
  return rows.map((row) => {
    if (row.candidates.direct.prediction?.answer_type !== "grounded_answer") {
      return chooseCandidate(row, "direct", "direct_already_abstains");
    }
    if (row.support_score >= rule.threshold) {
      return chooseCandidate(row, "direct", `support_score_${row.support_score.toFixed(3)}_gte_${rule.threshold}`);
    }
    if (rule.useClaimGuard) {
      return chooseCandidate(row, "guard", `support_score_${row.support_score.toFixed(3)}_lt_${rule.threshold}_claim_guard`);
    }
    return chooseCandidate(row, "risk", `support_score_${row.support_score.toFixed(3)}_lt_${rule.threshold}_risk_gate`);
  });
}

function chooseCandidate(row, policy, reason = policy) {
  const selected = row.candidates[policy];
  const answerType = selected.prediction?.answer_type;
  const supportedAnswer = answerType === "grounded_answer" && isSupportedAnswer(selected.judgment);
  const supportedAbstention = answerType === "abstain" && isSupportedAbstention(selected.judgment);
  return {
    example_id: row.example_id,
    support_score: row.support_score,
    selected_policy: policy,
    selected_reason: reason,
    prediction: selected.prediction,
    judgment: selected.judgment,
    supported_answer: supportedAnswer,
    supported_abstention: supportedAbstention,
    overall_correct: supportedAnswer || supportedAbstention,
  };
}

function summarize(rows) {
  const answered = rows.filter((row) => row.prediction?.answer_type === "grounded_answer");
  const abstained = rows.filter((row) => row.prediction?.answer_type === "abstain");
  const supportedAnswers = answered.filter((row) => row.supported_answer);
  const supportedAbstentions = abstained.filter((row) => row.supported_abstention);
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, rows.length),
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    abstention_support_rate: ratio(supportedAbstentions.length, abstained.length),
    overall_judged_correct_rate: ratio(supportedAnswers.length + supportedAbstentions.length, rows.length),
    unsupported_answers: answered.length - supportedAnswers.length,
    unsupported_abstentions: abstained.length - supportedAbstentions.length,
  };
}

function compareRules(a, b) {
  for (const key of ["overall_judged_correct_rate", "answer_support_rate", "answer_rate"]) {
    const delta = Number(b.train_metrics[key]) - Number(a.train_metrics[key]);
    if (Math.abs(delta) > 1e-12) return delta;
  }
  if (a.use_claim_guard !== b.use_claim_guard) return a.use_claim_guard ? 1 : -1;
  return a.threshold - b.threshold;
}

function describeSplit(spec, split) {
  return {
    id: spec.id,
    examples: split.rows.length,
    direct_run_id: spec.directRunId,
    risk_run_id: spec.riskRunId,
    guard_run_id: spec.guardRunId,
    direct_judge_run_id: spec.directJudgeRunId,
    risk_judge_run_id: spec.riskJudgeRunId,
    guard_judge_run_id: spec.guardJudgeRunId,
  };
}

function isSupportedAnswer(judgment) {
  const verdict = String(judgment?.verdict ?? "").toLowerCase();
  return verdict === "supported" || judgment?.all_claims_supported === true;
}

function isSupportedAbstention(judgment) {
  const verdict = String(judgment?.verdict ?? "").toLowerCase();
  return verdict === "correct_abstention" || verdict === "abstention_supported" || judgment?.abstention_supported === true;
}

function renderReport(result) {
  const baselineRows = Object.entries(result.baselines_on_eval)
    .map(([id, row]) => `| ${id} | ${pct(row.answer_rate)} | ${pct(row.answer_support_rate)} | ${pct(row.abstention_support_rate)} | ${pct(row.overall_judged_correct_rate)} |`)
    .join("\n");
  return `# Candidate Selector Cross-Window

Generated: ${result.generated_at}

Status: \`${result.status}\`

Selected rule: support score >= ${result.search_space.selected_rule.threshold} uses direct citation-repaired answer; otherwise uses ${result.search_space.selected_rule.use_claim_guard ? "claim guard" : "risk gate"}.

## Eval Baselines

| System | Answer rate | Answer support | Abstention support | Overall judged correct |
| --- | ---: | ---: | ---: | ---: |
${baselineRows}

## Selected Rule

| Split | Answer rate | Answer support | Abstention support | Overall judged correct | Answered | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| train ${result.train_split.id} | ${pct(result.selected_rule_metrics.train.answer_rate)} | ${pct(result.selected_rule_metrics.train.answer_support_rate)} | ${pct(result.selected_rule_metrics.train.abstention_support_rate)} | ${pct(result.selected_rule_metrics.train.overall_judged_correct_rate)} | ${result.selected_rule_metrics.train.answered} | ${result.selected_rule_metrics.train.unsupported_answers} |
| eval ${result.eval_split.id} | ${pct(result.selected_rule_metrics.eval.answer_rate)} | ${pct(result.selected_rule_metrics.eval.answer_support_rate)} | ${pct(result.selected_rule_metrics.eval.abstention_support_rate)} | ${pct(result.selected_rule_metrics.eval.overall_judged_correct_rate)} | ${result.selected_rule_metrics.eval.answered} | ${result.selected_rule_metrics.eval.unsupported_answers} |

## Interpretation

${result.result_interpretation.reason}

Qwen implication: ${result.result_interpretation.qwen3b_implication}

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function byId(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
