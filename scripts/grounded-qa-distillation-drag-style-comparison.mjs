import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "drag-like-rag-distillation-comparison-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const source = {
  directMini: await readResult("openai-student-direct-mini-extended-future-holdout-320-389-v1"),
  directRepair: await readResult("citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1"),
  directRepairJudge: await readResult("openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1"),
  riskGate: await readResult("risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1"),
  riskGateJudge: await readResult("openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1"),
  extractiveScaffold: await readResult("temporal-packet-scaffold-mini-negative-161-320-to-321-389-v1"),
  spanScaffold: await readResult("temporal-span-scaffold-hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1"),
  spanScaffoldJudge: await readResult("openai-judge-gpt4o-temporal-span-scaffold-mini-negative-161-320-to-321-389-v1"),
  localAnswerRepeatRepair: await readResult("citation-contract-repair-local-generative-sft-answer-repeat2-mini-negative-temporal-qwen05b-321-389-v1"),
  localAnswerRepeatJudge: await readResult("openai-judge-gpt4o-local-generative-sft-answer-repeat2-repair-qwen05b-321-389-v1"),
};

const systems = [
  systemRow({
    id: "direct_mini_rag_student",
    comparison_role: "generic_rag_to_small_model_reference",
    source_run: source.directRepair.run_id,
    judge_run: source.directRepairJudge.run_id,
    metrics: source.directRepair.metrics,
    judge: source.directRepairJudge.metrics,
    cost: {
      student_calls: source.directMini.calls_made,
      student_estimated_cost_usd: source.directMini.estimated_cost_usd,
      local_scaffold_calls: source.directRepair.calls_made,
      local_scaffold_cost_usd: source.directRepair.run_cost_usd,
      judge_calls: source.directRepairJudge.calls_made,
      judge_cost_usd: source.directRepairJudge.run_cost_usd,
    },
    interpretation: "Closest available generic direct-RAG student baseline: compact evidence pack in, answer with citations out, no support-aware post-training beyond local citation-contract repair.",
  }),
  systemRow({
    id: "zero_call_risk_gate_over_direct_student",
    comparison_role: "cheap_scaffold_over_generic_rag_student",
    source_run: source.riskGate.run_id,
    judge_run: source.riskGateJudge.run_id,
    metrics: source.riskGate.eval_metrics,
    judge: source.riskGateJudge.metrics,
    cost: {
      student_calls: 0,
      local_scaffold_calls: source.riskGate.cost?.llm_calls ?? 0,
      local_scaffold_cost_usd: source.riskGate.cost?.run_cost_usd ?? 0,
      judge_calls: source.riskGateJudge.calls_made,
      judge_cost_usd: source.riskGateJudge.run_cost_usd,
    },
    interpretation: "A cheap amortized scaffold can improve judged correctness over direct repair, but it does so by suppressing answers and losing answer/citation recall.",
  }),
  systemRow({
    id: "zero_call_extractive_distilled_scaffold",
    comparison_role: "local_distilled_rag_scaffold_floor",
    source_run: source.extractiveScaffold.run_id,
    judge_run: null,
    metrics: source.extractiveScaffold.eval,
    judge: null,
    cost: {
      student_calls: 0,
      local_scaffold_calls: source.extractiveScaffold.cost?.llm_calls ?? 0,
      local_scaffold_cost_usd: source.extractiveScaffold.cost?.estimated_inference_cost_usd ?? 0,
      judge_calls: 0,
      judge_cost_usd: 0,
    },
    interpretation: "A true zero-call local scaffold trained from distilled labels is cheap but underpowered on the final window: it over-abstains and has weak answer F1/recall.",
  }),
  systemRow({
    id: "zero_call_span_distilled_scaffold",
    comparison_role: "local_distilled_span_scaffold",
    source_run: source.spanScaffold.run_id,
    judge_run: source.spanScaffoldJudge.run_id,
    metrics: source.spanScaffold.eval,
    judge: source.spanScaffoldJudge.metrics,
    cost: {
      student_calls: 0,
      local_scaffold_calls: source.spanScaffold.cost?.llm_calls ?? 0,
      local_scaffold_cost_usd: source.spanScaffold.cost?.estimated_inference_cost_usd ?? 0,
      judge_calls: source.spanScaffoldJudge.calls_made,
      judge_cost_usd: source.spanScaffoldJudge.run_cost_usd,
    },
    interpretation: "Distilling to a span selector improves coverage over the extractive floor, but judged answer support remains low because selected spans can be topically relevant without answering the question.",
  }),
  systemRow({
    id: "local_qwen05b_sft_answer_repeat2",
    comparison_role: "tiny_foundation_model_distillation_failure_mode",
    source_run: source.localAnswerRepeatRepair.run_id,
    judge_run: source.localAnswerRepeatJudge.run_id,
    metrics: source.localAnswerRepeatRepair.metrics,
    judge: source.localAnswerRepeatJudge.metrics,
    cost: {
      student_calls: 0,
      local_scaffold_calls: source.localAnswerRepeatRepair.calls_made,
      local_scaffold_cost_usd: source.localAnswerRepeatRepair.run_cost_usd,
      judge_calls: source.localAnswerRepeatJudge.calls_made,
      judge_cost_usd: source.localAnswerRepeatJudge.run_cost_usd,
    },
    interpretation: "Naive local SFT on compact RAG labels can learn to emit cited answers but does not preserve support, showing why the paper needs support-aware joint-action data rather than generic SFT.",
  }),
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  comparison_type: "drag_like_generic_rag_distillation_comparison",
  scope: "extended_temporal_future_holdout examples 321-389",
  related_work_framing: {
    close_neighbor: "DRAG-like RAG-to-small-language-model distillation.",
    comparable_axis: "A smaller or cheaper model/scaffold answers from a compact retrieved evidence pack.",
    non_comparable_axis: "This project requires dated/evolving-KB splits, inline evidence citations, support-aware abstention, and judged citation-grounded correctness rather than answer-only utility.",
  },
  systems,
  synthesis: {
    headline: "Generic RAG distillation is an insufficient baseline unless it is judged on support and abstention under temporal update splits.",
    observations: [
      "The direct-mini RAG student plus citation repair reaches 72.5% GPT-4o judged correctness and 64.2% answer support, but still leaves unsupported answered claims.",
      "A zero-call risk gate improves overall judged correctness to 79.7% and answer support to 70.5%, but answers fewer examples and loses reference recall/F1.",
      "Zero-call distilled local scaffolds are materially cheaper but not competitive: the extractive scaffold answers 22/69 with 6.1% answer F1, while the span scaffold answers 52/69 but only 19.2% of answered spans are judged supported.",
      "The local Qwen 0.5B answer-repeat SFT result demonstrates the generic-SFT failure mode: 97.5% inline citation compliance with only 5.0% answer support.",
    ],
    conclusion_for_paper: "A DRAG-like comparison should be framed as a close baseline family, but the novel target is support-preserving data construction over evolving/private KBs. The next model result must show whether joint-action SFT/DPO improves support without relying on per-query teacher or verifier calls.",
    true_drag_reproduction_needed: [
      "Implement DRAG's exact teacher/student protocol if a reviewer asks for apples-to-apples reproduction.",
      "Evaluate it on the same final dated/private KB window with the same GPT-4o support judge.",
      "Report answer support, abstention support, citation precision/recall, and total inference cost rather than answer F1 alone.",
    ],
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This comparison reuses existing prediction and judge artifacts; it makes no new API calls and creates no GPU job.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function systemRow({ id, comparison_role, source_run, judge_run, metrics, judge, cost, interpretation }) {
  return {
    id,
    comparison_role,
    source_run,
    judge_run,
    examples: metrics.examples ?? metrics.examples_scored,
    answered: metrics.answered ?? null,
    answer_rate: numberOrNull(metrics.answer_rate) ?? rate(metrics.answered, metrics.examples ?? metrics.examples_scored),
    reference_metrics: {
      answer_type_accuracy: numberOrNull(metrics.answer_type_accuracy),
      citation_precision: numberOrNull(metrics.citation_precision),
      citation_recall: numberOrNull(metrics.citation_recall),
      answer_token_f1: numberOrNull(metrics.answer_token_f1),
      abstention_accuracy: numberOrNull(metrics.abstention_accuracy),
      inline_citation_rate: numberOrNull(metrics.inline_citation_rate),
    },
    support_metrics: judge ? {
      answer_support_rate: numberOrNull(judge.answer_support_rate),
      abstention_support_rate: numberOrNull(judge.abstention_support_rate),
      overall_judged_correct_rate: numberOrNull(judge.overall_judged_correct_rate),
      examples_judged: judge.examples_judged,
      answered_predictions: judge.answered_predictions,
    } : null,
    cost,
    interpretation,
  };
}

async function readResult(runId) {
  return JSON.parse(await fs.readFile(path.join(runDir, runId, "result.json"), "utf8"));
}

function renderReport(result) {
  const rows = result.systems.map((row) => `| ${row.id} | ${row.answered ?? "n/a"} | ${pct(row.answer_rate)} | ${pct(row.reference_metrics.citation_precision)} | ${pct(row.reference_metrics.citation_recall)} | ${pct(row.reference_metrics.answer_token_f1)} | ${pct(row.reference_metrics.inline_citation_rate)} | ${pct(row.support_metrics?.answer_support_rate)} | ${pct(row.support_metrics?.overall_judged_correct_rate)} |`).join("\n");
  return `# DRAG-Like RAG Distillation Comparison

Scope: ${result.scope}

This is a DRAG-like framing comparison over existing artifacts. It is not a full DRAG reproduction.

## Framing

- Close neighbor: ${result.related_work_framing.close_neighbor}
- Comparable axis: ${result.related_work_framing.comparable_axis}
- Non-comparable axis: ${result.related_work_framing.non_comparable_axis}

## Systems

| System | Answered | Answer rate | Citation precision | Citation recall | Answer F1 | Inline citation rate | Answer support | Overall judged correctness |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

## Interpretation

${result.synthesis.headline}

${result.synthesis.observations.map((item) => `- ${item}`).join("\n")}

## Paper Implication

${result.synthesis.conclusion_for_paper}

## True Reproduction Needed

${result.synthesis.true_drag_reproduction_needed.map((item) => `- ${item}`).join("\n")}

## Budget

No new OpenAI calls, no GPU jobs, and no new spend.
`;
}

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function rate(numerator, denominator) {
  if (!Number.isFinite(Number(numerator)) || !Number.isFinite(Number(denominator)) || Number(denominator) === 0) return null;
  return Number(numerator) / Number(denominator);
}

function pct(value) {
  return value == null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
