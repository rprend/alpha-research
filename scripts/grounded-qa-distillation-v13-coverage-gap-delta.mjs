import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const v13PredictionRun = args["v13-prediction-run"] ?? "joint-action-qwen7b-qwen-coverage-gap-scaffold-smoke-eval-v13-citation-repair";
const v13JudgeRun = args["v13-judge-run"] ?? "openai-judge-gpt4o-joint-action-qwen7b-coverage-gap-v13-citation-repair";
const v13ContractAuditRun = args["v13-contract-audit-run"] ?? "support-contract-audit-qwen7b-coverage-gap-v13-2026-06-28-v1";
const qwenOnlyRun = args["qwen-only-run"] ?? "qwen-only-amortization-diagnostic-final-window-v1";
const hybridRun = args["hybrid-run"] ?? "calibrated-hybrid-selector-final-window-v1";
const packetRun = args["packet-run"] ?? "qwen-coverage-gap-scaffold-packet-v13";
const runId = args["run-id"] ?? "v13-coverage-gap-delta-qwen-only-hybrid-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const v13Predictions = byId(await readJsonl(path.join(runsDir, v13PredictionRun, "predictions.jsonl")));
const v13Judgments = byId(await readJsonl(path.join(runsDir, v13JudgeRun, "judgments.jsonl")));
const v13Contracts = byId(await readJsonl(path.join(runsDir, v13ContractAuditRun, "rows.jsonl")));
const qwenOracleRows = byId(await readJsonl(path.join(runsDir, qwenOnlyRun, "qwen_judged_oracle_predictions.jsonl")));
const qwenHeuristicRows = byId(await readJsonl(path.join(runsDir, qwenOnlyRun, "predictions.jsonl")));
const hybridRows = byId(await readJsonl(path.join(runsDir, hybridRun, "predictions.jsonl")));
const scaffoldRows = byId(await readJsonl(path.join(runsDir, hybridRun, "scaffold_predictions.jsonl")));
const qwenSwitchOracleRows = byId(await readJsonl(path.join(runsDir, hybridRun, "qwen_switch_oracle_predictions.jsonl")));
const targetRows = await readJsonl(path.join(runsDir, packetRun, "dataset", "qwen_miss_eval_prompts.jsonl"));
const targetIds = new Set(targetRows.map((row) => row.example_id));

const ids = [...v13Predictions.keys()].sort();
const rows = ids.map((exampleId) => buildRow(exampleId));
const targetDeltaRows = rows.filter((row) => row.v13_targeted_gap);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "v13_coverage_gap_delta",
  status: deriveStatus(rows, targetDeltaRows),
  purpose: "Zero-cost postmortem for whether the v13 coverage-gap scaffold actually filled Qwen-only oracle gaps, and whether it should be used as a standalone generator or only as a candidate source.",
  source_runs: {
    v13_prediction_run: v13PredictionRun,
    v13_judge_run: v13JudgeRun,
    v13_contract_audit_run: v13ContractAuditRun,
    qwen_only_run: qwenOnlyRun,
    hybrid_run: hybridRun,
    packet_run: packetRun,
  },
  examples: rows.length,
  targeted_gap_examples: targetDeltaRows.length,
  metrics: {
    v13: summarizePolicy(rows, "v13"),
    qwen_only_heuristic: summarizePolicy(rows, "qwen_heuristic"),
    qwen_only_oracle: summarizePolicy(rows, "qwen_oracle"),
    scaffold_priority: summarizePolicy(rows, "scaffold"),
    calibrated_hybrid: summarizePolicy(rows, "hybrid"),
    qwen_switch_oracle_without_v13: summarizePolicy(rows, "qwen_switch_oracle"),
    scaffold_plus_v13_answer_citation_gate: summarizePolicy(rows, "scaffold_plus_v13_gate"),
    scaffold_plus_v13_oracle: summarizePolicy(rows, "scaffold_plus_v13_oracle"),
  },
  coverage_gap_delta: summarizeCoverageGap(targetDeltaRows),
  candidate_delta: summarizeCandidateDelta(rows),
  next_packet_signal: nextPacketSignal(rows, targetDeltaRows),
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This analysis joins existing predictions, paid judgments, contract audit rows, and selector artifacts only.",
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
  coverage_gap_delta: result.coverage_gap_delta,
  candidate_delta: result.candidate_delta,
}, null, 2));

