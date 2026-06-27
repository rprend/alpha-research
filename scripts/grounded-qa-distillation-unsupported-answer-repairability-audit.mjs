import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "unsupported-answer-repairability-audit-final-window-2026-06-27-v1";
const split = args.split ?? "extended_temporal_future_holdout";
const predictionRunId = args["prediction-run-id"] ?? "citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1";
const judgeRunId = args["judge-run-id"] ?? "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1";
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const references = keyed(await readJsonl(path.join(dataDir, `${split}.jsonl`)));
const predictions = keyed(await readJsonl(path.join(runDir, predictionRunId, "predictions.jsonl")));
const judgments = keyed(await readJsonl(path.join(runDir, judgeRunId, "judgments.jsonl")));
const rows = [];

for (const [exampleId, predictionRow] of predictions) {
  const reference = references.get(exampleId);
  const judgeRow = judgments.get(exampleId);
  if (!reference || !judgeRow) continue;
  const prediction = normalizePrediction(predictionRow.prediction ?? {});
  if (prediction.answer_type !== "grounded_answer") continue;
  if (isSupportedAnswer(judgeRow.judgment)) continue;
  rows.push(auditRow(reference, predictionRow, prediction, judgeRow));
}

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "unsupported_answer_repairability_audit",
  purpose: "Classify unsupported direct repaired final-window answers by whether a retrieval/citation repair appears plausible from the existing evidence pack or answer repair/regeneration is required.",
  inputs: {
    split,
    prediction_run_id: predictionRunId,
    judge_run_id: judgeRunId,
    final_window: "321-389",
  },
  aggregate: summarize(rows),
  buckets: bucketCounts(rows),
  examples: rows.map(renderExample),
  training_implication: trainingImplication(rows),
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit reads existing direct-repair predictions, existing GPT-4o judgments, and local evidence packs only.",
  },
};

await writeJsonl(path.join(outputDir, "audit_rows.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(reportPath, renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  artifact_type: result.artifact_type,
  aggregate: result.aggregate,
  buckets: result.buckets,
  training_implication: result.training_implication,
  llm_budget: result.llm_budget,
}, null, 2));

function auditRow(reference, predictionRow, prediction, judgeRow) {
  const input = reference.input ?? {};
  const evidence = input.compact_retrieved_evidence_pack ?? [];
  const cited = new Set(prediction.citations ?? []);
  const unsupportedClaims = Array.isArray(judgeRow.judgment?.unsupported_claims)
    ? judgeRow.judgment.unsupported_claims.filter(Boolean)
    : [];
  const claimText = unsupportedClaims.length ? unsupportedClaims.join(" ") : prediction.answer;
  const claimTokens = contentTokens(claimText);
  const answerTokens = contentTokens(prediction.answer);
  const citedEvidenceText = evidence.filter((item) => cited.has(item.evidence_id)).map((item) => item.text ?? "").join(" ");
  const citedClaimOverlap = tokenCoverage(claimTokens, contentTokens(citedEvidenceText));
  const citedAnswerOverlap = tokenCoverage(answerTokens, contentTokens(citedEvidenceText));
  const evidenceScores = evidence.map((item) => {
    const tokens = contentTokens(item.text ?? "");
    return {
      evidence_id: item.evidence_id,
      cited: cited.has(item.evidence_id),
      role: reference.teacher_trace?.evidence_roles?.[item.evidence_id] ?? null,
      claim_overlap: tokenCoverage(claimTokens, tokens),
      answer_overlap: tokenCoverage(answerTokens, tokens),
      number_support: numberSupportScore(claimText, item.text ?? "", input.question ?? ""),
      combined_score: 0.65 * tokenCoverage(claimTokens, tokens)
        + 0.25 * tokenCoverage(answerTokens, tokens)
        + 0.1 * numberSupportScore(claimText, item.text ?? "", input.question ?? ""),
      text_preview: compact(item.text, 240),
    };
  }).sort((a, b) => b.combined_score - a.combined_score || a.evidence_id.localeCompare(b.evidence_id));
  const best = evidenceScores[0] ?? null;
  const bestNonCited = evidenceScores.find((item) => !item.cited) ?? null;
  const bestCited = evidenceScores.find((item) => item.cited) ?? null;
  const referenceAnswerable = reference.output?.answer_type === "grounded_answer";
  const referenceCitationIds = new Set((reference.output?.citations ?? []).map((row) => row.evidence_id));
  const bestHitsReferenceCitation = best ? referenceCitationIds.has(best.evidence_id) : false;
  const missingGoldCitation = [...referenceCitationIds].some((id) => !cited.has(id));
  const citationRepairScore = Math.max(
    0,
    (bestNonCited?.combined_score ?? 0) - (bestCited?.combined_score ?? 0),
  );
  const answerRefF1 = referenceAnswerable ? tokenF1(prediction.answer, stripCitations(reference.output.answer ?? "")) : 0;
  const unsupportedNumbers = unsupportedNumberTokens(claimText, citedEvidenceText, input.question ?? "");
  const bucket = classify({
    referenceAnswerable,
    citationRepairScore,
    bestNonCited,
    bestHitsReferenceCitation,
    missingGoldCitation,
    answerRefF1,
    citedClaimOverlap,
    unsupportedNumbers,
  });
  return {
    example_id: reference.example_id,
    prediction_run_id: predictionRow.source_run_id ?? predictionRunId,
    question: input.question,
    reference_answer_type: reference.output?.answer_type ?? null,
    prediction_answer: prediction.answer,
    prediction_citations: prediction.citations,
    judgment: {
      verdict: judgeRow.judgment?.verdict ?? null,
      unsupported_claims: unsupportedClaims,
      notes: judgeRow.judgment?.notes ?? "",
    },
    repairability: {
      bucket,
      reference_answerable: referenceAnswerable,
      answer_ref_f1: answerRefF1,
      cited_claim_overlap: citedClaimOverlap,
      cited_answer_overlap: citedAnswerOverlap,
      best_non_cited_gain: citationRepairScore,
      best_hits_reference_citation: bestHitsReferenceCitation,
      missing_gold_citation: missingGoldCitation,
      unsupported_numbers: unsupportedNumbers,
    },
    evidence_scores: {
      best,
      best_cited: bestCited ?? null,
      best_non_cited: bestNonCited ?? null,
      top5: evidenceScores.slice(0, 5),
    },
  };
}

