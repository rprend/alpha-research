import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const spendDir = path.join(experimentDir, "spend");
const args = parseArgs(process.argv.slice(2));

const predictionRunId = args["prediction-run-id"] ?? "joint-action-qwen3b-smoke-eval-v1";
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1";
const runId = args["run-id"] ?? `joint-action-smoke-ledger-finalizer-${predictionRunId}`;
const provider = args.provider ?? "prime_intellect";
const backendRunId = args["backend-run-id"] ?? predictionRunId;
const status = args.status ?? "pending";
const actualCostUsd = numberArg(args["actual-cost-usd"], 0);
const maxBudgetUsd = numberArg(args["max-budget-usd"], 100);
const record = args.record === "true";
const outputDir = path.join(runsDir, runId);
const predictionDir = path.join(runsDir, predictionRunId);
const ledgerPath = path.join(spendDir, "ledger.jsonl");

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(spendDir, { recursive: true });

const budget = await readJson(path.join(spendDir, "budget.json"));
const ledger = await readJsonlIfPresent(ledgerPath);
const currentExternalSpend = sum(ledger.map((row) => row.cost_usd));
const currentOpenaiSpend = Number(budget.spend_usd?.openai ?? 0);
const wouldTotal = currentOpenaiSpend + currentExternalSpend + actualCostUsd;
const artifactStatus = await inspectSmokeArtifacts(predictionDir);
const completedArtifactsOk = Object.values(artifactStatus.required).every((row) => row.exists);
const terminalStatus = ["completed", "failed_after_creation", "cancelled_after_creation"].includes(status);
const duplicateActual = ledger.find((row) => row.run_id === backendRunId && row.status === status && Number(row.cost_usd) === actualCostUsd);
const canRecord = record
  && terminalStatus
  && actualCostUsd >= 0
  && wouldTotal <= maxBudgetUsd + 1e-9
  && (status !== "completed" || completedArtifactsOk)
  && !duplicateActual;

const actualRow = {
  ts: new Date().toISOString(),
  provider,
  task: "joint_action_qwen3b_gpu_smoke_actual",
  run_id: backendRunId,
  prediction_run_id: predictionRunId,
  packet_run_id: packetRunId,
  status,
  cost_usd: actualCostUsd,
  budget_cap_usd: maxBudgetUsd,
  artifacts_complete: completedArtifactsOk,
  artifacts: Object.fromEntries(Object.entries(artifactStatus.required).map(([key, value]) => [key, value.path])),
  note: "Actual external compute row for the Qwen 3B joint-action smoke. Record only after backend billing/cost is known.",
};

let ledgerAction = "not_recorded";
if (record) {
  if (!terminalStatus) ledgerAction = "refused_non_terminal_status";
  else if (wouldTotal > maxBudgetUsd + 1e-9) ledgerAction = "refused_budget_exceeded";
  else if (status === "completed" && !completedArtifactsOk) ledgerAction = "refused_missing_completed_artifacts";
  else if (duplicateActual) ledgerAction = "already_recorded";
  else if (canRecord) {
    await fs.appendFile(ledgerPath, `${JSON.stringify(actualRow)}\n`);
    ledgerAction = "recorded";
  }
}

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "joint_action_smoke_ledger_finalizer",
  status: deriveStatus({ artifactStatus, terminalStatus, ledgerAction, record, status }),
  provider,
  backend_run_id: backendRunId,
  prediction_run_id: predictionRunId,
  packet_run_id: packetRunId,
  record_requested: record,
  requested_completion_status: status,
  artifact_status: artifactStatus,
  budget_gate: {
    max_budget_usd: maxBudgetUsd,
    openai_actual_usd: currentOpenaiSpend,
    external_compute_actual_before_record_usd: currentExternalSpend,
    actual_cost_to_record_usd: actualCostUsd,
    total_if_recorded_usd: wouldTotal,
    within_budget: wouldTotal <= maxBudgetUsd + 1e-9,
  },
  ledger: {
    path: path.relative(rootDir, ledgerPath),
    action: ledgerAction,
    duplicate_actual_row_found: Boolean(duplicateActual),
    actual_row: actualRow,
  },
  next_steps: nextSteps({ completedArtifactsOk, status, ledgerAction }),
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: ledgerAction === "recorded" ? actualCostUsd : 0,
    note: ledgerAction === "recorded"
      ? "This run records already-incurred external compute spend; it does not launch compute."
      : "This run inspects local artifacts and records no spend.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  ledger_action: result.ledger.action,
  artifacts_complete: completedArtifactsOk,
  total_if_recorded_usd: result.budget_gate.total_if_recorded_usd,
}, null, 2));

