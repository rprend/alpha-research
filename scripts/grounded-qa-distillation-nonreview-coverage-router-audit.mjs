import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "nonreview-oracle-contrast-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "nonreview-coverage-router-audit-2026-06-29-v1";
const subsetGateRunId = args["subset-gate-run-id"] ?? "nonreview-citation-subset-selector-smoke-2026-06-29-v1-contract-gate";
const groupGateRunId = args["group-gate-run-id"] ?? "nonreview-claim-coverage-group-scaffold-2026-06-29-v1-contract-gate";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const subsetRows = await readJsonl(path.join(runsDir, subsetGateRunId, "scored_predictions.jsonl"));
const groupRows = await readJsonl(path.join(runsDir, groupGateRunId, "scored_predictions.jsonl"));
const subsetById = new Map(subsetRows.map((row) => [row.example_id, row]));
const groupById = new Map(groupRows.map((row) => [row.example_id, row]));
const routedRows = subsetRows.map(routeRow);
const predictionsPath = path.join(outputDir, "routed_predictions.jsonl");
await writeJsonl(predictionsPath, routedRows.map((row) => ({
  example_id: row.example_id,
  prediction: row.prediction,
  raw_output: JSON.stringify(row.prediction),
  metadata: row.metadata,
})));
const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);
const gateRows = await readJsonl(path.join(runsDir, gateRunId, "scored_predictions.jsonl"));
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "nonreview_coverage_router_audit",
  status: statusFor(gate.metrics),
  purpose: "Route between the D442 subset selector and D447 claim-coverage group scaffold using only prediction-side citation-count coverage signals.",
  source_runs: {
    packet: packetRunId,
    subset_gate: subsetGateRunId,
    group_gate: groupGateRunId,
    contract_gate: gateRunId,
  },
  method: {
    routing_rule: "Select group scaffold when it returns a grounded answer with more citations than the subset selector; otherwise keep subset selector.",
    uses_target_labels_at_inference: false,
    openai_calls: 0,
    gpu_calls: 0,
  },
  routing_summary: summarizeRouting(routedRows),
  oracle_context: summarizeOracleContext(subsetRows, groupById),
  contract_gate_metrics: gate.metrics,
  diagnostics: summarizeDiagnostics(gateRows),
  baseline_comparison: {
    subset_selector_d442_contract_correct: count(subsetRows, (row) => row.contract_correct),
    group_scaffold_contract_correct: count(groupRows, (row) => row.contract_correct),
    router_contract_correct: Math.round(gate.metrics.overall_contract_correct_rate * gate.metrics.examples),
    d440_citation_selector_contract_correct: 41,
    structured_group_nonreview_contract_correct: 47,
    four_source_oracle_nonreview_contract_correct: 57,
  },
  decision: decisionFor(gate.metrics),
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
    note: "This router reuses local prediction artifacts only.",
  },
  artifacts: {
    routed_rows_jsonl: rel(path.join(outputDir, "routed_rows.jsonl")),
    routed_predictions_jsonl: rel(predictionsPath),
    contract_gate_result_json: rel(path.join(runsDir, gateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "routed_rows.jsonl"), routedRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  routing_summary: result.routing_summary,
  oracle_context: result.oracle_context,
  contract_gate_metrics: result.contract_gate_metrics,
  diagnostics: result.diagnostics,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function routeRow(subset) {
  const group = groupById.get(subset.example_id);
  if (!group) throw new Error(`Missing group row for ${subset.example_id}`);
  const subsetCitations = normalizeCitations(subset.prediction?.citations);
  const groupCitations = normalizeCitations(group.prediction?.citations);
  const useGroup = group.prediction_answer_type === "grounded_answer" && groupCitations.length > subsetCitations.length;
  const selected = useGroup ? group : subset;
  return {
    example_id: subset.example_id,
    selected_source: useGroup ? "claim_coverage_group" : "citation_subset",
    subset_citations: subsetCitations,
    group_citations: groupCitations,
    prediction: selected.prediction,
    target_answer_type_hidden_for_scoring: subset.target_answer_type,
    target_citations_hidden_for_scoring: normalizeCitations(subset.target?.citations),
    subset_contract_correct_hidden_for_analysis: Boolean(subset.contract_correct),
    group_contract_correct_hidden_for_analysis: Boolean(group.contract_correct),
    metadata: {
      scaffold: "nonreview_coverage_router",
      selected_source: useGroup ? "claim_coverage_group" : "citation_subset",
      routing_rule: "group_when_more_citations",
      no_model_weights_or_llm_calls: true,
    },
  };
}

function summarizeRouting(rows) {
  return {
    examples: rows.length,
    selected_subset: count(rows, (row) => row.selected_source === "citation_subset"),
    selected_group: count(rows, (row) => row.selected_source === "claim_coverage_group"),
    group_rescues_subset_miss_hidden: count(rows, (row) => row.selected_source === "claim_coverage_group" && !row.subset_contract_correct_hidden_for_analysis && row.group_contract_correct_hidden_for_analysis),
    group_harms_subset_correct_hidden: count(rows, (row) => row.selected_source === "claim_coverage_group" && row.subset_contract_correct_hidden_for_analysis && !row.group_contract_correct_hidden_for_analysis),
  };
}

function summarizeOracleContext(subsetRows, groupByIdLocal) {
  const both = subsetRows.map((subset) => ({ subset, group: groupByIdLocal.get(subset.example_id) }));
  return {
    subset_correct: count(both, (row) => row.subset.contract_correct),
    group_correct: count(both, (row) => row.group?.contract_correct),
    union_oracle_correct: count(both, (row) => row.subset.contract_correct || row.group?.contract_correct),
    group_only_correct: count(both, (row) => !row.subset.contract_correct && row.group?.contract_correct),
    subset_only_correct: count(both, (row) => row.subset.contract_correct && !row.group?.contract_correct),
  };
}

function summarizeDiagnostics(rows) {
  const grounded = rows.filter((row) => row.target_answer_type === "grounded_answer");
  const multi = grounded.filter((row) => normalizeCitations(row.target?.citations).length > 1);
  return {
    target_grounded: grounded.length,
    target_multi_citation_grounded: multi.length,
    multi_citation_exact: count(multi, (row) => row.citation_set_exact),
    multi_citation_contract_correct: count(multi, (row) => row.contract_correct),
    mean_predicted_citations_on_multi_targets: mean(multi.map((row) => normalizeCitations(row.prediction?.citations).length)),
  };
}

function statusFor(metrics) {
  const correct = Math.round(metrics.overall_contract_correct_rate * metrics.examples);
  if (correct >= 47) return "coverage_router_matches_structured_group";
  if (correct > 41) return "coverage_router_beats_d440_but_below_structured_group";
  if (correct >= 41) return "coverage_router_matches_d440";
  return "coverage_router_below_d440";
}

function decisionFor(metrics) {
  const correct = Math.round(metrics.overall_contract_correct_rate * metrics.examples);
  return {
    promote_as_current_best_scaffold: correct >= 47,
    keep_as_candidate_source: correct > 41,
    buy_openai_labels_now: false,
    rent_prime_gpu_now: false,
    reason: `Coverage router scores ${correct}/${metrics.examples}, compared with D442 40/64, D440 41/64, and structured-group baseline 47/64.`,
    next_step: correct > 41
      ? "Add router to the local candidate pool and target the remaining gap with per-question-part support planning."
      : "Do not promote; inspect why group rescues fail to offset harmed subset rows.",
  };
}

function renderReport(result) {
  return `# Non-Review Coverage Router Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This zero-spend router chooses between the D442 citation-subset selector and the claim-coverage group scaffold using only prediction-side citation count.

## Result

- Contract correct: ${result.baseline_comparison.router_contract_correct}/${result.contract_gate_metrics.examples}
- Selected subset: ${result.routing_summary.selected_subset}
- Selected group: ${result.routing_summary.selected_group}
- Group rescues: ${result.routing_summary.group_rescues_subset_miss_hidden}
- Group harms: ${result.routing_summary.group_harms_subset_correct_hidden}
- Multi-citation exact: ${result.diagnostics.multi_citation_exact}/${result.diagnostics.target_multi_citation_grounded}

## Context

- D442 subset selector: ${result.baseline_comparison.subset_selector_d442_contract_correct}/64
- D440 citation selector: ${result.baseline_comparison.d440_citation_selector_contract_correct}/64
- Structured-group baseline: ${result.baseline_comparison.structured_group_nonreview_contract_correct}/64
- Two-source oracle: ${result.oracle_context.union_oracle_correct}/64

## Decision

- Promote as current best scaffold: ${result.decision.promote_as_current_best_scaffold ? "yes" : "no"}
- Keep as candidate source: ${result.decision.keep_as_candidate_source ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

async function runContractGate(gateRunId, predictionFile) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "scripts/grounded-qa-distillation-evidence-first-contract-preflight.mjs",
      `--packet-run-id=${packetRunId}`,
      `--prediction-file=${path.relative(rootDir, predictionFile)}`,
      `--run-id=${gateRunId}`,
    ], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Contract gate failed ${code}: ${stderr || stdout}`)));
  });
  return readJson(path.join(runsDir, gateRunId, "result.json"));
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => typeof citation === "string" ? citation.replace(/^\[|\]$/g, "") : String(citation?.evidence_id ?? citation?.id ?? "")).filter(Boolean);
}

function count(rows, pred) {
  return rows.filter(pred).length;
}

function mean(values) {
  return values.length ? values.reduce((total, value) => total + Number(value || 0), 0) / values.length : 0;
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
    if (!value.startsWith("--")) continue;
    const [name, raw] = value.slice(2).split("=");
    parsed[name] = raw ?? "true";
  }
  return parsed;
}
