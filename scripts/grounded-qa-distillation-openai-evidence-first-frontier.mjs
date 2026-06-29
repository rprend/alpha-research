import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const ledgerDir = path.join(experimentDir, "llm-calls");
const spendDir = path.join(experimentDir, "spend");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "evidence-first-targeted-contract-packet-2026-06-29-v1";
const runId = args["run-id"] ?? `openai-evidence-first-frontier-${packetRunId}`;
const model = args.model ?? "gpt-5.4";
const limit = numberArg(args.limit, 10);
const offset = nonNegativeNumberArg(args.offset, 0);
const dryRun = args["dry-run"] === "true" || args.dryRun === "true";
const maxBudgetUsd = Number(args["max-budget-usd"] ?? 100);
const maxOutputTokens = numberArg(args["max-output-tokens"], 700);
const outputDir = path.join(runsDir, runId);
const packetDir = path.join(runsDir, packetRunId, "dataset");
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const llmBudgetPath = path.join(ledgerDir, "budget.json");
const totalBudgetPath = path.join(spendDir, "budget.json");

const prices = {
  "gpt-5.4": {
    inputPerMillion: 2.50,
    outputPerMillion: 15.00,
    source: "https://platform.openai.com/docs/pricing",
    price_checked_at: "2026-06-29",
  },
  "gpt-5.4-mini": {
    inputPerMillion: 0.75,
    outputPerMillion: 4.50,
    source: "https://platform.openai.com/docs/pricing",
    price_checked_at: "2026-06-29",
  },
  "gpt-4o": {
    inputPerMillion: 2.50,
    outputPerMillion: 10.00,
    source: "https://platform.openai.com/docs/pricing",
    price_checked_at: "2026-06-29",
  },
  "gpt-4o-mini": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.60,
    source: "https://platform.openai.com/docs/pricing",
    price_checked_at: "2026-06-29",
  },
};
const price = prices[model];
if (!price) throw new Error(`Missing price table entry for model ${model}.`);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(ledgerDir, { recursive: true });
await fs.mkdir(spendDir, { recursive: true });

const prompts = (await readJsonl(path.join(packetDir, "eval_prompts.jsonl"))).slice(offset, offset + limit);
const targets = await readJsonl(path.join(packetDir, "eval_targets_diagnostic.jsonl"));
const targetById = new Map(targets.map((row) => [row.example_id, row]));
const llmSpendBefore = await ledgerSpend(ledgerPath);
const externalSpend = await externalLedgerSpend(path.join(spendDir, "ledger.jsonl"));
const estimates = prompts.map((prompt) => estimateCall(prompt));
const estimatedCost = round(sum(estimates.map((row) => row.estimated_cost_usd)), 10);
if (llmSpendBefore + externalSpend + estimatedCost > maxBudgetUsd) {
  throw new Error(`Refusing run: current total $${(llmSpendBefore + externalSpend).toFixed(4)} + estimated $${estimatedCost.toFixed(4)} exceeds max budget $${maxBudgetUsd.toFixed(2)}.`);
}

const predictions = [];
const traces = [];
if (dryRun || !process.env.OPENAI_API_KEY) {
  const reason = dryRun ? "dry-run requested" : "OPENAI_API_KEY missing";
  for (const estimate of estimates) {
    predictions.push({
      example_id: estimate.example_id,
      model,
      skipped: true,
      skip_reason: reason,
      estimated_input_tokens: estimate.estimated_input_tokens,
      estimated_output_tokens: estimate.estimated_output_tokens,
      estimated_cost_usd: estimate.estimated_cost_usd,
    });
    traces.push({ ...estimate, skipped: true, skip_reason: reason });
  }
} else {
  for (const prompt of prompts) {
    const request = buildRequest(prompt);
    const payload = await callOpenAi(request, prompt.example_id);
    const usage = payload.usage ?? {};
    const rawOutput = payload.choices?.[0]?.message?.content ?? "";
    const prediction = normalizePrediction(parseJson(rawOutput));
    const cost = round(callCost(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0, price), 10);
    await appendLedger(ledgerPath, {
      ts: new Date().toISOString(),
      provider: "openai",
      model,
      task: "grounded_qa_evidence_first_frontier_teacher",
      run_id: runId,
      packet_run_id: packetRunId,
      example_id: prompt.example_id,
      prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
      total_tokens: usage.total_tokens ?? null,
      cost_usd: cost,
      price_source: price.source,
      price_checked_at: price.price_checked_at,
    });
    predictions.push({
      example_id: prompt.example_id,
      model,
      prediction,
      raw_output: rawOutput,
      usage,
      cost_usd: cost,
      reference_target_answer_type: targetById.get(prompt.example_id)?.target?.answer_type ?? null,
    });
    traces.push({
      example_id: prompt.example_id,
      model,
      raw_output: rawOutput,
      usage,
      cost_usd: cost,
      parseable: Boolean(prediction),
    });
  }
}

