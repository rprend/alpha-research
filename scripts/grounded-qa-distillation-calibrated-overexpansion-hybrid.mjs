import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const d262RunId = args["baseline-run"] ?? "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1";
const overexpansionRunId = args["overexpansion-run"] ?? "overexpansion-aware-selector-qwen-frontier-pool-2026-06-28-v1";
const runId = args["run-id"] ?? "calibrated-overexpansion-hybrid-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const d262Result = await readJson(path.join(runsDir, d262RunId, "result.json"));
const overexpansionResult = await readJson(path.join(runsDir, overexpansionRunId, "result.json"));
const d262ExistingPairs = await readJsonl(path.join(runsDir, d262RunId, "constrained_existing_validation_pair_predictions.jsonl"));
const overExistingPairs = await readJsonl(path.join(runsDir, overexpansionRunId, "existing_validation_pair_predictions.jsonl"));
const d262FinalPairs = await readJsonl(path.join(runsDir, d262RunId, "constrained_final_diagnostic_pair_predictions.jsonl"));
const overFinalPairs = await readJsonl(path.join(runsDir, overexpansionRunId, "final_diagnostic_pair_predictions.jsonl"));
const d262FinalSelections = await readJsonl(path.join(runsDir, d262RunId, "constrained_final_diagnostic_selections.jsonl"));
const overFinalSelections = await readJsonl(path.join(runsDir, overexpansionRunId, "final_diagnostic_selections.jsonl"));

const existingPairRows = alignPairs(d262ExistingPairs, overExistingPairs);
const finalPairRows = alignPairs(d262FinalPairs, overFinalPairs);
const candidateRows = alignFinalCandidates(d262FinalSelections, overFinalSelections);
const alphas = Array.from({ length: 21 }, (_, index) => Number((index * 0.05).toFixed(2)));
const baselineExistingCorrect = d262ExistingPairs.filter((row) => row.correct).length;
const policyGrid = alphas.map((alpha) => evaluateHybridPolicy(alpha, existingPairRows, finalPairRows, candidateRows));
const selected = choosePolicy(policyGrid, baselineExistingCorrect);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "calibrated_overexpansion_hybrid",
  status: statusFor(selected, d262Result, overexpansionResult),
  baseline_run_id: d262RunId,
  overexpansion_run_id: overexpansionRunId,
  purpose: "Calibrate a zero-cost hybrid between the D262 broad grounded-support selector and D265 overexpansion selector, preserving existing validation before inspecting final diagnostics.",
  calibration: {
    alpha_definition: "0 means D262 only; 1 means D265 overexpansion only.",
    selected_alpha_overexpansion_weight: selected.alpha,
    selection_rule: "Choose the largest alpha whose existing-validation correct count is at least the D262 baseline; tie-break by existing mean margin.",
    baseline_existing_validation_correct: baselineExistingCorrect,
    policies_evaluated: policyGrid.length,
  },
  metrics: {
    selected_existing_validation_pairwise: selected.existing_validation,
    selected_final_diagnostic_pairwise: selected.final_pairwise,
    selected_final_diagnostic_selection: selected.final_selection.metrics,
    d262_final_selection: d262Result.metrics?.constrained_pool_pairwise_selector?.final_diagnostic_selection,
    overexpansion_final_selection: overexpansionResult.metrics?.final_diagnostic_selection,
  },
  decision: decisionFromSelected(selected, d262Result, overexpansionResult),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_diagnostic_training_use: "forbidden_diagnostic_only",
    calibration_use: "existing_validation_pairwise_only",
    nonfinal_training_use: "inherited_from_d262_and_d265",
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
    note: "This hybrid reads existing zero-call selector artifacts only.",
  },
};

await writeJsonl(path.join(outputDir, "policy_grid.jsonl"), policyGrid.map((row) => ({
  alpha: row.alpha,
  existing_validation: row.existing_validation,
  final_pairwise: row.final_pairwise,
  final_selection: row.final_selection.metrics,
})));
await writeJsonl(path.join(outputDir, "existing_validation_pair_predictions.jsonl"), selected.existing_rows);
await writeJsonl(path.join(outputDir, "final_diagnostic_pair_predictions.jsonl"), selected.final_rows);
await writeJsonl(path.join(outputDir, "final_diagnostic_selections.jsonl"), selected.final_selection.rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_alpha: selected.alpha,
  metrics: result.metrics,
  decision: result.decision,
}, null, 2));

function alignPairs(leftRows, rightRows) {
  const rightById = new Map(rightRows.map((row) => [row.pair_id, row]));
  return leftRows.map((left) => {
    const right = rightById.get(left.pair_id);
    if (!right) throw new Error(`Missing matching pair ${left.pair_id}`);
    return {
      pair_id: left.pair_id,
      example_id: left.example_id,
      split: left.split,
      source_index: left.source_index,
      chosen_id: left.chosen_id,
      rejected_id: left.rejected_id,
      d262_margin: Number(left.margin ?? 0),
      overexpansion_margin: Number(right.margin ?? 0),
      d262_correct: Boolean(left.correct),
      overexpansion_correct: Boolean(right.correct),
      training_use: left.training_use,
    };
  });
}

