import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model dataset task result results use uses is in on of to a an by as or be can it its we our you your".split(" "));

const repairPacketRunId = args["repair-packet-run-id"] ?? "frontier-full-nonfinal-repair-packet-2026-06-29-v1";
const validationGateRunId = args["validation-gate-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "train-selected-constrained-policy-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const trainRows = await readJsonl(path.join(runsDir, repairPacketRunId, "dataset", "sft_train_repaired_sample.jsonl"));
const validationPrompts = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_prompts.jsonl"));
const validationTargets = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const validationTargetById = new Map(validationTargets.map((row) => [row.example_id, row.target]));

const trainTune = trainRows.slice(0, 160);
const trainHeldout = trainRows.slice(160);
const validationRows = validationPrompts.map((row) => ({
  example_id: row.example_id,
  input: row.input,
  target: validationTargetById.get(row.example_id),
  split: "repaired_validation_gate",
}));

const grid = buildGrid();
const candidates = grid.map((params) => ({
  params,
  tune: evaluateRows(asEvalRows(trainTune, "train_tune"), params),
}));
candidates.sort(compareCandidates);
const selected = candidates[0];
const heldoutMetrics = evaluateRows(asEvalRows(trainHeldout, "train_heldout"), selected.params);
const validationMetrics = evaluateRows(validationRows, selected.params);
const baselineValidation = {
  train_calibrated_scaffold_contract_correct: 44,
  train_calibrated_scaffold_contract_correct_rate: 44 / 70,
  constrained_hybrid_contract_correct: 45,
  constrained_hybrid_contract_correct_rate: 45 / 70,
};

const tunePredictions = predictRows(asEvalRows(trainTune, "train_tune"), selected.params);
const heldoutPredictions = predictRows(asEvalRows(trainHeldout, "train_heldout"), selected.params);
const validationPredictions = predictRows(validationRows, selected.params);

await writeJsonl(path.join(outputDir, "train_tune_predictions.jsonl"), tunePredictions);
await writeJsonl(path.join(outputDir, "train_heldout_predictions.jsonl"), heldoutPredictions);
await writeJsonl(path.join(outputDir, "validation_predictions.jsonl"), validationPredictions);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "train_selected_constrained_policy_audit",
  status: statusFor(validationMetrics, baselineValidation),
  purpose: "Select a schema-constrained answerability/citation policy on repaired train rows and test whether it transfers before any more model or judge spend.",
  source_runs: {
    repair_packet_run_id: repairPacketRunId,
    validation_gate_run_id: validationGateRunId,
  },
  split_policy: {
    train_tune_rows: trainTune.length,
    train_heldout_rows: trainHeldout.length,
    validation_gate_rows: validationRows.length,
    leakage_note: "Hyperparameters are selected only on the first 160 repaired train rows. Train-heldout and repaired-validation metrics are reported as evaluation surfaces.",
  },
  search_space: {
    candidates: candidates.length,
    thresholds: [...new Set(grid.map((row) => row.answer_threshold))],
    evidence_thresholds: [...new Set(grid.map((row) => row.evidence_threshold))],
    max_citations: [...new Set(grid.map((row) => row.max_citations))],
    counterfactual_penalties: [...new Set(grid.map((row) => row.counterfactual_penalty))],
    risk_penalties: [...new Set(grid.map((row) => row.risk_penalty))],
    rank_penalties: [...new Set(grid.map((row) => row.rank_penalty))],
    selection_objective: "Maximize tune contract correctness, then tune answer-type accuracy, then citation exactness, then prefer lower answer rate.",
  },
  selected_policy: selected.params,
  metrics: {
    train_tune: selected.tune,
    train_heldout: heldoutMetrics,
    repaired_validation_gate: validationMetrics,
  },
  baseline_comparison: {
    ...baselineValidation,
    selected_validation_contract_correct: validationMetrics.contract_correct,
    selected_validation_contract_correct_rate: validationMetrics.contract_correct_rate,
    delta_vs_train_calibrated_scaffold: validationMetrics.contract_correct - baselineValidation.train_calibrated_scaffold_contract_correct,
    delta_vs_constrained_hybrid: validationMetrics.contract_correct - baselineValidation.constrained_hybrid_contract_correct,
  },
  decision: {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    promote_as_final_scaffold: false,
    next_step: nextStepFor(validationMetrics, baselineValidation),
    reason: "The policy is train-selected and schema-constrained, but it must clearly beat the existing validation baselines before paid judging or more GPU spend.",
  },
  budget: {
    max_budget_usd: Number(budget.max_budget_usd),
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual),
    remaining_budget_usd: Number(budget.spend_usd?.remaining),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "This audit is deterministic local scoring over existing repaired labels.",
  },
  artifacts: {
    train_tune_predictions_jsonl: rel(path.join(outputDir, "train_tune_predictions.jsonl")),
    train_heldout_predictions_jsonl: rel(path.join(outputDir, "train_heldout_predictions.jsonl")),
    validation_predictions_jsonl: rel(path.join(outputDir, "validation_predictions.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_policy: result.selected_policy,
  metrics: result.metrics,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
}, null, 2));

