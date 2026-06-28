import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run"] ?? "margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const nliRunId = args["nli-run"] ?? "margin-compatible-heldout-nli-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "margin-compatible-heldout-eval-321-389-2026-06-28-v1";
const d262RunId = "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1";
const hardRunId = "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1";
const claimNliRunId = "claim-nli-support-verifier-qwen-frontier-pool-2026-06-28-v1";
const d280RunId = "tempered-hard-hybrid-audit-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const featureNames = [
  "claim_model_min",
  "claim_model_mean",
  "nli_entailment_min",
  "nli_entailment_mean",
  "nli_margin_min",
  "nli_margin_mean",
  "nli_contradiction_max",
  "citation_count",
  "answer_tokens",
  "claim_count",
  "inline_complete",
  "unsupported_number_count",
  "unsupported_comparative_count",
  "short_answer_bonus",
];
const comparativeTerms = ["best", "better", "worse", "worst", "outperform", "outperformed", "outperforms", "higher", "lower", "more", "less", "fewer", "larger", "smaller", "shorter", "longer", "improve", "improved", "increase", "increased", "decrease", "decreased", "reduce", "reduced", "significant", "significantly"];
const quantifierTerms = ["all", "every", "only", "none", "always", "never", "total"];
const stopwords = new Set(["the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "has", "have", "had", "but", "not", "can", "may", "its", "into", "than", "then", "also", "been", "their", "there", "which", "while", "using", "used", "use", "true", "false", "answer", "claim", "evidence", "support", "supported"]);

await fs.mkdir(outputDir, { recursive: true });

const packet = await readJson(path.join(runsDir, packetRunId, "result.json"));
const nliResult = await readJson(path.join(runsDir, nliRunId, "result.json"));
const pairs = await readJsonl(path.join(runsDir, packetRunId, "heldout_pairwise.jsonl"));
const nliRows = await readJsonl(path.join(runsDir, nliRunId, "claim-nli-scores.jsonl"));
const nliByKey = new Map(nliRows.map((row) => [row.unit_key, row.nli]));
const d262Result = await readJson(path.join(runsDir, d262RunId, "result.json"));
const hardResult = await readJson(path.join(runsDir, hardRunId, "result.json"));
const claimNliResult = await readJson(path.join(runsDir, claimNliRunId, "result.json"));
const d280Result = await readJson(path.join(runsDir, d280RunId, "result.json"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const d262Model = modelFromWeightObject(d262Result.learned_selector);
const hardModel = modelFromWeightObject(hardResult.learned_models.baseline_pairwise_selector);
const alphaHardNegative = Number(d280Result.selected_policy?.alpha_hard_negative ?? -0.25);
const alphaBoundary = Number(d280Result.selected_policy?.alpha_boundary ?? 0);
const scoredRows = pairs.map(scorePair);
const d262Summary = summarize(scoredRows, "d262_margin");
const hardSummary = summarize(scoredRows, "hard_negative_margin");
const d280Summary = summarize(scoredRows, "d280_combined_margin");
const selectionRows = selectCandidates(scoredRows);
const selectionSummary = summarizeSelections(selectionRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "margin_compatible_heldout_eval",
  status: deriveStatus(d280Summary, selectionSummary),
  purpose: "Evaluate the frozen D280 hypothesis on the 321-389 heldout pair packet using serialized D262 and hard-negative selector weights, without fitting on heldout rows.",
  source_runs: {
    packet: packetRunId,
    local_nli: nliRunId,
    d262_selector: d262RunId,
    hard_negative_selector: hardRunId,
    claim_nli_verifier: claimNliRunId,
    d280_candidate: d280RunId,
  },
  frozen_policy: {
    d262_model_reused: true,
    hard_negative_model_reused: true,
    alpha_hard_negative: alphaHardNegative,
    alpha_boundary: alphaBoundary,
    boundary_margin_available: false,
    boundary_margin_treated_as_zero: alphaBoundary === 0,
  },
  counts: {
    heldout_pairs: pairs.length,
    heldout_examples_with_pairs: new Set(pairs.map((row) => row.example_id)).size,
    nli_units: nliRows.length,
    missing_nli_scores: scoredRows.filter((row) => row.missing_nli_scores > 0).length,
  },
  metrics: {
    d262_pairwise: d262Summary,
    hard_negative_pairwise: hardSummary,
    d280_frozen_pairwise: d280Summary,
    d280_frozen_selection: selectionSummary,
  },
  decision: {
    promote_d280_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    build_larger_margin_compatible_nonfinal_heldout_next: d280Summary.pairs < 40,
    reason: decisionReason(d280Summary, selectionSummary),
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_evaluation: true,
    heldout_training_use: packet.leakage_guard?.training_use,
    nli_training_use: nliResult.leakage_guard?.training_use,
    note: "The D280 coefficient and selector weights are frozen before reading this heldout; these rows are not used for fitting or threshold selection.",
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
    note: "No new API calls; reuses existing judgments and local NLI scores.",
  },
};

await writeJsonl(path.join(outputDir, "heldout_pair_predictions.jsonl"), scoredRows);
await writeJsonl(path.join(outputDir, "heldout_selections.jsonl"), selectionRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  metrics: result.metrics,
  decision: result.decision,
}, null, 2));

function scorePair(pair) {
  const enriched = enrichPair(pair);
  const d262Margin = scoreDelta(enriched.delta, d262Model);
  const hardMargin = scoreDelta(enriched.delta, hardModel);
  const boundaryMargin = 0;
  const combined = d262Margin + alphaHardNegative * hardMargin + alphaBoundary * boundaryMargin;
  return {
    pair_id: pair.pair_id,
    example_id: pair.example_id,
    source_index: pair.source_index,
    chosen_id: pair.chosen.id,
    rejected_id: pair.rejected.id,
    chosen_family: pair.chosen.family,
    rejected_family: pair.rejected.family,
    d262_margin: round(d262Margin),
    hard_negative_margin: round(hardMargin),
    boundary_margin: boundaryMargin,
    d280_combined_margin: round(combined),
    d262_correct: d262Margin >= 0,
    hard_negative_correct: hardMargin >= 0,
    d280_correct: combined >= 0,
    predicted_preferred: combined >= 0 ? "chosen" : "rejected",
    missing_nli_scores: enriched.missing_nli_scores,
    hard_negative_tags: enriched.hard_negative.tags,
    hard_negative_core_tags: enriched.hard_negative.core_tags,
    training_use: pair.training_use,
  };
}

function enrichPair(pair) {
  const chosenFeatures = candidateFeatures(pair, pair.chosen);
  const rejectedFeatures = candidateFeatures(pair, pair.rejected);
  return {
    delta: featureNames.map((name) => chosenFeatures.features[name] - rejectedFeatures.features[name]),
    hard_negative: hardNegativeTags(chosenFeatures.features, rejectedFeatures.features),
    missing_nli_scores: chosenFeatures.missing_nli_scores + rejectedFeatures.missing_nli_scores,
  };
}

function candidateFeatures(pair, candidate) {
  if (candidate.answer_type === "abstain") {
    return {
      missing_nli_scores: 0,
      features: Object.fromEntries(featureNames.map((name) => [name, name === "short_answer_bonus" ? 0 : -5])),
    };
  }
  const claims = claimTexts(candidate);
  let missing = 0;
  const claimScores = claims.map((claim) => {
    const lexical = claimFeatures(pair.input, candidate, claim);
    const key = nliKeyForCandidateClaim(pair, candidate, claim);
    const nli = nliFeatures(nliByKey.get(key));
    if (!nliByKey.has(key)) missing += 1;
    return {
      ...lexical,
      ...nli,
      claim_model: scoreClaimFeatures({ ...lexical, ...nli }, claimNliResult.model, claimNliResult.training.feature_names),
    };
  });
  return {
    missing_nli_scores: missing,
    features: {
      claim_model_min: min(claimScores.map((row) => row.claim_model)),
      claim_model_mean: mean(claimScores.map((row) => row.claim_model)),
      nli_entailment_min: min(claimScores.map((row) => row.nli_entailment)),
      nli_entailment_mean: mean(claimScores.map((row) => row.nli_entailment)),
      nli_margin_min: min(claimScores.map((row) => row.nli_margin)),
      nli_margin_mean: mean(claimScores.map((row) => row.nli_margin)),
      nli_contradiction_max: max(claimScores.map((row) => row.nli_contradiction)),
      citation_count: Math.log1p((candidate.citations ?? []).length),
      answer_tokens: Math.log1p(contentTokens(candidate.answer).length),
      claim_count: Math.log1p(claims.length),
      inline_complete: inlineComplete(candidate) ? 1 : 0,
      unsupported_number_count: Math.max(...claimScores.map((row) => row.unsupported_number_count), 0),
      unsupported_comparative_count: Math.max(...claimScores.map((row) => row.unsupported_comparative_count), 0),
      short_answer_bonus: contentTokens(candidate.answer).length <= 8 ? 1 : 0,
    },
  };
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

function hardNegativeTags(chosen, rejected) {
  const coreTags = [];
  const nliTags = [];
  if (rejected.claim_model_min >= chosen.claim_model_min) coreTags.push("unsupported_claim_model_not_lower");
  if (rejected.citation_count > chosen.citation_count) coreTags.push("unsupported_more_citations");
  if (rejected.answer_tokens > chosen.answer_tokens) coreTags.push("unsupported_longer_answer");
  if (rejected.unsupported_number_count > 0) coreTags.push("unsupported_number_present");
  if (chosen.short_answer_bonus > rejected.short_answer_bonus) coreTags.push("supported_short_answer");
  if (rejected.nli_entailment_mean >= chosen.nli_entailment_mean) nliTags.push("unsupported_nli_entailment_not_lower");
  if (rejected.nli_margin_mean >= chosen.nli_margin_mean) nliTags.push("unsupported_nli_margin_not_lower");
  return { tags: [...coreTags, ...nliTags], core_tags: coreTags, nli_tags: nliTags, is_hard: coreTags.length > 0 };
}

function selectCandidates(rows) {
  const byExample = new Map();
  for (const row of rows) {
    if (!byExample.has(row.example_id)) byExample.set(row.example_id, new Map());
    const candidates = byExample.get(row.example_id);
    for (const [role, id, family, marginSign] of [
      ["chosen", row.chosen_id, row.chosen_family, 1],
      ["rejected", row.rejected_id, row.rejected_family, -1],
    ]) {
      if (!candidates.has(id)) {
        candidates.set(id, {
          example_id: row.example_id,
          candidate_id: id,
          family,
          supported_answer: role === "chosen",
          wins: 0,
          losses: 0,
          margin_sum: 0,
        });
      }
      const candidate = candidates.get(id);
      if (role === "chosen") candidate.supported_answer = true;
      const signedMargin = row.d280_combined_margin * marginSign;
      candidate.margin_sum += signedMargin;
      if (signedMargin >= 0) candidate.wins += 1;
      else candidate.losses += 1;
    }
  }
  return [...byExample.entries()].map(([exampleId, candidates]) => {
    const ranked = [...candidates.values()].sort((left, right) => (right.wins - right.losses + right.margin_sum) - (left.wins - left.losses + left.margin_sum));
    return {
      example_id: exampleId,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
      candidate_count: ranked.length,
      supported_candidate_count: ranked.filter((row) => row.supported_answer).length,
      ranked_candidates: ranked,
    };
  });
}

function summarize(rows, marginKey) {
  const correctKey = marginKey === "d262_margin" ? "d262_correct" : marginKey === "hard_negative_margin" ? "hard_negative_correct" : "d280_correct";
  const correct = rows.filter((row) => row[correctKey]).length;
  return {
    pairs: rows.length,
    correct,
    accuracy: rate(correct, rows.length),
    mean_margin: mean(rows.map((row) => row[marginKey])),
    hard_pairs: rows.filter((row) => row.hard_negative_core_tags.length).length,
    hard_pair_accuracy: rate(rows.filter((row) => row.hard_negative_core_tags.length && row[correctKey]).length, rows.filter((row) => row.hard_negative_core_tags.length).length),
  };
}

function summarizeSelections(rows) {
  const selectedSupported = rows.filter((row) => row.selected_supported_answer).length;
  return {
    examples: rows.length,
    selected_supported: selectedSupported,
    selected_unsupported: rows.length - selectedSupported,
    selection_support_rate: rate(selectedSupported, rows.length),
    examples_with_supported_candidate: rows.filter((row) => row.supported_candidate_count > 0).length,
  };
}

function deriveStatus(d280Summary, selectionSummary) {
  if (d280Summary.pairs === 0) return "heldout_eval_no_usable_pairs";
  if (d280Summary.pairs < 40) return "heldout_eval_too_small_for_promotion";
  if (d280Summary.accuracy >= 0.85 && selectionSummary.selection_support_rate >= 0.8) return "frozen_d280_validated";
  return "frozen_d280_not_validated";
}

function decisionReason(d280Summary, selectionSummary) {
  if (d280Summary.pairs === 0) return "After exact-duplicate filtering, the 321-389 scaffold pool has no usable feature-contrast pairs for frozen D280 validation.";
  if (d280Summary.pairs < 40) return "The compatible heldout now scores, but only 20 supported-answer pair rows exist, which is too small for promotion.";
  if (d280Summary.accuracy >= 0.85 && selectionSummary.selection_support_rate >= 0.8) return "Frozen D280 clears pairwise and selection thresholds on the heldout.";
  return "Frozen D280 does not clear heldout thresholds.";
}

function modelFromWeightObject(model) {
  return {
    weights: featureNames.map((name) => Number(model.weights[name] ?? 0)),
    scaler: model.scaler,
  };
}

function scoreDelta(delta, model) {
  return dot(model.weights, delta.map((value, index) => value / Number(model.scaler.std[featureNames[index]] || 1)));
}

function scoreClaimFeatures(features, model, modelFeatureNames) {
  const vector = modelFeatureNames.map((name) => {
    const value = Number(features[name] ?? 0);
    return (value - Number(model.scaler.mean[name] ?? 0)) / Number(model.scaler.std[name] || 1);
  });
  return sigmoid(model.intercept + dot(modelFeatureNames.map((name) => Number(model.weights[name] ?? 0)), vector));
}

function nliFeatures(nli) {
  return {
    nli_entailment: Number(nli?.entailment ?? 0),
    nli_contradiction: Number(nli?.contradiction ?? 0),
    nli_margin: Number(nli?.margin ?? 0),
  };
}

function nliKeyForCandidateClaim(pair, candidate, claim) {
  return `candidate::${pair.example_id ?? pair.root_example_id}::${candidate.id}::${hashString(claim)}`;
}

function claimTexts(candidate) {
  const claims = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? "").trim()).filter(Boolean);
  const answer = stripCitations(candidate.answer).trim();
  if (!claims.length && answer) return [answer];
  if (answer && answer.length <= 180 && !claims.some((claim) => normalizedText(claim) === normalizedText(answer))) {
    return [answer, ...claims];
  }
  return claims;
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
  return stripCitations(value).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !stopwords.has(token));
}

