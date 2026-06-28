import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const runId = "support-discrimination-split-stress-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const supportAuditRunId = "support-discrimination-feature-audit-0-320-to-321-389-2026-06-28-v1";
const packetRunId = "high-score-unsupported-packet-audit-0-320-to-321-389-2026-06-28-v1";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const supportAudit = await readJson(path.join(runsDir, supportAuditRunId, "result.json"));
const policies = await readJsonl(path.join(runsDir, supportAuditRunId, "policy_metrics.jsonl"));
const featureNames = await readJson(path.join(runsDir, supportAuditRunId, "feature_names.json"));
const packetRows = await readJsonl(path.join(runsDir, packetRunId, "packet_rows.jsonl"));

const earlyRows = packetRows.filter((row) => !paperId(row).startsWith("2004."));
const lateRows = packetRows.filter((row) => paperId(row).startsWith("2004."));
const trainRows = packetRows.filter((row) => row.split === "train");
const validationRows = packetRows.filter((row) => row.split === "validation");

const stressRows = policies.map((policy) => ({
  policy_id: policy.policy_id,
  model: policy.model,
  original_train: policy.train,
  original_validation: policy.validation,
  early_nonfinal: evaluateRows(earlyRows, policy),
  late_2004_nonfinal: evaluateRows(lateRows, policy),
  final_analog_reporting: policy.final_analog_reporting,
}));

