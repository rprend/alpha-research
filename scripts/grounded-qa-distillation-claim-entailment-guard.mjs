import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "claim-entailment-guard-balanced-risk-gate-240-389-v1";
const split = args.split ?? "extended_temporal_future_holdout";
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);
const comparativeTerms = [
  "best", "better", "worse", "worst", "outperform", "outperformed", "outperforms",
  "higher", "lower", "more", "less", "fewer", "larger", "smaller", "shorter", "longer",
  "improve", "improved", "improvement", "increase", "increased", "decrease", "decreased",
  "reduce", "reduced", "prefer", "preference", "highest", "lowest",
];
const quantifierTermsPattern = ["all", "every", "only", "none", "always", "never", "total"];

const windows = [
  {
    label: "241-320",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
    gateJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  },
  {
    label: "321-389",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    gateJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  },
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const references = keyed(await readJsonl(path.join(dataDir, `${split}.jsonl`)));
const rows = [];
for (const window of windows) {
  const predictions = await readJsonl(path.join(runDir, window.gateRun, "predictions.jsonl"));
  const judgments = keyed(await readJsonl(path.join(runDir, window.gateJudge, "judgments.jsonl")));
  for (const row of predictions) {
    const reference = references.get(row.example_id);
    const judgeRow = judgments.get(row.example_id);
    if (!reference || !judgeRow) continue;
    const sourcePrediction = normalizePrediction(row.prediction ?? {});
    const guard = inspectClaimEntailment(sourcePrediction, reference.input);
    const guardFired = sourcePrediction.answer_type === "grounded_answer" && guard.fire;
    const prediction = guardFired ? abstainPrediction(guard) : sourcePrediction;
    const gateSupported = sourcePrediction.answer_type === "grounded_answer"
      ? isSupportedAnswer(judgeRow.judgment)
      : isCorrectAbstention(judgeRow.judgment);
    const inheritedGateCorrect = sourcePrediction.answer_type === "grounded_answer"
      ? isSupportedAnswer(judgeRow.judgment)
      : isCorrectAbstention(judgeRow.judgment);
    const inheritedGuardCorrect = guardFired
      ? !isSupportedAnswer(judgeRow.judgment)
      : inheritedGateCorrect;
    rows.push({
      example_id: row.example_id,
      window: window.label,
      prediction,
      source_prediction: sourcePrediction,
      cost_usd: 0,
      metadata: {
        scaffold: "zero_call_claim_entailment_guard_after_support_risk_gate",
        upstream_scaffold: row.metadata?.scaffold ?? null,
        upstream_support_score: row.metadata?.support_score ?? null,
        upstream_gate_fired: Boolean(row.metadata?.gate_fired),
        claim_guard_fired: guardFired,
        claim_guard_reasons: guard.reasons,
        unsupported_numbers: guard.unsupported_numbers,
        unsupported_terms: guard.unsupported_terms,
      },
      inherited_judgment: {
        gate_verdict: judgeRow.judgment?.verdict ?? null,
        gate_answer_supported: gateSupported,
        baseline_correct: inheritedGateCorrect,
        guard_correct_oracle: inheritedGuardCorrect,
        interpretation: guardFired
          ? (isSupportedAnswer(judgeRow.judgment) ? "harmful_suppression_supported_answer" : "suppressed_unsupported_answer")
          : "unchanged",
      },
      scores: scorePrediction(reference, prediction),
    });
  }
}

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  scope: "balanced support-risk gate outputs on extended_temporal_future_holdout examples 241-389",
  llm_calls: 0,
  run_cost_usd: 0,
  cost_note: "This guard is deterministic and reuses existing GPT-4o judgments for support-oracle accounting.",
  metrics: summarizePredictions(rows),
  inherited_support_oracle_metrics: summarizeInherited(rows),
  guard_summary: summarizeGuard(rows),
  reason_counts: sortCounts(countReasons(rows)),
  examples: rows.filter((row) => row.metadata.claim_guard_fired).slice(0, 16).map(renderExample),
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(reportPath, renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  summary_report: path.relative(rootDir, reportPath),
  metrics: result.metrics,
  inherited_support_oracle_metrics: result.inherited_support_oracle_metrics,
  guard_summary: result.guard_summary,
  reason_counts: result.reason_counts,
}, null, 2));

