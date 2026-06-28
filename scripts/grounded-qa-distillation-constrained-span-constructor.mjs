import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "constrained-span-constructor-final-window-2026-06-27-v1";
const dataFile = args["data-file"] ?? "extended_temporal_future_holdout.jsonl";
const trainStart = numberArg(args["train-start"], 240);
const trainEnd = numberArg(args["train-end"], 320);
const evalStart = numberArg(args["eval-start"], 320);
const evalEnd = numberArg(args["eval-end"], 389);
const thresholdGrid = [0.12, 0.15, 0.18, 0.2, 0.22, 0.25, 0.28, 0.3, 0.35, 0.4, 0.45, 0.5];

const outputDir = path.join(runDir, runId);
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const rows = await readJsonl(path.join(dataDir, dataFile));
const trainRows = rows.slice(trainStart, trainEnd).map(toRow);
const evalRows = rows.slice(evalStart, evalEnd).map(toRow);

const trainSweeps = thresholdGrid.map((threshold) => evaluate(trainRows, threshold, "train"));
const selected = chooseThreshold(trainSweeps);
const evalResult = evaluate(evalRows, selected.threshold, "eval");

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "constrained_span_constructor",
  status: classify(evalResult.metrics),
  purpose: "Test a zero-LLM answer constructor that can only emit a selected evidence span with an inline citation or abstain.",
  data: {
    source_file: path.join("docs/experiments/grounded-qa-distillation/data", dataFile),
    train_window: { id: `${trainStart}-${trainEnd}`, start_index_inclusive: trainStart, end_index_exclusive: trainEnd, examples: trainRows.length },
    eval_window: { id: `${evalStart + 1}-${evalEnd}`, start_index_inclusive: evalStart, end_index_exclusive: evalEnd, examples: evalRows.length },
    leakage_control: "Threshold selected on the prior 80-row window; final 69-row labels are used only for held-out evaluation metrics.",
  },
  method: {
    type: "zero_llm_constrained_evidence_span_constructor",
    prediction: "Rank evidence-pack sentences using lexical, numeric, section, and retrieval-rank features. Abstain below the prior-window threshold; otherwise return the selected sentence verbatim with one inline citation.",
    selected_threshold: selected.threshold,
    threshold_selection_objective: "On the prior window, prefer answer_rate >= 50% and reference-citation-supported answers >= 55% when possible, then maximize support-first reference metrics.",
    feature_weights: featureWeights(),
  },
  train_threshold_sweep: trainSweeps.map(({ predictions: _predictions, ...row }) => row),
  train: selected.metrics,
  eval: evalResult.metrics,
  interpretation: interpret(evalResult.metrics),
  budget: await readBudget(),
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "Local deterministic constructor; no OpenAI calls, no Prime/GPU launch.",
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), evalResult.predictions);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  selected_threshold: selected.threshold,
  train: selected.metrics,
  eval: evalResult.metrics,
  status: result.status,
}, null, 2));

function toRow(row) {
  return {
    example_id: row.example_id,
    source_split: row.source_split,
    input: row.input,
    reference: normalizeOutput(row.output),
  };
}

function normalizeOutput(output) {
  const answerType = output?.answer_type === "grounded_answer" ? "grounded_answer" : "abstain";
  const citations = answerType === "grounded_answer"
    ? (output?.citations ?? []).map((citation) => typeof citation === "string" ? citation : citation.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(output?.answer ?? ""),
    citations,
    claim_table: Array.isArray(output?.claim_table) ? output.claim_table : [],
    abstention_reason: output?.abstention_reason ?? null,
  };
}

