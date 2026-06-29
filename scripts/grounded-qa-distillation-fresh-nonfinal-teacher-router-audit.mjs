import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "fresh-nonfinal-teacher-router-audit-v1";
const packetRunId = args["packet-run-id"] ?? "frontier-full-nonfinal-packet-2026-06-29-v1";
const cheapRunId = args["cheap-run-id"] ?? "fresh-nonfinal-cheap-router-audit-v1";
const teacherGateRunId = args["teacher-gate-run-id"] ?? "openai-evidence-first-frontier-gpt54-full-nonfinal-2026-06-29-v1-contract-gate";
const outputDir = path.join(runsDir, runId);
const sources = ["pattern", "learned", "teacher"];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const cheapRows = await readJsonl(path.join(runsDir, cheapRunId, "candidate_rows.jsonl"));
const teacherScoredRows = await readJsonl(path.join(runsDir, teacherGateRunId, "scored_predictions.jsonl"));
const teacherById = new Map(teacherScoredRows.map((row) => [row.example_id, row]));

const candidateRows = cheapRows.map((row) => {
  const teacher = scoreTeacherCandidate(teacherById.get(row.example_id));
  return {
    ...row,
    candidates: {
      pattern: row.candidates.pattern,
      learned: row.candidates.learned,
      teacher,
    },
  };
});

const trainTuneRows = candidateRows.filter((row) => row.router_split === "train_tune");
const trainHeldoutRows = candidateRows.filter((row) => row.router_split === "train_heldout");
const validationRows = candidateRows.filter((row) => row.router_split === "fresh_validation");

const trainingRows = correctnessRowsFor(trainTuneRows);
const scaler = makeScaler(trainingRows.map((row) => row.feature_values));
const model = trainLogistic(trainingRows, scaler, { epochs: 1200, learningRate: 0.06, l2: 0.04 });
attachCorrectnessScores(candidateRows);

const policyRows = enumeratePolicies().map((policy) => evaluatePolicy(policy));
const selectedPolicy = [...policyRows].sort((left, right) =>
  right.train_heldout.contract_correct - left.train_heldout.contract_correct
  || right.train_heldout.grounded_target_contract_correct - left.train_heldout.grounded_target_contract_correct
  || left.train_heldout.over_answered_abstentions - right.train_heldout.over_answered_abstentions
  || left.policy_id.localeCompare(right.policy_id)
)[0];

const allRoutedRows = routeRows(candidateRows, selectedPolicy.policy);
const validationRoutedRows = allRoutedRows.filter((row) => row.router_split === "fresh_validation");
const supervisionRows = buildSupervisionRows(candidateRows);
const predictionsPath = path.join(outputDir, "routed_predictions_for_gate.jsonl");
await writeJsonl(predictionsPath, allRoutedRows.map((row) => ({
  example_id: row.example_id,
  prediction: row.selected_candidate.prediction,
  raw_output: JSON.stringify(row.selected_candidate.prediction),
  metadata: {
    scaffold: "fresh_nonfinal_teacher_router",
    selected_source: row.selected_source,
    selected_policy: selectedPolicy.policy,
    no_new_llm_calls: true,
  },
})));
const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);

