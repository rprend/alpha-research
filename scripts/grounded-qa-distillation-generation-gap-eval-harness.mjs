import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "generation-gap-curriculum-packet-d320-final-gaps-2026-06-28-v1";
const predictionFileArg = args["prediction-file"] ?? null;
const runId = args["run-id"] ?? "generation-gap-eval-harness-d321-fixture-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const packetDir = path.join(runsDir, packetRunId);
const datasetDir = path.join(packetDir, "dataset");
const packetResult = await readJson(path.join(packetDir, "result.json"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(datasetDir, "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(datasetDir, "eval_targets_diagnostic.jsonl"));
const targetById = new Map(targets.map((row) => [row.example_id, row]));
const predictionMode = predictionFileArg ? "external_predictions" : "oracle_fixture";
const predictions = predictionFileArg
  ? await readPredictions(path.resolve(rootDir, predictionFileArg))
  : targets.map((row) => ({ example_id: row.example_id, prediction: row.target, raw_output: JSON.stringify(row.target), fixture_source: "diagnostic_target" }));
const predictionById = new Map(predictions.map((row) => [row.example_id, row]));
const scoredRows = prompts.map((prompt) => scorePrompt(prompt, predictionById.get(prompt.example_id), targetById.get(prompt.example_id)));
const metrics = summarize(scoredRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "generation_gap_eval_harness",
  status: deriveStatus(predictionMode, metrics),
  purpose: "Fix the D321 generation-gap evaluation contract before spending on a local/Prime model preflight: parse generated JSON, enforce citation/abstention shape, and score against final diagnostic targets without using those targets for training.",
  packet_run_id: packetRunId,
  prediction_mode: predictionMode,
  prediction_file: predictionFileArg,
  eval_contract: {
    input_prompts: "dataset/eval_prompts.jsonl",
    diagnostic_targets: "dataset/eval_targets_diagnostic.jsonl",
    prediction_schema: {
      example_id: "string",
      prediction: {
        answer_type: "grounded_answer|abstain",
        answer: "string",
        citations: "array of evidence ids",
        claim_table: "array",
        abstention_reason: "string|null",
      },
      raw_output: "optional string",
    },
    primary_metrics: [
      "parseable_rate",
      "answer_type_accuracy",
      "answerable_supported_shape_rate",
      "abstention_shape_rate",
      "citation_set_exact_rate",
      "mean_answer_token_f1",
      "overall_shape_correct_rate",
    ],
    promotion_floor_for_future_model: {
      examples: 10,
      min_answerable_supported_shape_rate: 0.7,
      min_abstention_shape_rate: 1,
      min_overall_shape_correct_rate: 0.8,
      note: "This floor is a pre-judge shape gate only; passing it does not replace paid or human grounded-correctness adjudication.",
    },
  },
  source_packet: {
    status: packetResult.status,
    final_gap_summary: packetResult.final_gap_summary,
    leakage_guard: packetResult.leakage_guard,
  },
  metrics,
  decision: {
    eval_harness_fixed: metrics.examples === 10 && metrics.targets_available === 10,
    fixture_passed: predictionMode === "oracle_fixture" && metrics.overall_shape_correct_rate === 1,
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    next_step: "Run a bounded local or Prime model preflight that writes predictions in this schema, then run this harness before any paid grounded-correctness judging.",
    reason: "The harness is now fixed and fixture-validated, but no actual generation model has been run on the D321 prompts in this artifact.",
  },
  leakage_guard: {
    final_targets_used_for_training: false,
    final_targets_used_for_model_selection: false,
    diagnostic_targets_used_for_fixture_scoring: predictionMode === "oracle_fixture",
    model_predictions_present: predictionMode === "external_predictions",
    training_use: "forbidden_final_window_diagnostic_only",
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
    note: "This harness reads local prompt/target/prediction files only.",
  },
};

await writeJsonl(path.join(outputDir, "scored_predictions.jsonl"), scoredRows);
await writeJsonl(path.join(outputDir, "prediction_template.jsonl"), prompts.map(predictionTemplate));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  prediction_mode: result.prediction_mode,
  metrics: result.metrics,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function scorePrompt(prompt, predictionRow, targetRow) {
  const evidenceIds = new Set((prompt.input.compact_retrieved_evidence_pack ?? []).map((row) => row.evidence_id));
  const target = targetRow?.target ?? null;
  const parsed = normalizePrediction(predictionRow?.prediction ?? predictionRow?.output ?? predictionRow?.target ?? predictionRow?.raw_output);
  const prediction = parsed.prediction;
  const targetCitations = normalizeCitations(target?.citations ?? []);
  const predictionCitations = normalizeCitations(prediction?.citations ?? []);
  const validCitations = predictionCitations.filter((id) => evidenceIds.has(id));
  const answerTypeCorrect = Boolean(prediction && target && prediction.answer_type === target.answer_type);
  const citationSetExact = target?.answer_type === "grounded_answer"
    ? setEqual(new Set(predictionCitations), new Set(targetCitations))
    : predictionCitations.length === 0;
  const inlineCitationComplete = prediction?.answer_type === "grounded_answer"
    ? predictionCitations.every((id) => String(prediction.answer ?? "").includes(`[${id}]`))
    : true;
  const answerTokenF1 = target?.answer_type === "grounded_answer" && prediction?.answer_type === "grounded_answer"
    ? tokenF1(prediction.answer, target.answer)
    : null;
  const answerableSupportedShape = target?.answer_type === "grounded_answer"
    && prediction?.answer_type === "grounded_answer"
    && predictionCitations.length > 0
    && validCitations.length === predictionCitations.length
    && inlineCitationComplete
    && Number(answerTokenF1 ?? 0) >= 0.35;
  const abstentionShape = target?.answer_type === "abstain"
    && prediction?.answer_type === "abstain"
    && predictionCitations.length === 0
    && /insufficient|not enough|does not contain|cannot answer/i.test(String(prediction.answer ?? prediction.abstention_reason ?? ""));
  return {
    example_id: prompt.example_id,
    target_answer_type: target?.answer_type ?? null,
    prediction_answer_type: prediction?.answer_type ?? null,
    parseable: parsed.ok,
    parse_error: parsed.error,
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    inline_citation_complete: inlineCitationComplete,
    valid_citation_rate: predictionCitations.length ? validCitations.length / predictionCitations.length : 1,
    answer_token_f1: answerTokenF1,
    answerable_supported_shape: answerableSupportedShape,
    abstention_shape: abstentionShape,
    shape_correct: target?.answer_type === "grounded_answer" ? answerableSupportedShape : abstentionShape,
    target_citations: targetCitations,
    prediction_citations: predictionCitations,
    prediction,
    target,
  };
}

function summarize(rows) {
  const answerable = rows.filter((row) => row.target_answer_type === "grounded_answer");
  const abstain = rows.filter((row) => row.target_answer_type === "abstain");
  const parseable = rows.filter((row) => row.parseable).length;
  const answerTypeCorrect = rows.filter((row) => row.answer_type_correct).length;
  const citationExact = rows.filter((row) => row.citation_set_exact).length;
  const shapeCorrect = rows.filter((row) => row.shape_correct).length;
  return {
    examples: rows.length,
    targets_available: rows.filter((row) => row.target).length,
    answerable_examples: answerable.length,
    abstention_examples: abstain.length,
    parseable_predictions: parseable,
    parseable_rate: rate(parseable, rows.length),
    answer_type_accuracy: rate(answerTypeCorrect, rows.length),
    answerable_supported_shape_rate: rate(answerable.filter((row) => row.answerable_supported_shape).length, answerable.length),
    abstention_shape_rate: rate(abstain.filter((row) => row.abstention_shape).length, abstain.length),
    citation_set_exact_rate: rate(citationExact, rows.length),
    mean_answer_token_f1: mean(answerable.map((row) => row.answer_token_f1).filter(Number.isFinite)),
    overall_shape_correct_rate: rate(shapeCorrect, rows.length),
  };
}

function deriveStatus(predictionMode, metrics) {
  if (metrics.examples !== 10 || metrics.targets_available !== 10) return "eval_harness_missing_expected_prompts_or_targets";
  if (predictionMode === "oracle_fixture" && metrics.overall_shape_correct_rate === 1) return "eval_harness_fixture_passed_ready_for_model_predictions";
  if (predictionMode === "external_predictions" && metrics.overall_shape_correct_rate >= 0.8 && metrics.abstention_shape_rate === 1) return "model_predictions_pass_shape_gate_needs_grounded_judge";
  if (predictionMode === "external_predictions") return "model_predictions_fail_shape_gate";
  return "eval_harness_fixture_failed";
}

function predictionTemplate(prompt) {
  return {
    example_id: prompt.example_id,
    prediction: {
      answer_type: "grounded_answer",
      answer: "Answer with inline citations such as [E1].",
      citations: ["E1"],
      claim_table: [{ claim: "Claim text.", support: "supported", citations: ["E1"] }],
      abstention_reason: null,
    },
    raw_output: null,
  };
}

function normalizePrediction(value) {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      return { ok: false, error: error.message, prediction: null };
    }
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "prediction is not an object", prediction: null };
  const answerType = parsed.answer_type;
  if (!["grounded_answer", "abstain"].includes(answerType)) return { ok: false, error: "invalid answer_type", prediction: parsed };
  return {
    ok: true,
    error: null,
    prediction: {
      answer_type: answerType,
      answer: String(parsed.answer ?? ""),
      citations: normalizeCitations(parsed.citations ?? []),
      claim_table: Array.isArray(parsed.claim_table) ? parsed.claim_table : [],
      abstention_reason: parsed.abstention_reason ?? null,
    },
  };
}

function normalizeCitations(citations) {
  return citations.map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean);
}

