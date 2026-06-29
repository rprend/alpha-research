import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "fresh-nonfinal-learned-citation-set-audit-v1";
const packetRunId = args["packet-run-id"] ?? "frontier-full-nonfinal-packet-2026-06-29-v1";
const patternRunId = args["pattern-run-id"] ?? "fresh-nonfinal-pattern-constructor-audit-v1";
const outputDir = path.join(runsDir, runId);
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model models dataset datasets task result results use uses is in on of to a an by as or be can it its we our you your answer question evidence pack".split(" "));

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
  "section_is_experiment",
  "contains_table_or_figure",
  "intent_dataset_match",
  "intent_model_match",
  "intent_method_match",
  "intent_metric_match",
  "intent_numeric_match",
  "counterfactual_prompt",
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const pattern = await readJson(path.join(runsDir, patternRunId, "result.json"));
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const targetById = new Map(targets.map((row) => [row.example_id, row.target]));
const rows = prompts.map((prompt) => ({
  example_id: prompt.example_id,
  source_split: prompt.source_split,
  input: prompt.input,
  target: targetById.get(prompt.example_id),
}));
const trainRows = rows.filter((row) => row.source_split === "train");
const trainTune = trainRows.slice(0, 160).map((row) => ({ ...row, split: "train_tune" }));
const trainHeldout = trainRows.slice(160).map((row) => ({ ...row, split: "train_heldout" }));
const validationRows = rows.filter((row) => row.source_split === "validation").map((row) => ({ ...row, split: "fresh_validation" }));

const trainEvidenceRows = evidenceRowsFor(trainTune);
const scaler = makeScaler(trainEvidenceRows.map((row) => row.feature_values));
const model = trainLogistic(trainEvidenceRows, scaler, { epochs: 1400, learningRate: 0.07, l2: 0.02 });
const scored = {
  train_tune: scoreRows(trainTune),
  train_heldout: scoreRows(trainHeldout),
  fresh_validation: scoreRows(validationRows),
};

const policyRows = [];
for (const answerThreshold of [0.18, 0.24, 0.30, 0.36, 0.44, 0.52, 0.62]) {
  for (const citationThreshold of [0.16, 0.22, 0.30, 0.38, 0.48]) {
    for (const maxCitations of [1, 2, 3, 4]) {
      for (const minMargin of [-0.08, 0, 0.05, 0.1]) {
        policyRows.push(evaluatePolicy({ answer_threshold: answerThreshold, citation_threshold: citationThreshold, max_citations: maxCitations, min_margin: minMargin }));
      }
    }
  }
}
const selectedPolicy = [...policyRows].sort((left, right) =>
  right.train_heldout.contract_correct - left.train_heldout.contract_correct
  || right.train_heldout.grounded_target_contract_correct - left.train_heldout.grounded_target_contract_correct
  || left.train_heldout.over_answered_abstentions - right.train_heldout.over_answered_abstentions
  || left.policy_id.localeCompare(right.policy_id)
)[0];

const selectedPredictions = {
  train_tune: predictRows(scored.train_tune, selectedPolicy.policy),
  train_heldout: predictRows(scored.train_heldout, selectedPolicy.policy),
  fresh_validation: predictRows(scored.fresh_validation, selectedPolicy.policy),
};
const predictionJsonl = selectedPredictions.fresh_validation.map((row) => ({
  example_id: row.example_id,
  prediction: row.prediction,
  raw_output: JSON.stringify(row.prediction),
  metadata: {
    scaffold: "fresh_nonfinal_learned_citation_set",
    selected_policy: selectedPolicy.policy,
    no_model_weights_or_llm_calls: true,
  },
}));
const predictionsPath = path.join(outputDir, "fresh_validation_predictions_for_gate.jsonl");
await writeJsonl(predictionsPath, predictionJsonl);
const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);

