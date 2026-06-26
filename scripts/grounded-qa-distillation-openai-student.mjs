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
const persona = args.persona ?? (model === "gpt-4o-mini" ? "student" : "teacher");
const limit = numberArg(args.limit, 20);
const offset = numberArg(args.offset, 0, { allowZero: true });
const dryRun = args["dry-run"] === "true" || args.dryRun === "true";
const maxBudgetUsd = Number(args["max-budget-usd"] ?? 100);
const maxOutputTokens = numberArg(args["max-output-tokens"], 420);
const demoRunIds = listArg(args["demo-runs"]);
const demoJudgeRunIds = listArg(args["demo-judge-runs"]);
const demoLimit = numberArg(args["demo-limit"], 0, { allowZero: true });
const scaffold = args.scaffold ?? "none";
const teacherLabelPrefix = args["teacher-label-prefix"] ?? "teacher-repair-temporal-test-0-132-v1";
const runId = args["run-id"] ?? `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "Z")}-openai-student-${split}`;
const outputDir = path.join(runDir, runId);
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const budgetPath = path.join(ledgerDir, "budget.json");
const prices = {
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.60, source: "https://developers.openai.com/api/docs/models/gpt-4o-mini" },
  "gpt-4o": { inputPerMillion: 2.50, outputPerMillion: 10.00, source: "https://developers.openai.com/api/docs/models/gpt-4o" },
  "gpt-4.1-mini": { inputPerMillion: 0.40, outputPerMillion: 1.60, source: "https://developers.openai.com/api/docs/models/gpt-4.1-mini" },
};
const price = prices[model];
if (!price) {
  throw new Error(`Missing price table entry for model ${model}. Add one before making calls.`);
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(ledgerDir, { recursive: true });

const allExamples = await readJsonl(path.join(exportDir, `${split}.sft.jsonl`));
const allReferenceRows = await readJsonl(path.join(experimentDir, "data", `${split}.jsonl`));
const examples = allExamples.slice(offset, offset + limit);
const referenceRows = allReferenceRows.slice(offset, offset + limit);
const referencesById = new Map(referenceRows.map((row) => [row.example_id, row]));
const targetExampleIds = new Set(examples.map((example) => example.example_id));
const demos = demoLimit > 0
  ? await loadTeacherDemos({ split, demoRunIds, demoJudgeRunIds, demoLimit, targetExampleIds, allExamples })
  : [];
const scaffoldSummary = ["teacher-label-rubric", "teacher-label-balanced-rubric"].includes(scaffold)
  ? await buildTeacherLabelRubric(teacherLabelPrefix)
  : null;
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
      offset,
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
  persona,
  examples_offset: offset,
  examples_requested: examples.length,
  demo_run_ids: demoRunIds,
  demo_judge_run_ids: demoJudgeRunIds,
  demo_limit: demoLimit,
  demos_used: demos.length,
  scaffold,
  teacher_label_prefix: scaffoldSummary ? teacherLabelPrefix : null,
  scaffold_summary: scaffoldSummary,
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
  const roleLabel = persona === "teacher"
    ? "an expensive teacher model for citation-grounded QA"
    : "a cheap student model for citation-grounded QA";
  return {
    model: selectedModel,
    temperature: 0,
    max_tokens: outputTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
    content: [
          `You are ${roleLabel}.`,
          "Answer only from the compact evidence pack.",
          "Return only valid JSON with exactly these keys: answer_type, answer, citations, claim_table, abstention_reason.",
          "answer_type must be exactly \"grounded_answer\" or \"abstain\".",
          "If evidence is insufficient, set answer_type to \"abstain\", use no citations, and explain why.",
          "If answering, cite every factual sentence inline using bracketed evidence ids such as [E2].",
          "The citations field must be an array of cited evidence id strings, not objects.",
          "The claim_table field must be an array of objects with claim, support, and citations.",
          scaffoldInstructions(scaffold, scaffoldSummary),
        ].join(" "),
      },
      {
        role: "user",
        content: [
          demoPrompt(demos),
          scaffoldUserPrompt(scaffoldSummary),
          "Target example:",
          example.messages[1].content,
          "Return only valid JSON. Use evidence ids exactly as provided. Do not invent evidence ids.",
        ].filter(Boolean).join("\n\n"),
      },
    ],
  };
}

