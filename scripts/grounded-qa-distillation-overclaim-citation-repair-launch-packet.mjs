import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const runId = "overclaim-citation-repair-launch-packet-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const basePacketRunId = "generation-gap-form-specific-construction-packet-d338-2026-06-28-v1";
const minedPacketRunId = "mined-overclaim-citation-packet-2026-06-28-v1";
const textProbeRunId = "mined-overclaim-citation-text-probe-2026-06-28-v1";
const baseDir = path.join(runsDir, basePacketRunId);
const minedDir = path.join(runsDir, minedPacketRunId);

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const baseResult = await readJson(path.join(baseDir, "result.json"));
const minedResult = await readJson(path.join(minedDir, "result.json"));
const textProbe = await readJson(path.join(runsDir, textProbeRunId, "result.json"));
const base = {
  sftTrain: await readJsonl(path.join(baseDir, "dataset", "sft_train.jsonl")),
  sftValidation: await readJsonl(path.join(baseDir, "dataset", "sft_validation.jsonl")),
  dpoTrain: await readJsonl(path.join(baseDir, "dataset", "dpo_train.jsonl")),
  dpoValidation: await readJsonl(path.join(baseDir, "dataset", "dpo_validation.jsonl")),
  evalPrompts: await readJsonl(path.join(baseDir, "dataset", "eval_prompts.jsonl")),
  evalTargetsDiagnostic: await readJsonl(path.join(baseDir, "dataset", "eval_targets_diagnostic.jsonl")),
};
const mined = {
  trainDpo: await readJsonl(path.join(minedDir, "dataset", "train_dpo.jsonl")),
  validationDpo: await readJsonl(path.join(minedDir, "dataset", "validation_dpo.jsonl")),
};

const added = {
  sftTrain: dedupeSft(mined.trainDpo.map((row) => minedSftRow(row, "train"))),
  sftValidation: dedupeSft(mined.validationDpo.map((row) => minedSftRow(row, "validation"))),
  dpoTrain: filterNonIdenticalDpo(mined.trainDpo.map((row) => minedDpoRow(row, "train"))),
  dpoValidation: filterNonIdenticalDpo(mined.validationDpo.map((row) => minedDpoRow(row, "validation"))),
};
const dropped = {
  identicalDpoTrain: mined.trainDpo.length - added.dpoTrain.length,
  identicalDpoValidation: mined.validationDpo.length - added.dpoValidation.length,
};
const merged = {
  sftTrain: [...base.sftTrain, ...added.sftTrain],
  sftValidation: [...base.sftValidation, ...added.sftValidation],
  dpoTrain: [...base.dpoTrain, ...added.dpoTrain],
  dpoValidation: [...base.dpoValidation, ...added.dpoValidation],
  evalPrompts: base.evalPrompts,
  evalTargetsDiagnostic: base.evalTargetsDiagnostic,
};

await copyLaunchArtifacts();

