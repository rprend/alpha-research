import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "qwen7b-answer-form-counterfactual-gate-v9-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const sourceRunId = args["source-run"] ?? "joint-action-qwen7b-span-claim-construction-smoke-eval-v9-citation-repair";
const sourceJudgeRunId = args["source-judge-run"] ?? "openai-judge-gpt4o-joint-action-qwen7b-span-claim-v9-citation-repair";
const failureRunId = args["failure-run"] ?? "support-failure-analysis-qwen7b-span-claim-v9-citation-repair-2026-06-28-v1";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const references = await readJsonl(path.join(experimentDir, "data", "extended_temporal_future_holdout.jsonl"));
const referenceById = new Map(references.map((row) => [row.example_id, row]));
const sourceRows = await readJsonl(path.join(runsDir, sourceRunId, "predictions.jsonl"));
const sourceJudgments = byId(await readJsonl(path.join(runsDir, sourceJudgeRunId, "judgments.jsonl")));
const failureRows = byId(await readJsonl(path.join(runsDir, failureRunId, "rows.jsonl")));

const rows = sourceRows.map((row) => gateRow(row));
const sourceMetrics = summarize(rows.map((row) => row.source_scored));
const gateMetrics = summarize(rows.map((row) => row.gated_scored));
const suppressions = summarizeSuppressions(rows);

const status = gateMetrics.answer_rate < 0.7
  ? "answer_form_gate_improves_support_but_collapses_coverage"
  : gateMetrics.answer_support_rate > sourceMetrics.answer_support_rate
    ? "answer_form_gate_preserves_coverage_with_support_gain"
    : "answer_form_gate_no_support_gain";

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen7b_answer_form_counterfactual_gate",
  status,
  source_run_id: sourceRunId,
  source_judge_run_id: sourceJudgeRunId,
  failure_run_id: failureRunId,
  gate_policy: {
    name: "v9_answer_form_counterfactual_suppression",
    rules: [
      "Keep source abstentions.",
      "Suppress grounded answers on counterfactual/insufficient-evidence metadata.",
      "Suppress grounded answers with no inline [E#] citation after deterministic citation repair.",
      "Suppress grounded answers whose cited evidence id is not present in the compact evidence pack.",
      "Suppress grounded answers with <=3 content tokens or yes/no-only answer text.",
    ],
    scoring_note: "Kept rows inherit existing GPT-4o judgments. Forced abstentions are scored as supported only when the reference row is abstain; this is a zero-cost diagnostic, not a paid rejudge.",
  },
  examples: rows.length,
  source_metrics: sourceMetrics,
  gated_metrics: gateMetrics,
  suppressions,
  conclusion: deriveConclusion({ sourceMetrics, gateMetrics, suppressions }),
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This gate reuses existing Qwen 7B v9 predictions, paid judgments, and references only.",
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), rows.map((row) => ({
  example_id: row.example_id,
  source_run_id: sourceRunId,
  gate_decision: row.gate_decision,
  gate_reasons: row.gate_reasons,
  prediction: row.gated_prediction,
  source_prediction: row.source_prediction,
  scores: row.gated_scored,
  source_scores: row.source_scored,
  metadata: row.metadata,
})));
await writeJsonl(path.join(outputDir, "rows.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  source: pickMetrics(result.source_metrics),
  gated: pickMetrics(result.gated_metrics),
  suppressions: result.suppressions,
}, null, 2));

