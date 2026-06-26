import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const exportDir = path.join(experimentDir, "exports");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const labelPrefix = args["label-prefix"] ?? "judge-support-direct-repair-future-holdout-0-320-v1";
const split = args.split ?? "extended_temporal_future_holdout";
const runId = args["run-id"] ?? "support-contrast-prep-judge-support-direct-repair-0-320-to-321-389-v1";
const trainWindows = parseWindowList(args["train-windows"] ?? "0-240");
const validationWindows = parseWindowList(args["validation-windows"] ?? "240-320");
const evalWindow = parseWindow(args["eval-window"] ?? "320-389");
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const referencesById = new Map(references.map((row, index) => [row.example_id, { row, offset: index }]));
const evalRows = references.slice(evalWindow.start, evalWindow.end).map(toEvalPromptRow);
const evalPapers = new Set(evalRows.map((row) => row.input.document_metadata.paper_id));
const acceptedRaw = await readJsonl(path.join(exportDir, `${labelPrefix}.sft.jsonl`));
const rejectedRaw = await readJsonl(path.join(exportDir, `${labelPrefix}.rejected.jsonl`));

const accepted = acceptedRaw.map((row) => enrichRow(row, referencesById)).filter(Boolean);
const rejected = rejectedRaw.map((row) => enrichRow(row, referencesById)).filter(Boolean);
const candidateRows = [...accepted, ...rejected];
const trainCandidate = candidateRows.filter((row) => inAnyWindow(row.source_window, trainWindows));
const validationCandidate = candidateRows.filter((row) => inAnyWindow(row.source_window, validationWindows));
const leakedTrainPapers = trainCandidate.filter((row) => evalPapers.has(row.input.document_metadata.paper_id));
const leakedValidationPapers = validationCandidate.filter((row) => evalPapers.has(row.input.document_metadata.paper_id));

const trainAccepted = accepted
  .filter((row) => inAnyWindow(row.source_window, trainWindows))
  .filter((row) => !evalPapers.has(row.input.document_metadata.paper_id));
const validationAccepted = accepted
  .filter((row) => inAnyWindow(row.source_window, validationWindows))
  .filter((row) => !evalPapers.has(row.input.document_metadata.paper_id));
const trainRejected = rejected
  .filter((row) => inAnyWindow(row.source_window, trainWindows))
  .filter((row) => !evalPapers.has(row.input.document_metadata.paper_id));
const validationRejected = rejected
  .filter((row) => inAnyWindow(row.source_window, validationWindows))
  .filter((row) => !evalPapers.has(row.input.document_metadata.paper_id));

const trainSftRows = trainAccepted.map(toSftRow);
const validationSftRows = validationAccepted.map(toSftRow);
const trainPreferenceRows = trainRejected.map(toPreferenceRow);
const validationPreferenceRows = validationRejected.map(toPreferenceRow);

const summary = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  label_prefix: labelPrefix,
  split,
  train_windows: trainWindows,
  validation_windows: validationWindows,
  eval_window: evalWindow,
  eval_examples_label: `${evalWindow.start + 1}-${evalWindow.end}`,
  source_counts: {
    accepted: acceptedRaw.length,
    rejected: rejectedRaw.length,
    enriched_accepted: accepted.length,
    enriched_rejected: rejected.length,
  },
  examples: {
    sft_train: trainSftRows.length,
    sft_validation: validationSftRows.length,
    preference_train: trainPreferenceRows.length,
    preference_validation: validationPreferenceRows.length,
    eval_prompts: evalRows.length,
    abstain_chosen_preferences: trainPreferenceRows.length + validationPreferenceRows.length,
  },
  leakage_checks: {
    eval_papers: evalPapers.size,
    train_candidate_rows_sharing_eval_papers: leakedTrainPapers.length,
    validation_candidate_rows_sharing_eval_papers: leakedValidationPapers.length,
    train_rows_after_exclusion: trainSftRows.length + trainPreferenceRows.length,
    validation_rows_after_exclusion: validationSftRows.length + validationPreferenceRows.length,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    note: "This packet reuses existing judged labels and makes no OpenAI API calls.",
  },
  artifacts: {
    sft_train_jsonl: rel(path.join(outputDir, "sft_train.jsonl")),
    sft_validation_jsonl: rel(path.join(outputDir, "sft_validation.jsonl")),
    preference_train_jsonl: rel(path.join(outputDir, "preference_train.jsonl")),
    preference_validation_jsonl: rel(path.join(outputDir, "preference_validation.jsonl")),
    eval_prompts_jsonl: rel(path.join(outputDir, "eval_prompts.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "sft_train.jsonl"), trainSftRows);
await writeJsonl(path.join(outputDir, "sft_validation.jsonl"), validationSftRows);
await writeJsonl(path.join(outputDir, "preference_train.jsonl"), trainPreferenceRows);
await writeJsonl(path.join(outputDir, "preference_validation.jsonl"), validationPreferenceRows);
await writeJsonl(path.join(outputDir, "eval_prompts.jsonl"), evalRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(summary));

console.log(JSON.stringify(summary, null, 2));

function enrichRow(row, referencesById) {
  const reference = referencesById.get(row.example_id);
  const sourceWindow = inferSourceWindow(row.source_prediction_run);
  if (!reference || !sourceWindow) return null;
  return {
    ...row,
    input: row.input ?? reference.row.input,
    source_window: sourceWindow,
    source_offset: reference.offset,
  };
}

function inferSourceWindow(runId) {
  const match = String(runId ?? "").match(/future-holdout-(\d+)-(\d+)-v\d+$/);
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]) };
}

