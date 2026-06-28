import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "balanced-support-verifier-packet-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const broadPacketRunId = args["broad-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const targetedPacketRunId = args["targeted-packet"] ?? "targeted-miss-aware-selector-audit-0-320-to-321-389-2026-06-28-v1";
const validationWindow = "nonfinal-contrast-source-inventory-240-320-2026-06-28-v1";

const featureNames = [
  "log_answer_tokens",
  "log_claim_count",
  "log_citation_count",
  "inline_citation_complete",
  "answer_question_overlap",
  "answer_evidence_overlap",
  "claim_answer_overlap",
  "same_citation_shape_score",
  "abstention_phrase",
  "jsonish_answer",
  "qwen_family",
  "openai_family",
];

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const broadTrain = (await readJsonl(path.join(runsDir, broadPacketRunId, "train_pairwise.jsonl"))).map((row) => normalizePair(row, "broad_preservation_train", 1));
const broadValidation = (await readJsonl(path.join(runsDir, broadPacketRunId, "validation_pairwise.jsonl"))).map((row) => normalizePair(row, "broad_preservation_validation", 1));
const finalDiagnostic = (await readJsonl(path.join(runsDir, broadPacketRunId, "diagnostic_frontier_pairwise.jsonl"))).map((row) => normalizePair(row, "final_diagnostic_only", 1));
const targetedRows = await readJsonl(path.join(runsDir, targetedPacketRunId, "targeted_train_contrast_packet.jsonl"));
const targetedTrain = targetedRows
  .filter((row) => row.source_inventory_run_id !== validationWindow)
  .map((row) => normalizePair(row, "targeted_hard_negative_train", 1.5));
const targetedValidation = targetedRows
  .filter((row) => row.source_inventory_run_id === validationWindow)
  .map((row) => normalizePair(row, "targeted_hard_negative_validation", 1.5));

const trainRows = dedupePairs([...broadTrain, ...targetedTrain]);
const validationRows = dedupePairs([...broadValidation, ...targetedValidation]);
const trainExamples = trainRows.map(pairToTrainingExample);
const validationExamples = validationRows.map(pairToTrainingExample);
const scaler = fitScaler(trainExamples.map((row) => row.delta));
const model = trainPairwiseLogistic(trainExamples.map((row) => ({ x: scaleVector(row.delta, scaler), weight: row.weight })), {
  epochs: 900,
  learningRate: 0.08,
  l2: 0.08,
});

const trainEval = evaluatePairwise("train_balanced_nonfinal", trainExamples, model, scaler);
const validationEval = evaluatePairwise("validation_balanced_nonfinal", validationExamples, model, scaler);
const broadValidationEval = evaluatePairwise("validation_broad_only", validationExamples.filter((row) => row.source_type === "broad_preservation_validation"), model, scaler);
const targetedValidationEval = evaluatePairwise("validation_targeted_only", validationExamples.filter((row) => row.source_type === "targeted_hard_negative_validation"), model, scaler);
const finalExamples = finalDiagnostic.map(pairToTrainingExample);
const finalPairwiseEval = evaluatePairwise("final_diagnostic_pairwise", finalExamples, model, scaler);
const finalSelection = evaluateFinalSelection(finalDiagnostic, model, scaler);

