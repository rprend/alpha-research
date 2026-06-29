import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet-run-id"] ?? "numeric-teacher-candidate-packet-frontier-repaired-v1";
const runnerTemplateRunId = args["runner-template-run-id"] ?? "targeted-grounded-construction-packet-frontier-repaired-dpo-prompt-repaired-v1";
const runId = args["run-id"] ?? "numeric-teacher-candidate-packet-frontier-repaired-length-reduced-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const sourceDir = path.join(runsDir, sourcePacketRunId);
const sourceDatasetDir = path.join(sourceDir, "dataset");
const runnerTemplateDir = path.join(runsDir, runnerTemplateRunId);

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceResult = await readJson(path.join(sourceDir, "result.json"));
const sourceRows = {
  sft_train: await readJsonl(path.join(sourceDatasetDir, "sft_train.jsonl")),
  sft_validation: await readJsonl(path.join(sourceDatasetDir, "sft_validation.jsonl")),
  dpo_train: await readJsonl(path.join(sourceDatasetDir, "dpo_train.jsonl")),
  dpo_validation: await readJsonl(path.join(sourceDatasetDir, "dpo_validation.jsonl")),
  eval_prompts: await readJsonl(path.join(sourceDatasetDir, "eval_prompts.jsonl")),
  eval_targets_diagnostic: await readJsonl(path.join(sourceDatasetDir, "eval_targets_diagnostic.jsonl")),
};
const sftByBaseId = new Map([...sourceRows.sft_train, ...sourceRows.sft_validation].map((row) => [baseExampleId(row.example_id), row]));

const packetRows = {
  sft_train: sourceRows.sft_train.map(reduceSft),
  sft_validation: sourceRows.sft_validation.map(reduceSft),
  dpo_train: sourceRows.dpo_train.map(reduceDpo),
  dpo_validation: sourceRows.dpo_validation.map(reduceDpo),
  eval_prompts: sourceRows.eval_prompts.map(reduceEval),
  eval_targets_diagnostic: sourceRows.eval_targets_diagnostic,
};
const validation = validatePacket(packetRows);
const lengthProfile = profileRows(packetRows, { maxLength: 2048, maxPromptLength: 1536 });
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "numeric_teacher_candidate_length_reduced_packet",
  status: validation.errors.length || lengthProfile.total_rows_over_limit
    ? "numeric_teacher_candidate_length_reduction_has_residual_risk"
    : "numeric_teacher_candidate_length_reduced_packet_ready_for_bounded_smoke",
  purpose: "Remove prompt-length truncation risk from the numeric teacher candidate packet before any Prime launch decision.",
  source_runs: {
    source_packet: sourcePacketRunId,
    runner_template_packet: runnerTemplateRunId,
    teacher_candidate_run: sourceResult.source_runs?.teacher_candidate_run,
  },
  base_model: sourceResult.base_model,
  estimated_gpu_cost_usd: sourceResult.estimated_gpu_cost_usd,
  reduction_policy: {
    rebuild_prompts_from_structured_sft_inputs: true,
    cited_evidence_char_limit: 760,
    uncited_evidence_char_limit: 300,
    max_evidence_items: 6,
    labels_changed: false,
    eval_prompts_preserved_by_id: sameList(sourceRows.eval_prompts.map((row) => row.example_id), packetRows.eval_prompts.map((row) => row.example_id)),
    eval_targets_preserved: JSON.stringify(sourceRows.eval_targets_diagnostic) === JSON.stringify(packetRows.eval_targets_diagnostic),
  },
  teacher_summary: sourceResult.teacher_summary,
  examples: summarizeRows(packetRows),
  validation,
  length_profile: lengthProfile,
  decision: {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    run_launch_preflight_next: validation.errors.length === 0,
    next_step: validation.errors.length === 0
      ? "Run launch preflight on the length-reduced numeric teacher packet; use its prompt profile for the Prime decision."
      : "Fix length-reduced packet validation before preflight.",
    reason: "This step removes avoidable truncation risk without changing labels or spending compute.",
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
    note: "Local deterministic prompt-length reduction only.",
  },
  artifacts: {
    dataset_dir: rel(datasetDir),
    train_script: rel(path.join(outputDir, "train_joint_action_lora_uv.py")),
    validate_script: rel(path.join(outputDir, "validate_joint_action_dataset_uv.py")),
    eval_script: rel(path.join(outputDir, "eval_joint_action_adapter_uv.py")),
    smoke_runner: rel(path.join(outputDir, "run_joint_action_smoke.sh")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

for (const [name, rows] of Object.entries(packetRows)) await writeJsonl(path.join(datasetDir, `${name}.jsonl`), rows);
for (const file of ["validate_joint_action_dataset_uv.py", "train_joint_action_lora_uv.py"]) {
  await fs.copyFile(path.join(sourceDir, file), path.join(outputDir, file));
}
for (const file of ["eval_joint_action_adapter_uv.py", "run_joint_action_smoke.sh"]) {
  let text = await fs.readFile(path.join(runnerTemplateDir, file), "utf8");
  text = text.replaceAll(runnerTemplateRunId, runId);
  await fs.writeFile(path.join(outputDir, file), text);
  if (file.endsWith(".sh")) await fs.chmod(path.join(outputDir, file), 0o755);
}
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  examples: result.examples,
  validation: result.validation.summary,
  length_profile: result.length_profile,
  decision: result.decision,
}, null, 2));

