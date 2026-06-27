import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "qwen7b-tradeoff-audit-v4-v5-v6-2026-06-27-v1";
const outputDir = path.join(runsDir, runId);
const systems = [
  {
    id: "qwen7b_v4_support_aware",
    predictionRun: "joint-action-qwen7b-v4-smoke-eval-v1-citation-repair",
    judgeRun: "openai-judge-gpt4o-joint-action-qwen7b-v4-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen7b_v5_coverage_aware",
    predictionRun: "joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair",
    judgeRun: "openai-judge-gpt4o-joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen7b_v6_answerability_gated",
    predictionRun: "joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair",
    judgeRun: "openai-judge-gpt4o-joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair",
  },
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const references = await readJsonl(path.join(experimentDir, "data", "extended_temporal_future_holdout.jsonl"));
const referenceById = new Map(references.map((row) => [row.example_id, row]));
const loaded = {};
for (const system of systems) {
  loaded[system.id] = await loadSystem(system);
}

const exampleIds = [...loaded.qwen7b_v4_support_aware.predictions.keys()];
const rows = exampleIds.map((exampleId) => rowForExample(exampleId));
const systemSummaries = Object.fromEntries(systems.map((system) => [system.id, summarizeSystem(system.id, rows)]));
const pairwise = {
  v4_to_v5: transitionSummary(rows, "qwen7b_v4_support_aware", "qwen7b_v5_coverage_aware"),
  v5_to_v6: transitionSummary(rows, "qwen7b_v5_coverage_aware", "qwen7b_v6_answerability_gated"),
  v4_to_v6: transitionSummary(rows, "qwen7b_v4_support_aware", "qwen7b_v6_answerability_gated"),
};
const selectorPolicies = [
  selectorPolicy("v4_baseline", rows, (row) => row.systems.qwen7b_v4_support_aware),
  selectorPolicy("v5_baseline", rows, (row) => row.systems.qwen7b_v5_coverage_aware),
  selectorPolicy("v6_baseline", rows, (row) => row.systems.qwen7b_v6_answerability_gated),
  selectorPolicy("majority_answer_priority_v4_v6_v5", rows, (row) => {
    const answering = systems.map((system) => row.systems[system.id]).filter((candidate) => candidate.answered);
    if (answering.length >= 2) {
      return row.systems.qwen7b_v4_support_aware.answered
        ? row.systems.qwen7b_v4_support_aware
        : row.systems.qwen7b_v6_answerability_gated.answered
          ? row.systems.qwen7b_v6_answerability_gated
          : row.systems.qwen7b_v5_coverage_aware;
    }
    return abstainCandidate(row.example_id, "majority_answer_priority_v4_v6_v5");
  }),
  selectorPolicy("v4_plus_v5_when_v6_also_answers", rows, (row) => {
    if (row.systems.qwen7b_v4_support_aware.answered) return row.systems.qwen7b_v4_support_aware;
    if (row.systems.qwen7b_v5_coverage_aware.answered && row.systems.qwen7b_v6_answerability_gated.answered) return row.systems.qwen7b_v5_coverage_aware;
    return abstainCandidate(row.example_id, "v4_plus_v5_when_v6_also_answers");
  }),
  selectorPolicy("v4_plus_v5_non_counterfactual", rows, (row) => {
    if (row.systems.qwen7b_v4_support_aware.answered) return row.systems.qwen7b_v4_support_aware;
    if (!row.counterfactual && row.systems.qwen7b_v5_coverage_aware.answered) return row.systems.qwen7b_v5_coverage_aware;
    return abstainCandidate(row.example_id, "v4_plus_v5_non_counterfactual");
  }),
  oraclePolicy(rows),
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen7b_tradeoff_audit",
  source_systems: systems,
  examples: rows.length,
  system_summaries: systemSummaries,
  pairwise_transitions: pairwise,
  selector_policies: selectorPolicies,
  row_sets: {
    v5_new_answers_over_v4: rowSet(rows, (row) => !row.systems.qwen7b_v4_support_aware.answered && row.systems.qwen7b_v5_coverage_aware.answered),
    v5_new_supported_answers_over_v4: rowSet(rows, (row) => !row.systems.qwen7b_v4_support_aware.answered && row.systems.qwen7b_v5_coverage_aware.answer_supported),
    v5_new_unsupported_answers_over_v4: rowSet(rows, (row) => !row.systems.qwen7b_v4_support_aware.answered && row.systems.qwen7b_v5_coverage_aware.answered && !row.systems.qwen7b_v5_coverage_aware.answer_supported),
    v6_suppressed_v5_answers: rowSet(rows, (row) => row.systems.qwen7b_v5_coverage_aware.answered && !row.systems.qwen7b_v6_answerability_gated.answered),
    v6_useful_suppressions_vs_v5: rowSet(rows, (row) => row.systems.qwen7b_v5_coverage_aware.answered && !row.systems.qwen7b_v6_answerability_gated.answered && !row.systems.qwen7b_v5_coverage_aware.answer_supported),
    v6_harmful_suppressions_vs_v5: rowSet(rows, (row) => row.systems.qwen7b_v5_coverage_aware.answer_supported && !row.systems.qwen7b_v6_answerability_gated.answered),
  },
  conclusion: deriveConclusion({ systemSummaries, pairwise, selectorPolicies }),
  budget: {
    openai_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit reuses existing Qwen 7B prediction and judge artifacts only.",
  },
};

await writeJsonl(path.join(outputDir, "rows.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  examples: result.examples,
  selector_policies: result.selector_policies.map((policy) => ({
    id: policy.id,
    answer_rate: policy.answer_rate,
    answer_support_rate: policy.answer_support_rate,
    overall_correct_rate: policy.overall_correct_rate,
  })),
  conclusion: result.conclusion.status,
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
  const systemsForRow = {};
  for (const system of systems) {
    const predictionRow = loaded[system.id].predictions.get(exampleId);
    const judgmentRow = loaded[system.id].judgments.get(exampleId);
    systemsForRow[system.id] = candidateFromRows({ systemId: system.id, predictionRow, judgmentRow });
  }
  return {
    example_id: exampleId,
    counterfactual: Boolean(reference?.input?.document_metadata?.counterfactual),
    reference_answer_type: reference?.output?.answer_type ?? null,
    question: reference?.input?.question ?? "",
    systems: systemsForRow,
  };
}

function candidateFromRows({ systemId, predictionRow, judgmentRow }) {
  const prediction = predictionRow?.prediction ?? {};
  const judgment = judgmentRow?.judgment ?? {};
  const answered = prediction.answer_type === "grounded_answer";
  const answerSupported = answered && judgment.all_claims_supported === true && judgment.citation_ids_valid !== false;
  const abstentionSupported = !answered && judgment.abstention_supported === true;
  return {
    system_id: systemId,
    answered,
    correct: answered ? answerSupported : abstentionSupported,
    answer_supported: answerSupported,
    abstention_supported: abstentionSupported,
    verdict: judgment.verdict ?? null,
    citations: Array.isArray(prediction.citations) ? prediction.citations : [],
    answer_length_tokens: contentTokens(prediction.answer ?? "").length,
    unsupported_claim_count: Array.isArray(judgment.unsupported_claims) ? judgment.unsupported_claims.length : 0,
    answer_preview: preview(prediction.answer ?? ""),
  };
}

function summarizeSystem(systemId, rows) {
  const candidates = rows.map((row) => row.systems[systemId]);
  return summarizeCandidates(candidates);
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
    abstention_support_rate: ratio(supportedAbstentions.length, abstained.length),
    correct: supportedAnswers.length + supportedAbstentions.length,
    overall_correct_rate: ratio(supportedAnswers.length + supportedAbstentions.length, candidates.length),
  };
}

function transitionSummary(rows, fromId, toId) {
  const changed = rows.filter((row) => row.systems[fromId].answered !== row.systems[toId].answered);
  const newlyAnswered = rows.filter((row) => !row.systems[fromId].answered && row.systems[toId].answered);
  const newlyAbstained = rows.filter((row) => row.systems[fromId].answered && !row.systems[toId].answered);
  return {
    changed_answer_decisions: changed.length,
    newly_answered: summarizeTransitionRows(newlyAnswered, toId),
    newly_abstained: summarizeSuppressionRows(newlyAbstained, fromId),
    retained_answered: summarizeCandidates(rows.filter((row) => row.systems[fromId].answered && row.systems[toId].answered).map((row) => row.systems[toId])),
  };
}

function summarizeTransitionRows(rows, systemId) {
  return {
    rows: rows.length,
    supported: rows.filter((row) => row.systems[systemId].answer_supported).length,
    unsupported: rows.filter((row) => row.systems[systemId].answered && !row.systems[systemId].answer_supported).length,
    counterfactual_rows: rows.filter((row) => row.counterfactual).length,
    example_ids: rows.map((row) => row.example_id),
  };
}

function summarizeSuppressionRows(rows, fromId) {
  return {
    rows: rows.length,
    useful_suppressions: rows.filter((row) => !row.systems[fromId].answer_supported).length,
    harmful_suppressions: rows.filter((row) => row.systems[fromId].answer_supported).length,
    counterfactual_rows: rows.filter((row) => row.counterfactual).length,
    example_ids: rows.map((row) => row.example_id),
  };
}

function selectorPolicy(id, rows, choose) {
  const selected = rows.map((row) => choose(row));
  return {
    id,
    ...summarizeCandidates(selected),
    selected_answer_ids: rows.filter((row, index) => selected[index].answered).map((row) => row.example_id),
    note: "Policy is evaluated by inheriting existing GPT-4o judgments for the selected Qwen candidate or treating synthetic abstention as correct only on reference-abstain rows.",
  };
}

function oraclePolicy(rows) {
  const selected = rows.map((row) => {
    const candidates = systems.map((system) => row.systems[system.id]);
    const supported = candidates.find((candidate) => candidate.answer_supported);
    if (supported) return supported;
    const correctAbstention = candidates.find((candidate) => !candidate.answered && candidate.abstention_supported);
    if (correctAbstention) return correctAbstention;
    return candidates[0];
  });
  return {
    id: "oracle_over_v4_v5_v6_existing_candidates",
    ...summarizeCandidates(selected),
    selected_answer_ids: rows.filter((row, index) => selected[index].answered).map((row) => row.example_id),
    note: "Oracle uses held-out judge labels and is not deployable; it estimates candidate-pool headroom before another GPU run.",
  };
}

function abstainCandidate(exampleId, systemId) {
  const reference = referenceById.get(exampleId);
  const correct = reference?.output?.answer_type === "abstain";
  return {
    system_id: systemId,
    answered: false,
    correct,
    answer_supported: false,
    abstention_supported: correct,
    verdict: correct ? "abstention_supported" : "abstention_unsupported",
    citations: [],
    answer_length_tokens: 0,
    unsupported_claim_count: 0,
    answer_preview: "",
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

function deriveConclusion({ systemSummaries, pairwise, selectorPolicies }) {
  const oracle = selectorPolicies.find((policy) => policy.id === "oracle_over_v4_v5_v6_existing_candidates");
  const bestDeployable = selectorPolicies
    .filter((policy) => policy.id !== "oracle_over_v4_v5_v6_existing_candidates")
    .sort((a, b) => b.overall_correct_rate - a.overall_correct_rate || b.answer_rate - a.answer_rate)[0];
  return {
    status: "candidate_pool_has_headroom_but_simple_agreement_selectors_do_not_solve_coverage",
    key_findings: [
      `V5 newly answers ${pairwise.v4_to_v5.newly_answered.rows} rows over v4, but only ${pairwise.v4_to_v5.newly_answered.supported} of those are supported.`,
      `V6 suppresses ${pairwise.v5_to_v6.newly_abstained.rows} v5 answers, with ${pairwise.v5_to_v6.newly_abstained.useful_suppressions} useful and ${pairwise.v5_to_v6.newly_abstained.harmful_suppressions} harmful suppressions.`,
      `The oracle over existing v4/v5/v6 candidates reaches ${pct(oracle.overall_correct_rate)} correctness at ${pct(oracle.answer_rate)} answer rate, so the candidate pool has some headroom.`,
      `The best tested deployable agreement selector is ${bestDeployable.id}, reaching ${pct(bestDeployable.overall_correct_rate)} correctness at ${pct(bestDeployable.answer_rate)} answer rate.`,
    ],
    next_intervention: "Do not run another blanket coverage or hard-gate curriculum. Build a soft answerability target or selector that learns which v5 recovered answers are safe, using train/validation support labels and features that distinguish the few supported recovered answers from the larger unsupported set.",
    baseline_metrics: {
      v4: systemSummaries.qwen7b_v4_support_aware,
      v5: systemSummaries.qwen7b_v5_coverage_aware,
      v6: systemSummaries.qwen7b_v6_answerability_gated,
    },
  };
}

function renderReport(result) {
  return `# Qwen 7B V4/V5/V6 Tradeoff Audit

Generated: ${result.generated_at}

## System Summary

| System | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
${Object.entries(result.system_summaries).map(([id, row]) => `| ${id} | ${pct(row.answer_rate)} | ${pct(row.answer_support_rate)} | ${pct(row.overall_correct_rate)} | ${row.supported_answers} | ${row.unsupported_answers} |`).join("\n")}

## Transitions

| Transition | Newly answered | Supported newly answered | Newly abstained | Useful suppressions | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: |
| v4 -> v5 | ${result.pairwise_transitions.v4_to_v5.newly_answered.rows} | ${result.pairwise_transitions.v4_to_v5.newly_answered.supported} | ${result.pairwise_transitions.v4_to_v5.newly_abstained.rows} | ${result.pairwise_transitions.v4_to_v5.newly_abstained.useful_suppressions} | ${result.pairwise_transitions.v4_to_v5.newly_abstained.harmful_suppressions} |
| v5 -> v6 | ${result.pairwise_transitions.v5_to_v6.newly_answered.rows} | ${result.pairwise_transitions.v5_to_v6.newly_answered.supported} | ${result.pairwise_transitions.v5_to_v6.newly_abstained.rows} | ${result.pairwise_transitions.v5_to_v6.newly_abstained.useful_suppressions} | ${result.pairwise_transitions.v5_to_v6.newly_abstained.harmful_suppressions} |
| v4 -> v6 | ${result.pairwise_transitions.v4_to_v6.newly_answered.rows} | ${result.pairwise_transitions.v4_to_v6.newly_answered.supported} | ${result.pairwise_transitions.v4_to_v6.newly_abstained.rows} | ${result.pairwise_transitions.v4_to_v6.newly_abstained.useful_suppressions} | ${result.pairwise_transitions.v4_to_v6.newly_abstained.harmful_suppressions} |

## Selector Diagnostics

| Policy | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
${result.selector_policies.map((row) => `| ${row.id} | ${pct(row.answer_rate)} | ${pct(row.answer_support_rate)} | ${pct(row.overall_correct_rate)} | ${row.supported_answers} | ${row.unsupported_answers} |`).join("\n")}

## Conclusion

Status: \`${result.conclusion.status}\`

${result.conclusion.key_findings.map((item) => `- ${item}`).join("\n")}

Next intervention: ${result.conclusion.next_intervention}

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
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
  return String(value ?? "").toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [];
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
