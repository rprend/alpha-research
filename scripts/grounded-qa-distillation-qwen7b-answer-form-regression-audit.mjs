import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "qwen7b-answer-form-regression-audit-v4-v9-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const systems = [
  {
    id: "qwen7b_v4_support_aware",
    short_id: "v4",
    predictionRun: "joint-action-qwen7b-v4-smoke-eval-v1-citation-repair",
    judgeRun: "openai-judge-gpt4o-joint-action-qwen7b-v4-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen7b_v5_coverage_aware",
    short_id: "v5",
    predictionRun: "joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair",
    judgeRun: "openai-judge-gpt4o-joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen7b_v6_answerability_gated",
    short_id: "v6",
    predictionRun: "joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair",
    judgeRun: "openai-judge-gpt4o-joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen7b_v7_structure_repair",
    short_id: "v7",
    predictionRun: "joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair",
    judgeRun: "openai-judge-gpt4o-joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair",
  },
  {
    id: "qwen7b_v8_repair_regeneration",
    short_id: "v8",
    predictionRun: "joint-action-qwen7b-repair-regeneration-focused-smoke-eval-v8",
    judgeRun: "openai-judge-gpt4o-joint-action-qwen7b-repair-regeneration-focused-smoke-eval-v8",
  },
  {
    id: "qwen7b_v9_span_claim",
    short_id: "v9",
    predictionRun: "joint-action-qwen7b-span-claim-construction-smoke-eval-v9-citation-repair",
    judgeRun: "openai-judge-gpt4o-joint-action-qwen7b-span-claim-v9-citation-repair",
  },
];

const v9FailureRun = "support-failure-analysis-qwen7b-span-claim-v9-citation-repair-2026-06-28-v1";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const references = await readJsonl(path.join(experimentDir, "data", "extended_temporal_future_holdout.jsonl"));
const referenceById = new Map(references.map((row) => [row.example_id, row]));
const loaded = {};
for (const system of systems) {
  loaded[system.id] = await loadSystem(system);
}
const v9Failures = await loadV9Failures();

const exampleIds = [...loaded.qwen7b_v9_span_claim.predictions.keys()];
const rows = exampleIds.map((exampleId) => rowForExample(exampleId));
const systemSummaries = Object.fromEntries(systems.map((system) => [system.id, summarizeSystem(system.id, rows)]));
const v9 = "qwen7b_v9_span_claim";
const priorIds = systems.filter((system) => system.id !== v9).map((system) => system.id);
const rowSets = buildRowSets(rows, v9, priorIds);
const oracle = candidatePoolOracle(rows);
const answerForm = answerFormSummary(rows, v9);
const coverageGap = coverageGapSummary(rows, v9, priorIds);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen7b_answer_form_regression_audit",
  status: deriveStatus({ rowSets, oracle, answerForm }),
  scope: {
    split: "extended_temporal_future_holdout",
    examples: rows.length,
    source_systems: systems,
    v9_failure_run: v9FailureRun,
  },
  system_summaries: systemSummaries,
  v9_incremental_coverage: rowSets,
  answer_form_summary: answerForm,
  coverage_gap_summary: coverageGap,
  candidate_pool_oracle: oracle,
  conclusion: deriveConclusion({ rowSets, oracle, answerForm, coverageGap }),
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit reuses existing prediction, judge, and support-failure artifacts only.",
  },
};

await writeJsonl(path.join(outputDir, "rows.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  examples: result.scope.examples,
  v9_answered: result.system_summaries.qwen7b_v9_span_claim.answered,
  v9_supported_answers: result.system_summaries.qwen7b_v9_span_claim.supported_answers,
  v9_new_supported_over_v4_v8: result.v9_incremental_coverage.v9_new_supported_answers_over_prior.count,
  oracle_answer_rate: result.candidate_pool_oracle.answer_rate,
  next_intervention: result.conclusion.next_intervention,
}, null, 2));

async function loadSystem(system) {
  const predictions = await readJsonl(path.join(runsDir, system.predictionRun, "predictions.jsonl"));
  const judgments = await readJsonl(path.join(runsDir, system.judgeRun, "judgments.jsonl"));
  return {
    predictions: new Map(predictions.map((row) => [row.example_id, row])),
    judgments: new Map(judgments.map((row) => [row.example_id, row])),
  };
}

