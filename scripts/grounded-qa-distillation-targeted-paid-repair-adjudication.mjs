import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const ledgerDir = path.join(experimentDir, "llm-calls");
const spendDir = path.join(experimentDir, "spend");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "targeted-paid-repair-adjudication-2026-06-29-v1";
const packetRunId = args["packet-run-id"] ?? "frontier-full-nonfinal-packet-2026-06-29-v1";
const fourSourceRunId = args["four-source-run-id"] ?? "four-source-router-audit-2026-06-29-v1";
const baselineSource = args["baseline-source"] ?? "structured_group";
const model = args.model ?? "gpt-4o";
const dryRun = args["dry-run"] === "true";
const maxRows = numberArg(args["max-rows"], Number.POSITIVE_INFINITY);
const maxRunCostUsd = numberArg(args["max-run-cost-usd"], 1.25);
const maxBudgetUsd = numberArg(args["max-budget-usd"], 100);
const maxOutputTokens = numberArg(args["max-output-tokens"], 900);
const outputDir = path.join(runsDir, runId);
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const llmBudgetPath = path.join(ledgerDir, "budget.json");
const totalBudgetPath = path.join(spendDir, "budget.json");
const externalLedgerPath = path.join(spendDir, "ledger.jsonl");
const sources = ["pattern", "learned", "teacher", "structured_group"];
const prices = {
  "gpt-4o": { inputPerMillion: 2.50, outputPerMillion: 10.00, source: "https://platform.openai.com/docs/pricing", checked_at: "2026-06-29" },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.60, source: "https://platform.openai.com/docs/pricing", checked_at: "2026-06-29" },
};
const price = prices[model];
if (!price) throw new Error(`Missing price entry for ${model}.`);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });
await fs.mkdir(ledgerDir, { recursive: true });
await fs.mkdir(spendDir, { recursive: true });
await ensureFile(ledgerPath);
await ensureFile(externalLedgerPath);

const budgetBefore = await readJson(totalBudgetPath);
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const targetById = new Map(targets.map((row) => [row.example_id, row]));
const candidateRows = await readJsonl(path.join(runsDir, fourSourceRunId, "candidate_rows.jsonl"));
const freshRows = candidateRows.filter((row) => row.router_split === "fresh_validation");
const targetRows = selectTargetRows(freshRows).slice(0, maxRows);
const requests = targetRows.map(buildRequestRecord);
const estimates = requests.map(estimateRequest);
const estimatedCost = round(sum(estimates.map((row) => row.estimated_cost_usd)), 8);
const spendBefore = Number(budgetBefore.spend_usd?.total_actual ?? 0);
if (estimatedCost > maxRunCostUsd) throw new Error(`Refusing run: estimated cost $${estimatedCost} exceeds max run cost $${maxRunCostUsd}.`);
if (spendBefore + estimatedCost > maxBudgetUsd) throw new Error(`Refusing run: total spend plus estimate would exceed $${maxBudgetUsd}.`);

const priorRows = await readJsonlIfPresent(path.join(outputDir, "paid_repairs.jsonl"));
const completedIds = new Set(priorRows.filter((row) => !row.skipped).map((row) => row.request_id));
const repairRows = [...priorRows];
const failures = await readJsonlIfPresent(path.join(outputDir, "failures.jsonl"));

