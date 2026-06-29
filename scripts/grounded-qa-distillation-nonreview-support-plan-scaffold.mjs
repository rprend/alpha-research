import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "nonreview-oracle-contrast-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "nonreview-support-plan-scaffold-2026-06-29-v1";
const packetDir = path.join(runsDir, packetRunId, "dataset");
const outputDir = path.join(runsDir, runId);
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method models model datasets dataset task result results use uses is in on of to a an by as or be can it its we our you your over under through between among all three two one do has have had not no yes where when who why whether there shown other more less much many".split(" "));

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const trainRows = await readJsonl(path.join(packetDir, "sft_train.jsonl"));
const validationRows = await readJsonl(path.join(packetDir, "sft_validation.jsonl"));
const evalPrompts = await readJsonl(path.join(packetDir, "eval_prompts.jsonl"));
const evalTargets = await readJsonl(path.join(packetDir, "eval_targets_diagnostic.jsonl"));

const trainPlans = trainRows.map(makeSupportPlan);
const validationPlans = validationRows.map(makeSupportPlan);
const evidenceExamples = trainPlans.flatMap((plan) => plan.evidence_examples);
const scaler = makeScaler(evidenceExamples.map((row) => row.x));
const evidenceModel = trainLogistic(evidenceExamples.map((row) => ({ ...row, x: scale(row.x, scaler) })), { iterations: 1800, learningRate: 0.09, l2: 0.035 });
const answerExamples = trainRows.map((row) => ({ x: answerFeatures(row, evidenceModel, scaler), y: row.target.answer_type === "grounded_answer" ? 1 : 0 }));
const answerScaler = makeScaler(answerExamples.map((row) => row.x));
const answerModel = trainLogistic(answerExamples.map((row) => ({ ...row, x: scale(row.x, answerScaler) })), { iterations: 1400, learningRate: 0.08, l2: 0.03 });
const calibration = calibrate(validationRows, evidenceModel, scaler, answerModel, answerScaler);
const predictions = evalPrompts.map((row) => predictRow(row, calibration.selected_params, evidenceModel, scaler, answerModel, answerScaler));
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);

