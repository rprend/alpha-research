import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "qwen3b-local-control-non-substitution-audit-2026-06-26-v1";
const outputDir = path.join(runsDir, runId);
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2";
const finalSmokeRunId = args["final-smoke-run-id"] ?? "joint-action-qwen3b-smoke-eval-v1";
const controlRunIds = [
  "local-qwen3b-base-control-joint-action-12-v1",
  "local-qwen3b-citation-repair-local-qwen3b-base-control-joint-action-12-v1",
  "local-qwen3b-base-control-joint-action-final-window-v2",
  "local-qwen3b-citation-repair-local-qwen3b-base-control-final-window-v2",
];

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const controls = [];
for (const controlRunId of controlRunIds) {
  controls.push(await auditControl(controlRunId));
}

const passed = controls.every((control) => control.accepted_as_final_smoke === false)
  && controls.every((control) => control.production_gate_observations.integrity_status !== "ready_for_paid_judge")
  && controls.every((control) => control.production_gate_observations.remote_provenance_status !== "remote_provenance_ready_for_judge");

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen3b_local_control_non_substitution_audit",
  status: passed ? "local_controls_rejected_as_final_qwen_smoke" : "local_control_substitution_guard_failed",
  purpose: "Prove local Qwen 3B base and citation-repair controls cannot be treated as the final trained joint-action Qwen 3B smoke evidence.",
  packet_run_id: packetRunId,
  final_smoke_run_id: finalSmokeRunId,
  controls,
  required_final_smoke_evidence: [
    "69 final-window predictions from the trained joint-action adapter.",
    "smoke_manifest.json with bounded SFT/DPO smoke settings and run_id matching the final smoke run.",
    "prime_pod_status.json, remote_environment.txt, and remote_smoke_bootstrap_manifest.json for remote GPU provenance.",
    "A paid grounded-correctness judge run after prediction integrity and provenance gates pass.",
    "Qwen result integration and Pareto-table update from the real predictions and judge artifacts.",
  ],
  conclusion: passed
    ? "The local controls remain useful negative/control evidence, but production gates reject them as final trained-smoke substitutes."
    : "At least one local control was not rejected by the substitution checks; inspect before using Qwen evidence.",
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
    note: "This audit reads local artifacts and invokes zero-cost production gates in temporary directories only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({ run_id: result.run_id, status: result.status, controls: result.controls.map((row) => ({ run_id: row.run_id, accepted_as_final_smoke: row.accepted_as_final_smoke })) }, null, 2));

