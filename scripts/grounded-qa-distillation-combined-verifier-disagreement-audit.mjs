import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const runId = "combined-verifier-disagreement-audit-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const combinedVerifierRunId = "combined-target-text-verifier-audit-0-320-to-321-389-2026-06-28-v1";
const finalPacketRunId = "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const combinedVerifier = await readJson(path.join(runsDir, combinedVerifierRunId, "result.json"));
const predictions = await readJsonl(path.join(runsDir, combinedVerifierRunId, "selected_final_predictions.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
const finalPairById = new Map(finalPairs.map((row) => [row.pair_id, row]));

const rows = predictions.map((prediction) => disagreementRow(prediction, finalPairById.get(prediction.pair_id))).filter(Boolean);
const errorRows = rows.filter((row) => !row.correct);
const correctRows = rows.filter((row) => row.correct);
const strata = buildStrata(rows);
const errorStrata = buildStrata(errorRows);
const correctStrata = buildStrata(correctRows);
const overrepresentedErrorTags = overrepresentedTags(errorRows, correctRows);
const overrepresentedErrorFamilyPairs = overrepresentedField(errorRows, correctRows, "family_pair");
const hardErrorRows = [...errorRows].sort((left, right) =>
  Math.abs(right.margin) - Math.abs(left.margin)
  || right.error_score - left.error_score
  || left.pair_id.localeCompare(right.pair_id)
);
const nearMissRows = [...errorRows].sort((left, right) =>
  Math.abs(left.margin) - Math.abs(right.margin)
  || right.error_score - left.error_score
  || left.pair_id.localeCompare(right.pair_id)
).slice(0, 50);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "combined_verifier_disagreement_audit",
  status: "target_completeness_needs_structural_verifier",
  purpose: "Explain D314 combined-verifier final-window errors before deciding whether to spend on stronger verifier classes or student training.",
  source_runs: {
    combined_target_text_verifier_audit: combinedVerifierRunId,
    final_margin_compatible_heldout_packet: finalPacketRunId,
  },
  d314_context: {
    selected_policy_id: combinedVerifier.selected_by_nonfinal_loo?.policy_id,
    balanced_loo_accuracy: combinedVerifier.selected_by_nonfinal_loo?.nonfinal_leave_one_out?.balanced_accuracy,
    final_pair_accuracy: combinedVerifier.selected_by_nonfinal_loo?.final_pair_transfer?.accuracy,
    final_pair_errors: combinedVerifier.selected_by_nonfinal_loo?.final_pair_transfer?.errors,
  },
  rows: {
    final_pairs: rows.length,
    correct: correctRows.length,
    errors: errorRows.length,
    error_rate: rate(errorRows.length, rows.length),
    near_miss_errors_abs_margin_lt_0_02: errorRows.filter((row) => Math.abs(row.margin) < 0.02).length,
    confident_errors_abs_margin_gte_0_10: errorRows.filter((row) => Math.abs(row.margin) >= 0.10).length,
  },
  strata,
  error_strata: errorStrata,
  correct_strata: correctStrata,
  overrepresented_error_tags: overrepresentedErrorTags.slice(0, 12),
  overrepresented_error_family_pairs: overrepresentedErrorFamilyPairs.slice(0, 12),
  decision: {
    promote_combined_text_verifier_now: false,
    buy_more_same_style_labels_now: false,
    launch_gpu_now: false,
    next_step: "Prototype a structural target-completeness verifier using parsed question requirements, answer slot coverage, and citation-supported slot extraction; do not train a student yet.",
    reason: decisionReason(errorRows, overrepresentedErrorTags, overrepresentedErrorFamilyPairs),
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_error_analysis_only: true,
    final_pair_rows_training_use: "forbidden_final_window_reporting_only",
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "Zero-call disagreement audit over D314 final predictions and frozen final pair metadata.",
  },
  artifacts: {
    disagreement_rows_jsonl: rel(path.join(outputDir, "disagreement_rows.jsonl")),
    error_rows_jsonl: rel(path.join(outputDir, "error_rows.jsonl")),
    near_miss_errors_jsonl: rel(path.join(outputDir, "near_miss_errors.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "disagreement_rows.jsonl"), rows);
await writeJsonl(path.join(outputDir, "error_rows.jsonl"), errorRows);
await writeJsonl(path.join(outputDir, "near_miss_errors.jsonl"), nearMissRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  rows: result.rows,
  overrepresented_error_tags: result.overrepresented_error_tags,
  overrepresented_error_family_pairs: result.overrepresented_error_family_pairs,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function disagreementRow(prediction, pair) {
  if (!pair) return null;
  const chosen = summarizeCandidate(pair.chosen, pair.input.question);
  const rejected = summarizeCandidate(pair.rejected, pair.input.question);
  const delta = deltaFeatures(chosen, rejected);
  const tags = hardTags(pair.input.question, chosen, rejected, delta, pair);
  return {
    pair_id: pair.pair_id,
    example_id: pair.example_id,
    paper_id: pair.input?.document_metadata?.paper_id ?? null,
    source_index: pair.source_index,
    predicted: prediction.predicted,
    expected: prediction.expected,
    correct: Boolean(prediction.correct),
    chosen_score: Number(prediction.chosen_score),
    rejected_score: Number(prediction.rejected_score),
    margin: Number(prediction.margin),
    family_pair: `${chosen.family}->${rejected.family}`,
    contrast_type: pair.contrast_type,
    question_type: questionType(pair.input.question),
    chosen_summary: chosen,
    rejected_summary: rejected,
    feature_delta: delta,
    hard_tags: tags,
    error_score: errorScore(tags, delta, prediction),
    question: pair.input.question,
    chosen_answer_preview: preview(pair.chosen.answer, 220),
    rejected_answer_preview: preview(pair.rejected.answer, 220),
  };
}

function summarizeCandidate(candidate, question) {
  const answer = String(candidate.answer ?? "");
  const claims = candidate.claim_table ?? [];
  const citations = candidate.citations ?? [];
  const unsupported = candidate.unsupported_claims ?? [];
  const questionTokens = unique(contentTokens(question));
  const answerTokens = unique(contentTokens(answer));
  const overlap = answerTokens.filter((token) => questionTokens.includes(token)).length;
  return {
    candidate_id: candidate.id ?? candidate.candidate_id ?? "unknown",
    family: canonicalFamily(candidate.family ?? candidate.prediction_run_id ?? "unknown"),
    answer_type: candidate.answer_type ?? "grounded_answer",
    answer_tokens: contentTokens(answer).length,
    citation_count: citations.length,
    claim_count: claims.length,
    unsupported_claim_count: unsupported.length,
    number_count: numberCount(answer) + claims.reduce((total, claim) => total + numberCount(claim.claim ?? claim), 0),
    entityish_count: entityishCount(answer) + claims.reduce((total, claim) => total + entityishCount(claim.claim ?? claim), 0),
    question_overlap: overlap,
    question_recall: questionTokens.length ? overlap / questionTokens.length : 0,
    empty_answer: isEmptyAnswer(answer),
  };
}

function deltaFeatures(chosen, rejected) {
  return {
    answer_tokens: chosen.answer_tokens - rejected.answer_tokens,
    citation_count: chosen.citation_count - rejected.citation_count,
    claim_count: chosen.claim_count - rejected.claim_count,
    unsupported_claim_count: chosen.unsupported_claim_count - rejected.unsupported_claim_count,
    number_count: chosen.number_count - rejected.number_count,
    entityish_count: chosen.entityish_count - rejected.entityish_count,
    question_overlap: chosen.question_overlap - rejected.question_overlap,
    question_recall: chosen.question_recall - rejected.question_recall,
  };
}

function hardTags(question, chosen, rejected, delta, pair) {
  const tags = [];
  if (questionRequiresNumber(question) || Math.abs(delta.number_count) > 0) tags.push("numeric_target");
  if (questionRequiresList(question) || Math.abs(delta.entityish_count) >= 2) tags.push("list_or_entity_scope");
  if (rejected.unsupported_claim_count > 0) tags.push("unsupported_claim_available");
  if (Math.abs(delta.answer_tokens) <= 4) tags.push("similar_answer_length");
  if (Math.abs(delta.citation_count) <= 1) tags.push("similar_citation_count");
  if (Math.abs(delta.claim_count) <= 1) tags.push("similar_claim_count");
  if (rejected.answer_tokens >= chosen.answer_tokens) tags.push("overexpanded_or_equal_rejected");
  if (chosen.family !== rejected.family) tags.push("cross_family_pair");
  if (String(pair.contrast_type ?? "").includes("minimal") || String(pair.pair_id).includes("minimal")) tags.push("minimal_span_contrast");
  if (delta.question_overlap < 0) tags.push("chosen_lower_question_overlap");
  if (delta.citation_count < 0) tags.push("chosen_fewer_citations");
  if (delta.claim_count < 0) tags.push("chosen_fewer_claims");
  return tags.sort();
}

function questionType(question) {
  const text = String(question ?? "").toLowerCase();
  if (/\bhow many|how much|percentage|percent|number|amount|rate|score|points?|fewer|more\b/.test(text)) return "numeric";
  if (/\bwhich|what models|what methods|what datasets|what types|list|models|methods|datasets|baselines\b/.test(text)) return "list_or_entity";
  if (/\bwhy|reason|motivat/.test(text)) return "explanation";
  if (/\bwhat\b/.test(text)) return "what";
  return "other";
}

function errorScore(tags, delta, prediction) {
  let score = Math.abs(Number(prediction.margin ?? 0)) * 10;
  if (tags.includes("list_or_entity_scope")) score += 3;
  if (tags.includes("numeric_target")) score += 3;
  if (tags.includes("unsupported_claim_available")) score += 2;
  if (tags.includes("overexpanded_or_equal_rejected")) score += 2;
  if (delta.citation_count < 0) score += 1;
  if (delta.claim_count < 0) score += 1;
  return score;
}

function buildStrata(rows) {
  return {
    by_question_type: countBy(rows, "question_type"),
    by_family_pair: topCounts(countBy(rows, "family_pair"), 12),
    by_tags: topCounts(countTags(rows), 14),
    by_margin_bucket: countBy(rows.map((row) => ({ bucket: marginBucket(row.margin) })), "bucket"),
  };
}

function overrepresentedTags(errorRows, correctRows) {
  const errorCounts = countTags(errorRows);
  const correctCounts = countTags(correctRows);
  return Object.keys(errorCounts).map((tag) => {
    const errorRate = rate(errorCounts[tag], errorRows.length);
    const correctRate = rate(correctCounts[tag] ?? 0, correctRows.length);
    return {
      tag,
      error_count: errorCounts[tag],
      correct_count: correctCounts[tag] ?? 0,
      error_rate: errorRate,
      correct_rate: correctRate,
      lift: correctRate ? errorRate / correctRate : null,
    };
  }).sort((left, right) => (right.lift ?? 999) - (left.lift ?? 999) || right.error_count - left.error_count);
}

function overrepresentedField(errorRows, correctRows, field) {
  const errorCounts = countBy(errorRows, field);
  const correctCounts = countBy(correctRows, field);
  return Object.keys(errorCounts).map((key) => {
    const errorRate = rate(errorCounts[key], errorRows.length);
    const correctRate = rate(correctCounts[key] ?? 0, correctRows.length);
    return {
      key,
      error_count: errorCounts[key],
      correct_count: correctCounts[key] ?? 0,
      error_rate: errorRate,
      correct_rate: correctRate,
      lift: correctRate ? errorRate / correctRate : null,
    };
  }).sort((left, right) => (right.lift ?? 999) - (left.lift ?? 999) || right.error_count - left.error_count);
}

function decisionReason(errorRows, tags, familyPairs) {
  const topTag = tags[0]?.tag ?? "unknown";
  const topFamily = familyPairs[0]?.key ?? "unknown";
  const nearMisses = errorRows.filter((row) => Math.abs(row.margin) < 0.02).length;
  return `D314 leaves ${errorRows.length} final errors, with ${nearMisses} near-miss errors and overrepresentation of ${topTag} and ${topFamily}; the failure mode is structural target matching rather than lack of same-style labels.`;
}

function marginBucket(margin) {
  const value = Math.abs(Number(margin));
  if (value < 0.02) return "near_miss_lt_0.02";
  if (value < 0.05) return "low_conf_0.02_0.05";
  if (value < 0.10) return "medium_conf_0.05_0.10";
  return "confident_gte_0.10";
}

function canonicalFamily(value) {
  const family = String(value ?? "unknown");
  if (family.includes("qwen7b")) return "qwen7b";
  if (family.includes("qwen3b")) return "qwen3b";
  if (family.includes("qwen05b")) return "qwen05b";
  if (family.includes("openai") || family.includes("mini") || family.includes("citation-contract")) return "openai_scaffold";
  if (family.includes("reference") || family.includes("qasper")) return "qasper_reference";
  return family || "unknown";
}

function questionRequiresNumber(question) {
  return /\b(how many|how much|percentage|percent|number|amount|rate|score|points?|fewer|more|larger|smaller)\b/i.test(String(question));
}

function questionRequiresList(question) {
  return /\b(which|what models|what methods|what datasets|what types|list|models|methods|datasets|baselines)\b/i.test(String(question));
}

function numberCount(text) {
  return String(text ?? "").match(/\d+(?:\.\d+)?|%|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million)\b/gi)?.length ?? 0;
}

function entityishCount(text) {
  return String(text ?? "").match(/\b[A-Z][A-Za-z0-9\-_/]{2,}\b/g)?.length ?? 0;
}

function contentTokens(text) {
  const stopwords = new Set("the a an and or of to in for with on by is are was were be been being as at from into about this that these those it its they their we our you your can could should would do does did how what which who when where why much many over under between using use used than then have has had include includes included".split(" "));
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").match(/[a-z0-9]+/g)?.filter((token) => token.length > 2 && !stopwords.has(token)) ?? [];
}

function unique(values) {
  return [...new Set(values)];
}

function isEmptyAnswer(text) {
  return /^(\[empty answer\]|empty answer|no_answer)?$/i.test(String(text ?? "").trim());
}

function countBy(rows, field) {
  return rows.reduce((counts, row) => {
    const key = row[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function countTags(rows) {
  const counts = {};
  for (const row of rows) {
    for (const tag of row.hard_tags ?? []) counts[tag] = (counts[tag] ?? 0) + 1;
  }
  return counts;
}

function topCounts(counts, limit) {
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function preview(text, limit) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function renderReport(result) {
  return `# Combined Verifier Disagreement Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no API calls. It explains D314 final-window errors before deciding whether to train a student or spend on stronger verifier classes.

## Errors

- Final pairs: ${result.rows.final_pairs}
- Correct: ${result.rows.correct}
- Errors: ${result.rows.errors}
- Near-miss errors: ${result.rows.near_miss_errors_abs_margin_lt_0_02}
- Confident errors: ${result.rows.confident_errors_abs_margin_gte_0_10}

## Overrepresented Error Tags

${result.overrepresented_error_tags.slice(0, 8).map((row) => `- ${row.tag}: ${row.error_count} errors, lift ${row.lift == null ? "inf" : row.lift.toFixed(2)}`).join("\n")}

## Decision

- Promote combined text verifier now: ${result.decision.promote_combined_text_verifier_now ? "yes" : "no"}
- Buy more same-style labels now: ${result.decision.buy_more_same_style_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function rel(file) {
  return path.relative(rootDir, file);
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}
