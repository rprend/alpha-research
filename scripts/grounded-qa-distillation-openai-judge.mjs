import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const ledgerDir = path.join(experimentDir, "llm-calls");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "temporal_test";
const predictionRun = args["prediction-run"];
if (!predictionRun) {
  throw new Error("Missing --prediction-run=<run-id>.");
}

const model = args.model ?? "gpt-4o-mini";
const offset = nonNegativeNumberArg(args.offset, 0);
const limit = numberArg(args.limit, Number.POSITIVE_INFINITY);
const dryRun = args["dry-run"] === "true" || args.dryRun === "true";
const maxBudgetUsd = Number(args["max-budget-usd"] ?? 100);
const maxOutputTokens = numberArg(args["max-output-tokens"], 520);
const runId = args["run-id"] ?? `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "Z")}-openai-judge-${predictionRun}`;
const outputDir = path.join(runDir, runId);
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const budgetPath = path.join(ledgerDir, "budget.json");
const prices = {
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.60, source: "https://developers.openai.com/api/docs/models/gpt-4o-mini" },
  "gpt-4o": { inputPerMillion: 2.50, outputPerMillion: 10.00, source: "https://developers.openai.com/api/docs/models/gpt-4o" },
};
const price = prices[model];
if (!price) {
  throw new Error(`Missing price table entry for judge model ${model}. Add one before making calls.`);
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(ledgerDir, { recursive: true });

const references = await readJsonl(path.join(experimentDir, "data", `${split}.jsonl`));
const referencesById = new Map(references.map((row) => [row.example_id, row]));
const predictions = (await readJsonl(path.join(runDir, predictionRun, "predictions.jsonl")))
  .filter((row) => !row.skipped)
  .filter((row) => referencesById.has(referenceLookupId(row)))
  .slice(offset, offset + limit);

const priorSpend = await ledgerSpend(ledgerPath);
const estimated = predictions.map((prediction) => estimateCall(prediction, referencesById.get(referenceLookupId(prediction)), model, price, maxOutputTokens));
const estimatedCost = sum(estimated.map((row) => row.estimated_cost_usd));
if (priorSpend + estimatedCost > maxBudgetUsd) {
  throw new Error(`Refusing run: current ledger $${priorSpend.toFixed(4)} + estimated $${estimatedCost.toFixed(4)} exceeds max budget $${maxBudgetUsd.toFixed(2)}.`);
}

const judgments = [];
if (dryRun || !process.env.OPENAI_API_KEY) {
  const reason = dryRun ? "dry-run requested" : "OPENAI_API_KEY missing";
  for (const estimate of estimated) {
    judgments.push({
      example_id: estimate.example_id,
      prediction_run: predictionRun,
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
    const reference = referencesById.get(referenceLookupId(prediction));
    const request = buildRequest(prediction, reference, model, maxOutputTokens);
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
      throw new Error(`OpenAI judge request failed for ${prediction.example_id}: ${response.status} ${JSON.stringify(payload).slice(0, 500)}`);
    }
    const judgment = normalizeJudgment(parseJson(payload.choices?.[0]?.message?.content ?? ""));
    const usage = payload.usage ?? {};
    const cost = callCost(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0, price);
    await appendLedger(ledgerPath, {
      ts: new Date().toISOString(),
      provider: "openai",
      model,
      task: "grounded_qa_entailment_judge",
      run_id: runId,
      prediction_run: predictionRun,
      split,
      example_id: prediction.example_id,
      prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
      total_tokens: usage.total_tokens ?? null,
      cost_usd: cost,
      price_source: price.source,
    });
    judgments.push({
      example_id: prediction.example_id,
      prediction_run: predictionRun,
      model,
      prediction_answer_type: normalizePrediction(prediction.prediction ?? {}).answer_type,
      judgment,
      raw_content: payload.choices?.[0]?.message?.content ?? "",
      usage,
      cost_usd: cost,
    });
  }
}

const actualSpend = await ledgerSpend(ledgerPath);
const summary = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  prediction_run: predictionRun,
  model,
  examples_offset: offset,
  examples_requested: predictions.length,
  dry_run: dryRun,
  calls_made: judgments.filter((row) => !row.skipped).length,
  calls_skipped: judgments.filter((row) => row.skipped).length,
  run_cost_usd: sum(judgments.map((row) => Number(row.cost_usd ?? 0))),
  estimated_cost_usd: estimatedCost,
  ledger_spend_before_usd: priorSpend,
  ledger_spend_after_usd: actualSpend,
  max_budget_usd: maxBudgetUsd,
  price,
};
summary.metrics = evaluateJudgments(judgments);

await writeJsonl(path.join(outputDir, "judgments.jsonl"), judgments);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(budgetPath, `${JSON.stringify({
  max_budget_usd: maxBudgetUsd,
  ledger_spend_usd: actualSpend,
  remaining_budget_usd: Math.max(0, maxBudgetUsd - actualSpend),
  ledger_path: path.relative(rootDir, ledgerPath),
  last_updated: new Date().toISOString(),
}, null, 2)}\n`);

console.log(JSON.stringify({
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  judgments: path.relative(rootDir, path.join(outputDir, "judgments.jsonl")),
  budget: path.relative(rootDir, budgetPath),
  summary,
}, null, 2));

function buildRequest(predictionRow, reference, selectedModel, outputTokens) {
  const prediction = normalizePrediction(predictionRow.prediction ?? {});
  const citedIds = new Set(prediction.citations);
  const citedEvidence = reference.input.compact_retrieved_evidence_pack
    .filter((evidence) => citedIds.has(evidence.evidence_id));
  const evidenceForAbstention = prediction.answer_type === "abstain"
    ? reference.input.compact_retrieved_evidence_pack
    : citedEvidence;
  const evidenceText = evidenceForAbstention.length
    ? evidenceForAbstention.map(formatEvidence).join("\n\n")
    : "No cited evidence ids were provided.";

  return {
    model: selectedModel,
    temperature: 0,
    max_tokens: outputTokens,
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
          `Question: ${reference.input.question}`,
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

function referenceLookupId(row) {
  return row.root_example_id ?? row.example_id;
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
  const answerSupported = answered.filter((row) => {
    const judgment = row.judgment;
    return judgment.verdict === "supported" && judgment.all_claims_supported && judgment.citation_ids_valid;
  });
  const abstentionSupported = abstained.filter((row) => {
    const judgment = row.judgment;
    return judgment.verdict === "correct_abstention" && judgment.abstention_supported;
  });
  const judgedCorrect = answerSupported.length + abstentionSupported.length;

  return {
    examples_judged: scored.length,
    answered_predictions: answered.length,
    abstained_predictions: abstained.length,
    answer_support_rate: answered.length ? answerSupported.length / answered.length : 0,
    abstention_support_rate: abstained.length ? abstentionSupported.length / abstained.length : 0,
    overall_judged_correct_rate: scored.length ? judgedCorrect / scored.length : 0,
    invalid_judgment_rate: scored.length ? scored.filter((row) => row.judgment.verdict === "invalid").length / scored.length : 0,
  };
}

function estimateCall(prediction, reference, selectedModel, modelPrice, outputTokens) {
  const request = buildRequest(prediction, reference, selectedModel, outputTokens);
  const serialized = JSON.stringify(request.messages);
  const estimatedInputTokens = Math.ceil(serialized.length / 4);
  const estimatedOutputTokens = outputTokens;
  return {
    example_id: prediction.example_id,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: estimatedOutputTokens,
    estimated_cost_usd: callCost(estimatedInputTokens, estimatedOutputTokens, modelPrice),
  };
}

function callCost(inputTokens, outputTokens, modelPrice) {
  return (inputTokens / 1_000_000) * modelPrice.inputPerMillion
    + (outputTokens / 1_000_000) * modelPrice.outputPerMillion;
}

async function ledgerSpend(file) {
  try {
    const rows = await readJsonl(file);
    return sum(rows.map((row) => Number(row.cost_usd ?? 0)));
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
