import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const sourceRunId = args["source-run-id"] ?? "versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2";
const runId = args["run-id"] ?? `versioned-kb-natural-question-eval-${sourceRunId}`;
const outputDir = path.join(runDir, runId);
const sourceDir = path.join(runDir, sourceRunId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const source = await readJson(path.join(sourceDir, "result.json"));
const examples = await readJsonl(path.join(sourceDir, "natural_candidate_examples.jsonl"));

const systems = [
  {
    id: "copy_first_evidence",
    description: "Always answer by copying the first retrieved evidence line with its citation, regardless of snapshot staleness.",
    predict: copyFirstEvidence,
  },
  {
    id: "snapshot_aware_stale_guard",
    description: "Abstain when the requested fact is marked as eval-only but the evidence pack is from the train snapshot; otherwise copy first evidence.",
    predict: snapshotAwareStaleGuard,
  },
  {
    id: "lexical_retriever_snapshot_guard",
    description: "Abstain on stale train-snapshot requests; otherwise pick the evidence line with highest natural-question lexical overlap.",
    predict: lexicalRetrieverSnapshotGuard,
  },
];

const predictions = [];
const summaries = [];

for (const system of systems) {
  const rows = examples.map((example) => {
    const prediction = system.predict(example);
    const scores = score(example, prediction);
    return {
      id: example.id,
      example_type: example.example_type,
      system_id: system.id,
      question: example.input.question,
      prediction,
      target: example.output,
      scores,
    };
  });
  predictions.push(...rows);
  summaries.push({
    id: system.id,
    description: system.description,
    ...aggregate(rows),
  });
}

const naive = summaries.find((row) => row.id === "copy_first_evidence");
const lexical = summaries.find((row) => row.id === "lexical_retriever_snapshot_guard");
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "versioned_kb_natural_question_eval",
  status: "versioned_kb_natural_question_eval_complete",
  purpose: "Evaluate deterministic baselines on the natural-question versioned git-doc KB packet, after removing template prefix leakage.",
  source_run_id: sourceRunId,
  source_generation_status: source.status,
  source_question_metrics: source.aggregate,
  source_snapshot_pair: source.source_snapshot_pair,
  examples_total: examples.length,
  systems: summaries,
  key_result: {
    naive_overanswers_stale_snapshots: naive?.by_type?.stale_snapshot_abstention?.overall_correct_rate < 1,
    lexical_guard_handles_stale_snapshots: lexical?.by_type?.stale_snapshot_abstention?.overall_correct_rate === 1,
    lexical_guard_improves_over_naive: Number(lexical?.overall_correct_rate) > Number(naive?.overall_correct_rate),
    natural_question_surface_preserved: Number(source.aggregate?.template_question_rate) <= 0.1
      && Number(source.aggregate?.prefix_leakage_rate) <= 0.1
      && Number(source.aggregate?.snapshot_label_rate) <= 0.1,
    interpretation: "The natural-question packet preserves the stale-KB failure mode after removing deterministic prefix wording: naive citation-copy still over-answers stale train-snapshot questions, while snapshot-aware abstention is still required.",
  },
  artifacts: {
    predictions_jsonl: path.relative(rootDir, path.join(outputDir, "predictions.jsonl")),
    report_md: path.relative(rootDir, path.join(outputDir, "report.md")),
  },
  claim_boundary: {
    supports_natural_question_diagnostic: true,
    supports_private_enterprise_kb_claim: false,
    supports_final_trained_student_claim: false,
    reason: "This evaluates deterministic baselines over a 30-example git-doc snapshot diagnostic; it is not a private enterprise corpus and not a trained-student result.",
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    external_compute_actual_usd: budget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This evaluator reads the existing natural-question packet and uses deterministic local baselines only.",
  },
};

