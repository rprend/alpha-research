import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const ledgerDir = path.join(experimentDir, "llm-calls");
const spendDir = path.join(experimentDir, "spend");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "openai-boundary-adjudication-probe-2026-06-29-v1";
const packetRunId = args["packet-run-id"] ?? "nonreview-oracle-contrast-packet-2026-06-29-v1";
const missAuditRunId = args["miss-audit-run-id"] ?? "nonreview-router-miss-gap-audit-2026-06-29-v1";
const routerGateRunId = args["router-gate-run-id"] ?? "nonreview-coverage-router-audit-2026-06-29-v1-contract-gate";
const model = args.model ?? "gpt-5.4";
const limit = numberArg(args.limit, 8);
const dryRun = args["dry-run"] === "true";
const maxRunCostUsd = numberArg(args["max-run-cost-usd"], 0.5);
const maxBudgetUsd = numberArg(args["max-budget-usd"], 100);
const maxOutputTokens = numberArg(args["max-output-tokens"], 700);
const outputDir = path.join(runsDir, runId);
const packetDir = path.join(runsDir, packetRunId, "dataset");
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const llmBudgetPath = path.join(ledgerDir, "budget.json");
const totalBudgetPath = path.join(spendDir, "budget.json");
const externalLedgerPath = path.join(spendDir, "ledger.jsonl");

const prices = {
  "gpt-5.4": {
    inputPerMillion: 2.50,
    outputPerMillion: 15.00,
    source: "https://developers.openai.com/api/docs/pricing",
    checked_at: "2026-06-29",
  },
  "gpt-4o": {
    inputPerMillion: 2.50,
    outputPerMillion: 10.00,
    source: "legacy local table; current pricing page no longer lists base gpt-4o text generation",
    checked_at: "2026-06-29",
  },
};
const price = prices[model];
if (!price) throw new Error(`Missing price table entry for model ${model}.`);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });
await fs.mkdir(ledgerDir, { recursive: true });
await fs.mkdir(spendDir, { recursive: true });
await ensureFile(ledgerPath);
await ensureFile(externalLedgerPath);

const prompts = await readJsonl(path.join(packetDir, "eval_prompts.jsonl"));
const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const missRows = await readJsonl(path.join(runsDir, missAuditRunId, "audit_rows.jsonl"));
const routerRows = await readJsonl(path.join(runsDir, routerGateRunId, "scored_predictions.jsonl"));
const routerById = new Map(routerRows.map((row) => [row.example_id, row]));
const selectedRows = missRows
  .filter((row) => row.answer_type_correct && row.evidence_first_valid && row.target_answer_type === "grounded_answer")
  .sort((left, right) => priorityFor(right) - priorityFor(left) || String(left.example_id).localeCompare(String(right.example_id)))
  .slice(0, limit);
