import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "cost-coverage-support-pareto-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const guard = await readResult("claim-entailment-guard-validation-240-389-v1");
const miniVerifier = await readResult("mini-verifier-gate-balanced-risk-gate-240-389-v1");
const candidateSelector = await readResult("candidate-selector-cross-window-240-320-to-321-389-v1");
const drag = await readResult("drag-like-rag-distillation-comparison-2026-06-26-v1");
const qwenIntegrations = (await Promise.all([
  readResultIfPresent("qwen3b-result-integration-joint-action-smoke-2026-06-26-v1"),
  readResultIfPresent("qwen3b-result-integration-joint-action-v3-smoke-2026-06-27-v1"),
  readResultIfPresent("qwen3b-result-integration-joint-action-v4-smoke-2026-06-27-v1"),
  readResultIfPresent("qwen7b-result-integration-joint-action-smoke-citation-repair-2026-06-27-v1"),
  readResultIfPresent("qwen7b-result-integration-joint-action-v5-coverage-smoke-citation-repair-2026-06-27-v1"),
])).filter(Boolean);
const qwenStructuralBinder = await readResultIfPresent("qwen3b-structural-binder-v4-smoke-2026-06-27-v1");
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const systems = [
  systemFromGuard("direct_mini_repair", "api_direct_student", guard.policies.direct_mini_repair, {
    source_run_id: "risk-gate-transfer-synthesis-240-389-v1",
    online_openai_calls_per_query: 1,
    marginal_scaffold_calls_per_query: 0,
    cost_class: "small_api_student",
    interpretation: "Best judged answer coverage among the current aggregate policies, but lower support.",
  }),
  systemFromGuard("balanced_risk_gate", "api_direct_student_plus_zero_call_gate", guard.policies.balanced_risk_gate, {
    source_run_id: "risk-gate-transfer-synthesis-240-389-v1",
    online_openai_calls_per_query: 1,
    marginal_scaffold_calls_per_query: 0,
    cost_class: "small_api_student_plus_local_gate",
    interpretation: "Improves judged correctness and answer support by abstaining on more rows.",
  }),
  {
    id: "cross_window_candidate_selector",
    family: "api_direct_student_plus_zero_call_selector",
    source_run_id: candidateSelector.run_id,
    examples: candidateSelector.selected_rule_metrics.eval.examples,
    answered: candidateSelector.selected_rule_metrics.eval.answered,
    answer_rate: candidateSelector.selected_rule_metrics.eval.answer_rate,
    answer_support_rate: candidateSelector.selected_rule_metrics.eval.answer_support_rate,
    abstention_support_rate: candidateSelector.selected_rule_metrics.eval.abstention_support_rate,
    overall_judged_correct_rate: candidateSelector.selected_rule_metrics.eval.overall_judged_correct_rate,
    citation_recall: null,
    answer_token_f1: null,
    online_openai_calls_per_query: 1,
    marginal_scaffold_calls_per_query: 0,
    historical_judge_cost_usd: 0,
    cost_class: "small_api_student_plus_local_selector",
    interpretation: "A leakage-safe cross-window selector preserves the 70% answer-rate floor and modestly improves support over direct repair, but it cannot create new supported answers.",
  },
  systemFromGuard("claim_entailment_guard", "api_direct_student_plus_two_zero_call_gates", guard.policies.claim_entailment_guard, {
    source_run_id: "claim-entailment-guard-validation-240-389-v1",
    online_openai_calls_per_query: 1,
    marginal_scaffold_calls_per_query: 0,
    cost_class: "small_api_student_plus_local_guards",
    interpretation: "Best zero-extra-call support/correctness operating point, with the lowest answer coverage among the aggregate judged policies.",
  }),
  {
    id: "mini_verifier_combined_gate",
    family: "api_direct_student_plus_mini_judge_verifier",
    source_run_id: miniVerifier.run_id,
    examples: miniVerifier.aggregate.combined_verifier_gate.examples,
    answered: guard.policies.balanced_risk_gate.answered - miniVerifier.aggregate.combined_suppressions.suppressions,
    answer_rate: (guard.policies.balanced_risk_gate.answered - miniVerifier.aggregate.combined_suppressions.suppressions) / miniVerifier.aggregate.combined_verifier_gate.examples,
    answer_support_rate: null,
    abstention_support_rate: null,
    overall_judged_correct_rate: miniVerifier.aggregate.combined_verifier_gate.correct_rate,
    citation_recall: null,
    answer_token_f1: null,
    online_openai_calls_per_query: 2,
    marginal_scaffold_calls_per_query: 1,
    historical_judge_cost_usd: miniVerifier.source_mini_judge_cost_usd,
    cost_class: "small_api_student_plus_per_query_mini_verifier",
    interpretation: "Highest current correctness estimate, but it uses a per-query mini judge and is therefore not the final amortized zero-call scaffold.",
  },
  ...drag.systems
    .filter((row) => ["zero_call_span_distilled_scaffold", "local_qwen05b_sft_answer_repeat2"].includes(row.id))
    .map((row) => ({
      id: row.id,
      family: row.comparison_role,
      source_run_id: row.source_run,
      examples: row.examples,
      answered: row.answered,
      answer_rate: row.answer_rate,
      answer_support_rate: row.support_metrics?.answer_support_rate ?? null,
      abstention_support_rate: row.support_metrics?.abstention_support_rate ?? null,
      overall_judged_correct_rate: row.support_metrics?.overall_judged_correct_rate ?? null,
      citation_recall: row.reference_metrics?.citation_recall ?? null,
      answer_token_f1: row.reference_metrics?.answer_token_f1 ?? null,
      online_openai_calls_per_query: 0,
      marginal_scaffold_calls_per_query: 0,
      historical_judge_cost_usd: row.cost?.judge_cost_usd ?? 0,
      cost_class: "local_zero_call_scaffold_or_adapter",
      interpretation: row.interpretation,
    })),
];

