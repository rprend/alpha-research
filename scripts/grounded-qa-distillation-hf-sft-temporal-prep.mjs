import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const exportDir = path.join(experimentDir, "exports");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const teacherLabelPrefix = args["teacher-label-prefix"] ?? "teacher-mini-negative-future-holdout-160-389-v1";
const split = args.split ?? "extended_temporal_future_holdout";
const trainWindows = (args["train-windows"] ?? "161-240,241-320").split(",").map((value) => value.trim()).filter(Boolean);
const evalWindow = args["eval-window"] ?? "321-389";
const runId = args["run-id"] ?? `hf-sft-temporal-prep-${teacherLabelPrefix}-train-${trainWindows.join("-")}-eval-${evalWindow}-qwen05b-v1`;
const outputDir = path.join(runDir, runId);
const validationFraction = numberArg(args["validation-fraction"], 0.15, { min: 0.05, max: 0.5 });
const excludeEvalPapers = args["exclude-eval-papers"] !== "false";
const baseModel = args["base-model"] ?? "Qwen/Qwen2.5-0.5B-Instruct";
const hubModelId = args["hub-model-id"] ?? "rprendergast/grounded-qa-qasper-mini-negative-temporal-qwen05b-lora-v1";
const trackioSpaceId = args["trackio-space-id"] ?? "rprendergast/trackio";
const hardwareFlavor = args.flavor ?? "t4-small";
const timeout = args.timeout ?? "45m";
const maxLength = numberArg(args["max-length"], 1024, { min: 128 });
const epochs = numberArg(args.epochs, 3, { min: 1 });
const learningRate = Number(args["learning-rate"] ?? 0.0002);
const loraRank = numberArg(args["lora-rank"], 16, { min: 1 });
const dataUrlBase = args["data-url-base"] ?? `https://raw.githubusercontent.com/rprend/alpha-research/main/docs/experiments/grounded-qa-distillation/runs/${runId}/hf_dataset_repo`;

await fs.mkdir(outputDir, { recursive: true });

const labels = (await readJsonl(path.join(exportDir, `${teacherLabelPrefix}.sft.jsonl`)))
  .map((row) => ({ ...row, window: labelWindow(row), paper_id: paperId(row) }));
const evalRowsRaw = (await readJsonl(path.join(dataDir, `${split}.jsonl`)))
  .map((row, index) => ({ ...row, temporal_window: windowForOneBasedIndex(index + 1) }))
  .filter((row) => row.temporal_window === evalWindow);
const evalPapers = new Set(evalRowsRaw.map((row) => row.input?.document_metadata?.paper_id).filter(Boolean));
const candidateTrainLabels = labels
  .filter((row) => trainWindows.includes(row.window))
  .filter((row) => !excludeEvalPapers || !evalPapers.has(row.paper_id))
  .sort(compareRowsForTemporalTraining);
const excludedForEvalPaperOverlap = labels
  .filter((row) => trainWindows.includes(row.window) && evalPapers.has(row.paper_id));
const validationCount = Math.max(1, Math.floor(candidateTrainLabels.length * validationFraction));
const validationLabels = candidateTrainLabels.slice(-validationCount);
const trainLabels = candidateTrainLabels.slice(0, -validationCount);
if (!trainLabels.length || !validationLabels.length || !evalRowsRaw.length) {
  throw new Error(`Temporal SFT prep has insufficient rows: train=${trainLabels.length}, validation=${validationLabels.length}, eval=${evalRowsRaw.length}`);
}

const trainRows = trainLabels.map(toTrainingRow);
const validationRows = validationLabels.map(toTrainingRow);
const evalRows = evalRowsRaw.map(toEvalRow);
const datasetDir = path.join(outputDir, "hf_dataset_repo");
await fs.mkdir(datasetDir, { recursive: true });

