import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "generation-gap-curriculum-packet-d320-final-gaps-2026-06-28-v1";
const candidateAuditRunId = args["candidate-audit-run-id"] ?? "generation-gap-candidate-span-selector-audit-d334-2026-06-28-v1";
const verifierRunId = args["verifier-run-id"] ?? "claim-support-verifier-qwen-frontier-pool-2026-06-28-v1";
const runId = args["run-id"] ?? "generation-gap-verifier-transfer-audit-d335-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const comparativeTerms = ["best", "better", "worse", "worst", "outperform", "outperformed", "outperforms", "higher", "lower", "more", "less", "fewer", "larger", "smaller", "shorter", "longer", "improve", "improved", "increase", "increased", "decrease", "decreased", "reduce", "reduced", "significant", "significantly"];
const quantifierTerms = ["all", "every", "only", "none", "always", "never", "total"];
const stopwords = new Set(["the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "has", "have", "had", "but", "not", "can", "may", "its", "into", "than", "then", "also", "been", "their", "there", "which", "while", "using", "used", "use", "true", "false", "answer", "claim", "evidence", "support", "supported"]);
const featureNames = [
  "claim_cited_token_coverage",
  "claim_pack_token_coverage",
  "claim_best_sentence_coverage",
  "unsupported_claim_token_rate",
  "numeric_supported_rate",
  "unsupported_number_count",
  "unsupported_comparative_count",
  "unsupported_quantifier_count",
  "question_claim_overlap",
  "question_cited_overlap",
  "claim_token_count",
  "citation_count",
  "inline_complete",
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const candidates = await readJsonl(path.join(runsDir, candidateAuditRunId, "candidate_spans.jsonl"));
const verifierResult = await readJson(path.join(runsDir, verifierRunId, "result.json"));
const validationPredictions = await readJsonl(path.join(runsDir, verifierRunId, "validation_claim_predictions.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const model = {
  intercept: verifierResult.model.intercept,
  weights: featureNames.map((name) => Number(verifierResult.model.weights[name] ?? 0)),
};
const scaler = verifierResult.model.scaler;
const thresholds = calibrateThresholds(validationPredictions);
const scoredCandidates = candidates.map((candidate) => scoreCandidateRow(candidate, promptById.get(candidate.example_id), model, scaler));
const policies = [
  evaluatePolicy("verifier_balanced", prompts, scoredCandidates, thresholds.balanced),
  evaluatePolicy("verifier_balanced_risk_blocked", prompts, scoredCandidates, thresholds.balanced, { blockPrecisionRisk: true }),
  evaluatePolicy("verifier_p90", prompts, scoredCandidates, thresholds.precision_90),
  evaluatePolicy("verifier_p95", prompts, scoredCandidates, thresholds.precision_95),
  evaluatePolicy("verifier_p90_direct_anchor", prompts, scoredCandidates, thresholds.precision_90, { requireDirectAnchor: true }),
  evaluatePolicy("verifier_p90_risk_blocked", prompts, scoredCandidates, thresholds.precision_90, { blockPrecisionRisk: true }),
];
const selectedPolicy = choosePolicy(policies);
const selectorPredictions = selectedPolicy.predictions;
const policyFrontier = policies.map(({ predictions, ...policy }) => policy);
const shapeEvalRunIds = {
  verifier_balanced_risk_blocked: `${runId}-shape-eval`,
  verifier_balanced: "generation-gap-verifier-transfer-audit-d335-balanced-shape-eval",
  verifier_p90: "generation-gap-verifier-transfer-audit-d335-p90-shape-eval",
};
const shapeEvalResults = Object.fromEntries(await Promise.all(Object.entries(shapeEvalRunIds).map(async ([policy, shapeRunId]) => {
  const shape = await readOptionalJson(path.join(runsDir, shapeRunId, "result.json"));
  return [policy, shape ? { run_id: shapeRunId, status: shape.status, metrics: shape.metrics } : null];
})));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "generation_gap_verifier_transfer_audit",
  status: "generation_gap_verifier_transfer_ready_for_shape_eval",
  purpose: "Transfer the existing non-final claim-support verifier onto D334 generation-gap candidate spans, calibrating only on non-final validation labels.",
  packet_run_id: packetRunId,
  candidate_audit_run_id: candidateAuditRunId,
  verifier_run_id: verifierRunId,
  calibration: {
    source: "claim-support-verifier validation_claim_predictions.jsonl",
    thresholds,
    validation_examples: validationPredictions.length,
  },
  summary: {
    examples: prompts.length,
    candidates: candidates.length,
    selected_policy: selectedPolicy.policy,
    selected_grounded_answers: selectedPolicy.grounded_answers,
    selected_abstentions: selectedPolicy.abstentions,
  },
  policy_frontier: policyFrontier,
  shape_eval_results: shapeEvalResults,
  decision: {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    next_step: "Create generation-gap-specific candidate labels that distinguish answer-target relevance from evidence-local support before any more generator-only Prime training.",
    reason: "The transferred verifier assigns high support scores to evidence-local spans, but D322 shape scoring shows those spans often do not answer the question.",
  },
  leakage_guard: {
    final_targets_used_for_verifier_training: false,
    final_targets_used_for_threshold_selection: false,
    final_targets_used_for_candidate_scoring: false,
    diagnostic_targets_used_only_by_external_shape_eval: true,
    threshold_calibration_source: "non-final validation claim labels",
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "Local transfer audit reusing existing verifier weights and non-final validation scores.",
  },
};

await writeJsonl(path.join(outputDir, "scored_candidates.jsonl"), scoredCandidates);
await writeJsonl(path.join(outputDir, "policy_frontier.jsonl"), policyFrontier);
await writeJsonl(path.join(outputDir, "selector_predictions.jsonl"), selectorPredictions);
for (const policy of policies) await writeJsonl(path.join(outputDir, `${policy.policy}_predictions.jsonl`), policy.predictions);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  calibration: result.calibration,
  summary: result.summary,
  policy_frontier: result.policy_frontier,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function scoreCandidateRow(candidate, prompt, model, scaler) {
  const input = prompt.input;
  const prediction = {
    answer_type: "grounded_answer",
    answer: `${candidate.text} [${candidate.evidence_id}]`,
    citations: [candidate.evidence_id],
    claim_table: [{ claim: candidate.text, support: "candidate", citations: [candidate.evidence_id] }],
    abstention_reason: null,
  };
  const features = claimFeatures(input, prediction, candidate.text);
  const claimScore = scoreClaimFeatures(features, model, scaler);
  const candidateScore = scoreCandidate(input, prediction, model, scaler);
  return {
    ...candidate,
    verifier: {
      claim_score: claimScore,
      candidate_score: candidateScore,
      features,
      direct_anchors: candidate.features?.direct_anchors ?? [],
      risk_tags: candidate.features?.risk_tags ?? [],
      precision_blocked: candidate.features?.precision_blocked === true,
    },
  };
}

function calibrateThresholds(rows) {
  const thresholds = unique(rows.map((row) => Number(row.score)).filter(Number.isFinite)).sort((a, b) => a - b);
  const grid = thresholds.map((threshold) => {
    const predictedSupported = rows.filter((row) => Number(row.score) >= threshold);
    const trueSupported = predictedSupported.filter((row) => row.label === "supported").length;
    const supportedRows = rows.filter((row) => row.label === "supported");
    return {
      threshold,
      predicted_supported: predictedSupported.length,
      precision: rate(trueSupported, predictedSupported.length),
      recall: rate(trueSupported, supportedRows.length),
    };
  }).filter((row) => row.predicted_supported > 0);
  return {
    precision_90: selectThreshold(grid, 0.9),
    precision_95: selectThreshold(grid, 0.95),
    balanced: grid.sort((a, b) => (b.precision + b.recall) - (a.precision + a.recall))[0]?.threshold ?? 0.5,
    grid: grid.slice(-12),
  };
}

function selectThreshold(grid, targetPrecision) {
  const eligible = grid.filter((row) => row.precision >= targetPrecision).sort((a, b) => b.recall - a.recall || a.threshold - b.threshold);
  return eligible[0]?.threshold ?? 0.5;
}

function evaluatePolicy(policy, prompts, scoredCandidates, threshold, options = {}) {
  const byExample = groupBy(scoredCandidates, (row) => row.example_id);
  const predictions = prompts.map((prompt) => {
    const ranked = (byExample.get(prompt.example_id) ?? [])
      .filter((candidate) => candidate.verifier.claim_score >= threshold)
      .filter((candidate) => !options.requireDirectAnchor || candidate.verifier.direct_anchors.length > 0)
      .filter((candidate) => !options.blockPrecisionRisk || !candidate.verifier.precision_blocked)
      .sort((left, right) => right.verifier.candidate_score - left.verifier.candidate_score);
    const selected = ranked[0] ?? null;
    const prediction = selected ? grounded(selected) : abstain(`No ${policy} candidate cleared threshold ${threshold.toFixed(4)}.`);
    return {
      example_id: prompt.example_id,
      prediction,
      raw_output: JSON.stringify(prediction),
      verifier_metadata: {
        policy,
        threshold,
        selected_candidate_id: selected?.candidate_id ?? null,
        selected_claim_score: selected?.verifier.claim_score ?? null,
        selected_candidate_score: selected?.verifier.candidate_score ?? null,
        selected_direct_anchors: selected?.verifier.direct_anchors ?? [],
        selected_risk_tags: selected?.verifier.risk_tags ?? [],
        candidates_above_threshold: ranked.length,
      },
    };
  });
  return {
    policy,
    threshold,
    examples: predictions.length,
    grounded_answers: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstentions: predictions.filter((row) => row.prediction.answer_type === "abstain").length,
    mean_selected_claim_score: mean(predictions.map((row) => row.verifier_metadata.selected_claim_score).filter(Number.isFinite)),
    predictions,
  };
}

function choosePolicy(policies) {
  return policies.find((policy) => policy.policy === "verifier_balanced_risk_blocked") ?? policies[0];
}

function grounded(candidate) {
  return {
    answer_type: "grounded_answer",
    answer: `${candidate.text} [${candidate.evidence_id}]`,
    citations: [candidate.evidence_id],
    claim_table: [{ claim: candidate.text, support: "supported_by_verifier", citations: [candidate.evidence_id] }],
    abstention_reason: null,
  };
}

function abstain(reason) {
  return {
    answer_type: "abstain",
    answer: "The evidence pack does not contain enough support to answer this question.",
    citations: [],
    claim_table: [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }],
    abstention_reason: reason,
  };
}

function scoreCandidate(input, candidate, model, scaler) {
  if (candidate.answer_type === "abstain") return -10;
  const claims = claimTexts(candidate);
  if (!claims.length) return -5;
  const scores = claims.map((claim) => scoreClaimFeatures(claimFeatures(input, candidate, claim), model, scaler));
  return Math.min(...scores) + 0.35 * mean(scores) + (inlineComplete(candidate) ? 0.05 : -0.2);
}

function claimFeatures(input, candidate, claim) {
  const evidenceById = new Map((input.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row]));
  const citedIds = (candidate.citations ?? []).map((id) => String(id).replace(/^\[/, "").replace(/\]$/, ""));
  const citedText = citedIds.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  const packText = (input.compact_retrieved_evidence_pack ?? []).map((row) => row.text).join(" ");
  const claimTokens = contentTokens(claim);
  const citedTokens = contentTokens(citedText);
  const packTokens = contentTokens(packText);
  const questionTokens = contentTokens(input.question);
  const citedSentences = splitSentences(citedText).map((sentence) => contentTokens(sentence));
  const unsupportedTokens = unsupportedContentTokens(claimTokens, citedTokens, questionTokens);
  const claimNumbers = numberTokens(claim).map(normalizeNumber);
  const citedNumbers = new Set(numberTokens(citedText).map(normalizeNumber));
  const questionNumbers = new Set(numberTokens(input.question).map(normalizeNumber));
  const unsupportedNumbers = claimNumbers.filter((number) => !citedNumbers.has(number) && !questionNumbers.has(number)).length;
  return {
    claim_cited_token_coverage: tokenCoverage(claimTokens, citedTokens),
    claim_pack_token_coverage: tokenCoverage(claimTokens, packTokens),
    claim_best_sentence_coverage: maxCoverage(claimTokens, citedSentences),
    unsupported_claim_token_rate: claimTokens.length ? unsupportedTokens.length / claimTokens.length : 0,
    numeric_supported_rate: claimNumbers.length ? (claimNumbers.length - unsupportedNumbers) / claimNumbers.length : 1,
    unsupported_number_count: Math.log1p(unsupportedNumbers),
    unsupported_comparative_count: Math.log1p(unsupportedTerms(claim, citedText, input.question, comparativeTerms).length),
    unsupported_quantifier_count: Math.log1p(unsupportedTerms(claim, citedText, input.question, quantifierTerms).length),
    question_claim_overlap: tokenCoverage(questionTokens, claimTokens),
    question_cited_overlap: tokenCoverage(questionTokens, citedTokens),
    claim_token_count: Math.log1p(claimTokens.length),
    citation_count: Math.log1p(citedIds.length),
    inline_complete: inlineComplete(candidate) ? 1 : 0,
  };
}

function scoreClaimFeatures(features, model, scaler) {
  return sigmoid(model.intercept + dot(model.weights, scaleVector(featureVector(features), scaler)));
}

function claimTexts(candidate) {
  const claims = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? "").trim()).filter(Boolean);
  const answer = stripCitations(candidate.answer).trim();
  if (!claims.length && answer) return [answer];
  if (answer && answer.length <= 180 && !claims.some((claim) => normalizedText(claim) === normalizedText(answer))) return [answer, ...claims];
  return claims;
}

