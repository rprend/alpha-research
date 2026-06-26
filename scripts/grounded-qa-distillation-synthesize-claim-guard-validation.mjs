import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "claim-entailment-guard-validation-240-389-v1";
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);

const transferSynthesis = await readJson("risk-gate-transfer-synthesis-240-389-v1");
const guardRun = await readJson("claim-entailment-guard-balanced-risk-gate-240-389-v1");
const guardJudge = await readJson("openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1");

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const direct = transferSynthesis.aggregate.direct;
const gate = transferSynthesis.aggregate.gate;
const guard = {
  examples: guardRun.metrics.examples,
  answered: guardRun.metrics.answered,
  abstained: guardRun.metrics.abstained,
  answer_rate: guardRun.metrics.answered / guardRun.metrics.examples,
  answer_type_accuracy: guardRun.metrics.answer_type_accuracy,
  citation_precision: guardRun.metrics.citation_precision,
  citation_recall: guardRun.metrics.citation_recall,
  answer_token_f1: guardRun.metrics.answer_token_f1,
  inline_citation_rate: guardRun.metrics.inline_citation_rate,
  answer_support_rate: guardJudge.metrics.answer_support_rate,
  abstention_support_rate: guardJudge.metrics.abstention_support_rate,
  overall_judged_correct_rate: guardJudge.metrics.overall_judged_correct_rate,
  judge_run_cost_usd: guardJudge.run_cost_usd,
};

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  scope: "extended_temporal_future_holdout examples 241-389",
  llm_calls: 0,
  run_cost_usd: 0,
  note: "This synthesis reads existing run artifacts only; the guard judge run made the paid calls.",
  source_runs: {
    transfer_synthesis: transferSynthesis.run_id,
    guard_run: guardRun.run_id,
    guard_judge: guardJudge.run_id,
  },
  policies: {
    direct_mini_repair: direct,
    balanced_risk_gate: gate,
    claim_entailment_guard: guard,
  },
  deltas: {
    gate_vs_direct: delta(gate, direct),
    guard_vs_gate: delta(guard, gate),
    guard_vs_direct: delta(guard, direct),
  },
  guard_summary: guardRun.guard_summary,
  guard_judge_cost_usd: guardJudge.run_cost_usd,
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(reportPath, renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  summary_report: path.relative(rootDir, reportPath),
  guard_vs_gate: result.deltas.guard_vs_gate,
  guard_vs_direct: result.deltas.guard_vs_direct,
}, null, 2));

function delta(left, right) {
  return {
    answered_delta: left.answered - right.answered,
    answer_rate_delta: left.answer_rate - right.answer_rate,
    answer_support_delta: left.answer_support_rate - right.answer_support_rate,
    abstention_support_delta: left.abstention_support_rate - right.abstention_support_rate,
    overall_judged_correct_delta: left.overall_judged_correct_rate - right.overall_judged_correct_rate,
    citation_recall_delta: left.citation_recall - right.citation_recall,
    answer_f1_delta: left.answer_token_f1 - right.answer_token_f1,
  };
}

function renderReport(result) {
  return `# Claim-Entailment Guard Validation

Scope: ${result.scope}

This synthesis makes no LLM calls. It compares the fresh \`gpt-4o\` judge result for the deterministic claim-entailment guard with the already judged direct-mini and balanced-risk-gate transfer results.

| Policy | Answered | Answer rate | Citation precision | Citation recall | Answer F1 | GPT-4o answer support | GPT-4o abstention support | GPT-4o overall correct |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${policyRow("Direct mini + citation repair", result.policies.direct_mini_repair)}
${policyRow("Balanced support-risk gate", result.policies.balanced_risk_gate)}
${policyRow("Risk gate + claim-entailment guard", result.policies.claim_entailment_guard)}

## Guard Delta

Versus the balanced support-risk gate:

- Answered examples: ${signed(result.deltas.guard_vs_gate.answered_delta)}
- GPT-4o overall judged correctness: ${signedPct(result.deltas.guard_vs_gate.overall_judged_correct_delta)}
- GPT-4o answer support: ${signedPct(result.deltas.guard_vs_gate.answer_support_delta)}
- Citation recall: ${signedPct(result.deltas.guard_vs_gate.citation_recall_delta)}
- Answer F1: ${signedPct(result.deltas.guard_vs_gate.answer_f1_delta)}

The guard judge run made ${result.policies.claim_entailment_guard.examples} \`gpt-4o\` calls and cost $${result.guard_judge_cost_usd.toFixed(7)}. The deterministic guard itself makes zero inference-time LLM calls.

## Interpretation

Fresh judging confirms that the conservative numeric/comparative claim-entailment guard is a small positive support layer over the balanced risk gate: it raises overall correctness and answer support while giving up five answered examples. It is still a narrow heuristic, not a final verifier, because most retained unsupported answers remain unsuppressed and answer F1/citation recall remain below direct mini prompting.
`;
}

function policyRow(label, policy) {
  return `| ${label} | ${policy.answered} | ${pct(policy.answer_rate)} | ${pct(policy.citation_precision)} | ${pct(policy.citation_recall)} | ${pct(policy.answer_token_f1)} | ${pct(policy.answer_support_rate)} | ${pct(policy.abstention_support_rate)} | ${pct(policy.overall_judged_correct_rate)} |`;
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function signedPct(value) {
  const rendered = `${(Number(value) * 100).toFixed(1)}pp`;
  return value > 0 ? `+${rendered}` : rendered;
}

async function readJson(runId) {
  return JSON.parse(await fs.readFile(path.join(runDir, runId, "result.json"), "utf8"));
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : true;
  }
  return parsed;
}
