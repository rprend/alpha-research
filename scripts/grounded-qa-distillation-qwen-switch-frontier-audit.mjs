import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourceRunId = args["source-run"] ?? "contract-aware-candidate-selector-final-window-v1";
const hybridRunId = args["hybrid-run"] ?? "calibrated-hybrid-selector-final-window-v1";
const v14AuditRunId = args["v14-audit-run"] ?? "v14-support-delta-outcome-audit-2026-06-28-v1";
const runId = args["run-id"] ?? "qwen-switch-frontier-audit-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceRows = await readJsonl(path.join(runsDir, sourceRunId, "rows.jsonl"));
const hybridRows = byId(await readJsonl(path.join(runsDir, hybridRunId, "predictions.jsonl")));
const scaffoldRows = byId(await readJsonl(path.join(runsDir, hybridRunId, "scaffold_predictions.jsonl")));
const qwenSwitchOracleRows = byId(await readJsonl(path.join(runsDir, hybridRunId, "qwen_switch_oracle_predictions.jsonl")));
const v14Audit = await readJson(path.join(runsDir, v14AuditRunId, "result.json"));

const frontierRows = sourceRows.map(buildFrontierRow);
const sweepRows = buildSweepRows(frontierRows);
const bestSweep = sweepRows
  .filter((row) => row.metrics.answer_rate >= 0.7)
  .sort((a, b) => b.metrics.overall_judged_correct_rate - a.metrics.overall_judged_correct_rate
    || b.metrics.answer_support_rate - a.metrics.answer_support_rate
    || b.metrics.supported_answers - a.metrics.supported_answers)[0]
  ?? sweepRows.sort((a, b) => b.metrics.overall_judged_correct_rate - a.metrics.overall_judged_correct_rate)[0];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen_switch_frontier_audit",
  status: deriveStatus(frontierRows, bestSweep),
  purpose: "Zero-cost audit of the calibrated-hybrid Qwen switch frontier. It asks whether deployable answer-citation/score/length features can separate missed supported Qwen switches from harmful unsupported switches, before building another verifier or GPU packet.",
  source_runs: {
    contract_aware_candidate_selector: sourceRunId,
    calibrated_hybrid_selector: hybridRunId,
    v14_support_delta_outcome_audit: v14AuditRunId,
  },
  examples: sourceRows.length,
  frontier: summarizeFrontier(frontierRows),
  current_surfaces: {
    scaffold_priority: summarizeSelections(frontierRows.map((row) => row.scaffold_selection)),
    calibrated_hybrid: summarizeSelections(frontierRows.map((row) => row.hybrid_selection)),
    qwen_switch_oracle: summarizeSelections(frontierRows.map((row) => row.oracle_selection)),
  },
  switch_error_taxonomy: switchErrorTaxonomy(frontierRows),
  feature_separability: featureSeparability(frontierRows),
  threshold_sweep: sweepRows,
  best_diagnostic_sweep: bestSweep,
  v14_context: {
    status: v14Audit.status,
    v14_supported_not_in_qwen_oracle: v14Audit.support_delta?.v14_supported_not_in_qwen_oracle_ids?.length ?? null,
    hybrid_plus_v14_supported_answer_delta: v14Audit.selector_delta?.hybrid_plus_v14_gate_supported_answer_delta ?? null,
    hard_negative_sources: v14Audit.next_supervision_signal?.hard_negative_sources?.length ?? null,
  },
  decision_implication: decisionImplication(frontierRows, bestSweep),
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit reads existing prediction, selector, and judge artifacts only.",
  },
};

await writeJsonl(path.join(outputDir, "rows.jsonl"), frontierRows);
await writeJsonl(path.join(outputDir, "threshold_sweep.jsonl"), sweepRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  frontier: result.frontier,
  current_surfaces: result.current_surfaces,
  switch_error_taxonomy: result.switch_error_taxonomy,
  feature_separability: result.feature_separability,
  best_diagnostic_sweep: result.best_diagnostic_sweep,
}, null, 2));

