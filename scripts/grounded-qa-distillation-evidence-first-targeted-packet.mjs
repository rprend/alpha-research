import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet-run-id"] ?? "evidence-first-contract-packet-2026-06-28-v1";
const repairAuditRunId = args["repair-audit-run-id"] ?? "evidence-first-contract-repair-audit-qwen3b-smoke-v1";
const runId = args["run-id"] ?? "evidence-first-targeted-contract-packet-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const sourceDatasetDir = path.join(runsDir, sourcePacketRunId, "dataset");

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceResult = await readJson(path.join(runsDir, sourcePacketRunId, "result.json"));
const repairAudit = await readJson(path.join(runsDir, repairAuditRunId, "result.json"));
const sourceRows = {
  sft_train: await readJsonl(path.join(sourceDatasetDir, "sft_train.jsonl")),
  sft_validation: await readJsonl(path.join(sourceDatasetDir, "sft_validation.jsonl")),
  dpo_train: await readJsonl(path.join(sourceDatasetDir, "dpo_train.jsonl")),
  dpo_validation: await readJsonl(path.join(sourceDatasetDir, "dpo_validation.jsonl")),
  eval_prompts: await readJsonl(path.join(sourceDatasetDir, "eval_prompts.jsonl")),
  eval_targets_diagnostic: await readJsonl(path.join(sourceDatasetDir, "eval_targets_diagnostic.jsonl")),
};

const augmentedTrain = buildAugmentedDpo(sourceRows.sft_train, "train");
const augmentedValidation = buildAugmentedDpo(sourceRows.sft_validation, "validation");
const packetRows = {
  sft_train: sourceRows.sft_train.map(shortenSftTarget),
  sft_validation: sourceRows.sft_validation.map(shortenSftTarget),
  dpo_train: dedupeDpo([...sourceRows.dpo_train, ...augmentedTrain]),
  dpo_validation: dedupeDpo([...sourceRows.dpo_validation, ...augmentedValidation]),
  eval_prompts: sourceRows.eval_prompts,
  eval_targets_diagnostic: sourceRows.eval_targets_diagnostic,
};