const llmSpendAfter = await ledgerSpend(ledgerPath);
const totalSpend = round(llmSpendAfter + externalSpend, 12);
const runCost = round(sum(predictions.map((row) => Number(row.cost_usd ?? 0))), 10);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "openai_evidence_first_frontier_teacher",
  status: dryRun || !process.env.OPENAI_API_KEY ? "dry_run_no_calls" : "predictions_ready_for_evidence_first_contract_gate",
  packet_run_id: packetRunId,
  model,
  examples_offset: offset,
  examples_requested: prompts.length,
  dry_run: dryRun || !process.env.OPENAI_API_KEY,
  calls_made: predictions.filter((row) => !row.skipped).length,
  calls_skipped: predictions.filter((row) => row.skipped).length,
  estimated_cost_usd: estimatedCost,
  run_cost_usd: runCost,
  budget: {
    max_budget_usd: maxBudgetUsd,
    openai_spend_before_usd: llmSpendBefore,
    openai_spend_after_usd: llmSpendAfter,
    external_compute_spend_usd: externalSpend,
    total_actual_spend_usd: totalSpend,
    remaining_total_budget_usd: round(maxBudgetUsd - totalSpend, 12),
  },
  price,
  metrics: summarizePredictions(predictions),
  decision: {
    run_contract_gate_next: !dryRun && Boolean(process.env.OPENAI_API_KEY),
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    reason: "This run creates frontier teacher predictions for deterministic evidence-first contract scoring; paid judging is gated on contract pass.",
  },
  artifacts: {
    predictions_jsonl: rel(path.join(outputDir, "predictions.jsonl")),
    traces_jsonl: rel(path.join(outputDir, "traces.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), predictions);
await writeJsonl(path.join(outputDir, "traces.jsonl"), traces);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await writeBudgets({ llmSpendAfter, externalSpend, maxBudgetUsd });

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  model: result.model,
  calls_made: result.calls_made,
  estimated_cost_usd: result.estimated_cost_usd,
  run_cost_usd: result.run_cost_usd,
  total_actual_spend_usd: result.budget.total_actual_spend_usd,
  remaining_total_budget_usd: result.budget.remaining_total_budget_usd,
  next: result.decision.run_contract_gate_next ? "run evidence-first contract preflight on predictions.jsonl" : "provide OPENAI_API_KEY or rerun without dry-run",
}, null, 2));

function buildRequest(prompt) {
  return {
    model,
    temperature: 0,
    [model.startsWith("gpt-5") ? "max_completion_tokens" : "max_tokens"]: maxOutputTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are a frontier evidence-planning teacher for citation-grounded QA over an evolving private knowledge base.",
          "Use only the compact evidence pack in the user message.",
          "Do not use the paper abstract unless it appears inside the evidence pack.",
          "Return only valid JSON with exactly these keys: answer_type, evidence_first, answer, citations, claim_table, abstention_reason.",
          "evidence_first must contain sufficiency, supported_claims, missing_support, and question_target.",
          "For grounded_answer, supported_claims must be objects with claim_id, claim, citations, and support_status.",
          "The top-level citations array must exactly equal the union of supported_claims citations.",
          "Every top-level citation id must appear inline in the answer as [E1]-style brackets.",
          "For abstain, set sufficiency to insufficient, supported_claims and citations to [], and name the exact missing support.",
          "Prefer abstention over using a nearby but wrong-target fact.",
        ].join(" "),
      },
      ...prompt.messages.filter((message) => message.role !== "system"),
    ],
  };
}

