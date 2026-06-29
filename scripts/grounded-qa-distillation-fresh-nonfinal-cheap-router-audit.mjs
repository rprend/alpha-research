import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "fresh-nonfinal-cheap-router-audit-v1";
const packetRunId = args["packet-run-id"] ?? "frontier-full-nonfinal-packet-2026-06-29-v1";
const patternRunId = args["pattern-run-id"] ?? "fresh-nonfinal-pattern-constructor-audit-v1";
const learnedRunId = args["learned-run-id"] ?? "fresh-nonfinal-learned-citation-set-audit-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const targetById = new Map(targets.map((row) => [row.example_id, row.target]));
const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const patternRows = await readJsonl(path.join(runsDir, patternRunId, "predictions.jsonl"));
const learnedRows = [
  ...await readJsonl(path.join(runsDir, learnedRunId, "train_tune_predictions.jsonl")),
  ...await readJsonl(path.join(runsDir, learnedRunId, "train_heldout_predictions.jsonl")),
  ...await readJsonl(path.join(runsDir, learnedRunId, "fresh_validation_predictions.jsonl")),
];

const patternById = new Map(patternRows.map((row) => [row.example_id, row]));
const learnedById = new Map(learnedRows.map((row) => [row.example_id, row]));
const candidateRows = prompts.map((prompt) => {
  const target = targetById.get(prompt.example_id);
  const pattern = scoreCandidate("pattern", patternById.get(prompt.example_id), prompt, target);
  const learned = scoreCandidate("learned", learnedById.get(prompt.example_id), prompt, target);
  return {
    example_id: prompt.example_id,
    source_split: prompt.source_split,
    router_split: routerSplit(prompt.example_id, prompt.source_split),
    target_answer_type: target?.answer_type,
    intent: intentFor(prompt.example_id),
    target_citations: normalizeCitations(target?.citations),
    candidates: { pattern, learned },
  };
});

const trainTuneRows = candidateRows.filter((row) => row.router_split === "train_tune");
const trainHeldoutRows = candidateRows.filter((row) => row.router_split === "train_heldout");
const validationRows = candidateRows.filter((row) => row.router_split === "fresh_validation");
const correctnessTrainingRows = correctnessRowsFor(trainTuneRows);
const correctnessScaler = makeScaler(correctnessTrainingRows.map((row) => row.feature_values));
const correctnessModel = trainLogistic(correctnessTrainingRows, correctnessScaler, { epochs: 1000, learningRate: 0.08, l2: 0.04 });
attachCorrectnessScores(candidateRows);

const policies = enumeratePolicies();
const policyRows = policies.map((policy) => evaluatePolicy(policy, candidateRows));
const selectedPolicy = [...policyRows].sort((left, right) =>
  right.train_heldout.contract_correct - left.train_heldout.contract_correct
  || right.train_heldout.grounded_target_contract_correct - left.train_heldout.grounded_target_contract_correct
  || left.train_heldout.over_answered_abstentions - right.train_heldout.over_answered_abstentions
  || left.policy_id.localeCompare(right.policy_id)
)[0];