function evaluate(rows, threshold, splitName) {
  const predictions = rows.map((row) => {
    const prediction = predict(row, threshold);
    const reference = row.reference;
    const answered = prediction.answer_type === "grounded_answer";
    const answerable = reference.answer_type === "grounded_answer";
    const referenceCitations = new Set(reference.citations);
    const citedGold = answered ? prediction.citations.filter((id) => referenceCitations.has(id)).length : 0;
    return {
      example_id: row.example_id,
      source_split: row.source_split,
      system: `constrained_span_constructor_${splitName}`,
      prediction,
      reference,
      scores: {
        answer_type_correct: prediction.answer_type === reference.answer_type,
        citation_precision: answered && prediction.citations.length ? citedGold / prediction.citations.length : null,
        citation_recall: answerable && reference.citations.length ? citedGold / reference.citations.length : null,
        answer_token_f1: answerable ? (answered ? tokenF1(prediction.answer, reference.answer) : 0) : null,
        abstention_correct: answerable ? !answered : !answered,
        inline_citation_rate: answered
          ? prediction.citations.filter((id) => prediction.answer.includes(`[${id}]`)).length / Math.max(1, prediction.citations.length)
          : null,
        selected_span_score: prediction.metadata?.selected_span_score ?? null,
      },
    };
  });
  return { threshold, metrics: summarizePredictions(predictions), predictions };
}

function predict(row, threshold) {
  const ranked = spanCandidates(row).sort((left, right) => right.score - left.score || left.retrieval_rank - right.retrieval_rank);
  const selected = ranked[0];
  if (!selected || selected.score < threshold) {
    return {
      answer_type: "abstain",
      answer: "The evidence pack does not contain enough support to answer this question.",
      citations: [],
      claim_table: [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }],
      abstention_reason: selected ? `Top constrained span score ${selected.score.toFixed(3)} below threshold ${threshold}.` : "No usable evidence span found.",
      metadata: {
        selected_span_score: selected?.score ?? null,
        selected_evidence_id: selected?.evidence_id ?? null,
        candidate_count: ranked.length,
      },
    };
  }
  const answerText = `${truncateAtWord(selected.text, 360)} [${selected.evidence_id}]`;
  return {
    answer_type: "grounded_answer",
    answer: answerText,
    citations: [selected.evidence_id],
    claim_table: [{ claim: stripCitations(answerText), support: "selected_evidence_span", citations: [selected.evidence_id] }],
    abstention_reason: null,
    metadata: {
      selected_span_score: selected.score,
      selected_evidence_id: selected.evidence_id,
      selected_section: selected.section,
      selected_retrieval_rank: selected.retrieval_rank,
      candidate_count: ranked.length,
      features: selected.features,
    },
  };
}

function spanCandidates(row) {
  const candidates = [];
  for (const evidence of row.input.compact_retrieved_evidence_pack ?? []) {
    const sentences = splitSentences(evidence.text);
    for (const [index, sentence] of sentences.entries()) {
      const text = sentence.trim();
      if (contentTokens(text).length < 4) continue;
      const features = spanFeatures(row, evidence, text, index);
      candidates.push({
        key: `${evidence.evidence_id}:${index}`,
        evidence_id: evidence.evidence_id,
        retrieval_rank: Number(evidence.retrieval_rank ?? 99),
        section: evidence.section ?? "",
        text,
        sentence_index: index,
        features,
        score: scoreSpan(features),
      });
    }
  }
  return candidates;
}

function spanFeatures(row, evidence, text, sentenceIndex) {
  const questionTokens = contentTokens(row.input.question);
  const spanTokens = contentTokens(text);
  const sectionTokens = contentTokens(evidence.section ?? "");
  const titleTokens = contentTokens(row.input.document_metadata?.title ?? "");
  const qSet = new Set(questionTokens);
  const sSet = new Set(spanTokens);
  const overlap = [...qSet].filter((token) => sSet.has(token)).length;
  const numberIntent = /\b(how many|how much|number|size|score|accuracy|percent|percentage|count|result|f1|rouge|bleu|improve|improvement|increase|decrease)\b/i.test(row.input.question);
  const yesNoIntent = /^(is|are|was|were|do|does|did|can|could|has|have|had)\b/i.test(row.input.question);
  return {
    reciprocal_rank: 1 / Math.max(1, Number(evidence.retrieval_rank ?? 99)),
    sentence_position: 1 / (1 + sentenceIndex),
    question_jaccard: jaccard(questionTokens, spanTokens),
    question_coverage: qSet.size ? overlap / qSet.size : 0,
    section_overlap: jaccard(questionTokens, sectionTokens),
    title_overlap: jaccard(questionTokens, titleTokens),
    log_span_length: Math.min(1, Math.log1p(spanTokens.length) / 6),
    too_long: spanTokens.length > 70 ? 1 : 0,
    number_match: numberIntent && /\d|percent|point|score|rouge|bleu|f1/i.test(text) ? 1 : 0,
    yes_no_match: yesNoIntent && /\b(show|shown|evidence|suggest|demonstrat|indicat|find|found|observe|report|yes|no|benefit|improv)\w*\b/i.test(text) ? 1 : 0,
    result_section: /\b(result|experiment|evaluation|analysis|table|figure|performance)\b/i.test(evidence.section ?? "") ? 1 : 0,
    answerish_text: /\b(result|show|shown|found|observe|improve|outperform|perform|achiev|score|accuracy|evidence|because|therefore|suggest)\w*\b/i.test(text) ? 1 : 0,
  };
}

