import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run"] ?? "minimal-span-overexpansion-packet-qwen-frontier-pool-2026-06-28-v1";
const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const d262RunId = args["baseline-run"] ?? "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1";
const runId = args["run-id"] ?? "overexpansion-aware-selector-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const featureNames = [
  "answer_tokens",
  "claim_tokens",
  "claim_answer_gap",
  "citation_count",
  "inline_complete",
  "answer_cited_coverage",
  "claim_cited_coverage",
  "question_answer_overlap",
  "unsupported_number_count",
  "unsupported_list_scope_count",
  "extra_entity_count",
  "short_answer_bonus",
];
const stopwords = new Set(["the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "has", "have", "had", "but", "not", "can", "may", "its", "into", "than", "then", "also", "been", "their", "there", "which", "while", "using", "used", "use", "true", "false", "answer", "claim", "evidence", "support", "supported", "paper"]);
const listTerms = ["dataset", "datasets", "task", "tasks", "setting", "settings", "mode", "modes", "class", "classes", "annotator", "annotators", "model", "models", "corpus", "corpora", "benchmark", "benchmarks", "translation", "translations"];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const packetResult = await readJson(path.join(runsDir, packetRunId, "result.json"));
const d262Result = await readJson(path.join(runsDir, d262RunId, "result.json"));
const trainPairs = await readJsonl(path.join(runsDir, packetRunId, "train_contrast_pairs.jsonl"));
const validationPairs = await readJsonl(path.join(runsDir, packetRunId, "validation_contrast_pairs.jsonl"));
const existingValidationPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "validation_pairwise.jsonl"));
const finalDiagnosticPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "diagnostic_frontier_pairwise.jsonl"));

const enrichedTrain = trainPairs.map(enrichPair);
const enrichedValidation = validationPairs.map(enrichPair);
const enrichedExisting = existingValidationPairs.map(enrichPair);
const enrichedFinal = finalDiagnosticPairs.map(enrichPair);
const scaler = fitScaler(enrichedTrain.map((row) => row.delta));
const model = trainPairwiseLogistic(enrichedTrain.map((row) => ({
  x: scaleVector(row.delta, scaler),
  weight: row.contrast_type?.startsWith("generated") ? 1.5 : 1,
})), { epochs: 600, learningRate: 0.08, l2: 0.04 });

const trainEval = evaluatePairs(enrichedTrain, model, scaler);
const validationEval = evaluatePairs(enrichedValidation, model, scaler);
const existingEval = evaluatePairs(enrichedExisting, model, scaler);
const finalEval = evaluatePairs(enrichedFinal, model, scaler);
const finalSelection = selectDiagnosticCandidates(enrichedFinal, model, scaler);
const finalSelectionMetrics = summarizeSelections(finalSelection);
const status = deriveStatus(validationEval, existingEval, finalSelectionMetrics, d262Result);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "overexpansion_aware_selector",
  status,
  packet_run_id: packetRunId,
  pairwise_packet_run_id: pairwisePacketRunId,
  baseline_run_id: d262RunId,
  purpose: "Train a zero-cost selector on non-final minimal-span-vs-overexpanded-answer contrasts and test whether cheap surface/evidence features improve final grounded candidate selection.",
  training: {
    algorithm: "pairwise_logistic_regression",
    train_pairs: enrichedTrain.length,
    validation_pairs: enrichedValidation.length,
    feature_names: featureNames,
    source_packet_counts: packetResult.counts,
  },
  metrics: {
    train_overexpansion_pairs: summarizePairEval(trainEval),
    validation_overexpansion_pairs: summarizePairEval(validationEval),
    existing_validation_pairwise: summarizePairEval(existingEval),
    final_diagnostic_pairwise: summarizePairEval(finalEval),
    final_diagnostic_selection: finalSelectionMetrics,
    d262_baseline_final_selection: d262Result.metrics?.constrained_pool_pairwise_selector?.final_diagnostic_selection,
  },
  learned_selector: {
    weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
    scaler,
    epochs: model.epochs,
    learning_rate: model.learningRate,
    l2: model.l2,
  },
  decision: decisionFromMetrics(validationEval, existingEval, finalSelectionMetrics, d262Result),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_diagnostic_training_use: "forbidden_diagnostic_only",
    nonfinal_training_use: "allowed_nonfinal_minimal_span_overexpansion_supervision",
    final_labels_used_for_target_design: false,
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
    note: "This selector trains from existing non-final mined contrasts and makes no API calls.",
  },
};

