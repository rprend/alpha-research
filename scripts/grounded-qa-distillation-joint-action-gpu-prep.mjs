import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const supportPrepRunId = args["support-prep-run"] ?? "support-contrast-prep-judge-support-direct-repair-0-320-to-321-389-v1";
const split = args.split ?? "extended_temporal_future_holdout";
const runId = args["run-id"] ?? "joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1";
const baseModel = args["base-model"] ?? "Qwen/Qwen2.5-3B-Instruct";
const hubModelId = args["hub-model-id"] ?? "rprendergast/grounded-qa-joint-action-qwen3b-lora-v1";
const hardware = args.hardware ?? "1x_L4_or_A10G";
const estimatedGpuCostUsd = numberArg(args["estimated-gpu-cost-usd"], 12);
const outputDir = path.join(runDir, runId);
const datasetDir = path.join(outputDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });

const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const referencesById = new Map(references.map((row) => [row.example_id, row]));
const supportDir = path.join(runDir, supportPrepRunId);
const sftTrain = await readJsonl(path.join(supportDir, "sft_train.jsonl"));
const sftValidation = await readJsonl(path.join(supportDir, "sft_validation.jsonl"));
const prefTrain = await readJsonl(path.join(supportDir, "preference_train.jsonl"));
const prefValidation = await readJsonl(path.join(supportDir, "preference_validation.jsonl"));
const evalPrompts = await readJsonl(path.join(supportDir, "eval_prompts.jsonl"));

const trainSftRows = [
  ...sftTrain.map((row) => toSftRow(row, "supported_answer_sft")),
  ...prefTrain.map((row) => toRepairOrAbstainSftRow(row, referencesById)).filter(Boolean),
];
const validationSftRows = [
  ...sftValidation.map((row) => toSftRow(row, "supported_answer_sft")),
  ...prefValidation.map((row) => toRepairOrAbstainSftRow(row, referencesById)).filter(Boolean),
];
const trainDpoRows = prefTrain.map((row) => toDpoRow(row, referencesById)).filter(Boolean);
const validationDpoRows = prefValidation.map((row) => toDpoRow(row, referencesById)).filter(Boolean);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  support_prep_run_id: supportPrepRunId,
  split,
  base_model: baseModel,
  hub_model_id: hubModelId,
  target_hardware: hardware,
  estimated_gpu_cost_usd: estimatedGpuCostUsd,
  examples: {
    sft_train: trainSftRows.length,
    sft_validation: validationSftRows.length,
    dpo_train: trainDpoRows.length,
    dpo_validation: validationDpoRows.length,
    eval_prompts: evalPrompts.length,
    train_repair_or_abstain_rows: trainSftRows.filter((row) => row.label_source?.type !== "supported_answer_sft").length,
    validation_repair_or_abstain_rows: validationSftRows.filter((row) => row.label_source?.type !== "supported_answer_sft").length,
    dpo_chosen_grounded_train: trainDpoRows.filter((row) => row.chosen_output?.answer_type === "grounded_answer").length,
    dpo_chosen_abstain_train: trainDpoRows.filter((row) => row.chosen_output?.answer_type === "abstain").length,
  },
  objective: {
    name: "joint_action_grounded_qa",
    actions: ["keep_supported_answer", "repair_or_regenerate_when_answerable", "abstain_when_evidence_insufficient"],
    rationale: "D95 showed scalar support gating confuses unsupported answer repair with abstention. This packet trains both SFT behavior and DPO preferences for the joint action policy.",
  },
  budget: {
    max_total_budget_usd: 100,
    openai_calls: 0,
    openai_cost_usd: 0,
    estimated_gpu_cost_usd: estimatedGpuCostUsd,
    note: "This prep makes no API/model calls. GPU cost is only a launch estimate and must be ledgered as external compute spend if a Prime/HF job is started.",
  },
  artifacts: {
    sft_train_jsonl: rel(path.join(datasetDir, "sft_train.jsonl")),
    sft_validation_jsonl: rel(path.join(datasetDir, "sft_validation.jsonl")),
    dpo_train_jsonl: rel(path.join(datasetDir, "dpo_train.jsonl")),
    dpo_validation_jsonl: rel(path.join(datasetDir, "dpo_validation.jsonl")),
    eval_prompts_jsonl: rel(path.join(datasetDir, "eval_prompts.jsonl")),
    dataset_readme: rel(path.join(datasetDir, "README.md")),
    validate_script: rel(path.join(outputDir, "validate_joint_action_dataset_uv.py")),
    train_script: rel(path.join(outputDir, "train_joint_action_lora_uv.py")),
    prime_plan: rel(path.join(outputDir, "prime_gpu_plan.md")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(datasetDir, "sft_train.jsonl"), trainSftRows);
await writeJsonl(path.join(datasetDir, "sft_validation.jsonl"), validationSftRows);
await writeJsonl(path.join(datasetDir, "dpo_train.jsonl"), trainDpoRows);
await writeJsonl(path.join(datasetDir, "dpo_validation.jsonl"), validationDpoRows);
await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), evalPrompts);
await fs.writeFile(path.join(datasetDir, "README.md"), renderDatasetReadme(result));
await fs.writeFile(path.join(outputDir, "validate_joint_action_dataset_uv.py"), renderValidationScript());
await fs.writeFile(path.join(outputDir, "train_joint_action_lora_uv.py"), renderTrainingScript({ baseModel, hubModelId }));
await fs.writeFile(path.join(outputDir, "prime_gpu_plan.md"), renderPrimePlan(result));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify(result, null, 2));

