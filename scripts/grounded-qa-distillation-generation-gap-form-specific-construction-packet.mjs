import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet-run-id"] ?? "generation-gap-failure-driven-packet-d329-2026-06-28-v1";
const signalAuditRunId = args["signal-audit-run-id"] ?? "generation-gap-answer-construction-signal-audit-d337-2026-06-28-v1";
const runId = args["run-id"] ?? "generation-gap-form-specific-construction-packet-d338-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const sourceDatasetDir = path.join(runsDir, sourcePacketRunId, "dataset");

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceResult = await readJson(path.join(runsDir, sourcePacketRunId, "result.json"));
const signalAudit = await readJson(path.join(runsDir, signalAuditRunId, "result.json"));
const sourceRows = {
  sft_train: await readJsonl(path.join(sourceDatasetDir, "sft_train.jsonl")),
  sft_validation: await readJsonl(path.join(sourceDatasetDir, "sft_validation.jsonl")),
  dpo_train: await readJsonl(path.join(sourceDatasetDir, "dpo_train.jsonl")),
  dpo_validation: await readJsonl(path.join(sourceDatasetDir, "dpo_validation.jsonl")),
  eval_prompts: await readJsonl(path.join(sourceDatasetDir, "eval_prompts.jsonl")),
  eval_targets_diagnostic: await readJsonl(path.join(sourceDatasetDir, "eval_targets_diagnostic.jsonl")),
};

const addedTrainDpo = buildFormSpecificDpo(sourceRows.sft_train, "train");
const addedValidationDpo = buildFormSpecificDpo(sourceRows.sft_validation, "validation");
const packetRows = {
  sft_train: sourceRows.sft_train.map(hardenSft),
  sft_validation: sourceRows.sft_validation.map(hardenSft),
  dpo_train: [...sourceRows.dpo_train.map(hardenDpo), ...addedTrainDpo],
  dpo_validation: [...sourceRows.dpo_validation.map(hardenDpo), ...addedValidationDpo],
  eval_prompts: sourceRows.eval_prompts.map(hardenEval),
  eval_targets_diagnostic: sourceRows.eval_targets_diagnostic,
};

await copyLaunchArtifacts();

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "generation_gap_form_specific_construction_packet",
  status: "ready_for_local_dataset_validation",
  purpose: "Add explicit yes/no polarity, multi-citation synthesis, and question-target hard-negative preferences after D337 showed the D329 packet lacked those construction signals.",
  source_packet_run_id: sourcePacketRunId,
  signal_audit_run_id: signalAuditRunId,
  base_model: sourceResult.base_model ?? "Qwen/Qwen2.5-3B-Instruct",
  estimated_gpu_cost_usd: sourceResult.estimated_gpu_cost_usd ?? 1,
  source_signal: {
    d337_status: signalAudit.status,
    missing_training_signals: signalAudit.summary?.missing_training_signals ?? [],
    nonrecoverable_target_forms: signalAudit.summary?.nonrecoverable_target_forms ?? {},
  },
  curriculum: {
    hardened_prompt: true,
    form_specific_construction_preferences: true,
    added_preference_types: countBy([...addedTrainDpo, ...addedValidationDpo], (row) => row.label_source.type),
    added_target_forms: countBy([...addedTrainDpo, ...addedValidationDpo], (row) => row.label_source.target_form),
    leakage_guard: {
      final_diagnostic_targets_used_for_training: false,
      train_validation_rows_only_for_new_preferences: true,
      eval_example_ids_unchanged: sameList(sourceRows.eval_prompts.map((row) => row.example_id), packetRows.eval_prompts.map((row) => row.example_id)),
      eval_targets_diagnostic_preserved_for_eval_only: JSON.stringify(sourceRows.eval_targets_diagnostic) === JSON.stringify(packetRows.eval_targets_diagnostic),
      d337_final_form_audit_used_for_packet_design_only: true,
    },
  },
  examples: {
    source: summarizeRows(sourceRows),
    current: summarizeRows(packetRows),
    added_dpo_train: addedTrainDpo.length,
    added_dpo_validation: addedValidationDpo.length,
  },
  quality_gates: qualityGates(packetRows, addedTrainDpo, addedValidationDpo),
  decision: {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    run_local_validation_next: true,
    next_step: "Run the local dataset validator and a launch preflight for D338. If both pass under the $100 cap, use Prime for a bounded smoke rather than rerunning D329.",
    reason: "This packet directly targets the D336/D337 failure forms, but this step only materializes and validates zero-cost training data.",
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
    dataset_readme: rel(path.join(datasetDir, "README.md")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(datasetDir, "sft_train.jsonl"), packetRows.sft_train);
await writeJsonl(path.join(datasetDir, "sft_validation.jsonl"), packetRows.sft_validation);
await writeJsonl(path.join(datasetDir, "dpo_train.jsonl"), packetRows.dpo_train);
await writeJsonl(path.join(datasetDir, "dpo_validation.jsonl"), packetRows.dpo_validation);
await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), packetRows.eval_prompts);
await writeJsonl(path.join(datasetDir, "eval_targets_diagnostic.jsonl"), packetRows.eval_targets_diagnostic);
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
  decision: result.decision,
  budget: result.budget,
}, null, 2));