async function loadV9Failures() {
  const rows = await readJsonl(path.join(runsDir, v9FailureRun, "rows.jsonl"));
  return new Map(rows.map((row) => [row.example_id, row]));
}

function rowForExample(exampleId) {
  const reference = referenceById.get(exampleId);
  const systemsForRow = {};
  for (const system of systems) {
    const predictionRow = loaded[system.id].predictions.get(exampleId);
    const judgmentRow = loaded[system.id].judgments.get(exampleId);
    systemsForRow[system.id] = candidateFromRows({ systemId: system.id, predictionRow, judgmentRow });
  }
  const v9Failure = v9Failures.get(exampleId) ?? null;
  return {
    example_id: exampleId,
    question: reference?.input?.question ?? "",
    counterfactual: Boolean(reference?.input?.document_metadata?.counterfactual),
    reference_answer_type: reference?.output?.answer_type ?? null,
    systems: systemsForRow,
    v9_failure_tags: v9Failure?.tags ?? [],
    v9_failure_notes: v9Failure?.notes ?? "",
  };
}

function candidateFromRows({ systemId, predictionRow, judgmentRow }) {
  const prediction = predictionRow?.prediction ?? {};
  const judgment = judgmentRow?.judgment ?? {};
  const answered = prediction.answer_type === "grounded_answer";
  const answerSupported = answered && judgment.all_claims_supported === true && judgment.citation_ids_valid !== false;
  const abstentionSupported = !answered && judgment.abstention_supported === true;
  const citations = normalizeCitations(prediction.citations);
  const answer = prediction.answer ?? "";
  return {
    system_id: systemId,
    answered,
    correct: answered ? answerSupported : abstentionSupported,
    answer_supported: answerSupported,
    abstention_supported: abstentionSupported,
    verdict: judgment.verdict ?? null,
    citations,
    citation_count: citations.length,
    answer_length_tokens: contentTokens(answer).length,
    too_short_or_yes_no: isTooShortOrYesNo(answer),
    missing_inline_citation: answered && !hasInlineCitation(answer),
    unsupported_claim_count: Array.isArray(judgment.unsupported_claims) ? judgment.unsupported_claims.length : 0,
    answer_preview: preview(answer),
  };
}

function summarizeSystem(systemId, rows) {
  return summarizeCandidates(rows.map((row) => row.systems[systemId]));
}

function summarizeCandidates(candidates) {
  const answered = candidates.filter((candidate) => candidate.answered);
  const abstained = candidates.filter((candidate) => !candidate.answered);
  const supportedAnswers = answered.filter((candidate) => candidate.answer_supported);
  const supportedAbstentions = abstained.filter((candidate) => candidate.abstention_supported);
  return {
    examples: candidates.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, candidates.length),
    supported_answers: supportedAnswers.length,
    unsupported_answers: answered.length - supportedAnswers.length,
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    supported_abstentions: supportedAbstentions.length,
    abstention_support_rate: ratio(supportedAbstentions.length, abstained.length),
    correct: supportedAnswers.length + supportedAbstentions.length,
    overall_correct_rate: ratio(supportedAnswers.length + supportedAbstentions.length, candidates.length),
  };
}

function buildRowSets(rows, v9Id, priorSystemIds) {
  const priorSupported = (row) => priorSystemIds.some((id) => row.systems[id].answer_supported);
  const priorAnswered = (row) => priorSystemIds.some((id) => row.systems[id].answered);
  const v9Answered = (row) => row.systems[v9Id].answered;
  const v9Supported = (row) => row.systems[v9Id].answer_supported;
  return {
    v9_answered: rowSet(rows, (row) => v9Answered(row)),
    v9_supported_answers: rowSet(rows, (row) => v9Supported(row)),
    v9_unsupported_answers: rowSet(rows, (row) => v9Answered(row) && !v9Supported(row)),
    v9_new_answers_over_prior: rowSet(rows, (row) => v9Answered(row) && !priorAnswered(row)),
    v9_new_supported_answers_over_prior: rowSet(rows, (row) => v9Supported(row) && !priorSupported(row)),
    v9_new_non_counterfactual_supported_answers_over_prior: rowSet(rows, (row) => !row.counterfactual && v9Supported(row) && !priorSupported(row)),
    v9_new_unsupported_answers_over_prior: rowSet(rows, (row) => v9Answered(row) && !v9Supported(row) && !priorAnswered(row)),
    v9_lost_prior_supported_answers: rowSet(rows, (row) => priorSupported(row) && !v9Supported(row)),
    v9_counterfactual_answered: rowSet(rows, (row) => row.counterfactual && v9Answered(row)),
  };
}

