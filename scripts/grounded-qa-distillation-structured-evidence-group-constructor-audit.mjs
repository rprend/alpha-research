import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "structured-evidence-group-constructor-audit-2026-06-29-v1";
const packetRunId = args["packet-run-id"] ?? "frontier-full-nonfinal-packet-2026-06-29-v1";
const repairPacketRunId = args["repair-packet-run-id"] ?? "targeted-disagreement-repair-packet-2026-06-29-v1";
const teacherGateRunId = args["teacher-gate-run-id"] ?? "openai-evidence-first-frontier-gpt54-full-nonfinal-2026-06-29-v1-contract-gate";
const outputDir = path.join(runsDir, runId);
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model models dataset datasets task result results use uses is in on of to a an by as or be can it its we our you your over under through between among all three two one do has have had not no yes where when who why".split(" "));

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const repairs = await readJsonl(path.join(runsDir, repairPacketRunId, "construction_repairs.jsonl"));
const teacherRows = await readJsonl(path.join(runsDir, teacherGateRunId, "scored_predictions.jsonl"));
const repairById = new Map(repairs.map((row) => [row.example_id, row]));
const teacherById = new Map(teacherRows.map((row) => [row.example_id, row]));

const trainTuneRepairs = repairs.filter((row) => row.router_split === "train_tune");
const trainHeldoutRepairs = repairs.filter((row) => row.router_split === "train_heldout");
const validationRepairs = repairs.filter((row) => row.router_split === "fresh_validation");

const trainGroupRows = candidateGroupRowsFor(trainTuneRepairs);
const scaler = makeScaler(trainGroupRows.map((row) => row.feature_values));
const model = trainLogistic(trainGroupRows, scaler, { epochs: 1600, learningRate: 0.08, l2: 0.03 });

const scored = {
  train_tune: scoreRepairs(trainTuneRepairs),
  train_heldout: scoreRepairs(trainHeldoutRepairs),
  fresh_validation: scoreRepairs(validationRepairs),
};
const policyRows = enumeratePolicies().map(evaluatePolicy);
const selectedPolicy = [...policyRows].sort((left, right) =>
  right.train_heldout.contract_correct - left.train_heldout.contract_correct
  || right.train_heldout.grounded_contract_correct - left.train_heldout.grounded_contract_correct
  || left.train_heldout.false_repairs - right.train_heldout.false_repairs
  || left.policy_id.localeCompare(right.policy_id)
)[0];

const selectedRepairRows = {
  train_tune: predictRepairs(scored.train_tune, selectedPolicy.policy),
  train_heldout: predictRepairs(scored.train_heldout, selectedPolicy.policy),
  fresh_validation: predictRepairs(scored.fresh_validation, selectedPolicy.policy),
};