const sourceMetrics = Object.fromEntries(sources.map((source) => [source, summarizeCandidates(validationRows, source)]));
sourceMetrics.oracle_any_source = summarizeOracle(validationRows, sources);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "fresh_nonfinal_teacher_router_audit",
  status: statusFor(selectedPolicy, sourceMetrics),
  purpose: "Test whether existing paid OpenAI teacher outputs can be reused as a candidate source and selected with local train-only supervision on fresh nonfinal grounded QA.",
  source_runs: {
    packet: packetRunId,
    cheap_router: cheapRunId,
    teacher_contract_gate: teacherGateRunId,
    contract_gate: gateRunId,
  },
  leakage_note: "Correctness model is trained only on train_tune candidates. Policy selection uses train_heldout rows. Fresh validation rows are used only for final reporting.",
  training: {
    correctness_training_candidate_rows: trainingRows.length,
    positive_correctness_rows: count(trainingRows, (row) => row.label_correct),
    feature_names: featureNames(),
    model: {
      weights: model.weights,
      intercept: model.intercept,
      feature_means: scaler.means,
      feature_scales: scaler.scales,
    },
  },
  selected_policy: selectedPolicy,
  source_metrics: sourceMetrics,
  supervision_packet: summarizeSupervision(supervisionRows),
  metrics: {
    train_tune: selectedPolicy.train_tune,
    train_heldout: selectedPolicy.train_heldout,
    fresh_validation: selectedPolicy.fresh_validation,
    contract_gate: gate.metrics,
  },
  decision: decisionFor(selectedPolicy, sourceMetrics),
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
    note: "This audit reuses already-paid OpenAI teacher predictions and runs local scoring only.",
  },
  artifacts: {
    candidate_rows_jsonl: rel(path.join(outputDir, "candidate_rows.jsonl")),
    selector_supervision_rows_jsonl: rel(path.join(outputDir, "selector_supervision_rows.jsonl")),
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    fresh_validation_routed_rows_jsonl: rel(path.join(outputDir, "fresh_validation_routed_rows.jsonl")),
    routed_predictions_jsonl: rel(predictionsPath),
    contract_gate_result_json: rel(path.join(runsDir, gateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "candidate_rows.jsonl"), candidateRows);
await writeJsonl(path.join(outputDir, "selector_supervision_rows.jsonl"), supervisionRows);
await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), policyRows);
await writeJsonl(path.join(outputDir, "fresh_validation_routed_rows.jsonl"), validationRoutedRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_policy: result.selected_policy,
  source_metrics: result.source_metrics,
  supervision_packet: result.supervision_packet,
  metrics: result.metrics,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function scoreTeacherCandidate(row) {
  const prediction = row?.prediction ?? null;
  return {
    source: "teacher",
    exists: Boolean(row),
    prediction,
    answer_type: prediction?.answer_type ?? null,
    citations: normalizeCitations(prediction?.citations),
    contract_correct: Boolean(row?.contract_correct),
    answer_type_correct: Boolean(row?.answer_type_correct),
    citation_set_exact: Boolean(row?.citation_set_exact),
    parseable: Boolean(row?.parseable),
    evidence_first_valid: Boolean(row?.evidence_first_valid),
  };
}

function correctnessRowsFor(rows) {
  return rows.flatMap((row) => sources.map((source) => ({
    example_id: row.example_id,
    source,
    label_correct: row.candidates[source].contract_correct ? 1 : 0,
    feature_values: features(row, source),
  })));
}

function attachCorrectnessScores(rows) {
  for (const row of rows) {
    for (const source of sources) {
      row.candidates[source].predicted_correctness = predictProb(model, scaler, features(row, source));
    }
  }
}

function featureNames() {
  return [
    "bias", "source_pattern", "source_learned", "source_teacher",
    "candidate_grounded", "candidate_abstain", "candidate_citation_count",
    "teacher_parseable", "teacher_evidence_first_valid",
    "pattern_teacher_answer_agree", "learned_teacher_answer_agree", "pattern_learned_answer_agree",
    "pattern_teacher_citations_agree", "learned_teacher_citations_agree", "pattern_learned_citations_agree",
    "candidate_answer_majority", "candidate_citations_majority",
    "counterfactual_prompt", "intent_numeric_metric", "intent_dataset", "intent_method_model",
    "pattern_top_score", "learned_top_probability", "learned_margin",
  ];
}

function features(row, source) {
  const candidate = row.candidates[source];
  const pattern = row.candidates.pattern;
  const learned = row.candidates.learned;
  const teacher = row.candidates.teacher;
  const citations = new Set(candidate.citations ?? []);
  const citationKey = key(candidate.citations);
  const citationCounts = countBy(sources.map((name) => key(row.candidates[name].citations)));
  const answerCounts = countBy(sources.map((name) => row.candidates[name].answer_type ?? "missing"));
  const intent = row.intent ?? "";
  return [
    1,
    source === "pattern" ? 1 : 0,
    source === "learned" ? 1 : 0,
    source === "teacher" ? 1 : 0,
    candidate.answer_type === "grounded_answer" ? 1 : 0,
    candidate.answer_type === "abstain" ? 1 : 0,
    citations.size,
    teacher.parseable ? 1 : 0,
    teacher.evidence_first_valid ? 1 : 0,
    pattern.answer_type === teacher.answer_type ? 1 : 0,
    learned.answer_type === teacher.answer_type ? 1 : 0,
    pattern.answer_type === learned.answer_type ? 1 : 0,
    key(pattern.citations) === key(teacher.citations) ? 1 : 0,
    key(learned.citations) === key(teacher.citations) ? 1 : 0,
    key(pattern.citations) === key(learned.citations) ? 1 : 0,
    Number(answerCounts[candidate.answer_type ?? "missing"] ?? 0),
    Number(citationCounts[citationKey] ?? 0),
    intent.includes("counterfactual") ? 1 : 0,
    intent.includes("numeric") || intent.includes("metric") || intent.includes("optimization") ? 1 : 0,
    intent.includes("dataset") ? 1 : 0,
    intent.includes("method") || intent.includes("model") || intent.includes("architecture") ? 1 : 0,
    Number(pattern.feature?.pattern_top_score ?? 0),
    Number(learned.feature?.learned_top_probability ?? 0),
    Number(learned.feature?.learned_margin ?? 0),
  ];
}

function enumeratePolicies() {
  const policies = sources.map((source) => ({ family: "always_source", source }));
  for (const minMargin of [-0.25, -0.12, -0.04, 0, 0.04, 0.08, 0.16]) {
    policies.push({ family: "max_predicted_correctness", min_margin: minMargin, fallback: "teacher" });
    policies.push({ family: "max_predicted_correctness", min_margin: minMargin, fallback: "learned" });
  }
  for (const order of [
    ["teacher", "learned", "pattern"],
    ["learned", "teacher", "pattern"],
    ["teacher", "pattern", "learned"],
    ["pattern", "teacher", "learned"],
  ]) {
    policies.push({ family: "answer_first_order", order });
    policies.push({ family: "abstain_first_order", order });
  }
  return policies.map((policy) => ({ ...policy, policy_id: policyId(policy) }));
}

function evaluatePolicy(policy) {
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
    const selectedCandidate = row.candidates[selectedSource];
    return {
      example_id: row.example_id,
      source_split: row.source_split,
      router_split: row.router_split,
      target_answer_type: row.target_answer_type,
      intent: row.intent,
      selected_source: selectedSource,
      selected_candidate: selectedCandidate,
      candidates: row.candidates,
      contract_correct: Boolean(selectedCandidate.contract_correct),
      answer_type_correct: Boolean(selectedCandidate.answer_type_correct),
      citation_set_exact: Boolean(selectedCandidate.citation_set_exact),
    };
  });
}

