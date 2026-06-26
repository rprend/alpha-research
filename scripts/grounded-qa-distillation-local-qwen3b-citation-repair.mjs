import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const sourceRunId = args["source-run"] ?? "local-qwen3b-base-control-joint-action-12-v1";
const runId = args["run-id"] ?? `local-qwen3b-citation-repair-${sourceRunId}`;
const sourceDir = path.join(runsDir, sourceRunId);
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const sourceResult = await readJson(path.join(sourceDir, "result.json"));
const sourceRows = await readJsonl(path.join(sourceDir, "predictions.jsonl"));

const predictions = sourceRows.map((row) => {
  const sourcePrediction = normalizePrediction(row.prediction ?? {});
  const repaired = repairPrediction(sourcePrediction);
  return {
    example_id: row.example_id,
    source_run_id: sourceRunId,
    prediction: repaired.prediction,
    source_prediction: sourcePrediction,
    reference: row.reference,
    scores: scorePrediction(row.reference, repaired.prediction),
    source_scores: row.scores,
    metadata: {
      scaffold: "local_qwen3b_citation_repair",
      base_model: sourceResult.base_model,
      trained_adapter: sourceResult.trained_adapter ?? null,
      missing_inline_before: repaired.missingInlineBefore,
      repaired_inline_citations: repaired.repairedInlineCitations,
      answer_changed: repaired.prediction.answer !== sourcePrediction.answer,
    },
    raw_output: row.raw_output ?? "",
    parse_error: row.parse_error ?? null,
  };
});

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "local_qwen3b_citation_contract_repair",
  source_run_id: sourceRunId,
  base_model: sourceResult.base_model,
  trained_adapter: sourceResult.trained_adapter ?? null,
  eval: summarize(predictions),
  source_eval: sourceResult.eval,
  repair_summary: {
    answered: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    rows_changed: predictions.filter((row) => row.metadata.answer_changed).length,
    missing_inline_citations_before: sum(predictions.map((row) => row.metadata.missing_inline_before)),
    repaired_inline_citations: sum(predictions.map((row) => row.metadata.repaired_inline_citations)),
  },
  interpretation: {
    finding: "A local syntax repair can force cited ids into the answer text, but it does not change answer content, cited evidence ids, answer type, or grounded support.",
    paper_implication: "Citation formatting metrics must be reported separately from answer support and grounded correctness; this repaired base-control is still not trained-student evidence.",
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

function repairPrediction(prediction) {
  if (prediction.answer_type !== "grounded_answer") {
    return {
      prediction,
      missingInlineBefore: 0,
      repairedInlineCitations: 0,
    };
  }
  const citations = [...new Set((prediction.citations ?? []).map(normalizeCitationId).filter(Boolean))];
  const answer = String(prediction.answer ?? "").trim();
  const missing = citations.filter((id) => !answer.includes(`[${id}]`));
  if (!missing.length) {
    return {
      prediction: { ...prediction, citations },
      missingInlineBefore: 0,
      repairedInlineCitations: 0,
    };
  }
  return {
    prediction: {
      ...prediction,
      citations,
      answer: `${answer} ${missing.map((id) => `[${id}]`).join(" ")}`.trim(),
    },
    missingInlineBefore: missing.length,
    repairedInlineCitations: missing.length,
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
  return String(value ?? "").trim().replace(/^\[/, "").replace(/\]$/, "");
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
  return `# Local Qwen 3B Citation-Repair Control

Run: \`${result.run_id}\`

Source run: \`${result.source_run_id}\`

This is a deterministic, zero-call syntax repair over the local Qwen 3B base-control outputs. It is not trained-student evidence.

| System | Examples | Answered | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| source base-control | ${result.source_eval.examples} | ${result.source_eval.answered} | ${pct(result.source_eval.answer_type_accuracy)} | ${pct(result.source_eval.citation_precision)} | ${pct(result.source_eval.citation_recall)} | ${pct(result.source_eval.answer_token_f1)} | ${pct(result.source_eval.inline_citation_rate)} |
| repaired syntax control | ${result.eval.examples} | ${result.eval.answered} | ${pct(result.eval.answer_type_accuracy)} | ${pct(result.eval.citation_precision)} | ${pct(result.eval.citation_recall)} | ${pct(result.eval.answer_token_f1)} | ${pct(result.eval.inline_citation_rate)} |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| ${result.repair_summary.rows_changed} | ${result.repair_summary.missing_inline_citations_before} | ${result.repair_summary.repaired_inline_citations} |

## Interpretation

- ${result.interpretation.finding}
- ${result.interpretation.paper_implication}

No OpenAI calls, no paid GPU jobs, and no new spend.
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
