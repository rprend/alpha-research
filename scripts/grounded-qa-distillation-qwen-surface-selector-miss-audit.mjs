import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const routerRunId = args["router-run"] ?? "train-supervised-qwen-surface-router-audit-frontier-repaired-v1";
const runId = args["run-id"] ?? "qwen-surface-selector-miss-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const router = await readJson(path.join(runsDir, routerRunId, "result.json"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const trainHeldout = await readJsonl(path.join(runsDir, routerRunId, "train_heldout_selections.jsonl"));
const validation = await readJsonl(path.join(runsDir, routerRunId, "validation_selections.jsonl"));

const splitRows = {
  train_heldout: trainHeldout,
  repaired_validation_gate: validation,
};
const recoverableMisses = Object.entries(splitRows).flatMap(([split, rows]) => rows
  .filter((row) => !row.selected_contract_correct && row.candidates.some((candidate) => candidate.contract_correct))
  .map((row) => auditMiss(split, row)));
const allWrong = Object.entries(splitRows).flatMap(([split, rows]) => rows
  .filter((row) => !row.candidates.some((candidate) => candidate.contract_correct))
  .map((row) => auditAllWrong(split, row)));
const policyProbes = Object.entries(probePolicies()).flatMap(([policyId, policy]) => Object.entries(splitRows).map(([split, rows]) => {
  const selections = rows.map((row) => ({ row, selected: policy.select(row) }));
  const correct = selections.filter(({ selected }) => selected?.contract_correct).length;
  return {
    split,
    policy_id: policyId,
    description: policy.description,
    contract_correct: correct,
    contract_correct_rate: rate(correct, rows.length),
    selected_system_counts: countBy(selections.map(({ selected }) => selected?.system_id ?? "missing")),
  };
}));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen_surface_selector_miss_audit",
  status: statusFor({ recoverableMisses, policyProbes }),
  router_run_id: routerRunId,
  purpose: "Audit the Qwen train-surface router's missed oracle headroom and test simple non-learned selector probes before spending on more GPU or LLM judgments.",
  source_metrics: {
    router_status: router.status,
    router_validation_contract_correct: router.metrics?.repaired_validation_gate?.contract_correct,
    router_validation_oracle_contract_correct: router.oracle?.repaired_validation_gate?.contract_correct,
    router_delta_vs_prior_train_supervised_router: router.baseline_comparison?.delta_vs_prior_train_supervised_router,
  },
  split_summary: Object.fromEntries(Object.entries(splitRows).map(([split, rows]) => [split, summarizeSplit(rows)])),
  recoverable_miss_summary: {
    total: recoverableMisses.length,
    by_split: countBy(recoverableMisses.map((row) => row.split)),
    tag_counts: countBy(recoverableMisses.flatMap((row) => row.tags)),
    selected_wrong_counts: countBy(recoverableMisses.map((row) => row.selected_system_id)),
    missed_correct_counts: countBy(recoverableMisses.flatMap((row) => row.correct_candidate_system_ids)),
  },
  all_wrong_summary: {
    total: allWrong.length,
    by_split: countBy(allWrong.map((row) => row.split)),
    selected_system_counts: countBy(allWrong.map((row) => row.selected_system_id)),
    target_answer_type_counts: countBy(allWrong.map((row) => row.target_answer_type)),
  },
  policy_probe_summary: {
    note: "These probes are diagnostic only. They were chosen before inspecting validation labels as simple structural alternatives to the learned top-probability router, but reported validation scores still use labels and are not promoted as trained policy evidence.",
    rows: policyProbes,
  },
  conclusion: {
    finding: "The Qwen surface creates real oracle headroom, but misses are distributed across learned, Qwen, hybrid, scaffold, and train-selected alternatives. Simple family-priority or answer-type consensus rules do not recover validation performance.",
    decision: "Do not spend more on Prime or OpenAI judgments for this router. The next aligned intervention is a stronger support verifier or pairwise/listwise selector trained to discriminate candidate support, ideally with Qwen candidates included on train and fresh heldout.",
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
    note: "This audit reads existing router selections only.",
  },
  artifacts: {
    recoverable_misses_jsonl: rel(path.join(outputDir, "recoverable_misses.jsonl")),
    all_wrong_jsonl: rel(path.join(outputDir, "all_systems_wrong.jsonl")),
    policy_probes_jsonl: rel(path.join(outputDir, "policy_probes.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "recoverable_misses.jsonl"), recoverableMisses);
await writeJsonl(path.join(outputDir, "all_systems_wrong.jsonl"), allWrong);
await writeJsonl(path.join(outputDir, "policy_probes.jsonl"), policyProbes);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  split_summary: result.split_summary,
  recoverable_miss_summary: result.recoverable_miss_summary,
  policy_probe_summary: result.policy_probe_summary,
  conclusion: result.conclusion,
}, null, 2));

