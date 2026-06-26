import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const exportDir = path.join(experimentDir, "exports");
const runDir = path.join(experimentDir, "runs");
const ledgerDir = path.join(experimentDir, "llm-calls");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "temporal_test";
const plannerModel = args["planner-model"] ?? "gpt-4o";
const answerModel = args["answer-model"] ?? plannerModel;
const limit = numberArg(args.limit, 40);
const dryRun = args["dry-run"] === "true" || args.dryRun === "true";
const maxBudgetUsd = Number(args["max-budget-usd"] ?? 100);
const plannerMaxOutputTokens = numberArg(args["planner-max-output-tokens"], 360);
const answerMaxOutputTokens = numberArg(args["answer-max-output-tokens"], 500);
const runId = args["run-id"] ?? `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "Z")}-openai-multistep-teacher-${split}`;
const outputDir = path.join(runDir, runId);
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const budgetPath = path.join(ledgerDir, "budget.json");
const prices = {
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.60, source: "https://developers.openai.com/api/docs/models/gpt-4o-mini" },
  "gpt-4o": { inputPerMillion: 2.50, outputPerMillion: 10.00, source: "https://developers.openai.com/api/docs/models/gpt-4o" },
  "gpt-4.1-mini": { inputPerMillion: 0.40, outputPerMillion: 1.60, source: "https://developers.openai.com/api/docs/models/gpt-4.1-mini" },
};
const plannerPrice = priceFor(plannerModel);
const answerPrice = priceFor(answerModel);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(ledgerDir, { recursive: true });

const examples = (await readJsonl(path.join(exportDir, `${split}.sft.jsonl`))).slice(0, limit);
const referenceRows = (await readJsonl(path.join(experimentDir, "data", `${split}.jsonl`))).slice(0, limit);
const referencesById = new Map(referenceRows.map((row) => [row.example_id, row]));
const priorSpend = await ledgerSpend(ledgerPath);
const estimated = examples.flatMap((example) => estimateCalls(example));
const estimatedCost = sum(estimated.map((row) => row.estimated_cost_usd));
if (priorSpend + estimatedCost > maxBudgetUsd) {
  throw new Error(`Refusing run: current ledger $${priorSpend.toFixed(4)} + estimated $${estimatedCost.toFixed(4)} exceeds max budget $${maxBudgetUsd.toFixed(2)}.`);
}

const predictions = [];
const traces = [];
if (dryRun || !process.env.OPENAI_API_KEY) {
  const reason = dryRun ? "dry-run requested" : "OPENAI_API_KEY missing";
  for (const example of examples) {
    predictions.push({
      example_id: example.example_id,
      model: answerModel,
      planner_model: plannerModel,
      skipped: true,
      skip_reason: reason,
      estimated_cost_usd: sum(estimated.filter((row) => row.example_id === example.example_id).map((row) => row.estimated_cost_usd)),
    });
    traces.push({
      example_id: example.example_id,
      skipped: true,
      skip_reason: reason,
      estimates: estimated.filter((row) => row.example_id === example.example_id),
    });
  }
} else {
  for (const example of examples) {
    const reference = referencesById.get(example.example_id);
    const plannerRequest = buildPlannerRequest(example, plannerModel, plannerMaxOutputTokens);
    const plannerPayload = await callOpenAi(plannerRequest, example.example_id, "planner");
    const plannerUsage = plannerPayload.usage ?? {};
    const plannerCost = callCost(plannerUsage.prompt_tokens ?? 0, plannerUsage.completion_tokens ?? 0, plannerPrice);
    await appendCallLedger({
      model: plannerModel,
      stage: "planner",
      example_id: example.example_id,
      usage: plannerUsage,
      cost: plannerCost,
      price: plannerPrice,
    });
    const plan = normalizePlan(parseJson(plannerPayload.choices?.[0]?.message?.content ?? ""));
    let prediction;
    let answerPayload = null;
    let answerUsage = null;
    let answerCost = 0;
    if (plan.sufficient) {
      const answerRequest = buildAnswerRequest(example, plan, answerModel, answerMaxOutputTokens);
      answerPayload = await callOpenAi(answerRequest, example.example_id, "answer");
      answerUsage = answerPayload.usage ?? {};
      answerCost = callCost(answerUsage.prompt_tokens ?? 0, answerUsage.completion_tokens ?? 0, answerPrice);
      await appendCallLedger({
        model: answerModel,
        stage: "answer",
        example_id: example.example_id,
        usage: answerUsage,
        cost: answerCost,
        price: answerPrice,
      });
      prediction = normalizePrediction(parseJson(answerPayload.choices?.[0]?.message?.content ?? ""));
    } else {
      prediction = {
        answer_type: "abstain",
        answer: "",
        citations: [],
        claim_table: [],
        abstention_reason: plan.missing_information || "The planner found the compact evidence pack insufficient.",
      };
    }

    predictions.push({
      example_id: example.example_id,
      model: answerModel,
      planner_model: plannerModel,
      prediction,
      raw_content: answerPayload?.choices?.[0]?.message?.content ?? "",
      usage: combineUsage([plannerUsage, answerUsage].filter(Boolean)),
      cost_usd: plannerCost + answerCost,
    });
    traces.push({
      example_id: example.example_id,
      planner_model: plannerModel,
      answer_model: answerModel,
      plan,
      planner_raw_content: plannerPayload.choices?.[0]?.message?.content ?? "",
      answer_raw_content: answerPayload?.choices?.[0]?.message?.content ?? "",
      planner_usage: plannerUsage,
      answer_usage: answerUsage,
      planner_cost_usd: plannerCost,
      answer_cost_usd: answerCost,
      total_cost_usd: plannerCost + answerCost,
      reference_answer_type: reference?.output?.answer_type ?? null,
    });
  }
}

