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
  await validateJudgeRunsIfPresent();
  await validateMultistepTeacherRunsIfPresent();
  await validateTeacherLabelExportsIfPresent();
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

function intersection(left, right) {
  return [...left].filter((value) => right.has(value));
}
