import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const ledgerDir = path.join(experimentDir, "llm-calls");
const spendDir = path.join(experimentDir, "spend");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run"] ?? "targeted-boundary-adjudication-packet-qwen-frontier-pool-2026-06-28-v1";
const runId = args["run-id"] ?? "targeted-boundary-adjudication-run-gpt4o-qwen-frontier-pool-2026-06-28-v1";
const model = args.model ?? "gpt-4o";
const dryRun = args["dry-run"] === "true" || args.dryRun === "true";
const maxRequests = Number(args["max-requests"] ?? 12);
const maxRunCostUsd = Number(args["max-run-cost-usd"] ?? 0.50);
const maxTotalBudgetUsd = Number(args["max-total-budget-usd"] ?? 100);
const maxOutputTokens = Number(args["max-output-tokens"] ?? 650);
const outputDir = path.join(runsDir, runId);
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const llmBudgetPath = path.join(ledgerDir, "budget.json");
const totalBudgetPath = path.join(spendDir, "budget.json");
const externalLedgerPath = path.join(spendDir, "ledger.jsonl");
const prices = {
  "gpt-4o": {
    inputPerMillion: 2.50,
    outputPerMillion: 15.00,
    source: "https://openai.com/api/pricing/",
    checked_at: "2026-06-28",
  },
};
const price = prices[model];
if (!price) throw new Error(`Missing price entry for ${model}.`);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });
await fs.mkdir(ledgerDir, { recursive: true });

const packet = await readJson(path.join(runsDir, packetRunId, "result.json"));
if (packet.artifact_type !== "targeted_boundary_adjudication_packet") {
  throw new Error(`${packetRunId} is not a targeted boundary adjudication packet.`);
}
if (packet.decision?.paid_batch_prepared !== true || packet.leakage_guard?.candidate_requests_nonfinal_only !== true) {
  throw new Error(`${packetRunId} is not launch-ready under the leakage guard.`);
}

const totalBudgetBefore = await readJson(totalBudgetPath);
const requests = (await readJsonl(path.join(runsDir, packetRunId, "candidate_adjudication_requests.jsonl"))).slice(0, maxRequests);
if (!requests.length) throw new Error("No adjudication requests found.");
if (requests.length > maxRequests) throw new Error(`Request count ${requests.length} exceeds max_requests ${maxRequests}.`);
for (const request of requests) {
  if (request.final_window !== false || request.training_use !== "allowed_nonfinal_targeted_boundary_adjudication") {
    throw new Error(`Refusing request ${request.request_id}: not non-final targeted adjudication.`);
  }
  if (Number(request.source_index) >= 321) {
    throw new Error(`Refusing request ${request.request_id}: source_index ${request.source_index} appears final-window.`);
  }
}

const estimated = requests.map((request) => estimateRequest(request));
const estimatedCost = round(sum(estimated.map((row) => row.estimated_cost_usd)), 8);
if (estimatedCost > maxRunCostUsd) {
  throw new Error(`Refusing run: estimated $${estimatedCost} exceeds max run cost $${maxRunCostUsd}.`);
}
if (Number(totalBudgetBefore.spend_usd.total_actual) + estimatedCost > maxTotalBudgetUsd) {
  throw new Error(`Refusing run: total spend $${Number(totalBudgetBefore.spend_usd.total_actual).toFixed(6)} + estimated $${estimatedCost.toFixed(6)} exceeds $${maxTotalBudgetUsd}.`);
}

const adjudications = [];
if (dryRun || !process.env.OPENAI_API_KEY) {
  const reason = dryRun ? "dry-run requested" : "OPENAI_API_KEY missing";
  for (const row of estimated) {
    adjudications.push({
      request_id: row.request_id,
      root_example_id: row.root_example_id,
      source_index: row.source_index,
      skipped: true,
      skip_reason: reason,
      model,
      estimated_input_tokens: row.estimated_input_tokens,
      estimated_output_tokens: row.estimated_output_tokens,
      estimated_cost_usd: row.estimated_cost_usd,
    });
  }
} else {
  for (const request of requests) {
    const apiRequest = buildRequest(request);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(apiRequest),
    });
    const payload = await response.json();
    if (!response.ok) {
      await refreshBudgets();
      throw new Error(`OpenAI boundary adjudication failed for ${request.request_id}: ${response.status} ${JSON.stringify(payload).slice(0, 500)}`);
    }
    const usage = payload.usage ?? {};
    const cost = round(callCost(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0, price), 10);
    const rawContent = payload.choices?.[0]?.message?.content ?? "";
    const judgment = normalizeJudgment(parseJson(rawContent));
    await appendLedger(ledgerPath, {
      ts: new Date().toISOString(),
      provider: "openai",
      model,
      task: "grounded_qa_targeted_boundary_adjudication",
      run_id: runId,
      packet_run_id: packetRunId,
      split: request.split,
      example_id: request.request_id,
      root_example_id: request.root_example_id,
      prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
      total_tokens: usage.total_tokens ?? null,
      cost_usd: cost,
      price_source: price.source,
      price_checked_at: price.checked_at,
    });
    adjudications.push({
      request_id: request.request_id,
      root_example_id: request.root_example_id,
      source_index: request.source_index,
      split: request.split,
      model,
      skipped: false,
      candidate_a_id: request.candidate_a.candidate_id,
      candidate_b_id: request.candidate_b.candidate_id,
      judgment,
      agreement_with_existing_signal: agreementWithExistingSignal(judgment),
      raw_content: rawContent,
      usage,
      cost_usd: cost,
      tags: request.tags,
      selection_reason: request.selection_reason,
    });
  }
}

