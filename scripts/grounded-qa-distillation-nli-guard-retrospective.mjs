import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "nli-det-guard-retrospective-160-240-v1";
const split = args.split ?? "extended_temporal_future_holdout";
const gateRun = args["gate-run"] ?? "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1";
const judgeRun = args["judge-run"] ?? "openai-judge-gpt4o-risk-gate-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1";
const modelId = args.model ?? "cross-encoder/nli-distilroberta-base";
const nliThreshold = Number(args["nli-threshold"] ?? 0.0065);
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);
const pythonBin = args.python ?? process.env.PYTHON_BIN ?? "/Users/ryanprendergast/miniconda3/bin/python3";
const comparativeTerms = [
  "best", "better", "worse", "worst", "outperform", "outperformed", "outperforms",
  "higher", "lower", "more", "less", "fewer", "larger", "smaller", "shorter", "longer",
  "improve", "improved", "improvement", "increase", "increased", "decrease", "decreased",
  "reduce", "reduced", "prefer", "preference", "highest", "lowest",
];
const quantifierTerms = ["all", "every", "only", "none", "always", "never", "total"];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const references = keyed(await readJsonl(path.join(dataDir, `${split}.jsonl`)));
const predictions = await readJsonl(path.join(runDir, gateRun, "predictions.jsonl"));
const judgments = keyed(await readJsonl(path.join(runDir, judgeRun, "judgments.jsonl")));

const rows = predictions.map((predictionRow) => buildRow(predictionRow, references.get(predictionRow.example_id), judgments.get(predictionRow.example_id)));
const answered = rows.filter((row) => row.answer_type === "grounded_answer");
const scored = await scoreRows(answered, path.join(outputDir, "nli-scores.jsonl"));
const scoredById = keyed(scored);
for (const row of rows) row.nli = scoredById.get(row.example_id)?.nli ?? null;

const policies = [
  { id: "balanced_gate", label: "Balanced support-risk gate", suppresses: () => false },
  { id: "deterministic_guard", label: "Deterministic claim-entailment guard", suppresses: (row) => row.det_fires },
  { id: "pretrained_nli_fixed", label: "Pretrained NLI fixed threshold", suppresses: (row) => row.answer_type === "grounded_answer" && nliScore(row) < nliThreshold },
  { id: "nli_or_det_guard_fixed", label: "NLI OR deterministic guard", suppresses: (row) => row.answer_type === "grounded_answer" && (row.det_fires || nliScore(row) < nliThreshold) },
  { id: "nli_and_det_guard_fixed", label: "NLI AND deterministic guard", suppresses: (row) => row.answer_type === "grounded_answer" && row.det_fires && nliScore(row) < nliThreshold },
];

const predictionsByPolicy = Object.fromEntries(policies.map((policy) => [
  policy.id,
  rows.map((row) => predictionFor(row, policy.id, policy.suppresses(row))),
]));
const policyResults = policies.map((policy) => ({
  id: policy.id,
  label: policy.label,
  metrics: summarize(predictionsByPolicy[policy.id]),
}));
const baseline = policyResults.find((policy) => policy.id === "balanced_gate").metrics;
for (const policy of policyResults) policy.delta_vs_balanced = delta(policy.metrics, baseline);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  scope: "retrospective fixed-threshold zero-LLM verifier check on extended_temporal_future_holdout examples 161-240",
  llm_calls: 0,
  run_cost_usd: 0,
  model: {
    model_id: modelId,
    nli_threshold: nliThreshold,
    threshold_source: "Mean of the two cross-window NLI thresholds from pretrained-nli-verifier-combined-labels-240-389-v1, rounded to 0.0065.",
  },
  source_runs: { gate_run: gateRun, judge_run: judgeRun },
  policies: policyResults,
  signal_summary: {
    nli_fires: rows.filter((row) => row.answer_type === "grounded_answer" && nliScore(row) < nliThreshold).length,
    det_fires: rows.filter((row) => row.det_fires).length,
    either_fires: rows.filter((row) => row.answer_type === "grounded_answer" && (row.det_fires || nliScore(row) < nliThreshold)).length,
    both_fire: rows.filter((row) => row.answer_type === "grounded_answer" && row.det_fires && nliScore(row) < nliThreshold).length,
  },
  fired_examples: rows
    .filter((row) => row.answer_type === "grounded_answer" && (row.det_fires || nliScore(row) < nliThreshold))
    .map(renderFiredExample),
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), Object.entries(predictionsByPolicy).flatMap(([policy, rows]) => rows.map((row) => ({ ...row, policy }))));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(reportPath, renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  summary_report: path.relative(rootDir, reportPath),
  model: result.model,
  policies: result.policies,
  signal_summary: result.signal_summary,
}, null, 2));

