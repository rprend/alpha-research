import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "extended_temporal_future_holdout";
const evalOffset = numberArg(args["eval-offset"], 320, { allowZero: true });
const evalLimit = numberArg(args["eval-limit"], 69);
const runId = args["run-id"] ?? "expanded-candidate-pool-audit-final-window-v1";
const outputDir = path.join(runsDir, runId);

const candidateSpecs = [
  {
    id: "direct_mini_repair",
    family: "openai_mini_scaffold",
    predictionRunId: "citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
    judgeRunId: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
  },
  {
    id: "balanced_risk_gate",
    family: "openai_mini_scaffold",
    predictionRunId: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    judgeRunId: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  },
  {
    id: "claim_entailment_guard",
    family: "openai_mini_scaffold",
    predictionRunId: "claim-entailment-guard-balanced-risk-gate-240-389-v1",
    judgeRunId: "openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1",
    predictionFilter: (row) => row.window === "321-389",
  },
  {
    id: "qwen3b_v1",
    family: "qwen3b_lora",
    predictionRunId: "joint-action-qwen3b-smoke-eval-v1-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen3b-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen3b_v3",
    family: "qwen3b_lora",
    predictionRunId: "joint-action-qwen3b-v3-smoke-eval-v1-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen3b-v3-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen3b_v4",
    family: "qwen3b_lora",
    predictionRunId: "joint-action-qwen3b-v4-smoke-eval-v1-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen3b-v4-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen7b_v4",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-v4-smoke-eval-v1-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-v4-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen7b_v5",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen7b_v6",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen7b_v7",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair",
  },
  {
    id: "qwen7b_v8",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-repair-regeneration-focused-smoke-eval-v8",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-repair-regeneration-focused-smoke-eval-v8",
  },
  {
    id: "qwen7b_v9",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-span-claim-construction-smoke-eval-v9-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-span-claim-v9-citation-repair",
  },
  {
    id: "qwen7b_v10",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-answer-completion-repair-smoke-eval-v10-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-answer-completion-v10-citation-repair",
  },
  {
    id: "qwen7b_v11",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-mixed-metric-repair-smoke-eval-v11-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-mixed-metric-v11-citation-repair",
  },
];

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const references = (await readJsonl(path.join(dataDir, `${split}.jsonl`))).slice(evalOffset, evalOffset + evalLimit);
const referencesById = new Map(references.map((row) => [row.example_id, row]));
const loadedCandidates = await Promise.all(candidateSpecs.map(loadCandidateSpec));
const rows = references.map((reference) => buildAuditRow(reference, loadedCandidates));
const oracleRows = rows.map(selectOracleRow);
const heuristicRows = rows.map(selectHeuristicRow);
const scaffoldRows = rows.map((row) => selectPriorityRow(row, ["claim_entailment_guard", "balanced_risk_gate", "direct_mini_repair"]));
const qwenOnlyOracleRows = rows.map((row) => selectOracleRow({
  ...row,
  candidates: row.candidates.filter((candidate) => candidate.family.startsWith("qwen")),
}));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "expanded_candidate_pool_audit",
  status: statusFor({
    expandedOracle: summarizeSelections(oracleRows),
    scaffoldSelector: summarizeSelections(scaffoldRows),
  }),
  purpose: "Zero-call audit over already-judged final-window candidates. It estimates the support-aware selection upper bound across Qwen and cheaper scaffold outputs, then compares it with the deployable scaffold priority baseline.",
  split,
  eval_offset: evalOffset,
  examples: references.length,
  candidate_specs: candidateSpecs.map(({ predictionFilter, ...spec }) => spec),
  candidate_family_metrics: summarizeCandidateFamilies(rows),
  selection_metrics: {
    expanded_judged_oracle: summarizeSelections(oracleRows),
    expanded_heuristic_selector: summarizeSelections(heuristicRows),
    qwen_only_judged_oracle: summarizeSelections(qwenOnlyOracleRows),
    scaffold_priority_selector: summarizeSelections(scaffoldRows),
  },
  oracle_gap: oracleGap({
    expandedOracle: summarizeSelections(oracleRows),
    scaffoldSelector: summarizeSelections(scaffoldRows),
    qwenOnlyOracle: summarizeSelections(qwenOnlyOracleRows),
  }),
  qwen_unique_supported_answers: uniqueSupportedAnswers(rows, "qwen"),
  decision_implications: decisionImplications(rows, oracleRows, scaffoldRows),
  artifacts: {
    predictions_jsonl: path.relative(rootDir, path.join(outputDir, "predictions.jsonl")),
    report_md: path.relative(rootDir, path.join(outputDir, "report.md")),
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    external_compute_actual_usd: budget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit reads existing prediction and judge artifacts only.",
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), oracleRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selection_metrics: result.selection_metrics,
  qwen_unique_supported_answers: result.qwen_unique_supported_answers.count,
}, null, 2));

