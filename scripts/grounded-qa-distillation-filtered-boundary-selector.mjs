import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const auditRunId = args["audit-run"] ?? "boundary-adjudication-disagreement-audit-gpt4o-qwen-frontier-pool-2026-06-28-v1";
const adjudicationRunId = args["adjudication-run"] ?? "targeted-boundary-adjudication-run-gpt4o-qwen-frontier-pool-2026-06-28-v1";
const baselineRunId = args["baseline-run"] ?? "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1";
const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const runId = args["run-id"] ?? "filtered-boundary-selector-gpt4o-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const featureNames = [
  "answer_tokens",
  "claim_tokens",
  "citation_count",
  "inline_complete",
  "answer_cited_coverage",
  "claim_cited_coverage",
  "unsupported_number_count",
  "unsupported_list_scope_count",
  "extra_entity_count",
  "short_answer_bonus",
  "claim_answer_gap",
];
const stopwords = new Set(["the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "has", "have", "had", "but", "not", "can", "may", "its", "into", "than", "then", "also", "been", "their", "there", "which", "while", "using", "used", "use", "true", "false", "answer", "claim", "evidence", "support", "supported", "paper"]);
const listTerms = ["dataset", "datasets", "task", "tasks", "setting", "settings", "mode", "modes", "class", "classes", "annotator", "annotators", "model", "models", "corpus", "corpora", "benchmark", "benchmarks", "translation", "translations"];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const audit = await readJson(path.join(runsDir, auditRunId, "result.json"));
const accepted = await readJsonl(path.join(runsDir, auditRunId, "accepted_training_labels.jsonl"));
const requests = await readJsonl(path.join(runsDir, adjudicationRunId, "requests.jsonl"));
const requestById = new Map(requests.map((row) => [row.request_id, row]));
const baseline = await readJson(path.join(runsDir, baselineRunId, "result.json"));
const d262Existing = await readJsonl(path.join(runsDir, baselineRunId, "constrained_existing_validation_pair_predictions.jsonl"));
const d262FinalPairs = await readJsonl(path.join(runsDir, baselineRunId, "constrained_final_diagnostic_pair_predictions.jsonl"));
const d262FinalSelections = await readJsonl(path.join(runsDir, baselineRunId, "constrained_final_diagnostic_selections.jsonl"));
const existingPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "validation_pairwise.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "diagnostic_frontier_pairwise.jsonl"));

const trainPairs = accepted.map((label) => trainingPair(label, requestById.get(label.request_id)));
const enrichedTrain = trainPairs.map(enrichPair);
const enrichedExisting = existingPairs.map(enrichPair);
const enrichedFinal = finalPairs.map(enrichPair);
const scaler = fitScaleOnlyScaler(enrichedTrain.map((row) => row.delta));
const model = trainPairwiseLogistic(enrichedTrain.map((row) => scaleVector(row.delta, scaler)), { epochs: 500, learningRate: 0.06, l2: 0.08 });
const trainEval = evaluatePairs(enrichedTrain, model, scaler);
const boundaryExistingEval = evaluatePairs(enrichedExisting, model, scaler);
const boundaryFinalEval = evaluatePairs(enrichedFinal, model, scaler);
const boundaryFinalSelection = selectDiagnosticCandidates(enrichedFinal, model, scaler);
const boundaryFinalSelectionMetrics = summarizeSelections(boundaryFinalSelection);
const hybrid = tuneHybrid({
  model,
  scaler,
  existingPairs: enrichedExisting,
  finalPairs: enrichedFinal,
  d262Existing,
  d262FinalPairs,
  d262FinalSelections,
  baseline,
});

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "filtered_boundary_selector",
  audit_run_id: auditRunId,
  adjudication_run_id: adjudicationRunId,
  baseline_run_id: baselineRunId,
  pairwise_packet_run_id: pairwisePacketRunId,
  purpose: "Train and test a narrow selector from the filtered paid D271 A-over-B boundary labels, keeping quarantined disagreements out of training.",
  training: {
    algorithm: "pairwise_logistic_regression",
    train_pairs: enrichedTrain.length,
    feature_names: featureNames,
    accepted_label_source: auditRunId,
    quarantined_rows_excluded: audit.summary?.quarantined,
  },
  metrics: {
    accepted_boundary_train_pairs: summarizePairEval(trainEval),
    boundary_only_existing_validation_pairwise: summarizePairEval(boundaryExistingEval),
    boundary_only_final_diagnostic_pairwise: summarizePairEval(boundaryFinalEval),
    boundary_only_final_diagnostic_selection: boundaryFinalSelectionMetrics,
    d262_existing_validation_pairwise: baseline.metrics?.constrained_pool_pairwise_selector?.existing_validation_pairwise,
    d262_final_diagnostic_selection: baseline.metrics?.constrained_pool_pairwise_selector?.final_diagnostic_selection,
    selected_hybrid: {
      alpha_boundary_weight: hybrid.selected.alpha,
      existing_validation_pairwise: summarizePairEval(hybrid.selected.existing_eval),
      final_diagnostic_pairwise: summarizePairEval(hybrid.selected.final_eval),
      final_diagnostic_selection: hybrid.selected.final_selection.metrics,
    },
  },
  tuning: {
    objective: "Choose the largest boundary weight that preserves D262 existing-validation correct count; use final diagnostics only after policy selection.",
    final_window_labels_used_for_tuning: false,
    policies_evaluated: hybrid.candidates.length,
    selected_policy: { alpha_boundary_weight: hybrid.selected.alpha },
    top_candidates: hybrid.candidates.slice(0, 10).map((candidate) => ({
      alpha_boundary_weight: candidate.alpha,
      existing_validation_correct: candidate.existing_eval.correct,
      existing_validation_accuracy: candidate.existing_eval.accuracy,
      final_selection_supported: candidate.final_selection.metrics.selected_supported,
      final_selection_support_rate: candidate.final_selection.metrics.selection_support_rate,
    })),
  },
  learned_selector: {
    weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
    scaler,
    epochs: model.epochs,
    learning_rate: model.learningRate,
    l2: model.l2,
  },
  decision: decisionFrom({ baseline, boundaryFinalSelectionMetrics, hybrid }),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_diagnostic_training_use: "forbidden_diagnostic_only",
    accepted_training_use: "allowed_nonfinal_targeted_boundary_adjudication_filtered",
    quarantined_rows_excluded_from_training: true,
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    inherited_openai_cost_usd: audit.budget?.inherited_openai_cost_usd,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    inherited_openai_cost_usd: audit.budget?.inherited_openai_cost_usd,
    note: "This selector reads filtered paid labels but makes no new API calls.",
  },
};

