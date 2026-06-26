import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const ledgerDir = path.join(experimentDir, "llm-calls");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "temporal_test";
const sourceRunId = args["source-run"];
if (!sourceRunId) throw new Error("Missing --source-run=<run-id>.");

const model = args.model ?? "gpt-4o-mini";
const evalOffset = numberArg(args["eval-offset"], 132, { allowZero: true });
const evalLimit = numberArg(args["eval-limit"], 40);
const dryRun = args["dry-run"] === "true" || args.dryRun === "true";
const maxBudgetUsd = Number(args["max-budget-usd"] ?? 100);
const maxOutputTokens = numberArg(args["max-output-tokens"], 460);
const runId = args["run-id"] ?? `openai-claim-pruner-${sourceRunId}-${evalOffset}-v1`;
const outputDir = path.join(runDir, runId);
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const budgetPath = path.join(ledgerDir, "budget.json");
const prices = {
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.60, source: "https://developers.openai.com/api/docs/models/gpt-4o-mini" },
  "gpt-4o": { inputPerMillion: 2.50, outputPerMillion: 10.00, source: "https://developers.openai.com/api/docs/models/gpt-4o" },
  "gpt-4.1-mini": { inputPerMillion: 0.40, outputPerMillion: 1.60, source: "https://developers.openai.com/api/docs/models/gpt-4.1-mini" },
};
const price = prices[model];
if (!price) throw new Error(`Missing price table entry for model ${model}. Add one before making calls.`);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(ledgerDir, { recursive: true });

const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const referenceRows = references.slice(evalOffset, evalOffset + evalLimit);
const referenceIds = new Set(referenceRows.map((row) => row.example_id));
const referencesById = new Map(referenceRows.map((row) => [row.example_id, row]));
const sourceRows = (await readJsonl(path.join(runDir, sourceRunId, "predictions.jsonl")))
  .filter((row) => !row.skipped)
  .filter((row) => referenceIds.has(row.example_id));

const priorSpend = await ledgerSpend(ledgerPath);
const estimated = sourceRows.map((row) => estimateCall(row, referencesById.get(row.example_id), model, price, maxOutputTokens));
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
      source_run_id: sourceRunId,
      model,
      skipped: true,
      skip_reason: reason,
      estimated_input_tokens: estimate.estimated_input_tokens,
      estimated_output_tokens: estimate.estimated_output_tokens,
      estimated_cost_usd: estimate.estimated_cost_usd,
    });
  }
} else {
  for (const row of sourceRows) {
    const reference = referencesById.get(row.example_id);
    const original = normalizePrediction(row.prediction ?? {});
    if (original.answer_type === "abstain") {
      const passthrough = {
        ...original,
        abstention_reason: original.abstention_reason || "Source prediction abstained.",
      };
      predictions.push({
        example_id: row.example_id,
        source_run_id: sourceRunId,
        model,
        prediction: passthrough,
        source_prediction: original,
        raw_content: "",
        usage: null,
        cost_usd: 0,
        metadata: { scaffold: "openai_claim_pruner", passthrough_abstention: true },
        scores: scorePrediction(reference, passthrough),
      });
      continue;
    }

    const request = buildRequest(row, reference, model, maxOutputTokens);
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
      throw new Error(`OpenAI claim-pruner request failed for ${row.example_id}: ${response.status} ${JSON.stringify(payload).slice(0, 500)}`);
    }
    const prediction = parsePrediction(payload.choices?.[0]?.message?.content ?? "");
    const usage = payload.usage ?? {};
    const cost = callCost(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0, price);
    await appendLedger(ledgerPath, {
      ts: new Date().toISOString(),
      provider: "openai",
      model,
      task: "grounded_qa_claim_pruner",
      run_id: runId,
      source_run_id: sourceRunId,
      split,
      eval_offset: evalOffset,
      example_id: row.example_id,
      prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
      total_tokens: usage.total_tokens ?? null,
      cost_usd: cost,
      price_source: price.source,
    });
    predictions.push({
      example_id: row.example_id,
      source_run_id: sourceRunId,
      model,
      prediction,
      source_prediction: original,
      raw_content: payload.choices?.[0]?.message?.content ?? "",
      usage,
      cost_usd: cost,
      metadata: {
        scaffold: "openai_claim_pruner",
        passthrough_abstention: false,
        answer_changed: prediction.answer !== original.answer,
        answer_type_changed: prediction.answer_type !== original.answer_type,
      },
      scores: scorePrediction(reference, prediction),
    });
  }
}

const actualSpend = await ledgerSpend(ledgerPath);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  source_run_id: sourceRunId,
  model,
  eval_offset: evalOffset,
  eval_examples: referenceRows.length,
  source_predictions_seen: sourceRows.length,
  dry_run: dryRun,
  calls_made: predictions.filter((row) => !row.skipped && row.usage).length,
  calls_skipped: predictions.filter((row) => row.skipped).length,
  passthrough_abstentions: predictions.filter((row) => row.metadata?.passthrough_abstention).length,
  run_cost_usd: sum(predictions.map((row) => Number(row.cost_usd ?? 0))),
  estimated_cost_usd: estimatedCost,
  ledger_spend_before_usd: priorSpend,
  ledger_spend_after_usd: actualSpend,
  max_budget_usd: maxBudgetUsd,
  price,
  metrics: summarize(predictions.filter((row) => !row.skipped)),
  interpretation: {
    purpose: "LLM claim pruning tests whether unsupported subclaims can be removed from existing answer candidates before final judging.",
    limitation: "This pass is an expensive teacher/verifier scaffold, not the final amortized cheap student.",
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), predictions);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(budgetPath, `${JSON.stringify({
  max_budget_usd: maxBudgetUsd,
  ledger_spend_usd: actualSpend,
  remaining_budget_usd: Math.max(0, maxBudgetUsd - actualSpend),
  ledger_path: path.relative(rootDir, ledgerPath),
  last_updated: new Date().toISOString(),
}, null, 2)}\n`);

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  predictions: path.relative(rootDir, path.join(outputDir, "predictions.jsonl")),
  budget: path.relative(rootDir, budgetPath),
  metrics: result.metrics,
}, null, 2));

