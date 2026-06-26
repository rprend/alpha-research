import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "extended_temporal_future_holdout";
const gateRunId = args["gate-run"] ?? "support-contrast-gate-direct-repair-0-240-val-240-320-to-321-389-v1";
const sourceRunId = args["source-run"] ?? "citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1";
const judgeRunId = args["judge-run"] ?? `openai-judge-gpt4o-${sourceRunId}`;
const evalOffset = numberArg(args["eval-offset"], 320);
const evalLimit = numberArg(args["eval-limit"], 69);
const runId = args["run-id"] ?? `abstention-support-error-analysis-${gateRunId}`;
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const references = (await readJsonl(path.join(dataDir, `${split}.jsonl`))).slice(evalOffset, evalOffset + evalLimit);
const referencesById = new Map(references.map((row) => [row.example_id, row]));
const gateRows = (await readJsonl(path.join(runDir, gateRunId, "predictions.jsonl")))
  .filter((row) => referencesById.has(row.example_id));
const judgments = await readJsonl(path.join(runDir, judgeRunId, "judgments.jsonl"));
const judgmentsById = new Map(judgments.map((row) => [row.example_id, row.judgment]));

const analyzed = gateRows.map((row) => analyzeRow(row, referencesById.get(row.example_id), judgmentsById.get(row.example_id)));
const groups = groupRows(analyzed);
const summary = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  gate_run_id: gateRunId,
  source_run_id: sourceRunId,
  judge_run_id: judgeRunId,
  eval_offset: evalOffset,
  eval_examples: analyzed.length,
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    note: "This analysis reuses existing predictions and judgments. It makes no OpenAI API calls.",
  },
  counts: {
    source_answered: analyzed.filter((row) => row.source_answered).length,
    source_supported_answers: analyzed.filter((row) => row.source_answered && row.source_answer_supported).length,
    source_unsupported_answers: analyzed.filter((row) => row.source_answered && !row.source_answer_supported).length,
    gate_answered: analyzed.filter((row) => row.gate_answered).length,
    gate_abstained: analyzed.filter((row) => !row.gate_answered).length,
    useful_suppressions: groups.suppressed_unsupported_unanswerable.length,
    unsupported_answerable_suppressions: groups.suppressed_unsupported_answerable.length,
    harmful_suppressions: groups.suppressed_supported_answer.length,
    retained_supported_answers: groups.retained_supported_answer.length,
    retained_unsupported_answers: groups.retained_unsupported_answer.length,
    source_abstentions_on_answerable_rows: groups.source_abstention_on_answerable.length,
    source_abstentions_on_unanswerable_rows: groups.source_abstention_on_unanswerable.length,
  },
  rates: {
    source_answer_support_rate: ratio(
      analyzed.filter((row) => row.source_answered && row.source_answer_supported).length,
      analyzed.filter((row) => row.source_answered).length,
    ),
    gate_retained_answer_support_rate: ratio(groups.retained_supported_answer.length, groups.retained_supported_answer.length + groups.retained_unsupported_answer.length),
    gate_abstention_support_rate: ratio(
      groups.suppressed_unsupported_unanswerable.length + groups.source_abstention_on_unanswerable.length,
      analyzed.filter((row) => !row.gate_answered).length,
    ),
    inherited_overall_correct_rate: ratio(
      groups.retained_supported_answer.length + groups.suppressed_unsupported_unanswerable.length + groups.source_abstention_on_unanswerable.length,
      analyzed.length,
    ),
  },
  error_diagnosis: {
    main_tradeoff: "The gate improves retained-answer support only by converting some answered rows to abstentions; those abstentions are harmful when the reference row is answerable.",
    dominant_remaining_errors: rankErrors(groups),
    next_training_target: "Train or label a joint decision target: keep supported answer, repair unsupported answer, or abstain only when the evidence pack is actually insufficient.",
  },
  artifacts: {
    row_analysis_jsonl: rel(path.join(outputDir, "row_analysis.jsonl")),
    error_groups_json: rel(path.join(outputDir, "error_groups.json")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "row_analysis.jsonl"), analyzed);