async function callOpenAi(request, exampleId) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI request failed for ${exampleId}: ${response.status} ${JSON.stringify(payload).slice(0, 500)}`);
  }
  return payload;
}

function normalizePrediction(value) {
  if (!value || typeof value !== "object") return null;
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const evidenceFirst = value.evidence_first && typeof value.evidence_first === "object" ? value.evidence_first : {};
  return {
    answer_type: answerType,
    evidence_first: {
      sufficiency: evidenceFirst.sufficiency === "insufficient" ? "insufficient" : "sufficient",
      supported_claims: Array.isArray(evidenceFirst.supported_claims) ? evidenceFirst.supported_claims : [],
      missing_support: String(evidenceFirst.missing_support ?? ""),
      question_target: String(evidenceFirst.question_target ?? "exact_question_target"),
    },
    answer: String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : normalizeCitations(value.citations ?? []),
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? evidenceFirst.missing_support ?? "") : null,
  };
}

function summarizePredictions(rows) {
  const completed = rows.filter((row) => !row.skipped);
  return {
    examples: rows.length,
    completed_examples: completed.length,
    parseable_rate: rate(completed.filter((row) => row.prediction).length, completed.length),
    answer_rate: rate(completed.filter((row) => row.prediction?.answer_type === "grounded_answer").length, completed.length),
    abstention_rate: rate(completed.filter((row) => row.prediction?.answer_type === "abstain").length, completed.length),
  };
}

function estimateCall(prompt) {
  const request = buildRequest(prompt);
  const estimatedInputTokens = Math.ceil(JSON.stringify(request.messages).length / 4);
  return {
    example_id: prompt.example_id,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: maxOutputTokens,
    estimated_cost_usd: round(callCost(estimatedInputTokens, maxOutputTokens, price), 10),
  };
}

async function writeBudgets({ llmSpendAfter, externalSpend, maxBudgetUsd }) {
  await fs.writeFile(llmBudgetPath, `${JSON.stringify({
    max_budget_usd: maxBudgetUsd,
    ledger_spend_usd: llmSpendAfter,
    remaining_budget_usd: round(Math.max(0, maxBudgetUsd - llmSpendAfter), 12),
    ledger_path: rel(ledgerPath),
    last_updated: new Date().toISOString(),
  }, null, 2)}\n`);
  await fs.writeFile(totalBudgetPath, `${JSON.stringify({
    generated_at: new Date().toISOString(),
    max_budget_usd: maxBudgetUsd,
    spend_usd: {
      openai: llmSpendAfter,
      external_compute: externalSpend,
      total_actual: round(llmSpendAfter + externalSpend, 12),
      remaining: round(maxBudgetUsd - llmSpendAfter - externalSpend, 12),
    },
    ledgers: {
      openai_ledger: rel(ledgerPath),
      external_compute_ledger: rel(path.join(spendDir, "ledger.jsonl")),
    },
    policy: {
      note: "The $100 cap covers OpenAI API calls plus Prime Intellect/Hugging Face/other GPU spend. Planned GPU jobs must record estimated cost before launch and actual cost after completion.",
      launch_guardrail: "Do not launch a compute job when estimated total spend would exceed max_budget_usd.",
    },
  }, null, 2)}\n`);
}

function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function normalizeCitations(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((citation) => typeof citation === "string" ? citation : citation?.evidence_id ?? citation?.id)
    .map((citation) => String(citation ?? "").trim())
    .filter(Boolean);
}

async function ledgerSpend(file) {
  try {
    const rows = await readJsonl(file);
    return round(sum(rows.map((row) => Number(row.cost_usd ?? 0))), 12);
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

async function externalLedgerSpend(file) {
  try {
    const rows = await readJsonl(file);
    return round(sum(rows.map((row) => Number(row.cost_usd ?? 0))), 12);
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

async function appendLedger(file, row) {
  await fs.appendFile(file, `${JSON.stringify(row)}\n`);
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function callCost(inputTokens, outputTokens, modelPrice) {
  return (inputTokens / 1_000_000) * modelPrice.inputPerMillion
    + (outputTokens / 1_000_000) * modelPrice.outputPerMillion;
}

function renderReport(result) {
  return `# OpenAI Evidence-First Frontier Teacher

Generated: ${result.generated_at}

Status: \`${result.status}\`

Model: \`${result.model}\`

Packet: \`${result.packet_run_id}\`

## Budget

- Calls made: ${result.calls_made}
- Estimated cost: $${result.estimated_cost_usd.toFixed(6)}
- Run cost: $${result.run_cost_usd.toFixed(6)}
- Total tracked spend: $${result.budget.total_actual_spend_usd.toFixed(6)} / $${result.budget.max_budget_usd}
- Remaining total budget: $${result.budget.remaining_total_budget_usd.toFixed(6)}

## Metrics

- Examples: ${result.metrics.examples}
- Completed: ${result.metrics.completed_examples}
- Parseable: ${pct(result.metrics.parseable_rate)}
- Answer rate: ${pct(result.metrics.answer_rate)}
- Abstention rate: ${pct(result.metrics.abstention_rate)}

## Decision

- Run contract gate next: ${result.decision.run_contract_gate_next ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function round(value, places = 10) {
  const factor = 10 ** places;
  return Math.round(Number(value || 0) * factor) / factor;
}

function rel(file) {
  return path.relative(rootDir, file);
}

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function nonNegativeNumberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [key, raw] = value.slice(2).split("=");
    parsed[key] = raw ?? "true";
  }
  return parsed;
}