function buildFrontierRow(row) {
  const scaffold = selectionPolicy(scaffoldRows.get(row.example_id));
  const hybrid = selectionPolicy(hybridRows.get(row.example_id));
  const oracle = selectionPolicy(qwenSwitchOracleRows.get(row.example_id));
  const qwenCandidates = row.candidates
    .filter((candidate) => candidate.family?.startsWith("qwen"))
    .filter((candidate) => candidate.answered)
    .filter((candidate) => candidate.contract?.answer_citation_complete === true)
    .map(candidateFeatures)
    .sort((a, b) => b.heuristic_score - a.heuristic_score || a.id.localeCompare(b.id));
  const bestQwen = qwenCandidates[0] ?? null;
  const oracleQwen = qwenCandidates.find((candidate) => candidate.id === oracle.selected_candidate_id) ?? null;
  const hybridQwen = qwenCandidates.find((candidate) => candidate.id === hybrid.selected_candidate_id) ?? null;
  return {
    example_id: row.example_id,
    counterfactual: row.counterfactual === true,
    reference_answer_type: row.reference?.answer_type ?? null,
    scaffold_selection: scaffold,
    hybrid_selection: hybrid,
    oracle_selection: oracle,
    frontier_eligible: scaffold.abstained && row.counterfactual !== true && qwenCandidates.length > 0,
    hybrid_switched_to_qwen: hybrid.answered && hybrid.selected_family?.startsWith("qwen"),
    oracle_switches_to_qwen: oracle.answered && oracle.selected_family?.startsWith("qwen"),
    hybrid_switch_supported: hybrid.answered && hybrid.supported_answer === true,
    hybrid_switch_unsupported: hybrid.answered && hybrid.selected_family?.startsWith("qwen") && hybrid.supported_answer !== true,
    oracle_supported_missed_by_hybrid: oracle.answered && oracle.supported_answer === true && hybrid.supported_answer !== true,
    best_qwen_candidate: bestQwen,
    hybrid_qwen_candidate: hybridQwen,
    oracle_qwen_candidate: oracleQwen,
    qwen_candidates: qwenCandidates,
  };
}

function candidateFeatures(candidate) {
  const answer = candidate.prediction?.answer ?? "";
  const answerTokens = contentTokens(answer);
  const lower = String(answer).trim().toLowerCase();
  return {
    id: candidate.id,
    family: candidate.family,
    heuristic_score: Number(candidate.heuristic_score ?? 0),
    answer_tokens: answerTokens.length,
    citation_count: (candidate.prediction?.citations ?? []).length,
    claim_count: (candidate.prediction?.claim_table ?? []).length,
    starts_yes_no: /^(yes|no)\b/.test(lower),
    supported_answer: candidate.supported_answer === true,
    answer_type_correct: candidate.answer_type_correct === true,
    judge_verdict: candidate.judgment?.verdict ?? null,
    answer_preview: preview(answer),
  };
}

function selectionPolicy(row) {
  const prediction = row?.prediction ?? {};
  const answered = prediction.answer_type === "grounded_answer";
  return {
    selected_candidate_id: row?.selected_candidate_id ?? null,
    selected_family: row?.selected_family ?? null,
    answered,
    abstained: !answered,
    supported_answer: row?.selection_scores?.supported_answer === true,
    supported_abstention: row?.selection_scores?.supported_abstention === true,
    judged_correct: row?.selection_scores?.judged_correct === true,
    answer_citation_complete: row?.selection_scores?.answer_citation_complete === true || !answered,
  };
}

