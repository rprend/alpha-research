import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "mini-verifier-gate-balanced-risk-gate-160-389-v1";
const split = args.split ?? "extended_temporal_future_holdout";
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);

const comparativeTerms = [
  "best", "better", "worse", "worst", "outperform", "outperformed", "outperforms",
  "higher", "lower", "more", "less", "fewer", "larger", "smaller", "shorter", "longer",
  "improve", "improved", "improvement", "increase", "increased", "decrease", "decreased",
  "reduce", "reduced", "prefer", "preference", "highest", "lowest",
];
const quantifierTerms = ["all", "every", "only", "none", "always", "never", "total"];

const windows = [
  {
    label: "161-240",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1",
    strongJudge: "openai-judge-gpt4o-risk-gate-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1",
    miniJudge: "openai-judge-mini-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1",
  },
  {
    label: "241-320",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
    strongJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
    miniJudge: "openai-judge-mini-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  },
  {
    label: "321-389",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    strongJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    miniJudge: "openai-judge-mini-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  },
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const references = keyed(await readJsonl(path.join(dataDir, `${split}.jsonl`)));
const examples = [];
const windowResults = [];
let miniJudgeCost = 0;
let miniJudgeCalls = 0;

for (const window of windows) {
  const gateRows = keyed(await readJsonl(path.join(runDir, window.gateRun, "predictions.jsonl")));
  const strongRows = keyed(await readJsonl(path.join(runDir, window.strongJudge, "judgments.jsonl")));
  const miniRows = keyed(await readJsonl(path.join(runDir, window.miniJudge, "judgments.jsonl")));
  const miniResult = JSON.parse(await fs.readFile(path.join(runDir, window.miniJudge, "result.json"), "utf8"));
  miniJudgeCost += miniResult.run_cost_usd ?? 0;
  miniJudgeCalls += miniResult.calls_made ?? 0;

  const rows = [];
  for (const [exampleId, gateRow] of gateRows) {
    const reference = references.get(exampleId);
    const strong = strongRows.get(exampleId);
    const mini = miniRows.get(exampleId);
    if (!reference || !strong || !mini) continue;
    const prediction = normalizePrediction(gateRow.prediction ?? {});
    const answerType = prediction.answer_type;
    const strongCorrect = answerType === "grounded_answer" ? isSupportedAnswer(strong.judgment) : isCorrectAbstention(strong.judgment);
    const miniCorrect = answerType === "grounded_answer" ? isSupportedAnswer(mini.judgment) : isCorrectAbstention(mini.judgment);
    const miniSuppresses = answerType === "grounded_answer" && !isSupportedAnswer(mini.judgment);
    const deterministic = inspectClaimEntailment(prediction, reference.input, citedText(reference, prediction));
    const deterministicSuppresses = answerType === "grounded_answer" && deterministic.fire;
    const combinedSuppresses = miniSuppresses || deterministicSuppresses;
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
      deterministic_reasons: deterministic.reasons,
      combined_suppresses: combinedSuppresses,
      mini_verifier_correct_against_strong: miniSuppresses ? !isSupportedAnswer(strong.judgment) : strongCorrect,
      deterministic_correct_against_strong: deterministicSuppresses ? !isSupportedAnswer(strong.judgment) : strongCorrect,
      combined_correct_against_strong: combinedSuppresses ? !isSupportedAnswer(strong.judgment) : strongCorrect,
      mini_interpretation: interpretation(miniSuppresses, strongCorrect),
      deterministic_interpretation: interpretation(deterministicSuppresses, strongCorrect),
      combined_interpretation: interpretation(combinedSuppresses, strongCorrect),
      support_score: gateRow.metadata?.support_score ?? null,
      answer_preview: compact(prediction.answer, 220),
    };
    rows.push(row);
    examples.push(row);
  }
  windowResults.push(summarizeWindow(window.label, rows));
}

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  scope: "balanced support-risk gate outputs on extended_temporal_future_holdout examples 161-389",
  llm_calls: 0,
  run_cost_usd: 0,
  note: "This synthesis makes no calls; source mini judge runs made the paid calls.",
  source_runs: windows,
  source_mini_judge_cost_usd: miniJudgeCost,
  source_mini_judge_calls: miniJudgeCalls,
  windows: windowResults,
  aggregate: summarizeWindow("aggregate", examples),
  suppressions: examples
    .filter((row) => row.mini_suppresses || row.deterministic_suppresses)
    .map((row) => ({
      example_id: row.example_id,
      window: row.window,
      strong_correct: row.strong_correct,
      mini_suppresses: row.mini_suppresses,
      deterministic_suppresses: row.deterministic_suppresses,
      combined_suppresses: row.combined_suppresses,
      deterministic_reasons: row.deterministic_reasons,
      combined_interpretation: row.combined_interpretation,
      answer_preview: row.answer_preview,
    })),
};
result.deltas = {
  mini_correct_rows_delta: result.aggregate.mini_verifier.correct - result.aggregate.baseline.correct,
  deterministic_correct_rows_delta: result.aggregate.deterministic_guard.correct - result.aggregate.baseline.correct,
  combined_correct_rows_delta: result.aggregate.combined_guard.correct - result.aggregate.baseline.correct,
  mini_correct_rate_delta: result.aggregate.mini_verifier.correct_rate - result.aggregate.baseline.correct_rate,
  deterministic_correct_rate_delta: result.aggregate.deterministic_guard.correct_rate - result.aggregate.baseline.correct_rate,
  combined_correct_rate_delta: result.aggregate.combined_guard.correct_rate - result.aggregate.baseline.correct_rate,
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

function summarizeWindow(label, rows) {
  return {
    label,
    examples: rows.length,
    baseline: summarize(rows, "strong_correct"),
    mini_judge_agreement: summarizeAgreement(rows),
    mini_verifier: summarize(rows, "mini_verifier_correct_against_strong"),
    deterministic_guard: summarize(rows, "deterministic_correct_against_strong"),
    combined_guard: summarize(rows, "combined_correct_against_strong"),
    mini_suppressions: summarizeSuppressions(rows, "mini_suppresses", "mini_interpretation"),
    deterministic_suppressions: summarizeSuppressions(rows, "deterministic_suppresses", "deterministic_interpretation"),
    combined_suppressions: summarizeSuppressions(rows, "combined_suppresses", "combined_interpretation"),
  };
}

function summarize(rows, key) {
  const correct = rows.filter((row) => row[key]).length;
  return { examples: rows.length, correct, correct_rate: ratio(correct, rows.length) };
}

function summarizeAgreement(rows) {
  const answered = rows.filter((row) => row.answer_type === "grounded_answer");
  const abstained = rows.filter((row) => row.answer_type === "abstain");
  return {
    examples: rows.length,
    agreement_rate: ratio(rows.filter((row) => row.mini_correct === row.strong_correct).length, rows.length),
    mini_correct_rate: ratio(rows.filter((row) => row.mini_correct).length, rows.length),
    strong_correct_rate: ratio(rows.filter((row) => row.strong_correct).length, rows.length),
    answered_mini_support_rate: ratio(answered.filter((row) => row.mini_correct).length, answered.length),
    answered_strong_support_rate: ratio(answered.filter((row) => row.strong_correct).length, answered.length),
    abstention_mini_support_rate: ratio(abstained.filter((row) => row.mini_correct).length, abstained.length),
    abstention_strong_support_rate: ratio(abstained.filter((row) => row.strong_correct).length, abstained.length),
  };
}

function summarizeSuppressions(rows, suppressKey, interpretationKey) {
  const suppressions = rows.filter((row) => row[suppressKey]);
  return {
    suppressions: suppressions.length,
    suppressed_unsupported: suppressions.filter((row) => row[interpretationKey] === "suppressed_unsupported_answer").length,
    harmful_suppressed_supported: suppressions.filter((row) => row[interpretationKey] === "harmful_suppression_supported_answer").length,
  };
}

function renderReport(result) {
  const rows = [...result.windows, result.aggregate].map((row) => (
    `| ${row.label} | ${row.baseline.correct} / ${row.examples} (${pct(row.baseline.correct_rate)}) | ${pct(row.mini_judge_agreement.mini_correct_rate)} | ${pct(row.mini_judge_agreement.agreement_rate)} | ${row.mini_verifier.correct} / ${row.examples} (${pct(row.mini_verifier.correct_rate)}) | ${row.deterministic_guard.correct} / ${row.examples} (${pct(row.deterministic_guard.correct_rate)}) | ${row.combined_guard.correct} / ${row.examples} (${pct(row.combined_guard.correct_rate)}) | ${row.mini_suppressions.suppressed_unsupported}/${row.mini_suppressions.harmful_suppressed_supported} | ${row.deterministic_suppressions.suppressed_unsupported}/${row.deterministic_suppressions.harmful_suppressed_supported} | ${row.combined_suppressions.suppressed_unsupported}/${row.combined_suppressions.harmful_suppressed_supported} |`
  )).join("\n");
  const suppressionRows = result.suppressions.map((row) => (
    `| \`${row.example_id}\` | ${row.window} | ${row.strong_correct ? "supported" : "unsupported"} | ${row.mini_suppresses ? "yes" : "no"} | ${row.deterministic_suppresses ? "yes" : "no"} | ${row.combined_interpretation} | ${row.deterministic_reasons.join(", ") || ""} | ${escapeCell(row.answer_preview)} |`
  )).join("\n");
  return `# Mini Verifier Gate Over Balanced Risk Gate, 161-389

Scope: ${result.scope}

This synthesis makes no LLM calls. It uses existing paid \`gpt-4o-mini\` verifier judgments and existing stronger \`gpt-4o\` judgments, then recomputes the deterministic numeric/comparative/quantifier guard locally for every window.

The source mini verifier runs made ${result.source_mini_judge_calls} calls and cost $${result.source_mini_judge_cost_usd.toFixed(8)}.

| Window | Strong baseline correct | Mini judged correct | Mini/strong agreement | Mini-verifier correct vs strong | Deterministic correct vs strong | Combined correct vs strong | Mini useful/harmful | Det useful/harmful | Combined useful/harmful |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

## Suppressions

| Example | Window | Strong label | Mini | Deterministic | Combined interpretation | Deterministic reasons | Answer preview |
| --- | --- | --- | --- | --- | --- | --- | --- |
${suppressionRows}

## Interpretation

The expanded synthesis tests whether rare \`gpt-4o-mini\` negative judgments remain useful beyond the 241-389 transfer slice. A useful teacher signal should improve support-oracle correctness against \`gpt-4o\` while keeping harmful suppressions lower than useful suppressions.
`;
}

function citedText(reference, prediction) {
  const evidenceById = new Map((reference.input.compact_retrieved_evidence_pack ?? []).map((evidence) => [evidence.evidence_id, evidence]));
  return prediction.citations.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
}

function inspectClaimEntailment(prediction, input, cited) {
  if (prediction.answer_type !== "grounded_answer") return { fire: false, reasons: [] };
  const answerText = [
    prediction.answer,
    ...(prediction.claim_table ?? []).flatMap((claim) => [claim.claim, claim.support]),
  ].filter(Boolean).join(" ");
  const strippedAnswer = stripCitations(answerText);
  const citedComparable = normalizeComparableText(cited);
  const questionComparable = normalizeComparableText(input.question ?? "");
  const answerNumbers = [...new Set(numberTokens(strippedAnswer).map(normalizeNumber))];
  const citedNumbers = new Set(numberTokens(cited).map(normalizeNumber));
  const questionNumbers = new Set(numberTokens(input.question ?? "").map(normalizeNumber));
  const unsupportedNumbers = answerNumbers.filter((number) => !citedNumbers.has(number) && !questionNumbers.has(number));
  const answerTerms = matchedTerms(strippedAnswer, comparativeTerms);
  const citedTerms = matchedTerms(cited, comparativeTerms);
  const unsupportedTerms = answerTerms.filter((term) => !citedTerms.includes(term) && !citedComparable.includes(term) && !questionComparable.includes(term));
  const quantifierAnswerTerms = matchedTerms(strippedAnswer, quantifierTerms);
  const quantifierCitedTerms = matchedTerms(cited, quantifierTerms);
  const unsupportedQuantifiers = quantifierAnswerTerms.filter((term) => !quantifierCitedTerms.includes(term) && !questionComparable.includes(term));
  const reasons = [];
  if (unsupportedNumbers.length) reasons.push("unsupported_number");
  if (unsupportedTerms.length) reasons.push("unsupported_comparative_or_superlative");
  if (unsupportedQuantifiers.length) reasons.push("unsupported_quantifier");
  return { fire: reasons.length > 0, reasons };
}

function interpretation(suppressed, sourceCorrect) {
  if (!suppressed) return "unchanged";
  return sourceCorrect ? "harmful_suppression_supported_answer" : "suppressed_unsupported_answer";
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : [...new Set(citations)],
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? "") : null,
  };
}

function isSupportedAnswer(judgment) {
  return ["supported", "correct"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.all_claims_supported === true;
}

function isCorrectAbstention(judgment) {
  return ["correct_abstention", "abstention_supported"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.abstention_supported === true;
}

function matchedTerms(value, terms) {
  const text = ` ${String(value).toLowerCase()} `;
  return terms.filter((term) => new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(text));
}

function normalizeComparableText(value) {
  return String(value).toLowerCase().replace(/[-–—]/g, " ");
}

function normalizeNumber(value) {
  const lower = String(value).toLowerCase().replaceAll(",", "");
  const suffix = lower.match(/^(\d+(?:\.\d+)?)([kmb])$/);
  if (!suffix) return lower;
  const multipliers = { k: 1000, m: 1000000, b: 1000000000 };
  return String(Number(suffix[1]) * multipliers[suffix[2]]);
}

function numberTokens(value) {
  const text = String(value);
  return [...text.matchAll(/\b\d+(?:[.,]\d+)*(?:%|k|m|b)?\b/gi)].map((match) => match[0]);
}

function stripCitations(value) {
  return String(value).replace(/\s*\[[^\]]+\]/g, "").trim();
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function compact(value, length) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= length ? text : `${text.slice(0, length - 3)}...`;
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
