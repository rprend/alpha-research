import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const predictionRunId = args["prediction-run-id"] ?? "joint-action-qwen3b-smoke-eval-v1";
const judgeRunId = args["judge-run-id"] ?? "openai-judge-gpt4o-joint-action-qwen3b-smoke-eval-v1";
const frontierRunId = args["frontier-run-id"] ?? "coverage-constrained-support-frontier-2026-06-26-v1";
const paretoRunId = args["pareto-run-id"] ?? "cost-coverage-support-pareto-2026-06-26-v1";
const selectorRunId = args["selector-run-id"] ?? "candidate-selector-cross-window-240-320-to-321-389-v1";
const runId = args["run-id"] ?? "qwen3b-result-integration-joint-action-smoke-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const frontier = await readResult(frontierRunId);
const pareto = await readResult(paretoRunId);
const selector = await readResult(selectorRunId);
const predictionResult = await readResultIfPresent(predictionRunId);
const judgeResult = await readResultIfPresent(judgeRunId);
const predictionArtifacts = await artifactStatus(predictionRunId, ["predictions.jsonl", "result.json", "report.md", "smoke_manifest.json"]);
const judgeArtifacts = await artifactStatus(judgeRunId, ["judgments.jsonl", "result.json"]);

const directBaseline = frontier.qwen3b_acceptance_target.direct_baseline;
const seventyPoint = frontier.coverage_constrained_operating_points.find((row) => Number(row.min_answer_rate) === 0.7)?.selected ?? null;
const selectorBaseline = selector.selected_rule_metrics.eval;
const qwenMetrics = extractQwenMetrics({ predictionResult, judgeResult });
const comparison = qwenMetrics ? compareToTargets(qwenMetrics, directBaseline, selectorBaseline, seventyPoint) : null;
const qwenSystemRow = qwenMetrics ? {
  id: "qwen3b_joint_action_smoke",
  family: "local_or_remote_qwen3b_joint_action_lora",
  source_run_id: predictionRunId,
  judge_run_id: judgeRunId,
  examples: qwenMetrics.examples,
  answered: qwenMetrics.answered,
  answer_rate: qwenMetrics.answer_rate,
  answer_support_rate: qwenMetrics.answer_support_rate,
  abstention_support_rate: qwenMetrics.abstention_support_rate,
  overall_judged_correct_rate: qwenMetrics.overall_judged_correct_rate,
  citation_recall: qwenMetrics.citation_recall,
  answer_token_f1: qwenMetrics.answer_token_f1,
  online_openai_calls_per_query: 0,
  marginal_scaffold_calls_per_query: 0,
  historical_judge_cost_usd: Number(judgeResult.run_cost_usd ?? 0),
  cost_class: "trained_small_model_or_adapter",
  interpretation: comparison.meets_minimum_acceptance
    ? "Qwen 3B joint-action smoke meets the minimum support-preserving distillation target."
    : "Qwen 3B joint-action smoke does not meet the minimum support-preserving distillation target.",
} : null;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen3b_result_integration",
  status: deriveStatus({ predictionArtifacts, judgeArtifacts, qwenMetrics, comparison }),
  purpose: "Fail-closed integration gate for the final Qwen 3B joint-action result: ingest prediction and paid judge artifacts, compare against direct and 70% coverage-constrained baselines, and produce the row that should be added to the Pareto table.",
  prediction_run_id: predictionRunId,
  judge_run_id: judgeRunId,
  source_artifacts: {
    frontier_run_id: frontier.run_id,
    pareto_run_id: pareto.run_id,
    selector_run_id: selector.run_id,
  },
  artifact_status: {
    prediction: predictionArtifacts,
    judge: judgeArtifacts,
  },
  baseline_targets: {
    direct_baseline: directBaseline,
    deployable_selector_baseline: selectorBaseline,
    seventy_percent_frontier: seventyPoint,
    minimum_acceptance: "answer_rate >= 0.70, answer_support_rate > max(direct baseline, deployable selector baseline), and overall_judged_correct_rate > max(direct baseline, deployable selector baseline). Also report deltas to the 70% frontier; beating it is a stronger result, not silently assumed.",
  },
  qwen_metrics: qwenMetrics,
  target_comparison: comparison,
  pareto_row_to_add: qwenSystemRow,
  pareto_update_instruction: qwenSystemRow
    ? "Add pareto_row_to_add to cost-coverage-support-pareto and recompute the Pareto frontier."
    : "Waiting for Qwen predictions and paid judge before adding a Pareto row.",
  required_next_steps: nextSteps({ predictionArtifacts, judgeArtifacts, qwenMetrics, comparison }),
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    external_compute_actual_usd: budget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This integration script reads existing prediction/judge artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  prediction_artifacts_complete: predictionArtifacts.complete,
  judge_artifacts_complete: judgeArtifacts.complete,
  qwen_metrics_present: Boolean(qwenMetrics),
}, null, 2));

