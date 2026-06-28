import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "extended_temporal_future_holdout";
const predictionRun = requiredArg("prediction-run");
const judgeRun = requiredArg("judge-run");
const runId = args["run-id"] ?? `answer-span-construction-gap-${predictionRun}-v1`;
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const predictions = await readJsonl(path.join(runDir, predictionRun, "predictions.jsonl"));
const judgments = await readJsonl(path.join(runDir, judgeRun, "judgments.jsonl"));
const referencesById = new Map(references.map((row) => [row.example_id, row]));
const predictionsById = new Map(predictions.map((row) => [row.example_id, row]));

const rows = judgments
  .filter((row) => row.prediction_answer_type === "grounded_answer")
  .map((judgeRow) => analyzeRow({
    judgeRow,
    predictionRow: predictionsById.get(judgeRow.example_id),
    reference: referencesById.get(judgeRow.example_id),
  }))
  .filter(Boolean);

const unsupportedRows = rows.filter((row) => !row.judge_supported);
const supportedRows = rows.filter((row) => row.judge_supported);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "answer_span_construction_gap",
  status: classify(rows),
  split,
  prediction_run: predictionRun,
  judge_run: judgeRun,
  purpose: "Diagnose whether judged failures are caused by evidence-id selection, answer-span construction, counterfactual answerability, or insufficient extractive recoverability from the gold evidence.",
  summary: {
    answered_predictions: rows.length,
    judge_supported_answers: supportedRows.length,
    unsupported_answers: unsupportedRows.length,
    judge_answer_support_rate: ratio(supportedRows.length, rows.length),
    selected_reference_citation_rows: rows.filter((row) => row.selected_reference_citation).length,
    selected_reference_citation_but_unsupported: unsupportedRows.filter((row) => row.selected_reference_citation).length,
    selected_non_reference_citation_unsupported: unsupportedRows.filter((row) => !row.selected_reference_citation).length,
    counterfactual_answered_unsupported: unsupportedRows.filter((row) => row.counterfactual).length,
    gold_oracle_span_recoverable_rows: unsupportedRows.filter((row) => row.gold_oracle.best_token_f1 >= 0.35).length,
    selected_oracle_span_recoverable_rows: unsupportedRows.filter((row) => row.selected_oracle.best_token_f1 >= 0.35).length,
    gold_oracle_high_recoverable_rows: unsupportedRows.filter((row) => row.gold_oracle.best_token_f1 >= 0.6).length,
    mean_selected_oracle_f1: mean(unsupportedRows.map((row) => row.selected_oracle.best_token_f1)),
    mean_gold_oracle_f1: mean(unsupportedRows.map((row) => row.gold_oracle.best_token_f1)),
  },
  bucket_counts: counts(rows.flatMap((row) => row.buckets)),
  unsupported_examples: unsupportedRows.slice(0, 20),
  interpretation: interpret(rows),
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "Reuses existing prediction, reference, and judge artifacts only.",
  },
};

await writeJsonl(path.join(outputDir, "rows.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  rows: path.relative(rootDir, path.join(outputDir, "rows.jsonl")),
  summary: result.summary,
  bucket_counts: result.bucket_counts,
}, null, 2));

function analyzeRow({ judgeRow, predictionRow, reference }) {
  if (!predictionRow || !reference) return null;
  const prediction = normalizePrediction(predictionRow.prediction ?? {});
  const judgment = judgeRow.judgment ?? {};
  const referenceCitations = new Set((reference.output?.citations ?? []).map((citation) => citation.evidence_id).filter(Boolean));
  const selectedReferenceCitation = prediction.citations.some((id) => referenceCitations.has(id));
  const judgeSupported = isSupported(judgment);
  const selectedEvidence = evidenceForIds(reference, prediction.citations);
  const goldEvidence = evidenceForIds(reference, [...referenceCitations]);
  const selectedOracle = bestSpanForAnswer(selectedEvidence, reference.output?.answer ?? "");
  const goldOracle = bestSpanForAnswer(goldEvidence, reference.output?.answer ?? "");
  const buckets = classifyBuckets({
    reference,
    prediction,
    judgment,
    judgeSupported,
    selectedReferenceCitation,
    selectedOracle,
    goldOracle,
  });
  return {
    example_id: judgeRow.example_id,
    counterfactual: Boolean(reference.input?.document_metadata?.counterfactual),
    reference_answer_type: reference.output?.answer_type ?? null,
    judge_verdict: judgment.verdict ?? "unknown",
    judge_supported: judgeSupported,
    selected_citations: prediction.citations,
    reference_citations: [...referenceCitations],
    selected_reference_citation: selectedReferenceCitation,
    prediction_answer_preview: compact(prediction.answer, 260),
    reference_answer_preview: compact(reference.output?.answer ?? "", 220),
    judge_notes: compact(judgment.notes ?? "", 360),
    unsupported_claims: (judgment.unsupported_claims ?? []).map((claim) => compact(claim, 260)),
    selected_oracle: selectedOracle,
    gold_oracle: goldOracle,
    buckets,
  };
}

