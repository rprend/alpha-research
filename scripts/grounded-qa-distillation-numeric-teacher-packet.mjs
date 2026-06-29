import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet-run-id"] ?? "frontier-repaired-launch-packet-2026-06-29-v1";
const scriptPacketRunId = args["script-packet-run-id"] ?? "targeted-grounded-construction-packet-frontier-repaired-dpo-prompt-repaired-v1";
const teacherRunId = args["teacher-run-id"] ?? "hard-grounded-teacher-candidate-run-gpt4o-nonfinal-train-numeric-2026-06-29-v1";
const runId = args["run-id"] ?? "numeric-teacher-candidate-packet-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const sourcePacketDir = path.join(runsDir, sourcePacketRunId);
const scriptPacketDir = path.join(runsDir, scriptPacketRunId);
const sourceDatasetDir = path.join(sourcePacketDir, "dataset");
const teacherRun = await readJson(path.join(runsDir, teacherRunId, "result.json"));
const teacherRows = await readJsonl(path.join(runsDir, teacherRunId, "teacher_candidates.jsonl"));
const sourceRows = {
  sft_train: await readJsonl(path.join(sourceDatasetDir, "sft_train.jsonl")),
  sft_validation: await readJsonl(path.join(sourceDatasetDir, "sft_validation.jsonl")),
  dpo_train: await readJsonl(path.join(sourceDatasetDir, "dpo_train.jsonl")),
  dpo_validation: await readJsonl(path.join(sourceDatasetDir, "dpo_validation.jsonl")),
  eval_prompts: await readJsonl(path.join(sourceDatasetDir, "eval_prompts.jsonl")),
  eval_targets_diagnostic: await readJsonl(path.join(sourceDatasetDir, "eval_targets_diagnostic.jsonl")),
};
const sourceById = new Map([...sourceRows.sft_train, ...sourceRows.sft_validation].map((row) => [row.example_id, row]));
const accepted = teacherRows
  .filter((row) => !row.skipped && row.score?.contract_correct === true && row.gap_metadata?.answer_form === "numeric_or_metric")
  .sort((left, right) => String(left.example_id).localeCompare(String(right.example_id)));
if (accepted.length < 10) throw new Error(`Refusing packet: only ${accepted.length} accepted numeric teacher candidates.`);

const splitIndex = Math.max(1, Math.floor(accepted.length * 0.8));
const acceptedTrain = accepted.slice(0, splitIndex);
const acceptedValidation = accepted.slice(splitIndex);
const addedSftTrain = acceptedTrain.map((row) => teacherSftRow(row));
const addedSftValidation = acceptedValidation.map((row) => teacherSftRow(row));
const addedDpoTrain = acceptedTrain.map((row) => teacherDpoRow(row));
const addedDpoValidation = acceptedValidation.map((row) => teacherDpoRow(row));
const outputRows = {
  sft_train: [...sourceRows.sft_train, ...addedSftTrain],
  sft_validation: [...sourceRows.sft_validation, ...addedSftValidation],
  dpo_train: [...sourceRows.dpo_train, ...addedDpoTrain],
  dpo_validation: [...sourceRows.dpo_validation, ...addedDpoValidation],
  eval_prompts: sourceRows.eval_prompts,
  eval_targets_diagnostic: sourceRows.eval_targets_diagnostic,
};

for (const [name, rows] of Object.entries(outputRows)) {
  await writeJsonl(path.join(datasetDir, `${name}.jsonl`), rows);
}
for (const file of ["train_joint_action_lora_uv.py", "validate_joint_action_dataset_uv.py"]) {
  await fs.copyFile(path.join(scriptPacketDir, file), path.join(outputDir, file));
}