function buildRow(exampleId) {
  const v13PredictionRow = v13Predictions.get(exampleId);
  const v13JudgmentRow = v13Judgments.get(exampleId);
  const contractRow = v13Contracts.get(exampleId);
  const qwenOracleRow = qwenOracleRows.get(exampleId);
  const qwenHeuristicRow = qwenHeuristicRows.get(exampleId);
  const hybridRow = hybridRows.get(exampleId);
  const scaffoldRow = scaffoldRows.get(exampleId);
  const qwenSwitchOracleRow = qwenSwitchOracleRows.get(exampleId);
  const v13 = scoredV13(v13PredictionRow, v13JudgmentRow, contractRow);
  const scaffold = scoredSelection(scaffoldRow);
  return {
    example_id: exampleId,
    v13_targeted_gap: targetIds.has(exampleId),
    reference_answer_type: v13PredictionRow?.reference?.answer_type ?? qwenOracleRow?.reference?.answer_type ?? null,
    counterfactual: Boolean(exampleId.includes(":counterfactual-insufficient")),
    policies: {
      v13,
      qwen_heuristic: scoredSelection(qwenHeuristicRow),
      qwen_oracle: scoredSelection(qwenOracleRow),
      scaffold,
      hybrid: scoredSelection(hybridRow),
      qwen_switch_oracle: scoredSelection(qwenSwitchOracleRow),
      scaffold_plus_v13_gate: scaffoldPlusV13(scaffold, v13, exampleId, false),
      scaffold_plus_v13_oracle: scaffoldPlusV13(scaffold, v13, exampleId, true),
    },
    v13_failure_tags: contractRow?.explanation_tags ?? [],
    v13_answer_preview: preview(v13PredictionRow?.prediction?.answer),
  };
}

