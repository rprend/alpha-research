import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "support-boundary-schema-packet-frontier-repaired-v1";
const sourcePacketRunId = args["source-packet-run-id"] ?? "targeted-grounded-construction-packet-frontier-repaired-dpo-prompt-repaired-v1";
const schemaAuditRunId = args["schema-audit-run-id"] ?? "targeted-grounded-schema-normalization-audit-dpo-prompt-repaired-qwen3b-smoke-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const sourceDir = path.join(runsDir, sourcePacketRunId);
const sourceDatasetDir = path.join(sourceDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceResult = await readJson(path.join(sourceDir, "result.json"));
const schemaAudit = await readJson(path.join(runsDir, schemaAuditRunId, "result.json"));
const sourceRows = {
  sft_train: await readJsonl(path.join(sourceDatasetDir, "sft_train.jsonl")),
  sft_validation: await readJsonl(path.join(sourceDatasetDir, "sft_validation.jsonl")),
  dpo_train: await readJsonl(path.join(sourceDatasetDir, "dpo_train.jsonl")),
  dpo_validation: await readJsonl(path.join(sourceDatasetDir, "dpo_validation.jsonl")),
  eval_prompts: await readJsonl(path.join(sourceDatasetDir, "eval_prompts.jsonl")),
  eval_targets_diagnostic: await readJsonl(path.join(sourceDatasetDir, "eval_targets_diagnostic.jsonl")),
};

const trainContrasts = buildSchemaContrasts(sourceRows.sft_train, "train");
const validationContrasts = buildSchemaContrasts(sourceRows.sft_validation, "validation");
const packetRows = {
  sft_train: sourceRows.sft_train.map(tightenSftRow),
  sft_validation: sourceRows.sft_validation.map(tightenSftRow),
  dpo_train: [...sourceRows.dpo_train.map(tightenDpoRow), ...trainContrasts],
  dpo_validation: [...sourceRows.dpo_validation.map(tightenDpoRow), ...validationContrasts],
  eval_prompts: sourceRows.eval_prompts.map(tightenEvalPrompt),
  eval_targets_diagnostic: sourceRows.eval_targets_diagnostic,
};
const validation = validatePacket(packetRows);

for (const [name, rows] of Object.entries(packetRows)) {
  await writeJsonl(path.join(datasetDir, `${name}.jsonl`), rows);
}
await copyRunnerArtifacts();

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "support_boundary_schema_packet",
  status: validation.errors.length ? "support_boundary_schema_packet_invalid" : "support_boundary_schema_packet_ready_for_preflight",
  purpose: "Add targeted support-boundary schema contrasts after the repaired targeted-construction smoke showed valid JSON but malformed evidence_first, invalid answer_type aliases, and overclaimed abstentions.",
  source_runs: {
    source_packet: sourcePacketRunId,
    schema_normalization_audit: schemaAuditRunId,
  },
  base_model: "Qwen/Qwen2.5-3B-Instruct",
  estimated_gpu_cost_usd: 1,
  source_context: {
    source_packet_status: sourceResult.status,
    schema_audit_status: schemaAudit.status,
    schema_audit_metrics: schemaAudit.metrics,
  },
  construction: {
    prompt_tightened_for_schema_boundary: true,
    added_dpo_train: trainContrasts.length,
    added_dpo_validation: validationContrasts.length,
    added_preference_types: countBy([...trainContrasts, ...validationContrasts], (row) => row.label_source.type),
    added_target_answer_types: countBy([...trainContrasts, ...validationContrasts], (row) => row.chosen_output.answer_type),
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
      ? "Run launch preflight and length profile. Only consider a bounded Prime smoke if the packet remains under budget and the prompt-length risk is acceptable."
      : "Fix packet validation before any preflight or compute.",
    reason: validation.errors.length === 0
      ? "This packet targets the observed post-smoke contract failures directly instead of adding another selector over the same weak candidate surface."
      : "The support-boundary schema packet is malformed.",
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
    note: "Deterministic local transform of existing repaired train/validation artifacts and prior smoke failure taxonomy.",
  },
  artifacts: {
    sft_train_jsonl: rel(path.join(datasetDir, "sft_train.jsonl")),
    sft_validation_jsonl: rel(path.join(datasetDir, "sft_validation.jsonl")),
    dpo_train_jsonl: rel(path.join(datasetDir, "dpo_train.jsonl")),
    dpo_validation_jsonl: rel(path.join(datasetDir, "dpo_validation.jsonl")),
    eval_prompts_jsonl: rel(path.join(datasetDir, "eval_prompts.jsonl")),
    eval_targets_diagnostic_jsonl: rel(path.join(datasetDir, "eval_targets_diagnostic.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

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
  llm_budget: result.llm_budget,
}, null, 2));

function buildSchemaContrasts(rows, split) {
  const contrasts = [];
  for (const row of rows) {
    const target = normalizeTarget(row.target);
    const prompt = tightenPrompt(row.messages?.slice(0, 2) ?? [], row.input);
    if (target.answer_type === "abstain") {
      contrasts.push(dpoRow({
        source: row,
        split,
        type: "prefer_contract_abstention_over_cited_abstention_rationale",
        chosen: target,
        rejected: citedAbstentionRationale(row, target),
        prompt,
      }));
      if (isRiskyQuestion(row.input?.question)) {
        contrasts.push(dpoRow({
          source: row,
          split,
          type: "prefer_abstention_over_misclassified_partial_answer",
          chosen: target,
          rejected: misclassifiedPartialAnswer(row, target),
          prompt,
        }));
      }
    } else if (target.answer_type === "grounded_answer" && shouldAddGroundedSchemaContrast(row, target)) {
      contrasts.push(dpoRow({
        source: row,
        split,
        type: "prefer_grounded_evidence_first_over_empty_claims",
        chosen: target,
        rejected: emptyEvidenceFirstGrounded(row, target),
        prompt,
      }));
      contrasts.push(dpoRow({
        source: row,
        split,
        type: "prefer_supported_answer_over_false_insufficiency",
        chosen: target,
        rejected: falseInsufficiency(row, target),
        prompt,
      }));
    }
  }
  return contrasts;
}

function dpoRow({ source, split, type, chosen, rejected, prompt }) {
  return {
    example_id: `${source.example_id}:support-boundary-schema:${type}`,
    task: "citation_grounded_domain_qa_support_boundary_schema_dpo",
    prompt,
    chosen: JSON.stringify(chosen),
    rejected: JSON.stringify(rejected),
    chosen_output: chosen,
    rejected_output: rejected,
    input: source.input,
    label_source: {
      type,
      source_example_id: source.example_id,
      source_packet_run_id: sourcePacketRunId,
      schema_audit_run_id: schemaAuditRunId,
      split,
      uses_final_diagnostic_target: false,
    },
    curriculum_metadata: {
      ...(source.curriculum_metadata ?? {}),
      support_boundary_schema_packet: true,
    },
  };
}

function citedAbstentionRationale(row, target) {
  const evidence = firstEvidence(row);
  const claim = firstSentence(evidence?.text ?? target.abstention_reason ?? "The evidence is insufficient.");
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [{
        claim_id: "C1",
        claim,
        citations: [evidence?.evidence_id ?? "E1"],
        support_status: "rationale_not_answer",
      }],
      citations: [evidence?.evidence_id ?? "E1"],
      missing_support: target.evidence_first?.missing_support ?? target.abstention_reason ?? "Missing direct support for the exact target.",
      question_target: target.evidence_first?.question_target ?? row.input?.question ?? "exact_question_target",
    },
    answer: "Abstain",
    citations: [evidence?.evidence_id ?? "E1"],
    claim_table: [{ claim, support: "rationale_not_answer", citations: [evidence?.evidence_id ?? "E1"] }],
    abstention_reason: target.abstention_reason ?? "The evidence is insufficient.",
  };
}

