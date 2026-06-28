import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const verifierRunId = args["verifier-run"] ?? "qwen-contrast-verifier-frontier-pool-2026-06-28-v1";
const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const frontierPoolPacketRunId = args["frontier-pool-packet"] ?? "qwen-frontier-pool-support-packet-2026-06-28-v1";
const runId = args["run-id"] ?? "qwen-frontier-domain-shift-audit-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const comparativeTerms = ["best", "better", "worse", "worst", "outperform", "outperformed", "outperforms", "higher", "lower", "more", "less", "fewer", "larger", "smaller", "shorter", "longer", "improve", "improved", "increase", "increased", "decrease", "decreased", "reduce", "reduced", "significant", "significantly"];
const negationTerms = ["not", "no", "never", "without", "neither", "nor", "cannot", "can't", "doesn't", "didn't", "isn't", "aren't"];
const stopwords = new Set([
  "the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "has", "have", "had", "but", "not", "can", "may", "its", "into", "than", "then", "also", "been", "their", "there", "which", "while", "using", "used", "use", "true", "false", "answer", "claim", "evidence", "support", "supported",
]);
const featureNames = [
  "answer_cited_token_coverage",
  "answer_pack_token_coverage",
  "claim_min_cited_coverage",
  "claim_mean_cited_coverage",
  "claim_max_sentence_coverage_min",
  "claim_max_sentence_coverage_mean",
  "answer_sentence_coverage",
  "unsupported_answer_token_rate",
  "unsupported_claim_token_rate",
  "supported_number_rate",
  "unsupported_number_count",
  "unsupported_comparative_count",
  "negation_mismatch_count",
  "question_answer_overlap",
  "question_cited_overlap",
  "answer_tokens",
  "citation_count",
  "claim_count",
  "inline_complete",
  "answer_is_short",
];

await fs.mkdir(outputDir, { recursive: true });