function extractQwenMetrics({ predictionResult, judgeResult }) {
  if (!predictionResult || !judgeResult || Number(judgeResult.calls_made ?? 0) <= 0) return null;
  const judged = Number(judgeResult.metrics?.examples_judged ?? 0);
  if (judged <= 0) return null;
  const answered = Number(judgeResult.metrics?.answered_predictions ?? predictionResult.eval?.answered ?? 0);
  const abstained = Number(judgeResult.metrics?.abstained_predictions ?? predictionResult.eval?.abstained ?? 0);
  return {
    examples: judged,
    answered,
    abstained,
    answer_rate: judged ? answered / judged : 0,
    answer_support_rate: Number(judgeResult.metrics?.answer_support_rate ?? 0),
    abstention_support_rate: Number(judgeResult.metrics?.abstention_support_rate ?? 0),
    overall_judged_correct_rate: Number(judgeResult.metrics?.overall_judged_correct_rate ?? 0),
    invalid_judgment_rate: Number(judgeResult.metrics?.invalid_judgment_rate ?? 0),
    citation_precision: nullableNumber(predictionResult.eval?.citation_precision),
    citation_recall: nullableNumber(predictionResult.eval?.citation_recall),
    answer_token_f1: nullableNumber(predictionResult.eval?.answer_token_f1),
    inline_citation_rate: nullableNumber(predictionResult.eval?.inline_citation_rate),
    judge_cost_usd: Number(judgeResult.run_cost_usd ?? 0),
  };
}

function compareToTargets(qwen, direct, selectorBaseline, seventy) {
  const directDeltas = {
    answer_rate: qwen.answer_rate - Number(direct.answer_rate),
    answer_support_rate: qwen.answer_support_rate - Number(direct.answer_support_rate),
    overall_judged_correct_rate: qwen.overall_judged_correct_rate - Number(direct.overall_judged_correct_rate),
  };
  const selectorDeltas = {
    answer_rate: qwen.answer_rate - Number(selectorBaseline.answer_rate),
    answer_support_rate: qwen.answer_support_rate - Number(selectorBaseline.answer_support_rate),
    overall_judged_correct_rate: qwen.overall_judged_correct_rate - Number(selectorBaseline.overall_judged_correct_rate),
  };
  const frontierDeltas = seventy ? {
    answer_rate: qwen.answer_rate - Number(seventy.answer_rate),
    answer_support_rate: qwen.answer_support_rate - Number(seventy.answer_support_rate),
    overall_judged_correct_rate: qwen.overall_judged_correct_rate - Number(seventy.overall_judged_correct_rate),
  } : null;
  const minimumAnswerSupportTarget = Math.max(Number(direct.answer_support_rate), Number(selectorBaseline.answer_support_rate));
  const minimumCorrectnessTarget = Math.max(Number(direct.overall_judged_correct_rate), Number(selectorBaseline.overall_judged_correct_rate));
  const meetsMinimum = qwen.answer_rate >= 0.7
    && qwen.answer_support_rate > minimumAnswerSupportTarget
    && qwen.overall_judged_correct_rate > minimumCorrectnessTarget;
  const beatsSeventyFrontier = Boolean(seventy)
    && qwen.answer_rate >= Number(seventy.answer_rate)
    && qwen.answer_support_rate > Number(seventy.answer_support_rate)
    && qwen.overall_judged_correct_rate > Number(seventy.overall_judged_correct_rate);
  return {
    meets_minimum_acceptance: meetsMinimum,
    beats_70pct_frontier: beatsSeventyFrontier,
    minimum_targets: {
      answer_rate: 0.7,
      answer_support_rate_gt: minimumAnswerSupportTarget,
      overall_judged_correct_rate_gt: minimumCorrectnessTarget,
    },
    direct_baseline_deltas: directDeltas,
    deployable_selector_baseline_deltas: selectorDeltas,
    seventy_percent_frontier_deltas: frontierDeltas,
    interpretation: meetsMinimum
      ? (beatsSeventyFrontier ? "Strong positive: beats direct baseline, deployable selector baseline, and 70% frontier." : "Minimum positive: beats direct and deployable selector baselines at >=70% answer rate but does not beat the 70% frontier.")
      : "Negative or inconclusive: does not meet the minimum support-preserving target.",
  };
}

