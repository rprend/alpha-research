import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const exportDir = path.join(experimentDir, "exports");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "pretrained-nli-verifier-combined-labels-240-389-v1";
const labelPrefix = args["label-prefix"] ?? "teacher-combined-mini-det-guard-future-holdout-240-389-v1";
const modelId = args.model ?? "cross-encoder/nli-distilroberta-base";
const pythonBin = args.python ?? process.env.PYTHON_BIN ?? "/Users/ryanprendergast/miniconda3/bin/python3";
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const rows = (await readJsonl(path.join(exportDir, `${labelPrefix}.verifier.jsonl`))).map(buildRow);
const answeredRows = rows.filter((row) => row.answer_type === "grounded_answer");
const scoresPath = path.join(outputDir, "nli-scores.jsonl");

const scoredRows = await scoreRows(answeredRows, scoresPath);
const scoredById = new Map(scoredRows.map((row) => [row.example_id, row]));
const enrichedRows = rows.map((row) => ({
  ...row,
  nli: scoredById.get(row.example_id)?.nli ?? null,
}));

const baselines = {
  balanced_gate: summarizePolicy(enrichedRows.map((row) => policyRow(row, {
    policy: "balanced_support_risk_gate",
    suppress: false,
    threshold: null,
  }))),
  combined_teacher: summarizePolicy(enrichedRows.map((row) => policyRow(row, {
    policy: "combined_mini_negative_det_guard_teacher",
    suppress: row.answer_type === "grounded_answer" && !row.combined_keep,
    threshold: null,
  }))),
};

const windows = [...new Set(enrichedRows.map((row) => row.window))].sort();
const predictions = [];
const folds = [];
for (const evalWindow of windows) {
  const trainRows = enrichedRows.filter((row) => row.window !== evalWindow && row.answer_type === "grounded_answer");
  const evalRows = enrichedRows.filter((row) => row.window === evalWindow);
  const threshold = tuneThreshold(trainRows);
  const foldPredictions = evalRows.map((row) => applyGate(row, threshold));
  predictions.push(...foldPredictions);
  folds.push({
    train_windows: windows.filter((window) => window !== evalWindow),
    eval_window: evalWindow,
    train_examples: trainRows.length,
    eval_examples: evalRows.length,
    threshold,
    train_classification: summarizeClassification(trainRows, threshold),
    eval_classification: summarizeClassification(evalRows.filter((row) => row.answer_type === "grounded_answer"), threshold),
    eval_policy_metrics: summarizePolicy(foldPredictions),
    score_distribution: summarizeScores(evalRows.filter((row) => row.answer_type === "grounded_answer")),
  });
}

const metrics = summarizePolicy(predictions);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  label_prefix: labelPrefix,
  scope: "cross-window pretrained NLI verifier over balanced-gate candidate answers on extended_temporal_future_holdout examples 241-389",
  llm_calls: 0,
  run_cost_usd: 0,
  model: {
    model_id: modelId,
    premise: "concatenated cited evidence text",
    hypotheses: "candidate answer plus individual claim-table claims",
    score: "minimum entailment probability across answer/claim hypotheses",
  },
  data_summary: summarizeData(enrichedRows),
  baselines,
  aggregate: {
    policy_metrics: metrics,
    classification: summarizeClassification(enrichedRows.filter((row) => row.answer_type === "grounded_answer"), null, predictions),
    delta_vs_balanced_gate: delta(metrics, baselines.balanced_gate),
    delta_vs_combined_teacher: delta(metrics, baselines.combined_teacher),
  },
  folds,
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), predictions);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(reportPath, renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  summary_report: path.relative(rootDir, reportPath),
  data_summary: result.data_summary,
  baselines: result.baselines,
  aggregate: result.aggregate,
}, null, 2));

