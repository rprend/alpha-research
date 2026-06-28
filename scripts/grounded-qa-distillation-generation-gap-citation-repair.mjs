import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourceRunId = args["source-run"] ?? "generation-gap-qwen3b-sft-dpo-smoke-d321-v1";
const runId = args["run-id"] ?? `generation-gap-citation-repair-${sourceRunId}`;
const outputDir = path.join(runsDir, runId);
const sourceDir = path.join(runsDir, sourceRunId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceResult = await readJson(path.join(sourceDir, "result.json"));
const sourceRows = await readJsonl(path.join(sourceDir, "predictions.jsonl"));
const repairedRows = sourceRows.map(repairRow);
const summary = summarize(sourceRows, repairedRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "generation_gap_citation_contract_repair",
  status: "citation_contract_repair_ready_for_shape_eval",
  purpose: "Apply a zero-call local citation-surface repair to D321 generation-gap model predictions before D322 shape scoring.",
  source_run_id: sourceRunId,
  source_model_family: sourceResult.model_family ?? null,
  source_eval: sourceResult.eval ?? null,
  repair_policy: {
    name: "inline_existing_citations_only",
    changes_answer_decision: false,
    uses_final_diagnostic_targets: false,
    allowed_actions: [
      "normalize citation strings such as [E2] to E2",
      "drop citation ids not present in the source evidence pack when metadata is available",
      "append existing citation ids inline to grounded answers",
      "normalize claim_table citation arrays"
    ],
    forbidden_actions: [
      "use diagnostic target answers or citations",
      "change a grounded answer to an abstention",
      "replace answer text with oracle/reference text"
    ]
  },
  summary,
  decision: {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    next_step: "Run the D322 generation-gap shape harness on repaired_predictions.jsonl. Only consider paid judging if the shape gate passes.",
    reason: "This repair only tests citation-surface headroom; it is not a grounded-correctness result."
  },
  leakage_guard: {
    final_targets_used_for_repair: false,
    final_targets_used_for_model_selection: false,
    source_predictions_only: true
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "Local JSON/citation normalization only."
  }
};

await writeJsonl(path.join(outputDir, "repaired_predictions.jsonl"), repairedRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  source_run_id: result.source_run_id,
  summary: result.summary,
  decision: result.decision,
  llm_budget: result.llm_budget
}, null, 2));

function repairRow(row) {
  const prediction = normalizePrediction(row.prediction ?? {});
  const evidenceIds = evidenceIdsFor(row);
  if (prediction.answer_type === "grounded_answer") {
    prediction.citations = normalizeCitations(prediction.citations).filter((id) => !evidenceIds.size || evidenceIds.has(id));
    prediction.answer = canonicalizeShortAnswer(prediction.answer);
    prediction.answer = ensureInlineCitations(prediction.answer, prediction.citations);
    prediction.claim_table = normalizeClaimTable(prediction.claim_table, prediction.citations);
    prediction.abstention_reason = null;
  } else {
    prediction.answer = prediction.answer || "The evidence pack does not contain enough support to answer this question.";
    prediction.citations = [];
    prediction.claim_table = [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }];
    prediction.abstention_reason = prediction.abstention_reason || "Evidence is insufficient.";
  }
  return {
    example_id: row.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    repair_metadata: {
      source_run_id: sourceRunId,
      repair_policy: "inline_existing_citations_only",
      source_raw_output: row.raw_output ?? row.raw_content ?? null,
      source_prediction: row.prediction ?? null
    }
  };
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  return {
    answer_type: answerType,
    answer: stringifyAnswer(value.answer),
    citations: Array.isArray(value.citations) ? value.citations : [],
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: value.abstention_reason ?? null
  };
}

function stringifyAnswer(value) {
  if (Array.isArray(value)) return value.map((item) => String(item)).join("; ");
  if (value == null) return "";
  return String(value);
}

function canonicalizeShortAnswer(answer) {
  const text = String(answer ?? "").trim();
  if (/^yes\.?$/i.test(text)) return "Yes.";
  if (/^no\.?$/i.test(text)) return "No.";
  return text;
}

function evidenceIdsFor(row) {
  const items = row.input?.compact_retrieved_evidence_pack ?? row.prompt?.input?.compact_retrieved_evidence_pack ?? [];
  return new Set(items.map((item) => item.evidence_id).filter(Boolean));
}

function normalizeCitations(citations) {
  const values = Array.isArray(citations) ? citations : citations == null ? [] : [citations];
  return [...new Set(values.map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean))];
}

function ensureInlineCitations(answer, citations) {
  const text = String(answer ?? "").trim();
  if (!citations.length) return text;
  const missing = citations.filter((id) => !text.includes(`[${id}]`));
  if (!missing.length) return text;
  return `${text}${text ? " " : ""}${missing.map((id) => `[${id}]`).join(" ")}`.trim();
}

function normalizeClaimTable(claimTable, citations) {
  if (!claimTable.length) {
    return [{ claim: "Model answer.", support: "model_predicted", citations }];
  }
  return claimTable.map((claim) => {
    const claimCitations = normalizeCitations(claim.citations ?? claim.citation ?? claim.evidence ?? claim.supporting_evidence ?? citations);
    return {
      claim: String(claim.claim ?? claim.answer ?? "Model answer."),
      support: String(claim.support ?? "model_predicted"),
      citations: claimCitations.length ? claimCitations : citations
    };
  });
}

function summarize(sourceRows, repairedRows) {
  const beforeGrounded = sourceRows.filter((row) => row.prediction?.answer_type !== "abstain");
  const afterGrounded = repairedRows.filter((row) => row.prediction?.answer_type === "grounded_answer");
  return {
    examples: repairedRows.length,
    source_answered: beforeGrounded.length,
    repaired_answered: afterGrounded.length,
    source_inline_complete_answers: beforeGrounded.filter((row) => inlineComplete(row.prediction)).length,
    repaired_inline_complete_answers: afterGrounded.filter((row) => inlineComplete(row.prediction)).length,
    citations_changed_rows: repairedRows.filter((row, index) => JSON.stringify(row.prediction.citations) !== JSON.stringify(sourceRows[index].prediction?.citations ?? [])).length,
    answer_decision_changed_rows: repairedRows.filter((row, index) => row.prediction.answer_type !== (sourceRows[index].prediction?.answer_type ?? "grounded_answer")).length
  };
}

function inlineComplete(prediction) {
  if (!prediction || prediction.answer_type !== "grounded_answer") return false;
  const citations = normalizeCitations(prediction.citations ?? []);
  return citations.length > 0 && citations.every((id) => String(prediction.answer ?? "").includes(`[${id}]`));
}

function renderReport(result) {
  return `# Generation-Gap Citation Contract Repair

Status: \`${result.status}\`

Source run: \`${result.source_run_id}\`

This run makes no OpenAI calls and launches no Prime job.

## Summary

| Examples | Source answered | Repaired answered | Source inline-complete | Repaired inline-complete | Citation rows changed | Answer decisions changed |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.summary.examples} | ${result.summary.source_answered} | ${result.summary.repaired_answered} | ${result.summary.source_inline_complete_answers} | ${result.summary.repaired_inline_complete_answers} | ${result.summary.citations_changed_rows} | ${result.summary.answer_decision_changed_rows} |

## Decision

- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