function splitSentences(value) {
  return String(value ?? "").split(/(?<=[.!?])\s+/).filter(Boolean);
}

function stripCitations(value) {
  return String(value ?? "").replace(/\[[^\]]+\]/g, " ");
}

function numberTokens(value) {
  return String(value ?? "").match(/[-+]?\d+(?:[.,]\d+)*(?:%| percent)?/gi) ?? [];
}

function normalizeNumber(value) {
  return String(value ?? "").toLowerCase().replace(/,/g, "").replace(/\s+percent\b/, "%");
}

function normalizedText(value) {
  return contentTokens(value).join(" ");
}

function hashString(value) {
  let hash = 0;
  for (const char of String(value)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash).toString(36);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sigmoid(value) {
  if (value < -40) return 0;
  if (value > 40) return 1;
  return 1 / (1 + Math.exp(-value));
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function min(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.min(...finite) : 0;
}

function max(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.max(...finite) : 0;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function round(value) {
  return Math.round(Number(value || 0) * 1e6) / 1e6;
}

function renderReport(result) {
  return `# Margin-Compatible Heldout Eval

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run evaluates frozen selectors on the 321-389 heldout packet. It makes no OpenAI calls, launches no rented compute, and does not fit on heldout rows.

| Policy | Pairs | Correct | Accuracy |
| --- | ---: | ---: | ---: |
| D262 replay | ${result.metrics.d262_pairwise.pairs} | ${result.metrics.d262_pairwise.correct} | ${pct(result.metrics.d262_pairwise.accuracy)} |
| Hard-negative replay | ${result.metrics.hard_negative_pairwise.pairs} | ${result.metrics.hard_negative_pairwise.correct} | ${pct(result.metrics.hard_negative_pairwise.accuracy)} |
| Frozen D280 | ${result.metrics.d280_frozen_pairwise.pairs} | ${result.metrics.d280_frozen_pairwise.correct} | ${pct(result.metrics.d280_frozen_pairwise.accuracy)} |

Frozen D280 selection: ${result.metrics.d280_frozen_selection.selected_supported}/${result.metrics.d280_frozen_selection.examples} supported (${pct(result.metrics.d280_frozen_selection.selection_support_rate)}).

## Decision

- Promote D280 now: ${result.decision.promote_d280_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Build larger compatible non-final heldout next: ${result.decision.build_larger_margin_compatible_nonfinal_heldout_next ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
}

function pct(value) {
  return `${(100 * Number(value || 0)).toFixed(1)}%`;
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

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
