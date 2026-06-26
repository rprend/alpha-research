import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "extended_temporal_future_holdout";
const offset = numberArg(args.offset, 0, { allowZero: true });
const limit = numberArg(args.limit, 160);
const runId = args["run-id"] ?? `failure-analysis-${split}-${offset}-${offset + limit}-v1`;
const outputDir = path.join(runDir, runId);
const policyArgs = listArg(args.policies);
const policies = policyArgs.length ? policyArgs.map(parsePolicy) : [
  parsePolicy("direct:citation-contract-repair-direct-mini-extended-future-holdout-0-80-v1+citation-contract-repair-direct-mini-extended-future-holdout-80-160-v1:openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-0-80-v1+openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-80-160-v1"),
  parsePolicy("claim_pruned_rubric:citation-contract-repair-claim-pruned-rubric-extended-future-holdout-0-80-v1+citation-contract-repair-claim-pruned-rubric-extended-future-holdout-80-160-v1:openai-judge-gpt4o-citation-contract-repair-claim-pruned-rubric-extended-future-holdout-0-80-v1+openai-judge-gpt4o-citation-contract-repair-claim-pruned-rubric-extended-future-holdout-80-160-v1"),
];

await fs.mkdir(outputDir, { recursive: true });

const references = (await readJsonl(path.join(dataDir, `${split}.jsonl`))).slice(offset, offset + limit);
const referenceById = new Map(references.map((row) => [row.example_id, row]));
const loadedPolicies = [];
for (const policy of policies) {
  loadedPolicies.push({
    name: policy.name,
    predictions: await loadPredictionRuns(policy.predictionRuns, referenceById),
    judgments: await loadJudgmentRuns(policy.judgeRuns, referenceById),
  });
}

const rows = references.map((reference, index) => {
  const candidates = Object.fromEntries(loadedPolicies.map((policy) => {
    const predictionRow = policy.predictions.get(reference.example_id);
    const judgmentRow = policy.judgments.get(reference.example_id);
    const prediction = normalizePrediction(predictionRow?.prediction ?? {});
    const judgeCorrect = judgedCorrect(judgmentRow);
    return [policy.name, {
      answer_type: prediction.answer_type,
      answered: prediction.answer_type === "grounded_answer",
      judged_correct: judgeCorrect,
      judgment_verdict: judgmentRow?.judgment?.verdict ?? null,
      all_claims_supported: judgmentRow?.judgment?.all_claims_supported ?? null,
      abstention_supported: judgmentRow?.judgment?.abstention_supported ?? null,
      citation_ids_valid: judgmentRow?.judgment?.citation_ids_valid ?? null,
      unsupported_claims: judgmentRow?.judgment?.unsupported_claims ?? [],
      missing_citations: judgmentRow?.judgment?.missing_citations ?? [],
      answer_type_correct: prediction.answer_type === reference.output.answer_type,
      citations: prediction.citations,
      answer: prediction.answer,
    }];
  }));
  return {
    index: offset + index,
    example_id: reference.example_id,
    question: reference.input.question,
    reference_answer_type: reference.output.answer_type,
    reference_citations: (reference.output.citations ?? []).map((citation) => citation.evidence_id),
    evidence_ids: reference.input.compact_retrieved_evidence_pack.map((evidence) => evidence.evidence_id),
    candidates,
    category: categorize(reference, candidates),
  };
});