function gateRow(row) {
  const reference = referenceById.get(row.example_id);
  const judgment = sourceJudgments.get(row.example_id)?.judgment ?? {};
  const sourcePrediction = row.prediction ?? {};
  const sourceScored = scorePrediction({
    prediction: sourcePrediction,
    judgment,
    reference,
    syntheticForcedAbstention: false,
  });
  const gate = gateDecision({ row, reference });
  const gatedPrediction = gate.suppress
    ? {
        answer_type: "abstain",
        answer: "",
        citations: [],
        claim_table: [
          {
            claim: "Answer suppressed by answer-form/counterfactual gate.",
            support: "abstention",
            citations: [],
          },
        ],
        abstention_reason: `Suppressed source grounded answer: ${gate.reasons.join("; ")}`,
      }
    : sourcePrediction;
  const gatedScored = scorePrediction({
    prediction: gatedPrediction,
    judgment,
    reference,
    syntheticForcedAbstention: gate.suppress,
  });
  return {
    example_id: row.example_id,
    question: reference?.input?.question ?? "",
    reference_answer_type: reference?.output?.answer_type ?? null,
    counterfactual: Boolean(reference?.input?.document_metadata?.counterfactual),
    gate_decision: gate.suppress ? "suppress_to_abstain" : "keep_source",
    gate_reasons: gate.reasons,
    source_prediction: sourcePrediction,
    gated_prediction: gatedPrediction,
    source_judgment: judgment,
    source_scored: sourceScored,
    gated_scored: gatedScored,
    failure_tags: failureRows.get(row.example_id)?.tags ?? [],
    metadata: {
      source_answer_tokens: contentTokens(sourcePrediction.answer ?? "").length,
      source_has_inline_citation: hasInlineCitation(sourcePrediction.answer ?? ""),
      source_citations: normalizeCitations(sourcePrediction.citations),
    },
  };
}

function gateDecision({ row, reference }) {
  const prediction = row.prediction ?? {};
  const reasons = [];
  if (prediction.answer_type !== "grounded_answer") return { suppress: false, reasons };
  if (reference?.input?.document_metadata?.counterfactual) reasons.push("counterfactual_or_insufficient_evidence_metadata");
  if (!hasInlineCitation(prediction.answer ?? "")) reasons.push("missing_inline_citation");
  if (isTooShortOrYesNo(prediction.answer ?? "")) reasons.push("too_short_or_yes_no");
  const evidenceIds = new Set((reference?.input?.compact_retrieved_evidence_pack ?? []).map((item) => item.evidence_id));
  const citations = normalizeCitations(prediction.citations);
  if (!citations.length) reasons.push("no_structured_citations");
  if (citations.some((citation) => !evidenceIds.has(citation))) reasons.push("citation_not_in_evidence_pack");
  return { suppress: reasons.length > 0, reasons };
}

function scorePrediction({ prediction, judgment, reference, syntheticForcedAbstention }) {
  const answered = prediction.answer_type === "grounded_answer";
  const answerSupported = answered && judgment.all_claims_supported === true && judgment.citation_ids_valid !== false;
  const abstentionSupported = answered
    ? false
    : syntheticForcedAbstention
      ? reference?.output?.answer_type === "abstain"
      : judgment.abstention_supported === true;
  return {
    answered,
    abstained: !answered,
    supported_answer: answerSupported,
    supported_abstention: abstentionSupported,
    overall_correct: answerSupported || abstentionSupported,
    synthetic_forced_abstention: syntheticForcedAbstention,
  };
}

function summarize(scoredRows) {
  const answered = scoredRows.filter((row) => row.answered);
  const abstained = scoredRows.filter((row) => row.abstained);
  const supportedAnswers = answered.filter((row) => row.supported_answer);
  const supportedAbstentions = abstained.filter((row) => row.supported_abstention);
  return {
    examples: scoredRows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, scoredRows.length),
    supported_answers: supportedAnswers.length,
    unsupported_answers: answered.length - supportedAnswers.length,
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    supported_abstentions: supportedAbstentions.length,
    abstention_support_rate: ratio(supportedAbstentions.length, abstained.length),
    overall_correct: supportedAnswers.length + supportedAbstentions.length,
    overall_correct_rate: ratio(supportedAnswers.length + supportedAbstentions.length, scoredRows.length),
  };
}

function summarizeSuppressions(rows) {
  const suppressed = rows.filter((row) => row.gate_decision === "suppress_to_abstain");
  const reasonCounts = {};
  for (const row of suppressed) {
    for (const reason of row.gate_reasons) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  }
  return {
    total: suppressed.length,
    useful_unsupported_answer_suppressions: suppressed.filter((row) => row.source_scored.answered && !row.source_scored.supported_answer && row.gated_scored.supported_abstention).length,
    harmful_supported_answer_suppressions: suppressed.filter((row) => row.source_scored.supported_answer && !row.gated_scored.supported_abstention).length,
    harmful_answerable_suppressions: suppressed.filter((row) => row.reference_answer_type === "grounded_answer").length,
    counterfactual_suppressions: suppressed.filter((row) => row.counterfactual).length,
    reason_counts: reasonCounts,
    example_ids: suppressed.map((row) => row.example_id),
  };
}

