import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const runId = "coverage-constrained-listwise-selector-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const listwisePacketRunId = "listwise-supervision-packet-audit-0-320-2026-06-28-v1";
const selectorProbeRunId = "listwise-selector-probe-0-320-to-321-389-2026-06-28-v1";
const integrationRunId = "listwise-selector-integration-final-window-2026-06-28-v1";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const examples = await readJsonl(path.join(runsDir, listwisePacketRunId, "listwise_examples.jsonl"));
const selectorProbe = await readJson(path.join(runsDir, selectorProbeRunId, "result.json"));
const integration = await readJson(path.join(runsDir, integrationRunId, "result.json"));
const finalRows = await readJsonl(path.join(runsDir, integrationRunId, "rows_with_listwise_scores.jsonl"));

const baseWeights = selectorProbe.selected_by_validation.config;
const trainExamples = examples.filter((row) => row.split === "train");
const validationExamples = examples.filter((row) => row.split === "validation");
const policies = buildPolicies();
const policyRows = policies.map((policy) => {
  const train = evaluatePacketExamples(trainExamples, policy);
  const validation = evaluatePacketExamples(validationExamples, policy);
  const final = evaluateFinalRows(finalRows, policy);
  return { policy_id: policyId(policy), policy, train, validation, final_reporting: final.metrics };
});

