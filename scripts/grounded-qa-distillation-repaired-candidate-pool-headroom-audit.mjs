import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "repaired-candidate-pool-headroom-audit-frontier-validation-v1";
const validationGateRunId = args["validation-gate-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);

const sourceRuns = {
  train_calibrated_scaffold: "frontier-repaired-train-calibrated-scaffold-smoke-2026-06-29-v1",
  constrained_qwen_hybrid: "repaired-qwen3b-constrained-hybrid-audit-frontier-validation-v1",
  repaired_qwen3b: "evidence-first-contract-repair-audit-frontier-repaired-qwen3b-validation-smoke-v1",
  train_selected_constrained_policy: "train-selected-constrained-policy-audit-frontier-repaired-v1",
  learned_repaired_selector: "learned-repaired-selector-audit-frontier-repaired-v1",
};

const sourceFiles = {
  train_calibrated_scaffold: path.join(runsDir, sourceRuns.train_calibrated_scaffold, "predictions.jsonl"),
  constrained_qwen_hybrid: path.join(runsDir, sourceRuns.constrained_qwen_hybrid, "selected_predictions.jsonl"),
  repaired_qwen3b: path.join(runsDir, sourceRuns.repaired_qwen3b, "repaired_predictions.jsonl"),
  train_selected_constrained_policy: path.join(runsDir, sourceRuns.train_selected_constrained_policy, "validation_predictions.jsonl"),
  learned_repaired_selector: path.join(runsDir, sourceRuns.learned_repaired_selector, "validation_predictions.jsonl"),
};

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const targets = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const targetById = new Map(targets.map((row) => [row.example_id, row.target]));
const predictionsBySystem = {};
for (const [systemId, file] of Object.entries(sourceFiles)) {
  predictionsBySystem[systemId] = new Map((await readJsonl(file)).map((row) => [row.example_id, row.prediction]));
}

const systems = Object.keys(sourceFiles);
const rows = targets.map((targetRow) => {
  const target = targetRow.target;
  const scored = systems.map((systemId) => {
    const prediction = predictionsBySystem[systemId].get(targetRow.example_id);
    return {
      system_id: systemId,
      prediction_answer_type: prediction?.answer_type ?? "missing",
      prediction_citations: normalizeCitations(prediction?.citations),
      ...scorePrediction(prediction, target),
    };
  });
  const correctSystems = scored.filter((row) => row.contract_correct).map((row) => row.system_id);
  const answerTypeCorrectSystems = scored.filter((row) => row.answer_type_correct).map((row) => row.system_id);
  const citationExactSystems = scored.filter((row) => row.citation_set_exact).map((row) => row.system_id);
  return {
    example_id: targetRow.example_id,
    target_answer_type: target.answer_type,
    target_citations: normalizeCitations(target.citations),
    oracle_contract_correct: correctSystems.length > 0,
    correct_systems: correctSystems,
    answer_type_correct_systems: answerTypeCorrectSystems,
    citation_exact_systems: citationExactSystems,
    all_systems_wrong: correctSystems.length === 0,
    scaffold_wrong_but_pool_correct: !scored.find((row) => row.system_id === "train_calibrated_scaffold")?.contract_correct && correctSystems.length > 0,
    scaffold_correct_but_pool_has_errors: scored.find((row) => row.system_id === "train_calibrated_scaffold")?.contract_correct === true && correctSystems.length < systems.length,
    scores: scored,
  };
});

const systemMetrics = systems.map((systemId) => {
  const scored = rows.map((row) => row.scores.find((score) => score.system_id === systemId));
  return summarizeScores(systemId, scored);
});
const scaffoldMetric = systemMetrics.find((row) => row.system_id === "train_calibrated_scaffold");
const bestSingle = [...systemMetrics].sort((left, right) => right.contract_correct - left.contract_correct || left.system_id.localeCompare(right.system_id))[0];
const oracleCorrect = rows.filter((row) => row.oracle_contract_correct).length;
const allWrong = rows.filter((row) => row.all_systems_wrong);
const scaffoldWrongPoolCorrect = rows.filter((row) => row.scaffold_wrong_but_pool_correct);
const scaffoldCorrectPoolErrors = rows.filter((row) => row.scaffold_correct_but_pool_has_errors);
const targetBreakdown = summarizeTargetBreakdown(rows);

await writeJsonl(path.join(outputDir, "pool_oracle_rows.jsonl"), rows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "repaired_candidate_pool_headroom_audit",
  status: statusFor({ oracleCorrect, bestSingle, scaffoldMetric }),
  purpose: "Measure diagnostic oracle headroom and error overlap across existing repaired-validation candidates before spending on another selector, judge, or GPU run.",
  source_runs: sourceRuns,
  validation_gate_run_id: validationGateRunId,
  leakage_note: "This is a diagnostic headroom audit over the repaired validation gate. It must not be used as a selected validation policy or final score.",
  systems: systemMetrics,
  oracle: {
    examples: rows.length,
    oracle_contract_correct: oracleCorrect,
    oracle_contract_correct_rate: rate(oracleCorrect, rows.length),
    all_systems_wrong: allWrong.length,
    all_systems_wrong_rate: rate(allWrong.length, rows.length),
    delta_vs_train_calibrated_scaffold: oracleCorrect - scaffoldMetric.contract_correct,
    delta_vs_best_single_system: oracleCorrect - bestSingle.contract_correct,
    scaffold_wrong_but_pool_correct: scaffoldWrongPoolCorrect.length,
    scaffold_correct_but_pool_has_errors: scaffoldCorrectPoolErrors.length,
  },
  target_breakdown: targetBreakdown,
  failure_overlap: {
    all_systems_wrong_example_ids: allWrong.map((row) => row.example_id),
    scaffold_wrong_pool_correct_example_ids: scaffoldWrongPoolCorrect.map((row) => row.example_id),
    scaffold_correct_pool_errors_example_ids: scaffoldCorrectPoolErrors.map((row) => row.example_id),
  },
  decision: {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    promote_oracle_as_result: false,
    next_step: nextStepFor({ oracleCorrect, bestSingle, scaffoldMetric, allWrong }),
    reason: "The oracle uses validation labels and existing validation-side Qwen artifacts, so it can guide diagnosis but cannot be promoted. It determines whether the bottleneck is candidate selection or candidate construction.",
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
    note: "This audit reuses existing predictions and diagnostic targets only.",
  },
  artifacts: {
    pool_oracle_rows_jsonl: rel(path.join(outputDir, "pool_oracle_rows.jsonl")),
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
  systems: result.systems,
  oracle: result.oracle,
  target_breakdown: result.target_breakdown,
  decision: result.decision,
}, null, 2));