await fs.writeFile(path.join(outputDir, "predictions.jsonl"), `${predictions.map((row) => JSON.stringify(row)).join("\n")}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({ run_id: result.run_id, status: result.status, systems: result.systems.map(({ id, overall_correct_rate }) => ({ id, overall_correct_rate })) }, null, 2));

function copyFirstEvidence(example) {
  const evidence = example.input.compact_retrieved_evidence_pack[0];
  if (!evidence) return abstain("No retrieved evidence.");
  return answerFromEvidence(evidence, "copied_first_retrieved_evidence");
}

function snapshotAwareStaleGuard(example) {
  if (isStaleTrainRequest(example)) {
    return abstain("The requested fact is absent from the train snapshot evidence pack.");
  }
  return copyFirstEvidence(example);
}

function lexicalRetrieverSnapshotGuard(example) {
  if (isStaleTrainRequest(example)) {
    return abstain("The requested fact is absent from the train snapshot evidence pack.");
  }
  const evidence = bestLexicalEvidence(example) ?? example.input.compact_retrieved_evidence_pack[0];
  if (!evidence) return abstain("No retrieved evidence.");
  return answerFromEvidence(evidence, "natural_question_lexical_overlap");
}

function isStaleTrainRequest(example) {
  return example.input.document_metadata?.snapshot === "train" && Boolean(example.input.document_metadata?.withheld_eval_citation_id);
}

function bestLexicalEvidence(example) {
  const questionTokens = contentTokens(example.input.question);
  let best = null;
  let bestScore = -1;
  for (const evidence of example.input.compact_retrieved_evidence_pack ?? []) {
    const evidenceTokens = contentTokens(evidence.text);
    const overlap = [...questionTokens].filter((token) => evidenceTokens.has(token)).length;
    const score = overlap / Math.max(1, Math.sqrt(questionTokens.size * evidenceTokens.size));
    if (score > bestScore) {
      best = evidence;
      bestScore = score;
    }
  }
  return best;
}

function answerFromEvidence(evidence, support) {
  return {
    answer_type: "grounded_answer",
    answer: `${evidence.text} [${evidence.citation_id}]`,
    citations: [evidence.citation_id],
    abstention_reason: null,
    claim_table: [{
      claim: evidence.text,
      citation_id: evidence.citation_id,
      support,
    }],
  };
}

function abstain(reason) {
  return {
    answer_type: "abstain",
    answer: "Insufficient evidence in this KB snapshot.",
    citations: [],
    abstention_reason: reason,
    claim_table: [],
  };
}

function score(example, prediction) {
  const target = example.output;
  const targetType = target.answer_type;
  const predictedType = prediction.answer_type;
  const targetCitations = new Set(target.citations ?? []);
  const predictedCitations = new Set(prediction.citations ?? []);
  const citationMatches = [...predictedCitations].filter((id) => targetCitations.has(id)).length;
  const targetClaim = target.claim_table?.[0]?.claim ?? stripCitations(target.answer ?? "");
  const answerSupported = predictedType === "grounded_answer"
    && targetType === "grounded_answer"
    && citationMatches > 0
    && normalize(prediction.answer).includes(normalize(targetClaim));
  const abstentionCorrect = targetType === "abstain" ? predictedType === "abstain" : null;
  const overallCorrect = targetType === "abstain" ? predictedType === "abstain" : answerSupported;
  return {
    target_type: targetType,
    predicted_type: predictedType,
    type_correct: targetType === predictedType,
    overall_correct: overallCorrect,
    answer_supported: predictedType === "grounded_answer" ? answerSupported : null,
    abstention_correct: abstentionCorrect,
    citation_precision: predictedType === "grounded_answer" ? ratio(citationMatches, predictedCitations.size) : null,
    citation_recall: targetType === "grounded_answer" ? ratio(citationMatches, targetCitations.size) : null,
    inline_citation_rate: predictedType === "grounded_answer"
      ? ratio([...predictedCitations].filter((id) => prediction.answer.includes(`[${id}]`)).length, predictedCitations.size)
      : null,
  };
}

function aggregate(rows) {
  const byType = {};
  for (const type of [...new Set(rows.map((row) => row.example_type))].sort()) {
    byType[type] = summarize(rows.filter((row) => row.example_type === type));
  }
  return {
    examples: rows.length,
    ...summarize(rows),
    by_type: byType,
  };
}

function summarize(rows) {
  const answered = rows.filter((row) => row.prediction.answer_type === "grounded_answer");
  const abstentionRows = rows.filter((row) => row.scores.abstention_correct !== null);
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: rows.length - answered.length,
    answer_rate: ratio(answered.length, rows.length),
    overall_correct: rows.filter((row) => row.scores.overall_correct).length,
    overall_correct_rate: ratio(rows.filter((row) => row.scores.overall_correct).length, rows.length),
    answer_support_rate: ratio(answered.filter((row) => row.scores.answer_supported).length, answered.length),
    abstention_correct_rate: ratio(abstentionRows.filter((row) => row.scores.abstention_correct).length, abstentionRows.length),
    citation_precision: mean(answered.map((row) => row.scores.citation_precision)),
    citation_recall: mean(rows.map((row) => row.scores.citation_recall)),
    inline_citation_rate: mean(answered.map((row) => row.scores.inline_citation_rate)),
  };
}

function renderReport(result) {
  return `# Versioned KB Natural Question Eval

Generated: ${result.generated_at}

Status: \`${result.status}\`

Source: \`${result.source_run_id}\`

## Naturalness Surface

| Template rate | Prefix leakage | Snapshot-label rate |
| ---: | ---: | ---: |
| ${pct(result.source_question_metrics.template_question_rate)} | ${pct(result.source_question_metrics.prefix_leakage_rate)} | ${pct(result.source_question_metrics.snapshot_label_rate)} |

## Systems

| System | Answer rate | Overall correct | Answer support | Abstention correct | Citation precision | Citation recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${result.systems.map((row) => `| ${row.id} | ${pct(row.answer_rate)} | ${pct(row.overall_correct_rate)} | ${pct(row.answer_support_rate)} | ${pct(row.abstention_correct_rate)} | ${pct(row.citation_precision)} | ${pct(row.citation_recall)} |`).join("\n")}

## Stale Snapshot Slice

| System | Stale examples | Answered | Correct |
| --- | ---: | ---: | ---: |
${result.systems.map((row) => `| ${row.id} | ${row.by_type.stale_snapshot_abstention.examples} | ${row.by_type.stale_snapshot_abstention.answered} | ${pct(row.by_type.stale_snapshot_abstention.overall_correct_rate)} |`).join("\n")}

Interpretation: ${result.key_result.interpretation}

This evaluation makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

function contentTokens(value) {
  const stop = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "does", "for", "from", "how", "in", "is", "it", "of", "on", "or", "the", "this", "to", "what", "with"]);
  return new Set(normalize(value).split(" ").filter((token) => token.length > 2 && !stop.has(token)));
}

function stripCitations(value) {
  return String(value).replace(/\[[^\]]+\]/g, "").trim();
}

function normalize(value) {
  return stripCitations(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function mean(values) {
  const finite = values.filter((value) => Number.isFinite(Number(value)));
  return finite.length ? finite.reduce((total, value) => total + Number(value), 0) / finite.length : null;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
