import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "longcite-style-citation-sft-comparison-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const systems = [
  await systemRow({
    id: "direct_mini_citation_repair",
    role: "stronger_existing_student_with_citation_contract_repair",
    predictionRun: "citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
    judgeRun: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
  }),
  await systemRow({
    id: "local_qwen05b_answer_repeat2_citation_repair",
    role: "citation_syntax_success_but_support_failure",
    predictionRun: "citation-contract-repair-local-generative-sft-answer-repeat2-mini-negative-temporal-qwen05b-321-389-v1",
    judgeRun: "openai-judge-gpt4o-local-generative-sft-answer-repeat2-repair-qwen05b-321-389-v1",
  }),
  await systemRow({
    id: "local_qwen05b_answered_only_citation_repair",
    role: "citation_syntax_only_unjudged_support",
    predictionRun: "citation-contract-repair-local-generative-sft-answered-only-mini-negative-temporal-qwen05b-321-389-v1",
    judgeRun: null,
  }),
];

const judged = systems.filter((row) => row.support_metrics);
const syntaxSupportGap = judged.map((row) => ({
  id: row.id,
  inline_citation_rate: row.syntax_metrics.inline_citation_rate,
  answer_support_rate: row.support_metrics.answer_support_rate,
  syntax_minus_support: row.syntax_metrics.inline_citation_rate - row.support_metrics.answer_support_rate,
}));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  comparison_type: "longcite_style_citation_sft_framing",
  motivation: "LongCite-style citation SFT makes citation production a natural baseline, but this project needs citation-grounded correctness, not just inline citation syntax.",
  source_runs: systems.map((row) => ({
    id: row.id,
    prediction_run: row.prediction_run,
    judge_run: row.judge_run,
  })),
  systems,
  synthesis: {
    headline: "Citation syntax compliance is not a proxy for grounded answer support.",
    key_observations: [
      "The local answer-repeat student reaches 97.5% inline citation compliance after zero-call citation repair, but only 5.0% of answered predictions are judged supported.",
      "The direct-mini citation-repair run reaches 100.0% inline citation compliance and 64.2% answer support, showing support depends on answer/evidence selection rather than bracket syntax alone.",
      "A citation-SFT comparison for this paper must report answer support, abstention support, and overall judged correctness, not only citation formatting metrics.",
    ],
    syntax_support_gap: syntaxSupportGap,
    readiness_gate_implication: "This satisfies the paper-readiness need for a LongCite-style citation-SFT framing comparison, but it does not replace the required trained Qwen 3B joint-action evaluation.",
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

async function systemRow({ id, role, predictionRun, judgeRun }) {
  const prediction = await readResult(predictionRun);
  const judge = judgeRun ? await readResult(judgeRun) : null;
  return {
    id,
    role,
    prediction_run: predictionRun,
    judge_run: judgeRun,
    eval_examples: prediction.eval_examples ?? prediction.metrics?.examples,
    answered: prediction.metrics?.answered,
    syntax_metrics: {
      inline_citation_rate: numberOrNull(prediction.metrics?.inline_citation_rate),
      citation_precision_against_reference_evidence: numberOrNull(prediction.metrics?.citation_precision),
      citation_recall_against_reference_evidence: numberOrNull(prediction.metrics?.citation_recall),
      answer_token_f1: numberOrNull(prediction.metrics?.answer_token_f1),
    },
    support_metrics: judge ? {
      answer_support_rate: numberOrNull(judge.metrics?.answer_support_rate),
      abstention_support_rate: numberOrNull(judge.metrics?.abstention_support_rate),
      overall_judged_correct_rate: numberOrNull(judge.metrics?.overall_judged_correct_rate),
      answered_predictions: judge.metrics?.answered_predictions,
      judged_by: judge.model,
      existing_judge_cost_usd: judge.run_cost_usd,
    } : null,
  };
}

async function readResult(runId) {
  return JSON.parse(await fs.readFile(path.join(runDir, runId, "result.json"), "utf8"));
}

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function pct(value) {
  return value == null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

function renderReport(result) {
  const rows = result.systems.map((row) => `| ${row.id} | ${row.answered} | ${pct(row.syntax_metrics.inline_citation_rate)} | ${pct(row.syntax_metrics.citation_precision_against_reference_evidence)} | ${pct(row.support_metrics?.answer_support_rate)} | ${pct(row.support_metrics?.overall_judged_correct_rate)} |`).join("\n");
  const gaps = result.synthesis.syntax_support_gap.map((row) => `- ${row.id}: inline citation ${pct(row.inline_citation_rate)} vs answer support ${pct(row.answer_support_rate)}; gap ${pct(row.syntax_minus_support)}`).join("\n");
  return `# LongCite-Style Citation SFT Comparison

This compares citation-syntax metrics against grounded support metrics using existing runs. It is a LongCite-style framing check, not a reproduction of LongCite.

## Systems

| System | Answered | Inline citation rate | Citation precision vs reference evidence | Answer support | Overall judged correctness |
| --- | ---: | ---: | ---: | ---: | ---: |
${rows}

## Syntax-Support Gap

${gaps}

## Interpretation

${result.synthesis.headline}

${result.synthesis.key_observations.map((item) => `- ${item}`).join("\n")}

## Budget

No new OpenAI calls, no GPU jobs, and no new spend.
`;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
