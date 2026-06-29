import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "calibrated-target-packet-eval-2026-06-29-v1";
const packetRunId = args["packet-run-id"] ?? "frontier-full-nonfinal-packet-2026-06-29-v1";
const calibrationRunId = args["calibration-run-id"] ?? "label-contract-calibration-audit-2026-06-29-v1";
const predictionRuns = (args["prediction-runs"] ?? [
  "four-source-router-audit-2026-06-29-v1",
  "targeted-paid-repair-adjudication-2026-06-29-v1",
].join(",")).split(",").map((value) => value.trim()).filter(Boolean);
const outputDir = path.join(runsDir, runId);
const stopwords = new Set([
  "the", "and", "for", "that", "with", "from", "this", "what", "when", "where", "which", "how",
  "are", "was", "were", "has", "have", "had", "does", "did", "its", "into", "than", "then",
  "they", "their", "them", "our", "ours", "your", "you", "about", "after", "before", "over",
  "under", "between", "through", "using", "used", "use", "can", "not", "paper", "model",
  "models", "method", "methods", "task", "data", "dataset", "result", "results", "evidence",
]);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const calibrationRows = await readJsonl(path.join(runsDir, calibrationRunId, "audit_rows.jsonl"));
const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const targetById = new Map(targets.map((row) => [row.example_id, row]));
const calibrationById = new Map(calibrationRows.map((row) => [row.example_id, row]));