await writeJsonl(path.join(outputDir, "train_predictions.jsonl"), trainEval.rows);
await writeJsonl(path.join(outputDir, "validation_predictions.jsonl"), validationEval.rows);
await writeJsonl(path.join(outputDir, "existing_validation_pair_predictions.jsonl"), existingEval.rows);
await writeJsonl(path.join(outputDir, "final_diagnostic_pair_predictions.jsonl"), finalEval.rows);
await writeJsonl(path.join(outputDir, "final_diagnostic_selections.jsonl"), finalSelection);
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
  const questionTokens = contentTokens(input.question);
  return {
    answer_tokens: Math.log1p(answerTokens.length),
    claim_tokens: Math.log1p(claimTokens.length),
    claim_answer_gap: Math.max(0, Math.log1p(claimTokens.length) - Math.log1p(answerTokens.length || 1)),
    citation_count: Math.log1p((candidate.citations ?? []).length),
    inline_complete: inlineComplete(candidate) ? 1 : 0,
    answer_cited_coverage: tokenCoverage(answerTokens, citedTokens),
    claim_cited_coverage: tokenCoverage(claimTokens, citedTokens),
    question_answer_overlap: tokenCoverage(questionTokens, answerTokens),
    unsupported_number_count: Math.log1p(unsupportedNumbers(`${answer} ${claimText}`, citedText, input.question).length),
    unsupported_list_scope_count: Math.log1p(unsupportedTerms(`${answer} ${claimText}`, citedText, input.question, listTerms).length),
    extra_entity_count: Math.log1p(extraEntityTokens(`${answer} ${claimText}`, citedText, input.question).length),
    short_answer_bonus: answerTokens.length <= 8 ? 1 : 0,
  };
}

