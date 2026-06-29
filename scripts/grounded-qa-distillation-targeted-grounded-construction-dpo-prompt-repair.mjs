import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");

const sourcePacketRunId = "targeted-grounded-construction-packet-frontier-repaired-length-reduced-v1";
const runId = "targeted-grounded-construction-packet-frontier-repaired-dpo-prompt-repaired-v1";
const sourceDir = path.join(runsDir, sourcePacketRunId);
const sourceDatasetDir = path.join(sourceDir, "dataset");
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceResult = await readJson(path.join(sourceDir, "result.json"));
const rows = {
  sft_train: await readJsonl(path.join(sourceDatasetDir, "sft_train.jsonl")),
  sft_validation: await readJsonl(path.join(sourceDatasetDir, "sft_validation.jsonl")),
  dpo_train: await readJsonl(path.join(sourceDatasetDir, "dpo_train.jsonl")),
  dpo_validation: await readJsonl(path.join(sourceDatasetDir, "dpo_validation.jsonl")),
  eval_prompts: await readJsonl(path.join(sourceDatasetDir, "eval_prompts.jsonl")),
  eval_targets_diagnostic: await readJsonl(path.join(sourceDatasetDir, "eval_targets_diagnostic.jsonl")),
};

const sftById = new Map([...rows.sft_train, ...rows.sft_validation].map((row) => [row.example_id, row]));
const repairedDpoTrain = repairDpoRows(rows.dpo_train, sftById);
const repairedDpoValidation = repairDpoRows(rows.dpo_validation, sftById);
const packetRows = {
  sft_train: rows.sft_train,
  sft_validation: rows.sft_validation,
  dpo_train: repairedDpoTrain.rows,
  dpo_validation: repairedDpoValidation.rows,
  eval_prompts: rows.eval_prompts,
  eval_targets_diagnostic: rows.eval_targets_diagnostic,
};

