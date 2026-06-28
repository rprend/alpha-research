import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const runId = "question-focus-guard-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const trainPacketRunId = "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1";
const lowPriorPacketRunId = "low-prior-rescue-packet-audit-0-320-to-321-389-2026-06-28-v1";
const coveragePostmortemRunId = "entailment-coverage-guard-postmortem-audit-0-320-to-321-389-2026-06-28-v1";
const trainNliRunId = "nonfinal-margin-compatible-train-nli-0-320-2026-06-28-v1";
const timeAwareRunId = "time-aware-source-prefix-selector-audit-0-320-to-321-389-2026-06-28-v1";
const finalPacketRunId = "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const finalNliRunId = "final-margin-compatible-heldout-nli-321-389-2026-06-28-v1";

const chronologicalWindows = [
  "nonfinal-contrast-source-inventory-0-80-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-80-160-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-160-240-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-240-320-2026-06-28-v1",
];
const entailmentDeltas = [0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7];
const entailmentFloors = [0, 0.05, 0.1, 0.2, 0.5, 0.8];
const stopwords = new Set("the a an and or of to in for with on by is are was were be been being as at from into about this that these those it its they their we our you your can could should would do does did how what which who when where why much many over under between using use used than then have has had include includes included".split(" "));
const numberWords = new Set("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty hundred".split(" "));
const guardSpecs = [
  { id: "none", description: "No question-focus guard.", fn: () => true },
  { id: "question_overlap_non_decreasing", description: "Alternate answer must preserve count of content question tokens found in the answer.", fn: ({ delta }) => delta.question_overlap >= 0 },
  { id: "question_recall_non_decreasing", description: "Alternate answer must preserve question-token recall.", fn: ({ delta }) => delta.question_recall >= 0 },
  { id: "question_overlap_and_claim_citation_non_decreasing", description: "Alternate answer must preserve question overlap, claim count, and citation count.", fn: ({ delta }) => delta.question_overlap >= 0 && delta.claim_count >= 0 && delta.citation_count >= 0 },
  { id: "question_overlap_and_answer_length_non_decreasing", description: "Alternate answer must preserve question overlap and answer length.", fn: ({ delta }) => delta.question_overlap >= 0 && delta.answer_tokens >= 0 },
  { id: "number_requirement_preserved", description: "If the question asks for a number or amount, the alternate answer must contain a number.", fn: ({ alternate, baseline }) => !baseline.question_requires_number || alternate.answer_has_number },
  { id: "question_overlap_and_number_requirement_preserved", description: "Preserve question overlap and any number requirement.", fn: ({ alternate, baseline, delta }) => delta.question_overlap >= 0 && (!baseline.question_requires_number || alternate.answer_has_number) },
  { id: "strict_focus_bundle", description: "Preserve question overlap, claim count, citation count, and any number requirement.", fn: ({ alternate, baseline, delta }) => delta.question_overlap >= 0 && delta.claim_count >= 0 && delta.citation_count >= 0 && (!baseline.question_requires_number || alternate.answer_has_number) },
];

await fs.mkdir(outputDir, { recursive: true });

