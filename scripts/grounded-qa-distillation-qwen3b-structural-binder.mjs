import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const predictionRunId = args["prediction-run-id"] ?? "joint-action-qwen3b-v4-smoke-eval-v1-citation-repair";
const judgeRunId = args["judge-run-id"] ?? "openai-judge-gpt4o-joint-action-qwen3b-v4-smoke-eval-v1-citation-repair";
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-support-aware-curriculum-v4";
const runId = args["run-id"] ?? `qwen3b-structural-binder-${predictionRunId}`;
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceResult = await readJson(path.join(runsDir, predictionRunId, "result.json"));
const predictions = await readJsonl(path.join(runsDir, predictionRunId, "predictions.jsonl"));
const judgments = byId(await readJsonl(path.join(runsDir, judgeRunId, "judgments.jsonl")));
const evalRows = byId(await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl")));

const rows = predictions.map((row) => bindRow(row, evalRows.get(row.example_id), judgments.get(row.example_id)));
const sourceMetrics = summarize(predictions.map((row) => scoreSourceRow(row, evalRows.get(row.example_id), judgments.get(row.example_id))));
const binderMetrics = summarize(rows.map((row) => row.scores));
const suppressions = rows.filter((row) => row.binder.action === "abstain");
const retained = rows.filter((row) => row.binder.action === "retain");

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen3b_structural_citation_support_binder",
  prediction_run_id: predictionRunId,
  judge_run_id: judgeRunId,
  packet_run_id: packetRunId,
  purpose: "Zero-call structural binder over repaired Qwen 3B outputs: suppress answers whose citation/use pattern is structurally unsafe before any larger-model escalation.",
  policy: {
    selection_source: "Fixed rules from observed v2-v4 failure modes; this run reuses existing final-window judgments only for evaluation.",
    rules: [
      "Suppress grounded answers with no surviving valid citation ids.",
      "Suppress grounded answers when citation repair dropped invalid citation ids.",
      "Suppress too-short answers that appear to answer comparison/model/task questions.",
      "Suppress comparison/baseline answers when cited evidence lacks comparison/baseline language.",
      "Suppress numeric answers when answer numerals are absent from cited evidence text.",
    ],
    claim_boundary: "Diagnostic scaffold evidence only. It is not a trained student and should not be reported as support-preserving distillation unless evaluated on a fresh held-out window.",
  },
  source_metrics: sourceMetrics,
  binder_metrics: binderMetrics,
  suppression_summary: {
    source_answered: predictions.filter((row) => row.prediction?.answer_type === "grounded_answer").length,
    retained_answers: retained.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    suppressed_answers: suppressions.length,
    helpful_suppressions: suppressions.filter((row) => row.binder.helpful_suppression).length,
    harmful_suppressions: suppressions.filter((row) => row.binder.harmful_suppression).length,
    suppression_reasons: countBy(suppressions.flatMap((row) => row.binder.reasons)),
  },
  comparison_to_source: {
    answer_rate_delta: binderMetrics.answer_rate - sourceMetrics.answer_rate,
    answer_support_rate_delta: nullableDelta(binderMetrics.answer_support_rate, sourceMetrics.answer_support_rate),
    overall_judged_correct_rate_delta: binderMetrics.overall_judged_correct_rate - sourceMetrics.overall_judged_correct_rate,
    unsupported_answers_delta: binderMetrics.unsupported_answers - sourceMetrics.unsupported_answers,
  },
  conclusion: deriveConclusion(sourceMetrics, binderMetrics),
  artifacts: {
    predictions_jsonl: rel(path.join(outputDir, "predictions.jsonl")),
    rows_jsonl: rel(path.join(outputDir, "rows.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    external_compute_actual_usd: budget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This binder reads existing prediction and judge artifacts only.",
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), rows.map((row) => ({
  example_id: row.example_id,
  prediction: row.prediction,
  source_prediction: row.source_prediction,
  binder: row.binder,
  scores: row.scores,
  inherited_judgment: row.inherited_judgment,
})));
await writeJsonl(path.join(outputDir, "rows.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  conclusion: result.conclusion.status,
  source: result.source_metrics,
  binder: result.binder_metrics,
  suppression_summary: result.suppression_summary,
}, null, 2));

function bindRow(row, evalRow, judgmentRow) {
  const sourcePrediction = normalizePrediction(row.prediction ?? {});
  const reference = row.reference ?? evalRow?.reference ?? evalRow?.output ?? {};
  const evidenceById = new Map((evalRow?.input?.compact_retrieved_evidence_pack ?? [])
    .map((evidence) => [String(evidence.evidence_id), String(evidence.text ?? "")]));
  const reasons = sourcePrediction.answer_type === "grounded_answer"
    ? structuralReasons(row, sourcePrediction, evalRow, evidenceById)
    : [];
  const suppress = sourcePrediction.answer_type === "grounded_answer" && reasons.length > 0;
  const prediction = suppress
    ? {
      answer_type: "abstain",
      answer: "",
      citations: [],
      claim_table: [],
      abstention_reason: `Structural binder suppressed answer: ${reasons.join(", ")}.`,
    }
    : sourcePrediction;
  const scores = scoreBoundPrediction(prediction, reference, judgmentRow, suppress);
  const sourceScores = scoreBoundPrediction(sourcePrediction, reference, judgmentRow, false);
  return {
    example_id: row.example_id,
    prediction,
    source_prediction: sourcePrediction,
    reference,
    inherited_judgment: judgmentRow?.judgment ?? null,
    scores,
    source_scores: sourceScores,
    binder: {
      action: suppress ? "abstain" : "retain",
      reasons,
      helpful_suppression: suppress && !sourceScores.overall_correct && scores.overall_correct,
      harmful_suppression: suppress && sourceScores.overall_correct && !scores.overall_correct,
      unchanged_correctness: !suppress || sourceScores.overall_correct === scores.overall_correct,
    },
  };
}

function structuralReasons(row, prediction, evalRow, evidenceById) {
  const reasons = [];
  const answer = String(prediction.answer ?? "");
  const answerTokens = contentTokens(answer);
  const question = String(evalRow?.input?.question ?? evalRow?.input?.document_metadata?.question ?? "").toLowerCase();
  const citedText = (prediction.citations ?? []).map((id) => evidenceById.get(id) ?? "").join(" ");
  const citedLower = citedText.toLowerCase();
  const answerNumbers = [...new Set(answer.match(/\b\d+(?:[,.]\d+)*(?:\.\d+)?%?\b/g) ?? [])];
  const citedNumbers = new Set(citedText.match(/\b\d+(?:[,.]\d+)*(?:\.\d+)?%?\b/g) ?? []);

  if (!prediction.citations?.length) reasons.push("no_valid_citations");
  if (Number(row.metadata?.invalid_citations_dropped ?? 0) > 0) reasons.push("invalid_citations_dropped");
  if (answerTokens.length <= 2 && /\b(compare|baseline|model|task|dataset|which|what)\b/.test(question)) reasons.push("too_short_for_question_type");
  if (/\b(compare|compared|baseline|outperform|better|worse|higher|lower|best|state-of-the-art|stronger)\b/.test(answer.toLowerCase())
    && !/\b(compare|compared|baseline|outperform|better|worse|higher|lower|best|state-of-the-art|stronger|improve|improvement)\b/.test(citedLower)) {
    reasons.push("comparison_claim_not_in_cited_evidence");
  }
  if (answerNumbers.some((number) => !citedNumbers.has(number))) reasons.push("answer_number_absent_from_cited_evidence");
  return [...new Set(reasons)];
}

function scoreSourceRow(row, evalRow, judgmentRow) {
  return scoreBoundPrediction(normalizePrediction(row.prediction ?? {}), row.reference ?? evalRow?.reference ?? evalRow?.output ?? {}, judgmentRow, false);
}

function scoreBoundPrediction(prediction, reference, judgmentRow, binderSuppressed) {
  const answerable = reference?.answer_type !== "abstain";
  const answered = prediction.answer_type === "grounded_answer";
  if (answered) {
    const supported = isSupportedAnswer(judgmentRow?.judgment);
    return {
      answered: true,
      abstained: false,
      supported_answer: supported,
      supported_abstention: false,
      overall_correct: supported,
      unsupported_answer: !supported,
      unsupported_abstention: false,
      binder_suppressed: binderSuppressed,
    };
  }
  const supportedAbstention = binderSuppressed ? !answerable : isSupportedAbstention(judgmentRow?.judgment, answerable);
  return {
    answered: false,
    abstained: true,
    supported_answer: false,
    supported_abstention: supportedAbstention,
    overall_correct: supportedAbstention,
    unsupported_answer: false,
    unsupported_abstention: !supportedAbstention,
    binder_suppressed: binderSuppressed,
  };
}

function summarize(scores) {
  const answered = scores.filter((row) => row.answered);
  const abstained = scores.filter((row) => row.abstained);
  const supportedAnswers = answered.filter((row) => row.supported_answer);
  const supportedAbstentions = abstained.filter((row) => row.supported_abstention);
  return {
    examples: scores.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, scores.length),
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    abstention_support_rate: ratio(supportedAbstentions.length, abstained.length),
    overall_judged_correct_rate: ratio(scores.filter((row) => row.overall_correct).length, scores.length),
    unsupported_answers: answered.length - supportedAnswers.length,
    unsupported_abstentions: abstained.length - supportedAbstentions.length,
  };
}

