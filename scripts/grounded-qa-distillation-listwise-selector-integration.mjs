import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const reportsDir = path.join(experimentDir, "reports");

const runId = "listwise-selector-integration-final-window-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const sourceRunId = "contract-aware-candidate-selector-final-window-v1";
const calibratedHybridRunId = "calibrated-hybrid-selector-final-window-v1";
const selectorProbeRunId = "listwise-selector-probe-0-320-to-321-389-2026-06-28-v1";
const split = "extended_temporal_future_holdout";
const evalOffset = 320;
const evalLimit = 69;

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceRows = await readJsonl(path.join(runsDir, sourceRunId, "rows.jsonl"));
const calibratedHybrid = await readJson(path.join(runsDir, calibratedHybridRunId, "result.json"));
const calibratedRows = await readJsonl(path.join(runsDir, calibratedHybridRunId, "predictions.jsonl"));
const selectorProbe = await readJson(path.join(runsDir, selectorProbeRunId, "result.json"));
const references = (await readJsonl(path.join(dataDir, `${split}.jsonl`))).slice(evalOffset, evalOffset + evalLimit);
const referenceById = new Map(references.map((row) => [row.example_id, row]));

const weights = selectorProbe.selected_by_validation.config;
const rowsWithScores = sourceRows.map((row) => attachListwiseScores(row, referenceById.get(row.example_id), weights));
const scaffoldRows = rowsWithScores.map(selectScaffoldPriority);
const allCandidateRows = rowsWithScores.map(selectListwiseAllCandidates);
const contractSafeRows = rowsWithScores.map(selectListwiseContractSafe);
const conservativeRows = rowsWithScores.map(selectListwiseConservative);
const calibratedById = new Map(calibratedRows.map((row) => [row.example_id, row]));

