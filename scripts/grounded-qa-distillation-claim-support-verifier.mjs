import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const frontierPoolPacketRunId = args["frontier-pool-packet"] ?? "qwen-frontier-pool-support-packet-2026-06-28-v1";
const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const runId = args["run-id"] ?? "claim-support-verifier-qwen-frontier-pool-2026-06-28-v1";
const trainMaxSourceIndex = Number(args["train-max-source-index"] ?? 300);
const outputDir = path.join(runsDir, runId);

const comparativeTerms = ["best", "better", "worse", "worst", "outperform", "outperformed", "outperforms", "higher", "lower", "more", "less", "fewer", "larger", "smaller", "shorter", "longer", "improve", "improved", "increase", "increased", "decrease", "decreased", "reduce", "reduced", "significant", "significantly"];
const quantifierTerms = ["all", "every", "only", "none", "always", "never", "total"];
const stopwords = new Set(["the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "has", "have", "had", "but", "not", "can", "may", "its", "into", "than", "then", "also", "been", "their", "there", "which", "while", "using", "used", "use", "true", "false", "answer", "claim", "evidence", "support", "supported"]);
const featureNames = [
  "claim_cited_token_coverage",
  "claim_pack_token_coverage",
  "claim_best_sentence_coverage",
  "unsupported_claim_token_rate",
  "numeric_supported_rate",
  "unsupported_number_count",
  "unsupported_comparative_count",
  "unsupported_quantifier_count",
  "question_claim_overlap",
  "question_cited_overlap",
  "claim_token_count",
  "citation_count",
  "inline_complete",
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const frontierPoolPacket = await readJson(path.join(runsDir, frontierPoolPacketRunId, "result.json"));
const supportLabels = await readJsonl(path.join(runsDir, frontierPoolPacketRunId, "support_labels.jsonl"));
const diagnosticPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "diagnostic_frontier_pairwise.jsonl"));
const validationPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "validation_pairwise.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const claimRows = supportLabels.flatMap(claimRowsFromSupportLabel);
const trainClaimRows = claimRows.filter((row) => row.source_index < trainMaxSourceIndex);
const validationClaimRows = claimRows.filter((row) => row.source_index >= trainMaxSourceIndex);
const scaler = fitScaler(trainClaimRows.map((row) => row.features));
const model = trainLogistic(trainClaimRows.map((row) => ({
  x: scaleVector(featureVector(row.features), scaler),
  y: row.label === "supported" ? 1 : 0,
})), { iterations: 3600, learningRate: 0.055, l2: 0.045 });

const trainClaimEval = evaluateClaimRows(trainClaimRows, model, scaler);
const validationClaimEval = evaluateClaimRows(validationClaimRows, model, scaler);
const nonfinalPairs = await readJsonl(path.join(runsDir, frontierPoolPacketRunId, "frontier_contrast_pairs.jsonl"));
const nonfinalTrainPairs = nonfinalPairs.filter((pair) => Number(pair.source_index) < trainMaxSourceIndex);
const nonfinalValidationPairs = nonfinalPairs.filter((pair) => Number(pair.source_index) >= trainMaxSourceIndex);
const nonfinalTrainPairEval = evaluatePairs(nonfinalTrainPairs, model, scaler);
const nonfinalValidationPairEval = evaluatePairs(nonfinalValidationPairs, model, scaler);
const existingValidationEval = evaluatePairs(validationPairs, model, scaler);
const finalDiagnosticEval = evaluatePairs(diagnosticPairs, model, scaler);
const finalSelections = selectDiagnosticCandidates(diagnosticPairs, model, scaler);
const finalSelectionMetrics = summarizeSelections(finalSelections);
const status = deriveStatus(validationClaimEval, nonfinalValidationPairEval, finalSelectionMetrics);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "claim_support_verifier",
  status,
  frontier_pool_packet_run_id: frontierPoolPacketRunId,
  pairwise_packet_run_id: pairwisePacketRunId,
  purpose: "Train a zero-cost claim-level semantic support verifier from non-final GPT-4o judged Qwen frontier-pool claims, then evaluate final-window candidate selection only as diagnostic.",
  training: {
    algorithm: "standardized_claim_level_logistic_regression",
    train_max_source_index: trainMaxSourceIndex,
    train_claim_rows: trainClaimRows.length,
    validation_claim_rows: validationClaimRows.length,
    train_source_index_range: numericRange(trainClaimRows.map((row) => row.source_index)),
    validation_source_index_range: numericRange(validationClaimRows.map((row) => row.source_index)),
    feature_names: featureNames,
  },
  metrics: {
    train_claim_classification: summarizeClassification(trainClaimEval),
    validation_claim_classification: summarizeClassification(validationClaimEval),
    nonfinal_train_pairwise: summarizePairEval(nonfinalTrainPairEval),
    nonfinal_validation_pairwise: summarizePairEval(nonfinalValidationPairEval),
    existing_validation_pairwise: summarizePairEval(existingValidationEval),
    final_diagnostic_pairwise: summarizePairEval(finalDiagnosticEval),
    final_diagnostic_selection: finalSelectionMetrics,
  },
  model: {
    intercept: model.intercept,
    weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
    scaler,
  },
  decision: decisionFromMetrics(validationClaimEval, nonfinalValidationPairEval, finalSelectionMetrics),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_diagnostic_training_use: "forbidden_diagnostic_only",
    nonfinal_training_use: "allowed_nonfinal_claim_support_supervision",
    claim_rows_source_index_min: min(claimRows.map((row) => row.source_index)),
    claim_rows_source_index_max: max(claimRows.map((row) => row.source_index)),
    inherited_packet_final_window_labels_used: frontierPoolPacket.leakage_guard?.final_window_labels_used_for_training,
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    inherited_openai_cost_usd: frontierPoolPacket.budget?.inherited_openai_cost_usd ?? 0,
    inherited_external_compute_cost_usd: frontierPoolPacket.budget?.inherited_external_compute_cost_usd ?? 0,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This verifier trains locally from existing judged non-final rows only.",
  },
};

