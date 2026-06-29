import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "nonreview-oracle-contrast-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "nonreview-citation-subset-selector-smoke-2026-06-29-v1";
const packetDir = path.join(runsDir, packetRunId, "dataset");
const outputDir = path.join(runsDir, runId);
const countPenaltyGrid = numberListArg(args["count-penalties"], [0, 0.03, 0.06, 0.1]);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const packet = await readJson(path.join(runsDir, packetRunId, "result.json"));
const trainRows = await readJsonl(path.join(packetDir, "sft_train.jsonl"));
const validationRows = await readJsonl(path.join(packetDir, "sft_validation.jsonl"));
const evalPrompts = await readJsonl(path.join(packetDir, "eval_prompts.jsonl"));
const evalTargets = await readJsonl(path.join(packetDir, "eval_targets_diagnostic.jsonl"));

const subsetFeatureNames = subsetFeatureVector(trainRows[0], enumerateCitationSubsets(trainRows[0])[0]).names;
const subsetTrainExamples = trainRows.flatMap(subsetTrainingExamples);
const subsetScaler = makeScaler(subsetTrainExamples.map((row) => row.x));
const subsetModel = trainLogistic(subsetTrainExamples.map((row) => ({ ...row, x: scaleVector(row.x, subsetScaler) })), { iterations: 2200, learningRate: 0.08, l2: 0.025 });

const answerFeatureNames = answerabilityFeatureVector(trainRows[0], subsetModel, subsetScaler).names;
const answerTrainExamples = trainRows.map((row) => ({
  x: answerabilityFeatureVector(row, subsetModel, subsetScaler).values,
  y: row.target.answer_type === "grounded_answer" ? 1 : 0,
}));
const answerScaler = makeScaler(answerTrainExamples.map((row) => row.x));
const answerModel = trainLogistic(answerTrainExamples.map((row) => ({ ...row, x: scaleVector(row.x, answerScaler) })), { iterations: 1400, learningRate: 0.08, l2: 0.03 });

const calibration = calibrate(validationRows, subsetModel, subsetScaler, answerModel, answerScaler);
const predictions = evalPrompts.map((row) => predictRow(row, calibration.selected_params, subsetModel, subsetScaler, answerModel, answerScaler));
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);