const metrics = {
  train_tune: summarizePredictions(selectedPredictions.train_tune),
  train_heldout: summarizePredictions(selectedPredictions.train_heldout),
  fresh_validation: summarizePredictions(selectedPredictions.fresh_validation),
};
const oracle = {
  train_heldout: summarizeOracle(scored.train_heldout),
  fresh_validation: summarizeOracle(scored.fresh_validation),
};

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "fresh_nonfinal_learned_citation_set_audit",
  status: statusFor(metrics.fresh_validation, pattern),
  purpose: "Train a lightweight citation-set predictor on fresh nonfinal train rows and test whether learned evidence scoring beats the failed generic pattern constructor on fresh validation.",
  source_runs: {
    packet: packetRunId,
    failed_pattern_constructor: patternRunId,
    contract_gate: gateRunId,
  },
  leakage_note: "Evidence weights are trained only on the first 160 source_split=train rows. Constructor thresholds are selected only on the remaining source_split=train rows. Fresh source_split=validation targets are used only for reporting and the final contract gate.",
  training: {
    train_tune_examples: trainTune.length,
    train_heldout_examples: trainHeldout.length,
    fresh_validation_examples: validationRows.length,
    train_evidence_rows: trainEvidenceRows.length,
    positive_evidence_rows: count(trainEvidenceRows, (row) => row.label_cited),
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
  oracle,
  baseline_comparison: {
    pattern_constructor_fresh_contract_correct: Number(pattern.metrics?.contract_correct ?? 0),
    pattern_constructor_fresh_examples: Number(pattern.metrics?.examples ?? 0),
    learned_constructor_fresh_validation_contract_correct: metrics.fresh_validation.contract_correct,
    learned_constructor_fresh_validation_examples: metrics.fresh_validation.examples,
    learned_delta_vs_pattern_rate: metrics.fresh_validation.contract_correct_rate - Number(pattern.metrics?.contract_correct_rate ?? 0),
    learned_fresh_validation_oracle_contract_correct: oracle.fresh_validation.contract_correct,
  },
  decision: decisionFor(metrics.fresh_validation, oracle.fresh_validation, pattern),
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
    note: "This audit trains a local logistic evidence selector and uses the local contract gate only.",
  },
  artifacts: {
    evidence_training_rows_jsonl: rel(path.join(outputDir, "evidence_training_rows.jsonl")),
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    train_tune_predictions_jsonl: rel(path.join(outputDir, "train_tune_predictions.jsonl")),
    train_heldout_predictions_jsonl: rel(path.join(outputDir, "train_heldout_predictions.jsonl")),
    fresh_validation_predictions_jsonl: rel(path.join(outputDir, "fresh_validation_predictions.jsonl")),
    contract_gate_result_json: rel(path.join(runsDir, gateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "evidence_training_rows.jsonl"), trainEvidenceRows);
await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), policyRows);
await writeJsonl(path.join(outputDir, "train_tune_predictions.jsonl"), selectedPredictions.train_tune);
await writeJsonl(path.join(outputDir, "train_heldout_predictions.jsonl"), selectedPredictions.train_heldout);
await writeJsonl(path.join(outputDir, "fresh_validation_predictions.jsonl"), selectedPredictions.fresh_validation);
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
  llm_budget: result.llm_budget,
}, null, 2));

function evidenceRowsFor(sourceRows) {
  const out = [];
  for (const row of sourceRows) {
    const cited = new Set(normalizeCitations(row.target?.citations));
    for (const evidence of row.input.compact_retrieved_evidence_pack ?? []) {
      out.push({
        example_id: row.example_id,
        split: row.split,
        evidence_id: evidence.evidence_id,
        target_answer_type: row.target?.answer_type,
        label_cited: row.target?.answer_type === "grounded_answer" && cited.has(evidence.evidence_id) ? 1 : 0,
        feature_values: evidenceFeatures(row.input, evidence),
      });
    }
  }
  return out;
}

function scoreRows(sourceRows) {
  return sourceRows.map((row) => {
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
    return { ...row, evidence_scores: evidenceScores };
  });
}

function evaluatePolicy(policy) {
  return {
    policy_id: policyId(policy),
    policy,
    train_tune: summarizePredictions(predictRows(scored.train_tune, policy)),
    train_heldout: summarizePredictions(predictRows(scored.train_heldout, policy)),
    fresh_validation: summarizePredictions(predictRows(scored.fresh_validation, policy)),
  };
}

