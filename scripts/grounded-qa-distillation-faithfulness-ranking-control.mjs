import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "faithfulness-ranking-control-final-window-2026-06-27-v1";
const split = args.split ?? "extended_temporal_future_holdout";
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);

const trainWindow = {
  label: "241-320",
  predictionRun: "citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
  judgeRun: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
};
const evalWindow = {
  label: "321-389",
  predictionRun: "citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
  judgeRun: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
};

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const references = keyed(await readJsonl(path.join(dataDir, `${split}.jsonl`)));
const trainRows = await buildRows(trainWindow, references, null);
const thresholds = sweepThresholds(trainRows);
const selected = selectThreshold(thresholds);
const evalRows = await buildRows(evalWindow, references, selected.threshold);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "faithfulness_ranking_control",
  control_type: "zero_call_retrieval_side_faithfulness_filter",
  purpose: "Test whether lexical faithfulness/ranking over cited evidence can explain support gains without trained repair/regeneration.",
  split,
  train_window: {
    ...trainWindow,
    examples: trainRows.length,
    threshold_selection_policy: "Maximize inherited support-oracle correctness on examples 241-320 subject to answer_rate >= 70%; tie-break by answer support, then answer rate, then lower threshold.",
  },
  eval_window: {
    ...evalWindow,
    examples: evalRows.length,
  },
  selected_threshold: selected,
  train_threshold_grid: thresholds,
  eval_metrics: summarizePolicy(evalRows),
  baseline_eval_metrics: summarizeBaseline(evalRows),
  local_task_metrics: summarizePredictions(evalRows),
  feature_summary: summarizeFeatures(evalRows),
  changed_examples: evalRows.filter((row) => row.metadata.faithfulness_filter_fired).map(renderChangedExample),
  paper_implication: paperImplication(evalRows, selected),
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This control reuses existing direct-repair predictions and GPT-4o judgments; it makes no new model or GPU calls.",
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), evalRows);
await writeJsonl(path.join(outputDir, "train_diagnostics.jsonl"), trainRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(reportPath, renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  artifact_type: result.artifact_type,
  selected_threshold: result.selected_threshold,
  baseline_eval_metrics: result.baseline_eval_metrics,
  eval_metrics: result.eval_metrics,
  local_task_metrics: result.local_task_metrics,
  llm_budget: result.llm_budget,
}, null, 2));

async function buildRows(window, referencesById, threshold) {
  const predictions = await readJsonl(path.join(runDir, window.predictionRun, "predictions.jsonl"));
  const judgments = keyed(await readJsonl(path.join(runDir, window.judgeRun, "judgments.jsonl")));
  const rows = [];
  for (const row of predictions) {
    const reference = referencesById.get(row.example_id);
    const judgeRow = judgments.get(row.example_id);
    if (!reference || !judgeRow) continue;
    const sourcePrediction = normalizePrediction(row.prediction ?? {});
    const features = faithfulnessFeatures(sourcePrediction, reference.input);
    const sourceSupported = sourcePrediction.answer_type === "grounded_answer"
      ? isSupportedAnswer(judgeRow.judgment)
      : isCorrectAbstention(judgeRow.judgment);
    const sourceCorrect = sourceSupported;
    const filterFired = threshold != null
      && sourcePrediction.answer_type === "grounded_answer"
      && features.faithfulness_score < threshold;
    const prediction = filterFired ? abstainPrediction(features, threshold) : sourcePrediction;
    const filterCorrect = filterFired ? !isSupportedAnswer(judgeRow.judgment) : sourceCorrect;
    rows.push({
      example_id: row.example_id,
      window: window.label,
      prediction,
      source_prediction: sourcePrediction,
      cost_usd: 0,
      metadata: {
        scaffold: "zero_call_faithfulness_ranking_filter_over_direct_repair",
        source_run_id: window.predictionRun,
        judge_run_id: window.judgeRun,
        threshold,
        faithfulness_filter_fired: filterFired,
        faithfulness_features: features,
      },
      inherited_judgment: {
        source_verdict: judgeRow.judgment?.verdict ?? null,
        source_answer_supported: sourcePrediction.answer_type === "grounded_answer" ? isSupportedAnswer(judgeRow.judgment) : null,
        source_correct: sourceCorrect,
        filter_correct_oracle: filterCorrect,
        interpretation: filterFired
          ? (isSupportedAnswer(judgeRow.judgment) ? "harmful_suppression_supported_answer" : "suppressed_unsupported_answer")
          : "unchanged",
      },
      scores: scorePrediction(reference, prediction),
    });
  }
  return rows;
}

