import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "preservation-pair-mining-audit-0-320-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const sourceInventoryRunIds = [
  "nonfinal-contrast-source-inventory-0-80-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-80-160-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-160-240-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-240-320-2026-06-28-v1",
];

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceSummaries = [];
const preservationPairs = [];
const duplicatePairs = [];

for (const sourceInventoryRunId of sourceInventoryRunIds) {
  const labels = await readJsonl(path.join(runsDir, sourceInventoryRunId, "support_labels.jsonl"));
  const result = await readJson(path.join(runsDir, sourceInventoryRunId, "result.json"));
  const byExample = groupBy(labels, (row) => row.root_example_id);
  const sourcePairs = [];
  const sourceDuplicates = [];
  for (const [rootExampleId, rows] of byExample.entries()) {
    const byLabel = groupBy(rows.map(candidateFromLabel), (row) => row.preservation_label);
    for (const [label, candidates] of byLabel.entries()) {
      if (!["supported_answer", "supported_abstention", "unsupported_answer"].includes(label)) continue;
      for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
          const left = candidates[leftIndex];
          const right = candidates[rightIndex];
          const pair = preservationPair(sourceInventoryRunId, rootExampleId, label, left, right);
          if (pair.exact_duplicate_surface) sourceDuplicates.push(pair);
          else sourcePairs.push(pair);
        }
      }
    }
  }
  preservationPairs.push(...sourcePairs);
  duplicatePairs.push(...sourceDuplicates);
  sourceSummaries.push({
    source_inventory_run_id: sourceInventoryRunId,
    window: result.window,
    support_labels: labels.length,
    examples: byExample.size,
    preservation_pairs: sourcePairs.length,
    exact_duplicate_preservation_pairs: sourceDuplicates.length,
    preservation_pair_counts: countBy(sourcePairs.map((row) => row.preservation_label)),
    preservation_example_counts: countExamplesByLabel(sourcePairs),
  });
}

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "preservation_pair_mining_audit",
  status: "preservation_pairs_available_for_balanced_packet",
  purpose: "Mine non-final same-label judged candidate pairs that can act as broad preservation/equivalence data for balanced grounded-QA post-training.",
  source_runs: {
    source_inventories: sourceInventoryRunIds,
    balanced_packet_learner: "balanced-packet-learner-audit-0-160-to-240-320-to-321-389-2026-06-28-v1",
  },
  summary: {
    source_windows: sourceInventoryRunIds.length,
    preservation_pairs: preservationPairs.length,
    exact_duplicate_preservation_pairs: duplicatePairs.length,
    examples_with_preservation_pairs: new Set(preservationPairs.map((row) => row.example_id)).size,
    supported_answer_pairs: preservationPairs.filter((row) => row.preservation_label === "supported_answer").length,
    supported_abstention_pairs: preservationPairs.filter((row) => row.preservation_label === "supported_abstention").length,
    unsupported_answer_pairs: preservationPairs.filter((row) => row.preservation_label === "unsupported_answer").length,
    train_window_pairs: preservationPairs.filter((row) => row.source_inventory_run_id !== sourceInventoryRunIds[3]).length,
    validation_window_pairs: preservationPairs.filter((row) => row.source_inventory_run_id === sourceInventoryRunIds[3]).length,
    source_window_counts: countBy(preservationPairs.map((row) => row.source_inventory_run_id)),
  },
  source_summaries: sourceSummaries,
  decision: {
    build_balanced_packet_next: true,
    promote_selector_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Merge preservation pairs with targeted supported-vs-unsupported contrasts into a balanced packet and test a learner that preserves same-label candidate neighborhoods.",
    reason: "Existing non-final support labels contain many same-label pairs that were invisible to the supported-vs-unsupported contrast packet, so the next balanced objective can be built without new calls.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    preservation_pairs_training_use: "allowed_nonfinal_same_label_preservation_data",
    source_labels_training_use: "existing_nonfinal_judged_labels_only",
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
    note: "Zero-call mining audit over existing non-final support labels.",
  },
};

await writeJsonl(path.join(outputDir, "preservation_pairs.jsonl"), preservationPairs);
await writeJsonl(path.join(outputDir, "exact_duplicate_preservation_pairs.jsonl"), duplicatePairs);
await writeJsonl(path.join(outputDir, "source_summaries.jsonl"), sourceSummaries);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  status: result.status,
  summary: result.summary,
  decision: result.decision,
}, null, 2));

