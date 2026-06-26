import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "risk-gate-transfer-synthesis-240-389-v1";
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);

const windows = [
  {
    label: "241-320",
    examples: 80,
    directRun: "citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
    directJudge: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
    gateJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  },
  {
    label: "321-389",
    examples: 69,
    directRun: "citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
    directJudge: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    gateJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  },
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const rows = [];
for (const window of windows) {
  const directRun = await readResult(window.directRun);
  const directJudge = await readResult(window.directJudge);
  const gateRun = await readResult(window.gateRun);
  const gateJudge = await readResult(window.gateJudge);
  rows.push({
    label: window.label,
    examples: window.examples,
    direct: summarizePolicy(directRun, directJudge),
    gate: summarizePolicy(gateRun, gateJudge),
  });
}

const aggregate = {
  direct: aggregatePolicy(rows.map((row) => ({ examples: row.examples, policy: row.direct }))),
  gate: aggregatePolicy(rows.map((row) => ({ examples: row.examples, policy: row.gate }))),
};
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  scope: "extended_temporal_future_holdout examples 241-389, excluding the threshold-selection window",
  llm_calls: 0,
  run_cost_usd: 0,
  windows: rows,
  aggregate,
  deltas: {
    answered_delta: aggregate.gate.answered - aggregate.direct.answered,
    overall_judged_correct_delta: aggregate.gate.overall_judged_correct_rate - aggregate.direct.overall_judged_correct_rate,
    answer_support_delta: aggregate.gate.answer_support_rate - aggregate.direct.answer_support_rate,
    answer_f1_delta: aggregate.gate.answer_token_f1 - aggregate.direct.answer_token_f1,
    citation_recall_delta: aggregate.gate.citation_recall - aggregate.direct.citation_recall,
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(reportPath, renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  summary_report: path.relative(rootDir, reportPath),
  aggregate: result.aggregate,
  deltas: result.deltas,
}, null, 2));

function summarizePolicy(runResult, judgeResult) {
  const metrics = runResult.metrics ?? runResult.eval_metrics;
  if (!metrics) throw new Error(`Run ${runResult.run_id} is missing metrics/eval_metrics.`);
  return {
    answered: metrics.answered,
    abstained: metrics.abstained,
    answer_type_accuracy: metrics.answer_type_accuracy,
    citation_precision: metrics.citation_precision,
    citation_recall: metrics.citation_recall,
    answer_token_f1: metrics.answer_token_f1,
    inline_citation_rate: metrics.inline_citation_rate,
    answer_support_rate: judgeResult.metrics.answer_support_rate,
    abstention_support_rate: judgeResult.metrics.abstention_support_rate,
    overall_judged_correct_rate: judgeResult.metrics.overall_judged_correct_rate,
    judge_run_cost_usd: judgeResult.run_cost_usd,
  };
}

function aggregatePolicy(entries) {
  const examples = sum(entries.map((entry) => entry.examples));
  const answered = sum(entries.map((entry) => entry.policy.answered));
  const abstained = sum(entries.map((entry) => entry.policy.abstained));
  const supportedAnswers = sum(entries.map((entry) => entry.policy.answered * entry.policy.answer_support_rate));
  const supportedAbstentions = sum(entries.map((entry) => entry.policy.abstained * entry.policy.abstention_support_rate));
  const correct = sum(entries.map((entry) => entry.examples * entry.policy.overall_judged_correct_rate));
  return {
    examples,
    answered,
    abstained,
    answer_rate: answered / examples,
    answer_type_accuracy: weighted(entries, "answer_type_accuracy"),
    citation_precision: weighted(entries, "citation_precision"),
    citation_recall: weighted(entries, "citation_recall"),
    answer_token_f1: weighted(entries, "answer_token_f1"),
    inline_citation_rate: weightedByAnswered(entries, "inline_citation_rate"),
    answer_support_rate: answered ? supportedAnswers / answered : 0,
    abstention_support_rate: abstained ? supportedAbstentions / abstained : 0,
    overall_judged_correct_rate: correct / examples,
    judge_run_cost_usd: sum(entries.map((entry) => entry.policy.judge_run_cost_usd)),
  };
}

function weighted(entries, key) {
  return sum(entries.map((entry) => entry.examples * entry.policy[key])) / sum(entries.map((entry) => entry.examples));
}

function weightedByAnswered(entries, key) {
  const answered = sum(entries.map((entry) => entry.policy.answered));
  return answered ? sum(entries.map((entry) => entry.policy.answered * entry.policy[key])) / answered : 0;
}

function renderReport(result) {
  const lines = [
    "# Risk-Gate Transfer Synthesis",
    "",
    `Scope: ${result.scope}`,
    "",
    "This synthesis makes no LLM calls. It aggregates already-judged transfer windows after the threshold-selection window.",
    "",
    "| Policy | Examples | Answered | Answer rate | Citation precision | Citation recall | Answer F1 | Inline citation rate | GPT-4o answer support | GPT-4o overall correct |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    policyRow("Direct mini + citation repair", result.aggregate.direct),
    policyRow("Balanced claim-pruner-label risk gate", result.aggregate.gate),
    "",
    "## Deltas",
    "",
    `- Answered examples: ${signed(result.deltas.answered_delta)}`,
    `- GPT-4o overall judged correctness: ${signedPct(result.deltas.overall_judged_correct_delta)}`,
    `- GPT-4o answer support: ${signedPct(result.deltas.answer_support_delta)}`,
    `- Answer token F1: ${signedPct(result.deltas.answer_f1_delta)}`,
    `- Citation recall: ${signedPct(result.deltas.citation_recall_delta)}`,
    "",
    "## Window Details",
    "",
    "| Window | Policy | Answered | GPT-4o answer support | GPT-4o overall correct |",
    "| --- | --- | ---: | ---: | ---: |",
  ];
  for (const row of result.windows) {
    lines.push(`| ${row.label} | Direct repair | ${row.direct.answered} | ${pct(row.direct.answer_support_rate)} | ${pct(row.direct.overall_judged_correct_rate)} |`);
    lines.push(`| ${row.label} | Risk gate | ${row.gate.answered} | ${pct(row.gate.answer_support_rate)} | ${pct(row.gate.overall_judged_correct_rate)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function policyRow(label, policy) {
  return `| ${label} | ${policy.examples} | ${policy.answered} | ${pct(policy.answer_rate)} | ${pct(policy.citation_precision)} | ${pct(policy.citation_recall)} | ${pct(policy.answer_token_f1)} | ${pct(policy.inline_citation_rate)} | ${pct(policy.answer_support_rate)} | ${pct(policy.overall_judged_correct_rate)} |`;
}

async function readResult(runId) {
  return JSON.parse(await fs.readFile(path.join(runDir, runId, "result.json"), "utf8"));
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function signedPct(value) {
  const rendered = `${(value * 100).toFixed(1)}pp`;
  return value > 0 ? `+${rendered}` : rendered;
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
