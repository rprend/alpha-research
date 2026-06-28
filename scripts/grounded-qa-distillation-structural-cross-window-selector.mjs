import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const reportsDir = path.join(experimentDir, "reports");
const runId = "structural-cross-window-selector-240-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const structuralAuditRunId = "structural-target-verifier-audit-0-320-to-321-389-2026-06-28-v1";
const baselineCrossWindowRunId = "candidate-selector-cross-window-240-320-to-321-389-v1";
const calibratedHybridRunId = "calibrated-hybrid-selector-final-window-v1";

const trainSpec = {
  id: "240-320",
  offset: 240,
  limit: 80,
  directRunId: "citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
  riskRunId: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  guardRunId: "claim-entailment-guard-balanced-risk-gate-240-389-v1",
  guardWindow: "241-320",
  directJudgeRunId: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
  riskJudgeRunId: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  guardJudgeRunId: "openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1",
};
const evalSpec = {
  id: "321-389",
  offset: 320,
  limit: 69,
  directRunId: "citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
  riskRunId: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  guardRunId: "claim-entailment-guard-balanced-risk-gate-240-389-v1",
  guardWindow: "321-389",
  directJudgeRunId: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
  riskJudgeRunId: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  guardJudgeRunId: "openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1",
};
const supportThresholds = [0.45, 0.5, 0.55, 0.6, 0.65, 0.7];
const structuralThresholds = [0.54, 0.58, 0.62, 0.66, 0.7, 0.74];
const answerRateFloor = 0.7;

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const structuralAudit = await readJson(path.join(runsDir, structuralAuditRunId, "result.json"));
const baselineCrossWindow = await readJson(path.join(runsDir, baselineCrossWindowRunId, "result.json"));
const calibratedHybrid = await readJson(path.join(runsDir, calibratedHybridRunId, "result.json"));
const references = await readJsonl(path.join(dataDir, "extended_temporal_future_holdout.jsonl"));
const structuralWeights = structuralAudit.selected_by_nonfinal_labels.weights;
const train = await loadSplit(trainSpec, structuralWeights, references);
const evaluation = await loadSplit(evalSpec, structuralWeights, references);

