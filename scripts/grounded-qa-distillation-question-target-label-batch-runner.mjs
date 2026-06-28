import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const ledgerDir = path.join(experimentDir, "llm-calls");
const spendDir = path.join(experimentDir, "spend");
const args = parseArgs(process.argv.slice(2));

const planRunId = args["plan-run"] ?? "question-target-label-batch-plan-2026-06-28-v1";
const runId = args["run-id"] ?? "question-target-label-batch-run-gpt4o-mini-2026-06-28-v1";
const model = args.model ?? "gpt-4o-mini";
const dryRun = args["dry-run"] === "true" || args.dryRun === "true";
const maxRequests = numberArg(args["max-requests"], Number.POSITIVE_INFINITY);
const maxRunCostUsd = Number(args["max-run-cost-usd"] ?? 0.10);
const maxTotalBudgetUsd = Number(args["max-total-budget-usd"] ?? 100);
const maxOutputTokens = numberArg(args["max-output-tokens"], 450);
const outputDir = path.join(runsDir, runId);
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const llmBudgetPath = path.join(ledgerDir, "budget.json");
const totalBudgetPath = path.join(spendDir, "budget.json");
const externalLedgerPath = path.join(spendDir, "ledger.jsonl");
const prices = {
  "gpt-4o-mini": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.60,
    source: "https://developers.openai.com/api/docs/models/gpt-4o-mini",
    checked_at: "2026-06-28",
  },
};
const price = prices[model];
if (!price) throw new Error(`Missing price entry for ${model}.`);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });
await fs.mkdir(ledgerDir, { recursive: true });
await fs.mkdir(spendDir, { recursive: true });
await ensureFile(externalLedgerPath);
await ensureFile(ledgerPath);

const plan = await readJson(path.join(runsDir, planRunId, "result.json"));
if (plan.artifact_type !== "question_target_label_batch_plan") {
  throw new Error(`${planRunId} is not a question target label batch plan.`);
}
if (plan.cost_estimate?.would_keep_total_under_100_usd !== true) {
  throw new Error(`${planRunId} does not pass the under-$100 planning guard.`);
}
if (plan.leakage_guard?.final_window_labels_used_for_training !== false) {
  throw new Error(`${planRunId} does not preserve the final-window leakage guard.`);
}

const totalBudgetBefore = await readJson(totalBudgetPath);
const allRequests = await readJsonl(path.join(runsDir, planRunId, "candidate_label_requests.jsonl"));
const requests = allRequests.slice(0, maxRequests);
if (!requests.length) throw new Error("No target-completeness label requests found.");
for (const request of requests) validateRequest(request);

const priorJudgments = await readJsonlIfPresent(path.join(outputDir, "judgments.jsonl"));
const completedIds = new Set(priorJudgments.filter((row) => !row.skipped).map((row) => row.request_id));
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

const judgments = [...priorJudgments];
const failures = await readJsonlIfPresent(path.join(outputDir, "failures.jsonl"));
if (dryRun || !process.env.OPENAI_API_KEY) {
  const reason = dryRun ? "dry-run requested" : "OPENAI_API_KEY missing";
  for (const request of pendingRequests) {
    const estimate = estimates.find((row) => row.request_id === request.request_id);
    judgments.push({
      request_id: request.request_id,
      root_example_id: request.metadata.root_example_id,
      skipped: true,
      skip_reason: reason,
      model,
      estimated_input_tokens: estimate.estimated_input_tokens,
      estimated_output_tokens: estimate.estimated_output_tokens,
      estimated_cost_usd: estimate.estimated_cost_usd,
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
        task: "grounded_qa_question_target_completeness_judgment",
        run_id: runId,
        plan_run_id: planRunId,
        request_id: request.request_id,
        example_id: request.request_id,
        root_example_id: request.metadata.root_example_id,
        source_index: request.metadata.source_index,
        train_split: request.metadata.train_split,
        duplicate_calibration: request.metadata.duplicate_calibration,
        prompt_tokens: usage.prompt_tokens ?? null,
        completion_tokens: usage.completion_tokens ?? null,
        total_tokens: usage.total_tokens ?? null,
        cost_usd: cost,
        price_source: price.source,
        price_checked_at: price.checked_at,
      });
      judgments.push({
        request_id: request.request_id,
        root_example_id: request.metadata.root_example_id,
        source_index: request.metadata.source_index,
        train_split: request.metadata.train_split,
        pair_id: request.metadata.pair_id,
        duplicate_calibration: request.metadata.duplicate_calibration,
        model,
        skipped: false,
        judgment,
        agreement_with_existing_preference: agreementWithExistingPreference(judgment),
        raw_content: rawContent,
        usage,
        cost_usd: cost,
      });
      await writeJsonl(path.join(outputDir, "judgments.jsonl"), judgments);
    } catch (error) {
      const failure = {
        ts: new Date().toISOString(),
        request_id: request.request_id,
        message: String(error.message ?? error),
      };
      failures.push(failure);
      await writeJsonl(path.join(outputDir, "failures.jsonl"), failures);
      await refreshBudgets();
      throw error;
    }
  }
}