function selectSource(row, policy) {
  if (policy.family === "always_source") return policy.source;
  if (policy.family === "max_predicted_correctness") {
    const ranked = [...sources].sort((a, b) => row.candidates[b].predicted_correctness - row.candidates[a].predicted_correctness || a.localeCompare(b));
    const best = ranked[0];
    const fallback = policy.fallback ?? ranked[1];
    if (row.candidates[best].predicted_correctness - row.candidates[fallback].predicted_correctness >= policy.min_margin) return best;
    return fallback;
  }
  if (policy.family === "answer_first_order") {
    const answered = policy.order.find((source) => row.candidates[source].answer_type === "grounded_answer");
    return answered ?? policy.order[0];
  }
  if (policy.family === "abstain_first_order") {
    const abstain = policy.order.find((source) => row.candidates[source].answer_type === "abstain");
    return abstain ?? policy.order[0];
  }
  return "teacher";
}

function summarizeRouted(rows) {
  const out = {
    examples: rows.length,
    contract_correct: count(rows, (row) => row.contract_correct),
    answer_type_correct: count(rows, (row) => row.answer_type_correct),
    citation_set_exact: count(rows, (row) => row.citation_set_exact),
    grounded_target_contract_correct: count(rows, (row) => row.target_answer_type === "grounded_answer" && row.contract_correct),
    false_abstentions: count(rows, (row) => row.target_answer_type === "grounded_answer" && row.selected_candidate.answer_type === "abstain"),
    over_answered_abstentions: count(rows, (row) => row.target_answer_type === "abstain" && row.selected_candidate.answer_type === "grounded_answer"),
  };
  out.contract_correct_rate = rate(out.contract_correct, out.examples);
  for (const source of sources) out[`selected_${source}`] = count(rows, (row) => row.selected_source === source);
  return out;
}

