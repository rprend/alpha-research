import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const runId = "high-score-support-label-batch-plan-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const packetRunId = "high-score-unsupported-packet-audit-0-320-to-321-389-2026-06-28-v1";
const splitStressRunId = "support-discrimination-split-stress-audit-0-320-to-321-389-2026-06-28-v1";
const integrationRunId = "listwise-selector-integration-final-window-2026-06-28-v1";
const modelForEstimate = "gpt-4o-mini";
const pricingSourceUrl = "https://developers.openai.com/api/pricing";
const inputUsdPerMillionTokens = 0.15;
const outputUsdPerMillionTokens = 0.60;
const expectedOutputTokensPerCall = 520;
const nonfinalTrainingTargets = 48;
const finalValidationTargets = 24;
const duplicateCalibrationCalls = 8;

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const packetResult = await readJson(path.join(runsDir, packetRunId, "result.json"));
const stressResult = await readJson(path.join(runsDir, splitStressRunId, "result.json"));
const packetRows = await readJsonl(path.join(runsDir, packetRunId, "packet_rows.jsonl"));
const finalRows = await readJsonl(path.join(runsDir, integrationRunId, "rows_with_listwise_scores.jsonl"));
const exampleIndex = await buildExampleIndex();

const nonfinalSelected = selectNonfinalTrainingRows(packetRows, nonfinalTrainingTargets);
const finalSelected = selectFinalValidationRows(finalRows, finalValidationTargets);
const calibrationRows = [...nonfinalSelected.slice(0, 4), ...finalSelected.slice(0, 4)];
const requests = [
  ...nonfinalSelected.map((row, index) => nonfinalRequest(row, index, false)),
  ...finalSelected.map((row, index) => finalRequest(row, index, false)),
  ...calibrationRows.map((row, index) => row.kind === "final" ? finalRequest(row, index, true) : nonfinalRequest(row, index, true)),
];
const estimatedCalls = requests.map(estimateCall);
const totalEstimated = summarizeEstimates(estimatedCalls);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "high_score_support_label_batch_plan",
  status: "high_score_support_label_batch_ready_below_budget",
  purpose: "Plan a targeted support-adjudication batch for high-scoring unsupported answers after existing non-final splits selected anti-transfer policies.",
  source_runs: {
    high_score_unsupported_packet_audit: packetRunId,
    support_discrimination_split_stress_audit: splitStressRunId,
    listwise_selector_integration: integrationRunId,
  },
  d347_context: {
    split_stress_status: stressResult.status,
    original_selected_final_accuracy: stressResult.comparison?.original_selected_final_accuracy,
    late_selected_final_accuracy: stressResult.comparison?.late_selected_final_accuracy,
    diagnostic_best_final_accuracy: stressResult.comparison?.diagnostic_best_final_accuracy,
    packet_rows: packetResult.data?.packet_rows,
    final_analog_rows: packetResult.data?.final_analog_rows,
  },
  batch_plan: {
    nonfinal_training_requests: nonfinalSelected.length,
    final_validation_only_requests: finalSelected.length,
    duplicate_calibration_requests: calibrationRows.length,
    total_label_requests: requests.length,
    selection_policy: "Select diverse high-score unsupported-answer contrasts. Non-final rows are future training/validation candidates; final-window analog rows are validation/adjudication-only and cannot train or select deployable policies.",
    label_schema: {
      rejected_answer_supported: "boolean",
      rejected_failure_mode: ["fully_supported", "missing_direct_evidence", "wrong_question_target", "overbroad_or_overclaimed", "numeric_or_comparison_error", "citation_mismatch", "evidence_insufficient", "other"],
      preferred_candidate: ["chosen", "rejected", "abstain", "tie"],
      support_discriminator_hint: ["shorter_supported_shape", "numeric_comparative_penalty", "citation_density", "question_overlap", "none_or_other"],
      rationale: "short string",
    },
  },
  request_mix: {
    nonfinal_by_question_type: countBy(nonfinalSelected, "question_type"),
    final_by_question_type: countBy(finalSelected, "question_type"),
    final_by_rejected_family: countBy(finalSelected, "rejected_family"),
    nonfinal_unique_examples: new Set(nonfinalSelected.map((row) => row.example_id)).size,
    final_unique_examples: new Set(finalSelected.map((row) => row.example_id)).size,
  },
  cost_estimate: {
    model: modelForEstimate,
    pricing_source_url: pricingSourceUrl,
    input_usd_per_million_tokens: inputUsdPerMillionTokens,
    output_usd_per_million_tokens: outputUsdPerMillionTokens,
    expected_output_tokens_per_call: expectedOutputTokensPerCall,
    estimated_input_tokens: totalEstimated.input_tokens,
    estimated_output_tokens: totalEstimated.output_tokens,
    estimated_cost_usd: totalEstimated.cost_usd,
    estimated_cost_with_2x_safety_usd: totalEstimated.cost_usd * 2,
    would_keep_total_under_100_usd: budget.spend_usd.total_actual + totalEstimated.cost_usd * 2 < budget.max_budget_usd,
  },
  decision: {
    run_label_batch_now: false,
    ask_for_secret_now: false,
    launch_gpu_now: false,
    next_step: "If we decide to spend, run this batch with the macOS secret helper and then use non-final rows for support-discriminator training while keeping final rows validation/adjudication-only.",
    reason: `The planned ${requests.length}-call batch targets the exact anti-transfer failure and costs about $${totalEstimated.cost_usd.toFixed(4)} before a 2x safety factor.`,
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_request_training_use: "validation_adjudication_only",
    nonfinal_request_training_use: "eligible_after_agreement_check",
    duplicate_calibration_rows_training_use: "calibration_only_until_agreement_checked",
    run_is_planning_only: true,
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    planned_openai_cost_usd: totalEstimated.cost_usd,
    planned_openai_cost_with_2x_safety_usd: totalEstimated.cost_usd * 2,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "Planning artifact only. No API calls were made and no compute was launched.",
  },
};