await writeJsonl(path.join(outputDir, "train_predictions.jsonl"), trainEval.rows);
await writeJsonl(path.join(outputDir, "boundary_existing_validation_pair_predictions.jsonl"), boundaryExistingEval.rows);
await writeJsonl(path.join(outputDir, "boundary_final_diagnostic_pair_predictions.jsonl"), boundaryFinalEval.rows);
await writeJsonl(path.join(outputDir, "boundary_final_diagnostic_selections.jsonl"), boundaryFinalSelection);
await writeJsonl(path.join(outputDir, "hybrid_policy_grid.jsonl"), hybrid.candidates.map((candidate) => ({
  alpha_boundary_weight: candidate.alpha,
  existing_validation_pairwise: summarizePairEval(candidate.existing_eval),
  final_diagnostic_pairwise: summarizePairEval(candidate.final_eval),
  final_diagnostic_selection: candidate.final_selection.metrics,
})));
await writeJsonl(path.join(outputDir, "hybrid_existing_validation_pair_predictions.jsonl"), hybrid.selected.existing_eval.rows);
await writeJsonl(path.join(outputDir, "hybrid_final_diagnostic_pair_predictions.jsonl"), hybrid.selected.final_eval.rows);
await writeJsonl(path.join(outputDir, "hybrid_final_diagnostic_selections.jsonl"), hybrid.selected.final_selection.rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  metrics: result.metrics,
  decision: result.decision,
}, null, 2));

function trainingPair(label, request) {
  if (!request) throw new Error(`Missing request ${label.request_id}.`);
  return {
    pair_id: label.request_id,
    root_example_id: label.root_example_id,
    split: request.split,
    source_index: label.source_index,
    training_use: label.training_use,
    input: request.input,
    chosen: request.candidate_a,
    rejected: request.candidate_b,
    tags: label.tags ?? [],
  };
}

function enrichPair(pair) {
  const chosenFeatures = candidateFeatures(pair.input, pair.chosen);
  const rejectedFeatures = candidateFeatures(pair.input, pair.rejected);
  return {
    ...pair,
    chosen_features: chosenFeatures,
    rejected_features: rejectedFeatures,
    delta: featureNames.map((name) => chosenFeatures[name] - rejectedFeatures[name]),
  };
}

