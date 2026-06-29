import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "nonreview-selector-audit-2026-06-29-v1";
const packetRunId = args["packet-run-id"] ?? "frontier-full-nonfinal-packet-2026-06-29-v1";
const fourSourceRunId = args["four-source-run-id"] ?? "four-source-router-audit-2026-06-29-v1";
const calibratedRunId = args["calibrated-run-id"] ?? "calibrated-target-packet-eval-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const sources = ["pattern", "learned", "teacher", "structured_group"];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const candidateRows = await readJsonl(path.join(runsDir, fourSourceRunId, "candidate_rows.jsonl"));
const calibratedTargets = await readJsonl(path.join(runsDir, calibratedRunId, "calibrated_targets.jsonl"));
const calibratedById = new Map(calibratedTargets.map((row) => [row.example_id, row]));
for (const row of candidateRows) row.calibrated_target = calibratedById.get(row.example_id) ?? { review_deferred: false, acceptable_target_support_citations: row.target_citations };

const trainTuneRows = candidateRows.filter((row) => row.router_split === "train_tune" && !row.calibrated_target.review_deferred);
const trainHeldoutRows = candidateRows.filter((row) => row.router_split === "train_heldout" && !row.calibrated_target.review_deferred);
const freshRows = candidateRows.filter((row) => row.router_split === "fresh_validation");
const freshNonreviewRows = freshRows.filter((row) => !row.calibrated_target.review_deferred);

const trainingRows = pointwiseRows(trainTuneRows);
const scaler = makeScaler(trainingRows.map((row) => row.feature_values));
const model = trainLogistic(trainingRows, scaler, { epochs: 900, learningRate: 0.07, l2: 0.02 });
attachScores(candidateRows);

const policies = enumeratePolicies().map(evaluatePolicy);
const selected = [...policies].sort((left, right) =>
  right.train_heldout_nonreview.contract_correct - left.train_heldout_nonreview.contract_correct
  || right.train_heldout_nonreview.grounded_target_contract_correct - left.train_heldout_nonreview.grounded_target_contract_correct
  || left.train_heldout_nonreview.over_answered_abstentions - right.train_heldout_nonreview.over_answered_abstentions
  || left.policy_id.localeCompare(right.policy_id)
)[0];

const routedRows = routeRows(candidateRows, selected.policy);
const predictionsPath = path.join(outputDir, "routed_predictions_for_gate.jsonl");
await writeJsonl(predictionsPath, routedRows.map((row) => ({
  example_id: row.example_id,
  prediction: row.selected_candidate.prediction,
  raw_output: JSON.stringify(row.selected_candidate.prediction),
  metadata: {
    scaffold: "nonreview_selector",
    selected_source: row.selected_source,
    selected_policy: selected.policy,
    review_deferred: row.review_deferred,
  },
})));
const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);

const sourceMetrics = Object.fromEntries(sources.map((source) => [source, summarizeCandidates(freshNonreviewRows, source)]));
sourceMetrics.oracle_any_source = summarizeOracle(freshNonreviewRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "nonreview_selector_audit",
  status: statusFor(selected, sourceMetrics),
  purpose: "Test whether excluding calibrated review-deferred rows exposes a leakage-safe selector that beats the structured-group source on the cleaner fresh-validation slice.",
  source_runs: {
    packet: packetRunId,
    four_source_router: fourSourceRunId,
    calibrated_eval: calibratedRunId,
    contract_gate: gateRunId,
  },
  leakage_note: "Model training uses train_tune rows. Policy selection uses train_heldout rows. Fresh validation remains reporting-only; review-deferred rows are excluded only from the non-review selector metric.",
  training: {
    train_tune_nonreview_examples: trainTuneRows.length,
    train_heldout_nonreview_examples: trainHeldoutRows.length,
    fresh_validation_examples: freshRows.length,
    fresh_validation_nonreview_examples: freshNonreviewRows.length,
    pointwise_training_rows: trainingRows.length,
    feature_names: featureNames(),
    model: {
      weights: model.weights,
      intercept: model.intercept,
      feature_means: scaler.means,
      feature_scales: scaler.scales,
    },
  },
  selected_policy: selected,
  source_metrics: sourceMetrics,
  metrics: {
    train_tune_nonreview: selected.train_tune_nonreview,
    train_heldout_nonreview: selected.train_heldout_nonreview,
    fresh_validation_all: selected.fresh_validation_all,
    fresh_validation_nonreview: selected.fresh_validation_nonreview,
    contract_gate: gate.metrics,
  },
  decision: decisionFor(selected, sourceMetrics),
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
    note: "This audit trains a local selector over existing prediction artifacts only.",
  },
  artifacts: {
    training_rows_jsonl: rel(path.join(outputDir, "training_rows.jsonl")),
    scored_candidate_rows_jsonl: rel(path.join(outputDir, "scored_candidate_rows.jsonl")),
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    fresh_nonreview_routed_rows_jsonl: rel(path.join(outputDir, "fresh_nonreview_routed_rows.jsonl")),
    routed_predictions_jsonl: rel(predictionsPath),
    contract_gate_result_json: rel(path.join(runsDir, gateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "training_rows.jsonl"), trainingRows);
await writeJsonl(path.join(outputDir, "scored_candidate_rows.jsonl"), candidateRows);
await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), policies);
await writeJsonl(path.join(outputDir, "fresh_nonreview_routed_rows.jsonl"), routedRows.filter((row) => row.router_split === "fresh_validation" && !row.review_deferred));
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