function misclassifiedPartialAnswer(row, target) {
  const evidence = firstEvidence(row);
  const claim = firstSentence(evidence?.text ?? "The evidence appears relevant but does not answer the exact target.");
  return {
    answer_type: "grounded_answer",
    evidence_first: {
      sufficiency: "sufficient",
      supported_claims: [{ claim_id: "C1", claim, citations: [evidence?.evidence_id ?? "E1"], support_status: "partial_wrong_target" }],
      missing_support: "",
      question_target: target.evidence_first?.question_target ?? row.input?.question ?? "exact_question_target",
    },
    answer: claim,
    citations: [evidence?.evidence_id ?? "E1"],
    claim_table: [{ claim, support: "partial_wrong_target", citations: [evidence?.evidence_id ?? "E1"] }],
    abstention_reason: target.abstention_reason ?? "Only partial evidence is present.",
  };
}

function emptyEvidenceFirstGrounded(row, target) {
  return {
    answer_type: "grounded_answer",
    evidence_first: {},
    answer: stripCitations(target.answer),
    citations: normalizeCitations(target.citations),
    claim_table: [],
    abstention_reason: null,
  };
}

function falseInsufficiency(row, target) {
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: "The evidence is present but this rejected output incorrectly abstains instead of constructing the cited answer.",
      question_target: target.evidence_first?.question_target ?? row.input?.question ?? "exact_question_target",
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "Incorrect abstention: the target citations are present in the evidence pack.",
  };
}