const budgets = await refreshBudgets();
const finalJudgments = dedupeRowsByRequestId(judgments);
const metrics = summarizeJudgments(finalJudgments);
const runCost = round(sum(finalJudgments.map((row) => Number(row.cost_usd ?? 0))), 10);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "question_target_label_batch_run",
  plan_run_id: planRunId,
  purpose: "Execute the D308 targeted question-target completeness label batch with per-call OpenAI budget accounting.",
  model,
  dry_run: dryRun || !process.env.OPENAI_API_KEY,
  requests_planned: requests.length,
  calls_made: finalJudgments.filter((row) => !row.skipped).length,
  calls_skipped: finalJudgments.filter((row) => row.skipped).length,
  failures: failures.length,
  estimated_pending_cost_usd: estimatedPendingCost,
  run_cost_usd: runCost,
  metrics,
  leakage_guard: {
    final_window_labels_used_for_training: false,
    request_rows_source: plan.leakage_guard.request_rows_source,
    duplicate_calibration_rows_training_use: plan.leakage_guard.duplicate_calibration_rows_training_use,
    final_window_request_count: requests.filter((row) => Number(row.metadata.source_index) >= 321).length,
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
    openai_llm_calls: finalJudgments.filter((row) => !row.skipped).length,
    openai_cost_usd: runCost,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    ledger_task: "grounded_qa_question_target_completeness_judgment",
  },
  decision: decisionFromMetrics(metrics),
  artifacts: {
    requests_jsonl: rel(path.join(outputDir, "requests.jsonl")),
    estimated_calls_jsonl: rel(path.join(outputDir, "estimated_calls.jsonl")),
    judgments_jsonl: rel(path.join(outputDir, "judgments.jsonl")),
    failures_jsonl: rel(path.join(outputDir, "failures.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "requests.jsonl"), requests);
await writeJsonl(path.join(outputDir, "estimated_calls.jsonl"), estimates);
await writeJsonl(path.join(outputDir, "judgments.jsonl"), finalJudgments);
await writeJsonl(path.join(outputDir, "failures.jsonl"), failures);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  dry_run: result.dry_run,
  calls_made: result.calls_made,
  run_cost_usd: result.run_cost_usd,
  metrics: result.metrics,
  budget: result.budget,
  decision: result.decision,
}, null, 2));

function validateRequest(request) {
  if (request.task !== "question_target_completeness_judgment") throw new Error(`Unexpected task for ${request.request_id}.`);
  if (Number(request.metadata?.source_index) >= 321) throw new Error(`Refusing final-window request ${request.request_id}.`);
  if (!request.input?.question || !Array.isArray(request.input?.evidence_pack) || !request.input.evidence_pack.length) {
    throw new Error(`Malformed request input for ${request.request_id}.`);
  }
  if (!request.input?.candidate_chosen?.answer || !request.input?.candidate_rejected?.answer) {
    throw new Error(`Missing candidate answer for ${request.request_id}.`);
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
          "You are a strict citation-grounded QA target-completeness judge.",
          "Use only the supplied question, evidence pack, and candidates.",
          "Judge whether each candidate answers the exact question target at the required scope, entity/list, quantity, comparison, and condition.",
          "A candidate can be entailed by evidence yet still incomplete or wrong-target for the question.",
          "Return only valid JSON with keys: chosen_question_target_complete, rejected_question_target_complete, rejected_failure_mode, preferred_for_grounded_answer, rationale.",
          "rejected_failure_mode must be one of: complete_supported, entailed_but_incomplete, entailed_but_wrong_target, unsupported_claim, citation_mismatch, other.",
          "preferred_for_grounded_answer must be one of: chosen, rejected, tie, abstain.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
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
      const message = `OpenAI target-completeness request failed for ${requestId}: ${status} ${JSON.stringify(payload).slice(0, 500)}`;
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
    root_example_id: request.metadata.root_example_id,
    source_index: request.metadata.source_index,
    duplicate_calibration: request.metadata.duplicate_calibration,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: maxOutputTokens,
    estimated_cost_usd: round(callCost(estimatedInputTokens, maxOutputTokens, price), 8),
    price_source: price.source,
    price_checked_at: price.checked_at,
  };
}

