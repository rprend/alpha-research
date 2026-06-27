import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "distillation-loss-accounting-2026-06-27-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const modelScale = await readResult("model-scale-adequacy-audit-2026-06-26-v1");
const pareto = await readResult("cost-coverage-support-pareto-2026-06-26-v1");
const policyAblation = await readResult("post-training-policy-ablation-2026-06-26-v1");
const coverageFrontier = await readResult("coverage-constrained-support-frontier-2026-06-26-v1");
const selector = await readResult("candidate-selector-cross-window-240-320-to-321-389-v1");
const judgeReliability = await readResult("judge-disagreement-taxonomy-judge-reliability-second-pass-run-2026-06-26-v2");
const amortization = await readResult("amortization-break-even-qwen3b-2026-06-26-v1");
const novelty = await readResult("novelty-watchlist-2026-06-26-v1");
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const direct = findSystem(pareto.systems, "direct_mini_repair");
const claimGuard = findSystem(pareto.systems, "claim_entailment_guard");
const spanScaffold = findSystem(pareto.systems, "zero_call_span_distilled_scaffold");
const qwen05b = findSystem(pareto.systems, "local_qwen05b_sft_answer_repeat2");
const finalDirect = findSystem(modelScale.systems, "direct_mini_rag_student");
const riskGateFinal = findSystem(modelScale.systems, "zero_call_risk_gate_over_direct_student");
const qwen3bBase = findSystem(modelScale.systems, "local_qwen3b_base_control");
const qwen3bRepaired = findSystem(modelScale.systems, "local_qwen3b_base_citation_repair");
const selectorBaseline = selector.selected_rule_metrics.eval;

const preservationRows = [
  row("direct_mini_repair", "api_baseline", direct, {
    preserves: ["coverage", "citation_format"],
    loses: ["answer_support", "zero_call_inference"],
    lesson: "The direct small API student is the coverage baseline, but unsupported answers remain too frequent.",
  }),
  row("claim_entailment_guard", "zero_extra_call_guard", claimGuard, {
    baseline: direct,
    preserves: ["answer_support", "abstention_support"],
    loses: ["coverage", "answer_recall"],
    lesson: "Support improves, but the gain is bought mainly by abstaining more.",
  }),
  row("zero_call_span_distilled_scaffold", "local_zero_call_scaffold", spanScaffold, {
    baseline: direct,
    preserves: ["zero_call_inference", "some_coverage"],
    loses: ["answer_support", "answer_f1"],
    lesson: "Cheap local selection can answer often, but topical spans do not preserve claim support.",
  }),
  row("local_qwen05b_sft_answer_repeat2", "tiny_sft_model", qwen05b, {
    baseline: direct,
    preserves: ["zero_call_inference", "citation_format"],
    loses: ["answer_support", "citation_recall", "coverage"],
    lesson: "Generic tiny-model SFT learns citation shape without preserving grounded support.",
  }),
  row("zero_call_risk_gate_final_window", "final_window_scaffold", riskGateFinal, {
    baseline: finalDirect,
    preserves: ["answer_support", "overall_correctness", "citation_format"],
    loses: ["coverage", "answer_f1"],
    lesson: "On the final 69-example window, the zero-call gate improves support/correctness but suppresses answers.",
  }),
  row("local_qwen3b_base_control", "untrained_3b_control", qwen3bBase, {
    baseline: finalDirect,
    preserves: ["coverage"],
    loses: ["citation_format", "json_contract", "trained_adapter_evidence"],
    lesson: "Scale alone is not enough; the untrained 3B base has weak contract compliance and no judged support.",
  }),
  row("local_qwen3b_base_citation_repair", "syntax_repair_control", qwen3bRepaired, {
    baseline: qwen3bBase,
    preserves: ["citation_format"],
    loses: ["support_evidence", "answer_f1"],
    lesson: "Deterministic citation repair proves syntax can be fixed without proving support.",
  }),
];

