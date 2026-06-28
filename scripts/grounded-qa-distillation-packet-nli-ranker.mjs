import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const runId = args["run-id"] ?? "packet-nli-ranker-expanded-2026-06-28-v1";
const modelId = args.model ?? "cross-encoder/nli-distilroberta-base";
const pythonBin = args.python ?? process.env.PYTHON_BIN ?? "/Users/ryanprendergast/miniconda3/bin/python3";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const packetDir = path.join(runsDir, sourcePacketRunId);
const packet = await readJson(path.join(packetDir, "result.json"));
const trainPairs = await readJsonl(path.join(packetDir, "train_pairwise.jsonl"));
const validationPairs = await readJsonl(path.join(packetDir, "validation_pairwise.jsonl"));
const diagnosticPairs = await readJsonl(path.join(packetDir, "diagnostic_frontier_pairwise.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const featureNames = [
  "nli_entailment_min",
  "nli_entailment_mean",
  "nli_contradiction_max",
  "nli_answer_entailment",
  "nli_claim_entailment_min",
  "answer_cited_token_coverage",
  "claim_mean_cited_coverage",
  "unsupported_number_count",
  "unsupported_comparative_count",
  "answer_tokens",
  "citation_count",
  "claim_count",
];

const candidateRows = uniqueCandidates([...trainPairs, ...validationPairs, ...diagnosticPairs]);
const scores = await scoreCandidates(candidateRows, path.join(outputDir, "nli-scores.jsonl"));
const scoresByKey = new Map(scores.map((row) => [row.candidate_key, row.nli]));
const trainRows = trainPairs.map((row) => pairWithNliFeatures(row, scoresByKey));
const validationRows = validationPairs.map((row) => pairWithNliFeatures(row, scoresByKey));
const diagnosticRows = diagnosticPairs.map((row) => pairWithNliFeatures(row, scoresByKey));
const scaler = fitScaleOnlyScaler(trainRows.map((row) => row.delta));
const model = trainPairwiseLogistic(trainRows.map((row) => scaleVector(row.delta, scaler)), {
  epochs: 320,
  learningRate: 0.08,
  l2: 0.04,
});

const trainEval = evaluatePairs(trainRows, model, scaler);
const validationEval = evaluatePairs(validationRows, model, scaler);
const diagnosticEval = evaluatePairs(diagnosticRows, model, scaler);
const diagnosticSelections = selectDiagnosticCandidates(diagnosticRows, model, scaler);
const diagnosticSelectionMetrics = summarizeSelections(diagnosticSelections);
const status = deriveStatus(validationEval, diagnosticSelectionMetrics);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "packet_nli_ranker",
  status,
  source_packet: sourcePacketRunId,
  purpose: "Score expanded support-ranker packet candidates with a local pretrained NLI cross-encoder and train a zero-LLM pairwise selector diagnostic.",
  model: {
    model_id: modelId,
    premise: "concatenated cited evidence text",
    hypotheses: "candidate answer plus individual claim-table claims",
    score: "minimum entailment probability across answer/claim hypotheses",
  },
  feature_names: featureNames,
  data_summary: {
    train_pairs: trainRows.length,
    validation_pairs: validationRows.length,
    diagnostic_pairs: diagnosticRows.length,
    unique_candidates: candidateRows.length,
    scored_candidates: scores.length,
  },
  training: {
    algorithm: "scale_only_pairwise_logistic_regression",
    epochs: model.epochs,
    learning_rate: model.learningRate,
    l2: model.l2,
  },
  metrics: {
    train: summarizePairEval(trainEval),
    validation: summarizePairEval(validationEval),
    final_diagnostic_pairwise: summarizePairEval(diagnosticEval),
    final_diagnostic_selection: diagnosticSelectionMetrics,
  },
  learned_ranker: {
    intercept: 0,
    weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
    scaler,
  },
  decision: decisionFromMetrics(validationEval, diagnosticSelectionMetrics),
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This run uses a local open-weight NLI model and existing packet rows only.",
  },
};

