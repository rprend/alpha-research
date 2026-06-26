import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const packetRunId = args["packet-run-id"] ?? "judge-adjudication-packet-2026-06-26-v1";
const runId = args["run-id"] ?? "judge-reliability-second-pass-plan-2026-06-26-v1";
const model = args.model ?? "gpt-4o-mini";
const outputTokens = numberArg(args["max-output-tokens"], 420);
const outputDir = path.join(runDir, runId);

const prices = {
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10, source: "local-project-pricing-table" },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6, source: "local-project-pricing-table" },
};
const price = prices[model];
if (!price) throw new Error(`Unsupported second-pass judge model ${model}.`);

await fs.mkdir(outputDir, { recursive: true });

const packetResult = await readJson(path.join(runDir, packetRunId, "result.json"));
const packetRows = await readJsonl(path.join(runDir, packetRunId, "adjudication_packet.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const requests = packetRows.map((row) => buildBlindRequest(row));
const estimateRows = requests.map((row) => estimateRequestCost(row, price, outputTokens));
const estimatedCostUsd = sum(estimateRows.map((row) => row.estimated_cost_usd));
const currentSpend = Number(budget.spend_usd.total_actual);
const maxBudget = Number(budget.max_budget_usd);
const answerTypeCounts = countBy(requests.flatMap((row) => row.cases.map((item) => item.prediction_answer_type)), (value) => value);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "judge_reliability_second_pass_plan",
  status: "second_pass_requests_ready_not_run",
  purpose: "Create a blind second-pass adjudication request set from hard judge-calibration rows so model-judge reliability can be measured before treating support metrics as paper-grade.",
  source_packet_run_id: packetResult.run_id,
  source_packet_rows: packetResult.adjudication_rows,
  request_rows: requests.length,
  blind_protocol: {
    hides_original_judge_verdict: true,
    includes_reference_output: true,
    instruction: "Judge only from the compact evidence pack. Do not use outside paper knowledge. Return supported/partial/unsupported/correct_abstention/incorrect_abstention/invalid plus citation validity and a concise rationale.",
    comparison_after_completion: "Join second-pass verdicts back to the original adjudication packet by packet_id and policy, then report agreement by audit_type and disagreement examples.",
  },
  audit_types: countBy(requests, (row) => row.audit_type),
  prediction_answer_types: answerTypeCounts,
  planned_second_pass_judge: {
    model,
    max_output_tokens: outputTokens,
    estimated_calls: requests.reduce((total, row) => total + row.cases.length, 0),
    estimated_cost_usd: estimatedCostUsd,
    price,
    dry_run_request_path: path.relative(rootDir, path.join(outputDir, "second_pass_requests.jsonl")),
  },
  budget_gate: {
    max_budget_usd: maxBudget,
    current_actual_spend_usd: currentSpend,
    remaining_budget_usd: Number(budget.spend_usd.remaining),
    estimated_second_pass_cost_usd: estimatedCostUsd,
    estimated_total_after_second_pass_usd: currentSpend + estimatedCostUsd,
    within_budget: currentSpend + estimatedCostUsd <= maxBudget,
  },
  required_completion_artifacts: [
    "second_pass_results.jsonl with one result per packet_id/case_id",
    "agreement_report.md with original-vs-second-pass agreement by audit_type",
    "updated manuscript/risk-audit treatment of model-judged metrics",
  ],
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This artifact only prepares blind requests and a budget estimate; it does not run the second-pass judge.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "second_pass_requests.jsonl"), `${requests.map((row) => JSON.stringify(row)).join("\n")}\n`);
await fs.writeFile(path.join(outputDir, "cost_estimate.jsonl"), `${estimateRows.map((row) => JSON.stringify(row)).join("\n")}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function buildBlindRequest(row) {
  return {
    packet_id: row.packet_id,
    audit_type: row.audit_type,
    example_id: row.example_id,
    question: row.question,
    document_metadata: row.document_metadata,
    compact_retrieved_evidence_pack: row.compact_retrieved_evidence_pack,
    reference_output: {
      answer_type: row.reference_output?.answer_type ?? null,
      answer: row.reference_output?.answer ?? null,
      citations: row.reference_output?.citations ?? [],
      abstention_reason: row.reference_output?.abstention_reason ?? null,
    },
    cases: row.cases.map((item, index) => ({
      case_id: `${row.packet_id}-case-${String(index + 1).padStart(2, "0")}`,
      policy: item.policy,
      prediction_answer_type: item.prediction_answer_type,
      prediction: item.prediction,
      original_judge_verdict_hidden: true,
    })),
    response_schema: {
      packet_id: row.packet_id,
      case_id: "string",
      verdict: "supported | partial | unsupported | correct_abstention | incorrect_abstention | invalid",
      citation_verdict: "valid | invalid | not_applicable",
      abstention_verdict: "sufficient_to_answer | insufficient_evidence | not_applicable",
      rationale: "short evidence-grounded explanation",
    },
  };
}

function estimateRequestCost(row, selectedPrice, maxOutputTokens) {
  const serialized = JSON.stringify({
    instruction: "Blind second-pass grounded QA support adjudication.",
    question: row.question,
    evidence: row.compact_retrieved_evidence_pack,
    reference_output: row.reference_output,
    cases: row.cases,
    response_schema: row.response_schema,
  });
  const estimatedInputTokens = Math.ceil(serialized.length / 4);
  const estimatedOutputTokens = maxOutputTokens * row.cases.length;
  return {
    packet_id: row.packet_id,
    cases: row.cases.length,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: estimatedOutputTokens,
    estimated_cost_usd: (estimatedInputTokens / 1_000_000) * selectedPrice.inputPerMillion + (estimatedOutputTokens / 1_000_000) * selectedPrice.outputPerMillion,
  };
}

function renderReport(result) {
  return `# Judge Reliability Second-Pass Plan

Generated: ${result.generated_at}

Status: \`${result.status}\`

Source packet: \`${result.source_packet_run_id}\`

## Blind Protocol

- Original judge verdict hidden: ${result.blind_protocol.hides_original_judge_verdict ? "yes" : "no"}
- Request rows: ${result.request_rows}
- Estimated second-pass calls: ${result.planned_second_pass_judge.estimated_calls}
- Planned model: \`${result.planned_second_pass_judge.model}\`

## Budget Gate

| Current actual spend | Estimated second-pass cost | Estimated total after second pass | Within $${result.budget_gate.max_budget_usd} cap |
| ---: | ---: | ---: | --- |
| $${result.budget_gate.current_actual_spend_usd.toFixed(6)} | $${result.budget_gate.estimated_second_pass_cost_usd.toFixed(6)} | $${result.budget_gate.estimated_total_after_second_pass_usd.toFixed(6)} | ${result.budget_gate.within_budget ? "yes" : "no"} |

## Audit Types

${Object.entries(result.audit_types).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

## Required Completion Artifacts

${result.required_completion_artifacts.map((item) => `- ${item}`).join("\n")}

This plan makes no OpenAI calls, launches no GPU jobs, and records no new spend.
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function countBy(rows, fn) {
  const counts = {};
  for (const row of rows) {
    const key = fn(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
