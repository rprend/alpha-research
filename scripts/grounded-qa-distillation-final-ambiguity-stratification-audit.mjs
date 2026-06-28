import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const baselineRunId = args["baseline-run"] ?? "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1";
const boundaryRunId = args["boundary-run"] ?? "filtered-boundary-selector-gpt4o-qwen-frontier-pool-2026-06-28-v1";
const runId = args["run-id"] ?? "final-ambiguity-stratification-audit-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const stopwords = new Set([
  "the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "has", "have", "had", "but", "not", "can", "may", "its", "into", "than", "then", "also", "been", "their", "there", "which", "while", "using", "used", "use", "true", "false", "answer", "claim", "evidence", "support", "supported", "paper", "they", "did", "does", "what", "which", "how", "many", "much", "their", "these", "those", "model", "models", "dataset", "datasets", "results", "experiments",
]);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const diagnosticPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "diagnostic_frontier_pairwise.jsonl"));
const baselineSelections = indexBy(await readJsonl(path.join(runsDir, baselineRunId, "constrained_final_diagnostic_selections.jsonl")), "example_id");
const boundarySelections = indexBy(await readJsonl(path.join(runsDir, boundaryRunId, "boundary_final_diagnostic_selections.jsonl")), "example_id");
const hybridSelections = indexBy(await readJsonl(path.join(runsDir, boundaryRunId, "hybrid_final_diagnostic_selections.jsonl")), "example_id");

const examples = groupBy(diagnosticPairs, (row) => row.example_id);
const exampleAudits = [...examples.entries()].map(([exampleId, rows]) => auditExample(exampleId, rows, {
  d262: baselineSelections.get(exampleId),
  boundary_only: boundarySelections.get(exampleId),
  selected_hybrid: hybridSelections.get(exampleId),
}));
const selectorRows = flatten(exampleAudits.map((row) => selectorRowsFor(row)));
const strataRows = buildStrataRows(exampleAudits);
const selectorSummary = summarizeSelectors(selectorRows);
const strataSummary = summarizeStrata(strataRows);
const riskRows = exampleAudits.filter((row) => row.ambiguity_risk.is_ambiguity_risk);
const cleanRows = exampleAudits.filter((row) => !row.ambiguity_risk.is_ambiguity_risk);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "final_ambiguity_stratification_audit",
  purpose: "Stratify final diagnostic selector metrics by likely question/reference/candidate ambiguity before spending on more labels or GPU work.",
  source_runs: {
    pairwise_packet: pairwisePacketRunId,
    baseline_selector: baselineRunId,
    boundary_selector: boundaryRunId,
  },
  summary: {
    final_examples: exampleAudits.length,
    final_pairwise_rows: diagnosticPairs.length,
    ambiguity_risk_examples: riskRows.length,
    clean_examples: cleanRows.length,
    ambiguity_risk_example_ids: riskRows.map((row) => row.example_id),
  },
  selector_summary: selectorSummary,
  strata_summary: strataSummary,
  diagnosis: diagnose(exampleAudits, selectorSummary, strataSummary),
  decision: {
    integrate_boundary_selector_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    use_ambiguity_risk_rows_for_training: false,
    next_step: "Treat final-window selector selection as clean-stratified plus ambiguity-risk diagnostic. Use non-final data or curated replacement final rows before buying more labels or launching GPU jobs for this failure mode.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_diagnostic_use: "forbidden_diagnostic_stratification_only",
    audit_is_zero_call: true,
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
    note: "This audit reads existing final diagnostic artifacts only.",
  },
  artifacts: {
    example_audits_jsonl: rel(path.join(outputDir, "example_audits.jsonl")),
    selector_strata_jsonl: rel(path.join(outputDir, "selector_strata.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "example_audits.jsonl"), exampleAudits);
await writeJsonl(path.join(outputDir, "selector_strata.jsonl"), strataRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result, exampleAudits);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  summary: result.summary,
  selector_summary: result.selector_summary,
  diagnosis: result.diagnosis,
  decision: result.decision,
}, null, 2));

