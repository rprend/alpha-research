import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const launchPacketRunId = args["launch-packet-run-id"] ?? "frontier-repaired-launch-packet-2026-06-29-v1";
const evalPacketRunId = args["eval-packet-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "frontier-repaired-train-calibrated-scaffold-smoke-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const launchDatasetDir = path.join(runsDir, launchPacketRunId, "dataset");
const evalDatasetDir = path.join(runsDir, evalPacketRunId, "dataset");

await fs.mkdir(outputDir, { recursive: true });

const launchPacket = await readJson(path.join(runsDir, launchPacketRunId, "result.json"));
const evalPacket = await readJson(path.join(runsDir, evalPacketRunId, "result.json"));
const trainRows = await readJsonl(path.join(launchDatasetDir, "sft_train.jsonl"));
const evalPrompts = await readJsonl(path.join(evalDatasetDir, "eval_prompts.jsonl"));
const evalTargets = await readJsonl(path.join(evalDatasetDir, "eval_targets_diagnostic.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const calibration = calibrate(trainRows);
const predictions = evalPrompts.map((prompt) => predictPrompt(prompt, calibration.params));
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);

const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);
const targetDistribution = summarizeTargets(evalTargets);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "frontier_repaired_train_calibrated_scaffold_smoke",
  status: gate.metrics.overall_contract_correct_rate > 0.5571428571428572
    ? "train_calibrated_scaffold_beats_abstention_prior"
    : "train_calibrated_scaffold_does_not_beat_abstention_prior",
  purpose: "Evaluate a zero-spend scaffold calibrated on repaired train labels against the broader repaired validation gate.",
  source_runs: {
    launch_packet: launchPacketRunId,
    eval_packet: evalPacketRunId,
    contract_gate: gateRunId,
  },
  source_context: {
    launch_packet_status: launchPacket.status,
    eval_packet_status: evalPacket.status,
  },
  calibration,
  predictions: {
    examples: predictions.length,
    grounded_answer: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstain: predictions.filter((row) => row.prediction.answer_type === "abstain").length,
  },
  target_distribution: targetDistribution,
  contract_gate_metrics: gate.metrics,
  baseline_comparison: {
    abstention_prior_overall_contract_correct_rate: 39 / 70,
    delta_vs_abstention_prior: gate.metrics.overall_contract_correct_rate - (39 / 70),
  },
  decision: {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    prime_smoke_requires_better_than_this_scaffold: true,
    reason: "This zero-spend scaffold gives a stronger pre-Prime baseline on repaired validation; a paid student run should beat it before grounded-correctness judging.",
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
    note: "This scaffold uses only repaired train labels and local deterministic contract scoring.",
  },
  artifacts: {
    predictions_jsonl: rel(predictionsPath),
    contract_gate_result_json: rel(path.join(runsDir, gateRunId, "result.json")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  calibration: result.calibration,
  predictions: result.predictions,
  contract_gate_metrics: result.contract_gate_metrics,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
}, null, 2));

function calibrate(rows) {
  const thresholds = [0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32, 0.36, 0.4, 0.46, 0.52, 0.58];
  const citationCounts = [1, 2, 3];
  const riskPenalties = [0, 0.04, 0.08, 0.12];
  const directWeights = [0, 0.03, 0.06, 0.09];
  let best = null;
  for (const threshold of thresholds) {
    for (const citationCount of citationCounts) {
      for (const riskPenalty of riskPenalties) {
        for (const directWeight of directWeights) {
          const params = { threshold, citation_count: citationCount, risk_penalty: riskPenalty, direct_weight: directWeight };
          const scored = rows.map((row) => scoreTrainingRow(row, params));
          const overall = rate(scored.filter((row) => row.contract_correct).length, scored.length);
          const answerType = rate(scored.filter((row) => row.answer_type_correct).length, scored.length);
          const answerRate = rate(scored.filter((row) => row.prediction_answer_type === "grounded_answer").length, scored.length);
          const objective = overall - Math.abs(answerRate - 0.46) * 0.03;
          const candidate = { params, train_overall_contract_correct_rate: overall, train_answer_type_accuracy: answerType, train_answer_rate: answerRate, objective };
          if (!best || candidate.objective > best.objective) best = candidate;
        }
      }
    }
  }
  return {
    train_examples: rows.length,
    selected_by: "grid_search_train_contract_correct_with_mild_answer_rate_regularizer",
    ...best,
  };
}