const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "nonreview_citation_subset_selector_smoke",
  status: statusFor(gate.metrics),
  purpose: "Test explicit evidence-subset citation selection for D437 non-review grounded QA without LLM or GPU spend.",
  source_runs: {
    packet: packetRunId,
    contract_gate: gateRunId,
  },
  source_context: {
    packet_status: packet.status,
    train_rows: trainRows.length,
    validation_rows: validationRows.length,
    eval_prompts: evalPrompts.length,
    eval_targets: evalTargets.length,
  },
  method: {
    type: "standardized_logistic_citation_subset_selector_plus_answerability_guard",
    subset_target: "candidate citation subset exactly equals target citations for grounded answers; abstentions train no positive subset",
    candidate_space: "all non-empty evidence id subsets up to size 4 from each compact evidence pack",
    threshold_selection: "validation contract correctness with answer-rate and citation-count regularization",
    count_penalty_grid: countPenaltyGrid,
    uses_counterfactual_metadata: true,
    openai_calls: 0,
    gpu_calls: 0,
  },
  models: {
    subset_selector: {
      feature_names: subsetFeatureNames,
      weights: Object.fromEntries(subsetFeatureNames.map((name, index) => [name, subsetModel.weights[index]])),
      bias: subsetModel.bias,
      scaler: subsetScaler,
      train_loss: subsetModel.loss,
      train_examples: subsetTrainExamples.length,
      positive_rate: rate(subsetTrainExamples.filter((row) => row.y === 1).length, subsetTrainExamples.length),
    },
    answerability: {
      feature_names: answerFeatureNames,
      weights: Object.fromEntries(answerFeatureNames.map((name, index) => [name, answerModel.weights[index]])),
      bias: answerModel.bias,
      scaler: answerScaler,
      train_loss: answerModel.loss,
      train_examples: answerTrainExamples.length,
      positive_rate: rate(answerTrainExamples.filter((row) => row.y === 1).length, answerTrainExamples.length),
    },
  },
  calibration,
  predictions: summarizePredictions(predictions),
  target_distribution: summarizeTargets(evalTargets),
  contract_gate_metrics: gate.metrics,
  baseline_comparison: {
    abstention_prior_rate: rate(evalTargets.filter((row) => row.target.answer_type === "abstain").length, evalTargets.length),
    cheap_scaffold_d439_rate: 37 / 64,
    citation_selector_d440_rate: 41 / 64,
    learned_verifier_d441_rate: 39 / 64,
    structured_group_nonreview_rate_from_d436: 47 / 64,
    four_source_oracle_nonreview_rate_from_d436: 57 / 64,
    delta_vs_d440: gate.metrics.overall_contract_correct_rate - (41 / 64),
    delta_vs_structured_group: gate.metrics.overall_contract_correct_rate - (47 / 64),
    gap_to_oracle: (57 / 64) - gate.metrics.overall_contract_correct_rate,
  },
  decision: decisionFor(gate.metrics),
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
    note: "Local subset selector only. No OpenAI, Prime, or other model calls.",
  },
  artifacts: {
    predictions_jsonl: rel(predictionsPath),
    contract_gate_result_json: rel(path.join(runsDir, gateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  calibration: result.calibration,
  predictions: result.predictions,
  contract_gate_metrics: result.contract_gate_metrics,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function subsetTrainingExamples(row) {
  const targetKey = key(normalizeCitations(row.target.citations ?? []));
  return enumerateCitationSubsets(row).map((subset) => ({
    example_id: row.example_id,
    citation_key: key(subset.ids),
    x: subsetFeatureVector(row, subset).values,
    y: row.target.answer_type === "grounded_answer" && key(subset.ids) === targetKey ? 1 : 0,
  }));
}

function calibrate(validationRows, subsetModel, subsetScaler, answerModel, answerScaler) {
  const answerThresholds = [0.24, 0.32, 0.4, 0.5, 0.6, 0.7];
  const subsetThresholds = [0.1, 0.18, 0.26, 0.34, 0.42, 0.5];
  const countPenalties = countPenaltyGrid;
  const candidates = [];
  for (const answerThreshold of answerThresholds) {
    for (const subsetThreshold of subsetThresholds) {
      for (const countPenalty of countPenalties) {
        const params = { answer_threshold: answerThreshold, subset_threshold: subsetThreshold, count_penalty: countPenalty };
        const metrics = scoreRows(validationRows, params, subsetModel, subsetScaler, answerModel, answerScaler);
        const objective = metrics.overall_contract_correct_rate
          - Math.abs(metrics.answer_rate - metrics.target_answer_rate) * 0.02
          - Math.abs(metrics.mean_citations_when_grounded - metrics.mean_target_citations_when_grounded) * 0.006;
        candidates.push({ params, metrics, objective });
      }
    }
  }
  candidates.sort((left, right) => right.objective - left.objective
    || right.metrics.overall_contract_correct_rate - left.metrics.overall_contract_correct_rate
    || right.metrics.citation_set_exact_rate - left.metrics.citation_set_exact_rate
    || right.metrics.answer_type_accuracy - left.metrics.answer_type_accuracy);
  return {
    validation_examples: validationRows.length,
    selected_by: "validation_contract_correct_with_answer_rate_and_citation_count_regularizers",
    selected_params: candidates[0].params,
    validation_metrics: candidates[0].metrics,
    validation_objective: candidates[0].objective,
    top_candidates: candidates.slice(0, 10).map((candidate) => ({
      params: candidate.params,
      validation_overall_contract_correct_rate: candidate.metrics.overall_contract_correct_rate,
      validation_answer_type_accuracy: candidate.metrics.answer_type_accuracy,
      validation_citation_set_exact_rate: candidate.metrics.citation_set_exact_rate,
      validation_answer_rate: candidate.metrics.answer_rate,
      validation_mean_citations_when_grounded: candidate.metrics.mean_citations_when_grounded,
      objective: candidate.objective,
    })),
  };
}

function scoreRows(rows, params, subsetModel, subsetScaler, answerModel, answerScaler) {
  const scored = rows.map((row) => {
    const prediction = buildPrediction(row, params, subsetModel, subsetScaler, answerModel, answerScaler);
    const target = row.target;
    const targetCitations = normalizeCitations(target.citations ?? []);
    const answerTypeCorrect = prediction.answer_type === target.answer_type;
    const citationSetExact = prediction.answer_type === "abstain"
      ? prediction.citations.length === 0
      : setEqual(new Set(prediction.citations), new Set(targetCitations));
    return {
      contract_correct: answerTypeCorrect && citationSetExact,
      answer_type_correct: answerTypeCorrect,
      citation_set_exact: citationSetExact,
      prediction_answer_type: prediction.answer_type,
      target_answer_type: target.answer_type,
      citations: prediction.citations.length,
      target_citations: targetCitations.length,
    };
  });
  const grounded = scored.filter((row) => row.prediction_answer_type === "grounded_answer");
  const targetGrounded = scored.filter((row) => row.target_answer_type === "grounded_answer");
  return {
    rows: scored.length,
    overall_contract_correct_rate: rate(scored.filter((row) => row.contract_correct).length, scored.length),
    answer_type_accuracy: rate(scored.filter((row) => row.answer_type_correct).length, scored.length),
    citation_set_exact_rate: rate(scored.filter((row) => row.citation_set_exact).length, scored.length),
    answer_rate: rate(grounded.length, scored.length),
    target_answer_rate: rate(targetGrounded.length, scored.length),
    mean_citations_when_grounded: mean(grounded.map((row) => row.citations)),
    mean_target_citations_when_grounded: mean(targetGrounded.map((row) => row.target_citations)),
  };
}

function predictRow(row, params, subsetModel, subsetScaler, answerModel, answerScaler) {
  const prediction = buildPrediction(row, params, subsetModel, subsetScaler, answerModel, answerScaler);
  return {
    example_id: row.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    metadata: {
      scaffold: "nonreview_citation_subset_selector",
      params,
      no_model_weights_or_llm_calls: true,
    },
  };
}

function buildPrediction(row, params, subsetModel, subsetScaler, answerModel, answerScaler) {
  const question = row.input.question ?? "";
  const counterfactual = row.input.document_metadata?.counterfactual === true || String(row.example_id).includes(":counterfactual-insufficient");
  const answerability = scoreAnswerability(row, subsetModel, subsetScaler, answerModel, answerScaler);
  if (counterfactual || answerability < params.answer_threshold) return abstain(question, answerability);
  const rankedSubsets = scoreSubsets(row, subsetModel, subsetScaler, params);
  const selectedSubset = rankedSubsets.find((subset) => subset.adjusted_score >= params.subset_threshold) ?? rankedSubsets[0];
  if (!selectedSubset?.ids?.length) return abstain(question, answerability);
  const selected = selectedSubset.ids.map((id) => evidenceById(row).get(id)).filter(Boolean);
  const claims = selected.map((item, index) => ({
    claim_id: `C${index + 1}`,
    claim: bestSentence(new Set(contentTokens(question)), item.text),
    citations: [item.evidence_id],
    support_status: "supported",
  }));
  const citations = selected.map((item) => item.evidence_id);
  return {
    answer_type: "grounded_answer",
    evidence_first: {
      sufficiency: "sufficient",
      supported_claims: claims,
      missing_support: "",
      question_target: question || "exact_question_target",
    },
    answer: `${claims.map((claim) => claim.claim).join(" ")} ${citations.map((id) => `[${id}]`).join(" ")}`,
    citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function scoreSubsets(row, subsetModel, subsetScaler, params) {
  return enumerateCitationSubsets(row).map((subset) => {
    const probability = predict(subsetModel, scaleVector(subsetFeatureVector(row, subset).values, subsetScaler));
    return {
      ...subset,
      probability,
      adjusted_score: probability - params.count_penalty * Math.max(0, subset.ids.length - 1),
    };
  }).sort((left, right) => right.adjusted_score - left.adjusted_score || right.probability - left.probability || left.ids.length - right.ids.length || key(left.ids).localeCompare(key(right.ids)));
}

function scoreAnswerability(row, subsetModel, subsetScaler, answerModel, answerScaler) {
  const vector = answerabilityFeatureVector(row, subsetModel, subsetScaler).values;
  return predict(answerModel, scaleVector(vector, answerScaler));
}

function enumerateCitationSubsets(row) {
  const ids = (row.input.compact_retrieved_evidence_pack ?? []).map((item) => item.evidence_id).filter(Boolean).slice(0, 7);
  const out = [];
  for (let mask = 1; mask < (1 << ids.length); mask += 1) {
    const subset = ids.filter((_, index) => mask & (1 << index));
    if (subset.length <= 4) out.push({ ids: subset });
  }
  return out;
}

function subsetFeatureVector(row, subset) {
  const ids = new Set(subset.ids);
  const evidence = (row.input.compact_retrieved_evidence_pack ?? []).filter((item) => ids.has(item.evidence_id));
  const allEvidence = row.input.compact_retrieved_evidence_pack ?? [];
  const questionTokens = new Set(contentTokens(row.input.question));
  const hints = parsePromptHints(row.messages);
  const perEvidence = evidence.map((item) => evidenceFeatures(row, item, questionTokens, hints));
  const allScores = allEvidence.map((item) => evidenceFeatures(row, item, questionTokens, hints));
  const subsetHintDirect = perEvidence.filter((item) => item.hint_direct).length;
  const subsetOverlaps = perEvidence.map((item) => item.question_sentence_overlap);
  const names = [
    "subset_size", "subset_size_squared", "sum_question_sentence_overlap", "max_question_sentence_overlap", "min_question_sentence_overlap",
    "mean_question_sentence_overlap", "sum_hint_overlap", "max_hint_overlap", "hint_direct_count", "all_members_hint_direct",
    "sum_rank_inverse", "min_retrieval_rank", "max_retrieval_rank", "numeric_overlap_any", "question_has_number",
    "risky_question", "counterfactual_metadata", "covers_top_rank", "covers_top_hint", "coverage_of_high_overlap_evidence",
    "evidence_count",
  ];
  const highOverlap = allScores.filter((item) => item.question_sentence_overlap >= 0.35).length;
  const highOverlapCovered = perEvidence.filter((item) => item.question_sentence_overlap >= 0.35).length;
  const values = [
    subset.ids.length,
    subset.ids.length ** 2,
    sum(subsetOverlaps),
    Math.max(...subsetOverlaps, 0),
    Math.min(...subsetOverlaps, 0),
    mean(subsetOverlaps),
    sum(perEvidence.map((item) => item.hint_overlap)),
    Math.max(...perEvidence.map((item) => item.hint_overlap), 0),
    subsetHintDirect,
    subsetHintDirect === subset.ids.length ? 1 : 0,
    sum(perEvidence.map((item) => item.rank_inverse)),
    Math.min(...perEvidence.map((item) => item.retrieval_rank), 9),
    Math.max(...perEvidence.map((item) => item.retrieval_rank), 9),
    Math.max(...perEvidence.map((item) => item.numeric_overlap), 0),
    /\d/.test(row.input.question ?? "") ? 1 : 0,
    isRiskyQuestion(row.input.question) ? 1 : 0,
    row.input.document_metadata?.counterfactual === true || String(row.example_id).includes(":counterfactual-insufficient") ? 1 : 0,
    ids.has(allScores.sort((left, right) => left.retrieval_rank - right.retrieval_rank)[0]?.evidence_id) ? 1 : 0,
    ids.has(allScores.sort((left, right) => right.hint_overlap - left.hint_overlap)[0]?.evidence_id) ? 1 : 0,
    highOverlap ? highOverlapCovered / highOverlap : 0,
    allEvidence.length,
  ];
  return { names, values };
}

function evidenceFeatures(row, evidence, questionTokens, hints) {
  const hint = hints.get(evidence.evidence_id) ?? { overlap: 0, direct: false };
  return {
    evidence_id: evidence.evidence_id,
    question_sentence_overlap: overlapScore(questionTokens, bestSentence(questionTokens, evidence.text)),
    hint_overlap: hint.overlap,
    hint_direct: hint.direct ? 1 : 0,
    rank_inverse: 1 / Math.max(1, Number(evidence.retrieval_rank ?? 9)),
    retrieval_rank: Number(evidence.retrieval_rank ?? 9),
    numeric_overlap: numericOverlap(row.input.question, evidence.text),
  };
}

function answerabilityFeatureVector(row, subsetModel, subsetScaler) {
  const subsets = scoreSubsets(row, subsetModel, subsetScaler, { count_penalty: 0, subset_threshold: 0 });
  const top = subsets[0] ?? { probability: 0, ids: [] };
  const probs = subsets.map((item) => item.probability);
  const names = [
    "top_subset_probability", "second_subset_probability", "top_subset_size", "sum_top3_subset_probability",
    "count_subset_probability_over_0p4", "count_subset_probability_over_0p6", "counterfactual_metadata",
    "risky_question", "question_has_number", "evidence_count",
  ];
  const values = [
    probs[0] ?? 0,
    probs[1] ?? 0,
    top.ids.length,
    (probs[0] ?? 0) + (probs[1] ?? 0) + (probs[2] ?? 0),
    probs.filter((value) => value >= 0.4).length,
    probs.filter((value) => value >= 0.6).length,
    row.input.document_metadata?.counterfactual === true || String(row.example_id).includes(":counterfactual-insufficient") ? 1 : 0,
    isRiskyQuestion(row.input.question) ? 1 : 0,
    /\d/.test(row.input.question ?? "") ? 1 : 0,
    row.input.compact_retrieved_evidence_pack?.length ?? 0,
  ];
  return { names, values };
}

function evidenceById(row) {
  return new Map((row.input.compact_retrieved_evidence_pack ?? []).map((item) => [item.evidence_id, item]));
}

function trainLogistic(examples, options) {
  const weights = Array(examples[0].x.length).fill(0);
  let bias = 0;
  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const rateNow = options.learningRate * (1 - iteration / options.iterations * 0.35);
    let biasGrad = 0;
    const grad = Array(weights.length).fill(0);
    for (const example of examples) {
      const predicted = sigmoid(dot(weights, example.x) + bias);
      const error = predicted - example.y;
      biasGrad += error;
      for (let index = 0; index < weights.length; index += 1) grad[index] += error * example.x[index];
    }
    bias -= rateNow * biasGrad / examples.length;
    for (let index = 0; index < weights.length; index += 1) {
      weights[index] -= rateNow * (grad[index] / examples.length + options.l2 * weights[index]);
    }
  }
  return { weights, bias, loss: logisticLoss(examples, weights, bias, options.l2) };
}

function logisticLoss(examples, weights, bias, l2) {
  const eps = 1e-8;
  return mean(examples.map((example) => {
    const predicted = Math.min(1 - eps, Math.max(eps, sigmoid(dot(weights, example.x) + bias)));
    return -(example.y * Math.log(predicted) + (1 - example.y) * Math.log(1 - predicted));
  })) + l2 * weights.reduce((total, value) => total + value * value, 0) / 2;
}

function makeScaler(vectors) {
  const means = vectors[0].map((_, index) => mean(vectors.map((vector) => vector[index])));
  const scales = vectors[0].map((_, index) => {
    const variance = mean(vectors.map((vector) => (vector[index] - means[index]) ** 2));
    return Math.sqrt(variance) || 1;
  });
  return { means, scales };
}

function scaleVector(vector, scaler) {
  return vector.map((value, index) => (value - scaler.means[index]) / scaler.scales[index]);
}

async function runContractGate(gateRunId, predictionsPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join("scripts", "grounded-qa-distillation-evidence-first-contract-preflight.mjs"),
      `--packet-run-id=${packetRunId}`,
      `--prediction-file=${path.relative(rootDir, predictionsPath)}`,
      `--run-id=${gateRunId}`,
    ], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Contract gate failed with code ${code}: ${stderr || stdout}`));
    });
  });
  return readJson(path.join(runsDir, gateRunId, "result.json"));
}

function abstain(question, score) {
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: `The subset selector answerability score ${score.toFixed(3)} did not clear the calibrated threshold for: ${question}`,
      question_target: question || "exact_question_target",
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The subset selector did not find enough calibrated evidence support in the compact evidence pack.",
  };
}

function parsePromptHints(messages) {
  const content = (messages ?? []).filter((message) => message.role === "user").at(-1)?.content ?? "";
  const match = content.match(/top_evidence=([^\n]+)/);
  const hints = new Map();
  if (!match) return hints;
  for (const part of match[1].split(";")) {
    const fields = part.trim().split(":");
    const id = fields[0]?.trim();
    if (!id) continue;
    hints.set(id, {
      overlap: Number(fields.find((field) => field.startsWith("overlap="))?.split("=")[1] ?? 0) || 0,
      direct: fields.find((field) => field.startsWith("direct="))?.split("=")[1] === "yes",
    });
  }
  return hints;
}

function summarizePredictions(rows) {
  const grounded = rows.filter((row) => row.prediction.answer_type === "grounded_answer");
  return {
    examples: rows.length,
    grounded_answer: grounded.length,
    abstain: rows.length - grounded.length,
    mean_citations_when_grounded: mean(grounded.map((row) => row.prediction.citations.length)),
  };
}

function summarizeTargets(rows) {
  const grounded = rows.filter((row) => row.target.answer_type === "grounded_answer");
  return {
    examples: rows.length,
    grounded_answer: grounded.length,
    abstain: rows.length - grounded.length,
    mean_citations_when_grounded: mean(grounded.map((row) => normalizeCitations(row.target.citations).length)),
  };
}

function decisionFor(metrics) {
  const rateValue = metrics.overall_contract_correct_rate;
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    promote_as_current_best_scaffold: rateValue >= 47 / 64,
    run_prime_student_next: rateValue >= 47 / 64,
    reason: rateValue >= 47 / 64
      ? "The subset selector reaches the prior structured-group non-review baseline and can become the local acceptance floor."
      : "The subset selector remains below the structured-group baseline; exact citation-set composition is still unresolved.",
    next_step: rateValue >= 47 / 64
      ? "Audit remaining misses and require any student/Prime run to beat this floor."
      : "Use a bounded stronger model or paid verifier-label packet focused on multi-citation evidence composition before more student training.",
  };
}

function statusFor(metrics) {
  if (metrics.overall_contract_correct_rate >= 47 / 64) return "nonreview_subset_selector_matches_structured_group";
  if (metrics.overall_contract_correct_rate >= 41 / 64) return "nonreview_subset_selector_matches_or_beats_d440";
  return "nonreview_subset_selector_below_d440";
}

function renderReport(result) {
  return `# Non-Review Citation Subset Selector Smoke

Generated: ${result.generated_at}

Status: \`${result.status}\`

This zero-spend smoke trains local logistic subset and answerability models on D437 train rows, selects thresholds on validation rows, and evaluates fresh non-review rows.

## Calibration

- Subset train examples: ${result.models.subset_selector.train_examples}
- Subset positive rate: ${pct(result.models.subset_selector.positive_rate)}
- Answerability train examples: ${result.models.answerability.train_examples}
- Validation contract correctness: ${pct(result.calibration.validation_metrics.overall_contract_correct_rate)}
- Validation citation-set exact: ${pct(result.calibration.validation_metrics.citation_set_exact_rate)}
- Selected params: \`${JSON.stringify(result.calibration.selected_params)}\`

## Fresh Eval

- Eval examples: ${result.contract_gate_metrics.examples}
- Predictions: ${result.predictions.grounded_answer} grounded, ${result.predictions.abstain} abstain
- Mean citations when grounded: ${result.predictions.mean_citations_when_grounded.toFixed(2)}
- Parseable: ${pct(result.contract_gate_metrics.parseable_rate)}
- Evidence-first valid: ${pct(result.contract_gate_metrics.evidence_first_valid_rate)}
- Answer-type accuracy: ${pct(result.contract_gate_metrics.answer_type_accuracy)}
- Citation-set exact: ${pct(result.contract_gate_metrics.citation_set_exact_rate)}
- Overall contract correct: ${pct(result.contract_gate_metrics.overall_contract_correct_rate)}

## Baselines

- D440 citation selector: ${pct(result.baseline_comparison.citation_selector_d440_rate)}
- D441 learned verifier: ${pct(result.baseline_comparison.learned_verifier_d441_rate)}
- Prior structured-group non-review baseline: ${pct(result.baseline_comparison.structured_group_nonreview_rate_from_d436)}
- Prior four-source non-review oracle: ${pct(result.baseline_comparison.four_source_oracle_nonreview_rate_from_d436)}
- Delta vs D440: ${pct(result.baseline_comparison.delta_vs_d440)}
- Delta vs structured-group: ${pct(result.baseline_comparison.delta_vs_structured_group)}
- Gap to oracle: ${pct(result.baseline_comparison.gap_to_oracle)}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Promote as current best scaffold: ${result.decision.promote_as_current_best_scaffold ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean).slice(0, 8);
}

function bestSentence(questionTokens, text) {
  const best = splitSentences(text)
    .map((sentence) => ({ sentence: cleanSentence(sentence), score: overlapScore(questionTokens, sentence) }))
    .sort((left, right) => right.score - left.score)[0];
  return best?.sentence ?? cleanSentence(text);
}

function cleanSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 340);
}

function overlapScore(tokenSet, text) {
  const tokens = contentTokens(text);
  if (!tokens.length || !tokenSet.size) return 0;
  const overlap = tokens.filter((token) => tokenSet.has(token)).length;
  return overlap / tokenSet.size + overlap / tokens.length;
}

function numericOverlap(leftText, rightText) {
  const left = new Set(String(leftText ?? "").match(/\d+(?:\.\d+)?/g) ?? []);
  if (!left.size) return 0;
  const right = new Set(String(rightText ?? "").match(/\d+(?:\.\d+)?/g) ?? []);
  let overlap = 0;
  for (const item of left) if (right.has(item)) overlap += 1;
  return overlap / left.size;
}

function contentTokens(text) {
  const stop = new Set(["the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "what", "which", "they", "them", "does", "did", "any", "how", "their", "there", "using", "used", "into", "than", "then", "also", "only", "specific", "is", "it", "of", "in", "to", "a", "an", "on", "by", "as", "or"]);
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stop.has(token));
}

function isRiskyQuestion(question) {
  return /\b(how much|percentage|statistically significant|which are three|how many|what percentage|improve over|compared with|compared to|best|state.of.the.art)\b/i.test(question ?? "");
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean);
}

function key(ids) {
  return normalizeCitations(ids).sort().join(",");
}

function predict(model, vector) {
  return sigmoid(dot(model.weights, vector) + model.bias);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value))));
}

function dot(left, right) {
  return left.reduce((total, value, index) => total + value * right[index], 0);
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function mean(values) {
  return values.length ? sum(values) / values.length : 0;
}

function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
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

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [name, raw] = value.slice(2).split("=");
    parsed[name] = raw ?? "true";
  }
  return parsed;
}

function numberListArg(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = String(value).split(",").map((item) => Number(item.trim()));
  if (!parsed.length || parsed.some((item) => !Number.isFinite(item))) throw new Error(`Invalid number list: ${value}`);
  return parsed;
}
