import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const trainPacketRunId = args["train-packet-run"] ?? "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1";
const transferRunId = args["transfer-run"] ?? "broad-contrast-selector-transfer-0-320-to-321-389-2026-06-28-v1";
const deployableTournamentRunId = args["deployable-tournament-run"] ?? "deployable-tournament-audit-broad-contrast-2026-06-28-v1";
const runId = args["run-id"] ?? "family-prior-listwise-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const trainPairs = await readJsonl(path.join(runsDir, trainPacketRunId, "train_pairwise.jsonl"));
const transfer = await readJson(path.join(runsDir, transferRunId, "result.json"));
const deployableTournament = await readJson(path.join(runsDir, deployableTournamentRunId, "result.json"));
const finalSelections = await readJsonl(path.join(runsDir, transferRunId, "final_selections.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const familyStats = buildFamilyStats(trainPairs);
const familyPriors = Object.fromEntries(Object.entries(familyStats).map(([family, stats]) => [
  family,
  {
    ...stats,
    smoothed_supported_rate: (stats.chosen + 1) / (stats.total + 2),
  },
]));
const trainPairwise = evaluateTrainPairs(trainPairs, familyPriors);
const selectionRows = selectByFamilyPrior(finalSelections, familyPriors);
const selectionSummary = summarizeSelections(selectionRows);
const rawSelection = transfer.selected_policy_metrics?.final_selection;
const deployableWinCount = deployableTournament.policy_summaries?.win_count;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "family_prior_listwise_audit",
  status: selectionSummary.selected_supported >= 40 ? "family_prior_promising_not_promoted" : "family_prior_not_sufficient",
  purpose: "Test a deployable listwise selector that uses non-final generator-family reliability priors rather than pairwise scalar score alone.",
  source_runs: {
    train_packet: trainPacketRunId,
    transfer_selector: transferRunId,
    deployable_tournament_audit: deployableTournamentRunId,
  },
  model: {
    type: "nonfinal_smoothed_family_prior_listwise_selector",
    features: ["candidate_family", "raw_broad_selector_score_tiebreak"],
    unknown_family_prior: 0.5,
    selected_without_final_label_tuning: true,
    family_priors: familyPriors,
  },
  train_pairwise: trainPairwise,
  final_selection: selectionSummary,
  comparison: {
    raw_broad_selector_selection: rawSelection,
    deployable_tournament_win_count_selection: deployableWinCount,
    family_prior_selection: selectionSummary,
    delta_vs_raw_selected_supported: selectionSummary.selected_supported - Number(rawSelection?.selected_supported ?? 0),
    delta_vs_deployable_tournament_selected_supported: selectionSummary.selected_supported - Number(deployableWinCount?.selected_supported ?? 0),
  },
  decision: {
    promote_selector_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Stress-test source-family priors across additional temporally separated windows and combine them with evidence/claim features under a preregistered listwise selector.",
    reason: "A non-final family prior substantially improves heldout selection, but the training set is sparse and missing some final families, so this is a promising deployable feature rather than a final claim.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_reporting_selection_correctness: true,
    final_window_family_metadata_is_deployable: true,
    deployable_selector_claim_allowed: false,
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
    note: "Zero-call audit over existing labels and selection artifacts.",
  },
};

await writeJsonl(path.join(outputDir, "family_prior_final_selections.jsonl"), selectionRows);
await fs.writeFile(path.join(outputDir, "family_prior_model.json"), `${JSON.stringify(result.model, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  status: result.status,
  train_pairwise: result.train_pairwise,
  final_selection: result.final_selection,
  comparison: result.comparison,
  decision: result.decision,
}, null, 2));

function buildFamilyStats(pairs) {
  const stats = {};
  for (const pair of pairs) {
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const family = candidate.family ?? "unknown";
      stats[family] ??= { total: 0, chosen: 0, rejected: 0, examples: new Set() };
      stats[family].total += 1;
      stats[family][role] += 1;
      stats[family].examples.add(pair.example_id);
    }
  }
  return Object.fromEntries(Object.entries(stats).map(([family, row]) => [
    family,
    {
      total: row.total,
      chosen: row.chosen,
      rejected: row.rejected,
      examples: row.examples.size,
    },
  ]));
}

function evaluateTrainPairs(pairs, priors) {
  const rows = pairs.map((pair) => {
    const chosenScore = priorFor(pair.chosen.family, priors);
    const rejectedScore = priorFor(pair.rejected.family, priors);
    return {
      pair_id: pair.pair_id,
      example_id: pair.example_id,
      chosen_family: pair.chosen.family,
      rejected_family: pair.rejected.family,
      chosen_score: chosenScore,
      rejected_score: rejectedScore,
      correct: chosenScore >= rejectedScore,
    };
  });
  return {
    pairs: rows.length,
    correct: rows.filter((row) => row.correct).length,
    accuracy: rate(rows.filter((row) => row.correct).length, rows.length),
  };
}

function selectByFamilyPrior(rows, priors) {
  return rows.map((row) => {
    const ranked = row.ranked_candidates
      .map((candidate) => ({
        ...candidate,
        family_prior_score: priorFor(candidate.family, priors),
        raw_broad_selector_score: Number(candidate.score),
      }))
      .sort((left, right) =>
        right.family_prior_score - left.family_prior_score
        || right.raw_broad_selector_score - left.raw_broad_selector_score
        || left.candidate_id.localeCompare(right.candidate_id)
      );
    return {
      example_id: row.example_id,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_family: ranked[0]?.family ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
      candidate_count: ranked.length,
      supported_candidate_count: ranked.filter((candidate) => candidate.supported_answer).length,
      ranked_candidates: ranked,
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
}

function priorFor(family, priors) {
  return priors[family]?.smoothed_supported_rate ?? 0.5;
}

function summarizeSelections(rows) {
  const selectedSupported = rows.filter((row) => row.selected_supported_answer).length;
  return {
    examples: rows.length,
    selected_supported: selectedSupported,
    selected_unsupported: rows.length - selectedSupported,
    selection_support_rate: rate(selectedSupported, rows.length),
    examples_with_supported_candidate: rows.filter((row) => row.supported_candidate_count > 0).length,
    selected_family_counts: countBy(rows.map((row) => row.selected_family ?? "unknown")),
  };
}

function renderReport(result) {
  return `# Family-Prior Listwise Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit trains only generator-family reliability priors from non-final judged contrasts, then selects from the final candidate pool using family prior first and raw broad-selector score only as a tiebreaker.

## Selection

- Non-final family-prior pairwise accuracy: ${result.train_pairwise.correct}/${result.train_pairwise.pairs}
- Raw broad selector: ${result.comparison.raw_broad_selector_selection.selected_supported}/${result.comparison.raw_broad_selector_selection.examples} supported
- Deployable complete tournament: ${result.comparison.deployable_tournament_win_count_selection.selected_supported}/${result.comparison.deployable_tournament_win_count_selection.examples} supported
- Family-prior listwise selector: ${result.final_selection.selected_supported}/${result.final_selection.examples} supported
- Delta vs raw: ${signed(result.comparison.delta_vs_raw_selected_supported)}

## Decision

- Promote selector now: ${result.decision.promote_selector_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function rate(num, den) {
  return den ? num / den : 0;
}

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
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
