import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "prime-auth-price-gate-qwen3b-smoke-2026-06-26-v1";
const outputDir = path.join(runDir, runId);
const gpuType = args["gpu-type"] ?? "L4_24GB";
const gpuCount = Number(args["gpu-count"] ?? 1);
const maxBudgetUsd = Number(args["max-budget-usd"] ?? 100);
const plannedJudgeEstimateUsd = Number(args["planned-judge-estimate-usd"] ?? 0.467165);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const commands = {
  whoami: runPrime(["--plain", "whoami"]),
  wallet: null,
  availability: null,
};

const authOk = commands.whoami.status === 0;
if (authOk) {
  commands.wallet = runPrime(["--plain", "wallet"]);
  commands.availability = runPrime(["--plain", "availability", "list", "--gpu-type", gpuType, "--gpu-count", String(gpuCount), "--output", "json"]);
}

const availability = parseAvailability(commands.availability?.stdout);
const cheapest = availability.gpu_resources
  .filter((row) => String(row.stock_status ?? "").toLowerCase() !== "unavailable")
  .filter((row) => Number.isFinite(Number(row.price_value ?? row.price_per_hour)))
  .sort((a, b) => Number(a.price_value ?? a.price_per_hour) - Number(b.price_value ?? b.price_per_hour))[0] ?? null;
const plannedGpuEstimateUsd = cheapest ? Number(cheapest.price_value ?? cheapest.price_per_hour) * 1.0 : 4;
const estimatedTotal = Number(budget.spend_usd.total_actual) + plannedGpuEstimateUsd + plannedJudgeEstimateUsd;

const checks = [
  check("prime_whoami_authenticated", commands.whoami.status === 0, commandEvidence(commands.whoami)),
  check("prime_wallet_accessible", commands.wallet?.status === 0, commands.wallet ? commandEvidence(commands.wallet) : "Skipped because Prime auth failed."),
  check("prime_availability_accessible", commands.availability?.status === 0 && !availability.error, commands.availability ? availabilityEvidence(commands.availability, availability) : "Skipped because Prime auth failed."),
  check("gpu_resource_available", Boolean(cheapest), cheapest ? `Cheapest ${gpuType} resource id ${cheapest.id ?? "unknown"} at $${plannedGpuEstimateUsd}/hour.` : "No available resource parsed."),
  check("estimated_total_under_budget", estimatedTotal <= maxBudgetUsd, `Estimated total after GPU/hour estimate and judge: $${estimatedTotal.toFixed(6)} of $${maxBudgetUsd}.`),
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "prime_auth_price_gate",
  status: checks.every((row) => row.status === "pass") ? "auth_and_live_price_verified" : "auth_or_price_blocked",
  purpose: "Read-only Prime gate for the Qwen 3B smoke: verify auth, wallet access, live GPU availability/pricing, and budget before any pod creation.",
  requested_gpu: {
    gpu_type: gpuType,
    gpu_count: gpuCount,
  },
  commands,
  checks,
  live_price: {
    resources_returned: availability.gpu_resources.length,
    cheapest_available_resource: cheapest,
    planned_gpu_estimate_usd: plannedGpuEstimateUsd,
    planned_judge_estimate_usd: plannedJudgeEstimateUsd,
  },
  budget_gate: {
    max_budget_usd: maxBudgetUsd,
    actual_total_spend_usd: Number(budget.spend_usd.total_actual),
    actual_external_compute_spend_usd: Number(budget.spend_usd.external_compute),
    estimated_total_after_gpu_and_judge_usd: estimatedTotal,
    within_budget: estimatedTotal <= maxBudgetUsd,
  },
  next_step: checks.every((row) => row.status === "pass")
    ? "Proceed to the Prime runbook pod-create step only if the selected resource and expected runtime are still acceptable."
    : "Do not create a pod. Repair Prime token permissions or billing, then rerun this gate.",
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This gate runs read-only Prime CLI checks only. It does not launch compute.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  checks: result.checks.map(({ id, status }) => ({ id, status })),
}, null, 2));

function runPrime(commandArgs) {
  const completed = spawnSync("prime", commandArgs, { cwd: rootDir, encoding: "utf8" });
  return {
    command: ["prime", ...commandArgs].join(" "),
    status: completed.status,
    stdout: redact(completed.stdout.trim()).slice(0, 4000),
    stderr: redact(completed.stderr.trim()).slice(0, 4000),
  };
}

function parseAvailability(stdout) {
  if (!stdout) return { gpu_resources: [] };
  try {
    const parsed = JSON.parse(stdout);
    return {
      ...parsed,
      gpu_resources: Array.isArray(parsed.gpu_resources) ? parsed.gpu_resources : [],
    };
  } catch {
    return { gpu_resources: [], error: normalizeWhitespace(stdout).slice(0, 1000) };
  }
}

function availabilityEvidence(command, availability) {
  if (availability.error) return `Failed: ${command.command}; ${availability.error}`;
  return commandEvidence(command);
}

function redact(text) {
  return text
    .replace(/pit_[A-Za-z0-9]+/g, "pit_<redacted>")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer <redacted>");
}

function commandEvidence(command) {
  if (!command) return "Command not run.";
  if (command.status === 0) return `Passed: ${command.command}`;
  const errorText = command.stderr || command.stdout || "no output";
  return `Failed: ${command.command}; ${normalizeWhitespace(errorText)}`;
}

function check(id, passed, evidence) {
  return { id, status: passed ? "pass" : "fail", evidence };
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function renderReport(result) {
  return `# Prime Auth/Price Gate

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Checks

${result.checks.map((row) => `- ${row.status === "pass" ? "PASS" : "FAIL"} ${row.id}: ${row.evidence}`).join("\n")}

## Budget Gate

| Actual spend | External compute | Planned GPU estimate | Planned judge | Estimated total | Within $${result.budget_gate.max_budget_usd} |
| ---: | ---: | ---: | ---: | ---: | --- |
| $${result.budget_gate.actual_total_spend_usd.toFixed(6)} | $${result.budget_gate.actual_external_compute_spend_usd.toFixed(6)} | $${result.live_price.planned_gpu_estimate_usd.toFixed(6)} | $${result.live_price.planned_judge_estimate_usd.toFixed(6)} | $${result.budget_gate.estimated_total_after_gpu_and_judge_usd.toFixed(6)} | ${result.budget_gate.within_budget ? "yes" : "no"} |

Next step: ${result.next_step}

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
