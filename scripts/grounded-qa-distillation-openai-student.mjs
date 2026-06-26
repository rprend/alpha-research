import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const exportDir = path.join(experimentDir, "exports");
const runDir = path.join(experimentDir, "runs");
const ledgerDir = path.join(experimentDir, "llm-calls");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "temporal_validation";
const model = args.model ?? "gpt-4o-mini";
const limit = numberArg(args.limit, 20);
const dryRun = args["dry-run"] === "true" || args.dryRun === "true";
const maxBudgetUsd = Number(args["max-budget-usd"] ?? 100);
const maxOutputTokens = numberArg(args["max-output-tokens"], 420);
const runId = args["run-id"] ?? `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "Z")}-openai-student-${split}`;
const outputDir = path.join(runDir, runId);
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const budgetPath = path.join(ledgerDir, "budget.json");
const prices = {
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.60, source: "https://developers.openai.com/api/docs/models/gpt-4o-mini" },
  "gpt-4.1-mini": { inputPerMillion: 0.40, outputPerMillion: 1.60, source: "https://developers.openai.com/api/docs/models/gpt-4.1-mini" },
};
const price = prices[model];
if (!price) {
  throw new Error(`Missing price table entry for model ${model}. Add one before making calls.`);
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(ledgerDir, { recursive: true });

const examples = (await readJsonl(path.join(exportDir, `${split}.sft.jsonl`))).slice(0, limit);
const referenceRows = (await readJsonl(path.join(experimentDir, "data", `${split}.jsonl`))).slice(0, limit);
const referencesById = new Map(referenceRows.map((row) => [row.example_id, row]));
const priorSpend = await ledgerSpend(ledgerPath);
const estimated = examples.map((example) => estimateCall(example, model, price, maxOutputTokens));
const estimatedCost = sum(estimated.map((row) => row.estimated_cost_usd));
if (priorSpend + estimatedCost > maxBudgetUsd) {
  throw new Error(`Refusing run: current ledger $${priorSpend.toFixed(4)} + estimated $${estimatedCost.toFixed(4)} exceeds max budget $${maxBudgetUsd.toFixed(2)}.`);
}

const predictions = [];
if (dryRun || !process.env.OPENAI_API_KEY) {
  const reason = dryRun ? "dry-run requested" : "OPENAI_API_KEY missing";
  for (const estimate of estimated) {
    predictions.push({
      example_id: estimate.example_id,
      model,
      skipped: true,
      skip_reason: reason,
      estimated_input_tokens: estimate.estimated_input_tokens,
      estimated_output_tokens: estimate.estimated_output_tokens,
      estimated_cost_usd: estimate.estimated_cost_usd,
    });
  }
} else {
  for (const example of examples) {
    const request = buildRequest(example, model, maxOutputTokens);
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
      throw new Error(`OpenAI request failed for ${example.example_id}: ${response.status} ${JSON.stringify(payload).slice(0, 500)}`);
    }
    const prediction = parsePrediction(payload.choices?.[0]?.message?.content ?? "");
    const usage = payload.usage ?? {};
    const cost = callCost(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0, price);
    await appendLedger(ledgerPath, {
      ts: new Date().toISOString(),
      provider: "openai",
      model,
      run_id: runId,
      split,
      example_id: example.example_id,
      prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
      total_tokens: usage.total_tokens ?? null,
      cost_usd: cost,
      price_source: price.source,
    });
    predictions.push({
      example_id: example.example_id,
      model,
      prediction,
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
  model,
  examples_requested: examples.length,
  dry_run: dryRun,
  calls_made: predictions.filter((row) => !row.skipped).length,
  calls_skipped: predictions.filter((row) => row.skipped).length,
  estimated_cost_usd: estimatedCost,
  ledger_spend_before_usd: priorSpend,
  ledger_spend_after_usd: actualSpend,
  max_budget_usd: maxBudgetUsd,
  price,
};
summary.metrics = evaluatePredictions(predictions, referencesById);

await writeJsonl(path.join(outputDir, "predictions.jsonl"), predictions);
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
  predictions: path.relative(rootDir, path.join(outputDir, "predictions.jsonl")),
  budget: path.relative(rootDir, budgetPath),
  summary,
}, null, 2));