function buildSweepRows(rows) {
  const thresholds = [0.45, 0.5, 0.55, 0.6, 0.62, 0.65, 0.68, 0.7, 0.72, 0.75];
  const minTokens = [1, 3, 5, 8, 12, 20];
  const familyModes = ["all_qwen", "qwen7b_only", "qwen3b_only"];
  const yesNoModes = ["allow_yes_no", "block_yes_no"];
  const outputs = [];
  for (const threshold of thresholds) {
    for (const minAnswerTokens of minTokens) {
      for (const familyMode of familyModes) {
        for (const yesNoMode of yesNoModes) {
          const selected = rows.map((row) => selectSweep(row, { threshold, minAnswerTokens, familyMode, yesNoMode }));
          outputs.push({
            policy_id: `score_${threshold}_tokens_${minAnswerTokens}_${familyMode}_${yesNoMode}`,
            threshold,
            min_answer_tokens: minAnswerTokens,
            family_mode: familyMode,
            yes_no_mode: yesNoMode,
            metrics: summarizeSelections(selected),
            switch_summary: summarizeSweepSwitches(rows, selected),
          });
        }
      }
    }
  }
  return outputs.sort((a, b) => b.metrics.overall_judged_correct_rate - a.metrics.overall_judged_correct_rate
    || b.metrics.answer_support_rate - a.metrics.answer_support_rate
    || b.metrics.answer_rate - a.metrics.answer_rate);
}

function selectSweep(row, policy) {
  if (!row.frontier_eligible) return row.scaffold_selection;
  const candidates = row.qwen_candidates
    .filter((candidate) => candidate.heuristic_score >= policy.threshold)
    .filter((candidate) => candidate.answer_tokens >= policy.minAnswerTokens)
    .filter((candidate) => policy.familyMode === "all_qwen" || candidate.family === `${policy.familyMode.replace("_only", "")}_lora`)
    .filter((candidate) => policy.yesNoMode !== "block_yes_no" || !candidate.starts_yes_no)
    .sort((a, b) => b.heuristic_score - a.heuristic_score || b.answer_tokens - a.answer_tokens || a.id.localeCompare(b.id));
  const selected = candidates[0];
  if (!selected) return row.scaffold_selection;
  return {
    selected_candidate_id: selected.id,
    selected_family: selected.family,
    answered: true,
    abstained: false,
    supported_answer: selected.supported_answer,
    supported_abstention: false,
    judged_correct: selected.supported_answer,
    answer_citation_complete: true,
  };
}

function summarizeSelections(rows) {
  const answered = rows.filter((row) => row.answered);
  const abstained = rows.filter((row) => row.abstained);
  const supportedAnswers = answered.filter((row) => row.supported_answer);
  const supportedAbstentions = abstained.filter((row) => row.supported_abstention);
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, rows.length),
    supported_answers: supportedAnswers.length,
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    supported_abstentions: supportedAbstentions.length,
    abstention_support_rate: ratio(supportedAbstentions.length, abstained.length),
    overall_judged_correct_rate: ratio(supportedAnswers.length + supportedAbstentions.length, rows.length),
  };
}

function summarizeSweepSwitches(frontierRows, selectedRows) {
  const selectedById = new Map(selectedRows.map((row, index) => [frontierRows[index].example_id, row]));
  const eligible = frontierRows.filter((row) => row.frontier_eligible);
  const switches = eligible.filter((row) => selectedById.get(row.example_id)?.selected_family?.startsWith("qwen"));
  return {
    eligible_frontier_rows: eligible.length,
    qwen_switches: switches.length,
    supported_switches: switches.filter((row) => selectedById.get(row.example_id)?.supported_answer).length,
    unsupported_switches: switches.filter((row) => selectedById.get(row.example_id)?.supported_answer !== true).length,
    recovered_oracle_supported_misses: switches.filter((row) => row.oracle_supported_missed_by_hybrid && selectedById.get(row.example_id)?.supported_answer).length,
  };
}