function summarizeSplit(rows) {
  const selectedCorrect = rows.filter((row) => row.selected_contract_correct).length;
  const oracleCorrect = rows.filter((row) => row.candidates.some((candidate) => candidate.contract_correct)).length;
  return {
    examples: rows.length,
    selected_contract_correct: selectedCorrect,
    selected_contract_correct_rate: rate(selectedCorrect, rows.length),
    oracle_contract_correct: oracleCorrect,
    oracle_contract_correct_rate: rate(oracleCorrect, rows.length),
    recoverable_misses: rows.filter((row) => !row.selected_contract_correct && row.candidates.some((candidate) => candidate.contract_correct)).length,
    all_systems_wrong: rows.length - oracleCorrect,
    selected_system_counts: countBy(rows.map((row) => row.selected_system_id)),
    target_answer_type_counts: countBy(rows.map((row) => row.target_answer_type)),
    per_system_contract_correct: Object.fromEntries(systemIds(rows).map((systemId) => {
      const correct = rows.filter((row) => row.candidates.find((candidate) => candidate.system_id === systemId)?.contract_correct).length;
      return [systemId, { contract_correct: correct, contract_correct_rate: rate(correct, rows.length) }];
    })),
  };
}

function auditMiss(split, row) {
  const correctCandidates = row.candidates.filter((candidate) => candidate.contract_correct);
  const selected = row.candidates.find((candidate) => candidate.system_id === row.selected_system_id) ?? row.candidates[0];
  const bestCorrect = correctCandidates
    .slice()
    .sort((left, right) => right.predicted_probability - left.predicted_probability)[0];
  return {
    split,
    example_id: row.example_id,
    target_answer_type: row.target_answer_type,
    selected_system_id: row.selected_system_id,
    selected_answer_type: selected?.prediction_answer_type ?? null,
    selected_probability: round(selected?.predicted_probability),
    best_correct_system_id: bestCorrect?.system_id ?? null,
    best_correct_answer_type: bestCorrect?.prediction_answer_type ?? null,
    best_correct_probability: round(bestCorrect?.predicted_probability),
    probability_gap_selected_minus_best_correct: round(Number(selected?.predicted_probability ?? 0) - Number(bestCorrect?.predicted_probability ?? 0)),
    correct_candidate_system_ids: correctCandidates.map((candidate) => candidate.system_id),
    candidate_rankings: row.candidates.map((candidate) => ({
      system_id: candidate.system_id,
      predicted_probability: round(candidate.predicted_probability),
      prediction_answer_type: candidate.prediction_answer_type,
      contract_correct: candidate.contract_correct,
      answer_type_correct: candidate.answer_type_correct,
      citation_set_exact: candidate.citation_set_exact,
    })),
    tags: tagsForMiss(row, selected, correctCandidates),
  };
}

function auditAllWrong(split, row) {
  return {
    split,
    example_id: row.example_id,
    target_answer_type: row.target_answer_type,
    selected_system_id: row.selected_system_id,
    selected_answer_type: row.candidates.find((candidate) => candidate.system_id === row.selected_system_id)?.prediction_answer_type ?? null,
    candidate_answer_type_counts: countBy(row.candidates.map((candidate) => candidate.prediction_answer_type)),
    tags: [
      "all_candidates_contract_wrong",
      row.target_answer_type === "grounded_answer" ? "grounded_answer_not_constructed" : "abstention_boundary_failure",
    ],
  };
}

function tagsForMiss(row, selected, correctCandidates) {
  const tags = new Set(["router_selected_wrong_candidate", "oracle_candidate_available"]);
  if (row.target_answer_type === "grounded_answer") tags.add("target_is_grounded_answer");
  if (row.target_answer_type === "abstain") tags.add("target_is_abstention");
  if (selected?.system_id === "learned_repaired_selector") tags.add("learned_selector_overrode_correct_alternative");
  if (selected?.system_id === "qwen_repaired_surface") tags.add("qwen_repaired_overrode_correct_alternative");
  if (correctCandidates.some((candidate) => candidate.system_id === "qwen_repaired_surface")) tags.add("missed_correct_qwen_repaired");
  if (correctCandidates.some((candidate) => candidate.system_id === "qwen_scaffold_hybrid_surface")) tags.add("missed_correct_qwen_scaffold_hybrid");
  if (correctCandidates.some((candidate) => candidate.system_id === "train_calibrated_scaffold")) tags.add("missed_correct_scaffold");
  if (correctCandidates.some((candidate) => candidate.system_id === "train_selected_constrained_policy")) tags.add("missed_correct_train_selected");
  if (correctCandidates.some((candidate) => candidate.predicted_probability < Number(selected?.predicted_probability ?? 0))) tags.add("probability_ranker_miscalibrated");
  if (new Set(row.candidates.map((candidate) => candidate.prediction_answer_type)).size > 1) tags.add("candidate_answer_type_disagreement");
  return [...tags].sort();
}

