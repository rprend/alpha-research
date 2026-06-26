import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "temporal_test";
const evalOffset = numberArg(args["eval-offset"], 132, { allowZero: true });
const evalLimit = numberArg(args["eval-limit"], 40);
const runId = args["run-id"] ?? `policy-selector-${split}-${evalOffset}-v1`;
const outputDir = path.join(runDir, runId);

const policyRuns = {
  direct: {
    predictionRun: args["direct-run"] ?? "openai-student-temporal-test-full-v1",
    judgeRun: args["direct-judge-run"] ?? "openai-judge-student-temporal-test-full-v1",
  },
  strict_rubric: {
    predictionRun: args["strict-run"] ?? "openai-student-teacher-rubric-temporal-test-132-172-v1",
    judgeRun: args["strict-judge-run"] ?? "openai-judge-student-teacher-rubric-temporal-test-132-172-v1",
  },
  balanced_rubric: {
    predictionRun: args["balanced-run"] ?? "openai-student-teacher-balanced-rubric-temporal-test-132-172-v1",
    judgeRun: args["balanced-judge-run"] ?? "openai-judge-student-teacher-balanced-rubric-temporal-test-132-172-v1",
  },
  citation_repair: {
    predictionRun: args["repair-run"] ?? "citation-contract-repair-direct-mini-temporal-test-132-172-v1",
    judgeRun: args["repair-judge-run"] ?? "openai-judge-citation-contract-repair-direct-mini-temporal-test-132-172-v1",
  },
};

await fs.mkdir(outputDir, { recursive: true });

const references = (await readJsonl(path.join(dataDir, `${split}.jsonl`))).slice(evalOffset, evalOffset + evalLimit);
const referenceIds = new Set(references.map((row) => row.example_id));
const referencesById = new Map(references.map((row) => [row.example_id, row]));
const policies = {};
for (const [name, config] of Object.entries(policyRuns)) {
  policies[name] = {
    config,
    predictions: await loadPredictions(config.predictionRun, referenceIds),
    judgments: await loadJudgments(config.judgeRun, referenceIds),
  };
}

const rows = references.map((reference) => {
  const candidates = Object.fromEntries(Object.entries(policies).map(([name, policy]) => {
    const predictionRow = policy.predictions.get(reference.example_id);
    const judgmentRow = policy.judgments.get(reference.example_id);
    const prediction = normalizePrediction(predictionRow?.prediction ?? {});
    return [name, {
      policy: name,
      prediction,
      prediction_run: policy.config.predictionRun,
      judge_run: policy.config.judgeRun,
      judgment: judgmentRow?.judgment ?? null,
      judged_correct: judgedCorrect(judgmentRow),
      inline_complete: inlineComplete(prediction),
      answered: prediction.answer_type === "grounded_answer",
      score: scorePrediction(reference, prediction),
    }];
  }));
  const selected = selectPolicy(candidates);
  return {
    example_id: reference.example_id,
    selected_policy: selected.policy,
    prediction: selected.prediction,
    reference: {
      answer_type: reference.output.answer_type,
      answer: reference.output.answer,
      citations: (reference.output.citations ?? []).map((citation) => citation.evidence_id),
    },
    scores: selected.score,
    inherited_judgment: selected.judgment,
    inherited_judged_correct: selected.judged_correct,
    candidate_summary: Object.fromEntries(Object.entries(candidates).map(([name, candidate]) => [name, {
      answered: candidate.answered,
      inline_complete: candidate.inline_complete,
      judged_correct: candidate.judged_correct,
      answer_type_correct: candidate.score.answer_type_correct,
      citation_precision: candidate.score.citation_precision,
      citation_recall: candidate.score.citation_recall,
    }])),
  };
});

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  eval_offset: evalOffset,
  eval_examples: references.length,
  policy_runs: policyRuns,
  selector: {
    type: "deterministic_policy_router",
    rules: [
      "If direct mini answers and all cited ids appear inline, choose direct mini.",
      "If direct mini answers but violates inline citation contract, choose balanced rubric when it answers with complete inline citations.",
      "If direct mini abstains, choose balanced rubric when it answers with complete inline citations.",
      "Otherwise choose strict rubric when it answers with complete inline citations.",
      "Otherwise choose citation contract repair.",
    ],
  },
  cost: {
    llm_calls: 0,
    run_cost_usd: 0,
    note: "Selector reuses already-generated component predictions and inherited judge labels; no new model calls.",
  },
  metrics: summarize(rows),
  policy_mix: Object.fromEntries(Object.entries(groupCount(rows.map((row) => row.selected_policy))).sort()),
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  metrics: result.metrics,
  policy_mix: result.policy_mix,
}, null, 2));

function selectPolicy(candidates) {
  const direct = candidates.direct;
  if (direct.answered && direct.inline_complete) return direct;
  const balanced = candidates.balanced_rubric;
  if (balanced.answered && balanced.inline_complete) return balanced;
  const strict = candidates.strict_rubric;
  if (strict.answered && strict.inline_complete) return strict;
  return candidates.citation_repair;
}

