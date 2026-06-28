import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const runId = "mined-overclaim-citation-text-probe-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const packetRunId = "mined-overclaim-citation-packet-2026-06-28-v1";
const surfaceProbeRunId = "mined-overclaim-citation-probe-2026-06-28-v1";
const stopwords = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "with", "on", "by", "is", "are", "was", "were", "be", "as", "that", "this", "it", "from", "at", "which", "what", "how", "does", "do", "did", "we", "they", "their", "our", "using", "used", "uses", "e1", "e2", "e3", "e4", "e5", "e6",
]);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const surfaceProbe = await readJson(path.join(runsDir, surfaceProbeRunId, "result.json"));
const trainRows = await readJsonl(path.join(runsDir, packetRunId, "dataset", "train_dpo.jsonl"));
const validationRows = await readJsonl(path.join(runsDir, packetRunId, "dataset", "validation_dpo.jsonl"));
const finalRows = await readJsonl(path.join(runsDir, surfaceProbeRunId, "final_reporting_predictions.jsonl"));
const finalPairs = await reconstructFinalPairs();
const vocab = buildVocabulary(trainRows, 180);

const policies = [];
for (const lr of [0.005, 0.01, 0.03, 0.08]) {
  for (const l2 of [0, 0.001, 0.01, 0.05]) {
    for (const epochs of [80, 160, 320]) {
      const model = trainLogistic(trainRows, { lr, l2, epochs });
      const policyId = `text_logreg_lr_${name(lr)}_l2_${name(l2)}_e_${epochs}`;
      policies.push({
        policy_id: policyId,
        model: "mined_overclaim_citation_text_pairwise",
        config: { lr, l2, epochs, vocab_size: vocab.length },
        top_positive_tokens: topWeighted(model.weights, 8, true),
        top_negative_tokens: topWeighted(model.weights, 8, false),
        train: evaluatePairs(trainRows, model.score),
        validation: evaluatePairs(validationRows, model.score),
        final_reporting: evaluatePairs(finalPairs, model.score),
      });
    }
  }
}

const selected = selectByValidation(policies);
const diagnosticBestFinal = [...policies].sort((left, right) =>
  -left.final_reporting.accuracy + right.final_reporting.accuracy
  || -left.validation.accuracy + right.validation.accuracy
  || left.policy_id.localeCompare(right.policy_id)
)[0];
const validationPredictions = predictPairs(validationRows, scorerForPolicy(selected));
const finalPredictions = predictPairs(finalPairs, scorerForPolicy(selected));
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "mined_overclaim_citation_text_probe",
  status: statusFor(selected),
  packet_run_id: packetRunId,
  surface_probe_run_id: surfaceProbeRunId,
  purpose: "Test whether a richer local lexical pairwise verifier improves over the surface overclaim/citation probe without new LLM or GPU spend.",
  data: {
    train_pairs: trainRows.length,
    validation_pairs: validationRows.length,
    final_reporting_pairs: finalPairs.length,
    vocab_size: vocab.length,
    policies_evaluated: policies.length,
  },
  selected_by_validation: selected,
  diagnostic_best_final_policy: diagnosticBestFinal,
  comparison: {
    surface_selected_validation_accuracy: surfaceProbe.selected_by_validation?.validation?.accuracy,
    surface_selected_final_reporting_accuracy: surfaceProbe.selected_by_validation?.final_reporting?.accuracy,
    text_selected_validation_accuracy: selected.validation.accuracy,
    text_selected_final_reporting_accuracy: selected.final_reporting.accuracy,
    diagnostic_best_final_accuracy: diagnosticBestFinal.final_reporting.accuracy,
  },
  decision: decisionFromResult(selected, surfaceProbe),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_transfer: true,
    vocabulary_source: "mined_nonfinal_train_rows_only",
    selected_policy_source: "mined_nonfinal_text_validation_only",
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
    note: "Zero-call local lexical probe over already-ledgered judged artifacts.",
  },
  artifacts: {
    vocabulary_json: rel(path.join(outputDir, "vocabulary.json")),
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    validation_predictions_jsonl: rel(path.join(outputDir, "validation_predictions.jsonl")),
    final_reporting_predictions_jsonl: rel(path.join(outputDir, "final_reporting_predictions.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await fs.writeFile(path.join(outputDir, "vocabulary.json"), `${JSON.stringify(vocab, null, 2)}\n`);
await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), policies);
await writeJsonl(path.join(outputDir, "validation_predictions.jsonl"), validationPredictions);
await writeJsonl(path.join(outputDir, "final_reporting_predictions.jsonl"), finalPredictions);
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

function buildVocabulary(rows, maxTerms) {
  const counts = new Map();
  for (const row of rows) {
    for (const candidate of [row.chosen, row.rejected]) {
      for (const token of candidateTokens(candidate)) {
        if (stopwords.has(token)) continue;
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, maxTerms)
    .map(([token]) => token);
}

function trainLogistic(pairs, config) {
  const weights = Array(vocab.length + 8).fill(0);
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
      row_id: pair.row_id,
      example_id: pair.example_id,
      chosen_score: chosenScore,
      rejected_score: rejectedScore,
      margin: chosenScore - rejectedScore,
      predicted: chosenScore >= rejectedScore ? "chosen" : "rejected",
      expected: "chosen",
      correct: chosenScore >= rejectedScore,
      failure_mode: pair.failure_mode,
    };
  });
}