function buildFormSpecificDpo(rows, split) {
  const emitted = [];
  for (const row of rows) {
    const target = parseTarget(row);
    const targetForm = classifyTargetForm(row, target);
    if (target.answer_type !== "grounded_answer") continue;
    const prompt = hardenMessages(row.messages.slice(0, 2), row.input);
    if (targetForm === "yes_no_polarity") {
      emitted.push(dpoRow(row, split, "prefer_correct_yes_no_polarity_over_flipped_polarity", targetForm, target, flippedPolarity(target), prompt));
    }
    if (targetForm === "multi_citation_synthesis") {
      emitted.push(dpoRow(row, split, "prefer_multi_citation_synthesis_over_single_evidence_fragment", targetForm, target, singleCitationFragment(row, target), prompt));
    }
    if (targetForm === "multi_citation_synthesis" || targetForm === "list_or_structured_answer" || targetForm === "yes_no_polarity") {
      const wrongTarget = questionTargetHardNegative(row, target);
      if (wrongTarget) {
        emitted.push(dpoRow(row, split, "prefer_answer_target_over_supported_but_wrong_target_fact", targetForm, target, wrongTarget, prompt));
      }
    }
  }
  return emitted;
}

function dpoRow(source, split, type, targetForm, chosen, rejected, prompt) {
  return {
    example_id: `${baseExampleId(source.example_id)}:d338:${type}`,
    task: "citation_grounded_domain_qa_generation_gap_dpo",
    prompt,
    chosen: JSON.stringify(chosen),
    rejected: JSON.stringify(rejected),
    chosen_output: chosen,
    rejected_output: rejected,
    input: source.input,
    label_source: {
      type,
      target_form: targetForm,
      source_example_id: source.example_id,
      source_packet_run_id: sourcePacketRunId,
      signal_audit_run_id: signalAuditRunId,
      uses_final_diagnostic_target: false,
    },
    curriculum_metadata: {
      source_example_id: source.example_id,
      split,
      d338_form_specific_preference: true,
    },
  };
}

function hardenSft(row) {
  return { ...row, messages: hardenMessages(row.messages, row.input), curriculum_metadata: { ...(row.curriculum_metadata ?? {}), d338_form_specific_prompt: true } };
}

function hardenDpo(row) {
  return { ...row, prompt: hardenMessages(row.prompt, row.input), curriculum_metadata: { ...(row.curriculum_metadata ?? {}), d338_form_specific_prompt: true } };
}

function hardenEval(row) {
  return { ...row, messages: hardenMessages(row.messages, row.input), curriculum_metadata: { ...(row.curriculum_metadata ?? {}), d338_form_specific_prompt: true } };
}

function hardenMessages(messages, input) {
  return messages.map((message, index) => {
    if (index === 0) return { ...message, content: hardenedSystemPrompt() };
    if (index === 1) return { ...message, content: appendConstructionHints(message.content, input) };
    return message;
  });
}

