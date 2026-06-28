import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const transferRunId = args["transfer-run"] ?? "broad-contrast-selector-transfer-0-320-to-321-389-2026-06-28-v1";
const oracleRunId = args["oracle-run"] ?? "oracle-edge-tournament-audit-broad-contrast-2026-06-28-v1";
const runId = args["run-id"] ?? "deployable-tournament-audit-broad-contrast-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const transfer = await readJson(path.join(runsDir, transferRunId, "result.json"));
const oracle = await readJson(path.join(runsDir, oracleRunId, "result.json"));
const selectionRows = await readJsonl(path.join(runsDir, transferRunId, "final_selections.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const policyRows = [
  allPairsRows("raw_score", (candidate) => candidate.raw_score),
  allPairsRows("win_count", (candidate) => candidate.wins),
  allPairsRows("margin_sum", (candidate) => candidate.margin_sum),
  allPairsRows("copeland", (candidate) => candidate.wins - candidate.losses),
  allPairsRows("copeland_plus_margin", (candidate) => candidate.wins - candidate.losses + candidate.margin_sum),
];
const policySummaries = policyRows.map((policy) => summarizePolicy(policy.policy, policy.rows));
const winCount = policySummaries.find((row) => row.policy === "win_count");
const rawScore = policySummaries.find((row) => row.policy === "raw_score");
const oracleWinCount = oracle.policy_summaries?.win_count;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "deployable_tournament_audit",
  status: "deployable_tournament_not_sufficient",
  purpose: "Test whether broad contrast pairwise margins recover supported candidates when applied over an all-candidate graph that can be built without support labels.",
  source_runs: {
    transfer_selector: transferRunId,
    oracle_edge_audit: oracleRunId,
  },
  graph: {
    examples: selectionRows.length,
    graph_source: "complete graph over each example's deployable candidate pool",
    edge_source: "score differences from the learned broad contrast selector",
    deployable_without_labels: true,
    uses_support_labels_to_choose_edges: false,
  },
  policy_summaries: Object.fromEntries(policySummaries.map((row) => [row.policy, row])),
  comparison: {
    raw_pointwise_selection: transfer.selected_policy_metrics?.final_selection,
    raw_score_selection: rawScore,
    all_pairs_win_count_selection: winCount,
    oracle_edge_win_count_selection: oracleWinCount,
    oracle_edge_gap_selected_supported: Number(oracleWinCount?.selected_supported ?? 0) - Number(winCount?.selected_supported ?? 0),
  },
  decision: {
    promote_tournament_selector_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Treat pairwise scoring as useful but insufficient; design a deployable graph/listwise objective that can select candidates without label-derived supported-vs-unsupported edges.",
    reason: "The complete deployable graph collapses to the same weak candidate selection as raw pointwise ranking, while the oracle-edge graph succeeds only because labels choose informative edges.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_deployable_graph: false,
    final_window_labels_used_for_reporting_selection_correctness: true,
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
    note: "Zero-call audit over existing final selection scores.",
  },
};

for (const policy of policyRows) {
  await writeJsonl(path.join(outputDir, `${policy.policy}_selections.jsonl`), policy.rows);
}
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  status: result.status,
  policy_summaries: result.policy_summaries,
  comparison: result.comparison,
  decision: result.decision,
}, null, 2));

function allPairsRows(policy, scoreFn) {
  const rows = selectionRows.map((row) => {
    const candidates = row.ranked_candidates.map((candidate) => ({
      candidate_id: candidate.candidate_id,
      family: candidate.family,
      supported_answer: Boolean(candidate.supported_answer),
      raw_score: Number(candidate.score),
      wins: 0,
      losses: 0,
      margin_sum: 0,
      edge_count: 0,
    }));
    for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
        const left = candidates[leftIndex];
        const right = candidates[rightIndex];
        const margin = left.raw_score - right.raw_score;
        left.margin_sum += margin;
        right.margin_sum -= margin;
        left.edge_count += 1;
        right.edge_count += 1;
        if (margin >= 0) {
          left.wins += 1;
          right.losses += 1;
        } else {
          right.wins += 1;
          left.losses += 1;
        }
      }
    }
    const ranked = candidates
      .map((candidate) => ({ ...candidate, score: scoreFn(candidate) }))
      .sort((left, right) => right.score - left.score || right.raw_score - left.raw_score || left.candidate_id.localeCompare(right.candidate_id));
    return {
      example_id: row.example_id,
      policy,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
      candidate_count: ranked.length,
      supported_candidate_count: ranked.filter((candidate) => candidate.supported_answer).length,
      complete_graph_edges: ranked.length * Math.max(0, ranked.length - 1) / 2,
      ranked_candidates: ranked,
    };
  });
  rows.sort((left, right) => left.example_id.localeCompare(right.example_id));
  return { policy, rows };
}

function summarizePolicy(policy, rows) {
  const selectedSupported = rows.filter((row) => row.selected_supported_answer).length;
  return {
    policy,
    examples: rows.length,
    selected_supported: selectedSupported,
    selected_unsupported: rows.length - selectedSupported,
    selection_support_rate: rows.length ? selectedSupported / rows.length : 0,
    examples_with_supported_candidate: rows.filter((row) => row.supported_candidate_count > 0).length,
  };
}

function renderReport(result) {
  const raw = result.policy_summaries.raw_score;
  const win = result.policy_summaries.win_count;
  const oracle = result.comparison.oracle_edge_win_count_selection;
  return `# Deployable Tournament Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit builds a complete candidate graph per example using only deployable selector scores. It does not use support labels to choose edges.

## Selection

- Raw-score selection: ${raw.selected_supported}/${raw.examples} supported
- All-pairs win-count selection: ${win.selected_supported}/${win.examples} supported
- Oracle-edge win-count selection: ${oracle.selected_supported}/${oracle.examples} supported
- Oracle-edge gap: ${result.comparison.oracle_edge_gap_selected_supported} examples
- Deployable without labels: yes

## Decision

- Promote tournament selector now: ${result.decision.promote_tournament_selector_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
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

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
