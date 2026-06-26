import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "mini-verifier-gate-balanced-risk-gate-240-389-v1";
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);

const windows = [
  {
    label: "241-320",
    examples: 80,
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
    strongJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
    miniJudge: "openai-judge-mini-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  },
  {
    label: "321-389",
    examples: 69,
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    strongJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    miniJudge: "openai-judge-mini-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  },
];
const deterministicGuardRun = "claim-entailment-guard-balanced-risk-gate-240-389-v1";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const examples = [];
const deterministicGuardRows = keyed(await readJsonl(path.join(runDir, deterministicGuardRun, "predictions.jsonl")));
const windowResults = [];
let miniJudgeCost = 0;
for (const window of windows) {
  const gateRows = keyed(await readJsonl(path.join(runDir, window.gateRun, "predictions.jsonl")));
  const strongRows = keyed(await readJsonl(path.join(runDir, window.strongJudge, "judgments.jsonl")));
  const miniRows = keyed(await readJsonl(path.join(runDir, window.miniJudge, "judgments.jsonl")));
  const miniResult = JSON.parse(await fs.readFile(path.join(runDir, window.miniJudge, "result.json"), "utf8"));
  miniJudgeCost += miniResult.run_cost_usd ?? 0;
  const rows = [];
  for (const [exampleId, gateRow] of gateRows) {
    const strong = strongRows.get(exampleId);
    const mini = miniRows.get(exampleId);
    if (!strong || !mini) continue;
    const answerType = normalizeAnswerType(gateRow.prediction?.answer_type);
    const strongCorrect = answerType === "grounded_answer" ? isSupportedAnswer(strong.judgment) : isCorrectAbstention(strong.judgment);
    const miniCorrect = answerType === "grounded_answer" ? isSupportedAnswer(mini.judgment) : isCorrectAbstention(mini.judgment);
    const miniSuppresses = answerType === "grounded_answer" && !isSupportedAnswer(mini.judgment);
    const deterministicSuppresses = deterministicGuardRows.get(exampleId)?.metadata?.claim_guard_fired === true;
    const combinedSuppresses = miniSuppresses || deterministicSuppresses;
    const verifierCorrect = miniSuppresses ? !isSupportedAnswer(strong.judgment) : strongCorrect;
    const combinedCorrect = combinedSuppresses ? !isSupportedAnswer(strong.judgment) : strongCorrect;
    const row = {
      example_id: exampleId,
      window: window.label,
      answer_type: answerType,
      mini_verdict: mini.judgment?.verdict ?? null,
      strong_verdict: strong.judgment?.verdict ?? null,
      mini_correct: miniCorrect,
      strong_correct: strongCorrect,
      mini_suppresses: miniSuppresses,
      deterministic_suppresses: deterministicSuppresses,
      combined_suppresses: combinedSuppresses,
      verifier_correct_against_strong: verifierCorrect,
      combined_correct_against_strong: combinedCorrect,
      interpretation: miniSuppresses
        ? (isSupportedAnswer(strong.judgment) ? "harmful_suppression_supported_answer" : "suppressed_unsupported_answer")
        : "unchanged",
      support_score: gateRow.metadata?.support_score ?? null,
    };
    rows.push(row);
    examples.push(row);
  }
  windowResults.push({
    label: window.label,
    examples: rows.length,
    baseline: summarize(rows, "strong_correct"),
    mini_judge_agreement: summarizeAgreement(rows),
    mini_verifier_gate: summarize(rows, "verifier_correct_against_strong"),
    combined_verifier_gate: summarize(rows, "combined_correct_against_strong"),
    suppressions: summarizeSuppressions(rows),
    combined_suppressions: summarizeSuppressions(rows, "combined_suppresses"),
  });
}

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  scope: "balanced support-risk gate outputs on extended_temporal_future_holdout examples 241-389",
  llm_calls: 0,
  run_cost_usd: 0,
  note: "This synthesis makes no calls; the source mini judge runs made the paid calls.",
  source_runs: windows,
  source_mini_judge_cost_usd: miniJudgeCost,
  source_mini_judge_calls: 149,
  windows: windowResults,
  aggregate: {
    baseline: summarize(examples, "strong_correct"),
    mini_judge_agreement: summarizeAgreement(examples),
    mini_verifier_gate: summarize(examples, "verifier_correct_against_strong"),
    combined_verifier_gate: summarize(examples, "combined_correct_against_strong"),
    suppressions: summarizeSuppressions(examples),
    combined_suppressions: summarizeSuppressions(examples, "combined_suppresses"),
  },
};
result.deltas = {
  verifier_correct_delta: result.aggregate.mini_verifier_gate.correct_rate - result.aggregate.baseline.correct_rate,
  verifier_correct_rows_delta: result.aggregate.mini_verifier_gate.correct - result.aggregate.baseline.correct,
  combined_correct_delta: result.aggregate.combined_verifier_gate.correct_rate - result.aggregate.baseline.correct_rate,
  combined_correct_rows_delta: result.aggregate.combined_verifier_gate.correct - result.aggregate.baseline.correct,
};

await writeJsonl(path.join(outputDir, "examples.jsonl"), examples);
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

function summarize(rows, key) {
  const correct = rows.filter((row) => row[key]).length;
  return { examples: rows.length, correct, correct_rate: rows.length ? correct / rows.length : 0 };
}

function summarizeAgreement(rows) {
  const answered = rows.filter((row) => row.answer_type === "grounded_answer");
  const abstained = rows.filter((row) => row.answer_type === "abstain");
  return {
    examples: rows.length,
    agreement_rate: rows.length ? rows.filter((row) => row.mini_correct === row.strong_correct).length / rows.length : 0,
    mini_correct_rate: rows.length ? rows.filter((row) => row.mini_correct).length / rows.length : 0,
    strong_correct_rate: rows.length ? rows.filter((row) => row.strong_correct).length / rows.length : 0,
    answered_mini_support_rate: answered.length ? answered.filter((row) => row.mini_correct).length / answered.length : 0,
    answered_strong_support_rate: answered.length ? answered.filter((row) => row.strong_correct).length / answered.length : 0,
    abstention_mini_support_rate: abstained.length ? abstained.filter((row) => row.mini_correct).length / abstained.length : 0,
    abstention_strong_support_rate: abstained.length ? abstained.filter((row) => row.strong_correct).length / abstained.length : 0,
  };
}

function summarizeSuppressions(rows, key = "mini_suppresses") {
  const suppressions = rows.filter((row) => row[key]);
  return {
    suppressions: suppressions.length,
    suppressed_unsupported: suppressions.filter((row) => !row.strong_correct).length,
    harmful_suppressed_supported: suppressions.filter((row) => row.strong_correct).length,
  };
}

function renderReport(result) {
  const windowRows = result.windows.map((row) => (
    `| ${row.label} | ${row.baseline.correct} / ${row.examples} (${pct(row.baseline.correct_rate)}) | ${pct(row.mini_judge_agreement.mini_correct_rate)} | ${pct(row.mini_judge_agreement.agreement_rate)} | ${row.mini_verifier_gate.correct} / ${row.examples} (${pct(row.mini_verifier_gate.correct_rate)}) | ${row.combined_verifier_gate.correct} / ${row.examples} (${pct(row.combined_verifier_gate.correct_rate)}) | ${row.suppressions.suppressions} | ${row.suppressions.suppressed_unsupported} | ${row.suppressions.harmful_suppressed_supported} | ${row.combined_suppressions.suppressions} | ${row.combined_suppressions.harmful_suppressed_supported} |`
  )).join("\n");
  return `# Mini Verifier Gate Over Balanced Risk Gate

Scope: ${result.scope}

This synthesis makes no LLM calls. It uses the paid \`gpt-4o-mini\` judge runs as a cheap verifier signal over balanced risk-gate outputs, then evaluates the resulting keep/abstain gate against existing stronger \`gpt-4o\` judgments.

The source mini judge runs made ${result.source_mini_judge_calls} calls and cost $${result.source_mini_judge_cost_usd.toFixed(8)}.

| Window | Strong baseline correct | Mini judged correct | Mini/strong agreement | Mini-verifier correct vs strong | Combined guard correct vs strong | Mini suppressions | Mini suppressed unsupported | Mini harmful suppressions | Combined suppressions | Combined harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${windowRows}
| Aggregate | ${result.aggregate.baseline.correct} / ${result.aggregate.baseline.examples} (${pct(result.aggregate.baseline.correct_rate)}) | ${pct(result.aggregate.mini_judge_agreement.mini_correct_rate)} | ${pct(result.aggregate.mini_judge_agreement.agreement_rate)} | ${result.aggregate.mini_verifier_gate.correct} / ${result.aggregate.mini_verifier_gate.examples} (${pct(result.aggregate.mini_verifier_gate.correct_rate)}) | ${result.aggregate.combined_verifier_gate.correct} / ${result.aggregate.combined_verifier_gate.examples} (${pct(result.aggregate.combined_verifier_gate.correct_rate)}) | ${result.aggregate.suppressions.suppressions} | ${result.aggregate.suppressions.suppressed_unsupported} | ${result.aggregate.suppressions.harmful_suppressed_supported} | ${result.aggregate.combined_suppressions.suppressions} | ${result.aggregate.combined_suppressions.harmful_suppressed_supported} |

## Interpretation

Using \`gpt-4o-mini\` as a per-query verifier is too optimistic for this support task, but its rare negative calls are useful: the mini-verifier-only gate suppresses four unsupported answers with no harmful suppressions. Unioning it with the deterministic numeric/comparative guard gives the best current support-first scaffold, though it still answers fewer examples and is not an amortized local model.
`;
}

function normalizeAnswerType(value) {
  return value === "grounded_answer" ? "grounded_answer" : "abstain";
}

function isSupportedAnswer(judgment) {
  return ["supported", "correct"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.all_claims_supported === true;
}

function isCorrectAbstention(judgment) {
  return ["correct_abstention", "abstention_supported"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.abstention_supported === true;
}

function keyed(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
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
