import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const requiredFiles = ["manifest.json", "train.jsonl", "validation.jsonl", "test.jsonl"];
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
  await validateGpuLaunchAttemptRunsIfPresent();
  await validatePrimeAuthDiagnosisRunsIfPresent();
  await validateTemporalWindowComparisonRunsIfPresent();
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
      if (row.prediction?.answer_type === "grounded_answer") {
        for (const citation of row.prediction.citations ?? []) {
          if (!row.prediction.answer?.includes(`[${citation}]`)) errors.push(`${label}: missing inline citation [${citation}].`);
        }
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
        for (const citation of row.prediction.citations ?? []) {
          if (!row.prediction.answer?.includes(`[${citation}]`)) errors.push(`${label}: missing inline citation [${citation}].`);
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
    const ledgerAction = result.ledger?.action;
    if (!["not_recorded", "recorded", "already_recorded"].includes(ledgerAction)) {
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
        for (const citation of row.prediction.citations ?? []) {
          if (!row.prediction.answer?.includes(`[${citation}]`)) errors.push(`${label}: missing inline citation [${citation}].`);
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
