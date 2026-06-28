import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const selectorRunId = args["selector-run"] ?? "filtered-boundary-selector-gpt4o-qwen-frontier-pool-2026-06-28-v1";
const baselineRunId = args["baseline-run"] ?? "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1";
const runId = args["run-id"] ?? "boundary-hybrid-tradeoff-audit-gpt4o-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const selector = await readJson(path.join(runsDir, selectorRunId, "result.json"));
const baseline = await readJson(path.join(runsDir, baselineRunId, "result.json"));
const d262Selections = await readJsonl(path.join(runsDir, baselineRunId, "constrained_final_diagnostic_selections.jsonl"));
const boundarySelections = await readJsonl(path.join(runsDir, selectorRunId, "boundary_final_diagnostic_selections.jsonl"));
const hybridSelections = await readJsonl(path.join(runsDir, selectorRunId, "hybrid_final_diagnostic_selections.jsonl"));
const d262ExistingPairs = await readJsonl(path.join(runsDir, baselineRunId, "constrained_existing_validation_pair_predictions.jsonl"));
const boundaryExistingPairs = await readJsonl(path.join(runsDir, selectorRunId, "boundary_existing_validation_pair_predictions.jsonl"));

const d262ByExample = new Map(d262Selections.map((row) => [row.example_id, row]));
const boundaryByExample = new Map(boundarySelections.map((row) => [row.example_id, row]));
const hybridByExample = new Map(hybridSelections.map((row) => [row.example_id, row]));
const comparisonRows = d262Selections.map((row) => compareExample(row.example_id));
const boundaryOnlyRescues = comparisonRows.filter((row) => !row.d262.selected_supported_answer && row.boundary.selected_supported_answer);
const hybridLostRescues = comparisonRows.filter((row) => row.boundary.selected_supported_answer && !row.hybrid.selected_supported_answer);
const alphaGrid = alphaTradeoffGrid([0, 0.3, 0.5, 0.8, 1, 1.5, 2, 2.5, 3, 4, 5]);
const selectedAlpha = selector.metrics?.selected_hybrid?.alpha_boundary_weight ?? selector.tuning?.selected_policy?.alpha_boundary_weight;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "boundary_hybrid_tradeoff_audit",
  selector_run_id: selectorRunId,
  baseline_run_id: baselineRunId,
  purpose: "Audit why D272 boundary-only final-selection gain disappears when the boundary score is constrained to preserve D262 validation behavior.",
  summary: {
    final_examples: comparisonRows.length,
    d262_selected_supported: countSupported(comparisonRows.map((row) => row.d262)),
    boundary_only_selected_supported: countSupported(comparisonRows.map((row) => row.boundary)),
    selected_hybrid_alpha: selectedAlpha,
    selected_hybrid_selected_supported: countSupported(comparisonRows.map((row) => row.hybrid)),
    boundary_only_rescues: boundaryOnlyRescues.length,
    boundary_rescues_lost_by_selected_hybrid: hybridLostRescues.length,
    minimum_alpha_to_recover_any_lost_rescue: min(hybridLostRescues.map((row) => row.hybrid_alpha_needed_to_match_boundary_selection).filter(Number.isFinite)),
  },
  tradeoff: {
    d262_existing_validation_correct: baseline.metrics?.constrained_pool_pairwise_selector?.existing_validation_pairwise?.correct,
    selected_hybrid_existing_validation_correct: selector.metrics?.selected_hybrid?.existing_validation_pairwise?.correct,
    alpha_grid_note: "Final labels are not used to choose policy; this grid is diagnostic only and shows why the boundary-only rescue needs much more weight than validation-preserving policies.",
  },
  findings: findingsFor(hybridLostRescues, alphaGrid, selectedAlpha),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_diagnostic_use: "forbidden_diagnostic_audit_only",
    nonfinal_training_source: selector.training?.accepted_label_source,
  },
  decision: decisionFor(hybridLostRescues, alphaGrid, selectedAlpha),
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit reads existing selector artifacts only.",
  },
  artifacts: {
    comparison_rows_jsonl: rel(path.join(outputDir, "comparison_rows.jsonl")),
    boundary_only_rescues_jsonl: rel(path.join(outputDir, "boundary_only_rescues.jsonl")),
    hybrid_lost_rescues_jsonl: rel(path.join(outputDir, "hybrid_lost_rescues.jsonl")),
    alpha_grid_jsonl: rel(path.join(outputDir, "alpha_grid.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "comparison_rows.jsonl"), comparisonRows);
await writeJsonl(path.join(outputDir, "boundary_only_rescues.jsonl"), boundaryOnlyRescues);
await writeJsonl(path.join(outputDir, "hybrid_lost_rescues.jsonl"), hybridLostRescues);
await writeJsonl(path.join(outputDir, "alpha_grid.jsonl"), alphaGrid);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result, hybridLostRescues, alphaGrid);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  summary: result.summary,
  decision: result.decision,
}, null, 2));

