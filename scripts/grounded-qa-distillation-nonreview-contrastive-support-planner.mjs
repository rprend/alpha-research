import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "nonreview-oracle-contrast-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "nonreview-contrastive-support-planner-2026-06-29-v1";
const packetDir = path.join(runsDir, packetRunId, "dataset");
const outputDir = path.join(runsDir, runId);
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method methods models model datasets dataset task result results use uses is in on of to a an by as or be can it its we our you your over under through between among all three two one do has have had not no yes where when who why whether there shown other more less much many".split(" "));

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const trainRows = await readJsonl(path.join(packetDir, "sft_train.jsonl"));
const validationRows = await readJsonl(path.join(packetDir, "sft_validation.jsonl"));
const evalPrompts = await readJsonl(path.join(packetDir, "eval_prompts.jsonl"));
const evalTargets = await readJsonl(path.join(packetDir, "eval_targets_diagnostic.jsonl"));

const pairwiseExamples = trainRows.flatMap(pairwiseTrainingExamples);
const pairScaler = makeScaler(pairwiseExamples.map((row) => row.x));
const pairModel = trainLogistic(pairwiseExamples.map((row) => ({ ...row, x: scale(row.x, pairScaler) })), { iterations: 1800, learningRate: 0.08, l2: 0.03 });
const answerExamples = trainRows.map((row) => ({ x: answerFeatures(row, pairModel, pairScaler), y: row.target.answer_type === "grounded_answer" ? 1 : 0 }));
const answerScaler = makeScaler(answerExamples.map((row) => row.x));
const answerModel = trainLogistic(answerExamples.map((row) => ({ ...row, x: scale(row.x, answerScaler) })), { iterations: 1400, learningRate: 0.08, l2: 0.03 });
const calibration = calibrate(validationRows, pairModel, pairScaler, answerModel, answerScaler);
const predictions = evalPrompts.map((row) => predictRow(row, calibration.selected_params, pairModel, pairScaler, answerModel, answerScaler));
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);