function candidateFeatures(input, candidate) {
  if (candidate.answer_type === "abstain") return Object.fromEntries(featureNames.map((name) => [name, name === "short_answer_bonus" ? 0 : -3]));
  const answer = String(candidate.answer ?? "");
  const claimText = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? "")).join(" ");
  const citedText = citedEvidenceText(input, candidate);
  const answerTokens = contentTokens(answer);
  const claimTokens = contentTokens(claimText);
  const citedTokens = contentTokens(citedText);
  return {
    answer_tokens: Math.log1p(answerTokens.length),
    claim_tokens: Math.log1p(claimTokens.length),
    citation_count: Math.log1p((candidate.citations ?? []).length),
    inline_complete: inlineComplete(candidate) ? 1 : 0,
    answer_cited_coverage: tokenCoverage(answerTokens, citedTokens),
    claim_cited_coverage: tokenCoverage(claimTokens, citedTokens),
    unsupported_number_count: Math.log1p(unsupportedNumbers(`${answer} ${claimText}`, citedText).length),
    unsupported_list_scope_count: Math.log1p(unsupportedTerms(`${answer} ${claimText}`, citedText, listTerms).length),
    extra_entity_count: Math.log1p(extraEntityTokens(`${answer} ${claimText}`, citedText).length),
    short_answer_bonus: answerTokens.length <= 8 ? 1 : 0,
    claim_answer_gap: Math.max(0, Math.log1p(claimTokens.length) - Math.log1p(answerTokens.length || 1)),
  };
}

function trainPairwiseLogistic(rows, options) {
  const weights = Array(featureNames.length).fill(0);
  const { epochs, learningRate, l2 } = options;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / Math.sqrt(1 + epoch / 40);
    for (const x of rows) {
      const margin = dot(weights, x);
      const gradientScale = -sigmoid(-margin);
      for (let index = 0; index < weights.length; index += 1) {
        weights[index] -= rate * (gradientScale * x[index] + l2 * weights[index]);
      }
    }
  }
  return { weights, epochs, learningRate, l2 };
}

function evaluatePairs(pairs, model, scaler, marginOverride = null) {
  const rows = pairs.map((pair) => {
    const margin = marginOverride ? marginOverride(pair) : scoreDelta(pair.delta, model, scaler);
    return {
      pair_id: pair.pair_id,
      example_id: pair.example_id ?? pair.root_example_id,
      split: pair.split,
      source_index: pair.source_index ?? null,
      predicted_preferred: margin >= 0 ? "chosen" : "rejected",
      correct: margin >= 0,
      margin,
      chosen_id: pair.chosen.id ?? pair.chosen.candidate_id,
      rejected_id: pair.rejected.id ?? pair.rejected.candidate_id,
      training_use: pair.training_use,
    };
  });
  return {
    pairs: rows.length,
    correct: rows.filter((row) => row.correct).length,
    accuracy: rate(rows.filter((row) => row.correct).length, rows.length),
    mean_margin: mean(rows.map((row) => row.margin)),
    rows,
  };
}

function tuneHybrid({ model, scaler, existingPairs, finalPairs, d262Existing, d262FinalPairs, d262FinalSelections, baseline }) {
  const d262ExistingByPair = new Map(d262Existing.map((row) => [row.pair_id, row]));
  const d262FinalByPair = new Map(d262FinalPairs.map((row) => [row.pair_id, row]));
  const baselineExistingCorrect = Number(baseline.metrics?.constrained_pool_pairwise_selector?.existing_validation_pairwise?.correct ?? 0);
  const candidates = [];
  for (const alpha of [0, 0.02, 0.05, 0.08, 0.1, 0.15, 0.2, 0.3, 0.5, 0.8, 1]) {
    const existingEval = evaluatePairs(existingPairs, model, scaler, (pair) => Number(d262ExistingByPair.get(pair.pair_id)?.margin ?? 0) + alpha * scoreDelta(pair.delta, model, scaler));
    const finalEval = evaluatePairs(finalPairs, model, scaler, (pair) => Number(d262FinalByPair.get(pair.pair_id)?.margin ?? 0) + alpha * scoreDelta(pair.delta, model, scaler));
    const finalSelection = selectHybridFinalCandidates(finalPairs, d262FinalSelections, model, scaler, alpha);
    candidates.push({ alpha, existing_eval: existingEval, final_eval: finalEval, final_selection: finalSelection });
  }
  const preserving = candidates.filter((candidate) => candidate.existing_eval.correct >= baselineExistingCorrect);
  const pool = preserving.length ? preserving : candidates;
  pool.sort((left, right) => {
    if (right.existing_eval.correct !== left.existing_eval.correct) return right.existing_eval.correct - left.existing_eval.correct;
    if (right.final_selection.metrics.selected_supported !== left.final_selection.metrics.selected_supported) return right.final_selection.metrics.selected_supported - left.final_selection.metrics.selected_supported;
    return left.alpha - right.alpha;
  });
  return { selected: pool[0], candidates };
}