function reduceSft(row) {
  const assistant = row.messages.at(-1);
  return {
    ...row,
    messages: [
      { role: "system", content: reducedSystemPrompt() },
      { role: "user", content: renderUserPrompt(row.input, parseAssistant(assistant?.content) ?? row.target) },
      assistant,
    ],
    curriculum_metadata: { ...(row.curriculum_metadata ?? {}), numeric_teacher_length_reduced_prompt: true },
  };
}

function reduceDpo(row) {
  const source = sftByBaseId.get(baseExampleId(row.example_id));
  if (!source?.input) throw new Error(`Missing matching SFT input for ${row.example_id}`);
  const chosen = safeJson(row.chosen);
  return {
    ...row,
    prompt: [
      { role: "system", content: reducedSystemPrompt() },
      { role: "user", content: renderUserPrompt(source.input, chosen) },
    ],
    curriculum_metadata: { ...(row.curriculum_metadata ?? {}), numeric_teacher_length_reduced_prompt: true },
  };
}

function reduceEval(row) {
  return {
    ...row,
    messages: [
      { role: "system", content: reducedSystemPrompt() },
      { role: "user", content: renderUserPrompt(row.input, null) },
    ],
    curriculum_metadata: { ...(row.curriculum_metadata ?? {}), numeric_teacher_length_reduced_prompt: true },
  };
}

function reducedSystemPrompt() {
  return [
    "Answer only from the compact evidence pack.",
    "Return JSON keys: answer_type, evidence_first, answer, citations, claim_table, abstention_reason.",
    "For numeric questions, copy exact values, units, metric names, baselines, and comparison targets.",
    "Every cited fact needs inline [E#] citations. Abstain when direct support is missing.",
  ].join(" ");
}

function renderUserPrompt(input, target) {
  const metadata = input?.document_metadata ?? {};
  const citations = new Set(normalizeCitations(target?.citations));
  const evidence = (input?.compact_retrieved_evidence_pack ?? []).slice(0, 6).map((item) => {
    const cited = citations.has(String(item.evidence_id));
    return `[${item.evidence_id}] ${item.section ?? "Evidence"}: ${truncate(item.text, cited ? 760 : 300)}`;
  }).join("\n\n");
  return [
    `Question: ${input?.question ?? ""}`,
    "",
    "Document metadata:",
    `- paper_id: ${metadata.paper_id ?? ""}`,
    `- title: ${metadata.title ?? ""}`,
    `- inferred_publication_date: ${metadata.inferred_publication_date ?? ""}`,
    `- knowledge_base_version: ${metadata.knowledge_base_version ?? ""}`,
    "",
    "Evidence pack:",
    evidence,
    "",
    "Construction hint: numeric_or_metric; preserve exact values and units; reject nearby numbers for the wrong target.",
    "Evidence-first contract: decide sufficiency; if sufficient, write cited supported_claims first and answer only from them; otherwise abstain.",
    "Return only JSON.",
  ].join("\n");
}

function validatePacket(rowsByName) {
  const errors = [];
  for (const split of ["sft_train", "sft_validation"]) {
    for (const row of rowsByName[split]) {
      const parsed = parseAssistant(row.messages?.at(-1)?.content);
      if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${split}:${row.example_id}: expected 3 messages`);
      if (!parsed || parsed.answer_type !== row.target?.answer_type) errors.push(`${split}:${row.example_id}: assistant target mismatch`);
    }
  }
  for (const split of ["dpo_train", "dpo_validation"]) {
    for (const row of rowsByName[split]) {
      if (!Array.isArray(row.prompt) || row.prompt.length !== 2) errors.push(`${split}:${row.example_id}: expected 2-message prompt`);
      if (!safeJson(row.chosen)?.answer_type || !safeJson(row.rejected)?.answer_type) errors.push(`${split}:${row.example_id}: malformed chosen/rejected`);
    }
  }
  return {
    summary: {
      files: Object.fromEntries(Object.entries(rowsByName).map(([key, rows]) => [key, rows.length])),
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

function baseExampleId(exampleId) {
  return String(exampleId)
    .replace(/:gpt4o-numeric-teacher(?:-dpo)?$/, "")
    .replace(/:synthetic-answerability-dpo$/, "");
}

function parseAssistant(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function safeJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : [])
    .map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation).replace(/^\[|\]$/g, ""))
    .filter(Boolean);
}

function summarizeRows(rows) {
  return {
    sft_train: rows.sft_train.length,
    sft_validation: rows.sft_validation.length,
    dpo_train: rows.dpo_train.length,
    dpo_validation: rows.dpo_validation.length,
    eval_prompts: rows.eval_prompts.length,
    eval_targets_diagnostic: rows.eval_targets_diagnostic.length,
  };
}

function renderReport(result) {
  return `# Numeric Teacher Candidate Length Reduction

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no compute. It rebuilds prompts from structured SFT inputs and clips evidence to remove avoidable length risk.

| Validation errors | Total rows over limit | SFT max | DPO prompt max | DPO full max | Eval max |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.validation.summary.errors} | ${result.length_profile.total_rows_over_limit} | ${result.length_profile.sft_full.max_approx_tokens} | ${result.length_profile.dpo_prompt.max_approx_tokens} | ${result.length_profile.dpo_full.max_approx_tokens} | ${result.length_profile.eval_prompt.max_approx_tokens} |

## Decision

- Run launch preflight next: ${result.decision.run_launch_preflight_next ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function truncate(text, limit) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length <= limit ? value : `${value.slice(0, limit - 3)}...`;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

function sameList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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
