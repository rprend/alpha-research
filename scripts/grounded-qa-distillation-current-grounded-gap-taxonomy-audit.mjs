import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");

const runId = "current-grounded-gap-taxonomy-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);
const validationGateRunId = "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const poolRunId = "repaired-candidate-pool-headroom-audit-frontier-validation-v1";
const routerRunId = "train-supervised-candidate-router-audit-frontier-repaired-v1";
const evidenceConstructorRunId = "train-supervised-evidence-constructor-audit-frontier-repaired-v1";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const poolRows = await readJsonl(path.join(runsDir, poolRunId, "pool_oracle_rows.jsonl"));
const routerRows = await readJsonl(path.join(runsDir, routerRunId, "validation_selections.jsonl"));
const evidenceConstructorRows = await readJsonl(path.join(runsDir, evidenceConstructorRunId, "validation_predictions.jsonl"));

const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const targetById = new Map(targets.map((row) => [row.example_id, row.target]));
const routerById = new Map(routerRows.map((row) => [row.example_id, row]));
const constructorById = new Map(evidenceConstructorRows.map((row) => [row.example_id, row]));

const groundedRows = poolRows
  .filter((row) => row.target_answer_type === "grounded_answer")
  .map((row) => taxonomyRow(row))
  .sort((left, right) => left.gap_class.localeCompare(right.gap_class) || left.answer_form.localeCompare(right.answer_form) || left.example_id.localeCompare(right.example_id));