function faithfulnessFeatures(prediction, input) {
  const evidence = input.compact_retrieved_evidence_pack ?? [];
  const evidenceById = new Map(evidence.map((item) => [item.evidence_id, item]));
  const citedEvidence = prediction.citations.map((id) => evidenceById.get(id)).filter(Boolean);
  const answerText = [
    prediction.answer,
    ...(prediction.claim_table ?? []).flatMap((claim) => [claim.claim, claim.support]),
  ].filter(Boolean).join(" ");
  const strippedAnswer = stripCitations(answerText);
  const answerTokens = contentTokens(strippedAnswer);
  const questionTokens = contentTokens(input.question ?? "");
  const citedText = citedEvidence.map((item) => item.text ?? "").join(" ");
  const citedTokens = contentTokens(citedText);
  const evidenceScores = evidence.map((item) => {
    const tokens = contentTokens(item.text ?? "");
    return {
      evidence_id: item.evidence_id,
      answer_overlap: tokenCoverage(answerTokens, tokens),
      question_overlap: tokenCoverage(questionTokens, tokens),
      combined_overlap: 0.75 * tokenCoverage(answerTokens, tokens) + 0.25 * tokenCoverage(questionTokens, tokens),
      cited: prediction.citations.includes(item.evidence_id),
    };
  }).sort((a, b) => b.combined_overlap - a.combined_overlap || a.evidence_id.localeCompare(b.evidence_id));
  const citedRanks = prediction.citations
    .map((id) => evidenceScores.findIndex((item) => item.evidence_id === id))
    .filter((rank) => rank >= 0);
  const bestCitedRank = citedRanks.length ? Math.min(...citedRanks) : null;
  const bestCitedCombined = evidenceScores.filter((item) => item.cited).reduce((best, item) => Math.max(best, item.combined_overlap), 0);
  const bestAnyCombined = evidenceScores[0]?.combined_overlap ?? 0;
  const rankPenalty = bestCitedRank == null ? 0.25 : Math.min(bestCitedRank, 5) * 0.025;
  const unsupportedNumbers = unsupportedNumberTokens(strippedAnswer, citedText, input.question ?? "");
  const numberPenalty = unsupportedNumbers.length ? 0.18 : 0;
  const citationMissingPenalty = prediction.answer_type === "grounded_answer" && !prediction.citations.length ? 0.35 : 0;
  const citedAnswerOverlap = tokenCoverage(answerTokens, citedTokens);
  const citedQuestionOverlap = tokenCoverage(questionTokens, citedTokens);
  const faithfulnessScore = clamp(
    0.7 * citedAnswerOverlap
    + 0.15 * citedQuestionOverlap
    + 0.15 * bestCitedCombined
    - rankPenalty
    - numberPenalty
    - citationMissingPenalty,
    0,
    1,
  );
  return {
    answer_token_count: answerTokens.length,
    cited_answer_overlap: citedAnswerOverlap,
    cited_question_overlap: citedQuestionOverlap,
    best_cited_combined_overlap: bestCitedCombined,
    best_any_combined_overlap: bestAnyCombined,
    cited_rank_gap: Math.max(0, bestAnyCombined - bestCitedCombined),
    best_cited_rank: bestCitedRank,
    unsupported_numbers: unsupportedNumbers,
    citation_missing: prediction.answer_type === "grounded_answer" && !prediction.citations.length,
    faithfulness_score: faithfulnessScore,
    top_evidence: evidenceScores.slice(0, 5),
  };
}

