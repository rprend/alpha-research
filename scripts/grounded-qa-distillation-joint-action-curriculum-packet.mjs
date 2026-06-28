import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const sourcePacketRunId = args["source-packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1";
const repairabilityRunId = args["repairability-run-id"] ?? "unsupported-answer-repairability-audit-final-window-2026-06-27-v1";
const runId = args["run-id"] ?? "joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2";
const repairRepeat = numberArg(args["repair-repeat"], 2);
const abstainRepeat = numberArg(args["abstain-repeat"], 2);
const supportedRepeat = numberArg(args["supported-repeat"], 1);
const requestedBaseModel = args["base-model"] ?? null;
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const sourceDir = path.join(runsDir, sourcePacketRunId);
const sourceDatasetDir = path.join(sourceDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });

const source = await readJson(path.join(sourceDir, "result.json"));
const repairability = await readJson(path.join(runsDir, repairabilityRunId, "result.json"));
const baseModel = requestedBaseModel ?? source.base_model;
const sourceRows = {
  sft_train: await readJsonl(path.join(sourceDatasetDir, "sft_train.jsonl")),
  sft_validation: await readJsonl(path.join(sourceDatasetDir, "sft_validation.jsonl")),
  dpo_train: await readJsonl(path.join(sourceDatasetDir, "dpo_train.jsonl")),
  dpo_validation: await readJsonl(path.join(sourceDatasetDir, "dpo_validation.jsonl")),
  eval_prompts: await readJsonl(path.join(sourceDatasetDir, "eval_prompts.jsonl")),
};

const curriculum = {
  supported_answer_sft: supportedRepeat,
  repair_unsupported_answer_with_reference: repairRepeat,
  abstain_on_insufficient_evidence: abstainRepeat,
  prefer_reference_repair_over_unsupported_answer: repairRepeat,
  prefer_abstention_over_unsupported_answer: abstainRepeat,
};

const rows = {
  sft_train: expandRows(sourceRows.sft_train, (row) => repeatForSft(row, curriculum), "sft"),
  sft_validation: expandRows(sourceRows.sft_validation, () => 1, "sft_validation"),
  dpo_train: expandRows(sourceRows.dpo_train, (row) => repeatForDpo(row, curriculum), "dpo"),
  dpo_validation: expandRows(sourceRows.dpo_validation, () => 1, "dpo_validation"),
  eval_prompts: sourceRows.eval_prompts.map((row) => ({ ...row })),
};

const copiedFiles = [
  "validate_joint_action_dataset_uv.py",
  "train_joint_action_lora_uv.py",
  "eval_joint_action_adapter_uv.py",
  "run_joint_action_smoke.sh",
  "run_prime_qwen3b_smoke_on_pod.sh",
  "prime_gpu_plan.md",
];
for (const file of copiedFiles) {
  const sourcePath = path.join(sourceDir, file);
  const outputPath = path.join(outputDir, file);
  if (file.endsWith(".py")) {
    let copied = await fs.readFile(sourcePath, "utf8");
    copied = copied.replaceAll(source.base_model, baseModel);
    if (file === "train_joint_action_lora_uv.py") copied = patchTrainScriptForCurrentTrl(copied);
    await fs.writeFile(outputPath, copied);
  } else {
    const copied = await fs.readFile(sourcePath, "utf8");
    await fs.writeFile(outputPath, copied
      .replaceAll(sourcePacketRunId, runId)
      .replaceAll(source.base_model, baseModel)
      .replaceAll("RUN_ID=joint-action-qwen3b-smoke-eval-v1", `RUN_ID=${runId.replace("joint-action-gpu-prep-", "joint-action-").replace("-curriculum", "-smoke-eval")}`)
      .replaceAll("RUN_ID=\"${RUN_ID:-joint-action-qwen3b-smoke-eval-v1}\"", `RUN_ID="\${RUN_ID:-${runId.replace("joint-action-gpu-prep-", "joint-action-").replace("-curriculum", "-smoke-eval")}}"`));
  }
}
for (const file of ["run_joint_action_smoke.sh", "run_prime_qwen3b_smoke_on_pod.sh"]) {
  await fs.chmod(path.join(outputDir, file), 0o755);
}