function tokenF1(left, right) {
  const leftTokens = contentTokens(left);
  const rightTokens = contentTokens(right);
  if (!leftTokens.length || !rightTokens.length) return 0;
  const rightCounts = new Map();
  for (const token of rightTokens) rightCounts.set(token, (rightCounts.get(token) ?? 0) + 1);
  let overlap = 0;
  for (const token of leftTokens) {
    const count = rightCounts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      rightCounts.set(token, count - 1);
    }
  }
  const precision = overlap / leftTokens.length;
  const recall = overlap / rightTokens.length;
  return precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
}

function contentTokens(text) {
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").split(/[^a-z0-9.]+/).filter((token) => token.length > 1);
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

async function readPredictions(file) {
  const rows = await readJsonl(file);
  return rows.map((row) => ({ ...row, prediction: row.prediction ?? row.output ?? row.target ?? row }));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function renderReport(result) {
  return `# Generation Gap Eval Harness

Status: \`${result.status}\`

Prediction mode: \`${result.prediction_mode}\`

This run makes no OpenAI calls and launches no Prime job.

## Metrics

| Examples | Parseable | Answer type accuracy | Answerable supported shape | Abstention shape | Citation exact | Mean answer F1 | Overall shape correct |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.metrics.examples} | ${pct(result.metrics.parseable_rate)} | ${pct(result.metrics.answer_type_accuracy)} | ${pct(result.metrics.answerable_supported_shape_rate)} | ${pct(result.metrics.abstention_shape_rate)} | ${pct(result.metrics.citation_set_exact_rate)} | ${pct(result.metrics.mean_answer_token_f1)} | ${pct(result.metrics.overall_shape_correct_rate)} |

## Decision

- Eval harness fixed: ${result.decision.eval_harness_fixed ? "yes" : "no"}
- Fixture passed: ${result.decision.fixture_passed ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
