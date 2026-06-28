import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "oracle-gap-repair-audit-qwen7b-v4-v10-2026-06-28-v1";
const postmortemRunId = args["postmortem-run-id"] ?? "qwen7b-v10-postmortem-audit-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const sourcePredictionRuns = [
  "joint-action-qwen7b-v4-smoke-eval-v1-citation-repair",
  "joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair",
  "joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair",
  "joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair",
  "joint-action-qwen7b-repair-regeneration-focused-smoke-eval-v8",
  "joint-action-qwen7b-span-claim-construction-smoke-eval-v9-citation-repair",
  "joint-action-qwen7b-answer-completion-repair-smoke-eval-v10-citation-repair",
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const postmortem = await readJson(path.join(runsDir, postmortemRunId, "result.json"));
const gapIds = new Set(postmortem.coverage_gap_summary?.answerable_without_supported_candidate_ids ?? []);
const references = await readJsonl(path.join(experimentDir, "data", "extended_temporal_future_holdout.jsonl"));
const predictionsByRun = {};
for (const runId of sourcePredictionRuns) {
  predictionsByRun[runId] = new Map((await readJsonl(path.join(runsDir, runId, "predictions.jsonl"))).map((row) => [row.example_id, row]));
}

const rows = references
  .filter((row) => gapIds.has(row.example_id))
  .map((example) => analyzeGapRow(example));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "oracle_gap_repair_audit",
  status: deriveStatus(rows),
  scope: {
    split: "extended_temporal_future_holdout",
    source_postmortem_run_id: postmortemRunId,
    source_prediction_runs: sourcePredictionRuns,
    examples: rows.length,
  },
  summary: summarizeRows(rows),
  rows,
  training_implication: deriveTrainingImplication(rows),
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit reads held-out references and existing Qwen predictions only; it makes no model calls and launches no compute.",
  },
};

await writeJsonl(path.join(outputDir, "rows.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  examples: result.scope.examples,
  summary: result.summary,
  next_data_change: result.training_implication.next_data_change,
}, null, 2));

function analyzeGapRow(example) {
  const reference = normalizeReference(example.output);
  const evidence = example.input.compact_retrieved_evidence_pack ?? [];
  const goldEvidence = evidence.filter((item) => reference.citations.includes(item.evidence_id));
  const bestAnySpan = bestEvidenceSpan(reference.answer, evidence);
  const bestGoldSpan = bestEvidenceSpan(reference.answer, goldEvidence.length ? goldEvidence : evidence);
  const qwenAttempts = sourcePredictionRuns.map((runId) => {
    const prediction = predictionsByRun[runId].get(example.example_id)?.prediction ?? {};
    return {
      run_id: runId,
      answer_type: prediction.answer_type ?? null,
      answered: prediction.answer_type === "grounded_answer",
      answer_preview: preview(prediction.answer ?? ""),
      citations: normalizeCitations(prediction.citations),
      token_f1_vs_reference: tokenF1(prediction.answer ?? "", reference.answer),
    };
  });
  const buckets = classifyGap({ example, reference, evidence, bestGoldSpan, bestAnySpan, qwenAttempts });
  return {
    example_id: example.example_id,
    paper_id: example.input.document_metadata.paper_id,
    question: example.input.question,
    reference_answer: reference.answer,
    reference_citations: reference.citations,
    evidence_count: evidence.length,
    gold_evidence_count: goldEvidence.length,
    best_gold_span: bestGoldSpan,
    best_any_evidence_span: bestAnySpan,
    qwen_attempts_answered: qwenAttempts.filter((row) => row.answered).length,
    best_qwen_attempt_f1: Math.max(0, ...qwenAttempts.map((row) => row.token_f1_vs_reference)),
    buckets,
    qwen_attempts: qwenAttempts,
    recommended_signal: recommendedSignal({ buckets, bestGoldSpan, bestAnySpan }),
  };
}

