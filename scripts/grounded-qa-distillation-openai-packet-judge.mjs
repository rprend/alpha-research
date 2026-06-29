import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const ledgerDir = path.join(experimentDir, "llm-calls");
const spendDir = path.join(experimentDir, "spend");
const args = parseArgs(process.argv.slice(2));

const predictionRun = args["prediction-run"];
if (!predictionRun) throw new Error("Missing --prediction-run=<run-id>.");
const packetRunId = args["packet-run-id"];
if (!packetRunId) throw new Error("Missing --packet-run-id=<run-id>.");

const model = args.model ?? "gpt-4o-mini";
const offset = nonNegativeNumberArg(args.offset, 0);
const limit = numberArg(args.limit, Number.POSITIVE_INFINITY);
const dryRun = args["dry-run"] === "true" || args.dryRun === "true";
const maxBudgetUsd = Number(args["max-budget-usd"] ?? 100);
const maxOutputTokens = numberArg(args["max-output-tokens"], 520);
const runId = args["run-id"] ?? `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "Z")}-openai-packet-judge-${predictionRun}`;
const outputDir = path.join(runsDir, runId);
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const llmBudgetPath = path.join(ledgerDir, "budget.json");
const totalBudgetPath = path.join(spendDir, "budget.json");
const prices = {
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.60, source: "https://platform.openai.com/docs/pricing", price_checked_at: "2026-06-29" },
  "gpt-4o": { inputPerMillion: 2.50, outputPerMillion: 10.00, source: "https://platform.openai.com/docs/pricing", price_checked_at: "2026-06-29" },
};
const price = prices[model];
if (!price) throw new Error(`Missing price table entry for packet judge model ${model}.`);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(ledgerDir, { recursive: true });
await fs.mkdir(spendDir, { recursive: true });

const packetPrompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const promptById = new Map(packetPrompts.map((row) => [row.example_id, row]));
const predictions = (await readJsonl(path.join(runsDir, predictionRun, "predictions.jsonl")))
  .filter((row) => !row.skipped)
  .filter((row) => promptById.has(row.example_id))
  .slice(offset, offset + limit);

const llmSpendBefore = await ledgerSpend(ledgerPath);
const externalSpend = await externalLedgerSpend(path.join(spendDir, "ledger.jsonl"));
const estimated = predictions.map((prediction) => estimateCall(prediction, promptById.get(prediction.example_id)));
const estimatedCost = round(sum(estimated.map((row) => row.estimated_cost_usd)), 10);
if (llmSpendBefore + externalSpend + estimatedCost > maxBudgetUsd) {
  throw new Error(`Refusing run: current total $${(llmSpendBefore + externalSpend).toFixed(4)} + estimated $${estimatedCost.toFixed(4)} exceeds max budget $${maxBudgetUsd.toFixed(2)}.`);
}

const judgments = [];
if (dryRun || !process.env.OPENAI_API_KEY) {
  const reason = dryRun ? "dry-run requested" : "OPENAI_API_KEY missing";
  for (const estimate of estimated) {
    judgments.push({
      example_id: estimate.example_id,
      prediction_run: predictionRun,
      packet_run_id: packetRunId,
      model,
      skipped: true,
      skip_reason: reason,
      estimated_input_tokens: estimate.estimated_input_tokens,
      estimated_output_tokens: estimate.estimated_output_tokens,
      estimated_cost_usd: estimate.estimated_cost_usd,
    });
  }
} else {
  for (const prediction of predictions) {
    const prompt = promptById.get(prediction.example_id);
    const request = buildRequest(prediction, prompt);
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
      throw new Error(`OpenAI packet judge request failed for ${prediction.example_id}: ${response.status} ${JSON.stringify(payload).slice(0, 500)}`);
    }
    const judgment = normalizeJudgment(parseJson(payload.choices?.[0]?.message?.content ?? ""));
    const usage = payload.usage ?? {};
    const cost = round(callCost(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0, price), 10);
    await appendLedger(ledgerPath, {
      ts: new Date().toISOString(),
      provider: "openai",
      model,
      task: "grounded_qa_packet_entailment_judge",
      run_id: runId,
      prediction_run: predictionRun,
      packet_run_id: packetRunId,
      example_id: prediction.example_id,
      prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
      total_tokens: usage.total_tokens ?? null,
      cost_usd: cost,
      price_source: price.source,
      price_checked_at: price.price_checked_at,
    });
    judgments.push({
      example_id: prediction.example_id,
      root_example_id: prompt.root_example_id ?? null,
      source_split: prompt.source_split ?? null,
      target_answer_type: prompt.target_answer_type ?? null,
      prediction_run: predictionRun,
      packet_run_id: packetRunId,
      model,
      prediction_answer_type: normalizePrediction(prediction.prediction ?? {}).answer_type,
      judgment,
      raw_content: payload.choices?.[0]?.message?.content ?? "",
      usage,
      cost_usd: cost,
    });
  }
}