function normalizeJudgment(value) {
  const failureModes = new Set(["complete_supported", "entailed_but_incomplete", "entailed_but_wrong_target", "unsupported_claim", "citation_mismatch", "other"]);
  const preferences = new Set(["chosen", "rejected", "tie", "abstain"]);
  const failureMode = String(value.rejected_failure_mode ?? "").trim();
  const preference = String(value.preferred_for_grounded_answer ?? "").trim();
  return {
    chosen_question_target_complete: Boolean(value.chosen_question_target_complete),
    rejected_question_target_complete: Boolean(value.rejected_question_target_complete),
    rejected_failure_mode: failureModes.has(failureMode) ? failureMode : "other",
    preferred_for_grounded_answer: preferences.has(preference) ? preference : "tie",
    rationale: String(value.rationale ?? ""),
  };
}

function agreementWithExistingPreference(judgment) {
  if (judgment.preferred_for_grounded_answer === "chosen") return "agrees_chosen_preferred";
  if (judgment.preferred_for_grounded_answer === "tie") return "partial_tie";
  if (judgment.preferred_for_grounded_answer === "abstain") return "disagrees_abstain";
  return "disagrees_rejected_preferred";
}

function summarizeJudgments(rows) {
  const judged = rows.filter((row) => !row.skipped);
  const primary = judged.filter((row) => row.duplicate_calibration !== true);
  const calibration = judged.filter((row) => row.duplicate_calibration === true);
  const byFailure = countBy(primary.map((row) => row.judgment?.rejected_failure_mode ?? "missing"));
  const byPreference = countBy(primary.map((row) => row.judgment?.preferred_for_grounded_answer ?? "missing"));
  const calibrationAgreement = summarizeCalibration(primary, calibration);
  return {
    requests_judged: judged.length,
    primary_judged: primary.length,
    calibration_judged: calibration.length,
    chosen_complete_primary: primary.filter((row) => row.judgment?.chosen_question_target_complete === true).length,
    rejected_complete_primary: primary.filter((row) => row.judgment?.rejected_question_target_complete === true).length,
    chosen_preferred_primary: primary.filter((row) => row.judgment?.preferred_for_grounded_answer === "chosen").length,
    rejected_preferred_primary: primary.filter((row) => row.judgment?.preferred_for_grounded_answer === "rejected").length,
    tie_primary: primary.filter((row) => row.judgment?.preferred_for_grounded_answer === "tie").length,
    abstain_preferred_primary: primary.filter((row) => row.judgment?.preferred_for_grounded_answer === "abstain").length,
    rejected_failure_mode_counts: byFailure,
    preferred_for_grounded_answer_counts: byPreference,
    existing_preference_agreement_rate: rate(byPreference.chosen ?? 0, primary.length),
    target_gap_rows: primary
      .filter((row) => row.judgment?.chosen_question_target_complete === true && row.judgment?.rejected_question_target_complete === false)
      .map((row) => row.request_id),
    calibration_agreement: calibrationAgreement,
  };
}

