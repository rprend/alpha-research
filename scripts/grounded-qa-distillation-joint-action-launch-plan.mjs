import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const llmDir = path.join(experimentDir, "llm-calls");
const spendDir = path.join(experimentDir, "spend");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run"] ?? "joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2";
const preflightRunId = args["preflight-run"] ?? `joint-action-launch-preflight-${packetRunId}`;
const provider = args.provider ?? "prime_intellect";
const runId = args["run-id"] ?? `joint-action-launch-plan-${provider}-qwen3b-smoke-v1`;
const estimatedCostUsd = numberArg(args["estimated-cost-usd"], 4);
const maxBudgetUsd = numberArg(args["max-budget-usd"], 100);
const recordPlanned = args["record-planned"] === "true";
const smokeRunId = args["smoke-run-id"] ?? "joint-action-qwen3b-smoke-eval-v1";
const baseModel = args["base-model"] ?? "";
const outputDir = path.join(runDir, runId);
const spendLedgerPath = path.join(spendDir, "ledger.jsonl");

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(spendDir, { recursive: true });

const packet = JSON.parse(await fs.readFile(path.join(runDir, packetRunId, "result.json"), "utf8"));
const preflight = JSON.parse(await fs.readFile(path.join(runDir, preflightRunId, "result.json"), "utf8"));
const llmLedger = await readJsonl(path.join(llmDir, "ledger.jsonl"));
const spendLedger = await readJsonlIfPresent(spendLedgerPath);
const openaiActual = sum(llmLedger.map((row) => row.cost_usd));
const externalActual = sum(spendLedger.map((row) => row.cost_usd));
const totalActual = openaiActual + externalActual;
const remainingBeforePlan = maxBudgetUsd - totalActual;
const duplicatePlan = spendLedger.find((row) => row.run_id === runId && row.status === "planned");
const budgetOk = totalActual + estimatedCostUsd <= maxBudgetUsd + 1e-9;
const preflightOk = isPreflightOk(preflight);
const launchCommand = boundedLaunchCommand(packetRunId);
const plannedModelLabel = baseModel.includes("7B") ? "qwen7b" : packet.base_model?.includes("7B") ? "qwen7b" : "qwen3b";
const ledgerRow = {
  ts: new Date().toISOString(),
  provider,
  task: `joint_action_${plannedModelLabel}_gpu_smoke_planned`,
  run_id: runId,
  status: "planned",
  estimated_cost_usd: estimatedCostUsd,
  cost_usd: 0,
  budget_cap_usd: maxBudgetUsd,
  packet_run_id: packetRunId,
  preflight_run_id: preflightRunId,
  bounded_command: launchCommand,
  note: `Planned bounded ${plannedModelLabel.toUpperCase()} joint-action SFT/DPO smoke. Record actual cost after completion or failed creation.`,
};

let ledger_action = "not_recorded";
if (recordPlanned) {
  if (!budgetOk) {
    ledger_action = "refused_budget";
  } else if (!preflightOk) {
    ledger_action = "refused_preflight";
  } else if (duplicatePlan && (duplicatePlan.bounded_command !== launchCommand || duplicatePlan.provider !== provider || duplicatePlan.packet_run_id !== packetRunId || duplicatePlan.preflight_run_id !== preflightRunId)) {
    await rewritePlannedRow(spendLedgerPath, spendLedger, runId, ledgerRow);
    ledger_action = "updated_existing_planned_row";
  } else if (duplicatePlan) {
    ledger_action = "already_recorded";
  } else {
    await fs.appendFile(spendLedgerPath, `${JSON.stringify(ledgerRow)}\n`);
    ledger_action = "recorded";
  }
}

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  provider,
  packet_run_id: packetRunId,
  preflight_run_id: preflightRunId,
  base_model: packet.base_model,
  estimated_cost_usd: estimatedCostUsd,
  budget: {
    max_budget_usd: maxBudgetUsd,
    openai_actual_usd: openaiActual,
    external_compute_actual_usd: externalActual,
    total_actual_before_plan_usd: totalActual,
    remaining_before_plan_usd: remainingBeforePlan,
    estimated_launch_cost_usd: estimatedCostUsd,
    estimated_total_if_launched_usd: totalActual + estimatedCostUsd,
    launch_within_budget: budgetOk,
  },
  preflight_gate: {
    status: preflight.conclusion?.status,
    dataset_validation_passed: preflight.checks?.dataset_validation?.passed === true,
    train_script_compile_passed: preflight.checks?.train_script_compile?.passed === true,
    launch_safety_passed: Object.values(preflight.checks?.launch_safety ?? {}).every(Boolean),
    prompt_rows_over_limit: promptRowsOverLimit(preflight),
    passed: preflightOk,
  },
  smoke_contract: {
    max_sft_steps: 20,
    max_dpo_steps: 10,
    smoke_run_id: smokeRunId,
    base_model_override: baseModel || null,
    push_to_hub: false,
    report_to: "none",
  },
  commands: {
    validate_dataset: `uv run docs/experiments/grounded-qa-distillation/runs/${packetRunId}/validate_joint_action_dataset_uv.py`,
    bounded_train: launchCommand,
  },
  ledger: {
    record_planned_requested: recordPlanned,
    action: ledger_action,
    duplicate_planned_row_found: Boolean(duplicatePlan),
    ledger_path: path.relative(rootDir, spendLedgerPath),
    planned_row: ledgerRow,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "Launch planning makes no OpenAI calls and creates no GPU job.",
  },
  conclusion: conclude({ budgetOk, preflightOk, ledger_action, provider }),
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function boundedLaunchCommand(packetRunId) {
  const script = `docs/experiments/grounded-qa-distillation/runs/${packetRunId}/run_joint_action_smoke.sh`;
  const baseModelEnv = baseModel ? `BASE_MODEL=${shellQuote(baseModel)} ` : "";
  return `${baseModelEnv}RUN_ID=${shellQuote(smokeRunId)} MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none ${script}`;
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(value)) return value;
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function isPreflightOk(preflight) {
  return preflight.checks?.dataset_validation?.passed === true
    && preflight.checks?.train_script_compile?.passed === true
    && Object.values(preflight.checks?.launch_safety ?? {}).every(Boolean)
    && (
      promptRowsOverLimit(preflight) === 0
      || preflight.conclusion?.status === "ready_for_bounded_gpu_smoke_with_length_truncation_risk"
    );
}