function buildRow(predictionRow, reference, judgmentRow) {
  if (!reference || !judgmentRow) throw new Error(`Missing reference or judgment for ${predictionRow.example_id}`);
  const prediction = normalizePrediction(predictionRow.prediction ?? {});
  const answerType = prediction.answer_type;
  const strongKeep = answerType === "grounded_answer" ? isSupportedAnswer(judgmentRow.judgment) : isCorrectAbstention(judgmentRow.judgment);
  const evidenceById = new Map((reference.input.compact_retrieved_evidence_pack ?? []).map((evidence) => [evidence.evidence_id, evidence]));
  const citedText = prediction.citations.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  const detGuard = inspectClaimEntailment(prediction, reference.input, citedText);
  return {
    example_id: predictionRow.example_id,
    prediction,
    answer_type: answerType,
    cited_text: citedText,
    strong_keep: strongKeep,
    strong_verdict: judgmentRow.judgment?.verdict ?? null,
    support_score: predictionRow.metadata?.support_score ?? null,
    det_fires: answerType === "grounded_answer" && detGuard.fire,
    det_reasons: detGuard.reasons,
  };
}

async function scoreRows(answeredRows, outputPath) {
  try {
    const existing = await readJsonl(outputPath);
    if (existing.length === answeredRows.length) return existing;
  } catch {
    // Rescore.
  }
  const inputPath = path.join(outputDir, "nli-input.jsonl");
  await writeJsonl(inputPath, answeredRows.map((row) => ({
    example_id: row.example_id,
    premise: truncate(row.cited_text, 3600),
    hypotheses: hypothesesFor(row).map((text) => truncate(text, 700)),
  })));
  const scorer = `
import json
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
rows = [json.loads(line) for line in input_path.read_text().splitlines() if line.strip()]
with output_path.open("w") as out:
    for row in rows:
        hypothesis_scores = []
        for hypothesis in row["hypotheses"]:
            encoded = tokenizer(row["premise"], hypothesis, truncation=True, max_length=512, return_tensors="pt")
            with torch.no_grad():
                probs = torch.softmax(model(**encoded).logits[0], dim=-1).tolist()
            hypothesis_scores.append({
                "hypothesis": hypothesis,
                "entailment": float(probs[entailment_index]),
                "contradiction": float(probs[contradiction_index]) if contradiction_index is not None else None,
            })
        entailments = [item["entailment"] for item in hypothesis_scores]
        out.write(json.dumps({
            "example_id": row["example_id"],
            "nli": {
                "entailment_min": min(entailments) if entailments else 0.0,
                "entailment_mean": sum(entailments) / len(entailments) if entailments else 0.0,
                "hypotheses": hypothesis_scores,
            }
        }) + "\\n")
`;
  const scriptPath = path.join(outputDir, "score-nli.tmp.py");
  await fs.writeFile(scriptPath, scorer);
  const envPrefix = "PYTHONPATH=/tmp/groundedqa-hf-runtime HF_HOME=/tmp/groundedqa-hf-cache";
  const result = spawnSync("bash", ["-lc", `${envPrefix} ${shellQuote(pythonBin)} ${shellQuote(scriptPath)}`], { stdio: "inherit", cwd: rootDir });
  await fs.rm(scriptPath, { force: true });
  if (result.status !== 0) throw new Error(`NLI scoring failed with exit code ${result.status}`);
  return readJsonl(outputPath);
}