function compareExample(exampleId) {
  const d262 = summarizeSelection(d262ByExample.get(exampleId));
  const boundary = summarizeSelection(boundaryByExample.get(exampleId));
  const hybrid = summarizeSelection(hybridByExample.get(exampleId));
  const boundaryTop = candidateScore(boundaryByExample.get(exampleId), boundary.selected_candidate_id);
  const d262BoundaryCandidate = candidateScore(d262ByExample.get(exampleId), boundary.selected_candidate_id);
  const d262Top = candidateScore(d262ByExample.get(exampleId), d262.selected_candidate_id);
  const boundaryScoreForD262Top = candidateScore(boundaryByExample.get(exampleId), d262.selected_candidate_id);
  const d262GapAgainstBoundaryTop = (d262Top?.score ?? 0) - (d262BoundaryCandidate?.score ?? 0);
  const boundaryAdvantageForBoundaryTop = (boundaryTop?.score ?? 0) - (boundaryScoreForD262Top?.score ?? 0);
  const alphaNeeded = boundaryAdvantageForBoundaryTop > 0
    ? d262GapAgainstBoundaryTop / boundaryAdvantageForBoundaryTop
    : null;
  return {
    example_id: exampleId,
    d262,
    boundary,
    hybrid,
    category: categoryFor(d262, boundary, hybrid),
    d262_selected_score: d262Top?.score ?? null,
    boundary_selected_score_under_d262: d262BoundaryCandidate?.score ?? null,
    d262_gap_against_boundary_selected: round(d262GapAgainstBoundaryTop),
    boundary_selected_score: boundaryTop?.score ?? null,
    d262_selected_score_under_boundary: boundaryScoreForD262Top?.score ?? null,
    boundary_advantage_for_boundary_selected: round(boundaryAdvantageForBoundaryTop),
    hybrid_alpha_needed_to_match_boundary_selection: round(alphaNeeded),
  };
}

function alphaTradeoffGrid(alphas) {
  const d262ExistingByPair = new Map(d262ExistingPairs.map((row) => [row.pair_id, row]));
  const boundaryExistingByPair = new Map(boundaryExistingPairs.map((row) => [row.pair_id, row]));
  return alphas.map((alpha) => {
    const existingRows = d262ExistingPairs.map((row) => {
      const margin = Number(row.margin ?? 0) + alpha * Number(boundaryExistingByPair.get(row.pair_id)?.margin ?? 0);
      return { pair_id: row.pair_id, correct: margin >= 0, margin };
    });
    const finalSelections = d262Selections.map((selection) => combinedSelection(selection.example_id, alpha));
    return {
      alpha_boundary_weight: alpha,
      existing_validation_pairs: existingRows.length,
      existing_validation_correct: existingRows.filter((row) => row.correct).length,
      existing_validation_accuracy: rate(existingRows.filter((row) => row.correct).length, existingRows.length),
      final_examples: finalSelections.length,
      final_selected_supported: finalSelections.filter((row) => row.selected_supported_answer).length,
      final_selection_support_rate: rate(finalSelections.filter((row) => row.selected_supported_answer).length, finalSelections.length),
      final_selected_example_ids: finalSelections.filter((row) => row.selected_supported_answer).map((row) => row.example_id),
    };
  });
}

function combinedSelection(exampleId, alpha) {
  const d262 = d262ByExample.get(exampleId);
  const boundary = boundaryByExample.get(exampleId);
  const boundaryScores = new Map((boundary?.ranked_candidates ?? []).map((row) => [row.candidate_id, Number(row.score ?? 0)]));
  const ranked = (d262?.ranked_candidates ?? []).map((candidate) => ({
    ...candidate,
    score: Number(candidate.score ?? 0) + alpha * Number(boundaryScores.get(candidate.candidate_id) ?? 0),
  })).sort((left, right) => right.score - left.score);
  return {
    example_id: exampleId,
    selected_candidate_id: ranked[0]?.candidate_id ?? null,
    selected_supported_answer: ranked[0]?.supported_answer ?? false,
  };
}

