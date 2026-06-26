import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "nli-det-guard-synthesis-240-389-v1";
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);

const nliRun = args["nli-run"] ?? "pretrained-nli-verifier-combined-labels-240-389-v1";
const guardRun = args["guard-run"] ?? "claim-entailment-guard-balanced-risk-gate-240-389-v1";
const miniTeacherRun = args["mini-teacher-run"] ?? "mini-verifier-gate-balanced-risk-gate-240-389-v1";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const nliRows = keyed(await readJsonl(path.join(runDir, nliRun, "predictions.jsonl")));
const guardRows = keyed(await readJsonl(path.join(runDir, guardRun, "predictions.jsonl")));
const miniTeacherRows = keyed(await readJsonl(path.join(runDir, miniTeacherRun, "examples.jsonl")));

const exampleIds = [...nliRows.keys()].sort();
const rows = exampleIds.map((exampleId) => {
  const nli = nliRows.get(exampleId);
  const guard = guardRows.get(exampleId);
  const miniTeacher = miniTeacherRows.get(exampleId);
  if (!guard || !miniTeacher) throw new Error(`Missing synthesis source row for ${exampleId}`);
  const answerType = nli.source_prediction.answer_type;
  const strongKeep = nli.labels.strong_keep === true;
  return {
    example_id: exampleId,
    window: nli.window,
    answer_type: answerType,
    source_prediction: nli.source_prediction,
    strong_keep: strongKeep,
    strong_verdict: nli.labels.strong_verdict,
    nli_fires: nli.metadata.gate_fired === true,
    nli_score: nli.metadata.nli_entailment_score,
    nli_threshold: nli.metadata.threshold,
    det_fires: guard.metadata?.claim_guard_fired === true,
    mini_fires: miniTeacher.mini_suppresses === true,
    combined_teacher_fires: miniTeacher.combined_suppresses === true,
  };
});

const policies = [
  {
    id: "balanced_gate",
    label: "Balanced support-risk gate",
    suppresses: () => false,
  },
  {
    id: "deterministic_guard",
    label: "Deterministic claim-entailment guard",
    suppresses: (row) => row.answer_type === "grounded_answer" && row.det_fires,
  },
  {
    id: "pretrained_nli",
    label: "Pretrained NLI verifier",
    suppresses: (row) => row.answer_type === "grounded_answer" && row.nli_fires,
  },
  {
    id: "nli_or_det_guard",
    label: "NLI OR deterministic guard",
    suppresses: (row) => row.answer_type === "grounded_answer" && (row.nli_fires || row.det_fires),
  },
  {
    id: "nli_and_det_guard",
    label: "NLI AND deterministic guard",
    suppresses: (row) => row.answer_type === "grounded_answer" && row.nli_fires && row.det_fires,
  },
  {
    id: "mini_det_teacher",
    label: "Mini-negative OR deterministic teacher",
    suppresses: (row) => row.answer_type === "grounded_answer" && row.combined_teacher_fires,
  },
];

const predictionsByPolicy = Object.fromEntries(policies.map((policy) => [
  policy.id,
  rows.map((row) => predictionFor(row, policy.id, policy.suppresses(row))),
]));
const policyResults = policies.map((policy) => ({
  id: policy.id,
  label: policy.label,
  metrics: summarize(predictionsByPolicy[policy.id]),
}));
const pairwise = {
  nli_vs_det_guard: overlap(rows, (row) => row.nli_fires, (row) => row.det_fires),
  nli_vs_combined_teacher: overlap(rows, (row) => row.nli_fires, (row) => row.combined_teacher_fires),
  det_guard_vs_combined_teacher: overlap(rows, (row) => row.det_fires, (row) => row.combined_teacher_fires),
};
const baseline = policyResults.find((policy) => policy.id === "balanced_gate").metrics;
for (const policy of policyResults) policy.delta_vs_balanced = delta(policy.metrics, baseline);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  scope: "zero-call synthesis of pretrained NLI verifier and deterministic claim-entailment guard on balanced-gate transfer examples 241-389",
  llm_calls: 0,
  run_cost_usd: 0,
  source_runs: { nli_run: nliRun, guard_run: guardRun, mini_teacher_run: miniTeacherRun },
  policies: policyResults,
  pairwise,
  fired_examples: rows
    .filter((row) => row.nli_fires || row.det_fires || row.combined_teacher_fires)
    .map(renderFiredExample),
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), Object.entries(predictionsByPolicy).flatMap(([policy, predictions]) => predictions.map((row) => ({ ...row, policy }))));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(reportPath, renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  summary_report: path.relative(rootDir, reportPath),
  policies: result.policies,
  pairwise: result.pairwise,
}, null, 2));

function predictionFor(row, policy, suppress) {
  return {
    example_id: row.example_id,
    window: row.window,
    prediction: suppress ? abstainPrediction(policy) : row.source_prediction,
    source_prediction: row.source_prediction,
    metadata: {
      scaffold: policy,
      gate_fired: suppress,
      nli_fires: row.nli_fires,
      deterministic_guard_fires: row.det_fires,
      mini_fires: row.mini_fires,
      nli_score: row.nli_score,
      nli_threshold: row.nli_threshold,
    },
    labels: {
      strong_keep: row.strong_keep,
      strong_verdict: row.strong_verdict,
    },
    inherited_judgment: {
      support_oracle_correct: suppress ? !row.strong_keep : row.strong_keep,
      interpretation: suppress
        ? (row.strong_keep ? "harmful_suppression_supported_answer" : "suppressed_unsupported_answer")
        : "unchanged",
    },
  };
}