const trainPairs = await readJsonl(path.join(runsDir, trainPacketRunId, "train_pairwise.jsonl"));
const lowPriorPacket = await readJson(path.join(runsDir, lowPriorPacketRunId, "result.json"));
const lowPriorRows = await readJsonl(path.join(runsDir, lowPriorPacketRunId, "low_prior_rescue_rows.jsonl"));
const coveragePostmortem = await readJson(path.join(runsDir, coveragePostmortemRunId, "result.json"));
const trainNliByCandidate = aggregateNliByCandidate(await readJsonl(path.join(runsDir, trainNliRunId, "claim-nli-scores.jsonl")));
const finalSelections = await readJsonl(path.join(runsDir, timeAwareRunId, "source_prefix_recency_4x_final_selections.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
const finalNliByCandidate = aggregateNliByCandidate(await readJsonl(path.join(runsDir, finalNliRunId, "claim-nli-scores.jsonl")));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const nonfinalRows = buildTemporalRows(trainPairs, trainNliByCandidate);
const nonfinalGrid = evaluateGrid(nonfinalRows);
const baselineNonfinal = nonfinalGrid.find((row) => row.guard_id === "no_override");
const eligible = nonfinalGrid.filter((row) =>
  row.guard_id !== "no_override"
  && row.regressions === 0
  && row.latest_window_regressions === 0
  && row.latest_window_accuracy >= baselineNonfinal.latest_window_accuracy
  && row.latest_low_prior_correct > baselineNonfinal.latest_low_prior_correct
);
const selectedPolicy = eligible.length
  ? [...eligible].sort((left, right) =>
    left.entailment_delta_threshold - right.entailment_delta_threshold
    || left.entailment_floor - right.entailment_floor
    || left.switches - right.switches
    || left.guard_id.localeCompare(right.guard_id)
  )[0]
  : baselineNonfinal;

const finalCandidateById = buildCandidateMap(finalPairs);
const finalInputByExample = buildInputByExample(finalPairs);
const finalRows = buildFinalRows(finalSelections, finalCandidateById, finalInputByExample, finalNliByCandidate);
const finalGrid = evaluateGrid(finalRows, { finalMode: true });
const selectedFinal = matchingPolicy(finalGrid, selectedPolicy);
const baselineFinal = finalGrid.find((row) => row.guard_id === "no_override");
const bestQuestionFocusFinal = finalGrid.filter((row) => row.guard_id !== "no_override").sort((left, right) =>
  right.selected_supported - left.selected_supported
  || left.regressions - right.regressions
  || right.rescued_misses - left.rescued_misses
  || left.switches - right.switches
  || left.guard_id.localeCompare(right.guard_id)
)[0];
const bestOverlapFinal = finalGrid.find((row) =>
  row.guard_id === "question_overlap_and_claim_citation_non_decreasing"
  && row.entailment_delta_threshold === 0.5
  && row.entailment_floor === 0.8
);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "question_focus_guard_audit",
  status: "question_focus_guards_not_promotable",
  purpose: "Test cheap lexical question-focus features for preventing entailed-but-off-target answer regressions after D304 coverage guards failed.",
  source_runs: {
    nonfinal_train_packet: trainPacketRunId,
    low_prior_rescue_packet: lowPriorPacketRunId,
    entailment_coverage_guard_postmortem: coveragePostmortemRunId,
    nonfinal_nli: trainNliRunId,
    time_aware_source_prefix: timeAwareRunId,
    final_packet: finalPacketRunId,
    final_nli: finalNliRunId,
  },
  d304_context: {
    best_deployable_final_supported: coveragePostmortem.comparison?.best_deployable_final_supported,
    best_deployable_final_rescued_misses: coveragePostmortem.comparison?.best_deployable_final_rescued_misses,
    best_deployable_final_regressions: coveragePostmortem.comparison?.best_deployable_final_regressions,
  },
  low_prior_packet_summary: {
    rescue_rows: lowPriorPacket.packet_summary?.rescue_rows,
    latest_window_rescue_rows: lowPriorPacket.temporal_transfer?.low_prior_rescue_by_window?.[chronologicalWindows[3]],
    qwen_rejected_rows: lowPriorPacket.packet_summary?.qwen_rejected_rows,
  },
  nonfinal_selection: {
    guard_count: guardSpecs.length,
    threshold_rows: nonfinalGrid.length,
    eligible_zero_regression_rescue_policies: eligible.length,
    selected_guard_id: selectedPolicy.guard_id,
    selected_entailment_delta_threshold: selectedPolicy.entailment_delta_threshold,
    selected_entailment_floor: selectedPolicy.entailment_floor,
    selection_rule: "Select a question-focus entailment override only if it improves latest-window low-prior correctness, preserves latest-window accuracy, and creates zero regressions over all non-final chronological pair rows; otherwise keep no-override.",
  },
  final_policies: {
    source_prefix_recency_4x: summarizePolicy(baselineFinal),
    selected_question_focus_guard: summarizePolicy(selectedFinal),
    diagnostic_best_question_focus_guard: summarizePolicy(bestQuestionFocusFinal),
    diagnostic_overlap_and_coverage_guard: summarizePolicy(bestOverlapFinal),
  },
  comparison: {
    selected_final_supported: selectedFinal.selected_supported,
    selected_final_switches: selectedFinal.switches,
    selected_final_rescued_misses: selectedFinal.rescued_misses,
    selected_final_regressions: selectedFinal.regressions,
    best_question_focus_final_supported: bestQuestionFocusFinal.selected_supported,
    best_question_focus_final_rescued_misses: bestQuestionFocusFinal.rescued_misses,
    best_question_focus_final_regressions: bestQuestionFocusFinal.regressions,
    overlap_and_coverage_final_supported: bestOverlapFinal.selected_supported,
    overlap_and_coverage_final_rescued_misses: bestOverlapFinal.rescued_misses,
    overlap_and_coverage_final_regressions: bestOverlapFinal.regressions,
  },
  decision: {
    promote_question_focus_guard_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Move to a richer verifier target: mine or label examples for question-target completeness rather than relying on lexical overlap, scalar entailment, or simple coverage guards.",
    reason: `Question-focus guards produce ${eligible.length} eligible non-final zero-regression rescue policies, but the selected policy anti-transfers to ${selectedFinal.selected_supported}/${selectedFinal.examples} final support with ${selectedFinal.regressions} regressions; final-only best policies do not improve over the ${baselineFinal.selected_supported}/${baselineFinal.examples} source-prefix baseline.`,
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_guard_selection: false,
    final_window_labels_used_for_reporting_selection_correctness: true,
    nonfinal_low_prior_rows_training_use: "allowed_nonfinal_guard_selection",
    final_policy_training_use: "forbidden_final_window_reporting_only",
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
    note: "Zero-call lexical guard audit over existing candidate, selector, and NLI artifacts.",
  },
};

await writeJsonl(path.join(outputDir, "nonfinal_question_focus_grid.jsonl"), nonfinalGrid.map(({ rows, ...row }) => row));
await writeJsonl(path.join(outputDir, "final_question_focus_grid.jsonl"), finalGrid.map(({ rows, ...row }) => row));
await writeJsonl(path.join(outputDir, "best_question_focus_final_switches.jsonl"), bestQuestionFocusFinal.rows.filter((row) => row.override).map(switchRow));
await writeJsonl(path.join(outputDir, "selected_final_switches.jsonl"), selectedFinal.rows.filter((row) => row.override).map(switchRow));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  nonfinal_selection: result.nonfinal_selection,
  final_policies: result.final_policies,
  comparison: result.comparison,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function buildTemporalRows(pairs, nliByCandidate) {
  const lowPriorPairIds = new Set(lowPriorRows.map((row) => row.pair_id));
  const rows = [];
  for (let index = 1; index < chronologicalWindows.length; index += 1) {
    const trainWindows = chronologicalWindows.slice(0, index);
    const testWindow = chronologicalWindows[index];
    const train = pairs.filter((row) => trainWindows.includes(row.source_inventory_run_id));
    const test = pairs.filter((row) => row.source_inventory_run_id === testWindow);
    const prefixPriors = buildPriors(train, sourcePrefixKey);
    const familyPriors = buildPriors(train, (candidate) => candidate.family ?? "unknown");
    rows.push(...test.map((pair) => {
      const chosenPrior = combinedPrior(pair.chosen, prefixPriors, familyPriors);
      const rejectedPrior = combinedPrior(pair.rejected, prefixPriors, familyPriors);
      return {
        example_id: pair.example_id,
        pair_id: pair.pair_id,
        test_window: testWindow,
        chosen: candidateFor(pair.chosen.id, pair.chosen, pair.input, chosenPrior, true, "chosen", nliByCandidate),
        rejected: candidateFor(pair.rejected.id, pair.rejected, pair.input, rejectedPrior, false, "rejected", nliByCandidate),
        is_low_prior_rescue_row: lowPriorPairIds.has(pair.pair_id),
      };
    }));
  }
  return rows;
}

function buildFinalRows(rows, candidateById, inputByExample, nliByCandidate) {
  return rows.map((row) => {
    const input = inputByExample.get(row.example_id);
    const candidates = row.ranked_candidates.map((candidate) => {
      const full = candidateById.get(candidate.candidate_id);
      if (!full) throw new Error(`Missing candidate ${candidate.candidate_id}`);
      return candidateFor(candidate.candidate_id, { ...full, family: candidate.family }, input, Number(candidate.reliability_score), Boolean(candidate.supported_answer), "final_candidate", nliByCandidate, Number(candidate.raw_broad_selector_score ?? candidate.score ?? 0));
    });
    return {
      example_id: row.example_id,
      test_window: "final-321-389",
      baseline: baselinePolicy(candidates),
      candidates,
      is_low_prior_rescue_row: false,
    };
  });
}

function evaluateGrid(rows, { finalMode = false } = {}) {
  const grid = [];
  for (const guard of guardSpecs) {
    for (const delta of entailmentDeltas) {
      for (const floor of entailmentFloors) {
        grid.push(evaluatePolicy({ rows, guard, delta, floor, finalMode }));
      }
    }
  }
  grid.push(evaluatePolicy({ rows, guard: { id: "no_override", description: "No override baseline.", fn: () => false }, delta: 999, floor: 999, finalMode }));
  return grid;
}

function evaluatePolicy({ rows, guard, delta, floor, finalMode }) {
  const predictions = rows.map((row) => {
    const baseline = finalMode ? row.baseline : (row.chosen.reliability_score >= row.rejected.reliability_score ? row.chosen : row.rejected);
    const alternates = finalMode ? row.candidates.filter((candidate) => candidate.candidate_id !== baseline.candidate_id) : [baseline.role === "chosen" ? row.rejected : row.chosen];
    const eligible = alternates.filter((alternate) => {
      const featureDelta = deltaFeatures(alternate, baseline);
      return alternate.nli_entailment_min >= floor
        && alternate.nli_entailment_min - baseline.nli_entailment_min >= delta
        && guard.fn({ alternate, baseline, delta: featureDelta });
    });
    const selected = eligible.length
      ? [...eligible].sort((left, right) =>
        right.nli_entailment_min - left.nli_entailment_min
        || right.reliability_score - left.reliability_score
        || right.raw_broad_selector_score - left.raw_broad_selector_score
        || left.candidate_id.localeCompare(right.candidate_id)
      )[0]
      : baseline;
    return {
      example_id: row.example_id,
      test_window: row.test_window,
      guard_id: guard.id,
      baseline_candidate_id: baseline.candidate_id,
      selected_candidate_id: selected.candidate_id,
      baseline_supported_answer: baseline.supported_answer,
      selected_supported_answer: selected.supported_answer,
      baseline_correct: finalMode ? baseline.supported_answer : baseline.role === "chosen",
      correct: finalMode ? selected.supported_answer : selected.role === "chosen",
      override: selected.candidate_id !== baseline.candidate_id,
      is_low_prior_rescue_row: row.is_low_prior_rescue_row,
      baseline_features: candidateSummary(baseline),
      selected_features: candidateSummary(selected),
      delta_features: deltaFeatures(selected, baseline),
    };
  });
  const latest = predictions.filter((row) => row.test_window === chronologicalWindows[3]);
  const latestLowPrior = latest.filter((row) => row.is_low_prior_rescue_row);
  return {
    guard_id: guard.id,
    guard_description: guard.description,
    entailment_delta_threshold: delta,
    entailment_floor: floor,
    examples: predictions.length,
    correct: predictions.filter((row) => row.correct).length,
    accuracy: rate(predictions.filter((row) => row.correct).length, predictions.length),
    selected_supported: finalMode ? predictions.filter((row) => row.selected_supported_answer).length : undefined,
    switches: predictions.filter((row) => row.override).length,
    rescued_misses: predictions.filter((row) => row.override && row.correct && !row.baseline_correct).length,
    regressions: predictions.filter((row) => row.override && !row.correct && row.baseline_correct).length,
    neutral_switches: predictions.filter((row) => row.override && row.correct === row.baseline_correct).length,
    latest_window_accuracy: latest.length ? rate(latest.filter((row) => row.correct).length, latest.length) : undefined,
    latest_window_regressions: latest.length ? latest.filter((row) => row.override && !row.correct && row.baseline_correct).length : undefined,
    latest_low_prior_correct: latestLowPrior.length ? latestLowPrior.filter((row) => row.correct).length : undefined,
    rows: predictions,
  };
}

function candidateFor(candidateId, candidate, input, reliabilityScore, supportedAnswer, role, nliByCandidate, rawScore = 0) {
  const answer = candidate.answer ?? "";
  const question = input?.question ?? "";
  const questionTokens = unique(contentTokens(question));
  const answerTokens = unique(contentTokens(answer));
  const overlap = questionTokens.filter((token) => answerTokens.includes(token)).length;
  const features = candidateFeatures(candidateId, nliByCandidate);
  return {
    candidate_id: candidateId,
    role,
    family: candidate.family,
    supported_answer: supportedAnswer,
    reliability_score: reliabilityScore,
    raw_broad_selector_score: rawScore,
    answer_tokens: contentTokens(answer).length,
    claim_count: (candidate.claim_table ?? []).length,
    citation_count: (candidate.citations ?? []).length,
    question_overlap: overlap,
    question_recall: questionTokens.length ? overlap / questionTokens.length : 0,
    question_requires_number: /\b(how many|how much|number|amount|by how much)\b/i.test(question),
    answer_has_number: /\d/.test(answer) || answerTokens.some((token) => numberWords.has(token)),
    answer_preview: preview(answer),
    ...features,
  };
}

function candidateFeatures(candidateId, nliByCandidate) {
  const nli = nliByCandidate.get(candidateId) ?? { entailment: [], contradiction: [], margin: [] };
  return {
    nli_margin_min: nli.margin.length ? Math.min(...nli.margin) : 0,
    nli_entailment_min: nli.entailment.length ? Math.min(...nli.entailment) : 0,
    nli_contradiction_max: nli.contradiction.length ? Math.max(...nli.contradiction) : 0,
  };
}

function matchingPolicy(grid, policy) {
  return grid.find((row) =>
    row.guard_id === policy.guard_id
    && row.entailment_delta_threshold === policy.entailment_delta_threshold
    && row.entailment_floor === policy.entailment_floor
  );
}

function summarizePolicy(row) {
  return {
    guard_id: row.guard_id,
    entailment_delta_threshold: row.entailment_delta_threshold,
    entailment_floor: row.entailment_floor,
    examples: row.examples,
    selected_supported: row.selected_supported,
    support_rate: rate(row.selected_supported, row.examples),
    switches: row.switches,
    rescued_misses: row.rescued_misses,
    regressions: row.regressions,
    neutral_switches: row.neutral_switches,
  };
}

function switchRow(row) {
  return {
    example_id: row.example_id,
    switch_direction: row.selected_supported_answer && !row.baseline_supported_answer
      ? "rescued_miss"
      : !row.selected_supported_answer && row.baseline_supported_answer
        ? "regressed_supported"
        : "neutral_or_still_wrong",
    baseline_candidate_id: row.baseline_candidate_id,
    selected_candidate_id: row.selected_candidate_id,
    baseline_features: row.baseline_features,
    selected_features: row.selected_features,
    delta_features: row.delta_features,
  };
}

function deltaFeatures(selected, baseline) {
  return {
    reliability_score: selected.reliability_score - baseline.reliability_score,
    raw_broad_selector_score: selected.raw_broad_selector_score - baseline.raw_broad_selector_score,
    nli_entailment_min: selected.nli_entailment_min - baseline.nli_entailment_min,
    nli_margin_min: selected.nli_margin_min - baseline.nli_margin_min,
    nli_contradiction_max: selected.nli_contradiction_max - baseline.nli_contradiction_max,
    claim_count: selected.claim_count - baseline.claim_count,
    citation_count: selected.citation_count - baseline.citation_count,
    answer_tokens: selected.answer_tokens - baseline.answer_tokens,
    question_overlap: selected.question_overlap - baseline.question_overlap,
    question_recall: selected.question_recall - baseline.question_recall,
  };
}

function candidateSummary(candidate) {
  return {
    candidate_id: candidate.candidate_id,
    family: candidate.family,
    supported_answer: candidate.supported_answer,
    reliability_score: candidate.reliability_score,
    raw_broad_selector_score: candidate.raw_broad_selector_score,
    nli_entailment_min: candidate.nli_entailment_min,
    claim_count: candidate.claim_count,
    citation_count: candidate.citation_count,
    answer_tokens: candidate.answer_tokens,
    question_overlap: candidate.question_overlap,
    question_recall: candidate.question_recall,
    question_requires_number: candidate.question_requires_number,
    answer_has_number: candidate.answer_has_number,
    answer_preview: candidate.answer_preview,
  };
}

function baselinePolicy(candidates) {
  return [...candidates].sort((left, right) =>
    right.reliability_score - left.reliability_score
    || right.raw_broad_selector_score - left.raw_broad_selector_score
    || left.candidate_id.localeCompare(right.candidate_id)
  )[0];
}

function buildPriors(pairs, keyFn) {
  const stats = {};
  for (const pair of pairs) {
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const key = keyFn(candidate);
      stats[key] ??= { total: 0, chosen: 0, rejected: 0 };
      stats[key].total += 1;
      stats[key][role] += 1;
    }
  }
  return Object.fromEntries(Object.entries(stats).map(([key, row]) => [key, { smoothed_supported_rate: (row.chosen + 1) / (row.total + 2) }]));
}

