import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourceRunId = args["source-run-id"] ?? "train-supervised-candidate-router-audit-frontier-repaired-v1";
const runId = args["run-id"] ?? "router-answer-recovery-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const source = await readJson(path.join(runsDir, sourceRunId, "result.json"));
const heldoutRows = await readJsonl(path.join(runsDir, sourceRunId, "train_heldout_selections.jsonl"));
const validationRows = await readJsonl(path.join(runsDir, sourceRunId, "validation_selections.jsonl"));

const grid = buildGrid();
const candidates = grid.map((params) => ({
  params,
  train_heldout: evaluateRows(heldoutRows, params),
}));
candidates.sort(compareCandidates);
const selected = candidates[0];
const heldoutSelections = applyPolicy(heldoutRows, selected.params);
const validationSelections = applyPolicy(validationRows, selected.params);
const heldoutMetrics = summarizePolicyRows(heldoutSelections);
const validationMetrics = summarizePolicyRows(validationSelections);
const aggressiveProbe = {
  params: { min_answer_probability: 0.1, max_probability_gap: 0.5 },
  train_heldout: evaluateRows(heldoutRows, { min_answer_probability: 0.1, max_probability_gap: 0.5 }),
  repaired_validation_gate: evaluateRows(validationRows, { min_answer_probability: 0.1, max_probability_gap: 0.5 }),
};

await writeJsonl(path.join(outputDir, "policy_grid.jsonl"), candidates);
await writeJsonl(path.join(outputDir, "train_heldout_recovery_selections.jsonl"), heldoutSelections);
await writeJsonl(path.join(outputDir, "validation_recovery_selections.jsonl"), validationSelections);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "router_answer_recovery_audit",
  status: statusFor(selected.params, validationMetrics),
  purpose: "Test whether a train-heldout-tuned answer-recovery overlay can fix the train-supervised router's grounded-answer misses without using validation labels.",
  source_run_id: sourceRunId,
  leakage_note: "Recovery thresholds are selected on repaired train-heldout rows only. Repaired validation is reported after threshold selection.",
  search_space: {
    candidates: candidates.length,
    min_answer_probability: [...new Set(grid.map((row) => row.min_answer_probability))],
    max_probability_gap: [...new Set(grid.map((row) => row.max_probability_gap))],
    policy: "If the base router selected abstain, switch to the highest-probability grounded-answer candidate only when answer_probability >= min_answer_probability and selected_probability - answer_probability <= max_probability_gap.",
    selection_objective: "Maximize train-heldout contract correctness, then grounded-target correctness, then minimize switched rows.",
  },
  selected_policy: selected.params,
  metrics: {
    source_train_heldout: source.metrics?.train_heldout,
    source_repaired_validation_gate: source.metrics?.repaired_validation_gate,
    train_heldout: heldoutMetrics,
    repaired_validation_gate: validationMetrics,
  },
  aggressive_recovery_probe: aggressiveProbe,
  baseline_comparison: {
    source_validation_contract_correct: Number(source.metrics?.repaired_validation_gate?.contract_correct),
    recovered_validation_contract_correct: validationMetrics.contract_correct,
    delta_vs_source_router: validationMetrics.contract_correct - Number(source.metrics?.repaired_validation_gate?.contract_correct),
    train_calibrated_scaffold_contract_correct: 44,
    delta_vs_train_calibrated_scaffold: validationMetrics.contract_correct - 44,
  },
  decision: {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    promote_recovery_overlay: false,
    next_step: nextStepFor(selected.params, validationMetrics),
    reason: "A recovery overlay must improve heldout train and repaired validation before it can be part of the candidate router. The selected heldout policy makes no switches.",
  },
  budget: {
    max_budget_usd: Number(budget.max_budget_usd),
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual),
    remaining_budget_usd: Number(budget.spend_usd?.remaining),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "This audit reuses existing router candidate probabilities and diagnostic labels only.",
  },
  artifacts: {
    policy_grid_jsonl: rel(path.join(outputDir, "policy_grid.jsonl")),
    train_heldout_recovery_selections_jsonl: rel(path.join(outputDir, "train_heldout_recovery_selections.jsonl")),
    validation_recovery_selections_jsonl: rel(path.join(outputDir, "validation_recovery_selections.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_policy: result.selected_policy,
  metrics: result.metrics,
  aggressive_recovery_probe: result.aggressive_recovery_probe,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
}, null, 2));

function buildGrid() {
  const rows = [];
  for (const min_answer_probability of [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5]) {
    for (const max_probability_gap of [-0.2, -0.1, 0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5]) {
      rows.push({ min_answer_probability, max_probability_gap });
    }
  }
  return rows;
}

