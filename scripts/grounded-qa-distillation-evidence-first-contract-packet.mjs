import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet-run-id"] ?? "generation-gap-form-specific-construction-packet-d338-2026-06-28-v1";
const nextAuditRunId = args["next-audit-run-id"] ?? "next-intervention-audit-2026-06-28-v1";
const runId = args["run-id"] ?? "evidence-first-contract-packet-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const sourceDatasetDir = path.join(runsDir, sourcePacketRunId, "dataset");

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceResult = await readJson(path.join(runsDir, sourcePacketRunId, "result.json"));
const nextAudit = await readJson(path.join(runsDir, nextAuditRunId, "result.json"));
const sourceRows = {
  sft_train: await readJsonl(path.join(sourceDatasetDir, "sft_train.jsonl")),
  sft_validation: await readJsonl(path.join(sourceDatasetDir, "sft_validation.jsonl")),
  dpo_train: await readJsonl(path.join(sourceDatasetDir, "dpo_train.jsonl")),
  dpo_validation: await readJsonl(path.join(sourceDatasetDir, "dpo_validation.jsonl")),
  eval_prompts: await readJsonl(path.join(sourceDatasetDir, "eval_prompts.jsonl")),
  eval_targets_diagnostic: await readJsonl(path.join(sourceDatasetDir, "eval_targets_diagnostic.jsonl")),
};

const packetRows = {
  sft_train: sourceRows.sft_train.map((row) => evidenceFirstSft(row, "train")),
  sft_validation: sourceRows.sft_validation.map((row) => evidenceFirstSft(row, "validation")),
  dpo_train: sourceRows.dpo_train.map((row) => evidenceFirstDpo(row, "train")),
  dpo_validation: sourceRows.dpo_validation.map((row) => evidenceFirstDpo(row, "validation")),
  eval_prompts: sourceRows.eval_prompts.map(evidenceFirstEvalPrompt),
  eval_targets_diagnostic: sourceRows.eval_targets_diagnostic.map(evidenceFirstEvalTarget),
};

