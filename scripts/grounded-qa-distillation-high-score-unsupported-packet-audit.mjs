import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const runId = "high-score-unsupported-packet-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const listwisePacketRunId = "listwise-supervision-packet-audit-0-320-2026-06-28-v1";
const constrainedRunId = "coverage-constrained-listwise-selector-audit-0-320-to-321-389-2026-06-28-v1";
const integrationRunId = "listwise-selector-integration-final-window-2026-06-28-v1";
const threshold = 1.4;

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const examples = await readJsonl(path.join(runsDir, listwisePacketRunId, "listwise_examples.jsonl"));
const constrained = await readJson(path.join(runsDir, constrainedRunId, "result.json"));
const finalRows = await readJsonl(path.join(runsDir, integrationRunId, "rows_with_listwise_scores.jsonl"));
const baseWeights = constrained.selected_by_validation.policy;

const packetRows = buildPacketRows(examples);
const finalAnalogRows = buildFinalAnalogRows(finalRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "high_score_unsupported_packet_audit",
  status: statusFor(packetRows),
  purpose: "Mine existing non-final labels for high-scoring unsupported direct answers that defeat coverage-constrained listwise selection.",
  source_runs: {
    listwise_supervision_packet_audit: listwisePacketRunId,
    coverage_constrained_listwise_selector_audit: constrainedRunId,
    listwise_selector_integration: integrationRunId,
  },
  threshold,
  data: summarizePacket(packetRows, finalAnalogRows),
  decision: decisionFromResult(packetRows),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_profile: true,
    nonfinal_training_packet_only: true,
    unsupported_claim_labels_used_for_training_targets: true,
    unsupported_claim_labels_used_for_deployable_scoring: false,
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "Zero-call mining audit over existing judged labels.",
  },
  artifacts: {
    packet_rows_jsonl: rel(path.join(outputDir, "packet_rows.jsonl")),
    final_analog_rows_jsonl: rel(path.join(outputDir, "final_analog_rows.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "packet_rows.jsonl"), packetRows);
await writeJsonl(path.join(outputDir, "final_analog_rows.jsonl"), finalAnalogRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  data: result.data,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function buildPacketRows(rows) {
  const out = [];
  for (const example of rows) {
    const positives = example.candidates.filter((candidate) => candidate.label_summary?.train_positive);
    const hardNegatives = example.candidates
      .filter((candidate) => candidate.answer_type === "grounded_answer")
      .map((candidate) => ({ ...candidate, high_score_unsupported_score: packetScore(candidate) }))
      .filter((candidate) => candidate.high_score_unsupported_score >= threshold)
      .filter((candidate) => candidate.label_summary?.train_negative)
      .filter((candidate) => candidate.label_summary?.unsafe_answer);
    for (const negative of hardNegatives) {
      for (const positive of positives) {
        out.push({
          row_id: `${example.example_id}:${positive.candidate_id}:over:${negative.candidate_id}`,
          example_id: example.example_id,
          source_index: example.source_index,
          split: example.split,
          question: example.question,
          question_type: example.question_type,
          chosen: compactCandidate(positive),
          rejected: compactCandidate(negative),
          rejected_score: negative.high_score_unsupported_score,
          training_use: "nonfinal_high_score_unsupported_answer_contrast",
        });
      }
    }
  }
  return out;
}

function buildFinalAnalogRows(rows) {
  const out = [];
  for (const row of rows) {
    const positives = row.candidates.filter((candidate) => candidate.supported_answer || candidate.supported_abstention);
    const hardNegatives = row.candidates
      .filter((candidate) => candidate.prediction?.answer_type === "grounded_answer")
      .filter((candidate) => Number(candidate.listwise_selector?.score ?? -Infinity) >= threshold)
      .filter((candidate) => candidate.supported_answer !== true);
    for (const negative of hardNegatives) {
      out.push({
        example_id: row.example_id,
        rejected_candidate_id: negative.id,
        rejected_family: negative.family,
        rejected_score: negative.listwise_selector?.score ?? null,
        positive_alternative_count: positives.length,
        has_supported_answer_alternative: positives.some((candidate) => candidate.supported_answer),
        has_supported_abstention_alternative: positives.some((candidate) => candidate.supported_abstention),
        reporting_only: true,
      });
    }
  }
  return out;
}

function packetScore(candidate) {
  const base = (
    0.8 * (candidate.inline_complete ? 1 : 0)
    + 0.2 * (candidate.answer_type === "grounded_answer" ? 1 : 0)
    + 0.15 * Math.log1p((candidate.citations ?? []).length)
    + 0.3 * Number(candidate.question_overlap ?? 0)
    - 0.45 * (String(candidate.family ?? "").startsWith("qwen") ? 1 : 0)
    + 0.2 * (String(candidate.family ?? "").includes("openai") ? 1 : 0)
    + 0.04 * (candidate.answer_type === "abstain" ? 1 : 0)
    + 0.02 * Math.log1p(Number(candidate.claim_count ?? 0))
    + 0.01 * Math.log1p(Number(candidate.answer_tokens ?? 0))
  );
  return base
    - Number(baseWeights.answerPenalty ?? 0) * (candidate.answer_type === "grounded_answer" ? 1 : 0)
    + Number(baseWeights.abstainBonus ?? 0) * (candidate.answer_type !== "grounded_answer" ? 1 : 0);
}

function compactCandidate(candidate) {
  return {
    candidate_id: candidate.candidate_id,
    family: candidate.family,
    answer_type: candidate.answer_type,
    answer: candidate.answer,
    citations: candidate.citations ?? [],
    claim_count: candidate.claim_count ?? null,
    answer_tokens: candidate.answer_tokens ?? null,
    inline_complete: candidate.inline_complete ?? null,
    question_overlap: candidate.question_overlap ?? null,
    label_summary: candidate.label_summary ?? null,
  };
}

function summarizePacket(packetRows, finalAnalogRows) {
  const trainRows = packetRows.filter((row) => row.split === "train");
  const validationRows = packetRows.filter((row) => row.split === "validation");
  return {
    packet_rows: packetRows.length,
    train_rows: trainRows.length,
    validation_rows: validationRows.length,
    unique_examples: new Set(packetRows.map((row) => row.example_id)).size,
    unique_train_examples: new Set(trainRows.map((row) => row.example_id)).size,
    unique_validation_examples: new Set(validationRows.map((row) => row.example_id)).size,
    high_score_unsupported_candidates: new Set(packetRows.map((row) => `${row.example_id}:${row.rejected.candidate_id}`)).size,
    final_analog_rows: finalAnalogRows.length,
    final_analog_examples: new Set(finalAnalogRows.map((row) => row.example_id)).size,
    final_analog_with_supported_alternative: finalAnalogRows.filter((row) => row.positive_alternative_count > 0).length,
  };
}

function statusFor(packetRows) {
  const trainExamples = new Set(packetRows.filter((row) => row.split === "train").map((row) => row.example_id)).size;
  const validationExamples = new Set(packetRows.filter((row) => row.split === "validation").map((row) => row.example_id)).size;
  return trainExamples >= 10 && validationExamples >= 10
    ? "high_score_unsupported_packet_ready"
    : "high_score_unsupported_packet_sparse";
}

function decisionFromResult(packetRows) {
  return {
    build_selector_features_next: true,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    reason: statusFor(packetRows) === "high_score_unsupported_packet_ready"
      ? "Existing non-final labels contain enough high-scoring unsupported-answer contrasts to build a support-discrimination feature audit before buying labels."
      : "The packet is too sparse and would require targeted labels before selector training.",
  };
}

function renderReport(result) {
  return `# High-Score Unsupported Packet Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no API calls and launches no compute.

## Data

- Packet rows: ${result.data.packet_rows}
- Train rows: ${result.data.train_rows}
- Validation rows: ${result.data.validation_rows}
- Unique examples: ${result.data.unique_examples}
- High-scoring unsupported candidates: ${result.data.high_score_unsupported_candidates}
- Final analog rows: ${result.data.final_analog_rows}
- Final analog examples: ${result.data.final_analog_examples}

## Decision

- Build selector features next: ${result.decision.build_selector_features_next ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
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
