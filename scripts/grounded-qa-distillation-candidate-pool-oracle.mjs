import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "candidate-pool-oracle-final-window-2026-06-27-v1";
const outputDir = path.join(runsDir, runId);

const policies = [
  {
    id: "direct_mini_citation_repair",
    predictionRunId: "citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
    judgeRunId: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
  },
  {
    id: "balanced_support_risk_gate",
    predictionRunId: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    judgeRunId: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  },
  {
    id: "claim_entailment_guard",
    predictionRunId: "claim-entailment-guard-balanced-risk-gate-240-389-v1",
    judgeRunId: "openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1",
  },
];

await fs.mkdir(outputDir, { recursive: true });

const loaded = [];
for (const policy of policies) {
  const predictions = await readJsonl(path.join(runsDir, policy.predictionRunId, "predictions.jsonl"));
  const judgments = new Map((await readJsonl(path.join(runsDir, policy.judgeRunId, "judgments.jsonl"))).map((row) => [row.example_id, row]));
  loaded.push({
    ...policy,
    rows: predictions
      .map((predictionRow) => ({ predictionRow, judgmentRow: judgments.get(predictionRow.example_id) }))
      .filter((row) => row.judgmentRow)
      .map((row) => candidate(policy, row.predictionRow, row.judgmentRow)),
  });
}

const finalIds = new Set(loaded[0].rows.map((row) => row.example_id));
const byExample = new Map([...finalIds].map((id) => [id, []]));
for (const policy of loaded) {
  for (const row of policy.rows) {
    if (!finalIds.has(row.example_id)) continue;
    byExample.get(row.example_id).push(row);
  }
}

const examples = [...byExample.entries()].map(([exampleId, candidates]) => {
  const supportedAnswers = candidates.filter((row) => row.answer_type === "grounded_answer" && row.supported_answer);
  const correctAbstentions = candidates.filter((row) => row.answer_type === "abstain" && row.supported_abstention);
  const selected = supportedAnswers[0] ?? correctAbstentions[0] ?? candidates[0];
  return {
    example_id: exampleId,
    selected_policy: selected.policy_id,
    selected_action: selected.answer_type,
    selected_supported: selected.answer_type === "grounded_answer" ? selected.supported_answer : selected.supported_abstention,
    has_supported_answer_candidate: supportedAnswers.length > 0,
    has_correct_abstention_candidate: correctAbstentions.length > 0,
    answered_candidates: candidates.filter((row) => row.answer_type === "grounded_answer").length,
    supported_answer_candidates: supportedAnswers.length,
    candidates: candidates.map((row) => ({
      policy_id: row.policy_id,
      answer_type: row.answer_type,
      verdict: row.verdict,
      supported_answer: row.supported_answer,
      supported_abstention: row.supported_abstention,
    })),
  };
});

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "candidate_pool_oracle",
  status: "current_candidate_pool_insufficient_for_support_preserving_coverage",
  purpose: "Estimate whether the already-judged final-window candidate pool can satisfy the paper's support-preserving 70% coverage target by selection alone, without new model calls or GPU training.",
  scope: {
    split: "extended_temporal_future_holdout",
    final_window: "320-389",
    examples: examples.length,
    policies: policies.map(({ id, predictionRunId, judgeRunId }) => ({ id, predictionRunId, judgeRunId })),
  },
  policy_metrics: Object.fromEntries(loaded.map((policy) => [policy.id, summarize(policy.rows.filter((row) => finalIds.has(row.example_id)))])),
  oracle: summarizeOracle(examples),
  training_implication: {
    selection_only_sufficient: false,
    reason: "The candidate pool mostly contains the direct answer and abstention variants of that answer. Selection can suppress unsupported answers, but it cannot create supported answers for examples where no supported answer candidate exists.",
    next_data_change: "Keep Qwen 3B joint-action training focused on repair/regeneration versus abstention, not only policy selection among existing direct/gate outputs.",
    qwen_acceptance_boundary: "The final trained student must beat the direct baseline support/correctness while keeping answer rate >= 70%; an oracle over current candidates is a negative upper-bound for selection-only approaches.",
  },
  examples: examples.map((row) => ({
    example_id: row.example_id,
    selected_policy: row.selected_policy,
    selected_action: row.selected_action,
    selected_supported: row.selected_supported,
    has_supported_answer_candidate: row.has_supported_answer_candidate,
    has_correct_abstention_candidate: row.has_correct_abstention_candidate,
    answered_candidates: row.answered_candidates,
    supported_answer_candidates: row.supported_answer_candidates,
  })),
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This oracle reads existing predictions and paid judge artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  oracle: result.oracle,
  llm_budget: result.llm_budget,
}, null, 2));