function unsupportedNumberTokens(answer, citedText, question) {
  const answerNumbers = [...new Set(numberTokens(answer).map(normalizeNumber))];
  const citedNumbers = new Set(numberTokens(citedText).map(normalizeNumber));
  const questionNumbers = new Set(numberTokens(question).map(normalizeNumber));
  return answerNumbers.filter((number) => !citedNumbers.has(number) && !questionNumbers.has(number));
}

function sweepThresholds(rows) {
  const thresholds = [];
  for (let i = 0; i <= 100; i += 2) thresholds.push(i / 100);
  return thresholds.map((threshold) => ({
    threshold,
    ...summarizePolicy(applyThreshold(rows, threshold)),
  }));
}

function applyThreshold(rows, threshold) {
  return rows.map((row) => {
    const fire = row.source_prediction.answer_type === "grounded_answer"
      && row.metadata.faithfulness_features.faithfulness_score < threshold;
    return {
      ...row,
      prediction: fire ? abstainPrediction(row.metadata.faithfulness_features, threshold) : row.source_prediction,
      metadata: {
        ...row.metadata,
        threshold,
        faithfulness_filter_fired: fire,
      },
      inherited_judgment: {
        ...row.inherited_judgment,
        filter_correct_oracle: fire ? !row.inherited_judgment.source_answer_supported : row.inherited_judgment.source_correct,
        interpretation: fire
          ? (row.inherited_judgment.source_answer_supported ? "harmful_suppression_supported_answer" : "suppressed_unsupported_answer")
          : "unchanged",
      },
    };
  });
}

function selectThreshold(rows) {
  const eligible = rows.filter((row) => row.answer_rate >= 0.7);
  const pool = eligible.length ? eligible : rows;
  return [...pool].sort((a, b) => (
    b.correct_rate - a.correct_rate
    || b.answer_support_rate - a.answer_support_rate
    || b.answer_rate - a.answer_rate
    || a.threshold - b.threshold
  ))[0];
}

function summarizeBaseline(rows) {
  const answered = rows.filter((row) => row.source_prediction.answer_type === "grounded_answer");
  const supported = answered.filter((row) => row.inherited_judgment.source_answer_supported).length;
  const correct = rows.filter((row) => row.inherited_judgment.source_correct).length;
  return {
    examples: rows.length,
    answered: answered.length,
    answer_rate: answered.length / rows.length,
    answer_support_rate: answered.length ? supported / answered.length : 0,
    correct: correct,
    correct_rate: correct / rows.length,
  };
}

function summarizePolicy(rows) {
  const answered = rows.filter((row) => row.prediction.answer_type === "grounded_answer");
  const supportedAnswers = answered.filter((row) => row.inherited_judgment.source_answer_supported).length;
  const suppressed = rows.filter((row) => row.metadata.faithfulness_filter_fired);
  const correct = rows.filter((row) => row.inherited_judgment.filter_correct_oracle).length;
  const baseline = rows.filter((row) => row.inherited_judgment.source_correct).length;
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: rows.length - answered.length,
    answer_rate: answered.length / rows.length,
    answer_support_rate: answered.length ? supportedAnswers / answered.length : 0,
    correct,
    correct_rate: correct / rows.length,
    baseline_correct: baseline,
    baseline_correct_rate: baseline / rows.length,
    delta_correct: correct - baseline,
    delta_correct_rate: (correct - baseline) / rows.length,
    suppressions: suppressed.length,
    suppressed_unsupported_answers: suppressed.filter((row) => !row.inherited_judgment.source_answer_supported).length,
    harmful_suppressed_supported_answers: suppressed.filter((row) => row.inherited_judgment.source_answer_supported).length,
  };
}

