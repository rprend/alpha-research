import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const runId = "question-target-completeness-packet-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const trainPacketRunId = "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1";
const trainNliRunId = "nonfinal-margin-compatible-train-nli-0-320-2026-06-28-v1";
const questionFocusRunId = "question-focus-guard-audit-0-320-to-321-389-2026-06-28-v1";
const finalPacketRunId = "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const finalNliRunId = "final-margin-compatible-heldout-nli-321-389-2026-06-28-v1";

const hardNegativeTags = [
  "unsupported_high_entailment",
  "unsupported_very_high_entailment",
  "focus_guard_hard_negative",
  "coverage_guard_hard_negative",
  "question_overlap_not_lower",
  "answer_length_not_lower",
  "coverage_not_lower",
];
const stopwords = new Set("the a an and or of to in for with on by is are was were be been being as at from into about this that these those it its they their we our you your can could should would do does did how what which who when where why much many over under between using use used than then have has had include includes included".split(" "));

await fs.mkdir(outputDir, { recursive: true });

const trainPairs = await readJsonl(path.join(runsDir, trainPacketRunId, "train_pairwise.jsonl"));
const trainNliByCandidate = aggregateNliByCandidate(await readJsonl(path.join(runsDir, trainNliRunId, "claim-nli-scores.jsonl")));
const questionFocus = await readJson(path.join(runsDir, questionFocusRunId, "result.json"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
const finalNliByCandidate = aggregateNliByCandidate(await readJsonl(path.join(runsDir, finalNliRunId, "claim-nli-scores.jsonl")));
const selectedFocusSwitches = await readJsonl(path.join(runsDir, questionFocusRunId, "selected_final_switches.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const nonfinalRows = trainPairs.map((pair) => auditPair(pair, trainNliByCandidate));
const targetRows = nonfinalRows.filter((row) => row.tags.some((tag) => hardNegativeTags.includes(tag)));
const focusHardRows = targetRows.filter((row) => row.tags.includes("focus_guard_hard_negative"));
const coverageHardRows = targetRows.filter((row) => row.tags.includes("coverage_guard_hard_negative"));
const finalCandidateIndex = buildCandidateIndex(finalPairs, finalNliByCandidate);
const finalSwitchRows = selectedFocusSwitches.map((row) => auditFinalSwitch(row, finalCandidateIndex));
const finalRegressionRows = finalSwitchRows.filter((row) => row.switch_direction === "regressed_supported");
const finalRescueRows = finalSwitchRows.filter((row) => row.switch_direction === "rescued_miss");

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "question_target_completeness_packet_audit",
  status: "target_completeness_supervision_sparse_in_current_packet",
  purpose: "Measure whether existing non-final judged pairs contain enough hard negatives for a question-target completeness verifier after D305 lexical focus anti-transfer.",
  source_runs: {
    nonfinal_train_packet: trainPacketRunId,
    nonfinal_nli: trainNliRunId,
    question_focus_guard: questionFocusRunId,
    final_packet: finalPacketRunId,
    final_nli: finalNliRunId,
  },
  d305_context: {
    eligible_zero_regression_rescue_policies: questionFocus.nonfinal_selection?.eligible_zero_regression_rescue_policies,
    selected_guard_id: questionFocus.nonfinal_selection?.selected_guard_id,
    selected_final_supported: questionFocus.comparison?.selected_final_supported,
    selected_final_rescued_misses: questionFocus.comparison?.selected_final_rescued_misses,
    selected_final_regressions: questionFocus.comparison?.selected_final_regressions,
  },
  nonfinal_packet: {
    pair_rows: nonfinalRows.length,
    target_rows: targetRows.length,
    unsupported_high_entailment_rows: countRows(targetRows, "unsupported_high_entailment"),
    unsupported_very_high_entailment_rows: countRows(targetRows, "unsupported_very_high_entailment"),
    focus_guard_hard_negative_rows: focusHardRows.length,
    coverage_guard_hard_negative_rows: coverageHardRows.length,
    hard_negative_counts_by_window: countBy(targetRows, "source_inventory_run_id"),
    focus_hard_negative_counts_by_window: countBy(focusHardRows, "source_inventory_run_id"),
    coverage_hard_negative_counts_by_window: countBy(coverageHardRows, "source_inventory_run_id"),
  },
  final_diagnostic: {
    selected_question_focus_switches: finalSwitchRows.length,
    selected_question_focus_regressions: finalRegressionRows.length,
    selected_question_focus_rescues: finalRescueRows.length,
    regression_tags: countTags(finalRegressionRows.flatMap((row) => row.tags)),
    rescue_tags: countTags(finalRescueRows.flatMap((row) => row.tags)),
  },
  packet_readiness: {
    enough_focus_hard_negatives_for_training: focusHardRows.length >= 12,
    enough_coverage_hard_negatives_for_training: coverageHardRows.length >= 12,
    enough_final_analog_regressions_for_diagnostic: finalRegressionRows.length >= 4,
    recommended_next_packet_source: "mine_broader_existing_judged_candidate_pools_or_buy_targeted_question_completeness_labels",
  },
  decision: {
    train_question_target_verifier_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Mine a broader question-target completeness packet from existing judged frontier pools before any GPU or new label spend; the current non-final train packet has only one focus-guard hard negative.",
    reason: "D305 anti-transfers because the non-final packet has many ordinary supported-vs-unsupported rows but almost no high-entailment, focus-preserving hard negatives matching the final regressions.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_switches_used_for_reporting_only: true,
    nonfinal_pair_labels_training_use: "allowed_nonfinal_target_packet_mining",
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
    note: "Zero-call packet audit over existing pairwise judgments, D305 switch artifacts, and local NLI scores.",
  },
};

await writeJsonl(path.join(outputDir, "nonfinal_target_completeness_rows.jsonl"), targetRows);
await writeJsonl(path.join(outputDir, "focus_guard_hard_negative_rows.jsonl"), focusHardRows);
await writeJsonl(path.join(outputDir, "coverage_guard_hard_negative_rows.jsonl"), coverageHardRows);
await writeJsonl(path.join(outputDir, "final_question_focus_switch_audit.jsonl"), finalSwitchRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  nonfinal_packet: result.nonfinal_packet,
  final_diagnostic: result.final_diagnostic,
  packet_readiness: result.packet_readiness,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function auditPair(pair, nliByCandidate) {
  const chosen = summarizeCandidate(pair.chosen.id, pair.chosen, pair.input, true, nliByCandidate);
  const rejected = summarizeCandidate(pair.rejected.id, pair.rejected, pair.input, false, nliByCandidate);
  const deltas = deltaFeatures(rejected, chosen);
  const tags = tagsFor(chosen, rejected, deltas);
  return {
    pair_id: pair.pair_id,
    example_id: pair.example_id,
    source_inventory_run_id: pair.source_inventory_run_id,
    chosen_candidate_id: chosen.candidate_id,
    rejected_candidate_id: rejected.candidate_id,
    chosen,
    rejected,
    rejected_minus_chosen: deltas,
    tags,
    training_use: "allowed_nonfinal_question_target_completeness_packet_mining",
  };
}

function auditFinalSwitch(row, index) {
  const baseline = index.get(row.baseline_candidate_id);
  const selected = index.get(row.selected_candidate_id);
  const deltas = deltaFeatures(selected, baseline);
  return {
    example_id: row.example_id,
    switch_direction: row.switch_direction,
    baseline_candidate_id: row.baseline_candidate_id,
    selected_candidate_id: row.selected_candidate_id,
    baseline,
    selected,
    selected_minus_baseline: deltas,
    tags: tagsFor(baseline, selected, deltas),
    training_use: "forbidden_final_window_reporting_only",
  };
}

function tagsFor(supportedOrBaseline, unsupportedOrSelected, deltas) {
  const tags = [];
  if (unsupportedOrSelected.nli_entailment_min >= 0.5) tags.push("unsupported_high_entailment");
  if (unsupportedOrSelected.nli_entailment_min >= 0.8) tags.push("unsupported_very_high_entailment");
  if (deltas.question_overlap >= 0) tags.push("question_overlap_not_lower");
  if (deltas.answer_tokens >= 0) tags.push("answer_length_not_lower");
  if (deltas.claim_count >= 0 && deltas.citation_count >= 0) tags.push("coverage_not_lower");
  if (unsupportedOrSelected.nli_entailment_min >= 0.5 && deltas.question_overlap >= 0 && deltas.answer_tokens >= 0) tags.push("focus_guard_hard_negative");
  if (unsupportedOrSelected.nli_entailment_min >= 0.8 && deltas.claim_count >= 0 && deltas.citation_count >= 0) tags.push("coverage_guard_hard_negative");
  if (unsupportedOrSelected.answer_tokens < supportedOrBaseline.answer_tokens && unsupportedOrSelected.nli_entailment_min >= 0.8) tags.push("short_high_entailment_candidate");
  return tags.sort();
}

function summarizeCandidate(candidateId, candidate, input, supportedAnswer, nliByCandidate) {
  const answer = candidate.answer ?? "";
  const questionTokens = unique(contentTokens(input?.question ?? ""));
  const answerTokens = unique(contentTokens(answer));
  const overlap = questionTokens.filter((token) => answerTokens.includes(token)).length;
  const nli = nliByCandidate.get(candidateId) ?? { entailment: [], contradiction: [], margin: [] };
  return {
    candidate_id: candidateId,
    family: candidate.family,
    supported_answer: supportedAnswer,
    nli_entailment_min: nli.entailment.length ? Math.min(...nli.entailment) : 0,
    nli_margin_min: nli.margin.length ? Math.min(...nli.margin) : 0,
    nli_contradiction_max: nli.contradiction.length ? Math.max(...nli.contradiction) : 0,
    claim_count: (candidate.claim_table ?? []).length,
    citation_count: (candidate.citations ?? []).length,
    answer_tokens: contentTokens(answer).length,
    question_overlap: overlap,
    question_recall: questionTokens.length ? overlap / questionTokens.length : 0,
    answer_preview: preview(answer),
  };
}

function buildCandidateIndex(pairs, nliByCandidate) {
  const index = new Map();
  for (const pair of pairs) {
    index.set(pair.chosen.id, summarizeCandidate(pair.chosen.id, pair.chosen, pair.input, true, nliByCandidate));
    index.set(pair.rejected.id, summarizeCandidate(pair.rejected.id, pair.rejected, pair.input, false, nliByCandidate));
  }
  return index;
}

function deltaFeatures(left, right) {
  return {
    nli_entailment_min: left.nli_entailment_min - right.nli_entailment_min,
    nli_margin_min: left.nli_margin_min - right.nli_margin_min,
    nli_contradiction_max: left.nli_contradiction_max - right.nli_contradiction_max,
    claim_count: left.claim_count - right.claim_count,
    citation_count: left.citation_count - right.citation_count,
    answer_tokens: left.answer_tokens - right.answer_tokens,
    question_overlap: left.question_overlap - right.question_overlap,
    question_recall: left.question_recall - right.question_recall,
  };
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

function countRows(rows, tag) {
  return rows.filter((row) => row.tags.includes(tag)).length;
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  return counts;
}

function countTags(tags) {
  const counts = {};
  for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return counts;
}

function preview(text, limit = 180) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function renderReport(result) {
  return `# Question-Target Completeness Packet Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit checks whether the current non-final packet contains enough high-entailment hard negatives to train the richer verifier implied by D305.

## Non-Final Packet

- Pair rows: ${result.nonfinal_packet.pair_rows}
- Target rows: ${result.nonfinal_packet.target_rows}
- Unsupported high-entailment rows: ${result.nonfinal_packet.unsupported_high_entailment_rows}
- Focus-guard hard negatives: ${result.nonfinal_packet.focus_guard_hard_negative_rows}
- Coverage-guard hard negatives: ${result.nonfinal_packet.coverage_guard_hard_negative_rows}

## Final Diagnostic

- D305 selected switches: ${result.final_diagnostic.selected_question_focus_switches}
- D305 regressions: ${result.final_diagnostic.selected_question_focus_regressions}
- D305 rescues: ${result.final_diagnostic.selected_question_focus_rescues}

## Decision

- Train question-target verifier now: ${result.decision.train_question_target_verifier_now ? "yes" : "no"}
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
