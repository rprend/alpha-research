import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");

const runId = "structural-target-transfer-repaired-router-audit-v1";
const outputDir = path.join(runsDir, runId);
const launchPacketRunId = "frontier-repaired-launch-packet-2026-06-29-v1";
const validationGateRunId = "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const scaffoldRunId = "frontier-repaired-train-calibrated-scaffold-smoke-2026-06-29-v1";
const trainSelectedRunId = "train-selected-constrained-policy-audit-frontier-repaired-v1";
const learnedRunId = "learned-repaired-selector-audit-frontier-repaired-v1";
const sourceRouterRunId = "train-supervised-candidate-router-audit-frontier-repaired-v1";
const structuralVerifierRunId = "structural-target-verifier-audit-0-320-to-321-389-2026-06-28-v1";

const systemIds = [
  "train_calibrated_scaffold",
  "train_selected_constrained_policy",
  "learned_repaired_selector",
];
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model dataset task result results use uses is in on of to a an by as or be can it its we our you your".split(" "));

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const scaffoldResult = await readJson(path.join(runsDir, scaffoldRunId, "result.json"));
const structuralResult = await readJson(path.join(runsDir, structuralVerifierRunId, "result.json"));
const selectedStructuralPolicy = structuralResult.selected_by_nonfinal_labels;
const structuralWeights = selectedStructuralPolicy.weights;
const structuralThreshold = selectedStructuralPolicy.threshold;
const trainRows = await readJsonl(path.join(runsDir, launchPacketRunId, "dataset", "sft_train.jsonl"));
const validationPrompts = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_prompts.jsonl"));
const validationTargets = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const validationTargetById = new Map(validationTargets.map((row) => [row.example_id, row.target]));

const trainHeldoutRows = trainRows.slice(160).map((row) => ({ example_id: row.example_id, input: row.input, target: row.target, split: "train_heldout" }));
const validationRows = validationPrompts.map((row) => ({
  example_id: row.example_id,
  input: row.input,
  target: validationTargetById.get(row.example_id),
  split: "repaired_validation_gate",
}));
const sourceSelections = {
  train_heldout: await readJsonl(path.join(runsDir, sourceRouterRunId, "train_heldout_selections.jsonl")),
  repaired_validation_gate: await readJsonl(path.join(runsDir, sourceRouterRunId, "validation_selections.jsonl")),
};
const predictionRows = {
  train_heldout: await loadSplitPredictions("train_heldout", trainHeldoutRows),
  repaired_validation_gate: await loadSplitPredictions("repaired_validation_gate", validationRows),
};

const candidateRows = {
  train_heldout: candidateRowsFor(predictionRows.train_heldout, sourceSelections.train_heldout),
  repaired_validation_gate: candidateRowsFor(predictionRows.repaired_validation_gate, sourceSelections.repaired_validation_gate),
};
const baseSelections = {
  train_heldout: selectWithPolicy(candidateRows.train_heldout, noSwitchPolicy()),
  repaired_validation_gate: selectWithPolicy(candidateRows.repaired_validation_gate, noSwitchPolicy()),
};
const policyRows = [];
for (const mode of ["guard_only", "recover_only", "guard_then_recover"]) {
  for (const guardThreshold of [0.30, 0.38, 0.46, 0.54, 0.62, structuralThreshold]) {
    for (const recoveryThreshold of [0.38, 0.46, 0.54, 0.62, structuralThreshold, 0.74]) {
      for (const maxProbabilityGap of [-0.20, -0.10, 0, 0.05, 0.10, 0.20, 0.35]) {
        policyRows.push(evaluatePolicy({
          mode,
          guard_threshold: guardThreshold,
          recovery_threshold: recoveryThreshold,
          max_probability_gap: maxProbabilityGap,
        }));
      }
    }
  }
}

