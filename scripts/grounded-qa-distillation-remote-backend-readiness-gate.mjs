import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "remote-backend-readiness-gate-qwen3b-smoke-2026-06-26-v1";
const outputDir = path.join(runsDir, runId);
const maxBudgetUsd = numberArg(args["max-budget-usd"], 100);
const qwenJudgeEstimateUsd = numberArg(args["qwen-judge-estimate-usd"], 0.467165);
const primeGateRunId = args["prime-gate-run-id"] ?? "prime-auth-price-gate-current-2026-06-27-v1";
const primeLaunchPlanRunId = args["prime-launch-plan-run-id"] ?? "joint-action-launch-plan-prime-qwen3b-smoke-v1";
const hfLaunchPlanRunId = args["hf-launch-plan-run-id"] ?? "joint-action-launch-plan-huggingface-qwen3b-smoke-v2";
const hfAttemptRunId = args["hf-attempt-run-id"] ?? "huggingface-qwen3b-smoke-launch-attempt-2026-06-26-v1";

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const primeGate = await readResult(primeGateRunId);
const primeLaunchPlan = await readResult(primeLaunchPlanRunId);
const hfLaunchPlan = await readResult(hfLaunchPlanRunId);
const hfAttempt = await readResult(hfAttemptRunId);

const commands = {
  prime_whoami: runCommand("prime", ["--plain", "whoami"]),
  hf_whoami: runCommand("hf", ["auth", "whoami"]),
};

const actualSpend = Number(budget.spend_usd?.total_actual ?? 0);
const primeEstimatedTotal = actualSpend + Number(primeLaunchPlan.estimated_cost_usd ?? 4) + qwenJudgeEstimateUsd;
const hfEstimatedTotal = actualSpend + Number(hfLaunchPlan.estimated_cost_usd ?? 3) + qwenJudgeEstimateUsd;
const primeReady = primeGate.status === "auth_and_live_price_verified" && primeEstimatedTotal <= maxBudgetUsd;
const hfReady = hfAttempt.status !== "failed_before_creation"
  && hfAttempt.backend_job_created === true
  && hfEstimatedTotal <= maxBudgetUsd;

const checks = [
  check("budget_under_cap_now", actualSpend <= maxBudgetUsd, `Actual tracked spend is $${actualSpend.toFixed(6)} / $${maxBudgetUsd}.`),
  check("prime_cli_authenticated_now", commands.prime_whoami.status === 0, commandEvidence(commands.prime_whoami)),
  check("prime_live_price_gate_verified", primeReady, `Prime gate status is ${primeGate.status}; estimated total with Prime smoke and judge is $${primeEstimatedTotal.toFixed(6)}.`),
  check("hf_cli_authenticated_now", commands.hf_whoami.status === 0, commandEvidence(commands.hf_whoami)),
  check("hf_jobs_permission_verified", hfReady, `Latest HF launch attempt status is ${hfAttempt.status}; blocker is ${hfAttempt.failure?.class ?? "unknown"}; evidence: ${hfAttempt.failure?.evidence_excerpt ?? "none"}.`),
  check("any_backend_ready_for_qwen3b_smoke", primeReady || hfReady, primeReady || hfReady ? "At least one backend is ready." : "No backend is currently ready for the bounded Qwen 3B smoke."),
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "remote_backend_readiness_gate",
  status: primeReady || hfReady ? "remote_backend_ready_for_qwen3b_smoke" : "remote_backend_blocked",
  purpose: "Backend-agnostic read-only gate for the paper-critical Qwen 3B smoke. It combines current budget, Prime auth/price evidence, and Hugging Face Jobs permission evidence before any paid compute.",
  inputs: {
    prime_gate_run_id: primeGateRunId,
    prime_launch_plan_run_id: primeLaunchPlanRunId,
    hf_launch_plan_run_id: hfLaunchPlanRunId,
    hf_attempt_run_id: hfAttemptRunId,
  },
  budget_gate: {
    max_budget_usd: maxBudgetUsd,
    actual_total_spend_usd: actualSpend,
    remaining_budget_usd: Number(budget.spend_usd?.remaining ?? 0),
    planned_qwen3b_judge_estimate_usd: qwenJudgeEstimateUsd,
    prime_estimated_total_after_gpu_and_judge_usd: primeEstimatedTotal,
    hf_estimated_total_after_gpu_and_judge_usd: hfEstimatedTotal,
    within_budget_if_prime_ready: primeEstimatedTotal <= maxBudgetUsd,
    within_budget_if_hf_ready: hfEstimatedTotal <= maxBudgetUsd,
  },
  backends: {
    prime_intellect: {
      status: primeReady ? "ready" : "blocked",
      gate_run_id: primeGateRunId,
      gate_status: primeGate.status,
      launch_plan_run_id: primeLaunchPlanRunId,
      estimated_gpu_cost_usd: Number(primeLaunchPlan.estimated_cost_usd ?? 4),
      current_cli_check: summarizeCommand(commands.prime_whoami),
      blocker: primeReady ? null : "Prime CLI auth/live pricing is not verified.",
      balance_proven: primeGate.status === "auth_and_live_price_verified",
    },
    huggingface_jobs: {
      status: hfReady ? "ready" : "blocked",
      launch_plan_run_id: hfLaunchPlanRunId,
      launch_attempt_run_id: hfAttemptRunId,
      launch_attempt_status: hfAttempt.status,
      estimated_gpu_cost_usd: Number(hfLaunchPlan.estimated_cost_usd ?? 3),
      current_cli_check: summarizeCommand(commands.hf_whoami),
      blocker: hfReady ? null : (hfAttempt.failure?.message ?? "Hugging Face Jobs permission/billing not verified."),
      balance_proven: hfReady,
      job_write_permission_proven: hfReady,
      not_enough_money_proven: hfAttempt.conclusion?.not_enough_money_proven === true,
    },
  },
  checks,
  next_step: primeReady || hfReady
    ? "Run the bounded Qwen 3B smoke on the ready backend, then record actual compute spend and run integrity/dry/paid judge gates."
    : "Do not launch compute. Repair Prime credentials or use a Hugging Face token with job.write and available billing, then rerun this gate.",
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This gate runs read-only local CLI checks and reads existing artifacts. It does not create pods, jobs, or model calls.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({ run_id: result.run_id, status: result.status, checks: result.checks.map(({ id, status }) => ({ id, status })) }, null, 2));