function hardenedSystemPrompt() {
  return [
    "Answer using only the compact evidence pack.",
    "Return valid JSON only with keys answer_type, answer, citations, claim_table, and abstention_reason.",
    "First decide whether the cited evidence directly answers the exact question target.",
    "For yes/no questions, answer with the correct polarity only when the cited evidence entails that polarity.",
    "For multi-part or list questions, synthesize all required parts from the cited evidence and cite each factual clause.",
    "Do not substitute a nearby supported fact for the requested target.",
    "Do not output empty answers, one-token non-boolean answers, generic claim_table entries, citation-only answers, or overcited answers.",
    "If evidence is insufficient, answer_type must be abstain, citations must be empty, and abstention_reason must name the missing support.",
  ].join(" ");
}

function appendConstructionHints(content, input) {
  const hint = classifyQuestion(input?.question ?? "");
  return [
    String(content ?? ""),
    "",
    `Construction hint: form=${hint}; answer the exact target, verify yes/no polarity, include all requested synthesis/list items, and cite support.`,
  ].join("\n");
}

function classifyQuestion(question) {
  if (/^(does|do|did|is|are|was|were|can|could|should|would|has|have)\b/i.test(String(question))) return "yes_no";
  if (/\b(what|which|list|name|how many|five|three|two)\b/i.test(String(question))) return "list_or_fact";
  if (/\b(compare|compared|relationship|difference|how|why)\b/i.test(String(question))) return "synthesis";
  return "open";
}

function classifyTargetForm(row, target) {
  if (target.answer_type === "abstain") return "abstention";
  const answer = stripCitations(target.answer);
  const question = String(row.input?.question ?? "");
  const citations = target.citations ?? [];
  if (/^(yes|no)\b/i.test(answer) && /^(does|do|did|is|are|was|were|can|could|should|would|has|have)\b/i.test(question)) return "yes_no_polarity";
  if (citations.length > 1) return "multi_citation_synthesis";
  if (/[;:]|,|\b and \b/i.test(answer) && answer.split(/\s+/).length >= 8) return "list_or_structured_answer";
  return "single_span_answer";
}

function flippedPolarity(target) {
  const answer = stripCitations(target.answer);
  const flipped = /^yes\b/i.test(answer) ? answer.replace(/^yes\b/i, "No") : answer.replace(/^no\b/i, "Yes");
  return {
    ...target,
    answer: ensureInlineCitations(flipped, target.citations ?? []),
    claim_table: [{ claim: stripCitations(flipped), support: "wrong_polarity", citations: target.citations ?? [] }],
  };
}

function singleCitationFragment(row, target) {
  const citation = target.citations?.[0] ?? row.input?.compact_retrieved_evidence_pack?.[0]?.evidence_id ?? "E1";
  const evidence = (row.input?.compact_retrieved_evidence_pack ?? []).find((item) => item.evidence_id === citation) ?? row.input?.compact_retrieved_evidence_pack?.[0];
  const fragment = firstSentence(evidence?.text ?? stripCitations(target.answer));
  return {
    answer_type: "grounded_answer",
    answer: `${fragment} [${citation}]`,
    citations: [citation],
    claim_table: [{ claim: fragment, support: "incomplete_single_evidence_fragment", citations: [citation] }],
    abstention_reason: null,
  };
}

function questionTargetHardNegative(row, target) {
  const gold = new Set(target.citations ?? []);
  const evidence = (row.input?.compact_retrieved_evidence_pack ?? []).find((item) => !gold.has(item.evidence_id)) ?? row.input?.compact_retrieved_evidence_pack?.find((item) => item.evidence_id !== target.citations?.[0]);
  if (!evidence) return null;
  const sentence = firstSentence(evidence.text);
  if (!sentence) return null;
  return {
    answer_type: "grounded_answer",
    answer: `${sentence} [${evidence.evidence_id}]`,
    citations: [evidence.evidence_id],
    claim_table: [{ claim: sentence, support: "supported_but_wrong_question_target", citations: [evidence.evidence_id] }],
    abstention_reason: null,
  };
}

