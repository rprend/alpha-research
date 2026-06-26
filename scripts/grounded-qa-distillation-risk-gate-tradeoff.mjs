import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "risk-gate-tradeoff-240-389-v1";
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);

const windows = [
  {
    label: "241-320",
    directRun: "citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
    directJudge: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
    gateJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  },
  {
    label: "321-389",
    directRun: "citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
    directJudge: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    gateJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  },
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const examples = [];
for (const window of windows) {
  const directPredictions = keyed(await readJsonl(path.join(runDir, window.directRun, "predictions.jsonl")));
  const directJudgments = keyed(await readJsonl(path.join(runDir, window.directJudge, "judgments.jsonl")));
  const gatePredictions = keyed(await readJsonl(path.join(runDir, window.gateRun, "predictions.jsonl")));
  const gateJudgments = keyed(await readJsonl(path.join(runDir, window.gateJudge, "judgments.jsonl")));
  for (const [exampleId, directRow] of directPredictions) {
    const gateRow = gatePredictions.get(exampleId);
    const directJudgment = directJudgments.get(exampleId)?.judgment;
    const gateJudgment = gateJudgments.get(exampleId)?.judgment;
    if (!gateRow || !directJudgment || !gateJudgment) continue;
    const directAnswerType = normalizeAnswerType(directRow.prediction?.answer_type);
    const gateAnswerType = normalizeAnswerType(gateRow.prediction?.answer_type);
    const directSupported = directAnswerType === "grounded_answer" && isSupportedAnswer(directJudgment);
    const gateCorrect = gateAnswerType === "grounded_answer"
      ? isSupportedAnswer(gateJudgment)
      : isCorrectAbstention(gateJudgment);
    const category = categorize({
      directAnswerType,
      gateAnswerType,
      directSupported,
      gateCorrect,
      gateFired: Boolean(gateRow.metadata?.gate_fired),
    });
    examples.push({
      example_id: exampleId,
      window: window.label,
      category,
      direct_answer_type: directAnswerType,
      gate_answer_type: gateAnswerType,
      gate_fired: Boolean(gateRow.metadata?.gate_fired),
      support_score: gateRow.metadata?.support_score ?? null,
      direct_supported: directSupported,
      gate_correct: gateCorrect,
      direct_verdict: directJudgment.verdict ?? null,
      gate_verdict: gateJudgment.verdict ?? null,
    });
  }
}

const counts = countBy(examples, (row) => row.category);
const gateFired = examples.filter((row) => row.gate_fired);
const falseSuppressions = examples.filter((row) => row.category === "false_suppression_supported_answer");
const harmfulFalseSuppressions = falseSuppressions.filter((row) => !row.gate_correct);
const ambiguousFalseSuppressions = falseSuppressions.filter((row) => row.gate_correct);
const trueSuppressions = examples.filter((row) => row.category === "true_suppression_unsupported_answer");
const effectiveTrueSuppressions = trueSuppressions.filter((row) => row.gate_correct);
const ineffectiveTrueSuppressions = trueSuppressions.filter((row) => !row.gate_correct);
const retainedUnsupported = examples.filter((row) => row.category === "retained_unsupported_answer");
const retainedSupported = examples.filter((row) => row.category === "retained_supported_answer");
const currentCorrect = examples.filter((row) => row.gate_correct).length;
const recoverSupportedOracleCorrect = currentCorrect + harmfulFalseSuppressions.length;
const suppressUnsupportedOracleCorrect = currentCorrect + retainedUnsupported.length;
const bothOracleCorrect = currentCorrect + harmfulFalseSuppressions.length + retainedUnsupported.length;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  scope: "extended_temporal_future_holdout examples 241-389",
  llm_calls: 0,
  run_cost_usd: 0,
  examples: examples.length,
  counts,
  gate_fired: gateFired.length,
  true_suppressions: trueSuppressions.length,
  effective_true_suppressions: effectiveTrueSuppressions.length,
  ineffective_true_suppressions: ineffectiveTrueSuppressions.length,
  false_suppressions: falseSuppressions.length,
  harmful_false_suppressions: harmfulFalseSuppressions.length,
  ambiguous_false_suppressions: ambiguousFalseSuppressions.length,
  retained_supported_answers: retainedSupported.length,
  retained_unsupported_answers: retainedUnsupported.length,
  current_gate_correct: currentCorrect,
  oracle_recover_supported_correct_rate: recoverSupportedOracleCorrect / examples.length,
  oracle_suppress_remaining_unsupported_rate: suppressUnsupportedOracleCorrect / examples.length,
  oracle_both_correct_rate: bothOracleCorrect / examples.length,
  harmful_false_suppression_examples: harmfulFalseSuppressions.slice(0, 12),
  ambiguous_false_suppression_examples: ambiguousFalseSuppressions.slice(0, 12),
  retained_unsupported_examples: retainedUnsupported.slice(0, 12),
};