const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);
const scoredRows = await readJsonl(path.join(runsDir, gateRunId, "scored_predictions.jsonl"));
const diagnostics = summarizeDiagnostics(scoredRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "nonreview_support_plan_scaffold",
  status: statusFor(gate.metrics, diagnostics),
  purpose: "Construct train-only support-plan supervision and test a no-spend evidence planner for fresh non-review grounded QA.",
  source_runs: { packet: packetRunId, contract_gate: gateRunId },
  support_plan_packet: {
    train_plans: trainPlans.length,
    validation_plans: validationPlans.length,
    train_grounded_plans: count(trainPlans, (plan) => plan.target_answer_type === "grounded_answer"),
    validation_grounded_plans: count(validationPlans, (plan) => plan.target_answer_type === "grounded_answer"),
    train_evidence_examples: evidenceExamples.length,
    train_positive_evidence_examples: count(evidenceExamples, (row) => row.y === 1),
    train_distractor_evidence_examples: count(evidenceExamples, (row) => row.y === 0),
  },
  method: {
    type: "support_plan_evidence_classifier_plus_answerability_guard",
    support_plan_label: "target supported_claims mapped to cited evidence ids; non-cited pack evidence retained as distractors",
    threshold_selection: "D437 SFT validation contract correctness with multi-citation tie-breakers",
    uses_fresh_eval_targets_for_training: false,
    openai_calls: 0,
    gpu_calls: 0,
  },
  models: {
    evidence_planner: {
      feature_names: evidenceFeatureNames(),
      train_examples: evidenceExamples.length,
      positive_rate: rate(count(evidenceExamples, (row) => row.y === 1), evidenceExamples.length),
      weights: Object.fromEntries(evidenceFeatureNames().map((name, index) => [name, evidenceModel.weights[index]])),
      bias: evidenceModel.bias,
      train_loss: evidenceModel.loss,
    },
    answerability: {
      feature_names: answerFeatureNames(),
      train_examples: answerExamples.length,
      positive_rate: rate(count(answerExamples, (row) => row.y === 1), answerExamples.length),
      weights: Object.fromEntries(answerFeatureNames().map((name, index) => [name, answerModel.weights[index]])),
      bias: answerModel.bias,
      train_loss: answerModel.loss,
    },
  },
  calibration,
  predictions: summarizePredictions(predictions),
  target_distribution: summarizeTargets(evalTargets),
  diagnostics,
  contract_gate_metrics: gate.metrics,
  baseline_comparison: {
    d440_citation_selector_correct: 41,
    d442_subset_selector_correct: 40,
    d447_group_scaffold_correct: 39,
    d448_router_correct: 42,
    structured_group_nonreview_correct: 47,
    four_source_oracle_nonreview_correct: 57,
    support_plan_scaffold_correct: Math.round(gate.metrics.overall_contract_correct_rate * gate.metrics.examples),
  },
  decision: decisionFor(gate.metrics, diagnostics),
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
    note: "Local support-plan scaffold only. No OpenAI, Prime, or other paid model calls.",
  },
  artifacts: {
    train_support_plans_jsonl: rel(path.join(outputDir, "train_support_plans.jsonl")),
    validation_support_plans_jsonl: rel(path.join(outputDir, "validation_support_plans.jsonl")),
    predictions_jsonl: rel(predictionsPath),
    scored_predictions_jsonl: rel(path.join(runsDir, gateRunId, "scored_predictions.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "train_support_plans.jsonl"), trainPlans);
await writeJsonl(path.join(outputDir, "validation_support_plans.jsonl"), validationPlans);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  support_plan_packet: result.support_plan_packet,
  calibration: result.calibration,
  diagnostics: result.diagnostics,
  contract_gate_metrics: result.contract_gate_metrics,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function makeSupportPlan(row) {
  const targetCitations = normalizeCitations(row.target?.citations);
  const targetSet = new Set(targetCitations);
  const evidencePack = row.input?.compact_retrieved_evidence_pack ?? [];
  const evidenceById = new Map(evidencePack.map((item) => [item.evidence_id, item]));
  const requiredComponents = normalizeSupportedClaims(row.target).map((claim) => ({
    claim: claim.claim,
    citations: claim.citations,
    evidence: claim.citations.map((id) => evidencePreview(evidenceById.get(id))).filter(Boolean),
  }));
  const evidenceExamplesLocal = evidencePack.filter((item) => item.evidence_id).map((item) => ({
    example_id: row.example_id,
    evidence_id: item.evidence_id,
    y: row.target.answer_type === "grounded_answer" && targetSet.has(item.evidence_id) ? 1 : 0,
    x: evidenceFeatures(row, item),
    role: targetSet.has(item.evidence_id) ? "required_support" : "distractor_or_unused",
    preview: evidencePreview(item),
  }));
  return {
    example_id: row.example_id,
    source_split: row.source_split ?? null,
    question: row.input?.question ?? null,
    target_answer_type: row.target?.answer_type ?? null,
    target_citations: targetCitations,
    required_components: requiredComponents,
    distractor_evidence: evidencePack.filter((item) => !targetSet.has(item.evidence_id)).map(evidencePreview).filter(Boolean),
    evidence_examples: evidenceExamplesLocal,
    training_use: "allowed_nonfinal_support_plan_packet",
  };
}

function calibrate(rows, evidenceModel, scaler, answerModel, answerScaler) {
  const candidates = [];
  for (const answerThreshold of [0.2, 0.28, 0.36, 0.44, 0.52, 0.62]) {
    for (const evidenceThreshold of [0.18, 0.24, 0.3, 0.36, 0.44, 0.54]) {
      for (const gap of [0.02, 0.05, 0.08, 0.12, 0.18]) {
        for (const maxCitations of [1, 2, 3, 4, 5]) {
          const params = { answer_threshold: answerThreshold, evidence_threshold: evidenceThreshold, score_gap: gap, max_citations: maxCitations };
          const metrics = scoreRows(rows, params, evidenceModel, scaler, answerModel, answerScaler);
          const objective = metrics.overall_contract_correct_rate
            + metrics.multi_citation_exact_rate * 0.025
            - Math.abs(metrics.mean_citations_when_grounded - metrics.mean_target_citations_when_grounded) * 0.006
            - Math.max(0, metrics.answer_rate - metrics.target_answer_rate) * 0.01;
          candidates.push({ params, metrics, objective });
        }
      }
    }
  }
  candidates.sort((left, right) => right.objective - left.objective
    || right.metrics.overall_contract_correct_rate - left.metrics.overall_contract_correct_rate
    || right.metrics.multi_citation_exact_rate - left.metrics.multi_citation_exact_rate
    || right.metrics.citation_set_exact_rate - left.metrics.citation_set_exact_rate);
  return {
    validation_examples: rows.length,
    selected_params: candidates[0].params,
    validation_metrics: candidates[0].metrics,
    validation_objective: candidates[0].objective,
    top_candidates: candidates.slice(0, 10),
  };
}

function scoreRows(rows, params, evidenceModel, scaler, answerModel, answerScaler) {
  const scored = rows.map((row) => {
    const prediction = buildPrediction(row, params, evidenceModel, scaler, answerModel, answerScaler);
    const targetCitations = normalizeCitations(row.target?.citations);
    const answerTypeCorrect = prediction.answer_type === row.target?.answer_type;
    const citationSetExact = prediction.answer_type === "abstain"
      ? prediction.citations.length === 0
      : setEqual(new Set(prediction.citations), new Set(targetCitations));
    return {
      contract_correct: answerTypeCorrect && citationSetExact,
      answer_type_correct: answerTypeCorrect,
      citation_set_exact: citationSetExact,
      prediction_answer_type: prediction.answer_type,
      target_answer_type: row.target?.answer_type,
      citations: prediction.citations.length,
      target_citations: targetCitations.length,
    };
  });
  const groundedTargets = scored.filter((row) => row.target_answer_type === "grounded_answer");
  const multiTargets = groundedTargets.filter((row) => row.target_citations > 1);
  const groundedPredictions = scored.filter((row) => row.prediction_answer_type === "grounded_answer");
  return {
    rows: scored.length,
    overall_contract_correct_rate: rate(count(scored, (row) => row.contract_correct), scored.length),
    answer_type_accuracy: rate(count(scored, (row) => row.answer_type_correct), scored.length),
    citation_set_exact_rate: rate(count(scored, (row) => row.citation_set_exact), scored.length),
    multi_citation_exact_rate: rate(count(multiTargets, (row) => row.citation_set_exact), multiTargets.length),
    answer_rate: rate(groundedPredictions.length, scored.length),
    target_answer_rate: rate(groundedTargets.length, scored.length),
    mean_citations_when_grounded: mean(groundedPredictions.map((row) => row.citations)),
    mean_target_citations_when_grounded: mean(groundedTargets.map((row) => row.target_citations)),
  };
}

function predictRow(row, params, evidenceModel, scaler, answerModel, answerScaler) {
  const prediction = buildPrediction(row, params, evidenceModel, scaler, answerModel, answerScaler);
  return {
    example_id: row.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    metadata: { scaffold: "nonreview_support_plan_scaffold", params, no_model_weights_or_llm_calls: true },
  };
}

function buildPrediction(row, params, evidenceModel, scaler, answerModel, answerScaler) {
  const question = row.input?.question ?? "";
  const counterfactual = row.input?.document_metadata?.counterfactual === true || String(row.example_id).includes(":counterfactual-insufficient");
  const answerability = predict(answerModel, scale(answerFeatures(row, evidenceModel, scaler), answerScaler));
  if (counterfactual || answerability < params.answer_threshold) return abstain(question, answerability);
  const scored = scoreEvidence(row, evidenceModel, scaler);
  const top = scored[0];
  if (!top || top.probability < params.evidence_threshold) return abstain(question, answerability);
  const desired = desiredCount(question);
  const minKeep = desired ? Math.min(desired, params.max_citations) : 1;
  const selected = [];
  for (const item of scored) {
    if (selected.length >= params.max_citations) break;
    if (item.probability >= params.evidence_threshold && (selected.length < minKeep || top.probability - item.probability <= params.score_gap)) {
      selected.push(item.evidence_id);
    }
  }
  if (!selected.length) selected.push(top.evidence_id);
  return grounded(row.input, selected);
}

function scoreEvidence(row, evidenceModel, scaler) {
  return (row.input?.compact_retrieved_evidence_pack ?? [])
    .filter((item) => item.evidence_id)
    .map((item) => ({
      evidence_id: item.evidence_id,
      item,
      probability: predict(evidenceModel, scale(evidenceFeatures(row, item), scaler)),
      lexical_score: lexicalOverlap(row.input?.question, `${item.section ?? ""} ${item.text ?? ""}`),
    }))
    .sort((left, right) => right.probability - left.probability || right.lexical_score - left.lexical_score || Number(left.item.retrieval_rank ?? 99) - Number(right.item.retrieval_rank ?? 99));
}

function evidenceFeatures(row, item) {
  const question = row.input?.question ?? "";
  const text = `${item.section ?? ""} ${item.text ?? ""}`;
  const rank = Number(item.retrieval_rank ?? 9);
  const lexical = lexicalOverlap(question, text);
  const sectionLexical = lexicalOverlap(question, item.section ?? "");
  const qHasNumber = /\d|percent|percentage|score|how much|how many/i.test(question) ? 1 : 0;
  const eHasNumber = /\d|%|score|rouge|f1|accuracy|metric|table|tabref/i.test(text) ? 1 : 0;
  const desired = desiredCount(question) ?? 0;
  const directHintRank = topEvidenceHintRank(row, item.evidence_id);
  return [
    lexical,
    sectionLexical,
    1 / Math.max(1, rank),
    rank,
    qHasNumber,
    eHasNumber,
    qHasNumber && eHasNumber ? 1 : 0,
    /definition|what is|what are|describe|explain/i.test(question) ? 1 : 0,
    /dataset|data|corpus|benchmark/i.test(question) && /dataset|data|corpus|benchmark|reuters|bloomberg|europarl|craigslist/i.test(text) ? 1 : 0,
    /model|architecture|baseline|compared/i.test(question) && /model|architecture|baseline|bert|lstm|cnn|seq2seq|gpt|ranker|reasoner/i.test(text) ? 1 : 0,
    /metric|evaluat|score|fluency|accuracy|f1/i.test(question) && /metric|evaluat|score|fluency|accuracy|f1|ppl|perplexity/i.test(text) ? 1 : 0,
    isEnumerativeQuestion(question) ? 1 : 0,
    desired,
    text.length > 380 ? 1 : 0,
    /introduction|background/i.test(item.section ?? "") ? 1 : 0,
    /result|experiment|analysis|evaluation/i.test(item.section ?? "") ? 1 : 0,
    directHintRank ? 1 / directHintRank : 0,
    row.input?.document_metadata?.counterfactual === true || String(row.example_id).includes(":counterfactual-insufficient") ? 1 : 0,
  ];
}

function answerFeatures(row, evidenceModel, scaler) {
  const scored = scoreEvidence(row, evidenceModel, scaler);
  const probs = scored.map((item) => item.probability);
  const question = row.input?.question ?? "";
  return [
    probs[0] ?? 0,
    probs[1] ?? 0,
    probs[2] ?? 0,
    sum(probs.slice(0, 3)),
    count(scored, (item) => item.probability >= 0.3),
    isEnumerativeQuestion(question) ? 1 : 0,
    /\d|percent|percentage|score|how much|how many/i.test(question) ? 1 : 0,
    desiredCount(question) ?? 0,
    row.input?.compact_retrieved_evidence_pack?.length ?? 0,
    row.input?.document_metadata?.counterfactual === true || String(row.example_id).includes(":counterfactual-insufficient") ? 1 : 0,
  ];
}

function grounded(input, citations) {
  const byId = new Map((input?.compact_retrieved_evidence_pack ?? []).map((item) => [item.evidence_id, item]));
  const claims = citations.map((id, index) => {
    const item = byId.get(id);
    return { claim_id: `C${index + 1}`, claim: bestSentence(input?.question, item?.text ?? ""), citations: [id], support_status: "supported" };
  });
  return {
    answer_type: "grounded_answer",
    evidence_first: { sufficiency: "sufficient", supported_claims: claims, missing_support: "", question_target: input?.question ?? "" },
    answer: `${claims.map((claim) => claim.claim).join(" ")} ${citations.map((id) => `[${id}]`).join(" ")}`.trim(),
    citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function abstain(question, score) {
  return {
    answer_type: "abstain",
    evidence_first: { sufficiency: "insufficient", supported_claims: [], missing_support: `No calibrated support plan cleared answerability for: ${question}`, question_target: question ?? "" },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: `Support-plan answerability score ${Number(score || 0).toFixed(3)} did not clear threshold.`,
  };
}

function summarizeDiagnostics(rows) {
  const groundedTargets = rows.filter((row) => row.target_answer_type === "grounded_answer");
  const multi = groundedTargets.filter((row) => normalizeCitations(row.target?.citations).length > 1);
  return {
    target_grounded: groundedTargets.length,
    target_multi_citation_grounded: multi.length,
    multi_citation_exact: count(multi, (row) => row.citation_set_exact),
    multi_citation_contract_correct: count(multi, (row) => row.contract_correct),
    answer_type_correct: count(rows, (row) => row.answer_type_correct),
    citation_set_exact: count(rows, (row) => row.citation_set_exact),
    mean_predicted_citations_on_multi_targets: mean(multi.map((row) => normalizeCitations(row.prediction?.citations).length)),
    undercite_multi_targets: count(multi, (row) => normalizeCitations(row.prediction?.citations).length < normalizeCitations(row.target?.citations).length),
    overcite_multi_targets: count(multi, (row) => normalizeCitations(row.prediction?.citations).length > normalizeCitations(row.target?.citations).length),
  };
}

function statusFor(metrics, diagnostics) {
  const correct = Math.round(metrics.overall_contract_correct_rate * metrics.examples);
  if (correct >= 47) return "support_plan_scaffold_matches_structured_group";
  if (correct > 42) return "support_plan_scaffold_beats_router";
  if (diagnostics.multi_citation_exact > 3) return "support_plan_improves_multicitation_but_not_overall";
  return "support_plan_scaffold_below_router";
}

function decisionFor(metrics, diagnostics) {
  const correct = Math.round(metrics.overall_contract_correct_rate * metrics.examples);
  const beatsRouter = correct > 42;
  const beatsStructured = correct >= 47;
  return {
    promote_as_current_best_scaffold: beatsStructured,
    keep_as_candidate_source: beatsRouter || diagnostics.multi_citation_exact > 3,
    buy_openai_labels_now: false,
    rent_prime_gpu_now: false,
    broaden_student_training_now: false,
    reason: `Support-plan scaffold scores ${correct}/${metrics.examples}; multi-citation exact is ${diagnostics.multi_citation_exact}/${diagnostics.target_multi_citation_grounded}.`,
    next_step: beatsStructured
      ? "Promote this scaffold and stress-test on a fresh temporal slice before any GPU spend."
      : "Do not rent GPU from this result; inspect whether support-plan features fail on wrong singletons or multi-citation partials, then add targeted pairwise support-plan contrasts.",
  };
}

function renderReport(result) {
  return `# Non-Review Support-Plan Scaffold

Generated: ${result.generated_at}

Status: \`${result.status}\`

This zero-spend run constructs train/validation support-plan rows and evaluates a local support planner on the fresh non-review split.

## Result

- Contract correct: ${result.baseline_comparison.support_plan_scaffold_correct}/${result.contract_gate_metrics.examples}
- Answer type correct: ${result.diagnostics.answer_type_correct}/${result.contract_gate_metrics.examples}
- Citation-set exact: ${result.diagnostics.citation_set_exact}/${result.contract_gate_metrics.examples}
- Multi-citation exact: ${result.diagnostics.multi_citation_exact}/${result.diagnostics.target_multi_citation_grounded}
- Mean predicted citations on multi targets: ${result.diagnostics.mean_predicted_citations_on_multi_targets.toFixed(2)}

## Baselines

- D448 router: ${result.baseline_comparison.d448_router_correct}/64
- Structured-group baseline: ${result.baseline_comparison.structured_group_nonreview_correct}/64
- Four-source oracle: ${result.baseline_comparison.four_source_oracle_nonreview_correct}/64

## Decision

- Promote as current best scaffold: ${result.decision.promote_as_current_best_scaffold ? "yes" : "no"}
- Keep as candidate source: ${result.decision.keep_as_candidate_source ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function desiredCount(question) {
  const q = String(question ?? "").toLowerCase();
  if (/\bfour\b|4/.test(q)) return 4;
  if (/\bthree\b|3/.test(q)) return 3;
  if (/\btwo\b|2/.test(q)) return 2;
  if (/what are|which .*s\b|list|metrics|baselines|architectures|datasets|models|languages|optimizers|websites|types|investigations|private companies/.test(q)) return 2;
  return null;
}

function isEnumerativeQuestion(question) {
  return Boolean(desiredCount(question)) || /\bwhat are\b|\bwhich\b|\blist\b/i.test(question ?? "");
}

function topEvidenceHintRank(row, evidenceId) {
  const text = row.messages?.find((message) => message.role === "user")?.content ?? "";
  const match = text.match(new RegExp(`${evidenceId}:overlap=[^;\\n]+`, "i"));
  if (!match) return null;
  const before = text.slice(0, match.index);
  return (before.match(/E\d+:overlap=/g) ?? []).length + 1;
}

function lexicalOverlap(left, right) {
  const leftTokens = new Set(contentTokens(left));
  const rightTokens = contentTokens(right);
  if (!leftTokens.size || !rightTokens.length) return 0;
  return new Set(rightTokens.filter((token) => leftTokens.has(token))).size / leftTokens.size;
}

function bestSentence(question, text) {
  const qTokens = new Set(contentTokens(question));
  const sentences = String(text ?? "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return (sentences.length ? sentences : [String(text ?? "")])
    .map((sentence) => ({ sentence: clean(sentence), score: sentenceScore(qTokens, sentence) }))
    .sort((a, b) => b.score - a.score)[0]?.sentence ?? clean(text);
}

function sentenceScore(qTokens, sentence) {
  const tokens = contentTokens(sentence);
  if (!qTokens.size || !tokens.length) return 0;
  const overlap = tokens.filter((token) => qTokens.has(token)).length;
  return overlap / qTokens.size + overlap / tokens.length;
}

function evidencePreview(item) {
  if (!item) return null;
  return {
    evidence_id: item.evidence_id,
    retrieval_rank: item.retrieval_rank ?? null,
    section: item.section ?? null,
    preview: clean(item.text ?? ""),
  };
}

function normalizeSupportedClaims(output) {
  const claims = output?.evidence_first?.supported_claims;
  return (Array.isArray(claims) ? claims : []).map((claim) => ({
    claim: String(claim.claim ?? ""),
    citations: normalizeCitations(claim.citations),
  }));
}

function evidenceFeatureNames() {
  return ["lexical_overlap", "section_lexical_overlap", "inverse_rank", "rank", "question_has_numeric", "evidence_has_numeric", "numeric_match", "definition_question", "dataset_match", "model_architecture_match", "metric_match", "enumerative_question", "desired_count", "long_evidence", "intro_background_section", "result_experiment_section", "top_evidence_hint_inverse_rank", "counterfactual_metadata"];
}

function answerFeatureNames() {
  return ["top_evidence_probability", "second_evidence_probability", "third_evidence_probability", "sum_top3_probability", "count_evidence_over_0p3", "enumerative_question", "question_has_numeric", "desired_count", "evidence_count", "counterfactual_metadata"];
}

function trainLogistic(examples, options) {
  const weights = Array(examples[0].x.length).fill(0);
  let bias = 0;
  for (let iter = 0; iter < options.iterations; iter += 1) {
    const lr = options.learningRate * (1 - 0.35 * iter / options.iterations);
    const grad = Array(weights.length).fill(0);
    let biasGrad = 0;
    for (const ex of examples) {
      const pred = sigmoid(dot(weights, ex.x) + bias);
      const err = pred - ex.y;
      biasGrad += err;
      for (let i = 0; i < weights.length; i += 1) grad[i] += err * ex.x[i];
    }
    bias -= lr * biasGrad / examples.length;
    for (let i = 0; i < weights.length; i += 1) weights[i] -= lr * (grad[i] / examples.length + options.l2 * weights[i]);
  }
  return { weights, bias, loss: logisticLoss(examples, weights, bias, options.l2) };
}

function logisticLoss(examples, weights, bias, l2) {
  const eps = 1e-8;
  return mean(examples.map((ex) => {
    const p = Math.min(1 - eps, Math.max(eps, sigmoid(dot(weights, ex.x) + bias)));
    return -(ex.y * Math.log(p) + (1 - ex.y) * Math.log(1 - p));
  })) + l2 * sum(weights.map((w) => w * w)) / 2;
}

function makeScaler(vectors) {
  const means = vectors[0].map((_, i) => mean(vectors.map((v) => v[i])));
  const scales = vectors[0].map((_, i) => Math.sqrt(mean(vectors.map((v) => (v[i] - means[i]) ** 2))) || 1);
  return { means, scales };
}

function scale(vector, scaler) {
  return vector.map((value, index) => (value - scaler.means[index]) / scaler.scales[index]);
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

async function runContractGate(gateRunId, predictionsPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "scripts/grounded-qa-distillation-evidence-first-contract-preflight.mjs",
      `--packet-run-id=${packetRunId}`,
      `--prediction-file=${path.relative(rootDir, predictionsPath)}`,
      `--run-id=${gateRunId}`,
    ], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Contract gate failed ${code}: ${stderr || stdout}`)));
  });
  return readJson(path.join(runsDir, gateRunId, "result.json"));
}

function summarizePredictions(rows) {
  const groundedRows = rows.filter((row) => row.prediction.answer_type === "grounded_answer");
  return {
    examples: rows.length,
    grounded_answer: groundedRows.length,
    abstain: rows.length - groundedRows.length,
    mean_citations_when_grounded: mean(groundedRows.map((row) => row.prediction.citations.length)),
  };
}

function summarizeTargets(rows) {
  const groundedRows = rows.filter((row) => row.target.answer_type === "grounded_answer");
  return {
    examples: rows.length,
    grounded_answer: groundedRows.length,
    abstain: rows.length - groundedRows.length,
    mean_citations_when_grounded: mean(groundedRows.map((row) => normalizeCitations(row.target.citations).length)),
  };
}

function contentTokens(text) {
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stopwords.has(token));
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => typeof citation === "string" ? citation.replace(/^\[|\]$/g, "") : String(citation?.evidence_id ?? citation?.id ?? "")).filter(Boolean);
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function clean(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 320);
}

function count(rows, pred) {
  return rows.filter(pred).length;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function mean(values) {
  return values.length ? sum(values) / values.length : 0;
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