async function buildTeacherLabelRubric(prefix) {
  const rows = await readJsonl(path.join(exportDir, `${prefix}.sft.jsonl`));
  const answered = rows.filter((row) => row.teacher_output?.answer_type === "grounded_answer");
  const abstained = rows.filter((row) => row.teacher_output?.answer_type === "abstain");
  const citationCounts = answered.map((row) => row.teacher_output.citations?.length ?? 0);
  const claimCounts = answered.map((row) => row.teacher_output.claim_table?.length ?? 0);
  const answerLengths = answered.map((row) => contentTokens(row.teacher_output.answer ?? "").length);
  const evidencePackSizes = rows.map((row) => row.input?.compact_retrieved_evidence_pack?.length ?? 0);
  const abstentionReasons = summarizeAbstentionReasons(abstained);
  return {
    mode: scaffold,
    source_label_prefix: prefix,
    accepted_labels: rows.length,
    answered_labels: answered.length,
    abstention_labels: abstained.length,
    answer_rate: ratio(answered.length, rows.length),
    median_citations_per_answer: median(citationCounts),
    median_claims_per_answer: median(claimCounts),
    median_answer_content_tokens: median(answerLengths),
    median_evidence_pack_size: median(evidencePackSizes),
    abstention_reason_patterns: abstentionReasons,
    policy: scaffold === "teacher-label-balanced-rubric" ? balancedRubricPolicy() : strictRubricPolicy(),
  };
}

function strictRubricPolicy() {
  return [
    "Prefer abstention unless at least one evidence item directly answers the question.",
    "Use one or two cited evidence ids for most answers; do not cite distractor or background-only evidence.",
    "Every factual sentence must include its supporting evidence id inline.",
    "The citations array must exactly list ids that appear inline in the answer.",
    "Keep claim_table short: one row per factual sentence or atomic claim.",
    "If the evidence only defines context, motivation, related work, or partial setup, abstain.",
  ];
}

function balancedRubricPolicy() {
  return [
    "Answer when the supplied evidence directly supports a useful response, even if the evidence does not answer every possible aspect of the question.",
    "Abstain only when no evidence item directly entails the requested answer, value, comparison, method, or conclusion.",
    "If evidence supports a narrow answer, give that narrow answer and cite it instead of abstaining.",
    "Use one or two cited evidence ids for most answers; do not cite distractor or background-only evidence.",
    "Every factual sentence must include its supporting evidence id inline.",
    "The citations array must exactly list ids that appear inline in the answer.",
    "Keep claim_table short: one row per factual sentence or atomic claim.",
  ];
}

function scaffoldInstructions(mode, summary) {
  if (mode === "answer-recovery") return answerRecoveryPolicy();
  if (!summary) return "";
  return [
    "You are using a distilled rubric learned from strict repaired-teacher labels.",
    "Follow these learned constraints:",
    ...summary.policy,
    summary.mode === "teacher-label-balanced-rubric"
      ? "This balanced variant is tuned to recover answer coverage while preserving citation discipline; do not over-abstain when direct evidence exists."
      : `The source teacher labels answered ${(summary.answer_rate * 100).toFixed(1)}% of examples; use this only as calibration, not as a target quota.`,
    `Typical grounded answers use about ${summary.median_citations_per_answer} citation ids and ${summary.median_claims_per_answer} claim-table rows.`,
  ].join(" ");
}

function answerRecoveryPolicy() {
  return [
    "Use an extractive recovery policy for answerable examples that conservative students may over-abstain on.",
    "Prefer a short narrow answer copied or paraphrased from the single best evidence item.",
    "Pay special attention to tables, floats, captions, metric lists, dataset availability statements, and result summaries.",
    "Answer only when an evidence item directly entails the requested value, yes/no fact, metric list, method, comparison, or result.",
    "Do not answer from topical related evidence, background motivation, examples, or evidence that merely contains words from the question.",
    "If the best evidence does not directly answer the question, abstain.",
    "When answering, keep the answer concise and cite the supporting evidence id inline in every sentence.",
    "Use the fewest citation ids needed, usually one.",
  ].join(" ");
}

function scaffoldUserPrompt(summary) {
  if (!summary) return "";
  return [
    "Distilled teacher-label scaffold:",
    JSON.stringify({
      source_label_prefix: summary.source_label_prefix,
      accepted_labels: summary.accepted_labels,
      answer_rate: summary.answer_rate,
      abstention_reason_patterns: summary.abstention_reason_patterns,
      policy: summary.policy,
    }),
  ].join("\n");
}

