import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const ledgerDir = path.join(experimentDir, "llm-calls");
const args = parseArgs(process.argv.slice(2));
const sourceRunId = args["source-run-id"] ?? "versioned-private-kb-prototype-git-docs-2026-06-26-v1";
const runId = args["run-id"] ?? `versioned-kb-natural-questions-${sourceRunId}`;
const model = args.model ?? "gpt-4o-mini";
const dryRun = args["dry-run"] === "true" || args.dryRun === "true";
const maxBudgetUsd = Number(args["max-budget-usd"] ?? 100);
const maxOutputTokens = numberArg(args["max-output-tokens"], 5000);
const limit = numberArg(args.limit, Number.POSITIVE_INFINITY);
const outputDir = path.join(runDir, runId);
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const budgetPath = path.join(ledgerDir, "budget.json");

const prices = {
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.60, source: "https://developers.openai.com/api/docs/models/gpt-4o-mini" },
  "gpt-4o": { inputPerMillion: 2.50, outputPerMillion: 10.00, source: "https://developers.openai.com/api/docs/models/gpt-4o" },
};
const price = prices[model];
if (!price) throw new Error(`Unsupported natural-question model ${model}.`);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(ledgerDir, { recursive: true });

const source = await readJson(path.join(runDir, sourceRunId, "result.json"));
const sourceExamples = (await readJsonl(path.join(runDir, sourceRunId, "candidate_examples.jsonl"))).slice(0, limit);
const priorSpend = await ledgerSpend(ledgerPath);
const apiRequest = buildApiRequest(sourceExamples, model, maxOutputTokens);
const estimate = estimateCall(apiRequest, price, maxOutputTokens);
if (priorSpend + estimate.estimated_cost_usd > maxBudgetUsd) {
  throw new Error(`Refusing natural-question run: current ledger $${priorSpend.toFixed(6)} + estimated $${estimate.estimated_cost_usd.toFixed(6)} exceeds max budget $${maxBudgetUsd.toFixed(2)}.`);
}

let authored = [];
let usage = null;
let runCost = 0;
let status = "dry_run_or_key_missing";
let rawModelOutput = "";

if (dryRun || !process.env.OPENAI_API_KEY) {
  authored = sourceExamples.map((example) => ({
    id: example.id,
    natural_question: heuristicQuestion(example),
    rationale: "Heuristic fallback; no API call was made.",
  }));
} else {
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
    throw new Error(`OpenAI natural-question generation failed: ${response.status} ${JSON.stringify(payload).slice(0, 500)}`);
  }
  rawModelOutput = payload.choices?.[0]?.message?.content ?? "";
  authored = normalizeAuthoredQuestions(parseJson(rawModelOutput), sourceExamples);
  usage = payload.usage ?? {};
  runCost = callCost(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0, price);
  await appendLedger(ledgerPath, {
    ts: new Date().toISOString(),
    provider: "openai",
    model,
    task: "versioned_kb_natural_question_generation",
    run_id: runId,
    source_run_id: sourceRunId,
    example_id: "batch",
    examples: sourceExamples.length,
    prompt_tokens: usage.prompt_tokens ?? null,
    completion_tokens: usage.completion_tokens ?? null,
    total_tokens: usage.total_tokens ?? null,
    cost_usd: runCost,
    price_source: price.source,
  });
  status = "natural_questions_generated";
}

const authoredById = new Map(authored.map((row) => [row.id, row]));
const naturalExamples = sourceExamples.map((example) => {
  const authoredRow = authoredById.get(example.id);
  const naturalQuestion = authoredRow?.natural_question ?? heuristicQuestion(example);
  return {
    ...example,
    original_question: example.input.question,
    natural_question_metadata: {
      generated_by: dryRun || !process.env.OPENAI_API_KEY ? "heuristic_fallback" : model,
      source_run_id: sourceRunId,
      question_rationale: authoredRow?.rationale ?? null,
    },
    input: {
      ...example.input,
      question: naturalQuestion,
    },
  };
});