function inspectClaimEntailment(prediction, input, citedText) {
  if (prediction.answer_type !== "grounded_answer") return { fire: false, reasons: [] };
  const answerText = [
    prediction.answer,
    ...(prediction.claim_table ?? []).flatMap((claim) => [claim.claim, claim.support]),
  ].filter(Boolean).join(" ");
  const strippedAnswer = stripCitations(answerText);
  const citedComparable = normalizeComparableText(citedText);
  const questionComparable = normalizeComparableText(input.question ?? "");
  const answerNumbers = [...new Set(numberTokens(strippedAnswer).map(normalizeNumber))];
  const citedNumbers = new Set(numberTokens(citedText).map(normalizeNumber));
  const questionNumbers = new Set(numberTokens(input.question ?? "").map(normalizeNumber));
  const unsupportedNumbers = answerNumbers.filter((number) => !citedNumbers.has(number) && !questionNumbers.has(number));
  const answerTerms = matchedTerms(strippedAnswer, comparativeTerms);
  const citedTerms = matchedTerms(citedText, comparativeTerms);
  const unsupportedTerms = answerTerms.filter((term) => !citedTerms.includes(term) && !citedComparable.includes(term) && !questionComparable.includes(term));
  const quantifierAnswerTerms = matchedTerms(strippedAnswer, quantifierTerms);
  const quantifierCitedTerms = matchedTerms(citedText, quantifierTerms);
  const unsupportedQuantifiers = quantifierAnswerTerms.filter((term) => !quantifierCitedTerms.includes(term) && !questionComparable.includes(term));
  const reasons = [];
  if (unsupportedNumbers.length) reasons.push("unsupported_number");
  if (unsupportedTerms.length) reasons.push("unsupported_comparative_or_superlative");
  if (unsupportedQuantifiers.length) reasons.push("unsupported_quantifier");
  return { fire: reasons.length > 0, reasons };
}

function predictionFor(row, policy, suppress) {
  return {
    example_id: row.example_id,
    prediction: suppress ? abstainPrediction(policy) : row.prediction,
    source_prediction: row.prediction,
    metadata: {
      scaffold: policy,
      gate_fired: suppress,
      nli_score: row.nli ? nliScore(row) : null,
      nli_threshold: nliThreshold,
      det_fires: row.det_fires,
      det_reasons: row.det_reasons,
    },
    labels: {
      strong_keep: row.strong_keep,
      strong_verdict: row.strong_verdict,
    },
    inherited_judgment: {
      support_oracle_correct: suppress ? !row.strong_keep : row.strong_keep,
      interpretation: suppress
        ? (row.strong_keep ? "harmful_suppression_supported_answer" : "suppressed_unsupported_answer")
        : "unchanged",
    },
  };
}

