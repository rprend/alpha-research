import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "prime-auth-repair-handoff-2026-06-27-v1";
const outputDir = path.join(runsDir, runId);
const apply = args.apply === "true";
const maxBudgetUsd = Number(args["max-budget-usd"] ?? 100);
const primeConfigPath = expandHome(args["prime-config"] ?? "~/.prime/config.json");
const secretEnvPath = expandHome(args["secret-env"] ?? "~/.codex/secrets.env");

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const keyPresent = typeof process.env.PRIME_API_KEY === "string" && process.env.PRIME_API_KEY.length > 20;
const initialConfig = await readPrimeConfig(primeConfigPath);
const initialKeyFingerprint = fingerprint(initialConfig?.api_key);

let configAction = {
  attempted: false,
  status: "not_attempted",
  reason: apply
    ? keyPresent ? "apply_requested_with_env_key" : "apply_requested_but_prime_api_key_env_missing"
    : "apply_flag_not_set",
  config_path: primeConfigPath,
  previous_key_fingerprint: initialKeyFingerprint,
  new_key_fingerprint: keyPresent ? fingerprint(process.env.PRIME_API_KEY) : null,
};

if (apply && keyPresent) {
  configAction = await applyPrimeKey(primeConfigPath, initialConfig, process.env.PRIME_API_KEY, initialKeyFingerprint);
}

const primeWhoami = runCommand("prime", ["--plain", "whoami"]);
const downstream = {
  prime_auth_price_gate: null,
  remote_backend_readiness_gate: null,
  prime_guarded_smoke_entrypoint: null,
};

if (apply && keyPresent) {
  downstream.prime_auth_price_gate = runCommand("node", [
    "scripts/grounded-qa-distillation-prime-auth-price-gate.mjs",
    "--run-id=prime-auth-price-gate-current-2026-06-27-v1",
    `--max-budget-usd=${maxBudgetUsd}`,
  ]);
  downstream.remote_backend_readiness_gate = runCommand("node", [
    "scripts/grounded-qa-distillation-remote-backend-readiness-gate.mjs",
    "--run-id=remote-backend-readiness-gate-qwen3b-smoke-2026-06-26-v1",
    "--prime-gate-run-id=prime-auth-price-gate-current-2026-06-27-v1",
    `--max-budget-usd=${maxBudgetUsd}`,
  ]);
  downstream.prime_guarded_smoke_entrypoint = runCommand("node", [
    "scripts/grounded-qa-distillation-prime-guarded-smoke-entrypoint.mjs",
    "--run-id=prime-guarded-smoke-entrypoint-2026-06-27-v1",
    "--prime-gate-run-id=prime-auth-price-gate-current-2026-06-27-v1",
    `--max-budget-usd=${maxBudgetUsd}`,
  ]);
}

const checks = [
  check("secret_env_path_recorded", Boolean(secretEnvPath), `Use ${secretEnvPath} with the hidden-input helper; do not paste keys into chat.`),
  check("apply_requires_explicit_flag", apply || !keyPresent, apply ? "apply=true was explicitly requested." : "No config write attempted without --apply=true."),
  check("prime_api_key_env_present_when_applying", !apply || keyPresent, keyPresent ? "PRIME_API_KEY is present in the process environment." : "PRIME_API_KEY is missing from the process environment."),
  check("config_write_safe_when_attempted", !configAction.attempted || configAction.status === "updated_prime_config", configAction.reason),
  check("prime_config_mode_private", await isPrivateFile(primeConfigPath), `${primeConfigPath} should be mode 0600 after repair.`),
  check("budget_under_cap_before_launch", Number(budget.spend_usd?.total_actual ?? 0) <= maxBudgetUsd, `Actual spend is $${Number(budget.spend_usd?.total_actual ?? 0).toFixed(6)} / $${maxBudgetUsd}.`),
  check("no_pod_creation_performed", true, "This handoff only updates local auth config and runs read-only gates; it never creates a Prime pod."),
];

const downstreamReady = downstream.prime_auth_price_gate?.status === 0
  && downstream.remote_backend_readiness_gate?.status === 0
  && downstream.prime_guarded_smoke_entrypoint?.status === 0;