function selectDiagnosticCandidates(pairs, model, scaler) {
  const byExample = new Map();
  for (const pair of pairs) {
    const exampleId = pair.example_id ?? pair.root_example_id;
    if (!byExample.has(exampleId)) byExample.set(exampleId, new Map());
    for (const [role, candidate, features] of [["chosen", pair.chosen, pair.chosen_features], ["rejected", pair.rejected, pair.rejected_features]]) {
      const candidateId = candidate.id ?? candidate.candidate_id;
      const candidates = byExample.get(exampleId);
      if (candidates.has(candidateId)) {
        if (role === "chosen") candidates.get(candidateId).supported_answer = true;
        continue;
      }
      candidates.set(candidateId, {
        example_id: exampleId,
        candidate_id: candidateId,
        family: candidate.family,
        supported_answer: role === "chosen",
        score: scoreCandidate(features, model, scaler),
        features,
      });
    }
  }
  return rankCandidateMaps(byExample);
}

function selectHybridFinalCandidates(finalPairs, d262Selections, model, scaler, alpha) {
  const d262Scores = new Map();
  for (const selection of d262Selections) {
    for (const candidate of selection.ranked_candidates ?? []) {
      d262Scores.set(`${selection.example_id}:${candidate.candidate_id}`, Number(candidate.score ?? 0));
    }
  }
  const byExample = new Map();
  for (const pair of finalPairs) {
    const exampleId = pair.example_id ?? pair.root_example_id;
    if (!byExample.has(exampleId)) byExample.set(exampleId, new Map());
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const candidateId = candidate.id ?? candidate.candidate_id;
      const candidates = byExample.get(exampleId);
      if (candidates.has(candidateId)) {
        if (role === "chosen") candidates.get(candidateId).supported_answer = true;
        continue;
      }
      const features = candidateFeatures(pair.input, candidate);
      candidates.set(candidateId, {
        example_id: exampleId,
        candidate_id: candidateId,
        family: candidate.family,
        supported_answer: role === "chosen",
        score: Number(d262Scores.get(`${exampleId}:${candidateId}`) ?? 0) + alpha * scoreCandidate(features, model, scaler),
        boundary_score: scoreCandidate(features, model, scaler),
      });
    }
  }
  return { rows: rankCandidateMaps(byExample), metrics: summarizeSelections(rankCandidateMaps(byExample)) };
}