function featureWeights() {
  return {
    reciprocal_rank: 0.13,
    sentence_position: 0.04,
    question_jaccard: 0.3,
    question_coverage: 0.28,
    section_overlap: 0.08,
    title_overlap: 0.05,
    log_span_length: 0.02,
    too_long: -0.04,
    number_match: 0.16,
    yes_no_match: 0.08,
    result_section: 0.08,
    answerish_text: 0.08,
  };
}

function scoreSpan(features) {
  return Object.entries(featureWeights()).reduce((total, [name, weight]) => total + weight * Number(features[name] ?? 0), 0);
}

function chooseThreshold(results) {
  const supportViable = results.filter((row) => row.metrics.answer_rate >= 0.5 && row.metrics.reference_citation_supported_answer_rate >= 0.55);
  const coverageViable = results.filter((row) => row.metrics.answer_rate >= 0.5);
  const pool = supportViable.length ? supportViable : coverageViable.length ? coverageViable : results;
  return [...pool].sort((left, right) => objective(right.metrics) - objective(left.metrics) || right.metrics.answer_rate - left.metrics.answer_rate)[0];
}

function objective(metrics) {
  return (2 * metrics.reference_citation_supported_answer_rate) + metrics.citation_recall + metrics.answer_token_f1 + (0.5 * metrics.answer_type_accuracy);
}

function summarizePredictions(predictions) {
  const answeredRows = predictions.filter((row) => row.prediction.answer_type === "grounded_answer");
  const answerableRows = predictions.filter((row) => row.reference.answer_type === "grounded_answer");
  const unsupportedByReferenceCitation = answeredRows.filter((row) => {
    const refs = new Set(row.reference.citations);
    return !row.prediction.citations.some((id) => refs.has(id));
  }).length;
  return {
    examples: predictions.length,
    answered: answeredRows.length,
    abstained: predictions.length - answeredRows.length,
    reference_answerable: answerableRows.length,
    answer_rate: mean(predictions.map((row) => row.prediction.answer_type === "grounded_answer")),
    answer_type_accuracy: mean(predictions.map((row) => row.scores.answer_type_correct)),
    citation_precision: mean(predictions.map((row) => row.scores.citation_precision)),
    citation_recall: mean(predictions.map((row) => row.scores.citation_recall)),
    answer_token_f1: mean(predictions.map((row) => row.scores.answer_token_f1)),
    abstention_accuracy: mean(predictions.map((row) => row.scores.abstention_correct)),
    inline_citation_rate: mean(predictions.map((row) => row.scores.inline_citation_rate)),
    reference_citation_supported_answer_rate: answeredRows.length ? (answeredRows.length - unsupportedByReferenceCitation) / answeredRows.length : 0,
    unsupported_by_reference_citation: unsupportedByReferenceCitation,
  };
}

function classify(metrics) {
  if (metrics.answer_rate >= 0.7 && metrics.reference_citation_supported_answer_rate >= 0.66) return "support_preserving_zero_llm_scaffold_candidate";
  if (metrics.reference_citation_supported_answer_rate >= 0.66 && metrics.answer_rate < 0.7) return "support_preserving_but_coverage_limited";
  return "coverage_or_support_limited_negative";
}

