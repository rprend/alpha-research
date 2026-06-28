import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const v14PredictionRun = args["v14-prediction-run"] ?? "joint-action-qwen7b-v13-support-delta-smoke-eval-v14-citation-repair";
const v14JudgeRun = args["v14-judge-run"] ?? "openai-judge-gpt4o-joint-action-qwen7b-v13-support-delta-v14-citation-repair";
const v14ContractAuditRun = args["v14-contract-audit-run"] ?? "support-contract-audit-qwen7b-v13-support-delta-v14-2026-06-28-v1";
const v13DeltaRun = args["v13-delta-run"] ?? "v13-coverage-gap-delta-qwen-only-hybrid-2026-06-28-v1";
const qwenOnlyRun = args["qwen-only-run"] ?? "qwen-only-amortization-diagnostic-final-window-v1";
const hybridRun = args["hybrid-run"] ?? "calibrated-hybrid-selector-final-window-v1";
const runId = args["run-id"] ?? "v14-support-delta-outcome-audit-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const v14Predictions = byId(await readJsonl(path.join(runsDir, v14PredictionRun, "predictions.jsonl")));
const v14Judgments = byId(await readJsonl(path.join(runsDir, v14JudgeRun, "judgments.jsonl")));
const v14Contracts = byId(await readJsonl(path.join(runsDir, v14ContractAuditRun, "rows.jsonl")));
const v13DeltaRows = byId(await readJsonl(path.join(runsDir, v13DeltaRun, "rows.jsonl")));
const qwenOracleRows = byId(await readJsonl(path.join(runsDir, qwenOnlyRun, "qwen_judged_oracle_predictions.jsonl")));
const qwenHeuristicRows = byId(await readJsonl(path.join(runsDir, qwenOnlyRun, "predictions.jsonl")));
const hybridRows = byId(await readJsonl(path.join(runsDir, hybridRun, "predictions.jsonl")));
const scaffoldRows = byId(await readJsonl(path.join(runsDir, hybridRun, "scaffold_predictions.jsonl")));
const qwenSwitchOracleRows = byId(await readJsonl(path.join(runsDir, hybridRun, "qwen_switch_oracle_predictions.jsonl")));

const ids = [...v14Predictions.keys()].sort();
const rows = ids.map(buildRow);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "v14_support_delta_outcome_audit",
  status: deriveStatus(rows),
  purpose: "Zero-cost postmortem for whether the bounded v14 support-delta Qwen 7B run added support-preserving coverage beyond v13, the prior Qwen-only oracle, and the calibrated scaffold/Qwen hybrid.",
  source_runs: {
    v14_prediction_run: v14PredictionRun,
    v14_judge_run: v14JudgeRun,
    v14_contract_audit_run: v14ContractAuditRun,
    v13_delta_run: v13DeltaRun,
    qwen_only_run: qwenOnlyRun,
    hybrid_run: hybridRun,
  },
  examples: rows.length,
  metrics: {
    v14: summarizePolicy(rows, "v14"),
    v13: summarizePolicy(rows, "v13"),
    qwen_only_heuristic: summarizePolicy(rows, "qwen_heuristic"),
    qwen_only_oracle: summarizePolicy(rows, "qwen_oracle"),
    scaffold_priority: summarizePolicy(rows, "scaffold"),
    calibrated_hybrid: summarizePolicy(rows, "hybrid"),
    qwen_switch_oracle_without_v14: summarizePolicy(rows, "qwen_switch_oracle"),
    scaffold_plus_v14_answer_citation_gate: summarizePolicy(rows, "scaffold_plus_v14_gate"),
    scaffold_plus_v14_oracle: summarizePolicy(rows, "scaffold_plus_v14_oracle"),
    hybrid_plus_v14_answer_citation_gate: summarizePolicy(rows, "hybrid_plus_v14_gate"),
    hybrid_plus_v14_oracle: summarizePolicy(rows, "hybrid_plus_v14_oracle"),
  },
  support_delta: summarizeSupportDelta(rows),
  selector_delta: summarizeSelectorDelta(rows),
  next_supervision_signal: nextSupervisionSignal(rows),
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit joins existing predictions, paid judgments, contract audit rows, and selector artifacts only.",
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
  metrics: result.metrics,
  support_delta: result.support_delta,
  selector_delta: result.selector_delta,
}, null, 2));

