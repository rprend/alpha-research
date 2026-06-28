import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const ledgerDir = path.join(experimentDir, "llm-calls");
const spendDir = path.join(experimentDir, "spend");
const args = parseArgs(process.argv.slice(2));

const planRunId = args["plan-run"] ?? "high-score-support-label-batch-plan-2026-06-28-v1";
const runId = args["run-id"] ?? "high-score-support-label-batch-run-gpt4o-mini-2026-06-28-v1";
const model = args.model ?? "gpt-4o-mini";
const dryRun = args["dry-run"] === "true" || args.dryRun === "true";
const maxRequests = numberArg(args["max-requests"], Number.POSITIVE_INFINITY);
const maxRunCostUsd = Number(args["max-run-cost-usd"] ?? 0.10);
const maxTotalBudgetUsd = Number(args["max-total-budget-usd"] ?? 100);
const maxOutputTokens = numberArg(args["max-output-tokens"], 520);
const outputDir = path.join(runsDir, runId);
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const llmBudgetPath = path.join(ledgerDir, "budget.json");
const totalBudgetPath = path.join(spendDir, "budget.json");
const externalLedgerPath = path.join(spendDir, "ledger.jsonl");
const prices = {
  "gpt-4o-mini": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.60,
    source: "https://developers.openai.com/api/pricing",
    checked_at: "2026-06-28",
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

const plan = await readJson(path.join(runsDir, planRunId, "result.json"));
if (plan.artifact_type !== "high_score_support_label_batch_plan") {
  throw new Error(`${planRunId} is not a high-score support label batch plan.`);
}
if (plan.cost_estimate?.would_keep_total_under_100_usd !== true) {
  throw new Error(`${planRunId} does not pass the under-$100 planning guard.`);
}
if (plan.leakage_guard?.final_window_labels_used_for_training !== false) {
  throw new Error(`${planRunId} does not preserve the final-window training leakage guard.`);
}

const totalBudgetBefore = await readJson(totalBudgetPath);
const allRequests = await readJsonl(path.join(runsDir, planRunId, "candidate_label_requests.jsonl"));
const requests = allRequests.slice(0, maxRequests);
if (!requests.length) throw new Error("No high-score support label requests found.");
for (const request of requests) validateRequest(request);

const priorAdjudications = await readJsonlIfPresent(path.join(outputDir, "adjudications.jsonl"));
const completedIds = new Set(priorAdjudications.filter((row) => !row.skipped).map((row) => row.request_id));
const pendingRequests = requests.filter((request) => !completedIds.has(request.request_id));
const estimates = requests.map((request) => estimateRequest(request));
const pendingEstimates = estimates.filter((row) => !completedIds.has(row.request_id));
const estimatedPendingCost = round(sum(pendingEstimates.map((row) => row.estimated_cost_usd)), 8);
if (estimatedPendingCost > maxRunCostUsd) {
  throw new Error(`Refusing run: estimated pending cost $${estimatedPendingCost} exceeds max run cost $${maxRunCostUsd}.`);
}
if (Number(totalBudgetBefore.spend_usd.total_actual) + estimatedPendingCost > maxTotalBudgetUsd) {
  throw new Error(`Refusing run: total spend $${Number(totalBudgetBefore.spend_usd.total_actual).toFixed(6)} + estimated $${estimatedPendingCost.toFixed(6)} exceeds $${maxTotalBudgetUsd}.`);
}

const adjudications = [...priorAdjudications];
const failures = await readJsonlIfPresent(path.join(outputDir, "failures.jsonl"));
if (dryRun || !process.env.OPENAI_API_KEY) {
  const reason = dryRun ? "dry-run requested" : "OPENAI_API_KEY missing";
  for (const request of pendingRequests) {
    const estimate = estimates.find((row) => row.request_id === request.request_id);
    adjudications.push({
      request_id: request.request_id,
      example_id: request.metadata.example_id,
      skipped: true,
      skip_reason: reason,
      model,
      estimated_input_tokens: estimate.estimated_input_tokens,
      estimated_output_tokens: estimate.estimated_output_tokens,
      estimated_cost_usd: estimate.estimated_cost_usd,
      metadata: request.metadata,
    });
  }
} else {
  for (const request of pendingRequests) {
    const apiRequest = buildRequest(request);
    try {
      const payload = await openAiChatCompletion(apiRequest, request.request_id);
      const usage = payload.usage ?? {};
      const cost = round(callCost(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0, price), 10);
      const rawContent = payload.choices?.[0]?.message?.content ?? "";
      const judgment = normalizeJudgment(parseJson(rawContent));
      await appendLedger(ledgerPath, {
        ts: new Date().toISOString(),
        provider: "openai",
        model,
        task: "grounded_qa_high_score_support_adjudication",
        run_id: runId,
        plan_run_id: planRunId,
        request_id: request.request_id,
        example_id: request.metadata.example_id,
        source: request.metadata.source,
        question_type: request.metadata.question_type,
        duplicate_calibration: request.metadata.duplicate_calibration,
        training_use: request.metadata.training_use,
        prompt_tokens: usage.prompt_tokens ?? null,
        completion_tokens: usage.completion_tokens ?? null,
        total_tokens: usage.total_tokens ?? null,
        cost_usd: cost,
        price_source: price.source,
        price_checked_at: price.checked_at,
      });
      adjudications.push({
        request_id: request.request_id,
        example_id: request.metadata.example_id,
        model,
        skipped: false,
        metadata: request.metadata,
        candidate_chosen_id: request.input.candidate_chosen?.candidate_id ?? null,
        candidate_rejected_id: request.input.candidate_rejected?.candidate_id ?? null,
        judgment,
        raw_content: rawContent,
        usage,
        cost_usd: cost,
      });
      await writeJsonl(path.join(outputDir, "adjudications.jsonl"), adjudications);
    } catch (error) {
      failures.push({
        ts: new Date().toISOString(),
        request_id: request.request_id,
        message: String(error.message ?? error),
      });
      await writeJsonl(path.join(outputDir, "failures.jsonl"), failures);
      await refreshBudgets();
      throw error;
    }
  }
}

const budgets = await refreshBudgets();
const finalAdjudications = dedupeRowsByRequestId(adjudications);
const metrics = summarizeAdjudications(finalAdjudications);
const runCost = round(sum(finalAdjudications.map((row) => Number(row.cost_usd ?? 0))), 10);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "high_score_support_label_batch_run",
  status: metrics.requests_judged ? "high_score_support_labels_adjudicated" : "high_score_support_labels_not_run",
  plan_run_id: planRunId,
  purpose: "Execute the targeted high-score support label batch with call-level OpenAI budget accounting.",
  model,
  dry_run: dryRun || !process.env.OPENAI_API_KEY,
  requests_planned: requests.length,
  calls_made: finalAdjudications.filter((row) => !row.skipped).length,
  calls_skipped: finalAdjudications.filter((row) => row.skipped).length,
  failures: failures.length,
  estimated_pending_cost_usd: estimatedPendingCost,
  run_cost_usd: runCost,
  metrics,
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_training_use: "validation_adjudication_only",
    nonfinal_labels_training_use: "eligible_after_agreement_check",
    duplicate_calibration_rows_training_use: "calibration_only_until_agreement_checked",
    final_window_primary_rows: finalAdjudications.filter((row) => row.metadata?.source === "final_analog_validation_only" && row.metadata?.duplicate_calibration !== true).length,
  },
  budget: {
    max_budget_usd: maxTotalBudgetUsd,
    total_actual_before_run_usd: totalBudgetBefore.spend_usd.total_actual,
    actual_total_after_run_usd: budgets.totalBudget.spend_usd.total_actual,
    remaining_budget_usd: budgets.totalBudget.spend_usd.remaining,
    openai_ledger_spend_after_usd: budgets.llmBudget.ledger_spend_usd,
    external_compute_spend_after_usd: budgets.totalBudget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: finalAdjudications.filter((row) => !row.skipped).length,
    openai_cost_usd: runCost,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    ledger_task: "grounded_qa_high_score_support_adjudication",
  },
  decision: decisionFromMetrics(metrics),
  artifacts: {
    requests_jsonl: rel(path.join(outputDir, "requests.jsonl")),
    estimated_calls_jsonl: rel(path.join(outputDir, "estimated_calls.jsonl")),
    adjudications_jsonl: rel(path.join(outputDir, "adjudications.jsonl")),
    failures_jsonl: rel(path.join(outputDir, "failures.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "requests.jsonl"), requests);
await writeJsonl(path.join(outputDir, "estimated_calls.jsonl"), estimates);
await writeJsonl(path.join(outputDir, "adjudications.jsonl"), finalAdjudications);
await writeJsonl(path.join(outputDir, "failures.jsonl"), failures);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  dry_run: result.dry_run,
  calls_made: result.calls_made,
  run_cost_usd: result.run_cost_usd,
  metrics: result.metrics,
  budget: result.budget,
  decision: result.decision,
}, null, 2));

