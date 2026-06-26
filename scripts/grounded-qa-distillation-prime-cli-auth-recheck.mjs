import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "prime-cli-upgrade-auth-recheck-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const checks = {
  version: await runPrime(["--version"]),
  whoami: await runPrime(["whoami"]),
  teams: await runPrime(["teams", "list"]),
  availability: await runPrime(["availability", "list"]),
};

const authBlocked = [checks.whoami, checks.teams, checks.availability].some((check) => check.error_class === "api_key_unauthorized");
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "prime_cli_auth_recheck",
  status: authBlocked ? "auth_blocked_after_cli_upgrade" : "auth_check_passed",
  purpose: "Verify whether upgrading the Prime CLI repairs the remote GPU execution blocker before spending on the Qwen 3B smoke.",
  target_packet: "joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1",
  cli_version: parsePrimeVersion(checks.version.output_excerpt.join("\n")),
  checks,
  conclusion: authBlocked
    ? {
        current_blocker: "Prime API key authorization",
        interpretation: "The Prime CLI upgrade succeeded, but authenticated account/team/availability commands still reject the saved key. This makes stale CLI version unlikely; a valid token or permissions repair is still required before balance, pricing, or GPU launch can be checked.",
        not_proven: ["Prime account balance", "team billing status", "live GPU pricing"],
      }
    : {
        current_blocker: null,
        interpretation: "Prime auth commands passed; the next step is live pricing and a budget-gated bounded smoke launch.",
        not_proven: [],
      },
  budget: {
    max_total_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    actual_external_compute_cost_usd: budget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This auth recheck runs local Prime CLI status commands only.",
  },
  next_step: authBlocked
    ? "Install a valid Prime API key through the hidden-input helper or complete browser login, then rerun this recheck before any pod creation."
    : "Query live GPU availability/pricing and run the existing budget-gated bounded Qwen 3B smoke command only if the total stays under $100.",
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

async function runPrime(args) {
  try {
    const { stdout, stderr } = await execFileAsync("prime", args, {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    return summarizeCommand(args, 0, `${stdout}${stderr}`);
  } catch (error) {
    return summarizeCommand(args, typeof error.code === "number" ? error.code : 1, `${error.stdout ?? ""}${error.stderr ?? ""}${error.message ?? ""}`);
  }
}

function summarizeCommand(args, exitCode, rawOutput) {
  const output = sanitizeOutput(rawOutput);
  return {
    command: ["prime", ...args].join(" "),
    exit_code: exitCode,
    status: output.includes("API key unauthorized") ? "failed" : exitCode === 0 ? "ok" : "failed",
    error_class: output.includes("API key unauthorized") ? "api_key_unauthorized" : exitCode === 0 ? null : "nonzero_exit",
    output_excerpt: output.split("\n").filter(Boolean).slice(0, 8),
  };
}

function sanitizeOutput(value) {
  return String(value)
    .replaceAll(/[A-Za-z0-9_-]{24,}/g, "REDACTED")
    .replaceAll(/pit_[A-Za-z0-9_-]+/g, "REDACTED")
    .trim();
}

function parsePrimeVersion(output) {
  const match = String(output).match(/Prime CLI version:\s*([^\s]+)/);
  return match?.[1] ?? null;
}

function renderReport(result) {
  return `# Prime CLI Auth Recheck

Generated: ${result.generated_at}

Status: \`${result.status}\`

Prime CLI version: \`${result.cli_version ?? "unknown"}\`

## Checks

| Command | Exit | Status | Error |
| --- | ---: | --- | --- |
${Object.values(result.checks).map((check) => `| \`${check.command}\` | ${check.exit_code} | ${check.status} | ${check.error_class ?? ""} |`).join("\n")}

## Conclusion

${result.conclusion.interpretation}

This recheck makes no OpenAI calls, launches no GPU jobs, and records no new spend.

Next step: ${result.next_step}
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