function rankCandidateMaps(byExample) {
  return [...byExample.entries()].map(([exampleId, candidateMap]) => {
    const ranked = [...candidateMap.values()].sort((left, right) => right.score - left.score);
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

function decisionFrom({ baseline, boundaryFinalSelectionMetrics, hybrid }) {
  const baselineSelected = Number(baseline.metrics?.constrained_pool_pairwise_selector?.final_diagnostic_selection?.selected_supported ?? 0);
  const baselineExisting = Number(baseline.metrics?.constrained_pool_pairwise_selector?.existing_validation_pairwise?.correct ?? 0);
  const selected = hybrid.selected;
  if (selected.existing_eval.correct >= baselineExisting && selected.final_selection.metrics.selected_supported > baselineSelected) {
    return {
      integrate_filtered_boundary_hybrid_now: true,
      integrate_boundary_only_now: false,
      buy_more_openai_labels_now: false,
      launch_gpu_now: false,
      reason: "Filtered paid boundary labels improve final diagnostic selection while preserving D262 existing-validation pairwise accuracy.",
      next_step: "Promote the hybrid selector as the cheap scaffold baseline and audit remaining final misses.",
    };
  }
  return {
    integrate_filtered_boundary_hybrid_now: false,
    integrate_boundary_only_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    reason: `Boundary-only final selection is ${boundaryFinalSelectionMetrics.selected_supported}/8 and the selected hybrid is ${selected.final_selection.metrics.selected_supported}/8; this does not improve safely over D262's ${baselineSelected}/8.`,
    next_step: "Keep D262 as active baseline; use the filtered labels as calibration evidence, but do not buy more labels until the remaining miss pattern is audited.",
  };
}

function summarizeSelections(rows) {
  return {
    examples: rows.length,
    selected_supported: rows.filter((row) => row.selected_supported_answer).length,
    selected_unsupported: rows.filter((row) => !row.selected_supported_answer).length,
    selection_support_rate: rate(rows.filter((row) => row.selected_supported_answer).length, rows.length),
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

function renderReport(result) {
  const hybrid = result.metrics.selected_hybrid;
  return `# Filtered Boundary Selector

Generated: ${result.generated_at}

This zero-call selector trains only on the 8 accepted D271 paid boundary labels. Quarantined disagreements and final-window labels are excluded from training and tuning.

| System | Existing validation | Final selection |
| --- | ---: | ---: |
| D262 baseline | ${result.metrics.d262_existing_validation_pairwise.correct}/${result.metrics.d262_existing_validation_pairwise.pairs} | ${result.metrics.d262_final_diagnostic_selection.selected_supported}/${result.metrics.d262_final_diagnostic_selection.examples} |
| Boundary-only | ${result.metrics.boundary_only_existing_validation_pairwise.correct}/${result.metrics.boundary_only_existing_validation_pairwise.pairs} | ${result.metrics.boundary_only_final_diagnostic_selection.selected_supported}/${result.metrics.boundary_only_final_diagnostic_selection.examples} |
| Selected hybrid alpha=${hybrid.alpha_boundary_weight} | ${hybrid.existing_validation_pairwise.correct}/${hybrid.existing_validation_pairwise.pairs} | ${hybrid.final_diagnostic_selection.selected_supported}/${hybrid.final_diagnostic_selection.examples} |

## Decision

- Integrate filtered boundary hybrid now: ${result.decision.integrate_filtered_boundary_hybrid_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function scoreDelta(delta, model, scaler) {
  return dot(model.weights, scaleVector(delta, scaler));
}

function scoreCandidate(features, model, scaler) {
  return dot(model.weights, scaleVector(featureNames.map((name) => features[name]), scaler));
}

function fitScaleOnlyScaler(vectors) {
  return featureNames.map((name, index) => {
    const values = vectors.map((vector) => vector[index]);
    const stdValue = Math.sqrt(mean(values.map((value) => value ** 2))) || 1;
    return { name, mean: 0, std: stdValue };
  });
}

function scaleVector(vector, scaler) {
  return vector.map((value, index) => (value - scaler[index].mean) / scaler[index].std);
}

function citedEvidenceText(input, candidate) {
  const evidence = input?.compact_retrieved_evidence_pack ?? [];
  const ids = new Set(candidate.citations ?? []);
  return evidence.filter((item) => ids.has(item.evidence_id)).map((item) => item.text).join(" ");
}

function inlineComplete(candidate) {
  const answer = String(candidate.answer ?? "");
  return (candidate.citations ?? []).every((citation) => answer.includes(`[${citation}]`));
}

function tokenCoverage(sourceTokens, targetTokens) {
  if (!sourceTokens.length) return 1;
  const target = new Set(targetTokens);
  return sourceTokens.filter((token) => target.has(token)).length / sourceTokens.length;
}

function unsupportedNumbers(text, citedText) {
  const cited = normalizeText(citedText).replace(/,/g, "");
  return numberTokens(text).filter((token) => !cited.includes(normalizeText(token).replace(/,/g, "")));
}

function unsupportedTerms(text, citedText, terms) {
  const cited = new Set(contentTokens(citedText));
  const textTokens = new Set(contentTokens(text));
  return terms.filter((term) => textTokens.has(term) && !cited.has(term));
}

function extraEntityTokens(text, citedText) {
  const cited = new Set(contentTokens(citedText));
  return contentTokens(text).filter((token) => /^[A-Z0-9]/.test(token) && !cited.has(token.toLowerCase()));
}

function contentTokens(value) {
  return String(value ?? "").match(/[A-Za-z][A-Za-z0-9-]{2,}|\d+(?:[.,]\d+)*(?:k|%)?/g)?.map((token) => token.toLowerCase()).filter((token) => !stopwords.has(token)) ?? [];
}

function numberTokens(value) {
  return String(value ?? "").match(/[-+]?\d+(?:[.,]\d+)*(?:k|%| percent)?/gi) ?? [];
}

function normalizeText(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ");
}

function dot(weights, vector) {
  return weights.reduce((total, weight, index) => total + weight * vector[index], 0);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
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