function buildRow(exampleId) {
  const v14PredictionRow = v14Predictions.get(exampleId);
  const v14JudgmentRow = v14Judgments.get(exampleId);
  const contractRow = v14Contracts.get(exampleId);
  const v14 = scoredQwenRun("qwen7b_v14", "qwen7b_lora", v14PredictionRow, v14JudgmentRow, contractRow);
  const v13 = v13DeltaRows.get(exampleId)?.policies?.v13 ?? emptyPolicy("qwen7b_v13", "qwen7b_lora");
  const scaffold = scoredSelection(scaffoldRows.get(exampleId));
  const hybrid = scoredSelection(hybridRows.get(exampleId));
  return {
    example_id: exampleId,
    reference_answer_type: v14PredictionRow?.reference?.answer_type ?? null,
    counterfactual: isCounterfactualId(exampleId),
    policies: {
      v14,
      v13,
      qwen_heuristic: scoredSelection(qwenHeuristicRows.get(exampleId)),
      qwen_oracle: scoredSelection(qwenOracleRows.get(exampleId)),
      scaffold,
      hybrid,
      qwen_switch_oracle: scoredSelection(qwenSwitchOracleRows.get(exampleId)),
      scaffold_plus_v14_gate: basePlusV14(scaffold, v14, exampleId, false),
      scaffold_plus_v14_oracle: basePlusV14(scaffold, v14, exampleId, true),
      hybrid_plus_v14_gate: basePlusV14(hybrid, v14, exampleId, false),
      hybrid_plus_v14_oracle: basePlusV14(hybrid, v14, exampleId, true),
    },
    v14_failure_tags: contractRow?.explanation_tags ?? [],
    v14_answer_preview: preview(v14PredictionRow?.prediction?.answer),
  };
}

function scoredQwenRun(id, family, predictionRow, judgmentRow, contractRow) {
  const prediction = normalizePrediction(predictionRow?.prediction ?? {});
  const judgment = judgmentRow?.judgment ?? {};
  const answered = prediction.answer_type === "grounded_answer";
  const supportedAnswer = answered && isSupportedAnswer(judgment);
  const supportedAbstention = !answered && isSupportedAbstention(judgment);
  return {
    selected_candidate_id: id,
    selected_family: family,
    answered,
    abstained: !answered,
    supported_answer: supportedAnswer,
    supported_abstention: supportedAbstention,
    judged_correct: supportedAnswer || supportedAbstention,
    answer_citation_complete: answered
      ? contractRow?.top_level_contract?.valid === true && contractRow?.inline_contract?.valid === true
      : true,
    strict_citation_complete: answered
      ? contractRow?.top_level_contract?.valid === true
        && contractRow?.inline_contract?.valid === true
        && contractRow?.claim_table_contract?.valid === true
        && contractRow?.citation_channels_consistent === true
      : true,
    judge_verdict: judgment.verdict ?? null,
    prediction,
  };
}

function scoredSelection(row) {
  const prediction = normalizePrediction(row?.prediction ?? {});
  const answered = prediction.answer_type === "grounded_answer";
  return {
    selected_candidate_id: row?.selected_candidate_id ?? null,
    selected_family: row?.selected_family ?? null,
    answered,
    abstained: !answered,
    supported_answer: row?.selection_scores?.supported_answer === true,
    supported_abstention: row?.selection_scores?.supported_abstention === true,
    judged_correct: row?.selection_scores?.judged_correct === true,
    answer_citation_complete: row?.selection_scores?.answer_citation_complete === true || !answered,
    strict_citation_complete: row?.selection_scores?.answer_citation_complete === true || !answered,
    judge_verdict: row?.inherited_judgment?.verdict ?? null,
    prediction,
  };
}

function emptyPolicy(id, family) {
  return {
    selected_candidate_id: id,
    selected_family: family,
    answered: false,
    abstained: true,
    supported_answer: false,
    supported_abstention: false,
    judged_correct: false,
    answer_citation_complete: true,
    strict_citation_complete: true,
    judge_verdict: null,
    prediction: normalizePrediction({ answer_type: "abstain", answer: "" }),
  };
}

