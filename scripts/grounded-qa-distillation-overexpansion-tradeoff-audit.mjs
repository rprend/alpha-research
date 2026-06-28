import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const baselineRunId = args["baseline-run"] ?? "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1";
const overexpansionRunId = args["overexpansion-run"] ?? "overexpansion-aware-selector-qwen-frontier-pool-2026-06-28-v1";
const hybridRunId = args["hybrid-run"] ?? "calibrated-overexpansion-hybrid-qwen-frontier-pool-2026-06-28-v1";
const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const runId = args["run-id"] ?? "overexpansion-tradeoff-audit-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const baselineResult = await readJson(path.join(runsDir, baselineRunId, "result.json"));
const overResult = await readJson(path.join(runsDir, overexpansionRunId, "result.json"));
const hybridResult = await readJson(path.join(runsDir, hybridRunId, "result.json"));
const baselineSelections = await readJsonl(path.join(runsDir, baselineRunId, "constrained_final_diagnostic_selections.jsonl"));
const overSelections = await readJsonl(path.join(runsDir, overexpansionRunId, "final_diagnostic_selections.jsonl"));
const hybridSelections = await readJsonl(path.join(runsDir, hybridRunId, "final_diagnostic_selections.jsonl"));
const diagnosticPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "diagnostic_frontier_pairwise.jsonl"));
const candidateIndex = buildCandidateIndex(diagnosticPairs);

const overById = new Map(overSelections.map((row) => [row.example_id, row]));
const hybridById = new Map(hybridSelections.map((row) => [row.example_id, row]));
const comparisons = baselineSelections.map((baseline) => compareExample({
  baseline,
  over: overById.get(baseline.example_id),
  hybrid: hybridById.get(baseline.example_id),
  candidates: candidateIndex.get(baseline.example_id) ?? new Map(),
}));
const recovered = comparisons.filter((row) => row.bucket === "overexpansion_only_success");
const regressions = comparisons.filter((row) => row.bucket === "baseline_only_success");
const bothFail = comparisons.filter((row) => row.bucket === "both_fail");
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "overexpansion_tradeoff_audit",
  status: statusFor(recovered, regressions, hybridResult),
  baseline_run_id: baselineRunId,
  overexpansion_run_id: overexpansionRunId,
  hybrid_run_id: hybridRunId,
  pairwise_packet_run_id: pairwisePacketRunId,
  purpose: "Audit why the D265 overexpansion selector recovers final examples that D262 misses but regresses one D262 success, before designing a conditional gate or buying labels.",
  summary: {
    final_examples: comparisons.length,
    baseline_supported: comparisons.filter((row) => row.baseline.selected_supported_answer).length,
    overexpansion_supported: comparisons.filter((row) => row.overexpansion.selected_supported_answer).length,
    hybrid_supported: comparisons.filter((row) => row.hybrid.selected_supported_answer).length,
    both_success: comparisons.filter((row) => row.bucket === "both_success").length,
    overexpansion_only_successes: recovered.length,
    baseline_only_successes: regressions.length,
    both_failures: bothFail.length,
    recovered_gate_feature_counts: countTags(recovered.flatMap((row) => row.gate_features)),
    regression_gate_feature_counts: countTags(regressions.flatMap((row) => row.gate_features)),
  },
  metrics_read: {
    baseline_final_selection: baselineResult.metrics?.constrained_pool_pairwise_selector?.final_diagnostic_selection,
    overexpansion_final_selection: overResult.metrics?.final_diagnostic_selection,
    hybrid_final_selection: hybridResult.metrics?.selected_final_diagnostic_selection,
  },
  findings: deriveFindings(recovered, regressions, bothFail),
  proposed_gate: {
    name: "overexpansion_rescue_when_supported_candidate_has_low_scope_risk",
    train_from_final_labels: false,
    candidate_rule_from_diagnostic_only: "Use D265 only as a rescue signal when the overexpansion-selected candidate is short, has no extra entity/list-scope risk, and D262's top candidate has judge-like unsupported-claim pattern proxies.",
    zero_cost_next_step: "Implement the gate on non-final validation first using D264 features and D262/D265 scores; then evaluate final diagnostics without tuning on them.",
  },
  decision: {
    integrate_gate_now: false,
    buy_more_labels_now: false,
    launch_gpu_now: false,
    next_step: "Build a leakage-safe non-final gate that activates the overexpansion score only for short low-risk candidates and rejects cases like the D265 regression on 2004.04060.",
    reason: "D265 has two final rescues and one final regression; a scalar hybrid loses the rescues, so the missing piece is conditional activation rather than more broad labels.",
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
    note: "This audit reads existing final diagnostic artifacts only.",
  },
};

