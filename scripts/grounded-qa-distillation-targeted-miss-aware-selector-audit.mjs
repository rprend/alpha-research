import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const miningRunId = args["mining-run"] ?? "targeted-miss-contrast-mining-audit-321-389-2026-06-28-v1";
const trainPacketRunId = args["train-packet-run"] ?? "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1";
const timeAwareRunId = args["time-aware-run"] ?? "time-aware-source-prefix-selector-audit-0-320-to-321-389-2026-06-28-v1";
const finalPacketRunId = args["final-packet-run"] ?? "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "targeted-miss-aware-selector-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const mining = await readJson(path.join(runsDir, miningRunId, "result.json"));
const targetRows = await readJsonl(path.join(runsDir, miningRunId, "nonfinal_target_contrasts.jsonl"));
const highPriorityRows = await readJsonl(path.join(runsDir, miningRunId, "high_priority_nonfinal_contrasts.jsonl"));
const trainPairs = await readJsonl(path.join(runsDir, trainPacketRunId, "train_pairwise.jsonl"));
const finalSelections = await readJsonl(path.join(runsDir, timeAwareRunId, "source_prefix_recency_4x_final_selections.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const trainPairsById = new Map(trainPairs.map((row) => [row.pair_id, row]));
const finalCandidateById = buildCandidateMap(finalPairs);
const targetPacket = targetRows.map((row) => packetRow(row, trainPairsById.get(row.pair_id)));
const highPriorityPacket = highPriorityRows.map((row) => packetRow(row, trainPairsById.get(row.pair_id)));

const targetPairwiseDiagnostics = [
  evaluateTargetPairwise("same_citation_shorter_candidate", targetPacket, (chosen, rejected) =>
    sameCitationSet(chosen.citations, rejected.citations) && answerTokens(chosen.answer) <= answerTokens(rejected.answer)
  ),
  evaluateTargetPairwise("same_citation_shorter_by_8", targetPacket, (chosen, rejected) =>
    sameCitationSet(chosen.citations, rejected.citations) && answerTokens(chosen.answer) + 8 <= answerTokens(rejected.answer)
  ),
  evaluateTargetPairwise("same_citation_fewer_or_equal_claims", targetPacket, (chosen, rejected) =>
    sameCitationSet(chosen.citations, rejected.citations) && claimCount(chosen) <= claimCount(rejected)
  ),
  evaluateTargetPairwise("high_priority_shape_guard", highPriorityPacket, (chosen, rejected) =>
    sameCitationSet(chosen.citations, rejected.citations)
      && answerTokens(chosen.answer) + 8 <= answerTokens(rejected.answer)
      && claimCount(chosen) <= claimCount(rejected)
  ),
];

const baselineSelections = evaluateFinalPolicy("source_prefix_recency_4x", finalSelections, finalCandidateById, baselinePolicy);
const conservativeGuardSelections = evaluateFinalPolicy("conservative_same_citation_raw_rescue_0p5", finalSelections, finalCandidateById, conservativeSameCitationRawRescue);
const switchRows = conservativeGuardSelections.selections
  .filter((row) => row.selected_candidate_id !== row.baseline_candidate_id)
  .map((row) => ({
    example_id: row.example_id,
    baseline_candidate_id: row.baseline_candidate_id,
    selected_candidate_id: row.selected_candidate_id,
    baseline_supported_answer: row.baseline_supported_answer,
    selected_supported_answer: row.selected_supported_answer,
    switch_direction: row.selected_supported_answer && !row.baseline_supported_answer
      ? "rescued_miss"
      : !row.selected_supported_answer && row.baseline_supported_answer
        ? "regressed_supported"
        : "neutral_or_still_wrong",
    baseline_features: row.baseline_features,
    selected_features: row.selected_features,
  }));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "targeted_miss_aware_selector_audit",
  status: "targeted_packet_ready_selector_not_promoted",
  purpose: "Build the D293 targeted contrast packet and test whether a preregistered deployable same-citation rescue rule safely improves the time-aware source-prefix selector.",
  source_runs: {
    targeted_miss_mining: miningRunId,
    nonfinal_train_packet: trainPacketRunId,
    time_aware_source_prefix: timeAwareRunId,
    final_packet: finalPacketRunId,
  },
  targeted_packet: {
    train_contrasts: targetPacket.length,
    high_priority_contrasts: highPriorityPacket.length,
    source_window_counts: countBy(targetPacket.map((row) => row.source_inventory_run_id ?? "unknown")),
    from_d293_available_target_contrasts: mining.nonfinal_target_contrast_summary?.available_target_contrasts,
    from_d293_high_priority_contrasts: mining.nonfinal_target_contrast_summary?.same_citation_unsupported_longer_contrasts,
  },
  target_pairwise_diagnostics: Object.fromEntries(targetPairwiseDiagnostics.map((row) => [row.policy, summarizeTargetPairwise(row)])),
  final_policies: {
    [baselineSelections.policy]: summarizeFinalPolicy(baselineSelections),
    [conservativeGuardSelections.policy]: summarizeFinalPolicy(conservativeGuardSelections),
  },
  comparison: {
    baseline_selected_supported: baselineSelections.selected_supported,
    conservative_guard_selected_supported: conservativeGuardSelections.selected_supported,
    conservative_guard_switches: switchRows.length,
    conservative_guard_rescued_misses: switchRows.filter((row) => row.switch_direction === "rescued_miss").length,
    conservative_guard_regressions: switchRows.filter((row) => row.switch_direction === "regressed_supported").length,
    target_packet_pairwise_best_policy: bestPairwise(targetPairwiseDiagnostics).policy,
    target_packet_pairwise_best_correct: bestPairwise(targetPairwiseDiagnostics).correct,
    target_packet_pairwise_best_pairs: bestPairwise(targetPairwiseDiagnostics).pairs,
  },
  decision: {
    promote_miss_aware_selector_now: false,
    use_targeted_packet_for_post_training_now: true,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Use the targeted packet as post-training/eval data, not as a hand-written listwise rule; the next run should train or fit a bounded learner on the packet and test temporal transfer.",
    reason: "The mined contrast packet captures the desired overexpansion behavior, but a deployable hand-written same-citation rescue rule over-applies and regresses previously supported final examples.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_reporting_selection_correctness: true,
    unsupported_claim_labels_used_for_selector_scoring: false,
    target_packet_training_use: "allowed_nonfinal_targeted_post_training_data",
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
    note: "Zero-call packet construction and selector audit over existing judged artifacts.",
  },
};

await writeJsonl(path.join(outputDir, "targeted_train_contrast_packet.jsonl"), targetPacket);
await writeJsonl(path.join(outputDir, "high_priority_targeted_train_contrast_packet.jsonl"), highPriorityPacket);
await writeJsonl(path.join(outputDir, "target_pairwise_predictions.jsonl"), targetPairwiseDiagnostics.flatMap((row) =>
  row.predictions.map((prediction) => ({ policy: row.policy, ...prediction }))
));
await writeJsonl(path.join(outputDir, "source_prefix_recency_4x_final_selections.jsonl"), baselineSelections.selections);
await writeJsonl(path.join(outputDir, "conservative_same_citation_raw_rescue_0p5_final_selections.jsonl"), conservativeGuardSelections.selections);
await writeJsonl(path.join(outputDir, "conservative_guard_switches.jsonl"), switchRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  status: result.status,
  targeted_packet: result.targeted_packet,
  target_pairwise_diagnostics: result.target_pairwise_diagnostics,
  final_policies: result.final_policies,
  comparison: result.comparison,
  decision: result.decision,
}, null, 2));

