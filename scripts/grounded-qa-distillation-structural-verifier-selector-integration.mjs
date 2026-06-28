import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const reportsDir = path.join(experimentDir, "reports");

const runId = "structural-verifier-selector-integration-final-window-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const sourceRunId = "contract-aware-candidate-selector-final-window-v1";
const calibratedHybridRunId = "calibrated-hybrid-selector-final-window-v1";
const structuralAuditRunId = "structural-target-verifier-audit-0-320-to-321-389-2026-06-28-v1";
const split = "extended_temporal_future_holdout";
const evalOffset = 320;
const evalLimit = 69;

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceRows = await readJsonl(path.join(runsDir, sourceRunId, "rows.jsonl"));
const calibratedHybrid = await readJson(path.join(runsDir, calibratedHybridRunId, "result.json"));
const calibratedHybridRows = await readJsonl(path.join(runsDir, calibratedHybridRunId, "predictions.jsonl"));
const structuralAudit = await readJson(path.join(runsDir, structuralAuditRunId, "result.json"));
const references = (await readJsonl(path.join(dataDir, `${split}.jsonl`))).slice(evalOffset, evalOffset + evalLimit);
const referenceById = new Map(references.map((row) => [row.example_id, row]));

const policy = structuralAudit.selected_by_nonfinal_labels;
const threshold = policy.threshold;
const weights = policy.weights;
const rowsWithScores = sourceRows.map((row) => attachStructuralScores(row, referenceById.get(row.example_id), weights));
const scaffoldRows = rowsWithScores.map(selectScaffoldPriority);
const abstentionSwitchRows = rowsWithScores.map((row) => selectStructuralSwitch(row, threshold));
const allCandidateRows = rowsWithScores.map((row) => selectStructuralAllCandidates(row, threshold));
const conservativeRows = rowsWithScores.map((row) => selectStructuralConservative(row, threshold));
const calibratedHybridById = new Map(calibratedHybridRows.map((row) => [row.example_id, row]));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "structural_verifier_selector_integration",
  status: statusFor({ conservative: summarizeSelections(conservativeRows), calibrated: calibratedHybrid.selection_metrics.calibrated_hybrid }),
  purpose: "Integrate D316's structural target-completeness verifier into the final-window answer-selection scaffold and compare against the current calibrated hybrid without new labels or compute.",
  source_runs: {
    contract_aware_candidate_selector: sourceRunId,
    calibrated_hybrid_selector: calibratedHybridRunId,
    structural_target_verifier_audit: structuralAuditRunId,
  },
  split,
  eval_offset: evalOffset,
  examples: sourceRows.length,
  structural_policy: {
    policy_id: policy.policy_id,
    threshold,
    weights,
    d316_nonfinal_balanced_accuracy: policy.nonfinal_candidate_labels.balanced_accuracy,
    d316_final_pair_transfer_accuracy: policy.final_pair_transfer.accuracy,
  },
  selection_metrics: {
    scaffold_priority: summarizeSelections(scaffoldRows),
    calibrated_hybrid: calibratedHybrid.selection_metrics.calibrated_hybrid,
    structural_abstention_switch: summarizeSelections(abstentionSwitchRows),
    structural_all_candidates: summarizeSelections(allCandidateRows),
    structural_conservative: summarizeSelections(conservativeRows),
  },
  switch_analysis: {
    structural_abstention_switch: summarizeSwitches(abstentionSwitchRows, scaffoldRows),
    structural_all_candidates: summarizeSwitches(allCandidateRows, scaffoldRows),
    structural_conservative_vs_calibrated: summarizeAgainstExisting(conservativeRows, calibratedHybridById),
  },
  gap_analysis: gapAnalysis({
    conservative: summarizeSelections(conservativeRows),
    abstentionSwitch: summarizeSelections(abstentionSwitchRows),
    allCandidates: summarizeSelections(allCandidateRows),
    calibrated: calibratedHybrid.selection_metrics.calibrated_hybrid,
    scaffold: summarizeSelections(scaffoldRows),
  }),
  decision: decisionFromResult({
    conservative: summarizeSelections(conservativeRows),
    abstentionSwitch: summarizeSelections(abstentionSwitchRows),
    allCandidates: summarizeSelections(allCandidateRows),
    calibrated: calibratedHybrid.selection_metrics.calibrated_hybrid,
  }),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_transfer: true,
    inherited_judgments_used_for_reporting_only: true,
    structural_policy_selected_from_nonfinal_labels: true,
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
    note: "Zero-call selector integration over existing final-window candidate predictions and inherited judge labels.",
  },
  artifacts: {
    rows_with_structural_scores_jsonl: rel(path.join(outputDir, "rows_with_structural_scores.jsonl")),
    structural_abstention_switch_predictions_jsonl: rel(path.join(outputDir, "structural_abstention_switch_predictions.jsonl")),
    structural_all_candidates_predictions_jsonl: rel(path.join(outputDir, "structural_all_candidates_predictions.jsonl")),
    structural_conservative_predictions_jsonl: rel(path.join(outputDir, "structural_conservative_predictions.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "rows_with_structural_scores.jsonl"), rowsWithScores);
await writeJsonl(path.join(outputDir, "structural_abstention_switch_predictions.jsonl"), abstentionSwitchRows);
await writeJsonl(path.join(outputDir, "structural_all_candidates_predictions.jsonl"), allCandidateRows);
await writeJsonl(path.join(outputDir, "structural_conservative_predictions.jsonl"), conservativeRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selection_metrics: result.selection_metrics,
  switch_analysis: result.switch_analysis,
  gap_analysis: result.gap_analysis,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function attachStructuralScores(row, reference, policyWeights) {
  if (!reference) throw new Error(`Missing reference for ${row.example_id}`);
  return {
    ...row,
    candidates: row.candidates.map((candidate) => {
      const features = structuralFeatures(reference.input.question, reference.input.compact_retrieved_evidence_pack, candidate.prediction);
      return {
        ...candidate,
        structural_target: {
          score: structuralScore(features, policyWeights),
          features,
        },
      };
    }),
  };
}

function selectStructuralSwitch(row, thresholdValue) {
  const base = scaffoldPriorityCandidate(row);
  if (base?.prediction?.answer_type === "grounded_answer") {
    return selectionRow(row, base, "structural_abstention_switch", "keep_scaffold_answer", []);
  }
  const candidate = structuralAnswerCandidates(row, thresholdValue)[0];
  return selectionRow(
    row,
    candidate ?? base,
    "structural_abstention_switch",
    candidate ? "switch_scaffold_abstention_to_structural_answer" : "keep_scaffold_abstention",
    candidate ? ["structural_target_score_cleared_threshold"] : ["no_structural_answer_cleared_threshold"],
  );
}

function selectStructuralAllCandidates(row, thresholdValue) {
  const candidate = structuralAnswerCandidates(row, thresholdValue)[0];
  if (candidate) return selectionRow(row, candidate, "structural_all_candidates", "select_best_structural_answer", ["structural_target_score_cleared_threshold"]);
  const base = scaffoldPriorityCandidate(row);
  return selectionRow(row, base, "structural_all_candidates", "fallback_scaffold_priority", ["no_structural_answer_cleared_threshold"]);
}

function selectStructuralConservative(row, thresholdValue) {
  const base = scaffoldPriorityCandidate(row);
  if (base?.prediction?.answer_type === "grounded_answer") {
    const baseScore = Number(base.structural_target?.score ?? 0);
    if (baseScore >= thresholdValue || base.supported_answer) {
      return selectionRow(row, base, "structural_conservative", "keep_scaffold_answer", baseScore >= thresholdValue ? ["base_structural_score_cleared_threshold"] : ["base_inherited_supported_answer"]);
    }
    const replacement = structuralAnswerCandidates(row, thresholdValue).find((candidate) => candidate.id !== base.id);
    if (replacement && replacement.structural_target.score >= baseScore + 0.08) {
      return selectionRow(row, replacement, "structural_conservative", "replace_low_structural_scaffold_answer", ["replacement_structural_margin"]);
    }
    return selectionRow(row, base, "structural_conservative", "keep_scaffold_answer_below_threshold", ["no_replacement_margin"]);
  }
  const candidate = structuralAnswerCandidates(row, thresholdValue)[0];
  return selectionRow(
    row,
    candidate ?? base,
    "structural_conservative",
    candidate ? "switch_scaffold_abstention_to_structural_answer" : "keep_scaffold_abstention",
    candidate ? ["structural_target_score_cleared_threshold"] : ["no_structural_answer_cleared_threshold"],
  );
}

function structuralAnswerCandidates(row, thresholdValue) {
  if (row.counterfactual) return [];
  return row.candidates
    .filter((candidate) => candidate.prediction?.answer_type === "grounded_answer")
    .filter((candidate) => candidate.contract?.answer_citation_complete === true)
    .filter((candidate) => Number(candidate.structural_target?.score ?? 0) >= thresholdValue)
    .sort((left, right) =>
      Number(right.structural_target?.score ?? 0) - Number(left.structural_target?.score ?? 0)
      || Number(right.heuristic_score ?? 0) - Number(left.heuristic_score ?? 0)
      || left.id.localeCompare(right.id)
    );
}

function selectScaffoldPriority(row) {
  return selectionRow(row, scaffoldPriorityCandidate(row), "scaffold_priority_selector", "scaffold_priority", []);
}

function scaffoldPriorityCandidate(row) {
  return ["claim_entailment_guard", "balanced_risk_gate", "direct_mini_repair"]
    .map((id) => row.candidates.find((candidate) => candidate.id === id))
    .find(Boolean)
    ?? row.candidates[0];
}

function selectionRow(row, selected, selectorType, decision, reasons) {
  return {
    example_id: row.example_id,
    selector_type: selectorType,
    selected_candidate_id: selected?.id ?? null,
    selected_family: selected?.family ?? null,
    selection_decision: decision,
    selection_reasons: reasons,
    prediction: selected?.prediction ?? null,
    reference: row.reference,
    inherited_judgment: selected?.judgment ?? null,
    selection_scores: {
      supported_answer: selected?.supported_answer ?? false,
      supported_abstention: selected?.supported_abstention ?? false,
      judged_correct: selected?.supported_answer === true || selected?.supported_abstention === true,
      answer_type_correct: selected?.answer_type_correct ?? false,
      answer_citation_complete: selected?.contract?.answer_citation_complete ?? false,
      heuristic_score: selected?.heuristic_score ?? null,
      structural_target_score: selected?.structural_target?.score ?? null,
    },
    candidate_summary: Object.fromEntries(row.candidates.map((candidate) => [candidate.id, {
      family: candidate.family,
      answered: candidate.answered,
      supported_answer: candidate.supported_answer,
      supported_abstention: candidate.supported_abstention,
      judged_correct: candidate.judged_correct,
      answer_citation_complete: candidate.contract?.answer_citation_complete ?? false,
      heuristic_score: candidate.heuristic_score,
      structural_target_score: candidate.structural_target?.score ?? null,
    }])),
  };
}

function summarizeSelections(rows) {
  const answered = rows.filter((row) => row.prediction?.answer_type === "grounded_answer");
  const abstained = rows.filter((row) => row.prediction?.answer_type === "abstain");
  const supportedAnswers = answered.filter((row) => row.selection_scores.supported_answer);
  const supportedAbstentions = abstained.filter((row) => row.selection_scores.supported_abstention);
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: rate(answered.length, rows.length),
    answer_support_rate: rate(supportedAnswers.length, answered.length),
    abstention_support_rate: rate(supportedAbstentions.length, abstained.length),
    overall_judged_correct_rate: rate(supportedAnswers.length + supportedAbstentions.length, rows.length),
    answer_type_accuracy: rate(rows.filter((row) => row.selection_scores.answer_type_correct).length, rows.length),
    answer_citation_complete_rate: rate(answered.filter((row) => row.selection_scores.answer_citation_complete).length, answered.length),
    supported_answers: supportedAnswers.length,
    supported_abstentions: supportedAbstentions.length,
    policy_mix: groupCount(rows.map((row) => row.selected_candidate_id ?? "missing")),
    family_mix: groupCount(rows.map((row) => row.selected_family ?? "missing")),
  };
}

function summarizeSwitches(rows, baselineRows) {
  const baselineById = new Map(baselineRows.map((row) => [row.example_id, row]));
  const switched = rows.filter((row) => row.selected_candidate_id !== baselineById.get(row.example_id)?.selected_candidate_id);
  return {
    switches: switched.length,
    supported_answer_switches: switched.filter((row) => row.selection_scores.supported_answer).length,
    unsupported_answer_switches: switched.filter((row) => row.prediction?.answer_type === "grounded_answer" && !row.selection_scores.supported_answer).length,
    harmful_switches_from_correct_baseline: switched.filter((row) => baselineById.get(row.example_id)?.selection_scores.judged_correct && !row.selection_scores.judged_correct).length,
    helpful_switches_from_incorrect_baseline: switched.filter((row) => !baselineById.get(row.example_id)?.selection_scores.judged_correct && row.selection_scores.judged_correct).length,
    switch_ids: switched.map((row) => row.example_id),
  };
}

function summarizeAgainstExisting(rows, existingById) {
  const changed = rows.filter((row) => row.selected_candidate_id !== existingById.get(row.example_id)?.selected_candidate_id);
  return {
    changes: changed.length,
    structural_supported_answers_on_changed: changed.filter((row) => row.selection_scores.supported_answer).length,
    structural_unsupported_answers_on_changed: changed.filter((row) => row.prediction?.answer_type === "grounded_answer" && !row.selection_scores.supported_answer).length,
    inherited_hybrid_correct_lost: changed.filter((row) => existingById.get(row.example_id)?.selection_scores?.judged_correct && !row.selection_scores.judged_correct).length,
    inherited_hybrid_incorrect_rescued: changed.filter((row) => !existingById.get(row.example_id)?.selection_scores?.judged_correct && row.selection_scores.judged_correct).length,
  };
}

function gapAnalysis({ conservative, abstentionSwitch, allCandidates, calibrated, scaffold }) {
  return {
    conservative_minus_calibrated_answer_rate: conservative.answer_rate - calibrated.answer_rate,
    conservative_minus_calibrated_answer_support_rate: conservative.answer_support_rate - calibrated.answer_support_rate,
    conservative_minus_calibrated_overall_correct_rate: conservative.overall_judged_correct_rate - calibrated.overall_judged_correct_rate,
    abstention_switch_minus_scaffold_supported_answers: abstentionSwitch.supported_answers - scaffold.supported_answers,
    all_candidates_minus_calibrated_supported_answers: allCandidates.supported_answers - calibrated.supported_answers,
  };
}

function statusFor({ conservative, calibrated }) {
  if (conservative.answer_rate >= calibrated.answer_rate && conservative.answer_support_rate >= calibrated.answer_support_rate && conservative.overall_judged_correct_rate >= calibrated.overall_judged_correct_rate) {
    return "structural_selector_dominates_calibrated_hybrid";
  }
  if (conservative.supported_answers > calibrated.supported_answers && conservative.overall_judged_correct_rate >= calibrated.overall_judged_correct_rate) {
    return "structural_selector_supported_answer_gain";
  }
  return "structural_selector_not_integrated";
}

function decisionFromResult({ conservative, abstentionSwitch, allCandidates, calibrated }) {
  if (conservative.answer_rate >= calibrated.answer_rate && conservative.answer_support_rate >= calibrated.answer_support_rate && conservative.overall_judged_correct_rate >= calibrated.overall_judged_correct_rate) {
    return {
      integrate_structural_selector_now: true,
      replace_calibrated_hybrid_now: true,
      train_student_on_gpu_now: false,
      buy_more_openai_labels_now: false,
      launch_gpu_now: false,
      next_step: "Promote structural-conservative selection as the deployable final-window scaffold, then run paper-readiness gates before any student training.",
      reason: `Structural-conservative matches or improves calibrated hybrid on answer rate (${pct(conservative.answer_rate)}), answer support (${pct(conservative.answer_support_rate)}), and overall correctness (${pct(conservative.overall_judged_correct_rate)}).`,
    };
  }
  if (abstentionSwitch.supported_answers > calibrated.supported_answers || allCandidates.supported_answers > calibrated.supported_answers) {
    return {
      integrate_structural_selector_now: false,
      replace_calibrated_hybrid_now: false,
      train_student_on_gpu_now: false,
      buy_more_openai_labels_now: false,
      launch_gpu_now: false,
      next_step: "Use structural target score as an analysis feature, but tune a non-final selector objective before replacing the calibrated hybrid.",
      reason: `Structural policies recover supported answers but do not dominate calibrated hybrid across support and overall correctness.`,
    };
  }
  return {
    integrate_structural_selector_now: false,
    replace_calibrated_hybrid_now: false,
    train_student_on_gpu_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Keep D316 as a pairwise verifier component and mine non-final listwise selection labels before any GPU student run.",
    reason: `Structural selection does not beat calibrated hybrid: calibrated answer support is ${pct(calibrated.answer_support_rate)} with ${calibrated.supported_answers} supported answers.`,
  };
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
  const requiresNumber = qType === "numeric";
  const requiresList = qType === "list_or_entity";
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
  const textTokens = contentTokens(text);
  values.push(...targetRequirementTokens(question).filter((token) => textTokens.includes(token)));
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

function renderReport(result) {
  const metrics = result.selection_metrics;
  return `# Structural Verifier Selector Integration

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no API calls and launches no compute. It applies D316's selected structural target-completeness policy to the existing final-window candidate pool and reports inherited-judgment metrics.

## Metrics

| Selector | Answer rate | Answer support | Overall correct | Supported answers |
| --- | ---: | ---: | ---: | ---: |
| Scaffold priority | ${pct(metrics.scaffold_priority.answer_rate)} | ${pct(metrics.scaffold_priority.answer_support_rate)} | ${pct(metrics.scaffold_priority.overall_judged_correct_rate)} | ${metrics.scaffold_priority.supported_answers} |
| Calibrated hybrid | ${pct(metrics.calibrated_hybrid.answer_rate)} | ${pct(metrics.calibrated_hybrid.answer_support_rate)} | ${pct(metrics.calibrated_hybrid.overall_judged_correct_rate)} | ${metrics.calibrated_hybrid.supported_answers} |
| Structural abstention switch | ${pct(metrics.structural_abstention_switch.answer_rate)} | ${pct(metrics.structural_abstention_switch.answer_support_rate)} | ${pct(metrics.structural_abstention_switch.overall_judged_correct_rate)} | ${metrics.structural_abstention_switch.supported_answers} |
| Structural all-candidates | ${pct(metrics.structural_all_candidates.answer_rate)} | ${pct(metrics.structural_all_candidates.answer_support_rate)} | ${pct(metrics.structural_all_candidates.overall_judged_correct_rate)} | ${metrics.structural_all_candidates.supported_answers} |
| Structural conservative | ${pct(metrics.structural_conservative.answer_rate)} | ${pct(metrics.structural_conservative.answer_support_rate)} | ${pct(metrics.structural_conservative.overall_judged_correct_rate)} | ${metrics.structural_conservative.supported_answers} |

## Decision

- Integrate structural selector now: ${result.decision.integrate_structural_selector_now ? "yes" : "no"}
- Replace calibrated hybrid now: ${result.decision.replace_calibrated_hybrid_now ? "yes" : "no"}
- Train student on GPU now: ${result.decision.train_student_on_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function groupCount(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
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

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
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
