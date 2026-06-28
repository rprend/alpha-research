import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");

const runId = "margin-compatible-heldout-plan-qwen-frontier-pool-2026-06-28-v1";
const runDir = path.join(runsDir, runId);

const sourceRuns = {
  heldoutCoverageGapAudit: "heldout-coverage-gap-audit-qwen-frontier-pool-2026-06-28-v1",
  temporalCandidateSelector: "candidate-selector-cross-window-240-320-to-321-389-v1",
  directRepairPredictions: "citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
  directRepairJudge: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
  riskGatePredictions: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  riskGateJudge: "openai-judge-mini-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  claimEntailmentGuardPredictions: "claim-entailment-guard-balanced-risk-gate-240-389-v1",
  claimEntailmentGuardJudge: "openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1",
  qwenFrontierSupportPacket: "qwen-frontier-pool-support-packet-2026-06-28-v1",
  claimNliVerifier: "claim-nli-support-verifier-qwen-frontier-pool-2026-06-28-v1",
  d280Candidate: "tempered-hard-hybrid-audit-qwen-frontier-pool-2026-06-28-v1",
  poolAdjudicationCostReference: "openai-pool-adjudication-qwen-frontier-pool-2026-06-28-v1",
};

await fs.mkdir(runDir, { recursive: true });

const examples = await readJsonl(path.join(dataDir, "extended_temporal_future_holdout.jsonl"));
const finalWindow = examples.slice(320, 389);
const answerable = finalWindow.filter((row) => row.output?.answer_type === "grounded_answer").length;
const abstain = finalWindow.filter((row) => row.output?.answer_type === "abstain").length;

const candidateSelectorRows = await readJsonl(path.join(runsDir, sourceRuns.temporalCandidateSelector, "predictions.jsonl"));
const directRows = await readJsonl(path.join(runsDir, sourceRuns.directRepairPredictions, "predictions.jsonl"));
const directJudgments = await readJsonl(path.join(runsDir, sourceRuns.directRepairJudge, "judgments.jsonl"));
const riskRows = await readJsonl(path.join(runsDir, sourceRuns.riskGatePredictions, "predictions.jsonl"));
const riskJudgments = await readJsonl(path.join(runsDir, sourceRuns.riskGateJudge, "judgments.jsonl"));
const guardRowsAll = await readJsonl(path.join(runsDir, sourceRuns.claimEntailmentGuardPredictions, "predictions.jsonl"));
const guardJudgmentsAll = await readJsonl(path.join(runsDir, sourceRuns.claimEntailmentGuardJudge, "judgments.jsonl"));
const guardRows = guardRowsAll.filter((row) => finalWindow.some((example) => example.example_id === row.example_id));
const guardJudgments = guardJudgmentsAll.filter((row) => finalWindow.some((example) => example.example_id === row.example_id));

const supportPacketFrontierPairs = await readJsonl(path.join(runsDir, sourceRuns.qwenFrontierSupportPacket, "frontier_contrast_pairs.jsonl"));
const claimNliScores = await readJsonl(path.join(runsDir, sourceRuns.claimNliVerifier, "claim-nli-scores.jsonl"));
const d280Result = await readJson(path.join(runsDir, sourceRuns.d280Candidate, "result.json"));
const costReference = await readJson(path.join(runsDir, sourceRuns.poolAdjudicationCostReference, "result.json"));
const totalBudget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const directByExample = indexBy(directRows, "example_id");
const riskByExample = indexBy(riskRows, "example_id");
const guardByExample = indexBy(guardRows, "example_id");
const directJudgmentByExample = indexJudgment(directJudgments);
const riskJudgmentByExample = indexJudgment(riskJudgments);
const guardJudgmentByExample = indexJudgment(guardJudgments);

const scaffoldRows = [];
let examplesWithThreeCandidates = 0;
let examplesWithAnySupportedCandidate = 0;
let examplesWithDisagreement = 0;
let potentialPairwiseContrasts = 0;

for (const example of finalWindow) {
  const candidates = [
    candidateSummary("direct", directByExample.get(example.example_id), directJudgmentByExample.get(example.example_id)),
    candidateSummary("risk", riskByExample.get(example.example_id), riskJudgmentByExample.get(example.example_id)),
    candidateSummary("claim_entailment_guard", guardByExample.get(example.example_id), guardJudgmentByExample.get(example.example_id)),
  ].filter(Boolean);
  const supported = candidates.filter((candidate) => candidate.overall_correct);
  const unsupported = candidates.filter((candidate) => !candidate.overall_correct);
  if (candidates.length === 3) examplesWithThreeCandidates += 1;
  if (supported.length > 0) examplesWithAnySupportedCandidate += 1;
  if (supported.length > 0 && unsupported.length > 0) {
    examplesWithDisagreement += 1;
    potentialPairwiseContrasts += supported.length * unsupported.length;
  }
  scaffoldRows.push({
    example_id: example.example_id,
    source_index: 320 + scaffoldRows.length,
    reference_answer_type: example.output?.answer_type,
    candidates,
    supported_candidates: supported.length,
    unsupported_candidates: unsupported.length,
    has_supported_vs_unsupported_contrast: supported.length > 0 && unsupported.length > 0,
  });
}