if (dryRun || !process.env.OPENAI_API_KEY) {
  const reason = dryRun ? "dry-run requested" : "OPENAI_API_KEY missing";
  for (const request of requests.filter((row) => !completedIds.has(row.request_id))) {
    repairRows.push({
      request_id: request.request_id,
      example_id: request.example_id,
      skipped: true,
      skip_reason: reason,
      model,
      estimate: estimates.find((row) => row.request_id === request.request_id),
      repair_type: request.repair_type,
    });
  }
} else {
  for (const request of requests.filter((row) => !completedIds.has(row.request_id))) {
    try {
      const apiRequest = buildApiRequest(request);
      const payload = await openAiChatCompletion(apiRequest, request.request_id);
      const usage = payload.usage ?? {};
      const cost = round(callCost(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0, price), 10);
      const rawContent = payload.choices?.[0]?.message?.content ?? "";
      const parsed = parseJson(rawContent);
      const normalized = normalizeRepairOutput(parsed, request);
      const score = scorePrediction(normalized.prediction, request.target, request.prompt);
      await appendLedger(ledgerPath, {
        ts: new Date().toISOString(),
        provider: "openai",
        model,
        task: "grounded_qa_targeted_paid_repair_adjudication",
        run_id: runId,
        packet_run_id: packetRunId,
        four_source_run_id: fourSourceRunId,
        request_id: request.request_id,
        example_id: request.example_id,
        repair_type: request.repair_type,
        prompt_tokens: usage.prompt_tokens ?? null,
        completion_tokens: usage.completion_tokens ?? null,
        total_tokens: usage.total_tokens ?? null,
        cost_usd: cost,
        price_source: price.source,
        price_checked_at: price.checked_at,
      });
      repairRows.push({
        request_id: request.request_id,
        example_id: request.example_id,
        skipped: false,
        model,
        repair_type: request.repair_type,
        selected_source: normalized.selected_source,
        prediction: normalized.prediction,
        raw_content: rawContent,
        score,
        usage,
        cost_usd: cost,
      });
      await writeJsonl(path.join(outputDir, "paid_repairs.jsonl"), dedupeByRequestId(repairRows));
      await refreshBudgets();
    } catch (error) {
      failures.push({
        ts: new Date().toISOString(),
        request_id: request.request_id,
        example_id: request.example_id,
        message: String(error.message ?? error),
      });
      await writeJsonl(path.join(outputDir, "failures.jsonl"), failures);
      await refreshBudgets();
      throw error;
    }
  }
}

const finalRepairRows = dedupeByRequestId(repairRows);
const repairById = new Map(finalRepairRows.filter((row) => !row.skipped).map((row) => [row.example_id, row]));
const routedRows = candidateRows.map((row) => routeWithRepairs(row, repairById));
const predictionsPath = path.join(outputDir, "routed_predictions_for_gate.jsonl");
await writeJsonl(predictionsPath, routedRows.map((row) => ({
  example_id: row.example_id,
  prediction: row.selected_prediction,
  raw_output: JSON.stringify(row.selected_prediction),
  metadata: {
    scaffold: "targeted_paid_repair_adjudication",
    baseline_source: baselineSource,
    selected_source: row.selected_source,
    repaired: row.repaired,
    repair_type: row.repair_type,
  },
})));

