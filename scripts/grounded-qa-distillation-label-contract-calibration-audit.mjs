import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "label-contract-calibration-audit-2026-06-29-v1";
const failureAuditRunId = args["failure-audit-run-id"] ?? "paid-repair-failure-audit-2026-06-29-v1";
const packetRunId = args["packet-run-id"] ?? "frontier-full-nonfinal-packet-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const stopwords = new Set([
  "the", "and", "for", "that", "with", "from", "this", "what", "when", "where", "which", "how",
  "are", "was", "were", "has", "have", "had", "does", "did", "its", "into", "than", "then",
  "they", "their", "them", "our", "ours", "your", "you", "about", "after", "before", "over",
  "under", "between", "through", "using", "used", "use", "can", "not", "does", "paper", "model",
  "models", "method", "methods", "task", "data", "dataset", "result", "results", "evidence",
]);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const failureRows = await readJsonl(path.join(runsDir, failureAuditRunId, "audit_rows.jsonl"));
const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const targetById = new Map(targets.map((row) => [row.example_id, row]));

const auditRows = failureRows.map(auditRow);
const metrics = summarize(auditRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "label_contract_calibration_audit",
  status: statusFor(metrics),
  purpose: "Calibrate D432/D433 failures by checking whether target citations are lexically/numerically supported, whether paid over-citations are mostly contextual, and whether abstention-counterfactual labels are too strict for the supplied evidence.",
  source_runs: {
    failure_audit: failureAuditRunId,
    packet: packetRunId,
  },
  leakage_note: "This audit inspects fresh-validation labels and predictions only. It makes no calls and creates no training labels.",
  metrics,
  decision: decisionFor(metrics),
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
    note: "This is a deterministic local calibration audit.",
  },
  artifacts: {
    audit_rows_jsonl: rel(path.join(outputDir, "audit_rows.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "audit_rows.jsonl"), auditRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  metrics: result.metrics,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function auditRow(row) {
  const prompt = promptById.get(row.example_id);
  const target = targetById.get(row.example_id)?.target;
  if (!prompt || !target) throw new Error(`Missing prompt/target for ${row.example_id}`);
  const evidence = prompt.input.compact_retrieved_evidence_pack ?? [];
  const evidenceById = new Map(evidence.map((item) => [String(item.evidence_id), item]));
  const targetAnswerTokens = contentTokens(target.answer);
  const predictedAnswerTokens = contentTokens(row.predicted_answer);
  const questionTokens = contentTokens(row.question);
  const targetCitationSupport = row.target_citations.map((id) => supportFor(evidenceById.get(id), targetAnswerTokens, questionTokens, target.answer));
  const predictedCitationSupport = row.predicted_citations.map((id) => supportFor(evidenceById.get(id), predictedAnswerTokens, questionTokens, row.predicted_answer));
  const extraPredictedCitations = row.predicted_citations.filter((id) => !row.target_citations.includes(id));
  const missingTargetCitations = row.target_citations.filter((id) => !row.predicted_citations.includes(id));
  const extraSupport = extraPredictedCitations.map((id) => supportFor(evidenceById.get(id), predictedAnswerTokens, questionTokens, row.predicted_answer));
  const missingSupport = missingTargetCitations.map((id) => supportFor(evidenceById.get(id), targetAnswerTokens, questionTokens, target.answer));
  const targetPackBest = evidence.map((item) => supportFor(item, targetAnswerTokens, questionTokens, target.answer))
    .sort((left, right) => right.answer_token_overlap_rate - left.answer_token_overlap_rate || right.numeric_overlap_rate - left.numeric_overlap_rate)[0];
  const predictedPackBest = evidence.map((item) => supportFor(item, predictedAnswerTokens, questionTokens, row.predicted_answer))
    .sort((left, right) => right.answer_token_overlap_rate - left.answer_token_overlap_rate || right.numeric_overlap_rate - left.numeric_overlap_rate)[0];
  const targetEvidenceLooksSupported = target.answer_type === "grounded_answer" && targetCitationSupport.some(strongSupport);
  const targetCitationLooksMinimal = target.answer_type === "grounded_answer" && targetCitationSupport.every(strongSupport);
  const predictedExtraLooksContextual = extraSupport.length > 0 && extraSupport.every((support) => support.answer_token_overlap_rate >= 0.08 || support.question_token_overlap_rate >= 0.12 || support.numeric_overlap_rate > 0);
  const predictedMissingLooksImportant = missingSupport.some(strongSupport);
  const abstainEvidenceLooksAnswerable = target.answer_type === "abstain" && row.prediction_answer_type === "grounded_answer" && predictedPackBest && strongSupport(predictedPackBest);
  const calibration_family = calibrationFamily({
    row,
    targetEvidenceLooksSupported,
    targetCitationLooksMinimal,
    predictedExtraLooksContextual,
    predictedMissingLooksImportant,
    abstainEvidenceLooksAnswerable,
  });
  return {
    example_id: row.example_id,
    repair_type: row.repair_type,
    failure_family: row.failure_family,
    calibration_family,
    target_answer_type: target.answer_type,
    prediction_answer_type: row.prediction_answer_type,
    citation_relation: row.citation_relation,
    target_citations: row.target_citations,
    predicted_citations: row.predicted_citations,
    extra_predicted_citations: extraPredictedCitations,
    missing_target_citations: missingTargetCitations,
    target_evidence_looks_supported: targetEvidenceLooksSupported,
    target_citation_looks_minimal: targetCitationLooksMinimal,
    predicted_extra_looks_contextual: predictedExtraLooksContextual,
    predicted_missing_looks_important: predictedMissingLooksImportant,
    abstain_evidence_looks_answerable: abstainEvidenceLooksAnswerable,
    target_citation_support: targetCitationSupport,
    predicted_citation_support: predictedCitationSupport,
    best_target_pack_support: targetPackBest ?? null,
    best_predicted_pack_support: predictedPackBest ?? null,
    question: row.question,
    target_answer: target.answer,
    predicted_answer: row.predicted_answer,
  };
}

function calibrationFamily({ row, targetEvidenceLooksSupported, targetCitationLooksMinimal, predictedExtraLooksContextual, predictedMissingLooksImportant, abstainEvidenceLooksAnswerable }) {
  if (row.target_answer_type === "abstain" && row.prediction_answer_type === "grounded_answer") {
    return abstainEvidenceLooksAnswerable ? "counterfactual_label_may_be_too_strict" : "over_answered_abstention_label_supported";
  }
  if (row.prediction_answer_type === "abstain" && row.target_answer_type === "grounded_answer") {
    return targetEvidenceLooksSupported ? "false_abstention_against_supported_target" : "target_grounded_label_needs_review";
  }
  if (row.citation_relation === "superset" && predictedExtraLooksContextual) return "citation_minimality_overcitation";
  if (row.citation_relation === "subset" && predictedMissingLooksImportant) return "citation_minimality_undercitation";
  if (row.citation_relation === "overlap" && predictedMissingLooksImportant) return "partial_citation_target_miss";
  if (!targetCitationLooksMinimal && row.target_answer_type === "grounded_answer") return "target_citation_minimality_needs_review";
  return "semantic_or_answer_content_mismatch";
}

function summarize(rows) {
  return {
    examples: rows.length,
    by_calibration_family: countBy(rows.map((row) => row.calibration_family)),
    by_repair_type: summarizeBy(rows, (row) => row.repair_type),
    target_grounded_rows: count(rows, (row) => row.target_answer_type === "grounded_answer"),
    target_abstain_rows: count(rows, (row) => row.target_answer_type === "abstain"),
    target_evidence_looks_supported: count(rows, (row) => row.target_evidence_looks_supported),
    target_citation_looks_minimal: count(rows, (row) => row.target_citation_looks_minimal),
    target_grounded_label_needs_review: count(rows, (row) => row.calibration_family === "target_grounded_label_needs_review"),
    counterfactual_labels_may_be_too_strict: count(rows, (row) => row.calibration_family === "counterfactual_label_may_be_too_strict"),
    citation_minimality_failures: count(rows, (row) => row.calibration_family.startsWith("citation_minimality_")),
    contextual_overcitation_failures: count(rows, (row) => row.calibration_family === "citation_minimality_overcitation"),
    important_undercitation_failures: count(rows, (row) => row.calibration_family === "citation_minimality_undercitation"),
    false_abstention_against_supported_target: count(rows, (row) => row.calibration_family === "false_abstention_against_supported_target"),
  };
}

function summarizeBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return Object.fromEntries([...groups.entries()].map(([key, group]) => [key, {
    examples: group.length,
    calibration_families: countBy(group.map((row) => row.calibration_family)),
    target_evidence_looks_supported: count(group, (row) => row.target_evidence_looks_supported),
    target_grounded_label_needs_review: count(group, (row) => row.calibration_family === "target_grounded_label_needs_review"),
    counterfactual_labels_may_be_too_strict: count(group, (row) => row.calibration_family === "counterfactual_label_may_be_too_strict"),
  }]));
}

function statusFor(metrics) {
  if (metrics.target_grounded_label_needs_review >= 4 || metrics.counterfactual_labels_may_be_too_strict >= 2) return "labels_need_calibration_before_more_spend";
  if (metrics.citation_minimality_failures >= 5) return "citation_contract_needs_calibration_before_more_spend";
  return "contract_calibration_not_primary_bottleneck";
}

function decisionFor(metrics) {
  return {
    buy_more_openai_labels_now: false,
    rent_prime_gpu_now: false,
    change_primary_metric_now: false,
    create_calibrated_target_packet_next: true,
    reason: `${metrics.target_grounded_label_needs_review} grounded labels need review, ${metrics.counterfactual_labels_may_be_too_strict} abstention/counterfactual labels may be too strict, and ${metrics.citation_minimality_failures} failures are citation-minimality cases.`,
    next_step: "Create a leakage-safe calibrated target packet that separates exact target citations from acceptable support citations, then rerun local routing against both strict and calibrated gates before more paid calls.",
  };
}

function renderReport(result) {
  const familyRows = Object.entries(result.metrics.by_calibration_family)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([family, value]) => `| \`${family}\` | ${value} |`)
    .join("\n");
  return `# Label Contract Calibration Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This zero-cost audit checks D432/D433 failures for label and contract calibration issues before any more paid calls or GPU work.

## Summary

- Examples audited: ${result.metrics.examples}
- Target grounded rows: ${result.metrics.target_grounded_rows}
- Target abstain rows: ${result.metrics.target_abstain_rows}
- Target evidence looks supported: ${result.metrics.target_evidence_looks_supported}
- Target grounded labels needing review: ${result.metrics.target_grounded_label_needs_review}
- Counterfactual labels that may be too strict: ${result.metrics.counterfactual_labels_may_be_too_strict}
- Citation-minimality failures: ${result.metrics.citation_minimality_failures}
- Contextual over-citation failures: ${result.metrics.contextual_overcitation_failures}
- Important under-citation failures: ${result.metrics.important_undercitation_failures}

## Calibration Families

| Family | Count |
| --- | ---: |
${familyRows}

## Decision

- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Change primary metric now: ${result.decision.change_primary_metric_now ? "yes" : "no"}
- Create calibrated target packet next: ${result.decision.create_calibrated_target_packet_next ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function supportFor(evidence, answerTokens, questionTokens, answerText) {
  if (!evidence) {
    return {
      evidence_id: null,
      answer_token_overlap_rate: 0,
      question_token_overlap_rate: 0,
      numeric_overlap_rate: 0,
      answer_overlap_tokens: [],
      numeric_overlap: [],
      missing: true,
    };
  }
  const evidenceTokens = new Set(contentTokens(evidence.text));
  const answerOverlap = [...new Set(answerTokens)].filter((token) => evidenceTokens.has(token));
  const questionOverlap = [...new Set(questionTokens)].filter((token) => evidenceTokens.has(token));
  const answerNumbers = numbers(answerText);
  const evidenceNumbers = new Set(numbers(evidence.text));
  const numericOverlap = answerNumbers.filter((number) => evidenceNumbers.has(number));
  return {
    evidence_id: String(evidence.evidence_id),
    answer_token_overlap_rate: answerTokens.length ? answerOverlap.length / new Set(answerTokens).size : 0,
    question_token_overlap_rate: questionTokens.length ? questionOverlap.length / new Set(questionTokens).size : 0,
    numeric_overlap_rate: answerNumbers.length ? numericOverlap.length / answerNumbers.length : 0,
    answer_overlap_tokens: answerOverlap.slice(0, 20),
    numeric_overlap: numericOverlap,
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

function contentTokens(text) {
  return (String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").match(/[a-z0-9]+(?:\.[0-9]+)?%?/g) ?? [])
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function numbers(text) {
  return String(text ?? "").toLowerCase().match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countBy(values) {
  const out = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
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