function interpret(metrics) {
  return {
    supports_as_final_scaffold: metrics.answer_rate >= 0.7 && metrics.reference_citation_supported_answer_rate >= 0.66,
    needs_paid_judge_before_pareto: metrics.answer_rate >= 0.5 && metrics.reference_citation_supported_answer_rate >= 0.5,
    next_step: metrics.answer_rate >= 0.5 && metrics.reference_citation_supported_answer_rate >= 0.5
      ? "Run a bounded paid support judge on this deterministic surface before adding it to the cost/coverage/support Pareto table."
      : "Do not spend on judging this exact surface; improve constrained construction or use it as a negative control.",
    conclusion: "A constrained extractive constructor is a valid low-cost scaffold only if it recovers enough answer coverage while selecting reference-supported evidence ids.",
  };
}

function renderReport(result) {
  const sweepRows = result.train_threshold_sweep.map((row) => (
    `| ${row.threshold} | ${row.metrics.answered} | ${pct(row.metrics.answer_rate)} | ${pct(row.metrics.reference_citation_supported_answer_rate)} | ${pct(row.metrics.citation_recall)} | ${pct(row.metrics.answer_token_f1)} | ${pct(row.metrics.answer_type_accuracy)} |`
  )).join("\n");
  return `# Constrained Span Constructor

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Purpose

Test whether a zero-LLM scaffold can preserve citation-groundedness by construction: it may only abstain or return one selected evidence sentence with one inline citation.

## Setup

| Item | Value |
| --- | --- |
| Source file | \`${result.data.source_file}\` |
| Threshold window | \`${result.data.train_window.id}\` (${result.data.train_window.examples} examples) |
| Eval window | \`${result.data.eval_window.id}\` (${result.data.eval_window.examples} examples) |
| Selected threshold | ${result.method.selected_threshold} |
| OpenAI calls | ${result.llm_budget.openai_llm_calls} |
| External compute | $${result.llm_budget.external_compute_cost_usd.toFixed(2)} |

## Prior-Window Threshold Sweep

| Threshold | Answered | Answer rate | Ref-citation supported answers | Citation recall | Answer F1 | Answer-type acc. |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${sweepRows}

## Held-Out Final Window

| Examples | Answered | Abstained | Answer rate | Ref-citation supported answers | Citation recall | Answer F1 | Answer-type acc. |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.eval.examples} | ${result.eval.answered} | ${result.eval.abstained} | ${pct(result.eval.answer_rate)} | ${pct(result.eval.reference_citation_supported_answer_rate)} | ${pct(result.eval.citation_recall)} | ${pct(result.eval.answer_token_f1)} | ${pct(result.eval.answer_type_accuracy)} |

## Interpretation

${result.interpretation.conclusion}

Next step: ${result.interpretation.next_step}

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
`;
}

async function readBudget() {
  try {
    const budget = JSON.parse(await fs.readFile(path.join(experimentDir, "spend", "budget.json"), "utf8"));
    return {
      max_budget_usd: budget.max_budget_usd,
      actual_total_spend_usd: budget.spend_usd?.total_actual,
      remaining_budget_usd: budget.spend_usd?.remaining,
      external_compute_actual_usd: budget.spend_usd?.external_compute,
    };
  } catch {
    return null;
  }
}

function splitSentences(text) {
  return String(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|;\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function contentTokens(value) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why", "they", "them", "there", "than", "then", "also", "any"]);
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stop.has(token));
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

function stripCitations(value) {
  return String(value).replace(/\s*\[[^\]]+\]/g, "").trim();
}

function counts(tokens) {
  const result = new Map();
  for (const token of tokens) result.set(token, (result.get(token) ?? 0) + 1);
  return result;
}

function jaccard(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / new Set([...left, ...right]).size;
}

function truncateAtWord(value, maxChars) {
  const text = String(value).trim();
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  return `${truncated.slice(0, Math.max(0, truncated.lastIndexOf(" "))).trim()}...`;
}

function mean(values) {
  const numeric = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number);
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : 0;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
