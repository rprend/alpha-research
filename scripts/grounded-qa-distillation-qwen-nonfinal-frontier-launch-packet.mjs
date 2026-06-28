import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "joint-action-gpu-prep-qwen7b-nonfinal-frontier-candidates-v1";
const sourcePacketRunId = args["source-packet-run-id"] ?? "joint-action-gpu-prep-qwen7b-v13-support-delta-curriculum-v14";
const runnerTemplateRunId = args["runner-template-run-id"] ?? sourcePacketRunId;
const smokeRunId = args["smoke-run-id"] ?? "joint-action-qwen7b-nonfinal-frontier-candidates-v1";
const sourceSplit = args.split ?? "extended_temporal_future_holdout";
const trainStart = Number(args["train-start"] ?? 0);
const trainEnd = Number(args["train-end"] ?? 160);
const evalStart = Number(args["eval-start"] ?? 240);
const evalEnd = Number(args["eval-end"] ?? 320);
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const sourcePacketDir = path.join(runsDir, sourcePacketRunId);
const runnerTemplateDir = path.join(runsDir, runnerTemplateRunId);

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const sourceResult = await readJson(path.join(sourcePacketDir, "result.json"));
const references = await readJsonl(path.join(dataDir, `${sourceSplit}.jsonl`));
const trainSourceRows = references.slice(trainStart, trainEnd);
const evalSourceRows = references.slice(evalStart, evalEnd);
const trainPaperIds = new Set(trainSourceRows.map((row) => row.input.document_metadata.paper_id));
const evalPaperIds = new Set(evalSourceRows.map((row) => row.input.document_metadata.paper_id));
const trainEvalPaperOverlap = intersection(trainPaperIds, evalPaperIds);
if (trainEvalPaperOverlap.length) throw new Error(`Train/eval paper overlap: ${trainEvalPaperOverlap.join(", ")}`);

const sourceDataset = {
  sftTrain: filterRowsByPapers(await readJsonl(path.join(sourcePacketDir, "dataset", "sft_train.jsonl")), trainPaperIds),
  sftValidation: filterRowsByPapers(await readJsonl(path.join(sourcePacketDir, "dataset", "sft_validation.jsonl")), trainPaperIds),
  dpoTrain: filterRowsByPapers(await readJsonl(path.join(sourcePacketDir, "dataset", "dpo_train.jsonl")), trainPaperIds),
  dpoValidation: filterRowsByPapers(await readJsonl(path.join(sourcePacketDir, "dataset", "dpo_validation.jsonl")), trainPaperIds),
};
const evalPrompts = evalSourceRows.map(evalPromptRow);

await copyLaunchArtifacts();

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const estimatedGpuCostUsd = 4;
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen_nonfinal_frontier_launch_packet",
  status: "ready_for_bounded_gpu_candidate_generation_after_preflight",
  purpose: "Generate leakage-safe non-final Qwen-style candidates for support-ranker/verifier supervision by training on early-window papers and evaluating on a held-out non-final window.",
  source_packet_run_id: sourcePacketRunId,
  base_model: sourceResult.base_model ?? "Qwen/Qwen2.5-7B-Instruct",
  source_split: sourceSplit,
  windows: {
    train_source_range: [trainStart, trainEnd],
    eval_source_range: [evalStart, evalEnd],
    train_papers: trainPaperIds.size,
    eval_papers: evalPaperIds.size,
  },
  examples: {
    sft_train: sourceDataset.sftTrain.length,
    sft_validation: sourceDataset.sftValidation.length,
    dpo_train: sourceDataset.dpoTrain.length,
    dpo_validation: sourceDataset.dpoValidation.length,
    eval_prompts: evalPrompts.length,
  },
  leakage_guard: {
    train_eval_paper_overlap: trainEvalPaperOverlap,
    final_window_labels_used: false,
    eval_window_is_final_window: false,
    final_window_ids_in_eval: evalPrompts.filter((row) => Number(row.metadata?.source_index) >= 320).map((row) => row.example_id),
    training_rows_filtered_to_train_source_papers: true,
  },
  launch_gate: {
    launch_next_gpu_now: false,
    estimated_gpu_cost_usd: estimatedGpuCostUsd,
    projected_total_after_smoke_usd: budget.spend_usd.total_actual + estimatedGpuCostUsd,
    required_before_launch: [
      "Run the generated packet dataset validator.",
      "Run grounded-QA repository validator.",
      "Run bash syntax checks for copied launch scripts.",
      "Check total budget, Prime auth, wallet, active pods, and live GPU availability.",
      "Run bounded smoke with MAX_SFT_STEPS=20, MAX_DPO_STEPS=10, PUSH_TO_HUB=false, and REPORT_TO=none.",
      "After predictions exist, citation-repair and judge the non-final Qwen candidates before merging into support-ranker supervision.",
    ],
    budget_policy: "Do not launch if actual plus projected OpenAI and external compute spend would exceed $100.",
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

await writeJsonl(path.join(datasetDir, "sft_train.jsonl"), sourceDataset.sftTrain);
await writeJsonl(path.join(datasetDir, "sft_validation.jsonl"), sourceDataset.sftValidation);
await writeJsonl(path.join(datasetDir, "dpo_train.jsonl"), sourceDataset.dpoTrain);
await writeJsonl(path.join(datasetDir, "dpo_validation.jsonl"), sourceDataset.dpoValidation);
await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), evalPrompts);
await fs.writeFile(path.join(datasetDir, "README.md"), renderDatasetReadme(result));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  windows: result.windows,
  examples: result.examples,
  leakage_guard: result.leakage_guard,
  launch_gate: result.launch_gate,
}, null, 2));

