import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const runId = "question-target-label-batch-plan-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const frontierMiningRunId = "frontier-target-completeness-mining-audit-0-320-to-321-389-2026-06-28-v1";
const modelForEstimate = "gpt-4o-mini";
const pricingSourceUrl = "https://developers.openai.com/api/docs/models/gpt-4o-mini";
const inputUsdPerMillionTokens = 0.15;
const outputUsdPerMillionTokens = 0.60;
const expectedOutputTokensPerCall = 450;
const duplicateCalibrationCalls = 8;

await fs.mkdir(outputDir, { recursive: true });

const miningResult = await readJson(path.join(runsDir, frontierMiningRunId, "result.json"));
const targetRows = await readJsonl(path.join(runsDir, frontierMiningRunId, "frontier_target_completeness_rows.jsonl"));
const frontierPairs = await readJsonl(path.join(runsDir, "qwen-frontier-pool-support-packet-2026-06-28-v1", "frontier_contrast_pairs.jsonl"));
const pairById = new Map(frontierPairs.map((row) => [row.pair_id, row]));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const prioritizedRows = [...targetRows].sort((left, right) =>
  priorityScore(right) - priorityScore(left)
  || Number(left.source_index) - Number(right.source_index)
  || left.pair_id.localeCompare(right.pair_id)
);
const primaryRequests = prioritizedRows.map((row, index) => labelRequest(row, index, false));
const calibrationRequests = prioritizedRows.slice(0, duplicateCalibrationCalls).map((row, index) => labelRequest(row, index, true));
const requests = [...primaryRequests, ...calibrationRequests];
const estimatedCalls = requests.map((request) => estimateCall(request));
const totalEstimated = summarizeEstimates(estimatedCalls);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "question_target_label_batch_plan",
  status: "targeted_label_batch_ready_below_budget",
  purpose: "Prepare a small targeted OpenAI judge batch for question-target completeness hard negatives after D307 showed existing judged data is too sparse.",
  source_runs: {
    frontier_target_completeness_mining: frontierMiningRunId,
  },
  d307_context: {
    frontier_pair_rows: miningResult.frontier_packet?.frontier_pair_rows,
    frontier_target_rows: miningResult.frontier_packet?.target_rows,
    focus_guard_hard_negative_rows: miningResult.frontier_packet?.focus_guard_hard_negative_rows,
    coverage_guard_hard_negative_rows: miningResult.frontier_packet?.coverage_guard_hard_negative_rows,
  },
  batch_plan: {
    primary_label_requests: primaryRequests.length,
    duplicate_calibration_requests: calibrationRequests.length,
    total_label_requests: requests.length,
    train_requests: primaryRequests.filter((row) => row.metadata.train_split === "train").length,
    validation_requests: primaryRequests.filter((row) => row.metadata.train_split === "validation").length,
    selected_from_frontier_target_rows: targetRows.length,
    selection_policy: "Label every existing frontier target row because the total estimated cost is small; duplicate the top-priority eight rows for calibration.",
    label_schema: {
      chosen_question_target_complete: "boolean",
      rejected_question_target_complete: "boolean",
      rejected_failure_mode: ["complete_supported", "entailed_but_incomplete", "entailed_but_wrong_target", "unsupported_claim", "citation_mismatch", "other"],
      preferred_for_grounded_answer: ["chosen", "rejected", "tie", "abstain"],
      rationale: "short string",
    },
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
    next_step: "Run this targeted label batch only after confirming the API key is available through the macOS secret helper; do not rent GPU until labels show the target-completeness verifier is trainable.",
    reason: `The planned ${requests.length}-call batch is estimated at $${totalEstimated.cost_usd.toFixed(4)} before a 2x safety factor, well inside the remaining budget, and directly targets the missing hard-negative type.`,
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    request_rows_source: "existing_nonfinal_frontier_target_rows",
    duplicate_calibration_rows_training_use: "calibration_only_until_agreement_checked",
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
    note: "Planning artifact only. No API calls were made.",
  },
};

