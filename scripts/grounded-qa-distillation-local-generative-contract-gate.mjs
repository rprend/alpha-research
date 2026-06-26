import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "extended_temporal_future_holdout";
const sourceRunId = args["source-run"] ?? "citation-contract-repair-local-generative-sft-answered-only-mini-negative-temporal-qwen05b-321-389-v1";
const evalOffset = numberArg(args["eval-offset"], 320, { allowZero: true });
const evalLimit = numberArg(args["eval-limit"], 69);
const gateThreshold = Number(args["gate-threshold"] ?? 0.4);
const thresholdGrid = (args["threshold-grid"] ?? "0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value));
const runId = args["run-id"] ?? `local-generative-contract-gate-${sourceRunId}-${evalOffset}-${evalOffset + evalLimit}-v1`;
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const referenceRows = references.slice(evalOffset, evalOffset + evalLimit);
const referencesById = new Map(referenceRows.map((row) => [row.example_id, row]));
const referenceIds = new Set(referencesById.keys());
const sourceRows = (await readJsonl(path.join(runDir, sourceRunId, "predictions.jsonl")))
  .filter((row) => referenceIds.has(row.example_id));

const thresholdResults = thresholdGrid.map((threshold) => {
  const rows = sourceRows.map((row) => gatedRow(row, referencesById.get(row.example_id), threshold));
  return {
    threshold,
    metrics: summarize(rows),
    gate_summary: summarizeGate(rows),
  };
});

const predictions = sourceRows.map((row) => gatedRow(row, referencesById.get(row.example_id), gateThreshold));
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  source_run_id: sourceRunId,
  eval_offset: evalOffset,
  eval_examples: referenceRows.length,
  predictions_seen: sourceRows.length,
  scaffold: "local_generative_contract_gate",
  calls_made: 0,
  run_cost_usd: 0,
  gate: {
    threshold: gateThreshold,
    feature: "unique_answer_token_overlap_with_cited_evidence",
    policy: "Abstain when the repaired local generative answer has no citations, is yes/no-only, or has cited-evidence token overlap below the fixed threshold.",
    threshold_selection: "Fixed conservative diagnostic threshold, not tuned on the 321-389 labels.",
  },
  metrics: summarize(predictions),
  gate_summary: summarizeGate(predictions),
  threshold_grid: thresholdResults,
  interpretation: {
    cost_change: "No additional LLM calls. This is a deterministic local gate over existing repaired local SFT outputs.",
    limitation: "The gate only checks lexical alignment between generated answers and cited evidence. It cannot prove support, recover missing citations, or learn abstention behavior.",
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
  gate_summary: result.gate_summary,
}, null, 2));

function gatedRow(row, reference, threshold) {
  const sourcePrediction = normalizePrediction(row.prediction ?? {});
  const gate = gateDecision(sourcePrediction, reference, threshold);
  const prediction = gate.suppressed
    ? abstain(gate.reason)
    : sourcePrediction;
  return {
    example_id: row.example_id,
    model: row.model,
    source_run_id: sourceRunId,
    prediction,
    source_prediction: sourcePrediction,
    raw_content: row.raw_content ?? "",
    usage: null,
    cost_usd: 0,
    metadata: {
      scaffold: "local_generative_contract_gate",
      threshold,
      suppressed: gate.suppressed,
      suppression_reason: gate.reason,
      features: gate.features,
    },
    scores: scorePrediction(reference, prediction),
  };
}

function gateDecision(prediction, reference, threshold) {
  const features = contractFeatures(prediction, reference);
  if (prediction.answer_type !== "grounded_answer") {
    return { suppressed: false, reason: null, features };
  }
  if (!prediction.citations.length) {
    return { suppressed: true, reason: "No citations in generated answer.", features };
  }
  if (features.answer_content_tokens < 2) {
    return { suppressed: true, reason: "Generated answer is too short for grounded support checking.", features };
  }
  if (features.invalid_citations > 0) {
    return { suppressed: true, reason: "Generated answer cites evidence ids not present in the retrieved pack.", features };
  }
  if (features.unique_answer_token_overlap_with_cited_evidence < threshold) {
    return {
      suppressed: true,
      reason: `Cited-evidence token overlap ${features.unique_answer_token_overlap_with_cited_evidence.toFixed(3)} below threshold ${threshold}.`,
      features,
    };
  }
  return { suppressed: false, reason: null, features };
}