function buildGrid() {
  const rows = [];
  for (const answer_threshold of [0.42, 0.48, 0.54, 0.6, 0.65, 0.7]) {
    for (const evidence_threshold of [0.16, 0.22, 0.28, 0.34, 0.4]) {
      for (const max_citations of [1, 2, 3]) {
        for (const counterfactual_penalty of [0.2, 0.35, 0.5]) {
          for (const risk_penalty of [0, 0.08, 0.16]) {
            for (const rank_penalty of [0, 0.015, 0.03]) {
              rows.push({ answer_threshold, evidence_threshold, max_citations, counterfactual_penalty, risk_penalty, rank_penalty });
            }
          }
        }
      }
    }
  }
  return rows;
}

function asEvalRows(rows, split) {
  return rows.map((row) => ({
    example_id: row.example_id,
    input: row.input,
    target: row.target,
    split,
  }));
}

function predictRows(rows, params) {
  return rows.map((row) => {
    const prediction = predict(row, params);
    const score = scorePrediction(prediction, row.target);
    return {
      example_id: row.example_id,
      split: row.split,
      prediction,
      raw_output: JSON.stringify(prediction),
      scores: score,
      metadata: {
        scaffold: "train_selected_constrained_policy",
        params,
        no_model_or_llm_calls: true,
      },
    };
  });
}

function evaluateRows(rows, params) {
  const predictions = predictRows(rows, params);
  const answered = predictions.filter((row) => row.prediction.answer_type === "grounded_answer");
  const confusion = countBy(predictions.map((row) => `${row.prediction.answer_type}_vs_${row.scores.target_answer_type}`));
  return {
    examples: predictions.length,
    answered: answered.length,
    abstained: predictions.length - answered.length,
    answer_rate: rate(answered.length, predictions.length),
    answer_type_correct: count(predictions, (row) => row.scores.answer_type_correct),
    answer_type_accuracy: rate(count(predictions, (row) => row.scores.answer_type_correct), predictions.length),
    citation_set_exact: count(predictions, (row) => row.scores.citation_set_exact),
    citation_set_exact_rate: rate(count(predictions, (row) => row.scores.citation_set_exact), predictions.length),
    contract_correct: count(predictions, (row) => row.scores.contract_correct),
    contract_correct_rate: rate(count(predictions, (row) => row.scores.contract_correct), predictions.length),
    confusion,
  };
}

