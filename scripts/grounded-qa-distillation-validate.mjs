import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const requiredFiles = ["manifest.json", "train.jsonl", "validation.jsonl"];
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
  if (!manifest.splits?.train || !manifest.splits?.validation) errors.push("manifest must include train and validation split stats.");

  for (const split of ["train", "validation"]) {
    const rows = await readJsonl(path.join(dataDir, `${split}.jsonl`));
    if (!rows.length) errors.push(`${split}.jsonl must contain examples.`);
    if (manifest.splits?.[split]?.examples_written !== rows.length) {
      errors.push(`${split}.jsonl row count does not match manifest.`);
    }

    rows.forEach((row, index) => validateExample(row, `${split}:${index + 1}`));
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Grounded QA distillation artifacts are valid.");

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
