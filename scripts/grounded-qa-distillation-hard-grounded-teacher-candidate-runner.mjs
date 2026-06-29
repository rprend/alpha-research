import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const ledgerDir = path.join(experimentDir, "llm-calls");
const spendDir = path.join(experimentDir, "spend");
const args = parseArgs(process.argv.slice(2));

const gapRunId = args["gap-run-id"] ?? "current-grounded-gap-taxonomy-audit-frontier-repaired-v1";
const validationPacketRunId = args["validation-packet-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "hard-grounded-teacher-candidate-run-gpt4o-2026-06-29-v1";
const model = args.model ?? "gpt-4o";
const dryRun = args["dry-run"] === "true";
const maxRows = numberArg(args["max-rows"], Number.POSITIVE_INFINITY);
const maxRunCostUsd = numberArg(args["max-run-cost-usd"], 0.75);
const maxTotalBudgetUsd = numberArg(args["max-total-budget-usd"], 100);
const maxOutputTokens = numberArg(args["max-output-tokens"], 900);
const outputDir = path.join(runsDir, runId);
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const llmBudgetPath = path.join(ledgerDir, "budget.json");
const totalBudgetPath = path.join(spendDir, "budget.json");
const externalLedgerPath = path.join(spendDir, "ledger.jsonl");
const prices = {
  "gpt-4o": {
    inputPerMillion: 2.50,
    outputPerMillion: 10.00,
    source: "https://platform.openai.com/docs/pricing",
    checked_at: "2026-06-29",
  },
  "gpt-4o-mini": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.60,
    source: "https://platform.openai.com/docs/pricing",
    checked_at: "2026-06-29",
  },
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
const gapRows = await readJsonl(path.join(runsDir, gapRunId, "grounded_gap_rows.jsonl"));
const prompts = await readJsonl(path.join(runsDir, validationPacketRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, validationPacketRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const targetById = new Map(targets.map((row) => [row.example_id, row]));
const selectedGapRows = gapRows
  .filter((row) => row.gap_class === "candidate_absence_gap_five_system_pool")
  .slice(0, maxRows);
if (!selectedGapRows.length) throw new Error("No candidate-absence grounded rows found.");
const requests = selectedGapRows.map((gapRow, index) => buildRequestRecord(gapRow, index));
const estimates = requests.map((request) => estimateRequest(request));
const estimatedCost = round(sum(estimates.map((row) => row.estimated_cost_usd)), 8);
if (estimatedCost > maxRunCostUsd) {
  throw new Error(`Refusing run: estimated cost $${estimatedCost} exceeds max run cost $${maxRunCostUsd}.`);
}
if (Number(budgetBefore.spend_usd?.total_actual ?? 0) + estimatedCost > maxTotalBudgetUsd) {
  throw new Error(`Refusing run: total spend plus estimate would exceed $${maxTotalBudgetUsd}.`);
}

const priorRows = await readJsonlIfPresent(path.join(outputDir, "teacher_candidates.jsonl"));
const completedIds = new Set(priorRows.filter((row) => !row.skipped).map((row) => row.request_id));
const candidateRows = [...priorRows];
const failures = await readJsonlIfPresent(path.join(outputDir, "failures.jsonl"));
if (dryRun || !process.env.OPENAI_API_KEY) {
  const reason = dryRun ? "dry-run requested" : "OPENAI_API_KEY missing";
  for (const request of requests.filter((row) => !completedIds.has(row.request_id))) {
    const estimate = estimates.find((row) => row.request_id === request.request_id);
    candidateRows.push({
      request_id: request.request_id,
      example_id: request.example_id,
      skipped: true,
      skip_reason: reason,
      model,
      estimate,
      gap_metadata: request.gap_metadata,
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
      const normalized = normalizePrediction(parsed);
      const score = scorePrediction(normalized, request.target, request.prompt);
      await appendLedger(ledgerPath, {
        ts: new Date().toISOString(),
        provider: "openai",
        model,
        task: "grounded_qa_hard_grounded_teacher_candidate",
        run_id: runId,
        gap_run_id: gapRunId,
        validation_packet_run_id: validationPacketRunId,
        request_id: request.request_id,
        example_id: request.example_id,
        answer_form: request.gap_metadata.answer_form,
        target_citation_count: request.gap_metadata.target_citation_count,
        prompt_tokens: usage.prompt_tokens ?? null,
        completion_tokens: usage.completion_tokens ?? null,
        total_tokens: usage.total_tokens ?? null,
        cost_usd: cost,
        price_source: price.source,
        price_checked_at: price.checked_at,
      });
      candidateRows.push({
        request_id: request.request_id,
        example_id: request.example_id,
        skipped: false,
        model,
        gap_metadata: request.gap_metadata,
        prediction: normalized,
        raw_content: rawContent,
        score,
        usage,
        cost_usd: cost,
      });
      await writeJsonl(path.join(outputDir, "teacher_candidates.jsonl"), dedupeByRequestId(candidateRows));
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

const finalRows = dedupeByRequestId(candidateRows);
const budgets = await refreshBudgets();
const metrics = summarize(finalRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "hard_grounded_teacher_candidate_run",
  status: statusFor(metrics, dryRun || !process.env.OPENAI_API_KEY),
  purpose: "Test whether a stronger OpenAI teacher can construct contract-correct grounded-answer candidates for repaired-validation rows where every existing cheap candidate failed.",
  model,
  source_runs: {
    grounded_gap_taxonomy: gapRunId,
    validation_packet: validationPacketRunId,
  },
  leakage_note: "Rows are repaired-validation diagnostics only. Generated teacher candidates are not training data unless a later decision explicitly mines matching non-final/train rows and keeps validation rows reporting-only.",
  dry_run: dryRun || !process.env.OPENAI_API_KEY,
  requests_planned: requests.length,
  calls_made: finalRows.filter((row) => !row.skipped).length,
  estimated_cost_usd: estimatedCost,
  run_cost_usd: round(sum(finalRows.map((row) => Number(row.cost_usd ?? 0))), 10),
  metrics,
  budget: {
    max_budget_usd: maxTotalBudgetUsd,
    total_actual_before_run_usd: budgetBefore.spend_usd?.total_actual,
    actual_total_after_run_usd: budgets.totalBudget.spend_usd.total_actual,
    remaining_budget_usd: budgets.totalBudget.spend_usd.remaining,
    openai_ledger_spend_after_usd: budgets.llmBudget.ledger_spend_usd,
    external_compute_spend_after_usd: budgets.totalBudget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: finalRows.filter((row) => !row.skipped).length,
    openai_cost_usd: round(sum(finalRows.map((row) => Number(row.cost_usd ?? 0))), 10),
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    ledger_task: "grounded_qa_hard_grounded_teacher_candidate",
  },
  decision: decisionFor(metrics),
  artifacts: {
    requests_jsonl: rel(path.join(outputDir, "requests.jsonl")),
    estimated_calls_jsonl: rel(path.join(outputDir, "estimated_calls.jsonl")),
    teacher_candidates_jsonl: rel(path.join(outputDir, "teacher_candidates.jsonl")),
    failures_jsonl: rel(path.join(outputDir, "failures.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "requests.jsonl"), requests.map(scrubRequestForArtifact));
await writeJsonl(path.join(outputDir, "estimated_calls.jsonl"), estimates);
await writeJsonl(path.join(outputDir, "teacher_candidates.jsonl"), finalRows);
await writeJsonl(path.join(outputDir, "failures.jsonl"), failures);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  model: result.model,
  calls_made: result.calls_made,
  run_cost_usd: result.run_cost_usd,
  metrics: result.metrics,
  budget: result.budget,
  decision: result.decision,
}, null, 2));

function buildRequestRecord(gapRow, index) {
  const prompt = promptById.get(gapRow.example_id);
  const target = targetById.get(gapRow.example_id);
  if (!prompt || !target) throw new Error(`Missing prompt/target for ${gapRow.example_id}`);
  return {
    request_id: `hard-grounded-teacher-${String(index + 1).padStart(3, "0")}`,
    example_id: gapRow.example_id,
    prompt,
    target,
    gap_metadata: {
      answer_form: gapRow.answer_form,
      target_citation_count: gapRow.target_citation_count,
      target_citations: gapRow.target_citations,
      evidence_pack_size: gapRow.evidence_pack_size,
      failure_tags: gapRow.failure_tags,
    },
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
          "You are a careful citation-grounded QA teacher.",
          "Use only the supplied compact evidence pack and metadata.",
          "Return valid JSON only with keys answer_type, evidence_first, answer, citations, claim_table, and abstention_reason.",
          "For grounded_answer, every factual claim must appear in evidence_first.supported_claims with citations from the evidence pack, and the answer must only restate those claims with inline citations.",
          "For abstain, answer must be empty and citations must be empty.",
          "Do not use outside knowledge, paper abstracts beyond the supplied metadata, or nearby but wrong-target facts.",
          "Be especially strict for numeric, comparison, list, and multi-citation synthesis questions.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Construct the best evidence-first answer for this hard grounded-answer case.",
          "The existing cheap candidate pool had no contract-correct candidate; your job is to test whether a stronger teacher can construct one from the same compact evidence.",
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
          `Answer form diagnostic: ${request.gap_metadata.answer_form}`,
          `Required citation ids in repaired target are hidden from you in a real setting; cite only evidence ids you actually use.`,
          "",
          "Return JSON only.",
        ].join("\n"),
      },
    ],
  };
}

function scorePrediction(prediction, targetRow, prompt) {
  const target = targetRow.target ?? targetRow;
  const evidenceIds = new Set((prompt.input?.compact_retrieved_evidence_pack ?? []).map((row) => String(row.evidence_id)));
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

function summarize(rows) {
  const completed = rows.filter((row) => !row.skipped);
  const correct = completed.filter((row) => row.score?.contract_correct);
  const groundedTargets = completed.filter((row) => row.score?.target_answer_type === "grounded_answer");
  return {
    examples: rows.length,
    completed_calls: completed.length,
    skipped: rows.filter((row) => row.skipped).length,
    contract_correct: correct.length,
    contract_correct_rate: rate(correct.length, completed.length),
    grounded_targets: groundedTargets.length,
    grounded_contract_correct: groundedTargets.filter((row) => row.score?.contract_correct).length,
    answer_type_correct: completed.filter((row) => row.score?.answer_type_correct).length,
    citation_set_exact: completed.filter((row) => row.score?.citation_set_exact).length,
    evidence_first_valid: completed.filter((row) => row.score?.evidence_first_valid).length,
    cited_ids_exist: completed.filter((row) => row.score?.cited_ids_exist).length,
    mean_answer_token_f1: mean(completed.map((row) => row.score?.answer_token_f1 ?? 0)),
    by_answer_form: summarizeBy(completed, (row) => row.gap_metadata?.answer_form),
  };
}

function statusFor(metrics, didDryRun) {
  if (didDryRun || metrics.completed_calls === 0) return "hard_grounded_teacher_candidate_not_run";
  if (metrics.contract_correct_rate >= 0.5) return "hard_grounded_teacher_candidate_surface_promising";
  if (metrics.contract_correct > 0) return "hard_grounded_teacher_candidate_surface_partial";
  return "hard_grounded_teacher_candidate_surface_not_enough";
}

function decisionFor(metrics) {
  if (metrics.completed_calls === 0) {
    return {
      mine_nonfinal_teacher_packet_now: false,
      launch_prime_now: false,
      buy_more_openai_labels_now: false,
      reason: "No teacher calls were made.",
      next_step: "Run with OPENAI_API_KEY after confirming budget.",
    };
  }
  if (metrics.contract_correct_rate >= 0.5) {
    return {
      mine_nonfinal_teacher_packet_now: true,
      launch_prime_now: false,
      buy_more_openai_labels_now: false,
      reason: "The stronger teacher constructs enough contract-correct candidates on cheap-pool absence rows to justify mining matched non-final/train hard rows.",
      next_step: "Build a leakage-safe non-final teacher-candidate packet for the same answer-form strata before any GPU smoke.",
    };
  }
  return {
    mine_nonfinal_teacher_packet_now: false,
    launch_prime_now: false,
    buy_more_openai_labels_now: false,
    reason: "The stronger teacher did not construct enough contract-correct candidates on cheap-pool absence rows to justify immediate packet mining.",
    next_step: "Audit failed teacher candidates for retrieval/table truncation versus instruction/format failure before spending more.",
  };
}

function renderReport(result) {
  const formRows = Object.entries(result.metrics.by_answer_form ?? {})
    .map(([form, metrics]) => `| \`${form}\` | ${metrics.examples} | ${metrics.contract_correct} | ${pct(metrics.contract_correct_rate)} |`)
    .join("\n");
  return `# Hard Grounded Teacher Candidate Run

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run tests whether a stronger OpenAI teacher can construct candidates for the repaired-validation grounded rows where the existing cheap candidate pool had no contract-correct answer. It records every API call in the OpenAI ledger and launches no GPU compute.

| Model | Calls | Cost | Contract correct | Answer type correct | Citation exact | Evidence-first valid | Remaining budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| \`${result.model}\` | ${result.calls_made} | $${result.run_cost_usd.toFixed(6)} | ${result.metrics.contract_correct}/${result.metrics.completed_calls} | ${result.metrics.answer_type_correct}/${result.metrics.completed_calls} | ${result.metrics.citation_set_exact}/${result.metrics.completed_calls} | ${result.metrics.evidence_first_valid}/${result.metrics.completed_calls} | $${Number(result.budget.remaining_budget_usd).toFixed(6)} |

## By Answer Form

| Answer form | Examples | Contract correct | Rate |
| --- | ---: | ---: | ---: |
${formRows || "| none | 0 | 0 | 0% |"}

## Decision

- Mine non-final teacher packet now: ${result.decision.mine_nonfinal_teacher_packet_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function scrubRequestForArtifact(request) {
  return {
    request_id: request.request_id,
    example_id: request.example_id,
    gap_metadata: request.gap_metadata,
    question: request.prompt.input.question,
    evidence_pack: request.prompt.input.compact_retrieved_evidence_pack,
    document_metadata: request.prompt.input.document_metadata,
    target_answer_type: request.target.target?.answer_type ?? request.target.answer_type,
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
      const message = `OpenAI hard-grounded teacher request failed for ${requestId}: ${status} ${JSON.stringify(payload).slice(0, 600)}`;
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
    max_budget_usd: maxTotalBudgetUsd,
    ledger_spend_usd: openaiSpend,
    remaining_budget_usd: round(Math.max(0, maxTotalBudgetUsd - openaiSpend), 12),
    ledger_path: rel(ledgerPath),
    last_updated: new Date().toISOString(),
  };
  const totalBudget = {
    generated_at: new Date().toISOString(),
    max_budget_usd: maxTotalBudgetUsd,
    spend_usd: {
      openai: openaiSpend,
      external_compute: externalSpend,
      total_actual: total,
      remaining: round(Math.max(0, maxTotalBudgetUsd - total), 12),
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

function estimateRequest(request) {
  const apiRequest = buildApiRequest(request);
  const estimatedInputTokens = Math.ceil(JSON.stringify(apiRequest.messages).length / 4);
  return {
    request_id: request.request_id,
    example_id: request.example_id,
    answer_form: request.gap_metadata.answer_form,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: maxOutputTokens,
    estimated_cost_usd: round(callCost(estimatedInputTokens, maxOutputTokens, price), 8),
    price_source: price.source,
    price_checked_at: price.checked_at,
  };
}

function formatEvidence(evidence) {
  return `[${evidence.evidence_id}] ${evidence.section ?? "Evidence"}: ${evidence.text}`;
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
    return { answer_type: "abstain", evidence_first: { sufficiency: "insufficient", supported_claims: [], missing_support: "Model did not return valid JSON.", question_target: "" }, answer: "", citations: [], claim_table: [], abstention_reason: "Model did not return valid JSON." };
  }
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

function summarizeBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row) ?? "missing";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const summary = {};
  for (const [key, group] of groups) {
    const correct = group.filter((row) => row.score?.contract_correct).length;
    summary[key] = {
      examples: group.length,
      contract_correct: correct,
      contract_correct_rate: rate(correct, group.length),
    };
  }
  return summary;
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

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
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

function mean(values) {
  return values.length ? sum(values) / values.length : 0;
}

function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function rel(file) {
  return path.relative(rootDir, file);
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function round(value, digits = 6) {
  if (!Number.isFinite(Number(value))) return 0;
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
