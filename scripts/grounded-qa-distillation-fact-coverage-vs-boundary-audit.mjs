import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "fact-coverage-vs-boundary-audit-2026-06-29-v1";
const packetRunId = args["packet-run-id"] ?? "nonreview-oracle-contrast-packet-2026-06-29-v1";
const runIds = (args["prediction-runs"] ?? [
  "nonreview-coverage-router-audit-2026-06-29-v1-contract-gate",
  "nonreview-support-plan-scaffold-2026-06-29-v1-contract-gate",
  "nonreview-contrastive-support-planner-2026-06-29-v1-contract-gate",
].join(",")).split(",").map((value) => value.trim()).filter(Boolean);
const boundaryProbeRunId = args["boundary-probe-run-id"] ?? "openai-boundary-adjudication-probe-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const packetDir = path.join(runsDir, packetRunId, "dataset");
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method methods models model datasets dataset task result results use uses is in on of to a an by as or be can it its we our you your over under through between among all three two one do has have had not no yes where when who why whether there shown other more less much many include includes based approach".split(" "));

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(packetDir, "eval_prompts.jsonl"));
const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const runRows = await Promise.all(runIds.map(readPredictionRows));
const auditRows = runRows.flatMap(({ prediction_run_id, rows }) => rows.map((row) => auditPredictionRow(prediction_run_id, row, promptById.get(row.example_id))));
const boundaryRows = await readJsonlIfPresent(path.join(runsDir, boundaryProbeRunId, "predictions.jsonl"));
const boundaryAuditRows = boundaryRows.filter((row) => !row.skipped).map((row) => auditBoundaryRow(boundaryProbeRunId, row, promptById.get(row.example_id)));
const allRows = [...auditRows, ...boundaryAuditRows];
const summaries = summarizeByRun(allRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "fact_coverage_vs_boundary_audit",
  status: statusFor(summaries),
  purpose: "Separate complete-answer target-claim coverage from exact evidence-id boundary matching on fresh non-review grounded QA predictions.",
  source_runs: {
    packet: packetRunId,
    prediction_runs: runIds,
    boundary_probe: boundaryProbeRunId,
  },
  method: {
    type: "local_target_claim_coverage_audit",
    claim_coverage_rule: "A grounded prediction covers a target supported claim when its cited evidence reaches enough lexical or numeric overlap with that claim.",
    boundary_rule: "Boundary correctness remains the strict exact citation-set metric from the contract gate.",
    no_llm_calls: true,
    no_gpu_calls: true,
  },
  summaries,
  cross_run_findings: crossRunFindings(summaries),
  decision: decisionFor(summaries),
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
    note: "This audit is local over existing prediction artifacts.",
  },
  artifacts: {
    audit_rows_jsonl: rel(path.join(outputDir, "audit_rows.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "audit_rows.jsonl"), allRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  summaries: result.summaries,
  cross_run_findings: result.cross_run_findings,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

async function readPredictionRows(predictionRunId) {
  const rows = await readJsonl(path.join(runsDir, predictionRunId, "scored_predictions.jsonl"));
  return { prediction_run_id: predictionRunId, rows };
}

function auditPredictionRow(predictionRunId, row, prompt) {
  const evidenceById = new Map((prompt?.input?.compact_retrieved_evidence_pack ?? []).map((item) => [item.evidence_id, item]));
  const targetClaims = targetSupportedClaims(row.target);
  const predictedCitations = normalizeCitations(row.prediction?.citations);
  const claimAudits = targetClaims.map((claim) => auditClaimCoverage(claim, predictedCitations, evidenceById));
  const targetCitations = normalizeCitations(row.target?.citations);
  const extraCitations = predictedCitations.filter((id) => !targetCitations.includes(id));
  const extraCitationAudits = extraCitations.map((id) => auditExtraCitation(id, targetClaims, evidenceById));
  const allClaimsCovered = row.target_answer_type === "abstain"
    ? row.prediction_answer_type === "abstain"
    : claimAudits.length > 0 && claimAudits.every((claim) => claim.covered);
  const groundedFactCoverageCorrect = row.answer_type_correct && allClaimsCovered;
  return {
    prediction_run_id: predictionRunId,
    example_id: row.example_id,
    question: prompt?.input?.question ?? null,
    target_answer_type: row.target_answer_type,
    prediction_answer_type: row.prediction_answer_type,
    contract_correct: Boolean(row.contract_correct),
    answer_type_correct: Boolean(row.answer_type_correct),
    citation_set_exact: Boolean(row.citation_set_exact),
    fact_coverage_correct: Boolean(groundedFactCoverageCorrect),
    boundary_loss_only: Boolean(groundedFactCoverageCorrect && !row.citation_set_exact),
    missing_fact_failure: Boolean(row.answer_type_correct && !groundedFactCoverageCorrect),
    target_citations: targetCitations,
    predicted_citations: predictedCitations,
    extra_citations: extraCitations,
    extra_citations_all_related: extraCitationAudits.every((extra) => extra.related_to_target_claim),
    target_claim_count: targetClaims.length,
    covered_target_claims: claimAudits.filter((claim) => claim.covered).length,
    mean_claim_best_score: mean(claimAudits.map((claim) => claim.best_support_score)),
    claim_audits: claimAudits,
    extra_citation_audits: extraCitationAudits,
  };
}

function auditBoundaryRow(boundaryProbeRunId, row, prompt) {
  const evidenceById = new Map((prompt?.input?.compact_retrieved_evidence_pack ?? []).map((item) => [item.evidence_id, item]));
  const targetClaims = targetSupportedClaims({ evidence_first: { supported_claims: row.target_supported_claims_hidden_for_scoring ?? [] }, answer_type: "grounded_answer" });
  const predictedCitations = normalizeCitations(row.prediction?.required_citations);
  const claimAudits = targetClaims.map((claim) => auditClaimCoverage(claim, predictedCitations, evidenceById));
  const targetCitations = normalizeCitations(row.target_citations_hidden_for_scoring);
  const citationSetExact = setEqual(new Set(predictedCitations), new Set(targetCitations));
  const factCoverageCorrect = row.prediction?.answer_type === "grounded_answer" && claimAudits.length > 0 && claimAudits.every((claim) => claim.covered);
  return {
    prediction_run_id: boundaryProbeRunId,
    example_id: row.example_id,
    question: row.question,
    target_answer_type: "grounded_answer",
    prediction_answer_type: row.prediction?.answer_type ?? null,
    contract_correct: Boolean(citationSetExact && factCoverageCorrect),
    answer_type_correct: row.prediction?.answer_type === "grounded_answer",
    citation_set_exact: citationSetExact,
    fact_coverage_correct: Boolean(factCoverageCorrect),
    boundary_loss_only: Boolean(factCoverageCorrect && !citationSetExact),
    missing_fact_failure: Boolean(row.prediction?.answer_type === "grounded_answer" && !factCoverageCorrect),
    target_citations: targetCitations,
    predicted_citations: predictedCitations,
    extra_citations: predictedCitations.filter((id) => !targetCitations.includes(id)),
    extra_citations_all_related: false,
    target_claim_count: targetClaims.length,
    covered_target_claims: claimAudits.filter((claim) => claim.covered).length,
    mean_claim_best_score: mean(claimAudits.map((claim) => claim.best_support_score)),
    claim_audits: claimAudits,
    extra_citation_audits: [],
  };
}

function targetSupportedClaims(target) {
  const claims = target?.evidence_first?.supported_claims;
  if (Array.isArray(claims) && claims.length) {
    return claims.map((claim, index) => ({
      claim_id: String(claim.claim_id ?? `C${index + 1}`),
      claim: String(claim.claim ?? ""),
      citations: normalizeCitations(claim.citations),
    })).filter((claim) => claim.claim.trim());
  }
  if (target?.answer_type === "grounded_answer") {
    return splitSentences(target.answer).map((sentence, index) => ({
      claim_id: `S${index + 1}`,
      claim: sentence,
      citations: normalizeCitations(target.citations),
    }));
  }
  return [];
}

function auditClaimCoverage(claim, predictedCitations, evidenceById) {
  const supports = predictedCitations.map((id) => supportScore(claim.claim, evidenceById.get(id))).filter(Boolean)
    .sort((left, right) => right.support_score - left.support_score || String(left.evidence_id).localeCompare(String(right.evidence_id)));
  const best = supports[0] ?? { evidence_id: null, support_score: 0, token_recall: 0, numeric_recall: 0, overlapping_tokens: [], overlapping_numbers: [] };
  const claimHasNumbers = numbers(claim.claim).length > 0;
  const covered = best.support_score >= 0.28 || (claimHasNumbers && best.numeric_recall >= 0.8 && best.token_recall >= 0.08);
  return {
    claim_id: claim.claim_id,
    claim: claim.claim,
    target_citations: claim.citations,
    covered,
    best_evidence_id: best.evidence_id,
    best_support_score: best.support_score,
    token_recall: best.token_recall,
    numeric_recall: best.numeric_recall,
    overlapping_tokens: best.overlapping_tokens,
    overlapping_numbers: best.overlapping_numbers,
  };
}

function auditExtraCitation(id, targetClaims, evidenceById) {
  const scores = targetClaims.map((claim) => supportScore(claim.claim, evidenceById.get(id))).filter(Boolean);
  const best = scores.sort((left, right) => right.support_score - left.support_score)[0] ?? { support_score: 0 };
  return {
    evidence_id: id,
    related_to_target_claim: best.support_score >= 0.18,
    best_support_score: best.support_score,
  };
}

function supportScore(claim, evidence) {
  if (!evidence) return null;
  const claimTokens = unique(contentTokens(claim));
  const evidenceTokens = new Set(contentTokens(`${evidence.section ?? ""} ${evidence.text ?? ""}`));
  const overlapTokens = claimTokens.filter((token) => evidenceTokens.has(token));
  const claimNumbers = unique(numbers(claim));
  const evidenceNumbers = new Set(numbers(evidence.text ?? ""));
  const overlapNumbers = claimNumbers.filter((number) => evidenceNumbers.has(number));
  const tokenRecall = rate(overlapTokens.length, claimTokens.length);
  const numericRecall = rate(overlapNumbers.length, claimNumbers.length);
  return {
    evidence_id: evidence.evidence_id,
    token_recall: round(tokenRecall, 4),
    numeric_recall: round(numericRecall, 4),
    support_score: round(tokenRecall + numericRecall * 0.65, 4),
    overlapping_tokens: overlapTokens.slice(0, 20),
    overlapping_numbers: overlapNumbers,
  };
}

function summarizeByRun(rows) {
  const out = {};
  for (const runIdLocal of [...new Set(rows.map((row) => row.prediction_run_id))]) {
    const group = rows.filter((row) => row.prediction_run_id === runIdLocal);
    const grounded = group.filter((row) => row.target_answer_type === "grounded_answer");
    const multi = grounded.filter((row) => row.target_citations.length > 1);
    out[runIdLocal] = {
      examples: group.length,
      exact_contract_correct: count(group, (row) => row.contract_correct),
      citation_set_exact: count(group, (row) => row.citation_set_exact),
      fact_coverage_correct: count(group, (row) => row.fact_coverage_correct),
      boundary_loss_only: count(group, (row) => row.boundary_loss_only),
      missing_fact_failure: count(group, (row) => row.missing_fact_failure),
      answer_type_correct: count(group, (row) => row.answer_type_correct),
      grounded_examples: grounded.length,
      multi_citation_grounded_examples: multi.length,
      multi_citation_exact: count(multi, (row) => row.citation_set_exact),
      multi_citation_fact_coverage_correct: count(multi, (row) => row.fact_coverage_correct),
      mean_claim_best_score: mean(group.map((row) => row.mean_claim_best_score)),
    };
  }
  return out;
}

function crossRunFindings(summaries) {
  const router = summaries["nonreview-coverage-router-audit-2026-06-29-v1-contract-gate"];
  const support = summaries["nonreview-support-plan-scaffold-2026-06-29-v1-contract-gate"];
  const contrastive = summaries["nonreview-contrastive-support-planner-2026-06-29-v1-contract-gate"];
  return {
    router_fact_coverage_minus_exact_contract: router ? router.fact_coverage_correct - router.exact_contract_correct : null,
    support_fact_coverage_minus_exact_contract: support ? support.fact_coverage_correct - support.exact_contract_correct : null,
    contrastive_fact_coverage_minus_exact_contract: contrastive ? contrastive.fact_coverage_correct - contrastive.exact_contract_correct : null,
    best_fact_coverage_run: Object.entries(summaries).sort((a, b) => b[1].fact_coverage_correct - a[1].fact_coverage_correct)[0]?.[0] ?? null,
    best_boundary_exact_run: Object.entries(summaries).sort((a, b) => b[1].exact_contract_correct - a[1].exact_contract_correct)[0]?.[0] ?? null,
  };
}

function statusFor(summaries) {
  const router = summaries["nonreview-coverage-router-audit-2026-06-29-v1-contract-gate"];
  if (!router) return "fact_coverage_boundary_audit_missing_router";
  if (router.fact_coverage_correct - router.exact_contract_correct >= 5) return "fact_coverage_metric_changes_conclusion";
  if (router.fact_coverage_correct > router.exact_contract_correct) return "fact_coverage_metric_adds_secondary_signal";
  return "exact_boundary_remains_primary_bottleneck";
}

function decisionFor(summaries) {
  const router = summaries["nonreview-coverage-router-audit-2026-06-29-v1-contract-gate"];
  const delta = router ? router.fact_coverage_correct - router.exact_contract_correct : 0;
  return {
    replace_exact_citation_metric: false,
    report_fact_coverage_secondary_metric: delta > 0,
    buy_more_openai_labels_now: false,
    rent_prime_gpu_now: false,
    reason: delta > 0
      ? `Router fact coverage exceeds exact contract by ${delta} rows, so exact boundary scoring hides some answer-support progress but remains necessary for citation correctness.`
      : "Fact coverage does not exceed exact citation correctness enough to change the diagnosis.",
    next_step: delta > 0
      ? "Use fact coverage as a secondary diagnostic in the paper and mine train-only examples where fact coverage is correct but boundary exactness fails."
      : "Keep exact citation-set selection as the primary bottleneck and stop metric relaxation as the next intervention.",
  };
}

function renderReport(result) {
  const rows = Object.entries(result.summaries).map(([run, summary]) => `| \`${run}\` | ${summary.examples} | ${summary.exact_contract_correct} | ${summary.fact_coverage_correct} | ${summary.boundary_loss_only} | ${summary.missing_fact_failure} | ${summary.multi_citation_fact_coverage_correct}/${summary.multi_citation_grounded_examples} |`).join("\n");
  return `# Fact Coverage vs Boundary Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit separates complete-answer target-claim coverage from exact evidence-id boundary matching.

| Run | Examples | Exact contract | Fact coverage | Boundary-only losses | Missing-fact failures | Multi fact coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

## Decision

- Replace exact citation metric: ${result.decision.replace_exact_citation_metric ? "yes" : "no"}
- Report fact coverage secondary metric: ${result.decision.report_fact_coverage_secondary_metric ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function splitSentences(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, " ").split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
}

function contentTokens(text) {
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").match(/[a-z0-9.%-]+/g)?.filter((token) => token.length > 2 && !stopwords.has(token)) ?? [];
}

function numbers(text) {
  return String(text ?? "").match(/\d+(?:\.\d+)?%?/g) ?? [];
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => typeof citation === "string" ? citation.replace(/^\[|\]$/g, "") : String(citation?.evidence_id ?? citation?.id ?? "")).filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function mean(values) {
  return values.length ? values.reduce((total, value) => total + Number(value || 0), 0) / values.length : 0;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function round(value, digits = 4) {
  return Number(Number(value || 0).toFixed(digits));
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function readJsonlIfPresent(file) {
  try {
    return await readJsonl(file);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [name, raw] = value.slice(2).split("=");
    parsed[name] = raw ?? "true";
  }
  return parsed;
}
