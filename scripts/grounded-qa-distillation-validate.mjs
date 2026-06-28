import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const requiredFiles = ["manifest.json", "train.jsonl", "validation.jsonl", "test.jsonl"];
const activeQwen3bPacketRunId = "joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2";
const errors = [];

for (const file of requiredFiles) {
  try {
    await fs.access(path.join(dataDir, file));
  } catch {
    errors.push(`Missing ${path.join("docs/experiments/grounded-qa-distillation/data", file)}`);
  }
}

if (!errors.length) {
  const manifest = JSON.parse(await fs.readFile(path.join(dataDir, "manifest.json"), "utf8"));
  if (manifest.source_dataset !== "allenai/qasper") errors.push("manifest.source_dataset must be allenai/qasper.");
  if (!manifest.splits?.train || !manifest.splits?.validation || !manifest.splits?.test) {
    errors.push("manifest must include train, validation, and test split stats.");
  }

  for (const split of ["train", "validation", "test"]) {
    const rows = await readJsonl(path.join(dataDir, `${split}.jsonl`));
    if (!rows.length) errors.push(`${split}.jsonl must contain examples.`);
    if (manifest.splits?.[split]?.examples_written !== rows.length) {
      errors.push(`${split}.jsonl row count does not match manifest.`);
    }
    const answerable = rows.filter((row) => row.output?.answer_type === "grounded_answer").length;
    const abstentions = rows.filter((row) => row.output?.answer_type === "abstain").length;
    if (answerable === 0) errors.push(`${split}.jsonl must contain answerable examples.`);
    if (split === "train" && abstentions === 0) errors.push("train.jsonl must contain abstention examples.");

    rows.forEach((row, index) => validateExample(row, `${split}:${index + 1}`));
  }

  await validateTemporalSplitsIfPresent();
  await validateFutureHoldoutsIfPresent();
  await validateExportsIfPresent();
  await validateLlmBudgetIfPresent();
  await validateOpenAiStudentRunsIfPresent();
  await validateJudgeRunsIfPresent();
  await validateMultistepTeacherRunsIfPresent();
  await validateTeacherLabelExportsIfPresent();
  await validateTeacherLabelFilterRunsIfPresent();
  await validateFineTunePrepRunsIfPresent();
  await validateTeacherLabelScaffoldRunsIfPresent();
  await validateCitationContractRepairRunsIfPresent();
  await validatePolicySelectorRunsIfPresent();
  await validateVerifierSelectorRunsIfPresent();
  await validateHfSftPrepRunsIfPresent();
  await validateHfSftLaunchPreflightRunsIfPresent();
  await validateTemporalPacketScaffoldRunsIfPresent();
  await validateTemporalSpanScaffoldRunsIfPresent();
  await validateLocalGenerativeSftRunsIfPresent();
  await validateLocalGenerativeContractGateRunsIfPresent();
  await validateTotalSpendBudgetIfPresent();
  await validateSupportContrastPrepRunsIfPresent();
  await validateSupportContrastGateRunsIfPresent();
  await validateAbstentionSupportErrorAnalysisRunsIfPresent();
  await validateJointActionGpuPrepRunsIfPresent();
  await validateJointActionLaunchPreflightRunsIfPresent();
  await validateJointActionLaunchPlanRunsIfPresent();
  await validateJointActionLocalProbeRunsIfPresent();
  await validateJointActionEvalPrepRunsIfPresent();
  await validateJointActionJudgePlanRunsIfPresent();
  await validateQwen3bPredictionIntegrityGateRunsIfPresent();
  await validateQwen3bRemoteProvenanceGateRunsIfPresent();
  await validateQwen3bPostSmokePipelineRunsIfPresent();
  await validateJointActionRemoteSmokePlanRunsIfPresent();
  await validateJointActionScriptContractAuditRunsIfPresent();
  await validateJointActionSmokeLedgerFinalizerRunsIfPresent();
  await validatePrimeQwen3bSmokeRunbookRunsIfPresent();
  await validatePrimeGuardedSmokeEntrypointRunsIfPresent();
  await validateHfGuardedSmokeEntrypointRunsIfPresent();
  await validateQwen3bResultIntegrationRunsIfPresent();
  await validateQwen3bStructuralBinderRunsIfPresent();
  await validateQwen3bIntegrationFixtureAuditRunsIfPresent();
  await validateQwen3bSyntaxOnlyRejectionAuditRunsIfPresent();
  await validateQwen3bLocalControlNonSubstitutionAuditRunsIfPresent();
  await validateQwen3bOutcomeDecisionPolicyRunsIfPresent();
  await validateQwen3bPostSmokeProvenanceGuardAuditRunsIfPresent();
  await validateQwen3bParetoUpdateContractAuditRunsIfPresent();
  await validatePostQwenRegenerationContractAuditRunsIfPresent();
  await validateGpuLaunchAttemptRunsIfPresent();
  await validateHuggingFaceQwen3bSmokeLaunchAttemptRunsIfPresent();
  await validatePrimeAuthDiagnosisRunsIfPresent();
  await validatePrimeCliAuthRecheckRunsIfPresent();
  await validatePrimeAuthRepairHandoffRunsIfPresent();
  await validatePrimeAuthPriceGateRunsIfPresent();
  await validatePrimeQwen3bSmokeSshPreflightAttemptRunsIfPresent();
  await validateRemoteBackendReadinessGateRunsIfPresent();
  await validateLocalQwen3bBaseControlRunsIfPresent();
  await validateLocalQwen3bCitationRepairRunsIfPresent();
  await validateQwenStructureRepairRunsIfPresent();
  await validateTemporalWindowComparisonRunsIfPresent();
  await validateNoveltyWatchlistRunsIfPresent();
  await validateNoveltyDeltaMatrixRunsIfPresent();
  await validateDragStyleComparisonRunsIfPresent();
  await validateCitationSftComparisonRunsIfPresent();
  await validateFaithfulContextQaComparisonRunsIfPresent();
  await validateCitationGroundingMemoryComparisonRunsIfPresent();
  await validateCitationFaithfulnessNeighborComparisonRunsIfPresent();
  await validateFaithfulnessRankingControlRunsIfPresent();
  await validateWriteBackScopeRunsIfPresent();
  await validateVersionedKbWritebackDiagnosticRunsIfPresent();
  await validateVersionedKbNaturalnessAuditRunsIfPresent();
  await validateVersionedKbNaturalQuestionRunsIfPresent();
  await validateVersionedKbNaturalQuestionEvalRunsIfPresent();
  await validateTrustedDatedSnapshotRunsIfPresent();
  await validateVersionedPrivateKbPrototypeRunsIfPresent();
  await validateVersionedPrivateKbEvalRunsIfPresent();
  await validateCorpusRealismAuditRunsIfPresent();
  await validatePaperReadinessGateRunsIfPresent();
  await validateManuscriptEvidenceMapRunsIfPresent();
  await validateManuscriptDraftRunsIfPresent();
  await validateReviewerRiskAuditRunsIfPresent();
  await validateJudgeCalibrationAuditRunsIfPresent();
  await validateJudgeAdjudicationPacketRunsIfPresent();
  await validateJudgeReliabilitySecondPassPlanRunsIfPresent();
  await validateJudgeReliabilitySecondPassRunRunsIfPresent();
  await validateJudgeDisagreementTaxonomyRunsIfPresent();
  await validateAbstentionBoundaryReliabilityAuditRunsIfPresent();
  await validateJudgeReliabilityClaimGateRunsIfPresent();
  await validateFinalEvidenceChecklistRunsIfPresent();
  await validateFinalClaimAcceptanceMatrixRunsIfPresent();
  await validateCostCoverageParetoRunsIfPresent();
  await validateAmortizationBreakEvenRunsIfPresent();
  await validateDistillationLossAccountingRunsIfPresent();
  await validatePostTrainingPolicyAblationRunsIfPresent();
  await validateCoverageConstrainedFrontierRunsIfPresent();
  await validateCandidatePoolOracleRunsIfPresent();
  await validateCandidateSelectorCrossWindowRunsIfPresent();
  await validateConstrainedSpanConstructorRunsIfPresent();
  await validateTrainedEvidenceSelectorConstructorRunsIfPresent();
  await validateAnswerSpanConstructionGapRunsIfPresent();
  await validateSpanClaimConstructionPacketRunsIfPresent();
  await validateAnswerCompletionRepairPacketRunsIfPresent();
  await validateMixedMetricRepairPacketRunsIfPresent();
  await validateSupportTargetedPlanningPacketRunsIfPresent();
  await validateSupportTargetedPlanningLaunchPacketRunsIfPresent();
  await validateSupportContractAuditRunsIfPresent();
  await validateSupportContractGateRunsIfPresent();
  await validateContractAwareCandidateSelectorRunsIfPresent();
  await validateTrainedContractSelectorRunsIfPresent();
  await validateTrainedSelectorMissAuditRunsIfPresent();
  await validateCalibratedHybridSelectorRunsIfPresent();
  await validateQwenOnlyAmortizationDiagnosticRunsIfPresent();
  await validateQwenCoverageGapScaffoldPacketRunsIfPresent();
  await validateV13SupportDeltaSupervisionPacketRunsIfPresent();
  await validateQwenCoverageGapScaffoldLaunchPacketRunsIfPresent();
  await validateV13SupportDeltaLaunchPacketRunsIfPresent();
  await validateV14SupportDeltaOutcomeAuditRunsIfPresent();
  await validateQwenSwitchFrontierAuditRunsIfPresent();
  await validateSupportRankerPairwisePacketRunsIfPresent();
  await validateLocalSupportRankerRunsIfPresent();
  await validateEntailmentFeatureRankerRunsIfPresent();
  await validatePacketNliRankerRunsIfPresent();
  await validateQwenNonfinalFrontierLaunchPacketRunsIfPresent();
  await validateQwenNonfinalFrontierPoolPacketRunsIfPresent();
  await validateQwenNonfinalCitationRepairRunsIfPresent();
  await validateQwenNonfinalSupportLabelPacketRunsIfPresent();
  await validateQwenFrontierPoolSupportPacketRunsIfPresent();
  await validateQwenLabelSupportRankerRunsIfPresent();
  await validateQwenLabelRankerMissAuditRunsIfPresent();
  await validateQwenOverclaimPenaltyAuditRunsIfPresent();
  await validateQwenContrastVerifierRunsIfPresent();
  await validateQwenFrontierDomainShiftAuditRunsIfPresent();
  await validateClaimSupportVerifierRunsIfPresent();
  await validateClaimNliSupportVerifierRunsIfPresent();
  await validateHardNegativeClaimNliSelectorRunsIfPresent();
  await validateOpenAiPoolAdjudicationRunsIfPresent();
  await validatePoolAdjudicatedSelectorRunsIfPresent();
  await validatePoolSelectorMissAuditRunsIfPresent();
  await validateConstrainedPoolPairwiseSelectorRunsIfPresent();
  await validateBothFailTargetAuditRunsIfPresent();
  await validateMinimalSpanOverexpansionPacketRunsIfPresent();
  await validateOverexpansionAwareSelectorRunsIfPresent();
  await validateCalibratedOverexpansionHybridRunsIfPresent();
  await validateOverexpansionTradeoffAuditRunsIfPresent();
  await validateConditionalOverexpansionGateRunsIfPresent();
  await validateTargetedBoundaryAdjudicationPacketRunsIfPresent();
  await validateTargetedBoundaryAdjudicationRunRunsIfPresent();
  await validateBoundaryAdjudicationDisagreementAuditRunsIfPresent();
  await validateFilteredBoundarySelectorRunsIfPresent();
  await validateBoundaryHybridTradeoffAuditRunsIfPresent();
  await validateLostRescueExampleAuditRunsIfPresent();
  await validateFinalAmbiguityStratificationAuditRunsIfPresent();
  await validateCleanValidationSliceAuditRunsIfPresent();
  await validateSelectorCoverageConfirmationAuditRunsIfPresent();
  await validateFrontierReplayAuditRunsIfPresent();
  await validateHardNegativePromotionGateAuditRunsIfPresent();
  await validateTemperedHardHybridAuditRunsIfPresent();
  await validateTemperedHardHybridLooAuditRunsIfPresent();
  await validateHeldoutCoverageGapAuditRunsIfPresent();
  await validateMarginCompatibleHeldoutPlanRunsIfPresent();
  await validateMarginCompatibleHeldoutPacketRunsIfPresent();
  await validateMarginCompatibleHeldoutNliRunsIfPresent();
  await validateMarginCompatibleHeldoutEvalRunsIfPresent();
  await validateFinalContrastSourceInventoryRunsIfPresent();
  await validateFinalMarginCompatibleHeldoutPacketRunsIfPresent();
  await validateFinalMarginCompatibleHeldoutNliRunsIfPresent();
  await validateFinalMarginCompatibleHeldoutEvalRunsIfPresent();
  await validateNonfinalContrastSourceInventoryRunsIfPresent();
  await validateNonfinalMarginCompatibleTrainPacketRunsIfPresent();
  await validateNonfinalMarginCompatibleTrainNliRunsIfPresent();
  await validateBroadContrastSelectorTransferRunsIfPresent();
  await validateOracleEdgeTournamentAuditRunsIfPresent();
  await validateDeployableTournamentAuditRunsIfPresent();
  await validateFamilyPriorListwiseAuditRunsIfPresent();
  await validateFamilyPriorTemporalStressAuditRunsIfPresent();
  await validateSourcePrefixReliabilityAuditRunsIfPresent();
  await validateTimeAwareSourcePrefixSelectorAuditRunsIfPresent();
  await validateCandidateInternalFeatureOverlayAuditRunsIfPresent();
  await validateTargetedMissContrastMiningAuditRunsIfPresent();
  await validateTargetedMissAwareSelectorAuditRunsIfPresent();
  await validateTargetedPacketLearnerTransferAuditRunsIfPresent();
  await validateBalancedPacketLearnerAuditRunsIfPresent();
  await validatePreservationPairMiningAuditRunsIfPresent();
  await validatePreservationBalancedLearnerAuditRunsIfPresent();
  await validateFinalMissRepairabilityAuditRunsIfPresent();
  await validateLowPriorRescuePacketAuditRunsIfPresent();
  await validateLowPriorRescueSelectorAuditRunsIfPresent();
  await validateLowPriorCandidateSignalAuditRunsIfPresent();
  await validateLowPriorEntailmentSelectorAuditRunsIfPresent();
  await validateEntailmentCoverageGuardPostmortemAuditRunsIfPresent();
  await validateQuestionFocusGuardAuditRunsIfPresent();
  await validateQuestionTargetCompletenessPacketAuditRunsIfPresent();
  await validateFrontierTargetCompletenessMiningAuditRunsIfPresent();
  await validateModelScaleAdequacyAuditRunsIfPresent();
  await validateJointActionPacketQualityAuditRunsIfPresent();
  await validateRepairRegenerationSignalAuditRunsIfPresent();
  await validateQwen7bAnswerFormRegressionAuditRunsIfPresent();
  await validateQwen7bV10PostmortemAuditRunsIfPresent();
  await validateOracleGapRepairAuditRunsIfPresent();
  await validateQwen7bAnswerFormCounterfactualGateRunsIfPresent();
  await validateUnsupportedAnswerRepairabilityAuditRunsIfPresent();
}

async function validateFutureHoldoutsIfPresent() {
  let entries = [];
  try {
    entries = await fs.readdir(dataDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith("future_holdout-manifest.json")) continue;
    const manifestPath = path.join(dataDir, entry.name);
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const split = manifest.output_split;
    if (!split) {
      errors.push(`${entry.name}: missing output_split.`);
      continue;
    }
    const rows = await readJsonl(path.join(dataDir, `${split}.jsonl`));
    if (rows.length !== manifest.examples_written) errors.push(`${entry.name}: examples_written does not match ${split}.jsonl.`);
    if (!rows.length) errors.push(`${entry.name}: holdout split is empty.`);
    rows.forEach((row, index) => validateExample(row, `${split}:${index + 1}`));

    const papers = new Set(rows.map((row) => row.input.document_metadata.paper_id));
    if (papers.size !== manifest.paper_count) errors.push(`${entry.name}: paper_count does not match ${split}.jsonl.`);
    const minMonth = manifest.selection_policy?.min_month;
    if (minMonth) {
      const early = rows.find((row) => String(row.input.document_metadata.inferred_publication_month ?? "") < minMonth);
      if (early) errors.push(`${entry.name}: ${early.example_id} is earlier than min_month ${minMonth}.`);
    }

    const excludedPrefix = manifest.selection_policy?.exclude_teacher_label_prefix;
    if (excludedPrefix) {
      const excludedPapers = await teacherLabelPapers(excludedPrefix);
      const shared = intersection(papers, excludedPapers);
      if (shared.length) errors.push(`${entry.name}: holdout shares excluded label papers: ${shared.slice(0, 5).join(", ")}.`);
    }
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Grounded QA distillation artifacts are valid.");

async function validateTemporalSplitsIfPresent() {
  const manifestPath = path.join(dataDir, "temporal-manifest.json");
  try {
    await fs.access(manifestPath);
  } catch {
    return;
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const temporalSplits = ["temporal_train", "temporal_validation", "temporal_test"];
  const papersBySplit = new Map();
  const monthsBySplit = new Map();
  for (const split of temporalSplits) {
    const rows = await readJsonl(path.join(dataDir, `${split}.jsonl`));
    if (!rows.length) errors.push(`${split}.jsonl must contain examples.`);
    if (manifest.splits?.[split]?.examples_written !== rows.length) {
      errors.push(`${split}.jsonl row count does not match temporal manifest.`);
    }
    rows.forEach((row, index) => validateExample(row, `${split}:${index + 1}`));
    papersBySplit.set(split, new Set(rows.map((row) => row.input.document_metadata.paper_id)));
    monthsBySplit.set(split, new Set(rows.map((row) => row.input.document_metadata.inferred_publication_month).filter(Boolean)));
  }

  for (let i = 0; i < temporalSplits.length; i += 1) {
    for (let j = i + 1; j < temporalSplits.length; j += 1) {
      const left = temporalSplits[i];
      const right = temporalSplits[j];
      const sharedPapers = intersection(papersBySplit.get(left), papersBySplit.get(right));
      const sharedMonths = intersection(monthsBySplit.get(left), monthsBySplit.get(right));
      if (sharedPapers.length) errors.push(`${left} and ${right} share papers: ${sharedPapers.slice(0, 5).join(", ")}.`);
      if (sharedMonths.length) errors.push(`${left} and ${right} share inferred months: ${sharedMonths.slice(0, 5).join(", ")}.`);
    }
  }

  const lastTrain = manifest.splits.temporal_train?.last_paper_month;
  const firstValidation = manifest.splits.temporal_validation?.first_paper_month;
  const lastValidation = manifest.splits.temporal_validation?.last_paper_month;
  const firstTest = manifest.splits.temporal_test?.first_paper_month;
  if (lastTrain && firstValidation && lastTrain >= firstValidation) {
    errors.push("temporal_train must end before temporal_validation starts.");
  }
  if (lastValidation && firstTest && lastValidation >= firstTest) {
    errors.push("temporal_validation must end before temporal_test starts.");
  }
}

async function validateExportsIfPresent() {
  const exportDir = path.join(experimentDir, "exports");
  const manifestPath = path.join(exportDir, "manifest.json");
  try {
    await fs.access(manifestPath);
  } catch {
    return;
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  for (const [split, stats] of Object.entries(manifest.splits ?? {})) {
    const outputPath = path.join(rootDir, stats.output_path);
    const rows = await readJsonl(outputPath);
    if (rows.length !== stats.examples_written) errors.push(`${split} export row count does not match manifest.`);
    rows.forEach((row, index) => {
      const label = `${split}.sft:${index + 1}`;
      if (!row.example_id) errors.push(`${label}: missing example_id.`);
      if (row.task !== "citation_grounded_domain_qa_sft") errors.push(`${label}: unexpected export task.`);
      if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${label}: expected three chat messages.`);
      if (!row.input?.question) errors.push(`${label}: missing input.question.`);
      if (!Array.isArray(row.input?.compact_retrieved_evidence_pack) || !row.input.compact_retrieved_evidence_pack.length) {
        errors.push(`${label}: missing exported evidence pack.`);
      }
      if (!row.target?.answer_type || !row.target?.answer) errors.push(`${label}: missing target answer.`);
      if (row.target.answer_type === "grounded_answer" && !row.target.citations?.length) {
        errors.push(`${label}: grounded export target needs citations.`);
      }
    });
  }
}

async function validateLlmBudgetIfPresent() {
  const llmDir = path.join(experimentDir, "llm-calls");
  const budgetPath = path.join(llmDir, "budget.json");
  const ledgerPath = path.join(llmDir, "ledger.jsonl");
  try {
    await fs.access(budgetPath);
    await fs.access(ledgerPath);
  } catch {
    return;
  }

  const budget = JSON.parse(await fs.readFile(budgetPath, "utf8"));
  const ledger = await readJsonl(ledgerPath);
  const spend = ledger.reduce((total, row) => total + Number(row.cost_usd ?? 0), 0);
  if (!Number.isFinite(budget.max_budget_usd) || budget.max_budget_usd <= 0) {
    errors.push("LLM budget must include positive max_budget_usd.");
  }
  if (spend - budget.max_budget_usd > 1e-9) {
    errors.push(`LLM ledger spend $${spend.toFixed(6)} exceeds max budget $${budget.max_budget_usd.toFixed(2)}.`);
  }
  if (Math.abs(spend - Number(budget.ledger_spend_usd ?? NaN)) > 1e-9) {
    errors.push("LLM budget ledger_spend_usd does not match ledger.jsonl total.");
  }
  ledger.forEach((row, index) => {
    const label = `llm ledger:${index + 1}`;
    if (!row.provider || !row.model || !row.run_id || !row.example_id) errors.push(`${label}: missing provider/model/run/example.`);
    if (!Number.isFinite(Number(row.cost_usd)) || Number(row.cost_usd) < 0) errors.push(`${label}: invalid cost_usd.`);
    if (!Number.isFinite(Number(row.total_tokens)) || Number(row.total_tokens) <= 0) errors.push(`${label}: invalid total_tokens.`);
  });
}

async function validateJudgeRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("openai-judge-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const judgmentsPath = path.join(runsDir, entry.name, "judgments.jsonl");
    let result;
    let judgments;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      judgments = await readJsonl(judgmentsPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed judge result artifacts.`);
      continue;
    }

    const callsMade = judgments.filter((row) => !row.skipped).length;
    const callsSkipped = judgments.filter((row) => row.skipped).length;
    const runCost = judgments.reduce((total, row) => total + Number(row.cost_usd ?? 0), 0);
    if (result.calls_made !== callsMade) errors.push(`${entry.name}: calls_made does not match judgments.`);
    if (result.calls_skipped !== callsSkipped) errors.push(`${entry.name}: calls_skipped does not match judgments.`);
    if (Math.abs(Number(result.run_cost_usd ?? 0) - runCost) > 1e-9) {
      errors.push(`${entry.name}: run_cost_usd does not match judgments.`);
    }

    for (const [index, row] of judgments.entries()) {
      const label = `${entry.name}.judgments:${index + 1}`;
      if (!row.example_id || row.prediction_run !== result.prediction_run || row.model !== result.model) {
        errors.push(`${label}: missing or inconsistent example/prediction/model fields.`);
      }
      if (row.skipped) continue;
      const verdict = row.judgment?.verdict;
      if (!["supported", "partial", "unsupported", "correct_abstention", "incorrect_abstention", "invalid"].includes(verdict)) {
        errors.push(`${label}: invalid judgment verdict.`);
      }
      if (!Number.isFinite(Number(row.cost_usd)) || Number(row.cost_usd) < 0) {
        errors.push(`${label}: invalid cost_usd.`);
      }
    }
  }
}

async function validateOpenAiStudentRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("openai-student-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    let result;
    let predictions;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed OpenAI student artifacts.`);
      continue;
    }

    const callsMade = predictions.filter((row) => !row.skipped).length;
    const callsSkipped = predictions.filter((row) => row.skipped).length;
    const runCost = predictions.reduce((total, row) => total + Number(row.cost_usd ?? 0), 0);
    if (result.examples_requested !== predictions.length) errors.push(`${entry.name}: examples_requested does not match predictions.`);
    if (result.calls_made !== callsMade) errors.push(`${entry.name}: calls_made does not match predictions.`);
    if (result.calls_skipped !== callsSkipped) errors.push(`${entry.name}: calls_skipped does not match predictions.`);
    if (Number(result.ledger_spend_after_usd) + 1e-9 < Number(result.ledger_spend_before_usd)) {
      errors.push(`${entry.name}: ledger spend decreased.`);
    }
    if (!result.dry_run) {
      const ledgerCost = await ledgerRunCost(result.run_id);
      if (Math.abs(ledgerCost - runCost) > 1e-6) {
        errors.push(`${entry.name}: ledger rows for run_id do not match prediction costs.`);
      }
    }
    const strictPredictionSchema = ["teacher-label-rubric", "teacher-label-balanced-rubric"].includes(result.scaffold);
    if (strictPredictionSchema) {
      if (!result.teacher_label_prefix || result.scaffold_summary?.mode !== result.scaffold) {
        errors.push(`${entry.name}: teacher-label rubric scaffold missing or inconsistent summary.`);
      }
      if (!Number.isFinite(Number(result.scaffold_summary?.answer_rate))) {
        errors.push(`${entry.name}: teacher-label rubric scaffold missing answer_rate.`);
      }
    }

    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || row.model !== result.model) errors.push(`${label}: missing or inconsistent example/model.`);
      if (row.skipped) continue;
      if (!Number.isFinite(Number(row.cost_usd)) || Number(row.cost_usd) < 0) errors.push(`${label}: invalid cost_usd.`);
      const answerType = row.prediction?.answer_type;
      if (!answerType) errors.push(`${label}: missing prediction answer_type.`);
      if (strictPredictionSchema && !["grounded_answer", "abstain", "parse_error"].includes(answerType)) {
        errors.push(`${label}: invalid prediction answer_type.`);
      }
    }
  }
}

async function ledgerRunCost(runId) {
  const ledgerPath = path.join(experimentDir, "llm-calls", "ledger.jsonl");
  try {
    const rows = await readJsonl(ledgerPath);
    return rows
      .filter((row) => row.run_id === runId)
      .reduce((total, row) => total + Number(row.cost_usd ?? 0), 0);
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

async function validateMultistepTeacherRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("openai-multistep-teacher-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    const tracesPath = path.join(runsDir, entry.name, "teacher_traces.jsonl");
    let result;
    let predictions;
    let traces;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
      traces = await readJsonl(tracesPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed multi-step teacher artifacts.`);
      continue;
    }

    if (predictions.length !== traces.length) errors.push(`${entry.name}: predictions and traces row counts differ.`);
    if (result.examples_requested !== predictions.length) errors.push(`${entry.name}: examples_requested does not match predictions.`);
    const callsMade = traces.reduce((total, row) => total
      + (row.planner_usage ? 1 : 0)
      + (row.answer_usage ? 1 : 0)
      + (row.repair_usage ? 1 : 0), 0);
    const runCost = predictions.reduce((total, row) => total + Number(row.cost_usd ?? 0), 0);
    if (result.calls_made !== callsMade) errors.push(`${entry.name}: calls_made does not match traces.`);
    if (Math.abs(Number(result.run_cost_usd ?? 0) - runCost) > 1e-9) {
      errors.push(`${entry.name}: run_cost_usd does not match predictions.`);
    }

    for (const [index, trace] of traces.entries()) {
      const label = `${entry.name}.teacher_traces:${index + 1}`;
      if (!trace.example_id) errors.push(`${label}: missing example_id.`);
      if (trace.skipped) continue;
      if (!trace.plan || typeof trace.plan.sufficient !== "boolean") errors.push(`${label}: missing normalized plan.`);
      if (!Array.isArray(trace.plan?.selected_evidence_ids)) errors.push(`${label}: plan selected_evidence_ids must be an array.`);
      if (!Number.isFinite(Number(trace.planner_cost_usd)) || Number(trace.planner_cost_usd) < 0) {
        errors.push(`${label}: invalid planner_cost_usd.`);
      }
      if (!Number.isFinite(Number(trace.answer_cost_usd)) || Number(trace.answer_cost_usd) < 0) {
        errors.push(`${label}: invalid answer_cost_usd.`);
      }
      if (trace.repair_enabled && !("repair_cost_usd" in trace)) {
        errors.push(`${label}: repair-enabled trace missing repair_cost_usd.`);
      }
      if ("repair_cost_usd" in trace && (!Number.isFinite(Number(trace.repair_cost_usd)) || Number(trace.repair_cost_usd) < 0)) {
        errors.push(`${label}: invalid repair_cost_usd.`);
      }
    }
  }
}

async function validateTeacherLabelExportsIfPresent() {
  const exportDir = path.join(experimentDir, "exports");
  let entries = [];
  try {
    entries = await fs.readdir(exportDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith("teacher-repair-") || !entry.name.endsWith(".manifest.json")) continue;
    const manifestPath = path.join(exportDir, entry.name);
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const acceptedPath = path.join(rootDir, manifest.artifacts?.accepted_sft_jsonl ?? "");
    const rejectedPath = path.join(rootDir, manifest.artifacts?.rejected_jsonl ?? "");
    let accepted;
    let rejected;
    try {
      accepted = await readJsonl(acceptedPath);
      rejected = await readJsonl(rejectedPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed teacher-label export artifacts.`);
      continue;
    }

    if (accepted.length !== manifest.accepted_labels) errors.push(`${entry.name}: accepted label count does not match manifest.`);
    if (rejected.length !== manifest.rejected_labels) errors.push(`${entry.name}: rejected label count does not match manifest.`);
    if (accepted.length + rejected.length !== manifest.examples_seen) errors.push(`${entry.name}: accepted plus rejected count does not match examples_seen.`);
    if (!Number.isFinite(Number(manifest.total_labeling_cost_usd)) || Number(manifest.total_labeling_cost_usd) < 0) {
      errors.push(`${entry.name}: invalid total_labeling_cost_usd.`);
    }

    accepted.forEach((row, index) => validateTeacherLabel(row, `${entry.name}.accepted:${index + 1}`, true));
    rejected.forEach((row, index) => validateTeacherLabel(row, `${entry.name}.rejected:${index + 1}`, false));
  }
}

async function validateTeacherLabelFilterRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("teacher-label-filter-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    let result;
    let predictions;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed teacher-label filter artifacts.`);
      continue;
    }

    if (result.filtered?.examples !== predictions.length) errors.push(`${entry.name}: filtered examples does not match predictions.`);
    if (!result.model?.weights || typeof result.model.weights !== "object") errors.push(`${entry.name}: missing filter weights.`);
    if (!Number.isFinite(Number(result.model?.selected_threshold))) errors.push(`${entry.name}: invalid selected threshold.`);
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !row.prediction?.answer_type || !row.reference?.answer_type || !row.scores) {
        errors.push(`${label}: missing prediction/reference/scores.`);
      }
      if (!["grounded_answer", "abstain"].includes(row.prediction?.answer_type)) {
        errors.push(`${label}: invalid prediction answer_type.`);
      }
      if (row.metadata?.forced_abstain && row.prediction?.answer_type !== "abstain") {
        errors.push(`${label}: forced abstention row must abstain.`);
      }
    }
  }
}

async function validateFineTunePrepRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("openai-finetune-prep-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
    } catch {
      errors.push(`${entry.name}: missing or malformed fine-tune prep result.`);
      continue;
    }
    const trainPath = path.join(rootDir, result.artifacts?.train_jsonl ?? "");
    const validationPath = path.join(rootDir, result.artifacts?.validation_jsonl ?? "");
    let trainRows;
    let validationRows;
    try {
      trainRows = await readJsonl(trainPath);
      validationRows = await readJsonl(validationPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed OpenAI fine-tune JSONL files.`);
      continue;
    }
    if (trainRows.length !== result.examples?.train) errors.push(`${entry.name}: train row count does not match result.`);
    if (validationRows.length !== result.examples?.validation) errors.push(`${entry.name}: validation row count does not match result.`);
    if (result.launch_performed) errors.push(`${entry.name}: launch_performed should be false unless validator learns job ledger checks.`);
    if (!Number.isFinite(Number(result.budget?.estimated_training_cost_usd)) || Number(result.budget.estimated_training_cost_usd) < 0) {
      errors.push(`${entry.name}: invalid estimated_training_cost_usd.`);
    }
    for (const [index, row] of [...trainRows, ...validationRows].entries()) {
      const label = `${entry.name}.openai_jsonl:${index + 1}`;
      if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${label}: expected three messages.`);
      if (row.messages?.[0]?.role !== "system" || row.messages?.[1]?.role !== "user" || row.messages?.[2]?.role !== "assistant") {
        errors.push(`${label}: expected system/user/assistant roles.`);
      }
      if (!row.metadata?.example_id) errors.push(`${label}: missing metadata.example_id.`);
    }
  }
}

async function validateTeacherLabelScaffoldRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("teacher-label-scaffold-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    let result;
    let predictions;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed teacher-label scaffold artifacts.`);
      continue;
    }
    if (result.heldout?.examples !== predictions.length) errors.push(`${entry.name}: heldout examples do not match predictions.`);
    if (result.cost?.llm_calls !== 0) errors.push(`${entry.name}: teacher-label scaffold should not make LLM calls.`);
    if (!result.evidence_selector || !result.sufficiency_model || !result.span_model) {
      errors.push(`${entry.name}: missing scaffold model summaries.`);
    }
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !row.prediction?.answer_type || !row.reference?.answer_type || !row.scores) {
        errors.push(`${label}: missing prediction/reference/scores.`);
      }
      if (!["grounded_answer", "abstain"].includes(row.prediction?.answer_type)) {
        errors.push(`${label}: invalid prediction answer_type.`);
      }
      if (row.prediction?.answer_type === "grounded_answer") {
        for (const citation of row.prediction.citations ?? []) {
          if (!row.prediction.answer.includes(`[${citation}]`)) errors.push(`${label}: missing inline citation [${citation}].`);
        }
      }
    }
  }
}

async function validateHfSftPrepRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("hf-sft-prep-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
    } catch {
      errors.push(`${entry.name}: missing or malformed HF SFT prep result.`);
      continue;
    }

    const trainPath = path.join(rootDir, result.artifacts?.train_jsonl ?? "");
    const validationPath = path.join(rootDir, result.artifacts?.validation_jsonl ?? "");
    const evalPath = path.join(rootDir, result.artifacts?.eval_prompts_jsonl ?? "");
    const datasetDir = path.join(rootDir, result.artifacts?.hf_dataset_repo_dir ?? "");
    const validationScriptPath = path.join(rootDir, result.artifacts?.validation_script ?? "");
    const trainScriptPath = path.join(rootDir, result.artifacts?.train_script ?? "");
    const jobSpecPath = path.join(rootDir, result.artifacts?.job_spec ?? "");
    let trainRows;
    let validationRows;
    let evalRows;
    let jobSpec;
    try {
      trainRows = await readJsonl(trainPath);
      validationRows = await readJsonl(validationPath);
      evalRows = await readJsonl(evalPath);
      jobSpec = JSON.parse(await fs.readFile(jobSpecPath, "utf8"));
      await fs.access(path.join(datasetDir, "train.jsonl"));
      await fs.access(path.join(datasetDir, "validation.jsonl"));
      await fs.access(path.join(datasetDir, "eval_prompts.jsonl"));
      await fs.access(path.join(datasetDir, "README.md"));
      await fs.access(validationScriptPath);
      await fs.access(trainScriptPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed HF SFT prep artifacts.`);
      continue;
    }

    if (trainRows.length !== result.examples?.train) errors.push(`${entry.name}: train row count does not match result.`);
    if (validationRows.length !== result.examples?.validation) errors.push(`${entry.name}: validation row count does not match result.`);
    if (evalRows.length !== result.examples?.eval_prompts) errors.push(`${entry.name}: eval prompt count does not match result.`);
    if (
      !result.data_url_base?.startsWith("https://raw.githubusercontent.com/")
      && !result.data_url_base?.startsWith("https://gist.githubusercontent.com/")
    ) {
      errors.push(`${entry.name}: data_url_base must be a GitHub raw or gist raw URL for HF Jobs reproducibility.`);
    }
    if (!result.base_model || !result.hub_model_id) errors.push(`${entry.name}: missing base_model or hub_model_id.`);
    if (result.llm_budget?.openai_llm_calls !== 0 || result.llm_budget?.openai_cost_usd !== 0) {
      errors.push(`${entry.name}: HF SFT prep must not spend OpenAI calls.`);
    }
    if (!Number.isFinite(Number(result.estimated_hf_job_cost_usd)) || Number(result.estimated_hf_job_cost_usd) < 0) {
      errors.push(`${entry.name}: invalid estimated_hf_job_cost_usd.`);
    }
    if (jobSpec.operation !== "uv" || !jobSpec.args?.script || !jobSpec.args?.flavor || !jobSpec.args?.timeout) {
      errors.push(`${entry.name}: malformed HF job spec.`);
    }
    if (!jobSpec.args?.secrets?.HF_TOKEN) errors.push(`${entry.name}: HF job spec must pass HF_TOKEN secret for Hub push.`);

    for (const [index, row] of [...trainRows, ...validationRows].entries()) {
      const label = `${entry.name}.hf_sft:${index + 1}`;
      validateHfSftRow(row, label);
    }
    for (const [index, row] of evalRows.entries()) {
      const label = `${entry.name}.eval_prompts:${index + 1}`;
      if (!row.example_id || !Array.isArray(row.messages) || row.messages.length !== 2 || !row.input?.question || !row.reference?.answer_type) {
        errors.push(`${label}: malformed eval prompt row.`);
      }
    }
  }
}

async function validateHfSftLaunchPreflightRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("hf-sft-launch-preflight-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed HF SFT launch preflight artifacts.`);
      continue;
    }

    if (!result.sft_prep_run_id) errors.push(`${entry.name}: missing sft_prep_run_id.`);
    if (result.llm_budget?.openai_llm_calls !== 0 || result.llm_budget?.openai_cost_usd !== 0) {
      errors.push(`${entry.name}: HF SFT launch preflight must not spend OpenAI calls.`);
    }
    if (!result.checks?.dataset_validation?.passed) errors.push(`${entry.name}: dataset validation must pass.`);
    if (!result.checks?.train_script_compile?.passed) errors.push(`${entry.name}: train script compile must pass.`);
    const modules = result.checks?.local_dependencies?.modules ?? {};
    if (!modules.torch || !modules.transformers) errors.push(`${entry.name}: local runtime must at least include torch and transformers.`);
    const hfStatus = result.checks?.hf_jobs_preflight?.status;
    if (!["ready", "blocked", "not_attempted"].includes(hfStatus)) errors.push(`${entry.name}: invalid HF jobs preflight status.`);
    if (!result.conclusion?.status || !result.conclusion?.next_step) errors.push(`${entry.name}: missing launch preflight conclusion.`);
  }
}

async function validateTemporalPacketScaffoldRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("temporal-packet-scaffold-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    const modelPath = path.join(runsDir, entry.name, "temporal-packet-scaffold-model.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let predictions;
    let model;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
      model = JSON.parse(await fs.readFile(modelPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed temporal packet scaffold artifacts.`);
      continue;
    }

    if (!result.sft_prep_run_id) errors.push(`${entry.name}: missing sft_prep_run_id.`);
    if (result.cost?.llm_calls !== 0) errors.push(`${entry.name}: temporal packet scaffold must not make LLM calls.`);
    if (predictions.length !== result.eval?.examples) errors.push(`${entry.name}: eval examples do not match predictions.`);
    if (!model.evidence_selector || !model.sufficiency) errors.push(`${entry.name}: missing scaffold model summaries.`);
    if (!Number.isFinite(Number(result.method?.selected_threshold))) errors.push(`${entry.name}: missing selected threshold.`);
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !row.prediction?.answer_type || !row.reference?.answer_type || !row.scores) {
        errors.push(`${label}: malformed prediction row.`);
        continue;
      }
      if (!["grounded_answer", "abstain"].includes(row.prediction.answer_type)) errors.push(`${label}: invalid prediction answer_type.`);
      if (row.prediction.answer_type === "grounded_answer" && !Array.isArray(row.prediction.citations)) {
        errors.push(`${label}: grounded prediction citations must be an array.`);
      }
    }
  }
}

async function validateTemporalSpanScaffoldRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("temporal-span-scaffold-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    const modelPath = path.join(runsDir, entry.name, "temporal-span-scaffold-model.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let predictions;
    let model;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
      model = JSON.parse(await fs.readFile(modelPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed temporal span scaffold artifacts.`);
      continue;
    }

    if (!result.sft_prep_run_id) errors.push(`${entry.name}: missing sft_prep_run_id.`);
    if (result.cost?.llm_calls !== 0) errors.push(`${entry.name}: temporal span scaffold must not make LLM calls.`);
    if (predictions.length !== result.eval?.examples) errors.push(`${entry.name}: eval examples do not match predictions.`);
    if (!model.span_selector || !model.sufficiency) errors.push(`${entry.name}: missing span scaffold model summaries.`);
    if (!Number.isFinite(Number(result.method?.selected_threshold))) errors.push(`${entry.name}: missing selected threshold.`);
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !row.prediction?.answer_type || !row.reference?.answer_type || !row.scores) {
        errors.push(`${label}: malformed prediction row.`);
        continue;
      }
      if (!["grounded_answer", "abstain"].includes(row.prediction.answer_type)) errors.push(`${label}: invalid prediction answer_type.`);
      if (row.prediction.answer_type === "grounded_answer" && !Array.isArray(row.prediction.citations)) {
        errors.push(`${label}: grounded prediction citations must be an array.`);
      }
    }
  }
}

async function validateLocalGenerativeSftRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("local-generative-sft-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let predictions;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed local generative SFT artifacts.`);
      continue;
    }

    if (!result.sft_prep_run_id) errors.push(`${entry.name}: missing sft_prep_run_id.`);
    if (result.cost?.llm_calls !== 0 || result.cost?.openai_cost_usd !== 0) {
      errors.push(`${entry.name}: local generative SFT must not make OpenAI calls.`);
    }
    if (predictions.length !== result.eval?.examples) errors.push(`${entry.name}: eval examples do not match predictions.`);
    if (!result.training?.trainable_parameters || !Number.isFinite(Number(result.training?.optimizer_steps))) {
      errors.push(`${entry.name}: missing training summary.`);
    }
    if (!Number.isFinite(Number(result.eval?.valid_json_rate))) errors.push(`${entry.name}: missing valid JSON metric.`);
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !row.prediction?.answer_type || !row.reference?.answer_type || !row.scores) {
        errors.push(`${label}: malformed prediction row.`);
        continue;
      }
      if (!["grounded_answer", "abstain"].includes(row.prediction.answer_type)) errors.push(`${label}: invalid prediction answer_type.`);
      if (row.prediction.answer_type === "grounded_answer" && !Array.isArray(row.prediction.citations)) {
        errors.push(`${label}: grounded prediction citations must be an array.`);
      }
    }
  }
}

async function validateLocalGenerativeContractGateRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("local-generative-contract-gate-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let predictions;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed local generative contract gate artifacts.`);
      continue;
    }

    if (result.calls_made !== 0 || Number(result.run_cost_usd) !== 0) {
      errors.push(`${entry.name}: local generative contract gate must be zero-call and zero-cost.`);
    }
    if (!result.source_run_id) errors.push(`${entry.name}: missing source_run_id.`);
    if (!Number.isFinite(Number(result.gate?.threshold))) errors.push(`${entry.name}: missing gate threshold.`);
    if (!Array.isArray(result.threshold_grid) || !result.threshold_grid.length) errors.push(`${entry.name}: missing threshold grid.`);
    if (result.eval_examples !== predictions.length) errors.push(`${entry.name}: eval_examples does not match predictions.`);
    if (result.gate_summary?.source_answered < result.gate_summary?.retained_answers) {
      errors.push(`${entry.name}: retained answers cannot exceed source answered count.`);
    }
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !row.prediction?.answer_type || !row.source_prediction?.answer_type || !row.metadata?.features) {
        errors.push(`${label}: missing prediction/source/features.`);
      }
      if (Number(row.cost_usd) !== 0) errors.push(`${label}: local contract gate prediction must be zero-cost.`);
      if (!["grounded_answer", "abstain"].includes(row.prediction?.answer_type)) {
        errors.push(`${label}: invalid prediction answer_type.`);
      }
      if (row.prediction?.answer_type === "grounded_answer" && !Array.isArray(row.prediction.citations)) {
        errors.push(`${label}: grounded predictions must expose a citations array, even when citation use is wrong.`);
      }
    }
  }
}

async function validateTemporalWindowComparisonRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("temporal-window-comparison-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const runReportPath = path.join(runsDir, entry.name, "report.md");
    const summaryReportPath = path.join(experimentDir, "reports", `${entry.name}.md`);
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(runReportPath);
      await fs.access(summaryReportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed temporal window comparison artifacts.`);
      continue;
    }

    if (result.llm_calls !== 0 || Number(result.run_cost_usd) !== 0) {
      errors.push(`${entry.name}: temporal window comparison synthesis must be zero-call and zero-cost.`);
    }
    if (!Array.isArray(result.systems) || result.systems.length < 5) {
      errors.push(`${entry.name}: expected multiple compared systems.`);
      continue;
    }
    if (!result.comparability_note) errors.push(`${entry.name}: missing comparability note.`);
    const referenceSystems = result.systems.filter((system) => system.reference_metrics);
    const supportOracleSystems = result.systems.filter((system) => system.support_oracle_metrics);
    if (!referenceSystems.length) errors.push(`${entry.name}: missing reference-metric systems.`);
    if (!supportOracleSystems.length) errors.push(`${entry.name}: missing support-oracle systems.`);
    for (const system of result.systems) {
      if (!system.id || !system.label || !system.source_run_id) errors.push(`${entry.name}: malformed system identity.`);
      if (system.examples !== 69) errors.push(`${entry.name}: ${system.id} must compare the 69-example 321-389 window.`);
      if (!system.source_metric_family) errors.push(`${entry.name}: ${system.id} missing source metric family.`);
      if (system.reference_metrics && !Number.isFinite(Number(system.reference_metrics.inline_citation_rate))) {
        errors.push(`${entry.name}: ${system.id} missing inline citation metric.`);
      }
      if (system.support_oracle_metrics && !Number.isFinite(Number(system.support_oracle_metrics.support_oracle_correct_rate))) {
        errors.push(`${entry.name}: ${system.id} missing support-oracle correctness.`);
      }
    }
  }
}

async function validateSupportContrastPrepRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("support-contrast-prep-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const sftTrainPath = path.join(runsDir, entry.name, "sft_train.jsonl");
    const sftValidationPath = path.join(runsDir, entry.name, "sft_validation.jsonl");
    const preferenceTrainPath = path.join(runsDir, entry.name, "preference_train.jsonl");
    const preferenceValidationPath = path.join(runsDir, entry.name, "preference_validation.jsonl");
    const evalPromptsPath = path.join(runsDir, entry.name, "eval_prompts.jsonl");
    let result;
    let sftTrain;
    let sftValidation;
    let preferenceTrain;
    let preferenceValidation;
    let evalPrompts;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      sftTrain = await readJsonl(sftTrainPath);
      sftValidation = await readJsonl(sftValidationPath);
      preferenceTrain = await readJsonl(preferenceTrainPath);
      preferenceValidation = await readJsonl(preferenceValidationPath);
      evalPrompts = await readJsonl(evalPromptsPath);
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed support-contrast prep artifacts.`);
      continue;
    }

    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0) {
      errors.push(`${entry.name}: support-contrast prep must be zero-call and zero-cost.`);
    }
    if (result.examples?.sft_train !== sftTrain.length) errors.push(`${entry.name}: sft_train count mismatch.`);
    if (result.examples?.sft_validation !== sftValidation.length) errors.push(`${entry.name}: sft_validation count mismatch.`);
    if (result.examples?.preference_train !== preferenceTrain.length) errors.push(`${entry.name}: preference_train count mismatch.`);
    if (result.examples?.preference_validation !== preferenceValidation.length) errors.push(`${entry.name}: preference_validation count mismatch.`);
    if (result.examples?.eval_prompts !== evalPrompts.length) errors.push(`${entry.name}: eval prompt count mismatch.`);
    if (!sftTrain.length || !preferenceTrain.length || !evalPrompts.length) {
      errors.push(`${entry.name}: support-contrast packet must include train SFT, train preferences, and eval prompts.`);
    }

    const evalPapers = new Set(evalPrompts.map((row) => row.input?.document_metadata?.paper_id).filter(Boolean));
    const trainRows = [...sftTrain, ...preferenceTrain];
    const validationRows = [...sftValidation, ...preferenceValidation];
    const trainLeaks = trainRows.filter((row) => evalPapers.has(row.input?.document_metadata?.paper_id));
    const validationLeaks = validationRows.filter((row) => evalPapers.has(row.input?.document_metadata?.paper_id));
    if (trainLeaks.length) errors.push(`${entry.name}: train rows share eval papers.`);
    if (validationLeaks.length) errors.push(`${entry.name}: validation rows share eval papers.`);

    for (const [index, row] of sftTrain.entries()) validateSupportContrastSftRow(row, `${entry.name}.sft_train:${index + 1}`);
    for (const [index, row] of sftValidation.entries()) validateSupportContrastSftRow(row, `${entry.name}.sft_validation:${index + 1}`);
    for (const [index, row] of preferenceTrain.entries()) validateSupportContrastPreferenceRow(row, `${entry.name}.preference_train:${index + 1}`);
    for (const [index, row] of preferenceValidation.entries()) validateSupportContrastPreferenceRow(row, `${entry.name}.preference_validation:${index + 1}`);
    for (const [index, row] of evalPrompts.entries()) {
      const label = `${entry.name}.eval:${index + 1}`;
      if (!row.example_id || !Array.isArray(row.messages) || row.messages.length !== 2 || !row.input?.question || !row.reference?.answer_type) {
        errors.push(`${label}: malformed eval prompt row.`);
      }
    }
  }
}

function validateSupportContrastSftRow(row, label) {
  if (row.task !== "citation_grounded_domain_qa_sft") errors.push(`${label}: unexpected task.`);
  if (!row.example_id || !row.input?.question || !row.target?.answer_type) errors.push(`${label}: missing identity/input/target.`);
  if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${label}: expected three SFT messages.`);
  if (row.target?.answer_type !== "grounded_answer") errors.push(`${label}: support SFT target must be grounded_answer.`);
  if (!Array.isArray(row.target?.citations) || !row.target.citations.length) errors.push(`${label}: grounded SFT target needs citations.`);
  if (!row.label_source?.judge) errors.push(`${label}: missing support judge label source.`);
}

function validateSupportContrastPreferenceRow(row, label) {
  if (row.task !== "citation_grounded_domain_qa_support_preference") errors.push(`${label}: unexpected task.`);
  if (!row.example_id || !row.input?.question || !row.chosen?.answer_type || !row.rejected?.answer_type) {
    errors.push(`${label}: missing identity/input/chosen/rejected.`);
  }
  if (!Array.isArray(row.messages) || row.messages.length !== 2) errors.push(`${label}: expected two prompt messages.`);
  if (!Array.isArray(row.chosen_messages) || row.chosen_messages.length !== 3) errors.push(`${label}: expected chosen chat messages.`);
  if (!Array.isArray(row.rejected_messages) || row.rejected_messages.length !== 3) errors.push(`${label}: expected rejected chat messages.`);
  if (row.chosen?.answer_type !== "abstain") errors.push(`${label}: chosen contrast must abstain.`);
  if (row.rejected?.answer_type !== "grounded_answer") errors.push(`${label}: rejected contrast must be grounded_answer.`);
  if (!row.label_source?.rejection_reason) errors.push(`${label}: missing rejection reason.`);
}

async function validateSupportContrastGateRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("support-contrast-gate-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    const trainPath = path.join(runsDir, entry.name, "train_predictions.jsonl");
    const validationPath = path.join(runsDir, entry.name, "validation_predictions.jsonl");
    const modelPath = path.join(runsDir, entry.name, "risk-gate-model.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let predictions;
    let trainPredictions;
    let validationPredictions;
    let model;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
      trainPredictions = await readJsonl(trainPath);
      validationPredictions = await readJsonl(validationPath);
      model = JSON.parse(await fs.readFile(modelPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed support-contrast gate artifacts.`);
      continue;
    }

    if (result.cost?.llm_calls !== 0 || Number(result.cost?.run_cost_usd) !== 0) {
      errors.push(`${entry.name}: support-contrast gate must be zero-call and zero-cost.`);
    }
    if (!result.support_contrast_run_id) errors.push(`${entry.name}: missing support_contrast_run_id.`);
    if (!result.validation_metrics) errors.push(`${entry.name}: missing validation metrics.`);
    if (!result.inherited_judge_metrics?.available) errors.push(`${entry.name}: missing inherited judge metrics.`);
    if (result.eval_examples !== predictions.length) errors.push(`${entry.name}: eval_examples does not match predictions.`);
    if (result.train_metrics?.examples !== trainPredictions.length) errors.push(`${entry.name}: train metrics do not match train predictions.`);
    if (result.validation_metrics?.examples !== validationPredictions.length) errors.push(`${entry.name}: validation metrics do not match validation predictions.`);
    if (!Array.isArray(model.feature_names) || !model.feature_names.length || !model.weights) {
      errors.push(`${entry.name}: model is missing feature names or weights.`);
    }
    if (!Number.isFinite(Number(model.threshold))) errors.push(`${entry.name}: missing model threshold.`);
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !row.prediction?.answer_type || !row.source_prediction?.answer_type || !row.metadata) {
        errors.push(`${label}: missing prediction/source/metadata.`);
      }
      if (Number(row.cost_usd) !== 0) errors.push(`${label}: support-contrast gate prediction must be zero-cost.`);
      if (row.prediction?.answer_type === "grounded_answer") {
        if (!Array.isArray(row.prediction.citations)) {
          errors.push(`${label}: grounded predictions must expose a citations array, even when citation use is wrong.`);
        }
        if (!Number.isFinite(Number(row.scores.inline_citation_rate))) {
          errors.push(`${label}: grounded predictions must record inline_citation_rate.`);
        }
      }
    }
  }
}

async function validateAbstentionSupportErrorAnalysisRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("abstention-support-error-analysis-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const rowAnalysisPath = path.join(runsDir, entry.name, "row_analysis.jsonl");
    const groupsPath = path.join(runsDir, entry.name, "error_groups.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let rows;
    let groups;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      rows = await readJsonl(rowAnalysisPath);
      groups = JSON.parse(await fs.readFile(groupsPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed abstention-support error analysis artifacts.`);
      continue;
    }

    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0) {
      errors.push(`${entry.name}: abstention-support error analysis must be zero-call and zero-cost.`);
    }
    if (result.eval_examples !== rows.length) errors.push(`${entry.name}: eval_examples does not match row analysis.`);
    if (!result.gate_run_id || !result.source_run_id || !result.judge_run_id) {
      errors.push(`${entry.name}: missing source run identifiers.`);
    }
    const categoryCounts = rows.reduce((counts, row) => {
      counts[row.category] = (counts[row.category] ?? 0) + 1;
      return counts;
    }, {});
    for (const [category, groupRows] of Object.entries(groups)) {
      if (!Array.isArray(groupRows)) errors.push(`${entry.name}: group ${category} must be an array.`);
      if ((categoryCounts[category] ?? 0) !== groupRows.length) {
        errors.push(`${entry.name}: group ${category} count does not match row analysis.`);
      }
    }
    const counted = Object.values(result.counts ?? {}).every((value) => Number.isFinite(Number(value)) && Number(value) >= 0);
    if (!counted) errors.push(`${entry.name}: counts must be non-negative numbers.`);
    for (const [index, row] of rows.entries()) {
      const label = `${entry.name}.row_analysis:${index + 1}`;
      if (!row.example_id || !row.category || !row.reference_answer_type) errors.push(`${label}: malformed row analysis.`);
      if (row.source_answered && row.source_answer_supported == null) errors.push(`${label}: answered row missing support flag.`);
    }
  }
}

async function validateJointActionGpuPrepRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-gpu-prep-")) continue;
    if (entry.name.startsWith("joint-action-gpu-prep-qwen7b-span-claim-construction-curriculum-")) continue;
    if (entry.name.startsWith("joint-action-gpu-prep-qwen7b-answer-completion-repair-curriculum-")) continue;
    if (entry.name.startsWith("joint-action-gpu-prep-qwen7b-mixed-metric-repair-curriculum-")) continue;
    if (entry.name.startsWith("joint-action-gpu-prep-qwen7b-support-targeted-planning-curriculum-")) continue;
    if (entry.name.startsWith("joint-action-gpu-prep-qwen7b-qwen-coverage-gap-scaffold-curriculum-")) continue;
    if (entry.name.startsWith("joint-action-gpu-prep-qwen7b-v13-support-delta-curriculum-")) continue;
    if (entry.name.startsWith("joint-action-gpu-prep-qwen7b-nonfinal-frontier-pool-")) continue;
    const runPath = path.join(runsDir, entry.name);
    const datasetPath = path.join(runPath, "dataset");
    const resultPath = path.join(runPath, "result.json");
    let result;
    let sftTrain;
    let sftValidation;
    let dpoTrain;
    let dpoValidation;
    let evalPrompts;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      sftTrain = await readJsonl(path.join(datasetPath, "sft_train.jsonl"));
      sftValidation = await readJsonl(path.join(datasetPath, "sft_validation.jsonl"));
      dpoTrain = await readJsonl(path.join(datasetPath, "dpo_train.jsonl"));
      dpoValidation = await readJsonl(path.join(datasetPath, "dpo_validation.jsonl"));
      evalPrompts = await readJsonl(path.join(datasetPath, "eval_prompts.jsonl"));
      await fs.access(path.join(runPath, "train_joint_action_lora_uv.py"));
      await fs.access(path.join(runPath, "validate_joint_action_dataset_uv.py"));
      await fs.access(path.join(runPath, "prime_gpu_plan.md"));
      await fs.access(path.join(runPath, "report.md"));
    } catch {
      errors.push(`${entry.name}: missing or malformed joint-action GPU prep artifacts.`);
      continue;
    }
    const trainScript = await fs.readFile(path.join(runPath, "train_joint_action_lora_uv.py"), "utf8");
    if (!trainScript.includes("MAX_SFT_STEPS") || !trainScript.includes("MAX_DPO_STEPS")) {
      errors.push(`${entry.name}: joint-action training script must expose bounded smoke step caps.`);
    }
    if (!trainScript.includes('PUSH_TO_HUB = os.environ.get("PUSH_TO_HUB", "false")')) {
      errors.push(`${entry.name}: joint-action training script must default hub push off.`);
    }
    if (trainScript.includes("\ndpo.push_to_hub()\n")) {
      errors.push(`${entry.name}: joint-action training script must not push to hub unconditionally.`);
    }
    if (result.budget?.openai_calls !== 0 || Number(result.budget?.openai_cost_usd) !== 0) {
      errors.push(`${entry.name}: joint-action GPU prep must make no OpenAI calls.`);
    }
    if (Number(result.estimated_gpu_cost_usd) <= 0 || Number(result.estimated_gpu_cost_usd) >= 100) {
      errors.push(`${entry.name}: estimated GPU cost must be positive and below total budget.`);
    }
    if (result.examples?.sft_train !== sftTrain.length) errors.push(`${entry.name}: sft_train count mismatch.`);
    if (result.examples?.sft_validation !== sftValidation.length) errors.push(`${entry.name}: sft_validation count mismatch.`);
    if (result.examples?.dpo_train !== dpoTrain.length) errors.push(`${entry.name}: dpo_train count mismatch.`);
    if (result.examples?.dpo_validation !== dpoValidation.length) errors.push(`${entry.name}: dpo_validation count mismatch.`);
    if (result.examples?.eval_prompts !== evalPrompts.length) errors.push(`${entry.name}: eval_prompts count mismatch.`);
    if (result.curriculum) {
      const allowedCurriculumTypes = new Set([
        "repair_abstention_oversampled_curriculum",
        "failure_driven_citation_abstention_hard_negative_curriculum",
      ]);
      if (!allowedCurriculumTypes.has(result.curriculum.type)) {
        errors.push(`${entry.name}: unexpected curriculum packet type.`);
      }
      if (!result.source_packet_run_id) {
        errors.push(`${entry.name}: curriculum packet must preserve source packet id.`);
      }
      if (result.curriculum.curriculum_counts?.sft_train?.rows !== sftTrain.length) {
        errors.push(`${entry.name}: curriculum SFT train count must match emitted rows.`);
      }
      if (result.curriculum.curriculum_counts?.dpo_train?.rows !== dpoTrain.length) {
        errors.push(`${entry.name}: curriculum DPO train count must match emitted rows.`);
      }
      if (result.curriculum.curriculum_counts?.eval_prompts?.rows !== evalPrompts.length) {
        errors.push(`${entry.name}: curriculum eval prompt count must match emitted rows.`);
      }
      if (result.curriculum.source_counts?.eval_prompts?.rows !== evalPrompts.length) {
        errors.push(`${entry.name}: curriculum packet must keep the source eval window unchanged.`);
      }
      if (result.curriculum.type === "repair_abstention_oversampled_curriculum") {
        if (!result.curriculum.repairability_run_id) {
          errors.push(`${entry.name}: repair/abstention curriculum must preserve repairability run id.`);
        }
        if (Number(result.curriculum.repairability_signal?.citation_repair_candidate_rows) >= Number(result.curriculum.repairability_signal?.answer_repair_or_regeneration_needed_rows)) {
          errors.push(`${entry.name}: curriculum rationale requires answer repair/regeneration failures to exceed citation-only repairs.`);
        }
        const sftOversampled = sftTrain.filter((row) => row.curriculum_metadata?.oversampled).length;
        const dpoOversampled = dpoTrain.filter((row) => row.curriculum_metadata?.oversampled).length;
        if (!sftOversampled || !dpoOversampled) {
          errors.push(`${entry.name}: curriculum train splits must include oversampled SFT and DPO rows.`);
        }
        if (sftValidation.some((row) => row.curriculum_metadata?.oversampled) || dpoValidation.some((row) => row.curriculum_metadata?.oversampled)) {
          errors.push(`${entry.name}: curriculum validation splits must not be oversampled.`);
        }
      }
      if (result.curriculum.type === "failure_driven_citation_abstention_hard_negative_curriculum") {
        if (!result.failure_run_id || !result.curriculum.failure_signal?.tag_counts) {
          errors.push(`${entry.name}: failure-driven curriculum must preserve failure audit evidence.`);
        }
        if (result.curriculum.leakage_guard?.final_window_failure_labels_used_for_training !== false || result.curriculum.leakage_guard?.eval_example_ids_unchanged !== true || result.curriculum.leakage_guard?.eval_references_unchanged !== true) {
          errors.push(`${entry.name}: failure-driven curriculum must preserve leakage guards.`);
        }
        const synthetic = dpoTrain.filter((row) => row.curriculum_metadata?.failure_driven_hard_negative);
        if (synthetic.length !== Number(result.curriculum.synthetic_hard_negative_counts?.dpo_train_added)) {
          errors.push(`${entry.name}: failure-driven synthetic DPO train count mismatch.`);
        }
        const noCitationRejected = synthetic.filter((row) => {
          try {
            const rejected = JSON.parse(row.rejected);
            return rejected.answer_type === "grounded_answer" && Array.isArray(rejected.citations) && rejected.citations.length === 0;
          } catch {
            return false;
          }
        }).length;
        if (!noCitationRejected) {
          errors.push(`${entry.name}: failure-driven curriculum must add no-citation grounded-answer hard negatives.`);
        }
      }
    }
    if (!sftTrain.length || !dpoTrain.length || !evalPrompts.length) {
      errors.push(`${entry.name}: SFT, DPO, and eval splits must be nonempty.`);
    }
    for (const [index, row] of dpoTrain.concat(dpoValidation).entries()) {
      const label = `${entry.name}.dpo:${index + 1}`;
      if (!Array.isArray(row.prompt) || row.prompt.length !== 2) errors.push(`${label}: expected two-message prompt.`);
      for (const key of ["chosen", "rejected"]) {
        try {
          const parsed = JSON.parse(row[key]);
          if (!["grounded_answer", "abstain"].includes(parsed.answer_type)) errors.push(`${label}: invalid ${key} answer_type.`);
        } catch {
          errors.push(`${label}: ${key} must be JSON.`);
        }
      }
    }
  }
}

async function validateJointActionLaunchPreflightRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-launch-preflight-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed joint-action launch preflight artifacts.`);
      continue;
    }
    if (!result.packet_run_id) errors.push(`${entry.name}: missing packet_run_id.`);
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: joint-action launch preflight must be zero-cost.`);
    }
    if (!result.checks?.dataset_validation?.passed) errors.push(`${entry.name}: dataset validation must pass.`);
    if (!result.checks?.train_script_compile?.passed) errors.push(`${entry.name}: train script compile must pass.`);
    const safety = result.checks?.launch_safety ?? {};
    for (const key of ["supports_max_sft_steps", "supports_max_dpo_steps", "push_to_hub_default_false", "report_to_default_none", "unconditional_push_removed"]) {
      if (safety[key] !== true) errors.push(`${entry.name}: launch safety check failed: ${key}.`);
    }
    const status = result.conclusion?.status;
    const profile = result.checks?.prompt_profile ?? {};
    const rowsOverLimit = Number(profile.sft_full?.rows_over_limit) + Number(profile.dpo_prompt?.rows_over_limit) + Number(profile.dpo_full?.rows_over_limit);
    if (rowsOverLimit !== 0 && status !== "ready_for_bounded_gpu_smoke_with_length_truncation_risk") {
      errors.push(`${entry.name}: train prompt profile has rows over configured limits.`);
    }
    if (!["ready_for_bounded_gpu_smoke", "remote_training_ready_local_runtime_incomplete", "needs_length_mitigation_before_full_run", "ready_for_bounded_gpu_smoke_with_length_truncation_risk"].includes(status)) {
      errors.push(`${entry.name}: invalid launch preflight conclusion status.`);
    }
  }
}

async function validateJointActionLaunchPlanRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-launch-plan-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed joint-action launch plan artifacts.`);
      continue;
    }
    if (!["prime_intellect", "huggingface_jobs"].includes(result.provider)) {
      errors.push(`${entry.name}: unexpected launch provider.`);
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: launch planning must be zero actual cost.`);
    }
    if (result.budget?.launch_within_budget !== true) {
      errors.push(`${entry.name}: launch plan must pass budget guardrail.`);
    }
    if (result.preflight_gate?.passed !== true) {
      errors.push(`${entry.name}: launch plan must pass preflight guardrail.`);
    }
    if (!String(result.commands?.bounded_train ?? "").includes("MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none")) {
      errors.push(`${entry.name}: launch plan must emit the bounded smoke command.`);
    }
    if (!String(result.commands?.bounded_train ?? "").includes("run_joint_action_smoke.sh")) {
      errors.push(`${entry.name}: launch plan must point at the train-plus-eval smoke runner.`);
    }
    const ledgerAction = result.ledger?.action;
    if (!["not_recorded", "recorded", "already_recorded", "updated_existing_planned_row"].includes(ledgerAction)) {
      errors.push(`${entry.name}: invalid planned ledger action.`);
    }
    const row = result.ledger?.planned_row;
    if (row?.status !== "planned" || Number(row?.cost_usd) !== 0 || Number(row?.estimated_cost_usd) <= 0) {
      errors.push(`${entry.name}: planned ledger row must record estimate with zero actual cost.`);
    }
  }
}

async function validateTotalSpendBudgetIfPresent() {
  const spendDir = path.join(experimentDir, "spend");
  const budgetPath = path.join(spendDir, "budget.json");
  const ledgerPath = path.join(spendDir, "ledger.jsonl");
  try {
    await fs.access(budgetPath);
    await fs.access(ledgerPath);
  } catch {
    return;
  }
  const budget = JSON.parse(await fs.readFile(budgetPath, "utf8"));
  const externalLedger = await readJsonl(ledgerPath);
  const externalSpend = externalLedger.reduce((total, row) => total + Number(row.cost_usd ?? 0), 0);
  if (Number(budget.max_budget_usd) !== 100) errors.push("Total spend budget max_budget_usd must be 100.");
  if (Math.abs(externalSpend - Number(budget.spend_usd?.external_compute ?? NaN)) > 1e-9) {
    errors.push("Total spend external compute total does not match ledger.");
  }
  if (Number(budget.spend_usd?.total_actual) > Number(budget.max_budget_usd)) {
    errors.push("Total spend exceeds the $100 experiment budget.");
  }
}

async function validateJointActionLocalProbeRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-local-qwen3b-feasibility-probe-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed joint-action local probe artifacts.`);
      continue;
    }
    if (result.probe_type !== "local_qwen3b_joint_action_training_feasibility") {
      errors.push(`${entry.name}: unexpected local probe type.`);
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: local probe must be zero-cost.`);
    }
    if (result.script_patch?.model_device_map_env_supported !== true) {
      errors.push(`${entry.name}: training script must support MODEL_DEVICE_MAP override.`);
    }
    const attempts = result.attempted_commands ?? [];
    if (attempts.length < 2) errors.push(`${entry.name}: local probe must record both auto-device-map and no-offload attempts.`);
    const autoAttempt = attempts.find((attempt) => attempt.id === "auto_device_map_1step");
    const noOffloadAttempt = attempts.find((attempt) => attempt.id === "no_offload_mps_1step");
    if (autoAttempt?.outcome !== "failed" || autoAttempt?.failure_class !== "local_offload_training_incompatible") {
      errors.push(`${entry.name}: auto-device-map attempt must record the MPS/meta backward failure.`);
    }
    if (noOffloadAttempt?.outcome !== "stopped_after_timeout" || noOffloadAttempt?.failure_class !== "local_training_too_slow_for_bounded_smoke") {
      errors.push(`${entry.name}: no-offload attempt must record bounded-smoke impracticality.`);
    }
    if (result.conclusions?.local_training_status !== "not_practical_for_qwen3b_joint_action_smoke") {
      errors.push(`${entry.name}: local probe must conclude local Qwen3B smoke is not practical.`);
    }
    if (result.conclusions?.remote_training_status !== "still_required") {
      errors.push(`${entry.name}: local probe must preserve remote GPU as required.`);
    }
  }
}

async function validateJointActionEvalPrepRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-eval-prep-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed joint-action eval prep artifacts.`);
      continue;
    }
    if (result.prep_type !== "joint_action_qwen3b_adapter_eval_prep") {
      errors.push(`${entry.name}: unexpected eval prep type.`);
    }
    if (Number(result.eval_prompts) !== 69) errors.push(`${entry.name}: eval prep should target the 69-example final window.`);
    const checks = result.script_checks ?? {};
    for (const [key, value] of Object.entries({
      train_compiles: checks.train_compiles,
      eval_compiles: checks.eval_compiles,
      train_saves_dpo_adapter: checks.train_saves_dpo_adapter,
      eval_loads_peft_adapter: checks.eval_loads_peft_adapter,
      eval_writes_predictions: checks.eval_writes_predictions,
      eval_writes_result: checks.eval_writes_result,
      eval_reports_zero_openai_calls: checks.eval_reports_zero_openai_calls,
    })) {
      if (value !== true) errors.push(`${entry.name}: script check ${key} must pass.`);
    }
    const fields = new Set(result.output_contract?.required_prediction_fields ?? []);
    for (const field of ["example_id", "prediction", "reference", "scores", "raw_output", "parse_error", "metadata"]) {
      if (!fields.has(field)) errors.push(`${entry.name}: output contract missing ${field}.`);
    }
    if (!String(result.commands?.bounded_train ?? "").includes("MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none")) {
      errors.push(`${entry.name}: eval prep must retain bounded training command.`);
    }
    if (!String(result.commands?.eval_after_train ?? "").includes("joint-action-dpo-adapter")) {
      errors.push(`${entry.name}: eval prep must evaluate the DPO adapter.`);
    }
    if (Number(result.budget_context?.openai_calls) !== 0 || Number(result.budget_context?.openai_cost_usd) !== 0 || Number(result.budget_context?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: eval prep artifact must be zero-cost.`);
    }
    if (result.conclusion?.status !== "eval_ready_after_gpu_training") {
      errors.push(`${entry.name}: eval prep should be ready after GPU training.`);
    }
  }
}

async function validateJointActionJudgePlanRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-judge-plan-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed joint-action judge plan artifacts.`);
      continue;
    }
    if (result.plan_type !== "joint_action_qwen3b_grounded_correctness_judge_plan") {
      errors.push(`${entry.name}: unexpected judge plan type.`);
    }
    if (Number(result.eval_examples) !== 69) errors.push(`${entry.name}: judge plan should target the 69-example final window.`);
    if (result.budget_gate?.within_budget !== true) errors.push(`${entry.name}: judge plan must pass budget gate.`);
    if (!Number.isFinite(Number(result.budget_gate?.estimated_judge_cost_usd)) || Number(result.budget_gate.estimated_judge_cost_usd) <= 0) {
      errors.push(`${entry.name}: judge plan must include a positive cost estimate.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: judge plan must be zero actual cost.`);
    }
    const command = String(result.commands?.judge_after_predictions ?? "");
    if (!command.includes("--split=extended_temporal_future_holdout")) {
      errors.push(`${entry.name}: judge command must use extended temporal future holdout split.`);
    }
    if (!command.includes("--max-budget-usd=100")) errors.push(`${entry.name}: judge command must keep the $100 budget cap.`);
    if (!String(result.commands?.dry_run_after_predictions ?? "").includes("--dry-run=true")) {
      errors.push(`${entry.name}: judge plan must include a dry-run command.`);
    }
    if (!result.prediction_artifact?.expected_path || typeof result.prediction_artifact.exists !== "boolean") {
      errors.push(`${entry.name}: judge plan must record prediction artifact prerequisite.`);
    }
    if (!result.integrity_gate?.expected_path || typeof result.integrity_gate.exists !== "boolean") {
      errors.push(`${entry.name}: judge plan must record prediction integrity gate prerequisite.`);
    }
    if (!result.post_smoke_pipeline?.expected_path || typeof result.post_smoke_pipeline.exists !== "boolean") {
      errors.push(`${entry.name}: judge plan must record guarded post-smoke pipeline prerequisite.`);
    }
    if (!String(result.commands?.integrity_gate_after_predictions ?? "").includes("grounded-qa-distillation-qwen3b-prediction-integrity-gate.mjs")) {
      errors.push(`${entry.name}: judge plan must include the Qwen3B prediction integrity gate command.`);
    }
    if (!String(result.commands?.guarded_post_smoke_pipeline ?? "").includes("grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs")) {
      errors.push(`${entry.name}: judge plan must include the guarded Qwen3B post-smoke pipeline command.`);
    }
    if (!["waiting_for_qwen3b_predictions", "ready_to_dry_run_or_judge"].includes(result.conclusion?.status)) {
      errors.push(`${entry.name}: unexpected judge plan status.`);
    }
  }
}

async function validateJointActionRemoteSmokePlanRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-remote-smoke-plan-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed joint-action remote smoke plan artifacts.`);
      continue;
    }
    if (result.plan_type !== "joint_action_remote_smoke_single_command_plan") {
      errors.push(`${entry.name}: unexpected remote smoke plan type.`);
    }
    const checks = result.runner ?? {};
    for (const [key, value] of Object.entries({
      executable: checks.executable,
      bash_syntax_ok: checks.bash_syntax_ok,
      validates_dataset: checks.validates_dataset,
      runs_bounded_train: checks.runs_bounded_train,
      runs_adapter_eval: checks.runs_adapter_eval,
      writes_smoke_manifest: checks.writes_smoke_manifest,
      points_to_judge_next_step: checks.points_to_judge_next_step,
    })) {
      if (value !== true) errors.push(`${entry.name}: runner check ${key} must pass.`);
    }
    const command = String(result.command ?? "");
    if (!command.includes("MAX_SFT_STEPS=20") || !command.includes("MAX_DPO_STEPS=10") || !command.includes("PUSH_TO_HUB=false")) {
      errors.push(`${entry.name}: single command must preserve bounded smoke settings.`);
    }
    if (!result.expected_artifacts?.predictions_jsonl || !result.expected_artifacts?.smoke_manifest_json) {
      errors.push(`${entry.name}: remote smoke plan must list expected prediction and manifest artifacts.`);
    }
    if (Number(result.budget_context?.estimated_total_after_smoke_and_judge_usd) > Number(result.budget_context?.max_budget_usd)) {
      errors.push(`${entry.name}: remote smoke plus judge estimate must stay under budget.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: remote smoke plan must be zero actual cost.`);
    }
    if (result.conclusion?.status !== "ready_for_backend_auth_then_single_command_smoke") {
      errors.push(`${entry.name}: unexpected remote smoke plan status.`);
    }
  }
}

async function validateJointActionScriptContractAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-script-contract-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed joint-action script contract audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "joint_action_script_contract_audit") {
      errors.push(`${entry.name}: unexpected artifact_type.`);
    }
    if (result.status !== "script_contract_ready_for_paid_smoke") {
      errors.push(`${entry.name}: script contract audit must pass before launch.`);
    }
    if (!Array.isArray(result.commands) || result.commands.length < 4 || !result.commands.every((row) => row.status === 0)) {
      errors.push(`${entry.name}: all local contract commands must pass.`);
    }
    const checks = result.checks ?? [];
    if (!Array.isArray(checks) || checks.length < 10) {
      errors.push(`${entry.name}: expected script contract checks.`);
    }
    for (const check of checks) {
      if (check.status !== "pass") errors.push(`${entry.name}: check ${check.id} did not pass.`);
    }
    const command = String(result.smoke_command ?? "");
    if (!command.includes("MAX_SFT_STEPS=20") || !command.includes("MAX_DPO_STEPS=10") || !command.includes("PUSH_TO_HUB=false") || !command.includes("REPORT_TO=none")) {
      errors.push(`${entry.name}: smoke command must preserve bounded no-side-effect defaults.`);
    }
    if (!result.expected_artifacts?.predictions_jsonl || !result.expected_artifacts?.smoke_manifest_json) {
      errors.push(`${entry.name}: script contract audit must list expected smoke artifacts.`);
    }
    if (!Array.isArray(result.evidence_boundary) || !result.evidence_boundary.some((item) => String(item).includes("does not train Qwen 3B"))) {
      errors.push(`${entry.name}: script contract audit must state its evidence boundary.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: script contract audit must be zero actual cost.`);
    }
    if (!report.includes("Bounded Smoke Command") || !report.includes("does not train Qwen 3B")) {
      errors.push(`${entry.name}: report must expose command and evidence boundary.`);
    }
  }
}

async function validateJointActionSmokeLedgerFinalizerRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-smoke-ledger-finalizer-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed smoke ledger finalizer artifacts.`);
      continue;
    }
    if (result.artifact_type !== "joint_action_smoke_ledger_finalizer") {
      errors.push(`${entry.name}: unexpected artifact_type.`);
    }
    if (!["waiting_for_smoke_artifacts", "artifacts_ready_for_actual_cost_record", "actual_completed_recorded", "actual_failed_after_creation_recorded", "actual_cancelled_after_creation_recorded", "already_recorded", "refused_budget_exceeded", "refused_missing_completed_artifacts", "refused_non_terminal_status"].includes(result.status)) {
      errors.push(`${entry.name}: unexpected finalizer status.`);
    }
    const allowedPacketRunIds = new Set([
      activeQwen3bPacketRunId,
      "joint-action-gpu-prep-qwen3b-failure-driven-curriculum-v3",
      "joint-action-gpu-prep-qwen3b-support-aware-curriculum-v4",
      "joint-action-gpu-prep-qwen7b-coverage-aware-curriculum-v5",
      "joint-action-gpu-prep-qwen7b-answerability-gated-coverage-curriculum-v6",
      "joint-action-gpu-prep-qwen7b-soft-answerability-construction-curriculum-v7",
      "joint-action-gpu-prep-qwen7b-repair-regeneration-focused-curriculum-v8",
      "joint-action-gpu-prep-qwen7b-answer-completion-repair-curriculum-v10",
      "joint-action-gpu-prep-qwen7b-mixed-metric-repair-curriculum-v11",
      "joint-action-gpu-prep-qwen7b-support-targeted-planning-curriculum-v12",
      "joint-action-gpu-prep-qwen7b-qwen-coverage-gap-scaffold-curriculum-v13",
      "joint-action-gpu-prep-qwen7b-v13-support-delta-curriculum-v14",
      "joint-action-gpu-prep-qwen7b-nonfinal-frontier-candidates-v1",
      "joint-action-gpu-prep-qwen7b-nonfinal-frontier-pool-v2",
    ]);
    if (!allowedPacketRunIds.has(result.packet_run_id)) {
      errors.push(`${entry.name}: finalizer must target a registered Qwen joint-action packet.`);
    }
    for (const requiredArtifact of ["predictions_jsonl", "result_json", "report_md", "smoke_manifest_json"]) {
      if (!result.artifact_status?.required?.[requiredArtifact]?.path) {
        errors.push(`${entry.name}: finalizer must inspect required smoke artifact ${requiredArtifact}.`);
      }
    }
    if (Number(result.budget_gate?.max_budget_usd) !== 100) {
      errors.push(`${entry.name}: finalizer must preserve the $100 budget cap.`);
    }
    if (Number(result.budget_gate?.total_if_recorded_usd) > Number(result.budget_gate?.max_budget_usd) && !String(result.status).includes("refused_budget")) {
      errors.push(`${entry.name}: over-budget finalizer must refuse recording.`);
    }
    if (result.record_requested !== true && result.ledger?.action !== "not_recorded") {
      errors.push(`${entry.name}: dry finalizer must not record spend.`);
    }
    if (result.requested_completion_status === "completed" && result.record_requested === true && result.ledger?.action === "recorded") {
      const required = Object.values(result.artifact_status.required ?? {});
      if (!required.every((row) => row.exists === true)) errors.push(`${entry.name}: completed actual row requires complete smoke artifacts.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0) {
      errors.push(`${entry.name}: finalizer must not make OpenAI calls.`);
    }
    if (!report.includes("Artifact Gate") || !report.includes("Budget Gate")) {
      errors.push(`${entry.name}: finalizer report must expose artifact and budget gates.`);
    }
  }
}

async function validatePrimeQwen3bSmokeRunbookRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("prime-qwen3b-smoke-runbook-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Prime Qwen3B smoke runbook artifacts.`);
      continue;
    }
    if (result.artifact_type !== "prime_qwen3b_smoke_runbook") {
      errors.push(`${entry.name}: unexpected artifact_type.`);
    }
    if (result.status !== "ready_after_prime_auth_and_live_price") {
      errors.push(`${entry.name}: runbook must be ready after auth/live-price checks.`);
    }
    if (!result.bootstrap_script?.path || result.bootstrap_script.executable !== true || Number(result.bootstrap_script.bash_syntax_status) !== 0) {
      errors.push(`${entry.name}: bootstrap script must exist, be executable, and pass bash syntax.`);
    }
    const checks = result.checks ?? [];
    if (!Array.isArray(checks) || checks.length < 8 || !checks.every((row) => row.status === "pass")) {
      errors.push(`${entry.name}: all runbook checks must pass.`);
    }
    const stepIds = new Set((result.runbook_steps ?? []).map((row) => row.id));
    for (const id of ["verify_prime_auth", "query_live_gpu_price", "create_bounded_pod", "capture_pod_status", "verify_ssh_access", "run_remote_bootstrap", "fetch_prediction_artifacts", "record_actual_compute_cost", "terminate_pod"]) {
      if (!stepIds.has(id)) errors.push(`${entry.name}: missing runbook step ${id}.`);
    }
    if (Number(result.budget_context?.estimated_total_if_launched_usd) > Number(result.budget_context?.max_budget_usd)) {
      errors.push(`${entry.name}: runbook estimated launch total must stay under budget.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: runbook must be zero actual cost.`);
    }
    if (!report.includes("prime --plain whoami") || !report.includes("verify_ssh_access") || !report.includes("terminate_pod")) {
      errors.push(`${entry.name}: report must expose auth and termination steps.`);
    }
  }
}

async function validatePrimeGuardedSmokeEntrypointRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("prime-guarded-smoke-entrypoint-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Prime guarded smoke entrypoint artifacts.`);
      continue;
    }
    if (result.artifact_type !== "prime_guarded_smoke_entrypoint") {
      errors.push(`${entry.name}: unexpected artifact_type.`);
    }
    if (!["refuse_prime_pod_creation", "ready_to_create_prime_pod"].includes(result.status)) {
      errors.push(`${entry.name}: unexpected entrypoint status.`);
    }
    if (result.status === "refuse_prime_pod_creation" && result.launch_decision?.pod_creation_allowed !== false) {
      errors.push(`${entry.name}: refusal status must forbid pod creation.`);
    }
    if (result.status === "ready_to_create_prime_pod" && result.launch_decision?.pod_creation_allowed !== true) {
      errors.push(`${entry.name}: ready status must allow pod creation.`);
    }
    if (result.execute_requested !== false) {
      errors.push(`${entry.name}: committed entrypoint artifacts must be dry-run/refusal artifacts, not execute=true artifacts.`);
    }
    if (!result.inputs?.remote_gate_run_id || !result.inputs?.prime_gate_run_id || !result.inputs?.repair_signal_run_id) {
      errors.push(`${entry.name}: entrypoint must record source gate inputs.`);
    }
    const checks = result.checks ?? [];
    for (const id of ["execute_flag_not_set", "budget_under_cap_now", "projected_prime_path_under_cap", "remote_gate_prime_ready", "prime_auth_price_gate_ready", "prime_cli_authenticated_now", "runbook_ready", "repair_signal_present", "packet_is_qwen3b_joint_action"]) {
      if (!checks.some((row) => row.id === id)) errors.push(`${entry.name}: missing check ${id}.`);
    }
    if (Number(result.budget_gate?.max_budget_usd) !== 100 || Number(result.budget_gate?.actual_total_spend_usd) <= 0) {
      errors.push(`${entry.name}: entrypoint must preserve current $100 budget context.`);
    }
    if (Number(result.budget_gate?.projected_prime_total_after_smoke_and_judge_usd) >= 100) {
      errors.push(`${entry.name}: committed entrypoint must show Prime path under the budget cap.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: entrypoint artifact must be zero actual cost.`);
    }
    if (!report.includes("Prime Guarded Smoke Entrypoint") || !report.includes("Pod creation allowed") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must expose launch decision and zero-cost status.`);
    }
  }
}

async function validateHfGuardedSmokeEntrypointRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("hf-guarded-smoke-entrypoint-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed HF guarded smoke entrypoint artifacts.`);
      continue;
    }
    if (result.artifact_type !== "hf_guarded_smoke_entrypoint") {
      errors.push(`${entry.name}: unexpected artifact_type.`);
    }
    if (!["refuse_hf_job_creation", "ready_to_create_hf_job"].includes(result.status)) {
      errors.push(`${entry.name}: unexpected entrypoint status.`);
    }
    if (result.status === "refuse_hf_job_creation" && result.launch_decision?.hf_job_creation_allowed !== false) {
      errors.push(`${entry.name}: refusal status must forbid HF job creation.`);
    }
    if (result.status === "ready_to_create_hf_job" && result.launch_decision?.hf_job_creation_allowed !== true) {
      errors.push(`${entry.name}: ready status must allow HF job creation.`);
    }
    if (result.execute_requested !== false) {
      errors.push(`${entry.name}: committed HF entrypoint artifacts must be dry-run/refusal artifacts, not execute=true artifacts.`);
    }
    if (!result.inputs?.remote_gate_run_id || !result.inputs?.hf_launch_plan_run_id || !result.inputs?.hf_attempt_run_id || !result.inputs?.repair_signal_run_id) {
      errors.push(`${entry.name}: HF entrypoint must record source gate inputs.`);
    }
    const checks = result.checks ?? [];
    for (const id of ["execute_flag_not_set", "budget_under_cap_now", "projected_hf_path_under_cap", "remote_gate_hf_ready", "hf_cli_authenticated_now", "hf_jobs_cli_available", "hf_job_write_permission_proven", "hf_launch_plan_within_budget", "repair_signal_present", "packet_is_qwen3b_joint_action"]) {
      if (!checks.some((row) => row.id === id)) errors.push(`${entry.name}: missing check ${id}.`);
    }
    if (Number(result.budget_gate?.max_budget_usd) !== 100 || Number(result.budget_gate?.actual_total_spend_usd) <= 0) {
      errors.push(`${entry.name}: HF entrypoint must preserve current $100 budget context.`);
    }
    if (Number(result.budget_gate?.projected_hf_total_after_smoke_and_judge_usd) >= 100) {
      errors.push(`${entry.name}: committed HF entrypoint must show HF path under the budget cap.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: HF entrypoint artifact must be zero actual cost.`);
    }
    if (!report.includes("Hugging Face Guarded Smoke Entrypoint") || !report.includes("HF job creation allowed") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must expose launch decision and zero-cost status.`);
    }
  }
}

async function validateQwen3bResultIntegrationRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen3b-result-integration-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen3B result integration artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen3b_result_integration") {
      errors.push(`${entry.name}: unexpected artifact_type.`);
    }
    const allowedStatuses = new Set([
      "waiting_for_qwen3b_predictions",
      "waiting_for_qwen3b_paid_judge",
      "qwen3b_strong_positive_ready_for_pareto_update",
      "qwen3b_minimum_positive_ready_for_pareto_update",
      "qwen3b_negative_ready_for_pareto_update",
    ]);
    if (!allowedStatuses.has(result.status)) {
      errors.push(`${entry.name}: unexpected integration status.`);
    }
    if (!result.baseline_targets?.direct_baseline || !result.baseline_targets?.deployable_selector_baseline || !result.baseline_targets?.seventy_percent_frontier) {
      errors.push(`${entry.name}: missing direct, deployable selector, or 70% frontier targets.`);
    }
    if (!result.artifact_status?.prediction || !result.artifact_status?.judge) {
      errors.push(`${entry.name}: missing prediction/judge artifact status.`);
    }
    if (result.qwen_metrics) {
      for (const key of ["answer_rate", "answer_support_rate", "overall_judged_correct_rate"]) {
        const value = Number(result.qwen_metrics[key]);
        if (!Number.isFinite(value) || value < 0 || value > 1) errors.push(`${entry.name}: invalid qwen metric ${key}.`);
      }
      if (!result.target_comparison || !result.pareto_row_to_add) {
        errors.push(`${entry.name}: Qwen metrics require comparison and Pareto row.`);
      }
    } else if (result.status !== "waiting_for_qwen3b_predictions" && result.status !== "waiting_for_qwen3b_paid_judge") {
      errors.push(`${entry.name}: missing Qwen metrics for terminal integration status.`);
    }
    if (!Array.isArray(result.required_next_steps) || !result.required_next_steps.length) {
      errors.push(`${entry.name}: integration must include required next steps.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: integration must be zero actual cost.`);
    }
    if (!report.includes("Qwen 3B Result Integration") || !report.includes("Required Next Steps")) {
      errors.push(`${entry.name}: integration report must expose result and next steps.`);
    }
  }
}

async function validateQwen3bStructuralBinderRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen3b-structural-binder-")) continue;
    const runPath = path.join(runsDir, entry.name);
    const resultPath = path.join(runPath, "result.json");
    const predictionsPath = path.join(runPath, "predictions.jsonl");
    const rowsPath = path.join(runPath, "rows.jsonl");
    const reportPath = path.join(runPath, "report.md");
    let result;
    let predictions;
    let rows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
      rows = await readJsonl(rowsPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed structural binder artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen3b_structural_citation_support_binder") {
      errors.push(`${entry.name}: unexpected structural binder artifact type.`);
    }
    if (!result.prediction_run_id || !result.judge_run_id || !result.packet_run_id) {
      errors.push(`${entry.name}: structural binder must record prediction, judge, and packet ids.`);
    }
    if (predictions.length !== Number(result.binder_metrics?.examples) || rows.length !== Number(result.binder_metrics?.examples)) {
      errors.push(`${entry.name}: structural binder row counts must match metrics.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: structural binder must be zero actual cost.`);
    }
    if (Number(result.budget?.max_budget_usd) !== 100) {
      errors.push(`${entry.name}: structural binder must preserve the $100 budget cap.`);
    }
    if (!["binder_positive_needs_fresh_holdout", "binder_tradeoff_not_final", "binder_negative"].includes(result.conclusion?.status)) {
      errors.push(`${entry.name}: unexpected structural binder conclusion status.`);
    }
    if (Number(result.binder_metrics?.answer_rate) < 0 || Number(result.binder_metrics?.answer_rate) > 1) {
      errors.push(`${entry.name}: invalid structural binder answer rate.`);
    }
    if (!report.includes("Structural Citation/Support Binder") || !report.includes("Suppressions")) {
      errors.push(`${entry.name}: structural binder report must expose title and suppressions.`);
    }
  }
}

async function validateQwen3bIntegrationFixtureAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen3b-integration-fixture-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen3B integration fixture audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen3b_result_integration_fixture_audit") {
      errors.push(`${entry.name}: unexpected fixture audit artifact type.`);
    }
    if (result.status !== "integration_status_logic_verified") {
      errors.push(`${entry.name}: fixture audit must verify integration status logic.`);
    }
    const expectedStatuses = new Set([
      "qwen3b_negative_ready_for_pareto_update",
      "qwen3b_minimum_positive_ready_for_pareto_update",
      "qwen3b_strong_positive_ready_for_pareto_update",
    ]);
    if (!Array.isArray(result.cases) || result.cases.length !== 3) {
      errors.push(`${entry.name}: fixture audit must include exactly three classification cases.`);
    }
    for (const status of expectedStatuses) {
      if (!result.cases?.some((row) => row.expected_status === status && row.observed_status === status && row.passed === true)) {
        errors.push(`${entry.name}: missing passing fixture case for ${status}.`);
      }
    }
    if (result.cleanup?.temporary_fixture_runs_removed !== true) {
      errors.push(`${entry.name}: fixture audit must remove temporary run directories.`);
    }
    if (!report.includes("Qwen 3B Result Integration Fixture Audit") || !report.includes("strong_positive")) {
      errors.push(`${entry.name}: fixture audit report must expose cases.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: fixture audit must be zero cost.`);
    }
  }
}

async function validateQwen3bPredictionIntegrityGateRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen3b-prediction-integrity-gate-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen3B prediction integrity gate artifacts.`);
      continue;
    }
    if (result.gate_type !== "qwen3b_prediction_integrity_prejudge_gate") {
      errors.push(`${entry.name}: unexpected Qwen3B prediction integrity gate type.`);
    }
    const allowedPredictionRuns = new Set([
      "joint-action-qwen3b-smoke-eval-v1",
      "joint-action-qwen3b-smoke-eval-v1-citation-repair",
      "joint-action-qwen3b-v3-smoke-eval-v1",
      "joint-action-qwen3b-v3-smoke-eval-v1-citation-repair",
      "joint-action-qwen3b-v4-smoke-eval-v1",
      "joint-action-qwen3b-v4-smoke-eval-v1-citation-repair",
    ]);
    if (!allowedPredictionRuns.has(result.prediction_run_id)) {
      errors.push(`${entry.name}: integrity gate must target the Qwen3B smoke eval run or its citation-repair derivative.`);
    }
    if (Number(result.checks?.expected_eval_examples) !== 69) {
      errors.push(`${entry.name}: integrity gate should expect the 69-example final window.`);
    }
    if (!result.artifacts?.predictions_jsonl || !result.artifacts?.smoke_manifest_json) {
      errors.push(`${entry.name}: integrity gate must record prediction and smoke manifest artifact paths.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: integrity gate must be zero actual cost.`);
    }
    const status = result.conclusion?.status;
    if (!["waiting_for_qwen3b_predictions", "refuse_paid_judge_prediction_integrity_failed", "ready_for_paid_judge"].includes(status)) {
      errors.push(`${entry.name}: unexpected integrity gate status.`);
    }
    if (status === "ready_for_paid_judge" && Number(result.checks?.failures?.length ?? 0) !== 0) {
      errors.push(`${entry.name}: ready integrity gate cannot have failures.`);
    }
    if (status === "waiting_for_qwen3b_predictions" && result.checks?.prediction_artifact_exists !== false) {
      errors.push(`${entry.name}: waiting integrity gate must record missing prediction artifact.`);
    }
  }
}

async function validateQwen3bRemoteProvenanceGateRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen3b-remote-provenance-gate-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen3B remote provenance gate artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen3b_remote_provenance_gate") {
      errors.push(`${entry.name}: unexpected Qwen3B remote provenance gate type.`);
    }
    const allowedPredictionRuns = new Set([
      "joint-action-qwen3b-smoke-eval-v1",
      "joint-action-qwen3b-v3-smoke-eval-v1",
      "joint-action-qwen3b-v4-smoke-eval-v1",
    ]);
    if (!allowedPredictionRuns.has(result.prediction_run_id)) {
      errors.push(`${entry.name}: remote provenance gate must target a registered Qwen3B smoke eval run.`);
    }
    if (!["waiting_for_smoke_artifacts", "provenance_artifacts_missing", "remote_provenance_failed", "remote_provenance_ready_for_judge"].includes(result.status)) {
      errors.push(`${entry.name}: unexpected remote provenance gate status.`);
    }
    for (const key of ["predictions_jsonl", "result_json", "report_md", "smoke_manifest_json", "prime_pod_status_json", "remote_environment_txt", "remote_smoke_bootstrap_manifest_json"]) {
      if (!result.files?.[key]) errors.push(`${entry.name}: remote provenance gate must record ${key}.`);
    }
    if (result.status === "waiting_for_smoke_artifacts" && result.checks?.core_artifacts_complete !== false) {
      errors.push(`${entry.name}: waiting remote provenance gate must record incomplete core artifacts.`);
    }
    const required = result.required_remote_provenance ?? [];
    if (!required.some((item) => String(item).includes("prime_pod_status.json")) || !required.some((item) => String(item).includes("remote_environment.txt"))) {
      errors.push(`${entry.name}: remote provenance gate must require pod status and remote environment artifacts.`);
    }
    if (!report.includes("Qwen 3B Remote Provenance Gate") || !report.includes("Required Remote Provenance")) {
      errors.push(`${entry.name}: remote provenance report must expose title and required provenance.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: remote provenance gate must be zero actual cost.`);
    }
  }
}

async function validateQwen3bPostSmokePipelineRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen3b-post-smoke-judge-pipeline-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen3B post-smoke pipeline artifacts.`);
      continue;
    }
    if (result.pipeline_type !== "qwen3b_post_smoke_integrity_dry_paid_judge_pipeline") {
      errors.push(`${entry.name}: unexpected Qwen3B post-smoke pipeline type.`);
    }
    if (result.prediction_run_id !== "joint-action-qwen3b-smoke-eval-v1") {
      errors.push(`${entry.name}: post-smoke pipeline must target the Qwen3B smoke eval run.`);
    }
    if (result.split !== "extended_temporal_future_holdout") {
      errors.push(`${entry.name}: post-smoke pipeline must judge the extended temporal future holdout.`);
    }
    if (!String(result.commands?.integrity_gate ?? "").includes("grounded-qa-distillation-qwen3b-prediction-integrity-gate.mjs")) {
      errors.push(`${entry.name}: post-smoke pipeline must run the integrity gate.`);
    }
    if (!String(result.commands?.provenance_gate ?? "").includes("grounded-qa-distillation-qwen3b-remote-provenance-gate.mjs")) {
      errors.push(`${entry.name}: post-smoke pipeline must run the remote provenance gate before judging.`);
    }
    if (result.provenance_run_id !== "qwen3b-remote-provenance-gate-joint-action-qwen3b-smoke-eval-v1") {
      errors.push(`${entry.name}: post-smoke pipeline must target the canonical remote provenance gate.`);
    }
    if (!String(result.commands?.dry_judge ?? "").includes("--dry-run=true")) {
      errors.push(`${entry.name}: post-smoke pipeline must include a dry judge command.`);
    }
    if (!String(result.commands?.paid_judge ?? "").includes("--max-budget-usd=100")) {
      errors.push(`${entry.name}: post-smoke pipeline paid judge command must preserve the $100 budget cap.`);
    }
    if (!Array.isArray(result.steps) || !result.steps.some((step) => step.id === "integrity_gate" && step.status === "passed")) {
      errors.push(`${entry.name}: post-smoke pipeline must record a passed integrity gate step in default waiting mode.`);
    }
    if (Number(result.budget_context?.actual_total_spend_usd) > Number(result.budget_context?.max_budget_usd)) {
      errors.push(`${entry.name}: post-smoke pipeline budget context exceeds cap.`);
    }
    const status = result.conclusion?.status;
    if (!["waiting_for_qwen3b_predictions", "provenance_artifacts_missing", "remote_provenance_failed", "ready_for_explicit_paid_judge", "paid_judge_complete", "paid_judge_no_calls_made", "failed_integrity_not_ready", "failed_remote_provenance_not_ready", "failed_dry_judge_guard", "failed_missing_openai_key"].includes(status)) {
      errors.push(`${entry.name}: unexpected post-smoke pipeline status.`);
    }
    if (result.run_paid_requested !== true && (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0)) {
      errors.push(`${entry.name}: default post-smoke pipeline mode must be zero actual cost.`);
    }
  }
}

async function validateManuscriptEvidenceMapRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("manuscript-evidence-map-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed manuscript evidence map artifacts.`);
      continue;
    }
    if (result.artifact_type !== "manuscript_evidence_map") {
      errors.push(`${entry.name}: unexpected manuscript evidence map type.`);
    }
    if (result.readiness?.status !== "not_paper_ready") {
      errors.push(`${entry.name}: manuscript evidence map must not mark the paper ready before the readiness gate passes.`);
    }
    const readinessBlockers = new Set(result.readiness?.blockers ?? []);
    if (!readinessBlockers.has("qwen3b_joint_action_smoke_result")) {
      errors.push(`${entry.name}: manuscript evidence map must preserve the Qwen3B result blocker until acceptance passes.`);
    }
    if (!Array.isArray(result.allowed_claims_now) || result.allowed_claims_now.length < 3) {
      errors.push(`${entry.name}: manuscript evidence map must include allowed claims.`);
    }
    if (!Array.isArray(result.claims_to_avoid_until_qwen3b) || result.claims_to_avoid_until_qwen3b.length < 4) {
      errors.push(`${entry.name}: manuscript evidence map must include claims to avoid until Qwen3B.`);
    }
    const qwenStatusText = JSON.stringify(result.qwen3b_required_final_result ?? {}).toLowerCase();
    if (!qwenStatusText.includes("failed_integrity_not_ready") && !qwenStatusText.includes("qwen3b_negative_ready_for_pareto_update") && !qwenStatusText.includes("waiting_for_qwen3b_predictions")) {
      errors.push(`${entry.name}: manuscript evidence map should record the current Qwen3B pipeline or negative-result status.`);
    }
    if (Number(result.qwen3b_required_final_result?.estimated_total_after_smoke_and_judge_usd) > Number(result.budget?.max_budget_usd)) {
      errors.push(`${entry.name}: Qwen3B planned smoke plus judge must remain under budget.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: manuscript evidence map must be zero actual cost.`);
    }
    if (entry.name.includes("2026-06-27-v2")) {
      const evidenceText = JSON.stringify(result).toLowerCase();
      if (!evidenceText.includes("novelty-watchlist-2026-06-27-v2") || !evidenceText.includes("citation-faithfulness-neighbor-comparison-2026-06-27-v1")) {
        errors.push(`${entry.name}: latest manuscript evidence map must include the latest novelty watchlist and citation-faithfulness comparison.`);
      }
    }
  }
}

async function validateManuscriptDraftRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("manuscript-draft-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const manuscriptPath = path.join(runsDir, entry.name, "manuscript.md");
    let result;
    let manuscript;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
      manuscript = await fs.readFile(manuscriptPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed manuscript draft artifacts.`);
      continue;
    }
    if (result.artifact_type !== "manuscript_draft") {
      errors.push(`${entry.name}: unexpected manuscript draft type.`);
    }
    if (result.paper_ready !== false || result.readiness_summary?.current_status !== "not_paper_ready") {
      errors.push(`${entry.name}: manuscript draft must remain not submission-ready until readiness passes.`);
    }
    if (!Array.isArray(result.submission_blockers) || !result.submission_blockers.includes("qwen3b_joint_action_smoke_result")) {
      errors.push(`${entry.name}: manuscript draft must preserve the Qwen3B submission blocker until acceptance passes.`);
    }
    if (!Array.isArray(result.sections) || result.sections.length < 6) {
      errors.push(`${entry.name}: manuscript draft must include core paper sections.`);
    }
    if (!Array.isArray(result.tables) || !result.tables.some((table) => table.id === "qwen3b_todo" && table.status === "blocked")) {
      errors.push(`${entry.name}: manuscript draft must include a blocked Qwen3B result table.`);
    }
    if (!manuscript.includes("not submission-ready") || !manuscript.includes("Claims To Avoid Until Qwen 3B Completes")) {
      errors.push(`${entry.name}: manuscript markdown must visibly warn against premature submission/claims.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: manuscript draft must be zero actual cost.`);
    }
  }
}

async function validateReviewerRiskAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("reviewer-risk-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed reviewer-risk audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "reviewer_risk_audit") {
      errors.push(`${entry.name}: unexpected reviewer-risk audit type.`);
    }
    if (result.status !== "not_submission_ready") {
      errors.push(`${entry.name}: reviewer-risk audit must not mark the paper submission-ready while readiness blockers remain.`);
    }
    if (result.readiness_context?.status !== "not_paper_ready") {
      errors.push(`${entry.name}: reviewer-risk audit must preserve not-paper-ready status.`);
    }
    const blockers = new Set(result.readiness_context?.blockers ?? []);
    if (!blockers.has("qwen3b_joint_action_smoke_result")) {
      errors.push(`${entry.name}: reviewer-risk audit must preserve the Qwen3B blocker until acceptance passes.`);
    }
    if (!Array.isArray(result.risks) || result.risks.length < 6) {
      errors.push(`${entry.name}: reviewer-risk audit must include at least six risks.`);
    }
    const critical = new Set(result.critical_blockers ?? []);
    if (!critical.has("R1_missing_trained_qwen3b_result") || !critical.has("R2_missing_grounded_correctness_judge_for_student")) {
      errors.push(`${entry.name}: reviewer-risk audit must include the two critical Qwen3B blockers.`);
    }
    if (!Array.isArray(result.acceptance_path) || result.acceptance_path.length < 5) {
      errors.push(`${entry.name}: reviewer-risk audit must include an acceptance path.`);
    }
    if (!report.includes("Critical Blockers") || !report.includes("Acceptance Path")) {
      errors.push(`${entry.name}: reviewer-risk audit report must expose blockers and acceptance path.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: reviewer-risk audit must be zero actual cost.`);
    }
  }
}

async function validateJudgeCalibrationAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("judge-calibration-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const queuePath = path.join(runsDir, entry.name, "audit_queue.jsonl");
    let result;
    let queue;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      queue = await readJsonl(queuePath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed judge calibration audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "judge_calibration_audit") {
      errors.push(`${entry.name}: unexpected judge calibration audit type.`);
    }
    if (result.status !== "audit_packet_ready") {
      errors.push(`${entry.name}: judge calibration audit must be ready for audit.`);
    }
    if (!Array.isArray(result.source_runs) || result.source_runs.length < 5) {
      errors.push(`${entry.name}: judge calibration audit must include source judge runs.`);
    }
    if (Number(result.summary?.judgments_loaded) < 300 || Number(result.summary?.unique_examples) < 100) {
      errors.push(`${entry.name}: judge calibration audit must cover the transfer-window judge corpus.`);
    }
    if (Number(result.summary?.unsupported_answer_rows) <= 0 || Number(result.summary?.cross_policy_disagreement_examples) <= 0) {
      errors.push(`${entry.name}: judge calibration audit must include hard cases and disagreements.`);
    }
    if (!Array.isArray(result.audit_queue) || result.audit_queue.length < 12 || queue.length !== result.audit_queue.length) {
      errors.push(`${entry.name}: judge calibration audit queue must be materialized and non-trivial.`);
    }
    const auditTypes = new Set(queue.map((row) => row.audit_type));
    for (const type of ["unsupported_answer", "correct_abstention_sanity_check", "cross_policy_disagreement"]) {
      if (!auditTypes.has(type)) errors.push(`${entry.name}: audit queue missing ${type}.`);
    }
    if (!Array.isArray(result.calibration_limits) || result.calibration_limits.length < 3) {
      errors.push(`${entry.name}: judge calibration audit must record calibration limits.`);
    }
    if (!report.includes("Recommended Paper Treatment") || !report.includes("Calibration Limits")) {
      errors.push(`${entry.name}: judge calibration audit report must expose limits and paper treatment.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: judge calibration audit must be zero actual cost.`);
    }
  }
}

async function validateJudgeAdjudicationPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("judge-adjudication-packet-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const packetPath = path.join(runsDir, entry.name, "adjudication_packet.jsonl");
    let result;
    let packet;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      packet = await readJsonl(packetPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed judge adjudication packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "judge_adjudication_packet") {
      errors.push(`${entry.name}: unexpected judge adjudication packet type.`);
    }
    if (result.status !== "packet_ready") {
      errors.push(`${entry.name}: judge adjudication packet must have complete joins.`);
    }
    if (Number(result.adjudication_rows) < 20 || packet.length !== Number(result.adjudication_rows)) {
      errors.push(`${entry.name}: judge adjudication packet must materialize the calibration queue.`);
    }
    if (Array.isArray(result.join_warnings) && result.join_warnings.length) {
      errors.push(`${entry.name}: judge adjudication packet has join warnings.`);
    }
    const auditTypes = new Set(packet.map((row) => row.audit_type));
    for (const type of ["unsupported_answer", "correct_abstention_sanity_check", "cross_policy_disagreement"]) {
      if (!auditTypes.has(type)) errors.push(`${entry.name}: adjudication packet missing ${type}.`);
    }
    for (const row of packet) {
      if (!row.packet_id || !row.example_id || !row.question) errors.push(`${entry.name}: malformed adjudication row identity.`);
      if (!Array.isArray(row.compact_retrieved_evidence_pack) || !row.compact_retrieved_evidence_pack.length) {
        errors.push(`${entry.name}: ${row.example_id} missing evidence pack.`);
      }
      if (!row.reference_output?.answer_type) errors.push(`${entry.name}: ${row.example_id} missing reference output.`);
      if (!Array.isArray(row.cases) || !row.cases.length) errors.push(`${entry.name}: ${row.example_id} missing policy cases.`);
      for (const item of row.cases ?? []) {
        if (!item.policy || !item.source_judge_run_id || !item.source_prediction_run_id) {
          errors.push(`${entry.name}: ${row.example_id} has malformed case source.`);
        }
        if (!item.prediction?.answer_type || !item.judge_verdict?.verdict) {
          errors.push(`${entry.name}: ${row.example_id} case missing prediction or judge verdict.`);
        }
      }
      if (!row.adjudication_form || !Object.hasOwn(row.adjudication_form, "human_verdict")) {
        errors.push(`${entry.name}: ${row.example_id} missing adjudication form.`);
      }
    }
    if (!report.includes("Adjudication Instructions") || !report.includes("No join warnings")) {
      errors.push(`${entry.name}: judge adjudication packet report must expose instructions and clean joins.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: judge adjudication packet must be zero actual cost.`);
    }
  }
}

async function validateJudgeReliabilitySecondPassPlanRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("judge-reliability-second-pass-plan-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const requestsPath = path.join(runsDir, entry.name, "second_pass_requests.jsonl");
    const estimatesPath = path.join(runsDir, entry.name, "cost_estimate.jsonl");
    let result;
    let report;
    let requests;
    let estimates;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
      requests = await readJsonl(requestsPath);
      estimates = await readJsonl(estimatesPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed judge reliability second-pass artifacts.`);
      continue;
    }
    if (result.artifact_type !== "judge_reliability_second_pass_plan") {
      errors.push(`${entry.name}: unexpected judge reliability second-pass artifact type.`);
    }
    if (result.status !== "second_pass_requests_ready_not_run") {
      errors.push(`${entry.name}: second-pass plan must not claim completed judging.`);
    }
    if (result.blind_protocol?.hides_original_judge_verdict !== true) {
      errors.push(`${entry.name}: second-pass plan must hide original judge verdicts.`);
    }
    if (Number(result.request_rows) < 20 || requests.length !== Number(result.request_rows) || estimates.length !== requests.length) {
      errors.push(`${entry.name}: second-pass plan must materialize request and estimate rows.`);
    }
    if (Number(result.planned_second_pass_judge?.estimated_calls) < Number(result.request_rows)) {
      errors.push(`${entry.name}: second-pass plan must estimate at least one call per request row.`);
    }
    if (Number(result.budget_gate?.estimated_second_pass_cost_usd) <= 0 || result.budget_gate?.within_budget !== true) {
      errors.push(`${entry.name}: second-pass plan must include a positive under-budget cost estimate.`);
    }
    const auditTypes = new Set(requests.map((row) => row.audit_type));
    for (const type of ["unsupported_answer", "questionable_abstention", "correct_abstention_sanity_check", "cross_policy_disagreement"]) {
      if (!auditTypes.has(type)) errors.push(`${entry.name}: second-pass requests missing ${type}.`);
    }
    for (const row of requests) {
      if (!row.packet_id || !row.example_id || !row.question) errors.push(`${entry.name}: malformed second-pass row identity.`);
      if (!Array.isArray(row.compact_retrieved_evidence_pack) || !row.compact_retrieved_evidence_pack.length) {
        errors.push(`${entry.name}: ${row.packet_id} missing evidence pack.`);
      }
      if (!Array.isArray(row.cases) || !row.cases.length) errors.push(`${entry.name}: ${row.packet_id} missing cases.`);
      for (const item of row.cases ?? []) {
        if (item.original_judge_verdict_hidden !== true || Object.hasOwn(item, "judge_verdict")) {
          errors.push(`${entry.name}: ${row.packet_id} leaked original judge verdict.`);
        }
        if (!item.case_id || !item.policy || !item.prediction?.answer_type) {
          errors.push(`${entry.name}: ${row.packet_id} malformed second-pass case.`);
        }
      }
    }
    if (!report.includes("Blind Protocol") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: second-pass report must expose blind protocol and zero-cost status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: second-pass plan must be zero actual cost.`);
    }
  }
}

async function validateJudgeReliabilitySecondPassRunRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("judge-reliability-second-pass-run-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "agreement_report.md");
    const rowsPath = path.join(runsDir, entry.name, "second_pass_results.jsonl");
    let result;
    let report;
    let rows;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
      rows = await readJsonl(rowsPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed judge reliability second-pass run artifacts.`);
      continue;
    }
    if (result.artifact_type !== "judge_reliability_second_pass_run") {
      errors.push(`${entry.name}: unexpected judge reliability second-pass run artifact type.`);
    }
    if (!["second_pass_complete", "dry_run_or_key_missing"].includes(result.status)) {
      errors.push(`${entry.name}: unexpected judge reliability second-pass run status.`);
    }
    if (rows.length !== Number(result.calls_made) + Number(result.calls_skipped)) {
      errors.push(`${entry.name}: second-pass result row count does not match calls.`);
    }
    if (result.status === "second_pass_complete") {
      if (Number(result.calls_made) <= 0 || Number(result.run_cost_usd) <= 0) {
        errors.push(`${entry.name}: completed second-pass run must have positive calls and cost.`);
      }
      if (Number(result.ledger_spend_after_usd) <= Number(result.ledger_spend_before_usd)) {
        errors.push(`${entry.name}: completed second-pass run must increase OpenAI ledger spend.`);
      }
      if (Number(result.agreement?.compared_cases) !== Number(result.calls_made)) {
        errors.push(`${entry.name}: completed second-pass run must compare every judged case.`);
      }
      if (!Number.isFinite(Number(result.agreement?.exact_agreement_rate))) {
        errors.push(`${entry.name}: completed second-pass run must report exact agreement.`);
      }
    }
    if (Object.hasOwn(result, "schema_violations") && !Number.isFinite(Number(result.schema_violations))) {
      errors.push(`${entry.name}: schema violation count must be numeric when present.`);
    }
    for (const row of rows) {
      if (!row.packet_id || !row.case_id || !row.audit_type || !row.policy) {
        errors.push(`${entry.name}: malformed second-pass result row.`);
      }
      if (!row.skipped && (!row.judgment?.verdict || !row.usage || Number(row.cost_usd) <= 0)) {
        errors.push(`${entry.name}: completed second-pass row missing judgment, usage, or cost.`);
      }
    }
    if (!report.includes("Agreement") || !report.includes("Calls made")) {
      errors.push(`${entry.name}: second-pass agreement report must expose calls and agreement.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== Number(result.calls_made)) {
      errors.push(`${entry.name}: second-pass llm budget must record actual calls.`);
    }
    if (Number(result.llm_budget?.openai_cost_usd) !== Number(result.run_cost_usd)) {
      errors.push(`${entry.name}: second-pass llm budget must match run cost.`);
    }
  }
}

async function validateJudgeDisagreementTaxonomyRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("judge-disagreement-taxonomy-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const disagreementsPath = path.join(runsDir, entry.name, "disagreements.jsonl");
    let result;
    let report;
    let disagreements;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
      disagreements = await readJsonl(disagreementsPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed judge disagreement taxonomy artifacts.`);
      continue;
    }
    if (result.artifact_type !== "judge_disagreement_taxonomy") {
      errors.push(`${entry.name}: unexpected judge disagreement taxonomy artifact type.`);
    }
    if (result.status !== "judge_disagreement_taxonomy_complete") {
      errors.push(`${entry.name}: taxonomy should complete.`);
    }
    if (Number(result.source_summary?.compared_cases) < 20 || Number(result.source_summary?.disagreements) < 1) {
      errors.push(`${entry.name}: taxonomy must summarize a non-trivial second-pass comparison.`);
    }
    if (disagreements.length !== Number(result.source_summary?.disagreements)) {
      errors.push(`${entry.name}: disagreement rows must match source summary.`);
    }
    for (const category of ["abstention_boundary_reversal", "unsupported_to_supported_reversal", "partial_vs_supported_granularity"]) {
      if (!result.taxonomy?.[category]) errors.push(`${entry.name}: taxonomy missing ${category}.`);
    }
    if (result.claim_boundary?.supports_human_validated_correctness_claim !== false || result.claim_boundary?.supports_abstention_boundary_solved_claim !== false) {
      errors.push(`${entry.name}: taxonomy must not claim human validation or solved abstention boundaries.`);
    }
    if (!Array.isArray(result.manuscript_constraints) || !result.manuscript_constraints.some((item) => String(item).includes("model-judged"))) {
      errors.push(`${entry.name}: taxonomy must constrain model-judged manuscript language.`);
    }
    for (const row of disagreements) {
      if (!row.case_id || !row.category || !row.original_verdict || !row.second_pass_verdict) {
        errors.push(`${entry.name}: malformed disagreement row.`);
        break;
      }
    }
    if (!report.includes("Judge Disagreement Taxonomy") || !report.includes("Manuscript treatment")) {
      errors.push(`${entry.name}: taxonomy report must expose title and manuscript treatment.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: taxonomy must be zero new cost.`);
    }
  }
}

async function validateAbstentionBoundaryReliabilityAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("abstention-boundary-reliability-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed abstention-boundary reliability audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "abstention_boundary_reliability_audit") {
      errors.push(`${entry.name}: unexpected abstention-boundary reliability audit type.`);
    }
    if (result.status !== "abstention_boundary_unstable") {
      errors.push(`${entry.name}: abstention-boundary audit must not claim calibration is solved.`);
    }
    if (!Array.isArray(result.unstable_buckets) || !result.unstable_buckets.includes("questionable_abstention")) {
      errors.push(`${entry.name}: abstention-boundary audit must flag questionable abstentions as unstable.`);
    }
    const questionable = result.by_audit_type?.questionable_abstention;
    if (!questionable || Number(questionable.examples) < 1 || Number(questionable.exact_agreement_rate) >= 0.5) {
      errors.push(`${entry.name}: questionable-abstention bucket must show low agreement.`);
    }
    if (!Array.isArray(result.manuscript_constraints) || !result.manuscript_constraints.some((item) => String(item).includes("Do not claim abstention-boundary calibration is solved"))) {
      errors.push(`${entry.name}: abstention-boundary audit must constrain manuscript claims.`);
    }
    if (!report.includes("Manuscript Constraints") || !report.includes("questionable_abstention")) {
      errors.push(`${entry.name}: abstention-boundary report must expose constraints and unstable bucket.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: abstention-boundary audit must be zero new cost.`);
    }
  }
}

async function validateJudgeReliabilityClaimGateRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("judge-reliability-claim-gate-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const priorityPath = path.join(runsDir, entry.name, "priority_adjudication.jsonl");
    let result;
    let report;
    let priorityRows;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
      priorityRows = await readJsonl(priorityPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed judge reliability claim gate artifacts.`);
      continue;
    }
    if (result.artifact_type !== "judge_reliability_claim_gate") {
      errors.push(`${entry.name}: unexpected judge reliability claim gate type.`);
    }
    if (result.status !== "judge_reliability_requires_final_adjudication") {
      errors.push(`${entry.name}: gate must require final adjudication.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: judge reliability claim gate must be zero new cost.`);
    }
    if (result.claim_permissions?.human_validated_correctness_claim_allowed !== false || result.claim_permissions?.abstention_boundary_solved_claim_allowed !== false) {
      errors.push(`${entry.name}: gate must not allow human-validated or solved-abstention claims.`);
    }
    if (result.claim_permissions?.model_judged_screening_metrics_allowed !== true) {
      errors.push(`${entry.name}: gate should preserve caveated model-judged screening metrics.`);
    }
    if (Number(result.summary?.exact_agreement_rate) >= Number(result.acceptance_thresholds?.minimum_overall_exact_agreement_rate_for_uncaveated_model_judge_claim)) {
      errors.push(`${entry.name}: current evidence should remain below uncaveated model-judge threshold.`);
    }
    if (Number(result.summary?.p0_abstention_boundary_rows) < 1 || Number(result.priority_adjudication?.rows_total) !== priorityRows.length) {
      errors.push(`${entry.name}: priority adjudication rows must include P0 abstention-boundary rows and match JSONL.`);
    }
    if (!priorityRows.some((row) => row.priority === "P0" && row.reason === "abstention_boundary_instability_blocks_calibration_claims")) {
      errors.push(`${entry.name}: priority JSONL must contain P0 abstention-boundary rows.`);
    }
    if (!Array.isArray(result.not_stable_enough_for_current_reporting) || !result.not_stable_enough_for_current_reporting.some((row) => row.metric_family === "abstention_boundary_calibration")) {
      errors.push(`${entry.name}: gate must mark abstention-boundary calibration unstable.`);
    }
    const constraints = (result.manuscript_constraints ?? []).join(" ").toLowerCase();
    if (!constraints.includes("model-judged") || !constraints.includes("human-validated")) {
      errors.push(`${entry.name}: gate must constrain model-judged and human-validated language.`);
    }
    if (!report.includes("Judge Reliability Claim Gate") || !report.includes("Required Before Submission Claim")) {
      errors.push(`${entry.name}: report must expose gate title and required submission evidence.`);
    }
  }
}

async function validateFinalEvidenceChecklistRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("final-evidence-checklist-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed final evidence checklist artifacts.`);
      continue;
    }
    if (result.artifact_type !== "final_evidence_checklist") {
      errors.push(`${entry.name}: unexpected final evidence checklist type.`);
    }
    if (!["final_evidence_missing", "all_final_evidence_present"].includes(result.status)) {
      errors.push(`${entry.name}: unexpected final evidence checklist status.`);
    }
    if (!Array.isArray(result.acceptance_criteria) || result.acceptance_criteria.length < 8) {
      errors.push(`${entry.name}: final evidence checklist must include the full acceptance path.`);
    }
    for (const id of ["packet_quality_ready", "script_contract_ready", "distillation_loss_accounting_ready", "qwen_outcome_policy_preregistered", "post_smoke_provenance_guard_ready", "qwen_pareto_update_contract_ready", "citation_faithfulness_positioning_ready", "novelty_delta_matrix_ready", "judge_reliability_claim_gate_ready", "remote_backend_ready", "smoke_artifacts_complete", "integrity_gate_ready", "dry_judge_full_coverage", "paid_judge_complete", "qwen3b_on_pareto_table"]) {
      if (!result.acceptance_criteria.some((row) => row.id === id)) errors.push(`${entry.name}: missing acceptance criterion ${id}.`);
    }
    if (result.status === "final_evidence_missing" && !result.acceptance_criteria.some((row) => row.status === "fail")) {
      errors.push(`${entry.name}: missing-evidence status must include failing criteria.`);
    }
    if (Number(result.current_budget_context?.current_actual_spend_usd) <= 0 || result.current_budget_context?.within_budget !== true) {
      errors.push(`${entry.name}: final evidence checklist must recompute an under-budget current spend.`);
    }
    if (!Array.isArray(result.execution_sequence) || result.execution_sequence.length < 4) {
      errors.push(`${entry.name}: final evidence checklist must include executable sequence.`);
    }
    if (!Array.isArray(result.paper_claim_constraints) || !result.paper_claim_constraints.some((item) => String(item).includes("do not claim a trained smaller model"))) {
      errors.push(`${entry.name}: final evidence checklist must constrain trained-model claims.`);
    }
    if (!report.includes("Acceptance Criteria") || !report.includes("Paper Claim Constraints")) {
      errors.push(`${entry.name}: final evidence checklist report must expose acceptance criteria and claim constraints.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: final evidence checklist must be zero cost.`);
    }
  }
}

async function validateCostCoverageParetoRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("cost-coverage-support-pareto-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed cost/coverage Pareto artifacts.`);
      continue;
    }
    if (result.artifact_type !== "cost_coverage_support_pareto") {
      errors.push(`${entry.name}: unexpected cost/coverage Pareto type.`);
    }
    if (!["tradeoff_mapped_not_final_result", "tradeoff_mapped_with_qwen3b_negative_result", "tradeoff_mapped_with_qwen3b_results"].includes(result.status)) {
      errors.push(`${entry.name}: cost/coverage Pareto has unexpected status.`);
    }
    if (!Array.isArray(result.systems) || result.systems.length < 5) {
      errors.push(`${entry.name}: cost/coverage Pareto must include current baseline/scaffold systems.`);
    }
    const ids = new Set((result.systems ?? []).map((row) => row.id));
    for (const id of ["direct_mini_repair", "balanced_risk_gate", "cross_window_candidate_selector", "claim_entailment_guard", "mini_verifier_combined_gate"]) {
      if (!ids.has(id)) errors.push(`${entry.name}: missing system ${id}.`);
    }
    for (const row of result.systems ?? []) {
      if (!Number.isFinite(Number(row.examples)) || Number(row.examples) <= 0) errors.push(`${entry.name}: ${row.id} missing examples.`);
      if (!Number.isFinite(Number(row.answer_rate))) errors.push(`${entry.name}: ${row.id} missing answer_rate.`);
      if (!Number.isFinite(Number(row.online_openai_calls_per_query))) errors.push(`${entry.name}: ${row.id} missing online call estimate.`);
      if (row.overall_judged_correct_rate != null && !Number.isFinite(Number(row.overall_judged_correct_rate))) {
        errors.push(`${entry.name}: ${row.id} invalid judged correctness.`);
      }
      if (row.answer_support_rate != null && !Number.isFinite(Number(row.answer_support_rate))) {
        errors.push(`${entry.name}: ${row.id} invalid answer support.`);
      }
    }
    if (!Array.isArray(result.pareto_frontier) || !result.pareto_frontier.length) {
      errors.push(`${entry.name}: cost/coverage Pareto must include a non-empty frontier.`);
    }
    if (!Array.isArray(result.required_next_evidence) || !result.required_next_evidence.some((item) => String(item).includes("Qwen"))) {
      errors.push(`${entry.name}: cost/coverage Pareto must describe the remaining Qwen evidence/failure-audit requirement.`);
    }
    if (!report.includes("Answer rate") || !report.includes("Pareto Frontier")) {
      errors.push(`${entry.name}: cost/coverage Pareto report must expose table and frontier.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: cost/coverage Pareto must be zero actual cost.`);
    }
  }
}

async function validateAmortizationBreakEvenRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("amortization-break-even-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed amortization break-even artifacts.`);
      continue;
    }
    if (result.artifact_type !== "amortization_break_even") {
      errors.push(`${entry.name}: unexpected amortization artifact type.`);
    }
    if (result.status !== "amortization_accounting_ready_not_quality_evidence") {
      errors.push(`${entry.name}: amortization artifact must not claim quality evidence.`);
    }
    if (result.qwen3b_plan?.within_100_usd_budget !== true || Number(result.qwen3b_plan?.estimated_total_after_qwen_smoke_and_judge_usd) > 100) {
      errors.push(`${entry.name}: Qwen amortization plan must stay under the $100 budget.`);
    }
    if (Number(result.qwen3b_plan?.planned_offline_investment_usd) <= 0) {
      errors.push(`${entry.name}: amortization artifact must record positive planned offline investment.`);
    }
    if (!Array.isArray(result.historical_api_baselines) || result.historical_api_baselines.length < 3) {
      errors.push(`${entry.name}: amortization artifact must include historical API baselines.`);
    }
    if (!Array.isArray(result.break_even_against_historical_baselines) || !result.break_even_against_historical_baselines.some((row) => row.baseline_id === "multistep_teacher_recall_repair_generation")) {
      errors.push(`${entry.name}: amortization artifact must include break-even against the multi-step teacher.`);
    }
    if (!Array.isArray(result.break_even_sensitivity) || result.break_even_sensitivity.length < 4) {
      errors.push(`${entry.name}: amortization artifact must include sensitivity rows.`);
    }
    if (!Array.isArray(result.cost_coverage_context) || !result.cost_coverage_context.some((row) => row.id === "zero_call_span_distilled_scaffold")) {
      errors.push(`${entry.name}: amortization artifact must include zero-call cost/coverage context.`);
    }
    if (!Array.isArray(result.claim_boundaries) || !result.claim_boundaries.some((item) => String(item).includes("does not prove"))) {
      errors.push(`${entry.name}: amortization artifact must include quality claim boundaries.`);
    }
    if (!Array.isArray(result.required_next_evidence) || !result.required_next_evidence.some((item) => String(item).includes("paid grounded-correctness judge"))) {
      errors.push(`${entry.name}: amortization artifact must keep the paid judge as next evidence.`);
    }
    if (!report.includes("Qwen 3B Amortization Break-Even") || !report.includes("Claim Boundaries")) {
      errors.push(`${entry.name}: amortization report must expose title and claim boundaries.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: amortization artifact must be zero actual cost.`);
    }
  }
}

async function validateDistillationLossAccountingRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("distillation-loss-accounting-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed distillation-loss accounting artifacts.`);
      continue;
    }
    if (result.artifact_type !== "distillation_loss_accounting") {
      errors.push(`${entry.name}: unexpected distillation-loss artifact type.`);
    }
    if (result.status !== "loss_accounting_ready_waiting_for_qwen3b") {
      errors.push(`${entry.name}: loss accounting must wait for Qwen3B.`);
    }
    if (!Array.isArray(result.preservation_rows) || result.preservation_rows.length < 6) {
      errors.push(`${entry.name}: loss accounting must include preservation/loss rows.`);
    }
    const rowIds = new Set((result.preservation_rows ?? []).map((row) => row.id));
    for (const id of ["direct_mini_repair", "claim_entailment_guard", "local_qwen05b_sft_answer_repeat2", "local_qwen3b_base_citation_repair"]) {
      if (!rowIds.has(id)) errors.push(`${entry.name}: missing preservation row ${id}.`);
    }
    for (const row of result.preservation_rows ?? []) {
      if (!Array.isArray(row.preserves) || !row.preserves.length || !Array.isArray(row.loses) || !row.loses.length) {
        errors.push(`${entry.name}: ${row.id} must state preserves and loses.`);
      }
    }
    const contract = result.qwen_acceptance_contract;
    if (contract?.target_run_id !== "joint-action-qwen3b-smoke-eval-v1") {
      errors.push(`${entry.name}: loss accounting must target the Qwen3B smoke run.`);
    }
    const dimensions = new Set((contract?.must_preserve_or_improve ?? []).map((row) => row.dimension));
    for (const dimension of ["answer_support_rate", "overall_judged_correct_rate", "answer_rate", "citation_support_and_recall", "abstention_boundaries", "amortized_cost"]) {
      if (!dimensions.has(dimension)) errors.push(`${entry.name}: missing Qwen acceptance dimension ${dimension}.`);
    }
    if (!Array.isArray(contract?.failure_policy) || !contract.failure_policy.some((item) => String(item).includes("negative result"))) {
      errors.push(`${entry.name}: loss accounting must include failure policy for negative Qwen results.`);
    }
    if (!Array.isArray(result.aggregate_lessons) || !result.aggregate_lessons.some((item) => String(item).includes("Citation format"))) {
      errors.push(`${entry.name}: loss accounting must include citation-format lesson.`);
    }
    if (!Array.isArray(result.source_artifacts) || !result.source_artifacts.includes("novelty-watchlist-2026-06-26-v1")) {
      errors.push(`${entry.name}: loss accounting must cite the novelty watchlist source.`);
    }
    if (!report.includes("Distillation-Loss Accounting") || !report.includes("Failure Policy")) {
      errors.push(`${entry.name}: loss accounting report must expose title and failure policy.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: loss accounting must be zero actual cost.`);
    }
  }
}

async function validateNoveltyWatchlistRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("novelty-watchlist-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed novelty watchlist artifacts.`);
      continue;
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: novelty watchlist must be zero-cost.`);
    }
    if (!Array.isArray(result.entries) || result.entries.length < 6) {
      errors.push(`${entry.name}: novelty watchlist must include at least six close neighbors.`);
      continue;
    }
    if (!Array.isArray(result.search_scope?.queries) || result.search_scope.queries.length < 4) {
      errors.push(`${entry.name}: novelty watchlist must record search queries.`);
    }
    if (!Array.isArray(result.search_scope?.refreshed_web_sources) || result.search_scope.refreshed_web_sources.length < 5) {
      errors.push(`${entry.name}: novelty watchlist must record refreshed web sources.`);
    }
    const highPressure = result.entries.filter((row) => ["high", "very_high"].includes(row.pressure)).length;
    if (highPressure < 5) errors.push(`${entry.name}: novelty watchlist must include high-pressure related work.`);
    for (const row of result.entries) {
      if (!row.id || !row.title || !row.url || !Array.isArray(row.overlap_axes) || !row.implication) {
        errors.push(`${entry.name}: malformed novelty entry.`);
      }
    }
    if (!Array.isArray(result.synthesis?.claim_to_avoid) || result.synthesis.claim_to_avoid.length < 3) {
      errors.push(`${entry.name}: novelty watchlist must record claims to avoid.`);
    }
    if (!Array.isArray(result.synthesis?.required_before_paper_claim) || result.synthesis.required_before_paper_claim.length < 3) {
      errors.push(`${entry.name}: novelty watchlist must record required work before paper claims.`);
    }
  }
}

async function validateNoveltyDeltaMatrixRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("novelty-delta-matrix-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed novelty delta matrix artifacts.`);
      continue;
    }
    if (result.artifact_type !== "novelty_delta_matrix") {
      errors.push(`${entry.name}: artifact_type must be novelty_delta_matrix.`);
    }
    if (result.status !== "surviving_claim_conditional_on_qwen3b_and_judge") {
      errors.push(`${entry.name}: novelty delta matrix must keep the surviving claim conditional.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: novelty delta matrix must be zero-cost.`);
    }
    if (!Array.isArray(result.matrix) || result.matrix.length < 8) {
      errors.push(`${entry.name}: novelty delta matrix must cover broad rejected claims and the surviving core claim.`);
    }
    if (Number(result.summary?.broad_claims_rejected) < 6 || Number(result.summary?.surviving_claims) !== 1) {
      errors.push(`${entry.name}: novelty delta matrix must reject broad claims and leave exactly one conditional core claim.`);
    }
    const ids = new Set((result.matrix ?? []).map((row) => row.id));
    for (const id of ["not_generic_rag_to_slm_distillation", "not_citation_sft_or_citation_metric", "not_online_agentic_rag_training", "not_compact_faithful_context_qa", "not_memory_or_index_only_amortization", "surviving_conditional_core_claim"]) {
      if (!ids.has(id)) errors.push(`${entry.name}: missing novelty delta row ${id}.`);
    }
    const prohibited = (result.prohibited_claims_now ?? []).join(" ").toLowerCase();
    if (!prohibited.includes("rag-to-slm") || !prohibited.includes("citation") || !prohibited.includes("agentic") || !prohibited.includes("private enterprise")) {
      errors.push(`${entry.name}: prohibited claims must cover RAG-to-SLM, citation, agentic, and private-enterprise overclaims.`);
    }
    const required = (result.required_before_submission_claim ?? []).join(" ").toLowerCase();
    if (!required.includes("qwen") || !required.includes("grounded-correctness judge") || !required.includes("novelty search")) {
      errors.push(`${entry.name}: required evidence must include Qwen, grounded judge, and final novelty refresh.`);
    }
    if (!report.includes("Novelty Delta Matrix") || !report.includes("Prohibited Claims Now")) {
      errors.push(`${entry.name}: report must expose title and prohibited claims.`);
    }
  }
}

async function validatePostTrainingPolicyAblationRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("post-training-policy-ablation-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed post-training policy ablation artifacts.`);
      continue;
    }
    if (result.artifact_type !== "post_training_data_policy_ablation") {
      errors.push(`${entry.name}: unexpected artifact_type.`);
    }
    if (result.status !== "historical_judged_ablation_not_final_qwen3b_result") {
      errors.push(`${entry.name}: ablation must be marked as historical and not final Qwen3B evidence.`);
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: policy ablation must be zero-cost.`);
    }
    if (!Array.isArray(result.families) || result.families.length < 5) {
      errors.push(`${entry.name}: expected at least five policy families.`);
      continue;
    }
    const familyIds = new Set(result.families.map((row) => row.id));
    for (const id of ["direct_compact_rag_student_with_citation_repair", "support_risk_gated_labels", "local_span_or_tiny_sft_scaffolds"]) {
      if (!familyIds.has(id)) errors.push(`${entry.name}: missing family ${id}.`);
    }
    for (const family of result.families) {
      if (!family.description || !family.data_policy || !family.interpretation) {
        errors.push(`${entry.name}: ${family.id} missing description, data policy, or interpretation.`);
      }
      if (!Array.isArray(family.windows) || !family.windows.length) {
        errors.push(`${entry.name}: ${family.id} has no source windows.`);
        continue;
      }
      const present = family.windows.filter((row) => row.present);
      if (!present.length) errors.push(`${entry.name}: ${family.id} has no present source windows.`);
      for (const row of present) {
        if (!row.run_id || !row.examples_judged) errors.push(`${entry.name}: malformed source window for ${family.id}.`);
        if (row.answer_support_rate == null || row.overall_judged_correct_rate == null) {
          errors.push(`${entry.name}: ${family.id}/${row.window} missing support or correctness metrics.`);
        }
      }
      if (!family.aggregate || family.aggregate.examples_judged <= 0 || family.aggregate.answer_rate == null || family.aggregate.overall_judged_correct_rate == null) {
        errors.push(`${entry.name}: ${family.id} has malformed aggregate metrics.`);
      }
    }
    if (!Array.isArray(result.conclusions) || result.conclusions.length < 4) {
      errors.push(`${entry.name}: ablation must include conclusions.`);
    }
    if (!result.qwen3b_training_implication?.required_design || !result.qwen3b_training_implication?.acceptance_metric) {
      errors.push(`${entry.name}: missing Qwen3B training implication.`);
    }
    if (!Array.isArray(result.qwen3b_training_implication?.still_missing) || result.qwen3b_training_implication.still_missing.length < 3) {
      errors.push(`${entry.name}: missing Qwen3B remaining evidence list.`);
    }
  }
}

async function validateCoverageConstrainedFrontierRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("coverage-constrained-support-frontier-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed coverage-constrained frontier artifacts.`);
      continue;
    }
    if (result.artifact_type !== "coverage_constrained_support_frontier") {
      errors.push(`${entry.name}: unexpected artifact_type.`);
    }
    if (result.status !== "historical_judgment_replay_not_final_qwen3b_result") {
      errors.push(`${entry.name}: frontier must be marked as historical replay and not final Qwen3B evidence.`);
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: coverage-constrained frontier must be zero-cost.`);
    }
    if (!Array.isArray(result.windows) || result.windows.length < 3) {
      errors.push(`${entry.name}: expected at least three source windows.`);
    }
    if (!Array.isArray(result.thresholds) || result.thresholds.length < 8) {
      errors.push(`${entry.name}: expected multiple threshold replay rows.`);
      continue;
    }
    for (const row of result.thresholds) {
      if (row.inherited_missing !== 0) errors.push(`${entry.name}: threshold ${row.threshold} has missing inherited judgments.`);
      for (const key of ["answer_rate", "answer_support_rate", "abstention_support_rate", "overall_judged_correct_rate"]) {
        if (!Number.isFinite(Number(row[key]))) errors.push(`${entry.name}: threshold ${row.threshold} missing ${key}.`);
      }
    }
    const operatingPoints = result.coverage_constrained_operating_points ?? [];
    if (!Array.isArray(operatingPoints) || operatingPoints.length < 4) {
      errors.push(`${entry.name}: expected coverage-constrained operating points.`);
    }
    const seventy = operatingPoints.find((row) => Math.abs(Number(row.min_answer_rate) - 0.7) < 1e-9);
    if (!seventy?.selected) {
      errors.push(`${entry.name}: missing selected 70% coverage operating point.`);
    }
    if (!result.qwen3b_acceptance_target?.recommended_minimum || !result.qwen3b_acceptance_target?.direct_baseline || !result.qwen3b_acceptance_target?.current_gate_floor) {
      errors.push(`${entry.name}: missing Qwen3B acceptance target.`);
    }
    if (!Array.isArray(result.conclusions) || result.conclusions.length < 3) {
      errors.push(`${entry.name}: frontier must include conclusions.`);
    }
  }
}

async function validateV14SupportDeltaOutcomeAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("v14-support-delta-outcome-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const rowsPath = path.join(runsDir, entry.name, "rows.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let rows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      rows = await readJsonl(rowsPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed v14 support-delta outcome audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "v14_support_delta_outcome_audit") {
      errors.push(`${entry.name}: artifact_type must be v14_support_delta_outcome_audit.`);
    }
    if (!["v14_generator_minimum_positive", "v14_gate_selector_minimum_positive_not_amortized", "v14_adds_candidate_pool_headroom_but_needs_selector", "v14_small_selector_signal_not_launch_ready", "v14_support_delta_negative"].includes(result.status)) {
      errors.push(`${entry.name}: invalid v14 support-delta outcome status.`);
    }
    if (Number(result.examples) !== 69 || rows.length !== 69) {
      errors.push(`${entry.name}: audit must cover the 69-example final window.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: v14 support-delta outcome audit must be zero-cost.`);
    }
    for (const key of ["v14", "v13", "qwen_only_oracle", "scaffold_priority", "calibrated_hybrid", "scaffold_plus_v14_answer_citation_gate", "hybrid_plus_v14_answer_citation_gate"]) {
      if (!result.metrics?.[key]) errors.push(`${entry.name}: missing metrics.${key}.`);
    }
    if (!Array.isArray(result.support_delta?.v14_supported_not_in_qwen_oracle_ids)) {
      errors.push(`${entry.name}: support_delta must include v14_supported_not_in_qwen_oracle_ids.`);
    }
    if (result.next_supervision_signal?.should_launch_gpu_next !== false) {
      errors.push(`${entry.name}: outcome audit must not authorize immediate GPU launch.`);
    }
    if (!report.includes("V14 Support-Delta Outcome Audit") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify v14 outcome audit and zero-cost status.`);
    }
  }
}

async function validateQwenSwitchFrontierAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen-switch-frontier-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const rowsPath = path.join(runsDir, entry.name, "rows.jsonl");
    const sweepPath = path.join(runsDir, entry.name, "threshold_sweep.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let rows;
    let sweep;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      rows = await readJsonl(rowsPath);
      sweep = await readJsonl(sweepPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen switch frontier audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen_switch_frontier_audit") {
      errors.push(`${entry.name}: artifact_type must be qwen_switch_frontier_audit.`);
    }
    if (!["frontier_deployable_rule_candidate_needs_cross_window_validation", "frontier_requires_stronger_verifier", "frontier_has_headroom_but_rule_unvalidated", "frontier_no_remaining_qwen_headroom"].includes(result.status)) {
      errors.push(`${entry.name}: invalid Qwen switch frontier status.`);
    }
    if (Number(result.examples) !== 69 || rows.length !== 69) {
      errors.push(`${entry.name}: frontier audit must cover the 69-example final window.`);
    }
    if (sweep.length < 100) {
      errors.push(`${entry.name}: frontier audit must include a nontrivial threshold sweep.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: Qwen switch frontier audit must be zero-cost.`);
    }
    if (Number(result.frontier?.oracle_supported_missed_by_hybrid) < 1 || Number(result.frontier?.harmful_hybrid_qwen_switches) < 1) {
      errors.push(`${entry.name}: frontier audit must expose both missed supported and harmful Qwen switches.`);
    }
    if (!result.feature_separability?.interpretation || !result.best_diagnostic_sweep?.policy_id) {
      errors.push(`${entry.name}: frontier audit must include separability and best diagnostic sweep.`);
    }
    if (!String(result.decision_implication ?? "").toLowerCase().includes("verifier") && result.status === "frontier_requires_stronger_verifier") {
      errors.push(`${entry.name}: stronger-verifier status must mention verifier in decision implication.`);
    }
    if (!report.includes("Qwen Switch Frontier Audit") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify Qwen switch frontier audit and zero-cost status.`);
    }
  }
}

async function validateModelScaleAdequacyAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("model-scale-adequacy-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed model-scale adequacy audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "model_scale_adequacy_audit") {
      errors.push(`${entry.name}: unexpected model-scale audit type.`);
    }
    if (result.status !== "qwen3b_gpu_smoke_still_required") {
      errors.push(`${entry.name}: model-scale audit must keep the Qwen3B smoke required.`);
    }
    if (result.decision?.use_tiny_models_as_final_student !== false || result.decision?.use_tiny_models_as_ground_truth_labelers !== false) {
      errors.push(`${entry.name}: tiny models must not be accepted as final students or ground-truth labelers.`);
    }
    if (result.decision?.rent_gpu_for_bounded_qwen3b_smoke !== true || result.decision?.rent_cutting_edge_large_gpu_model_now !== false) {
      errors.push(`${entry.name}: audit must prefer bounded Qwen3B smoke over an open-ended large GPU experiment.`);
    }
    if (!Array.isArray(result.systems) || result.systems.length < 5) {
      errors.push(`${entry.name}: model-scale audit must compare at least five systems.`);
    }
    const qwen05b = result.systems?.find((row) => row.id === "local_qwen05b_sft_answer_repeat2");
    if (!qwen05b || Number(qwen05b.answer_support_rate) >= 0.1 || Number(qwen05b.inline_citation_rate) < 0.9) {
      errors.push(`${entry.name}: model-scale audit must capture the Qwen 0.5B citation/support gap.`);
    }
    const qwen3bBase = result.systems?.find((row) => row.id === "local_qwen3b_base_control");
    if (!qwen3bBase || qwen3bBase.verdict !== "scale_alone_not_contract_sufficient" || Number(qwen3bBase.inline_citation_rate) > 0.5 || Number(qwen3bBase.valid_json_rate) < 0.5) {
      errors.push(`${entry.name}: model-scale audit must capture the local Qwen 3B base-control contract gap.`);
    }
    const qwen3bRepair = result.systems?.find((row) => row.id === "local_qwen3b_base_citation_repair");
    if (!qwen3bRepair || qwen3bRepair.verdict !== "syntax_repair_not_grounded_correctness" || Number(qwen3bRepair.inline_citation_rate) < 0.9) {
      errors.push(`${entry.name}: model-scale audit must capture that syntax repair is not grounded correctness evidence.`);
    }
    if (!result.qwen3b_acceptance_target?.seventy_percent_operating_point || !String(result.qwen3b_acceptance_target?.minimum ?? "").includes("70")) {
      errors.push(`${entry.name}: model-scale audit must include the 70% coverage-constrained Qwen3B target.`);
    }
    if (result.next_experiment?.constraints?.max_total_budget_usd !== 100 || result.next_experiment?.constraints?.require_prime_auth_price_gate_status !== "auth_and_live_price_verified") {
      errors.push(`${entry.name}: model-scale audit must preserve the $100 and Prime auth/price gates.`);
    }
    if (!report.includes("Model Scale Adequacy Audit") || !report.includes("Rent GPU for bounded Qwen 3B smoke: yes")) {
      errors.push(`${entry.name}: model-scale audit report must expose the bounded-GPU decision.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: model-scale audit must be zero cost.`);
    }
  }
}

async function validateJointActionPacketQualityAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-packet-quality-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed joint-action packet quality audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "joint_action_packet_quality_audit") {
      errors.push(`${entry.name}: unexpected artifact_type.`);
    }
    if (result.status !== "ready_for_bounded_qwen3b_smoke") {
      errors.push(`${entry.name}: packet audit must pass before being used as launch evidence.`);
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: packet quality audit must be zero-cost.`);
    }
    const checks = result.checks ?? [];
    if (!Array.isArray(checks) || checks.length < 7) {
      errors.push(`${entry.name}: expected packet quality checks.`);
    }
    for (const check of checks) {
      if (check.status !== "pass") errors.push(`${entry.name}: check ${check.id} did not pass.`);
    }
    const sft = result.aggregate?.sft;
    const dpo = result.aggregate?.dpo;
    if (!sft || sft.grounded_answer_rows <= 0 || sft.abstain_rows <= 0 || sft.grounded_missing_inline_citation_rows !== 0) {
      errors.push(`${entry.name}: malformed SFT aggregate.`);
    }
    if (!dpo || dpo.chosen_grounded_answer_rows <= 0 || dpo.chosen_abstain_rows <= 0 || dpo.rejected_grounded_answer_rows !== dpo.rows) {
      errors.push(`${entry.name}: malformed DPO aggregate.`);
    }
    if (!result.coverage_frontier_context?.seventy_percent_operating_point || !result.coverage_frontier_context?.recommended_minimum) {
      errors.push(`${entry.name}: missing coverage-frontier context.`);
    }
    if (!Array.isArray(result.aggregate?.train_eval_paper_overlap) || result.aggregate.train_eval_paper_overlap.length !== 0) {
      errors.push(`${entry.name}: train/eval paper overlap must be empty.`);
    }
  }
}

async function validatePaperReadinessGateRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("paper-readiness-gate-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed paper readiness gate artifacts.`);
      continue;
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: paper readiness gate must be zero-cost.`);
    }
    if (!Array.isArray(result.requirements) || result.requirements.length < 10) {
      errors.push(`${entry.name}: paper readiness gate must check core requirements.`);
      continue;
    }
    if (result.summary?.paper_ready !== false || result.summary?.current_status !== "not_paper_ready") {
      errors.push(`${entry.name}: current gate should not mark the project paper-ready before GPU result and novelty baselines exist.`);
    }
    const requiredIds = new Set(result.requirements.map((row) => row.id));
    for (const id of ["novelty_delta_matrix_current", "qwen3b_joint_action_smoke_result", "grounded_correctness_eval_for_student", "drag_like_rag_distillation_comparison", "longcite_style_citation_sft_comparison", "citation_faithfulness_neighbor_positioning", "writeback_kb_amortization_baseline", "trusted_dated_or_private_kb_snapshot"]) {
      if (!requiredIds.has(id)) errors.push(`${entry.name}: missing readiness requirement ${id}.`);
    }
    const evidenceText = JSON.stringify(result).toLowerCase();
    if (!evidenceText.includes("novelty-watchlist-2026-06-27-v2") || !evidenceText.includes("novelty-delta-matrix-2026-06-27-v1") || !evidenceText.includes("citation-faithfulness-neighbor-comparison-2026-06-27-v1")) {
      errors.push(`${entry.name}: paper readiness gate must use the latest novelty, novelty-delta, and citation-faithfulness artifacts.`);
    }
    const failed = result.requirements.filter((row) => row.status === "fail").length;
    if (failed !== Number(result.summary?.failed)) errors.push(`${entry.name}: failed summary count mismatch.`);
    if (!Array.isArray(result.top_blockers) || (result.summary?.paper_ready === false && result.top_blockers.length < 1)) {
      errors.push(`${entry.name}: paper readiness gate must surface blockers.`);
    }
  }
}

async function validateCitationSftComparisonRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || (!entry.name.startsWith("longcite-style-citation-sft-comparison-") && !entry.name.startsWith("citation-sft-comparison-"))) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed citation-SFT comparison artifacts.`);
      continue;
    }
    if (result.comparison_type !== "longcite_style_citation_sft_framing") {
      errors.push(`${entry.name}: comparison_type must be longcite_style_citation_sft_framing.`);
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: citation-SFT comparison must be zero-cost.`);
    }
    if (!Array.isArray(result.systems) || result.systems.length < 2) {
      errors.push(`${entry.name}: citation-SFT comparison must include at least two systems.`);
      continue;
    }
    const judged = result.systems.filter((row) => row.support_metrics);
    if (judged.length < 2) errors.push(`${entry.name}: citation-SFT comparison must include at least two judged systems.`);
    for (const row of result.systems) {
      if (!Number.isFinite(Number(row.syntax_metrics?.inline_citation_rate))) {
        errors.push(`${entry.name}: ${row.id ?? "system"} missing inline citation rate.`);
      }
    }
    const syntaxSupportGap = judged.some((row) => {
      const inlineRate = Number(row.syntax_metrics?.inline_citation_rate);
      const supportRate = Number(row.support_metrics?.answer_support_rate);
      return inlineRate > 0.95 && supportRate < 0.10;
    });
    if (!syntaxSupportGap) {
      errors.push(`${entry.name}: citation-SFT comparison must demonstrate that high citation syntax compliance can coexist with low answer support.`);
    }
  }
}

async function validateDragStyleComparisonRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || (!entry.name.startsWith("drag-like-rag-distillation-comparison-") && !entry.name.startsWith("generic-rag-distill-comparison-"))) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed DRAG-style comparison artifacts.`);
      continue;
    }
    if (result.comparison_type !== "drag_like_generic_rag_distillation_comparison") {
      errors.push(`${entry.name}: comparison_type must be drag_like_generic_rag_distillation_comparison.`);
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: DRAG-style comparison must be zero-cost.`);
    }
    if (!Array.isArray(result.systems) || result.systems.length < 4) {
      errors.push(`${entry.name}: DRAG-style comparison must include generic, scaffold, and local student systems.`);
      continue;
    }
    const roles = new Set(result.systems.map((row) => row.comparison_role));
    for (const role of ["generic_rag_to_small_model_reference", "cheap_scaffold_over_generic_rag_student", "local_distilled_rag_scaffold_floor", "tiny_foundation_model_distillation_failure_mode"]) {
      if (!roles.has(role)) errors.push(`${entry.name}: missing comparison role ${role}.`);
    }
    const judged = result.systems.filter((row) => row.support_metrics);
    if (judged.length < 3) errors.push(`${entry.name}: DRAG-style comparison must include at least three judged systems.`);
    const nonComparable = String(result.related_work_framing?.non_comparable_axis ?? "").toLowerCase();
    if (!nonComparable.includes("evolving") || !nonComparable.includes("support")) {
      errors.push(`${entry.name}: DRAG-style comparison must document evolving-KB/support non-comparability.`);
    }
    if (!Array.isArray(result.synthesis?.true_drag_reproduction_needed) || result.synthesis.true_drag_reproduction_needed.length < 2) {
      errors.push(`${entry.name}: DRAG-style comparison must state what a true DRAG reproduction would require.`);
    }
  }
}

async function validateFaithfulContextQaComparisonRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("faithful-context-qa-comparison-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed faithful context QA comparison artifacts.`);
      continue;
    }
    if (result.comparison_type !== "compact_faithful_context_qa_positioning") {
      errors.push(`${entry.name}: comparison_type must be compact_faithful_context_qa_positioning.`);
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: faithful context QA comparison must be zero-cost.`);
    }
    const framing = result.related_work_framing ?? {};
    if (!String(framing.close_neighbor_url ?? "").includes("2606.00683") || !String(framing.distinction ?? "").includes("evolving")) {
      errors.push(`${entry.name}: faithful context QA comparison must cite OCC-RAG and state the evolving-KB distinction.`);
    }
    if (!Array.isArray(result.dimensions) || result.dimensions.length < 5) {
      errors.push(`${entry.name}: faithful context QA comparison must include core comparison dimensions.`);
    }
    const dimensions = new Set((result.dimensions ?? []).map((row) => row.id));
    for (const dimension of ["faithfulness_support", "citation_grounding", "safe_abstention", "evolving_kb_update_holdout", "amortized_inference_cost"]) {
      if (!dimensions.has(dimension)) errors.push(`${entry.name}: missing dimension ${dimension}.`);
    }
    if (!Array.isArray(result.synthesis?.claim_boundary) || !result.synthesis.claim_boundary.some((item) => String(item).includes("first compact faithful-context-QA"))) {
      errors.push(`${entry.name}: faithful context QA comparison must include compact-QA claim boundary.`);
    }
    if (!Array.isArray(result.synthesis?.true_baseline_needed) || !result.synthesis.true_baseline_needed.some((item) => String(item).includes("same compact evidence packs"))) {
      errors.push(`${entry.name}: faithful context QA comparison must state true baseline requirements.`);
    }
    if (!report.includes("Compact Faithful Context QA Comparison") || !report.includes("True Baseline Needed")) {
      errors.push(`${entry.name}: faithful context QA report must expose title and baseline requirements.`);
    }
  }
}

async function validateCitationGroundingMemoryComparisonRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("citation-grounding-memory-comparison-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed citation-grounding/memory comparison artifacts.`);
      continue;
    }
    if (result.comparison_type !== "citation_grounding_and_memory_amortization_positioning") {
      errors.push(`${entry.name}: comparison_type must be citation_grounding_and_memory_amortization_positioning.`);
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: citation-grounding/memory comparison must be zero-cost.`);
    }
    const neighborIds = new Set((result.related_work_framing?.neighbors ?? []).map((row) => row.id));
    for (const id of ["citation_enforced_fiscal_rag", "legal_citation_grounding_metric", "fd_rag_federated_compact_qa_memories"]) {
      if (!neighborIds.has(id)) errors.push(`${entry.name}: missing related-work neighbor ${id}.`);
    }
    const dimensions = new Set((result.dimensions ?? []).map((row) => row.id));
    for (const dimension of ["citation_existence", "citation_support_relevance", "temporal_validity", "memory_side_amortization", "model_scaffold_amortization_target"]) {
      if (!dimensions.has(dimension)) errors.push(`${entry.name}: missing dimension ${dimension}.`);
    }
    const boundaryText = (result.synthesis?.claim_boundary ?? []).join(" ").toLowerCase();
    if (!boundaryText.includes("citation-enforced") || !boundaryText.includes("compact-memory") || !boundaryText.includes("qwen 3b")) {
      errors.push(`${entry.name}: claim boundary must cover citation-enforced RAG, compact memory, and Qwen 3B gating.`);
    }
    const neededText = (result.synthesis?.true_baseline_or_scope_needed ?? []).join(" ").toLowerCase();
    if (!neededText.includes("citation existence") || !neededText.includes("temporal") || !neededText.includes("compact-memory")) {
      errors.push(`${entry.name}: baseline/scope requirements must separate citation existence, temporal validity, and compact memory.`);
    }
    if (!report.includes("Citation Grounding And Compact Memory Comparison") || !report.includes("True Baseline Or Scope Needed")) {
      errors.push(`${entry.name}: report must expose title and baseline/scope requirements.`);
    }
  }
}

async function validateCitationFaithfulnessNeighborComparisonRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("citation-faithfulness-neighbor-comparison-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed citation-faithfulness neighbor comparison artifacts.`);
      continue;
    }
    if (result.comparison_type !== "citation_faithfulness_neighbor_positioning") {
      errors.push(`${entry.name}: comparison_type must be citation_faithfulness_neighbor_positioning.`);
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: citation-faithfulness comparison must be zero-cost.`);
    }
    const neighborIds = new Set((result.related_work_framing?.neighbors ?? []).map((row) => row.id));
    for (const id of ["qdrag_query_decomposition_citation_rag", "citerag_academic_citation_prediction", "faithfulness_aware_context_ranking", "generate_but_verify_rag_faithfulness"]) {
      if (!neighborIds.has(id)) errors.push(`${entry.name}: missing related-work neighbor ${id}.`);
    }
    const dimensions = new Set((result.dimensions ?? []).map((row) => row.id));
    for (const dimension of ["retrieval_side_decomposition", "academic_citation_prediction", "faithfulness_ranking", "generate_then_verify", "citation_syntax_vs_support", "final_claim_boundary"]) {
      if (!dimensions.has(dimension)) errors.push(`${entry.name}: missing dimension ${dimension}.`);
    }
    const boundaryText = (result.synthesis?.claim_boundary ?? []).join(" ").toLowerCase();
    if (!boundaryText.includes("query-decomposition") || !boundaryText.includes("academic citation") || !boundaryText.includes("generate-then-verify")) {
      errors.push(`${entry.name}: claim boundary must cover query decomposition, academic citation prediction, and generate-then-verify.`);
    }
    const requiredText = (result.synthesis?.required_after_qwen_smoke ?? []).join(" ").toLowerCase();
    if (!requiredText.includes("qwen") || !requiredText.includes("candidate-pool oracle") || !requiredText.includes("verification cost")) {
      errors.push(`${entry.name}: post-Qwen requirements must mention Qwen, candidate-pool oracle, and verification cost.`);
    }
    if (!report.includes("Citation Faithfulness Neighbor Comparison") || !report.includes("Required After Qwen Smoke")) {
      errors.push(`${entry.name}: report must expose title and post-Qwen requirements.`);
    }
  }
}

async function validateFaithfulnessRankingControlRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("faithfulness-ranking-control-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    const trainDiagnosticsPath = path.join(runsDir, entry.name, "train_diagnostics.jsonl");
    let result;
    let report;
    let predictions;
    let trainDiagnostics;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
      predictions = await readJsonl(predictionsPath);
      trainDiagnostics = await readJsonl(trainDiagnosticsPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed faithfulness-ranking control artifacts.`);
      continue;
    }
    if (result.artifact_type !== "faithfulness_ranking_control") {
      errors.push(`${entry.name}: artifact_type must be faithfulness_ranking_control.`);
    }
    if (result.control_type !== "zero_call_retrieval_side_faithfulness_filter") {
      errors.push(`${entry.name}: control_type must be zero_call_retrieval_side_faithfulness_filter.`);
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: faithfulness-ranking control must be zero-cost.`);
    }
    if (predictions.length !== result.eval_window?.examples) {
      errors.push(`${entry.name}: predictions length must match eval_window.examples.`);
    }
    if (trainDiagnostics.length !== result.train_window?.examples) {
      errors.push(`${entry.name}: train diagnostics length must match train_window.examples.`);
    }
    if (result.train_window?.label !== "241-320" || result.eval_window?.label !== "321-389") {
      errors.push(`${entry.name}: expected train window 241-320 and eval window 321-389.`);
    }
    if (!Number.isFinite(Number(result.selected_threshold?.threshold))) {
      errors.push(`${entry.name}: missing selected threshold.`);
    }
    if (Number(result.selected_threshold?.answer_rate) < 0.7) {
      errors.push(`${entry.name}: selected train threshold must preserve at least 70% train answer rate.`);
    }
    if (result.eval_metrics?.examples !== result.baseline_eval_metrics?.examples) {
      errors.push(`${entry.name}: eval and baseline examples must match.`);
    }
    if (result.eval_metrics?.suppressions !== predictions.filter((row) => row.metadata?.faithfulness_filter_fired).length) {
      errors.push(`${entry.name}: suppression count must match predictions.`);
    }
    const featureRows = predictions.filter((row) => Number.isFinite(Number(row.metadata?.faithfulness_features?.faithfulness_score)));
    if (featureRows.length !== predictions.length) {
      errors.push(`${entry.name}: every prediction row must include a numeric faithfulness score.`);
    }
    if (!String(result.paper_implication ?? "").toLowerCase().includes("qwen")) {
      errors.push(`${entry.name}: paper_implication must preserve the Qwen repair/regeneration requirement.`);
    }
    if (!report.includes("Faithfulness Ranking Control") || !report.includes("Final-Window Result")) {
      errors.push(`${entry.name}: report must expose title and final-window result.`);
    }
  }
}

async function validateUnsupportedAnswerRepairabilityAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("unsupported-answer-repairability-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const rowsPath = path.join(runsDir, entry.name, "audit_rows.jsonl");
    let result;
    let report;
    let rows;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
      rows = await readJsonl(rowsPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed unsupported-answer repairability audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "unsupported_answer_repairability_audit") {
      errors.push(`${entry.name}: artifact_type must be unsupported_answer_repairability_audit.`);
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: unsupported-answer repairability audit must be zero-cost.`);
    }
    if (rows.length !== result.aggregate?.unsupported_answer_rows) {
      errors.push(`${entry.name}: audit_rows length must match aggregate.unsupported_answer_rows.`);
    }
    if (result.inputs?.final_window !== "321-389") {
      errors.push(`${entry.name}: expected final_window 321-389.`);
    }
    const bucketTotal = Object.values(result.buckets ?? {}).reduce((total, value) => total + Number(value), 0);
    if (bucketTotal !== rows.length) {
      errors.push(`${entry.name}: bucket counts must sum to audit row count.`);
    }
    const requiredBuckets = ["citation_repair_candidate", "answer_repair_or_regeneration_needed", "should_abstain_counterfactual_or_insufficient"];
    const bucketNames = new Set(Object.keys(result.buckets ?? {}));
    for (const bucket of requiredBuckets) {
      if (!bucketNames.has(bucket)) errors.push(`${entry.name}: missing bucket ${bucket}.`);
    }
    if (result.training_implication?.citation_repair_alone_sufficient !== false) {
      errors.push(`${entry.name}: current audit should not mark citation repair alone sufficient.`);
    }
    if (!String(result.training_implication?.recommendation ?? "").toLowerCase().includes("qwen")) {
      errors.push(`${entry.name}: recommendation must preserve Qwen joint-action implication.`);
    }
    if (!report.includes("Unsupported Answer Repairability Audit") || !report.includes("Training Implication")) {
      errors.push(`${entry.name}: report must expose title and training implication.`);
    }
  }
}

async function validateFinalClaimAcceptanceMatrixRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("final-claim-acceptance-matrix-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed final claim acceptance matrix artifacts.`);
      continue;
    }
    if (result.artifact_type !== "final_claim_acceptance_matrix") {
      errors.push(`${entry.name}: artifact_type must be final_claim_acceptance_matrix.`);
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: final claim acceptance matrix must be zero-cost.`);
    }
    if (!Array.isArray(result.matrix) || result.matrix.length < 10) {
      errors.push(`${entry.name}: final claim acceptance matrix must include at least ten requirements.`);
    }
    const ids = new Set((result.matrix ?? []).map((row) => row.id));
    for (const id of [
      "trained_student_predictions",
      "grounded_correctness_judge",
      "answer_support_preserved",
      "coverage_not_collapsed",
      "citation_support_not_syntax",
      "temporal_update_validity",
      "amortized_cost_accounted",
      "judge_reliability_claim_bounded",
      "novelty_claims_narrowed",
      "citation_faithfulness_neighbors_positioned",
      "paper_readiness_gate_green",
    ]) {
      if (!ids.has(id)) errors.push(`${entry.name}: missing final-claim requirement ${id}.`);
    }
    if (result.status !== "final_claim_blocked") {
      errors.push(`${entry.name}: current matrix should remain blocked until Qwen 3B smoke and judge exist.`);
    }
    const evidenceText = JSON.stringify(result).toLowerCase();
    if (!evidenceText.includes("novelty-watchlist-2026-06-27-v2") || !evidenceText.includes("novelty-delta-matrix-2026-06-27-v1") || !evidenceText.includes("citation-faithfulness-neighbor-comparison-2026-06-27-v1")) {
      errors.push(`${entry.name}: final claim matrix must use the latest novelty watchlist, novelty-delta matrix, and citation-faithfulness comparison.`);
    }
    const blockers = new Set(result.summary?.blocking_failures ?? []);
    for (const blocker of ["grounded_correctness_judge", "paper_readiness_gate_green"]) {
      if (!blockers.has(blocker)) errors.push(`${entry.name}: expected current blocker ${blocker}.`);
    }
    const prohibited = (result.prohibited_claims_now ?? []).join(" ").toLowerCase();
    if (!prohibited.includes("citation syntax") || !prohibited.includes("neurips")) {
      errors.push(`${entry.name}: prohibited claims must cover citation syntax and NeurIPS readiness.`);
    }
    if (!report.includes("Final Claim Acceptance Matrix") || !report.includes("Blocking Failures")) {
      errors.push(`${entry.name}: report must expose title and blocking failures.`);
    }
  }
}

async function validateWriteBackScopeRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || (!entry.name.startsWith("writeback-kb-amortization-") && !entry.name.startsWith("kb-writeback-") && !entry.name.startsWith("evidence-distillation-baseline-"))) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed WriteBack scope artifacts.`);
      continue;
    }
    if (!["writeback_kb_amortization_scoped_exclusion", "writeback_kb_amortization_baseline"].includes(result.comparison_type)) {
      errors.push(`${entry.name}: unexpected WriteBack comparison_type.`);
    }
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: WriteBack scope artifact must be zero-cost.`);
    }
    if (!Array.isArray(result.current_artifacts) || result.current_artifacts.length < 2) {
      errors.push(`${entry.name}: WriteBack scope artifact must audit current distillation artifacts.`);
      continue;
    }
    if (result.current_artifacts.some((artifact) => artifact.writes_back_to_kb !== false)) {
      errors.push(`${entry.name}: scoped exclusion should not claim current artifacts write back to the KB.`);
    }
    const requirements = result.scoped_exclusion?.future_baseline_requirements;
    if (!Array.isArray(requirements) || requirements.length < 4) {
      errors.push(`${entry.name}: WriteBack scoped exclusion must record future baseline requirements.`);
    }
    const reason = String(result.related_work_framing?.exclusion_reason ?? "").toLowerCase();
    if (!reason.includes("leak") || !reason.includes("dated")) {
      errors.push(`${entry.name}: WriteBack scoped exclusion must explain leakage and dated-snapshot requirements.`);
    }
  }
}

async function validateVersionedKbWritebackDiagnosticRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("versioned-kb-writeback-diagnostic-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    const recordsPath = path.join(runsDir, entry.name, "writeback_records.jsonl");
    let result;
    let report;
    let predictions;
    let records;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
      predictions = await readJsonl(predictionsPath);
      records = await readJsonl(recordsPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed versioned KB WriteBack diagnostic artifacts.`);
      continue;
    }
    if (result.artifact_type !== "versioned_kb_writeback_diagnostic") {
      errors.push(`${entry.name}: unexpected WriteBack diagnostic artifact type.`);
    }
    if (result.status !== "writeback_diagnostic_complete") {
      errors.push(`${entry.name}: WriteBack diagnostic should complete.`);
    }
    const systemIds = new Set((result.systems ?? []).map((row) => row.id));
    for (const id of ["leak_safe_train_writeback_only", "leak_safe_train_writeback_plus_live_snapshot", "leaky_eval_writeback_upper_bound"]) {
      if (!systemIds.has(id)) errors.push(`${entry.name}: missing WriteBack diagnostic system ${id}.`);
    }
    const trainOnly = result.systems?.find((row) => row.id === "leak_safe_train_writeback_only");
    const safeLive = result.systems?.find((row) => row.id === "leak_safe_train_writeback_plus_live_snapshot");
    const leaky = result.systems?.find((row) => row.id === "leaky_eval_writeback_upper_bound");
    if (Number(trainOnly?.by_type?.eval_update_grounded_answer?.overall_correct_rate) !== 0) {
      errors.push(`${entry.name}: train-only writeback should not solve eval-only updates.`);
    }
    if (Number(safeLive?.overall_correct_rate) !== 1 || Number(safeLive?.by_type?.stale_snapshot_abstention?.overall_correct_rate) !== 1) {
      errors.push(`${entry.name}: leak-safe live snapshot writeback should solve the deterministic slice.`);
    }
    if (leaky?.leaky !== true || Number(leaky?.by_type?.stale_snapshot_abstention?.answer_rate) !== 1 || Number(leaky?.by_type?.stale_snapshot_abstention?.overall_correct_rate) !== 0) {
      errors.push(`${entry.name}: leaky eval writeback must be marked invalid by stale over-answering.`);
    }
    if (records.length !== Number(result.records?.train_writeback_records) + Number(result.records?.eval_records_for_leaky_upper_bound)) {
      errors.push(`${entry.name}: writeback record count mismatch.`);
    }
    if (predictions.length !== Number(result.systems?.length ?? 0) * 30) {
      errors.push(`${entry.name}: prediction row count should equal systems times 30 examples.`);
    }
    if (!report.includes("Versioned KB WriteBack Diagnostic") || !report.includes("Eval-Update Slice")) {
      errors.push(`${entry.name}: WriteBack diagnostic report must expose eval-update slice.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: WriteBack diagnostic must be zero-cost.`);
    }
  }
}

async function validateVersionedKbNaturalnessAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("versioned-kb-naturalness-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const auditPath = path.join(runsDir, entry.name, "question_audit.jsonl");
    let result;
    let report;
    let rows;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
      rows = await readJsonl(auditPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed versioned KB naturalness audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "versioned_kb_naturalness_audit") {
      errors.push(`${entry.name}: unexpected naturalness audit artifact type.`);
    }
    if (result.status !== "natural_benchmark_gap_measured") {
      errors.push(`${entry.name}: naturalness audit should measure the gap rather than claim benchmark readiness.`);
    }
    if (rows.length !== Number(result.aggregate?.examples) || rows.length < 20) {
      errors.push(`${entry.name}: question audit rows must match aggregate examples and include the prototype set.`);
    }
    if (result.scorecard?.supports_snapshot_protocol_claim !== true) {
      errors.push(`${entry.name}: naturalness audit should preserve the snapshot protocol claim.`);
    }
    if (result.scorecard?.supports_natural_versioned_kb_benchmark_claim !== false || result.scorecard?.supports_private_enterprise_kb_claim !== false) {
      errors.push(`${entry.name}: naturalness audit must not claim natural/private benchmark readiness.`);
    }
    if (Number(result.aggregate?.template_question_rate) < 0.9 || Number(result.aggregate?.prefix_leakage_rate) < 0.9) {
      errors.push(`${entry.name}: current deterministic prototype should expose template wording and prefix leakage.`);
    }
    const checkIds = new Set((result.checks ?? []).map((row) => row.id));
    for (const id of ["immutable_train_eval_snapshots", "natural_question_wording", "no_answer_prefix_leakage", "human_or_independent_question_source", "privacy_or_access_control_semantics", "natural_benchmark_baselines_ready"]) {
      if (!checkIds.has(id)) errors.push(`${entry.name}: missing naturalness check ${id}.`);
    }
    for (const id of ["natural_question_wording", "no_answer_prefix_leakage", "human_or_independent_question_source", "natural_benchmark_baselines_ready"]) {
      const row = result.checks?.find((check) => check.id === id);
      if (row?.status !== "fail") errors.push(`${entry.name}: ${id} should fail until the natural benchmark upgrade exists.`);
    }
    if (!Array.isArray(result.required_upgrade_artifacts) || result.required_upgrade_artifacts.length < 5) {
      errors.push(`${entry.name}: naturalness audit must list required upgrade artifacts.`);
    }
    if (!report.includes("Required Upgrade Artifacts") || !report.includes("Template question rate")) {
      errors.push(`${entry.name}: naturalness report must expose question naturalness and upgrade artifacts.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: naturalness audit must be zero-cost.`);
    }
  }
}

async function validateVersionedKbNaturalQuestionRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("versioned-kb-natural-questions-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const examplesPath = path.join(runsDir, entry.name, "natural_candidate_examples.jsonl");
    const auditPath = path.join(runsDir, entry.name, "question_audit.jsonl");
    let result;
    let report;
    let examples;
    let auditRows;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
      examples = await readJsonl(examplesPath);
      auditRows = await readJsonl(auditPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed natural-question generation artifacts.`);
      continue;
    }
    if (result.artifact_type !== "versioned_kb_natural_question_generation") {
      errors.push(`${entry.name}: unexpected natural-question artifact type.`);
    }
    if (!["natural_questions_generated", "dry_run_or_key_missing"].includes(result.status)) {
      errors.push(`${entry.name}: invalid natural-question generation status.`);
    }
    if (examples.length !== Number(result.examples_written) || auditRows.length !== examples.length || examples.length < 20) {
      errors.push(`${entry.name}: natural-question examples/audit rows must match result and include the prototype set.`);
    }
    if (Number(result.aggregate?.template_question_rate) > 0.1) {
      errors.push(`${entry.name}: natural-question template rate should be low.`);
    }
    if (Number(result.aggregate?.snapshot_label_rate) > 0.1) {
      errors.push(`${entry.name}: natural questions should not expose snapshot labels.`);
    }
    if (Number(result.aggregate?.prefix_leakage_rate) > 0.1) {
      errors.push(`${entry.name}: natural-question prefix leakage should stay below 10%.`);
    }
    if (result.claim_boundary?.supports_private_enterprise_kb_claim !== false || result.claim_boundary?.supports_final_student_claim !== false) {
      errors.push(`${entry.name}: natural-question run must not claim private-KB or final-student evidence.`);
    }
    if (result.status === "natural_questions_generated") {
      const ledgerCost = await ledgerRunCost(result.run_id);
      if (Math.abs(ledgerCost - Number(result.run_cost_usd)) > 1e-6) {
        errors.push(`${entry.name}: ledger rows for natural-question run_id do not match run cost.`);
      }
      if (Number(result.llm_budget?.openai_llm_calls) !== 1 || Number(result.llm_budget?.openai_cost_usd) <= 0) {
        errors.push(`${entry.name}: completed natural-question run must record one positive-cost OpenAI call.`);
      }
    }
    if (!report.includes("Versioned KB Natural Question Generation") || !report.includes("Naturalness")) {
      errors.push(`${entry.name}: natural-question report must expose naturalness metrics.`);
    }
    for (const [index, row] of examples.entries()) {
      const label = `${entry.name}.natural_examples:${index + 1}`;
      if (!row.original_question || !row.input?.question || row.input.question === row.original_question) {
        errors.push(`${label}: natural example must preserve original_question and replace input.question.`);
      }
      if (!row.output?.answer_type || !Array.isArray(row.input?.compact_retrieved_evidence_pack)) {
        errors.push(`${label}: natural example must preserve grounded-QA schema.`);
      }
    }
  }
}

async function validateVersionedKbNaturalQuestionEvalRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("versioned-kb-natural-question-eval-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    let result;
    let report;
    let predictions;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
      predictions = await readJsonl(predictionsPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed natural-question eval artifacts.`);
      continue;
    }
    if (result.artifact_type !== "versioned_kb_natural_question_eval") {
      errors.push(`${entry.name}: unexpected natural-question eval artifact type.`);
    }
    if (result.status !== "versioned_kb_natural_question_eval_complete") {
      errors.push(`${entry.name}: natural-question eval should complete.`);
    }
    if (Number(result.examples_total) < 20 || predictions.length !== Number(result.examples_total) * Number(result.systems?.length ?? 0)) {
      errors.push(`${entry.name}: prediction rows must equal examples times systems.`);
    }
    const systemIds = new Set((result.systems ?? []).map((row) => row.id));
    for (const id of ["copy_first_evidence", "snapshot_aware_stale_guard", "lexical_retriever_snapshot_guard"]) {
      if (!systemIds.has(id)) errors.push(`${entry.name}: missing system ${id}.`);
    }
    if (result.key_result?.natural_question_surface_preserved !== true) {
      errors.push(`${entry.name}: source natural-question surface should preserve low template/prefix/snapshot leakage.`);
    }
    if (result.key_result?.naive_overanswers_stale_snapshots !== true || result.key_result?.lexical_guard_handles_stale_snapshots !== true) {
      errors.push(`${entry.name}: natural-question eval must expose stale over-answering and snapshot-guard mitigation.`);
    }
    const naive = result.systems?.find((row) => row.id === "copy_first_evidence");
    const lexical = result.systems?.find((row) => row.id === "lexical_retriever_snapshot_guard");
    if (!(Number(naive?.by_type?.stale_snapshot_abstention?.overall_correct_rate) < 1)) {
      errors.push(`${entry.name}: naive natural-question baseline should fail stale-snapshot cases.`);
    }
    if (Number(lexical?.by_type?.stale_snapshot_abstention?.overall_correct_rate) !== 1) {
      errors.push(`${entry.name}: lexical snapshot guard should handle stale-snapshot cases.`);
    }
    if (result.claim_boundary?.supports_private_enterprise_kb_claim !== false || result.claim_boundary?.supports_final_trained_student_claim !== false) {
      errors.push(`${entry.name}: natural-question eval must not claim private-KB or final-student evidence.`);
    }
    if (!report.includes("Versioned KB Natural Question Eval") || !report.includes("Naturalness Surface")) {
      errors.push(`${entry.name}: natural-question eval report must expose title and naturalness surface.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: natural-question eval must be zero-cost.`);
    }
  }
}

async function validateTrustedDatedSnapshotRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || (!entry.name.startsWith("trusted-dated-kb-snapshot-") && !entry.name.startsWith("trusted-temporal-snapshot-"))) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const datesPath = path.join(runsDir, entry.name, "paper_dates.jsonl");
    let result;
    let rows;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
      rows = await readJsonl(datesPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed trusted dated snapshot artifacts.`);
      continue;
    }
    if (result.snapshot_type !== "trusted_dated_kb_snapshot") errors.push(`${entry.name}: snapshot_type must be trusted_dated_kb_snapshot.`);
    if (result.trusted_temporal_source !== "arxiv_api_published_date") errors.push(`${entry.name}: trusted temporal source must be arxiv_api_published_date.`);
    if (result.llm_budget?.openai_llm_calls !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: trusted dated snapshot must be zero-cost.`);
    }
    if (rows.length !== Number(result.papers_checked)) errors.push(`${entry.name}: paper_dates row count must match papers_checked.`);
    if (Number(result.papers_checked) < 50) errors.push(`${entry.name}: trusted dated snapshot should cover the future-holdout paper set.`);
    if (Number(result.papers_with_trusted_dates) !== Number(result.papers_checked)) {
      errors.push(`${entry.name}: all checked papers must have trusted dates.`);
    }
    for (const row of rows) {
      if (!row.paper_id || row.trusted_temporal_source !== "arxiv_api_published_date" || !row.trusted_publication_date || !row.arxiv_url) {
        errors.push(`${entry.name}: malformed trusted date row for ${row.paper_id ?? "unknown paper"}.`);
        break;
      }
    }
    const claimScope = String(result.evaluation_relevance?.claim_scope ?? "").toLowerCase();
    if (!claimScope.includes("trusted dated") || !claimScope.includes("not a private kb")) {
      errors.push(`${entry.name}: snapshot must state trusted-dated/public-not-private claim scope.`);
    }
  }
}

async function validateCorpusRealismAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("corpus-realism-private-kb-gap-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed corpus realism audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "corpus_realism_private_kb_gap_audit") {
      errors.push(`${entry.name}: unexpected corpus realism artifact type.`);
    }
    if (result.status !== "public_dated_proxy_not_private_kb") {
      errors.push(`${entry.name}: corpus realism audit must preserve the public-proxy/private-KB boundary.`);
    }
    if (result.scorecard?.supports_evolving_public_domain_kb_claim !== true || result.scorecard?.supports_private_enterprise_kb_claim !== false) {
      errors.push(`${entry.name}: corpus realism scorecard must separate public-domain and private-enterprise claims.`);
    }
    if (result.scorecard?.supports_writeback_memory_baseline_claim !== false) {
      errors.push(`${entry.name}: corpus realism audit must not claim WriteBack baseline coverage.`);
    }
    const checkIds = new Set((result.checks ?? []).map((row) => row.id));
    for (const id of ["hf_dataset_available", "trusted_document_dates", "versioned_domain_kb_extension_candidate", "natural_question_wording_probe", "natural_versioned_kb_benchmark", "versioned_private_corpus", "mutable_access_controlled_kb", "writeback_baseline_executable"]) {
      if (!checkIds.has(id)) errors.push(`${entry.name}: missing corpus realism check ${id}.`);
    }
    if (result.scorecard?.supports_versioned_domain_kb_extension_candidate !== true) {
      errors.push(`${entry.name}: corpus realism audit should record the versioned domain-KB extension candidate.`);
    }
    if (result.scorecard?.supports_natural_question_wording_probe !== true) {
      errors.push(`${entry.name}: corpus realism audit should record the natural-question wording probe.`);
    }
    if (result.scorecard?.supports_natural_versioned_kb_benchmark_claim !== false) {
      errors.push(`${entry.name}: corpus realism audit must not claim natural versioned-KB benchmark readiness.`);
    }
    for (const id of ["natural_versioned_kb_benchmark", "versioned_private_corpus", "mutable_access_controlled_kb", "writeback_baseline_executable"]) {
      const row = result.checks?.find((check) => check.id === id);
      if (row?.status !== "fail") errors.push(`${entry.name}: ${id} must fail until a private/writeback corpus extension exists.`);
    }
    if (!Array.isArray(result.private_kb_upgrade_requirements) || result.private_kb_upgrade_requirements.length < 5) {
      errors.push(`${entry.name}: corpus realism audit must list private-KB upgrade requirements.`);
    }
    if (!Array.isArray(result.prohibited_claims) || !result.prohibited_claims.some((claim) => String(claim).includes("private enterprise KBs"))) {
      errors.push(`${entry.name}: corpus realism audit must prohibit private-enterprise proof claims.`);
    }
    if (!report.includes("Private-KB Upgrade Requirements") || !report.includes("Supports private enterprise-KB claim: no") || !report.includes("Supports natural versioned-KB benchmark claim: no")) {
      errors.push(`${entry.name}: corpus realism report must expose claim boundary and upgrade requirements.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: corpus realism audit must be zero-cost.`);
    }
  }
}

async function validateVersionedPrivateKbPrototypeRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("versioned-private-kb-prototype-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const examplesPath = path.join(runsDir, entry.name, "candidate_examples.jsonl");
    let result;
    let report;
    let examples;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
      examples = await readJsonl(examplesPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed versioned private-KB prototype artifacts.`);
      continue;
    }
    if (result.artifact_type !== "versioned_private_kb_extension_candidate") {
      errors.push(`${entry.name}: unexpected versioned private-KB prototype type.`);
    }
    if (result.status !== "versioned_domain_kb_candidate_ready") {
      errors.push(`${entry.name}: versioned private-KB prototype should be candidate-ready.`);
    }
    if (result.claim_boundary?.supports_versioned_domain_kb_extension !== true || result.claim_boundary?.supports_private_enterprise_kb_proof !== false) {
      errors.push(`${entry.name}: prototype must support only the versioned-domain extension, not private-enterprise proof.`);
    }
    if (examples.length !== Number(result.examples?.total) || examples.length < 20) {
      errors.push(`${entry.name}: prototype examples must match result total and include at least 20 rows.`);
    }
    const exampleTypes = new Set(examples.map((row) => row.example_type));
    for (const type of ["stable_grounded_answer", "eval_update_grounded_answer", "stale_snapshot_abstention"]) {
      if (!exampleTypes.has(type)) errors.push(`${entry.name}: missing example type ${type}.`);
    }
    for (const row of examples) {
      if (!row.input?.question || !Array.isArray(row.input?.compact_retrieved_evidence_pack) || !row.output?.answer_type) {
        errors.push(`${entry.name}: malformed candidate example ${row.id ?? "unknown"}.`);
        break;
      }
      if (row.output.answer_type === "grounded_answer" && (!Array.isArray(row.output.citations) || row.output.citations.length === 0 || !String(row.output.answer).includes("["))) {
        errors.push(`${entry.name}: grounded example ${row.id ?? "unknown"} must include inline citation.`);
        break;
      }
      if (row.output.answer_type === "abstain" && row.output.citations.length !== 0) {
        errors.push(`${entry.name}: abstention example ${row.id ?? "unknown"} must not cite stale evidence.`);
        break;
      }
    }
    if (!Array.isArray(result.limitations) || !result.limitations.some((item) => String(item).includes("not proof"))) {
      errors.push(`${entry.name}: prototype must preserve private-enterprise limitation.`);
    }
    if (!report.includes("Versioned Private/Domain KB Prototype") || !report.includes("Supports private enterprise-KB proof: no")) {
      errors.push(`${entry.name}: prototype report must expose claim boundary.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: versioned private-KB prototype must be zero-cost.`);
    }
  }
}

async function validateVersionedPrivateKbEvalRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("versioned-private-kb-eval-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    let result;
    let report;
    let predictions;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
      predictions = await readJsonl(predictionsPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed versioned private-KB eval artifacts.`);
      continue;
    }
    if (result.artifact_type !== "versioned_private_kb_eval") {
      errors.push(`${entry.name}: unexpected versioned private-KB eval type.`);
    }
    if (result.status !== "versioned_domain_kb_eval_complete") {
      errors.push(`${entry.name}: versioned private-KB eval should complete.`);
    }
    const systemIds = new Set((result.systems ?? []).map((row) => row.id));
    for (const id of ["copy_first_evidence", "snapshot_aware_stale_guard", "prefix_retriever_snapshot_guard"]) {
      if (!systemIds.has(id)) errors.push(`${entry.name}: missing eval system ${id}.`);
    }
    const naive = result.systems?.find((row) => row.id === "copy_first_evidence");
    const guarded = result.systems?.find((row) => row.id === "prefix_retriever_snapshot_guard");
    if (!(Number(naive?.by_type?.stale_snapshot_abstention?.overall_correct_rate) < 1)) {
      errors.push(`${entry.name}: naive baseline should expose stale-snapshot failures.`);
    }
    if (Number(guarded?.overall_correct_rate) !== 1 || Number(guarded?.by_type?.stale_snapshot_abstention?.overall_correct_rate) !== 1) {
      errors.push(`${entry.name}: prefix retriever snapshot guard should solve deterministic prototype cases.`);
    }
    if (predictions.length !== Number(result.examples_total) * Number(result.systems?.length ?? 0)) {
      errors.push(`${entry.name}: prediction rows must equal examples times systems.`);
    }
    if (!report.includes("Versioned Private/Domain KB Eval") || !report.includes("Stale Snapshot Slice")) {
      errors.push(`${entry.name}: eval report must expose stale snapshot results.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: versioned private-KB eval must be zero-cost.`);
    }
  }
}

async function validateQwen3bSyntaxOnlyRejectionAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen3b-syntax-only-rejection-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen3B syntax-only rejection audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen3b_syntax_only_rejection_audit") {
      errors.push(`${entry.name}: unexpected syntax-only rejection audit artifact type.`);
    }
    if (result.status !== "syntax_only_result_rejected") {
      errors.push(`${entry.name}: syntax-only fixture must be rejected.`);
    }
    if (result.fixture?.expected_status !== "qwen3b_negative_ready_for_pareto_update" || result.fixture?.observed_status !== result.fixture.expected_status) {
      errors.push(`${entry.name}: syntax-only fixture must observe the negative integration status.`);
    }
    if (result.fixture?.cleanup_removed !== true) {
      errors.push(`${entry.name}: syntax-only audit must remove temporary fixture directories.`);
    }
    if (Number(result.metrics_used?.inline_citation_rate) < 0.99 || Number(result.metrics_used?.synthetic_answer_support_rate) >= 0.65) {
      errors.push(`${entry.name}: syntax-only audit must combine perfect syntax with weak support.`);
    }
    if (result.observed_integration?.target_comparison?.meets_minimum_acceptance !== false) {
      errors.push(`${entry.name}: syntax-only audit must prove minimum acceptance is false.`);
    }
    if (!report.includes("Qwen 3B Syntax-Only Rejection Audit") || !report.includes("100.0%")) {
      errors.push(`${entry.name}: syntax-only audit report must expose the perfect syntax negative case.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: syntax-only audit must be zero cost.`);
    }
  }
}

async function validateQwen3bOutcomeDecisionPolicyRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen3b-outcome-decision-policy-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen3B outcome decision policy artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen3b_outcome_decision_policy") {
      errors.push(`${entry.name}: unexpected Qwen3B outcome decision policy artifact type.`);
    }
    if (result.status !== "qwen3b_outcome_policy_preregistered") {
      errors.push(`${entry.name}: outcome policy must be preregistered.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: outcome policy must be zero cost.`);
    }
    const statuses = new Set((result.decision_tree ?? []).map((row) => row.status));
    for (const status of ["waiting_for_qwen3b_predictions", "waiting_for_qwen3b_paid_judge", "qwen3b_negative_ready_for_pareto_update", "qwen3b_minimum_positive_ready_for_pareto_update", "qwen3b_strong_positive_ready_for_pareto_update"]) {
      if (!statuses.has(status)) errors.push(`${entry.name}: missing decision-tree status ${status}.`);
    }
    const hardRejections = (result.preregistered_acceptance_thresholds?.hard_rejections ?? []).join(" ").toLowerCase();
    if (!hardRejections.includes("citation syntax") || !hardRejections.includes("70% answer rate") || !hardRejections.includes("paid grounded-correctness")) {
      errors.push(`${entry.name}: hard rejections must cover syntax-only, coverage collapse, and missing paid judge.`);
    }
    const escalation = (result.model_escalation_policy?.larger_model_allowed_only_if ?? []).join(" ").toLowerCase();
    if (!escalation.includes("failure-mode audit") || !escalation.includes("$100") || !escalation.includes("decision-log")) {
      errors.push(`${entry.name}: escalation policy must require failure-mode audit, budget, and decision log.`);
    }
    const prohibited = (result.model_escalation_policy?.prohibited_escalations ?? []).join(" ").toLowerCase();
    if (!prohibited.includes("cutting-edge gpu") || !prohibited.includes("tiny/local model outputs")) {
      errors.push(`${entry.name}: prohibited escalation policy must reject cutting-edge GPU metric chasing and tiny/local labels.`);
    }
    if (!report.includes("Qwen 3B Outcome Decision Policy") || !report.includes("Hard Rejections")) {
      errors.push(`${entry.name}: outcome policy report must expose title and hard rejections.`);
    }
  }
}

async function validateQwen3bLocalControlNonSubstitutionAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen3b-local-control-non-substitution-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen3B local-control non-substitution audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen3b_local_control_non_substitution_audit") {
      errors.push(`${entry.name}: unexpected local-control non-substitution artifact type.`);
    }
    if (result.status !== "local_controls_rejected_as_final_qwen_smoke") {
      errors.push(`${entry.name}: local controls must be rejected as final Qwen smoke substitutes.`);
    }
    if (result.final_smoke_run_id !== "joint-action-qwen3b-smoke-eval-v1") {
      errors.push(`${entry.name}: audit must reserve the canonical final Qwen smoke run id.`);
    }
    if (!Array.isArray(result.controls) || result.controls.length < 2) {
      errors.push(`${entry.name}: audit must cover the base and citation-repair local Qwen controls.`);
    }
    for (const id of ["local-qwen3b-base-control-joint-action-12-v1", "local-qwen3b-citation-repair-local-qwen3b-base-control-joint-action-12-v1", "local-qwen3b-base-control-joint-action-final-window-v2", "local-qwen3b-citation-repair-local-qwen3b-base-control-final-window-v2"]) {
      const control = result.controls?.find((row) => row.run_id === id);
      if (!control) {
        errors.push(`${entry.name}: missing control ${id}.`);
        continue;
      }
      if (control.accepted_as_final_smoke !== false) {
        errors.push(`${entry.name}: ${id} must not be accepted as final smoke.`);
      }
      if (!Array.isArray(control.substitution_blockers) || control.substitution_blockers.length < 4) {
        errors.push(`${entry.name}: ${id} must expose concrete substitution blockers.`);
      }
      if (!control.substitution_blockers.includes("no_trained_adapter") || !control.substitution_blockers.includes("missing_smoke_manifest")) {
        errors.push(`${entry.name}: ${id} must fail on trained adapter and smoke manifest blockers.`);
      }
      if (control.production_gate_observations?.integrity_status === "ready_for_paid_judge") {
        errors.push(`${entry.name}: ${id} must not pass prediction integrity as judge-ready.`);
      }
      if (control.production_gate_observations?.remote_provenance_status === "remote_provenance_ready_for_judge") {
        errors.push(`${entry.name}: ${id} must not pass remote provenance.`);
      }
      if (control.production_gate_observations?.temporary_gate_dirs_removed !== true) {
        errors.push(`${entry.name}: ${id} must remove temporary production-gate directories.`);
      }
    }
    const required = result.required_final_smoke_evidence ?? [];
    if (!required.some((item) => String(item).includes("trained joint-action adapter")) || !required.some((item) => String(item).includes("paid grounded-correctness judge"))) {
      errors.push(`${entry.name}: audit must state trained adapter and paid judge requirements.`);
    }
    if (!report.includes("Qwen 3B Local Control Non-Substitution Audit") || !report.includes("Accepted as final smoke")) {
      errors.push(`${entry.name}: report must expose non-substitution result.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: local-control non-substitution audit must be zero cost.`);
    }
  }
}

async function validateQwen3bPostSmokeProvenanceGuardAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen3b-post-smoke-provenance-guard-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen3B post-smoke provenance guard audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen3b_post_smoke_provenance_guard_audit") {
      errors.push(`${entry.name}: unexpected post-smoke provenance guard artifact type.`);
    }
    if (result.status !== "post_smoke_provenance_guard_verified") {
      errors.push(`${entry.name}: post-smoke provenance guard must be verified.`);
    }
    if (result.packet_run_id !== activeQwen3bPacketRunId) {
      errors.push(`${entry.name}: post-smoke provenance guard must target active Qwen packet.`);
    }
    if (result.observations?.integrity_status !== "ready_for_paid_judge" || Number(result.observations?.integrity_failures) !== 0) {
      errors.push(`${entry.name}: fixture predictions must pass integrity before testing provenance refusal.`);
    }
    if (result.observations?.provenance_status !== "provenance_artifacts_missing") {
      errors.push(`${entry.name}: fixture must fail specifically on missing remote provenance.`);
    }
    if (result.observations?.pipeline_status !== "failed_remote_provenance_not_ready") {
      errors.push(`${entry.name}: post-smoke pipeline must stop on remote provenance failure.`);
    }
    if (result.observations?.dry_judge_result_created !== false || result.observations?.paid_judge_result_created !== false) {
      errors.push(`${entry.name}: provenance guard audit must not create dry or paid judge artifacts.`);
    }
    if (result.fixture?.temporary_fixture_runs_removed !== true) {
      errors.push(`${entry.name}: temporary fixture runs must be removed.`);
    }
    if (!report.includes("Post-Smoke Provenance Guard Audit") || !report.includes("Dry judge result created")) {
      errors.push(`${entry.name}: report must expose provenance guard observations.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: post-smoke provenance guard audit must be zero cost.`);
    }
  }
}

async function validateQwen3bParetoUpdateContractAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen3b-pareto-update-contract-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen3B Pareto update contract audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen3b_pareto_update_contract_audit") {
      errors.push(`${entry.name}: unexpected Qwen3B Pareto update contract artifact type.`);
    }
    if (result.status !== "qwen3b_pareto_update_contract_verified") {
      errors.push(`${entry.name}: Qwen3B Pareto update contract must be verified.`);
    }
    const checks = result.contract_checks ?? {};
    for (const [key, value] of Object.entries({
      existing_rows_preserved: true,
      original_frontier_ids_known: true,
      qwen_row_schema_ok: true,
      no_duplicate_system_ids_after_insert: true,
      qwen_row_included_after_insert: true,
      qwen_row_comparable_for_frontier: true,
      integration_statuses_covered: true,
      outcome_policy_preregistered: true,
    })) {
      if (checks[key] !== value) errors.push(`${entry.name}: contract check ${key} must be ${value}.`);
    }
    if (result.synthetic_qwen_row?.id !== "qwen3b_joint_action_smoke" || result.synthetic_qwen_row?.source_run_id !== "joint-action-qwen3b-smoke-eval-v1") {
      errors.push(`${entry.name}: synthetic Qwen row must use the canonical row and smoke ids.`);
    }
    if (Number(result.table_delta?.updated_system_count) !== Number(result.table_delta?.original_system_count) + 1) {
      errors.push(`${entry.name}: table delta must add exactly one Qwen row.`);
    }
    if (!Array.isArray(result.required_after_real_qwen_integration) || !result.required_after_real_qwen_integration.some((item) => String(item).includes("pareto_row_to_add"))) {
      errors.push(`${entry.name}: contract must require using qwen3b-result-integration.pareto_row_to_add.`);
    }
    if (!report.includes("Qwen 3B Pareto Update Contract Audit") || !report.includes("Existing rows preserved")) {
      errors.push(`${entry.name}: Pareto contract report must expose table-preservation checks.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: Pareto contract audit must be zero cost.`);
    }
  }
}

async function validatePostQwenRegenerationContractAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("post-qwen-regeneration-contract-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed post-Qwen regeneration contract audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "post_qwen_regeneration_contract_audit") {
      errors.push(`${entry.name}: unexpected post-Qwen regeneration contract artifact type.`);
    }
    if (result.status !== "post_qwen_regeneration_contract_ready") {
      errors.push(`${entry.name}: post-Qwen regeneration contract must be ready.`);
    }
    if (result.source_artifacts?.qwen_pareto_update_contract_audit_run_id !== "qwen3b-pareto-update-contract-audit-2026-06-27-v1") {
      errors.push(`${entry.name}: must bind to the current Qwen Pareto update contract audit.`);
    }
    if (result.source_artifacts?.final_evidence_checklist_run_id !== "final-evidence-checklist-qwen3b-2026-06-26-v1") {
      errors.push(`${entry.name}: must audit the current final evidence checklist.`);
    }
    if (result.command_covers_all_required !== true) {
      errors.push(`${entry.name}: final checklist regeneration command must cover every required paper artifact script.`);
    }
    const requiredScripts = new Set(result.required_regeneration_scripts ?? []);
    for (const script of [
      "grounded-qa-distillation-total-budget.mjs",
      "grounded-qa-distillation-cost-coverage-pareto.mjs",
      "grounded-qa-distillation-amortization-break-even.mjs",
      "grounded-qa-distillation-distillation-loss-accounting.mjs",
      "grounded-qa-distillation-paper-readiness-gate.mjs",
      "grounded-qa-distillation-final-claim-acceptance-matrix.mjs",
      "grounded-qa-distillation-final-evidence-checklist.mjs",
      "grounded-qa-distillation-manuscript-evidence-map.mjs",
      "grounded-qa-distillation-manuscript-draft.mjs",
      "grounded-qa-distillation-reviewer-risk-audit.mjs",
    ]) {
      if (!requiredScripts.has(script)) errors.push(`${entry.name}: missing required regeneration script ${script}.`);
      if (result.command_coverage?.[script] !== true) errors.push(`${entry.name}: final checklist command does not cover ${script}.`);
    }
    const freshness = result.freshness_policy ?? {};
    if (!Array.isArray(freshness.current_artifacts) || freshness.current_artifacts.length < 10) {
      errors.push(`${entry.name}: freshness policy must enumerate budget, readiness, claim, evidence, manuscript, and risk artifacts.`);
    }
    if (freshness.qwen_ready_for_pareto_update === true && freshness.required_artifacts_generated_after_qwen !== true) {
      errors.push(`${entry.name}: once Qwen is ready, all downstream paper artifacts must be regenerated after Qwen integration.`);
    }
    if (!Array.isArray(result.required_order_after_real_qwen) || !result.required_order_after_real_qwen.some((item) => String(item).includes("Regenerate manuscript evidence map"))) {
      errors.push(`${entry.name}: required post-Qwen order must include manuscript regeneration.`);
    }
    if (!report.includes("Post-Qwen Regeneration Contract Audit") || !report.includes("Command Coverage") || !report.includes("Freshness Policy")) {
      errors.push(`${entry.name}: report must expose title, command coverage, and freshness policy.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: post-Qwen regeneration contract audit must be zero cost.`);
    }
  }
}

async function validateGpuLaunchAttemptRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("gpu-launch-attempt-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed GPU launch attempt artifacts.`);
      continue;
    }
    if (!Array.isArray(result.attempted_backends) || !result.attempted_backends.length) {
      errors.push(`${entry.name}: missing attempted backend records.`);
    }
    for (const attempt of result.attempted_backends ?? []) {
      if (!attempt.provider || !attempt.status) errors.push(`${entry.name}: malformed backend attempt.`);
      if (Number(attempt.actual_cost_usd) !== 0) {
        errors.push(`${entry.name}: launch attempt artifact should only record zero-cost failed/not-created attempts.`);
      }
    }
    if (Number(result.budget?.actual_external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: failed launch attempt must not record actual external compute spend.`);
    }
  }
}

async function validateHuggingFaceQwen3bSmokeLaunchAttemptRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("huggingface-qwen3b-smoke-launch-attempt-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed Hugging Face Qwen launch attempt artifacts.`);
      continue;
    }
    if (result.provider !== "huggingface_jobs") {
      errors.push(`${entry.name}: launch attempt must identify Hugging Face Jobs as provider.`);
    }
    if (result.status !== "failed_before_creation" || result.backend_job_created !== false) {
      errors.push(`${entry.name}: launch attempt must remain failed-before-creation unless real job artifacts exist.`);
    }
    if (result.failure?.class !== "auth_permission" || !String(result.failure?.evidence_excerpt ?? "").includes("job.write")) {
      errors.push(`${entry.name}: launch attempt must record the job.write permission blocker.`);
    }
    if (result.conclusion?.not_enough_money_proven !== false) {
      errors.push(`${entry.name}: launch attempt must not claim HF balance status from a permission failure.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: failed HF launch attempt must be zero actual cost.`);
    }
  }
}

async function validatePrimeAuthDiagnosisRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("prime-auth-diagnosis-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      await fs.access(reportPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed Prime auth diagnosis artifacts.`);
      continue;
    }
    if (result.diagnosis?.saved_api_key_present !== true) {
      errors.push(`${entry.name}: Prime auth diagnosis should distinguish stale key from missing key.`);
    }
    if (result.diagnosis?.whoami_error_class !== "api_key_unauthorized") {
      errors.push(`${entry.name}: Prime auth diagnosis must record the authorization failure class.`);
    }
    if (!Array.isArray(result.conclusion?.not_yet_tested) || !result.conclusion.not_yet_tested.includes("Prime account balance")) {
      errors.push(`${entry.name}: Prime auth diagnosis must avoid claiming balance status before auth succeeds.`);
    }
    if (Number(result.budget?.actual_external_compute_cost_usd) !== 0 || Number(result.budget?.openai_cost_delta_usd) !== 0) {
      errors.push(`${entry.name}: Prime auth diagnosis must be zero-cost.`);
    }
  }
}

async function validatePrimeCliAuthRecheckRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^prime-cli-(upgrade-)?auth-recheck-/.test(entry.name)) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Prime CLI auth recheck artifacts.`);
      continue;
    }
    if (result.artifact_type !== "prime_cli_auth_recheck") {
      errors.push(`${entry.name}: unexpected Prime CLI auth recheck artifact type.`);
    }
    if (!["auth_blocked_after_cli_upgrade", "auth_blocked_current_key", "auth_check_passed"].includes(result.status)) {
      errors.push(`${entry.name}: unexpected Prime CLI auth recheck status.`);
    }
    if (!result.cli_version) {
      errors.push(`${entry.name}: Prime CLI auth recheck must record the CLI version.`);
    }
    for (const command of ["version", "whoami", "teams", "availability"]) {
      if (!result.checks?.[command]?.command) errors.push(`${entry.name}: missing Prime ${command} check.`);
    }
    if (["auth_blocked_after_cli_upgrade", "auth_blocked_current_key"].includes(result.status)) {
      const blocked = [result.checks?.whoami, result.checks?.teams, result.checks?.availability]
        .some((check) => check?.error_class === "api_key_unauthorized");
      if (!blocked) errors.push(`${entry.name}: auth-blocked status must include an unauthorized Prime command.`);
      if (!Array.isArray(result.conclusion?.not_proven) || !result.conclusion.not_proven.includes("Prime account balance")) {
        errors.push(`${entry.name}: auth-blocked recheck must not claim balance status.`);
      }
    }
    if (!report.includes("Prime CLI version") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: Prime CLI auth recheck report must expose version and zero-cost status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: Prime CLI auth recheck must be zero-cost.`);
    }
  }
}

async function validatePrimeAuthRepairHandoffRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("prime-auth-repair-handoff-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    let rawResult;
    try {
      rawResult = await fs.readFile(resultPath, "utf8");
      result = JSON.parse(rawResult);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Prime auth repair handoff artifacts.`);
      continue;
    }
    if (result.artifact_type !== "prime_auth_repair_handoff") {
      errors.push(`${entry.name}: unexpected artifact_type.`);
    }
    if (!["waiting_for_hidden_prime_key", "prime_key_env_missing", "prime_auth_repaired_gates_refreshed", "prime_auth_repair_attempted_still_blocked"].includes(result.status)) {
      errors.push(`${entry.name}: unexpected Prime auth repair handoff status.`);
    }
    if (/(pit_[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|PRIME_API_KEY=[^\s<]+)/.test(rawResult + report)) {
      errors.push(`${entry.name}: handoff artifacts must not serialize Prime secrets.`);
    }
    if (!result.next_commands?.collect_hidden_key?.includes("ask-secret.sh") || !result.next_commands?.apply_and_refresh_gates?.includes("--apply=true")) {
      errors.push(`${entry.name}: handoff must record hidden-input and explicit-apply commands.`);
    }
    const checks = result.checks ?? [];
    for (const id of ["secret_env_path_recorded", "apply_requires_explicit_flag", "prime_api_key_env_present_when_applying", "config_write_safe_when_attempted", "prime_config_mode_private", "budget_under_cap_before_launch", "no_pod_creation_performed"]) {
      if (!checks.some((row) => row.id === id)) errors.push(`${entry.name}: missing handoff check ${id}.`);
    }
    const noPod = checks.find((row) => row.id === "no_pod_creation_performed");
    if (noPod?.status !== "pass") {
      errors.push(`${entry.name}: auth repair handoff must not create a pod.`);
    }
    if (Number(result.budget?.max_budget_usd) !== 100 || Number(result.budget?.actual_total_spend_usd) > 100) {
      errors.push(`${entry.name}: auth repair handoff must preserve the $100 budget cap.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: Prime auth repair handoff must be zero actual cost.`);
    }
    if (!report.includes("Prime Auth Repair Handoff") || !report.includes("hidden input")) {
      errors.push(`${entry.name}: handoff report must expose hidden-input repair instructions.`);
    }
  }
}

async function validatePrimeAuthPriceGateRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("prime-auth-price-gate-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Prime auth/price gate artifacts.`);
      continue;
    }
    if (result.artifact_type !== "prime_auth_price_gate") {
      errors.push(`${entry.name}: unexpected artifact_type.`);
    }
    if (!["auth_and_live_price_verified", "auth_or_price_blocked"].includes(result.status)) {
      errors.push(`${entry.name}: unexpected Prime auth/price gate status.`);
    }
    const checks = result.checks ?? [];
    for (const id of ["prime_whoami_authenticated", "prime_wallet_accessible", "prime_availability_accessible", "gpu_resource_available", "estimated_total_under_budget"]) {
      if (!checks.some((row) => row.id === id)) errors.push(`${entry.name}: missing check ${id}.`);
    }
    if (result.status === "auth_and_live_price_verified" && !checks.every((row) => row.status === "pass")) {
      errors.push(`${entry.name}: verified status requires all checks to pass.`);
    }
    if (Number(result.budget_gate?.max_budget_usd) !== 100) {
      errors.push(`${entry.name}: gate must preserve the $100 budget cap.`);
    }
    if (Number(result.budget_gate?.estimated_total_after_gpu_and_judge_usd) > 100 && result.status === "auth_and_live_price_verified") {
      errors.push(`${entry.name}: verified status must stay under budget.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: Prime auth/price gate must be zero actual cost.`);
    }
    if (!report.includes("Prime Auth/Price Gate") || !report.includes("Budget Gate")) {
      errors.push(`${entry.name}: report must expose auth/price and budget gates.`);
    }
  }
}

async function validatePrimeQwen3bSmokeSshPreflightAttemptRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("prime-qwen3b-smoke-ssh-preflight-attempt-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Prime SSH preflight attempt artifacts.`);
      continue;
    }
    if (result.artifact_type !== "prime_qwen3b_smoke_ssh_preflight_attempt") {
      errors.push(`${entry.name}: unexpected artifact_type.`);
    }
    if (result.status !== "failed_after_pod_creation_ssh_denied") {
      errors.push(`${entry.name}: expected SSH-denied failure status.`);
    }
    if (result.decision?.paper_result !== "not_model_evidence") {
      errors.push(`${entry.name}: failed SSH preflight must not be treated as model evidence.`);
    }
    if (result.training_artifacts?.predictions_jsonl_created !== false || result.training_artifacts?.smoke_manifest_json_created !== false) {
      errors.push(`${entry.name}: SSH preflight failure must not claim Qwen smoke artifacts.`);
    }
    if (Number(result.wallet_evidence?.amount_usd) <= 0 || Number(result.budget?.external_compute_cost_usd) !== Number(result.wallet_evidence?.amount_usd)) {
      errors.push(`${entry.name}: must record positive wallet debit as external compute cost.`);
    }
    if (Number(result.budget?.total_actual_after_attempt_usd) > Number(result.budget?.max_budget_usd)) {
      errors.push(`${entry.name}: failed attempt must preserve the $100 budget cap.`);
    }
    const stepStatuses = new Map((result.attempted_steps ?? []).map((row) => [row.id, row.status]));
    if (stepStatuses.get("pod_create") !== "created" || stepStatuses.get("ssh_preflight") !== "failed" || stepStatuses.get("terminate") !== "passed") {
      errors.push(`${entry.name}: attempt must record pod creation, SSH failure, and termination.`);
    }
    if (!report.includes("failed_after_pod_creation_ssh_denied") || !report.includes("No Qwen training ran")) {
      errors.push(`${entry.name}: report must expose failure status and no-training boundary.`);
    }
  }
}

async function validateRemoteBackendReadinessGateRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("remote-backend-readiness-gate-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed remote backend readiness gate artifacts.`);
      continue;
    }
    if (result.artifact_type !== "remote_backend_readiness_gate") {
      errors.push(`${entry.name}: unexpected artifact type.`);
    }
    if (!["remote_backend_ready_for_qwen3b_smoke", "remote_backend_blocked"].includes(result.status)) {
      errors.push(`${entry.name}: unexpected remote backend readiness status.`);
    }
    if (!result.inputs?.prime_gate_run_id || !result.inputs?.prime_launch_plan_run_id || !result.inputs?.hf_launch_plan_run_id || !result.inputs?.hf_attempt_run_id) {
      errors.push(`${entry.name}: remote backend gate must record input run ids.`);
    }
    const checks = result.checks ?? [];
    for (const id of ["budget_under_cap_now", "prime_cli_authenticated_now", "prime_live_price_gate_verified", "hf_cli_authenticated_now", "hf_jobs_permission_verified", "any_backend_ready_for_qwen3b_smoke"]) {
      if (!checks.some((row) => row.id === id)) errors.push(`${entry.name}: missing check ${id}.`);
    }
    if (Number(result.budget_gate?.max_budget_usd) !== 100 || Number(result.budget_gate?.actual_total_spend_usd) <= 0) {
      errors.push(`${entry.name}: remote backend gate must preserve current $100 budget context.`);
    }
    if (result.status === "remote_backend_ready_for_qwen3b_smoke" && !checks.some((row) => row.id === "any_backend_ready_for_qwen3b_smoke" && row.status === "pass")) {
      errors.push(`${entry.name}: ready status requires a ready backend check.`);
    }
    if (result.status === "remote_backend_blocked" && !checks.some((row) => row.status === "fail")) {
      errors.push(`${entry.name}: blocked status must include at least one failing check.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: remote backend readiness gate must be zero actual cost.`);
    }
    if (!report.includes("Remote Backend Readiness Gate") || !report.includes("Backend Summary") || !report.includes("Budget Gate") || !report.includes("Inputs:")) {
      errors.push(`${entry.name}: report must expose backend and budget gates.`);
    }
  }
}

async function validateCitationContractRepairRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("citation-contract-repair-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    let result;
    let predictions;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed citation contract repair artifacts.`);
      continue;
    }
    if (result.calls_made !== 0 || Number(result.run_cost_usd) !== 0) {
      errors.push(`${entry.name}: citation contract repair must be zero-call and zero-cost.`);
    }
    if (result.eval_examples !== predictions.length) errors.push(`${entry.name}: eval_examples does not match predictions.`);
    if (result.repair_summary?.repaired_inline_citations !== result.repair_summary?.missing_inline_citations_before) {
      errors.push(`${entry.name}: repaired inline citation count must match missing inline count before repair.`);
    }
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !row.prediction?.answer_type || !row.source_prediction?.answer_type || !row.metadata) {
        errors.push(`${label}: missing prediction/source/metadata.`);
      }
      if (Number(row.cost_usd) !== 0) errors.push(`${label}: citation contract repair prediction must be zero-cost.`);
      if (row.prediction?.answer_type === "grounded_answer") {
        if (!Array.isArray(row.prediction.citations)) {
          errors.push(`${label}: grounded predictions must expose a citations array, even when citation use is wrong.`);
        }
        if (!Number.isFinite(Number(row.scores.inline_citation_rate))) {
          errors.push(`${label}: grounded predictions must record inline_citation_rate.`);
        }
      }
    }
  }
}

async function validatePolicySelectorRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("policy-selector-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    let result;
    let predictions;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed policy selector artifacts.`);
      continue;
    }
    if (result.cost?.llm_calls !== 0 || Number(result.cost?.run_cost_usd) !== 0) {
      errors.push(`${entry.name}: policy selector must be zero-call and zero-cost.`);
    }
    if (result.eval_examples !== predictions.length) errors.push(`${entry.name}: eval_examples does not match predictions.`);
    const mixTotal = Object.values(result.policy_mix ?? {}).reduce((total, value) => total + Number(value), 0);
    if (mixTotal !== predictions.length) errors.push(`${entry.name}: policy mix does not sum to predictions.`);
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !row.selected_policy || !row.prediction?.answer_type || !row.scores || !row.candidate_summary) {
        errors.push(`${label}: missing selector fields.`);
      }
      if (row.prediction?.answer_type === "grounded_answer") {
        for (const citation of row.prediction.citations ?? []) {
          if (!row.prediction.answer?.includes(`[${citation}]`)) errors.push(`${label}: missing inline citation [${citation}].`);
        }
      }
    }
  }
}

async function validateLocalQwen3bBaseControlRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("local-qwen3b-base-control-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let predictions;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed local Qwen 3B base-control artifacts.`);
      continue;
    }
    if (result.control_type !== "local_qwen3b_base_no_training") errors.push(`${entry.name}: unexpected control_type.`);
    if (result.trained_adapter !== null) errors.push(`${entry.name}: base control must not claim a trained adapter.`);
    if (result.cost?.openai_calls !== 0 || Number(result.cost?.openai_cost_usd) !== 0 || Number(result.cost?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: local Qwen 3B base control must be zero-call and zero-cost.`);
    }
    if (result.eval?.examples !== predictions.length) errors.push(`${entry.name}: eval.examples does not match predictions.`);
    if (!report.includes("not a substitute for the missing trained Qwen 3B smoke")) {
      errors.push(`${entry.name}: report must preserve the trained-smoke caveat.`);
    }
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !row.prediction?.answer_type || !row.reference?.answer_type || !row.scores) {
        errors.push(`${label}: missing prediction, reference, or scores.`);
      }
      if (row.metadata?.trained_adapter !== null) errors.push(`${label}: prediction metadata must not claim a trained adapter.`);
      if (row.prediction?.answer_type === "grounded_answer") {
        if (!Array.isArray(row.prediction.citations)) {
          errors.push(`${label}: grounded predictions must expose a citations array, even when citation use is wrong.`);
        }
        if (!Number.isFinite(Number(row.scores.inline_citation_rate))) {
          errors.push(`${label}: grounded predictions must record inline_citation_rate.`);
        }
      }
    }
  }
}

async function validateLocalQwen3bCitationRepairRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("local-qwen3b-citation-repair-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let predictions;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed local Qwen 3B citation repair artifacts.`);
      continue;
    }
    if (result.artifact_type !== "local_qwen3b_citation_contract_repair") {
      errors.push(`${entry.name}: unexpected local Qwen 3B repair artifact_type.`);
    }
    if (!String(result.source_run_id ?? "").startsWith("local-qwen3b-base-control-")) {
      errors.push(`${entry.name}: repair must point to a local Qwen 3B base-control source run.`);
    }
    if (result.trained_adapter !== null) errors.push(`${entry.name}: repair control must not claim a trained adapter.`);
    if (result.cost?.openai_calls !== 0 || Number(result.cost?.openai_cost_usd) !== 0 || Number(result.cost?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: local Qwen 3B citation repair must be zero-call and zero-cost.`);
    }
    if (result.eval?.examples !== predictions.length) errors.push(`${entry.name}: eval.examples does not match predictions.`);
    if (Number(result.eval?.inline_citation_rate) < Number(result.source_eval?.inline_citation_rate)) {
      errors.push(`${entry.name}: citation repair should not lower inline citation rate.`);
    }
    if (!report.includes("not trained-student evidence") || !report.includes("Citation formatting metrics must be reported separately")) {
      errors.push(`${entry.name}: report must preserve syntax-vs-grounding caveats.`);
    }
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !row.prediction?.answer_type || !row.reference?.answer_type || !row.scores || !row.source_prediction) {
        errors.push(`${label}: missing prediction, source prediction, reference, or scores.`);
      }
      if (row.metadata?.trained_adapter !== null) errors.push(`${label}: prediction metadata must not claim a trained adapter.`);
      if (row.prediction?.answer_type === "grounded_answer" && !Number.isFinite(Number(row.scores.inline_citation_rate))) {
        errors.push(`${label}: grounded repaired predictions must record inline_citation_rate.`);
      }
    }
  }
}

async function validateQwenStructureRepairRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-") || !entry.name.endsWith("-structure-repair")) continue;
    const runPath = path.join(runsDir, entry.name);
    const resultPath = path.join(runPath, "result.json");
    const predictionsPath = path.join(runPath, "predictions.jsonl");
    const reportPath = path.join(runPath, "report.md");
    const manifestPath = path.join(runPath, "smoke_manifest.json");
    let result;
    let predictions;
    let report;
    let manifest;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
      report = await fs.readFile(reportPath, "utf8");
      manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen structure-repair artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen_deterministic_structure_and_citation_repair") {
      errors.push(`${entry.name}: unexpected structure-repair artifact_type.`);
    }
    if (!result.source_run_id || !result.packet_run_id) {
      errors.push(`${entry.name}: structure repair must preserve source and packet run ids.`);
    }
    if (result.cost?.openai_calls !== 0 || Number(result.cost?.openai_cost_usd) !== 0 || Number(result.cost?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: structure repair must be zero-call and zero-cost.`);
    }
    if (result.eval?.examples !== predictions.length) errors.push(`${entry.name}: eval.examples does not match predictions.`);
    if (Number(result.eval?.inline_citation_rate) < Number(result.source_eval?.inline_citation_rate)) {
      errors.push(`${entry.name}: structure repair should not lower inline citation rate.`);
    }
    if (!result.repair_summary || Number(result.repair_summary.recovered_from_raw_output) <= 0) {
      errors.push(`${entry.name}: structure repair must report recovered raw outputs.`);
    }
    if (manifest.derived_scaffold !== "qwen_structure_and_citation_repair" || manifest.push_to_hub !== false) {
      errors.push(`${entry.name}: structure-repair manifest must identify scaffold and keep push_to_hub false.`);
    }
    if (!report.includes("does not prove answer support")) {
      errors.push(`${entry.name}: report must preserve support-judging caveat.`);
    }
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !row.prediction?.answer_type || !row.reference?.answer_type || !row.scores || !row.source_prediction || !Object.hasOwn(row, "loose_prediction")) {
        errors.push(`${label}: missing prediction, source prediction, loose prediction, reference, or scores.`);
      }
      if (row.prediction?.answer_type === "grounded_answer") {
        if (!Array.isArray(row.prediction.citations) || !row.prediction.citations.length) {
          errors.push(`${label}: structure-repaired grounded answers must have citations.`);
        }
        if (Number(row.scores.inline_citation_rate) !== 1) {
          errors.push(`${label}: structure-repaired grounded answers must have full inline citation coverage.`);
        }
      }
    }
  }
}

async function validateVerifierSelectorRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("verifier-selector-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    const trainPredictionsPath = path.join(runsDir, entry.name, "train_predictions.jsonl");
    const modelPath = path.join(runsDir, entry.name, "verifier-model.json");
    let result;
    let predictions;
    let trainPredictions;
    let model;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
      trainPredictions = await readJsonl(trainPredictionsPath);
      model = JSON.parse(await fs.readFile(modelPath, "utf8"));
    } catch {
      errors.push(`${entry.name}: missing or malformed verifier selector artifacts.`);
      continue;
    }
    if (result.cost?.llm_calls !== 0 || Number(result.cost?.run_cost_usd) !== 0) {
      errors.push(`${entry.name}: verifier selector must be zero-call and zero-cost.`);
    }
    if (result.eval?.examples !== predictions.length) errors.push(`${entry.name}: eval example count does not match predictions.`);
    if (result.train?.examples !== trainPredictions.length) errors.push(`${entry.name}: train example count does not match train predictions.`);
    if (!Array.isArray(model.feature_names) || !model.feature_names.length || !model.weights) {
      errors.push(`${entry.name}: verifier model is missing feature names or weights.`);
    }
    const forbiddenLeakageFeatures = ["citation_precision_proxy", "citation_recall_proxy"];
    for (const feature of forbiddenLeakageFeatures) {
      if (model.feature_names?.includes(feature)) errors.push(`${entry.name}: verifier model includes leakage feature ${feature}.`);
    }
    for (const [index, row] of [...trainPredictions, ...predictions].entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !row.selected_policy || !row.prediction?.answer_type || !row.scores || !row.candidate_summary) {
        errors.push(`${label}: missing verifier selector fields.`);
      }
      if (!Number.isFinite(Number(row.verifier_score))) errors.push(`${label}: missing numeric verifier score.`);
      if (row.prediction?.answer_type === "grounded_answer") {
        for (const citation of row.prediction.citations ?? []) {
          if (!row.prediction.answer?.includes(`[${citation}]`)) errors.push(`${label}: missing inline citation [${citation}].`);
        }
      }
    }
  }
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function validateCandidatePoolOracleRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("candidate-pool-oracle-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed candidate-pool oracle artifacts.`);
      continue;
    }
    if (result.artifact_type !== "candidate_pool_oracle") {
      errors.push(`${entry.name}: artifact_type must be candidate_pool_oracle.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: candidate-pool oracle must be zero-cost.`);
    }
    if (Number(result.scope?.examples) !== 69 || Number(result.oracle?.examples) !== 69) {
      errors.push(`${entry.name}: oracle must cover the 69-example final window.`);
    }
    if (result.oracle?.meets_70pct_answer_rate !== false || Number(result.oracle?.answer_rate) >= 0.7) {
      errors.push(`${entry.name}: current candidate-pool oracle must expose selection-only coverage failure.`);
    }
    if (result.training_implication?.selection_only_sufficient !== false || !String(result.training_implication?.next_data_change ?? "").includes("repair")) {
      errors.push(`${entry.name}: oracle must require repair/regeneration training, not selection-only training.`);
    }
    if (!report.includes("Selection-only candidate pool cannot meet") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must state the selection-only failure and zero-cost status.`);
    }
  }
}

async function validateCandidateSelectorCrossWindowRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("candidate-selector-cross-window-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    let result;
    let report;
    let predictions;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
      predictions = await readJsonl(predictionsPath);
    } catch {
      errors.push(`${entry.name}: missing or malformed candidate-selector cross-window artifacts.`);
      continue;
    }
    if (result.artifact_type !== "candidate_selector_cross_window") {
      errors.push(`${entry.name}: artifact_type must be candidate_selector_cross_window.`);
    }
    if (!["selector_transfers_under_coverage", "selector_does_not_transfer_under_coverage"].includes(result.status)) {
      errors.push(`${entry.name}: invalid selector transfer status.`);
    }
    if (Number(result.train_split?.examples) !== 80 || result.train_split?.id !== "240-320") {
      errors.push(`${entry.name}: selector must tune on the 240-320 temporal window.`);
    }
    if (Number(result.eval_split?.examples) !== 69 || result.eval_split?.id !== "321-389" || predictions.length !== 69) {
      errors.push(`${entry.name}: selector must evaluate exactly 69 held-out final-window predictions.`);
    }
    if (Number(result.search_space?.answer_rate_floor) < 0.7 || !Number.isFinite(Number(result.search_space?.selected_rule?.threshold))) {
      errors.push(`${entry.name}: selector must record a 70% answer-rate floor and selected threshold.`);
    }
    const direct = result.baselines_on_eval?.direct_mini_citation_repair;
    const selected = result.selected_rule_metrics?.eval;
    if (!direct || !selected) {
      errors.push(`${entry.name}: selector must include direct baseline and selected eval metrics.`);
    } else {
      if (Number(selected.examples) !== 69) errors.push(`${entry.name}: selected eval metrics must cover 69 examples.`);
      if (Number(selected.answer_rate) < 0.7) errors.push(`${entry.name}: selected eval answer rate must preserve the 70% coverage floor.`);
      if (result.status === "selector_transfers_under_coverage" && !(Number(selected.answer_support_rate) > Number(direct.answer_support_rate))) {
        errors.push(`${entry.name}: transfer status requires held-out answer-support improvement over direct baseline.`);
      }
    }
    if (result.result_interpretation?.supports_selection_as_final_amortized_scaffold !== false || result.result_interpretation?.selection_only_still_insufficient !== true) {
      errors.push(`${entry.name}: selector result must not be treated as final amortized-student evidence.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: selector must be zero-cost.`);
    }
    if (!report.includes("Candidate Selector Cross-Window") || !report.includes("Qwen implication") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must expose selector title, Qwen implication, and zero-cost status.`);
    }
  }
}

async function validateConstrainedSpanConstructorRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("constrained-span-constructor-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let predictions;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed constrained span constructor artifacts.`);
      continue;
    }
    if (result.artifact_type !== "constrained_span_constructor") {
      errors.push(`${entry.name}: artifact_type must be constrained_span_constructor.`);
    }
    if (!["support_preserving_zero_llm_scaffold_candidate", "support_preserving_but_coverage_limited", "coverage_or_support_limited_negative"].includes(result.status)) {
      errors.push(`${entry.name}: invalid constrained constructor status.`);
    }
    if (Number(result.data?.train_window?.examples) !== 80 || result.data?.train_window?.id !== "240-320") {
      errors.push(`${entry.name}: constrained constructor must tune threshold on the prior 80-row window.`);
    }
    if (Number(result.data?.eval_window?.examples) !== 69 || result.data?.eval_window?.id !== "321-389" || predictions.length !== 69) {
      errors.push(`${entry.name}: constrained constructor must evaluate exactly 69 held-out final-window predictions.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: constrained constructor must be zero-cost.`);
    }
    if (!Number.isFinite(Number(result.method?.selected_threshold)) || !Array.isArray(result.train_threshold_sweep) || result.train_threshold_sweep.length < 3) {
      errors.push(`${entry.name}: constrained constructor must record threshold selection evidence.`);
    }
    if (Number(result.eval?.examples) !== predictions.length || Number(result.eval?.answered) + Number(result.eval?.abstained) !== predictions.length) {
      errors.push(`${entry.name}: eval metrics must match prediction rows.`);
    }
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !row.prediction?.answer_type || !row.reference?.answer_type || !row.scores) {
        errors.push(`${label}: missing prediction, reference, or scores.`);
        continue;
      }
      if (row.prediction.answer_type === "grounded_answer") {
        if (!Array.isArray(row.prediction.citations) || row.prediction.citations.length !== 1) {
          errors.push(`${label}: constrained grounded answer must have exactly one citation.`);
        }
        for (const citation of row.prediction.citations ?? []) {
          if (!row.prediction.answer?.includes(`[${citation}]`)) errors.push(`${label}: missing inline citation [${citation}].`);
        }
      }
    }
    if (!report.includes("Constrained Span Constructor") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify the constructor and zero-cost status.`);
    }
  }
}

async function validateTrainedEvidenceSelectorConstructorRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("trained-evidence-selector-constructor-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    const modelPath = path.join(runsDir, entry.name, "trained-evidence-selector-model.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let predictions;
    let model;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
      model = JSON.parse(await fs.readFile(modelPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed trained evidence selector artifacts.`);
      continue;
    }
    if (result.artifact_type !== "trained_evidence_selector_constructor") {
      errors.push(`${entry.name}: artifact_type must be trained_evidence_selector_constructor.`);
    }
    if (!["support_preserving_zero_llm_scaffold_candidate", "support_preserving_but_coverage_limited", "coverage_or_support_limited_negative"].includes(result.status)) {
      errors.push(`${entry.name}: invalid trained selector status.`);
    }
    if (Number(result.data?.train_window?.examples) !== 240 || result.data?.train_window?.id !== "0-240") {
      errors.push(`${entry.name}: trained selector must train only on rows before 240.`);
    }
    if (Number(result.data?.tune_window?.examples) !== 80 || result.data?.tune_window?.id !== "240-320") {
      errors.push(`${entry.name}: trained selector must tune threshold on the prior 80-row window.`);
    }
    if (Number(result.data?.eval_window?.examples) !== 69 || result.data?.eval_window?.id !== "321-389" || predictions.length !== 69) {
      errors.push(`${entry.name}: trained selector must evaluate exactly 69 held-out final-window predictions.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: trained selector constructor itself must be zero-cost.`);
    }
    if (!Number.isFinite(Number(result.method?.selected_threshold)) || !Array.isArray(result.tune_threshold_sweep) || result.tune_threshold_sweep.length < 3) {
      errors.push(`${entry.name}: trained selector must record tune threshold selection evidence.`);
    }
    if (!Array.isArray(result.eval_threshold_sweep_for_diagnosis_only) || result.eval_threshold_sweep_for_diagnosis_only.length !== result.tune_threshold_sweep.length) {
      errors.push(`${entry.name}: trained selector must record eval sweep as diagnosis-only evidence.`);
    }
    if (!model.evidence_selector?.weights || !model.span_selector?.weights || !model.sufficiency?.weights) {
      errors.push(`${entry.name}: trained selector model file must include evidence, span, and sufficiency weights.`);
    }
    if (Number(result.eval?.examples) !== predictions.length || Number(result.eval?.answered) + Number(result.eval?.abstained) !== predictions.length) {
      errors.push(`${entry.name}: eval metrics must match prediction rows.`);
    }
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !row.prediction?.answer_type || !row.reference?.answer_type || !row.scores) {
        errors.push(`${label}: missing prediction, reference, or scores.`);
        continue;
      }
      if (row.prediction.answer_type === "grounded_answer") {
        if (!Array.isArray(row.prediction.citations) || row.prediction.citations.length !== 1) {
          errors.push(`${label}: trained-selector grounded answer must have exactly one citation.`);
        }
        for (const citation of row.prediction.citations ?? []) {
          if (!row.prediction.answer?.includes(`[${citation}]`)) errors.push(`${label}: missing inline citation [${citation}].`);
        }
        if (!Number.isFinite(Number(row.prediction.metadata?.sufficiency_probability))) {
          errors.push(`${label}: grounded prediction must include sufficiency probability metadata.`);
        }
      }
    }
    if (!report.includes("Trained Evidence Selector Constructor") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify the trained selector and zero-cost constructor status.`);
    }
  }
}

async function validateAnswerSpanConstructionGapRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("answer-span-construction-gap-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const rowsPath = path.join(runsDir, entry.name, "rows.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let rows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      rows = await readJsonl(rowsPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed answer-span construction gap artifacts.`);
      continue;
    }
    if (result.artifact_type !== "answer_span_construction_gap") {
      errors.push(`${entry.name}: artifact_type must be answer_span_construction_gap.`);
    }
    if (!["answer_span_construction_dominates_evidence_id_selection", "mixed_evidence_selection_and_answer_span_failures"].includes(result.status)) {
      errors.push(`${entry.name}: invalid answer-span construction gap status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: answer-span construction gap must be zero-cost.`);
    }
    if (Number(result.summary?.answered_predictions) !== rows.length) {
      errors.push(`${entry.name}: answered_predictions must match rows.jsonl.`);
    }
    if (Number(result.summary?.judge_supported_answers) + Number(result.summary?.unsupported_answers) !== rows.length) {
      errors.push(`${entry.name}: supported plus unsupported rows must match rows.jsonl.`);
    }
    if (!result.prediction_run || !result.judge_run) {
      errors.push(`${entry.name}: must record source prediction and judge runs.`);
    }
    for (const [index, row] of rows.entries()) {
      const label = `${entry.name}.rows:${index + 1}`;
      if (!row.example_id || !Array.isArray(row.selected_citations) || !Array.isArray(row.reference_citations) || !Array.isArray(row.buckets)) {
        errors.push(`${label}: missing ids, citations, or buckets.`);
      }
      if (!row.selected_oracle || !Number.isFinite(Number(row.selected_oracle.best_token_f1))) {
        errors.push(`${label}: missing selected evidence oracle span metric.`);
      }
      if (!row.gold_oracle || !Number.isFinite(Number(row.gold_oracle.best_token_f1))) {
        errors.push(`${label}: missing gold evidence oracle span metric.`);
      }
    }
    if (!report.includes("Answer Span Construction Gap") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify the gap analysis and zero-cost status.`);
    }
  }
}

async function validateSpanClaimConstructionPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  const allowedOutputKeys = new Set(["answer_type", "answer", "citations", "claim_table", "abstention_reason"]);
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-gpu-prep-qwen7b-span-claim-construction-curriculum-")) continue;
    const runPath = path.join(runsDir, entry.name);
    const datasetPath = path.join(runPath, "dataset");
    let result;
    let report;
    let readme;
    let sftTrain;
    let sftValidation;
    let dpoTrain;
    let dpoValidation;
    let evalPrompts;
    let trainScript;
    let smokeRunner;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      readme = await fs.readFile(path.join(datasetPath, "README.md"), "utf8");
      trainScript = await fs.readFile(path.join(runPath, "train_joint_action_lora_uv.py"), "utf8");
      smokeRunner = await fs.readFile(path.join(runPath, "run_joint_action_smoke.sh"), "utf8");
      await fs.access(path.join(runPath, "validate_joint_action_dataset_uv.py"));
      await fs.access(path.join(runPath, "eval_joint_action_adapter_uv.py"));
      await fs.access(path.join(runPath, "run_prime_qwen3b_smoke_on_pod.sh"));
      await fs.access(path.join(runPath, "prime_gpu_plan.md"));
      sftTrain = await readJsonl(path.join(datasetPath, "sft_train.jsonl"));
      sftValidation = await readJsonl(path.join(datasetPath, "sft_validation.jsonl"));
      dpoTrain = await readJsonl(path.join(datasetPath, "dpo_train.jsonl"));
      dpoValidation = await readJsonl(path.join(datasetPath, "dpo_validation.jsonl"));
      evalPrompts = await readJsonl(path.join(datasetPath, "eval_prompts.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed span/claim construction packet artifacts.`);
      continue;
    }

    if (result.artifact_type !== "span_claim_construction_curriculum_packet") {
      errors.push(`${entry.name}: artifact_type must be span_claim_construction_curriculum_packet.`);
    }
    if (result.curriculum?.type !== "question_conditioned_span_claim_construction_v9") {
      errors.push(`${entry.name}: unexpected span/claim curriculum type.`);
    }
    if (Number(result.budget?.openai_calls) !== 0 || Number(result.budget?.openai_cost_usd) !== 0 || Number(result.budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: span/claim construction packet must be zero-cost.`);
    }
    if (!trainScript.includes("MAX_SFT_STEPS") || !trainScript.includes("MAX_DPO_STEPS") || trainScript.includes("\ndpo.push_to_hub()\n")) {
      errors.push(`${entry.name}: training script must be bounded and avoid unconditional hub pushes.`);
    }
    if (!smokeRunner.includes("MAX_SFT_STEPS") || !smokeRunner.includes("MAX_DPO_STEPS") || !smokeRunner.includes("eval_joint_action_adapter_uv.py")) {
      errors.push(`${entry.name}: smoke runner must validate, train with step caps, and evaluate predictions.`);
    }
    if (Number(result.estimated_gpu_cost_usd) <= 0 || Number(result.estimated_gpu_cost_usd) >= 100) {
      errors.push(`${entry.name}: estimated GPU cost must be positive and below total budget.`);
    }
    if (result.examples?.sft_train !== sftTrain.length) errors.push(`${entry.name}: sft_train count mismatch.`);
    if (result.examples?.sft_validation !== sftValidation.length) errors.push(`${entry.name}: sft_validation count mismatch.`);
    if (result.examples?.dpo_train !== dpoTrain.length) errors.push(`${entry.name}: dpo_train count mismatch.`);
    if (result.examples?.dpo_validation !== dpoValidation.length) errors.push(`${entry.name}: dpo_validation count mismatch.`);
    if (result.examples?.eval_prompts !== evalPrompts.length) errors.push(`${entry.name}: eval_prompts count mismatch.`);
    if (evalPrompts.length !== 69) errors.push(`${entry.name}: final eval prompt count must remain 69.`);
    const leakage = result.curriculum?.leakage_guard ?? {};
    if (leakage.final_eval_labels_used_for_training !== false) {
      errors.push(`${entry.name}: final eval labels must not be used for training.`);
    }
    if (Array.isArray(leakage.train_eval_paper_overlap) && leakage.train_eval_paper_overlap.length) {
      errors.push(`${entry.name}: train/eval paper overlap must be empty.`);
    }
    if (Array.isArray(leakage.validation_eval_paper_overlap) && leakage.validation_eval_paper_overlap.length) {
      errors.push(`${entry.name}: validation/eval paper overlap must be empty.`);
    }
    if (Number(result.quality_gates?.train_dpo_question_mismatch_negatives) <= 0 || Number(result.quality_gates?.train_dpo_abstention_contrasts) <= 0) {
      errors.push(`${entry.name}: train DPO mix must include question-mismatch and abstention contrasts.`);
    }

    for (const [index, row] of sftTrain.concat(sftValidation).entries()) {
      const label = `${entry.name}.sft:${index + 1}`;
      if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${label}: expected three chat messages.`);
      const assistant = row.messages?.[2]?.content;
      let parsed;
      try {
        parsed = JSON.parse(assistant);
      } catch {
        errors.push(`${label}: assistant message must be JSON.`);
        continue;
      }
      validateSpanClaimOutputKeys(parsed, allowedOutputKeys, label);
      if (JSON.stringify(parsed) !== JSON.stringify(row.target)) errors.push(`${label}: target must match assistant message JSON.`);
    }
    for (const [index, row] of dpoTrain.concat(dpoValidation).entries()) {
      const label = `${entry.name}.dpo:${index + 1}`;
      if (!Array.isArray(row.prompt) || row.prompt.length !== 2) errors.push(`${label}: expected two-message prompt.`);
      for (const key of ["chosen", "rejected"]) {
        let parsed;
        try {
          parsed = JSON.parse(row[key]);
        } catch {
          errors.push(`${label}: ${key} must be JSON.`);
          continue;
        }
        validateSpanClaimOutputKeys(parsed, allowedOutputKeys, `${label}.${key}`);
      }
    }
    if (!report.includes("Span/Claim Construction Curriculum Packet") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify span/claim packet and zero-cost status.`);
    }
    if (!readme.includes("Final eval labels are not used for training.")) {
      errors.push(`${entry.name}: dataset README must state final eval label guard.`);
    }
  }
}

function validateSpanClaimOutputKeys(output, allowedOutputKeys, label) {
  for (const key of Object.keys(output ?? {})) {
    if (!allowedOutputKeys.has(key)) errors.push(`${label}: output contains unsupported key ${key}.`);
  }
  for (const key of allowedOutputKeys) {
    if (!(key in output)) errors.push(`${label}: output missing required key ${key}.`);
  }
  if (!["grounded_answer", "abstain"].includes(output?.answer_type)) {
    errors.push(`${label}: invalid answer_type.`);
  }
}

async function validateAnswerCompletionRepairPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  const allowedOutputKeys = new Set(["answer_type", "answer", "citations", "claim_table", "abstention_reason"]);
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-gpu-prep-qwen7b-answer-completion-repair-curriculum-")) continue;
    const runPath = path.join(runsDir, entry.name);
    const datasetPath = path.join(runPath, "dataset");
    let result;
    let report;
    let readme;
    let sftTrain;
    let sftValidation;
    let dpoTrain;
    let dpoValidation;
    let evalPrompts;
    let trainScript;
    let smokeRunner;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      readme = await fs.readFile(path.join(datasetPath, "README.md"), "utf8");
      trainScript = await fs.readFile(path.join(runPath, "train_joint_action_lora_uv.py"), "utf8");
      smokeRunner = await fs.readFile(path.join(runPath, "run_joint_action_smoke.sh"), "utf8");
      await fs.access(path.join(runPath, "validate_joint_action_dataset_uv.py"));
      await fs.access(path.join(runPath, "eval_joint_action_adapter_uv.py"));
      await fs.access(path.join(runPath, "run_prime_qwen3b_smoke_on_pod.sh"));
      await fs.access(path.join(runPath, "prime_gpu_plan.md"));
      sftTrain = await readJsonl(path.join(datasetPath, "sft_train.jsonl"));
      sftValidation = await readJsonl(path.join(datasetPath, "sft_validation.jsonl"));
      dpoTrain = await readJsonl(path.join(datasetPath, "dpo_train.jsonl"));
      dpoValidation = await readJsonl(path.join(datasetPath, "dpo_validation.jsonl"));
      evalPrompts = await readJsonl(path.join(datasetPath, "eval_prompts.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed answer-completion repair packet artifacts.`);
      continue;
    }

    if (result.artifact_type !== "answer_completion_repair_curriculum_packet") {
      errors.push(`${entry.name}: artifact_type must be answer_completion_repair_curriculum_packet.`);
    }
    if (result.curriculum?.type !== "answer_completion_repair_v10") {
      errors.push(`${entry.name}: unexpected answer-completion curriculum type.`);
    }
    if (Number(result.budget?.openai_calls) !== 0 || Number(result.budget?.openai_cost_usd) !== 0 || Number(result.budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: answer-completion packet must be zero-cost.`);
    }
    if (!trainScript.includes("MAX_SFT_STEPS") || !trainScript.includes("MAX_DPO_STEPS") || trainScript.includes("\ndpo.push_to_hub()\n")) {
      errors.push(`${entry.name}: training script must be bounded and avoid unconditional hub pushes.`);
    }
    if (!smokeRunner.includes("MAX_SFT_STEPS") || !smokeRunner.includes("MAX_DPO_STEPS") || !smokeRunner.includes("eval_joint_action_adapter_uv.py")) {
      errors.push(`${entry.name}: smoke runner must validate, train with step caps, and evaluate predictions.`);
    }
    if (Number(result.estimated_gpu_cost_usd) <= 0 || Number(result.estimated_gpu_cost_usd) >= 100) {
      errors.push(`${entry.name}: estimated GPU cost must be positive and below total budget.`);
    }
    if (result.examples?.sft_train !== sftTrain.length) errors.push(`${entry.name}: sft_train count mismatch.`);
    if (result.examples?.sft_validation !== sftValidation.length) errors.push(`${entry.name}: sft_validation count mismatch.`);
    if (result.examples?.dpo_train !== dpoTrain.length) errors.push(`${entry.name}: dpo_train count mismatch.`);
    if (result.examples?.dpo_validation !== dpoValidation.length) errors.push(`${entry.name}: dpo_validation count mismatch.`);
    if (result.examples?.eval_prompts !== evalPrompts.length) errors.push(`${entry.name}: eval_prompts count mismatch.`);
    if (evalPrompts.length !== 69) errors.push(`${entry.name}: final eval prompt count must remain 69.`);
    const leakage = result.curriculum?.leakage_guard ?? {};
    if (leakage.final_eval_labels_used_for_training !== false) errors.push(`${entry.name}: final eval labels must not be used for training.`);
    if ((leakage.train_eval_paper_overlap ?? []).length !== 0 || (leakage.validation_eval_paper_overlap ?? []).length !== 0) {
      errors.push(`${entry.name}: eval papers must be disjoint from train and validation.`);
    }
    if (Number(result.curriculum?.final_eval_targets?.oracle_gap_answerable_rows) !== 13 || Number(result.curriculum?.final_eval_targets?.answer_completion_needed_for_70pct_query_answer_rate) !== 11) {
      errors.push(`${entry.name}: packet must preserve D215 final-window oracle-gap target counts.`);
    }
    if (Number(result.quality_gates?.train_answer_completion_negatives) <= 0 || Number(result.quality_gates?.train_question_mismatch_negatives) <= 0 || Number(result.quality_gates?.train_abstention_contrasts) <= 0) {
      errors.push(`${entry.name}: train DPO mix must include answer-completion, question-mismatch, and abstention contrasts.`);
    }

    for (const [index, row] of sftTrain.concat(sftValidation).entries()) {
      const label = `${entry.name}.sft:${index + 1}`;
      if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${label}: expected three chat messages.`);
      const assistant = row.messages?.[2]?.content;
      let parsed;
      try {
        parsed = JSON.parse(assistant);
      } catch {
        errors.push(`${label}: assistant message must be JSON.`);
        continue;
      }
      validateSpanClaimOutputKeys(parsed, allowedOutputKeys, label);
      if (JSON.stringify(parsed) !== JSON.stringify(row.target)) errors.push(`${label}: target must match assistant message JSON.`);
    }
    for (const [index, row] of dpoTrain.concat(dpoValidation).entries()) {
      const label = `${entry.name}.dpo:${index + 1}`;
      if (!Array.isArray(row.prompt) || row.prompt.length !== 2) errors.push(`${label}: expected two-message prompt.`);
      for (const key of ["chosen", "rejected"]) {
        let parsed;
        try {
          parsed = JSON.parse(row[key]);
        } catch {
          errors.push(`${label}: ${key} must be JSON.`);
          continue;
        }
        validateSpanClaimOutputKeys(parsed, allowedOutputKeys, `${label}.${key}`);
      }
    }
    const completionContrasts = dpoTrain.filter((row) => row.label_source?.type === "prefer_complete_answer_over_short_cited_answer");
    if (completionContrasts.length !== Number(result.quality_gates?.train_answer_completion_negatives)) {
      errors.push(`${entry.name}: train answer-completion contrast count mismatch.`);
    }
    if (!evalPrompts.some((row) => row.eval_target?.oracle_gap_answerable_without_supported_qwen7b_candidate === true)) {
      errors.push(`${entry.name}: eval prompts must annotate oracle-gap target rows.`);
    }
    if (!report.includes("Answer-Completion Repair Curriculum Packet") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify answer-completion packet and zero-cost status.`);
    }
    if (!readme.includes("Final eval labels are not used for training.")) {
      errors.push(`${entry.name}: dataset README must state final eval label guard.`);
    }
  }
}

async function validateMixedMetricRepairPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  const allowedOutputKeys = new Set(["answer_type", "answer", "citations", "claim_table", "abstention_reason"]);
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-gpu-prep-qwen7b-mixed-metric-repair-curriculum-")) continue;
    const runPath = path.join(runsDir, entry.name);
    const datasetPath = path.join(runPath, "dataset");
    let result;
    let report;
    let readme;
    let sftTrain;
    let sftValidation;
    let dpoTrain;
    let dpoValidation;
    let evalPrompts;
    let trainScript;
    let smokeRunner;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      readme = await fs.readFile(path.join(datasetPath, "README.md"), "utf8");
      trainScript = await fs.readFile(path.join(runPath, "train_joint_action_lora_uv.py"), "utf8");
      smokeRunner = await fs.readFile(path.join(runPath, "run_joint_action_smoke.sh"), "utf8");
      await fs.access(path.join(runPath, "validate_joint_action_dataset_uv.py"));
      await fs.access(path.join(runPath, "eval_joint_action_adapter_uv.py"));
      await fs.access(path.join(runPath, "run_prime_qwen3b_smoke_on_pod.sh"));
      await fs.access(path.join(runPath, "prime_gpu_plan.md"));
      sftTrain = await readJsonl(path.join(datasetPath, "sft_train.jsonl"));
      sftValidation = await readJsonl(path.join(datasetPath, "sft_validation.jsonl"));
      dpoTrain = await readJsonl(path.join(datasetPath, "dpo_train.jsonl"));
      dpoValidation = await readJsonl(path.join(datasetPath, "dpo_validation.jsonl"));
      evalPrompts = await readJsonl(path.join(datasetPath, "eval_prompts.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed mixed metric repair packet artifacts.`);
      continue;
    }

    if (result.artifact_type !== "mixed_metric_repair_curriculum_packet") {
      errors.push(`${entry.name}: artifact_type must be mixed_metric_repair_curriculum_packet.`);
    }
    if (result.curriculum?.type !== "mixed_metric_repair_v11") {
      errors.push(`${entry.name}: unexpected mixed metric curriculum type.`);
    }
    if (result.status !== "ready_for_bounded_gpu_smoke_after_preflight") {
      errors.push(`${entry.name}: mixed metric packet must be preflight-ready, not launched evidence.`);
    }
    if (Number(result.budget?.openai_calls) !== 0 || Number(result.budget?.openai_cost_usd) !== 0 || Number(result.budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: mixed metric packet must be zero-cost.`);
    }
    if (!trainScript.includes("MAX_SFT_STEPS") || !trainScript.includes("MAX_DPO_STEPS") || trainScript.includes("\ndpo.push_to_hub()\n")) {
      errors.push(`${entry.name}: training script must be bounded and avoid unconditional hub pushes.`);
    }
    if (!smokeRunner.includes("MAX_SFT_STEPS") || !smokeRunner.includes("MAX_DPO_STEPS") || !smokeRunner.includes("eval_joint_action_adapter_uv.py")) {
      errors.push(`${entry.name}: smoke runner must validate, train with step caps, and evaluate predictions.`);
    }
    if (Number(result.estimated_gpu_cost_usd) <= 0 || Number(result.estimated_gpu_cost_usd) >= 100) {
      errors.push(`${entry.name}: estimated GPU cost must be positive and below total budget.`);
    }
    if (result.examples?.sft_train !== sftTrain.length) errors.push(`${entry.name}: sft_train count mismatch.`);
    if (result.examples?.sft_validation !== sftValidation.length) errors.push(`${entry.name}: sft_validation count mismatch.`);
    if (result.examples?.dpo_train !== dpoTrain.length) errors.push(`${entry.name}: dpo_train count mismatch.`);
    if (result.examples?.dpo_validation !== dpoValidation.length) errors.push(`${entry.name}: dpo_validation count mismatch.`);
    if (result.examples?.eval_prompts !== evalPrompts.length) errors.push(`${entry.name}: eval_prompts count mismatch.`);
    if (evalPrompts.length !== 69) errors.push(`${entry.name}: final eval prompt count must remain 69.`);
    const leakage = result.curriculum?.leakage_guard ?? {};
    if (leakage.final_eval_labels_used_for_training !== false) errors.push(`${entry.name}: final eval labels must not be used for training.`);
    if ((leakage.train_eval_paper_overlap ?? []).length !== 0 || (leakage.validation_eval_paper_overlap ?? []).length !== 0) {
      errors.push(`${entry.name}: eval papers must be disjoint from train and validation.`);
    }
    const targets = result.curriculum?.final_eval_diagnostic_targets ?? {};
    if (Number(targets.oracle_gap_examples) !== 13 || Number(targets.oracle_gap_table_metric_rows) !== 13 || Number(targets.oracle_gap_multi_evidence_rows) !== 6 || targets.final_eval_labels_used_for_training !== false) {
      errors.push(`${entry.name}: packet must preserve D220 diagnostic target counts without training on final labels.`);
    }
    if (Number(result.quality_gates?.train_metric_span_negatives) <= 0 || Number(result.quality_gates?.train_incomplete_metric_negatives) <= 0 || Number(result.quality_gates?.train_multi_evidence_negatives) <= 0) {
      errors.push(`${entry.name}: train DPO mix must include metric-span, incomplete-metric, and multi-evidence negatives.`);
    }
    if (Number(result.quality_gates?.train_metric_or_numeric_sft_rows) <= 0 || Number(result.quality_gates?.train_abstention_contrasts) <= 0) {
      errors.push(`${entry.name}: packet must include metric SFT rows and abstention contrasts.`);
    }

    for (const [index, row] of sftTrain.concat(sftValidation).entries()) {
      const label = `${entry.name}.sft:${index + 1}`;
      if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${label}: expected three chat messages.`);
      let parsed;
      try {
        parsed = JSON.parse(row.messages?.[2]?.content ?? "");
      } catch {
        errors.push(`${label}: assistant message must be JSON.`);
        continue;
      }
      validateSpanClaimOutputKeys(parsed, allowedOutputKeys, label);
      if (JSON.stringify(parsed) !== JSON.stringify(row.target)) errors.push(`${label}: target must match assistant message JSON.`);
    }
    for (const [index, row] of dpoTrain.concat(dpoValidation).entries()) {
      const label = `${entry.name}.dpo:${index + 1}`;
      if (!Array.isArray(row.prompt) || row.prompt.length !== 2) errors.push(`${label}: expected two-message prompt.`);
      for (const key of ["chosen", "rejected"]) {
        let parsed;
        try {
          parsed = JSON.parse(row[key]);
        } catch {
          errors.push(`${label}: ${key} must be JSON.`);
          continue;
        }
        validateSpanClaimOutputKeys(parsed, allowedOutputKeys, `${label}.${key}`);
      }
    }
    if (dpoTrain.filter((row) => row.label_source?.type === "prefer_supported_answer_over_wrong_metric_span").length !== Number(result.quality_gates?.train_metric_span_negatives)) {
      errors.push(`${entry.name}: train metric-span contrast count mismatch.`);
    }
    if (dpoTrain.filter((row) => row.label_source?.type === "prefer_complete_metric_answer_over_incomplete_metric_fragment").length !== Number(result.quality_gates?.train_incomplete_metric_negatives)) {
      errors.push(`${entry.name}: train incomplete-metric contrast count mismatch.`);
    }
    if (dpoTrain.filter((row) => row.label_source?.type === "prefer_multi_evidence_answer_over_single_evidence_fragment").length !== Number(result.quality_gates?.train_multi_evidence_negatives)) {
      errors.push(`${entry.name}: train multi-evidence contrast count mismatch.`);
    }
    if (!evalPrompts.some((row) => row.eval_target?.diagnostic_only_oracle_gap === true)) {
      errors.push(`${entry.name}: eval prompts must annotate diagnostic-only oracle-gap rows.`);
    }
    if (!report.includes("Mixed Metric Repair Curriculum Packet") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify mixed metric packet and zero-cost status.`);
    }
    if (!readme.includes("Final eval labels are not used for training.")) {
      errors.push(`${entry.name}: dataset README must state final eval label guard.`);
    }
  }
}

async function validateSupportTargetedPlanningPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  const requiredOutputKeys = new Set(["answer_type", "answer_plan", "answer", "citations", "claim_table", "abstention_reason"]);
  const requiredPlanKeys = new Set(["answer_style", "sufficiency", "required_evidence", "missing_information", "construction_steps"]);
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("support-targeted-planning-packet-")) continue;
    const runPath = path.join(runsDir, entry.name);
    const datasetPath = path.join(runPath, "dataset");
    let result;
    let report;
    let readme;
    let sftTrain;
    let sftValidation;
    let dpoTrain;
    let dpoValidation;
    let evalPrompts;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      readme = await fs.readFile(path.join(datasetPath, "README.md"), "utf8");
      sftTrain = await readJsonl(path.join(datasetPath, "planning_sft_train.jsonl"));
      sftValidation = await readJsonl(path.join(datasetPath, "planning_sft_validation.jsonl"));
      dpoTrain = await readJsonl(path.join(datasetPath, "planning_dpo_train.jsonl"));
      dpoValidation = await readJsonl(path.join(datasetPath, "planning_dpo_validation.jsonl"));
      evalPrompts = await readJsonl(path.join(datasetPath, "eval_missing_supported_prompts.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed support-targeted planning packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "support_targeted_planning_packet") {
      errors.push(`${entry.name}: artifact_type must be support_targeted_planning_packet.`);
    }
    if (!["ready_to_merge_into_next_gpu_packet", "train_ready_validation_sparse", "insufficient_analog_coverage"].includes(result.status)) {
      errors.push(`${entry.name}: invalid support-targeted planning packet status.`);
    }
    if (Number(result.budget?.openai_calls) !== 0 || Number(result.budget?.openai_cost_usd) !== 0 || Number(result.budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: support-targeted planning packet must be zero-cost.`);
    }
    if (result.examples?.planning_sft_train !== sftTrain.length) errors.push(`${entry.name}: planning_sft_train count mismatch.`);
    if (result.examples?.planning_sft_validation !== sftValidation.length) errors.push(`${entry.name}: planning_sft_validation count mismatch.`);
    if (result.examples?.planning_dpo_train !== dpoTrain.length) errors.push(`${entry.name}: planning_dpo_train count mismatch.`);
    if (result.examples?.planning_dpo_validation !== dpoValidation.length) errors.push(`${entry.name}: planning_dpo_validation count mismatch.`);
    if (result.examples?.eval_missing_supported_prompts !== evalPrompts.length) errors.push(`${entry.name}: eval_missing_supported_prompts count mismatch.`);
    if (Number(result.upstream_evidence?.missing_supported_candidate_examples) !== 8 || evalPrompts.length !== 8) {
      errors.push(`${entry.name}: packet must preserve the eight missing-supported-candidate final prompts.`);
    }
    const leakage = result.curriculum?.leakage_guard ?? {};
    if (leakage.passes !== true || (leakage.train_eval_shared_papers ?? []).length !== 0 || (leakage.validation_eval_shared_papers ?? []).length !== 0) {
      errors.push(`${entry.name}: train/validation papers must be disjoint from final eval papers.`);
    }
    const target = result.quality_gates?.target_profile_counts ?? {};
    for (const key of ["yes_no", "numeric", "list", "multi_evidence"]) {
      if (Number(target[key]) <= 0) errors.push(`${entry.name}: missing target profile count for ${key}.`);
      if (result.status === "ready_to_merge_into_next_gpu_packet" && Number(result.quality_gates?.train_summary?.[`sft_${key}`]) < 10) {
        errors.push(`${entry.name}: ready packet needs at least 10 train SFT analogs for ${key}.`);
      }
      if (result.status === "ready_to_merge_into_next_gpu_packet" && Number(result.quality_gates?.validation_summary?.[`sft_${key}`]) < 3) {
        errors.push(`${entry.name}: ready packet needs at least 3 validation SFT analogs for ${key}.`);
      }
    }
    for (const [index, row] of sftTrain.concat(sftValidation).entries()) {
      const label = `${entry.name}.planning_sft:${index + 1}`;
      if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${label}: expected three chat messages.`);
      let parsed;
      try {
        parsed = JSON.parse(row.messages?.[2]?.content);
      } catch {
        errors.push(`${label}: assistant message must be JSON.`);
        continue;
      }
      validatePlanningOutput(parsed, requiredOutputKeys, requiredPlanKeys, label);
      if (JSON.stringify(parsed) !== JSON.stringify(row.target)) errors.push(`${label}: target must match assistant JSON.`);
      if (row.label_source?.final_window_label_used !== false) errors.push(`${label}: final_window_label_used must be false.`);
    }
    for (const [index, row] of dpoTrain.concat(dpoValidation).entries()) {
      const label = `${entry.name}.planning_dpo:${index + 1}`;
      if (!Array.isArray(row.prompt) || row.prompt.length !== 2) errors.push(`${label}: expected two-message prompt.`);
      for (const key of ["chosen", "rejected"]) {
        let parsed;
        try {
          parsed = JSON.parse(row[key]);
        } catch {
          errors.push(`${label}: ${key} must be JSON.`);
          continue;
        }
        validatePlanningOutput(parsed, requiredOutputKeys, requiredPlanKeys, `${label}.${key}`);
      }
      if (row.label_source?.final_window_label_used !== false) errors.push(`${label}: final_window_label_used must be false.`);
    }
    if (!evalPrompts.every((row) => row.training_use === "forbidden_final_window_diagnostic_only")) {
      errors.push(`${entry.name}: eval missing-supported prompts must be diagnostic-only.`);
    }
    if (result.decision?.launch_next_gpu_now !== false) {
      errors.push(`${entry.name}: planning packet must not authorize immediate GPU launch.`);
    }
    if (!report.includes("Support-Targeted Planning Packet") || !report.includes("No OpenAI calls")) {
      errors.push(`${entry.name}: report must identify support-targeted planning and zero-cost status.`);
    }
    if (!readme.includes("final-window labels are diagnostic only")) {
      errors.push(`${entry.name}: dataset README must state final-window diagnostic-only guard.`);
    }
  }
}

function validatePlanningOutput(output, requiredOutputKeys, requiredPlanKeys, label) {
  for (const key of requiredOutputKeys) {
    if (!(key in (output ?? {}))) errors.push(`${label}: output missing required key ${key}.`);
  }
  for (const key of Object.keys(output ?? {})) {
    if (!requiredOutputKeys.has(key)) errors.push(`${label}: output contains unsupported key ${key}.`);
  }
  if (!["grounded_answer", "abstain"].includes(output?.answer_type)) errors.push(`${label}: invalid answer_type.`);
  for (const key of requiredPlanKeys) {
    if (!(key in (output?.answer_plan ?? {}))) errors.push(`${label}: answer_plan missing ${key}.`);
  }
  if (!Array.isArray(output?.citations)) errors.push(`${label}: citations must be an array.`);
  if (!Array.isArray(output?.claim_table)) errors.push(`${label}: claim_table must be an array.`);
  if (output?.answer_type === "grounded_answer") {
    for (const citation of output.citations ?? []) {
      if (!String(output.answer ?? "").includes(`[${citation}]`)) errors.push(`${label}: missing inline citation [${citation}].`);
    }
  }
}

async function validateSupportTargetedPlanningLaunchPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  const allowedOutputKeys = new Set(["answer_type", "answer", "citations", "claim_table", "abstention_reason"]);
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-gpu-prep-qwen7b-support-targeted-planning-curriculum-")) continue;
    const runPath = path.join(runsDir, entry.name);
    const datasetPath = path.join(runPath, "dataset");
    let result;
    let report;
    let readme;
    let sftTrain;
    let sftValidation;
    let dpoTrain;
    let dpoValidation;
    let evalPrompts;
    let trainScript;
    let smokeRunner;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      readme = await fs.readFile(path.join(datasetPath, "README.md"), "utf8");
      trainScript = await fs.readFile(path.join(runPath, "train_joint_action_lora_uv.py"), "utf8");
      smokeRunner = await fs.readFile(path.join(runPath, "run_joint_action_smoke.sh"), "utf8");
      await fs.access(path.join(runPath, "validate_joint_action_dataset_uv.py"));
      await fs.access(path.join(runPath, "eval_joint_action_adapter_uv.py"));
      await fs.access(path.join(runPath, "run_prime_qwen3b_smoke_on_pod.sh"));
      await fs.access(path.join(runPath, "prime_gpu_plan.md"));
      sftTrain = await readJsonl(path.join(datasetPath, "sft_train.jsonl"));
      sftValidation = await readJsonl(path.join(datasetPath, "sft_validation.jsonl"));
      dpoTrain = await readJsonl(path.join(datasetPath, "dpo_train.jsonl"));
      dpoValidation = await readJsonl(path.join(datasetPath, "dpo_validation.jsonl"));
      evalPrompts = await readJsonl(path.join(datasetPath, "eval_prompts.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed support-targeted planning launch packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "support_targeted_planning_launch_packet") {
      errors.push(`${entry.name}: artifact_type must be support_targeted_planning_launch_packet.`);
    }
    if (result.status !== "ready_for_bounded_gpu_smoke_after_preflight") {
      errors.push(`${entry.name}: launch packet must be preflight-ready but not treated as result evidence.`);
    }
    if (result.curriculum?.type !== "support_targeted_planning_v12_launch") {
      errors.push(`${entry.name}: unexpected support-targeted launch curriculum type.`);
    }
    if (Number(result.budget?.openai_calls) !== 0 || Number(result.budget?.openai_cost_usd) !== 0 || Number(result.budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: launch packet materialization must be zero-cost.`);
    }
    if (!trainScript.includes("MAX_SFT_STEPS") || !trainScript.includes("MAX_DPO_STEPS") || trainScript.includes("\ndpo.push_to_hub()\n")) {
      errors.push(`${entry.name}: training script must be bounded and avoid unconditional hub pushes.`);
    }
    if (!smokeRunner.includes("MAX_SFT_STEPS") || !smokeRunner.includes("MAX_DPO_STEPS") || !smokeRunner.includes("eval_joint_action_adapter_uv.py")) {
      errors.push(`${entry.name}: smoke runner must validate, train with step caps, and evaluate predictions.`);
    }
    if (Number(result.estimated_gpu_cost_usd) <= 0 || Number(result.estimated_gpu_cost_usd) >= 100) {
      errors.push(`${entry.name}: estimated GPU cost must be positive and below total budget.`);
    }
    if (result.examples?.sft_train !== sftTrain.length) errors.push(`${entry.name}: sft_train count mismatch.`);
    if (result.examples?.sft_validation !== sftValidation.length) errors.push(`${entry.name}: sft_validation count mismatch.`);
    if (result.examples?.dpo_train !== dpoTrain.length) errors.push(`${entry.name}: dpo_train count mismatch.`);
    if (result.examples?.dpo_validation !== dpoValidation.length) errors.push(`${entry.name}: dpo_validation count mismatch.`);
    if (result.examples?.eval_prompts !== evalPrompts.length) errors.push(`${entry.name}: eval_prompts count mismatch.`);
    if (evalPrompts.length !== 69) errors.push(`${entry.name}: final eval prompt count must remain 69.`);
    if (result.quality_gates?.eval_prompts_unchanged_from_base !== true) {
      errors.push(`${entry.name}: eval prompts must be unchanged from the base final-window packet.`);
    }
    const leakage = result.curriculum?.leakage_guard ?? {};
    if (leakage.final_eval_labels_used_for_training !== false || leakage.source_planning_guard_passes !== true) {
      errors.push(`${entry.name}: launch packet must preserve planning leakage guard.`);
    }
    if ((leakage.train_eval_paper_overlap ?? []).length !== 0 || (leakage.validation_eval_paper_overlap ?? []).length !== 0) {
      errors.push(`${entry.name}: eval papers must be disjoint from train and validation.`);
    }
    if (Number(result.examples?.planning_sft_train_added) <= 0 || Number(result.examples?.planning_dpo_train_added) <= 0) {
      errors.push(`${entry.name}: launch packet must add planning SFT and DPO rows.`);
    }
    if (result.launch_gate?.launch_next_gpu_now !== false) {
      errors.push(`${entry.name}: packet materialization must not itself authorize immediate launch.`);
    }
    for (const [index, row] of sftTrain.concat(sftValidation).entries()) {
      const label = `${entry.name}.sft:${index + 1}`;
      if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${label}: expected three chat messages.`);
      let parsed;
      try {
        parsed = JSON.parse(row.messages?.[2]?.content);
      } catch {
        errors.push(`${label}: assistant message must be JSON.`);
        continue;
      }
      validateSpanClaimOutputKeys(parsed, allowedOutputKeys, label);
      if ("answer_plan" in parsed) errors.push(`${label}: standard launch output must not include answer_plan.`);
      if (JSON.stringify(parsed) !== JSON.stringify(row.target)) errors.push(`${label}: target must match assistant message JSON.`);
    }
    for (const [index, row] of dpoTrain.concat(dpoValidation).entries()) {
      const label = `${entry.name}.dpo:${index + 1}`;
      if (!Array.isArray(row.prompt) || row.prompt.length !== 2) errors.push(`${label}: expected two-message prompt.`);
      for (const key of ["chosen", "rejected"]) {
        let parsed;
        try {
          parsed = JSON.parse(row[key]);
        } catch {
          errors.push(`${label}: ${key} must be JSON.`);
          continue;
        }
        validateSpanClaimOutputKeys(parsed, allowedOutputKeys, `${label}.${key}`);
        if ("answer_plan" in parsed) errors.push(`${label}.${key}: standard launch output must not include answer_plan.`);
      }
    }
    if (!sftTrain.some((row) => String(row.messages?.[1]?.content ?? "").includes("Support-targeted planning hints"))) {
      errors.push(`${entry.name}: train set must include support-targeted planning hint rows.`);
    }
    if (!report.includes("Support-Targeted Planning Launch Packet") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify launch packet and zero-cost materialization.`);
    }
    if (!readme.includes("Final eval labels are not used for training.")) {
      errors.push(`${entry.name}: dataset README must state final eval label guard.`);
    }
  }
}

async function validateSupportContractAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("support-contract-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let report;
    let rows;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      rows = await readJsonl(path.join(runPath, "rows.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed support contract audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "support_contract_audit") {
      errors.push(`${entry.name}: artifact_type must be support_contract_audit.`);
    }
    if (!["contract_failures_explain_invalid_judgments", "needs_judge_prompt_review", "counterfactual_answering_remains", "contract_clean"].includes(result.status)) {
      errors.push(`${entry.name}: invalid support contract audit status.`);
    }
    if (rows.length !== Number(result.examples)) {
      errors.push(`${entry.name}: rows count must match examples.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: support contract audit must be zero-cost.`);
    }
    const answered = rows.filter((row) => row.prediction_answer_type === "grounded_answer");
    if (answered.length !== Number(result.answered)) {
      errors.push(`${entry.name}: answered count mismatch.`);
    }
    const invalidAnswered = rows.filter((row) => row.prediction_answer_type === "grounded_answer" && row.judge_verdict === "invalid");
    if (invalidAnswered.length !== Number(result.invalid_answered_judgments)) {
      errors.push(`${entry.name}: invalid answered judgment count mismatch.`);
    }
    for (const key of ["top_level_citation_contract", "inline_citation_contract", "claim_table_citation_contract"]) {
      const summary = result[key] ?? {};
      for (const required of ["answered_rows", "rows_with_any", "rows_all_valid", "rows_with_invalid_ids", "rows_missing"]) {
        if (!Number.isFinite(Number(summary[required]))) errors.push(`${entry.name}: ${key}.${required} must be numeric.`);
      }
      if (Number(summary.answered_rows) !== answered.length) {
        errors.push(`${entry.name}: ${key}.answered_rows mismatch.`);
      }
    }
    if (result.status === "contract_failures_explain_invalid_judgments") {
      const fullyCleanInvalid = invalidAnswered.filter((row) =>
        row.top_level_contract?.valid === true
        && row.inline_contract?.valid === true
        && row.claim_table_contract?.valid === true
        && row.citation_channels_consistent === true
      );
      if (fullyCleanInvalid.length) {
        errors.push(`${entry.name}: clean invalid rows require judge prompt review status.`);
      }
    }
    if (!report.includes("Support Contract Audit") || !report.includes("LLM calls: 0")) {
      errors.push(`${entry.name}: report must identify support contract audit and zero-cost status.`);
    }
  }
}

async function validateSupportContractGateRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("support-contract-gate-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let report;
    let rows;
    let predictions;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      rows = await readJsonl(path.join(runPath, "rows.jsonl"));
      predictions = await readJsonl(path.join(runPath, "predictions.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed support contract gate artifacts.`);
      continue;
    }
    if (result.artifact_type !== "support_contract_gate") {
      errors.push(`${entry.name}: artifact_type must be support_contract_gate.`);
    }
    if (!["contract_gate_improves_support_but_collapses_coverage", "contract_gate_too_strict_drops_supported_answers", "contract_gate_viable_for_selector", "contract_gate_no_support_gain"].includes(result.status)) {
      errors.push(`${entry.name}: invalid support contract gate status.`);
    }
    if (rows.length !== Number(result.examples) || predictions.length !== Number(result.examples)) {
      errors.push(`${entry.name}: rows and predictions must match examples.`);
    }
    if (!["strict", "answer_citations"].includes(result.gate_policy?.name)) {
      errors.push(`${entry.name}: unexpected support contract gate policy.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: support contract gate must be zero-cost.`);
    }
    const suppressed = rows.filter((row) => row.gate_decision === "suppress_to_abstain");
    if (suppressed.length !== Number(result.suppressions?.total)) {
      errors.push(`${entry.name}: suppression count mismatch.`);
    }
    if (result.gate_policy?.name === "answer_citations" && Number(result.suppressions?.harmful_supported_answer_suppressions) !== 0) {
      errors.push(`${entry.name}: answer-citation gate must not drop supported answers in this diagnostic.`);
    }
    if (result.status === "contract_gate_improves_support_but_collapses_coverage" && !(Number(result.gated_metrics?.answer_support_rate) > Number(result.source_metrics?.answer_support_rate))) {
      errors.push(`${entry.name}: support-improving status requires answer support gain.`);
    }
    if (!report.includes("Support Contract Gate") || !report.includes("makes no LLM calls")) {
      errors.push(`${entry.name}: report must identify support contract gate and zero-cost status.`);
    }
  }
}

async function validateContractAwareCandidateSelectorRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("contract-aware-candidate-selector-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let report;
    let rows;
    let heuristicRows;
    let oracleRows;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      rows = await readJsonl(path.join(runPath, "rows.jsonl"));
      heuristicRows = await readJsonl(path.join(runPath, "heuristic_predictions.jsonl"));
      oracleRows = await readJsonl(path.join(runPath, "oracle_predictions.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed contract-aware candidate selector artifacts.`);
      continue;
    }
    if (result.artifact_type !== "contract_aware_candidate_selector") {
      errors.push(`${entry.name}: artifact_type must be contract_aware_candidate_selector.`);
    }
    if (!["contract_selector_candidate_positive", "candidate_pool_sufficient_but_selector_weak", "candidate_pool_still_below_coverage_floor", "contract_selector_negative"].includes(result.status)) {
      errors.push(`${entry.name}: invalid contract-aware selector status.`);
    }
    if (rows.length !== Number(result.examples) || heuristicRows.length !== Number(result.examples) || oracleRows.length !== Number(result.examples)) {
      errors.push(`${entry.name}: selector row counts must match examples.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: contract-aware selector must be zero-cost.`);
    }
    for (const key of ["contract_heuristic_selector", "contract_judged_oracle", "scaffold_priority_selector"]) {
      const metrics = result.selection_metrics?.[key];
      if (!metrics) {
        errors.push(`${entry.name}: missing ${key} metrics.`);
        continue;
      }
      for (const metric of ["examples", "answered", "abstained", "answer_rate", "answer_support_rate", "overall_judged_correct_rate", "answer_citation_complete_rate"]) {
        if (!Number.isFinite(Number(metrics[metric]))) errors.push(`${entry.name}: ${key}.${metric} must be numeric.`);
      }
      if (Number(metrics.examples) !== Number(result.examples)) errors.push(`${entry.name}: ${key}.examples mismatch.`);
    }
    const heuristic = result.selection_metrics?.contract_heuristic_selector ?? {};
    if (result.status === "contract_selector_candidate_positive" && (Number(heuristic.answer_rate) < 0.7 || Number(heuristic.answer_support_rate) < 0.66)) {
      errors.push(`${entry.name}: positive selector status requires answer-rate/support thresholds.`);
    }
    if (!report.includes("Contract-Aware Candidate Selector") || !report.includes("makes no LLM calls")) {
      errors.push(`${entry.name}: report must identify contract-aware selector and zero-cost status.`);
    }
  }
}

async function validateTrainedContractSelectorRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("trained-contract-selector-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let report;
    let predictions;
    let trainPredictions;
    let oraclePredictions;
    let model;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      model = JSON.parse(await fs.readFile(path.join(runPath, "selector-model.json"), "utf8"));
      predictions = await readJsonl(path.join(runPath, "predictions.jsonl"));
      trainPredictions = await readJsonl(path.join(runPath, "train_predictions.jsonl"));
      oraclePredictions = await readJsonl(path.join(runPath, "oracle_predictions.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed trained contract selector artifacts.`);
      continue;
    }
    if (result.artifact_type !== "trained_contract_selector") {
      errors.push(`${entry.name}: artifact_type must be trained_contract_selector.`);
    }
    if (!["trained_contract_selector_positive", "candidate_pool_sufficient_selector_underfits", "trained_contract_selector_near_miss", "trained_contract_selector_negative"].includes(result.status)) {
      errors.push(`${entry.name}: invalid trained contract selector status.`);
    }
    if (predictions.length !== Number(result.eval_window?.examples) || oraclePredictions.length !== Number(result.eval_window?.examples)) {
      errors.push(`${entry.name}: eval prediction counts must match eval window examples.`);
    }
    if (trainPredictions.length !== Number(result.train_window?.examples)) {
      errors.push(`${entry.name}: train prediction count must match train window examples.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: trained contract selector must be zero-cost.`);
    }
    if (!Array.isArray(model.feature_names) || model.feature_names.length < 8 || !model.weights) {
      errors.push(`${entry.name}: selector model must expose feature names and weights.`);
    }
    for (const key of ["train_metrics", "eval_metrics", "eval_oracle_metrics", "scaffold_priority_metrics"]) {
      const metrics = result[key] ?? {};
      for (const metric of ["examples", "answered", "answer_rate", "answer_support_rate", "overall_judged_correct_rate", "answer_citation_complete_rate"]) {
        if (!Number.isFinite(Number(metrics[metric]))) errors.push(`${entry.name}: ${key}.${metric} must be numeric.`);
      }
    }
    if (result.status === "trained_contract_selector_positive" && (Number(result.eval_metrics?.answer_rate) < 0.7 || Number(result.eval_metrics?.answer_support_rate) < 0.66)) {
      errors.push(`${entry.name}: positive trained selector status requires coverage/support thresholds.`);
    }
    if (!report.includes("Trained Contract Selector") || !report.includes("makes no LLM calls")) {
      errors.push(`${entry.name}: report must identify trained selector and zero-cost status.`);
    }
  }
}

async function validateTrainedSelectorMissAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("trained-selector-miss-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let report;
    let rows;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      rows = await readJsonl(path.join(runPath, "rows.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed trained selector miss audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "trained_selector_miss_audit") {
      errors.push(`${entry.name}: artifact_type must be trained_selector_miss_audit.`);
    }
    if (!["verifier_score_miscalibration_dominates", "answer_abstention_calibration_dominates", "family_shift_miscalibration_dominates", "mixed_selector_failure_modes"].includes(result.status)) {
      errors.push(`${entry.name}: invalid trained selector miss audit status.`);
    }
    if (rows.length !== Number(result.missed_supported_answers)) {
      errors.push(`${entry.name}: rows count must match missed supported answers.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: trained selector miss audit must be zero-cost.`);
    }
    const computedTagCounts = {};
    for (const row of rows) {
      if (!row.missed_supported_answer || !row.oracle_candidate_id || !Array.isArray(row.tags)) {
        errors.push(`${entry.name}: malformed miss audit row ${row.example_id ?? "<missing>"}.`);
      }
      for (const tag of row.tags ?? []) computedTagCounts[tag] = (computedTagCounts[tag] ?? 0) + 1;
    }
    for (const [tag, count] of Object.entries(computedTagCounts)) {
      if (Number(result.tag_counts?.[tag] ?? 0) !== count) errors.push(`${entry.name}: tag count mismatch for ${tag}.`);
    }
    if (!report.includes("Trained Selector Miss Audit") || !report.includes("makes no LLM calls")) {
      errors.push(`${entry.name}: report must identify miss audit and zero-cost status.`);
    }
  }
}

async function validateCalibratedHybridSelectorRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("calibrated-hybrid-selector-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let report;
    let predictions;
    let scaffoldPredictions;
    let oraclePredictions;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      predictions = await readJsonl(path.join(runPath, "predictions.jsonl"));
      scaffoldPredictions = await readJsonl(path.join(runPath, "scaffold_predictions.jsonl"));
      oraclePredictions = await readJsonl(path.join(runPath, "qwen_switch_oracle_predictions.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed calibrated hybrid selector artifacts.`);
      continue;
    }
    if (result.artifact_type !== "calibrated_hybrid_selector") {
      errors.push(`${entry.name}: artifact_type must be calibrated_hybrid_selector.`);
    }
    if (!["hybrid_selector_minimum_positive_not_amortized", "hybrid_selector_support_positive_correctness_shortfall", "hybrid_selector_support_positive_coverage_shortfall", "hybrid_selector_negative"].includes(result.status)) {
      errors.push(`${entry.name}: invalid calibrated hybrid selector status.`);
    }
    if (predictions.length !== Number(result.examples) || scaffoldPredictions.length !== Number(result.examples) || oraclePredictions.length !== Number(result.examples)) {
      errors.push(`${entry.name}: prediction row counts must match examples.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: calibrated hybrid selector must be zero-cost.`);
    }
    for (const key of ["scaffold_priority", "calibrated_hybrid", "qwen_switch_oracle"]) {
      const metrics = result.selection_metrics?.[key] ?? {};
      for (const metric of ["examples", "answered", "answer_rate", "answer_support_rate", "overall_judged_correct_rate", "answer_citation_complete_rate"]) {
        if (!Number.isFinite(Number(metrics[metric]))) errors.push(`${entry.name}: ${key}.${metric} must be numeric.`);
      }
      if (Number(metrics.examples) !== Number(result.examples)) errors.push(`${entry.name}: ${key}.examples mismatch.`);
    }
    if (result.status === "hybrid_selector_minimum_positive_not_amortized") {
      const metrics = result.selection_metrics?.calibrated_hybrid ?? {};
      if (Number(metrics.answer_rate) < 0.7 || Number(metrics.answer_support_rate) < 0.66 || Number(metrics.overall_judged_correct_rate) < 0.75) {
        errors.push(`${entry.name}: minimum-positive status requires coverage/support/correctness thresholds.`);
      }
    }
    if (!report.includes("Calibrated Hybrid Selector") || !report.includes("not a final amortized result")) {
      errors.push(`${entry.name}: report must identify calibrated hybrid selector and limitation.`);
    }
  }
}

async function validateQwenOnlyAmortizationDiagnosticRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen-only-amortization-diagnostic-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let report;
    let predictions;
    let highPrecisionPredictions;
    let oraclePredictions;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      predictions = await readJsonl(path.join(runPath, "predictions.jsonl"));
      highPrecisionPredictions = await readJsonl(path.join(runPath, "qwen_high_precision_predictions.jsonl"));
      oraclePredictions = await readJsonl(path.join(runPath, "qwen_judged_oracle_predictions.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen-only amortization diagnostic artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen_only_amortization_diagnostic") {
      errors.push(`${entry.name}: artifact_type must be qwen_only_amortization_diagnostic.`);
    }
    if (!["qwen_only_selector_minimum_positive", "qwen_only_oracle_coverage_shortfall", "qwen_only_selector_support_shortfall", "qwen_only_selector_coverage_shortfall"].includes(result.status)) {
      errors.push(`${entry.name}: invalid Qwen-only diagnostic status.`);
    }
    if (predictions.length !== Number(result.examples) || highPrecisionPredictions.length !== Number(result.examples) || oraclePredictions.length !== Number(result.examples)) {
      errors.push(`${entry.name}: prediction row counts must match examples.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: Qwen-only diagnostic must be zero-cost.`);
    }
    for (const key of ["qwen_heuristic", "qwen_high_precision", "qwen_judged_oracle"]) {
      const metrics = result.selection_metrics?.[key] ?? {};
      for (const metric of ["examples", "answered", "answer_rate", "answer_support_rate", "overall_judged_correct_rate", "answer_citation_complete_rate"]) {
        if (!Number.isFinite(Number(metrics[metric]))) errors.push(`${entry.name}: ${key}.${metric} must be numeric.`);
      }
      if (Number(metrics.examples) !== Number(result.examples)) errors.push(`${entry.name}: ${key}.examples mismatch.`);
    }
    if (Number(result.candidate_pool?.rows_with_qwen_candidate) !== Number(result.examples)) {
      errors.push(`${entry.name}: every row must have a Qwen candidate for this diagnostic.`);
    }
    if (!Array.isArray(result.threshold_sweep) || result.threshold_sweep.length < 10) {
      errors.push(`${entry.name}: threshold_sweep must include multiple settings.`);
    }
    if (result.status === "qwen_only_oracle_coverage_shortfall") {
      const metrics = result.selection_metrics?.qwen_judged_oracle ?? {};
      if (Number(metrics.answer_rate) >= 0.7) errors.push(`${entry.name}: oracle coverage shortfall status requires oracle answer_rate < 0.7.`);
    }
    if (!report.includes("Qwen-Only Amortization Diagnostic") || !report.includes("OpenAI-mini scaffold candidates are removed")) {
      errors.push(`${entry.name}: report must identify Qwen-only diagnostic and scaffold removal.`);
    }
  }
}

async function validateQwenCoverageGapScaffoldPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  const requiredOutputKeys = new Set(["answer_type", "answer", "citations", "claim_table", "abstention_reason"]);
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen-coverage-gap-scaffold-packet-")) continue;
    const runPath = path.join(runsDir, entry.name);
    const datasetPath = path.join(runPath, "dataset");
    let result;
    let report;
    let readme;
    let sftTrain;
    let sftValidation;
    let dpoTrain;
    let dpoValidation;
    let evalPrompts;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      readme = await fs.readFile(path.join(datasetPath, "README.md"), "utf8");
      sftTrain = await readJsonl(path.join(datasetPath, "sft_train.jsonl"));
      sftValidation = await readJsonl(path.join(datasetPath, "sft_validation.jsonl"));
      dpoTrain = await readJsonl(path.join(datasetPath, "dpo_train.jsonl"));
      dpoValidation = await readJsonl(path.join(datasetPath, "dpo_validation.jsonl"));
      evalPrompts = await readJsonl(path.join(datasetPath, "qwen_miss_eval_prompts.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen coverage-gap scaffold packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen_coverage_gap_scaffold_packet") {
      errors.push(`${entry.name}: artifact_type must be qwen_coverage_gap_scaffold_packet.`);
    }
    if (!["ready_for_launch_packet_merge", "analog_coverage_ready_dpo_sparse", "train_ready_validation_sparse", "insufficient_analog_coverage"].includes(result.status)) {
      errors.push(`${entry.name}: invalid Qwen coverage-gap packet status.`);
    }
    if (Number(result.budget?.openai_calls) !== 0 || Number(result.budget?.openai_cost_usd) !== 0 || Number(result.budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: Qwen coverage-gap packet must be zero-cost.`);
    }
    if (result.examples?.sft_train !== sftTrain.length) errors.push(`${entry.name}: sft_train count mismatch.`);
    if (result.examples?.sft_validation !== sftValidation.length) errors.push(`${entry.name}: sft_validation count mismatch.`);
    if (result.examples?.dpo_train !== dpoTrain.length) errors.push(`${entry.name}: dpo_train count mismatch.`);
    if (result.examples?.dpo_validation !== dpoValidation.length) errors.push(`${entry.name}: dpo_validation count mismatch.`);
    if (result.examples?.qwen_miss_eval_prompts !== evalPrompts.length) errors.push(`${entry.name}: qwen_miss_eval_prompts count mismatch.`);
    if (Number(result.upstream_evidence?.qwen_oracle_answerable_miss_examples) !== 9 || evalPrompts.length !== 9) {
      errors.push(`${entry.name}: packet must preserve the nine Qwen-oracle answerable miss prompts.`);
    }
    const leakage = result.curriculum?.leakage_guard ?? {};
    if (leakage.passes !== true || (leakage.train_eval_shared_papers ?? []).length !== 0 || (leakage.validation_eval_shared_papers ?? []).length !== 0) {
      errors.push(`${entry.name}: train/validation papers must be disjoint from final eval papers.`);
    }
    const target = result.quality_gates?.target_profile_counts ?? {};
    for (const key of ["yes_no", "numeric", "list", "multi_evidence"]) {
      if (Number(target[key]) <= 0) errors.push(`${entry.name}: missing target profile count for ${key}.`);
      if (result.status === "ready_for_launch_packet_merge" && Number(result.quality_gates?.train_summary?.[`sft_${key}`]) < 10) {
        errors.push(`${entry.name}: ready packet needs at least 10 train SFT analogs for ${key}.`);
      }
      if (result.status === "ready_for_launch_packet_merge" && Number(result.quality_gates?.validation_summary?.[`sft_${key}`]) < 3) {
        errors.push(`${entry.name}: ready packet needs at least 3 validation SFT analogs for ${key}.`);
      }
    }
    for (const [index, row] of sftTrain.concat(sftValidation).entries()) {
      const label = `${entry.name}.sft:${index + 1}`;
      if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${label}: expected three chat messages.`);
      let parsed;
      try {
        parsed = JSON.parse(row.messages?.[2]?.content);
      } catch {
        errors.push(`${label}: assistant message must be JSON.`);
        continue;
      }
      validateStandardAnswerOutput(parsed, requiredOutputKeys, label);
      if (JSON.stringify(parsed) !== JSON.stringify(row.target)) errors.push(`${label}: target must match assistant JSON.`);
      if (row.label_source?.final_window_label_used !== false || row.label_source?.qwen_gap_targeted !== true) {
        errors.push(`${label}: label_source must mark qwen gap targeting without final-window labels.`);
      }
    }
    for (const [index, row] of dpoTrain.concat(dpoValidation).entries()) {
      const label = `${entry.name}.dpo:${index + 1}`;
      if (!Array.isArray(row.prompt) || row.prompt.length !== 2) errors.push(`${label}: expected two-message prompt.`);
      for (const key of ["chosen", "rejected"]) {
        let parsed;
        try {
          parsed = JSON.parse(row[key]);
        } catch {
          errors.push(`${label}: ${key} must be JSON.`);
          continue;
        }
        validateStandardAnswerOutput(parsed, requiredOutputKeys, `${label}.${key}`);
      }
      if (row.label_source?.final_window_label_used !== false || row.label_source?.qwen_gap_targeted !== true) {
        errors.push(`${label}: label_source must mark qwen gap targeting without final-window labels.`);
      }
    }
    if (!evalPrompts.every((row) => row.training_use === "forbidden_final_window_diagnostic_only")) {
      errors.push(`${entry.name}: Qwen-miss eval prompts must be diagnostic-only.`);
    }
    if (result.decision?.launch_next_gpu_now !== false) {
      errors.push(`${entry.name}: packet must not authorize immediate GPU launch.`);
    }
    if (!report.includes("Qwen Coverage-Gap Scaffold Packet") || !report.includes("No OpenAI calls")) {
      errors.push(`${entry.name}: report must identify Qwen coverage-gap packet and zero-cost status.`);
    }
    if (!readme.includes("Final-window rows are diagnostic prompts only")) {
      errors.push(`${entry.name}: dataset README must state final-window diagnostic-only guard.`);
    }
  }
}

async function validateV13SupportDeltaSupervisionPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  const requiredOutputKeys = new Set(["answer_type", "answer", "citations", "claim_table", "abstention_reason"]);
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("v13-support-delta-supervision-packet-")) continue;
    const runPath = path.join(runsDir, entry.name);
    const datasetPath = path.join(runPath, "dataset");
    let result;
    let report;
    let readme;
    let sftTrain;
    let sftValidation;
    let dpoTrain;
    let dpoValidation;
    let diagnosticRows;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      readme = await fs.readFile(path.join(datasetPath, "README.md"), "utf8");
      sftTrain = await readJsonl(path.join(datasetPath, "sft_train.jsonl"));
      sftValidation = await readJsonl(path.join(datasetPath, "sft_validation.jsonl"));
      dpoTrain = await readJsonl(path.join(datasetPath, "dpo_train.jsonl"));
      dpoValidation = await readJsonl(path.join(datasetPath, "dpo_validation.jsonl"));
      diagnosticRows = await readJsonl(path.join(datasetPath, "diagnostic_delta_rows.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed v13 support-delta packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "v13_support_delta_supervision_packet") {
      errors.push(`${entry.name}: artifact_type must be v13_support_delta_supervision_packet.`);
    }
    if (!["ready_for_launch_packet_merge_after_validator", "ready_but_final_hard_negative_signal_sparse", "analog_coverage_ready_dpo_sparse", "insufficient_analog_coverage"].includes(result.status)) {
      errors.push(`${entry.name}: invalid v13 support-delta packet status.`);
    }
    if (Number(result.budget?.openai_calls) !== 0 || Number(result.budget?.openai_cost_usd) !== 0 || Number(result.budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: v13 support-delta packet must be zero-cost.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: llm_budget must record zero calls and zero external compute.`);
    }
    if (result.examples?.sft_train !== sftTrain.length) errors.push(`${entry.name}: sft_train count mismatch.`);
    if (result.examples?.sft_validation !== sftValidation.length) errors.push(`${entry.name}: sft_validation count mismatch.`);
    if (result.examples?.dpo_train !== dpoTrain.length) errors.push(`${entry.name}: dpo_train count mismatch.`);
    if (result.examples?.dpo_validation !== dpoValidation.length) errors.push(`${entry.name}: dpo_validation count mismatch.`);
    if (result.examples?.diagnostic_delta_rows !== diagnosticRows.length) errors.push(`${entry.name}: diagnostic_delta_rows count mismatch.`);
    if (result.diagnostic?.summary?.final_window_labels_used_for_training !== false) {
      errors.push(`${entry.name}: final-window labels must be diagnostic-only, not training labels.`);
    }
    if (!diagnosticRows.every((row) => row.final_window_training_use === "forbidden_diagnostic_profile_only")) {
      errors.push(`${entry.name}: every diagnostic delta row must forbid final-window training use.`);
    }
    const diagnosticSummary = result.diagnostic?.summary ?? {};
    if (Number(diagnosticSummary.positives) < 10) errors.push(`${entry.name}: expected at least 10 positive diagnostic profile rows.`);
    if (Number(diagnosticSummary.hard_negatives) < 10) errors.push(`${entry.name}: expected at least 10 hard-negative diagnostic profile rows.`);
    if (Number(diagnosticSummary.targeted_gap_rows) !== 9) errors.push(`${entry.name}: expected all nine v13 targeted gap rows in diagnostics.`);
    const leakage = result.source_data?.leakage_guard ?? {};
    if (leakage.passes !== true || (leakage.train_eval_shared_papers ?? []).length !== 0 || (leakage.validation_eval_shared_papers ?? []).length !== 0) {
      errors.push(`${entry.name}: train/validation papers must be disjoint from final eval papers.`);
    }
    const target = result.quality_gates?.target_profile_counts ?? {};
    for (const key of ["yes_no", "numeric", "list", "multi_evidence"]) {
      if (Number(target[key]) <= 0) errors.push(`${entry.name}: missing target profile count for ${key}.`);
      if (String(result.status).startsWith("ready") && Number(result.quality_gates?.train_summary?.[`sft_${key}`]) < 10) {
        errors.push(`${entry.name}: ready packet needs at least 10 train SFT analogs for ${key}.`);
      }
      if (String(result.status).startsWith("ready") && Number(result.quality_gates?.validation_summary?.[`sft_${key}`]) < 3) {
        errors.push(`${entry.name}: ready packet needs at least 3 validation SFT analogs for ${key}.`);
      }
    }
    if (String(result.status).startsWith("ready") && Number(result.quality_gates?.train_summary?.dpo_rows) < Number(result.quality_gates?.train_summary?.sft_rows) * 2) {
      errors.push(`${entry.name}: ready train packet needs at least 2 DPO rows per SFT row.`);
    }
    if (String(result.status).startsWith("ready") && Number(result.quality_gates?.validation_summary?.dpo_rows) < Number(result.quality_gates?.validation_summary?.sft_rows) * 2) {
      errors.push(`${entry.name}: ready validation packet needs at least 2 DPO rows per SFT row.`);
    }
    for (const [index, row] of sftTrain.concat(sftValidation).entries()) {
      const label = `${entry.name}.sft:${index + 1}`;
      if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${label}: expected three chat messages.`);
      let parsed;
      try {
        parsed = JSON.parse(row.messages?.[2]?.content);
      } catch {
        errors.push(`${label}: assistant message must be JSON.`);
        continue;
      }
      validateStandardAnswerOutput(parsed, requiredOutputKeys, label);
      if (JSON.stringify(parsed) !== JSON.stringify(row.target)) errors.push(`${label}: target must match assistant JSON.`);
      if (row.label_source?.final_window_label_used !== false || row.label_source?.delta_run !== result.source_runs?.delta_run) {
        errors.push(`${label}: label_source must mark the delta run and forbid final-window labels.`);
      }
    }
    for (const [index, row] of dpoTrain.concat(dpoValidation).entries()) {
      const label = `${entry.name}.dpo:${index + 1}`;
      if (!Array.isArray(row.prompt) || row.prompt.length !== 2) errors.push(`${label}: expected two-message prompt.`);
      for (const key of ["chosen", "rejected"]) {
        let parsed;
        try {
          parsed = JSON.parse(row[key]);
        } catch {
          errors.push(`${label}: ${key} must be JSON.`);
          continue;
        }
        validateStandardAnswerOutput(parsed, requiredOutputKeys, `${label}.${key}`);
      }
      if (row.label_source?.final_window_label_used !== false || row.label_source?.delta_run !== result.source_runs?.delta_run) {
        errors.push(`${label}: label_source must mark the delta run and forbid final-window labels.`);
      }
    }
    if (result.decision?.launch_next_gpu_now !== false) {
      errors.push(`${entry.name}: packet must not authorize immediate GPU launch.`);
    }
    if (!report.includes("V13 Support-Delta Supervision Packet") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify v13 support-delta packet and zero-cost status.`);
    }
    if (!readme.includes("Final-window v13 rows are diagnostic profile sources only")) {
      errors.push(`${entry.name}: dataset README must state final-window diagnostic-only guard.`);
    }
  }
}

async function validateQwenCoverageGapScaffoldLaunchPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  const allowedOutputKeys = new Set(["answer_type", "answer", "citations", "claim_table", "abstention_reason"]);
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-gpu-prep-qwen7b-qwen-coverage-gap-scaffold-curriculum-")) continue;
    const runPath = path.join(runsDir, entry.name);
    const datasetPath = path.join(runPath, "dataset");
    let result;
    let report;
    let readme;
    let sftTrain;
    let sftValidation;
    let dpoTrain;
    let dpoValidation;
    let evalPrompts;
    let trainScript;
    let smokeRunner;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      readme = await fs.readFile(path.join(datasetPath, "README.md"), "utf8");
      trainScript = await fs.readFile(path.join(runPath, "train_joint_action_lora_uv.py"), "utf8");
      smokeRunner = await fs.readFile(path.join(runPath, "run_joint_action_smoke.sh"), "utf8");
      await fs.access(path.join(runPath, "validate_joint_action_dataset_uv.py"));
      await fs.access(path.join(runPath, "eval_joint_action_adapter_uv.py"));
      await fs.access(path.join(runPath, "run_prime_qwen3b_smoke_on_pod.sh"));
      await fs.access(path.join(runPath, "prime_gpu_plan.md"));
      sftTrain = await readJsonl(path.join(datasetPath, "sft_train.jsonl"));
      sftValidation = await readJsonl(path.join(datasetPath, "sft_validation.jsonl"));
      dpoTrain = await readJsonl(path.join(datasetPath, "dpo_train.jsonl"));
      dpoValidation = await readJsonl(path.join(datasetPath, "dpo_validation.jsonl"));
      evalPrompts = await readJsonl(path.join(datasetPath, "eval_prompts.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen coverage-gap launch packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen_coverage_gap_scaffold_launch_packet") {
      errors.push(`${entry.name}: artifact_type must be qwen_coverage_gap_scaffold_launch_packet.`);
    }
    if (result.status !== "ready_for_bounded_gpu_smoke_after_preflight") {
      errors.push(`${entry.name}: launch packet must be preflight-ready but not treated as result evidence.`);
    }
    if (result.curriculum?.type !== "qwen_coverage_gap_scaffold_v13_launch") {
      errors.push(`${entry.name}: unexpected Qwen coverage-gap launch curriculum type.`);
    }
    if (Number(result.budget?.openai_calls) !== 0 || Number(result.budget?.openai_cost_usd) !== 0 || Number(result.budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: launch packet materialization must be zero-cost.`);
    }
    if (!trainScript.includes("MAX_SFT_STEPS") || !trainScript.includes("MAX_DPO_STEPS") || trainScript.includes("\ndpo.push_to_hub()\n")) {
      errors.push(`${entry.name}: training script must be bounded and avoid unconditional hub pushes.`);
    }
    if (!smokeRunner.includes("MAX_SFT_STEPS") || !smokeRunner.includes("MAX_DPO_STEPS") || !smokeRunner.includes("eval_joint_action_adapter_uv.py")) {
      errors.push(`${entry.name}: smoke runner must validate, train with step caps, and evaluate predictions.`);
    }
    if (Number(result.estimated_gpu_cost_usd) <= 0 || Number(result.launch_gate?.projected_total_after_smoke_usd) >= Number(result.budget?.max_budget_usd)) {
      errors.push(`${entry.name}: estimated smoke must remain within budget.`);
    }
    if (result.examples?.sft_train !== sftTrain.length) errors.push(`${entry.name}: sft_train count mismatch.`);
    if (result.examples?.sft_validation !== sftValidation.length) errors.push(`${entry.name}: sft_validation count mismatch.`);
    if (result.examples?.dpo_train !== dpoTrain.length) errors.push(`${entry.name}: dpo_train count mismatch.`);
    if (result.examples?.dpo_validation !== dpoValidation.length) errors.push(`${entry.name}: dpo_validation count mismatch.`);
    if (result.examples?.eval_prompts !== evalPrompts.length) errors.push(`${entry.name}: eval_prompts count mismatch.`);
    if (evalPrompts.length !== 69) errors.push(`${entry.name}: final eval prompt count must remain 69.`);
    if (result.quality_gates?.eval_prompts_unchanged_from_base !== true) {
      errors.push(`${entry.name}: eval prompts must be unchanged from the base final-window packet.`);
    }
    if (result.quality_gates?.qwen_miss_prompts_training_use !== "diagnostic_only_not_merged") {
      errors.push(`${entry.name}: Qwen-miss prompts must remain diagnostic-only and unmerged.`);
    }
    const leakage = result.curriculum?.leakage_guard ?? {};
    if (leakage.final_eval_labels_used_for_training !== false || leakage.source_scaffold_guard_passes !== true) {
      errors.push(`${entry.name}: launch packet must preserve scaffold leakage guard.`);
    }
    if ((leakage.train_eval_paper_overlap ?? []).length !== 0 || (leakage.validation_eval_paper_overlap ?? []).length !== 0) {
      errors.push(`${entry.name}: eval papers must be disjoint from train and validation.`);
    }
    if (Number(result.examples?.scaffold_sft_train_added) <= 0 || Number(result.examples?.scaffold_dpo_train_added) <= 0) {
      errors.push(`${entry.name}: launch packet must add scaffold SFT and DPO rows.`);
    }
    if (Number(result.examples?.qwen_miss_eval_prompts_diagnostic_only) !== 9) {
      errors.push(`${entry.name}: launch packet must record nine diagnostic-only Qwen-miss prompts.`);
    }
    if (result.launch_gate?.launch_next_gpu_now !== false) {
      errors.push(`${entry.name}: packet materialization must not itself authorize immediate launch.`);
    }
    for (const [index, row] of sftTrain.concat(sftValidation).entries()) {
      const label = `${entry.name}.sft:${index + 1}`;
      if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${label}: expected three chat messages.`);
      let parsed;
      try {
        parsed = JSON.parse(row.messages?.[2]?.content);
      } catch {
        errors.push(`${label}: assistant message must be JSON.`);
        continue;
      }
      validateStandardAnswerOutput(parsed, allowedOutputKeys, label);
      if (JSON.stringify(parsed) !== JSON.stringify(row.target)) errors.push(`${label}: target must match assistant message JSON.`);
    }
    for (const [index, row] of dpoTrain.concat(dpoValidation).entries()) {
      const label = `${entry.name}.dpo:${index + 1}`;
      if (!Array.isArray(row.prompt) || row.prompt.length !== 2) errors.push(`${label}: expected two-message prompt.`);
      for (const key of ["chosen", "rejected"]) {
        let parsed;
        try {
          parsed = JSON.parse(row[key]);
        } catch {
          errors.push(`${label}: ${key} must be JSON.`);
          continue;
        }
        validateStandardAnswerOutput(parsed, allowedOutputKeys, `${label}.${key}`);
      }
    }
    if (!sftTrain.some((row) => String(row.messages?.[1]?.content ?? "").includes("Qwen coverage-gap scaffold hints"))) {
      errors.push(`${entry.name}: train set must include Qwen coverage-gap scaffold hint rows.`);
    }
    if (!report.includes("Qwen Coverage-Gap Scaffold Launch Packet") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify launch packet and zero-cost materialization.`);
    }
    if (!readme.includes("diagnostic-only and are not merged")) {
      errors.push(`${entry.name}: dataset README must state Qwen-miss diagnostic prompts are not merged.`);
    }
  }
}

async function validateV13SupportDeltaLaunchPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  const allowedOutputKeys = new Set(["answer_type", "answer", "citations", "claim_table", "abstention_reason"]);
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-gpu-prep-qwen7b-v13-support-delta-curriculum-")) continue;
    const runPath = path.join(runsDir, entry.name);
    const datasetPath = path.join(runPath, "dataset");
    let result;
    let report;
    let readme;
    let sftTrain;
    let sftValidation;
    let dpoTrain;
    let dpoValidation;
    let evalPrompts;
    let trainScript;
    let smokeRunner;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      readme = await fs.readFile(path.join(datasetPath, "README.md"), "utf8");
      trainScript = await fs.readFile(path.join(runPath, "train_joint_action_lora_uv.py"), "utf8");
      smokeRunner = await fs.readFile(path.join(runPath, "run_joint_action_smoke.sh"), "utf8");
      await fs.access(path.join(runPath, "validate_joint_action_dataset_uv.py"));
      await fs.access(path.join(runPath, "eval_joint_action_adapter_uv.py"));
      await fs.access(path.join(runPath, "run_prime_qwen3b_smoke_on_pod.sh"));
      await fs.access(path.join(runPath, "prime_gpu_plan.md"));
      sftTrain = await readJsonl(path.join(datasetPath, "sft_train.jsonl"));
      sftValidation = await readJsonl(path.join(datasetPath, "sft_validation.jsonl"));
      dpoTrain = await readJsonl(path.join(datasetPath, "dpo_train.jsonl"));
      dpoValidation = await readJsonl(path.join(datasetPath, "dpo_validation.jsonl"));
      evalPrompts = await readJsonl(path.join(datasetPath, "eval_prompts.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed v13 support-delta launch packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "v13_support_delta_launch_packet") {
      errors.push(`${entry.name}: artifact_type must be v13_support_delta_launch_packet.`);
    }
    if (result.status !== "ready_for_bounded_gpu_smoke_after_preflight") {
      errors.push(`${entry.name}: launch packet must wait for bounded GPU smoke preflight.`);
    }
    if (result.curriculum?.type !== "v13_support_delta_v14_launch") {
      errors.push(`${entry.name}: unexpected v13 support-delta launch curriculum type.`);
    }
    if (Number(result.budget?.openai_calls) !== 0 || Number(result.budget?.openai_cost_usd) !== 0 || Number(result.budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: launch packet materialization must be zero-cost.`);
    }
    if (Number(result.budget?.max_budget_usd) !== 100 || Number(result.launch_gate?.projected_total_after_smoke_usd) >= 100) {
      errors.push(`${entry.name}: launch packet must preserve the $100 budget cap.`);
    }
    if (!trainScript.includes("MAX_SFT_STEPS") || !trainScript.includes("MAX_DPO_STEPS") || trainScript.includes("\ndpo.push_to_hub()\n")) {
      errors.push(`${entry.name}: training script must be bounded and avoid unconditional hub pushes.`);
    }
    if (!smokeRunner.includes("MAX_SFT_STEPS") || !smokeRunner.includes("MAX_DPO_STEPS") || !smokeRunner.includes("eval_joint_action_adapter_uv.py")) {
      errors.push(`${entry.name}: smoke runner must validate, train with step caps, and evaluate predictions.`);
    }
    if (result.examples?.sft_train !== sftTrain.length) errors.push(`${entry.name}: sft_train count mismatch.`);
    if (result.examples?.sft_validation !== sftValidation.length) errors.push(`${entry.name}: sft_validation count mismatch.`);
    if (result.examples?.dpo_train !== dpoTrain.length) errors.push(`${entry.name}: dpo_train count mismatch.`);
    if (result.examples?.dpo_validation !== dpoValidation.length) errors.push(`${entry.name}: dpo_validation count mismatch.`);
    if (result.examples?.eval_prompts !== evalPrompts.length || evalPrompts.length !== 69) {
      errors.push(`${entry.name}: launch packet must preserve 69 final eval prompts.`);
    }
    if (Number(result.examples?.support_delta_sft_train_added) < 100 || Number(result.examples?.support_delta_dpo_train_added) < 300) {
      errors.push(`${entry.name}: launch packet must add substantial support-delta SFT/DPO rows.`);
    }
    if (Number(result.examples?.diagnostic_delta_rows_not_merged) !== 39) {
      errors.push(`${entry.name}: v13 diagnostic rows must be counted but not merged.`);
    }
    const leakage = result.curriculum?.leakage_guard ?? {};
    if (leakage.final_eval_labels_used_for_training !== false || leakage.source_support_delta_guard_passes !== true || leakage.v13_diagnostic_rows_training_use !== "diagnostic_only_not_merged") {
      errors.push(`${entry.name}: launch packet must preserve support-delta leakage guards.`);
    }
    if ((leakage.train_eval_paper_overlap ?? []).length !== 0 || (leakage.validation_eval_paper_overlap ?? []).length !== 0) {
      errors.push(`${entry.name}: eval papers must be disjoint from train and validation.`);
    }
    if (result.quality_gates?.eval_prompts_unchanged_from_base !== true || result.quality_gates?.standard_output_contract !== true) {
      errors.push(`${entry.name}: eval prompts and output contract gates must pass.`);
    }
    if (result.quality_gates?.v13_coverage_gap_labels_carried_forward !== false) {
      errors.push(`${entry.name}: failed v13 coverage-gap labels must not be carried forward.`);
    }
    if (result.launch_gate?.launch_next_gpu_now !== false) {
      errors.push(`${entry.name}: launch packet must not authorize immediate GPU launch.`);
    }
    for (const requiredStep of ["Prime auth", "active pods", "live GPU availability"]) {
      if (!String(result.launch_gate?.required_before_launch ?? "").includes(requiredStep)) {
        errors.push(`${entry.name}: launch gate must require ${requiredStep}.`);
      }
    }
    for (const [index, row] of sftTrain.concat(sftValidation).entries()) {
      const label = `${entry.name}.sft:${index + 1}`;
      if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${label}: expected three chat messages.`);
      let parsed;
      try {
        parsed = JSON.parse(row.messages?.[2]?.content);
      } catch {
        errors.push(`${label}: assistant message must be JSON.`);
        continue;
      }
      validateStandardAnswerOutput(parsed, allowedOutputKeys, label);
      if (JSON.stringify(parsed) !== JSON.stringify(row.target)) errors.push(`${label}: target must match assistant message JSON.`);
    }
    for (const [index, row] of dpoTrain.concat(dpoValidation).entries()) {
      const label = `${entry.name}.dpo:${index + 1}`;
      if (!Array.isArray(row.prompt) || row.prompt.length !== 2) errors.push(`${label}: expected two-message prompt.`);
      for (const key of ["chosen", "rejected"]) {
        let parsed;
        try {
          parsed = JSON.parse(row[key]);
        } catch {
          errors.push(`${label}: ${key} must be JSON.`);
          continue;
        }
        validateStandardAnswerOutput(parsed, allowedOutputKeys, `${label}.${key}`);
      }
    }
    if (!sftTrain.some((row) => String(row.messages?.[1]?.content ?? "").includes("V13 support-delta hints"))) {
      errors.push(`${entry.name}: train set must include V13 support-delta hint rows.`);
    }
    if (!report.includes("V13 Support-Delta Launch Packet") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify launch packet and zero-cost materialization.`);
    }
    if (!readme.includes("failed v13 broad coverage-gap labels are not carried forward")) {
      errors.push(`${entry.name}: dataset README must state failed v13 coverage labels are not carried forward.`);
    }
  }
}

function validateStandardAnswerOutput(output, requiredOutputKeys, label) {
  for (const key of requiredOutputKeys) {
    if (!(key in (output ?? {}))) errors.push(`${label}: output missing required key ${key}.`);
  }
  for (const key of Object.keys(output ?? {})) {
    if (!requiredOutputKeys.has(key)) errors.push(`${label}: output contains unsupported key ${key}.`);
  }
  if (!["grounded_answer", "abstain"].includes(output?.answer_type)) errors.push(`${label}: invalid answer_type.`);
  if (!Array.isArray(output?.citations)) errors.push(`${label}: citations must be an array.`);
  if (!Array.isArray(output?.claim_table)) errors.push(`${label}: claim_table must be an array.`);
  if (output?.answer_type === "grounded_answer") {
    for (const citation of output.citations ?? []) {
      if (!String(output.answer ?? "").includes(`[${citation}]`)) errors.push(`${label}: missing inline citation [${citation}].`);
    }
  }
  if (output?.answer_type === "abstain" && (output.citations ?? []).length !== 0) {
    errors.push(`${label}: abstentions must not include citations.`);
  }
}

async function validateRepairRegenerationSignalAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("repair-regeneration-signal-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed repair/regeneration signal audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "repair_regeneration_signal_audit") {
      errors.push(`${entry.name}: artifact_type must be repair_regeneration_signal_audit.`);
    }
    if (result.status !== "repair_regeneration_signal_present_but_untested") {
      errors.push(`${entry.name}: audit must pass while keeping trained-student results unproven.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: repair/regeneration signal audit must be zero-cost.`);
    }
    if (Number(result.oracle_gap?.examples_without_supported_answer_candidate) !== 34) {
      errors.push(`${entry.name}: audit must preserve the 34-example candidate-pool oracle gap.`);
    }
    if (result.unsupported_answer_repairability) {
      if (Number(result.unsupported_answer_repairability.citation_repair_candidate_rows) >= Number(result.unsupported_answer_repairability.answer_repair_or_regeneration_needed_rows)) {
        errors.push(`${entry.name}: unsupported-answer repairability must show answer repair/regeneration pressure exceeds citation-only repair.`);
      }
      if (!String(result.unsupported_answer_repairability.recommendation ?? "").toLowerCase().includes("repair/regeneration")) {
        errors.push(`${entry.name}: unsupported-answer repairability recommendation must mention repair/regeneration.`);
      }
    }
    if (Number(result.aggregate?.dpo_train?.repair_grounded_chosen_rows) < Number(result.oracle_gap?.examples_without_supported_answer_candidate)) {
      errors.push(`${entry.name}: train repair DPO rows must cover the oracle gap before GPU launch.`);
    }
    if (Number(result.aggregate?.dpo_train?.grounded_missing_inline_citation_rows) !== 0 || Number(result.aggregate?.dpo_train?.invalid_citation_rows) !== 0) {
      errors.push(`${entry.name}: train DPO grounded repair rows must have valid inline citations.`);
    }
    if (Number(result.aggregate?.dpo_validation?.grounded_missing_inline_citation_rows) !== 0 || Number(result.aggregate?.dpo_validation?.invalid_citation_rows) !== 0) {
      errors.push(`${entry.name}: validation DPO grounded repair rows must have valid inline citations.`);
    }
    if (Number(result.aggregate?.dpo_train?.identical_answer_text_repair_rows) !== 0 || Number(result.aggregate?.dpo_validation?.identical_answer_text_repair_rows) !== 0) {
      errors.push(`${entry.name}: repair contrasts must not be identical answer-text selection examples.`);
    }
    if (Number(result.aggregate?.sft_train?.repair_rows) <= 0 || Number(result.aggregate?.sft_train?.abstain_rows) <= 0 || Number(result.aggregate?.sft_train?.supported_answer_rows) <= 0) {
      errors.push(`${entry.name}: SFT train rows must include supported answers, repair, and abstention actions.`);
    }
    if ((result.aggregate?.split_integrity?.train_eval_paper_overlap ?? []).length !== 0 || (result.aggregate?.split_integrity?.validation_eval_paper_overlap ?? []).length !== 0) {
      errors.push(`${entry.name}: repair/regeneration audit must keep eval paper-disjoint from train/validation.`);
    }
    if (result.interpretation?.enough_signal_for_bounded_qwen_smoke !== true || !String(result.interpretation?.next_step ?? "").includes("bounded Qwen 3B smoke")) {
      errors.push(`${entry.name}: audit must point to the bounded Qwen smoke, not more selection-only routing.`);
    }
    if (!report.includes("Repair/Regeneration Signal Audit") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify the audit and zero-cost status.`);
    }
  }
}

async function validateQwen7bAnswerFormRegressionAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen7b-answer-form-regression-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const rowsPath = path.join(runsDir, entry.name, "rows.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let rows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      rows = await readJsonl(rowsPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen 7B answer-form regression audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen7b_answer_form_regression_audit") {
      errors.push(`${entry.name}: artifact_type must be qwen7b_answer_form_regression_audit.`);
    }
    if (!["v9_adds_no_unique_supported_coverage", "candidate_pool_still_below_coverage_target", "answer_form_regression_blocks_deployable_selector", "candidate_pool_has_supported_coverage_headroom"].includes(result.status)) {
      errors.push(`${entry.name}: invalid answer-form regression status.`);
    }
    if (Number(result.scope?.examples) !== 69 || rows.length !== 69) {
      errors.push(`${entry.name}: audit must cover exactly 69 final-window examples.`);
    }
    if (!Array.isArray(result.scope?.source_systems) || result.scope.source_systems.length !== 6) {
      errors.push(`${entry.name}: audit must include Qwen 7B v4-v9 source systems.`);
    }
    if (!result.scope.source_systems?.some((system) => system.short_id === "v9")) {
      errors.push(`${entry.name}: audit must include v9.`);
    }
    const v9 = result.system_summaries?.qwen7b_v9_span_claim;
    if (Number(v9?.answered) !== 28 || Number(v9?.supported_answers) !== 14 || Number(v9?.unsupported_answers) !== 14) {
      errors.push(`${entry.name}: v9 summary must match the judged span/claim smoke result.`);
    }
    if (!Number.isFinite(Number(result.v9_incremental_coverage?.v9_new_supported_answers_over_prior?.count))) {
      errors.push(`${entry.name}: v9 incremental supported coverage must be finite.`);
    }
    if (Number(result.answer_form_summary?.unsupported) !== 14) {
      errors.push(`${entry.name}: answer-form summary must account for the 14 unsupported v9 answers.`);
    }
    if (Number(result.answer_form_summary?.too_short_or_yes_no_unsupported) < 1) {
      errors.push(`${entry.name}: answer-form summary must expose short/underspecified unsupported answers.`);
    }
    if (Number(result.candidate_pool_oracle?.examples) !== 69 || !Number.isFinite(Number(result.candidate_pool_oracle?.answer_rate))) {
      errors.push(`${entry.name}: candidate-pool oracle must cover the 69-example final window.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: answer-form regression audit must be zero-cost.`);
    }
    if (!report.includes("Qwen 7B V4-V9 Answer-Form Regression Audit") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify the audit and zero-cost status.`);
    }
  }
}

async function validateQwen7bV10PostmortemAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen7b-v10-postmortem-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const rowsPath = path.join(runsDir, entry.name, "rows.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let rows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      rows = await readJsonl(rowsPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen 7B v10 postmortem audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen7b_v10_postmortem_audit") {
      errors.push(`${entry.name}: artifact_type must be qwen7b_v10_postmortem_audit.`);
    }
    if (!["v10_adds_no_new_supported_answerable_coverage", "expanded_candidate_pool_still_below_coverage_target", "v10_adds_candidate_pool_headroom_but_needs_selector"].includes(result.status)) {
      errors.push(`${entry.name}: invalid v10 postmortem status.`);
    }
    if (Number(result.scope?.examples) !== 69 || rows.length !== 69) {
      errors.push(`${entry.name}: postmortem must cover exactly 69 final-window examples.`);
    }
    if (!Array.isArray(result.scope?.source_systems) || result.scope.source_systems.length !== 7) {
      errors.push(`${entry.name}: postmortem must include Qwen 7B v4-v10 source systems.`);
    }
    if (!result.scope.source_systems?.some((system) => system.short_id === "v10")) {
      errors.push(`${entry.name}: postmortem must include v10.`);
    }
    const v10 = result.system_summaries?.qwen7b_v10_answer_completion;
    if (Number(v10?.answered) !== 22 || Number(v10?.supported_answers) !== 7 || Number(v10?.unsupported_answers) !== 15) {
      errors.push(`${entry.name}: v10 summary must match the judged answer-completion smoke result.`);
    }
    if (Number(result.v10_incremental_coverage?.v10_new_supported_answers_over_prior?.count) !== 0) {
      errors.push(`${entry.name}: v10 must expose zero unique supported answers over v4-v9.`);
    }
    if (Number(result.v10_incremental_coverage?.v10_supported_on_v4_v9_oracle_gap?.count) !== 0) {
      errors.push(`${entry.name}: v10 must expose zero supported answers on the v4-v9 oracle gap.`);
    }
    if (Number(result.expanded_v4_v10_oracle?.examples) !== 69 || Number(result.expanded_v4_v10_oracle?.answer_rate) >= 0.7) {
      errors.push(`${entry.name}: expanded oracle must cover 69 examples and remain below the 70% target.`);
    }
    if (Number(result.oracle_delta_from_v10?.supported_answers) !== 0) {
      errors.push(`${entry.name}: v10 must not improve the candidate-pool supported-answer oracle.`);
    }
    if (Number(result.coverage_gap_summary?.supported_answers_needed_for_70pct_query_rate) < 1) {
      errors.push(`${entry.name}: postmortem must preserve a positive supported-candidate gap to 70% answer rate.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: v10 postmortem audit must be zero-cost.`);
    }
    if (!report.includes("Qwen 7B V10 Postmortem Audit") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify the audit and zero-cost status.`);
    }
  }
}

async function validateOracleGapRepairAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("oracle-gap-repair-audit-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const rowsPath = path.join(runsDir, entry.name, "rows.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let rows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      rows = await readJsonl(rowsPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed oracle-gap repair audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "oracle_gap_repair_audit") {
      errors.push(`${entry.name}: artifact_type must be oracle_gap_repair_audit.`);
    }
    if (!["oracle_gap_mostly_span_recoverable", "oracle_gap_partly_recoverable_with_planning", "oracle_gap_needs_retrieval_or_complex_reasoning_change"].includes(result.status)) {
      errors.push(`${entry.name}: invalid oracle-gap repair status.`);
    }
    if (Number(result.scope?.examples) !== 13 || rows.length !== 13) {
      errors.push(`${entry.name}: oracle-gap repair audit must cover the 13 remaining answerable gap rows.`);
    }
    if (Number(result.summary?.examples) !== rows.length) {
      errors.push(`${entry.name}: summary examples must match rows.jsonl.`);
    }
    if (Number(result.summary?.high_recoverability_rows) + Number(result.summary?.partial_recoverability_rows) + Number(result.summary?.low_recoverability_rows) !== rows.length) {
      errors.push(`${entry.name}: recoverability buckets must partition rows.`);
    }
    if (Number(result.summary?.bucket_counts?.table_metric_or_numeric_answer) !== rows.length) {
      errors.push(`${entry.name}: current oracle gap must expose table/metric/numeric pressure on all rows.`);
    }
    if (Number(result.summary?.bucket_counts?.multi_evidence_reference_answer) < 1) {
      errors.push(`${entry.name}: oracle gap must expose multi-evidence synthesis pressure.`);
    }
    if (result.training_implication?.gpu_launch_ready !== false || !String(result.training_implication?.next_data_change ?? "").includes("mixed repair curriculum")) {
      errors.push(`${entry.name}: audit must block immediate GPU launch and require a mixed repair curriculum.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: oracle-gap repair audit must be zero-cost.`);
    }
    for (const [index, row] of rows.entries()) {
      const label = `${entry.name}.rows:${index + 1}`;
      if (!row.example_id || !Array.isArray(row.buckets) || !row.best_gold_span || !row.best_any_evidence_span || !row.recommended_signal) {
        errors.push(`${label}: missing row analysis fields.`);
      }
      if (!Number.isFinite(Number(row.best_gold_span?.token_f1)) || !Number.isFinite(Number(row.best_any_evidence_span?.token_f1))) {
        errors.push(`${label}: missing finite span token-F1 metrics.`);
      }
    }
    if (!report.includes("Oracle-Gap Repair Audit") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify the audit and zero-cost status.`);
    }
  }
}

async function validateQwen7bAnswerFormCounterfactualGateRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen7b-answer-form-counterfactual-gate-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const predictionsPath = path.join(runsDir, entry.name, "predictions.jsonl");
    const rowsPath = path.join(runsDir, entry.name, "rows.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let predictions;
    let rows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      predictions = await readJsonl(predictionsPath);
      rows = await readJsonl(rowsPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen 7B answer-form counterfactual gate artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen7b_answer_form_counterfactual_gate") {
      errors.push(`${entry.name}: artifact_type must be qwen7b_answer_form_counterfactual_gate.`);
    }
    if (!["answer_form_gate_improves_support_but_collapses_coverage", "answer_form_gate_preserves_coverage_with_support_gain", "answer_form_gate_no_support_gain"].includes(result.status)) {
      errors.push(`${entry.name}: invalid answer-form gate status.`);
    }
    if (Number(result.examples) !== 69 || rows.length !== 69 || predictions.length !== 69) {
      errors.push(`${entry.name}: gate must cover exactly 69 final-window examples.`);
    }
    if (!result.source_run_id || !result.source_judge_run_id || !result.failure_run_id) {
      errors.push(`${entry.name}: gate must record source prediction, judge, and failure-analysis runs.`);
    }
    if (Number(result.source_metrics?.answered) !== 28 || Number(result.source_metrics?.supported_answers) !== 14 || Number(result.source_metrics?.unsupported_answers) !== 14) {
      errors.push(`${entry.name}: source metrics must match v9 citation-repaired smoke.`);
    }
    if (Number(result.gated_metrics?.answered) >= Number(result.source_metrics?.answered)) {
      errors.push(`${entry.name}: counterfactual/answer-form gate should suppress at least one v9 answer.`);
    }
    if (Number(result.suppressions?.total) !== rows.filter((row) => row.gate_decision === "suppress_to_abstain").length) {
      errors.push(`${entry.name}: suppression count must match rows.jsonl.`);
    }
    if (Number(result.suppressions?.counterfactual_suppressions) < 1 || Number(result.suppressions?.harmful_answerable_suppressions) < 1) {
      errors.push(`${entry.name}: gate must expose both counterfactual suppressions and harmful answerable suppressions.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: answer-form counterfactual gate must be zero-cost.`);
    }
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (!row.example_id || !["keep_source", "suppress_to_abstain"].includes(row.gate_decision)) {
        errors.push(`${label}: missing example id or invalid gate decision.`);
      }
      if (row.gate_decision === "suppress_to_abstain" && row.prediction?.answer_type !== "abstain") {
        errors.push(`${label}: suppressed row must emit an abstention prediction.`);
      }
    }
    if (!report.includes("Qwen 7B V9 Answer-Form Counterfactual Gate") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify the gate and zero-cost status.`);
    }
  }
}

async function validateSupportRankerPairwisePacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("support-ranker-pairwise-packet-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const trainPath = path.join(runsDir, entry.name, "train_pairwise.jsonl");
    const validationPath = path.join(runsDir, entry.name, "validation_pairwise.jsonl");
    const diagnosticPath = path.join(runsDir, entry.name, "diagnostic_frontier_pairwise.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let trainRows;
    let validationRows;
    let diagnosticRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      trainRows = await readJsonl(trainPath);
      validationRows = await readJsonl(validationPath);
      diagnosticRows = await readJsonl(diagnosticPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed support-ranker pairwise packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "support_ranker_pairwise_packet") {
      errors.push(`${entry.name}: artifact_type must be support_ranker_pairwise_packet.`);
    }
    if (!["pairwise_packet_ready_for_ranker_training", "pairwise_signal_present_but_sparse", "pairwise_signal_insufficient"].includes(result.status)) {
      errors.push(`${entry.name}: invalid support-ranker pairwise packet status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: support-ranker pairwise packet must be zero-cost.`);
    }
    if (Number(result.aggregate?.train_pairs) !== trainRows.length || Number(result.aggregate?.validation_pairs) !== validationRows.length || Number(result.aggregate?.diagnostic_pairs) !== diagnosticRows.length) {
      errors.push(`${entry.name}: aggregate pair counts must match pairwise files.`);
    }
    if (result.windows?.final_diagnostic?.training_use !== "forbidden_diagnostic_only" || result.leakage_guard?.final_window_training_use !== "forbidden") {
      errors.push(`${entry.name}: final-window rows must be diagnostic-only.`);
    }
    if (Array.isArray(result.leakage_guard?.final_window_ids_in_train) && result.leakage_guard.final_window_ids_in_train.length) {
      errors.push(`${entry.name}: final-window ids must not appear in train rows.`);
    }
    if (Array.isArray(result.leakage_guard?.final_window_papers_in_train_or_validation) && result.leakage_guard.final_window_papers_in_train_or_validation.length) {
      errors.push(`${entry.name}: final-window papers must not appear in train or validation rows.`);
    }
    for (const [rows, split] of [[trainRows, "train"], [validationRows, "validation"]]) {
      for (const [index, row] of rows.entries()) {
        const label = `${entry.name}.${split}:${index + 1}`;
        const allowedTrainingUse = split === "train" ? "allowed_train" : "allowed_validation";
        if (!row.example_id || row.split !== split || row.training_use !== allowedTrainingUse) {
          errors.push(`${label}: missing id, split, or ${allowedTrainingUse} training_use.`);
        }
        if (!row.chosen?.answer || !row.rejected?.answer || !row.chosen?.features || !row.rejected?.features || !row.feature_delta) {
          errors.push(`${label}: missing chosen/rejected candidates, features, or feature_delta.`);
        }
      }
    }
    for (const [index, row] of diagnosticRows.entries()) {
      const label = `${entry.name}.diagnostic:${index + 1}`;
      if (!row.example_id || row.split !== "diagnostic_final_window" || row.training_use !== "forbidden_diagnostic_only") {
        errors.push(`${label}: diagnostic rows must be final diagnostic only.`);
      }
    }
    if (!report.includes("Support Ranker Pairwise Packet") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify the packet and zero-cost status.`);
    }
  }
}

async function validateLocalSupportRankerRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("local-support-ranker-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const validationPath = path.join(runsDir, entry.name, "validation_predictions.jsonl");
    const diagnosticPairsPath = path.join(runsDir, entry.name, "diagnostic_pair_predictions.jsonl");
    const diagnosticSelectionsPath = path.join(runsDir, entry.name, "diagnostic_selections.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let validationRows;
    let diagnosticPairRows;
    let diagnosticSelectionRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      validationRows = await readJsonl(validationPath);
      diagnosticPairRows = await readJsonl(diagnosticPairsPath);
      diagnosticSelectionRows = await readJsonl(diagnosticSelectionsPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed local support-ranker artifacts.`);
      continue;
    }
    if (result.artifact_type !== "local_support_ranker") {
      errors.push(`${entry.name}: artifact_type must be local_support_ranker.`);
    }
    if (!["ranker_promising_for_selector_integration", "ranker_transfers_to_validation_but_not_final_frontier", "ranker_not_reliable"].includes(result.status)) {
      errors.push(`${entry.name}: invalid local support-ranker status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: local support-ranker must be zero-cost.`);
    }
    if (Number(result.metrics?.validation?.pairs) !== validationRows.length || Number(result.metrics?.final_diagnostic_pairwise?.pairs) !== diagnosticPairRows.length || Number(result.metrics?.final_diagnostic_selection?.examples) !== diagnosticSelectionRows.length) {
      errors.push(`${entry.name}: metrics must match prediction files.`);
    }
    if (!Array.isArray(result.feature_names) || !result.feature_names.length || !result.model?.weights || !result.model?.scaler) {
      errors.push(`${entry.name}: missing feature names or model weights/scaler.`);
    }
    if (result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: local ranker cannot directly authorize GPU launch.`);
    }
    for (const [index, row] of validationRows.entries()) {
      const label = `${entry.name}.validation:${index + 1}`;
      if (!row.pair_id || !["chosen", "rejected"].includes(row.predicted_preferred) || typeof row.correct !== "boolean") {
        errors.push(`${label}: malformed validation prediction row.`);
      }
    }
    for (const [index, row] of diagnosticSelectionRows.entries()) {
      const label = `${entry.name}.diagnostic_selection:${index + 1}`;
      if (!row.example_id || !Number.isFinite(Number(row.candidate_count)) || typeof row.selected_supported_answer !== "boolean") {
        errors.push(`${label}: malformed diagnostic selection row.`);
      }
    }
    if (!report.includes("Local Support Ranker") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify the local ranker and zero-cost status.`);
    }
  }
}

async function validateEntailmentFeatureRankerRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("entailment-feature-ranker-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const validationPath = path.join(runsDir, entry.name, "validation_predictions.jsonl");
    const diagnosticPairsPath = path.join(runsDir, entry.name, "diagnostic_pair_predictions.jsonl");
    const diagnosticSelectionsPath = path.join(runsDir, entry.name, "diagnostic_selections.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let validationRows;
    let diagnosticPairRows;
    let diagnosticSelectionRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      validationRows = await readJsonl(validationPath);
      diagnosticPairRows = await readJsonl(diagnosticPairsPath);
      diagnosticSelectionRows = await readJsonl(diagnosticSelectionsPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed entailment-feature ranker artifacts.`);
      continue;
    }
    if (result.artifact_type !== "entailment_feature_ranker") {
      errors.push(`${entry.name}: artifact_type must be entailment_feature_ranker.`);
    }
    if (!["entailment_ranker_promising", "entailment_features_partial_signal", "entailment_features_not_sufficient"].includes(result.status)) {
      errors.push(`${entry.name}: invalid entailment-feature ranker status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: entailment-feature ranker must be zero-cost.`);
    }
    if (Number(result.metrics?.validation?.pairs) !== validationRows.length || Number(result.metrics?.final_diagnostic_pairwise?.pairs) !== diagnosticPairRows.length || Number(result.metrics?.final_diagnostic_selection?.examples) !== diagnosticSelectionRows.length) {
      errors.push(`${entry.name}: metrics must match prediction files.`);
    }
    if (!Array.isArray(result.feature_names) || result.feature_names.length < 10 || !result.model?.weights || !result.model?.scaler) {
      errors.push(`${entry.name}: missing feature names or model weights/scaler.`);
    }
    if (result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: entailment-feature ranker cannot directly authorize GPU launch.`);
    }
    for (const [index, row] of diagnosticSelectionRows.entries()) {
      const label = `${entry.name}.diagnostic_selection:${index + 1}`;
      if (!row.example_id || !Number.isFinite(Number(row.candidate_count)) || typeof row.selected_supported_answer !== "boolean") {
        errors.push(`${label}: malformed diagnostic selection row.`);
      }
    }
    if (!report.includes("Entailment Feature Ranker") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify the entailment-feature ranker and zero-cost status.`);
    }
  }
}

async function validatePacketNliRankerRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("packet-nli-ranker-")) continue;
    const resultPath = path.join(runsDir, entry.name, "result.json");
    const scoresPath = path.join(runsDir, entry.name, "nli-scores.jsonl");
    const validationPath = path.join(runsDir, entry.name, "validation_predictions.jsonl");
    const diagnosticPairsPath = path.join(runsDir, entry.name, "diagnostic_pair_predictions.jsonl");
    const diagnosticSelectionsPath = path.join(runsDir, entry.name, "diagnostic_selections.jsonl");
    const reportPath = path.join(runsDir, entry.name, "report.md");
    let result;
    let scores;
    let validationRows;
    let diagnosticPairRows;
    let diagnosticSelectionRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(resultPath, "utf8"));
      scores = await readJsonl(scoresPath);
      validationRows = await readJsonl(validationPath);
      diagnosticPairRows = await readJsonl(diagnosticPairsPath);
      diagnosticSelectionRows = await readJsonl(diagnosticSelectionsPath);
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed packet-NLI ranker artifacts.`);
      continue;
    }
    if (result.artifact_type !== "packet_nli_ranker") {
      errors.push(`${entry.name}: artifact_type must be packet_nli_ranker.`);
    }
    if (!["packet_nli_ranker_promising", "packet_nli_partial_signal", "packet_nli_not_sufficient"].includes(result.status)) {
      errors.push(`${entry.name}: invalid packet-NLI ranker status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: packet-NLI ranker must be zero-cost.`);
    }
    if (Number(result.data_summary?.unique_candidates) !== scores.length || Number(result.data_summary?.scored_candidates) !== scores.length) {
      errors.push(`${entry.name}: scored candidate count must match nli-scores.jsonl.`);
    }
    if (Number(result.metrics?.validation?.pairs) !== validationRows.length || Number(result.metrics?.final_diagnostic_pairwise?.pairs) !== diagnosticPairRows.length || Number(result.metrics?.final_diagnostic_selection?.examples) !== diagnosticSelectionRows.length) {
      errors.push(`${entry.name}: metrics must match prediction files.`);
    }
    if (!result.model?.model_id || !Array.isArray(result.feature_names) || result.feature_names.length < 5 || !result.learned_ranker?.weights) {
      errors.push(`${entry.name}: missing model id, feature names, or learned ranker weights.`);
    }
    if (result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: packet-NLI ranker cannot directly authorize GPU launch.`);
    }
    for (const [index, row] of scores.entries()) {
      const label = `${entry.name}.nli_scores:${index + 1}`;
      if (!row.candidate_key || !Number.isFinite(Number(row.nli?.entailment_min)) || !Array.isArray(row.nli?.hypotheses)) {
        errors.push(`${label}: malformed NLI score row.`);
      }
    }
    if (!report.includes("Packet NLI Ranker") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify the packet-NLI ranker and zero-cost status.`);
    }
  }
}

async function validateQwenNonfinalFrontierLaunchPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-gpu-prep-qwen7b-nonfinal-frontier-candidates-")) continue;
    const runPath = path.join(runsDir, entry.name);
    const datasetPath = path.join(runPath, "dataset");
    let result;
    let report;
    let readme;
    let sftTrain;
    let sftValidation;
    let dpoTrain;
    let dpoValidation;
    let evalPrompts;
    let trainScript;
    let smokeRunner;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      readme = await fs.readFile(path.join(datasetPath, "README.md"), "utf8");
      trainScript = await fs.readFile(path.join(runPath, "train_joint_action_lora_uv.py"), "utf8");
      smokeRunner = await fs.readFile(path.join(runPath, "run_joint_action_smoke.sh"), "utf8");
      await fs.access(path.join(runPath, "validate_joint_action_dataset_uv.py"));
      await fs.access(path.join(runPath, "eval_joint_action_adapter_uv.py"));
      await fs.access(path.join(runPath, "run_prime_qwen3b_smoke_on_pod.sh"));
      await fs.access(path.join(runPath, "prime_gpu_plan.md"));
      sftTrain = await readJsonl(path.join(datasetPath, "sft_train.jsonl"));
      sftValidation = await readJsonl(path.join(datasetPath, "sft_validation.jsonl"));
      dpoTrain = await readJsonl(path.join(datasetPath, "dpo_train.jsonl"));
      dpoValidation = await readJsonl(path.join(datasetPath, "dpo_validation.jsonl"));
      evalPrompts = await readJsonl(path.join(datasetPath, "eval_prompts.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen non-final frontier launch packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen_nonfinal_frontier_launch_packet") {
      errors.push(`${entry.name}: artifact_type must be qwen_nonfinal_frontier_launch_packet.`);
    }
    if (result.status !== "ready_for_bounded_gpu_candidate_generation_after_preflight") {
      errors.push(`${entry.name}: launch packet must wait for bounded GPU candidate-generation preflight.`);
    }
    if (Number(result.budget?.openai_calls) !== 0 || Number(result.budget?.openai_cost_usd) !== 0 || Number(result.budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: packet materialization must be zero-cost.`);
    }
    if (Number(result.budget?.max_budget_usd) !== 100 || Number(result.launch_gate?.projected_total_after_smoke_usd) > 100) {
      errors.push(`${entry.name}: launch packet must preserve the $100 budget cap.`);
    }
    if (result.launch_gate?.launch_next_gpu_now !== false) {
      errors.push(`${entry.name}: packet must not directly authorize GPU launch.`);
    }
    if (result.leakage_guard?.final_window_labels_used !== false || result.leakage_guard?.eval_window_is_final_window !== false || result.leakage_guard?.training_rows_filtered_to_train_source_papers !== true) {
      errors.push(`${entry.name}: leakage guard must reject final-window labels and require train-paper filtering.`);
    }
    if (Array.isArray(result.leakage_guard?.train_eval_paper_overlap) && result.leakage_guard.train_eval_paper_overlap.length) {
      errors.push(`${entry.name}: train and non-final eval papers must not overlap.`);
    }
    if (Array.isArray(result.leakage_guard?.final_window_ids_in_eval) && result.leakage_guard.final_window_ids_in_eval.length) {
      errors.push(`${entry.name}: final-window ids must not appear in non-final eval prompts.`);
    }
    if (Number(result.windows?.train_source_range?.[0]) !== 0 || Number(result.windows?.train_source_range?.[1]) !== 160) {
      errors.push(`${entry.name}: unexpected train source range.`);
    }
    if (Number(result.windows?.eval_source_range?.[0]) !== 240 || Number(result.windows?.eval_source_range?.[1]) !== 320) {
      errors.push(`${entry.name}: unexpected non-final eval source range.`);
    }
    if (Number(result.examples?.sft_train) !== sftTrain.length) errors.push(`${entry.name}: sft_train count mismatch.`);
    if (Number(result.examples?.sft_validation) !== sftValidation.length) errors.push(`${entry.name}: sft_validation count mismatch.`);
    if (Number(result.examples?.dpo_train) !== dpoTrain.length) errors.push(`${entry.name}: dpo_train count mismatch.`);
    if (Number(result.examples?.dpo_validation) !== dpoValidation.length) errors.push(`${entry.name}: dpo_validation count mismatch.`);
    if (Number(result.examples?.eval_prompts) !== evalPrompts.length || evalPrompts.length !== 80) {
      errors.push(`${entry.name}: eval prompt count must match the 240-320 non-final window.`);
    }
    if (!trainScript.includes("MAX_SFT_STEPS") || !trainScript.includes("MAX_DPO_STEPS") || trainScript.includes("\ndpo.push_to_hub()\n")) {
      errors.push(`${entry.name}: training script must be bounded and avoid unconditional hub pushes.`);
    }
    if (!smokeRunner.includes("MAX_SFT_STEPS") || !smokeRunner.includes("MAX_DPO_STEPS") || !smokeRunner.includes("eval_joint_action_adapter_uv.py")) {
      errors.push(`${entry.name}: smoke runner must validate, train with step caps, and evaluate predictions.`);
    }
    for (const [index, row] of evalPrompts.entries()) {
      const label = `${entry.name}.eval_prompts:${index + 1}`;
      if (row.task !== "citation_grounded_domain_qa_nonfinal_frontier_candidate_eval") {
        errors.push(`${label}: unexpected task.`);
      }
      if (row.metadata?.final_window !== false || row.eval_target?.final_window_training_use !== "not_final_window") {
        errors.push(`${label}: eval prompts must be marked non-final.`);
      }
      if (row.metadata?.candidate_generation_use !== "allowed_for_nonfinal_verifier_supervision_after_judging") {
        errors.push(`${label}: candidate-generation use must require post-run judging before supervision merge.`);
      }
      const sourceIndex = Number(row.metadata?.source_index);
      if (!Number.isFinite(sourceIndex) || sourceIndex < 240 || sourceIndex >= 320) {
        errors.push(`${label}: source_index must be in the 240-320 non-final window.`);
      }
    }
    if (!report.includes("Qwen Non-Final Frontier Launch Packet") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify the packet and zero-cost materialization.`);
    }
    if (!readme.includes("non-final") || !readme.includes("After predictions exist")) {
      errors.push(`${entry.name}: dataset README must describe non-final use and post-prediction judging.`);
    }
  }
}

async function validateQwenNonfinalFrontierPoolPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-gpu-prep-qwen7b-nonfinal-frontier-pool-")) continue;
    const runPath = path.join(runsDir, entry.name);
    const datasetPath = path.join(runPath, "dataset");
    let result;
    let report;
    let evalPrompts;
    let evalScript;
    let runner;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
      evalPrompts = await readJsonl(path.join(datasetPath, "eval_prompts.jsonl"));
      evalScript = await fs.readFile(path.join(runPath, "eval_joint_action_frontier_pool_uv.py"), "utf8");
      runner = await fs.readFile(path.join(runPath, "run_joint_action_frontier_pool.sh"), "utf8");
      await fs.access(path.join(runPath, "validate_joint_action_dataset_uv.py"));
      await fs.access(path.join(runPath, "train_joint_action_lora_uv.py"));
      await fs.access(path.join(runPath, "run_prime_qwen3b_smoke_on_pod.sh"));
      await fs.access(path.join(runPath, "prime_gpu_plan.md"));
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen non-final frontier pool packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen_nonfinal_frontier_pool_launch_packet") {
      errors.push(`${entry.name}: artifact_type must be qwen_nonfinal_frontier_pool_launch_packet.`);
    }
    if (result.status !== "ready_for_bounded_gpu_frontier_pool_after_preflight") {
      errors.push(`${entry.name}: frontier pool packet must wait for bounded GPU preflight.`);
    }
    if (Number(result.budget?.openai_calls) !== 0 || Number(result.budget?.openai_cost_usd) !== 0 || Number(result.budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: frontier pool packet materialization must be zero-cost.`);
    }
    if (Number(result.launch_gate?.projected_total_after_frontier_pool_usd) > Number(result.budget?.max_budget_usd)) {
      errors.push(`${entry.name}: projected frontier pool launch must remain within budget.`);
    }
    if (result.launch_gate?.launch_next_gpu_now !== false || result.launch_gate?.within_budget !== true) {
      errors.push(`${entry.name}: packet must remain gated and within budget.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.inherited_eval_window_is_final_window !== false) {
      errors.push(`${entry.name}: leakage guard must keep final-window labels out of training and eval.`);
    }
    if (result.leakage_guard?.expected_candidate_use !== "allowed_for_nonfinal_verifier_supervision_after_judging") {
      errors.push(`${entry.name}: candidate use must require post-run judging.`);
    }
    if (Number(result.eval_sampling?.num_return_sequences) < 2 || Number(result.eval_sampling?.projected_predictions) !== evalPrompts.length * Number(result.eval_sampling?.num_return_sequences)) {
      errors.push(`${entry.name}: frontier pool must project multiple candidates per eval prompt.`);
    }
    if (!evalScript.includes("NUM_RETURN_SEQUENCES") || !evalScript.includes("do_sample=True") || !evalScript.includes("root_example_id") || !evalScript.includes("candidate_pool_use")) {
      errors.push(`${entry.name}: eval script must emit sampled candidate-pool rows with root example ids.`);
    }
    if (!runner.includes("NUM_RETURN_SEQUENCES") || !runner.includes("eval_joint_action_frontier_pool_uv.py") || !runner.includes("MAX_SFT_STEPS") || !runner.includes("MAX_DPO_STEPS")) {
      errors.push(`${entry.name}: runner must expose sampling controls and bounded train caps.`);
    }
    for (const [index, row] of evalPrompts.entries()) {
      const label = `${entry.name}.eval_prompts:${index + 1}`;
      if (row.metadata?.final_window !== false || row.eval_target?.final_window_training_use !== "not_final_window") {
        errors.push(`${label}: eval prompt must remain non-final.`);
      }
      const sourceIndex = Number(row.metadata?.source_index);
      if (!Number.isFinite(sourceIndex) || sourceIndex < 240 || sourceIndex >= 320) {
        errors.push(`${label}: source_index must be in the 240-320 non-final window.`);
      }
    }
    if (!report.includes("Qwen Non-Final Frontier Pool Launch Packet") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify frontier pool packet and zero-cost materialization.`);
    }
  }
}

async function validateQwenNonfinalCitationRepairRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joint-action-qwen7b-nonfinal-frontier-candidates-") || !entry.name.endsWith("-citation-repair")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let predictions;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      predictions = await readJsonl(path.join(runPath, "predictions.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen non-final citation-repair artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen_nonfinal_citation_contract_repair") {
      errors.push(`${entry.name}: artifact_type must be qwen_nonfinal_citation_contract_repair.`);
    }
    if (Number(result.cost?.openai_calls) !== 0 || Number(result.cost?.openai_cost_usd) !== 0 || Number(result.cost?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: citation repair must be zero-cost.`);
    }
    if (Number(result.eval?.examples) !== predictions.length || predictions.length !== 80) {
      errors.push(`${entry.name}: repair predictions must contain the 80 non-final eval prompts.`);
    }
    if (Number(result.repair_summary?.repaired_inline_citations) <= 0 || Number(result.eval?.inline_citation_rate) <= Number(result.source_eval?.inline_citation_rate)) {
      errors.push(`${entry.name}: repair must improve inline citation coverage.`);
    }
    for (const [index, row] of predictions.entries()) {
      const label = `${entry.name}.predictions:${index + 1}`;
      if (row.metadata?.nonfinal_candidate_generation !== true || row.metadata?.scaffold !== "qwen_nonfinal_citation_repair") {
        errors.push(`${label}: missing non-final repair provenance.`);
      }
      if (row.prediction?.answer_type === "grounded_answer") {
        for (const citation of row.prediction.citations ?? []) {
          if (!String(row.prediction.answer ?? "").includes(`[${citation}]`)) {
            errors.push(`${label}: repaired answer missing inline citation [${citation}].`);
          }
        }
      }
    }
    if (!report.includes("Qwen Non-Final Citation Repair") || !report.includes("No OpenAI calls")) {
      errors.push(`${entry.name}: report must identify non-final citation repair and zero-cost status.`);
    }
  }
}

async function validateQwenNonfinalSupportLabelPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen-nonfinal-support-label-packet-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let labels;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      labels = await readJsonl(path.join(runPath, "support_labels.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen non-final support-label packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen_nonfinal_support_label_packet") {
      errors.push(`${entry.name}: artifact_type must be qwen_nonfinal_support_label_packet.`);
    }
    if (!["nonfinal_qwen_support_labels_ready", "nonfinal_qwen_support_labels_sparse"].includes(result.status)) {
      errors.push(`${entry.name}: invalid support-label packet status.`);
    }
    if (Number(result.counts?.rows) !== labels.length || labels.length !== 80) {
      errors.push(`${entry.name}: support label row count must match packet counts.`);
    }
    if (Number(result.counts?.supported_answers) < 20 || Number(result.counts?.unsupported_answers) < 20) {
      errors.push(`${entry.name}: support label packet must contain both supported and unsupported answer signal.`);
    }
    if (result.leakage_guard?.final_window_labels_used !== false || Number(result.leakage_guard?.final_window_rows) !== 0) {
      errors.push(`${entry.name}: support labels must be non-final only.`);
    }
    if (Number(result.cost?.packet_materialization_openai_calls) !== 0 || Number(result.cost?.packet_materialization_cost_usd) !== 0) {
      errors.push(`${entry.name}: packet materialization must not add OpenAI cost beyond inherited judge labels.`);
    }
    for (const [index, row] of labels.entries()) {
      const label = `${entry.name}.support_labels:${index + 1}`;
      if (row.training_use !== "allowed_nonfinal_support_supervision" || row.final_window !== false) {
        errors.push(`${label}: row must be marked non-final support supervision.`);
      }
      const sourceIndex = Number(row.source_index);
      if (!Number.isFinite(sourceIndex) || sourceIndex < 240 || sourceIndex >= 320) {
        errors.push(`${label}: source_index must be in the non-final 240-320 window.`);
      }
      if (!row.candidate?.answer_type || !row.judge?.verdict || !row.labels) {
        errors.push(`${label}: missing candidate, judge, or labels.`);
      }
    }
    if (!report.includes("Qwen Non-Final Support Label Packet") || !report.includes("leakage-safe non-final")) {
      errors.push(`${entry.name}: report must identify non-final support labels.`);
    }
  }
}

async function validateQwenFrontierPoolSupportPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen-frontier-pool-support-packet-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let labels;
    let rootSummaries;
    let contrastPairs;
    let trainPairs;
    let validationPairs;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      labels = await readJsonl(path.join(runPath, "support_labels.jsonl"));
      rootSummaries = await readJsonl(path.join(runPath, "root_group_summary.jsonl"));
      contrastPairs = await readJsonl(path.join(runPath, "frontier_contrast_pairs.jsonl"));
      trainPairs = await readJsonl(path.join(runPath, "train_contrast_pairs.jsonl"));
      validationPairs = await readJsonl(path.join(runPath, "validation_contrast_pairs.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen frontier-pool support packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen_frontier_pool_support_packet") {
      errors.push(`${entry.name}: artifact_type must be qwen_frontier_pool_support_packet.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: frontier-pool support packet materialization must be zero-cost.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.training_use !== "allowed_nonfinal_frontier_supervision") {
      errors.push(`${entry.name}: leakage guard must keep final-window labels out and mark non-final frontier supervision.`);
    }
    if (Number(result.counts?.support_labels) !== labels.length || Number(result.counts?.roots) !== rootSummaries.length || Number(result.counts?.frontier_contrast_pairs) !== contrastPairs.length) {
      errors.push(`${entry.name}: result counts must match support labels, root summaries, and contrast pairs.`);
    }
    if (Number(result.counts?.train_pairs) !== trainPairs.length || Number(result.counts?.validation_pairs) !== validationPairs.length) {
      errors.push(`${entry.name}: train/validation contrast pair counts must match files.`);
    }
    if (labels.length !== 240 || rootSummaries.length !== 80) {
      errors.push(`${entry.name}: expected 240 sampled labels over 80 non-final roots.`);
    }
    if (Number(result.counts?.supported_answers) < 40 || Number(result.counts?.unsupported_answers) < 100 || Number(result.counts?.generated_candidate_contrast_pairs) < 24) {
      errors.push(`${entry.name}: support packet must contain enough supported/unsupported answer and generated contrast signal.`);
    }
    if (result.decision?.launch_gpu_now !== false || result.decision?.buy_more_openai_labels_now !== false) {
      errors.push(`${entry.name}: support packet cannot authorize new paid spend.`);
    }
    for (const [index, row] of labels.entries()) {
      const label = `${entry.name}.support_labels:${index + 1}`;
      if (row.training_use !== "allowed_nonfinal_frontier_supervision" || !row.root_example_id || !row.example_id || !row.labels) {
        errors.push(`${label}: malformed non-final frontier support label.`);
      }
      const sourceIndex = Number(row.source_index);
      if (!Number.isFinite(sourceIndex) || sourceIndex < 240 || sourceIndex >= 320) {
        errors.push(`${label}: source_index must be in the 240-320 non-final window.`);
      }
      if (!row.prediction?.answer_type || !row.judge?.verdict || !row.input?.question) {
        errors.push(`${label}: missing prediction, judge, or input.`);
      }
    }
    for (const [index, pair] of contrastPairs.entries()) {
      const label = `${entry.name}.frontier_contrast_pairs:${index + 1}`;
      if (pair.training_use !== "allowed_nonfinal_frontier_supervision" || !pair.input?.question || !pair.chosen?.answer_type || !pair.rejected?.answer_type) {
        errors.push(`${label}: malformed non-final frontier contrast pair.`);
      }
      if (!["generated_supported_vs_generated_unsupported", "reference_supported_vs_generated_unsupported"].includes(pair.contrast_type)) {
        errors.push(`${label}: unexpected contrast type.`);
      }
      const sourceIndex = Number(pair.source_index);
      if (!Number.isFinite(sourceIndex) || sourceIndex < 240 || sourceIndex >= 320) {
        errors.push(`${label}: source_index must be in the 240-320 non-final window.`);
      }
    }
    if (!report.includes("Qwen Frontier Pool Support Packet") || !report.includes("no new API calls")) {
      errors.push(`${entry.name}: report must identify the frontier-pool support packet and zero-cost status.`);
    }
  }
}

async function validateQwenLabelSupportRankerRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen-label-support-ranker-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let qwenValidationRows;
    let validationPairRows;
    let diagnosticPairRows;
    let diagnosticSelectionRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      qwenValidationRows = await readJsonl(path.join(runPath, "qwen_validation_predictions.jsonl"));
      validationPairRows = await readJsonl(path.join(runPath, "validation_pair_predictions.jsonl"));
      diagnosticPairRows = await readJsonl(path.join(runPath, "diagnostic_pair_predictions.jsonl"));
      diagnosticSelectionRows = await readJsonl(path.join(runPath, "diagnostic_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen-label support-ranker artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen_label_support_ranker") {
      errors.push(`${entry.name}: artifact_type must be qwen_label_support_ranker.`);
    }
    if (!["qwen_label_ranker_promising_for_selector_integration", "qwen_label_ranker_improves_final_diagnostic_but_not_ready", "qwen_label_ranker_not_reliable"].includes(result.status)) {
      errors.push(`${entry.name}: invalid Qwen-label support-ranker status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: Qwen-label support ranker materialization must be zero-cost.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_diagnostic_training_use !== "forbidden_diagnostic_only" || result.leakage_guard?.qwen_validation_held_out_from_training !== true) {
      errors.push(`${entry.name}: leakage guard must preserve held-out Qwen validation and final diagnostic-only use.`);
    }
    if (Number(result.training?.qwen_train_source_index_range?.[1]) >= Number(result.training?.qwen_validation_source_index_range?.[0])) {
      errors.push(`${entry.name}: Qwen train source indices must precede validation source indices.`);
    }
    if (Number(result.metrics?.qwen_validation_pointwise?.examples) !== qwenValidationRows.length) {
      errors.push(`${entry.name}: qwen validation prediction count mismatch.`);
    }
    if (Number(result.metrics?.validation_pairwise?.pairs) !== validationPairRows.length) {
      errors.push(`${entry.name}: validation pair prediction count mismatch.`);
    }
    if (Number(result.metrics?.final_diagnostic_pairwise?.pairs) !== diagnosticPairRows.length) {
      errors.push(`${entry.name}: diagnostic pair prediction count mismatch.`);
    }
    if (Number(result.metrics?.final_diagnostic_selection?.examples) !== diagnosticSelectionRows.length) {
      errors.push(`${entry.name}: diagnostic selection count mismatch.`);
    }
    if (!Array.isArray(result.feature_names) || result.feature_names.length < 15 || !result.model?.weights || !result.model?.scaler) {
      errors.push(`${entry.name}: missing feature names or model weights/scaler.`);
    }
    if (result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: support ranker cannot directly authorize GPU launch.`);
    }
    for (const [index, row] of diagnosticSelectionRows.entries()) {
      const label = `${entry.name}.diagnostic_selection:${index + 1}`;
      if (!row.example_id || !Number.isFinite(Number(row.candidate_count)) || typeof row.selected_supported_answer !== "boolean") {
        errors.push(`${label}: malformed diagnostic selection row.`);
      }
    }
    if (!report.includes("Qwen Label Support Ranker") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify the Qwen-label ranker and zero-cost status.`);
    }
  }
}

async function validateQwenLabelRankerMissAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen-label-ranker-miss-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let misses;
    let auditRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      misses = await readJsonl(path.join(runPath, "misses.jsonl"));
      auditRows = await readJsonl(path.join(runPath, "diagnostic_audit.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen-label ranker miss-audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen_label_ranker_miss_audit") {
      errors.push(`${entry.name}: artifact_type must be qwen_label_ranker_miss_audit.`);
    }
    if (!["ranker_misses_require_stronger_verifier", "ranker_no_final_diagnostic_misses"].includes(result.status)) {
      errors.push(`${entry.name}: invalid miss-audit status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: miss audit must be zero-cost.`);
    }
    if (Number(result.summary?.diagnostic_examples) !== auditRows.length || Number(result.summary?.selected_unsupported) !== misses.length) {
      errors.push(`${entry.name}: miss counts must match audit rows.`);
    }
    if (misses.length && !result.summary?.miss_tag_counts?.unsupported_overclaim_ranked_high) {
      errors.push(`${entry.name}: miss audit must tag unsupported overclaims when misses exist.`);
    }
    for (const [index, row] of misses.entries()) {
      const label = `${entry.name}.misses:${index + 1}`;
      if (row.selected_supported_answer !== false || !row.best_supported_candidate_id || !Array.isArray(row.failure_tags) || !row.failure_tags.length) {
        errors.push(`${label}: malformed miss row.`);
      }
    }
    if (!report.includes("Qwen Label Ranker Miss Audit") || !report.includes("no OpenAI calls")) {
      errors.push(`${entry.name}: report must identify the miss audit and zero-cost status.`);
    }
  }
}

async function validateQwenOverclaimPenaltyAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen-overclaim-penalty-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let sweepRows;
    let targetPairs;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      sweepRows = await readJsonl(path.join(runPath, "penalty_sweep.jsonl"));
      targetPairs = await readJsonl(path.join(runPath, "verifier_target_pairs.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen overclaim penalty audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen_overclaim_penalty_audit") {
      errors.push(`${entry.name}: artifact_type must be qwen_overclaim_penalty_audit.`);
    }
    if (!["overclaim_verifier_needed", "deployable_heuristic_needs_nonfinal_confirmation"].includes(result.status)) {
      errors.push(`${entry.name}: invalid overclaim penalty audit status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: overclaim penalty audit must be zero-cost.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_diagnostic_training_use !== "forbidden_diagnostic_only") {
      errors.push(`${entry.name}: leakage guard must forbid final-window training use.`);
    }
    if (result.leakage_guard?.verifier_target_pairs_training_use !== "forbidden_final_diagnostic_only" || result.leakage_guard?.oracle_variants_are_deployable !== false) {
      errors.push(`${entry.name}: verifier targets and oracle variants must be explicitly non-deployable diagnostics.`);
    }
    const variantIds = new Set(sweepRows.map((row) => row.variant_id));
    for (const id of ["base_ranker", "deployable_short_citation_family_regularizer", "oracle_unsupported_claim_penalty"]) {
      if (!variantIds.has(id)) errors.push(`${entry.name}: missing penalty variant ${id}.`);
    }
    const base = sweepRows.find((row) => row.variant_id === "base_ranker");
    const oracle = sweepRows.find((row) => row.variant_id === "oracle_unsupported_claim_penalty");
    if (Number(result.summary?.diagnostic_examples) !== Number(base?.diagnostic_examples)) {
      errors.push(`${entry.name}: diagnostic example count must match base sweep row.`);
    }
    if (Number(result.summary?.base_selected_supported) !== Number(base?.selected_supported)) {
      errors.push(`${entry.name}: base supported count mismatch.`);
    }
    if (Number(result.summary?.oracle_overclaim_selected_supported) !== Number(oracle?.selected_supported)) {
      errors.push(`${entry.name}: oracle overclaim count mismatch.`);
    }
    if (Number(result.summary?.verifier_target_pairs) !== targetPairs.length) {
      errors.push(`${entry.name}: verifier target pair count mismatch.`);
    }
    for (const [index, row] of targetPairs.entries()) {
      const label = `${entry.name}.verifier_target_pairs:${index + 1}`;
      if (row.training_use !== "forbidden_final_diagnostic_only" || row.preference_label !== "prefer_best_supported") {
        errors.push(`${label}: target pair must be forbidden final diagnostic data preferring the supported candidate.`);
      }
      if (!row.selected_unsupported?.candidate_id || !row.best_supported?.candidate_id || !row.input?.question) {
        errors.push(`${label}: target pair missing candidates or input question.`);
      }
      if (!Array.isArray(row.selected_unsupported?.unsupported_claims) || row.selected_unsupported.unsupported_claims.length === 0) {
        errors.push(`${label}: selected candidate must expose unsupported claims.`);
      }
    }
    if (result.decision?.launch_gpu_now !== false || result.decision?.integrate_selector_now !== false) {
      errors.push(`${entry.name}: overclaim penalty audit cannot authorize GPU launch or selector integration.`);
    }
    if (!report.includes("Qwen Overclaim Penalty Audit") || !report.includes("no OpenAI calls") || !report.includes("forbidden_diagnostic_only")) {
      errors.push(`${entry.name}: report must identify zero-cost overclaim audit and leakage guard.`);
    }
  }
}

async function validateQwenContrastVerifierRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen-contrast-verifier-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let contrastPairs;
    let frontierPoolPairs = [];
    let frontierPoolValidationRows = [];
    let qwenValidationRows;
    let validationPairRows;
    let diagnosticPairRows;
    let diagnosticSelectionRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      contrastPairs = await readJsonl(path.join(runPath, "qwen_contrast_pairs.jsonl"));
      try {
        frontierPoolPairs = await readJsonl(path.join(runPath, "frontier_pool_contrast_pairs.jsonl"));
        frontierPoolValidationRows = await readJsonl(path.join(runPath, "frontier_pool_validation_contrast_predictions.jsonl"));
      } catch {
        frontierPoolPairs = [];
        frontierPoolValidationRows = [];
      }
      qwenValidationRows = await readJsonl(path.join(runPath, "qwen_validation_contrast_predictions.jsonl"));
      validationPairRows = await readJsonl(path.join(runPath, "validation_pair_predictions.jsonl"));
      diagnosticPairRows = await readJsonl(path.join(runPath, "diagnostic_pair_predictions.jsonl"));
      diagnosticSelectionRows = await readJsonl(path.join(runPath, "diagnostic_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen contrast verifier artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen_contrast_verifier") {
      errors.push(`${entry.name}: artifact_type must be qwen_contrast_verifier.`);
    }
    if (!["qwen_contrast_verifier_promising_for_selector_integration", "qwen_contrast_verifier_partial_signal", "qwen_contrast_verifier_not_sufficient"].includes(result.status)) {
      errors.push(`${entry.name}: invalid Qwen contrast verifier status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: Qwen contrast verifier must be zero-cost.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_diagnostic_training_use !== "forbidden_diagnostic_only") {
      errors.push(`${entry.name}: final-window labels must remain diagnostic-only.`);
    }
    if (result.leakage_guard?.qwen_contrast_training_use !== "allowed_nonfinal_support_supervision" || result.leakage_guard?.qwen_validation_held_out_from_training !== true) {
      errors.push(`${entry.name}: Qwen contrast train/validation guard must be explicit.`);
    }
    if (Number(result.training?.qwen_train_contrast_pairs) <= 0 || Number(result.training?.qwen_validation_contrast_pairs) <= 0) {
      errors.push(`${entry.name}: verifier must include non-final train and held-out contrast pairs.`);
    }
    if (Number(result.training?.qwen_train_contrast_pairs) + Number(result.training?.qwen_validation_contrast_pairs) !== contrastPairs.length) {
      errors.push(`${entry.name}: contrast pair count must match training split counts.`);
    }
    if (Number(result.training?.frontier_pool_train_pairs ?? 0) + Number(result.training?.frontier_pool_validation_pairs ?? 0) !== frontierPoolPairs.length) {
      errors.push(`${entry.name}: frontier-pool contrast pair count must match training split counts.`);
    }
    if (Number(result.metrics?.qwen_validation_contrast_pairwise?.pairs) !== qwenValidationRows.length) {
      errors.push(`${entry.name}: Qwen validation prediction count mismatch.`);
    }
    if (Number(result.metrics?.frontier_pool_validation_pairwise?.pairs ?? 0) !== frontierPoolValidationRows.length) {
      errors.push(`${entry.name}: frontier-pool validation prediction count mismatch.`);
    }
    if (Number(result.metrics?.existing_validation_pairwise?.pairs) !== validationPairRows.length) {
      errors.push(`${entry.name}: existing validation pair prediction count mismatch.`);
    }
    if (Number(result.metrics?.final_diagnostic_pairwise?.pairs) !== diagnosticPairRows.length) {
      errors.push(`${entry.name}: final diagnostic pair prediction count mismatch.`);
    }
    if (Number(result.metrics?.final_diagnostic_selection?.examples) !== diagnosticSelectionRows.length) {
      errors.push(`${entry.name}: final diagnostic selection count mismatch.`);
    }
    for (const [index, pair] of contrastPairs.entries()) {
      const label = `${entry.name}.qwen_contrast_pairs:${index + 1}`;
      if (pair.training_use !== "allowed_nonfinal_support_supervision" || pair.chosen?.family !== "qasper_reference" || pair.rejected?.family !== "qwen7b_nonfinal") {
        errors.push(`${label}: contrast must prefer a non-final reference over a Qwen unsupported answer.`);
      }
      if (!pair.input?.question || pair.chosen?.answer_type !== "grounded_answer" || pair.rejected?.answer_type !== "grounded_answer") {
        errors.push(`${label}: contrast must contain grounded question, chosen answer, and rejected answer.`);
      }
      const sourceIndex = Number(pair.source_index);
      if (!Number.isFinite(sourceIndex) || sourceIndex < 240 || sourceIndex >= 320) {
        errors.push(`${label}: source_index must be in the non-final 240-320 window.`);
      }
    }
    for (const [index, pair] of frontierPoolPairs.entries()) {
      const label = `${entry.name}.frontier_pool_contrast_pairs:${index + 1}`;
      if (pair.training_use !== "allowed_nonfinal_frontier_supervision" || !String(pair.source ?? "").startsWith("frontier_pool_")) {
        errors.push(`${label}: frontier-pool contrast must be marked as non-final frontier supervision.`);
      }
      if (!pair.input?.question || !pair.chosen?.answer_type || !pair.rejected?.answer_type) {
        errors.push(`${label}: frontier-pool contrast must contain question, chosen, and rejected outputs.`);
      }
      const sourceIndex = Number(pair.source_index);
      if (!Number.isFinite(sourceIndex) || sourceIndex < 240 || sourceIndex >= 320) {
        errors.push(`${label}: source_index must be in the non-final 240-320 window.`);
      }
    }
    if (result.decision?.launch_gpu_now !== false || result.decision?.buy_more_openai_labels_now !== false) {
      errors.push(`${entry.name}: contrast verifier cannot directly authorize more spend.`);
    }
    if (!report.includes("Qwen Contrast Verifier") || !report.includes("no OpenAI calls") || !report.includes("diagnostic-only")) {
      errors.push(`${entry.name}: report must identify the zero-cost contrast verifier and diagnostic-only final rows.`);
    }
  }
}

async function validateQwenFrontierDomainShiftAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("qwen-frontier-domain-shift-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let candidateRows;
    let missRows;
    let featureShiftRows;
    let riskyWeights;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      candidateRows = await readJsonl(path.join(runPath, "final_candidate_audit.jsonl"));
      missRows = await readJsonl(path.join(runPath, "final_selection_misses.jsonl"));
      featureShiftRows = await readJsonl(path.join(runPath, "feature_shift.jsonl"));
      riskyWeights = await readJsonl(path.join(runPath, "risky_weights.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed Qwen frontier domain-shift audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "qwen_frontier_domain_shift_audit") {
      errors.push(`${entry.name}: artifact_type must be qwen_frontier_domain_shift_audit.`);
    }
    if (!["domain_shift_confirms_proxy_verifier_failure", "domain_shift_partial_proxy_failure", "domain_shift_audit_no_major_proxy_failure"].includes(result.status)) {
      errors.push(`${entry.name}: invalid domain-shift audit status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: domain-shift audit must be zero-cost.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_diagnostic_training_use !== "forbidden_diagnostic_only" || result.leakage_guard?.audit_outputs_are_training_data !== false) {
      errors.push(`${entry.name}: leakage guard must keep final diagnostics out of training.`);
    }
    if (Number(result.summary?.final_candidates) !== candidateRows.length || Number(result.summary?.final_selected_unsupported) !== missRows.length || Number(result.summary?.feature_shift_rows) !== featureShiftRows.length) {
      errors.push(`${entry.name}: summary counts must match audit files.`);
    }
    if (Number(result.summary?.final_examples) !== 8 || Number(result.summary?.final_selected_supported) + Number(result.summary?.final_selected_unsupported) !== Number(result.summary?.final_examples)) {
      errors.push(`${entry.name}: final selection counts must cover the 8 diagnostic examples.`);
    }
    if (Number(result.summary?.risky_positive_proxy_weights) !== riskyWeights.filter((row) => row.risk_direction === "positive_proxy_for_unsupported").length) {
      errors.push(`${entry.name}: risky positive proxy weight count mismatch.`);
    }
    if (result.status === "domain_shift_confirms_proxy_verifier_failure" && Number(result.summary?.final_selection_support_rate) >= 0.5) {
      errors.push(`${entry.name}: confirmed proxy failure should have final support rate below 50%.`);
    }
    for (const [index, row] of missRows.entries()) {
      const label = `${entry.name}.final_selection_misses:${index + 1}`;
      if (row.selected_supported_answer !== false || !row.selected_candidate_id || !row.best_supported_candidate_id || !Array.isArray(row.failure_tags) || !row.failure_tags.length) {
        errors.push(`${label}: malformed final selection miss row.`);
      }
    }
    for (const [index, row] of featureShiftRows.entries()) {
      const label = `${entry.name}.feature_shift:${index + 1}`;
      if (!row.feature || !Number.isFinite(Number(row.model_weight)) || typeof row.direction_flipped !== "boolean") {
        errors.push(`${label}: malformed feature-shift row.`);
      }
    }
    if (result.decision?.launch_gpu_now !== false || result.decision?.buy_more_openai_labels_now !== false || result.decision?.integrate_selector_now !== false) {
      errors.push(`${entry.name}: domain-shift audit cannot authorize spend or selector integration.`);
    }
    if (!report.includes("Qwen Frontier Domain-Shift Audit") || !report.includes("no OpenAI calls") || !report.includes("forbidden diagnostic")) {
      errors.push(`${entry.name}: report must identify zero-cost domain-shift audit and final diagnostic guard.`);
    }
  }
}

async function validateClaimSupportVerifierRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("claim-support-verifier-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let claimRows;
    let trainClaimPredictions;
    let validationClaimPredictions;
    let nonfinalValidationPairs;
    let existingValidationPairs;
    let finalDiagnosticPairs;
    let finalSelections;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      claimRows = await readJsonl(path.join(runPath, "claim_support_rows.jsonl"));
      trainClaimPredictions = await readJsonl(path.join(runPath, "train_claim_predictions.jsonl"));
      validationClaimPredictions = await readJsonl(path.join(runPath, "validation_claim_predictions.jsonl"));
      nonfinalValidationPairs = await readJsonl(path.join(runPath, "nonfinal_validation_pair_predictions.jsonl"));
      existingValidationPairs = await readJsonl(path.join(runPath, "existing_validation_pair_predictions.jsonl"));
      finalDiagnosticPairs = await readJsonl(path.join(runPath, "final_diagnostic_pair_predictions.jsonl"));
      finalSelections = await readJsonl(path.join(runPath, "final_diagnostic_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed claim-support verifier artifacts.`);
      continue;
    }
    if (result.artifact_type !== "claim_support_verifier") {
      errors.push(`${entry.name}: artifact_type must be claim_support_verifier.`);
    }
    if (!["claim_support_verifier_promising_for_selector_integration", "claim_support_verifier_learns_nonfinal_but_not_final", "claim_support_verifier_not_sufficient"].includes(result.status)) {
      errors.push(`${entry.name}: invalid claim-support verifier status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: claim-support verifier must be zero-cost.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_diagnostic_training_use !== "forbidden_diagnostic_only" || result.leakage_guard?.nonfinal_training_use !== "allowed_nonfinal_claim_support_supervision") {
      errors.push(`${entry.name}: leakage guard must restrict training to non-final claim support supervision.`);
    }
    if (Number(result.training?.train_claim_rows) !== trainClaimPredictions.length || Number(result.training?.validation_claim_rows) !== validationClaimPredictions.length) {
      errors.push(`${entry.name}: claim prediction counts must match training summary.`);
    }
    if (claimRows.length !== trainClaimPredictions.length + validationClaimPredictions.length) {
      errors.push(`${entry.name}: all claim rows must be split into train and validation predictions.`);
    }
    if (Number(result.metrics?.nonfinal_validation_pairwise?.pairs) !== nonfinalValidationPairs.length) {
      errors.push(`${entry.name}: non-final validation pair count mismatch.`);
    }
    if (Number(result.metrics?.existing_validation_pairwise?.pairs) !== existingValidationPairs.length) {
      errors.push(`${entry.name}: existing validation pair count mismatch.`);
    }
    if (Number(result.metrics?.final_diagnostic_pairwise?.pairs) !== finalDiagnosticPairs.length) {
      errors.push(`${entry.name}: final diagnostic pair count mismatch.`);
    }
    if (Number(result.metrics?.final_diagnostic_selection?.examples) !== finalSelections.length) {
      errors.push(`${entry.name}: final diagnostic selection count mismatch.`);
    }
    if (Number(result.training?.train_claim_rows) <= 0 || Number(result.training?.validation_claim_rows) <= 0 || Number(result.training?.validation_source_index_range?.[0]) < Number(result.training?.train_source_index_range?.[1])) {
      errors.push(`${entry.name}: claim verifier must have non-empty non-overlapping train/validation source-index ranges.`);
    }
    if (!Array.isArray(result.training?.feature_names) || result.training.feature_names.length < 8 || !result.model?.weights || !result.model?.scaler) {
      errors.push(`${entry.name}: missing claim verifier feature names or model weights/scaler.`);
    }
    for (const [index, row] of claimRows.entries()) {
      const label = `${entry.name}.claim_support_rows:${index + 1}`;
      if (row.training_use !== "allowed_nonfinal_claim_support_supervision" || !["supported", "unsupported"].includes(row.label) || !row.claim || !row.features) {
        errors.push(`${label}: malformed claim support row.`);
      }
      const sourceIndex = Number(row.source_index);
      if (!Number.isFinite(sourceIndex) || sourceIndex < 240 || sourceIndex >= 320) {
        errors.push(`${label}: source_index must be in the non-final 240-320 window.`);
      }
    }
    if (result.decision?.launch_gpu_now !== false || result.decision?.buy_more_openai_labels_now !== false) {
      errors.push(`${entry.name}: claim-support verifier cannot authorize spend directly.`);
    }
    if (!report.includes("Claim Support Verifier") || !report.includes("no OpenAI calls") || !report.includes("forbidden diagnostics")) {
      errors.push(`${entry.name}: report must identify the zero-cost claim-support verifier and diagnostic-only final rows.`);
    }
  }
}

async function validateClaimNliSupportVerifierRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("claim-nli-support-verifier-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let nliScores;
    let claimRows;
    let trainClaimPredictions;
    let validationClaimPredictions;
    let nonfinalValidationPairs;
    let existingValidationPairs;
    let finalDiagnosticPairs;
    let finalSelections;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      nliScores = await readJsonl(path.join(runPath, "claim-nli-scores.jsonl"));
      claimRows = await readJsonl(path.join(runPath, "claim_support_rows.jsonl"));
      trainClaimPredictions = await readJsonl(path.join(runPath, "train_claim_predictions.jsonl"));
      validationClaimPredictions = await readJsonl(path.join(runPath, "validation_claim_predictions.jsonl"));
      nonfinalValidationPairs = await readJsonl(path.join(runPath, "nonfinal_validation_pair_predictions.jsonl"));
      existingValidationPairs = await readJsonl(path.join(runPath, "existing_validation_pair_predictions.jsonl"));
      finalDiagnosticPairs = await readJsonl(path.join(runPath, "final_diagnostic_pair_predictions.jsonl"));
      finalSelections = await readJsonl(path.join(runPath, "final_diagnostic_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed claim-NLI support verifier artifacts.`);
      continue;
    }
    if (result.artifact_type !== "claim_nli_support_verifier") {
      errors.push(`${entry.name}: artifact_type must be claim_nli_support_verifier.`);
    }
    if (!["claim_nli_support_verifier_promising_for_selector_integration", "claim_nli_support_verifier_learns_nonfinal_but_not_final", "claim_nli_support_verifier_not_sufficient"].includes(result.status)) {
      errors.push(`${entry.name}: invalid claim-NLI support verifier status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: claim-NLI support verifier must be zero-cost.`);
    }
    if (!result.semantic_model?.model_id || Number(result.semantic_model?.scored_units) !== nliScores.length) {
      errors.push(`${entry.name}: semantic model scored unit count must match claim-nli-scores.jsonl.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_diagnostic_training_use !== "forbidden_diagnostic_only" || result.leakage_guard?.nonfinal_training_use !== "allowed_nonfinal_claim_support_supervision") {
      errors.push(`${entry.name}: leakage guard must restrict training to non-final claim support supervision.`);
    }
    if (Number(result.training?.train_claim_rows) !== trainClaimPredictions.length || Number(result.training?.validation_claim_rows) !== validationClaimPredictions.length) {
      errors.push(`${entry.name}: claim prediction counts must match training summary.`);
    }
    if (claimRows.length !== trainClaimPredictions.length + validationClaimPredictions.length) {
      errors.push(`${entry.name}: all claim rows must be split into train and validation predictions.`);
    }
    if (Number(result.metrics?.nonfinal_validation_pairwise?.pairs) !== nonfinalValidationPairs.length) {
      errors.push(`${entry.name}: non-final validation pair count mismatch.`);
    }
    if (Number(result.metrics?.existing_validation_pairwise?.pairs) !== existingValidationPairs.length) {
      errors.push(`${entry.name}: existing validation pair count mismatch.`);
    }
    if (Number(result.metrics?.final_diagnostic_pairwise?.pairs) !== finalDiagnosticPairs.length) {
      errors.push(`${entry.name}: final diagnostic pair count mismatch.`);
    }
    if (Number(result.metrics?.final_diagnostic_selection?.examples) !== finalSelections.length) {
      errors.push(`${entry.name}: final diagnostic selection count mismatch.`);
    }
    if (!Array.isArray(result.training?.feature_names) || !result.training.feature_names.includes("nli_entailment") || !result.training.feature_names.includes("nli_margin") || !result.model?.weights || !result.model?.scaler) {
      errors.push(`${entry.name}: missing NLI feature names or model weights/scaler.`);
    }
    for (const [index, row] of nliScores.entries()) {
      const label = `${entry.name}.claim_nli_scores:${index + 1}`;
      if (!row.unit_key || !Number.isFinite(Number(row.nli?.entailment)) || !Number.isFinite(Number(row.nli?.contradiction)) || !Number.isFinite(Number(row.nli?.margin))) {
        errors.push(`${label}: malformed claim NLI score row.`);
      }
    }
    for (const [index, row] of claimRows.entries()) {
      const label = `${entry.name}.claim_support_rows:${index + 1}`;
      if (row.training_use !== "allowed_nonfinal_claim_support_supervision" || !["supported", "unsupported"].includes(row.label) || !row.claim || !row.features || !Number.isFinite(Number(row.features.nli_entailment))) {
        errors.push(`${label}: malformed claim NLI support row.`);
      }
      const sourceIndex = Number(row.source_index);
      if (!Number.isFinite(sourceIndex) || sourceIndex < 240 || sourceIndex >= 320) {
        errors.push(`${label}: source_index must be in the non-final 240-320 window.`);
      }
    }
    if (result.decision?.launch_gpu_now !== false || result.decision?.buy_more_openai_labels_now !== false) {
      errors.push(`${entry.name}: claim-NLI support verifier cannot authorize spend directly.`);
    }
    if (!report.includes("Claim NLI Support Verifier") || !report.includes("no OpenAI calls") || !report.includes("forbidden diagnostics")) {
      errors.push(`${entry.name}: report must identify the zero-cost claim-NLI support verifier and diagnostic-only final rows.`);
    }
  }
}

async function validateHardNegativeClaimNliSelectorRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("hard-negative-claim-nli-selector-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let hardTrainPairs;
    let baselineFinalPairs;
    let baselineSelections;
    let hardWeightedFinalPairs;
    let hardWeightedSelections;
    let riskFinalPairs;
    let riskSelections;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      hardTrainPairs = await readJsonl(path.join(runPath, "hard_train_pairs.jsonl"));
      baselineFinalPairs = await readJsonl(path.join(runPath, "baseline_final_diagnostic_predictions.jsonl"));
      baselineSelections = await readJsonl(path.join(runPath, "baseline_final_diagnostic_selections.jsonl"));
      hardWeightedFinalPairs = await readJsonl(path.join(runPath, "hard_weighted_final_diagnostic_predictions.jsonl"));
      hardWeightedSelections = await readJsonl(path.join(runPath, "hard_weighted_final_diagnostic_selections.jsonl"));
      riskFinalPairs = await readJsonl(path.join(runPath, "risk_penalized_final_diagnostic_predictions.jsonl"));
      riskSelections = await readJsonl(path.join(runPath, "risk_penalized_final_diagnostic_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed hard-negative claim-NLI selector artifacts.`);
      continue;
    }
    if (result.artifact_type !== "hard_negative_claim_nli_selector") {
      errors.push(`${entry.name}: artifact_type must be hard_negative_claim_nli_selector.`);
    }
    if (!["hard_negative_selector_promising", "hard_negative_selector_partial_signal", "hard_negative_selector_not_sufficient"].includes(result.status)) {
      errors.push(`${entry.name}: invalid hard-negative selector status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: hard-negative selector must be zero-cost.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_diagnostic_training_use !== "forbidden_diagnostic_only" || result.leakage_guard?.nonfinal_training_use !== "allowed_nonfinal_frontier_supervision" || result.leakage_guard?.final_labels_used_for_target_design !== false) {
      errors.push(`${entry.name}: leakage guard must restrict training and target design to non-final supervision.`);
    }
    if (!Array.isArray(result.training?.feature_names) || !result.training.feature_names.includes("nli_entailment_min") || !result.training.feature_names.includes("unsupported_number_count")) {
      errors.push(`${entry.name}: missing expected selector feature names.`);
    }
    if (Number(result.training?.hard_train_pairs) !== hardTrainPairs.length || hardTrainPairs.some((row) => !row.hard_negative?.is_hard)) {
      errors.push(`${entry.name}: hard_train_pairs.jsonl must contain exactly the hard train pairs.`);
    }
    for (const policyId of ["baseline_pairwise_selector", "hard_negative_weighted_selector", "train_tuned_risk_penalized_selector"]) {
      if (!result.policies?.[policyId] || !result.learned_models?.[policyId]?.weights) {
        errors.push(`${entry.name}: missing policy summary or learned model for ${policyId}.`);
      }
    }
    if (Number(result.policies?.baseline_pairwise_selector?.final_diagnostic_pairwise?.pairs) !== baselineFinalPairs.length || Number(result.policies?.baseline_pairwise_selector?.final_diagnostic_selection?.examples) !== baselineSelections.length) {
      errors.push(`${entry.name}: baseline final diagnostic artifacts do not match metrics.`);
    }
    if (Number(result.policies?.hard_negative_weighted_selector?.final_diagnostic_pairwise?.pairs) !== hardWeightedFinalPairs.length || Number(result.policies?.hard_negative_weighted_selector?.final_diagnostic_selection?.examples) !== hardWeightedSelections.length) {
      errors.push(`${entry.name}: hard-weighted final diagnostic artifacts do not match metrics.`);
    }
    if (Number(result.policies?.train_tuned_risk_penalized_selector?.final_diagnostic_pairwise?.pairs) !== riskFinalPairs.length || Number(result.policies?.train_tuned_risk_penalized_selector?.final_diagnostic_selection?.examples) !== riskSelections.length) {
      errors.push(`${entry.name}: risk-penalized final diagnostic artifacts do not match metrics.`);
    }
    if (!Object.hasOwn(result.policies ?? {}, result.selected_policy)) {
      errors.push(`${entry.name}: selected_policy must reference a policy summary.`);
    }
    if (result.decision?.integrate_selector_now === true && Number(result.selected_policy_metrics?.final_diagnostic_selection?.selection_support_rate ?? 0) < 0.75) {
      errors.push(`${entry.name}: selector integration requires final diagnostic selection support >= 75%.`);
    }
    if (result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: hard-negative selector cannot authorize GPU launch.`);
    }
    if (!report.includes("Hard-Negative Claim NLI Selector") || !report.includes("no OpenAI calls") || !report.includes("forbidden diagnostics")) {
      errors.push(`${entry.name}: report must identify the zero-cost selector and diagnostic-only final rows.`);
    }
  }
}

async function validateOpenAiPoolAdjudicationRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("openai-pool-adjudication-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let pools;
    let estimates;
    let adjudications;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      pools = await readJsonl(path.join(runPath, "selected_pools.jsonl"));
      estimates = await readJsonl(path.join(runPath, "estimated_calls.jsonl"));
      adjudications = await readJsonl(path.join(runPath, "pool_adjudications.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed OpenAI pool adjudication artifacts.`);
      continue;
    }
    if (result.artifact_type !== "openai_pool_adjudication") {
      errors.push(`${entry.name}: artifact_type must be openai_pool_adjudication.`);
    }
    if (Number(result.pools_requested) !== pools.length || Number(result.pools_requested) !== estimates.length || Number(result.pools_requested) !== adjudications.length) {
      errors.push(`${entry.name}: pool, estimate, and adjudication counts must match.`);
    }
    if (Number(result.calls_made) !== adjudications.filter((row) => !row.skipped).length || Number(result.llm_budget?.openai_llm_calls) !== Number(result.calls_made)) {
      errors.push(`${entry.name}: calls_made must match non-skipped adjudications and llm_budget.`);
    }
    const runCost = adjudications.reduce((total, row) => total + Number(row.cost_usd ?? 0), 0);
    if (Math.abs(Number(result.run_cost_usd) - runCost) > 1e-9 || Math.abs(Number(result.llm_budget?.openai_cost_usd) - runCost) > 1e-9) {
      errors.push(`${entry.name}: run cost must match adjudication costs and llm_budget.`);
    }
    if (Number(result.budget?.actual_total_after_run_usd) > Number(result.budget?.max_budget_usd)) {
      errors.push(`${entry.name}: pool adjudication exceeds total budget cap.`);
    }
    if (result.leakage_guard?.final_window_labels_used !== false || result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.training_use !== "allowed_nonfinal_pool_adjudication") {
      errors.push(`${entry.name}: leakage guard must identify non-final pool adjudication only.`);
    }
    if (Number(result.metrics?.pools_judged) !== adjudications.filter((row) => !row.skipped).length) {
      errors.push(`${entry.name}: metrics.pools_judged must match non-skipped adjudications.`);
    }
    for (const [index, row] of adjudications.entries()) {
      const label = `${entry.name}.pool_adjudications:${index + 1}`;
      if (!row.skipped && (!row.root_example_id || !row.judgment?.selected_candidate_id || !Number.isFinite(Number(row.cost_usd)))) {
        errors.push(`${label}: malformed paid pool adjudication row.`);
      }
    }
    if (!report.includes("OpenAI Pool Adjudication") || !report.includes("GPT-4o") || !report.includes("final-window labels nowhere")) {
      errors.push(`${entry.name}: report must identify GPT-4o pool adjudication and no final-label use.`);
    }
  }
}

async function validatePoolAdjudicatedSelectorRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("pool-adjudicated-selector-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let trainPoolPredictions;
    let validationPoolPredictions;
    let finalPairs;
    let finalSelections;
    let hybridSelections;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      trainPoolPredictions = await readJsonl(path.join(runPath, "train_pool_predictions.jsonl"));
      validationPoolPredictions = await readJsonl(path.join(runPath, "adjudication_validation_pool_predictions.jsonl"));
      finalPairs = await readJsonl(path.join(runPath, "final_diagnostic_pair_predictions.jsonl"));
      finalSelections = await readJsonl(path.join(runPath, "final_diagnostic_selections.jsonl"));
      hybridSelections = await readJsonl(path.join(runPath, "hybrid_final_diagnostic_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed pool-adjudicated selector artifacts.`);
      continue;
    }
    if (result.artifact_type !== "pool_adjudicated_selector") {
      errors.push(`${entry.name}: artifact_type must be pool_adjudicated_selector.`);
    }
    if (!["pool_adjudicated_selector_promising", "pool_adjudicated_selector_partial_signal", "pool_adjudicated_selector_not_sufficient"].includes(result.status)) {
      errors.push(`${entry.name}: invalid pool-adjudicated selector status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.inherited_openai_llm_calls) <= 0) {
      errors.push(`${entry.name}: selector must make zero new calls and inherit paid pool calls.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_diagnostic_training_use !== "forbidden_diagnostic_only" || result.leakage_guard?.nonfinal_training_use !== "allowed_nonfinal_pool_adjudication") {
      errors.push(`${entry.name}: leakage guard must restrict training to non-final pool adjudication.`);
    }
    if (Number(result.training?.train_pools) !== trainPoolPredictions.length || Number(result.training?.validation_pools) !== validationPoolPredictions.length) {
      errors.push(`${entry.name}: pool prediction counts must match training summary.`);
    }
    if (Number(result.metrics?.final_diagnostic_pairwise?.pairs) !== finalPairs.length || Number(result.metrics?.final_diagnostic_selection?.examples) !== finalSelections.length || Number(result.metrics?.hybrid_pool_pairwise_selector?.final_diagnostic_selection?.examples) !== hybridSelections.length) {
      errors.push(`${entry.name}: final diagnostic artifacts must match metrics.`);
    }
    if (!Array.isArray(result.training?.feature_names) || !result.training.feature_names.includes("claim_model_min") || !result.learned_selector?.weights) {
      errors.push(`${entry.name}: missing selector feature names or learned weights.`);
    }
    if (result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: pool-adjudicated selector cannot authorize GPU launch.`);
    }
    if (!report.includes("Pool-Adjudicated Selector") || !report.includes("no new LLM calls") || !report.includes("forbidden diagnostics")) {
      errors.push(`${entry.name}: report must identify no-new-call selector and diagnostic-only final rows.`);
    }
  }
}

async function validatePoolSelectorMissAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("pool-selector-miss-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let comparisons;
    let hardOnly;
    let bothFailures;
    let disagreements;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      comparisons = await readJsonl(path.join(runPath, "final_selector_comparisons.jsonl"));
      hardOnly = await readJsonl(path.join(runPath, "hard_only_successes.jsonl"));
      bothFailures = await readJsonl(path.join(runPath, "both_failures.jsonl"));
      disagreements = await readJsonl(path.join(runPath, "pool_adjudication_disagreements.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed pool selector miss audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "pool_selector_miss_audit") {
      errors.push(`${entry.name}: artifact_type must be pool_selector_miss_audit.`);
    }
    if (!["pool_selector_regression_plus_claim_table_disagreement", "pool_selector_regresses_final_selection", "pool_adjudication_disagreement_requires_consistency_guard", "pool_selector_audit_no_new_blocker"].includes(result.status)) {
      errors.push(`${entry.name}: invalid pool selector miss audit status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: miss audit must make zero new calls and launch no compute.`);
    }
    if (Number(result.summary?.final_examples) !== comparisons.length) {
      errors.push(`${entry.name}: final selector comparison count must match summary.`);
    }
    if (Number(result.summary?.hard_only_successes) !== hardOnly.length || Number(result.summary?.both_failures) !== bothFailures.length || Number(result.summary?.pool_adjudication_disagreements) !== disagreements.length) {
      errors.push(`${entry.name}: miss and disagreement artifacts must match summary.`);
    }
    if (result.decision?.buy_more_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: miss audit cannot authorize more labels or GPU launch.`);
    }
    if (!Array.isArray(result.findings) || result.findings.length === 0) {
      errors.push(`${entry.name}: miss audit must include findings.`);
    }
    if (!report.includes("Pool Selector Miss Audit") || !report.includes("no new OpenAI calls") || !report.includes("Buy more labels now: `false`")) {
      errors.push(`${entry.name}: report must identify zero-call audit and no immediate paid labels.`);
    }
  }
}

async function validateConstrainedPoolPairwiseSelectorRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("constrained-pool-pairwise-selector-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let validationPoolPredictions;
    let existingValidationPairs;
    let finalPairs;
    let finalSelections;
    let policyGrid;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      validationPoolPredictions = await readJsonl(path.join(runPath, "constrained_validation_pool_predictions.jsonl"));
      existingValidationPairs = await readJsonl(path.join(runPath, "constrained_existing_validation_pair_predictions.jsonl"));
      finalPairs = await readJsonl(path.join(runPath, "constrained_final_diagnostic_pair_predictions.jsonl"));
      finalSelections = await readJsonl(path.join(runPath, "constrained_final_diagnostic_selections.jsonl"));
      policyGrid = await readJsonl(path.join(runPath, "constrained_policy_grid.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed constrained pool-pairwise selector artifacts.`);
      continue;
    }
    if (result.artifact_type !== "constrained_pool_pairwise_selector") {
      errors.push(`${entry.name}: artifact_type must be constrained_pool_pairwise_selector.`);
    }
    if (!["constrained_selector_promising", "constrained_selector_partial_signal", "constrained_selector_not_sufficient"].includes(result.status)) {
      errors.push(`${entry.name}: invalid constrained selector status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: constrained selector must make zero new calls and launch no compute.`);
    }
    const constrained = result.metrics?.constrained_pool_pairwise_selector;
    if (!constrained?.selected_policy || !result.tuning?.selected_policy) {
      errors.push(`${entry.name}: missing constrained selected policy.`);
    }
    if (Number(constrained?.adjudication_validation_pool_choice?.pools) !== validationPoolPredictions.length || Number(constrained?.existing_validation_pairwise?.pairs) !== existingValidationPairs.length) {
      errors.push(`${entry.name}: constrained validation artifacts must match metrics.`);
    }
    if (Number(constrained?.final_diagnostic_pairwise?.pairs) !== finalPairs.length || Number(constrained?.final_diagnostic_selection?.examples) !== finalSelections.length) {
      errors.push(`${entry.name}: constrained final diagnostic artifacts must match metrics.`);
    }
    if (Number(result.tuning?.policies_evaluated) !== policyGrid.length || policyGrid.length === 0) {
      errors.push(`${entry.name}: constrained policy grid must match tuning summary.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_diagnostic_training_use !== "forbidden_diagnostic_only") {
      errors.push(`${entry.name}: leakage guard must forbid final diagnostic training.`);
    }
    if (result.decision?.launch_gpu_now !== false || result.decision?.buy_more_openai_labels_now !== false) {
      errors.push(`${entry.name}: constrained selector cannot authorize GPU launch or more labels.`);
    }
    if (!report.includes("Constrained Pool-Pairwise Selector") || !report.includes("no new LLM calls") || !report.includes("forbidden diagnostics")) {
      errors.push(`${entry.name}: report must identify zero-call constrained selector and diagnostic-only final rows.`);
    }
  }
}

async function validateBothFailTargetAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("both-fail-target-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let audits;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      audits = await readJsonl(path.join(runPath, "audited_both_failures.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed both-fail target audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "both_fail_target_audit") {
      errors.push(`${entry.name}: artifact_type must be both_fail_target_audit.`);
    }
    if (!["both_failures_are_overexpanded_answer_scope_errors", "both_failures_have_existing_unsupported_claim_targets", "both_failures_require_mixed_targeting"].includes(result.status)) {
      errors.push(`${entry.name}: invalid both-fail target audit status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: both-fail target audit must make zero new calls and launch no compute.`);
    }
    if (Number(result.summary?.audited_examples) !== audits.length) {
      errors.push(`${entry.name}: audited row count must match summary.`);
    }
    if (result.decision?.buy_more_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: both-fail audit cannot authorize more labels or GPU launch.`);
    }
    if (result.proposed_next_supervision?.construct_from_final_labels !== false || result.proposed_next_supervision?.construct_from_nonfinal_pool !== true) {
      errors.push(`${entry.name}: proposed supervision must be non-final and not final-label training.`);
    }
    for (const [index, row] of audits.entries()) {
      const label = `${entry.name}.audited_both_failures:${index + 1}`;
      if (!row.example_id || !row.selected_candidate_id || !row.best_supported?.candidate_id) {
        errors.push(`${label}: missing selected or best-supported candidate detail.`);
      }
      if (!Array.isArray(row.supervision_targets) || row.supervision_targets.length === 0) {
        errors.push(`${label}: missing supervision targets.`);
      }
    }
    if (!report.includes("Both-Fail Target Audit") || !report.includes("no OpenAI calls") || !report.includes("final-window labels only as forbidden diagnostics")) {
      errors.push(`${entry.name}: report must identify zero-call target audit and diagnostic-only final rows.`);
    }
  }
}

async function validateMinimalSpanOverexpansionPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("minimal-span-overexpansion-packet-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let roots;
    let pairs;
    let generatedPairs;
    let trainPairs;
    let validationPairs;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      roots = await readJsonl(path.join(runPath, "root_audits.jsonl"));
      pairs = await readJsonl(path.join(runPath, "contrast_pairs.jsonl"));
      generatedPairs = await readJsonl(path.join(runPath, "generated_contrast_pairs.jsonl"));
      trainPairs = await readJsonl(path.join(runPath, "train_contrast_pairs.jsonl"));
      validationPairs = await readJsonl(path.join(runPath, "validation_contrast_pairs.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed minimal span overexpansion packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "minimal_span_overexpansion_packet") {
      errors.push(`${entry.name}: artifact_type must be minimal_span_overexpansion_packet.`);
    }
    if (Number(result.counts?.roots_with_pairs) !== roots.length || Number(result.counts?.all_pairs) !== pairs.length || Number(result.counts?.generated_candidate_pairs) !== generatedPairs.length) {
      errors.push(`${entry.name}: root/pair counts must match packet summary.`);
    }
    if (Number(result.counts?.train_pairs) !== trainPairs.length || Number(result.counts?.validation_pairs) !== validationPairs.length) {
      errors.push(`${entry.name}: train/validation pair counts must match packet summary.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: packet must make zero new calls and launch no compute.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.training_use !== "allowed_nonfinal_frontier_supervision") {
      errors.push(`${entry.name}: leakage guard must restrict packet to non-final supervision.`);
    }
    for (const [index, pair] of pairs.entries()) {
      const label = `${entry.name}.contrast_pairs:${index + 1}`;
      if (!pair.pair_id || !pair.input?.question || !pair.chosen?.answer_type || !pair.rejected?.answer_type) {
        errors.push(`${label}: malformed contrast pair.`);
      }
      if (!Array.isArray(pair.tags) || !pair.tags.includes("unsupported_judge_claim_available")) {
        errors.push(`${label}: overexpansion pair must include unsupported judge-claim availability.`);
      }
      if (pair.training_use !== "allowed_nonfinal_frontier_supervision") {
        errors.push(`${label}: pair training_use must be non-final frontier supervision.`);
      }
    }
    if (!report.includes("Minimal Span Overexpansion Packet") || !report.includes("no OpenAI calls") || !report.includes("non-final judged Qwen pool artifacts only")) {
      errors.push(`${entry.name}: report must identify zero-call non-final packet.`);
    }
  }
}

async function validateOverexpansionAwareSelectorRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("overexpansion-aware-selector-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let trainPredictions;
    let validationPredictions;
    let existingValidationPredictions;
    let finalPredictions;
    let finalSelections;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      trainPredictions = await readJsonl(path.join(runPath, "train_predictions.jsonl"));
      validationPredictions = await readJsonl(path.join(runPath, "validation_predictions.jsonl"));
      existingValidationPredictions = await readJsonl(path.join(runPath, "existing_validation_pair_predictions.jsonl"));
      finalPredictions = await readJsonl(path.join(runPath, "final_diagnostic_pair_predictions.jsonl"));
      finalSelections = await readJsonl(path.join(runPath, "final_diagnostic_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed overexpansion-aware selector artifacts.`);
      continue;
    }
    if (result.artifact_type !== "overexpansion_aware_selector") {
      errors.push(`${entry.name}: artifact_type must be overexpansion_aware_selector.`);
    }
    if (!["overexpansion_selector_improves_final_selection", "overexpansion_selector_partial_signal", "overexpansion_selector_not_sufficient"].includes(result.status)) {
      errors.push(`${entry.name}: invalid overexpansion selector status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: selector must make zero calls and launch no compute.`);
    }
    if (Number(result.metrics?.train_overexpansion_pairs?.pairs) !== trainPredictions.length || Number(result.metrics?.validation_overexpansion_pairs?.pairs) !== validationPredictions.length) {
      errors.push(`${entry.name}: overexpansion prediction counts must match metrics.`);
    }
    if (Number(result.metrics?.existing_validation_pairwise?.pairs) !== existingValidationPredictions.length || Number(result.metrics?.final_diagnostic_pairwise?.pairs) !== finalPredictions.length || Number(result.metrics?.final_diagnostic_selection?.examples) !== finalSelections.length) {
      errors.push(`${entry.name}: validation/final prediction counts must match metrics.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_diagnostic_training_use !== "forbidden_diagnostic_only") {
      errors.push(`${entry.name}: leakage guard must forbid final diagnostic training.`);
    }
    if (result.decision?.launch_gpu_now !== false || result.decision?.buy_more_openai_labels_now !== false) {
      errors.push(`${entry.name}: selector cannot authorize GPU launch or more labels.`);
    }
    if (!Array.isArray(result.training?.feature_names) || !result.training.feature_names.includes("unsupported_number_count") || !result.learned_selector?.weights) {
      errors.push(`${entry.name}: selector must include overexpansion features and learned weights.`);
    }
    if (!report.includes("Overexpansion-Aware Selector") || !report.includes("no OpenAI calls") || !report.includes("Final-window labels are forbidden diagnostics only")) {
      errors.push(`${entry.name}: report must identify zero-call selector and diagnostic-only final rows.`);
    }
  }
}

async function validateCalibratedOverexpansionHybridRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("calibrated-overexpansion-hybrid-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let policyGrid;
    let existingPredictions;
    let finalPredictions;
    let finalSelections;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      policyGrid = await readJsonl(path.join(runPath, "policy_grid.jsonl"));
      existingPredictions = await readJsonl(path.join(runPath, "existing_validation_pair_predictions.jsonl"));
      finalPredictions = await readJsonl(path.join(runPath, "final_diagnostic_pair_predictions.jsonl"));
      finalSelections = await readJsonl(path.join(runPath, "final_diagnostic_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed calibrated overexpansion hybrid artifacts.`);
      continue;
    }
    if (result.artifact_type !== "calibrated_overexpansion_hybrid") {
      errors.push(`${entry.name}: artifact_type must be calibrated_overexpansion_hybrid.`);
    }
    if (!["hybrid_preserves_validation_and_recovers_overexpansion_signal", "hybrid_preserves_validation_with_partial_final_gain", "hybrid_not_sufficient"].includes(result.status)) {
      errors.push(`${entry.name}: invalid hybrid status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: hybrid must make zero calls and launch no compute.`);
    }
    if (Number(result.calibration?.policies_evaluated) !== policyGrid.length || policyGrid.length === 0) {
      errors.push(`${entry.name}: policy grid must match calibration summary.`);
    }
    if (Number(result.metrics?.selected_existing_validation_pairwise?.pairs) !== existingPredictions.length || Number(result.metrics?.selected_final_diagnostic_pairwise?.pairs) !== finalPredictions.length || Number(result.metrics?.selected_final_diagnostic_selection?.examples) !== finalSelections.length) {
      errors.push(`${entry.name}: hybrid prediction artifacts must match metrics.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_diagnostic_training_use !== "forbidden_diagnostic_only" || result.leakage_guard?.calibration_use !== "existing_validation_pairwise_only") {
      errors.push(`${entry.name}: leakage guard must restrict calibration to existing validation only.`);
    }
    if (result.decision?.launch_gpu_now !== false || result.decision?.buy_more_openai_labels_now !== false) {
      errors.push(`${entry.name}: hybrid cannot authorize GPU launch or more labels.`);
    }
    const alpha = Number(result.calibration?.selected_alpha_overexpansion_weight);
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
      errors.push(`${entry.name}: selected alpha must be in [0, 1].`);
    }
    if (!report.includes("Calibrated Overexpansion Hybrid") || !report.includes("no OpenAI calls") || !report.includes("final-window labels are forbidden diagnostics")) {
      errors.push(`${entry.name}: report must identify zero-call calibrated hybrid and diagnostic-only final rows.`);
    }
  }
}

async function validateOverexpansionTradeoffAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("overexpansion-tradeoff-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let comparisons;
    let recovered;
    let regressions;
    let bothFailures;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      comparisons = await readJsonl(path.join(runPath, "comparison_rows.jsonl"));
      recovered = await readJsonl(path.join(runPath, "overexpansion_only_successes.jsonl"));
      regressions = await readJsonl(path.join(runPath, "baseline_only_successes.jsonl"));
      bothFailures = await readJsonl(path.join(runPath, "both_failures.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed overexpansion tradeoff audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "overexpansion_tradeoff_audit") {
      errors.push(`${entry.name}: artifact_type must be overexpansion_tradeoff_audit.`);
    }
    if (!["conditional_gate_needed_for_overexpansion_signal", "overexpansion_tradeoff_requires_guard", "overexpansion_no_recovery_to_gate"].includes(result.status)) {
      errors.push(`${entry.name}: invalid overexpansion tradeoff audit status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: tradeoff audit must make zero calls and launch no compute.`);
    }
    if (Number(result.summary?.final_examples) !== comparisons.length || Number(result.summary?.overexpansion_only_successes) !== recovered.length || Number(result.summary?.baseline_only_successes) !== regressions.length || Number(result.summary?.both_failures) !== bothFailures.length) {
      errors.push(`${entry.name}: tradeoff artifact counts must match summary.`);
    }
    if (result.decision?.integrate_gate_now !== false || result.decision?.buy_more_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: tradeoff audit cannot authorize integration, more labels, or GPU launch.`);
    }
    if (result.proposed_gate?.train_from_final_labels !== false) {
      errors.push(`${entry.name}: proposed gate cannot train from final labels.`);
    }
    for (const [index, row] of comparisons.entries()) {
      const label = `${entry.name}.comparison_rows:${index + 1}`;
      if (!row.example_id || !row.bucket || !row.baseline?.selected_candidate_id || !row.overexpansion?.selected_candidate_id) {
        errors.push(`${label}: malformed comparison row.`);
      }
    }
    if (!report.includes("Overexpansion Tradeoff Audit") || !report.includes("no OpenAI calls") || !report.includes("Final-window labels are diagnostic only")) {
      errors.push(`${entry.name}: report must identify zero-call diagnostic tradeoff audit.`);
    }
  }
}

async function validateConditionalOverexpansionGateRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("conditional-overexpansion-gate-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let policyGrid;
    let existingPredictions;
    let finalPredictions;
    let finalSelections;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      policyGrid = await readJsonl(path.join(runPath, "policy_grid.jsonl"));
      existingPredictions = await readJsonl(path.join(runPath, "existing_validation_pair_predictions.jsonl"));
      finalPredictions = await readJsonl(path.join(runPath, "final_diagnostic_pair_predictions.jsonl"));
      finalSelections = await readJsonl(path.join(runPath, "final_diagnostic_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed conditional overexpansion gate artifacts.`);
      continue;
    }
    if (result.artifact_type !== "conditional_overexpansion_gate") {
      errors.push(`${entry.name}: artifact_type must be conditional_overexpansion_gate.`);
    }
    if (!["gate_preserves_validation_and_matches_overexpansion_final_gain", "gate_partial_final_gain", "gate_not_sufficient"].includes(result.status)) {
      errors.push(`${entry.name}: invalid conditional gate status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: conditional gate must make zero calls and launch no compute.`);
    }
    if (Number(result.calibration?.policies_evaluated) !== policyGrid.length || policyGrid.length === 0) {
      errors.push(`${entry.name}: policy grid must match calibration summary.`);
    }
    if (Number(result.metrics?.existing_validation_pairwise?.pairs) !== existingPredictions.length || Number(result.metrics?.final_diagnostic_pairwise?.pairs) !== finalPredictions.length || Number(result.metrics?.final_diagnostic_selection?.examples) !== finalSelections.length) {
      errors.push(`${entry.name}: prediction artifacts must match metrics.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_diagnostic_training_use !== "forbidden_diagnostic_only" || result.leakage_guard?.calibration_use !== "nonfinal_d264_validation_and_existing_validation_only") {
      errors.push(`${entry.name}: leakage guard must restrict calibration to non-final/existing validation only.`);
    }
    if (result.decision?.integrate_gate_now !== false || result.decision?.launch_gpu_now !== false || result.decision?.buy_more_openai_labels_now !== false) {
      errors.push(`${entry.name}: conditional gate cannot authorize integration, GPU launch, or more labels.`);
    }
    if (!result.calibration?.selected_policy || !Number.isFinite(Number(result.metrics?.d264_validation_pairs?.pairs))) {
      errors.push(`${entry.name}: missing selected policy or D264 validation metrics.`);
    }
    if (!report.includes("Conditional Overexpansion Gate") || !report.includes("no OpenAI calls") || !report.includes("final-window labels are forbidden diagnostics")) {
      errors.push(`${entry.name}: report must identify zero-call gate and diagnostic-only final rows.`);
    }
  }
}

async function validateTargetedBoundaryAdjudicationPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("targeted-boundary-adjudication-packet-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let boundaryCases;
    let requests;
    let estimates;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      boundaryCases = await readJsonl(path.join(runPath, "boundary_cases.jsonl"));
      requests = await readJsonl(path.join(runPath, "candidate_adjudication_requests.jsonl"));
      estimates = await readJsonl(path.join(runPath, "estimated_calls.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed targeted boundary adjudication packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "targeted_boundary_adjudication_packet") {
      errors.push(`${entry.name}: artifact_type must be targeted_boundary_adjudication_packet.`);
    }
    if (!["paid_boundary_batch_ready_but_not_launched", "paid_boundary_batch_not_ready"].includes(result.status)) {
      errors.push(`${entry.name}: invalid targeted boundary packet status.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: targeted boundary packet must be zero-call and launch no compute.`);
    }
    if (Number(result.boundary_summary?.final_diagnostic_cases) !== boundaryCases.length || Number(result.adjudication_batch?.candidate_requests) !== requests.length || estimates.length !== requests.length) {
      errors.push(`${entry.name}: artifact counts must match packet summary.`);
    }
    if (requests.length === 0 || requests.length > Number(result.adjudication_batch?.max_requests)) {
      errors.push(`${entry.name}: request count must be nonzero and within max_requests.`);
    }
    if (Number(result.adjudication_batch?.estimated_openai_cost_usd) > Number(result.adjudication_batch?.max_estimated_openai_cost_usd)) {
      errors.push(`${entry.name}: estimated cost must be under the packet cap.`);
    }
    if (result.adjudication_batch?.budget_gate_passed !== true || Number(result.budget?.estimated_total_after_batch_usd) > Number(result.budget?.max_budget_usd)) {
      errors.push(`${entry.name}: budget gate must pass under the total budget.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_boundary_cases_training_use !== "forbidden_diagnostic_only" || result.leakage_guard?.candidate_adjudication_training_use !== "allowed_nonfinal_targeted_boundary_adjudication") {
      errors.push(`${entry.name}: leakage guard must forbid final training and allow only non-final targeted adjudication.`);
    }
    if (result.decision?.run_paid_batch_now !== false || result.decision?.buy_more_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: packet cannot authorize paid launch, broad labels, or GPU launch.`);
    }
    if (result.secret_readiness?.checked_secret_names_only !== true || typeof result.secret_readiness?.openai_api_key_present !== "boolean") {
      errors.push(`${entry.name}: secret readiness must record names-only OpenAI key presence.`);
    }
    for (const [index, row] of boundaryCases.entries()) {
      const label = `${entry.name}.boundary_cases:${index + 1}`;
      if (!row.example_id || row.training_use !== "forbidden_diagnostic_only" || !String(row.warning ?? "").includes("Final diagnostic")) {
        errors.push(`${label}: final boundary case must be diagnostic-only.`);
      }
    }
    const requestIds = new Set();
    for (const [index, row] of requests.entries()) {
      const label = `${entry.name}.candidate_adjudication_requests:${index + 1}`;
      if (!row.request_id || requestIds.has(row.request_id)) errors.push(`${label}: request_id missing or duplicated.`);
      requestIds.add(row.request_id);
      if (row.final_window !== false || row.training_use !== "allowed_nonfinal_targeted_boundary_adjudication") {
        errors.push(`${label}: request must be non-final targeted adjudication.`);
      }
      if (!row.input?.question || !Array.isArray(row.input?.compact_retrieved_evidence_pack) || !row.candidate_a?.answer || !row.candidate_b?.answer) {
        errors.push(`${label}: request missing question, evidence, or candidates.`);
      }
      if (!Array.isArray(row.tags) || !row.tags.includes("unsupported_judge_claim_available")) {
        errors.push(`${label}: request must carry unsupported judge-claim evidence tag.`);
      }
      if (Number(row.source_index) >= 321) {
        errors.push(`${label}: request appears to come from the final diagnostic window.`);
      }
    }
    for (const [index, row] of estimates.entries()) {
      const label = `${entry.name}.estimated_calls:${index + 1}`;
      if (!requestIds.has(row.request_id) || !Number.isFinite(Number(row.estimated_cost_usd)) || Number(row.estimated_cost_usd) <= 0) {
        errors.push(`${label}: malformed estimate row.`);
      }
      if (!String(row.conservative_pricing_basis ?? "").includes("re-price")) {
        errors.push(`${label}: estimate must require repricing before paid calls.`);
      }
    }
    if (!report.includes("Targeted Boundary Adjudication Packet") || !report.includes("zero-call") || !report.includes("Final boundary cases are diagnostic-only") || !report.includes("paid runner must re-price")) {
      errors.push(`${entry.name}: report must identify zero-call packet, diagnostic-only final cases, and repricing requirement.`);
    }
  }
}

async function validateTargetedBoundaryAdjudicationRunRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("targeted-boundary-adjudication-run-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let requests;
    let estimates;
    let adjudications;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      requests = await readJsonl(path.join(runPath, "requests.jsonl"));
      estimates = await readJsonl(path.join(runPath, "estimated_calls.jsonl"));
      adjudications = await readJsonl(path.join(runPath, "adjudications.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed targeted boundary adjudication run artifacts.`);
      continue;
    }
    if (result.artifact_type !== "targeted_boundary_adjudication_run") {
      errors.push(`${entry.name}: artifact_type must be targeted_boundary_adjudication_run.`);
    }
    if (Number(result.requests_planned) !== requests.length || estimates.length !== requests.length || adjudications.length !== requests.length) {
      errors.push(`${entry.name}: request/estimate/adjudication counts must match result.`);
    }
    if (Number(result.calls_made) + Number(result.calls_skipped) !== adjudications.length) {
      errors.push(`${entry.name}: calls made/skipped must cover all adjudications.`);
    }
    const runCost = adjudications.reduce((total, row) => total + Number(row.cost_usd ?? 0), 0);
    if (Math.abs(runCost - Number(result.run_cost_usd)) > 1e-8 || Math.abs(runCost - Number(result.llm_budget?.openai_cost_usd)) > 1e-8) {
      errors.push(`${entry.name}: run cost must match adjudication rows and llm_budget.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== Number(result.calls_made) || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: llm_budget must match call count and have no external compute.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.candidate_adjudication_training_use !== "allowed_nonfinal_targeted_boundary_adjudication" || result.leakage_guard?.candidate_requests_nonfinal_only !== true) {
      errors.push(`${entry.name}: leakage guard must restrict run to non-final targeted adjudication.`);
    }
    if (result.leakage_guard?.prompt_excludes_existing_local_judge_posthoc_fields !== true) {
      errors.push(`${entry.name}: prompt must exclude local judge post-hoc fields.`);
    }
    if (Number(result.budget?.actual_total_after_run_usd) > Number(result.budget?.max_budget_usd)) {
      errors.push(`${entry.name}: actual total after run exceeds max budget.`);
    }
    if (result.decision?.buy_more_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: boundary adjudication run cannot authorize more labels or GPU launch.`);
    }
    for (const [index, row] of requests.entries()) {
      const label = `${entry.name}.requests:${index + 1}`;
      if (!row.request_id || row.final_window !== false || row.training_use !== "allowed_nonfinal_targeted_boundary_adjudication" || Number(row.source_index) >= 321) {
        errors.push(`${label}: request must be non-final targeted adjudication.`);
      }
      if (JSON.stringify(row).includes("expected_existing_signal_not_for_prompting") && result.leakage_guard?.prompt_excludes_existing_local_judge_posthoc_fields !== true) {
        errors.push(`${label}: post-hoc signal may appear only outside the prompt with explicit guard.`);
      }
    }
    const requestIds = new Set(requests.map((row) => row.request_id));
    for (const [index, row] of adjudications.entries()) {
      const label = `${entry.name}.adjudications:${index + 1}`;
      if (!requestIds.has(row.request_id)) errors.push(`${label}: adjudication request_id not found in requests.`);
      if (row.skipped === false) {
        if (!row.usage || !Number.isFinite(Number(row.usage.total_tokens)) || Number(row.cost_usd) <= 0) {
          errors.push(`${label}: paid adjudication missing usage or positive cost.`);
        }
        if (!["A", "B", "both", "neither"].includes(row.judgment?.supported_candidate)) {
          errors.push(`${label}: invalid supported_candidate.`);
        }
      }
    }
    if (!report.includes("Targeted Boundary Adjudication Run") || !report.includes("did not use final-window labels") || !report.includes("did not include existing local judge post-hoc fields")) {
      errors.push(`${entry.name}: report must identify leakage and prompt guards.`);
    }
  }
}

async function validateBoundaryAdjudicationDisagreementAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("boundary-adjudication-disagreement-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let auditRows;
    let disagreements;
    let accepted;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      auditRows = await readJsonl(path.join(runPath, "audit_rows.jsonl"));
      disagreements = await readJsonl(path.join(runPath, "disagreements.jsonl"));
      accepted = await readJsonl(path.join(runPath, "accepted_training_labels.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed boundary adjudication disagreement audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "boundary_adjudication_disagreement_audit") {
      errors.push(`${entry.name}: artifact_type must be boundary_adjudication_disagreement_audit.`);
    }
    if (Number(result.summary?.adjudications) !== auditRows.length || Number(result.summary?.disagreements) !== disagreements.length || Number(result.summary?.accepted_for_training) !== accepted.length) {
      errors.push(`${entry.name}: audit artifact counts must match summary.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: disagreement audit must make zero calls and launch no compute.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.audit_uses_paid_nonfinal_rows_only !== true || result.leakage_guard?.accepted_training_use !== "allowed_nonfinal_targeted_boundary_adjudication_filtered") {
      errors.push(`${entry.name}: leakage guard must restrict accepted rows to filtered non-final labels.`);
    }
    if (result.decision?.integrate_all_paid_labels_now !== false || result.decision?.buy_more_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: audit cannot integrate all paid labels or authorize more labels/GPU.`);
    }
    for (const [index, row] of accepted.entries()) {
      const label = `${entry.name}.accepted_training_labels:${index + 1}`;
      if (row.training_use !== "allowed_nonfinal_targeted_boundary_adjudication_filtered" || !row.chosen_candidate_id || !row.rejected_candidate_id || row.paid_supported_candidate !== "A") {
        errors.push(`${label}: accepted label must be filtered A-over-B supervision.`);
      }
    }
    for (const [index, row] of disagreements.entries()) {
      const label = `${entry.name}.disagreements:${index + 1}`;
      if (!row.audit_category || row.training_recommendation !== "quarantine_until_manual_or_second_judge_review") {
        errors.push(`${label}: disagreement must be categorized and quarantined.`);
      }
    }
    if (!report.includes("Boundary Adjudication Disagreement Audit") || !report.includes("zero-call audit") || !report.includes("uses no final-window labels")) {
      errors.push(`${entry.name}: report must identify zero-call non-final disagreement audit.`);
    }
  }
}

async function validateFilteredBoundarySelectorRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("filtered-boundary-selector-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let trainPredictions;
    let boundaryExisting;
    let boundaryFinal;
    let boundarySelections;
    let policyGrid;
    let hybridExisting;
    let hybridFinal;
    let hybridSelections;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      trainPredictions = await readJsonl(path.join(runPath, "train_predictions.jsonl"));
      boundaryExisting = await readJsonl(path.join(runPath, "boundary_existing_validation_pair_predictions.jsonl"));
      boundaryFinal = await readJsonl(path.join(runPath, "boundary_final_diagnostic_pair_predictions.jsonl"));
      boundarySelections = await readJsonl(path.join(runPath, "boundary_final_diagnostic_selections.jsonl"));
      policyGrid = await readJsonl(path.join(runPath, "hybrid_policy_grid.jsonl"));
      hybridExisting = await readJsonl(path.join(runPath, "hybrid_existing_validation_pair_predictions.jsonl"));
      hybridFinal = await readJsonl(path.join(runPath, "hybrid_final_diagnostic_pair_predictions.jsonl"));
      hybridSelections = await readJsonl(path.join(runPath, "hybrid_final_diagnostic_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed filtered boundary selector artifacts.`);
      continue;
    }
    if (result.artifact_type !== "filtered_boundary_selector") {
      errors.push(`${entry.name}: artifact_type must be filtered_boundary_selector.`);
    }
    if (Number(result.training?.train_pairs) !== trainPredictions.length || trainPredictions.length !== 8) {
      errors.push(`${entry.name}: filtered selector must train on exactly the 8 accepted labels.`);
    }
    if (Number(result.metrics?.boundary_only_existing_validation_pairwise?.pairs) !== boundaryExisting.length || Number(result.metrics?.boundary_only_final_diagnostic_pairwise?.pairs) !== boundaryFinal.length || Number(result.metrics?.boundary_only_final_diagnostic_selection?.examples) !== boundarySelections.length) {
      errors.push(`${entry.name}: boundary-only artifact counts must match metrics.`);
    }
    if (Number(result.tuning?.policies_evaluated) !== policyGrid.length || policyGrid.length === 0) {
      errors.push(`${entry.name}: hybrid policy grid must match tuning summary.`);
    }
    if (Number(result.metrics?.selected_hybrid?.existing_validation_pairwise?.pairs) !== hybridExisting.length || Number(result.metrics?.selected_hybrid?.final_diagnostic_pairwise?.pairs) !== hybridFinal.length || Number(result.metrics?.selected_hybrid?.final_diagnostic_selection?.examples) !== hybridSelections.length) {
      errors.push(`${entry.name}: hybrid artifact counts must match metrics.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: filtered selector must make zero new calls and launch no compute.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_tuning !== false || result.leakage_guard?.accepted_training_use !== "allowed_nonfinal_targeted_boundary_adjudication_filtered" || result.leakage_guard?.quarantined_rows_excluded_from_training !== true) {
      errors.push(`${entry.name}: leakage guard must use only accepted non-final labels and exclude quarantined rows.`);
    }
    if (result.decision?.buy_more_openai_labels_now !== false || result.decision?.launch_gpu_now !== false || result.decision?.integrate_boundary_only_now !== false) {
      errors.push(`${entry.name}: filtered selector cannot authorize more labels, GPU, or boundary-only integration.`);
    }
    if (!Array.isArray(result.training?.feature_names) || !result.training.feature_names.includes("unsupported_number_count") || !result.learned_selector?.weights) {
      errors.push(`${entry.name}: filtered selector must include learned boundary features.`);
    }
    if (!report.includes("Filtered Boundary Selector") || !report.includes("zero-call selector") || !report.includes("Quarantined disagreements and final-window labels are excluded")) {
      errors.push(`${entry.name}: report must identify zero-call filtered selector and leakage exclusions.`);
    }
  }
}

async function validateBoundaryHybridTradeoffAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("boundary-hybrid-tradeoff-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let comparisons;
    let rescues;
    let lostRescues;
    let alphaGrid;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      comparisons = await readJsonl(path.join(runPath, "comparison_rows.jsonl"));
      rescues = await readJsonl(path.join(runPath, "boundary_only_rescues.jsonl"));
      lostRescues = await readJsonl(path.join(runPath, "hybrid_lost_rescues.jsonl"));
      alphaGrid = await readJsonl(path.join(runPath, "alpha_grid.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed boundary hybrid tradeoff audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "boundary_hybrid_tradeoff_audit") {
      errors.push(`${entry.name}: artifact_type must be boundary_hybrid_tradeoff_audit.`);
    }
    if (Number(result.summary?.final_examples) !== comparisons.length || Number(result.summary?.boundary_only_rescues) !== rescues.length || Number(result.summary?.boundary_rescues_lost_by_selected_hybrid) !== lostRescues.length) {
      errors.push(`${entry.name}: artifact counts must match summary.`);
    }
    if (!alphaGrid.length || !alphaGrid.some((row) => Number(row.alpha_boundary_weight) === Number(result.summary?.selected_hybrid_alpha))) {
      errors.push(`${entry.name}: alpha grid must include selected hybrid alpha.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: tradeoff audit must make zero calls and launch no compute.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_tuning !== false || result.leakage_guard?.final_diagnostic_use !== "forbidden_diagnostic_audit_only") {
      errors.push(`${entry.name}: leakage guard must keep final labels diagnostic-only.`);
    }
    if (result.decision?.buy_more_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: tradeoff audit cannot authorize more labels or GPU launch.`);
    }
    for (const [index, row] of lostRescues.entries()) {
      const label = `${entry.name}.hybrid_lost_rescues:${index + 1}`;
      if (!row.example_id || row.category !== "boundary_rescue_lost_by_hybrid" || !Number.isFinite(Number(row.hybrid_alpha_needed_to_match_boundary_selection))) {
        errors.push(`${label}: lost rescue must identify alpha threshold.`);
      }
    }
    if (!report.includes("Boundary Hybrid Tradeoff Audit") || !report.includes("zero-call diagnostic audit") || !report.includes("no final labels are used for training or tuning")) {
      errors.push(`${entry.name}: report must identify zero-call diagnostic-only audit.`);
    }
  }
}

async function validateLostRescueExampleAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("lost-rescue-example-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let candidateAudits;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      candidateAudits = await readJsonl(path.join(runPath, "candidate_audits.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed lost-rescue example audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "lost_rescue_example_audit") {
      errors.push(`${entry.name}: artifact_type must be lost_rescue_example_audit.`);
    }
    if (!result.example_id || String(result.question ?? "").length === 0 || !result.reference?.answer) {
      errors.push(`${entry.name}: audit must identify example, question, and reference answer.`);
    }
    if (Number(result.candidate_summary?.candidates) !== candidateAudits.length || candidateAudits.length === 0) {
      errors.push(`${entry.name}: candidate audit count must match summary.`);
    }
    if (Number(result.candidate_summary?.existing_judge_supported_candidates) !== candidateAudits.filter((row) => row.existing_judge_supported).length) {
      errors.push(`${entry.name}: supported candidate count must match candidate audits.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: lost-rescue audit must make zero calls and launch no compute.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_diagnostic_use !== "forbidden_diagnostic_audit_only" || result.leakage_guard?.audit_is_zero_call !== true) {
      errors.push(`${entry.name}: leakage guard must keep final labels diagnostic-only.`);
    }
    if (result.decision?.use_example_for_training_now !== false || result.decision?.buy_more_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: lost-rescue audit cannot authorize training use, more labels, or GPU launch.`);
    }
    if (result.diagnosis?.primary_failure !== "ambiguous_question_reference_mismatch_plus_ranking_margin" || result.diagnosis?.question_reference_mismatch !== true) {
      errors.push(`${entry.name}: expected the lost rescue to be classified as ambiguous question/reference mismatch plus ranking margin.`);
    }
    for (const [index, row] of candidateAudits.entries()) {
      const label = `${entry.name}.candidate_audits:${index + 1}`;
      if (!row.candidate_id || !row.answer_preview || !Array.isArray(row.failure_tags)) {
        errors.push(`${label}: candidate audit row must include id, answer preview, and failure tags.`);
      }
      if (!row.selector_ranks || !row.lexical_alignment) {
        errors.push(`${label}: candidate audit row must include selector ranks and lexical alignment.`);
      }
    }
    if (!report.includes("Lost-Rescue Example Audit") || !report.includes("zero-call final-diagnostic audit") || !report.includes("Use example for training now: no")) {
      errors.push(`${entry.name}: report must identify zero-call final diagnostic audit and no-training decision.`);
    }
  }
}

async function validateFinalAmbiguityStratificationAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("final-ambiguity-stratification-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let exampleAudits;
    let selectorStrata;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      exampleAudits = await readJsonl(path.join(runPath, "example_audits.jsonl"));
      selectorStrata = await readJsonl(path.join(runPath, "selector_strata.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed final ambiguity stratification audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "final_ambiguity_stratification_audit") {
      errors.push(`${entry.name}: artifact_type must be final_ambiguity_stratification_audit.`);
    }
    if (Number(result.summary?.final_examples) !== exampleAudits.length || exampleAudits.length === 0) {
      errors.push(`${entry.name}: example audit count must match summary.`);
    }
    if (Number(result.summary?.final_pairwise_rows) !== 61) {
      errors.push(`${entry.name}: expected 61 final pairwise rows in the expanded diagnostic packet.`);
    }
    if (selectorStrata.length !== exampleAudits.length * 3) {
      errors.push(`${entry.name}: selector strata must include three selector rows per example.`);
    }
    const riskRows = exampleAudits.filter((row) => row.ambiguity_risk?.is_ambiguity_risk);
    if (Number(result.summary?.ambiguity_risk_examples) !== riskRows.length || Number(result.summary?.clean_examples) !== exampleAudits.length - riskRows.length) {
      errors.push(`${entry.name}: ambiguity-risk and clean counts must match example audits.`);
    }
    if (!riskRows.some((row) => row.example_id === "2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137")) {
      errors.push(`${entry.name}: D274 lost-rescue example must remain ambiguity-risk.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: ambiguity stratification audit must make zero calls and launch no compute.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_tuning !== false || result.leakage_guard?.final_diagnostic_use !== "forbidden_diagnostic_stratification_only") {
      errors.push(`${entry.name}: leakage guard must keep final labels diagnostic-only.`);
    }
    if (result.decision?.integrate_boundary_selector_now !== false || result.decision?.buy_more_openai_labels_now !== false || result.decision?.launch_gpu_now !== false || result.decision?.use_ambiguity_risk_rows_for_training !== false) {
      errors.push(`${entry.name}: ambiguity audit cannot authorize selector integration, training use, more labels, or GPU launch.`);
    }
    if (!result.strata_summary?.["clean:d262"] || !result.strata_summary?.["clean:boundary_only"] || !result.strata_summary?.["ambiguity_risk:boundary_only"]) {
      errors.push(`${entry.name}: missing clean and ambiguity-risk selector summaries.`);
    }
    if (Number(result.diagnosis?.clean_boundary_delta_vs_d262) !== 0) {
      errors.push(`${entry.name}: expected boundary-only gain to disappear on the clean stratum.`);
    }
    for (const [index, row] of exampleAudits.entries()) {
      const label = `${entry.name}.example_audits:${index + 1}`;
      if (!row.example_id || !row.question || !row.reference?.answer || !row.selector_outcomes?.d262 || !row.ambiguity_risk) {
        errors.push(`${label}: example audit row must include question, reference, selector outcomes, and ambiguity risk.`);
      }
    }
    if (!report.includes("Final Ambiguity Stratification Audit") || !report.includes("zero-call final diagnostic stratification audit") || !report.includes("Use ambiguity-risk rows for training: no")) {
      errors.push(`${entry.name}: report must identify zero-call final diagnostic stratification and no-training decision.`);
    }
  }
}

async function validateCleanValidationSliceAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("clean-validation-slice-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let exampleAudits;
    let selectorPairStrata;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      exampleAudits = await readJsonl(path.join(runPath, "example_audits.jsonl"));
      selectorPairStrata = await readJsonl(path.join(runPath, "selector_pair_strata.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed clean validation slice audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "clean_validation_slice_audit") {
      errors.push(`${entry.name}: artifact_type must be clean_validation_slice_audit.`);
    }
    if (Number(result.summary?.validation_examples) !== exampleAudits.length || exampleAudits.length === 0) {
      errors.push(`${entry.name}: example audit count must match summary.`);
    }
    if (Number(result.summary?.validation_pairwise_rows) !== 24) {
      errors.push(`${entry.name}: expected 24 validation pairwise rows in the expanded packet.`);
    }
    if (selectorPairStrata.length !== Number(result.summary?.validation_pairwise_rows) * 4) {
      errors.push(`${entry.name}: selector pair strata must include four selector rows per pair.`);
    }
    const cleanRows = exampleAudits.filter((row) => row.clean_eval_eligible);
    const riskRows = exampleAudits.filter((row) => row.ambiguity_risk?.is_ambiguity_risk);
    if (Number(result.summary?.clean_eval_examples) !== cleanRows.length || Number(result.summary?.ambiguity_risk_examples) !== riskRows.length) {
      errors.push(`${entry.name}: clean and ambiguity-risk counts must match example audits.`);
    }
    if (cleanRows.length < 5) {
      errors.push(`${entry.name}: clean validation slice must include at least five examples before promotion as diagnostic.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: clean validation audit must make zero calls and launch no compute.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_tuning !== false || result.leakage_guard?.final_window_labels_used_for_evaluation !== false || result.leakage_guard?.audit_is_zero_call !== true) {
      errors.push(`${entry.name}: leakage guard must exclude final-window labels and be zero-call.`);
    }
    if (result.decision?.promote_clean_validation_slice_as_replacement_final_eval_now !== true || result.decision?.integrate_boundary_selector_now !== false || result.decision?.buy_more_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must promote clean diagnostic but reject selector integration, more labels, and GPU launch.`);
    }
    if (!result.strata_summary?.["clean_eval:d262_constrained"] || !result.strata_summary?.["clean_eval:boundary_only"] || !result.tournament_summary?.["clean_eval:selected_hybrid"]) {
      errors.push(`${entry.name}: missing clean validation selector summaries.`);
    }
    if (Number(result.strata_summary?.["clean_eval:boundary_only"]?.accuracy) > Number(result.strata_summary?.["clean_eval:d262_constrained"]?.accuracy)) {
      errors.push(`${entry.name}: boundary-only should not beat D262 constrained on clean validation pair accuracy.`);
    }
    for (const [index, row] of exampleAudits.entries()) {
      const label = `${entry.name}.example_audits:${index + 1}`;
      if (!row.example_id || !row.question || !row.reference?.answer || !row.tournament_outcomes || !Array.isArray(row.difficulty_tags)) {
        errors.push(`${label}: example audit row must include question, reference, tournament outcomes, and difficulty tags.`);
      }
    }
    if (!report.includes("Clean Validation Slice Audit") || !report.includes("zero-call non-final validation audit") || !report.includes("Launch GPU now: no")) {
      errors.push(`${entry.name}: report must identify zero-call non-final validation audit and no-GPU decision.`);
    }
  }
}

async function validateSelectorCoverageConfirmationAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("selector-coverage-confirmation-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let coverageRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      coverageRows = await readJsonl(path.join(runPath, "selector_coverage.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed selector coverage confirmation audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "selector_coverage_confirmation_audit") {
      errors.push(`${entry.name}: artifact_type must be selector_coverage_confirmation_audit.`);
    }
    if (Number(result.summary?.selector_slice_rows) !== coverageRows.length || coverageRows.length === 0) {
      errors.push(`${entry.name}: coverage row count must match summary.`);
    }
    if (!coverageRows.some((row) => row.selector === "d272_selected_hybrid" && row.slice === "existing_validation")) {
      errors.push(`${entry.name}: coverage audit must include D272 selected hybrid on existing validation.`);
    }
    if (coverageRows.some((row) => row.selector === "d272_selected_hybrid" && row.slice === "frontier_pool_validation")) {
      errors.push(`${entry.name}: D272 selected hybrid unexpectedly has frontier coverage; update the audit decision.`);
    }
    if (Number(result.summary?.selected_hybrid_broader_frontier_coverage_pairs) !== 0) {
      errors.push(`${entry.name}: selected hybrid broader frontier coverage must remain explicitly zero.`);
    }
    if (!coverageRows.some((row) => row.slice === "frontier_pool_validation" && Number(row.pairs) === 21)) {
      errors.push(`${entry.name}: expected frontier-pool validation coverage rows with 21 pairs.`);
    }
    if (result.diagnosis?.primary_finding !== "selected_hybrid_broader_coverage_missing") {
      errors.push(`${entry.name}: expected selected hybrid broader coverage missing diagnosis.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: selector coverage audit must make zero calls and launch no compute.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_tuning !== false || result.leakage_guard?.final_window_labels_used_for_evaluation !== false || result.leakage_guard?.audit_is_zero_call !== true) {
      errors.push(`${entry.name}: leakage guard must exclude final-window labels and be zero-call.`);
    }
    if (result.decision?.promote_selected_hybrid_now !== false || result.decision?.buy_more_openai_labels_now !== false || result.decision?.launch_gpu_now !== false || result.decision?.run_zero_call_frontier_replay_next !== true) {
      errors.push(`${entry.name}: decision must reject promotion/spend and request zero-call frontier replay.`);
    }
    for (const [index, row] of coverageRows.entries()) {
      const label = `${entry.name}.selector_coverage:${index + 1}`;
      if (!row.selector || !row.slice || !Number.isFinite(Number(row.pairs)) || !Number.isFinite(Number(row.accuracy))) {
        errors.push(`${label}: coverage row must include selector, slice, pairs, and accuracy.`);
      }
    }
    if (!report.includes("Selector Coverage Confirmation Audit") || !report.includes("zero-call held-out selector coverage audit") || !report.includes("Promote selected hybrid now: no")) {
      errors.push(`${entry.name}: report must identify zero-call selector coverage audit and no-promotion decision.`);
    }
  }
}

async function validateFrontierReplayAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("frontier-replay-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let pairReplay;
    let selectorRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      pairReplay = await readJsonl(path.join(runPath, "pair_replay.jsonl"));
      selectorRows = await readJsonl(path.join(runPath, "selector_rows.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed frontier replay audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "frontier_replay_audit") {
      errors.push(`${entry.name}: artifact_type must be frontier_replay_audit.`);
    }
    if (Number(result.summary?.frontier_validation_pairs) !== pairReplay.length || pairReplay.length !== 21) {
      errors.push(`${entry.name}: frontier replay must cover exactly 21 validation pairs.`);
    }
    if (selectorRows.length !== pairReplay.length * 3) {
      errors.push(`${entry.name}: selector rows must include three replay policies per pair.`);
    }
    const d262 = result.selector_summary?.d262_proxy_hard_negative_baseline;
    const boundary = result.selector_summary?.d272_frontier_replay_boundary_only;
    const hybrid = result.selector_summary?.d272_frontier_replay_selected_hybrid;
    if (!d262 || !boundary || !hybrid) {
      errors.push(`${entry.name}: missing D262 proxy, boundary-only, or selected-hybrid summaries.`);
    } else {
      if (Number(boundary.correct) >= Number(d262.correct)) {
        errors.push(`${entry.name}: boundary-only should not match or beat D262 proxy on frontier replay.`);
      }
      if (Number(hybrid.correct) > Number(d262.correct)) {
        errors.push(`${entry.name}: selected hybrid unexpectedly beats D262 proxy; update decision.`);
      }
    }
    if (result.diagnosis?.primary_finding !== "frontier_replay_does_not_justify_hybrid_promotion") {
      errors.push(`${entry.name}: expected no-promotion frontier replay diagnosis.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: frontier replay audit must make zero calls and launch no compute.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_tuning !== false || result.leakage_guard?.final_window_labels_used_for_evaluation !== false || result.leakage_guard?.audit_is_zero_call !== true) {
      errors.push(`${entry.name}: leakage guard must exclude final-window labels and be zero-call.`);
    }
    if (result.decision?.promote_selected_hybrid_now !== false || result.decision?.integrate_boundary_only_now !== false || result.decision?.buy_more_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject hybrid/boundary promotion, more labels, and GPU launch.`);
    }
    for (const [index, row] of selectorRows.entries()) {
      const label = `${entry.name}.selector_rows:${index + 1}`;
      if (!row.pair_id || !row.selector || !Number.isFinite(Number(row.margin)) || row.training_use !== "allowed_nonfinal_frontier_supervision") {
        errors.push(`${label}: selector row must include pair id, selector, numeric margin, and non-final frontier training use.`);
      }
    }
    if (!report.includes("Frontier Replay Audit") || !report.includes("zero-call frontier replay audit") || !report.includes("Promote selected hybrid now: no")) {
      errors.push(`${entry.name}: report must identify zero-call frontier replay and no-promotion decision.`);
    }
  }
}

async function validateHardNegativePromotionGateAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("hard-negative-promotion-gate-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let cleanPairRows;
    let finalDiagnosticRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      cleanPairRows = await readJsonl(path.join(runPath, "clean_pair_rows.jsonl"));
      finalDiagnosticRows = await readJsonl(path.join(runPath, "final_clean_diagnostic.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed hard-negative promotion gate audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "hard_negative_promotion_gate_audit") {
      errors.push(`${entry.name}: artifact_type must be hard_negative_promotion_gate_audit.`);
    }
    if (Number(result.summary?.clean_eval_pairs) !== 19 || cleanPairRows.length !== 57) {
      errors.push(`${entry.name}: promotion gate must cover 19 clean pairs for three hard-negative policies.`);
    }
    if (Number(result.summary?.frontier_validation_pairs) !== 21) {
      errors.push(`${entry.name}: promotion gate must carry forward 21 frontier validation pairs.`);
    }
    const hardBaseline = result.selector_summary?.hard_negative_baseline;
    const d262Clean = result.baseline_comparison?.d262_pool_pairwise_clean;
    const d262Frontier = result.baseline_comparison?.d278_d262_proxy_frontier;
    if (!hardBaseline || !d262Clean || !d262Frontier) {
      errors.push(`${entry.name}: missing hard-negative baseline or D262 comparison summaries.`);
    } else {
      if (Number(hardBaseline.clean_validation?.pairs) !== 19) {
        errors.push(`${entry.name}: hard-negative baseline must report 19 clean validation pairs.`);
      }
      if (Number(hardBaseline.clean_validation?.correct) > Number(d262Clean.correct)) {
        errors.push(`${entry.name}: hard-negative baseline unexpectedly beats D262 clean slice; update promotion decision.`);
      }
      if (Number(hardBaseline.frontier_validation?.correct) > Number(d262Frontier.correct)) {
        errors.push(`${entry.name}: hard-negative baseline unexpectedly beats D262 frontier proxy; update promotion decision.`);
      }
    }
    if (finalDiagnosticRows.length < 4 || finalDiagnosticRows.some((row) => row.training_use !== "forbidden_final_diagnostic_only")) {
      errors.push(`${entry.name}: final clean rows must be reported only as forbidden diagnostics.`);
    }
    if (result.diagnosis?.primary_finding !== "hard_negative_signal_not_sufficient_for_promotion") {
      errors.push(`${entry.name}: expected hard-negative no-promotion diagnosis.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: hard-negative promotion gate must make zero calls and launch no compute.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_tuning !== false || result.leakage_guard?.final_window_labels_used_for_evaluation !== false || result.leakage_guard?.final_window_rows_reported_as_diagnostic_only !== true || result.leakage_guard?.audit_is_zero_call !== true) {
      errors.push(`${entry.name}: leakage guard must exclude final-window labels and be zero-call.`);
    }
    if (result.decision?.promote_hard_negative_selector_now !== false || result.decision?.promote_d262_proxy_as_active_selector_now !== false || result.decision?.buy_more_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject hard-negative/D262 promotion, more labels, and GPU launch.`);
    }
    for (const [index, row] of cleanPairRows.entries()) {
      const label = `${entry.name}.clean_pair_rows:${index + 1}`;
      if (!row.pair_id || !row.selector || row.stratum !== "clean_eval" || !Number.isFinite(Number(row.margin)) || row.training_use !== "allowed_validation") {
        errors.push(`${label}: clean pair row must include pair id, selector, clean stratum, numeric margin, and validation use.`);
      }
    }
    if (!report.includes("Hard-Negative Promotion Gate Audit") || !report.includes("zero-call promotion gate") || !report.includes("Promote hard-negative selector now: no")) {
      errors.push(`${entry.name}: report must identify zero-call hard-negative promotion gate and no-promotion decision.`);
    }
  }
}

async function validateTemperedHardHybridAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("tempered-hard-hybrid-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let gridRows;
    let existingRows;
    let frontierRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      gridRows = await readJsonl(path.join(runPath, "grid_rows.jsonl"));
      existingRows = await readJsonl(path.join(runPath, "selected_existing_pair_rows.jsonl"));
      frontierRows = await readJsonl(path.join(runPath, "selected_frontier_pair_rows.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed tempered hard hybrid audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "tempered_hard_hybrid_audit") {
      errors.push(`${entry.name}: artifact_type must be tempered_hard_hybrid_audit.`);
    }
    if (gridRows.length !== 81 || Number(result.summary?.grid_rows) !== gridRows.length) {
      errors.push(`${entry.name}: expected 81 grid rows for the tempered hard hybrid audit.`);
    }
    if (existingRows.length !== 24 || frontierRows.length !== 21) {
      errors.push(`${entry.name}: selected rows must cover 24 existing-validation and 21 frontier-validation pairs.`);
    }
    const selected = result.selected_policy;
    if (!selected || Number(selected.clean_validation_correct) < 18 || Number(selected.existing_validation_correct) < 20 || Number(selected.frontier_validation_correct) < 19) {
      errors.push(`${entry.name}: selected tempered candidate must preserve existing/frontier thresholds and improve clean validation.`);
    }
    if (Number(selected?.alpha_hard_negative) >= 0) {
      errors.push(`${entry.name}: expected selected candidate to temper, not amplify, hard-negative margin.`);
    }
    if (result.diagnosis?.primary_finding !== "tempered_hard_negative_candidate_found") {
      errors.push(`${entry.name}: expected tempered hard-negative candidate finding.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: tempered hard hybrid audit must make zero calls and launch no compute.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_tuning !== false || result.leakage_guard?.final_window_labels_used_for_evaluation !== false || result.leakage_guard?.audit_is_zero_call !== true) {
      errors.push(`${entry.name}: leakage guard must exclude final-window labels and be zero-call.`);
    }
    if (result.decision?.promote_tempered_hard_hybrid_now !== false || result.decision?.buy_more_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject immediate promotion, more labels, and GPU launch.`);
    }
    for (const [index, row] of existingRows.entries()) {
      const label = `${entry.name}.selected_existing_pair_rows:${index + 1}`;
      if (!row.pair_id || !Number.isFinite(Number(row.combined_margin)) || !["clean_eval", "other_validation"].includes(row.stratum) || row.training_use !== "allowed_validation") {
        errors.push(`${label}: existing selected row must include pair id, combined margin, validation stratum, and allowed validation use.`);
      }
    }
    for (const [index, row] of frontierRows.entries()) {
      const label = `${entry.name}.selected_frontier_pair_rows:${index + 1}`;
      if (!row.pair_id || !Number.isFinite(Number(row.combined_margin)) || row.training_use !== "allowed_nonfinal_frontier_supervision") {
        errors.push(`${label}: frontier selected row must include pair id, combined margin, and non-final frontier use.`);
      }
    }
    if (!report.includes("Tempered Hard Hybrid Audit") || !report.includes("zero-call comparable-coverage hybrid audit") || !report.includes("Promote tempered hard hybrid now: no")) {
      errors.push(`${entry.name}: report must identify zero-call tempered hard hybrid audit and no-promotion decision.`);
    }
  }
}

async function validateTemperedHardHybridLooAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("tempered-hard-hybrid-loo-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let foldRows;
    let selectedRows;
    let frozenRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      foldRows = await readJsonl(path.join(runPath, "fold_rows.jsonl"));
      selectedRows = await readJsonl(path.join(runPath, "selected_heldout_pair_rows.jsonl"));
      frozenRows = await readJsonl(path.join(runPath, "frozen_heldout_pair_rows.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed tempered hard hybrid LOO audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "tempered_hard_hybrid_loo_audit") {
      errors.push(`${entry.name}: artifact_type must be tempered_hard_hybrid_loo_audit.`);
    }
    if (foldRows.length !== 7 || Number(result.summary?.folds) !== 7 || Number(result.summary?.clean_pairs) !== 19) {
      errors.push(`${entry.name}: LOO audit must cover seven clean examples and nineteen clean pairs.`);
    }
    if (selectedRows.length !== 19 || frozenRows.length !== 19) {
      errors.push(`${entry.name}: LOO heldout pair rows must cover nineteen selected and frozen pairs.`);
    }
    if (Number(result.summary?.folds_reselecting_frozen_policy) >= Number(result.summary?.folds)) {
      errors.push(`${entry.name}: D280 policy unexpectedly stable under all LOO folds; update decision.`);
    }
    if (Number(result.summary?.frozen_d280_heldout_correct) < 18 || Number(result.summary?.loo_selected_heldout_correct) > Number(result.summary?.frozen_d280_heldout_correct)) {
      errors.push(`${entry.name}: expected frozen D280 to remain high-scoring and LOO-selected policy not to exceed it.`);
    }
    if (result.diagnosis?.primary_finding !== "tempered_policy_not_stable_under_loo") {
      errors.push(`${entry.name}: expected LOO instability diagnosis.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: tempered hard hybrid LOO audit must make zero calls and launch no compute.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_tuning !== false || result.leakage_guard?.final_window_labels_used_for_evaluation !== false || result.leakage_guard?.audit_is_zero_call !== true) {
      errors.push(`${entry.name}: leakage guard must exclude final-window labels and be zero-call.`);
    }
    if (result.decision?.promote_tempered_hard_hybrid_now !== false || result.decision?.buy_more_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject immediate promotion, more labels, and GPU launch.`);
    }
    for (const [index, row] of selectedRows.entries()) {
      const label = `${entry.name}.selected_heldout_pair_rows:${index + 1}`;
      if (!row.pair_id || row.selector !== "loo_selected" || !Number.isFinite(Number(row.combined_margin)) || row.training_use !== "allowed_validation") {
        errors.push(`${label}: selected heldout row must include pair id, LOO selector, combined margin, and allowed validation use.`);
      }
    }
    for (const [index, row] of frozenRows.entries()) {
      const label = `${entry.name}.frozen_heldout_pair_rows:${index + 1}`;
      if (!row.pair_id || row.selector !== "frozen_d280" || !Number.isFinite(Number(row.combined_margin)) || row.training_use !== "allowed_validation") {
        errors.push(`${label}: frozen heldout row must include pair id, frozen selector, combined margin, and allowed validation use.`);
      }
    }
    if (!report.includes("Tempered Hard Hybrid LOO Audit") || !report.includes("zero-call leave-one-clean-example-out stability audit") || !report.includes("Promote tempered hard hybrid now: no")) {
      errors.push(`${entry.name}: report must identify zero-call LOO stability audit and no-promotion decision.`);
    }
  }
}

async function validateHeldoutCoverageGapAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("heldout-coverage-gap-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let sourceRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      sourceRows = await readJsonl(path.join(runPath, "source_inventory.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed heldout coverage gap audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "heldout_coverage_gap_audit") {
      errors.push(`${entry.name}: artifact_type must be heldout_coverage_gap_audit.`);
    }
    if (sourceRows.length < 5 || Number(result.summary?.sources_inventoried) !== sourceRows.length) {
      errors.push(`${entry.name}: heldout inventory must cover at least five source rows and match summary.`);
    }
    if (Number(result.summary?.large_d280_margin_compatible_sources) !== 0) {
      errors.push(`${entry.name}: large D280-compatible heldout unexpectedly exists; update decision.`);
    }
    if (Number(result.summary?.largest_margin_compatible_units) > 21) {
      errors.push(`${entry.name}: largest margin-compatible source unexpectedly exceeds current small slices.`);
    }
    if (Number(result.summary?.largest_temporal_incompatible_units) < 60) {
      errors.push(`${entry.name}: expected large temporal scaffold heldout inventory.`);
    }
    if (!sourceRows.some((row) => row.source_id === "temporal_321_389_candidate_selector" && row.d280_margin_compatible === false && row.temporal_or_paper_separate === true)) {
      errors.push(`${entry.name}: inventory must include 321-389 temporal source as non-margin-compatible.`);
    }
    if (result.diagnosis?.primary_finding !== "margin_compatible_heldout_gap") {
      errors.push(`${entry.name}: expected margin-compatible heldout gap diagnosis.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: heldout coverage gap audit must make zero calls and launch no compute.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_tuning !== false || result.leakage_guard?.final_window_labels_used_for_selector_validation !== false || result.leakage_guard?.audit_is_zero_call !== true) {
      errors.push(`${entry.name}: leakage guard must exclude final-window labels and be zero-call.`);
    }
    if (result.decision?.promote_d280_or_d281_selector_now !== false || result.decision?.treat_321_389_as_d280_validation !== false || result.decision?.buy_more_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject selector promotion, 321-389-as-D280 validation, labels, and GPU launch.`);
    }
    for (const [index, row] of sourceRows.entries()) {
      const label = `${entry.name}.source_inventory:${index + 1}`;
      if (!row.source_id || !row.source_run_id || !row.label_kind || !Number.isFinite(Number(row.clean_or_eval_units)) || !row.limitation) {
        errors.push(`${label}: source row must include id, run id, label kind, units, and limitation.`);
      }
    }
    if (!report.includes("Heldout Coverage Gap Audit") || !report.includes("zero-call heldout inventory audit") || !report.includes("Treat 321-389 as D280 validation: no")) {
      errors.push(`${entry.name}: report must identify zero-call heldout inventory and reject 321-389 as D280 validation.`);
    }
  }
}

async function validateMarginCompatibleHeldoutPlanRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("margin-compatible-heldout-plan-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let sourceRows;
    let scaffoldRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      sourceRows = await readJsonl(path.join(runPath, "source_inventory.jsonl"));
      scaffoldRows = await readJsonl(path.join(runPath, "scaffold_candidate_inventory.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed margin-compatible heldout plan artifacts.`);
      continue;
    }
    if (result.artifact_type !== "margin_compatible_heldout_plan") {
      errors.push(`${entry.name}: artifact_type must be margin_compatible_heldout_plan.`);
    }
    if (Number(result.final_window?.examples) !== 69 || scaffoldRows.length !== 69) {
      errors.push(`${entry.name}: plan must cover the 69-example 321-389 final window.`);
    }
    if (Number(result.final_window?.answerable) <= 0 || Number(result.final_window?.abstain) <= 0) {
      errors.push(`${entry.name}: final window must include answerable and abstain examples.`);
    }
    if (sourceRows.length < 4 || Number(result.scaffold_candidate_inventory?.examples_with_three_candidates) !== 69) {
      errors.push(`${entry.name}: source inventory and scaffold candidate coverage are incomplete.`);
    }
    if (result.scaffold_candidate_inventory?.zero_call_scaffold_contrast_reusable !== true || result.scaffold_candidate_inventory?.d280_margin_compatible_now !== false) {
      errors.push(`${entry.name}: plan must distinguish reusable scaffold contrasts from D280 compatibility.`);
    }
    if (!sourceRows.some((row) => row.source_id === "temporal_321_389_scaffold_candidates" && row.d280_margin_compatible_now === false)) {
      errors.push(`${entry.name}: inventory must mark 321-389 scaffold candidates as non-D280-compatible.`);
    }
    if (!sourceRows.some((row) => row.source_id === "claim_nli_feature_cache" && row.d280_margin_compatible_now === "existing_candidates_only")) {
      errors.push(`${entry.name}: inventory must identify claim-NLI coverage as existing-candidates only.`);
    }
    if (!Array.isArray(result.missing_requirements) || !result.missing_requirements.some((row) => row.requirement === "claim_nli_scores_for_candidate_claims" && row.status === "missing_for_321_389")) {
      errors.push(`${entry.name}: missing requirements must include 321-389 claim-NLI scores.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: heldout plan must make zero calls and launch no compute.`);
    }
    if (Number(result.label_plan?.conservative_2x_openai_cost_usd) <= 0 || Number(result.label_plan?.conservative_2x_openai_cost_usd) >= 1) {
      errors.push(`${entry.name}: conservative label estimate should be positive and remain below $1.`);
    }
    if (result.budget?.within_budget_if_label_batch_runs !== true || Number(result.budget?.projected_total_after_conservative_label_batch_usd) >= Number(result.budget?.max_budget_usd)) {
      errors.push(`${entry.name}: future label-batch estimate must remain within the total budget.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_tuning !== false || result.leakage_guard?.final_window_labels_used_for_d280_validation !== false || result.leakage_guard?.audit_is_zero_call !== true) {
      errors.push(`${entry.name}: leakage guard must exclude final-window labels from training/tuning/D280 validation and be zero-call.`);
    }
    if (result.decision?.treat_321_389_as_d280_validation_now !== false || result.decision?.build_margin_compatible_packet_next !== true || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject current D280 validation, labels, and GPU while requiring packet construction.`);
    }
    for (const [index, row] of scaffoldRows.entries()) {
      const label = `${entry.name}.scaffold_candidate_inventory:${index + 1}`;
      if (!row.example_id || !Array.isArray(row.candidates) || row.candidates.length !== 3 || typeof row.has_supported_vs_unsupported_contrast !== "boolean") {
        errors.push(`${label}: scaffold row must include example id, three candidates, and contrast boolean.`);
      }
    }
    if (!report.includes("Margin-Compatible Heldout Plan") || !report.includes("zero-call margin-compatible heldout plan") || !report.includes("Treat 321-389 as D280 validation now: no") || !report.includes("Launch GPU now: no")) {
      errors.push(`${entry.name}: report must identify zero-call heldout plan and no-label/no-GPU decisions.`);
    }
  }
}

async function validateMarginCompatibleHeldoutPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("margin-compatible-heldout-packet-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let supportRows;
    let rawPairs;
    let duplicatePairs;
    let usablePairs;
    let nliInput;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      supportRows = await readJsonl(path.join(runPath, "support_labels.jsonl"));
      rawPairs = await readJsonl(path.join(runPath, "raw_heldout_pairwise.jsonl"));
      duplicatePairs = await readJsonl(path.join(runPath, "exact_duplicate_pairwise.jsonl"));
      usablePairs = await readJsonl(path.join(runPath, "heldout_pairwise.jsonl"));
      nliInput = await readJsonl(path.join(runPath, "claim-nli-input.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed margin-compatible heldout packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "margin_compatible_heldout_packet") {
      errors.push(`${entry.name}: artifact_type must be margin_compatible_heldout_packet.`);
    }
    if (Number(result.window?.examples) !== 69 || Number(result.counts?.support_labels) !== supportRows.length || supportRows.length !== 207) {
      errors.push(`${entry.name}: packet must cover 69 examples and 207 support labels.`);
    }
    if (Number(result.counts?.raw_supported_vs_unsupported_pairs) !== rawPairs.length || Number(result.counts?.exact_duplicate_pairs) !== duplicatePairs.length || Number(result.counts?.heldout_pair_rows) !== usablePairs.length) {
      errors.push(`${entry.name}: pair counts must match raw, duplicate, and usable artifacts.`);
    }
    if (rawPairs.length !== duplicatePairs.length || usablePairs.length !== 0 || nliInput.length !== 0) {
      errors.push(`${entry.name}: current 321-389 scaffold packet must fail closed because all raw pairs are exact duplicates.`);
    }
    if (result.status !== "no_heldout_pair_signal" || result.compatibility?.ready_for_d280_scoring_without_new_nli !== false) {
      errors.push(`${entry.name}: status and compatibility must reject D280 scoring.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: packet must make zero calls and launch no compute.`);
    }
    if (result.decision?.score_local_nli_next !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false || result.decision?.promote_d280_now !== false) {
      errors.push(`${entry.name}: decision must reject NLI scoring, labels, GPU, and D280 promotion for duplicate-only pairs.`);
    }
    if (!report.includes("Margin-Compatible Heldout Packet") || !report.includes("Exact duplicate pairs removed") || !report.includes("Promote D280 now: no")) {
      errors.push(`${entry.name}: report must document duplicate filtering and no-promotion decision.`);
    }
  }
}

async function validateMarginCompatibleHeldoutNliRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("margin-compatible-heldout-nli-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let inputRows;
    let scoreRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      inputRows = await readJsonl(path.join(runPath, "claim-nli-input.jsonl"));
      scoreRows = await readJsonl(path.join(runPath, "claim-nli-scores.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed margin-compatible heldout NLI artifacts.`);
      continue;
    }
    if (result.artifact_type !== "margin_compatible_heldout_nli") {
      errors.push(`${entry.name}: artifact_type must be margin_compatible_heldout_nli.`);
    }
    if (result.status !== "heldout_nli_no_units" || inputRows.length !== 0 || scoreRows.length !== 0) {
      errors.push(`${entry.name}: NLI run must record no units for duplicate-only heldout packet.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: NLI run must make zero calls and launch no rented compute.`);
    }
    if (result.decision?.evaluate_frozen_d280_next !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject D280 eval, labels, and GPU when no NLI units exist.`);
    }
    if (!report.includes("Margin-Compatible Heldout NLI") || !report.includes("Input NLI units: 0") || !report.includes("Evaluate frozen D280 next: no")) {
      errors.push(`${entry.name}: report must document zero NLI units and no-eval decision.`);
    }
  }
}

async function validateMarginCompatibleHeldoutEvalRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("margin-compatible-heldout-eval-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let pairRows;
    let selectionRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      pairRows = await readJsonl(path.join(runPath, "heldout_pair_predictions.jsonl"));
      selectionRows = await readJsonl(path.join(runPath, "heldout_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed margin-compatible heldout eval artifacts.`);
      continue;
    }
    if (result.artifact_type !== "margin_compatible_heldout_eval") {
      errors.push(`${entry.name}: artifact_type must be margin_compatible_heldout_eval.`);
    }
    if (result.status !== "heldout_eval_no_usable_pairs" || pairRows.length !== 0 || selectionRows.length !== 0 || Number(result.metrics?.d280_frozen_pairwise?.pairs) !== 0) {
      errors.push(`${entry.name}: eval must reject duplicate-only heldout with zero usable pairs.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: eval must make zero calls and launch no compute.`);
    }
    if (result.decision?.promote_d280_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false || result.decision?.build_larger_margin_compatible_nonfinal_heldout_next !== true) {
      errors.push(`${entry.name}: decision must reject promotion/labels/GPU and require larger compatible heldout.`);
    }
    if (!report.includes("Margin-Compatible Heldout Eval") || !report.includes("Frozen D280 | 0 | 0") || !report.includes("Build larger compatible non-final heldout next: yes")) {
      errors.push(`${entry.name}: report must document zero usable D280 evidence and next heldout step.`);
    }
  }
}

async function validateFinalContrastSourceInventoryRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("final-contrast-source-inventory-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let sourceRows;
    let contrastRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      sourceRows = await readJsonl(path.join(runPath, "source_inventory.jsonl"));
      contrastRows = await readJsonl(path.join(runPath, "usable_answer_contrasts.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed final contrast source inventory artifacts.`);
      continue;
    }
    if (result.artifact_type !== "final_contrast_source_inventory") {
      errors.push(`${entry.name}: artifact_type must be final_contrast_source_inventory.`);
    }
    if (sourceRows.length < 60 || contrastRows.length < 800 || Number(result.summary?.usable_answer_contrast_pairs) !== contrastRows.length) {
      errors.push(`${entry.name}: expected broad final-window contrast inventory with >=800 usable pairs.`);
    }
    if (Number(result.summary?.examples_with_usable_answer_contrasts) < 40 || Number(result.summary?.exact_duplicate_answer_contrast_pairs) <= 0) {
      errors.push(`${entry.name}: inventory must cover many examples and track duplicate contrasts.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: inventory must make zero calls and launch no compute.`);
    }
    if (result.decision?.build_margin_compatible_candidate_packet_now !== true || result.decision?.run_paid_adjudication_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must build zero-call packet and reject labels/GPU.`);
    }
    if (!report.includes("Final Contrast Source Inventory") || !report.includes("Usable non-duplicate answer contrast pairs") || !report.includes("Build margin-compatible candidate packet now: yes")) {
      errors.push(`${entry.name}: report must document usable contrasts and packet decision.`);
    }
  }
}

async function validateFinalMarginCompatibleHeldoutPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("final-margin-compatible-heldout-packet-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let pairs;
    let nliInput;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      pairs = await readJsonl(path.join(runPath, "heldout_pairwise.jsonl"));
      nliInput = await readJsonl(path.join(runPath, "claim-nli-input.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed final margin-compatible packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "final_margin_compatible_heldout_packet" || result.status !== "ready_for_frozen_selector_nli_and_eval") {
      errors.push(`${entry.name}: packet must be ready final-margin-compatible heldout.`);
    }
    if (pairs.length < 800 || nliInput.length < 900 || Number(result.counts?.heldout_pair_rows) !== pairs.length || Number(result.counts?.nli_units_required) !== nliInput.length) {
      errors.push(`${entry.name}: packet counts must match large pair and NLI artifacts.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: packet must make zero calls and launch no compute.`);
    }
    if (result.decision?.score_local_nli_next !== true || result.decision?.evaluate_frozen_d280_next !== true || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must proceed to local NLI/eval and reject paid spend.`);
    }
    if (!report.includes("Final Margin-Compatible Heldout Packet") || !report.includes("Evaluate frozen D280 next: yes")) {
      errors.push(`${entry.name}: report must document frozen D280 eval path.`);
    }
  }
}

async function validateFinalMarginCompatibleHeldoutNliRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("final-margin-compatible-heldout-nli-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let inputRows;
    let scoreRows;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      inputRows = await readJsonl(path.join(runPath, "claim-nli-input.jsonl"));
      scoreRows = await readJsonl(path.join(runPath, "claim-nli-scores.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed final heldout NLI artifacts.`);
      continue;
    }
    if (result.artifact_type !== "margin_compatible_heldout_nli" || result.status !== "heldout_nli_scored") {
      errors.push(`${entry.name}: final heldout NLI must be scored.`);
    }
    if (inputRows.length < 900 || scoreRows.length !== inputRows.length || Number(result.semantic_model?.scored_units) !== scoreRows.length) {
      errors.push(`${entry.name}: NLI score count must match large input set.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: NLI run must make zero calls and launch no rented compute.`);
    }
    if (result.decision?.evaluate_frozen_d280_next !== true || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must proceed to frozen eval and reject paid spend.`);
    }
  }
}

async function validateFinalMarginCompatibleHeldoutEvalRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("final-margin-compatible-heldout-eval-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let pairRows;
    let selectionRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      pairRows = await readJsonl(path.join(runPath, "heldout_pair_predictions.jsonl"));
      selectionRows = await readJsonl(path.join(runPath, "heldout_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed final heldout eval artifacts.`);
      continue;
    }
    if (result.artifact_type !== "margin_compatible_heldout_eval" || result.status !== "frozen_d280_not_validated") {
      errors.push(`${entry.name}: final heldout eval must reject frozen D280.`);
    }
    if (pairRows.length < 800 || selectionRows.length < 40 || Number(result.metrics?.d280_frozen_pairwise?.pairs) !== pairRows.length) {
      errors.push(`${entry.name}: eval must cover large final heldout pair set.`);
    }
    if (Number(result.metrics?.d280_frozen_pairwise?.correct) >= Number(result.metrics?.d262_pairwise?.correct)) {
      errors.push(`${entry.name}: frozen D280 should not be validated when it underperforms D262.`);
    }
    if (Number(result.metrics?.d280_frozen_selection?.selection_support_rate) >= 0.75 || result.decision?.promote_d280_now !== false) {
      errors.push(`${entry.name}: D280 selection must remain below promotion threshold and not promote.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: eval must make zero calls and launch no compute.`);
    }
    if (result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject immediate labels and GPU.`);
    }
    if (!report.includes("Final Margin-Compatible Heldout Eval") && !report.includes("Margin-Compatible Heldout Eval")) {
      errors.push(`${entry.name}: report must identify heldout eval.`);
    }
  }
}

async function validateNonfinalContrastSourceInventoryRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("nonfinal-contrast-source-inventory-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let contrasts;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      contrasts = await readJsonl(path.join(runPath, "usable_answer_contrasts.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed nonfinal contrast inventory artifacts.`);
      continue;
    }
    if (result.artifact_type !== "final_contrast_source_inventory") {
      errors.push(`${entry.name}: inventory artifact type should reuse final_contrast_source_inventory schema.`);
    }
    if (Number(result.summary?.usable_answer_contrast_pairs) !== contrasts.length) {
      errors.push(`${entry.name}: usable contrast count must match artifact rows.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: inventory must make zero calls and launch no compute.`);
    }
    if (result.decision?.run_paid_adjudication_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: nonfinal inventory must reject immediate labels/GPU.`);
    }
    if (!report.includes("Final Contrast Source Inventory") || !report.includes("Usable non-duplicate answer contrast pairs")) {
      errors.push(`${entry.name}: report must document contrast inventory counts.`);
    }
  }
}

async function validateNonfinalMarginCompatibleTrainPacketRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("nonfinal-margin-compatible-train-packet-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let pairs;
    let nliInput;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      pairs = await readJsonl(path.join(runPath, "train_pairwise.jsonl"));
      nliInput = await readJsonl(path.join(runPath, "claim-nli-input.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed nonfinal train packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "nonfinal_margin_compatible_train_packet" || result.status !== "ready_for_zero_call_selector_training") {
      errors.push(`${entry.name}: train packet must be ready for zero-call selector training.`);
    }
    if (pairs.length < 40 || Number(result.counts?.train_pair_rows) !== pairs.length || nliInput.length < 100) {
      errors.push(`${entry.name}: expected sparse-but-usable train pair and NLI inputs.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: train packet must make zero calls and launch no compute.`);
    }
    if (result.decision?.train_selector_probe_next !== true || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: train packet decision must proceed to zero-call selector probe only.`);
    }
    if (!report.includes("Non-Final Margin-Compatible Train Packet") || !report.includes("Train selector probe next: yes")) {
      errors.push(`${entry.name}: report must document train-selector next step.`);
    }
  }
}

async function validateNonfinalMarginCompatibleTrainNliRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("nonfinal-margin-compatible-train-nli-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let inputRows;
    let scoreRows;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      inputRows = await readJsonl(path.join(runPath, "claim-nli-input.jsonl"));
      scoreRows = await readJsonl(path.join(runPath, "claim-nli-scores.jsonl"));
    } catch {
      errors.push(`${entry.name}: missing or malformed nonfinal train NLI artifacts.`);
      continue;
    }
    if (result.artifact_type !== "margin_compatible_heldout_nli" || result.status !== "heldout_nli_scored") {
      errors.push(`${entry.name}: nonfinal train NLI must be scored.`);
    }
    if (inputRows.length < 100 || scoreRows.length !== inputRows.length) {
      errors.push(`${entry.name}: NLI scores must cover train input rows.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: NLI run must make zero calls and launch no rented compute.`);
    }
  }
}

async function validateBroadContrastSelectorTransferRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("broad-contrast-selector-transfer-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let trainRows;
    let finalRows;
    let selectionRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      trainRows = await readJsonl(path.join(runPath, "train_pair_predictions.jsonl"));
      finalRows = await readJsonl(path.join(runPath, "final_pair_predictions.jsonl"));
      selectionRows = await readJsonl(path.join(runPath, "final_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed broad contrast selector transfer artifacts.`);
      continue;
    }
    if (result.artifact_type !== "broad_contrast_selector_transfer" || result.status !== "broad_selector_transfer_not_sufficient") {
      errors.push(`${entry.name}: transfer run must remain not sufficient.`);
    }
    if (trainRows.length < 40 || finalRows.length < 800 || selectionRows.length < 40) {
      errors.push(`${entry.name}: transfer run must include train, final pair, and selection artifacts.`);
    }
    if (Number(result.selected_policy_metrics?.final_pairwise?.correct) <= Number(result.broad_final_baselines?.d262_pairwise?.correct)) {
      errors.push(`${entry.name}: expected selected policy to improve pairwise over D262 for this diagnostic.`);
    }
    if (Number(result.selected_policy_metrics?.final_selection?.selection_support_rate) >= 0.5 || result.decision?.promote_selector_now !== false) {
      errors.push(`${entry.name}: transfer selector must not promote because final selection collapses.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: transfer run must make zero calls and launch no compute.`);
    }
    if (result.decision?.beats_d262_pairwise_on_final_heldout !== true || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must capture pairwise-only signal and reject labels/GPU.`);
    }
    if (!report.includes("Broad Contrast Selector Transfer") || !report.includes("Promote selector now: no")) {
      errors.push(`${entry.name}: report must document no-promotion transfer decision.`);
    }
  }
}

async function validateOracleEdgeTournamentAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("oracle-edge-tournament-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let winRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      winRows = await readJsonl(path.join(runPath, "win_count_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed oracle-edge tournament audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "oracle_edge_tournament_audit" || result.status !== "oracle_edge_tournament_not_deployable") {
      errors.push(`${entry.name}: oracle-edge audit must remain non-deployable.`);
    }
    if (result.graph?.deployable_without_labels !== false || result.leakage_guard?.deployable_selector_claim_allowed !== false) {
      errors.push(`${entry.name}: oracle-edge graph must not be treated as deployable.`);
    }
    if (winRows.length !== 49 || Number(result.policy_summaries?.win_count?.selected_supported) !== 49) {
      errors.push(`${entry.name}: expected oracle-edge win-count upper bound to select 49/49 supported.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: oracle-edge audit must make zero calls and launch no compute.`);
    }
    if (result.decision?.promote_tournament_selector_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: oracle-edge audit decision must reject promotion, labels, and GPU.`);
    }
    if (!report.includes("Oracle-Edge Tournament Audit") || !report.includes("Deployable without labels: no")) {
      errors.push(`${entry.name}: oracle-edge report must document the non-deployable upper bound.`);
    }
  }
}

async function validateDeployableTournamentAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("deployable-tournament-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let winRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      winRows = await readJsonl(path.join(runPath, "win_count_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed deployable tournament audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "deployable_tournament_audit" || result.status !== "deployable_tournament_not_sufficient") {
      errors.push(`${entry.name}: deployable audit must remain not sufficient.`);
    }
    if (result.graph?.deployable_without_labels !== true || result.graph?.uses_support_labels_to_choose_edges !== false) {
      errors.push(`${entry.name}: deployable graph must be label-free for edge construction.`);
    }
    if (winRows.length !== 49 || Number(result.policy_summaries?.win_count?.selected_supported) >= 25) {
      errors.push(`${entry.name}: deployable tournament should expose the final selection collapse.`);
    }
    if (Number(result.comparison?.oracle_edge_gap_selected_supported) <= 0) {
      errors.push(`${entry.name}: deployable audit must show an oracle-edge gap.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: deployable audit must make zero calls and launch no compute.`);
    }
    if (result.decision?.promote_tournament_selector_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: deployable audit decision must reject promotion, labels, and GPU.`);
    }
    if (!report.includes("Deployable Tournament Audit") || !report.includes("Promote tournament selector now: no")) {
      errors.push(`${entry.name}: deployable report must document no-promotion decision.`);
    }
  }
}

async function validateFamilyPriorListwiseAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("family-prior-listwise-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let selections;
    let model;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      selections = await readJsonl(path.join(runPath, "family_prior_final_selections.jsonl"));
      model = JSON.parse(await fs.readFile(path.join(runPath, "family_prior_model.json"), "utf8"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed family-prior listwise audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "family_prior_listwise_audit" || result.status !== "family_prior_promising_not_promoted") {
      errors.push(`${entry.name}: family-prior audit must be promising but not promoted.`);
    }
    if (model.type !== "nonfinal_smoothed_family_prior_listwise_selector" || model.selected_without_final_label_tuning !== true) {
      errors.push(`${entry.name}: family-prior model must document non-final-only selection.`);
    }
    if (selections.length !== 49 || Number(result.final_selection?.selected_supported) !== 42) {
      errors.push(`${entry.name}: expected family-prior final selection to be 42/49.`);
    }
    if (Number(result.comparison?.delta_vs_raw_selected_supported) < 20) {
      errors.push(`${entry.name}: expected family prior to materially improve over raw broad selector.`);
    }
    if (Number(result.train_pairwise?.correct) < 40 || Number(result.train_pairwise?.pairs) !== 58) {
      errors.push(`${entry.name}: expected non-final pairwise family prior signal.`);
    }
    if (result.decision?.promote_selector_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: family-prior audit decision must reject immediate promotion, labels, and GPU.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: family-prior audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Family-Prior Listwise Audit") || !report.includes("Promote selector now: no")) {
      errors.push(`${entry.name}: family-prior report must document no-promotion decision.`);
    }
  }
}

async function validateFamilyPriorTemporalStressAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("family-prior-temporal-stress-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let looRows;
    let prefixRows;
    let recencyRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      looRows = await readJsonl(path.join(runPath, "leave_one_window_out_pairwise.jsonl"));
      prefixRows = await readJsonl(path.join(runPath, "prefix_temporal_pairwise.jsonl"));
      recencyRows = await readJsonl(path.join(runPath, "final_recency_policy_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed family-prior temporal stress audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "family_prior_temporal_stress_audit" || result.status !== "family_prior_temporal_shift_not_promoted") {
      errors.push(`${entry.name}: temporal stress audit must diagnose shift without promotion.`);
    }
    if (looRows.length !== 4 || prefixRows.length !== 3 || recencyRows.length < 6) {
      errors.push(`${entry.name}: temporal stress audit must include LOO, prefix, and recency artifacts.`);
    }
    if (Number(result.prefix_temporal?.total_correct) !== 18 || Number(result.prefix_temporal?.total_pairs) !== 44) {
      errors.push(`${entry.name}: expected prefix temporal result to be 18/44.`);
    }
    if (Number(result.prefix_temporal?.min_nonempty_accuracy) > 0.05) {
      errors.push(`${entry.name}: expected late-window temporal shift to be exposed.`);
    }
    if (result.diagnosis?.late_window_shift_detected !== true || result.diagnosis?.weak_window !== "nonfinal-contrast-source-inventory-240-320-2026-06-28-v1") {
      errors.push(`${entry.name}: temporal stress diagnosis must identify the 240-320 shift.`);
    }
    if (Number(result.final_tie_sensitivity?.raw_only?.selected_supported) !== 44 || Number(result.final_tie_sensitivity?.raw_then_id?.selected_supported) !== 42) {
      errors.push(`${entry.name}: temporal stress audit must record final tie sensitivity.`);
    }
    const lastWindow = recencyRows.find((row) => row.policy === "last_nonempty_window_only");
    const firstTwo = recencyRows.find((row) => row.policy === "first_two_windows_only");
    if (Number(lastWindow?.selected_supported) !== 42 || Number(firstTwo?.selected_supported) !== 4) {
      errors.push(`${entry.name}: recency policies must show first-two failure and late-window final transfer.`);
    }
    if (result.decision?.promote_family_prior_selector_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: temporal stress decision must reject promotion, labels, and GPU.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: temporal stress audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Family-Prior Temporal Stress Audit") || !report.includes("Promote family-prior selector now: no")) {
      errors.push(`${entry.name}: temporal stress report must document no-promotion decision.`);
    }
  }
}

async function validateSourcePrefixReliabilityAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("source-prefix-reliability-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let familyRows;
    let exactRows;
    let prefixRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      familyRows = await readJsonl(path.join(runPath, "family_final_selections.jsonl"));
      exactRows = await readJsonl(path.join(runPath, "exact_prediction_run_with_family_fallback_final_selections.jsonl"));
      prefixRows = await readJsonl(path.join(runPath, "source_prefix_with_family_fallback_final_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed source-prefix reliability audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "source_prefix_reliability_audit" || result.status !== "source_prefix_promising_not_promoted") {
      errors.push(`${entry.name}: source-prefix audit must be promising but not promoted.`);
    }
    if (familyRows.length !== 49 || exactRows.length !== 49 || prefixRows.length !== 49) {
      errors.push(`${entry.name}: source-prefix audit must include all final selections for each policy.`);
    }
    if (Number(result.policies?.family?.selected_supported) !== 42 || Number(result.policies?.exact_prediction_run_with_family_fallback?.selected_supported) !== 42) {
      errors.push(`${entry.name}: family and exact-run fallback baselines must remain 42/49.`);
    }
    if (Number(result.policies?.source_prefix_with_family_fallback?.selected_supported) !== 44) {
      errors.push(`${entry.name}: expected normalized source-prefix selection to be 44/49.`);
    }
    if (Number(result.comparison?.exact_run_unknown_top_count) !== 49 || Number(result.comparison?.source_prefix_unknown_top_count) !== 14) {
      errors.push(`${entry.name}: audit must show exact-run non-transfer and prefix partial transfer.`);
    }
    if (Number(result.comparison?.delta_vs_committed_family_prior) !== 2) {
      errors.push(`${entry.name}: expected source-prefix delta over committed family prior to be +2.`);
    }
    if (result.decision?.promote_source_prefix_selector_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: source-prefix audit decision must reject promotion, labels, and GPU.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: source-prefix audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Source-Prefix Reliability Audit") || !report.includes("Promote source-prefix selector now: no")) {
      errors.push(`${entry.name}: source-prefix report must document no-promotion decision.`);
    }
  }
}

async function validateTimeAwareSourcePrefixSelectorAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("time-aware-source-prefix-selector-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let selectedRows;
    let prefixRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      selectedRows = await readJsonl(path.join(runPath, "source_prefix_recency_4x_final_selections.jsonl"));
      prefixRows = await readJsonl(path.join(runPath, "prefix_temporal_pairwise.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed time-aware source-prefix selector audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "time_aware_source_prefix_selector_audit" || result.status !== "time_aware_source_prefix_partial_not_promoted") {
      errors.push(`${entry.name}: time-aware source-prefix audit must remain partial and not promoted.`);
    }
    if (result.preregistered_selector?.selected_policy !== "source_prefix_recency_4x" || result.preregistered_selector?.final_labels_used_for_training_or_tuning !== false) {
      errors.push(`${entry.name}: selected policy must be preregistered as recency-4x without final label tuning.`);
    }
    if (selectedRows.length !== 49 || Number(result.final_policies?.source_prefix_recency_4x?.selected_supported) !== 44) {
      errors.push(`${entry.name}: expected selected final policy to be 44/49.`);
    }
    if (prefixRows.length !== 3 || Number(result.prefix_temporal_stress?.total_correct) !== 27 || Number(result.prefix_temporal_stress?.total_pairs) !== 44) {
      errors.push(`${entry.name}: expected source-prefix temporal stress to be 27/44.`);
    }
    if (Number(result.comparison?.family_prior_prefix_240_320_correct) !== 1 || Number(result.comparison?.source_prefix_prefix_240_320_correct) !== 7) {
      errors.push(`${entry.name}: audit must show 240-320 improvement from 1/20 to 7/20.`);
    }
    if (Number(result.comparison?.selected_time_aware_source_prefix_supported) !== 44 || Number(result.comparison?.source_prefix_audit_selected_supported) !== 44) {
      errors.push(`${entry.name}: time-aware source-prefix should preserve but not exceed source-prefix selection.`);
    }
    if (result.decision?.promote_time_aware_source_prefix_selector_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: time-aware source-prefix decision must reject promotion, labels, and GPU.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: time-aware source-prefix audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Time-Aware Source-Prefix Selector Audit") || !report.includes("Promote time-aware source-prefix selector now: no")) {
      errors.push(`${entry.name}: time-aware source-prefix report must document no-promotion decision.`);
    }
  }
}

async function validateCandidateInternalFeatureOverlayAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("candidate-internal-feature-overlay-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let baselineRows;
    let overlayRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      baselineRows = await readJsonl(path.join(runPath, "source_prefix_recency_4x_final_selections.jsonl"));
      overlayRows = await readJsonl(path.join(runPath, "source_plus_nli_margin_min_0p5_final_selections.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed candidate-internal feature overlay audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "candidate_internal_feature_overlay_audit" || result.status !== "candidate_internal_overlay_not_sufficient") {
      errors.push(`${entry.name}: candidate-internal overlay audit must remain not sufficient.`);
    }
    if (baselineRows.length !== 49 || overlayRows.length !== 49) {
      errors.push(`${entry.name}: candidate-internal overlay audit must include final selections.`);
    }
    if (Number(result.train_feature_directional?.nli_entailment_min?.correct) !== 42 || Number(result.train_feature_directional?.citation_count?.correct) !== 56) {
      errors.push(`${entry.name}: expected train feature directional diagnostics.`);
    }
    if (Number(result.final_policies?.source_prefix_recency_4x?.selected_supported) !== 44 || Number(result.comparison?.best_overlay_selected_supported) !== 44) {
      errors.push(`${entry.name}: overlays must not improve beyond 44/49.`);
    }
    if (Number(result.comparison?.large_nli_overlay_selected_supported) !== 34 || result.diagnosis?.large_nli_weight_regresses !== true) {
      errors.push(`${entry.name}: audit must capture large-NLI regression to 34/49.`);
    }
    if (result.decision?.promote_candidate_internal_overlay_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: candidate-internal overlay decision must reject promotion, labels, and GPU.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: candidate-internal overlay audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Candidate-Internal Feature Overlay Audit") || !report.includes("Promote candidate-internal overlay now: no")) {
      errors.push(`${entry.name}: candidate-internal overlay report must document no-promotion decision.`);
    }
  }
}

async function validateTargetedMissContrastMiningAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("targeted-miss-contrast-mining-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let missRows;
    let targetRows;
    let highPriorityRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      missRows = await readJsonl(path.join(runPath, "final_miss_analyses.jsonl"));
      targetRows = await readJsonl(path.join(runPath, "nonfinal_target_contrasts.jsonl"));
      highPriorityRows = await readJsonl(path.join(runPath, "high_priority_nonfinal_contrasts.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed targeted miss contrast mining audit artifacts.`);
      continue;
    }
    if (result.artifact_type !== "targeted_miss_contrast_mining_audit" || result.status !== "targeted_contrasts_available_not_promoted") {
      errors.push(`${entry.name}: targeted miss mining audit must find contrasts without promotion.`);
    }
    if (missRows.length !== 5 || Number(result.final_miss_summary?.misses) !== 5) {
      errors.push(`${entry.name}: expected exactly five final miss analyses.`);
    }
    if (Number(result.final_miss_summary?.same_citation_misses) !== 4 || Number(result.final_miss_summary?.qwen_unknown_misses) !== 2) {
      errors.push(`${entry.name}: expected final miss mechanism counts.`);
    }
    if (targetRows.length !== 55 || Number(result.nonfinal_target_contrast_summary?.available_target_contrasts) !== 55) {
      errors.push(`${entry.name}: expected 55 non-final target contrasts.`);
    }
    if (highPriorityRows.length !== 7 || Number(result.nonfinal_target_contrast_summary?.same_citation_unsupported_longer_contrasts) !== 7) {
      errors.push(`${entry.name}: expected 7 high-priority same-citation overexpansion contrasts.`);
    }
    if (Number(result.nonfinal_target_contrast_summary?.same_citation_unsupported_claim_contrasts) !== 29) {
      errors.push(`${entry.name}: expected 29 same-citation unsupported-claim contrasts.`);
    }
    if (result.decision?.promote_selector_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: targeted miss mining decision must reject promotion, labels, and GPU.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: targeted miss mining audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Targeted Miss Contrast Mining Audit") || !report.includes("Promote selector now: no")) {
      errors.push(`${entry.name}: targeted miss mining report must document no-promotion decision.`);
    }
  }
}

async function validateTargetedMissAwareSelectorAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("targeted-miss-aware-selector-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let targetRows;
    let highPriorityRows;
    let predictionRows;
    let baselineRows;
    let guardRows;
    let switchRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      targetRows = await readJsonl(path.join(runPath, "targeted_train_contrast_packet.jsonl"));
      highPriorityRows = await readJsonl(path.join(runPath, "high_priority_targeted_train_contrast_packet.jsonl"));
      predictionRows = await readJsonl(path.join(runPath, "target_pairwise_predictions.jsonl"));
      baselineRows = await readJsonl(path.join(runPath, "source_prefix_recency_4x_final_selections.jsonl"));
      guardRows = await readJsonl(path.join(runPath, "conservative_same_citation_raw_rescue_0p5_final_selections.jsonl"));
      switchRows = await readJsonl(path.join(runPath, "conservative_guard_switches.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed targeted miss-aware selector artifacts.`);
      continue;
    }
    if (result.artifact_type !== "targeted_miss_aware_selector_audit" || result.status !== "targeted_packet_ready_selector_not_promoted") {
      errors.push(`${entry.name}: targeted miss-aware audit must leave selector unpromoted while keeping packet ready.`);
    }
    if (targetRows.length !== 55 || Number(result.targeted_packet?.train_contrasts) !== 55) {
      errors.push(`${entry.name}: expected 55 targeted training contrasts.`);
    }
    if (highPriorityRows.length !== 7 || Number(result.targeted_packet?.high_priority_contrasts) !== 7) {
      errors.push(`${entry.name}: expected 7 high-priority targeted contrasts.`);
    }
    if (predictionRows.length !== 172) {
      errors.push(`${entry.name}: expected target pairwise predictions for all preregistered policies.`);
    }
    if (baselineRows.length !== 49 || guardRows.length !== 49) {
      errors.push(`${entry.name}: expected 49 final selections for baseline and guard policies.`);
    }
    if (Number(result.final_policies?.source_prefix_recency_4x?.selected_supported) !== 44 || Number(result.final_policies?.conservative_same_citation_raw_rescue_0p5?.selected_supported) !== 39) {
      errors.push(`${entry.name}: expected conservative guard to underperform the 44/49 source-prefix baseline at 39/49.`);
    }
    if (switchRows.length !== 12 || Number(result.comparison?.conservative_guard_rescued_misses) !== 3 || Number(result.comparison?.conservative_guard_regressions) !== 8) {
      errors.push(`${entry.name}: expected 12 guard switches with 3 rescues and 8 regressions.`);
    }
    if (result.comparison?.target_packet_pairwise_best_policy !== "high_priority_shape_guard" || Number(result.comparison?.target_packet_pairwise_best_correct) !== 6 || Number(result.comparison?.target_packet_pairwise_best_pairs) !== 7) {
      errors.push(`${entry.name}: expected high-priority shape guard to be the best targeted pairwise diagnostic at 6/7.`);
    }
    if (result.decision?.promote_miss_aware_selector_now !== false || result.decision?.use_targeted_packet_for_post_training_now !== true || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject selector promotion, labels, and GPU while preserving packet use.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.unsupported_claim_labels_used_for_selector_scoring !== false || result.leakage_guard?.target_packet_training_use !== "allowed_nonfinal_targeted_post_training_data") {
      errors.push(`${entry.name}: leakage guard must forbid final training and unsupported-claim selector scoring.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: targeted miss-aware audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Targeted Miss-Aware Selector Audit") || !report.includes("Promote miss-aware selector now: no") || !report.includes("Use targeted packet for post-training now: yes")) {
      errors.push(`${entry.name}: report must document no-promotion and packet-use decisions.`);
    }
  }
}

async function validateTargetedPacketLearnerTransferAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("targeted-packet-learner-transfer-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let trainRows;
    let validationRows;
    let alphaRows;
    let selectionRows;
    let switchRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      trainRows = await readJsonl(path.join(runPath, "train_pair_predictions.jsonl"));
      validationRows = await readJsonl(path.join(runPath, "validation_pair_predictions.jsonl"));
      alphaRows = await readJsonl(path.join(runPath, "alpha_grid.jsonl"));
      selectionRows = await readJsonl(path.join(runPath, "selected_final_selections.jsonl"));
      switchRows = await readJsonl(path.join(runPath, "selected_final_switches.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed targeted packet learner transfer artifacts.`);
      continue;
    }
    if (result.artifact_type !== "targeted_packet_learner_transfer_audit" || result.status !== "targeted_learner_unstable_final_neutral_not_promoted") {
      errors.push(`${entry.name}: targeted learner transfer audit must be unstable/final-neutral and not promoted.`);
    }
    if (!Array.isArray(result.training?.feature_names) || result.training.feature_names.length !== 7 || !result.model?.weights || !Array.isArray(result.model?.scaler)) {
      errors.push(`${entry.name}: targeted learner must record feature names, weights, and scaler.`);
    }
    if (trainRows.length !== 38 || Number(result.training?.train_pairs) !== 38 || Number(result.temporal_transfer?.train?.correct) !== 14) {
      errors.push(`${entry.name}: expected 38 early target train pairs with 14 correct.`);
    }
    if (validationRows.length !== 17 || Number(result.training?.validation_pairs) !== 17 || Number(result.temporal_transfer?.validation?.correct) !== 16) {
      errors.push(`${entry.name}: expected 17 late target validation pairs with 16 correct.`);
    }
    if (alphaRows.length !== 6 || Number(result.training?.selected_overlay_alpha) !== 0) {
      errors.push(`${entry.name}: expected six alpha grid rows and disabled alpha 0.`);
    }
    if (selectionRows.length !== 49 || Number(result.final_policies?.targeted_learner_overlay?.selected_supported) !== 44) {
      errors.push(`${entry.name}: expected 49 final selections preserving 44/49 support.`);
    }
    if (switchRows.length !== 0 || Number(result.comparison?.selected_overlay_switches) !== 0 || Number(result.comparison?.selected_overlay_regressions) !== 0) {
      errors.push(`${entry.name}: disabled overlay should produce no final switches or regressions.`);
    }
    if (result.comparison?.train_accuracy_threshold_met !== false || result.comparison?.validation_accuracy_threshold_met !== true) {
      errors.push(`${entry.name}: expected failed train threshold and passed validation threshold.`);
    }
    if (result.decision?.promote_targeted_learner_overlay_now !== false || result.decision?.keep_targeted_packet_for_training !== true || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject overlay promotion, labels, and GPU while keeping packet.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_alpha_selection !== false || result.leakage_guard?.target_packet_training_use !== "allowed_nonfinal_targeted_post_training_data") {
      errors.push(`${entry.name}: leakage guard must forbid final training/alpha selection and preserve targeted packet use.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: targeted learner transfer audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Targeted Packet Learner Transfer Audit") || !report.includes("Promote targeted learner overlay now: no") || !report.includes("Train threshold met: no")) {
      errors.push(`${entry.name}: report must document no-promotion and failed train threshold.`);
    }
  }
}

async function validateBalancedPacketLearnerAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("balanced-packet-learner-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let trainRows;
    let validationRows;
    let alphaRows;
    let selectionRows;
    let switchRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      trainRows = await readJsonl(path.join(runPath, "train_pair_predictions.jsonl"));
      validationRows = await readJsonl(path.join(runPath, "validation_pair_predictions.jsonl"));
      alphaRows = await readJsonl(path.join(runPath, "alpha_grid.jsonl"));
      selectionRows = await readJsonl(path.join(runPath, "selected_final_selections.jsonl"));
      switchRows = await readJsonl(path.join(runPath, "selected_final_switches.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed balanced packet learner artifacts.`);
      continue;
    }
    if (result.artifact_type !== "balanced_packet_learner_audit" || result.status !== "balanced_packet_too_sparse_final_neutral_not_promoted") {
      errors.push(`${entry.name}: balanced learner audit must be sparse/final-neutral and not promoted.`);
    }
    if (Number(result.packet_composition?.broad_pairs) !== 58 || Number(result.packet_composition?.targeted_pairs) !== 55 || Number(result.packet_composition?.preservation_only_pairs) !== 3) {
      errors.push(`${entry.name}: expected 58 broad pairs, 55 targeted pairs, and 3 preservation-only rows.`);
    }
    if (trainRows.length !== 38 || validationRows.length !== 20 || alphaRows.length !== 6) {
      errors.push(`${entry.name}: expected 38 train predictions, 20 validation predictions, and 6 alpha rows.`);
    }
    if (Number(result.temporal_transfer?.balanced_train?.correct) !== 14 || Number(result.temporal_transfer?.balanced_validation?.correct) !== 17) {
      errors.push(`${entry.name}: expected balanced train 14/38 and validation 17/20.`);
    }
    if (Number(result.comparison?.train_correct_lift_vs_targeted_only) !== 0 || Number(result.comparison?.validation_correct_lift_vs_targeted_only) !== 1) {
      errors.push(`${entry.name}: expected no train lift and +1 validation lift over targeted-only learner.`);
    }
    if (Number(result.training?.selected_overlay_alpha) !== 0 || result.comparison?.train_accuracy_threshold_met !== false || result.comparison?.validation_accuracy_threshold_met !== true) {
      errors.push(`${entry.name}: expected disabled alpha with failed train threshold and passed validation threshold.`);
    }
    if (selectionRows.length !== 49 || switchRows.length !== 0 || Number(result.final_policies?.balanced_learner_overlay?.selected_supported) !== 44) {
      errors.push(`${entry.name}: balanced final overlay must preserve 44/49 with no switches.`);
    }
    if (result.decision?.promote_balanced_learner_overlay_now !== false || result.decision?.keep_balanced_packet_for_training !== true || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject overlay promotion, labels, and GPU while keeping packet principle.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_alpha_selection !== false || result.leakage_guard?.broad_packet_training_use !== "allowed_nonfinal_broad_contrast_training") {
      errors.push(`${entry.name}: leakage guard must forbid final training/alpha selection and preserve broad packet use.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: balanced learner audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Balanced Packet Learner Audit") || !report.includes("Promote balanced learner overlay now: no") || !report.includes("Preservation-only rows: 3")) {
      errors.push(`${entry.name}: report must document no-promotion and sparse preservation rows.`);
    }
  }
}

async function validatePreservationPairMiningAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("preservation-pair-mining-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let preservationRows;
    let duplicateRows;
    let sourceRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      preservationRows = await readJsonl(path.join(runPath, "preservation_pairs.jsonl"));
      duplicateRows = await readJsonl(path.join(runPath, "exact_duplicate_preservation_pairs.jsonl"));
      sourceRows = await readJsonl(path.join(runPath, "source_summaries.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed preservation pair mining artifacts.`);
      continue;
    }
    if (result.artifact_type !== "preservation_pair_mining_audit" || result.status !== "preservation_pairs_available_for_balanced_packet") {
      errors.push(`${entry.name}: preservation mining audit must expose pairs for balanced packet construction.`);
    }
    if (preservationRows.length !== 391 || Number(result.summary?.preservation_pairs) !== 391) {
      errors.push(`${entry.name}: expected 391 non-duplicate preservation pairs.`);
    }
    if (duplicateRows.length !== 477 || Number(result.summary?.exact_duplicate_preservation_pairs) !== 477) {
      errors.push(`${entry.name}: expected 477 exact duplicate preservation pairs tracked separately.`);
    }
    if (sourceRows.length !== 4 || Number(result.summary?.source_windows) !== 4) {
      errors.push(`${entry.name}: expected four non-final source window summaries.`);
    }
    if (Number(result.summary?.supported_answer_pairs) !== 215 || Number(result.summary?.supported_abstention_pairs) !== 84 || Number(result.summary?.unsupported_answer_pairs) !== 92) {
      errors.push(`${entry.name}: expected preservation pair label counts.`);
    }
    if (Number(result.summary?.train_window_pairs) !== 305 || Number(result.summary?.validation_window_pairs) !== 86) {
      errors.push(`${entry.name}: expected 305 train-window and 86 validation-window preservation pairs.`);
    }
    if (Number(result.summary?.examples_with_preservation_pairs) !== 187) {
      errors.push(`${entry.name}: expected 187 examples with preservation pairs.`);
    }
    for (const [index, row] of preservationRows.entries()) {
      const label = `${entry.name}.preservation_pairs:${index + 1}`;
      if (row.training_use !== "allowed_nonfinal_same_label_preservation_data" || row.objective !== "equivalence_preservation_not_preference" || row.exact_duplicate_surface !== false) {
        errors.push(`${label}: preservation row must be non-duplicate same-label equivalence data.`);
        break;
      }
    }
    if (result.decision?.build_balanced_packet_next !== true || result.decision?.promote_selector_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must build balanced packet next while rejecting promotion, labels, and GPU.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.preservation_pairs_training_use !== "allowed_nonfinal_same_label_preservation_data") {
      errors.push(`${entry.name}: leakage guard must forbid final labels and preserve same-label training use.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0) {
      errors.push(`${entry.name}: preservation mining audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Preservation Pair Mining Audit") || !report.includes("Build balanced packet next: yes") || !report.includes("Preservation pairs: 391")) {
      errors.push(`${entry.name}: report must document preservation pair counts and next packet decision.`);
    }
  }
}

async function validatePreservationBalancedLearnerAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("preservation-balanced-learner-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let weightRows;
    let trainContrastRows;
    let validationContrastRows;
    let trainPreservationRows;
    let validationPreservationRows;
    let alphaRows;
    let selectionRows;
    let switchRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      weightRows = await readJsonl(path.join(runPath, "weight_grid.jsonl"));
      trainContrastRows = await readJsonl(path.join(runPath, "train_contrast_predictions.jsonl"));
      validationContrastRows = await readJsonl(path.join(runPath, "validation_contrast_predictions.jsonl"));
      trainPreservationRows = await readJsonl(path.join(runPath, "train_preservation_predictions.jsonl"));
      validationPreservationRows = await readJsonl(path.join(runPath, "validation_preservation_predictions.jsonl"));
      alphaRows = await readJsonl(path.join(runPath, "alpha_grid.jsonl"));
      selectionRows = await readJsonl(path.join(runPath, "selected_final_selections.jsonl"));
      switchRows = await readJsonl(path.join(runPath, "selected_final_switches.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed preservation-balanced learner artifacts.`);
      continue;
    }
    if (result.artifact_type !== "preservation_balanced_learner_audit" || !String(result.status ?? "").startsWith("preservation_balanced_overlay_")) {
      errors.push(`${entry.name}: preservation-balanced learner audit must expose a preservation-balanced overlay status.`);
    }
    if (Number(result.packet_composition?.targeted_pairs) !== 55 || Number(result.packet_composition?.preservation_pairs) !== 391) {
      errors.push(`${entry.name}: expected 55 targeted pairs and 391 preservation pairs.`);
    }
    if (Number(result.packet_composition?.train_contrast_pairs) !== 38 || Number(result.packet_composition?.validation_contrast_pairs) !== 17) {
      errors.push(`${entry.name}: expected 38 train and 17 validation contrast pairs.`);
    }
    if (Number(result.packet_composition?.train_preservation_pairs) !== 305 || Number(result.packet_composition?.validation_preservation_pairs) !== 86) {
      errors.push(`${entry.name}: expected 305 train and 86 validation preservation pairs.`);
    }
    if (weightRows.length !== 6 || alphaRows.length !== 6) {
      errors.push(`${entry.name}: expected six preservation-weight rows and six alpha rows.`);
    }
    if (trainContrastRows.length !== 38 || validationContrastRows.length !== 17 || trainPreservationRows.length !== 305 || validationPreservationRows.length !== 86) {
      errors.push(`${entry.name}: prediction artifact row counts must match packet composition.`);
    }
    const selectedWeight = Number(result.training?.selected_preservation_weight);
    const selectedGrid = weightRows.find((row) => Number(row.preservation_weight) === selectedWeight);
    if (!selectedGrid) {
      errors.push(`${entry.name}: selected preservation weight must appear in weight grid.`);
    } else {
      const resultValidationAccuracy = Number(result.temporal_transfer?.selected_validation_contrast?.accuracy);
      const gridValidationAccuracy = Number(selectedGrid.validation_contrast?.accuracy);
      if (Math.abs(resultValidationAccuracy - gridValidationAccuracy) > 1e-12) {
        errors.push(`${entry.name}: selected validation contrast accuracy must match weight grid.`);
      }
      const resultPreservationMargin = Number(result.temporal_transfer?.selected_validation_preservation?.mean_abs_margin);
      const gridPreservationMargin = Number(selectedGrid.validation_preservation?.mean_abs_margin);
      if (Math.abs(resultPreservationMargin - gridPreservationMargin) > 1e-12) {
        errors.push(`${entry.name}: selected validation preservation margin must match weight grid.`);
      }
    }
    const noPreservation = weightRows.find((row) => Number(row.preservation_weight) === 0);
    if (!noPreservation || Number(noPreservation.validation_preservation?.mean_abs_margin) <= Number(result.temporal_transfer?.selected_validation_preservation?.mean_abs_margin)) {
      errors.push(`${entry.name}: selected preservation model must reduce validation same-label drift versus no-preservation baseline.`);
    }
    if (selectionRows.length !== 49 || Number(result.final_policies?.source_prefix_recency_4x?.selected_supported) !== 44 || Number(result.final_policies?.preservation_balanced_overlay?.selected_supported) !== 44) {
      errors.push(`${entry.name}: final reporting must compare against the 44/49 source-prefix baseline and preserve 44/49.`);
    }
    if (switchRows.length !== Number(result.comparison?.selected_overlay_switches)) {
      errors.push(`${entry.name}: switch artifact count must match result comparison.`);
    }
    if (result.decision?.promote_preservation_balanced_overlay_now !== false || result.decision?.keep_preservation_pairs_for_training !== true || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject promotion, labels, and GPU while keeping preservation pairs.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_model_selection !== false || result.leakage_guard?.final_window_labels_used_for_alpha_selection !== false) {
      errors.push(`${entry.name}: leakage guard must forbid final labels for training, model selection, and alpha selection.`);
    }
    if (result.leakage_guard?.preservation_pairs_training_use !== "allowed_nonfinal_same_label_preservation_data" || result.leakage_guard?.target_packet_training_use !== "allowed_nonfinal_targeted_post_training_data") {
      errors.push(`${entry.name}: leakage guard must preserve targeted and same-label packet uses.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0 || Number(result.llm_budget?.prime_intellect_cost_usd) !== 0) {
      errors.push(`${entry.name}: preservation-balanced learner audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Preservation-Balanced Learner Audit") || !report.includes("Promote preservation-balanced overlay now: no") || !report.includes("Preservation pairs: 391")) {
      errors.push(`${entry.name}: report must document no-promotion and preservation pair count.`);
    }
  }
}

async function validateFinalMissRepairabilityAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("final-miss-repairability-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let missRows;
    let allRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      missRows = await readJsonl(path.join(runPath, "miss_rows.jsonl"));
      allRows = await readJsonl(path.join(runPath, "all_selection_rows.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed final miss repairability artifacts.`);
      continue;
    }
    if (result.artifact_type !== "final_miss_repairability_audit" || result.status !== "remaining_misses_are_selector_ranking_gap") {
      errors.push(`${entry.name}: final miss audit must classify remaining misses as selector/ranking gaps.`);
    }
    if (allRows.length !== 49 || missRows.length !== 5) {
      errors.push(`${entry.name}: expected 49 final selection rows and 5 miss rows.`);
    }
    if (Number(result.summary?.final_examples) !== 49 || Number(result.summary?.baseline_supported) !== 44 || Number(result.summary?.baseline_unsupported) !== 5) {
      errors.push(`${entry.name}: expected 44/49 baseline support with 5 misses.`);
    }
    if (Number(result.summary?.oracle_candidate_pool_supported) !== 49 || Number(result.summary?.oracle_candidate_pool_unsupported) !== 0) {
      errors.push(`${entry.name}: expected all 49 final examples to have a supported candidate in the pool.`);
    }
    if (Number(result.summary?.misses_with_supported_candidate) !== 5 || Number(result.summary?.misses_without_supported_candidate) !== 0) {
      errors.push(`${entry.name}: all five misses must have supported candidates already present.`);
    }
    if (Number(result.summary?.misses_with_qwen_supported_candidate) !== 5 || Number(result.summary?.misses_with_openai_supported_candidate) !== 1) {
      errors.push(`${entry.name}: expected five misses with Qwen supported candidates and one with OpenAI supported candidate.`);
    }
    if (missRows.some((row) => row.miss_type !== "selector_ranking_gap" || row.supported_candidate_available !== true)) {
      errors.push(`${entry.name}: every miss row must be a selector ranking gap with a supported candidate.`);
    }
    if (result.decision?.promote_oracle_selector_now !== false || result.decision?.treat_remaining_misses_as_selector_gap !== true || result.decision?.treat_remaining_misses_as_candidate_pool_gap !== false) {
      errors.push(`${entry.name}: decision must reject oracle promotion and classify the next bottleneck as selector gap.`);
    }
    if (result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject labels and GPU for this diagnostic.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_model_selection !== false || result.leakage_guard?.final_miss_rows_training_use !== "forbidden_final_window_diagnostic_only") {
      errors.push(`${entry.name}: leakage guard must keep final miss rows diagnostic-only.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0 || Number(result.llm_budget?.prime_intellect_cost_usd) !== 0) {
      errors.push(`${entry.name}: final miss audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Final Miss Repairability Audit") || !report.includes("Misses with supported candidate already present: 5") || !report.includes("Launch GPU now: no")) {
      errors.push(`${entry.name}: report must document supported-candidate miss coverage and no GPU launch.`);
    }
  }
}

async function validateLowPriorRescuePacketAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("low-prior-rescue-packet-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let rescueRows;
    let temporalRows;
    let finalAnalogRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      rescueRows = await readJsonl(path.join(runPath, "low_prior_rescue_rows.jsonl"));
      temporalRows = await readJsonl(path.join(runPath, "temporal_transfer_rows.jsonl"));
      finalAnalogRows = await readJsonl(path.join(runPath, "final_analog_rows.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed low-prior rescue packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "low_prior_rescue_packet_audit" || result.status !== "low_prior_rescue_packet_available_sparse") {
      errors.push(`${entry.name}: low-prior rescue audit must expose sparse available packet status.`);
    }
    if (rescueRows.length !== 23 || Number(result.packet_summary?.rescue_rows) !== 23) {
      errors.push(`${entry.name}: expected 23 low-prior rescue rows.`);
    }
    if (temporalRows.length !== 3 || Number(result.temporal_transfer?.evaluated_pairs) !== 44 || Number(result.temporal_transfer?.source_prior_correct) !== 21) {
      errors.push(`${entry.name}: expected three temporal rows, 44 evaluated pairs, and 21 source-prior-correct pairs.`);
    }
    if (Number(result.temporal_transfer?.low_prior_rescue_rows) !== 23 || Number(result.temporal_transfer?.low_prior_rescue_by_window?.["nonfinal-contrast-source-inventory-240-320-2026-06-28-v1"]) !== 19) {
      errors.push(`${entry.name}: expected 23 total rescues with 19 in the 240-320 window.`);
    }
    if (Number(result.packet_summary?.qwen_rejected_rows) !== 19 || Number(result.packet_summary?.unsupported_claim_rows) !== 20) {
      errors.push(`${entry.name}: expected 19 Qwen-rejected rows and 20 unsupported-claim rows.`);
    }
    if (finalAnalogRows.length !== 5 || Number(result.final_analogy?.final_misses) !== 5 || Number(result.final_analogy?.final_misses_with_supported_candidate) !== 5) {
      errors.push(`${entry.name}: expected five final diagnostic analog rows with supported candidates.`);
    }
    if (Number(result.final_analogy?.final_misses_with_qwen_supported_candidate) !== 5) {
      errors.push(`${entry.name}: expected all final analog misses to have Qwen supported candidates.`);
    }
    if (rescueRows.some((row) => row.training_use !== "allowed_nonfinal_low_prior_rescue_training" || row.baseline_source_prior_would_choose_rejected !== true)) {
      errors.push(`${entry.name}: every rescue row must be non-final low-prior training data where source prior chooses rejected.`);
    }
    if (result.decision?.build_low_prior_rescue_selector_next !== true || result.decision?.promote_selector_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must build next selector while rejecting promotion, labels, and GPU.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.low_prior_rescue_rows_training_use !== "allowed_nonfinal_low_prior_rescue_training" || result.leakage_guard?.final_analogy_rows_training_use !== "forbidden_final_window_diagnostic_only") {
      errors.push(`${entry.name}: leakage guard must separate non-final training rows from final diagnostic analog rows.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0 || Number(result.llm_budget?.prime_intellect_cost_usd) !== 0) {
      errors.push(`${entry.name}: low-prior rescue audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Low-Prior Rescue Packet Audit") || !report.includes("Low-prior rescue rows: 23") || !report.includes("Launch GPU now: no")) {
      errors.push(`${entry.name}: report must document packet size and no GPU launch.`);
    }
  }
}

async function validateLowPriorRescueSelectorAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("low-prior-rescue-selector-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let nonfinalGrid;
    let selectedNonfinalRows;
    let finalGrid;
    let selectedFinalRows;
    let switchRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      nonfinalGrid = await readJsonl(path.join(runPath, "nonfinal_boost_grid.jsonl"));
      selectedNonfinalRows = await readJsonl(path.join(runPath, "selected_nonfinal_pair_predictions.jsonl"));
      finalGrid = await readJsonl(path.join(runPath, "final_boost_grid.jsonl"));
      selectedFinalRows = await readJsonl(path.join(runPath, "selected_final_selections.jsonl"));
      switchRows = await readJsonl(path.join(runPath, "selected_final_switches.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed low-prior rescue selector artifacts.`);
      continue;
    }
    if (result.artifact_type !== "low_prior_rescue_selector_audit" || result.status !== "qwen_boost_anti_transfer_not_promoted") {
      errors.push(`${entry.name}: selector audit must classify Qwen boost as anti-transfer and not promoted.`);
    }
    if (nonfinalGrid.length !== 9 || finalGrid.length !== 9) {
      errors.push(`${entry.name}: expected nine non-final and final boost grid rows.`);
    }
    if (selectedNonfinalRows.length !== 44 || selectedFinalRows.length !== 49) {
      errors.push(`${entry.name}: expected 44 non-final pair predictions and 49 final selections.`);
    }
    if (Number(result.nonfinal_selection?.selected_qwen_boost) !== 0 || Number(result.comparison?.selected_boost) !== 0) {
      errors.push(`${entry.name}: selected Qwen boost must be zero.`);
    }
    if (Number(result.low_prior_packet_summary?.rescue_rows) !== 23 || Number(result.low_prior_packet_summary?.latest_window_rescue_rows) !== 19 || Number(result.low_prior_packet_summary?.qwen_rejected_rows) !== 19) {
      errors.push(`${entry.name}: expected D300 low-prior packet counts.`);
    }
    const baseline = finalGrid.find((row) => Number(row.qwen_boost) === 0);
    const largeBoost = finalGrid.find((row) => Number(row.qwen_boost) === 0.5);
    if (Number(baseline?.selected_supported) !== 44 || Number(result.final_policies?.source_prefix_recency_4x?.selected_supported) !== 44 || Number(result.final_policies?.selected_qwen_boost?.selected_supported) !== 44) {
      errors.push(`${entry.name}: selected policy must preserve the 44/49 source-prefix baseline.`);
    }
    if (Number(largeBoost?.selected_supported) !== 4 || Number(largeBoost?.regressions) !== 41 || Number(largeBoost?.rescued_misses) !== 1) {
      errors.push(`${entry.name}: large Qwen boost diagnostic must show 4/49 support, 1 rescue, and 41 regressions.`);
    }
    if (switchRows.length !== 0 || Number(result.comparison?.selected_final_switches) !== 0 || Number(result.comparison?.selected_final_regressions) !== 0) {
      errors.push(`${entry.name}: selected zero-boost policy must have no final switches or regressions.`);
    }
    if (Number(result.comparison?.nonfinal_latest_baseline_accuracy) !== 0.05 || Number(result.comparison?.nonfinal_latest_selected_accuracy) !== 0.05) {
      errors.push(`${entry.name}: expected latest non-final baseline and selected accuracy of 0.05.`);
    }
    if (result.decision?.promote_low_prior_rescue_selector_now !== false || result.decision?.keep_low_prior_packet_for_diagnostics !== true || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject promotion, labels, and GPU while keeping packet diagnostics.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_boost_selection !== false || result.leakage_guard?.final_policy_training_use !== "forbidden_final_window_reporting_only") {
      errors.push(`${entry.name}: leakage guard must keep final labels out of boost selection.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0 || Number(result.llm_budget?.prime_intellect_cost_usd) !== 0) {
      errors.push(`${entry.name}: low-prior selector audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Low-Prior Rescue Selector Audit") || !report.includes("Selected Qwen boost: 0") || !report.includes("Launch GPU now: no")) {
      errors.push(`${entry.name}: report must document zero boost and no GPU launch.`);
    }
  }
}

async function validateLowPriorCandidateSignalAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("low-prior-candidate-signal-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let nonfinalRows;
    let finalRows;
    let featureRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      nonfinalRows = await readJsonl(path.join(runPath, "nonfinal_feature_rows.jsonl"));
      finalRows = await readJsonl(path.join(runPath, "final_analog_feature_rows.jsonl"));
      featureRows = await readJsonl(path.join(runPath, "feature_diagnostics.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed low-prior candidate signal artifacts.`);
      continue;
    }
    if (result.artifact_type !== "low_prior_candidate_signal_audit" || result.status !== "candidate_internal_signal_available_for_guarded_selector") {
      errors.push(`${entry.name}: candidate signal audit must expose available guarded-selector signal status.`);
    }
    if (nonfinalRows.length !== 23 || finalRows.length !== 5 || featureRows.length !== 5) {
      errors.push(`${entry.name}: expected 23 non-final rows, 5 final analog rows, and 5 feature diagnostics.`);
    }
    if (Number(result.packet_context?.low_prior_rescue_rows) !== 23 || Number(result.packet_context?.qwen_rejected_rows) !== 19 || Number(result.packet_context?.final_misses) !== 5) {
      errors.push(`${entry.name}: expected D300/D299 packet context counts.`);
    }
    const selected = result.selected_signal ?? {};
    if (selected.feature !== "nli_entailment_min" || selected.direction !== "higher") {
      errors.push(`${entry.name}: selected signal must be higher nli_entailment_min.`);
    }
    if (Number(selected.nonfinal_pairs) !== 23 || Number(selected.nonfinal_correct) !== 19 || Number(selected.final_pairs) !== 5 || Number(selected.final_correct) !== 5 || selected.final_rows_used_for_selection !== false) {
      errors.push(`${entry.name}: selected signal must score 19/23 non-final and 5/5 final diagnostic without using final rows for selection.`);
    }
    const entailmentRow = featureRows.find((row) => row.feature === "nli_entailment_min");
    if (!entailmentRow || Number(entailmentRow.nonfinal_correct) !== 19 || Number(entailmentRow.final_correct) !== 5) {
      errors.push(`${entry.name}: feature diagnostics must include the selected entailment-min counts.`);
    }
    if (result.decision?.build_candidate_internal_low_prior_selector_next !== true || result.decision?.promote_selector_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must build next selector while rejecting promotion, labels, and GPU.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_feature_selection !== false || result.leakage_guard?.final_analog_rows_training_use !== "forbidden_final_window_diagnostic_only") {
      errors.push(`${entry.name}: leakage guard must keep final analog rows diagnostic-only.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0 || Number(result.llm_budget?.prime_intellect_cost_usd) !== 0) {
      errors.push(`${entry.name}: low-prior candidate signal audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Low-Prior Candidate Signal Audit") || !report.includes("Feature: nli_entailment_min") || !report.includes("Launch GPU now: no")) {
      errors.push(`${entry.name}: report must document selected signal and no GPU launch.`);
    }
  }
}

async function validateLowPriorEntailmentSelectorAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("low-prior-entailment-selector-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let nonfinalGrid;
    let selectedNonfinalRows;
    let finalGrid;
    let selectedFinalRows;
    let switchRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      nonfinalGrid = await readJsonl(path.join(runPath, "nonfinal_threshold_grid.jsonl"));
      selectedNonfinalRows = await readJsonl(path.join(runPath, "selected_nonfinal_pair_predictions.jsonl"));
      finalGrid = await readJsonl(path.join(runPath, "final_threshold_grid.jsonl"));
      selectedFinalRows = await readJsonl(path.join(runPath, "selected_final_selections.jsonl"));
      switchRows = await readJsonl(path.join(runPath, "selected_final_switches.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed low-prior entailment selector artifacts.`);
      continue;
    }
    if (result.artifact_type !== "low_prior_entailment_selector_audit" || result.status !== "entailment_selector_not_promoted") {
      errors.push(`${entry.name}: entailment selector audit must reject promotion.`);
    }
    if (nonfinalGrid.length !== 43 || finalGrid.length !== 43) {
      errors.push(`${entry.name}: expected 42 threshold rows plus one no-override baseline row.`);
    }
    if (selectedNonfinalRows.length !== 44 || selectedFinalRows.length !== 49) {
      errors.push(`${entry.name}: expected 44 non-final pair predictions and 49 final selections.`);
    }
    if (Number(result.selected_signal?.nonfinal_correct) !== 19 || Number(result.selected_signal?.nonfinal_pairs) !== 23 || result.selected_signal?.feature !== "nli_entailment_min") {
      errors.push(`${entry.name}: selected signal context must carry D302 entailment-min counts.`);
    }
    if (Number(result.low_prior_packet_summary?.rescue_rows) !== 23 || Number(result.low_prior_packet_summary?.latest_window_rescue_rows) !== 19 || Number(result.low_prior_packet_summary?.qwen_rejected_rows) !== 19) {
      errors.push(`${entry.name}: expected D300 low-prior packet counts.`);
    }
    if (Number(result.nonfinal_selection?.selected_entailment_delta_threshold) !== 999 || Number(result.nonfinal_selection?.selected_entailment_floor) !== 999) {
      errors.push(`${entry.name}: selected entailment policy must be the no-override baseline.`);
    }
    const baseline = finalGrid.find((row) => Number(row.entailment_delta_threshold) === 999 && Number(row.entailment_floor) === 999);
    const bestOverride = result.final_policies?.diagnostic_best_nonbaseline_final_thresholds;
    if (Number(baseline?.selected_supported) !== 44 || Number(result.final_policies?.source_prefix_recency_4x?.selected_supported) !== 44 || Number(result.final_policies?.selected_entailment_override?.selected_supported) !== 44) {
      errors.push(`${entry.name}: selected no-override policy must preserve the 44/49 source-prefix baseline.`);
    }
    if (Number(bestOverride?.selected_supported) !== 31 || Number(bestOverride?.rescued_misses) !== 1 || Number(bestOverride?.regressions) !== 14) {
      errors.push(`${entry.name}: best non-baseline final diagnostic must show 31/49 support, 1 rescue, and 14 regressions.`);
    }
    if (switchRows.length !== 0 || Number(result.comparison?.selected_final_switches) !== 0 || Number(result.comparison?.selected_final_regressions) !== 0) {
      errors.push(`${entry.name}: selected no-override policy must have no final switches or regressions.`);
    }
    if (Number(result.comparison?.nonfinal_latest_baseline_accuracy) !== 0.05 || Number(result.comparison?.nonfinal_latest_selected_accuracy) !== 0.05 || Number(result.comparison?.nonfinal_latest_selected_low_prior_correct) !== 0) {
      errors.push(`${entry.name}: selected no-override policy must preserve latest non-final baseline metrics.`);
    }
    const nonBaselineRows = nonfinalGrid.filter((row) => Number(row.entailment_delta_threshold) < 999);
    if (!nonBaselineRows.length || nonBaselineRows.some((row) => Number(row.regressions) === 0)) {
      errors.push(`${entry.name}: every non-baseline threshold should create non-final regressions under the guarded audit.`);
    }
    if (result.decision?.promote_entailment_selector_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject selector promotion, labels, and GPU.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_threshold_selection !== false || result.leakage_guard?.final_policy_training_use !== "forbidden_final_window_reporting_only") {
      errors.push(`${entry.name}: leakage guard must keep final labels out of threshold selection.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0 || Number(result.llm_budget?.prime_intellect_cost_usd) !== 0) {
      errors.push(`${entry.name}: low-prior entailment selector audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Low-Prior Entailment Selector Audit") || !report.includes("Selected entailment delta: 999") || !report.includes("Launch GPU now: no")) {
      errors.push(`${entry.name}: report must document no-override threshold and no GPU launch.`);
    }
  }
}

async function validateEntailmentCoverageGuardPostmortemAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("entailment-coverage-guard-postmortem-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let nonfinalGrid;
    let finalGrid;
    let selectedSwitches;
    let bestDeployableSwitches;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      nonfinalGrid = await readJsonl(path.join(runPath, "nonfinal_guard_grid.jsonl"));
      finalGrid = await readJsonl(path.join(runPath, "final_guard_grid.jsonl"));
      selectedSwitches = await readJsonl(path.join(runPath, "selected_final_switches.jsonl"));
      bestDeployableSwitches = await readJsonl(path.join(runPath, "best_deployable_final_switches.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed entailment coverage guard postmortem artifacts.`);
      continue;
    }
    if (result.artifact_type !== "entailment_coverage_guard_postmortem_audit" || result.status !== "coverage_guards_do_not_make_entailment_selector_promotable") {
      errors.push(`${entry.name}: coverage guard postmortem must reject selector promotion.`);
    }
    if (nonfinalGrid.length !== 295 || finalGrid.length !== 295) {
      errors.push(`${entry.name}: expected 294 guarded threshold rows plus one no-override baseline for non-final and final grids.`);
    }
    if (Number(result.nonfinal_selection?.guard_count) !== 7 || Number(result.nonfinal_selection?.threshold_rows) !== 295 || Number(result.nonfinal_selection?.eligible_zero_regression_rescue_policies) !== 0) {
      errors.push(`${entry.name}: expected seven guards and zero eligible non-final zero-regression rescue policies.`);
    }
    if (result.nonfinal_selection?.selected_guard_id !== "no_override" || Number(result.nonfinal_selection?.selected_entailment_delta_threshold) !== 999 || Number(result.nonfinal_selection?.selected_entailment_floor) !== 999) {
      errors.push(`${entry.name}: selected coverage policy must be no-override.`);
    }
    if (Number(result.d303_context?.best_nonbaseline_final_supported) !== 31 || Number(result.d303_context?.best_nonbaseline_final_regressions) !== 14) {
      errors.push(`${entry.name}: D303 context must preserve best nonbaseline final diagnostic counts.`);
    }
    if (Number(result.low_prior_packet_summary?.rescue_rows) !== 23 || Number(result.low_prior_packet_summary?.latest_window_rescue_rows) !== 19 || Number(result.low_prior_packet_summary?.qwen_rejected_rows) !== 19) {
      errors.push(`${entry.name}: expected D300 low-prior packet counts.`);
    }
    const baseline = result.final_policies?.source_prefix_recency_4x;
    const selected = result.final_policies?.selected_coverage_guard;
    const bestDeployable = result.final_policies?.diagnostic_best_deployable_coverage_guard;
    const bestUnguarded = result.final_policies?.diagnostic_best_unguarded_entailment_threshold;
    if (Number(baseline?.selected_supported) !== 44 || Number(selected?.selected_supported) !== 44 || selected?.guard_id !== "no_override") {
      errors.push(`${entry.name}: selected coverage guard must preserve the 44/49 source-prefix baseline.`);
    }
    if (bestDeployable?.guard_id !== "claim_and_citation_non_decreasing" || Number(bestDeployable?.selected_supported) !== 43 || Number(bestDeployable?.rescued_misses) !== 2 || Number(bestDeployable?.regressions) !== 3) {
      errors.push(`${entry.name}: best deployable coverage guard diagnostic must be claim/citation non-decreasing at 43/49 with 2 rescues and 3 regressions.`);
    }
    if (bestUnguarded?.guard_id !== "none" || Number(bestUnguarded?.selected_supported) !== 31 || Number(bestUnguarded?.rescued_misses) !== 1 || Number(bestUnguarded?.regressions) !== 14) {
      errors.push(`${entry.name}: best unguarded diagnostic must preserve D303 31/49, 1 rescue, 14 regressions.`);
    }
    if (selectedSwitches.length !== 0 || bestDeployableSwitches.length !== 6) {
      errors.push(`${entry.name}: expected no selected switches and six best-deployable diagnostic switches.`);
    }
    const postmortem = result.switch_postmortem?.by_direction ?? {};
    if (Number(postmortem.regressed_supported?.switches) !== 14 || Number(postmortem.rescued_miss?.switches) !== 1 || Number(postmortem.neutral_or_still_wrong?.switches) !== 4) {
      errors.push(`${entry.name}: switch postmortem must decompose unguarded final switches into 14 regressions, 1 rescue, and 4 neutral switches.`);
    }
    if (result.decision?.promote_coverage_guard_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject guard promotion, labels, and GPU.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_guard_selection !== false || result.leakage_guard?.final_policy_training_use !== "forbidden_final_window_reporting_only") {
      errors.push(`${entry.name}: leakage guard must keep final labels out of guard selection.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0 || Number(result.llm_budget?.prime_intellect_cost_usd) !== 0) {
      errors.push(`${entry.name}: entailment coverage guard postmortem must make zero calls and launch no compute.`);
    }
    if (!report.includes("Entailment Coverage Guard Postmortem Audit") || !report.includes("Eligible zero-regression rescue policies: 0") || !report.includes("Launch GPU now: no")) {
      errors.push(`${entry.name}: report must document zero eligible policies and no GPU launch.`);
    }
  }
}

async function validateQuestionFocusGuardAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("question-focus-guard-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let nonfinalGrid;
    let finalGrid;
    let bestSwitches;
    let selectedSwitches;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      nonfinalGrid = await readJsonl(path.join(runPath, "nonfinal_question_focus_grid.jsonl"));
      finalGrid = await readJsonl(path.join(runPath, "final_question_focus_grid.jsonl"));
      bestSwitches = await readJsonl(path.join(runPath, "best_question_focus_final_switches.jsonl"));
      selectedSwitches = await readJsonl(path.join(runPath, "selected_final_switches.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed question-focus guard artifacts.`);
      continue;
    }
    if (result.artifact_type !== "question_focus_guard_audit" || result.status !== "question_focus_guards_not_promotable") {
      errors.push(`${entry.name}: question-focus guard audit must reject promotion.`);
    }
    if (nonfinalGrid.length !== 337 || finalGrid.length !== 337) {
      errors.push(`${entry.name}: expected 336 guarded threshold rows plus one no-override baseline for non-final and final grids.`);
    }
    if (Number(result.nonfinal_selection?.guard_count) !== 8 || Number(result.nonfinal_selection?.threshold_rows) !== 337 || Number(result.nonfinal_selection?.eligible_zero_regression_rescue_policies) !== 26) {
      errors.push(`${entry.name}: expected eight question-focus guards and 26 eligible non-final zero-regression rescue policies.`);
    }
    if (result.nonfinal_selection?.selected_guard_id !== "question_overlap_and_answer_length_non_decreasing" || Number(result.nonfinal_selection?.selected_entailment_delta_threshold) !== 0 || Number(result.nonfinal_selection?.selected_entailment_floor) !== 0.5) {
      errors.push(`${entry.name}: expected selected non-final focus guard with delta 0 and floor 0.5.`);
    }
    if (Number(result.d304_context?.best_deployable_final_supported) !== 43 || Number(result.d304_context?.best_deployable_final_regressions) !== 3) {
      errors.push(`${entry.name}: D304 context must preserve best deployable coverage guard counts.`);
    }
    if (Number(result.low_prior_packet_summary?.rescue_rows) !== 23 || Number(result.low_prior_packet_summary?.latest_window_rescue_rows) !== 19 || Number(result.low_prior_packet_summary?.qwen_rejected_rows) !== 19) {
      errors.push(`${entry.name}: expected D300 low-prior packet counts.`);
    }
    const baseline = result.final_policies?.source_prefix_recency_4x;
    const selected = result.final_policies?.selected_question_focus_guard;
    const best = result.final_policies?.diagnostic_best_question_focus_guard;
    const overlapCoverage = result.final_policies?.diagnostic_overlap_and_coverage_guard;
    if (Number(baseline?.selected_supported) !== 44 || baseline?.guard_id !== "no_override") {
      errors.push(`${entry.name}: baseline must be the 44/49 source-prefix policy.`);
    }
    if (selected?.guard_id !== "question_overlap_and_answer_length_non_decreasing" || Number(selected?.selected_supported) !== 41 || Number(selected?.rescued_misses) !== 1 || Number(selected?.regressions) !== 4) {
      errors.push(`${entry.name}: selected non-final focus policy must anti-transfer to 41/49 with 1 rescue and 4 regressions.`);
    }
    if (best?.guard_id !== "question_overlap_and_answer_length_non_decreasing" || Number(best?.selected_supported) !== 44 || Number(best?.switches) !== 0) {
      errors.push(`${entry.name}: final-only best question-focus diagnostic must tie baseline at 44/49 with no switches.`);
    }
    if (overlapCoverage?.guard_id !== "question_overlap_and_claim_citation_non_decreasing" || Number(overlapCoverage?.selected_supported) !== 43 || Number(overlapCoverage?.regressions) !== 1) {
      errors.push(`${entry.name}: overlap and coverage diagnostic must be 43/49 with one regression.`);
    }
    if (selectedSwitches.length !== 5 || bestSwitches.length !== 0) {
      errors.push(`${entry.name}: expected five selected final switches and zero best-question-focus switches.`);
    }
    if (result.decision?.promote_question_focus_guard_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject question-focus promotion, labels, and GPU.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_window_labels_used_for_guard_selection !== false || result.leakage_guard?.final_policy_training_use !== "forbidden_final_window_reporting_only") {
      errors.push(`${entry.name}: leakage guard must keep final labels out of guard selection.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0 || Number(result.llm_budget?.prime_intellect_cost_usd) !== 0) {
      errors.push(`${entry.name}: question-focus guard audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Question Focus Guard Audit") || !report.includes("Eligible zero-regression rescue policies: 26") || !report.includes("Launch GPU now: no")) {
      errors.push(`${entry.name}: report must document eligible policy count and no GPU launch.`);
    }
  }
}

async function validateQuestionTargetCompletenessPacketAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("question-target-completeness-packet-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let targetRows;
    let focusRows;
    let coverageRows;
    let finalSwitchRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      targetRows = await readJsonl(path.join(runPath, "nonfinal_target_completeness_rows.jsonl"));
      focusRows = await readJsonl(path.join(runPath, "focus_guard_hard_negative_rows.jsonl"));
      coverageRows = await readJsonl(path.join(runPath, "coverage_guard_hard_negative_rows.jsonl"));
      finalSwitchRows = await readJsonl(path.join(runPath, "final_question_focus_switch_audit.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed question-target completeness packet artifacts.`);
      continue;
    }
    if (result.artifact_type !== "question_target_completeness_packet_audit" || result.status !== "target_completeness_supervision_sparse_in_current_packet") {
      errors.push(`${entry.name}: target completeness packet audit must classify current supervision as sparse.`);
    }
    if (Number(result.d305_context?.eligible_zero_regression_rescue_policies) !== 26 || Number(result.d305_context?.selected_final_regressions) !== 4) {
      errors.push(`${entry.name}: D305 context must preserve eligible-policy and final-regression counts.`);
    }
    if (Number(result.nonfinal_packet?.pair_rows) !== 58 || Number(result.nonfinal_packet?.target_rows) !== 44 || targetRows.length !== 44) {
      errors.push(`${entry.name}: expected 58 non-final pair rows and 44 target rows.`);
    }
    if (Number(result.nonfinal_packet?.unsupported_high_entailment_rows) !== 9 || Number(result.nonfinal_packet?.unsupported_very_high_entailment_rows) !== 4) {
      errors.push(`${entry.name}: expected 9 high-entailment and 4 very-high-entailment unsupported rows.`);
    }
    if (Number(result.nonfinal_packet?.focus_guard_hard_negative_rows) !== 1 || focusRows.length !== 1) {
      errors.push(`${entry.name}: expected exactly one non-final focus-guard hard negative.`);
    }
    if (Number(result.nonfinal_packet?.coverage_guard_hard_negative_rows) !== 4 || coverageRows.length !== 4) {
      errors.push(`${entry.name}: expected exactly four non-final coverage-guard hard negatives.`);
    }
    if (Number(result.final_diagnostic?.selected_question_focus_switches) !== 5 || finalSwitchRows.length !== 5 || Number(result.final_diagnostic?.selected_question_focus_regressions) !== 4 || Number(result.final_diagnostic?.selected_question_focus_rescues) !== 1) {
      errors.push(`${entry.name}: expected D305 final switch diagnostic of 5 switches, 4 regressions, and 1 rescue.`);
    }
    if (Number(result.final_diagnostic?.regression_tags?.focus_guard_hard_negative) !== 4 || Number(result.final_diagnostic?.rescue_tags?.focus_guard_hard_negative) !== 1) {
      errors.push(`${entry.name}: final D305 switches should all be focus-guard hard-negative analogs.`);
    }
    if (result.packet_readiness?.enough_focus_hard_negatives_for_training !== false || result.packet_readiness?.enough_coverage_hard_negatives_for_training !== false || result.packet_readiness?.enough_final_analog_regressions_for_diagnostic !== true) {
      errors.push(`${entry.name}: packet readiness must reject current training while retaining final diagnostic usefulness.`);
    }
    if (result.decision?.train_question_target_verifier_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject verifier training, labels, and GPU.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.final_policy_training_use !== "forbidden_final_window_reporting_only") {
      errors.push(`${entry.name}: leakage guard must keep final switches reporting-only.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0 || Number(result.llm_budget?.prime_intellect_cost_usd) !== 0) {
      errors.push(`${entry.name}: question-target completeness packet audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Question-Target Completeness Packet Audit") || !report.includes("Focus-guard hard negatives: 1") || !report.includes("Launch GPU now: no")) {
      errors.push(`${entry.name}: report must document sparse focus hard negatives and no GPU launch.`);
    }
  }
}

async function validateFrontierTargetCompletenessMiningAuditRunsIfPresent() {
  const runsDir = path.join(experimentDir, "runs");
  let entries = [];
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("frontier-target-completeness-mining-audit-")) continue;
    const runPath = path.join(runsDir, entry.name);
    let result;
    let targetRows;
    let focusRows;
    let coverageRows;
    let report;
    try {
      result = JSON.parse(await fs.readFile(path.join(runPath, "result.json"), "utf8"));
      targetRows = await readJsonl(path.join(runPath, "frontier_target_completeness_rows.jsonl"));
      focusRows = await readJsonl(path.join(runPath, "frontier_focus_guard_hard_negative_rows.jsonl"));
      coverageRows = await readJsonl(path.join(runPath, "frontier_coverage_guard_hard_negative_rows.jsonl"));
      report = await fs.readFile(path.join(runPath, "report.md"), "utf8");
    } catch {
      errors.push(`${entry.name}: missing or malformed frontier target completeness mining artifacts.`);
      continue;
    }
    if (result.artifact_type !== "frontier_target_completeness_mining_audit" || result.status !== "frontier_packet_still_sparse_for_target_completeness") {
      errors.push(`${entry.name}: frontier target completeness audit must classify existing frontier rows as sparse.`);
    }
    if (Number(result.d306_context?.baseline_focus_guard_hard_negative_rows) !== 1 || Number(result.d306_context?.baseline_coverage_guard_hard_negative_rows) !== 4) {
      errors.push(`${entry.name}: D306 context must preserve sparse baseline hard-negative counts.`);
    }
    if (Number(result.frontier_packet?.frontier_pair_rows) !== 84 || Number(result.frontier_packet?.train_pair_rows) !== 63 || Number(result.frontier_packet?.validation_pair_rows) !== 21) {
      errors.push(`${entry.name}: expected 84 frontier rows with 63 train and 21 validation rows.`);
    }
    if (Number(result.frontier_packet?.target_rows) !== 79 || targetRows.length !== 79) {
      errors.push(`${entry.name}: expected 79 frontier target rows.`);
    }
    if (Number(result.frontier_packet?.unsupported_high_entailment_rows) !== 2 || Number(result.frontier_packet?.unsupported_very_high_entailment_rows) !== 0) {
      errors.push(`${entry.name}: expected two high-entailment and zero very-high-entailment unsupported frontier rows.`);
    }
    if (Number(result.frontier_packet?.focus_guard_hard_negative_rows) !== 1 || focusRows.length !== 1 || Number(result.frontier_packet?.focus_guard_hard_negative_train_rows) !== 1 || Number(result.frontier_packet?.focus_guard_hard_negative_validation_rows) !== 0) {
      errors.push(`${entry.name}: expected one train focus hard negative and no validation focus hard negatives.`);
    }
    if (Number(result.frontier_packet?.coverage_guard_hard_negative_rows) !== 0 || coverageRows.length !== 0) {
      errors.push(`${entry.name}: expected zero frontier coverage hard negatives.`);
    }
    if (result.packet_readiness?.enough_focus_hard_negatives_for_training !== false || result.packet_readiness?.enough_focus_hard_negatives_for_validation !== false || result.packet_readiness?.enough_coverage_hard_negatives_for_training !== false) {
      errors.push(`${entry.name}: packet readiness must reject frontier-only target-completeness training.`);
    }
    if (result.decision?.build_question_target_packet_next !== false || result.decision?.train_question_target_verifier_now !== false || result.decision?.buy_openai_labels_now !== false || result.decision?.launch_gpu_now !== false) {
      errors.push(`${entry.name}: decision must reject packet build, verifier training, labels, and GPU for frontier-only data.`);
    }
    if (result.leakage_guard?.final_window_labels_used_for_training !== false || result.leakage_guard?.frontier_rows_training_use !== "allowed_existing_nonfinal_frontier_judgments") {
      errors.push(`${entry.name}: leakage guard must keep final labels out and identify frontier rows as existing non-final judgments.`);
    }
    if (Number(result.llm_budget?.openai_llm_calls) !== 0 || Number(result.llm_budget?.openai_cost_usd) !== 0 || Number(result.llm_budget?.external_compute_cost_usd) !== 0 || Number(result.llm_budget?.prime_intellect_cost_usd) !== 0) {
      errors.push(`${entry.name}: frontier target completeness mining audit must make zero calls and launch no compute.`);
    }
    if (!report.includes("Frontier Target Completeness Mining Audit") || !report.includes("Focus-guard hard negatives: 1") || !report.includes("Launch GPU now: no")) {
      errors.push(`${entry.name}: report must document sparse focus hard negatives and no GPU launch.`);
    }
  }
}

async function teacherLabelPapers(prefix) {
  const exportDir = path.join(experimentDir, "exports");
  const rows = [];
  for (const suffix of ["sft", "rejected"]) {
    try {
      rows.push(...await readJsonl(path.join(exportDir, `${prefix}.${suffix}.jsonl`)));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      errors.push(`Missing teacher-label ${suffix} file for holdout exclusion prefix ${prefix}.`);
    }
  }
  return new Set(rows.map((row) => row.input?.document_metadata?.paper_id).filter(Boolean));
}

function validateExample(row, label) {
  if (!row.example_id) errors.push(`${label}: missing example_id.`);
  if (row.task !== "grounded_domain_qa_distillation") errors.push(`${label}: unexpected task.`);
  if (!row.input?.question) errors.push(`${label}: missing input.question.`);
  if (!Array.isArray(row.input?.compact_retrieved_evidence_pack) || row.input.compact_retrieved_evidence_pack.length === 0) {
    errors.push(`${label}: missing compact evidence pack.`);
    return;
  }
  if (!row.input?.document_metadata?.paper_id) errors.push(`${label}: missing document metadata paper_id.`);
  if (!row.output?.answer) errors.push(`${label}: missing output.answer.`);
  if (!Array.isArray(row.output?.claim_table) || row.output.claim_table.length === 0) errors.push(`${label}: missing claim_table.`);

  const evidenceIds = new Set(row.input.compact_retrieved_evidence_pack.map((item) => item.evidence_id));
  for (const item of row.input.compact_retrieved_evidence_pack) {
    if (!item.evidence_id || !item.text || !item.paper_id) errors.push(`${label}: malformed evidence item.`);
    if ("_teacher_role" in item || "role" in item) errors.push(`${label}: input evidence item leaks teacher role.`);
  }
  if (!row.teacher_trace?.evidence_roles || typeof row.teacher_trace.evidence_roles !== "object") {
    errors.push(`${label}: missing teacher_trace.evidence_roles for evaluation.`);
  }

  const citations = row.output.citations ?? [];
  if (row.output.answer_type === "abstain") {
    if (citations.length) errors.push(`${label}: abstention examples must not cite evidence.`);
    if (!row.output.abstention_reason) errors.push(`${label}: abstention example needs abstention_reason.`);
    return;
  }

  if (!citations.length) errors.push(`${label}: answerable example needs citations.`);
  for (const citation of citations) {
    if (!evidenceIds.has(citation.evidence_id)) errors.push(`${label}: citation ${citation.evidence_id} is not in evidence pack.`);
  }
  for (const citation of citations) {
    if (!row.output.answer.includes(`[${citation.evidence_id}]`)) {
      errors.push(`${label}: output.answer does not include inline citation [${citation.evidence_id}].`);
    }
  }
}

function validateTeacherLabel(row, label, accepted) {
  if (!row.example_id) errors.push(`${label}: missing example_id.`);
  if (row.task !== "citation_grounded_domain_qa_teacher_label_sft") errors.push(`${label}: unexpected task.`);
  if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${label}: expected three chat messages.`);
  if (!row.input?.question) errors.push(`${label}: missing input.question.`);
  if (!Array.isArray(row.input?.compact_retrieved_evidence_pack) || !row.input.compact_retrieved_evidence_pack.length) {
    errors.push(`${label}: missing evidence pack.`);
    return;
  }
  if (!row.teacher_output?.answer_type) errors.push(`${label}: missing teacher_output.answer_type.`);
  if (accepted && row.label_source?.quality_tier !== "judge_accepted") errors.push(`${label}: accepted label must have judge_accepted quality tier.`);
  if (!accepted && !row.rejection_reason) errors.push(`${label}: rejected label needs rejection_reason.`);

  const evidenceIds = new Set(row.input.compact_retrieved_evidence_pack.map((item) => item.evidence_id));
  const citations = row.teacher_output?.citations ?? [];
  if (row.teacher_output?.answer_type === "abstain") {
    if (citations.length) errors.push(`${label}: accepted/rejected abstention must not cite evidence.`);
    if (accepted && row.teacher_trace?.judgment?.verdict !== "correct_abstention") {
      errors.push(`${label}: accepted abstention must have correct_abstention judgment.`);
    }
    return;
  }

  if (accepted && row.teacher_trace?.judgment?.verdict !== "supported") errors.push(`${label}: accepted answer must have supported judgment.`);
  if (accepted && !citations.length) errors.push(`${label}: accepted answer needs citations.`);
  for (const id of citations) {
    if (!evidenceIds.has(id)) errors.push(`${label}: citation ${id} is not in evidence pack.`);
    if (accepted && !row.teacher_output.answer.includes(`[${id}]`)) {
      errors.push(`${label}: accepted answer missing inline citation [${id}].`);
    }
  }
}

function validateHfSftRow(row, label) {
  if (!row.example_id) errors.push(`${label}: missing example_id.`);
  if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${label}: expected three messages.`);
  if (row.messages?.[0]?.role !== "system" || row.messages?.[1]?.role !== "user" || row.messages?.[2]?.role !== "assistant") {
    errors.push(`${label}: expected system/user/assistant roles.`);
  }
  let output;
  try {
    output = JSON.parse(row.messages?.[2]?.content ?? "");
  } catch {
    errors.push(`${label}: assistant message content must be JSON.`);
    return;
  }
  if (!["grounded_answer", "abstain"].includes(output.answer_type)) errors.push(`${label}: invalid assistant answer_type.`);
  if (output.answer_type === "grounded_answer") {
    if (!Array.isArray(output.citations) || !output.citations.length) errors.push(`${label}: grounded answer needs citations.`);
    for (const citation of output.citations ?? []) {
      if (!output.answer?.includes(`[${citation}]`)) errors.push(`${label}: missing inline citation [${citation}].`);
    }
  }
}

function intersection(left, right) {
  return [...left].filter((value) => right.has(value));
}
