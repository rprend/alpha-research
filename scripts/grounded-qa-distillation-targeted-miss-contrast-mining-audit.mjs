import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const timeAwareRunId = args["time-aware-run"] ?? "time-aware-source-prefix-selector-audit-0-320-to-321-389-2026-06-28-v1";
const finalPacketRunId = args["final-packet-run"] ?? "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const trainPacketRunId = args["train-packet-run"] ?? "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1";
const overlayRunId = args["overlay-run"] ?? "candidate-internal-feature-overlay-audit-0-320-to-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "targeted-miss-contrast-mining-audit-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const selectionRows = await readJsonl(path.join(runsDir, timeAwareRunId, "source_prefix_recency_4x_final_selections.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
const trainPairs = await readJsonl(path.join(runsDir, trainPacketRunId, "train_pairwise.jsonl"));
const overlay = await readJson(path.join(runsDir, overlayRunId, "result.json"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const missRows = selectionRows.filter((row) => !row.selected_supported_answer);
const finalPairsByExample = groupBy(finalPairs, (row) => row.example_id);
const missAnalyses = missRows.map((row) => analyzeMiss(row, finalPairsByExample.get(row.example_id) ?? []));
const minedContrasts = trainPairs
  .map((pair) => ({ ...summarizePairContrast(pair), pair_id: pair.pair_id, example_id: pair.example_id, source_inventory_run_id: pair.source_inventory_run_id }))
  .filter((row) => row.tags.includes("unsupported_claims_available"))
  .sort((left, right) => scoreTargetContrast(right) - scoreTargetContrast(left) || left.pair_id.localeCompare(right.pair_id));

const highPriorityContrasts = minedContrasts.filter((row) =>
  row.tags.includes("same_citation")
  && row.tags.includes("unsupported_longer")
  && row.tags.includes("unsupported_claims_available")
);
const conciseOverexpansionContrasts = highPriorityContrasts.filter((row) => row.tags.includes("concise_supported"));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "targeted_miss_contrast_mining_audit",
  status: "targeted_contrasts_available_not_promoted",
  purpose: "Convert the five remaining source-prefix selector misses into targeted contrast patterns for the next training-data construction step.",
  source_runs: {
    time_aware_source_prefix: timeAwareRunId,
    final_packet: finalPacketRunId,
    nonfinal_train_packet: trainPacketRunId,
    candidate_internal_overlay: overlayRunId,
  },
  final_miss_summary: {
    misses: missAnalyses.length,
    same_citation_misses: missAnalyses.filter((row) => row.tags.includes("same_citation")).length,
    unsupported_longer_misses: missAnalyses.filter((row) => row.tags.includes("unsupported_longer")).length,
    unsupported_claims_available_misses: missAnalyses.filter((row) => row.tags.includes("unsupported_claims_available")).length,
    concise_supported_available_misses: missAnalyses.filter((row) => row.tags.includes("concise_supported_available")).length,
    qwen_unknown_misses: missAnalyses.filter((row) => row.selected_family?.startsWith("qwen")).length,
  },
  nonfinal_target_contrast_summary: {
    available_target_contrasts: minedContrasts.length,
    same_citation_unsupported_claim_contrasts: minedContrasts.filter((row) => row.tags.includes("same_citation")).length,
    same_citation_unsupported_longer_contrasts: highPriorityContrasts.length,
    concise_same_citation_overexpansion_contrasts: conciseOverexpansionContrasts.length,
    source_window_counts: countBy(minedContrasts.map((row) => row.source_inventory_run_id ?? "unknown")),
    top_tag_counts: countTags(minedContrasts.flatMap((row) => row.tags)),
  },
  examples: {
    final_misses: missAnalyses.slice(0, 5),
    high_priority_nonfinal_contrasts: highPriorityContrasts.slice(0, 8),
  },
  comparison: {
    current_selector_supported: 44,
    remaining_misses: 5,
    overlay_best_supported: overlay.comparison?.best_overlay_selected_supported,
    large_nli_overlay_supported: overlay.comparison?.large_nli_overlay_selected_supported,
  },
  decision: {
    promote_selector_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Build a targeted overexpansion/same-citation contrast packet from the mined non-final rows and evaluate a preregistered miss-aware selector.",
    reason: "The remaining misses share concrete patterns, and matching non-final contrasts already exist, so the next step should construct targeted supervision rather than use broad hand-weighted feature overlays.",
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
    note: "Zero-call mining audit over existing judged contrasts.",
  },
};

await writeJsonl(path.join(outputDir, "final_miss_analyses.jsonl"), missAnalyses);
await writeJsonl(path.join(outputDir, "nonfinal_target_contrasts.jsonl"), minedContrasts);
await writeJsonl(path.join(outputDir, "high_priority_nonfinal_contrasts.jsonl"), highPriorityContrasts);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  status: result.status,
  final_miss_summary: result.final_miss_summary,
  nonfinal_target_contrast_summary: result.nonfinal_target_contrast_summary,
  decision: result.decision,
}, null, 2));