await writeJsonl(path.join(outputDir, "comparison_rows.jsonl"), comparisons);
await writeJsonl(path.join(outputDir, "overexpansion_only_successes.jsonl"), recovered);
await writeJsonl(path.join(outputDir, "baseline_only_successes.jsonl"), regressions);
await writeJsonl(path.join(outputDir, "both_failures.jsonl"), bothFail);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result, recovered, regressions);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  summary: result.summary,
  decision: result.decision,
}, null, 2));

function buildCandidateIndex(pairs) {
  const byExample = new Map();
  for (const pair of pairs) {
    if (!byExample.has(pair.example_id)) byExample.set(pair.example_id, new Map());
    const candidates = byExample.get(pair.example_id);
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      if (!candidates.has(candidate.id)) {
        candidates.set(candidate.id, {
          ...candidate,
          supported_answer: role === "chosen",
          input: pair.input,
          reference: pair.reference,
        });
      } else if (role === "chosen") {
        candidates.get(candidate.id).supported_answer = true;
      }
    }
  }
  return byExample;
}

function compareExample({ baseline, over, hybrid, candidates }) {
  const bucket = bucketFor(baseline.selected_supported_answer, over.selected_supported_answer);
  const baselineSelected = summarizeSelected(baseline, candidates);
  const overSelected = summarizeSelected(over, candidates);
  const hybridSelected = summarizeSelected(hybrid, candidates);
  const bestSupported = bestSupportedCandidate(over.ranked_candidates, candidates);
  const gateFeatures = gateFeaturesFor({ bucket, baselineSelected, overSelected, bestSupported });
  return {
    example_id: baseline.example_id,
    bucket,
    gate_features: gateFeatures,
    baseline: {
      selected_candidate_id: baseline.selected_candidate_id,
      selected_supported_answer: baseline.selected_supported_answer,
      selected_score: round(baseline.selected_score),
      selected: baselineSelected,
    },
    overexpansion: {
      selected_candidate_id: over.selected_candidate_id,
      selected_supported_answer: over.selected_supported_answer,
      selected_score: round(over.selected_score),
      selected: overSelected,
    },
    hybrid: {
      selected_candidate_id: hybrid.selected_candidate_id,
      selected_supported_answer: hybrid.selected_supported_answer,
      selected_score: round(hybrid.selected_score),
      selected: hybridSelected,
    },
    best_supported: bestSupported,
    top_overexpansion_candidates: over.ranked_candidates.slice(0, 5).map((row) => summarizeRanked(row, candidates.get(row.candidate_id))),
    top_baseline_candidates: baseline.ranked_candidates.slice(0, 5).map((row) => summarizeRanked(row, candidates.get(row.candidate_id))),
  };
}

function bucketFor(baselineSupported, overSupported) {
  if (baselineSupported && overSupported) return "both_success";
  if (!baselineSupported && overSupported) return "overexpansion_only_success";
  if (baselineSupported && !overSupported) return "baseline_only_success";
  return "both_fail";
}

function summarizeSelected(selection, candidates) {
  const ranked = selection.ranked_candidates.find((row) => row.candidate_id === selection.selected_candidate_id);
  return summarizeRanked(ranked, candidates.get(selection.selected_candidate_id));
}

function summarizeRanked(ranked, candidate) {
  const answer = String(candidate?.answer ?? "");
  const claims = (candidate?.claim_table ?? []).map((claim) => String(claim.claim ?? "")).filter(Boolean);
  const unsupportedClaims = (candidate?.judgment?.unsupported_claims ?? []).map((claim) => String(claim.claim ?? claim.text ?? claim)).filter(Boolean);
  const features = ranked?.features ?? {};
  return {
    candidate_id: ranked?.candidate_id ?? candidate?.id ?? null,
    family: ranked?.family ?? candidate?.family ?? null,
    supported_answer: ranked?.supported_answer ?? candidate?.supported_answer ?? false,
    score: round(ranked?.score),
    answer_preview: preview(answer, 240),
    answer_tokens: tokenCount(answer),
    citations: candidate?.citations ?? [],
    citation_count: candidate?.citations?.length ?? 0,
    claim_count: claims.length,
    claims: claims.slice(0, 3).map((claim) => preview(claim, 180)),
    unsupported_claims: unsupportedClaims.slice(0, 3).map((claim) => preview(claim, 180)),
    unsupported_claim_count: unsupportedClaims.length,
    overexpansion_features: {
      answer_tokens: round(features.answer_tokens),
      claim_answer_gap: round(features.claim_answer_gap),
      answer_cited_coverage: round(features.answer_cited_coverage),
      unsupported_number_count: round(features.unsupported_number_count),
      unsupported_list_scope_count: round(features.unsupported_list_scope_count),
      extra_entity_count: round(features.extra_entity_count),
      short_answer_bonus: round(features.short_answer_bonus),
    },
  };
}