const validation = validatePacket(packetRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "evidence_first_targeted_contract_packet",
  status: validation.errors.length ? "evidence_first_targeted_packet_invalid" : "evidence_first_targeted_packet_ready_for_launch_packet",
  purpose: "Convert the failed evidence-first Qwen 3B smoke into a non-final, failure-targeted training packet focused on answerability, citation selection, and schema-constrained supported claims.",
  source_runs: {
    source_packet_run_id: sourcePacketRunId,
    repair_audit_run_id: repairAuditRunId,
  },
  source_context: {
    source_packet_status: sourceResult.status,
    repair_audit_status: repairAudit.status,
    repair_audit_next_step: repairAudit.decision?.next_step,
    observed_failure_modes: repairAudit.taxonomy?.source_gate_error_counts,
  },
  construction: {
    target_simplification: "Grounded answers are rewritten as short claim text plus inline citations derived from supported_claims; abstentions remain explicit insufficient-support outputs.",
    augmented_negative_types: [
      "empty_grounded_answer",
      "string_claims_without_citation_objects",
      "missing_inline_answer_citations",
      "answerability_flip",
      "wrong_evidence_citation_when_available",
    ],
    augmented_train_rows: augmentedTrain.length,
    augmented_validation_rows: augmentedValidation.length,
    final_diagnostic_targets_used_for_training: false,
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
    materialize_launch_packet_next: validation.errors.length === 0,
    reason: validation.errors.length === 0
      ? "The packet is valid and targets the failure modes from D368, but it still needs a launch-packet preflight before any paid Prime run."
      : "The targeted packet failed local validation and cannot be used.",
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
    note: "This packet is a deterministic local transform of existing non-final training rows and the zero-spend repair audit.",
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
  construction: result.construction,
  validation: result.validation.summary,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function shortenSftTarget(row) {
  const target = canonicalOutput(row.target);
  return {
    ...row,
    target,
    messages: [
      row.messages?.[0] ?? { role: "system", content: "" },
      row.messages?.[1] ?? { role: "user", content: "" },
      { role: "assistant", content: JSON.stringify(target) },
    ],
    label_source: {
      ...(row.label_source ?? {}),
      source_packet_run_id: sourcePacketRunId,
      targeted_contract_packet: runId,
      target_simplification: "short_claim_answer_with_inline_citations",
    },
  };
}

function buildAugmentedDpo(rows, split) {
  const augmented = [];
  for (const row of rows) {
    const chosen = canonicalOutput(row.target);
    for (const rejected of rejectionVariants(chosen, row.input)) {
      augmented.push({
        example_id: `${row.example_id}:${rejected.negative_type}`,
        task: "citation_grounded_domain_qa_evidence_first_targeted_dpo",
        prompt: [
          row.messages?.[0] ?? { role: "system", content: "" },
          row.messages?.[1] ?? { role: "user", content: "" },
        ],
        input: row.input,
        chosen: JSON.stringify(chosen),
        rejected: JSON.stringify(rejected.output),
        chosen_output: chosen,
        rejected_output: rejected.output,
        label_source: {
          source_packet_run_id: sourcePacketRunId,
          repair_audit_run_id: repairAuditRunId,
          targeted_contract_packet: runId,
          negative_type: rejected.negative_type,
          split,
        },
      });
    }
  }
  return augmented;
}

function rejectionVariants(chosen, input) {
  const variants = [];
  const evidenceIds = (input?.compact_retrieved_evidence_pack ?? []).map((row) => row.evidence_id);
  const chosenCitations = normalizeCitations(chosen.citations ?? []);
  if (chosen.answer_type === "grounded_answer") {
    variants.push({
      negative_type: "empty_grounded_answer",
      output: {
        ...chosen,
        evidence_first: { ...chosen.evidence_first, supported_claims: [], missing_support: "none" },
        answer: "",
        citations: [],
        claim_table: [],
      },
    });
    variants.push({
      negative_type: "string_claims_without_citation_objects",
      output: {
        ...chosen,
        evidence_first: {
          ...chosen.evidence_first,
          supported_claims: chosen.evidence_first.supported_claims.map((claim) => claim.claim),
        },
        claim_table: chosen.claim_table.map((claim) => ({ claim: claim.claim })),
      },
    });
    variants.push({
      negative_type: "missing_inline_answer_citations",
      output: {
        ...chosen,
        answer: stripInlineCitations(chosen.answer),
      },
    });
    variants.push({
      negative_type: "answerability_flip",
      output: abstentionOutput(input, "The model abstained despite cited supported claims being present."),
    });
    const wrongCitation = evidenceIds.find((id) => !chosenCitations.includes(id));
    if (wrongCitation) {
      variants.push({
        negative_type: "wrong_evidence_citation_when_available",
        output: {
          ...chosen,
          evidence_first: {
            ...chosen.evidence_first,
            supported_claims: chosen.evidence_first.supported_claims.map((claim) => ({ ...claim, citations: [wrongCitation] })),
          },
          answer: `${stripInlineCitations(chosen.answer)} [${wrongCitation}]`,
          citations: [wrongCitation],
          claim_table: chosen.claim_table.map((claim) => ({ ...claim, citations: [wrongCitation] })),
        },
      });
    }
  } else {
    variants.push({
      negative_type: "answerability_flip",
      output: {
        answer_type: "grounded_answer",
        evidence_first: {
          sufficiency: "sufficient",
          supported_claims: [],
          missing_support: "none",
          question_target: input?.question ?? "exact_question_target",
        },
        answer: "",
        citations: [],
        claim_table: [],
        abstention_reason: null,
      },
    });
    variants.push({
      negative_type: "abstention_missing_support_reason",
      output: {
        ...chosen,
        evidence_first: { ...chosen.evidence_first, missing_support: "" },
        abstention_reason: "",
      },
    });
  }
  return variants;
}

function canonicalOutput(value) {
  if (value?.answer_type === "abstain") {
    return abstentionOutput(null, value.abstention_reason || value.evidence_first?.missing_support || value.answer);
  }
  const claims = Array.isArray(value?.evidence_first?.supported_claims) ? value.evidence_first.supported_claims : [];
  const canonicalClaims = claims.length ? claims.map((claim, index) => ({
    claim_id: claim.claim_id ?? `C${index + 1}`,
    claim: stripInlineCitations(claim.claim ?? ""),
    citations: normalizeCitations(claim.citations ?? value.citations ?? []),
    support_status: "supported",
  })).filter((claim) => claim.claim && claim.citations.length) : [{
    claim_id: "C1",
    claim: stripInlineCitations(value?.answer ?? ""),
    citations: normalizeCitations(value?.citations ?? []),
    support_status: "supported",
  }];
  const citations = unique(canonicalClaims.flatMap((claim) => claim.citations));
  const answerText = canonicalClaims.map((claim) => claim.claim).join("; ");
  return {
    answer_type: "grounded_answer",
    evidence_first: {
      sufficiency: "sufficient",
      supported_claims: canonicalClaims,
      missing_support: "",
      question_target: "exact_question_target",
    },
    answer: `${answerText} ${citations.map((id) => `[${id}]`).join(" ")}`.trim(),
    citations,
    claim_table: canonicalClaims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function abstentionOutput(input, reason) {
  const missingSupport = String(reason || "The evidence pack does not contain enough support to answer this question.");
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: missingSupport,
      question_target: input?.question ?? "exact_question_target",
    },
    answer: "The evidence pack does not contain enough support to answer this question.",
    citations: [],
    claim_table: [],
    abstention_reason: missingSupport,
  };
}

function validatePacket(rows) {
  const errors = [];
  for (const split of ["sft_train", "sft_validation"]) {
    rows[split].forEach((row, index) => validateOutput(row.target, row.input, `${split}:${index}`, errors));
  }
  for (const split of ["dpo_train", "dpo_validation"]) {
    rows[split].forEach((row, index) => {
      validateOutput(row.chosen_output, row.input, `${split}:${index}:chosen`, errors);
      if (!row.rejected_output || typeof row.rejected_output !== "object") errors.push(`${split}:${index}: missing rejected_output`);
      if (JSON.stringify(row.chosen_output) === JSON.stringify(row.rejected_output)) errors.push(`${split}:${index}: identical preference`);
    });
  }
  rows.eval_targets_diagnostic.forEach((row, index) => validateOutput(row.target, rows.eval_prompts[index]?.input, `eval:${index}`, errors));
  const finalIds = new Set(rows.eval_targets_diagnostic.map((row) => row.example_id));
  const leaked = rows.dpo_train.some((row) => finalIds.has(String(row.example_id ?? "").split(":")[0]));
  if (leaked) errors.push("final diagnostic example leaked into DPO train");
  return {
    errors: errors.slice(0, 20),
    summary: {
      checked_sft_rows: rows.sft_train.length + rows.sft_validation.length,
      checked_dpo_preferences: rows.dpo_train.length + rows.dpo_validation.length,
      checked_eval_targets: rows.eval_targets_diagnostic.length,
      error_count: errors.length,
    },
  };
}

function validateOutput(output, input, label, errors) {
  const evidenceIds = new Set((input?.compact_retrieved_evidence_pack ?? []).map((item) => item.evidence_id));
  const claims = output?.evidence_first?.supported_claims ?? [];
  if (output?.answer_type === "grounded_answer") {
    if (output.evidence_first?.sufficiency !== "sufficient") errors.push(`${label}: grounded answer must be sufficient`);
    if (!claims.length) errors.push(`${label}: grounded answer needs claims`);
    const union = new Set();
    for (const claim of claims) {
      if (!claim.claim) errors.push(`${label}: claim missing text`);
      for (const id of normalizeCitations(claim.citations ?? [])) {
        union.add(id);
        if (evidenceIds.size && !evidenceIds.has(id)) errors.push(`${label}: citation ${id} missing from evidence pack`);
      }
    }
    if (!setEqual(union, new Set(normalizeCitations(output.citations ?? [])))) errors.push(`${label}: citation union mismatch`);
    if (!normalizeCitations(output.citations ?? []).every((id) => output.answer.includes(`[${id}]`))) errors.push(`${label}: answer missing inline citations`);
  } else if (output?.answer_type === "abstain") {
    if (output.evidence_first?.sufficiency !== "insufficient") errors.push(`${label}: abstention must be insufficient`);
    if (claims.length) errors.push(`${label}: abstention cannot include claims`);
    if ((output.citations ?? []).length) errors.push(`${label}: abstention cannot include citations`);
    if (!output.evidence_first?.missing_support || !output.abstention_reason) errors.push(`${label}: abstention missing reason`);
  } else {
    errors.push(`${label}: invalid answer_type`);
  }
}

function dedupeDpo(rows) {
  const seen = new Set();
  const deduped = [];
  for (const row of rows) {
    if (JSON.stringify(row.chosen_output) === JSON.stringify(row.rejected_output)) continue;
    const key = `${JSON.stringify(row.prompt)}\n${row.chosen}\n${row.rejected}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

function stripInlineCitations(text) {
  return String(text ?? "").replace(/\s*\[E\d+\]/g, "").trim();
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => {
    const raw = typeof citation === "string" ? citation : String(citation?.evidence_id ?? citation?.id ?? citation ?? "");
    const match = raw.match(/\bE\d+\b/);
    return match ? match[0] : "";
  }).filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function renderReport(result) {
  return `# Evidence-First Targeted Contract Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Source

- Source packet: \`${result.source_runs.source_packet_run_id}\`
- Repair audit: \`${result.source_runs.repair_audit_run_id}\`
- Repair audit status: \`${result.source_context.repair_audit_status}\`

## Construction

- Target simplification: ${result.construction.target_simplification}
- Augmented train rows: ${result.construction.augmented_train_rows}
- Augmented validation rows: ${result.construction.augmented_validation_rows}
- Final diagnostic targets used for training: ${result.construction.final_diagnostic_targets_used_for_training ? "yes" : "no"}

## Data

- SFT train: ${result.examples.sft_train}
- SFT validation: ${result.examples.sft_validation}
- DPO train: ${result.examples.dpo_train}
- DPO validation: ${result.examples.dpo_validation}
- Eval prompts: ${result.examples.eval_prompts}
- Eval targets: ${result.examples.eval_targets_diagnostic}

## Validation

- Checked SFT rows: ${result.validation.summary.checked_sft_rows}
- Checked DPO preferences: ${result.validation.summary.checked_dpo_preferences}
- Checked eval targets: ${result.validation.summary.checked_eval_targets}
- Error count: ${result.validation.summary.error_count}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Materialize launch packet next: ${result.decision.materialize_launch_packet_next ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
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