const requests = selectedRows.map((row, index) => buildRequestRecord(row, promptById.get(row.example_id), routerById.get(row.example_id), index));
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
      target_citations_hidden_for_scoring: request.target_citations,
    });
  }
} else {
  for (const request of requests.filter((row) => !completedIds.has(row.request_id))) {
    try {
      const apiRequest = buildApiRequest(request);
      const payload = await openAiChatCompletion(apiRequest, request.request_id);
      const usage = payload.usage ?? {};
      const rawContent = payload.choices?.[0]?.message?.content ?? "";
      const prediction = normalizeBoundaryPrediction(parseJson(rawContent), request.evidence_ids);
      const cost = round(callCost(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0, price), 10);
      const score = scorePrediction(prediction, request);
      await appendLedger(ledgerPath, {
        ts: new Date().toISOString(),
        provider: "openai",
        model,
        task: "grounded_qa_boundary_adjudication_probe",
        run_id: runId,
        packet_run_id: packetRunId,
        request_id: request.request_id,
        example_id: request.example_id,
        target_citation_count: request.target_citations.length,
        router_predicted_citation_count: request.router_citations.length,
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
        question: request.question,
        router_citations: request.router_citations,
        target_citations_hidden_for_scoring: request.target_citations,
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
  artifact_type: "openai_boundary_adjudication_probe",
  status: statusFor(finalPredictions),
  purpose: "Test whether a stronger boundary-only paid adjudicator can identify exact include/exclude citation boundaries on D448 router misses before any broader labels or GPU training.",
  leakage_note: "Rows are fresh non-review eval misses. Outputs are diagnostic only and must not be used as training labels or final benchmark labels.",
  packet_run_id: packetRunId,
  miss_audit_run_id: missAuditRunId,
  router_gate_run_id: routerGateRunId,
  model,
  dry_run: dryRun || !process.env.OPENAI_API_KEY,
  target_selection: {
    source_router_misses: missRows.length,
    selected_rows: requests.length,
    by_miss_family: countBy(requests.map((row) => row.miss_family)),
    target_citation_count_distribution: countBy(requests.map((row) => row.target_citations.length)),
  },
  calls_made: completed.length,
  calls_skipped: finalPredictions.filter((row) => row.skipped).length,
  estimated_cost_usd: estimatedCost,
  run_cost_usd: round(sum(completed.map((row) => Number(row.cost_usd ?? 0))), 10),
  metrics: summarize(completed),
  impact_context: {
    d448_router_correct_on_full_eval: 42,
    probed_rows_router_correct: 0,
    probed_rows_boundary_exact: count(completed, (row) => row.score?.citation_set_exact),
    full_eval_correct_if_oracle_switched_only_probed_rows: 42 + count(completed, (row) => row.score?.citation_set_exact),
  },
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
    ledger_task: "grounded_qa_boundary_adjudication_probe",
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
  calls_skipped: result.calls_skipped,
  run_cost_usd: result.run_cost_usd,
  metrics: result.metrics,
  impact_context: result.impact_context,
  budget: result.budget,
  decision: result.decision,
}, null, 2));

function buildRequestRecord(row, prompt, routerRow, index) {
  if (!prompt?.input?.question || !Array.isArray(prompt.input.compact_retrieved_evidence_pack)) {
    throw new Error(`Missing prompt/input for ${row.example_id}`);
  }
  return {
    request_id: `boundary-adjudication-${String(index + 1).padStart(3, "0")}`,
    example_id: row.example_id,
    question: prompt.input.question,
    document_metadata: prompt.input.document_metadata,
    evidence_pack: prompt.input.compact_retrieved_evidence_pack,
    evidence_ids: prompt.input.compact_retrieved_evidence_pack.map((item) => item.evidence_id),
    router_citations: normalizeCitations(routerRow?.prediction?.citations ?? row.predicted_citations),
    target_citations: normalizeCitations(row.target_citations),
    miss_family: row.miss_family,
    target_supported_claims_hidden_for_scoring: row.target_supported_claims,
  };
}

function priorityFor(row) {
  const targetCount = normalizeCitations(row.target_citations).length;
  if (row.miss_family === "partial_multicitation") return 50 + targetCount;
  if (row.miss_family === "mixed_wrong_and_missing") return 40 + targetCount;
  if (row.miss_family === "wrong_singleton") return 30 + targetCount;
  return 20 + targetCount;
}

function buildApiRequest(request) {
  const apiRequest = {
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are an evidence-boundary adjudicator for citation-grounded QA.",
          "Use only the supplied compact evidence pack. Do not answer from outside knowledge.",
          "Your task is not to write the answer. Your task is to decide, for each evidence id, whether it is required to support a complete answer to the exact question.",
          "Include every evidence id needed for distinct required facts. Exclude nearby passages that are true but answer a different target or are redundant.",
          "Return valid JSON only with keys answer_type, required_citations, excluded_citations, evidence_decisions, missing_support.",
          "answer_type must be grounded_answer if the evidence pack can answer the exact question, otherwise abstain.",
          "required_citations must contain bracketless ids like E1. For abstain, required_citations must be [].",
          "Each evidence_decisions item must have evidence_id, decision as include or exclude, and a short reason.",
        ].join(" "),
      },
      {
        role: "user",
        content: renderPrompt(request),
      },
    ],
  };
  if (/^gpt-5/i.test(model)) apiRequest.max_completion_tokens = maxOutputTokens;
  else apiRequest.max_tokens = maxOutputTokens;
  return apiRequest;
}

function renderPrompt(request) {
  return [
    `Question: ${request.question}`,
    "",
    "Document metadata:",
    `- paper_id: ${request.document_metadata?.paper_id ?? ""}`,
    `- title: ${request.document_metadata?.title ?? ""}`,
    `- inferred_publication_date: ${request.document_metadata?.inferred_publication_date ?? ""}`,
    `- knowledge_base_version: ${request.document_metadata?.knowledge_base_version ?? ""}`,
    "",
    `Current router citations to audit: ${request.router_citations.join(", ") || "(none)"}`,
    `Router miss family: ${request.miss_family}`,
    "",
    "Evidence pack:",
    request.evidence_pack.map(formatEvidence).join("\n\n"),
    "",
    "Return only JSON. Identify the exact minimal evidence boundary needed for a complete answer.",
  ].join("\n");
}

