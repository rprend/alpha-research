import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "generation-gap-curriculum-packet-d320-final-gaps-2026-06-28-v1";
const failurePacketRunId = args["failure-packet-run-id"] ?? "generation-gap-failure-driven-packet-d329-2026-06-28-v1";
const targetRelevanceRunId = args["target-relevance-run-id"] ?? "generation-gap-target-relevance-audit-d336-2026-06-28-v1";
const runId = args["run-id"] ?? "generation-gap-answer-construction-signal-audit-d337-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const packetDir = path.join(runsDir, packetRunId, "dataset");
const d329Dir = path.join(runsDir, failurePacketRunId, "dataset");
const prompts = await readJsonl(path.join(packetDir, "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(packetDir, "eval_targets_diagnostic.jsonl"));
const dpoTrain = await readJsonl(path.join(d329Dir, "dpo_train.jsonl"));
const dpoValidation = await readJsonl(path.join(d329Dir, "dpo_validation.jsonl"));
const d336 = await readJson(path.join(runsDir, targetRelevanceRunId, "result.json"));
const oracleRows = new Map((d336.summary?.oracle_ceiling?.rows ?? []).map((row) => [row.example_id, row]));

const targetRows = targets.map((row) => {
  const prompt = prompts.find((candidate) => candidate.example_id === row.example_id);
  const form = classifyTargetForm(prompt, row.target);
  const oracle = oracleRows.get(row.example_id);
  return {
    example_id: row.example_id,
    question: prompt?.input?.question ?? "",
    target_answer_type: row.target.answer_type,
    target_form: form,
    citations: row.target.citations ?? [],
    d336_span_recoverable: oracle?.recoverable ?? null,
    d336_best_f1: oracle?.best_f1 ?? null,
    d336_best_citation_overlap: oracle?.best_citation_overlap ?? null,
  };
});

const d329Signals = summarizeD329Signals([...dpoTrain, ...dpoValidation]);
const finalFormSummary = countBy(targetRows, (row) => row.target_form);
const nonrecoverableRows = targetRows.filter((row) => row.target_answer_type === "grounded_answer" && row.d336_span_recoverable === false);
const nonrecoverableFormSummary = countBy(nonrecoverableRows, (row) => row.target_form);
const missingSignals = inferMissingSignals(d329Signals, nonrecoverableFormSummary);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "generation_gap_answer_construction_signal_audit",
  status: "answer_construction_signal_gap_identified",
  purpose: "Determine whether the existing D329 generation-gap curriculum contains the answer-construction signals required by the D336 target-relevance failures.",
  packet_run_id: packetRunId,
  failure_packet_run_id: failurePacketRunId,
  target_relevance_run_id: targetRelevanceRunId,
  summary: {
    eval_examples: targetRows.length,
    eval_answerable_examples: targetRows.filter((row) => row.target_answer_type === "grounded_answer").length,
    d336_answerable_span_recoverable: targetRows.filter((row) => row.target_answer_type === "grounded_answer" && row.d336_span_recoverable === true).length,
    d336_answerable_span_nonrecoverable: nonrecoverableRows.length,
    final_target_forms: finalFormSummary,
    nonrecoverable_target_forms: nonrecoverableFormSummary,
    d329_dpo_signals: d329Signals,
    missing_training_signals: missingSignals,
  },
  decision: {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    next_step: "Materialize a generation-gap answer-construction packet with explicit yes/no polarity, multi-citation synthesis, and question-target hard-negative preferences before any new Prime run.",
    reason: "D329 contains broad short-answer and overcitation negatives, but D336 failures need form-specific construction signals that are absent from the existing packet.",
  },
  leakage_guard: {
    final_targets_used_for_training: false,
    final_targets_used_for_diagnostic_form_audit: true,
    d329_training_rows_modified: false,
    d336_oracle_used_for_training: false,
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
    note: "Local deterministic signal audit only.",
  },
  rows: targetRows,
};

await fs.writeFile(path.join(outputDir, "target_form_rows.jsonl"), `${targetRows.map((row) => JSON.stringify(row)).join("\n")}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  summary: result.summary,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function classifyTargetForm(prompt, target) {
  if (target.answer_type === "abstain") return "abstention";
  const answer = stripCitations(target.answer);
  const question = String(prompt?.input?.question ?? "");
  const citations = target.citations ?? [];
  if (/^(yes|no)\b[.!]?$/i.test(answer.trim()) || /\b(does|do|did|is|are|was|were|can|could|should|would|has|have)\b/i.test(question) && /^(yes|no)\b/i.test(answer.trim())) {
    return "yes_no_polarity";
  }
  if (citations.length > 1) return "multi_citation_synthesis";
  if (/[;:]|\b( and |, )\b/i.test(answer) && answer.split(/\s+/).length >= 8) return "list_or_structured_answer";
  return "single_span_answer";
}

function summarizeD329Signals(rows) {
  const typeCounts = countBy(rows, (row) => row.label_source?.type ?? "unknown");
  const typeNames = Object.keys(typeCounts);
  return {
    total_dpo_rows: rows.length,
    preference_type_counts: typeCounts,
    has_short_answer_negative: typeNames.some((type) => /too_short|short_answer/i.test(type)),
    has_overcitation_negative: typeNames.some((type) => /overcit/i.test(type)),
    has_abstention_negative: typeNames.some((type) => /spurious|abstention/i.test(type)),
    has_yes_no_polarity_signal: typeNames.some((type) => /yes_no|polarity/i.test(type)),
    has_multi_citation_synthesis_signal: typeNames.some((type) => /multi.*citation|synthesis/i.test(type)),
    has_question_target_hard_negative_signal: typeNames.some((type) => /question.*target|mismatch/i.test(type)),
  };
}

function inferMissingSignals(signals, nonrecoverableFormSummary) {
  const missing = [];
  if ((nonrecoverableFormSummary.yes_no_polarity ?? 0) > 0 && !signals.has_yes_no_polarity_signal) {
    missing.push("yes_no_polarity_preferences");
  }
  if ((nonrecoverableFormSummary.multi_citation_synthesis ?? 0) > 0 && !signals.has_multi_citation_synthesis_signal) {
    missing.push("multi_citation_synthesis_preferences");
  }
  if (!signals.has_question_target_hard_negative_signal) {
    missing.push("question_target_hard_negative_preferences");
  }
  return missing;
}

function renderReport(result) {
  const missing = result.summary.missing_training_signals.length ? result.summary.missing_training_signals.join(", ") : "none";
  return `# Generation-Gap Answer-Construction Signal Audit

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime job.

## Summary

- Eval examples: ${result.summary.eval_examples}
- Answerable eval examples: ${result.summary.eval_answerable_examples}
- D336 answerable span-recoverable examples: ${result.summary.d336_answerable_span_recoverable}
- D336 answerable span-nonrecoverable examples: ${result.summary.d336_answerable_span_nonrecoverable}
- Final target forms: ${JSON.stringify(result.summary.final_target_forms)}
- Nonrecoverable target forms: ${JSON.stringify(result.summary.nonrecoverable_target_forms)}
- Missing training signals: ${missing}

## D329 Signals

- DPO rows inspected: ${result.summary.d329_dpo_signals.total_dpo_rows}
- Has short-answer negative: ${result.summary.d329_dpo_signals.has_short_answer_negative ? "yes" : "no"}
- Has overcitation negative: ${result.summary.d329_dpo_signals.has_overcitation_negative ? "yes" : "no"}
- Has yes/no polarity signal: ${result.summary.d329_dpo_signals.has_yes_no_polarity_signal ? "yes" : "no"}
- Has multi-citation synthesis signal: ${result.summary.d329_dpo_signals.has_multi_citation_synthesis_signal ? "yes" : "no"}
- Has question-target hard-negative signal: ${result.summary.d329_dpo_signals.has_question_target_hard_negative_signal ? "yes" : "no"}

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function countBy(rows, keyFn) {
  const counts = {};
  for (const row of rows) {
    const key = keyFn(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function stripCitations(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim();
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  return (await fs.readFile(file, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
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
