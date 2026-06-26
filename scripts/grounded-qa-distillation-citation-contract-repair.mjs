import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "temporal_test";
const sourceRunId = args["source-run"] ?? "openai-student-temporal-test-full-v1";
const evalOffset = numberArg(args["eval-offset"], 132, { allowZero: true });
const evalLimit = numberArg(args["eval-limit"], 40);
const runId = args["run-id"] ?? `citation-contract-repair-${sourceRunId}-${evalOffset}-v1`;
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const referenceRows = references.slice(evalOffset, evalOffset + evalLimit);
const referenceIds = new Set(referenceRows.map((row) => row.example_id));
const referencesById = new Map(referenceRows.map((row) => [row.example_id, row]));
const sourceRows = (await readJsonl(path.join(runDir, sourceRunId, "predictions.jsonl")))
  .filter((row) => referenceIds.has(row.example_id));

const predictions = sourceRows.map((row) => {
  const reference = referencesById.get(row.example_id);
  const original = normalizePrediction(row.prediction ?? {});
  const repaired = repairPrediction(original);
  return {
    example_id: row.example_id,
    model: row.model,
    source_run_id: sourceRunId,
    prediction: repaired.prediction,
    source_prediction: original,
    raw_content: row.raw_content ?? "",
    usage: null,
    cost_usd: 0,
    metadata: {
      scaffold: "citation_contract_repair",
      repaired_inline_citations: repaired.repairedInlineCitations,
      missing_inline_before: repaired.missingInlineBefore,
      answer_changed: repaired.prediction.answer !== original.answer,
    },
    scores: scorePrediction(reference, repaired.prediction),
  };
});

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  source_run_id: sourceRunId,
  eval_offset: evalOffset,
  eval_examples: referenceRows.length,
  predictions_seen: sourceRows.length,
  scaffold: "citation_contract_repair",
  calls_made: 0,
  run_cost_usd: 0,
  metrics: summarize(predictions),
  repair_summary: {
    answered: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    rows_changed: predictions.filter((row) => row.metadata.answer_changed).length,
    missing_inline_citations_before: sum(predictions.map((row) => row.metadata.missing_inline_before)),
    repaired_inline_citations: sum(predictions.map((row) => row.metadata.repaired_inline_citations)),
  },
  interpretation: {
    cost_change: "No additional LLM calls. This is a local output-contract repair over an existing direct student run.",
    limitation: "The repair only enforces that cited ids appear inline in the answer. It does not change which evidence ids are cited or whether claims are actually supported.",
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), predictions);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  metrics: result.metrics,
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
  const citations = [...new Set(prediction.citations)];
  const missing = citations.filter((id) => !prediction.answer.includes(`[${id}]`));
  if (!missing.length) {
    return {
      prediction: { ...prediction, citations },
      missingInlineBefore: 0,
      repairedInlineCitations: 0,
    };
  }
  const suffix = missing.map((id) => `[${id}]`).join(" ");
  return {
    prediction: {
      ...prediction,
      citations,
      answer: `${prediction.answer.trim()} ${suffix}`.trim(),
    },
    missingInlineBefore: missing.length,
    repairedInlineCitations: missing.length,
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
  return `# Citation Contract Repair

## Setup

- Source run: \`${result.source_run_id}\`
- Split: \`${result.split}\`
- Eval offset: ${result.eval_offset}
- Eval examples: ${result.eval_examples}
- LLM calls: ${result.calls_made}
- Run cost: $${result.run_cost_usd.toFixed(7)}

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.metrics.examples} | ${result.metrics.answered} | ${pct(result.metrics.answer_type_accuracy)} | ${pct(result.metrics.citation_precision)} | ${pct(result.metrics.citation_recall)} | ${pct(result.metrics.answer_token_f1)} | ${pct(result.metrics.inline_citation_rate)} |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| ${result.repair_summary.rows_changed} | ${result.repair_summary.missing_inline_citations_before} | ${result.repair_summary.repaired_inline_citations} |

${result.interpretation.limitation}
`;
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

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
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