function toSftRow(row) {
  return {
    example_id: row.example_id,
    split,
    source_prediction_run: row.source_prediction_run,
    source_judge_run: row.source_judge_run,
    source_window: row.source_window,
    task: "citation_grounded_domain_qa_sft",
    messages: promptMessages(row.input).concat({
      role: "assistant",
      content: JSON.stringify(normalizeOutput(row.teacher_output)),
    }),
    input: row.input,
    target: normalizeOutput(row.teacher_output),
    label_source: {
      type: "gpt4o_supported_answer",
      prefix: labelPrefix,
      judge: row.judge,
    },
  };
}

function toPreferenceRow(row) {
  const rejected = normalizeOutput(row.teacher_output);
  const chosen = abstentionOutput(row);
  return {
    example_id: row.example_id,
    split,
    source_prediction_run: row.source_prediction_run,
    source_judge_run: row.source_judge_run,
    source_window: row.source_window,
    task: "citation_grounded_domain_qa_support_preference",
    messages: promptMessages(row.input),
    input: row.input,
    chosen,
    rejected,
    chosen_messages: promptMessages(row.input).concat({ role: "assistant", content: JSON.stringify(chosen) }),
    rejected_messages: promptMessages(row.input).concat({ role: "assistant", content: JSON.stringify(rejected) }),
    label_source: {
      type: "gpt4o_unsupported_answer_contrast",
      prefix: labelPrefix,
      judge: row.judge,
      rejection_reason: row.rejection_reason,
      chosen_policy: "abstain_when_existing_judge_rejects_answer_support",
    },
  };
}

function toEvalPromptRow(row) {
  return {
    example_id: row.example_id,
    split,
    messages: promptMessages(row.input),
    input: row.input,
    reference: row.output,
  };
}

function promptMessages(input) {
  return [
    {
      role: "system",
      content: "Answer using only the compact evidence pack. Return valid JSON only with keys answer_type, answer, citations, claim_table, and abstention_reason. Cite every factual claim inline with bracketed evidence ids like [E2]. Abstain when evidence is insufficient.",
    },
    {
      role: "user",
      content: formatInput(input),
    },
  ];
}

function formatInput(input) {
  const metadata = input.document_metadata ?? {};
  const lines = [
    `Question: ${input.question ?? ""}`,
    `Paper title: ${metadata.title ?? ""}`,
    `Paper id: ${metadata.paper_id ?? ""}`,
    `Date: ${metadata.inferred_publication_date ?? metadata.inferred_publication_month ?? ""}`,
    "Evidence pack:",
  ];
  for (const evidence of input.compact_retrieved_evidence_pack ?? []) {
    lines.push(`[${evidence.evidence_id}] ${evidence.section ?? "unknown section"}: ${evidence.text ?? ""}`);
  }
  return lines.join("\n");
}

function normalizeOutput(value) {
  const answerType = value?.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value?.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(value?.answer ?? ""),
    citations,
    claim_table: Array.isArray(value?.claim_table) ? value.claim_table : [],
    abstention_reason: value?.abstention_reason ? String(value.abstention_reason) : "",
  };
}

function abstentionOutput(row) {
  return {
    answer_type: "abstain",
    answer: "The evidence pack is insufficient to answer this question without adding unsupported claims.",
    citations: [],
    claim_table: [],
    abstention_reason: `Existing answered candidate was rejected by support judge: ${row.rejection_reason ?? "unsupported"}`,
  };
}

function renderReport(summary) {
  return `# Support-Contrast Prep

## Setup

- Run id: \`${summary.run_id}\`
- Label prefix: \`${summary.label_prefix}\`
- Split: \`${summary.split}\`
- Train windows: ${summary.train_windows.map(formatWindow).join(", ")}
- Validation windows: ${summary.validation_windows.map(formatWindow).join(", ")}
- Eval window: ${formatWindow(summary.eval_window)} zero-based offsets (${summary.eval_examples_label} in one-based example numbering)
- OpenAI calls: ${summary.llm_budget.openai_llm_calls}
- OpenAI cost: $${summary.llm_budget.openai_cost_usd.toFixed(7)}

## Outputs

| Artifact | Rows |
| --- | ---: |
| SFT train | ${summary.examples.sft_train} |
| SFT validation | ${summary.examples.sft_validation} |
| Preference train | ${summary.examples.preference_train} |
| Preference validation | ${summary.examples.preference_validation} |
| Eval prompts | ${summary.examples.eval_prompts} |

## Leakage Checks

| Check | Count |
| --- | ---: |
| Eval papers | ${summary.leakage_checks.eval_papers} |
| Train candidate rows sharing eval papers | ${summary.leakage_checks.train_candidate_rows_sharing_eval_papers} |
| Validation candidate rows sharing eval papers | ${summary.leakage_checks.validation_candidate_rows_sharing_eval_papers} |

This packet converts prior-window judged support failures into preference rows: the rejected response is the unsupported answered candidate, while the chosen response is an abstention. It is a training artifact for support-aware SFT/DPO/ORPO-style experiments, not a model result.
`;
}

function parseWindowList(value) {
  return String(value).split(",").map((item) => parseWindow(item.trim())).filter(Boolean);
}

function parseWindow(value) {
  const match = String(value).match(/^(\d+)-(\d+)$/);
  if (!match) throw new Error(`Invalid window ${value}. Expected start-end.`);
  const window = { start: Number(match[1]), end: Number(match[2]) };
  if (window.end <= window.start) throw new Error(`Invalid window ${value}.`);
  return window;
}

function inAnyWindow(source, windows) {
  return windows.some((window) => source.start >= window.start && source.end <= window.end);
}

function formatWindow(window) {
  return `${window.start}-${window.end}`;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : true;
  }
  return parsed;
}