function pointwiseRows(rows) {
  const out = [];
  for (const row of rows) {
    for (const source of sources) {
      out.push({
        example_id: row.example_id,
        source,
        label: row.candidates[source].contract_correct ? 1 : 0,
        feature_values: features(row, source),
      });
    }
  }
  return out;
}

function featureNames() {
  return [
    "source_pattern", "source_learned", "source_teacher", "source_structured_group",
    "candidate_grounded", "candidate_abstain", "candidate_citation_count",
    "answer_majority", "citation_majority", "agrees_teacher_answer", "agrees_teacher_citations",
    "agrees_group_answer", "agrees_group_citations", "parseable", "evidence_first_valid",
    "counterfactual_prompt", "target_grounded", "target_abstain",
    "pattern_top_score", "learned_top_probability", "learned_margin",
  ];
}

function features(row, source) {
  const candidate = row.candidates[source];
  const teacher = row.candidates.teacher;
  const group = row.candidates.structured_group;
  const citationCounts = countBy(sources.map((name) => key(row.candidates[name].citations)));
  const answerCounts = countBy(sources.map((name) => row.candidates[name].answer_type ?? "missing"));
  const candidateCitations = normalizeCitations(candidate.citations);
  return [
    source === "pattern" ? 1 : 0,
    source === "learned" ? 1 : 0,
    source === "teacher" ? 1 : 0,
    source === "structured_group" ? 1 : 0,
    candidate.answer_type === "grounded_answer" ? 1 : 0,
    candidate.answer_type === "abstain" ? 1 : 0,
    candidateCitations.length,
    Number(answerCounts[candidate.answer_type ?? "missing"] ?? 0),
    Number(citationCounts[key(candidate.citations)] ?? 0),
    candidate.answer_type === teacher.answer_type ? 1 : 0,
    key(candidate.citations) === key(teacher.citations) ? 1 : 0,
    candidate.answer_type === group.answer_type ? 1 : 0,
    key(candidate.citations) === key(group.citations) ? 1 : 0,
    candidate.parseable === false ? 0 : 1,
    candidate.evidence_first_valid === false ? 0 : 1,
    row.intent?.includes("counterfactual") ? 1 : 0,
    row.target_answer_type === "grounded_answer" ? 1 : 0,
    row.target_answer_type === "abstain" ? 1 : 0,
    Number(row.candidates.pattern.feature?.pattern_top_score ?? 0),
    Number(row.candidates.learned.feature?.learned_top_probability ?? 0),
    Number(row.candidates.learned.feature?.learned_margin ?? 0),
  ];
}

function attachScores(rows) {
  for (const row of rows) {
    for (const source of sources) {
      row.candidates[source].nonreview_selector_score = score(features(row, source));
    }
  }
}

