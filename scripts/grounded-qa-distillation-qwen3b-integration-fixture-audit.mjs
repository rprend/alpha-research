import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "qwen3b-integration-fixture-audit-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const cases = [
  {
    id: "negative",
    expected_status: "qwen3b_negative_ready_for_pareto_update",
    metrics: { examples: 10, answered: 8, answer_support_rate: 0.6, abstention_support_rate: 1, overall_judged_correct_rate: 0.7 },
  },
  {
    id: "minimum_positive",
    expected_status: "qwen3b_minimum_positive_ready_for_pareto_update",
    metrics: { examples: 10, answered: 7, answer_support_rate: 0.67, abstention_support_rate: 1, overall_judged_correct_rate: 0.74 },
  },
  {
    id: "strong_positive",
    expected_status: "qwen3b_strong_positive_ready_for_pareto_update",
    metrics: { examples: 10, answered: 8, answer_support_rate: 0.72, abstention_support_rate: 1, overall_judged_correct_rate: 0.8 },
  },
];

const results = [];
for (const fixture of cases) {
  results.push(await runFixture(fixture));
}

const allPassed = results.every((row) => row.passed);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen3b_result_integration_fixture_audit",
  status: allPassed ? "integration_status_logic_verified" : "integration_status_logic_failed",
  purpose: "Exercise the Qwen 3B result-integration gate on synthetic local fixtures so future Qwen results are not silently misclassified.",
  cases: results,
  verified_statuses: results.map((row) => row.observed_status),
  cleanup: {
    temporary_fixture_runs_removed: results.every((row) => row.cleanup_removed === true),
    note: "Fixture prediction, judge, and temporary integration run directories are deleted after each case.",
  },
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
    note: "This audit creates local synthetic JSON fixtures and invokes the integration script only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({ run_id: result.run_id, status: result.status, cases: result.cases.map(({ id, observed_status, passed }) => ({ id, observed_status, passed })) }, null, 2));

async function runFixture(fixture) {
  const predictionRunId = `.tmp-qwen-integration-fixture-pred-${fixture.id}`;
  const judgeRunId = `.tmp-qwen-integration-fixture-judge-${fixture.id}`;
  const integrationRunId = `.tmp-qwen-integration-fixture-output-${fixture.id}`;
  const predictionDir = path.join(runDir, predictionRunId);
  const judgeDir = path.join(runDir, judgeRunId);
  const integrationDir = path.join(runDir, integrationRunId);
  try {
    await fs.rm(predictionDir, { recursive: true, force: true });
    await fs.rm(judgeDir, { recursive: true, force: true });
    await fs.rm(integrationDir, { recursive: true, force: true });
    await writePredictionFixture(predictionDir, fixture.metrics);
    await writeJudgeFixture(judgeDir, predictionRunId, fixture.metrics);
    const completed = spawnSync(process.execPath, [
      "scripts/grounded-qa-distillation-qwen3b-result-integration.mjs",
      `--prediction-run-id=${predictionRunId}`,
      `--judge-run-id=${judgeRunId}`,
      `--run-id=${integrationRunId}`,
    ], { cwd: rootDir, encoding: "utf8" });
    const outputResultPath = path.join(integrationDir, "result.json");
    const output = completed.status === 0 ? await readJson(outputResultPath) : null;
    const observedStatus = output?.status ?? "script_failed";
    return {
      id: fixture.id,
      expected_status: fixture.expected_status,
      observed_status: observedStatus,
      passed: completed.status === 0 && observedStatus === fixture.expected_status,
      metrics: fixture.metrics,
      target_comparison: output?.target_comparison ?? null,
      stderr_tail: completed.stderr.trim().slice(-1000),
      stdout_tail: completed.stdout.trim().slice(-1000),
      cleanup_removed: await cleanup([predictionDir, judgeDir, integrationDir]),
    };
  } catch (error) {
    return {
      id: fixture.id,
      expected_status: fixture.expected_status,
      observed_status: "audit_exception",
      passed: false,
      metrics: fixture.metrics,
      error: error.message,
      cleanup_removed: await cleanup([predictionDir, judgeDir, integrationDir]),
    };
  }
}

async function writePredictionFixture(dir, metrics) {
  await fs.mkdir(dir, { recursive: true });
  const abstained = metrics.examples - metrics.answered;
  const result = {
    run_id: path.basename(dir),
    eval: {
      examples: metrics.examples,
      answered: metrics.answered,
      abstained,
      citation_precision: 0.75,
      citation_recall: 0.7,
      answer_token_f1: 0.3,
      inline_citation_rate: 1,
    },
  };
  await fs.writeFile(path.join(dir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  await fs.writeFile(path.join(dir, "report.md"), "# Synthetic prediction fixture\n");
  await fs.writeFile(path.join(dir, "smoke_manifest.json"), `${JSON.stringify({ fixture: true, max_sft_steps: 20, max_dpo_steps: 10 }, null, 2)}\n`);
  const rows = Array.from({ length: metrics.examples }, (_, index) => JSON.stringify({ example_id: `fixture-${index + 1}`, prediction: index < metrics.answered ? "Answer [E1]" : "Insufficient evidence." }));
  await fs.writeFile(path.join(dir, "predictions.jsonl"), `${rows.join("\n")}\n`);
}

async function writeJudgeFixture(dir, predictionRunId, metrics) {
  await fs.mkdir(dir, { recursive: true });
  const abstained = metrics.examples - metrics.answered;
  const result = {
    run_id: path.basename(dir),
    prediction_run: predictionRunId,
    calls_made: metrics.examples,
    run_cost_usd: 0,
    metrics: {
      examples_judged: metrics.examples,
      answered_predictions: metrics.answered,
      abstained_predictions: abstained,
      answer_support_rate: metrics.answer_support_rate,
      abstention_support_rate: metrics.abstention_support_rate,
      overall_judged_correct_rate: metrics.overall_judged_correct_rate,
      invalid_judgment_rate: 0,
    },
  };
  await fs.writeFile(path.join(dir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  const rows = Array.from({ length: metrics.examples }, (_, index) => JSON.stringify({ example_id: `fixture-${index + 1}`, verdict: "fixture" }));
  await fs.writeFile(path.join(dir, "judgments.jsonl"), `${rows.join("\n")}\n`);
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
  const rows = result.cases.map((row) => `| ${row.id} | ${row.expected_status} | ${row.observed_status} | ${row.passed ? "pass" : "fail"} |`).join("\n");
  return `# Qwen 3B Result Integration Fixture Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

| Case | Expected status | Observed status | Result |
| --- | --- | --- | --- |
${rows}

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend. Temporary fixture runs are removed after execution.
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