const trainPath = path.join(outputDir, "train.hf-sft.jsonl");
const validationPath = path.join(outputDir, "validation.hf-sft.jsonl");
const evalPath = path.join(outputDir, "eval_prompts.jsonl");
const validationScriptPath = path.join(outputDir, "validate_dataset.mjs");
const trainScriptPath = path.join(outputDir, "train_lora_sft_uv.py");
const jobSpecPath = path.join(outputDir, "hf_job_spec.json");
const reportPath = path.join(outputDir, "report.md");

await fs.writeFile(trainPath, jsonl(trainRows));
await fs.writeFile(validationPath, jsonl(validationRows));
await fs.writeFile(evalPath, jsonl(evalRows));
await fs.writeFile(path.join(datasetDir, "train.jsonl"), jsonl(trainRows));
await fs.writeFile(path.join(datasetDir, "validation.jsonl"), jsonl(validationRows));
await fs.writeFile(path.join(datasetDir, "eval_prompts.jsonl"), jsonl(evalRows));
await fs.writeFile(path.join(datasetDir, "README.md"), renderDatasetCard());
await fs.writeFile(validationScriptPath, renderValidationScript());
await fs.writeFile(trainScriptPath, renderTrainScript());
await fs.writeFile(jobSpecPath, `${JSON.stringify({
  operation: "uv",
  args: {
    script: "train_lora_sft_uv.py",
    flavor: hardwareFlavor,
    timeout,
    secrets: { HF_TOKEN: "$HF_TOKEN" },
  },
}, null, 2)}\n`);

const summary = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  teacher_label_prefix: teacherLabelPrefix,
  split,
  train_windows: trainWindows,
  eval_window: evalWindow,
  exclude_eval_papers: excludeEvalPapers,
  data_url_base: dataUrlBase,
  base_model: baseModel,
  hub_model_id: hubModelId,
  trackio_space_id: trackioSpaceId,
  hardware_flavor: hardwareFlavor,
  timeout,
  max_length: maxLength,
  epochs,
  learning_rate: learningRate,
  lora_rank: loraRank,
  examples: {
    accepted_labels_total: labels.length,
    train_candidates_before_eval_paper_exclusion: labels.filter((row) => trainWindows.includes(row.window)).length,
    excluded_for_eval_paper_overlap: excludedForEvalPaperOverlap.length,
    train: trainRows.length,
    validation: validationRows.length,
    eval_prompts: evalRows.length,
  },
  train_distribution: distribution(trainRows),
  validation_distribution: distribution(validationRows),
  eval_distribution: {
    papers: new Set(evalRows.map((row) => row.input.document_metadata.paper_id)).size,
    counterfactual: evalRows.filter((row) => row.input.document_metadata.counterfactual).length,
  },
  leakage_checks: {
    train_eval_example_overlap: intersection(new Set(trainRows.map((row) => row.example_id)), new Set(evalRows.map((row) => row.example_id))).length,
    validation_eval_example_overlap: intersection(new Set(validationRows.map((row) => row.example_id)), new Set(evalRows.map((row) => row.example_id))).length,
    train_eval_paper_overlap: intersection(new Set(trainRows.map((row) => row.input.document_metadata.paper_id)), evalPapers).length,
    validation_eval_paper_overlap: intersection(new Set(validationRows.map((row) => row.input.document_metadata.paper_id)), evalPapers).length,
  },
  estimated_hf_job_cost_usd: estimateJobCost(hardwareFlavor, timeout),
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    note: "This temporal prep makes no OpenAI API calls. Hugging Face compute cost is tracked separately from the OpenAI key budget.",
  },
  artifacts: {
    train_jsonl: path.relative(rootDir, trainPath),
    validation_jsonl: path.relative(rootDir, validationPath),
    eval_prompts_jsonl: path.relative(rootDir, evalPath),
    hf_dataset_repo_dir: path.relative(rootDir, datasetDir),
    validation_script: path.relative(rootDir, validationScriptPath),
    train_script: path.relative(rootDir, trainScriptPath),
    job_spec: path.relative(rootDir, jobSpecPath),
    report: path.relative(rootDir, reportPath),
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(reportPath, renderReport(summary));
console.log(JSON.stringify(summary, null, 2));

function toTrainingRow(row) {
  return {
    example_id: row.example_id,
    window: row.window,
    messages: row.messages,
    input: row.input,
    teacher_output: row.teacher_output,
    label_source: row.label_source,
  };
}

function toEvalRow(row) {
  return {
    example_id: row.example_id,
    window: row.temporal_window,
    messages: [
      {
        role: "system",
        content: "Answer using only the compact evidence pack. Cite every factual claim inline with evidence ids. Return JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify(row.input),
      },
    ],
    input: row.input,
    reference: row.output,
  };
}

function labelWindow(row) {
  return row.teacher_trace?.source_policy?.window ?? row.label_source?.window ?? windowForOneBasedIndex(Number(row.input?.document_metadata?.temporal_index ?? 0));
}

function paperId(row) {
  return row.input?.document_metadata?.paper_id ?? row.example_id.split(":")[0];
}

function windowForOneBasedIndex(index) {
  if (index >= 161 && index <= 240) return "161-240";
  if (index >= 241 && index <= 320) return "241-320";
  if (index >= 321 && index <= 389) return "321-389";
  return "outside-judged-range";
}

function compareRowsForTemporalTraining(a, b) {
  const windowCompare = trainWindows.indexOf(a.window) - trainWindows.indexOf(b.window);
  if (windowCompare) return windowCompare;
  return a.example_id.localeCompare(b.example_id);
}

function distribution(rows) {
  const answered = rows.filter((row) => parseAssistant(row).answer_type === "grounded_answer");
  const abstained = rows.filter((row) => parseAssistant(row).answer_type === "abstain");
  return {
    rows: rows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, rows.length),
    papers: new Set(rows.map((row) => row.input.document_metadata.paper_id)).size,
    counterfactual: rows.filter((row) => row.input.document_metadata.counterfactual).length,
    median_user_chars: median(rows.map((row) => row.messages[1].content.length)),
    median_assistant_chars: median(rows.map((row) => row.messages[2].content.length)),
  };
}