function candidate(policy, predictionRow, judgmentRow) {
  const answerType = predictionRow.prediction?.answer_type ?? predictionRow.prediction_answer_type ?? judgmentRow.prediction_answer_type;
  const judgment = judgmentRow.judgment ?? {};
  return {
    policy_id: policy.id,
    example_id: predictionRow.example_id,
    answer_type: answerType,
    verdict: judgment.verdict ?? null,
    supported_answer: answerType === "grounded_answer" && isSupportedAnswer(judgment),
    supported_abstention: answerType === "abstain" && isSupportedAbstention(judgment),
  };
}

function summarize(rows) {
  const answered = rows.filter((row) => row.answer_type === "grounded_answer");
  const abstained = rows.filter((row) => row.answer_type === "abstain");
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
  };
}

function summarizeOracle(rows) {
  const answered = rows.filter((row) => row.selected_action === "grounded_answer");
  const abstained = rows.filter((row) => row.selected_action === "abstain");
  const supportedAnswers = answered.filter((row) => row.selected_supported);
  const supportedAbstentions = abstained.filter((row) => row.selected_supported);
  const noSupportedAnswerCandidate = rows.filter((row) => !row.has_supported_answer_candidate);
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, rows.length),
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    abstention_support_rate: ratio(supportedAbstentions.length, abstained.length),
    overall_judged_correct_rate: ratio(supportedAnswers.length + supportedAbstentions.length, rows.length),
    examples_with_supported_answer_candidate: rows.length - noSupportedAnswerCandidate.length,
    examples_without_supported_answer_candidate: noSupportedAnswerCandidate.length,
    meets_70pct_answer_rate: ratio(answered.length, rows.length) >= 0.7,
    meets_answer_support_target: ratio(supportedAnswers.length, answered.length) > 0.6415094339622641,
    conclusion: ratio(answered.length, rows.length) >= 0.7
      ? "Selection-only candidate pool can meet coverage under this oracle."
      : "Selection-only candidate pool cannot meet the 70% answer-rate target while choosing only supported answer candidates.",
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

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * value).toFixed(1)}%`;
}

function renderReport(result) {
  return `# Candidate Pool Oracle

Generated: ${result.generated_at}

Status: \`${result.status}\`

This is a no-spend oracle over already-judged final-window candidates. It asks whether selection among current direct/gate/guard outputs can satisfy the paper's support-preserving coverage target.

## Policy Metrics

| Policy | Answer rate | Answer support | Abstention support | Overall judged correct |
| --- | ---: | ---: | ---: | ---: |
${Object.entries(result.policy_metrics).map(([id, row]) => `| ${id} | ${pct(row.answer_rate)} | ${pct(row.answer_support_rate)} | ${pct(row.abstention_support_rate)} | ${pct(row.overall_judged_correct_rate)} |`).join("\n")}

## Oracle

| Examples | Answered | Answer rate | Answer support | Overall judged correct | Supported-answer candidates |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.oracle.examples} | ${result.oracle.answered} | ${pct(result.oracle.answer_rate)} | ${pct(result.oracle.answer_support_rate)} | ${pct(result.oracle.overall_judged_correct_rate)} | ${result.oracle.examples_with_supported_answer_candidate} |

Conclusion: ${result.oracle.conclusion}

## Training Implication

${result.training_implication.reason}

Next data change: ${result.training_implication.next_data_change}

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
`;
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
