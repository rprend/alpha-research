import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const baselineRunId = args["baseline-run"] ?? "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1";
const overexpansionRunId = args["overexpansion-run"] ?? "overexpansion-aware-selector-qwen-frontier-pool-2026-06-28-v1";
const packetRunId = args["packet-run"] ?? "minimal-span-overexpansion-packet-qwen-frontier-pool-2026-06-28-v1";
const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const runId = args["run-id"] ?? "conditional-overexpansion-gate-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const baselineResult = await readJson(path.join(runsDir, baselineRunId, "result.json"));
const overResult = await readJson(path.join(runsDir, overexpansionRunId, "result.json"));
const d264ValidationPairs = await readJsonl(path.join(runsDir, packetRunId, "validation_contrast_pairs.jsonl"));
const d262ExistingPredictions = await readJsonl(path.join(runsDir, baselineRunId, "constrained_existing_validation_pair_predictions.jsonl"));
const d265ExistingPredictions = await readJsonl(path.join(runsDir, overexpansionRunId, "existing_validation_pair_predictions.jsonl"));
const d262FinalPredictions = await readJsonl(path.join(runsDir, baselineRunId, "constrained_final_diagnostic_pair_predictions.jsonl"));
const d265FinalPredictions = await readJsonl(path.join(runsDir, overexpansionRunId, "final_diagnostic_pair_predictions.jsonl"));
const d262FinalSelections = await readJsonl(path.join(runsDir, baselineRunId, "constrained_final_diagnostic_selections.jsonl"));
const d265FinalSelections = await readJsonl(path.join(runsDir, overexpansionRunId, "final_diagnostic_selections.jsonl"));
const validationPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "validation_pairwise.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "diagnostic_frontier_pairwise.jsonl"));

const validationById = new Map(validationPairs.map((row) => [row.pair_id, row]));
const finalById = new Map(finalPairs.map((row) => [row.pair_id, row]));
const d264Rows = d264ValidationPairs.map((pair) => pairRowFromPair(pair, { d262_margin: 0, over_margin: 1 }));
const existingRows = alignPredictions(d262ExistingPredictions, d265ExistingPredictions, validationById);
const finalRows = alignPredictions(d262FinalPredictions, d265FinalPredictions, finalById);
const finalCandidateRows = alignFinalSelections(d262FinalSelections, d265FinalSelections);
const grid = buildPolicyGrid().map((policy) => evaluatePolicy(policy, d264Rows, existingRows, finalRows, finalCandidateRows));
const baselineExistingCorrect = baselineResult.metrics?.constrained_pool_pairwise_selector?.existing_validation_pairwise?.correct ?? 0;
const selected = choosePolicy(grid, baselineExistingCorrect);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "conditional_overexpansion_gate",
  status: statusFor(selected, baselineResult, overResult),
  baseline_run_id: baselineRunId,
  overexpansion_run_id: overexpansionRunId,
  packet_run_id: packetRunId,
  pairwise_packet_run_id: pairwisePacketRunId,
  purpose: "Tune a zero-cost conditional gate that uses D265 overexpansion scores only when risk features suggest D262 is preferring an overexpanded unsupported candidate.",
  calibration: {
    use: "D264 validation overexpansion pairs plus existing validation pairwise preservation",
    final_window_labels_used: false,
    selected_policy: selected.policy,
    policies_evaluated: grid.length,
    baseline_existing_validation_correct: baselineExistingCorrect,
  },
  metrics: {
    d264_validation_pairs: selected.d264_validation,
    existing_validation_pairwise: selected.existing_validation,
    final_diagnostic_pairwise: selected.final_pairwise,
    final_diagnostic_selection: selected.final_selection.metrics,
    d262_final_selection: baselineResult.metrics?.constrained_pool_pairwise_selector?.final_diagnostic_selection,
    d265_final_selection: overResult.metrics?.final_diagnostic_selection,
  },
  decision: decisionFromSelected(selected, baselineResult, overResult),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_diagnostic_training_use: "forbidden_diagnostic_only",
    calibration_use: "nonfinal_d264_validation_and_existing_validation_only",
    nonfinal_training_use: "inherited_zero_call_selectors_and_d264_packet",
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
    note: "This gate reads existing zero-call selector and packet artifacts only.",
  },
};