async function loadCandidateSpec(spec) {
  const predictionRows = (await readJsonl(path.join(runsDir, spec.predictionRunId, "predictions.jsonl")))
    .filter(spec.predictionFilter ?? (() => true));
  const judgmentRows = (await readJsonl(path.join(runsDir, spec.judgeRunId, "judgments.jsonl")))
    .filter((row) => predictionRows.some((predictionRow) => predictionRow.example_id === row.example_id));
  return {
    ...spec,
    predictions: new Map(predictionRows.map((row) => [row.example_id, row])),
    judgments: new Map(judgmentRows.map((row) => [row.example_id, row])),
  };
}

function buildAuditRow(reference, loaded) {
  const candidates = loaded.flatMap((spec) => {
    const predictionRow = spec.predictions.get(reference.example_id);
    const judgmentRow = spec.judgments.get(reference.example_id);
    if (!predictionRow || !judgmentRow) return [];
    const prediction = normalizePrediction(predictionRow.prediction ?? {});
    const scores = scorePrediction(reference, prediction);
    const supportedAnswer = prediction.answer_type === "grounded_answer" && isSupportedAnswer(judgmentRow.judgment);
    const supportedAbstention = prediction.answer_type === "abstain" && isSupportedAbstention(judgmentRow.judgment);
    return [{
      id: spec.id,
      family: spec.family,
      prediction_run_id: spec.predictionRunId,
      judge_run_id: spec.judgeRunId,
      prediction,
      judgment: judgmentRow.judgment,
      answered: prediction.answer_type === "grounded_answer",
      supported_answer: supportedAnswer,
      supported_abstention: supportedAbstention,
      judged_correct: supportedAnswer || supportedAbstention,
      answer_type_correct: prediction.answer_type === reference.output.answer_type,
      inline_complete: inlineComplete(prediction),
      scores,
      heuristic_score: heuristicScore(reference, prediction, spec),
    }];
  });
  return {
    example_id: reference.example_id,
    reference: {
      answer_type: reference.output.answer_type,
      answer: reference.output.answer,
      citations: (reference.output.citations ?? []).map((citation) => citation.evidence_id),
    },
    candidates,
  };
}

function selectOracleRow(row) {
  const supportedAnswers = row.candidates.filter((candidate) => candidate.supported_answer && candidate.inline_complete);
  const correctAbstentions = row.candidates.filter((candidate) => candidate.supported_abstention);
  const pool = supportedAnswers.length ? supportedAnswers : correctAbstentions;
  const selected = pool.sort(compareOracleCandidates)[0] ?? row.candidates.sort((a, b) => b.heuristic_score - a.heuristic_score)[0];
  return selectionRow(row, selected, "expanded_judged_oracle");
}

function selectHeuristicRow(row) {
  const selected = row.candidates
    .filter((candidate) => candidate.inline_complete)
    .sort((a, b) => b.heuristic_score - a.heuristic_score)[0]
    ?? row.candidates.sort((a, b) => b.heuristic_score - a.heuristic_score)[0];
  return selectionRow(row, selected, "expanded_heuristic_selector");
}

function selectPriorityRow(row, priority) {
  const selected = priority.map((id) => row.candidates.find((candidate) => candidate.id === id)).find(Boolean)
    ?? row.candidates[0];
  return selectionRow(row, selected, "scaffold_priority_selector");
}