function summarizeFeatures(rows) {
  const answered = rows.filter((row) => row.source_prediction.answer_type === "grounded_answer");
  const supported = answered.filter((row) => row.inherited_judgment.source_answer_supported);
  const unsupported = answered.filter((row) => row.inherited_judgment.source_answer_supported === false);
  return {
    answered_source_rows: answered.length,
    mean_score_supported_answers: mean(supported.map((row) => row.metadata.faithfulness_features.faithfulness_score)),
    mean_score_unsupported_answers: mean(unsupported.map((row) => row.metadata.faithfulness_features.faithfulness_score)),
    mean_cited_answer_overlap_supported: mean(supported.map((row) => row.metadata.faithfulness_features.cited_answer_overlap)),
    mean_cited_answer_overlap_unsupported: mean(unsupported.map((row) => row.metadata.faithfulness_features.cited_answer_overlap)),
    unsupported_number_rows: answered.filter((row) => row.metadata.faithfulness_features.unsupported_numbers.length).length,
  };
}

function paperImplication(rows, selected) {
  const evalMetrics = summarizePolicy(rows);
  const baseline = summarizeBaseline(rows);
  if (evalMetrics.delta_correct > 0 && evalMetrics.answer_rate >= 0.7) {
    return "A zero-call lexical faithfulness/ranking filter is a nontrivial same-window baseline that trained Qwen must beat on support and coverage; it still only suppresses unsupported direct answers and does not repair oracle-gap examples.";
  }
  if (evalMetrics.delta_correct > 0) {
    return "The lexical faithfulness/ranking filter improves inherited support-oracle correctness only by dropping below the target coverage region, so it is a support-first diagnostic rather than the final amortized answerer.";
  }
  return `The lexical faithfulness/ranking filter does not improve inherited final-window correctness over direct repair at the selected ${pct(selected.threshold)} threshold (${evalMetrics.correct}/${evalMetrics.examples} vs ${baseline.correct}/${baseline.examples}); reviewer-facing retrieval-side controls remain necessary, but they do not replace the Qwen repair/regeneration test.`;
}

function renderChangedExample(row) {
  const features = row.metadata.faithfulness_features;
  return {
    example_id: row.example_id,
    interpretation: row.inherited_judgment.interpretation,
    source_verdict: row.inherited_judgment.source_verdict,
    faithfulness_score: features.faithfulness_score,
    cited_answer_overlap: features.cited_answer_overlap,
    best_cited_rank: features.best_cited_rank,
    unsupported_numbers: features.unsupported_numbers,
    answer_preview: compact(row.source_prediction.answer, 220),
  };
}