function deriveConclusion({ sourceMetrics, gateMetrics, suppressions }) {
  const supportDelta = gateMetrics.answer_support_rate - sourceMetrics.answer_support_rate;
  const answerRateDelta = gateMetrics.answer_rate - sourceMetrics.answer_rate;
  return {
    key_findings: [
      `The gate changes answer support from ${pct(sourceMetrics.answer_support_rate)} to ${pct(gateMetrics.answer_support_rate)}.`,
      `The gate changes answer rate from ${pct(sourceMetrics.answer_rate)} to ${pct(gateMetrics.answer_rate)}.`,
      `It suppresses ${suppressions.total} source answers, including ${suppressions.harmful_supported_answer_suppressions} supported answers and ${suppressions.harmful_answerable_suppressions} answerable rows.`,
      `It performs ${suppressions.useful_unsupported_answer_suppressions} useful unsupported-answer suppressions on reference-abstain rows.`,
    ],
    support_delta: supportDelta,
    answer_rate_delta: answerRateDelta,
    next_intervention: gateMetrics.answer_rate < 0.7
      ? "Answer-form suppression is a safety diagnostic, not a solution: it raises support by deleting too many answers. The next packet must generate longer, question-complete supported answers for oracle-gap rows rather than only suppress bad answers."
      : "If coverage is preserved, promote these deterministic features into the verifier/selector training objective and test on a fresh temporal window.",
  };
}

function renderReport(result) {
  return `# Qwen 7B V9 Answer-Form Counterfactual Gate

Generated: ${result.generated_at}

Source run: \`${result.source_run_id}\`

## Metrics

| Surface | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| Source v9 | ${pct(result.source_metrics.answer_rate)} | ${pct(result.source_metrics.answer_support_rate)} | ${pct(result.source_metrics.overall_correct_rate)} | ${result.source_metrics.supported_answers} | ${result.source_metrics.unsupported_answers} |
| Gated v9 | ${pct(result.gated_metrics.answer_rate)} | ${pct(result.gated_metrics.answer_support_rate)} | ${pct(result.gated_metrics.overall_correct_rate)} | ${result.gated_metrics.supported_answers} | ${result.gated_metrics.unsupported_answers} |

## Suppressions

| Total | Useful unsupported suppressions | Harmful supported suppressions | Harmful answerable suppressions | Counterfactual suppressions |
| ---: | ---: | ---: | ---: | ---: |
| ${result.suppressions.total} | ${result.suppressions.useful_unsupported_answer_suppressions} | ${result.suppressions.harmful_supported_answer_suppressions} | ${result.suppressions.harmful_answerable_suppressions} | ${result.suppressions.counterfactual_suppressions} |

Reason counts:

${Object.entries(result.suppressions.reason_counts).map(([reason, count]) => `- ${reason}: ${count}`).join("\n")}

## Conclusion

Status: \`${result.status}\`

${result.conclusion.key_findings.map((item) => `- ${item}`).join("\n")}

Next intervention: ${result.conclusion.next_intervention}

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

function normalizeCitations(citations) {
  if (!Array.isArray(citations)) return [];
  return citations.map((citation) => {
    if (typeof citation === "string") return citation;
    if (citation && typeof citation === "object") return citation.evidence_id ?? citation.id ?? citation.citation_id ?? "";
    return "";
  }).filter(Boolean);
}

function isTooShortOrYesNo(value) {
  const tokens = contentTokens(value);
  const compact = String(value ?? "").replace(/\[[^\]]+\]/g, "").trim().toLowerCase();
  return tokens.length <= 3 || /^(yes|no|true|false|none|unknown)[\s.,;:!]*$/i.test(compact);
}

function hasInlineCitation(value) {
  return /\[E\d+\]/.test(String(value ?? ""));
}

function contentTokens(value) {
  return String(value ?? "").toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}/g) ?? [];
}

function pickMetrics(metrics) {
  return {
    answer_rate: metrics.answer_rate,
    answer_support_rate: metrics.answer_support_rate,
    overall_correct_rate: metrics.overall_correct_rate,
  };
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  if (value == null || Number.isNaN(Number(value))) return "n/a";
  return `${(100 * Number(value)).toFixed(1)}%`;
}

function byId(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