function deriveConclusion(source, binder) {
  const preservesCoverage = binder.answer_rate >= 0.7;
  const improvesCorrectness = binder.overall_judged_correct_rate > source.overall_judged_correct_rate;
  const improvesSupport = Number(binder.answer_support_rate ?? 0) > Number(source.answer_support_rate ?? 0);
  return {
    status: preservesCoverage && improvesCorrectness && improvesSupport
      ? "binder_positive_needs_fresh_holdout"
      : improvesCorrectness || improvesSupport
        ? "binder_tradeoff_not_final"
        : "binder_negative",
    preserves_70pct_answer_rate: preservesCoverage,
    interpretation: preservesCoverage
      ? "Structural binding preserves the 70% answer-rate floor on this judged surface."
      : "Structural binding buys support/correctness, if any, by suppressing too much answer coverage.",
  };
}

function isSupportedAnswer(judgment) {
  return String(judgment?.verdict ?? "").toLowerCase() === "supported"
    && judgment?.all_claims_supported === true
    && judgment?.citation_ids_valid !== false;
}

function isSupportedAbstention(judgment, answerable) {
  const verdict = String(judgment?.verdict ?? "").toLowerCase();
  if (verdict === "correct_abstention" || verdict === "abstention_supported" || judgment?.abstention_supported === true) return true;
  if (verdict === "supported" && answerable === false) return true;
  return false;
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: answerType === "abstain" ? "" : String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : citations,
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? "Evidence is insufficient.") : null,
  };
}

