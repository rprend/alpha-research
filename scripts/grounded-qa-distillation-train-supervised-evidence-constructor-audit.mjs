import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");

const runId = "train-supervised-evidence-constructor-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);
const launchPacketRunId = "frontier-repaired-launch-packet-2026-06-29-v1";
const validationGateRunId = "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const routerRunId = "train-supervised-candidate-router-audit-frontier-repaired-v1";

const featureNames = [
  "bias",
  "question_text_overlap",
  "question_text_density",
  "question_section_overlap",
  "rank_score",
  "has_numeric_overlap",
  "question_has_number",
  "evidence_has_number",
  "section_is_results",
  "section_is_method",
  "contains_table_or_figure",
  "answerability_cue",
  "negation_cue",
  "counterfactual_prompt",
  "risky_question",
];
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model dataset task result results use uses is in on of to a an by as or be can it its we our you your answer question evidence pack".split(" "));

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const trainRows = await readJsonl(path.join(runsDir, launchPacketRunId, "dataset", "sft_train.jsonl"));
const validationPrompts = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_prompts.jsonl"));
const validationTargets = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const validationTargetById = new Map(validationTargets.map((row) => [row.example_id, row.target]));

const trainTune = trainRows.slice(0, 160).map((row) => ({ example_id: row.example_id, input: row.input, target: row.target, split: "train_tune" }));
const trainHeldout = trainRows.slice(160).map((row) => ({ example_id: row.example_id, input: row.input, target: row.target, split: "train_heldout" }));
const validationRows = validationPrompts.map((row) => ({
  example_id: row.example_id,
  input: row.input,
  target: validationTargetById.get(row.example_id),
  split: "repaired_validation_gate",
}));

const trainEvidenceRows = evidenceRowsFor(trainTune);
const scaler = makeScaler(trainEvidenceRows.map((row) => row.feature_values));
const model = trainLogistic(trainEvidenceRows, scaler, { epochs: 1600, learningRate: 0.08, l2: 0.015 });
const scored = {
  train_tune: scoreRows(trainTune),
  train_heldout: scoreRows(trainHeldout),
  repaired_validation_gate: scoreRows(validationRows),
};