function answerFormSummary(rows, v9Id) {
  const answeredRows = rows.filter((row) => row.systems[v9Id].answered);
  const unsupported = answeredRows.filter((row) => !row.systems[v9Id].answer_supported);
  const tagCounts = {};
  for (const row of unsupported) {
    for (const tag of row.v9_failure_tags) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
  }
  return {
    answered: answeredRows.length,
    supported: answeredRows.filter((row) => row.systems[v9Id].answer_supported).length,
    unsupported: unsupported.length,
    too_short_or_yes_no_answers: answeredRows.filter((row) => row.systems[v9Id].too_short_or_yes_no).length,
    too_short_or_yes_no_unsupported: unsupported.filter((row) => row.systems[v9Id].too_short_or_yes_no || row.v9_failure_tags.includes("too_short_or_yes_no")).length,
    missing_inline_after_repair: answeredRows.filter((row) => row.systems[v9Id].missing_inline_citation).length,
    counterfactual_answered: answeredRows.filter((row) => row.counterfactual).length,
    unsupported_tag_counts: tagCounts,
    unsupported_example_ids: unsupported.map((row) => row.example_id),
  };
}

function coverageGapSummary(rows, v9Id, priorSystemIds) {
  const answerable = rows.filter((row) => row.reference_answer_type === "grounded_answer");
  const supportedByPrior = answerable.filter((row) => priorSystemIds.some((id) => row.systems[id].answer_supported));
  const supportedByV9 = answerable.filter((row) => row.systems[v9Id].answer_supported);
  const supportedByAny = answerable.filter((row) => row.systems[v9Id].answer_supported || priorSystemIds.some((id) => row.systems[id].answer_supported));
  return {
    reference_answerable: answerable.length,
    answerable_supported_by_prior: supportedByPrior.length,
    answerable_supported_by_v9: supportedByV9.length,
    answerable_supported_by_any_v4_v9: supportedByAny.length,
    answerable_without_supported_candidate_v4_v9: answerable.length - supportedByAny.length,
    answerable_without_supported_candidate_ids: answerable
      .filter((row) => !row.systems[v9Id].answer_supported && !priorSystemIds.some((id) => row.systems[id].answer_supported))
      .map((row) => row.example_id),
  };
}

function candidatePoolOracle(rows) {
  const selected = rows.map((row) => {
    const candidates = systems.map((system) => row.systems[system.id]);
    return candidates.find((candidate) => candidate.answer_supported)
      ?? candidates.find((candidate) => !candidate.answered && candidate.abstention_supported)
      ?? candidates[0];
  });
  return {
    id: "oracle_over_qwen7b_v4_v5_v6_v7_v8_v9_existing_candidates",
    ...summarizeCandidates(selected),
    selected_answer_ids: rows.filter((row, index) => selected[index].answered).map((row) => row.example_id),
    note: "Oracle uses held-out judge labels and is not deployable; it estimates candidate-pool headroom after adding v9.",
  };
}

function rowSet(rows, predicate) {
  const selected = rows.filter(predicate);
  return {
    count: selected.length,
    counterfactual: selected.filter((row) => row.counterfactual).length,
    example_ids: selected.map((row) => row.example_id),
  };
}

function deriveStatus({ rowSets, oracle, answerForm }) {
  if (rowSets.v9_new_non_counterfactual_supported_answers_over_prior.count === 0) return "v9_adds_no_unique_supported_coverage";
  if (oracle.answer_rate < 0.7) return "candidate_pool_still_below_coverage_target";
  if (answerForm.too_short_or_yes_no_unsupported > 0) return "answer_form_regression_blocks_deployable_selector";
  return "candidate_pool_has_supported_coverage_headroom";
}