async function copyLaunchArtifacts() {
  for (const file of ["validate_joint_action_dataset_uv.py", "train_joint_action_lora_uv.py", "eval_joint_action_adapter_uv.py", "run_joint_action_smoke.sh"]) {
    let text = await fs.readFile(path.join(runsDir, sourcePacketRunId, file), "utf8");
    text = text.replaceAll(sourcePacketRunId, runId);
    await fs.writeFile(path.join(outputDir, file), text);
  }
  await fs.chmod(path.join(outputDir, "run_joint_action_smoke.sh"), 0o755);
}

function qualityGates(rows, addedTrainDpo, addedValidationDpo) {
  const allAdded = [...addedTrainDpo, ...addedValidationDpo];
  const types = countBy(allAdded, (row) => row.label_source.type);
  return {
    has_added_train_preferences: addedTrainDpo.length > 0,
    has_added_validation_preferences: addedValidationDpo.length > 0,
    has_yes_no_polarity_preferences: Number(types.prefer_correct_yes_no_polarity_over_flipped_polarity ?? 0) > 0,
    has_multi_citation_synthesis_preferences: Number(types.prefer_multi_citation_synthesis_over_single_evidence_fragment ?? 0) > 0,
    has_question_target_hard_negatives: Number(types.prefer_answer_target_over_supported_but_wrong_target_fact ?? 0) > 0,
    eval_prompts_unchanged_count: rows.eval_prompts.length === sourceRows.eval_prompts.length,
    every_grounded_chosen_has_inline_citation: allAdded
      .filter((row) => row.chosen_output.answer_type === "grounded_answer")
      .every((row) => (row.chosen_output.citations ?? []).every((id) => String(row.chosen_output.answer ?? "").includes(`[${id}]`))),
    no_model_or_api_calls: true,
  };
}

function parseTarget(row) {
  if (row.target) return row.target;
  const assistant = row.messages?.findLast?.((message) => message.role === "assistant") ?? row.messages?.[2];
  return JSON.parse(assistant.content);
}

function ensureInlineCitations(answer, citations) {
  const missing = citations.filter((id) => !String(answer).includes(`[${id}]`));
  return `${String(answer).trim()} ${missing.map((id) => `[${id}]`).join(" ")}`.trim();
}

function firstSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/)[0]?.trim().slice(0, 280) ?? "";
}

function stripCitations(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim();
}

function baseExampleId(exampleId) {
  return String(exampleId).replace(/:generation-gap:(train|validation):sft$/, "");
}

function summarizeRows(rows) {
  return Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, value.length]));
}

function countBy(rows, fn) {
  const counts = {};
  for (const row of rows) {
    const key = fn(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function sameList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function renderDatasetReadme(result) {
  return `# ${result.run_id}

Form-specific generation-gap packet from D338.

- Source packet: \`${result.source_packet_run_id}\`
- Signal audit: \`${result.signal_audit_run_id}\`
- Added DPO train rows: ${result.examples.added_dpo_train}
- Added DPO validation rows: ${result.examples.added_dpo_validation}
- OpenAI calls: 0
- Prime spend: 0

Final diagnostic targets are not used for training. Eval prompts are preserved for the downstream shape harness.
`;
}

function renderReport(result) {
  return `# Generation-Gap Form-Specific Construction Packet

Status: \`${result.status}\`

This packet makes no OpenAI calls and launches no Prime job.

## Source Signal

- D337 status: \`${result.source_signal.d337_status}\`
- Missing signals: ${(result.source_signal.missing_training_signals ?? []).join(", ")}
- Nonrecoverable target forms: ${JSON.stringify(result.source_signal.nonrecoverable_target_forms)}

## Examples

- SFT train: ${result.examples.current.sft_train}
- SFT validation: ${result.examples.current.sft_validation}
- DPO train: ${result.examples.current.dpo_train}
- DPO validation: ${result.examples.current.dpo_validation}
- Added DPO train: ${result.examples.added_dpo_train}
- Added DPO validation: ${result.examples.added_dpo_validation}

## Added Preference Types

${Object.entries(result.curriculum.added_preference_types).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  return (await fs.readFile(file, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith("--") ? argv[++i] : true;
  }
  return parsed;
}