const result = {
  ...source,
  run_id: runId,
  generated_at: new Date().toISOString(),
  base_model: baseModel,
  source_packet_run_id: sourcePacketRunId,
  support_prep_run_id: source.support_prep_run_id,
  curriculum: {
    type: "repair_abstention_oversampled_curriculum",
    repairability_run_id: repairabilityRunId,
    rationale: "Final-window unsupported direct answers are mostly answer repair/regeneration or abstention cases, not citation-only repair. Oversample those action rows before the bounded Qwen 3B smoke.",
    repeat_policy: curriculum,
    source_counts: summarizeRows(sourceRows),
    curriculum_counts: summarizeRows(rows),
    repairability_signal: {
      unsupported_answer_rows: repairability.aggregate.unsupported_answer_rows,
      citation_repair_candidate_rows: repairability.aggregate.citation_repair_candidate_rows,
      answer_repair_or_regeneration_needed_rows: repairability.aggregate.answer_repair_or_regeneration_needed_rows,
      reference_insufficient_rows: repairability.aggregate.reference_insufficient_rows,
      recommendation: repairability.training_implication.recommendation,
    },
  },
  examples: {
    sft_train: rows.sft_train.length,
    sft_validation: rows.sft_validation.length,
    dpo_train: rows.dpo_train.length,
    dpo_validation: rows.dpo_validation.length,
    eval_prompts: rows.eval_prompts.length,
    train_repair_or_abstain_rows: rows.sft_train.filter((row) => row.label_source?.type !== "supported_answer_sft").length,
    validation_repair_or_abstain_rows: rows.sft_validation.filter((row) => row.label_source?.type !== "supported_answer_sft").length,
    dpo_chosen_grounded_train: rows.dpo_train.filter((row) => row.chosen_output?.answer_type === "grounded_answer").length,
    dpo_chosen_abstain_train: rows.dpo_train.filter((row) => row.chosen_output?.answer_type === "abstain").length,
  },
  objective: {
    ...source.objective,
    rationale: "D172 showed final-window unsupported direct answers mostly require answer repair/regeneration or abstention. This curriculum packet keeps the joint-action objective and oversamples those action rows for the bounded smoke.",
  },
  budget: {
    ...source.budget,
    openai_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This curriculum packet is generated from existing local rows. It makes no API/model calls and launches no GPU job.",
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

await writeJsonl(path.join(datasetDir, "sft_train.jsonl"), rows.sft_train);
await writeJsonl(path.join(datasetDir, "sft_validation.jsonl"), rows.sft_validation);
await writeJsonl(path.join(datasetDir, "dpo_train.jsonl"), rows.dpo_train);
await writeJsonl(path.join(datasetDir, "dpo_validation.jsonl"), rows.dpo_validation);
await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), rows.eval_prompts);
await fs.writeFile(path.join(datasetDir, "README.md"), renderDatasetReadme(result));
await fs.writeFile(path.join(outputDir, "curriculum_manifest.json"), `${JSON.stringify(result.curriculum, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  source_packet_run_id: result.source_packet_run_id,
  examples: result.examples,
  curriculum: result.curriculum,
  budget: result.budget,
}, null, 2));

function repeatForSft(row, policy) {
  return policy[row.label_source?.type] ?? 1;
}

function patchTrainScriptForCurrentTrl(sourceText) {
  let text = sourceText;
  if (!text.includes("import inspect")) {
    text = text.replace("import os\n", "import os\nimport inspect\n");
  }
  if (!text.includes("def supported_kwargs(")) {
    text = text.replace(
      'def dpo_row(row):\n    return {"prompt": row["prompt"], "chosen": row["chosen"], "rejected": row["rejected"]}\n',
      `def dpo_row(row):
    return {
        "prompt": row["prompt"],
        "chosen": [{"role": "assistant", "content": row["chosen"]}],
        "rejected": [{"role": "assistant", "content": row["rejected"]}],
    }

def supported_kwargs(cls, values):
    params = inspect.signature(cls.__init__).parameters
    return {key: value for key, value in values.items() if key in params}
`,
    );
  }
  if (text.includes("args=DPOConfig(\n        output_dir=\"joint-action-dpo\"")) {
    text = text.replace(
      `args=DPOConfig(
        output_dir="joint-action-dpo",
        num_train_epochs=1,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=5e-5,
        max_length=1536,
        max_prompt_length=1280,
        beta=0.1,
        gradient_checkpointing=True,
        max_steps=MAX_DPO_STEPS if MAX_DPO_STEPS > 0 else -1,
        eval_strategy="epoch",
        save_strategy="epoch",
        push_to_hub=PUSH_TO_HUB,
        hub_model_id=HUB_MODEL_ID,
        report_to=REPORT_TO,
        model_init_kwargs=model_init_kwargs(),
        project="grounded-qa-distillation",
        run_name="joint-action-dpo-qwen3b",
    ),`,
      `args=DPOConfig(**supported_kwargs(DPOConfig, {
        "output_dir": "joint-action-dpo",
        "num_train_epochs": 1,
        "per_device_train_batch_size": 1,
        "gradient_accumulation_steps": 8,
        "learning_rate": 5e-5,
        "max_length": 1536,
        "max_prompt_length": 1280,
        "beta": 0.1,
        "gradient_checkpointing": True,
        "max_steps": MAX_DPO_STEPS if MAX_DPO_STEPS > 0 else -1,
        "eval_strategy": "no",
        "save_strategy": "no",
        "push_to_hub": PUSH_TO_HUB,
        "hub_model_id": HUB_MODEL_ID,
        "report_to": REPORT_TO,
        "model_init_kwargs": model_init_kwargs(),
        "project": "grounded-qa-distillation",
        "run_name": "joint-action-dpo-qwen3b",
    })),`,
    );
  }
  return text;
}

function repeatForDpo(row, policy) {
  return policy[row.label_source?.type] ?? 1;
}

function expandRows(rows, repeatFn, split) {
  const output = [];
  for (const row of rows) {
    const repeat = repeatFn(row);
    for (let index = 0; index < repeat; index += 1) {
      output.push({
        ...row,
        curriculum_metadata: {
          source_example_id: row.example_id,
          split,
          repeat_index: index,
          repeat_count: repeat,
          oversampled: repeat > 1,
        },
      });
    }
  }
  return output;
}

function summarizeRows(rowSets) {
  return {
    sft_train: summarizeSft(rowSets.sft_train),
    sft_validation: summarizeSft(rowSets.sft_validation),
    dpo_train: summarizeDpo(rowSets.dpo_train),
    dpo_validation: summarizeDpo(rowSets.dpo_validation),
    eval_prompts: { rows: rowSets.eval_prompts.length },
  };
}

function summarizeSft(rows) {
  const labelCounts = {};
  for (const row of rows) {
    const type = row.label_source?.type ?? "unknown";
    labelCounts[type] = (labelCounts[type] ?? 0) + 1;
  }
  return {
    rows: rows.length,
    label_source_counts: labelCounts,
    repair_or_abstain_rows: rows.filter((row) => row.label_source?.type !== "supported_answer_sft").length,
  };
}

function summarizeDpo(rows) {
  const labelCounts = {};
  for (const row of rows) {
    const type = row.label_source?.type ?? "unknown";
    labelCounts[type] = (labelCounts[type] ?? 0) + 1;
  }
  return {
    rows: rows.length,
    label_source_counts: labelCounts,
    repair_rows: labelCounts.prefer_reference_repair_over_unsupported_answer ?? 0,
    abstention_rows: labelCounts.prefer_abstention_over_unsupported_answer ?? 0,
  };
}

function renderDatasetReadme(result) {
  return `# Grounded QA Joint-Action Curriculum Packet

This packet is generated from \`${result.source_packet_run_id}\` and keeps the same final eval prompts.

The only change is train-time oversampling:

- Supported-answer SFT rows: ${result.curriculum.repeat_policy.supported_answer_sft}x
- Repair SFT rows: ${result.curriculum.repeat_policy.repair_unsupported_answer_with_reference}x
- Abstention SFT rows: ${result.curriculum.repeat_policy.abstain_on_insufficient_evidence}x
- Repair DPO rows: ${result.curriculum.repeat_policy.prefer_reference_repair_over_unsupported_answer}x
- Abstention DPO rows: ${result.curriculum.repeat_policy.prefer_abstention_over_unsupported_answer}x

Rationale: ${result.curriculum.rationale}
`;
}