const summary = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  offset,
  limit,
  policies: policies.map((policy) => ({
    name: policy.name,
    prediction_runs: policy.predictionRuns,
    judge_runs: policy.judgeRuns,
  })),
  cost: {
    llm_calls: 0,
    run_cost_usd: 0,
    note: "Failure analysis reads existing prediction and judge artifacts only.",
  },
  metrics: summarize(rows, policies.map((policy) => policy.name)),
  category_counts: groupCount(rows.map((row) => row.category)),
  examples: {
    both_correct: sample(rows, "both_correct"),
    direct_only_correct: sample(rows, "direct_only_correct"),
    rubric_only_correct: sample(rows, "rubric_only_correct"),
    both_wrong_answerable: sample(rows, "both_wrong_answerable"),
    both_wrong_abstention_target: sample(rows, "both_wrong_abstention_target"),
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(summary, null, 2)}\n`);
await writeJsonl(path.join(outputDir, "rows.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(summary));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  metrics: summary.metrics,
  category_counts: summary.category_counts,
}, null, 2));

function categorize(reference, candidates) {
  const values = Object.values(candidates);
  const correct = values.filter((candidate) => candidate.judged_correct);
  if (correct.length === values.length) return "both_correct";
  if (correct.length === 0 && reference.output.answer_type === "grounded_answer") return "both_wrong_answerable";
  if (correct.length === 0 && reference.output.answer_type === "abstain") return "both_wrong_abstention_target";
  const direct = candidates.direct;
  const rubric = candidates.claim_pruned_rubric;
  if (direct?.judged_correct && !rubric?.judged_correct) return "direct_only_correct";
  if (rubric?.judged_correct && !direct?.judged_correct) return "rubric_only_correct";
  return "mixed";
}

function summarize(rows, policyNames) {
  return Object.fromEntries(policyNames.map((policyName) => {
    const candidates = rows.map((row) => row.candidates[policyName]).filter(Boolean);
    const answered = candidates.filter((candidate) => candidate.answered);
    const answerSupport = answered.length
      ? answered.filter((candidate) => candidate.judged_correct).length / answered.length
      : 0;
    return [policyName, {
      examples: candidates.length,
      answered: answered.length,
      judged_correct_rate: mean(candidates.map((candidate) => candidate.judged_correct)),
      answer_support_rate: answerSupport,
      answer_type_accuracy: mean(candidates.map((candidate) => candidate.answer_type_correct)),
      unsupported_answer_count: answered.filter((candidate) => !candidate.judged_correct).length,
      wrong_abstention_count: candidates.filter((candidate) => !candidate.answered && !candidate.judged_correct).length,
    }];
  }));
}

function sample(rows, category) {
  return rows
    .filter((row) => row.category === category)
    .slice(0, 5)
    .map((row) => ({
      index: row.index,
      example_id: row.example_id,
      question: row.question,
      reference_answer_type: row.reference_answer_type,
      direct_verdict: row.candidates.direct?.judgment_verdict ?? null,
      rubric_verdict: row.candidates.claim_pruned_rubric?.judgment_verdict ?? null,
    }));
}

async function loadPredictionRuns(runIds, referenceById) {
  const map = new Map();
  for (const runId of runIds) {
    const rows = await readJsonl(path.join(runDir, runId, "predictions.jsonl"));
    for (const row of rows) {
      if (referenceById.has(row.example_id)) map.set(row.example_id, row);
    }
  }
  return map;
}

async function loadJudgmentRuns(runIds, referenceById) {
  const map = new Map();
  for (const runId of runIds) {
    const rows = await readJsonl(path.join(runDir, runId, "judgments.jsonl"));
    for (const row of rows) {
      if (referenceById.has(row.example_id)) map.set(row.example_id, row);
    }
  }
  return map;
}

function judgedCorrect(row) {
  const judgment = row?.judgment ?? {};
  if (row?.prediction_answer_type === "grounded_answer") {
    return judgment.verdict === "supported"
      && judgment.all_claims_supported === true
      && judgment.citation_ids_valid === true;
  }
  if (row?.prediction_answer_type === "abstain") {
    return judgment.verdict === "correct_abstention"
      && judgment.abstention_supported === true;
  }
  return false;
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : [...new Set(citations)],
  };
}

function parsePolicy(value) {
  const [name, predictionPart, judgePart] = value.split(":");
  if (!name || !predictionPart || !judgePart) {
    throw new Error(`Invalid policy spec: ${value}. Expected name:predictionRun(+...):judgeRun(+...).`);
  }
  return {
    name,
    predictionRuns: predictionPart.split("+").filter(Boolean),
    judgeRuns: judgePart.split("+").filter(Boolean),
  };
}

function renderReport(summary) {
  const policyRows = Object.entries(summary.metrics).map(([policy, metrics]) => (
    `| ${policy} | ${metrics.examples} | ${metrics.answered} | ${pct(metrics.judged_correct_rate)} | ${pct(metrics.answer_support_rate)} | ${pct(metrics.answer_type_accuracy)} | ${metrics.unsupported_answer_count} | ${metrics.wrong_abstention_count} |`
  )).join("\n");
  const categories = Object.entries(summary.category_counts)
    .map(([category, count]) => `- ${category}: ${count}`)
    .join("\n");
  return `# Grounded QA Failure Analysis

## Setup

- Split: \`${summary.split}\`
- Window: ${summary.offset}-${summary.offset + summary.limit}
- LLM calls: ${summary.cost.llm_calls}
- Run cost: $${summary.cost.run_cost_usd.toFixed(7)}

## Policy Metrics

| Policy | Examples | Answered | Judged correct | Answer support | Answer-type acc. | Unsupported answers | Wrong abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${policyRows}

## Pairwise Categories

${categories}

## Interpretation

This diagnostic measures whether the current candidate pool has routing headroom. Rows where both policies are wrong require a materially different candidate or better evidence acquisition; rows where exactly one policy is correct are the only immediate selector headroom.
`;
}

function numberArg(value, fallback, options = {}) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (options.allowZero ? parsed < 0 : parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function listArg(value) {
  if (!value) return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function groupCount(values) {
  const out = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort());
}

function mean(values) {
  const numeric = values.filter((value) => value != null).map((value) => Number(value));
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : 0;
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
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