function auditExample(exampleId, pairRows, selections) {
  const first = pairRows[0];
  const input = first.input;
  const reference = first.reference;
  const candidates = candidateRows(pairRows);
  const supportedCandidates = candidates.filter((candidate) => candidate.existing_judge_supported);
  const questionTerms = contentTokens(input.question);
  const referenceTerms = contentTokens(stripCitationMarkers(reference?.answer ?? ""));
  const citedReferenceText = citedEvidenceText(input, { citations: reference?.citations ?? [] });
  const candidateAudits = candidates.map((candidate) => auditCandidate(candidate, input, reference, questionTerms, referenceTerms));
  const supportedAudits = candidateAudits.filter((candidate) => candidate.existing_judge_supported);
  const ambiguityRisk = ambiguityRiskFor({
    question: input.question,
    referenceAnswer: reference?.answer ?? "",
    questionTerms,
    referenceTerms,
    citedReferenceText,
    supportedAudits,
  });
  return {
    example_id: exampleId,
    paper_id: input.document_metadata?.paper_id ?? null,
    question: input.question,
    reference,
    pairwise_rows: pairRows.length,
    candidate_count: candidates.length,
    supported_candidate_count: supportedCandidates.length,
    ambiguity_risk: ambiguityRisk,
    selector_outcomes: {
      d262: selectorOutcome(selections.d262, candidateAudits),
      boundary_only: selectorOutcome(selections.boundary_only, candidateAudits),
      selected_hybrid: selectorOutcome(selections.selected_hybrid, candidateAudits),
    },
    reference_alignment: {
      question_reference_overlap: overlap(questionTerms, referenceTerms),
      reference_cited_coverage: overlap(referenceTerms, contentTokens(citedReferenceText)),
      max_supported_reference_overlap: max(supportedAudits.map((row) => row.lexical_alignment.reference_term_overlap)),
      max_supported_question_overlap: max(supportedAudits.map((row) => row.lexical_alignment.question_term_overlap)),
    },
    supported_candidate_ids: supportedAudits.map((row) => row.candidate_id),
    candidate_audits: candidateAudits.map((row) => ({
      candidate_id: row.candidate_id,
      existing_judge_supported: row.existing_judge_supported,
      answer_preview: row.answer_preview,
      lexical_alignment: row.lexical_alignment,
      failure_tags: row.failure_tags,
    })),
  };
}

function candidateRows(pairs) {
  const byId = new Map();
  for (const pair of pairs) {
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const id = candidate.id ?? candidate.candidate_id;
      if (!byId.has(id)) {
        byId.set(id, { ...candidate, candidate_id: id, existing_judge_supported: role === "chosen" });
      } else if (role === "chosen") {
        byId.get(id).existing_judge_supported = true;
      }
    }
  }
  return [...byId.values()];
}

function auditCandidate(candidate, input, reference, questionTerms, referenceTerms) {
  const answer = String(candidate.answer ?? "");
  const claimText = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? "")).join(" ");
  const citedText = citedEvidenceText(input, candidate);
  const answerClaimTerms = contentTokens(`${answer} ${claimText}`);
  return {
    candidate_id: candidate.candidate_id,
    existing_judge_supported: Boolean(candidate.existing_judge_supported),
    answer_preview: preview(answer, 180),
    lexical_alignment: {
      question_term_overlap: overlap(questionTerms, answerClaimTerms),
      reference_term_overlap: overlap(referenceTerms, answerClaimTerms),
      answer_cited_coverage: overlap(contentTokens(answer), contentTokens(citedText)),
      claim_cited_coverage: overlap(contentTokens(claimText), contentTokens(citedText)),
    },
    failure_tags: failureTags(candidate, input, reference, questionTerms, referenceTerms),
  };
}