function contractFeatures(prediction, reference) {
  const evidencePack = reference.input.compact_retrieved_evidence_pack ?? [];
  const evidenceIds = new Set(evidencePack.map(evidenceId));
  const citedEvidence = evidencePack.filter((item) => prediction.citations.includes(evidenceId(item)));
  const answerTokens = contentTokens(prediction.answer);
  const uniqueAnswerTokens = new Set(answerTokens);
  const citedTokens = new Set(contentTokens(citedEvidence.map(evidenceText).join(" ")));
  const overlap = [...uniqueAnswerTokens].filter((token) => citedTokens.has(token)).length;
  return {
    answer_content_tokens: answerTokens.length,
    unique_answer_content_tokens: uniqueAnswerTokens.size,
    citations: prediction.citations.length,
    invalid_citations: prediction.citations.filter((id) => !evidenceIds.has(id)).length,
    cited_evidence_tokens: citedTokens.size,
    unique_answer_token_overlap_with_cited_evidence: uniqueAnswerTokens.size ? overlap / uniqueAnswerTokens.size : 0,
  };
}

function abstain(reason) {
  return {
    answer_type: "abstain",
    answer: "The evidence pack does not contain enough support to answer this question.",
    citations: [],
    claim_table: [
      {
        claim: "Local contract gate suppressed the generated answer.",
        support: "abstention",
        citations: [],
      },
    ],
    abstention_reason: reason,
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

function summarizeGate(rows) {
  return {
    source_answered: rows.filter((row) => row.source_prediction.answer_type === "grounded_answer").length,
    retained_answers: rows.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    suppressed_answers: rows.filter((row) => row.metadata.suppressed).length,
    retained_answer_rate: mean(rows.map((row) => row.source_prediction.answer_type === "grounded_answer" ? (row.prediction.answer_type === "grounded_answer" ? 1 : 0) : null)),
    mean_retained_overlap: mean(rows.map((row) => row.prediction.answer_type === "grounded_answer" ? row.metadata.features.unique_answer_token_overlap_with_cited_evidence : null)),
    mean_suppressed_overlap: mean(rows.map((row) => row.metadata.suppressed ? row.metadata.features.unique_answer_token_overlap_with_cited_evidence : null)),
  };
}

function renderReport(result) {
  const gridRows = result.threshold_grid.map((entry) => markdownRow([
    entry.threshold,
    entry.metrics.answered,
    pct(entry.metrics.answer_type_accuracy),
    pct(entry.metrics.citation_precision),
    pct(entry.metrics.citation_recall),
    pct(entry.metrics.answer_token_f1),
    pct(entry.metrics.inline_citation_rate),
    entry.gate_summary.suppressed_answers,
  ]));
  return `# Local Generative Contract Gate

## Setup

- Source run: \`${result.source_run_id}\`
- Split: \`${result.split}\`
- Eval offset: ${result.eval_offset}
- Eval examples: ${result.eval_examples}
- Gate feature: \`${result.gate.feature}\`
- Selected threshold: ${result.gate.threshold}
- LLM calls: ${result.calls_made}
- Run cost: $${result.run_cost_usd.toFixed(7)}

## Selected Result

| Examples | Answered | Suppressed | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citations |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.metrics.examples} | ${result.metrics.answered} | ${result.gate_summary.suppressed_answers} | ${pct(result.metrics.answer_type_accuracy)} | ${pct(result.metrics.citation_precision)} | ${pct(result.metrics.citation_recall)} | ${pct(result.metrics.answer_token_f1)} | ${pct(result.metrics.inline_citation_rate)} |

## Threshold Grid

| Threshold | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citations | Suppressed |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${gridRows.join("\n")}

## Interpretation

${result.interpretation.limitation}
`;
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? [...new Set(value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean))]
    : [];
  return {
    answer_type: answerType,
    answer: String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : citations,
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? "") : null,
  };
}

function evidenceId(item) {
  return item.evidence_id ?? item.id;
}

function evidenceText(item) {
  return [item.title, item.section, item.text, item.snippet, item.content].filter(Boolean).join(" ");
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
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why", "than", "then", "there", "been", "also", "such"]);
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

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function markdownRow(cells) {
  return `| ${cells.join(" | ")} |`;
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
    const [key, ...rest] = value.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : "true";
  }
  return parsed;
}