const verifier = await readJson(path.join(runsDir, verifierRunId, "result.json"));
const diagnosticPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "diagnostic_frontier_pairwise.jsonl"));
const frontierPoolPairs = await readJsonl(path.join(runsDir, frontierPoolPacketRunId, "frontier_contrast_pairs.jsonl"));
const diagnosticSelections = await readJsonl(path.join(runsDir, verifierRunId, "diagnostic_selections.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const model = verifier.model;
const finalCandidates = candidateRowsFromPairs(diagnosticPairs, "final_diagnostic");
const nonfinalCandidates = candidateRowsFromPairs(frontierPoolPairs, "nonfinal_frontier_pool");
const finalSelections = diagnosticSelections.map((selection) => selectionAuditRow(selection, finalCandidates));
const finalMisses = finalSelections.filter((row) => row.selected_supported_answer === false);
const featureShiftRows = featureShiftAudit(nonfinalCandidates, finalCandidates);
const weightRisks = riskyWeightRows(model.weights);
const status = deriveStatus(finalSelections, weightRisks, featureShiftRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen_frontier_domain_shift_audit",
  status,
  verifier_run_id: verifierRunId,
  pairwise_packet_run_id: pairwisePacketRunId,
  frontier_pool_packet_run_id: frontierPoolPacketRunId,
  purpose: "Audit why the non-final frontier-pool verifier learns held-out non-final contrasts but fails final-window diagnostic candidate selection.",
  summary: {
    final_examples: finalSelections.length,
    final_selected_supported: finalSelections.filter((row) => row.selected_supported_answer).length,
    final_selected_unsupported: finalMisses.length,
    final_selection_support_rate: rate(finalSelections.filter((row) => row.selected_supported_answer).length, finalSelections.length),
    final_candidates: finalCandidates.length,
    final_supported_candidates: finalCandidates.filter((row) => row.supported_answer).length,
    final_unsupported_candidates: finalCandidates.filter((row) => !row.supported_answer).length,
    nonfinal_frontier_candidates: nonfinalCandidates.length,
    nonfinal_supported_candidates: nonfinalCandidates.filter((row) => row.supported_answer).length,
    nonfinal_unsupported_candidates: nonfinalCandidates.filter((row) => !row.supported_answer).length,
    risky_positive_proxy_weights: weightRisks.filter((row) => row.risk_direction === "positive_proxy_for_unsupported").length,
    feature_shift_rows: featureShiftRows.length,
  },
  inherited_metrics: verifier.metrics,
  miss_tag_counts: tagCounts(finalMisses.flatMap((row) => row.failure_tags)),
  weight_risks: weightRisks,
  decision: decisionFromStatus(status),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_diagnostic_training_use: "forbidden_diagnostic_only",
    audit_outputs_are_training_data: false,
    nonfinal_frontier_training_use: "already_consumed_by_source_verifier",
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
    note: "This audit reads existing artifacts only.",
  },
  artifacts: {
    final_candidate_audit_jsonl: rel(path.join(outputDir, "final_candidate_audit.jsonl")),
    final_selection_misses_jsonl: rel(path.join(outputDir, "final_selection_misses.jsonl")),
    feature_shift_jsonl: rel(path.join(outputDir, "feature_shift.jsonl")),
    risky_weights_jsonl: rel(path.join(outputDir, "risky_weights.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "final_candidate_audit.jsonl"), finalCandidates);
await writeJsonl(path.join(outputDir, "final_selection_misses.jsonl"), finalMisses);
await writeJsonl(path.join(outputDir, "feature_shift.jsonl"), featureShiftRows);
await writeJsonl(path.join(outputDir, "risky_weights.jsonl"), weightRisks);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({ run_id: runId, status, summary: result.summary, miss_tag_counts: result.miss_tag_counts, decision: result.decision }, null, 2));

function candidateRowsFromPairs(pairs, source) {
  const byKey = new Map();
  for (const pair of pairs) {
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const supported = role === "chosen";
      const key = `${pair.example_id ?? pair.root_example_id}:${candidate.id}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.supported_answer = existing.supported_answer || supported;
        existing.seen_in_pairs += 1;
        continue;
      }
      const features = entailmentFeatures(pair.input, candidate);
      byKey.set(key, {
        candidate_key: key,
        example_id: pair.example_id ?? pair.root_example_id,
        source,
        candidate_id: candidate.id,
        family: candidate.family ?? "unknown",
        supported_answer: supported,
        answer_type: candidate.answer_type,
        answer: candidate.answer,
        citations: candidate.citations ?? [],
        claim_table: candidate.claim_table ?? [],
        unsupported_claims: candidate.unsupported_claims ?? [],
        features,
        score: scoreFeatures(features, model),
        seen_in_pairs: 1,
      });
    }
  }
  return [...byKey.values()].sort((left, right) => left.example_id.localeCompare(right.example_id) || right.score - left.score);
}

function selectionAuditRow(selection, finalCandidates) {
  const candidates = finalCandidates.filter((row) => row.example_id === selection.example_id);
  const selected = candidates.find((row) => row.candidate_id === selection.selected_candidate_id);
  const bestSupported = candidates.filter((row) => row.supported_answer).sort((left, right) => right.score - left.score)[0] ?? null;
  const selectedFeatures = selected?.features ?? {};
  const supportedFeatures = bestSupported?.features ?? {};
  const failureTags = [];
  if (selected && bestSupported && !selected.supported_answer) {
    if (Number(selectedFeatures.citation_count) > Number(supportedFeatures.citation_count)) failureTags.push("unsupported_candidate_has_more_citations");
    if (Number(selectedFeatures.inline_complete) >= Number(supportedFeatures.inline_complete)) failureTags.push("inline_contract_not_discriminative");
    if (Number(selectedFeatures.answer_cited_token_coverage) >= Number(supportedFeatures.answer_cited_token_coverage)) failureTags.push("surface_overlap_rewards_unsupported");
    if (Number(selectedFeatures.answer_tokens) > Number(supportedFeatures.answer_tokens)) failureTags.push("longer_unsupported_answer_ranked_high");
    if (Number(supportedFeatures.answer_is_short) === 1) failureTags.push("supported_short_answer_penalized");
    if (Number(selectedFeatures.unsupported_number_count) > 0) failureTags.push("unsupported_number_not_penalized");
    if (Number(selectedFeatures.unsupported_claim_token_rate) > Number(supportedFeatures.unsupported_claim_token_rate)) failureTags.push("unsupported_claim_tokens_not_penalized");
    if (selected.family !== bestSupported.family) failureTags.push("family_or_curriculum_domain_shift");
  }
  return {
    example_id: selection.example_id,
    selected_candidate_id: selection.selected_candidate_id,
    selected_family: selection.selected_family,
    selected_supported_answer: selection.selected_supported_answer,
    selected_score: selection.selected_score,
    best_supported_candidate_id: bestSupported?.candidate_id ?? null,
    best_supported_family: bestSupported?.family ?? null,
    best_supported_score: bestSupported?.score ?? null,
    score_gap_selected_minus_best_supported: selected && bestSupported ? selected.score - bestSupported.score : null,
    candidate_count: candidates.length,
    supported_candidate_count: candidates.filter((row) => row.supported_answer).length,
    unsupported_candidate_count: candidates.filter((row) => !row.supported_answer).length,
    selected_answer: selected?.answer ?? null,
    best_supported_answer: bestSupported?.answer ?? null,
    selected_features: selectedFeatures,
    best_supported_features: supportedFeatures,
    failure_tags: failureTags,
  };
}

function featureShiftAudit(nonfinalCandidates, finalCandidates) {
  const rows = [];
  for (const feature of featureNames) {
    const nonfinalSupported = meanFeature(nonfinalCandidates.filter((row) => row.supported_answer), feature);
    const nonfinalUnsupported = meanFeature(nonfinalCandidates.filter((row) => !row.supported_answer), feature);
    const finalSupported = meanFeature(finalCandidates.filter((row) => row.supported_answer), feature);
    const finalUnsupported = meanFeature(finalCandidates.filter((row) => !row.supported_answer), feature);
    rows.push({
      feature,
      model_weight: Number(model.weights?.[feature] ?? 0),
      nonfinal_supported_mean: nonfinalSupported,
      nonfinal_unsupported_mean: nonfinalUnsupported,
      final_supported_mean: finalSupported,
      final_unsupported_mean: finalUnsupported,
      nonfinal_supported_minus_unsupported: nonfinalSupported - nonfinalUnsupported,
      final_supported_minus_unsupported: finalSupported - finalUnsupported,
      direction_flipped: Math.sign(nonfinalSupported - nonfinalUnsupported) !== 0
        && Math.sign(finalSupported - finalUnsupported) !== 0
        && Math.sign(nonfinalSupported - nonfinalUnsupported) !== Math.sign(finalSupported - finalUnsupported),
    });
  }
  return rows.sort((left, right) => Math.abs(right.final_supported_minus_unsupported - right.nonfinal_supported_minus_unsupported) - Math.abs(left.final_supported_minus_unsupported - left.nonfinal_supported_minus_unsupported));
}

function riskyWeightRows(weights) {
  const risks = [];
  for (const feature of ["citation_count", "unsupported_number_count", "unsupported_claim_token_rate"]) {
    const weight = Number(weights?.[feature] ?? 0);
    if (weight > 0) {
      risks.push({
        feature,
        weight,
        risk_direction: "positive_proxy_for_unsupported",
        reason: `${feature} should not be rewarded without semantic support, but the learned verifier gives it a positive coefficient.`,
      });
    }
  }
  for (const feature of ["answer_is_short"]) {
    const weight = Number(weights?.[feature] ?? 0);
    if (weight < 0) {
      risks.push({
        feature,
        weight,
        risk_direction: "negative_proxy_for_supported_short_answers",
        reason: "Final supported answers are often short spans; penalizing short answers hurts final candidate selection.",
      });
    }
  }
  return risks.sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight));
}

function deriveStatus(finalSelections, weightRisks, featureShiftRows) {
  const supportRate = rate(finalSelections.filter((row) => row.selected_supported_answer).length, finalSelections.length);
  const flippedImportant = featureShiftRows.filter((row) => row.direction_flipped && Math.abs(row.model_weight) > 0.1).length;
  if (supportRate < 0.5 && weightRisks.length >= 2) return "domain_shift_confirms_proxy_verifier_failure";
  if (supportRate < 0.75 || flippedImportant > 0) return "domain_shift_partial_proxy_failure";
  return "domain_shift_audit_no_major_proxy_failure";
}

function decisionFromStatus(status) {
  if (status === "domain_shift_confirms_proxy_verifier_failure") {
    return {
      launch_gpu_now: false,
      buy_more_openai_labels_now: false,
      integrate_selector_now: false,
      next_step: "Build a semantic support verifier target from non-final claim-level support labels or a small non-final adjudication batch; do not run more generator-only GPU jobs.",
      reason: "The failed final selections are explained by proxy features that reward citation count, numeric claims, or longer answers without proving support.",
    };
  }
  return {
    launch_gpu_now: false,
    buy_more_openai_labels_now: false,
    integrate_selector_now: false,
    next_step: "Use the audit rows to design the next verifier target before spending.",
    reason: "The audit does not clear selector integration thresholds.",
  };
}

function scoreFeatures(features, model) {
  let total = Number(model.intercept ?? 0);
  for (const feature of featureNames) {
    const value = Number(features[feature] ?? 0);
    const mean = Number(model.scaler?.mean?.[feature] ?? 0);
    const std = Number(model.scaler?.std?.[feature] || 1);
    total += Number(model.weights?.[feature] ?? 0) * ((value - mean) / std);
  }
  return total;
}

function entailmentFeatures(input, candidate) {
  const evidenceById = new Map((input.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row]));
  const citedIds = (candidate.citations ?? []).map((id) => String(id).replace(/^\[/, "").replace(/\]$/, ""));
  const citedText = citedIds.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  const packText = (input.compact_retrieved_evidence_pack ?? []).map((row) => row.text).join(" ");
  const answer = String(candidate.answer ?? "");
  const answerTokens = contentTokens(answer);
  const citedTokens = contentTokens(citedText);
  const packTokens = contentTokens(packText);
  const questionTokens = contentTokens(input.question);
  const claims = (candidate.claim_table ?? []).map((claim) => `${claim.claim ?? ""} ${claim.support ?? ""} ${claim.evidence ?? ""}`);
  const claimTokens = claims.map((claim) => contentTokens(claim));
  const citedSentences = splitSentences(citedText).map((sentence) => contentTokens(sentence));
  const claimMaxSentenceCoverage = claimTokens.map((tokens) => maxCoverage(tokens, citedSentences));
  const claimCoverages = claimTokens.map((tokens) => tokenCoverage(tokens, citedTokens));
  const unsupportedAnswerTokens = unsupportedContentTokens(answerTokens, citedTokens, questionTokens);
  const unsupportedClaimTokens = unsupportedContentTokens(claimTokens.flat(), citedTokens, questionTokens);
  const answerNumbers = numberTokens(answer);
  const supportedNumbers = answerNumbers.filter((number) => citedText.toLowerCase().includes(number.toLowerCase()));
  return {
    answer_cited_token_coverage: tokenCoverage(answerTokens, citedTokens),
    answer_pack_token_coverage: tokenCoverage(answerTokens, packTokens),
    claim_min_cited_coverage: claimCoverages.length ? Math.min(...claimCoverages) : 0,
    claim_mean_cited_coverage: mean(claimCoverages),
    claim_max_sentence_coverage_min: claimMaxSentenceCoverage.length ? Math.min(...claimMaxSentenceCoverage) : 0,
    claim_max_sentence_coverage_mean: mean(claimMaxSentenceCoverage),
    answer_sentence_coverage: maxCoverage(answerTokens, citedSentences),
    unsupported_answer_token_rate: answerTokens.length ? unsupportedAnswerTokens.length / answerTokens.length : 0,
    unsupported_claim_token_rate: claimTokens.flat().length ? unsupportedClaimTokens.length / claimTokens.flat().length : 0,
    supported_number_rate: answerNumbers.length ? supportedNumbers.length / answerNumbers.length : 1,
    unsupported_number_count: answerNumbers.length - supportedNumbers.length,
    unsupported_comparative_count: unsupportedComparatives(answer, citedText),
    negation_mismatch_count: negationMismatch(answer, citedText),
    question_answer_overlap: tokenCoverage(questionTokens, answerTokens),
    question_cited_overlap: tokenCoverage(questionTokens, citedTokens),
    answer_tokens: answerTokens.length,
    citation_count: citedIds.length,
    claim_count: candidate.claim_table?.length ?? 0,
    inline_complete: citedIds.length > 0 && citedIds.every((id) => answer.includes(`[${id}]`)) ? 1 : 0,
    answer_is_short: answerTokens.length <= 3 ? 1 : 0,
  };
}

function meanFeature(rows, feature) {
  return mean(rows.map((row) => Number(row.features?.[feature] ?? 0)));
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

function contentTokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function splitSentences(value) {
  return String(value ?? "").split(/(?<=[.!?])\s+|\n+/).filter((sentence) => sentence.trim());
}

function numberTokens(value) {
  return String(value ?? "").match(/[-+]?\d+(?:[.,]\d+)*(?:%| percent)?/gi) ?? [];
}

function unsupportedContentTokens(tokens, citedTokens, questionTokens) {
  const cited = new Set(citedTokens);
  const question = new Set(questionTokens);
  return [...new Set(tokens)].filter((token) => !cited.has(token) && !question.has(token));
}

function unsupportedComparatives(answer, citedText) {
  const support = String(citedText ?? "").toLowerCase();
  return comparativeTerms.filter((term) => String(answer ?? "").toLowerCase().includes(term) && !support.includes(term)).length;
}

function negationMismatch(answer, citedText) {
  const answerNegations = negationTerms.filter((term) => String(answer ?? "").toLowerCase().includes(term)).length;
  const evidenceNegations = negationTerms.filter((term) => String(citedText ?? "").toLowerCase().includes(term)).length;
  return Math.abs(answerNegations - evidenceNegations);
}

function tagCounts(tags) {
  const counts = {};
  for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return counts;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}

function renderReport(result) {
  return `# Qwen Frontier Domain-Shift Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls and launches no compute. It uses final-window labels only as forbidden diagnostic evidence.

| Item | Value |
| --- | ---: |
| Final diagnostic examples | ${result.summary.final_examples} |
| Final selected supported | ${result.summary.final_selected_supported} |
| Final selected unsupported | ${result.summary.final_selected_unsupported} |
| Final selection support rate | ${(100 * result.summary.final_selection_support_rate).toFixed(1)}% |
| Risky positive proxy weights | ${result.summary.risky_positive_proxy_weights} |

## Miss Tags

${Object.entries(result.miss_tag_counts).map(([tag, count]) => `- ${tag}: ${count}`).join("\n") || "- none"}

## Decision

- Integrate selector now: ${result.decision.integrate_selector_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
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
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function rel(file) {
  return path.relative(rootDir, file);
}