function failureTags(candidate, input, reference, questionTerms, referenceTerms) {
  const tags = [];
  const answerClaim = `${candidate.answer ?? ""} ${(candidate.claim_table ?? []).map((claim) => claim.claim ?? "").join(" ")}`;
  const answerTerms = contentTokens(answerClaim);
  if ((candidate.judgment?.unsupported_claims ?? []).length) tags.push("existing_unsupported_claim");
  if (overlap(questionTerms, answerTerms) < 0.25) tags.push("low_question_alignment");
  if (overlap(referenceTerms, answerTerms) < 0.25) tags.push("low_reference_alignment");
  if (/news outlets/i.test(input.question) && /dialog|dataset|interview|callhome|dailydialog|settings/i.test(answerClaim)) tags.push("question_entity_mismatch");
  if (/performance/i.test(input.question) && /\b8922\b/.test(reference?.answer ?? "")) tags.push("reference_numeric_format_risk");
  if (/metric/i.test(input.question) && /accuracy/i.test(reference?.answer ?? "") && !/explanation/i.test(reference?.answer ?? "")) tags.push("question_scope_metric_mismatch_risk");
  return tags;
}

function ambiguityRiskFor({ question, referenceAnswer, questionTerms, referenceTerms, citedReferenceText, supportedAudits }) {
  const tags = [];
  const isYesNoReference = /^(yes|no)\b/i.test(stripCitationMarkers(referenceAnswer).trim());
  const questionReferenceOverlap = overlap(questionTerms, referenceTerms);
  const referenceCitedCoverage = overlap(referenceTerms, contentTokens(citedReferenceText));
  const maxSupportedReferenceOverlap = max(supportedAudits.map((row) => row.lexical_alignment.reference_term_overlap));
  const maxSupportedQuestionOverlap = max(supportedAudits.map((row) => row.lexical_alignment.question_term_overlap));
  const normalizedReference = stripCitationMarkers(referenceAnswer).toLowerCase();
  if (questionReferenceOverlap === 0 && !isYesNoReference) tags.push("zero_question_reference_overlap");
  if (referenceCitedCoverage < 0.5 && !isYesNoReference) tags.push("low_reference_cited_coverage");
  if (supportedAudits.length && maxSupportedReferenceOverlap < 0.34) tags.push("supported_candidates_low_reference_alignment");
  if (supportedAudits.length && maxSupportedQuestionOverlap < 0.25) tags.push("supported_candidates_low_question_alignment");
  if (/news outlets/i.test(question) && /natural dialog/i.test(referenceAnswer)) tags.push("question_entity_reference_mismatch");
  if (/performance/i.test(question) && /\b8922\b/.test(referenceAnswer)) tags.push("reference_numeric_format_risk");
  if (/model explanation output/i.test(question) && /balanced accuracy/i.test(referenceAnswer) && !/explanation/i.test(referenceAnswer)) tags.push("question_scope_metric_mismatch_risk");
  const highRiskTags = tags.filter((tag) => [
    "question_entity_reference_mismatch",
    "supported_candidates_low_reference_alignment",
    "low_reference_cited_coverage",
    "reference_numeric_format_risk",
    "question_scope_metric_mismatch_risk",
  ].includes(tag));
  return {
    is_ambiguity_risk: highRiskTags.length > 0,
    tags,
    high_risk_tags: highRiskTags,
    question_reference_overlap: round(questionReferenceOverlap),
    reference_cited_coverage: round(referenceCitedCoverage),
    max_supported_reference_overlap: round(maxSupportedReferenceOverlap),
    max_supported_question_overlap: round(maxSupportedQuestionOverlap),
  };
}

