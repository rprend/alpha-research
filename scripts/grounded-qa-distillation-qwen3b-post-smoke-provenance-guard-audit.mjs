import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "qwen3b-post-smoke-provenance-guard-audit-2026-06-27-v1";
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2";
const outputDir = path.join(runsDir, runId);
const evalPromptsPath = path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl");

const fixturePredictionRunId = ".tmp-qwen-post-smoke-provenance-guard-pred";
const fixturePipelineRunId = ".tmp-qwen-post-smoke-provenance-guard-pipeline";
const fixtureIntegrityRunId = ".tmp-qwen-post-smoke-provenance-guard-integrity";
const fixtureProvenanceRunId = ".tmp-qwen-post-smoke-provenance-guard-provenance";
const fixtureDryJudgeRunId = ".tmp-qwen-post-smoke-provenance-guard-dry-judge";
const fixturePaidJudgeRunId = ".tmp-qwen-post-smoke-provenance-guard-paid-judge";
const fixtureDirs = [
  fixturePredictionRunId,
  fixturePipelineRunId,
  fixtureIntegrityRunId,
  fixtureProvenanceRunId,
  fixtureDryJudgeRunId,
  fixturePaidJudgeRunId,
].map((id) => path.join(runsDir, id));

await fs.mkdir(outputDir, { recursive: true });
await cleanup(fixtureDirs);

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const evalRows = await readJsonl(evalPromptsPath);
await writePredictionFixture(path.join(runsDir, fixturePredictionRunId), evalRows);

const completed = spawnSync(process.execPath, [
  "scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs",
  `--packet-run-id=${packetRunId}`,
  `--prediction-run-id=${fixturePredictionRunId}`,
  `--run-id=${fixturePipelineRunId}`,
  `--integrity-run-id=${fixtureIntegrityRunId}`,
  `--provenance-run-id=${fixtureProvenanceRunId}`,
  `--dry-judge-run-id=${fixtureDryJudgeRunId}`,
  `--paid-judge-run-id=${fixturePaidJudgeRunId}`,
  "--require-ready=true",
], { cwd: rootDir, encoding: "utf8" });

const pipeline = await readJsonIfPresent(path.join(runsDir, fixturePipelineRunId, "result.json"));
const integrity = await readJsonIfPresent(path.join(runsDir, fixtureIntegrityRunId, "result.json"));
const provenance = await readJsonIfPresent(path.join(runsDir, fixtureProvenanceRunId, "result.json"));
const dryJudgeExists = await exists(path.join(runsDir, fixtureDryJudgeRunId, "result.json"));
const paidJudgeExists = await exists(path.join(runsDir, fixturePaidJudgeRunId, "result.json"));
const cleanupRemoved = await cleanup(fixtureDirs);

const passed = completed.status === 1
  && integrity?.conclusion?.status === "ready_for_paid_judge"
  && provenance?.status === "provenance_artifacts_missing"
  && pipeline?.conclusion?.status === "failed_remote_provenance_not_ready"
  && dryJudgeExists === false
  && paidJudgeExists === false
  && cleanupRemoved === true;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen3b_post_smoke_provenance_guard_audit",
  status: passed ? "post_smoke_provenance_guard_verified" : "post_smoke_provenance_guard_failed",
  purpose: "Prove the guarded Qwen 3B post-smoke pipeline refuses dry and paid judging when predictions pass integrity but remote provenance artifacts are missing.",
  packet_run_id: packetRunId,
  fixture: {
    prediction_run_id: fixturePredictionRunId,
    pipeline_run_id: fixturePipelineRunId,
    integrity_run_id: fixtureIntegrityRunId,
    provenance_run_id: fixtureProvenanceRunId,
    dry_judge_run_id: fixtureDryJudgeRunId,
    paid_judge_run_id: fixturePaidJudgeRunId,
    pipeline_exit_status: completed.status,
    expected_pipeline_exit_status: 1,
    stderr_tail: completed.stderr.trim().slice(-1200),
    stdout_tail: completed.stdout.trim().slice(-1200),
    temporary_fixture_runs_removed: cleanupRemoved,
  },
  observations: {
    integrity_status: integrity?.conclusion?.status ?? null,
    integrity_failures: integrity?.checks?.failures?.length ?? null,
    provenance_status: provenance?.status ?? null,
    provenance_core_artifacts_complete: provenance?.checks?.core_artifacts_complete ?? null,
    provenance_artifacts_complete: provenance?.checks?.provenance_artifacts_complete ?? null,
    pipeline_status: pipeline?.conclusion?.status ?? null,
    dry_judge_result_created: dryJudgeExists,
    paid_judge_result_created: paidJudgeExists,
  },
  expected_guard_behavior: [
    "Prediction integrity can pass on a complete local fixture.",
    "Remote provenance must fail when prime_pod_status.json, remote_environment.txt, and remote_smoke_bootstrap_manifest.json are absent.",
    "The post-smoke pipeline must exit before dry judge creation.",
    "No OpenAI judge calls or external compute may occur in this audit.",
  ],
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
    note: "This audit creates local synthetic artifacts and invokes zero-cost production gates only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  observations: result.observations,
}, null, 2));