function parseAssistant(row) {
  return JSON.parse(row.messages[row.messages.length - 1].content);
}

function renderDatasetCard() {
  return `---
license: cc-by-4.0
task_categories:
- text-generation
language:
- en
pretty_name: Temporal Grounded QA SFT Packet
---

# Temporal Grounded QA SFT Packet

Leakage-aware SFT packet for amortized grounded QA over evolving knowledge bases.

- Source label packet: \`${teacherLabelPrefix}\`
- Train windows: \`${trainWindows.join(", ")}\`
- Eval window: \`${evalWindow}\`
- Eval-paper exclusion: \`${excludeEvalPapers}\`
- Base model target: \`${baseModel}\`
`;
}

function renderValidationScript() {
  return `import fs from "node:fs/promises";

const train = await readJsonl(new URL("./hf_dataset_repo/train.jsonl", import.meta.url));
const validation = await readJsonl(new URL("./hf_dataset_repo/validation.jsonl", import.meta.url));
const evalRows = await readJsonl(new URL("./hf_dataset_repo/eval_prompts.jsonl", import.meta.url));
const errors = [];
for (const [name, rows] of [["train", train], ["validation", validation]]) {
  if (!rows.length) errors.push(\`\${name} split is empty\`);
  for (const [index, row] of rows.entries()) {
    if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(\`\${name}:\${index}: expected three messages\`);
    const assistant = JSON.parse(row.messages.at(-1).content);
    if (assistant.answer_type === "grounded_answer") {
      if (!assistant.citations?.length) errors.push(\`\${name}:\${index}: grounded answer missing citations\`);
      for (const citation of assistant.citations ?? []) {
        if (!assistant.answer.includes(\`[\${citation}]\`)) errors.push(\`\${name}:\${index}: missing inline citation \${citation}\`);
      }
    }
  }
}
const trainPapers = new Set(train.map((row) => row.input.document_metadata.paper_id));
const evalPapers = new Set(evalRows.map((row) => row.input.document_metadata.paper_id));
const overlap = [...trainPapers].filter((paper) => evalPapers.has(paper));
if (overlap.length) errors.push(\`train/eval paper overlap: \${overlap.slice(0, 5).join(", ")}\`);
if (!evalRows.length) errors.push("eval split is empty");
if (errors.length) throw new Error(errors.join("\\n"));
console.log(JSON.stringify({ status: "ready", train: train.length, validation: validation.length, eval: evalRows.length }, null, 2));

async function readJsonl(url) {
  const text = await fs.readFile(url, "utf8");
  return text.split(/\\n+/).filter(Boolean).map((line) => JSON.parse(line));
}
`;
}