function analyzeMiss(selection, pairs) {
  const selectedId = selection.selected_candidate_id;
  const involvingSelected = pairs.filter((pair) => pair.rejected.id === selectedId || pair.chosen.id === selectedId);
  const supportedCandidates = uniqueBy(pairs.map((pair) => pair.chosen), (candidate) => candidate.id);
  const selectedPair = involvingSelected.find((pair) => pair.rejected.id === selectedId) ?? involvingSelected[0];
  const selectedCandidate = selectedPair?.rejected?.id === selectedId ? selectedPair.rejected : selectedPair?.chosen;
  const bestSupported = supportedCandidates[0];
  const contrast = bestSupported && selectedCandidate ? contrastFeatures(bestSupported, selectedCandidate) : { tags: [] };
  const tags = new Set(contrast.tags);
  if (selectedCandidate?.family?.startsWith("qwen")) tags.add("qwen_unknown_selected");
  if (supportedCandidates.some((candidate) => contentTokens(candidate.answer).length <= 12)) tags.add("concise_supported_available");
  return {
    example_id: selection.example_id,
    selected_candidate_id: selectedId,
    selected_family: selection.selected_family,
    supported_candidate_count: supportedCandidates.length,
    selected_answer_preview: preview(selectedCandidate?.answer),
    selected_claims: (selectedCandidate?.claim_table ?? []).map((claim) => claim.claim).filter(Boolean),
    selected_unsupported_claims: selectedCandidate?.unsupported_claims ?? [],
    best_supported_candidate_id: bestSupported?.id ?? null,
    best_supported_family: bestSupported?.family ?? null,
    best_supported_answer_preview: preview(bestSupported?.answer),
    best_supported_claims: (bestSupported?.claim_table ?? []).map((claim) => claim.claim).filter(Boolean),
    tags: [...tags].sort(),
    contrast,
  };
}

function summarizePairContrast(pair) {
  const contrast = contrastFeatures(pair.chosen, pair.rejected);
  return {
    chosen_id: pair.chosen.id,
    rejected_id: pair.rejected.id,
    chosen_family: pair.chosen.family,
    rejected_family: pair.rejected.family,
    chosen_answer_preview: preview(pair.chosen.answer),
    rejected_answer_preview: preview(pair.rejected.answer),
    rejected_unsupported_claims: pair.rejected.unsupported_claims ?? [],
    tags: contrast.tags,
    contrast,
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

function scoreTargetContrast(row) {
  let score = 0;
  for (const tag of row.tags) {
    if (tag === "same_citation") score += 3;
    else if (tag === "unsupported_longer") score += 3;
    else if (tag === "unsupported_claims_available") score += 2;
    else if (tag === "concise_supported") score += 2;
    else if (tag === "unsupported_more_claims") score += 1;
  }
  return score;
}

function sameCitationSet(left = [], right = []) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && [...leftSet].every((id) => rightSet.has(id));
}

function contentTokens(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, "").split(/\W+/).filter((token) => token.length > 1);
}

function preview(text, limit = 260) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function uniqueBy(rows, keyFn) {
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const key = keyFn(row);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function countTags(tags) {
  return Object.fromEntries(Object.entries(countBy(tags)).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function renderReport(result) {
  return `# Targeted Miss Contrast Mining Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit converts the five remaining source-prefix selector misses into explicit contrast-mining targets.

## Final Misses

- Remaining misses: ${result.final_miss_summary.misses}
- Same-citation misses: ${result.final_miss_summary.same_citation_misses}
- Unsupported-longer misses: ${result.final_miss_summary.unsupported_longer_misses}
- Unsupported-claim evidence available: ${result.final_miss_summary.unsupported_claims_available_misses}
- Qwen unknown misses: ${result.final_miss_summary.qwen_unknown_misses}

## Non-Final Targets

- Available target contrasts: ${result.nonfinal_target_contrast_summary.available_target_contrasts}
- Same-citation unsupported-claim contrasts: ${result.nonfinal_target_contrast_summary.same_citation_unsupported_claim_contrasts}
- Same-citation unsupported-longer contrasts: ${result.nonfinal_target_contrast_summary.same_citation_unsupported_longer_contrasts}
- Concise same-citation overexpansion contrasts: ${result.nonfinal_target_contrast_summary.concise_same_citation_overexpansion_contrasts}

## Decision

- Promote selector now: ${result.decision.promote_selector_now ? "yes" : "no"}
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
