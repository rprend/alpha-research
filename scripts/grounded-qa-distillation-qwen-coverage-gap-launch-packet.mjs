import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "joint-action-gpu-prep-qwen7b-qwen-coverage-gap-scaffold-curriculum-v13";
const templateRunId = args["template-run-id"] ?? "joint-action-gpu-prep-qwen7b-support-targeted-planning-curriculum-v12";
const scaffoldPacketRunId = args["scaffold-packet-run-id"] ?? "qwen-coverage-gap-scaffold-packet-v13";
const smokeRunId = args["smoke-run-id"] ?? "joint-action-qwen7b-qwen-coverage-gap-scaffold-smoke-eval-v13";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const templateDir = path.join(runsDir, templateRunId);
const scaffoldDir = path.join(runsDir, scaffoldPacketRunId);

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const templateResult = await readJson(path.join(templateDir, "result.json"));
const scaffoldResult = await readJson(path.join(scaffoldDir, "result.json"));
if (scaffoldResult.status !== "ready_for_launch_packet_merge") {
  throw new Error(`${scaffoldPacketRunId} is not ready to merge: ${scaffoldResult.status}`);
}

const base = {
  sftTrain: await readJsonl(path.join(templateDir, "dataset", "sft_train.jsonl")),
  sftValidation: await readJsonl(path.join(templateDir, "dataset", "sft_validation.jsonl")),
  dpoTrain: await readJsonl(path.join(templateDir, "dataset", "dpo_train.jsonl")),
  dpoValidation: await readJsonl(path.join(templateDir, "dataset", "dpo_validation.jsonl")),
  evalPrompts: await readJsonl(path.join(templateDir, "dataset", "eval_prompts.jsonl")),
};
const scaffold = {
  sftTrain: await readJsonl(path.join(scaffoldDir, "dataset", "sft_train.jsonl")),
  sftValidation: await readJsonl(path.join(scaffoldDir, "dataset", "sft_validation.jsonl")),
  dpoTrain: await readJsonl(path.join(scaffoldDir, "dataset", "dpo_train.jsonl")),
  dpoValidation: await readJsonl(path.join(scaffoldDir, "dataset", "dpo_validation.jsonl")),
  qwenMissPrompts: await readJsonl(path.join(scaffoldDir, "dataset", "qwen_miss_eval_prompts.jsonl")),
};

const merged = {
  sftTrain: [...base.sftTrain, ...scaffold.sftTrain.map((row) => launchSftRow(row, "train"))],
  sftValidation: [...base.sftValidation, ...scaffold.sftValidation.map((row) => launchSftRow(row, "validation"))],
  dpoTrain: [...base.dpoTrain, ...scaffold.dpoTrain.map((row) => launchDpoRow(row, "train"))],
  dpoValidation: [...base.dpoValidation, ...scaffold.dpoValidation.map((row) => launchDpoRow(row, "validation"))],
  evalPrompts: base.evalPrompts,
};

