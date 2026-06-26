import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const exportDir = path.join(experimentDir, "exports");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const teacherLabelPrefix = args["teacher-label-prefix"] ?? "teacher-repair-temporal-test-0-132-v1";
const split = args.split ?? "temporal_test";
const runId = args["run-id"] ?? `hf-sft-prep-${teacherLabelPrefix}`;
const outputDir = path.join(runDir, runId);
const trainFraction = numberArg(args["train-fraction"], 0.85, { min: 0.1, max: 0.95 });
const evalOffset = numberArg(args["eval-offset"], 132, { min: 0 });
const evalLimit = numberArg(args["eval-limit"], 40, { min: 1 });
const baseModel = args["base-model"] ?? "Qwen/Qwen2.5-0.5B-Instruct";
const dataUrlBase = args["data-url-base"] ?? `https://raw.githubusercontent.com/rprend/alpha-research/main/docs/experiments/grounded-qa-distillation/runs/${runId}/hf_dataset_repo`;
const hubModelId = args["hub-model-id"] ?? "rprendergast/grounded-qa-qasper-qwen05b-lora-v1";
const trackioSpaceId = args["trackio-space-id"] ?? "rprendergast/trackio";
const hardwareFlavor = args.flavor ?? "t4-small";
const timeout = args.timeout ?? "45m";
const maxLength = numberArg(args["max-length"], 1024, { min: 128 });
const epochs = numberArg(args.epochs, 3, { min: 1 });
const learningRate = Number(args["learning-rate"] ?? 0.0002);
const loraRank = numberArg(args["lora-rank"], 16, { min: 1 });

await fs.mkdir(outputDir, { recursive: true });

const labels = (await readJsonl(path.join(exportDir, `${teacherLabelPrefix}.sft.jsonl`)))
  .sort((a, b) => a.example_id.localeCompare(b.example_id));
const trainCount = Math.max(1, Math.floor(labels.length * trainFraction));
const trainRows = labels.slice(0, trainCount).map(toTrainingRow);
const validationRows = labels.slice(trainCount).map(toTrainingRow);
const evalRows = (await readJsonl(path.join(dataDir, `${split}.jsonl`)))
  .slice(evalOffset, evalOffset + evalLimit)
  .map(toEvalRow);

const trainJsonl = jsonl(trainRows);
const validationJsonl = jsonl(validationRows);
const evalJsonl = jsonl(evalRows);
const trainPath = path.join(outputDir, "train.hf-sft.jsonl");
const validationPath = path.join(outputDir, "validation.hf-sft.jsonl");
const evalPath = path.join(outputDir, "eval_prompts.jsonl");
const datasetDir = path.join(outputDir, "hf_dataset_repo");
const validationScriptPath = path.join(outputDir, "validate_dataset_uv.py");
const trainScriptPath = path.join(outputDir, "train_lora_sft_uv.py");
const jobSpecPath = path.join(outputDir, "hf_job_spec.json");
const reportPath = path.join(outputDir, "report.md");

await fs.writeFile(trainPath, trainJsonl);
await fs.writeFile(validationPath, validationJsonl);
await fs.writeFile(evalPath, evalJsonl);
await fs.mkdir(datasetDir, { recursive: true });
await fs.writeFile(path.join(datasetDir, "train.jsonl"), trainJsonl);
await fs.writeFile(path.join(datasetDir, "validation.jsonl"), validationJsonl);
await fs.writeFile(path.join(datasetDir, "eval_prompts.jsonl"), evalJsonl);
await fs.writeFile(path.join(datasetDir, "README.md"), renderDatasetCard({
  dataUrlBase,
  teacherLabelPrefix,
  split,
  trainRows,
  validationRows,
  evalRows,
}));

const validationScript = renderValidationScript();
const trainScript = renderTrainScript();
const jobSpec = {
  operation: "uv",
  args: {
    script: trainScript,
    flavor: hardwareFlavor,
    timeout,
    secrets: { HF_TOKEN: "$HF_TOKEN" },
  },
};