function inspectClaimEntailment(prediction, input) {
  if (prediction.answer_type !== "grounded_answer") return emptyGuard();
  const evidenceById = new Map((input.compact_retrieved_evidence_pack ?? []).map((evidence) => [evidence.evidence_id, evidence]));
  const citedText = prediction.citations.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  const answerText = [
    prediction.answer,
    ...(prediction.claim_table ?? []).flatMap((claim) => [claim.claim, claim.support]),
  ].filter(Boolean).join(" ");
  const strippedAnswer = stripCitations(answerText);
  const citedComparable = normalizeComparableText(citedText);
  const questionComparable = normalizeComparableText(input.question ?? "");
  const answerNumbers = [...new Set(numberTokens(strippedAnswer).map(normalizeNumber))];
  const citedNumbers = new Set(numberTokens(citedText).map(normalizeNumber));
  const questionNumbers = new Set(numberTokens(input.question ?? "").map(normalizeNumber));
  const unsupportedNumbers = answerNumbers.filter((number) => !citedNumbers.has(number) && !questionNumbers.has(number));
  const answerTerms = matchedTerms(strippedAnswer, comparativeTerms);
  const citedTerms = matchedTerms(citedText, comparativeTerms);
  const unsupportedTerms = answerTerms.filter((term) => !citedTerms.includes(term) && !citedComparable.includes(term) && !questionComparable.includes(term));
  const quantifierTerms = matchedTerms(strippedAnswer, quantifierTermsPattern);
  const citedQuantifierTerms = matchedTerms(citedText, quantifierTermsPattern);
  const unsupportedQuantifiers = quantifierTerms.filter((term) => !citedQuantifierTerms.includes(term) && !questionComparable.includes(term));
  const reasons = [];
  if (unsupportedNumbers.length) reasons.push("unsupported_number");
  if (unsupportedTerms.length) reasons.push("unsupported_comparative_or_superlative");
  if (unsupportedQuantifiers.length) reasons.push("unsupported_quantifier");
  return {
    fire: reasons.length > 0,
    reasons,
    unsupported_numbers: unsupportedNumbers,
    unsupported_terms: [...new Set([...unsupportedTerms, ...unsupportedQuantifiers])],
  };
}

function abstainPrediction(guard) {
  return {
    answer_type: "abstain",
    answer: "The cited evidence does not provide enough support for the generated claim.",
    citations: [],
    claim_table: [{
      claim: "Generated answer failed deterministic cited-evidence entailment checks.",
      support: "claim_entailment_guard",
      citations: [],
    }],
    abstention_reason: `Claim-entailment guard fired: ${guard.reasons.join(", ")}.`,
  };
}

function summarizeGuard(rows) {
  const answeredBefore = rows.filter((row) => row.source_prediction.answer_type === "grounded_answer").length;
  const answeredAfter = rows.filter((row) => row.prediction.answer_type === "grounded_answer").length;
  const fired = rows.filter((row) => row.metadata.claim_guard_fired);
  const suppressedUnsupported = fired.filter((row) => !isSupportedInterpretation(row)).length;
  const harmfulSuppressedSupported = fired.filter(isSupportedInterpretation).length;
  return {
    examples: rows.length,
    answered_before: answeredBefore,
    answered_after: answeredAfter,
    guard_fired: fired.length,
    suppressed_unsupported_answers: suppressedUnsupported,
    harmful_suppressed_supported_answers: harmfulSuppressedSupported,
    fire_rate_over_answered: answeredBefore ? fired.length / answeredBefore : 0,
  };
}

function summarizeInherited(rows) {
  const baselineCorrect = rows.filter((row) => row.inherited_judgment.baseline_correct).length;
  const guardCorrect = rows.filter((row) => row.inherited_judgment.guard_correct_oracle).length;
  const answered = rows.filter((row) => row.prediction.answer_type === "grounded_answer");
  const supportedAnswers = answered.filter((row) => isSupportedInterpretation(row)).length;
  return {
    examples: rows.length,
    baseline_correct: baselineCorrect,
    baseline_correct_rate: baselineCorrect / rows.length,
    guard_correct_oracle: guardCorrect,
    guard_correct_oracle_rate: guardCorrect / rows.length,
    delta_correct: guardCorrect - baselineCorrect,
    delta_correct_rate: (guardCorrect - baselineCorrect) / rows.length,
    answer_support_rate_after_guard: answered.length ? supportedAnswers / answered.length : 0,
  };
}