const llmSpendAfter = await ledgerSpend(ledgerPath);
const totalSpend = round(llmSpendAfter + externalSpend, 12);
const summary = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "openai_packet_judge",
  status: dryRun || !process.env.OPENAI_API_KEY ? "dry_run_no_calls" : "packet_judgments_ready",
  packet_run_id: packetRunId,
  prediction_run: predictionRun,
  model,
  examples_offset: offset,
  examples_requested: predictions.length,
  dry_run: dryRun || !process.env.OPENAI_API_KEY,
  calls_made: judgments.filter((row) => !row.skipped).length,
  calls_skipped: judgments.filter((row) => row.skipped).length,
  run_cost_usd: round(sum(judgments.map((row) => Number(row.cost_usd ?? 0))), 10),
  estimated_cost_usd: estimatedCost,
  budget: {
    max_budget_usd: maxBudgetUsd,
    openai_spend_before_usd: llmSpendBefore,
    openai_spend_after_usd: llmSpendAfter,
    external_compute_spend_usd: externalSpend,
    total_actual_spend_usd: totalSpend,
    remaining_total_budget_usd: round(maxBudgetUsd - totalSpend, 12),
  },
  price,
  metrics: evaluateJudgments(judgments),
  decision: {
    run_drift_audit_next: !dryRun && Boolean(process.env.OPENAI_API_KEY),
    launch_prime_now: false,
    reason: "Packet-local judging uses each sampled evidence pack directly, so mixed train/validation drift samples are not dropped by split lookup.",
  },
  artifacts: {
    judgments_jsonl: rel(path.join(outputDir, "judgments.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "judgments.jsonl"), judgments);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(summary));
await writeBudgets({ llmSpendAfter, externalSpend, maxBudgetUsd });

console.log(JSON.stringify({
  result: rel(path.join(outputDir, "result.json")),
  judgments: rel(path.join(outputDir, "judgments.jsonl")),
  summary,
}, null, 2));

function buildRequest(predictionRow, prompt) {
  const prediction = normalizePrediction(predictionRow.prediction ?? {});
  const citedIds = new Set(prediction.citations);
  const evidencePack = prompt.input.compact_retrieved_evidence_pack ?? [];
  const citedEvidence = evidencePack.filter((evidence) => citedIds.has(evidence.evidence_id));
  const evidenceForAbstention = prediction.answer_type === "abstain" ? evidencePack : citedEvidence;
  const evidenceText = evidenceForAbstention.length
    ? evidenceForAbstention.map(formatEvidence).join("\n\n")
    : "No cited evidence ids were provided.";

  return {
    model,
    temperature: 0,
    max_tokens: maxOutputTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are an entailment-style citation judge for grounded QA.",
          "Use only the supplied question, prediction, and evidence.",
          "Do not use outside knowledge.",
          "For answered predictions, decide whether every factual claim in the answer is directly supported by the cited evidence ids.",
          "For abstentions, decide whether the full evidence pack is insufficient to answer the question.",
          "Return only valid JSON with keys: verdict, all_claims_supported, citation_ids_valid, abstention_supported, unsupported_claims, missing_citations, notes.",
          "verdict must be exactly supported, partial, unsupported, correct_abstention, incorrect_abstention, or invalid.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Question: ${prompt.input.question}`,
          `Prediction answer_type: ${prediction.answer_type}`,
          `Prediction answer: ${prediction.answer || "(empty)"}`,
          `Prediction citations: ${JSON.stringify(prediction.citations)}`,
          `Prediction claim_table: ${JSON.stringify(prediction.claim_table ?? [])}`,
          "",
          "Evidence to judge against:",
          evidenceText,
          "",
          "Judge strictly. A citation is valid only if its id appears in the supplied evidence. A claim is supported only if the cited text directly entails it.",
        ].join("\n"),
      },
    ],
  };
}

