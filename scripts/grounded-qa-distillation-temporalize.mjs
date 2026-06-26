import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const sourceSplits = (args["source-splits"] ?? "train,validation,test").split(",").map((value) => value.trim()).filter(Boolean);
const trainPaperFraction = numericArg(args["train-paper-fraction"], 0.7);
const validationPaperFraction = numericArg(args["validation-paper-fraction"], 0.15);

await fs.mkdir(reportsDir, { recursive: true });

const rows = [];
for (const split of sourceSplits) {
  for (const row of await readJsonl(path.join(dataDir, `${split}.jsonl`))) {
    const temporal = inferTemporalMetadata(row.input.document_metadata.paper_id);
    if (!temporal) continue;
    rows.push({
      ...row,
      original_source_split: row.source_split,
      temporal,
    });
  }
}

const papers = [...new Map(rows.map((row) => [row.input.document_metadata.paper_id, row.temporal])).entries()]
  .map(([paperId, temporal]) => ({ paperId, ...temporal }))
  .sort((a, b) => a.paper_month.localeCompare(b.paper_month) || a.paperId.localeCompare(b.paperId));

if (papers.length < 10) {
  throw new Error(`Need at least 10 dated papers for temporal splits; found ${papers.length}.`);
}

const months = [...new Set(papers.map((paper) => paper.paper_month))].sort();
const trainMonthCount = Math.max(1, Math.floor(months.length * trainPaperFraction));
const validationMonthCount = Math.max(1, Math.floor(months.length * validationPaperFraction));
const trainMonths = new Set(months.slice(0, trainMonthCount));
const validationMonths = new Set(months.slice(trainMonthCount, trainMonthCount + validationMonthCount));
const testMonths = new Set(months.slice(trainMonthCount + validationMonthCount));
const trainPapers = new Set(papers.filter((paper) => trainMonths.has(paper.paper_month)).map((paper) => paper.paperId));
const validationPapers = new Set(papers.filter((paper) => validationMonths.has(paper.paper_month)).map((paper) => paper.paperId));
const testPapers = new Set(papers.filter((paper) => testMonths.has(paper.paper_month)).map((paper) => paper.paperId));

const splitDefs = [
  ["temporal_train", trainPapers],
  ["temporal_validation", validationPapers],
  ["temporal_test", testPapers],
];

const manifest = {
  generated_at: new Date().toISOString(),
  source_files: sourceSplits.map((split) => `docs/experiments/grounded-qa-distillation/data/${split}.jsonl`),
  purpose: "Chronological, paper-disjoint evaluation for grounded QA distillation over evolving knowledge bases.",
  temporal_policy: {
    date_source: "arXiv-style QASPER paper ids parsed as YYMM.",
    train_paper_fraction: trainPaperFraction,
    validation_paper_fraction: validationPaperFraction,
    split_policy: "Sort unique inferred paper_month values, assign earliest months to temporal_train, middle months to temporal_validation, and latest months to temporal_test. Keep all examples from a paper and all papers from a month in the same temporal split.",
  },
  source_examples_read: rows.length,
  source_papers_read: papers.length,
  source_months_read: months.length,
  splits: {},
};

for (const [split, paperSet] of splitDefs) {
  const examples = rows
    .filter((row) => paperSet.has(row.input.document_metadata.paper_id))
    .map((row) => materializeTemporalExample(row, split));
  const file = path.join(dataDir, `${split}.jsonl`);
  await writeJsonl(file, examples);
  const splitPapers = papers.filter((paper) => paperSet.has(paper.paperId));
  manifest.splits[split] = {
    output_path: path.relative(rootDir, file),
    paper_count: splitPapers.length,
    examples_written: examples.length,
    answerable_examples: examples.filter((example) => example.output.answer_type === "grounded_answer").length,
    abstention_examples: examples.filter((example) => example.output.answer_type === "abstain").length,
    first_paper_month: splitPapers[0]?.paper_month ?? null,
    last_paper_month: splitPapers.at(-1)?.paper_month ?? null,
  };
}

const manifestPath = path.join(dataDir, "temporal-manifest.json");
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(path.join(reportsDir, "temporal-data-card.md"), renderTemporalDataCard(manifest));

console.log(JSON.stringify({
  manifest: path.relative(rootDir, manifestPath),
  splits: manifest.splits,
}, null, 2));

function materializeTemporalExample(row, split) {
  const temporalIndex = split.replace("temporal_", "");
  const { temporal, ...withoutTemporal } = row;
  return {
    ...withoutTemporal,
    source_split: split,
    input: {
      ...row.input,
      document_metadata: {
        ...row.input.document_metadata,
        knowledge_base_version: split,
        temporal_split: split,
        temporal_index: temporalIndex,
        inferred_publication_month: temporal.paper_month,
        inferred_publication_date: temporal.paper_date,
        temporal_source: temporal.source,
        original_knowledge_base_version: row.input.document_metadata.knowledge_base_version,
        original_source_split: row.original_source_split,
      },
    },
    teacher_trace: {
      ...row.teacher_trace,
      temporal_policy: "month-disjoint chronological split by inferred arXiv paper month",
    },
  };
}

function inferTemporalMetadata(paperId) {
  const match = String(paperId ?? "").match(/^(\d{2})(\d{2})\./);
  if (!match) return null;
  const yearPrefix = Number(match[1]) >= 90 ? "19" : "20";
  const year = `${yearPrefix}${match[1]}`;
  const month = match[2];
  if (Number(month) < 1 || Number(month) > 12) return null;
  return {
    paper_month: `${year}-${month}`,
    paper_date: `${year}-${month}-01`,
    source: "arxiv_id_prefix",
  };
}

function renderTemporalDataCard(manifest) {
  const rows = Object.entries(manifest.splits)
    .map(([split, stats]) => `| ${split} | ${stats.paper_count} | ${stats.examples_written} | ${stats.answerable_examples} | ${stats.abstention_examples} | ${stats.first_paper_month} | ${stats.last_paper_month} |`)
    .join("\n");

  return `# Temporal Grounded QA Data Card

Generated: ${manifest.generated_at}

## Purpose

This view turns the QASPER-derived grounded-QA corpus into a chronological, paper-disjoint proxy for an evolving private knowledge base. It is still a proxy: dates are inferred from arXiv-style paper ids, not from a live enterprise corpus.

## Policy

- Date source: ${manifest.temporal_policy.date_source}
- Split policy: ${manifest.temporal_policy.split_policy}
- Source examples read: ${manifest.source_examples_read}
- Source papers read: ${manifest.source_papers_read}
- Source months read: ${manifest.source_months_read}

## Splits

| Split | Papers | Examples | Answerable | Abstentions | First month | Last month |
| --- | ---: | ---: | ---: | ---: | --- | --- |
${rows}

## Evaluation Use

Train cheap student scaffolds on \`temporal_train\`, tune on \`temporal_validation\`, and reserve \`temporal_test\` for latest-paper evaluation. This measures update transfer more directly than treating the original QASPER train/validation/test names as time.
`;
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function numericArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 1 ? parsed : fallback;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [key, raw] = value.slice(2).split("=");
    parsed[key] = raw ?? "true";
  }
  return parsed;
}