const policyRows = [];
for (const answerThreshold of [0.18, 0.22, 0.26, 0.30, 0.34, 0.38, 0.42, 0.48, 0.54]) {
  for (const citationThreshold of [0.18, 0.22, 0.26, 0.30, 0.34, 0.38, 0.44]) {
    for (const maxCitations of [1, 2, 3]) {
      for (const minMargin of [-0.05, 0, 0.04, 0.08, 0.12]) {
        policyRows.push(evaluatePolicy({ answer_threshold: answerThreshold, citation_threshold: citationThreshold, max_citations: maxCitations, min_margin: minMargin }));
      }
    }
  }
}
const selectedPolicy = [...policyRows].sort((left, right) =>
  -left.train_heldout.contract_correct + right.train_heldout.contract_correct
  || -left.train_heldout.grounded_target_contract_correct + right.train_heldout.grounded_target_contract_correct
  || left.train_heldout.selected_grounded_answers - right.train_heldout.selected_grounded_answers
  || left.policy_id.localeCompare(right.policy_id)
)[0];
const selectedPredictions = {
  train_tune: predictRows(scored.train_tune, selectedPolicy.policy),
  train_heldout: predictRows(scored.train_heldout, selectedPolicy.policy),
  repaired_validation_gate: predictRows(scored.repaired_validation_gate, selectedPolicy.policy),
};
const metrics = {
  train_tune: summarizePredictions(selectedPredictions.train_tune),
  train_heldout: summarizePredictions(selectedPredictions.train_heldout),
  repaired_validation_gate: summarizePredictions(selectedPredictions.repaired_validation_gate),
};
const validationOracle = summarizeOracle(scored.repaired_validation_gate);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "train_supervised_evidence_constructor_audit",
  status: statusFor(metrics.repaired_validation_gate),
  purpose: "Train a lightweight evidence/citation constructor from repaired train rows to test whether candidate construction, not routing, is the current grounded-answer bottleneck.",
  source_runs: {
    launch_packet_run_id: launchPacketRunId,
    validation_gate_run_id: validationGateRunId,
    comparison_router: routerRunId,
  },
  leakage_note: "Evidence weights are trained only on the first 160 repaired train rows. Constructor thresholds are selected only on repaired train-heldout rows. Repaired validation labels are used only for reporting.",
  training: {
    train_examples: trainTune.length,
    train_evidence_rows: trainEvidenceRows.length,
    positive_evidence_rows: trainEvidenceRows.filter((row) => row.label_cited).length,
    feature_names: featureNames,
    model: {
      weights: model.weights,
      intercept: model.intercept,
      feature_means: scaler.means,
      feature_scales: scaler.scales,
    },
  },
  selected_policy: selectedPolicy,
  metrics,
  oracle: {
    repaired_validation_gate: validationOracle,
  },
  baseline_comparison: {
    train_calibrated_scaffold_contract_correct: 44,
    train_supervised_router_contract_correct: 47,
    evidence_constructor_validation_contract_correct: metrics.repaired_validation_gate.contract_correct,
    delta_vs_train_calibrated_scaffold: metrics.repaired_validation_gate.contract_correct - 44,
    delta_vs_train_supervised_router: metrics.repaired_validation_gate.contract_correct - 47,
    evidence_constructor_oracle_contract_correct: validationOracle.contract_correct,
  },
  decision: decisionFor(metrics.repaired_validation_gate),
  budget: {
    max_budget_usd: Number(budget.max_budget_usd),
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual),
    remaining_budget_usd: Number(budget.spend_usd?.remaining),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "This audit trains a local logistic evidence selector and deterministic answer constructor over existing repaired artifacts.",
  },
  artifacts: {
    evidence_training_rows_jsonl: rel(path.join(outputDir, "evidence_training_rows.jsonl")),
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    train_tune_predictions_jsonl: rel(path.join(outputDir, "train_tune_predictions.jsonl")),
    train_heldout_predictions_jsonl: rel(path.join(outputDir, "train_heldout_predictions.jsonl")),
    validation_predictions_jsonl: rel(path.join(outputDir, "validation_predictions.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "evidence_training_rows.jsonl"), trainEvidenceRows);
await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), policyRows);
await writeJsonl(path.join(outputDir, "train_tune_predictions.jsonl"), selectedPredictions.train_tune);
await writeJsonl(path.join(outputDir, "train_heldout_predictions.jsonl"), selectedPredictions.train_heldout);
await writeJsonl(path.join(outputDir, "validation_predictions.jsonl"), selectedPredictions.repaired_validation_gate);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_policy: result.selected_policy,
  metrics: result.metrics,
  oracle: result.oracle,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function evidenceRowsFor(rows) {
  const evidenceRows = [];
  for (const row of rows) {
    const cited = new Set(normalizeCitations(row.target?.citations));
    for (const evidence of row.input.compact_retrieved_evidence_pack ?? []) {
      evidenceRows.push({
        example_id: row.example_id,
        split: row.split,
        evidence_id: evidence.evidence_id,
        target_answer_type: row.target?.answer_type,
        label_cited: row.target?.answer_type === "grounded_answer" && cited.has(evidence.evidence_id) ? 1 : 0,
        feature_values: evidenceFeatures(row.input, evidence),
      });
    }
  }
  return evidenceRows;
}

function scoreRows(rows) {
  return rows.map((row) => {
    const evidenceScores = (row.input.compact_retrieved_evidence_pack ?? []).map((evidence) => {
      const featureValues = evidenceFeatures(row.input, evidence);
      return {
        evidence_id: evidence.evidence_id,
        probability: predictProb(model, scaler, featureValues),
        feature_values: featureValues,
        section: evidence.section,
        text: evidence.text,
        retrieval_rank: evidence.retrieval_rank,
      };
    }).sort((left, right) => right.probability - left.probability || Number(left.retrieval_rank ?? 99) - Number(right.retrieval_rank ?? 99) || left.evidence_id.localeCompare(right.evidence_id));
    return {
      example_id: row.example_id,
      split: row.split,
      input: row.input,
      target: row.target,
      evidence_scores: evidenceScores,
    };
  });
}

function evaluatePolicy(policy) {
  const trainTunePredictions = predictRows(scored.train_tune, policy);
  const trainHeldoutPredictions = predictRows(scored.train_heldout, policy);
  const validationPredictions = predictRows(scored.repaired_validation_gate, policy);
  return {
    policy_id: policyId(policy),
    policy,
    train_tune: summarizePredictions(trainTunePredictions),
    train_heldout: summarizePredictions(trainHeldoutPredictions),
    repaired_validation_gate: summarizePredictions(validationPredictions),
  };
}

function predictRows(rows, policy) {
  return rows.map((row) => {
    const prediction = constructPrediction(row, policy);
    const score = scorePrediction(prediction, row.target);
    return {
      example_id: row.example_id,
      split: row.split,
      target_answer_type: row.target?.answer_type,
      prediction,
      selected_evidence_scores: row.evidence_scores.slice(0, 5).map(({ text, ...scoreRow }) => scoreRow),
      contract_correct: score.contract_correct,
      answer_type_correct: score.answer_type_correct,
      citation_set_exact: score.citation_set_exact,
    };
  });
}

function constructPrediction(row, policy) {
  const top = row.evidence_scores[0];
  const second = row.evidence_scores[1];
  const margin = Number(top?.probability ?? 0) - Number(second?.probability ?? 0);
  if (!top || top.probability < policy.answer_threshold || margin < policy.min_margin) {
    return abstain("The trained evidence constructor did not find a sufficiently direct cited span.");
  }
  const selected = row.evidence_scores
    .filter((scoreRow, index) => index === 0 || scoreRow.probability >= policy.citation_threshold)
    .slice(0, policy.max_citations);
  if (!selected.length) return abstain("The trained evidence constructor did not select a citation.");
  const evidenceById = new Map((row.input.compact_retrieved_evidence_pack ?? []).map((evidence) => [evidence.evidence_id, evidence]));
  const citations = selected.map((scoreRow) => scoreRow.evidence_id);
  const sentences = selected.map((scoreRow) => bestSentence(row.input.question, evidenceById.get(scoreRow.evidence_id)?.text ?? scoreRow.text));
  const answer = `${sentences.join(" ")} ${citations.map((id) => `[${id}]`).join(" ")}`.replace(/\s+/g, " ").trim();
  return {
    answer_type: "grounded_answer",
    answer,
    citations,
    claim_table: sentences.map((sentence, index) => ({
      claim: sentence,
      support: "supported",
      citations: [citations[index]],
    })),
    abstention_reason: null,
  };
}

function evidenceFeatures(input, evidence) {
  const questionTokens = tokenSet(input?.question);
  const textTokens = tokenList(evidence?.text);
  const sectionTokens = tokenSet(evidence?.section);
  const textTokenSet = new Set(textTokens);
  const overlap = overlapCount(questionTokens, textTokenSet);
  const sectionOverlap = overlapCount(questionTokens, sectionTokens);
  const questionNumbers = numberSet(input?.question);
  const evidenceNumbers = numberSet(`${evidence?.section ?? ""} ${evidence?.text ?? ""}`);
  const text = `${evidence?.section ?? ""} ${evidence?.text ?? ""}`.toLowerCase();
  return [
    1,
    questionTokens.size ? overlap / questionTokens.size : 0,
    textTokens.length ? overlap / textTokens.length : 0,
    questionTokens.size ? sectionOverlap / questionTokens.size : 0,
    1 / Math.max(1, Number(evidence?.retrieval_rank ?? 1)),
    intersectionSize(questionNumbers, evidenceNumbers) > 0 ? 1 : 0,
    questionNumbers.size > 0 ? 1 : 0,
    evidenceNumbers.size > 0 ? 1 : 0,
    /\b(result|experiment|evaluation|finding|table|score|accuracy|performance)\b/i.test(evidence?.section ?? "") ? 1 : 0,
    /\b(method|approach|model|dataset|setup|implementation)\b/i.test(evidence?.section ?? "") ? 1 : 0,
    /\b(table|figure|fig\.|appendix)\b/i.test(text) ? 1 : 0,
    /\b(show|shows|found|report|reported|achieve|outperform|improve|use|uses|include|consist|contain)\b/i.test(text) ? 1 : 0,
    /\b(no|not|never|without|none|neither|nor)\b/i.test(text) ? 1 : 0,
    Boolean(input?.document_metadata?.counterfactual) ? 1 : 0,
    isRiskyQuestion(input?.question) ? 1 : 0,
  ];
}

function summarizePredictions(rows) {
  const correct = rows.filter((row) => row.contract_correct).length;
  const answerType = rows.filter((row) => row.answer_type_correct).length;
  const citation = rows.filter((row) => row.citation_set_exact).length;
  const groundedTargets = rows.filter((row) => row.target_answer_type === "grounded_answer");
  const abstainTargets = rows.filter((row) => row.target_answer_type === "abstain");
  return {
    examples: rows.length,
    contract_correct: correct,
    contract_correct_rate: rate(correct, rows.length),
    answer_type_correct: answerType,
    answer_type_accuracy: rate(answerType, rows.length),
    citation_set_exact: citation,
    citation_set_exact_rate: rate(citation, rows.length),
    grounded_target_examples: groundedTargets.length,
    grounded_target_contract_correct: groundedTargets.filter((row) => row.contract_correct).length,
    abstain_target_examples: abstainTargets.length,
    abstain_target_contract_correct: abstainTargets.filter((row) => row.contract_correct).length,
    selected_grounded_answers: rows.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    selected_abstentions: rows.filter((row) => row.prediction.answer_type === "abstain").length,
  };
}

function summarizeOracle(rows) {
  const oraclePredictions = rows.map((row) => {
    if (row.target?.answer_type === "abstain") return { contract_correct: true };
    const targetCitations = normalizeCitations(row.target?.citations);
    const evidenceIds = new Set((row.input.compact_retrieved_evidence_pack ?? []).map((evidence) => evidence.evidence_id));
    return { contract_correct: targetCitations.length > 0 && targetCitations.every((id) => evidenceIds.has(id)) };
  });
  const correct = oraclePredictions.filter((row) => row.contract_correct).length;
  return {
    examples: rows.length,
    contract_correct: correct,
    contract_correct_rate: rate(correct, rows.length),
  };
}

function statusFor(validationMetrics) {
  if (validationMetrics.contract_correct > 47) return "evidence_constructor_beats_router";
  if (validationMetrics.contract_correct > 44) return "evidence_constructor_beats_scaffold_not_router";
  if (validationMetrics.contract_correct === 44) return "evidence_constructor_ties_scaffold";
  return "evidence_constructor_does_not_beat_scaffold";
}

function decisionFor(validationMetrics) {
  if (validationMetrics.contract_correct > 47) {
    return {
      buy_openai_judgments_now: false,
      launch_prime_now: false,
      promote_as_candidate_system: false,
      next_step: "Add this constructor to the candidate pool and run a fresh heldout router test before paid judging.",
      reason: "The train-supervised evidence constructor beats the current router on repaired validation, but still needs a fresh holdout before promotion.",
    };
  }
  if (validationMetrics.contract_correct > 44) {
    return {
      buy_openai_judgments_now: false,
      launch_prime_now: false,
      promote_as_candidate_system: false,
      next_step: "Use this as a candidate-construction ablation, but do not replace the router; next test should combine it with router candidates under fresh heldout supervision.",
      reason: "The constructor beats the scaffold but not the current train-supervised router.",
    };
  }
  return {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    promote_as_candidate_system: false,
    next_step: "Do not add this constructor as a new candidate system; move to richer supervision or targeted generation for grounded-answer candidates.",
    reason: "The train-supervised evidence constructor does not clear the scaffold baseline.",
  };
}

function renderReport(result) {
  const selected = result.selected_policy;
  return `# Train-Supervised Evidence Constructor Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls and launches no Prime job. It trains a local evidence citation selector on repaired train-tune rows, selects constructor thresholds on repaired train-heldout rows, and reports transfer on repaired validation.

## Selected Policy

- Policy: ${selected.policy_id}
- Train heldout: ${selected.train_heldout.contract_correct}/${selected.train_heldout.examples} (${pct(selected.train_heldout.contract_correct_rate)})
- Repaired validation: ${selected.repaired_validation_gate.contract_correct}/${selected.repaired_validation_gate.examples} (${pct(selected.repaired_validation_gate.contract_correct_rate)})

## Metrics

| Split | Contract Correct | Answer Type | Citation Exact | Grounded Targets | Abstain Targets |
| --- | ---: | ---: | ---: | ---: | ---: |
| Train tune | ${result.metrics.train_tune.contract_correct}/${result.metrics.train_tune.examples} | ${pct(result.metrics.train_tune.answer_type_accuracy)} | ${pct(result.metrics.train_tune.citation_set_exact_rate)} | ${result.metrics.train_tune.grounded_target_contract_correct}/${result.metrics.train_tune.grounded_target_examples} | ${result.metrics.train_tune.abstain_target_contract_correct}/${result.metrics.train_tune.abstain_target_examples} |
| Train heldout | ${result.metrics.train_heldout.contract_correct}/${result.metrics.train_heldout.examples} | ${pct(result.metrics.train_heldout.answer_type_accuracy)} | ${pct(result.metrics.train_heldout.citation_set_exact_rate)} | ${result.metrics.train_heldout.grounded_target_contract_correct}/${result.metrics.train_heldout.grounded_target_examples} | ${result.metrics.train_heldout.abstain_target_contract_correct}/${result.metrics.train_heldout.abstain_target_examples} |
| Repaired validation | ${result.metrics.repaired_validation_gate.contract_correct}/${result.metrics.repaired_validation_gate.examples} | ${pct(result.metrics.repaired_validation_gate.answer_type_accuracy)} | ${pct(result.metrics.repaired_validation_gate.citation_set_exact_rate)} | ${result.metrics.repaired_validation_gate.grounded_target_contract_correct}/${result.metrics.repaired_validation_gate.grounded_target_examples} | ${result.metrics.repaired_validation_gate.abstain_target_contract_correct}/${result.metrics.repaired_validation_gate.abstain_target_examples} |

## Baseline Comparison

- Train-calibrated scaffold: ${result.baseline_comparison.train_calibrated_scaffold_contract_correct}/70
- Train-supervised router: ${result.baseline_comparison.train_supervised_router_contract_correct}/70
- Evidence constructor: ${result.baseline_comparison.evidence_constructor_validation_contract_correct}/70
- Delta vs scaffold: ${result.baseline_comparison.delta_vs_train_calibrated_scaffold}
- Delta vs router: ${result.baseline_comparison.delta_vs_train_supervised_router}

## Decision

- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Promote as candidate system: ${result.decision.promote_as_candidate_system ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function trainLogistic(rows, scaler, options) {
  const dim = rows[0]?.feature_values.length ?? 0;
  const weights = Array(dim).fill(0);
  let intercept = 0;
  for (let epoch = 0; epoch < options.epochs; epoch += 1) {
    const grad = Array(dim).fill(0);
    let biasGrad = 0;
    for (const row of rows) {
      const x = scale(row.feature_values, scaler);
      const prediction = sigmoid(dot(weights, x) + intercept);
      const error = prediction - row.label_cited;
      biasGrad += error;
      for (let i = 0; i < dim; i += 1) grad[i] += error * x[i];
    }
    const n = Math.max(1, rows.length);
    intercept -= options.learningRate * (biasGrad / n);
    for (let i = 0; i < dim; i += 1) weights[i] -= options.learningRate * ((grad[i] / n) + (options.l2 * weights[i]));
  }
  return { weights, intercept };
}

function predictProb(model, scaler, features) {
  return sigmoid(dot(model.weights, scale(features, scaler)) + model.intercept);
}

function makeScaler(rows) {
  const dim = rows[0]?.length ?? 0;
  const means = Array(dim).fill(0);
  const scales = Array(dim).fill(1);
  for (const row of rows) for (let i = 0; i < dim; i += 1) means[i] += row[i] ?? 0;
  for (let i = 0; i < dim; i += 1) means[i] /= Math.max(1, rows.length);
  for (const row of rows) for (let i = 0; i < dim; i += 1) scales[i] += ((row[i] ?? 0) - means[i]) ** 2;
  for (let i = 0; i < dim; i += 1) scales[i] = Math.sqrt(scales[i] / Math.max(1, rows.length)) || 1;
  return { means, scales };
}

function scale(features, scaler) {
  return features.map((value, index) => (Number(value ?? 0) - scaler.means[index]) / scaler.scales[index]);
}

function scorePrediction(prediction, target) {
  const answerTypeCorrect = prediction?.answer_type === target?.answer_type;
  const citationSetExact = prediction?.answer_type === "abstain"
    ? normalizeCitations(prediction?.citations).length === 0
    : sameCitationSet(prediction?.citations, target?.citations ?? []);
  return {
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    contract_correct: Boolean(answerTypeCorrect && citationSetExact),
  };
}

function abstain(reason) {
  return {
    answer_type: "abstain",
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: reason,
  };
}

function bestSentence(question, text) {
  const questionTokens = tokenSet(question);
  return splitSentences(text)
    .map((sentence) => ({ sentence: cleanSentence(sentence), score: overlapScore(questionTokens, sentence) }))
    .sort((left, right) => right.score - left.score)[0]?.sentence ?? cleanSentence(text);
}

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean).slice(0, 8);
}

function cleanSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function overlapScore(questionTokens, text) {
  const tokens = tokenList(text);
  if (!tokens.length || !questionTokens.size) return 0;
  const tokenSetValue = new Set(tokens);
  const overlap = overlapCount(questionTokens, tokenSetValue);
  return overlap / questionTokens.size + overlap / tokens.length;
}

function tokenList(text) {
  return String(text ?? "").toLowerCase().split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stopwords.has(token));
}

function tokenSet(text) {
  return new Set(tokenList(text));
}

function numberSet(text) {
  return new Set([...String(text ?? "").matchAll(/\b\d+(?:[,.]\d+)*(?:\.\d+)?%?\b/g)].map((match) => match[0]));
}

function overlapCount(leftSet, rightSet) {
  let total = 0;
  for (const value of leftSet) if (rightSet.has(value)) total += 1;
  return total;
}

function intersectionSize(leftSet, rightSet) {
  let total = 0;
  for (const value of leftSet) if (rightSet.has(value)) total += 1;
  return total;
}

function isRiskyQuestion(question) {
  return /\b(percentage|percent|how many|how much|statistically significant|which are three|compare|difference|ratio|previous|state.of.the.art|fewer|more)\b/i.test(question ?? "");
}

function sameCitationSet(left, right) {
  const leftSet = new Set(normalizeCitations(left));
  const rightSet = new Set(normalizeCitations(right));
  if (leftSet.size !== rightSet.size) return false;
  for (const value of leftSet) if (!rightSet.has(value)) return false;
  return true;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation)).filter(Boolean);
}

function dot(left, right) {
  let total = 0;
  for (let i = 0; i < left.length; i += 1) total += left[i] * (right[i] ?? 0);
  return total;
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value))));
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function policyId(policy) {
  return `answer_${thresholdName(policy.answer_threshold)}_cite_${thresholdName(policy.citation_threshold)}_k_${policy.max_citations}_margin_${thresholdName(policy.min_margin)}`;
}

function thresholdName(value) {
  return String(value).replace("-", "m").replace(".", "p");
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}
