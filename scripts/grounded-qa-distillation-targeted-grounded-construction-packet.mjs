import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");

const runId = "targeted-grounded-construction-packet-frontier-repaired-v1";
const sourcePacketRunId = "frontier-repaired-launch-packet-2026-06-29-v1";
const runnerPacketRunId = "frontier-repaired-qwen3b-launch-packet-2026-06-29-v1";
const taxonomyRunId = "current-grounded-gap-taxonomy-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const sourceDatasetDir = path.join(runsDir, sourcePacketRunId, "dataset");
const runnerDir = path.join(runsDir, runnerPacketRunId);

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceResult = await readJson(path.join(runsDir, sourcePacketRunId, "result.json"));
const taxonomy = await readJson(path.join(runsDir, taxonomyRunId, "result.json"));
const sourceRows = {
  sft_train: await readJsonl(path.join(sourceDatasetDir, "sft_train.jsonl")),
  sft_validation: await readJsonl(path.join(sourceDatasetDir, "sft_validation.jsonl")),
  dpo_train: await readJsonl(path.join(sourceDatasetDir, "dpo_train.jsonl")),
  dpo_validation: await readJsonl(path.join(sourceDatasetDir, "dpo_validation.jsonl")),
  eval_prompts: await readJsonl(path.join(sourceDatasetDir, "eval_prompts.jsonl")),
  eval_targets_diagnostic: await readJsonl(path.join(sourceDatasetDir, "eval_targets_diagnostic.jsonl")),
};

const addedTrainDpo = buildTargetedDpo(sourceRows.sft_train, "train");
const addedValidationDpo = buildTargetedDpo(sourceRows.sft_validation, "validation");
const packetRows = {
  sft_train: sourceRows.sft_train.map(hardenSft),
  sft_validation: sourceRows.sft_validation.map(hardenSft),
  dpo_train: [...sourceRows.dpo_train.map(hardenDpo), ...addedTrainDpo],
  dpo_validation: [...sourceRows.dpo_validation.map(hardenDpo), ...addedValidationDpo],
  eval_prompts: sourceRows.eval_prompts.map(hardenEval),
  eval_targets_diagnostic: sourceRows.eval_targets_diagnostic,
};