async function inspectSmokeArtifacts(dir) {
  const required = {
    predictions_jsonl: await fileInfo(path.join(dir, "predictions.jsonl")),
    result_json: await fileInfo(path.join(dir, "result.json")),
    report_md: await fileInfo(path.join(dir, "report.md")),
    smoke_manifest_json: await fileInfo(path.join(dir, "smoke_manifest.json")),
  };
  let result = null;
  if (required.result_json.exists) {
    result = await readJson(path.join(dir, "result.json"));
  }
  return {
    prediction_dir: path.relative(rootDir, dir),
    required,
    eval_examples: Number(result?.eval?.examples ?? 0),
    eval_answered: Number(result?.eval?.answered ?? 0),
    eval_abstained: Number(result?.eval?.abstained ?? 0),
  };
}

async function fileInfo(file) {
  try {
    const stat = await fs.stat(file);
    return { exists: true, path: path.relative(rootDir, file), bytes: stat.size };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { exists: false, path: path.relative(rootDir, file), bytes: 0 };
  }
}

function deriveStatus({ artifactStatus, terminalStatus, ledgerAction, record, status }) {
  const complete = Object.values(artifactStatus.required).every((row) => row.exists);
  if (!complete) return "waiting_for_smoke_artifacts";
  if (!record) return "artifacts_ready_for_actual_cost_record";
  if (!terminalStatus) return "refused_non_terminal_status";
  if (ledgerAction === "recorded" || ledgerAction === "already_recorded") return `actual_${status}_recorded`;
  return ledgerAction;
}

function nextSteps({ completedArtifactsOk, status, ledgerAction }) {
  if (!completedArtifactsOk) {
    return [
      "Run the bounded Qwen 3B smoke command on a GPU backend.",
      "Rerun this finalizer after predictions, result, report, and smoke manifest exist.",
    ];
  }
  if (ledgerAction === "not_recorded") {
    return [
      "Read backend billing/cost for the smoke.",
      "Rerun with --record=true --status=completed --actual-cost-usd=<cost> after the cost is known.",
      "Regenerate total budget, integrity gate, dry judge, and then paid judge if budget remains under $100.",
    ];
  }
  return [
    "Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.",
    "Run the Qwen 3B post-smoke pipeline default mode before any paid judge.",
  ];
}

function renderReport(result) {
  return `# Joint-Action Smoke Ledger Finalizer

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
${Object.entries(result.artifact_status.required).map(([key, value]) => `| ${key} | ${value.exists ? "yes" : "no"} | ${value.bytes} |`).join("\n")}

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $${result.budget_gate.max_budget_usd} |
| ---: | ---: | ---: | ---: | --- |
| $${result.budget_gate.openai_actual_usd.toFixed(6)} | $${result.budget_gate.external_compute_actual_before_record_usd.toFixed(6)} | $${result.budget_gate.actual_cost_to_record_usd.toFixed(6)} | $${result.budget_gate.total_if_recorded_usd.toFixed(6)} | ${result.budget_gate.within_budget ? "yes" : "no"} |

Ledger action: \`${result.ledger.action}\`

## Next Steps

${result.next_steps.map((step) => `- ${step}`).join("\n")}
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonlIfPresent(file) {
  try {
    return await readJsonl(file);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
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