function buildRequest(example, selectedModel, outputTokens) {
  return {
    model: selectedModel,
    temperature: 0,
    max_tokens: outputTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are a cheap student model for citation-grounded QA.",
          "Answer only from the compact evidence pack.",
          "Return only valid JSON with exactly these keys: answer_type, answer, citations, claim_table, abstention_reason.",
          "answer_type must be exactly \"grounded_answer\" or \"abstain\".",
          "If evidence is insufficient, set answer_type to \"abstain\", use no citations, and explain why.",
          "If answering, cite every factual sentence inline using bracketed evidence ids such as [E2].",
          "The citations field must be an array of cited evidence id strings, not objects.",
          "The claim_table field must be an array of objects with claim, support, and citations.",
        ].join(" "),
      },
      {
        role: "user",
        content: `${example.messages[1].content}\n\nReturn only valid JSON. Use evidence ids exactly as provided. Do not invent evidence ids.`,
      },
    ],
  };
}

function parsePrediction(content) {
  try {
    const parsed = JSON.parse(content);
    return normalizePrediction(parsed);
  } catch {
    return {
      answer_type: "parse_error",
      answer: content,
      citations: [],
      claim_table: [],
      abstention_reason: "Model response was not valid JSON.",
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

function evaluatePredictions(rows, references) {
  const scored = rows
    .filter((row) => !row.skipped)
    .map((row) => {
      const reference = references.get(row.example_id);
      if (!reference) return null;
      const prediction = normalizePrediction(row.prediction ?? {});
      const referenceCitations = new Set((reference.output.citations ?? []).map((citation) => citation.evidence_id));
      const citedGold = prediction.citations.filter((id) => reference.teacher_trace.evidence_roles[id] === "gold_evidence").length;
      const answerable = reference.output.answer_type !== "abstain";
      const abstained = prediction.answer_type === "abstain";
      return {
        answer_type_correct: prediction.answer_type === reference.output.answer_type,
        citation_precision: prediction.citations.length ? citedGold / prediction.citations.length : null,
        citation_recall: referenceCitations.size
          ? prediction.citations.filter((id) => referenceCitations.has(id)).length / referenceCitations.size
          : null,
        answer_token_f1: answerable ? (!abstained ? tokenF1(prediction.answer, stripCitations(reference.output.answer)) : 0) : null,
        abstention_correct: answerable ? !abstained : abstained,
        inline_citation_rate: prediction.answer_type === "grounded_answer"
          ? (prediction.citations.length ? prediction.citations.filter((id) => prediction.answer.includes(`[${id}]`)).length / prediction.citations.length : 0)
          : null,
      };
    })
    .filter(Boolean);

  return {
    examples_scored: scored.length,
    answer_type_accuracy: mean(scored.map((row) => row.answer_type_correct)),
    citation_precision: mean(scored.map((row) => row.citation_precision)),
    citation_recall: mean(scored.map((row) => row.citation_recall)),
    answer_token_f1: mean(scored.map((row) => row.answer_token_f1)),
    abstention_accuracy: mean(scored.map((row) => row.abstention_correct)),
    inline_citation_rate: mean(scored.map((row) => row.inline_citation_rate)),
  };
}

function estimateCall(example, selectedModel, modelPrice, outputTokens) {
  const request = buildRequest(example, selectedModel, outputTokens);
  const serialized = JSON.stringify(request.messages);
  const estimatedInputTokens = Math.ceil(serialized.length / 4);
  const estimatedOutputTokens = outputTokens;
  return {
    example_id: example.example_id,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: estimatedOutputTokens,
    estimated_cost_usd: callCost(estimatedInputTokens, estimatedOutputTokens, modelPrice),
  };
}

function callCost(inputTokens, outputTokens, modelPrice) {
  return (inputTokens / 1_000_000) * modelPrice.inputPerMillion
    + (outputTokens / 1_000_000) * modelPrice.outputPerMillion;
}

function tokenF1(prediction, reference) {
  const predicted = contentTokens(stripCitations(prediction));
  const gold = contentTokens(reference);
  if (!predicted.length && !gold.length) return 1;
  if (!predicted.length || !gold.length) return 0;
  const goldCounts = counts(gold);
  let overlap = 0;
  for (const token of predicted) {
    const count = goldCounts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      goldCounts.set(token, count - 1);
    }
  }
  if (!overlap) return 0;
  const precision = overlap / predicted.length;
  const recall = overlap / gold.length;
  return (2 * precision * recall) / (precision + recall);
}

function contentTokens(value) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why"]);
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stop.has(token));
}

function stripCitations(value) {
  return String(value).replace(/\s*\[[^\]]+\]/g, "").trim();
}

function counts(tokens) {
  const map = new Map();
  for (const token of tokens) map.set(token, (map.get(token) ?? 0) + 1);
  return map;
}

function mean(values) {
  const numeric = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number);
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : 0;
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

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [key, raw] = value.slice(2).split("=");
    parsed[key] = raw ?? "true";
  }
  return parsed;
}