function predictRows(sourceRows, policy) {
  return sourceRows.map((row) => {
    const prediction = constructPrediction(row, policy);
    const score = scorePrediction(prediction, row.target);
    return {
      example_id: row.example_id,
      split: row.split,
      source_split: row.source_split,
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
    return abstain(row.input.question, "The learned citation-set constructor did not find sufficiently direct evidence.");
  }
  const selected = row.evidence_scores
    .filter((scoreRow, index) => index === 0 || scoreRow.probability >= policy.citation_threshold)
    .slice(0, policy.max_citations);
  if (!selected.length) return abstain(row.input.question, "The learned citation-set constructor did not select citations.");
  const evidenceById = new Map((row.input.compact_retrieved_evidence_pack ?? []).map((evidence) => [evidence.evidence_id, evidence]));
  const citations = selected.map((scoreRow) => scoreRow.evidence_id);
  const claims = selected.map((scoreRow, index) => ({
    claim_id: `C${index + 1}`,
    claim: bestSentence(row.input.question, evidenceById.get(scoreRow.evidence_id)?.text ?? scoreRow.text),
    citations: [scoreRow.evidence_id],
    support_status: "supported",
  }));
  return {
    answer_type: "grounded_answer",
    evidence_first: { sufficiency: "sufficient", supported_claims: claims, missing_support: "", question_target: row.input.question ?? "exact_question_target" },
    answer: `${claims.map((claim) => claim.claim).join(" ")} ${citations.map((id) => `[${id}]`).join(" ")}`.replace(/\s+/g, " ").trim(),
    citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function evidenceFeatures(input, evidence) {
  const question = input.question ?? "";
  const questionTokens = contentTokens(question);
  const evidenceTokens = contentTokens(`${evidence.section ?? ""} ${evidence.text ?? ""}`);
  const sectionTokens = contentTokens(evidence.section ?? "");
  const qSet = new Set(questionTokens);
  const eSet = new Set(evidenceTokens);
  const sSet = new Set(sectionTokens);
  const overlap = [...qSet].filter((token) => eSet.has(token)).length;
  const sectionOverlap = [...qSet].filter((token) => sSet.has(token)).length;
  const qNums = new Set((question.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []).map(String));
  const eNums = new Set((`${evidence.section ?? ""} ${evidence.text ?? ""}`.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []).map(String));
  const numericOverlap = [...qNums].some((num) => eNums.has(num));
  const section = String(evidence.section ?? "").toLowerCase();
  const text = `${evidence.section ?? ""} ${evidence.text ?? ""}`.toLowerCase();
  const intent = questionIntent(question);
  return [
    1,
    safeDiv(overlap, Math.max(1, qSet.size)),
    safeDiv(overlap, Math.max(1, eSet.size)),
    safeDiv(sectionOverlap, Math.max(1, qSet.size)),
    1 / Math.max(1, Number(evidence.retrieval_rank ?? 1)),
    numericOverlap ? 1 : 0,
    qNums.size ? 1 : 0,
    eNums.size ? 1 : 0,
    /result|finding|analysis|performance|evaluation/.test(section) ? 1 : 0,
    /method|approach|model|architecture/.test(section) ? 1 : 0,
    /experiment|baseline|setup|dataset/.test(section) ? 1 : 0,
    /table|figure|tabref|figref|float selected/.test(text) ? 1 : 0,
    intent === "dataset" && /dataset|corpus|benchmark|data set/.test(text) ? 1 : 0,
    intent === "model_comparison" && /baseline|compare|model|bert|lstm|cnn|gpt|seq2seq/.test(text) ? 1 : 0,
    intent === "architecture_or_method" && /architecture|encoder|decoder|attention|method|approach|module/.test(text) ? 1 : 0,
    intent === "evaluation_metric" && /metric|score|evaluation|perplexity|rouge|bleu|accuracy|f1|ranking/.test(text) ? 1 : 0,
    intent === "numeric" && eNums.size ? 1 : 0,
    /counterfactual-insufficient/.test(input.document_metadata?.original_knowledge_base_version ?? input.question ?? "") ? 1 : 0,
  ];
}

function questionIntent(question) {
  const q = String(question ?? "").toLowerCase();
  if (/dataset|data set|corpus|benchmark|look at|used/.test(q)) return "dataset";
  if (/baseline|compared|compare|models|system/.test(q)) return "model_comparison";
  if (/architecture|architectures|component|cooperate|chains|approach/.test(q)) return "architecture_or_method";
  if (/metric|score|evaluated|evaluation|fluency|ranking|stylistic|measured/.test(q)) return "evaluation_metric";
  if (/\b(how many|how much|percent|percentage|size|sizes|large|big|number|vocabulary)\b/.test(q)) return "numeric";
  return "generic";
}

function scorePrediction(prediction, target) {
  const answerTypeCorrect = prediction.answer_type === target?.answer_type;
  const citationSetExact = prediction.answer_type === "abstain"
    ? normalizeCitations(prediction.citations).length === 0
    : setEqual(new Set(normalizeCitations(prediction.citations)), new Set(normalizeCitations(target?.citations)));
  return { answer_type_correct: answerTypeCorrect, citation_set_exact: citationSetExact, contract_correct: answerTypeCorrect && citationSetExact };
}

function summarizePredictions(predictions) {
  const correct = count(predictions, (row) => row.contract_correct);
  const groundedTargets = predictions.filter((row) => row.target_answer_type === "grounded_answer");
  return {
    examples: predictions.length,
    contract_correct: correct,
    contract_correct_rate: rate(correct, predictions.length),
    answer_type_correct: count(predictions, (row) => row.answer_type_correct),
    citation_set_exact: count(predictions, (row) => row.citation_set_exact),
    target_grounded_answer: groundedTargets.length,
    selected_grounded_answers: count(predictions, (row) => row.prediction.answer_type === "grounded_answer"),
    grounded_target_contract_correct: count(groundedTargets, (row) => row.contract_correct),
    false_abstentions: count(predictions, (row) => row.target_answer_type === "grounded_answer" && row.prediction.answer_type === "abstain"),
    over_answered_abstentions: count(predictions, (row) => row.target_answer_type === "abstain" && row.prediction.answer_type === "grounded_answer"),
    citation_errors: count(predictions, (row) => row.target_answer_type === "grounded_answer" && row.prediction.answer_type === "grounded_answer" && !row.citation_set_exact),
  };
}

function summarizeOracle(sourceRows) {
  const oracleRows = sourceRows.map((row) => {
    const cited = new Set(normalizeCitations(row.target?.citations));
    const available = row.target?.answer_type === "abstain" || row.evidence_scores.some((scoreRow) => cited.has(scoreRow.evidence_id));
    return { contract_correct: available };
  });
  const correct = count(oracleRows, (row) => row.contract_correct);
  return { examples: oracleRows.length, contract_correct: correct, contract_correct_rate: rate(correct, oracleRows.length) };
}

function trainLogistic(rows, scaler, options) {
  const dim = rows[0]?.feature_values?.length ?? 0;
  const weights = Array(dim).fill(0);
  let intercept = 0;
  for (let epoch = 0; epoch < options.epochs; epoch += 1) {
    const grad = Array(dim).fill(0);
    let biasGrad = 0;
    for (const row of rows) {
      const x = scale(row.feature_values, scaler);
      const y = Number(row.label_cited);
      const pred = sigmoid(dot(weights, x) + intercept);
      const err = pred - y;
      biasGrad += err;
      for (let i = 0; i < dim; i += 1) grad[i] += err * x[i];
    }
    const n = Math.max(1, rows.length);
    intercept -= options.learningRate * (biasGrad / n);
    for (let i = 0; i < dim; i += 1) weights[i] -= options.learningRate * ((grad[i] / n) + options.l2 * weights[i]);
  }
  return { weights, intercept };
}

function predictProb(modelRef, scaler, features) {
  return sigmoid(dot(modelRef.weights, scale(features, scaler)) + modelRef.intercept);
}

function makeScaler(featureRows) {
  const dim = featureRows[0]?.length ?? 0;
  const means = Array(dim).fill(0);
  const scales = Array(dim).fill(1);
  for (const row of featureRows) for (let i = 0; i < dim; i += 1) means[i] += row[i] ?? 0;
  for (let i = 0; i < dim; i += 1) means[i] /= Math.max(1, featureRows.length);
  for (const row of featureRows) for (let i = 0; i < dim; i += 1) scales[i] += ((row[i] ?? 0) - means[i]) ** 2;
  for (let i = 0; i < dim; i += 1) scales[i] = Math.sqrt(scales[i] / Math.max(1, featureRows.length)) || 1;
  return { means, scales };
}

function scale(features, scaler) {
  return features.map((value, index) => (Number(value ?? 0) - scaler.means[index]) / scaler.scales[index]);
}

function abstain(question, reason) {
  return {
    answer_type: "abstain",
    evidence_first: { sufficiency: "insufficient", supported_claims: [], missing_support: reason, question_target: question ?? "exact_question_target" },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: reason,
  };
}

function bestSentence(question, text) {
  const q = new Set(contentTokens(question));
  const selected = splitSentences(text)
    .map((sentence) => ({ sentence: cleanSentence(sentence), score: contentTokens(sentence).filter((token) => q.has(token)).length }))
    .sort((left, right) => right.score - left.score)[0];
  return selected?.sentence || cleanSentence(text);
}

async function runContractGate(gateRunId, predictionsPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join("scripts", "grounded-qa-distillation-evidence-first-contract-preflight.mjs"),
      `--packet-run-id=${packetRunId}`,
      `--prediction-file=${path.relative(rootDir, predictionsPath)}`,
      `--run-id=${gateRunId}`,
    ], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Contract gate failed with code ${code}: ${stderr}`));
    });
  });
  return readJson(path.join(runsDir, gateRunId, "result.json"));
}

function statusFor(validationMetrics, patternResult) {
  const patternRate = Number(patternResult.metrics?.contract_correct_rate ?? 0);
  if (validationMetrics.contract_correct_rate > patternRate + 0.05) return "learned_citation_set_beats_pattern_on_fresh_validation";
  if (validationMetrics.contract_correct_rate >= patternRate) return "learned_citation_set_matches_pattern_on_fresh_validation";
  return "learned_citation_set_below_pattern_on_fresh_validation";
}

function decisionFor(validationMetrics, validationOracle, patternResult) {
  const patternRate = Number(patternResult.metrics?.contract_correct_rate ?? 0);
  const beatsPattern = validationMetrics.contract_correct_rate > patternRate + 0.05;
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    promote_learned_constructor: false,
    keep_as_candidate_source: beatsPattern,
    next_step: beatsPattern
      ? "Use the learned citation-set predictor as a candidate source in a combined-pool fresh-validation router audit before paid labels."
      : "Do not spend on this local learner; scope a small targeted teacher-label packet for citation-set construction.",
    reason: beatsPattern
      ? `The learned citation-set predictor beats the generic pattern rate on fresh validation (${validationMetrics.contract_correct}/${validationMetrics.examples}) with oracle headroom ${validationOracle.contract_correct}/${validationOracle.examples}, but remains too weak as a standalone policy.`
      : `The learned citation-set predictor does not beat the generic pattern rate enough on fresh validation (${validationMetrics.contract_correct}/${validationMetrics.examples}); local labels/features are insufficient.`,
  };
}

function renderReport(result) {
  const m = result.metrics;
  return `# Fresh Nonfinal Learned Citation-Set Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime compute.

## Metrics

| Split | Contract correct | Grounded target correct | False abstain | Over-answer | Citation errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| Train tune | ${m.train_tune.contract_correct} / ${m.train_tune.examples} | ${m.train_tune.grounded_target_contract_correct} / ${m.train_tune.target_grounded_answer} | ${m.train_tune.false_abstentions} | ${m.train_tune.over_answered_abstentions} | ${m.train_tune.citation_errors} |
| Train heldout | ${m.train_heldout.contract_correct} / ${m.train_heldout.examples} | ${m.train_heldout.grounded_target_contract_correct} / ${m.train_heldout.target_grounded_answer} | ${m.train_heldout.false_abstentions} | ${m.train_heldout.over_answered_abstentions} | ${m.train_heldout.citation_errors} |
| Fresh validation | ${m.fresh_validation.contract_correct} / ${m.fresh_validation.examples} | ${m.fresh_validation.grounded_target_contract_correct} / ${m.fresh_validation.target_grounded_answer} | ${m.fresh_validation.false_abstentions} | ${m.fresh_validation.over_answered_abstentions} | ${m.fresh_validation.citation_errors} |

Fresh validation oracle headroom: ${result.oracle.fresh_validation.contract_correct}/${result.oracle.fresh_validation.examples}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Promote learned constructor: ${result.decision.promote_learned_constructor ? "yes" : "no"}
- Keep as candidate source: ${result.decision.keep_as_candidate_source ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function contentTokens(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !stopwords.has(token));
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation)).filter(Boolean);
}

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean).slice(0, 5);
}

function cleanSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 280);
}

function policyId(policy) {
  return `a${policy.answer_threshold}_c${policy.citation_threshold}_k${policy.max_citations}_m${policy.min_margin}`;
}

function safeDiv(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function dot(left, right) {
  let total = 0;
  for (let i = 0; i < left.length; i += 1) total += left[i] * (right[i] ?? 0);
  return total;
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value))));
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
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