function classifyGap({ example, reference, evidence, bestGoldSpan, bestAnySpan, qwenAttempts }) {
  const text = [reference.answer, ...evidence.map((item) => item.text ?? "")].join(" ").toLowerCase();
  const buckets = [];
  if (bestGoldSpan.token_f1 >= 0.6) buckets.push("high_recoverability_single_evidence_span");
  else if (bestGoldSpan.token_f1 >= 0.35) buckets.push("partial_recoverability_single_evidence_span");
  else buckets.push("low_recoverability_from_gold_evidence_text");
  if (bestAnySpan.token_f1 > bestGoldSpan.token_f1 + 0.15) buckets.push("non_gold_evidence_has_better_lexical_span");
  if ((reference.citations ?? []).length > 1) buckets.push("multi_evidence_reference_answer");
  if (/\btable|tabref|figure|fig\.|metric|score|accuracy|f1|percent|percentage|ratio|correlation|baseline\b/i.test(text) || /\d/.test(reference.answer)) {
    buckets.push("table_metric_or_numeric_answer");
  }
  if (/\bwhy|how|what factors|what aspects|in what way\b/i.test(example.input.question)) buckets.push("explanatory_or_synthesis_question");
  if (qwenAttempts.some((row) => row.answered && row.token_f1_vs_reference >= 0.25)) buckets.push("qwen_attempt_contains_partial_answer");
  if (!qwenAttempts.some((row) => row.answered)) buckets.push("all_qwen_policies_abstained");
  return [...new Set(buckets)];
}

function recommendedSignal({ buckets, bestGoldSpan, bestAnySpan }) {
  if (buckets.includes("high_recoverability_single_evidence_span")) {
    return "Add extractive answer-span planning targets for this row family before free-form generation.";
  }
  if (buckets.includes("table_metric_or_numeric_answer")) {
    return "Add table/metric normalization targets with exact numeric span copying and citation checks.";
  }
  if (buckets.includes("multi_evidence_reference_answer") || buckets.includes("explanatory_or_synthesis_question")) {
    return "Add structured claim-table planning targets that compose multiple cited evidence snippets before answer generation.";
  }
  if (bestAnySpan.token_f1 < 0.35) {
    return "Audit retrieval/evidence packing; the compact pack may not expose a lexical answer span cleanly enough for small-model repair.";
  }
  return "Add question-conditioned answer planning with hard negatives from plausible but wrong evidence spans.";
}

function summarizeRows(rows) {
  const bucketCounts = counts(rows.flatMap((row) => row.buckets));
  const high = rows.filter((row) => row.best_gold_span.token_f1 >= 0.6).length;
  const partial = rows.filter((row) => row.best_gold_span.token_f1 >= 0.35 && row.best_gold_span.token_f1 < 0.6).length;
  const low = rows.filter((row) => row.best_gold_span.token_f1 < 0.35).length;
  return {
    examples: rows.length,
    high_recoverability_rows: high,
    partial_recoverability_rows: partial,
    low_recoverability_rows: low,
    qwen_partial_attempt_rows: rows.filter((row) => row.best_qwen_attempt_f1 >= 0.25).length,
    all_qwen_policies_abstained_rows: rows.filter((row) => row.buckets.includes("all_qwen_policies_abstained")).length,
    bucket_counts: bucketCounts,
  };
}

function deriveStatus(rows) {
  const summary = summarizeRows(rows);
  if (summary.high_recoverability_rows >= Math.ceil(rows.length / 2)) return "oracle_gap_mostly_span_recoverable";
  if ((summary.high_recoverability_rows + summary.partial_recoverability_rows) >= Math.ceil(rows.length / 2)) return "oracle_gap_partly_recoverable_with_planning";
  return "oracle_gap_needs_retrieval_or_complex_reasoning_change";
}

function deriveTrainingImplication(rows) {
  const summary = summarizeRows(rows);
  const next = summary.high_recoverability_rows >= 5
    ? "Build an extractive span-planning curriculum for the oracle-gap rows before another LoRA run."
    : "Build a mixed repair curriculum that separates extractive rows from table/metric and multi-evidence synthesis rows before another LoRA run.";
  return {
    gpu_launch_ready: false,
    reason: "The audit is diagnostic only; it identifies target families but does not yet materialize a leakage-safe train packet or prove new supported candidate generation.",
    next_data_change: next,
    required_before_gpu: [
      "Materialize training-only analogs of these gap families without using final-window labels for training.",
      "Add a packet validator that verifies span/table/claim planning targets and train/eval paper disjointness.",
      "Run a no-spend launch preflight and budget gate.",
    ],
  };
}