function summarizeCalibration(primary, calibration) {
  const primaryByPair = new Map(primary.map((row) => [row.pair_id, row]));
  const pairs = calibration.map((row) => {
    const original = primaryByPair.get(row.pair_id);
    return {
      calibration_request_id: row.request_id,
      original_request_id: original?.request_id ?? null,
      exact_match: Boolean(original) && sameJudgment(original.judgment, row.judgment),
      preference_match: Boolean(original) && original.judgment?.preferred_for_grounded_answer === row.judgment?.preferred_for_grounded_answer,
      failure_mode_match: Boolean(original) && original.judgment?.rejected_failure_mode === row.judgment?.rejected_failure_mode,
    };
  });
  return {
    pairs: pairs.length,
    exact_matches: pairs.filter((row) => row.exact_match).length,
    preference_matches: pairs.filter((row) => row.preference_match).length,
    failure_mode_matches: pairs.filter((row) => row.failure_mode_match).length,
    details: pairs,
  };
}

function sameJudgment(left, right) {
  return left?.chosen_question_target_complete === right?.chosen_question_target_complete
    && left?.rejected_question_target_complete === right?.rejected_question_target_complete
    && left?.rejected_failure_mode === right?.rejected_failure_mode
    && left?.preferred_for_grounded_answer === right?.preferred_for_grounded_answer;
}

function decisionFromMetrics(metrics) {
  if (metrics.requests_judged === 0) {
    return {
      integrate_labels_now: false,
      train_question_target_verifier_now: false,
      buy_more_openai_labels_now: false,
      launch_gpu_now: false,
      reason: "No paid target-completeness calls were made.",
      next_step: "Run the batch with OPENAI_API_KEY after confirming budget.",
    };
  }
  const targetGapRate = rate(metrics.target_gap_rows.length, metrics.primary_judged);
  const exactCalibrationRate = rate(metrics.calibration_agreement.exact_matches, metrics.calibration_agreement.pairs);
  if (targetGapRate >= 0.25 && exactCalibrationRate >= 0.75) {
    return {
      integrate_labels_now: true,
      train_question_target_verifier_now: true,
      buy_more_openai_labels_now: false,
      launch_gpu_now: false,
      reason: "The batch found a stable set of cases where the chosen answer is target-complete and the rejected answer is not.",
      next_step: "Build a small target-completeness verifier or selector from these labels before spending on GPU training.",
    };
  }
  return {
    integrate_labels_now: false,
    train_question_target_verifier_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    reason: "The target-completeness labels are either sparse or unstable under duplicate calibration.",
    next_step: "Audit disagreement and low-signal rows before buying more labels or launching GPU work.",
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
  return `# Question-Target Label Batch Run

Generated: ${result.generated_at}

This run executed the D308 target-completeness label batch with per-call OpenAI ledger rows. It did not use final-window labels and did not launch GPU compute.

| Requests | Calls | Cost | Target-gap primary rows | Calibration exact | Budget remaining |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.requests_planned} | ${result.calls_made} | $${result.run_cost_usd.toFixed(6)} | ${result.metrics.target_gap_rows.length}/${result.metrics.primary_judged} | ${result.metrics.calibration_agreement.exact_matches}/${result.metrics.calibration_agreement.pairs} | $${result.budget.remaining_budget_usd.toFixed(6)} |

## Primary Labels

- Chosen complete: ${result.metrics.chosen_complete_primary}/${result.metrics.primary_judged}
- Rejected complete: ${result.metrics.rejected_complete_primary}/${result.metrics.primary_judged}
- Chosen preferred: ${result.metrics.chosen_preferred_primary}/${result.metrics.primary_judged}
- Rejected preferred: ${result.metrics.rejected_preferred_primary}/${result.metrics.primary_judged}
- Failure modes: ${JSON.stringify(result.metrics.rejected_failure_mode_counts)}

## Decision

- Integrate labels now: ${result.decision.integrate_labels_now ? "yes" : "no"}
- Train question-target verifier now: ${result.decision.train_question_target_verifier_now ? "yes" : "no"}
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
    `answer_type: ${candidate.answer_type}`,
    `answer: ${candidate.answer || "(empty)"}`,
    `abstention_reason: ${candidate.abstention_reason ?? ""}`,
    `citations: ${JSON.stringify(candidate.citations ?? [])}`,
    `claim_table: ${JSON.stringify(candidate.claim_table ?? [])}`,
  ].join("\n");
}

function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return {
      chosen_question_target_complete: false,
      rejected_question_target_complete: false,
      rejected_failure_mode: "other",
      preferred_for_grounded_answer: "tie",
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