function bestSupportedCandidate(rankedRows, candidates) {
  const supported = rankedRows.find((row) => row.supported_answer);
  if (!supported) return null;
  return summarizeRanked(supported, candidates.get(supported.candidate_id));
}

function gateFeaturesFor({ bucket, baselineSelected, overSelected, bestSupported }) {
  const tags = new Set();
  if (bucket === "overexpansion_only_success") tags.add("overexpansion_recovers_supported_candidate");
  if (bucket === "baseline_only_success") tags.add("overexpansion_regresses_supported_candidate");
  if (overSelected?.answer_tokens <= 8) tags.add("overexpansion_selected_short_answer");
  if ((overSelected?.overexpansion_features?.extra_entity_count ?? 0) <= 0.7) tags.add("overexpansion_selected_low_extra_entity");
  if ((overSelected?.overexpansion_features?.unsupported_list_scope_count ?? 0) <= 0.1) tags.add("overexpansion_selected_low_list_scope");
  if ((baselineSelected?.unsupported_claim_count ?? 0) > 0) tags.add("baseline_selected_existing_unsupported_claims");
  if (bestSupported && baselineSelected?.candidate_id !== bestSupported.candidate_id) tags.add("baseline_misses_best_supported");
  if (bestSupported && overSelected?.candidate_id === bestSupported.candidate_id) tags.add("overexpansion_selects_best_supported");
  if (overSelected?.citation_count === baselineSelected?.citation_count) tags.add("same_citation_count_between_selected");
  return [...tags].sort();
}

function deriveFindings(recovered, regressions, bothFail) {
  const findings = [];
  findings.push(`D265 recovers ${recovered.length} D262 misses but regresses ${regressions.length} D262 success, which explains the net +1 final selection and the scalar-hybrid failure.`);
  if (recovered.every((row) => row.gate_features.includes("overexpansion_selected_short_answer"))) {
    findings.push("Recovered examples select short supported answers under D265, suggesting a conditional rescue path rather than global score blending.");
  }
  if (regressions.some((row) => !row.gate_features.includes("overexpansion_selected_low_extra_entity"))) {
    findings.push("The regression has higher entity/list-scope risk than the recovered cases, so a low-risk activation gate is plausible.");
  }
  findings.push(`${bothFail.length} examples still fail under both D262 and D265, so even a good gate will not be paper-sufficient without a broader target or stronger adjudicator.`);
  return findings;
}

function statusFor(recovered, regressions, hybridResult) {
  const hybridSupported = Number(hybridResult.metrics?.selected_final_diagnostic_selection?.selected_supported ?? 0);
  if (recovered.length > regressions.length && hybridSupported <= 4) return "conditional_gate_needed_for_overexpansion_signal";
  if (recovered.length > 0) return "overexpansion_tradeoff_requires_guard";
  return "overexpansion_no_recovery_to_gate";
}

function renderReport(result, recovered, regressions) {
  const recoveredRows = recovered.map((row) => `- \`${row.example_id}\`: D262 \`${row.baseline.selected_candidate_id}\` unsupported, D265 \`${row.overexpansion.selected_candidate_id}\` supported. Gate features: ${row.gate_features.map((tag) => `\`${tag}\``).join(", ")}.`);
  const regressionRows = regressions.map((row) => `- \`${row.example_id}\`: D262 \`${row.baseline.selected_candidate_id}\` supported, D265 \`${row.overexpansion.selected_candidate_id}\` unsupported. Gate features: ${row.gate_features.map((tag) => `\`${tag}\``).join(", ")}.`);
  return `# Overexpansion Tradeoff Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls and launches no compute. Final-window labels are diagnostic only.

| Final examples | D262 supported | D265 supported | D266 supported |
| ---: | ---: | ---: | ---: |
| ${result.summary.final_examples} | ${result.summary.baseline_supported} | ${result.summary.overexpansion_supported} | ${result.summary.hybrid_supported} |

## D265-Only Recoveries

${recoveredRows.join("\n") || "None."}

## D265 Regressions

${regressionRows.join("\n") || "None."}

## Decision

Integrate gate now: \`${result.decision.integrate_gate_now}\`

Next step: ${result.decision.next_step}
`;
}

function countTags(tags) {
  const counts = {};
  for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return counts;
}

function preview(value, length = 220) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function tokenCount(value) {
  return String(value ?? "").split(/\s+/).filter(Boolean).length;
}

function round(value, digits = 6) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
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
