import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "final-evidence-checklist-qwen3b-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const readiness = await readResult("paper-readiness-gate-2026-06-26-v1");
const remotePlan = await readResult("joint-action-remote-smoke-plan-joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1");
const launchPlan = await readResult("joint-action-launch-plan-prime-qwen3b-smoke-v1");
const judgePlan = await readResult("joint-action-judge-plan-joint-action-qwen3b-smoke-eval-v1");
const integrityGate = await readResult("qwen3b-prediction-integrity-gate-joint-action-qwen3b-smoke-eval-v1");
const postSmokePipeline = await readResult("qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1");
const abstentionReliability = await readResult("abstention-boundary-reliability-audit-2026-06-26-v1");

const currentSpend = Number(budget.spend_usd.total_actual);
const plannedGpuEstimate = Number(launchPlan.estimated_cost_usd ?? remotePlan.budget_context?.planned_gpu_estimate_usd ?? 4);
const plannedJudgeEstimate = Number(judgePlan.budget_gate?.estimated_judge_cost_usd ?? remotePlan.budget_context?.planned_judge_estimate_usd ?? 0);
const estimatedTotal = currentSpend + plannedGpuEstimate + plannedJudgeEstimate;
const expectedPredictionRunId = judgePlan.prediction_run_id;
const expectedPredictionDir = path.join(runDir, expectedPredictionRunId);
const expectedArtifacts = {
  predictions_jsonl: path.relative(rootDir, path.join(expectedPredictionDir, "predictions.jsonl")),
  result_json: path.relative(rootDir, path.join(expectedPredictionDir, "result.json")),
  report_md: path.relative(rootDir, path.join(expectedPredictionDir, "report.md")),
  smoke_manifest_json: path.relative(rootDir, path.join(expectedPredictionDir, "smoke_manifest.json")),
  integrity_result_json: path.relative(rootDir, path.join(runDir, integrityGate.run_id, "result.json")),
  dry_judge_result_json: path.relative(rootDir, path.join(runDir, judgePlan.judge_run_id + "-dry-run", "result.json")),
  paid_judge_result_json: path.relative(rootDir, path.join(runDir, judgePlan.judge_run_id, "result.json")),
};