await writeJsonl(path.join(outputDir, "validation_predictions.jsonl"), validationEval.rows);
await writeJsonl(path.join(outputDir, "diagnostic_pair_predictions.jsonl"), diagnosticEval.rows);
await writeJsonl(path.join(outputDir, "diagnostic_selections.jsonl"), diagnosticSelections);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  data_summary: result.data_summary,
  metrics: result.metrics,
  decision: result.decision,
}, null, 2));

async function scoreCandidates(candidates, outputPath) {
  try {
    const existing = await readJsonl(outputPath);
    if (existing.length === candidates.length) return existing;
  } catch {
    // Fall through and rescore.
  }
  const inputPath = path.join(outputDir, "nli-input.jsonl");
  await writeJsonl(inputPath, candidates.map((row) => ({
    candidate_key: row.candidate_key,
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
            "candidate_key": row["candidate_key"],
            "nli": {
                "entailment_min": min(entailments) if entailments else 0.0,
                "entailment_mean": sum(entailments) / len(entailments) if entailments else 0.0,
                "contradiction_max": max(contradictions) if contradictions else None,
                "answer_entailment": hypothesis_scores[0]["entailment"] if hypothesis_scores else 0.0,
                "claim_entailment_min": min([item["entailment"] for item in hypothesis_scores[1:]]) if len(hypothesis_scores) > 1 else (hypothesis_scores[0]["entailment"] if hypothesis_scores else 0.0),
                "hypotheses": hypothesis_scores,
            }
        }) + "\\n")
`;
  const scriptPath = path.join(outputDir, "score-nli.tmp.py");
  await fs.writeFile(scriptPath, scorer);
  const envPrefix = "PYTHONPATH=/tmp/groundedqa-hf-runtime HF_HOME=/tmp/groundedqa-hf-cache";
  const scored = spawnSync("bash", ["-lc", `${envPrefix} ${shellQuote(pythonBin)} ${shellQuote(scriptPath)}`], {
    cwd: rootDir,
    stdio: "inherit",
  });
  await fs.rm(scriptPath, { force: true });
  if (scored.status !== 0) throw new Error(`NLI scoring failed with exit code ${scored.status}`);
  return readJsonl(outputPath);
}

function uniqueCandidates(pairs) {
  const rows = new Map();
  for (const pair of pairs) {
    for (const candidate of [pair.chosen, pair.rejected]) {
      const candidateKey = candidateKeyFor(pair, candidate);
      if (rows.has(candidateKey)) continue;
      const evidenceById = new Map(pair.input.compact_retrieved_evidence_pack.map((item) => [item.evidence_id, item]));
      const citedText = (candidate.citations ?? []).map((id) => evidenceById.get(id)?.text ?? "").join(" ");
      rows.set(candidateKey, {
        candidate_key: candidateKey,
        input: pair.input,
        candidate,
        cited_text: citedText,
      });
    }
  }
  return [...rows.values()];
}

function pairWithNliFeatures(row, scoresByKey) {
  const chosenFeatures = candidateFeatures(row, row.chosen, scoresByKey);
  const rejectedFeatures = candidateFeatures(row, row.rejected, scoresByKey);
  return {
    ...row,
    chosen_nli_features: chosenFeatures,
    rejected_nli_features: rejectedFeatures,
    delta: featureNames.map((name) => chosenFeatures[name] - rejectedFeatures[name]),
  };
}

function candidateFeatures(row, candidate, scoresByKey) {
  const nli = scoresByKey.get(candidateKeyFor(row, candidate)) ?? {};
  return {
    nli_entailment_min: Number(nli.entailment_min ?? 0),
    nli_entailment_mean: Number(nli.entailment_mean ?? 0),
    nli_contradiction_max: Number(nli.contradiction_max ?? 0),
    nli_answer_entailment: Number(nli.answer_entailment ?? 0),
    nli_claim_entailment_min: Number(nli.claim_entailment_min ?? 0),
    answer_cited_token_coverage: Number(candidate.features?.answer_cited_token_coverage ?? 0),
    claim_mean_cited_coverage: Number(candidate.features?.claim_mean_cited_coverage ?? 0),
    unsupported_number_count: Number(candidate.features?.unsupported_number_count ?? 0),
    unsupported_comparative_count: Number(candidate.features?.unsupported_comparative_count ?? 0),
    answer_tokens: Number(candidate.features?.answer_tokens ?? 0),
    citation_count: Number(candidate.features?.citation_count ?? 0),
    claim_count: Number(candidate.features?.claim_count ?? 0),
  };
}

function trainPairwiseLogistic(rows, options) {
  const weights = Array(featureNames.length).fill(0);
  const { epochs, learningRate, l2 } = options;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / Math.sqrt(1 + epoch / 35);
    for (const row of rows) {
      const margin = dot(weights, row);
      const gradientScale = -sigmoid(-margin);
      for (let index = 0; index < weights.length; index += 1) {
        weights[index] -= rate * (gradientScale * row[index] + l2 * weights[index]);
      }
    }
  }
  return { weights, epochs, learningRate, l2 };
}

function evaluatePairs(rows, model, scaler) {
  const predictions = rows.map((row) => {
    const margin = scoreDelta(row.delta, model, scaler);
    const predicted = margin >= 0 ? "chosen" : "rejected";
    return {
      pair_id: row.pair_id,
      example_id: row.example_id,
      split: row.split,
      window: row.window,
      predicted_preferred: predicted,
      correct: predicted === "chosen",
      margin,
      chosen_id: row.chosen.id,
      rejected_id: row.rejected.id,
      training_use: row.training_use,
    };
  });
  const correct = predictions.filter((row) => row.correct).length;
  return {
    pairs: rows.length,
    correct,
    accuracy: rows.length ? correct / rows.length : 0,
    mean_margin: mean(predictions.map((row) => row.margin)),
    rows: predictions,
  };
}

function selectDiagnosticCandidates(rows, model, scaler) {
  const byExample = new Map();
  for (const row of rows) {
    for (const [role, candidate, features] of [
      ["chosen", row.chosen, row.chosen_nli_features],
      ["rejected", row.rejected, row.rejected_nli_features],
    ]) {
      if (!byExample.has(row.example_id)) byExample.set(row.example_id, new Map());
      const key = `${row.example_id}:${candidate.id}`;
      if (byExample.get(row.example_id).has(key)) continue;
      byExample.get(row.example_id).set(key, {
        example_id: row.example_id,
        candidate_id: candidate.id,
        family: candidate.family,
        supported_answer: role === "chosen",
        score: scoreCandidate(features, model, scaler),
        nli_entailment_min: features.nli_entailment_min,
        nli_contradiction_max: features.nli_contradiction_max,
      });
    }
  }
  return [...byExample.entries()].map(([exampleId, candidateMap]) => {
    const ranked = [...candidateMap.values()].sort((left, right) => right.score - left.score);
    return {
      example_id: exampleId,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_family: ranked[0]?.family ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
      selected_score: ranked[0]?.score ?? null,
      candidate_count: ranked.length,
      supported_candidate_count: ranked.filter((row) => row.supported_answer).length,
      unsupported_candidate_count: ranked.filter((row) => !row.supported_answer).length,
      ranked_candidates: ranked,
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
}

function summarizeSelections(rows) {
  const selectedSupported = rows.filter((row) => row.selected_supported_answer).length;
  return {
    examples: rows.length,
    selected_supported: selectedSupported,
    selected_unsupported: rows.length - selectedSupported,
    selection_support_rate: rows.length ? selectedSupported / rows.length : 0,
    examples_with_supported_candidate: rows.filter((row) => row.supported_candidate_count > 0).length,
  };
}

function deriveStatus(validationEval, diagnosticSelectionMetrics) {
  if (validationEval.accuracy >= 0.75 && diagnosticSelectionMetrics.selection_support_rate >= 0.7) return "packet_nli_ranker_promising";
  if (validationEval.accuracy > 0.5 || diagnosticSelectionMetrics.selection_support_rate > 0.5) return "packet_nli_partial_signal";
  return "packet_nli_not_sufficient";
}

function decisionFromMetrics(validationEval, diagnosticSelectionMetrics) {
  if (validationEval.accuracy >= 0.75 && diagnosticSelectionMetrics.selection_support_rate >= 0.7) {
    return {
      integrate_selector_now: true,
      launch_gpu_now: false,
      reason: "Local NLI candidate scoring clears validation and final diagnostic thresholds.",
      next_step: "Run a zero-cost selector integration audit before any new generator training.",
    };
  }
  return {
    integrate_selector_now: false,
    launch_gpu_now: false,
    reason: "Local NLI candidate scoring does not transfer strongly enough to support final-frontier selection.",
    next_step: "Add frontier-like non-final Qwen candidate pairs or buy a bounded GPT-4o labeling batch targeted at Qwen switch candidates before spending Prime GPU budget.",
  };
}

function hypothesesFor(row) {
  const answer = stripCitations(row.candidate.answer);
  const claims = (row.candidate.claim_table ?? [])
    .map((claim) => stripCitations(`${claim.claim ?? ""} ${claim.support ?? ""} ${claim.evidence ?? ""}`.trim()))
    .filter(Boolean);
  return [...new Set([answer, ...claims].filter(Boolean))];
}

function fitScaleOnlyScaler(vectors) {
  const std = {};
  featureNames.forEach((name, index) => {
    const values = vectors.map((vector) => vector[index]);
    const center = mean(values);
    const variance = mean(values.map((value) => (value - center) ** 2));
    std[name] = Math.sqrt(variance) || 1;
  });
  return { mean: Object.fromEntries(featureNames.map((name) => [name, 0])), std };
}

function scoreDelta(delta, model, scaler) {
  return dot(model.weights, scaleVector(delta, scaler));
}

function scoreCandidate(features, model, scaler) {
  return dot(model.weights, scaleVector(featureNames.map((name) => features[name] ?? 0), scaler));
}

function scaleVector(vector, scaler) {
  return vector.map((value, index) => value / Number(scaler.std[featureNames[index]] || 1));
}

function summarizePairEval(evalResult) {
  return {
    pairs: evalResult.pairs,
    correct: evalResult.correct,
    accuracy: evalResult.accuracy,
    mean_margin: evalResult.mean_margin,
  };
}

function renderReport(result) {
  return `# Packet NLI Ranker

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no compute. It scores packet candidates with \`${result.model.model_id}\` locally.

## Metrics

| Split | Pairs/examples | Correct/supported | Rate |
| --- | ---: | ---: | ---: |
| Train pairwise | ${result.metrics.train.pairs} | ${result.metrics.train.correct} | ${formatPct(result.metrics.train.accuracy)} |
| Validation pairwise | ${result.metrics.validation.pairs} | ${result.metrics.validation.correct} | ${formatPct(result.metrics.validation.accuracy)} |
| Final diagnostic pairwise | ${result.metrics.final_diagnostic_pairwise.pairs} | ${result.metrics.final_diagnostic_pairwise.correct} | ${formatPct(result.metrics.final_diagnostic_pairwise.accuracy)} |
| Final diagnostic selection | ${result.metrics.final_diagnostic_selection.examples} | ${result.metrics.final_diagnostic_selection.selected_supported} | ${formatPct(result.metrics.final_diagnostic_selection.selection_support_rate)} |

## Decision

- Integrate selector now: ${result.decision.integrate_selector_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function candidateKeyFor(row, candidate) {
  return `${row.example_id}::${candidate.id}::${candidate.prediction_run_id ?? ""}`;
}

function stripCitations(value) {
  return String(value ?? "").replace(/\s*\[[^\]]+\]/g, "").trim();
}

function truncate(value, maxLength) {
  const text = String(value ?? "");
  return text.length <= maxLength ? text : text.slice(0, maxLength);
}

function sigmoid(value) {
  if (value < -40) return 0;
  if (value > 40) return 1;
  return 1 / (1 + Math.exp(-value));
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatPct(value) {
  return `${(100 * value).toFixed(1)}%`;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
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
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : true;
  }
  return parsed;
}