const qwenAcceptanceContract = {
  target_run_id: "joint-action-qwen3b-smoke-eval-v1",
  must_preserve_or_improve: [
    {
      dimension: "answer_support_rate",
      comparator: "direct baseline, deployable selector baseline, and 70% coverage-constrained frontier",
      minimum: "Beat both the direct baseline and deployable selector baseline while keeping answer rate above 70%; report the delta to the 70% coverage-constrained frontier separately.",
      minimum_direct_baseline: coverageFrontier.qwen3b_acceptance_target.direct_baseline.answer_support_rate,
      minimum_deployable_selector_baseline: selectorBaseline.answer_support_rate,
      minimum_70pct_frontier: coverageFrontier.coverage_constrained_operating_points.find((point) => point.min_answer_rate === 0.7)?.selected.answer_support_rate,
    },
    {
      dimension: "overall_judged_correct_rate",
      comparator: "direct baseline, deployable selector baseline, and 70% coverage-constrained frontier",
      minimum: "Beat both the direct baseline and deployable selector baseline while keeping answer rate above 70%; report the delta to the 70% coverage-constrained frontier separately.",
      minimum_direct_baseline: coverageFrontier.qwen3b_acceptance_target.direct_baseline.overall_judged_correct_rate,
      minimum_deployable_selector_baseline: selectorBaseline.overall_judged_correct_rate,
      minimum_70pct_frontier: coverageFrontier.coverage_constrained_operating_points.find((point) => point.min_answer_rate === 0.7)?.selected.overall_judged_correct_rate,
    },
    {
      dimension: "answer_rate",
      comparator: "coverage collapse guard",
      minimum: 0.7,
    },
    {
      dimension: "citation_support_and_recall",
      comparator: "not citation syntax alone",
      minimum: "Report citation recall and answer support jointly; syntax-only repaired controls are negative evidence.",
    },
    {
      dimension: "abstention_boundaries",
      comparator: "judge reliability caveat",
      minimum: "Report disagreement taxonomy and avoid solved-abstention-boundary claims.",
    },
    {
      dimension: "amortized_cost",
      comparator: "planned zero-call deployed model/scaffold",
      minimum: `Stay under $100 total budget and rerun ${amortization.run_id} with actual GPU/judge spend.`,
    },
  ],
  failure_policy: [
    "If Qwen improves support only by dropping below 70% answer rate, report a coverage/support tradeoff rather than support-preserving distillation.",
    "If Qwen preserves citation syntax but not judged support, report a negative result analogous to the local Qwen 0.5B and syntax-repair controls.",
    "If Qwen improves judged correctness but depends on per-query LLM verification, it is not the final amortized system.",
  ],
};

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "distillation_loss_accounting",
  status: "loss_accounting_ready_waiting_for_qwen3b",
  purpose: "State what each cheaper student/scaffold preserves and loses relative to expensive grounded behavior so the paper cannot equate low cost or citation syntax with grounded correctness.",
  novelty_pressure_source: {
    run_id: novelty.run_id,
    trigger: "The refreshed novelty watchlist requires a distillation-loss statement covering answer support, citation support, abstention boundaries, update robustness, coverage, and cost.",
  },
  preservation_rows: preservationRows,
  aggregate_lessons: [
    "Current zero-call systems are cheap but either lose support or lose answer coverage.",
    "Citation format is not a preservation target by itself; repaired syntax can coexist with weak support.",
    "Abstention support is strong in many systems, but abstention-boundary disagreements remain a reporting limitation.",
    "The trained Qwen 3B row must be judged as a preservation/loss tradeoff, not only as a score improvement.",
  ],
  qwen_acceptance_contract: qwenAcceptanceContract,
  judge_reliability_context: {
    run_id: judgeReliability.run_id,
    disagreement_rate: judgeReliability.source_summary.disagreement_rate,
    dominant_disagreement_type: "abstention_boundary_reversal",
    implication: "Distillation-loss accounting must keep abstention-boundary preservation caveated until human/stronger-judge adjudication exists.",
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    external_compute_actual_usd: budget.spend_usd.external_compute,
  },
  source_artifacts: [
    modelScale.run_id,
    pareto.run_id,
    policyAblation.run_id,
    coverageFrontier.run_id,
    selector.run_id,
    judgeReliability.run_id,
    amortization.run_id,
    novelty.run_id,
  ],
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This artifact reads local result files only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function row(id, family, system, extra) {
  const baseline = extra.baseline ?? null;
  return {
    id,
    family,
    source_run_id: system?.source_run_id ?? system?.source_run ?? null,
    examples: system?.examples ?? null,
    answer_rate: system?.answer_rate ?? null,
    answer_support_rate: system?.answer_support_rate ?? null,
    abstention_support_rate: system?.abstention_support_rate ?? null,
    overall_judged_correct_rate: system?.overall_judged_correct_rate ?? null,
    citation_recall: system?.citation_recall ?? null,
    inline_citation_rate: system?.inline_citation_rate ?? null,
    answer_token_f1: system?.answer_token_f1 ?? null,
    online_openai_calls_per_query: system?.online_openai_calls_per_query ?? 0,
    deltas_vs_baseline: baseline ? {
      answer_rate: delta(system?.answer_rate, baseline.answer_rate),
      answer_support_rate: delta(system?.answer_support_rate, baseline.answer_support_rate),
      overall_judged_correct_rate: delta(system?.overall_judged_correct_rate, baseline.overall_judged_correct_rate),
      answer_token_f1: delta(system?.answer_token_f1, baseline.answer_token_f1),
      inline_citation_rate: delta(system?.inline_citation_rate, baseline.inline_citation_rate),
    } : null,
    preserves: extra.preserves,
    loses: extra.loses,
    lesson: extra.lesson,
  };
}

function delta(value, baseline) {
  if (value == null || baseline == null) return null;
  return Number(value) - Number(baseline);
}

function renderReport(result) {
  return `# Distillation-Loss Accounting

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Preservation/Loss Rows

| System | Family | Answer rate | Answer support | Overall judged correct | Online calls/query | Preserves | Loses |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
${result.preservation_rows.map((row) => `| ${row.id} | ${row.family} | ${pct(row.answer_rate)} | ${pct(row.answer_support_rate)} | ${pct(row.overall_judged_correct_rate)} | ${row.online_openai_calls_per_query} | ${row.preserves.join(", ")} | ${row.loses.join(", ")} |`).join("\n")}

## Aggregate Lessons

${result.aggregate_lessons.map((item) => `- ${item}`).join("\n")}

## Qwen 3B Acceptance Contract

${result.qwen_acceptance_contract.must_preserve_or_improve.map((item) => `- ${item.dimension}: compare against ${item.comparator}.`).join("\n")}

## Failure Policy

${result.qwen_acceptance_contract.failure_policy.map((item) => `- ${item}`).join("\n")}

No OpenAI calls, GPU jobs, or new spend were made for this artifact.
`;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

function findSystem(rows, id) {
  return rows.find((row) => row.id === id) ?? {};
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
