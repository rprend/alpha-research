import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2";
const predictionRunId = args["prediction-run-id"] ?? "joint-action-qwen3b-smoke-eval-v1";
const runId = args["run-id"] ?? `qwen3b-prediction-integrity-gate-${predictionRunId}`;
const outputDir = path.join(runsDir, runId);
const packetDir = path.join(runsDir, packetRunId);
const predictionDir = path.join(runsDir, predictionRunId);
const evalPromptsPath = path.join(packetDir, "dataset", "eval_prompts.jsonl");
const predictionsPath = path.join(predictionDir, "predictions.jsonl");
const evalResultPath = path.join(predictionDir, "result.json");
const smokeManifestPath = path.join(predictionDir, "smoke_manifest.json");

await fs.mkdir(outputDir, { recursive: true });

const evalRows = await readJsonl(evalPromptsPath);
const evalById = new Map(evalRows.map((row) => [row.example_id, row]));
const checks = {
  prediction_artifact_exists: await exists(predictionsPath),
  eval_result_exists: await exists(evalResultPath),
  smoke_manifest_exists: await exists(smokeManifestPath),
  expected_eval_examples: evalRows.length,
};

let predictions = [];
let evalResult = null;
let smokeManifest = null;
const failures = [];
const warnings = [];

if (!checks.prediction_artifact_exists) {
  failures.push(`Missing predictions artifact: ${path.relative(rootDir, predictionsPath)}`);
} else {
  predictions = await readJsonl(predictionsPath);
}

if (checks.eval_result_exists) {
  evalResult = JSON.parse(await fs.readFile(evalResultPath, "utf8"));
}
if (checks.smoke_manifest_exists) {
  smokeManifest = JSON.parse(await fs.readFile(smokeManifestPath, "utf8"));
}

if (predictions.length) {
  checkPredictionRows({ predictions, evalById, failures, warnings });
}

if (evalResult) {
  if (evalResult.run_id !== predictionRunId) failures.push(`Eval result run_id ${evalResult.run_id} does not match ${predictionRunId}.`);
  if (Number(evalResult.eval?.examples) !== predictions.length) {
    failures.push(`Eval result examples ${evalResult.eval?.examples} does not match predictions row count ${predictions.length}.`);
  }
  if (Number(evalResult.cost?.openai_calls) !== 0 || Number(evalResult.cost?.openai_cost_usd) !== 0) {
    failures.push("Adapter eval result must record zero OpenAI calls and zero OpenAI cost.");
  }
} else if (checks.prediction_artifact_exists) {
  failures.push(`Missing eval result: ${path.relative(rootDir, evalResultPath)}`);
}

if (smokeManifest) {
  if (smokeManifest.run_id !== predictionRunId) failures.push(`Smoke manifest run_id ${smokeManifest.run_id} does not match ${predictionRunId}.`);
  if (Number(smokeManifest.max_sft_steps) > 20) failures.push("Smoke manifest max_sft_steps exceeds bounded smoke cap.");
  if (Number(smokeManifest.max_dpo_steps) > 10) failures.push("Smoke manifest max_dpo_steps exceeds bounded smoke cap.");
  if (smokeManifest.push_to_hub !== false) failures.push("Smoke manifest must keep push_to_hub false.");
} else if (checks.prediction_artifact_exists) {
  failures.push(`Missing smoke manifest: ${path.relative(rootDir, smokeManifestPath)}`);
}

