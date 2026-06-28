import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const runId = "structural-target-verifier-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const labelRunIds = [
  "question-target-label-batch-run-gpt4o-mini-2026-06-28-v1",
  "hard-target-label-batch-run-gpt4o-mini-2026-06-28-v1",
];
const combinedVerifierRunId = "combined-target-text-verifier-audit-0-320-to-321-389-2026-06-28-v1";
const disagreementRunId = "combined-verifier-disagreement-audit-321-389-2026-06-28-v1";
const finalPacketRunId = "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const combinedVerifier = await readJson(path.join(runsDir, combinedVerifierRunId, "result.json"));
const disagreement = await readJson(path.join(runsDir, disagreementRunId, "result.json"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
const d314PredictionById = new Map(
  (await readJsonl(path.join(runsDir, combinedVerifierRunId, "selected_final_predictions.jsonl")))
    .map((row) => [row.pair_id, row])
);

const trainExamples = [];
const labelRunSummaries = [];
for (const labelRunId of labelRunIds) {
  const result = await readJson(path.join(runsDir, labelRunId, "result.json"));
  const requests = await readJsonl(path.join(runsDir, labelRunId, "requests.jsonl"));
  const judgments = await readJsonl(path.join(runsDir, labelRunId, "judgments.jsonl"));
  const examples = buildCandidateExamples(labelRunId, judgments, new Map(requests.map((row) => [row.request_id, row])));
  trainExamples.push(...examples);
  labelRunSummaries.push({
    run_id: labelRunId,
    calls_made: result.calls_made,
    run_cost_usd: result.run_cost_usd,
    primary_judged: result.metrics?.primary_judged,
    chosen_preferred_primary: result.metrics?.chosen_preferred_primary,
  });
}

const policies = buildPolicies();
const thresholds = [0.34, 0.38, 0.42, 0.46, 0.50, 0.54, 0.58, 0.62, 0.66];
const policyRows = [];
const finalPredictionsByPolicy = new Map();
for (const policy of policies) {
  for (const threshold of thresholds) {
    const row = evaluatePolicy(policy, threshold, trainExamples, finalPairs);
    policyRows.push(row.metrics);
    finalPredictionsByPolicy.set(row.metrics.policy_id, row.final_predictions);
  }
}

const selected = [...policyRows].sort((left, right) =>
  -left.nonfinal_candidate_labels.balanced_accuracy + right.nonfinal_candidate_labels.balanced_accuracy
  || -left.nonfinal_candidate_labels.accuracy + right.nonfinal_candidate_labels.accuracy
  || -left.final_pair_transfer.accuracy + right.final_pair_transfer.accuracy
  || left.policy_id.localeCompare(right.policy_id)
)[0];
const bestFinal = [...policyRows].sort((left, right) =>
  -left.final_pair_transfer.accuracy + right.final_pair_transfer.accuracy
  || -left.nonfinal_candidate_labels.balanced_accuracy + right.nonfinal_candidate_labels.balanced_accuracy
  || left.policy_id.localeCompare(right.policy_id)
)[0];
const selectedPredictions = finalPredictionsByPolicy.get(selected.policy_id);
const combinedSelected = combinedVerifier.selected_by_nonfinal_loo;
const promotable = selected.nonfinal_candidate_labels.balanced_accuracy >= 0.65 && selected.final_pair_transfer.accuracy >= 0.70;
const finalGain = selected.final_pair_transfer.accuracy - combinedSelected.final_pair_transfer.accuracy;
const reliabilityGain = selected.nonfinal_candidate_labels.balanced_accuracy - combinedSelected.nonfinal_leave_one_out.balanced_accuracy;
const rescuedD314Errors = selectedPredictions.filter((row) => row.correct && row.d314_correct === false).length;
const lostD314Correct = selectedPredictions.filter((row) => !row.correct && row.d314_correct === true).length;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "structural_target_verifier_audit",
  status: promotable ? "structural_verifier_promotable_as_scaffold_component" : "structural_verifier_not_promotable",
  purpose: "Test whether deterministic question-requirement, slot-coverage, and citation-contract features fix D315 target-completeness failures before any GPU spend.",
  source_runs: {
    label_runs: labelRunIds,
    combined_target_text_verifier_audit: combinedVerifierRunId,
    combined_verifier_disagreement_audit: disagreementRunId,
    final_margin_compatible_heldout_packet: finalPacketRunId,
  },
  label_run_summaries: labelRunSummaries,
  data: {
    candidate_training_examples: trainExamples.length,
    candidate_training_positive: trainExamples.filter((row) => row.label).length,
    candidate_training_negative: trainExamples.filter((row) => !row.label).length,
    final_pairwise_rows: finalPairs.length,
    policies_evaluated: policyRows.length,
  },
  selected_by_nonfinal_labels: selected,
  diagnostic_best_final_policy: bestFinal,
  d314_comparison: {
    d314_selected_policy_id: combinedSelected.policy_id,
    d314_nonfinal_balanced_accuracy: combinedSelected.nonfinal_leave_one_out.balanced_accuracy,
    d314_final_pair_accuracy: combinedSelected.final_pair_transfer.accuracy,
    nonfinal_balanced_accuracy_delta: reliabilityGain,
    final_pair_accuracy_delta: finalGain,
    d314_final_errors: combinedSelected.final_pair_transfer.errors,
    selected_final_errors: selected.final_pair_transfer.errors,
    rescued_d314_errors: rescuedD314Errors,
    lost_d314_correct: lostD314Correct,
  },
  d315_context: {
    d315_final_errors: disagreement.rows?.errors,
    d315_near_miss_errors: disagreement.rows?.near_miss_errors_abs_margin_lt_0_02,
    d315_confident_errors: disagreement.rows?.confident_errors_abs_margin_gte_0_10,
  },
  decision: decisionFromResult(promotable, selected, bestFinal, finalGain, reliabilityGain),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_transfer: true,
    paid_label_rows_training_use: "allowed_nonfinal_structural_policy_selection",
    final_pair_rows_training_use: "forbidden_final_window_reporting_only",
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
    note: "Zero-call deterministic audit over already-paid non-final labels and frozen final pair metadata.",
  },
  artifacts: {
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    selected_final_predictions_jsonl: rel(path.join(outputDir, "selected_final_predictions.jsonl")),
    feature_rows_jsonl: rel(path.join(outputDir, "feature_rows.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), policyRows);
await writeJsonl(path.join(outputDir, "selected_final_predictions.jsonl"), selectedPredictions);
await writeJsonl(path.join(outputDir, "feature_rows.jsonl"), selectedPredictions.map(({ chosen_features, rejected_features, ...row }) => ({
  ...row,
  chosen_features,
  rejected_features,
})));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_by_nonfinal_labels: result.selected_by_nonfinal_labels,
  d314_comparison: result.d314_comparison,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function buildCandidateExamples(labelRunId, judgments, requestById) {
  const examples = [];
  for (const judgment of judgments) {
    if (judgment.skipped || judgment.duplicate_calibration) continue;
    const request = requestById.get(judgment.request_id);
    if (!request) continue;
    const input = request.input;
    examples.push({
      example_id: `${labelRunId}:${judgment.request_id}:chosen`,
      root_example_id: judgment.root_example_id,
      request_id: judgment.request_id,
      candidate_role: "chosen",
      question: input.question,
      evidence_pack: input.evidence_pack,
      candidate: input.candidate_chosen,
      label: Boolean(judgment.judgment?.chosen_question_target_complete),
    });
    examples.push({
      example_id: `${labelRunId}:${judgment.request_id}:rejected`,
      root_example_id: judgment.root_example_id,
      request_id: judgment.request_id,
      candidate_role: "rejected",
      question: input.question,
      evidence_pack: input.evidence_pack,
      candidate: input.candidate_rejected,
      label: Boolean(judgment.judgment?.rejected_question_target_complete),
    });
  }
  return examples;
}

function buildPolicies() {
  return [
    policy("balanced_slots", { support: 0.18, citation: 0.16, target: 0.18, numeric: 0.14, entity: 0.14, abstain: 0.08, concision: 0.07, unsupported: 0.22, overanswer: 0.08 }),
    policy("strict_citation_slots", { support: 0.16, citation: 0.24, target: 0.16, numeric: 0.12, entity: 0.12, abstain: 0.08, concision: 0.04, unsupported: 0.30, overanswer: 0.10 }),
    policy("target_scope_heavy", { support: 0.14, citation: 0.14, target: 0.26, numeric: 0.18, entity: 0.18, abstain: 0.05, concision: 0.05, unsupported: 0.20, overanswer: 0.12 }),
    policy("recall_heavy", { support: 0.12, citation: 0.12, target: 0.20, numeric: 0.22, entity: 0.22, abstain: 0.04, concision: 0.02, unsupported: 0.16, overanswer: 0.05 }),
    policy("support_first", { support: 0.28, citation: 0.22, target: 0.12, numeric: 0.08, entity: 0.08, abstain: 0.08, concision: 0.04, unsupported: 0.26, overanswer: 0.08 }),
  ];
}

function policy(id, weights) {
  return { id, weights };
}

function evaluatePolicy(policyRow, threshold, trainExamples, finalPairs) {
  const trainPredictions = trainExamples.map((row) => {
    const features = structuralFeatures(row.question, row.evidence_pack, row.candidate);
    const score = structuralScore(features, policyRow.weights);
    const predicted = score >= threshold;
    return { ...row, score, predicted, correct: predicted === row.label, features };
  });
  const positives = trainPredictions.filter((row) => row.label);
  const negatives = trainPredictions.filter((row) => !row.label);
  const positiveCorrect = positives.filter((row) => row.correct).length;
  const negativeCorrect = negatives.filter((row) => row.correct).length;

  const finalPredictions = finalPairs.map((pair) => {
    const chosenFeatures = structuralFeatures(pair.input.question, pair.input.compact_retrieved_evidence_pack, pair.chosen);
    const rejectedFeatures = structuralFeatures(pair.input.question, pair.input.compact_retrieved_evidence_pack, pair.rejected);
    const chosenScore = structuralScore(chosenFeatures, policyRow.weights);
    const rejectedScore = structuralScore(rejectedFeatures, policyRow.weights);
    const predicted = chosenScore >= rejectedScore ? "chosen" : "rejected";
    return {
      pair_id: pair.pair_id,
      example_id: pair.example_id,
      source_index: pair.source_index,
      policy_id: `${policyRow.id}_t_${thresholdName(threshold)}`,
      predicted,
      expected: "chosen",
      correct: predicted === "chosen",
      d314_correct: d314Correct(pair.pair_id),
      chosen_score: chosenScore,
      rejected_score: rejectedScore,
      margin: chosenScore - rejectedScore,
      chosen_features: chosenFeatures,
      rejected_features: rejectedFeatures,
    };
  });
  const finalCorrect = finalPredictions.filter((row) => row.correct).length;
  const policyId = `${policyRow.id}_t_${thresholdName(threshold)}`;
  return {
    metrics: {
      policy_id: policyId,
      model: "deterministic_structural_target_completeness",
      target: "candidate_question_target_complete",
      threshold,
      weights: policyRow.weights,
      nonfinal_candidate_labels: {
        examples: trainPredictions.length,
        positive_examples: positives.length,
        negative_examples: negatives.length,
        accuracy: rate(trainPredictions.filter((row) => row.correct).length, trainPredictions.length),
        balanced_accuracy: (rate(positiveCorrect, positives.length) + rate(negativeCorrect, negatives.length)) / 2,
        positive_recall: rate(positiveCorrect, positives.length),
        negative_recall: rate(negativeCorrect, negatives.length),
        predicted_positive: trainPredictions.filter((row) => row.predicted).length,
      },
      final_pair_transfer: {
        pairs: finalPredictions.length,
        correct: finalCorrect,
        errors: finalPredictions.length - finalCorrect,
        accuracy: rate(finalCorrect, finalPredictions.length),
        mean_margin: mean(finalPredictions.map((row) => row.margin)),
        median_abs_margin: median(finalPredictions.map((row) => Math.abs(row.margin))),
      },
    },
    final_predictions: finalPredictions,
  };
}

function d314Correct(pairId) {
  return d314PredictionById.get(pairId)?.correct ?? null;
}

function structuralFeatures(question, evidencePack, candidate) {
  const answer = String(candidate.answer ?? "");
  const claims = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? claim ?? ""));
  const answerAndClaims = `${answer}\n${claims.join("\n")}`;
  const evidenceText = evidencePack.map((item) => `${item.section ?? ""} ${item.text ?? ""}`).join("\n");
  const relevantEvidence = relevantEvidenceText(question, evidencePack);
  const citations = candidate.citations ?? [];
  const claimCitations = (candidate.claim_table ?? []).flatMap((claim) => claim.citations ?? []);
  const evidenceIds = new Set(evidencePack.map((item) => item.evidence_id));
  const questionTokens = unique(contentTokens(question));
  const targetTokens = targetRequirementTokens(question);
  const answerTokens = unique(contentTokens(answerAndClaims));
  const evidenceSlotTokens = slotTokens(relevantEvidence || evidenceText, question);
  const answerSlotTokens = slotTokens(answerAndClaims, question);
  const qType = questionType(question);
  const requiresNumber = questionRequiresNumber(question);
  const requiresList = questionRequiresList(question);
  const answerNumbers = unique(numberValues(answerAndClaims));
  const evidenceNumbers = unique(numberValues(relevantEvidence || evidenceText));
  const answerEntities = unique(entityValues(answerAndClaims));
  const evidenceEntities = unique(entityValues(relevantEvidence || evidenceText));
  const validCitationCount = citations.filter((id) => evidenceIds.has(id)).length;
  const inlineCitationCount = citations.filter((id) => answer.includes(`[${id}]`)).length;
  const unsupportedCount = Number(candidate.unsupported_claim_count ?? (candidate.unsupported_claims ?? []).length ?? 0);
  const emptyAnswer = isEmptyAnswer(answer);
  const answerTokenCount = contentTokens(answer).length;
  const evidenceRelevantTokens = unique(contentTokens(relevantEvidence || evidenceText));
  const targetRecall = rate(intersection(answerTokens, targetTokens).length, targetTokens.length);
  const questionRecall = rate(intersection(answerTokens, questionTokens).length, questionTokens.length);
  const evidenceSlotRecall = rate(intersection(answerSlotTokens, evidenceSlotTokens).length, Math.min(evidenceSlotTokens.length, slotDenominator(qType)));
  const numericCoverage = requiresNumber ? rate(intersection(answerNumbers, evidenceNumbers).length, Math.min(evidenceNumbers.length, 2)) : 1;
  const entityCoverage = requiresList ? rate(intersection(answerEntities, evidenceEntities).length, Math.min(evidenceEntities.length, 4)) : 1;
  const citationContract = citations.length ? (0.5 * rate(validCitationCount, citations.length) + 0.5 * rate(inlineCitationCount, citations.length)) : 0;
  const claimCitationContract = claims.length ? rate(claimCitations.filter((id) => evidenceIds.has(id)).length, Math.max(claims.length, 1)) : citationContract;
  const support = Math.max(citationContract, claimCitationContract * 0.85);
  const abstainFit = candidate.answer_type === "abstain" ? (evidenceRelevantTokens.length < 5 ? 1 : 0.15) : (emptyAnswer ? 0 : 1);
  const concision = answerTokenCount <= 80 ? 1 : Math.max(0, 1 - ((answerTokenCount - 80) / 160));
  const overanswer = answerTokenCount > 0 && targetTokens.length ? Math.max(0, (answerTokenCount - (targetTokens.length * 18 + 40)) / 180) : 0;
  return {
    question_type: qType,
    answer_token_count: answerTokenCount,
    citation_count: citations.length,
    claim_count: claims.length,
    unsupported_count: unsupportedCount,
    support,
    citation_contract: citationContract,
    target_recall: Math.max(targetRecall, questionRecall * 0.6),
    evidence_slot_recall: clamp01(evidenceSlotRecall),
    numeric_coverage: clamp01(numericCoverage),
    entity_coverage: clamp01(entityCoverage),
    abstain_fit: abstainFit,
    concision,
    unsupported_penalty: clamp01(unsupportedCount / Math.max(1, claims.length || 1)),
    overanswer_penalty: clamp01(overanswer),
    empty_answer: emptyAnswer,
  };
}

function structuralScore(features, weights) {
  const positive =
    weights.support * features.support
    + weights.citation * features.citation_contract
    + weights.target * Math.max(features.target_recall, features.evidence_slot_recall)
    + weights.numeric * features.numeric_coverage
    + weights.entity * features.entity_coverage
    + weights.abstain * features.abstain_fit
    + weights.concision * features.concision;
  const penalty =
    weights.unsupported * features.unsupported_penalty
    + weights.overanswer * features.overanswer_penalty
    + (features.empty_answer ? 0.20 : 0);
  return clamp01(positive / positiveWeightSum(weights) - penalty);
}

function positiveWeightSum(weights) {
  return weights.support + weights.citation + weights.target + weights.numeric + weights.entity + weights.abstain + weights.concision;
}

function relevantEvidenceText(question, evidencePack) {
  const qTokens = new Set(contentTokens(question));
  return [...evidencePack]
    .map((item) => {
      const text = `${item.section ?? ""} ${item.text ?? ""}`;
      const overlap = contentTokens(text).filter((token) => qTokens.has(token)).length;
      return { text, overlap, rank: Number(item.retrieval_rank ?? 99) };
    })
    .sort((left, right) => right.overlap - left.overlap || left.rank - right.rank)
    .slice(0, 3)
    .map((item) => item.text)
    .join("\n");
}

function targetRequirementTokens(question) {
  const tokens = contentTokens(question);
  const anchors = new Set(["model", "models", "method", "methods", "dataset", "datasets", "baseline", "baselines", "approach", "approaches", "score", "rate", "percent", "percentage", "number", "amount", "size", "large", "larger", "smaller", "compare", "comparison", "task", "tasks", "feature", "features"]);
  const selected = tokens.filter((token) => anchors.has(token) || token.endsWith("s"));
  return unique(selected.length ? selected : tokens.slice(0, 8));
}

function slotTokens(text, question) {
  const qType = questionType(question);
  const values = [];
  if (qType === "numeric") values.push(...numberValues(text));
  if (qType === "list_or_entity") values.push(...entityValues(text));
  values.push(...targetRequirementTokens(question).filter((token) => contentTokens(text).includes(token)));
  return unique(values.map((value) => String(value).toLowerCase()));
}

function slotDenominator(questionTypeValue) {
  if (questionTypeValue === "numeric") return 3;
  if (questionTypeValue === "list_or_entity") return 5;
  return 4;
}

function questionType(question) {
  const text = String(question ?? "").toLowerCase();
  if (/\bhow many|how much|percentage|percent|number|amount|rate|score|points?|fewer|more|larger|smaller|size|large\b/.test(text)) return "numeric";
  if (/\bwhich|what models|what methods|what datasets|what types|list|models|methods|datasets|baselines|features|approaches|tasks\b/.test(text)) return "list_or_entity";
  if (/\bwhy|reason|motivat/.test(text)) return "explanation";
  if (/\bwhat\b/.test(text)) return "what";
  return "other";
}

function questionRequiresNumber(question) {
  return questionType(question) === "numeric";
}

function questionRequiresList(question) {
  return questionType(question) === "list_or_entity";
}

function contentTokens(text) {
  const stopwords = new Set("the a an and or of to in for with on by is are was were be been being as at from into about this that these those it its they their we our you your can could should would do does did how what which who when where why much many over under between using use used than then have has had include includes included only rely relies relying answer question evidence pack candidate model models method methods dataset datasets".split(" "));
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").match(/[a-z0-9]+/g)?.filter((token) => token.length > 2 && !stopwords.has(token)) ?? [];
}

function numberValues(text) {
  return String(text ?? "").toLowerCase().match(/\d+(?:,\d{3})*(?:\.\d+)?%?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million)\b/g)?.map((value) => value.replace(/,/g, "")) ?? [];
}

function entityValues(text) {
  const entities = String(text ?? "").match(/\b(?:[A-Z][A-Za-z0-9\-_/+]*|[A-Z]{2,})(?:\s+(?:with|of|and|for|to|in|[A-Z][A-Za-z0-9\-_/+]*|[A-Z]{2,})){0,4}\b/g) ?? [];
  return entities.map((value) => value.trim()).filter((value) => value.length > 2 && !/^\[[A-Z0-9]+\]$/.test(value));
}

function isEmptyAnswer(text) {
  return /^(\[empty answer\]|empty answer|no_answer)?$/i.test(String(text ?? "").trim());
}

function decisionFromResult(promotable, selected, bestFinal, finalGain, reliabilityGain) {
  if (promotable) {
    return {
      promote_structural_verifier_now: true,
      integrate_as_scaffold_component_now: true,
      train_student_on_gpu_now: false,
      buy_more_openai_labels_now: false,
      launch_gpu_now: false,
      next_step: "Integrate the selected structural target-completeness verifier into the answer-selection scaffold and rerun final system evaluation before student training.",
      reason: `The selected structural policy reaches ${pct(selected.nonfinal_candidate_labels.balanced_accuracy)} non-final balanced accuracy and ${pct(selected.final_pair_transfer.accuracy)} final transfer, improving final transfer by ${pct(finalGain)} over D314.`,
    };
  }
  return {
    promote_structural_verifier_now: false,
    integrate_as_scaffold_component_now: false,
    train_student_on_gpu_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: bestFinal.final_pair_transfer.accuracy > selected.final_pair_transfer.accuracy
      ? "Inspect why final-best structural policy is not selected by non-final labels; consider richer non-final hard labels or a learned structural verifier before GPU student training."
      : "Refine structural feature extraction before GPU student training.",
    reason: `The selected structural policy reaches ${pct(selected.nonfinal_candidate_labels.balanced_accuracy)} non-final balanced accuracy and ${pct(selected.final_pair_transfer.accuracy)} final transfer; reliability delta versus D314 is ${pct(reliabilityGain)} and final transfer delta is ${pct(finalGain)}.`,
  };
}

function renderReport(result) {
  const selected = result.selected_by_nonfinal_labels;
  const comparison = result.d314_comparison;
  return `# Structural Target Verifier Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no API calls and launches no GPU jobs. It tests deterministic question-requirement parsing, answer slot coverage, and citation-contract features against D309+D313 non-final labels, then reports transfer on the frozen final window.

## Selected Structural Policy

- Policy: ${selected.policy_id}
- Non-final balanced accuracy: ${selected.nonfinal_candidate_labels.balanced_accuracy.toFixed(3)}
- Non-final accuracy: ${selected.nonfinal_candidate_labels.accuracy.toFixed(3)}
- Final pair transfer: ${selected.final_pair_transfer.correct}/${selected.final_pair_transfer.pairs} (${pct(selected.final_pair_transfer.accuracy)})

## Comparison To D314

- D314 final pair transfer: ${pct(comparison.d314_final_pair_accuracy)}
- Structural final pair transfer delta: ${pct(comparison.final_pair_accuracy_delta)}
- D314 errors rescued: ${comparison.rescued_d314_errors}
- D314 correct pairs lost: ${comparison.lost_d314_correct}

## Decision

- Promote structural verifier now: ${result.decision.promote_structural_verifier_now ? "yes" : "no"}
- Integrate as scaffold component now: ${result.decision.integrate_as_scaffold_component_now ? "yes" : "no"}
- Train student on GPU now: ${result.decision.train_student_on_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function thresholdName(value) {
  return String(value).replace(".", "p");
}

function unique(values) {
  return [...new Set(values)];
}

function intersection(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function mean(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pct(value) {
  return `${(100 * Number(value)).toFixed(1)}%`;
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
