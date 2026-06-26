import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1";
const predictionRunId = args["prediction-run-id"] ?? "joint-action-qwen3b-smoke-eval-v1";
const judgeRunId = args["judge-run-id"] ?? `openai-judge-gpt4o-${predictionRunId}`;
const runId = args["run-id"] ?? `joint-action-judge-plan-${predictionRunId}`;
const model = args.model ?? "gpt-4o";
const split = args.split ?? "extended_temporal_future_holdout";
const outputTokens = numberArg(args["max-output-tokens"], 520);
const outputDir = path.join(runsDir, runId);
const packetDir = path.join(runsDir, packetRunId);
const evalPrompts = await readJsonl(path.join(packetDir, "dataset", "eval_prompts.jsonl"));
const budget = JSON.parse(await fs.readFile(path.join(experimentDir, "spend", "budget.json"), "utf8"));
const price = {
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10, source: "https://developers.openai.com/api/docs/models/gpt-4o" },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6, source: "https://developers.openai.com/api/docs/models/gpt-4o-mini" },
}[model];

if (!price) throw new Error(`Unsupported judge model ${model}.`);

await fs.mkdir(outputDir, { recursive: true });

const predictionDir = path.join(runsDir, predictionRunId);
const predictionsPath = path.join(predictionDir, "predictions.jsonl");
const predictionsExist = await exists(predictionsPath);
const integrityGateRunId = `qwen3b-prediction-integrity-gate-${predictionRunId}`;
const integrityGatePath = path.join(runsDir, integrityGateRunId, "result.json");
const integrityGateExists = await exists(integrityGatePath);
const postSmokePipelineRunId = `qwen3b-post-smoke-judge-pipeline-${predictionRunId}`;
const postSmokePipelinePath = path.join(runsDir, postSmokePipelineRunId, "result.json");
const postSmokePipelineExists = await exists(postSmokePipelinePath);
const estimateRows = evalPrompts.map((row) => estimateJudgeCall(row, model, price, outputTokens));
const estimatedCostUsd = sum(estimateRows.map((row) => row.estimated_cost_usd));
const currentSpend = Number(budget.spend_usd?.total_actual ?? 0);
const remaining = Number(budget.spend_usd?.remaining ?? 0);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  plan_type: "joint_action_qwen3b_grounded_correctness_judge_plan",
  packet_run_id: packetRunId,
  prediction_run_id: predictionRunId,
  judge_run_id: judgeRunId,
  model,
  eval_examples: evalPrompts.length,
  prediction_artifact: {
    expected_path: path.relative(rootDir, predictionsPath),
    exists: predictionsExist,
    prerequisite: "Run the Qwen 3B adapter evaluator after GPU training.",
  },
  integrity_gate: {
    run_id: integrityGateRunId,
    expected_path: path.relative(rootDir, integrityGatePath),
    exists: integrityGateExists,
    prerequisite: "Run the Qwen 3B prediction integrity gate before spending judge budget.",
  },
  post_smoke_pipeline: {
    run_id: postSmokePipelineRunId,
    expected_path: path.relative(rootDir, postSmokePipelinePath),
    exists: postSmokePipelineExists,
    prerequisite: "Run the guarded post-smoke pipeline after GPU predictions exist; it runs integrity, dry judge, and only runs paid judge with --run-paid=true.",
  },
  budget_gate: {
    max_budget_usd: Number(budget.max_budget_usd),
    current_actual_spend_usd: currentSpend,
    remaining_budget_usd: remaining,
    estimated_judge_cost_usd: estimatedCostUsd,
    estimated_total_after_judge_usd: currentSpend + estimatedCostUsd,
    within_budget: currentSpend + estimatedCostUsd <= Number(budget.max_budget_usd),
    price,
    estimate_policy: "Upper-bound style preflight using full evidence packs and reference answers as stand-ins before model predictions exist.",
  },
  commands: {
    eval_prerequisite: [
      "ADAPTER_DIR=joint-action-dpo-adapter",
      `OUTPUT_DIR=${path.join("docs", "experiments", "grounded-qa-distillation", "runs", predictionRunId)}`,
      `uv run ${path.join("docs", "experiments", "grounded-qa-distillation", "runs", packetRunId, "eval_joint_action_adapter_uv.py")}`,
    ].join(" "),
    integrity_gate_after_predictions: [
      "node scripts/grounded-qa-distillation-qwen3b-prediction-integrity-gate.mjs",
      `--prediction-run-id=${predictionRunId}`,
      `--packet-run-id=${packetRunId}`,
      `--run-id=${integrityGateRunId}`,
    ].join(" "),
    guarded_post_smoke_pipeline: [
      "node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs",
      `--prediction-run-id=${predictionRunId}`,
      `--packet-run-id=${packetRunId}`,
      `--run-id=${postSmokePipelineRunId}`,
      `--model=${model}`,
      `--split=${split}`,
      "--max-budget-usd=100",
    ].join(" "),
    judge_after_predictions: [
      "set -a; source ~/.codex/secrets.env; set +a;",
      "node scripts/grounded-qa-distillation-openai-judge.mjs",
      `--split=${split}`,
      `--prediction-run=${predictionRunId}`,
      `--run-id=${judgeRunId}`,
      `--model=${model}`,
      "--max-budget-usd=100",
    ].join(" "),
    dry_run_after_predictions: [
      "node scripts/grounded-qa-distillation-openai-judge.mjs",
      "--dry-run=true",
      `--split=${split}`,
      `--prediction-run=${predictionRunId}`,
      `--run-id=${judgeRunId}-dry-run`,
      `--model=${model}`,
      "--max-budget-usd=100",
    ].join(" "),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This is a judge launch plan only. It makes no API calls and appends no ledger rows.",
  },
  conclusion: {
    status: predictionsExist ? "ready_to_dry_run_or_judge" : "waiting_for_qwen3b_predictions",
    next_step: predictionsExist
      ? "Run the dry judge command, then the paid judge command if budget still passes."
      : "Repair Prime/HF execution, train the Qwen 3B adapter, run adapter eval, then run this judge command.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function estimateJudgeCall(row, selectedModel, modelPrice, maxOutputTokens) {
  const evidenceText = row.input.compact_retrieved_evidence_pack.map((evidence) => `[${evidence.evidence_id}] ${evidence.section ?? "Evidence"}: ${evidence.text}`).join("\n\n");
  const serialized = [
    "You are an entailment-style citation judge for grounded QA.",
    `Question: ${row.input.question}`,
    `Prediction answer_type: ${row.reference.answer_type}`,
    `Prediction answer: ${row.reference.answer}`,
    `Prediction citations: ${JSON.stringify((row.reference.citations ?? []).map((citation) => citation.evidence_id).filter(Boolean))}`,
    `Prediction claim_table: ${JSON.stringify(row.reference.claim_table ?? [])}`,
    evidenceText,
  ].join("\n");
  const estimatedInputTokens = Math.ceil(serialized.length / 4);
  return {
    example_id: row.example_id,
    model: selectedModel,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: maxOutputTokens,
    estimated_cost_usd: (estimatedInputTokens / 1_000_000) * modelPrice.inputPerMillion + (maxOutputTokens / 1_000_000) * modelPrice.outputPerMillion,
  };
}

function renderReport(result) {
  return `# Joint-Action Qwen 3B Judge Plan

Prediction run: \`${result.prediction_run_id}\`

Prediction artifact exists: ${result.prediction_artifact.exists ? "yes" : "no"}

| Examples | Judge model | Estimated judge cost | Current actual spend | Estimated total after judge | Within budget |
| ---: | --- | ---: | ---: | ---: | --- |
| ${result.eval_examples} | ${result.model} | $${result.budget_gate.estimated_judge_cost_usd.toFixed(4)} | $${result.budget_gate.current_actual_spend_usd.toFixed(4)} | $${result.budget_gate.estimated_total_after_judge_usd.toFixed(4)} | ${result.budget_gate.within_budget ? "yes" : "no"} |

## Commands

\`\`\`bash
${result.commands.eval_prerequisite}
${result.commands.guarded_post_smoke_pipeline}
${result.commands.guarded_post_smoke_pipeline} --run-paid=true
\`\`\`

This plan makes no OpenAI calls and records no spend. It exists to prevent a trained Qwen 3B adapter from sitting unevaluated after GPU execution.
`;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