const selectedPolicy = [...policyRows].sort((left, right) =>
  -left.train_heldout.contract_correct + right.train_heldout.contract_correct
  || left.train_heldout.switches - right.train_heldout.switches
  || -left.train_heldout.grounded_target_contract_correct + right.train_heldout.grounded_target_contract_correct
  || left.policy_id.localeCompare(right.policy_id)
)[0];
const validationSelections = selectWithPolicy(candidateRows.repaired_validation_gate, selectedPolicy.policy);
const heldoutSelections = selectWithPolicy(candidateRows.train_heldout, selectedPolicy.policy);
const validationMetrics = summarizeSelections(validationSelections);
const heldoutMetrics = summarizeSelections(heldoutSelections);
const aggressivePolicy = {
  mode: "guard_then_recover",
  guard_threshold: 0.46,
  recovery_threshold: 0.46,
  max_probability_gap: 0.35,
};
const aggressive = {
  policy: aggressivePolicy,
  train_heldout: summarizeSelections(selectWithPolicy(candidateRows.train_heldout, aggressivePolicy)),
  repaired_validation_gate: summarizeSelections(selectWithPolicy(candidateRows.repaired_validation_gate, aggressivePolicy)),
};
const sourceHeldout = summarizeSelections(baseSelections.train_heldout);
const sourceValidation = summarizeSelections(baseSelections.repaired_validation_gate);
const validationOracle = summarizeOracle(candidateRows.repaired_validation_gate);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "structural_target_transfer_repaired_router_audit",
  status: statusFor(validationMetrics, sourceValidation, heldoutMetrics, sourceHeldout),
  purpose: "Transfer the selected structural target-completeness verifier onto the current repaired candidate router without validation-label tuning.",
  source_runs: {
    source_router: sourceRouterRunId,
    structural_target_verifier: structuralVerifierRunId,
    launch_packet_run_id: launchPacketRunId,
    validation_gate_run_id: validationGateRunId,
    train_calibrated_scaffold: scaffoldRunId,
    train_selected_constrained_policy: trainSelectedRunId,
    learned_repaired_selector: learnedRunId,
  },
  structural_policy: {
    policy_id: selectedStructuralPolicy.policy_id,
    threshold: structuralThreshold,
    weights: structuralWeights,
    nonfinal_balanced_accuracy: selectedStructuralPolicy.nonfinal_candidate_labels.balanced_accuracy,
    final_pair_transfer_accuracy: selectedStructuralPolicy.final_pair_transfer.accuracy,
  },
  leakage_note: "Overlay policies are selected only on repaired train-heldout rows. Repaired validation labels are used only for reporting transfer.",
  candidate_pool: {
    systems: systemIds,
    excludes_validation_only_qwen_hybrid: true,
    reason: "The overlay is testing the same leakage-safe three-system pool as D387.",
  },
  metrics: {
    source_router: {
      train_heldout: sourceHeldout,
      repaired_validation_gate: sourceValidation,
    },
    selected_overlay: {
      policy: selectedPolicy.policy,
      train_heldout: heldoutMetrics,
      repaired_validation_gate: validationMetrics,
    },
    aggressive_probe: aggressive,
  },
  oracle: {
    repaired_validation_gate: validationOracle,
  },
  baseline_comparison: {
    source_router_validation_contract_correct: sourceValidation.contract_correct,
    selected_overlay_validation_contract_correct: validationMetrics.contract_correct,
    delta_vs_source_router: validationMetrics.contract_correct - sourceValidation.contract_correct,
    validation_oracle_contract_correct: validationOracle.contract_correct,
    delta_vs_three_system_oracle: validationMetrics.contract_correct - validationOracle.contract_correct,
  },
  decision: decisionFor(validationMetrics, sourceValidation, heldoutMetrics, sourceHeldout),
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
    note: "This is a zero-call deterministic transfer audit over existing artifacts.",
  },
  artifacts: {
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    train_heldout_selections_jsonl: rel(path.join(outputDir, "train_heldout_selections.jsonl")),
    validation_selections_jsonl: rel(path.join(outputDir, "validation_selections.jsonl")),
    candidate_rows_jsonl: rel(path.join(outputDir, "candidate_rows.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), policyRows);
await writeJsonl(path.join(outputDir, "train_heldout_selections.jsonl"), heldoutSelections);
await writeJsonl(path.join(outputDir, "validation_selections.jsonl"), validationSelections);
await writeJsonl(path.join(outputDir, "candidate_rows.jsonl"), [...candidateRows.train_heldout, ...candidateRows.repaired_validation_gate]);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  structural_policy: result.structural_policy,
  metrics: result.metrics,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function evaluatePolicy(policy) {
  const trainSelections = selectWithPolicy(candidateRows.train_heldout, policy);
  const validationSelectionsForPolicy = selectWithPolicy(candidateRows.repaired_validation_gate, policy);
  const trainSummary = summarizeSelections(trainSelections);
  const validationSummary = summarizeSelections(validationSelectionsForPolicy);
  return {
    policy_id: policyId(policy),
    policy,
    train_heldout: trainSummary,
    repaired_validation_gate: validationSummary,
  };
}

function noSwitchPolicy() {
  return {
    mode: "source_router",
    guard_threshold: -1,
    recovery_threshold: 2,
    max_probability_gap: -1,
  };
}

function selectWithPolicy(rows, policy) {
  return rows.map((row) => {
    const selected = applyPolicy(row, policy);
    return {
      example_id: row.example_id,
      split: row.split,
      target_answer_type: row.target_answer_type,
      source_selected_system_id: row.source_selected_system_id,
      selected_system_id: selected.system_id,
      selected_contract_correct: selected.contract_correct,
      selected_answer_type_correct: selected.answer_type_correct,
      selected_citation_set_exact: selected.citation_set_exact,
      selected_probability: selected.predicted_probability,
      selected_answer_type: selected.prediction_answer_type,
      selected_structural_score: selected.structural_score,
      selected_structural_pass: selected.structural_pass,
      switch_reason: selected.switch_reason,
      candidates: row.candidates,
    };
  });
}

function applyPolicy(row, policy) {
  const source = row.candidates.find((candidate) => candidate.system_id === row.source_selected_system_id) ?? row.candidates[0];
  let selected = { ...source, switch_reason: "source_router" };
  const abstainCandidate = [...row.candidates]
    .filter((candidate) => candidate.prediction_answer_type === "abstain")
    .sort((left, right) => right.predicted_probability - left.predicted_probability)[0];
  const bestAnswerCandidate = [...row.candidates]
    .filter((candidate) => candidate.prediction_answer_type === "grounded_answer")
    .sort((left, right) =>
      right.structural_score - left.structural_score
      || right.predicted_probability - left.predicted_probability
      || systemIds.indexOf(left.system_id) - systemIds.indexOf(right.system_id)
    )[0];
  const shouldGuard = (policy.mode === "guard_only" || policy.mode === "guard_then_recover")
    && selected.prediction_answer_type === "grounded_answer"
    && abstainCandidate
    && selected.structural_score < policy.guard_threshold;
  if (shouldGuard) selected = { ...abstainCandidate, switch_reason: "structural_guard_to_abstain" };
  const gap = selected.predicted_probability - (bestAnswerCandidate?.predicted_probability ?? 0);
  const shouldRecover = (policy.mode === "recover_only" || policy.mode === "guard_then_recover")
    && selected.prediction_answer_type === "abstain"
    && bestAnswerCandidate
    && bestAnswerCandidate.structural_score >= policy.recovery_threshold
    && gap <= policy.max_probability_gap;
  if (shouldRecover) selected = { ...bestAnswerCandidate, switch_reason: "structural_recover_answer" };
  return selected;
}

function candidateRowsFor(rows, selections) {
  const selectionById = new Map(selections.map((row) => [row.example_id, row]));
  return rows.map((row) => {
    const sourceSelection = selectionById.get(row.example_id);
    const sourceCandidateBySystem = new Map((sourceSelection?.candidates ?? []).map((candidate) => [candidate.system_id, candidate]));
    const candidates = systemIds.map((systemId) => {
      const prediction = row.predictions[systemId];
      const score = scorePrediction(prediction, row.target);
      const sourceCandidate = sourceCandidateBySystem.get(systemId);
      const structural = structuralFeatures(row.input.question, row.input.compact_retrieved_evidence_pack ?? [], prediction ?? {});
      const structuralScoreValue = structuralScore(structural, structuralWeights);
      return {
        system_id: systemId,
        predicted_probability: Number(sourceCandidate?.predicted_probability ?? 0),
        prediction_answer_type: prediction?.answer_type,
        contract_correct: score.contract_correct,
        answer_type_correct: score.answer_type_correct,
        citation_set_exact: score.citation_set_exact,
        structural_score: structuralScoreValue,
        structural_pass: structuralScoreValue >= structuralThreshold,
        structural_features: structural,
        answer_token_count: structural.answer_token_count,
        citation_count: structural.citation_count,
      };
    }).sort((left, right) => right.predicted_probability - left.predicted_probability || systemIds.indexOf(left.system_id) - systemIds.indexOf(right.system_id));
    return {
      example_id: row.example_id,
      split: row.split,
      target_answer_type: row.target?.answer_type,
      source_selected_system_id: sourceSelection?.selected_system_id,
      candidates,
    };
  });
}

async function loadSplitPredictions(split, rows) {
  const scaffoldPredictions = rows.map((row) => ({
    example_id: row.example_id,
    prediction: predictScaffold(row.example_id, row.input, scaffoldResult.calibration.params),
  }));
  const file = split === "train_heldout" ? "train_heldout_predictions.jsonl" : "validation_predictions.jsonl";
  const trainSelected = await readJsonl(path.join(runsDir, trainSelectedRunId, file));
  const learned = await readJsonl(path.join(runsDir, learnedRunId, file));
  const bySystem = {
    train_calibrated_scaffold: new Map(scaffoldPredictions.map((row) => [row.example_id, row.prediction])),
    train_selected_constrained_policy: new Map(trainSelected.map((row) => [row.example_id, row.prediction])),
    learned_repaired_selector: new Map(learned.map((row) => [row.example_id, row.prediction])),
  };
  return rows.map((row) => ({
    example_id: row.example_id,
    split,
    input: row.input,
    target: row.target,
    predictions: Object.fromEntries(systemIds.map((systemId) => [systemId, bySystem[systemId].get(row.example_id)])),
  }));
}

function summarizeSelections(rows) {
  const correct = rows.filter((row) => row.selected_contract_correct).length;
  const answerType = rows.filter((row) => row.selected_answer_type_correct).length;
  const citation = rows.filter((row) => row.selected_citation_set_exact).length;
  const groundedTargets = rows.filter((row) => row.target_answer_type === "grounded_answer");
  const abstainTargets = rows.filter((row) => row.target_answer_type === "abstain");
  return {
    examples: rows.length,
    contract_correct: correct,
    contract_correct_rate: rate(correct, rows.length),
    answer_type_correct: answerType,
    answer_type_accuracy: rate(answerType, rows.length),
    citation_set_exact: citation,
    citation_set_exact_rate: rate(citation, rows.length),
    grounded_target_examples: groundedTargets.length,
    grounded_target_contract_correct: groundedTargets.filter((row) => row.selected_contract_correct).length,
    abstain_target_examples: abstainTargets.length,
    abstain_target_contract_correct: abstainTargets.filter((row) => row.selected_contract_correct).length,
    selected_grounded_answers: rows.filter((row) => row.selected_answer_type === "grounded_answer").length,
    selected_abstentions: rows.filter((row) => row.selected_answer_type === "abstain").length,
    switches: rows.filter((row) => row.selected_system_id !== row.source_selected_system_id).length,
    guard_switches: rows.filter((row) => row.switch_reason === "structural_guard_to_abstain").length,
    recovery_switches: rows.filter((row) => row.switch_reason === "structural_recover_answer").length,
  };
}

function summarizeOracle(rows) {
  const correct = rows.filter((row) => row.candidates.some((candidate) => candidate.contract_correct)).length;
  return {
    examples: rows.length,
    contract_correct: correct,
    contract_correct_rate: rate(correct, rows.length),
    all_systems_wrong: rows.length - correct,
  };
}

function statusFor(validationMetrics, sourceValidation, heldoutMetrics, sourceHeldout) {
  if (heldoutMetrics.contract_correct <= sourceHeldout.contract_correct && validationMetrics.contract_correct <= sourceValidation.contract_correct) return "structural_transfer_no_switch_or_no_gain";
  if (validationMetrics.contract_correct > sourceValidation.contract_correct) return "structural_transfer_improves_router_validation";
  if (validationMetrics.contract_correct === sourceValidation.contract_correct) return "structural_transfer_ties_router_validation";
  return "structural_transfer_rejected_validation_regression";
}

function decisionFor(validationMetrics, sourceValidation, heldoutMetrics, sourceHeldout) {
  const validationDelta = validationMetrics.contract_correct - sourceValidation.contract_correct;
  const heldoutDelta = heldoutMetrics.contract_correct - sourceHeldout.contract_correct;
  if (heldoutDelta <= 0 && validationDelta <= 0) {
    return {
      promote_overlay_now: false,
      buy_openai_judgments_now: false,
      launch_prime_now: false,
      next_step: "Keep the structural verifier as a diagnostic feature, but do not add the overlay; move to fresher heldout routing labels or better grounded-answer candidate construction.",
      reason: `Train-heldout selection did not improve the source router, and validation delta is ${validationDelta}.`,
    };
  }
  if (validationDelta > 0) {
    return {
      promote_overlay_now: false,
      buy_openai_judgments_now: false,
      launch_prime_now: false,
      next_step: "Run a fresh heldout router test before any paid judging or Prime launch.",
      reason: `The selected structural overlay improves repaired validation by ${validationDelta} examples after train-heldout tuning, but still needs a fresh holdout.`,
    };
  }
  return {
    promote_overlay_now: false,
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    next_step: "Reject this overlay as an end-to-end decision rule; use structural scores only as diagnostics or features in a richer learned verifier.",
    reason: `Train-heldout delta is ${heldoutDelta}, but repaired-validation delta is ${validationDelta}.`,
  };
}

function renderReport(result) {
  const source = result.metrics.source_router;
  const selected = result.metrics.selected_overlay;
  const aggressive = result.metrics.aggressive_probe;
  return `# Structural Target Transfer Repaired Router Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no API calls and launches no GPU jobs. It transfers the selected structural target-completeness verifier onto the current repaired router candidate pool and selects overlay thresholds only on repaired train-heldout rows.

## Selected Structural Verifier

- Policy: ${result.structural_policy.policy_id}
- Non-final balanced accuracy: ${pct(result.structural_policy.nonfinal_balanced_accuracy)}
- Frozen final pair transfer: ${pct(result.structural_policy.final_pair_transfer_accuracy)}

## Metrics

| Split | Source Router | Selected Overlay | Delta | Switches |
| --- | ---: | ---: | ---: | ---: |
| Train heldout | ${source.train_heldout.contract_correct}/${source.train_heldout.examples} | ${selected.train_heldout.contract_correct}/${selected.train_heldout.examples} | ${selected.train_heldout.contract_correct - source.train_heldout.contract_correct} | ${selected.train_heldout.switches} |
| Repaired validation | ${source.repaired_validation_gate.contract_correct}/${source.repaired_validation_gate.examples} | ${selected.repaired_validation_gate.contract_correct}/${selected.repaired_validation_gate.examples} | ${selected.repaired_validation_gate.contract_correct - source.repaired_validation_gate.contract_correct} | ${selected.repaired_validation_gate.switches} |

## Aggressive Probe

- Train heldout: ${aggressive.train_heldout.contract_correct}/${aggressive.train_heldout.examples}, switches ${aggressive.train_heldout.switches}
- Repaired validation: ${aggressive.repaired_validation_gate.contract_correct}/${aggressive.repaired_validation_gate.examples}, switches ${aggressive.repaired_validation_gate.switches}

## Decision

- Promote overlay now: ${result.decision.promote_overlay_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function predictScaffold(exampleId, input, params) {
  const counterfactual = input.document_metadata?.counterfactual === true || String(exampleId).includes(":counterfactual-insufficient");
  const ranked = rankEvidence(input.question, input.compact_retrieved_evidence_pack ?? []);
  const topScore = ranked[0]?.score ?? 0;
  const directSignalCount = ranked.filter((row) => row.score >= 0.12).length;
  const risky = /\b(how much|percentage|statistically significant|which are three|how many|what percentage)\b/i.test(input.question ?? "");
  const score = topScore + params.direct_weight * Math.min(directSignalCount, 3) - (risky ? params.risk_penalty : 0);
  if (counterfactual || score < params.threshold) return abstain(input.question, score);
  const selected = ranked.slice(0, params.citation_count).filter((row) => row.score > 0);
  if (!selected.length) return abstain(input.question, score);
  const citations = selected.map((row) => row.evidence_id);
  const claims = selected.map((row, index) => ({
    claim_id: `C${index + 1}`,
    claim: row.sentence,
    citations: [row.evidence_id],
    support_status: "supported",
  }));
  return {
    answer_type: "grounded_answer",
    evidence_first: {
      sufficiency: "sufficient",
      supported_claims: claims,
      missing_support: "",
      question_target: input.question ?? "exact_question_target",
    },
    answer: `${selected.map((row) => row.sentence).join(" ")} ${citations.map((id) => `[${id}]`).join(" ")}`,
    citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function rankEvidence(question, evidencePack) {
  const questionTokens = new Set(tokenList(question));
  return evidencePack.map((evidence) => {
    const sentences = splitSentences(evidence.text);
    const best = sentences
      .map((sentence) => ({ sentence: cleanSentence(sentence), score: overlapScore(questionTokens, `${evidence.section ?? ""} ${sentence}`) }))
      .sort((left, right) => right.score - left.score)[0] ?? { sentence: cleanSentence(evidence.text), score: 0 };
    return { evidence_id: evidence.evidence_id, sentence: best.sentence, score: best.score };
  }).sort((left, right) => right.score - left.score || left.evidence_id.localeCompare(right.evidence_id));
}

function overlapScore(questionTokens, text) {
  const tokens = tokenList(text);
  if (!tokens.length || !questionTokens.size) return 0;
  const overlap = tokens.filter((token) => questionTokens.has(token)).length;
  const coverage = overlap / questionTokens.size;
  const density = overlap / tokens.length;
  const numericBonus = tokens.some((token) => /[0-9]/.test(token)) ? 0.02 : 0;
  return coverage + density + numericBonus;
}

function abstain(question, score) {
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: `Train-calibrated scaffold score ${score.toFixed(3)} was below the support threshold for: ${question}`,
      question_target: question ?? "exact_question_target",
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The scaffold did not find enough calibrated direct support in the compact evidence pack.",
  };
}

function structuralFeatures(question, evidencePack, candidate) {
  const answer = String(candidate.answer ?? "");
  const claims = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? claim ?? ""));
  const answerAndClaims = `${answer}\n${claims.join("\n")}`;
  const evidenceText = evidencePack.map((item) => `${item.section ?? ""} ${item.text ?? ""}`).join("\n");
  const relevantEvidence = relevantEvidenceText(question, evidencePack);
  const citations = normalizeCitations(candidate.citations);
  const claimCitations = (candidate.claim_table ?? []).flatMap((claim) => normalizeCitations(claim.citations));
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

function scorePrediction(prediction, target) {
  const answerTypeCorrect = prediction?.answer_type === target?.answer_type;
  const citationSetExact = prediction?.answer_type === "abstain"
    ? normalizeCitations(prediction?.citations).length === 0
    : sameCitationSet(prediction?.citations, target?.citations ?? []);
  return {
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    contract_correct: Boolean(answerTypeCorrect && citationSetExact),
  };
}

function sameCitationSet(left, right) {
  const leftSet = new Set(normalizeCitations(left));
  const rightSet = new Set(normalizeCitations(right));
  if (leftSet.size !== rightSet.size) return false;
  for (const value of leftSet) if (!rightSet.has(value)) return false;
  return true;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation)).filter(Boolean);
}

function contentTokens(text) {
  const localStopwords = new Set("the a an and or of to in for with on by is are was were be been being as at from into about this that these those it its they their we our you your can could should would do does did how what which who when where why much many over under between using use used than then have has had include includes included only rely relies relying answer question evidence pack candidate model models method methods dataset datasets".split(" "));
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").match(/[a-z0-9]+/g)?.filter((token) => token.length > 2 && !localStopwords.has(token)) ?? [];
}

function tokenList(text) {
  return String(text ?? "").toLowerCase().split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stopwords.has(token));
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

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean).slice(0, 6);
}

function cleanSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
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

function policyId(policy) {
  return `${policy.mode}_g_${thresholdName(policy.guard_threshold)}_r_${thresholdName(policy.recovery_threshold)}_gap_${thresholdName(policy.max_probability_gap)}`;
}

function thresholdName(value) {
  return String(value).replace("-", "m").replace(".", "p");
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
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

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}