function summarizeCandidates(rows, source) {
  return summarizeRouted(rows.map((row) => ({
    ...row,
    selected_source: source,
    selected_candidate: row.candidates[source],
    contract_correct: row.candidates[source].contract_correct,
    answer_type_correct: row.candidates[source].answer_type_correct,
    citation_set_exact: row.candidates[source].citation_set_exact,
  })));
}

function summarizeOracle(rows, sourceList) {
  const correct = count(rows, (row) => sourceList.some((source) => row.candidates[source].contract_correct));
  return {
    examples: rows.length,
    contract_correct: correct,
    contract_correct_rate: rate(correct, rows.length),
    all_correct: count(rows, (row) => sourceList.every((source) => row.candidates[source].contract_correct)),
    none_correct: count(rows, (row) => sourceList.every((source) => !row.candidates[source].contract_correct)),
  };
}

function buildSupervisionRows(rows) {
  return rows.map((row) => {
    const correctness = Object.fromEntries(sources.map((source) => [source, Boolean(row.candidates[source].contract_correct)]));
    const answerTypes = Object.fromEntries(sources.map((source) => [source, row.candidates[source].answer_type]));
    const citationSets = Object.fromEntries(sources.map((source) => [source, row.candidates[source].citations]));
    const correctSources = sources.filter((source) => correctness[source]);
    const teacherWrongCheapRight = !correctness.teacher && (correctness.pattern || correctness.learned);
    const teacherRightCheapWrong = correctness.teacher && !correctness.pattern && !correctness.learned;
    return {
      example_id: row.example_id,
      source_split: row.source_split,
      router_split: row.router_split,
      target_answer_type: row.target_answer_type,
      intent: row.intent,
      target_citations: row.target_citations,
      training_role: row.source_split === "train" ? "selector_supervision_train_candidate" : "fresh_validation_reporting_only",
      disagreement_category: disagreementCategory(row, correctness),
      oracle_has_correct_source: correctSources.length > 0,
      correct_sources: correctSources,
      teacher_wrong_cheap_right: teacherWrongCheapRight,
      teacher_right_cheap_wrong: teacherRightCheapWrong,
      answer_types: answerTypes,
      citation_sets: citationSets,
      predicted_correctness: Object.fromEntries(sources.map((source) => [source, row.candidates[source].predicted_correctness])),
    };
  });
}

function disagreementCategory(row, correctness) {
  const answerTypeSet = new Set(sources.map((source) => row.candidates[source].answer_type ?? "missing"));
  const citationSet = new Set(sources.map((source) => key(row.candidates[source].citations)));
  if (sources.every((source) => correctness[source])) return "all_sources_correct";
  if (sources.every((source) => !correctness[source])) return "no_source_correct";
  if (!correctness.teacher && (correctness.pattern || correctness.learned)) return "teacher_wrong_cheap_source_correct";
  if (correctness.teacher && !correctness.pattern && !correctness.learned) return "teacher_only_correct";
  if (answerTypeSet.size > 1) return "answer_type_disagreement";
  if (citationSet.size > 1) return "citation_set_disagreement";
  return "mixed_correctness_same_surface";
}

function summarizeSupervision(rows) {
  const trainRows = rows.filter((row) => row.source_split === "train");
  const validationRowsOnly = rows.filter((row) => row.source_split === "validation");
  return {
    examples: rows.length,
    train_examples: trainRows.length,
    fresh_validation_reporting_examples: validationRowsOnly.length,
    oracle_has_correct_source: count(rows, (row) => row.oracle_has_correct_source),
    train_oracle_has_correct_source: count(trainRows, (row) => row.oracle_has_correct_source),
    fresh_validation_oracle_has_correct_source: count(validationRowsOnly, (row) => row.oracle_has_correct_source),
    teacher_wrong_cheap_right_train: count(trainRows, (row) => row.teacher_wrong_cheap_right),
    teacher_wrong_cheap_right_fresh_validation: count(validationRowsOnly, (row) => row.teacher_wrong_cheap_right),
    category_counts: countBy(rows.map((row) => row.disagreement_category)),
    train_category_counts: countBy(trainRows.map((row) => row.disagreement_category)),
    fresh_validation_category_counts: countBy(validationRowsOnly.map((row) => row.disagreement_category)),
  };
}