function enumeratePolicies() {
  const policies = sources.map((source) => ({ family: "always_source", source }));
  policies.push({ family: "max_existing_predicted_correctness" });
  policies.push({ family: "max_nonreview_selector_score" });
  for (const fallback of ["structured_group", "teacher", "learned"]) {
    for (const margin of [-0.25, -0.1, 0, 0.1, 0.25]) {
      policies.push({ family: "selector_score_with_fallback_margin", fallback, margin });
    }
  }
  return policies.map((policy) => ({ ...policy, policy_id: policyId(policy) }));
}

function evaluatePolicy(policy) {
  return {
    policy_id: policy.policy_id,
    policy,
    train_tune_nonreview: summarizeRouted(routeRows(trainTuneRows, policy)),
    train_heldout_nonreview: summarizeRouted(routeRows(trainHeldoutRows, policy)),
    fresh_validation_all: summarizeRouted(routeRows(freshRows, policy)),
    fresh_validation_nonreview: summarizeRouted(routeRows(freshNonreviewRows, policy)),
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
      review_deferred: Boolean(row.calibrated_target.review_deferred),
      target_answer_type: row.target_answer_type,
      selected_source: selectedSource,
      selected_candidate: selectedCandidate,
      contract_correct: Boolean(selectedCandidate.contract_correct),
      answer_type_correct: Boolean(selectedCandidate.answer_type_correct),
      citation_set_exact: Boolean(selectedCandidate.citation_set_exact),
    };
  });
}

function selectSource(row, policy) {
  if (policy.family === "always_source") return policy.source;
  if (policy.family === "max_existing_predicted_correctness") {
    return [...sources].sort((a, b) => row.candidates[b].predicted_correctness - row.candidates[a].predicted_correctness || a.localeCompare(b))[0];
  }
  const ranked = [...sources].sort((a, b) => row.candidates[b].nonreview_selector_score - row.candidates[a].nonreview_selector_score || a.localeCompare(b));
  if (policy.family === "max_nonreview_selector_score") return ranked[0];
  if (policy.family === "selector_score_with_fallback_margin") {
    const best = ranked[0];
    const fallback = policy.fallback;
    if (best !== fallback && row.candidates[best].nonreview_selector_score - row.candidates[fallback].nonreview_selector_score < policy.margin) return fallback;
    return best;
  }
  throw new Error(`Unknown policy ${policy.family}`);
}

