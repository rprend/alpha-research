import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const trainPacketRunId = args["train-packet-run"] ?? "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1";
const trainNliRunId = args["train-nli-run"] ?? "nonfinal-margin-compatible-train-nli-0-320-2026-06-28-v1";
const finalPacketRunId = args["final-packet-run"] ?? "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const finalNliRunId = args["final-nli-run"] ?? "final-margin-compatible-heldout-nli-321-389-2026-06-28-v1";
const timeAwareRunId = args["time-aware-run"] ?? "time-aware-source-prefix-selector-audit-0-320-to-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "candidate-internal-feature-overlay-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const chronologicalWindows = [
  "nonfinal-contrast-source-inventory-0-80-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-80-160-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-160-240-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-240-320-2026-06-28-v1",
];

await fs.mkdir(outputDir, { recursive: true });

const trainPairs = await readJsonl(path.join(runsDir, trainPacketRunId, "train_pairwise.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
const trainNli = await readJsonl(path.join(runsDir, trainNliRunId, "claim-nli-scores.jsonl"));
const finalNli = await readJsonl(path.join(runsDir, finalNliRunId, "claim-nli-scores.jsonl"));
const timeAware = await readJson(path.join(runsDir, timeAwareRunId, "result.json"));
const finalSelectionRows = await readJsonl(path.join(runsDir, timeAwareRunId, "source_prefix_recency_4x_final_selections.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const trainNliByCandidate = aggregateNliByCandidate(trainNli);
const finalNliByCandidate = aggregateNliByCandidate(finalNli);
const finalCandidateById = candidateMap(finalPairs);
const sourcePriors = buildPriors(trainPairs, sourcePrefixKey, recencyWeights(4));
const familyPriors = buildPriors(trainPairs, (candidate) => candidate.family ?? "unknown", recencyWeights(4));

const trainFeatureDirectional = directionalFeatureDiagnostics(trainPairs, trainNliByCandidate);
const policies = [
  evaluateFinalPolicy("source_prefix_recency_4x", (candidate) => sourceReliability(candidate)),
  evaluateFinalPolicy("source_plus_nli_margin_min_0p2", (candidate) => sourceReliability(candidate) + 0.2 * candidateFeatures(candidate, finalNliByCandidate).nli_margin_min),
  evaluateFinalPolicy("source_plus_nli_margin_min_0p5", (candidate) => sourceReliability(candidate) + 0.5 * candidateFeatures(candidate, finalNliByCandidate).nli_margin_min),
  evaluateFinalPolicy("source_minus_length_0p05", (candidate) => sourceReliability(candidate) - 0.05 * Math.log1p(candidateFeatures(candidate, finalNliByCandidate).answer_tokens)),
  evaluateFinalPolicy("source_plus_nli_0p1_minus_length_0p01", (candidate) => sourceReliability(candidate) + 0.1 * candidateFeatures(candidate, finalNliByCandidate).nli_margin_min - 0.01 * Math.log1p(candidateFeatures(candidate, finalNliByCandidate).answer_tokens)),
];
const baseline = policies.find((row) => row.policy === "source_prefix_recency_4x");
const bestOverlay = [...policies].sort((left, right) => right.selected_supported - left.selected_supported || left.selected_unsupported - right.selected_unsupported)[0];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "candidate_internal_feature_overlay_audit",
  status: "candidate_internal_overlay_not_sufficient",
  purpose: "Test whether deployable candidate-internal evidence and claim features improve the time-aware source-prefix listwise selector.",
  source_runs: {
    train_packet: trainPacketRunId,
    train_nli: trainNliRunId,
    final_packet: finalPacketRunId,
    final_nli: finalNliRunId,
    time_aware_source_prefix: timeAwareRunId,
  },
  train_feature_directional: trainFeatureDirectional,
  final_policies: Object.fromEntries(policies.map((row) => [row.policy, summarizePolicy(row)])),
  comparison: {
    time_aware_source_prefix_selected_supported: timeAware.final_policies?.source_prefix_recency_4x?.selected_supported,
    baseline_selected_supported: baseline.selected_supported,
    best_overlay_policy: bestOverlay.policy,
    best_overlay_selected_supported: bestOverlay.selected_supported,
    large_nli_overlay_selected_supported: policies.find((row) => row.policy === "source_plus_nli_margin_min_0p5")?.selected_supported,
  },
  diagnosis: {
    nli_features_pairwise_informative_but_not_listwise_sufficient: trainFeatureDirectional.nli_entailment_min.correct >= 40 && bestOverlay.selected_supported <= baseline.selected_supported,
    large_nli_weight_regresses: policies.find((row) => row.policy === "source_plus_nli_margin_min_0p5")?.selected_supported < baseline.selected_supported,
    remaining_baseline_misses: baseline.misses,
  },
  decision: {
    promote_candidate_internal_overlay_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Mine targeted contrast data for the five remaining source-prefix misses instead of adding naive NLI/length overlays.",
    reason: "Local NLI and answer-shape features are directionally useful in pairwise training, but simple listwise overlays do not improve the 44/49 final selector and larger NLI weights regress.",
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
    note: "Zero-call overlay audit over existing local NLI scores and judged candidate artifacts.",
  },
};

for (const policy of policies) {
  await writeJsonl(path.join(outputDir, `${policy.policy}_final_selections.jsonl`), policy.selections);
}
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  status: result.status,
  train_feature_directional: result.train_feature_directional,
  final_policies: result.final_policies,
  comparison: result.comparison,
  decision: result.decision,
}, null, 2));