function renderReport(result) {
  const source = result.curriculum.source_counts;
  const current = result.curriculum.curriculum_counts;
  return `# Joint-Action Curriculum Packet

Run id: \`${result.run_id}\`

Source packet: \`${result.source_packet_run_id}\`

## Why This Packet Exists

${result.curriculum.rationale}

## Repairability Signal

| Unsupported direct answers | Citation-repair candidates | Answer repair/regeneration needed | Should abstain |
| ---: | ---: | ---: | ---: |
| ${result.curriculum.repairability_signal.unsupported_answer_rows} | ${result.curriculum.repairability_signal.citation_repair_candidate_rows} | ${result.curriculum.repairability_signal.answer_repair_or_regeneration_needed_rows} | ${result.curriculum.repairability_signal.reference_insufficient_rows} |

## Row Counts

| Split | Source rows | Curriculum rows |
| --- | ---: | ---: |
| SFT train | ${source.sft_train.rows} | ${current.sft_train.rows} |
| SFT validation | ${source.sft_validation.rows} | ${current.sft_validation.rows} |
| DPO train | ${source.dpo_train.rows} | ${current.dpo_train.rows} |
| DPO validation | ${source.dpo_validation.rows} | ${current.dpo_validation.rows} |
| Eval prompts | ${source.eval_prompts.rows} | ${current.eval_prompts.rows} |

## Train Label Mix

| Label | Source SFT | Curriculum SFT | Source DPO | Curriculum DPO |
| --- | ---: | ---: | ---: | ---: |
| Supported answer | ${source.sft_train.label_source_counts.supported_answer_sft ?? 0} | ${current.sft_train.label_source_counts.supported_answer_sft ?? 0} | n/a | n/a |
| Repair/regenerate | ${source.sft_train.label_source_counts.repair_unsupported_answer_with_reference ?? 0} | ${current.sft_train.label_source_counts.repair_unsupported_answer_with_reference ?? 0} | ${source.dpo_train.label_source_counts.prefer_reference_repair_over_unsupported_answer ?? 0} | ${current.dpo_train.label_source_counts.prefer_reference_repair_over_unsupported_answer ?? 0} |
| Abstain | ${source.sft_train.label_source_counts.abstain_on_insufficient_evidence ?? 0} | ${current.sft_train.label_source_counts.abstain_on_insufficient_evidence ?? 0} | ${source.dpo_train.label_source_counts.prefer_abstention_over_unsupported_answer ?? 0} | ${current.dpo_train.label_source_counts.prefer_abstention_over_unsupported_answer ?? 0} |

This packet makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
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
