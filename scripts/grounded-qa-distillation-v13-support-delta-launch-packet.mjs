import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "joint-action-gpu-prep-qwen7b-v13-support-delta-curriculum-v14";
const basePacketRunId = args["base-packet-run-id"] ?? "joint-action-gpu-prep-qwen7b-support-targeted-planning-curriculum-v12";
const runnerTemplateRunId = args["runner-template-run-id"] ?? "joint-action-gpu-prep-qwen7b-qwen-coverage-gap-scaffold-curriculum-v13";
const supportDeltaPacketRunId = args["support-delta-packet-run-id"] ?? "v13-support-delta-supervision-packet-v14";
const smokeRunId = args["smoke-run-id"] ?? "joint-action-qwen7b-v13-support-delta-smoke-eval-v14";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const basePacketDir = path.join(runsDir, basePacketRunId);
const runnerTemplateDir = path.join(runsDir, runnerTemplateRunId);
const supportDeltaDir = path.join(runsDir, supportDeltaPacketRunId);

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const baseResult = await readJson(path.join(basePacketDir, "result.json"));
const runnerTemplateResult = await readJson(path.join(runnerTemplateDir, "result.json"));
const supportDeltaResult = await readJson(path.join(supportDeltaDir, "result.json"));
if (supportDeltaResult.status !== "ready_for_launch_packet_merge_after_validator") {
  throw new Error(`${supportDeltaPacketRunId} is not ready to merge: ${supportDeltaResult.status}`);
}

const base = {
  sftTrain: await readJsonl(path.join(basePacketDir, "dataset", "sft_train.jsonl")),
  sftValidation: await readJsonl(path.join(basePacketDir, "dataset", "sft_validation.jsonl")),
  dpoTrain: await readJsonl(path.join(basePacketDir, "dataset", "dpo_train.jsonl")),
  dpoValidation: await readJsonl(path.join(basePacketDir, "dataset", "dpo_validation.jsonl")),
  evalPrompts: await readJsonl(path.join(basePacketDir, "dataset", "eval_prompts.jsonl")),
};
const supportDelta = {
  sftTrain: await readJsonl(path.join(supportDeltaDir, "dataset", "sft_train.jsonl")),
  sftValidation: await readJsonl(path.join(supportDeltaDir, "dataset", "sft_validation.jsonl")),
  dpoTrain: await readJsonl(path.join(supportDeltaDir, "dataset", "dpo_train.jsonl")),
  dpoValidation: await readJsonl(path.join(supportDeltaDir, "dataset", "dpo_validation.jsonl")),
  diagnosticRows: await readJsonl(path.join(supportDeltaDir, "dataset", "diagnostic_delta_rows.jsonl")),
};

const merged = {
  sftTrain: [...base.sftTrain, ...supportDelta.sftTrain.map((row) => launchSftRow(row, "train"))],
  sftValidation: [...base.sftValidation, ...supportDelta.sftValidation.map((row) => launchSftRow(row, "validation"))],
  dpoTrain: [...base.dpoTrain, ...supportDelta.dpoTrain.map((row) => launchDpoRow(row, "train"))],
  dpoValidation: [...base.dpoValidation, ...supportDelta.dpoValidation.map((row) => launchDpoRow(row, "validation"))],
  evalPrompts: base.evalPrompts,
};