function toSftRow(row, type) {
  return {
    example_id: row.example_id,
    task: "citation_grounded_domain_qa_joint_action_sft",
    messages: row.messages,
    input: row.input,
    target: row.target,
    label_source: { type, source_task: row.task, source_prediction_run: row.source_prediction_run },
  };
}

function toRepairOrAbstainSftRow(row, referencesById) {
  const reference = referencesById.get(row.example_id);
  if (!reference) return null;
  const target = normalizeReferenceOutput(reference.output);
  return {
    example_id: row.example_id,
    task: "citation_grounded_domain_qa_joint_action_sft",
    messages: promptMessages(row.input).concat({ role: "assistant", content: JSON.stringify(target) }),
    input: row.input,
    target,
    label_source: {
      type: target.answer_type === "grounded_answer" ? "repair_unsupported_answer_with_reference" : "abstain_on_insufficient_evidence",
      rejected_answer: row.rejected,
      source_prediction_run: row.source_prediction_run,
      rejection_reason: row.label_source?.rejection_reason,
    },
  };
}

function toDpoRow(row, referencesById) {
  const reference = referencesById.get(row.example_id);
  if (!reference) return null;
  const chosen = normalizeReferenceOutput(reference.output);
  const rejected = row.rejected;
  return {
    example_id: row.example_id,
    task: "citation_grounded_domain_qa_joint_action_dpo",
    prompt: row.messages,
    chosen: JSON.stringify(chosen),
    rejected: JSON.stringify(rejected),
    chosen_output: chosen,
    rejected_output: rejected,
    input: row.input,
    label_source: {
      type: chosen.answer_type === "grounded_answer" ? "prefer_reference_repair_over_unsupported_answer" : "prefer_abstention_over_unsupported_answer",
      source_prediction_run: row.source_prediction_run,
      source_judge_run: row.source_judge_run,
      rejection_reason: row.label_source?.rejection_reason,
    },
  };
}

function normalizeReferenceOutput(value) {
  const answerType = value?.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value?.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(value?.answer ?? ""),
    citations: answerType === "abstain" ? [] : citations,
    claim_table: Array.isArray(value?.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value?.abstention_reason ?? "Evidence is insufficient.") : "",
  };
}

function promptMessages(input) {
  return [
    {
      role: "system",
      content: "Answer using only the compact evidence pack. Return valid JSON only with keys answer_type, answer, citations, claim_table, and abstention_reason. Cite every factual claim inline with bracketed evidence ids like [E2]. Abstain when evidence is insufficient.",
    },
    { role: "user", content: formatInput(input) },
  ];
}