function validateRequest(request) {
  if (request.task !== "high_score_support_adjudication") throw new Error(`Unexpected task for ${request.request_id}.`);
  if (!request.metadata?.example_id || !request.metadata?.training_use) throw new Error(`Malformed metadata for ${request.request_id}.`);
  if (request.metadata.source === "final_analog_validation_only" && request.metadata.training_use !== "validation_adjudication_only" && request.metadata.training_use !== "calibration_only_until_agreement_checked") {
    throw new Error(`Refusing final-window request ${request.request_id}: training_use=${request.metadata.training_use}.`);
  }
  if (request.metadata.source === "nonfinal_high_score_packet" && request.metadata.training_use !== "eligible_after_agreement_check" && request.metadata.training_use !== "calibration_only_until_agreement_checked") {
    throw new Error(`Refusing non-final request ${request.request_id}: training_use=${request.metadata.training_use}.`);
  }
  if (!request.input?.question || !Array.isArray(request.input?.evidence_pack) || !request.input.evidence_pack.length) {
    throw new Error(`Malformed request input for ${request.request_id}.`);
  }
  if (!request.input?.candidate_chosen?.answer_type || !request.input?.candidate_rejected?.answer_type) {
    throw new Error(`Missing candidate payload for ${request.request_id}.`);
  }
}