function shouldAddGroundedSchemaContrast(row, target) {
  return normalizeCitations(target.citations).length > 1
    || /\d+(?:[,.]\d+)*(?:\.\d+)?%?/.test(target.answer ?? "")
    || isRiskyQuestion(row.input?.question);
}

function tightenSftRow(row) {
  return {
    ...row,
    messages: tightenPrompt(row.messages ?? [], row.input),
    curriculum_metadata: { ...(row.curriculum_metadata ?? {}), support_boundary_schema_packet: true },
  };
}

function tightenDpoRow(row) {
  return {
    ...row,
    prompt: tightenPrompt(row.prompt ?? row.messages?.slice(0, 2) ?? [], row.input),
    curriculum_metadata: { ...(row.curriculum_metadata ?? {}), support_boundary_schema_packet: true },
  };
}

function tightenEvalPrompt(row) {
  return {
    ...row,
    messages: tightenPrompt(row.messages ?? [], row.input),
    prompt: row.prompt ? tightenPrompt(row.prompt, row.input) : row.prompt,
  };
}

function tightenPrompt(messages, input) {
  const cloned = JSON.parse(JSON.stringify(messages ?? []));
  if (!cloned.length) return cloned;
  const addition = "Contract schema: answer_type must be grounded_answer or abstain. Abstentions use sufficiency=insufficient with empty supported_claims, citations, answer, and claim_table. Grounded answers need nonempty supported_claims and citations equal to the claim-citation union.";
  if (cloned[0]?.role === "system") cloned[0].content = appendOnce(cloned[0].content, addition.trim());
  const userIndex = cloned.findIndex((message) => message.role === "user");
  if (userIndex >= 0) {
    const form = classifyTargetForm(input?.question);
    cloned[userIndex].content = appendOnce(cloned[userIndex].content, `\nSupport-boundary hint: ${form}; invalid answer_type aliases and cited abstention rationales violate the contract.`);
  }
  return cloned;
}

async function copyRunnerArtifacts() {
  for (const file of [
    "validate_joint_action_dataset_uv.py",
    "train_joint_action_lora_uv.py",
    "eval_joint_action_adapter_uv.py",
    "run_joint_action_smoke.sh",
  ]) {
    let text = await fs.readFile(path.join(sourceDir, file), "utf8");
    text = text.replaceAll(sourcePacketRunId, runId);
    await fs.writeFile(path.join(outputDir, file), text);
    if (file.endsWith(".sh")) await fs.chmod(path.join(outputDir, file), 0o755);
  }
}

