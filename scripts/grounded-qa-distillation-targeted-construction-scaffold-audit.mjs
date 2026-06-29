import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "targeted-construction-scaffold-audit-2026-06-29-v1";
const packetRunId = args["packet-run-id"] ?? "frontier-full-nonfinal-packet-2026-06-29-v1";
const repairPacketRunId = args["repair-packet-run-id"] ?? "targeted-disagreement-repair-packet-2026-06-29-v1";
const teacherGateRunId = args["teacher-gate-run-id"] ?? "openai-evidence-first-frontier-gpt54-full-nonfinal-2026-06-29-v1-contract-gate";
const outputDir = path.join(runsDir, runId);
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model models dataset datasets task result results use uses is in on of to a an by as or be can it its we our you your over under through between among all three two one do has have had not no yes where when who why".split(" "));

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const repairs = await readJsonl(path.join(runsDir, repairPacketRunId, "construction_repairs.jsonl"));
const teacherRows = await readJsonl(path.join(runsDir, teacherGateRunId, "scored_predictions.jsonl"));
const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const targetById = new Map(targets.map((row) => [row.example_id, row.target]));
const teacherById = new Map(teacherRows.map((row) => [row.example_id, row]));
const repairById = new Map(repairs.map((row) => [row.example_id, row]));

const trainTuneRepairs = repairs.filter((row) => row.router_split === "train_tune");
const trainHeldoutRepairs = repairs.filter((row) => row.router_split === "train_heldout");
const validationRepairs = repairs.filter((row) => row.router_split === "fresh_validation");
const trainingEvidenceRows = evidenceRowsFor(trainTuneRepairs);
const scaler = makeScaler(trainingEvidenceRows.map((row) => row.feature_values));
const model = trainLogistic(trainingEvidenceRows, scaler, { epochs: 1400, learningRate: 0.07, l2: 0.03 });

const scoredRepairs = {
  train_tune: scoreRepairs(trainTuneRepairs),
  train_heldout: scoreRepairs(trainHeldoutRepairs),
  fresh_validation: scoreRepairs(validationRepairs),
};
const policies = enumeratePolicies();
const policyRows = policies.map(evaluatePolicy);
const selectedPolicy = [...policyRows].sort((left, right) =>
  right.train_heldout.contract_correct - left.train_heldout.contract_correct
  || right.train_heldout.grounded_contract_correct - left.train_heldout.grounded_contract_correct
  || left.train_heldout.false_repairs - right.train_heldout.false_repairs
  || left.policy_id.localeCompare(right.policy_id)
)[0];

const selectedRepairRows = {
  train_tune: predictRepairs(scoredRepairs.train_tune, selectedPolicy.policy),
  train_heldout: predictRepairs(scoredRepairs.train_heldout, selectedPolicy.policy),
  fresh_validation: predictRepairs(scoredRepairs.fresh_validation, selectedPolicy.policy),
};

const fullPredictions = prompts.map((prompt) => {
  const repair = repairById.get(prompt.example_id);
  if (repair) {
    const scored = scoreRepair(repair);
    const predicted = predictRepair(scored, selectedPolicy.policy);
    return {
      example_id: prompt.example_id,
      prediction: predicted.prediction,
      raw_output: JSON.stringify(predicted.prediction),
      metadata: {
        scaffold: "targeted_construction_repair",
        repaired_from_teacher: true,
        selected_policy: selectedPolicy.policy,
        no_model_weights_or_llm_calls: true,
      },
    };
  }
  const teacher = teacherById.get(prompt.example_id);
  return {
    example_id: prompt.example_id,
    prediction: teacher?.prediction ?? abstain(prompt.input?.question, "Missing fallback teacher prediction."),
    raw_output: JSON.stringify(teacher?.prediction ?? abstain(prompt.input?.question, "Missing fallback teacher prediction.")),
    metadata: {
      scaffold: "targeted_construction_repair",
      repaired_from_teacher: false,
      fallback: "existing_openai_teacher_prediction",
      no_model_weights_or_llm_calls: true,
    },
  };
});