function scorePrediction(prediction, target) {
  const answerTypeCorrect = prediction?.answer_type === target?.answer_type;
  const citationSetExact = prediction?.answer_type === "abstain"
    ? normalizeCitations(prediction?.citations).length === 0
    : sameCitationSet(prediction?.citations, target?.citations ?? []);
  return {
    target_answer_type: target?.answer_type,
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    contract_correct: Boolean(answerTypeCorrect && citationSetExact),
  };
}

function summarizeScores(systemId, scored) {
  const answered = scored.filter((row) => row.prediction_answer_type === "grounded_answer").length;
  const answerTypeCorrect = scored.filter((row) => row.answer_type_correct).length;
  const citationExact = scored.filter((row) => row.citation_set_exact).length;
  const contractCorrect = scored.filter((row) => row.contract_correct).length;
  return {
    system_id: systemId,
    examples: scored.length,
    answered,
    abstained: scored.length - answered,
    answer_rate: rate(answered, scored.length),
    answer_type_correct: answerTypeCorrect,
    answer_type_accuracy: rate(answerTypeCorrect, scored.length),
    citation_set_exact: citationExact,
    citation_set_exact_rate: rate(citationExact, scored.length),
    contract_correct: contractCorrect,
    contract_correct_rate: rate(contractCorrect, scored.length),
    confusion: countBy(scored.map((row) => `${row.prediction_answer_type}_vs_${row.target_answer_type}`)),
  };
}

function summarizeTargetBreakdown(rows) {
  const breakdown = {};
  for (const targetType of ["grounded_answer", "abstain"]) {
    const subset = rows.filter((row) => row.target_answer_type === targetType);
    breakdown[targetType] = {
      examples: subset.length,
      oracle_contract_correct: subset.filter((row) => row.oracle_contract_correct).length,
      all_systems_wrong: subset.filter((row) => row.all_systems_wrong).length,
      scaffold_wrong_but_pool_correct: subset.filter((row) => row.scaffold_wrong_but_pool_correct).length,
    };
  }
  return breakdown;
}

function statusFor({ oracleCorrect, bestSingle, scaffoldMetric }) {
  if (oracleCorrect >= bestSingle.contract_correct + 8) return "candidate_pool_has_selector_headroom";
  if (oracleCorrect > scaffoldMetric.contract_correct) return "candidate_pool_has_limited_headroom";
  return "candidate_pool_lacks_headroom";
}

function nextStepFor({ oracleCorrect, bestSingle, allWrong }) {
  if (oracleCorrect >= bestSingle.contract_correct + 8) {
    return "Build a selector/verifier around candidate routing before more candidate generation.";
  }
  if (allWrong.length >= 20) {
    return "Improve candidate construction and evidence packaging; the existing pool does not contain enough correct answers.";
  }
  return "Use failure overlap to decide between a stronger selector and new candidate construction before any paid run.";
}

function sameCitationSet(left, right) {
  const leftSet = new Set(normalizeCitations(left));
  const rightSet = new Set(normalizeCitations(right));
  if (leftSet.size !== rightSet.size) return false;
  for (const value of leftSet) if (!rightSet.has(value)) return false;
  return true;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation)).filter(Boolean);
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function renderReport(result) {
  return `# Repaired Candidate Pool Headroom Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This is a diagnostic oracle audit over the repaired validation gate, not a deployable selected policy.

## Systems

| System | Answered | Contract Correct | Answer Type | Citation Exact |
| --- | ---: | ---: | ---: | ---: |
${result.systems.map((row) => `| ${row.system_id} | ${row.answered}/${row.examples} | ${row.contract_correct}/${row.examples} (${pct(row.contract_correct_rate)}) | ${pct(row.answer_type_accuracy)} | ${pct(row.citation_set_exact_rate)} |`).join("\n")}

## Oracle Headroom

- Pool oracle: ${result.oracle.oracle_contract_correct}/${result.oracle.examples} (${pct(result.oracle.oracle_contract_correct_rate)})
- All systems wrong: ${result.oracle.all_systems_wrong}/${result.oracle.examples} (${pct(result.oracle.all_systems_wrong_rate)})
- Delta vs train-calibrated scaffold: ${result.oracle.delta_vs_train_calibrated_scaffold}
- Delta vs best single system: ${result.oracle.delta_vs_best_single_system}
- Scaffold wrong but pool correct: ${result.oracle.scaffold_wrong_but_pool_correct}
- Scaffold correct but some pool candidates wrong: ${result.oracle.scaffold_correct_but_pool_has_errors}

## Decision

- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Promote oracle as result: ${result.decision.promote_oracle_as_result ? "yes" : "no"}
- Next step: ${result.decision.next_step}
`;
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
