import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const selectorRunId = args["selector-run-id"] ?? "calibrated-hybrid-selector-final-window-v1";
const readinessRunId = args["readiness-run-id"] ?? "current-readiness-audit-2026-06-28-v1";
const runId = args["run-id"] ?? "oracle-gap-decomposition-calibrated-hybrid-final-window-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const selector = await readJson(path.join(runsDir, selectorRunId, "result.json"));
const readiness = await readJson(path.join(runsDir, readinessRunId, "result.json"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const calibratedRows = await readJsonl(path.join(runsDir, selectorRunId, "predictions.jsonl"));
const oracleRows = await readJsonl(path.join(runsDir, selectorRunId, "qwen_switch_oracle_predictions.jsonl"));
const oracleById = new Map(oracleRows.map((row) => [row.example_id, row]));

const rows = calibratedRows.map((calibrated) => analyzeRow(calibrated, oracleById.get(calibrated.example_id))).filter(Boolean);
const gainRows = rows.filter((row) => row.delta.correctness === "oracle_gain");
const lossRows = rows.filter((row) => row.delta.correctness === "oracle_loss");
const flatCandidates = rows.flatMap((row) => row.candidates.map((candidate) => ({ ...candidate, example_id: row.example_id })));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "oracle_gap_decomposition",
  status: deriveStatus(rows, gainRows, lossRows),
  purpose: "Decompose the remaining calibrated-hybrid vs qwen-switch-oracle gap so the next research step is based on current support-preserving headroom, not on a generic GPU assumption.",
  source_runs: {
    selector: selectorRunId,
    readiness: readinessRunId,
  },
  baseline_metrics: {
    scaffold_priority: selector.selection_metrics?.scaffold_priority,
    calibrated_hybrid: selector.selection_metrics?.calibrated_hybrid,
    qwen_switch_oracle: selector.selection_metrics?.qwen_switch_oracle,
  },
  aggregate: {
    examples: rows.length,
    calibrated_correct: rows.filter((row) => row.calibrated.judged_correct).length,
    oracle_correct: rows.filter((row) => row.oracle.judged_correct).length,
    oracle_net_correct_lift: rows.filter((row) => row.oracle.judged_correct).length - rows.filter((row) => row.calibrated.judged_correct).length,
    oracle_gains: gainRows.length,
    oracle_losses: lossRows.length,
    unchanged_correctness: rows.filter((row) => row.delta.correctness === "same").length,
    calibrated_supported_answers: rows.filter((row) => row.calibrated.supported_answer).length,
    oracle_supported_answers: rows.filter((row) => row.oracle.supported_answer).length,
    oracle_supported_answer_lift: rows.filter((row) => row.oracle.supported_answer).length - rows.filter((row) => row.calibrated.supported_answer).length,
    examples_with_any_supported_answer_candidate: rows.filter((row) => row.candidate_landscape.supported_answer_candidates > 0).length,
    examples_with_qwen_supported_answer_candidate: rows.filter((row) => row.candidate_landscape.qwen_supported_answer_candidates > 0).length,
    calibrated_misses_with_supported_candidate: rows.filter((row) => !row.calibrated.judged_correct && row.candidate_landscape.supported_answer_candidates > 0).length,
    calibrated_misses_with_qwen_supported_candidate: rows.filter((row) => !row.calibrated.judged_correct && row.candidate_landscape.qwen_supported_answer_candidates > 0).length,
    heuristic_top_candidate_supported_answer_rate: rate(
      rows.filter((row) => row.local_heuristic.top_candidate?.supported_answer).length,
      rows.length,
    ),
    heuristic_top_candidate_judged_correct_rate: rate(
      rows.filter((row) => row.local_heuristic.top_candidate?.judged_correct).length,
      rows.length,
    ),
    heuristic_top_supported_when_supported_exists_rate: rate(
      rows.filter((row) => row.candidate_landscape.supported_answer_candidates > 0 && row.local_heuristic.top_candidate?.supported_answer).length,
      rows.filter((row) => row.candidate_landscape.supported_answer_candidates > 0).length,
    ),
  },
  gap_buckets: countBy(rows.map((row) => row.gap_bucket)),
  oracle_gain_breakdown: {
    rows: gainRows.length,
    from_abstain_to_supported_answer: gainRows.filter((row) => row.calibrated.answer_type === "abstain" && row.oracle.supported_answer).length,
    from_unsupported_answer_to_supported_answer: gainRows.filter((row) => row.calibrated.answer_type === "grounded_answer" && !row.calibrated.supported_answer && row.oracle.supported_answer).length,
    qwen_selected: gainRows.filter((row) => isQwenFamily(row.oracle.family)).length,
    openai_scaffold_selected: gainRows.filter((row) => row.oracle.family === "openai_mini_scaffold").length,
    mean_oracle_selected_heuristic_rank: mean(gainRows.map((row) => row.oracle_candidate_rank_by_heuristic).filter(Number.isFinite)),
  },
  candidate_pool: {
    candidates_total: flatCandidates.length,
    supported_answer_candidates: flatCandidates.filter((row) => row.supported_answer).length,
    supported_answer_by_family: countBy(flatCandidates.filter((row) => row.supported_answer).map((row) => row.family)),
    unsupported_answer_by_family: countBy(flatCandidates.filter((row) => row.answered && !row.supported_answer).map((row) => row.family)),
    correct_abstention_by_family: countBy(flatCandidates.filter((row) => row.supported_abstention).map((row) => row.family)),
  },
  examples: rows.map((row) => ({
    example_id: row.example_id,
    gap_bucket: row.gap_bucket,
    calibrated_candidate_id: row.calibrated.candidate_id,
    calibrated_family: row.calibrated.family,
    calibrated_answer_type: row.calibrated.answer_type,
    calibrated_judged_correct: row.calibrated.judged_correct,
    oracle_candidate_id: row.oracle.candidate_id,
    oracle_family: row.oracle.family,
    oracle_answer_type: row.oracle.answer_type,
    oracle_judged_correct: row.oracle.judged_correct,
    oracle_candidate_rank_by_heuristic: row.oracle_candidate_rank_by_heuristic,
    supported_answer_candidates: row.candidate_landscape.supported_answer_candidates,
    qwen_supported_answer_candidates: row.candidate_landscape.qwen_supported_answer_candidates,
    heuristic_top_candidate_id: row.local_heuristic.top_candidate?.candidate_id ?? null,
    heuristic_top_supported_answer: row.local_heuristic.top_candidate?.supported_answer ?? null,
    heuristic_top_judged_correct: row.local_heuristic.top_candidate?.judged_correct ?? null,
  })),
  decision: {
    rent_gpu_now: false,
    buy_more_openai_labels_now: false,
    train_selector_now: false,
    keep_calibrated_hybrid_as_answer_rate_baseline: true,
    next_step: "Do not spend on a selector-only GPU run. Build the next zero/low-cost packet around support-preserving candidate generation or repair, and only rent Prime once a generator packet can plausibly add more supported answer candidates beyond the small oracle gap.",
    reason: "The oracle selector headroom over the calibrated hybrid is only three net judged-correct rows on the final window, and existing local heuristic/ranker signals fail to identify supported candidates reliably enough. Selector work alone is unlikely to produce a NeurIPS-grade result.",
  },
  readiness_blockers_preserved: readiness.summary?.blocking_failures ?? [],
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
    note: "This decomposition reads existing selector predictions, inherited judgments, and local budget artifacts only.",
  },
};