function statusFor(selected, sourceMetrics) {
  const bestSingle = Math.max(...sources.map((source) => sourceMetrics[source].contract_correct));
  if (selected.fresh_validation.contract_correct > bestSingle) return "teacher_router_beats_best_single_source";
  if (sourceMetrics.oracle_any_source.contract_correct > bestSingle) return "teacher_pool_has_unselected_oracle_headroom";
  return "teacher_router_adds_no_headroom";
}

function decisionFor(selected, sourceMetrics) {
  const bestSingle = Math.max(...sources.map((source) => sourceMetrics[source].contract_correct));
  const selectedFresh = selected.fresh_validation.contract_correct;
  return {
    promote_teacher_router_as_policy: selectedFresh > bestSingle && selected.fresh_validation.contract_correct_rate >= 0.6,
    keep_teacher_as_candidate_source: sourceMetrics.teacher.contract_correct >= bestSingle,
    buy_new_openai_labels_now: false,
    rent_prime_gpu_now: false,
    reason: `Selected router scored ${selectedFresh}/75; best single source scored ${bestSingle}/75; three-source oracle scored ${sourceMetrics.oracle_any_source.contract_correct}/75.`,
    next_step: selectedFresh > bestSingle
      ? "Use the selected teacher router as the next distillation target generator and evaluate cost/quality against direct teacher inference."
      : "Mine the three-source oracle failures and teacher disagreements into a targeted supervision packet before any new paid calls.",
  };
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
  return `# Fresh Nonfinal Teacher Router Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Selected Policy

- Policy: \`${result.selected_policy.policy_id}\`
- Train-heldout contract: ${result.metrics.train_heldout.contract_correct}/${result.metrics.train_heldout.examples} (${pct(result.metrics.train_heldout.contract_correct_rate)})
- Fresh-validation contract: ${result.metrics.fresh_validation.contract_correct}/${result.metrics.fresh_validation.examples} (${pct(result.metrics.fresh_validation.contract_correct_rate)})
- Fresh selected pattern/learned/teacher: ${result.metrics.fresh_validation.selected_pattern}/${result.metrics.fresh_validation.selected_learned}/${result.metrics.fresh_validation.selected_teacher}

## Source Comparison

- Pattern: ${result.source_metrics.pattern.contract_correct}/75 (${pct(result.source_metrics.pattern.contract_correct_rate)})
- Learned: ${result.source_metrics.learned.contract_correct}/75 (${pct(result.source_metrics.learned.contract_correct_rate)})
- Teacher: ${result.source_metrics.teacher.contract_correct}/75 (${pct(result.source_metrics.teacher.contract_correct_rate)})
- Three-source oracle: ${result.source_metrics.oracle_any_source.contract_correct}/75 (${pct(result.source_metrics.oracle_any_source.contract_correct_rate)})

## Selector Supervision Packet

- Rows: ${result.supervision_packet.examples}
- Train rows: ${result.supervision_packet.train_examples}
- Fresh-validation reporting rows: ${result.supervision_packet.fresh_validation_reporting_examples}
- Train rows with any correct source: ${result.supervision_packet.train_oracle_has_correct_source}
- Fresh-validation rows with any correct source: ${result.supervision_packet.fresh_validation_oracle_has_correct_source}
- Teacher-wrong/cheap-right train rows: ${result.supervision_packet.teacher_wrong_cheap_right_train}
- Teacher-wrong/cheap-right fresh-validation rows: ${result.supervision_packet.teacher_wrong_cheap_right_fresh_validation}

## Decision

- Promote teacher router as policy: ${result.decision.promote_teacher_router_as_policy ? "yes" : "no"}
- Keep teacher as candidate source: ${result.decision.keep_teacher_as_candidate_source ? "yes" : "no"}
- Buy new OpenAI labels now: ${result.decision.buy_new_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
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
      for (let index = 0; index < width; index += 1) grad[index] += error * features[index] + options.l2 * weights[index];
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

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean);
}

function key(values) {
  return normalizeCitations(values).sort().join("|");
}

function countBy(values) {
  const out = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
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

function policyId(policy) {
  return Object.entries(policy).map(([keyName, value]) => `${keyName}-${Array.isArray(value) ? value.join("-") : String(value).replaceAll(".", "p").replaceAll("-", "m")}`).join("__");
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
  for (const value of argv) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