function classify({ referenceAnswerable, citationRepairScore, bestNonCited, bestHitsReferenceCitation, missingGoldCitation, answerRefF1, citedClaimOverlap, unsupportedNumbers }) {
  if (!referenceAnswerable) return "should_abstain_counterfactual_or_insufficient";
  if (
    bestNonCited
    && missingGoldCitation
    && (bestHitsReferenceCitation || citationRepairScore >= 0.12)
    && answerRefF1 >= 0.35
    && unsupportedNumbers.length === 0
  ) {
    return "citation_repair_candidate";
  }
  if (answerRefF1 >= 0.35 && citedClaimOverlap < 0.35 && missingGoldCitation) {
    return "mixed_citation_and_answer_repair";
  }
  return "answer_repair_or_regeneration_needed";
}

function summarize(rows) {
  const answerable = rows.filter((row) => row.repairability.reference_answerable);
  const citationRepair = rows.filter((row) => row.repairability.bucket === "citation_repair_candidate");
  const mixed = rows.filter((row) => row.repairability.bucket === "mixed_citation_and_answer_repair");
  const regenerate = rows.filter((row) => row.repairability.bucket === "answer_repair_or_regeneration_needed");
  const abstain = rows.filter((row) => row.repairability.bucket === "should_abstain_counterfactual_or_insufficient");
  return {
    unsupported_answer_rows: rows.length,
    reference_answerable_rows: answerable.length,
    reference_insufficient_rows: abstain.length,
    citation_repair_candidate_rows: citationRepair.length,
    mixed_citation_and_answer_repair_rows: mixed.length,
    answer_repair_or_regeneration_needed_rows: regenerate.length,
    mean_answer_ref_f1: mean(rows.map((row) => row.repairability.answer_ref_f1)),
    mean_cited_claim_overlap: mean(rows.map((row) => row.repairability.cited_claim_overlap)),
    mean_best_non_cited_gain: mean(rows.map((row) => row.repairability.best_non_cited_gain)),
    citation_repair_candidate_rate: ratio(citationRepair.length, rows.length),
    answer_repair_or_regeneration_needed_rate: ratio(regenerate.length + mixed.length, rows.length),
  };
}

function bucketCounts(rows) {
  const counts = {};
  for (const row of rows) counts[row.repairability.bucket] = (counts[row.repairability.bucket] ?? 0) + 1;
  return counts;
}

function trainingImplication(rows) {
  const aggregate = summarize(rows);
  const repairNeeded = aggregate.mixed_citation_and_answer_repair_rows + aggregate.answer_repair_or_regeneration_needed_rows;
  return {
    citation_repair_alone_sufficient: aggregate.citation_repair_candidate_rows >= rows.length * 0.5,
    repair_or_regeneration_rows: repairNeeded,
    abstention_rows: aggregate.reference_insufficient_rows,
    recommendation: aggregate.citation_repair_candidate_rows >= rows.length * 0.5
      ? "Prioritize citation reranking/repair before model-side answer regeneration."
      : "Keep the Qwen joint-action packet focused on answer repair/regeneration plus abstention; citation repair alone explains only a minority of unsupported final-window direct answers.",
  };
}

