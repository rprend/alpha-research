import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const sourceRunId = args["source-run-id"] ?? "versioned-private-kb-prototype-git-docs-2026-06-26-v1";
const runId = args["run-id"] ?? `versioned-private-kb-eval-${sourceRunId}`;
const outputDir = path.join(runDir, runId);
const sourceDir = path.join(runDir, sourceRunId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const source = await readJson(path.join(sourceDir, "result.json"));
const examples = await readJsonl(path.join(sourceDir, "candidate_examples.jsonl"));

const systems = [
  {
    id: "copy_first_evidence",
    description: "Always answer by copying the first retrieved evidence line with its citation, regardless of snapshot staleness.",
    predict: copyFirstEvidence,
  },
  {
    id: "snapshot_aware_stale_guard",
    description: "Abstain when the requested fact is marked as eval-only but the evidence pack is from the train snapshot; otherwise copy cited evidence.",
    predict: snapshotAwareStaleGuard,
  },
  {
    id: "prefix_retriever_snapshot_guard",
    description: "Use the quoted question prefix to select the matching evidence line, and abstain on stale train-snapshot requests.",
    predict: prefixRetrieverSnapshotGuard,
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

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "versioned_private_kb_eval",
  status: "versioned_domain_kb_eval_complete",
  purpose: "Evaluate deterministic baselines on the versioned git-doc KB prototype to expose stale-snapshot over-answering.",
  source_run_id: sourceRunId,
  source_snapshot_pair: source.snapshots,
  examples_total: examples.length,
  systems: summaries,
  key_result: {
    naive_overanswers_stale_snapshots: summaries.find((row) => row.id === "copy_first_evidence")?.by_type?.stale_snapshot_abstention?.overall_correct_rate < 1,
    snapshot_guard_handles_stale_snapshots: summaries.find((row) => row.id === "snapshot_aware_stale_guard")?.by_type?.stale_snapshot_abstention?.overall_correct_rate === 1,
    interpretation: "The versioned prototype surfaces a real stale-KB failure mode: citation syntax is easy, but snapshot-aware abstention is necessary when the requested update is absent from the retrieved snapshot.",
  },
  artifacts: {
    predictions_jsonl: path.relative(rootDir, path.join(outputDir, "predictions.jsonl")),
    report_md: path.relative(rootDir, path.join(outputDir, "report.md")),
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
    note: "This evaluator uses deterministic local baselines over existing JSONL examples.",
  },
};

await fs.writeFile(path.join(outputDir, "predictions.jsonl"), predictions.map((row) => JSON.stringify(row)).join("\n") + "\n");
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({ run_id: result.run_id, status: result.status, systems: result.systems }, null, 2));

function copyFirstEvidence(example) {
  const evidence = example.input.compact_retrieved_evidence_pack[0];
  if (!evidence) return abstain("No retrieved evidence.");
  return {
    answer_type: "grounded_answer",
    answer: `${evidence.text} [${evidence.citation_id}]`,
    citations: [evidence.citation_id],
    abstention_reason: null,
    claim_table: [{
      claim: evidence.text,
      citation_id: evidence.citation_id,
      support: "copied_first_retrieved_evidence",
    }],
  };
}

function snapshotAwareStaleGuard(example) {
  if (example.input.document_metadata?.snapshot === "train" && example.input.document_metadata?.withheld_eval_citation_id) {
    return abstain("The requested fact is marked as eval-only and is absent from the train snapshot evidence pack.");
  }
  return copyFirstEvidence(example);
}

function prefixRetrieverSnapshotGuard(example) {
  if (example.input.document_metadata?.snapshot === "train" && example.input.document_metadata?.withheld_eval_citation_id) {
    return abstain("The requested fact is marked as eval-only and is absent from the train snapshot evidence pack.");
  }
  const prefix = quotedPrefix(example.input.question);
  const match = example.input.compact_retrieved_evidence_pack.find((row) => normalize(row.text).startsWith(normalize(prefix)));
  if (!match) return copyFirstEvidence(example);
  return {
    answer_type: "grounded_answer",
    answer: `${match.text} [${match.citation_id}]`,
    citations: [match.citation_id],
    abstention_reason: null,
    claim_table: [{
      claim: match.text,
      citation_id: match.citation_id,
      support: "question_prefix_match",
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
  const typeCorrect = targetType === predictedType;
  const overallCorrect = targetType === "abstain" ? predictedType === "abstain" : answerSupported;
  return {
    target_type: targetType,
    predicted_type: predictedType,
    type_correct: typeCorrect,
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
  const abstained = rows.filter((row) => row.prediction.answer_type === "abstain");
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, rows.length),
    overall_correct: rows.filter((row) => row.scores.overall_correct).length,
    overall_correct_rate: ratio(rows.filter((row) => row.scores.overall_correct).length, rows.length),
    answer_support_rate: ratio(answered.filter((row) => row.scores.answer_supported).length, answered.length),
    abstention_correct_rate: ratio(rows.filter((row) => row.scores.abstention_correct === true).length, rows.filter((row) => row.scores.abstention_correct !== null).length),
    citation_precision: mean(answered.map((row) => row.scores.citation_precision)),
    citation_recall: mean(rows.map((row) => row.scores.citation_recall)),
    inline_citation_rate: mean(answered.map((row) => row.scores.inline_citation_rate)),
  };
}

function renderReport(result) {
  return `# Versioned Private/Domain KB Eval

Generated: ${result.generated_at}

Status: \`${result.status}\`

Source: \`${result.source_run_id}\`

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

function stripCitations(value) {
  return String(value).replace(/\[[^\]]+\]/g, "").trim();
}

function quotedPrefix(question) {
  const match = String(question).match(/"([^"]+)"/);
  return match ? match[1] : "";
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
