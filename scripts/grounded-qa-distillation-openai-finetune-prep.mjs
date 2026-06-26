import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const exportDir = path.join(experimentDir, "exports");
const runDir = path.join(experimentDir, "runs");
const ledgerDir = path.join(experimentDir, "llm-calls");
const args = parseArgs(process.argv.slice(2));

const teacherLabelPrefix = args["teacher-label-prefix"] ?? "teacher-repair-temporal-test-0-80-v1";
const runId = args["run-id"] ?? `openai-finetune-prep-${teacherLabelPrefix}`;
const outputDir = path.join(runDir, runId);
const trainFraction = numberArg(args["train-fraction"], 0.8, { min: 0.1, max: 0.95 });
const maxBudgetUsd = Number(args["max-budget-usd"] ?? 100);
const maxTrainingHours = Number(args["max-training-hours"] ?? 0);
const epochs = Math.max(1, Math.floor(Number(args.epochs ?? 3)));
const launch = args.launch === "true";
const allowLegacyFineTune = args["allow-legacy-finetune"] === "true";
const fineTuneModel = args.model ?? "gpt-4.1-mini-2025-04-14";
const trainingDollarsPerHour = Number(args["training-dollars-per-hour"] ?? 100);
const trainingDollarsPerMillion = Number(args["training-dollars-per-million"] ?? trainingPricePerMillion(fineTuneModel));
const apiDocs = {
  supervisedFineTuning: "https://developers.openai.com/api/docs/guides/supervised-fine-tuning",
  pricing: "https://developers.openai.com/api/docs/pricing",
};

await fs.mkdir(outputDir, { recursive: true });

const acceptedLabels = await readJsonl(path.join(exportDir, `${teacherLabelPrefix}.sft.jsonl`));
const sorted = [...acceptedLabels].sort((a, b) => a.example_id.localeCompare(b.example_id));
const trainCount = Math.max(1, Math.floor(sorted.length * trainFraction));
const trainRows = sorted.slice(0, trainCount).map(toOpenAiRow);
const validationRows = sorted.slice(trainCount).map(toOpenAiRow);
const trainPath = path.join(outputDir, "train.openai.jsonl");
const validationPath = path.join(outputDir, "validation.openai.jsonl");
const priorSpend = await ledgerSpend(path.join(ledgerDir, "ledger.jsonl"));
const trainApproxTokens = approxTokens(trainRows);
const validationApproxTokens = approxTokens(validationRows);
const totalApproxTokens = trainApproxTokens + validationApproxTokens;
const tokenTrainingCostUsd = (trainApproxTokens * epochs / 1_000_000) * trainingDollarsPerMillion;
const hourlyTrainingCostUsd = maxTrainingHours > 0 ? maxTrainingHours * trainingDollarsPerHour : 0;
const estimatedTrainingCostUsd = tokenTrainingCostUsd + hourlyTrainingCostUsd;
const refusalReasons = [];

if (launch && !allowLegacyFineTune) {
  refusalReasons.push("launch requested without --allow-legacy-finetune=true; current OpenAI docs describe fine-tuning as a winding-down legacy platform.");
}
if (launch && (!Number.isFinite(maxTrainingHours) || maxTrainingHours <= 0)) {
  refusalReasons.push("launch requested without a positive --max-training-hours bound.");
}
if (launch && priorSpend + estimatedTrainingCostUsd > maxBudgetUsd) {
  refusalReasons.push(`launch would exceed budget: ledger $${priorSpend.toFixed(6)} + estimated training $${estimatedTrainingCostUsd.toFixed(6)} > $${maxBudgetUsd.toFixed(2)}.`);
}
if (launch && !process.env.OPENAI_API_KEY) {
  refusalReasons.push("launch requested but OPENAI_API_KEY is missing.");
}
if (launch) {
  refusalReasons.push("launch path is intentionally disabled until a poll-and-cancel controller can enforce the training-hour cap against live job status.");
}

