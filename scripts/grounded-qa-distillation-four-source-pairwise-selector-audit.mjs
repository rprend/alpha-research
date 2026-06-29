import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "four-source-pairwise-selector-audit-2026-06-29-v1";
const packetRunId = args["packet-run-id"] ?? "frontier-full-nonfinal-packet-2026-06-29-v1";
const fourSourceRunId = args["four-source-run-id"] ?? "four-source-router-audit-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const sources = ["pattern", "learned", "teacher", "structured_group"];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const candidateRows = await readJsonl(path.join(runsDir, fourSourceRunId, "candidate_rows.jsonl"));
const trainTuneRows = candidateRows.filter((row) => row.router_split === "train_tune");
const trainHeldoutRows = candidateRows.filter((row) => row.router_split === "train_heldout");
const validationRows = candidateRows.filter((row) => row.router_split === "fresh_validation");

const pairwiseRows = pairwiseRowsFor(trainTuneRows);
const scaler = makeScaler(pairwiseRows.map((row) => row.feature_values));
const model = trainPairwise(pairwiseRows, scaler, { epochs: 1200, learningRate: 0.08, l2: 0.03 });
attachPairwiseScores(candidateRows);

const policyRows = enumeratePolicies().map(evaluatePolicy);
const selectedPolicy = [...policyRows].sort((left, right) =>
  right.train_heldout.contract_correct - left.train_heldout.contract_correct
  || right.train_heldout.grounded_target_contract_correct - left.train_heldout.grounded_target_contract_correct
  || left.train_heldout.over_answered_abstentions - right.train_heldout.over_answered_abstentions
  || left.policy_id.localeCompare(right.policy_id)
)[0];

const allRoutedRows = routeRows(candidateRows, selectedPolicy.policy);
const validationRoutedRows = allRoutedRows.filter((row) => row.router_split === "fresh_validation");
const predictionsPath = path.join(outputDir, "routed_predictions_for_gate.jsonl");
await writeJsonl(predictionsPath, allRoutedRows.map((row) => ({
  example_id: row.example_id,
  prediction: row.selected_candidate.prediction,
  raw_output: JSON.stringify(row.selected_candidate.prediction),
  metadata: {
    scaffold: "four_source_pairwise_selector",
    selected_source: row.selected_source,
    selected_policy: selectedPolicy.policy,
    no_new_llm_calls: true,
  },
})));
const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);