function renderExample(row) {
  return {
    example_id: row.example_id,
    window: row.window,
    interpretation: row.inherited_judgment.interpretation,
    reasons: row.metadata.claim_guard_reasons,
    unsupported_numbers: row.metadata.unsupported_numbers,
    unsupported_terms: row.metadata.unsupported_terms,
    upstream_support_score: row.metadata.upstream_support_score,
    gate_verdict: row.inherited_judgment.gate_verdict,
    answer_preview: compact(row.source_prediction.answer, 260),
  };
}

function renderReport(result) {
  const reasonRows = Object.entries(result.reason_counts)
    .map(([reason, count]) => `| ${humanize(reason)} | ${count} |`)
    .join("\n");
  const exampleRows = result.examples.map((row) => (
    `| \`${row.example_id}\` | ${row.interpretation.replaceAll("_", " ")} | ${row.reasons.map(humanize).join(", ")} | ${pct(row.upstream_support_score ?? 0)} | ${row.gate_verdict} | ${escapeCell(row.answer_preview)} |`
  )).join("\n");
  return `# Claim-Entailment Guard After Balanced Risk Gate

Scope: ${result.scope}

This run makes no LLM calls. It applies deterministic cited-evidence checks after the balanced support-risk gate and evaluates with local task metrics plus inherited support-oracle accounting from existing \`gpt-4o\` judgments.

## Guard Effect

| Examples | Answered before | Answered after | Guard fired | Suppressed unsupported | Harmful suppressed supported |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.guard_summary.examples} | ${result.guard_summary.answered_before} | ${result.guard_summary.answered_after} | ${result.guard_summary.guard_fired} | ${result.guard_summary.suppressed_unsupported_answers} | ${result.guard_summary.harmful_suppressed_supported_answers} |

## Inherited Support-Oracle Accounting

| Policy | Correct / examples | Correct rate | Answer support after guard |
| --- | ---: | ---: | ---: |
| Balanced risk gate | ${result.inherited_support_oracle_metrics.baseline_correct} / ${result.inherited_support_oracle_metrics.examples} | ${pct(result.inherited_support_oracle_metrics.baseline_correct_rate)} | n/a |
| Risk gate + claim-entailment guard | ${result.inherited_support_oracle_metrics.guard_correct_oracle} / ${result.inherited_support_oracle_metrics.examples} | ${pct(result.inherited_support_oracle_metrics.guard_correct_oracle_rate)} | ${pct(result.inherited_support_oracle_metrics.answer_support_rate_after_guard)} |

Delta: ${signed(result.inherited_support_oracle_metrics.delta_correct)} rows, ${signedPct(result.inherited_support_oracle_metrics.delta_correct_rate)}.

## Local Task Metrics

| Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.metrics.answered} | ${pct(result.metrics.answer_type_accuracy)} | ${pct(result.metrics.citation_precision)} | ${pct(result.metrics.citation_recall)} | ${pct(result.metrics.answer_token_f1)} | ${pct(result.metrics.inline_citation_rate)} |

## Guard Reasons

| Reason | Rows |
| --- | ---: |
${reasonRows}

## Fired Examples

| Example | Interpretation | Reasons | Upstream support score | Gate verdict | Answer preview |
| --- | --- | --- | ---: | --- | --- |
${exampleRows}

## Interpretation

The guard is a high-safety diagnostic, not a final policy. It targets the dominant retained-error class from D64 and improves inherited support-oracle correctness only when it suppresses unsupported answers faster than supported ones. A fresh judge pass would be required before treating the new abstentions as independently verified.
`;
}

function isSupportedInterpretation(row) {
  return row.source_prediction.answer_type === "grounded_answer" && row.inherited_judgment.gate_answer_supported === true;
}