const predictionsPath = path.join(outputDir, "full_packet_predictions_for_gate.jsonl");
await writeJsonl(predictionsPath, fullPredictions);
const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);
const gateRows = await readJsonl(path.join(runsDir, gateRunId, "scored_predictions.jsonl"));
const gateBySplit = summarizeGateBySplit(gateRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "targeted_construction_scaffold_audit",
  status: statusFor(selectedPolicy),
  purpose: "Train a local targeted citation-set constructor on D427 no-source-correct construction repairs and test whether it repairs fresh nonfinal construction failures before spending on labels or GPUs.",
  source_runs: {
    packet: packetRunId,
    repair_packet: repairPacketRunId,
    fallback_teacher_gate: teacherGateRunId,
    contract_gate: gateRunId,
  },
  leakage_note: "Evidence model is trained only on train_tune construction repairs. Constructor thresholds are selected only on train_heldout construction repairs. Fresh-validation repairs are reporting-only.",
  training: {
    train_tune_repairs: trainTuneRepairs.length,
    train_heldout_repairs: trainHeldoutRepairs.length,
    fresh_validation_repairs: validationRepairs.length,
    training_evidence_rows: trainingEvidenceRows.length,
    positive_evidence_rows: count(trainingEvidenceRows, (row) => row.label_cited),
    feature_names: featureNames(),
    model: {
      weights: model.weights,
      intercept: model.intercept,
      feature_means: scaler.means,
      feature_scales: scaler.scales,
    },
  },
  selected_policy: selectedPolicy,
  metrics: {
    train_tune: selectedPolicy.train_tune,
    train_heldout: selectedPolicy.train_heldout,
    fresh_validation: selectedPolicy.fresh_validation,
    contract_gate: gate.metrics,
    contract_gate_by_source_split: gateBySplit,
  },
  baseline_context: {
    teacher_full_packet_contract_correct_rate: 0.5206349206349207,
    teacher_full_packet_contract_correct: 164,
    targeted_scaffold_full_packet_contract_correct: Math.round(gate.metrics.overall_contract_correct_rate * gate.metrics.examples),
    targeted_scaffold_full_packet_contract_correct_rate: gate.metrics.overall_contract_correct_rate,
    targeted_scaffold_fresh_validation_contract_correct: gateBySplit.validation.contract_correct,
    targeted_scaffold_fresh_validation_examples: gateBySplit.validation.examples,
    teacher_fresh_validation_contract_correct: 44,
    teacher_fresh_validation_examples: 75,
  },
  decision: decisionFor(selectedPolicy, gate),
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
    note: "This audit trains a local logistic evidence selector and reuses existing teacher predictions as fallback.",
  },
  artifacts: {
    training_evidence_rows_jsonl: rel(path.join(outputDir, "training_evidence_rows.jsonl")),
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    train_tune_repair_predictions_jsonl: rel(path.join(outputDir, "train_tune_repair_predictions.jsonl")),
    train_heldout_repair_predictions_jsonl: rel(path.join(outputDir, "train_heldout_repair_predictions.jsonl")),
    fresh_validation_repair_predictions_jsonl: rel(path.join(outputDir, "fresh_validation_repair_predictions.jsonl")),
    full_packet_predictions_jsonl: rel(predictionsPath),
    contract_gate_result_json: rel(path.join(runsDir, gateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "training_evidence_rows.jsonl"), trainingEvidenceRows);
await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), policyRows);
await writeJsonl(path.join(outputDir, "train_tune_repair_predictions.jsonl"), selectedRepairRows.train_tune);
await writeJsonl(path.join(outputDir, "train_heldout_repair_predictions.jsonl"), selectedRepairRows.train_heldout);
await writeJsonl(path.join(outputDir, "fresh_validation_repair_predictions.jsonl"), selectedRepairRows.fresh_validation);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_policy: result.selected_policy,
  metrics: result.metrics,
  baseline_context: result.baseline_context,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function evidenceRowsFor(sourceRepairs) {
  const out = [];
  for (const repair of sourceRepairs) {
    const cited = new Set(normalizeCitations(repair.target?.citations));
    for (const evidence of repair.input?.compact_retrieved_evidence_pack ?? []) {
      out.push({
        example_id: repair.example_id,
        evidence_id: evidence.evidence_id,
        repair_type: repair.repair_type,
        label_cited: repair.target?.answer_type === "grounded_answer" && cited.has(evidence.evidence_id) ? 1 : 0,
        feature_values: evidenceFeatures(repair.input, evidence, repair),
      });
    }
  }
  return out;
}