for (const integration of qwenIntegrations) {
  if (integration?.pareto_row_to_add && integration.status !== "waiting_for_qwen3b_predictions" && integration.status !== "waiting_for_qwen3b_paid_judge") {
    systems.push(qwenParetoRow(integration));
  }
}

if (qwenStructuralBinder?.binder_metrics) {
  systems.push({
    id: "qwen3b_v4_structural_binder",
    family: "trained_qwen3b_plus_zero_call_structural_binder",
    source_run_id: qwenStructuralBinder.run_id,
    examples: qwenStructuralBinder.binder_metrics.examples,
    answered: qwenStructuralBinder.binder_metrics.answered,
    answer_rate: qwenStructuralBinder.binder_metrics.answer_rate,
    answer_support_rate: qwenStructuralBinder.binder_metrics.answer_support_rate,
    abstention_support_rate: qwenStructuralBinder.binder_metrics.abstention_support_rate,
    overall_judged_correct_rate: qwenStructuralBinder.binder_metrics.overall_judged_correct_rate,
    citation_recall: null,
    answer_token_f1: null,
    online_openai_calls_per_query: 0,
    marginal_scaffold_calls_per_query: 0,
    historical_judge_cost_usd: 0,
    cost_class: "trained_small_model_plus_zero_call_binder",
    interpretation: "Zero-call structural binder suppresses unsafe v4 Qwen answers and improves support/correctness, but loses too much answer coverage to be the final amortized student.",
  });
}

const comparable = systems.filter((row) => row.overall_judged_correct_rate != null && row.answer_support_rate != null);
const frontier = comparable.filter((candidate) => !comparable.some((other) => dominates(other, candidate)));
frontier.sort((a, b) => Number(b.overall_judged_correct_rate) - Number(a.overall_judged_correct_rate));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "cost_coverage_support_pareto",
  status: qwenIntegrations.some((row) => row?.pareto_row_to_add) ? "tradeoff_mapped_with_qwen3b_results" : "tradeoff_mapped_not_final_result",
  purpose: "Map the current support/coverage/cost tradeoff so the paper reports answer coverage alongside grounded correctness and does not hide improvements caused by abstention.",
  scope_notes: [
    "Aggregate rows use examples 241-389 where direct, risk-gate, and claim-entailment policies share a judged 149-example surface.",
    "Local zero-call scaffold rows use the final 321-389 surface from the DRAG-like comparison and are included as cheap failure-mode anchors.",
    "Historical judge costs are evaluation costs already spent; online_openai_calls_per_query estimates inference-time calls for the policy family.",
    qwenIntegrations.some((row) => row?.pareto_row_to_add)
      ? "Qwen rows come from judged citation-repair derivatives of trained Prime smokes; they are evidence-bearing negative/improving results, not success claims."
      : "Qwen 3B is absent until the trained smoke, structural repair if needed, paid judge, and result integration exist.",
  ],
  systems,
  pareto_frontier: frontier.map((row) => row.id),
  conclusions: [
    "The current completed support gains are real but mostly buy support by abstaining more.",
    "A cross-window candidate selector is the best current deployable 70%-coverage operating point, but it remains a selector over direct-mini outputs.",
    "The claim-entailment guard is the best zero-extra-call support-first operating point among aggregate judged policies.",
    "The mini-verifier gate has stronger correctness but violates the desired low-cost amortization shape because it adds a per-query LLM verifier.",
    qwenIntegrations.some((row) => row?.pareto_row_to_add)
      ? "The trained Qwen smokes remain negative zero-call student results against the 70%-coverage acceptance bar. The Qwen 7B v4 comparison materially improves support/correctness over 3B v4 by abstaining more, while Qwen 7B v5 recovers some coverage but loses support."
      : "The zero-call local/tiny-model attempts are not yet acceptable substitutes for the missing Qwen 3B joint-action run.",
  ],
  required_next_evidence: qwenIntegrations.some((row) => row?.pareto_row_to_add) ? [
    "Run a Qwen failure-mode audit before any larger GPU/model escalation.",
    "Do not claim support-preserving amortized distillation from this Qwen smoke.",
    "Report answer rate, citation recall, judged support, invalid-answer rate, and cost together.",
  ] : [
    "Run the Qwen 3B joint-action smoke and place it on this same table.",
    "Judge Qwen 3B predictions for answer support, abstention support, and overall grounded correctness.",
    "Report answer rate and citation recall alongside correctness so abstention-driven gains are visible.",
  ],
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
    note: "This Pareto artifact reads existing result files only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function systemFromGuard(id, family, metrics, extra) {
  return {
    id,
    family,
    source_run_id: extra.source_run_id,
    examples: metrics.examples,
    answered: metrics.answered,
    answer_rate: metrics.answer_rate,
    answer_support_rate: metrics.answer_support_rate,
    abstention_support_rate: metrics.abstention_support_rate,
    overall_judged_correct_rate: metrics.overall_judged_correct_rate,
    citation_recall: metrics.citation_recall,
    answer_token_f1: metrics.answer_token_f1,
    online_openai_calls_per_query: extra.online_openai_calls_per_query,
    marginal_scaffold_calls_per_query: extra.marginal_scaffold_calls_per_query,
    historical_judge_cost_usd: metrics.judge_run_cost_usd,
    cost_class: extra.cost_class,
    interpretation: extra.interpretation,
  };
}