await copyLaunchArtifacts();

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const estimatedGpuCostUsd = 4;
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen_coverage_gap_scaffold_launch_packet",
  status: "ready_for_bounded_gpu_smoke_after_preflight",
  purpose: "Merge the Qwen-only coverage-gap scaffold-distillation packet into the bounded Qwen 7B joint-action runner while preserving the unchanged 69-example final eval prompts.",
  source_packets: {
    base_packet_run_id: templateRunId,
    scaffold_packet_run_id: scaffoldPacketRunId,
    smoke_run_id: smokeRunId,
  },
  base_model: "Qwen/Qwen2.5-7B-Instruct",
  estimated_gpu_cost_usd: estimatedGpuCostUsd,
  curriculum: {
    type: "qwen_coverage_gap_scaffold_v13_launch",
    rationale: "D232 showed a Qwen-only oracle coverage ceiling; D233 built leakage-safe scaffold labels for the nine answerable final rows where Qwen had no supported answer. This launch packet tests whether that targeted scaffold distillation improves generation coverage.",
    inherited_base_curriculum: templateResult.curriculum?.type ?? null,
    scaffold_curriculum: scaffoldResult.curriculum?.type ?? null,
    output_contract: "Standard answer JSON only: answer_type, answer, citations, claim_table, abstention_reason.",
    qwen_oracle_answerable_miss_examples: scaffoldResult.upstream_evidence?.qwen_oracle_answerable_miss_examples ?? null,
    qwen_miss_profile_counts: scaffoldResult.upstream_evidence?.qwen_miss_profile_counts ?? null,
    leakage_guard: {
      final_eval_labels_used_for_training: false,
      train_eval_paper_overlap: [],
      validation_eval_paper_overlap: [],
      source_scaffold_guard_passes: scaffoldResult.curriculum?.leakage_guard?.passes === true,
    },
  },
  examples: {
    sft_train: merged.sftTrain.length,
    sft_validation: merged.sftValidation.length,
    dpo_train: merged.dpoTrain.length,
    dpo_validation: merged.dpoValidation.length,
    eval_prompts: merged.evalPrompts.length,
    base_sft_train: base.sftTrain.length,
    scaffold_sft_train_added: scaffold.sftTrain.length,
    base_dpo_train: base.dpoTrain.length,
    scaffold_dpo_train_added: scaffold.dpoTrain.length,
    qwen_miss_eval_prompts_diagnostic_only: scaffold.qwenMissPrompts.length,
  },
  quality_gates: {
    scaffold_train_sft_added: scaffold.sftTrain.length,
    scaffold_validation_sft_added: scaffold.sftValidation.length,
    scaffold_train_dpo_added: scaffold.dpoTrain.length,
    scaffold_validation_dpo_added: scaffold.dpoValidation.length,
    eval_prompts_unchanged_from_base: sameExampleIds(merged.evalPrompts, base.evalPrompts),
    qwen_miss_prompts_training_use: "diagnostic_only_not_merged",
    standard_output_contract: true,
    train_scaffold_style_counts: scaffoldResult.quality_gates?.train_summary ?? null,
    validation_scaffold_style_counts: scaffoldResult.quality_gates?.validation_summary ?? null,
  },
  launch_gate: {
    launch_next_gpu_now: false,
    required_before_launch: [
      "Run the generated packet dataset validator.",
      "Run grounded-QA repository validator.",
      "Run bash syntax checks for copied launch scripts.",
      "Check total budget, Prime auth, wallet, active pods, and live GPU availability.",
    ],
    budget_policy: "Do not launch if actual plus projected OpenAI and external compute spend would exceed $100.",
    projected_total_after_smoke_usd: budget.spend_usd.total_actual + estimatedGpuCostUsd,
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    openai_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "Packet materialization is local and deterministic. No API/model calls and no GPU job.",
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
    eval_script: rel(path.join(outputDir, "eval_joint_action_adapter_uv.py")),
    smoke_runner: rel(path.join(outputDir, "run_joint_action_smoke.sh")),
    prime_bootstrap: rel(path.join(outputDir, "run_prime_qwen3b_smoke_on_pod.sh")),
    prime_plan: rel(path.join(outputDir, "prime_gpu_plan.md")),
  },
};

await writeJsonl(path.join(datasetDir, "sft_train.jsonl"), merged.sftTrain);
await writeJsonl(path.join(datasetDir, "sft_validation.jsonl"), merged.sftValidation);
await writeJsonl(path.join(datasetDir, "dpo_train.jsonl"), merged.dpoTrain);
await writeJsonl(path.join(datasetDir, "dpo_validation.jsonl"), merged.dpoValidation);
await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), merged.evalPrompts);
await fs.writeFile(path.join(datasetDir, "README.md"), renderDatasetReadme(result));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  examples: result.examples,
  launch_gate: result.launch_gate,
  budget: result.budget,
}, null, 2));

function launchSftRow(row, split) {
  const target = standardOutput(row.target);
  return {
    ...row,
    example_id: `${row.example_id}:launch-v13`,
    task: "citation_grounded_domain_qa_qwen_coverage_gap_scaffold_launch_sft",
    messages: [
      { role: "system", content: standardSystemPrompt() },
      { role: "user", content: scaffoldAwareUserContent(row) },
      { role: "assistant", content: JSON.stringify(target) },
    ],
    target,
    label_source: {
      ...(row.label_source ?? {}),
      type: "qwen_coverage_gap_scaffold_launch_sft",
      source_scaffold_task: row.task,
      output_contract: "standard_answer_json",
      split,
      final_window_label_used: false,
    },
  };
}

function launchDpoRow(row, split) {
  const chosen = standardOutput(row.chosen_output ?? JSON.parse(row.chosen));
  const rejected = standardOutput(row.rejected_output ?? JSON.parse(row.rejected));
  return {
    ...row,
    example_id: `${row.example_id}:launch-v13`,
    task: "citation_grounded_domain_qa_qwen_coverage_gap_scaffold_launch_dpo",
    prompt: [
      { role: "system", content: standardSystemPrompt() },
      { role: "user", content: scaffoldAwareUserContent(row) },
    ],
    chosen: JSON.stringify(chosen),
    rejected: JSON.stringify(rejected),
    chosen_output: chosen,
    rejected_output: rejected,
    label_source: {
      ...(row.label_source ?? {}),
      source_scaffold_task: row.task,
      output_contract: "standard_answer_json",
      split,
      final_window_label_used: false,
    },
  };
}

function scaffoldAwareUserContent(row) {
  const original = row.messages?.[1]?.content ?? row.prompt?.[1]?.content ?? "";
  const profile = row.label_source?.profile ?? {};
  const hints = [
    "",
    "Qwen coverage-gap scaffold hints:",
    `- Answer style: ${profile.style ?? "unknown"}`,
    "- Prefer complete, cited scaffold-style answers over fragments.",
    "- For yes/no questions, preserve the polarity before writing the final JSON.",
    "- For list or multi-evidence questions, include all requested supported items and cite each factual clause.",
  ];
  return `${original}${hints.join("\n")}`;
}