function formatEvidence(evidence) {
  return `[${evidence.evidence_id}] ${evidence.section ?? "Evidence"}: ${evidence.text}`;
}

function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return {
      verdict: "invalid",
      all_claims_supported: false,
      citation_ids_valid: false,
      abstention_supported: false,
      unsupported_claims: ["judge response was not valid JSON"],
      missing_citations: [],
      notes: String(content).slice(0, 500),
    };
  }
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : citations,
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? "") : null,
  };
}

function normalizeJudgment(value) {
  const verdicts = new Set(["supported", "partial", "unsupported", "correct_abstention", "incorrect_abstention", "invalid"]);
  const rawVerdict = String(value.verdict ?? "");
  const verdictAliases = {
    exactly_supported: "supported",
    fully_supported: "supported",
  };
  const normalizedVerdict = verdictAliases[rawVerdict] ?? rawVerdict;
  const verdict = verdicts.has(normalizedVerdict) ? normalizedVerdict : "invalid";
  return {
    verdict,
    all_claims_supported: Boolean(value.all_claims_supported),
    citation_ids_valid: Boolean(value.citation_ids_valid),
    abstention_supported: Boolean(value.abstention_supported),
    unsupported_claims: Array.isArray(value.unsupported_claims) ? value.unsupported_claims.map(String) : [],
    missing_citations: Array.isArray(value.missing_citations) ? value.missing_citations.map(String) : [],
    notes: String(value.notes ?? ""),
  };
}

function evaluateJudgments(rows) {
  const scored = rows.filter((row) => !row.skipped);
  const answered = scored.filter((row) => row.prediction_answer_type === "grounded_answer");
  const abstained = scored.filter((row) => row.prediction_answer_type === "abstain");
  const answerSupported = answered.filter((row) => row.judgment.verdict === "supported" && row.judgment.all_claims_supported && row.judgment.citation_ids_valid);
  const abstentionSupported = abstained.filter((row) => row.judgment.verdict === "correct_abstention" && row.judgment.abstention_supported);
  const judgedCorrect = answerSupported.length + abstentionSupported.length;
  return {
    examples_judged: scored.length,
    answered_predictions: answered.length,
    abstained_predictions: abstained.length,
    answer_support_rate: rate(answerSupported.length, answered.length),
    abstention_support_rate: rate(abstentionSupported.length, abstained.length),
    overall_judged_correct_rate: rate(judgedCorrect, scored.length),
    invalid_judgment_rate: rate(scored.filter((row) => row.judgment.verdict === "invalid").length, scored.length),
  };
}

function estimateCall(prediction, prompt) {
  const request = buildRequest(prediction, prompt);
  const estimatedInputTokens = Math.ceil(JSON.stringify(request.messages).length / 4);
  const estimatedOutputTokens = maxOutputTokens;
  return {
    example_id: prediction.example_id,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: estimatedOutputTokens,
    estimated_cost_usd: round(callCost(estimatedInputTokens, estimatedOutputTokens, price), 10),
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

function renderReport(result) {
  return `# OpenAI Packet Judge

Generated: ${result.generated_at}

Status: \`${result.status}\`

Model: \`${result.model}\`

Packet: \`${result.packet_run_id}\`

Prediction run: \`${result.prediction_run}\`

## Budget

- Calls made: ${result.calls_made}
- Estimated cost: $${result.estimated_cost_usd.toFixed(6)}
- Run cost: $${result.run_cost_usd.toFixed(6)}
- Total tracked spend: $${result.budget.total_actual_spend_usd.toFixed(6)} / $${result.budget.max_budget_usd}
- Remaining total budget: $${result.budget.remaining_total_budget_usd.toFixed(6)}

## Metrics

- Examples judged: ${result.metrics.examples_judged}
- Answer support: ${pct(result.metrics.answer_support_rate)}
- Abstention support: ${pct(result.metrics.abstention_support_rate)}
- Overall judged correct: ${pct(result.metrics.overall_judged_correct_rate)}

## Decision

- Run drift audit next: ${result.decision.run_drift_audit_next ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
}

function callCost(inputTokens, outputTokens, modelPrice) {
  return (inputTokens / 1_000_000) * modelPrice.inputPerMillion
    + (outputTokens / 1_000_000) * modelPrice.outputPerMillion;
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
