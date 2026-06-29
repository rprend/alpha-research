import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourceRunId = args["source-run-id"] ?? "evidence-first-contract-qwen3b-smoke-v1";
const packetRunId = args["packet-run-id"] ?? "evidence-first-contract-packet-2026-06-28-v1";
const gateRunId = args["gate-run-id"] ?? `${sourceRunId}-evidence-first-contract-gate`;
const runId = args["run-id"] ?? "evidence-first-contract-repair-audit-qwen3b-smoke-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceResult = await readJson(path.join(runsDir, sourceRunId, "result.json"));
const gateResult = await readJson(path.join(runsDir, gateRunId, "result.json"));
const predictions = await readJsonl(path.join(runsDir, sourceRunId, "predictions.jsonl"));
const scoredGate = await readJsonl(path.join(runsDir, gateRunId, "scored_predictions.jsonl"));
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_targets_diagnostic.jsonl"));

const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const targetById = new Map(targets.map((row) => [row.example_id, row.target]));
const scoredById = new Map(scoredGate.map((row) => [row.example_id, row]));
const repairedRows = predictions.map((row) => repairPrediction(row, promptById.get(row.example_id), targetById.get(row.example_id), scoredById.get(row.example_id)));
const metrics = summarize(repairedRows);
const taxonomy = summarizeTaxonomy(repairedRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "evidence_first_contract_repair_audit",
  status: statusFor(metrics),
  purpose: "Diagnose the failed evidence-first Qwen 3B smoke and test whether deterministic constrained output repair can recover the contract without paid judging.",
  source_runs: {
    source_prediction_run_id: sourceRunId,
    packet_run_id: packetRunId,
    source_contract_gate_run_id: gateRunId,
  },
  source_metrics: {
    answer_type_accuracy: sourceResult.eval?.answer_type_accuracy,
    citation_precision: sourceResult.eval?.citation_precision,
    citation_recall: sourceResult.eval?.citation_recall,
    inline_citation_rate: sourceResult.eval?.inline_citation_rate,
    contract_gate_overall_correct_rate: gateResult.metrics?.overall_contract_correct_rate,
    contract_gate_evidence_first_valid_rate: gateResult.metrics?.evidence_first_valid_rate,
  },
  repair_policy: {
    uses_target_labels: false,
    uses_paid_judgments: false,
    rules: [
      "Keep only evidence ids present in the compact evidence pack, accepting normalized forms like [E2] or E2:overlap=...",
      "Convert empty grounded answers or grounded answers with no valid evidence citations to abstentions.",
      "For retained grounded answers, coerce supported_claims into claim objects, align claim_table, and append missing inline citations to answer text.",
      "For abstentions, force insufficient sufficiency, empty citations, empty claims, and a non-empty missing_support reason.",
    ],
  },
  examples: repairedRows.length,
  metrics,
  taxonomy,
  decision: {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    promote_repair_as_solution: false,
    next_step: nextStepFor(metrics),
    reason: "The audit is a zero-spend structural test. Passing syntax after repair would not prove grounded correctness; failing after repair identifies the next contract-learning bottleneck.",
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
    note: "This audit reads existing Qwen predictions and applies deterministic local repair only.",
  },
  artifacts: {
    repaired_predictions_jsonl: rel(path.join(outputDir, "repaired_predictions.jsonl")),
    scored_repairs_jsonl: rel(path.join(outputDir, "scored_repairs.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "repaired_predictions.jsonl"), repairedRows.map((row) => ({
  example_id: row.example_id,
  prediction: row.repaired_prediction,
  source_prediction: row.source_prediction,
  repair_actions: row.repair_actions,
})));
await writeJsonl(path.join(outputDir, "scored_repairs.jsonl"), repairedRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  metrics: result.metrics,
  taxonomy: result.taxonomy,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function repairPrediction(row, prompt, target, gateRow) {
  const evidenceIds = new Set((prompt?.input?.compact_retrieved_evidence_pack ?? []).map((item) => item.evidence_id));
  const source = row.prediction ?? {};
  const actions = [];
  const sourceCitations = normalizeCitations(source.citations ?? []).map((id) => normalizeEvidenceId(id)).filter((id) => evidenceIds.has(id));
  const sourceAnswer = String(source.answer ?? "").trim();
  const sourceClaims = Array.isArray(source.evidence_first?.supported_claims) ? source.evidence_first.supported_claims : [];
  const sourceHasClaimObjects = sourceClaims.some((claim) => claim && typeof claim === "object" && Array.isArray(claim.citations));
  const shouldAbstain = source.answer_type !== "grounded_answer" || !sourceAnswer || !sourceCitations.length;
  let repaired;

  if (shouldAbstain) {
    actions.push(source.answer_type !== "grounded_answer" ? "preserve_or_repair_abstention" : "convert_empty_or_uncited_grounded_answer_to_abstain");
    const missingSupport = String(source.evidence_first?.missing_support || source.abstention_reason || "The generated answer did not contain a cited supported claim.");
    repaired = {
      answer_type: "abstain",
      evidence_first: {
        sufficiency: "insufficient",
        supported_claims: [],
        missing_support: missingSupport,
        question_target: source.evidence_first?.question_target || prompt?.input?.question || "exact_question_target",
      },
      answer: "The evidence pack does not contain enough support to answer this question.",
      citations: [],
      claim_table: [],
      abstention_reason: missingSupport,
    };
  } else {
    if (!sourceHasClaimObjects) actions.push("coerce_supported_claims_to_objects");
    if (!hasInlineCitation(sourceAnswer, sourceCitations)) actions.push("append_inline_citations_to_answer");
    const claimText = bestClaimText(sourceClaims, sourceAnswer);
    const supportedClaims = [{
      claim_id: "C1",
      claim: stripInlineCitations(claimText),
      citations: unique(sourceCitations),
      support_status: "supported",
    }];
    repaired = {
      answer_type: "grounded_answer",
      evidence_first: {
        sufficiency: "sufficient",
        supported_claims: supportedClaims,
        missing_support: "",
        question_target: source.evidence_first?.question_target || prompt?.input?.question || "exact_question_target",
      },
      answer: withInlineCitations(sourceAnswer, sourceCitations),
      citations: unique(sourceCitations),
      claim_table: supportedClaims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
      abstention_reason: null,
    };
  }

  const score = scoreRepair(repaired, target);
  return {
    example_id: row.example_id,
    target_answer_type: target?.answer_type ?? null,
    source_answer_type: source.answer_type ?? null,
    repaired_answer_type: repaired.answer_type,
    source_gate_errors: gateRow?.evidence_first_errors ?? [],
    repair_actions: actions,
    source_prediction: source,
    repaired_prediction: repaired,
    ...score,
  };
}

function scoreRepair(prediction, target) {
  const answerTypeCorrect = prediction.answer_type === target?.answer_type;
  const targetCitations = new Set(normalizeCitations(target?.citations ?? []).map(normalizeEvidenceId).filter(Boolean));
  const predictionCitations = new Set(normalizeCitations(prediction.citations ?? []).map(normalizeEvidenceId).filter(Boolean));
  const citationSetExact = prediction.answer_type === "abstain" ? predictionCitations.size === 0 : setEqual(predictionCitations, targetCitations);
  const evidenceFirstValid = validateRepairedEvidenceFirst(prediction);
  const inlineCitation = prediction.answer_type === "grounded_answer" ? hasInlineCitation(prediction.answer, [...predictionCitations]) : null;
  return {
    repair_evidence_first_valid: evidenceFirstValid.valid,
    repair_evidence_first_errors: evidenceFirstValid.errors,
    repair_answer_type_correct: answerTypeCorrect,
    repair_citation_set_exact: citationSetExact,
    repair_inline_citation: inlineCitation,
    repair_contract_correct: evidenceFirstValid.valid && answerTypeCorrect && citationSetExact,
  };
}

function validateRepairedEvidenceFirst(prediction) {
  const errors = [];
  const ef = prediction.evidence_first;
  const claims = Array.isArray(ef?.supported_claims) ? ef.supported_claims : [];
  if (prediction.answer_type === "grounded_answer") {
    if (ef?.sufficiency !== "sufficient") errors.push("grounded answer must be sufficient");
    if (!claims.length) errors.push("grounded answer needs supported_claims");
    const union = new Set();
    for (const claim of claims) {
      if (!claim?.claim) errors.push("supported claim missing text");
      for (const id of normalizeCitations(claim?.citations ?? []).map(normalizeEvidenceId).filter(Boolean)) union.add(id);
    }
    if (!setEqual(union, new Set(normalizeCitations(prediction.citations ?? []).map(normalizeEvidenceId).filter(Boolean)))) {
      errors.push("answer citations must equal claim citation union");
    }
    if (!hasInlineCitation(prediction.answer, [...union])) errors.push("answer missing inline citations");
  } else if (prediction.answer_type === "abstain") {
    if (ef?.sufficiency !== "insufficient") errors.push("abstention must be insufficient");
    if (claims.length) errors.push("abstention cannot have supported_claims");
    if ((prediction.citations ?? []).length) errors.push("abstention cannot have citations");
    if (!ef?.missing_support || !prediction.abstention_reason) errors.push("abstention needs missing support");
  } else {
    errors.push("invalid answer type");
  }
  return { valid: errors.length === 0, errors };
}

function summarize(rows) {
  const groundedRows = rows.filter((row) => row.repaired_answer_type === "grounded_answer");
  return {
    examples: rows.length,
    repaired_answered: groundedRows.length,
    repaired_answer_rate: rate(groundedRows.length, rows.length),
    repaired_evidence_first_valid_rate: rate(rows.filter((row) => row.repair_evidence_first_valid).length, rows.length),
    repaired_answer_type_accuracy: rate(rows.filter((row) => row.repair_answer_type_correct).length, rows.length),
    repaired_citation_set_exact_rate: rate(rows.filter((row) => row.repair_citation_set_exact).length, rows.length),
    repaired_inline_citation_rate: rate(groundedRows.filter((row) => row.repair_inline_citation).length, groundedRows.length),
    repaired_contract_correct_rate: rate(rows.filter((row) => row.repair_contract_correct).length, rows.length),
  };
}

function summarizeTaxonomy(rows) {
  const actionCounts = {};
  const sourceErrorCounts = {};
  for (const row of rows) {
    for (const action of row.repair_actions) actionCounts[action] = (actionCounts[action] ?? 0) + 1;
    for (const error of row.source_gate_errors) sourceErrorCounts[error] = (sourceErrorCounts[error] ?? 0) + 1;
  }
  return {
    source_gate_error_counts: sourceErrorCounts,
    repair_action_counts: actionCounts,
    answer_type_flips: rows.filter((row) => row.source_answer_type !== row.repaired_answer_type).length,
    repaired_correct_examples: rows.filter((row) => row.repair_contract_correct).map((row) => row.example_id),
  };
}

function statusFor(metrics) {
  if (metrics.repaired_contract_correct_rate >= 0.8) return "repair_recovers_contract_gate_needs_judge";
  if (metrics.repaired_evidence_first_valid_rate >= 0.8 && metrics.repaired_contract_correct_rate < 0.8) return "repair_recovers_syntax_not_correctness";
  return "repair_does_not_recover_contract";
}

function nextStepFor(metrics) {
  if (metrics.repaired_evidence_first_valid_rate < 0.8) {
    return "Train or constrain the schema directly before another GPU run; deterministic repair cannot recover even the evidence-first shape.";
  }
  if (metrics.repaired_contract_correct_rate < 0.8) {
    return "Do not spend on judging this repair. Use constrained decoding/schema repair in the next packet, but focus the learning target on answerability and citation selection rather than syntax.";
  }
  return "Run the repaired predictions through grounded-correctness judging only after a separate leakage check confirms no target labels were used.";
}

function bestClaimText(claims, answer) {
  const firstObject = claims.find((claim) => claim && typeof claim === "object" && claim.claim);
  if (firstObject) return String(firstObject.claim);
  const firstString = claims.find((claim) => typeof claim === "string" && claim.trim());
  if (firstString) return firstString;
  return answer;
}

function withInlineCitations(answer, citations) {
  const suffix = unique(citations).map((id) => `[${id}]`).join(" ");
  if (!suffix || hasInlineCitation(answer, citations)) return answer;
  return `${answer.replace(/\s+$/, "")} ${suffix}`;
}

function hasInlineCitation(answer, citations) {
  const text = String(answer ?? "");
  return citations.some((id) => new RegExp(`\\[${escapeRegExp(id)}\\]`).test(text));
}

function stripInlineCitations(text) {
  return String(text ?? "").replace(/\s*\[E\d+\]/g, "").trim();
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation?.citation ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean);
}