function renderTrainScript() {
  return `#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["accelerate>=0.30.0", "datasets>=2.20.0", "peft>=0.11.0", "transformers>=4.44.0", "trl>=0.12.0", "trackio"]
# ///
import json
import os

import trackio
from datasets import load_dataset
from peft import LoraConfig
from transformers import AutoTokenizer
from trl import SFTConfig, SFTTrainer

DATA_URL_BASE = os.environ.get("DATA_URL_BASE", ${JSON.stringify(dataUrlBase)})
BASE_MODEL = ${JSON.stringify(baseModel)}
HUB_MODEL_ID = os.environ.get("HUB_MODEL_ID", ${JSON.stringify(hubModelId)})
TRACKIO_SPACE_ID = os.environ.get("TRACKIO_SPACE_ID", ${JSON.stringify(trackioSpaceId)})
MAX_LENGTH = int(os.environ.get("MAX_LENGTH", ${JSON.stringify(String(maxLength))}))

dataset = load_dataset("json", data_files={
    "train": f"{DATA_URL_BASE}/train.jsonl",
    "validation": f"{DATA_URL_BASE}/validation.jsonl",
})
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, use_fast=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

def format_example(example):
    messages = example["messages"]
    try:
        return {"text": tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)}
    except Exception:
        return {"text": "\\n".join(f"{m['role']}: {m['content']}" for m in messages)}

dataset = dataset.map(format_example, remove_columns=dataset["train"].column_names)
trackio.init(project="grounded-qa-distillation", run_name=${JSON.stringify(runId)}, space_id=TRACKIO_SPACE_ID)

config = SFTConfig(
    output_dir="grounded-qa-temporal-lora",
    push_to_hub=True,
    hub_model_id=HUB_MODEL_ID,
    hub_strategy="every_save",
    num_train_epochs=${JSON.stringify(epochs)},
    per_device_train_batch_size=1,
    gradient_accumulation_steps=8,
    learning_rate=${JSON.stringify(learningRate)},
    max_length=MAX_LENGTH,
    logging_steps=5,
    save_strategy="steps",
    save_steps=25,
    save_total_limit=2,
    eval_strategy="steps",
    eval_steps=25,
    warmup_ratio=0.05,
    lr_scheduler_type="cosine",
    gradient_checkpointing=True,
    report_to="trackio",
)
peft_config = LoraConfig(r=${JSON.stringify(loraRank)}, lora_alpha=${JSON.stringify(loraRank * 2)}, lora_dropout=0.05, bias="none", task_type="CAUSAL_LM", target_modules=["q_proj", "k_proj", "v_proj", "o_proj"])
trainer = SFTTrainer(model=BASE_MODEL, train_dataset=dataset["train"], eval_dataset=dataset["validation"], args=config, peft_config=peft_config)
trainer.train()
trainer.push_to_hub()
trackio.finish()
print(json.dumps({"status": "complete", "hub_model_id": HUB_MODEL_ID}, indent=2))
`;
}

