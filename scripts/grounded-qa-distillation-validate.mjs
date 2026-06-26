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

function intersection(left, right) {
  return [...left].filter((value) => right.has(value));
}