const rules = [];
for (const supportThreshold of supportThresholds) {
  for (const structuralThreshold of structuralThresholds) {
    for (const useGuard of [false, true]) {
      const trainRows = applyRule(train.rows, { supportThreshold, structuralThreshold, useGuard });
      const trainMetrics = summarize(trainRows);
      if (trainMetrics.answer_rate < answerRateFloor) continue;
      rules.push({
        rule_id: `support_${name(supportThreshold)}_struct_${name(structuralThreshold)}_${useGuard ? "guard" : "risk"}`,
        support_threshold: supportThreshold,
        structural_threshold: structuralThreshold,
        use_guard: useGuard,
        train_metrics: trainMetrics,
      });
    }
  }
}
const selectedRule = rules.sort(compareRules)[0] ?? {
  rule_id: "fallback_direct",
  support_threshold: 0,
  structural_threshold: 0,
  use_guard: false,
  train_metrics: summarize(train.rows.map((row) => chooseCandidate(row, "direct", "fallback_direct"))),
};
const trainRows = applyRule(train.rows, selectedRule);
const evalRows = applyRule(evaluation.rows, selectedRule);
const directRows = evaluation.rows.map((row) => chooseCandidate(row, "direct", "direct"));
const riskRows = evaluation.rows.map((row) => chooseCandidate(row, "risk", "risk"));
const guardRows = evaluation.rows.map((row) => chooseCandidate(row, "guard", "guard"));
const selectedMetrics = summarize(evalRows);
const calibratedMetrics = calibratedHybrid.selection_metrics.calibrated_hybrid;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "structural_cross_window_selector",
  status: statusFor(selectedMetrics, calibratedMetrics),
  purpose: "Tune a support-plus-structural abstention-preservation selector on 240-320 and test it on 321-389 without final-window tuning.",
  source_runs: {
    structural_target_verifier_audit: structuralAuditRunId,
    baseline_cross_window_selector: baselineCrossWindowRunId,
    calibrated_hybrid_selector: calibratedHybridRunId,
  },
  train_split: describeSplit(trainSpec, train),
  eval_split: describeSplit(evalSpec, evaluation),
  search_space: {
    answer_rate_floor: answerRateFloor,
    support_thresholds: supportThresholds,
    structural_thresholds: structuralThresholds,
    use_guard_values: [false, true],
    selected_rule: selectedRule,
    selection_objective: "Among train rules with answer_rate >= 70%, maximize overall judged correctness, then answer support, then answer rate, then prefer stricter structural threshold.",
  },
  baselines_on_eval: {
    direct_mini_citation_repair: summarize(directRows),
    balanced_support_risk_gate: summarize(riskRows),
    claim_entailment_guard: summarize(guardRows),
    previous_cross_window_selector: baselineCrossWindow.selected_rule_metrics.eval,
    calibrated_hybrid_final_selector: calibratedMetrics,
  },
  selected_rule_metrics: {
    train: summarize(trainRows),
    eval: selectedMetrics,
  },
  comparison: {
    selected_minus_previous_cross_window_overall_correct: selectedMetrics.overall_judged_correct_rate - baselineCrossWindow.selected_rule_metrics.eval.overall_judged_correct_rate,
    selected_minus_previous_cross_window_answer_support: selectedMetrics.answer_support_rate - baselineCrossWindow.selected_rule_metrics.eval.answer_support_rate,
    selected_minus_calibrated_hybrid_overall_correct: selectedMetrics.overall_judged_correct_rate - calibratedMetrics.overall_judged_correct_rate,
    selected_minus_calibrated_hybrid_answer_support: selectedMetrics.answer_support_rate - calibratedMetrics.answer_support_rate,
    selected_minus_calibrated_hybrid_answer_rate: selectedMetrics.answer_rate - calibratedMetrics.answer_rate,
  },
  decision: decisionFromResult(selectedMetrics, calibratedMetrics, baselineCrossWindow.selected_rule_metrics.eval),
  leakage_guard: {
    train_window: "240-320",
    final_window: "321-389",
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_reporting_transfer: true,
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
    note: "Zero-call audit over existing predictions, existing judge labels, and D316 structural features.",
  },
  artifacts: {
    train_predictions_jsonl: rel(path.join(outputDir, "train_predictions.jsonl")),
    eval_predictions_jsonl: rel(path.join(outputDir, "eval_predictions.jsonl")),
    rule_metrics_jsonl: rel(path.join(outputDir, "rule_metrics.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "train_predictions.jsonl"), trainRows);
await writeJsonl(path.join(outputDir, "eval_predictions.jsonl"), evalRows);
await writeJsonl(path.join(outputDir, "rule_metrics.jsonl"), rules);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_rule: result.search_space.selected_rule,
  selected_rule_metrics: result.selected_rule_metrics,
  comparison: result.comparison,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

async function loadSplit(spec, policyWeights, referenceRows) {
  const referenceById = new Map(referenceRows.slice(spec.offset, spec.offset + spec.limit).map((row) => [row.example_id, row]));
  const directRows = byId(await readJsonl(path.join(runsDir, spec.directRunId, "predictions.jsonl")));
  const riskRows = byId(await readJsonl(path.join(runsDir, spec.riskRunId, "predictions.jsonl")));
  const guardRows = byId((await readJsonl(path.join(runsDir, spec.guardRunId, "predictions.jsonl"))).filter((row) => row.window === spec.guardWindow));
  const directJudgments = byId(await readJsonl(path.join(runsDir, spec.directJudgeRunId, "judgments.jsonl")));
  const riskJudgments = byId(await readJsonl(path.join(runsDir, spec.riskJudgeRunId, "judgments.jsonl")));
  const guardJudgments = byId((await readJsonl(path.join(runsDir, spec.guardJudgeRunId, "judgments.jsonl"))).filter((row) => guardRows.has(row.example_id)));
  const ids = [...directRows.keys()].filter((id) => riskRows.has(id) && guardRows.has(id) && referenceById.has(id));
  return {
    rows: ids.map((id) => {
      const reference = referenceById.get(id);
      return {
        example_id: id,
        support_score: Number(riskRows.get(id).metadata?.support_score),
        candidates: {
          direct: candidate("direct", directRows.get(id), directJudgments.get(id), reference, policyWeights),
          risk: candidate("risk", riskRows.get(id), riskJudgments.get(id), reference, policyWeights),
          guard: candidate("guard", guardRows.get(id), guardJudgments.get(id), reference, policyWeights),
        },
      };
    }),
  };
}

function candidate(policy, predictionRow, judgmentRow, reference, policyWeights) {
  const prediction = predictionRow.prediction;
  const structuralFeaturesRow = structuralFeatures(reference.input.question, reference.input.compact_retrieved_evidence_pack, prediction);
  return {
    policy,
    prediction,
    judgment: judgmentRow?.judgment ?? null,
    structural_target_score: structuralScore(structuralFeaturesRow, policyWeights),
    structural_features: structuralFeaturesRow,
  };
}

function applyRule(rows, rule) {
  return rows.map((row) => {
    const direct = row.candidates.direct;
    if (direct.prediction?.answer_type !== "grounded_answer") return chooseCandidate(row, "direct", "direct_already_abstains");
    if (row.support_score >= rule.support_threshold && direct.structural_target_score >= rule.structural_threshold) {
      return chooseCandidate(row, "direct", `support_${fmt(row.support_score)}_struct_${fmt(direct.structural_target_score)}_passed`);
    }
    const fallback = rule.use_guard ? "guard" : "risk";
    return chooseCandidate(row, fallback, `support_or_structural_guard_failed_${fallback}`);
  });
}

function chooseCandidate(row, policy, reason) {
  const selected = row.candidates[policy];
  const answerType = selected.prediction?.answer_type;
  const supportedAnswer = answerType === "grounded_answer" && isSupportedAnswer(selected.judgment);
  const supportedAbstention = answerType === "abstain" && isSupportedAbstention(selected.judgment);
  return {
    example_id: row.example_id,
    selected_policy: policy,
    selected_reason: reason,
    support_score: row.support_score,
    structural_target_score: selected.structural_target_score,
    prediction: selected.prediction,
    inherited_judgment: selected.judgment,
    scores: {
      supported_answer: supportedAnswer,
      supported_abstention: supportedAbstention,
      overall_correct: supportedAnswer || supportedAbstention,
    },
  };
}

function summarize(rows) {
  const answered = rows.filter((row) => row.prediction?.answer_type === "grounded_answer");
  const abstained = rows.filter((row) => row.prediction?.answer_type === "abstain");
  const supportedAnswers = answered.filter((row) => row.scores.supported_answer);
  const supportedAbstentions = abstained.filter((row) => row.scores.supported_abstention);
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: rate(answered.length, rows.length),
    answer_support_rate: rate(supportedAnswers.length, answered.length),
    abstention_support_rate: rate(supportedAbstentions.length, abstained.length),
    overall_judged_correct_rate: rate(supportedAnswers.length + supportedAbstentions.length, rows.length),
    supported_answers: supportedAnswers.length,
    supported_abstentions: supportedAbstentions.length,
    unsupported_answers: answered.length - supportedAnswers.length,
    unsupported_abstentions: abstained.length - supportedAbstentions.length,
    policy_mix: countBy(rows.map((row) => row.selected_policy)),
  };
}

function compareRules(a, b) {
  for (const key of ["overall_judged_correct_rate", "answer_support_rate", "answer_rate"]) {
    const delta = Number(b.train_metrics[key]) - Number(a.train_metrics[key]);
    if (Math.abs(delta) > 1e-12) return delta;
  }
  const structuralDelta = Number(b.structural_threshold) - Number(a.structural_threshold);
  if (Math.abs(structuralDelta) > 1e-12) return structuralDelta;
  return Number(a.support_threshold) - Number(b.support_threshold);
}

function statusFor(selected, calibrated) {
  if (selected.answer_rate >= calibrated.answer_rate && selected.answer_support_rate >= calibrated.answer_support_rate && selected.overall_judged_correct_rate >= calibrated.overall_judged_correct_rate) {
    return "structural_cross_window_selector_dominates_calibrated_hybrid";
  }
  if (selected.overall_judged_correct_rate > calibrated.overall_judged_correct_rate) {
    return "structural_cross_window_selector_correctness_gain_coverage_shortfall";
  }
  return "structural_cross_window_selector_not_promoted";
}

function decisionFromResult(selected, calibrated, previous) {
  if (selected.answer_rate >= calibrated.answer_rate && selected.answer_support_rate >= calibrated.answer_support_rate && selected.overall_judged_correct_rate >= calibrated.overall_judged_correct_rate) {
    return {
      promote_selector_now: true,
      replace_calibrated_hybrid_now: true,
      train_student_on_gpu_now: false,
      buy_more_openai_labels_now: false,
      launch_gpu_now: false,
      next_step: "Promote the structural cross-window selector as the current deployable scaffold and update paper-readiness evidence.",
      reason: "The selector selected on 240-320 dominates the calibrated hybrid on final answer rate, answer support, and overall correctness.",
    };
  }
  return {
    promote_selector_now: false,
    replace_calibrated_hybrid_now: false,
    train_student_on_gpu_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Keep calibrated hybrid as the deployable final selector; use structural score as a training feature for future non-final listwise packets, not as a replacement yet.",
    reason: `The structural cross-window selector reaches ${pct(selected.answer_rate)} answer rate, ${pct(selected.answer_support_rate)} answer support, and ${pct(selected.overall_judged_correct_rate)} overall correctness; it does not dominate the calibrated hybrid and changes only ${signed(selected.overall_judged_correct_rate - previous.overall_judged_correct_rate)} overall correctness versus the prior cross-window selector.`,
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
  const penalty = weights.unsupported * features.unsupported_penalty + weights.overanswer * features.overanswer_penalty + (features.empty_answer ? 0.20 : 0);
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

function isSupportedAnswer(judgment) {
  return String(judgment?.verdict ?? "").toLowerCase() === "supported"
    && judgment?.all_claims_supported === true
    && judgment?.citation_ids_valid !== false;
}

function isSupportedAbstention(judgment) {
  return String(judgment?.verdict ?? "").toLowerCase() === "correct_abstention"
    || judgment?.abstention_supported === true;
}

function isEmptyAnswer(text) {
  return /^(\[empty answer\]|empty answer|no_answer)?$/i.test(String(text ?? "").trim());
}

function describeSplit(spec, split) {
  return {
    id: spec.id,
    examples: split.rows.length,
    direct_run_id: spec.directRunId,
    risk_run_id: spec.riskRunId,
    guard_run_id: spec.guardRunId,
  };
}

function renderReport(result) {
  const selected = result.selected_rule_metrics.eval;
  const calibrated = result.baselines_on_eval.calibrated_hybrid_final_selector;
  return `# Structural Cross-Window Selector

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no API calls and launches no compute. It tunes support and structural-target thresholds on 240-320, then reports transfer on 321-389.

## Metrics

| Selector | Answer rate | Answer support | Overall correct | Supported answers |
| --- | ---: | ---: | ---: | ---: |
| Selected structural cross-window | ${pct(selected.answer_rate)} | ${pct(selected.answer_support_rate)} | ${pct(selected.overall_judged_correct_rate)} | ${selected.supported_answers} |
| Previous cross-window selector | ${pct(result.baselines_on_eval.previous_cross_window_selector.answer_rate)} | ${pct(result.baselines_on_eval.previous_cross_window_selector.answer_support_rate)} | ${pct(result.baselines_on_eval.previous_cross_window_selector.overall_judged_correct_rate)} | ${result.baselines_on_eval.previous_cross_window_selector.supported_answers ?? "n/a"} |
| Calibrated hybrid | ${pct(calibrated.answer_rate)} | ${pct(calibrated.answer_support_rate)} | ${pct(calibrated.overall_judged_correct_rate)} | ${calibrated.supported_answers} |

## Decision

- Promote selector now: ${result.decision.promote_selector_now ? "yes" : "no"}
- Replace calibrated hybrid now: ${result.decision.replace_calibrated_hybrid_now ? "yes" : "no"}
- Train student on GPU now: ${result.decision.train_student_on_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function byId(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
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

function signed(value) {
  return `${value >= 0 ? "+" : ""}${pct(value)}`;
}

function fmt(value) {
  return Number(value).toFixed(3);
}

function name(value) {
  return String(value).replace(".", "p");
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