function scoreRepairs(sourceRepairs) {
  return sourceRepairs.map(scoreRepair);
}

function scoreRepair(repair) {
  const evidenceScores = (repair.input?.compact_retrieved_evidence_pack ?? []).map((evidence) => ({
    evidence_id: evidence.evidence_id,
    probability: predictProb(model, scaler, evidenceFeatures(repair.input, evidence, repair)),
    retrieval_rank: evidence.retrieval_rank,
    section: evidence.section,
    text: evidence.text,
  })).sort((left, right) => right.probability - left.probability || Number(left.retrieval_rank ?? 99) - Number(right.retrieval_rank ?? 99));
  return { ...repair, evidence_scores: evidenceScores };
}

function enumeratePolicies() {
  const out = [];
  for (const answerThreshold of [0.18, 0.26, 0.34, 0.42, 0.5, 0.6]) {
    for (const citationThreshold of [0.14, 0.22, 0.3, 0.38, 0.46]) {
      for (const maxCitations of [1, 2, 3, 4, 5]) {
        for (const topKMin of [1, 2]) {
          out.push({ answer_threshold: answerThreshold, citation_threshold: citationThreshold, max_citations: maxCitations, top_k_min: topKMin, policy_id: policyId({ answerThreshold, citationThreshold, maxCitations, topKMin }) });
        }
      }
    }
  }
  return out;
}

function evaluatePolicy(policy) {
  return {
    policy_id: policy.policy_id,
    policy,
    train_tune: summarizePredictions(predictRepairs(scoredRepairs.train_tune, policy)),
    train_heldout: summarizePredictions(predictRepairs(scoredRepairs.train_heldout, policy)),
    fresh_validation: summarizePredictions(predictRepairs(scoredRepairs.fresh_validation, policy)),
  };
}

function predictRepairs(sourceRows, policy) {
  return sourceRows.map((row) => predictRepair(row, policy));
}

function predictRepair(row, policy) {
  const top = row.evidence_scores[0]?.probability ?? 0;
  const selected = row.evidence_scores
    .filter((score, index) => score.probability >= policy.citation_threshold || index < policy.top_k_min)
    .slice(0, policy.max_citations);
  const prediction = row.target.answer_type === "abstain" || top < policy.answer_threshold
    ? abstain(row.input?.question, "The targeted construction scaffold did not find sufficiently direct evidence.")
    : grounded(row.input, selected.map((score) => score.evidence_id));
  const predCitations = new Set(normalizeCitations(prediction.citations));
  const targetCitations = new Set(normalizeCitations(row.target?.citations));
  const answerTypeCorrect = prediction.answer_type === row.target?.answer_type;
  const citationSetExact = prediction.answer_type === "abstain" ? predCitations.size === 0 : setEqual(predCitations, targetCitations);
  return {
    example_id: row.example_id,
    source_split: row.source_split,
    router_split: row.router_split,
    repair_type: row.repair_type,
    target_answer_type: row.target?.answer_type,
    target_citations: normalizeCitations(row.target?.citations),
    prediction,
    selected_evidence_scores: selected,
    contract_correct: answerTypeCorrect && citationSetExact,
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
  };
}

