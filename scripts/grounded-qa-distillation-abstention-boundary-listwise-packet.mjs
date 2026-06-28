import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const runId = "abstention-boundary-listwise-packet-160-320-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const windows = [
  {
    window: "160-240",
    source_index_offset: 160,
    direct_run_id: "citation-contract-repair-direct-mini-extended-future-holdout-160-240-v1",
    gate_run_id: "risk-gate-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1",
    direct_judge_run_id: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-160-240-v1",
    gate_judge_run_id: "openai-judge-gpt4o-risk-gate-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1",
  },
  {
    window: "240-320",
    source_index_offset: 240,
    direct_run_id: "citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
    gate_run_id: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
    direct_judge_run_id: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
    gate_judge_run_id: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  },
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const pairs = [];
for (const spec of windows) {
  const directRows = byId(await readJsonl(path.join(runsDir, spec.direct_run_id, "predictions.jsonl")));
  const gateRows = byId(await readJsonl(path.join(runsDir, spec.gate_run_id, "predictions.jsonl")));
  const directJudgments = byId(await readJsonl(path.join(runsDir, spec.direct_judge_run_id, "judgments.jsonl")));
  const gateJudgments = byId(await readJsonl(path.join(runsDir, spec.gate_judge_run_id, "judgments.jsonl")));
  const ids = [...directRows.keys()].filter((id) => gateRows.has(id));
  for (const [index, exampleId] of ids.entries()) {
    const direct = directRows.get(exampleId);
    const gate = gateRows.get(exampleId);
    const directPrediction = direct.prediction;
    const gatePrediction = gate.prediction;
    if (directPrediction?.answer_type === gatePrediction?.answer_type) continue;
    const directJudge = directJudgments.get(exampleId);
    const gateJudge = gateJudgments.get(exampleId);
    const directSupportedAnswer = isSupportedAnswer(directJudge);
    const directUnsupportedAnswer = directPrediction?.answer_type === "grounded_answer" && !directSupportedAnswer;
    const gateSupportedAbstention = isSupportedAbstention(gateJudge);
    const gateUnsupportedAbstention = gatePrediction?.answer_type === "abstain" && !gateSupportedAbstention;
    let chosenRole = null;
    let contrastType = null;
    if (directSupportedAnswer && gateUnsupportedAbstention) {
      chosenRole = "direct";
      contrastType = "prefer_supported_answer_over_unsupported_abstention";
    } else if (directUnsupportedAnswer && gateSupportedAbstention) {
      chosenRole = "gate";
      contrastType = "prefer_supported_abstention_over_unsupported_answer";
    } else if (directSupportedAnswer && gateSupportedAbstention) {
      chosenRole = "direct";
      contrastType = "both_supported_answer_preferred_for_coverage";
    } else if (directUnsupportedAnswer && gateUnsupportedAbstention) {
      chosenRole = "gate";
      contrastType = "both_unsupported_prefer_abstention_safety";
    } else {
      continue;
    }
    const chosen = chosenRole === "direct"
      ? candidateFromPrediction("direct_answer", spec.direct_run_id, directPrediction, directJudge)
      : candidateFromPrediction("risk_gate_abstention", spec.gate_run_id, gatePrediction, gateJudge);
    const rejected = chosenRole === "direct"
      ? candidateFromPrediction("risk_gate_abstention", spec.gate_run_id, gatePrediction, gateJudge)
      : candidateFromPrediction("direct_answer", spec.direct_run_id, directPrediction, directJudge);
    pairs.push({
      pair_id: `${spec.window}:${exampleId}:abstention-boundary:${chosen.id}:over:${rejected.id}`,
      example_id: exampleId,
      split: "extended_temporal_future_holdout",
      source_index: spec.source_index_offset + index,
      window: spec.window,
      source: "abstention_boundary_listwise_packet",
      contrast_type: contrastType,
      training_use: "nonfinal_abstention_boundary_listwise_supervision",
      input: inputFromRow(direct),
      chosen,
      rejected,
      labels: {
        chosen_role: chosenRole,
        direct_supported_answer: directSupportedAnswer,
        direct_unsupported_answer: directUnsupportedAnswer,
        gate_supported_abstention: gateSupportedAbstention,
        gate_unsupported_abstention: gateUnsupportedAbstention,
      },
    });
  }
}

