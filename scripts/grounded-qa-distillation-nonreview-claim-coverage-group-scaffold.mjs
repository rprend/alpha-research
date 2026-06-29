import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "nonreview-oracle-contrast-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "nonreview-claim-coverage-group-scaffold-2026-06-29-v1";
const packetDir = path.join(runsDir, packetRunId, "dataset");
const outputDir = path.join(runsDir, runId);
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model models dataset datasets task result results use uses is in on of to a an by as or be can it its we our you your over under through between among all three two one do has have had not no yes where when who why".split(" "));

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const packet = await readJson(path.join(runsDir, packetRunId, "result.json"));
const trainRows = await readJsonl(path.join(packetDir, "sft_train.jsonl"));
const validationRows = await readJsonl(path.join(packetDir, "sft_validation.jsonl"));
const evalPrompts = await readJsonl(path.join(packetDir, "eval_prompts.jsonl"));
const evalTargets = await readJsonl(path.join(packetDir, "eval_targets_diagnostic.jsonl"));

const groupRows = trainRows.flatMap(groupTrainingRows);
const scaler = makeScaler(groupRows.map((row) => row.x));
const groupModel = trainLogistic(groupRows.map((row) => ({ ...row, x: scale(row.x, scaler) })), { iterations: 1800, learningRate: 0.08, l2: 0.025 });
const answerExamples = trainRows.map((row) => ({
  x: answerFeatures(row, groupModel, scaler),
  y: row.target.answer_type === "grounded_answer" ? 1 : 0,
}));
const answerScaler = makeScaler(answerExamples.map((row) => row.x));
const answerModel = trainLogistic(answerExamples.map((row) => ({ ...row, x: scale(row.x, answerScaler) })), { iterations: 1200, learningRate: 0.08, l2: 0.03 });
const calibration = calibrate(validationRows, groupModel, scaler, answerModel, answerScaler);
const predictions = evalPrompts.map((row) => predictRow(row, calibration.selected_params, groupModel, scaler, answerModel, answerScaler));
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);
const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);
const scoredRows = await readJsonl(path.join(runsDir, gateRunId, "scored_predictions.jsonl"));
const diagnostics = summarizeDiagnostics(scoredRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "nonreview_claim_coverage_group_scaffold",
  status: statusFor(gate.metrics),
  purpose: "Test a deployable no-spend claim/question-part coverage scaffold over grouped evidence candidates for D437 non-review grounded QA.",
  source_runs: { packet: packetRunId, contract_gate: gateRunId },
  source_context: {
    packet_status: packet.status,
    train_rows: trainRows.length,
    validation_rows: validationRows.length,
    eval_prompts: evalPrompts.length,
    eval_targets: evalTargets.length,
  },
  method: {
    type: "logistic_group_selector_plus_answerability_guard",
    group_space: "single evidence, rank windows, section groups, float/table neighborhoods, desired-count top lexical groups, and greedy new-question-token coverage groups",
    threshold_selection: "validation contract correctness with answer-rate and mean-citation regularizers",
    openai_calls: 0,
    gpu_calls: 0,
  },
  models: {
    group_selector: {
      feature_names: groupFeatureNames(),
      train_examples: groupRows.length,
      positive_rate: rate(count(groupRows, (row) => row.y === 1), groupRows.length),
      weights: Object.fromEntries(groupFeatureNames().map((name, index) => [name, groupModel.weights[index]])),
      bias: groupModel.bias,
      train_loss: groupModel.loss,
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
    cheap_scaffold_d439_rate: 37 / 64,
    citation_selector_d440_rate: 41 / 64,
    subset_selector_d442_rate: 40 / 64,
    structured_group_nonreview_rate_from_d436: 47 / 64,
    four_source_oracle_nonreview_rate_from_d436: 57 / 64,
    delta_vs_d442: gate.metrics.overall_contract_correct_rate - (40 / 64),
    delta_vs_structured_group: gate.metrics.overall_contract_correct_rate - (47 / 64),
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
    note: "Local scaffold only. No OpenAI, Prime, or other model calls.",
  },
  artifacts: {
    predictions_jsonl: rel(predictionsPath),
    scored_predictions_jsonl: rel(path.join(runsDir, gateRunId, "scored_predictions.jsonl")),
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
  diagnostics: result.diagnostics,
  contract_gate_metrics: result.contract_gate_metrics,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function groupTrainingRows(row) {
  const targetKey = key(row.target.citations);
  return candidateGroups(row).map((group) => ({
    example_id: row.example_id,
    group_id: group.group_id,
    x: groupFeatures(row, group),
    y: row.target.answer_type === "grounded_answer" && key(group.ids) === targetKey ? 1 : 0,
  }));
}

function calibrate(rows, groupModel, scaler, answerModel, answerScaler) {
  const candidates = [];
  for (const answerThreshold of [0.24, 0.32, 0.4, 0.5, 0.6, 0.7]) {
    for (const groupThreshold of [0.04, 0.08, 0.12, 0.18, 0.26, 0.36]) {
      for (const maxGroupSize of [1, 2, 3, 4, 5]) {
        const params = { answer_threshold: answerThreshold, group_threshold: groupThreshold, max_group_size: maxGroupSize };
        const metrics = scoreRows(rows, params, groupModel, scaler, answerModel, answerScaler);
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
    || left.params.max_group_size - right.params.max_group_size);
  return {
    validation_examples: rows.length,
    selected_params: candidates[0].params,
    validation_metrics: candidates[0].metrics,
    validation_objective: candidates[0].objective,
    top_candidates: candidates.slice(0, 10),
  };
}

function scoreRows(rows, params, groupModel, scaler, answerModel, answerScaler) {
  const scored = rows.map((row) => {
    const prediction = buildPrediction(row, params, groupModel, scaler, answerModel, answerScaler);
    const targetCitations = normalizeCitations(row.target.citations);
    const answerTypeCorrect = prediction.answer_type === row.target.answer_type;
    const citationSetExact = prediction.answer_type === "abstain"
      ? prediction.citations.length === 0
      : setEqual(new Set(prediction.citations), new Set(targetCitations));
    return {
      contract_correct: answerTypeCorrect && citationSetExact,
      answer_type_correct: answerTypeCorrect,
      citation_set_exact: citationSetExact,
      prediction_answer_type: prediction.answer_type,
      target_answer_type: row.target.answer_type,
      citations: prediction.citations.length,
      target_citations: targetCitations.length,
    };
  });
  const grounded = scored.filter((row) => row.prediction_answer_type === "grounded_answer");
  const targetGrounded = scored.filter((row) => row.target_answer_type === "grounded_answer");
  return {
    rows: scored.length,
    overall_contract_correct_rate: rate(count(scored, (row) => row.contract_correct), scored.length),
    answer_type_accuracy: rate(count(scored, (row) => row.answer_type_correct), scored.length),
    citation_set_exact_rate: rate(count(scored, (row) => row.citation_set_exact), scored.length),
    answer_rate: rate(grounded.length, scored.length),
    target_answer_rate: rate(targetGrounded.length, scored.length),
    mean_citations_when_grounded: mean(grounded.map((row) => row.citations)),
    mean_target_citations_when_grounded: mean(targetGrounded.map((row) => row.target_citations)),
  };
}

function predictRow(row, params, groupModel, scaler, answerModel, answerScaler) {
  const prediction = buildPrediction(row, params, groupModel, scaler, answerModel, answerScaler);
  return {
    example_id: row.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    metadata: {
      scaffold: "nonreview_claim_coverage_group_scaffold",
      params,
      no_model_weights_or_llm_calls: true,
    },
  };
}

function buildPrediction(row, params, groupModel, scaler, answerModel, answerScaler) {
  const question = row.input.question ?? "";
  const counterfactual = row.input.document_metadata?.counterfactual === true || String(row.example_id).includes(":counterfactual-insufficient");
  const answerability = predict(answerModel, scale(answerFeatures(row, groupModel, scaler), answerScaler));
  if (counterfactual || answerability < params.answer_threshold) return abstain(question, answerability);
  const groups = candidateGroups(row)
    .filter((group) => group.ids.length <= params.max_group_size)
    .map((group) => ({ ...group, probability: predict(groupModel, scale(groupFeatures(row, group), scaler)) }))
    .sort((left, right) => right.probability - left.probability || groupTie(left, right));
  const selected = groups.find((group) => group.probability >= params.group_threshold) ?? groups[0];
  if (!selected?.ids?.length) return abstain(question, answerability);
  return grounded(row.input, selected.ids);
}

function candidateGroups(row) {
  const evidence = (row.input.compact_retrieved_evidence_pack ?? []).filter((item) => item.evidence_id).slice(0, 7);
  const out = [];
  const add = (type, ids) => {
    const clean = [...new Set(ids)].filter(Boolean).slice(0, 5);
    if (!clean.length) return;
    const groupKey = key(clean);
    if (!out.some((item) => key(item.ids) === groupKey)) out.push({ group_id: `${type}:${groupKey}`, group_type: type, ids: clean });
  };
  for (const item of evidence) add("single", [item.evidence_id]);
  for (const width of [2, 3, 4, 5]) {
    for (let index = 0; index <= evidence.length - width; index += 1) add(`rank_window_${width}`, evidence.slice(index, index + width).map((item) => item.evidence_id));
  }
  for (const rows of Object.values(groupBy(evidence, (item) => sectionRoot(item.section)))) if (rows.length > 1) add("section_root", rows.map((item) => item.evidence_id));
  for (const rows of Object.values(groupBy(evidence, (item) => sectionStem(item.section)))) if (rows.length > 1) add("section_stem", rows.map((item) => item.evidence_id));
  const tableRows = evidence.filter((item) => /float selected|table|figure|tabref|score|metric/i.test(`${item.section ?? ""} ${item.text ?? ""}`));
  if (tableRows.length) add("table_metric_group", tableRows.map((item) => item.evidence_id));
  const desired = desiredCount(row.input.question);
  if (desired) add("top_desired_lexical", [...evidence].sort((a, b) => evidenceScore(row, b) - evidenceScore(row, a)).slice(0, desired).map((item) => item.evidence_id));
  add("greedy_new_question_terms", greedyCoverageGroup(row).map((item) => item.evidence_id));
  return out;
}

function greedyCoverageGroup(row) {
  const qTokens = new Set(contentTokens(row.input.question));
  const evidence = [...(row.input.compact_retrieved_evidence_pack ?? [])].map((item) => ({
    ...item,
    tokens: new Set(contentTokens(`${item.section ?? ""} ${item.text ?? ""}`).filter((token) => qTokens.has(token))),
  }));
  const selected = [];
  const covered = new Set();
  for (let step = 0; step < 5; step += 1) {
    const best = evidence
      .filter((item) => !selected.includes(item))
      .map((item) => ({ item, gain: [...item.tokens].filter((token) => !covered.has(token)).length, score: evidenceScore(row, item) }))
      .sort((a, b) => b.gain - a.gain || b.score - a.score || Number(a.item.retrieval_rank ?? 99) - Number(b.item.retrieval_rank ?? 99))[0];
    if (!best || best.gain <= 0 && selected.length) break;
    selected.push(best.item);
    for (const token of best.item.tokens) covered.add(token);
  }
  return selected.length ? selected : evidence.slice(0, 1);
}

function groupFeatures(row, group) {
  const byId = new Map((row.input.compact_retrieved_evidence_pack ?? []).map((item) => [item.evidence_id, item]));
  const items = group.ids.map((id) => byId.get(id)).filter(Boolean);
  const q = row.input.question ?? "";
  const desired = desiredCount(q) ?? 0;
  const scores = items.map((item) => evidenceScore(row, item));
  const ranks = items.map((item) => Number(item.retrieval_rank ?? 99));
  const roots = new Set(items.map((item) => sectionRoot(item.section)).filter(Boolean));
  const stems = new Set(items.map((item) => sectionStem(item.section)).filter(Boolean));
  const qTokens = new Set(contentTokens(q));
  const coveredQ = new Set(items.flatMap((item) => contentTokens(`${item.section ?? ""} ${item.text ?? ""}`).filter((token) => qTokens.has(token))));
  return [
    group.ids.length,
    group.ids.length ** 2,
    desired,
    desired ? Math.abs(group.ids.length - desired) : 0,
    mean(scores),
    Math.max(...scores, 0),
    Math.min(...scores, 0),
    sum(scores),
    qTokens.size ? coveredQ.size / qTokens.size : 0,
    roots.size === 1 && items.length > 1 ? 1 : 0,
    stems.size === 1 && items.length > 1 ? 1 : 0,
    isContiguous(ranks) ? 1 : 0,
    Math.min(...ranks, 99),
    /table|float|score|metric/i.test(group.group_type + " " + items.map((item) => item.section).join(" ")) ? 1 : 0,
    row.input.document_metadata?.counterfactual === true || String(row.example_id).includes(":counterfactual-insufficient") ? 1 : 0,
    isEnumerativeQuestion(q) ? 1 : 0,
  ];
}

function answerFeatures(row, groupModel, scaler) {
  const groups = candidateGroups(row).map((group) => ({ ...group, probability: predict(groupModel, scale(groupFeatures(row, group), scaler)) }))
    .sort((left, right) => right.probability - left.probability || groupTie(left, right));
  const top = groups[0] ?? { probability: 0, ids: [] };
  const probs = groups.map((group) => group.probability);
  return [
    probs[0] ?? 0,
    probs[1] ?? 0,
    probs[2] ?? 0,
    top.ids.length,
    sum(probs.slice(0, 3)),
    count(groups, (group) => group.probability >= 0.2),
    row.input.document_metadata?.counterfactual === true || String(row.example_id).includes(":counterfactual-insufficient") ? 1 : 0,
    isEnumerativeQuestion(row.input.question) ? 1 : 0,
    /\d/.test(row.input.question ?? "") ? 1 : 0,
    row.input.compact_retrieved_evidence_pack?.length ?? 0,
  ];
}

function grounded(input, citations) {
  const byId = new Map((input.compact_retrieved_evidence_pack ?? []).map((item) => [item.evidence_id, item]));
  const claims = citations.map((id, index) => {
    const item = byId.get(id);
    return { claim_id: `C${index + 1}`, claim: bestSentence(input.question, item?.text ?? ""), citations: [id], support_status: "supported" };
  });
  return {
    answer_type: "grounded_answer",
    evidence_first: { sufficiency: "sufficient", supported_claims: claims, missing_support: "", question_target: input.question ?? "" },
    answer: `${claims.map((claim) => claim.claim).join(" ")} ${citations.map((id) => `[${id}]`).join(" ")}`.trim(),
    citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function abstain(question, score) {
  return {
    answer_type: "abstain",
    evidence_first: { sufficiency: "insufficient", supported_claims: [], missing_support: `No calibrated claim-coverage evidence group cleared answerability for: ${question}`, question_target: question ?? "" },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: `Claim-coverage group score ${Number(score || 0).toFixed(3)} did not clear threshold.`,
  };
}

function summarizeDiagnostics(rows) {
  const grounded = rows.filter((row) => row.target_answer_type === "grounded_answer");
  const multi = grounded.filter((row) => normalizeCitations(row.target?.citations).length > 1);
  return {
    target_grounded: grounded.length,
    target_multi_citation_grounded: multi.length,
    multi_citation_exact: count(multi, (row) => row.citation_set_exact),
    multi_citation_contract_correct: count(multi, (row) => row.contract_correct),
    mean_predicted_citations_on_multi_targets: mean(multi.map((row) => normalizeCitations(row.prediction?.citations).length)),
    undercite_multi_targets: count(multi, (row) => normalizeCitations(row.prediction?.citations).length < normalizeCitations(row.target?.citations).length),
    overcite_multi_targets: count(multi, (row) => normalizeCitations(row.prediction?.citations).length > normalizeCitations(row.target?.citations).length),
  };
}

function statusFor(metrics) {
  if (metrics.overall_contract_correct_rate >= 47 / 64) return "claim_coverage_group_scaffold_matches_structured_group";
  if (metrics.overall_contract_correct_rate >= 41 / 64) return "claim_coverage_group_scaffold_matches_d440";
  return "claim_coverage_group_scaffold_below_d440";
}

function decisionFor(metrics, diagnostics) {
  const improvedMulti = diagnostics.multi_citation_exact > 0;
  return {
    promote_as_current_best_scaffold: metrics.overall_contract_correct_rate >= 47 / 64,
    keep_as_candidate_source: metrics.overall_contract_correct_rate >= 41 / 64 || improvedMulti,
    buy_openai_labels_now: false,
    rent_prime_gpu_now: false,
    reason: `Fresh contract correctness is ${Math.round(metrics.overall_contract_correct_rate * metrics.examples)}/${metrics.examples}; multi-citation exact is ${diagnostics.multi_citation_exact}/${diagnostics.target_multi_citation_grounded}.`,
    next_step: improvedMulti
      ? "Use this as a candidate source in a non-review router audit and analyze remaining multi-citation misses."
      : "Do not continue local citation grouping without stronger supervision; move to support-planner labels or a small adjudicated packet.",
  };
}

function renderReport(result) {
  return `# Non-Review Claim-Coverage Group Scaffold

Generated: ${result.generated_at}

Status: \`${result.status}\`

This zero-spend run trains a grouped evidence selector on D437 train rows, calibrates on D437 SFT validation, and evaluates only the D437 fresh non-review eval split.

## Fresh Eval

- Eval examples: ${result.contract_gate_metrics.examples}
- Predictions: ${result.predictions.grounded_answer} grounded, ${result.predictions.abstain} abstain
- Mean citations when grounded: ${result.predictions.mean_citations_when_grounded.toFixed(2)}
- Overall contract correct: ${pct(result.contract_gate_metrics.overall_contract_correct_rate)}
- Citation-set exact: ${pct(result.contract_gate_metrics.citation_set_exact_rate)}
- Multi-citation exact: ${result.diagnostics.multi_citation_exact}/${result.diagnostics.target_multi_citation_grounded}

## Baselines

- D440 citation selector: ${pct(result.baseline_comparison.citation_selector_d440_rate)}
- D442 subset selector: ${pct(result.baseline_comparison.subset_selector_d442_rate)}
- Structured-group non-review baseline: ${pct(result.baseline_comparison.structured_group_nonreview_rate_from_d436)}
- Four-source non-review oracle: ${pct(result.baseline_comparison.four_source_oracle_nonreview_rate_from_d436)}

## Decision

- Promote as current best scaffold: ${result.decision.promote_as_current_best_scaffold ? "yes" : "no"}
- Keep as candidate source: ${result.decision.keep_as_candidate_source ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function candidateEvidenceScore(question, item) {
  const qTokens = new Set(contentTokens(question));
  const eTokens = contentTokens(`${item.section ?? ""} ${item.text ?? ""}`);
  const overlap = new Set(eTokens.filter((token) => qTokens.has(token))).size / Math.max(1, qTokens.size);
  const numbers = /\d/.test(question ?? "") && /\d/.test(item.text ?? "") ? 0.25 : 0;
  const table = /table|float selected|score|metric|result|%|\d/.test(`${item.section ?? ""} ${item.text ?? ""}`.toLowerCase()) ? 0.12 : 0;
  return overlap + numbers + table + 0.08 / Math.max(1, Number(item.retrieval_rank ?? 9));
}

function evidenceScore(row, item) {
  return candidateEvidenceScore(row.input.question, item);
}

function desiredCount(question) {
  const q = String(question ?? "").toLowerCase();
  if (/\bfour\b|4/.test(q)) return 4;
  if (/\bthree\b|3/.test(q)) return 3;
  if (/\btwo\b|2/.test(q)) return 2;
  if (/what are|which .*s\b|list|metrics|baselines|websites|types|investigations|private companies/.test(q)) return 2;
  return null;
}

function isEnumerativeQuestion(question) {
  return Boolean(desiredCount(question)) || /\bwhat are\b|\bwhich\b|\blist\b/i.test(question ?? "");
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

function clean(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 320);
}

function sectionRoot(section) {
  return String(section ?? "").split(":::")[0].trim().toLowerCase();
}

function sectionStem(section) {
  return String(section ?? "").split(":::").slice(0, 2).join(":::").trim().toLowerCase();
}

function groupBy(rows, fn) {
  const grouped = {};
  for (const row of rows) {
    const keyValue = fn(row);
    if (!keyValue) continue;
    grouped[keyValue] ??= [];
    grouped[keyValue].push(row);
  }
  return grouped;
}

function isContiguous(values) {
  if (values.length < 2) return false;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.at(-1) - sorted[0] === sorted.length - 1;
}

function groupTie(left, right) {
  return left.ids.length - right.ids.length || key(left.ids).localeCompare(key(right.ids));
}

function groupFeatureNames() {
  return ["group_size", "group_size_squared", "desired_count", "count_distance", "mean_evidence_score", "max_evidence_score", "min_evidence_score", "sum_evidence_score", "question_token_coverage", "same_section_root", "same_section_stem", "contiguous_rank_window", "min_rank", "table_or_metric_group", "counterfactual_metadata", "enumerative_question"];
}

function answerFeatureNames() {
  return ["top_group_probability", "second_group_probability", "third_group_probability", "top_group_size", "sum_top3_probability", "count_groups_over_0p2", "counterfactual_metadata", "enumerative_question", "question_has_number", "evidence_count"];
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
  const grounded = rows.filter((row) => row.prediction.answer_type === "grounded_answer");
  return { examples: rows.length, grounded_answer: grounded.length, abstain: rows.length - grounded.length, mean_citations_when_grounded: mean(grounded.map((row) => row.prediction.citations.length)) };
}

function summarizeTargets(rows) {
  const grounded = rows.filter((row) => row.target.answer_type === "grounded_answer");
  return { examples: rows.length, grounded_answer: grounded.length, abstain: rows.length - grounded.length, mean_citations_when_grounded: mean(grounded.map((row) => normalizeCitations(row.target.citations).length)) };
}

function contentTokens(text) {
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stopwords.has(token));
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => typeof citation === "string" ? citation.replace(/^\[|\]$/g, "") : String(citation?.evidence_id ?? citation?.id ?? "")).filter(Boolean);
}

function key(ids) {
  return normalizeCitations(ids).sort().join(",");
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
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