const calibratedTargets = prompts.map((prompt) => buildCalibratedTarget(prompt, targetById.get(prompt.example_id), calibrationById.get(prompt.example_id)));
const targetOverlayById = new Map(calibratedTargets.map((row) => [row.example_id, row]));
const evaluationRows = [];
const predictionSummaries = [];
for (const predictionRunId of predictionRuns) {
  const predictionFile = path.join(runsDir, predictionRunId, "routed_predictions_for_gate.jsonl");
  const predictions = await readJsonl(predictionFile);
  const predictionById = new Map(predictions.map((row) => [row.example_id, row]));
  const rows = prompts.map((prompt) => scorePredictionRun(predictionRunId, prompt, targetOverlayById.get(prompt.example_id), predictionById.get(prompt.example_id)));
  evaluationRows.push(...rows);
  predictionSummaries.push({ prediction_run_id: predictionRunId, ...summarize(rows) });
}

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "calibrated_target_packet_eval",
  status: statusFor(predictionSummaries),
  purpose: "Create a conservative calibrated target overlay that preserves strict labels while separating review-needed rows and acceptable support-citation checks, then evaluate existing local routes under both gates.",
  source_runs: {
    packet: packetRunId,
    calibration_audit: calibrationRunId,
    prediction_runs: predictionRuns,
  },
  leakage_note: "The calibrated overlay is diagnostic. It preserves exact target citations and marks suspect fresh-validation rows as review-deferred rather than turning them into training labels.",
  target_overlay_metrics: summarizeOverlay(calibratedTargets),
  prediction_summaries: predictionSummaries,
  decision: decisionFor(predictionSummaries),
  budget: {
    max_budget_usd: Number(budget.max_budget_usd),
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual),
    remaining_budget_usd: Number(budget.spend_usd?.remaining),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "This eval is local over existing prediction artifacts.",
  },
  artifacts: {
    calibrated_targets_jsonl: rel(path.join(outputDir, "calibrated_targets.jsonl")),
    evaluation_rows_jsonl: rel(path.join(outputDir, "evaluation_rows.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "calibrated_targets.jsonl"), calibratedTargets);
await writeJsonl(path.join(outputDir, "evaluation_rows.jsonl"), evaluationRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  target_overlay_metrics: result.target_overlay_metrics,
  prediction_summaries: result.prediction_summaries,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function buildCalibratedTarget(prompt, targetRow, calibration) {
  const target = targetRow?.target;
  const evidence = prompt.input.compact_retrieved_evidence_pack ?? [];
  const targetTokens = contentTokens(target?.answer);
  const questionTokens = contentTokens(prompt.input.question);
  const supportRows = evidence.map((item) => supportFor(item, targetTokens, questionTokens, target?.answer));
  const acceptableTargetSupportIds = supportRows.filter(strongSupport).map((row) => row.evidence_id);
  const calibrationFamily = calibration?.calibration_family ?? "not_in_calibration_sample";
  const reviewDeferred = [
    "target_grounded_label_needs_review",
    "target_citation_minimality_needs_review",
    "counterfactual_label_may_be_too_strict",
  ].includes(calibrationFamily);
  return {
    example_id: prompt.example_id,
    source_split: prompt.source_split,
    target_answer_type: target?.answer_type,
    exact_target_citations: normalizeCitations(target?.citations),
    acceptable_target_support_citations: unique([...normalizeCitations(target?.citations), ...acceptableTargetSupportIds]),
    review_deferred: reviewDeferred,
    calibration_family: calibrationFamily,
    target_evidence_looks_supported: Boolean(calibration?.target_evidence_looks_supported ?? (target?.answer_type === "grounded_answer" && acceptableTargetSupportIds.length > 0)),
    target_citation_support: supportRows.filter((row) => normalizeCitations(target?.citations).includes(row.evidence_id)),
    target,
  };
}

function scorePredictionRun(predictionRunId, prompt, overlay, predictionRow) {
  const parsed = normalizePrediction(predictionRow?.prediction ?? predictionRow?.raw_output);
  const prediction = parsed.prediction;
  const evidenceIds = new Set((prompt.input.compact_retrieved_evidence_pack ?? []).map((row) => String(row.evidence_id)));
  const strictCitationExact = prediction?.answer_type === "abstain"
    ? normalizeCitations(prediction?.citations).length === 0
    : setEqual(new Set(normalizeCitations(prediction?.citations)), new Set(overlay.exact_target_citations));
  const answerTypeCorrect = prediction?.answer_type === overlay.target_answer_type;
  const evidenceFirstValid = validateEvidenceFirst(prediction, evidenceIds).valid;
  const strictContractCorrect = Boolean(parsed.ok && evidenceFirstValid && answerTypeCorrect && strictCitationExact);
  const predictionSupport = supportRowsForPrediction(prompt, prediction);
  const predictedCitationIds = normalizeCitations(prediction?.citations);
  const predictedCitationsSupported = predictedCitationIds.length > 0 && predictedCitationIds.every((id) => strongSupport(predictionSupport.find((row) => row.evidence_id === id)));
  const answerF1 = tokenF1(prediction?.answer, overlay.target?.answer);
  const acceptableCitationOverlap = predictedCitationIds.some((id) => overlay.acceptable_target_support_citations.includes(id));
  const calibratedCitationAcceptable = prediction?.answer_type === "abstain"
    ? predictedCitationIds.length === 0
    : predictedCitationsSupported && acceptableCitationOverlap;
  const calibratedContractCorrect = Boolean(
    parsed.ok
    && evidenceFirstValid
    && answerTypeCorrect
    && !overlay.review_deferred
    && (prediction?.answer_type === "abstain"
      ? calibratedCitationAcceptable
      : calibratedCitationAcceptable && answerF1 >= 0.2)
  );
  return {
    prediction_run_id: predictionRunId,
    example_id: prompt.example_id,
    source_split: prompt.source_split,
    target_answer_type: overlay.target_answer_type,
    prediction_answer_type: prediction?.answer_type ?? null,
    parseable: parsed.ok,
    evidence_first_valid: evidenceFirstValid,
    answer_type_correct: answerTypeCorrect,
    strict_citation_exact: strictCitationExact,
    strict_contract_correct: strictContractCorrect,
    review_deferred: overlay.review_deferred,
    calibration_family: overlay.calibration_family,
    calibrated_citation_acceptable: calibratedCitationAcceptable,
    predicted_citations_supported: predictedCitationsSupported,
    acceptable_citation_overlap: acceptableCitationOverlap,
    calibrated_contract_correct: calibratedContractCorrect,
    exact_target_citations: overlay.exact_target_citations,
    acceptable_target_support_citations: overlay.acceptable_target_support_citations,
    predicted_citations: predictedCitationIds,
    answer_token_f1: answerF1,
  };
}

function summarize(rows) {
  const fresh = rows.filter((row) => row.source_split === "validation" || String(row.example_id).includes(":validation"));
  return {
    examples: rows.length,
    strict_contract_correct: count(rows, (row) => row.strict_contract_correct),
    strict_contract_correct_rate: rate(count(rows, (row) => row.strict_contract_correct), rows.length),
    calibrated_contract_correct: count(rows, (row) => row.calibrated_contract_correct),
    calibrated_contract_correct_rate: rate(count(rows, (row) => row.calibrated_contract_correct), rows.length),
    review_deferred: count(rows, (row) => row.review_deferred),
    calibrated_citation_acceptable: count(rows, (row) => row.calibrated_citation_acceptable),
    fresh_validation: {
      examples: fresh.length,
      strict_contract_correct: count(fresh, (row) => row.strict_contract_correct),
      calibrated_contract_correct: count(fresh, (row) => row.calibrated_contract_correct),
      review_deferred: count(fresh, (row) => row.review_deferred),
      calibrated_citation_acceptable: count(fresh, (row) => row.calibrated_citation_acceptable),
    },
  };
}

function summarizeOverlay(rows) {
  return {
    examples: rows.length,
    review_deferred: count(rows, (row) => row.review_deferred),
    grounded_targets: count(rows, (row) => row.target_answer_type === "grounded_answer"),
    abstain_targets: count(rows, (row) => row.target_answer_type === "abstain"),
    with_extra_acceptable_support_ids: count(rows, (row) => row.acceptable_target_support_citations.length > row.exact_target_citations.length),
    calibration_families: countBy(rows.map((row) => row.calibration_family)),
  };
}

function statusFor(summaries) {
  const best = summaries.reduce((winner, row) => row.fresh_validation.calibrated_contract_correct > winner.fresh_validation.calibrated_contract_correct ? row : winner, summaries[0]);
  if (!best) return "calibrated_eval_missing_predictions";
  if (best.fresh_validation.calibrated_contract_correct > best.fresh_validation.strict_contract_correct) return "calibrated_gate_changes_reporting_not_training";
  return "calibrated_gate_does_not_change_selected_reporting";
}

function decisionFor(summaries) {
  const best = summaries.reduce((winner, row) => row.fresh_validation.calibrated_contract_correct > winner.fresh_validation.calibrated_contract_correct ? row : winner, summaries[0]);
  return {
    promote_calibrated_gate_as_primary: false,
    use_calibrated_gate_as_secondary_metric: true,
    buy_more_openai_labels_now: false,
    rent_prime_gpu_now: false,
    reason: best
      ? `Best fresh calibrated score is ${best.fresh_validation.calibrated_contract_correct}/${best.fresh_validation.examples} for ${best.prediction_run_id}, versus strict ${best.fresh_validation.strict_contract_correct}/${best.fresh_validation.examples}; ${best.fresh_validation.review_deferred} rows are review-deferred.`
      : "No prediction summaries were available.",
    next_step: "Use the calibrated gate as a secondary diagnostic only, and build the next candidate/selector against non-review rows before any more paid calls.",
  };
}

function renderReport(result) {
  const rows = result.prediction_summaries.map((summary) => `| \`${summary.prediction_run_id}\` | ${summary.fresh_validation.strict_contract_correct}/${summary.fresh_validation.examples} | ${summary.fresh_validation.calibrated_contract_correct}/${summary.fresh_validation.examples} | ${summary.fresh_validation.calibrated_citation_acceptable}/${summary.fresh_validation.examples} | ${summary.fresh_validation.review_deferred} |`).join("\n");
  return `# Calibrated Target Packet Eval

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run creates a conservative calibrated target overlay and evaluates existing routed predictions under both the strict citation-exact gate and the calibrated support-citation gate. It makes no API calls and launches no compute.

## Target Overlay

- Examples: ${result.target_overlay_metrics.examples}
- Review-deferred rows: ${result.target_overlay_metrics.review_deferred}
- Rows with extra acceptable support ids: ${result.target_overlay_metrics.with_extra_acceptable_support_ids}

## Fresh Validation Scores

| Prediction run | Strict | Calibrated | Citation acceptable | Review deferred |
| --- | ---: | ---: | ---: | ---: |
${rows}

## Decision

- Promote calibrated gate as primary: ${result.decision.promote_calibrated_gate_as_primary ? "yes" : "no"}
- Use calibrated gate as secondary metric: ${result.decision.use_calibrated_gate_as_secondary_metric ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function supportRowsForPrediction(prompt, prediction) {
  const answerTokens = contentTokens(prediction?.answer);
  const questionTokens = contentTokens(prompt.input.question);
  return (prompt.input.compact_retrieved_evidence_pack ?? []).map((item) => supportFor(item, answerTokens, questionTokens, prediction?.answer));
}

function supportFor(evidence, answerTokens, questionTokens, answerText) {
  if (!evidence) return { evidence_id: null, answer_token_overlap_rate: 0, question_token_overlap_rate: 0, numeric_overlap_rate: 0, missing: true };
  const evidenceTokens = new Set(contentTokens(evidence.text));
  const answerSet = new Set(answerTokens);
  const questionSet = new Set(questionTokens);
  const answerOverlap = [...answerSet].filter((token) => evidenceTokens.has(token));
  const questionOverlap = [...questionSet].filter((token) => evidenceTokens.has(token));
  const answerNumbers = numbers(answerText);
  const evidenceNumbers = new Set(numbers(evidence.text));
  const numericOverlap = answerNumbers.filter((number) => evidenceNumbers.has(number));
  return {
    evidence_id: String(evidence.evidence_id),
    answer_token_overlap_rate: answerSet.size ? answerOverlap.length / answerSet.size : 0,
    question_token_overlap_rate: questionSet.size ? questionOverlap.length / questionSet.size : 0,
    numeric_overlap_rate: answerNumbers.length ? numericOverlap.length / answerNumbers.length : 0,
    missing: false,
  };
}

function strongSupport(support) {
  return Boolean(support) && !support.missing && (
    support.numeric_overlap_rate > 0
    || support.answer_token_overlap_rate >= 0.22
    || (support.answer_token_overlap_rate >= 0.14 && support.question_token_overlap_rate >= 0.18)
  );
}

function validateEvidenceFirst(prediction, evidenceIds) {
  const errors = [];
  const ef = prediction?.evidence_first;
  if (!ef || typeof ef !== "object") errors.push("missing evidence_first");
  const claims = Array.isArray(ef?.supported_claims) ? ef.supported_claims : [];
  if (prediction?.answer_type === "grounded_answer") {
    if (ef?.sufficiency !== "sufficient") errors.push("grounded answer must be sufficient");
    if (!claims.length) errors.push("grounded answer needs supported_claims");
    const union = new Set();
    for (const claim of claims) {
      for (const id of normalizeCitations(claim.citations ?? [])) {
        union.add(id);
        if (!evidenceIds.has(id)) errors.push(`citation ${id} missing from evidence pack`);
      }
    }
    if (!setEqual(union, new Set(normalizeCitations(prediction.citations ?? [])))) errors.push("answer citations must equal claim citation union");
  } else if (prediction?.answer_type === "abstain") {
    if (ef?.sufficiency !== "insufficient") errors.push("abstention must be insufficient");
    if (claims.length) errors.push("abstention cannot have supported_claims");
    if ((prediction.citations ?? []).length) errors.push("abstention cannot have citations");
    if (!ef?.missing_support || !prediction.abstention_reason) errors.push("abstention needs missing support");
  } else {
    errors.push("invalid answer_type");
  }
  return { valid: errors.length === 0, errors };
}

function normalizePrediction(value) {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      return { ok: false, error: error.message, prediction: null };
    }
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "prediction is not an object", prediction: null };
  if (!["grounded_answer", "abstain"].includes(parsed.answer_type)) return { ok: false, error: "invalid answer_type", prediction: parsed };
  return { ok: true, error: null, prediction: parsed };
}

function tokenF1(predicted, target) {
  const pred = contentTokens(predicted);
  const gold = contentTokens(target);
  if (!pred.length && !gold.length) return 1;
  if (!pred.length || !gold.length) return 0;
  const goldCounts = countBy(gold);
  let overlap = 0;
  for (const token of pred) {
    if (goldCounts[token] > 0) {
      overlap += 1;
      goldCounts[token] -= 1;
    }
  }
  if (!overlap) return 0;
  const precision = overlap / pred.length;
  const recall = overlap / gold.length;
  return (2 * precision * recall) / (precision + recall);
}

function contentTokens(text) {
  return (String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").match(/[a-z0-9]+(?:\.[0-9]+)?%?/g) ?? [])
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function numbers(text) {
  return String(text ?? "").toLowerCase().match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean);
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countBy(values) {
  const out = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function unique(values) {
  return [...new Set(values)];
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function rel(file) {
  return path.relative(rootDir, file);
}