function selectionRow(row, selected, selectorType) {
  return {
    example_id: row.example_id,
    selector_type: selectorType,
    selected_candidate_id: selected?.id ?? null,
    selected_family: selected?.family ?? null,
    prediction: selected?.prediction ?? null,
    reference: row.reference,
    inherited_judgment: selected?.judgment ?? null,
    scores: selected?.scores ?? null,
    selection_scores: {
      supported_answer: selected?.supported_answer ?? false,
      supported_abstention: selected?.supported_abstention ?? false,
      judged_correct: selected?.judged_correct ?? false,
      answer_type_correct: selected?.answer_type_correct ?? false,
      inline_complete: selected?.inline_complete ?? false,
      heuristic_score: selected?.heuristic_score ?? null,
    },
    candidate_summary: Object.fromEntries(row.candidates.map((candidate) => [candidate.id, {
      family: candidate.family,
      answered: candidate.answered,
      supported_answer: candidate.supported_answer,
      supported_abstention: candidate.supported_abstention,
      judged_correct: candidate.judged_correct,
      inline_complete: candidate.inline_complete,
      answer_type_correct: candidate.answer_type_correct,
      heuristic_score: candidate.heuristic_score,
    }])),
  };
}

function compareOracleCandidates(a, b) {
  const supportDelta = Number(b.supported_answer) - Number(a.supported_answer);
  if (supportDelta) return supportDelta;
  const f1Delta = Number(b.scores.answer_token_f1 ?? 0) - Number(a.scores.answer_token_f1 ?? 0);
  if (Math.abs(f1Delta) > 1e-12) return f1Delta;
  const recallDelta = Number(b.scores.citation_recall ?? 0) - Number(a.scores.citation_recall ?? 0);
  if (Math.abs(recallDelta) > 1e-12) return recallDelta;
  return b.heuristic_score - a.heuristic_score;
}

function heuristicScore(reference, prediction, spec) {
  if (prediction.answer_type === "abstain") return 0.4;
  const evidenceById = new Map(reference.input.compact_retrieved_evidence_pack.map((row) => [row.evidence_id, row]));
  const citedText = prediction.citations.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  const answerTokens = contentTokens(prediction.answer);
  const citedTokens = contentTokens(citedText);
  const validCitationRate = prediction.citations.length
    ? prediction.citations.filter((id) => evidenceById.has(id)).length / prediction.citations.length
    : 0;
  const inline = inlineComplete(prediction) ? 1 : 0;
  const familyPrior = spec.family === "openai_mini_scaffold" ? 0.18 : spec.id === "qwen7b_v4" ? 0.1 : 0;
  const lengthPenalty = answerTokens.length > 70 ? -0.1 : 0;
  return familyPrior
    + 0.25 * inline
    + 0.25 * validCitationRate
    + 0.25 * tokenCoverage(answerTokens, citedTokens)
    + lengthPenalty;
}

function summarizeCandidateFamilies(rows) {
  const flat = rows.flatMap((row) => row.candidates);
  const byCandidate = {};
  for (const id of [...new Set(flat.map((candidate) => candidate.id))].sort()) {
    byCandidate[id] = summarizeCandidates(flat.filter((candidate) => candidate.id === id));
  }
  const byFamily = {};
  for (const family of [...new Set(flat.map((candidate) => candidate.family))].sort()) {
    byFamily[family] = summarizeCandidates(flat.filter((candidate) => candidate.family === family));
  }
  return { by_candidate: byCandidate, by_family: byFamily };
}

function summarizeCandidates(candidates) {
  const answered = candidates.filter((candidate) => candidate.answered);
  const abstained = candidates.filter((candidate) => !candidate.answered);
  return {
    rows: candidates.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, candidates.length),
    answer_support_rate: ratio(answered.filter((candidate) => candidate.supported_answer).length, answered.length),
    abstention_support_rate: ratio(abstained.filter((candidate) => candidate.supported_abstention).length, abstained.length),
    judged_correct_rate: ratio(candidates.filter((candidate) => candidate.judged_correct).length, candidates.length),
    inline_complete_rate: ratio(answered.filter((candidate) => candidate.inline_complete).length, answered.length),
  };
}

function summarizeSelections(rows) {
  const answered = rows.filter((row) => row.prediction?.answer_type === "grounded_answer");
  const abstained = rows.filter((row) => row.prediction?.answer_type === "abstain");
  const supportedAnswers = answered.filter((row) => row.selection_scores.supported_answer);
  const supportedAbstentions = abstained.filter((row) => row.selection_scores.supported_abstention);
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, rows.length),
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    abstention_support_rate: ratio(supportedAbstentions.length, abstained.length),
    overall_judged_correct_rate: ratio(supportedAnswers.length + supportedAbstentions.length, rows.length),
    answer_type_accuracy: ratio(rows.filter((row) => row.selection_scores.answer_type_correct).length, rows.length),
    inline_complete_rate: ratio(answered.filter((row) => row.selection_scores.inline_complete).length, answered.length),
    policy_mix: groupCount(rows.map((row) => row.selected_candidate_id ?? "missing")),
    family_mix: groupCount(rows.map((row) => row.selected_family ?? "missing")),
  };
}