await writeJsonl(path.join(outputDir, "claim_support_rows.jsonl"), claimRows);
await writeJsonl(path.join(outputDir, "train_claim_predictions.jsonl"), trainClaimEval.rows);
await writeJsonl(path.join(outputDir, "validation_claim_predictions.jsonl"), validationClaimEval.rows);
await writeJsonl(path.join(outputDir, "nonfinal_validation_pair_predictions.jsonl"), nonfinalValidationPairEval.rows);
await writeJsonl(path.join(outputDir, "existing_validation_pair_predictions.jsonl"), existingValidationEval.rows);
await writeJsonl(path.join(outputDir, "final_diagnostic_pair_predictions.jsonl"), finalDiagnosticEval.rows);
await writeJsonl(path.join(outputDir, "final_diagnostic_selections.jsonl"), finalSelections);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);
console.log(JSON.stringify({ run_id: runId, status, metrics: result.metrics, decision: result.decision }, null, 2));

function claimRowsFromSupportLabel(row) {
  if (row.prediction?.answer_type !== "grounded_answer") return [];
  const labels = [];
  const base = {
    example_id: row.example_id,
    root_example_id: row.root_example_id,
    sample_index: row.sample_index,
    split: row.split,
    source_index: Number(row.source_index),
    input: row.input,
    candidate: row.prediction,
    judge: row.judge,
    training_use: "allowed_nonfinal_claim_support_supervision",
  };
  if (row.labels?.supported_answer === true) {
    for (const claim of claimTexts(row.prediction)) {
      labels.push(makeClaimRow(base, claim, "supported", "supported_answer_claim"));
    }
  } else {
    const unsupported = Array.isArray(row.judge?.unsupported_claims) ? row.judge.unsupported_claims.filter(Boolean) : [];
    const negativeClaims = unsupported.length ? unsupported : claimTexts(row.prediction);
    for (const claim of negativeClaims) {
      labels.push(makeClaimRow(base, claim, "unsupported", unsupported.length ? "judge_unsupported_claim" : "unsupported_answer_fallback_claim"));
    }
  }
  return labels;
}

function makeClaimRow(base, claim, label, labelSource) {
  const features = claimFeatures(base.input, base.candidate, claim);
  return {
    claim_id: `${base.example_id}::${labelSource}::${hashString(claim)}`,
    example_id: base.example_id,
    root_example_id: base.root_example_id,
    sample_index: base.sample_index,
    split: base.split,
    source_index: base.source_index,
    claim,
    label,
    label_source: labelSource,
    citations: base.candidate.citations ?? [],
    features,
    training_use: base.training_use,
    judge: {
      verdict: base.judge?.verdict,
      all_claims_supported: base.judge?.all_claims_supported,
      citation_ids_valid: base.judge?.citation_ids_valid,
      missing_citations: base.judge?.missing_citations ?? [],
    },
  };
}