function qwenParetoRow(integration) {
  const row = integration.pareto_row_to_add;
  const isV3 = String(integration.run_id ?? "").includes("v3");
  const isV4 = String(integration.run_id ?? "").includes("v4");
  const isV5 = String(integration.run_id ?? "").includes("v5");
  const is7B = String(integration.run_id ?? "").includes("qwen7b");
  return {
    ...row,
    id: is7B && isV5 ? "qwen7b_coverage_aware_v5_smoke" : is7B ? "qwen7b_support_aware_v4_smoke" : isV4 ? "qwen3b_support_aware_v4_smoke" : isV3 ? "qwen3b_failure_driven_v3_smoke" : "qwen3b_joint_action_v2_smoke",
    family: is7B ? "local_or_remote_qwen7b_joint_action_lora" : row.family,
    source_run_id: integration.prediction_run_id,
    judge_run_id: integration.judge_run_id,
    interpretation: integration.status?.includes("positive")
      ? row.interpretation
      : is7B && isV5
        ? "Qwen 7B v5 coverage-aware preferences recover answer rate versus v4, but unsupported answers return; this is a negative result showing coverage pressure needs answerability gating."
      : is7B
        ? "Qwen 7B with the same v4 support-aware packet substantially improves judged support/correctness over Qwen 3B v4, but answer coverage falls far below the pre-registered 70% answer-rate acceptance bar."
        : isV4
        ? "Support-aware Qwen 3B v4 slightly improves judged support/correctness over v3 but loses answer coverage and remains below the pre-registered 70% answer-rate acceptance bar."
        : isV3
        ? "Failure-driven Qwen 3B v3 improves support/correctness over v2 but remains below the pre-registered 70% answer-rate acceptance bar."
        : "Initial Qwen 3B joint-action smoke is a negative zero-call student result with weak judged support.",
  };
}

function dominates(a, b) {
  const aBetterOrEqual =
    Number(a.overall_judged_correct_rate) >= Number(b.overall_judged_correct_rate) &&
    Number(a.answer_support_rate) >= Number(b.answer_support_rate) &&
    Number(a.answer_rate) >= Number(b.answer_rate) &&
    Number(a.online_openai_calls_per_query) <= Number(b.online_openai_calls_per_query);
  const aStrict =
    Number(a.overall_judged_correct_rate) > Number(b.overall_judged_correct_rate) ||
    Number(a.answer_support_rate) > Number(b.answer_support_rate) ||
    Number(a.answer_rate) > Number(b.answer_rate) ||
    Number(a.online_openai_calls_per_query) < Number(b.online_openai_calls_per_query);
  return aBetterOrEqual && aStrict;
}

function renderReport(result) {
  return `# Cost/Coverage/Support Pareto

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Systems

| System | Online calls/query | Answer rate | Answer support | Abstention support | Overall judged correct | Citation recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${result.systems.map((row) => `| ${row.id} | ${row.online_openai_calls_per_query} | ${pct(row.answer_rate)} | ${pct(row.answer_support_rate)} | ${pct(row.abstention_support_rate)} | ${pct(row.overall_judged_correct_rate)} | ${pct(row.citation_recall)} |`).join("\n")}

## Pareto Frontier

${result.pareto_frontier.map((id) => `- \`${id}\``).join("\n")}

## Conclusions

${result.conclusions.map((item) => `- ${item}`).join("\n")}

## Required Next Evidence

${result.required_next_evidence.map((item) => `- ${item}`).join("\n")}

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
`;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

async function readResult(id) {
  return readJson(path.join(runDir, id, "result.json"));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readResultIfPresent(id) {
  try {
    return await readResult(id);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
