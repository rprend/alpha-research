import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const predictionRunId = args["prediction-run-id"] ?? "frontier-repaired-qwen3b-validation-smoke-v1";
const gateRunId = args["gate-run-id"] ?? `${predictionRunId}-evidence-first-contract-gate`;
const repairRunId = args["repair-run-id"] ?? `evidence-first-contract-repair-audit-${predictionRunId}`;
const runId = args["run-id"] ?? `repaired-qwen3b-failure-mode-audit-${predictionRunId}`;
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const predictionResult = await readJson(path.join(runsDir, predictionRunId, "result.json"));
const predictions = await readJsonl(path.join(runsDir, predictionRunId, "predictions.jsonl"));
const gate = await readJson(path.join(runsDir, gateRunId, "result.json"));
const scored = await readJsonl(path.join(runsDir, gateRunId, "scored_predictions.jsonl"));
const repair = await readJson(path.join(runsDir, repairRunId, "result.json"));
const repairRows = await readJsonl(path.join(runsDir, repairRunId, "scored_repairs.jsonl"));

const rawById = new Map(predictions.map((row) => [row.example_id, row]));
const targetCounts = countBy(scored.map((row) => row.target_answer_type));
const predictionCounts = countBy(scored.map((row) => row.prediction_answer_type));
const confusion = countBy(scored.map((row) => `${row.prediction_answer_type}_vs_${row.target_answer_type}`));
const invalidJsonRows = predictions.filter((row) => row.parse_error);
const groundedRows = scored.filter((row) => row.prediction_answer_type === "grounded_answer");
const groundedNoInline = groundedRows.filter((row) => !hasEvidenceInlineCitation(row.prediction?.answer));
const malformedCitationRows = scored.filter((row) => (row.prediction?.citations ?? []).some((citation) => !isPlainEvidenceId(citation)));
const contractErrorCounts = countBy(scored.flatMap((row) => row.evidence_first_errors ?? []));
const repairActionCounts = repair.taxonomy?.repair_action_counts ?? {};
const repairConfusion = countBy(repairRows.map((row) => `${row.repaired_answer_type}_vs_${row.target_answer_type}`));

const falseAnswers = confusion.grounded_answer_vs_abstain ?? 0;
const falseAbstentions = confusion.abstain_vs_grounded_answer ?? 0;
const answerabilitySkew = falseAnswers > falseAbstentions
  ? "over_answering"
  : falseAbstentions > falseAnswers
    ? "over_abstaining"
    : "balanced_answerability_errors";

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "repaired_qwen3b_failure_mode_audit",
  status: "failure_mode_audit_blocks_model_escalation_until_schema_and_answerability_are_fixed",
  purpose: "Classify why the repaired Qwen3B smoke failed before spending on paid judging or larger-model escalation.",
  source_runs: {
    prediction_run_id: predictionRunId,
    gate_run_id: gateRunId,
    repair_run_id: repairRunId,
  },
  metrics: {
    examples: scored.length,
    target_counts: targetCounts,
    prediction_counts: predictionCounts,
    answerability_confusion: confusion,
    answerability_skew: answerabilitySkew,
    invalid_raw_json_rows: invalidJsonRows.length,
    evidence_first_invalid_rows: scored.filter((row) => !row.evidence_first_valid).length,
    malformed_citation_rows: malformedCitationRows.length,
    grounded_answers_missing_inline_e_citation: groundedNoInline.length,
    source_contract_correct: count(scored, (row) => row.contract_correct),
    source_contract_correct_rate: gate.metrics?.overall_contract_correct_rate,
    repaired_contract_correct: count(repairRows, (row) => row.repair_contract_correct),
    repaired_contract_correct_rate: repair.metrics?.repaired_contract_correct_rate,
    train_calibrated_baseline_contract_correct: 44,
    train_calibrated_baseline_contract_correct_rate: 44 / 70,
  },
  taxonomy: {
    contract_error_counts: contractErrorCounts,
    repair_action_counts: repairActionCounts,
    repair_answerability_confusion: repairConfusion,
  },
  decision: {
    buy_openai_judgments_now: false,
    launch_larger_model_now: false,
    launch_more_qwen3b_training_now: false,
    next_intervention: "Build a constrained runner/scaffold that enforces JSON schema, normalizes evidence ids, and calibrates answerability against the repaired train split before any larger-model Prime run.",
    rationale: [
      "The raw Qwen3B output fails schema/citation binding: invalid JSON, malformed citations, and missing inline [E#] citations are common.",
      "Post-hoc deterministic repair fixes most syntax but reaches only 35/70 contract correctness, below the 44/70 zero-spend train-calibrated scaffold.",
      "The dominant answerability error is over-answering: 26 false grounded answers versus 10 false abstentions before repair.",
      "Because deterministic repair changes the failure substantially, a larger model would confound capacity with schema/decoding and answerability policy.",
    ],
  },
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
    note: "This audit reads existing local prediction, gate, and repair artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  metrics: result.metrics,
  decision: result.decision,
}, null, 2));

function renderReport(result) {
  return `# Repaired Qwen3B Failure-Mode Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Summary

- Source contract correctness: ${result.metrics.source_contract_correct}/70 (${pct(result.metrics.source_contract_correct_rate)})
- Repaired contract correctness: ${result.metrics.repaired_contract_correct}/70 (${pct(result.metrics.repaired_contract_correct_rate)})
- Train-calibrated scaffold baseline: 44/70 (${pct(result.metrics.train_calibrated_baseline_contract_correct_rate)})
- Answerability skew: \`${result.metrics.answerability_skew}\`
- Invalid raw JSON rows: ${result.metrics.invalid_raw_json_rows}
- Malformed citation rows: ${result.metrics.malformed_citation_rows}
- Grounded answers missing inline [E#] citations: ${result.metrics.grounded_answers_missing_inline_e_citation}

## Decision

- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch larger model now: ${result.decision.launch_larger_model_now ? "yes" : "no"}
- Launch more Qwen3B training now: ${result.decision.launch_more_qwen3b_training_now ? "yes" : "no"}
- Next intervention: ${result.decision.next_intervention}

## Rationale

${result.decision.rationale.map((item) => `- ${item}`).join("\n")}
`;
}

function hasEvidenceInlineCitation(text) {
  return /\[E\d+\]/.test(String(text ?? ""));
}

function isPlainEvidenceId(value) {
  return /^E\d+$/.test(String(value ?? ""));
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countBy(values) {
  const counts = {};
  for (const value of values) {
    const key = String(value ?? "missing");
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