await writeJsonl(path.join(outputDir, "policy_grid.jsonl"), grid.map(({ policy, d264_validation, existing_validation, final_pairwise, final_selection }) => ({ policy, d264_validation, existing_validation, final_pairwise, final_selection: final_selection.metrics })));
await writeJsonl(path.join(outputDir, "existing_validation_pair_predictions.jsonl"), selected.existing_rows);
await writeJsonl(path.join(outputDir, "final_diagnostic_pair_predictions.jsonl"), selected.final_rows);
await writeJsonl(path.join(outputDir, "final_diagnostic_selections.jsonl"), selected.final_selection.rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_policy: selected.policy,
  metrics: result.metrics,
  decision: result.decision,
}, null, 2));

function buildPolicyGrid() {
  const policies = [];
  for (const minRiskGap of [0, 0.25, 0.5, 0.75, 1.0]) {
    for (const minRejectedRisk of [0, 0.5, 1.0, 1.5, 2.0]) {
      for (const maxChosenRisk of [1.0, 1.5, 2.0, 2.5, 3.0, 99]) {
        for (const minOverScoreAdvantage of [-99, 0, 0.25, 0.5]) {
          policies.push({ min_risk_gap: minRiskGap, min_rejected_risk: minRejectedRisk, max_chosen_risk: maxChosenRisk, min_over_score_advantage: minOverScoreAdvantage });
        }
      }
    }
  }
  return policies;
}

function alignPredictions(d262Rows, d265Rows, pairById) {
  const overById = new Map(d265Rows.map((row) => [row.pair_id, row]));
  return d262Rows.map((base) => {
    const over = overById.get(base.pair_id);
    const pair = pairById.get(base.pair_id);
    if (!over || !pair) throw new Error(`Missing pair alignment for ${base.pair_id}`);
    return pairRowFromPair(pair, { d262_margin: base.margin, over_margin: over.margin });
  });
}

function pairRowFromPair(pair, scores) {
  const chosenRisk = riskFeatures(pair.input, pair.chosen);
  const rejectedRisk = riskFeatures(pair.input, pair.rejected);
  return {
    pair_id: pair.pair_id,
    example_id: pair.example_id ?? pair.root_example_id,
    split: pair.split,
    source_index: pair.source_index ?? null,
    contrast_type: pair.contrast_type ?? null,
    chosen_id: pair.chosen.id,
    rejected_id: pair.rejected.id,
    d262_margin: Number(scores.d262_margin ?? 0),
    over_margin: Number(scores.over_margin ?? 0),
    chosen_risk: chosenRisk,
    rejected_risk: rejectedRisk,
    training_use: pair.training_use,
  };
}

function alignFinalSelections(d262Rows, d265Rows) {
  const overById = new Map(d265Rows.map((row) => [row.example_id, row]));
  return d262Rows.map((base) => {
    const over = overById.get(base.example_id);
    if (!over) throw new Error(`Missing final selection ${base.example_id}`);
    const overByCandidate = new Map(over.ranked_candidates.map((row) => [row.candidate_id, row]));
    const baseNorm = normalizeScores(base.ranked_candidates);
    const overNorm = normalizeScores(over.ranked_candidates);
    const rows = base.ranked_candidates.map((candidate) => {
      const overCandidate = overByCandidate.get(candidate.candidate_id);
      if (!overCandidate) throw new Error(`Missing final candidate ${base.example_id}:${candidate.candidate_id}`);
      return {
        example_id: base.example_id,
        candidate_id: candidate.candidate_id,
        family: candidate.family,
        supported_answer: Boolean(candidate.supported_answer || overCandidate.supported_answer),
        d262_score: candidate.score,
        over_score: overCandidate.score,
        d262_normalized_score: baseNorm.get(candidate.candidate_id),
        over_normalized_score: overNorm.get(candidate.candidate_id),
        risk: riskFromOverFeatures(overCandidate.features ?? {}),
      };
    });
    return {
      example_id: base.example_id,
      d262_selected_candidate_id: base.selected_candidate_id,
      d265_selected_candidate_id: over.selected_candidate_id,
      d262_supported: base.selected_supported_answer,
      d265_supported: over.selected_supported_answer,
      candidates: rows,
    };
  });
}

function evaluatePolicy(policy, d264Rows, existingRows, finalRows, finalCandidateRows) {
  const d264Evaluated = evaluatePairRows(d264Rows, policy);
  const existingEvaluated = evaluatePairRows(existingRows, policy);
  const finalEvaluated = evaluatePairRows(finalRows, policy);
  const finalSelection = selectFinalCandidates(finalCandidateRows, policy);
  return {
    policy,
    d264_rows: d264Evaluated,
    existing_rows: existingEvaluated,
    final_rows: finalEvaluated,
    d264_validation: summarizeRows(d264Evaluated),
    existing_validation: summarizeRows(existingEvaluated),
    final_pairwise: summarizeRows(finalEvaluated),
    final_selection: { rows: finalSelection, metrics: summarizeSelections(finalSelection) },
  };
}