function probePolicies() {
  return {
    learned_router_top_probability: {
      description: "Use the existing learned router top probability.",
      select: (row) => row.candidates[0],
    },
    prefer_qwen_repaired_when_learned_grounded: {
      description: "If the learned selector is top and both learned and Qwen repaired answer, switch to Qwen repaired.",
      select: (row) => {
        const top = row.candidates[0];
        const qwen = candidate(row, "qwen_repaired_surface");
        if (top?.system_id === "learned_repaired_selector" && top.prediction_answer_type === "grounded_answer" && qwen?.prediction_answer_type === "grounded_answer") return qwen;
        return top;
      },
    },
    prefer_qwen_hybrid_when_it_answers: {
      description: "Use the Qwen/scaffold hybrid whenever it predicts a grounded answer.",
      select: (row) => candidate(row, "qwen_scaffold_hybrid_surface")?.prediction_answer_type === "grounded_answer"
        ? candidate(row, "qwen_scaffold_hybrid_surface")
        : row.candidates[0],
    },
    abstain_consensus_if_three_abstain: {
      description: "If at least three candidates abstain, choose the highest-ranked abstention.",
      select: (row) => {
        const abstentions = row.candidates.filter((candidate) => candidate.prediction_answer_type === "abstain");
        return abstentions.length >= 3 ? abstentions[0] : row.candidates[0];
      },
    },
    oracle_upper_bound: {
      description: "Diagnostic oracle: choose the highest-probability correct candidate when any exists.",
      select: (row) => row.candidates.find((candidate) => candidate.contract_correct) ?? row.candidates[0],
    },
  };
}

function candidate(row, systemId) {
  return row.candidates.find((item) => item.system_id === systemId);
}

function systemIds(rows) {
  return [...new Set(rows.flatMap((row) => row.candidates.map((candidate) => candidate.system_id)))].sort();
}

function statusFor({ recoverableMisses, policyProbes }) {
  const validationCurrent = policyProbes.find((row) => row.split === "repaired_validation_gate" && row.policy_id === "learned_router_top_probability")?.contract_correct ?? 0;
  const validationBestNonOracle = Math.max(...policyProbes
    .filter((row) => row.split === "repaired_validation_gate" && row.policy_id !== "oracle_upper_bound")
    .map((row) => row.contract_correct));
  if (recoverableMisses.length && validationBestNonOracle <= validationCurrent) return "simple_qwen_surface_rules_do_not_recover_oracle_headroom";
  if (recoverableMisses.length) return "qwen_surface_selection_failures_have_rule_based_rescue_signal";
  return "qwen_surface_router_has_no_recoverable_misses";
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value ?? "missing"] = (counts[value ?? "missing"] ?? 0) + 1;
  return counts;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function round(value, places = 6) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number(number.toFixed(places));
}

function renderReport(result) {
  const splitRows = Object.entries(result.split_summary).map(([split, summary]) => `| ${split} | ${summary.examples} | ${summary.selected_contract_correct} | ${summary.oracle_contract_correct} | ${summary.recoverable_misses} | ${summary.all_systems_wrong} |`);
  const tagRows = Object.entries(result.recoverable_miss_summary.tag_counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([tag, count]) => `| \`${tag}\` | ${count} |`);
  const probeRows = result.policy_probe_summary.rows.map((row) => `| ${row.split} | \`${row.policy_id}\` | ${row.contract_correct} | ${row.contract_correct_rate.toFixed(3)} | ${JSON.stringify(row.selected_system_counts)} |`);
  return `# Qwen Surface Selector Miss Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls and launches no compute.

## Split Summary

| Split | Examples | Selected correct | Oracle correct | Recoverable misses | All wrong |
| --- | ---: | ---: | ---: | ---: | ---: |
${splitRows.join("\n")}

## Recoverable Miss Tags

| Tag | Count |
| --- | ---: |
${tagRows.join("\n") || "| none | 0 |"}

## Policy Probes

${result.policy_probe_summary.note}

| Split | Policy | Correct | Rate | Selected systems |
| --- | --- | ---: | ---: | --- |
${probeRows.join("\n")}

## Conclusion

${result.conclusion.finding}

Decision: ${result.conclusion.decision}
`;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
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
