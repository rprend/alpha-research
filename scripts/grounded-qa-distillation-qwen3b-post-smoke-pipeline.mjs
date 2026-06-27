import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2";
const predictionRunId = args["prediction-run-id"] ?? "joint-action-qwen3b-smoke-eval-v1";
const integrityRunId = args["integrity-run-id"] ?? `qwen3b-prediction-integrity-gate-${predictionRunId}`;
const provenanceRunId = args["provenance-run-id"] ?? `qwen3b-remote-provenance-gate-${predictionRunId}`;
const dryJudgeRunId = args["dry-judge-run-id"] ?? `openai-judge-gpt4o-${predictionRunId}-dry-run`;
const paidJudgeRunId = args["paid-judge-run-id"] ?? `openai-judge-gpt4o-${predictionRunId}`;
const runId = args["run-id"] ?? `qwen3b-post-smoke-judge-pipeline-${predictionRunId}`;
const model = args.model ?? "gpt-4o";
const split = args.split ?? "extended_temporal_future_holdout";
const maxBudgetUsd = args["max-budget-usd"] ?? "100";
const runPaid = args["run-paid"] === "true";
const requireReady = args["require-ready"] === "true";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const steps = [];
const commands = {
  integrity_gate: [
    "node",
    "scripts/grounded-qa-distillation-qwen3b-prediction-integrity-gate.mjs",
    `--prediction-run-id=${predictionRunId}`,
    `--packet-run-id=${packetRunId}`,
    `--run-id=${integrityRunId}`,
  ],
  provenance_gate: [
    "node",
    "scripts/grounded-qa-distillation-qwen3b-remote-provenance-gate.mjs",
    `--prediction-run-id=${predictionRunId}`,
    `--packet-run-id=${packetRunId}`,
    `--run-id=${provenanceRunId}`,
  ],
  dry_judge: [
    "node",
    "scripts/grounded-qa-distillation-openai-judge.mjs",
    "--dry-run=true",
    `--split=${split}`,
    `--prediction-run=${predictionRunId}`,
    `--run-id=${dryJudgeRunId}`,
    `--model=${model}`,
    `--max-budget-usd=${maxBudgetUsd}`,
  ],
  paid_judge: [
    "node",
    "scripts/grounded-qa-distillation-openai-judge.mjs",
    `--split=${split}`,
    `--prediction-run=${predictionRunId}`,
    `--run-id=${paidJudgeRunId}`,
    `--model=${model}`,
    `--max-budget-usd=${maxBudgetUsd}`,
  ],
};

runStep("integrity_gate", commands.integrity_gate);
const integrity = await readJson(path.join(runsDir, integrityRunId, "result.json"));
const integrityStatus = integrity.conclusion?.status;

if (integrityStatus !== "ready_for_paid_judge") {
  if (requireReady) {
    steps.push({
      id: "require_ready",
      status: "failed",
      reason: `Integrity gate status is ${integrityStatus}.`,
    });
  }
  await finish({
    status: requireReady ? "failed_integrity_not_ready" : integrityStatus,
    next_step: integrity.conclusion?.next_step ?? "Run the Qwen 3B smoke, then rerun this pipeline.",
  });
  process.exit(requireReady ? 1 : 0);
}

runStep("provenance_gate", commands.provenance_gate);
const provenance = await readJson(path.join(runsDir, provenanceRunId, "result.json"));
const provenanceStatus = provenance.status;

if (provenanceStatus !== "remote_provenance_ready_for_judge") {
  if (requireReady) {
    steps.push({
      id: "require_ready",
      status: "failed",
      reason: `Remote provenance gate status is ${provenanceStatus}.`,
    });
  }
  await finish({
    status: requireReady ? "failed_remote_provenance_not_ready" : provenanceStatus,
    next_step: provenance.next_step ?? "Fetch or repair remote provenance artifacts, then rerun this pipeline.",
  });
  process.exit(requireReady ? 1 : 0);
}

runStep("dry_judge", commands.dry_judge);
const dryJudge = await readJson(path.join(runsDir, dryJudgeRunId, "result.json"));
const dryCallsSkipped = Number(dryJudge.calls_skipped ?? 0);
const dryExamplesRequested = Number(dryJudge.examples_requested ?? 0);

