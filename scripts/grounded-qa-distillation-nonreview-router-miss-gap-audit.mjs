import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "nonreview-oracle-contrast-packet-2026-06-29-v1";
const routerRunId = args["router-run-id"] ?? "nonreview-coverage-router-audit-2026-06-29-v1";
const routerGateRunId = args["router-gate-run-id"] ?? `${routerRunId}-contract-gate`;
const subsetGateRunId = args["subset-gate-run-id"] ?? "nonreview-citation-subset-selector-smoke-2026-06-29-v1-contract-gate";
const groupGateRunId = args["group-gate-run-id"] ?? "nonreview-claim-coverage-group-scaffold-2026-06-29-v1-contract-gate";
const runId = args["run-id"] ?? "nonreview-router-miss-gap-audit-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const routerRows = await readJsonl(path.join(runsDir, routerGateRunId, "scored_predictions.jsonl"));
const routedRows = await readJsonl(path.join(runsDir, routerRunId, "routed_rows.jsonl"));
const subsetRows = await readJsonl(path.join(runsDir, subsetGateRunId, "scored_predictions.jsonl"));
const groupRows = await readJsonl(path.join(runsDir, groupGateRunId, "scored_predictions.jsonl"));
const promptRows = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));

const routedById = new Map(routedRows.map((row) => [row.example_id, row]));
const subsetById = new Map(subsetRows.map((row) => [row.example_id, row]));
const groupById = new Map(groupRows.map((row) => [row.example_id, row]));
const promptById = new Map(promptRows.map((row) => [row.example_id, row]));