const status = deriveStatus(validationEval, finalSelection);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "balanced_support_verifier_packet",
  status,
  purpose: "Combine broad support-preservation pairs with targeted overexpansion/same-citation hard negatives, fit a zero-cost support verifier, and replay it on final diagnostic Qwen-frontier candidate selection.",
  source_runs: {
    broad_pairwise_packet: broadPacketRunId,
    targeted_hard_negative_packet: targetedPacketRunId,
  },
  packet: {
    train_pairs: trainRows.length,
    validation_pairs: validationRows.length,
    broad_train_pairs: broadTrain.length,
    broad_validation_pairs: broadValidation.length,
    targeted_train_pairs: targetedTrain.length,
    targeted_validation_pairs: targetedValidation.length,
    final_diagnostic_pairs: finalDiagnostic.length,
    train_examples: new Set(trainRows.map((row) => row.example_id)).size,
    validation_examples: new Set(validationRows.map((row) => row.example_id)).size,
    final_diagnostic_examples: new Set(finalDiagnostic.map((row) => row.example_id)).size,
  },
  training: {
    algorithm: "pairwise_logistic_balanced_support_verifier",
    feature_names: featureNames,
    targeted_pair_weight: 1.5,
    epochs: model.epochs,
    learning_rate: model.learningRate,
    l2: model.l2,
  },
  model: {
    weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
    scaler,
  },
  metrics: {
    train_pairwise: summarizePairEval(trainEval),
    validation_pairwise: summarizePairEval(validationEval),
    broad_validation_pairwise: summarizePairEval(broadValidationEval),
    targeted_validation_pairwise: summarizePairEval(targetedValidationEval),
    final_diagnostic_pairwise: summarizePairEval(finalPairwiseEval),
    final_diagnostic_selection: summarizeSelection(finalSelection),
  },
  decision: decisionFromStatus(status, validationEval, finalSelection),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_selection_correctness: true,
    final_diagnostic_training_use: "forbidden_diagnostic_only",
    train_sources: sortedUnique(trainRows.map((row) => row.source_type)),
    validation_sources: sortedUnique(validationRows.map((row) => row.source_type)),
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
    note: "This packet/probe reads existing judged artifacts only.",
  },
  artifacts: {
    train_pairs_jsonl: rel(path.join(outputDir, "train_pairs.jsonl")),
    validation_pairs_jsonl: rel(path.join(outputDir, "validation_pairs.jsonl")),
    final_selection_jsonl: rel(path.join(outputDir, "final_diagnostic_selections.jsonl")),
    pair_predictions_jsonl: rel(path.join(outputDir, "pair_predictions.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "train_pairs.jsonl"), trainRows);
await writeJsonl(path.join(outputDir, "validation_pairs.jsonl"), validationRows);
await writeJsonl(path.join(outputDir, "final_diagnostic_selections.jsonl"), finalSelection.selections);
await writeJsonl(path.join(outputDir, "pair_predictions.jsonl"), [
  ...trainEval.rows,
  ...validationEval.rows,
  ...finalPairwiseEval.rows,
]);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  status,
  packet: result.packet,
  metrics: result.metrics,
  decision: result.decision,
}, null, 2));

function normalizePair(row, sourceType, weight) {
  return {
    pair_id: row.pair_id,
    example_id: row.example_id,
    split: row.split,
    source_type: sourceType,
    source_inventory_run_id: row.source_inventory_run_id ?? row.window ?? row.source ?? null,
    training_use: sourceType === "final_diagnostic_only" ? "forbidden_diagnostic_only" : "allowed_nonfinal_balanced_support_verifier",
    weight,
    input: row.input,
    chosen: row.chosen,
    rejected: row.rejected,
  };
}

