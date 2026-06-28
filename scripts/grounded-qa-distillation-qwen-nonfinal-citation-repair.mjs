import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const sourceRunId = args["source-run"];
if (!sourceRunId) throw new Error("Missing --source-run=<run-id>.");
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen7b-nonfinal-frontier-candidates-v1";
const runId = args["run-id"] ?? `${sourceRunId}-citation-repair`;
const sourceDir = path.join(runsDir, sourceRunId);
const packetDir = path.join(runsDir, packetRunId);
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const sourceResult = await readJson(path.join(sourceDir, "result.json"));
const sourceRows = await readJsonl(path.join(sourceDir, "predictions.jsonl"));
const evalRows = await readJsonl(path.join(packetDir, "dataset", "eval_prompts.jsonl"));
const evalById = new Map(evalRows.map((row) => [row.example_id, row]));

const predictions = sourceRows.map((row) => {
  const sourcePrediction = normalizePrediction(row.prediction ?? {});
  const evalRow = evalById.get(row.root_example_id ?? row.example_id);
  const validEvidenceIds = evidenceIdsForRow(evalRow);
  const repaired = repairPrediction(sourcePrediction, validEvidenceIds);
  return {
    example_id: row.example_id,
    root_example_id: row.root_example_id ?? row.example_id,
    sample_index: row.sample_index ?? null,
    source_run_id: sourceRunId,
    prediction: repaired.prediction,
    source_prediction: sourcePrediction,
    reference: row.reference,
    scores: scorePrediction(row.reference, repaired.prediction),
    source_scores: row.scores,
    metadata: {
      scaffold: "qwen_nonfinal_citation_repair",
      base_model: sourceResult.base_model,
      adapter_dir: sourceResult.adapter_dir ?? null,
      missing_inline_before: repaired.missingInlineBefore,
      repaired_inline_citations: repaired.repairedInlineCitations,
      invalid_citations_dropped: repaired.invalidCitationsDropped,
      answer_changed: repaired.prediction.answer !== sourcePrediction.answer,
      nonfinal_candidate_generation: true,
    },
    raw_output: row.raw_output ?? "",
    parse_error: null,
  };
});

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen_nonfinal_citation_contract_repair",
  source_run_id: sourceRunId,
  packet_run_id: packetRunId,
  base_model: sourceResult.base_model,
  adapter_dir: sourceResult.adapter_dir ?? null,
  eval: summarize(predictions),
  source_eval: sourceResult.eval,
  repair_summary: {
    answered: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    rows_changed: predictions.filter((row) => row.metadata.answer_changed).length,
    missing_inline_citations_before: sum(predictions.map((row) => row.metadata.missing_inline_before)),
    repaired_inline_citations: sum(predictions.map((row) => row.metadata.repaired_inline_citations)),
    invalid_citations_dropped: sum(predictions.map((row) => row.metadata.invalid_citations_dropped)),
    parse_errors_cleared: sourceRows.filter((row) => row.parse_error).length,
  },
  interpretation: {
    finding: "Deterministic repair makes non-final Qwen candidates judgeable by normalizing citations and appending missing inline citation ids.",
    limitation: "This does not change answer content, answer/abstain decisions, or grounded support; paid support judging is still required before using rows as verifier supervision.",
  },
  cost: {
    openai_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "Local deterministic citation-string repair only.",
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), predictions);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  source_run_id: result.source_run_id,
  eval: result.eval,
  repair_summary: result.repair_summary,
}, null, 2));

function repairPrediction(prediction, validEvidenceIds) {
  if (prediction.answer_type !== "grounded_answer") {
    return {
      prediction: { ...prediction, citations: [] },
      missingInlineBefore: 0,
      repairedInlineCitations: 0,
      invalidCitationsDropped: 0,
    };
  }
  const normalized = [...new Set((prediction.citations ?? []).map(normalizeCitationId).filter(Boolean))];
  const citations = normalized.filter((id) => validEvidenceIds.size === 0 || validEvidenceIds.has(id));
  const invalidCitationsDropped = normalized.length - citations.length;
  const answer = String(prediction.answer ?? "").trim();
  const missing = citations.filter((id) => !answer.includes(`[${id}]`));
  return {
    prediction: {
      ...prediction,
      citations,
      answer: missing.length ? `${answer} ${missing.map((id) => `[${id}]`).join(" ")}`.trim() : answer,
    },
    missingInlineBefore: missing.length,
    repairedInlineCitations: missing.length,
    invalidCitationsDropped,
  };
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).map(normalizeCitationId).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : citations,
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? "") : null,
  };
}

