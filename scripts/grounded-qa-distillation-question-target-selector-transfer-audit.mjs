import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const runId = "question-target-selector-transfer-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const labelRunId = "question-target-label-batch-run-gpt4o-mini-2026-06-28-v1";
const finalPairRunId = "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

await fs.mkdir(outputDir, { recursive: true });

const requests = await readJsonl(path.join(runsDir, labelRunId, "requests.jsonl"));
const judgments = await readJsonl(path.join(runsDir, labelRunId, "judgments.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, finalPairRunId, "heldout_pairwise.jsonl"));
const requestById = new Map(requests.map((row) => [row.request_id, row]));

const trainRows = judgments
  .filter((row) => !row.skipped && row.duplicate_calibration !== true)
  .map((judgment) => trainRow(judgment, requestById.get(judgment.request_id)))
  .filter((row) => row.label === "chosen" || row.label === "rejected");
const finalRows = finalPairs.map((pair) => ({
  row_id: pair.pair_id,
  label: "chosen",
  chosen: pair.chosen,
  rejected: pair.rejected,
}));

const singleFeaturePolicies = singleFeatureGrid().map((policy) => evaluatePolicy(policy, trainRows, finalRows));
const linearPolicies = linearGrid().map((policy) => evaluatePolicy(policy, trainRows, finalRows));
const deployablePolicies = [...singleFeaturePolicies, ...linearPolicies]
  .filter((row) => row.train.covered >= 50)
  .sort((left, right) =>
    right.train.accuracy - left.train.accuracy
    || right.train.covered - left.train.covered
    || left.policy_id.localeCompare(right.policy_id)
  );
const selectedPolicy = deployablePolicies[0];
const bestFinalPolicy = [...singleFeaturePolicies, ...linearPolicies]
  .filter((row) => row.final.covered >= 50)
  .sort((left, right) =>
    right.final.accuracy - left.final.accuracy
    || right.final.covered - left.final.covered
    || left.policy_id.localeCompare(right.policy_id)
  )[0];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "question_target_selector_transfer_audit",
  status: selectedPolicy.final.accuracy >= 0.75
    ? "question_target_selector_transfers_pairwise"
    : "question_target_selector_anti_transfers_pairwise",
  purpose: "Test whether the paid D309 target-completeness labels support a cheap feature selector that transfers to final heldout supported-vs-unsupported pairs.",
  source_runs: {
    question_target_label_batch_run: labelRunId,
    final_margin_compatible_heldout_packet: finalPairRunId,
  },
  data: {
    paid_primary_label_rows: trainRows.length,
    final_pairwise_rows: finalRows.length,
    single_feature_policies: singleFeaturePolicies.length,
    linear_policies: linearPolicies.length,
    deployable_policy_candidates: deployablePolicies.length,
  },
  selected_by_nonfinal_labels: summarizePolicy(selectedPolicy),
  diagnostic_best_final_policy: summarizePolicy(bestFinalPolicy),
  decision: {
    integrate_feature_selector_now: false,
    train_question_target_verifier_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Do not promote a scalar feature selector. Convert D309 labels into a richer text-pair verifier target, then evaluate transfer before any GPU launch.",
    reason: `The best non-final label-selected policy reaches ${pct(selectedPolicy.train.accuracy)} on ${selectedPolicy.train.covered} D309 primary rows but only ${pct(selectedPolicy.final.accuracy)} on ${selectedPolicy.final.covered} final heldout pairs; surface feature agreement is not a deployable target-completeness verifier.`,
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_policy_selection: false,
    final_window_labels_used_for_reporting_transfer: true,
    paid_label_rows_training_use: "allowed_nonfinal_question_target_label_selection",
    final_pair_rows_training_use: "forbidden_final_window_reporting_only",
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
    note: "Zero-call transfer audit over the already-paid D309 labels and frozen final pairwise artifact.",
  },
};

await writeJsonl(path.join(outputDir, "single_feature_policies.jsonl"), singleFeaturePolicies.map(compactPolicy));
await writeJsonl(path.join(outputDir, "linear_policies.jsonl"), linearPolicies.map(compactPolicy));
await writeJsonl(path.join(outputDir, "selected_policy_errors.jsonl"), selectedPolicy.final.errors);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_by_nonfinal_labels: result.selected_by_nonfinal_labels,
  diagnostic_best_final_policy: result.diagnostic_best_final_policy,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function trainRow(judgment, request) {
  if (!request) throw new Error(`Missing request for ${judgment.request_id}`);
  return {
    row_id: judgment.request_id,
    label: judgment.judgment.preferred_for_grounded_answer,
    chosen: request.input.candidate_chosen,
    rejected: request.input.candidate_rejected,
  };
}

function singleFeatureGrid() {
  const policies = [];
  for (const feature of featureNames()) {
    for (const direction of ["higher", "lower"]) {
      policies.push({
        policy_id: `single_${feature}_${direction}`,
        type: "single_feature",
        feature,
        direction,
        weights: null,
      });
    }
  }
  return policies;
}

function linearGrid() {
  const values = [-2, -1, -0.5, 0, 0.5, 1, 2];
  const policies = [];
  for (const answerTokens of values) {
    for (const citationCount of values) {
      for (const claimCount of values) {
        for (const numberCount of values) {
          for (const empty of values) {
            const weights = { log_answer_tokens: answerTokens, citation_count: citationCount, claim_count: claimCount, number_count: numberCount, empty };
            if (Object.values(weights).every((value) => value === 0)) continue;
            policies.push({
              policy_id: `linear_${Object.values(weights).join("_").replaceAll("-", "m").replaceAll(".", "p")}`,
              type: "linear_feature_grid",
              feature: null,
              direction: null,
              weights,
            });
          }
        }
      }
    }
  }
  return policies;
}

function evaluatePolicy(policy, train, final) {
  return {
    ...policy,
    train: evaluateRows(policy, train),
    final: evaluateRows(policy, final),
  };
}

function evaluateRows(policy, rows) {
  let covered = 0;
  let correct = 0;
  const errors = [];
  for (const row of rows) {
    const predicted = predict(policy, row.chosen, row.rejected);
    if (!predicted) continue;
    covered += 1;
    if (predicted === row.label) {
      correct += 1;
    } else if (errors.length < 50) {
      errors.push({
        row_id: row.row_id,
        expected: row.label,
        predicted,
        chosen_features: candidateFeatures(row.chosen),
        rejected_features: candidateFeatures(row.rejected),
      });
    }
  }
  return {
    rows: rows.length,
    covered,
    correct,
    errors_count: covered - correct,
    coverage: rate(covered, rows.length),
    accuracy: rate(correct, covered),
    errors,
  };
}

function predict(policy, chosen, rejected) {
  const left = candidateFeatures(chosen);
  const right = candidateFeatures(rejected);
  let score;
  if (policy.type === "single_feature") {
    const direction = policy.direction === "higher" ? 1 : -1;
    score = direction * (left[policy.feature] - right[policy.feature]);
  } else {
    score = 0;
    for (const [feature, weight] of Object.entries(policy.weights)) {
      score += weight * (left[feature] - right[feature]);
    }
  }
  if (Math.abs(score) < 1e-12) return null;
  return score > 0 ? "chosen" : "rejected";
}

function candidateFeatures(candidate) {
  return {
    log_answer_tokens: Math.log1p(tokenCount(candidate.answer)),
    answer_tokens: tokenCount(candidate.answer),
    citation_count: (candidate.citations ?? []).length,
    claim_count: (candidate.claim_table ?? []).length,
    number_count: numberCount(candidate.answer),
    empty: emptyAnswer(candidate.answer) ? 1 : 0,
  };
}

function featureNames() {
  return ["answer_tokens", "citation_count", "claim_count", "number_count", "empty"];
}

function summarizePolicy(policy) {
  return {
    policy_id: policy.policy_id,
    type: policy.type,
    feature: policy.feature,
    direction: policy.direction,
    weights: policy.weights,
    train: withoutErrors(policy.train),
    final: withoutErrors(policy.final),
  };
}

function compactPolicy(policy) {
  return {
    policy_id: policy.policy_id,
    type: policy.type,
    feature: policy.feature,
    direction: policy.direction,
    weights: policy.weights,
    train: withoutErrors(policy.train),
    final: withoutErrors(policy.final),
  };
}

function withoutErrors(metrics) {
  const { errors, ...rest } = metrics;
  return rest;
}

function renderReport(result) {
  const selected = result.selected_by_nonfinal_labels;
  const best = result.diagnostic_best_final_policy;
  return `# Question-Target Selector Transfer Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit uses the paid D309 non-final target-completeness labels to select a cheap surface-feature selector, then reports transfer on frozen final supported-vs-unsupported pairs.

## Selected By Non-Final Labels

- Policy: ${selected.policy_id}
- Train accuracy: ${selected.train.correct}/${selected.train.covered} (${pct(selected.train.accuracy)})
- Final accuracy: ${selected.final.correct}/${selected.final.covered} (${pct(selected.final.accuracy)})

## Diagnostic Best Final Policy

- Policy: ${best.policy_id}
- Final accuracy: ${best.final.correct}/${best.final.covered} (${pct(best.final.accuracy)})
- Train accuracy: ${best.train.correct}/${best.train.covered} (${pct(best.train.accuracy)})

## Decision

- Integrate feature selector now: ${result.decision.integrate_feature_selector_now ? "yes" : "no"}
- Train question-target verifier now: ${result.decision.train_question_target_verifier_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
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

function tokenCount(text) {
  return String(text ?? "").toLowerCase().match(/[a-z0-9]+/g)?.length ?? 0;
}

function numberCount(text) {
  return String(text ?? "").match(/\d+(?:\.\d+)?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million)\b/gi)?.length ?? 0;
}

function emptyAnswer(text) {
  return /^(\[empty answer\]|empty answer|no_answer)?$/i.test(String(text ?? "").trim());
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value || 0)).toFixed(1)}%`;
}