function summarizeRouted(rows) {
  const contract = count(rows, (row) => row.contract_correct);
  const out = {
    examples: rows.length,
    contract_correct: contract,
    contract_correct_rate: rate(contract, rows.length),
    answer_type_correct: count(rows, (row) => row.answer_type_correct),
    citation_set_exact: count(rows, (row) => row.citation_set_exact),
    grounded_target_contract_correct: count(rows, (row) => row.target_answer_type === "grounded_answer" && row.contract_correct),
    false_abstentions: count(rows, (row) => row.target_answer_type === "grounded_answer" && row.selected_candidate.answer_type === "abstain"),
    over_answered_abstentions: count(rows, (row) => row.target_answer_type === "abstain" && row.selected_candidate.answer_type === "grounded_answer"),
  };
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

function summarizeOracle(rows) {
  const correct = count(rows, (row) => sources.some((source) => row.candidates[source].contract_correct));
  return {
    examples: rows.length,
    contract_correct: correct,
    contract_correct_rate: rate(correct, rows.length),
    none_correct: count(rows, (row) => sources.every((source) => !row.candidates[source].contract_correct)),
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

function statusFor(selected, sourceMetrics) {
  const bestSingle = Math.max(...sources.map((source) => sourceMetrics[source].contract_correct));
  if (selected.fresh_validation_nonreview.contract_correct > bestSingle) return "nonreview_selector_beats_best_single_source";
  if (sourceMetrics.oracle_any_source.contract_correct > bestSingle) return "nonreview_oracle_headroom_not_selected";
  return "nonreview_selector_no_remaining_headroom";
}

function decisionFor(selected, sourceMetrics) {
  const bestSingle = Math.max(...sources.map((source) => sourceMetrics[source].contract_correct));
  return {
    promote_nonreview_selector: selected.fresh_validation_nonreview.contract_correct > bestSingle,
    buy_more_openai_labels_now: false,
    rent_prime_gpu_now: false,
    reason: `Selected policy scored ${selected.fresh_validation_nonreview.contract_correct}/${selected.fresh_validation_nonreview.examples} on non-review fresh rows; best single source scored ${bestSingle}/${selected.fresh_validation_nonreview.examples}; oracle scored ${sourceMetrics.oracle_any_source.contract_correct}/${selected.fresh_validation_nonreview.examples}.`,
    next_step: selected.fresh_validation_nonreview.contract_correct > bestSingle
      ? "Use the non-review selector as the next scaffold candidate."
      : "Stop selector-only variants on this pool and focus on constructing easier-to-select candidates or a new non-review training packet.",
  };
}

function renderReport(result) {
  return `# Non-Review Selector Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit excludes calibrated review-deferred rows from selector selection/evaluation and checks whether a local selector can beat the structured-group source on the cleaner fresh-validation slice.

## Selected Policy

- Policy: \`${result.selected_policy.policy_id}\`
- Train-heldout non-review: ${result.metrics.train_heldout_nonreview.contract_correct}/${result.metrics.train_heldout_nonreview.examples} (${pct(result.metrics.train_heldout_nonreview.contract_correct_rate)})
- Fresh non-review: ${result.metrics.fresh_validation_nonreview.contract_correct}/${result.metrics.fresh_validation_nonreview.examples} (${pct(result.metrics.fresh_validation_nonreview.contract_correct_rate)})
- Fresh all: ${result.metrics.fresh_validation_all.contract_correct}/${result.metrics.fresh_validation_all.examples} (${pct(result.metrics.fresh_validation_all.contract_correct_rate)})

## Source Comparison On Fresh Non-Review

- Pattern: ${result.source_metrics.pattern.contract_correct}/${result.source_metrics.pattern.examples}
- Learned: ${result.source_metrics.learned.contract_correct}/${result.source_metrics.learned.examples}
- Teacher: ${result.source_metrics.teacher.contract_correct}/${result.source_metrics.teacher.examples}
- Structured group: ${result.source_metrics.structured_group.contract_correct}/${result.source_metrics.structured_group.examples}
- Oracle: ${result.source_metrics.oracle_any_source.contract_correct}/${result.source_metrics.oracle_any_source.examples}

## Decision

- Promote non-review selector: ${result.decision.promote_nonreview_selector ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function trainLogistic(rows, scalerValue, options) {
  const width = rows[0]?.feature_values?.length ?? 0;
  const weights = Array(width).fill(0);
  let intercept = 0;
  for (let epoch = 0; epoch < options.epochs; epoch += 1) {
    const grad = Array(width).fill(0);
    let interceptGrad = 0;
    for (const row of rows) {
      const scaled = scale(row.feature_values, scalerValue);
      const pred = sigmoid(intercept + dot(weights, scaled));
      const error = pred - row.label;
      interceptGrad += error;
      for (let index = 0; index < width; index += 1) grad[index] += error * scaled[index] + options.l2 * weights[index];
    }
    const step = options.learningRate / Math.max(rows.length, 1);
    intercept -= step * interceptGrad;
    for (let index = 0; index < width; index += 1) weights[index] -= step * grad[index];
  }
  return { weights, intercept };
}

function score(values) {
  return sigmoid(model.intercept + dot(model.weights, scale(values, scaler)));
}

function makeScaler(rows) {
  const width = rows[0]?.length ?? 0;
  const means = Array(width).fill(0);
  const scales = Array(width).fill(1);
  for (let col = 0; col < width; col += 1) {
    means[col] = rows.reduce((total, row) => total + Number(row[col] ?? 0), 0) / Math.max(rows.length, 1);
    const variance = rows.reduce((total, row) => total + (Number(row[col] ?? 0) - means[col]) ** 2, 0) / Math.max(rows.length, 1);
    scales[col] = Math.sqrt(variance) || 1;
  }
  return { means, scales };
}

function scale(values, scalerValue) {
  return values.map((value, index) => (Number(value ?? 0) - scalerValue.means[index]) / scalerValue.scales[index]);
}

function dot(left, right) {
  return left.reduce((total, value, index) => total + value * right[index], 0);
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
  return Object.entries(policy).filter(([key]) => key !== "policy_id").map(([key, value]) => `${key}-${value}`).join("__");
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
  return text.trim() ? text.trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function rel(file) {
  return path.relative(rootDir, file);
}
