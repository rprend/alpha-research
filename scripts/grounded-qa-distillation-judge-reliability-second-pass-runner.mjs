import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const ledgerDir = path.join(experimentDir, "llm-calls");
const args = parseArgs(process.argv.slice(2));

const planRunId = args["plan-run-id"] ?? "judge-reliability-second-pass-plan-2026-06-26-v1";
const runId = args["run-id"] ?? "judge-reliability-second-pass-run-2026-06-26-v1";
const model = args.model ?? "gpt-4o-mini";
const dryRun = args["dry-run"] === "true" || args.dryRun === "true";
const maxBudgetUsd = Number(args["max-budget-usd"] ?? 100);
const maxOutputTokens = numberArg(args["max-output-tokens"], 420);
const limit = numberArg(args.limit, Number.POSITIVE_INFINITY);
const offset = nonNegativeNumberArg(args.offset, 0);

const prices = {
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.60, source: "https://developers.openai.com/api/docs/models/gpt-4o-mini" },
  "gpt-4o": { inputPerMillion: 2.50, outputPerMillion: 10.00, source: "https://developers.openai.com/api/docs/models/gpt-4o" },
};
const price = prices[model];
if (!price) throw new Error(`Unsupported second-pass judge model ${model}.`);

const planDir = path.join(runDir, planRunId);
const outputDir = path.join(runDir, runId);
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const budgetPath = path.join(ledgerDir, "budget.json");
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(ledgerDir, { recursive: true });

const plan = await readJson(path.join(planDir, "result.json"));
const requests = (await readJsonl(path.join(planDir, "second_pass_requests.jsonl"))).slice(offset, offset + limit);
const originalPacket = await readJsonl(path.join(runDir, plan.source_packet_run_id, "adjudication_packet.jsonl"));
const originalVerdicts = new Map();
for (const row of originalPacket) {
  for (let index = 0; index < row.cases.length; index += 1) {
    const caseId = `${row.packet_id}-case-${String(index + 1).padStart(2, "0")}`;
    originalVerdicts.set(caseId, {
      packet_id: row.packet_id,
      case_id: caseId,
      audit_type: row.audit_type,
      policy: row.cases[index].policy,
      original_verdict: row.cases[index].judge_verdict?.verdict ?? "invalid",
      original_citation_valid: row.cases[index].judge_verdict?.citation_ids_valid ?? null,
      original_abstention_supported: row.cases[index].judge_verdict?.abstention_supported ?? null,
    });
  }
}

const plannedCalls = requests.reduce((total, row) => total + row.cases.length, 0);
const estimates = [];
for (const request of requests) {
  for (const caseItem of request.cases) estimates.push(estimateCaseCall(request, caseItem, price, maxOutputTokens));
}
const estimatedCost = sum(estimates.map((row) => row.estimated_cost_usd));
const priorSpend = await ledgerSpend(ledgerPath);
if (priorSpend + estimatedCost > maxBudgetUsd) {
  throw new Error(`Refusing second-pass run: current ledger $${priorSpend.toFixed(6)} + estimated $${estimatedCost.toFixed(6)} exceeds max budget $${maxBudgetUsd.toFixed(2)}.`);
}

const results = [];
if (dryRun || !process.env.OPENAI_API_KEY) {
  const reason = dryRun ? "dry-run requested" : "OPENAI_API_KEY missing";
  for (const request of requests) {
    for (const caseItem of request.cases) {
      const estimate = estimateCaseCall(request, caseItem, price, maxOutputTokens);
      results.push({
        packet_id: request.packet_id,
        case_id: caseItem.case_id,
        audit_type: request.audit_type,
        policy: caseItem.policy,
        model,
        skipped: true,
        skip_reason: reason,
        estimated_input_tokens: estimate.estimated_input_tokens,
        estimated_output_tokens: estimate.estimated_output_tokens,
        estimated_cost_usd: estimate.estimated_cost_usd,
      });
    }
  }
} else {
  for (const request of requests) {
    for (const caseItem of request.cases) {
      const apiRequest = buildApiRequest(request, caseItem, model, maxOutputTokens);
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
        throw new Error(`OpenAI second-pass judge failed for ${caseItem.case_id}: ${response.status} ${JSON.stringify(payload).slice(0, 500)}`);
      }
      const judgment = normalizeSecondPassJudgment(parseJson(payload.choices?.[0]?.message?.content ?? ""));
      const usage = payload.usage ?? {};
      const cost = callCost(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0, price);
      await appendLedger(ledgerPath, {
        ts: new Date().toISOString(),
        provider: "openai",
        model,
        task: "grounded_qa_blind_second_pass_judge",
        run_id: runId,
        plan_run_id: planRunId,
        example_id: caseItem.case_id,
        packet_id: request.packet_id,
        case_id: caseItem.case_id,
        audit_type: request.audit_type,
        policy: caseItem.policy,
        prompt_tokens: usage.prompt_tokens ?? null,
        completion_tokens: usage.completion_tokens ?? null,
        total_tokens: usage.total_tokens ?? null,
        cost_usd: cost,
        price_source: price.source,
      });
      results.push({
        packet_id: request.packet_id,
        case_id: caseItem.case_id,
        audit_type: request.audit_type,
        policy: caseItem.policy,
        model,
        prediction_answer_type: caseItem.prediction_answer_type,
        judgment,
        verdict_compatible_with_prediction_type: verdictCompatible(caseItem.prediction_answer_type, judgment.verdict),
        usage,
        cost_usd: cost,
        original_verdict: originalVerdicts.get(caseItem.case_id)?.original_verdict ?? null,
      });
    }
  }
}