function deriveConclusion({ rowSets, oracle, answerForm, coverageGap }) {
  const unique = rowSets.v9_new_supported_answers_over_prior.count;
  const uniqueNonCounterfactual = rowSets.v9_new_non_counterfactual_supported_answers_over_prior.count;
  const lost = rowSets.v9_lost_prior_supported_answers.count;
  const globalTargetAnswers = Math.ceil(0.7 * 69);
  const missingGlobal = Math.max(0, globalTargetAnswers - oracle.supported_answers);
  return {
    key_findings: [
      `V9 adds ${unique} unique supported answers over the existing v4-v8 Qwen 7B candidate pool, but ${uniqueNonCounterfactual} are non-counterfactual answerable rows.`,
      `V9 loses ${lost} previously supported answer opportunities when used as a standalone policy.`,
      `The v4-v9 candidate-pool oracle answers ${oracle.answered}/69 rows (${pct(oracle.answer_rate)}) with ${oracle.supported_answers} supported answers.`,
      `${answerForm.too_short_or_yes_no_unsupported}/${answerForm.unsupported} unsupported v9 answers are short, yes/no, or underspecified answer-form failures.`,
      `${coverageGap.answerable_without_supported_candidate_v4_v9} answerable final-window rows still have no supported Qwen 7B candidate across v4-v9; the candidate pool needs ${missingGlobal} more supported answers to reach a 70% answer rate on the 69-query final window.`,
    ],
    next_intervention: uniqueNonCounterfactual <= 1
      ? "Do not spend on a larger blind GPU run yet. Build answer-form-aware supervision and a support verifier that rejects short/underspecified answers, then test whether it creates new supported candidates rather than only changing abstention rate."
      : "Use v9 only as a candidate source behind a verifier; the next work should train the deployable selector rather than promote v9 directly.",
  };
}

function renderReport(result) {
  return `# Qwen 7B V4-V9 Answer-Form Regression Audit

Generated: ${result.generated_at}

## System Summary

| System | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
${Object.entries(result.system_summaries).map(([id, row]) => `| ${id} | ${pct(row.answer_rate)} | ${pct(row.answer_support_rate)} | ${pct(row.overall_correct_rate)} | ${row.supported_answers} | ${row.unsupported_answers} |`).join("\n")}

## V9 Incremental Coverage

| Row set | Count | Counterfactual |
| --- | ---: | ---: |
${Object.entries(result.v9_incremental_coverage).map(([id, row]) => `| ${id} | ${row.count} | ${row.counterfactual} |`).join("\n")}

## Answer-Form Failures

V9 answered ${result.answer_form_summary.answered} rows, with ${result.answer_form_summary.supported} supported and ${result.answer_form_summary.unsupported} unsupported answers.
Short or yes/no answer-form failures account for ${result.answer_form_summary.too_short_or_yes_no_unsupported} unsupported answers.
Counterfactual answered rows: ${result.answer_form_summary.counterfactual_answered}.

Unsupported tag counts:

${Object.entries(result.answer_form_summary.unsupported_tag_counts).map(([tag, count]) => `- ${tag}: ${count}`).join("\n")}

## Candidate-Pool Oracle

The oracle over existing v4-v9 candidates answers ${result.candidate_pool_oracle.answered}/69 rows (${pct(result.candidate_pool_oracle.answer_rate)}) with ${result.candidate_pool_oracle.supported_answers} supported answers and ${pct(result.candidate_pool_oracle.overall_correct_rate)} overall judged correctness.
This is held-out-label headroom, not a deployable policy.

## Conclusion

Status: \`${result.status}\`

${result.conclusion.key_findings.map((item) => `- ${item}`).join("\n")}

Next intervention: ${result.conclusion.next_intervention}

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

function normalizeCitations(citations) {
  if (!Array.isArray(citations)) return [];
  return citations.map((citation) => {
    if (typeof citation === "string") return citation;
    if (citation && typeof citation === "object") return citation.evidence_id ?? citation.id ?? citation.citation_id ?? "";
    return "";
  }).filter(Boolean);
}

function isTooShortOrYesNo(value) {
  const tokens = contentTokens(value);
  const compact = String(value ?? "").replace(/\[[^\]]+\]/g, "").trim().toLowerCase();
  return tokens.length <= 3 || /^(yes|no|true|false|none|unknown)[\s.,;:!]*$/i.test(compact);
}

function hasInlineCitation(value) {
  return /\[E\d+\]/.test(String(value ?? ""));
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  if (value == null || Number.isNaN(Number(value))) return "n/a";
  return `${(100 * Number(value)).toFixed(1)}%`;
}

function preview(value) {
  const compact = String(value ?? "").replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

function contentTokens(value) {
  return String(value ?? "").toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}/g) ?? [];
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