async function auditControl(controlRunId) {
  const controlDir = path.join(runsDir, controlRunId);
  const resultPath = path.join(controlDir, "result.json");
  const controlResult = await readJson(resultPath);
  const files = {
    predictions_jsonl: path.join(controlDir, "predictions.jsonl"),
    result_json: resultPath,
    report_md: path.join(controlDir, "report.md"),
    smoke_manifest_json: path.join(controlDir, "smoke_manifest.json"),
    prime_pod_status_json: path.join(controlDir, "prime_pod_status.json"),
    remote_environment_txt: path.join(controlDir, "remote_environment.txt"),
    remote_smoke_bootstrap_manifest_json: path.join(controlDir, "remote_smoke_bootstrap_manifest.json"),
  };
  const file_status = {};
  for (const [key, file] of Object.entries(files)) {
    file_status[key] = await fileInfo(file);
  }

  const integrityRunId = `.tmp-local-control-non-substitution-integrity-${controlRunId}`;
  const provenanceRunId = `.tmp-local-control-non-substitution-provenance-${controlRunId}`;
  const integrityDir = path.join(runsDir, integrityRunId);
  const provenanceDir = path.join(runsDir, provenanceRunId);
  await cleanup([integrityDir, provenanceDir]);

  const integrity = spawnSync(process.execPath, [
    "scripts/grounded-qa-distillation-qwen3b-prediction-integrity-gate.mjs",
    `--packet-run-id=${packetRunId}`,
    `--prediction-run-id=${controlRunId}`,
    `--run-id=${integrityRunId}`,
  ], { cwd: rootDir, encoding: "utf8" });
  const provenance = spawnSync(process.execPath, [
    "scripts/grounded-qa-distillation-qwen3b-remote-provenance-gate.mjs",
    `--packet-run-id=${packetRunId}`,
    `--prediction-run-id=${controlRunId}`,
    `--run-id=${provenanceRunId}`,
  ], { cwd: rootDir, encoding: "utf8" });

  const integrityResult = integrity.status === 0 ? await readJson(path.join(integrityDir, "result.json")) : null;
  const provenanceResult = provenance.status === 0 ? await readJson(path.join(provenanceDir, "result.json")) : null;
  const cleanupRemoved = await cleanup([integrityDir, provenanceDir]);

  const blockers = [
    controlRunId !== finalSmokeRunId ? "run_id_does_not_match_final_smoke" : null,
    controlResult.trained_adapter === null ? "no_trained_adapter" : null,
    file_status.smoke_manifest_json.exists === false ? "missing_smoke_manifest" : null,
    file_status.prime_pod_status_json.exists === false ? "missing_prime_pod_status" : null,
    file_status.remote_environment_txt.exists === false ? "missing_remote_environment" : null,
    file_status.remote_smoke_bootstrap_manifest_json.exists === false ? "missing_remote_bootstrap_manifest" : null,
    Number(controlResult.eval?.examples ?? 0) !== 69 ? "not_full_final_window_69_examples" : null,
  ].filter(Boolean);

  const integrityStatus = integrityResult?.conclusion?.status ?? "gate_failed_to_run";
  const provenanceStatus = provenanceResult?.status ?? "gate_failed_to_run";
  const acceptedAsFinal = blockers.length === 0
    && integrityStatus === "ready_for_paid_judge"
    && provenanceStatus === "remote_provenance_ready_for_judge";

  return {
    run_id: controlRunId,
    source_artifact_type: controlResult.artifact_type ?? controlResult.control_type ?? null,
    trained_adapter: controlResult.trained_adapter ?? null,
    eval_examples: controlResult.eval?.examples ?? null,
    file_status: Object.fromEntries(Object.entries(file_status).map(([key, value]) => [key, { ...value, path: path.relative(rootDir, files[key]) }])),
    substitution_blockers: blockers,
    production_gate_observations: {
      integrity_exit_status: integrity.status,
      integrity_status: integrityStatus,
      integrity_failure_count: integrityResult?.checks?.failures?.length ?? null,
      integrity_warning_count: integrityResult?.checks?.warnings?.length ?? null,
      remote_provenance_exit_status: provenance.status,
      remote_provenance_status: provenanceStatus,
      remote_core_artifacts_complete: provenanceResult?.checks?.core_artifacts_complete ?? null,
      remote_provenance_artifacts_complete: provenanceResult?.checks?.provenance_artifacts_complete ?? null,
      temporary_gate_dirs_removed: cleanupRemoved,
    },
    accepted_as_final_smoke: acceptedAsFinal,
  };
}

async function fileInfo(file) {
  try {
    const stat = await fs.stat(file);
    return { exists: true, bytes: stat.size };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { exists: false, bytes: 0 };
  }
}

async function cleanup(dirs) {
  for (const dir of dirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  for (const dir of dirs) {
    try {
      await fs.access(dir);
      return false;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return true;
}

function renderReport(result) {
  return `# Qwen 3B Local Control Non-Substitution Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

Final smoke run reserved for claims: \`${result.final_smoke_run_id}\`

| Control | Integrity gate | Remote provenance gate | Substitution blockers | Accepted as final smoke |
| --- | --- | --- | ---: | --- |
${result.controls.map((control) => `| \`${control.run_id}\` | \`${control.production_gate_observations.integrity_status}\` | \`${control.production_gate_observations.remote_provenance_status}\` | ${control.substitution_blockers.length} | ${control.accepted_as_final_smoke ? "yes" : "no"} |`).join("\n")}

## Required Final Smoke Evidence

${result.required_final_smoke_evidence.map((item) => `- ${item}`).join("\n")}

## Conclusion

${result.conclusion}

This audit makes no OpenAI calls, launches no GPU jobs, records no spend, and removes temporary gate directories.
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