const actualSpend = await ledgerSpend(ledgerPath);
const agreement = computeAgreement(results, originalVerdicts);
const summary = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "judge_reliability_second_pass_run",
  status: dryRun || !process.env.OPENAI_API_KEY ? "dry_run_or_key_missing" : "second_pass_complete",
  plan_run_id: planRunId,
  source_packet_run_id: plan.source_packet_run_id,
  model,
  dry_run: dryRun,
  request_rows: requests.length,
  planned_calls: plannedCalls,
  calls_made: results.filter((row) => !row.skipped).length,
  calls_skipped: results.filter((row) => row.skipped).length,
  estimated_cost_usd: estimatedCost,
  run_cost_usd: sum(results.map((row) => Number(row.cost_usd ?? 0))),
  ledger_spend_before_usd: priorSpend,
  ledger_spend_after_usd: actualSpend,
  max_budget_usd: maxBudgetUsd,
  price,
  agreement,
  schema_violations: results.filter((row) => !row.skipped && row.verdict_compatible_with_prediction_type === false).length,
  llm_budget: {
    openai_llm_calls: results.filter((row) => !row.skipped).length,
    openai_cost_usd: sum(results.map((row) => Number(row.cost_usd ?? 0))),
    external_compute_cost_usd: 0,
    note: "Actual OpenAI calls and costs are also recorded in docs/experiments/grounded-qa-distillation/llm-calls/ledger.jsonl.",
  },
};

await writeJsonl(path.join(outputDir, "second_pass_results.jsonl"), results);
await fs.writeFile(path.join(outputDir, "agreement_report.md"), renderAgreementReport(summary));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(budgetPath, `${JSON.stringify({
  max_budget_usd: maxBudgetUsd,
  ledger_spend_usd: actualSpend,
  remaining_budget_usd: Math.max(0, maxBudgetUsd - actualSpend),
  ledger_path: path.relative(rootDir, ledgerPath),
  last_updated: new Date().toISOString(),
}, null, 2)}\n`);

console.log(JSON.stringify({ result: path.relative(rootDir, path.join(outputDir, "result.json")), summary }, null, 2));

function buildApiRequest(request, caseItem, selectedModel, outputTokens) {
  return {
    model: selectedModel,
    temperature: 0,
    max_tokens: outputTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are a blind second-pass adjudicator for citation-grounded QA.",
          "Use only the supplied question, evidence pack, and prediction.",
          "Do not use outside knowledge.",
          "For answered predictions, decide whether every factual claim is directly supported by the cited evidence ids.",
          "For abstentions, decide whether the evidence pack is insufficient to answer the question.",
          "Return only valid JSON with keys: verdict, citation_verdict, abstention_verdict, rationale.",
          "verdict must be exactly supported, partial, unsupported, correct_abstention, incorrect_abstention, or invalid.",
          "If Prediction answer_type is grounded_answer, verdict must be supported, partial, unsupported, or invalid; never use an abstention verdict.",
          "If Prediction answer_type is abstain, verdict must be correct_abstention, incorrect_abstention, or invalid; never use supported, partial, or unsupported.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Question: ${request.question}`,
          "Evidence pack:",
          request.compact_retrieved_evidence_pack.map(formatEvidence).join("\n\n"),
          "",
          `Prediction answer_type: ${caseItem.prediction_answer_type}`,
          `Prediction: ${JSON.stringify(caseItem.prediction)}`,
          "",
          "Judge strictly. A citation is valid only if its id appears in the supplied evidence. A claim is supported only if the cited text directly entails it.",
        ].join("\n"),
      },
    ],
  };
}

function estimateCaseCall(request, caseItem, selectedPrice, outputTokens) {
  const apiRequest = buildApiRequest(request, caseItem, model, outputTokens);
  const estimatedInputTokens = Math.ceil(JSON.stringify(apiRequest.messages).length / 4);
  return {
    packet_id: request.packet_id,
    case_id: caseItem.case_id,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: outputTokens,
    estimated_cost_usd: callCost(estimatedInputTokens, outputTokens, selectedPrice),
  };
}

