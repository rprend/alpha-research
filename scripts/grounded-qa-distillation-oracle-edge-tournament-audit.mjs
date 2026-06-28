import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const transferRunId = args["transfer-run"] ?? "broad-contrast-selector-transfer-0-320-to-321-389-2026-06-28-v1";
const packetRunId = args["packet-run"] ?? "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "oracle-edge-tournament-audit-broad-contrast-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const transfer = await readJson(path.join(runsDir, transferRunId, "result.json"));
const packet = await readJson(path.join(runsDir, packetRunId, "result.json"));
const pairPredictions = await readJsonl(path.join(runsDir, transferRunId, "final_pair_predictions.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const policyRows = [
  tournamentRows("win_count", (candidate) => candidate.wins),
  tournamentRows("margin_sum", (candidate) => candidate.margin_sum),
  tournamentRows("copeland", (candidate) => candidate.wins - candidate.losses),
  tournamentRows("copeland_plus_margin", (candidate) => candidate.wins - candidate.losses + candidate.margin_sum),
];
const policySummaries = policyRows.map((policy) => summarizePolicy(policy.policy, policy.rows));
const selectedPolicy = policySummaries.find((row) => row.policy === "win_count");

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "oracle_edge_tournament_audit",
  status: "oracle_edge_tournament_not_deployable",
  purpose: "Diagnose whether broad contrast pairwise margins can recover supported candidates when aggregated over the labeled supported-vs-unsupported contrast graph.",
  source_runs: {
    transfer_selector: transferRunId,
    final_packet: packetRunId,
  },
  graph: {
    examples: new Set(pairPredictions.map((row) => row.example_id)).size,
    labeled_edges: pairPredictions.length,
    edge_source: "oracle supported-vs-unsupported heldout contrast labels",
    deployable_without_labels: false,
  },
  policy_summaries: Object.fromEntries(policySummaries.map((row) => [row.policy, row])),
  comparison: {
    raw_pointwise_selection: transfer.selected_policy_metrics?.final_selection,
    pairwise_accuracy: transfer.selected_policy_metrics?.final_pairwise,
    oracle_edge_win_count_selection: selectedPolicy,
    packet_pair_count: packet.counts?.heldout_pair_rows,
  },
  decision: {
    promote_tournament_selector_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Build a deployable all-candidate-pairs tournament that scores every candidate pair without using support labels to choose graph edges.",
    reason: "Oracle-edge tournament selection recovers supported candidates, proving the pairwise signal is useful, but it uses label-derived supported-vs-unsupported edges and is not deployable.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_oracle_edge_graph: true,
    deployable_selector_claim_allowed: false,
    note: "This is a diagnostic upper bound over labeled heldout edges, not a selector integration result.",
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
    note: "Zero-call audit over existing pair predictions.",
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
  decision: result.decision,
}, null, 2));

function tournamentRows(policy, scoreFn) {
  const byExample = new Map();
  for (const row of pairPredictions) {
    if (!byExample.has(row.example_id)) byExample.set(row.example_id, new Map());
    const candidates = byExample.get(row.example_id);
    for (const [role, id, sign] of [["chosen", row.chosen_id, 1], ["rejected", row.rejected_id, -1]]) {
      if (!candidates.has(id)) {
        candidates.set(id, {
          candidate_id: id,
          supported_answer: role === "chosen",
          wins: 0,
          losses: 0,
          margin_sum: 0,
          edge_count: 0,
        });
      }
      const candidate = candidates.get(id);
      if (role === "chosen") candidate.supported_answer = true;
      const signedMargin = Number(row.margin) * sign;
      candidate.margin_sum += signedMargin;
      candidate.edge_count += 1;
      if (signedMargin >= 0) candidate.wins += 1;
      else candidate.losses += 1;
    }
  }
  const rows = [...byExample.entries()].map(([exampleId, candidates]) => {
    const ranked = [...candidates.values()]
      .map((candidate) => ({ ...candidate, score: scoreFn(candidate) }))
      .sort((left, right) => right.score - left.score || right.margin_sum - left.margin_sum || left.candidate_id.localeCompare(right.candidate_id));
    return {
      example_id: exampleId,
      policy,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
      candidate_count: ranked.length,
      supported_candidate_count: ranked.filter((candidate) => candidate.supported_answer).length,
      ranked_candidates: ranked,
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
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
  const win = result.policy_summaries.win_count;
  const raw = result.comparison.raw_pointwise_selection;
  return `# Oracle-Edge Tournament Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit aggregates pairwise margins over the labeled supported-vs-unsupported contrast graph. It is an upper-bound diagnostic, not a deployable selector.

## Selection

- Raw pointwise selection: ${raw.selected_supported}/${raw.examples} supported
- Oracle-edge win-count selection: ${win.selected_supported}/${win.examples} supported
- Labeled edges: ${result.graph.labeled_edges}
- Deployable without labels: no

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