const questionAudit = naturalExamples.map(auditQuestion);
const actualSpend = await ledgerSpend(ledgerPath);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "versioned_kb_natural_question_generation",
  status,
  source_run_id: sourceRunId,
  model,
  dry_run: dryRun,
  examples_requested: sourceExamples.length,
  examples_written: naturalExamples.length,
  estimated_cost_usd: estimate.estimated_cost_usd,
  run_cost_usd: runCost,
  ledger_spend_before_usd: priorSpend,
  ledger_spend_after_usd: actualSpend,
  max_budget_usd: maxBudgetUsd,
  price,
  usage,
  source_snapshot_pair: source.snapshots,
  aggregate: summarize(questionAudit),
  artifacts: {
    natural_candidate_examples_jsonl: path.relative(rootDir, path.join(outputDir, "natural_candidate_examples.jsonl")),
    question_audit_jsonl: path.relative(rootDir, path.join(outputDir, "question_audit.jsonl")),
    raw_model_output_txt: path.relative(rootDir, path.join(outputDir, "raw_model_output.txt")),
    report_md: path.relative(rootDir, path.join(outputDir, "report.md")),
  },
  claim_boundary: {
    supports_natural_question_wording_probe: status === "natural_questions_generated",
    supports_private_enterprise_kb_claim: false,
    supports_final_student_claim: false,
    reason: "This run authors natural questions over existing deterministic labels; it does not add private data, train a student, or judge model predictions.",
  },
  llm_budget: {
    openai_llm_calls: status === "natural_questions_generated" ? 1 : 0,
    openai_cost_usd: runCost,
    external_compute_cost_usd: 0,
    note: "Question-authoring call, if made, is recorded in llm-calls/ledger.jsonl. Answers and citations remain deterministic from the source snapshot artifact.",
  },
};

await writeJsonl(path.join(outputDir, "natural_candidate_examples.jsonl"), naturalExamples);
await writeJsonl(path.join(outputDir, "question_audit.jsonl"), questionAudit);
await fs.writeFile(path.join(outputDir, "raw_model_output.txt"), rawModelOutput);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(budgetPath, `${JSON.stringify({
  max_budget_usd: maxBudgetUsd,
  ledger_spend_usd: actualSpend,
  remaining_budget_usd: Math.max(0, maxBudgetUsd - actualSpend),
  ledger_path: path.relative(rootDir, ledgerPath),
  last_updated: new Date().toISOString(),
}, null, 2)}\n`);

console.log(JSON.stringify({ run_id: result.run_id, status: result.status, run_cost_usd: result.run_cost_usd, aggregate: result.aggregate }, null, 2));

function buildApiRequest(examples, selectedModel, outputTokens) {
  return {
    model: selectedModel,
    temperature: 0.2,
    max_tokens: outputTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You write natural user questions for a citation-grounded QA benchmark over changing product/architecture docs.",
          "You must not answer the questions.",
          "Use only the supplied target claim and context.",
          "Do not quote long spans from the target claim.",
          "Do not mention line numbers, commit ids, citation ids, train snapshots, eval snapshots, stale snapshots, or the phrase 'line beginning'.",
          "Do not mention older KB state, current KB state, knowledge base state, version history, or whether evidence appears later.",
          "Questions should sound like something an engineer, PM, or researcher would ask about the system.",
          "Return only JSON: {\"questions\":[{\"id\":\"...\",\"natural_question\":\"...\",\"rationale\":\"...\"}]}",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Rewrite each deterministic line-probe question into a natural question. Preserve the information need. For abstention cases, write a natural question that should be asked against the older KB state, without revealing that the answer appears only later.",
          examples: examples.map((example) => ({
            id: example.id,
            example_type: example.example_type,
            document_path: example.input.document_metadata?.document_path,
            target_claim: example.output.claim_table?.[0]?.claim ?? example.output.answer,
            original_question: example.input.question,
            nearby_evidence: (example.input.compact_retrieved_evidence_pack ?? []).map((row) => row.text).slice(0, 3),
          })),
        }),
      },
    ],
  };
}

function normalizeAuthoredQuestions(value, examples) {
  const byId = new Set(examples.map((example) => example.id));
  const rows = Array.isArray(value?.questions) ? value.questions : [];
  return rows
    .filter((row) => byId.has(row.id))
    .map((row) => ({
      id: row.id,
      natural_question: cleanQuestion(row.natural_question),
      rationale: String(row.rationale ?? "").slice(0, 500),
    }))
    .filter((row) => row.natural_question);
}

function heuristicQuestion(example) {
  const doc = basename(example.input.document_metadata?.document_path ?? "the documentation");
  if (example.example_type === "stale_snapshot_abstention") {
    return `What does ${doc} say about this recently changed system behavior?`;
  }
  return `What does ${doc} say about the relevant system behavior?`;
}

