import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "multicitation-target-audit-2026-06-29-v1";
const packetRunId = args["packet-run-id"] ?? "nonreview-oracle-contrast-packet-2026-06-29-v1";
const split = args.split ?? "sft_validation";
const predictionRunIds = (args["prediction-runs"] ?? [
  "openai-multicitation-composition-probe-2026-06-29-v1",
  "openai-multicitation-citation-set-probe-2026-06-29-v1",
].join(",")).split(",").map((value) => value.trim()).filter(Boolean);
const outputDir = path.join(runsDir, runId);
const packetDir = path.join(runsDir, packetRunId, "dataset");
const stopwords = new Set([
  "the", "and", "for", "that", "with", "from", "this", "what", "when", "where", "which", "how",
  "are", "was", "were", "has", "have", "had", "does", "did", "its", "into", "than", "then",
  "they", "their", "them", "our", "your", "you", "about", "after", "before", "over", "under",
  "between", "through", "using", "used", "use", "can", "not", "paper", "model", "models",
  "method", "methods", "task", "data", "dataset", "result", "results", "evidence", "authors",
  "author", "study", "approach", "system", "systems", "based", "also", "include", "includes",
]);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const rows = await readJsonl(path.join(packetDir, `${split}.jsonl`));
const targetRows = rows
  .map((row) => ({ ...row, target: normalizePrediction(parseMaybeJson(row.target)) }))
  .filter((row) => row.target.answer_type === "grounded_answer" && normalizeCitations(row.target.citations).length > 1);