function claimTexts(candidate) {
  const claims = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? "").trim()).filter(Boolean);
  const answer = stripCitations(candidate.answer).trim();
  if (!claims.length && answer) return [answer];
  if (answer && answer.length <= 180 && !claims.some((claim) => normalizedText(claim) === normalizedText(answer))) {
    return [answer, ...claims];
  }
  return claims;
}

function evaluateClaimRows(rows, model, scaler) {
  const predictions = rows.map((row) => {
    const score = scoreClaimFeatures(row.features, model, scaler);
    const predicted = score >= 0.5 ? "supported" : "unsupported";
    return {
      claim_id: row.claim_id,
      example_id: row.example_id,
      source_index: row.source_index,
      label: row.label,
      predicted_label: predicted,
      score,
      correct: predicted === row.label,
      label_source: row.label_source,
    };
  });
  return { rows: predictions, ...classificationCounts(predictions) };
}

function evaluatePairs(pairs, model, scaler) {
  const rows = pairs.map((pair) => {
    const chosenScore = scoreCandidate(pair.input, pair.chosen, model, scaler);
    const rejectedScore = scoreCandidate(pair.input, pair.rejected, model, scaler);
    const margin = chosenScore - rejectedScore;
    return {
      pair_id: pair.pair_id,
      example_id: pair.example_id ?? pair.root_example_id,
      source: pair.source,
      split: pair.split,
      source_index: pair.source_index ?? null,
      predicted_preferred: margin >= 0 ? "chosen" : "rejected",
      correct: margin >= 0,
      margin,
      chosen_score: chosenScore,
      rejected_score: rejectedScore,
      chosen_id: pair.chosen?.id,
      rejected_id: pair.rejected?.id,
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
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const exampleId = pair.example_id ?? pair.root_example_id;
      if (!byExample.has(exampleId)) byExample.set(exampleId, new Map());
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
        score: scoreCandidate(pair.input, candidate, model, scaler),
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

function scoreCandidate(input, candidate, model, scaler) {
  if (candidate.answer_type === "abstain") return -10;
  const claims = claimTexts(candidate);
  if (!claims.length) return -5;
  const scores = claims.map((claim) => scoreClaimFeatures(claimFeatures(input, candidate, claim), model, scaler));
  const minScore = Math.min(...scores);
  const meanScore = mean(scores);
  const citationCompleteness = inlineComplete(candidate) ? 0.05 : -0.2;
  return minScore + 0.35 * meanScore + citationCompleteness;
}

function claimFeatures(input, candidate, claim) {
  const evidenceById = new Map((input.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row]));
  const citedIds = (candidate.citations ?? []).map((id) => String(id).replace(/^\[/, "").replace(/\]$/, ""));
  const citedText = citedIds.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  const packText = (input.compact_retrieved_evidence_pack ?? []).map((row) => row.text).join(" ");
  const claimTokens = contentTokens(claim);
  const citedTokens = contentTokens(citedText);
  const packTokens = contentTokens(packText);
  const questionTokens = contentTokens(input.question);
  const citedSentences = splitSentences(citedText).map((sentence) => contentTokens(sentence));
  const unsupportedTokens = unsupportedContentTokens(claimTokens, citedTokens, questionTokens);
  const claimNumbers = numberTokens(claim).map(normalizeNumber);
  const citedNumbers = new Set(numberTokens(citedText).map(normalizeNumber));
  const questionNumbers = new Set(numberTokens(input.question).map(normalizeNumber));
  const unsupportedNumbers = claimNumbers.filter((number) => !citedNumbers.has(number) && !questionNumbers.has(number)).length;
  return {
    claim_cited_token_coverage: tokenCoverage(claimTokens, citedTokens),
    claim_pack_token_coverage: tokenCoverage(claimTokens, packTokens),
    claim_best_sentence_coverage: maxCoverage(claimTokens, citedSentences),
    unsupported_claim_token_rate: claimTokens.length ? unsupportedTokens.length / claimTokens.length : 0,
    numeric_supported_rate: claimNumbers.length ? (claimNumbers.length - unsupportedNumbers) / claimNumbers.length : 1,
    unsupported_number_count: Math.log1p(unsupportedNumbers),
    unsupported_comparative_count: Math.log1p(unsupportedTerms(claim, citedText, input.question, comparativeTerms).length),
    unsupported_quantifier_count: Math.log1p(unsupportedTerms(claim, citedText, input.question, quantifierTerms).length),
    question_claim_overlap: tokenCoverage(questionTokens, claimTokens),
    question_cited_overlap: tokenCoverage(questionTokens, citedTokens),
    claim_token_count: Math.log1p(claimTokens.length),
    citation_count: Math.log1p(citedIds.length),
    inline_complete: inlineComplete(candidate) ? 1 : 0,
  };
}

function scoreClaimFeatures(features, model, scaler) {
  return sigmoid(model.intercept + dot(model.weights, scaleVector(featureVector(features), scaler)));
}

function trainLogistic(rows, options) {
  const weights = Array(featureNames.length).fill(0);
  let intercept = 0;
  const { iterations, learningRate, l2 } = options;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const rateNow = learningRate / Math.sqrt(1 + iteration / 200);
    for (const row of rows) {
      const predicted = sigmoid(intercept + dot(weights, row.x));
      const error = predicted - row.y;
      intercept -= rateNow * error;
      for (let index = 0; index < weights.length; index += 1) {
        weights[index] -= rateNow * (error * row.x[index] + l2 * weights[index]);
      }
    }
  }
  return { weights, intercept, iterations, learningRate, l2 };
}

function classificationCounts(rows) {
  const correct = rows.filter((row) => row.correct).length;
  const supported = rows.filter((row) => row.label === "supported");
  const unsupported = rows.filter((row) => row.label === "unsupported");
  return {
    examples: rows.length,
    correct,
    accuracy: rate(correct, rows.length),
    supported_examples: supported.length,
    unsupported_examples: unsupported.length,
    supported_recall: rate(supported.filter((row) => row.predicted_label === "supported").length, supported.length),
    unsupported_recall: rate(unsupported.filter((row) => row.predicted_label === "unsupported").length, unsupported.length),
  };
}

function deriveStatus(validationClaimEval, nonfinalValidationPairEval, finalSelectionMetrics) {
  if (validationClaimEval.accuracy >= 0.75 && nonfinalValidationPairEval.accuracy >= 0.75 && finalSelectionMetrics.selection_support_rate >= 0.75) {
    return "claim_support_verifier_promising_for_selector_integration";
  }
  if (validationClaimEval.accuracy >= 0.7 && nonfinalValidationPairEval.accuracy >= 0.7) {
    return "claim_support_verifier_learns_nonfinal_but_not_final";
  }
  return "claim_support_verifier_not_sufficient";
}

function decisionFromMetrics(validationClaimEval, nonfinalValidationPairEval, finalSelectionMetrics) {
  if (validationClaimEval.accuracy >= 0.75 && nonfinalValidationPairEval.accuracy >= 0.75 && finalSelectionMetrics.selection_support_rate >= 0.75) {
    return {
      integrate_selector_now: true,
      launch_gpu_now: false,
      buy_more_openai_labels_now: false,
      reason: "The claim-level verifier clears held-out non-final and final diagnostic thresholds.",
      next_step: "Integrate as a selector gate and evaluate cost/coverage before more generation.",
    };
  }
  return {
    integrate_selector_now: false,
    launch_gpu_now: false,
    buy_more_openai_labels_now: false,
    reason: "Claim-level supervision still does not clear the final diagnostic selection threshold.",
    next_step: "Escalate from lexical claim features to stronger semantic verifier labels/modeling before any more generator-only GPU spend.",
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

function summarizeClassification(evalResult) {
  return {
    examples: evalResult.examples,
    correct: evalResult.correct,
    accuracy: evalResult.accuracy,
    supported_examples: evalResult.supported_examples,
    unsupported_examples: evalResult.unsupported_examples,
    supported_recall: evalResult.supported_recall,
    unsupported_recall: evalResult.unsupported_recall,
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

function fitScaler(featureRows) {
  const meanByName = {};
  const stdByName = {};
  for (const name of featureNames) {
    const values = featureRows.map((row) => Number(row[name] ?? 0));
    const center = mean(values);
    const variance = mean(values.map((value) => (value - center) ** 2));
    meanByName[name] = center;
    stdByName[name] = Math.sqrt(variance) || 1;
  }
  return { mean: meanByName, std: stdByName };
}

function featureVector(features) {
  return featureNames.map((name) => Number(features[name] ?? 0));
}

function scaleVector(vector, scaler) {
  return vector.map((value, index) => {
    const name = featureNames[index];
    return (value - Number(scaler.mean[name] ?? 0)) / Number(scaler.std[name] || 1);
  });
}

function inlineComplete(candidate) {
  const answer = String(candidate.answer ?? "");
  const citations = candidate.citations ?? [];
  return citations.length > 0 && citations.every((id) => answer.includes(`[${id}]`));
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

function unsupportedContentTokens(tokens, citedTokens, questionTokens) {
  const cited = new Set(citedTokens);
  const question = new Set(questionTokens);
  return [...new Set(tokens)].filter((token) => !cited.has(token) && !question.has(token));
}

function unsupportedTerms(text, citedText, question, terms) {
  const citedTerms = new Set(matchedTerms(citedText, terms));
  const questionTerms = new Set(matchedTerms(question, terms));
  return matchedTerms(text, terms).filter((term) => !citedTerms.has(term) && !questionTerms.has(term));
}

function matchedTerms(value, terms) {
  const text = String(value ?? "").toLowerCase();
  return terms.filter((term) => new RegExp(`\\b${escapeRegex(term)}\\b`).test(text));
}

function contentTokens(value) {
  return stripCitations(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function splitSentences(value) {
  return String(value ?? "").split(/(?<=[.!?])\s+|\n+/).filter((sentence) => sentence.trim());
}

function numberTokens(value) {
  return String(value ?? "").match(/[-+]?\d+(?:[.,]\d+)*(?:%| percent)?/gi) ?? [];
}

function normalizeNumber(value) {
  return String(value ?? "").toLowerCase().replace(/,/g, "").replace(/\s+percent\b/, "%");
}

function stripCitations(value) {
  return String(value ?? "").replace(/\[[^\]]+\]/g, " ");
}

function normalizedText(value) {
  return contentTokens(value).join(" ");
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

function min(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.min(...finite) : null;
}

function max(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.max(...finite) : null;
}

function numericRange(values) {
  return [min(values), max(values)];
}

function hashString(value) {
  let hash = 0;
  for (const char of String(value)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash).toString(36);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderReport(result) {
  return `# Claim Support Verifier

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no compute. It trains on non-final claim-level support labels and uses final-window candidate labels only as forbidden diagnostics.

| Split | Examples/pairs | Correct/selected | Rate |
| --- | ---: | ---: | ---: |
| Train claim classification | ${result.metrics.train_claim_classification.examples} | ${result.metrics.train_claim_classification.correct} | ${pct(result.metrics.train_claim_classification.accuracy)} |
| Validation claim classification | ${result.metrics.validation_claim_classification.examples} | ${result.metrics.validation_claim_classification.correct} | ${pct(result.metrics.validation_claim_classification.accuracy)} |
| Non-final validation pairwise | ${result.metrics.nonfinal_validation_pairwise.pairs} | ${result.metrics.nonfinal_validation_pairwise.correct} | ${pct(result.metrics.nonfinal_validation_pairwise.accuracy)} |
| Existing validation pairwise | ${result.metrics.existing_validation_pairwise.pairs} | ${result.metrics.existing_validation_pairwise.correct} | ${pct(result.metrics.existing_validation_pairwise.accuracy)} |
| Final diagnostic pairwise | ${result.metrics.final_diagnostic_pairwise.pairs} | ${result.metrics.final_diagnostic_pairwise.correct} | ${pct(result.metrics.final_diagnostic_pairwise.accuracy)} |
| Final diagnostic selection | ${result.metrics.final_diagnostic_selection.examples} | ${result.metrics.final_diagnostic_selection.selected_supported} | ${pct(result.metrics.final_diagnostic_selection.selection_support_rate)} |

## Decision

- Integrate selector now: ${result.decision.integrate_selector_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function pct(value) {
  return `${(100 * Number(value || 0)).toFixed(1)}%`;
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