function summarize(predictions) {
  const answered = predictions.filter((row) => row.prediction.answer_type === "grounded_answer");
  const correct = predictions.filter((row) => row.inherited_judgment.support_oracle_correct);
  const supportedAnswers = answered.filter((row) => row.labels.strong_keep);
  const suppressions = predictions.filter((row) => row.metadata.gate_fired);
  return {
    examples: predictions.length,
    answered: answered.length,
    abstained: predictions.length - answered.length,
    answer_rate: ratio(answered.length, predictions.length),
    support_oracle_correct: correct.length,
    support_oracle_correct_rate: ratio(correct.length, predictions.length),
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    gate_fired: suppressions.length,
    suppressed_unsupported: suppressions.filter((row) => row.inherited_judgment.interpretation === "suppressed_unsupported_answer").length,
    harmful_suppressed_supported: suppressions.filter((row) => row.inherited_judgment.interpretation === "harmful_suppression_supported_answer").length,
  };
}

function overlap(rows, leftFn, rightFn) {
  const answered = rows.filter((row) => row.answer_type === "grounded_answer");
  const left = answered.filter(leftFn);
  const right = answered.filter(rightFn);
  const both = answered.filter((row) => leftFn(row) && rightFn(row));
  const either = answered.filter((row) => leftFn(row) || rightFn(row));
  return {
    left: left.length,
    right: right.length,
    both: both.length,
    either: either.length,
    either_suppressed_unsupported: either.filter((row) => !row.strong_keep).length,
    either_harmful_supported: either.filter((row) => row.strong_keep).length,
  };
}

function delta(left, right) {
  return {
    answered_delta: left.answered - right.answered,
    support_oracle_correct_delta: left.support_oracle_correct - right.support_oracle_correct,
    support_oracle_correct_rate_delta: left.support_oracle_correct_rate - right.support_oracle_correct_rate,
    answer_support_rate_delta: left.answer_support_rate - right.answer_support_rate,
    gate_fired_delta: left.gate_fired - right.gate_fired,
  };
}

function renderFiredExample(row) {
  return {
    example_id: row.example_id,
    window: row.window,
    strong_keep: row.strong_keep,
    strong_verdict: row.strong_verdict,
    nli_fires: row.nli_fires,
    det_fires: row.det_fires,
    mini_fires: row.mini_fires,
    combined_teacher_fires: row.combined_teacher_fires,
    nli_score: row.nli_score,
    answer_preview: compact(row.source_prediction.answer, 220),
  };
}

function abstainPrediction(policy) {
  return {
    answer_type: "abstain",
    answer: "The cited evidence does not provide enough support for the generated claim.",
    citations: [],
    claim_table: [{
      claim: "A local verifier policy rejected the generated answer as insufficiently supported.",
      support: policy,
      citations: [],
    }],
    abstention_reason: `Suppressed by ${policy}.`,
  };
}

function renderReport(result) {
  const policyRows = result.policies.map((policy) => (
    `| ${policy.label} | ${policy.metrics.support_oracle_correct} / ${policy.metrics.examples} (${pct(policy.metrics.support_oracle_correct_rate)}) | ${policy.metrics.answered} | ${pct(policy.metrics.answer_support_rate)} | ${policy.metrics.gate_fired} | ${policy.metrics.suppressed_unsupported} | ${policy.metrics.harmful_suppressed_supported} | ${signed(policy.delta_vs_balanced.support_oracle_correct_delta)} | ${signedPct(policy.delta_vs_balanced.support_oracle_correct_rate_delta)} |`
  )).join("\n");
  const pairRows = Object.entries(result.pairwise).map(([name, stats]) => (
    `| ${name.replaceAll("_", " ")} | ${stats.left} | ${stats.right} | ${stats.both} | ${stats.either} | ${stats.either_suppressed_unsupported} | ${stats.either_harmful_supported} |`
  )).join("\n");
  const firedRows = result.fired_examples.map((row) => (
    `| \`${row.example_id}\` | ${row.strong_keep ? "supported" : "unsupported"} | ${row.nli_fires ? "yes" : "no"} | ${row.det_fires ? "yes" : "no"} | ${row.mini_fires ? "yes" : "no"} | ${row.combined_teacher_fires ? "yes" : "no"} | ${row.nli_score == null ? "" : row.nli_score.toFixed(3)} | ${escapeCell(row.answer_preview)} |`
  )).join("\n");
  return `# NLI And Deterministic Guard Synthesis

Scope: ${result.scope}

This synthesis makes no LLM calls and no new model calls. It combines existing predictions from \`${result.source_runs.nli_run}\`, \`${result.source_runs.guard_run}\`, and \`${result.source_runs.mini_teacher_run}\`.

## Policy Comparison

| Policy | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions | Delta rows vs balanced | Delta rate vs balanced |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${policyRows}

## Signal Overlap

| Pair | Left fires | Right fires | Both fire | Either fires | Either useful | Either harmful |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${pairRows}

## Fired Examples

| Example | Strong label | NLI | Deterministic | Mini | Combined teacher | NLI score | Answer preview |
| --- | --- | --- | --- | --- | --- | ---: | --- |
${firedRows}

## Interpretation

The union policy tests whether pretrained NLI and deterministic claim checks catch complementary retained errors. The intersection policy tests whether agreement improves precision enough to matter.
`;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
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

function compact(value, length) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= length ? text : `${text.slice(0, length - 3)}...`;
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function keyed(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
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
