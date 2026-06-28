import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const selectorRunId = args["selector-run"] ?? "time-aware-source-prefix-selector-audit-0-320-to-321-389-2026-06-28-v1";
const finalPacketRunId = args["final-packet-run"] ?? "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "final-miss-repairability-audit-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const selections = await readJsonl(path.join(runsDir, selectorRunId, "source_prefix_recency_4x_final_selections.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const candidateById = buildCandidateMap(finalPairs);
const selectedRows = selections.filter((row) => row.selected_supported_answer === false).map(analyzeMiss);
const allRows = selections.map(analyzeSelection);

const summary = summarize(selectedRows, allRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "final_miss_repairability_audit",
  status: deriveStatus(summary),
  purpose: "Diagnose whether the remaining source-prefix final misses are candidate-pool gaps or selector/ranking gaps before spending on labels or GPU.",
  source_runs: {
    selector: selectorRunId,
    final_packet: finalPacketRunId,
  },
  summary,
  decision: {
    promote_oracle_selector_now: false,
    treat_remaining_misses_as_candidate_pool_gap: summary.misses_without_supported_candidate > 0,
    treat_remaining_misses_as_selector_gap: summary.misses_with_supported_candidate > 0,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: summary.misses_without_supported_candidate > 0
      ? "Build a repair/regeneration packet for final-like candidate-pool gaps before more reranking."
      : "Build a leakage-safe non-final selector diagnostic that can recognize low-prior supported candidates without using final labels.",
    reason: summary.misses_without_supported_candidate > 0
      ? "At least one miss has no supported candidate in the final candidate pool, so reranking alone cannot close the gap."
      : "Every remaining miss has at least one supported candidate already present, so the immediate bottleneck is ranking/calibration rather than generation coverage.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_selection_correctness: true,
    final_miss_rows_training_use: "forbidden_final_window_diagnostic_only",
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
    note: "Zero-call local diagnostic over existing final candidate labels; final labels are reporting-only.",
  },
};

await writeJsonl(path.join(outputDir, "miss_rows.jsonl"), selectedRows);
await writeJsonl(path.join(outputDir, "all_selection_rows.jsonl"), allRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  summary: result.summary,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function analyzeSelection(row) {
  const candidates = enrichCandidates(row.ranked_candidates);
  const selected = candidates.find((candidate) => candidate.candidate_id === row.selected_candidate_id);
  const supported = candidates.filter((candidate) => candidate.supported_answer);
  const unsupported = candidates.filter((candidate) => !candidate.supported_answer);
  const bestSupportedByReliability = supportedSorted(supported)[0] ?? null;
  const bestSupportedByRawScore = [...supported].sort((left, right) => right.raw_broad_selector_score - left.raw_broad_selector_score || left.candidate_id.localeCompare(right.candidate_id))[0] ?? null;
  const selectedRank = candidates.findIndex((candidate) => candidate.candidate_id === row.selected_candidate_id) + 1;
  return {
    example_id: row.example_id,
    selected_supported_answer: row.selected_supported_answer,
    selected_candidate_id: row.selected_candidate_id,
    selected_family: row.selected_family,
    selected_rank_by_selector: selectedRank,
    candidate_count: candidates.length,
    supported_candidate_count: supported.length,
    unsupported_candidate_count: unsupported.length,
    best_supported_rank_by_selector: bestSupportedByReliability ? candidates.findIndex((candidate) => candidate.candidate_id === bestSupportedByReliability.candidate_id) + 1 : null,
    best_supported_candidate: bestSupportedByReliability ? candidateSummary(bestSupportedByReliability) : null,
    best_supported_by_raw_score: bestSupportedByRawScore ? candidateSummary(bestSupportedByRawScore) : null,
    selected_candidate: selected ? candidateSummary(selected) : null,
  };
}

function analyzeMiss(row) {
  const base = analyzeSelection(row);
  const candidates = enrichCandidates(row.ranked_candidates);
  const supported = candidates.filter((candidate) => candidate.supported_answer);
  const selected = candidates.find((candidate) => candidate.candidate_id === row.selected_candidate_id);
  const bestSupported = supportedSorted(supported)[0] ?? null;
  const bestQwenSupported = supportedSorted(supported.filter((candidate) => /^qwen/.test(candidate.family)))[0] ?? null;
  const bestOpenAiSupported = supportedSorted(supported.filter((candidate) => candidate.family === "openai_scaffold"))[0] ?? null;
  const selectorPenaltyToBestSupported = selected && bestSupported
    ? {
        selected_reliability_minus_best_supported: selected.reliability_score - bestSupported.reliability_score,
        selected_raw_score_minus_best_supported: selected.raw_broad_selector_score - bestSupported.raw_broad_selector_score,
        selected_family: selected.family,
        best_supported_family: bestSupported.family,
      }
    : null;
  return {
    ...base,
    miss_type: supported.length ? "selector_ranking_gap" : "candidate_pool_gap",
    supported_candidate_available: supported.length > 0,
    supported_qwen_candidate_available: Boolean(bestQwenSupported),
    supported_openai_candidate_available: Boolean(bestOpenAiSupported),
    best_qwen_supported_candidate: bestQwenSupported ? candidateSummary(bestQwenSupported) : null,
    best_openai_supported_candidate: bestOpenAiSupported ? candidateSummary(bestOpenAiSupported) : null,
    selector_penalty_to_best_supported: selectorPenaltyToBestSupported,
    selected_unsupported_claims: selected?.unsupported_claims ?? [],
    selected_answer_preview: preview(selected?.answer ?? ""),
    best_supported_answer_preview: preview(bestSupported?.answer ?? ""),
    diagnostic: supported.length
      ? "A supported candidate is already in the final pool; improving this row requires leakage-safe ranking/calibration, not new answer generation."
      : "No supported candidate is present in the final pool; this row requires repair/regeneration or retrieval changes.",
  };
}

function enrichCandidates(rankedCandidates) {
  return rankedCandidates.map((candidate) => {
    const full = candidateById.get(candidate.candidate_id) ?? {};
    return {
      ...candidate,
      ...full,
      candidate_id: candidate.candidate_id,
      family: candidate.family,
      supported_answer: Boolean(candidate.supported_answer),
      reliability_score: Number(candidate.reliability_score),
      raw_broad_selector_score: Number(candidate.raw_broad_selector_score ?? candidate.score ?? 0),
      answer_tokens: contentTokens(full.answer).length,
      claim_count: (full.claim_table ?? []).length,
      citation_count: (full.citations ?? []).length,
      citation_set: (full.citations ?? []).slice().sort(),
    };
  });
}

function supportedSorted(candidates) {
  return [...candidates].sort((left, right) =>
    right.reliability_score - left.reliability_score
    || right.raw_broad_selector_score - left.raw_broad_selector_score
    || left.candidate_id.localeCompare(right.candidate_id)
  );
}

function summarize(missRows, allRows) {
  const missRowsWithSupported = missRows.filter((row) => row.supported_candidate_available);
  const missRowsWithoutSupported = missRows.filter((row) => !row.supported_candidate_available);
  const selectorSolvedByOraclePool = allRows.filter((row) => row.supported_candidate_count > 0).length;
  return {
    final_examples: allRows.length,
    baseline_supported: allRows.filter((row) => row.selected_supported_answer).length,
    baseline_unsupported: missRows.length,
    oracle_candidate_pool_supported: selectorSolvedByOraclePool,
    oracle_candidate_pool_unsupported: allRows.length - selectorSolvedByOraclePool,
    oracle_candidate_pool_support_rate: rate(selectorSolvedByOraclePool, allRows.length),
    misses_with_supported_candidate: missRowsWithSupported.length,
    misses_without_supported_candidate: missRowsWithoutSupported.length,
    misses_with_qwen_supported_candidate: missRows.filter((row) => row.supported_qwen_candidate_available).length,
    misses_with_openai_supported_candidate: missRows.filter((row) => row.supported_openai_candidate_available).length,
    supported_candidate_rank_histogram_for_misses: countBy(missRowsWithSupported.map((row) => String(row.best_supported_rank_by_selector))),
    selected_miss_family_counts: countBy(missRows.map((row) => row.selected_family)),
    best_supported_family_counts_for_misses: countBy(missRowsWithSupported.map((row) => row.best_supported_candidate.family)),
  };
}

function deriveStatus(summary) {
  if (summary.misses_without_supported_candidate > 0 && summary.misses_with_supported_candidate > 0) return "mixed_selector_and_candidate_pool_gap";
  if (summary.misses_without_supported_candidate > 0) return "candidate_pool_gap_blocks_reranking_only";
  return "remaining_misses_are_selector_ranking_gap";
}

function buildCandidateMap(pairs) {
  const candidateById = new Map();
  for (const pair of pairs) {
    candidateById.set(pair.chosen.id, pair.chosen);
    candidateById.set(pair.rejected.id, pair.rejected);
  }
  return candidateById;
}

function candidateSummary(candidate) {
  return {
    candidate_id: candidate.candidate_id,
    family: candidate.family,
    supported_answer: candidate.supported_answer,
    reliability_score: candidate.reliability_score,
    raw_broad_selector_score: candidate.raw_broad_selector_score,
    answer_tokens: candidate.answer_tokens,
    claim_count: candidate.claim_count,
    citation_count: candidate.citation_count,
    citation_set: candidate.citation_set,
    answer_preview: preview(candidate.answer),
  };
}

function renderReport(result) {
  return `# Final Miss Repairability Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This is a final-window diagnostic only. It checks whether the remaining time-aware source-prefix misses are caused by missing supported candidates or by ranking existing supported candidates below unsupported selections.

## Summary

- Final examples: ${result.summary.final_examples}
- Baseline supported: ${result.summary.baseline_supported}
- Baseline unsupported misses: ${result.summary.baseline_unsupported}
- Oracle candidate-pool supported: ${result.summary.oracle_candidate_pool_supported}/${result.summary.final_examples}
- Misses with supported candidate already present: ${result.summary.misses_with_supported_candidate}
- Misses without supported candidate: ${result.summary.misses_without_supported_candidate}
- Misses with Qwen supported candidate: ${result.summary.misses_with_qwen_supported_candidate}
- Misses with OpenAI supported candidate: ${result.summary.misses_with_openai_supported_candidate}

## Decision

- Promote oracle selector now: ${result.decision.promote_oracle_selector_now ? "yes" : "no"}
- Treat remaining misses as selector gap: ${result.decision.treat_remaining_misses_as_selector_gap ? "yes" : "no"}
- Treat remaining misses as candidate-pool gap: ${result.decision.treat_remaining_misses_as_candidate_pool_gap ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function contentTokens(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, "").split(/\W+/).filter((token) => token.length > 1);
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function preview(text, limit = 180) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function rate(num, den) {
  return den ? num / den : null;
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
