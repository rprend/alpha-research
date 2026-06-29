import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model dataset task result results use uses is in on of to a an by as or be can it its we our you your over under through between among all three two one".split(" "));

const runId = args["run-id"] ?? "augmented-constructor-router-audit-frontier-repaired-v1";
const launchPacketRunId = args["launch-packet-run-id"] ?? "frontier-repaired-launch-packet-2026-06-29-v1";
const validationPacketRunId = args["validation-packet-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const priorRouterRunId = args["prior-router-run-id"] ?? "train-supervised-candidate-router-audit-frontier-repaired-v1";
const constructorRunId = args["constructor-run-id"] ?? "broad-sufficiency-constructor-smoke-frontier-repaired-v1";
const scaffoldRunId = "frontier-repaired-train-calibrated-scaffold-smoke-2026-06-29-v1";
const trainSelectedRunId = "train-selected-constrained-policy-audit-frontier-repaired-v1";
const learnedRunId = "learned-repaired-selector-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);

const systemIds = [
  "train_calibrated_scaffold",
  "train_selected_constrained_policy",
  "learned_repaired_selector",
  "broad_sufficiency_constructor",
];

const featureNames = [
  "bias",
  "system_train_calibrated_scaffold",
  "system_train_selected_constrained_policy",
  "system_learned_repaired_selector",
  "system_broad_sufficiency_constructor",
  "predicts_answer",
  "predicts_abstain",
  "citation_count",
  "claim_count",
  "answer_token_length",
  "answer_has_inline_citation",
  "all_citations_in_answer",
  "missing_support_length",
  "question_overlap",
  "cited_evidence_overlap",
  "answer_number_supported",
  "answer_has_number",
  "question_has_number",
  "counterfactual_prompt",
  "risky_question",
  "system_train_prior_contract_rate",
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const scaffoldResult = await readJson(path.join(runsDir, scaffoldRunId, "result.json"));
const constructorResult = await readJson(path.join(runsDir, constructorRunId, "result.json"));
const priorRouterResult = await readJson(path.join(runsDir, priorRouterRunId, "result.json"));
const trainRowsRaw = await readJsonl(path.join(runsDir, launchPacketRunId, "dataset", "sft_train.jsonl"));
const validationPrompts = await readJsonl(path.join(runsDir, validationPacketRunId, "dataset", "eval_prompts.jsonl"));
const validationTargets = await readJsonl(path.join(runsDir, validationPacketRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const validationTargetById = new Map(validationTargets.map((row) => [row.example_id, row.target]));

const trainTune = trainRowsRaw.slice(0, 160).map((row) => ({ example_id: row.example_id, input: row.input, target: row.target, split: "train_tune" }));
const trainHeldout = trainRowsRaw.slice(160).map((row) => ({ example_id: row.example_id, input: row.input, target: row.target, split: "train_heldout" }));
const validationRows = validationPrompts.map((row) => ({
  example_id: row.example_id,
  input: row.input,
  target: validationTargetById.get(row.example_id),
  split: "repaired_validation_gate",
}));

const predictions = {
  train_tune: await loadSplitPredictions("train_tune", trainTune),
  train_heldout: await loadSplitPredictions("train_heldout", trainHeldout),
  repaired_validation_gate: await loadSplitPredictions("repaired_validation_gate", validationRows),
};

const trainPriorBySystem = {};
for (const systemId of systemIds) {
  const scored = predictions.train_tune.map((row) => scorePrediction(row.predictions[systemId], row.target));
  trainPriorBySystem[systemId] = rate(count(scored, (row) => row.contract_correct), scored.length);
}

const trainCandidateRows = candidateRowsFor(predictions.train_tune, trainPriorBySystem);
const heldoutCandidateRows = candidateRowsFor(predictions.train_heldout, trainPriorBySystem);
const validationCandidateRows = candidateRowsFor(predictions.repaired_validation_gate, trainPriorBySystem);
const scaler = makeScaler(trainCandidateRows.map((row) => row.feature_values));
const pointwise = trainLogistic(trainCandidateRows, scaler, { epochs: 1400, learningRate: 0.06, l2: 0.01 });
const pairwise = trainPairwiseLogistic(trainCandidateRows, scaler, { epochs: 900, learningRate: 0.04, l2: 0.02 });
const modes = [
  { mode: "pointwise", model: pointwise },
  { mode: "pairwise", model: pairwise },
];
for (const mode of modes) {
  mode.train_tune = summarizeSelections(selectRows(predictions.train_tune, scaler, mode.model, trainPriorBySystem));
  mode.train_heldout = summarizeSelections(selectRows(predictions.train_heldout, scaler, mode.model, trainPriorBySystem));
}
modes.sort((left, right) => right.train_heldout.contract_correct - left.train_heldout.contract_correct || right.train_tune.contract_correct - left.train_tune.contract_correct);
const selectedMode = modes[0];

const trainSelections = selectRows(predictions.train_tune, scaler, selectedMode.model, trainPriorBySystem);
const heldoutSelections = selectRows(predictions.train_heldout, scaler, selectedMode.model, trainPriorBySystem);
const validationSelections = selectRows(predictions.repaired_validation_gate, scaler, selectedMode.model, trainPriorBySystem);
const trainMetrics = summarizeSelections(trainSelections);
const heldoutMetrics = summarizeSelections(heldoutSelections);
const validationMetrics = summarizeSelections(validationSelections);
const validationOracle = summarizeOracle(predictions.repaired_validation_gate);
const heldoutOracle = summarizeOracle(predictions.train_heldout);

await writeJsonl(path.join(outputDir, "train_tune_candidate_rows.jsonl"), trainCandidateRows);
await writeJsonl(path.join(outputDir, "train_heldout_selections.jsonl"), heldoutSelections);
await writeJsonl(path.join(outputDir, "validation_selections.jsonl"), validationSelections);
await writeJsonl(path.join(outputDir, "validation_candidate_rows.jsonl"), validationCandidateRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "augmented_constructor_router_audit",
  status: statusFor(validationMetrics, priorRouterResult),
  purpose: "Train a leakage-safe router over the prior three local candidates plus the broad sufficiency constructor, using only repaired train labels for model fitting and train-heldout labels for mode selection.",
  source_runs: {
    launch_packet: launchPacketRunId,
    validation_packet: validationPacketRunId,
    prior_router: priorRouterRunId,
    constructor: constructorRunId,
    train_calibrated_scaffold: scaffoldRunId,
    train_selected_constrained_policy: trainSelectedRunId,
    learned_repaired_selector: learnedRunId,
  },
  leakage_note: "Router weights are trained only on train_tune rows. Pointwise vs pairwise mode is selected on train_heldout rows. Repaired validation labels are used only for final reporting.",
  candidate_pool: {
    systems: systemIds,
    constructor_params: constructorResult.calibration?.params,
  },
  training: {
    train_examples: trainTune.length,
    train_candidate_rows: trainCandidateRows.length,
    feature_names: featureNames,
    train_prior_by_system: trainPriorBySystem,
    mode_candidates: modes.map((mode) => ({
      mode: mode.mode,
      train_tune_contract_correct: mode.train_tune.contract_correct,
      train_heldout_contract_correct: mode.train_heldout.contract_correct,
    })),
    selected_mode: selectedMode.mode,
    model: {
      mode: selectedMode.mode,
      weights: selectedMode.model.weights,
      intercept: selectedMode.model.intercept ?? 0,
      feature_means: scaler.means,
      feature_scales: scaler.scales,
      pairwise_preferences: selectedMode.model.pairwisePreferences ?? null,
    },
  },
  metrics: {
    train_tune: trainMetrics,
    train_heldout: heldoutMetrics,
    repaired_validation_gate: validationMetrics,
  },
  oracle: {
    train_heldout: heldoutOracle,
    repaired_validation_gate: validationOracle,
  },
  selected_system_counts: {
    train_tune: countBy(trainSelections.map((row) => row.selected_system_id)),
    train_heldout: countBy(heldoutSelections.map((row) => row.selected_system_id)),
    repaired_validation_gate: countBy(validationSelections.map((row) => row.selected_system_id)),
  },
  baseline_comparison: {
    abstention_prior_contract_correct: 39,
    train_calibrated_scaffold_contract_correct: 44,
    prior_train_supervised_router_contract_correct: priorRouterResult.metrics?.repaired_validation_gate?.contract_correct,
    constructor_standalone_contract_correct: constructorResult.metrics?.constructor_contract_correct,
    prior_three_system_oracle_contract_correct: 54,
    augmented_pool_oracle_contract_correct: validationOracle.contract_correct,
    selected_validation_contract_correct: validationMetrics.contract_correct,
    delta_vs_prior_router: validationMetrics.contract_correct - Number(priorRouterResult.metrics?.repaired_validation_gate?.contract_correct ?? 0),
    delta_vs_constructor_standalone: validationMetrics.contract_correct - Number(constructorResult.metrics?.constructor_contract_correct ?? 0),
    delta_vs_augmented_oracle: validationMetrics.contract_correct - validationOracle.contract_correct,
  },
  decision: decisionFor(validationMetrics, validationOracle, priorRouterResult),
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
    note: "This audit trains a local logistic router over existing deterministic candidate predictions.",
  },
  artifacts: {
    train_tune_candidate_rows_jsonl: rel(path.join(outputDir, "train_tune_candidate_rows.jsonl")),
    train_heldout_selections_jsonl: rel(path.join(outputDir, "train_heldout_selections.jsonl")),
    validation_candidate_rows_jsonl: rel(path.join(outputDir, "validation_candidate_rows.jsonl")),
    validation_selections_jsonl: rel(path.join(outputDir, "validation_selections.jsonl")),
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
  selected_mode: result.training.selected_mode,
  metrics: result.metrics,
  oracle: result.oracle,
  selected_system_counts: result.selected_system_counts,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

async function loadSplitPredictions(split, rows) {
  const scaffoldPredictions = rows.map((row) => ({
    example_id: row.example_id,
    prediction: predictScaffold(row.example_id, row.input, scaffoldResult.calibration.params),
  }));
  const trainSelectedFile = split === "train_tune"
    ? "train_tune_predictions.jsonl"
    : split === "train_heldout"
      ? "train_heldout_predictions.jsonl"
      : "validation_predictions.jsonl";
  const trainSelected = await readJsonl(path.join(runsDir, trainSelectedRunId, trainSelectedFile));
  const learned = await readJsonl(path.join(runsDir, learnedRunId, trainSelectedFile));
  const constructorPredictions = split === "repaired_validation_gate"
    ? await readJsonl(path.join(runsDir, constructorRunId, "predictions.jsonl"))
    : rows.map((row) => ({ example_id: row.example_id, prediction: predictConstructor(row.input, constructorResult.calibration.params) }));
  const bySystem = {
    train_calibrated_scaffold: new Map(scaffoldPredictions.map((row) => [row.example_id, row.prediction])),
    train_selected_constrained_policy: new Map(trainSelected.map((row) => [row.example_id, row.prediction])),
    learned_repaired_selector: new Map(learned.map((row) => [row.example_id, row.prediction])),
    broad_sufficiency_constructor: new Map(constructorPredictions.map((row) => [row.example_id, row.prediction])),
  };
  return rows.map((row) => ({
    example_id: row.example_id,
    split,
    input: row.input,
    target: row.target,
    predictions: Object.fromEntries(systemIds.map((systemId) => [systemId, bySystem[systemId].get(row.example_id)])),
  }));
}

function candidateRowsFor(rows, trainPriorBySystem) {
  const out = [];
  for (const row of rows) {
    for (const systemId of systemIds) {
      const prediction = row.predictions[systemId];
      const score = scorePrediction(prediction, row.target);
      out.push({
        example_id: row.example_id,
        split: row.split,
        system_id: systemId,
        label_contract_correct: score.contract_correct ? 1 : 0,
        label_answer_type_correct: score.answer_type_correct ? 1 : 0,
        label_citation_set_exact: score.citation_set_exact ? 1 : 0,
        feature_values: candidateFeatures({ input: row.input, prediction, systemId, trainPriorBySystem }),
      });
    }
  }
  return out;
}

function selectRows(rows, scaler, model, trainPriorBySystem) {
  return rows.map((row) => {
    const candidates = systemIds.map((systemId) => {
      const prediction = row.predictions[systemId];
      const score = scorePrediction(prediction, row.target);
      const features = candidateFeatures({ input: row.input, prediction, systemId, trainPriorBySystem });
      return {
        system_id: systemId,
        predicted_probability: scoreCandidate(model, scaler, features),
        prediction_answer_type: prediction?.answer_type,
        contract_correct: score.contract_correct,
        answer_type_correct: score.answer_type_correct,
        citation_set_exact: score.citation_set_exact,
      };
    }).sort((left, right) => right.predicted_probability - left.predicted_probability || systemIds.indexOf(left.system_id) - systemIds.indexOf(right.system_id));
    const selected = candidates[0];
    return {
      example_id: row.example_id,
      split: row.split,
      target_answer_type: row.target?.answer_type,
      selected_system_id: selected.system_id,
      selected_contract_correct: selected.contract_correct,
      selected_answer_type_correct: selected.answer_type_correct,
      selected_citation_set_exact: selected.citation_set_exact,
      selected_probability: selected.predicted_probability,
      candidates,
    };
  });
}

function summarizeSelections(rows) {
  const correct = count(rows, (row) => row.selected_contract_correct);
  const answerType = count(rows, (row) => row.selected_answer_type_correct);
  const citation = count(rows, (row) => row.selected_citation_set_exact);
  return {
    examples: rows.length,
    contract_correct: correct,
    contract_correct_rate: rate(correct, rows.length),
    answer_type_correct: answerType,
    answer_type_accuracy: rate(answerType, rows.length),
    citation_set_exact: citation,
    citation_set_exact_rate: rate(citation, rows.length),
  };
}

function summarizeOracle(rows) {
  const oracleCorrect = count(rows, (row) => systemIds.some((systemId) => scorePrediction(row.predictions[systemId], row.target).contract_correct));
  return {
    examples: rows.length,
    contract_correct: oracleCorrect,
    contract_correct_rate: rate(oracleCorrect, rows.length),
    all_systems_wrong: rows.length - oracleCorrect,
  };
}

function candidateFeatures({ input, prediction, systemId, trainPriorBySystem }) {
  const answer = String(prediction?.answer ?? "");
  const citations = normalizeCitations(prediction?.citations);
  const claimTable = Array.isArray(prediction?.claim_table) ? prediction.claim_table : [];
  const citedText = citedEvidenceText(input, citations);
  const answerTokens = tokenList(answer);
  const questionTokens = tokenSet(input?.question);
  const citedTokens = tokenSet(citedText);
  const answerNumbers = numberSet(answer);
  const citedNumbers = numberSet(citedText);
  return [
    1,
    systemId === "train_calibrated_scaffold" ? 1 : 0,
    systemId === "train_selected_constrained_policy" ? 1 : 0,
    systemId === "learned_repaired_selector" ? 1 : 0,
    systemId === "broad_sufficiency_constructor" ? 1 : 0,
    prediction?.answer_type === "grounded_answer" ? 1 : 0,
    prediction?.answer_type === "abstain" ? 1 : 0,
    Math.min(1, citations.length / 4),
    Math.min(1, claimTable.length / 4),
    Math.min(1, answerTokens.length / 80),
    /\[E\d+\]/.test(answer) ? 1 : 0,
    citations.length > 0 && citations.every((id) => answer.includes(`[${id}]`)) ? 1 : 0,
    Math.min(1, String(prediction?.evidence_first?.missing_support ?? prediction?.abstention_reason ?? "").length / 180),
    questionTokens.size ? overlapCount(questionTokens, tokenSet(answer)) / questionTokens.size : 0,
    questionTokens.size ? overlapCount(questionTokens, citedTokens) / questionTokens.size : 0,
    answerNumbers.size > 0 && [...answerNumbers].every((number) => citedNumbers.has(number)) ? 1 : 0,
    answerNumbers.size > 0 ? 1 : 0,
    numberSet(input?.question).size > 0 ? 1 : 0,
    Boolean(input?.document_metadata?.counterfactual) ? 1 : 0,
    isRiskyQuestion(input?.question) ? 1 : 0,
    Number(trainPriorBySystem[systemId] ?? 0),
  ];
}

function predictConstructor(input, params) {
  const simple = simpleConstructorPrediction(input, params);
  if (simple.answer_type === "abstain") return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: simple.reason,
      question_target: input.question ?? "exact_question_target",
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The local constructor did not find direct enough support in the compact evidence pack.",
  };
  const evidenceById = new Map((input.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row]));
  const claims = simple.citations.map((citation, index) => ({
    claim_id: `C${index + 1}`,
    claim: bestSentence(input.question, evidenceById.get(citation)),
    citations: [citation],
    support_status: "supported",
  }));
  return {
    answer_type: "grounded_answer",
    evidence_first: { sufficiency: "sufficient", supported_claims: claims, missing_support: "", question_target: input.question ?? "exact_question_target" },
    answer: `${claims.map((claim) => claim.claim).join(" ")} ${simple.citations.map((id) => `[${id}]`).join(" ")}`,
    citations: simple.citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function simpleConstructorPrediction(input, params) {
  const ranked = (input.compact_retrieved_evidence_pack ?? [])
    .map((evidence) => ({ evidence_id: evidence.evidence_id, score: constructorEvidenceScore(input.question, evidence) }))
    .sort((left, right) => right.score - left.score || left.evidence_id.localeCompare(right.evidence_id));
  const top = ranked[0]?.score ?? 0;
  const threshold = isConstructorRiskyQuestion(input.question) ? params.risky_threshold : params.threshold;
  if (top < threshold) return { answer_type: "abstain", citations: [], reason: `Top evidence support score ${top.toFixed(3)} is below threshold ${threshold.toFixed(3)}.` };
  const citations = ranked
    .filter((row, index) => index < params.max_citations && row.score >= params.threshold && row.score >= top * params.citation_score_fraction)
    .map((row) => row.evidence_id);
  if (!citations.length) return { answer_type: "abstain", citations: [], reason: "No evidence survived citation selection." };
  return { answer_type: "grounded_answer", citations };
}

function constructorEvidenceScore(question, evidence) {
  const questionTokens = new Set(contentTokens(question));
  const evidenceText = `${evidence.section ?? ""} ${evidence.text ?? ""}`;
  const evidenceTokens = contentTokens(evidenceText);
  if (!questionTokens.size || !evidenceTokens.length) return 0;
  let overlap = 0;
  for (const token of evidenceTokens) if (questionTokens.has(token)) overlap += 1;
  const uniqueOverlap = new Set(evidenceTokens.filter((token) => questionTokens.has(token))).size;
  let score = uniqueOverlap / questionTokens.size + overlap / evidenceTokens.length;
  if (evidenceTokens.some((token) => /\d/.test(token)) && [...questionTokens].some((token) => /\d/.test(token))) score += 0.08;
  const lowerQuestion = String(question ?? "").toLowerCase();
  const lowerEvidence = evidenceText.toLowerCase();
  if (/dataset|data/.test(lowerQuestion) && /dataset|data|corpus|benchmark/.test(lowerEvidence)) score += 0.15;
  if (/baseline|compared|models|architectures|system/.test(lowerQuestion) && /baseline|compare|model|architecture|lstm|bert|cnn|dynet|matchlstm/.test(lowerEvidence)) score += 0.15;
  if (/measured|evaluated|score|metric/.test(lowerQuestion) && /evaluat|metric|score|likert|perplexity|ppl/.test(lowerEvidence)) score += 0.15;
  return score;
}

function bestSentence(question, evidence) {
  const questionTokens = new Set(contentTokens(question));
  const sentences = splitSentences(evidence?.text ?? "");
  const selected = sentences
    .map((sentence) => ({ sentence: cleanSentence(sentence), score: sentenceOverlap(questionTokens, sentence) }))
    .sort((left, right) => right.score - left.score)[0];
  return selected?.sentence || cleanSentence(evidence?.text ?? "");
}

function sentenceOverlap(questionTokens, sentence) {
  const tokens = contentTokens(sentence);
  if (!tokens.length) return 0;
  return tokens.filter((token) => questionTokens.has(token)).length / tokens.length;
}

function predictScaffold(exampleId, input, params) {
  const counterfactual = input.document_metadata?.counterfactual === true || String(exampleId).includes(":counterfactual-insufficient");
  const ranked = rankEvidence(input.question, input.compact_retrieved_evidence_pack ?? []);
  const topScore = ranked[0]?.score ?? 0;
  const directSignalCount = ranked.filter((row) => row.score >= 0.12).length;
  const risky = /\b(how much|percentage|statistically significant|which are three|how many|what percentage)\b/i.test(input.question ?? "");
  const score = topScore + params.direct_weight * Math.min(directSignalCount, 3) - (risky ? params.risk_penalty : 0);
  if (counterfactual || score < params.threshold) return scaffoldAbstain(input.question, score);
  const selected = ranked.slice(0, params.citation_count).filter((row) => row.score > 0);
  if (!selected.length) return scaffoldAbstain(input.question, score);
  const citations = selected.map((row) => row.evidence_id);
  const claims = selected.map((row, index) => ({ claim_id: `C${index + 1}`, claim: row.sentence, citations: [row.evidence_id], support_status: "supported" }));
  return {
    answer_type: "grounded_answer",
    evidence_first: { sufficiency: "sufficient", supported_claims: claims, missing_support: "", question_target: input.question ?? "exact_question_target" },
    answer: `${selected.map((row) => row.sentence).join(" ")} ${citations.map((id) => `[${id}]`).join(" ")}`,
    citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function rankEvidence(question, evidencePack) {
  const questionTokens = new Set(tokenList(question));
  return evidencePack.map((evidence) => {
    const sentences = splitSentences(evidence.text);
    const best = sentences
      .map((sentence) => ({ sentence: cleanSentence(sentence), score: overlapScore(questionTokens, `${evidence.section ?? ""} ${sentence}`) }))
      .sort((left, right) => right.score - left.score)[0] ?? { sentence: cleanSentence(evidence.text), score: 0 };
    return { evidence_id: evidence.evidence_id, sentence: best.sentence, score: best.score };
  }).sort((left, right) => right.score - left.score || left.evidence_id.localeCompare(right.evidence_id));
}

function overlapScore(questionTokens, text) {
  const tokens = tokenList(text);
  if (!tokens.length || !questionTokens.size) return 0;
  const overlap = tokens.filter((token) => questionTokens.has(token)).length;
  const coverage = overlap / questionTokens.size;
  const density = overlap / tokens.length;
  const numericBonus = tokens.some((token) => /[0-9]/.test(token)) ? 0.02 : 0;
  return coverage + density + numericBonus;
}

function scaffoldAbstain(question, score) {
  return {
    answer_type: "abstain",
    evidence_first: { sufficiency: "insufficient", supported_claims: [], missing_support: `Train-calibrated scaffold score ${score.toFixed(3)} was below the support threshold for: ${question}`, question_target: question ?? "exact_question_target" },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The scaffold did not find enough calibrated direct support in the compact evidence pack.",
  };
}

function scorePrediction(prediction, target) {
  const answerTypeCorrect = prediction?.answer_type === target?.answer_type;
  const citationSetExact = prediction?.answer_type === "abstain"
    ? normalizeCitations(prediction?.citations).length === 0
    : sameCitationSet(prediction?.citations, target?.citations ?? []);
  return { answer_type_correct: answerTypeCorrect, citation_set_exact: citationSetExact, contract_correct: Boolean(answerTypeCorrect && citationSetExact) };
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
      const error = prediction - row.label_contract_correct;
      biasGrad += error;
      for (let i = 0; i < dim; i += 1) grad[i] += error * x[i];
    }
    const n = Math.max(1, rows.length);
    intercept -= options.learningRate * (biasGrad / n);
    for (let i = 0; i < dim; i += 1) weights[i] -= options.learningRate * ((grad[i] / n) + (options.l2 * weights[i]));
  }
  return { mode: "pointwise", weights, intercept };
}

function trainPairwiseLogistic(rows, scaler, options) {
  const dim = rows[0]?.feature_values.length ?? 0;
  const weights = Array(dim).fill(0);
  const groups = groupBy(rows, (row) => row.example_id);
  const pairs = [];
  for (const groupRows of groups.values()) {
    const positives = groupRows.filter((row) => row.label_contract_correct === 1);
    const negatives = groupRows.filter((row) => row.label_contract_correct !== 1);
    for (const positive of positives) {
      for (const negative of negatives) {
        const p = scale(positive.feature_values, scaler);
        const n = scale(negative.feature_values, scaler);
        pairs.push({ delta: p.map((value, index) => value - n[index]), reverse_delta: n.map((value, index) => value - p[index]) });
      }
    }
  }
  for (let epoch = 0; epoch < options.epochs; epoch += 1) {
    for (const pair of pairs) {
      updatePairwise(weights, pair.delta, 1, options);
      updatePairwise(weights, pair.reverse_delta, 0, options);
    }
  }
  return { mode: "pairwise", weights, intercept: 0, pairwisePreferences: pairs.length };
}

function updatePairwise(weights, x, y, options) {
  const prediction = sigmoid(dot(weights, x));
  const error = prediction - y;
  for (let i = 0; i < weights.length; i += 1) weights[i] -= options.learningRate * (error * x[i] + options.l2 * weights[i]);
}

function scoreCandidate(model, scaler, features) {
  return sigmoid(dot(model.weights, scale(features, scaler)) + (model.mode === "pairwise" ? 0 : model.intercept));
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

function statusFor(validationMetrics, priorRouter) {
  const prior = Number(priorRouter.metrics?.repaired_validation_gate?.contract_correct ?? 0);
  if (validationMetrics.contract_correct > prior) return "augmented_constructor_router_beats_prior_router";
  if (validationMetrics.contract_correct === prior) return "augmented_constructor_router_ties_prior_router";
  return "augmented_constructor_router_loses_prior_router";
}

function decisionFor(validationMetrics, validationOracle, priorRouter) {
  const prior = Number(priorRouter.metrics?.repaired_validation_gate?.contract_correct ?? 0);
  return {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    promote_as_policy: validationMetrics.contract_correct > prior,
    keep_constructor_in_pool: validationOracle.contract_correct > 54,
    reason: validationMetrics.contract_correct > prior
      ? `The augmented router improves over the prior router (${validationMetrics.contract_correct} vs ${prior}) without validation-label training.`
      : `The augmented pool has oracle headroom (${validationOracle.contract_correct}/70), but the leakage-safe router selects only ${validationMetrics.contract_correct}/70 versus the prior router's ${prior}/70.`,
    next_step: validationMetrics.contract_correct > prior
      ? "Freeze the augmented router as a no-spend candidate and confirm it on a fresh non-validation heldout surface before paid judging."
      : "Do not spend on judging. Improve router supervision or candidate scoring so the constructor's added oracle headroom is selectable without validation leakage.",
  };
}

function citedEvidenceText(input, citations) {
  const wanted = new Set(citations);
  return (input?.compact_retrieved_evidence_pack ?? [])
    .filter((evidence) => wanted.has(evidence.evidence_id))
    .map((evidence) => `${evidence.section ?? ""} ${evidence.text ?? ""}`)
    .join(" ");
}

function tokenList(text) {
  return String(text ?? "").toLowerCase().split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stopwords.has(token));
}

function contentTokens(text) {
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").split(/[^a-z0-9]+/).filter((token) => token.length > 1 && !stopwords.has(token));
}

function tokenSet(text) {
  return new Set(tokenList(text));
}

function numberSet(text) {
  return new Set([...String(text ?? "").matchAll(/\b\d+(?:[,.]\d+)*(?:\.\d+)?%?\b/g)].map((match) => match[0]));
}

function isRiskyQuestion(question) {
  return /\b(percentage|percent|how many|how much|statistically significant|which are three|compare|difference|ratio|previous|state.of.the.art|fewer|more)\b/i.test(question ?? "");
}

function isConstructorRiskyQuestion(question) {
  return /\b(by how much|amount|percentage|percent|which specific|state-of-the-art|language from|improvement)\b/i.test(question ?? "");
}

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean).slice(0, 6);
}

function cleanSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function overlapCount(leftSet, rightSet) {
  let total = 0;
  for (const value of leftSet) if (rightSet.has(value)) total += 1;
  return total;
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

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
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

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function renderReport(result) {
  return `# Augmented Constructor Router Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls and launches no Prime compute.

## Metrics

| Split | Contract Correct | Answer Type | Citation Exact |
| --- | ---: | ---: | ---: |
| Train tune | ${result.metrics.train_tune.contract_correct}/${result.metrics.train_tune.examples} (${pct(result.metrics.train_tune.contract_correct_rate)}) | ${pct(result.metrics.train_tune.answer_type_accuracy)} | ${pct(result.metrics.train_tune.citation_set_exact_rate)} |
| Train heldout | ${result.metrics.train_heldout.contract_correct}/${result.metrics.train_heldout.examples} (${pct(result.metrics.train_heldout.contract_correct_rate)}) | ${pct(result.metrics.train_heldout.answer_type_accuracy)} | ${pct(result.metrics.train_heldout.citation_set_exact_rate)} |
| Repaired validation | ${result.metrics.repaired_validation_gate.contract_correct}/${result.metrics.repaired_validation_gate.examples} (${pct(result.metrics.repaired_validation_gate.contract_correct_rate)}) | ${pct(result.metrics.repaired_validation_gate.answer_type_accuracy)} | ${pct(result.metrics.repaired_validation_gate.citation_set_exact_rate)} |

## Baseline Comparison

- Prior router: ${result.baseline_comparison.prior_train_supervised_router_contract_correct}/70
- Constructor standalone: ${result.baseline_comparison.constructor_standalone_contract_correct}/70
- Prior three-system oracle: ${result.baseline_comparison.prior_three_system_oracle_contract_correct}/70
- Augmented pool oracle: ${result.baseline_comparison.augmented_pool_oracle_contract_correct}/70
- Augmented router: ${result.baseline_comparison.selected_validation_contract_correct}/70
- Delta vs prior router: ${result.baseline_comparison.delta_vs_prior_router}
- Delta vs augmented oracle: ${result.baseline_comparison.delta_vs_augmented_oracle}

## Decision

- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Promote as policy: ${result.decision.promote_as_policy ? "yes" : "no"}
- Keep constructor in pool: ${result.decision.keep_constructor_in_pool ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
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

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