function selectorOutcome(selection, candidateAudits) {
  const candidate = candidateAudits.find((row) => row.candidate_id === selection?.selected_candidate_id);
  return {
    selected_candidate_id: selection?.selected_candidate_id ?? null,
    selected_supported_answer: Boolean(selection?.selected_supported_answer),
    selected_candidate_existing_supported: candidate?.existing_judge_supported ?? null,
    selected_reference_overlap: candidate ? round(candidate.lexical_alignment.reference_term_overlap) : null,
    selected_question_overlap: candidate ? round(candidate.lexical_alignment.question_term_overlap) : null,
  };
}

function selectorRowsFor(exampleAudit) {
  return Object.entries(exampleAudit.selector_outcomes).map(([selector, outcome]) => ({
    example_id: exampleAudit.example_id,
    selector,
    stratum: exampleAudit.ambiguity_risk.is_ambiguity_risk ? "ambiguity_risk" : "clean",
    selected_supported_answer: outcome.selected_supported_answer,
    selected_candidate_id: outcome.selected_candidate_id,
    selected_reference_overlap: outcome.selected_reference_overlap,
    selected_question_overlap: outcome.selected_question_overlap,
    ambiguity_tags: exampleAudit.ambiguity_risk.tags,
  }));
}

function buildStrataRows(exampleAudits) {
  const rows = [];
  for (const example of exampleAudits) {
    for (const [selector, outcome] of Object.entries(example.selector_outcomes)) {
      rows.push({
        example_id: example.example_id,
        stratum: example.ambiguity_risk.is_ambiguity_risk ? "ambiguity_risk" : "clean",
        selector,
        selected_supported_answer: outcome.selected_supported_answer,
        selected_reference_overlap: outcome.selected_reference_overlap,
        selected_question_overlap: outcome.selected_question_overlap,
        ambiguity_tags: example.ambiguity_risk.tags,
      });
    }
  }
  return rows;
}

function summarizeSelectors(rows) {
  const bySelector = groupBy(rows, (row) => row.selector);
  return Object.fromEntries([...bySelector.entries()].map(([selector, selectorRows]) => [selector, summarizeSelectionRows(selectorRows)]));
}

function summarizeStrata(rows) {
  const byKey = groupBy(rows, (row) => `${row.stratum}:${row.selector}`);
  return Object.fromEntries([...byKey.entries()].map(([key, keyRows]) => [key, summarizeSelectionRows(keyRows)]));
}

function summarizeSelectionRows(rows) {
  return {
    examples: rows.length,
    selected_supported: rows.filter((row) => row.selected_supported_answer).length,
    selected_supported_rate: round(rows.filter((row) => row.selected_supported_answer).length / Math.max(1, rows.length)),
    mean_selected_reference_overlap: round(mean(rows.map((row) => row.selected_reference_overlap).filter((value) => value !== null))),
    mean_selected_question_overlap: round(mean(rows.map((row) => row.selected_question_overlap).filter((value) => value !== null))),
  };
}

function diagnose(exampleAudits, selectorSummary, strataSummary) {
  const ambiguityRisk = exampleAudits.filter((row) => row.ambiguity_risk.is_ambiguity_risk);
  const clean = exampleAudits.filter((row) => !row.ambiguity_risk.is_ambiguity_risk);
  const d262 = selectorSummary.d262;
  const boundary = selectorSummary.boundary_only;
  const cleanD262 = strataSummary["clean:d262"];
  const cleanBoundary = strataSummary["clean:boundary_only"];
  const riskBoundary = strataSummary["ambiguity_risk:boundary_only"];
  return {
    primary_finding: ambiguityRisk.length ? "final_window_contains_ambiguity_risk_rows" : "final_window_no_ambiguity_risk_rows_detected",
    ambiguity_risk_examples: ambiguityRisk.length,
    clean_examples: clean.length,
    d262_selected_supported: `${d262?.selected_supported ?? 0}/${d262?.examples ?? 0}`,
    boundary_selected_supported: `${boundary?.selected_supported ?? 0}/${boundary?.examples ?? 0}`,
    clean_boundary_delta_vs_d262: (cleanD262 && cleanBoundary) ? cleanBoundary.selected_supported - cleanD262.selected_supported : null,
    ambiguity_risk_boundary_supported: riskBoundary ? `${riskBoundary.selected_supported}/${riskBoundary.examples}` : "0/0",
    interpretation: ambiguityRisk.length
      ? "The final-window support metric is partly driven by rows with question/reference or reference/candidate ambiguity, so final selection should be reported with a clean stratum before using it to justify new labels or GPU training."
      : "No ambiguity-risk rows were detected by these heuristics; remaining gaps are more likely selector or generation failures.",
  };
}