function renderExample(row) {
  return {
    example_id: row.example_id,
    bucket: row.repairability.bucket,
    answer_ref_f1: row.repairability.answer_ref_f1,
    cited_claim_overlap: row.repairability.cited_claim_overlap,
    best_non_cited_gain: row.repairability.best_non_cited_gain,
    best_hits_reference_citation: row.repairability.best_hits_reference_citation,
    unsupported_claim_preview: compact(row.judgment.unsupported_claims.join(" "), 180),
    answer_preview: compact(row.prediction_answer, 180),
    best_evidence_id: row.evidence_scores.best?.evidence_id ?? null,
    best_evidence_preview: row.evidence_scores.best?.text_preview ?? null,
  };
}

function renderReport(result) {
  const bucketRows = Object.entries(result.buckets)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([bucket, count]) => `| ${bucket} | ${count} | ${pct(count / result.aggregate.unsupported_answer_rows)} |`)
    .join("\n");
  const examples = result.examples.slice(0, 24).map((row) => (
    `| \`${row.example_id}\` | ${row.bucket} | ${pct(row.answer_ref_f1)} | ${pct(row.cited_claim_overlap)} | ${pct(row.best_non_cited_gain)} | ${row.best_hits_reference_citation ? "yes" : "no"} | ${escapeCell(row.unsupported_claim_preview)} | ${escapeCell(row.best_evidence_preview ?? "")} |`
  )).join("\n");
  return `# Unsupported Answer Repairability Audit

Scope: direct mini + citation repair unsupported answered predictions on ${result.inputs.final_window}.

This audit makes no LLM calls and launches no GPU jobs. It reuses existing \`gpt-4o\` support judgments to identify unsupported direct answers, then inspects the compact evidence pack to estimate whether simple citation repair/reranking appears plausible or whether the answer content itself needs repair/regeneration/abstention.

## Aggregate

| Unsupported answers | Reference answerable | Should abstain | Citation repair candidates | Mixed repair | Answer repair/regeneration |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.aggregate.unsupported_answer_rows} | ${result.aggregate.reference_answerable_rows} | ${result.aggregate.reference_insufficient_rows} | ${result.aggregate.citation_repair_candidate_rows} | ${result.aggregate.mixed_citation_and_answer_repair_rows} | ${result.aggregate.answer_repair_or_regeneration_needed_rows} |

## Buckets

| Bucket | Rows | Share |
| --- | ---: | ---: |
${bucketRows}

## Metrics

| Mean answer/reference F1 | Mean cited-claim overlap | Mean best non-cited gain |
| ---: | ---: | ---: |
| ${pct(result.aggregate.mean_answer_ref_f1)} | ${pct(result.aggregate.mean_cited_claim_overlap)} | ${pct(result.aggregate.mean_best_non_cited_gain)} |

## Examples

| Example | Bucket | Answer/ref F1 | Cited claim overlap | Best non-cited gain | Best hits reference citation | Unsupported claim | Best evidence preview |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
${examples}

## Training Implication

${result.training_implication.recommendation}
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

function numberSupportScore(answer, evidence, question) {
  const answerNumbers = [...new Set(numberTokens(answer).map(normalizeNumber))];
  if (!answerNumbers.length) return 1;
  const evidenceNumbers = new Set(numberTokens(evidence).map(normalizeNumber));
  const questionNumbers = new Set(numberTokens(question).map(normalizeNumber));
  const supported = answerNumbers.filter((number) => evidenceNumbers.has(number) || questionNumbers.has(number)).length;
  return supported / answerNumbers.length;
}

function unsupportedNumberTokens(answer, citedText, question) {
  const answerNumbers = [...new Set(numberTokens(answer).map(normalizeNumber))];
  const citedNumbers = new Set(numberTokens(citedText).map(normalizeNumber));
  const questionNumbers = new Set(numberTokens(question).map(normalizeNumber));
  return answerNumbers.filter((number) => !citedNumbers.has(number) && !questionNumbers.has(number));
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

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function keyed(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
}

function compact(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function escapeCell(value) {
  return compact(value, 240).replaceAll("|", "\\|");
}

function pct(value) {
  return value == null ? "n/a" : `${(Number(value) * 100).toFixed(1)}%`;
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
