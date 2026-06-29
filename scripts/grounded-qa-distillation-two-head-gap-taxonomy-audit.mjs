import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "two-head-gap-taxonomy-audit-frontier-repaired-v1";
const validationGateRunId = args["validation-gate-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const twoHeadRunId = args["two-head-run-id"] ?? "two-head-support-selector-audit-frontier-repaired-v1";
const augmentedRouterRunId = args["augmented-router-run-id"] ?? "augmented-constructor-router-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const twoHead = await readJson(path.join(runsDir, twoHeadRunId, "result.json"));
const augmented = await readJson(path.join(runsDir, augmentedRouterRunId, "result.json"));
const selectedRows = await readJsonl(path.join(runsDir, twoHeadRunId, "validation_selected_rows.jsonl"));
const candidateRows = await readJsonl(path.join(runsDir, augmentedRouterRunId, "validation_candidate_rows.jsonl"));
const prompts = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_targets_diagnostic.jsonl"));

const candidatesById = groupBy(candidateRows, (row) => row.example_id);
const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const targetById = new Map(targets.map((row) => [row.example_id, row.target]));

const rows = selectedRows
  .filter((row) => !row.selected_contract_correct)
  .map((row) => taxonomyRow(row))
  .sort((left, right) => left.gap_class.localeCompare(right.gap_class) || left.answer_form.localeCompare(right.answer_form) || left.example_id.localeCompare(right.example_id));

const summary = summarize(rows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "two_head_gap_taxonomy_audit",
  status: statusFor(summary),
  purpose: "Decompose the D417 two-head selector's remaining repaired-validation misses into recoverable selection gaps versus unrecoverable construction gaps.",
  source_runs: {
    validation_gate: validationGateRunId,
    two_head_selector: twoHeadRunId,
    augmented_router: augmentedRouterRunId,
  },
  leakage_note: "This is a validation diagnostic only. It inspects labels after D417 selection and must not be used to tune a selector threshold on this validation surface.",
  baseline_comparison: {
    two_head_contract_correct: Number(twoHead.metrics?.repaired_validation_gate?.contract_correct ?? 0),
    augmented_router_contract_correct: Number(augmented.metrics?.repaired_validation_gate?.contract_correct ?? 0),
    augmented_pool_oracle_contract_correct: Number(augmented.oracle?.repaired_validation_gate?.contract_correct ?? 0),
    remaining_gap_to_augmented_oracle: Number(augmented.oracle?.repaired_validation_gate?.contract_correct ?? 0) - Number(twoHead.metrics?.repaired_validation_gate?.contract_correct ?? 0),
  },
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
    gap_rows_jsonl: rel(path.join(outputDir, "gap_rows.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "gap_rows.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  baseline_comparison: result.baseline_comparison,
  summary: result.summary,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function taxonomyRow(selected) {
  const candidates = candidatesById.get(selected.example_id) ?? [];
  const correctCandidates = candidates.filter((candidate) => candidate.label_contract_correct);
  const prompt = promptById.get(selected.example_id);
  const target = targetById.get(selected.example_id);
  const selectedCandidate = candidates.find((candidate) => candidate.system_id === selected.selected_system_id);
  const targetCitations = normalizeCitations(target?.citations);
  const evidencePack = prompt?.input?.compact_retrieved_evidence_pack ?? [];
  const evidenceIds = new Set(evidencePack.map((item) => item.evidence_id));
  const answerForm = classifyAnswerForm(prompt?.input?.question, target);
  const gapClass = correctCandidates.length ? "recoverable_selection_gap" : "irrecoverable_construction_gap";
  return {
    example_id: selected.example_id,
    question: prompt?.input?.question ?? "",
    target_answer_type: target?.answer_type ?? null,
    answer_form: answerForm,
    target_answer_token_count: tokenList(stripCitations(target?.answer)).length,
    target_citation_count: targetCitations.length,
    target_citations: targetCitations,
    target_citations_all_in_evidence_pack: targetCitations.every((id) => evidenceIds.has(id)),
    evidence_pack_size: evidenceIds.size,
    gap_class: gapClass,
    selected_system_id: selected.selected_system_id,
    selected_candidate_answer_type: candidateAnswerType(selectedCandidate),
    selected_answer_type_correct: Boolean(selected.selected_answer_type_correct),
    selected_citation_set_exact: Boolean(selected.selected_citation_set_exact),
    correct_system_ids: correctCandidates.map((candidate) => candidate.system_id),
    answer_candidate_count: candidates.filter((candidate) => candidate.feature_values?.[5] === 1).length,
    abstain_candidate_count: candidates.filter((candidate) => candidate.feature_values?.[6] === 1).length,
    candidate_count: candidates.length,
    failure_tags: failureTags({ gapClass, selected, selectedCandidate, correctCandidates, answerForm, targetCitations, target, prompt, candidates }),
    target_answer_preview: stripCitations(target?.answer).slice(0, 240),
  };
}

function summarize(taxonomyRows) {
  const recoverable = taxonomyRows.filter((row) => row.gap_class === "recoverable_selection_gap");
  const irrecoverable = taxonomyRows.filter((row) => row.gap_class === "irrecoverable_construction_gap");
  return {
    selected_misses: taxonomyRows.length,
    recoverable_selection_gap: recoverable.length,
    irrecoverable_construction_gap: irrecoverable.length,
    recoverable_gap_rate: rate(recoverable.length, taxonomyRows.length),
    irrecoverable_gap_rate: rate(irrecoverable.length, taxonomyRows.length),
    by_gap_class: countBy(taxonomyRows, (row) => row.gap_class),
    by_answer_form: countBy(taxonomyRows, (row) => row.answer_form),
    recoverable_by_answer_form: countBy(recoverable, (row) => row.answer_form),
    irrecoverable_by_answer_form: countBy(irrecoverable, (row) => row.answer_form),
    by_selected_system: countBy(taxonomyRows, (row) => row.selected_system_id),
    recoverable_correct_systems: countTags(recoverable.flatMap((row) => row.correct_system_ids)),
    failure_tag_counts: countTags(taxonomyRows.flatMap((row) => row.failure_tags)),
    selected_abstention_misses: taxonomyRows.filter((row) => row.selected_candidate_answer_type === "abstain").length,
    selected_answer_misses: taxonomyRows.filter((row) => row.selected_candidate_answer_type === "grounded_answer").length,
    all_targets_grounded_answers: taxonomyRows.every((row) => row.target_answer_type === "grounded_answer"),
    all_targets_have_citations_in_pack: taxonomyRows.every((row) => row.target_citations_all_in_evidence_pack),
    multi_citation_misses: taxonomyRows.filter((row) => row.target_citation_count > 1).length,
    multi_citation_irrecoverable: irrecoverable.filter((row) => row.target_citation_count > 1).length,
    zero_answer_candidate_irrecoverable: irrecoverable.filter((row) => row.answer_candidate_count === 0).length,
  };
}

function failureTags({ gapClass, selected, selectedCandidate, correctCandidates, answerForm, targetCitations, target, prompt, candidates }) {
  const tags = [gapClass];
  if (selectedCandidate?.feature_values?.[6] === 1) tags.push("selected_abstention");
  if (selectedCandidate?.feature_values?.[5] === 1) tags.push("selected_grounded_answer");
  if (!selected.selected_answer_type_correct) tags.push("answer_type_error");
  if (!selected.selected_citation_set_exact) tags.push("citation_set_error");
  if (correctCandidates.length) tags.push("correct_candidate_available");
  if (correctCandidates.some((candidate) => candidate.system_id === "broad_sufficiency_constructor")) tags.push("constructor_candidate_was_correct");
  if (correctCandidates.some((candidate) => candidate.system_id !== "broad_sufficiency_constructor")) tags.push("legacy_candidate_was_correct");
  if (!correctCandidates.length && candidates.every((candidate) => candidate.feature_values?.[6] === 1)) tags.push("no_grounded_answer_candidates");
  if (!correctCandidates.length && candidates.some((candidate) => candidate.feature_values?.[5] === 1)) tags.push("grounded_candidates_all_wrong");
  if (answerForm === "numeric_or_metric") tags.push("numeric_metric_target");
  if (answerForm === "yes_no_polarity") tags.push("yes_no_polarity_target");
  if (answerForm === "multi_citation_synthesis") tags.push("multi_citation_synthesis_target");
  if (answerForm === "list_or_structured_answer") tags.push("list_or_structured_target");
  if (targetCitations.length > 1) tags.push("multi_citation_target");
  if (targetCitations.some((id) => !(prompt?.input?.compact_retrieved_evidence_pack ?? []).some((evidence) => evidence.evidence_id === id))) tags.push("target_citation_missing_from_pack");
  if (tokenList(stripCitations(target?.answer)).length <= 6) tags.push("short_target");
  return tags;
}

function statusFor(summary) {
  if (summary.irrecoverable_construction_gap > summary.recoverable_selection_gap) return "construction_gap_slightly_dominates";
  if (summary.recoverable_selection_gap > summary.irrecoverable_construction_gap) return "selection_gap_slightly_dominates";
  return "selection_and_construction_gap_tied";
}

function decisionFor(summary) {
  return {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    train_gpu_model_now: false,
    use_saved_openai_key_now: false,
    next_step: "Build a zero- or low-cost targeted candidate constructor for the irrecoverable rows while separately preparing richer support supervision for the recoverable rows.",
    reason: `After D417, ${summary.recoverable_selection_gap}/${summary.selected_misses} misses have a correct candidate already available, while ${summary.irrecoverable_construction_gap}/${summary.selected_misses} have no contract-correct candidate in the augmented pool. A paid judge or larger selector alone cannot close the construction side of the gap.`,
  };
}

function renderReport(result) {
  const s = result.summary;
  return `# Two-Head Gap Taxonomy Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls and launches no Prime compute. It decomposes the D417 two-head selector misses after the augmented constructor pool.

## Baseline Comparison

- Two-head selector: ${result.baseline_comparison.two_head_contract_correct}/70
- Augmented router: ${result.baseline_comparison.augmented_router_contract_correct}/70
- Augmented pool oracle: ${result.baseline_comparison.augmented_pool_oracle_contract_correct}/70
- Remaining gap to augmented oracle: ${result.baseline_comparison.remaining_gap_to_augmented_oracle}

## Gap Summary

- Selected misses: ${s.selected_misses}
- Recoverable selection gaps: ${s.recoverable_selection_gap} (${pct(s.recoverable_gap_rate)})
- Irrecoverable construction gaps: ${s.irrecoverable_construction_gap} (${pct(s.irrecoverable_gap_rate)})
- Selected abstention misses: ${s.selected_abstention_misses}
- Selected grounded-answer misses: ${s.selected_answer_misses}
- Multi-citation misses: ${s.multi_citation_misses}
- Multi-citation irrecoverable: ${s.multi_citation_irrecoverable}
- Irrecoverable rows with zero grounded-answer candidates: ${s.zero_answer_candidate_irrecoverable}
- All miss targets are grounded answers: ${s.all_targets_grounded_answers ? "yes" : "no"}
- All target citations are present in evidence packs: ${s.all_targets_have_citations_in_pack ? "yes" : "no"}

## Breakdown

- By answer form: ${JSON.stringify(s.by_answer_form)}
- Recoverable by answer form: ${JSON.stringify(s.recoverable_by_answer_form)}
- Irrecoverable by answer form: ${JSON.stringify(s.irrecoverable_by_answer_form)}
- By selected system: ${JSON.stringify(s.by_selected_system)}
- Recoverable correct systems: ${JSON.stringify(s.recoverable_correct_systems)}
- Failure tags: ${JSON.stringify(s.failure_tag_counts)}

## Decision

- Use saved OpenAI key now: ${result.decision.use_saved_openai_key_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Train GPU model now: ${result.decision.train_gpu_model_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function classifyAnswerForm(question, target) {
  if (target?.answer_type === "abstain") return "abstention";
  const answer = stripCitations(target?.answer);
  const citations = normalizeCitations(target?.citations);
  if (/^(yes|no)\b/i.test(answer) || /^(does|do|did|is|are|was|were|can|could|should|would|has|have)\b/i.test(String(question ?? ""))) return "yes_no_polarity";
  if (/\b\d+(?:[,.]\d+)*(?:\.\d+)?%?\b/.test(answer) || /\b(how many|how much|how large|how big|percent|percentage|score|rate|number|size|sizes)\b/i.test(String(question ?? ""))) return "numeric_or_metric";
  if (citations.length > 1) return "multi_citation_synthesis";
  if (/[;:]|,|\b and \b/i.test(answer) && tokenList(answer).length >= 8) return "list_or_structured_answer";
  return "single_span_answer";
}

function candidateAnswerType(candidate) {
  if (!candidate) return "missing";
  if (candidate.feature_values?.[5] === 1) return "grounded_answer";
  if (candidate.feature_values?.[6] === 1) return "abstain";
  return "unknown";
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
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function countTags(tags) {
  const counts = {};
  for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
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
