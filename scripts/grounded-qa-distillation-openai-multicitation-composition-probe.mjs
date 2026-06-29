import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const ledgerDir = path.join(experimentDir, "llm-calls");
const spendDir = path.join(experimentDir, "spend");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "openai-multicitation-composition-probe-2026-06-29-v1";
const packetRunId = args["packet-run-id"] ?? "nonreview-oracle-contrast-packet-2026-06-29-v1";
const split = args.split ?? "sft_validation";
const model = args.model ?? "gpt-4o";
const taskMode = args["task-mode"] ?? "answer_json";
const limit = numberArg(args.limit, Number.POSITIVE_INFINITY);
const dryRun = args["dry-run"] === "true";
const maxRunCostUsd = numberArg(args["max-run-cost-usd"], 0.75);
const maxBudgetUsd = numberArg(args["max-budget-usd"], 100);
const maxOutputTokens = numberArg(args["max-output-tokens"], 900);
const outputDir = path.join(runsDir, runId);
const packetDir = path.join(runsDir, packetRunId, "dataset");
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const llmBudgetPath = path.join(ledgerDir, "budget.json");
const totalBudgetPath = path.join(spendDir, "budget.json");
const externalLedgerPath = path.join(spendDir, "ledger.jsonl");

const prices = {
  "gpt-4o": { inputPerMillion: 2.50, outputPerMillion: 10.00, source: "https://platform.openai.com/docs/pricing", checked_at: "2026-06-29" },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.60, source: "https://platform.openai.com/docs/pricing", checked_at: "2026-06-29" },
};
const price = prices[model];
if (!price) throw new Error(`Missing price table entry for model ${model}.`);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });
await fs.mkdir(ledgerDir, { recursive: true });
await fs.mkdir(spendDir, { recursive: true });
await ensureFile(ledgerPath);
await ensureFile(externalLedgerPath);

const sourceRows = await readJsonl(path.join(packetDir, `${split}.jsonl`));
const targetRows = sourceRows
  .map((row) => ({ ...row, target: normalizePrediction(parseMaybeJson(row.target)) }))
  .filter((row) => row.target.answer_type === "grounded_answer" && normalizeCitations(row.target.citations).length > 1)
  .sort((left, right) => normalizeCitations(right.target.citations).length - normalizeCitations(left.target.citations).length
    || String(left.example_id).localeCompare(String(right.example_id)))
  .slice(0, limit);
const requests = targetRows.map(buildRequestRecord);
const estimates = requests.map(estimateRequest);
const estimatedCost = round(sum(estimates.map((row) => row.estimated_cost_usd)), 8);
const budgetsBefore = await refreshBudgets();
const totalSpendBefore = Number(budgetsBefore.totalBudget.spend_usd.total_actual ?? 0);
if (estimatedCost > maxRunCostUsd) throw new Error(`Refusing run: estimated cost $${estimatedCost} exceeds max run cost $${maxRunCostUsd}.`);
if (totalSpendBefore + estimatedCost > maxBudgetUsd) throw new Error(`Refusing run: tracked spend $${totalSpendBefore} + estimate $${estimatedCost} exceeds max budget $${maxBudgetUsd}.`);

const priorPredictions = await readJsonlIfPresent(path.join(outputDir, "predictions.jsonl"));
const completedIds = new Set(priorPredictions.filter((row) => !row.skipped).map((row) => row.request_id));
const predictions = [...priorPredictions];
const failures = await readJsonlIfPresent(path.join(outputDir, "failures.jsonl"));

