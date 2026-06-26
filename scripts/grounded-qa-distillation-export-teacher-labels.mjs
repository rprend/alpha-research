import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const exportDir = path.join(experimentDir, "exports");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "temporal_test";
const teacherRunIds = listArg(args["teacher-runs"]);
const judgeRunIds = listArg(args["judge-runs"]);
const extraCostRunIds = listArg(args["extra-cost-runs"]);
const outputPrefix = args["output-prefix"] ?? "teacher-repair-temporal-test-0-80-v1";
const baselineRunId = args["baseline-run"] ?? "openai-student-temporal-test-full-v1";
const demoRunId = args["demo-run"] ?? "openai-student-teacher-demo-temporal-test-80-120-v1";
const baselineSliceOffset = numberArg(args["baseline-slice-offset"], 80, { allowZero: true });
const baselineSliceLimit = optionalNumberArg(args["baseline-slice-limit"], 40);
const demoSliceOffset = numberArg(args["demo-slice-offset"], 0, { allowZero: true });
const demoSliceLimit = optionalNumberArg(args["demo-slice-limit"], null);

if (!teacherRunIds.length) throw new Error("Missing --teacher-runs=<run-id[,run-id...]>");
if (!judgeRunIds.length) throw new Error("Missing --judge-runs=<run-id[,run-id...]>");