function alignFinalCandidates(leftSelections, rightSelections) {
  const rightByExample = new Map(rightSelections.map((row) => [row.example_id, row]));
  const rows = [];
  for (const leftSelection of leftSelections) {
    const rightSelection = rightByExample.get(leftSelection.example_id);
    if (!rightSelection) throw new Error(`Missing final selection ${leftSelection.example_id}`);
    const rightCandidates = new Map(rightSelection.ranked_candidates.map((row) => [row.candidate_id, row]));
    const leftNormalized = normalizeScores(leftSelection.ranked_candidates);
    const rightNormalized = normalizeScores(rightSelection.ranked_candidates);
    for (const leftCandidate of leftSelection.ranked_candidates) {
      const rightCandidate = rightCandidates.get(leftCandidate.candidate_id);
      if (!rightCandidate) throw new Error(`Missing candidate ${leftSelection.example_id}:${leftCandidate.candidate_id}`);
      rows.push({
        example_id: leftSelection.example_id,
        candidate_id: leftCandidate.candidate_id,
        family: leftCandidate.family,
        supported_answer: Boolean(leftCandidate.supported_answer || rightCandidate.supported_answer),
        d262_score: leftCandidate.score,
        overexpansion_score: rightCandidate.score,
        d262_normalized_score: leftNormalized.get(leftCandidate.candidate_id),
        overexpansion_normalized_score: rightNormalized.get(leftCandidate.candidate_id),
      });
    }
  }
  return rows;
}

function evaluateHybridPolicy(alpha, existingRows, finalRows, candidates) {
  const existingEvaluated = existingRows.map((row) => {
    const margin = hybridMargin(row.d262_margin, row.overexpansion_margin, alpha);
    return {
      ...row,
      alpha,
      margin,
      predicted_preferred: margin >= 0 ? "chosen" : "rejected",
      correct: margin >= 0,
    };
  });
  const finalEvaluated = finalRows.map((row) => {
    const margin = hybridMargin(row.d262_margin, row.overexpansion_margin, alpha);
    return {
      ...row,
      alpha,
      margin,
      predicted_preferred: margin >= 0 ? "chosen" : "rejected",
      correct: margin >= 0,
    };
  });
  const selectionRows = selectFinalCandidates(candidates, alpha);
  return {
    alpha,
    existing_rows: existingEvaluated,
    final_rows: finalEvaluated,
    existing_validation: summarizePairRows(existingEvaluated),
    final_pairwise: summarizePairRows(finalEvaluated),
    final_selection: { rows: selectionRows, metrics: summarizeSelections(selectionRows) },
  };
}

function choosePolicy(grid, baselineExistingCorrect) {
  const preserving = grid.filter((row) => row.existing_validation.correct >= baselineExistingCorrect);
  const candidates = preserving.length ? preserving : grid;
  return candidates.sort((left, right) => {
    const alphaDelta = right.alpha - left.alpha;
    if (Math.abs(alphaDelta) > 1e-12 && preserving.length) return alphaDelta;
    const correctDelta = right.existing_validation.correct - left.existing_validation.correct;
    if (correctDelta) return correctDelta;
    return right.existing_validation.mean_margin - left.existing_validation.mean_margin;
  })[0];
}

function hybridMargin(d262Margin, overMargin, alpha) {
  return (1 - alpha) * d262Margin + alpha * overMargin;
}