if (dryRun || !process.env.OPENAI_API_KEY) {
  const reason = dryRun ? "dry-run requested" : "OPENAI_API_KEY missing";
  for (const request of requests.filter((row) => !completedIds.has(row.request_id))) {
    predictions.push({
      request_id: request.request_id,
      example_id: request.example_id,
      skipped: true,
      skip_reason: reason,
      model,
      estimate: estimates.find((row) => row.request_id === request.request_id),
      target_citations_hidden_for_scoring: request.target.citations,
    });
  }
} else {
  for (const request of requests.filter((row) => !completedIds.has(row.request_id))) {
    try {
      const apiRequest = buildApiRequest(request);
      const payload = await openAiChatCompletion(apiRequest, request.request_id);
      const usage = payload.usage ?? {};
      const rawContent = payload.choices?.[0]?.message?.content ?? "";
      const prediction = normalizePrediction(parseJson(rawContent));
      const cost = round(callCost(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0, price), 10);
      const score = scorePrediction(prediction, request.target, request.evidenceIds);
      await appendLedger(ledgerPath, {
        ts: new Date().toISOString(),
        provider: "openai",
        model,
        task: "grounded_qa_multicitation_composition_probe",
        run_id: runId,
        packet_run_id: packetRunId,
        split,
        task_mode: taskMode,
        request_id: request.request_id,
        example_id: request.example_id,
        target_citation_count: request.target.citations.length,
        prompt_tokens: usage.prompt_tokens ?? null,
        completion_tokens: usage.completion_tokens ?? null,
        total_tokens: usage.total_tokens ?? null,
        cost_usd: cost,
        price_source: price.source,
        price_checked_at: price.checked_at,
      });
      predictions.push({
        request_id: request.request_id,
        example_id: request.example_id,
        skipped: false,
        model,
        prediction,
        raw_content: rawContent,
        usage,
        cost_usd: cost,
        score,
        target_answer_type_hidden_for_scoring: request.target.answer_type,
        target_citations_hidden_for_scoring: request.target.citations,
        question: request.input.question,
      });
      await writeJsonl(path.join(outputDir, "predictions.jsonl"), dedupeByRequestId(predictions));
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

const finalPredictions = dedupeByRequestId(predictions);
const completed = finalPredictions.filter((row) => !row.skipped);
const budgetsAfter = await refreshBudgets();
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "openai_multicitation_composition_probe",
  status: statusFor(finalPredictions),
  purpose: "Probe whether a stronger paid teacher can compose exact multi-citation evidence sets on D437 non-review validation rows before renting GPU or buying broader labels.",
  leakage_note: "Rows come from SFT validation, not fresh final evaluation. Outputs are diagnostic and must not be used as final test labels.",
  packet_run_id: packetRunId,
  split,
  model,
  task_mode: taskMode,
  dry_run: dryRun || !process.env.OPENAI_API_KEY,
  target_selection: {
    source_rows: sourceRows.length,
    selected_multicitation_grounded_rows: requests.length,
    target_citation_count_distribution: countBy(requests.map((row) => row.target.citations.length)),
  },
  calls_made: completed.length,
  calls_skipped: finalPredictions.filter((row) => row.skipped).length,
  estimated_cost_usd: estimatedCost,
  run_cost_usd: round(sum(completed.map((row) => Number(row.cost_usd ?? 0))), 10),
  metrics: summarize(completed),
  budget: {
    max_budget_usd: maxBudgetUsd,
    total_actual_before_estimate_usd: totalSpendBefore,
    actual_total_after_run_usd: budgetsAfter.totalBudget.spend_usd.total_actual,
    remaining_budget_usd: budgetsAfter.totalBudget.spend_usd.remaining,
    openai_ledger_spend_after_usd: budgetsAfter.llmBudget.ledger_spend_usd,
    external_compute_spend_after_usd: budgetsAfter.totalBudget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: completed.length,
    openai_cost_usd: round(sum(completed.map((row) => Number(row.cost_usd ?? 0))), 10),
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    ledger_task: "grounded_qa_multicitation_composition_probe",
  },
  decision: decisionFor(completed),
  artifacts: {
    requests_jsonl: rel(path.join(outputDir, "requests.jsonl")),
    estimates_jsonl: rel(path.join(outputDir, "estimated_calls.jsonl")),
    predictions_jsonl: rel(path.join(outputDir, "predictions.jsonl")),
    failures_jsonl: rel(path.join(outputDir, "failures.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "requests.jsonl"), requests.map(scrubRequestForArtifact));
await writeJsonl(path.join(outputDir, "estimated_calls.jsonl"), estimates);
await writeJsonl(path.join(outputDir, "predictions.jsonl"), finalPredictions);
await writeJsonl(path.join(outputDir, "failures.jsonl"), failures);
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
  budget: result.budget,
  decision: result.decision,
}, null, 2));

function buildRequestRecord(row, index) {
  const input = row.input ?? extractInputFromMessages(row.messages);
  if (!input?.question || !Array.isArray(input.compact_retrieved_evidence_pack)) {
    throw new Error(`Missing input/evidence for ${row.example_id}`);
  }
  return {
    request_id: `multicitation-composition-${String(index + 1).padStart(3, "0")}`,
    example_id: row.example_id,
    input,
    target: row.target,
    evidenceIds: new Set(input.compact_retrieved_evidence_pack.map((evidence) => String(evidence.evidence_id))),
  };
}

function buildApiRequest(request) {
  return {
    model,
    temperature: 0,
    max_tokens: maxOutputTokens,
    response_format: { type: "json_object" },
    messages: taskMode === "citation_set_only" ? buildCitationSetMessages(request.input) : [
      {
        role: "system",
        content: [
          "You are a strict citation-grounded QA teacher.",
          "Use only the supplied compact evidence pack; ignore outside knowledge and do not use the abstract unless it appears in evidence.",
          "Return valid JSON only with keys answer_type, evidence_first, answer, citations, claim_table, and abstention_reason.",
          "For grounded_answer, cite every factual claim and include all evidence ids needed to answer every part of the question.",
          "The top-level citations array must be the exact minimal union of evidence ids that support the answer, not merely the single best passage.",
          "For multi-part answers, use multiple citations when distinct evidence passages support distinct required facts.",
          "For abstain, answer and citations must be empty, sufficiency must be insufficient, and missing_support must name the exact unsupported target.",
        ].join(" "),
      },
      {
        role: "user",
        content: renderPrompt(request.input),
      },
    ],
  };
}

function buildCitationSetMessages(input) {
  return [
    {
      role: "system",
      content: [
        "You are a strict evidence-subset labeler for citation-grounded QA.",
        "Do not write the final answer. Do not use outside knowledge.",
        "Select the exact minimal set of evidence ids needed to support a complete answer to the question.",
        "If the complete answer has multiple distinct facts, include every evidence passage needed for those facts.",
        "Do not collapse a multi-part answer to the single most central passage.",
        "Return valid JSON only with keys answer_type, citations, rationale_by_citation, missing_support.",
        "answer_type must be grounded_answer if the evidence can answer the exact question, otherwise abstain.",
        "citations must be an array of bracketless ids like E1. For abstain, citations must be [].",
      ].join(" "),
    },
    {
      role: "user",
      content: renderPrompt(input),
    },
  ];
}

function renderPrompt(input) {
  return [
    `Question: ${input.question}`,
    "",
    "Document metadata:",
    `- paper_id: ${input.document_metadata?.paper_id ?? ""}`,
    `- title: ${input.document_metadata?.title ?? ""}`,
    `- inferred_publication_date: ${input.document_metadata?.inferred_publication_date ?? ""}`,
    `- knowledge_base_version: ${input.document_metadata?.knowledge_base_version ?? ""}`,
    "",
    "Evidence pack:",
    input.compact_retrieved_evidence_pack.map(formatEvidence).join("\n\n"),
    "",
    "Return only JSON. First determine the exact question target, then identify the minimal set of evidence ids required to support a complete answer.",
  ].join("\n");
}

function scorePrediction(prediction, target, evidenceIds) {
  const targetCitations = normalizeCitations(target.citations);
  const predictedCitations = normalizeCitations(prediction.citations);
  const answerTypeCorrect = prediction.answer_type === target.answer_type;
  const citationSetExact = setEqual(new Set(predictedCitations), new Set(targetCitations));
  const citedIdsExist = predictedCitations.every((id) => evidenceIds.has(id));
  const evidenceFirstValid = validateEvidenceFirst(prediction, evidenceIds).valid;
  const inlineCitationRate = predictedCitations.length ? predictedCitations.filter((id) => String(prediction.answer ?? "").includes(`[${id}]`)).length / predictedCitations.length : 1;
  const answerTokenF1 = tokenF1(prediction.answer, target.answer);
  const contractCorrect = Boolean(
    answerTypeCorrect
    && citationSetExact
    && citedIdsExist
    && evidenceFirstValid
    && String(prediction.answer ?? "").trim()
    && answerTokenF1 >= 0.2
    && inlineCitationRate === 1
  );
  return {
    target_answer_type: target.answer_type,
    prediction_answer_type: prediction.answer_type,
    target_citations: targetCitations,
    predicted_citations: predictedCitations,
    target_citation_count: targetCitations.length,
    predicted_citation_count: predictedCitations.length,
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    cited_ids_exist: citedIdsExist,
    evidence_first_valid: evidenceFirstValid,
    inline_citation_rate: inlineCitationRate,
    answer_token_f1: answerTokenF1,
    contract_correct: contractCorrect,
  };
}

function validateEvidenceFirst(prediction, evidenceIds) {
  const ef = prediction.evidence_first;
  if (!ef || typeof ef !== "object") return { valid: false, reason: "missing_evidence_first" };
  if (!["sufficient", "insufficient"].includes(String(ef.sufficiency ?? ""))) return { valid: false, reason: "bad_sufficiency" };
  if (!Array.isArray(ef.supported_claims)) return { valid: false, reason: "supported_claims_not_array" };
  if (prediction.answer_type === "grounded_answer") {
    if (ef.sufficiency !== "sufficient" || !ef.supported_claims.length) return { valid: false, reason: "grounded_missing_claims" };
    for (const claim of ef.supported_claims) {
      const citations = normalizeCitations(claim.citations);
      if (!citations.length || !citations.every((id) => evidenceIds.has(id))) return { valid: false, reason: "bad_claim_citations" };
      if (!String(claim.claim ?? "").trim()) return { valid: false, reason: "empty_claim" };
    }
  }
  if (prediction.answer_type === "abstain") {
    if (ef.sufficiency !== "insufficient" || ef.supported_claims.length) return { valid: false, reason: "bad_abstention_evidence_first" };
  }
  return { valid: true, reason: "ok" };
}

function normalizePrediction(value) {
  const answerType = String(value?.answer_type ?? "").trim() === "abstain" ? "abstain" : "grounded_answer";
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

function summarize(rows) {
  return {
    examples: rows.length,
    contract_correct: count(rows, (row) => row.score?.contract_correct),
    contract_correct_rate: rate(count(rows, (row) => row.score?.contract_correct), rows.length),
    answer_type_correct: count(rows, (row) => row.score?.answer_type_correct),
    citation_set_exact: count(rows, (row) => row.score?.citation_set_exact),
    evidence_first_valid: count(rows, (row) => row.score?.evidence_first_valid),
    inline_citation_perfect: count(rows, (row) => row.score?.inline_citation_rate === 1),
    by_target_citation_count: Object.fromEntries([2, 3, 4, 5, 6, 7].map((size) => {
      const group = rows.filter((row) => row.score?.target_citation_count === size);
      return [size, {
        examples: group.length,
        contract_correct: count(group, (row) => row.score?.contract_correct),
        citation_set_exact: count(group, (row) => row.score?.citation_set_exact),
        mean_predicted_citation_count: mean(group.map((row) => row.score?.predicted_citation_count ?? 0)),
      }];
    }).filter(([, value]) => value.examples)),
    predicted_citation_count_distribution: countBy(rows.map((row) => row.score?.predicted_citation_count ?? "unknown")),
  };
}

function statusFor(rows) {
  const completed = rows.filter((row) => !row.skipped);
  if (!completed.length) return "multicitation_composition_probe_not_run";
  const metrics = summarize(completed);
  if (metrics.citation_set_exact === metrics.examples && metrics.evidence_first_valid === metrics.examples) return "multicitation_composition_probe_passed";
  if (metrics.citation_set_exact > metrics.examples / 2) return "multicitation_composition_probe_partial";
  return "multicitation_composition_probe_failed";
}

function decisionFor(rows) {
  const metrics = summarize(rows);
  const passed = metrics.examples > 0
    && metrics.citation_set_exact >= Math.ceil(metrics.examples * 0.8)
    && metrics.by_target_citation_count[3]?.citation_set_exact === metrics.by_target_citation_count[3]?.examples;
  return {
    use_frontier_teacher_for_multicitation_labels_next: passed,
    rent_prime_gpu_now: false,
    buy_more_openai_labels_now: false,
    reason: passed
      ? `Frontier probe reached ${metrics.citation_set_exact}/${metrics.examples} exact citation sets on multi-citation validation rows.`
      : `Frontier probe reached ${metrics.citation_set_exact}/${metrics.examples} exact citation sets; that is not yet strong enough to justify broad paid labeling or GPU training.`,
    next_step: passed
      ? "Generate a matched train-only multi-citation repair packet, then train/evaluate a small selector or scaffold."
      : "Audit prompt/evidence mismatch and try a narrower verifier/adjudicator prompt before any Prime GPU rental.",
  };
}

function renderReport(result) {
  const bySizeRows = Object.entries(result.metrics.by_target_citation_count)
    .map(([size, row]) => `| ${size} | ${row.examples} | ${row.citation_set_exact} | ${row.contract_correct} | ${row.mean_predicted_citation_count.toFixed(2)} |`)
    .join("\n");
  return `# OpenAI Multi-Citation Composition Probe

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run probes whether a stronger paid teacher can select complete multi-citation evidence sets for D437 validation rows. It is a diagnostic gate before broader paid labels or Prime GPU spend.

| Model | Calls | Cost | Citation exact | Contract correct | Remaining budget |
| --- | ---: | ---: | ---: | ---: | ---: |
| \`${result.model}\` | ${result.calls_made} | $${result.run_cost_usd.toFixed(6)} | ${result.metrics.citation_set_exact}/${result.metrics.examples} | ${result.metrics.contract_correct}/${result.metrics.examples} | $${Number(result.budget.remaining_budget_usd).toFixed(6)} |

## By Target Citation Count

| Target citations | Examples | Citation exact | Contract correct | Mean predicted citations |
| ---: | ---: | ---: | ---: | ---: |
${bySizeRows}

## Budget

- Estimated cost: $${result.estimated_cost_usd.toFixed(6)}
- Run cost: $${result.run_cost_usd.toFixed(6)}
- Total tracked spend: $${Number(result.budget.actual_total_after_run_usd).toFixed(6)} / $${result.budget.max_budget_usd}
- OpenAI ledger spend: $${Number(result.budget.openai_ledger_spend_after_usd).toFixed(6)}
- External compute spend: $${Number(result.budget.external_compute_spend_after_usd).toFixed(6)}

## Decision

- Use frontier teacher for multi-citation labels next: ${result.decision.use_frontier_teacher_for_multicitation_labels_next ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function scrubRequestForArtifact(request) {
  return {
    request_id: request.request_id,
    example_id: request.example_id,
    question: request.input.question,
    document_metadata: request.input.document_metadata,
    evidence_pack: request.input.compact_retrieved_evidence_pack,
    target_answer_type_hidden_for_scoring: request.target.answer_type,
    target_citations_hidden_for_scoring: request.target.citations,
  };
}

function estimateRequest(request) {
  const apiRequest = buildApiRequest(request);
  const estimatedInputTokens = Math.ceil(JSON.stringify(apiRequest.messages).length / 4);
  return {
    request_id: request.request_id,
    example_id: request.example_id,
    target_citation_count: request.target.citations.length,
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
      const message = `OpenAI multi-citation composition request failed for ${requestId}: ${status} ${JSON.stringify(payload).slice(0, 600)}`;
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

function extractInputFromMessages(messages = []) {
  const user = messages.find((message) => message.role === "user")?.content ?? "";
  const question = String(user).match(/Question:\s*([\s\S]*?)\n\nDocument metadata:/)?.[1]?.trim() ?? "";
  return {
    question,
    compact_retrieved_evidence_pack: [],
    document_metadata: {},
  };
}

function parseMaybeJson(value) {
  if (typeof value === "string") return parseJson(value);
  return value;
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
    return {
      answer_type: "abstain",
      evidence_first: {
        sufficiency: "insufficient",
        supported_claims: [],
        missing_support: "Model did not return valid JSON.",
        question_target: "",
      },
      answer: "",
      citations: [],
      claim_table: [],
      abstention_reason: "Model did not return valid JSON.",
    };
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

function count(rows, predicate) {
  return rows.filter(predicate).length;
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

function mean(values) {
  return values.length ? sum(values) / values.length : 0;
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
