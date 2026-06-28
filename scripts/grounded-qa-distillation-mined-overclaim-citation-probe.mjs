import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const runId = "mined-overclaim-citation-probe-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const packetRunId = "mined-overclaim-citation-packet-2026-06-28-v1";
const finalPairFiles = [
  {
    run_id: "support-ranker-pairwise-packet-expanded-2026-06-28-v1",
    file: "diagnostic_frontier_pairwise.jsonl",
  },
  {
    run_id: "overclaim-citation-packet-from-high-score-support-labels-2026-06-28-v1",
    file: "dataset/final_reporting_cases.jsonl",
  },
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const packet = await readJson(path.join(runsDir, packetRunId, "result.json"));
const trainRows = await readJsonl(path.join(runsDir, packetRunId, "dataset", "train_dpo.jsonl"));
const validationRows = await readJsonl(path.join(runsDir, packetRunId, "dataset", "validation_dpo.jsonl"));
const finalRows = [];
for (const source of finalPairFiles) {
  const rows = await readJsonlIfPresent(path.join(runsDir, source.run_id, source.file));
  finalRows.push(...rows.map((row) => normalizeFinalRow(row, source.run_id, source.file)).filter(Boolean));
}

const featureNames = [
  "bias",
  "is_answer",
  "log_answer_tokens",
  "log_citations",
  "log_claims",
  "question_overlap",
  "citation_density",
  "claim_density",
  "numeric_token_count",
  "comparative_token_count",
  "inline_complete",
  "answer_x_overlap",
  "claims_x_citations",
  "missing_citation_penalty",
];

const policies = [];
for (const lr of [0.005, 0.01, 0.03, 0.08]) {
  for (const l2 of [0, 0.001, 0.01, 0.05]) {
    for (const epochs of [80, 160, 320]) {
      const model = trainLogistic(trainRows, { lr, l2, epochs });
      const policyId = `logreg_lr_${name(lr)}_l2_${name(l2)}_e_${epochs}`;
      policies.push({
        policy_id: policyId,
        model: "mined_overclaim_citation_logistic_pairwise",
        config: { lr, l2, epochs },
        weights: Object.fromEntries(featureNames.map((feature, index) => [feature, model.weights[index]])),
        train: evaluatePairs(trainRows, model.score),
        validation: evaluatePairs(validationRows, model.score),
        final_reporting: evaluatePairs(finalRows, model.score),
      });
    }
  }
}
for (const heuristic of heuristicPolicies()) {
  policies.push({
    policy_id: `heuristic_${heuristic.id}`,
    model: "mined_overclaim_citation_surface_heuristic",
    config: heuristic.config,
    weights: null,
    train: evaluatePairs(trainRows, heuristic.score),
    validation: evaluatePairs(validationRows, heuristic.score),
    final_reporting: evaluatePairs(finalRows, heuristic.score),
  });
}

const selected = selectByValidation(policies);
const diagnosticBestFinal = [...policies].sort((left, right) =>
  -left.final_reporting.accuracy + right.final_reporting.accuracy
  || -left.validation.accuracy + right.validation.accuracy
  || left.policy_id.localeCompare(right.policy_id)
)[0];
const validationPredictions = predictPairs(validationRows, scorerForPolicy(selected));
const finalPredictions = predictPairs(finalRows, scorerForPolicy(selected));
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "mined_overclaim_citation_probe",
  status: statusFor(selected),
  packet_run_id: packetRunId,
  purpose: "Test whether the mined non-final overclaim/citation packet selects a deployable local feature policy that transfers to final diagnostic rows.",
  data: {
    train_pairs: trainRows.length,
    validation_pairs: validationRows.length,
    final_reporting_pairs: finalRows.length,
    policies_evaluated: policies.length,
    packet_status: packet.status,
  },
  selected_by_validation: selected,
  diagnostic_best_final_policy: diagnosticBestFinal,
  comparison: {
    selected_validation_accuracy: selected.validation.accuracy,
    selected_final_reporting_accuracy: selected.final_reporting.accuracy,
    diagnostic_best_final_accuracy: diagnosticBestFinal.final_reporting.accuracy,
    diagnostic_best_final_minus_selected: diagnosticBestFinal.final_reporting.accuracy - selected.final_reporting.accuracy,
  },
  decision: decisionFromResult(selected, diagnosticBestFinal),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_transfer: true,
    selected_policy_source: "mined_nonfinal_overclaim_citation_validation_only",
    packet_train_validation_example_disjoint: packet.leakage_guard?.train_validation_example_disjoint === true,
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
    note: "Zero-call local probe over already-ledgered judged artifacts.",
  },
  artifacts: {
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    validation_predictions_jsonl: rel(path.join(outputDir, "validation_predictions.jsonl")),
    final_reporting_predictions_jsonl: rel(path.join(outputDir, "final_reporting_predictions.jsonl")),
    feature_names_json: rel(path.join(outputDir, "feature_names.json")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), policies);
