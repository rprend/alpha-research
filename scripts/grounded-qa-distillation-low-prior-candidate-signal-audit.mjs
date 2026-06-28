import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const lowPriorPacketRunId = args["low-prior-run"] ?? "low-prior-rescue-packet-audit-0-320-to-321-389-2026-06-28-v1";
const finalMissRunId = args["final-miss-run"] ?? "final-miss-repairability-audit-321-389-2026-06-28-v1";
const trainNliRunId = args["train-nli-run"] ?? "nonfinal-margin-compatible-train-nli-0-320-2026-06-28-v1";
const finalNliRunId = args["final-nli-run"] ?? "final-margin-compatible-heldout-nli-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "low-prior-candidate-signal-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const featureSpecs = [
  { feature: "nli_margin_min", direction: "higher" },
  { feature: "nli_margin_mean", direction: "higher" },
  { feature: "nli_entailment_min", direction: "higher" },
  { feature: "nli_contradiction_max", direction: "lower" },
  { feature: "claim_count", direction: "lower" },
];

await fs.mkdir(outputDir, { recursive: true });

const lowPriorPacket = await readJson(path.join(runsDir, lowPriorPacketRunId, "result.json"));
const lowPriorRows = await readJsonl(path.join(runsDir, lowPriorPacketRunId, "low_prior_rescue_rows.jsonl"));
const finalMiss = await readJson(path.join(runsDir, finalMissRunId, "result.json"));
const finalMissRows = await readJsonl(path.join(runsDir, finalMissRunId, "miss_rows.jsonl"));
const trainNliByCandidate = aggregateNliByCandidate(await readJsonl(path.join(runsDir, trainNliRunId, "claim-nli-scores.jsonl")));
const finalNliByCandidate = aggregateNliByCandidate(await readJsonl(path.join(runsDir, finalNliRunId, "claim-nli-scores.jsonl")));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const nonfinalFeatureRows = lowPriorRows.map((row) => compareCandidates({
  split: "nonfinal_low_prior_rescue",
  exampleId: row.example_id,
  supportedId: row.chosen_id,
  unsupportedId: row.rejected_id,
  nliByCandidate: trainNliByCandidate,
  metadata: {
    pair_id: row.pair_id,
    source_inventory_run_id: row.source_inventory_run_id,
    supported_family: row.chosen_family,
    unsupported_family: row.rejected_family,
    training_use: row.training_use,
  },
}));
const finalAnalogFeatureRows = finalMissRows.map((row) => compareCandidates({
  split: "final_diagnostic_analog",
  exampleId: row.example_id,
  supportedId: row.best_supported_candidate.candidate_id,
  unsupportedId: row.selected_candidate.candidate_id,
  nliByCandidate: finalNliByCandidate,
  metadata: {
    supported_family: row.best_supported_candidate.family,
    unsupported_family: row.selected_candidate.family,
    training_use: "forbidden_final_window_diagnostic_only",
  },
}));

const featureDiagnostics = featureSpecs.map((spec) => summarizeFeature(spec, nonfinalFeatureRows, finalAnalogFeatureRows));
const selectedFeature = selectFeature(featureDiagnostics);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "low_prior_candidate_signal_audit",
  status: selectedFeature ? "candidate_internal_signal_available_for_guarded_selector" : "candidate_internal_signal_not_ready",
  purpose: "Identify deployable candidate-internal support signals for low-prior rescue rows after family-level Qwen rescue anti-transfer.",
  source_runs: {
    low_prior_rescue_packet: lowPriorPacketRunId,
    final_miss_repairability: finalMissRunId,
    nonfinal_nli: trainNliRunId,
    final_nli: finalNliRunId,
  },
  packet_context: {
    low_prior_rescue_rows: lowPriorPacket.packet_summary?.rescue_rows,
    qwen_rejected_rows: lowPriorPacket.packet_summary?.qwen_rejected_rows,
    final_misses: finalMiss.summary?.baseline_unsupported,
    final_misses_with_supported_candidate: finalMiss.summary?.misses_with_supported_candidate,
  },
  feature_diagnostics: featureDiagnostics,
  selected_signal: selectedFeature,
  decision: {
    build_candidate_internal_low_prior_selector_next: Boolean(selectedFeature),
    promote_selector_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: selectedFeature
      ? `Build a guarded low-prior selector using ${selectedFeature.feature} as a candidate-internal support signal, with non-final regression controls before final reporting.`
      : "Mine or score stronger candidate-internal support features before another selector run.",
    reason: selectedFeature
      ? `${selectedFeature.feature} identifies the supported side on ${selectedFeature.nonfinal_correct}/${selectedFeature.nonfinal_pairs} non-final low-prior rows and ${selectedFeature.final_correct}/${selectedFeature.final_pairs} final diagnostic analogs, but final analogs remain reporting-only.`
      : "No candidate-internal feature clears the non-final low-prior slice strongly enough to justify a selector audit.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_feature_selection: false,
    final_window_labels_used_for_reporting_analogy: true,
    nonfinal_low_prior_rows_training_use: "allowed_nonfinal_low_prior_rescue_training",
    final_analog_rows_training_use: "forbidden_final_window_diagnostic_only",
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
    note: "Zero-call local audit over existing NLI scores and judged candidate artifacts.",
  },
};