const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);
const scoredRows = await readJsonl(path.join(runsDir, gateRunId, "scored_predictions.jsonl"));
const diagnostics = summarizeDiagnostics(scoredRows);
const routerRows = await readJsonl(path.join(runsDir, "nonreview-coverage-router-audit-2026-06-29-v1-contract-gate", "scored_predictions.jsonl"));
const routerById = new Map(routerRows.map((row) => [row.example_id, row]));
const deltaVsRouter = summarizeDeltaVsRouter(scoredRows, routerById);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "nonreview_contrastive_support_planner",
  status: statusFor(gate.metrics, diagnostics),
  purpose: "Test whether pairwise required-vs-distractor support-plan contrasts reduce D450 over-expansion while preserving citation-grounded correctness.",
  source_runs: {
    packet: packetRunId,
    contract_gate: gateRunId,
    router_baseline_gate: "nonreview-coverage-router-audit-2026-06-29-v1-contract-gate",
  },
  method: {
    type: "pairwise_required_vs_distractor_ranker_plus_answerability_guard",
    training_signal: "For each grounded train row, train positive required evidence to outrank non-cited distractor evidence from the same compact pack.",
    threshold_selection: "D437 SFT validation contract correctness with tie-breakers for citation exactness and multi-citation exactness.",
    uses_fresh_eval_targets_for_training: false,
    openai_calls: 0,
    gpu_calls: 0,
  },
  training: {
    train_rows: trainRows.length,
    validation_rows: validationRows.length,
    eval_prompts: evalPrompts.length,
    pairwise_examples: pairwiseExamples.length,
    positive_direction_examples: count(pairwiseExamples, (row) => row.y === 1),
    negative_direction_examples: count(pairwiseExamples, (row) => row.y === 0),
  },
  models: {
    pairwise_ranker: {
      feature_names: pairFeatureNames(),
      train_examples: pairwiseExamples.length,
      weights: Object.fromEntries(pairFeatureNames().map((name, index) => [name, pairModel.weights[index]])),
      bias: pairModel.bias,
      train_loss: pairModel.loss,
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
  delta_vs_router: deltaVsRouter,
  contract_gate_metrics: gate.metrics,
  baseline_comparison: {
    d448_router_correct: 42,
    d450_independent_support_plan_correct: 35,
    structured_group_nonreview_correct: 47,
    four_source_oracle_nonreview_correct: 57,
    contrastive_support_planner_correct: Math.round(gate.metrics.overall_contract_correct_rate * gate.metrics.examples),
  },
  decision: decisionFor(gate.metrics, diagnostics, deltaVsRouter),
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
    note: "Local pairwise/listwise support planner only. No OpenAI, Prime, or other paid model calls.",
  },
  artifacts: {
    predictions_jsonl: rel(predictionsPath),
    pairwise_examples_jsonl: rel(path.join(outputDir, "pairwise_examples.jsonl")),
    scored_predictions_jsonl: rel(path.join(runsDir, gateRunId, "scored_predictions.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "pairwise_examples.jsonl"), pairwiseExamples);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  training: result.training,
  calibration: result.calibration,
  diagnostics: result.diagnostics,
  delta_vs_router: result.delta_vs_router,
  contract_gate_metrics: result.contract_gate_metrics,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function pairwiseTrainingExamples(row) {
  if (row.target?.answer_type !== "grounded_answer") return [];
  const target = new Set(normalizeCitations(row.target?.citations));
  const evidence = (row.input?.compact_retrieved_evidence_pack ?? []).filter((item) => item.evidence_id);
  const positives = evidence.filter((item) => target.has(item.evidence_id));
  const negatives = evidence.filter((item) => !target.has(item.evidence_id));
  const out = [];
  for (const pos of positives) {
    for (const neg of negatives) {
      const diff = pairDiff(row, pos, neg);
      out.push({ example_id: row.example_id, positive_evidence_id: pos.evidence_id, negative_evidence_id: neg.evidence_id, y: 1, x: diff });
      out.push({ example_id: row.example_id, positive_evidence_id: neg.evidence_id, negative_evidence_id: pos.evidence_id, y: 0, x: diff.map((value) => -value) });
    }
  }
  return out;
}

function calibrate(rows, pairModel, pairScaler, answerModel, answerScaler) {
  const candidates = [];
  for (const answerThreshold of [0.2, 0.3, 0.42, 0.54, 0.66]) {
    for (const margin of [0.01, 0.03, 0.06, 0.1, 0.16, 0.24]) {
      for (const maxCitations of [1, 2, 3, 4]) {
        for (const desiredMode of ["none", "soft", "hard"]) {
          const params = { answer_threshold: answerThreshold, margin, max_citations: maxCitations, desired_mode: desiredMode };
          const metrics = scoreRows(rows, params, pairModel, pairScaler, answerModel, answerScaler);
          const objective = metrics.overall_contract_correct_rate
            + metrics.citation_set_exact_rate * 0.012
            + metrics.multi_citation_exact_rate * 0.018
            - Math.max(0, metrics.mean_citations_when_grounded - metrics.mean_target_citations_when_grounded) * 0.01;
          candidates.push({ params, metrics, objective });
        }
      }
    }
  }
  candidates.sort((left, right) => right.objective - left.objective
    || right.metrics.overall_contract_correct_rate - left.metrics.overall_contract_correct_rate
    || right.metrics.citation_set_exact_rate - left.metrics.citation_set_exact_rate
    || right.metrics.multi_citation_exact_rate - left.metrics.multi_citation_exact_rate);
  return {
    validation_examples: rows.length,
    selected_params: candidates[0].params,
    validation_metrics: candidates[0].metrics,
    validation_objective: candidates[0].objective,
    top_candidates: candidates.slice(0, 10),
  };
}

function scoreRows(rows, params, pairModel, pairScaler, answerModel, answerScaler) {
  const scored = rows.map((row) => {
    const prediction = buildPrediction(row, params, pairModel, pairScaler, answerModel, answerScaler);
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

function predictRow(row, params, pairModel, pairScaler, answerModel, answerScaler) {
  const prediction = buildPrediction(row, params, pairModel, pairScaler, answerModel, answerScaler);
  return {
    example_id: row.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    metadata: { scaffold: "nonreview_contrastive_support_planner", params, no_model_weights_or_llm_calls: true },
  };
}

function buildPrediction(row, params, pairModel, pairScaler, answerModel, answerScaler) {
  const question = row.input?.question ?? "";
  const counterfactual = row.input?.document_metadata?.counterfactual === true || String(row.example_id).includes(":counterfactual-insufficient");
  const answerability = predict(answerModel, scale(answerFeatures(row, pairModel, pairScaler), answerScaler));
  if (counterfactual || answerability < params.answer_threshold) return abstain(question, answerability);
  const ranked = rankEvidence(row, pairModel, pairScaler);
  if (!ranked.length) return abstain(question, answerability);
  const desired = desiredCount(question);
  const targetCount = params.desired_mode === "hard" && desired ? Math.min(desired, params.max_citations) : 1;
  const selected = [];
  for (const item of ranked) {
    if (selected.length >= params.max_citations) break;
    if (selected.length < targetCount || ranked[0].score - item.score <= params.margin) selected.push(item.evidence_id);
  }
  if (params.desired_mode === "soft" && desired) {
    for (const item of ranked) {
      if (selected.length >= Math.min(desired, params.max_citations)) break;
      if (!selected.includes(item.evidence_id)) selected.push(item.evidence_id);
    }
  }
  return grounded(row.input, selected.length ? selected : [ranked[0].evidence_id]);
}

function rankEvidence(row, pairModel, pairScaler) {
  const evidence = (row.input?.compact_retrieved_evidence_pack ?? []).filter((item) => item.evidence_id);
  return evidence.map((item) => {
    let score = 0;
    for (const other of evidence) {
      if (other.evidence_id === item.evidence_id) continue;
      score += predict(pairModel, scale(pairDiff(row, item, other), pairScaler)) - 0.5;
    }
    return { evidence_id: item.evidence_id, item, score, lexical: lexicalOverlap(row.input?.question, `${item.section ?? ""} ${item.text ?? ""}`) };
  }).sort((left, right) => right.score - left.score || right.lexical - left.lexical || Number(left.item.retrieval_rank ?? 99) - Number(right.item.retrieval_rank ?? 99));
}

function pairDiff(row, left, right) {
  const lf = evidenceFeatures(row, left);
  const rf = evidenceFeatures(row, right);
  return lf.map((value, index) => value - rf[index]);
}

function evidenceFeatures(row, item) {
  const question = row.input?.question ?? "";
  const text = `${item.section ?? ""} ${item.text ?? ""}`;
  const rank = Number(item.retrieval_rank ?? 9);
  const lexical = lexicalOverlap(question, text);
  const sectionLexical = lexicalOverlap(question, item.section ?? "");
  const qHasNumber = /\d|percent|percentage|score|how much|how many/i.test(question) ? 1 : 0;
  const eHasNumber = /\d|%|score|rouge|f1|accuracy|metric|table|tabref/i.test(text) ? 1 : 0;
  const directHintRank = topEvidenceHintRank(row, item.evidence_id);
  return [
    lexical,
    sectionLexical,
    1 / Math.max(1, rank),
    rank,
    qHasNumber && eHasNumber ? 1 : 0,
    /definition|what is|what are|describe|explain/i.test(question) ? lexical : 0,
    /dataset|data|corpus|benchmark/i.test(question) && /dataset|data|corpus|benchmark|reuters|bloomberg|europarl|craigslist/i.test(text) ? 1 : 0,
    /model|architecture|baseline|compared/i.test(question) && /model|architecture|baseline|bert|lstm|cnn|seq2seq|gpt|ranker|reasoner/i.test(text) ? 1 : 0,
    /metric|evaluat|score|fluency|accuracy|f1/i.test(question) && /metric|evaluat|score|fluency|accuracy|f1|ppl|perplexity/i.test(text) ? 1 : 0,
    /introduction|background/i.test(item.section ?? "") ? 1 : 0,
    /result|experiment|analysis|evaluation/i.test(item.section ?? "") ? 1 : 0,
    directHintRank ? 1 / directHintRank : 0,
    text.length > 420 ? 1 : 0,
  ];
}

function answerFeatures(row, pairModel, pairScaler) {
  const ranked = rankEvidence(row, pairModel, pairScaler);
  const scores = ranked.map((item) => item.score);
  const question = row.input?.question ?? "";
  return [
    scores[0] ?? 0,
    scores[1] ?? 0,
    (scores[0] ?? 0) - (scores[1] ?? 0),
    sum(scores.slice(0, 3)),
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
    evidence_first: { sufficiency: "insufficient", supported_claims: [], missing_support: `No calibrated contrastive support plan cleared answerability for: ${question}`, question_target: question ?? "" },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: `Contrastive support-plan answerability score ${Number(score || 0).toFixed(3)} did not clear threshold.`,
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

function summarizeDeltaVsRouter(rows, routerById) {
  return {
    contrastive_correct_router_miss: count(rows, (row) => row.contract_correct && !routerById.get(row.example_id)?.contract_correct),
    contrastive_miss_router_correct: count(rows, (row) => !row.contract_correct && routerById.get(row.example_id)?.contract_correct),
    both_correct: count(rows, (row) => row.contract_correct && routerById.get(row.example_id)?.contract_correct),
    both_miss: count(rows, (row) => !row.contract_correct && !routerById.get(row.example_id)?.contract_correct),
  };
}

function statusFor(metrics, diagnostics) {
  const correct = Math.round(metrics.overall_contract_correct_rate * metrics.examples);
  if (correct >= 47) return "contrastive_support_planner_matches_structured_group";
  if (correct > 42) return "contrastive_support_planner_beats_router";
  if (diagnostics.multi_citation_exact > 3) return "contrastive_support_planner_improves_multicitation_only";
  return "contrastive_support_planner_below_router";
}

function decisionFor(metrics, diagnostics, deltaVsRouter) {
  const correct = Math.round(metrics.overall_contract_correct_rate * metrics.examples);
  const beatsStructured = correct >= 47;
  return {
    promote_as_current_best_scaffold: beatsStructured,
    keep_as_candidate_source: correct > 42 || diagnostics.multi_citation_exact > 3 || deltaVsRouter.contrastive_correct_router_miss > 0,
    buy_openai_labels_now: false,
    rent_prime_gpu_now: false,
    broaden_student_training_now: false,
    reason: `Contrastive support planner scores ${correct}/${metrics.examples}; it rescues ${deltaVsRouter.contrastive_correct_router_miss} router misses and regresses ${deltaVsRouter.contrastive_miss_router_correct} router-correct rows.`,
    next_step: beatsStructured
      ? "Promote and stress-test on a fresh temporal slice before any GPU spend."
      : "Keep only as an analysis candidate; if rescues are nonzero, mine the rescued rows into a guarded router feature, otherwise stop local support-planner variants and consider a capped adjudicated label packet.",
  };
}

function renderReport(result) {
  return `# Non-Review Contrastive Support Planner

Generated: ${result.generated_at}

Status: \`${result.status}\`

This zero-spend run trains a pairwise required-vs-distractor evidence ranker from support-plan labels, calibrates on D437 SFT validation, and evaluates only on fresh non-review examples.

## Result

- Contract correct: ${result.baseline_comparison.contrastive_support_planner_correct}/${result.contract_gate_metrics.examples}
- Answer type correct: ${result.diagnostics.answer_type_correct}/${result.contract_gate_metrics.examples}
- Citation-set exact: ${result.diagnostics.citation_set_exact}/${result.contract_gate_metrics.examples}
- Multi-citation exact: ${result.diagnostics.multi_citation_exact}/${result.diagnostics.target_multi_citation_grounded}
- Rescued router misses: ${result.delta_vs_router.contrastive_correct_router_miss}
- Regressed router-correct rows: ${result.delta_vs_router.contrastive_miss_router_correct}

## Baselines

- D448 router: ${result.baseline_comparison.d448_router_correct}/64
- D450 independent support-plan scaffold: ${result.baseline_comparison.d450_independent_support_plan_correct}/64
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

function pairFeatureNames() {
  return ["lexical_overlap_delta", "section_lexical_overlap_delta", "inverse_rank_delta", "rank_delta", "numeric_match_delta", "definition_lexical_delta", "dataset_match_delta", "model_architecture_match_delta", "metric_match_delta", "intro_background_delta", "result_experiment_delta", "top_hint_inverse_rank_delta", "long_evidence_delta"];
}

function answerFeatureNames() {
  return ["top_ranker_score", "second_ranker_score", "top_second_margin", "sum_top3_ranker_score", "enumerative_question", "question_has_numeric", "desired_count", "evidence_count", "counterfactual_metadata"];
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
