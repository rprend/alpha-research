import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const runId = "frontier-target-completeness-mining-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const frontierPacketRunId = "qwen-frontier-pool-support-packet-2026-06-28-v1";
const claimVerifierRunId = "claim-nli-support-verifier-qwen-frontier-pool-2026-06-28-v1";
const sparsePacketAuditRunId = "question-target-completeness-packet-audit-0-320-to-321-389-2026-06-28-v1";

const stopwords = new Set("the a an and or of to in for with on by is are was were be been being as at from into about this that these those it its they their we our you your can could should would do does did how what which who when where why much many over under between using use used than then have has had include includes included".split(" "));

await fs.mkdir(outputDir, { recursive: true });

const frontierResult = await readJson(path.join(runsDir, frontierPacketRunId, "result.json"));
const sparsePacketAudit = await readJson(path.join(runsDir, sparsePacketAuditRunId, "result.json"));
const frontierPairs = await readJsonl(path.join(runsDir, frontierPacketRunId, "frontier_contrast_pairs.jsonl"));
const trainPairs = await readJsonl(path.join(runsDir, frontierPacketRunId, "train_contrast_pairs.jsonl"));
const validationPairs = await readJsonl(path.join(runsDir, frontierPacketRunId, "validation_contrast_pairs.jsonl"));
const claimNliRows = await readJsonl(path.join(runsDir, claimVerifierRunId, "claim-nli-scores.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const nliByCandidate = aggregateNliByCandidate(claimNliRows, frontierPairs);
const minedRows = frontierPairs.map((pair) => auditPair(pair, nliByCandidate));
const targetRows = minedRows.filter((row) => row.tags.length);
const focusRows = targetRows.filter((row) => row.tags.includes("focus_guard_hard_negative"));
const coverageRows = targetRows.filter((row) => row.tags.includes("coverage_guard_hard_negative"));
const splitSummary = summarizeBySplit(targetRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "frontier_target_completeness_mining_audit",
  status: focusRows.length >= 12 ? "frontier_packet_has_target_completeness_hard_negatives" : "frontier_packet_still_sparse_for_target_completeness",
  purpose: "Mine broader existing judged frontier-pool contrasts for question-target completeness hard negatives after D306 found only one focus-hard row in the current pair packet.",
  source_runs: {
    frontier_support_packet: frontierPacketRunId,
    claim_nli_support_verifier: claimVerifierRunId,
    sparse_question_target_packet_audit: sparsePacketAuditRunId,
  },
  d306_context: {
    baseline_pair_rows: sparsePacketAudit.nonfinal_packet?.pair_rows,
    baseline_focus_guard_hard_negative_rows: sparsePacketAudit.nonfinal_packet?.focus_guard_hard_negative_rows,
    baseline_coverage_guard_hard_negative_rows: sparsePacketAudit.nonfinal_packet?.coverage_guard_hard_negative_rows,
    final_focus_switch_regressions: sparsePacketAudit.final_diagnostic?.selected_question_focus_regressions,
  },
  frontier_packet: {
    frontier_pair_rows: frontierPairs.length,
    train_pair_rows: trainPairs.length,
    validation_pair_rows: validationPairs.length,
    target_rows: targetRows.length,
    unsupported_high_entailment_rows: countRows(targetRows, "unsupported_high_entailment"),
    unsupported_very_high_entailment_rows: countRows(targetRows, "unsupported_very_high_entailment"),
    focus_guard_hard_negative_rows: focusRows.length,
    coverage_guard_hard_negative_rows: coverageRows.length,
    focus_guard_hard_negative_train_rows: focusRows.filter((row) => row.train_split === "train").length,
    focus_guard_hard_negative_validation_rows: focusRows.filter((row) => row.train_split === "validation").length,
    coverage_guard_hard_negative_train_rows: coverageRows.filter((row) => row.train_split === "train").length,
    coverage_guard_hard_negative_validation_rows: coverageRows.filter((row) => row.train_split === "validation").length,
    hard_negative_counts_by_split: splitSummary,
    hard_negative_counts_by_contrast_type: countBy(targetRows, "contrast_type"),
  },
  packet_readiness: {
    enough_focus_hard_negatives_for_training: focusRows.filter((row) => row.train_split === "train").length >= 12,
    enough_focus_hard_negatives_for_validation: focusRows.filter((row) => row.train_split === "validation").length >= 4,
    enough_coverage_hard_negatives_for_training: coverageRows.filter((row) => row.train_split === "train").length >= 12,
    broadened_over_d306_focus_rows: focusRows.length - Number(sparsePacketAudit.nonfinal_packet?.focus_guard_hard_negative_rows ?? 0),
    broadened_over_d306_coverage_rows: coverageRows.length - Number(sparsePacketAudit.nonfinal_packet?.coverage_guard_hard_negative_rows ?? 0),
  },
  decision: {
    build_question_target_packet_next: focusRows.length >= 12,
    train_question_target_verifier_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: focusRows.length >= 12
      ? "Build a leakage-safe question-target completeness packet from these frontier rows and test a verifier before any new label or GPU spend."
      : "Existing frontier rows are still too sparse; prepare a small targeted label batch for question-target completeness before GPU training.",
    reason: focusRows.length >= 12
      ? `Existing frontier judgments expand focus-hard negatives from ${sparsePacketAudit.nonfinal_packet?.focus_guard_hard_negative_rows} to ${focusRows.length}, enough to build a real packet.`
      : `Existing frontier judgments expand focus-hard negatives only to ${focusRows.length}, below the packet threshold.`,
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    frontier_rows_training_use: "allowed_existing_nonfinal_frontier_judgments",
    inherited_frontier_final_window_labels_used: frontierResult.leakage_guard?.final_window_labels_used_for_training ?? false,
    final_policy_training_use: "none",
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    inherited_frontier_openai_cost_usd: frontierResult.budget?.inherited_openai_cost_usd ?? 0,
    inherited_frontier_external_compute_cost_usd: frontierResult.budget?.inherited_external_compute_cost_usd ?? 0,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "Zero-call mining audit over existing frontier judgments and existing local claim-NLI scores.",
  },
};

await writeJsonl(path.join(outputDir, "frontier_target_completeness_rows.jsonl"), targetRows);
await writeJsonl(path.join(outputDir, "frontier_focus_guard_hard_negative_rows.jsonl"), focusRows);
await writeJsonl(path.join(outputDir, "frontier_coverage_guard_hard_negative_rows.jsonl"), coverageRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  frontier_packet: result.frontier_packet,
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
    root_example_id: pair.root_example_id,
    source_index: pair.source_index,
    train_split: pair.train_split,
    contrast_type: pair.contrast_type,
    chosen_candidate_id: chosen.candidate_id,
    rejected_candidate_id: rejected.candidate_id,
    chosen,
    rejected,
    rejected_minus_chosen: deltas,
    tags,
    training_use: "allowed_existing_nonfinal_frontier_judgment_mining",
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
  if ((unsupportedOrSelected.unsupported_claim_count ?? 0) > 0) tags.push("judge_unsupported_claim_available");
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
    unsupported_claim_count: (candidate.unsupported_claims ?? []).length,
    answer_tokens: contentTokens(answer).length,
    question_overlap: overlap,
    question_recall: questionTokens.length ? overlap / questionTokens.length : 0,
    answer_preview: preview(answer),
  };
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

function aggregateNliByCandidate(rows, pairs) {
  const candidateIds = [...new Set(pairs.flatMap((pair) => [pair.chosen.id, pair.rejected.id]))];
  const byCandidate = new Map(candidateIds.map((id) => [id, { entailment: [], contradiction: [], margin: [] }]));
  for (const row of rows) {
    for (const candidateId of candidateIds) {
      if (!row.unit_key.includes(candidateId)) continue;
      const aggregate = byCandidate.get(candidateId);
      aggregate.entailment.push(Number(row.nli?.entailment ?? 0));
      aggregate.contradiction.push(Number(row.nli?.contradiction ?? 0));
      aggregate.margin.push(Number(row.nli?.margin ?? 0));
    }
  }
  return byCandidate;
}

function contentTokens(text) {
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").match(/[a-z0-9]+/g)?.filter((token) => token.length > 2 && !stopwords.has(token)) ?? [];
}

function unique(values) {
  return [...new Set(values)];
}

function summarizeBySplit(rows) {
  const summary = {};
  for (const row of rows) {
    const split = row.train_split ?? "unknown";
    summary[split] ??= { target_rows: 0, focus_guard_hard_negative_rows: 0, coverage_guard_hard_negative_rows: 0 };
    summary[split].target_rows += 1;
    if (row.tags.includes("focus_guard_hard_negative")) summary[split].focus_guard_hard_negative_rows += 1;
    if (row.tags.includes("coverage_guard_hard_negative")) summary[split].coverage_guard_hard_negative_rows += 1;
  }
  return summary;
}

function countRows(rows, tag) {
  return rows.filter((row) => row.tags.includes(tag)).length;
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  return counts;
}

function preview(text, limit = 180) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function renderReport(result) {
  return `# Frontier Target Completeness Mining Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit mines existing judged frontier-pool contrasts for the high-entailment, focus-preserving hard negatives missing in D306.

## Frontier Packet

- Frontier pairs: ${result.frontier_packet.frontier_pair_rows}
- Target rows: ${result.frontier_packet.target_rows}
- Focus-guard hard negatives: ${result.frontier_packet.focus_guard_hard_negative_rows}
- Coverage-guard hard negatives: ${result.frontier_packet.coverage_guard_hard_negative_rows}
- Focus train rows: ${result.frontier_packet.focus_guard_hard_negative_train_rows}
- Focus validation rows: ${result.frontier_packet.focus_guard_hard_negative_validation_rows}

## Decision

- Build question-target packet next: ${result.decision.build_question_target_packet_next ? "yes" : "no"}
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