await writeJsonl(path.join(outputDir, "candidate_label_requests.jsonl"), requests);
await writeJsonl(path.join(outputDir, "estimated_calls.jsonl"), estimatedCalls);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  batch_plan: result.batch_plan,
  cost_estimate: result.cost_estimate,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function labelRequest(row, index, duplicate) {
  const pair = pairById.get(row.pair_id);
  if (!pair) throw new Error(`Missing source frontier pair for ${row.pair_id}`);
  const requestId = duplicate
    ? `qt-completeness-calibration-${String(index + 1).padStart(3, "0")}`
    : `qt-completeness-primary-${String(index + 1).padStart(3, "0")}`;
  return {
    request_id: requestId,
    model: modelForEstimate,
    task: "question_target_completeness_judgment",
    metadata: {
      pair_id: row.pair_id,
      root_example_id: row.root_example_id,
      source_index: row.source_index,
      train_split: row.train_split,
      contrast_type: row.contrast_type,
      duplicate_calibration: duplicate,
      priority_score: priorityScore(row),
      tags: row.tags,
      training_use: duplicate ? "calibration_only_until_agreement_checked" : "planned_nonfinal_question_target_label",
    },
    input: {
      instruction: [
        "Judge whether each candidate answers the exact question target using only the evidence pack.",
        "Do not reward an answer merely because one claim is entailed; it must answer the asked target at the right scope, quantity, entity/list, comparison, and condition.",
        "Return JSON only with the requested schema.",
      ].join(" "),
      question: pair.input?.question ?? null,
      evidence_pack: compactEvidence(pair),
      candidate_chosen: candidatePayload(row.chosen, pair.chosen),
      candidate_rejected: candidatePayload(row.rejected, pair.rejected),
      output_schema: {
        chosen_question_target_complete: "boolean",
        rejected_question_target_complete: "boolean",
        rejected_failure_mode: "complete_supported | entailed_but_incomplete | entailed_but_wrong_target | unsupported_claim | citation_mismatch | other",
        preferred_for_grounded_answer: "chosen | rejected | tie | abstain",
        rationale: "one short sentence",
      },
    },
  };
}

function priorityScore(row) {
  const tags = new Set(row.tags ?? []);
  return 100 * (tags.has("focus_guard_hard_negative") ? 1 : 0)
    + 80 * (tags.has("coverage_guard_hard_negative") ? 1 : 0)
    + 50 * (tags.has("unsupported_high_entailment") ? 1 : 0)
    + 20 * (tags.has("question_overlap_not_lower") ? 1 : 0)
    + 10 * (tags.has("coverage_not_lower") ? 1 : 0)
    + 5 * (tags.has("answer_length_not_lower") ? 1 : 0)
    + Math.min(4, Number(row.rejected?.unsupported_claim_count ?? 0));
}

function compactEvidence(pair) {
  const pack = pair.input?.compact_retrieved_evidence_pack ?? [];
  return pack.slice(0, 6).map((evidence) => ({
    evidence_id: evidence.evidence_id,
    section: evidence.section,
    text: preview(evidence.text, 900),
  }));
}

function candidatePayload(candidate, fullCandidate) {
  const answer = String(fullCandidate.answer ?? candidate.answer_preview ?? "").trim();
  return {
    answer: answer || "[empty answer]",
    answer_type: fullCandidate.answer_type ?? null,
    abstention_reason: fullCandidate.abstention_reason ?? null,
    family: candidate.family,
    citations: fullCandidate.citations ?? [],
    claim_table: fullCandidate.claim_table ?? [],
    claim_count: candidate.claim_count,
    citation_count: candidate.citation_count,
    unsupported_claim_count: candidate.unsupported_claim_count,
    nli_entailment_min: candidate.nli_entailment_min,
    question_overlap: candidate.question_overlap,
    question_recall: candidate.question_recall,
  };
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

function preview(text, limit) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function renderReport(result) {
  return `# Question-Target Label Batch Plan

Generated: ${result.generated_at}

Status: \`${result.status}\`

This is a planning artifact only. It makes no API calls and launches no compute.

## Batch

- Primary requests: ${result.batch_plan.primary_label_requests}
- Calibration duplicate requests: ${result.batch_plan.duplicate_calibration_requests}
- Total requests: ${result.batch_plan.total_label_requests}
- Train requests: ${result.batch_plan.train_requests}
- Validation requests: ${result.batch_plan.validation_requests}

## Cost

- Model: ${result.cost_estimate.model}
- Pricing source: ${result.cost_estimate.pricing_source_url}
- Estimated cost: $${result.cost_estimate.estimated_cost_usd.toFixed(4)}
- Estimated cost with 2x safety: $${result.cost_estimate.estimated_cost_with_2x_safety_usd.toFixed(4)}
- Keeps total under $100: ${result.cost_estimate.would_keep_total_under_100_usd ? "yes" : "no"}

## Decision

- Run label batch now: ${result.decision.run_label_batch_now ? "yes" : "no"}
- Ask for secret now: ${result.decision.ask_for_secret_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}