const validation = validatePacket(packetRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "targeted_grounded_construction_packet",
  status: validation.errors.length ? "targeted_grounded_construction_packet_invalid" : "targeted_grounded_construction_packet_ready_for_preflight",
  purpose: "Add numeric/metric exactness and multi-citation synthesis preferences after D392 showed current grounded failures are dominated by candidate absence in those forms.",
  source_runs: {
    source_packet: sourcePacketRunId,
    runner_packet: runnerPacketRunId,
    grounded_gap_taxonomy: taxonomyRunId,
  },
  base_model: "Qwen/Qwen2.5-3B-Instruct",
  estimated_gpu_cost_usd: 4,
  source_context: {
    source_packet_status: sourceResult.status,
    taxonomy_status: taxonomy.status,
    taxonomy_summary: taxonomy.summary,
  },
  construction: {
    hardened_prompt: true,
    added_preference_types: countBy([...addedTrainDpo, ...addedValidationDpo], (row) => row.label_source.type),
    added_target_forms: countBy([...addedTrainDpo, ...addedValidationDpo], (row) => row.label_source.target_form),
    added_dpo_train: addedTrainDpo.length,
    added_dpo_validation: addedValidationDpo.length,
    final_diagnostic_targets_used_for_training: false,
    eval_prompts_preserved: sameList(sourceRows.eval_prompts.map((row) => row.example_id), packetRows.eval_prompts.map((row) => row.example_id)),
    eval_targets_preserved: JSON.stringify(sourceRows.eval_targets_diagnostic) === JSON.stringify(packetRows.eval_targets_diagnostic),
  },
  examples: {
    source: summarizeRows(sourceRows),
    current: summarizeRows(packetRows),
  },
  validation,
  decision: {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    run_launch_preflight_next: validation.errors.length === 0,
    next_step: validation.errors.length === 0
      ? "Run a launch preflight for this packet; only consider a bounded Prime smoke if the preflight passes under the $100 cap."
      : "Fix packet validation before any preflight or compute.",
    reason: validation.errors.length === 0
      ? "The packet directly targets D392 numeric/metric and multi-citation candidate-absence failures using only repaired train/validation rows."
      : "The targeted construction packet is malformed.",
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
    note: "This packet is a deterministic local transform of existing repaired train/validation artifacts.",
  },
  artifacts: {
    sft_train_jsonl: rel(path.join(datasetDir, "sft_train.jsonl")),
    sft_validation_jsonl: rel(path.join(datasetDir, "sft_validation.jsonl")),
    dpo_train_jsonl: rel(path.join(datasetDir, "dpo_train.jsonl")),
    dpo_validation_jsonl: rel(path.join(datasetDir, "dpo_validation.jsonl")),
    eval_prompts_jsonl: rel(path.join(datasetDir, "eval_prompts.jsonl")),
    eval_targets_diagnostic_jsonl: rel(path.join(datasetDir, "eval_targets_diagnostic.jsonl")),
    dataset_readme: rel(path.join(datasetDir, "README.md")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

for (const [name, rows] of Object.entries(packetRows)) {
  await writeJsonl(path.join(datasetDir, `${name}.jsonl`), rows);
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
  construction: result.construction,
  examples: result.examples,
  validation: result.validation.summary,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function buildTargetedDpo(rows, split) {
  const emitted = [];
  for (const row of rows) {
    const target = normalizeTarget(row.target);
    if (target.answer_type !== "grounded_answer") continue;
    const form = classifyTargetForm(row.input?.question, target);
    const prompt = hardenMessages(row.messages?.slice(0, 2) ?? [], row.input);
    if (form === "numeric_or_metric") {
      for (const rejected of numericRejectedVariants(row, target)) {
        emitted.push(dpoRow(row, split, rejected.type, form, target, rejected.output, prompt));
      }
    }
    if (normalizeCitations(target.citations).length > 1 || form === "multi_citation_synthesis") {
      for (const rejected of multiCitationRejectedVariants(row, target)) {
        emitted.push(dpoRow(row, split, rejected.type, "multi_citation_synthesis", target, rejected.output, prompt));
      }
    }
  }
  return emitted;
}

async function copyRunnerArtifacts() {
  for (const file of [
    "validate_joint_action_dataset_uv.py",
    "train_joint_action_lora_uv.py",
    "eval_joint_action_adapter_uv.py",
    "run_joint_action_smoke.sh",
  ]) {
    const source = path.join(runnerDir, file);
    const target = path.join(outputDir, file);
    let text = await fs.readFile(source, "utf8");
    if (file === "eval_joint_action_adapter_uv.py") {
      text = text.replaceAll(runnerPacketRunId, runId);
    }
    if (file === "run_joint_action_smoke.sh") {
      text = text.replaceAll(runnerPacketRunId, runId);
    }
    await fs.writeFile(target, text);
    if (file.endsWith(".sh")) await fs.chmod(target, 0o755);
  }
}

function numericRejectedVariants(row, target) {
  const variants = [];
  const answerNoNumbers = stripCitations(target.answer).replace(/\b\d+(?:[,.]\d+)*(?:\.\d+)?%?\b/g, "the reported value").replace(/\s+/g, " ").trim();
  variants.push({
    type: "prefer_exact_numeric_answer_over_vague_metric_answer",
    output: {
      ...target,
      answer: ensureInlineCitations(answerNoNumbers || "The evidence reports the metric value.", normalizeCitations(target.citations)),
      claim_table: [{ claim: answerNoNumbers || "The evidence reports the metric value.", support: "vague_metric_negative", citations: normalizeCitations(target.citations) }],
    },
  });
  const nearby = nearbyNumericEvidence(row, target);
  if (nearby) {
    variants.push({
      type: "prefer_target_metric_over_nearby_supported_number",
      output: {
        answer_type: "grounded_answer",
        evidence_first: {
          sufficiency: "sufficient",
          supported_claims: [{ claim_id: "C1", claim: nearby.claim, citations: [nearby.evidence_id], support_status: "supported_but_wrong_target" }],
          missing_support: "",
          question_target: target.evidence_first?.question_target ?? row.input?.question ?? "exact_question_target",
        },
        answer: `${nearby.claim} [${nearby.evidence_id}]`,
        citations: [nearby.evidence_id],
        claim_table: [{ claim: nearby.claim, support: "supported_but_wrong_target", citations: [nearby.evidence_id] }],
        abstention_reason: null,
      },
    });
  }
  return variants;
}

function multiCitationRejectedVariants(row, target) {
  const citations = normalizeCitations(target.citations);
  if (citations.length <= 1) return [];
  const variants = [];
  const firstCitation = citations[0];
  const firstEvidence = (row.input?.compact_retrieved_evidence_pack ?? []).find((item) => item.evidence_id === firstCitation);
  const fragment = firstSentence(firstEvidence?.text ?? stripCitations(target.answer));
  variants.push({
    type: "prefer_multi_citation_synthesis_over_single_fragment",
    output: {
      answer_type: "grounded_answer",
      evidence_first: {
        sufficiency: "sufficient",
        supported_claims: [{ claim_id: "C1", claim: fragment, citations: [firstCitation], support_status: "incomplete_single_fragment" }],
        missing_support: "",
        question_target: target.evidence_first?.question_target ?? row.input?.question ?? "exact_question_target",
      },
      answer: `${fragment} [${firstCitation}]`,
      citations: [firstCitation],
      claim_table: [{ claim: fragment, support: "incomplete_single_fragment", citations: [firstCitation] }],
      abstention_reason: null,
    },
  });
  variants.push({
    type: "prefer_exact_citation_set_over_missing_synthesis_citation",
    output: {
      ...target,
      citations: citations.slice(0, -1),
      answer: ensureInlineCitations(stripCitations(target.answer), citations.slice(0, -1)),
      claim_table: (target.claim_table ?? []).map((claim) => ({ ...claim, citations: normalizeCitations(claim.citations).filter((id) => id !== citations.at(-1)) })),
    },
  });
  return variants;
}

function dpoRow(source, split, type, targetForm, chosen, rejected, prompt) {
  return {
    example_id: `${source.example_id}:targeted-grounded:${type}`,
    task: "citation_grounded_domain_qa_targeted_grounded_construction_dpo",
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
      taxonomy_run_id: taxonomyRunId,
      split,
      uses_final_diagnostic_target: false,
    },
    curriculum_metadata: {
      source_example_id: source.example_id,
      d393_targeted_grounded_construction: true,
    },
  };
}

function hardenSft(row) {
  return {
    ...row,
    messages: hardenMessages(row.messages ?? [], row.input),
    curriculum_metadata: { ...(row.curriculum_metadata ?? {}), targeted_grounded_construction_prompt: true },
  };
}

function hardenDpo(row) {
  return {
    ...row,
    prompt: hardenMessages(row.prompt ?? [], row.input),
    curriculum_metadata: { ...(row.curriculum_metadata ?? {}), targeted_grounded_construction_prompt: true },
  };
}

function hardenEval(row) {
  return {
    ...row,
    messages: hardenMessages(row.messages ?? [], row.input),
    curriculum_metadata: { ...(row.curriculum_metadata ?? {}), targeted_grounded_construction_prompt: true },
  };
}

function hardenMessages(messages, input) {
  return messages.map((message, index) => {
    if (index === 0) return { ...message, content: hardenedSystemPrompt() };
    if (index === 1) return { ...message, content: appendConstructionHint(message.content, input) };
    return message;
  });
}

function hardenedSystemPrompt() {
  return [
    "Answer using only the compact evidence pack.",
    "Return valid JSON only with keys answer_type, evidence_first, answer, citations, claim_table, and abstention_reason.",
    "For numeric or metric questions, copy the exact requested value, unit, comparison target, and metric name from cited evidence.",
    "Do not answer a nearby supported number when the question asks for a different metric, baseline, dataset size, score, count, or comparison.",
    "For multi-citation questions, synthesize every required part and include every evidence id needed for the answer.",
    "Every citation id in citations must appear inline in answer, and claim_table citations must be a subset of top-level citations.",
    "If the evidence does not directly support the exact target, abstain and name the missing target.",
  ].join(" ");
}

function appendConstructionHint(content, input) {
  const form = classifyQuestionForm(input?.question);
  return [
    String(content ?? ""),
    "",
    `Targeted construction hint: form=${form}; preserve exact numeric values and units; cite every required evidence fragment; reject nearby but wrong-target facts.`,
  ].join("\n");
}

function validatePacket(rowsByName) {
  const errors = [];
  const files = {};
  for (const [name, rows] of Object.entries(rowsByName)) files[name] = rows.length;
  for (const split of ["sft_train", "sft_validation"]) {
    for (const row of rowsByName[split]) {
      const assistant = row.messages?.at(-1);
      if (assistant?.role !== "assistant") errors.push(`${split}:${row.example_id}: missing assistant message`);
      try {
        const parsed = JSON.parse(assistant.content);
        if (parsed.answer_type !== row.target?.answer_type) errors.push(`${split}:${row.example_id}: assistant target mismatch`);
      } catch {
        errors.push(`${split}:${row.example_id}: assistant content is not JSON`);
      }
    }
  }
  for (const split of ["dpo_train", "dpo_validation"]) {
    for (const row of rowsByName[split]) {
      try {
        const chosen = JSON.parse(row.chosen);
        const rejected = JSON.parse(row.rejected);
        if (!Array.isArray(row.prompt) || row.prompt.length !== 2) errors.push(`${split}:${row.example_id}: malformed prompt`);
        if (!chosen.answer_type || !rejected.answer_type) errors.push(`${split}:${row.example_id}: missing answer_type`);
        if (JSON.stringify(chosen) === JSON.stringify(rejected)) errors.push(`${split}:${row.example_id}: chosen equals rejected`);
      } catch {
        errors.push(`${split}:${row.example_id}: malformed JSON chosen/rejected`);
      }
    }
  }
  return {
    summary: {
      files,
      errors: errors.length,
      added_targeted_train_rows: rowsByName.dpo_train.filter((row) => row.label_source?.taxonomy_run_id === taxonomyRunId).length,
      added_targeted_validation_rows: rowsByName.dpo_validation.filter((row) => row.label_source?.taxonomy_run_id === taxonomyRunId).length,
    },
    errors: errors.slice(0, 50),
  };
}

function summarizeRows(rowsByName) {
  return {
    sft_train: rowsByName.sft_train.length,
    sft_validation: rowsByName.sft_validation.length,
    dpo_train: rowsByName.dpo_train.length,
    dpo_validation: rowsByName.dpo_validation.length,
    eval_prompts: rowsByName.eval_prompts.length,
    eval_targets_diagnostic: rowsByName.eval_targets_diagnostic.length,
    sft_train_forms: summarizeForms(rowsByName.sft_train),
    sft_validation_forms: summarizeForms(rowsByName.sft_validation),
  };
}

function summarizeForms(rows) {
  return countBy(rows.filter((row) => row.target?.answer_type === "grounded_answer"), (row) => classifyTargetForm(row.input?.question, row.target));
}

function normalizeTarget(target) {
  return {
    ...target,
    citations: normalizeCitations(target?.citations),
    claim_table: (target?.claim_table ?? []).map((claim) => ({ ...claim, citations: normalizeCitations(claim.citations) })),
  };
}

function classifyQuestionForm(question) {
  if (/\b(how many|how much|percent|percentage|score|rate|number|large|size|points?|improve|baseline)\b/i.test(String(question ?? ""))) return "numeric_or_metric";
  if (/\b(which|what|list|models?|datasets?|languages?|benchmarks?|architectures?)\b/i.test(String(question ?? ""))) return "list_or_multi_citation";
  return "open";
}

function classifyTargetForm(question, target) {
  if (target?.answer_type === "abstain") return "abstention";
  const answer = stripCitations(target?.answer);
  const citations = normalizeCitations(target?.citations);
  if (/^(yes|no)\b/i.test(answer) || /^(does|do|did|is|are|was|were|can|could|should|would|has|have)\b/i.test(String(question ?? ""))) return "yes_no_polarity";
  if (/\d+(?:[,.]\d+)*(?:\.\d+)?%?/.test(answer) || /\b(how many|how much|percent|percentage|score|rate|number|large|size|points?|improve)\b/i.test(String(question ?? ""))) return "numeric_or_metric";
  if (citations.length > 1) return "multi_citation_synthesis";
  if (/[;:]|,|\b and \b/i.test(answer) && tokenList(answer).length >= 8) return "list_or_structured_answer";
  return "single_span_answer";
}

function nearbyNumericEvidence(row, target) {
  const targetCitationSet = new Set(normalizeCitations(target.citations));
  const evidence = (row.input?.compact_retrieved_evidence_pack ?? []).find((item) => !targetCitationSet.has(item.evidence_id) && /\d+(?:[,.]\d+)*(?:\.\d+)?%?/.test(item.text));
  if (!evidence) return null;
  return { evidence_id: evidence.evidence_id, claim: firstSentence(evidence.text) };
}

function firstSentence(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean)[0]?.slice(0, 300) ?? "";
}

function stripCitations(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim();
}

function ensureInlineCitations(answer, citations) {
  return `${stripCitations(answer)} ${normalizeCitations(citations).map((id) => `[${id}]`).join(" ")}`.replace(/\s+/g, " ").trim();
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation)).filter(Boolean);
}