function scorePrediction(prediction, request) {
  const target = new Set(request.target_citations);
  const predicted = new Set(prediction.required_citations);
  const citationSetExact = setEqual(predicted, target);
  const includesAllRequired = request.target_citations.every((id) => predicted.has(id));
  const extraCitations = prediction.required_citations.filter((id) => !target.has(id));
  const missingCitations = request.target_citations.filter((id) => !predicted.has(id));
  return {
    answer_type_correct: prediction.answer_type === "grounded_answer",
    citation_set_exact: citationSetExact,
    includes_all_required: includesAllRequired,
    missing_citations: missingCitations,
    extra_citations: extraCitations,
    predicted_citations: prediction.required_citations,
    target_citations: request.target_citations,
    target_citation_count: request.target_citations.length,
    predicted_citation_count: prediction.required_citations.length,
    jaccard: setJaccard(predicted, target),
  };
}

function normalizeBoundaryPrediction(value, evidenceIds) {
  const evidenceSet = new Set(evidenceIds);
  const answerType = String(value?.answer_type ?? "").trim() === "abstain" ? "abstain" : "grounded_answer";
  const required = answerType === "grounded_answer"
    ? normalizeCitations(value?.required_citations ?? value?.citations ?? []).filter((id) => evidenceSet.has(id))
    : [];
  const decisions = Array.isArray(value?.evidence_decisions) ? value.evidence_decisions.map((row) => ({
    evidence_id: String(row.evidence_id ?? "").replace(/^\[|\]$/g, ""),
    decision: String(row.decision ?? "").toLowerCase().includes("include") ? "include" : "exclude",
    reason: String(row.reason ?? "").trim(),
  })).filter((row) => evidenceSet.has(row.evidence_id)) : [];
  return {
    answer_type: answerType,
    required_citations: [...new Set(required)],
    excluded_citations: [...new Set(normalizeCitations(value?.excluded_citations ?? []).filter((id) => evidenceSet.has(id)))],
    evidence_decisions: decisions,
    missing_support: answerType === "abstain" ? String(value?.missing_support ?? "").trim() : "",
  };
}

function summarize(rows) {
  return {
    examples: rows.length,
    answer_type_correct: count(rows, (row) => row.score?.answer_type_correct),
    citation_set_exact: count(rows, (row) => row.score?.citation_set_exact),
    includes_all_required: count(rows, (row) => row.score?.includes_all_required),
    mean_jaccard: mean(rows.map((row) => row.score?.jaccard ?? 0)),
    mean_predicted_citation_count: mean(rows.map((row) => row.score?.predicted_citation_count ?? 0)),
    by_miss_family: summarizeBy(rows, (row) => requests.find((request) => request.example_id === row.example_id)?.miss_family ?? "unknown"),
    by_target_citation_count: summarizeBy(rows, (row) => String(row.score?.target_citation_count ?? "unknown")),
  };
}

function summarizeBy(rows, keyFn) {
  const out = {};
  for (const key of Object.keys(countBy(rows.map(keyFn))).sort()) {
    const group = rows.filter((row) => keyFn(row) === key);
    out[key] = {
      examples: group.length,
      citation_set_exact: count(group, (row) => row.score?.citation_set_exact),
      includes_all_required: count(group, (row) => row.score?.includes_all_required),
      mean_jaccard: mean(group.map((row) => row.score?.jaccard ?? 0)),
    };
  }
  return out;
}

function statusFor(rows) {
  const completed = rows.filter((row) => !row.skipped);
  if (!completed.length) return "boundary_adjudication_probe_not_run";
  const metrics = summarize(completed);
  if (metrics.citation_set_exact >= Math.ceil(metrics.examples * 0.75)) return "boundary_adjudication_probe_promising";
  if (metrics.includes_all_required >= Math.ceil(metrics.examples * 0.75)) return "boundary_adjudication_recall_promising_but_overselects";
  return "boundary_adjudication_probe_not_enough";
}