const summary = summarize(groundedRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "current_grounded_gap_taxonomy_audit",
  status: statusFor(summary),
  purpose: "Decompose the current repaired-validation grounded-answer gap after D391 into selector recoverability, candidate absence, answer form, citation count, and evidence-surface traits.",
  source_runs: {
    validation_gate: validationGateRunId,
    five_system_pool_headroom: poolRunId,
    train_supervised_router: routerRunId,
    train_supervised_evidence_constructor: evidenceConstructorRunId,
  },
  leakage_note: "This is a repaired-validation diagnostic taxonomy only. It must not be used as a trainable policy or selected system score.",
  summary,
  decision: decisionFor(summary),
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
    note: "Local deterministic taxonomy over existing repaired-validation artifacts.",
  },
  artifacts: {
    grounded_gap_rows_jsonl: rel(path.join(outputDir, "grounded_gap_rows.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "grounded_gap_rows.jsonl"), groundedRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  summary: result.summary,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function taxonomyRow(poolRow) {
  const prompt = promptById.get(poolRow.example_id);
  const target = targetById.get(poolRow.example_id);
  const router = routerById.get(poolRow.example_id);
  const constructor = constructorById.get(poolRow.example_id);
  const targetCitations = normalizeCitations(target?.citations);
  const evidenceIds = new Set((prompt?.input?.compact_retrieved_evidence_pack ?? []).map((item) => item.evidence_id));
  const answerForm = classifyAnswerForm(prompt?.input?.question, target);
  const routerPoolCandidates = router?.candidates ?? [];
  const routerPoolCorrectSystems = routerPoolCandidates.filter((candidate) => candidate.contract_correct).map((candidate) => candidate.system_id);
  const fiveSystemCorrect = poolRow.correct_systems ?? [];
  const routerSelectedCorrect = Boolean(router?.selected_contract_correct);
  const constructorCorrect = Boolean(constructor?.contract_correct);
  const gapClass = routerSelectedCorrect
    ? "router_selected_correct"
    : routerPoolCorrectSystems.length
      ? "router_selection_gap_three_system_pool"
      : fiveSystemCorrect.length
        ? "candidate_surface_gap_three_system_pool_only"
        : "candidate_absence_gap_five_system_pool";
  return {
    example_id: poolRow.example_id,
    question: prompt?.input?.question ?? "",
    answer_form: answerForm,
    target_citation_count: targetCitations.length,
    target_citations: targetCitations,
    target_citations_all_in_evidence_pack: targetCitations.every((id) => evidenceIds.has(id)),
    evidence_pack_size: evidenceIds.size,
    target_answer_token_count: tokenList(stripCitations(target?.answer)).length,
    gap_class: gapClass,
    router_selected_system_id: router?.selected_system_id ?? null,
    router_selected_correct: routerSelectedCorrect,
    router_pool_correct_systems: routerPoolCorrectSystems,
    five_system_correct_systems: fiveSystemCorrect,
    all_five_systems_wrong: Boolean(poolRow.all_systems_wrong),
    evidence_constructor_correct: constructorCorrect,
    evidence_constructor_answer_type: constructor?.prediction?.answer_type ?? null,
    evidence_constructor_citations: normalizeCitations(constructor?.prediction?.citations),
    failure_tags: failureTags({
      answerForm,
      targetCitations,
      routerPoolCorrectSystems,
      fiveSystemCorrect,
      routerSelectedCorrect,
      constructorCorrect,
      target,
      prompt,
    }),
  };
}

function failureTags({ answerForm, targetCitations, routerPoolCorrectSystems, fiveSystemCorrect, routerSelectedCorrect, constructorCorrect, target, prompt }) {
  const tags = [];
  if (!routerSelectedCorrect && routerPoolCorrectSystems.length) tags.push("selector_missed_correct_three_system_candidate");
  if (!routerPoolCorrectSystems.length && fiveSystemCorrect.length) tags.push("needs_validation_only_or_qwen_candidate_surface");
  if (!fiveSystemCorrect.length) tags.push("no_existing_candidate_contract_correct");
  if (!constructorCorrect) tags.push("shallow_constructor_failed");
  if (targetCitations.length > 1) tags.push("multi_citation_target");
  if (answerForm === "yes_no_polarity") tags.push("yes_no_polarity_target");
  if (answerForm === "numeric_or_metric") tags.push("numeric_metric_target");
  if (answerForm === "list_or_structured_answer") tags.push("list_or_structured_target");
  if (targetCitations.some((id) => !(prompt?.input?.compact_retrieved_evidence_pack ?? []).some((evidence) => evidence.evidence_id === id))) tags.push("target_citation_missing_from_pack");
  const answer = stripCitations(target?.answer);
  if (tokenList(answer).length <= 4 && !/^(yes|no)\b/i.test(answer)) tags.push("short_non_boolean_target");
  return tags;
}

function summarize(rows) {
  const routerCorrect = rows.filter((row) => row.router_selected_correct).length;
  const routerPoolRecoverable = rows.filter((row) => row.gap_class === "router_selection_gap_three_system_pool").length;
  const surfaceGap = rows.filter((row) => row.gap_class === "candidate_surface_gap_three_system_pool_only").length;
  const candidateAbsence = rows.filter((row) => row.gap_class === "candidate_absence_gap_five_system_pool").length;
  const constructorCorrect = rows.filter((row) => row.evidence_constructor_correct).length;
  return {
    grounded_examples: rows.length,
    router_grounded_contract_correct: routerCorrect,
    router_grounded_contract_rate: rate(routerCorrect, rows.length),
    router_selection_gap_three_system_pool: routerPoolRecoverable,
    candidate_surface_gap_three_system_pool_only: surfaceGap,
    candidate_absence_gap_five_system_pool: candidateAbsence,
    five_system_oracle_grounded_correct: rows.filter((row) => row.five_system_correct_systems.length).length,
    evidence_constructor_grounded_contract_correct: constructorCorrect,
    by_gap_class: countBy(rows, (row) => row.gap_class),
    by_answer_form: countBy(rows, (row) => row.answer_form),
    candidate_absence_by_answer_form: countBy(rows.filter((row) => row.gap_class === "candidate_absence_gap_five_system_pool"), (row) => row.answer_form),
    router_selection_gap_by_answer_form: countBy(rows.filter((row) => row.gap_class === "router_selection_gap_three_system_pool"), (row) => row.answer_form),
    failure_tag_counts: countTags(rows.flatMap((row) => row.failure_tags)),
    multi_citation_targets: rows.filter((row) => row.target_citation_count > 1).length,
    multi_citation_candidate_absence: rows.filter((row) => row.target_citation_count > 1 && row.gap_class === "candidate_absence_gap_five_system_pool").length,
    all_targets_have_citations_in_pack: rows.every((row) => row.target_citations_all_in_evidence_pack),
  };
}

function statusFor(summary) {
  if (summary.candidate_absence_gap_five_system_pool >= summary.router_selection_gap_three_system_pool) return "grounded_gap_candidate_absence_dominates";
  return "grounded_gap_selector_gap_dominates";
}

function decisionFor(summary) {
  if (summary.candidate_absence_gap_five_system_pool >= summary.router_selection_gap_three_system_pool) {
    return {
      buy_openai_judgments_now: false,
      launch_prime_now: false,
      train_selector_now: false,
      next_step: "Build a targeted grounded-answer construction packet for the dominant unrecovered answer forms before another selector or judge run.",
      reason: `The repaired-validation grounded gap is dominated by ${summary.candidate_absence_gap_five_system_pool} five-system candidate-absence rows versus ${summary.router_selection_gap_three_system_pool} three-system selector-gap rows.`,
    };
  }
  return {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    train_selector_now: false,
    next_step: "Build a fresh heldout selector/ranker packet focused on the router-selection-gap rows before any generator spend.",
    reason: `There are ${summary.router_selection_gap_three_system_pool} three-system selector-gap rows and ${summary.candidate_absence_gap_five_system_pool} five-system candidate-absence rows.`,
  };
}

function renderReport(result) {
  const s = result.summary;
  return `# Current Grounded Gap Taxonomy Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no API calls and launches no GPU jobs. It decomposes the repaired-validation grounded-answer misses after D391.

## Summary

- Grounded examples: ${s.grounded_examples}
- Router grounded correct: ${s.router_grounded_contract_correct}/${s.grounded_examples} (${pct(s.router_grounded_contract_rate)})
- Three-system selector-gap rows: ${s.router_selection_gap_three_system_pool}
- Three-system candidate-surface-only rows: ${s.candidate_surface_gap_three_system_pool_only}
- Five-system candidate-absence rows: ${s.candidate_absence_gap_five_system_pool}
- Five-system oracle grounded correct: ${s.five_system_oracle_grounded_correct}/${s.grounded_examples}
- Evidence constructor grounded correct: ${s.evidence_constructor_grounded_contract_correct}/${s.grounded_examples}
- Multi-citation targets: ${s.multi_citation_targets}
- Multi-citation candidate-absence rows: ${s.multi_citation_candidate_absence}
- All targets have cited evidence in pack: ${s.all_targets_have_citations_in_pack ? "yes" : "no"}

## Breakdown

- By gap class: ${JSON.stringify(s.by_gap_class)}
- By answer form: ${JSON.stringify(s.by_answer_form)}
- Candidate absence by answer form: ${JSON.stringify(s.candidate_absence_by_answer_form)}
- Failure tags: ${JSON.stringify(s.failure_tag_counts)}

## Decision

- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Train selector now: ${result.decision.train_selector_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function classifyAnswerForm(question, target) {
  if (target?.answer_type === "abstain") return "abstention";
  const answer = stripCitations(target?.answer);
  const citations = normalizeCitations(target?.citations);
  if (/^(yes|no)\b/i.test(answer) || /^(does|do|did|is|are|was|were|can|could|should|would|has|have)\b/i.test(String(question ?? ""))) return "yes_no_polarity";
  if (/\d+(?:[,.]\d+)*(?:\.\d+)?%?/.test(answer) || /\b(how many|how much|percent|percentage|score|rate|number)\b/i.test(String(question ?? ""))) return "numeric_or_metric";
  if (citations.length > 1) return "multi_citation_synthesis";
  if (/[;:]|,|\b and \b/i.test(answer) && tokenList(answer).length >= 8) return "list_or_structured_answer";
  return "single_span_answer";
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation)).filter(Boolean);
}

function stripCitations(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenList(text) {
  return String(text ?? "").toLowerCase().match(/[a-z0-9]+/g)?.filter((token) => token.length > 1) ?? [];
}

function countBy(rows, keyFn) {
  const counts = {};
  for (const row of rows) {
    const key = keyFn(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function countTags(tags) {
  const counts = {};
  for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
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
