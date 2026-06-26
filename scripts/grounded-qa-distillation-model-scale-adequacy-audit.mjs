import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "model-scale-adequacy-audit-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const drag = await readResult("drag-like-rag-distillation-comparison-2026-06-26-v1");
const compactQwen = await readResult("local-generative-sft-compact-mini-negative-temporal-qwen05b-64train-321-389-v1");
const contractQwen = await readResult("local-generative-contract-gate-answer-repeat2-repair-qwen05b-321-389-v1");
const frontier = await readResult("coverage-constrained-support-frontier-2026-06-26-v1");
const packet = await readResult("joint-action-packet-quality-audit-2026-06-26-v1");
const primeGate = await readResult("prime-auth-price-gate-qwen3b-smoke-2026-06-26-v1");

const direct = drag.systems.find((row) => row.id === "direct_mini_rag_student");
const riskGate = drag.systems.find((row) => row.id === "zero_call_risk_gate_over_direct_student");
const span = drag.systems.find((row) => row.id === "zero_call_span_distilled_scaffold");
const qwen05b = drag.systems.find((row) => row.id === "local_qwen05b_sft_answer_repeat2");
const seventy = frontier.coverage_constrained_operating_points.find((row) => row.min_answer_rate === 0.7)?.selected;

const systems = [
  systemRow("direct_mini_rag_student", "cheap_prompted_baseline", direct, {
    verdict: "baseline_not_final_student",
    implication: "Good coverage baseline, but support is below the desired grounded-correctness target.",
  }),
  systemRow("zero_call_risk_gate_over_direct_student", "amortized_scaffold", riskGate, {
    verdict: "useful_scaffold_but_coverage_tradeoff",
    implication: "Raises judged correctness by abstaining more; not enough to answer whether a trained student can preserve support at useful coverage.",
  }),
  systemRow("zero_call_span_distilled_scaffold", "local_distilled_scaffold", span, {
    verdict: "underpowered_for_grounded_synthesis",
    implication: "Decent answer rate but very weak judged support, so extractive local scaffolds are not the final answer.",
  }),
  systemRow("local_qwen05b_sft_answer_repeat2", "tiny_foundation_model", qwen05b, {
    verdict: "too_small_for_final_claim",
    implication: "Learns citation formatting but fails support preservation; this is a negative result for tiny-model generic SFT.",
  }),
  {
    id: "local_qwen05b_compact_sft_all_abstain",
    role: "tiny_foundation_model",
    source_run: compactQwen.run_id,
    examples: compactQwen.eval.examples,
    answer_rate: compactQwen.eval.answer_rate,
    answer_support_rate: null,
    overall_judged_correct_rate: null,
    inline_citation_rate: compactQwen.eval.inline_citation_rate,
    answer_token_f1: compactQwen.eval.answer_token_f1,
    verdict: "collapsed_to_abstention",
    implication: "The tiny local SFT path can collapse to all abstentions, which is not acceptable final behavior.",
  },
  {
    id: "local_qwen05b_contract_gate",
    role: "tiny_foundation_model_with_local_contract_gate",
    source_run: contractQwen.run_id,
    examples: contractQwen.metrics.examples,
    answer_rate: ratio(contractQwen.metrics.answered, contractQwen.metrics.examples),
    answer_support_rate: null,
    overall_judged_correct_rate: null,
    inline_citation_rate: contractQwen.metrics.inline_citation_rate,
    answer_token_f1: contractQwen.metrics.answer_token_f1,
    verdict: "format_control_not_grounded_correctness_evidence",
    implication: "Local contract gating controls output shape but does not prove support without a grounded judge.",
  },
];

