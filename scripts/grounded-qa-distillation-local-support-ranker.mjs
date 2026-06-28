import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const runId = args["run-id"] ?? "local-support-ranker-expanded-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const packetDir = path.join(runsDir, sourcePacketRunId);
const packet = await readJson(path.join(packetDir, "result.json"));
const trainPairs = await readJsonl(path.join(packetDir, "train_pairwise.jsonl"));
const validationPairs = await readJsonl(path.join(packetDir, "validation_pairwise.jsonl"));
const diagnosticPairs = await readJsonl(path.join(packetDir, "diagnostic_frontier_pairwise.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const featureNames = [...new Set(trainPairs.flatMap((row) => Object.keys(row.feature_delta ?? {})))].sort();
const trainVectors = trainPairs.map((row) => vectorFromDelta(row.feature_delta, featureNames));
const scaler = fitScaler(trainVectors);
const scaledTrain = trainVectors.map((vector) => scaleVector(vector, scaler));
const model = trainPairwiseLogistic(scaledTrain, { epochs: 240, learningRate: 0.12, l2: 0.02 });

const trainEval = evaluatePairs(trainPairs, model, scaler, featureNames);
const validationEval = evaluatePairs(validationPairs, model, scaler, featureNames);
const diagnosticEval = evaluatePairs(diagnosticPairs, model, scaler, featureNames);
const diagnosticSelections = selectDiagnosticCandidates(diagnosticPairs, model, scaler, featureNames);
const diagnosticSelectionMetrics = summarizeSelections(diagnosticSelections);

const status = deriveStatus(validationEval, diagnosticEval, diagnosticSelectionMetrics);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "local_support_ranker",
  status,
  source_packet: sourcePacketRunId,
  purpose: "Train a zero-cost local pairwise answer-support ranker from leakage-safe candidate pairs and evaluate final-window Qwen frontier rows only as diagnostics.",
  feature_names: featureNames,
  training: {
    algorithm: "standardized_pairwise_logistic_regression",
    epochs: model.epochs,
    learning_rate: model.learningRate,
    l2: model.l2,
    train_pairs: trainPairs.length,
    validation_pairs: validationPairs.length,
  },
  metrics: {
    train: summarizePairEval(trainEval),
    validation: summarizePairEval(validationEval),
    final_diagnostic_pairwise: summarizePairEval(diagnosticEval),
    final_diagnostic_selection: diagnosticSelectionMetrics,
  },
  model: {
    intercept: model.intercept,
    weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
    scaler,
  },
  decision: decisionFromMetrics(validationEval, diagnosticEval, diagnosticSelectionMetrics),
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This run trains a local linear ranker from existing packet features only.",
  },
};

await writeJsonl(path.join(outputDir, "validation_predictions.jsonl"), validationEval.rows);
await writeJsonl(path.join(outputDir, "diagnostic_pair_predictions.jsonl"), diagnosticEval.rows);
await writeJsonl(path.join(outputDir, "diagnostic_selections.jsonl"), diagnosticSelections);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  metrics: result.metrics,
  decision: result.decision,
}, null, 2));

function trainPairwiseLogistic(rows, options) {
  const weights = Array(featureNames.length).fill(0);
  const { epochs, learningRate, l2 } = options;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / Math.sqrt(1 + epoch / 30);
    for (const row of rows) {
      const margin = dot(weights, row);
      const gradientScale = sigmoid(-margin) * -1;
      for (let index = 0; index < weights.length; index += 1) {
        weights[index] -= rate * (gradientScale * row[index] + l2 * weights[index]);
      }
    }
  }
  return { weights, intercept: 0, epochs, learningRate, l2 };
}

function evaluatePairs(pairs, model, scaler, names) {
  const rows = pairs.map((row) => {
    const delta = vectorFromDelta(row.feature_delta, names);
    const margin = scoreDelta(delta, model, scaler);
    const predicted = margin >= 0 ? "chosen" : "rejected";
    return {
      pair_id: row.pair_id,
      example_id: row.example_id,
      split: row.split,
      window: row.window,
      predicted_preferred: predicted,
      correct: predicted === "chosen",
      margin,
      chosen_id: row.chosen.id,
      rejected_id: row.rejected.id,
      training_use: row.training_use,
    };
  });
  return {
    pairs: pairs.length,
    correct: rows.filter((row) => row.correct).length,
    accuracy: rows.length ? rows.filter((row) => row.correct).length / rows.length : 0,
    mean_margin: mean(rows.map((row) => row.margin)),
    rows,
  };
}

function selectDiagnosticCandidates(pairs, model, scaler, names) {
  const byExample = new Map();
  for (const pair of pairs) {
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const key = `${pair.example_id}:${candidate.id}`;
      if (byExample.get(pair.example_id)?.has(key)) continue;
      if (!byExample.has(pair.example_id)) byExample.set(pair.example_id, new Map());
      byExample.get(pair.example_id).set(key, {
        example_id: pair.example_id,
        candidate_id: candidate.id,
        family: candidate.family,
        role_seen_as: role,
        supported_answer: role === "chosen",
        answer: candidate.answer,
        citations: candidate.citations,
        score: scoreCandidate(candidate.features, model, scaler, names),
      });
    }
  }
  const selections = [];
  for (const [exampleId, candidates] of byExample) {
    const ranked = [...candidates.values()].sort((left, right) => right.score - left.score);
    selections.push({
      example_id: exampleId,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_family: ranked[0]?.family ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
      selected_score: ranked[0]?.score ?? null,
      candidate_count: ranked.length,
      supported_candidate_count: ranked.filter((row) => row.supported_answer).length,
      unsupported_candidate_count: ranked.filter((row) => !row.supported_answer).length,
      ranked_candidates: ranked.map((row) => ({
        candidate_id: row.candidate_id,
        family: row.family,
        supported_answer: row.supported_answer,
        score: row.score,
      })),
    });
  }
  return selections.sort((left, right) => left.example_id.localeCompare(right.example_id));
}