const selectionMetrics = {
  scaffold_priority: summarizeSelections(scaffoldRows),
  calibrated_hybrid: calibratedHybrid.selection_metrics.calibrated_hybrid,
  listwise_all_candidates: summarizeSelections(allCandidateRows),
  listwise_contract_safe: summarizeSelections(contractSafeRows),
  listwise_conservative: summarizeSelections(conservativeRows),
};

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "listwise_selector_integration",
  status: statusFor(selectionMetrics),
  purpose: "Integrate the D342 validation-selected zero-call listwise selector into final-window answer selection and compare against the calibrated hybrid system metrics.",
  source_runs: {
    contract_aware_candidate_selector: sourceRunId,
    calibrated_hybrid_selector: calibratedHybridRunId,
    listwise_selector_probe: selectorProbeRunId,
  },
  split,
  eval_offset: evalOffset,
  examples: sourceRows.length,
  selected_policy: {
    policy_id: selectorProbe.selected_by_validation.policy_id,
    model: selectorProbe.selected_by_validation.model,
    config: weights,
    nonfinal_validation_accuracy: selectorProbe.selected_by_validation.validation.accuracy,
    final_pair_transfer_accuracy: selectorProbe.selected_by_validation.final_pair_transfer.accuracy,
  },
  selection_metrics: selectionMetrics,
  switch_analysis: {
    listwise_all_candidates_vs_scaffold: summarizeSwitches(allCandidateRows, scaffoldRows),
    listwise_contract_safe_vs_scaffold: summarizeSwitches(contractSafeRows, scaffoldRows),
    listwise_conservative_vs_scaffold: summarizeSwitches(conservativeRows, scaffoldRows),
    listwise_conservative_vs_calibrated: summarizeAgainstExisting(conservativeRows, calibratedById),
  },
  gap_analysis: gapAnalysis(selectionMetrics),
  decision: decisionFromResult(selectionMetrics),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_transfer: true,
    inherited_judgments_used_for_reporting_only: true,
    selected_policy_source: "D342_nonfinal_validation_only",
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
    note: "Zero-call integration over existing final-window candidates and inherited judge labels.",
  },
  artifacts: {
    rows_with_listwise_scores_jsonl: rel(path.join(outputDir, "rows_with_listwise_scores.jsonl")),
    listwise_all_candidates_predictions_jsonl: rel(path.join(outputDir, "listwise_all_candidates_predictions.jsonl")),
    listwise_contract_safe_predictions_jsonl: rel(path.join(outputDir, "listwise_contract_safe_predictions.jsonl")),
    listwise_conservative_predictions_jsonl: rel(path.join(outputDir, "listwise_conservative_predictions.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "rows_with_listwise_scores.jsonl"), rowsWithScores);
await writeJsonl(path.join(outputDir, "listwise_all_candidates_predictions.jsonl"), allCandidateRows);
await writeJsonl(path.join(outputDir, "listwise_contract_safe_predictions.jsonl"), contractSafeRows);
await writeJsonl(path.join(outputDir, "listwise_conservative_predictions.jsonl"), conservativeRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selection_metrics: result.selection_metrics,
  gap_analysis: result.gap_analysis,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function attachListwiseScores(row, reference, policyWeights) {
  if (!reference) throw new Error(`Missing reference for ${row.example_id}`);
  const question = reference.input.question;
  return {
    ...row,
    question,
    candidates: row.candidates.map((candidate) => ({
      ...candidate,
      listwise_selector: {
        score: listwiseScore(candidate, question, policyWeights),
      },
    })),
  };
}

function selectListwiseAllCandidates(row) {
  return selectionRow(row, bestByListwiseScore(row.candidates), "listwise_all_candidates", "select_top_listwise_candidate", []);
}

function selectListwiseContractSafe(row) {
  const eligible = row.candidates.filter((candidate) =>
    candidate.prediction?.answer_type !== "grounded_answer"
    || candidate.contract?.answer_citation_complete === true
  );
  return selectionRow(row, bestByListwiseScore(eligible), "listwise_contract_safe", "select_top_contract_safe_listwise_candidate", []);
}

function selectListwiseConservative(row) {
  const base = scaffoldPriorityCandidate(row);
  const top = bestByListwiseScore(row.candidates.filter((candidate) =>
    candidate.prediction?.answer_type !== "grounded_answer"
    || candidate.contract?.answer_citation_complete === true
  ));
  const baseScore = Number(base?.listwise_selector?.score ?? -Infinity);
  const topScore = Number(top?.listwise_selector?.score ?? -Infinity);
  if (!top || top.id === base?.id || topScore < baseScore + 0.2) {
    return selectionRow(row, base, "listwise_conservative", "keep_scaffold_priority", ["no_listwise_margin"]);
  }
  return selectionRow(row, top, "listwise_conservative", "switch_on_listwise_margin", ["listwise_margin_cleared"]);
}

function bestByListwiseScore(candidates) {
  return [...candidates].sort((left, right) =>
    Number(right.listwise_selector?.score ?? -Infinity) - Number(left.listwise_selector?.score ?? -Infinity)
    || Number(right.heuristic_score ?? 0) - Number(left.heuristic_score ?? 0)
    || String(left.id).localeCompare(String(right.id))
  )[0] ?? null;
}

function selectScaffoldPriority(row) {
  return selectionRow(row, scaffoldPriorityCandidate(row), "scaffold_priority_selector", "scaffold_priority", []);
}

function scaffoldPriorityCandidate(row) {
  return ["claim_entailment_guard", "balanced_risk_gate", "direct_mini_repair"]
    .map((id) => row.candidates.find((candidate) => candidate.id === id))
    .find(Boolean)
    ?? row.candidates[0];
}

function listwiseScore(candidate, question, policyWeights) {
  const prediction = candidate.prediction ?? {};
  const answerType = prediction.answer_type;
  const answer = String(prediction.answer ?? "");
  const citations = Array.isArray(prediction.citations) ? prediction.citations : [];
  const claims = Array.isArray(prediction.claim_table) ? prediction.claim_table : [];
  const isAnswer = answerType === "grounded_answer" ? 1 : 0;
  const isAbstain = answerType === "abstain" ? 1 : 0;
  const inlineComplete = candidate.contract?.answer_citation_complete === true ? 1 : 0;
  const logAnswerTokens = Math.log1p(contentTokens(answer).length);
  const logCitations = Math.log1p(citations.length);
  const questionOverlap = tokenOverlap(question, answer);
  const isQwen = String(candidate.family ?? "").startsWith("qwen") ? 1 : 0;
  const isOpenai = String(candidate.family ?? "").includes("openai") ? 1 : 0;
  return (
    Number(policyWeights.inline ?? 0) * inlineComplete
    + Number(policyWeights.answer ?? 0) * isAnswer
    + Number(policyWeights.citations ?? 0) * logCitations
    + Number(policyWeights.overlap ?? 0) * questionOverlap
    + Number(policyWeights.qwen ?? 0) * isQwen
    + Number(policyWeights.openai ?? 0) * isOpenai
    + 0.04 * isAbstain
    + 0.02 * Math.log1p(claims.length)
    + 0.01 * logAnswerTokens
  );
}

function selectionRow(row, selected, selectorType, decision, reasons) {
  return {
    example_id: row.example_id,
    selector_type: selectorType,
    selected_candidate_id: selected?.id ?? null,
    selected_family: selected?.family ?? null,
    selection_decision: decision,
    selection_reasons: reasons,
    prediction: selected?.prediction ?? null,
    reference: row.reference,
    inherited_judgment: selected?.judgment ?? null,
    selection_scores: {
      listwise_score: selected?.listwise_selector?.score ?? null,
      supported_answer: selected?.supported_answer ?? false,
      supported_abstention: selected?.supported_abstention ?? false,
      judged_correct: selected?.supported_answer === true || selected?.supported_abstention === true,
      answer_type_correct: selected?.answer_type_correct ?? false,
      answer_citation_complete: selected?.contract?.answer_citation_complete ?? false,
      heuristic_score: selected?.heuristic_score ?? null,
    },
    candidate_summary: Object.fromEntries(row.candidates.map((candidate) => [candidate.id, {
      family: candidate.family,
      answered: candidate.answered,
      supported_answer: candidate.supported_answer,
      supported_abstention: candidate.supported_abstention,
      judged_correct: candidate.judged_correct,
      answer_citation_complete: candidate.contract?.answer_citation_complete ?? false,
      heuristic_score: candidate.heuristic_score,
      listwise_score: candidate.listwise_selector?.score ?? null,
    }])),
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
    answer_citation_complete_rate: ratio(answered.filter((row) => row.selection_scores.answer_citation_complete).length, answered.length),
    supported_answers: supportedAnswers.length,
    supported_abstentions: supportedAbstentions.length,
    policy_mix: groupCount(rows.map((row) => row.selected_candidate_id ?? "missing")),
    family_mix: groupCount(rows.map((row) => row.selected_family ?? "missing")),
  };
}

function summarizeSwitches(candidateRows, baselineRows) {
  const baselineById = new Map(baselineRows.map((row) => [row.example_id, row]));
  const switches = candidateRows.filter((row) => baselineById.get(row.example_id)?.selected_candidate_id !== row.selected_candidate_id);
  return {
    switches: switches.length,
    support_gains: switches.filter((row) => row.selection_scores.judged_correct && !baselineById.get(row.example_id)?.selection_scores?.judged_correct).length,
    support_regressions: switches.filter((row) => !row.selection_scores.judged_correct && baselineById.get(row.example_id)?.selection_scores?.judged_correct).length,
    answer_gains: switches.filter((row) => row.prediction?.answer_type === "grounded_answer" && baselineById.get(row.example_id)?.prediction?.answer_type !== "grounded_answer").length,
    answer_regressions: switches.filter((row) => row.prediction?.answer_type !== "grounded_answer" && baselineById.get(row.example_id)?.prediction?.answer_type === "grounded_answer").length,
  };
}

function summarizeAgainstExisting(candidateRows, existingById) {
  const existingRows = candidateRows.map((row) => existingById.get(row.example_id)).filter(Boolean);
  return summarizeSwitches(candidateRows, existingRows);
}

function gapAnalysis(metrics) {
  const calibrated = metrics.calibrated_hybrid;
  const conservative = metrics.listwise_conservative;
  const all = metrics.listwise_all_candidates;
  return {
    conservative_minus_calibrated_overall_correct: conservative.overall_judged_correct_rate - calibrated.overall_judged_correct_rate,
    conservative_minus_calibrated_answer_support: conservative.answer_support_rate - calibrated.answer_support_rate,
    conservative_minus_calibrated_answer_rate: conservative.answer_rate - calibrated.answer_rate,
    all_candidates_minus_calibrated_overall_correct: all.overall_judged_correct_rate - calibrated.overall_judged_correct_rate,
    all_candidates_minus_calibrated_answer_support: all.answer_support_rate - calibrated.answer_support_rate,
    all_candidates_minus_calibrated_answer_rate: all.answer_rate - calibrated.answer_rate,
  };
}

function statusFor(metrics) {
  const calibrated = metrics.calibrated_hybrid;
  const conservative = metrics.listwise_conservative;
  if (conservative.overall_judged_correct_rate > calibrated.overall_judged_correct_rate && conservative.answer_support_rate >= calibrated.answer_support_rate && conservative.answer_rate >= calibrated.answer_rate) {
    return "listwise_selector_integrated";
  }
  if (conservative.overall_judged_correct_rate > calibrated.overall_judged_correct_rate) {
    return "listwise_selector_partial_support_tradeoff";
  }
  return "listwise_selector_not_integrated";
}

function decisionFromResult(metrics) {
  const status = statusFor(metrics);
  if (status === "listwise_selector_integrated") {
    return {
      replace_calibrated_hybrid_now: true,
      use_listwise_selector_in_scaffold_now: true,
      buy_openai_labels_now: false,
      launch_gpu_now: false,
      next_step: "Refresh readiness and manuscript evidence with the integrated zero-call selector before considering more GPU work.",
      reason: "The conservative listwise selector improves overall judged correctness without reducing answer rate or answer support.",
    };
  }
  return {
    replace_calibrated_hybrid_now: false,
    use_listwise_selector_in_scaffold_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Use the positive pairwise signal to design a coverage-constrained selector objective before replacing the current scaffold.",
    reason: "The listwise pairwise gain does not cleanly dominate the calibrated hybrid on end-to-end selection metrics.",
  };
}

function renderReport(result) {
  const metrics = result.selection_metrics;
  const gap = result.gap_analysis;
  return `# Listwise Selector Integration

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no API calls and launches no compute.

## Selected Policy

- Policy: \`${result.selected_policy.policy_id}\`
- Non-final validation accuracy: ${pct(result.selected_policy.nonfinal_validation_accuracy)}
- Frozen final pair transfer accuracy: ${pct(result.selected_policy.final_pair_transfer_accuracy)}

## System Metrics

| Policy | Answered | Supported answers | Answer support | Overall judged correct |
| --- | ---: | ---: | ---: | ---: |
| Scaffold priority | ${metrics.scaffold_priority.answered} | ${metrics.scaffold_priority.supported_answers} | ${pct(metrics.scaffold_priority.answer_support_rate)} | ${pct(metrics.scaffold_priority.overall_judged_correct_rate)} |
| Calibrated hybrid | ${metrics.calibrated_hybrid.answered} | ${metrics.calibrated_hybrid.supported_answers} | ${pct(metrics.calibrated_hybrid.answer_support_rate)} | ${pct(metrics.calibrated_hybrid.overall_judged_correct_rate)} |
| Listwise all candidates | ${metrics.listwise_all_candidates.answered} | ${metrics.listwise_all_candidates.supported_answers} | ${pct(metrics.listwise_all_candidates.answer_support_rate)} | ${pct(metrics.listwise_all_candidates.overall_judged_correct_rate)} |
| Listwise contract-safe | ${metrics.listwise_contract_safe.answered} | ${metrics.listwise_contract_safe.supported_answers} | ${pct(metrics.listwise_contract_safe.answer_support_rate)} | ${pct(metrics.listwise_contract_safe.overall_judged_correct_rate)} |
| Listwise conservative | ${metrics.listwise_conservative.answered} | ${metrics.listwise_conservative.supported_answers} | ${pct(metrics.listwise_conservative.answer_support_rate)} | ${pct(metrics.listwise_conservative.overall_judged_correct_rate)} |

## Gap

- Conservative minus calibrated overall correctness: ${pct(gap.conservative_minus_calibrated_overall_correct)}
- Conservative minus calibrated answer support: ${pct(gap.conservative_minus_calibrated_answer_support)}
- Conservative minus calibrated answer rate: ${pct(gap.conservative_minus_calibrated_answer_rate)}

## Decision

- Replace calibrated hybrid now: ${result.decision.replace_calibrated_hybrid_now ? "yes" : "no"}
- Use listwise selector in scaffold now: ${result.decision.use_listwise_selector_in_scaffold_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function contentTokens(text) {
  return String(text ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function tokenOverlap(question, answer) {
  const questionTokens = new Set(contentTokens(question).filter((token) => token.length > 2));
  const answerTokens = new Set(contentTokens(answer).filter((token) => token.length > 2));
  if (!questionTokens.size) return 0;
  let hits = 0;
  for (const token of questionTokens) {
    if (answerTokens.has(token)) hits += 1;
  }
  return hits / questionTokens.size;
}

function groupCount(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}
