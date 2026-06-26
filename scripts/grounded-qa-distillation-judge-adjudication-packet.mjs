import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const args = parseArgs(process.argv.slice(2));
const calibrationRunId = args["calibration-run-id"] ?? "judge-calibration-audit-2026-06-26-v1";
const runId = args["run-id"] ?? "judge-adjudication-packet-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

const predictionRunByJudgeRun = {
  "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1": "citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
  "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1": "citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
  "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1": "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1": "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  "openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1": "claim-entailment-guard-balanced-risk-gate-240-389-v1",
};

await fs.mkdir(outputDir, { recursive: true });

const calibration = await readJson(path.join(runDir, calibrationRunId, "result.json"));
const auditQueue = await readJsonl(path.join(runDir, calibrationRunId, "audit_queue.jsonl"));
const examples = indexBy(await readJsonl(path.join(dataDir, "extended_temporal_future_holdout.jsonl")), (row) => row.example_id);
const predictionMaps = {};
for (const predictionRunId of new Set(Object.values(predictionRunByJudgeRun))) {
  predictionMaps[predictionRunId] = indexBy(await readJsonl(path.join(runDir, predictionRunId, "predictions.jsonl")), (row) => row.example_id);
}

const packet = auditQueue.map((row, index) => buildAdjudicationItem(row, index + 1));
const missing = packet.flatMap((row) => row.join_warnings ?? []);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "judge_adjudication_packet",
  status: missing.length ? "packet_ready_with_join_warnings" : "packet_ready",
  purpose: "Join sampled judge-calibration rows with original questions, compact evidence packs, reference outputs, and predictions so a human or independent judge can adjudicate support decisions without searching run directories.",
  calibration_run_id: calibration.run_id,
  source_audit_queue_rows: auditQueue.length,
  adjudication_rows: packet.length,
  audit_types: countBy(packet, (row) => row.audit_type),
  join_warnings: missing,
  adjudication_schema: {
    recommended_fields: [
      "human_verdict: supported | partial | unsupported | correct_abstention | incorrect_abstention | invalid",
      "citation_verdict: valid | invalid | not_applicable",
      "abstention_verdict: sufficient_to_answer | insufficient_evidence | not_applicable",
      "notes",
      "adjudicator_id",
    ],
    instruction: "Judge only from the compact evidence pack in each row. Do not use paper knowledge outside the provided evidence.",
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This packet joins local artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "adjudication_packet.jsonl"), `${packet.map((row) => JSON.stringify(row)).join("\n")}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function buildAdjudicationItem(row, ordinal) {
  const example = examples.get(row.example_id);
  const policyRows = row.policies ?? [row];
  const cases = policyRows.map((policyRow) => {
    const predictionRunId = predictionRunByJudgeRun[policyRow.source_run_id];
    const prediction = predictionRunId ? predictionMaps[predictionRunId]?.get(policyRow.example_id) : null;
    return {
      policy: policyRow.policy,
      source_judge_run_id: policyRow.source_run_id,
      source_prediction_run_id: predictionRunId ?? null,
      prediction_answer_type: policyRow.prediction_answer_type,
      prediction: prediction?.prediction ?? null,
      prediction_metadata: prediction?.metadata ?? null,
      local_scores: prediction?.scores ?? null,
      judge_verdict: {
        verdict: policyRow.verdict,
        all_claims_supported: policyRow.all_claims_supported,
        citation_ids_valid: policyRow.citation_ids_valid,
        abstention_supported: policyRow.abstention_supported,
        unsupported_claims: policyRow.unsupported_claims ?? [],
        missing_citations: policyRow.missing_citations ?? [],
        notes: policyRow.judge_notes ?? "",
      },
    };
  });

  const warnings = [];
  if (!example) warnings.push(`${row.example_id}: missing source example.`);
  for (const item of cases) {
    if (!item.source_prediction_run_id) warnings.push(`${row.example_id}: missing prediction run mapping for ${item.source_judge_run_id}.`);
    if (!item.prediction) warnings.push(`${row.example_id}: missing prediction for ${item.policy}.`);
  }

  return {
    packet_id: `adjudication-${String(ordinal).padStart(3, "0")}`,
    audit_type: row.audit_type,
    example_id: row.example_id,
    source_split: example?.source_split ?? null,
    question: example?.input?.question ?? null,
    document_metadata: example?.input?.document_metadata ?? null,
    compact_retrieved_evidence_pack: example?.input?.compact_retrieved_evidence_pack ?? [],
    reference_output: example?.output ?? null,
    cases,
    adjudication_form: {
      human_verdict: null,
      citation_verdict: null,
      abstention_verdict: null,
      notes: "",
      adjudicator_id: "",
    },
    join_warnings: warnings,
  };
}

function renderReport(result) {
  return `# Judge Adjudication Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

Rows: ${result.adjudication_rows}

Calibration source: \`${result.calibration_run_id}\`

## Audit Types

${Object.entries(result.audit_types).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

## Adjudication Instructions

${result.adjudication_schema.instruction}

Recommended fields:

${result.adjudication_schema.recommended_fields.map((field) => `- ${field}`).join("\n")}

## Join Warnings

${result.join_warnings.length ? result.join_warnings.map((item) => `- ${item}`).join("\n") : "No join warnings."}

This packet makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function indexBy(rows, fn) {
  const map = new Map();
  for (const row of rows) map.set(fn(row), row);
  return map;
}

function countBy(rows, fn) {
  const counts = {};
  for (const row of rows) {
    const key = fn(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