function candidateMap(pairs) {
  const candidates = new Map();
  for (const pair of pairs) {
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const existing = candidates.get(candidate.id);
      candidates.set(candidate.id, {
        ...(existing ?? {}),
        ...candidate,
        example_id: pair.example_id,
        supported_answer: Boolean(existing?.supported_answer) || role === "chosen",
      });
    }
  }
  return candidates;
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

function directionalFeatureDiagnostics(pairs, nliByCandidate) {
  const specs = {
    nli_margin_min: "higher",
    nli_margin_mean: "higher",
    nli_entailment_min: "higher",
    nli_contradiction_max: "lower",
    answer_tokens: "lower",
    claim_count: "lower",
    citation_count: "higher",
  };
  return Object.fromEntries(Object.entries(specs).map(([feature, direction]) => {
    let correct = 0;
    for (const pair of pairs) {
      const chosen = candidateFeatures(pair.chosen, nliByCandidate);
      const rejected = candidateFeatures(pair.rejected, nliByCandidate);
      const ok = direction === "higher" ? chosen[feature] >= rejected[feature] : chosen[feature] <= rejected[feature];
      if (ok) correct += 1;
    }
    return [feature, { feature, direction, pairs: pairs.length, correct, accuracy: rate(correct, pairs.length) }];
  }));
}