async function scoreRows(answered, outputPath) {
  try {
    const existing = await readJsonl(outputPath);
    if (existing.length === answered.length) return existing;
  } catch {
    // Fall through and rescore.
  }

  const inputPath = path.join(outputDir, "nli-input.jsonl");
  await writeJsonl(inputPath, answered.map((row) => ({
    example_id: row.example_id,
    premise: truncate(row.cited_text, 3600),
    hypotheses: hypothesesFor(row).map((text) => truncate(text, 700)),
  })));

  const scorer = `
import json
import os
from pathlib import Path
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

model_id = ${JSON.stringify(modelId)}
input_path = Path(${JSON.stringify(inputPath)})
output_path = Path(${JSON.stringify(outputPath)})
tokenizer = AutoTokenizer.from_pretrained(model_id, use_fast=False)
model = AutoModelForSequenceClassification.from_pretrained(model_id)
model.eval()
id2label = {int(k): str(v).lower() for k, v in model.config.id2label.items()}
entailment_index = next((idx for idx, label in id2label.items() if "entail" in label), None)
contradiction_index = next((idx for idx, label in id2label.items() if "contrad" in label), None)
if entailment_index is None:
    raise SystemExit(f"No entailment label in {id2label}")
rows = [json.loads(line) for line in input_path.read_text().splitlines() if line.strip()]
with output_path.open("w") as out:
    for row in rows:
        premise = row["premise"]
        hypothesis_scores = []
        for hypothesis in row["hypotheses"]:
            encoded = tokenizer(premise, hypothesis, truncation=True, max_length=512, return_tensors="pt")
            with torch.no_grad():
                logits = model(**encoded).logits[0]
                probs = torch.softmax(logits, dim=-1).tolist()
            hypothesis_scores.append({
                "hypothesis": hypothesis,
                "entailment": float(probs[entailment_index]),
                "contradiction": float(probs[contradiction_index]) if contradiction_index is not None else None,
            })
        entailments = [item["entailment"] for item in hypothesis_scores]
        contradictions = [item["contradiction"] for item in hypothesis_scores if item["contradiction"] is not None]
        out.write(json.dumps({
            "example_id": row["example_id"],
            "nli": {
                "entailment_min": min(entailments) if entailments else 0.0,
                "entailment_mean": sum(entailments) / len(entailments) if entailments else 0.0,
                "contradiction_max": max(contradictions) if contradictions else None,
                "hypotheses": hypothesis_scores,
            }
        }) + "\\n")
`;
  const scriptPath = path.join(outputDir, "score-nli.tmp.py");
  await fs.writeFile(scriptPath, scorer);
  const envPrefix = "PYTHONPATH=/tmp/groundedqa-hf-runtime HF_HOME=/tmp/groundedqa-hf-cache";
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync("bash", ["-lc", `${envPrefix} ${shellQuote(pythonBin)} ${shellQuote(scriptPath)}`], {
    stdio: "inherit",
    cwd: rootDir,
  });
  await fs.rm(scriptPath, { force: true });
  if (result.status !== 0) throw new Error(`NLI scoring failed with exit code ${result.status}`);
  return readJsonl(outputPath);
}

function buildRow(row) {
  const candidate = normalizePrediction(row.input.candidate_answer ?? {});
  const evidenceById = new Map((row.input.compact_retrieved_evidence_pack ?? []).map((evidence) => [evidence.evidence_id, evidence]));
  const citedText = candidate.citations.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  return {
    example_id: row.example_id,
    window: row.metadata.window,
    question: row.input.question,
    candidate,
    answer_type: candidate.answer_type,
    cited_text: citedText,
    support_score: Number(row.metadata.support_score ?? 0),
    strong_keep: row.output.label === "keep",
    combined_keep: row.output.combined_policy_action === "keep",
    strong_verdict: row.metadata.strong_verdict,
    mini_verdict: row.metadata.mini_verdict,
  };
}

function hypothesesFor(row) {
  const answer = stripCitations(row.candidate.answer);
  const claims = (row.candidate.claim_table ?? [])
    .map((claim) => stripCitations(`${claim.claim ?? ""} ${claim.support ?? ""}`.trim()))
    .filter(Boolean);
  return [...new Set([answer, ...claims].filter(Boolean))];
}

function tuneThreshold(trainRows) {
  const scores = trainRows.map((row) => score(row));
  const candidates = [...new Set([0.01, 0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, ...scores])].sort((a, b) => a - b);
  let best = null;
  for (const threshold of candidates) {
    const metrics = summarizePolicy(trainRows.map((row) => applyGate(row, threshold)));
    if (!best || better(metrics, best.metrics)) best = { threshold, metrics };
  }
  return best.threshold;
}

function better(left, right) {
  if (Math.abs(left.support_oracle_correct_rate - right.support_oracle_correct_rate) > 1e-12) {
    return left.support_oracle_correct_rate > right.support_oracle_correct_rate;
  }
  if (left.answered !== right.answered) return left.answered > right.answered;
  return left.answer_support_rate > right.answer_support_rate;
}

function applyGate(row, threshold) {
  if (row.answer_type !== "grounded_answer") {
    return policyRow(row, { policy: "pretrained_nli_verifier", suppress: false, threshold });
  }
  return policyRow(row, {
    policy: "pretrained_nli_verifier",
    suppress: score(row) < threshold,
    threshold,
  });
}

