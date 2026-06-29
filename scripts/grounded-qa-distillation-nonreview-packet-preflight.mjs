import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "nonreview-oracle-contrast-packet-preflight-2026-06-29-v1";
const packetRunId = args["packet-run-id"] ?? "nonreview-oracle-contrast-packet-2026-06-29-v1";
const maxPromptChars = numberArg(args["max-prompt-chars"], 12000);
const outputDir = path.join(runsDir, runId);
const packetDir = path.join(runsDir, packetRunId, "dataset");

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const packet = await readJson(path.join(runsDir, packetRunId, "result.json"));
const sftTrain = await readJsonl(path.join(packetDir, "sft_train.jsonl"));
const sftValidation = await readJsonl(path.join(packetDir, "sft_validation.jsonl"));
const dpoTrain = await readJsonl(path.join(packetDir, "dpo_train.jsonl"));
const dpoValidation = await readJsonl(path.join(packetDir, "dpo_validation.jsonl"));
const evalPrompts = await readJsonl(path.join(packetDir, "eval_prompts.jsonl"));
const evalTargets = await readJsonl(path.join(packetDir, "eval_targets_diagnostic.jsonl"));

const sftRows = [...sftTrain.map((row) => ({ split: "train", ...row })), ...sftValidation.map((row) => ({ split: "validation", ...row }))];
const dpoRows = [...dpoTrain.map((row) => ({ split: "train", ...row })), ...dpoValidation.map((row) => ({ split: "validation", ...row }))];
const sftAuditRows = sftRows.map(auditSftRow);
const dpoAuditRows = dpoRows.map(auditDpoRow);
const promptAuditRows = [...sftRows, ...dpoRows.map((row) => ({ ...row, messages: row.prompt })), ...evalPrompts.map((row) => ({ split: "fresh_eval", ...row }))]
  .map(auditPromptRow);

const fixtureGateRunId = `${runId}-oracle-fixture-gate`;
const fixtureGate = await runContractGate(fixtureGateRunId);