const validation = validatePacket(packetRows);
const lengthProfile = profileRows(packetRows, { maxLength: 2048, maxPromptLength: 1536 });
const repairSummary = {
  dpo_train_prompts_repaired: repairedDpoTrain.repaired,
  dpo_validation_prompts_repaired: repairedDpoValidation.repaired,
  dpo_train_unmatched: repairedDpoTrain.unmatched,
  dpo_validation_unmatched: repairedDpoValidation.unmatched,
  dpo_train_blank_prompts_after: countBlankDpoPrompts(packetRows.dpo_train),
  dpo_validation_blank_prompts_after: countBlankDpoPrompts(packetRows.dpo_validation),
};

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "targeted_grounded_construction_dpo_prompt_repair_packet",
  status: validation.errors.length || lengthProfile.total_rows_over_limit || repairSummary.dpo_train_blank_prompts_after || repairSummary.dpo_validation_blank_prompts_after
    ? "targeted_grounded_construction_dpo_prompt_repair_has_residual_risk"
    : "targeted_grounded_construction_dpo_prompt_repaired_packet_ready_for_preflight",
  purpose: "Repair the D395 failure path where length-reduced synthetic DPO rows had blank question/evidence prompts because they lacked structured input.",
  source_runs: {
    source_packet: sourcePacketRunId,
    negative_smoke: "targeted-grounded-construction-qwen3b-smoke-v1",
    contract_gate: "targeted-grounded-construction-qwen3b-smoke-v1-evidence-first-contract-gate",
  },
  base_model: sourceResult.base_model,
  estimated_gpu_cost_usd: sourceResult.estimated_gpu_cost_usd,
  repair_policy: {
    labels_changed: false,
    final_diagnostic_targets_used_for_training: false,
    synthetic_dpo_rows_without_input_backfilled_from_matching_sft_row: true,
    sft_rows_preserved_byte_identical: JSON.stringify(rows.sft_train.concat(rows.sft_validation)) === JSON.stringify(packetRows.sft_train.concat(packetRows.sft_validation)),
    eval_prompts_preserved: JSON.stringify(rows.eval_prompts) === JSON.stringify(packetRows.eval_prompts),
    eval_targets_preserved: JSON.stringify(rows.eval_targets_diagnostic) === JSON.stringify(packetRows.eval_targets_diagnostic),
  },
  repair_summary: repairSummary,
  examples: summarizeRows(packetRows),
  validation,
  length_profile: lengthProfile,
  decision: {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    run_launch_preflight_next: validation.errors.length === 0 && lengthProfile.total_rows_over_limit === 0,
    next_step: "Run launch preflight on the prompt-repaired packet; only consider another bounded Prime smoke if the repaired packet has no blank DPO prompts and no length overflow.",
    reason: "D395 failed the evidence-first contract after training on many blank DPO prompts; this repairs that training-data bug without changing labels.",
  },
  budget: {
    max_budget_usd: Number(budget.max_budget_usd),
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual),
    remaining_budget_usd: Number(budget.spend_usd?.remaining),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "Local deterministic packet repair only.",
  },
  artifacts: {
    dataset_dir: rel(datasetDir),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

for (const [name, splitRows] of Object.entries(packetRows)) {
  await writeJsonl(path.join(datasetDir, `${name}.jsonl`), splitRows);
}
await copyRunnerArtifacts();
await fs.writeFile(path.join(datasetDir, "README.md"), renderDatasetReadme(result));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  repair_summary: result.repair_summary,
  validation: result.validation.summary,
  length_profile: result.length_profile,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function repairDpoRows(dpoRows, sftRowsById) {
  let repaired = 0;
  const unmatched = [];
  const outputRows = dpoRows.map((row) => {
    if (hasStructuredPrompt(row)) return row;
    const sftId = dpoToSftId(row.example_id);
    const sft = sftRowsById.get(sftId);
    if (!sft) {
      unmatched.push(row.example_id);
      return row;
    }
    repaired += 1;
    return {
      ...row,
      input: sft.input,
      prompt: sft.messages.slice(0, 2),
      curriculum_metadata: {
        ...(row.curriculum_metadata ?? {}),
        dpo_prompt_repaired_from_sft: true,
        dpo_prompt_repair_source_sft_id: sftId,
      },
    };
  });
  return { rows: outputRows, repaired, unmatched };
}

function hasStructuredPrompt(row) {
  const user = row.prompt?.find((message) => message.role === "user")?.content ?? "";
  return Boolean(row.input) && /Question:\s*\S/.test(user) && /Evidence pack:\n\[E\d+\]/.test(user);
}

function dpoToSftId(exampleId) {
  return String(exampleId).replace(/:synthetic-answerability-dpo$/, "");
}

function countBlankDpoPrompts(dpoRows) {
  return dpoRows.filter((row) => {
    const user = row.prompt?.find((message) => message.role === "user")?.content ?? "";
    return !/Question:\s*\S/.test(user) || !/Evidence pack:\n\[E\d+\]/.test(user);
  }).length;
}

async function copyRunnerArtifacts() {
  for (const file of ["validate_joint_action_dataset_uv.py", "train_joint_action_lora_uv.py", "eval_joint_action_adapter_uv.py", "run_joint_action_smoke.sh"]) {
    let text = await fs.readFile(path.join(sourceDir, file), "utf8");
    text = text.replaceAll(sourcePacketRunId, runId);
    await fs.writeFile(path.join(outputDir, file), text);
    if (file.endsWith(".sh")) await fs.chmod(path.join(outputDir, file), 0o755);
  }
}

function validatePacket(rowsByName) {
  const errors = [];
  for (const split of ["sft_train", "sft_validation"]) {
    for (const row of rowsByName[split]) {
      if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${split}:${row.example_id}: expected 3 messages`);
      const parsed = parseJson(row.messages?.at(-1)?.content);
      if (!parsed || parsed.answer_type !== row.target?.answer_type) errors.push(`${split}:${row.example_id}: assistant target mismatch`);
    }
  }
  for (const split of ["dpo_train", "dpo_validation"]) {
    for (const row of rowsByName[split]) {
      if (!Array.isArray(row.prompt) || row.prompt.length !== 2) errors.push(`${split}:${row.example_id}: expected 2-message prompt`);
      if (!hasStructuredPrompt(row)) errors.push(`${split}:${row.example_id}: DPO prompt missing question/evidence.`);
      const chosen = parseJson(row.chosen);
      const rejected = parseJson(row.rejected);
      if (!chosen?.answer_type || !rejected?.answer_type) errors.push(`${split}:${row.example_id}: malformed chosen/rejected`);
      if (JSON.stringify(chosen) === JSON.stringify(rejected)) errors.push(`${split}:${row.example_id}: chosen equals rejected`);
    }
  }
  return {
    summary: {
      files: Object.fromEntries(Object.entries(rowsByName).map(([key, value]) => [key, value.length])),
      errors: errors.length,
    },
    errors: errors.slice(0, 50),
  };
}

function profileRows(rows, { maxLength, maxPromptLength }) {
  const sftTexts = [...rows.sft_train, ...rows.sft_validation].map((row) => row.messages.map((message) => message.content).join("\n"));
  const dpoPrompts = [...rows.dpo_train, ...rows.dpo_validation].map((row) => row.prompt.map((message) => message.content).join("\n"));
  const dpoFull = [...rows.dpo_train, ...rows.dpo_validation].flatMap((row) => [
    `${row.prompt.map((message) => message.content).join("\n")}\n${row.chosen}`,
    `${row.prompt.map((message) => message.content).join("\n")}\n${row.rejected}`,
  ]);
  const evalTexts = rows.eval_prompts.map((row) => row.messages.map((message) => message.content).join("\n"));
  const profile = {
    approximate_token_method: "ceil(characters / 4)",
    configured_max_length: maxLength,
    configured_max_prompt_length: maxPromptLength,
    sft_full: lengthStats(sftTexts, maxLength),
    dpo_prompt: lengthStats(dpoPrompts, maxPromptLength),
    dpo_full: lengthStats(dpoFull, maxLength),
    eval_prompt: lengthStats(evalTexts, maxPromptLength),
  };
  profile.total_rows_over_limit = profile.sft_full.rows_over_limit + profile.dpo_prompt.rows_over_limit + profile.dpo_full.rows_over_limit + profile.eval_prompt.rows_over_limit;
  return profile;
}

function lengthStats(texts, limit) {
  const counts = texts.map((text) => Math.ceil(String(text).length / 4)).sort((a, b) => a - b);
  return {
    rows: counts.length,
    p50_approx_tokens: percentile(counts, 0.5),
    p95_approx_tokens: percentile(counts, 0.95),
    max_approx_tokens: counts.at(-1) ?? 0,
    rows_over_limit: counts.filter((count) => count > limit).length,
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))];
}

function summarizeRows(rowsByName) {
  return Object.fromEntries(Object.entries(rowsByName).map(([key, value]) => [key, value.length]));
}

function renderDatasetReadme(result) {
  return `# Targeted Grounded Construction DPO Prompt Repair

Run: \`${result.run_id}\`

This packet repairs blank synthetic DPO prompts introduced by \`${sourcePacketRunId}\`.

- DPO train prompts repaired: ${result.repair_summary.dpo_train_prompts_repaired}
- DPO validation prompts repaired: ${result.repair_summary.dpo_validation_prompts_repaired}
- Blank DPO prompts after repair: ${result.repair_summary.dpo_train_blank_prompts_after + result.repair_summary.dpo_validation_blank_prompts_after}
- Validation errors: ${result.validation.summary.errors}
- Total rows over 2048/1536 approximate limits: ${result.length_profile.total_rows_over_limit}
- OpenAI calls: 0
- Prime jobs: 0
`;
}

function renderReport(result) {
  return `# Targeted Grounded Construction DPO Prompt Repair

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Repair

| Split | Repaired prompts | Unmatched rows | Blank prompts after |
| --- | ---: | ---: | ---: |
| DPO train | ${result.repair_summary.dpo_train_prompts_repaired} | ${result.repair_summary.dpo_train_unmatched.length} | ${result.repair_summary.dpo_train_blank_prompts_after} |
| DPO validation | ${result.repair_summary.dpo_validation_prompts_repaired} | ${result.repair_summary.dpo_validation_unmatched.length} | ${result.repair_summary.dpo_validation_blank_prompts_after} |

## Length Profile

| Surface | Rows | Max approx tokens | Rows over limit |
| --- | ---: | ---: | ---: |
| SFT full | ${result.length_profile.sft_full.rows} | ${result.length_profile.sft_full.max_approx_tokens} | ${result.length_profile.sft_full.rows_over_limit} |
| DPO prompt | ${result.length_profile.dpo_prompt.rows} | ${result.length_profile.dpo_prompt.max_approx_tokens} | ${result.length_profile.dpo_prompt.rows_over_limit} |
| DPO full | ${result.length_profile.dpo_full.rows} | ${result.length_profile.dpo_full.max_approx_tokens} | ${result.length_profile.dpo_full.rows_over_limit} |
| Eval prompt | ${result.length_profile.eval_prompt.rows} | ${result.length_profile.eval_prompt.max_approx_tokens} | ${result.length_profile.eval_prompt.rows_over_limit} |

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
`;
}

function parseJson(value) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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

async function writeJsonl(filePath, rowsToWrite) {
  await fs.writeFile(filePath, `${rowsToWrite.map((row) => JSON.stringify(row)).join("\n")}\n`);
}