function featureVector(features) {
  return featureNames.map((name) => Number(features[name] ?? 0));
}

function scaleVector(vector, scaler) {
  return vector.map((value, index) => {
    const name = featureNames[index];
    return (value - Number(scaler.mean[name] ?? 0)) / Number(scaler.std[name] || 1);
  });
}

function inlineComplete(candidate) {
  const answer = String(candidate.answer ?? "");
  const citations = candidate.citations ?? [];
  return citations.length > 0 && citations.every((id) => answer.includes(`[${id}]`));
}

function maxCoverage(tokens, sentenceTokens) {
  if (!tokens.length || !sentenceTokens.length) return 0;
  return Math.max(...sentenceTokens.map((sentence) => tokenCoverage(tokens, sentence)));
}

function tokenCoverage(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size) return 0;
  return [...left].filter((token) => right.has(token)).length / left.size;
}

function unsupportedContentTokens(tokens, citedTokens, questionTokens) {
  const cited = new Set(citedTokens);
  const question = new Set(questionTokens);
  return [...new Set(tokens)].filter((token) => !cited.has(token) && !question.has(token));
}

function unsupportedTerms(text, citedText, question, terms) {
  const citedTerms = new Set(matchedTerms(citedText, terms));
  const questionTerms = new Set(matchedTerms(question, terms));
  return matchedTerms(text, terms).filter((term) => !citedTerms.has(term) && !questionTerms.has(term));
}