function abstainPrediction(features, threshold) {
  return {
    answer_type: "abstain",
    answer: "The cited evidence does not provide enough support for the generated answer.",
    citations: [],
    claim_table: [{
      claim: "Generated answer failed the zero-call cited-evidence faithfulness/ranking filter.",
      support: `faithfulness_score=${features.faithfulness_score.toFixed(3)} threshold=${Number(threshold).toFixed(3)}`,
      citations: [],
    }],
    abstention_reason: `Faithfulness ranking filter score ${features.faithfulness_score.toFixed(3)} was below threshold ${Number(threshold).toFixed(3)}.`,
  };
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

function renderReport(result) {
  const gridRows = result.train_threshold_grid
    .filter((row) => [0, result.selected_threshold.threshold, 0.2, 0.4, 0.6, 0.8, 1].some((value) => Math.abs(value - row.threshold) < 0.0001))
    .map((row) => `| ${pct(row.threshold)} | ${pct(row.answer_rate)} | ${pct(row.answer_support_rate)} | ${row.correct}/${row.examples} (${pct(row.correct_rate)}) | ${signed(row.delta_correct)} | ${row.suppressions} |`)
    .join("\n");
  const changedRows = result.changed_examples.slice(0, 20).map((row) => (
    `| \`${row.example_id}\` | ${row.interpretation.replaceAll("_", " ")} | ${row.source_verdict} | ${pct(row.faithfulness_score)} | ${pct(row.cited_answer_overlap)} | ${row.best_cited_rank ?? "n/a"} | ${row.unsupported_numbers.join(", ") || "none"} | ${escapeCell(row.answer_preview)} |`
  )).join("\n");
  return `# Faithfulness Ranking Control

Scope: ${result.eval_window.label} final window over direct mini + citation repair.

This run makes no LLM calls and launches no GPU jobs. It trains a lexical cited-evidence faithfulness threshold on ${result.train_window.label}, then applies the fixed threshold to ${result.eval_window.label}. It does not rewrite citations or answers; it only suppresses low-score answers, so inherited GPT-4o support judgments remain interpretable as a support-oracle diagnostic.

## Threshold Selection

Selected threshold: ${pct(result.selected_threshold.threshold)}.

| Threshold | Train answer rate | Train answer support | Train support-oracle correct | Delta vs direct | Suppressions |
| ---: | ---: | ---: | ---: | ---: | ---: |
${gridRows}

## Final-Window Result

| Policy | Answer rate | Answer support | Support-oracle correct | Suppressions | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Direct repair baseline | ${pct(result.baseline_eval_metrics.answer_rate)} | ${pct(result.baseline_eval_metrics.answer_support_rate)} | ${result.baseline_eval_metrics.correct}/${result.baseline_eval_metrics.examples} (${pct(result.baseline_eval_metrics.correct_rate)}) | 0 | 0 |
| Faithfulness ranking filter | ${pct(result.eval_metrics.answer_rate)} | ${pct(result.eval_metrics.answer_support_rate)} | ${result.eval_metrics.correct}/${result.eval_metrics.examples} (${pct(result.eval_metrics.correct_rate)}) | ${result.eval_metrics.suppressions} | ${result.eval_metrics.harmful_suppressed_supported_answers} |

Delta: ${signed(result.eval_metrics.delta_correct)} rows, ${signedPct(result.eval_metrics.delta_correct_rate)}.

## Local Task Metrics After Filter

| Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.local_task_metrics.answered} | ${pct(result.local_task_metrics.answer_type_accuracy)} | ${pct(result.local_task_metrics.citation_precision)} | ${pct(result.local_task_metrics.citation_recall)} | ${pct(result.local_task_metrics.answer_token_f1)} | ${pct(result.local_task_metrics.inline_citation_rate)} |

## Feature Separation

| Supported answer score | Unsupported answer score | Supported overlap | Unsupported overlap | Unsupported-number rows |
| ---: | ---: | ---: | ---: | ---: |
| ${pct(result.feature_summary.mean_score_supported_answers)} | ${pct(result.feature_summary.mean_score_unsupported_answers)} | ${pct(result.feature_summary.mean_cited_answer_overlap_supported)} | ${pct(result.feature_summary.mean_cited_answer_overlap_unsupported)} | ${result.feature_summary.unsupported_number_rows} |

## Suppressed Examples

| Example | Interpretation | Source verdict | Faithfulness score | Cited answer overlap | Best cited rank | Unsupported numbers | Answer preview |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
${changedRows || "| none | none | none | n/a | n/a | n/a | none | none |"}

## Paper Implication

${result.paper_implication}
`;
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
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why", "not", "also"]);
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

function normalizeNumber(value) {
  const lower = String(value).toLowerCase().replaceAll(",", "");
  const suffix = lower.match(/^(\d+(?:\.\d+)?)([kmb])$/);
  if (!suffix) return lower;
  const multipliers = { k: 1000, m: 1000000, b: 1000000000 };
  return String(Number(suffix[1]) * multipliers[suffix[2]]);
}

function stripCitations(value) {
  return String(value).replace(/\s*\[[^\]]+\]/g, "").trim();
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

function compact(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function escapeCell(value) {
  return compact(value, 220).replaceAll("|", "\\|");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