const acceptanceCriteria = [
  criterion("auth_and_pricing_verified", "Prime/HF auth works and live GPU price keeps estimated total under $100.", false, "Prime key is still unauthorized and HF credits are insufficient."),
  criterion("smoke_artifacts_complete", "Bounded Qwen 3B smoke creates predictions, eval result, report, and smoke manifest.", await allExist([
    path.join(expectedPredictionDir, "predictions.jsonl"),
    path.join(expectedPredictionDir, "result.json"),
    path.join(expectedPredictionDir, "report.md"),
    path.join(expectedPredictionDir, "smoke_manifest.json"),
  ]), "No Qwen 3B prediction run exists yet."),
  criterion("integrity_gate_ready", "Prediction integrity gate reaches ready_for_paid_judge.", integrityGate.conclusion?.status === "ready_for_paid_judge", `Current status: ${integrityGate.conclusion?.status}.`),
  criterion("dry_judge_full_coverage", "Dry judge accounts for all 69 final-window examples before any paid judge.", await dryJudgeCoversAll(judgePlan.judge_run_id + "-dry-run"), "Dry judge cannot run until predictions exist."),
  criterion("paid_judge_complete", "Paid grounded-correctness judge completes with positive calls and examples_judged.", await paidJudgeComplete(judgePlan.judge_run_id), "Paid judge cannot run until integrity and dry judge pass."),
  criterion("qwen3b_on_pareto_table", "Qwen 3B result is added to the cost/coverage/support table and compared with zero-call gates.", false, "The table currently has no trained Qwen 3B row."),
  criterion("manuscript_regenerated", "Evidence map, manuscript draft, readiness gate, and reviewer-risk audit are regenerated after the Qwen 3B judge.", false, "Current manuscript explicitly says Qwen 3B is missing."),
  criterion("novelty_refreshed_at_submission", "Novelty/paper search is refreshed immediately before any NeurIPS-ready claim.", false, "Current watchlist is useful but must be refreshed at final claim time."),
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "final_evidence_checklist",
  status: acceptanceCriteria.every((row) => row.status === "pass") ? "all_final_evidence_present" : "final_evidence_missing",
  purpose: "Make the remaining Qwen 3B and paper-readiness evidence requirements executable and fail-closed before any NeurIPS-ready claim.",
  readiness_context: {
    gate_run_id: readiness.run_id,
    passed_requirements: readiness.summary.passed,
    failed_requirements: readiness.summary.failed,
    current_status: readiness.summary.current_status,
    blockers: readiness.top_blockers.map((row) => row.id),
  },
  current_budget_context: {
    max_budget_usd: Number(budget.max_budget_usd),
    current_actual_spend_usd: currentSpend,
    planned_gpu_estimate_usd: plannedGpuEstimate,
    planned_qwen3b_judge_estimate_usd: plannedJudgeEstimate,
    estimated_total_after_gpu_and_judge_usd: estimatedTotal,
    within_budget: estimatedTotal <= Number(budget.max_budget_usd),
    remaining_budget_usd: Number(budget.spend_usd.remaining),
  },
  source_artifacts: {
    remote_smoke_plan_run_id: remotePlan.run_id,
    prime_launch_plan_run_id: launchPlan.run_id,
    judge_plan_run_id: judgePlan.run_id,
    integrity_gate_run_id: integrityGate.run_id,
    post_smoke_pipeline_run_id: postSmokePipeline.run_id,
    abstention_boundary_audit_run_id: abstentionReliability.run_id,
  },
  expected_artifacts: expectedArtifacts,
  acceptance_criteria: acceptanceCriteria,
  execution_sequence: [
    {
      id: "refresh_auth_and_live_price",
      command: "prime whoami && prime availability list",
      guard: "Do not create a pod unless estimated total spend remains under $100.",
    },
    {
      id: "run_bounded_qwen3b_smoke",
      command: remotePlan.command,
      guard: "Must preserve MAX_SFT_STEPS=20, MAX_DPO_STEPS=10, PUSH_TO_HUB=false, REPORT_TO=none for the smoke.",
    },
    {
      id: "run_post_smoke_pipeline_dry",
      command: judgePlan.commands.guarded_post_smoke_pipeline,
      guard: "Must reach ready_for_explicit_paid_judge before paid judge.",
    },
    {
      id: "run_post_smoke_pipeline_paid",
      command: `${judgePlan.commands.guarded_post_smoke_pipeline} --run-paid=true`,
      guard: "Only after integrity and dry judge pass, OPENAI_API_KEY is loaded, and total budget remains under $100.",
    },
    {
      id: "regenerate_paper_artifacts",
      command: [
        "node scripts/grounded-qa-distillation-total-budget.mjs",
        "node scripts/grounded-qa-distillation-paper-readiness-gate.mjs",
        "node scripts/grounded-qa-distillation-manuscript-evidence-map.mjs",
        "node scripts/grounded-qa-distillation-manuscript-draft.mjs",
        "node scripts/grounded-qa-distillation-reviewer-risk-audit.mjs",
      ].join(" && "),
      guard: "Readiness may only turn green if all final evidence artifacts exist and validate.",
    },
  ],
  paper_claim_constraints: [
    "Until this checklist passes, do not claim a trained smaller model preserves citation-grounded correctness.",
    "Report Qwen 3B answer rate, answer support, abstention support, citation recall, and second-pass reliability slices together.",
    "Keep the public dated-QASPER/arXiv proxy caveat unless a versioned private KB is added.",
    "Keep abstention-boundary instability as a limitation unless human/stronger-judge adjudication closes it.",
  ],
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This checklist reads local artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function criterion(id, requirement, passed, evidence) {
  return {
    id,
    requirement,
    status: passed ? "pass" : "fail",
    evidence,
  };
}

async function dryJudgeCoversAll(runId) {
  const result = await readResultIfPresent(runId);
  return result?.dry_run === true && Number(result.calls_skipped) === 69 && Number(result.examples_requested) === 69;
}

async function paidJudgeComplete(runId) {
  const result = await readResultIfPresent(runId);
  return Number(result?.calls_made) > 0 && Number(result?.metrics?.examples_judged) > 0;
}

async function allExist(files) {
  for (const file of files) {
    try {
      await fs.access(file);
    } catch {
      return false;
    }
  }
  return true;
}

async function readResult(runId) {
  return readJson(path.join(runDir, runId, "result.json"));
}

async function readResultIfPresent(runId) {
  try {
    return await readResult(runId);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function renderReport(result) {
  return `# Final Evidence Checklist

Generated: ${result.generated_at}

Status: \`${result.status}\`

Readiness gate: \`${result.readiness_context.current_status}\` (${result.readiness_context.passed_requirements}/${result.readiness_context.passed_requirements + result.readiness_context.failed_requirements} passing)

## Budget

| Current actual spend | Planned GPU estimate | Planned Qwen 3B judge estimate | Estimated total | Within $${result.current_budget_context.max_budget_usd} cap |
| ---: | ---: | ---: | ---: | --- |
| $${result.current_budget_context.current_actual_spend_usd.toFixed(6)} | $${result.current_budget_context.planned_gpu_estimate_usd.toFixed(6)} | $${result.current_budget_context.planned_qwen3b_judge_estimate_usd.toFixed(6)} | $${result.current_budget_context.estimated_total_after_gpu_and_judge_usd.toFixed(6)} | ${result.current_budget_context.within_budget ? "yes" : "no"} |

## Acceptance Criteria

| ID | Status | Requirement | Evidence |
| --- | --- | --- | --- |
${result.acceptance_criteria.map((row) => `| ${row.id} | ${row.status} | ${row.requirement} | ${String(row.evidence).replaceAll("|", "\\|")} |`).join("\n")}

## Execution Sequence

${result.execution_sequence.map((step, index) => `${index + 1}. \`${step.id}\`: \`${step.command}\`\n   Guard: ${step.guard}`).join("\n")}

## Paper Claim Constraints

${result.paper_claim_constraints.map((item) => `- ${item}`).join("\n")}

This checklist makes no OpenAI calls, launches no GPU jobs, and records no new spend.
`;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