function matchedTerms(value, terms) {
  const text = String(value ?? "").toLowerCase();
  return terms.filter((term) => new RegExp(`\\b${escapeRegex(term)}\\b`).test(text));
}

function contentTokens(value) {
  return stripCitations(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function splitSentences(value) {
  return String(value ?? "").split(/(?<=[.!?])\s+|\n+/).filter((sentence) => sentence.trim());
}

function numberTokens(value) {
  return String(value ?? "").match(/[-+]?\d+(?:[.,]\d+)*(?:%| percent)?/gi) ?? [];
}

function normalizeNumber(value) {
  return String(value ?? "").toLowerCase().replace(/,/g, "").replace(/\s+percent\b/, "%");
}

function stripCitations(value) {
  return String(value ?? "").replace(/\[[^\]]+\]/g, " ");
}

function normalizedText(value) {
  return contentTokens(value).join(" ");
}

function sigmoid(value) {
  if (value < -40) return 0;
  if (value > 40) return 1;
  return 1 / (1 + Math.exp(-value));
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function groupBy(rows, keyFn) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

function unique(values) {
  return [...new Set(values)];
}

function renderReport(result) {
  const rows = result.policy_frontier.map((row) => `| ${row.policy} | ${row.threshold.toFixed(4)} | ${row.grounded_answers} | ${row.abstentions} | ${row.mean_selected_claim_score.toFixed(4)} |`).join("\n");
  const shapeRows = Object.entries(result.shape_eval_results)
    .filter(([, shape]) => shape)
    .map(([policy, shape]) => `| ${policy} | ${shape.status} | ${pct(shape.metrics.overall_shape_correct_rate)} | ${pct(shape.metrics.answerable_supported_shape_rate)} | ${pct(shape.metrics.abstention_shape_rate)} |`)
    .join("\n");
  return `# Generation-Gap Verifier Transfer Audit

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime job.

## Summary

- Examples: ${result.summary.examples}
- Candidates: ${result.summary.candidates}
- Selected policy: \`${result.summary.selected_policy}\`
- Selected grounded answers: ${result.summary.selected_grounded_answers}
- Selected abstentions: ${result.summary.selected_abstentions}

## Policy Frontier

| Policy | Threshold | Grounded answers | Abstentions | Mean selected score |
| --- | ---: | ---: | ---: | ---: |
${rows}

## D322 Shape Results

| Policy | Status | Overall shape | Answerable shape | Abstention shape |
| --- | --- | ---: | ---: | ---: |
${shapeRows || "| pending | pending | n/a | n/a | n/a |"}

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pct(value) {
  return `${(100 * Number(value || 0)).toFixed(1)}%`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readOptionalJson(file) {
  try {
    return await readJson(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function readJsonl(file) {
  return (await fs.readFile(file, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith("--") ? argv[++i] : true;
  }
  return parsed;
}