await writeJsonl(path.join(outputDir, "nonfinal_feature_rows.jsonl"), nonfinalFeatureRows);
await writeJsonl(path.join(outputDir, "final_analog_feature_rows.jsonl"), finalAnalogFeatureRows);
await writeJsonl(path.join(outputDir, "feature_diagnostics.jsonl"), featureDiagnostics);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  packet_context: result.packet_context,
  selected_signal: result.selected_signal,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function compareCandidates({ split, exampleId, supportedId, unsupportedId, nliByCandidate, metadata }) {
  const supported = candidateFeatures(supportedId, nliByCandidate);
  const unsupported = candidateFeatures(unsupportedId, nliByCandidate);
  const feature_comparisons = Object.fromEntries(featureSpecs.map(({ feature, direction }) => {
    const supportedValue = supported[feature];
    const unsupportedValue = unsupported[feature];
    return [feature, {
      direction,
      supported_value: supportedValue,
      unsupported_value: unsupportedValue,
      points_to_supported: direction === "higher" ? supportedValue >= unsupportedValue : supportedValue <= unsupportedValue,
      delta_supported_minus_unsupported: supportedValue - unsupportedValue,
    }];
  }));
  return {
    split,
    example_id: exampleId,
    supported_candidate_id: supportedId,
    unsupported_candidate_id: unsupportedId,
    ...metadata,
    supported_features: supported,
    unsupported_features: unsupported,
    feature_comparisons,
  };
}

function candidateFeatures(candidateId, nliByCandidate) {
  const nli = nliByCandidate.get(candidateId) ?? { entailment: [], contradiction: [], margin: [] };
  return {
    nli_margin_min: nli.margin.length ? Math.min(...nli.margin) : 0,
    nli_margin_mean: mean(nli.margin),
    nli_entailment_min: nli.entailment.length ? Math.min(...nli.entailment) : 0,
    nli_contradiction_max: nli.contradiction.length ? Math.max(...nli.contradiction) : 0,
    claim_count: nli.margin.length,
  };
}

function summarizeFeature(spec, nonfinalRows, finalRows) {
  const nonfinalCorrect = nonfinalRows.filter((row) => row.feature_comparisons[spec.feature].points_to_supported).length;
  const finalCorrect = finalRows.filter((row) => row.feature_comparisons[spec.feature].points_to_supported).length;
  return {
    feature: spec.feature,
    direction: spec.direction,
    nonfinal_pairs: nonfinalRows.length,
    nonfinal_correct: nonfinalCorrect,
    nonfinal_accuracy: rate(nonfinalCorrect, nonfinalRows.length),
    final_pairs: finalRows.length,
    final_correct: finalCorrect,
    final_accuracy: rate(finalCorrect, finalRows.length),
    final_rows_used_for_selection: false,
  };
}

function selectFeature(rows) {
  const eligible = rows.filter((row) => row.nonfinal_correct >= 18);
  if (!eligible.length) return null;
  return [...eligible].sort((left, right) =>
    right.nonfinal_correct - left.nonfinal_correct
    || right.final_correct - left.final_correct
    || left.feature.localeCompare(right.feature)
  )[0];
}

function aggregateNliByCandidate(rows) {
  const byCandidate = new Map();
  for (const row of rows) {
    const aggregate = byCandidate.get(row.candidate_id) ?? { entailment: [], contradiction: [], margin: [] };
    aggregate.entailment.push(Number(row.nli?.entailment ?? 0));
    aggregate.contradiction.push(Number(row.nli?.contradiction ?? 0));
    aggregate.margin.push(Number(row.nli?.margin ?? 0));
    byCandidate.set(row.candidate_id, aggregate);
  }
  return byCandidate;
}

function renderReport(result) {
  return `# Low-Prior Candidate Signal Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit checks candidate-internal support features on the D300 low-prior rescue slice and the D299 final diagnostic analogs. Final rows are reporting-only.

## Packet Context

- Non-final low-prior rescue rows: ${result.packet_context.low_prior_rescue_rows}
- Qwen rejected rows: ${result.packet_context.qwen_rejected_rows}
- Final misses: ${result.packet_context.final_misses}
- Final misses with supported candidate: ${result.packet_context.final_misses_with_supported_candidate}

## Selected Signal

- Feature: ${result.selected_signal?.feature ?? "none"}
- Non-final correctness: ${result.selected_signal ? `${result.selected_signal.nonfinal_correct}/${result.selected_signal.nonfinal_pairs}` : "n/a"}
- Final diagnostic correctness: ${result.selected_signal ? `${result.selected_signal.final_correct}/${result.selected_signal.final_pairs}` : "n/a"}

## Decision

- Build candidate-internal low-prior selector next: ${result.decision.build_candidate_internal_low_prior_selector_next ? "yes" : "no"}
- Promote selector now: ${result.decision.promote_selector_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function rate(num, den) {
  return den ? num / den : null;
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
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