function promptRowsOverLimit(preflight) {
  const profile = preflight.checks?.prompt_profile ?? {};
  return Number(profile.sft_full?.rows_over_limit ?? 0)
    + Number(profile.dpo_prompt?.rows_over_limit ?? 0)
    + Number(profile.dpo_full?.rows_over_limit ?? 0);
}

function conclude({ budgetOk, preflightOk, ledger_action, provider }) {
  if (!budgetOk) {
    return {
      status: "refuse_launch_budget_exceeded",
      next_step: "Do not launch; lower the planned spend or increase the explicit budget cap.",
    };
  }
  if (!preflightOk) {
    return {
      status: "refuse_launch_preflight_failed",
      next_step: "Fix the packet, script, safety, or length checks before any paid launch.",
    };
  }
  if (ledger_action === "recorded" || ledger_action === "already_recorded" || ledger_action === "updated_existing_planned_row") {
    return {
      status: "ready_for_backend_auth_then_launch",
      next_step: provider === "prime_intellect"
        ? "Refresh Prime auth, verify pricing, then run the bounded command from this artifact."
        : "Repair backend billing/auth, verify pricing, then run the bounded command from this artifact.",
    };
  }
  return {
    status: "dry_plan_ready",
    next_step: "Rerun with --record-planned=true immediately before launching paid compute.",
  };
}

function renderReport(result) {
  return `# Joint-Action Launch Plan

## Scope

- Provider: \`${result.provider}\`
- Packet: \`${result.packet_run_id}\`
- Preflight: \`${result.preflight_run_id}\`
- Base model: \`${result.base_model}\`
- Estimated smoke cost: $${result.estimated_cost_usd.toFixed(2)}
- Planned ledger action: \`${result.ledger.action}\`

## Budget Gate

| Item | USD |
| --- | ---: |
| OpenAI actual | $${result.budget.openai_actual_usd.toFixed(8)} |
| External compute actual | $${result.budget.external_compute_actual_usd.toFixed(8)} |
| Total actual before plan | $${result.budget.total_actual_before_plan_usd.toFixed(8)} |
| Remaining before plan | $${result.budget.remaining_before_plan_usd.toFixed(8)} |
| Estimated total if launched | $${result.budget.estimated_total_if_launched_usd.toFixed(8)} |

Launch within budget: \`${result.budget.launch_within_budget}\`

## Preflight Gate

| Check | Result |
| --- | --- |
| Dataset validation | ${result.preflight_gate.dataset_validation_passed ? "passed" : "failed"} |
| Train script compile | ${result.preflight_gate.train_script_compile_passed ? "passed" : "failed"} |
| Launch safety | ${result.preflight_gate.launch_safety_passed ? "passed" : "failed"} |
| Prompt rows over limit | ${result.preflight_gate.prompt_rows_over_limit} |

## Commands

\`\`\`bash
${result.commands.validate_dataset}
${result.commands.bounded_train}
\`\`\`

## Conclusion

Status: \`${result.conclusion.status}\`

Next step: ${result.conclusion.next_step}
`;
}

async function readJsonlIfPresent(file) {
  try {
    return await readJsonl(file);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function rewritePlannedRow(file, rows, runId, replacement) {
  const rewritten = rows.map((row) => {
    if (row.run_id === runId && row.status === "planned") return replacement;
    return row;
  });
  await fs.writeFile(file, `${rewritten.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
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