function classifyBuckets({ reference, prediction, judgment, judgeSupported, selectedReferenceCitation, selectedOracle, goldOracle }) {
  if (judgeSupported) return ["judge_supported"];
  const buckets = [];
  const counterfactual = Boolean(reference.input?.document_metadata?.counterfactual);
  if (counterfactual) buckets.push("counterfactual_answered");
  if (selectedReferenceCitation) buckets.push("selected_gold_evidence_but_wrong_answer");
  else buckets.push("selected_non_gold_evidence");
  if (selectedOracle.best_token_f1 >= 0.35) buckets.push("selected_evidence_has_recoverable_span");
  else buckets.push("selected_evidence_span_not_recoverable");
  if (goldOracle.best_token_f1 >= 0.6) buckets.push("gold_evidence_has_high_extractable_answer");
  else if (goldOracle.best_token_f1 >= 0.35) buckets.push("gold_evidence_has_partial_extractable_answer");
  else buckets.push("gold_evidence_needs_abstractive_or_structured_answer");
  const text = `${prediction.answer} ${judgment.notes ?? ""} ${(judgment.unsupported_claims ?? []).join(" ")}`.toLowerCase();
  if (/\bdoes not answer|not answer|not relevant|instead|does not address|required to answer\b/.test(text)) buckets.push("question_mismatch");
  if (/\bdoes not mention|not mention|not specify|no evidence|not directly support\b/.test(text)) buckets.push("missing_direct_evidence");
  if (/\btable|float selected|figure|metric|score|accuracy|result\b/.test(text)) buckets.push("table_or_metric_span_issue");
  if (contentTokens(prediction.answer).length <= 4) buckets.push("too_short_answer");
  return [...new Set(buckets)];
}

function bestSpanForAnswer(evidenceItems, referenceAnswer) {
  const spans = evidenceItems.flatMap((evidence) => candidateSpans(evidence).map((span) => ({
    evidence_id: evidence.evidence_id,
    section: evidence.section ?? "",
    text: span,
    token_f1: tokenF1(span, referenceAnswer),
  })));
  const best = spans.sort((left, right) => right.token_f1 - left.token_f1 || contentTokens(left.text).length - contentTokens(right.text).length)[0];
  return best ? {
    evidence_id: best.evidence_id,
    section: best.section,
    best_token_f1: best.token_f1,
    best_span_preview: compact(best.text, 240),
  } : {
    evidence_id: null,
    section: "",
    best_token_f1: 0,
    best_span_preview: "",
  };
}

function candidateSpans(evidence) {
  const text = String(evidence.text ?? "");
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+|;\s+|\n+/).map((part) => part.trim()).filter(Boolean);
  const spans = [];
  for (const sentence of sentences) {
    spans.push(sentence);
    spans.push(...sentence.split(/,\s+(?=(?:which|where|who|and|but|with|show|showing|using|based|including|such as)\b)/i)
      .map((part) => part.trim())
      .filter((part) => contentTokens(part).length >= 4));
  }
  return [...new Set(spans)].filter(Boolean);
}

function evidenceForIds(reference, ids) {
  const idSet = new Set(ids);
  return (reference.input?.compact_retrieved_evidence_pack ?? []).filter((evidence) => idSet.has(evidence.evidence_id));
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : citations,
  };
}

function isSupported(judgment) {
  return String(judgment?.verdict ?? "").toLowerCase() === "supported"
    && judgment?.all_claims_supported === true
    && judgment?.citation_ids_valid !== false;
}