function policyRow(row, decision) {
  const suppress = row.answer_type === "grounded_answer" && decision.suppress;
  return {
    example_id: row.example_id,
    window: row.window,
    prediction: suppress ? abstainPrediction(row, decision.threshold) : row.candidate,
    source_prediction: row.candidate,
    metadata: {
      scaffold: decision.policy,
      nli_entailment_score: row.nli ? score(row) : null,
      threshold: decision.threshold,
      gate_fired: suppress,
      upstream_support_score: row.support_score,
    },
    labels: {
      strong_keep: row.strong_keep,
      combined_keep: row.combined_keep,
      strong_verdict: row.strong_verdict,
      mini_verdict: row.mini_verdict,
    },
    inherited_judgment: {
      support_oracle_correct: suppress ? !row.strong_keep : row.strong_keep,
      interpretation: suppress
        ? (row.strong_keep ? "harmful_suppression_supported_answer" : "suppressed_unsupported_answer")
        : "unchanged",
    },
  };
}

function abstainPrediction(row, threshold) {
  const reason = threshold == null
    ? "The verifier policy suppressed the generated answer."
    : `Pretrained NLI entailment score ${score(row).toFixed(3)} is below threshold ${threshold.toFixed(3)}.`;
  return {
    answer_type: "abstain",
    answer: "The cited evidence does not provide enough support for the generated claim.",
    citations: [],
    claim_table: [{
      claim: "A pretrained NLI verifier rejected the generated answer as insufficiently entailed by cited evidence.",
      support: "pretrained_nli_verifier",
      citations: [],
    }],
    abstention_reason: reason,
  };
}

function score(row) {
  return Number(row.nli?.entailment_min ?? 0);
}

function summarizePolicy(predictions) {
  const answered = predictions.filter((row) => row.prediction.answer_type === "grounded_answer");
  const correct = predictions.filter((row) => row.inherited_judgment.support_oracle_correct);
  const supportedAnswers = answered.filter((row) => row.labels.strong_keep);
  const suppressions = predictions.filter((row) => row.metadata.gate_fired);
  return {
    examples: predictions.length,
    answered: answered.length,
    abstained: predictions.length - answered.length,
    answer_rate: predictions.length ? answered.length / predictions.length : 0,
    support_oracle_correct: correct.length,
    support_oracle_correct_rate: predictions.length ? correct.length / predictions.length : 0,
    answer_support_rate: answered.length ? supportedAnswers.length / answered.length : 0,
    gate_fired: suppressions.length,
    suppressed_unsupported: suppressions.filter((row) => row.inherited_judgment.interpretation === "suppressed_unsupported_answer").length,
    harmful_suppressed_supported: suppressions.filter((row) => row.inherited_judgment.interpretation === "harmful_suppression_supported_answer").length,
  };
}

function summarizeClassification(rows, threshold, precomputedPredictions = null) {
  const classified = precomputedPredictions
    ? precomputedPredictions.filter((row) => row.source_prediction.answer_type === "grounded_answer").map((prediction) => ({
      predicted_keep: !prediction.metadata.gate_fired,
      actual_keep: prediction.labels.strong_keep,
    }))
    : rows.map((row) => ({
      predicted_keep: score(row) >= threshold,
      actual_keep: row.strong_keep,
    }));
  const tp = classified.filter((row) => row.predicted_keep && row.actual_keep).length;
  const tn = classified.filter((row) => !row.predicted_keep && !row.actual_keep).length;
  const fp = classified.filter((row) => row.predicted_keep && !row.actual_keep).length;
  const fn = classified.filter((row) => !row.predicted_keep && row.actual_keep).length;
  return {
    examples: classified.length,
    accuracy: classified.length ? (tp + tn) / classified.length : 0,
    keep_precision: tp + fp ? tp / (tp + fp) : 0,
    keep_recall: tp + fn ? tp / (tp + fn) : 0,
    suppress_precision: tn + fn ? tn / (tn + fn) : 0,
    suppress_recall: tn + fp ? tn / (tn + fp) : 0,
    true_keep: tp,
    true_suppress: tn,
    false_keep: fp,
    false_suppress: fn,
  };
}

function summarizeScores(rows) {
  const scores = rows.map(score).sort((a, b) => a - b);
  return {
    min: scores[0] ?? 0,
    median: percentile(scores, 0.5),
    max: scores[scores.length - 1] ?? 0,
    supported_mean: mean(rows.filter((row) => row.strong_keep).map(score)),
    unsupported_mean: mean(rows.filter((row) => !row.strong_keep).map(score)),
  };
}

function summarizeData(rows) {
  const answered = rows.filter((row) => row.answer_type === "grounded_answer");
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: rows.length - answered.length,
    strong_keep: rows.filter((row) => row.strong_keep).length,
    strong_suppress: rows.filter((row) => !row.strong_keep).length,
    answered_strong_keep: answered.filter((row) => row.strong_keep).length,
    answered_strong_suppress: answered.filter((row) => !row.strong_keep).length,
  };
}