await fs.mkdir(exportDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const sourceExamples = await readJsonl(path.join(exportDir, `${split}.sft.jsonl`));
const sourceById = new Map(sourceExamples.map((row) => [row.example_id, row]));
const references = await readJsonl(path.join(experimentDir, "data", `${split}.jsonl`));
const referencesById = new Map(references.map((row) => [row.example_id, row]));
const judgmentsById = await loadJudgments(judgeRunIds);
const teacherRows = await loadTeacherRows(teacherRunIds);
const accepted = [];
const rejected = [];

for (const row of teacherRows) {
  const source = sourceById.get(row.example_id);
  const reference = referencesById.get(row.example_id);
  const judgment = judgmentsById.get(row.example_id);
  if (!source || !reference || !judgment) {
    rejected.push(rejection(row, judgment, "missing_source_or_judgment"));
    continue;
  }
  const prediction = normalizePrediction(row.prediction ?? {});
  const quality = qualityDecision(row, prediction, judgment);
  const label = {
    example_id: row.example_id,
    source_split: split,
    task: "citation_grounded_domain_qa_teacher_label_sft",
    label_source: {
      teacher_run_id: row.source_run_id,
      teacher_model: row.model ?? null,
      planner_model: row.planner_model ?? null,
      repair_model: row.repair_model ?? null,
      judge_run_id: judgment.judge_run_id,
      judge_model: judgment.model ?? null,
      judge_verdict: judgment.judgment?.verdict ?? null,
      quality_tier: quality.accepted ? "judge_accepted" : "judge_rejected",
    },
    messages: [
      source.messages[0],
      source.messages[1],
      { role: "assistant", content: JSON.stringify(prediction) },
    ],
    input: source.input,
    teacher_output: prediction,
    original_target: source.target,
    teacher_trace: {
      original_teacher_trace: reference.teacher_trace,
      judgment: judgment.judgment,
    },
  };
  if (quality.accepted) accepted.push(label);
  else rejected.push({ ...label, rejection_reason: quality.reason });
}

accepted.sort((a, b) => a.example_id.localeCompare(b.example_id));
rejected.sort((a, b) => a.example_id.localeCompare(b.example_id));

const acceptedPath = path.join(exportDir, `${outputPrefix}.sft.jsonl`);
const rejectedPath = path.join(exportDir, `${outputPrefix}.rejected.jsonl`);
const manifestPath = path.join(exportDir, `${outputPrefix}.manifest.json`);
const reportPath = path.join(reportDir, `${outputPrefix}.md`);

const teacherCost = await sumRunCosts([...teacherRunIds, ...extraCostRunIds]);
const judgeCost = await sumRunCosts(judgeRunIds);
const baselineCostPerCall = await costPerCall(baselineRunId, { sliceOffset: baselineSliceOffset, sliceLimit: baselineSliceLimit });
const demoCostPerCall = await costPerCall(demoRunId, { sliceOffset: demoSliceOffset, sliceLimit: demoSliceLimit });
const amortization = amortizationSummary({ teacherCost, judgeCost, baselineCostPerCall, demoCostPerCall });
const summary = {
  output_prefix: outputPrefix,
  generated_at: new Date().toISOString(),
  split,
  teacher_run_ids: teacherRunIds,
  judge_run_ids: judgeRunIds,
  extra_cost_run_ids: extraCostRunIds,
  examples_seen: teacherRows.length,
  accepted_labels: accepted.length,
  rejected_labels: rejected.length,
  acceptance_rate: ratio(accepted.length, teacherRows.length),
  accepted_answered: accepted.filter((row) => row.teacher_output.answer_type === "grounded_answer").length,
  accepted_abstained: accepted.filter((row) => row.teacher_output.answer_type === "abstain").length,
  rejected_answered: rejected.filter((row) => row.teacher_output?.answer_type === "grounded_answer").length,
  rejected_abstained: rejected.filter((row) => row.teacher_output?.answer_type === "abstain").length,
  teacher_cost_usd: teacherCost,
  judge_cost_usd: judgeCost,
  total_labeling_cost_usd: teacherCost + judgeCost,
  baseline_run_id: baselineRunId,
  demo_run_id: demoRunId,
  baseline_slice_offset: baselineSliceOffset,
  baseline_slice_limit: baselineSliceLimit,
  demo_slice_offset: demoSliceOffset,
  demo_slice_limit: demoSliceLimit,
  baseline_cost_per_call_usd: baselineCostPerCall,
  demo_cost_per_call_usd: demoCostPerCall,
  amortization,
  artifacts: {
    accepted_sft_jsonl: path.relative(rootDir, acceptedPath),
    rejected_jsonl: path.relative(rootDir, rejectedPath),
    manifest: path.relative(rootDir, manifestPath),
    report: path.relative(rootDir, reportPath),
  },
};

await writeJsonl(acceptedPath, accepted);
await writeJsonl(rejectedPath, rejected);
await fs.writeFile(manifestPath, `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(reportPath, renderReport(summary, accepted, rejected));

console.log(JSON.stringify(summary, null, 2));

async function loadTeacherRows(runIds) {
  const rows = [];
  for (const runId of runIds) {
    const fileRows = await readJsonl(path.join(runDir, runId, "predictions.jsonl"));
    for (const row of fileRows) {
      if (row.skipped) continue;
      rows.push({ ...row, source_run_id: runId });
    }
  }
  return rows;
}

async function loadJudgments(runIds) {
  const rowsById = new Map();
  for (const runId of runIds) {
    const rows = await readJsonl(path.join(runDir, runId, "judgments.jsonl"));
    for (const row of rows) {
      if (row.skipped) continue;
      rowsById.set(row.example_id, { ...row, judge_run_id: runId });
    }
  }
  return rowsById;
}

function qualityDecision(row, prediction, judgmentRow) {
  const judgment = judgmentRow.judgment ?? {};
  const acceptedAnswer = prediction.answer_type === "grounded_answer"
    && judgmentRow.prediction_answer_type === "grounded_answer"
    && judgment.verdict === "supported"
    && judgment.all_claims_supported === true
    && judgment.citation_ids_valid === true
    && prediction.citations.length > 0
    && prediction.citations.every((id) => prediction.answer.includes(`[${id}]`));
  const acceptedAbstention = prediction.answer_type === "abstain"
    && judgmentRow.prediction_answer_type === "abstain"
    && judgment.verdict === "correct_abstention"
    && judgment.abstention_supported === true
    && prediction.citations.length === 0;
  if (acceptedAnswer || acceptedAbstention) return { accepted: true, reason: "judge_accepted" };
  return {
    accepted: false,
    reason: [
      judgment.verdict ? `verdict=${judgment.verdict}` : "missing_verdict",
      prediction.answer_type === "grounded_answer" && !prediction.citations.every((id) => prediction.answer.includes(`[${id}]`))
        ? "missing_inline_citation"
        : null,
    ].filter(Boolean).join(";"),
  };
}

function rejection(row, judgment, reason) {
  return {
    example_id: row.example_id,
    source_run_id: row.source_run_id,
    teacher_output: normalizePrediction(row.prediction ?? {}),
    judgment: judgment?.judgment ?? null,
    rejection_reason: reason,
  };
}

async function sumRunCosts(runIds) {
  let total = 0;
  for (const runId of runIds) {
    const result = JSON.parse(await fs.readFile(path.join(runDir, runId, "result.json"), "utf8"));
    total += Number(result.run_cost_usd ?? result.summary?.run_cost_usd ?? 0);
  }
  return total;
}

async function costPerCall(runId, options = {}) {
  const rows = await readJsonl(path.join(runDir, runId, "predictions.jsonl"));
  const activeRows = rows.filter((row) => !row.skipped);
  const slice = options.sliceLimit != null
    ? activeRows.slice(options.sliceOffset ?? 0, (options.sliceOffset ?? 0) + options.sliceLimit)
    : activeRows;
  return ratio(sum(slice.map((row) => Number(row.cost_usd ?? 0))), slice.length);
}

function amortizationSummary({ teacherCost, judgeCost, baselineCostPerCall, demoCostPerCall }) {
  const labelCost = teacherCost + judgeCost;
  const demoPremium = demoCostPerCall - baselineCostPerCall;
  return {
    label_cost_usd: labelCost,
    direct_student_cost_per_query_usd: baselineCostPerCall,
    demo_scaffold_cost_per_query_usd: demoCostPerCall,
    demo_query_premium_usd: demoPremium,
    break_even_queries_vs_demo_scaffold: demoPremium > 0 ? Math.ceil(labelCost / demoPremium) : null,
    assumed_post_training_inference_cost_per_query_usd: baselineCostPerCall,
  };
}

function renderReport(summary, accepted, rejected) {
  return `# Teacher Label Export V1

## Setup

- Teacher runs: ${summary.teacher_run_ids.map((id) => `\`${id}\``).join(", ")}
- Judge runs: ${summary.judge_run_ids.map((id) => `\`${id}\``).join(", ")}
${summary.extra_cost_run_ids.length ? `- Extra upstream cost runs: ${summary.extra_cost_run_ids.map((id) => `\`${id}\``).join(", ")}` : "- Extra upstream cost runs: none"}
- Split: \`${summary.split}\`
- Accepted SFT labels: \`${summary.artifacts.accepted_sft_jsonl}\`
- Rejected audit rows: \`${summary.artifacts.rejected_jsonl}\`

## Label Quality

| Examples seen | Accepted | Rejected | Acceptance rate | Accepted answered | Accepted abstained |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${summary.examples_seen} | ${summary.accepted_labels} | ${summary.rejected_labels} | ${pct(summary.acceptance_rate)} | ${summary.accepted_answered} | ${summary.accepted_abstained} |

The quality filter accepts answered labels only when the judge marks every claim supported, citation ids valid, and every cited id appears inline in the answer. It accepts abstentions only when the judge marks the abstention supported and the label cites no evidence.

## Amortization

| Component | Cost |
| --- | ---: |
| Teacher/source runs, including extra upstream cost runs | $${summary.teacher_cost_usd.toFixed(7)} |
| Judge runs | $${summary.judge_cost_usd.toFixed(7)} |
| Total offline labeling | $${summary.total_labeling_cost_usd.toFixed(7)} |
| Direct mini student per query | $${summary.baseline_cost_per_call_usd.toFixed(7)} |
| Demo scaffold per query | $${summary.demo_cost_per_call_usd.toFixed(7)} |

The offline label packet breaks even against the in-context demo scaffold after about ${summary.amortization.break_even_queries_vs_demo_scaffold} future queries if post-training preserves the direct mini student's inference cost. This is an accounting result, not a quality result: the next experiment still needs to train or fit a compact student/filter on these labels and evaluate held-out grounded correctness.

## Rejections

${rejected.length ? rejected.map((row) => `- \`${row.example_id}\`: ${row.rejection_reason}`).join("\n") : "No rejected labels."}

## Decision Use

Use this export as candidate post-training data, not as a final benchmark score. The important next measurement is whether a student trained or filtered with these labels keeps the precision/support gains without carrying the demo scaffold's per-query token cost.
`;
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : citations,
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? "") : null,
  };
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function listArg(value) {
  if (value == null || value === "") return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function numberArg(value, fallback, options = {}) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (options.allowZero ? parsed < 0 : parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function optionalNumberArg(value, fallback) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [key, raw] = value.slice(2).split("=");
    parsed[key] = raw ?? "true";
  }
  return parsed;
}