const validation = validateDataset(outputRows);
const lengthProfile = profileRows(outputRows);
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "numeric_teacher_candidate_packet",
  status: validation.summary.errors === 0 ? "numeric_teacher_candidate_packet_ready_for_preflight" : "numeric_teacher_candidate_packet_invalid",
  purpose: "Convert accepted non-final/train GPT-4o numeric teacher candidates into a leakage-safe SFT/DPO packet before any GPU smoke.",
  source_runs: {
    source_packet: sourcePacketRunId,
    script_packet: scriptPacketRunId,
    teacher_candidate_run: teacherRunId,
  },
  base_model: "Qwen/Qwen2.5-3B-Instruct",
  estimated_gpu_cost_usd: 4,
  leakage_policy: {
    final_or_validation_teacher_candidates_used_for_training: false,
    nonfinal_train_teacher_candidates_used_for_training: true,
    eval_prompts_preserved: true,
    eval_targets_preserved: true,
  },
  teacher_summary: {
    source_calls: teacherRun.calls_made,
    source_openai_cost_usd: teacherRun.run_cost_usd,
    accepted_numeric_candidates: accepted.length,
    added_sft_train: addedSftTrain.length,
    added_sft_validation: addedSftValidation.length,
    added_dpo_train: addedDpoTrain.length,
    added_dpo_validation: addedDpoValidation.length,
  },
  examples: Object.fromEntries(Object.entries(outputRows).map(([name, rows]) => [name, rows.length])),
  validation,
  length_profile: lengthProfile,
  decision: {
    run_launch_preflight_next: validation.summary.errors === 0,
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    next_step: "Run launch preflight on the numeric teacher packet; only consider bounded Prime smoke if validation and length gates pass.",
    reason: `${accepted.length} non-final/train numeric teacher candidates passed deterministic contract scoring.`,
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
    note: "Packet construction reuses already-ledgered teacher candidates and makes no new API or GPU calls.",
  },
  artifacts: {
    dataset_dir: rel(datasetDir),
    accepted_teacher_candidates_jsonl: rel(path.join(outputDir, "accepted_teacher_candidates.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "accepted_teacher_candidates.jsonl"), accepted);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  teacher_summary: result.teacher_summary,
  examples: result.examples,
  validation: result.validation.summary,
  decision: result.decision,
}, null, 2));

function teacherSftRow(candidate) {
  const source = sourceById.get(candidate.example_id);
  if (!source) throw new Error(`Missing source SFT row for ${candidate.example_id}`);
  const messages = source.messages.filter((message) => message.role !== "assistant");
  const prediction = canonicalPrediction(candidate.prediction);
  return {
    ...source,
    example_id: `${source.example_id}:gpt4o-numeric-teacher`,
    task: "citation_grounded_domain_qa_numeric_teacher_sft",
    messages: [...messages, { role: "assistant", content: JSON.stringify(prediction) }],
    target: prediction,
    label_source: {
      type: "gpt4o_numeric_teacher_candidate",
      teacher_run_id: teacherRunId,
      source_example_id: source.example_id,
      source_split: "train",
      deterministic_contract_correct: true,
      leakage_use: "nonfinal_train_teacher_candidate",
    },
  };
}

function teacherDpoRow(candidate) {
  const source = sourceById.get(candidate.example_id);
  if (!source) throw new Error(`Missing source SFT row for ${candidate.example_id}`);
  const prompt = source.messages.filter((message) => message.role !== "assistant");
  const prediction = canonicalPrediction(candidate.prediction);
  return {
    example_id: `${source.example_id}:gpt4o-numeric-teacher-dpo`,
    task: "citation_grounded_domain_qa_numeric_teacher_dpo",
    prompt,
    chosen: JSON.stringify(prediction),
    rejected: JSON.stringify(abstainRejection(source)),
    source_split: "train",
    preference_source: {
      type: "gpt4o_numeric_teacher_over_false_abstention",
      teacher_run_id: teacherRunId,
      source_example_id: source.example_id,
      chosen_answer_type: "grounded_answer",
      rejected_answer_type: "abstain",
      deterministic_contract_correct: true,
    },
  };
}

function canonicalPrediction(prediction) {
  if (prediction.answer_type !== "grounded_answer") return prediction;
  const citations = normalizeCitations(prediction.citations);
  let answer = String(prediction.answer ?? "").trim();
  for (const citation of citations) {
    if (!answer.includes(`[${citation}]`)) answer = `${answer} [${citation}]`;
  }
  return {
    ...prediction,
    answer,
    citations,
    claim_table: Array.isArray(prediction.claim_table) ? prediction.claim_table : [],
  };
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : [])
    .map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation).replace(/^\[|\]$/g, ""))
    .filter(Boolean);
}

