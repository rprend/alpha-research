import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "frontier-repaired-launch-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "frontier-repaired-abstention-prior-scaffold-smoke-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(runsDir, packetRunId, "dataset");

await fs.mkdir(outputDir, { recursive: true });

const packet = await readJson(path.join(runsDir, packetRunId, "result.json"));
const prompts = await readJsonl(path.join(datasetDir, "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(datasetDir, "eval_targets_diagnostic.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const predictions = prompts.map(predict);
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);

const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);
const isDiagnosticGate = prompts.length === 10;
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "frontier_repaired_abstention_prior_scaffold_smoke",
  status: statusFor(gate.metrics.overall_contract_correct_rate, isDiagnosticGate),
  purpose: "Establish a zero-spend conservative scaffold baseline against repaired diagnostic targets before renting GPU.",
  source_runs: {
    repaired_launch_packet: packetRunId,
    contract_gate: gateRunId,
  },
  source_context: {
    packet_status: packet.status,
  },
  predictions: {
    examples: predictions.length,
    grounded_answer: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstain: predictions.filter((row) => row.prediction.answer_type === "abstain").length,
  },
  target_distribution: {
    examples: targets.length,
    grounded_answer: targets.filter((row) => row.target.answer_type === "grounded_answer").length,
    abstain: targets.filter((row) => row.target.answer_type === "abstain").length,
  },
  contract_gate_metrics: gate.metrics,
  interpretation: {
    diagnostic_is_abstention_heavy: targets.filter((row) => row.target.answer_type === "abstain").length / Math.max(targets.length, 1) >= 0.8,
    scaffold_limitation: "This scaffold is useful as a cheap abstention baseline, not as a final system; a model or richer scaffold must beat it on broader repaired validation.",
  },
  decision: {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    build_broader_repaired_validation_gate_next: isDiagnosticGate,
    use_broader_validation_gate_for_prime_acceptance: !isDiagnosticGate,
    reason: isDiagnosticGate
      ? "The repaired 10-row diagnostic can be passed by a conservative abstention-prior scaffold, so the next training run needs a broader repaired validation gate before paid judging or Prime scaling."
      : "The broader repaired validation gate exposes the abstention-prior scaffold as insufficient, so future student/scaffold runs must beat this gate before paid judging or Prime scaling.",
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
    note: "This scaffold smoke is deterministic local inference and local contract scoring.",
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
  predictions: result.predictions,
  contract_gate_metrics: result.contract_gate_metrics,
  decision: result.decision,
}, null, 2));

function predict(prompt) {
  const prediction = {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: `Conservative scaffold requires explicit direct support for the exact target: ${prompt.input?.question ?? "question"}`,
      question_target: prompt.input?.question ?? "exact_question_target",
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "Conservative abstention-prior scaffold did not find enough direct support to answer.",
  };
  return {
    example_id: prompt.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    metadata: {
      scaffold: "abstention_prior_exact_target_guard",
      no_model_weights_or_llm_calls: true,
    },
  };
}

function statusFor(overallRate, diagnostic) {
  if (diagnostic && overallRate >= 0.8) return "scaffold_passes_repaired_diagnostic_but_is_abstention_saturated";
  if (diagnostic) return "scaffold_fails_repaired_diagnostic";
  if (overallRate >= 0.8) return "scaffold_passes_repaired_validation_gate";
  return "scaffold_fails_repaired_validation_gate";
}

async function runContractGate(gateRunId, predictionsPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join("scripts", "grounded-qa-distillation-evidence-first-contract-preflight.mjs"),
      `--packet-run-id=${packetRunId}`,
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

function renderReport(result) {
  return `# Frontier Repaired Abstention-Prior Scaffold Smoke

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Predictions

- Examples: ${result.predictions.examples}
- Grounded answers: ${result.predictions.grounded_answer}
- Abstentions: ${result.predictions.abstain}

## Contract Gate

- Parseable: ${pct(result.contract_gate_metrics.parseable_rate)}
- Evidence-first valid: ${pct(result.contract_gate_metrics.evidence_first_valid_rate)}
- Answer-type accuracy: ${pct(result.contract_gate_metrics.answer_type_accuracy)}
- Citation-set exact: ${pct(result.contract_gate_metrics.citation_set_exact_rate)}
- Overall contract correct: ${pct(result.contract_gate_metrics.overall_contract_correct_rate)}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Build broader repaired validation gate next: ${result.decision.build_broader_repaired_validation_gate_next ? "yes" : "no"}
- Use broader validation gate for Prime acceptance: ${result.decision.use_broader_validation_gate_for_prime_acceptance ? "yes" : "no"}
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