await writeJsonl(path.join(outputDir, "nonfinal_selected_rows.jsonl"), nonfinalSelected);
await writeJsonl(path.join(outputDir, "final_validation_selected_rows.jsonl"), finalSelected);
await writeJsonl(path.join(outputDir, "candidate_label_requests.jsonl"), requests);
await writeJsonl(path.join(outputDir, "estimated_calls.jsonl"), estimatedCalls);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  batch_plan: result.batch_plan,
  request_mix: result.request_mix,
  cost_estimate: result.cost_estimate,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function selectNonfinalTrainingRows(rows, target) {
  const sorted = [...rows].sort((left, right) =>
    nonfinalPriority(right) - nonfinalPriority(left)
    || String(left.example_id).localeCompare(String(right.example_id))
    || String(left.rejected?.candidate_id).localeCompare(String(right.rejected?.candidate_id))
  );
  return selectDiverse(sorted, target, (row) => row.example_id, 4).map((row) => ({
    ...row,
    kind: "nonfinal",
    training_use: "eligible_after_agreement_check",
  }));
}

function selectFinalValidationRows(rows, target) {
  const hard = [];
  for (const row of rows) {
    const reference = exampleIndex.get(row.example_id);
    const positives = row.candidates.filter((candidate) => candidate.supported_answer || candidate.supported_abstention);
    const rejected = row.candidates
      .filter((candidate) => candidate.prediction?.answer_type === "grounded_answer")
      .filter((candidate) => Number(candidate.listwise_selector?.score ?? -Infinity) >= 1.4)
      .filter((candidate) => candidate.supported_answer !== true)
      .sort((left, right) => Number(right.listwise_selector?.score ?? 0) - Number(left.listwise_selector?.score ?? 0));
    for (const candidate of rejected) {
      const chosen = choosePositiveAlternative(positives);
      if (!chosen) continue;
      hard.push({
        kind: "final",
        example_id: row.example_id,
        question: row.question,
        question_type: inferQuestionType(row.question),
        rejected_candidate_id: candidate.id,
        rejected_family: candidate.family,
        rejected_score: candidate.listwise_selector?.score ?? null,
        rejected_prediction: candidate.prediction,
        chosen_candidate_id: chosen.id,
        chosen_family: chosen.family,
        chosen_prediction: chosen.prediction,
        chosen_supported_answer: chosen.supported_answer,
        chosen_supported_abstention: chosen.supported_abstention,
        paper_id: row.example_id.split(":")[0],
        source_split: reference?.source_split ?? "extended_temporal_future_holdout",
        training_use: "validation_adjudication_only",
      });
    }
  }
  const sorted = hard.sort((left, right) =>
    finalPriority(right) - finalPriority(left)
    || String(left.example_id).localeCompare(String(right.example_id))
    || String(left.rejected_candidate_id).localeCompare(String(right.rejected_candidate_id))
  );
  return selectDiverse(sorted, target, (row) => row.example_id, 2);
}