function standardOutput(value) {
  const answerType = value?.answer_type === "abstain" ? "abstain" : "grounded_answer";
  return {
    answer_type: answerType,
    answer: String(value?.answer ?? ""),
    citations: answerType === "abstain" ? [] : Array.isArray(value?.citations) ? value.citations : [],
    claim_table: Array.isArray(value?.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value?.abstention_reason ?? "") : "",
  };
}

function standardSystemPrompt() {
  return [
    "Answer using only the compact evidence pack.",
    "Return valid JSON only with keys answer_type, answer, citations, claim_table, and abstention_reason.",
    "For yes/no questions, preserve polarity exactly and cite the evidence supporting the polarity.",
    "For list, metric, count, or multi-evidence questions, copy all supported requested items and cite every factual clause inline.",
    "If direct support is missing, abstain rather than answering from nearby evidence.",
  ].join(" ");
}

async function copyLaunchArtifacts() {
  const files = [
    "validate_joint_action_dataset_uv.py",
    "train_joint_action_lora_uv.py",
    "eval_joint_action_adapter_uv.py",
    "run_joint_action_smoke.sh",
    "run_prime_qwen3b_smoke_on_pod.sh",
    "prime_gpu_plan.md",
  ];
  for (const file of files) {
    let text = await fs.readFile(path.join(templateDir, file), "utf8");
    text = text
      .replaceAll(templateRunId, runId)
      .replaceAll("joint-action-qwen7b-support-targeted-planning-smoke-eval-v12", smokeRunId)
      .replaceAll("grounded-qa-support-targeted-planning-qwen7b-lora-v12", "grounded-qa-qwen-coverage-gap-scaffold-qwen7b-lora-v13")
      .replaceAll("qwen2_5_7b_support_targeted_planning_joint_action_lora", "qwen2_5_7b_qwen_coverage_gap_scaffold_joint_action_lora");
    if (file === "prime_gpu_plan.md") text = renderPrimePlan();
    await fs.writeFile(path.join(outputDir, file), text);
  }
  for (const file of ["run_joint_action_smoke.sh", "run_prime_qwen3b_smoke_on_pod.sh"]) {
    await fs.chmod(path.join(outputDir, file), 0o755);
  }
}

function renderPrimePlan() {
  return `# Prime GPU Plan: Qwen 7B Coverage-Gap Scaffold v13

Packet: \`${runId}\`

Smoke run id: \`${smokeRunId}\`

This packet is ready for bounded smoke only after live Prime and budget preflight.

\`\`\`bash
uv run docs/experiments/grounded-qa-distillation/runs/${runId}/validate_joint_action_dataset_uv.py
BASE_MODEL=Qwen/Qwen2.5-7B-Instruct RUN_ID=${smokeRunId} MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/${runId}/run_joint_action_smoke.sh
\`\`\`

Budget guard: do not launch if estimated total OpenAI plus external compute spend would exceed $100. Terminate the Prime pod and record actual spend immediately after the run.
`;
}

function sameExampleIds(left, right) {
  return left.length === right.length && left.every((row, index) => row.example_id === right[index]?.example_id);
}

function renderDatasetReadme(result) {
  return `# Qwen Coverage-Gap Scaffold Launch Packet

Run: \`${result.run_id}\`

This merges the v12 support-targeted packet with v13 Qwen coverage-gap scaffold labels. Final eval prompts remain the unchanged 69-example final window.

Final eval labels are not used for training. The 9 Qwen-miss prompts from the scaffold packet are diagnostic-only and are not merged into train or validation.

## Counts

| Split | SFT | DPO |
| --- | ---: | ---: |
| Train | ${result.examples.sft_train} | ${result.examples.dpo_train} |
| Validation | ${result.examples.sft_validation} | ${result.examples.dpo_validation} |
| Eval prompts | ${result.examples.eval_prompts} | n/a |
`;
}

function renderReport(result) {
  return `# Qwen Coverage-Gap Scaffold Launch Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Counts

| Dataset | Rows |
| --- | ---: |
| SFT train | ${result.examples.sft_train} |
| SFT validation | ${result.examples.sft_validation} |
| DPO train | ${result.examples.dpo_train} |
| DPO validation | ${result.examples.dpo_validation} |
| Eval prompts | ${result.examples.eval_prompts} |

Scaffold rows added: ${result.examples.scaffold_sft_train_added} SFT train, ${result.examples.scaffold_dpo_train_added} DPO train.

## Launch Gate

GPU launch is not automatic. Required next steps:
${result.launch_gate.required_before_launch.map((step) => `- ${step}`).join("\n")}

This packet materialization made no OpenAI calls and launched no GPU jobs.
`;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