const trainPairs = pairs.filter((row) => Number(row.source_index) < 240);
const validationPairs = pairs.filter((row) => Number(row.source_index) >= 240 && Number(row.source_index) < 321);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "abstention_boundary_listwise_packet",
  status: pairs.length >= 25 ? "abstention_boundary_packet_ready_for_listwise_audit" : "abstention_boundary_packet_sparse",
  purpose: "Mine existing judged direct-vs-risk-gate non-final disagreements into explicit answer/abstain listwise supervision before selector training.",
  source_windows: windows,
  examples: {
    boundary_pairs: pairs.length,
    train_pairs: trainPairs.length,
    validation_pairs: validationPairs.length,
    unique_examples: new Set(pairs.map((row) => row.example_id)).size,
  },
  contrast_counts: countBy(pairs, (row) => row.contrast_type),
  decision: {
    merge_into_listwise_packet_now: pairs.length >= 25,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Rerun the listwise supervision audit with this abstention-boundary packet included.",
    reason: "The packet converts already-paid direct/risk-gate judgments into answer/abstain boundary supervision without new model calls.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    windows_used: windows.map((row) => row.window),
    max_source_index: Math.max(...pairs.map((row) => Number(row.source_index))),
    paid_judgments_already_ledgered: true,
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
    note: "Zero-call mining over existing paid gpt-4o judgment artifacts.",
  },
  artifacts: {
    boundary_pairs_jsonl: rel(path.join(outputDir, "boundary_pairs.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "boundary_pairs.jsonl"), pairs);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  examples: result.examples,
  contrast_counts: result.contrast_counts,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function candidateFromPrediction(id, runIdValue, prediction, judgmentRow) {
  return {
    id,
    family: id === "direct_answer" ? "openai_mini_scaffold" : "support_risk_gate",
    prediction_run_id: runIdValue,
    answer_type: prediction.answer_type,
    answer: prediction.answer ?? "",
    citations: prediction.citations ?? [],
    claim_table: prediction.claim_table ?? [],
    abstention_reason: prediction.abstention_reason ?? null,
    judgment: judgmentRow?.judgment ?? null,
  };
}

function inputFromRow(row) {
  return row.input ?? row.prompt?.input ?? {
    question: row.question,
    compact_retrieved_evidence_pack: row.compact_retrieved_evidence_pack,
    document_metadata: row.document_metadata,
  };
}

function isSupportedAnswer(row) {
  const judgment = row?.judgment ?? {};
  return judgment.verdict === "supported" || judgment.all_claims_supported === true;
}

function isSupportedAbstention(row) {
  const judgment = row?.judgment ?? {};
  return judgment.verdict === "correct_abstention" || judgment.abstention_supported === true;
}

function byId(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
}

function countBy(rows, fn) {
  const counts = {};
  for (const row of rows) {
    const key = fn(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function renderReport(result) {
  return `# Abstention Boundary Listwise Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

This packet makes no OpenAI calls and launches no compute.

## Examples

- Boundary pairs: ${result.examples.boundary_pairs}
- Train pairs: ${result.examples.train_pairs}
- Validation pairs: ${result.examples.validation_pairs}
- Unique examples: ${result.examples.unique_examples}

## Contrast Counts

${Object.entries(result.contrast_counts).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

## Decision

- Merge into listwise packet now: ${result.decision.merge_into_listwise_packet_now ? "yes" : "no"}
- Buy OpenAI labels now: no
- Launch GPU now: no
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  return (await fs.readFile(file, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}