function dedupePairs(rows) {
  const seen = new Set();
  const deduped = [];
  for (const row of rows) {
    const key = `${row.pair_id}:${row.source_type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

function pairToTrainingExample(pair) {
  const chosenFeatures = candidateFeatures(pair.input, pair.chosen);
  const rejectedFeatures = candidateFeatures(pair.input, pair.rejected);
  return {
    pair_id: pair.pair_id,
    example_id: pair.example_id,
    source_type: pair.source_type,
    weight: pair.weight,
    chosen_id: pair.chosen.id,
    rejected_id: pair.rejected.id,
    chosen_features: chosenFeatures,
    rejected_features: rejectedFeatures,
    delta: featureNames.map((name) => chosenFeatures[name] - rejectedFeatures[name]),
  };
}

function candidateFeatures(input, candidate) {
  const answer = String(candidate.answer ?? "");
  const claimText = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? claim.text ?? claim)).join(" ");
  const citations = candidate.citations ?? [];
  const answerTokens = contentTokens(answer);
  const claimTokens = contentTokens(claimText);
  const evidenceText = (input?.compact_retrieved_evidence_pack ?? [])
    .filter((item) => !citations.length || citations.includes(item.evidence_id))
    .map((item) => item.text)
    .join(" ");
  const questionTokens = new Set(contentTokens(input?.question ?? ""));
  const evidenceTokens = new Set(contentTokens(evidenceText || (input?.compact_retrieved_evidence_pack ?? []).map((item) => item.text).join(" ")));
  const answerSet = new Set(answerTokens);
  const claimSet = new Set(claimTokens);
  return {
    log_answer_tokens: Math.log1p(answerTokens.length),
    log_claim_count: Math.log1p((candidate.claim_table ?? []).length),
    log_citation_count: Math.log1p(citations.length),
    inline_citation_complete: citations.length && citations.every((id) => answer.includes(`[${id}]`)) ? 1 : 0,
    answer_question_overlap: overlapRate(answerSet, questionTokens),
    answer_evidence_overlap: overlapRate(answerSet, evidenceTokens),
    claim_answer_overlap: overlapRate(claimSet, answerSet),
    same_citation_shape_score: shapeScore(candidate),
    abstention_phrase: /\b(insufficient|not reported|not enough|cannot determine|not specified|no evidence)\b/i.test(answer) ? 1 : 0,
    jsonish_answer: /^\s*[{[]/.test(answer) ? 1 : 0,
    qwen_family: /qwen/i.test(String(candidate.family ?? candidate.id ?? candidate.prediction_run_id ?? "")) ? 1 : 0,
    openai_family: /openai|mini|gpt/i.test(String(candidate.family ?? candidate.id ?? candidate.prediction_run_id ?? "")) ? 1 : 0,
  };
}

function shapeScore(candidate) {
  const tokens = contentTokens(candidate.answer);
  const claims = candidate.claim_table ?? [];
  const citations = candidate.citations ?? [];
  let score = 0;
  if (tokens.length > 0) score += 1;
  if (citations.length > 0) score += 1;
  if (citations.every((id) => String(candidate.answer ?? "").includes(`[${id}]`))) score += 1;
  if (claims.length > 0 && claims.length <= 2) score += 1;
  if (tokens.length <= 24) score += 1;
  if (tokens.length > 64) score -= 1;
  if (claims.length > 3) score -= 1;
  return score;
}

function trainPairwiseLogistic(rows, options) {
  const weights = Array(featureNames.length).fill(0);
  const { epochs, learningRate, l2 } = options;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / Math.sqrt(1 + epoch / 60);
    for (const row of rows) {
      const margin = dot(weights, row.x);
      const gradientScale = -sigmoid(-margin) * row.weight;
      for (let index = 0; index < weights.length; index += 1) {
        weights[index] -= rate * (gradientScale * row.x[index] + l2 * weights[index]);
      }
    }
  }
  return { weights, epochs, learningRate, l2 };
}

function evaluatePairwise(split, rows, model, scaler) {
  const predictions = rows.map((row) => {
    const margin = scoreDelta(row.delta, model, scaler);
    return {
      split,
      source_type: row.source_type,
      pair_id: row.pair_id,
      example_id: row.example_id,
      chosen_id: row.chosen_id,
      rejected_id: row.rejected_id,
      margin,
      predicted_chosen: margin >= 0,
      correct: margin >= 0,
    };
  });
  const correct = predictions.filter((row) => row.correct).length;
  return {
    split,
    pairs: predictions.length,
    correct,
    accuracy: rate(correct, predictions.length),
    mean_margin: mean(predictions.map((row) => row.margin)),
    rows: predictions,
  };
}

function evaluateFinalSelection(pairs, model, scaler) {
  const byExample = new Map();
  for (const pair of pairs) {
    const bucket = byExample.get(pair.example_id) ?? new Map();
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const existing = bucket.get(candidate.id);
      if (existing) {
        existing.supported_answer = existing.supported_answer || role === "chosen";
        existing.seen_in_pairs += 1;
        continue;
      }
      const features = candidateFeatures(pair.input, candidate);
      bucket.set(candidate.id, {
        example_id: pair.example_id,
        candidate_id: candidate.id,
        family: candidate.family ?? "unknown",
        supported_answer: role === "chosen",
        score: scoreFeatures(features, model, scaler),
        features,
        answer: candidate.answer,
        citations: candidate.citations ?? [],
        seen_in_pairs: 1,
      });
    }
    byExample.set(pair.example_id, bucket);
  }
  const selections = [...byExample.entries()].map(([exampleId, bucket]) => {
    const ranked = [...bucket.values()].sort((left, right) => right.score - left.score || left.candidate_id.localeCompare(right.candidate_id));
    const selected = ranked[0];
    return {
      example_id: exampleId,
      selected_candidate_id: selected.candidate_id,
      selected_family: selected.family,
      selected_supported_answer: selected.supported_answer,
      selected_score: selected.score,
      candidate_count: ranked.length,
      supported_candidate_count: ranked.filter((row) => row.supported_answer).length,
      unsupported_candidate_count: ranked.filter((row) => !row.supported_answer).length,
      ranked_candidates: ranked.map((row) => ({
        candidate_id: row.candidate_id,
        family: row.family,
        supported_answer: row.supported_answer,
        score: row.score,
        seen_in_pairs: row.seen_in_pairs,
      })),
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
  return {
    examples: selections.length,
    selected_supported: selections.filter((row) => row.selected_supported_answer).length,
    selected_unsupported: selections.filter((row) => !row.selected_supported_answer).length,
    examples_with_supported_candidate: selections.filter((row) => row.supported_candidate_count > 0).length,
    selection_support_rate: rate(selections.filter((row) => row.selected_supported_answer).length, selections.length),
    selections,
  };
}

function deriveStatus(validationEval, finalSelection) {
  if (validationEval.accuracy >= 0.75 && finalSelection.selection_support_rate >= 0.75) return "balanced_support_verifier_promising";
  if (validationEval.accuracy < 0.55 && finalSelection.selection_support_rate >= 0.75) return "balanced_support_verifier_final_signal_validation_conflict";
  if (validationEval.accuracy >= 0.75 && finalSelection.selection_support_rate > 0.625) return "balanced_support_verifier_partial_final_gain";
  if (validationEval.accuracy >= 0.75) return "balanced_support_verifier_validates_but_not_final";
  return "balanced_support_verifier_not_ready";
}

function decisionFromStatus(status, validationEval, finalSelection) {
  const promising = status === "balanced_support_verifier_promising";
  return {
    integrate_selector_now: false,
    launch_gpu_now: false,
    buy_openai_labels_now: false,
    train_verifier_on_gpu_next: promising,
    reason: promising
      ? "The balanced verifier clears non-final validation and final diagnostic thresholds, but needs a separate integration run before promotion."
      : status === "balanced_support_verifier_final_signal_validation_conflict"
      ? `The balanced verifier reaches ${(finalSelection.selection_support_rate * 100).toFixed(1)}% final diagnostic selection support, but only ${(validationEval.accuracy * 100).toFixed(1)}% validation pairwise accuracy; this is a final-like signal, not a deployable selector.`
      : `The balanced verifier reaches ${(validationEval.accuracy * 100).toFixed(1)}% validation pairwise accuracy and ${(finalSelection.selection_support_rate * 100).toFixed(1)}% final diagnostic selection support, so it is not ready for GPU training or integration.`,
    next_step: promising
      ? "Run an integration audit against the mixed final selector and then consider a bounded GPU verifier run."
      : status === "balanced_support_verifier_final_signal_validation_conflict"
      ? "Audit the broad-preservation versus targeted-hard-negative conflict and build a stratified objective that preserves broad validation while retaining the final-like targeted signal."
      : "Keep the balanced packet as an eval/training slice; inspect misses and add stronger semantic support labels only if a zero-cost target cannot improve final transfer.",
  };
}

function fitScaler(vectors) {
  return featureNames.map((name, index) => {
    const values = vectors.map((vector) => vector[index]);
    const center = mean(values);
    const variance = mean(values.map((value) => (value - center) ** 2));
    return { name, center, scale: Math.sqrt(variance) || 1 };
  });
}

function scaleVector(vector, scaler) {
  return vector.map((value, index) => (value - scaler[index].center) / scaler[index].scale);
}

function scoreDelta(delta, model, scaler) {
  return dot(model.weights, scaleVector(delta, scaler));
}

function scoreFeatures(features, model, scaler) {
  const vector = featureNames.map((name) => features[name]);
  const centered = vector.map((value, index) => (value - scaler[index].center) / scaler[index].scale);
  return dot(model.weights, centered);
}

function summarizePairEval(evalResult) {
  return {
    pairs: evalResult.pairs,
    correct: evalResult.correct,
    accuracy: evalResult.accuracy,
    mean_margin: evalResult.mean_margin,
  };
}

function summarizeSelection(selection) {
  return {
    examples: selection.examples,
    selected_supported: selection.selected_supported,
    selected_unsupported: selection.selected_unsupported,
    selection_support_rate: selection.selection_support_rate,
    examples_with_supported_candidate: selection.examples_with_supported_candidate,
  };
}

function renderReport(result) {
  return `# Balanced Support Verifier Packet

This packet/probe combines broad preservation pairs with targeted overexpansion and same-citation hard negatives.

## Summary

- Status: ${result.status}
- Train pairs: ${result.packet.train_pairs}
- Validation pairs: ${result.packet.validation_pairs}
- Validation pairwise: ${pct(result.metrics.validation_pairwise.accuracy)}
- Final diagnostic pairwise: ${pct(result.metrics.final_diagnostic_pairwise.accuracy)}
- Final diagnostic selection: ${result.metrics.final_diagnostic_selection.selected_supported}/${result.metrics.final_diagnostic_selection.examples}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}

## Decision

${result.decision.reason}

Next step: ${result.decision.next_step}
`;
}

function contentTokens(text) {
  return String(text ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function overlapRate(left, right) {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / left.size;
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function mean(values) {
  const numbers = values.filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(Number(value ?? 0) * 100).toFixed(1)}%`;
}

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