function selectFinalCandidates(candidates, alpha) {
  const byExample = new Map();
  for (const candidate of candidates) {
    if (!byExample.has(candidate.example_id)) byExample.set(candidate.example_id, []);
    byExample.get(candidate.example_id).push({
      ...candidate,
      alpha,
      score: (1 - alpha) * candidate.d262_normalized_score + alpha * candidate.overexpansion_normalized_score,
    });
  }
  return [...byExample.entries()].map(([exampleId, rows]) => {
    const ranked = rows.sort((left, right) => right.score - left.score);
    return {
      example_id: exampleId,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_family: ranked[0]?.family ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
      selected_score: ranked[0]?.score ?? null,
      candidate_count: ranked.length,
      supported_candidate_count: ranked.filter((row) => row.supported_answer).length,
      unsupported_candidate_count: ranked.filter((row) => !row.supported_answer).length,
      ranked_candidates: ranked,
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
}

function normalizeScores(rows) {
  const scores = rows.map((row) => Number(row.score ?? 0));
  const center = mean(scores);
  const std = Math.sqrt(mean(scores.map((score) => (score - center) ** 2))) || 1;
  return new Map(rows.map((row) => [row.candidate_id, (Number(row.score ?? 0) - center) / std]));
}

function summarizePairRows(rows) {
  const correct = rows.filter((row) => row.correct).length;
  return {
    pairs: rows.length,
    correct,
    accuracy: rate(correct, rows.length),
    mean_margin: mean(rows.map((row) => row.margin)),
  };
}

function summarizeSelections(rows) {
  const selectedSupported = rows.filter((row) => row.selected_supported_answer).length;
  return {
    examples: rows.length,
    selected_supported: selectedSupported,
    selected_unsupported: rows.length - selectedSupported,
    selection_support_rate: rate(selectedSupported, rows.length),
    examples_with_supported_candidate: rows.filter((row) => row.supported_candidate_count > 0).length,
  };
}

function statusFor(selected, d262Result, overexpansionResult) {
  const d262Final = Number(d262Result.metrics?.constrained_pool_pairwise_selector?.final_diagnostic_selection?.selection_support_rate ?? 0);
  const overFinal = Number(overexpansionResult.metrics?.final_diagnostic_selection?.selection_support_rate ?? 0);
  const selectedFinal = selected.final_selection.metrics.selection_support_rate;
  const baselineExistingCorrect = Number(d262Result.metrics?.constrained_pool_pairwise_selector?.existing_validation_pairwise?.correct ?? 0);
  if (selected.existing_validation.correct >= baselineExistingCorrect && selectedFinal >= overFinal && selectedFinal > d262Final) return "hybrid_preserves_validation_and_recovers_overexpansion_signal";
  if (selected.existing_validation.correct >= baselineExistingCorrect && selectedFinal > d262Final) return "hybrid_preserves_validation_with_partial_final_gain";
  return "hybrid_not_sufficient";
}

function decisionFromSelected(selected, d262Result, overexpansionResult) {
  const d262Final = Number(d262Result.metrics?.constrained_pool_pairwise_selector?.final_diagnostic_selection?.selected_supported ?? 0);
  const overFinal = Number(overexpansionResult.metrics?.final_diagnostic_selection?.selected_supported ?? 0);
  const selectedFinal = selected.final_selection.metrics.selected_supported;
  const baselineExistingCorrect = Number(d262Result.metrics?.constrained_pool_pairwise_selector?.existing_validation_pairwise?.correct ?? 0);
  if (selected.existing_validation.correct >= baselineExistingCorrect && selectedFinal >= overFinal && selectedFinal > d262Final) {
    return {
      integrate_selector_now: false,
      launch_gpu_now: false,
      buy_more_openai_labels_now: false,
      reason: "The hybrid preserves D262 existing validation and matches or improves the D265 final-selection gain, but the final diagnostic is still too small for integration claims.",
      next_step: "Audit the remaining hybrid final misses and broaden the validation set before considering integration or paid labels.",
    };
  }
  return {
    integrate_selector_now: false,
    launch_gpu_now: false,
    buy_more_openai_labels_now: false,
    reason: "The hybrid does not simultaneously preserve validation and recover the overexpansion final-selection gain.",
    next_step: "Keep D262 as the active baseline and use D265 only as a targeted diagnostic signal.",
  };
}

function renderReport(result) {
  return `# Calibrated Overexpansion Hybrid

Generated: ${result.generated_at}

This hybrid makes no OpenAI calls and launches no compute. Alpha is calibrated on existing validation only; final-window labels are forbidden diagnostics.

Selected alpha: \`${result.calibration.selected_alpha_overexpansion_weight}\`

| Metric | Items | Correct/selected | Rate |
| --- | ---: | ---: | ---: |
| Existing validation pairwise | ${result.metrics.selected_existing_validation_pairwise.pairs} | ${result.metrics.selected_existing_validation_pairwise.correct} | ${pct(result.metrics.selected_existing_validation_pairwise.accuracy)} |
| Final diagnostic pairwise | ${result.metrics.selected_final_diagnostic_pairwise.pairs} | ${result.metrics.selected_final_diagnostic_pairwise.correct} | ${pct(result.metrics.selected_final_diagnostic_pairwise.accuracy)} |
| Hybrid final selection | ${result.metrics.selected_final_diagnostic_selection.examples} | ${result.metrics.selected_final_diagnostic_selection.selected_supported} | ${pct(result.metrics.selected_final_diagnostic_selection.selection_support_rate)} |
| D262 final selection | ${result.metrics.d262_final_selection.examples} | ${result.metrics.d262_final_selection.selected_supported} | ${pct(result.metrics.d262_final_selection.selection_support_rate)} |
| D265 final selection | ${result.metrics.overexpansion_final_selection.examples} | ${result.metrics.overexpansion_final_selection.selected_supported} | ${pct(result.metrics.overexpansion_final_selection.selection_support_rate)} |

## Decision

- Integrate selector now: ${result.decision.integrate_selector_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value || 0)).toFixed(1)}%`;
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