function normalizeCitationId(value) {
  return String(value ?? "").trim().replace(/^\[+/, "").replace(/\]+$/, "");
}

function evidenceIdsForRow(row) {
  return new Set((row?.input?.compact_retrieved_evidence_pack ?? [])
    .map((evidence) => normalizeCitationId(evidence.evidence_id))
    .filter(Boolean));
}

function scorePrediction(reference, prediction) {
  const referenceCitations = new Set((reference.citations ?? []).map((citation) => {
    if (typeof citation === "string") return normalizeCitationId(citation);
    return normalizeCitationId(citation.evidence_id);
  }).filter(Boolean));
  const citedGold = prediction.citations.filter((id) => referenceCitations.has(id));
  const answerable = reference.answer_type !== "abstain";
  const abstained = prediction.answer_type === "abstain";
  return {
    answer_type_correct: prediction.answer_type === reference.answer_type,
    citation_precision: prediction.citations.length ? citedGold.length / prediction.citations.length : null,
    citation_recall: referenceCitations.size ? citedGold.length / referenceCitations.size : null,
    answer_token_f1: answerable && !abstained ? tokenF1(prediction.answer, stripCitations(reference.answer)) : (answerable ? 0 : null),
    abstention_correct: answerable ? !abstained : abstained,
    inline_citation_rate: prediction.answer_type === "grounded_answer"
      ? (prediction.citations.length ? prediction.citations.filter((id) => prediction.answer.includes(`[${id}]`)).length / prediction.citations.length : 0)
      : null,
  };
}

function summarize(rows) {
  const scores = rows.map((row) => row.scores);
  const answered = rows.filter((row) => row.prediction.answer_type === "grounded_answer");
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: rows.length - answered.length,
    answer_rate: rows.length ? answered.length / rows.length : 0,
    answer_type_accuracy: mean(scores.map((score) => score.answer_type_correct)),
    citation_precision: mean(scores.map((score) => score.citation_precision)),
    citation_recall: mean(scores.map((score) => score.citation_recall)),
    answer_token_f1: mean(scores.map((score) => score.answer_token_f1)),
    abstention_accuracy: mean(scores.map((score) => score.abstention_correct)),
    inline_citation_rate: mean(scores.map((score) => score.inline_citation_rate)),
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
  return String(value ?? "").replace(/\s*\[[^\]]+\]/g, "").trim();
}

function counts(tokens) {
  const map = new Map();
  for (const token of tokens) map.set(token, (map.get(token) ?? 0) + 1);
  return map;
}

function mean(values) {
  const numeric = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number);
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : null;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

function renderReport(result) {
  return `# Qwen Non-Final Citation Repair

Run: \`${result.run_id}\`

Source run: \`${result.source_run_id}\`

This is a deterministic, zero-call syntax repair over non-final Qwen candidate-generation outputs.

| System | Examples | Answered | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| source non-final candidates | ${result.source_eval.examples} | ${result.source_eval.answered} | ${pct(result.source_eval.answer_type_accuracy)} | ${pct(result.source_eval.citation_precision)} | ${pct(result.source_eval.citation_recall)} | ${pct(result.source_eval.answer_token_f1)} | ${pct(result.source_eval.inline_citation_rate)} |
| repaired non-final candidates | ${result.eval.examples} | ${result.eval.answered} | ${pct(result.eval.answer_type_accuracy)} | ${pct(result.eval.citation_precision)} | ${pct(result.eval.citation_recall)} | ${pct(result.eval.answer_token_f1)} | ${pct(result.eval.inline_citation_rate)} |

Rows changed: ${result.repair_summary.rows_changed}
Repaired inline citations: ${result.repair_summary.repaired_inline_citations}

No OpenAI calls and no new GPU jobs.
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