const actualSpend = await ledgerSpend(ledgerPath);
const summary = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  planner_model: plannerModel,
  answer_model: answerModel,
  examples_requested: examples.length,
  dry_run: dryRun,
  calls_made: traces.reduce((total, row) => total + (row.planner_usage ? 1 : 0) + (row.answer_usage ? 1 : 0), 0),
  calls_skipped: dryRun || !process.env.OPENAI_API_KEY ? examples.length * 2 : 0,
  run_cost_usd: sum(predictions.map((row) => Number(row.cost_usd ?? 0))),
  estimated_cost_usd: estimatedCost,
  ledger_spend_before_usd: priorSpend,
  ledger_spend_after_usd: actualSpend,
  max_budget_usd: maxBudgetUsd,
  prices: {
    planner: plannerPrice,
    answer: answerPrice,
  },
};
summary.metrics = evaluatePredictions(predictions, referencesById);
summary.trace_metrics = evaluateTraces(traces);

await writeJsonl(path.join(outputDir, "predictions.jsonl"), predictions);
await writeJsonl(path.join(outputDir, "teacher_traces.jsonl"), traces);
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
  traces: path.relative(rootDir, path.join(outputDir, "teacher_traces.jsonl")),
  budget: path.relative(rootDir, budgetPath),
  summary,
}, null, 2));

function buildPlannerRequest(example, selectedModel, outputTokens) {
  return {
    model: selectedModel,
    temperature: 0,
    max_tokens: outputTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are the planning stage of an expensive multi-step RAG teacher.",
          "Use only the compact evidence pack.",
          "Decide whether the evidence is sufficient to answer the question.",
          "Select only evidence ids that directly support the answer.",
          "Return only valid JSON with keys: sufficient, selected_evidence_ids, missing_information, rationale.",
          "sufficient must be boolean. selected_evidence_ids must be an array of evidence id strings.",
        ].join(" "),
      },
      {
        role: "user",
        content: example.messages[1].content,
      },
    ],
  };
}

function buildAnswerRequest(example, plan, selectedModel, outputTokens) {
  const selected = new Set(plan.selected_evidence_ids);
  const evidence = example.input.compact_retrieved_evidence_pack
    .filter((item) => selected.has(item.evidence_id));
  const evidenceText = evidence.length
    ? evidence.map(formatEvidence).join("\n\n")
    : example.input.compact_retrieved_evidence_pack.map(formatEvidence).join("\n\n");
  return {
    model: selectedModel,
    temperature: 0,
    max_tokens: outputTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are the answer-writing stage of an expensive multi-step RAG teacher.",
          "Use only the planner-selected evidence.",
          "Return only valid JSON with exactly these keys: answer_type, answer, citations, claim_table, abstention_reason.",
          "If the selected evidence is insufficient after all, set answer_type to abstain and use no citations.",
          "If answering, cite every factual sentence inline using bracketed evidence ids such as [E2].",
          "The citations field must be an array of cited evidence id strings.",
          "The claim_table field must be an array of objects with claim, support, and citations.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Question: ${example.input.question}`,
          `Planner rationale: ${plan.rationale}`,
          `Planner selected evidence ids: ${JSON.stringify(plan.selected_evidence_ids)}`,
          "",
          "Planner-selected evidence:",
          evidenceText,
          "",
          "Return only valid JSON. Do not invent evidence ids.",
        ].join("\n"),
      },
    ],
  };
}