function buildRequest(request) {
  return {
    model,
    temperature: 0,
    max_tokens: maxOutputTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are a strict citation-grounded QA support adjudicator.",
          "Use only the supplied question, evidence pack, and two candidates.",
          "Judge whether the rejected candidate is fully supported by the cited evidence.",
          "A candidate is not fully supported if it cites nonexistent evidence, answers the wrong target, omits a necessary condition, overclaims beyond the evidence, makes a numeric/comparison error, or needs outside knowledge.",
          "Also judge which candidate is preferable for a citation-grounded answer.",
          "Return only valid JSON with keys: rejected_answer_supported, rejected_failure_mode, preferred_candidate, support_discriminator_hint, rationale.",
          "rejected_failure_mode must be one of: fully_supported, missing_direct_evidence, wrong_question_target, overbroad_or_overclaimed, numeric_or_comparison_error, citation_mismatch, evidence_insufficient, other.",
          "preferred_candidate must be one of: chosen, rejected, abstain, tie.",
          "support_discriminator_hint must be one of: shorter_supported_shape, numeric_comparative_penalty, citation_density, question_overlap, none_or_other.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          request.input.context_note,
          "",
          `Question: ${request.input.question}`,
          "",
          "Evidence pack:",
          request.input.evidence_pack.map(formatEvidence).join("\n\n"),
          "",
          "Candidate chosen:",
          formatCandidate(request.input.candidate_chosen),
          "",
          "Candidate rejected:",
          formatCandidate(request.input.candidate_rejected),
          "",
          "Return JSON only. Do not use outside knowledge.",
        ].join("\n"),
      },
    ],
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
      const message = `OpenAI high-score support request failed for ${requestId}: ${status} ${JSON.stringify(payload).slice(0, 500)}`;
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

function estimateRequest(request) {
  const apiRequest = buildRequest(request);
  const estimatedInputTokens = Math.ceil(JSON.stringify(apiRequest.messages).length / 4);
  return {
    request_id: request.request_id,
    example_id: request.metadata.example_id,
    source: request.metadata.source,
    duplicate_calibration: request.metadata.duplicate_calibration,
    training_use: request.metadata.training_use,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: maxOutputTokens,
    estimated_cost_usd: round(callCost(estimatedInputTokens, maxOutputTokens, price), 8),
    price_source: price.source,
    price_checked_at: price.checked_at,
  };
}

function normalizeJudgment(value) {
  const failureModes = new Set(["fully_supported", "missing_direct_evidence", "wrong_question_target", "overbroad_or_overclaimed", "numeric_or_comparison_error", "citation_mismatch", "evidence_insufficient", "other"]);
  const preferences = new Set(["chosen", "rejected", "abstain", "tie"]);
  const hints = new Set(["shorter_supported_shape", "numeric_comparative_penalty", "citation_density", "question_overlap", "none_or_other"]);
  const failureMode = String(value.rejected_failure_mode ?? "").trim();
  const preference = String(value.preferred_candidate ?? "").trim();
  const hint = String(value.support_discriminator_hint ?? "").trim();
  return {
    rejected_answer_supported: Boolean(value.rejected_answer_supported),
    rejected_failure_mode: failureModes.has(failureMode) ? failureMode : "other",
    preferred_candidate: preferences.has(preference) ? preference : "tie",
    support_discriminator_hint: hints.has(hint) ? hint : "none_or_other",
    rationale: String(value.rationale ?? ""),
  };
}

