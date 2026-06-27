import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "hf-guarded-smoke-entrypoint-2026-06-27-v1";
const outputDir = path.join(runsDir, runId);
const execute = args.execute === "true";
const maxBudgetUsd = numberArg(args["max-budget-usd"], 100);
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2";
const remoteGateRunId = args["remote-gate-run-id"] ?? "remote-backend-readiness-gate-qwen3b-smoke-2026-06-26-v1";
const hfLaunchPlanRunId = args["hf-launch-plan-run-id"] ?? "joint-action-launch-plan-huggingface-qwen3b-smoke-v2";
const hfAttemptRunId = args["hf-attempt-run-id"] ?? "huggingface-qwen3b-smoke-launch-attempt-2026-06-26-v1";
const repairSignalRunId = args["repair-signal-run-id"] ?? "repair-regeneration-signal-audit-joint-action-qwen3b-2026-06-27-v1";
const predictionRunId = args["prediction-run-id"] ?? "joint-action-qwen3b-smoke-eval-v1";

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const packet = await readResult(packetRunId);
const remoteGate = await readResult(remoteGateRunId);
const hfLaunchPlan = await readResult(hfLaunchPlanRunId);
const hfAttempt = await readResult(hfAttemptRunId);
const repairSignal = await readResult(repairSignalRunId);
const gitHead = runCommand("git", ["rev-parse", "HEAD"]);
const hfWhoami = runCommand("hf", ["auth", "whoami"]);
const hfJobsHelp = runCommand("hf", ["jobs", "--help"]);

const hfBackend = remoteGate.backends?.huggingface_jobs ?? {};
const projectedHfTotal = Number(remoteGate.budget_gate?.hf_estimated_total_after_gpu_and_judge_usd ?? Number.NaN);
const boundedCommand = hfLaunchPlan.commands?.bounded_train ?? `RUN_ID=${predictionRunId} MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/${packetRunId}/run_joint_action_smoke.sh`;
const exampleJobCommand = `hf jobs run --flavor a10g-large --timeout 2h --secrets HF_TOKEN -- ${boundedCommand}`;

const checks = [
  check("execute_flag_not_set", execute === false, execute ? "execute=true was requested." : "Dry-run/refusal mode; no HF job creation is allowed."),
  check("budget_under_cap_now", Number(budget.spend_usd?.total_actual ?? 0) <= maxBudgetUsd, `Actual spend is $${Number(budget.spend_usd?.total_actual ?? 0).toFixed(6)} / $${maxBudgetUsd}.`),
  check("projected_hf_path_under_cap", projectedHfTotal <= maxBudgetUsd, `Projected HF smoke plus judge total is $${projectedHfTotal.toFixed(6)} / $${maxBudgetUsd}.`),
  check("remote_gate_hf_ready", remoteGate.status === "remote_backend_ready_for_qwen3b_smoke" && hfBackend.status === "ready", `Remote gate status is ${remoteGate.status}; HF backend status is ${hfBackend.status ?? "unknown"}.`),
  check("hf_cli_authenticated_now", hfWhoami.status === 0, commandEvidence(hfWhoami)),
  check("hf_jobs_cli_available", hfJobsHelp.status === 0 && hfJobsHelp.stdout.includes("Run and manage Jobs"), commandEvidence(hfJobsHelp)),
  check("hf_job_write_permission_proven", hfAttempt.backend_job_created === true && hfAttempt.status !== "failed_before_creation", `Latest HF attempt status is ${hfAttempt.status}; backend_job_created=${hfAttempt.backend_job_created}; failure=${hfAttempt.failure?.evidence_excerpt ?? "none"}.`),
  check("hf_launch_plan_within_budget", hfLaunchPlan.budget?.launch_within_budget === true && Number(hfLaunchPlan.estimated_cost_usd ?? 0) > 0, `HF launch plan total is $${Number(hfLaunchPlan.budget?.estimated_total_if_launched_usd ?? 0).toFixed(6)} before judge.`),
  check("repair_signal_present", repairSignal.status === "repair_regeneration_signal_present_but_untested", `Repair signal audit status is ${repairSignal.status}.`),
  check("packet_is_qwen3b_joint_action", packet.base_model === "Qwen/Qwen2.5-3B-Instruct" && packet.objective?.actions?.includes("repair_or_regenerate_when_answerable"), `Packet base model is ${packet.base_model}.`),
];

