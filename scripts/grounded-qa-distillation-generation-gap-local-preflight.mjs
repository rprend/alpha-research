import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "generation-gap-curriculum-packet-d320-final-gaps-2026-06-28-v1";
const harnessRunId = args["harness-run-id"] ?? "generation-gap-eval-harness-d321-fixture-2026-06-28-v1";
const runId = args["run-id"] ?? "generation-gap-local-extractive-preflight-d321-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const packetDir = path.join(runsDir, packetRunId);
const datasetDir = path.join(packetDir, "dataset");
const prompts = await readJsonl(path.join(datasetDir, "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(datasetDir, "eval_targets_diagnostic.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const predictions = prompts.map(predict);
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);

const evalRunId = `${runId}-shape-eval`;
const evalResult = await runHarness(evalRunId, predictionsPath);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "generation_gap_local_extractive_preflight",
  status: deriveStatus(evalResult),
  purpose: "Run a zero-spend deterministic extractive generation baseline through the fixed D322 generation-gap harness before renting Prime or buying grounded-correctness judgments.",
  source_runs: {
    packet: packetRunId,
    fixture_harness: harnessRunId,
    shape_eval: evalRunId,
  },
  prediction_policy: {
    name: "question_overlap_extractive_with_counterfactual_abstention",
    abstain_rule: "Abstain when the prompt metadata is counterfactual or every evidence sentence has weak question overlap.",
    answer_rule: "Choose up to two evidence sentences with highest question/content overlap and cite their evidence ids inline.",
    no_model_weights_or_llm_calls: true,
  },
  predictions: {
    examples: predictions.length,
    answered: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstained: predictions.filter((row) => row.prediction.answer_type === "abstain").length,
    citation_complete_answers: predictions.filter((row) => row.prediction.answer_type === "grounded_answer" && row.prediction.citations.every((id) => row.prediction.answer.includes(`[${id}]`))).length,
  },
  shape_eval_metrics: evalResult.metrics,
  failure_analysis: failureAnalysis(evalResult),
  decision: {
    local_preflight_passed_shape_gate: evalResult.status === "model_predictions_pass_shape_gate_needs_grounded_judge",
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    next_step: evalResult.status === "model_predictions_pass_shape_gate_needs_grounded_judge"
      ? "Consider a paid/stronger grounded-correctness judge on these predictions before a larger Prime run."
      : "Do not judge or scale this extractor; use its failures to justify a small trained generation/repair model preflight.",
    reason: evalResult.status === "model_predictions_pass_shape_gate_needs_grounded_judge"
      ? "The zero-spend extractor clears the shape gate, so correctness adjudication would be the next bottleneck."
      : "The zero-spend extractor does not clear the fixed D322 shape gate, so cheap extraction is insufficient for the D320 generation gaps.",
  },
  leakage_guard: {
    final_targets_used_for_generation: false,
    final_targets_used_for_training: false,
    final_targets_used_for_model_selection: false,
    final_targets_used_for_shape_eval_only: true,
    training_use: "none_zero_shot_local_preflight",
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
    note: "The preflight is deterministic local extraction plus local harness scoring.",
  },
  artifacts: {
    predictions_jsonl: rel(predictionsPath),
    shape_eval_result_json: rel(path.join(runsDir, evalRunId, "result.json")),
    shape_eval_scored_predictions_jsonl: rel(path.join(runsDir, evalRunId, "scored_predictions.jsonl")),
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  predictions: result.predictions,
  shape_eval_metrics: result.shape_eval_metrics,
  failure_analysis: result.failure_analysis,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function predict(prompt) {
  const input = prompt.input;
  const evidence = input.compact_retrieved_evidence_pack ?? [];
  const counterfactual = input.document_metadata?.counterfactual === true || prompt.example_id.includes(":counterfactual-insufficient");
  if (counterfactual) {
    const prediction = abstain("Counterfactual or insufficient-evidence prompt.");
    return { example_id: prompt.example_id, prediction, raw_output: JSON.stringify(prediction), metadata: { policy: "counterfactual_abstention" } };
  }
  const ranked = rankSentences(input.question, evidence);
  const selected = ranked.filter((row) => row.score >= 0.08).slice(0, 2);
  if (!selected.length) {
    const prediction = abstain("No evidence sentence has enough lexical overlap with the question.");
    return { example_id: prompt.example_id, prediction, raw_output: JSON.stringify(prediction), metadata: { policy: "low_overlap_abstention", top_score: ranked[0]?.score ?? 0 } };
  }
  const citations = unique(selected.map((row) => row.evidence_id));
  const answer = `${selected.map((row) => row.sentence).join("; ")} ${citations.map((id) => `[${id}]`).join(" ")}`;
  const prediction = {
    answer_type: "grounded_answer",
    answer,
    citations,
    claim_table: selected.map((row) => ({ claim: row.sentence, support: "extractive_sentence", citations: [row.evidence_id] })),
    abstention_reason: null,
  };
  return {
    example_id: prompt.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    metadata: {
      policy: "question_overlap_extractive",
      selected_scores: selected.map((row) => ({ evidence_id: row.evidence_id, score: row.score })),
    },
  };
}

function rankSentences(question, evidence) {
  const questionTokens = new Set(contentTokens(question));
  const titleBonusTerms = new Set(["yes", "no", "which", "how", "many", "specific"]);
  const rows = [];
  for (const item of evidence) {
    for (const sentence of splitSentences(item.text).slice(0, 5)) {
      const tokens = contentTokens(`${item.section ?? ""} ${sentence}`);
      if (tokens.length < 3) continue;
      const overlap = tokens.filter((token) => questionTokens.has(token)).length;
      const coverage = questionTokens.size ? overlap / questionTokens.size : 0;
      const density = overlap / Math.max(tokens.length, 1);
      const shortBonus = tokens.length <= 18 ? 0.04 : 0;
      const yesNoBonus = [...questionTokens].some((token) => titleBonusTerms.has(token)) && /\b(no|yes|not|whether|if)\b/i.test(sentence) ? 0.03 : 0;
      rows.push({
        evidence_id: item.evidence_id,
        sentence: cleanSentence(sentence),
        score: coverage + density + shortBonus + yesNoBonus,
      });
    }
  }
  return rows.sort((left, right) => right.score - left.score || left.evidence_id.localeCompare(right.evidence_id));
}

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean);
}

function cleanSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 280);
}

function abstain(reason) {
  return {
    answer_type: "abstain",
    answer: "The evidence pack does not contain enough support to answer this question.",
    citations: [],
    claim_table: [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }],
    abstention_reason: reason,
  };
}

function failureAnalysis(evalResult) {
  const metrics = evalResult.metrics ?? {};
  return {
    failed_shape_gate: evalResult.status !== "model_predictions_pass_shape_gate_needs_grounded_judge",
    answerable_shape_gap: 1 - Number(metrics.answerable_supported_shape_rate ?? 0),
    abstention_shape_gap: 1 - Number(metrics.abstention_shape_rate ?? 0),
    citation_exact_gap: 1 - Number(metrics.citation_set_exact_rate ?? 0),
    mean_answer_token_f1: metrics.mean_answer_token_f1,
  };
}

function deriveStatus(evalResult) {
  if (evalResult.status === "model_predictions_pass_shape_gate_needs_grounded_judge") return "local_extractive_preflight_passed_shape_gate";
  return "local_extractive_preflight_failed_shape_gate";
}

async function runHarness(evalRunId, predictionsPath) {
  const script = path.join("scripts", "grounded-qa-distillation-generation-gap-eval-harness.mjs");
  const relativePredictions = path.relative(rootDir, predictionsPath);
  const args = [
    script,
    "--packet-run-id",
    packetRunId,
    "--prediction-file",
    relativePredictions,
    "--run-id",
    evalRunId,
  ];
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Harness failed with code ${code}: ${stderr}`));
    });
  });
  return readJson(path.join(runsDir, evalRunId, "result.json"));
}

function renderReport(result) {
  return `# Generation Gap Local Extractive Preflight

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime job.

## Prediction Counts

| Examples | Answered | Abstained | Citation-complete answers |
| ---: | ---: | ---: | ---: |
| ${result.predictions.examples} | ${result.predictions.answered} | ${result.predictions.abstained} | ${result.predictions.citation_complete_answers} |

## Shape Eval

| Answer type accuracy | Answerable supported shape | Abstention shape | Citation exact | Mean answer F1 | Overall shape correct |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${pct(result.shape_eval_metrics.answer_type_accuracy)} | ${pct(result.shape_eval_metrics.answerable_supported_shape_rate)} | ${pct(result.shape_eval_metrics.abstention_shape_rate)} | ${pct(result.shape_eval_metrics.citation_set_exact_rate)} | ${pct(result.shape_eval_metrics.mean_answer_token_f1)} | ${pct(result.shape_eval_metrics.overall_shape_correct_rate)} |

## Decision

- Local preflight passed shape gate: ${result.decision.local_preflight_passed_shape_gate ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function contentTokens(text) {
  const stop = new Set(["the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "how", "what", "which", "they", "them", "does", "did", "under", "specific"]);
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stop.has(token));
}

function unique(values) {
  return [...new Set(values)];
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

function rel(file) {
  return path.relative(rootDir, file);
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
