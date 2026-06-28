import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "qwen7b-v10-postmortem-audit-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const systems = [
  ["qwen7b_v4_support_aware", "v4", "joint-action-qwen7b-v4-smoke-eval-v1-citation-repair", "openai-judge-gpt4o-joint-action-qwen7b-v4-smoke-eval-v1-citation-repair"],
  ["qwen7b_v5_coverage_aware", "v5", "joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair", "openai-judge-gpt4o-joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair"],
  ["qwen7b_v6_answerability_gated", "v6", "joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair", "openai-judge-gpt4o-joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair"],
  ["qwen7b_v7_structure_repair", "v7", "joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair", "openai-judge-gpt4o-joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair"],
  ["qwen7b_v8_repair_regeneration", "v8", "joint-action-qwen7b-repair-regeneration-focused-smoke-eval-v8", "openai-judge-gpt4o-joint-action-qwen7b-repair-regeneration-focused-smoke-eval-v8"],
  ["qwen7b_v9_span_claim", "v9", "joint-action-qwen7b-span-claim-construction-smoke-eval-v9-citation-repair", "openai-judge-gpt4o-joint-action-qwen7b-span-claim-v9-citation-repair"],
  ["qwen7b_v10_answer_completion", "v10", "joint-action-qwen7b-answer-completion-repair-smoke-eval-v10-citation-repair", "openai-judge-gpt4o-joint-action-qwen7b-answer-completion-v10-citation-repair"],
].map(([id, shortId, predictionRun, judgeRun]) => ({ id, short_id: shortId, predictionRun, judgeRun }));

const priorSystemIds = systems.filter((system) => system.short_id !== "v10").map((system) => system.id);
const v10Id = "qwen7b_v10_answer_completion";
const v10FailureRun = "support-failure-analysis-qwen7b-answer-completion-v10-citation-repair-2026-06-28-v1";
const v9RegressionRun = "qwen7b-answer-form-regression-audit-v4-v9-2026-06-28-v1";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const references = await readJsonl(path.join(experimentDir, "data", "extended_temporal_future_holdout.jsonl"));
const referenceById = new Map(references.map((row) => [row.example_id, row]));
const loaded = {};
for (const system of systems) loaded[system.id] = await loadSystem(system);
const v10Failures = await readJsonl(path.join(runsDir, v10FailureRun, "rows.jsonl"));
const v10FailuresById = new Map(v10Failures.map((row) => [row.example_id, row]));
const v9Regression = await readJson(path.join(runsDir, v9RegressionRun, "result.json"));

const exampleIds = [...loaded[v10Id].predictions.keys()];
const rows = exampleIds.map(rowForExample);
const systemSummaries = Object.fromEntries(systems.map((system) => [system.id, summarizeCandidates(rows.map((row) => row.systems[system.id]))]));
const priorOracle = candidatePoolOracle(rows, systems.filter((system) => system.short_id !== "v10"), "oracle_over_qwen7b_v4_v5_v6_v7_v8_v9_existing_candidates");
const expandedOracle = candidatePoolOracle(rows, systems, "oracle_over_qwen7b_v4_v5_v6_v7_v8_v9_v10_existing_candidates");
const incremental = incrementalCoverage(rows);
const answerForm = answerFormSummary(rows);
const coverageGap = coverageGapSummary(rows);
const failureTags = counts(v10Failures.flatMap((row) => row.supported ? [] : row.tags ?? []));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen7b_v10_postmortem_audit",
  status: deriveStatus({ incremental, expandedOracle }),
  scope: {
    split: "extended_temporal_future_holdout",
    examples: rows.length,
    source_systems: systems,
    v10_failure_run: v10FailureRun,
    v9_regression_run: v9RegressionRun,
  },
  system_summaries: systemSummaries,
  v10_incremental_coverage: incremental,
  answer_form_summary: answerForm,
  coverage_gap_summary: coverageGap,
  prior_v4_v9_oracle: priorOracle,
  expanded_v4_v10_oracle: expandedOracle,
  oracle_delta_from_v10: {
    supported_answers: expandedOracle.supported_answers - priorOracle.supported_answers,
    answered: expandedOracle.answered - priorOracle.answered,
    answer_rate: expandedOracle.answer_rate - priorOracle.answer_rate,
    overall_correct_rate: expandedOracle.overall_correct_rate - priorOracle.overall_correct_rate,
  },
  v10_failure_tag_counts: failureTags,
  conclusion: deriveConclusion({ incremental, coverageGap, priorOracle, expandedOracle, answerForm }),
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit reuses existing prediction, judge, support-failure, and v4-v9 audit artifacts only.",
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
  v10_supported_answers: result.system_summaries[v10Id].supported_answers,
  v10_unique_supported_over_v4_v9: result.v10_incremental_coverage.v10_new_supported_answers_over_prior.count,
  expanded_oracle_answer_rate: result.expanded_v4_v10_oracle.answer_rate,
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