function evaluateFinalPolicy(policy, scoreFn) {
  const selections = finalSelectionRows.map((row) => {
    const ranked = row.ranked_candidates
      .map((thinCandidate) => {
        const candidate = finalCandidateById.get(thinCandidate.candidate_id) ?? {
          ...thinCandidate,
          id: thinCandidate.candidate_id,
          supported_answer: Boolean(thinCandidate.supported_answer),
        };
        return {
          candidate_id: candidate.id,
          family: candidate.family,
          supported_answer: Boolean(candidate.supported_answer),
          score: scoreFn(candidate),
          features: candidateFeatures(candidate, finalNliByCandidate),
          source_reliability: sourceReliability(candidate),
        };
      })
      .sort((left, right) => right.score - left.score || left.candidate_id.localeCompare(right.candidate_id));
    return {
      example_id: row.example_id,
      policy,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_family: ranked[0]?.family ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
      selected_score: ranked[0]?.score ?? null,
      selected_features: ranked[0]?.features ?? null,
      selected_source_reliability: ranked[0]?.source_reliability ?? null,
      ranked_candidates: ranked,
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
  const selectedSupported = selections.filter((row) => row.selected_supported_answer).length;
  return {
    policy,
    selections,
    examples: selections.length,
    selected_supported: selectedSupported,
    selected_unsupported: selections.length - selectedSupported,
    misses: selections.filter((row) => !row.selected_supported_answer).map((row) => ({
      example_id: row.example_id,
      selected_candidate_id: row.selected_candidate_id,
      selected_family: row.selected_family,
      selected_source_reliability: row.selected_source_reliability,
      selected_features: row.selected_features,
    })),
  };
}

function candidateFeatures(candidate, nliByCandidate) {
  const nli = nliByCandidate.get(candidate.id) ?? { entailment: [], contradiction: [], margin: [] };
  const citations = candidate.citations ?? [];
  const answer = String(candidate.answer ?? "");
  const claims = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? "").trim()).filter(Boolean);
  return {
    claim_count: claims.length,
    citation_count: citations.length,
    answer_tokens: contentTokens(answer).length,
    inline_complete: citations.length > 0 && citations.every((id) => answer.includes(`[${id}]`)),
    nli_margin_min: nli.margin.length ? Math.min(...nli.margin) : 0,
    nli_margin_mean: mean(nli.margin),
    nli_entailment_min: nli.entailment.length ? Math.min(...nli.entailment) : 0,
    nli_contradiction_max: nli.contradiction.length ? Math.max(...nli.contradiction) : 0,
  };
}

function sourceReliability(candidate) {
  const direct = priorFor(sourcePrefixKey(candidate), sourcePriors);
  if (direct !== 0.5) return direct;
  return priorFor(candidate.family ?? "unknown", familyPriors);
}

function buildPriors(pairs, keyFn, weights = {}) {
  const stats = {};
  for (const pair of pairs) {
    const weight = weights[pair.source_inventory_run_id] ?? 1;
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const key = keyFn(candidate);
      stats[key] ??= { total: 0, chosen: 0, rejected: 0 };
      stats[key].total += weight;
      stats[key][role] += weight;
    }
  }
  return Object.fromEntries(Object.entries(stats).map(([key, row]) => [
    key,
    { ...row, smoothed_supported_rate: (row.chosen + 1) / (row.total + 2) },
  ]));
}

function predictionRunKey(candidate) {
  return candidate.prediction_run_id || (candidate.candidate_id || candidate.id || "").split("::")[1] || "unknown";
}

function sourcePrefixKey(candidate) {
  const runId = predictionRunKey(candidate)
    .replace(/-extended-future-holdout-.*/, "-extended-future-holdout")
    .replace(/-smoke-eval.*/, "-smoke-eval")
    .replace(/-321-389.*/, "-future-window")
    .replace(/-240-320.*/, "-future-window")
    .replace(/-160-240.*/, "-future-window")
    .replace(/-80-160.*/, "-future-window")
    .replace(/-0-80.*/, "-future-window");
  return `${candidate.family ?? "unknown"}:${runId}`;
}

function recencyWeights(factor) {
  return Object.fromEntries(chronologicalWindows.map((window, index) => [window, Math.pow(factor, index)]));
}

function priorFor(key, priors) {
  return priors[key]?.smoothed_supported_rate ?? 0.5;
}

function summarizePolicy(policy) {
  return {
    policy: policy.policy,
    examples: policy.examples,
    selected_supported: policy.selected_supported,
    selected_unsupported: policy.selected_unsupported,
    selection_support_rate: rate(policy.selected_supported, policy.examples),
  };
}

function renderReport(result) {
  return `# Candidate-Internal Feature Overlay Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit tests simple local-NLI and answer-shape overlays on top of the time-aware source-prefix selector.

## Selection

- Baseline source-prefix selector: ${result.final_policies.source_prefix_recency_4x.selected_supported}/${result.final_policies.source_prefix_recency_4x.examples}
- Best overlay: ${result.comparison.best_overlay_policy} at ${result.comparison.best_overlay_selected_supported}/${result.final_policies.source_prefix_recency_4x.examples}
- Large NLI overlay: ${result.comparison.large_nli_overlay_selected_supported}/${result.final_policies.source_prefix_recency_4x.examples}
- Train NLI entailment-min direction: ${result.train_feature_directional.nli_entailment_min.correct}/${result.train_feature_directional.nli_entailment_min.pairs}

## Decision

- Promote candidate-internal overlay now: ${result.decision.promote_candidate_internal_overlay_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function contentTokens(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, "").split(/\W+/).filter((token) => token.length > 1);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function rate(num, den) {
  return den ? num / den : 0;
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