function scoreTrainingRow(row, params) {
  const prediction = predictInput(row.example_id, row.input, params);
  const target = row.target;
  const answerTypeCorrect = prediction.answer_type === target.answer_type;
  const citationSetExact = prediction.answer_type === "abstain"
    ? prediction.citations.length === 0
    : setEqual(new Set(prediction.citations), new Set(target.citations ?? []));
  return {
    example_id: row.example_id,
    prediction_answer_type: prediction.answer_type,
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    contract_correct: answerTypeCorrect && citationSetExact,
  };
}

function predictPrompt(prompt, params) {
  const prediction = predictInput(prompt.example_id, prompt.input, params);
  return {
    example_id: prompt.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    metadata: {
      scaffold: "train_calibrated_overlap_answerability",
      params,
      no_model_weights_or_llm_calls: true,
    },
  };
}

function predictInput(exampleId, input, params) {
  const counterfactual = input.document_metadata?.counterfactual === true || String(exampleId).includes(":counterfactual-insufficient");
  const ranked = rankEvidence(input.question, input.compact_retrieved_evidence_pack ?? []);
  const topScore = ranked[0]?.score ?? 0;
  const directSignalCount = ranked.filter((row) => row.score >= 0.12).length;
  const risky = /\b(how much|percentage|statistically significant|which are three|how many|what percentage)\b/i.test(input.question ?? "");
  const score = topScore + params.direct_weight * Math.min(directSignalCount, 3) - (risky ? params.risk_penalty : 0);
  if (counterfactual || score < params.threshold) {
    return abstain(input.question, score);
  }
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
  const questionTokens = new Set(contentTokens(question));
  return evidencePack.map((evidence) => {
    const sentences = splitSentences(evidence.text);
    const best = sentences
      .map((sentence) => ({ sentence: cleanSentence(sentence), score: overlapScore(questionTokens, `${evidence.section ?? ""} ${sentence}`) }))
      .sort((left, right) => right.score - left.score)[0] ?? { sentence: cleanSentence(evidence.text), score: 0 };
    return {
      evidence_id: evidence.evidence_id,
      sentence: best.sentence,
      score: best.score,
    };
  }).sort((left, right) => right.score - left.score || left.evidence_id.localeCompare(right.evidence_id));
}

function overlapScore(questionTokens, text) {
  const tokens = contentTokens(text);
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

async function runContractGate(gateRunId, predictionsPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join("scripts", "grounded-qa-distillation-evidence-first-contract-preflight.mjs"),
      `--packet-run-id=${evalPacketRunId}`,
      `--prediction-file=${path.relative(rootDir, predictionsPath)}`,
      `--run-id=${gateRunId}`,
    ], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Contract gate failed with code ${code}: ${stderr}`));
    });
  });
  return readJson(path.join(runsDir, gateRunId, "result.json"));
}

function summarizeTargets(rows) {
  return {
    examples: rows.length,
    grounded_answer: rows.filter((row) => row.target.answer_type === "grounded_answer").length,
    abstain: rows.filter((row) => row.target.answer_type === "abstain").length,
  };
}

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean).slice(0, 5);
}

function cleanSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 260);
}

function contentTokens(text) {
  const stop = new Set(["the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "what", "which", "they", "them", "does", "did", "any", "how", "their", "there", "using", "used", "into", "than", "then", "also", "only", "specific"]);
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stop.has(token));
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function renderReport(result) {
  return `# Frontier Repaired Train-Calibrated Scaffold Smoke

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Calibration

- Train examples: ${result.calibration.train_examples}
- Train contract correctness: ${pct(result.calibration.train_overall_contract_correct_rate)}
- Train answer-type accuracy: ${pct(result.calibration.train_answer_type_accuracy)}
- Train answer rate: ${pct(result.calibration.train_answer_rate)}

## Validation Gate

- Predictions: ${result.predictions.grounded_answer} grounded answers, ${result.predictions.abstain} abstentions
- Overall contract correct: ${pct(result.contract_gate_metrics.overall_contract_correct_rate)}
- Answer-type accuracy: ${pct(result.contract_gate_metrics.answer_type_accuracy)}
- Delta vs abstention prior: ${pct(result.baseline_comparison.delta_vs_abstention_prior)}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Prime smoke requires better than this scaffold: ${result.decision.prime_smoke_requires_better_than_this_scaffold ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
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

function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function rel(file) {
  return path.relative(rootDir, file);
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
