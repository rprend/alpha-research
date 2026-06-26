import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const predictionRunId = args["prediction-run-id"] ?? "joint-action-qwen3b-smoke-eval-v1";
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1";
const runId = args["run-id"] ?? `qwen3b-remote-provenance-gate-${predictionRunId}`;
const outputDir = path.join(runDir, runId);
const predictionDir = path.join(runDir, predictionRunId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const files = {
  predictions_jsonl: path.join(predictionDir, "predictions.jsonl"),
  result_json: path.join(predictionDir, "result.json"),
  report_md: path.join(predictionDir, "report.md"),
  smoke_manifest_json: path.join(predictionDir, "smoke_manifest.json"),
  prime_pod_status_json: path.join(predictionDir, "prime_pod_status.json"),
  remote_environment_txt: path.join(predictionDir, "remote_environment.txt"),
  remote_smoke_bootstrap_manifest_json: path.join(predictionDir, "remote_smoke_bootstrap_manifest.json"),
};

const fileStatus = {};
for (const [key, file] of Object.entries(files)) {
  fileStatus[key] = await fileInfo(file);
}

const coreArtifactsComplete = ["predictions_jsonl", "result_json", "report_md", "smoke_manifest_json"].every((key) => fileStatus[key].exists);
const provenanceArtifactsComplete = ["prime_pod_status_json", "remote_environment_txt", "remote_smoke_bootstrap_manifest_json"].every((key) => fileStatus[key].exists);

const failures = [];
const warnings = [];

let evalResult = null;
let smokeManifest = null;
let bootstrapManifest = null;
let podStatus = null;
let remoteEnvironment = "";

if (fileStatus.result_json.exists) evalResult = await readJson(files.result_json);
if (fileStatus.smoke_manifest_json.exists) smokeManifest = await readJson(files.smoke_manifest_json);
if (fileStatus.remote_smoke_bootstrap_manifest_json.exists) bootstrapManifest = await readJson(files.remote_smoke_bootstrap_manifest_json);
if (fileStatus.prime_pod_status_json.exists) podStatus = await readJson(files.prime_pod_status_json);
if (fileStatus.remote_environment_txt.exists) remoteEnvironment = await fs.readFile(files.remote_environment_txt, "utf8");

if (coreArtifactsComplete) {
  if (evalResult?.run_id !== predictionRunId) failures.push(`Prediction result run_id does not match ${predictionRunId}.`);
  if (smokeManifest?.run_id !== predictionRunId) failures.push(`Smoke manifest run_id does not match ${predictionRunId}.`);
  if (Number(smokeManifest?.max_sft_steps) > 20) failures.push("Smoke manifest max_sft_steps exceeds 20.");
  if (Number(smokeManifest?.max_dpo_steps) > 10) failures.push("Smoke manifest max_dpo_steps exceeds 10.");
  if (smokeManifest?.push_to_hub !== false) failures.push("Smoke manifest must record push_to_hub=false.");
}

if (provenanceArtifactsComplete) {
  if (bootstrapManifest?.run_id !== predictionRunId) failures.push(`Bootstrap manifest run_id does not match ${predictionRunId}.`);
  if (bootstrapManifest?.packet_dir && !String(bootstrapManifest.packet_dir).includes(packetRunId)) {
    failures.push(`Bootstrap manifest packet_dir does not reference ${packetRunId}.`);
  }
  if (!bootstrapManifest?.artifacts?.remote_environment_txt) failures.push("Bootstrap manifest must reference remote_environment_txt.");
  if (!String(remoteEnvironment).includes("=== gpu ===")) failures.push("Remote environment must include GPU section.");
  if (!String(remoteEnvironment).includes("=== uv ===")) failures.push("Remote environment must include uv section.");
  const podText = JSON.stringify(podStatus).toLowerCase();
  if (!podText.includes("gpu") && !podText.includes("pod")) {
    warnings.push("Prime pod status does not visibly expose GPU or pod metadata; inspect provider schema manually.");
  }
}

const status = !coreArtifactsComplete
  ? "waiting_for_smoke_artifacts"
  : !provenanceArtifactsComplete
    ? "provenance_artifacts_missing"
    : failures.length
      ? "remote_provenance_failed"
      : "remote_provenance_ready_for_judge";

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen3b_remote_provenance_gate",
  status,
  purpose: "Fail-closed gate requiring remote execution provenance before treating a Qwen 3B smoke run as paper-grade evidence.",
  prediction_run_id: predictionRunId,
  packet_run_id: packetRunId,
  files: Object.fromEntries(Object.entries(fileStatus).map(([key, value]) => [key, { ...value, path: path.relative(rootDir, files[key]) }])),
  checks: {
    core_artifacts_complete: coreArtifactsComplete,
    provenance_artifacts_complete: provenanceArtifactsComplete,
    failures,
    warnings,
  },
  required_remote_provenance: [
    "prime_pod_status.json with provider/pod/GPU metadata captured before fetch.",
    "remote_environment.txt with date, uname, nvidia-smi, uv version, and git head.",
    "remote_smoke_bootstrap_manifest.json emitted by run_prime_qwen3b_smoke_on_pod.sh.",
    "smoke_manifest.json proving bounded MAX_SFT_STEPS=20, MAX_DPO_STEPS=10, PUSH_TO_HUB=false.",
  ],
  next_step: status === "remote_provenance_ready_for_judge"
    ? "Proceed to prediction integrity and dry judge gates."
    : status === "waiting_for_smoke_artifacts"
      ? "Run the bounded remote Qwen 3B smoke and fetch core plus provenance artifacts."
      : "Fetch or repair missing/invalid remote provenance before judging or claiming the Qwen run.",
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    external_compute_actual_usd: budget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This gate reads local artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({ run_id: result.run_id, status: result.status, checks: result.checks }, null, 2));

async function fileInfo(file) {
  try {
    const stat = await fs.stat(file);
    return { exists: true, bytes: stat.size };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { exists: false, bytes: 0 };
  }
}

function renderReport(result) {
  const rows = Object.entries(result.files).map(([key, value]) => `| ${key} | ${value.exists ? "yes" : "no"} | ${value.bytes} | \`${value.path}\` |`).join("\n");
  return `# Qwen 3B Remote Provenance Gate

Generated: ${result.generated_at}

Status: \`${result.status}\`

| Artifact | Exists | Bytes | Path |
| --- | --- | ---: | --- |
${rows}

## Required Remote Provenance

${result.required_remote_provenance.map((item) => `- ${item}`).join("\n")}

Failures: ${result.checks.failures.length}
Warnings: ${result.checks.warnings.length}

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