const summary = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  teacher_label_prefix: teacherLabelPrefix,
  split,
  data_url_base: dataUrlBase,
  base_model: baseModel,
  hub_model_id: hubModelId,
  trackio_space_id: trackioSpaceId,
  hardware_flavor: hardwareFlavor,
  timeout,
  train_fraction: trainFraction,
  max_length: maxLength,
  epochs,
  learning_rate: learningRate,
  lora_rank: loraRank,
  examples: {
    accepted_labels: labels.length,
    train: trainRows.length,
    validation: validationRows.length,
    eval_prompts: evalRows.length,
    eval_offset: evalOffset,
  },
  estimated_hf_job_cost_usd: estimateJobCost(hardwareFlavor, timeout),
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    note: "This prep and HF job packet make no OpenAI API calls. Hugging Face compute cost is tracked separately from the OpenAI key budget.",
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

await fs.writeFile(validationScriptPath, validationScript);
await fs.writeFile(trainScriptPath, trainScript);
await fs.writeFile(jobSpecPath, `${JSON.stringify(jobSpec, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(reportPath, renderReport(summary));

console.log(JSON.stringify(summary, null, 2));

function toTrainingRow(row) {
  return {
    example_id: row.example_id,
    messages: row.messages,
    teacher_output: row.teacher_output,
    label_source: row.label_source,
  };
}

function toEvalRow(row) {
  return {
    example_id: row.example_id,
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

function renderDatasetCard({ dataUrlBase, teacherLabelPrefix, split, trainRows, validationRows, evalRows }) {
  return `---
license: cc-by-4.0
task_categories:
- text-generation
language:
- en
pretty_name: Grounded QA QASPER Teacher Labels
---

# Grounded QA QASPER Teacher Labels

This dataset contains strict judge-accepted repaired-teacher labels for the Alpha Research grounded QA distillation experiment.

- Raw URL base: \`${dataUrlBase}\`
- Source label packet: \`${teacherLabelPrefix}\`
- Source split: \`${split}\`
- Train rows: ${trainRows.length}
- Validation rows: ${validationRows.length}
- Eval prompt rows: ${evalRows.length}

Each train/validation row has chat \`messages\` where the assistant message is JSON with \`answer_type\`, \`answer\`, \`citations\`, \`claim_table\`, and abstention fields. The eval file contains future prompts plus references for downstream held-out evaluation.
`;
}

function renderValidationScript() {
  return `#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["datasets>=2.20.0"]
# ///

import json
import os
from datasets import load_dataset

DATA_URL_BASE = os.environ.get("DATA_URL_BASE", ${JSON.stringify(dataUrlBase)})

dataset = load_dataset("json", data_files={
    "train": f"{DATA_URL_BASE}/train.jsonl",
    "validation": f"{DATA_URL_BASE}/validation.jsonl",
})
eval_dataset = load_dataset("json", data_files={"eval": f"{DATA_URL_BASE}/eval_prompts.jsonl"})["eval"]

errors = []
for split, rows in dataset.items():
    if not rows:
        errors.append(f"{split} split is empty")
    for index, row in enumerate(rows):
        messages = row.get("messages")
        if not isinstance(messages, list) or len(messages) != 3:
            errors.append(f"{split}:{index}: expected exactly three messages")
            continue
        if messages[-1].get("role") != "assistant":
            errors.append(f"{split}:{index}: final message must be assistant")
        try:
            parsed = json.loads(messages[-1].get("content") or "")
        except Exception as exc:
            errors.append(f"{split}:{index}: assistant content is not JSON: {exc}")
            continue
        if parsed.get("answer_type") == "grounded_answer":
            citations = parsed.get("citations") or []
            answer = parsed.get("answer") or ""
            if not citations:
                errors.append(f"{split}:{index}: grounded answer needs citations")
            for citation in citations:
                if f"[{citation}]" not in answer:
                    errors.append(f"{split}:{index}: missing inline citation {citation}")

if len(eval_dataset) == 0:
    errors.append("eval prompt file is empty")

if errors:
    raise SystemExit("\\n".join(errors))

print(json.dumps({
    "status": "ready",
    "train_rows": len(dataset["train"]),
    "validation_rows": len(dataset["validation"]),
    "eval_rows": len(eval_dataset),
    "data_url_base": DATA_URL_BASE,
}, indent=2))
`;
}