function scorerForPolicy(policy) {
  const row = policies.find((item) => item.policy_id === policy.policy_id);
  const weights = row?._weights ?? null;
  if (weights) return (candidate, question) => dot(weights, features(candidate, question));
  const config = policy.config;
  const model = trainLogistic(trainRows, config);
  return model.score;
}

function diffFeatures(pair, leftKey, rightKey) {
  const lf = features(pair[leftKey], pair.question);
  const rf = features(pair[rightKey], pair.question);
  return lf.map((value, index) => value - rf[index]);
}

function features(candidate, question) {
  const tokenSet = new Set(candidateTokens(candidate));
  const lexical = vocab.map((token) => tokenSet.has(token) ? 1 : 0);
  const answer = String(candidate.answer ?? "");
  const citations = candidate.citations ?? [];
  const claims = candidate.claim_table ?? [];
  return [
    1,
    Math.log1p(answerTokens(answer).length),
    Math.log1p(citations.length),
    Math.log1p(claims.length),
    numericTokenCount(answer),
    comparativeTokenCount(answer),
    citations.length ? 0 : 1,
    tokenOverlap(question, answer),
    ...lexical,
  ];
}

function topWeighted(weights, count, positive) {
  const offset = 8;
  return vocab
    .map((token, index) => ({ token, weight: weights[offset + index] ?? 0 }))
    .filter((row) => positive ? row.weight > 0 : row.weight < 0)
    .sort((left, right) => positive ? right.weight - left.weight : left.weight - right.weight)
    .slice(0, count);
}

async function reconstructFinalPairs() {
  const surfaceFinal = await readJsonl(path.join(runsDir, surfaceProbeRunId, "final_reporting_predictions.jsonl"));
  const supportRows = await readJsonlIfPresent(path.join(runsDir, "support-ranker-pairwise-packet-expanded-2026-06-28-v1", "diagnostic_frontier_pairwise.jsonl"));
  const d351Rows = await readJsonlIfPresent(path.join(runsDir, "overclaim-citation-packet-from-high-score-support-labels-2026-06-28-v1", "dataset", "final_reporting_cases.jsonl"));
  const byId = new Map();
  for (const row of supportRows) {
    byId.set(row.pair_id, {
      row_id: row.pair_id,
      example_id: row.example_id,
      question: row.input?.question,
      chosen: normalizeCandidate(row.chosen),
      rejected: normalizeCandidate(row.rejected),
      failure_mode: classifyFailure(row.rejected),
    });
  }
  for (const row of d351Rows) {
    byId.set(row.row_id, {
      row_id: row.row_id,
      example_id: row.example_id,
      question: row.question,
      chosen: normalizeCandidate(row.chosen),
      rejected: normalizeCandidate(row.rejected),
      failure_mode: row.failure_mode,
    });
  }
  return surfaceFinal.map((row) => byId.get(row.row_id)).filter(Boolean);
}