function citedEvidenceText(input, candidate) {
  const ids = new Set(candidate.citations ?? []);
  return (input.compact_retrieved_evidence_pack ?? []).filter((item) => ids.has(item.evidence_id)).map((item) => item.text).join(" ");
}

function contentTokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .match(/[a-z][a-z0-9-]{2,}|\d+(?:[.,]\d+)*(?:k|%)?/g)
    ?.map(normalizeToken)
    .filter((token) => token && !stopwords.has(token)) ?? [];
}

function normalizeToken(token) {
  if (/^\d[\d,]*(?:\.\d+)?(?:k|%)?$/.test(token)) return token.replace(/,/g, "");
  return token;
}

function stripCitationMarkers(value) {
  return String(value ?? "").replace(/\[[^\]]+\]/g, " ");
}

function overlap(source, target) {
  if (!source.length) return 0;
  const targetSet = new Set(target);
  return source.filter((token) => targetSet.has(token)).length / source.length;
}

function renderReport(result, exampleAudits) {
  return `# Final Ambiguity Stratification Audit

Generated: ${result.generated_at}

This is a zero-call final diagnostic stratification audit. It uses final-window labels only as forbidden diagnostics and makes no training or tuning decision from them.

## Summary

- Final examples: ${result.summary.final_examples}
- Final pairwise rows: ${result.summary.final_pairwise_rows}
- Ambiguity-risk examples: ${result.summary.ambiguity_risk_examples}
- Clean examples: ${result.summary.clean_examples}
- Ambiguity-risk ids: ${result.summary.ambiguity_risk_example_ids.join(", ") || "none"}

## Selector Support By Stratum

${Object.entries(result.strata_summary).map(([key, value]) => `- ${key}: ${value.selected_supported}/${value.examples} selected supported, mean reference overlap ${value.mean_selected_reference_overlap}`).join("\n")}

## Example Audit

${exampleAudits.map((row) => `- ${row.example_id}: risk=${row.ambiguity_risk.is_ambiguity_risk}, tags=${row.ambiguity_risk.tags.join(",") || "none"}, D262=${row.selector_outcomes.d262.selected_supported_answer}, boundary=${row.selector_outcomes.boundary_only.selected_supported_answer}, hybrid=${row.selector_outcomes.selected_hybrid.selected_supported_answer}`).join("\n")}

## Diagnosis

- Primary finding: ${result.diagnosis.primary_finding}
- Interpretation: ${result.diagnosis.interpretation}

## Decision

- Integrate boundary selector now: ${result.decision.integrate_boundary_selector_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Use ambiguity-risk rows for training: ${result.decision.use_ambiguity_risk_rows_for_training ? "yes" : "no"}
- Next step: ${result.decision.next_step}
`;
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
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function indexBy(rows, key) {
  return new Map(rows.map((row) => [row[key], row]));
}

function groupBy(rows, fn) {
  const grouped = new Map();
  for (const row of rows) {
    const key = fn(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

function flatten(rows) {
  return rows.flat();
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value), 0) / values.length;
}

function max(values) {
  const finite = values.filter((value) => Number.isFinite(Number(value)));
  return finite.length ? Math.max(...finite) : 0;
}

function rel(file) {
  return path.relative(rootDir, file);
}

function preview(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

function round(value, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}