await writeJsonl(path.join(outputDir, "gap_rows.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  aggregate: result.aggregate,
  gap_buckets: result.gap_buckets,
  oracle_gain_breakdown: result.oracle_gain_breakdown,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function analyzeRow(calibrated, oracle) {
  if (!oracle) return null;
  const candidates = Object.entries(calibrated.candidate_summary ?? {}).map(([candidateId, candidate]) => ({
    candidate_id: candidateId,
    family: candidate.family ?? "unknown",
    answered: Boolean(candidate.answered),
    supported_answer: Boolean(candidate.supported_answer),
    supported_abstention: Boolean(candidate.supported_abstention),
    judged_correct: Boolean(candidate.judged_correct),
    answer_citation_complete: Boolean(candidate.answer_citation_complete),
    heuristic_score: Number(candidate.heuristic_score ?? -Infinity),
  })).sort((left, right) => right.heuristic_score - left.heuristic_score || left.candidate_id.localeCompare(right.candidate_id));
  const calibratedSelection = selectionSummary(calibrated);
  const oracleSelection = selectionSummary(oracle);
  const oracleRank = candidates.findIndex((candidate) => candidate.candidate_id === oracleSelection.candidate_id);
  const supportedAnswers = candidates.filter((candidate) => candidate.supported_answer);
  const qwenSupportedAnswers = supportedAnswers.filter((candidate) => isQwenFamily(candidate.family));
  const correctness = oracleSelection.judged_correct && !calibratedSelection.judged_correct
    ? "oracle_gain"
    : !oracleSelection.judged_correct && calibratedSelection.judged_correct
      ? "oracle_loss"
      : "same";
  return {
    example_id: calibrated.example_id,
    calibrated: calibratedSelection,
    oracle: oracleSelection,
    delta: { correctness },
    gap_bucket: classifyGap(calibratedSelection, oracleSelection, supportedAnswers, qwenSupportedAnswers, candidates[0]),
    candidate_landscape: {
      candidate_count: candidates.length,
      supported_answer_candidates: supportedAnswers.length,
      qwen_supported_answer_candidates: qwenSupportedAnswers.length,
      supported_abstention_candidates: candidates.filter((candidate) => candidate.supported_abstention).length,
      unsupported_answer_candidates: candidates.filter((candidate) => candidate.answered && !candidate.supported_answer).length,
    },
    local_heuristic: {
      top_candidate: candidates[0] ?? null,
      top_supported_answer_rank: firstRank(candidates, (candidate) => candidate.supported_answer),
      top_qwen_supported_answer_rank: firstRank(candidates, (candidate) => candidate.supported_answer && isQwenFamily(candidate.family)),
    },
    oracle_candidate_rank_by_heuristic: oracleRank >= 0 ? oracleRank + 1 : null,
    candidates,
  };
}

function selectionSummary(row) {
  return {
    candidate_id: row.selected_candidate_id,
    family: row.selected_family,
    answer_type: row.prediction?.answer_type ?? null,
    supported_answer: Boolean(row.selection_scores?.supported_answer),
    supported_abstention: Boolean(row.selection_scores?.supported_abstention),
    judged_correct: Boolean(row.selection_scores?.judged_correct),
    answer_type_correct: Boolean(row.selection_scores?.answer_type_correct),
    heuristic_score: Number(row.selection_scores?.heuristic_score ?? NaN),
  };
}

function classifyGap(calibrated, oracle, supportedAnswers, qwenSupportedAnswers, topCandidate) {
  if (oracle.judged_correct && !calibrated.judged_correct && oracle.supported_answer && calibrated.answer_type === "abstain") {
    return qwenSupportedAnswers.length ? "selector_missed_qwen_answer_over_abstention" : "selector_missed_supported_answer_over_abstention";
  }
  if (oracle.judged_correct && !calibrated.judged_correct && oracle.supported_answer && calibrated.answer_type === "grounded_answer") {
    return "selector_missed_supported_answer_over_unsupported_answer";
  }
  if (calibrated.judged_correct && !oracle.judged_correct) return "oracle_regression";
  if (!calibrated.judged_correct && supportedAnswers.length === 0) return "candidate_generation_gap";
  if (!calibrated.judged_correct && supportedAnswers.length > 0 && !topCandidate?.supported_answer) return "local_score_cannot_rank_supported_candidate";
  if (calibrated.judged_correct && oracle.judged_correct) return "both_correct";
  return "unresolved_selector_or_judge_boundary";
}

function deriveStatus(rows, gainRows, lossRows) {
  const netLift = gainRows.length - lossRows.length;
  const missWithSupported = rows.filter((row) => !row.calibrated.judged_correct && row.candidate_landscape.supported_answer_candidates > 0).length;
  if (netLift <= 3 && missWithSupported <= 8) return "selector_oracle_gap_small_generation_gap_primary";
  return "selector_oracle_gap_material_needs_learned_support_policy";
}

function renderReport(result) {
  const rows = Object.entries(result.gap_buckets)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([bucket, count]) => `| ${bucket} | ${count} | ${pct(count / result.aggregate.examples)} |`)
    .join("\n");
  return `# Oracle Gap Decomposition

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime job.

## Baseline vs Oracle

| Policy | Answer rate | Answer support | Overall judged correctness | Supported answers |
| --- | ---: | ---: | ---: | ---: |
| Scaffold priority | ${pct(result.baseline_metrics.scaffold_priority.answer_rate)} | ${pct(result.baseline_metrics.scaffold_priority.answer_support_rate)} | ${pct(result.baseline_metrics.scaffold_priority.overall_judged_correct_rate)} | ${result.baseline_metrics.scaffold_priority.supported_answers} |
| Calibrated hybrid | ${pct(result.baseline_metrics.calibrated_hybrid.answer_rate)} | ${pct(result.baseline_metrics.calibrated_hybrid.answer_support_rate)} | ${pct(result.baseline_metrics.calibrated_hybrid.overall_judged_correct_rate)} | ${result.baseline_metrics.calibrated_hybrid.supported_answers} |
| Qwen switch oracle | ${pct(result.baseline_metrics.qwen_switch_oracle.answer_rate)} | ${pct(result.baseline_metrics.qwen_switch_oracle.answer_support_rate)} | ${pct(result.baseline_metrics.qwen_switch_oracle.overall_judged_correct_rate)} | ${result.baseline_metrics.qwen_switch_oracle.supported_answers} |

## Aggregate

- Oracle net judged-correct lift over calibrated hybrid: ${result.aggregate.oracle_net_correct_lift}
- Oracle gains / losses: ${result.aggregate.oracle_gains} / ${result.aggregate.oracle_losses}
- Oracle supported-answer lift: ${result.aggregate.oracle_supported_answer_lift}
- Calibrated misses with any supported answer candidate: ${result.aggregate.calibrated_misses_with_supported_candidate}
- Calibrated misses with a Qwen supported answer candidate: ${result.aggregate.calibrated_misses_with_qwen_supported_candidate}
- Heuristic top candidate judged-correct rate: ${pct(result.aggregate.heuristic_top_candidate_judged_correct_rate)}
- Heuristic top candidate supported-answer rate when support exists: ${pct(result.aggregate.heuristic_top_supported_when_supported_exists_rate)}

## Gap Buckets

| Bucket | Rows | Share |
| --- | ---: | ---: |
${rows}

## Decision

- Rent GPU now: ${result.decision.rent_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Train selector now: ${result.decision.train_selector_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function isQwenFamily(family) {
  return /^qwen/i.test(String(family ?? ""));
}

function firstRank(rows, predicate) {
  const index = rows.findIndex(predicate);
  return index >= 0 ? index + 1 : null;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value ?? "null"] = (counts[value ?? "null"] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function pct(value) {
  return `${(100 * Number(value || 0)).toFixed(1)}%`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