function deriveStatus({ predictionArtifacts, judgeArtifacts, qwenMetrics, comparison }) {
  if (!predictionArtifacts.complete) return "waiting_for_qwen3b_predictions";
  if (!judgeArtifacts.complete || !qwenMetrics) return "waiting_for_qwen3b_paid_judge";
  if (comparison.meets_minimum_acceptance && comparison.beats_70pct_frontier) return "qwen3b_strong_positive_ready_for_pareto_update";
  if (comparison.meets_minimum_acceptance) return "qwen3b_minimum_positive_ready_for_pareto_update";
  return "qwen3b_negative_ready_for_pareto_update";
}

function nextSteps({ predictionArtifacts, judgeArtifacts, qwenMetrics, comparison }) {
  if (!predictionArtifacts.complete) {
    return ["Run the bounded Qwen 3B smoke and fetch predictions/result/report/smoke manifest."];
  }
  if (!judgeArtifacts.complete || !qwenMetrics) {
    return ["Run prediction integrity, dry judge, then paid grounded-correctness judge for the Qwen predictions."];
  }
  const steps = ["Update cost-coverage-support Pareto with pareto_row_to_add and recompute the frontier."];
  if (!comparison.meets_minimum_acceptance) {
    steps.push("Treat the Qwen smoke as a negative result; analyze failure modes before claiming support-preserving distillation.");
  } else {
    steps.push("Regenerate readiness gate, manuscript evidence map, manuscript draft, reviewer-risk audit, and final novelty watchlist.");
  }
  return steps;
}

async function artifactStatus(runId, names) {
  const files = {};
  for (const name of names) {
    const file = path.join(runDir, runId, name);
    try {
      const stat = await fs.stat(file);
      files[name] = { exists: true, path: path.relative(rootDir, file), bytes: stat.size };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      files[name] = { exists: false, path: path.relative(rootDir, file), bytes: 0 };
    }
  }
  return {
    run_id: runId,
    complete: Object.values(files).every((row) => row.exists),
    files,
  };
}

async function readResult(runId) {
  return readJson(path.join(runDir, runId, "result.json"));
}

async function readResultIfPresent(runId) {
  try {
    return await readResult(runId);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

function renderReport(result) {
  return `# Qwen 3B Result Integration

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Artifact Status

| Surface | Complete |
| --- | --- |
| Prediction run | ${result.artifact_status.prediction.complete ? "yes" : "no"} |
| Paid judge run | ${result.artifact_status.judge.complete ? "yes" : "no"} |

## Target

- Direct baseline answer support: ${pct(result.baseline_targets.direct_baseline.answer_support_rate)}
- Direct baseline overall judged correct: ${pct(result.baseline_targets.direct_baseline.overall_judged_correct_rate)}
- Deployable selector answer support: ${pct(result.baseline_targets.deployable_selector_baseline.answer_support_rate)}
- Deployable selector overall judged correct: ${pct(result.baseline_targets.deployable_selector_baseline.overall_judged_correct_rate)}
- 70% frontier answer support: ${pct(result.baseline_targets.seventy_percent_frontier?.answer_support_rate)}
- 70% frontier overall judged correct: ${pct(result.baseline_targets.seventy_percent_frontier?.overall_judged_correct_rate)}

## Qwen Metrics

${result.qwen_metrics ? `- Answer rate: ${pct(result.qwen_metrics.answer_rate)}
- Answer support: ${pct(result.qwen_metrics.answer_support_rate)}
- Abstention support: ${pct(result.qwen_metrics.abstention_support_rate)}
- Overall judged correct: ${pct(result.qwen_metrics.overall_judged_correct_rate)}
- Citation recall: ${pct(result.qwen_metrics.citation_recall)}` : "Qwen metrics are not available yet."}

## Required Next Steps

${result.required_next_steps.map((step) => `- ${step}`).join("\n")}

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
`;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