const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);
const budgets = await refreshBudgets();
const metrics = summarize(finalRepairRows, routedRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "targeted_paid_repair_adjudication",
  status: statusFor(metrics),
  purpose: "Spend a small bounded amount on the current four-source fresh-validation problem rows: adjudicate selector misses and generate repairs for rows where no source is contract-correct.",
  model,
  source_runs: {
    packet: packetRunId,
    four_source_router: fourSourceRunId,
    contract_gate: gateRunId,
  },
  leakage_note: "Fresh-validation rows are reporting-only. Paid outputs from these rows must not be used as training labels; only matched non-final/train rows can be mined later.",
  target_selection: {
    baseline_source: baselineSource,
    fresh_validation_examples: freshRows.length,
    selected_requests: requests.length,
    selector_miss_requests: requests.filter((row) => row.repair_type === "selector_miss_adjudication").length,
    no_source_correct_requests: requests.filter((row) => row.repair_type === "no_source_correct_construction").length,
  },
  calls_made: finalRepairRows.filter((row) => !row.skipped).length,
  calls_skipped: finalRepairRows.filter((row) => row.skipped).length,
  estimated_cost_usd: estimatedCost,
  run_cost_usd: round(sum(finalRepairRows.map((row) => Number(row.cost_usd ?? 0))), 10),
  metrics,
  gate_metrics: gate.metrics,
  budget: {
    max_budget_usd: maxBudgetUsd,
    total_actual_before_run_usd: budgetBefore.spend_usd?.total_actual,
    actual_total_after_run_usd: budgets.totalBudget.spend_usd.total_actual,
    remaining_budget_usd: budgets.totalBudget.spend_usd.remaining,
    openai_ledger_spend_after_usd: budgets.llmBudget.ledger_spend_usd,
    external_compute_spend_after_usd: budgets.totalBudget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: finalRepairRows.filter((row) => !row.skipped).length,
    openai_cost_usd: round(sum(finalRepairRows.map((row) => Number(row.cost_usd ?? 0))), 10),
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    ledger_task: "grounded_qa_targeted_paid_repair_adjudication",
  },
  decision: decisionFor(metrics),
  artifacts: {
    requests_jsonl: rel(path.join(outputDir, "requests.jsonl")),
    estimated_calls_jsonl: rel(path.join(outputDir, "estimated_calls.jsonl")),
    paid_repairs_jsonl: rel(path.join(outputDir, "paid_repairs.jsonl")),
    routed_rows_jsonl: rel(path.join(outputDir, "routed_rows.jsonl")),
    routed_predictions_jsonl: rel(predictionsPath),
    contract_gate_result_json: rel(path.join(runsDir, gateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "requests.jsonl"), requests.map(scrubRequestForArtifact));
await writeJsonl(path.join(outputDir, "estimated_calls.jsonl"), estimates);
await writeJsonl(path.join(outputDir, "paid_repairs.jsonl"), finalRepairRows);
await writeJsonl(path.join(outputDir, "failures.jsonl"), failures);
await writeJsonl(path.join(outputDir, "routed_rows.jsonl"), routedRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  calls_made: result.calls_made,
  run_cost_usd: result.run_cost_usd,
  metrics: result.metrics,
  gate_metrics: result.gate_metrics,
  budget: result.budget,
  decision: result.decision,
}, null, 2));

function selectTargetRows(rows) {
  return rows
    .filter((row) => {
      const baselineCorrect = Boolean(row.candidates?.[baselineSource]?.contract_correct);
      const anyCorrect = sources.some((source) => row.candidates?.[source]?.contract_correct);
      return !baselineCorrect || !anyCorrect;
    })
    .map((row) => {
      const anyCorrect = sources.some((source) => row.candidates[source].contract_correct);
      return {
        ...row,
        repair_type: anyCorrect ? "selector_miss_adjudication" : "no_source_correct_construction",
      };
    })
    .filter((row) => row.repair_type === "no_source_correct_construction" || sources.some((source) => row.candidates[source].contract_correct));
}

function buildRequestRecord(row, index) {
  const prompt = promptById.get(row.example_id);
  const target = targetById.get(row.example_id);
  if (!prompt || !target) throw new Error(`Missing prompt/target for ${row.example_id}`);
  return {
    request_id: `targeted-paid-repair-${String(index + 1).padStart(3, "0")}`,
    example_id: row.example_id,
    repair_type: row.repair_type,
    prompt,
    target,
    candidate_row: row,
  };
}

function buildApiRequest(request) {
  return {
    model,
    temperature: 0,
    max_tokens: maxOutputTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are a strict citation-grounded QA repair and adjudication teacher.",
          "Use only the supplied question, metadata, evidence pack, and candidate outputs.",
          "Return valid JSON only with keys action, selected_source, rationale, prediction.",
          "action must be exactly select_candidate, repair_answer, or abstain.",
          "prediction must have keys answer_type, evidence_first, answer, citations, claim_table, and abstention_reason.",
          "For grounded_answer, every factual claim must be in evidence_first.supported_claims with evidence ids from the pack, and answer text must include inline [E#] citations.",
          "For abstain, answer and citations must be empty and missing_support must state the exact missing support.",
          "Do not use outside knowledge or infer facts not directly entailed by the evidence.",
        ].join(" "),
      },
      {
        role: "user",
        content: renderRepairPrompt(request),
      },
    ],
  };
}