function scoredV13(predictionRow, judgmentRow, contractRow) {
  const prediction = normalizePrediction(predictionRow?.prediction ?? {});
  const judgment = judgmentRow?.judgment ?? {};
  const answered = prediction.answer_type === "grounded_answer";
  const supportedAnswer = answered && isSupportedAnswer(judgment);
  const supportedAbstention = !answered && isSupportedAbstention(judgment);
  return {
    selected_candidate_id: "qwen7b_v13",
    selected_family: "qwen7b_lora",
    answered,
    abstained: !answered,
    supported_answer: supportedAnswer,
    supported_abstention: supportedAbstention,
    judged_correct: supportedAnswer || supportedAbstention,
    answer_citation_complete: answered
      ? contractRow?.top_level_contract?.valid === true && contractRow?.inline_contract?.valid === true
      : true,
    strict_citation_complete: answered
      ? contractRow?.top_level_contract?.valid === true && contractRow?.inline_contract?.valid === true && contractRow?.claim_table_contract?.valid === true && contractRow?.citation_channels_consistent === true
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

function scaffoldPlusV13(scaffold, v13, exampleId, oracle) {
  if (scaffold.answered) return { ...scaffold, selected_candidate_id: scaffold.selected_candidate_id, selected_family: scaffold.selected_family };
  if (isCounterfactualId(exampleId)) return { ...scaffold, selected_candidate_id: scaffold.selected_candidate_id, selected_family: scaffold.selected_family };
  const canSwitch = v13.answered
    && v13.answer_citation_complete
    && (oracle ? v13.supported_answer : true);
  if (!canSwitch) return { ...scaffold, selected_candidate_id: scaffold.selected_candidate_id, selected_family: scaffold.selected_family };
  return { ...v13, selected_candidate_id: "qwen7b_v13", selected_family: "qwen7b_lora" };
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

function summarizeCoverageGap(rows) {
  const v13Supported = rows.filter((row) => row.policies.v13.supported_answer);
  const v13AnsweredUnsupported = rows.filter((row) => row.policies.v13.answered && !row.policies.v13.supported_answer);
  return {
    targeted_gap_examples: rows.length,
    v13_answered: rows.filter((row) => row.policies.v13.answered).length,
    v13_supported_answers: v13Supported.length,
    v13_answer_citation_complete_answers: rows.filter((row) => row.policies.v13.answered && row.policies.v13.answer_citation_complete).length,
    qwen_oracle_supported_before_v13: rows.filter((row) => row.policies.qwen_oracle.supported_answer).length,
    scaffold_supported_before_v13: rows.filter((row) => row.policies.scaffold.supported_answer).length,
    hybrid_supported_before_v13: rows.filter((row) => row.policies.hybrid.supported_answer).length,
    new_supported_gap_ids: v13Supported
      .filter((row) => !row.policies.qwen_oracle.supported_answer)
      .map((row) => row.example_id),
    repeated_supported_gap_ids: v13Supported
      .filter((row) => row.policies.qwen_oracle.supported_answer)
      .map((row) => row.example_id),
    unsupported_gap_ids: v13AnsweredUnsupported.map((row) => row.example_id),
    abstained_gap_ids: rows.filter((row) => row.policies.v13.abstained).map((row) => row.example_id),
  };
}

function summarizeCandidateDelta(rows) {
  const qwenOracleSupportedIds = new Set(rows.filter((row) => !row.counterfactual && row.policies.qwen_oracle.supported_answer).map((row) => row.example_id));
  const v13SupportedIds = new Set(rows.filter((row) => !row.counterfactual && row.policies.v13.supported_answer).map((row) => row.example_id));
  const scaffoldAbstentionV13Supported = rows.filter((row) => !row.counterfactual && row.policies.scaffold.abstained && row.policies.v13.supported_answer);
  return {
    v13_non_counterfactual_supported_answers: v13SupportedIds.size,
    qwen_oracle_supported_answers_before_v13: qwenOracleSupportedIds.size,
    v13_supported_not_in_qwen_oracle_ids: [...v13SupportedIds].filter((id) => !qwenOracleSupportedIds.has(id)),
    qwen_oracle_supported_not_reproduced_by_v13_ids: [...qwenOracleSupportedIds].filter((id) => !v13SupportedIds.has(id)),
    scaffold_abstention_v13_supported_ids: scaffoldAbstentionV13Supported.map((row) => row.example_id),
    scaffold_plus_v13_oracle_supported_answer_delta: summarizePolicy(rows, "scaffold_plus_v13_oracle").supported_answers - summarizePolicy(rows, "scaffold").supported_answers,
    scaffold_plus_v13_gate_supported_answer_delta: summarizePolicy(rows, "scaffold_plus_v13_gate").supported_answers - summarizePolicy(rows, "scaffold").supported_answers,
  };
}

function nextPacketSignal(rows, targetRows) {
  const targetFailures = targetRows.filter((row) => !row.policies.v13.supported_answer);
  const supportedContractComplete = rows.filter((row) => !row.counterfactual && row.policies.v13.supported_answer && row.policies.v13.answer_citation_complete);
  const unsupportedContractComplete = rows.filter((row) => row.policies.v13.answered && !row.policies.v13.supported_answer && row.policies.v13.answer_citation_complete);
  return {
    should_launch_gpu_next: false,
    reason: "V13 does not fill enough targeted Qwen-only gaps; build the next packet from row-level supported/unsupported deltas before more compute.",
    positive_training_sources: supportedContractComplete.map((row) => row.example_id),
    hard_negative_sources: unsupportedContractComplete.map((row) => row.example_id),
    targeted_failures_to_repair: targetFailures.map((row) => ({
      example_id: row.example_id,
      answered: row.policies.v13.answered,
      answer_citation_complete: row.policies.v13.answer_citation_complete,
      judge_verdict: row.policies.v13.judge_verdict,
      tags: row.v13_failure_tags,
      answer_preview: row.v13_answer_preview,
    })),
  };
}

function deriveStatus(rows, targetRows) {
  const targetSupported = targetRows.filter((row) => row.policies.v13.supported_answer).length;
  const newSupported = summarizeCandidateDelta(rows).v13_supported_not_in_qwen_oracle_ids.length;
  if (targetSupported >= Math.ceil(targetRows.length / 2) && newSupported >= 4) return "v13_gap_scaffold_promising_but_needs_selector";
  if (targetSupported > 0 || newSupported > 0) return "v13_partial_gap_signal_not_launch_ready";
  return "v13_no_gap_fill_negative";
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
  };
}

function renderReport(result) {
  const gap = result.coverage_gap_delta;
  const delta = result.candidate_delta;
  return `# V13 Coverage-Gap Delta

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no compute. It joins the v13 predictions, paid v13 judgments, the v13 contract audit, the qwen-only amortization diagnostic, and the calibrated hybrid selector.

## Metrics

| Policy | Answered | Supported answers | Answer support | Overall correct |
| --- | ---: | ---: | ---: | ---: |
| V13 standalone | ${result.metrics.v13.answered} | ${result.metrics.v13.supported_answers} | ${pct(result.metrics.v13.answer_support_rate)} | ${pct(result.metrics.v13.overall_judged_correct_rate)} |
| Qwen-only heuristic | ${result.metrics.qwen_only_heuristic.answered} | ${result.metrics.qwen_only_heuristic.supported_answers} | ${pct(result.metrics.qwen_only_heuristic.answer_support_rate)} | ${pct(result.metrics.qwen_only_heuristic.overall_judged_correct_rate)} |
| Qwen-only oracle | ${result.metrics.qwen_only_oracle.answered} | ${result.metrics.qwen_only_oracle.supported_answers} | ${pct(result.metrics.qwen_only_oracle.answer_support_rate)} | ${pct(result.metrics.qwen_only_oracle.overall_judged_correct_rate)} |
| Scaffold priority | ${result.metrics.scaffold_priority.answered} | ${result.metrics.scaffold_priority.supported_answers} | ${pct(result.metrics.scaffold_priority.answer_support_rate)} | ${pct(result.metrics.scaffold_priority.overall_judged_correct_rate)} |
| Calibrated hybrid | ${result.metrics.calibrated_hybrid.answered} | ${result.metrics.calibrated_hybrid.supported_answers} | ${pct(result.metrics.calibrated_hybrid.answer_support_rate)} | ${pct(result.metrics.calibrated_hybrid.overall_judged_correct_rate)} |
| Scaffold + v13 answer-citation gate | ${result.metrics.scaffold_plus_v13_answer_citation_gate.answered} | ${result.metrics.scaffold_plus_v13_answer_citation_gate.supported_answers} | ${pct(result.metrics.scaffold_plus_v13_answer_citation_gate.answer_support_rate)} | ${pct(result.metrics.scaffold_plus_v13_answer_citation_gate.overall_judged_correct_rate)} |
| Scaffold + v13 oracle | ${result.metrics.scaffold_plus_v13_oracle.answered} | ${result.metrics.scaffold_plus_v13_oracle.supported_answers} | ${pct(result.metrics.scaffold_plus_v13_oracle.answer_support_rate)} | ${pct(result.metrics.scaffold_plus_v13_oracle.overall_judged_correct_rate)} |

## Targeted Coverage Gaps

| Targeted gaps | V13 answered | V13 supported | New supported gaps | Unsupported answered gaps |
| ---: | ---: | ---: | ---: | ---: |
| ${gap.targeted_gap_examples} | ${gap.v13_answered} | ${gap.v13_supported_answers} | ${gap.new_supported_gap_ids.length} | ${gap.unsupported_gap_ids.length} |

New supported gap ids: ${gap.new_supported_gap_ids.length ? gap.new_supported_gap_ids.map((id) => `\`${id}\``).join(", ") : "none"}

Repeated supported gap ids: ${gap.repeated_supported_gap_ids.length ? gap.repeated_supported_gap_ids.map((id) => `\`${id}\``).join(", ") : "none"}

## Candidate Delta

- V13 supported answers not in the prior Qwen-only oracle: ${delta.v13_supported_not_in_qwen_oracle_ids.length}
- Prior Qwen-only oracle supported answers not reproduced by V13: ${delta.qwen_oracle_supported_not_reproduced_by_v13_ids.length}
- Scaffold abstentions where V13 supplies a supported answer: ${delta.scaffold_abstention_v13_supported_ids.length}
- Scaffold + V13 oracle supported-answer delta: ${signed(delta.scaffold_plus_v13_oracle_supported_answer_delta)}
- Scaffold + V13 answer-citation gate supported-answer delta: ${signed(delta.scaffold_plus_v13_gate_supported_answer_delta)}

## Next Packet Signal

Do not launch another GPU job from this result alone. Use the supported, citation-complete V13 rows as positives and the answer-citation-complete unsupported rows as hard negatives, then rebuild the training target around row-level support deltas rather than aggregate answer coverage.
`;
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