const selected = selectByValidation(policyRows);
const diagnosticBestFinal = [...policyRows].sort((left, right) =>
  -left.final_reporting.overall_judged_correct_rate + right.final_reporting.overall_judged_correct_rate
  || -left.final_reporting.answer_rate + right.final_reporting.answer_rate
  || -left.final_reporting.answer_support_rate + right.final_reporting.answer_support_rate
  || left.policy_id.localeCompare(right.policy_id)
)[0];
const selectedFinalPredictions = evaluateFinalRows(finalRows, selected.policy).predictions;
const calibrated = integration.selection_metrics.calibrated_hybrid;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "coverage_constrained_listwise_selector_audit",
  status: statusFor(selected.final_reporting, calibrated),
  purpose: "Select a coverage/support-constrained listwise policy on non-final validation, then report final-window transfer without using final labels for model selection.",
  source_runs: {
    listwise_supervision_packet_audit: listwisePacketRunId,
    listwise_selector_probe: selectorProbeRunId,
    listwise_selector_integration: integrationRunId,
  },
  data: {
    train_examples: trainExamples.length,
    validation_examples: validationExamples.length,
    final_examples: finalRows.length,
    policies_evaluated: policyRows.length,
  },
  selection_rule: {
    answer_rate_floor: 0.7,
    answer_rate_ceiling: 0.82,
    answer_support_floor: 0.7,
    primary: "maximize non-final validation overall judged correctness after satisfying coverage/support constraints",
    final_labels_used_for_selection: false,
  },
  selected_by_validation: selected,
  diagnostic_best_final_policy: diagnosticBestFinal,
  baselines: {
    calibrated_hybrid: calibrated,
    d343_listwise_conservative: integration.selection_metrics.listwise_conservative,
    d343_scaffold_priority: integration.selection_metrics.scaffold_priority,
  },
  comparison: {
    selected_minus_calibrated_overall_correct: selected.final_reporting.overall_judged_correct_rate - calibrated.overall_judged_correct_rate,
    selected_minus_calibrated_answer_support: selected.final_reporting.answer_support_rate - calibrated.answer_support_rate,
    selected_minus_calibrated_answer_rate: selected.final_reporting.answer_rate - calibrated.answer_rate,
    selected_minus_calibrated_supported_answers: selected.final_reporting.supported_answers - calibrated.supported_answers,
    selected_beats_calibrated_overall: selected.final_reporting.overall_judged_correct_rate > calibrated.overall_judged_correct_rate,
    selected_meets_calibrated_coverage: selected.final_reporting.answer_rate >= calibrated.answer_rate,
    selected_meets_calibrated_answer_support: selected.final_reporting.answer_support_rate >= calibrated.answer_support_rate,
  },
  decision: decisionFromResult(selected.final_reporting, calibrated),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_transfer: true,
    selected_policy_source: "nonfinal_validation_constraints_only",
    deployable_feature_policy: "D342 surface listwise score plus answer margin, answer penalty, abstention bonus, and answer score threshold",
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
    prime_intellect_cost_usd: 0,
    note: "Zero-call constrained selector audit over existing judged artifacts.",
  },
  artifacts: {
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    selected_final_predictions_jsonl: rel(path.join(outputDir, "selected_final_predictions.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), policyRows);
await writeJsonl(path.join(outputDir, "selected_final_predictions.jsonl"), selectedFinalPredictions);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_by_validation: result.selected_by_validation,
  comparison: result.comparison,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function buildPolicies() {
  const policies = [];
  for (const answerPenalty of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1.0]) {
    for (const abstainBonus of [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5]) {
      for (const answerMargin of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1.0]) {
        for (const minAnswerScore of [-99, 0.6, 0.8, 1.0, 1.2, 1.4]) {
          policies.push({ answerPenalty, abstainBonus, answerMargin, minAnswerScore });
        }
      }
    }
  }
  return policies;
}

function selectByValidation(rows) {
  const eligible = rows.filter((row) =>
    row.validation.answer_rate >= 0.7
    && row.validation.answer_rate <= 0.82
    && row.validation.answer_support_rate >= 0.7
  );
  const pool = eligible.length ? eligible : rows;
  return [...pool].sort((left, right) =>
    -left.validation.overall_judged_correct_rate + right.validation.overall_judged_correct_rate
    || -left.validation.answer_support_rate + right.validation.answer_support_rate
    || Math.abs(0.71 - left.validation.answer_rate) - Math.abs(0.71 - right.validation.answer_rate)
    || -left.train.overall_judged_correct_rate + right.train.overall_judged_correct_rate
    || left.policy_id.localeCompare(right.policy_id)
  )[0];
}

function evaluatePacketExamples(rows, policy) {
  const predictions = rows.map((row) => {
    const selected = selectPacketCandidate(row, policy);
    return { row, selected };
  });
  return summarizePacketSelections(predictions);
}

function selectPacketCandidate(row, policy) {
  const scored = row.candidates.map((candidate) => ({
    ...candidate,
    constrained_score: packetScore(candidate, policy),
  }));
  const answers = scored
    .filter((candidate) => candidate.answer_type === "grounded_answer" && candidate.inline_complete !== false)
    .sort(candidateSort);
  const abstentions = scored
    .filter((candidate) => candidate.answer_type !== "grounded_answer")
    .sort(candidateSort);
  const topAnswer = answers[0];
  const topAbstention = abstentions[0];
  if (!topAnswer) return topAbstention ?? scored.sort(candidateSort)[0];
  if (topAnswer.constrained_score < policy.minAnswerScore && topAbstention) return topAbstention;
  if (topAbstention && topAnswer.constrained_score < topAbstention.constrained_score + policy.answerMargin) return topAbstention;
  return topAnswer;
}

function evaluateFinalRows(rows, policy) {
  const predictions = rows.map((row) => {
    const selected = selectFinalCandidate(row, policy);
    return finalSelectionRow(row, selected, policy);
  });
  return { predictions, metrics: summarizeFinalSelections(predictions) };
}

function selectFinalCandidate(row, policy) {
  const scored = row.candidates.map((candidate) => ({
    ...candidate,
    constrained_score: finalScore(candidate, policy),
  }));
  const answers = scored
    .filter((candidate) => candidate.prediction?.answer_type === "grounded_answer" && candidate.contract?.answer_citation_complete !== false)
    .sort(candidateSort);
  const abstentions = scored
    .filter((candidate) => candidate.prediction?.answer_type !== "grounded_answer")
    .sort(candidateSort);
  const topAnswer = answers[0];
  const topAbstention = abstentions[0];
  if (!topAnswer) return topAbstention ?? scored.sort(candidateSort)[0];
  if (topAnswer.constrained_score < policy.minAnswerScore && topAbstention) return topAbstention;
  if (topAbstention && topAnswer.constrained_score < topAbstention.constrained_score + policy.answerMargin) return topAbstention;
  return topAnswer;
}

function packetScore(candidate, policy) {
  const base = (
    Number(baseWeights.inline ?? 0) * (candidate.inline_complete ? 1 : 0)
    + Number(baseWeights.answer ?? 0) * (candidate.answer_type === "grounded_answer" ? 1 : 0)
    + Number(baseWeights.citations ?? 0) * Math.log1p((candidate.citations ?? []).length)
    + Number(baseWeights.overlap ?? 0) * Number(candidate.question_overlap ?? 0)
    + Number(baseWeights.qwen ?? 0) * (String(candidate.family ?? "").startsWith("qwen") ? 1 : 0)
    + Number(baseWeights.openai ?? 0) * (String(candidate.family ?? "").includes("openai") ? 1 : 0)
    + 0.04 * (candidate.answer_type === "abstain" ? 1 : 0)
    + 0.02 * Math.log1p(Number(candidate.claim_count ?? 0))
    + 0.01 * Math.log1p(Number(candidate.answer_tokens ?? 0))
  );
  return base
    - policy.answerPenalty * (candidate.answer_type === "grounded_answer" ? 1 : 0)
    + policy.abstainBonus * (candidate.answer_type !== "grounded_answer" ? 1 : 0);
}

function finalScore(candidate, policy) {
  const base = Number(candidate.listwise_selector?.score ?? -Infinity);
  return base
    - policy.answerPenalty * (candidate.prediction?.answer_type === "grounded_answer" ? 1 : 0)
    + policy.abstainBonus * (candidate.prediction?.answer_type !== "grounded_answer" ? 1 : 0);
}

function candidateSort(left, right) {
  return Number(right.constrained_score ?? -Infinity) - Number(left.constrained_score ?? -Infinity)
    || String(left.candidate_id ?? left.id).localeCompare(String(right.candidate_id ?? right.id));
}

function summarizePacketSelections(rows) {
  const answered = rows.filter(({ selected }) => selected.answer_type === "grounded_answer");
  const abstained = rows.filter(({ selected }) => selected.answer_type !== "grounded_answer");
  const supportedAnswers = answered.filter(({ selected }) => selected.label_summary?.train_positive);
  const supportedAbstentions = abstained.filter(({ selected }) => selected.label_summary?.train_positive);
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, rows.length),
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    abstention_support_rate: ratio(supportedAbstentions.length, abstained.length),
    overall_judged_correct_rate: ratio(supportedAnswers.length + supportedAbstentions.length, rows.length),
    supported_answers: supportedAnswers.length,
    supported_abstentions: supportedAbstentions.length,
  };
}