const budgets = await refreshBudgets();
const metrics = summarizeAdjudications(adjudications);
const runCost = round(sum(adjudications.map((row) => Number(row.cost_usd ?? 0))), 10);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "targeted_boundary_adjudication_run",
  packet_run_id: packetRunId,
  purpose: "Execute only the capped D269 non-final boundary adjudication requests with call-level OpenAI ledger rows.",
  model,
  dry_run: dryRun || !process.env.OPENAI_API_KEY,
  requests_planned: requests.length,
  calls_made: adjudications.filter((row) => !row.skipped).length,
  calls_skipped: adjudications.filter((row) => row.skipped).length,
  estimated_cost_usd: estimatedCost,
  run_cost_usd: runCost,
  metrics,
  leakage_guard: {
    final_window_labels_used_for_training: false,
    packet_final_boundary_cases_training_use: packet.leakage_guard?.final_boundary_cases_training_use,
    candidate_adjudication_training_use: "allowed_nonfinal_targeted_boundary_adjudication",
    candidate_requests_nonfinal_only: requests.every((row) => row.final_window === false && Number(row.source_index) < 321),
    prompt_excludes_existing_local_judge_posthoc_fields: true,
  },
  budget: {
    max_budget_usd: maxTotalBudgetUsd,
    total_actual_before_run_usd: totalBudgetBefore.spend_usd.total_actual,
    estimated_total_after_run_usd: round(Number(totalBudgetBefore.spend_usd.total_actual) + estimatedCost, 8),
    actual_total_after_run_usd: budgets.totalBudget.spend_usd.total_actual,
    remaining_budget_usd: budgets.totalBudget.spend_usd.remaining,
    openai_ledger_spend_after_usd: budgets.llmBudget.ledger_spend_usd,
    external_compute_spend_after_usd: budgets.totalBudget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: adjudications.filter((row) => !row.skipped).length,
    openai_cost_usd: runCost,
    external_compute_cost_usd: 0,
    ledger_task: "grounded_qa_targeted_boundary_adjudication",
  },
  decision: decisionFromMetrics(metrics),
  artifacts: {
    requests_jsonl: rel(path.join(outputDir, "requests.jsonl")),
    estimated_calls_jsonl: rel(path.join(outputDir, "estimated_calls.jsonl")),
    adjudications_jsonl: rel(path.join(outputDir, "adjudications.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "requests.jsonl"), requests);
await writeJsonl(path.join(outputDir, "estimated_calls.jsonl"), estimated);
await writeJsonl(path.join(outputDir, "adjudications.jsonl"), adjudications);
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
          "You are a strict citation-grounded QA adjudicator.",
          "Use only the supplied question, evidence pack, and two candidates.",
          "Judge each candidate independently.",
          "A candidate is unsupported if its answer or claim table adds any predicate, number, list member, entity, comparison, or scope not directly entailed by cited evidence.",
          "Return only valid JSON with keys: supported_candidate, candidate_a_errors, candidate_b_errors, minimal_supported_answer, required_citations, rationale.",
          "supported_candidate must be one of: A, B, both, neither.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Question: ${request.input.question}`,
          "",
          "Evidence pack:",
          request.input.compact_retrieved_evidence_pack.map(formatEvidence).join("\n\n"),
          "",
          "Candidate A:",
          formatPromptCandidate(request.candidate_a),
          "",
          "Candidate B:",
          formatPromptCandidate(request.candidate_b),
          "",
          "Return JSON only. Prefer concise fully supported answers over overexpanded answers. Do not use outside knowledge.",
        ].join("\n"),
      },
    ],
  };
}

function formatPromptCandidate(candidate) {
  return [
    `candidate_id: ${candidate.candidate_id}`,
    `answer_type: ${candidate.answer_type}`,
    `answer: ${candidate.answer || "(empty)"}`,
    `citations: ${JSON.stringify(candidate.citations ?? [])}`,
    `claim_table: ${JSON.stringify(candidate.claim_table ?? [])}`,
  ].join("\n");
}

function formatEvidence(evidence) {
  return `[${evidence.evidence_id}] ${evidence.section ?? "Evidence"}: ${evidence.text}`;
}

function estimateRequest(request) {
  const apiRequest = buildRequest(request);
  const estimatedInputTokens = Math.ceil(JSON.stringify(apiRequest.messages).length / 4);
  return {
    request_id: request.request_id,
    root_example_id: request.root_example_id,
    source_index: request.source_index,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: maxOutputTokens,
    estimated_cost_usd: round(callCost(estimatedInputTokens, maxOutputTokens, price), 8),
    price_source: price.source,
    price_checked_at: price.checked_at,
  };
}