const estimatedGpuCostUsd = 1;
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "overclaim_citation_repair_launch_packet",
  status: "ready_for_local_dataset_validation",
  purpose: "Change the intervention after D354: train the generator/repair model on explicit overclaim and citation-mismatch preferences rather than another selector.",
  source_packets: {
    base_generation_packet: basePacketRunId,
    mined_overclaim_citation_packet: minedPacketRunId,
    mined_text_probe: textProbeRunId,
  },
  base_model: "Qwen/Qwen2.5-3B-Instruct",
  estimated_gpu_cost_usd: estimatedGpuCostUsd,
  curriculum: {
    type: "overclaim_citation_repair",
    rationale: "D353-D354 showed surface and lexical selectors overfit non-final rows. This packet changes the generator training data: prefer minimal supported rewrites or abstentions over already-judged overclaim/citation-mismatch answers.",
    inherited_base_packet_status: baseResult.status,
    mined_packet_status: minedResult.status,
    text_probe_status: textProbe.status,
    mined_failure_mix: minedResult.data?.selected_failure_mode_counts ?? {},
    leakage_guard: {
      final_eval_labels_used_for_training: false,
      eval_prompts_unchanged_from_base: sameExampleIds(base.evalPrompts, merged.evalPrompts),
      mined_rows_nonfinal_only: minedResult.leakage_guard?.only_nonfinal_source_indices === true,
      mined_train_validation_example_disjoint: minedResult.leakage_guard?.train_validation_example_disjoint === true,
      final_reporting_probe_used_for_design_only: true,
    },
  },
  examples: {
    base_sft_train: base.sftTrain.length,
    base_sft_validation: base.sftValidation.length,
    base_dpo_train: base.dpoTrain.length,
    base_dpo_validation: base.dpoValidation.length,
    added_sft_train: added.sftTrain.length,
    added_sft_validation: added.sftValidation.length,
    added_dpo_train: added.dpoTrain.length,
    added_dpo_validation: added.dpoValidation.length,
    dropped_identical_dpo_train: dropped.identicalDpoTrain,
    dropped_identical_dpo_validation: dropped.identicalDpoValidation,
    current_sft_train: merged.sftTrain.length,
    current_sft_validation: merged.sftValidation.length,
    current_dpo_train: merged.dpoTrain.length,
    current_dpo_validation: merged.dpoValidation.length,
    eval_prompts: merged.evalPrompts.length,
    eval_targets_diagnostic: merged.evalTargetsDiagnostic.length,
  },
  quality_gates: {
    added_overclaim_dpo_rows: added.dpoTrain.length + added.dpoValidation.length,
    added_sft_rewrite_rows: added.sftTrain.length + added.sftValidation.length,
    eval_prompts_unchanged_from_base: sameExampleIds(base.evalPrompts, merged.evalPrompts),
    has_citation_mismatch_preferences: hasFailureMode([...added.dpoTrain, ...added.dpoValidation], "citation_mismatch"),
    has_numeric_overclaim_preferences: hasFailureMode([...added.dpoTrain, ...added.dpoValidation], "numeric_or_comparison_overclaim"),
    has_broad_overclaim_preferences: hasFailureMode([...added.dpoTrain, ...added.dpoValidation], "overbroad_or_overclaimed"),
    all_added_outputs_json_serialized: [...added.dpoTrain, ...added.dpoValidation].every((row) => canParse(row.chosen) && canParse(row.rejected)),
    no_identical_added_dpo_preferences: [...added.dpoTrain, ...added.dpoValidation].every((row) => row.chosen !== row.rejected),
  },
  launch_gate: {
    launch_prime_now: false,
    run_local_validation_next: true,
    projected_total_after_smoke_usd: budget.spend_usd.total_actual + estimatedGpuCostUsd,
    budget_cap_usd: budget.max_budget_usd,
    reason: "Packet generation is local. Launch only after dataset validation, launch preflight, and Prime live price/budget checks pass.",
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
  },
  artifacts: {
    sft_train_jsonl: rel(path.join(datasetDir, "sft_train.jsonl")),
    sft_validation_jsonl: rel(path.join(datasetDir, "sft_validation.jsonl")),
    dpo_train_jsonl: rel(path.join(datasetDir, "dpo_train.jsonl")),
    dpo_validation_jsonl: rel(path.join(datasetDir, "dpo_validation.jsonl")),
    eval_prompts_jsonl: rel(path.join(datasetDir, "eval_prompts.jsonl")),
    eval_targets_diagnostic_jsonl: rel(path.join(datasetDir, "eval_targets_diagnostic.jsonl")),
    validate_script: rel(path.join(outputDir, "validate_joint_action_dataset_uv.py")),
    train_script: rel(path.join(outputDir, "train_joint_action_lora_uv.py")),
    eval_script: rel(path.join(outputDir, "eval_joint_action_adapter_uv.py")),
    smoke_runner: rel(path.join(outputDir, "run_joint_action_smoke.sh")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(datasetDir, "sft_train.jsonl"), merged.sftTrain);
await writeJsonl(path.join(datasetDir, "sft_validation.jsonl"), merged.sftValidation);
await writeJsonl(path.join(datasetDir, "dpo_train.jsonl"), merged.dpoTrain);
await writeJsonl(path.join(datasetDir, "dpo_validation.jsonl"), merged.dpoValidation);
await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), merged.evalPrompts);
await writeJsonl(path.join(datasetDir, "eval_targets_diagnostic.jsonl"), merged.evalTargetsDiagnostic);
await fs.writeFile(path.join(datasetDir, "README.md"), renderDatasetReadme(result));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  examples: result.examples,
  quality_gates: result.quality_gates,
  launch_gate: result.launch_gate,
  budget: result.budget,
}, null, 2));

function minedSftRow(row, split) {
  const target = standardOutput(row.chosen);
  return {
    example_id: `${row.example_id}:overclaim-citation-repair:${split}:sft`,
    task: "citation_grounded_domain_qa_overclaim_citation_repair_sft",
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(row) },
      { role: "assistant", content: JSON.stringify(target) },
    ],
    input: rowInput(row),
    target,
    label_source: {
      type: "overclaim_citation_supported_rewrite_sft",
      source_packet_run_id: minedPacketRunId,
      source_row_id: row.row_id,
      failure_mode: row.failure_mode,
      split,
      final_window_label_used: false,
    },
    curriculum_metadata: {
      overclaim_citation_repair: true,
      split,
    },
  };
}

function minedDpoRow(row, split) {
  const chosen = standardOutput(row.chosen);
  const rejected = standardOutput(row.rejected);
  return {
    example_id: `${row.example_id}:overclaim-citation-repair:${split}:dpo:${hash(row.row_id)}`,
    task: "citation_grounded_domain_qa_overclaim_citation_repair_dpo",
    prompt: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(row) },
    ],
    chosen: JSON.stringify(chosen),
    rejected: JSON.stringify(rejected),
    chosen_output: chosen,
    rejected_output: rejected,
    input: rowInput(row),
    label_source: {
      type: "prefer_supported_rewrite_over_overclaim_or_citation_error",
      source_packet_run_id: minedPacketRunId,
      source_row_id: row.row_id,
      failure_mode: row.failure_mode,
      judge_signal: row.judge_signal,
      split,
      final_window_label_used: false,
    },
    curriculum_metadata: {
      overclaim_citation_repair: true,
      split,
      failure_mode: row.failure_mode,
    },
  };
}