const selectedRows = routeRows(validationRows, selectedPolicy.policy);
const allRoutedRows = routeRows(candidateRows, selectedPolicy.policy);
const selectedPredictions = allRoutedRows.map((row) => ({
  example_id: row.example_id,
  prediction: row.selected_candidate.prediction,
  raw_output: JSON.stringify(row.selected_candidate.prediction),
  metadata: {
    scaffold: "fresh_nonfinal_cheap_router",
    selected_source: row.selected_source,
    selected_policy: selectedPolicy.policy,
    no_model_weights_or_llm_calls: true,
  },
}));
const predictionsPath = path.join(outputDir, "routed_predictions_for_gate.jsonl");
await writeJsonl(predictionsPath, selectedPredictions);
const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "fresh_nonfinal_cheap_router_audit",
  status: statusFor(selectedPolicy, validationRows),
  purpose: "Test whether a zero-cost router between the generic pattern constructor and learned citation-set predictor adds selectable fresh-validation headroom before buying labels or renting GPUs.",
  source_runs: {
    packet: packetRunId,
    pattern_constructor: patternRunId,
    learned_citation_set: learnedRunId,
    contract_gate: gateRunId,
  },
  leakage_note: "Router policies are enumerated and selected only on source_split=train heldout rows. Fresh source_split=validation rows are used only once for final reporting and the contract gate.",
  training: {
    correctness_training_candidate_rows: correctnessTrainingRows.length,
    positive_correctness_rows: count(correctnessTrainingRows, (row) => row.label_correct),
    feature_names: correctnessFeatureNames(),
    model: {
      weights: correctnessModel.weights,
      intercept: correctnessModel.intercept,
      feature_means: correctnessScaler.means,
      feature_scales: correctnessScaler.scales,
    },
  },
  selected_policy: selectedPolicy,
  source_metrics: {
    pattern: summarizeCandidates(validationRows, "pattern"),
    learned: summarizeCandidates(validationRows, "learned"),
    oracle_any_cheap_source: summarizeOracle(validationRows),
  },
  metrics: {
    train_tune: selectedPolicy.train_tune,
    train_heldout: selectedPolicy.train_heldout,
    fresh_validation: selectedPolicy.fresh_validation,
    contract_gate: gate.metrics,
  },
  decision: decisionFor(selectedPolicy, validationRows),
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
    note: "This audit reads local candidate artifacts and runs the local contract gate only.",
  },
  artifacts: {
    candidate_rows_jsonl: rel(path.join(outputDir, "candidate_rows.jsonl")),
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    fresh_validation_routed_rows_jsonl: rel(path.join(outputDir, "fresh_validation_routed_rows.jsonl")),
    routed_predictions_jsonl: rel(predictionsPath),
    contract_gate_result_json: rel(path.join(runsDir, gateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "candidate_rows.jsonl"), candidateRows);
await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), policyRows);
await writeJsonl(path.join(outputDir, "fresh_validation_routed_rows.jsonl"), selectedRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_policy: result.selected_policy,
  source_metrics: result.source_metrics,
  metrics: result.metrics,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function scoreCandidate(source, row, prompt, target) {
  const prediction = normalizePrediction(row?.prediction ?? row?.raw_output);
  const targetAnswerType = target?.answer_type;
  const citations = normalizeCitations(prediction?.citations);
  const targetCitations = normalizeCitations(target?.citations);
  const answerTypeCorrect = prediction?.answer_type === targetAnswerType;
  const citationSetExact = prediction?.answer_type === "abstain"
    ? citations.length === 0
    : setEqual(new Set(citations), new Set(targetCitations));
  const contractCorrect = Boolean(answerTypeCorrect && citationSetExact);
  const evidenceScores = Array.isArray(row?.selected_evidence_scores) ? row.selected_evidence_scores : [];
  const topEvidenceProb = Number(evidenceScores[0]?.probability ?? 0);
  const secondEvidenceProb = Number(evidenceScores[1]?.probability ?? 0);
  const metadata = row?.metadata ?? {};
  return {
    source,
    exists: Boolean(row),
    prediction,
    answer_type: prediction?.answer_type ?? null,
    citations,
    contract_correct: contractCorrect,
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    feature: {
      answer_is_grounded: prediction?.answer_type === "grounded_answer" ? 1 : 0,
      answer_is_abstain: prediction?.answer_type === "abstain" ? 1 : 0,
      citation_count: citations.length,
      pattern_top_score: Number(metadata.top_score ?? 0),
      learned_top_probability: topEvidenceProb,
      learned_margin: topEvidenceProb - secondEvidenceProb,
      question_evidence_count: prompt.input?.compact_retrieved_evidence_pack?.length ?? 0,
    },
  };
}

function correctnessRowsFor(rows) {
  return rows.flatMap((row) => ["pattern", "learned"].map((source) => ({
    example_id: row.example_id,
    source,
    label_correct: row.candidates[source].contract_correct ? 1 : 0,
    feature_values: correctnessFeatures(row, source),
  })));
}

function attachCorrectnessScores(rows) {
  for (const row of rows) {
    for (const source of ["pattern", "learned"]) {
      row.candidates[source].predicted_correctness = predictProb(correctnessModel, correctnessScaler, correctnessFeatures(row, source));
    }
  }
}

function correctnessFeatureNames() {
  return [
    "bias",
    "source_is_pattern",
    "source_is_learned",
    "candidate_grounded_answer",
    "candidate_abstain",
    "candidate_citation_count",
    "pattern_top_score",
    "learned_top_probability",
    "learned_margin",
    "sources_agree_answer_type",
    "sources_agree_citations",
    "both_grounded_answer",
    "both_abstain",
    "counterfactual_prompt",
    "intent_numeric_or_metric",
    "intent_dataset",
    "intent_method_or_model",
  ];
}

function correctnessFeatures(row, source) {
  const candidate = row.candidates[source];
  const pattern = row.candidates.pattern;
  const learned = row.candidates.learned;
  const citations = new Set(candidate.citations);
  const patternCitations = new Set(pattern.citations);
  const learnedCitations = new Set(learned.citations);
  const intent = row.intent ?? "";
  return [
    1,
    source === "pattern" ? 1 : 0,
    source === "learned" ? 1 : 0,
    candidate.answer_type === "grounded_answer" ? 1 : 0,
    candidate.answer_type === "abstain" ? 1 : 0,
    citations.size,
    pattern.feature.pattern_top_score,
    learned.feature.learned_top_probability,
    learned.feature.learned_margin,
    pattern.answer_type === learned.answer_type ? 1 : 0,
    setEqual(patternCitations, learnedCitations) ? 1 : 0,
    pattern.answer_type === "grounded_answer" && learned.answer_type === "grounded_answer" ? 1 : 0,
    pattern.answer_type === "abstain" && learned.answer_type === "abstain" ? 1 : 0,
    intent.includes("counterfactual") ? 1 : 0,
    intent.includes("numeric") || intent.includes("metric") || intent.includes("optimization") ? 1 : 0,
    intent.includes("dataset") ? 1 : 0,
    intent.includes("method") || intent.includes("model") || intent.includes("architecture") ? 1 : 0,
  ];
}

function enumeratePolicies() {
  const policies = [
    { family: "always_pattern", source: "pattern" },
    { family: "always_learned", source: "learned" },
    { family: "learned_correctness_selector", min_margin: -1 },
    { family: "prefer_learned_answer", fallback: "pattern" },
    { family: "prefer_pattern_answer", fallback: "learned" },
    { family: "prefer_learned_abstention", fallback: "pattern" },
    { family: "prefer_pattern_abstention", fallback: "learned" },
  ];
  for (const minMargin of [-0.15, -0.05, 0, 0.04, 0.08, 0.12]) {
    policies.push({ family: "learned_correctness_selector", min_margin: minMargin, fallback: "learned" });
    policies.push({ family: "learned_correctness_selector", min_margin: minMargin, fallback: "pattern" });
  }
  for (const minLearnedProb of [0.3, 0.38, 0.46, 0.54, 0.62]) {
    for (const minLearnedMargin of [-0.05, 0, 0.06, 0.12, 0.2]) {
      policies.push({ family: "learned_if_confident", min_learned_probability: minLearnedProb, min_learned_margin: minLearnedMargin, fallback: "pattern" });
    }
  }
  for (const minPatternScore of [2, 3, 4, 5, 6]) {
    policies.push({ family: "pattern_if_high_score", min_pattern_score: minPatternScore, fallback: "learned" });
  }
  return policies.map((policy) => ({ ...policy, policy_id: policyId(policy) }));
}

function evaluatePolicy(policy, rows) {
  return {
    policy_id: policy.policy_id,
    policy,
    train_tune: summarizeRouted(routeRows(trainTuneRows, policy)),
    train_heldout: summarizeRouted(routeRows(trainHeldoutRows, policy)),
    fresh_validation: summarizeRouted(routeRows(validationRows, policy)),
  };
}

function routeRows(rows, policy) {
  return rows.map((row) => {
    const selectedSource = selectSource(row, policy);
    const selectedCandidate = row.candidates[selectedSource] ?? row.candidates.pattern ?? row.candidates.learned;
    return {
      example_id: row.example_id,
      source_split: row.source_split,
      router_split: row.router_split,
      target_answer_type: row.target_answer_type,
      intent: row.intent,
      selected_source: selectedSource,
      selected_candidate: selectedCandidate,
      candidates: row.candidates,
      contract_correct: Boolean(selectedCandidate?.contract_correct),
      answer_type_correct: Boolean(selectedCandidate?.answer_type_correct),
      citation_set_exact: Boolean(selectedCandidate?.citation_set_exact),
    };
  });
}

function selectSource(row, policy) {
  const pattern = row.candidates.pattern;
  const learned = row.candidates.learned;
  if (policy.family === "always_pattern") return "pattern";
  if (policy.family === "always_learned") return "learned";
  if (policy.family === "learned_correctness_selector") {
    const delta = learned.predicted_correctness - pattern.predicted_correctness;
    if (delta >= policy.min_margin) return "learned";
    return policy.fallback ?? "pattern";
  }
  if (policy.family === "prefer_learned_answer" && learned.answer_type === "grounded_answer") return "learned";
  if (policy.family === "prefer_pattern_answer" && pattern.answer_type === "grounded_answer") return "pattern";
  if (policy.family === "prefer_learned_abstention" && learned.answer_type === "abstain") return "learned";
  if (policy.family === "prefer_pattern_abstention" && pattern.answer_type === "abstain") return "pattern";
  if (policy.family === "learned_if_confident") {
    const top = learned.feature.learned_top_probability;
    const margin = learned.feature.learned_margin;
    if (top >= policy.min_learned_probability && margin >= policy.min_learned_margin) return "learned";
  }
  if (policy.family === "pattern_if_high_score" && pattern.feature.pattern_top_score >= policy.min_pattern_score) return "pattern";
  return policy.fallback ?? "pattern";
}

function summarizeRouted(rows) {
  const selectedPattern = count(rows, (row) => row.selected_source === "pattern");
  const selectedLearned = count(rows, (row) => row.selected_source === "learned");
  const contractCorrect = count(rows, (row) => row.contract_correct);
  return {
    examples: rows.length,
    contract_correct: contractCorrect,
    contract_correct_rate: rate(contractCorrect, rows.length),
    answer_type_correct: count(rows, (row) => row.answer_type_correct),
    citation_set_exact: count(rows, (row) => row.citation_set_exact),
    grounded_target_contract_correct: count(rows, (row) => row.target_answer_type === "grounded_answer" && row.contract_correct),
    false_abstentions: count(rows, (row) => row.target_answer_type === "grounded_answer" && row.selected_candidate.answer_type === "abstain"),
    over_answered_abstentions: count(rows, (row) => row.target_answer_type === "abstain" && row.selected_candidate.answer_type === "grounded_answer"),
    selected_pattern: selectedPattern,
    selected_learned: selectedLearned,
  };
}

function summarizeCandidates(rows, source) {
  const projected = rows.map((row) => ({ ...row, selected_source: source, selected_candidate: row.candidates[source], contract_correct: row.candidates[source].contract_correct, answer_type_correct: row.candidates[source].answer_type_correct, citation_set_exact: row.candidates[source].citation_set_exact }));
  return summarizeRouted(projected);
}

function summarizeOracle(rows) {
  const oracleCorrect = count(rows, (row) => row.candidates.pattern.contract_correct || row.candidates.learned.contract_correct);
  return {
    examples: rows.length,
    contract_correct: oracleCorrect,
    contract_correct_rate: rate(oracleCorrect, rows.length),
    both_correct: count(rows, (row) => row.candidates.pattern.contract_correct && row.candidates.learned.contract_correct),
    pattern_only_correct: count(rows, (row) => row.candidates.pattern.contract_correct && !row.candidates.learned.contract_correct),
    learned_only_correct: count(rows, (row) => !row.candidates.pattern.contract_correct && row.candidates.learned.contract_correct),
    neither_correct: count(rows, (row) => !row.candidates.pattern.contract_correct && !row.candidates.learned.contract_correct),
  };
}

function statusFor(selectedPolicy, rows) {
  const pattern = summarizeCandidates(rows, "pattern");
  const learned = summarizeCandidates(rows, "learned");
  const bestSource = Math.max(pattern.contract_correct, learned.contract_correct);
  if (selectedPolicy.fresh_validation.contract_correct > bestSource) return "cheap_router_beats_best_single_source";
  if (summarizeOracle(rows).contract_correct > bestSource) return "cheap_pool_has_unselected_oracle_headroom";
  return "cheap_router_adds_no_fresh_headroom";
}

function decisionFor(selectedPolicy, rows) {
  const pattern = summarizeCandidates(rows, "pattern");
  const learned = summarizeCandidates(rows, "learned");
  const oracle = summarizeOracle(rows);
  const bestSource = Math.max(pattern.contract_correct, learned.contract_correct);
  const router = selectedPolicy.fresh_validation.contract_correct;
  return {
    keep_cheap_router_as_policy: router > bestSource && router / rows.length >= 0.5,
    keep_cheap_router_as_diagnostic: oracle.contract_correct > bestSource,
    buy_openai_labels_now: false,
    rent_prime_gpu_now: false,
    next_step: oracle.contract_correct > bestSource
      ? "Do not use the cheap router as policy. Use this disagreement audit to design a small teacher-label or selector-supervision packet; current train-heldout selection cannot extract the cheap-source oracle headroom."
      : "Stop routing these two cheap candidate sources and move to a targeted teacher-label packet for the remaining construction failures under the budget gate.",
    reason: `Selected router scored ${router}/${rows.length}; best single cheap source scored ${bestSource}/${rows.length}; cheap-source oracle scored ${oracle.contract_correct}/${rows.length}.`,
  };
}

function routerSplit(exampleId, sourceSplit) {
  if (sourceSplit === "validation") return "fresh_validation";
  const trainIndex = prompts.filter((row) => row.source_split === "train").findIndex((row) => row.example_id === exampleId);
  return trainIndex >= 0 && trainIndex < 160 ? "train_tune" : "train_heldout";
}

async function runContractGate(gateRunId, predictionFile) {
  const child = spawn(process.execPath, [
    "scripts/grounded-qa-distillation-evidence-first-contract-preflight.mjs",
    `--packet-run-id=${packetRunId}`,
    `--prediction-file=${predictionFile}`,
    `--run-id=${gateRunId}`,
  ], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const code = await new Promise((resolve) => child.on("close", resolve));
  if (code !== 0) throw new Error(`Contract gate failed (${code}): ${stderr || stdout}`);
  return readJson(path.join(runsDir, gateRunId, "result.json"));
}

function renderReport(result) {
  return `# Fresh Nonfinal Cheap Router Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Selected Policy

- Policy: \`${result.selected_policy.policy_id}\`
- Train-heldout contract: ${result.selected_policy.train_heldout.contract_correct}/${result.selected_policy.train_heldout.examples} (${pct(result.selected_policy.train_heldout.contract_correct_rate)})
- Fresh-validation contract: ${result.metrics.fresh_validation.contract_correct}/${result.metrics.fresh_validation.examples} (${pct(result.metrics.fresh_validation.contract_correct_rate)})
- Fresh selected pattern/learned: ${result.metrics.fresh_validation.selected_pattern}/${result.metrics.fresh_validation.selected_learned}

## Source Comparison

- Pattern: ${result.source_metrics.pattern.contract_correct}/${result.source_metrics.pattern.examples} (${pct(result.source_metrics.pattern.contract_correct_rate)})
- Learned: ${result.source_metrics.learned.contract_correct}/${result.source_metrics.learned.examples} (${pct(result.source_metrics.learned.contract_correct_rate)})
- Cheap-source oracle: ${result.source_metrics.oracle_any_cheap_source.contract_correct}/${result.source_metrics.oracle_any_cheap_source.examples} (${pct(result.source_metrics.oracle_any_cheap_source.contract_correct_rate)})
- Learned-only correct: ${result.source_metrics.oracle_any_cheap_source.learned_only_correct}
- Pattern-only correct: ${result.source_metrics.oracle_any_cheap_source.pattern_only_correct}

## Decision

- Keep cheap router as policy: ${result.decision.keep_cheap_router_as_policy ? "yes" : "no"}
- Keep as diagnostic: ${result.decision.keep_cheap_router_as_diagnostic ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function normalizePrediction(value) {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (!["grounded_answer", "abstain"].includes(parsed.answer_type)) return parsed;
  return parsed;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean);
}

function intentFor(exampleId) {
  const parts = exampleId.split(":");
  if (exampleId.includes("counterfactual-insufficient")) return `counterfactual_${parts[3] ?? "unknown"}`;
  return parts[2] ?? "unknown";
}

function policyId(policy) {
  return Object.entries(policy)
    .filter(([key]) => key !== "policy_id")
    .map(([key, value]) => `${key}-${String(value).replaceAll(".", "p").replaceAll("-", "m")}`)
    .join("__");
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function makeScaler(rows) {
  const width = rows[0]?.length ?? 0;
  const means = Array(width).fill(0);
  const scales = Array(width).fill(1);
  for (let col = 0; col < width; col += 1) {
    means[col] = rows.reduce((sum, row) => sum + Number(row[col] ?? 0), 0) / Math.max(rows.length, 1);
    const variance = rows.reduce((sum, row) => sum + (Number(row[col] ?? 0) - means[col]) ** 2, 0) / Math.max(rows.length, 1);
    scales[col] = Math.sqrt(variance) || 1;
  }
  means[0] = 0;
  scales[0] = 1;
  return { means, scales };
}

function trainLogistic(rows, scaler, options) {
  const width = rows[0]?.feature_values?.length ?? 0;
  const weights = Array(width).fill(0);
  let intercept = 0;
  for (let epoch = 0; epoch < options.epochs; epoch += 1) {
    const grad = Array(width).fill(0);
    let interceptGrad = 0;
    for (const row of rows) {
      const features = scale(row.feature_values, scaler);
      const pred = sigmoid(dot(weights, features) + intercept);
      const error = pred - row.label_correct;
      interceptGrad += error;
      for (let index = 0; index < width; index += 1) {
        grad[index] += error * features[index] + options.l2 * weights[index];
      }
    }
    const step = options.learningRate / Math.max(rows.length, 1);
    intercept -= step * interceptGrad;
    for (let index = 0; index < width; index += 1) weights[index] -= step * grad[index];
  }
  return { weights, intercept };
}

function predictProb(model, scaler, values) {
  return sigmoid(dot(model.weights, scale(values, scaler)) + model.intercept);
}

function scale(values, scaler) {
  return values.map((value, index) => (Number(value ?? 0) - scaler.means[index]) / scaler.scales[index]);
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value))));
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