async function loadPredictions(runId, referenceIds) {
  const rows = await readJsonl(path.join(runDir, runId, "predictions.jsonl"));
  return new Map(rows.filter((row) => referenceIds.has(row.example_id)).map((row) => [row.example_id, row]));
}

async function loadJudgments(runId, referenceIds) {
  const rows = await readJsonl(path.join(runDir, runId, "judgments.jsonl"));
  return new Map(rows.filter((row) => referenceIds.has(row.example_id)).map((row) => [row.example_id, row]));
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

function inlineComplete(prediction) {
  if (prediction.answer_type !== "grounded_answer") return true;
  return prediction.citations.length > 0
    && prediction.citations.every((id) => prediction.answer.includes(`[${id}]`));
}

function scorePrediction(reference, prediction) {
  const referenceCitations = new Set((reference.output.citations ?? []).map((citation) => citation.evidence_id));
  const citedGold = prediction.citations.filter((id) => reference.teacher_trace.evidence_roles[id] === "gold_evidence").length;
  const answerable = reference.output.answer_type !== "abstain";
  const abstained = prediction.answer_type === "abstain";
  return {
    answer_type_correct: prediction.answer_type === reference.output.answer_type,
    citation_precision: prediction.citations.length ? citedGold / prediction.citations.length : null,
    citation_recall: referenceCitations.size
      ? prediction.citations.filter((id) => referenceCitations.has(id)).length / referenceCitations.size
      : null,
    answer_token_f1: answerable ? (!abstained ? tokenF1(prediction.answer, stripCitations(reference.output.answer)) : 0) : null,
    abstention_correct: answerable ? !abstained : abstained,
    inline_citation_rate: prediction.answer_type === "grounded_answer"
      ? (prediction.citations.length ? prediction.citations.filter((id) => prediction.answer.includes(`[${id}]`)).length / prediction.citations.length : 0)
      : null,
  };
}

function summarize(rows) {
  return {
    examples: rows.length,
    answered: rows.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstained: rows.filter((row) => row.prediction.answer_type === "abstain").length,
    answer_type_accuracy: mean(rows.map((row) => row.scores.answer_type_correct)),
    citation_precision: mean(rows.map((row) => row.scores.citation_precision)),
    citation_recall: mean(rows.map((row) => row.scores.citation_recall)),
    answer_token_f1: mean(rows.map((row) => row.scores.answer_token_f1)),
    abstention_accuracy: mean(rows.map((row) => row.scores.abstention_correct)),
    inline_citation_rate: mean(rows.map((row) => row.scores.inline_citation_rate)),
    inherited_judged_correct_rate: mean(rows.map((row) => row.inherited_judged_correct)),
  };
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
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? "") : null,
  };
}

function renderReport(result) {
  return `# Policy Selector

## Setup

- Split: \`${result.split}\`
- Eval offset: ${result.eval_offset}
- Eval examples: ${result.eval_examples}
- LLM calls: ${result.cost.llm_calls}
- Run cost: $${result.cost.run_cost_usd.toFixed(7)}

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | Inherited judged correct |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.metrics.examples} | ${result.metrics.answered} | ${pct(result.metrics.answer_type_accuracy)} | ${pct(result.metrics.citation_precision)} | ${pct(result.metrics.citation_recall)} | ${pct(result.metrics.answer_token_f1)} | ${pct(result.metrics.inline_citation_rate)} | ${pct(result.metrics.inherited_judged_correct_rate)} |

## Policy Mix

${Object.entries(result.policy_mix).map(([policy, count]) => `- ${policy}: ${count}`).join("\n")}

This selector is an analysis scaffold over already-judged component predictions. It does not make fresh model calls and should be treated as a routing upper-bound/control until validated on a separate slice.
`;
}

function tokenF1(prediction, reference) {
  const predicted = contentTokens(stripCitations(prediction));
  const gold = contentTokens(reference);
  if (!predicted.length && !gold.length) return 1;
  if (!predicted.length || !gold.length) return 0;
  const goldCounts = counts(gold);
  let overlap = 0;
  for (const token of predicted) {
    const count = goldCounts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      goldCounts.set(token, count - 1);
    }
  }
  if (!overlap) return 0;
  const precision = overlap / predicted.length;
  const recall = overlap / gold.length;
  return (2 * precision * recall) / (precision + recall);
}

function contentTokens(value) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why"]);
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stop.has(token));
}

function stripCitations(value) {
  return String(value).replace(/\s*\[[^\]]+\]/g, "").trim();
}

function counts(tokens) {
  const map = new Map();
  for (const token of tokens) map.set(token, (map.get(token) ?? 0) + 1);
  return map;
}

function mean(values) {
  const numeric = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number);
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : 0;
}

function groupCount(values) {
  const out = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
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

function numberArg(value, fallback, options = {}) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (options.allowZero ? parsed < 0 : parsed <= 0) return fallback;
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