function filterRowsByPapers(rows, allowedPapers) {
  return rows.filter((row) => {
    const paperId = row.input?.document_metadata?.paper_id
      ?? row.metadata?.document_metadata?.paper_id
      ?? row.label_source?.paper_id;
    return paperId && allowedPapers.has(paperId);
  });
}

function evalPromptRow(row, index) {
  return {
    example_id: row.example_id,
    task: "citation_grounded_domain_qa_nonfinal_frontier_candidate_eval",
    eval_target: {
      diagnostic_nonfinal_frontier_candidate_generation: true,
      final_window_training_use: "not_final_window",
    },
    messages: [
      { role: "system", content: standardSystemPrompt() },
      { role: "user", content: userContent(row) },
    ],
    input: row.input,
    reference: normalizeReference(row.output),
    metadata: {
      source_split: sourceSplit,
      source_index: evalStart + index,
      candidate_generation_use: "allowed_for_nonfinal_verifier_supervision_after_judging",
      final_window: false,
    },
  };
}

function userContent(row) {
  const meta = row.input.document_metadata;
  const evidence = row.input.compact_retrieved_evidence_pack
    .map((item) => `[${item.evidence_id}] ${item.section}: ${item.text}`)
    .join("\n");
  return [
    `Question: ${row.input.question}`,
    `Paper title: ${meta.title}`,
    `Paper id: ${meta.paper_id}`,
    `Date: ${meta.inferred_publication_date}`,
    "Evidence pack:",
    evidence,
  ].join("\n");
}

function normalizeReference(output) {
  return {
    answer_type: output.answer_type === "abstain" ? "abstain" : "grounded_answer",
    answer: String(output.answer ?? ""),
    citations: (output.citations ?? []).map((citation) => typeof citation === "string" ? citation : citation.evidence_id).filter(Boolean),
    claim_table: Array.isArray(output.claim_table) ? output.claim_table : [],
    abstention_reason: output.answer_type === "abstain" ? String(output.abstention_reason ?? "") : null,
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
      .replaceAll(sourcePacketRunId, runId)
      .replaceAll("joint-action-qwen7b-v13-support-delta-smoke-eval-v14", smokeRunId)
      .replaceAll("grounded-qa-v13-support-delta-qwen7b-lora-v14", "grounded-qa-nonfinal-frontier-qwen7b-lora-v1")
      .replaceAll("qwen2_5_7b_v13_support_delta_joint_action_lora", "qwen2_5_7b_nonfinal_frontier_joint_action_lora");
    if (file === "prime_gpu_plan.md") text = renderPrimePlan();
    await fs.writeFile(path.join(outputDir, file), text);
  }
  for (const file of ["run_joint_action_smoke.sh", "run_prime_qwen3b_smoke_on_pod.sh"]) {
    await fs.chmod(path.join(outputDir, file), 0o755);
  }
}

function renderPrimePlan() {
  return `# Prime GPU Plan: Qwen 7B Non-Final Frontier Candidate Generation

Packet: \`${runId}\`

Smoke run id: \`${smokeRunId}\`

This packet is for generating leakage-safe non-final Qwen candidates, not for final-window model evidence.

\`\`\`bash
uv run docs/experiments/grounded-qa-distillation/runs/${runId}/validate_joint_action_dataset_uv.py
BASE_MODEL=Qwen/Qwen2.5-7B-Instruct RUN_ID=${smokeRunId} MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/${runId}/run_joint_action_smoke.sh
\`\`\`

Budget guard: do not launch if estimated total OpenAI plus external compute spend would exceed $100. Fetch artifacts, terminate the pod, and ledger actual compute spend immediately.
`;
}

function renderDatasetReadme(result) {
  return `# Qwen Non-Final Frontier Candidate Packet

Run: \`${result.run_id}\`

This packet trains only on source rows ${result.windows.train_source_range.join("-")} and evaluates on non-final source rows ${result.windows.eval_source_range.join("-")}. It is intended to produce Qwen-style candidate answers that can be judged and used for verifier/ranker supervision without final-window leakage.

After predictions exist, citation-repair and judge the non-final Qwen candidates before merging them into support-ranker or verifier supervision.

## Counts

| Split | SFT | DPO |
| --- | ---: | ---: |
| Train | ${result.examples.sft_train} | ${result.examples.dpo_train} |
| Validation | ${result.examples.sft_validation} | ${result.examples.dpo_validation} |
| Eval prompts | ${result.examples.eval_prompts} | n/a |
`;
}

function renderReport(result) {
  return `# Qwen Non-Final Frontier Launch Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

This packet materialization made no OpenAI calls and launched no GPU jobs.

## Purpose

Generate non-final Qwen-style candidates for verifier/ranker supervision. The packet trains on early source papers and evaluates on a held-out non-final window with no paper overlap.

## Counts

| Dataset | Rows |
| --- | ---: |
| SFT train | ${result.examples.sft_train} |
| SFT validation | ${result.examples.sft_validation} |
| DPO train | ${result.examples.dpo_train} |
| DPO validation | ${result.examples.dpo_validation} |
| Eval prompts | ${result.examples.eval_prompts} |

## Launch Gate

GPU launch is not automatic.
${result.launch_gate.required_before_launch.map((step) => `- ${step}`).join("\n")}
`;
}

function intersection(left, right) {
  return [...left].filter((value) => right.has(value));
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
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