await writeJsonl(path.join(outputDir, "validation_predictions.jsonl"), validationPredictions);
await writeJsonl(path.join(outputDir, "final_reporting_predictions.jsonl"), finalPredictions);
await fs.writeFile(path.join(outputDir, "feature_names.json"), `${JSON.stringify(featureNames, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  data: result.data,
  selected_by_validation: result.selected_by_validation,
  diagnostic_best_final_policy: result.diagnostic_best_final_policy,
  comparison: result.comparison,
  decision: result.decision,
  budget: result.budget,
}, null, 2));

function trainLogistic(pairs, config) {
  const weights = Array(featureNames.length).fill(0);
  const expanded = pairs.flatMap((pair) => [
    { x: diffFeatures(pair, "chosen", "rejected"), y: 1 },
    { x: diffFeatures(pair, "rejected", "chosen"), y: 0 },
  ]);
  for (let epoch = 0; epoch < config.epochs; epoch += 1) {
    for (const row of expanded) {
      const p = sigmoid(dot(weights, row.x));
      const error = p - row.y;
      for (let i = 0; i < weights.length; i += 1) {
        const penalty = i === 0 ? 0 : config.l2 * weights[i];
        weights[i] -= config.lr * (error * row.x[i] + penalty);
      }
    }
  }
  return {
    weights,
    score: (candidate, question) => dot(weights, features(candidate, question)),
  };
}

function heuristicPolicies() {
  return [
    {
      id: "shorter_cited_answer",
      config: { length_penalty: 0.25, citation_bonus: 0.25, claim_penalty: 0.15 },
      score: (candidate) => Math.log1p(candidate.citations?.length ?? 0) * 0.25 - Math.log1p(answerTokens(candidate.answer).length) * 0.25 - Math.log1p(candidate.claim_table?.length ?? 0) * 0.15,
    },
    {
      id: "numeric_comparison_penalty",
      config: { numeric_penalty: 0.2, comparative_penalty: 0.35, citation_bonus: 0.15 },
      score: (candidate) => Math.log1p(candidate.citations?.length ?? 0) * 0.15 - numericTokenCount(candidate.answer) * 0.2 - comparativeTokenCount(candidate.answer) * 0.35,
    },
    {
      id: "citation_contract_first",
      config: { inline_bonus: 0.8, citation_bonus: 0.15, length_penalty: 0.1 },
      score: (candidate) => (inlineComplete(candidate) ? 0.8 : -0.8) + Math.log1p(candidate.citations?.length ?? 0) * 0.15 - Math.log1p(answerTokens(candidate.answer).length) * 0.1,
    },
  ];
}

function selectByValidation(rows) {
  return [...rows].sort((left, right) =>
    -left.validation.accuracy + right.validation.accuracy
    || -left.validation.mean_margin + right.validation.mean_margin
    || -left.train.accuracy + right.train.accuracy
    || left.policy_id.localeCompare(right.policy_id)
  )[0];
}

function evaluatePairs(pairs, scorer) {
  const predictions = predictPairs(pairs, scorer);
  const correct = predictions.filter((row) => row.correct).length;
  return {
    pairs: predictions.length,
    correct,
    errors: predictions.length - correct,
    accuracy: ratio(correct, predictions.length),
    mean_margin: mean(predictions.map((row) => row.margin)),
  };
}

function predictPairs(pairs, scorer) {
  return pairs.map((pair) => {
    const chosenScore = scorer(pair.chosen, pair.question);
    const rejectedScore = scorer(pair.rejected, pair.question);
    return {
      row_id: pair.row_id ?? pair.pair_id,
      example_id: pair.example_id,
      chosen_id: pair.chosen?.id,
      rejected_id: pair.rejected?.id,
      chosen_score: chosenScore,
      rejected_score: rejectedScore,
      margin: chosenScore - rejectedScore,
      predicted: chosenScore >= rejectedScore ? "chosen" : "rejected",
      expected: "chosen",
      correct: chosenScore >= rejectedScore,
      failure_mode: pair.failure_mode,
      source_run_id: pair.source_metadata?.source_run_id ?? pair.source_run_id,
    };
  });
}

function scorerForPolicy(policy) {
  if (policy.model === "mined_overclaim_citation_surface_heuristic") {
    return heuristicPolicies().find((heuristic) => `heuristic_${heuristic.id}` === policy.policy_id).score;
  }
  const weights = featureNames.map((feature) => Number(policy.weights?.[feature] ?? 0));
  return (candidate, question) => dot(weights, features(candidate, question));
}

function diffFeatures(pair, leftKey, rightKey) {
  const lf = features(pair[leftKey], pair.question);
  const rf = features(pair[rightKey], pair.question);
  return lf.map((value, index) => value - rf[index]);
}

function features(candidate, question) {
  const answer = String(candidate.answer ?? "");
  const tokens = answerTokens(answer);
  const citations = Array.isArray(candidate.citations) ? candidate.citations : [];
  const claims = Array.isArray(candidate.claim_table) ? candidate.claim_table : [];
  const overlap = tokenOverlap(question, answer);
  const isAnswer = candidate.answer_type === "grounded_answer" ? 1 : 0;
  const logAnswerTokens = Math.log1p(tokens.length);
  const logCitations = Math.log1p(citations.length);
  const logClaims = Math.log1p(claims.length);
  return [
    1,
    isAnswer,
    logAnswerTokens,
    logCitations,
    logClaims,
    overlap,
    ratio(citations.length, Math.max(1, tokens.length)),
    ratio(claims.length, Math.max(1, tokens.length)),
    numericTokenCount(answer),
    comparativeTokenCount(answer),
    inlineComplete(candidate) ? 1 : 0,
    isAnswer * overlap,
    logClaims * logCitations,
    citations.length ? 0 : 1,
  ];
}

function normalizeFinalRow(row, sourceRunId, sourceFile) {
  if (sourceRunId === "overclaim-citation-packet-from-high-score-support-labels-2026-06-28-v1") {
    return {
      row_id: row.row_id,
      example_id: row.example_id,
      question: row.question,
      chosen: normalizeCandidate(row.chosen),
      rejected: normalizeCandidate(row.rejected),
      failure_mode: row.failure_mode === "citation_mismatch" ? "citation_mismatch" : "overbroad_or_overclaimed",
      source_metadata: { source_run_id: sourceRunId, source_file: sourceFile },
    };
  }
  if (!String(row.training_use ?? "").includes("forbidden")) return null;
  if (!row.chosen || !row.rejected) return null;
  const judge = row.judge?.rejected ?? row.rejected?.judgment ?? {};
  if (row.rejected?.answer_type && row.rejected.answer_type !== "grounded_answer") return null;
  const failureMode = classifyFailure({ judge, rejected: row.rejected, answer: row.rejected.answer });
  if (!failureMode) return null;
  return {
    row_id: row.pair_id,
    example_id: row.example_id ?? row.root_example_id,
    question: row.input?.question,
    chosen: normalizeCandidate(row.chosen),
    rejected: normalizeCandidate(row.rejected),
    failure_mode: failureMode,
    source_metadata: { source_run_id: sourceRunId, source_file: sourceFile },
  };
}

function classifyFailure({ judge, rejected, answer }) {
  const notes = String(judge.notes ?? "").toLowerCase();
  const missing = judge.missing_citations ?? [];
  const citations = rejected.citations ?? [];
  if (judge.citation_ids_valid === false || missing.length > 0 || !citations.length || /lacks? citations?|missing citations?|citation mismatch|not cited/.test(notes)) {
    return "citation_mismatch";
  }
  const unsupported = judge.unsupported_claims ?? rejected.unsupported_claims ?? [];
  if (unsupported.length || /not supported|unsupported|not contain|does not contain|doesn't contain|overclaim|too broad|omits|wrong|incorrect|not enough/.test(notes)) {
    if (numericTokenCount(answer) > 0 || comparativeTokenCount(answer) > 0) return "numeric_or_comparison_overclaim";
    return "overbroad_or_overclaimed";
  }
  return null;
}

function normalizeCandidate(candidate) {
  return {
    id: candidate.id ?? candidate.candidate_id ?? null,
    family: candidate.family ?? null,
    answer_type: candidate.answer_type,
    answer: candidate.answer ?? "",
    citations: candidate.citations ?? [],
    claim_table: candidate.claim_table ?? [],
    abstention_reason: candidate.abstention_reason ?? null,
  };
}

function statusFor(selected) {
  if (selected.validation.accuracy >= 0.75 && selected.final_reporting.accuracy >= 0.65) return "mined_overclaim_citation_probe_transfers";
  if (selected.validation.accuracy >= 0.75) return "mined_overclaim_citation_probe_overfits_nonfinal";
  return "mined_overclaim_citation_probe_not_sufficient";
}

function decisionFromResult(selected, diagnosticBestFinal) {
  if (statusFor(selected) === "mined_overclaim_citation_probe_transfers") {
    return {
      integrate_selector_next: true,
      launch_gpu_now: false,
      buy_more_openai_labels_now: false,
      reason: "The mined overclaim/citation feature policy transfers above threshold; next step is end-to-end scaffold integration without new spend.",
      next_step: "Integrate the selected feature policy into candidate ranking and rerun final-window scaffold metrics.",
    };
  }
  return {
    integrate_selector_next: false,
    launch_gpu_now: false,
    buy_more_openai_labels_now: false,
    reason: `Validation-selected policy does not transfer strongly enough: validation ${selected.validation.accuracy.toFixed(3)}, final reporting ${selected.final_reporting.accuracy.toFixed(3)}; diagnostic best-final ${diagnosticBestFinal.final_reporting.accuracy.toFixed(3)} is reporting-only.`,
    next_step: "Do not spend yet; inspect mined-packet failure mix and consider a richer text/verifier model only if it can be evaluated without final-label leakage.",
  };
}

function renderReport(result) {
  const selected = result.selected_by_validation;
  return `# Mined Overclaim/Citation Probe

Generated: ${result.generated_at}

Status: \`${result.status}\`

This probe makes no API calls and launches no compute. It selects on mined non-final validation rows and uses final-window rows only for reporting transfer.

## Data

- Train pairs: ${result.data.train_pairs}
- Validation pairs: ${result.data.validation_pairs}
- Final reporting pairs: ${result.data.final_reporting_pairs}
- Policies evaluated: ${result.data.policies_evaluated}

## Selected Policy

- Policy: \`${selected.policy_id}\`
- Validation accuracy: ${pct(selected.validation.accuracy)}
- Final reporting accuracy: ${pct(selected.final_reporting.accuracy)}
- Diagnostic best-final accuracy: ${pct(result.diagnostic_best_final_policy.final_reporting.accuracy)}

## Decision

- Integrate selector next: ${result.decision.integrate_selector_next ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function inlineComplete(candidate) {
  const answer = String(candidate.answer ?? "");
  const citations = candidate.citations ?? [];
  return citations.length > 0 && citations.every((id) => answer.includes(`[${id}]`));
}

function numericTokenCount(text) {
  return (String(text ?? "").match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []).length;
}

function comparativeTokenCount(text) {
  return (String(text ?? "").toLowerCase().match(/\b(more|less|better|worse|higher|lower|best|worst|larger|smaller|improve|outperform|underperform|significant|significantly)\b/g) ?? []).length;
}

function answerTokens(text) {
  return String(text ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function tokenOverlap(question, answer) {
  const questionTokens = new Set(answerTokens(question).filter((token) => token.length > 2));
  const answerSet = new Set(answerTokens(answer).filter((token) => token.length > 2));
  if (!questionTokens.size) return 0;
  let hits = 0;
  for (const token of questionTokens) {
    if (answerSet.has(token)) hits += 1;
  }
  return hits / questionTokens.size;
}

function dot(weights, xs) {
  return weights.reduce((sum, weight, index) => sum + weight * xs[index], 0);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value))));
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

function name(value) {
  return String(value).replace(".", "p");
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonlIfPresent(filePath) {
  try {
    return await readJsonl(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}