const metrics = {
  sft: summarizeSft(sftAuditRows),
  dpo: summarizeDpo(dpoAuditRows),
  prompts: summarizePrompts(promptAuditRows),
  eval: {
    prompts: evalPrompts.length,
    targets: evalTargets.length,
    prompt_target_id_match: setEqual(new Set(evalPrompts.map((row) => row.example_id)), new Set(evalTargets.map((row) => row.example_id))),
  },
  oracle_fixture_gate: fixtureGate.metrics,
};

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "nonreview_packet_preflight",
  status: statusFor(metrics),
  purpose: "Preflight the D437 non-review oracle contrast packet before any student training or GPU spend.",
  source_runs: {
    packet: packetRunId,
    oracle_fixture_gate: fixtureGateRunId,
  },
  max_prompt_chars: maxPromptChars,
  packet_status: packet.status,
  metrics,
  decision: decisionFor(metrics),
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
    note: "This preflight is local and calls no models.",
  },
  artifacts: {
    sft_audit_rows_jsonl: rel(path.join(outputDir, "sft_audit_rows.jsonl")),
    dpo_audit_rows_jsonl: rel(path.join(outputDir, "dpo_audit_rows.jsonl")),
    prompt_audit_rows_jsonl: rel(path.join(outputDir, "prompt_audit_rows.jsonl")),
    oracle_fixture_gate_result_json: rel(path.join(runsDir, fixtureGateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "sft_audit_rows.jsonl"), sftAuditRows);
await writeJsonl(path.join(outputDir, "dpo_audit_rows.jsonl"), dpoAuditRows);
await writeJsonl(path.join(outputDir, "prompt_audit_rows.jsonl"), promptAuditRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  metrics: result.metrics,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function auditSftRow(row) {
  const evidenceIds = new Set((row.input?.compact_retrieved_evidence_pack ?? []).map((item) => String(item.evidence_id)));
  const target = normalizePrediction(row.target);
  const validation = validateEvidenceFirst(target, evidenceIds);
  return {
    example_id: row.example_id,
    split: row.split,
    answer_type: target?.answer_type ?? null,
    parseable: Boolean(target),
    evidence_first_valid: validation.valid,
    evidence_first_errors: validation.errors,
    citations_inline: citationsInline(target),
    target_nonempty_when_grounded: target?.answer_type === "grounded_answer" ? String(target.answer ?? "").trim().length > 0 : true,
    target_empty_when_abstain: target?.answer_type === "abstain" ? String(target.answer ?? "").trim().length === 0 && !normalizeCitations(target.citations).length : true,
    prompt_chars: messagesChars(row.messages),
  };
}

function auditDpoRow(row) {
  const evidenceIds = new Set((row.input?.compact_retrieved_evidence_pack ?? []).map((item) => String(item.evidence_id)));
  const chosen = normalizePrediction(row.chosen_output ?? parseJson(row.chosen));
  const rejected = normalizePrediction(row.rejected_output ?? parseJson(row.rejected));
  const chosenValidation = validateEvidenceFirst(chosen, evidenceIds);
  const rejectedValidation = validateEvidenceFirst(rejected, evidenceIds);
  return {
    example_id: row.example_id,
    split: row.split,
    chosen_source: row.chosen_source,
    rejected_source: row.rejected_source,
    chosen_answer_type: chosen?.answer_type ?? null,
    rejected_answer_type: rejected?.answer_type ?? null,
    chosen_parseable: Boolean(chosen),
    rejected_parseable: Boolean(rejected),
    chosen_evidence_first_valid: chosenValidation.valid,
    chosen_evidence_first_errors: chosenValidation.errors,
    rejected_evidence_first_valid: rejectedValidation.valid,
    chosen_citations_inline: citationsInline(chosen),
    chosen_differs_from_rejected: JSON.stringify(chosen) !== JSON.stringify(rejected),
    prompt_chars: messagesChars(row.prompt),
  };
}

function auditPromptRow(row) {
  const chars = messagesChars(row.messages);
  return {
    example_id: row.example_id,
    split: row.split ?? row.source_split ?? "unknown",
    prompt_chars: chars,
    estimated_prompt_tokens: Math.ceil(chars / 4),
    over_prompt_char_limit: chars > maxPromptChars,
    evidence_count: row.input?.compact_retrieved_evidence_pack?.length ?? 0,
  };
}

function summarizeSft(rows) {
  return {
    rows: rows.length,
    parseable: count(rows, (row) => row.parseable),
    evidence_first_valid: count(rows, (row) => row.evidence_first_valid),
    citations_inline: count(rows, (row) => row.citations_inline),
    target_nonempty_when_grounded: count(rows, (row) => row.target_nonempty_when_grounded),
    target_empty_when_abstain: count(rows, (row) => row.target_empty_when_abstain),
    by_answer_type: countBy(rows.map((row) => row.answer_type)),
  };
}

function summarizeDpo(rows) {
  return {
    rows: rows.length,
    chosen_parseable: count(rows, (row) => row.chosen_parseable),
    rejected_parseable: count(rows, (row) => row.rejected_parseable),
    chosen_evidence_first_valid: count(rows, (row) => row.chosen_evidence_first_valid),
    chosen_citations_inline: count(rows, (row) => row.chosen_citations_inline),
    chosen_differs_from_rejected: count(rows, (row) => row.chosen_differs_from_rejected),
    rejected_evidence_first_valid: count(rows, (row) => row.rejected_evidence_first_valid),
    by_chosen_answer_type: countBy(rows.map((row) => row.chosen_answer_type)),
  };
}

function summarizePrompts(rows) {
  const lengths = rows.map((row) => row.prompt_chars).sort((a, b) => a - b);
  return {
    rows: rows.length,
    max_prompt_chars: lengths.at(-1) ?? 0,
    p95_prompt_chars: percentile(lengths, 0.95),
    max_estimated_prompt_tokens: Math.ceil((lengths.at(-1) ?? 0) / 4),
    over_prompt_char_limit: count(rows, (row) => row.over_prompt_char_limit),
    max_evidence_count: Math.max(...rows.map((row) => row.evidence_count), 0),
  };
}

function statusFor(metrics) {
  if (
    metrics.sft.rows > 0
    && metrics.sft.evidence_first_valid === metrics.sft.rows
    && metrics.sft.citations_inline === metrics.sft.rows
    && metrics.dpo.rows > 0
    && metrics.dpo.chosen_evidence_first_valid === metrics.dpo.rows
    && metrics.dpo.chosen_differs_from_rejected === metrics.dpo.rows
    && metrics.prompts.over_prompt_char_limit === 0
    && metrics.eval.prompt_target_id_match
    && metrics.oracle_fixture_gate.overall_contract_correct_rate === 1
  ) return "nonreview_packet_preflight_passed";
  return "nonreview_packet_preflight_failed";
}

function decisionFor(metrics) {
  const passed = statusFor(metrics) === "nonreview_packet_preflight_passed";
  return {
    launch_prime_now: false,
    buy_more_openai_labels_now: false,
    run_bounded_student_smoke_next: passed,
    reason: passed
      ? `Packet passed shape, prompt-length, and oracle-fixture gates; max prompt is ${metrics.prompts.max_prompt_chars} chars.`
      : "Packet failed at least one local preflight gate.",
    next_step: passed
      ? "Prepare a bounded local or Prime smoke plan with explicit estimated cost before launch."
      : "Fix packet shape or prompt-length issues before any model training.",
  };
}

async function runContractGate(gateRunId, predictionFile = null) {
  const commandArgs = [
    "scripts/grounded-qa-distillation-evidence-first-contract-preflight.mjs",
    `--packet-run-id=${packetRunId}`,
    `--run-id=${gateRunId}`,
  ];
  if (predictionFile) commandArgs.splice(2, 0, `--prediction-file=${predictionFile}`);
  const child = spawn(process.execPath, commandArgs, { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const code = await new Promise((resolve) => child.on("close", resolve));
  if (code !== 0) throw new Error(`Contract gate failed (${code}): ${stderr || stdout}`);
  return readJson(path.join(runsDir, gateRunId, "result.json"));
}

function validateEvidenceFirst(prediction, evidenceIds) {
  const errors = [];
  const ef = prediction?.evidence_first;
  if (!prediction) errors.push("missing prediction");
  if (!ef || typeof ef !== "object") errors.push("missing evidence_first");
  const claims = Array.isArray(ef?.supported_claims) ? ef.supported_claims : [];
  if (prediction?.answer_type === "grounded_answer") {
    if (ef?.sufficiency !== "sufficient") errors.push("grounded answer must be sufficient");
    if (!claims.length) errors.push("grounded answer needs supported_claims");
    const union = new Set();
    for (const claim of claims) {
      for (const id of normalizeCitations(claim.citations ?? [])) {
        union.add(id);
        if (!evidenceIds.has(id)) errors.push(`citation ${id} missing from evidence pack`);
      }
    }
    if (!setEqual(union, new Set(normalizeCitations(prediction.citations ?? [])))) errors.push("answer citations must equal claim citation union");
  } else if (prediction?.answer_type === "abstain") {
    if (ef?.sufficiency !== "insufficient") errors.push("abstention must be insufficient");
    if (claims.length) errors.push("abstention cannot have supported_claims");
    if (normalizeCitations(prediction.citations).length) errors.push("abstention cannot have citations");
    if (!ef?.missing_support || !prediction.abstention_reason) errors.push("abstention needs missing support");
  } else {
    errors.push("invalid answer_type");
  }
  return { valid: errors.length === 0, errors };
}

function citationsInline(prediction) {
  if (!prediction) return false;
  if (prediction.answer_type === "abstain") return true;
  return normalizeCitations(prediction.citations).every((id) => String(prediction.answer ?? "").includes(`[${id}]`));
}

function normalizePrediction(value) {
  if (!value || typeof value !== "object") return null;
  if (!["grounded_answer", "abstain"].includes(value.answer_type)) return null;
  return value;
}

function parseJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function messagesChars(messages) {
  return JSON.stringify(messages ?? []).length;
}

function renderReport(result) {
  return `# Non-Review Oracle Contrast Packet Preflight

Generated: ${result.generated_at}

Status: \`${result.status}\`

This local preflight checks the D437 packet before any student training or GPU spend.

## Shape

- SFT rows: ${result.metrics.sft.rows}
- DPO rows: ${result.metrics.dpo.rows}
- Eval prompts/targets: ${result.metrics.eval.prompts}/${result.metrics.eval.targets}
- SFT evidence-first valid: ${result.metrics.sft.evidence_first_valid}/${result.metrics.sft.rows}
- DPO chosen evidence-first valid: ${result.metrics.dpo.chosen_evidence_first_valid}/${result.metrics.dpo.rows}
- DPO chosen differs from rejected: ${result.metrics.dpo.chosen_differs_from_rejected}/${result.metrics.dpo.rows}

## Prompt Length

- Max prompt chars: ${result.metrics.prompts.max_prompt_chars}
- P95 prompt chars: ${result.metrics.prompts.p95_prompt_chars}
- Over limit (${result.max_prompt_chars}): ${result.metrics.prompts.over_prompt_char_limit}

## Fixture Gate

- Oracle fixture overall contract: ${pct(result.metrics.oracle_fixture_gate.overall_contract_correct_rate)}

## Decision

- Run bounded student smoke next: ${result.decision.run_bounded_student_smoke_next ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean);
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countBy(values) {
  const out = {};
  for (const value of values) out[value ?? "missing"] = (out[value ?? "missing"] ?? 0) + 1;
  return out;
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * p) - 1);
  return sortedValues[index];
}

function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

function numberArg(value, fallback) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`Invalid non-negative number: ${value}`);
  return number;
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