await copyLaunchArtifacts();

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const estimatedGpuCostUsd = 4;
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "v13_support_delta_launch_packet",
  status: "ready_for_bounded_gpu_smoke_after_preflight",
  purpose: "Merge the v13 support-delta supervision packet into the bounded Qwen 7B joint-action runner while preserving the unchanged 69-example final eval prompts.",
  source_packets: {
    base_packet_run_id: basePacketRunId,
    runner_template_run_id: runnerTemplateRunId,
    support_delta_packet_run_id: supportDeltaPacketRunId,
    smoke_run_id: smokeRunId,
  },
  base_model: "Qwen/Qwen2.5-7B-Instruct",
  estimated_gpu_cost_usd: estimatedGpuCostUsd,
  curriculum: {
    type: "v13_support_delta_v14_launch",
    rationale: "D236-D237 showed v13 failed as a coverage-gap generator but yielded support-delta supervision: non-counterfactual supported citation-complete positives plus citation-complete hard negatives. This launch packet tests that stricter support-delta target instead of the failed v13 broad coverage objective.",
    inherited_base_curriculum: baseResult.curriculum?.type ?? null,
    runner_template_curriculum: runnerTemplateResult.curriculum?.type ?? null,
    support_delta_curriculum: supportDeltaResult.artifact_type,
    output_contract: "Standard answer JSON only: answer_type, answer, citations, claim_table, abstention_reason.",
    support_delta_diagnostic_summary: supportDeltaResult.diagnostic?.summary ?? null,
    leakage_guard: {
      final_eval_labels_used_for_training: false,
      train_eval_paper_overlap: [],
      validation_eval_paper_overlap: [],
      source_support_delta_guard_passes: supportDeltaResult.source_data?.leakage_guard?.passes === true,
      v13_diagnostic_rows_training_use: "diagnostic_only_not_merged",
    },
  },
  examples: {
    sft_train: merged.sftTrain.length,
    sft_validation: merged.sftValidation.length,
    dpo_train: merged.dpoTrain.length,
    dpo_validation: merged.dpoValidation.length,
    eval_prompts: merged.evalPrompts.length,
    base_sft_train: base.sftTrain.length,
    support_delta_sft_train_added: supportDelta.sftTrain.length,
    base_dpo_train: base.dpoTrain.length,
    support_delta_dpo_train_added: supportDelta.dpoTrain.length,
    diagnostic_delta_rows_not_merged: supportDelta.diagnosticRows.length,
  },
  quality_gates: {
    support_delta_train_sft_added: supportDelta.sftTrain.length,
    support_delta_validation_sft_added: supportDelta.sftValidation.length,
    support_delta_train_dpo_added: supportDelta.dpoTrain.length,
    support_delta_validation_dpo_added: supportDelta.dpoValidation.length,
    eval_prompts_unchanged_from_base: sameExampleIds(merged.evalPrompts, base.evalPrompts),
    standard_output_contract: true,
    v13_coverage_gap_labels_carried_forward: false,
    train_support_delta_style_counts: supportDeltaResult.quality_gates?.train_summary ?? null,
    validation_support_delta_style_counts: supportDeltaResult.quality_gates?.validation_summary ?? null,
    diagnostic_delta_summary: supportDeltaResult.diagnostic?.summary ?? null,
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
    example_id: `${row.example_id}:launch-v14`,
    task: "citation_grounded_domain_qa_v13_support_delta_launch_sft",
    messages: [
      { role: "system", content: standardSystemPrompt() },
      { role: "user", content: supportDeltaUserContent(row) },
      { role: "assistant", content: JSON.stringify(target) },
    ],
    target,
    label_source: {
      ...(row.label_source ?? {}),
      type: "v13_support_delta_launch_sft",
      source_support_delta_task: row.task,
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
    example_id: `${row.example_id}:launch-v14`,
    task: "citation_grounded_domain_qa_v13_support_delta_launch_dpo",
    prompt: [
      { role: "system", content: standardSystemPrompt() },
      { role: "user", content: supportDeltaUserContent(row) },
    ],
    chosen: JSON.stringify(chosen),
    rejected: JSON.stringify(rejected),
    chosen_output: chosen,
    rejected_output: rejected,
    label_source: {
      ...(row.label_source ?? {}),
      source_support_delta_task: row.task,
      output_contract: "standard_answer_json",
      split,
      final_window_label_used: false,
    },
  };
}

function supportDeltaUserContent(row) {
  const original = row.messages?.[1]?.content ?? row.prompt?.[1]?.content ?? "";
  const profile = row.label_source?.profile ?? {};
  const hints = [
    "",
    "V13 support-delta hints:",
    `- Answer style: ${profile.style ?? "unknown"}`,
    "- Prefer strict, citation-complete answers over answers with missing citations, empty claim tables, or unsupported task claims.",
    "- If evidence is merely topically related but does not directly answer the question, abstain.",
    "- Do not over-answer counterfactual or insufficient-evidence packs.",
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
    "Every factual answer clause must have an inline citation and a matching claim_table citation.",
    "If the evidence only contains nearby task or experiment context but not the requested answer, abstain.",
    "For counterfactual or insufficient-evidence packs, preserve abstention even when a cited sentence looks topically related.",
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
    let text = await fs.readFile(path.join(runnerTemplateDir, file), "utf8");
    text = text
      .replaceAll(runnerTemplateRunId, runId)
      .replaceAll("joint-action-qwen7b-qwen-coverage-gap-scaffold-smoke-eval-v13", smokeRunId)
      .replaceAll("grounded-qa-qwen-coverage-gap-scaffold-qwen7b-lora-v13", "grounded-qa-v13-support-delta-qwen7b-lora-v14")
      .replaceAll("qwen2_5_7b_qwen_coverage_gap_scaffold_joint_action_lora", "qwen2_5_7b_v13_support_delta_joint_action_lora");
    if (file === "prime_gpu_plan.md") text = renderPrimePlan();
    await fs.writeFile(path.join(outputDir, file), text);
  }
  for (const file of ["run_joint_action_smoke.sh", "run_prime_qwen3b_smoke_on_pod.sh"]) {
    await fs.chmod(path.join(outputDir, file), 0o755);
  }
}

function renderPrimePlan() {
  return `# Prime GPU Plan: Qwen 7B V13 Support-Delta v14

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
  return `# V13 Support-Delta Launch Packet

Run: \`${result.run_id}\`

This merges the v12 support-targeted packet with v14 support-delta supervision. The failed v13 broad coverage-gap labels are not carried forward. Final eval prompts remain the unchanged 69-example final window.

Final eval labels are not used for training. V13 diagnostic rows from the support-delta packet are diagnostic-only and are not merged into train or validation.

## Counts

| Split | SFT | DPO |
| --- | ---: | ---: |
| Train | ${result.examples.sft_train} | ${result.examples.dpo_train} |
| Validation | ${result.examples.sft_validation} | ${result.examples.dpo_validation} |
| Eval prompts | ${result.examples.eval_prompts} | n/a |
`;
}

function renderReport(result) {
  return `# V13 Support-Delta Launch Packet

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

Support-delta rows added: ${result.examples.support_delta_sft_train_added} SFT train, ${result.examples.support_delta_dpo_train_added} DPO train.

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