function normalizeCandidate(candidate) {
  return {
    id: candidate.id ?? candidate.candidate_id ?? null,
    answer_type: candidate.answer_type,
    answer: candidate.answer ?? "",
    citations: candidate.citations ?? [],
    claim_table: candidate.claim_table ?? [],
  };
}

function classifyFailure(candidate) {
  const answer = String(candidate?.answer ?? "");
  if (!(candidate?.citations ?? []).length) return "citation_mismatch";
  if (numericTokenCount(answer) || comparativeTokenCount(answer)) return "numeric_or_comparison_overclaim";
  return "overbroad_or_overclaimed";
}

function statusFor(selected) {
  if (selected.validation.accuracy >= 0.75 && selected.final_reporting.accuracy >= 0.65) return "mined_overclaim_citation_text_probe_transfers";
  if (selected.validation.accuracy >= 0.75) return "mined_overclaim_citation_text_probe_overfits_nonfinal";
  return "mined_overclaim_citation_text_probe_not_sufficient";
}

function decisionFromResult(selected, surfaceProbeResult) {
  if (statusFor(selected) === "mined_overclaim_citation_text_probe_transfers") {
    return {
      integrate_text_verifier_next: true,
      launch_gpu_now: false,
      buy_more_openai_labels_now: false,
      reason: "The richer local lexical verifier transfers above threshold and should be tested in the full scaffold before any paid run.",
      next_step: "Integrate the text verifier into candidate ranking and rerun end-to-end final-window metrics.",
    };
  }
  return {
    integrate_text_verifier_next: false,
    launch_gpu_now: false,
    buy_more_openai_labels_now: false,
    reason: `The lexical verifier still fails transfer: validation ${selected.validation.accuracy.toFixed(3)}, final reporting ${selected.final_reporting.accuracy.toFixed(3)}, versus surface final ${Number(surfaceProbeResult.selected_by_validation?.final_reporting?.accuracy ?? 0).toFixed(3)}.`,
    next_step: "Stop selector-only work for this failure slice; the next useful move is targeted data generation or a small paid adjudication batch with stronger final-like sampling.",
  };
}

function renderReport(result) {
  const selected = result.selected_by_validation;
  return `# Mined Overclaim/Citation Text Probe

Generated: ${result.generated_at}

Status: \`${result.status}\`

This probe makes no API calls and launches no compute. The vocabulary is learned only from non-final train rows.

## Data

- Train pairs: ${result.data.train_pairs}
- Validation pairs: ${result.data.validation_pairs}
- Final reporting pairs: ${result.data.final_reporting_pairs}
- Vocabulary size: ${result.data.vocab_size}
- Policies evaluated: ${result.data.policies_evaluated}

## Selected Policy

- Policy: \`${selected.policy_id}\`
- Validation accuracy: ${pct(selected.validation.accuracy)}
- Final reporting accuracy: ${pct(selected.final_reporting.accuracy)}
- Surface final reporting accuracy: ${pct(result.comparison.surface_selected_final_reporting_accuracy)}

## Decision

- Integrate text verifier next: ${result.decision.integrate_text_verifier_next ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function candidateTokens(candidate) {
  return [
    ...answerTokens(candidate.answer),
    ...(candidate.claim_table ?? []).flatMap((claim) => answerTokens(JSON.stringify(claim))),
  ];
}

function answerTokens(text) {
  return String(text ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function numericTokenCount(text) {
  return (String(text ?? "").match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []).length;
}

function comparativeTokenCount(text) {
  return (String(text ?? "").toLowerCase().match(/\b(more|less|better|worse|higher|lower|best|worst|larger|smaller|improve|outperform|underperform|significant|significantly)\b/g) ?? []).length;
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
  await fs.writeFile(filePath, `${rows.map((row) => {
    const copy = { ...row };
    delete copy._weights;
    return JSON.stringify(copy);
  }).join("\n")}\n`);
}
