import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const trainPacketRunId = args["train-packet-run"] ?? "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1";
const finalMissRunId = args["final-miss-run"] ?? "final-miss-repairability-audit-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "low-prior-rescue-packet-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const chronologicalWindows = [
  "nonfinal-contrast-source-inventory-0-80-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-80-160-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-160-240-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-240-320-2026-06-28-v1",
];

await fs.mkdir(outputDir, { recursive: true });

const trainPairs = await readJsonl(path.join(runsDir, trainPacketRunId, "train_pairwise.jsonl"));
const finalMiss = await readJson(path.join(runsDir, finalMissRunId, "result.json"));
const finalMissRows = await readJsonl(path.join(runsDir, finalMissRunId, "miss_rows.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const temporalRows = [];
const rescueRows = [];
for (let index = 1; index < chronologicalWindows.length; index += 1) {
  const trainWindows = chronologicalWindows.slice(0, index);
  const testWindow = chronologicalWindows[index];
  const train = trainPairs.filter((row) => trainWindows.includes(row.source_inventory_run_id));
  const test = trainPairs.filter((row) => row.source_inventory_run_id === testWindow);
  const prefixPriors = buildPriors(train, sourcePrefixKey);
  const familyPriors = buildPriors(train, (candidate) => candidate.family ?? "unknown");
  const evaluated = test.map((pair) => evaluatePair(pair, prefixPriors, familyPriors, trainWindows, testWindow));
  const lowPriorRows = evaluated.filter((row) => row.baseline_source_prior_would_choose_rejected);
  temporalRows.push({
    split_id: `low_prior_rescue:${trainWindows.join("+")}=>${testWindow}`,
    train_windows: trainWindows,
    test_window: testWindow,
    train_pairs: train.length,
    pairs: test.length,
    source_prior_correct: evaluated.filter((row) => row.source_prior_correct).length,
    low_prior_rescue_rows: lowPriorRows.length,
    low_prior_rescue_rate: rate(lowPriorRows.length, test.length),
    accuracy: rate(evaluated.filter((row) => row.source_prior_correct).length, test.length),
  });
  rescueRows.push(...lowPriorRows);
}

const finalAnalogRows = finalMissRows.map((row) => ({
  example_id: row.example_id,
  selected_candidate_id: row.selected_candidate_id,
  selected_family: row.selected_family,
  best_supported_candidate_id: row.best_supported_candidate?.candidate_id ?? null,
  best_supported_family: row.best_supported_candidate?.family ?? null,
  supported_candidate_rank_by_selector: row.best_supported_rank_by_selector,
  selected_reliability_minus_best_supported: row.selector_penalty_to_best_supported?.selected_reliability_minus_best_supported ?? null,
  selected_raw_score_minus_best_supported: row.selector_penalty_to_best_supported?.selected_raw_score_minus_best_supported ?? null,
  supported_qwen_candidate_available: row.supported_qwen_candidate_available,
  supported_openai_candidate_available: row.supported_openai_candidate_available,
  selected_answer_tokens: row.selected_candidate?.answer_tokens ?? null,
  best_supported_answer_tokens: row.best_supported_candidate?.answer_tokens ?? null,
  selected_unsupported_claims: row.selected_unsupported_claims ?? [],
  tags: finalAnalogTags(row),
}));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "low_prior_rescue_packet_audit",
  status: rescueRows.length >= 10 ? "low_prior_rescue_packet_available_sparse" : "low_prior_rescue_packet_too_sparse",
  purpose: "Mine leakage-safe non-final analogs for D299 final misses where a supported candidate exists but a source-prior selector would choose an unsupported candidate.",
  source_runs: {
    nonfinal_train_packet: trainPacketRunId,
    final_miss_repairability: finalMissRunId,
  },
  temporal_transfer: {
    rows: temporalRows,
    evaluated_pairs: temporalRows.reduce((sum, row) => sum + row.pairs, 0),
    source_prior_correct: temporalRows.reduce((sum, row) => sum + row.source_prior_correct, 0),
    source_prior_accuracy: rate(temporalRows.reduce((sum, row) => sum + row.source_prior_correct, 0), temporalRows.reduce((sum, row) => sum + row.pairs, 0)),
    low_prior_rescue_rows: rescueRows.length,
    low_prior_rescue_by_window: countBy(rescueRows.map((row) => row.source_inventory_run_id)),
  },
  packet_summary: {
    rescue_rows: rescueRows.length,
    examples: new Set(rescueRows.map((row) => row.example_id)).size,
    same_citation_rows: rescueRows.filter((row) => row.tags.includes("same_citation")).length,
    unsupported_longer_rows: rescueRows.filter((row) => row.tags.includes("unsupported_longer")).length,
    unsupported_claim_rows: rescueRows.filter((row) => row.tags.includes("unsupported_claims_available")).length,
    concise_supported_rows: rescueRows.filter((row) => row.tags.includes("concise_supported")).length,
    qwen_rejected_rows: rescueRows.filter((row) => row.rejected_family?.startsWith("qwen")).length,
    chosen_family_counts: countBy(rescueRows.map((row) => row.chosen_family)),
    rejected_family_counts: countBy(rescueRows.map((row) => row.rejected_family)),
  },
  final_analogy: {
    final_misses: finalMiss.summary?.baseline_unsupported,
    final_misses_with_supported_candidate: finalMiss.summary?.misses_with_supported_candidate,
    final_misses_with_qwen_supported_candidate: finalMiss.summary?.misses_with_qwen_supported_candidate,
    final_best_supported_rank_histogram: finalMiss.summary?.supported_candidate_rank_histogram_for_misses,
    analog_rows: finalAnalogRows.length,
    analog_tag_counts: countTags(finalAnalogRows.flatMap((row) => row.tags)),
  },
  decision: {
    build_low_prior_rescue_selector_next: rescueRows.length >= 10,
    promote_selector_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: rescueRows.length >= 10
      ? "Train or audit a low-prior rescue selector on these non-final rows with preservation/regression controls before touching final labels again."
      : "Mine additional non-final candidate-pool rows before training a low-prior rescue selector.",
    reason: rescueRows.length >= 10
      ? "There is a leakage-safe non-final packet for the D299 failure mode, but it is sparse and must be used as a guarded selector diagnostic rather than a promoted policy."
      : "The non-final packet does not yet contain enough low-prior rescue rows to support a selector experiment.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_analogy: true,
    low_prior_rescue_rows_training_use: "allowed_nonfinal_low_prior_rescue_training",
    final_analogy_rows_training_use: "forbidden_final_window_diagnostic_only",
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
    note: "Zero-call local packet audit over existing non-final judged contrasts and final diagnostic rows.",
  },
};

await writeJsonl(path.join(outputDir, "low_prior_rescue_rows.jsonl"), rescueRows);
await writeJsonl(path.join(outputDir, "temporal_transfer_rows.jsonl"), temporalRows);
await writeJsonl(path.join(outputDir, "final_analog_rows.jsonl"), finalAnalogRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  temporal_transfer: result.temporal_transfer,
  packet_summary: result.packet_summary,
  final_analogy: result.final_analogy,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function evaluatePair(pair, prefixPriors, familyPriors, trainWindows, testWindow) {
  const chosenPrefixPrior = priorFor(sourcePrefixKey(pair.chosen), prefixPriors);
  const rejectedPrefixPrior = priorFor(sourcePrefixKey(pair.rejected), prefixPriors);
  const chosenFamilyPrior = priorFor(pair.chosen.family ?? "unknown", familyPriors);
  const rejectedFamilyPrior = priorFor(pair.rejected.family ?? "unknown", familyPriors);
  const chosenPrior = chosenPrefixPrior === 0.5 ? chosenFamilyPrior : chosenPrefixPrior;
  const rejectedPrior = rejectedPrefixPrior === 0.5 ? rejectedFamilyPrior : rejectedPrefixPrior;
  const sourcePriorCorrect = chosenPrior >= rejectedPrior;
  const features = contrastFeatures(pair.chosen, pair.rejected);
  return {
    pair_id: pair.pair_id,
    example_id: pair.example_id,
    source_inventory_run_id: pair.source_inventory_run_id,
    train_windows: trainWindows,
    test_window: testWindow,
    chosen_id: pair.chosen.id,
    rejected_id: pair.rejected.id,
    chosen_family: pair.chosen.family,
    rejected_family: pair.rejected.family,
    chosen_source_prefix_key: sourcePrefixKey(pair.chosen),
    rejected_source_prefix_key: sourcePrefixKey(pair.rejected),
    chosen_prior: chosenPrior,
    rejected_prior: rejectedPrior,
    source_prior_correct: sourcePriorCorrect,
    baseline_source_prior_would_choose_rejected: !sourcePriorCorrect,
    prior_gap_rejected_minus_chosen: rejectedPrior - chosenPrior,
    training_use: "allowed_nonfinal_low_prior_rescue_training",
    chosen_answer_preview: preview(pair.chosen.answer),
    rejected_answer_preview: preview(pair.rejected.answer),
    rejected_unsupported_claims: pair.rejected.unsupported_claims ?? [],
    ...features,
  };
}

function contrastFeatures(chosen, rejected) {
  const chosenTokens = contentTokens(chosen?.answer).length;
  const rejectedTokens = contentTokens(rejected?.answer).length;
  const chosenClaims = (chosen?.claim_table ?? []).map((claim) => claim.claim).filter(Boolean);
  const rejectedClaims = (rejected?.claim_table ?? []).map((claim) => claim.claim).filter(Boolean);
  const tags = [];
  if (sameCitationSet(chosen?.citations, rejected?.citations)) tags.push("same_citation");
  if (rejectedTokens > chosenTokens + 8) tags.push("unsupported_longer");
  if (rejectedClaims.length > chosenClaims.length) tags.push("unsupported_more_claims");
  if ((rejected?.unsupported_claims ?? []).length > 0) tags.push("unsupported_claims_available");
  if (chosenTokens <= 12) tags.push("concise_supported");
  if ((rejected?.citations ?? []).length >= (chosen?.citations ?? []).length) tags.push("citation_count_not_protective");
  return {
    chosen_tokens: chosenTokens,
    rejected_tokens: rejectedTokens,
    chosen_claim_count: chosenClaims.length,
    rejected_claim_count: rejectedClaims.length,
    chosen_citation_count: (chosen?.citations ?? []).length,
    rejected_citation_count: (rejected?.citations ?? []).length,
    tags,
  };
}

function finalAnalogTags(row) {
  const tags = [];
  const selectedTokens = Number(row.selected_candidate?.answer_tokens ?? 0);
  const supportedTokens = Number(row.best_supported_candidate?.answer_tokens ?? 0);
  if (row.supported_qwen_candidate_available) tags.push("supported_qwen_available");
  if (row.supported_openai_candidate_available) tags.push("supported_openai_available");
  if (Number(row.best_supported_rank_by_selector) > 1) tags.push("supported_not_top_ranked");
  if (Number(row.selector_penalty_to_best_supported?.selected_reliability_minus_best_supported ?? 0) > 0) tags.push("selected_higher_prior_than_supported");
  if (Number(row.selector_penalty_to_best_supported?.selected_raw_score_minus_best_supported ?? 0) < 0) tags.push("supported_higher_raw_score");
  if (selectedTokens > supportedTokens + 8) tags.push("selected_longer_than_supported");
  if ((row.selected_unsupported_claims ?? []).length > 0) tags.push("selected_unsupported_claims_available");
  return tags;
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
  return Object.fromEntries(Object.entries(stats).map(([key, row]) => [
    key,
    { ...row, smoothed_supported_rate: (row.chosen + 1) / (row.total + 2) },
  ]));
}

function predictionRunKey(candidate) {
  return candidate.prediction_run_id || (candidate.candidate_id || candidate.id || "").split("::")[1] || "unknown";
}

function sourcePrefixKey(candidate) {
  const runId = predictionRunKey(candidate)
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

function sameCitationSet(left = [], right = []) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && [...leftSet].every((id) => rightSet.has(id));
}

function contentTokens(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, "").split(/\W+/).filter((token) => token.length > 1);
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function countTags(tags) {
  return Object.fromEntries(Object.entries(countBy(tags)).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function preview(text, limit = 180) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function rate(num, den) {
  return den ? num / den : null;
}

function renderReport(result) {
  return `# Low-Prior Rescue Packet Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit mines non-final analogs of the D299 final misses: rows where the supported candidate exists but a chronological source-prior selector would choose the unsupported candidate.

## Temporal Transfer

- Evaluated pairs: ${result.temporal_transfer.evaluated_pairs}
- Source-prior correct: ${result.temporal_transfer.source_prior_correct}
- Source-prior accuracy: ${pct(result.temporal_transfer.source_prior_accuracy)}
- Low-prior rescue rows: ${result.temporal_transfer.low_prior_rescue_rows}

## Packet

- Rescue rows: ${result.packet_summary.rescue_rows}
- Examples: ${result.packet_summary.examples}
- Same-citation rows: ${result.packet_summary.same_citation_rows}
- Unsupported-longer rows: ${result.packet_summary.unsupported_longer_rows}
- Unsupported-claim rows: ${result.packet_summary.unsupported_claim_rows}
- Qwen rejected rows: ${result.packet_summary.qwen_rejected_rows}

## Final Analogy

- Final misses: ${result.final_analogy.final_misses}
- Final misses with supported candidate: ${result.final_analogy.final_misses_with_supported_candidate}
- Final misses with Qwen supported candidate: ${result.final_analogy.final_misses_with_qwen_supported_candidate}

## Decision

- Build low-prior rescue selector next: ${result.decision.build_low_prior_rescue_selector_next ? "yes" : "no"}
- Promote selector now: ${result.decision.promote_selector_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function pct(value) {
  return value == null ? "n/a" : `${(value * 100).toFixed(1)}%`;
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