function summarizeFrontier(rows) {
  const eligible = rows.filter((row) => row.frontier_eligible);
  return {
    examples: rows.length,
    scaffold_abstention_non_counterfactual_with_qwen_answer: eligible.length,
    hybrid_qwen_switches: rows.filter((row) => row.hybrid_switched_to_qwen).length,
    qwen_oracle_switches: rows.filter((row) => row.oracle_switches_to_qwen).length,
    oracle_supported_missed_by_hybrid: rows.filter((row) => row.oracle_supported_missed_by_hybrid).length,
    harmful_hybrid_qwen_switches: rows.filter((row) => row.hybrid_switch_unsupported).length,
  };
}

function switchErrorTaxonomy(rows) {
  const missed = rows.filter((row) => row.oracle_supported_missed_by_hybrid);
  const harmful = rows.filter((row) => row.hybrid_switch_unsupported);
  return {
    missed_supported_oracle_switch_ids: missed.map((row) => row.example_id),
    harmful_hybrid_switch_ids: harmful.map((row) => row.example_id),
    missed_supported_oracle_switch_candidates: missed.map((row) => ({
      example_id: row.example_id,
      candidate: row.oracle_qwen_candidate,
      hybrid_candidate: row.hybrid_qwen_candidate,
      best_qwen_candidate: row.best_qwen_candidate,
    })),
    harmful_hybrid_switch_candidates: harmful.map((row) => ({
      example_id: row.example_id,
      candidate: row.hybrid_qwen_candidate,
      oracle_candidate: row.oracle_qwen_candidate,
      best_qwen_candidate: row.best_qwen_candidate,
    })),
  };
}

function featureSeparability(rows) {
  const missed = rows.filter((row) => row.oracle_supported_missed_by_hybrid).map((row) => row.oracle_qwen_candidate).filter(Boolean);
  const harmful = rows.filter((row) => row.hybrid_switch_unsupported).map((row) => row.hybrid_qwen_candidate).filter(Boolean);
  return {
    missed_supported: featureRange(missed),
    harmful_selected: featureRange(harmful),
    interpretation: separabilityInterpretation(missed, harmful),
  };
}

function featureRange(candidates) {
  if (!candidates.length) return { count: 0 };
  return {
    count: candidates.length,
    heuristic_score_min: Math.min(...candidates.map((row) => row.heuristic_score)),
    heuristic_score_max: Math.max(...candidates.map((row) => row.heuristic_score)),
    answer_tokens_min: Math.min(...candidates.map((row) => row.answer_tokens)),
    answer_tokens_max: Math.max(...candidates.map((row) => row.answer_tokens)),
    starts_yes_no: candidates.filter((row) => row.starts_yes_no).length,
    family_mix: groupCount(candidates.map((row) => row.family)),
    candidate_mix: groupCount(candidates.map((row) => row.id)),
  };
}

function separabilityInterpretation(missed, harmful) {
  if (!missed.length || !harmful.length) return "insufficient_comparison_rows";
  const missedMinScore = Math.min(...missed.map((row) => row.heuristic_score));
  const harmfulMaxScore = Math.max(...harmful.map((row) => row.heuristic_score));
  const missedMinTokens = Math.min(...missed.map((row) => row.answer_tokens));
  const harmfulMaxTokens = Math.max(...harmful.map((row) => row.answer_tokens));
  if (missedMinScore > harmfulMaxScore) return "score_threshold_can_separate_missed_supported_from_harmful";
  if (missedMinTokens > harmfulMaxTokens) return "answer_length_threshold_can_separate_missed_supported_from_harmful";
  return "simple_deployable_features_overlap";
}

