import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const reportsDir = path.join(experimentDir, "reports");

const dataset = "allenai/qasper";
const config = "qasper";
const defaultSplits = ["train", "validation", "test"];
const args = parseArgs(process.argv.slice(2));
const splits = args.splits ? args.splits.split(",").map((value) => value.trim()).filter(Boolean) : defaultSplits;
const rowsPerSplit = numberArg(args["rows-per-split"], 40);
const maxExamplesPerSplit = numberArg(args["max-examples-per-split"], 240);
const evidenceLimit = numberArg(args["evidence-limit"], 4);
const distractorLimit = numberArg(args["distractor-limit"], 3);
const maxEvidenceChars = numberArg(args["max-evidence-chars"], 900);
const evidenceOrder = args["evidence-order"] ?? "stable-mixed";

await fs.mkdir(dataDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const generatedAt = new Date().toISOString();
const manifest = {
  generated_at: generatedAt,
  source_dataset: dataset,
  source_config: config,
  source_url: `https://huggingface.co/datasets/${dataset}`,
  dataset_viewer_api: "https://datasets-server.huggingface.co",
  purpose: "Post-training data for cheaper citation-grounded QA over an evolving domain knowledge base.",
  construction: {
    rows_per_split: rowsPerSplit,
    max_examples_per_split: maxExamplesPerSplit,
    evidence_limit: evidenceLimit,
    distractor_limit: distractorLimit,
    max_evidence_chars: maxEvidenceChars,
    evidence_order: evidenceOrder,
    evidence_policy: "Gold QASPER answer evidence and deterministic non-gold paper paragraphs are packed without exposing oracle roles or guaranteed gold-first ordering to the student input.",
    citation_policy: "Each output sentence cites evidence ids from input.evidence_pack. Abstentions cite no evidence and explain insufficiency.",
  },
  splits: {},
};

for (const split of splits) {
  const sourceRows = await fetchRows(split, rowsPerSplit);
  const examples = [];
  for (const sourceRow of sourceRows) {
    examples.push(...buildExamples(sourceRow, split));
    if (examples.length >= maxExamplesPerSplit) break;
  }

  const boundedExamples = examples.slice(0, maxExamplesPerSplit);
  const outputPath = path.join(dataDir, `${split}.jsonl`);
  await writeJsonl(outputPath, boundedExamples);
  manifest.splits[split] = {
    rows_read: sourceRows.length,
    examples_written: boundedExamples.length,
    output_path: path.relative(rootDir, outputPath),
    answerable_examples: boundedExamples.filter((example) => example.output.answer_type !== "abstain").length,
    abstention_examples: boundedExamples.filter((example) => example.output.answer_type === "abstain").length,
  };
}

const manifestPath = path.join(dataDir, "manifest.json");
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(path.join(reportsDir, "distillation-data-card.md"), renderDataCard(manifest));

console.log(JSON.stringify({
  generated_at: generatedAt,
  manifest: path.relative(rootDir, manifestPath),
  splits: manifest.splits,
}, null, 2));

function buildExamples(row, split) {
  const paper = normalizePaper(row);
  const questions = row.qas?.question ?? [];
  const questionIds = row.qas?.question_id ?? [];
  const answersByQuestion = row.qas?.answers ?? [];
  const examples = [];

  for (let index = 0; index < questions.length; index += 1) {
    const question = cleanText(questions[index]);
    if (!question) continue;

    const answers = normalizeAnswers(answersByQuestion[index]);
    const selectedAnswer = selectAnswer(answers);
    if (!selectedAnswer) continue;

    const evidencePack = buildEvidencePack({
      paper,
      answer: selectedAnswer,
      questionIndex: index,
      question,
    });

    const isAbstention = selectedAnswer.unanswerable || !evidencePack.some((item) => item._teacher_role === "gold_evidence");
    const citedEvidenceIds = isAbstention ? [] : evidencePack
      .filter((item) => item._teacher_role === "gold_evidence")
      .slice(0, evidenceLimit)
      .map((item) => item.evidence_id);

    const answerText = isAbstention
      ? "The evidence pack does not contain enough support to answer this question."
      : renderAnswerText(selectedAnswer, citedEvidenceIds);

    examples.push({
      example_id: `${paper.paper_id}:${questionIds[index] ?? index}`,
      source_split: split,
      task: "grounded_domain_qa_distillation",
      input: {
        question,
        compact_retrieved_evidence_pack: evidencePack.map(({ _teacher_role, ...item }) => item),
        document_metadata: {
          paper_id: paper.paper_id,
          title: paper.title,
          abstract: paper.abstract,
          domain: "NLP research papers",
          knowledge_base_version: split,
          source_dataset: dataset,
          source_config: config,
          source_record_url: `https://huggingface.co/datasets/${dataset}/viewer/${config}/${split}`,
        },
        instruction: "Answer only from the evidence pack. Cite every factual claim with bracketed evidence ids such as [E1]. Abstain when support is insufficient.",
      },
      output: {
        answer_type: isAbstention ? "abstain" : "grounded_answer",
        answer: answerText,
        citations: citedEvidenceIds.map((evidenceId) => ({
          evidence_id: evidenceId,
          supports: "answer",
        })),
        claim_table: buildClaimTable(selectedAnswer, citedEvidenceIds, isAbstention),
        abstention_reason: isAbstention ? abstentionReason(selectedAnswer) : null,
      },
      teacher_trace: {
        scaffold: "gold-evidence-first compact RAG pack",
        source_answer_annotation_id: selectedAnswer.annotation_id,
        source_worker_id: selectedAnswer.worker_id,
        expensive_behavior_to_distill: [
          "retrieve relevant paper evidence",
          "decide whether evidence is sufficient",
          "answer with inline citations",
          "emit a structured claim table for checking",
        ],
        evidence_roles: Object.fromEntries(evidencePack.map((item) => [item.evidence_id, item._teacher_role])),
      },
    });
  }

  return examples;
}

function normalizePaper(row) {
  const sections = row.full_text?.section_name ?? [];
  const paragraphs = row.full_text?.paragraphs ?? [];
  const flatParagraphs = [];

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const sectionName = cleanText(sections[sectionIndex]) || `Section ${sectionIndex + 1}`;
    for (const paragraph of paragraphs[sectionIndex] ?? []) {
      const text = cleanText(paragraph);
      if (text) flatParagraphs.push({ section: sectionName, text });
    }
  }

  return {
    paper_id: row.id,
    title: cleanText(row.title),
    abstract: cleanText(row.abstract),
    paragraphs: flatParagraphs,
  };
}