function buildRequest(row, reference, selectedModel, outputTokens) {
  const original = normalizePrediction(row.prediction ?? {});
  return {
    model: selectedModel,
    temperature: 0,
    max_tokens: outputTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are a strict citation-grounded claim pruner.",
          "Use only the supplied question, source prediction, and compact evidence pack.",
          "Your job is to remove unsupported claims, not to make the answer more complete.",
          "If a narrower answer is directly supported by one or more evidence ids, return that narrower answer.",
          "If no useful answer remains after removing unsupported claims, abstain.",
          "Every factual sentence in an answer must include bracketed evidence ids inline.",
          "Use evidence ids exactly as provided. Do not invent ids.",
          "Return only valid JSON with exactly these keys: answer_type, answer, citations, claim_table, abstention_reason.",
          "answer_type must be exactly \"grounded_answer\" or \"abstain\".",
          "citations must be an array of evidence id strings.",
          "claim_table must contain one row per remaining factual claim, each with claim, support, and citations.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Question: ${reference.input.question}`,
          "",
          "Source prediction:",
          JSON.stringify(original),
          "",
          "Compact evidence pack:",
          reference.input.compact_retrieved_evidence_pack.map(formatEvidence).join("\n\n"),
          "",
          "Repair rule: keep only claims directly entailed by the cited evidence text. Drop unsupported comparisons, superlatives, causes, numbers, dataset names, methods, and conclusions unless the evidence explicitly states them.",
        ].join("\n"),
      },
    ],
  };
}

function formatEvidence(evidence) {
  return `[${evidence.evidence_id}] ${evidence.section ?? "Evidence"}: ${evidence.text}`;
}

function parsePrediction(content) {
  try {
    return normalizePrediction(JSON.parse(content));
  } catch {
    return {
      answer_type: "abstain",
      answer: "The evidence pack does not contain enough support to answer this question.",
      citations: [],
      claim_table: [{ claim: "Evidence is insufficient to answer.", support: "invalid_pruner_json", citations: [] }],
      abstention_reason: "Claim-pruner response was not valid JSON.",
    };
  }
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? [...new Set(value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean))]
    : [];
  return {
    answer_type: answerType,
    answer: answerType === "abstain"
      ? "The evidence pack does not contain enough support to answer this question."
      : String(value.answer ?? "").trim(),
    citations: answerType === "abstain" ? [] : citations,
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? "Evidence is insufficient.") : null,
  };
}

function scorePrediction(reference, prediction) {
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
}

function summarize(rows) {
  return {
    examples: rows.length,
    answered: rows.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstained: rows.filter((row) => row.prediction.answer_type === "abstain").length,
    answer_type_accuracy: mean(rows.map((row) => row.scores.answer_type_correct)),
    citation_precision: mean(rows.map((row) => row.scores.citation_precision)),
    citation_recall: mean(rows.map((row) => row.scores.citation_recall)),
    answer_token_f1: mean(rows.map((row) => row.scores.answer_token_f1)),
    abstention_accuracy: mean(rows.map((row) => row.scores.abstention_correct)),
    inline_citation_rate: mean(rows.map((row) => row.scores.inline_citation_rate)),
  };
}

function renderReport(result) {
  return `# OpenAI Claim Pruner

## Setup

- Source run: \`${result.source_run_id}\`
- Model: \`${result.model}\`
- Split: \`${result.split}\`
- Eval offset: ${result.eval_offset}
- Eval examples: ${result.eval_examples}
- LLM calls: ${result.calls_made}
- Run cost: $${result.run_cost_usd.toFixed(7)}

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.metrics.examples} | ${result.metrics.answered} | ${pct(result.metrics.answer_type_accuracy)} | ${pct(result.metrics.citation_precision)} | ${pct(result.metrics.citation_recall)} | ${pct(result.metrics.answer_token_f1)} | ${pct(result.metrics.inline_citation_rate)} |

${result.interpretation.purpose}

${result.interpretation.limitation}
`;
}

function estimateCall(row, reference, selectedModel, selectedPrice, outputTokens) {
  const request = buildRequest(row, reference, selectedModel, outputTokens);
  const serialized = JSON.stringify(request.messages);
  const estimatedInputTokens = Math.ceil(serialized.length / 4);
  const estimatedOutputTokens = outputTokens;
  return {
    example_id: row.example_id,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: estimatedOutputTokens,
    estimated_cost_usd: callCost(estimatedInputTokens, estimatedOutputTokens, selectedPrice),
  };
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

function callCost(inputTokens, outputTokens, selectedPrice) {
  return (inputTokens / 1_000_000) * selectedPrice.inputPerMillion
    + (outputTokens / 1_000_000) * selectedPrice.outputPerMillion;
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

function mean(values) {
  const numeric = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number);
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : 0;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function numberArg(value, fallback, options = {}) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (options.allowZero ? parsed < 0 : parsed <= 0) return fallback;
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