const validation = validatePacket(packetRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "evidence_first_contract_packet",
  status: validation.errors.length ? "evidence_first_contract_invalid" : "evidence_first_contract_ready_for_local_preflight",
  purpose: "Change the generation contract after selector-only and answer-first Qwen runs failed: require evidence sufficiency and cited claim planning before answer text.",
  source_runs: {
    source_packet_run_id: sourcePacketRunId,
    next_intervention_audit_run_id: nextAuditRunId,
  },
  source_context: {
    source_packet_status: sourceResult.status,
    next_audit_status: nextAudit.status,
    next_audit_decision: nextAudit.decision?.next_step,
  },
  contract: {
    output_keys: ["answer_type", "evidence_first", "answer", "citations", "claim_table", "abstention_reason"],
    evidence_first_keys: ["sufficiency", "supported_claims", "missing_support", "question_target"],
    rule: "The assistant must first emit cited supported_claims or missing_support, then compose answer text only from those claims.",
    grounded_answer_requirements: [
      "evidence_first.sufficiency must be sufficient",
      "supported_claims must be non-empty",
      "every supported claim must cite evidence ids from the compact evidence pack",
      "answer citations must equal the union of supported claim citations",
    ],
    abstention_requirements: [
      "evidence_first.sufficiency must be insufficient",
      "supported_claims must be empty",
      "citations must be empty",
      "missing_support and abstention_reason must be non-empty",
    ],
  },
  examples: {
    sft_train: packetRows.sft_train.length,
    sft_validation: packetRows.sft_validation.length,
    dpo_train: packetRows.dpo_train.length,
    dpo_validation: packetRows.dpo_validation.length,
    eval_prompts: packetRows.eval_prompts.length,
    eval_targets_diagnostic: packetRows.eval_targets_diagnostic.length,
  },
  validation,
  decision: {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    run_local_shape_preflight_next: validation.errors.length === 0,
    use_as_next_paid_packet_after_preflight: false,
    reason: validation.errors.length === 0
      ? "The packet passes the evidence-first shape contract locally, but it still needs a local/fixture model-output preflight before any Prime spend."
      : "The packet failed local shape validation and cannot be used.",
  },
  leakage_guard: {
    final_diagnostic_targets_used_for_training: false,
    source_final_eval_prompts_unchanged_count: packetRows.eval_prompts.length,
    eval_targets_diagnostic_preserved_for_eval_only: true,
    next_audit_used_for_decision_only: true,
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "This packet is a deterministic local transform of existing artifacts.",
  },
  artifacts: {
    sft_train_jsonl: rel(path.join(datasetDir, "sft_train.jsonl")),
    sft_validation_jsonl: rel(path.join(datasetDir, "sft_validation.jsonl")),
    dpo_train_jsonl: rel(path.join(datasetDir, "dpo_train.jsonl")),
    dpo_validation_jsonl: rel(path.join(datasetDir, "dpo_validation.jsonl")),
    eval_prompts_jsonl: rel(path.join(datasetDir, "eval_prompts.jsonl")),
    eval_targets_diagnostic_jsonl: rel(path.join(datasetDir, "eval_targets_diagnostic.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(datasetDir, "sft_train.jsonl"), packetRows.sft_train);
await writeJsonl(path.join(datasetDir, "sft_validation.jsonl"), packetRows.sft_validation);
await writeJsonl(path.join(datasetDir, "dpo_train.jsonl"), packetRows.dpo_train);
await writeJsonl(path.join(datasetDir, "dpo_validation.jsonl"), packetRows.dpo_validation);
await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), packetRows.eval_prompts);
await writeJsonl(path.join(datasetDir, "eval_targets_diagnostic.jsonl"), packetRows.eval_targets_diagnostic);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  examples: result.examples,
  validation: result.validation.summary,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function evidenceFirstSft(row, split) {
  const target = evidenceFirstOutput(row.target ?? parseJson(row.messages?.[2]?.content));
  return {
    ...row,
    task: "citation_grounded_domain_qa_evidence_first_sft",
    messages: [
      { role: "system", content: evidenceFirstSystemPrompt() },
      { role: "user", content: evidenceFirstUserContent(row.messages?.[1]?.content, row.input) },
      { role: "assistant", content: JSON.stringify(target) },
    ],
    target,
    label_source: {
      ...(row.label_source ?? {}),
      type: "evidence_first_contract_sft",
      source_packet_run_id: sourcePacketRunId,
      split,
    },
  };
}

function evidenceFirstDpo(row, split) {
  const chosen = evidenceFirstOutput(row.chosen_output ?? parseJson(row.chosen));
  const rejected = evidenceFirstOutput(row.rejected_output ?? parseJson(row.rejected));
  return {
    ...row,
    task: "citation_grounded_domain_qa_evidence_first_dpo",
    prompt: [
      { role: "system", content: evidenceFirstSystemPrompt() },
      { role: "user", content: evidenceFirstUserContent(row.prompt?.[1]?.content, row.input) },
    ],
    chosen: JSON.stringify(chosen),
    rejected: JSON.stringify(rejected),
    chosen_output: chosen,
    rejected_output: rejected,
    label_source: {
      ...(row.label_source ?? {}),
      source_packet_run_id: sourcePacketRunId,
      evidence_first_contract: true,
      split,
    },
  };
}

function evidenceFirstEvalPrompt(row) {
  return {
    ...row,
    messages: [
      { role: "system", content: evidenceFirstSystemPrompt() },
      { role: "user", content: evidenceFirstUserContent(row.messages?.[1]?.content, row.input) },
    ],
    eval_contract: "evidence_first_v1",
  };
}

function evidenceFirstEvalTarget(row) {
  return {
    ...row,
    target: evidenceFirstOutput(row.target),
    eval_contract: "evidence_first_v1",
  };
}

function evidenceFirstOutput(value) {
  const answerType = value?.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const claimTable = Array.isArray(value?.claim_table) ? value.claim_table : [];
  const citations = normalizeCitations(value?.citations ?? []);
  const supportedClaims = answerType === "grounded_answer"
    ? (claimTable.length ? claimTable : [{ claim: stripCitations(value?.answer ?? ""), citations }]).map((claim, index) => ({
      claim_id: `C${index + 1}`,
      claim: String(claim.claim ?? stripCitations(value?.answer ?? "")),
      citations: normalizeCitations(claim.citations ?? citations),
      support_status: "supported",
    })).filter((claim) => claim.claim && claim.citations.length)
    : [];
  const missingSupport = answerType === "abstain"
    ? String(value?.abstention_reason ?? value?.answer ?? "Evidence is insufficient to answer the exact question target.")
    : "";
  return {
    answer_type: answerType,
    evidence_first: {
      sufficiency: answerType === "grounded_answer" ? "sufficient" : "insufficient",
      supported_claims: supportedClaims,
      missing_support: missingSupport,
      question_target: "exact_question_target",
    },
    answer: String(value?.answer ?? ""),
    citations: answerType === "grounded_answer" ? citations : [],
    claim_table: answerType === "grounded_answer" ? supportedClaims.map((claim) => ({
      claim: claim.claim,
      support: "supported",
      citations: claim.citations,
    })) : [],
    abstention_reason: answerType === "abstain" ? missingSupport : null,
  };
}

function evidenceFirstSystemPrompt() {
  return [
    "Answer using only the compact evidence pack.",
    "Return valid JSON only with keys answer_type, evidence_first, answer, citations, claim_table, and abstention_reason.",
    "Before writing answer text, fill evidence_first with sufficiency, supported_claims, missing_support, and question_target.",
    "For grounded_answer, supported_claims must cite evidence ids from the pack, and answer text may only restate those supported_claims with inline citations.",
    "For abstain, supported_claims and citations must be empty, and missing_support must name the exact unsupported target.",
    "Do not use nearby but wrong-target facts, citation-only answers, empty claim tables, or unsupported synthesis.",
  ].join(" ");
}

function evidenceFirstUserContent(content, input) {
  return [
    String(content ?? ""),
    "",
    "Evidence-first contract:",
    "1. Decide sufficiency for the exact question target.",
    "2. If sufficient, write cited supported_claims first.",
    "3. Compose the answer only from supported_claims.",
    "4. If insufficient, abstain and name the missing support.",
    `Question target: ${input?.question ?? "unknown"}`,
  ].join("\n");
}

function validatePacket(rows) {
  const errors = [];
  const evalPromptById = new Map(rows.eval_prompts.map((row) => [row.example_id, row]));
  for (const split of ["sft_train", "sft_validation"]) {
    rows[split].forEach((row, index) => validateOutput(row.target, row.input, `${split}:${index}`, errors));
  }
  for (const split of ["dpo_train", "dpo_validation"]) {
    rows[split].forEach((row, index) => {
      validateOutput(row.chosen_output, row.input, `${split}:${index}:chosen`, errors);
      validateOutput(row.rejected_output, row.input, `${split}:${index}:rejected`, errors);
    });
  }
  rows.eval_targets_diagnostic.forEach((row, index) => {
    const prompt = evalPromptById.get(row.example_id);
    validateOutput(row.target, prompt?.input, `eval_targets:${index}`, errors);
  });
  return {
    errors: errors.slice(0, 20),
    summary: {
      checked_sft_rows: rows.sft_train.length + rows.sft_validation.length,
      checked_dpo_outputs: 2 * (rows.dpo_train.length + rows.dpo_validation.length),
      checked_eval_targets: rows.eval_targets_diagnostic.length,
      error_count: errors.length,
    },
  };
}

function validateOutput(output, input, label, errors) {
  const evidenceIds = new Set((input?.compact_retrieved_evidence_pack ?? []).map((item) => item.evidence_id));
  if (!["grounded_answer", "abstain"].includes(output?.answer_type)) errors.push(`${label}: invalid answer_type`);
  if (!output?.evidence_first || typeof output.evidence_first !== "object") errors.push(`${label}: missing evidence_first`);
  const claims = output?.evidence_first?.supported_claims ?? [];
  if (output?.answer_type === "grounded_answer") {
    if (output.evidence_first?.sufficiency !== "sufficient") errors.push(`${label}: grounded answer must be sufficient`);
    if (!claims.length) errors.push(`${label}: grounded answer needs supported_claims`);
    const claimCitationUnion = new Set();
    for (const claim of claims) {
      if (!claim.claim) errors.push(`${label}: supported claim missing text`);
      for (const id of normalizeCitations(claim.citations ?? [])) {
        claimCitationUnion.add(id);
        if (!evidenceIds.has(id)) errors.push(`${label}: claim citation ${id} missing from evidence pack`);
      }
    }
    const answerCitations = new Set(normalizeCitations(output.citations ?? []));
    if (!setEqual(answerCitations, claimCitationUnion)) errors.push(`${label}: answer citations must equal supported claim citation union`);
  } else {
    if (output.evidence_first?.sufficiency !== "insufficient") errors.push(`${label}: abstention must be insufficient`);
    if (claims.length) errors.push(`${label}: abstention cannot have supported_claims`);
    if ((output.citations ?? []).length) errors.push(`${label}: abstention cannot have citations`);
    if (!output.evidence_first?.missing_support || !output.abstention_reason) errors.push(`${label}: abstention needs missing_support and abstention_reason`);
  }
}

function renderReport(result) {
  return `# Evidence-First Contract Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Data

- SFT train: ${result.examples.sft_train}
- SFT validation: ${result.examples.sft_validation}
- DPO train: ${result.examples.dpo_train}
- DPO validation: ${result.examples.dpo_validation}
- Eval prompts: ${result.examples.eval_prompts}
- Eval targets: ${result.examples.eval_targets_diagnostic}

## Validation

- Checked SFT rows: ${result.validation.summary.checked_sft_rows}
- Checked DPO outputs: ${result.validation.summary.checked_dpo_outputs}
- Checked eval targets: ${result.validation.summary.checked_eval_targets}
- Error count: ${result.validation.summary.error_count}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Run local shape preflight next: ${result.decision.run_local_shape_preflight_next ? "yes" : "no"}
- Reason: ${result.decision.reason}

This packet makes no API calls and launches no compute.
`;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean);
}

function stripCitations(text) {
  return String(text ?? "").replace(/\s*\[[^\]]+\]/g, "").trim();
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
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

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