const missRows = routerRows.filter((row) => !row.contract_correct);
const auditRows = missRows.map(auditMiss);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "nonreview_router_miss_gap_audit",
  status: statusFor(auditRows),
  purpose: "Diagnose the remaining D448 coverage-router failures before buying labels or renting Prime GPU.",
  source_runs: {
    packet: packetRunId,
    router: routerRunId,
    router_contract_gate: routerGateRunId,
    subset_contract_gate: subsetGateRunId,
    group_contract_gate: groupGateRunId,
  },
  summary: summarize(auditRows),
  source_comparison: compareSources(routerRows),
  support_plan_need: summarizeSupportPlanNeed(auditRows),
  decision: decisionFor(auditRows),
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
    note: "This audit reads existing local artifacts only.",
  },
  artifacts: {
    audit_rows_jsonl: rel(path.join(outputDir, "audit_rows.jsonl")),
    support_plan_gaps_jsonl: rel(path.join(outputDir, "support_plan_gaps.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "audit_rows.jsonl"), auditRows);
await writeJsonl(path.join(outputDir, "support_plan_gaps.jsonl"), auditRows.map((row) => row.needed_support_plan));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  summary: result.summary,
  source_comparison: result.source_comparison,
  support_plan_need: result.support_plan_need,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function auditMiss(row) {
  const exampleId = row.example_id;
  const prompt = promptById.get(exampleId);
  const routed = routedById.get(exampleId);
  const subset = subsetById.get(exampleId);
  const group = groupById.get(exampleId);
  const evidencePack = prompt?.input?.compact_retrieved_evidence_pack ?? [];
  const evidenceById = new Map(evidencePack.map((evidence) => [evidence.evidence_id, evidence]));
  const targetCitations = normalizeCitations(row.target?.citations);
  const predictionCitations = normalizeCitations(row.prediction?.citations);
  const setRelation = citationSetRelation(targetCitations, predictionCitations);
  const targetEvidence = targetCitations.map((citation) => evidenceSummary(citation, evidenceById.get(citation)));
  const predictedEvidence = predictionCitations.map((citation) => evidenceSummary(citation, evidenceById.get(citation)));
  return {
    example_id: exampleId,
    question: prompt?.input?.question ?? null,
    paper_id: prompt?.input?.document_metadata?.paper_id ?? null,
    title: prompt?.input?.document_metadata?.title ?? null,
    selected_source: routed?.selected_source ?? "unknown",
    target_answer_type: row.target_answer_type,
    prediction_answer_type: row.prediction_answer_type,
    answer_type_correct: Boolean(row.answer_type_correct),
    evidence_first_valid: Boolean(row.evidence_first_valid),
    citation_set_exact: Boolean(row.citation_set_exact),
    target_citations: targetCitations,
    predicted_citations: predictionCitations,
    target_citation_count: targetCitations.length,
    predicted_citation_count: predictionCitations.length,
    miss_family: missFamily(row, setRelation),
    set_relation: setRelation,
    target_evidence: targetEvidence,
    predicted_evidence: predictedEvidence,
    target_rank_min: minDefined(targetEvidence.map((evidence) => evidence.retrieval_rank)),
    predicted_rank_min: minDefined(predictedEvidence.map((evidence) => evidence.retrieval_rank)),
    target_sections: unique(targetEvidence.map((evidence) => evidence.section_root).filter(Boolean)),
    predicted_sections: unique(predictedEvidence.map((evidence) => evidence.section_root).filter(Boolean)),
    same_section_root_overlap: hasIntersection(
      targetEvidence.map((evidence) => evidence.section_root),
      predictedEvidence.map((evidence) => evidence.section_root),
    ),
    numeric_or_table_signal: hasNumericOrTableSignal(prompt, targetEvidence, predictedEvidence),
    subset_contract_correct: Boolean(subset?.contract_correct),
    group_contract_correct: Boolean(group?.contract_correct),
    source_oracle_correct: Boolean(subset?.contract_correct || group?.contract_correct),
    subset_citations: normalizeCitations(subset?.prediction?.citations),
    group_citations: normalizeCitations(group?.prediction?.citations),
    target_supported_claims: normalizeSupportedClaims(row.target),
    predicted_supported_claims: normalizeSupportedClaims(row.prediction),
    needed_support_plan: supportPlan(exampleId, prompt, row, targetEvidence, predictedEvidence),
  };
}

function supportPlan(exampleId, prompt, row, targetEvidence, predictedEvidence) {
  return {
    example_id: exampleId,
    question: prompt?.input?.question ?? null,
    target_citations: normalizeCitations(row.target?.citations),
    predicted_citations: normalizeCitations(row.prediction?.citations),
    support_plan_label_type: "diagnostic_required_evidence_plan_not_final_eval_training_label",
    required_answer_components: normalizeSupportedClaims(row.target).map((claim) => ({
      claim: claim.claim,
      citations: claim.citations,
    })),
    required_evidence: targetEvidence.map((evidence) => ({
      evidence_id: evidence.evidence_id,
      retrieval_rank: evidence.retrieval_rank,
      section: evidence.section,
      preview: evidence.preview,
    })),
    distractor_or_selected_evidence: predictedEvidence
      .filter((evidence) => !normalizeCitations(row.target?.citations).includes(evidence.evidence_id))
      .map((evidence) => ({
        evidence_id: evidence.evidence_id,
        retrieval_rank: evidence.retrieval_rank,
        section: evidence.section,
        preview: evidence.preview,
      })),
    planner_instruction: "For each required answer component, identify the minimal evidence ids that support it and reject nearby evidence that answers a different target.",
  };
}

function summarize(rows) {
  return {
    misses: rows.length,
    answer_type_misses: count(rows, (row) => !row.answer_type_correct),
    evidence_first_invalid: count(rows, (row) => !row.evidence_first_valid),
    citation_only_misses: count(rows, (row) => row.answer_type_correct && row.evidence_first_valid && !row.citation_set_exact),
    by_miss_family: histogram(rows.map((row) => row.miss_family)),
    by_target_citation_count: histogram(rows.map((row) => String(row.target_citation_count))),
    target_rank_min_histogram: histogram(rows.map((row) => String(row.target_rank_min ?? "missing"))),
    same_section_root_overlap: count(rows, (row) => row.same_section_root_overlap),
    numeric_or_table_signal: count(rows, (row) => row.numeric_or_table_signal),
    source_oracle_correct: count(rows, (row) => row.source_oracle_correct),
  };
}

function compareSources(routerRowsLocal) {
  const allIds = routerRowsLocal.map((row) => row.example_id);
  const both = allIds.map((id) => ({
    router: routerRowsLocal.find((row) => row.example_id === id),
    subset: subsetById.get(id),
    group: groupById.get(id),
  }));
  return {
    examples: both.length,
    router_correct: count(both, (row) => row.router?.contract_correct),
    subset_correct: count(both, (row) => row.subset?.contract_correct),
    group_correct: count(both, (row) => row.group?.contract_correct),
    subset_group_union_correct: count(both, (row) => row.subset?.contract_correct || row.group?.contract_correct),
    remaining_router_misses_with_subset_or_group_correct: count(both, (row) => !row.router?.contract_correct && (row.subset?.contract_correct || row.group?.contract_correct)),
  };
}

function summarizeSupportPlanNeed(rows) {
  return {
    rows_requiring_support_plan_labels: count(rows, (row) => row.answer_type_correct && row.evidence_first_valid && !row.citation_set_exact),
    wrong_singleton_or_wrong_neighbor_rows: count(rows, (row) => row.miss_family === "wrong_singleton"),
    partial_multicitation_rows: count(rows, (row) => row.miss_family === "partial_multicitation"),
    mixed_wrong_and_missing_rows: count(rows, (row) => row.miss_family === "mixed_wrong_and_missing"),
    overcitation_extra_rows: count(rows, (row) => row.miss_family === "overcitation_extra"),
    mean_required_citations_on_misses: mean(rows.map((row) => row.target_citation_count)),
    mean_predicted_citations_on_misses: mean(rows.map((row) => row.predicted_citation_count)),
  };
}

function decisionFor(rows) {
  const summary = summarizeSupportPlanNeed(rows);
  const citationOnly = count(rows, (row) => row.answer_type_correct && row.evidence_first_valid && !row.citation_set_exact);
  return {
    buy_openai_labels_now: false,
    rent_prime_gpu_now: false,
    broaden_student_training_now: false,
    build_support_plan_packet_next: citationOnly === rows.length,
    reason: `${citationOnly}/${rows.length} remaining router misses are citation-set misses with correct answer type and valid evidence-first shape; the gap is evidence planning, not schema, answerability, or raw model scale.`,
    next_step: "Construct a train-only support-plan packet over analogous non-final examples, then retest the router against a strict acceptance criterion above the 47/64 structured-group baseline before spending on Prime or broader OpenAI labels.",
    acceptance_criterion: "A support-planning scaffold should exceed 47/64 fresh non-review contract correctness and improve multi-citation exactness beyond 3/14 before any GPU rental.",
    spend_guardrail: "Keep total OpenAI plus Prime/external compute under $100; this audit spent $0.",
    support_plan_need: summary,
  };
}

function statusFor(rows) {
  const citationOnly = count(rows, (row) => row.answer_type_correct && row.evidence_first_valid && !row.citation_set_exact);
  if (citationOnly === rows.length) return "all_remaining_misses_are_citation_planning";
  if (citationOnly / Math.max(1, rows.length) >= 0.8) return "mostly_citation_planning";
  return "mixed_failure_modes";
}

function missFamily(row, relation) {
  if (!row.answer_type_correct) return "answer_type";
  if (!row.evidence_first_valid) return "evidence_first_schema";
  const target = normalizeCitations(row.target?.citations);
  const predicted = normalizeCitations(row.prediction?.citations);
  if (target.length === 1 && predicted.length === 1 && relation.missing.length === 1 && relation.extra.length === 1) return "wrong_singleton";
  if (relation.extra.length === 0 && relation.missing.length > 0) return "partial_multicitation";
  if (relation.missing.length === 0 && relation.extra.length > 0) return "overcitation_extra";
  if (relation.missing.length > 0 && relation.extra.length > 0) return "mixed_wrong_and_missing";
  return "other_citation";
}

function citationSetRelation(targetCitations, predictionCitations) {
  const target = new Set(targetCitations);
  const predicted = new Set(predictionCitations);
  const overlap = [...predicted].filter((citation) => target.has(citation));
  const missing = [...target].filter((citation) => !predicted.has(citation));
  const extra = [...predicted].filter((citation) => !target.has(citation));
  return {
    overlap,
    missing,
    extra,
    jaccard: target.size || predicted.size ? overlap.length / new Set([...target, ...predicted]).size : 1,
  };
}

function evidenceSummary(evidenceId, evidence) {
  return {
    evidence_id: evidenceId,
    retrieval_rank: evidence?.retrieval_rank ?? null,
    section: evidence?.section ?? null,
    section_root: sectionRoot(evidence?.section),
    preview: preview(evidence?.text ?? ""),
  };
}

function normalizeSupportedClaims(output) {
  const claims = output?.evidence_first?.supported_claims;
  return (Array.isArray(claims) ? claims : []).map((claim) => ({
    claim: String(claim.claim ?? ""),
    citations: normalizeCitations(claim.citations),
    support_status: claim.support_status ?? claim.support ?? null,
  }));
}

function hasNumericOrTableSignal(prompt, targetEvidence, predictedEvidence) {
  const text = [
    prompt?.input?.question ?? "",
    ...targetEvidence.map((evidence) => evidence.preview),
    ...predictedEvidence.map((evidence) => evidence.preview),
  ].join(" ");
  return /\d|%|table|rouge|score|accuracy|f1|metric|baseline/i.test(text);
}

function sectionRoot(section) {
  return String(section ?? "").split(":::")[0].trim().toLowerCase() || null;
}

function hasIntersection(left, right) {
  const rightSet = new Set(right.filter(Boolean));
  return left.some((value) => value && rightSet.has(value));
}

function minDefined(values) {
  const finite = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  return finite.length ? Math.min(...finite) : null;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : [])
    .map((citation) => typeof citation === "string" ? citation.replace(/^\[|\]$/g, "") : String(citation?.evidence_id ?? citation?.id ?? ""))
    .filter(Boolean);
}

function histogram(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function unique(values) {
  return [...new Set(values)];
}

function count(rows, pred) {
  return rows.filter(pred).length;
}

function mean(values) {
  return values.length ? values.reduce((total, value) => total + Number(value || 0), 0) / values.length : 0;
}

function preview(text) {
  return String(text).replace(/\s+/g, " ").trim().slice(0, 280);
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

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [name, raw] = value.slice(2).split("=");
    parsed[name] = raw ?? "true";
  }
  return parsed;
}

function renderReport(result) {
  return `# Non-Review Router Miss Gap Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This zero-spend audit decomposes the remaining D448 coverage-router misses before buying labels or renting Prime GPU.

## Result

- Router misses: ${result.summary.misses}
- Citation-only misses: ${result.summary.citation_only_misses}
- Answer-type misses: ${result.summary.answer_type_misses}
- Evidence-first invalid: ${result.summary.evidence_first_invalid}
- Miss families: ${JSON.stringify(result.summary.by_miss_family)}
- Target citation counts: ${JSON.stringify(result.summary.by_target_citation_count)}
- Same section-root overlap: ${result.summary.same_section_root_overlap}
- Numeric/table signal: ${result.summary.numeric_or_table_signal}
- Subset/group source oracle correct among router misses: ${result.summary.source_oracle_correct}

## Source Comparison

- Router correct: ${result.source_comparison.router_correct}/${result.source_comparison.examples}
- Subset selector correct: ${result.source_comparison.subset_correct}/${result.source_comparison.examples}
- Group scaffold correct: ${result.source_comparison.group_correct}/${result.source_comparison.examples}
- Subset/group union correct: ${result.source_comparison.subset_group_union_correct}/${result.source_comparison.examples}

## Decision

- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Broaden student training now: ${result.decision.broaden_student_training_now ? "yes" : "no"}
- Build support-plan packet next: ${result.decision.build_support_plan_packet_next ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
- Acceptance criterion: ${result.decision.acceptance_criterion}
- Spend guardrail: ${result.decision.spend_guardrail}
`;
}