function abstainRejection(source) {
  const question = source.input?.question ?? "";
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: "Rejected contrast: the evidence pack contains enough numeric support for the target answer.",
      question_target: question,
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "Rejected contrast: false insufficiency for a numeric grounded-answer target.",
  };
}

function validateDataset(rows) {
  const errors = [];
  for (const split of ["sft_train", "sft_validation"]) {
    for (const row of rows[split]) {
      if (!row.example_id || !Array.isArray(row.messages) || row.messages.at(-1)?.role !== "assistant") errors.push(`${split}:${row.example_id}: malformed SFT row`);
    }
  }
  for (const split of ["dpo_train", "dpo_validation"]) {
    for (const row of rows[split]) {
      if (!row.example_id || !Array.isArray(row.prompt) || !row.chosen || !row.rejected) errors.push(`${split}:${row.example_id}: malformed DPO row`);
    }
  }
  return {
    summary: {
      files: Object.fromEntries(Object.entries(rows).map(([name, value]) => [name, value.length])),
      errors: errors.length,
    },
    errors,
  };
}

function profileRows(rows) {
  const maxLength = 2048;
  const maxPromptLength = 1536;
  const sftTexts = [...rows.sft_train, ...rows.sft_validation].map((row) => row.messages.map((message) => message.content).join("\n"));
  const dpoPrompts = [...rows.dpo_train, ...rows.dpo_validation].map((row) => row.prompt.map((message) => message.content).join("\n"));
  const dpoFull = [...rows.dpo_train, ...rows.dpo_validation].flatMap((row) => [
    `${row.prompt.map((message) => message.content).join("\n")}\n${row.chosen}`,
    `${row.prompt.map((message) => message.content).join("\n")}\n${row.rejected}`,
  ]);
  const evalTexts = rows.eval_prompts.map((row) => row.messages.map((message) => message.content).join("\n"));
  return {
    approximate_token_method: "ceil(characters / 4)",
    configured_max_length: maxLength,
    configured_max_prompt_length: maxPromptLength,
    sft_full: lengthStats(sftTexts, maxLength),
    dpo_prompt: lengthStats(dpoPrompts, maxPromptLength),
    dpo_full: lengthStats(dpoFull, maxLength),
    eval_prompt: lengthStats(evalTexts, maxPromptLength),
    total_rows_over_limit: [
      ...lengthStats(sftTexts, maxLength).over_limit_indices,
      ...lengthStats(dpoPrompts, maxPromptLength).over_limit_indices,
      ...lengthStats(dpoFull, maxLength).over_limit_indices,
      ...lengthStats(evalTexts, maxPromptLength).over_limit_indices,
    ].length,
  };
}

function lengthStats(texts, limit) {
  const counts = texts.map((text) => Math.ceil(String(text).length / 4));
  const sorted = [...counts].sort((a, b) => a - b);
  return {
    rows: counts.length,
    p50_approx_tokens: percentile(sorted, 0.5),
    p95_approx_tokens: percentile(sorted, 0.95),
    max_approx_tokens: sorted.at(-1) ?? 0,
    rows_over_limit: counts.filter((count) => count > limit).length,
    over_limit_indices: counts.map((count, index) => count > limit ? index : -1).filter((index) => index >= 0),
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

function renderReport(result) {
  return `# Numeric Teacher Candidate Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

This packet makes no new OpenAI calls and launches no compute. It converts already-ledgered non-final/train \`gpt-4o\` numeric teacher candidates into trainable SFT/DPO rows.

| Accepted numeric candidates | Added SFT train | Added SFT validation | Added DPO train | Added DPO validation | Validation errors |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.teacher_summary.accepted_numeric_candidates} | ${result.teacher_summary.added_sft_train} | ${result.teacher_summary.added_sft_validation} | ${result.teacher_summary.added_dpo_train} | ${result.teacher_summary.added_dpo_validation} | ${result.validation.summary.errors} |

## Dataset Counts

- SFT train: ${result.examples.sft_train}
- SFT validation: ${result.examples.sft_validation}
- DPO train: ${result.examples.dpo_train}
- DPO validation: ${result.examples.dpo_validation}
- Eval prompts: ${result.examples.eval_prompts}

## Decision

- Run launch preflight next: ${result.decision.run_launch_preflight_next ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function rel(file) {
  return path.relative(rootDir, file);
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