function summarizeAdjudications(rows) {
  const judged = rows.filter((row) => !row.skipped);
  const primary = judged.filter((row) => row.metadata?.duplicate_calibration !== true);
  const calibration = judged.filter((row) => row.metadata?.duplicate_calibration === true);
  const nonfinalPrimary = primary.filter((row) => row.metadata?.source === "nonfinal_high_score_packet");
  const finalPrimary = primary.filter((row) => row.metadata?.source === "final_analog_validation_only");
  const calibrationAgreement = summarizeCalibration(primary, calibration);
  return {
    requests_judged: judged.length,
    primary_judged: primary.length,
    calibration_judged: calibration.length,
    nonfinal_primary_judged: nonfinalPrimary.length,
    final_primary_judged: finalPrimary.length,
    rejected_supported_primary: primary.filter((row) => row.judgment?.rejected_answer_supported === true).length,
    rejected_unsupported_primary: primary.filter((row) => row.judgment?.rejected_answer_supported === false).length,
    chosen_preferred_primary: primary.filter((row) => row.judgment?.preferred_candidate === "chosen").length,
    rejected_preferred_primary: primary.filter((row) => row.judgment?.preferred_candidate === "rejected").length,
    tie_primary: primary.filter((row) => row.judgment?.preferred_candidate === "tie").length,
    abstain_preferred_primary: primary.filter((row) => row.judgment?.preferred_candidate === "abstain").length,
    nonfinal_chosen_preferred: nonfinalPrimary.filter((row) => row.judgment?.preferred_candidate === "chosen").length,
    final_chosen_preferred: finalPrimary.filter((row) => row.judgment?.preferred_candidate === "chosen").length,
    rejected_failure_mode_counts: countBy(primary.map((row) => row.judgment?.rejected_failure_mode ?? "missing")),
    preferred_candidate_counts: countBy(primary.map((row) => row.judgment?.preferred_candidate ?? "missing")),
    support_discriminator_hint_counts: countBy(primary.map((row) => row.judgment?.support_discriminator_hint ?? "missing")),
    calibration_agreement: calibrationAgreement,
  };
}

function summarizeCalibration(primary, calibration) {
  const primaryById = new Map(primary.map((row) => [row.request_id, row]));
  const pairs = calibration.map((row) => {
    const original = primaryById.get(primaryRequestIdForCalibration(row.request_id));
    return {
      calibration_request_id: row.request_id,
      original_request_id: original?.request_id ?? null,
      exact_match: Boolean(original) && sameJudgment(original.judgment, row.judgment),
      support_match: Boolean(original) && original.judgment?.rejected_answer_supported === row.judgment?.rejected_answer_supported,
      preference_match: Boolean(original) && original.judgment?.preferred_candidate === row.judgment?.preferred_candidate,
      failure_mode_match: Boolean(original) && original.judgment?.rejected_failure_mode === row.judgment?.rejected_failure_mode,
    };
  });
  return {
    pairs: pairs.length,
    exact_matches: pairs.filter((row) => row.exact_match).length,
    support_matches: pairs.filter((row) => row.support_match).length,
    preference_matches: pairs.filter((row) => row.preference_match).length,
    failure_mode_matches: pairs.filter((row) => row.failure_mode_match).length,
    details: pairs,
  };
}

function primaryRequestIdForCalibration(requestId) {
  const nonfinal = String(requestId).match(/^hs-support-nonfinal-calibration-(\d+)$/);
  if (nonfinal) return `hs-support-nonfinal-primary-${nonfinal[1]}`;
  const final = String(requestId).match(/^hs-support-final-calibration-(\d+)$/);
  if (final) return `hs-support-final-validation-${final[1]}`;
  return requestId;
}

function sameJudgment(left, right) {
  return left?.rejected_answer_supported === right?.rejected_answer_supported
    && left?.rejected_failure_mode === right?.rejected_failure_mode
    && left?.preferred_candidate === right?.preferred_candidate
    && left?.support_discriminator_hint === right?.support_discriminator_hint;
}

