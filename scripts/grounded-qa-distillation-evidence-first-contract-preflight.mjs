import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "evidence-first-contract-packet-2026-06-28-v1";
const predictionFile = args["prediction-file"] ?? null;
const runId = args["run-id"] ?? "evidence-first-contract-preflight-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const packetDir = path.join(runsDir, packetRunId, "dataset");

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const packet = await readJson(path.join(runsDir, packetRunId, "result.json"));
const prompts = await readJsonl(path.join(packetDir, "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(packetDir, "eval_targets_diagnostic.jsonl"));
const targetById = new Map(targets.map((row) => [row.example_id, row]));
const predictionMode = predictionFile ? "external_predictions" : "oracle_fixture";
const predictions = predictionFile
  ? await readJsonl(path.resolve(rootDir, predictionFile))
  : targets.map((row) => ({ example_id: row.example_id, prediction: row.target, raw_output: JSON.stringify(row.target) }));
const predictionById = new Map(predictions.map((row) => [row.example_id, row]));
const scoredRows = prompts.map((prompt) => scorePrompt(prompt, targetById.get(prompt.example_id), predictionById.get(prompt.example_id)));
const metrics = summarize(scoredRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "evidence_first_contract_preflight",
  status: statusFor(predictionMode, metrics),
  purpose: "Evaluate whether evidence-first contract outputs can be parsed and shape-scored before any Prime model launch.",
  packet_run_id: packetRunId,
  prediction_mode: predictionMode,
  prediction_file: predictionFile,
  packet_status: packet.status,
  metrics,
  decision: {
    fixture_passed: predictionMode === "oracle_fixture" && metrics.overall_contract_correct_rate === 1,
    external_predictions_passed: predictionMode === "external_predictions" && metrics.overall_contract_correct_rate >= 0.8,
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    next_step: "Wire the evidence-first packet into a bounded local or Prime model runner only after this preflight is kept green; then judge only if generated predictions pass the contract gate.",
    reason: predictionMode === "oracle_fixture"
      ? "The fixture proves the parser and contract metrics are executable; it does not prove a model can follow the contract."
      : "External predictions were evaluated under the evidence-first contract gate.",
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
    note: "This preflight reads local predictions or target fixtures only.",
  },
  artifacts: {
    scored_predictions_jsonl: rel(path.join(outputDir, "scored_predictions.jsonl")),
    prediction_template_jsonl: rel(path.join(outputDir, "prediction_template.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
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

function scorePrompt(prompt, targetRow, predictionRow) {
  const evidenceIds = new Set((prompt.input?.compact_retrieved_evidence_pack ?? []).map((row) => row.evidence_id));
  const target = targetRow?.target ?? null;
  const parsed = normalizePrediction(predictionRow?.prediction ?? predictionRow?.raw_output);
  const prediction = parsed.prediction;
  const answerTypeCorrect = Boolean(prediction && target && prediction.answer_type === target.answer_type);
  const evidenceFirstValid = validateEvidenceFirst(prediction, evidenceIds);
  const targetCitations = new Set(normalizeCitations(target?.citations ?? []));
  const predictionCitations = new Set(normalizeCitations(prediction?.citations ?? []));
  const citationSetExact = prediction?.answer_type === "abstain"
    ? predictionCitations.size === 0
    : setEqual(predictionCitations, targetCitations);
  const contractCorrect = parsed.ok && evidenceFirstValid.valid && answerTypeCorrect && citationSetExact;
  return {
    example_id: prompt.example_id,
    target_answer_type: target?.answer_type ?? null,
    prediction_answer_type: prediction?.answer_type ?? null,
    parseable: parsed.ok,
    parse_error: parsed.error,
    evidence_first_valid: evidenceFirstValid.valid,
    evidence_first_errors: evidenceFirstValid.errors,
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    contract_correct: contractCorrect,
    prediction,
    target,
  };
}

function validateEvidenceFirst(prediction, evidenceIds) {
  const errors = [];
  const ef = prediction?.evidence_first;
  if (!ef || typeof ef !== "object") errors.push("missing evidence_first");
  const claims = Array.isArray(ef?.supported_claims) ? ef.supported_claims : [];
  if (prediction?.answer_type === "grounded_answer") {
    if (ef?.sufficiency !== "sufficient") errors.push("grounded answer must be sufficient");
    if (!claims.length) errors.push("grounded answer needs supported_claims");
    const union = new Set();
    for (const claim of claims) {
      for (const id of normalizeCitations(claim.citations ?? [])) {
        union.add(id);
        if (!evidenceIds.has(id)) errors.push(`citation ${id} missing from evidence pack`);
      }
    }
    if (!setEqual(union, new Set(normalizeCitations(prediction.citations ?? [])))) errors.push("answer citations must equal claim citation union");
  } else if (prediction?.answer_type === "abstain") {
    if (ef?.sufficiency !== "insufficient") errors.push("abstention must be insufficient");
    if (claims.length) errors.push("abstention cannot have supported_claims");
    if ((prediction.citations ?? []).length) errors.push("abstention cannot have citations");
    if (!ef?.missing_support || !prediction.abstention_reason) errors.push("abstention needs missing support");
  }
  return { valid: errors.length === 0, errors };
}

function summarize(rows) {
  return {
    examples: rows.length,
    parseable_rate: rate(rows.filter((row) => row.parseable).length, rows.length),
    evidence_first_valid_rate: rate(rows.filter((row) => row.evidence_first_valid).length, rows.length),
    answer_type_accuracy: rate(rows.filter((row) => row.answer_type_correct).length, rows.length),
    citation_set_exact_rate: rate(rows.filter((row) => row.citation_set_exact).length, rows.length),
    overall_contract_correct_rate: rate(rows.filter((row) => row.contract_correct).length, rows.length),
  };
}

function statusFor(predictionMode, metrics) {
  if (metrics.examples !== 10) return "evidence_first_preflight_missing_eval_rows";
  if (predictionMode === "oracle_fixture" && metrics.overall_contract_correct_rate === 1) return "evidence_first_fixture_preflight_passed";
  if (predictionMode === "external_predictions" && metrics.overall_contract_correct_rate >= 0.8) return "evidence_first_model_predictions_pass_contract_gate";
  if (predictionMode === "external_predictions") return "evidence_first_model_predictions_fail_contract_gate";
  return "evidence_first_fixture_preflight_failed";
}

function predictionTemplate(prompt) {
  return {
    example_id: prompt.example_id,
    prediction: {
      answer_type: "grounded_answer",
      evidence_first: {
        sufficiency: "sufficient",
        supported_claims: [{ claim_id: "C1", claim: "Claim text supported by evidence.", citations: ["E1"], support_status: "supported" }],
        missing_support: "",
        question_target: "exact_question_target",
      },
      answer: "Claim text supported by evidence. [E1]",
      citations: ["E1"],
      claim_table: [{ claim: "Claim text supported by evidence.", support: "supported", citations: ["E1"] }],
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
  if (!["grounded_answer", "abstain"].includes(parsed.answer_type)) return { ok: false, error: "invalid answer_type", prediction: parsed };
  return { ok: true, error: null, prediction: parsed };
}

function renderReport(result) {
  return `# Evidence-First Contract Preflight

Generated: ${result.generated_at}

Status: \`${result.status}\`

Prediction mode: \`${result.prediction_mode}\`

## Metrics

- Examples: ${result.metrics.examples}
- Parseable: ${pct(result.metrics.parseable_rate)}
- Evidence-first valid: ${pct(result.metrics.evidence_first_valid_rate)}
- Answer type accuracy: ${pct(result.metrics.answer_type_accuracy)}
- Citation-set exact: ${pct(result.metrics.citation_set_exact_rate)}
- Overall contract correct: ${pct(result.metrics.overall_contract_correct_rate)}

## Decision

- Fixture passed: ${result.decision.fixture_passed ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean);
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