const metrics = summarizeIntegrity({ predictions, evalById });
const status = checks.prediction_artifact_exists
  ? (failures.length ? "refuse_paid_judge_prediction_integrity_failed" : "ready_for_paid_judge")
  : "waiting_for_qwen3b_predictions";

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  gate_type: "qwen3b_prediction_integrity_prejudge_gate",
  packet_run_id: packetRunId,
  prediction_run_id: predictionRunId,
  artifacts: {
    eval_prompts_jsonl: path.relative(rootDir, evalPromptsPath),
    predictions_jsonl: path.relative(rootDir, predictionsPath),
    eval_result_json: path.relative(rootDir, evalResultPath),
    smoke_manifest_json: path.relative(rootDir, smokeManifestPath),
  },
  checks: {
    ...checks,
    prediction_rows: predictions.length,
    unique_prediction_ids: new Set(predictions.map((row) => row.example_id)).size,
    failures,
    warnings,
  },
  metrics,
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This integrity gate reads local artifacts only and makes no model/API calls.",
  },
  conclusion: {
    status,
    next_step: status === "ready_for_paid_judge"
      ? "Run the dry judge command, then the paid grounded-correctness judge if the budget gate still passes."
      : status === "waiting_for_qwen3b_predictions"
        ? "Run the bounded remote Qwen 3B smoke to create predictions.jsonl, result.json, and smoke_manifest.json."
        : "Inspect and repair the Qwen 3B prediction run before spending OpenAI judge budget.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function checkPredictionRows({ predictions, evalById, failures, warnings }) {
  const seen = new Set();
  const expectedIds = new Set(evalById.keys());
  const predictionIds = new Set();
  let parseErrors = 0;

  for (const [index, row] of predictions.entries()) {
    const label = row.example_id ?? `row_${index + 1}`;
    if (!row.example_id) failures.push(`Prediction row ${index + 1} is missing example_id.`);
    if (seen.has(row.example_id)) failures.push(`Duplicate prediction example_id: ${row.example_id}`);
    seen.add(row.example_id);
    predictionIds.add(row.example_id);

    const evalRow = evalById.get(row.example_id);
    if (!evalRow) {
      failures.push(`Prediction ${label} is not in eval_prompts.jsonl.`);
      continue;
    }

    const prediction = row.prediction;
    if (!prediction || typeof prediction !== "object") {
      failures.push(`Prediction ${label} missing prediction object.`);
      continue;
    }
    if (!["grounded_answer", "abstain"].includes(prediction.answer_type)) {
      failures.push(`Prediction ${label} has invalid answer_type ${prediction.answer_type}.`);
    }
    if (typeof prediction.answer !== "string") failures.push(`Prediction ${label} answer must be a string.`);
    if (!Array.isArray(prediction.citations)) failures.push(`Prediction ${label} citations must be an array.`);
    if (!Array.isArray(prediction.claim_table)) failures.push(`Prediction ${label} claim_table must be an array.`);
    if (row.parse_error) parseErrors += 1;

    const evidenceIds = new Set(evalRow.input.compact_retrieved_evidence_pack.map((evidence) => evidence.evidence_id));
    for (const citation of prediction.citations ?? []) {
      if (!evidenceIds.has(citation)) failures.push(`Prediction ${label} cites unknown evidence id ${citation}.`);
      if (prediction.answer_type === "grounded_answer" && !String(prediction.answer ?? "").includes(`[${citation}]`)) {
        warnings.push(`Prediction ${label} lists citation ${citation} but does not cite it inline.`);
      }
    }
    if (prediction.answer_type === "abstain" && (prediction.citations ?? []).length) {
      failures.push(`Prediction ${label} abstains but still lists citations.`);
    }
    if (prediction.answer_type === "grounded_answer" && !(prediction.citations ?? []).length) {
      warnings.push(`Prediction ${label} answers without citations.`);
    }
    if (!row.reference || row.reference.answer_type !== evalRow.reference.answer_type) {
      failures.push(`Prediction ${label} reference does not match eval prompt reference.`);
    }
    if (!row.scores || typeof row.scores !== "object") failures.push(`Prediction ${label} missing local score object.`);
    if (!row.metadata || row.metadata.base_model !== "Qwen/Qwen2.5-3B-Instruct") {
      warnings.push(`Prediction ${label} metadata does not identify Qwen/Qwen2.5-3B-Instruct.`);
    }
  }

  for (const expectedId of expectedIds) {
    if (!predictionIds.has(expectedId)) failures.push(`Missing prediction for eval example ${expectedId}.`);
  }
  if (predictions.length !== expectedIds.size) failures.push(`Prediction row count ${predictions.length} does not match expected ${expectedIds.size}.`);
  if (parseErrors) failures.push(`${parseErrors} prediction rows had JSON parse errors.`);
}

function summarizeIntegrity({ predictions, evalById }) {
  const answered = predictions.filter((row) => row.prediction?.answer_type === "grounded_answer").length;
  const abstained = predictions.filter((row) => row.prediction?.answer_type === "abstain").length;
  const citations = predictions.flatMap((row) => row.prediction?.citations ?? []);
  const inlineCited = predictions.flatMap((row) => {
    const answer = String(row.prediction?.answer ?? "");
    return (row.prediction?.citations ?? []).map((citation) => answer.includes(`[${citation}]`));
  });
  return {
    expected_eval_examples: evalById.size,
    prediction_rows: predictions.length,
    answered,
    abstained,
    answer_rate: predictions.length ? answered / predictions.length : null,
    citation_count: citations.length,
    inline_citation_coverage: inlineCited.length ? inlineCited.filter(Boolean).length / inlineCited.length : null,
  };
}

function renderReport(result) {
  return `# Qwen 3B Prediction Integrity Gate

Prediction run: \`${result.prediction_run_id}\`

Status: \`${result.conclusion.status}\`

| Check | Value |
| --- | ---: |
| Expected eval examples | ${result.checks.expected_eval_examples} |
| Prediction rows | ${result.checks.prediction_rows} |
| Unique prediction ids | ${result.checks.unique_prediction_ids} |
| Failures | ${result.checks.failures.length} |
| Warnings | ${result.checks.warnings.length} |

This gate makes no OpenAI calls and launches no GPU jobs. It exists to refuse paid grounded-correctness judging when the Qwen 3B smoke artifacts are missing, incomplete, or malformed.
`;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