await writeJsonl(path.join(outputDir, "classified_examples.jsonl"), examples);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(reportPath, renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  summary_report: path.relative(rootDir, reportPath),
  counts: result.counts,
  oracle_both_correct_rate: result.oracle_both_correct_rate,
}, null, 2));

function categorize({ directAnswerType, gateAnswerType, directSupported, gateCorrect, gateFired }) {
  if (directAnswerType === "abstain") return gateCorrect ? "direct_abstention_correct" : "direct_abstention_wrong";
  if (gateFired && gateAnswerType === "abstain") {
    return directSupported ? "false_suppression_supported_answer" : "true_suppression_unsupported_answer";
  }
  if (gateAnswerType === "grounded_answer") {
    return directSupported ? "retained_supported_answer" : "retained_unsupported_answer";
  }
  return gateCorrect ? "other_correct" : "other_wrong";
}

function renderReport(result) {
  return `# Risk-Gate Tradeoff Analysis

Scope: ${result.scope}

This analysis makes no LLM calls. It classifies row-level changes using existing direct-repair and risk-gate \`gpt-4o\` judgments.

| Category | Rows |
| --- | ---: |
| Retained supported answers | ${result.retained_supported_answers} |
| Retained unsupported answers | ${result.retained_unsupported_answers} |
| Effective suppressions of unsupported answers | ${result.effective_true_suppressions} |
| Ineffective suppressions of unsupported answers | ${result.ineffective_true_suppressions} |
| Harmful suppressions of supported answers | ${result.harmful_false_suppressions} |
| Ambiguous suppressions of supported answers | ${result.ambiguous_false_suppressions} |
| Direct abstentions | ${(result.counts.direct_abstention_correct ?? 0) + (result.counts.direct_abstention_wrong ?? 0)} |

## Headroom

| Scenario | Correct / examples | Correct rate |
| --- | ---: | ---: |
| Current gate | ${result.current_gate_correct} / ${result.examples} | ${pct(result.current_gate_correct / result.examples)} |
| Recover only harmful false-suppressed supported answers | ${(result.current_gate_correct + result.harmful_false_suppressions)} / ${result.examples} | ${pct(result.oracle_recover_supported_correct_rate)} |
| Suppress retained unsupported answers | ${(result.current_gate_correct + result.retained_unsupported_answers)} / ${result.examples} | ${pct(result.oracle_suppress_remaining_unsupported_rate)} |
| Do both | ${(result.current_gate_correct + result.harmful_false_suppressions + result.retained_unsupported_answers)} / ${result.examples} | ${pct(result.oracle_both_correct_rate)} |

The next system should prioritize suppressing retained unsupported answers; recovering supported answers has much less headroom unless paired with a stronger verifier.
`;
}

function isSupportedAnswer(judgment) {
  return ["supported", "correct"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.all_claims_supported === true;
}

function isCorrectAbstention(judgment) {
  return ["correct_abstention", "abstention_supported"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.abstention_supported === true;
}

function normalizeAnswerType(value) {
  return value === "grounded_answer" ? "grounded_answer" : "abstain";
}

function keyed(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
}

function countBy(rows, fn) {
  const counts = {};
  for (const row of rows) counts[fn(row)] = (counts[fn(row)] ?? 0) + 1;
  return counts;
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
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
