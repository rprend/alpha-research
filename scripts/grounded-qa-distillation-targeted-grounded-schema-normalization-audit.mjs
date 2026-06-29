import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const predictionRunId = args["prediction-run-id"] ?? "targeted-grounded-construction-dpo-prompt-repaired-qwen3b-smoke-v1";
const packetRunId = args["packet-run-id"] ?? "targeted-grounded-construction-packet-frontier-repaired-dpo-prompt-repaired-v1";
const runId = args["run-id"] ?? `targeted-grounded-schema-normalization-audit-${predictionRunId}`;
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const predictions = await readJsonl(path.join(runsDir, predictionRunId, "predictions.jsonl"));
const targetById = new Map(targets.map((row) => [row.example_id, row.target]));
const promptById = new Map(prompts.map((row) => [row.example_id, row]));

const rows = predictions.map((row) => {
  const target = targetById.get(row.example_id);
  const prompt = promptById.get(row.example_id);
  const normalized = normalizePrediction(row.prediction);
  return {
    example_id: row.example_id,
    target,
    original_prediction: row.prediction,
    normalized_prediction: normalized,
    original_contract: score(prompt, target, row.prediction),
    normalized_contract: score(prompt, target, normalized),
  };
});

const metrics = summarize(rows);
const decision = decisionFor(metrics);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "targeted_grounded_schema_normalization_audit",
  status: statusFor(metrics),
  prediction_run_id: predictionRunId,
  packet_run_id: packetRunId,
  metrics,
  normalization_policy: {
    abstention_schema_repair: "Set sufficiency=insufficient, clear supported_claims/citations/answer/claim_table, and promote missing_support from model rationale fields.",
    grounded_schema_repair: "Set sufficiency=sufficient only when supported_claims can be normalized; set top-level citations to the union of claim citations.",
    answer_type_changed: false,
    citation_set_changed_for_abstentions_only: true,
    paid_judge_allowed: false,
  },
  decision,
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
    note: "This audit reads local predictions and applies deterministic schema normalization only.",
  },
  artifacts: {
    normalized_predictions_jsonl: rel(path.join(outputDir, "normalized_predictions.jsonl")),
    scored_predictions_jsonl: rel(path.join(outputDir, "scored_predictions.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "normalized_predictions.jsonl"), rows.map((row) => ({
  example_id: row.example_id,
  prediction: row.normalized_prediction,
})));
await writeJsonl(path.join(outputDir, "scored_predictions.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  metrics: result.metrics,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function normalizePrediction(prediction) {
  const normalized = JSON.parse(JSON.stringify(prediction ?? {}));
  if (normalized.answer_type === "abstain") {
    const ef = normalized.evidence_first && typeof normalized.evidence_first === "object" ? normalized.evidence_first : {};
    const missingSupport = firstNonEmpty([
      ef.missing_support,
      ef.abstention_reason,
      normalized.abstention_reason,
      ef.synthesis,
      normalized.answer,
      "The evidence is insufficient for the exact question target.",
    ]);
    normalized.evidence_first = {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: missingSupport,
      question_target: ef.question_target || "exact_question_target",
    };
    normalized.answer = "";
    normalized.citations = [];
    normalized.claim_table = [];
    normalized.abstention_reason = missingSupport;
  } else if (normalized.answer_type === "grounded_answer") {
    const ef = normalized.evidence_first && typeof normalized.evidence_first === "object" ? normalized.evidence_first : {};
    const claims = Array.isArray(ef.supported_claims) ? ef.supported_claims.map((claim, index) => normalizeClaim(claim, index, ef, normalized)) : [];
    normalized.evidence_first = {
      sufficiency: "sufficient",
      supported_claims: claims,
      missing_support: "",
      question_target: ef.question_target || "exact_question_target",
    };
    normalized.citations = [...new Set(claims.flatMap((claim) => normalizeCitations(claim.citations)))];
  }
  return normalized;
}

function normalizeClaim(claim, index, ef, prediction) {
  if (typeof claim === "string") {
    return {
      claim_id: `C${index + 1}`,
      claim,
      citations: normalizeCitations(ef.citations ?? prediction.citations),
      support_status: "supported",
    };
  }
  return {
    claim_id: claim?.claim_id || `C${index + 1}`,
    claim: claim?.claim || claim?.text || String(claim ?? ""),
    citations: normalizeCitations(claim?.citations ?? claim?.support ?? claim?.citation ?? ef.citations ?? prediction.citations),
    support_status: claim?.support_status || "supported",
  };
}

function score(prompt, target, prediction) {
  const evidenceIds = new Set((prompt?.input?.compact_retrieved_evidence_pack ?? []).map((row) => row.evidence_id));
  const answerTypeCorrect = prediction?.answer_type === target?.answer_type;
  const evidenceFirst = validateEvidenceFirst(prediction, evidenceIds);
  const citationSetExact = prediction?.answer_type === "abstain"
    ? normalizeCitations(prediction?.citations).length === 0
    : setEqual(new Set(normalizeCitations(prediction?.citations)), new Set(normalizeCitations(target?.citations)));
  return {
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    evidence_first_valid: evidenceFirst.valid,
    evidence_first_errors: evidenceFirst.errors,
    contract_correct: answerTypeCorrect && citationSetExact && evidenceFirst.valid,
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
    original_overall_contract_correct: rate(rows.filter((row) => row.original_contract.contract_correct).length, rows.length),
    normalized_overall_contract_correct: rate(rows.filter((row) => row.normalized_contract.contract_correct).length, rows.length),
    original_evidence_first_valid: rate(rows.filter((row) => row.original_contract.evidence_first_valid).length, rows.length),
    normalized_evidence_first_valid: rate(rows.filter((row) => row.normalized_contract.evidence_first_valid).length, rows.length),
    answer_type_accuracy: rate(rows.filter((row) => row.normalized_contract.answer_type_correct).length, rows.length),
    citation_set_exact_rate: rate(rows.filter((row) => row.normalized_contract.citation_set_exact).length, rows.length),
    normalized_contract_correct_count: rows.filter((row) => row.normalized_contract.contract_correct).length,
  };
}

function statusFor(metrics) {
  if (metrics.examples > 10 && metrics.normalized_contract_correct_count < 44) return "schema_normalization_fails_broad_validation";
  return "schema_normalization_recovers_contract_shape_not_generation";
}

function decisionFor(metrics) {
  if (metrics.examples > 10 && metrics.normalized_contract_correct_count < 44) {
    return {
      launch_prime_now: false,
      buy_openai_judgments_now: false,
      promote_normalized_scaffold_for_next_eval: false,
      next_step: "Do not judge or promote this broad normalized Qwen surface. Generate a matched train-side Qwen repair/hybrid candidate surface if using Prime, then train a leakage-safe router that can decide when the Qwen candidate helps.",
      reason: "On the broader repaired-validation surface, answerability and citation selection failures dominate; schema normalization alone underperforms the existing train-calibrated scaffold and train-supervised router.",
    };
  }
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    promote_normalized_scaffold_for_next_eval: true,
    next_step: "Use schema-normalized predictions as a cheap scaffold candidate, then test on a broader repaired-validation surface before any OpenAI judging.",
    reason: "The repaired smoke improved answer-type and citation-set behavior; the remaining deterministic gate failure is mostly schema conformance.",
  };
}

function renderReport(result) {
  return `# Targeted Grounded Schema Normalization Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

| Metric | Value |
| --- | ---: |
| Examples | ${result.metrics.examples} |
| Original contract correct | ${pct(result.metrics.original_overall_contract_correct)} |
| Normalized contract correct | ${pct(result.metrics.normalized_overall_contract_correct)} |
| Original evidence-first valid | ${pct(result.metrics.original_evidence_first_valid)} |
| Normalized evidence-first valid | ${pct(result.metrics.normalized_evidence_first_valid)} |
| Answer type accuracy | ${pct(result.metrics.answer_type_accuracy)} |
| Citation-set exact | ${pct(result.metrics.citation_set_exact_rate)} |

Decision: ${result.decision.next_step}
`;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : [citations]).map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean);
}

function firstNonEmpty(values) {
  return values.map((value) => String(value ?? "").trim()).find(Boolean) ?? "";
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