function normalizeEvidenceId(value) {
  const match = String(value ?? "").match(/\bE\d+\b/);
  return match ? match[0] : "";
}

function unique(values) {
  return [...new Set(values)];
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

function renderReport(result) {
  return `# Evidence-First Repair Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Source

- Source prediction run: \`${result.source_runs.source_prediction_run_id}\`
- Source contract gate: \`${result.source_runs.source_contract_gate_run_id}\`
- Source evidence-first valid: ${pct(result.source_metrics.contract_gate_evidence_first_valid_rate)}
- Source contract correct: ${pct(result.source_metrics.contract_gate_overall_correct_rate)}

## Repair Metrics

- Examples: ${result.metrics.examples}
- Repaired answer rate: ${pct(result.metrics.repaired_answer_rate)}
- Evidence-first valid: ${pct(result.metrics.repaired_evidence_first_valid_rate)}
- Answer type accuracy: ${pct(result.metrics.repaired_answer_type_accuracy)}
- Citation-set exact: ${pct(result.metrics.repaired_citation_set_exact_rate)}
- Inline citation rate: ${pct(result.metrics.repaired_inline_citation_rate)}
- Contract correct: ${pct(result.metrics.repaired_contract_correct_rate)}

## Taxonomy

- Source gate errors: ${JSON.stringify(result.taxonomy.source_gate_error_counts)}
- Repair actions: ${JSON.stringify(result.taxonomy.repair_action_counts)}
- Answer type flips: ${result.taxonomy.answer_type_flips}
- Repaired contract-correct examples: ${result.taxonomy.repaired_correct_examples.length}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Promote repair as solution: ${result.decision.promote_repair_as_solution ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