const qwen3bAcceptance = {
  direct_baseline: frontier.qwen3b_acceptance_target.direct_baseline,
  seventy_percent_operating_point: seventy,
  minimum: frontier.qwen3b_acceptance_target.recommended_minimum,
};

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "model_scale_adequacy_audit",
  status: "qwen3b_gpu_smoke_still_required",
  purpose: "Decide whether existing tiny/local models are adequate, or whether the bounded Qwen 3B GPU smoke remains necessary for the paper claim.",
  evidence_sources: [
    drag.run_id,
    compactQwen.run_id,
    contractQwen.run_id,
    frontier.run_id,
    packet.run_id,
    primeGate.run_id,
  ],
  systems,
  qwen3b_acceptance_target: qwen3bAcceptance,
  decision: {
    use_tiny_models_as_final_student: false,
    use_tiny_models_as_ground_truth_labelers: false,
    rent_gpu_for_bounded_qwen3b_smoke: true,
    rent_cutting_edge_large_gpu_model_now: false,
    rationale: [
      "The tiny Qwen 0.5B SFT result has high inline citation compliance but only 5.0% judged answer support and 42.0% overall judged correctness on the final window.",
      "The compact local Qwen 0.5B SFT path collapses to all abstentions, so it cannot answer the support-preserving distillation question.",
      "The best zero-call scaffold improves support/correctness by reducing answer coverage, so the missing evidence is a trained student that can recover useful coverage.",
      "The Qwen 3B joint-action packet already encodes answer repair, abstention, citation placement, and support-risk contrast; the next credible paid step is the bounded Qwen 3B smoke, not a larger open-ended GPU experiment.",
      "Prime auth currently blocks execution before wallet or live price checks, so no pod should be created until the auth/price gate passes under the $100 total cap.",
    ],
  },
  next_experiment: {
    run_id: "joint-action-qwen3b-smoke-eval-v1",
    base_model: "Qwen/Qwen2.5-3B-Instruct",
    packet_run_id: packet.run_id,
    constraints: {
      max_sft_steps: 20,
      max_dpo_steps: 10,
      push_to_hub: false,
      report_to: "none",
      require_prime_auth_price_gate_status: "auth_and_live_price_verified",
      max_total_budget_usd: 100,
    },
    success_condition: "Beat direct baseline support/correctness while keeping answer rate at or above 70%; otherwise report a negative result against the coverage-constrained frontier.",
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    external_compute_actual_usd: budget.spend_usd.external_compute,
    prime_auth_price_gate_status: primeGate.status,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit reads existing artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  decision: result.decision,
}, null, 2));

function systemRow(id, role, source, extra) {
  return {
    id,
    role,
    source_run: source.source_run,
    examples: source.examples,
    answer_rate: source.answer_rate,
    answer_support_rate: source.support_metrics?.answer_support_rate ?? null,
    overall_judged_correct_rate: source.support_metrics?.overall_judged_correct_rate ?? null,
    inline_citation_rate: source.reference_metrics?.inline_citation_rate ?? null,
    answer_token_f1: source.reference_metrics?.answer_token_f1 ?? null,
    verdict: extra.verdict,
    implication: extra.implication,
  };
}

function renderReport(result) {
  const rows = result.systems.map((row) => `| ${row.id} | ${row.role} | ${pct(row.answer_rate)} | ${pct(row.answer_support_rate)} | ${pct(row.overall_judged_correct_rate)} | ${pct(row.inline_citation_rate)} | ${row.verdict} |`).join("\n");
  return `# Model Scale Adequacy Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Systems

| System | Role | Answer rate | Answer support | Overall judged correctness | Inline citation rate | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | --- |
${rows}

## Decision

- Use tiny models as final student: ${result.decision.use_tiny_models_as_final_student ? "yes" : "no"}
- Use tiny models as ground-truth labelers: ${result.decision.use_tiny_models_as_ground_truth_labelers ? "yes" : "no"}
- Rent GPU for bounded Qwen 3B smoke: ${result.decision.rent_gpu_for_bounded_qwen3b_smoke ? "yes" : "no"}
- Rent cutting-edge large GPU model now: ${result.decision.rent_cutting_edge_large_gpu_model_now ? "yes" : "no"}

${result.decision.rationale.map((item) => `- ${item}`).join("\n")}

## Qwen 3B Target

- Minimum: ${result.qwen3b_acceptance_target.minimum}
- Success condition: ${result.next_experiment.success_condition}

## Budget

No OpenAI calls, no GPU jobs, and no new spend. Actual total spend remains $${result.budget.actual_total_spend_usd.toFixed(4)}; Prime auth/price gate is \`${result.budget.prime_auth_price_gate_status}\`.
`;
}

async function readResult(id) {
  return readJson(path.join(runDir, id, "result.json"));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}
