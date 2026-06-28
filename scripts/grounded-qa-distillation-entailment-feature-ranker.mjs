import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const runId = args["run-id"] ?? "entailment-feature-ranker-expanded-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const comparativeTerms = ["best", "better", "worse", "worst", "outperform", "outperformed", "outperforms", "higher", "lower", "more", "less", "fewer", "larger", "smaller", "shorter", "longer", "improve", "improved", "increase", "increased", "decrease", "decreased", "reduce", "reduced", "significant", "significantly"];
const negationTerms = ["not", "no", "never", "without", "neither", "nor", "cannot", "can't", "doesn't", "didn't", "isn't", "aren't"];
const stopwords = new Set([
  "the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "has", "have", "had", "but", "not", "can", "may", "its", "into", "than", "then", "also", "been", "their", "there", "which", "while", "using", "used", "use", "true", "false", "answer", "claim", "evidence", "support", "supported",
]);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const packetDir = path.join(runsDir, sourcePacketRunId);
const packet = await readJson(path.join(packetDir, "result.json"));
const trainPairs = await readJsonl(path.join(packetDir, "train_pairwise.jsonl"));
const validationPairs = await readJsonl(path.join(packetDir, "validation_pairwise.jsonl"));
const diagnosticPairs = await readJsonl(path.join(packetDir, "diagnostic_frontier_pairwise.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const featureNames = [
  "answer_cited_token_coverage",
  "answer_pack_token_coverage",
  "claim_min_cited_coverage",
  "claim_mean_cited_coverage",
  "claim_max_sentence_coverage_min",
  "claim_max_sentence_coverage_mean",
  "answer_sentence_coverage",
  "unsupported_answer_token_rate",
  "unsupported_claim_token_rate",
  "supported_number_rate",
  "unsupported_number_count",
  "unsupported_comparative_count",
  "negation_mismatch_count",
  "question_answer_overlap",
  "question_cited_overlap",
  "answer_tokens",
  "citation_count",
  "claim_count",
];

const trainRows = trainPairs.map((row) => pairWithFeatures(row));
const validationRows = validationPairs.map((row) => pairWithFeatures(row));
const diagnosticRows = diagnosticPairs.map((row) => pairWithFeatures(row));
const scaler = fitScaleOnlyScaler(trainRows.map((row) => row.delta));
const model = trainPairwiseLogistic(trainRows.map((row) => scaleVector(row.delta, scaler)), {
  epochs: 320,
  learningRate: 0.08,
  l2: 0.04,
});

const trainEval = evaluatePairs(trainRows, model, scaler);
const validationEval = evaluatePairs(validationRows, model, scaler);
const diagnosticEval = evaluatePairs(diagnosticRows, model, scaler);
const diagnosticSelections = selectDiagnosticCandidates(diagnosticRows, model, scaler);
const diagnosticSelectionMetrics = summarizeSelections(diagnosticSelections);
const status = deriveStatus(validationEval, diagnosticEval, diagnosticSelectionMetrics);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "entailment_feature_ranker",
  status,
  source_packet: sourcePacketRunId,
  purpose: "Train a zero-cost local pairwise ranker using deterministic entailment-style answer/claim/cited-evidence features.",
  feature_names: featureNames,
  training: {
    algorithm: "scale_only_pairwise_logistic_regression",
    epochs: model.epochs,
    learning_rate: model.learningRate,
    l2: model.l2,
    train_pairs: trainRows.length,
    validation_pairs: validationRows.length,
  },
  metrics: {
    train: summarizePairEval(trainEval),
    validation: summarizePairEval(validationEval),
    final_diagnostic_pairwise: summarizePairEval(diagnosticEval),
    final_diagnostic_selection: diagnosticSelectionMetrics,
  },
  model: {
    intercept: 0,
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
    note: "This run computes deterministic features and trains locally from existing packet rows only.",
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

function pairWithFeatures(row) {
  const chosenFeatures = entailmentFeatures(row.input, row.chosen);
  const rejectedFeatures = entailmentFeatures(row.input, row.rejected);
  return {
    ...row,
    chosen_entailment_features: chosenFeatures,
    rejected_entailment_features: rejectedFeatures,
    delta: featureNames.map((name) => chosenFeatures[name] - rejectedFeatures[name]),
  };
}

function entailmentFeatures(input, candidate) {
  const evidenceById = new Map(input.compact_retrieved_evidence_pack.map((row) => [row.evidence_id, row]));
  const citedText = (candidate.citations ?? []).map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  const packText = input.compact_retrieved_evidence_pack.map((row) => row.text).join(" ");
  const answerTokens = contentTokens(candidate.answer);
  const citedTokens = contentTokens(citedText);
  const packTokens = contentTokens(packText);
  const questionTokens = contentTokens(input.question);
  const claims = (candidate.claim_table ?? []).map((claim) => `${claim.claim ?? ""} ${claim.support ?? ""} ${claim.evidence ?? ""}`);
  const claimTokens = claims.map((claim) => contentTokens(claim));
  const citedSentences = splitSentences(citedText).map((sentence) => contentTokens(sentence));
  const claimMaxSentenceCoverage = claimTokens.map((tokens) => maxCoverage(tokens, citedSentences));
  const claimCoverages = claimTokens.map((tokens) => tokenCoverage(tokens, citedTokens));
  const unsupportedAnswerTokens = unsupportedContentTokens(answerTokens, citedTokens, questionTokens);
  const unsupportedClaimTokens = unsupportedContentTokens(claimTokens.flat(), citedTokens, questionTokens);
  const answerNumbers = numberTokens(candidate.answer);
  const supportedNumbers = answerNumbers.filter((number) => citedText.toLowerCase().includes(number.toLowerCase()));
  return {
    answer_cited_token_coverage: tokenCoverage(answerTokens, citedTokens),
    answer_pack_token_coverage: tokenCoverage(answerTokens, packTokens),
    claim_min_cited_coverage: claimCoverages.length ? Math.min(...claimCoverages) : 0,
    claim_mean_cited_coverage: mean(claimCoverages),
    claim_max_sentence_coverage_min: claimMaxSentenceCoverage.length ? Math.min(...claimMaxSentenceCoverage) : 0,
    claim_max_sentence_coverage_mean: mean(claimMaxSentenceCoverage),
    answer_sentence_coverage: maxCoverage(answerTokens, citedSentences),
    unsupported_answer_token_rate: answerTokens.length ? unsupportedAnswerTokens.length / answerTokens.length : 0,
    unsupported_claim_token_rate: claimTokens.flat().length ? unsupportedClaimTokens.length / claimTokens.flat().length : 0,
    supported_number_rate: answerNumbers.length ? supportedNumbers.length / answerNumbers.length : 1,
    unsupported_number_count: answerNumbers.length - supportedNumbers.length,
    unsupported_comparative_count: unsupportedComparatives(candidate.answer, citedText),
    negation_mismatch_count: negationMismatch(candidate.answer, citedText),
    question_answer_overlap: tokenCoverage(questionTokens, answerTokens),
    question_cited_overlap: tokenCoverage(questionTokens, citedTokens),
    answer_tokens: answerTokens.length,
    citation_count: candidate.citations?.length ?? 0,
    claim_count: candidate.claim_table?.length ?? 0,
  };
}

function trainPairwiseLogistic(rows, options) {
  const weights = Array(featureNames.length).fill(0);
  const { epochs, learningRate, l2 } = options;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / Math.sqrt(1 + epoch / 35);
    for (const row of rows) {
      const margin = dot(weights, row);
      const gradientScale = -sigmoid(-margin);
      for (let index = 0; index < weights.length; index += 1) {
        weights[index] -= rate * (gradientScale * row[index] + l2 * weights[index]);
      }
    }
  }
  return { weights, epochs, learningRate, l2 };
}

function evaluatePairs(rows, model, scaler) {
  const predictions = rows.map((row) => {
    const margin = scoreDelta(row.delta, model, scaler);
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
  const correct = predictions.filter((row) => row.correct).length;
  return {
    pairs: rows.length,
    correct,
    accuracy: rows.length ? correct / rows.length : 0,
    mean_margin: mean(predictions.map((row) => row.margin)),
    rows: predictions,
  };
}

function selectDiagnosticCandidates(rows, model, scaler) {
  const byExample = new Map();
  for (const row of rows) {
    for (const [role, candidate, features] of [
      ["chosen", row.chosen, row.chosen_entailment_features],
      ["rejected", row.rejected, row.rejected_entailment_features],
    ]) {
      if (!byExample.has(row.example_id)) byExample.set(row.example_id, new Map());
      const key = `${row.example_id}:${candidate.id}`;
      if (byExample.get(row.example_id).has(key)) continue;
      byExample.get(row.example_id).set(key, {
        example_id: row.example_id,
        candidate_id: candidate.id,
        family: candidate.family,
        supported_answer: role === "chosen",
        score: scoreCandidate(features, model, scaler),
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

function summarizeSelections(rows) {
  const selectedSupported = rows.filter((row) => row.selected_supported_answer).length;
  return {
    examples: rows.length,
    selected_supported: selectedSupported,
    selected_unsupported: rows.length - selectedSupported,
    selection_support_rate: rows.length ? selectedSupported / rows.length : 0,
    examples_with_supported_candidate: rows.filter((row) => row.supported_candidate_count > 0).length,
  };
}

function deriveStatus(validationEval, diagnosticEval, diagnosticSelectionMetrics) {
  if (validationEval.accuracy >= 0.75 && diagnosticSelectionMetrics.selection_support_rate >= 0.7) return "entailment_ranker_promising";
  if (validationEval.accuracy > 0.5 || diagnosticSelectionMetrics.selection_support_rate > 0.5) return "entailment_features_partial_signal";
  return "entailment_features_not_sufficient";
}

function decisionFromMetrics(validationEval, diagnosticEval, diagnosticSelectionMetrics) {
  if (validationEval.accuracy >= 0.75 && diagnosticSelectionMetrics.selection_support_rate >= 0.7) {
    return {
      integrate_selector_now: true,
      launch_gpu_now: false,
      reason: "Deterministic entailment features clear validation and final diagnostic thresholds.",
      next_step: "Run a zero-cost selector integration audit before any GPU generation run.",
    };
  }
  return {
    integrate_selector_now: false,
    launch_gpu_now: false,
    reason: "Deterministic entailment features do not transfer strongly enough to select supported final-frontier Qwen candidates.",
    next_step: "Use a stronger verifier signal: add non-final Qwen-style candidate pairs, run a small local NLI scorer on packet candidates, or buy a bounded set of GPT-4o support labels before spending Prime GPU budget.",
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

function fitScaleOnlyScaler(vectors) {
  const std = {};
  featureNames.forEach((name, index) => {
    const values = vectors.map((vector) => vector[index]);
    const center = mean(values);
    const variance = mean(values.map((value) => (value - center) ** 2));
    std[name] = Math.sqrt(variance) || 1;
  });
  return { mean: Object.fromEntries(featureNames.map((name) => [name, 0])), std };
}

function scoreDelta(delta, model, scaler) {
  return dot(model.weights, scaleVector(delta, scaler));
}

function scoreCandidate(features, model, scaler) {
  return dot(model.weights, scaleVector(featureNames.map((name) => features[name] ?? 0), scaler));
}

function scaleVector(vector, scaler) {
  return vector.map((value, index) => value / Number(scaler.std[featureNames[index]] || 1));
}

function unsupportedContentTokens(tokens, citedTokens, questionTokens) {
  const cited = new Set(citedTokens);
  const question = new Set(questionTokens);
  return [...new Set(tokens)].filter((token) => !cited.has(token) && !question.has(token));
}

function maxCoverage(tokens, sentenceTokens) {
  if (!tokens.length || !sentenceTokens.length) return 0;
  return Math.max(...sentenceTokens.map((sentence) => tokenCoverage(tokens, sentence)));
}

function tokenCoverage(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size) return 0;
  return [...left].filter((token) => right.has(token)).length / left.size;
}

function contentTokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function splitSentences(value) {
  return String(value ?? "").split(/(?<=[.!?])\s+|\n+/).filter((sentence) => sentence.trim());
}

function numberTokens(value) {
  return String(value ?? "").match(/[-+]?\d+(?:[.,]\d+)*(?:%| percent)?/gi) ?? [];
}

function unsupportedComparatives(answer, citedText) {
  const support = String(citedText ?? "").toLowerCase();
  return comparativeTerms.filter((term) => String(answer ?? "").toLowerCase().includes(term) && !support.includes(term)).length;
}

function negationMismatch(answer, citedText) {
  const answerNegations = negationTerms.filter((term) => String(answer ?? "").toLowerCase().includes(term)).length;
  const evidenceNegations = negationTerms.filter((term) => String(citedText ?? "").toLowerCase().includes(term)).length;
  return Math.abs(answerNegations - evidenceNegations);
}

function renderReport(result) {
  return `# Entailment Feature Ranker

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