function validatePacket(rowsByName) {
  const errors = [];
  for (const name of ["sft_train", "sft_validation", "dpo_train", "dpo_validation", "eval_prompts", "eval_targets_diagnostic"]) {
    if (!Array.isArray(rowsByName[name]) || rowsByName[name].length === 0) errors.push(`${name} missing or empty`);
  }
  for (const [name, rows] of Object.entries(rowsByName)) {
    const ids = new Set();
    for (const row of rows) {
      if (!row.example_id) errors.push(`${name} row missing example_id`);
      if (ids.has(row.example_id)) errors.push(`${name} duplicate example_id ${row.example_id}`);
      ids.add(row.example_id);
      if (name.startsWith("dpo_")) {
        if (!Array.isArray(row.prompt) || !row.prompt.length) errors.push(`${name}:${row.example_id} missing prompt`);
        if (!row.chosen || !row.rejected) errors.push(`${name}:${row.example_id} missing chosen/rejected`);
      }
      if (name.startsWith("sft_") && (!Array.isArray(row.messages) || row.messages.length < 3)) errors.push(`${name}:${row.example_id} missing SFT messages`);
    }
  }
  return {
    errors,
    summary: Object.fromEntries(Object.entries(rowsByName).map(([name, rows]) => [name, rows.length])),
  };
}

function summarizeRows(rowsByName) {
  return Object.fromEntries(Object.entries(rowsByName).map(([name, rows]) => [name, rows.length]));
}

function normalizeTarget(target) {
  return JSON.parse(JSON.stringify(target ?? {}));
}

function firstEvidence(row) {
  return (row.input?.compact_retrieved_evidence_pack ?? [])[0] ?? null;
}

function firstSentence(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean)[0]?.slice(0, 260) ?? "The cited evidence is relevant but does not answer the exact target.";
}

function classifyTargetForm(question) {
  if (/\b(how many|how much|percent|percentage|score|rate|number|by how much)\b/i.test(question ?? "")) return "numeric_or_metric";
  if (/\b(which|list|what models|what assumptions|what datasets)\b/i.test(question ?? "")) return "list_or_multi_part";
  if (/^(does|do|did|is|are|was|were|can|could|should|would|has|have)\b/i.test(question ?? "")) return "yes_no_boundary";
  return "support_boundary";
}

function isRiskyQuestion(question) {
  return /\b(how many|how much|percent|percentage|score|rate|number|by how much|which are three|what models|what assumptions|compare|previous state.of.the.art)\b/i.test(question ?? "");
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation)).filter(Boolean);
}

function stripCitations(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim();
}

function appendOnce(text, addition) {
  const current = String(text ?? "");
  return current.includes(addition) ? current : `${current}\n\n${addition}`;
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

function renderReport(result) {
  return `# Support Boundary Schema Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

This packet makes no OpenAI calls and launches no compute.

## Construction

- Added DPO train rows: ${result.construction.added_dpo_train}
- Added DPO validation rows: ${result.construction.added_dpo_validation}
- Added preference types: ${JSON.stringify(result.construction.added_preference_types)}
- Eval prompts preserved: ${result.construction.eval_prompts_preserved ? "yes" : "no"}
- Eval targets preserved: ${result.construction.eval_targets_preserved ? "yes" : "no"}

## Examples

- SFT train: ${result.examples.current.sft_train}
- SFT validation: ${result.examples.current.sft_validation}
- DPO train: ${result.examples.current.dpo_train}
- DPO validation: ${result.examples.current.dpo_validation}
- Eval prompts: ${result.examples.current.eval_prompts}
- Eval targets: ${result.examples.current.eval_targets_diagnostic}

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
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
  return text.trim() ? text.trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
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