if (dryJudge.dry_run !== true || dryCallsSkipped !== dryExamplesRequested || dryExamplesRequested !== Number(integrity.checks?.expected_eval_examples)) {
  steps.push({
    id: "dry_judge_guard",
    status: "failed",
    reason: "Dry judge did not skip exactly the expected eval examples.",
  });
  await finish({
    status: "failed_dry_judge_guard",
    next_step: "Inspect the dry judge artifact before spending OpenAI budget.",
  });
  process.exit(1);
}

if (!runPaid) {
  await finish({
    status: "ready_for_explicit_paid_judge",
    next_step: "Rerun with --run-paid=true after confirming OPENAI_API_KEY is loaded and budget remains below $100.",
  });
  process.exit(0);
}

if (!process.env.OPENAI_API_KEY) {
  steps.push({
    id: "paid_judge_guard",
    status: "failed",
    reason: "OPENAI_API_KEY is not loaded.",
  });
  await finish({
    status: "failed_missing_openai_key",
    next_step: "Load OPENAI_API_KEY through the hidden secret helper, then rerun with --run-paid=true.",
  });
  process.exit(1);
}

runStep("paid_judge", commands.paid_judge);
const paidJudge = await readJson(path.join(runsDir, paidJudgeRunId, "result.json"));
await finish({
  status: Number(paidJudge.calls_made ?? 0) > 0 ? "paid_judge_complete" : "paid_judge_no_calls_made",
  next_step: "Rerun the paper-readiness gate and inspect grounded-correctness metrics.",
});

function runStep(id, command) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command[0], command.slice(1), {
    cwd: rootDir,
    encoding: "utf8",
    env: process.env,
  });
  steps.push({
    id,
    command: command.map(shellToken).join(" "),
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    exit_status: result.status,
    signal: result.signal,
    stdout_tail: tail(result.stdout),
    stderr_tail: tail(result.stderr),
    status: result.status === 0 ? "passed" : "failed",
  });
  if (result.status !== 0) {
    throw new Error(`${id} failed with status ${result.status}: ${tail(result.stderr || result.stdout)}`);
  }
}

async function finish(conclusion) {
  const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
  const result = {
    run_id: runId,
    generated_at: new Date().toISOString(),
    pipeline_type: "qwen3b_post_smoke_integrity_dry_paid_judge_pipeline",
    packet_run_id: packetRunId,
    prediction_run_id: predictionRunId,
    integrity_run_id: integrityRunId,
    provenance_run_id: provenanceRunId,
    dry_judge_run_id: dryJudgeRunId,
    paid_judge_run_id: paidJudgeRunId,
    model,
    split,
    run_paid_requested: runPaid,
    commands: Object.fromEntries(Object.entries(commands).map(([key, value]) => [key, value.map(shellToken).join(" ")])),
    steps,
    budget_context: {
      max_budget_usd: Number(budget.max_budget_usd),
      actual_total_spend_usd: Number(budget.spend_usd?.total_actual ?? 0),
      remaining_budget_usd: Number(budget.spend_usd?.remaining ?? 0),
    },
    llm_budget: {
      openai_llm_calls: runPaid && conclusion.status === "paid_judge_complete" ? "see_paid_judge_ledger" : 0,
      openai_cost_usd: runPaid && conclusion.status === "paid_judge_complete" ? "see_paid_judge_ledger" : 0,
      external_compute_cost_usd: 0,
      note: runPaid
        ? "Paid judge cost, if any, is recorded by grounded-qa-distillation-openai-judge.mjs in the OpenAI ledger."
        : "Default pipeline mode runs integrity, remote provenance, and possibly dry judge only; it makes no paid OpenAI calls.",
    },
    conclusion,
  };
  await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
  console.log(JSON.stringify(result, null, 2));
}

function renderReport(result) {
  return `# Qwen 3B Post-Smoke Judge Pipeline

Prediction run: \`${result.prediction_run_id}\`

Status: \`${result.conclusion.status}\`

| Step | Status | Exit |
| --- | --- | ---: |
${result.steps.map((step) => `| ${step.id} | ${step.status} | ${step.exit_status ?? "n/a"} |`).join("\n")}

Default mode is zero-cost. The paid judge runs only with \`--run-paid=true\`, after the integrity gate, remote provenance gate, and dry judge guard succeed.
`;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function shellToken(value) {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(value)) return value;
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function tail(value, max = 1600) {
  const text = String(value ?? "").trim();
  return text.length > max ? text.slice(-max) : text;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