function renderRepairPrompt(request) {
  const row = request.candidate_row;
  const candidateText = sources.map((source) => {
    const candidate = row.candidates[source];
    return [
      `Source: ${source}`,
      `answer_type: ${candidate.answer_type}`,
      `citations: ${JSON.stringify(candidate.citations ?? [])}`,
      `answer: ${candidate.prediction?.answer ?? ""}`,
      `claim_table: ${JSON.stringify(candidate.prediction?.claim_table ?? [])}`,
      `evidence_first: ${JSON.stringify(candidate.prediction?.evidence_first ?? {})}`,
    ].join("\n");
  }).join("\n\n");
  const taskInstruction = request.repair_type === "selector_miss_adjudication"
    ? "At least one candidate may already be fully grounded. Select the best candidate only if it directly answers the exact question with valid citations; otherwise repair or abstain."
    : "No current candidate is known to satisfy the contract. Construct a minimal grounded answer from the evidence if possible; otherwise abstain.";
  return [
    taskInstruction,
    "",
    `Question: ${request.prompt.input.question}`,
    "",
    "Document metadata:",
    `- paper_id: ${request.prompt.input.document_metadata?.paper_id ?? ""}`,
    `- title: ${request.prompt.input.document_metadata?.title ?? ""}`,
    `- inferred_publication_date: ${request.prompt.input.document_metadata?.inferred_publication_date ?? ""}`,
    `- knowledge_base_version: ${request.prompt.input.document_metadata?.knowledge_base_version ?? ""}`,
    "",
    "Evidence pack:",
    request.prompt.input.compact_retrieved_evidence_pack.map(formatEvidence).join("\n\n"),
    "",
    "Candidate outputs:",
    candidateText,
    "",
    "Return JSON only. Hide no uncertainty: if the evidence does not answer the exact target, abstain.",
  ].join("\n");
}

function normalizeRepairOutput(value, request) {
  const selectedSource = sources.includes(String(value?.selected_source ?? "")) ? String(value.selected_source) : null;
  if (String(value?.action ?? "") === "select_candidate" && selectedSource) {
    return {
      selected_source: selectedSource,
      prediction: normalizePrediction(request.candidate_row.candidates[selectedSource].prediction),
    };
  }
  return {
    selected_source: String(value?.action ?? "repair_answer"),
    prediction: normalizePrediction(value?.prediction ?? value),
  };
}

function routeWithRepairs(row, repairById) {
  const repair = repairById.get(row.example_id);
  const selectedPrediction = repair ? repair.prediction : normalizePrediction(row.candidates[baselineSource].prediction);
  const selectedScore = repair ? scorePrediction(selectedPrediction, targetById.get(row.example_id), promptById.get(row.example_id)) : {
    target_answer_type: row.target_answer_type,
    prediction_answer_type: row.candidates[baselineSource].answer_type,
    answer_type_correct: Boolean(row.candidates[baselineSource].answer_type_correct),
    citation_set_exact: Boolean(row.candidates[baselineSource].citation_set_exact),
    cited_ids_exist: true,
    evidence_first_valid: row.candidates[baselineSource].evidence_first_valid !== false,
    answer_token_f1: null,
    inline_citation_rate: null,
    contract_correct: Boolean(row.candidates[baselineSource].contract_correct),
    target_citations: row.target_citations,
    predicted_citations: normalizeCitations(row.candidates[baselineSource].citations),
  };
  return {
    example_id: row.example_id,
    source_split: row.source_split,
    router_split: row.router_split,
    target_answer_type: row.target_answer_type,
    target_citations: row.target_citations,
    selected_source: repair ? `paid_${repair.selected_source}` : baselineSource,
    repair_type: repair?.repair_type ?? null,
    repaired: Boolean(repair),
    selected_prediction: selectedPrediction,
    selected_score: selectedScore,
  };
}