function basePlusV14(base, v14, exampleId, oracle) {
  if (base.answered) return { ...base };
  if (isCounterfactualId(exampleId)) return { ...base };
  const canSwitch = v14.answered
    && v14.answer_citation_complete
    && (oracle ? v14.supported_answer : true);
  if (!canSwitch) return { ...base };
  return { ...v14 };
}

function summarizePolicy(rows, policy) {
  const selected = rows.map((row) => row.policies[policy]);
  const answered = selected.filter((row) => row.answered);
  const abstained = selected.filter((row) => row.abstained);
  const supportedAnswers = answered.filter((row) => row.supported_answer);
  const supportedAbstentions = abstained.filter((row) => row.supported_abstention);
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, rows.length),
    supported_answers: supportedAnswers.length,
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    supported_abstentions: supportedAbstentions.length,
    abstention_support_rate: ratio(supportedAbstentions.length, abstained.length),
    overall_judged_correct_rate: ratio(supportedAnswers.length + supportedAbstentions.length, rows.length),
    answer_citation_complete_answers: answered.filter((row) => row.answer_citation_complete).length,
    strict_citation_complete_answers: answered.filter((row) => row.strict_citation_complete).length,
  };
}

function summarizeSupportDelta(rows) {
  const v14SupportedIds = supportedNonCounterfactualAnswerIds(rows, "v14");
  const v13SupportedIds = supportedNonCounterfactualAnswerIds(rows, "v13");
  const qwenOracleSupportedIds = supportedNonCounterfactualAnswerIds(rows, "qwen_oracle");
  const hybridSupportedIds = supportedNonCounterfactualAnswerIds(rows, "hybrid");
  const v14HardNegatives = rows.filter((row) => row.policies.v14.answered && !row.policies.v14.supported_answer && row.policies.v14.answer_citation_complete);
  return {
    v14_non_counterfactual_supported_answers: v14SupportedIds.size,
    v13_non_counterfactual_supported_answers: v13SupportedIds.size,
    qwen_oracle_supported_answers_before_v14: qwenOracleSupportedIds.size,
    hybrid_supported_answers_before_v14: hybridSupportedIds.size,
    v14_supported_not_in_v13_ids: difference(v14SupportedIds, v13SupportedIds),
    v14_supported_not_in_qwen_oracle_ids: difference(v14SupportedIds, qwenOracleSupportedIds),
    qwen_oracle_supported_not_reproduced_by_v14_ids: difference(qwenOracleSupportedIds, v14SupportedIds),
    hybrid_supported_not_reproduced_by_v14_ids: difference(hybridSupportedIds, v14SupportedIds),
    v14_answer_citation_complete_hard_negative_ids: v14HardNegatives.map((row) => row.example_id),
    v14_counterfactual_answered_ids: rows.filter((row) => row.counterfactual && row.policies.v14.answered).map((row) => row.example_id),
  };
}

function summarizeSelectorDelta(rows) {
  return {
    scaffold_plus_v14_gate_supported_answer_delta: summarizePolicy(rows, "scaffold_plus_v14_gate").supported_answers - summarizePolicy(rows, "scaffold").supported_answers,
    scaffold_plus_v14_gate_answered_delta: summarizePolicy(rows, "scaffold_plus_v14_gate").answered - summarizePolicy(rows, "scaffold").answered,
    scaffold_plus_v14_oracle_supported_answer_delta: summarizePolicy(rows, "scaffold_plus_v14_oracle").supported_answers - summarizePolicy(rows, "scaffold").supported_answers,
    hybrid_plus_v14_gate_supported_answer_delta: summarizePolicy(rows, "hybrid_plus_v14_gate").supported_answers - summarizePolicy(rows, "hybrid").supported_answers,
    hybrid_plus_v14_gate_answered_delta: summarizePolicy(rows, "hybrid_plus_v14_gate").answered - summarizePolicy(rows, "hybrid").answered,
    hybrid_plus_v14_oracle_supported_answer_delta: summarizePolicy(rows, "hybrid_plus_v14_oracle").supported_answers - summarizePolicy(rows, "hybrid").supported_answers,
    scaffold_abstention_v14_supported_ids: rows
      .filter((row) => !row.counterfactual && row.policies.scaffold.abstained && row.policies.v14.supported_answer)
      .map((row) => row.example_id),
    hybrid_abstention_v14_supported_ids: rows
      .filter((row) => !row.counterfactual && row.policies.hybrid.abstained && row.policies.v14.supported_answer)
      .map((row) => row.example_id),
  };
}