function formatInput(input) {
  const metadata = input.document_metadata ?? {};
  const lines = [
    `Question: ${input.question ?? ""}`,
    `Paper title: ${metadata.title ?? ""}`,
    `Paper id: ${metadata.paper_id ?? ""}`,
    `Date: ${metadata.inferred_publication_date ?? metadata.inferred_publication_month ?? ""}`,
    "Evidence pack:",
  ];
  for (const evidence of input.compact_retrieved_evidence_pack ?? []) {
    lines.push(`[${evidence.evidence_id}] ${evidence.section ?? "unknown section"}: ${evidence.text ?? ""}`);
  }
  return lines.join("\n");
}

function renderDatasetReadme(result) {
  return `# Grounded QA Joint-Action Training Packet

This dataset supports SFT plus DPO training for amortized grounded QA over evolving paper snapshots.

- Source support packet: \`${result.support_prep_run_id}\`
- Base model target: \`${result.base_model}\`
- SFT train rows: ${result.examples.sft_train}
- DPO train rows: ${result.examples.dpo_train}
- Eval prompts: ${result.examples.eval_prompts}

The DPO rows prefer either a reference-supported repair/regeneration or a justified abstention over a judged unsupported answer.
`;
}

function renderValidationScript() {
  return `#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# ///
import json
from pathlib import Path

root = Path(__file__).resolve().parent
dataset = root / "dataset"
errors = []

def read_jsonl(name):
    rows = []
    with (dataset / name).open() as f:
        for line in f:
            if line.strip():
                rows.append(json.loads(line))
    return rows

for name in ["sft_train.jsonl", "sft_validation.jsonl"]:
    rows = read_jsonl(name)
    if not rows:
        errors.append(f"{name} is empty")
    for i, row in enumerate(rows):
        messages = row.get("messages")
        if not isinstance(messages, list) or len(messages) != 3:
            errors.append(f"{name}:{i}: expected 3 messages")
            continue
        target = json.loads(messages[-1]["content"])
        if target.get("answer_type") == "grounded_answer":
            for citation in target.get("citations") or []:
                if f"[{citation}]" not in target.get("answer", ""):
                    errors.append(f"{name}:{i}: missing inline citation {citation}")

for name in ["dpo_train.jsonl", "dpo_validation.jsonl"]:
    rows = read_jsonl(name)
    if not rows:
        errors.append(f"{name} is empty")
    for i, row in enumerate(rows):
        if not isinstance(row.get("prompt"), list) or len(row["prompt"]) != 2:
            errors.append(f"{name}:{i}: expected 2-message prompt")
        for key in ["chosen", "rejected"]:
            parsed = json.loads(row[key])
            if parsed.get("answer_type") not in ["grounded_answer", "abstain"]:
                errors.append(f"{name}:{i}: bad {key} answer_type")
        if json.loads(row["chosen"]) == json.loads(row["rejected"]):
            errors.append(f"{name}:{i}: chosen and rejected are identical")

if len(read_jsonl("eval_prompts.jsonl")) == 0:
    errors.append("eval_prompts.jsonl is empty")

if errors:
    raise SystemExit("\\n".join(errors))

print(json.dumps({"status": "ready", "dataset_dir": str(dataset)}, indent=2))
`;
}