function runCommand(command, commandArgs) {
  const completed = spawnSync(command, commandArgs, { cwd: rootDir, encoding: "utf8" });
  return {
    command: [command, ...commandArgs].map(shellToken).join(" "),
    status: completed.status,
    stdout: redact(completed.stdout ?? "").trim().slice(0, 4000),
    stderr: redact(completed.stderr ?? "").trim().slice(0, 4000),
  };
}

function summarizeCommand(command) {
  return {
    command: command.command,
    status: command.status,
    passed: command.status === 0,
    stdout: command.status === 0 ? normalizeWhitespace(command.stdout).slice(0, 240) : "",
    stderr: command.status === 0 ? "" : normalizeWhitespace(command.stderr || command.stdout).slice(0, 500),
  };
}

function commandEvidence(command) {
  if (command.status === 0) return `Passed: ${command.command}`;
  return `Failed: ${command.command}; ${normalizeWhitespace(command.stderr || command.stdout || "no output")}`;
}

function check(id, passed, evidence) {
  return { id, status: passed ? "pass" : "fail", evidence };
}

function redact(text) {
  return String(text)
    .replace(/pit_[A-Za-z0-9]+/g, "pit_<redacted>")
    .replace(/hf_[A-Za-z0-9]+/g, "hf_<redacted>")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer <redacted>");
}

function renderReport(result) {
  return `# Remote Backend Readiness Gate

Generated: ${result.generated_at}

Status: \`${result.status}\`

Inputs: Prime gate \`${result.inputs.prime_gate_run_id}\`; Prime plan \`${result.inputs.prime_launch_plan_run_id}\`; HF plan \`${result.inputs.hf_launch_plan_run_id}\`; HF attempt \`${result.inputs.hf_attempt_run_id}\`.

## Checks

${result.checks.map((row) => `- ${row.status === "pass" ? "PASS" : "FAIL"} ${row.id}: ${row.evidence}`).join("\n")}

## Backend Summary

| Backend | Status | Estimate | Blocker |
| --- | --- | ---: | --- |
| Prime Intellect | ${result.backends.prime_intellect.status} | $${result.backends.prime_intellect.estimated_gpu_cost_usd.toFixed(2)} | ${result.backends.prime_intellect.blocker ?? "none"} |
| Hugging Face Jobs | ${result.backends.huggingface_jobs.status} | $${result.backends.huggingface_jobs.estimated_gpu_cost_usd.toFixed(2)} | ${result.backends.huggingface_jobs.blocker ?? "none"} |

## Budget Gate

| Actual spend | Remaining | Prime total if ready | HF total if ready | Cap |
| ---: | ---: | ---: | ---: | ---: |
| $${result.budget_gate.actual_total_spend_usd.toFixed(6)} | $${result.budget_gate.remaining_budget_usd.toFixed(6)} | $${result.budget_gate.prime_estimated_total_after_gpu_and_judge_usd.toFixed(6)} | $${result.budget_gate.hf_estimated_total_after_gpu_and_judge_usd.toFixed(6)} | $${result.budget_gate.max_budget_usd.toFixed(2)} |

Next step: ${result.next_step}

This gate makes no OpenAI calls, creates no remote compute jobs, and records no spend.
`;
}

async function readResult(runId) {
  return readJson(path.join(runsDir, runId, "result.json"));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function normalizeWhitespace(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function shellToken(value) {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(value)) return value;
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