const sourceMetrics = Object.fromEntries(sources.map((source) => [source, summarizeCandidates(validationRows, source)]));
sourceMetrics.oracle_any_source = summarizeOracle(validationRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "four_source_pairwise_selector_audit",
  status: statusFor(selectedPolicy, sourceMetrics),
  purpose: "Train a pairwise selector over the four-source candidate pool to test whether richer selector supervision can extract oracle headroom beyond always using the structured-group source.",
  source_runs: {
    packet: packetRunId,
    four_source_router: fourSourceRunId,
    contract_gate: gateRunId,
  },
  leakage_note: "Pairwise selector is trained only on train_tune candidate preferences. Policy selection uses train_heldout rows. Fresh validation is reporting-only.",
  training: {
    train_tune_examples: trainTuneRows.length,
    train_heldout_examples: trainHeldoutRows.length,
    fresh_validation_examples: validationRows.length,
    pairwise_training_rows: pairwiseRows.length,
    feature_names: featureNames(),
    model: {
      weights: model.weights,
      feature_means: scaler.means,
      feature_scales: scaler.scales,
    },
  },
  selected_policy: selectedPolicy,
  source_metrics: sourceMetrics,
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
    note: "This audit trains a local pairwise selector over existing prediction artifacts only.",
  },
  artifacts: {
    pairwise_training_rows_jsonl: rel(path.join(outputDir, "pairwise_training_rows.jsonl")),
    scored_candidate_rows_jsonl: rel(path.join(outputDir, "scored_candidate_rows.jsonl")),
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    fresh_validation_routed_rows_jsonl: rel(path.join(outputDir, "fresh_validation_routed_rows.jsonl")),
    routed_predictions_jsonl: rel(predictionsPath),
    contract_gate_result_json: rel(path.join(runsDir, gateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "pairwise_training_rows.jsonl"), pairwiseRows);
await writeJsonl(path.join(outputDir, "scored_candidate_rows.jsonl"), candidateRows);
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
  metrics: result.metrics,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function pairwiseRowsFor(rows) {
  const out = [];
  for (const row of rows) {
    const correct = sources.filter((source) => row.candidates[source].contract_correct);
    const incorrect = sources.filter((source) => !row.candidates[source].contract_correct);
    for (const chosen of correct) {
      for (const rejected of incorrect) {
        const chosenFeatures = features(row, chosen);
        const rejectedFeatures = features(row, rejected);
        out.push({
          example_id: row.example_id,
          chosen,
          rejected,
          feature_values: chosenFeatures.map((value, index) => value - rejectedFeatures[index]),
        });
      }
    }
  }
  return out;
}

function attachPairwiseScores(rows) {
  for (const row of rows) {
    for (const source of sources) row.candidates[source].pairwise_score = scoreFeatures(features(row, source));
  }
}

function featureNames() {
  return [
    "bias", "source_pattern", "source_learned", "source_teacher", "source_structured_group",
    "source_pattern_counterfactual", "source_learned_counterfactual", "source_teacher_counterfactual", "source_structured_counterfactual",
    "candidate_grounded", "candidate_abstain", "candidate_citation_count",
    "answer_majority", "citation_majority", "agrees_teacher_answer", "agrees_teacher_citations",
    "agrees_group_answer", "agrees_group_citations", "parseable", "evidence_first_valid",
    "counterfactual_prompt", "numeric_metric_intent", "pattern_top_score", "learned_top_probability", "learned_margin",
  ];
}

function features(row, source) {
  const candidate = row.candidates[source];
  const teacher = row.candidates.teacher;
  const group = row.candidates.structured_group;
  const citationCounts = countBy(sources.map((name) => key(row.candidates[name].citations)));
  const answerCounts = countBy(sources.map((name) => row.candidates[name].answer_type ?? "missing"));
  const counterfactual = row.intent?.includes("counterfactual") ? 1 : 0;
  const numericMetric = row.intent?.includes("numeric") || row.intent?.includes("metric") || row.intent?.includes("optimization") ? 1 : 0;
  return [
    1,
    source === "pattern" ? 1 : 0,
    source === "learned" ? 1 : 0,
    source === "teacher" ? 1 : 0,
    source === "structured_group" ? 1 : 0,
    source === "pattern" ? counterfactual : 0,
    source === "learned" ? counterfactual : 0,
    source === "teacher" ? counterfactual : 0,
    source === "structured_group" ? counterfactual : 0,
    candidate.answer_type === "grounded_answer" ? 1 : 0,
    candidate.answer_type === "abstain" ? 1 : 0,
    normalizeCitations(candidate.citations).length,
    Number(answerCounts[candidate.answer_type ?? "missing"] ?? 0),
    Number(citationCounts[key(candidate.citations)] ?? 0),
    candidate.answer_type === teacher.answer_type ? 1 : 0,
    key(candidate.citations) === key(teacher.citations) ? 1 : 0,
    candidate.answer_type === group.answer_type ? 1 : 0,
    key(candidate.citations) === key(group.citations) ? 1 : 0,
    candidate.parseable === false ? 0 : 1,
    candidate.evidence_first_valid === false ? 0 : 1,
    counterfactual,
    numericMetric ? 1 : 0,
    Number(row.candidates.pattern.feature?.pattern_top_score ?? 0),
    Number(row.candidates.learned.feature?.learned_top_probability ?? 0),
    Number(row.candidates.learned.feature?.learned_margin ?? 0),
  ];
}

function enumeratePolicies() {
  const out = sources.map((source) => ({ family: "always_source", source }));
  for (const minMargin of [-0.5, -0.25, -0.1, 0, 0.1, 0.25, 0.5]) {
    for (const fallback of ["structured_group", "teacher", "learned"]) out.push({ family: "pairwise_max", min_margin: minMargin, fallback });
  }
  for (const abstainThreshold of [0, 0.1, 0.25, 0.5, 0.8]) {
    out.push({ family: "counterfactual_abstain_guard", abstain_threshold: abstainThreshold, fallback: "structured_group" });
  }
  return out.map((policy) => ({ ...policy, policy_id: policyId(policy) }));
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
  if (policy.family === "counterfactual_abstain_guard" && row.intent?.includes("counterfactual")) {
    const abstainers = sources.filter((source) => row.candidates[source].answer_type === "abstain")
      .sort((a, b) => row.candidates[b].pairwise_score - row.candidates[a].pairwise_score || a.localeCompare(b));
    if (abstainers.length && row.candidates[abstainers[0]].pairwise_score >= policy.abstain_threshold) return abstainers[0];
    return policy.fallback;
  }
  const ranked = [...sources].sort((a, b) => row.candidates[b].pairwise_score - row.candidates[a].pairwise_score || a.localeCompare(b));
  const best = ranked[0];
  const fallback = policy.fallback ?? ranked[1];
  if (policy.family === "pairwise_max" && row.candidates[best].pairwise_score - row.candidates[fallback].pairwise_score < policy.min_margin) return fallback;
  return best;
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
  if (selected.fresh_validation.contract_correct > bestSingle) return "pairwise_selector_beats_best_single_source";
  if (sourceMetrics.oracle_any_source.contract_correct > bestSingle) return "pairwise_selector_does_not_extract_oracle_headroom";
  return "pairwise_selector_no_remaining_headroom";
}

function decisionFor(selected, sourceMetrics) {
  const bestSingle = Math.max(...sources.map((source) => sourceMetrics[source].contract_correct));
  return {
    promote_pairwise_selector: selected.fresh_validation.contract_correct > bestSingle,
    keep_pairwise_features: selected.train_heldout.contract_correct > bestSingle,
    buy_openai_labels_now: false,
    rent_prime_gpu_now: false,
    reason: `Selected pairwise policy scored ${selected.fresh_validation.contract_correct}/75; best single source scored ${bestSingle}/75; oracle scored ${sourceMetrics.oracle_any_source.contract_correct}/75.`,
    next_step: selected.fresh_validation.contract_correct > bestSingle
      ? "Use the pairwise selector as the next distillation target generator."
      : "Stop zero-cost selector variants and use a small targeted paid repair/adjudication packet for selector misses and no-source-correct rows.",
  };
}

function renderReport(result) {
  return `# Four-Source Pairwise Selector Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Selected Policy

- Policy: \`${result.selected_policy.policy_id}\`
- Train-heldout contract: ${result.metrics.train_heldout.contract_correct}/${result.metrics.train_heldout.examples} (${pct(result.metrics.train_heldout.contract_correct_rate)})
- Fresh-validation contract: ${result.metrics.fresh_validation.contract_correct}/${result.metrics.fresh_validation.examples} (${pct(result.metrics.fresh_validation.contract_correct_rate)})

## Source Comparison

- Structured group: ${result.source_metrics.structured_group.contract_correct}/75 (${pct(result.source_metrics.structured_group.contract_correct_rate)})
- Teacher: ${result.source_metrics.teacher.contract_correct}/75 (${pct(result.source_metrics.teacher.contract_correct_rate)})
- Four-source oracle: ${result.source_metrics.oracle_any_source.contract_correct}/75 (${pct(result.source_metrics.oracle_any_source.contract_correct_rate)})

## Decision

- Promote pairwise selector: ${result.decision.promote_pairwise_selector ? "yes" : "no"}
- Keep pairwise features: ${result.decision.keep_pairwise_features ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function trainPairwise(rows, scalerValue, options) {
  const width = rows[0]?.feature_values?.length ?? 0;
  const weights = Array(width).fill(0);
  for (let epoch = 0; epoch < options.epochs; epoch += 1) {
    const grad = Array(width).fill(0);
    for (const row of rows) {
      const scaled = scale(row.feature_values, scalerValue);
      const pred = sigmoid(dot(weights, scaled));
      const error = pred - 1;
      for (let index = 0; index < width; index += 1) grad[index] += error * scaled[index] + options.l2 * weights[index];
    }
    const step = options.learningRate / Math.max(rows.length, 1);
    for (let index = 0; index < width; index += 1) weights[index] -= step * grad[index];
  }
  return { weights };
}

function scoreFeatures(values) {
  return dot(model.weights, scale(values, scaler));
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

function scale(values, scalerValue) {
  return values.map((value, index) => (Number(value ?? 0) - scalerValue.means[index]) / scalerValue.scales[index]);
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
  return Object.entries(policy).map(([keyName, value]) => `${keyName}-${String(value).replaceAll(".", "p").replaceAll("-", "m")}`).join("__");
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
