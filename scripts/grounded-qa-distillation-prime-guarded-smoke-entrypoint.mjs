import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "prime-guarded-smoke-entrypoint-2026-06-27-v1";
const outputDir = path.join(runsDir, runId);
const execute = args.execute === "true";
const maxBudgetUsd = numberArg(args["max-budget-usd"], 100);
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2";
const remoteGateRunId = args["remote-gate-run-id"] ?? "remote-backend-readiness-gate-qwen3b-smoke-2026-06-26-v1";
const primeGateRunId = args["prime-gate-run-id"] ?? "prime-auth-price-gate-current-2026-06-27-v1";
const runbookRunId = args["runbook-run-id"] ?? "prime-qwen3b-smoke-runbook-2026-06-26-v1";
const repairSignalRunId = args["repair-signal-run-id"] ?? "repair-regeneration-signal-audit-joint-action-qwen3b-2026-06-27-v1";
const predictionRunId = args["prediction-run-id"] ?? "joint-action-qwen3b-smoke-eval-v1";

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const packet = await readResult(packetRunId);
const remoteGate = await readResult(remoteGateRunId);
const primeGate = await readResult(primeGateRunId);
const runbook = await readResult(runbookRunId);
const repairSignal = await readResult(repairSignalRunId);
const gitHead = runCommand("git", ["rev-parse", "HEAD"]);
const primeWhoami = runCommand("prime", ["--plain", "whoami"]);

const primeBackend = remoteGate.backends?.prime_intellect ?? {};
const projectedPrimeTotal = Number(remoteGate.budget_gate?.prime_estimated_total_after_gpu_and_judge_usd ?? Number.NaN);
const launchCommand = `RUN_ID=${predictionRunId} MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/${packetRunId}/run_joint_action_smoke.sh`;

const checks = [
  check("execute_flag_not_set", true, execute ? "execute=true was explicitly requested; readiness may be reported if every other gate passes." : "Dry-run/refusal mode; no pod creation is allowed."),
  check("budget_under_cap_now", Number(budget.spend_usd?.total_actual ?? 0) <= maxBudgetUsd, `Actual spend is $${Number(budget.spend_usd?.total_actual ?? 0).toFixed(6)} / $${maxBudgetUsd}.`),
  check("projected_prime_path_under_cap", projectedPrimeTotal <= maxBudgetUsd, `Projected Prime smoke plus judge total is $${projectedPrimeTotal.toFixed(6)} / $${maxBudgetUsd}.`),
  check("remote_gate_prime_ready", remoteGate.status === "remote_backend_ready_for_qwen3b_smoke" && primeBackend.status === "ready", `Remote gate status is ${remoteGate.status}; Prime backend status is ${primeBackend.status ?? "unknown"}.`),
  check("prime_auth_price_gate_ready", primeGate.status === "auth_and_live_price_verified", `Prime auth/price gate status is ${primeGate.status}.`),
  check("prime_cli_authenticated_now", primeWhoami.status === 0, commandEvidence(primeWhoami)),
  check("runbook_ready", runbook.status === "ready_after_prime_auth_and_live_price", `Runbook status is ${runbook.status}.`),
  check("repair_signal_present", repairSignal.status === "repair_regeneration_signal_present_but_untested", `Repair signal audit status is ${repairSignal.status}.`),
  check("packet_is_qwen3b_joint_action", packet.base_model === "Qwen/Qwen2.5-3B-Instruct" && packet.objective?.actions?.includes("repair_or_regenerate_when_answerable"), `Packet base model is ${packet.base_model}.`),
];

const blockers = checks.filter((row) => row.status === "fail").map((row) => row.id);
const wouldAllowPodCreation = execute === true && blockers.length === 0;
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "prime_guarded_smoke_entrypoint",
  status: wouldAllowPodCreation ? "ready_to_create_prime_pod" : "refuse_prime_pod_creation",
  purpose: "Single fail-closed launch predicate for the Qwen 3B Prime smoke. It joins current backend, Prime auth/price, runbook, repair-signal, packet, and budget evidence before any pod creation.",
  execute_requested: execute,
  inputs: {
    packet_run_id: packetRunId,
    prediction_run_id: predictionRunId,
    remote_gate_run_id: remoteGateRunId,
    prime_gate_run_id: primeGateRunId,
    runbook_run_id: runbookRunId,
    repair_signal_run_id: repairSignalRunId,
    git_head: gitHead.stdout.trim(),
  },
  checks,
  blockers,
  launch_decision: {
    pod_creation_allowed: wouldAllowPodCreation,
    reason: wouldAllowPodCreation
      ? "All gates passed and execute=true was requested."
      : "Pod creation is refused until execute=true and every launch gate passes.",
    current_blockers: blockers,
    dry_run_launch_command: launchCommand,
  },
  budget_gate: {
    max_budget_usd: maxBudgetUsd,
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual ?? 0),
    actual_external_compute_spend_usd: Number(budget.spend_usd?.external_compute ?? 0),
    remaining_budget_usd: Number(budget.spend_usd?.remaining ?? 0),
    projected_prime_total_after_smoke_and_judge_usd: projectedPrimeTotal,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This entrypoint reads local artifacts and runs read-only local CLI checks. It does not create pods, jobs, or model calls.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  pod_creation_allowed: result.launch_decision.pod_creation_allowed,
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
  return `# Prime Guarded Smoke Entrypoint

Generated: ${result.generated_at}

Status: \`${result.status}\`

This artifact is the fail-closed launch predicate for the Qwen 3B Prime smoke. It refuses pod creation unless the remote backend gate, Prime auth/price gate, runbook, repair-signal audit, packet check, budget check, and explicit execute flag all pass.

## Decision

- Pod creation allowed: \`${result.launch_decision.pod_creation_allowed}\`
- Reason: ${result.launch_decision.reason}
- Blockers: ${result.blockers.length ? result.blockers.join(", ") : "none"}

## Checks

${result.checks.map((row) => `- ${row.status === "pass" ? "PASS" : "FAIL"} ${row.id}: ${row.evidence}`).join("\n")}

## Budget

| Actual spend | External compute | Remaining | Projected Prime total | Cap |
| ---: | ---: | ---: | ---: | ---: |
| $${result.budget_gate.actual_total_spend_usd.toFixed(6)} | $${result.budget_gate.actual_external_compute_spend_usd.toFixed(6)} | $${result.budget_gate.remaining_budget_usd.toFixed(6)} | $${result.budget_gate.projected_prime_total_after_smoke_and_judge_usd.toFixed(6)} | $${result.budget_gate.max_budget_usd.toFixed(2)} |

Dry-run launch command after all gates pass:

\`\`\`bash
${result.launch_decision.dry_run_launch_command}
\`\`\`

This entrypoint makes no OpenAI calls, creates no GPU jobs, and records no spend.
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