function combinedPrior(candidate, prefixPriors, familyPriors) {
  const prefixPrior = priorFor(sourcePrefixKey(candidate), prefixPriors);
  return prefixPrior === 0.5 ? priorFor(candidate.family ?? "unknown", familyPriors) : prefixPrior;
}

function sourcePrefixKey(candidate) {
  const runId = (candidate.prediction_run_id || candidate.id.split("::")[1] || "unknown")
    .replace(/-extended-future-holdout-.*/, "-extended-future-holdout")
    .replace(/-smoke-eval.*/, "-smoke-eval")
    .replace(/-321-389.*/, "-future-window")
    .replace(/-240-320.*/, "-future-window")
    .replace(/-160-240.*/, "-future-window")
    .replace(/-80-160.*/, "-future-window")
    .replace(/-0-80.*/, "-future-window");
  return `${candidate.family ?? "unknown"}:${runId}`;
}

function priorFor(key, priors) {
  return priors[key]?.smoothed_supported_rate ?? 0.5;
}

function buildCandidateMap(pairs) {
  const candidateById = new Map();
  for (const pair of pairs) {
    candidateById.set(pair.chosen.id, pair.chosen);
    candidateById.set(pair.rejected.id, pair.rejected);
  }
  return candidateById;
}

function buildInputByExample(pairs) {
  const inputByExample = new Map();
  for (const pair of pairs) inputByExample.set(pair.example_id, pair.input);
  return inputByExample;
}