function rowForExample(exampleId) {
  const reference = referenceById.get(exampleId);
  const row = {
    example_id: exampleId,
    counterfactual: Boolean(reference?.input?.document_metadata?.counterfactual),
    reference_answer_type: reference?.output?.answer_type ?? null,
    question: reference?.input?.question ?? "",
    systems: {},
    v10_failure_tags: v10FailuresById.get(exampleId)?.tags ?? [],
  };
  for (const system of systems) {
    row.systems[system.id] = candidateFromRows({
      systemId: system.id,
      predictionRow: loaded[system.id].predictions.get(exampleId),
      judgmentRow: loaded[system.id].judgments.get(exampleId),
    });
  }
  return row;
}

function candidateFromRows({ systemId, predictionRow, judgmentRow }) {
  const prediction = predictionRow?.prediction ?? {};
  const judgment = judgmentRow?.judgment ?? {};
  const answered = prediction.answer_type === "grounded_answer";
  const answerSupported = answered
    && String(judgment.verdict ?? "").toLowerCase() === "supported"
    && judgment.all_claims_supported === true
    && judgment.citation_ids_valid !== false;
  const abstentionSupported = !answered && judgment.abstention_supported === true;
  const answer = String(prediction.answer ?? "");
  return {
    system_id: systemId,
    answered,
    correct: answered ? answerSupported : abstentionSupported,
    answer_supported: answerSupported,
    abstention_supported: abstentionSupported,
    verdict: judgment.verdict ?? null,
    citation_ids_valid: judgment.citation_ids_valid ?? null,
    citations: normalizeCitations(prediction.citations),
    answer_length_tokens: contentTokens(answer).length,
    too_short_or_yes_no: isTooShortOrYesNo(answer),
    missing_inline_citation: answered && !/\[E\d+\]/.test(answer),
    unsupported_claim_count: Array.isArray(judgment.unsupported_claims) ? judgment.unsupported_claims.length : 0,
    answer_preview: preview(answer),
  };
}

function incrementalCoverage(rows) {
  const priorSupported = (row) => priorSystemIds.some((id) => row.systems[id].answer_supported);
  const priorAnswered = (row) => priorSystemIds.some((id) => row.systems[id].answered);
  const v10 = (row) => row.systems[v10Id];
  const oracleGapIds = new Set(v9Regression.coverage_gap_summary?.answerable_without_supported_candidate_ids ?? []);
  return {
    v10_answered: rowSet(rows, (row) => v10(row).answered),
    v10_supported_answers: rowSet(rows, (row) => v10(row).answer_supported),
    v10_unsupported_answers: rowSet(rows, (row) => v10(row).answered && !v10(row).answer_supported),
    v10_new_answers_over_prior: rowSet(rows, (row) => v10(row).answered && !priorAnswered(row)),
    v10_new_supported_answers_over_prior: rowSet(rows, (row) => v10(row).answer_supported && !priorSupported(row)),
    v10_new_non_counterfactual_supported_answers_over_prior: rowSet(rows, (row) => !row.counterfactual && v10(row).answer_supported && !priorSupported(row)),
    v10_supported_on_v4_v9_oracle_gap: rowSet(rows, (row) => oracleGapIds.has(row.example_id) && v10(row).answer_supported),
    v10_unsupported_on_v4_v9_oracle_gap: rowSet(rows, (row) => oracleGapIds.has(row.example_id) && v10(row).answered && !v10(row).answer_supported),
    v10_lost_prior_supported_answers: rowSet(rows, (row) => priorSupported(row) && !v10(row).answer_supported),
    v10_counterfactual_answered: rowSet(rows, (row) => row.counterfactual && v10(row).answered),
  };
}