await fs.writeFile(path.join(outputDir, "error_groups.json"), `${JSON.stringify(renderGroups(groups), null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(summary, groups));

console.log(JSON.stringify({
  run_id: runId,
  result: rel(path.join(outputDir, "result.json")),
  report: rel(path.join(outputDir, "report.md")),
  counts: summary.counts,
  rates: summary.rates,
}, null, 2));

function analyzeRow(row, reference, judgment) {
  const sourceAnswered = row.source_prediction?.answer_type === "grounded_answer";
  const gateAnswered = row.prediction?.answer_type === "grounded_answer";
  const referenceAnswerable = reference?.output?.answer_type === "grounded_answer";
  const sourceAnswerSupported = sourceAnswered && isSupportedAnswer(judgment);
  const gateFired = Boolean(row.metadata?.gate_fired);
  return {
    example_id: row.example_id,
    paper_id: reference?.input?.document_metadata?.paper_id,
    question: reference?.input?.question,
    reference_answer_type: reference?.output?.answer_type,
    source_answered: sourceAnswered,
    source_answer_supported: sourceAnswerSupported,
    gate_answered: gateAnswered,
    gate_fired: gateFired,
    support_score: row.metadata?.support_score ?? null,
    category: categorize({ sourceAnswered, gateAnswered, sourceAnswerSupported, referenceAnswerable }),
    source_prediction: row.source_prediction,
    gate_prediction: row.prediction,
    judge: judgment,
  };
}

function categorize({ sourceAnswered, gateAnswered, sourceAnswerSupported, referenceAnswerable }) {
  if (sourceAnswered && !gateAnswered && !sourceAnswerSupported && !referenceAnswerable) return "suppressed_unsupported_unanswerable";
  if (sourceAnswered && !gateAnswered && !sourceAnswerSupported && referenceAnswerable) return "suppressed_unsupported_answerable";
  if (sourceAnswered && !gateAnswered && sourceAnswerSupported) return "suppressed_supported_answer";
  if (sourceAnswered && gateAnswered && sourceAnswerSupported) return "retained_supported_answer";
  if (sourceAnswered && gateAnswered && !sourceAnswerSupported) return "retained_unsupported_answer";
  if (!sourceAnswered && !gateAnswered && referenceAnswerable) return "source_abstention_on_answerable";
  if (!sourceAnswered && !gateAnswered && !referenceAnswerable) return "source_abstention_on_unanswerable";
  if (!sourceAnswered && gateAnswered) return "unexpected_gate_answer";
  return "other";
}

function groupRows(rows) {
  const groups = {
    suppressed_unsupported_unanswerable: [],
    suppressed_unsupported_answerable: [],
    suppressed_supported_answer: [],
    retained_supported_answer: [],
    retained_unsupported_answer: [],
    source_abstention_on_answerable: [],
    source_abstention_on_unanswerable: [],
    unexpected_gate_answer: [],
    other: [],
  };
  for (const row of rows) groups[row.category]?.push(row);
  return groups;
}

function rankErrors(groups) {
  return [
    { category: "retained_unsupported_answer", count: groups.retained_unsupported_answer.length, implication: "Need answer repair or stronger answer-support verifier." },
    { category: "suppressed_supported_answer", count: groups.suppressed_supported_answer.length, implication: "Need abstention-support modeling before suppressing." },
    { category: "suppressed_unsupported_answerable", count: groups.suppressed_unsupported_answerable.length, implication: "Need repair/regeneration rather than abstention on answerable rows." },
    { category: "source_abstention_on_answerable", count: groups.source_abstention_on_answerable.length, implication: "Need answer recovery, not more suppression." },
  ].sort((a, b) => b.count - a.count);
}

function renderGroups(groups) {
  return Object.fromEntries(Object.entries(groups).map(([name, rows]) => [
    name,
    rows.map((row) => ({
      example_id: row.example_id,
      paper_id: row.paper_id,
      question: row.question,
      support_score: row.support_score,
      source_answer_supported: row.source_answer_supported,
      reference_answer_type: row.reference_answer_type,
      judge_verdict: row.judge?.verdict ?? null,
    })),
  ]));
}

function renderReport(summary, groups) {
  return `# Abstention-Support Error Analysis

## Setup

- Gate run: \`${summary.gate_run_id}\`
- Source run: \`${summary.source_run_id}\`
- Judge run: \`${summary.judge_run_id}\`
- Eval window: ${summary.eval_offset}-${summary.eval_offset + summary.eval_examples} zero-based offsets
- OpenAI calls: ${summary.llm_budget.openai_llm_calls}
- OpenAI cost: $${summary.llm_budget.openai_cost_usd.toFixed(7)}

## Counts

| Category | Count |
| --- | ---: |
| Source answered | ${summary.counts.source_answered} |
| Source supported answers | ${summary.counts.source_supported_answers} |
| Source unsupported answers | ${summary.counts.source_unsupported_answers} |
| Gate answered | ${summary.counts.gate_answered} |
| Gate abstained | ${summary.counts.gate_abstained} |
| Useful suppressions on unanswerable rows | ${summary.counts.useful_suppressions} |
| Suppressed unsupported answers on answerable rows | ${summary.counts.unsupported_answerable_suppressions} |
| Harmful suppressions | ${summary.counts.harmful_suppressions} |
| Retained unsupported answers | ${summary.counts.retained_unsupported_answers} |
| Source abstentions on answerable rows | ${summary.counts.source_abstentions_on_answerable_rows} |

## Rates

| Metric | Value |
| --- | ---: |
| Source answer support | ${pct(summary.rates.source_answer_support_rate)} |
| Gate retained-answer support | ${pct(summary.rates.gate_retained_answer_support_rate)} |
| Gate abstention support | ${pct(summary.rates.gate_abstention_support_rate)} |
| Inherited overall correct | ${pct(summary.rates.inherited_overall_correct_rate)} |

## Interpretation

The support-contrast gate has three distinct failure families:

1. Retained unsupported answers: ${groups.retained_unsupported_answer.length}
2. Suppressed unsupported answers on answerable rows: ${groups.suppressed_unsupported_answerable.length}
3. Harmful suppressions of supported answers: ${groups.suppressed_supported_answer.length}
4. Source abstentions on answerable rows: ${groups.source_abstention_on_answerable.length}

This means the next system should not be another one-dimensional support threshold. It needs a joint action policy: keep supported answers, repair unsupported answers when evidence is sufficient, and abstain only when the evidence pack is insufficient.
`;
}

function isSupportedAnswer(judgment) {
  return ["supported", "correct"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.all_claims_supported === true;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
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