function summarizeAbstentionReasons(rows) {
  const buckets = new Map([
    ["missing_answer", 0],
    ["partial_or_indirect", 0],
    ["no_direct_metric_or_result", 0],
    ["other", 0],
  ]);
  for (const row of rows) {
    const reason = String(row.teacher_output?.abstention_reason ?? row.teacher_output?.answer ?? "").toLowerCase();
    if (/not provide|does not provide|insufficient|not enough|cannot determine/.test(reason)) {
      buckets.set("missing_answer", buckets.get("missing_answer") + 1);
    } else if (/partial|indirect|background|related|context/.test(reason)) {
      buckets.set("partial_or_indirect", buckets.get("partial_or_indirect") + 1);
    } else if (/metric|result|score|number|comparison/.test(reason)) {
      buckets.set("no_direct_metric_or_result", buckets.get("no_direct_metric_or_result") + 1);
    } else {
      buckets.set("other", buckets.get("other") + 1);
    }
  }
  return Object.fromEntries(buckets);
}

async function loadTeacherDemos({ split: selectedSplit, demoRunIds: runIds, demoJudgeRunIds: judgeRunIds, demoLimit: maxDemos, targetExampleIds: excludedIds, allExamples: sourceExamples }) {
  if (!runIds.length) {
    throw new Error("--demo-limit requires --demo-runs with at least one run id.");
  }
  const examplesById = new Map(sourceExamples.map((example) => [example.example_id, example]));
  const allowedByJudge = judgeRunIds.length ? await loadAllowedJudgeIds(judgeRunIds) : null;
  const demosOut = [];
  for (const sourceRunId of runIds) {
    const rows = await readJsonl(path.join(runDir, sourceRunId, "predictions.jsonl"));
    for (const row of rows) {
      if (demosOut.length >= maxDemos) return demosOut;
      if (excludedIds.has(row.example_id)) continue;
      if (allowedByJudge && !allowedByJudge.has(row.example_id)) continue;
      const sourceExample = examplesById.get(row.example_id);
      if (!sourceExample) continue;
      const prediction = normalizePrediction(row.prediction ?? {});
      if (!["grounded_answer", "abstain"].includes(prediction.answer_type)) continue;
      demosOut.push({
        source_run_id: sourceRunId,
        example_id: row.example_id,
        split: selectedSplit,
        input: parseExampleInput(sourceExample),
        output: prediction,
      });
    }
  }
  return demosOut;
}

async function loadAllowedJudgeIds(judgeRunIds) {
  const allowed = new Set();
  for (const judgeRunId of judgeRunIds) {
    const rows = await readJsonl(path.join(runDir, judgeRunId, "judgments.jsonl"));
    for (const row of rows) {
      const judgment = row.judgment ?? {};
      const isSupportedAnswer = row.prediction_answer_type === "grounded_answer"
        && judgment.verdict === "supported"
        && judgment.all_claims_supported === true
        && judgment.citation_ids_valid === true;
      const isSupportedAbstention = row.prediction_answer_type === "abstain"
        && judgment.verdict === "correct_abstention"
        && judgment.abstention_supported === true;
      if (isSupportedAnswer || isSupportedAbstention) allowed.add(row.example_id);
    }
  }
  return allowed;
}

function parseExampleInput(example) {
  try {
    return JSON.parse(example.messages[1].content);
  } catch {
    return { raw_input: example.messages[1].content };
  }
}

function demoPrompt(rows) {
  if (!rows.length) return "";
  const compact = rows.map((row) => ({
    example_id: row.example_id,
    question: row.input.question,
    document_metadata: row.input.document_metadata,
    compact_retrieved_evidence_pack: row.input.compact_retrieved_evidence_pack,
    teacher_output: row.output,
  }));
  return [
    "Teacher-labeled demonstrations from prior repaired multi-step runs follow.",
    "Use them to match abstention calibration, citation formatting, and claim-table structure. Do not copy their facts into the target answer unless the target evidence supports them.",
    JSON.stringify(compact),
  ].join("\n");
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

function median(values) {
  const numeric = values.filter((value) => Number.isFinite(Number(value))).map(Number).sort((a, b) => a - b);
  if (!numeric.length) return 0;
  const middle = Math.floor(numeric.length / 2);
  return numeric.length % 2 ? numeric[middle] : (numeric[middle - 1] + numeric[middle]) / 2;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
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

function numberArg(value, fallback, options = {}) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (options.allowZero ? parsed < 0 : parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function listArg(value) {
  if (value == null || value === "") return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
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