function delta(left, right) {
  return {
    answered_delta: left.answered - right.answered,
    support_oracle_correct_delta: left.support_oracle_correct - right.support_oracle_correct,
    support_oracle_correct_rate_delta: left.support_oracle_correct_rate - right.support_oracle_correct_rate,
    answer_support_rate_delta: left.answer_support_rate - right.answer_support_rate,
    gate_fired_delta: left.gate_fired - right.gate_fired,
  };
}

function renderReport(result) {
  const foldRows = result.folds.map((fold) => (
    `| ${fold.eval_window} | ${fold.threshold.toFixed(3)} | ${fold.eval_policy_metrics.support_oracle_correct} / ${fold.eval_policy_metrics.examples} (${pct(fold.eval_policy_metrics.support_oracle_correct_rate)}) | ${fold.eval_policy_metrics.answered} | ${pct(fold.eval_policy_metrics.answer_support_rate)} | ${fold.eval_policy_metrics.gate_fired} | ${fold.eval_policy_metrics.suppressed_unsupported} | ${fold.eval_policy_metrics.harmful_suppressed_supported} | ${pct(fold.eval_classification.suppress_recall)} | ${pct(fold.eval_classification.suppress_precision)} | ${fold.score_distribution.supported_mean.toFixed(3)} | ${fold.score_distribution.unsupported_mean.toFixed(3)} |`
  )).join("\n");
  return `# Pretrained NLI Verifier Over Combined Labels

Scope: ${result.scope}

This run makes no OpenAI calls. It uses \`${result.model.model_id}\` as a pretrained NLI cross-encoder over cited evidence and candidate answer/claim hypotheses, then tunes only a keep/suppress threshold on one future window and evaluates on the other.

## Data

| Examples | Answered | Abstained | Strong keep | Strong suppress | Answered keep | Answered suppress |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.data_summary.examples} | ${result.data_summary.answered} | ${result.data_summary.abstained} | ${result.data_summary.strong_keep} | ${result.data_summary.strong_suppress} | ${result.data_summary.answered_strong_keep} | ${result.data_summary.answered_strong_suppress} |

## Aggregate Policy Result

| Policy | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${policyReportRow("Balanced support-risk gate", result.baselines.balanced_gate)}
${policyReportRow("Combined teacher action", result.baselines.combined_teacher)}
${policyReportRow("Pretrained NLI verifier", result.aggregate.policy_metrics)}

## Delta

- Vs balanced gate: ${signed(result.aggregate.delta_vs_balanced_gate.support_oracle_correct_delta)} support-oracle rows (${signedPct(result.aggregate.delta_vs_balanced_gate.support_oracle_correct_rate_delta)}), ${signed(result.aggregate.delta_vs_balanced_gate.answered_delta)} answered rows.
- Vs combined teacher: ${signed(result.aggregate.delta_vs_combined_teacher.support_oracle_correct_delta)} support-oracle rows (${signedPct(result.aggregate.delta_vs_combined_teacher.support_oracle_correct_rate_delta)}), ${signed(result.aggregate.delta_vs_combined_teacher.answered_delta)} answered rows.

## Cross-Window Folds

| Eval window | Threshold | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions | Suppress recall | Suppress precision | Mean score supported | Mean score unsupported |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${foldRows}

## Interpretation

This tests whether an off-the-shelf entailment model supplies the missing claim/evidence signal that local lexical gates lacked. A useful result would suppress unsupported answers faster than supported answers and approach the combined teacher without per-query LLM verifier calls.
`;
}

function policyReportRow(label, metrics) {
  return `| ${label} | ${metrics.support_oracle_correct} / ${metrics.examples} (${pct(metrics.support_oracle_correct_rate)}) | ${metrics.answered} | ${pct(metrics.answer_support_rate)} | ${metrics.gate_fired} | ${metrics.suppressed_unsupported} | ${metrics.harmful_suppressed_supported} |`;
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : [...new Set(citations)],
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? "") : null,
  };
}

function stripCitations(value) {
  return String(value).replace(/\s*\[[^\]]+\]/g, "").trim();
}

function truncate(value, maxLength) {
  const text = String(value ?? "");
  return text.length <= maxLength ? text : text.slice(0, maxLength);
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[index];
}

function mean(values) {
  const numeric = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number);
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : 0;
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function signedPct(value) {
  const rendered = `${(Number(value) * 100).toFixed(1)}pp`;
  return value > 0 ? `+${rendered}` : rendered;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
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
