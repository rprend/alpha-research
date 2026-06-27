import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const sourceRunId = args["source-run"];
if (!sourceRunId) throw new Error("Missing --source-run=<run-id>.");
const packetRunId = args["packet-run-id"];
if (!packetRunId) throw new Error("Missing --packet-run-id=<packet-run-id>.");
const runId = args["run-id"] ?? `${sourceRunId}-structure-repair`;
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const sourceDir = path.join(runsDir, sourceRunId);
const packetDir = path.join(runsDir, packetRunId);
const sourceResult = await readJson(path.join(sourceDir, "result.json"));
const sourceRows = await readJsonl(path.join(sourceDir, "predictions.jsonl"));
const evalRows = await readJsonl(path.join(packetDir, "dataset", "eval_prompts.jsonl"));
const evalById = new Map(evalRows.map((row) => [row.example_id, row]));

const predictions = sourceRows.map((row) => repairRow(row, evalById.get(row.example_id)));
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen_deterministic_structure_and_citation_repair",
  source_run_id: sourceRunId,
  packet_run_id: packetRunId,
  base_model: sourceResult.base_model,
  eval: summarize(predictions),
  source_eval: sourceResult.eval,
  repair_summary: summarizeRepair(predictions),
  interpretation: {
    finding: "The trained Qwen outputs often contain recoverable key-value records even when strict JSON parsing fails.",
    limitation: "This local repair recovers structure and citation syntax only. It does not prove answer support and should be judged before support claims.",
  },
  cost: {
    openai_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "Deterministic local parser/citation repair over existing predictions only.",
  },
  artifacts: {
    predictions_jsonl: rel(path.join(outputDir, "predictions.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), predictions);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(path.join(outputDir, "smoke_manifest.json"), `${JSON.stringify(smokeManifest(result), null, 2)}\n`);

console.log(JSON.stringify({
  run_id: result.run_id,
  eval: result.eval,
  repair_summary: result.repair_summary,
}, null, 2));

function repairRow(row, evalRow) {
  const strictPrediction = normalizePrediction(row.prediction ?? {});
  const rawPrediction = parseLoosePrediction(row.raw_output ?? "");
  const validEvidenceIds = evidenceIdsForRow(evalRow);
  const preferred = choosePrediction(strictPrediction, rawPrediction, row.parse_error);
  const repaired = repairCitations(preferred, validEvidenceIds);
  return {
    example_id: row.example_id,
    source_run_id: sourceRunId,
    prediction: repaired.prediction,
    source_prediction: strictPrediction,
    loose_prediction: rawPrediction,
    reference: row.reference ?? evalRow?.reference,
    scores: scorePrediction(row.reference ?? evalRow?.reference, repaired.prediction),
    source_scores: row.scores,
    raw_output: row.raw_output ?? "",
    parse_error: null,
    source_parse_error: row.parse_error ?? null,
    metadata: {
      scaffold: "qwen_structure_and_citation_repair",
      base_model: sourceResult.base_model,
      recovered_from_raw_output: repaired.recoveredFromRaw,
      source_parse_error: Boolean(row.parse_error),
      answer_changed: repaired.prediction.answer !== strictPrediction.answer,
      answer_type_changed: repaired.prediction.answer_type !== strictPrediction.answer_type,
      citations_changed: JSON.stringify(repaired.prediction.citations) !== JSON.stringify(strictPrediction.citations),
      missing_inline_before: repaired.missingInlineBefore,
      repaired_inline_citations: repaired.repairedInlineCitations,
      invalid_citations_dropped: repaired.invalidCitationsDropped,
    },
  };
}

function choosePrediction(strictPrediction, rawPrediction, parseError) {
  if (rawPrediction && (parseError || isEmptyRecoveredPrediction(strictPrediction))) {
    return { ...rawPrediction, recoveredFromRaw: true };
  }
  return { ...strictPrediction, recoveredFromRaw: false };
}

function isEmptyRecoveredPrediction(prediction) {
  return prediction.answer_type === "grounded_answer" && !prediction.answer.trim() && prediction.citations.length === 0;
}

function parseLoosePrediction(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const answerTypeMatch = text.match(/(?:^|\n)\s*answer_type\s*:\s*([^\n]+)/i);
  const answerType = /abstain/i.test(answerTypeMatch?.[1] ?? "") ? "abstain" : "grounded_answer";
  const answer = cleanAnswer(extractFieldBlock(text, "answer", ["citations?", "citation", "claim_table", "abstention_reason"]));
  const abstentionReason = cleanScalar(extractFieldBlock(text, "abstention_reason", []));
  const citationsBlock = extractFieldBlock(text, "citations?", ["claim_table", "abstention_reason"]);
  const citations = extractCitationIds(`${citationsBlock}\n${answer}`);
  if (answerType === "abstain") {
    return {
      answer_type: "abstain",
      answer: "",
      citations: [],
      claim_table: [],
      abstention_reason: abstentionReason || answer || "Evidence is insufficient.",
      recoveredFromRaw: true,
    };
  }
  if (!answer && citations.length === 0) return null;
  return {
    answer_type: "grounded_answer",
    answer,
    citations,
    claim_table: [],
    abstention_reason: null,
    recoveredFromRaw: true,
  };
}

function extractFieldBlock(text, field, nextFields) {
  const fieldPattern = field.endsWith("?") ? field.slice(0, -1) : field;
  const start = new RegExp(`(?:^|\\n)\\s*${fieldPattern}\\s*:\\s*`, "i").exec(text);
  if (!start) return "";
  const startIndex = start.index + start[0].length;
  let endIndex = text.length;
  for (const next of nextFields) {
    const nextPattern = next.endsWith("?") ? next.slice(0, -1) : next;
    const regex = new RegExp(`\\n\\s*${nextPattern}\\s*:`, "i");
    const match = regex.exec(text.slice(startIndex));
    if (match) endIndex = Math.min(endIndex, startIndex + match.index);
  }
  return text.slice(startIndex, endIndex).trim();
}

function cleanAnswer(value) {
  let text = cleanScalar(value);
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "string") text = parsed;
    else if (parsed && typeof parsed === "object") {
      const values = Object.values(parsed).filter((item) => typeof item === "string");
      if (values.length) text = values.join(" ");
    }
  } catch {
    // Leave non-JSON answer text as-is.
  }
  text = text
    .replace(/^["']|["']$/g, "")
    .replace(/\((E\d+)\)/g, "[$1]")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

function cleanScalar(value) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/^[-|]\s*/gm, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function extractCitationIds(value) {
  const ids = [];
  for (const match of String(value ?? "").matchAll(/\bE\d+\b/g)) ids.push(match[0]);
  return [...new Set(ids)];
}

function repairCitations(prediction, validEvidenceIds) {
  if (prediction.answer_type !== "grounded_answer") {
    return {
      prediction: { ...prediction, answer: "", citations: [], abstention_reason: prediction.abstention_reason ?? "Evidence is insufficient." },
      recoveredFromRaw: Boolean(prediction.recoveredFromRaw),
      missingInlineBefore: 0,
      repairedInlineCitations: 0,
      invalidCitationsDropped: 0,
    };
  }
  const answerCitationIds = extractCitationIds(prediction.answer);
  const normalized = [...new Set([...(prediction.citations ?? []), ...answerCitationIds].map(normalizeCitationId).filter(Boolean))];
  const citations = normalized.filter((id) => validEvidenceIds.size === 0 || validEvidenceIds.has(id));
  const invalidCitationsDropped = normalized.length - citations.length;
  let answer = String(prediction.answer ?? "").trim();
  const missing = citations.filter((id) => !answer.includes(`[${id}]`));
  if (missing.length) answer = `${answer} ${missing.map((id) => `[${id}]`).join(" ")}`.trim();
  if (!answer || citations.length === 0) {
    return {
      prediction: {
        answer_type: "abstain",
        answer: "",
        citations: [],
        claim_table: [],
        abstention_reason: !answer ? "Model output did not contain a recoverable answer." : "Model output did not contain valid cited evidence ids.",
      },
      recoveredFromRaw: Boolean(prediction.recoveredFromRaw),
      missingInlineBefore: missing.length,
      repairedInlineCitations: 0,
      invalidCitationsDropped,
    };
  }
  return {
    prediction: {
      answer_type: "grounded_answer",
      answer,
      citations,
      claim_table: Array.isArray(prediction.claim_table) ? prediction.claim_table : [],
      abstention_reason: null,
    },
    recoveredFromRaw: Boolean(prediction.recoveredFromRaw),
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
    answer: answerType === "abstain" ? "" : String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : citations,
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? "") : null,
  };
}

function normalizeCitationId(value) {
  return String(value ?? "").trim().replace(/^\[+/, "").replace(/\]+$/, "").replace(/,$/, "");
}

function evidenceIdsForRow(row) {
  return new Set((row?.input?.compact_retrieved_evidence_pack ?? [])
    .map((evidence) => normalizeCitationId(evidence.evidence_id))
    .filter(Boolean));
}

function scorePrediction(reference, prediction) {
  const referenceCitations = new Set((reference?.citations ?? []).map((citation) => {
    if (typeof citation === "string") return normalizeCitationId(citation);
    return normalizeCitationId(citation.evidence_id);
  }).filter(Boolean));
  const citedGold = prediction.citations.filter((id) => referenceCitations.has(id));
  const answerable = reference?.answer_type !== "abstain";
  const abstained = prediction.answer_type === "abstain";
  return {
    answer_type_correct: prediction.answer_type === reference?.answer_type,
    citation_precision: prediction.citations.length ? citedGold.length / prediction.citations.length : null,
    citation_recall: referenceCitations.size ? citedGold.length / referenceCitations.size : null,
    answer_token_f1: answerable && !abstained ? tokenF1(prediction.answer, stripCitations(reference?.answer ?? "")) : (answerable ? 0 : null),
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
    answer_rate: ratio(answered.length, rows.length),
    answer_type_accuracy: mean(scores.map((score) => score.answer_type_correct)),
    citation_precision: mean(scores.map((score) => score.citation_precision)),
    citation_recall: mean(scores.map((score) => score.citation_recall)),
    answer_token_f1: mean(scores.map((score) => score.answer_token_f1)),
    abstention_accuracy: mean(scores.map((score) => score.abstention_correct)),
    inline_citation_rate: mean(scores.map((score) => score.inline_citation_rate)),
  };
}

function summarizeRepair(rows) {
  return {
    source_parse_errors: rows.filter((row) => row.source_parse_error).length,
    recovered_from_raw_output: rows.filter((row) => row.metadata.recovered_from_raw_output).length,
    answer_type_changed: rows.filter((row) => row.metadata.answer_type_changed).length,
    answer_changed: rows.filter((row) => row.metadata.answer_changed).length,
    citations_changed: rows.filter((row) => row.metadata.citations_changed).length,
    invalid_citations_dropped: sum(rows.map((row) => row.metadata.invalid_citations_dropped)),
    missing_inline_citations_before: sum(rows.map((row) => row.metadata.missing_inline_before)),
    repaired_inline_citations: sum(rows.map((row) => row.metadata.repaired_inline_citations)),
  };
}

function renderReport(result) {
  return `# Qwen Structure And Citation Repair

## Setup

- Source run: \`${result.source_run_id}\`
- Packet run: \`${result.packet_run_id}\`
- Base model: \`${result.base_model}\`
- OpenAI calls: ${result.cost.openai_calls}
- External compute: $${result.cost.external_compute_cost_usd.toFixed(4)}

## Metrics

| Surface | Answered | Answer rate | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Source | ${result.source_eval.answered} | ${pct(result.source_eval.answer_rate)} | ${pct(result.source_eval.citation_precision)} | ${pct(result.source_eval.citation_recall)} | ${pct(result.source_eval.answer_token_f1)} | ${pct(result.source_eval.inline_citation_rate)} |
| Structure repair | ${result.eval.answered} | ${pct(result.eval.answer_rate)} | ${pct(result.eval.citation_precision)} | ${pct(result.eval.citation_recall)} | ${pct(result.eval.answer_token_f1)} | ${pct(result.eval.inline_citation_rate)} |

## Repair Summary

| Source parse errors | Recovered from raw | Answer type changed | Answer changed | Citations changed | Invalid citations dropped | Inline citations repaired |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.repair_summary.source_parse_errors} | ${result.repair_summary.recovered_from_raw_output} | ${result.repair_summary.answer_type_changed} | ${result.repair_summary.answer_changed} | ${result.repair_summary.citations_changed} | ${result.repair_summary.invalid_citations_dropped} | ${result.repair_summary.repaired_inline_citations} |

${result.interpretation.limitation}
`;
}

function smokeManifest(result) {
  return {
    run_id: result.run_id,
    source_run_id: result.source_run_id,
    packet_run_id: result.packet_run_id,
    generated_at: result.generated_at,
    derived_scaffold: "qwen_structure_and_citation_repair",
    max_sft_steps: null,
    max_dpo_steps: null,
    push_to_hub: false,
    report_to: "none",
    source_smoke_manifest: rel(path.join(runsDir, result.source_run_id, "smoke_manifest.json")),
    artifacts: {
      predictions_jsonl: rel(path.join(outputDir, "predictions.jsonl")),
      result_json: rel(path.join(outputDir, "result.json")),
      report_md: rel(path.join(outputDir, "report.md")),
      smoke_manifest_json: rel(path.join(outputDir, "smoke_manifest.json")),
    },
    cost: result.cost,
    note: "Derived deterministic repair over an existing remote smoke; no new GPU or LLM calls.",
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
  return String(value ?? "")
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

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function pct(value) {
  return value == null ? "n/a" : `${(Number(value) * 100).toFixed(1)}%`;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