function classify(rows) {
  const unsupported = rows.filter((row) => !row.judge_supported);
  const wrongSpan = unsupported.filter((row) => row.buckets.includes("selected_gold_evidence_but_wrong_answer")).length;
  const nonGold = unsupported.filter((row) => row.buckets.includes("selected_non_gold_evidence")).length;
  if (wrongSpan > nonGold) return "answer_span_construction_dominates_evidence_id_selection";
  return "mixed_evidence_selection_and_answer_span_failures";
}

function interpret(rows) {
  const unsupported = rows.filter((row) => !row.judge_supported);
  const wrongSpan = unsupported.filter((row) => row.buckets.includes("selected_gold_evidence_but_wrong_answer")).length;
  const nonGold = unsupported.filter((row) => row.buckets.includes("selected_non_gold_evidence")).length;
  const highGoldOracle = unsupported.filter((row) => row.gold_oracle.best_token_f1 >= 0.6).length;
  return {
    primary_failure: wrongSpan > nonGold ? "answer_span_or_claim_construction" : "mixed_evidence_selection_and_answer_construction",
    next_training_signal: highGoldOracle >= unsupported.length / 3
      ? "Add question-conditioned answer-span extraction contrasts over gold evidence before another GPU run."
      : "Add structured answer construction targets, not just evidence-id labels, because many gold answers are not recoverable as a single sentence span.",
    paid_judge_needed_for_this_artifact: false,
    reason: "This is an offline post-hoc diagnosis over an already-paid judge run.",
  };
}

function renderReport(result) {
  const bucketRows = Object.entries(result.bucket_counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([bucket, count]) => `| \`${bucket}\` | ${count} |`)
    .join("\n");
  const examples = result.unsupported_examples.slice(0, 8)
    .map((row) => `- \`${row.example_id}\` (${row.buckets.join(", ")}): pred=${escapeMarkdown(row.prediction_answer_preview)}; ref=${escapeMarkdown(row.reference_answer_preview)}`)
    .join("\n");
  return `# Answer Span Construction Gap

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Setup

| Item | Value |
| --- | --- |
| Prediction run | \`${result.prediction_run}\` |
| Judge run | \`${result.judge_run}\` |
| Split | \`${result.split}\` |
| OpenAI calls | ${result.llm_budget.openai_llm_calls} |
| External compute | $${result.llm_budget.external_compute_cost_usd.toFixed(2)} |

## Summary

| Answered | Judge supported | Unsupported | Support rate | Selected ref citation but unsupported | Non-ref citation unsupported | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.summary.answered_predictions} | ${result.summary.judge_supported_answers} | ${result.summary.unsupported_answers} | ${pct(result.summary.judge_answer_support_rate)} | ${result.summary.selected_reference_citation_but_unsupported} | ${result.summary.selected_non_reference_citation_unsupported} | ${result.summary.counterfactual_answered_unsupported} |

| Oracle recoverability | Rows |
| --- | ---: |
| Selected evidence span F1 >= 0.35 | ${result.summary.selected_oracle_span_recoverable_rows} |
| Gold evidence span F1 >= 0.35 | ${result.summary.gold_oracle_span_recoverable_rows} |
| Gold evidence span F1 >= 0.60 | ${result.summary.gold_oracle_high_recoverable_rows} |

## Buckets

| Bucket | Count |
| --- | ---: |
${bucketRows}

## Examples

${examples}

## Interpretation

Primary failure: \`${result.interpretation.primary_failure}\`

Next training signal: ${result.interpretation.next_training_signal}

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
`;
}

function tokenF1(prediction, reference) {
  const predicted = contentTokens(stripCitations(prediction));
  const gold = contentTokens(stripCitations(reference));
  if (!predicted.length && !gold.length) return 1;
  if (!predicted.length || !gold.length) return 0;
  const goldCounts = countsMap(gold);
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
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why", "they", "them", "there", "than", "then", "also", "any"]);
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stop.has(token));
}

function stripCitations(value) {
  return String(value).replace(/\s*\[[^\]]+\]/g, "").trim();
}

function counts(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function countsMap(values) {
  const result = new Map();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

function mean(values) {
  const numeric = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number);
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : 0;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value)).toFixed(1)}%`;
}

function compact(value, length = 220) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function escapeMarkdown(value) {
  return String(value).replaceAll("|", "\\|");
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function requiredArg(name) {
  const value = args[name];
  if (!value) throw new Error(`Missing --${name}=...`);
  return value;
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
