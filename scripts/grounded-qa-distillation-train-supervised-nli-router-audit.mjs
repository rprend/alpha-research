import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model dataset task result results use uses is in on of to a an by as or be can it its we our you your".split(" "));

const runId = args["run-id"] ?? "train-supervised-nli-router-audit-frontier-repaired-v1";
const modelId = args.model ?? "cross-encoder/nli-distilroberta-base";
const pythonBin = args.python ?? process.env.PYTHON_BIN ?? "/Users/ryanprendergast/miniconda3/bin/python3";
const launchPacketRunId = args["launch-packet-run-id"] ?? "frontier-repaired-launch-packet-2026-06-29-v1";
const validationGateRunId = args["validation-gate-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const scaffoldRunId = "frontier-repaired-train-calibrated-scaffold-smoke-2026-06-29-v1";
const trainSelectedRunId = "train-selected-constrained-policy-audit-frontier-repaired-v1";
const learnedRunId = "learned-repaired-selector-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);

const systemIds = [
  "train_calibrated_scaffold",
  "train_selected_constrained_policy",
  "learned_repaired_selector",
];
const featureNames = [
  "bias",
  "system_train_calibrated_scaffold",
  "system_train_selected_constrained_policy",
  "system_learned_repaired_selector",
  "predicts_answer",
  "predicts_abstain",
  "citation_count",
  "claim_count",
  "answer_token_length",
  "answer_has_inline_citation",
  "all_citations_in_answer",
  "missing_support_length",
  "question_overlap",
  "cited_evidence_overlap",
  "answer_number_supported",
  "answer_has_number",
  "question_has_number",
  "counterfactual_prompt",
  "risky_question",
  "system_train_prior_contract_rate",
  "nli_entailment_min",
  "nli_entailment_mean",
  "nli_contradiction_max",
  "nli_margin_min",
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const scaffoldResult = await readJson(path.join(runsDir, scaffoldRunId, "result.json"));
const trainRows = await readJsonl(path.join(runsDir, launchPacketRunId, "dataset", "sft_train.jsonl"));
const validationPrompts = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_prompts.jsonl"));
const validationTargets = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const validationTargetById = new Map(validationTargets.map((row) => [row.example_id, row.target]));

const trainTune = trainRows.slice(0, 160).map((row) => ({ example_id: row.example_id, input: row.input, target: row.target, split: "train_tune" }));
const trainHeldout = trainRows.slice(160).map((row) => ({ example_id: row.example_id, input: row.input, target: row.target, split: "train_heldout" }));
const validationRows = validationPrompts.map((row) => ({
  example_id: row.example_id,
  input: row.input,
  target: validationTargetById.get(row.example_id),
  split: "repaired_validation_gate",
}));

const predictions = {
  train_tune: await loadSplitPredictions("train_tune", trainTune),
  train_heldout: await loadSplitPredictions("train_heldout", trainHeldout),
  repaired_validation_gate: await loadSplitPredictions("repaired_validation_gate", validationRows),
};
const nliUnits = buildNliUnits([...predictions.train_tune, ...predictions.train_heldout, ...predictions.repaired_validation_gate]);
const nliRows = await scoreNliUnits(nliUnits, path.join(outputDir, "candidate-nli-scores.jsonl"));
const nliByCandidate = aggregateNliByCandidate(nliRows);

const trainPriorBySystem = {};
for (const systemId of systemIds) {
  const scored = predictions.train_tune.map((row) => scorePrediction(row.predictions[systemId], row.target));
  trainPriorBySystem[systemId] = rate(scored.filter((row) => row.contract_correct).length, scored.length);
}

const trainCandidateRows = candidateRowsFor(predictions.train_tune, trainPriorBySystem);
const heldoutCandidateRows = candidateRowsFor(predictions.train_heldout, trainPriorBySystem);
const validationCandidateRows = candidateRowsFor(predictions.repaired_validation_gate, trainPriorBySystem);
const scaler = makeScaler(trainCandidateRows.map((row) => row.feature_values));
const model = trainLogistic(trainCandidateRows, scaler, { epochs: 1400, learningRate: 0.06, l2: 0.01 });

const trainSelections = selectRows(predictions.train_tune, scaler, model, trainPriorBySystem);
const heldoutSelections = selectRows(predictions.train_heldout, scaler, model, trainPriorBySystem);
const validationSelections = selectRows(predictions.repaired_validation_gate, scaler, model, trainPriorBySystem);
const trainMetrics = summarizeSelections(trainSelections);
const heldoutMetrics = summarizeSelections(heldoutSelections);
const validationMetrics = summarizeSelections(validationSelections);
const validationOracle = summarizeOracle(predictions.repaired_validation_gate);
const heldoutOracle = summarizeOracle(predictions.train_heldout);

await writeJsonl(path.join(outputDir, "train_tune_candidate_rows.jsonl"), trainCandidateRows);
await writeJsonl(path.join(outputDir, "train_heldout_selections.jsonl"), heldoutSelections);
await writeJsonl(path.join(outputDir, "validation_selections.jsonl"), validationSelections);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "train_supervised_nli_router_audit",
  status: statusFor(validationMetrics),
  purpose: "Train a candidate router with local NLI claim/evidence features only on repaired train-tune labels and evaluate transfer to heldout train and repaired validation without validation-label training.",
  source_runs: {
    launch_packet_run_id: launchPacketRunId,
    validation_gate_run_id: validationGateRunId,
    train_calibrated_scaffold: scaffoldRunId,
    train_selected_constrained_policy: trainSelectedRunId,
    learned_repaired_selector: learnedRunId,
  },
  leakage_note: "Router weights and system priors are trained only on the first 160 repaired train rows. Repaired validation labels are used only for reporting.",
  candidate_pool: {
    systems: systemIds,
    excludes_validation_only_qwen_hybrid: true,
    reason: "The constrained Qwen/scaffold hybrid has no train candidate surface, so using it for a trained router would leak validation-only artifacts.",
  },
  training: {
    train_examples: trainTune.length,
    train_candidate_rows: trainCandidateRows.length,
    feature_names: featureNames,
    train_prior_by_system: trainPriorBySystem,
    model: {
      weights: model.weights,
      intercept: model.intercept,
      feature_means: scaler.means,
      feature_scales: scaler.scales,
    },
  },
  semantic_model: {
    model_id: modelId,
    premise: "candidate cited evidence text",
    hypothesis: "answer text and claim-table claims",
    scored_units: nliRows.length,
    candidate_groups: nliByCandidate.size,
  },
  metrics: {
    train_tune: trainMetrics,
    train_heldout: heldoutMetrics,
    repaired_validation_gate: validationMetrics,
  },
  oracle: {
    train_heldout: heldoutOracle,
    repaired_validation_gate: validationOracle,
  },
  selected_system_counts: {
    train_tune: countBy(trainSelections.map((row) => row.selected_system_id)),
    train_heldout: countBy(heldoutSelections.map((row) => row.selected_system_id)),
    repaired_validation_gate: countBy(validationSelections.map((row) => row.selected_system_id)),
  },
  baseline_comparison: {
    train_calibrated_scaffold_contract_correct: 44,
    train_selected_constrained_policy_contract_correct: 41,
    learned_repaired_selector_contract_correct: 41,
    validation_pool_oracle_contract_correct: validationOracle.contract_correct,
    selected_validation_contract_correct: validationMetrics.contract_correct,
    delta_vs_train_calibrated_scaffold: validationMetrics.contract_correct - 44,
    delta_vs_three_system_oracle: validationMetrics.contract_correct - validationOracle.contract_correct,
  },
  decision: {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    promote_as_policy: false,
    next_step: nextStepFor(validationMetrics, validationOracle),
    reason: "The NLI-augmented router must beat the existing train-calibrated scaffold and the non-NLI router on repaired validation without using validation labels before it can justify paid judging or Prime escalation.",
  },
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
    note: "This audit trains locally over existing deterministic candidates, repaired labels, and a local open-weight NLI model.",
  },
  artifacts: {
    train_tune_candidate_rows_jsonl: rel(path.join(outputDir, "train_tune_candidate_rows.jsonl")),
    train_heldout_selections_jsonl: rel(path.join(outputDir, "train_heldout_selections.jsonl")),
    validation_selections_jsonl: rel(path.join(outputDir, "validation_selections.jsonl")),
    candidate_nli_scores_jsonl: rel(path.join(outputDir, "candidate-nli-scores.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  metrics: result.metrics,
  oracle: result.oracle,
  selected_system_counts: result.selected_system_counts,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
}, null, 2));

async function loadSplitPredictions(split, rows) {
  const scaffoldPredictions = rows.map((row) => ({
    example_id: row.example_id,
    prediction: predictScaffold(row.example_id, row.input, scaffoldResult.calibration.params),
  }));
  const trainSelectedFile = split === "train_tune"
    ? "train_tune_predictions.jsonl"
    : split === "train_heldout"
      ? "train_heldout_predictions.jsonl"
      : "validation_predictions.jsonl";
  const learnedFile = trainSelectedFile;
  const trainSelected = await readJsonl(path.join(runsDir, trainSelectedRunId, trainSelectedFile));
  const learned = await readJsonl(path.join(runsDir, learnedRunId, learnedFile));
  const bySystem = {
    train_calibrated_scaffold: new Map(scaffoldPredictions.map((row) => [row.example_id, row.prediction])),
    train_selected_constrained_policy: new Map(trainSelected.map((row) => [row.example_id, row.prediction])),
    learned_repaired_selector: new Map(learned.map((row) => [row.example_id, row.prediction])),
  };
  return rows.map((row) => ({
    example_id: row.example_id,
    split,
    input: row.input,
    target: row.target,
    predictions: Object.fromEntries(systemIds.map((systemId) => [systemId, bySystem[systemId].get(row.example_id)])),
  }));
}

function candidateRowsFor(rows, trainPriorBySystem) {
  const candidateRows = [];
  for (const row of rows) {
    for (const systemId of systemIds) {
      const prediction = row.predictions[systemId];
      const score = scorePrediction(prediction, row.target);
      candidateRows.push({
        example_id: row.example_id,
        split: row.split,
        system_id: systemId,
        label_contract_correct: score.contract_correct ? 1 : 0,
        label_answer_type_correct: score.answer_type_correct ? 1 : 0,
        label_citation_set_exact: score.citation_set_exact ? 1 : 0,
        feature_values: candidateFeatures({ exampleId: row.example_id, input: row.input, prediction, systemId, trainPriorBySystem }),
      });
    }
  }
  return candidateRows;
}

function selectRows(rows, scaler, model, trainPriorBySystem) {
  return rows.map((row) => {
    const candidates = systemIds.map((systemId) => {
      const prediction = row.predictions[systemId];
      const score = scorePrediction(prediction, row.target);
      const features = candidateFeatures({ exampleId: row.example_id, input: row.input, prediction, systemId, trainPriorBySystem });
      return {
        system_id: systemId,
        predicted_probability: predictProb(model, scaler, features),
        prediction_answer_type: prediction?.answer_type,
        contract_correct: score.contract_correct,
        answer_type_correct: score.answer_type_correct,
        citation_set_exact: score.citation_set_exact,
      };
    }).sort((left, right) => right.predicted_probability - left.predicted_probability || systemIds.indexOf(left.system_id) - systemIds.indexOf(right.system_id));
    const selected = candidates[0];
    return {
      example_id: row.example_id,
      split: row.split,
      target_answer_type: row.target?.answer_type,
      selected_system_id: selected.system_id,
      selected_contract_correct: selected.contract_correct,
      selected_answer_type_correct: selected.answer_type_correct,
      selected_citation_set_exact: selected.citation_set_exact,
      selected_probability: selected.predicted_probability,
      candidates,
    };
  });
}

function summarizeSelections(rows) {
  const correct = rows.filter((row) => row.selected_contract_correct).length;
  const answerType = rows.filter((row) => row.selected_answer_type_correct).length;
  const citation = rows.filter((row) => row.selected_citation_set_exact).length;
  return {
    examples: rows.length,
    contract_correct: correct,
    contract_correct_rate: rate(correct, rows.length),
    answer_type_correct: answerType,
    answer_type_accuracy: rate(answerType, rows.length),
    citation_set_exact: citation,
    citation_set_exact_rate: rate(citation, rows.length),
  };
}

function summarizeOracle(rows) {
  const oracleCorrect = rows.filter((row) => systemIds.some((systemId) => scorePrediction(row.predictions[systemId], row.target).contract_correct)).length;
  return {
    examples: rows.length,
    contract_correct: oracleCorrect,
    contract_correct_rate: rate(oracleCorrect, rows.length),
    all_systems_wrong: rows.length - oracleCorrect,
  };
}

function candidateFeatures({ exampleId, input, prediction, systemId, trainPriorBySystem }) {
  const answer = String(prediction?.answer ?? "");
  const citations = normalizeCitations(prediction?.citations);
  const claimTable = Array.isArray(prediction?.claim_table) ? prediction.claim_table : [];
  const citedText = citedEvidenceText(input, citations);
  const answerTokens = tokenList(answer);
  const questionTokens = tokenSet(input?.question);
  const citedTokens = tokenSet(citedText);
  const answerNumbers = numberSet(answer);
  const citedNumbers = numberSet(citedText);
  const nli = nliByCandidate.get(candidateKey(exampleId, systemId)) ?? {};
  return [
    1,
    systemId === "train_calibrated_scaffold" ? 1 : 0,
    systemId === "train_selected_constrained_policy" ? 1 : 0,
    systemId === "learned_repaired_selector" ? 1 : 0,
    prediction?.answer_type === "grounded_answer" ? 1 : 0,
    prediction?.answer_type === "abstain" ? 1 : 0,
    Math.min(1, citations.length / 4),
    Math.min(1, claimTable.length / 4),
    Math.min(1, answerTokens.length / 80),
    /\[E\d+\]/.test(answer) ? 1 : 0,
    citations.length > 0 && citations.every((id) => answer.includes(`[${id}]`)) ? 1 : 0,
    Math.min(1, String(prediction?.evidence_first?.missing_support ?? prediction?.abstention_reason ?? "").length / 180),
    questionTokens.size ? overlapCount(questionTokens, tokenSet(answer)) / questionTokens.size : 0,
    questionTokens.size ? overlapCount(questionTokens, citedTokens) / questionTokens.size : 0,
    answerNumbers.size > 0 && [...answerNumbers].every((number) => citedNumbers.has(number)) ? 1 : 0,
    answerNumbers.size > 0 ? 1 : 0,
    numberSet(input?.question).size > 0 ? 1 : 0,
    Boolean(input?.document_metadata?.counterfactual) ? 1 : 0,
    isRiskyQuestion(input?.question) ? 1 : 0,
    Number(trainPriorBySystem[systemId] ?? 0),
    Number(nli.entailment_min ?? 0),
    Number(nli.entailment_mean ?? 0),
    Number(nli.contradiction_max ?? 0),
    Number(nli.margin_min ?? 0),
  ];
}

function buildNliUnits(rows) {
  const units = [];
  for (const row of rows) {
    for (const systemId of systemIds) {
      const prediction = row.predictions[systemId];
      if (prediction?.answer_type !== "grounded_answer") continue;
      const premise = citedEvidenceText(row.input, normalizeCitations(prediction.citations));
      if (!premise.trim()) continue;
      const hypotheses = claimTexts(prediction);
      for (const [index, hypothesis] of hypotheses.entries()) {
        if (!hypothesis.trim()) continue;
        units.push({
          unit_key: `${candidateKey(row.example_id, systemId)}::${index}`,
          candidate_key: candidateKey(row.example_id, systemId),
          premise,
          hypothesis,
        });
      }
    }
  }
  return units;
}

async function scoreNliUnits(units, outputPath) {
  try {
    const existing = await readJsonl(outputPath);
    if (existing.length === units.length) return existing;
  } catch {
    // Score below.
  }
  const inputPath = path.join(outputDir, "candidate-nli-input.jsonl");
  await writeJsonl(inputPath, units.map((row) => ({
    unit_key: row.unit_key,
    candidate_key: row.candidate_key,
    premise: truncate(row.premise, 3600),
    hypothesis: truncate(row.hypothesis, 700),
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
        encoded = tokenizer(row["premise"], row["hypothesis"], truncation=True, max_length=512, return_tensors="pt")
        with torch.no_grad():
            logits = model(**encoded).logits[0]
            probs = torch.softmax(logits, dim=-1).tolist()
        entailment = float(probs[entailment_index])
        contradiction = float(probs[contradiction_index]) if contradiction_index is not None else 0.0
        out.write(json.dumps({
            "unit_key": row["unit_key"],
            "candidate_key": row["candidate_key"],
            "nli": {
                "entailment": entailment,
                "contradiction": contradiction,
                "margin": entailment - contradiction
            }
        }) + "\\n")
`;
  const scriptPath = path.join(outputDir, "score-candidate-nli.tmp.py");
  await fs.writeFile(scriptPath, scorer);
  const envPrefix = "PYTHONPATH=/tmp/groundedqa-hf-runtime HF_HOME=/tmp/groundedqa-hf-cache";
  const scored = spawnSync("bash", ["-lc", `${envPrefix} ${shellQuote(pythonBin)} ${shellQuote(scriptPath)}`], {
    cwd: rootDir,
    stdio: "inherit",
  });
  await fs.rm(scriptPath, { force: true });
  if (scored.status !== 0) throw new Error(`candidate NLI scoring failed with exit code ${scored.status}`);
  return readJsonl(outputPath);
}

function aggregateNliByCandidate(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const list = grouped.get(row.candidate_key) ?? [];
    list.push(row.nli);
    grouped.set(row.candidate_key, list);
  }
  const aggregated = new Map();
  for (const [key, list] of grouped.entries()) {
    const entailments = list.map((row) => Number(row.entailment ?? 0));
    const contradictions = list.map((row) => Number(row.contradiction ?? 0));
    const margins = list.map((row) => Number(row.margin ?? 0));
    aggregated.set(key, {
      entailment_min: Math.min(...entailments),
      entailment_mean: mean(entailments),
      contradiction_max: Math.max(...contradictions),
      margin_min: Math.min(...margins),
    });
  }
  return aggregated;
}

function claimTexts(prediction) {
  const claims = (prediction?.claim_table ?? []).map((claim) => String(claim.claim ?? "").trim()).filter(Boolean);
  const answer = stripCitations(prediction?.answer).trim();
  if (!claims.length && answer) return [answer];
  if (answer && answer.length <= 220 && !claims.some((claim) => normalizedText(claim) === normalizedText(answer))) {
    return [answer, ...claims];
  }
  return claims;
}

function candidateKey(exampleId, systemId) {
  return `${exampleId}::${systemId}`;
}

function predictScaffold(exampleId, input, params) {
  const counterfactual = input.document_metadata?.counterfactual === true || String(exampleId).includes(":counterfactual-insufficient");
  const ranked = rankEvidence(input.question, input.compact_retrieved_evidence_pack ?? []);
  const topScore = ranked[0]?.score ?? 0;
  const directSignalCount = ranked.filter((row) => row.score >= 0.12).length;
  const risky = /\b(how much|percentage|statistically significant|which are three|how many|what percentage)\b/i.test(input.question ?? "");
  const score = topScore + params.direct_weight * Math.min(directSignalCount, 3) - (risky ? params.risk_penalty : 0);
  if (counterfactual || score < params.threshold) return abstain(input.question, score);
  const selected = ranked.slice(0, params.citation_count).filter((row) => row.score > 0);
  if (!selected.length) return abstain(input.question, score);
  const citations = selected.map((row) => row.evidence_id);
  const claims = selected.map((row, index) => ({
    claim_id: `C${index + 1}`,
    claim: row.sentence,
    citations: [row.evidence_id],
    support_status: "supported",
  }));
  return {
    answer_type: "grounded_answer",
    evidence_first: {
      sufficiency: "sufficient",
      supported_claims: claims,
      missing_support: "",
      question_target: input.question ?? "exact_question_target",
    },
    answer: `${selected.map((row) => row.sentence).join(" ")} ${citations.map((id) => `[${id}]`).join(" ")}`,
    citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function rankEvidence(question, evidencePack) {
  const questionTokens = new Set(tokenList(question));
  return evidencePack.map((evidence) => {
    const sentences = splitSentences(evidence.text);
    const best = sentences
      .map((sentence) => ({ sentence: cleanSentence(sentence), score: overlapScore(questionTokens, `${evidence.section ?? ""} ${sentence}`) }))
      .sort((left, right) => right.score - left.score)[0] ?? { sentence: cleanSentence(evidence.text), score: 0 };
    return { evidence_id: evidence.evidence_id, sentence: best.sentence, score: best.score };
  }).sort((left, right) => right.score - left.score || left.evidence_id.localeCompare(right.evidence_id));
}

function overlapScore(questionTokens, text) {
  const tokens = tokenList(text);
  if (!tokens.length || !questionTokens.size) return 0;
  const overlap = tokens.filter((token) => questionTokens.has(token)).length;
  const coverage = overlap / questionTokens.size;
  const density = overlap / tokens.length;
  const numericBonus = tokens.some((token) => /[0-9]/.test(token)) ? 0.02 : 0;
  return coverage + density + numericBonus;
}

function abstain(question, score) {
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: `Train-calibrated scaffold score ${score.toFixed(3)} was below the support threshold for: ${question}`,
      question_target: question ?? "exact_question_target",
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The scaffold did not find enough calibrated direct support in the compact evidence pack.",
  };
}

function scorePrediction(prediction, target) {
  const answerTypeCorrect = prediction?.answer_type === target?.answer_type;
  const citationSetExact = prediction?.answer_type === "abstain"
    ? normalizeCitations(prediction?.citations).length === 0
    : sameCitationSet(prediction?.citations, target?.citations ?? []);
  return {
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    contract_correct: Boolean(answerTypeCorrect && citationSetExact),
  };
}

function trainLogistic(rows, scaler, options) {
  const dim = rows[0]?.feature_values.length ?? 0;
  const weights = Array(dim).fill(0);
  let intercept = 0;
  for (let epoch = 0; epoch < options.epochs; epoch += 1) {
    const grad = Array(dim).fill(0);
    let biasGrad = 0;
    for (const row of rows) {
      const x = scale(row.feature_values, scaler);
      const prediction = sigmoid(dot(weights, x) + intercept);
      const error = prediction - row.label_contract_correct;
      biasGrad += error;
      for (let i = 0; i < dim; i += 1) grad[i] += error * x[i];
    }
    const n = Math.max(1, rows.length);
    intercept -= options.learningRate * (biasGrad / n);
    for (let i = 0; i < dim; i += 1) weights[i] -= options.learningRate * ((grad[i] / n) + (options.l2 * weights[i]));
  }
  return { weights, intercept };
}

function predictProb(model, scaler, features) {
  return sigmoid(dot(model.weights, scale(features, scaler)) + model.intercept);
}

function makeScaler(rows) {
  const dim = rows[0]?.length ?? 0;
  const means = Array(dim).fill(0);
  const scales = Array(dim).fill(1);
  for (const row of rows) for (let i = 0; i < dim; i += 1) means[i] += row[i] ?? 0;
  for (let i = 0; i < dim; i += 1) means[i] /= Math.max(1, rows.length);
  for (const row of rows) for (let i = 0; i < dim; i += 1) scales[i] += ((row[i] ?? 0) - means[i]) ** 2;
  for (let i = 0; i < dim; i += 1) scales[i] = Math.sqrt(scales[i] / Math.max(1, rows.length)) || 1;
  return { means, scales };
}

function scale(features, scaler) {
  return features.map((value, index) => (Number(value ?? 0) - scaler.means[index]) / scaler.scales[index]);
}

function statusFor(validationMetrics) {
  if (validationMetrics.contract_correct > 47) return "train_supervised_nli_router_beats_non_nli_router";
  if (validationMetrics.contract_correct > 44) return "train_supervised_nli_router_beats_scaffold_not_router";
  if (validationMetrics.contract_correct === 44) return "train_supervised_nli_router_ties_scaffold";
  return "train_supervised_nli_router_does_not_beat_scaffold";
}

function nextStepFor(validationMetrics, validationOracle) {
  if (validationMetrics.contract_correct > 47) return "Freeze the NLI router as the leading zero-spend verifier candidate for a fresh heldout test before any paid judge or Prime launch.";
  if (validationMetrics.contract_correct > 44) return "Keep the NLI features as an ablation, but the non-NLI router remains the stronger candidate unless a fresh split reverses this.";
  if (validationOracle.contract_correct > 44) return "The train-supervised shallow router does not transfer; move to a stronger claim/evidence verifier or fresh non-validation router labels.";
  return "Candidate routing is not the bottleneck for this reduced pool; improve candidate construction.";
}

function citedEvidenceText(input, citations) {
  const wanted = new Set(citations);
  return (input?.compact_retrieved_evidence_pack ?? [])
    .filter((evidence) => wanted.has(evidence.evidence_id))
    .map((evidence) => `${evidence.section ?? ""} ${evidence.text ?? ""}`)
    .join(" ");
}

function tokenList(text) {
  return String(text ?? "").toLowerCase().split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stopwords.has(token));
}

function tokenSet(text) {
  return new Set(tokenList(text));
}

function numberSet(text) {
  return new Set([...String(text ?? "").matchAll(/\b\d+(?:[,.]\d+)*(?:\.\d+)?%?\b/g)].map((match) => match[0]));
}

function isRiskyQuestion(question) {
  return /\b(percentage|percent|how many|how much|statistically significant|which are three|compare|difference|ratio|previous|state.of.the.art|fewer|more)\b/i.test(question ?? "");
}

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean).slice(0, 6);
}

function cleanSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function stripCitations(text) {
  return String(text ?? "").replace(/\[[A-Za-z]?\d+\]/g, " ").replace(/\s+/g, " ");
}

function normalizedText(text) {
  return stripCitations(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function truncate(text, maxLength) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value ?? 0), 0) / values.length : 0;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function overlapCount(leftSet, rightSet) {
  let total = 0;
  for (const value of leftSet) if (rightSet.has(value)) total += 1;
  return total;
}

function sameCitationSet(left, right) {
  const leftSet = new Set(normalizeCitations(left));
  const rightSet = new Set(normalizeCitations(right));
  if (leftSet.size !== rightSet.size) return false;
  for (const value of leftSet) if (!rightSet.has(value)) return false;
  return true;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation)).filter(Boolean);
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function dot(left, right) {
  let total = 0;
  for (let i = 0; i < left.length; i += 1) total += left[i] * (right[i] ?? 0);
  return total;
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value))));
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function renderReport(result) {
  return `# Train-Supervised NLI Router Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This router is trained only on repaired train-tune rows, with local open-weight NLI features, and evaluated on heldout train plus repaired validation.

## Metrics

| Split | Contract Correct | Answer Type | Citation Exact |
| --- | ---: | ---: | ---: |
| Train tune | ${result.metrics.train_tune.contract_correct}/${result.metrics.train_tune.examples} (${pct(result.metrics.train_tune.contract_correct_rate)}) | ${pct(result.metrics.train_tune.answer_type_accuracy)} | ${pct(result.metrics.train_tune.citation_set_exact_rate)} |
| Train heldout | ${result.metrics.train_heldout.contract_correct}/${result.metrics.train_heldout.examples} (${pct(result.metrics.train_heldout.contract_correct_rate)}) | ${pct(result.metrics.train_heldout.answer_type_accuracy)} | ${pct(result.metrics.train_heldout.citation_set_exact_rate)} |
| Repaired validation | ${result.metrics.repaired_validation_gate.contract_correct}/${result.metrics.repaired_validation_gate.examples} (${pct(result.metrics.repaired_validation_gate.contract_correct_rate)}) | ${pct(result.metrics.repaired_validation_gate.answer_type_accuracy)} | ${pct(result.metrics.repaired_validation_gate.citation_set_exact_rate)} |

## Baseline Comparison

- Train-calibrated scaffold: ${result.baseline_comparison.train_calibrated_scaffold_contract_correct}/70
- Non-NLI train-supervised router: 47/70
- Train-selected constrained policy: ${result.baseline_comparison.train_selected_constrained_policy_contract_correct}/70
- Learned repaired selector: ${result.baseline_comparison.learned_repaired_selector_contract_correct}/70
- Three-system validation oracle: ${result.baseline_comparison.validation_pool_oracle_contract_correct}/70
- Train-supervised router: ${result.baseline_comparison.selected_validation_contract_correct}/70
- Delta vs scaffold: ${result.baseline_comparison.delta_vs_train_calibrated_scaffold}
- Delta vs three-system oracle: ${result.baseline_comparison.delta_vs_three_system_oracle}

## Decision

- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Promote as policy: ${result.decision.promote_as_policy ? "yes" : "no"}
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
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
