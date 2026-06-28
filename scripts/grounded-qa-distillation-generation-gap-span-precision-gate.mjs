import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourceRunId = args["source-run"] ?? "generation-gap-span-constructor-d331-2026-06-28-v1";
const runId = args["run-id"] ?? "generation-gap-span-precision-gate-d332-2026-06-28-v1";
const sourceDir = path.join(runsDir, sourceRunId);
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const predictions = await readJsonl(path.join(sourceDir, "predictions.jsonl"));
const features = await readJsonl(path.join(sourceDir, "constructor_features.jsonl"));
const featureById = new Map(features.map((row) => [row.example_id, row]));
const gated = predictions.map((row) => gateRow(row, featureById.get(row.example_id)));
const summary = summarize(predictions, gated);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "generation_gap_span_precision_gate",
  status: "span_precision_gate_ready_for_shape_eval",
  purpose: "Convert the D332 judge signal into a no-call precision-first scaffold: keep only directly extractive span-constructor answers and abstain on inferred yes/no or weak relation claims.",
  source_run_id: sourceRunId,
  gate_policy: {
    name: "direct_extractive_reason_allowlist",
    allowed_answer_reasons: ["ad_nd_empirical_comparison_span", "accepted_source_prediction_hint"],
    uses_judge_outputs_for_policy_design: true,
    uses_judge_outputs_at_inference: false,
    uses_final_diagnostic_targets: false,
  },
  summary,
  decision: {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    next_step: "Run the D322 shape harness. If precision improves but coverage collapses, mine trainable direct-extractive answerability features instead of launching another generator.",
    reason: "The paid judge showed inferred yes/no and relation answers were unsupported despite passing shape; this gate tests a stricter deployable precision/coverage tradeoff.",
  },
  leakage_guard: {
    final_targets_used_for_gate: false,
    judge_outputs_used_for_metric_interpretation_only: true,
    inference_inputs: ["source prediction", "source constructor metadata"],
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
    note: "Local gate over existing constructor outputs.",
  },
};

await writeJsonl(path.join(outputDir, "gated_predictions.jsonl"), gated);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({ run_id: result.run_id, status: result.status, summary: result.summary, decision: result.decision }, null, 2));

function gateRow(row, feature) {
  const prediction = row.prediction ?? {};
  const keep = prediction.answer_type === "grounded_answer"
    && ["ad_nd_empirical_comparison_span", "accepted_source_prediction_hint"].includes(feature?.selected_reason);
  const gatedPrediction = keep ? prediction : abstain(`Suppressed weak constructor reason: ${feature?.selected_reason ?? "unknown"}.`);
  return {
    example_id: row.example_id,
    prediction: gatedPrediction,
    raw_output: JSON.stringify(gatedPrediction),
    gate_metadata: {
      source_run_id: sourceRunId,
      source_reason: feature?.selected_reason ?? null,
      decision: keep ? "keep_grounded_answer" : "convert_to_abstain",
    },
  };
}

function abstain(reason) {
  return {
    answer_type: "abstain",
    answer: "The evidence pack does not contain enough support to answer this question.",
    citations: [],
    claim_table: [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }],
    abstention_reason: reason,
  };
}

function summarize(sourceRows, gatedRows) {
  return {
    examples: gatedRows.length,
    source_grounded_answers: sourceRows.filter((row) => row.prediction?.answer_type === "grounded_answer").length,
    kept_grounded_answers: gatedRows.filter((row) => row.prediction?.answer_type === "grounded_answer").length,
    abstentions: gatedRows.filter((row) => row.prediction?.answer_type === "abstain").length,
  };
}

function renderReport(result) {
  return `# Generation-Gap Span Precision Gate

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime job.

## Summary

- Examples: ${result.summary.examples}
- Source grounded answers: ${result.summary.source_grounded_answers}
- Kept grounded answers: ${result.summary.kept_grounded_answers}
- Abstentions: ${result.summary.abstentions}

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  return (await fs.readFile(file, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith("--") ? argv[++i] : true;
  }
  return parsed;
}