function answerFormSummary(rows) {
  const answeredRows = rows.filter((row) => row.systems[v10Id].answered);
  const unsupported = answeredRows.filter((row) => !row.systems[v10Id].answer_supported);
  return {
    answered: answeredRows.length,
    supported: answeredRows.length - unsupported.length,
    unsupported: unsupported.length,
    too_short_or_yes_no_answers: answeredRows.filter((row) => row.systems[v10Id].too_short_or_yes_no).length,
    too_short_or_yes_no_unsupported: unsupported.filter((row) => row.systems[v10Id].too_short_or_yes_no || row.v10_failure_tags.includes("too_short_or_yes_no")).length,
    missing_inline_after_repair: answeredRows.filter((row) => row.systems[v10Id].missing_inline_citation).length,
    counterfactual_answered: answeredRows.filter((row) => row.counterfactual).length,
    invalid_citation_verdicts: answeredRows.filter((row) => row.systems[v10Id].citation_ids_valid === false).length,
    unsupported_example_ids: unsupported.map((row) => row.example_id),
  };
}

function coverageGapSummary(rows) {
  const answerable = rows.filter((row) => row.reference_answer_type === "grounded_answer");
  const priorSupported = answerable.filter((row) => priorSystemIds.some((id) => row.systems[id].answer_supported));
  const v10Supported = answerable.filter((row) => row.systems[v10Id].answer_supported);
  const anySupported = answerable.filter((row) => row.systems[v10Id].answer_supported || priorSystemIds.some((id) => row.systems[id].answer_supported));
  const globalTargetAnswers = Math.ceil(0.7 * rows.length);
  return {
    reference_answerable: answerable.length,
    answerable_supported_by_v4_v9: priorSupported.length,
    answerable_supported_by_v10: v10Supported.length,
    answerable_supported_by_any_v4_v10: anySupported.length,
    answerable_without_supported_candidate_v4_v10: answerable.length - anySupported.length,
    supported_answers_needed_for_70pct_query_rate: Math.max(0, globalTargetAnswers - anySupported.length),
    answerable_without_supported_candidate_ids: answerable
      .filter((row) => !row.systems[v10Id].answer_supported && !priorSystemIds.some((id) => row.systems[id].answer_supported))
      .map((row) => row.example_id),
  };
}