function predict(row, params) {
  const input = row.input;
  const ranked = rankEvidence(input, params);
  const counterfactual = Boolean(input.document_metadata?.counterfactual) || row.example_id.includes(":counterfactual-insufficient");
  const risky = isRiskyQuestion(input.question);
  const answerScore = (ranked[0]?.score ?? 0)
    - (counterfactual ? params.counterfactual_penalty : 0)
    - (risky ? params.risk_penalty : 0);
  const selected = ranked.filter((candidate) => candidate.score >= params.evidence_threshold).slice(0, params.max_citations);
  if (answerScore < params.answer_threshold || !selected.length) {
    return abstain(input.question, `score=${answerScore.toFixed(3)} threshold=${params.answer_threshold}`);
  }
  const citations = selected.map((candidate) => candidate.evidence_id);
  const claims = selected.map((candidate, index) => ({
    claim_id: `C${index + 1}`,
    claim: candidate.sentence,
    citations: [candidate.evidence_id],
    support_status: "supported",
  }));
  return {
    answer_type: "grounded_answer",
    evidence_first: {
      sufficiency: "sufficient",
      supported_claims: claims,
      missing_support: "",
      question_target: input.question ?? "exact_question_target",
    },
    answer: `${selected.map((candidate) => candidate.sentence).join(" ")} ${citations.map((id) => `[${id}]`).join(" ")}`,
    citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function rankEvidence(input, params) {
  const questionTokens = tokenSet(input.question);
  const questionNumbers = numberSet(input.question);
  return (input.compact_retrieved_evidence_pack ?? []).map((evidence, index) => {
    const bestSentence = splitSentences(evidence.text)
      .map((sentence) => {
        const combined = `${evidence.section ?? ""} ${sentence}`;
        const tokens = tokenList(combined);
        const overlap = tokens.filter((token) => questionTokens.has(token)).length;
        const coverage = questionTokens.size ? overlap / questionTokens.size : 0;
        const density = tokens.length ? overlap / tokens.length : 0;
        const numericMatch = [...numberSet(sentence)].some((number) => questionNumbers.has(number)) ? 0.08 : 0;
        const sectionBonus = sectionMatchesQuestion(input.question, evidence.section) ? 0.04 : 0;
        return {
          sentence: cleanSentence(sentence),
          score: coverage + density + numericMatch + sectionBonus - (params.rank_penalty * index),
        };
      })
      .sort((left, right) => right.score - left.score)[0] ?? { sentence: cleanSentence(evidence.text), score: 0 };
    return {
      evidence_id: evidence.evidence_id,
      sentence: bestSentence.sentence,
      score: bestSentence.score,
    };
  }).sort((left, right) => right.score - left.score || left.evidence_id.localeCompare(right.evidence_id));
}

function scorePrediction(prediction, target) {
  const answerTypeCorrect = prediction.answer_type === target?.answer_type;
  const citationSetExact = prediction.answer_type === "abstain"
    ? (prediction.citations ?? []).length === 0
    : sameCitationSet(prediction.citations, target?.citations ?? []);
  return {
    target_answer_type: target?.answer_type,
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    contract_correct: answerTypeCorrect && citationSetExact,
  };
}

function abstain(question, reason) {
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: `Constrained policy did not find enough direct support for ${question ?? "the question"} (${reason}).`,
      question_target: question ?? "exact_question_target",
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The constrained policy did not find enough calibrated support in the evidence pack.",
  };
}

function compareCandidates(left, right) {
  for (const key of ["contract_correct_rate", "answer_type_accuracy", "citation_set_exact_rate"]) {
    const delta = Number(right.tune[key]) - Number(left.tune[key]);
    if (Math.abs(delta) > 1e-12) return delta;
  }
  return left.tune.answer_rate - right.tune.answer_rate;
}

function statusFor(validationMetrics, baseline) {
  if (validationMetrics.contract_correct > baseline.constrained_hybrid_contract_correct) {
    return "train_selected_constrained_policy_beats_existing_validation_baselines";
  }
  if (validationMetrics.contract_correct > baseline.train_calibrated_scaffold_contract_correct) {
    return "train_selected_constrained_policy_beats_scaffold_not_hybrid";
  }
  return "train_selected_constrained_policy_does_not_beat_existing_validation_baselines";
}

function nextStepFor(validationMetrics, baseline) {
  if (validationMetrics.contract_correct > baseline.constrained_hybrid_contract_correct) {
    return "Build a fresh heldout packet and consider low-cost judging only after the policy beats baselines without validation tuning.";
  }
  return "Do not spend on judging or GPU. The constrained train-selected policy is not yet stronger than existing validation baselines.";
}

function isRiskyQuestion(question) {
  return /\b(percentage|how many|how much|statistically significant|which are three|compare|difference|ratio)\b/i.test(question ?? "");
}

function sectionMatchesQuestion(question, section) {
  const questionText = String(question ?? "").toLowerCase();
  const sectionText = String(section ?? "").toLowerCase();
  return sectionText && questionText.split(/\W+/).some((token) => token.length > 4 && sectionText.includes(token));
}

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean).slice(0, 6);
}

function cleanSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function tokenList(text) {
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stopwords.has(token));
}

function tokenSet(text) {
  return new Set(tokenList(text));
}

function numberSet(text) {
  return new Set([...String(text ?? "").matchAll(/\b\d+(?:[,.]\d+)*(?:\.\d+)?%?\b/g)].map((match) => match[0]));
}

function sameCitationSet(left, right) {
  const leftSet = new Set(normalizeCitations(left));
  const rightSet = new Set(normalizeCitations(right));
  if (leftSet.size !== rightSet.size) return false;
  for (const value of leftSet) if (!rightSet.has(value)) return false;
  return true;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation)).filter(Boolean);
}

function renderReport(result) {
  return `# Train-Selected Constrained Policy Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Metrics

| Split | Answered | Contract Correct | Answer Type | Citation Exact |
| --- | ---: | ---: | ---: | ---: |
| Train tune | ${result.metrics.train_tune.answered}/${result.metrics.train_tune.examples} | ${result.metrics.train_tune.contract_correct}/${result.metrics.train_tune.examples} (${pct(result.metrics.train_tune.contract_correct_rate)}) | ${pct(result.metrics.train_tune.answer_type_accuracy)} | ${pct(result.metrics.train_tune.citation_set_exact_rate)} |
| Train heldout | ${result.metrics.train_heldout.answered}/${result.metrics.train_heldout.examples} | ${result.metrics.train_heldout.contract_correct}/${result.metrics.train_heldout.examples} (${pct(result.metrics.train_heldout.contract_correct_rate)}) | ${pct(result.metrics.train_heldout.answer_type_accuracy)} | ${pct(result.metrics.train_heldout.citation_set_exact_rate)} |
| Repaired validation | ${result.metrics.repaired_validation_gate.answered}/${result.metrics.repaired_validation_gate.examples} | ${result.metrics.repaired_validation_gate.contract_correct}/${result.metrics.repaired_validation_gate.examples} (${pct(result.metrics.repaired_validation_gate.contract_correct_rate)}) | ${pct(result.metrics.repaired_validation_gate.answer_type_accuracy)} | ${pct(result.metrics.repaired_validation_gate.citation_set_exact_rate)} |

## Baseline Comparison

- Train-calibrated scaffold: ${result.baseline_comparison.train_calibrated_scaffold_contract_correct}/70
- Constrained Qwen/scaffold hybrid: ${result.baseline_comparison.constrained_hybrid_contract_correct}/70
- Selected policy: ${result.baseline_comparison.selected_validation_contract_correct}/70
- Delta vs scaffold: ${result.baseline_comparison.delta_vs_train_calibrated_scaffold}
- Delta vs hybrid: ${result.baseline_comparison.delta_vs_constrained_hybrid}

## Decision

- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Promote as final scaffold: ${result.decision.promote_as_final_scaffold ? "yes" : "no"}
- Next step: ${result.decision.next_step}
`;
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