function packetRow(minedRow, pair) {
  if (!pair) throw new Error(`Missing source pair for ${minedRow.pair_id}`);
  return {
    pair_id: minedRow.pair_id,
    example_id: minedRow.example_id,
    split: pair.split,
    source_index: pair.source_index,
    source_inventory_run_id: minedRow.source_inventory_run_id,
    training_use: "allowed_nonfinal_targeted_post_training_data",
    target_tags: minedRow.tags,
    input: pair.input,
    chosen: pair.chosen,
    rejected: pair.rejected,
    feature_summary: contrastFeatures(pair.chosen, pair.rejected),
  };
}

function evaluateTargetPairwise(policy, rows, prefersChosen) {
  let correct = 0;
  const predictions = [];
  for (const row of rows) {
    const predictedChosen = prefersChosen(row.chosen, row.rejected);
    if (predictedChosen) correct += 1;
    predictions.push({
      pair_id: row.pair_id,
      example_id: row.example_id,
      predicted_chosen: predictedChosen,
      correct: predictedChosen,
      feature_summary: row.feature_summary,
    });
  }
  return {
    policy,
    pairs: rows.length,
    correct,
    accuracy: rate(correct, rows.length),
    predictions,
  };
}

function evaluateFinalPolicy(policy, rows, candidateById, policyFn) {
  const selections = rows.map((row) => {
    const candidates = row.ranked_candidates.map((candidate) => enrichCandidate(candidate, candidateById));
    const baseline = baselinePolicy(candidates);
    const selected = policyFn(candidates);
    return {
      example_id: row.example_id,
      policy,
      baseline_candidate_id: baseline.candidate_id,
      baseline_supported_answer: baseline.supported_answer,
      selected_candidate_id: selected.candidate_id,
      selected_family: selected.family,
      selected_supported_answer: selected.supported_answer,
      candidate_count: candidates.length,
      supported_candidate_count: candidates.filter((candidate) => candidate.supported_answer).length,
      baseline_features: candidateFeatureSummary(baseline),
      selected_features: candidateFeatureSummary(selected),
      ranked_candidates: candidates.map(candidateFeatureSummary),
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
  return {
    policy,
    selections,
    examples: selections.length,
    selected_supported: selections.filter((row) => row.selected_supported_answer).length,
    selected_unsupported: selections.filter((row) => !row.selected_supported_answer).length,
  };
}

function baselinePolicy(candidates) {
  return [...candidates].sort((left, right) =>
    right.reliability_score - left.reliability_score
    || right.raw_broad_selector_score - left.raw_broad_selector_score
    || left.candidate_id.localeCompare(right.candidate_id)
  )[0];
}

function conservativeSameCitationRawRescue(candidates) {
  const baseline = baselinePolicy(candidates);
  const candidatesWithSameCitations = candidates
    .filter((candidate) =>
      candidate.citation_key
      && candidate.citation_key === baseline.citation_key
      && candidate.answer_tokens > 0
      && candidate.raw_broad_selector_score >= baseline.raw_broad_selector_score + 0.5
    )
    .sort((left, right) =>
      right.raw_broad_selector_score - left.raw_broad_selector_score
      || left.answer_tokens - right.answer_tokens
      || left.candidate_id.localeCompare(right.candidate_id)
    );
  return candidatesWithSameCitations[0] ?? baseline;
}

function enrichCandidate(candidate, candidateById) {
  const full = candidateById.get(candidate.candidate_id);
  if (!full) throw new Error(`Missing final candidate details for ${candidate.candidate_id}`);
  return {
    ...candidate,
    ...full,
    candidate_id: candidate.candidate_id,
    reliability_score: Number(candidate.reliability_score),
    raw_broad_selector_score: Number(candidate.score),
    answer_tokens: answerTokens(full.answer),
    claim_count: claimCount(full),
    citation_count: (full.citations ?? []).length,
    citation_key: citationKey(full.citations),
    answer_preview: preview(full.answer),
  };
}

function buildCandidateMap(pairs) {
  const candidateById = new Map();
  for (const pair of pairs) {
    candidateById.set(pair.chosen.id, pair.chosen);
    candidateById.set(pair.rejected.id, pair.rejected);
  }
  return candidateById;
}

function contrastFeatures(chosen, rejected) {
  return {
    same_citation: sameCitationSet(chosen.citations, rejected.citations),
    chosen_tokens: answerTokens(chosen.answer),
    rejected_tokens: answerTokens(rejected.answer),
    token_delta_rejected_minus_chosen: answerTokens(rejected.answer) - answerTokens(chosen.answer),
    chosen_claim_count: claimCount(chosen),
    rejected_claim_count: claimCount(rejected),
    rejected_extra_claims: claimCount(rejected) - claimCount(chosen),
    chosen_citation_count: (chosen.citations ?? []).length,
    rejected_citation_count: (rejected.citations ?? []).length,
  };
}

function candidateFeatureSummary(candidate) {
  return {
    candidate_id: candidate.candidate_id,
    family: candidate.family,
    supported_answer: candidate.supported_answer,
    reliability_score: candidate.reliability_score,
    raw_broad_selector_score: candidate.raw_broad_selector_score,
    answer_tokens: candidate.answer_tokens,
    claim_count: candidate.claim_count,
    citation_count: candidate.citation_count,
    citation_key: candidate.citation_key,
    answer_preview: candidate.answer_preview,
  };
}

function summarizeFinalPolicy(policy) {
  return {
    policy: policy.policy,
    examples: policy.examples,
    selected_supported: policy.selected_supported,
    selected_unsupported: policy.selected_unsupported,
    selection_support_rate: rate(policy.selected_supported, policy.examples),
  };
}

function summarizeTargetPairwise(row) {
  return {
    policy: row.policy,
    pairs: row.pairs,
    correct: row.correct,
    accuracy: row.accuracy,
  };
}

function bestPairwise(rows) {
  return [...rows].sort((left, right) =>
    (right.accuracy ?? 0) - (left.accuracy ?? 0)
    || right.correct - left.correct
    || left.policy.localeCompare(right.policy)
  )[0];
}

function sameCitationSet(left = [], right = []) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size > 0 && leftSet.size === rightSet.size && [...leftSet].every((id) => rightSet.has(id));
}

function citationKey(citations = []) {
  return citations.length ? [...citations].sort().join("|") : "";
}

function answerTokens(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, "").split(/\W+/).filter((token) => token.length > 1).length;
}

function claimCount(candidate) {
  return (candidate?.claim_table ?? []).length;
}

function preview(text, limit = 180) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function rate(num, den) {
  return den ? num / den : null;
}

function renderReport(result) {
  const baseline = result.final_policies.source_prefix_recency_4x;
  const guard = result.final_policies.conservative_same_citation_raw_rescue_0p5;
  return `# Targeted Miss-Aware Selector Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run converts the D293 mined rows into a targeted post-training contrast packet, then tests a preregistered deployable same-citation rescue rule against the final heldout candidate pool.

## Targeted Packet

- Targeted train contrasts: ${result.targeted_packet.train_contrasts}
- High-priority same-citation overexpansion contrasts: ${result.targeted_packet.high_priority_contrasts}
- Best target-pair diagnostic: ${result.comparison.target_packet_pairwise_best_policy} (${result.comparison.target_packet_pairwise_best_correct}/${result.comparison.target_packet_pairwise_best_pairs})

## Final Selector Diagnostic

- Baseline source-prefix selector: ${baseline.selected_supported}/${baseline.examples}
- Conservative same-citation rescue: ${guard.selected_supported}/${guard.examples}
- Switches: ${result.comparison.conservative_guard_switches}
- Rescued misses: ${result.comparison.conservative_guard_rescued_misses}
- Regressions: ${result.comparison.conservative_guard_regressions}

## Decision

- Promote miss-aware selector now: ${result.decision.promote_miss_aware_selector_now ? "yes" : "no"}
- Use targeted packet for post-training now: ${result.decision.use_targeted_packet_for_post_training_now ? "yes" : "no"}
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

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
