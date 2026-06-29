import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "numeric-teacher-candidate-packet-frontier-repaired-length-reduced-v1";
const scaffoldRunId = args["scaffold-run-id"] ?? "numeric-teacher-train-calibrated-scaffold-diagnostic-v1";
const qwenNormRunId = args["qwen-normalization-run-id"] ?? "targeted-grounded-schema-normalization-audit-numeric-teacher-qwen3b-smoke-v1";
const baselineNormRunId = args["baseline-normalization-run-id"] ?? "targeted-grounded-schema-normalization-audit-dpo-prompt-repaired-qwen3b-smoke-v1";
const runId = args["run-id"] ?? "numeric-constrained-scaffold-audit-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const targets = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const scaffold = await readJson(path.join(runsDir, scaffoldRunId, "result.json"));
const scaffoldGate = await readJson(path.join(runsDir, `${scaffoldRunId}-contract-gate`, "result.json"));
const scaffoldScored = await readJsonl(path.join(runsDir, `${scaffoldRunId}-contract-gate`, "scored_predictions.jsonl"));
const qwenNorm = await readJson(path.join(runsDir, qwenNormRunId, "result.json"));
const baselineNorm = await readJson(path.join(runsDir, baselineNormRunId, "result.json"));

const abstentionPrior = scoreAbstentionPrior(targets);
const rows = scaffoldScored.map((row) => ({
  example_id: row.example_id,
  target_answer_type: row.target_answer_type,
  scaffold_answer_type: row.prediction_answer_type,
  scaffold_contract_correct: row.contract_correct,
  scaffold_answer_type_correct: row.answer_type_correct,
  scaffold_citation_set_exact: row.citation_set_exact,
  scaffold_evidence_first_valid: row.evidence_first_valid,
  tags: tagsFor(row),
}));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "numeric_constrained_scaffold_audit",
  status: statusFor({ scaffoldGate, abstentionPrior, qwenNorm, baselineNorm }),
  purpose: "Evaluate whether a zero-call constrained scaffold is a better next path than more Qwen 3B SFT/DPO for the numeric-teacher diagnostic surface.",
  source_runs: {
    packet: packetRunId,
    scaffold: scaffoldRunId,
    scaffold_contract_gate: `${scaffoldRunId}-contract-gate`,
    qwen_normalization: qwenNormRunId,
    dpo_prompt_repaired_baseline_normalization: baselineNormRunId,
  },
  target_distribution: summarizeTargets(targets),
  metrics: {
    abstention_prior_contract_correct_count: abstentionPrior.correct,
    abstention_prior_contract_correct_rate: abstentionPrior.rate,
    constrained_scaffold_contract_correct_count: Math.round(scaffoldGate.metrics.overall_contract_correct_rate * scaffoldGate.metrics.examples),
    constrained_scaffold_contract_correct_rate: scaffoldGate.metrics.overall_contract_correct_rate,
    constrained_scaffold_answer_type_accuracy: scaffoldGate.metrics.answer_type_accuracy,
    constrained_scaffold_citation_set_exact_rate: scaffoldGate.metrics.citation_set_exact_rate,
    qwen_normalized_contract_correct_count: qwenNorm.metrics.normalized_contract_correct_count,
    qwen_normalized_contract_correct_rate: qwenNorm.metrics.normalized_overall_contract_correct,
    dpo_prompt_repaired_normalized_contract_correct_count: baselineNorm.metrics.normalized_contract_correct_count,
    dpo_prompt_repaired_normalized_contract_correct_rate: baselineNorm.metrics.normalized_overall_contract_correct,
  },
  deltas: {
    scaffold_minus_qwen_normalized: Math.round(scaffoldGate.metrics.overall_contract_correct_rate * scaffoldGate.metrics.examples) - Number(qwenNorm.metrics.normalized_contract_correct_count),
    scaffold_minus_dpo_prompt_repaired_baseline: Math.round(scaffoldGate.metrics.overall_contract_correct_rate * scaffoldGate.metrics.examples) - Number(baselineNorm.metrics.normalized_contract_correct_count),
    scaffold_minus_abstention_prior: Math.round(scaffoldGate.metrics.overall_contract_correct_rate * scaffoldGate.metrics.examples) - abstentionPrior.correct,
  },
  calibration: scaffold.calibration,
  row_tag_counts: countTags(rows.flatMap((row) => row.tags)),
  decision: decisionFor({ scaffoldGate, abstentionPrior, qwenNorm, baselineNorm }),
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
    note: "This audit reads existing deterministic scaffold and contract-gate artifacts only.",
  },
  artifacts: {
    rows_jsonl: rel(path.join(outputDir, "rows.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
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
  deltas: result.deltas,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function scoreAbstentionPrior(targets) {
  const correct = targets.filter((row) => row.target?.answer_type === "abstain").length;
  return { correct, rate: targets.length ? correct / targets.length : 0 };
}

function summarizeTargets(targets) {
  return {
    examples: targets.length,
    grounded_answer: targets.filter((row) => row.target?.answer_type === "grounded_answer").length,
    abstain: targets.filter((row) => row.target?.answer_type === "abstain").length,
  };
}

function tagsFor(row) {
  const tags = [];
  if (row.target_answer_type === "abstain" && row.prediction_answer_type === "grounded_answer") tags.push("over_answered_insufficient_evidence");
  if (row.target_answer_type === "grounded_answer" && row.prediction_answer_type === "abstain") tags.push("false_abstention");
  if (!row.citation_set_exact) tags.push("citation_set_mismatch");
  if (!row.evidence_first_valid) tags.push("evidence_first_invalid");
  if (row.contract_correct) tags.push("contract_correct");
  return tags;
}

function statusFor({ scaffoldGate, abstentionPrior, qwenNorm, baselineNorm }) {
  const scaffoldCorrect = Math.round(scaffoldGate.metrics.overall_contract_correct_rate * scaffoldGate.metrics.examples);
  if (scaffoldCorrect <= Number(qwenNorm.metrics.normalized_contract_correct_count)) return "constrained_scaffold_not_better_than_qwen";
  if (scaffoldCorrect < Number(baselineNorm.metrics.normalized_contract_correct_count)) return "constrained_scaffold_improves_qwen_but_loses_baseline";
  if (scaffoldCorrect < abstentionPrior.correct) return "constrained_scaffold_beats_baseline_but_loses_abstention_prior";
  return "constrained_scaffold_candidate_for_next_surface";
}

function decisionFor({ scaffoldGate, abstentionPrior, qwenNorm, baselineNorm }) {
  const scaffoldCorrect = Math.round(scaffoldGate.metrics.overall_contract_correct_rate * scaffoldGate.metrics.examples);
  const qwenCorrect = Number(qwenNorm.metrics.normalized_contract_correct_count);
  const baselineCorrect = Number(baselineNorm.metrics.normalized_contract_correct_count);
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    use_constrained_scaffold_as_next_gpu_target: false,
    keep_as_zero_cost_baseline: true,
    next_step: "Use this constrained scaffold only as a floor. A next candidate must beat both the DPO-prompt-repaired diagnostic baseline and the abstention prior on this skewed surface before any Prime or OpenAI spend.",
    reason: `The constrained scaffold improves over normalized Qwen (${scaffoldCorrect} vs ${qwenCorrect}) but loses to the DPO-prompt-repaired baseline (${baselineCorrect}) and to the abstention prior (${abstentionPrior.correct}).`,
  };
}

function renderReport(result) {
  return `# Numeric Constrained Scaffold Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls and launches no compute.

## Metrics

| Surface | Contract correct | Rate |
| --- | ---: | ---: |
| Abstention prior | ${result.metrics.abstention_prior_contract_correct_count} / ${result.target_distribution.examples} | ${pct(result.metrics.abstention_prior_contract_correct_rate)} |
| Constrained scaffold | ${result.metrics.constrained_scaffold_contract_correct_count} / ${result.target_distribution.examples} | ${pct(result.metrics.constrained_scaffold_contract_correct_rate)} |
| Normalized Qwen 3B numeric teacher | ${result.metrics.qwen_normalized_contract_correct_count} / ${result.target_distribution.examples} | ${pct(result.metrics.qwen_normalized_contract_correct_rate)} |
| DPO-prompt-repaired baseline | ${result.metrics.dpo_prompt_repaired_normalized_contract_correct_count} / ${result.target_distribution.examples} | ${pct(result.metrics.dpo_prompt_repaired_normalized_contract_correct_rate)} |

## Deltas

| Comparison | Rows |
| --- | ---: |
| Scaffold - normalized Qwen | ${signed(result.deltas.scaffold_minus_qwen_normalized)} |
| Scaffold - DPO baseline | ${signed(result.deltas.scaffold_minus_dpo_prompt_repaired_baseline)} |
| Scaffold - abstention prior | ${signed(result.deltas.scaffold_minus_abstention_prior)} |

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Use constrained scaffold as next GPU target: ${result.decision.use_constrained_scaffold_as_next_gpu_target ? "yes" : "no"}
- Keep as zero-cost baseline: ${result.decision.keep_as_zero_cost_baseline ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function countTags(tags) {
  const counts = {};
  for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return counts;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function signed(value) {
  const number = Number(value ?? 0);
  return number > 0 ? `+${number}` : String(number);
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
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
