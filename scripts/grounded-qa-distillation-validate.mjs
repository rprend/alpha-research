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