function summarize(predictions) {
  const answered = predictions.filter((row) => row.prediction.answer_type === "grounded_answer");
  const correct = predictions.filter((row) => row.inherited_judgment.support_oracle_correct);
  const supportedAnswers = answered.filter((row) => row.labels.strong_keep);
  const suppressions = predictions.filter((row) => row.metadata.gate_fired);
  return {
    examples: predictions.length,
    answered: answered.length,
    abstained: predictions.length - answered.length,
    answer_rate: ratio(answered.length, predictions.length),
    support_oracle_correct: correct.length,
    support_oracle_correct_rate: ratio(correct.length, predictions.length),
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    gate_fired: suppressions.length,
    suppressed_unsupported: suppressions.filter((row) => row.inherited_judgment.interpretation === "suppressed_unsupported_answer").length,
    harmful_suppressed_supported: suppressions.filter((row) => row.inherited_judgment.interpretation === "harmful_suppression_supported_answer").length,
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

function renderFiredExample(row) {
  return {
    example_id: row.example_id,
    strong_keep: row.strong_keep,
    strong_verdict: row.strong_verdict,
    nli_fires: row.answer_type === "grounded_answer" && nliScore(row) < nliThreshold,
    det_fires: row.det_fires,
    nli_score: nliScore(row),
    det_reasons: row.det_reasons,
    answer_preview: compact(row.prediction.answer, 220),
  };
}

function renderReport(result) {
  const policyRows = result.policies.map((policy) => (
    `| ${policy.label} | ${policy.metrics.support_oracle_correct} / ${policy.metrics.examples} (${pct(policy.metrics.support_oracle_correct_rate)}) | ${policy.metrics.answered} | ${pct(policy.metrics.answer_support_rate)} | ${policy.metrics.gate_fired} | ${policy.metrics.suppressed_unsupported} | ${policy.metrics.harmful_suppressed_supported} | ${signed(policy.delta_vs_balanced.support_oracle_correct_delta)} | ${signedPct(policy.delta_vs_balanced.support_oracle_correct_rate_delta)} |`
  )).join("\n");
  const firedRows = result.fired_examples.map((row) => (
    `| \`${row.example_id}\` | ${row.strong_keep ? "supported" : "unsupported"} | ${row.nli_fires ? "yes" : "no"} | ${row.det_fires ? "yes" : "no"} | ${row.nli_score.toFixed(3)} | ${row.det_reasons.join(", ") || ""} | ${escapeCell(row.answer_preview)} |`
  )).join("\n");
  return `# NLI And Deterministic Guard Retrospective

Scope: ${result.scope}

This run makes no OpenAI calls. It retrospectively applies a fixed NLI threshold from the later transfer experiment plus a recomputed deterministic claim-entailment guard to the earlier judged balanced-gate window.

## Policy Comparison

| Policy | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions | Delta rows vs balanced | Delta rate vs balanced |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${policyRows}

## Signals

- NLI fires: ${result.signal_summary.nli_fires}
- Deterministic guard fires: ${result.signal_summary.det_fires}
- Either fires: ${result.signal_summary.either_fires}
- Both fire: ${result.signal_summary.both_fire}

## Fired Examples

| Example | Strong label | NLI | Deterministic | NLI score | Deterministic reasons | Answer preview |
| --- | --- | --- | --- | ---: | --- | --- |
${firedRows}

## Interpretation

This is not a fresh later holdout; it is a retrospective robustness check on the threshold-selection window. It tests whether the verifier combination behaves sensibly outside the 241-389 transfer synthesis without spending more OpenAI budget.
`;
}

function hypothesesFor(row) {
  const answer = stripCitations(row.prediction.answer);
  const claims = (row.prediction.claim_table ?? [])
    .map((claim) => stripCitations(`${claim.claim ?? ""} ${claim.support ?? ""}`.trim()))
    .filter(Boolean);
  return [...new Set([answer, ...claims].filter(Boolean))];
}

function nliScore(row) {
  return Number(row.nli?.entailment_min ?? 1);
}

function abstainPrediction(policy) {
  return {
    answer_type: "abstain",
    answer: "The cited evidence does not provide enough support for the generated claim.",
    citations: [],
    claim_table: [{ claim: "A local verifier policy rejected the generated answer as insufficiently supported.", support: policy, citations: [] }],
    abstention_reason: `Suppressed by ${policy}.`,
  };
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

function isSupportedAnswer(judgment) {
  return ["supported", "correct"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.all_claims_supported === true;
}

function isCorrectAbstention(judgment) {
  return ["correct_abstention", "abstention_supported"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.abstention_supported === true;
}

function matchedTerms(value, terms) {
  const text = ` ${String(value).toLowerCase()} `;
  return terms.filter((term) => new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(text));
}

function normalizeComparableText(value) {
  return String(value).toLowerCase().replace(/[-–—]/g, " ");
}

function normalizeNumber(value) {
  const lower = String(value).toLowerCase().replaceAll(",", "");
  const suffix = lower.match(/^(\d+(?:\.\d+)?)([kmb])$/);
  if (!suffix) return lower;
  const multipliers = { k: 1000, m: 1000000, b: 1000000000 };
  return String(Number(suffix[1]) * multipliers[suffix[2]]);
}

function numberTokens(value) {
  const text = String(value);
  return [...text.matchAll(/\b\d+(?:[.,]\d+)*(?:%|k|m|b)?\b/gi)].map((match) => match[0]);
}

function stripCitations(value) {
  return String(value).replace(/\s*\[[^\]]+\]/g, "").trim();
}

function truncate(value, maxLength) {
  const text = String(value ?? "");
  return text.length <= maxLength ? text : text.slice(0, maxLength);
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
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

function compact(value, length) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= length ? text : `${text.slice(0, length - 3)}...`;
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function keyed(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
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
