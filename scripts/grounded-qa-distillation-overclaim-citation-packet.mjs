import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const runId = "overclaim-citation-packet-from-high-score-support-labels-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const labelRunId = "high-score-support-label-batch-run-gpt4o-mini-2026-06-28-v1";
const selectorProbeRunId = "adjudicated-support-selector-probe-2026-06-28-v1";
const targetFailureModes = new Set(["overbroad_or_overclaimed", "citation_mismatch"]);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(path.join(outputDir, "dataset"), { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const labelRun = await readJson(path.join(runsDir, labelRunId, "result.json"));
const selectorProbe = await readJson(path.join(runsDir, selectorProbeRunId, "result.json"));
const requests = await readJsonl(path.join(runsDir, labelRunId, "requests.jsonl"));
const adjudications = await readJsonl(path.join(runsDir, labelRunId, "adjudications.jsonl"));
const requestById = new Map(requests.map((row) => [row.request_id, row]));
const primary = adjudications.filter((row) => !row.skipped && row.metadata?.duplicate_calibration !== true);
const nonfinalTargetRows = primary
  .filter((row) => row.metadata?.source === "nonfinal_high_score_packet")
  .filter((row) => row.judgment?.preferred_candidate === "chosen")
  .filter((row) => targetFailureModes.has(row.judgment?.rejected_failure_mode));
const finalTargetRows = primary
  .filter((row) => row.metadata?.source === "final_analog_validation_only")
  .filter((row) => targetFailureModes.has(row.judgment?.rejected_failure_mode));
const split = splitByExample(nonfinalTargetRows, 0.72);
const trainRows = split.train.map((row, index) => dpoRow(row, index, "train"));
const validationRows = split.validation.map((row, index) => dpoRow(row, index, "validation"));
const finalReportingRows = finalTargetRows.map((row, index) => reportingRow(row, index));
const decision = decisionFromRows(trainRows, validationRows, finalReportingRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "overclaim_citation_packet",
  status: decision.run_zero_cost_probe_next ? "overclaim_citation_packet_ready_for_zero_cost_probe" : "overclaim_citation_packet_too_small_for_probe",
  source_runs: {
    high_score_support_label_batch_run: labelRunId,
    adjudicated_support_selector_probe: selectorProbeRunId,
  },
  purpose: "Create a narrower post-training packet for the failure modes that survived broad support-label selection: overclaiming and citation mismatch in high-scoring grounded answers.",
  data: {
    primary_adjudications: primary.length,
    nonfinal_target_rows: nonfinalTargetRows.length,
    nonfinal_target_examples: new Set(nonfinalTargetRows.map((row) => row.example_id)).size,
    final_reporting_target_rows: finalTargetRows.length,
    final_reporting_target_examples: new Set(finalTargetRows.map((row) => row.example_id)).size,
    train_dpo_rows: trainRows.length,
    validation_dpo_rows: validationRows.length,
    final_reporting_rows: finalReportingRows.length,
    target_failure_mode_counts_nonfinal: countBy(nonfinalTargetRows.map((row) => row.judgment.rejected_failure_mode)),
    target_failure_mode_counts_final_reporting: countBy(finalTargetRows.map((row) => row.judgment.rejected_failure_mode)),
  },
  training_contract: {
    objective: "Prefer concise cited answers whose claims are directly supported over high-scoring answers with overclaims or citation mismatches.",
    train_sources: "non-final D349 adjudications only",
    validation_sources: "non-final D349 adjudications only, example-disjoint from train split",
    final_reporting_sources: "final D349 adjudications only, forbidden for training or model selection",
    row_schema: ["messages", "chosen", "rejected", "failure_mode", "evidence_pack", "source_metadata"],
  },
  d350_context: {
    selector_probe_status: selectorProbe.status,
    selected_policy: selectorProbe.selected_by_nonfinal_validation?.policy_id,
    selected_nonfinal_validation_accuracy: selectorProbe.selected_by_nonfinal_validation?.nonfinal_validation?.accuracy,
    selected_final_reporting_accuracy: selectorProbe.selected_by_nonfinal_validation?.final_reporting?.accuracy,
  },
  decision,
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_rows_written_for_reporting_only: true,
    nonfinal_train_validation_example_disjoint: disjoint(new Set(split.train.map((row) => row.example_id)), new Set(split.validation.map((row) => row.example_id))),
    duplicate_calibration_rows_used_for_training: false,
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    source_label_run_cost_usd: labelRun.run_cost_usd,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "Zero-call packet construction over already-ledgered D349 adjudications.",
  },
  artifacts: {
    train_dpo_jsonl: rel(path.join(outputDir, "dataset", "train_dpo.jsonl")),
    validation_dpo_jsonl: rel(path.join(outputDir, "dataset", "validation_dpo.jsonl")),
    final_reporting_jsonl: rel(path.join(outputDir, "dataset", "final_reporting_cases.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "dataset", "train_dpo.jsonl"), trainRows);
await writeJsonl(path.join(outputDir, "dataset", "validation_dpo.jsonl"), validationRows);
await writeJsonl(path.join(outputDir, "dataset", "final_reporting_cases.jsonl"), finalReportingRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  data: result.data,
  decision: result.decision,
  leakage_guard: result.leakage_guard,
  budget: result.budget,
}, null, 2));

function dpoRow(adjudication, index, splitName) {
  const request = requestById.get(adjudication.request_id);
  if (!request) throw new Error(`Missing request ${adjudication.request_id}.`);
  return {
    row_id: `${runId}:${splitName}:${String(index + 1).padStart(3, "0")}`,
    task: "grounded_qa_overclaim_citation_preference",
    split: splitName,
    example_id: adjudication.example_id,
    question: request.input.question,
    evidence_pack: request.input.evidence_pack,
    messages: [
      {
        role: "system",
        content: "Answer using only the evidence pack. Prefer concise answers whose claims are directly supported and whose citations cover every claim. Abstain when support is insufficient.",
      },
      {
        role: "user",
        content: renderPrompt(request),
      },
    ],
    chosen: request.input.candidate_chosen,
    rejected: request.input.candidate_rejected,
    failure_mode: adjudication.judgment.rejected_failure_mode,
    support_adjudication: adjudication.judgment,
    source_metadata: {
      label_run_id: labelRunId,
      request_id: adjudication.request_id,
      training_use: "nonfinal_preference_training",
      target_failure_packet: true,
    },
  };
}

function reportingRow(adjudication, index) {
  const request = requestById.get(adjudication.request_id);
  if (!request) throw new Error(`Missing request ${adjudication.request_id}.`);
  return {
    row_id: `${runId}:final-reporting:${String(index + 1).padStart(3, "0")}`,
    example_id: adjudication.example_id,
    question: request.input.question,
    evidence_pack: request.input.evidence_pack,
    chosen: request.input.candidate_chosen,
    rejected: request.input.candidate_rejected,
    failure_mode: adjudication.judgment.rejected_failure_mode,
    support_adjudication: adjudication.judgment,
    training_use: "forbidden_final_reporting_only",
    source_metadata: {
      label_run_id: labelRunId,
      request_id: adjudication.request_id,
      target_failure_packet: true,
    },
  };
}

function renderPrompt(request) {
  return [
    `Question: ${request.input.question}`,
    "",
    "Evidence pack:",
    request.input.evidence_pack.map((item) => `[${item.evidence_id}] ${item.section ?? "Evidence"}: ${item.text}`).join("\n\n"),
    "",
    "Return JSON with answer_type, answer, citations, claim_table, and abstention_reason when needed.",
  ].join("\n");
}

function splitByExample(rows, trainFraction) {
  const examples = [...new Set(rows.map((row) => row.example_id))].sort();
  const trainCount = Math.max(1, Math.floor(examples.length * trainFraction));
  const trainExamples = new Set(examples.slice(0, trainCount));
  return {
    train: rows.filter((row) => trainExamples.has(row.example_id)),
    validation: rows.filter((row) => !trainExamples.has(row.example_id)),
  };
}

function decisionFromRows(trainRows, validationRows, finalRows) {
  if (trainRows.length >= 15 && validationRows.length >= 6 && finalRows.length >= 6) {
    return {
      run_zero_cost_probe_next: true,
      launch_gpu_now: false,
      buy_more_openai_labels_now: false,
      reason: "The packet has enough narrow overclaim/citation-mismatch preferences for a local zero-cost probe, but not enough evidence to justify GPU spend.",
      next_step: "Train/evaluate a narrow overclaim-citation verifier or integrate these rows into a bounded packet only after a zero-cost transfer probe.",
    };
  }
  return {
    run_zero_cost_probe_next: false,
    launch_gpu_now: false,
    buy_more_openai_labels_now: false,
    reason: "The packet is too small for a meaningful probe.",
    next_step: "Mine additional non-final overclaim/citation-mismatch rows before spending.",
  };
}

function renderReport(result) {
  return `# Overclaim/Citation Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

This packet makes no API calls and launches no compute. It converts D349 adjudications into a narrower preference dataset focused on overclaiming and citation mismatch.

## Data

- Non-final target rows: ${result.data.nonfinal_target_rows}
- Train DPO rows: ${result.data.train_dpo_rows}
- Validation DPO rows: ${result.data.validation_dpo_rows}
- Final reporting rows: ${result.data.final_reporting_rows}
- Non-final failure modes: ${JSON.stringify(result.data.target_failure_mode_counts_nonfinal)}
- Final reporting failure modes: ${JSON.stringify(result.data.target_failure_mode_counts_final_reporting)}

## Decision

- Run zero-cost probe next: ${result.decision.run_zero_cost_probe_next ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function disjoint(left, right) {
  for (const value of left) {
    if (right.has(value)) return false;
  }
  return true;
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