function renderReport(summary) {
  return `# Temporal Hugging Face SFT Prep

## Purpose

Prepare a leakage-aware generative SFT/LoRA packet from the strongest current mini-negative teacher labels. Unlike the older HF prep packets, this split is causal by judged future window and excludes papers that appear in the later eval window.

## Setup

| Item | Value |
| --- | --- |
| Teacher label packet | \`${summary.teacher_label_prefix}\` |
| Train windows | \`${summary.train_windows.join(", ")}\` |
| Eval window | \`${summary.eval_window}\` |
| Eval-paper exclusion | \`${summary.exclude_eval_papers}\` |
| Accepted labels total | ${summary.examples.accepted_labels_total} |
| Train rows | ${summary.examples.train} |
| Validation rows | ${summary.examples.validation} |
| Eval prompts | ${summary.examples.eval_prompts} |
| Excluded train labels for eval-paper overlap | ${summary.examples.excluded_for_eval_paper_overlap} |
| Base model | \`${summary.base_model}\` |
| Hub output | \`${summary.hub_model_id}\` |
| Estimated HF job cost | $${summary.estimated_hf_job_cost_usd.toFixed(4)} |

## Distribution

| Split | Rows | Answered | Abstained | Answer rate | Papers | Counterfactual |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | ${summary.train_distribution.rows} | ${summary.train_distribution.answered} | ${summary.train_distribution.abstained} | ${pct(summary.train_distribution.answer_rate)} | ${summary.train_distribution.papers} | ${summary.train_distribution.counterfactual} |
| Validation | ${summary.validation_distribution.rows} | ${summary.validation_distribution.answered} | ${summary.validation_distribution.abstained} | ${pct(summary.validation_distribution.answer_rate)} | ${summary.validation_distribution.papers} | ${summary.validation_distribution.counterfactual} |

## Leakage Checks

| Check | Count |
| --- | ---: |
| Train/eval example overlap | ${summary.leakage_checks.train_eval_example_overlap} |
| Validation/eval example overlap | ${summary.leakage_checks.validation_eval_example_overlap} |
| Train/eval paper overlap | ${summary.leakage_checks.train_eval_paper_overlap} |
| Validation/eval paper overlap | ${summary.leakage_checks.validation_eval_paper_overlap} |

## Artifacts

- Train JSONL: \`${summary.artifacts.train_jsonl}\`
- Validation JSONL: \`${summary.artifacts.validation_jsonl}\`
- Eval prompts: \`${summary.artifacts.eval_prompts_jsonl}\`
- Dataset folder: \`${summary.artifacts.hf_dataset_repo_dir}\`
- Local validation script: \`${summary.artifacts.validation_script}\`
- TRL/LoRA script: \`${summary.artifacts.train_script}\`
- HF job spec: \`${summary.artifacts.job_spec}\`

## Budget

This prep makes no OpenAI API calls. The estimated HF compute cost is separate from the OpenAI key budget.
`;
}

function jsonl(rows) {
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

function estimateJobCost(flavor, timeoutValue) {
  const hourly = {
    "cpu-basic": 0.03,
    "cpu-upgrade": 0.05,
    "cpu-performance": 0.10,
    "t4-small": 0.75,
    "t4-medium": 1.50,
    "l4x1": 2.50,
    "a10g-small": 3.50,
    "a10g-large": 5.00,
  }[flavor] ?? 5.00;
  return hourly * timeoutHours(timeoutValue);
}

function timeoutHours(value) {
  const raw = String(value).trim();
  if (raw.endsWith("m")) return Number(raw.slice(0, -1)) / 60;
  if (raw.endsWith("h")) return Number(raw.slice(0, -1));
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? seconds / 3600 : 1;
}

function numberArg(value, fallback, options = {}) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected number, got ${value}`);
  const min = options.min ?? Number.NEGATIVE_INFINITY;
  const max = options.max ?? Number.POSITIVE_INFINITY;
  if (parsed < min || parsed > max) throw new Error(`Number ${parsed} outside range [${min}, ${max}]`);
  return parsed;
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...valueParts] = arg.slice(2).split("=");
    parsed[key] = valueParts.length ? valueParts.join("=") : "true";
  }
  return parsed;
}

function intersection(left, right) {
  return [...left].filter((value) => right.has(value));
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}