function trainPairwiseLogistic(rows, options) {
  const weights = Array(featureNames.length).fill(0);
  const { epochs, learningRate, l2 } = options;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / Math.sqrt(1 + epoch / 45);
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

function evaluatePairs(pairs, model, scaler) {
  const rows = pairs.map((pair) => {
    const margin = scoreDelta(pair.delta, model, scaler);
    return {
      pair_id: pair.pair_id,
      example_id: pair.example_id ?? pair.root_example_id,
      split: pair.split,
      source_index: pair.source_index ?? null,
      contrast_type: pair.contrast_type ?? null,
      predicted_preferred: margin >= 0 ? "chosen" : "rejected",
      correct: margin >= 0,
      margin,
      chosen_id: pair.chosen.id,
      rejected_id: pair.rejected.id,
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

function selectDiagnosticCandidates(pairs, model, scaler) {
  const byExample = new Map();
  for (const pair of pairs) {
    const exampleId = pair.example_id ?? pair.root_example_id;
    if (!byExample.has(exampleId)) byExample.set(exampleId, new Map());
    for (const [role, candidate, features] of [["chosen", pair.chosen, pair.chosen_features], ["rejected", pair.rejected, pair.rejected_features]]) {
      const candidates = byExample.get(exampleId);
      if (candidates.has(candidate.id)) {
        if (role === "chosen") candidates.get(candidate.id).supported_answer = true;
        continue;
      }
      candidates.set(candidate.id, {
        example_id: exampleId,
        candidate_id: candidate.id,
        family: candidate.family,
        supported_answer: role === "chosen",
        score: scoreCandidate(features, model, scaler),
        features,
      });
    }
  }
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

function deriveStatus(validationEval, existingEval, finalSelection, baselineResult) {
  const baselineRate = Number(baselineResult.metrics?.constrained_pool_pairwise_selector?.final_diagnostic_selection?.selection_support_rate ?? 0);
  if (validationEval.accuracy >= 0.75 && existingEval.accuracy >= 0.75 && finalSelection.selection_support_rate > baselineRate) return "overexpansion_selector_improves_final_selection";
  if (validationEval.accuracy >= 0.75 && finalSelection.selection_support_rate >= baselineRate) return "overexpansion_selector_partial_signal";
  return "overexpansion_selector_not_sufficient";
}

function decisionFromMetrics(validationEval, existingEval, finalSelection, baselineResult) {
  const baselineRate = Number(baselineResult.metrics?.constrained_pool_pairwise_selector?.final_diagnostic_selection?.selection_support_rate ?? 0);
  if (validationEval.accuracy >= 0.75 && existingEval.accuracy >= 0.75 && finalSelection.selection_support_rate > baselineRate) {
    return { integrate_selector_now: true, launch_gpu_now: false, buy_more_openai_labels_now: false, reason: "Overexpansion-aware selector improves final diagnostics while preserving validation.", next_step: "Integrate as the active cheap selector baseline and audit remaining misses." };
  }
  if (finalSelection.selection_support_rate > baselineRate) {
    return { integrate_selector_now: false, launch_gpu_now: false, buy_more_openai_labels_now: false, reason: "Overexpansion-aware features improve final diagnostic selection but fail the existing validation preservation gate.", next_step: "Test a calibrated hybrid with D262 so the overexpansion signal can recover final misses without sacrificing broad grounded-support validation." };
  }
  return { integrate_selector_now: false, launch_gpu_now: false, buy_more_openai_labels_now: false, reason: "Overexpansion-aware features do not beat the D262 final diagnostic baseline.", next_step: "Use the mined packet as evidence for the failure mechanism, but do not replace D262; consider a targeted paid adjudication only after auditing why cheap features fail." };
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

function summarizePairEval(evalResult) {
  return { pairs: evalResult.pairs, correct: evalResult.correct, accuracy: evalResult.accuracy, mean_margin: evalResult.mean_margin };
}

function renderReport(result) {
  return `# Overexpansion-Aware Selector

Generated: ${result.generated_at}

This selector makes no OpenAI calls and launches no compute. Final-window labels are forbidden diagnostics only.

| Split | Items | Correct/selected | Rate |
| --- | ---: | ---: | ---: |
| Train overexpansion pairs | ${result.metrics.train_overexpansion_pairs.pairs} | ${result.metrics.train_overexpansion_pairs.correct} | ${pct(result.metrics.train_overexpansion_pairs.accuracy)} |
| Validation overexpansion pairs | ${result.metrics.validation_overexpansion_pairs.pairs} | ${result.metrics.validation_overexpansion_pairs.correct} | ${pct(result.metrics.validation_overexpansion_pairs.accuracy)} |
| Existing validation pairwise | ${result.metrics.existing_validation_pairwise.pairs} | ${result.metrics.existing_validation_pairwise.correct} | ${pct(result.metrics.existing_validation_pairwise.accuracy)} |
| Final diagnostic pairwise | ${result.metrics.final_diagnostic_pairwise.pairs} | ${result.metrics.final_diagnostic_pairwise.correct} | ${pct(result.metrics.final_diagnostic_pairwise.accuracy)} |
| Final diagnostic selection | ${result.metrics.final_diagnostic_selection.examples} | ${result.metrics.final_diagnostic_selection.selected_supported} | ${pct(result.metrics.final_diagnostic_selection.selection_support_rate)} |
| D262 baseline final selection | ${result.metrics.d262_baseline_final_selection.examples} | ${result.metrics.d262_baseline_final_selection.selected_supported} | ${pct(result.metrics.d262_baseline_final_selection.selection_support_rate)} |

## Decision

- Integrate selector now: ${result.decision.integrate_selector_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function fitScaler(vectors) {
  const std = {};
  featureNames.forEach((name, index) => {
    const values = vectors.map((vector) => vector[index]);
    const center = mean(values);
    const variance = mean(values.map((value) => (value - center) ** 2));
    std[name] = Math.sqrt(variance) || 1;
  });
  return { mean: Object.fromEntries(featureNames.map((name) => [name, 0])), std };
}

function scaleVector(vector, scaler) {
  return vector.map((value, index) => value / Number(scaler.std[featureNames[index]] || 1));
}

function scoreDelta(delta, model, scaler) {
  return dot(model.weights, scaleVector(delta, scaler));
}

function scoreCandidate(features, model, scaler) {
  return dot(model.weights, scaleVector(featureNames.map((name) => features[name] ?? 0), scaler));
}

function citedEvidenceText(input, candidate) {
  const evidenceById = new Map((input.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row]));
  return (candidate.citations ?? []).map((id) => evidenceById.get(String(id).replace(/^\[/, "").replace(/\]$/, ""))?.text ?? "").join(" ");
}

function inlineComplete(candidate) {
  const answer = String(candidate.answer ?? "");
  const citations = candidate.citations ?? [];
  return citations.length > 0 && citations.every((id) => answer.includes(`[${id}]`));
}

function contentTokens(value) {
  return String(value ?? "").replace(/\[[^\]]+\]/g, " ").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !stopwords.has(token));
}

function numberTokens(value) {
  return String(value ?? "").match(/[-+]?\d+(?:[.,]\d+)*(?:%| percent)?/gi) ?? [];
}

function normalizeNumber(value) {
  return String(value ?? "").toLowerCase().replace(/,/g, "").replace(/\s+percent\b/, "%");
}

function unsupportedNumbers(text, citedText, question) {
  const cited = new Set(numberTokens(citedText).map(normalizeNumber));
  const questionNumbers = new Set(numberTokens(question).map(normalizeNumber));
  return numberTokens(text).map(normalizeNumber).filter((number) => !cited.has(number) && !questionNumbers.has(number));
}

function unsupportedTerms(text, citedText, question, terms) {
  const cited = new Set(matchedTerms(citedText, terms));
  const questionTerms = new Set(matchedTerms(question, terms));
  return matchedTerms(text, terms).filter((term) => !cited.has(term) && !questionTerms.has(term));
}

function matchedTerms(value, terms) {
  const text = String(value ?? "").toLowerCase();
  return terms.filter((term) => new RegExp(`\\b${escapeRegex(term)}\\b`).test(text));
}

function extraEntityTokens(text, citedText, question) {
  const cited = new Set(entityishTokens(citedText).map((token) => token.toLowerCase()));
  const questionEntities = new Set(entityishTokens(question).map((token) => token.toLowerCase()));
  return entityishTokens(text).filter((token) => !cited.has(token.toLowerCase()) && !questionEntities.has(token.toLowerCase()));
}

function entityishTokens(value) {
  return String(value ?? "").match(/\b[A-Z][A-Za-z0-9.-]*(?:-[A-Za-z0-9.]+)?\b/g) ?? [];
}

function tokenCoverage(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size) return 0;
  return [...left].filter((token) => right.has(token)).length / left.size;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