function decisionFromMetrics(metrics) {
  if (metrics.requests_judged === 0) {
    return {
      integrate_labels_now: false,
      train_support_discriminator_now: false,
      buy_more_openai_labels_now: false,
      launch_gpu_now: false,
      reason: "No paid high-score support calls were made.",
      next_step: "Run the batch with OPENAI_API_KEY after confirming budget.",
    };
  }
  const exactCalibrationRate = rate(metrics.calibration_agreement.exact_matches, metrics.calibration_agreement.pairs);
  const nonfinalChosenPreferenceRate = rate(metrics.nonfinal_chosen_preferred, metrics.nonfinal_primary_judged);
  const finalChosenPreferenceRate = rate(metrics.final_chosen_preferred, metrics.final_primary_judged);
  const rejectedUnsupportedRate = rate(metrics.rejected_unsupported_primary, metrics.primary_judged);
  if (exactCalibrationRate >= 0.75 && nonfinalChosenPreferenceRate >= 0.50 && rejectedUnsupportedRate >= 0.50) {
    return {
      integrate_labels_now: true,
      train_support_discriminator_now: true,
      buy_more_openai_labels_now: false,
      launch_gpu_now: false,
      reason: "The batch produced stable labels and enough non-final chosen-over-unsupported preferences to train a support discriminator.",
      next_step: "Train and cross-window audit a support-aware selector using only non-final adjudicated rows; keep final rows reporting-only.",
    };
  }
  if (exactCalibrationRate < 0.75) {
    return {
      integrate_labels_now: false,
      train_support_discriminator_now: false,
      buy_more_openai_labels_now: false,
      launch_gpu_now: false,
      reason: "Duplicate calibration is too unstable for training.",
      next_step: "Audit disagreement examples before buying additional labels or launching GPU work.",
    };
  }
  return {
    integrate_labels_now: false,
    train_support_discriminator_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    reason: `The label signal is not strong enough for immediate training: non-final chosen preference ${nonfinalChosenPreferenceRate.toFixed(3)}, final chosen preference ${finalChosenPreferenceRate.toFixed(3)}, rejected unsupported ${rejectedUnsupportedRate.toFixed(3)}.`,
    next_step: "Use the adjudications as diagnostics and build a narrower packet around the dominant failure modes.",
  };
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

function renderReport(result) {
  return `# High-Score Support Label Batch Run

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run executed the targeted support-adjudication batch with per-call OpenAI ledger rows. It did not launch GPU compute. Final-window rows are validation/adjudication-only.

| Requests | Calls | Cost | Non-final chosen preferred | Final chosen preferred | Calibration exact | Budget remaining |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.requests_planned} | ${result.calls_made} | $${result.run_cost_usd.toFixed(6)} | ${result.metrics.nonfinal_chosen_preferred}/${result.metrics.nonfinal_primary_judged} | ${result.metrics.final_chosen_preferred}/${result.metrics.final_primary_judged} | ${result.metrics.calibration_agreement.exact_matches}/${result.metrics.calibration_agreement.pairs} | $${result.budget.remaining_budget_usd.toFixed(6)} |

## Primary Labels

- Rejected unsupported: ${result.metrics.rejected_unsupported_primary}/${result.metrics.primary_judged}
- Chosen preferred: ${result.metrics.chosen_preferred_primary}/${result.metrics.primary_judged}
- Rejected preferred: ${result.metrics.rejected_preferred_primary}/${result.metrics.primary_judged}
- Failure modes: ${JSON.stringify(result.metrics.rejected_failure_mode_counts)}
- Support hints: ${JSON.stringify(result.metrics.support_discriminator_hint_counts)}

## Decision

- Integrate labels now: ${result.decision.integrate_labels_now ? "yes" : "no"}
- Train support discriminator now: ${result.decision.train_support_discriminator_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function formatEvidence(evidence) {
  return `[${evidence.evidence_id}] ${evidence.section ?? "Evidence"}: ${evidence.text}`;
}

function formatCandidate(candidate) {
  return [
    `candidate_id: ${candidate.candidate_id ?? ""}`,
    `family: ${candidate.family ?? ""}`,
    `answer_type: ${candidate.answer_type}`,
    `answer: ${candidate.answer || "(empty)"}`,
    `citations: ${JSON.stringify(candidate.citations ?? [])}`,
    `claim_table: ${JSON.stringify(candidate.claim_table ?? [])}`,
    `inline_complete: ${candidate.inline_complete ?? ""}`,
    `claim_count: ${candidate.claim_count ?? ""}`,
    `answer_tokens: ${candidate.answer_tokens ?? ""}`,
  ].join("\n");
}

function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return {
      rejected_answer_supported: false,
      rejected_failure_mode: "other",
      preferred_candidate: "tie",
      support_discriminator_hint: "none_or_other",
      rationale: String(content).slice(0, 500),
    };
  }
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
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function dedupeRowsByRequestId(rows) {
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