function candidatePoolOracle(rows, sourceSystems, id) {
  const selected = rows.map((row) => {
    const candidates = sourceSystems.map((system) => row.systems[system.id]);
    return candidates.find((candidate) => candidate.answer_supported)
      ?? candidates.find((candidate) => !candidate.answered && candidate.abstention_supported)
      ?? candidates[0];
  });
  return {
    id,
    ...summarizeCandidates(selected),
    selected_answer_ids: rows.filter((row, index) => selected[index].answered).map((row) => row.example_id),
    meets_70pct_answer_rate: ratio(selected.filter((candidate) => candidate.answered).length, selected.length) >= 0.7,
    note: "Oracle uses held-out judge labels and is not deployable; it estimates candidate-pool headroom.",
  };
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

function deriveStatus({ incremental, expandedOracle }) {
  if (incremental.v10_new_non_counterfactual_supported_answers_over_prior.count === 0) return "v10_adds_no_new_supported_answerable_coverage";
  if (expandedOracle.answer_rate < 0.7) return "expanded_candidate_pool_still_below_coverage_target";
  return "v10_adds_candidate_pool_headroom_but_needs_selector";
}

function deriveConclusion({ incremental, coverageGap, priorOracle, expandedOracle, answerForm }) {
  const unique = incremental.v10_new_supported_answers_over_prior.count;
  const uniqueNonCounterfactual = incremental.v10_new_non_counterfactual_supported_answers_over_prior.count;
  const gapFilled = incremental.v10_supported_on_v4_v9_oracle_gap.count;
  const oracleDelta = expandedOracle.supported_answers - priorOracle.supported_answers;
  return {
    key_findings: [
      `V10 adds ${unique} unique supported answers over the v4-v9 Qwen 7B pool; ${uniqueNonCounterfactual} are non-counterfactual answerable rows.`,
      `V10 fills ${gapFilled} v4-v9 oracle-gap answerable rows, while ${coverageGap.answerable_without_supported_candidate_v4_v10} answerable rows still lack any supported Qwen 7B candidate.`,
      `The expanded v4-v10 oracle answers ${expandedOracle.answered}/69 rows (${pct(expandedOracle.answer_rate)}), a ${signed(oracleDelta)} supported-answer delta from the v4-v9 oracle.`,
      `V10 as a standalone model still has ${answerForm.unsupported}/${answerForm.answered} unsupported answered rows and ${answerForm.counterfactual_answered} counterfactual answered rows.`,
      `The candidate pool still needs ${coverageGap.supported_answers_needed_for_70pct_query_rate} more supported answerable candidates to hit the 70% query-level target.`,
    ],
    next_intervention: uniqueNonCounterfactual <= 1
      ? "Do not launch another GPU job yet. First build a zero-cost oracle-gap repair audit that inspects the remaining answerable rows without supported Qwen 7B candidates and separates recoverable gold-span rows from genuinely evidence-insufficient or multi-hop rows."
      : "Use v10 only as another candidate source behind a selector; the next work should train or audit the selector before any larger model run.",
  };
}

function renderReport(result) {
  return `# Qwen 7B V10 Postmortem Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## System Summary

| System | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
${Object.entries(result.system_summaries).map(([id, row]) => `| ${id} | ${pct(row.answer_rate)} | ${pct(row.answer_support_rate)} | ${pct(row.overall_correct_rate)} | ${row.supported_answers} | ${row.unsupported_answers} |`).join("\n")}

## V10 Incremental Coverage

| Row set | Count | Counterfactual |
| --- | ---: | ---: |
${Object.entries(result.v10_incremental_coverage).map(([id, row]) => `| ${id} | ${row.count} | ${row.counterfactual} |`).join("\n")}

## Oracle Delta

| Oracle | Answered | Answer rate | Supported answers | Overall correct |
| --- | ---: | ---: | ---: | ---: |
| v4-v9 | ${result.prior_v4_v9_oracle.answered} | ${pct(result.prior_v4_v9_oracle.answer_rate)} | ${result.prior_v4_v9_oracle.supported_answers} | ${pct(result.prior_v4_v9_oracle.overall_correct_rate)} |
| v4-v10 | ${result.expanded_v4_v10_oracle.answered} | ${pct(result.expanded_v4_v10_oracle.answer_rate)} | ${result.expanded_v4_v10_oracle.supported_answers} | ${pct(result.expanded_v4_v10_oracle.overall_correct_rate)} |

## Failure Tags

${Object.entries(result.v10_failure_tag_counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, count]) => `- ${tag}: ${count}`).join("\n")}

## Conclusion

${result.conclusion.key_findings.map((item) => `- ${item}`).join("\n")}

Next intervention: ${result.conclusion.next_intervention}

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

function rowSet(rows, predicate) {
  const selected = rows.filter(predicate);
  return {
    count: selected.length,
    counterfactual: selected.filter((row) => row.counterfactual).length,
    example_ids: selected.map((row) => row.example_id),
  };
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

function contentTokens(value) {
  return String(value ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").split(/[^a-z0-9]+/).filter((token) => token.length > 2);
}

function counts(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  if (value == null || Number.isNaN(Number(value))) return "n/a";
  return `${(100 * Number(value)).toFixed(1)}%`;
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function preview(value) {
  const compact = String(value ?? "").replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
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