function aggregateNliByCandidate(rows) {
  const byCandidate = new Map();
  for (const row of rows) {
    const aggregate = byCandidate.get(row.candidate_id) ?? { entailment: [], contradiction: [], margin: [] };
    aggregate.entailment.push(Number(row.nli?.entailment ?? 0));
    aggregate.contradiction.push(Number(row.nli?.contradiction ?? 0));
    aggregate.margin.push(Number(row.nli?.margin ?? 0));
    byCandidate.set(row.candidate_id, aggregate);
  }
  return byCandidate;
}

function contentTokens(text) {
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").match(/[a-z0-9]+/g)?.filter((token) => token.length > 2 && !stopwords.has(token)) ?? [];
}

function unique(values) {
  return [...new Set(values)];
}

function preview(text, limit = 180) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function rate(num, den) {
  return den ? num / den : null;
}

function renderReport(result) {
  return `# Question Focus Guard Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit tests lexical question-focus guards after D304 showed simple coverage guards were not enough.

## Non-Final Selection

- Guard count: ${result.nonfinal_selection.guard_count}
- Threshold rows: ${result.nonfinal_selection.threshold_rows}
- Eligible zero-regression rescue policies: ${result.nonfinal_selection.eligible_zero_regression_rescue_policies}
- Selected guard: ${result.nonfinal_selection.selected_guard_id}

## Final Reporting

- Baseline source-prefix selector: ${result.final_policies.source_prefix_recency_4x.selected_supported}/${result.final_policies.source_prefix_recency_4x.examples}
- Selected question-focus guard: ${result.final_policies.selected_question_focus_guard.selected_supported}/${result.final_policies.selected_question_focus_guard.examples}
- Best question-focus diagnostic: ${result.final_policies.diagnostic_best_question_focus_guard.selected_supported}/${result.final_policies.diagnostic_best_question_focus_guard.examples}
- Overlap and coverage diagnostic: ${result.final_policies.diagnostic_overlap_and_coverage_guard.selected_supported}/${result.final_policies.diagnostic_overlap_and_coverage_guard.examples}

## Decision

- Promote question-focus guard now: ${result.decision.promote_question_focus_guard_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
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