function renderReport(result) {
  return `# Qwen 3B Structural Citation/Support Binder

Generated: ${result.generated_at}

Status: \`${result.conclusion.status}\`

## Metrics

| System | Answer rate | Answer support | Abstention support | Overall judged correct | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| Source repaired Qwen | ${pct(result.source_metrics.answer_rate)} | ${pct(result.source_metrics.answer_support_rate)} | ${pct(result.source_metrics.abstention_support_rate)} | ${pct(result.source_metrics.overall_judged_correct_rate)} | ${result.source_metrics.unsupported_answers} |
| Structural binder | ${pct(result.binder_metrics.answer_rate)} | ${pct(result.binder_metrics.answer_support_rate)} | ${pct(result.binder_metrics.abstention_support_rate)} | ${pct(result.binder_metrics.overall_judged_correct_rate)} | ${result.binder_metrics.unsupported_answers} |

## Suppressions

| Suppressed answers | Helpful suppressions | Harmful suppressions |
| ---: | ---: | ---: |
| ${result.suppression_summary.suppressed_answers} | ${result.suppression_summary.helpful_suppressions} | ${result.suppression_summary.harmful_suppressions} |

## Suppression Reasons

${Object.entries(result.suppression_summary.suppression_reasons).map(([reason, count]) => `- \`${reason}\`: ${count}`).join("\n")}

## Interpretation

${result.conclusion.interpretation}

${result.policy.claim_boundary}

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
`;
}

function contentTokens(value) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why"]);
  return String(value).toLowerCase().replace(/\[[^\]]+\]/g, " ").split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !stop.has(token));
}

function countBy(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function nullableDelta(left, right) {
  if (left == null || right == null) return null;
  return Number(left) - Number(right);
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

function byId(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
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