function normalizeJudgment(value) {
  const supported = normalizeSupportedCandidate(value.supported_candidate);
  return {
    supported_candidate: supported,
    candidate_a_errors: normalizeStringArray(value.candidate_a_errors),
    candidate_b_errors: normalizeStringArray(value.candidate_b_errors),
    minimal_supported_answer: String(value.minimal_supported_answer ?? ""),
    required_citations: normalizeStringArray(value.required_citations),
    rationale: String(value.rationale ?? ""),
  };
}

function normalizeSupportedCandidate(value) {
  const normalized = String(value ?? "").toLowerCase().trim();
  if (["a", "candidate_a", "candidate a"].includes(normalized)) return "A";
  if (["b", "candidate_b", "candidate b"].includes(normalized)) return "B";
  if (["both", "a_and_b", "a and b"].includes(normalized)) return "both";
  return "neither";
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  return [String(value)];
}

function agreementWithExistingSignal(judgment) {
  if (judgment.supported_candidate === "A") return "agrees_a_supported_b_unsupported";
  if (judgment.supported_candidate === "both") return "partial_disagreement_b_also_supported";
  if (judgment.supported_candidate === "B") return "disagrees_b_supported";
  return "disagrees_neither_supported";
}

function summarizeAdjudications(rows) {
  const judged = rows.filter((row) => !row.skipped);
  const counts = countBy(judged.map((row) => row.judgment?.supported_candidate ?? "missing"));
  const agreements = countBy(judged.map((row) => row.agreement_with_existing_signal ?? "missing"));
  return {
    requests_judged: judged.length,
    supported_candidate_counts: counts,
    agreement_counts: agreements,
    existing_signal_exact_agreement: agreements.agrees_a_supported_b_unsupported ?? 0,
    existing_signal_exact_agreement_rate: rate(agreements.agrees_a_supported_b_unsupported ?? 0, judged.length),
    disagreement_requests: judged
      .filter((row) => row.agreement_with_existing_signal !== "agrees_a_supported_b_unsupported")
      .map((row) => row.request_id),
  };
}

function decisionFromMetrics(metrics) {
  const exactRate = Number(metrics.existing_signal_exact_agreement_rate ?? 0);
  if (metrics.requests_judged === 0) {
    return {
      integrate_labels_now: false,
      buy_more_openai_labels_now: false,
      launch_gpu_now: false,
      reason: "No paid adjudication calls were made.",
      next_step: "Run the packet with OPENAI_API_KEY after confirming budget.",
    };
  }
  if (exactRate >= 0.75) {
    return {
      integrate_labels_now: true,
      buy_more_openai_labels_now: false,
      launch_gpu_now: false,
      reason: "The targeted boundary adjudicator mostly agrees that the intended minimal-span candidate is supported and the overexpanded candidate is not.",
      next_step: "Train or calibrate a selector using these non-final boundary labels, then re-evaluate final diagnostic selection without tuning on final labels.",
    };
  }
  return {
    integrate_labels_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    reason: "The targeted boundary labels expose too much disagreement with the existing weak signal for immediate selector integration.",
    next_step: "Audit disagreement rows before buying more labels or launching more GPU work.",
  };
}

function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return {
      supported_candidate: "neither",
      candidate_a_errors: [],
      candidate_b_errors: [],
      minimal_supported_answer: "",
      required_citations: [],
      rationale: String(content).slice(0, 500),
    };
  }
}

async function refreshBudgets() {
  const llmRows = await readJsonl(ledgerPath);
  const externalRows = await readJsonl(externalLedgerPath);
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
  return `# Targeted Boundary Adjudication Run

Generated: ${result.generated_at}

This run executed only the capped D269 packet requests. It did not use final-window labels for training and did not include existing local judge post-hoc fields in the OpenAI prompt.

| Requests | Calls | Cost | Exact existing-signal agreement | Budget remaining |
| ---: | ---: | ---: | ---: | ---: |
| ${result.requests_planned} | ${result.calls_made} | $${result.run_cost_usd.toFixed(6)} | ${result.metrics.existing_signal_exact_agreement}/${result.metrics.requests_judged} (${pct(result.metrics.existing_signal_exact_agreement_rate)}) | $${result.budget.remaining_budget_usd.toFixed(6)} |

## Decision

- Integrate labels now: ${result.decision.integrate_labels_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function callCost(inputTokens, outputTokens, modelPrice) {
  return (Number(inputTokens) / 1_000_000) * modelPrice.inputPerMillion + (Number(outputTokens) / 1_000_000) * modelPrice.outputPerMillion;
}

async function appendLedger(file, row) {
  await fs.appendFile(file, `${JSON.stringify(row)}\n`);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
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

function rel(file) {
  return path.relative(rootDir, file);
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value || 0)).toFixed(1)}%`;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function round(value, digits = 6) {
  if (!Number.isFinite(Number(value))) return 0;
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}