function bestEvidenceSpan(answer, evidenceRows) {
  const answerTokens = contentTokens(answer);
  let best = {
    evidence_id: null,
    token_f1: 0,
    text: "",
    start_token: 0,
    end_token: 0,
  };
  for (const evidence of evidenceRows) {
    const originalTokens = String(evidence.text ?? "").split(/\s+/).filter(Boolean);
    const normalized = originalTokens.map((token) => token.toLowerCase().replace(/[^a-z0-9.%-]+/g, "")).filter(Boolean);
    const maxLen = Math.min(40, Math.max(5, answerTokens.length + 8));
    for (let start = 0; start < normalized.length; start += 1) {
      for (let len = 3; len <= maxLen && start + len <= normalized.length; len += 1) {
        const spanTokens = normalized.slice(start, start + len);
        const score = tokenF1FromTokens(spanTokens, answerTokens);
        if (score > best.token_f1) {
          best = {
            evidence_id: evidence.evidence_id,
            token_f1: score,
            text: originalTokens.slice(start, start + len).join(" "),
            start_token: start,
            end_token: start + len,
          };
        }
      }
    }
  }
  return best;
}

function normalizeReference(output) {
  return {
    answer_type: output?.answer_type ?? null,
    answer: String(output?.answer ?? ""),
    citations: normalizeCitations(output?.citations),
  };
}

function normalizeCitations(citations) {
  if (!Array.isArray(citations)) return [];
  return citations.map((citation) => {
    if (typeof citation === "string") return citation;
    if (citation && typeof citation === "object") return citation.evidence_id ?? citation.id ?? citation.citation_id ?? "";
    return "";
  }).filter(Boolean);
}

function tokenF1(left, right) {
  return tokenF1FromTokens(contentTokens(left), contentTokens(right));
}

function tokenF1FromTokens(leftTokens, rightTokens) {
  if (!leftTokens.length || !rightTokens.length) return 0;
  const rightCounts = new Map();
  for (const token of rightTokens) rightCounts.set(token, (rightCounts.get(token) ?? 0) + 1);
  let overlap = 0;
  for (const token of leftTokens) {
    const count = rightCounts.get(token) ?? 0;
    if (count <= 0) continue;
    overlap += 1;
    rightCounts.set(token, count - 1);
  }
  if (!overlap) return 0;
  const precision = overlap / leftTokens.length;
  const recall = overlap / rightTokens.length;
  return (2 * precision * recall) / (precision + recall);
}

function contentTokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9.%-]+/)
    .filter((token) => token.length > 1);
}

function counts(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function renderReport(result) {
  const bucketRows = Object.entries(result.summary.bucket_counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([bucket, count]) => `| ${bucket} | ${count} |`)
    .join("\n");
  const rowLines = result.rows
    .map((row) => `| ${row.example_id} | ${row.best_gold_span.token_f1.toFixed(3)} | ${row.best_any_evidence_span.token_f1.toFixed(3)} | ${row.buckets.join(", ")} | ${row.recommended_signal} |`)
    .join("\n");
  return `# Oracle-Gap Repair Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Summary

| Examples | High recoverability | Partial recoverability | Low recoverability | Qwen partial attempts | All Qwen abstained |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.summary.examples} | ${result.summary.high_recoverability_rows} | ${result.summary.partial_recoverability_rows} | ${result.summary.low_recoverability_rows} | ${result.summary.qwen_partial_attempt_rows} | ${result.summary.all_qwen_policies_abstained_rows} |

## Bucket Counts

| Bucket | Count |
| --- | ---: |
${bucketRows}

## Rows

| Example | Gold span F1 | Any span F1 | Buckets | Recommended signal |
| --- | ---: | ---: | --- | --- |
${rowLines}

## Training Implication

GPU launch ready: ${result.training_implication.gpu_launch_ready ? "yes" : "no"}

${result.training_implication.reason}

Next data change: ${result.training_implication.next_data_change}

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

function preview(value) {
  const compact = String(value ?? "").replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : true;
  }
  return parsed;
}