function tokenList(text) {
  return String(text ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function countBy(rows, keyFn) {
  const counts = {};
  for (const row of rows) {
    const key = keyFn(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function sameList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function renderDatasetReadme(result) {
  return `# Targeted Grounded Construction Packet

Run: \`${result.run_id}\`

This packet is a deterministic transform of \`${sourcePacketRunId}\` after \`${taxonomyRunId}\`.

- SFT train: ${result.examples.current.sft_train}
- SFT validation: ${result.examples.current.sft_validation}
- DPO train: ${result.examples.current.dpo_train}
- DPO validation: ${result.examples.current.dpo_validation}
- Added targeted DPO train: ${result.construction.added_dpo_train}
- Added targeted DPO validation: ${result.construction.added_dpo_validation}

No OpenAI calls or GPU jobs were used to materialize this packet.
`;
}

function renderReport(result) {
  return `# Targeted Grounded Construction Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

This packet makes no OpenAI calls and launches no Prime job. It adds numeric/metric exactness and multi-citation synthesis DPO contrasts from repaired train/validation rows only.

## Source Motivation

- D392 status: \`${result.source_context.taxonomy_status}\`
- Candidate-absence grounded rows: ${result.source_context.taxonomy_summary.candidate_absence_gap_five_system_pool}
- Numeric/metric grounded targets: ${result.source_context.taxonomy_summary.by_answer_form.numeric_or_metric}
- Multi-citation grounded targets: ${result.source_context.taxonomy_summary.multi_citation_targets}

## Packet

- SFT train: ${result.examples.current.sft_train}
- SFT validation: ${result.examples.current.sft_validation}
- DPO train: ${result.examples.current.dpo_train}
- DPO validation: ${result.examples.current.dpo_validation}
- Added DPO train: ${result.construction.added_dpo_train}
- Added DPO validation: ${result.construction.added_dpo_validation}
- Added preference types: ${JSON.stringify(result.construction.added_preference_types)}
- Added target forms: ${JSON.stringify(result.construction.added_target_forms)}

## Validation

- Errors: ${result.validation.summary.errors}
- Added targeted train rows: ${result.validation.summary.added_targeted_train_rows}
- Added targeted validation rows: ${result.validation.summary.added_targeted_validation_rows}

## Decision

- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Run launch preflight next: ${result.decision.run_launch_preflight_next ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
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
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}