function evaluatePairRows(rows, policy) {
  return rows.map((row) => {
    const useOver = shouldUseOver(row.chosen_risk, row.rejected_risk, row.over_margin - row.d262_margin, policy);
    const margin = useOver ? row.over_margin : row.d262_margin;
    return {
      pair_id: row.pair_id,
      example_id: row.example_id,
      split: row.split,
      source_index: row.source_index,
      contrast_type: row.contrast_type,
      chosen_id: row.chosen_id,
      rejected_id: row.rejected_id,
      use_overexpansion_score: useOver,
      margin,
      predicted_preferred: margin >= 0 ? "chosen" : "rejected",
      correct: margin >= 0,
      chosen_risk: row.chosen_risk,
      rejected_risk: row.rejected_risk,
      training_use: row.training_use,
    };
  });
}

function shouldUseOver(chosenRisk, rejectedRisk, overScoreAdvantage, policy) {
  return rejectedRisk.total - chosenRisk.total >= policy.min_risk_gap
    && rejectedRisk.total >= policy.min_rejected_risk
    && chosenRisk.total <= policy.max_chosen_risk
    && overScoreAdvantage >= policy.min_over_score_advantage;
}

function selectFinalCandidates(examples, policy) {
  return examples.map((example) => {
    const d262Selected = example.candidates.find((row) => row.candidate_id === example.d262_selected_candidate_id);
    const d265Selected = example.candidates.find((row) => row.candidate_id === example.d265_selected_candidate_id);
    const useOver = d262Selected && d265Selected
      ? shouldUseOver(d265Selected.risk, d262Selected.risk, d265Selected.over_normalized_score - d262Selected.d262_normalized_score, policy)
      : false;
    const ranked = example.candidates.map((candidate) => ({
      ...candidate,
      score: useOver ? candidate.over_normalized_score : candidate.d262_normalized_score,
      use_overexpansion_score: useOver,
    })).sort((left, right) => right.score - left.score);
    return {
      example_id: example.example_id,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_family: ranked[0]?.family ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
      selected_score: ranked[0]?.score ?? null,
      gate_used_overexpansion: useOver,
      d262_selected_candidate_id: example.d262_selected_candidate_id,
      d265_selected_candidate_id: example.d265_selected_candidate_id,
      candidate_count: ranked.length,
      supported_candidate_count: ranked.filter((row) => row.supported_answer).length,
      unsupported_candidate_count: ranked.filter((row) => !row.supported_answer).length,
      ranked_candidates: ranked,
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
}

function choosePolicy(grid, baselineExistingCorrect) {
  const preserving = grid.filter((row) => row.existing_validation.correct >= baselineExistingCorrect);
  const candidates = preserving.length ? preserving : grid;
  return candidates.sort((left, right) => {
    const d264Delta = right.d264_validation.accuracy - left.d264_validation.accuracy;
    if (Math.abs(d264Delta) > 1e-12) return d264Delta;
    const existingDelta = right.existing_validation.correct - left.existing_validation.correct;
    if (existingDelta) return existingDelta;
    const overUseDelta = right.final_selection.rows.filter((row) => row.gate_used_overexpansion).length - left.final_selection.rows.filter((row) => row.gate_used_overexpansion).length;
    if (overUseDelta) return overUseDelta;
    return right.final_selection.metrics.selected_supported - left.final_selection.metrics.selected_supported;
  })[0];
}

function riskFeatures(input, candidate) {
  const answer = String(candidate.answer ?? "");
  const claims = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? "")).join(" ");
  const cited = citedText(input, candidate);
  const unsupportedNumber = unsupportedNumbers(`${answer} ${claims}`, cited, input.question).length;
  const unsupportedScope = unsupportedTerms(`${answer} ${claims}`, cited, input.question).length;
  const extraEntity = extraEntityTokens(`${answer} ${claims}`, cited, input.question).length;
  const answerTokens = contentTokens(answer).length;
  const coverage = tokenCoverage(contentTokens(answer), contentTokens(cited));
  return {
    unsupported_number: Math.log1p(unsupportedNumber),
    unsupported_scope: Math.log1p(unsupportedScope),
    extra_entity: Math.log1p(extraEntity),
    long_answer: Math.max(0, Math.log1p(answerTokens) - Math.log1p(10)),
    low_cited_coverage: 1 - coverage,
    total: Math.log1p(unsupportedNumber) + Math.log1p(unsupportedScope) + Math.log1p(extraEntity) + Math.max(0, Math.log1p(answerTokens) - Math.log1p(10)) + (1 - coverage),
  };
}

function riskFromOverFeatures(features) {
  const answerTokens = Math.exp(Number(features.answer_tokens ?? 0)) - 1;
  return {
    unsupported_number: Number(features.unsupported_number_count ?? 0),
    unsupported_scope: Number(features.unsupported_list_scope_count ?? 0),
    extra_entity: Number(features.extra_entity_count ?? 0),
    long_answer: Math.max(0, Math.log1p(answerTokens) - Math.log1p(10)),
    low_cited_coverage: 1 - Number(features.answer_cited_coverage ?? 0),
    total: Number(features.unsupported_number_count ?? 0) + Number(features.unsupported_list_scope_count ?? 0) + Number(features.extra_entity_count ?? 0) + Math.max(0, Math.log1p(answerTokens) - Math.log1p(10)) + (1 - Number(features.answer_cited_coverage ?? 0)),
  };
}

function summarizeRows(rows) {
  const correct = rows.filter((row) => row.correct).length;
  return {
    pairs: rows.length,
    correct,
    accuracy: rate(correct, rows.length),
    mean_margin: mean(rows.map((row) => row.margin)),
    overexpansion_activations: rows.filter((row) => row.use_overexpansion_score).length,
  };
}

function summarizeSelections(rows) {
  const selectedSupported = rows.filter((row) => row.selected_supported_answer).length;
  return {
    examples: rows.length,
    selected_supported: selectedSupported,
    selected_unsupported: rows.length - selectedSupported,
    selection_support_rate: rate(selectedSupported, rows.length),
    examples_with_supported_candidate: rows.filter((row) => row.supported_candidate_count > 0).length,
    overexpansion_activations: rows.filter((row) => row.gate_used_overexpansion).length,
  };
}

function statusFor(selected, baselineResult, overResult) {
  const baselineSelected = Number(baselineResult.metrics?.constrained_pool_pairwise_selector?.final_diagnostic_selection?.selected_supported ?? 0);
  const overSelected = Number(overResult.metrics?.final_diagnostic_selection?.selected_supported ?? 0);
  if (selected.final_selection.metrics.selected_supported >= overSelected && selected.existing_validation.correct >= Number(baselineResult.metrics?.constrained_pool_pairwise_selector?.existing_validation_pairwise?.correct ?? 0)) return "gate_preserves_validation_and_matches_overexpansion_final_gain";
  if (selected.final_selection.metrics.selected_supported > baselineSelected) return "gate_partial_final_gain";
  return "gate_not_sufficient";
}

function decisionFromSelected(selected, baselineResult, overResult) {
  const baselineSelected = Number(baselineResult.metrics?.constrained_pool_pairwise_selector?.final_diagnostic_selection?.selected_supported ?? 0);
  const overSelected = Number(overResult.metrics?.final_diagnostic_selection?.selected_supported ?? 0);
  if (selected.final_selection.metrics.selected_supported >= overSelected && selected.existing_validation.correct >= Number(baselineResult.metrics?.constrained_pool_pairwise_selector?.existing_validation_pairwise?.correct ?? 0)) {
    return { integrate_gate_now: false, launch_gpu_now: false, buy_more_openai_labels_now: false, reason: "The gate recovers the overexpansion final-selection gain while preserving existing validation, but final diagnostics are too small for integration.", next_step: "Audit remaining gate misses and broaden validation before claiming integration." };
  }
  if (selected.final_selection.metrics.selected_supported > baselineSelected) {
    return { integrate_gate_now: false, launch_gpu_now: false, buy_more_openai_labels_now: false, reason: "The gate improves final diagnostics but does not match the full overexpansion gain under preservation constraints.", next_step: "Inspect activation failures and decide whether targeted adjudication is needed." };
  }
  return { integrate_gate_now: false, launch_gpu_now: false, buy_more_openai_labels_now: false, reason: "The gate does not improve over D262 under leakage-safe calibration.", next_step: "Keep D262 as active baseline; use D265/D267 only as diagnostic evidence." };
}

function renderReport(result) {
  return `# Conditional Overexpansion Gate

Generated: ${result.generated_at}

This gate makes no OpenAI calls and launches no compute. Calibration uses D264 validation and existing validation only; final-window labels are forbidden diagnostics.

| Metric | Items | Correct/selected | Rate |
| --- | ---: | ---: | ---: |
| D264 validation pairs | ${result.metrics.d264_validation_pairs.pairs} | ${result.metrics.d264_validation_pairs.correct} | ${pct(result.metrics.d264_validation_pairs.accuracy)} |
| Existing validation pairwise | ${result.metrics.existing_validation_pairwise.pairs} | ${result.metrics.existing_validation_pairwise.correct} | ${pct(result.metrics.existing_validation_pairwise.accuracy)} |
| Final diagnostic pairwise | ${result.metrics.final_diagnostic_pairwise.pairs} | ${result.metrics.final_diagnostic_pairwise.correct} | ${pct(result.metrics.final_diagnostic_pairwise.accuracy)} |
| Gate final selection | ${result.metrics.final_diagnostic_selection.examples} | ${result.metrics.final_diagnostic_selection.selected_supported} | ${pct(result.metrics.final_diagnostic_selection.selection_support_rate)} |
| D262 final selection | ${result.metrics.d262_final_selection.examples} | ${result.metrics.d262_final_selection.selected_supported} | ${pct(result.metrics.d262_final_selection.selection_support_rate)} |
| D265 final selection | ${result.metrics.d265_final_selection.examples} | ${result.metrics.d265_final_selection.selected_supported} | ${pct(result.metrics.d265_final_selection.selection_support_rate)} |

## Decision

- Integrate gate now: ${result.decision.integrate_gate_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function normalizeScores(rows) {
  const scores = rows.map((row) => Number(row.score ?? 0));
  const center = mean(scores);
  const std = Math.sqrt(mean(scores.map((score) => (score - center) ** 2))) || 1;
  return new Map(rows.map((row) => [row.candidate_id, (Number(row.score ?? 0) - center) / std]));
}

function citedText(input, candidate) {
  const byId = new Map((input.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row.text]));
  return (candidate.citations ?? []).map((id) => byId.get(String(id).replace(/^\[/, "").replace(/\]$/, "")) ?? "").join(" ");
}

function contentTokens(value) {
  return String(value ?? "").replace(/\[[^\]]+\]/g, " ").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
}

function numberTokens(value) {
  return String(value ?? "").match(/[-+]?\d+(?:[.,]\d+)*(?:%| percent)?/gi) ?? [];
}

function normalizeNumber(value) {
  return String(value ?? "").toLowerCase().replace(/,/g, "").replace(/\s+percent\b/, "%");
}

function unsupportedNumbers(text, cited, question) {
  const citedNumbers = new Set(numberTokens(cited).map(normalizeNumber));
  const questionNumbers = new Set(numberTokens(question).map(normalizeNumber));
  return numberTokens(text).map(normalizeNumber).filter((number) => !citedNumbers.has(number) && !questionNumbers.has(number));
}

function unsupportedTerms(text, cited, question) {
  const terms = ["dataset", "datasets", "task", "tasks", "setting", "settings", "model", "models", "score", "scores", "class", "classes", "translation", "translations"];
  const citedTerms = new Set(matchedTerms(cited, terms));
  const questionTerms = new Set(matchedTerms(question, terms));
  return matchedTerms(text, terms).filter((term) => !citedTerms.has(term) && !questionTerms.has(term));
}

function matchedTerms(value, terms) {
  const text = String(value ?? "").toLowerCase();
  return terms.filter((term) => new RegExp(`\\b${term}\\b`).test(text));
}

function extraEntityTokens(text, cited, question) {
  const citedEntities = new Set(entityishTokens(cited).map((token) => token.toLowerCase()));
  const questionEntities = new Set(entityishTokens(question).map((token) => token.toLowerCase()));
  return entityishTokens(text).filter((token) => !citedEntities.has(token.toLowerCase()) && !questionEntities.has(token.toLowerCase()));
}

function entityishTokens(value) {
  return String(value ?? "").match(/\b[A-Z][A-Za-z0-9.-]*(?:-[A-Za-z0-9.]+)?\b/g) ?? [];
}

function tokenCoverage(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size) return 0;
  return [...left].filter((token) => right.has(token)).length / left.size;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value || 0)).toFixed(1)}%`;
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