async function writePredictionFixture(dir, rows) {
  await fs.mkdir(dir, { recursive: true });
  const predictions = rows.map((row) => {
    const prediction = normalizePrediction(row.reference);
    return {
      example_id: row.example_id,
      prediction,
      reference: row.reference,
      scores: {
        answer_type_correct: true,
        valid_json: true,
        citation_precision: prediction.citations.length ? 1 : null,
        citation_recall: prediction.citations.length ? 1 : null,
      },
      metadata: {
        base_model: "Qwen/Qwen2.5-3B-Instruct",
        adapter: "synthetic-post-smoke-provenance-guard-fixture",
        fixture: true,
      },
    };
  });
  const answered = predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length;
  const citationRows = predictions.filter((row) => row.prediction.citations.length);
  await fs.writeFile(path.join(dir, "predictions.jsonl"), `${predictions.map((row) => JSON.stringify(row)).join("\n")}\n`);
  await fs.writeFile(path.join(dir, "report.md"), "# Synthetic post-smoke provenance guard prediction fixture\n");
  await fs.writeFile(path.join(dir, "result.json"), `${JSON.stringify({
    run_id: path.basename(dir),
    eval: {
      examples: predictions.length,
      answered,
      abstained: predictions.length - answered,
      answer_rate: answered / predictions.length,
      citation_precision: citationRows.length ? 1 : null,
      citation_recall: citationRows.length ? 1 : null,
      answer_token_f1: 1,
      inline_citation_rate: 1,
    },
    cost: {
      openai_calls: 0,
      openai_cost_usd: 0,
    },
  }, null, 2)}\n`);
  await fs.writeFile(path.join(dir, "smoke_manifest.json"), `${JSON.stringify({
    run_id: path.basename(dir),
    max_sft_steps: 20,
    max_dpo_steps: 10,
    push_to_hub: false,
    fixture: true,
    omitted_on_purpose: [
      "prime_pod_status.json",
      "remote_environment.txt",
      "remote_smoke_bootstrap_manifest.json",
    ],
  }, null, 2)}\n`);
}

function normalizePrediction(reference) {
  const prediction = structuredClone(reference);
  if (prediction.answer_type === "abstain") {
    prediction.citations = [];
    return prediction;
  }
  const citationIds = new Set();
  for (const citation of prediction.citations ?? []) {
    if (typeof citation === "string") citationIds.add(citation);
    else if (citation?.evidence_id) citationIds.add(citation.evidence_id);
  }
  for (const claim of prediction.claim_table ?? []) {
    for (const citation of claim.citations ?? []) {
      if (typeof citation === "string") citationIds.add(citation);
      else if (citation?.evidence_id) citationIds.add(citation.evidence_id);
    }
  }
  prediction.citations = [...citationIds];
  for (const citation of prediction.citations) {
    if (!prediction.answer.includes(`[${citation}]`)) prediction.answer = `${prediction.answer} [${citation}]`;
  }
  return prediction;
}

function renderReport(result) {
  return `# Qwen 3B Post-Smoke Provenance Guard Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

| Observation | Value |
| --- | --- |
| Integrity status | \`${result.observations.integrity_status}\` |
| Provenance status | \`${result.observations.provenance_status}\` |
| Pipeline status | \`${result.observations.pipeline_status}\` |
| Dry judge result created | ${result.observations.dry_judge_result_created ? "yes" : "no"} |
| Paid judge result created | ${result.observations.paid_judge_result_created ? "yes" : "no"} |

## Expected Guard Behavior

${result.expected_guard_behavior.map((item) => `- ${item}`).join("\n")}

This audit makes no OpenAI calls, launches no GPU jobs, records no spend, and removes temporary fixture run directories.
`;
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

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return false;
  }
}

async function readJsonIfPresent(file) {
  try {
    return await readJson(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