function summarizeSelections(rows) {
  return {
    examples: rows.length,
    selected_supported: rows.filter((row) => row.selected_supported_answer).length,
    selected_unsupported: rows.filter((row) => !row.selected_supported_answer).length,
    selection_support_rate: rows.length ? rows.filter((row) => row.selected_supported_answer).length / rows.length : 0,
    examples_with_supported_candidate: rows.filter((row) => row.supported_candidate_count > 0).length,
  };
}

function summarizePairEval(evalResult) {
  return {
    pairs: evalResult.pairs,
    correct: evalResult.correct,
    accuracy: evalResult.accuracy,
    mean_margin: evalResult.mean_margin,
  };
}

function deriveStatus(validationEval, diagnosticEval, diagnosticSelectionMetrics) {
  if (validationEval.accuracy >= 0.75 && diagnosticSelectionMetrics.selection_support_rate >= 0.7) {
    return "ranker_promising_for_selector_integration";
  }
  if (validationEval.accuracy >= 0.75) return "ranker_transfers_to_validation_but_not_final_frontier";
  return "ranker_not_reliable";
}

function decisionFromMetrics(validationEval, diagnosticEval, diagnosticSelectionMetrics) {
  if (validationEval.accuracy < 0.75) {
    return {
      integrate_selector_now: false,
      launch_gpu_now: false,
      reason: "The local ranker does not reach 75% validation pairwise accuracy, so it is not reliable enough to control answer selection.",
      next_step: "Increase non-final pair diversity and add entailment-specific features before another model or GPU run.",
    };
  }
  if (diagnosticSelectionMetrics.selection_support_rate < 0.7) {
    return {
      integrate_selector_now: false,
      launch_gpu_now: false,
      reason: "The ranker fits non-final validation pairs but fails on the final Qwen switch frontier where semantic support selection matters most.",
      next_step: "Add frontier-like non-final Qwen candidate pairs or stronger entailment features before spending GPU budget.",
    };
  }
  return {
    integrate_selector_now: true,
    launch_gpu_now: false,
    reason: "The ranker clears validation and final diagnostic support thresholds; integrate it as a selector diagnostic before any new generation run.",
    next_step: "Run a zero-cost selector integration audit against the calibrated hybrid.",
  };
}

function scoreDelta(delta, model, scaler) {
  return dot(model.weights, scaleVector(delta, scaler));
}

function scoreCandidate(features, model, scaler, names) {
  const vector = names.map((name) => Number(features?.[name] ?? 0));
  return dot(model.weights, scaleVector(vector, scaler));
}

function vectorFromDelta(delta, names) {
  return names.map((name) => Number(delta?.[name] ?? 0));
}

function fitScaler(vectors) {
  const stdValues = [];
  for (let index = 0; index < featureNames.length; index += 1) {
    const values = vectors.map((vector) => vector[index]);
    const center = mean(values);
    const variance = mean(values.map((value) => (value - center) ** 2));
    stdValues.push(Math.sqrt(variance) || 1);
  }
  return {
    mean: Object.fromEntries(featureNames.map((name) => [name, 0])),
    std: Object.fromEntries(featureNames.map((name, index) => [name, stdValues[index]])),
  };
}

function scaleVector(vector, scaler) {
  return vector.map((value, index) => {
    const name = featureNames[index];
    return (value - Number(scaler.mean[name] ?? 0)) / Number(scaler.std[name] || 1);
  });
}

function renderReport(result) {
  return `# Local Support Ranker

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no compute.

## Metrics

| Split | Pairs/examples | Correct/supported | Rate |
| --- | ---: | ---: | ---: |
| Train pairwise | ${result.metrics.train.pairs} | ${result.metrics.train.correct} | ${formatPct(result.metrics.train.accuracy)} |
| Validation pairwise | ${result.metrics.validation.pairs} | ${result.metrics.validation.correct} | ${formatPct(result.metrics.validation.accuracy)} |
| Final diagnostic pairwise | ${result.metrics.final_diagnostic_pairwise.pairs} | ${result.metrics.final_diagnostic_pairwise.correct} | ${formatPct(result.metrics.final_diagnostic_pairwise.accuracy)} |
| Final diagnostic selection | ${result.metrics.final_diagnostic_selection.examples} | ${result.metrics.final_diagnostic_selection.selected_supported} | ${formatPct(result.metrics.final_diagnostic_selection.selection_support_rate)} |

## Decision

- Integrate selector now: ${result.decision.integrate_selector_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function sigmoid(value) {
  if (value < -40) return 0;
  if (value > 40) return 1;
  return 1 / (1 + Math.exp(-value));
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatPct(value) {
  return `${(100 * value).toFixed(1)}%`;
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