function choosePositiveAlternative(candidates) {
  return [...candidates].sort((left, right) =>
    Number(right.supported_answer === true) - Number(left.supported_answer === true)
    || Number(right.contract?.answer_citation_complete === true) - Number(left.contract?.answer_citation_complete === true)
    || String(left.id).localeCompare(String(right.id))
  )[0] ?? null;
}

function nonfinalRequest(row, index, duplicate) {
  const reference = exampleIndex.get(row.example_id);
  const requestId = duplicate
    ? `hs-support-nonfinal-calibration-${String(index + 1).padStart(3, "0")}`
    : `hs-support-nonfinal-primary-${String(index + 1).padStart(3, "0")}`;
  return {
    request_id: requestId,
    model: modelForEstimate,
    task: "high_score_support_adjudication",
    metadata: {
      example_id: row.example_id,
      source: "nonfinal_high_score_packet",
      question_type: row.question_type,
      duplicate_calibration: duplicate,
      training_use: duplicate ? "calibration_only_until_agreement_checked" : "eligible_after_agreement_check",
    },
    input: requestInput({
      question: row.question,
      evidence_pack: reference?.input?.compact_retrieved_evidence_pack ?? [],
      chosen: row.chosen,
      rejected: row.rejected,
      context_note: "This is a non-final high-score unsupported-answer contrast. Judge with evidence only.",
    }),
  };
}

function finalRequest(row, index, duplicate) {
  const reference = exampleIndex.get(row.example_id);
  const requestId = duplicate
    ? `hs-support-final-calibration-${String(index + 1).padStart(3, "0")}`
    : `hs-support-final-validation-${String(index + 1).padStart(3, "0")}`;
  return {
    request_id: requestId,
    model: modelForEstimate,
    task: "high_score_support_adjudication",
    metadata: {
      example_id: row.example_id,
      source: "final_analog_validation_only",
      question_type: row.question_type,
      rejected_candidate_id: row.rejected_candidate_id,
      duplicate_calibration: duplicate,
      training_use: duplicate ? "calibration_only_until_agreement_checked" : "validation_adjudication_only",
    },
    input: requestInput({
      question: row.question,
      evidence_pack: reference?.input?.compact_retrieved_evidence_pack ?? [],
      chosen: predictionCandidate(row.chosen_candidate_id, row.chosen_family, row.chosen_prediction),
      rejected: predictionCandidate(row.rejected_candidate_id, row.rejected_family, row.rejected_prediction),
      context_note: "This final-window analog is validation/adjudication-only. Do not use it for future training or model selection.",
    }),
  };
}

function requestInput({ question, evidence_pack, chosen, rejected, context_note }) {
  return {
    instruction: [
      "Judge whether the rejected high-scoring answer is fully supported by the cited evidence and whether the chosen alternative is preferable.",
      "Use only the evidence pack. Penalize wrong target, overbroad claims, numeric/comparison errors, and citation mismatch.",
      "Return JSON only with the requested schema.",
    ].join(" "),
    context_note,
    question,
    evidence_pack: compactEvidence(evidence_pack),
    candidate_chosen: candidatePayload(chosen),
    candidate_rejected: candidatePayload(rejected),
    output_schema: {
      rejected_answer_supported: "boolean",
      rejected_failure_mode: "fully_supported | missing_direct_evidence | wrong_question_target | overbroad_or_overclaimed | numeric_or_comparison_error | citation_mismatch | evidence_insufficient | other",
      preferred_candidate: "chosen | rejected | abstain | tie",
      support_discriminator_hint: "shorter_supported_shape | numeric_comparative_penalty | citation_density | question_overlap | none_or_other",
      rationale: "one short sentence",
    },
  };
}

function candidatePayload(candidate) {
  const prediction = candidate.prediction ?? candidate;
  return {
    candidate_id: candidate.candidate_id ?? candidate.id,
    family: candidate.family,
    answer_type: prediction.answer_type,
    answer: preview(prediction.answer ?? candidate.answer ?? "", 1200),
    citations: prediction.citations ?? candidate.citations ?? [],
    claim_table: prediction.claim_table ?? [],
    inline_complete: candidate.inline_complete ?? null,
    question_overlap: candidate.question_overlap ?? null,
    claim_count: candidate.claim_count ?? null,
    answer_tokens: candidate.answer_tokens ?? null,
  };
}

function predictionCandidate(candidateId, family, prediction) {
  return {
    candidate_id: candidateId,
    family,
    prediction,
  };
}