function decisionFor(rows) {
  const metrics = summarize(rows);
  const promising = metrics.examples > 0 && metrics.citation_set_exact >= Math.ceil(metrics.examples * 0.75);
  const recallOnly = metrics.examples > 0 && metrics.includes_all_required >= Math.ceil(metrics.examples * 0.75);
  return {
    buy_more_openai_boundary_labels_now: promising,
    rent_prime_gpu_now: false,
    train_from_fresh_eval_labels: false,
    reason: promising
      ? `Boundary adjudication reached ${metrics.citation_set_exact}/${metrics.examples} exact citation sets on router misses.`
      : recallOnly
        ? `Boundary adjudication included all required citations on ${metrics.includes_all_required}/${metrics.examples} but exactness was only ${metrics.citation_set_exact}/${metrics.examples}.`
        : `Boundary adjudication exactness was ${metrics.citation_set_exact}/${metrics.examples}; not strong enough for broader paid labeling or GPU training.`,
    next_step: promising
      ? "Run the same boundary prompt on non-final train/validation analogs only and build a guarded router feature; do not train on this fresh eval probe."
      : "Stop broad paid boundary labeling for now; inspect failures and either narrow the prompt further or return to train-only adjudication sources.",
  };
}

function renderReport(result) {
  return `# OpenAI Boundary Adjudication Probe

Generated: ${result.generated_at}

Status: \`${result.status}\`

This capped paid probe asks a model to decide citation include/exclude boundaries on D448 router misses. Fresh eval outputs are diagnostic only.

| Model | Calls | Cost | Exact boundaries | Includes all required | Remaining budget |
| --- | ---: | ---: | ---: | ---: | ---: |
| \`${result.model}\` | ${result.calls_made} | $${result.run_cost_usd.toFixed(6)} | ${result.metrics.citation_set_exact}/${result.metrics.examples} | ${result.metrics.includes_all_required}/${result.metrics.examples} | $${Number(result.budget.remaining_budget_usd).toFixed(6)} |

## Impact Context

- D448 router full-eval correct: ${result.impact_context.d448_router_correct_on_full_eval}/64
- Probed router-miss rows: ${result.target_selection.selected_rows}
- Full-eval correct if exact boundary labels were safely switched for these rows only: ${result.impact_context.full_eval_correct_if_oracle_switched_only_probed_rows}/64

## Budget

- Estimated cost: $${result.estimated_cost_usd.toFixed(6)}
- Run cost: $${result.run_cost_usd.toFixed(6)}
- Total tracked spend: $${Number(result.budget.actual_total_after_run_usd).toFixed(6)} / $${result.budget.max_budget_usd}
- OpenAI ledger spend: $${Number(result.budget.openai_ledger_spend_after_usd).toFixed(6)}
- External compute spend: $${Number(result.budget.external_compute_spend_after_usd).toFixed(6)}
- Price source: ${price.source}

## Decision

- Buy more OpenAI boundary labels now: ${result.decision.buy_more_openai_boundary_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Train from fresh eval labels: ${result.decision.train_from_fresh_eval_labels ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function scrubRequestForArtifact(request) {
  return {
    request_id: request.request_id,
    example_id: request.example_id,
    question: request.question,
    document_metadata: request.document_metadata,
    evidence_pack: request.evidence_pack,
    router_citations: request.router_citations,
    miss_family: request.miss_family,
    target_citations_hidden_for_scoring: request.target_citations,
    target_supported_claims_hidden_for_scoring: request.target_supported_claims_hidden_for_scoring,
  };
}

function estimateRequest(request) {
  const apiRequest = buildApiRequest(request);
  const estimatedInputTokens = Math.ceil(JSON.stringify(apiRequest.messages).length / 4);
  return {
    request_id: request.request_id,
    example_id: request.example_id,
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
      const message = `OpenAI boundary adjudication request failed for ${requestId}: ${status} ${JSON.stringify(payload).slice(0, 600)}`;
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
    return {
      answer_type: "abstain",
      required_citations: [],
      excluded_citations: [],
      evidence_decisions: [],
      missing_support: "Model did not return valid JSON.",
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

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function setJaccard(left, right) {
  if (!left.size && !right.size) return 1;
  const intersection = [...left].filter((value) => right.has(value)).length;
  return intersection / new Set([...left, ...right]).size;
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

function round(value, digits = 12) {
  return Number(Number(value).toFixed(digits));
}

function rel(file) {
  return path.relative(rootDir, file);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