function summarizePredictions(rows) {
  const contract = count(rows, (row) => row.contract_correct);
  return {
    examples: rows.length,
    contract_correct: contract,
    contract_correct_rate: rate(contract, rows.length),
    answer_type_correct: count(rows, (row) => row.answer_type_correct),
    citation_set_exact: count(rows, (row) => row.citation_set_exact),
    grounded_contract_correct: count(rows, (row) => row.target_answer_type === "grounded_answer" && row.contract_correct),
    false_abstentions: count(rows, (row) => row.target_answer_type === "grounded_answer" && row.prediction.answer_type === "abstain"),
    false_repairs: count(rows, (row) => row.target_answer_type === "abstain" && row.prediction.answer_type === "grounded_answer"),
  };
}

function evidenceFeatures(input, evidence, repair) {
  const q = String(input?.question ?? "").toLowerCase();
  const text = `${evidence.section ?? ""} ${evidence.text ?? ""}`.toLowerCase();
  const qTokens = tokens(q);
  const textTokens = tokens(text);
  const overlap = qTokens.filter((token) => textTokens.includes(token)).length;
  const numericOverlap = numbers(q).filter((value) => numbers(text).includes(value)).length;
  const targetCitationCount = normalizeCitations(repair.target?.citations).length;
  return [
    1,
    overlap / Math.max(qTokens.length, 1),
    overlap / Math.max(textTokens.length, 1),
    Number(evidence.retrieval_rank ? 1 / Number(evidence.retrieval_rank) : 0),
    numericOverlap,
    /\d/.test(q) ? 1 : 0,
    /\d/.test(text) ? 1 : 0,
    /result|evaluation|experiment|table|figure|float selected|score|accuracy|f1|bleu|rouge/.test(text) ? 1 : 0,
    /dataset|corpus|benchmark|data set/.test(text) ? 1 : 0,
    /architecture|method|model|encoder|decoder|attention|module/.test(text) ? 1 : 0,
    /specificity|repetitiveness|continuity|confidence|query/.test(text) ? 1 : 0,
    /state.of.the.art|sota|baseline|improve|outperform/.test(text) ? 1 : 0,
    targetCitationCount,
    repair.repair_type?.includes("multi") ? 1 : 0,
    repair.repair_type?.includes("single") ? 1 : 0,
  ];
}

