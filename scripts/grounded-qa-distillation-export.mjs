import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const exportDir = path.join(experimentDir, "exports");
const args = parseArgs(process.argv.slice(2));
const splits = (args.splits ?? "temporal_train,temporal_validation,temporal_test").split(",").map((value) => value.trim()).filter(Boolean);
const manifestName = args["manifest-name"] ?? "manifest.json";

await fs.mkdir(exportDir, { recursive: true });

const manifest = {
  generated_at: new Date().toISOString(),
  purpose: "Model-facing post-training data for citation-grounded QA over evolving knowledge bases.",
  format: "jsonl chat-style supervised examples with question, compact evidence pack, metadata/dates, answer, citations, abstention, and claim table.",
  splits: {},
};

for (const split of splits) {
  const rows = await readJsonl(path.join(dataDir, `${split}.jsonl`));
  const examples = rows.map(toTrainingExample);
  const outputPath = path.join(exportDir, `${split}.sft.jsonl`);
  await writeJsonl(outputPath, examples);
  manifest.splits[split] = {
    output_path: path.relative(rootDir, outputPath),
    examples_written: examples.length,
    grounded_answers: examples.filter((example) => example.target.answer_type === "grounded_answer").length,
    abstentions: examples.filter((example) => example.target.answer_type === "abstain").length,
  };
}

const manifestPath = path.join(exportDir, manifestName);
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  manifest: path.relative(rootDir, manifestPath),
  splits: manifest.splits,
}, null, 2));

function toTrainingExample(row) {
  const metadata = row.input.document_metadata;
  const evidence = row.input.compact_retrieved_evidence_pack.map((item) => ({
    evidence_id: item.evidence_id,
    retrieval_rank: item.retrieval_rank,
    paper_id: item.paper_id,
    section: item.section,
    text: item.text,
  }));

  return {
    example_id: row.example_id,
    source_split: row.source_split,
    task: "citation_grounded_domain_qa_sft",
    messages: [
      {
        role: "system",
        content: "Answer only from the compact evidence pack. Cite every factual claim with bracketed evidence ids. Abstain when the evidence is insufficient. Return JSON with answer_type, answer, citations, claim_table, and abstention_reason.",
      },
      {
        role: "user",
        content: JSON.stringify({
          question: row.input.question,
          document_metadata: {
            paper_id: metadata.paper_id,
            title: metadata.title,
            domain: metadata.domain,
            knowledge_base_version: metadata.knowledge_base_version,
            inferred_publication_date: metadata.inferred_publication_date ?? null,
            inferred_publication_month: metadata.inferred_publication_month ?? null,
            temporal_split: metadata.temporal_split ?? null,
            source_dataset: metadata.source_dataset,
          },
          compact_retrieved_evidence_pack: evidence,
        }),
      },
      {
        role: "assistant",
        content: JSON.stringify({
          answer_type: row.output.answer_type,
          answer: row.output.answer,
          citations: row.output.citations,
          claim_table: row.output.claim_table,
          abstention_reason: row.output.abstention_reason,
        }),
      },
    ],
    input: {
      question: row.input.question,
      document_metadata: metadata,
      compact_retrieved_evidence_pack: evidence,
    },
    target: {
      answer_type: row.output.answer_type,
      answer: row.output.answer,
      citations: row.output.citations,
      claim_table: row.output.claim_table,
      abstention_reason: row.output.abstention_reason,
    },
  };
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
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