function isSupportedAnswer(judgment) {
  return ["supported", "correct"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.all_claims_supported === true;
}

function isCorrectAbstention(judgment) {
  return ["correct_abstention", "abstention_supported"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.abstention_supported === true;
}

function scorePrediction(reference, prediction) {
  const referenceCitations = new Set((reference.output.citations ?? []).map((citation) => citation.evidence_id));
  const citedGold = (prediction.citations ?? []).filter((id) => reference.teacher_trace.evidence_roles[id] === "gold_evidence").length;
  const answerable = reference.output.answer_type !== "abstain";
  const abstained = prediction.answer_type === "abstain";
  return {
    answer_type_correct: prediction.answer_type === reference.output.answer_type,
    citation_precision: prediction.citations.length ? citedGold / prediction.citations.length : null,
    citation_recall: referenceCitations.size
      ? prediction.citations.filter((id) => referenceCitations.has(id)).length / referenceCitations.size
      : null,
    answer_token_f1: answerable ? (!abstained ? tokenF1(prediction.answer, stripCitations(reference.output.answer)) : 0) : null,
    abstention_correct: answerable ? !abstained : abstained,
    inline_citation_rate: prediction.answer_type === "grounded_answer"
      ? (prediction.citations.length ? prediction.citations.filter((id) => prediction.answer.includes(`[${id}]`)).length / prediction.citations.length : 0)
      : null,
  };
}

function summarizePredictions(rows) {
  return {
    examples: rows.length,
    answered: rows.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstained: rows.filter((row) => row.prediction.answer_type === "abstain").length,
    answer_type_accuracy: mean(rows.map((row) => row.scores.answer_type_correct)),
    citation_precision: mean(rows.map((row) => row.scores.citation_precision)),
    citation_recall: mean(rows.map((row) => row.scores.citation_recall)),
    answer_token_f1: mean(rows.map((row) => row.scores.answer_token_f1)),
    abstention_accuracy: mean(rows.map((row) => row.scores.abstention_correct)),
    inline_citation_rate: mean(rows.map((row) => row.scores.inline_citation_rate)),
  };
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

function matchedTerms(value, terms) {
  const text = ` ${String(value).toLowerCase()} `;
  return terms.filter((term) => new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(text));
}

function normalizeComparableText(value) {
  return contentTokens(value).join(" ");
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
  return [...text.matchAll(/\b\d+(?:[.,]\d+)*(?:%|k|m|b)?\b/gi)]
    .filter((match) => {
      const index = match.index ?? 0;
      const before = text[index - 1] ?? "";
      const beforeBefore = text[index - 2] ?? "";
      const after = text[index + match[0].length] ?? "";
      if (before === "-" && /[A-Za-z]/.test(beforeBefore)) return false;
      if (/^\d+$/.test(match[0]) && [";", ")", "."].includes(after) && (index === 0 || /[\s([{]/.test(before))) return false;
      return true;
    })
    .map((match) => match[0]);
}

function tokenF1(prediction, reference) {
  const predicted = contentTokens(stripCitations(prediction));
  const gold = contentTokens(reference);
  if (!predicted.length && !gold.length) return 1;
  if (!predicted.length || !gold.length) return 0;
  const goldCounts = counts(gold);
  let overlap = 0;
  for (const token of predicted) {
    const count = goldCounts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      goldCounts.set(token, count - 1);
    }
  }
  if (!overlap) return 0;
  const precision = overlap / predicted.length;
  const recall = overlap / gold.length;
  return (2 * precision * recall) / (precision + recall);
}

function contentTokens(value) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why"]);
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stop.has(token));
}

function tokenCoverage(targetTokens, sourceTokens) {
  if (!targetTokens.length) return 0;
  const source = new Set(sourceTokens);
  return targetTokens.filter((token) => source.has(token)).length / targetTokens.length;
}

function stripCitations(value) {
  return String(value).replace(/\s*\[[^\]]+\]/g, "").trim();
}

function emptyGuard() {
  return { fire: false, reasons: [], unsupported_numbers: [], unsupported_terms: [] };
}

function countReasons(rows) {
  const counts = {};
  for (const row of rows) {
    for (const reason of row.metadata.claim_guard_reasons) counts[reason] = (counts[reason] ?? 0) + 1;
  }
  return counts;
}

function counts(tokens) {
  const map = new Map();
  for (const token of tokens) map.set(token, (map.get(token) ?? 0) + 1);
  return map;
}

function mean(values) {
  const numeric = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number);
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : 0;
}

function keyed(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
}

function sortCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compact(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function humanize(value) {
  return String(value).replaceAll("_", " ");
}

function escapeCell(value) {
  return compact(value, 220).replaceAll("|", "\\|");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function signedPct(value) {
  const rendered = `${(value * 100).toFixed(1)}pp`;
  return value > 0 ? `+${rendered}` : rendered;
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