function applyPolicy(rows, params) {
  return rows.map((row) => {
    const selected = row.candidates.find((candidate) => candidate.system_id === row.selected_system_id) ?? row.candidates[0];
    const answerCandidate = [...row.candidates]
      .filter((candidate) => candidate.prediction_answer_type === "grounded_answer")
      .sort((left, right) => right.predicted_probability - left.predicted_probability)[0];
    let final = selected;
    let switched = false;
    if (selected?.prediction_answer_type === "abstain" && answerCandidate) {
      const gap = Number(selected.predicted_probability) - Number(answerCandidate.predicted_probability);
      if (Number(answerCandidate.predicted_probability) >= params.min_answer_probability && gap <= params.max_probability_gap) {
        final = answerCandidate;
        switched = final.system_id !== selected.system_id;
      }
    }
    return {
      example_id: row.example_id,
      target_answer_type: row.target_answer_type,
      source_selected_system_id: selected?.system_id,
      final_selected_system_id: final?.system_id,
      final_prediction_answer_type: final?.prediction_answer_type,
      switched,
      selected_probability: selected?.predicted_probability,
      final_probability: final?.predicted_probability,
      answer_candidate_probability: answerCandidate?.predicted_probability ?? null,
      source_contract_correct: Boolean(selected?.contract_correct),
      final_contract_correct: Boolean(final?.contract_correct),
      source_answer_type_correct: Boolean(selected?.answer_type_correct),
      final_answer_type_correct: Boolean(final?.answer_type_correct),
      source_citation_set_exact: Boolean(selected?.citation_set_exact),
      final_citation_set_exact: Boolean(final?.citation_set_exact),
    };
  });
}

function evaluateRows(rows, params) {
  return summarizePolicyRows(applyPolicy(rows, params));
}

function summarizePolicyRows(rows) {
  const correct = rows.filter((row) => row.final_contract_correct).length;
  const answerType = rows.filter((row) => row.final_answer_type_correct).length;
  const citation = rows.filter((row) => row.final_citation_set_exact).length;
  const grounded = rows.filter((row) => row.target_answer_type === "grounded_answer");
  const abstain = rows.filter((row) => row.target_answer_type === "abstain");
  return {
    examples: rows.length,
    contract_correct: correct,
    contract_correct_rate: rate(correct, rows.length),
    answer_type_correct: answerType,
    answer_type_accuracy: rate(answerType, rows.length),
    citation_set_exact: citation,
    citation_set_exact_rate: rate(citation, rows.length),
    switched: rows.filter((row) => row.switched).length,
    grounded_target_correct: grounded.filter((row) => row.final_contract_correct).length,
    grounded_target_correct_rate: rate(grounded.filter((row) => row.final_contract_correct).length, grounded.length),
    abstain_target_correct: abstain.filter((row) => row.final_contract_correct).length,
    abstain_target_correct_rate: rate(abstain.filter((row) => row.final_contract_correct).length, abstain.length),
  };
}

function compareCandidates(left, right) {
  let delta = Number(right.train_heldout.contract_correct) - Number(left.train_heldout.contract_correct);
  if (delta !== 0) return delta;
  delta = Number(right.train_heldout.grounded_target_correct) - Number(left.train_heldout.grounded_target_correct);
  if (delta !== 0) return delta;
  return Number(left.train_heldout.switched) - Number(right.train_heldout.switched);
}

function statusFor(params, validationMetrics) {
  if (validationMetrics.switched === 0) return "answer_recovery_overlay_rejected_no_switch_selected";
  if (validationMetrics.contract_correct > 47) return "answer_recovery_overlay_improves_router";
  return "answer_recovery_overlay_hurts_or_ties_router";
}

function nextStepFor(params, validationMetrics) {
  if (validationMetrics.switched === 0) {
    return "Do not add a recovery overlay. Improve grounded-answer candidate construction or train richer target-completeness supervision instead.";
  }
  if (validationMetrics.contract_correct > 47) {
    return "Treat recovery as a candidate for a fresh heldout test before any paid judging.";
  }
  return "Reject recovery overlay and focus on stronger grounded-answer supervision.";
}

function renderReport(result) {
  return `# Router Answer Recovery Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Selected Policy

- Minimum answer probability: ${result.selected_policy.min_answer_probability}
- Maximum selected-minus-answer probability gap: ${result.selected_policy.max_probability_gap}

## Metrics

| Split | Contract Correct | Grounded Correct | Abstain Correct | Switched |
| --- | ---: | ---: | ---: | ---: |
| Train heldout | ${result.metrics.train_heldout.contract_correct}/${result.metrics.train_heldout.examples} (${pct(result.metrics.train_heldout.contract_correct_rate)}) | ${pct(result.metrics.train_heldout.grounded_target_correct_rate)} | ${pct(result.metrics.train_heldout.abstain_target_correct_rate)} | ${result.metrics.train_heldout.switched} |
| Repaired validation | ${result.metrics.repaired_validation_gate.contract_correct}/${result.metrics.repaired_validation_gate.examples} (${pct(result.metrics.repaired_validation_gate.contract_correct_rate)}) | ${pct(result.metrics.repaired_validation_gate.grounded_target_correct_rate)} | ${pct(result.metrics.repaired_validation_gate.abstain_target_correct_rate)} | ${result.metrics.repaired_validation_gate.switched} |

## Baseline Comparison

- Source router: ${result.baseline_comparison.source_validation_contract_correct}/70
- Recovery overlay: ${result.baseline_comparison.recovered_validation_contract_correct}/70
- Delta vs source router: ${result.baseline_comparison.delta_vs_source_router}
- Delta vs train-calibrated scaffold: ${result.baseline_comparison.delta_vs_train_calibrated_scaffold}

## Decision

- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Promote recovery overlay: ${result.decision.promote_recovery_overlay ? "yes" : "no"}
- Next step: ${result.decision.next_step}
`;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
