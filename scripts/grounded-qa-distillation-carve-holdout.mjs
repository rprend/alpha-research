import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const exportDir = path.join(experimentDir, "exports");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourceSplit = args["source-split"] ?? "extended_temporal_test";
const outputSplit = args["output-split"] ?? "extended_temporal_future_holdout";
const excludeTeacherLabelPrefix = args["exclude-teacher-label-prefix"] ?? "";
const minMonth = args["min-month"] ?? null;
const maxExamples = numberArg(args["max-examples"], Number.POSITIVE_INFINITY);

await fs.mkdir(reportsDir, { recursive: true });

const rows = await readJsonl(path.join(dataDir, `${sourceSplit}.jsonl`));
const excluded = excludeTeacherLabelPrefix ? await loadExcludedPapers(excludeTeacherLabelPrefix) : { papers: new Set(), examples: new Set() };
const candidates = rows
  .filter((row) => !minMonth || String(row.input?.document_metadata?.inferred_publication_month ?? "") >= minMonth)
  .filter((row) => !excluded.papers.has(row.input?.document_metadata?.paper_id))
  .filter((row) => !excluded.examples.has(row.example_id))
  .sort(compareRows);

const selected = [];
const selectedPapers = new Set();
for (const row of candidates) {
  if (selected.length >= maxExamples) break;
  selected.push(materialize(row));
  selectedPapers.add(row.input.document_metadata.paper_id);
}

if (!selected.length) throw new Error(`No holdout examples selected from ${sourceSplit}.`);

const outputPath = path.join(dataDir, `${outputSplit}.jsonl`);
const manifestPath = path.join(dataDir, `${outputSplit}-manifest.json`);
const reportPath = path.join(reportsDir, `${outputSplit}-data-card.md`);
const months = selected.map((row) => row.input.document_metadata.inferred_publication_month).filter(Boolean).sort();
const result = {
  generated_at: new Date().toISOString(),
  source_split: sourceSplit,
  output_split: outputSplit,
  purpose: "Fresh paper-disjoint future holdout for grounded QA distillation after claim-pruned label construction.",
  selection_policy: {
    min_month: minMonth,
    max_examples: Number.isFinite(maxExamples) ? maxExamples : null,
    exclude_teacher_label_prefix: excludeTeacherLabelPrefix || null,
    excluded_papers: excluded.papers.size,
    excluded_examples: excluded.examples.size,
    sort_order: "inferred publication month, paper id, example id",
  },
  examples_written: selected.length,
  paper_count: selectedPapers.size,
  answerable_examples: selected.filter((row) => row.output.answer_type === "grounded_answer").length,
  abstention_examples: selected.filter((row) => row.output.answer_type === "abstain").length,
  first_paper_month: months[0] ?? null,
  last_paper_month: months.at(-1) ?? null,
  artifacts: {
    jsonl: path.relative(rootDir, outputPath),
    manifest: path.relative(rootDir, manifestPath),
    report: path.relative(rootDir, reportPath),
  },
};

await writeJsonl(outputPath, selected);
await fs.writeFile(manifestPath, `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(reportPath, renderReport(result));

console.log(JSON.stringify(result, null, 2));

async function loadExcludedPapers(prefix) {
  const rows = [
    ...await readJsonl(path.join(exportDir, `${prefix}.sft.jsonl`)),
    ...await readJsonl(path.join(exportDir, `${prefix}.rejected.jsonl`)),
  ];
  return {
    papers: new Set(rows.map((row) => row.input?.document_metadata?.paper_id).filter(Boolean)),
    examples: new Set(rows.map((row) => row.example_id).filter(Boolean)),
  };
}

function materialize(row) {
  return {
    ...row,
    source_split: outputSplit,
    input: {
      ...row.input,
      document_metadata: {
        ...row.input.document_metadata,
        knowledge_base_version: outputSplit,
        temporal_split: outputSplit,
        heldout_source_split: sourceSplit,
      },
    },
    teacher_trace: {
      ...row.teacher_trace,
      holdout_policy: "future holdout carved from extended temporal test after excluding claim-pruned label papers",
    },
  };
}

function compareRows(a, b) {
  const am = a.input.document_metadata.inferred_publication_month ?? "";
  const bm = b.input.document_metadata.inferred_publication_month ?? "";
  return am.localeCompare(bm)
    || a.input.document_metadata.paper_id.localeCompare(b.input.document_metadata.paper_id)
    || a.example_id.localeCompare(b.example_id);
}

function renderReport(result) {
  return `# Extended Temporal Future Holdout

Generated: ${result.generated_at}

## Purpose

This split reserves a fresh paper-disjoint holdout after constructing claim-pruned teacher labels. It is meant for evaluating students trained on \`${result.selection_policy.exclude_teacher_label_prefix}\` without reusing the same papers.

## Selection

- Source split: \`${result.source_split}\`
- Output split: \`${result.output_split}\`
- Minimum month: ${result.selection_policy.min_month ?? "none"}
- Excluded teacher-label prefix: \`${result.selection_policy.exclude_teacher_label_prefix ?? "none"}\`
- Excluded papers: ${result.selection_policy.excluded_papers}
- Excluded examples: ${result.selection_policy.excluded_examples}

## Summary

| Examples | Papers | Answerable | Abstentions | First month | Last month |
| ---: | ---: | ---: | ---: | --- | --- |
| ${result.examples_written} | ${result.paper_count} | ${result.answerable_examples} | ${result.abstention_examples} | ${result.first_paper_month} | ${result.last_paper_month} |

## Use

Use this split for downstream evaluation after training or fitting on claim-pruned labels. Do not use it for teacher-label construction or selector calibration.
`;
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
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