const perPoolObservedCostUsd = Number(costReference.run_cost_usd) / Number(costReference.calls_made);
const plannedPools = Math.min(40, examplesWithDisagreement || 40);
const estimatedOpenAiCostUsd = round6(perPoolObservedCostUsd * plannedPools);
const conservativeOpenAiCostUsd = round6(estimatedOpenAiCostUsd * 2);
const projectedTotalAfterConservativeBatchUsd = round6(Number(totalBudget.spend_usd.total_actual) + conservativeOpenAiCostUsd);

const sourceInventory = [
  {
    source_id: "temporal_321_389_scaffold_candidates",
    source_run_id: sourceRuns.temporalCandidateSelector,
    units: candidateSelectorRows.length,
    examples: finalWindow.length,
    existing_labels: "inherited direct/risk/guard final-answer judgments",
    zero_call_reusable: true,
    d280_margin_compatible_now: false,
    limitation: "Contains selected scaffold outputs and inherited correctness, not full Qwen pairwise-margin rows with claim-NLI scores.",
  },
  {
    source_id: "direct_risk_guard_judged_pool",
    source_run_id: `${sourceRuns.directRepairJudge}; ${sourceRuns.riskGateJudge}; ${sourceRuns.claimEntailmentGuardJudge}`,
    units: directJudgments.length + riskJudgments.length + guardJudgments.length,
    examples: finalWindow.length,
    existing_labels: "candidate-level GPT-4o/gpt-4o-mini support judgments",
    zero_call_reusable: true,
    d280_margin_compatible_now: false,
    limitation: "Can derive scaffold-level supported-vs-unsupported contrasts, but policy family and features differ from D280.",
  },
  {
    source_id: "qwen_frontier_pairwise_source",
    source_run_id: sourceRuns.qwenFrontierSupportPacket,
    units: supportPacketFrontierPairs.length,
    examples: new Set(supportPacketFrontierPairs.map((row) => row.example_id)).size,
    existing_labels: "Qwen frontier generated contrast pairs",
    zero_call_reusable: true,
    d280_margin_compatible_now: true,
    limitation: "Non-final frontier validation already used by prior audits; not a new large temporally separate heldout.",
  },
  {
    source_id: "claim_nli_feature_cache",
    source_run_id: sourceRuns.claimNliVerifier,
    units: claimNliScores.length,
    examples: null,
    existing_labels: "claim-NLI support scores for existing Qwen/frontier candidates",
    zero_call_reusable: true,
    d280_margin_compatible_now: "existing_candidates_only",
    limitation: "Does not cover the 321-389 direct/risk/guard candidate claims needed for D280 hard-negative margins.",
  },
];

const missingRequirements = [
  {
    requirement: "full_pairwise_candidate_rows",
    status: "missing_for_321_389",
    reason: "D280 was evaluated on candidate pair rows with margins; the 321-389 selector artifact stores a single selected policy per example.",
  },
  {
    requirement: "claim_nli_scores_for_candidate_claims",
    status: "missing_for_321_389",
    reason: "The hard-negative margin uses local claim-NLI feature scores keyed to candidate claims; existing cache covers Qwen/frontier candidates, not the final-window scaffold pool.",
  },
  {
    requirement: "pool_level_choice_labels",
    status: "optional_paid_step",
    reason: "The observed GPT-4o pool-adjudication cost supports a narrow follow-up label batch if the preflight packet shows enough candidate diversity.",
  },
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "margin_compatible_heldout_plan",
  purpose: "Determine whether the 321-389 temporal heldout can validate the D280 pairwise-margin selector without new calls, and bound the next paid label step if it cannot.",
  source_runs: sourceRuns,
  final_window: {
    dataset: "extended_temporal_future_holdout",
    start_index_inclusive: 320,
    end_index_exclusive: 389,
    examples: finalWindow.length,
    answerable,
    abstain,
  },
  scaffold_candidate_inventory: {
    examples_with_three_candidates: examplesWithThreeCandidates,
    examples_with_any_supported_candidate: examplesWithAnySupportedCandidate,
    examples_with_supported_vs_unsupported_contrast: examplesWithDisagreement,
    potential_supported_vs_unsupported_pairwise_contrasts: potentialPairwiseContrasts,
    zero_call_scaffold_contrast_reusable: true,
    d280_margin_compatible_now: false,
  },
  d280_candidate: {
    alpha_hard_negative: d280Result.selected_policy?.alpha_hard_negative,
    alpha_boundary: d280Result.selected_policy?.alpha_boundary,
    clean_validation_correct: d280Result.selected_policy?.clean_validation_correct,
    clean_validation_pairs: d280Result.selected_policy?.clean_validation_pairs,
    frozen_hypothesis_only: true,
  },
  missing_requirements: missingRequirements,
  label_plan: {
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    preflight_next: "Construct a 321-389 margin-compatible candidate packet first; only run paid pool adjudication after verifying Qwen/frontier-style candidates and claim-NLI feature coverage.",
    planned_pool_adjudications_if_preflight_passes: plannedPools,
    observed_reference_run_id: sourceRuns.poolAdjudicationCostReference,
    observed_reference_calls: Number(costReference.calls_made),
    observed_reference_cost_usd: Number(costReference.run_cost_usd),
    observed_cost_per_pool_usd: round8(perPoolObservedCostUsd),
    estimated_openai_cost_usd: estimatedOpenAiCostUsd,
    conservative_2x_openai_cost_usd: conservativeOpenAiCostUsd,
  },
  budget: {
    max_budget_usd: Number(totalBudget.max_budget_usd),
    actual_total_before_plan_usd: Number(totalBudget.spend_usd.total_actual),
    remaining_before_plan_usd: Number(totalBudget.spend_usd.remaining),
    projected_total_after_conservative_label_batch_usd: projectedTotalAfterConservativeBatchUsd,
    within_budget_if_label_batch_runs: projectedTotalAfterConservativeBatchUsd <= Number(totalBudget.max_budget_usd),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    inherited_cost_reference_usd: Number(costReference.run_cost_usd),
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_d280_validation: false,
    audit_is_zero_call: true,
    note: "Final-window judgments are inventoried only to plan a compatible packet; they are not used to promote or tune D280.",
  },
  decision: {
    treat_321_389_as_d280_validation_now: false,
    build_margin_compatible_packet_next: true,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    reason: "Existing 321-389 artifacts provide scaffold-level judged candidates but not the Qwen pairwise-margin and claim-NLI feature surface required for D280 validation.",
  },
};