function scorePrediction(prediction, targetRow, prompt) {
  const target = targetRow?.target ?? targetRow ?? {};
  const evidenceIds = new Set((prompt?.input?.compact_retrieved_evidence_pack ?? []).map((row) => String(row.evidence_id)));
  const targetCitations = normalizeCitations(target.citations);
  const predictedCitations = normalizeCitations(prediction.citations);
  const answerTypeCorrect = prediction.answer_type === target.answer_type;
  const citationSetExact = setEqual(new Set(predictedCitations), new Set(targetCitations));
  const citedIdsExist = predictedCitations.every((id) => evidenceIds.has(id));
  const evidenceFirstValid = validateEvidenceFirst(prediction, evidenceIds).valid;
  const targetGrounded = target.answer_type === "grounded_answer";
  const targetAbstain = target.answer_type === "abstain";
  const answerTokenF1 = tokenF1(prediction.answer, target.answer);
  const inlineCitationRate = predictedCitations.length ? predictedCitations.filter((id) => String(prediction.answer ?? "").includes(`[${id}]`)).length / predictedCitations.length : 1;
  const contractCorrect = Boolean(
    answerTypeCorrect
    && citationSetExact
    && citedIdsExist
    && evidenceFirstValid
    && ((targetGrounded && String(prediction.answer ?? "").trim().length > 0 && answerTokenF1 >= 0.2)
      || (targetAbstain && predictedCitations.length === 0 && String(prediction.answer ?? "").trim().length === 0))
  );
  return {
    target_answer_type: target.answer_type,
    prediction_answer_type: prediction.answer_type,
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    cited_ids_exist: citedIdsExist,
    evidence_first_valid: evidenceFirstValid,
    answer_token_f1: answerTokenF1,
    inline_citation_rate: inlineCitationRate,
    contract_correct: contractCorrect,
    target_citations: targetCitations,
    predicted_citations: predictedCitations,
  };
}

function validateEvidenceFirst(prediction, evidenceIds) {
  const ef = prediction.evidence_first;
  if (!ef || typeof ef !== "object") return { valid: false, reason: "missing_evidence_first" };
  if (!["sufficient", "insufficient"].includes(String(ef.sufficiency ?? ""))) return { valid: false, reason: "bad_sufficiency" };
  if (!Array.isArray(ef.supported_claims)) return { valid: false, reason: "supported_claims_not_array" };
  if (typeof ef.missing_support !== "string" || typeof ef.question_target !== "string") return { valid: false, reason: "missing_strings" };
  if (prediction.answer_type === "grounded_answer") {
    if (ef.sufficiency !== "sufficient" || !ef.supported_claims.length) return { valid: false, reason: "grounded_missing_claims" };
    for (const claim of ef.supported_claims) {
      const citations = normalizeCitations(claim.citations);
      if (!citations.length || !citations.every((id) => evidenceIds.has(id))) return { valid: false, reason: "bad_claim_citations" };
      if (!String(claim.claim ?? "").trim()) return { valid: false, reason: "empty_claim" };
    }
  }
  if (prediction.answer_type === "abstain") {
    if (ef.sufficiency !== "insufficient" || ef.supported_claims.length || !ef.missing_support.trim()) return { valid: false, reason: "bad_abstention_evidence_first" };
  }
  return { valid: true, reason: "ok" };
}

function normalizePrediction(value) {
  const answerType = String(value?.answer_type ?? "").trim() === "grounded_answer" ? "grounded_answer" : "abstain";
  return {
    answer_type: answerType,
    evidence_first: normalizeEvidenceFirst(value?.evidence_first, answerType),
    answer: answerType === "grounded_answer" ? String(value?.answer ?? "").trim() : "",
    citations: answerType === "grounded_answer" ? normalizeCitations(value?.citations) : [],
    claim_table: Array.isArray(value?.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value?.abstention_reason ?? value?.evidence_first?.missing_support ?? "").trim() : null,
  };
}

function normalizeEvidenceFirst(value, answerType) {
  const supportedClaims = Array.isArray(value?.supported_claims) ? value.supported_claims.map((claim, index) => ({
    claim_id: String(claim.claim_id ?? `C${index + 1}`),
    claim: String(claim.claim ?? ""),
    citations: normalizeCitations(claim.citations),
    support_status: String(claim.support_status ?? "supported"),
  })) : [];
  return {
    sufficiency: String(value?.sufficiency ?? (answerType === "grounded_answer" ? "sufficient" : "insufficient")),
    supported_claims: supportedClaims,
    missing_support: String(value?.missing_support ?? ""),
    question_target: String(value?.question_target ?? ""),
  };
}