function summarizeFinalSelections(rows) {
  const answered = rows.filter((row) => row.prediction?.answer_type === "grounded_answer");
  const abstained = rows.filter((row) => row.prediction?.answer_type !== "grounded_answer");
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

function finalSelectionRow(row, selected, policy) {
  return {
    example_id: row.example_id,
    selector_type: "coverage_constrained_listwise_selector",
    selected_candidate_id: selected?.id ?? null,
    selected_family: selected?.family ?? null,
    policy,
    prediction: selected?.prediction ?? null,
    reference: row.reference,
    inherited_judgment: selected?.judgment ?? null,
    selection_scores: {
      listwise_score: selected?.listwise_selector?.score ?? null,
      constrained_score: selected?.constrained_score ?? null,
      supported_answer: selected?.supported_answer ?? false,
      supported_abstention: selected?.supported_abstention ?? false,
      judged_correct: selected?.supported_answer === true || selected?.supported_abstention === true,
      answer_type_correct: selected?.answer_type_correct ?? false,
      answer_citation_complete: selected?.contract?.answer_citation_complete ?? false,
      heuristic_score: selected?.heuristic_score ?? null,
    },
  };
}

function statusFor(finalMetrics, baseline) {
  if (finalMetrics.answer_rate >= baseline.answer_rate && finalMetrics.answer_support_rate >= baseline.answer_support_rate && finalMetrics.overall_judged_correct_rate > baseline.overall_judged_correct_rate) {
    return "coverage_constrained_selector_integrated";
  }
  if (finalMetrics.overall_judged_correct_rate > baseline.overall_judged_correct_rate && finalMetrics.answer_support_rate >= baseline.answer_support_rate) {
    return "coverage_constrained_selector_improves_correctness_but_loses_coverage";
  }
  return "coverage_constrained_selector_not_integrated";
}

function decisionFromResult(finalMetrics, baseline) {
  const status = statusFor(finalMetrics, baseline);
  if (status === "coverage_constrained_selector_integrated") {
    return {
      replace_calibrated_hybrid_now: true,
      buy_openai_labels_now: false,
      launch_gpu_now: false,
      next_step: "Refresh readiness and manuscript evidence with the coverage-constrained selector.",
      reason: "The constrained selector improves final judged correctness while preserving calibrated-hybrid answer rate and support.",
    };
  }
  return {
    replace_calibrated_hybrid_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Mine or label non-final examples where high-scoring direct answers are unsupported despite clearing surface citation and coverage features.",
    reason: "The constrained selector preserves calibrated-hybrid answer coverage but does not preserve answer support or overall judged correctness.",
  };
}

function renderReport(result) {
  const selected = result.selected_by_validation;
  const final = selected.final_reporting;
  const calibrated = result.baselines.calibrated_hybrid;
  return `# Coverage-Constrained Listwise Selector Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no API calls and launches no compute.

## Selection Rule

- Validation answer-rate floor: ${pct(result.selection_rule.answer_rate_floor)}
- Validation answer-rate ceiling: ${pct(result.selection_rule.answer_rate_ceiling)}
- Validation answer-support floor: ${pct(result.selection_rule.answer_support_floor)}
- Final labels used for selection: no

## Selected Policy

- Policy: \`${selected.policy_id}\`
- Validation answered: ${selected.validation.answered}/${selected.validation.examples}
- Validation answer support: ${pct(selected.validation.answer_support_rate)}
- Validation overall judged correct: ${pct(selected.validation.overall_judged_correct_rate)}

## Final Reporting

| Policy | Answered | Supported answers | Answer support | Overall judged correct |
| --- | ---: | ---: | ---: | ---: |
| Calibrated hybrid | ${calibrated.answered} | ${calibrated.supported_answers} | ${pct(calibrated.answer_support_rate)} | ${pct(calibrated.overall_judged_correct_rate)} |
| Selected constrained listwise | ${final.answered} | ${final.supported_answers} | ${pct(final.answer_support_rate)} | ${pct(final.overall_judged_correct_rate)} |

## Decision

- Replace calibrated hybrid now: ${result.decision.replace_calibrated_hybrid_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function policyId(policy) {
  return `pen_${name(policy.answerPenalty)}_abs_${name(policy.abstainBonus)}_margin_${name(policy.answerMargin)}_min_${name(policy.minAnswerScore)}`;
}

function name(value) {
  return String(value).replace("-", "neg").replace(".", "p");
}

function groupCount(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}
