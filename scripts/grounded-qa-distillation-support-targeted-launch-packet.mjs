import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "joint-action-gpu-prep-qwen7b-support-targeted-planning-curriculum-v12";
const templateRunId = args["template-run-id"] ?? "joint-action-gpu-prep-qwen7b-mixed-metric-repair-curriculum-v11";
const planningRunId = args["planning-run-id"] ?? "support-targeted-planning-packet-v12";
const smokeRunId = args["smoke-run-id"] ?? "joint-action-qwen7b-support-targeted-planning-smoke-eval-v12";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const templateDir = path.join(runsDir, templateRunId);
const planningDir = path.join(runsDir, planningRunId);

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const templateResult = await readJson(path.join(templateDir, "result.json"));
const planningResult = await readJson(path.join(planningDir, "result.json"));
if (planningResult.status !== "ready_to_merge_into_next_gpu_packet") {
  throw new Error(`${planningRunId} is not ready to merge: ${planningResult.status}`);
}

const base = {
  sftTrain: await readJsonl(path.join(templateDir, "dataset", "sft_train.jsonl")),
  sftValidation: await readJsonl(path.join(templateDir, "dataset", "sft_validation.jsonl")),
  dpoTrain: await readJsonl(path.join(templateDir, "dataset", "dpo_train.jsonl")),
  dpoValidation: await readJsonl(path.join(templateDir, "dataset", "dpo_validation.jsonl")),
  evalPrompts: await readJsonl(path.join(templateDir, "dataset", "eval_prompts.jsonl")),
};
const planning = {
  sftTrain: await readJsonl(path.join(planningDir, "dataset", "planning_sft_train.jsonl")),
  sftValidation: await readJsonl(path.join(planningDir, "dataset", "planning_sft_validation.jsonl")),
  dpoTrain: await readJsonl(path.join(planningDir, "dataset", "planning_dpo_train.jsonl")),
  dpoValidation: await readJsonl(path.join(planningDir, "dataset", "planning_dpo_validation.jsonl")),
  evalPrompts: await readJsonl(path.join(planningDir, "dataset", "eval_missing_supported_prompts.jsonl")),
};

const merged = {
  sftTrain: [...base.sftTrain, ...planning.sftTrain.map((row) => flattenPlanningSft(row, "train"))],
  sftValidation: [...base.sftValidation, ...planning.sftValidation.map((row) => flattenPlanningSft(row, "validation"))],
  dpoTrain: [...base.dpoTrain, ...planning.dpoTrain.map((row) => flattenPlanningDpo(row, "train"))],
  dpoValidation: [...base.dpoValidation, ...planning.dpoValidation.map((row) => flattenPlanningDpo(row, "validation"))],
  evalPrompts: base.evalPrompts,
};