function summarize(rows, routedRows) {
  const completed = rows.filter((row) => !row.skipped);
  const fresh = routedRows.filter((row) => row.router_split === "fresh_validation");
  const targeted = fresh.filter((row) => row.repaired);
  const byRepairType = {};
  for (const repairType of ["selector_miss_adjudication", "no_source_correct_construction"]) {
    const group = completed.filter((row) => row.repair_type === repairType);
    byRepairType[repairType] = summarizeScored(group.map((row) => row.score));
  }
  return {
    paid_examples: rows.length,
    completed_calls: completed.length,
    skipped: rows.filter((row) => row.skipped).length,
    paid_contract_correct: completed.filter((row) => row.score?.contract_correct).length,
    paid_contract_correct_rate: rate(completed.filter((row) => row.score?.contract_correct).length, completed.length),
    paid_answer_type_correct: completed.filter((row) => row.score?.answer_type_correct).length,
    paid_citation_set_exact: completed.filter((row) => row.score?.citation_set_exact).length,
    by_repair_type: byRepairType,
    fresh_validation: summarizeScored(fresh.map((row) => row.selected_score)),
    targeted_fresh_validation: summarizeScored(targeted.map((row) => row.selected_score)),
  };
}

function summarizeScored(scores) {
  return {
    examples: scores.length,
    contract_correct: scores.filter((score) => score?.contract_correct).length,
    contract_correct_rate: rate(scores.filter((score) => score?.contract_correct).length, scores.length),
    answer_type_correct: scores.filter((score) => score?.answer_type_correct).length,
    citation_set_exact: scores.filter((score) => score?.citation_set_exact).length,
    evidence_first_valid: scores.filter((score) => score?.evidence_first_valid).length,
  };
}

function statusFor(metrics) {
  if (!metrics.completed_calls) return "targeted_paid_repair_not_run";
  if (metrics.fresh_validation.contract_correct > 47) return "targeted_paid_repair_improves_fresh_validation";
  if (metrics.paid_contract_correct > 0) return "targeted_paid_repair_partial_only";
  return "targeted_paid_repair_no_gain";
}

function decisionFor(metrics) {
  const improved = metrics.fresh_validation.contract_correct > 47;
  return {
    promote_paid_repair_source: improved,
    mine_matched_nonfinal_train_repairs_next: improved || metrics.by_repair_type.no_source_correct_construction.contract_correct > 0,
    buy_more_openai_labels_now: false,
    rent_prime_gpu_now: false,
    reason: improved
      ? `Paid targeted repairs improved fresh validation to ${metrics.fresh_validation.contract_correct}/75 from the structured-group baseline of 47/75.`
      : `Paid targeted repairs did not beat the structured-group baseline: ${metrics.fresh_validation.contract_correct}/75 versus 47/75.`,
    next_step: improved
      ? "Mine matched non-final/train rows for the successful repair surfaces before any GPU training."
      : "Audit the paid failures for prompt insufficiency versus evidence/target mismatch before spending more.",
  };
}