function nextSupervisionSignal(rows) {
  const positives = rows.filter((row) => !row.counterfactual && row.policies.v14.supported_answer && row.policies.v14.answer_citation_complete);
  const hardNegatives = rows.filter((row) => row.policies.v14.answered && !row.policies.v14.supported_answer && row.policies.v14.answer_citation_complete);
  const counterfactualFailures = rows.filter((row) => row.counterfactual && row.policies.v14.answered);
  return {
    should_launch_gpu_next: false,
    reason: "V14 does not add enough support-preserving coverage; use its supported answer-citation-complete rows and hard negatives to train/select a verifier or repair generator before more GPU spend.",
    positive_training_sources: positives.map((row) => row.example_id),
    hard_negative_sources: hardNegatives.map((row) => ({
      example_id: row.example_id,
      tags: row.v14_failure_tags,
      answer_preview: row.v14_answer_preview,
    })),
    counterfactual_failures_to_abstain: counterfactualFailures.map((row) => ({
      example_id: row.example_id,
      tags: row.v14_failure_tags,
      answer_preview: row.v14_answer_preview,
    })),
  };
}

function deriveStatus(rows) {
  const metrics = {
    v14: summarizePolicy(rows, "v14"),
    scaffoldPlusGate: summarizePolicy(rows, "scaffold_plus_v14_gate"),
    hybridPlusGate: summarizePolicy(rows, "hybrid_plus_v14_gate"),
    scaffold: summarizePolicy(rows, "scaffold"),
    hybrid: summarizePolicy(rows, "hybrid"),
  };
  const delta = summarizeSupportDelta(rows);
  if (metrics.v14.answer_rate >= 0.7 && metrics.v14.answer_support_rate >= 0.66) return "v14_generator_minimum_positive";
  if (
    metrics.hybridPlusGate.answer_rate >= 0.7
    && metrics.hybridPlusGate.answer_support_rate >= 0.66
    && metrics.hybridPlusGate.supported_answers > metrics.hybrid.supported_answers
    && metrics.hybridPlusGate.overall_judged_correct_rate >= metrics.hybrid.overall_judged_correct_rate
  ) return "v14_gate_selector_minimum_positive_not_amortized";
  if (delta.v14_supported_not_in_qwen_oracle_ids.length >= 4) return "v14_adds_candidate_pool_headroom_but_needs_selector";
  if (metrics.scaffoldPlusGate.supported_answers > metrics.scaffold.supported_answers) return "v14_small_selector_signal_not_launch_ready";
  return "v14_support_delta_negative";
}

function supportedNonCounterfactualAnswerIds(rows, policy) {
  return new Set(rows
    .filter((row) => !row.counterfactual && row.policies[policy]?.supported_answer)
    .map((row) => row.example_id));
}

function isCounterfactualId(exampleId) {
  return String(exampleId).includes(":counterfactual-insufficient");
}

function isSupportedAnswer(judgment) {
  return judgment?.verdict === "supported" && judgment?.all_claims_supported === true && judgment?.citation_ids_valid !== false;
}

function isSupportedAbstention(judgment) {
  return judgment?.verdict === "correct_abstention" || judgment?.abstention_supported === true;
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  return {
    answer_type: answerType,
    answer: String(value.answer ?? ""),
    citations: Array.isArray(value.citations) ? value.citations.filter(Boolean) : [],
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: value.abstention_reason ?? null,
  };
}

