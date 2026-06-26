import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "qwen3b-syntax-only-rejection-audit-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const repaired = await readResult("local-qwen3b-citation-repair-local-qwen3b-base-control-joint-action-12-v1");

const predictionRunId = ".tmp-qwen-syntax-only-pred";
const judgeRunId = ".tmp-qwen-syntax-only-judge";
const integrationRunId = ".tmp-qwen-syntax-only-integration";
const predictionDir = path.join(runDir, predictionRunId);
const judgeDir = path.join(runDir, judgeRunId);
const integrationDir = path.join(runDir, integrationRunId);

await cleanup([predictionDir, judgeDir, integrationDir]);
await writePredictionFixture(predictionDir, repaired);
await writeJudgeFixture(judgeDir, predictionRunId, repaired);

const completed = spawnSync(process.execPath, [
  "scripts/grounded-qa-distillation-qwen3b-result-integration.mjs",
  `--prediction-run-id=${predictionRunId}`,
  `--judge-run-id=${judgeRunId}`,
  `--run-id=${integrationRunId}`,
], { cwd: rootDir, encoding: "utf8" });

const integration = completed.status === 0
  ? await readJson(path.join(integrationDir, "result.json"))
  : null;
const observedStatus = integration?.status ?? "script_failed";
const cleanupRemoved = await cleanup([predictionDir, judgeDir, integrationDir]);
const expectedStatus = "qwen3b_negative_ready_for_pareto_update";
const passed = completed.status === 0
  && observedStatus === expectedStatus
  && integration?.qwen_metrics?.inline_citation_rate === 1
  && integration?.target_comparison?.meets_minimum_acceptance === false;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen3b_syntax_only_rejection_audit",
  status: passed ? "syntax_only_result_rejected" : "syntax_only_rejection_failed",
  purpose: "Prove the Qwen 3B result-integration gate cannot be satisfied by perfect inline citation syntax when support/correctness metrics remain below target.",
  source_repair_run_id: repaired.run_id,
  fixture: {
    prediction_run_id: predictionRunId,
    judge_run_id: judgeRunId,
    integration_run_id: integrationRunId,
    expected_status: expectedStatus,
    observed_status: observedStatus,
    integration_exit_status: completed.status,
    cleanup_removed: cleanupRemoved,
  },
  metrics_used: {
    examples: repaired.eval.examples,
    answered: repaired.eval.answered,
    answer_rate: repaired.eval.answer_rate,
    inline_citation_rate: repaired.eval.inline_citation_rate,
    citation_precision: repaired.eval.citation_precision,
    citation_recall: repaired.eval.citation_recall,
    synthetic_answer_support_rate: repaired.eval.citation_precision,
    synthetic_overall_judged_correct_rate: repaired.eval.answer_type_accuracy * repaired.eval.citation_precision,
    note: "The synthetic judge fixture deliberately maps syntax-repaired citation precision to support and combines answer-type accuracy with citation precision for overall correctness. It is a gate logic test, not a real judge result.",
  },
  observed_integration: integration ? {
    status: integration.status,
    qwen_metrics: integration.qwen_metrics,
    target_comparison: integration.target_comparison,
  } : null,
  conclusion: passed
    ? "The integration gate rejected a fixture with 100% inline citation rate because support/correctness failed the direct-baseline target."
    : "The integration gate did not reject the syntax-only fixture as expected.",
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
    note: "This audit creates local synthetic fixtures and invokes the integration script only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({ run_id: result.run_id, status: result.status, observed_status: observedStatus, passed }, null, 2));

async function writePredictionFixture(dir, repairResult) {
  await fs.mkdir(dir, { recursive: true });
  const result = {
    run_id: path.basename(dir),
    eval: {
      examples: repairResult.eval.examples,
      answered: repairResult.eval.answered,
      abstained: repairResult.eval.abstained,
      citation_precision: repairResult.eval.citation_precision,
      citation_recall: repairResult.eval.citation_recall,
      answer_token_f1: repairResult.eval.answer_token_f1,
      inline_citation_rate: repairResult.eval.inline_citation_rate,
    },
  };
  await fs.writeFile(path.join(dir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  await fs.writeFile(path.join(dir, "report.md"), "# Synthetic syntax-only prediction fixture\n");
  await fs.writeFile(path.join(dir, "smoke_manifest.json"), `${JSON.stringify({ fixture: true, source_repair_run_id: repairResult.run_id }, null, 2)}\n`);
  const rows = Array.from({ length: repairResult.eval.examples }, (_, index) => JSON.stringify({ example_id: `syntax-only-${index + 1}`, prediction: index < repairResult.eval.answered ? "Answer [E1]" : "Insufficient evidence." }));
  await fs.writeFile(path.join(dir, "predictions.jsonl"), `${rows.join("\n")}\n`);
}

async function writeJudgeFixture(dir, predictionRunId, repairResult) {
  await fs.mkdir(dir, { recursive: true });
  const supportRate = Number(repairResult.eval.citation_precision);
  const overallRate = Number(repairResult.eval.answer_type_accuracy) * supportRate;
  const result = {
    run_id: path.basename(dir),
    prediction_run: predictionRunId,
    calls_made: repairResult.eval.examples,
    run_cost_usd: 0,
    metrics: {
      examples_judged: repairResult.eval.examples,
      answered_predictions: repairResult.eval.answered,
      abstained_predictions: repairResult.eval.abstained,
      answer_support_rate: supportRate,
      abstention_support_rate: repairResult.eval.abstention_accuracy,
      overall_judged_correct_rate: overallRate,
      invalid_judgment_rate: 0,
    },
  };
  await fs.writeFile(path.join(dir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  const rows = Array.from({ length: repairResult.eval.examples }, (_, index) => JSON.stringify({ example_id: `syntax-only-${index + 1}`, verdict: "synthetic_syntax_only_gate_test" }));
  await fs.writeFile(path.join(dir, "judgments.jsonl"), `${rows.join("\n")}\n`);
}

function renderReport(result) {
  return `# Qwen 3B Syntax-Only Rejection Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

Source repair run: \`${result.source_repair_run_id}\`

| Inline citation rate | Synthetic answer support | Synthetic overall correct | Expected integration status | Observed integration status |
| ---: | ---: | ---: | --- | --- |
| ${pct(result.metrics_used.inline_citation_rate)} | ${pct(result.metrics_used.synthetic_answer_support_rate)} | ${pct(result.metrics_used.synthetic_overall_judged_correct_rate)} | \`${result.fixture.expected_status}\` | \`${result.fixture.observed_status}\` |

## Conclusion

${result.conclusion}

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

async function readResult(runId) {
  return readJson(path.join(runDir, runId, "result.json"));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function pct(value) {
  return `${(100 * Number(value)).toFixed(1)}%`;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
