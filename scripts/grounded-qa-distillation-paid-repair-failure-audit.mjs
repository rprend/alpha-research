import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "paid-repair-failure-audit-2026-06-29-v1";
const paidRunId = args["paid-run-id"] ?? "targeted-paid-repair-adjudication-2026-06-29-v1";
const packetRunId = args["packet-run-id"] ?? "frontier-full-nonfinal-packet-2026-06-29-v1";
const fourSourceRunId = args["four-source-run-id"] ?? "four-source-router-audit-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const sources = ["pattern", "learned", "teacher", "structured_group"];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const candidateRows = await readJsonl(path.join(runsDir, fourSourceRunId, "candidate_rows.jsonl"));
const paidRows = await readJsonl(path.join(runsDir, paidRunId, "paid_repairs.jsonl"));
const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const targetById = new Map(targets.map((row) => [row.example_id, row]));
const candidateById = new Map(candidateRows.map((row) => [row.example_id, row]));

const auditRows = paidRows.filter((row) => !row.skipped).map(auditPaidRow);
const metrics = summarizeAudit(auditRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "paid_repair_failure_audit",
  status: statusFor(metrics),
  purpose: "Diagnose why D432 paid OpenAI repair/adjudication produced zero contract-correct targeted repairs.",
  source_runs: {
    paid_repair: paidRunId,
    packet: packetRunId,
    four_source_router: fourSourceRunId,
  },
  leakage_note: "This audit reads fresh-validation failure rows only and makes no new labels. It is diagnostic and not training data.",
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
    note: "This is a local audit over D432 artifacts.",
  },
  artifacts: {
    audit_rows_jsonl: rel(path.join(outputDir, "audit_rows.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "audit_rows.jsonl"), auditRows);
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

function auditPaidRow(row) {
  const candidateRow = candidateById.get(row.example_id);
  const prompt = promptById.get(row.example_id);
  const targetRow = targetById.get(row.example_id);
  if (!candidateRow || !prompt || !targetRow) throw new Error(`Missing context for ${row.example_id}`);
  const target = targetRow.target;
  const targetCitations = normalizeCitations(target.citations);
  const predictedCitations = normalizeCitations(row.prediction?.citations);
  const correctSources = sources.filter((source) => candidateRow.candidates[source].contract_correct);
  const predictedSet = new Set(predictedCitations);
  const targetSet = new Set(targetCitations);
  const citationRelation = relation(predictedSet, targetSet);
  const relaxedSupersetCorrect = Boolean(
    target.answer_type === "grounded_answer"
    && row.prediction?.answer_type === "grounded_answer"
    && isSuperset(predictedSet, targetSet)
    && Number(row.score?.answer_token_f1 ?? 0) >= 0.2
    && row.score?.evidence_first_valid
  );
  const exactAnswerWrongCitationOnly = Boolean(
    row.score?.answer_type_correct
    && !row.score?.citation_set_exact
    && row.score?.evidence_first_valid
    && Number(row.score?.answer_token_f1 ?? 0) >= 0.2
  );
  const failure_family = failureFamily({
    target,
    row,
    citationRelation,
    correctSources,
    exactAnswerWrongCitationOnly,
  });
  return {
    example_id: row.example_id,
    repair_type: row.repair_type,
    target_answer_type: target.answer_type,
    prediction_answer_type: row.prediction?.answer_type,
    answer_type_correct: Boolean(row.score?.answer_type_correct),
    citation_set_exact: Boolean(row.score?.citation_set_exact),
    evidence_first_valid: Boolean(row.score?.evidence_first_valid),
    answer_token_f1: Number(row.score?.answer_token_f1 ?? 0),
    target_citations: targetCitations,
    predicted_citations: predictedCitations,
    citation_relation: citationRelation,
    selected_source: row.selected_source,
    correct_sources: correctSources,
    paid_selected_known_correct_source: correctSources.includes(row.selected_source),
    relaxed_superset_correct: relaxedSupersetCorrect,
    exact_answer_wrong_citation_only: exactAnswerWrongCitationOnly,
    failure_family,
    question: prompt.input.question,
    target_answer: target.answer,
    predicted_answer: row.prediction?.answer ?? "",
    evidence_count: prompt.input.compact_retrieved_evidence_pack.length,
  };
}

function failureFamily({ target, row, citationRelation, correctSources, exactAnswerWrongCitationOnly }) {
  if (target.answer_type === "abstain" && row.prediction?.answer_type === "grounded_answer") return "over_answered_counterfactual_or_abstain_target";
  if (target.answer_type === "grounded_answer" && row.prediction?.answer_type === "abstain") return "false_abstention_against_label";
  if (row.repair_type === "selector_miss_adjudication" && correctSources.length && !correctSources.includes(row.selected_source)) return "selector_failed_to_choose_known_correct_source";
  if (exactAnswerWrongCitationOnly && citationRelation === "superset") return "over_citation_exactness_failure";
  if (exactAnswerWrongCitationOnly && citationRelation === "subset") return "under_citation_exactness_failure";
  if (exactAnswerWrongCitationOnly) return "wrong_citation_set_with_plausible_answer";
  if (!row.score?.answer_type_correct) return "answerability_mismatch";
  return "wrong_citation_or_answer_content";
}

function summarizeAudit(rows) {
  const selector = rows.filter((row) => row.repair_type === "selector_miss_adjudication");
  const construction = rows.filter((row) => row.repair_type === "no_source_correct_construction");
  return {
    examples: rows.length,
    by_repair_type: {
      selector_miss_adjudication: summarizeRows(selector),
      no_source_correct_construction: summarizeRows(construction),
    },
    by_failure_family: countBy(rows.map((row) => row.failure_family)),
    by_citation_relation: countBy(rows.map((row) => row.citation_relation)),
    correct_source_distribution_on_selector_misses: countBy(selector.flatMap((row) => row.correct_sources.length ? row.correct_sources : ["none"])),
    paid_selected_known_correct_source_on_selector_misses: count(selector, (row) => row.paid_selected_known_correct_source),
    false_abstentions_against_grounded_label: count(rows, (row) => row.failure_family === "false_abstention_against_label"),
    over_answered_abstain_targets: count(rows, (row) => row.failure_family === "over_answered_counterfactual_or_abstain_target"),
    answer_type_correct_but_citation_wrong: count(rows, (row) => row.exact_answer_wrong_citation_only),
    relaxed_superset_correct: count(rows, (row) => row.relaxed_superset_correct),
    citation_exact_failures: count(rows, (row) => !row.citation_set_exact),
    evidence_first_valid: count(rows, (row) => row.evidence_first_valid),
  };
}

function summarizeRows(rows) {
  return {
    examples: rows.length,
    answer_type_correct: count(rows, (row) => row.answer_type_correct),
    citation_set_exact: count(rows, (row) => row.citation_set_exact),
    evidence_first_valid: count(rows, (row) => row.evidence_first_valid),
    relaxed_superset_correct: count(rows, (row) => row.relaxed_superset_correct),
    answer_type_correct_but_citation_wrong: count(rows, (row) => row.exact_answer_wrong_citation_only),
    failure_families: countBy(rows.map((row) => row.failure_family)),
  };
}

function statusFor(metrics) {
  if (metrics.relaxed_superset_correct >= 4) return "paid_failures_include_many_citation_minimality_cases";
  if (metrics.paid_selected_known_correct_source_on_selector_misses === 0) return "paid_failures_are_selector_and_label_calibration";
  return "paid_failures_mixed_contract_calibration";
}

function decisionFor(metrics) {
  return {
    buy_more_openai_labels_now: false,
    rent_prime_gpu_now: false,
    revise_contract_or_labels_first: true,
    promote_relaxed_citation_metric: false,
    reason: `D432 had ${metrics.citation_exact_failures}/${metrics.examples} citation exactness failures, ${metrics.false_abstentions_against_grounded_label} false abstentions against grounded labels, and ${metrics.paid_selected_known_correct_source_on_selector_misses}/15 selector-miss calls selected a known-correct source.`,
    next_step: "Build a zero-cost label/contract calibration audit over target citation minimality and counterfactual abstention labels before any more paid repair or GPU training.",
  };
}

function renderReport(result) {
  const families = Object.entries(result.metrics.by_failure_family)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([family, countValue]) => `| \`${family}\` | ${countValue} |`)
    .join("\n");
  const relations = Object.entries(result.metrics.by_citation_relation)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([relationName, countValue]) => `| \`${relationName}\` | ${countValue} |`)
    .join("\n");
  return `# Paid Repair Failure Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This local audit diagnoses D432 without making new LLM calls. It separates answerability errors from citation exactness, selector adjudication, and label/contract calibration failures.

## Summary

- Examples audited: ${result.metrics.examples}
- Evidence-first valid outputs: ${result.metrics.evidence_first_valid}/${result.metrics.examples}
- Citation exactness failures: ${result.metrics.citation_exact_failures}/${result.metrics.examples}
- Answer-type correct but citation-wrong: ${result.metrics.answer_type_correct_but_citation_wrong}/${result.metrics.examples}
- Relaxed citation-superset correct: ${result.metrics.relaxed_superset_correct}/${result.metrics.examples}
- Selector misses that chose a known-correct source: ${result.metrics.paid_selected_known_correct_source_on_selector_misses}/15
- False abstentions against grounded labels: ${result.metrics.false_abstentions_against_grounded_label}
- Over-answered abstain targets: ${result.metrics.over_answered_abstain_targets}

## Failure Families

| Family | Count |
| --- | ---: |
${families}

## Citation Relation

| Relation | Count |
| --- | ---: |
${relations}

## Decision

- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Revise contract or labels first: ${result.decision.revise_contract_or_labels_first ? "yes" : "no"}
- Promote relaxed citation metric: ${result.decision.promote_relaxed_citation_metric ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function relation(predictedSet, targetSet) {
  if (setEqual(predictedSet, targetSet)) return "exact";
  if (!predictedSet.size && targetSet.size) return "empty_prediction";
  if (predictedSet.size && !targetSet.size) return "over_answered_abstain";
  if (isSuperset(predictedSet, targetSet)) return "superset";
  if (isSubset(predictedSet, targetSet)) return "subset";
  if ([...predictedSet].some((value) => targetSet.has(value))) return "overlap";
  return "disjoint";
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : [])
    .map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation).replace(/^\[|\]$/g, ""))
    .filter(Boolean);
}

function setEqual(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function isSuperset(left, right) {
  return right.size > 0 && [...right].every((value) => left.has(value));
}

function isSubset(left, right) {
  return left.size > 0 && [...left].every((value) => right.has(value));
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countBy(values) {
  const out = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
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