async function runContractGate(gateRunId, predictionFile) {
  const child = spawn(process.execPath, [
    "scripts/grounded-qa-distillation-evidence-first-contract-preflight.mjs",
    `--packet-run-id=${packetRunId}`,
    `--prediction-file=${predictionFile}`,
    `--run-id=${gateRunId}`,
  ], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const code = await new Promise((resolve) => child.on("close", resolve));
  if (code !== 0) throw new Error(`Contract gate failed (${code}): ${stderr || stdout}`);
  return readJson(path.join(runsDir, gateRunId, "result.json"));
}

function renderReport(result) {
  return `# Targeted Paid Repair And Adjudication

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run spends a bounded amount on the exact fresh-validation rows exposed by D431: selector misses where another existing candidate may be right, and no-source-correct construction misses where a teacher may need to build a new cited answer. Fresh-validation paid outputs are reporting-only and must not become training labels.

| Model | Calls | Cost | Fresh contract | Targeted contract | Remaining budget |
| --- | ---: | ---: | ---: | ---: | ---: |
| \`${result.model}\` | ${result.calls_made} | $${result.run_cost_usd.toFixed(6)} | ${result.metrics.fresh_validation.contract_correct}/75 | ${result.metrics.targeted_fresh_validation.contract_correct}/${result.metrics.targeted_fresh_validation.examples} | $${Number(result.budget.remaining_budget_usd).toFixed(6)} |

## Targeted Rows

- Selector miss adjudications: ${result.target_selection.selector_miss_requests}
- No-source-correct construction repairs: ${result.target_selection.no_source_correct_requests}
- Paid answer-type correct: ${result.metrics.paid_answer_type_correct}/${result.metrics.completed_calls}
- Paid citation-set exact: ${result.metrics.paid_citation_set_exact}/${result.metrics.completed_calls}

## By Repair Type

| Repair type | Examples | Contract correct | Citation exact |
| --- | ---: | ---: | ---: |
| selector miss adjudication | ${result.metrics.by_repair_type.selector_miss_adjudication.examples} | ${result.metrics.by_repair_type.selector_miss_adjudication.contract_correct} | ${result.metrics.by_repair_type.selector_miss_adjudication.citation_set_exact} |
| no-source-correct construction | ${result.metrics.by_repair_type.no_source_correct_construction.examples} | ${result.metrics.by_repair_type.no_source_correct_construction.contract_correct} | ${result.metrics.by_repair_type.no_source_correct_construction.citation_set_exact} |

## Decision

- Promote paid repair source: ${result.decision.promote_paid_repair_source ? "yes" : "no"}
- Mine matched non-final/train repairs next: ${result.decision.mine_matched_nonfinal_train_repairs_next ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function scrubRequestForArtifact(request) {
  return {
    request_id: request.request_id,
    example_id: request.example_id,
    repair_type: request.repair_type,
    question: request.prompt.input.question,
    document_metadata: request.prompt.input.document_metadata,
    evidence_pack: request.prompt.input.compact_retrieved_evidence_pack,
    candidate_summaries: Object.fromEntries(sources.map((source) => [source, {
      answer_type: request.candidate_row.candidates[source].answer_type,
      citations: request.candidate_row.candidates[source].citations,
      contract_correct_hidden_for_real_use: request.candidate_row.candidates[source].contract_correct,
    }])),
    target_answer_type_hidden_for_scoring: request.target.target?.answer_type,
    target_citations_hidden_for_scoring: normalizeCitations(request.target.target?.citations),
  };
}

function estimateRequest(request) {
  const apiRequest = buildApiRequest(request);
  const estimatedInputTokens = Math.ceil(JSON.stringify(apiRequest.messages).length / 4);
  return {
    request_id: request.request_id,
    example_id: request.example_id,
    repair_type: request.repair_type,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: maxOutputTokens,
    estimated_cost_usd: round(callCost(estimatedInputTokens, maxOutputTokens, price), 8),
    price_source: price.source,
    price_checked_at: price.checked_at,
  };
}

async function openAiChatCompletion(apiRequest, requestId) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiRequest),
      });
      const payload = await response.json();
      if (response.ok) return payload;
      const status = Number(response.status);
      const retryable = [408, 409, 429, 500, 502, 503, 504].includes(status);
      const message = `OpenAI targeted repair request failed for ${requestId}: ${status} ${JSON.stringify(payload).slice(0, 600)}`;
      if (!retryable || attempt === 3) throw new Error(message);
      lastError = new Error(message);
    } catch (error) {
      lastError = error;
      if (attempt === 3) throw error;
    }
    await sleep(1000 * attempt);
  }
  throw lastError;
}

async function refreshBudgets() {
  const llmRows = await readJsonlIfPresent(ledgerPath);
  const externalRows = await readJsonlIfPresent(externalLedgerPath);
  const openaiSpend = round(sum(llmRows.map((row) => Number(row.cost_usd ?? 0))), 12);
  const externalSpend = round(sum(externalRows.map((row) => Number(row.cost_usd ?? 0))), 12);
  const total = round(openaiSpend + externalSpend, 12);
  const llmBudget = {
    max_budget_usd: maxBudgetUsd,
    ledger_spend_usd: openaiSpend,
    remaining_budget_usd: round(Math.max(0, maxBudgetUsd - openaiSpend), 12),
    ledger_path: rel(ledgerPath),
    last_updated: new Date().toISOString(),
  };
  const totalBudget = {
    generated_at: new Date().toISOString(),
    max_budget_usd: maxBudgetUsd,
    spend_usd: {
      openai: openaiSpend,
      external_compute: externalSpend,
      total_actual: total,
      remaining: round(Math.max(0, maxBudgetUsd - total), 12),
    },
    ledgers: {
      openai_ledger: rel(ledgerPath),
      external_compute_ledger: rel(externalLedgerPath),
    },
    policy: {
      note: "The $100 cap covers OpenAI API calls plus Prime Intellect/Hugging Face/other GPU spend. Planned GPU jobs must record estimated cost before launch and actual cost after completion.",
      launch_guardrail: "Do not launch a compute job when estimated total spend would exceed max_budget_usd.",
    },
  };
  await fs.writeFile(llmBudgetPath, `${JSON.stringify(llmBudget, null, 2)}\n`);
  await fs.writeFile(totalBudgetPath, `${JSON.stringify(totalBudget, null, 2)}\n`);
  return { llmBudget, totalBudget };
}

function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    const fenced = String(content).match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {}
    }
    return { action: "abstain", selected_source: null, prediction: { answer_type: "abstain", evidence_first: { sufficiency: "insufficient", supported_claims: [], missing_support: "Model did not return valid JSON.", question_target: "" }, answer: "", citations: [], claim_table: [], abstention_reason: "Model did not return valid JSON." } };
  }
}

function formatEvidence(evidence) {
  return `[${evidence.evidence_id}] ${evidence.section ?? "Evidence"}: ${evidence.text}`;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : [])
    .map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation).replace(/^\[|\]$/g, ""))
    .filter(Boolean);
}

function tokenF1(predicted, target) {
  const pred = tokenize(predicted);
  const gold = tokenize(target);
  if (!pred.length && !gold.length) return 1;
  if (!pred.length || !gold.length) return 0;
  const goldCounts = countBy(gold);
  let overlap = 0;
  for (const token of pred) {
    if (goldCounts[token] > 0) {
      overlap += 1;
      goldCounts[token] -= 1;
    }
  }
  if (!overlap) return 0;
  const precision = overlap / pred.length;
  const recall = overlap / gold.length;
  return (2 * precision * recall) / (precision + recall);
}

function tokenize(text) {
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").match(/[a-z0-9.%-]+/g) ?? [];
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

async function appendLedger(file, row) {
  await fs.appendFile(file, `${JSON.stringify(row)}\n`);
}

async function ensureFile(file) {
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "");
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonlIfPresent(file) {
  try {
    return await readJsonl(file);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function dedupeByRequestId(rows) {
  const byId = new Map();
  for (const row of rows) byId.set(row.request_id, row);
  return [...byId.values()].sort((left, right) => String(left.request_id).localeCompare(String(right.request_id)));
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

function numberArg(value, fallback) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`Invalid non-negative number: ${value}`);
  return number;
}

function callCost(inputTokens, outputTokens, modelPrice) {
  return (Number(inputTokens) / 1_000_000) * modelPrice.inputPerMillion + (Number(outputTokens) / 1_000_000) * modelPrice.outputPerMillion;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function round(value, digits = 12) {
  return Number(Number(value).toFixed(digits));
}

function rel(file) {
  return path.relative(rootDir, file);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