function renderTrainScript() {
  return `#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "accelerate>=0.30.0",
#   "datasets>=2.20.0",
#   "peft>=0.11.0",
#   "transformers>=4.44.0",
#   "trl>=0.12.0",
#   "trackio",
# ]
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
    if hasattr(tokenizer, "apply_chat_template"):
        try:
            return {"text": tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)}
        except Exception:
            pass
    return {"text": "\\n".join(f"{m['role']}: {m['content']}" for m in messages)}

dataset = dataset.map(format_example, remove_columns=dataset["train"].column_names)

trackio.init(
    project="grounded-qa-distillation",
    run_name="qasper-repair-0-132-qwen05b-lora",
    space_id=TRACKIO_SPACE_ID,
    config={
        "base_model": BASE_MODEL,
        "data_url_base": DATA_URL_BASE,
        "hub_model_id": HUB_MODEL_ID,
        "train_rows": len(dataset["train"]),
        "validation_rows": len(dataset["validation"]),
        "max_length": MAX_LENGTH,
    },
)

config = SFTConfig(
    output_dir="grounded-qa-qwen05b-lora",
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
    project="grounded-qa-distillation",
    run_name="qasper-repair-0-132-qwen05b-lora",
)

peft_config = LoraConfig(
    r=${JSON.stringify(loraRank)},
    lora_alpha=${JSON.stringify(loraRank * 2)},
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
)

trainer = SFTTrainer(
    model=BASE_MODEL,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    args=config,
    peft_config=peft_config,
)
trainer.train()
trainer.push_to_hub()
trackio.finish()
print(json.dumps({"status": "complete", "hub_model_id": HUB_MODEL_ID}, indent=2))
`;
}

function renderReport(summary) {
  return `# Hugging Face SFT Prep

## Purpose

Prepare the first generative SFT/LoRA student experiment for amortized grounded QA distillation. This packet uses the strict repaired-teacher labels and emits a self-contained Hugging Face Jobs script that can train a Qwen 0.5B LoRA student without first uploading a dataset repo.

## Setup

| Item | Value |
| --- | --- |
| Teacher label packet | \`${summary.teacher_label_prefix}\` |
| Raw data URL base | \`${summary.data_url_base}\` |
| Accepted labels | ${summary.examples.accepted_labels} |
| Train rows | ${summary.examples.train} |
| Validation rows | ${summary.examples.validation} |
| Eval prompts | ${summary.examples.eval_prompts} from \`${summary.split}\` offset ${summary.examples.eval_offset} |
| Base model | \`${summary.base_model}\` |
| Hub output | \`${summary.hub_model_id}\` |
| HF flavor | \`${summary.hardware_flavor}\` |
| Timeout | \`${summary.timeout}\` |
| Estimated HF job cost | $${summary.estimated_hf_job_cost_usd.toFixed(4)} |

## Artifacts

- Train JSONL: \`${summary.artifacts.train_jsonl}\`
- Validation JSONL: \`${summary.artifacts.validation_jsonl}\`
- Eval prompts: \`${summary.artifacts.eval_prompts_jsonl}\`
- Dataset repo upload folder: \`${summary.artifacts.hf_dataset_repo_dir}\`
- CPU validation script: \`${summary.artifacts.validation_script}\`
- TRL/LoRA training script: \`${summary.artifacts.train_script}\`
- HF job spec: \`${summary.artifacts.job_spec}\`

## Budget

This prep makes no OpenAI API calls and does not change the OpenAI key ledger. The HF job cost estimate is separate from the $100 OpenAI budget.
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
