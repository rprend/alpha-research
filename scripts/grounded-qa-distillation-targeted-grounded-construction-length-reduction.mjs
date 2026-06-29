import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");

const sourcePacketRunId = "targeted-grounded-construction-packet-frontier-repaired-v1";
const runId = "targeted-grounded-construction-packet-frontier-repaired-length-reduced-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const sourceDir = path.join(runsDir, sourcePacketRunId);
const sourceDatasetDir = path.join(sourceDir, "dataset");

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
  artifact_type: "targeted_grounded_construction_length_reduced_packet",
  status: validation.errors.length || lengthProfile.total_rows_over_limit
    ? "targeted_grounded_construction_length_reduction_has_residual_risk"
    : "targeted_grounded_construction_length_reduced_packet_ready_for_bounded_smoke",
  purpose: "Reduce prompt-length truncation risk in the D393 targeted grounded-construction packet before any Prime launch decision.",
  source_runs: {
    source_packet: sourcePacketRunId,
  },
  base_model: sourceResult.base_model,
  estimated_gpu_cost_usd: sourceResult.estimated_gpu_cost_usd,
  reduction_policy: {
    rebuild_prompts_from_structured_input: true,
    cited_evidence_char_limit: 900,
    uncited_evidence_char_limit: 420,
    max_evidence_items: 7,
    final_diagnostic_targets_used_for_training: false,
    eval_prompts_preserved_by_id: sameList(sourceRows.eval_prompts.map((row) => row.example_id), packetRows.eval_prompts.map((row) => row.example_id)),
    eval_targets_preserved: JSON.stringify(sourceRows.eval_targets_diagnostic) === JSON.stringify(packetRows.eval_targets_diagnostic),
  },
  examples: summarizeRows(packetRows),
  validation,
  length_profile: lengthProfile,
  decision: {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    run_launch_preflight_next: validation.errors.length === 0,
    next_step: validation.errors.length === 0
      ? "Run launch preflight on the length-reduced packet; use its prompt profile for the next Prime decision."
      : "Fix length-reduced packet validation before preflight.",
    reason: "This step removes avoidable prompt-length risk without changing labels or spending compute.",
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
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

for (const [name, rows] of Object.entries(packetRows)) await writeJsonl(path.join(datasetDir, `${name}.jsonl`), rows);
await copyRunnerArtifacts();
await fs.writeFile(path.join(datasetDir, "README.md"), renderDatasetReadme(result));
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
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function reduceSft(row) {
  const target = parseAssistant(row.messages?.at(-1)?.content) ?? row.target;
  const messages = [
    { role: "system", content: reducedSystemPrompt() },
    { role: "user", content: renderUserPrompt(row.input, target, "sft") },
    row.messages.at(-1),
  ];
  return { ...row, messages, curriculum_metadata: { ...(row.curriculum_metadata ?? {}), length_reduced_prompt: true } };
}

function reduceDpo(row) {
  const chosen = safeJson(row.chosen);
  const messages = [
    { role: "system", content: reducedSystemPrompt() },
    { role: "user", content: renderUserPrompt(row.input, chosen, row.label_source?.target_form ?? "dpo") },
  ];
  return { ...row, prompt: messages, curriculum_metadata: { ...(row.curriculum_metadata ?? {}), length_reduced_prompt: true } };
}

function reduceEval(row) {
  const messages = [
    { role: "system", content: reducedSystemPrompt() },
    { role: "user", content: renderUserPrompt(row.input, null, "eval") },
  ];
  return { ...row, messages, curriculum_metadata: { ...(row.curriculum_metadata ?? {}), length_reduced_prompt: true } };
}

function reducedSystemPrompt() {
  return [
    "Answer only from the compact evidence pack.",
    "Return JSON with answer_type, evidence_first, answer, citations, claim_table, abstention_reason.",
    "For numeric/metric questions, copy the exact requested value, unit, metric, baseline, and comparison target.",
    "For multi-citation questions, synthesize every required part and cite each needed evidence id inline.",
    "Do not use nearby wrong-target facts. Abstain when direct support is missing.",
  ].join(" ");
}

function renderUserPrompt(input, target, mode) {
  const metadata = input?.document_metadata ?? {};
  const citations = new Set(normalizeCitations(target?.citations));
  const evidence = (input?.compact_retrieved_evidence_pack ?? []).slice(0, 7).map((item) => {
    const cited = citations.has(item.evidence_id);
    const limit = cited ? 900 : 420;
    return `[${item.evidence_id}] ${item.section ?? "Evidence"}: ${truncate(item.text, limit)}`;
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
    `Construction hint: ${hintFor(input?.question, target, mode)}`,
    "Evidence-first contract: decide sufficiency for the exact target; if sufficient, write cited supported_claims first and answer only from them; otherwise abstain.",
    "Return only JSON.",
  ].join("\n");
}

function hintFor(question, target, mode) {
  const answer = stripCitations(target?.answer);
  const citations = normalizeCitations(target?.citations);
  if (/\d+(?:[,.]\d+)*(?:\.\d+)?%?/.test(answer) || /\b(how many|how much|percent|percentage|score|rate|number|large|size|points?|improve|impact)\b/i.test(String(question ?? ""))) {
    return "numeric_or_metric; preserve exact values and units; reject nearby numbers for the wrong target.";
  }
  if (citations.length > 1 || /\b(which|what|list|models?|datasets?|languages?|benchmarks?|architectures?)\b/i.test(String(question ?? ""))) {
    return "multi_part_or_multi_citation; include all requested parts and all necessary citations.";
  }
  return `form=${mode}; answer the exact question target with cited support.`;
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
      const parsed = parseAssistant(row.messages?.at(-1)?.content);
      if (!parsed || parsed.answer_type !== row.target?.answer_type) errors.push(`${split}:${row.example_id}: assistant target mismatch`);
    }
  }
  for (const split of ["dpo_train", "dpo_validation"]) {
    for (const row of rowsByName[split]) {
      if (!Array.isArray(row.prompt) || row.prompt.length !== 2) errors.push(`${split}:${row.example_id}: expected 2-message prompt`);
      const chosen = safeJson(row.chosen);
      const rejected = safeJson(row.rejected);
      if (!chosen?.answer_type || !rejected?.answer_type) errors.push(`${split}:${row.example_id}: malformed chosen/rejected`);
      if (JSON.stringify(chosen) === JSON.stringify(rejected)) errors.push(`${split}:${row.example_id}: chosen equals rejected`);
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

function renderDatasetReadme(result) {
  return `# Targeted Grounded Construction Length-Reduced Packet

Run: \`${result.run_id}\`

This packet reduces prompt length from \`${sourcePacketRunId}\` without changing labels.

- Validation errors: ${result.validation.summary.errors}
- Total rows over 2048/1536 approximate limits: ${result.length_profile.total_rows_over_limit}
- OpenAI calls: 0
- Prime jobs: 0
`;
}

function renderReport(result) {
  return `# Targeted Grounded Construction Length Reduction

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no API calls and launches no GPU jobs.

## Length Profile

| Surface | Rows | p50 approx tok. | p95 approx tok. | Max approx tok. | Rows over limit |
| --- | ---: | ---: | ---: | ---: | ---: |
| SFT full | ${rowStats(result.length_profile.sft_full)} |
| DPO prompt | ${rowStats(result.length_profile.dpo_prompt)} |
| DPO full | ${rowStats(result.length_profile.dpo_full)} |
| Eval prompt | ${rowStats(result.length_profile.eval_prompt)} |

Total rows over limit: ${result.length_profile.total_rows_over_limit}

## Decision

- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Run launch preflight next: ${result.decision.run_launch_preflight_next ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function rowStats(stats) {
  return `${stats.rows} | ${stats.p50_approx_tokens} | ${stats.p95_approx_tokens} | ${stats.max_approx_tokens} | ${stats.rows_over_limit}`;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseAssistant(text) {
  return safeJson(text);
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation)).filter(Boolean);
}

function stripCitations(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(text, limit) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, Math.max(0, limit - 16)).trim()} ... [truncated]`;
}

function sameList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function percentile(values, quantile) {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * quantile) - 1));
  return values[index];
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}