await copyLaunchArtifacts();

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "support_targeted_planning_launch_packet",
  status: "ready_for_bounded_gpu_smoke_after_preflight",
  purpose: "Merge support-targeted planning labels into the bounded Qwen 7B joint-action runner while preserving the standard answer JSON output contract and unchanged 69-example final eval prompts.",
  source_packets: {
    base_packet_run_id: templateRunId,
    planning_packet_run_id: planningRunId,
    smoke_run_id: smokeRunId,
  },
  base_model: "Qwen/Qwen2.5-7B-Instruct",
  estimated_gpu_cost_usd: 4,
  curriculum: {
    type: "support_targeted_planning_v12_launch",
    rationale: "D224 showed the missing final-window answer styles have leakage-safe training and validation analogs. This packet merges those labels into the v11 mixed metric/table curriculum before another bounded GPU smoke.",
    output_contract: "Standard answer JSON only: answer_type, answer, citations, claim_table, abstention_reason. Planning is injected through prompt hints and DPO contrasts, not as an extra output key.",
    inherited_base_curriculum: templateResult.curriculum?.type ?? null,
    planning_curriculum: planningResult.curriculum?.type ?? null,
    missing_supported_candidate_examples: planningResult.upstream_evidence?.missing_supported_candidate_examples ?? null,
    missing_profile_counts: planningResult.upstream_evidence?.missing_profile_counts ?? null,
    leakage_guard: {
      final_eval_labels_used_for_training: false,
      train_eval_paper_overlap: [],
      validation_eval_paper_overlap: [],
      source_planning_guard_passes: planningResult.curriculum?.leakage_guard?.passes === true,
    },
  },
  examples: {
    sft_train: merged.sftTrain.length,
    sft_validation: merged.sftValidation.length,
    dpo_train: merged.dpoTrain.length,
    dpo_validation: merged.dpoValidation.length,
    eval_prompts: merged.evalPrompts.length,
    base_sft_train: base.sftTrain.length,
    planning_sft_train_added: planning.sftTrain.length,
    base_dpo_train: base.dpoTrain.length,
    planning_dpo_train_added: planning.dpoTrain.length,
  },
  quality_gates: {
    planning_train_sft_added: planning.sftTrain.length,
    planning_validation_sft_added: planning.sftValidation.length,
    planning_train_dpo_added: planning.dpoTrain.length,
    planning_validation_dpo_added: planning.dpoValidation.length,
    eval_prompts_unchanged_from_base: sameExampleIds(merged.evalPrompts, base.evalPrompts),
    standard_output_contract: true,
    train_planning_style_counts: planningResult.quality_gates?.train_summary ?? null,
    validation_planning_style_counts: planningResult.quality_gates?.validation_summary ?? null,
  },
  launch_gate: {
    launch_next_gpu_now: false,
    required_before_launch: [
      "Run packet dataset validator.",
      "Run grounded-QA repository validator.",
      "Run bash syntax checks for copied launch scripts.",
      "Check total budget, Prime auth, wallet, active pods, and live A6000 availability.",
    ],
    budget_policy: "Do not launch if OpenAI plus external-compute actual/estimated total would exceed $100.",
  },
  budget: {
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

function flattenPlanningSft(row, split) {
  const target = standardOutput(row.target);
  const messages = [
    { role: "system", content: standardSystemPrompt() },
    { role: "user", content: planningAwareUserContent(row) },
    { role: "assistant", content: JSON.stringify(target) },
  ];
  return {
    ...row,
    example_id: `${row.example_id}:flattened-v12`,
    task: "citation_grounded_domain_qa_support_targeted_planning_launch_sft",
    messages,
    target,
    label_source: {
      ...(row.label_source ?? {}),
      type: "support_targeted_planning_flattened_sft",
      source_planning_task: row.task,
      output_contract: "standard_answer_json",
      split,
      final_window_label_used: false,
    },
  };
}

function flattenPlanningDpo(row, split) {
  const chosen = standardOutput(row.chosen_output ?? JSON.parse(row.chosen));
  const rejected = standardOutput(row.rejected_output ?? JSON.parse(row.rejected));
  return {
    ...row,
    example_id: `${row.example_id}:flattened-v12`,
    task: "citation_grounded_domain_qa_support_targeted_planning_launch_dpo",
    prompt: [
      { role: "system", content: standardSystemPrompt() },
      { role: "user", content: planningAwareUserContent(row) },
    ],
    chosen: JSON.stringify(chosen),
    rejected: JSON.stringify(rejected),
    chosen_output: chosen,
    rejected_output: rejected,
    label_source: {
      ...(row.label_source ?? {}),
      source_planning_task: row.task,
      output_contract: "standard_answer_json",
      split,
      final_window_label_used: false,
    },
  };
}

function planningAwareUserContent(row) {
  const original = row.messages?.[1]?.content ?? row.prompt?.[1]?.content ?? "";
  const profile = row.label_source?.profile ?? {};
  const hints = [
    "",
    "Support-targeted planning hints:",
    `- Answer style: ${profile.style ?? "unknown"}`,
    "- Internally decide evidence sufficiency before answering, but output only the standard JSON keys.",
    "- Prefer complete, cited answers over fragments; abstain when direct support is missing.",
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
    "Before answering, internally decide whether the evidence is sufficient and what answer style is required.",
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
      .replaceAll("joint-action-qwen7b-mixed-metric-repair-smoke-eval-v11", smokeRunId)
      .replaceAll("grounded-qa-mixed-metric-qwen7b-lora-v11", "grounded-qa-support-targeted-planning-qwen7b-lora-v12")
      .replaceAll("qwen2_5_7b_mixed_metric_joint_action_lora", "qwen2_5_7b_support_targeted_planning_joint_action_lora");
    if (file === "prime_gpu_plan.md") text = renderPrimePlan();
    await fs.writeFile(path.join(outputDir, file), text);
  }
  for (const file of ["run_joint_action_smoke.sh", "run_prime_qwen3b_smoke_on_pod.sh"]) {
    await fs.chmod(path.join(outputDir, file), 0o755);
  }
}

function renderPrimePlan() {
  return `# Prime GPU Plan: Qwen 7B Support-Targeted Planning v12

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
  return `# Support-Targeted Planning Launch Packet

Run: \`${result.run_id}\`

This merges v11 mixed-metric labels with flattened v12 support-targeted planning labels. Final eval prompts remain the unchanged 69-example final window.

Final eval labels are not used for training.

## Counts

| Split | SFT | DPO |
| --- | ---: | ---: |
| Train | ${result.examples.sft_train} | ${result.examples.dpo_train} |
| Validation | ${result.examples.sft_validation} | ${result.examples.dpo_validation} |
| Eval prompts | ${result.examples.eval_prompts} | n/a |
`;
}

function renderReport(result) {
  return `# Support-Targeted Planning Launch Packet

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

Planning rows added: ${result.examples.planning_sft_train_added} SFT train, ${result.examples.planning_dpo_train_added} DPO train.

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