function computeAgreement(rows, originals) {
  const judged = rows.filter((row) => !row.skipped);
  const compared = judged.map((row) => ({ row, original: originals.get(row.case_id) })).filter((item) => item.original);
  const exact = compared.filter(({ row, original }) => row.judgment.verdict === original.original_verdict);
  const byAuditType = {};
  for (const { row, original } of compared) {
    const bucket = byAuditType[row.audit_type] ?? {
      examples: 0,
      exact_agreements: 0,
      second_supported: 0,
      second_unsupported_or_partial: 0,
      second_correct_abstention: 0,
      original_supported: 0,
    };
    bucket.examples += 1;
    if (row.judgment.verdict === original.original_verdict) bucket.exact_agreements += 1;
    if (row.judgment.verdict === "supported") bucket.second_supported += 1;
    if (["partial", "unsupported"].includes(row.judgment.verdict)) bucket.second_unsupported_or_partial += 1;
    if (row.judgment.verdict === "correct_abstention") bucket.second_correct_abstention += 1;
    if (original.original_verdict === "supported") bucket.original_supported += 1;
    byAuditType[row.audit_type] = bucket;
  }
  for (const bucket of Object.values(byAuditType)) {
    bucket.exact_agreement_rate = bucket.examples ? bucket.exact_agreements / bucket.examples : 0;
  }
  return {
    compared_cases: compared.length,
    exact_agreements: exact.length,
    exact_agreement_rate: compared.length ? exact.length / compared.length : 0,
    by_audit_type: byAuditType,
    disagreements: compared
      .filter(({ row, original }) => row.judgment.verdict !== original.original_verdict)
      .slice(0, 12)
      .map(({ row, original }) => ({
        packet_id: row.packet_id,
        case_id: row.case_id,
        audit_type: row.audit_type,
        policy: row.policy,
        original_verdict: original.original_verdict,
        second_pass_verdict: row.judgment.verdict,
        rationale: row.judgment.rationale,
      })),
  };
}

function verdictCompatible(predictionAnswerType, verdict) {
  if (predictionAnswerType === "abstain") {
    return ["correct_abstention", "incorrect_abstention", "invalid"].includes(verdict);
  }
  return ["supported", "partial", "unsupported", "invalid"].includes(verdict);
}

function renderAgreementReport(summary) {
  return `# Judge Reliability Second-Pass Run

Generated: ${summary.generated_at}

Status: \`${summary.status}\`

Model: \`${summary.model}\`

| Planned calls | Calls made | Run cost | Ledger before | Ledger after |
| ---: | ---: | ---: | ---: | ---: |
| ${summary.planned_calls} | ${summary.calls_made} | $${summary.run_cost_usd.toFixed(6)} | $${summary.ledger_spend_before_usd.toFixed(6)} | $${summary.ledger_spend_after_usd.toFixed(6)} |

## Agreement

- Compared cases: ${summary.agreement.compared_cases}
- Exact agreements: ${summary.agreement.exact_agreements}
- Exact agreement rate: ${pct(summary.agreement.exact_agreement_rate)}
- Schema-incompatible verdicts: ${summary.schema_violations}

## Agreement By Audit Type

| Audit type | Cases | Exact agreement | Exact agreement rate |
| --- | ---: | ---: | ---: |
${Object.entries(summary.agreement.by_audit_type).map(([type, row]) => `| ${type} | ${row.examples} | ${row.exact_agreements} | ${pct(row.exact_agreement_rate)} |`).join("\n")}

## Sample Disagreements

${summary.agreement.disagreements.length ? summary.agreement.disagreements.map((row) => `- \`${row.case_id}\` (${row.audit_type}, ${row.policy}): original=${row.original_verdict}, second_pass=${row.second_pass_verdict}; ${row.rationale}`).join("\n") : "No disagreements among compared cases."}
`;
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
      citation_verdict: "invalid",
      abstention_verdict: "not_applicable",
      rationale: String(content).slice(0, 500),
    };
  }
}

function normalizeSecondPassJudgment(value) {
  const verdicts = new Set(["supported", "partial", "unsupported", "correct_abstention", "incorrect_abstention", "invalid"]);
  const citationVerdicts = new Set(["valid", "invalid", "not_applicable"]);
  const abstentionVerdicts = new Set(["sufficient_to_answer", "insufficient_evidence", "not_applicable"]);
  const verdict = verdicts.has(String(value.verdict)) ? String(value.verdict) : "invalid";
  const citation_verdict = citationVerdicts.has(String(value.citation_verdict)) ? String(value.citation_verdict) : "invalid";
  const abstention_verdict = abstentionVerdicts.has(String(value.abstention_verdict)) ? String(value.abstention_verdict) : "not_applicable";
  return {
    verdict,
    citation_verdict,
    abstention_verdict,
    rationale: String(value.rationale ?? ""),
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
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function pct(value) {
  return `${(100 * Number(value || 0)).toFixed(1)}%`;
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
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