const summary = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  teacher_label_prefix: teacherLabelPrefix,
  fine_tune_model: fineTuneModel,
  launch_requested: launch,
  launch_performed: false,
  refusal_reasons: refusalReasons,
  docs_checked: apiDocs,
  docs_assumption: "OpenAI fine-tuning is currently described as a legacy/winding-down platform; SFT support and pricing must be rechecked before launch.",
  examples: {
    accepted_labels: sorted.length,
    train: trainRows.length,
    validation: validationRows.length,
  },
  token_estimates: {
    train_approx_tokens: trainApproxTokens,
    validation_approx_tokens: validationApproxTokens,
    total_approx_tokens: totalApproxTokens,
    epochs,
  },
  budget: {
    max_budget_usd: maxBudgetUsd,
    ledger_spend_before_usd: priorSpend,
    remaining_budget_before_usd: Math.max(0, maxBudgetUsd - priorSpend),
    training_dollars_per_million_tokens: trainingDollarsPerMillion,
    training_dollars_per_hour: trainingDollarsPerHour,
    max_training_hours: maxTrainingHours,
    token_training_cost_usd: tokenTrainingCostUsd,
    hourly_training_cost_usd: hourlyTrainingCostUsd,
    estimated_training_cost_usd: estimatedTrainingCostUsd,
    estimated_spend_after_usd: priorSpend + estimatedTrainingCostUsd,
  },
  artifacts: {
    train_jsonl: path.relative(rootDir, trainPath),
    validation_jsonl: path.relative(rootDir, validationPath),
    result_json: path.relative(rootDir, path.join(outputDir, "result.json")),
    report_md: path.relative(rootDir, path.join(outputDir, "report.md")),
  },
};

await writeJsonl(trainPath, trainRows);
await writeJsonl(validationPath, validationRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(summary));

console.log(JSON.stringify(summary, null, 2));

function toOpenAiRow(row) {
  return {
    messages: [
      row.messages[0],
      row.messages[1],
      {
        role: "assistant",
        content: JSON.stringify(row.teacher_output),
      },
    ],
    metadata: {
      example_id: row.example_id,
      teacher_run_id: row.label_source?.teacher_run_id ?? "",
      judge_run_id: row.label_source?.judge_run_id ?? "",
      quality_tier: row.label_source?.quality_tier ?? "",
    },
  };
}

function renderReport(summary) {
  return `# OpenAI Fine-Tune Prep

## Status

- Launch requested: ${summary.launch_requested ? "yes" : "no"}
- Launch performed: ${summary.launch_performed ? "yes" : "no"}
- Candidate model: \`${summary.fine_tune_model}\`
- Teacher label packet: \`${summary.teacher_label_prefix}\`
- Train rows: ${summary.examples.train}
- Validation rows: ${summary.examples.validation}

## Budget Gate

| Item | Value |
| --- | ---: |
| Current ledger spend | $${summary.budget.ledger_spend_before_usd.toFixed(8)} |
| Remaining budget | $${summary.budget.remaining_budget_before_usd.toFixed(8)} |
| Training dollars/hour assumption | $${summary.budget.training_dollars_per_hour.toFixed(2)} |
| Training dollars / 1M tokens | $${summary.budget.training_dollars_per_million_tokens.toFixed(2)} |
| Epochs | ${summary.token_estimates.epochs} |
| Max training hours | ${summary.budget.max_training_hours} |
| Estimated token training cost | $${summary.budget.token_training_cost_usd.toFixed(8)} |
| Estimated hourly training cost | $${summary.budget.hourly_training_cost_usd.toFixed(8)} |
| Estimated training cost | $${summary.budget.estimated_training_cost_usd.toFixed(8)} |

## Token Estimate

| Split | Approx tokens |
| --- | ---: |
| Train | ${summary.token_estimates.train_approx_tokens} |
| Validation | ${summary.token_estimates.validation_approx_tokens} |
| Total | ${summary.token_estimates.total_approx_tokens} |

## Launch Decision

${summary.refusal_reasons.length ? summary.refusal_reasons.map((reason) => `- ${reason}`).join("\n") : "- No refusal reasons recorded."}

The prepared files are OpenAI chat-format JSONL, but the job is not launched by default. A live launch needs file upload, job polling, and ledger rows for upload/job/status calls plus a hard stop that can enforce the project-wide $100 key budget.
`;
}

function approxTokens(rows) {
  return rows.reduce((total, row) => total + Math.ceil(JSON.stringify(row.messages).length / 4), 0);
}

function trainingPricePerMillion(model) {
  const prices = {
    "gpt-4.1-2025-04-14": 25,
    "gpt-4.1-mini-2025-04-14": 5,
    "gpt-4.1-nano-2025-04-14": 1.5,
    "gpt-4o-2024-08-06": 25,
    "gpt-4o-mini-2024-07-18": 3,
    "o4-mini-2025-04-16": 0,
  };
  if (!(model in prices)) {
    throw new Error(`Missing fine-tune training price for ${model}. Pass --training-dollars-per-million explicitly after checking official pricing.`);
  }
  return prices[model];
}

async function ledgerSpend(file) {
  try {
    const rows = await readJsonl(file);
    return rows.reduce((total, row) => total + Number(row.cost_usd ?? 0), 0);
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function numberArg(value, fallback, options = {}) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (options.min != null && parsed < options.min) return fallback;
  if (options.max != null && parsed > options.max) return fallback;
  return parsed;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [key, raw] = value.slice(2).split("=");
    parsed[key] = raw ?? "true";
  }
  return parsed;
}