function normalizeAnswers(answerGroup) {
  const answers = answerGroup?.answer ?? [];
  const annotationIds = answerGroup?.annotation_id ?? [];
  const workerIds = answerGroup?.worker_id ?? [];
  return answers.map((answer, index) => ({
    annotation_id: annotationIds[index] ?? null,
    worker_id: workerIds[index] ?? null,
    unanswerable: answer.unanswerable === true,
    extractive_spans: (answer.extractive_spans ?? []).map(cleanText).filter(Boolean),
    yes_no: answer.yes_no,
    free_form_answer: cleanText(answer.free_form_answer),
    evidence: (answer.evidence ?? []).map(cleanText).filter(Boolean),
    highlighted_evidence: (answer.highlighted_evidence ?? []).map(cleanText).filter(Boolean),
  }));
}

function selectAnswer(answers) {
  if (!answers.length) return null;
  return answers
    .map((answer) => ({
      answer,
      score: answerScore(answer),
    }))
    .sort((a, b) => b.score - a.score)[0].answer;
}

function answerScore(answer) {
  if (answer.unanswerable) return answer.evidence.length ? 1 : 0;
  return (answer.free_form_answer ? 4 : 0)
    + answer.extractive_spans.length * 2
    + answer.evidence.length * 3
    + answer.highlighted_evidence.length;
}

function buildEvidencePack({ paper, answer, questionIndex, question }) {
  const seen = new Set();
  const pack = [];
  const add = (role, section, text) => {
    const normalized = cleanText(text).slice(0, maxEvidenceChars);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    pack.push({
      evidence_id: `E${pack.length + 1}`,
      retrieval_rank: pack.length + 1,
      _teacher_role: role,
      paper_id: paper.paper_id,
      section,
      text: normalized,
    });
  };

  for (const evidence of answer.evidence.slice(0, evidenceLimit)) {
    add("gold_evidence", inferSection(paper, evidence), evidence);
  }

  const stride = Math.max(1, Math.floor(paper.paragraphs.length / Math.max(1, distractorLimit + 1)));
  for (let offset = 0; offset < paper.paragraphs.length && pack.filter((item) => item._teacher_role === "hard_negative").length < distractorLimit; offset += stride) {
    const paragraph = paper.paragraphs[(questionIndex + offset) % paper.paragraphs.length];
    if (paragraph) add("hard_negative", paragraph.section, paragraph.text);
  }

  if (!pack.length && paper.abstract) {
    add("fallback_context", "Abstract", paper.abstract);
  }

  const ordered = evidenceOrder === "gold-first"
    ? pack
    : [...pack].sort((a, b) => stableHash(`${question}:${a.text}`) - stableHash(`${question}:${b.text}`));

  return ordered.map((item, index) => ({
    ...item,
    evidence_id: `E${index + 1}`,
    retrieval_rank: index + 1,
  }));
}