const blockers = checks.filter((row) => row.status === "fail").map((row) => row.id);
const wouldAllowJobCreation = execute === true && blockers.length === 0;
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "hf_guarded_smoke_entrypoint",
  status: wouldAllowJobCreation ? "ready_to_create_hf_job" : "refuse_hf_job_creation",
  purpose: "Single fail-closed launch predicate for the Qwen 3B Hugging Face Jobs smoke. It joins current backend, HF permission, launch plan, repair-signal, packet, and budget evidence before any job creation.",
  execute_requested: execute,
  inputs: {
    packet_run_id: packetRunId,
    prediction_run_id: predictionRunId,
    remote_gate_run_id: remoteGateRunId,
    hf_launch_plan_run_id: hfLaunchPlanRunId,
    hf_attempt_run_id: hfAttemptRunId,
    repair_signal_run_id: repairSignalRunId,
    git_head: gitHead.stdout.trim(),
  },
  checks,
  blockers,
  launch_decision: {
    hf_job_creation_allowed: wouldAllowJobCreation,
    reason: wouldAllowJobCreation
      ? "All gates passed and execute=true was requested."
      : "HF job creation is refused until execute=true and every launch gate passes.",
    current_blockers: blockers,
    dry_run_bounded_command: boundedCommand,
    example_hf_jobs_command: exampleJobCommand,
  },
  budget_gate: {
    max_budget_usd: maxBudgetUsd,
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual ?? 0),
    actual_external_compute_spend_usd: Number(budget.spend_usd?.external_compute ?? 0),
    remaining_budget_usd: Number(budget.spend_usd?.remaining ?? 0),
    projected_hf_total_after_smoke_and_judge_usd: projectedHfTotal,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This entrypoint reads local artifacts and runs read-only local CLI checks. It does not create jobs, pods, or model calls.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  hf_job_creation_allowed: result.launch_decision.hf_job_creation_allowed,
  blockers: result.blockers,
  llm_budget: result.llm_budget,
}, null, 2));

function runCommand(command, commandArgs) {
  const completed = spawnSync(command, commandArgs, { cwd: rootDir, encoding: "utf8" });
  return {
    command: [command, ...commandArgs].join(" "),
    status: completed.status,
    stdout: redact(completed.stdout ?? "").trim(),
    stderr: redact(completed.stderr ?? "").trim(),
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

function normalizeWhitespace(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function renderReport(result) {
  return `# Hugging Face Guarded Smoke Entrypoint

Generated: ${result.generated_at}

Status: \`${result.status}\`

This artifact is the fail-closed launch predicate for the Qwen 3B Hugging Face Jobs smoke. It refuses job creation unless the remote backend gate, HF permission evidence, launch plan, repair-signal audit, packet check, budget check, and explicit execute flag all pass.

## Decision

- HF job creation allowed: \`${result.launch_decision.hf_job_creation_allowed}\`
- Reason: ${result.launch_decision.reason}
- Blockers: ${result.blockers.length ? result.blockers.join(", ") : "none"}

## Checks

${result.checks.map((row) => `- ${row.status === "pass" ? "PASS" : "FAIL"} ${row.id}: ${row.evidence}`).join("\n")}

## Budget

| Actual spend | External compute | Remaining | Projected HF total | Cap |
| ---: | ---: | ---: | ---: | ---: |
| $${result.budget_gate.actual_total_spend_usd.toFixed(6)} | $${result.budget_gate.actual_external_compute_spend_usd.toFixed(6)} | $${result.budget_gate.remaining_budget_usd.toFixed(6)} | $${result.budget_gate.projected_hf_total_after_smoke_and_judge_usd.toFixed(6)} | $${result.budget_gate.max_budget_usd.toFixed(2)} |

Dry-run bounded command after all gates pass:

\`\`\`bash
${result.launch_decision.dry_run_bounded_command}
\`\`\`

Example HF Jobs wrapper to verify before use:

\`\`\`bash
${result.launch_decision.example_hf_jobs_command}
\`\`\`

This entrypoint makes no OpenAI calls, creates no HF jobs, and records no spend.
`;
}

async function readResult(runId) {
  return readJson(path.join(runsDir, runId, "result.json"));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
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