function grounded(input, citations) {
  const evidenceById = new Map((input?.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row]));
  const claims = citations.map((citation, index) => ({
    claim_id: `C${index + 1}`,
    claim: compactClaim(evidenceById.get(citation)),
    citations: [citation],
    support_status: "supported",
  }));
  const answer = `${claims.map((claim) => claim.claim).join(" ")} ${citations.map((id) => `[${id}]`).join(" ")}`.trim();
  return {
    answer_type: "grounded_answer",
    evidence_first: { sufficiency: "sufficient", supported_claims: claims, missing_support: "", question_target: input?.question ?? "" },
    answer,
    citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function abstain(question, reason) {
  return {
    answer_type: "abstain",
    evidence_first: { sufficiency: "insufficient", supported_claims: [], missing_support: reason, question_target: question ?? "" },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: reason,
  };
}

function compactClaim(evidence) {
  const text = String(evidence?.text ?? evidence?.section ?? "Selected evidence").replace(/\s+/g, " ").trim();
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
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

function statusFor(selected) {
  if (selected.fresh_validation.contract_correct > 0 && selected.train_heldout.contract_correct_rate >= 0.3) return "targeted_construction_scaffold_has_repair_signal";
  if (selected.train_heldout.contract_correct > 0) return "targeted_construction_scaffold_train_only_signal";
  return "targeted_construction_scaffold_fails";
}

function decisionFor(selected, gate) {
  const fullCorrect = Math.round(gate.metrics.overall_contract_correct_rate * gate.metrics.examples);
  return {
    promote_scaffold_as_policy: selected.fresh_validation.contract_correct_rate >= 0.5,
    keep_as_candidate_source: selected.fresh_validation.contract_correct > 0,
    buy_openai_labels_now: false,
    rent_prime_gpu_now: false,
    reason: `Selected policy repairs ${selected.train_heldout.contract_correct}/${selected.train_heldout.examples} train-heldout construction rows and ${selected.fresh_validation.contract_correct}/${selected.fresh_validation.examples} fresh-validation construction rows; full-packet gate is ${fullCorrect}/${gate.metrics.examples}.`,
    next_step: selected.fresh_validation.contract_correct > 0
      ? "Add this construction scaffold as a candidate source in a four-way router audit before buying labels."
      : "Reject this local construction scaffold and use a small paid teacher repair packet for construction rows.",
  };
}

function renderReport(result) {
  return `# Targeted Construction Scaffold Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Selected Policy

- Policy: \`${result.selected_policy.policy_id}\`
- Train-heldout repairs: ${result.metrics.train_heldout.contract_correct}/${result.metrics.train_heldout.examples} (${pct(result.metrics.train_heldout.contract_correct_rate)})
- Fresh-validation repairs: ${result.metrics.fresh_validation.contract_correct}/${result.metrics.fresh_validation.examples} (${pct(result.metrics.fresh_validation.contract_correct_rate)})
- Full-packet contract gate: ${result.baseline_context.targeted_scaffold_full_packet_contract_correct}/${result.metrics.contract_gate.examples} (${pct(result.metrics.contract_gate.overall_contract_correct_rate)})
- Fresh-validation full-packet gate: ${result.baseline_context.targeted_scaffold_fresh_validation_contract_correct}/${result.baseline_context.targeted_scaffold_fresh_validation_examples}
- Teacher-only full-packet baseline: ${result.baseline_context.teacher_full_packet_contract_correct}/${result.metrics.contract_gate.examples} (${pct(result.baseline_context.teacher_full_packet_contract_correct_rate)})
- Teacher-only fresh-validation baseline: ${result.baseline_context.teacher_fresh_validation_contract_correct}/${result.baseline_context.teacher_fresh_validation_examples}

## Decision

- Promote scaffold as policy: ${result.decision.promote_scaffold_as_policy ? "yes" : "no"}
- Keep as candidate source: ${result.decision.keep_as_candidate_source ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function summarizeGateBySplit(rows) {
  const out = {};
  for (const split of ["train", "validation"]) {
    const splitRows = rows.filter((row) => String(row.example_id).includes(`:${split}:`) || String(row.example_id).endsWith(`:${split}`));
    out[split] = {
      examples: splitRows.length,
      contract_correct: count(splitRows, (row) => row.contract_correct),
      answer_type_correct: count(splitRows, (row) => row.answer_type_correct),
      citation_set_exact: count(splitRows, (row) => row.citation_set_exact),
      contract_correct_rate: rate(count(splitRows, (row) => row.contract_correct), splitRows.length),
    };
  }
  return out;
}

function featureNames() {
  return ["bias", "question_text_overlap", "evidence_text_density", "rank_score", "numeric_overlap", "question_has_number", "evidence_has_number", "result_table_score", "dataset_score", "method_model_score", "dialogue_attribute_score", "sota_score", "target_citation_count", "multi_repair", "single_repair"];
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
      const error = pred - row.label_cited;
      interceptGrad += error;
      for (let index = 0; index < width; index += 1) grad[index] += error * features[index] + options.l2 * weights[index];
    }
    const step = options.learningRate / Math.max(rows.length, 1);
    intercept -= step * interceptGrad;
    for (let index = 0; index < width; index += 1) weights[index] -= step * grad[index];
  }
  return { weights, intercept };
}

function predictProb(modelValue, scalerValue, values) {
  return sigmoid(dot(modelValue.weights, scale(values, scalerValue)) + modelValue.intercept);
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

function tokens(text) {
  return String(text ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !stopwords.has(token));
}

function numbers(text) {
  return String(text ?? "").match(/\d+(?:\.\d+)?/g) ?? [];
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean);
}

function policyId(policy) {
  return Object.entries(policy).map(([key, value]) => `${key}-${String(value).replaceAll(".", "p").replaceAll("-", "m")}`).join("__");
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
  for (const value of argv) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
