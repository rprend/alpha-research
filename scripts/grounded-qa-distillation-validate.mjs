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
  await validateModelScaleAdequacyAuditRunsIfPresent();
  await validateJointActionPacketQualityAuditRunsIfPresent();
  await validateRepairRegenerationSignalAuditRunsIfPresent();
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
    const profile = result.checks?.prompt_profile ?? {};
    if (Number(profile.sft_full?.rows_over_limit) !== 0 || Number(profile.dpo_prompt?.rows_over_limit) !== 0 || Number(profile.dpo_full?.rows_over_limit) !== 0) {
      errors.push(`${entry.name}: train prompt profile has rows over configured limits.`);
    }
    const status = result.conclusion?.status;
    if (!["ready_for_bounded_gpu_smoke", "remote_training_ready_local_runtime_incomplete", "needs_length_mitigation_before_full_run"].includes(status)) {
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
    ]);
    if (!allowedPacketRunIds.has(result.packet_run_id)) {
      errors.push(`${entry.name}: finalizer must target a registered Qwen3B packet.`);
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