const selectedOriginal = select(stressRows, (row) => row.original_validation);
const selectedLate = select(stressRows, (row) => row.late_2004_nonfinal);
const selectedConservative = selectConservative(stressRows);
const diagnosticBestFinal = [...stressRows].sort((left, right) =>
  -left.final_analog_reporting.accuracy + right.final_analog_reporting.accuracy
  || -left.original_validation.accuracy + right.original_validation.accuracy
  || left.policy_id.localeCompare(right.policy_id)
)[0];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "support_discrimination_split_stress_audit",
  status: statusFor({ selectedOriginal, selectedLate, selectedConservative }),
  purpose: "Stress-test whether existing high-score unsupported-answer non-final splits can select a final-transferable support discriminator.",
  source_runs: {
    support_discrimination_feature_audit: supportAuditRunId,
    high_score_unsupported_packet_audit: packetRunId,
  },
  data: {
    packet_rows: packetRows.length,
    train_rows: trainRows.length,
    validation_rows: validationRows.length,
    early_nonfinal_rows: earlyRows.length,
    late_2004_nonfinal_rows: lateRows.length,
    early_nonfinal_examples: new Set(earlyRows.map((row) => row.example_id)).size,
    late_2004_nonfinal_examples: new Set(lateRows.map((row) => row.example_id)).size,
    policies_evaluated: policies.length,
    feature_count: featureNames.length,
  },
  selected_policies: {
    original_validation: selectedOriginal,
    late_2004_nonfinal: selectedLate,
    conservative_intersection: selectedConservative,
    diagnostic_best_final: diagnosticBestFinal,
  },
  comparison: {
    original_selected_final_accuracy: selectedOriginal.final_analog_reporting.accuracy,
    late_selected_final_accuracy: selectedLate.final_analog_reporting.accuracy,
    conservative_selected_final_accuracy: selectedConservative?.final_analog_reporting?.accuracy ?? null,
    diagnostic_best_final_accuracy: diagnosticBestFinal.final_analog_reporting.accuracy,
    late_minus_original_final_accuracy: selectedLate.final_analog_reporting.accuracy - selectedOriginal.final_analog_reporting.accuracy,
    diagnostic_best_minus_late_final_accuracy: diagnosticBestFinal.final_analog_reporting.accuracy - selectedLate.final_analog_reporting.accuracy,
  },
  decision: decisionFromResult({ selectedOriginal, selectedLate, selectedConservative, diagnosticBestFinal }),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_transfer: true,
    selected_policy_source: "nonfinal_split_stress_only",
    diagnostic_best_final_policy_is_not_deployable: true,
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
    note: "Zero-call split stress audit over existing support-discrimination policy metrics and packet rows.",
  },
  artifacts: {
    policy_stress_metrics_jsonl: rel(path.join(outputDir, "policy_stress_metrics.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "policy_stress_metrics.jsonl"), stressRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  data: result.data,
  selected_policies: result.selected_policies,
  comparison: result.comparison,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function select(rows, metricFn) {
  return [...rows].sort((left, right) => {
    const lm = metricFn(left);
    const rm = metricFn(right);
    return -lm.accuracy + rm.accuracy
      || -lm.mean_margin + rm.mean_margin
      || left.policy_id.localeCompare(right.policy_id);
  })[0];
}

function selectConservative(rows) {
  const eligible = rows.filter((row) =>
    row.original_validation.accuracy >= 0.7
    && row.late_2004_nonfinal.accuracy >= 0.7
    && row.early_nonfinal.accuracy >= 0.65
  );
  if (!eligible.length) return null;
  return [...eligible].sort((left, right) =>
    -Math.min(left.original_validation.accuracy, left.late_2004_nonfinal.accuracy, left.early_nonfinal.accuracy)
      + Math.min(right.original_validation.accuracy, right.late_2004_nonfinal.accuracy, right.early_nonfinal.accuracy)
    || -left.original_validation.mean_margin + right.original_validation.mean_margin
    || left.policy_id.localeCompare(right.policy_id)
  )[0];
}

function evaluateRows(rows, policy) {
  const scorer = scorerForPolicy(policy);
  let correct = 0;
  const margins = [];
  for (const row of rows) {
    const chosenScore = scorer(row.chosen);
    const rejectedScore = scorer(row.rejected);
    if (chosenScore >= rejectedScore) correct += 1;
    margins.push(chosenScore - rejectedScore);
  }
  return {
    pairs: rows.length,
    correct,
    errors: rows.length - correct,
    accuracy: ratio(correct, rows.length),
    mean_margin: mean(margins),
  };
}

function scorerForPolicy(policy) {
  if (policy.policy_id === "heuristic_shorter_supported_shape") {
    return (candidate) => Number(candidate.question_overlap ?? 0) * 0.5 + Math.log1p((candidate.citations ?? []).length) * 0.2 - Math.log1p(Number(candidate.answer_tokens ?? 0)) * 0.25;
  }
  if (policy.policy_id === "heuristic_claim_density_penalty") {
    return (candidate) => Number(candidate.question_overlap ?? 0) * 0.4 - claimDensity(candidate) * 0.8;
  }
  if (policy.policy_id === "heuristic_numeric_comparative_penalty") {
    return (candidate) => Number(candidate.question_overlap ?? 0) * 0.4 - numericTokenCount(candidate.answer) * 0.15 - comparativeTokenCount(candidate.answer) * 0.35;
  }
  const weights = featureNames.map((feature) => Number(policy.weights?.[feature] ?? 0));
  return (candidate) => dot(weights, features(candidate));
}

function features(candidate) {
  const answer = String(candidate.answer ?? "");
  const citations = Array.isArray(candidate.citations) ? candidate.citations : [];
  const answerTokens = Number(candidate.answer_tokens ?? contentTokens(answer).length);
  const claimCount = Number(candidate.claim_count ?? 0);
  const questionOverlap = Number(candidate.question_overlap ?? 0);
  const isAnswer = candidate.answer_type === "grounded_answer" ? 1 : 0;
  const isAbstain = candidate.answer_type === "abstain" ? 1 : 0;
  const logAnswerTokens = Math.log1p(answerTokens);
  const logCitations = Math.log1p(citations.length);
  const logClaims = Math.log1p(claimCount);
  return [
    1,
    isAnswer,
    isAbstain,
    Number(candidate.listwise_score ?? 0),
    logAnswerTokens,
    logCitations,
    logClaims,
    questionOverlap,
    ratio(citations.length, Math.max(1, answerTokens)),
    ratio(claimCount, Math.max(1, answerTokens)),
    numericTokenCount(answer),
    comparativeTokenCount(answer),
    String(candidate.family ?? "").startsWith("qwen") ? 1 : 0,
    String(candidate.family ?? "").includes("openai") ? 1 : 0,
    isAnswer * questionOverlap,
    logClaims * logCitations,
  ];
}

function statusFor({ selectedOriginal, selectedLate, selectedConservative }) {
  if (selectedConservative?.final_analog_reporting?.accuracy >= 0.65) return "split_stress_finds_transferable_selector";
  if (selectedOriginal.final_analog_reporting.accuracy < 0.5 && selectedLate.final_analog_reporting.accuracy < 0.5) return "existing_splits_select_anti_transfer";
  return "existing_splits_not_reliable";
}

function decisionFromResult({ selectedOriginal, selectedLate, selectedConservative, diagnosticBestFinal }) {
  const transferable = selectedConservative?.final_analog_reporting?.accuracy >= 0.65;
  return {
    integrate_selector_now: transferable,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    plan_targeted_label_batch_next: !transferable,
    reason: transferable
      ? "A non-final conservative split criterion identifies a support discriminator that transfers to final analog hard negatives."
      : `Existing non-final split choices anti-transfer (original ${pct(selectedOriginal.final_analog_reporting.accuracy)}, late ${pct(selectedLate.final_analog_reporting.accuracy)}) while the diagnostic final-only policy reaches ${pct(diagnosticBestFinal.final_analog_reporting.accuracy)}.`,
  };
}

function renderReport(result) {
  const s = result.selected_policies;
  return `# Support-Discrimination Split Stress Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no API calls and launches no compute.

## Data

- Packet rows: ${result.data.packet_rows}
- Early non-final rows: ${result.data.early_nonfinal_rows}
- Late 2004 non-final rows: ${result.data.late_2004_nonfinal_rows}
- Policies evaluated: ${result.data.policies_evaluated}

## Selected Policies

| Selection source | Policy | Selection accuracy | Final analog accuracy |
| --- | --- | ---: | ---: |
| Original validation | \`${s.original_validation.policy_id}\` | ${pct(s.original_validation.original_validation.accuracy)} | ${pct(s.original_validation.final_analog_reporting.accuracy)} |
| Late 2004 non-final | \`${s.late_2004_nonfinal.policy_id}\` | ${pct(s.late_2004_nonfinal.late_2004_nonfinal.accuracy)} | ${pct(s.late_2004_nonfinal.final_analog_reporting.accuracy)} |
| Conservative intersection | ${s.conservative_intersection ? `\`${s.conservative_intersection.policy_id}\`` : "none"} | ${s.conservative_intersection ? pct(Math.min(s.conservative_intersection.original_validation.accuracy, s.conservative_intersection.late_2004_nonfinal.accuracy, s.conservative_intersection.early_nonfinal.accuracy)) : "n/a"} | ${s.conservative_intersection ? pct(s.conservative_intersection.final_analog_reporting.accuracy) : "n/a"} |
| Diagnostic final-only | \`${s.diagnostic_best_final.policy_id}\` | n/a | ${pct(s.diagnostic_best_final.final_analog_reporting.accuracy)} |

## Decision

- Integrate selector now: ${result.decision.integrate_selector_now ? "yes" : "no"}
- Plan targeted label batch next: ${result.decision.plan_targeted_label_batch_next ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
}

function paperId(row) {
  return String(row.example_id).split(":")[0];
}

function claimDensity(candidate) {
  return ratio(Number(candidate.claim_count ?? 0), Math.max(1, Number(candidate.answer_tokens ?? contentTokens(candidate.answer).length)));
}

function numericTokenCount(text) {
  return (String(text ?? "").match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []).length;
}

function comparativeTokenCount(text) {
  return (String(text ?? "").toLowerCase().match(/\b(more|less|better|worse|higher|lower|best|worst|larger|smaller|improve|outperform|underperform|significant|significantly)\b/g) ?? []).length;
}

function contentTokens(text) {
  return String(text ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function dot(weights, xs) {
  return weights.reduce((sum, weight, index) => sum + weight * xs[index], 0);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
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