async function buildExampleIndex() {
  const index = new Map();
  const files = (await fs.readdir(dataDir)).filter((file) => file.endsWith(".jsonl"));
  for (const file of files) {
    const rows = await readJsonl(path.join(dataDir, file));
    for (const row of rows) {
      if (!index.has(row.example_id)) index.set(row.example_id, row);
    }
  }
  return index;
}

function selectDiverse(rows, target, keyFn, maxPerKey) {
  const selected = [];
  const counts = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const count = counts.get(key) ?? 0;
    if (count >= maxPerKey) continue;
    selected.push(row);
    counts.set(key, count + 1);
    if (selected.length >= target) break;
  }
  return selected;
}

function nonfinalPriority(row) {
  return Number(row.rejected_score ?? 0)
    + 0.5 * (row.question_type === "numeric" || row.question_type === "comparison" ? 1 : 0)
    + 0.25 * (row.question_type === "list_or_entity" ? 1 : 0)
    + 0.2 * (row.rejected?.label_summary?.target_incomplete ? 1 : 0)
    + 0.1 * Math.log1p(Number(row.rejected?.claim_count ?? 0));
}

function finalPriority(row) {
  return Number(row.rejected_score ?? 0)
    + 0.5 * (row.question_type === "numeric" || row.question_type === "comparison" ? 1 : 0)
    + 0.25 * (row.question_type === "list_or_entity" ? 1 : 0)
    + 0.1 * (row.rejected_family === "openai_mini_scaffold" ? 1 : 0);
}

function compactEvidence(pack) {
  return (pack ?? []).slice(0, 6).map((evidence) => ({
    evidence_id: evidence.evidence_id,
    section: evidence.section,
    text: preview(evidence.text, 900),
  }));
}

function estimateCall(request) {
  const serialized = JSON.stringify(request.input);
  const inputTokens = Math.ceil(serialized.length / 4);
  const outputTokens = expectedOutputTokensPerCall;
  const costUsd = (inputTokens / 1_000_000) * inputUsdPerMillionTokens
    + (outputTokens / 1_000_000) * outputUsdPerMillionTokens;
  return {
    request_id: request.request_id,
    model: request.model,
    estimated_input_tokens: inputTokens,
    estimated_output_tokens: outputTokens,
    estimated_cost_usd: costUsd,
  };
}

function summarizeEstimates(rows) {
  return {
    input_tokens: rows.reduce((sum, row) => sum + row.estimated_input_tokens, 0),
    output_tokens: rows.reduce((sum, row) => sum + row.estimated_output_tokens, 0),
    cost_usd: rows.reduce((sum, row) => sum + row.estimated_cost_usd, 0),
  };
}

function inferQuestionType(question) {
  const q = String(question ?? "").toLowerCase();
  if (/^(is|are|was|were|does|do|did|can|could|has|have|had)\b/.test(q)) return "yes_no";
  if (/\b(how many|number|percentage|percent|score|rate)\b/.test(q)) return "numeric";
  if (/\b(compare|better|worse|higher|lower|versus|vs)\b/.test(q)) return "comparison";
  if (/\b(which|what)\b/.test(q)) return "factoid";
  return "method_or_explanation";
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) counts[row[key] ?? "missing"] = (counts[row[key] ?? "missing"] ?? 0) + 1;
  return counts;
}

function preview(text, maxChars) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > maxChars ? `${clean.slice(0, maxChars - 1)}…` : clean;
}

function renderReport(result) {
  return `# High-Score Support Label Batch Plan

Generated: ${result.generated_at}

Status: \`${result.status}\`

This is a planning artifact. It makes no API calls and launches no compute.

## Batch

- Non-final training-eligible requests: ${result.batch_plan.nonfinal_training_requests}
- Final validation-only requests: ${result.batch_plan.final_validation_only_requests}
- Duplicate calibration requests: ${result.batch_plan.duplicate_calibration_requests}
- Total planned requests: ${result.batch_plan.total_label_requests}

## Cost

- Model: \`${result.cost_estimate.model}\`
- Estimated cost: $${result.cost_estimate.estimated_cost_usd.toFixed(4)}
- Estimated cost with 2x safety: $${result.cost_estimate.estimated_cost_with_2x_safety_usd.toFixed(4)}
- Remaining budget: $${result.budget.remaining_budget_usd.toFixed(4)}

## Decision

- Run label batch now: ${result.decision.run_label_batch_now ? "yes" : "no"}
- Ask for secret now: ${result.decision.ask_for_secret_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
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