function inferSection(paper, evidence) {
  const evidenceText = cleanText(evidence).slice(0, 80);
  const match = paper.paragraphs.find((paragraph) => paragraph.text.includes(evidenceText));
  return match?.section ?? "Evidence";
}

function renderAnswerText(answer, evidenceIds) {
  const citation = evidenceIds.length ? ` ${evidenceIds.map((id) => `[${id}]`).join(" ")}` : "";
  if (answer.free_form_answer) return `${answer.free_form_answer}${citation}`;
  if (answer.extractive_spans.length) return `${answer.extractive_spans.join("; ")}${citation}`;
  if (answer.yes_no === true) return `Yes.${citation}`;
  if (answer.yes_no === false) return `No.${citation}`;
  return `The evidence supports the answer.${citation}`;
}

function buildClaimTable(answer, evidenceIds, isAbstention) {
  if (isAbstention) {
    return [{
      claim: "Evidence is insufficient to answer.",
      support: "abstention",
      citations: [],
    }];
  }

  const claim = answer.free_form_answer
    || answer.extractive_spans.join("; ")
    || (answer.yes_no === true ? "Yes" : answer.yes_no === false ? "No" : "Answer supported by evidence.");

  return [{
    claim,
    support: "supported",
    citations: evidenceIds,
  }];
}

function abstentionReason(answer) {
  if (answer.unanswerable) return "QASPER annotator marked the question unanswerable from the paper.";
  return "The selected source answer did not include gold evidence spans, so the training example is safer as an insufficiency case.";
}

async function fetchRows(split, length) {
  const url = new URL("https://datasets-server.huggingface.co/rows");
  url.searchParams.set("dataset", dataset);
  url.searchParams.set("config", config);
  url.searchParams.set("split", split);
  url.searchParams.set("offset", "0");
  url.searchParams.set("length", String(length));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Hugging Face Dataset Viewer request failed for ${split}: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  return (payload.rows ?? []).map((entry) => entry.row);
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function renderDataCard(data) {
  const splitRows = Object.entries(data.splits)
    .map(([split, stats]) => `| ${split} | ${stats.rows_read} | ${stats.examples_written} | ${stats.answerable_examples} | ${stats.abstention_examples} |`)
    .join("\n");

  return `# Grounded QA Distillation Data Card

Generated: ${data.generated_at}

## Source

- Hugging Face dataset: [${data.source_dataset}](https://huggingface.co/datasets/${data.source_dataset})
- Config: \`${data.source_config}\`
- Domain: NLP research papers
- License: CC BY 4.0 per the Hugging Face dataset card

QASPER is a useful seed corpus for amortized grounded research because each record contains a paper-shaped knowledge-base entry, user-style questions, annotator answers, answer evidence, and unanswerable supervision.

## Project Shape

This corpus tests whether expensive multi-step RAG behavior can be distilled into cheaper inference. The teacher scaffold is: retrieve compact paper evidence, decide sufficiency, answer with inline citations, and produce a claim table that a verifier can audit.

The model-facing evidence pack does not expose teacher evidence roles or guaranteed gold-first ordering. Teacher-only roles are retained under \`teacher_trace.evidence_roles\` for evaluation.

## Output Schema

Each JSONL row contains:

- \`input.question\`
- \`input.compact_retrieved_evidence_pack[]\` with stable evidence ids
- \`input.document_metadata\` with paper id, title, abstract, domain, source dataset, and KB version
- \`output.answer\` with bracketed citations
- \`output.citations[]\`
- \`output.claim_table[]\`
- \`output.abstention_reason\` when evidence is insufficient

## Splits

| Split | Source rows read | Examples | Answerable | Abstentions |
| --- | ---: | ---: | ---: | ---: |
${splitRows}

## Evaluation Plan

Use held-out QASPER validation/test examples to compare:

1. Full multi-step RAG teacher: retrieval plus larger model answer generation.
2. Distilled scaffold: compact evidence pack plus smaller model.
3. Cheap abstention baseline: answer only when lexical overlap with evidence is high.

Primary metrics should be citation precision, answer support rate, abstention calibration, and estimated inference cost per accepted answer.
`;
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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