function deriveStatus(rows, bestSweep) {
  const currentHybrid = summarizeSelections(rows.map((row) => row.hybrid_selection));
  const oracle = summarizeSelections(rows.map((row) => row.oracle_selection));
  const best = bestSweep.metrics;
  const separability = featureSeparability(rows).interpretation;
  if (best.answer_rate >= 0.7 && best.answer_support_rate >= 0.66 && best.overall_judged_correct_rate > currentHybrid.overall_judged_correct_rate && separability !== "simple_deployable_features_overlap") {
    return "frontier_deployable_rule_candidate_needs_cross_window_validation";
  }
  if (oracle.supported_answers > currentHybrid.supported_answers && separability === "simple_deployable_features_overlap") {
    return "frontier_requires_stronger_verifier";
  }
  if (oracle.supported_answers > currentHybrid.supported_answers) return "frontier_has_headroom_but_rule_unvalidated";
  return "frontier_no_remaining_qwen_headroom";
}

function decisionImplication(rows, bestSweep) {
  const currentHybrid = summarizeSelections(rows.map((row) => row.hybrid_selection));
  const oracle = summarizeSelections(rows.map((row) => row.oracle_selection));
  const separability = featureSeparability(rows).interpretation;
  if (oracle.supported_answers <= currentHybrid.supported_answers) {
    return "The current calibrated hybrid has exhausted this Qwen switch pool; improve generation or evidence packs.";
  }
  if (separability === "simple_deployable_features_overlap") {
    return "The Qwen switch frontier has oracle headroom, but simple score/length/family features overlap between missed supported switches and harmful switches. Next work should build an entailment-aware verifier or repair target, not another hand threshold.";
  }
  return `A diagnostic rule ${bestSweep.policy_id} improves the frontier under inherited judgments, but it was chosen on the final window and needs cross-window validation before it can be a deployable scaffold.`;
}

function renderReport(result) {
  const current = result.current_surfaces;
  const best = result.best_diagnostic_sweep;
  return `# Qwen Switch Frontier Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no compute. It audits the switch frontier between the scaffold-priority baseline, calibrated hybrid, and Qwen-switch oracle.

## Current Surfaces

| Surface | Answer rate | Answer support | Overall correct | Supported answers |
| --- | ---: | ---: | ---: | ---: |
| Scaffold priority | ${pct(current.scaffold_priority.answer_rate)} | ${pct(current.scaffold_priority.answer_support_rate)} | ${pct(current.scaffold_priority.overall_judged_correct_rate)} | ${current.scaffold_priority.supported_answers} |
| Calibrated hybrid | ${pct(current.calibrated_hybrid.answer_rate)} | ${pct(current.calibrated_hybrid.answer_support_rate)} | ${pct(current.calibrated_hybrid.overall_judged_correct_rate)} | ${current.calibrated_hybrid.supported_answers} |
| Qwen switch oracle | ${pct(current.qwen_switch_oracle.answer_rate)} | ${pct(current.qwen_switch_oracle.answer_support_rate)} | ${pct(current.qwen_switch_oracle.overall_judged_correct_rate)} | ${current.qwen_switch_oracle.supported_answers} |

## Frontier

- Eligible scaffold-abstention rows with Qwen answer candidates: ${result.frontier.scaffold_abstention_non_counterfactual_with_qwen_answer}
- Oracle-supported switches missed by hybrid: ${result.frontier.oracle_supported_missed_by_hybrid}
- Harmful hybrid Qwen switches: ${result.frontier.harmful_hybrid_qwen_switches}
- Feature separability: \`${result.feature_separability.interpretation}\`

## Best Diagnostic Sweep

Policy: \`${best.policy_id}\`

| Answer rate | Answer support | Overall correct | Supported answers | Qwen switches | Supported switches | Unsupported switches |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${pct(best.metrics.answer_rate)} | ${pct(best.metrics.answer_support_rate)} | ${pct(best.metrics.overall_judged_correct_rate)} | ${best.metrics.supported_answers} | ${best.switch_summary.qwen_switches} | ${best.switch_summary.supported_switches} | ${best.switch_summary.unsupported_switches} |

## Decision

${result.decision_implication}
`;
}

function contentTokens(value) {
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function preview(value, limit = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function groupCount(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function byId(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
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
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : true;
  }
  return parsed;
}