function standardOutput(value) {
  const answerType = value?.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = answerType === "abstain" ? [] : Array.isArray(value?.citations) ? value.citations : [];
  return {
    answer_type: answerType,
    answer: String(value?.answer ?? ""),
    citations,
    claim_table: Array.isArray(value?.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value?.abstention_reason ?? "Evidence is insufficient.") : "",
  };
}

function systemPrompt() {
  return [
    "Answer using only the compact evidence pack.",
    "Return valid JSON only with keys answer_type, answer, citations, claim_table, and abstention_reason.",
    "Prefer a minimal supported answer over an expansive answer.",
    "Every factual clause must be directly supported by cited evidence.",
    "Do not infer numbers, comparisons, lists, or task details that are not stated in the cited evidence.",
    "If citations do not support the requested target, abstain instead of guessing.",
  ].join(" ");
}

function userPrompt(row) {
  return [
    `Question: ${row.question}`,
    "",
    "Document metadata:",
    `- source_index: ${row.source_index}`,
    "",
    "Evidence pack:",
    row.evidence_pack.map((item) => `[${item.evidence_id}] ${item.section ?? "Evidence"}: ${item.text}`).join("\n\n"),
    "",
    "Repair objective:",
    `- Avoid failure mode: ${row.failure_mode}`,
    "- Keep only claims directly entailed by cited evidence.",
    "- If the evidence is insufficient for the exact question target, abstain.",
    "",
    "Return only JSON.",
  ].join("\n");
}

function rowInput(row) {
  return {
    question: row.question,
    compact_retrieved_evidence_pack: row.evidence_pack,
    document_metadata: row.document_metadata ?? { source_index: row.source_index },
    instruction: "Answer only from the evidence pack. Cite every factual claim with bracketed evidence ids. Abstain when support is insufficient.",
  };
}

function dedupeSft(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = `${row.input.question}::${row.target.answer_type}::${row.target.answer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function filterNonIdenticalDpo(rows) {
  return rows.filter((row) => row.chosen !== row.rejected);
}

async function copyLaunchArtifacts() {
  const files = [
    "validate_joint_action_dataset_uv.py",
    "train_joint_action_lora_uv.py",
    "eval_joint_action_adapter_uv.py",
    "run_joint_action_smoke.sh",
  ];
  for (const file of files) {
    await fs.copyFile(path.join(baseDir, file), path.join(outputDir, file));
  }
}

function renderDatasetReadme(result) {
  return `# Overclaim/Citation Repair Launch Packet

Generated: ${result.generated_at}

This packet merges D338 with mined overclaim/citation repair rows. It makes no API calls and launches no compute.

- SFT train: ${result.examples.current_sft_train}
- SFT validation: ${result.examples.current_sft_validation}
- DPO train: ${result.examples.current_dpo_train}
- DPO validation: ${result.examples.current_dpo_validation}
- Eval prompts: ${result.examples.eval_prompts}
`;
}

function renderReport(result) {
  return `# Overclaim/Citation Repair Launch Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

This packet changes the intervention from selector selection to generator repair training. It makes no API calls and launches no compute.

## Added Rows

- Added SFT train: ${result.examples.added_sft_train}
- Added SFT validation: ${result.examples.added_sft_validation}
- Added DPO train: ${result.examples.added_dpo_train}
- Added DPO validation: ${result.examples.added_dpo_validation}
- Dropped identical DPO train: ${result.examples.dropped_identical_dpo_train}
- Dropped identical DPO validation: ${result.examples.dropped_identical_dpo_validation}
- Eval prompts unchanged: ${result.quality_gates.eval_prompts_unchanged_from_base ? "yes" : "no"}
- No identical added DPO preferences: ${result.quality_gates.no_identical_added_dpo_preferences ? "yes" : "no"}

## Decision

- Launch Prime now: ${result.launch_gate.launch_prime_now ? "yes" : "no"}
- Run local validation next: ${result.launch_gate.run_local_validation_next ? "yes" : "no"}
- Projected total after smoke: $${result.launch_gate.projected_total_after_smoke_usd.toFixed(4)}
- Reason: ${result.launch_gate.reason}
`;
}

function sameExampleIds(left, right) {
  return JSON.stringify(left.map((row) => row.example_id)) === JSON.stringify(right.map((row) => row.example_id));
}

function hasFailureMode(rows, mode) {
  return rows.some((row) => row.label_source?.failure_mode === mode);
}

function canParse(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function hash(value) {
  let h = 0;
  for (const ch of String(value)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h.toString(16);
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}