const predictionRuns = await Promise.all(predictionRunIds.map(readPredictionRun));
const auditRows = targetRows.map((row) => auditRow(row, predictionRuns));
const predictionSummaries = summarizePredictionRuns(auditRows, predictionRunIds);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "multicitation_target_audit",
  status: statusFor(auditRows, predictionSummaries),
  purpose: "Audit whether D437 multi-citation oracle targets require complete coverage or contain redundant/weak citations that make exact citation-set scoring unstable.",
  packet_run_id: packetRunId,
  split,
  source_runs: {
    packet: packetRunId,
    prediction_runs: predictionRunIds,
  },
  method: {
    type: "local_heuristic_target_citation_role_audit",
    no_llm_calls: true,
    no_gpu_calls: true,
    unique_required_rule: "A target citation is uniquely required if it is the best or uniquely numeric support for at least one target-answer sentence with nontrivial lexical overlap.",
    relaxed_prediction_rule: "A prediction is relaxed-coverage-correct if it has the right answer type and includes every target citation marked uniquely required; strict exactness is still reported separately.",
  },
  target_metrics: summarizeTargets(auditRows),
  prediction_summaries: predictionSummaries,
  decision: decisionFor(auditRows, predictionSummaries),
  budget: {
    max_budget_usd: Number(budget.max_budget_usd),
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual),
    remaining_budget_usd: Number(budget.spend_usd?.remaining),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "This audit is local over existing artifacts.",
  },
  artifacts: {
    audit_rows_jsonl: rel(path.join(outputDir, "audit_rows.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "audit_rows.jsonl"), auditRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  target_metrics: result.target_metrics,
  prediction_summaries: result.prediction_summaries,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

async function readPredictionRun(predictionRunId) {
  const predictions = await readJsonl(path.join(runsDir, predictionRunId, "predictions.jsonl"));
  return {
    prediction_run_id: predictionRunId,
    predictions_by_id: new Map(predictions.map((row) => [row.example_id, row])),
  };
}

function auditRow(row, predictionRuns) {
  const evidence = row.input.compact_retrieved_evidence_pack ?? [];
  const evidenceById = new Map(evidence.map((item) => [String(item.evidence_id), item]));
  const targetCitations = normalizeCitations(row.target.citations);
  const targetSentences = splitSentences(row.target.answer);
  const sentenceAudits = targetSentences.map((sentence, sentenceIndex) => auditSentence(sentence, sentenceIndex, targetCitations, evidenceById));
  const citationRoles = targetCitations.map((citation) => auditCitationRole(citation, sentenceAudits, evidenceById.get(citation)));
  const uniqueRequiredCitations = citationRoles.filter((role) => role.role === "unique_required").map((role) => role.evidence_id);
  const weakOrRedundantCitations = citationRoles.filter((role) => role.role !== "unique_required").map((role) => role.evidence_id);
  const predictionAudits = Object.fromEntries(predictionRuns.map((predictionRun) => {
    const predictionRow = predictionRun.predictions_by_id.get(row.example_id);
    return [predictionRun.prediction_run_id, auditPrediction(predictionRow, row.target, uniqueRequiredCitations, weakOrRedundantCitations)];
  }));
  return {
    example_id: row.example_id,
    question: row.input.question,
    target_answer: row.target.answer,
    target_citations: targetCitations,
    target_citation_count: targetCitations.length,
    target_sentence_count: targetSentences.length,
    unique_required_citations: uniqueRequiredCitations,
    weak_or_redundant_target_citations: weakOrRedundantCitations,
    target_role_family: targetRoleFamily(targetCitations, uniqueRequiredCitations),
    sentence_audits: sentenceAudits,
    citation_roles: citationRoles,
    prediction_audits: predictionAudits,
  };
}

function auditSentence(sentence, sentenceIndex, targetCitations, evidenceById) {
  const sentenceTokens = contentTokens(sentence);
  const sentenceNumbers = numbers(sentence);
  const supports = targetCitations.map((citation) => {
    const evidence = evidenceById.get(citation);
    const evidenceTokens = new Set(contentTokens(evidence?.text ?? ""));
    const evidenceNumbers = new Set(numbers(evidence?.text ?? ""));
    const tokenOverlap = sentenceTokens.filter((token) => evidenceTokens.has(token));
    const numberOverlap = sentenceNumbers.filter((number) => evidenceNumbers.has(number));
    const tokenRecall = rate(unique(tokenOverlap).length, unique(sentenceTokens).length);
    const numericRecall = rate(unique(numberOverlap).length, unique(sentenceNumbers).length);
    return {
      evidence_id: citation,
      token_recall: round(tokenRecall, 4),
      numeric_recall: round(numericRecall, 4),
      support_score: round(tokenRecall + numericRecall * 0.7, 4),
      overlapping_tokens: unique(tokenOverlap).slice(0, 20),
      overlapping_numbers: unique(numberOverlap),
    };
  }).sort((left, right) => right.support_score - left.support_score || String(left.evidence_id).localeCompare(String(right.evidence_id)));
  const best = supports[0];
  const second = supports[1];
  return {
    sentence_index: sentenceIndex,
    sentence,
    content_token_count: unique(sentenceTokens).length,
    numeric_count: unique(sentenceNumbers).length,
    best_evidence_id: best?.evidence_id ?? null,
    best_support_score: best?.support_score ?? 0,
    best_margin: round((best?.support_score ?? 0) - (second?.support_score ?? 0), 4),
    supports,
  };
}

function auditCitationRole(citation, sentenceAudits, evidence) {
  const uniqueSentences = sentenceAudits.filter((sentence) => {
    if (sentence.best_evidence_id !== citation) return false;
    const best = sentence.supports.find((support) => support.evidence_id === citation);
    return (best?.support_score ?? 0) >= 0.18 && sentence.best_margin >= 0.04;
  });
  const uniqueNumericSentences = sentenceAudits.filter((sentence) => {
    if (!sentence.numeric_count) return false;
    const support = sentence.supports.find((item) => item.evidence_id === citation);
    const otherNumeric = sentence.supports.some((item) => item.evidence_id !== citation && item.numeric_recall >= (support?.numeric_recall ?? 0));
    return (support?.numeric_recall ?? 0) > 0 && !otherNumeric;
  });
  const bestScore = Math.max(...sentenceAudits.flatMap((sentence) => sentence.supports.filter((support) => support.evidence_id === citation).map((support) => support.support_score)), 0);
  const role = uniqueSentences.length || uniqueNumericSentences.length ? "unique_required" : bestScore >= 0.18 ? "redundant_or_shared" : "weak_link";
  return {
    evidence_id: citation,
    role,
    section: evidence?.section ?? null,
    best_support_score: round(bestScore, 4),
    unique_sentence_indices: unique([...uniqueSentences, ...uniqueNumericSentences].map((sentence) => sentence.sentence_index)),
    text_preview: String(evidence?.text ?? "").slice(0, 220),
  };
}

function auditPrediction(predictionRow, target, uniqueRequiredCitations, weakOrRedundantCitations) {
  const prediction = normalizePrediction(predictionRow?.prediction ?? parseMaybeJson(predictionRow?.raw_content));
  const targetCitations = normalizeCitations(target.citations);
  const predictedCitations = normalizeCitations(prediction.citations);
  const missingTargetCitations = targetCitations.filter((citation) => !predictedCitations.includes(citation));
  const missingUniqueRequired = uniqueRequiredCitations.filter((citation) => !predictedCitations.includes(citation));
  const omittedOnlyWeakOrRedundant = missingTargetCitations.length > 0 && missingTargetCitations.every((citation) => weakOrRedundantCitations.includes(citation));
  const extraCitations = predictedCitations.filter((citation) => !targetCitations.includes(citation));
  return {
    present: Boolean(predictionRow),
    answer_type: prediction.answer_type,
    answer_type_correct: prediction.answer_type === target.answer_type,
    predicted_citations: predictedCitations,
    strict_citation_exact: setEqual(new Set(predictedCitations), new Set(targetCitations)),
    relaxed_unique_required_covered: missingUniqueRequired.length === 0,
    relaxed_coverage_correct: prediction.answer_type === target.answer_type && missingUniqueRequired.length === 0,
    omitted_only_weak_or_redundant: omittedOnlyWeakOrRedundant,
    missing_target_citations: missingTargetCitations,
    missing_unique_required_citations: missingUniqueRequired,
    extra_citations: extraCitations,
    predicted_is_strict_subset: predictedCitations.length > 0 && predictedCitations.every((citation) => targetCitations.includes(citation)) && predictedCitations.length < targetCitations.length,
  };
}

function summarizeTargets(rows) {
  return {
    examples: rows.length,
    target_citation_count_distribution: countBy(rows.map((row) => row.target_citation_count)),
    target_role_families: countBy(rows.map((row) => row.target_role_family)),
    all_target_citations_unique_required: count(rows, (row) => row.target_role_family === "all_unique_required"),
    has_weak_or_redundant_target_citation: count(rows, (row) => row.weak_or_redundant_target_citations.length > 0),
    mean_target_citations: mean(rows.map((row) => row.target_citation_count)),
    mean_unique_required_citations: mean(rows.map((row) => row.unique_required_citations.length)),
    mean_weak_or_redundant_citations: mean(rows.map((row) => row.weak_or_redundant_target_citations.length)),
  };
}

function summarizePredictionRuns(rows, predictionRunIds) {
  return predictionRunIds.map((predictionRunId) => {
    const audits = rows.map((row) => row.prediction_audits[predictionRunId]).filter(Boolean);
    return {
      prediction_run_id: predictionRunId,
      examples: audits.length,
      answer_type_correct: count(audits, (row) => row.answer_type_correct),
      strict_citation_exact: count(audits, (row) => row.strict_citation_exact),
      relaxed_unique_required_covered: count(audits, (row) => row.relaxed_unique_required_covered),
      relaxed_coverage_correct: count(audits, (row) => row.relaxed_coverage_correct),
      omitted_only_weak_or_redundant: count(audits, (row) => row.omitted_only_weak_or_redundant),
      strict_subset_predictions: count(audits, (row) => row.predicted_is_strict_subset),
      mean_missing_unique_required: mean(audits.map((row) => row.missing_unique_required_citations.length)),
      mean_missing_target_citations: mean(audits.map((row) => row.missing_target_citations.length)),
    };
  });
}

function statusFor(rows, predictionSummaries) {
  const targetMetrics = summarizeTargets(rows);
  const bestRelaxed = Math.max(...predictionSummaries.map((row) => row.relaxed_coverage_correct), 0);
  if (targetMetrics.has_weak_or_redundant_target_citation >= Math.ceil(rows.length / 2) && bestRelaxed > targetMetrics.examples / 2) return "strict_metric_overpenalizes_coverage_subsets";
  if (targetMetrics.has_weak_or_redundant_target_citation >= Math.ceil(rows.length / 2)) return "targets_need_review_but_predictions_still_miss_required_support";
  return "multi_citation_targets_look_required";
}

function decisionFor(rows, predictionSummaries) {
  const targetMetrics = summarizeTargets(rows);
  const best = predictionSummaries.reduce((winner, row) => row.relaxed_coverage_correct > winner.relaxed_coverage_correct ? row : winner, predictionSummaries[0]);
  const targetReviewNeeded = targetMetrics.has_weak_or_redundant_target_citation >= Math.ceil(rows.length / 2);
  return {
    revise_primary_metric_now: targetReviewNeeded,
    train_on_current_exact_multicitation_targets_now: false,
    buy_more_openai_labels_now: false,
    rent_prime_gpu_now: false,
    reason: best
      ? `${targetMetrics.has_weak_or_redundant_target_citation}/${targetMetrics.examples} multi-citation targets contain at least one weak/redundant citation by local audit; best relaxed coverage is ${best.relaxed_coverage_correct}/${best.examples} for ${best.prediction_run_id}, versus strict exact ${best.strict_citation_exact}/${best.examples}.`
      : "No prediction summaries were available.",
    next_step: targetReviewNeeded
      ? "Build a coverage-calibrated target overlay for train/validation rows and report strict exact citation set separately from uniquely-required-support coverage."
      : "Keep exact citation-set scoring as the primary target and focus on stronger evidence selection.",
  };
}

function targetRoleFamily(targetCitations, uniqueRequiredCitations) {
  if (uniqueRequiredCitations.length === targetCitations.length) return "all_unique_required";
  if (uniqueRequiredCitations.length === 0) return "no_unique_required_detected";
  return "mixed_unique_and_redundant";
}

function renderReport(result) {
  const summaryRows = result.prediction_summaries.map((summary) => `| \`${summary.prediction_run_id}\` | ${summary.strict_citation_exact}/${summary.examples} | ${summary.relaxed_coverage_correct}/${summary.examples} | ${summary.relaxed_unique_required_covered}/${summary.examples} | ${summary.omitted_only_weak_or_redundant} | ${summary.strict_subset_predictions} |`).join("\n");
  return `# Multi-Citation Target Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This local audit checks whether the D437 multi-citation targets require every exact oracle citation or whether some target citations look redundant or weakly linked to the target answer. It makes no API calls and launches no compute.

## Target Roles

- Examples: ${result.target_metrics.examples}
- Target citation distribution: ${JSON.stringify(result.target_metrics.target_citation_count_distribution)}
- Role families: ${JSON.stringify(result.target_metrics.target_role_families)}
- Rows with weak/redundant target citation: ${result.target_metrics.has_weak_or_redundant_target_citation}/${result.target_metrics.examples}
- Mean target citations: ${result.target_metrics.mean_target_citations.toFixed(2)}
- Mean uniquely required citations: ${result.target_metrics.mean_unique_required_citations.toFixed(2)}
- Mean weak/redundant citations: ${result.target_metrics.mean_weak_or_redundant_citations.toFixed(2)}

## Existing Probe Predictions

| Prediction run | Strict exact | Relaxed coverage correct | Unique required covered | Omitted only weak/redundant | Strict subset predictions |
| --- | ---: | ---: | ---: | ---: | ---: |
${summaryRows}

## Decision

- Revise primary metric now: ${result.decision.revise_primary_metric_now ? "yes" : "no"}
- Train on current exact multi-citation targets now: ${result.decision.train_on_current_exact_multicitation_targets_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function normalizePrediction(value) {
  const parsed = typeof value === "string" ? parseMaybeJson(value) : value;
  const answerType = parsed?.answer_type === "abstain" ? "abstain" : "grounded_answer";
  return {
    answer_type: answerType,
    answer: answerType === "grounded_answer" ? String(parsed?.answer ?? "") : "",
    citations: answerType === "grounded_answer" ? normalizeCitations(parsed?.citations) : [],
    evidence_first: parsed?.evidence_first ?? {},
    claim_table: Array.isArray(parsed?.claim_table) ? parsed.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(parsed?.abstention_reason ?? "") : null,
  };
}

function splitSentences(text) {
  const normalized = String(text ?? "").replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const sentences = normalized.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((sentence) => sentence.trim()).filter(Boolean);
  return sentences.length ? sentences : [normalized];
}

function contentTokens(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .match(/[a-z0-9][a-z0-9_-]*/g)?.filter((token) => token.length > 2 && !stopwords.has(token)) ?? [];
}

function numbers(text) {
  return String(text ?? "").toLowerCase().match(/\b\d+(?:[.,]\d+)?%?|\b\d+k\b/g)?.map((value) => value.replace(/,/g, "")) ?? [];
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : [])
    .map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation).replace(/^\[|\]$/g, ""))
    .filter(Boolean);
}

function parseMaybeJson(value) {
  if (!value || typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {}
    }
  }
  return {};
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function unique(values) {
  return [...new Set(values)];
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function mean(values) {
  return values.length ? values.reduce((total, value) => total + Number(value || 0), 0) / values.length : 0;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function round(value, digits = 10) {
  return Number(Number(value || 0).toFixed(digits));
}

function rel(file) {
  return path.relative(rootDir, file);
}