const authOk = primeWhoami.status === 0;
const status = !apply
  ? "waiting_for_hidden_prime_key"
  : !keyPresent
    ? "prime_key_env_missing"
    : authOk && downstreamReady
      ? "prime_auth_repaired_gates_refreshed"
      : "prime_auth_repair_attempted_still_blocked";

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "prime_auth_repair_handoff",
  status,
  purpose: "Make the Prime auth repair path executable and secret-safe: consume PRIME_API_KEY from the hidden-input helper, update the local Prime CLI config only when explicitly requested, then rerun read-only auth/price/backend/launch gates before any pod creation.",
  apply_requested: apply,
  inputs: {
    secret_env_path: secretEnvPath,
    prime_config_path: primeConfigPath,
    max_budget_usd: maxBudgetUsd,
  },
  config_action: configAction,
  prime_whoami: summarizeCommand(primeWhoami),
  downstream_gate_refresh: {
    attempted: apply && keyPresent,
    prime_auth_price_gate: summarizeCommand(downstream.prime_auth_price_gate),
    remote_backend_readiness_gate: summarizeCommand(downstream.remote_backend_readiness_gate),
    prime_guarded_smoke_entrypoint: summarizeCommand(downstream.prime_guarded_smoke_entrypoint),
  },
  checks,
  next_commands: {
    collect_hidden_key: `${expandHome("~/.codex/scripts/ask-secret.sh")} PRIME_API_KEY ${secretEnvPath} "Enter Prime Intellect API key"`,
    apply_and_refresh_gates: `set -a; source ${secretEnvPath}; set +a; node scripts/grounded-qa-distillation-prime-auth-repair-handoff.mjs --apply=true --max-budget-usd=${maxBudgetUsd}`,
    launch_predicate_after_repair: "node scripts/grounded-qa-distillation-prime-guarded-smoke-entrypoint.mjs --prime-gate-run-id=prime-auth-price-gate-current-2026-06-27-v1",
  },
  budget: {
    max_budget_usd: maxBudgetUsd,
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual ?? 0),
    actual_external_compute_spend_usd: Number(budget.spend_usd?.external_compute ?? 0),
    remaining_budget_usd: Number(budget.spend_usd?.remaining ?? 0),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This handoff makes no OpenAI calls and launches no compute. Downstream commands are read-only Prime/Node gates.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  apply_requested: result.apply_requested,
  checks: result.checks.map(({ id, status }) => ({ id, status })),
  llm_budget: result.llm_budget,
}, null, 2));

async function applyPrimeKey(configPath, existingConfig, apiKey, previousFingerprint) {
  const config = existingConfig && typeof existingConfig === "object" ? existingConfig : {};
  const nextConfig = { ...config, api_key: apiKey };
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(configPath, 0o600);
  return {
    attempted: true,
    status: "updated_prime_config",
    reason: "PRIME_API_KEY was loaded from the process environment and written to the local Prime CLI config with mode 0600.",
    config_path: configPath,
    previous_key_fingerprint: previousFingerprint,
    new_key_fingerprint: fingerprint(apiKey),
  };
}

async function readPrimeConfig(configPath) {
  try {
    return JSON.parse(await fs.readFile(configPath, "utf8"));
  } catch {
    return null;
  }
}

async function isPrivateFile(file) {
  try {
    const stat = await fs.stat(file);
    return (stat.mode & 0o777) === 0o600;
  } catch {
    return false;
  }
}

function runCommand(command, commandArgs) {
  const completed = spawnSync(command, commandArgs, { cwd: rootDir, encoding: "utf8" });
  return {
    command: [command, ...commandArgs].join(" "),
    status: completed.status,
    stdout: redact(completed.stdout ?? "").trim().slice(0, 3000),
    stderr: redact(completed.stderr ?? "").trim().slice(0, 3000),
  };
}

function summarizeCommand(command) {
  if (!command) return null;
  return {
    command: command.command,
    status: command.status,
    stdout_excerpt: command.stdout.split("\n").filter(Boolean).slice(0, 8),
    stderr_excerpt: command.stderr.split("\n").filter(Boolean).slice(0, 8),
  };
}

function check(id, passed, evidence) {
  return { id, status: passed ? "pass" : "fail", evidence };
}

function fingerprint(value) {
  if (!value || typeof value !== "string") return null;
  return {
    prefix: value.slice(0, 4),
    suffix: value.slice(-4),
    length: value.length,
  };
}

function redact(text) {
  return String(text)
    .replace(/pit_[A-Za-z0-9_-]+/g, "pit_<redacted>")
    .replace(/hf_[A-Za-z0-9_-]+/g, "hf_<redacted>")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer <redacted>")
    .replace(/PRIME_API_KEY=[^\s]+/g, "PRIME_API_KEY=<redacted>");
}

function expandHome(value) {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function renderReport(result) {
  return `# Prime Auth Repair Handoff

Generated: ${result.generated_at}

Status: \`${result.status}\`

This artifact makes the Prime credential repair path explicit without storing or printing the secret. It only writes \`~/.prime/config.json\` when \`--apply=true\` is supplied and \`PRIME_API_KEY\` is present in the environment.

## Checks

${result.checks.map((row) => `- ${row.status === "pass" ? "PASS" : "FAIL"} ${row.id}: ${row.evidence}`).join("\n")}

## Commands

Collect the key with hidden input:

\`\`\`bash
${result.next_commands.collect_hidden_key}
\`\`\`

Apply it and refresh read-only gates:

\`\`\`bash
${result.next_commands.apply_and_refresh_gates}
\`\`\`

Check the Prime launch predicate after repair:

\`\`\`bash
${result.next_commands.launch_predicate_after_repair}
\`\`\`

## Budget

Actual spend remains $${result.budget.actual_total_spend_usd.toFixed(6)} with $${result.budget.actual_external_compute_spend_usd.toFixed(6)} external compute spend. Remaining budget is $${result.budget.remaining_budget_usd.toFixed(6)} under the $${result.budget.max_budget_usd.toFixed(2)} cap.

This handoff makes no OpenAI calls, creates no pod, launches no GPU job, and records no spend.
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