function oracleGap({ expandedOracle, scaffoldSelector, qwenOnlyOracle }) {
  return {
    expanded_minus_scaffold_answer_rate: expandedOracle.answer_rate - scaffoldSelector.answer_rate,
    expanded_minus_scaffold_answer_support_rate: expandedOracle.answer_support_rate - scaffoldSelector.answer_support_rate,
    expanded_minus_scaffold_overall_correct_rate: expandedOracle.overall_judged_correct_rate - scaffoldSelector.overall_judged_correct_rate,
    qwen_only_minus_scaffold_supported_answers: qwenOnlyOracle.answered * qwenOnlyOracle.answer_support_rate
      - scaffoldSelector.answered * scaffoldSelector.answer_support_rate,
  };
}

function uniqueSupportedAnswers(rows, familyPrefix) {
  const unique = rows.flatMap((row) => {
    const scaffoldHasSupported = row.candidates.some((candidate) => candidate.family === "openai_mini_scaffold" && candidate.supported_answer);
    const qwenSupported = row.candidates.filter((candidate) => candidate.family.startsWith(familyPrefix) && candidate.supported_answer);
    if (scaffoldHasSupported || !qwenSupported.length) return [];
    return [{
      example_id: row.example_id,
      candidates: qwenSupported.map((candidate) => candidate.id),
    }];
  });
  return {
    count: unique.length,
    example_ids: unique.map((row) => row.example_id),
    rows: unique,
  };
}

function decisionImplications(rows, oracleRows, scaffoldRows) {
  const expanded = summarizeSelections(oracleRows);
  const scaffold = summarizeSelections(scaffoldRows);
  const unsupportedScaffoldAnswers = scaffoldRows.filter((row) => row.prediction?.answer_type === "grounded_answer" && !row.selection_scores.supported_answer).length;
  const examplesWithSupportedCandidate = rows.filter((row) => row.candidates.some((candidate) => candidate.supported_answer)).length;
  return {
    paper_claim_ready: false,
    next_action: expanded.answer_rate >= 0.7 && expanded.answer_support_rate >= 0.8
      ? "Train or tune a deployable selector/verifier to recover the judged-oracle supported candidates without using final-window labels."
      : "Do not launch another blind adapter run; improve candidate generation because even the judged candidate pool is below a strong support-preserving target.",
    reason: `The expanded judged oracle has ${pct(expanded.answer_rate)} answer rate and ${pct(expanded.answer_support_rate)} answer support, while the scaffold priority selector has ${pct(scaffold.answer_rate)} answer rate and ${pct(scaffold.answer_support_rate)} answer support with ${unsupportedScaffoldAnswers} unsupported answers.`,
    examples_with_any_supported_answer_candidate: examplesWithSupportedCandidate,
  };
}

function statusFor({ expandedOracle, scaffoldSelector }) {
  if (expandedOracle.answer_rate >= 0.7 && expandedOracle.answer_support_rate >= 0.8) {
    return "candidate_pool_has_trainable_support_signal";
  }
  if (expandedOracle.overall_judged_correct_rate > scaffoldSelector.overall_judged_correct_rate) {
    return "candidate_pool_improves_but_below_target";
  }
  return "candidate_pool_does_not_improve";
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : [...new Set(citations)],
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? "") : null,
  };
}

function scorePrediction(reference, prediction) {
  const referenceCitations = new Set((reference.output.citations ?? []).map((citation) => citation.evidence_id));
  const citedGold = prediction.citations.filter((id) => reference.teacher_trace.evidence_roles[id] === "gold_evidence").length;
  const answerable = reference.output.answer_type !== "abstain";
  const abstained = prediction.answer_type === "abstain";
  return {
    answer_type_correct: prediction.answer_type === reference.output.answer_type,
    citation_precision: prediction.citations.length ? citedGold / prediction.citations.length : null,
    citation_recall: referenceCitations.size
      ? prediction.citations.filter((id) => referenceCitations.has(id)).length / referenceCitations.size
      : null,
    answer_token_f1: answerable && !abstained ? tokenF1(prediction.answer, stripCitations(reference.output.answer)) : null,
    abstention_correct: answerable ? !abstained : abstained,
    inline_citation_rate: prediction.answer_type === "grounded_answer"
      ? (prediction.citations.length ? prediction.citations.filter((id) => prediction.answer.includes(`[${id}]`)).length / prediction.citations.length : 0)
      : null,
  };
}