function summarizeSelection(selection) {
  return {
    selected_candidate_id: selection?.selected_candidate_id ?? null,
    selected_supported_answer: Boolean(selection?.selected_supported_answer),
    selected_score: round(selection?.selected_score),
    selected_family: selection?.selected_family ?? null,
  };
}

function candidateScore(selection, candidateId) {
  return (selection?.ranked_candidates ?? []).find((row) => row.candidate_id === candidateId) ?? null;
}

function categoryFor(d262, boundary, hybrid) {
  if (!d262.selected_supported_answer && boundary.selected_supported_answer && hybrid.selected_supported_answer) return "boundary_rescue_preserved_by_hybrid";
  if (!d262.selected_supported_answer && boundary.selected_supported_answer && !hybrid.selected_supported_answer) return "boundary_rescue_lost_by_hybrid";
  if (d262.selected_supported_answer && !boundary.selected_supported_answer) return "boundary_regression";
  if (d262.selected_supported_answer && boundary.selected_supported_answer) return "both_success";
  return "shared_failure";
}

function findingsFor(lostRescues, alphaGrid, selectedAlpha) {
  if (!lostRescues.length) return ["The selected hybrid preserves all boundary-only final rescues."];
  const minAlpha = min(lostRescues.map((row) => row.hybrid_alpha_needed_to_match_boundary_selection).filter(Number.isFinite));
  const nearest = alphaGrid.find((row) => row.alpha_boundary_weight >= minAlpha);
  return [
    `The selected hybrid alpha ${selectedAlpha} is below the minimum alpha ${round(minAlpha)} needed to recover the lost boundary-only final rescue.`,
    nearest
      ? `At alpha ${nearest.alpha_boundary_weight}, diagnostic final selection reaches ${nearest.final_selected_supported}/8 while existing validation is ${nearest.existing_validation_correct}/24.`
      : "The provided alpha grid never reaches the lost-rescue threshold.",
    "The boundary-only rescue is not a small calibration effect; it requires overriding a large D262 margin on a final diagnostic example.",
  ];
}

function decisionFor(lostRescues, alphaGrid, selectedAlpha) {
  if (!lostRescues.length) {
    return {
      integrate_boundary_gate_now: true,
      buy_more_openai_labels_now: false,
      launch_gpu_now: false,
      reason: "The validation-preserving hybrid keeps the boundary-only final rescue.",
      next_step: "Promote the hybrid and audit remaining misses.",
    };
  }
  return {
    integrate_boundary_gate_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    reason: `Recovering the lost boundary-only rescue requires alpha about ${round(min(lostRescues.map((row) => row.hybrid_alpha_needed_to_match_boundary_selection).filter(Number.isFinite)))} versus selected alpha ${selectedAlpha}, so this is not a safe small-weight hybrid.`,
    next_step: "Keep D262 as active baseline and audit the lost-rescue example as a possible answer-generation/ranking margin problem rather than buying more broad labels.",
  };
}

function renderReport(result, lostRescues, alphaGrid) {
  return `# Boundary Hybrid Tradeoff Audit

Generated: ${result.generated_at}

This is a zero-call diagnostic audit. It uses final-window labels only to explain D272 after the non-final policy was selected; no final labels are used for training or tuning.

| D262 | Boundary-only | Selected hybrid | Lost boundary rescues |
| ---: | ---: | ---: | ---: |
| ${result.summary.d262_selected_supported}/8 | ${result.summary.boundary_only_selected_supported}/8 | ${result.summary.selected_hybrid_selected_supported}/8 | ${result.summary.boundary_rescues_lost_by_selected_hybrid} |

## Lost Rescues

${lostRescues.map((row) => `- ${row.example_id}: alpha needed ${row.hybrid_alpha_needed_to_match_boundary_selection}, D262 gap ${row.d262_gap_against_boundary_selected}, boundary advantage ${row.boundary_advantage_for_boundary_selected}`).join("\n") || "- None"}

## Alpha Grid

${alphaGrid.map((row) => `- alpha ${row.alpha_boundary_weight}: existing ${row.existing_validation_correct}/24, final ${row.final_selected_supported}/8`).join("\n")}

## Decision

- Integrate boundary gate now: ${result.decision.integrate_boundary_gate_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function countSupported(rows) {
  return rows.filter((row) => row.selected_supported_answer).length;
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
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

function rel(file) {
  return path.relative(rootDir, file);
}

function min(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.min(...finite) : null;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function round(value, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}