await writeJsonl(path.join(runDir, "source_inventory.jsonl"), sourceInventory);
await writeJsonl(path.join(runDir, "scaffold_candidate_inventory.jsonl"), scaffoldRows);
await fs.writeFile(path.join(runDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(runDir, "report.md"), renderReport(result, sourceInventory));

console.log(JSON.stringify({
  run_id: runId,
  final_window_examples: finalWindow.length,
  d280_margin_compatible_now: false,
  potential_supported_vs_unsupported_pairwise_contrasts: potentialPairwiseContrasts,
  conservative_2x_openai_cost_usd: conservativeOpenAiCostUsd,
  projected_total_after_conservative_label_batch_usd: projectedTotalAfterConservativeBatchUsd,
}, null, 2));

function candidateSummary(policy, predictionRow, judgmentRow) {
  if (!predictionRow || !judgmentRow) return null;
  const judgment = judgmentRow.judgment ?? judgmentRow.inherited_judgment;
  const verdict = judgment?.verdict ?? "unknown";
  const answerType = predictionRow.prediction?.answer_type ?? predictionRow.output?.answer_type ?? judgmentRow.prediction_answer_type;
  const overallCorrect = verdict === "supported" || verdict === "correct_abstention" || verdict === "correct";
  return {
    policy,
    answer_type: answerType,
    verdict,
    overall_correct: overallCorrect,
  };
}

function indexJudgment(rows) {
  const map = new Map();
  for (const row of rows) map.set(row.example_id, row);
  return map;
}

function indexBy(rows, key) {
  const map = new Map();
  for (const row of rows) map.set(row[key], row);
  return map;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function round6(value) {
  return Math.round(Number(value) * 1e6) / 1e6;
}

function round8(value) {
  return Math.round(Number(value) * 1e8) / 1e8;
}

function renderReport(plan, inventory) {
  return `# Margin-Compatible Heldout Plan

This is a zero-call margin-compatible heldout plan for the D280 Qwen pairwise-margin selector.

## Finding

- Final window: ${plan.final_window.examples} examples (${plan.final_window.answerable} answerable, ${plan.final_window.abstain} abstain).
- Existing scaffold pool: ${plan.scaffold_candidate_inventory.examples_with_three_candidates} examples have direct/risk/guard candidates.
- Zero-call scaffold contrasts: ${plan.scaffold_candidate_inventory.potential_supported_vs_unsupported_pairwise_contrasts} potential supported-vs-unsupported contrasts.
- D280-compatible now: no.

The saved 321-389 outputs can support a scaffold-level audit, but they do not include the pairwise-margin rows and claim-NLI scores needed to validate D280.

## Budget

- Actual spend before plan: $${plan.budget.actual_total_before_plan_usd}.
- Remaining budget: $${plan.budget.remaining_before_plan_usd}.
- Observed pool-adjudication cost: $${plan.label_plan.observed_cost_per_pool_usd} per pool from ${plan.label_plan.observed_reference_calls} calls.
- Conservative 2x estimate for ${plan.label_plan.planned_pool_adjudications_if_preflight_passes} future pools: $${plan.label_plan.conservative_2x_openai_cost_usd}.
- Projected total after that conservative batch: $${plan.budget.projected_total_after_conservative_label_batch_usd}.

## Decision

- Treat 321-389 as D280 validation now: no.
- Build margin-compatible packet next: yes.
- Buy OpenAI labels now: no.
- Launch GPU now: no.

## Source Inventory

${inventory.map((row) => `- ${row.source_id}: ${row.units} units; D280-compatible now = ${row.d280_margin_compatible_now}; ${row.limitation}`).join("\n")}
`;
}