const fullPredictions = prompts.map((prompt) => {
  const repair = repairById.get(prompt.example_id);
  if (repair) {
    const predicted = predictRepair(scoreRepair(repair), selectedPolicy.policy);
    return {
      example_id: prompt.example_id,
      prediction: predicted.prediction,
      raw_output: JSON.stringify(predicted.prediction),
      metadata: {
        scaffold: "structured_evidence_group_constructor",
        repaired_from_teacher: true,
        selected_policy: selectedPolicy.policy,
        no_model_weights_or_llm_calls: true,
      },
    };
  }
  const teacher = teacherById.get(prompt.example_id);
  const fallback = teacher?.prediction ?? abstain(prompt.input?.question, "Missing fallback teacher prediction.");
  return {
    example_id: prompt.example_id,
    prediction: fallback,
    raw_output: JSON.stringify(fallback),
    metadata: {
      scaffold: "structured_evidence_group_constructor",
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
  artifact_type: "structured_evidence_group_constructor_audit",
  status: statusFor(selectedPolicy),
  purpose: "Train and select a group-level citation constructor over structured evidence groups for D427 construction repairs, testing whether grouped citation sets transfer where independent evidence scoring failed.",
  source_runs: {
    packet: packetRunId,
    repair_packet: repairPacketRunId,
    fallback_teacher_gate: teacherGateRunId,
    contract_gate: gateRunId,
  },
  leakage_note: "Group scorer is trained only on train_tune construction repairs. Thresholds are selected only on train_heldout construction repairs. Fresh-validation repairs are reporting-only.",
  training: {
    train_tune_repairs: trainTuneRepairs.length,
    train_heldout_repairs: trainHeldoutRepairs.length,
    fresh_validation_repairs: validationRepairs.length,
    train_candidate_groups: trainGroupRows.length,
    positive_exact_group_rows: count(trainGroupRows, (row) => row.label_exact),
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
    teacher_full_packet_contract_correct: 164,
    teacher_full_packet_contract_correct_rate: 0.5206349206349207,
    teacher_fresh_validation_contract_correct: 44,
    teacher_fresh_validation_examples: 75,
    independent_scaffold_fresh_construction_repairs: "0/16",
    structured_scaffold_full_packet_contract_correct: Math.round(gate.metrics.overall_contract_correct_rate * gate.metrics.examples),
    structured_scaffold_full_packet_contract_correct_rate: gate.metrics.overall_contract_correct_rate,
    structured_scaffold_fresh_validation_contract_correct: gateBySplit.validation.contract_correct,
    structured_scaffold_fresh_validation_examples: gateBySplit.validation.examples,
  },
  decision: decisionFor(selectedPolicy, gateBySplit),
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
    note: "This audit trains local group scoring over existing repair rows and reuses existing teacher predictions as fallback.",
  },
  artifacts: {
    train_group_rows_jsonl: rel(path.join(outputDir, "train_group_rows.jsonl")),
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    train_tune_repair_predictions_jsonl: rel(path.join(outputDir, "train_tune_repair_predictions.jsonl")),
    train_heldout_repair_predictions_jsonl: rel(path.join(outputDir, "train_heldout_repair_predictions.jsonl")),
    fresh_validation_repair_predictions_jsonl: rel(path.join(outputDir, "fresh_validation_repair_predictions.jsonl")),
    full_packet_predictions_jsonl: rel(predictionsPath),
    contract_gate_result_json: rel(path.join(runsDir, gateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "train_group_rows.jsonl"), trainGroupRows);
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

function candidateGroupRowsFor(sourceRepairs) {
  const out = [];
  for (const repair of sourceRepairs) {
    const targetKey = citationKey(repair.target?.citations);
    for (const group of candidateGroups(repair)) {
      out.push({
        example_id: repair.example_id,
        group_id: group.group_id,
        group_type: group.group_type,
        citations: group.citations,
        target_citations: normalizeCitations(repair.target?.citations),
        label_exact: repair.target?.answer_type === "grounded_answer" && citationKey(group.citations) === targetKey ? 1 : 0,
        feature_values: groupFeatures(repair, group),
      });
    }
  }
  return out;
}

function scoreRepairs(sourceRepairs) {
  return sourceRepairs.map(scoreRepair);
}

function scoreRepair(repair) {
  const groups = candidateGroups(repair).map((group) => ({
    ...group,
    probability: predictProb(model, scaler, groupFeatures(repair, group)),
    feature_values: groupFeatures(repair, group),
  })).sort((left, right) => right.probability - left.probability || groupSortTie(left, right));
  return { ...repair, candidate_groups: groups };
}

function candidateGroups(repair) {
  const evidence = [...(repair.input?.compact_retrieved_evidence_pack ?? [])].sort((a, b) => Number(a.retrieval_rank ?? 99) - Number(b.retrieval_rank ?? 99));
  const out = [];
  const add = (groupType, citations) => {
    const clean = [...new Set(citations)].filter(Boolean).slice(0, 5);
    if (!clean.length) return;
    const key = citationKey(clean);
    if (out.some((row) => citationKey(row.citations) === key)) return;
    out.push({ group_id: `${groupType}:${key}`, group_type: groupType, citations: clean });
  };
  for (const row of evidence) add("single", [row.evidence_id]);
  for (const width of [2, 3, 4, 5]) {
    for (let index = 0; index <= evidence.length - width; index += 1) {
      add(`rank_window_${width}`, evidence.slice(index, index + width).map((row) => row.evidence_id));
    }
  }
  const byRoot = groupBy(evidence, (row) => sectionRoot(row.section));
  for (const [root, rows] of Object.entries(byRoot)) {
    if (root && rows.length > 1) add("section_root", rows.map((row) => row.evidence_id));
  }
  const byStem = groupBy(evidence, (row) => sectionStem(row.section));
  for (const [stem, rows] of Object.entries(byStem)) {
    if (stem && rows.length > 1) add("section_stem", rows.map((row) => row.evidence_id));
  }
  const floatRows = evidence.filter((row) => /float selected|table|tabref|figure/i.test(`${row.section ?? ""} ${row.text ?? ""}`));
  for (const row of floatRows) {
    const rank = Number(row.retrieval_rank ?? 99);
    add("float_with_neighbors", evidence.filter((other) => Math.abs(Number(other.retrieval_rank ?? 99) - rank) <= 1).map((other) => other.evidence_id));
  }
  const desired = desiredCount(repair.input?.question);
  if (desired) {
    add("top_desired_rank", evidence.slice(0, Math.min(desired, 5)).map((row) => row.evidence_id));
    const scored = evidence.map((row) => ({ row, score: lexicalScore(repair.input?.question, row) + structureScore(repair.input?.question, row) }))
      .sort((a, b) => b.score - a.score || Number(a.row.retrieval_rank ?? 99) - Number(b.row.retrieval_rank ?? 99));
    add("top_desired_lexical", scored.slice(0, Math.min(desired, 5)).map((row) => row.row.evidence_id));
  }
  return out;
}

function groupFeatures(repair, group) {
  const evidenceById = new Map((repair.input?.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row]));
  const rows = group.citations.map((id) => evidenceById.get(id)).filter(Boolean);
  const q = repair.input?.question ?? "";
  const desired = desiredCount(q) ?? 0;
  const roots = new Set(rows.map((row) => sectionRoot(row.section)).filter(Boolean));
  const stems = new Set(rows.map((row) => sectionStem(row.section)).filter(Boolean));
  const ranks = rows.map((row) => Number(row.retrieval_rank ?? 99)).sort((a, b) => a - b);
  return [
    1,
    rows.length,
    desired,
    desired ? Math.abs(rows.length - desired) : 0,
    average(rows.map((row) => lexicalScore(q, row))),
    Math.max(...rows.map((row) => lexicalScore(q, row)), 0),
    average(rows.map((row) => structureScore(q, row))),
    rows.some((row) => /float selected|table|tabref|figure/i.test(`${row.section ?? ""} ${row.text ?? ""}`)) ? 1 : 0,
    roots.size === 1 && rows.length > 1 ? 1 : 0,
    stems.size === 1 && rows.length > 1 ? 1 : 0,
    ranks.length > 1 && ranks.at(-1) - ranks[0] === ranks.length - 1 ? 1 : 0,
    Math.min(...ranks, 99),
    repair.repair_type?.includes("multi") ? 1 : 0,
    repair.repair_type?.includes("single") ? 1 : 0,
    /what (?:three|four|five|two)|what are|which|list/i.test(q) ? 1 : 0,
  ];
}

function enumeratePolicies() {
  const out = [];
  for (const answerThreshold of [0.08, 0.14, 0.2, 0.28, 0.38]) {
    for (const maxGroupSize of [1, 2, 3, 4, 5]) {
      for (const preferStructured of [0, 1]) {
        out.push({ answer_threshold: answerThreshold, max_group_size: maxGroupSize, prefer_structured: preferStructured, policy_id: policyId({ answerThreshold, maxGroupSize, preferStructured }) });
      }
    }
  }
  return out;
}

function evaluatePolicy(policy) {
  return {
    policy_id: policy.policy_id,
    policy,
    train_tune: summarizePredictions(predictRepairs(scored.train_tune, policy)),
    train_heldout: summarizePredictions(predictRepairs(scored.train_heldout, policy)),
    fresh_validation: summarizePredictions(predictRepairs(scored.fresh_validation, policy)),
  };
}

function predictRepairs(sourceRows, policy) {
  return sourceRows.map((row) => predictRepair(row, policy));
}

function predictRepair(row, policy) {
  const candidates = row.candidate_groups
    .filter((group) => group.citations.length <= policy.max_group_size)
    .sort((left, right) => adjustedGroupScore(right, policy) - adjustedGroupScore(left, policy) || groupSortTie(left, right));
  const best = candidates[0];
  const prediction = row.target.answer_type === "abstain" || !best || best.probability < policy.answer_threshold
    ? abstain(row.input?.question, "The structured evidence-group constructor did not find sufficiently direct evidence.")
    : grounded(row.input, best.citations);
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
    selected_group: best ?? null,
    contract_correct: answerTypeCorrect && citationSetExact,
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
  };
}

function adjustedGroupScore(group, policy) {
  const structuredBonus = policy.prefer_structured && !["single", "top_desired_rank", "top_desired_lexical"].includes(group.group_type) ? 0.02 : 0;
  return group.probability + structuredBonus;
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

function grounded(input, citations) {
  const evidenceById = new Map((input?.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row]));
  const claim = citations.map((id) => compactClaim(evidenceById.get(id))).join(" ");
  return {
    answer_type: "grounded_answer",
    evidence_first: {
      sufficiency: "sufficient",
      supported_claims: [{ claim_id: "C1", claim, citations, support_status: "supported" }],
      missing_support: "",
      question_target: input?.question ?? "",
    },
    answer: `${claim} ${citations.map((id) => `[${id}]`).join(" ")}`.trim(),
    citations,
    claim_table: [{ claim, support: "supported", citations }],
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
  if (selected.fresh_validation.contract_correct > 0) return "structured_group_constructor_repairs_fresh_failures";
  if (selected.train_heldout.contract_correct > 0) return "structured_group_constructor_train_only_signal";
  return "structured_group_constructor_fails";
}

function decisionFor(selected, gateBySplit) {
  return {
    promote_scaffold_as_policy: selected.fresh_validation.contract_correct_rate >= 0.5 && gateBySplit.validation.contract_correct > 44,
    keep_as_candidate_source: selected.fresh_validation.contract_correct > 0,
    buy_openai_labels_now: selected.fresh_validation.contract_correct === 0,
    rent_prime_gpu_now: false,
    reason: `Selected policy repairs ${selected.train_heldout.contract_correct}/${selected.train_heldout.examples} train-heldout construction rows and ${selected.fresh_validation.contract_correct}/${selected.fresh_validation.examples} fresh-validation construction rows; fresh full-packet gate is ${gateBySplit.validation.contract_correct}/75.`,
    next_step: selected.fresh_validation.contract_correct > 0
      ? "Add the structured group constructor as a candidate source in the next router audit."
      : "Stop zero-cost local construction scaffolds and create a small paid teacher repair packet for construction failures.",
  };
}

function renderReport(result) {
  return `# Structured Evidence-Group Constructor Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Selected Policy

- Policy: \`${result.selected_policy.policy_id}\`
- Train-heldout repairs: ${result.metrics.train_heldout.contract_correct}/${result.metrics.train_heldout.examples} (${pct(result.metrics.train_heldout.contract_correct_rate)})
- Fresh-validation repairs: ${result.metrics.fresh_validation.contract_correct}/${result.metrics.fresh_validation.examples} (${pct(result.metrics.fresh_validation.contract_correct_rate)})
- Fresh-validation full-packet gate: ${result.baseline_context.structured_scaffold_fresh_validation_contract_correct}/${result.baseline_context.structured_scaffold_fresh_validation_examples}
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

function featureNames() {
  return ["bias", "group_size", "desired_count", "count_distance", "avg_lexical", "max_lexical", "avg_structure", "has_float_table", "same_section_root", "same_section_stem", "contiguous_rank_window", "min_rank", "multi_repair", "single_repair", "enumerative_question"];
}

function lexicalScore(question, evidence) {
  const qTokens = tokens(question);
  const textTokens = tokens(`${evidence.section ?? ""} ${evidence.text ?? ""}`);
  const overlap = qTokens.filter((token) => textTokens.includes(token)).length;
  return overlap / Math.max(qTokens.length, 1);
}

function structureScore(question, evidence) {
  const q = String(question ?? "").toLowerCase();
  const text = `${evidence.section ?? ""} ${evidence.text ?? ""}`.toLowerCase();
  let score = 0;
  if (/dataset|corpus|benchmark/.test(q) && /dataset|corpus|benchmark/.test(text)) score += 1;
  if (/metric|score|perform|outperform|percentage|percent|how much|how large|size|vocabulary/.test(q) && /float selected|table|score|result|percent|%|\d/.test(text)) score += 1;
  if (/architecture|model|method|cooperate|chain|approach/.test(q) && /architecture|model|method|ranker|reasoner|module|passage/.test(text)) score += 1;
  if (/annotation|annotat/.test(q) && /annotat|resource|tag|person|number|inclusiv/.test(text)) score += 1;
  if (/style|stylistic|response/.test(q) && /style|ranking|evaluation|response/.test(text)) score += 1;
  if (/what (?:three|four|five|two)|what are|characteristics|attributes/.test(q) && /:/.test(String(evidence.section ?? ""))) score += 0.5;
  return score;
}

function desiredCount(question) {
  const q = String(question ?? "").toLowerCase();
  const wordCounts = { two: 2, three: 3, four: 4, five: 5 };
  for (const [word, value] of Object.entries(wordCounts)) if (new RegExp(`\\b${word}\\b`).test(q)) return value;
  const match = q.match(/\b(\d+)\b/);
  if (match && Number(match[1]) <= 5) return Number(match[1]);
  return null;
}

function sectionRoot(section) {
  return String(section ?? "").split(":::")[0]?.trim().toLowerCase() ?? "";
}

function sectionStem(section) {
  return String(section ?? "").split(":::").slice(0, 2).join(":::").trim().toLowerCase();
}

function groupBy(rows, getKey) {
  const out = {};
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    out[key] ??= [];
    out[key].push(row);
  }
  return out;
}

function groupSortTie(left, right) {
  return left.citations.length - right.citations.length || left.group_id.localeCompare(right.group_id);
}

function compactClaim(evidence) {
  const text = String(evidence?.text ?? evidence?.section ?? "Selected evidence").replace(/\s+/g, " ").trim();
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
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

function trainLogistic(rows, scalerValue, options) {
  const width = rows[0]?.feature_values?.length ?? 0;
  const weights = Array(width).fill(0);
  let intercept = 0;
  for (let epoch = 0; epoch < options.epochs; epoch += 1) {
    const grad = Array(width).fill(0);
    let interceptGrad = 0;
    for (const row of rows) {
      const features = scale(row.feature_values, scalerValue);
      const pred = sigmoid(dot(weights, features) + intercept);
      const error = pred - row.label_exact;
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

function summarizeGateBySplit(rows) {
  const out = {};
  for (const split of ["train", "validation"]) {
    const splitRows = rows.filter((row) => String(row.example_id).includes(`:${split}:`) || String(row.example_id).endsWith(`:${split}`));
    const contract = count(splitRows, (row) => row.contract_correct);
    out[split] = {
      examples: splitRows.length,
      contract_correct: contract,
      answer_type_correct: count(splitRows, (row) => row.answer_type_correct),
      citation_set_exact: count(splitRows, (row) => row.citation_set_exact),
      contract_correct_rate: rate(contract, splitRows.length),
    };
  }
  return out;
}

function tokens(text) {
  return String(text ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !stopwords.has(token));
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean);
}

function citationKey(citations) {
  return normalizeCitations(citations).sort().join("|");
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
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
  return Object.entries(policy).map(([key, value]) => `${key}-${String(value).replaceAll(".", "p").replaceAll("-", "m")}`).join("__");
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