function formatEvidence(evidence) {
  return `[${evidence.evidence_id}] ${evidence.section ?? "Evidence"}: ${evidence.text}`;
}

async function callOpenAi(request, exampleId, stage) {
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
    throw new Error(`OpenAI ${stage} request failed for ${exampleId}: ${response.status} ${JSON.stringify(payload).slice(0, 500)}`);
  }
  return payload;
}

async function appendCallLedger({ model, stage, example_id, usage, cost, price }) {
  await appendLedger(ledgerPath, {
    ts: new Date().toISOString(),
    provider: "openai",
    model,
    task: "grounded_qa_multistep_teacher",
    stage,
    run_id: runId,
    split,
    example_id,
    prompt_tokens: usage.prompt_tokens ?? null,
    completion_tokens: usage.completion_tokens ?? null,
    total_tokens: usage.total_tokens ?? null,
    cost_usd: cost,
    price_source: price.source,
  });
}

function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function normalizePlan(value) {
  const ids = Array.isArray(value.selected_evidence_ids)
    ? value.selected_evidence_ids.map(String).filter(Boolean)
    : [];
  return {
    sufficient: Boolean(value.sufficient),
    selected_evidence_ids: [...new Set(ids)],
    missing_information: String(value.missing_information ?? ""),
    rationale: String(value.rationale ?? ""),
  };
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

function evaluateTraces(rows) {
  const completed = rows.filter((row) => !row.skipped);
  const sufficient = completed.filter((row) => row.plan?.sufficient);
  return {
    examples_traced: completed.length,
    planner_sufficient_rate: completed.length ? sufficient.length / completed.length : 0,
    answer_stage_rate: completed.length ? completed.filter((row) => row.answer_usage).length / completed.length : 0,
    mean_selected_evidence_count: mean(completed.map((row) => row.plan?.selected_evidence_ids?.length ?? 0)),
    planner_cost_usd: sum(completed.map((row) => row.planner_cost_usd)),
    answer_cost_usd: sum(completed.map((row) => row.answer_cost_usd)),
  };
}

function estimateCalls(example) {
  const plannerRequest = buildPlannerRequest(example, plannerModel, plannerMaxOutputTokens);
  const answerRequest = buildAnswerRequest(example, {
    selected_evidence_ids: example.input.compact_retrieved_evidence_pack.map((item) => item.evidence_id),
    rationale: "dry-run estimate",
  }, answerModel, answerMaxOutputTokens);
  return [
    estimateRequest(example.example_id, "planner", plannerRequest, plannerPrice, plannerMaxOutputTokens),
    estimateRequest(example.example_id, "answer", answerRequest, answerPrice, answerMaxOutputTokens),
  ];
}

function estimateRequest(exampleId, stage, request, modelPrice, outputTokens) {
  const serialized = JSON.stringify(request.messages);
  const estimatedInputTokens = Math.ceil(serialized.length / 4);
  return {
    example_id: exampleId,
    stage,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: outputTokens,
    estimated_cost_usd: callCost(estimatedInputTokens, outputTokens, modelPrice),
  };
}

function combineUsage(usages) {
  return {
    prompt_tokens: sum(usages.map((usage) => usage.prompt_tokens ?? 0)),
    completion_tokens: sum(usages.map((usage) => usage.completion_tokens ?? 0)),
    total_tokens: sum(usages.map((usage) => usage.total_tokens ?? 0)),
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

function priceFor(model) {
  const price = prices[model];
  if (!price) throw new Error(`Missing price table entry for model ${model}. Add one before making calls.`);
  return price;
}