function renderTrainingScript({ baseModel, hubModelId }) {
  return `#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["torch", "transformers>=4.44.0", "datasets>=2.20.0", "trl>=0.12.0", "peft>=0.11.0", "accelerate", "bitsandbytes", "trackio"]
# ///
import json
import os
from pathlib import Path

from datasets import Dataset
from peft import LoraConfig
from trl import DPOConfig, DPOTrainer, SFTConfig, SFTTrainer

BASE_MODEL = os.environ.get("BASE_MODEL", ${JSON.stringify(baseModel)})
HUB_MODEL_ID = os.environ.get("HUB_MODEL_ID", ${JSON.stringify(hubModelId)})
DATASET_DIR = Path(os.environ.get("DATASET_DIR", Path(__file__).resolve().parent / "dataset"))

def read_jsonl(name):
    with (DATASET_DIR / name).open() as f:
        return [json.loads(line) for line in f if line.strip()]

def sft_text(row):
    return {"messages": row["messages"]}

def dpo_row(row):
    return {"prompt": row["prompt"], "chosen": row["chosen"], "rejected": row["rejected"]}

sft_train = Dataset.from_list([sft_text(r) for r in read_jsonl("sft_train.jsonl")])
sft_eval = Dataset.from_list([sft_text(r) for r in read_jsonl("sft_validation.jsonl")])
dpo_train = Dataset.from_list([dpo_row(r) for r in read_jsonl("dpo_train.jsonl")])
dpo_eval = Dataset.from_list([dpo_row(r) for r in read_jsonl("dpo_validation.jsonl")])

lora = LoraConfig(r=32, lora_alpha=64, lora_dropout=0.05, bias="none", task_type="CAUSAL_LM")

sft = SFTTrainer(
    model=BASE_MODEL,
    train_dataset=sft_train,
    eval_dataset=sft_eval,
    peft_config=lora,
    args=SFTConfig(
        output_dir="joint-action-sft",
        num_train_epochs=2,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=2e-4,
        max_length=1536,
        gradient_checkpointing=True,
        eval_strategy="epoch",
        save_strategy="epoch",
        report_to="trackio",
        project="grounded-qa-distillation",
        run_name="joint-action-sft-qwen3b",
    ),
)
sft.train()
sft.model.save_pretrained("joint-action-sft-adapter")

dpo = DPOTrainer(
    model=sft.model,
    ref_model=None,
    train_dataset=dpo_train,
    eval_dataset=dpo_eval,
    args=DPOConfig(
        output_dir="joint-action-dpo",
        num_train_epochs=1,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=5e-5,
        max_length=1536,
        max_prompt_length=1280,
        beta=0.1,
        gradient_checkpointing=True,
        eval_strategy="epoch",
        save_strategy="epoch",
        push_to_hub=True,
        hub_model_id=HUB_MODEL_ID,
        report_to="trackio",
        project="grounded-qa-distillation",
        run_name="joint-action-dpo-qwen3b",
    ),
)
dpo.train()
dpo.push_to_hub()
`;
}

function renderPrimePlan(result) {
  return `# Prime GPU Plan

Prime CLI is installed, but the current local API key was unauthorized during prep. Refresh auth before launch:

\`\`\`bash
prime login --headless
prime whoami
\`\`\`

Budget guardrail:

- Current total budget cap: $100
- Estimated GPU cost for this run: $${result.estimated_gpu_cost_usd.toFixed(2)}
- Ledger actual spend in \`docs/experiments/grounded-qa-distillation/spend/ledger.jsonl\` after launch/termination.

Recommended hardware: ${result.target_hardware}; target model \`${result.base_model}\`.

Launch options:

1. Create a Prime pod with one L4/A10G-class GPU.
2. Clone this repo at the commit containing \`${result.run_id}\`.
3. Run:

\`\`\`bash
uv run docs/experiments/grounded-qa-distillation/runs/${result.run_id}/validate_joint_action_dataset_uv.py
HF_TOKEN=... uv run docs/experiments/grounded-qa-distillation/runs/${result.run_id}/train_joint_action_lora_uv.py
\`\`\`

Do not start the pod if the estimated total spend exceeds the remaining experiment budget.
`;
}

function renderReport(result) {
  return `# Joint-Action GPU Prep

## Setup

- Run id: \`${result.run_id}\`
- Support prep run: \`${result.support_prep_run_id}\`
- Base model: \`${result.base_model}\`
- Hub model id: \`${result.hub_model_id}\`
- Estimated GPU cost: $${result.estimated_gpu_cost_usd.toFixed(2)}
- OpenAI calls: ${result.budget.openai_calls}

## Dataset

| Split | Rows |
| --- | ---: |
| SFT train | ${result.examples.sft_train} |
| SFT validation | ${result.examples.sft_validation} |
| DPO train | ${result.examples.dpo_train} |
| DPO validation | ${result.examples.dpo_validation} |
| Eval prompts | ${result.examples.eval_prompts} |

This packet implements the D95 decision: the next student should learn a joint action policy rather than a scalar suppression threshold.
`;
}

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : true;
  }
  return parsed;
}