function isSupportedAnswer(judgment) {
  return judgment?.verdict === "supported"
    && judgment?.all_claims_supported === true
    && judgment?.citation_ids_valid !== false;
}

function isSupportedAbstention(judgment) {
  return judgment?.verdict === "correct_abstention"
    && judgment?.abstention_supported === true;
}

function inlineComplete(prediction) {
  if (prediction.answer_type !== "grounded_answer") return true;
  return prediction.citations.length > 0
    && prediction.citations.every((id) => prediction.answer.includes(`[${id}]`));
}

function renderReport(result) {
  const candidateRows = Object.entries(result.candidate_family_metrics.by_candidate)
    .map(([id, row]) => `| ${id} | ${row.answered} | ${pct(row.answer_rate)} | ${pct(row.answer_support_rate)} | ${pct(row.abstention_support_rate)} | ${pct(row.judged_correct_rate)} |`)
    .join("\n");
  const selectionRows = Object.entries(result.selection_metrics)
    .map(([id, row]) => `| ${id} | ${row.answered} | ${pct(row.answer_rate)} | ${pct(row.answer_support_rate)} | ${pct(row.abstention_support_rate)} | ${pct(row.overall_judged_correct_rate)} |`)
    .join("\n");
  return `# Expanded Candidate Pool Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This is a zero-call audit over already-paid prediction and judge artifacts. It is not a deployable final selector because the expanded oracle uses inherited judge labels.

## Candidate Metrics

| Candidate | Answered | Answer rate | Answer support | Abstention support | Judged correct |
| --- | ---: | ---: | ---: | ---: | ---: |
${candidateRows}

## Selection Metrics

| Selector | Answered | Answer rate | Answer support | Abstention support | Overall judged correct |
| --- | ---: | ---: | ---: | ---: | ---: |
${selectionRows}

## Oracle Gap

- Expanded oracle minus scaffold answer rate: ${pct(result.oracle_gap.expanded_minus_scaffold_answer_rate)}
- Expanded oracle minus scaffold answer support: ${pct(result.oracle_gap.expanded_minus_scaffold_answer_support_rate)}
- Expanded oracle minus scaffold overall correct: ${pct(result.oracle_gap.expanded_minus_scaffold_overall_correct_rate)}
- Qwen-unique supported answer examples: ${result.qwen_unique_supported_answers.count}

## Decision

${result.decision_implications.reason}

Next action: ${result.decision_implications.next_action}

No OpenAI calls or GPU jobs were made by this audit.
`;
}

function tokenF1(prediction, reference) {
  const predicted = contentTokens(stripCitations(prediction));
  const gold = contentTokens(reference);
  if (!predicted.length && !gold.length) return 1;
  if (!predicted.length || !gold.length) return 0;
  const goldCounts = counts(gold);
  let overlap = 0;
  for (const token of predicted) {
    const count = goldCounts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      goldCounts.set(token, count - 1);
    }
  }
  if (!overlap) return 0;
  const precision = overlap / predicted.length;
  const recall = overlap / gold.length;
  return (2 * precision * recall) / (precision + recall);
}

function tokenCoverage(needles, haystack) {
  if (!needles.length) return 0;
  const haystackSet = new Set(haystack);
  return needles.filter((token) => haystackSet.has(token)).length / needles.length;
}

function contentTokens(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .match(/[a-z0-9]+(?:\.[0-9]+)?/g) ?? [];
}

function stripCitations(text) {
  return String(text ?? "").replace(/\s*\[[^\]]+\]/g, "").trim();
}

function counts(values) {
  const map = new Map();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return map;
}

function groupCount(values) {
  return Object.fromEntries([...counts(values).entries()].sort());
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  if (value == null || !Number.isFinite(Number(value))) return "n/a";
  return `${(100 * Number(value)).toFixed(1)}%`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

function numberArg(value, fallback, { allowZero = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || (!allowZero && number <= 0) || (allowZero && number < 0)) return fallback;
  return number;
}