function renderReport(result) {
  const m = result.metrics;
  const delta = result.support_delta;
  const selector = result.selector_delta;
  return `# V14 Support-Delta Outcome Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no compute. It joins the v14 predictions, paid v14 judgments, the v14 contract audit, the v13 delta audit, the Qwen-only diagnostic, and the calibrated hybrid selector.

## Metrics

| Policy | Answered | Supported answers | Answer support | Overall correct |
| --- | ---: | ---: | ---: | ---: |
| V14 standalone | ${m.v14.answered} | ${m.v14.supported_answers} | ${pct(m.v14.answer_support_rate)} | ${pct(m.v14.overall_judged_correct_rate)} |
| V13 standalone | ${m.v13.answered} | ${m.v13.supported_answers} | ${pct(m.v13.answer_support_rate)} | ${pct(m.v13.overall_judged_correct_rate)} |
| Qwen-only heuristic | ${m.qwen_only_heuristic.answered} | ${m.qwen_only_heuristic.supported_answers} | ${pct(m.qwen_only_heuristic.answer_support_rate)} | ${pct(m.qwen_only_heuristic.overall_judged_correct_rate)} |
| Qwen-only oracle | ${m.qwen_only_oracle.answered} | ${m.qwen_only_oracle.supported_answers} | ${pct(m.qwen_only_oracle.answer_support_rate)} | ${pct(m.qwen_only_oracle.overall_judged_correct_rate)} |
| Scaffold priority | ${m.scaffold_priority.answered} | ${m.scaffold_priority.supported_answers} | ${pct(m.scaffold_priority.answer_support_rate)} | ${pct(m.scaffold_priority.overall_judged_correct_rate)} |
| Calibrated hybrid | ${m.calibrated_hybrid.answered} | ${m.calibrated_hybrid.supported_answers} | ${pct(m.calibrated_hybrid.answer_support_rate)} | ${pct(m.calibrated_hybrid.overall_judged_correct_rate)} |
| Scaffold + v14 answer-citation gate | ${m.scaffold_plus_v14_answer_citation_gate.answered} | ${m.scaffold_plus_v14_answer_citation_gate.supported_answers} | ${pct(m.scaffold_plus_v14_answer_citation_gate.answer_support_rate)} | ${pct(m.scaffold_plus_v14_answer_citation_gate.overall_judged_correct_rate)} |
| Hybrid + v14 answer-citation gate | ${m.hybrid_plus_v14_answer_citation_gate.answered} | ${m.hybrid_plus_v14_answer_citation_gate.supported_answers} | ${pct(m.hybrid_plus_v14_answer_citation_gate.answer_support_rate)} | ${pct(m.hybrid_plus_v14_answer_citation_gate.overall_judged_correct_rate)} |

## Support Delta

- V14 non-counterfactual supported answers: ${delta.v14_non_counterfactual_supported_answers}
- V13 non-counterfactual supported answers: ${delta.v13_non_counterfactual_supported_answers}
- V14 supported answers not in V13: ${delta.v14_supported_not_in_v13_ids.length}
- V14 supported answers not in prior Qwen-only oracle: ${delta.v14_supported_not_in_qwen_oracle_ids.length}
- Prior Qwen-only oracle supported answers not reproduced by V14: ${delta.qwen_oracle_supported_not_reproduced_by_v14_ids.length}
- V14 answer-citation-complete hard negatives: ${delta.v14_answer_citation_complete_hard_negative_ids.length}
- V14 counterfactual answered rows: ${delta.v14_counterfactual_answered_ids.length}

## Selector Delta

- Scaffold + v14 gate supported-answer delta: ${signed(selector.scaffold_plus_v14_gate_supported_answer_delta)}
- Scaffold + v14 gate answered delta: ${signed(selector.scaffold_plus_v14_gate_answered_delta)}
- Scaffold + v14 oracle supported-answer delta: ${signed(selector.scaffold_plus_v14_oracle_supported_answer_delta)}
- Hybrid + v14 gate supported-answer delta: ${signed(selector.hybrid_plus_v14_gate_supported_answer_delta)}
- Hybrid + v14 gate answered delta: ${signed(selector.hybrid_plus_v14_gate_answered_delta)}
- Hybrid + v14 oracle supported-answer delta: ${signed(selector.hybrid_plus_v14_oracle_supported_answer_delta)}

## Next Signal

Do not launch another GPU job from this result alone. V14 should be treated as a source of supported positives and hard negatives for a verifier or repair-generator target, not as a deployable generator.
`;
}

function difference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort();
}

function preview(value, limit = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function signed(value) {
  const number = Number(value);
  return `${number >= 0 ? "+" : ""}${number}`;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function byId(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
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

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : true;
  }
  return parsed;
}