function cleanQuestion(value) {
  let text = String(value ?? "").replace(/\s+/g, " ").trim();
  text = text.replace(/\b(train|eval|stale)\s+snapshot\b/gi, "current documentation");
  text = text.replace(/\b(older|current|previous|later)\s+KB state\b/gi, "available documentation");
  text = text.replace(/\bknowledge base state\b/gi, "documentation");
  text = text.replace(/\bline beginning\b/gi, "part");
  text = text.replace(/[`"]/g, "");
  if (text && !/[?.!]$/.test(text)) text += "?";
  return text.slice(0, 280);
}

function auditQuestion(example) {
  const question = String(example.input?.question ?? "");
  const targetClaim = String(example.output?.claim_table?.[0]?.claim ?? example.output?.answer ?? "");
  return {
    id: example.id,
    example_type: example.example_type,
    question,
    template_question: /^(In both KB snapshots|According to the eval KB snapshot|According to the train KB snapshot),/.test(question),
    prefix_leakage: /line beginning "/.test(question) || longestCommonRun(question, targetClaim) >= 8,
    snapshot_label_in_question: /\b(train|eval|stale) (KB )?snapshot\b/i.test(question) || /\b(older|current|previous|later)\s+KB state\b/i.test(question) || /\bknowledge base state\b/i.test(question),
    synthesis_question: /\b(compare|why|how|relationship|tradeoff|trend|summari[sz]e|across)\b/i.test(question),
    target_claim_longest_common_word_run: longestCommonRun(question, targetClaim),
  };
}

function summarize(rows) {
  return {
    examples: rows.length,
    template_question_rate: ratio(rows.filter((row) => row.template_question).length, rows.length),
    prefix_leakage_rate: ratio(rows.filter((row) => row.prefix_leakage).length, rows.length),
    snapshot_label_rate: ratio(rows.filter((row) => row.snapshot_label_in_question).length, rows.length),
    synthesis_question_rate: ratio(rows.filter((row) => row.synthesis_question).length, rows.length),
    by_type: Object.fromEntries([...new Set(rows.map((row) => row.example_type))].sort().map((type) => {
      const subset = rows.filter((row) => row.example_type === type);
      return [type, {
        examples: subset.length,
        template_question_rate: ratio(subset.filter((row) => row.template_question).length, subset.length),
        prefix_leakage_rate: ratio(subset.filter((row) => row.prefix_leakage).length, subset.length),
        snapshot_label_rate: ratio(subset.filter((row) => row.snapshot_label_in_question).length, subset.length),
        synthesis_question_rate: ratio(subset.filter((row) => row.synthesis_question).length, subset.length),
      }];
    })),
  };
}

function renderReport(result) {
  return `# Versioned KB Natural Question Generation

Generated: ${result.generated_at}

Status: \`${result.status}\`

Model: \`${result.model}\`

| Examples | API calls | Run cost | Ledger before | Ledger after |
| ---: | ---: | ---: | ---: | ---: |
| ${result.examples_written} | ${result.llm_budget.openai_llm_calls} | $${result.run_cost_usd.toFixed(6)} | $${result.ledger_spend_before_usd.toFixed(6)} | $${result.ledger_spend_after_usd.toFixed(6)} |

## Naturalness

- Template question rate: ${pct(result.aggregate.template_question_rate)}
- Prefix leakage rate: ${pct(result.aggregate.prefix_leakage_rate)}
- Snapshot-label rate: ${pct(result.aggregate.snapshot_label_rate)}
- Synthesis-question rate: ${pct(result.aggregate.synthesis_question_rate)}

## Claim Boundary

${result.claim_boundary.reason}
`;
}

function estimateCall(apiRequest, selectedPrice, outputTokens) {
  const estimatedInputTokens = Math.ceil(JSON.stringify(apiRequest.messages).length / 4);
  return {
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: outputTokens,
    estimated_cost_usd: callCost(estimatedInputTokens, outputTokens, selectedPrice),
  };
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

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return { questions: [] };
  }
}

function longestCommonRun(left, right) {
  const leftWords = words(left);
  const rightWords = words(right);
  let best = 0;
  for (let i = 0; i < leftWords.length; i += 1) {
    for (let j = 0; j < rightWords.length; j += 1) {
      let run = 0;
      while (leftWords[i + run] && leftWords[i + run] === rightWords[j + run]) run += 1;
      if (run > best) best = run;
    }
  }
  return best;
}

function words(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((word) => word.length > 2);
}

function basename(value) {
  return String(value).split("/").pop() || value;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
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
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
