import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const runId = "hard-target-label-batch-plan-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const d309RunId = "question-target-label-batch-run-gpt4o-mini-2026-06-28-v1";
const d310RunId = "question-target-selector-transfer-audit-0-320-to-321-389-2026-06-28-v1";
const d311RunId = "question-target-text-verifier-audit-0-320-to-321-389-2026-06-28-v1";
const finalPacketRunId = "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const modelForEstimate = "gpt-4o-mini";
const pricingSourceUrl = "https://developers.openai.com/api/docs/models/gpt-4o-mini";
const inputUsdPerMillionTokens = 0.15;
const outputUsdPerMillionTokens = 0.60;
const expectedOutputTokensPerCall = 520;
const primaryRequestTarget = 96;
const duplicateCalibrationCalls = 12;

const candidateSources = [
  {
    id: "nonfinal_margin_train",
    run_id: "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1",
    file: "train_pairwise.jsonl",
    training_use: "allowed_nonfinal_broad_contrast_training",
  },
  {
    id: "qwen_frontier_train",
    run_id: "qwen-frontier-pool-support-packet-2026-06-28-v1",
    file: "train_contrast_pairs.jsonl",
    training_use: "allowed_nonfinal_frontier_supervision",
  },
  {
    id: "qwen_frontier_validation",
    run_id: "qwen-frontier-pool-support-packet-2026-06-28-v1",
    file: "validation_contrast_pairs.jsonl",
    training_use: "allowed_nonfinal_frontier_supervision",
  },
  {
    id: "minimal_span_train",
    run_id: "minimal-span-overexpansion-packet-qwen-frontier-pool-2026-06-28-v1",
    file: "train_contrast_pairs.jsonl",
    training_use: "allowed_nonfinal_frontier_supervision",
  },
  {
    id: "minimal_span_validation",
    run_id: "minimal-span-overexpansion-packet-qwen-frontier-pool-2026-06-28-v1",
    file: "validation_contrast_pairs.jsonl",
    training_use: "allowed_nonfinal_frontier_supervision",
  },
  {
    id: "support_ranker_train",
    run_id: "support-ranker-pairwise-packet-expanded-2026-06-28-v1",
    file: "train_pairwise.jsonl",
    training_use: "allowed_train",
  },
  {
    id: "support_ranker_validation",
    run_id: "support-ranker-pairwise-packet-expanded-2026-06-28-v1",
    file: "validation_pairwise.jsonl",
    training_use: "allowed_validation",
  },
];

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const d309 = await readJson(path.join(runsDir, d309RunId, "result.json"));
const d310 = await readJson(path.join(runsDir, d310RunId, "result.json"));
const d311 = await readJson(path.join(runsDir, d311RunId, "result.json"));
const d309Requests = await readJsonl(path.join(runsDir, d309RunId, "requests.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
const d311FinalPredictions = await readJsonl(path.join(runsDir, d311RunId, "selected_final_predictions.jsonl"));

const alreadyLabelledPairIds = new Set(d309Requests.map((row) => row.metadata?.pair_id).filter(Boolean));
const finalErrorProfile = buildFinalErrorProfile(finalPairs, d311FinalPredictions);
const candidateRows = [];
for (const source of candidateSources) {
  const rows = await readJsonl(path.join(runsDir, source.run_id, source.file));
  for (const row of rows) {
    const normalized = normalizePair(row, source);
    if (!normalized) continue;
    if (alreadyLabelledPairIds.has(normalized.pair_id)) continue;
    if (Number(normalized.source_index) >= 321) continue;
    if (normalized.leakage_guard.final_window_request) continue;
    normalized.hard_target_score = hardTargetScore(normalized, finalErrorProfile);
    candidateRows.push(normalized);
  }
}

const selectedPrimary = selectDiverseRows(candidateRows, primaryRequestTarget);
const calibrationRows = selectedPrimary.slice(0, duplicateCalibrationCalls);
const requests = [
  ...selectedPrimary.map((row, index) => labelRequest(row, index, false)),
  ...calibrationRows.map((row, index) => labelRequest(row, index, true)),
];
const estimatedCalls = requests.map(estimateCall);
const totalEstimated = summarizeEstimates(estimatedCalls);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "hard_target_label_batch_plan",
  status: selectedPrimary.length >= primaryRequestTarget ? "hard_final_like_batch_ready_below_budget" : "insufficient_hard_final_like_nonfinal_rows",
  purpose: "Plan the next target-completeness label batch after D311 showed the first target labels are useful but too narrow for a reliable verifier.",
  source_runs: {
    d309_question_target_label_batch_run: d309RunId,
    d310_scalar_selector_transfer_audit: d310RunId,
    d311_text_verifier_audit: d311RunId,
    final_margin_compatible_heldout_packet: finalPacketRunId,
  },
  d311_context: {
    selected_text_verifier_balanced_loo_accuracy: d311.selected_by_nonfinal_loo?.nonfinal_leave_one_out?.balanced_accuracy,
    selected_text_verifier_final_pair_accuracy: d311.selected_by_nonfinal_loo?.final_pair_transfer?.accuracy,
    scalar_selected_final_pair_accuracy: d310.selected_by_nonfinal_labels?.final?.accuracy,
    reason_for_next_batch: "D309 target-completeness labels are stable but too narrow; D310 scalar rules anti-transfer; D311 local text verifier transfers somewhat but is not internally reliable.",
  },
  final_error_profile: finalErrorProfile.summary,
  candidate_pool: {
    sources: candidateSources.map(({ id, run_id, file }) => ({ id, run_id, file })),
    rows_considered: candidateRows.length,
    rows_after_dedup_and_leakage_guard: candidateRows.length,
    already_labelled_d309_pair_ids: alreadyLabelledPairIds.size,
    selected_primary_rows: selectedPrimary.length,
    selected_by_source: countBy(selectedPrimary, "source_id"),
    selected_by_family_pair: countBy(selectedPrimary, "family_pair"),
    selected_by_hard_tags: countTags(selectedPrimary),
  },
  batch_plan: {
    primary_label_requests: selectedPrimary.length,
    duplicate_calibration_requests: calibrationRows.length,
    total_label_requests: requests.length,
    selection_policy: "Select leakage-safe non-final pairs that resemble D311 final-error strata by family pair, candidate length/citation/claim/number deltas, unsupported-claim availability, and question-target numeric/list/entity risk; cap repeated roots and sources for diversity.",
    label_schema: {
      chosen_question_target_complete: "boolean",
      rejected_question_target_complete: "boolean",
      rejected_failure_mode: ["complete_supported", "entailed_but_incomplete", "entailed_but_wrong_target", "unsupported_claim", "citation_mismatch", "other"],
      preferred_for_grounded_answer: ["chosen", "rejected", "tie", "abstain"],
      rationale: "short string",
    },
  },
  cost_estimate: {
    model: modelForEstimate,
    pricing_source_url: pricingSourceUrl,
    input_usd_per_million_tokens: inputUsdPerMillionTokens,
    output_usd_per_million_tokens: outputUsdPerMillionTokens,
    expected_output_tokens_per_call: expectedOutputTokensPerCall,
    estimated_input_tokens: totalEstimated.input_tokens,
    estimated_output_tokens: totalEstimated.output_tokens,
    estimated_cost_usd: totalEstimated.cost_usd,
    estimated_cost_with_2x_safety_usd: totalEstimated.cost_usd * 2,
    would_keep_total_under_100_usd: budget.spend_usd.total_actual + totalEstimated.cost_usd * 2 < budget.max_budget_usd,
  },
  decision: {
    run_label_batch_now: false,
    ask_for_secret_now: false,
    launch_gpu_now: false,
    next_step: "Run this harder final-like label batch only if the plan validates; then retrain the local target verifier before considering Prime/GPU.",
    reason: `The plan finds ${selectedPrimary.length} leakage-safe hard non-final rows matching D311 final-error strata at an estimated $${totalEstimated.cost_usd.toFixed(4)} before safety margin.`,
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_rows_used_for_selection_profile_only: true,
    request_rows_nonfinal_only: requests.every((row) => Number(row.metadata.source_index) < 321),
    request_rows_exclude_d309_labelled_pair_ids: requests.every((row) => !alreadyLabelledPairIds.has(row.metadata.pair_id)),
    duplicate_calibration_rows_training_use: "calibration_only_until_agreement_checked",
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    planned_openai_cost_usd: totalEstimated.cost_usd,
    planned_openai_cost_with_2x_safety_usd: totalEstimated.cost_usd * 2,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "Planning artifact only. No API calls were made and no compute was launched.",
  },
};

await writeJsonl(path.join(outputDir, "candidate_hard_rows.jsonl"), candidateRows.sort((a, b) => b.hard_target_score - a.hard_target_score));
await writeJsonl(path.join(outputDir, "selected_hard_rows.jsonl"), selectedPrimary);
await writeJsonl(path.join(outputDir, "candidate_label_requests.jsonl"), requests);
await writeJsonl(path.join(outputDir, "estimated_calls.jsonl"), estimatedCalls);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  candidate_pool: result.candidate_pool,
  batch_plan: result.batch_plan,
  cost_estimate: result.cost_estimate,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function normalizePair(row, source) {
  const chosen = row.chosen;
  const rejected = row.rejected;
  const input = row.input;
  if (!row.pair_id || !chosen || !rejected || !input?.question || !Array.isArray(input.compact_retrieved_evidence_pack)) return null;
  const sourceIndex = Number(row.source_index ?? windowIndex(row.window) ?? -1);
  const chosenSummary = summarizeCandidate(chosen, input.question);
  const rejectedSummary = summarizeCandidate(rejected, input.question);
  const featureDelta = deltaFeatures(chosenSummary, rejectedSummary);
  const tags = hardTags(input.question, chosenSummary, rejectedSummary, featureDelta, row);
  const familyPair = `${chosenSummary.family}->${rejectedSummary.family}`;
  return {
    pair_id: row.pair_id,
    root_example_id: row.root_example_id ?? row.example_id,
    example_id: row.example_id ?? row.root_example_id,
    source_id: source.id,
    source_run_id: source.run_id,
    source_file: source.file,
    source_index: sourceIndex,
    split: row.split ?? row.train_split ?? "unknown",
    train_split: row.train_split ?? row.split ?? (source.id.includes("validation") ? "validation" : "train"),
    contrast_type: row.contrast_type ?? source.id,
    training_use: row.training_use ?? source.training_use,
    family_pair: familyPair,
    input,
    chosen,
    rejected,
    chosen_summary: chosenSummary,
    rejected_summary: rejectedSummary,
    feature_delta: featureDelta,
    hard_tags: tags,
    leakage_guard: {
      final_window_request: sourceIndex >= 321,
      d309_already_labelled: alreadyLabelledPairIds.has(row.pair_id),
      allowed_training_use: String(row.training_use ?? source.training_use).includes("allowed"),
    },
  };
}

function summarizeCandidate(candidate, question) {
  const answer = String(candidate.answer ?? "");
  const claims = candidate.claim_table ?? [];
  const citations = candidate.citations ?? [];
  const unsupported = candidate.unsupported_claims ?? candidate.judgment?.unsupported_claims ?? [];
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

function hardTags(question, chosen, rejected, delta, row) {
  const tags = [];
  if (questionRequiresNumber(question) || Math.abs(delta.number_count) > 0) tags.push("numeric_target");
  if (questionRequiresList(question) || Math.abs(delta.entityish_count) >= 2) tags.push("list_or_entity_scope");
  if (rejected.unsupported_claim_count > 0) tags.push("unsupported_claim_available");
  if (Math.abs(delta.answer_tokens) <= 4) tags.push("similar_answer_length");
  if (Math.abs(delta.citation_count) <= 1) tags.push("similar_citation_count");
  if (Math.abs(delta.claim_count) <= 1) tags.push("similar_claim_count");
  if (rejected.answer_tokens >= chosen.answer_tokens) tags.push("overexpanded_or_equal_rejected");
  if (chosen.family !== rejected.family) tags.push("cross_family_pair");
  if (String(row.contrast_type ?? "").includes("minimal") || String(row.pair_id).includes("minimal")) tags.push("minimal_span_contrast");
  return tags.sort();
}

function buildFinalErrorProfile(finalPairs, predictions) {
  const finalByPair = new Map(finalPairs.map((row) => [row.pair_id, row]));
  const errors = predictions.filter((row) => row.correct === false).map((prediction) => {
    const pair = finalByPair.get(prediction.pair_id);
    if (!pair) return null;
    const chosen = summarizeCandidate(pair.chosen, pair.input.question);
    const rejected = summarizeCandidate(pair.rejected, pair.input.question);
    const delta = deltaFeatures(chosen, rejected);
    return {
      pair_id: pair.pair_id,
      family_pair: `${chosen.family}->${rejected.family}`,
      delta_bins: deltaBins(delta),
      hard_tags: hardTags(pair.input.question, chosen, rejected, delta, pair),
      margin: Number(prediction.margin ?? 0),
    };
  }).filter(Boolean);
  const familyPairCounts = countBy(errors, "family_pair");
  const tagCounts = countTags(errors);
  const deltaBinCounts = countBy(errors.map((row) => ({ delta_key: row.delta_bins.join("|") })), "delta_key");
  return {
    errors,
    familyPairCounts,
    tagCounts,
    deltaBinCounts,
    summary: {
      final_pairs: finalPairs.length,
      d311_errors: errors.length,
      top_family_pairs: topCounts(familyPairCounts, 12),
      top_hard_tags: topCounts(tagCounts, 12),
      top_delta_bins: topCounts(deltaBinCounts, 12),
    },
  };
}

function hardTargetScore(row, profile) {
  const bins = deltaBins(row.feature_delta);
  let score = 0;
  score += Math.min(40, 5 * (profile.familyPairCounts[row.family_pair] ?? 0));
  for (const tag of row.hard_tags) score += Math.min(10, profile.tagCounts[tag] ?? 0) / 2;
  score += Math.min(20, profile.deltaBinCounts[bins.join("|")] ?? 0);
  if (row.rejected_summary.unsupported_claim_count > 0) score += 12;
  if (row.hard_tags.includes("numeric_target")) score += 8;
  if (row.hard_tags.includes("list_or_entity_scope")) score += 8;
  if (row.hard_tags.includes("minimal_span_contrast")) score += 6;
  if (row.hard_tags.includes("similar_answer_length") && row.hard_tags.includes("similar_citation_count")) score += 6;
  if (row.train_split === "validation") score += 2;
  return score;
}

function selectDiverseRows(rows, target) {
  const sorted = [...rows].sort((left, right) =>
    right.hard_target_score - left.hard_target_score
    || left.source_index - right.source_index
    || left.pair_id.localeCompare(right.pair_id)
  );
  const selected = [];
  const rootCounts = new Map();
  const sourceCounts = new Map();
  const familyCounts = new Map();
  for (const row of sorted) {
    if (selected.length >= target) break;
    if ((rootCounts.get(row.root_example_id) ?? 0) >= 2) continue;
    if ((sourceCounts.get(row.source_id) ?? 0) >= 28) continue;
    if ((familyCounts.get(row.family_pair) ?? 0) >= 32) continue;
    selected.push(row);
    rootCounts.set(row.root_example_id, (rootCounts.get(row.root_example_id) ?? 0) + 1);
    sourceCounts.set(row.source_id, (sourceCounts.get(row.source_id) ?? 0) + 1);
    familyCounts.set(row.family_pair, (familyCounts.get(row.family_pair) ?? 0) + 1);
  }
  return selected;
}

function labelRequest(row, index, duplicate) {
  const requestId = duplicate
    ? `hard-qt-calibration-${String(index + 1).padStart(3, "0")}`
    : `hard-qt-primary-${String(index + 1).padStart(3, "0")}`;
  return {
    request_id: requestId,
    model: modelForEstimate,
    task: "question_target_completeness_judgment",
    metadata: {
      pair_id: row.pair_id,
      root_example_id: row.root_example_id,
      source_index: row.source_index,
      source_id: row.source_id,
      train_split: row.train_split,
      contrast_type: row.contrast_type,
      family_pair: row.family_pair,
      duplicate_calibration: duplicate,
      hard_target_score: row.hard_target_score,
      hard_tags: row.hard_tags,
      training_use: duplicate ? "calibration_only_until_agreement_checked" : "planned_nonfinal_hard_question_target_label",
    },
    input: {
      instruction: [
        "Judge whether each candidate answers the exact question target using only the evidence pack.",
        "These are hard final-like cases. Do not reward citation presence, answer length, or entailment of isolated claims if the answer misses the asked quantity, entity/list, comparison, condition, or scope.",
        "Return JSON only with the requested schema.",
      ].join(" "),
      question: row.input.question,
      evidence_pack: compactEvidence(row.input.compact_retrieved_evidence_pack),
      candidate_chosen: candidatePayload(row.chosen, row.chosen_summary),
      candidate_rejected: candidatePayload(row.rejected, row.rejected_summary),
      output_schema: {
        chosen_question_target_complete: "boolean",
        rejected_question_target_complete: "boolean",
        rejected_failure_mode: "complete_supported | entailed_but_incomplete | entailed_but_wrong_target | unsupported_claim | citation_mismatch | other",
        preferred_for_grounded_answer: "chosen | rejected | tie | abstain",
        rationale: "one short sentence",
      },
    },
  };
}

function candidatePayload(candidate, summary) {
  const answer = String(candidate.answer ?? "").trim();
  return {
    answer: answer || "[empty answer]",
    answer_type: candidate.answer_type ?? null,
    abstention_reason: candidate.abstention_reason ?? null,
    family: summary.family,
    citations: candidate.citations ?? [],
    claim_table: candidate.claim_table ?? [],
    unsupported_claims: candidate.unsupported_claims ?? candidate.judgment?.unsupported_claims ?? [],
    summary,
  };
}

function compactEvidence(pack) {
  return pack.slice(0, 6).map((evidence) => ({
    evidence_id: evidence.evidence_id,
    section: evidence.section,
    text: preview(evidence.text, 950),
  }));
}

function estimateCall(request) {
  const serialized = JSON.stringify(request.input);
  const inputTokens = Math.ceil(serialized.length / 4);
  const outputTokens = expectedOutputTokensPerCall;
  const costUsd = (inputTokens / 1_000_000) * inputUsdPerMillionTokens
    + (outputTokens / 1_000_000) * outputUsdPerMillionTokens;
  return {
    request_id: request.request_id,
    model: request.model,
    estimated_input_tokens: inputTokens,
    estimated_output_tokens: outputTokens,
    estimated_cost_usd: costUsd,
  };
}

function summarizeEstimates(rows) {
  return {
    input_tokens: rows.reduce((sum, row) => sum + row.estimated_input_tokens, 0),
    output_tokens: rows.reduce((sum, row) => sum + row.estimated_output_tokens, 0),
    cost_usd: rows.reduce((sum, row) => sum + row.estimated_cost_usd, 0),
  };
}

function deltaBins(delta) {
  return [
    `answer:${bin(delta.answer_tokens, [-20, -8, -2, 2, 8, 20])}`,
    `citation:${bin(delta.citation_count, [-2, -1, 0, 1, 2])}`,
    `claim:${bin(delta.claim_count, [-3, -1, 0, 1, 3])}`,
    `number:${bin(delta.number_count, [-3, -1, 0, 1, 3])}`,
    `entity:${bin(delta.entityish_count, [-5, -2, 0, 2, 5])}`,
  ];
}

function bin(value, cuts) {
  for (const cut of cuts) {
    if (value <= cut) return `<=${cut}`;
  }
  return `>${cuts.at(-1)}`;
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

function windowIndex(windowName) {
  const match = String(windowName ?? "").match(/(\d+)-\d+/);
  return match ? Number(match[1]) : null;
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
  return `# Hard Target Label Batch Plan

Generated: ${result.generated_at}

Status: \`${result.status}\`

This is a planning artifact only. It makes no API calls and launches no compute.

## Why

D309 labels were stable, D310 scalar selectors anti-transferred, and D311 local text verification improved final pair transfer but failed leave-one-out reliability. This plan targets harder non-final rows that better resemble D311 final errors.

## Batch

- Primary requests: ${result.batch_plan.primary_label_requests}
- Calibration duplicate requests: ${result.batch_plan.duplicate_calibration_requests}
- Total requests: ${result.batch_plan.total_label_requests}
- Candidate rows considered: ${result.candidate_pool.rows_considered}
- Selected by source: ${JSON.stringify(result.candidate_pool.selected_by_source)}
- Selected tags: ${JSON.stringify(result.candidate_pool.selected_by_hard_tags)}

## Cost

- Model: ${result.cost_estimate.model}
- Estimated cost: $${result.cost_estimate.estimated_cost_usd.toFixed(4)}
- Estimated cost with 2x safety: $${result.cost_estimate.estimated_cost_with_2x_safety_usd.toFixed(4)}
- Keeps total under $100: ${result.cost_estimate.would_keep_total_under_100_usd ? "yes" : "no"}

## Decision

- Run label batch now: ${result.decision.run_label_batch_now ? "yes" : "no"}
- Ask for secret now: ${result.decision.ask_for_secret_now ? "yes" : "no"}
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