function candidateFromLabel(row) {
  const prediction = row.prediction ?? {};
  return {
    id: row.example_id,
    root_example_id: row.root_example_id,
    prediction_run_id: row.prediction_run_id,
    judge_run_id: row.judge_run_id,
    preservation_label: preservationLabel(row),
    input: row.input,
    answer_type: prediction.answer_type ?? null,
    answer: prediction.answer ?? "",
    citations: prediction.citations ?? [],
    claim_table: prediction.claim_table ?? [],
    abstention_reason: prediction.abstention_reason ?? null,
    labels: row.labels,
    judge: row.judge,
  };
}

function preservationLabel(row) {
  if (row.labels?.supported_answer) return "supported_answer";
  if (row.labels?.supported_abstention) return "supported_abstention";
  if (row.labels?.unsupported_answer) return "unsupported_answer";
  return "other";
}

function preservationPair(sourceInventoryRunId, rootExampleId, label, left, right) {
  const pairId = `${sourceInventoryRunId}:${rootExampleId}:${label}:${left.prediction_run_id}:preserve:${right.prediction_run_id}`;
  return {
    pair_id: pairId,
    example_id: rootExampleId,
    source_inventory_run_id: sourceInventoryRunId,
    preservation_label: label,
    training_use: "allowed_nonfinal_same_label_preservation_data",
    objective: "equivalence_preservation_not_preference",
    exact_duplicate_surface: normalizedSurface(left) === normalizedSurface(right),
    input: left.input,
    left: stripCandidate(left),
    right: stripCandidate(right),
    feature_summary: {
      same_answer_type: left.answer_type === right.answer_type,
      same_citation_set: sameCitationSet(left.citations, right.citations),
      token_delta_abs: Math.abs(contentTokens(left.answer).length - contentTokens(right.answer).length),
      left_tokens: contentTokens(left.answer).length,
      right_tokens: contentTokens(right.answer).length,
      left_claim_count: left.claim_table.length,
      right_claim_count: right.claim_table.length,
      left_citation_count: left.citations.length,
      right_citation_count: right.citations.length,
    },
  };
}

function stripCandidate(candidate) {
  return {
    id: candidate.id,
    prediction_run_id: candidate.prediction_run_id,
    answer_type: candidate.answer_type,
    answer: candidate.answer,
    citations: candidate.citations,
    claim_table: candidate.claim_table,
    abstention_reason: candidate.abstention_reason,
    labels: candidate.labels,
    judge: {
      verdict: candidate.judge?.verdict,
      unsupported_claims: candidate.judge?.unsupported_claims ?? [],
      missing_citations: candidate.judge?.missing_citations ?? [],
    },
  };
}

function countExamplesByLabel(rows) {
  const byLabel = {};
  for (const row of rows) {
    byLabel[row.preservation_label] ??= new Set();
    byLabel[row.preservation_label].add(row.example_id);
  }
  return Object.fromEntries(Object.entries(byLabel).map(([label, examples]) => [label, examples.size]));
}

function sameCitationSet(left = [], right = []) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && [...leftSet].every((id) => rightSet.has(id));
}

function normalizedSurface(candidate) {
  return `${candidate.answer_type}::${String(candidate.answer ?? "").replace(/\s+/g, " ").trim()}::${[...(candidate.citations ?? [])].sort().join("|")}`;
}

function contentTokens(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, "").split(/\W+/).filter((token) => token.length > 1);
}

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function renderReport(result) {
  return `# Preservation Pair Mining Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit mines same-label non-final judged candidates as preservation/equivalence pairs for balanced grounded-QA post-training.

## Summary

- Preservation pairs: ${result.summary.preservation_pairs}
- Exact duplicate preservation pairs excluded: ${result.summary.exact_duplicate_preservation_pairs}
- Examples with preservation pairs: ${result.summary.examples_with_preservation_pairs}
- Supported-answer pairs: ${result.summary.supported_answer_pairs}
- Supported-abstention pairs: ${result.summary.supported_abstention_pairs}
- Unsupported-answer pairs: ${result.summary.unsupported_answer_pairs}
- Train-window preservation pairs: ${result.summary.train_window_pairs}
- Validation-window preservation pairs: ${result.summary.validation_window_pairs}

## Decision

- Build balanced packet next: ${result.decision.build_balanced_packet_next ? "yes" : "no"}
- Promote selector now: ${result.decision.promote_selector_now ? "yes" : "no"}
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
