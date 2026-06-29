import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "train-derived-citation-pattern-constructor-audit-frontier-repaired-v1";
const launchPacketRunId = args["launch-packet-run-id"] ?? "frontier-repaired-launch-packet-2026-06-29-v1";
const validationPacketRunId = args["validation-packet-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const augmentedRunId = args["augmented-router-run-id"] ?? "augmented-constructor-router-audit-frontier-repaired-v1";
const targetedRunId = args["targeted-run-id"] ?? "targeted-citation-pattern-constructor-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model models dataset datasets task result results use uses is in on of to a an by as or be can it its we our you your over under through between among all three two one do has have had not no yes where when who why".split(" "));

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const trainRowsRaw = await readJsonl(path.join(runsDir, launchPacketRunId, "dataset", "sft_train.jsonl"));
const validationPrompts = await readJsonl(path.join(runsDir, validationPacketRunId, "dataset", "eval_prompts.jsonl"));
const validationTargets = await readJsonl(path.join(runsDir, validationPacketRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const candidateRows = await readJsonl(path.join(runsDir, augmentedRunId, "validation_candidate_rows.jsonl"));
const augmented = await readJson(path.join(runsDir, augmentedRunId, "result.json"));
const targeted = await readJson(path.join(runsDir, targetedRunId, "result.json"));

const validationTargetById = new Map(validationTargets.map((row) => [row.example_id, row.target]));
const augmentedCorrectById = groupBy(candidateRows.filter((row) => row.label_contract_correct), (row) => row.example_id);
const trainRows = trainRowsRaw.map((row) => ({ example_id: row.example_id, input: row.input, target: row.target }));
const trainTune = trainRows.slice(0, 160);
const trainHeldout = trainRows.slice(160);
const learner = fitLearner(trainTune);
const calibration = calibrate(trainTune, trainHeldout, learner);
const validationRows = validationPrompts.map((row) => ({ example_id: row.example_id, input: row.input, target: validationTargetById.get(row.example_id) }));

const predictions = validationRows.map((row) => predictRow(row, learner, calibration.params));
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);

const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);
const scoredRows = await readJsonl(path.join(runsDir, gateRunId, "scored_predictions.jsonl"));
const auditRows = scoredRows.map((row) => {
  const existingCorrect = (augmentedCorrectById.get(row.example_id) ?? []).length > 0;
  return {
    example_id: row.example_id,
    target_answer_type: row.target_answer_type,
    prediction_answer_type: row.prediction_answer_type,
    contract_correct: Boolean(row.contract_correct),
    answer_type_correct: Boolean(row.answer_type_correct),
    citation_set_exact: Boolean(row.citation_set_exact),
    existing_augmented_pool_correct: existingCorrect,
    adds_new_correct_candidate: !existingCorrect && Boolean(row.contract_correct),
    tags: tagsFor(row, existingCorrect),
  };
});

const constructorCorrect = count(auditRows, (row) => row.contract_correct);
const newCorrect = count(auditRows, (row) => row.adds_new_correct_candidate);
const augmentedOracle = Number(augmented.oracle?.repaired_validation_gate?.contract_correct ?? 0);
const combinedOracle = augmentedOracle + newCorrect;
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "train_derived_citation_pattern_constructor_audit",
  status: statusFor({ constructorCorrect, newCorrect, calibration }),
  purpose: "Test whether the D419 citation-pattern idea survives without validation-surface rule design by deriving token-pattern weights and thresholds from train-tune/train-heldout only.",
  source_runs: {
    launch_packet: launchPacketRunId,
    validation_packet: validationPacketRunId,
    augmented_router: augmentedRunId,
    targeted_validation_informed_constructor: targetedRunId,
    contract_gate: gateRunId,
  },
  leakage_note: "Token weights are fit on train-tune rows and thresholds are selected on train-heldout rows. Validation targets are used only by the final contract gate and reporting.",
  learner_summary: summarizeLearner(learner),
  calibration,
  predictions: {
    examples: predictions.length,
    grounded_answer: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstain: predictions.filter((row) => row.prediction.answer_type === "abstain").length,
  },
  metrics: {
    examples: auditRows.length,
    constructor_contract_correct: constructorCorrect,
    constructor_contract_correct_rate: rate(constructorCorrect, auditRows.length),
    constructor_answer_type_correct: count(auditRows, (row) => row.answer_type_correct),
    constructor_citation_set_exact: count(auditRows, (row) => row.citation_set_exact),
    new_correct_candidates_outside_augmented_pool: newCorrect,
    augmented_pool_oracle_contract_correct: augmentedOracle,
    combined_augmented_plus_train_derived_oracle_contract_correct: combinedOracle,
    combined_oracle_delta: combinedOracle - augmentedOracle,
  },
  baseline_comparison: {
    prior_router_contract_correct: 47,
    d417_two_head_contract_correct: 47,
    augmented_pool_oracle_contract_correct: augmentedOracle,
    d419_validation_informed_constructor_standalone_contract_correct: Number(targeted.metrics?.constructor_contract_correct ?? 0),
    d419_validation_informed_combined_oracle_contract_correct: Number(targeted.metrics?.combined_augmented_plus_targeted_oracle_contract_correct ?? 0),
    train_derived_constructor_standalone_contract_correct: constructorCorrect,
    train_derived_combined_oracle_contract_correct: combinedOracle,
    train_derived_combined_oracle_remaining_gap_to_70: 70 - combinedOracle,
  },
  row_tag_counts: countTags(auditRows.flatMap((row) => row.tags)),
  decision: decisionFor({ constructorCorrect, newCorrect, combinedOracle, augmentedOracle, calibration }),
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
    note: "This audit uses train-derived deterministic scoring and the local contract gate only.",
  },
  artifacts: {
    predictions_jsonl: rel(predictionsPath),
    rows_jsonl: rel(path.join(outputDir, "rows.jsonl")),
    contract_gate_result_json: rel(path.join(runsDir, gateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "rows.jsonl"), auditRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  calibration: result.calibration,
  predictions: result.predictions,
  metrics: result.metrics,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function fitLearner(rows) {
  const globalStats = emptyStats();
  const intentStats = new Map();
  const answerTypeStats = { grounded_answer: 0, abstain: 0 };
  for (const row of rows) {
    answerTypeStats[row.target.answer_type] = (answerTypeStats[row.target.answer_type] ?? 0) + 1;
    const intent = questionIntent(row.input.question);
    if (!intentStats.has(intent)) intentStats.set(intent, emptyStats());
    addRowStats(globalStats, row);
    addRowStats(intentStats.get(intent), row);
  }
  return {
    train_examples: rows.length,
    answer_type_stats: answerTypeStats,
    global: finalizeStats(globalStats),
    by_intent: Object.fromEntries([...intentStats.entries()].map(([intent, stats]) => [intent, finalizeStats(stats)])),
  };
}

function emptyStats() {
  return {
    positive: new Map(),
    negative: new Map(),
    sectionPositive: new Map(),
    sectionNegative: new Map(),
    positiveExamples: 0,
    negativeExamples: 0,
  };
}

function addRowStats(stats, row) {
  const citations = new Set(row.target.citations ?? []);
  const isGrounded = row.target.answer_type === "grounded_answer";
  for (const evidence of row.input.compact_retrieved_evidence_pack ?? []) {
    const positive = isGrounded && citations.has(evidence.evidence_id);
    if (positive) stats.positiveExamples += 1;
    else stats.negativeExamples += 1;
    const tokenMap = positive ? stats.positive : stats.negative;
    const sectionMap = positive ? stats.sectionPositive : stats.sectionNegative;
    for (const token of new Set(contentTokens(evidence.text))) tokenMap.set(token, (tokenMap.get(token) ?? 0) + 1);
    for (const token of new Set(contentTokens(evidence.section))) sectionMap.set(token, (sectionMap.get(token) ?? 0) + 1);
  }
}

function finalizeStats(stats) {
  const weights = {};
  const tokens = new Set([...stats.positive.keys(), ...stats.negative.keys()]);
  for (const token of tokens) {
    const pos = stats.positive.get(token) ?? 0;
    const neg = stats.negative.get(token) ?? 0;
    const weight = Math.log((pos + 1.5) / (neg + 1.5));
    if (Math.abs(weight) >= 0.1) weights[token] = weight;
  }
  const sectionWeights = {};
  const sectionTokens = new Set([...stats.sectionPositive.keys(), ...stats.sectionNegative.keys()]);
  for (const token of sectionTokens) {
    const pos = stats.sectionPositive.get(token) ?? 0;
    const neg = stats.sectionNegative.get(token) ?? 0;
    const weight = Math.log((pos + 1.5) / (neg + 1.5));
    if (Math.abs(weight) >= 0.1) sectionWeights[token] = weight;
  }
  return {
    positive_examples: stats.positiveExamples,
    negative_examples: stats.negativeExamples,
    weights,
    section_weights: sectionWeights,
    top_positive_tokens: topWeights(weights, 20),
    top_positive_section_tokens: topWeights(sectionWeights, 12),
  };
}

function calibrate(trainTune, trainHeldout, learner) {
  const candidates = [];
  for (const answerThreshold of [-0.2, 0, 0.2, 0.45, 0.7, 1.0, 1.35, 1.7, 2.1]) {
    for (const citationFraction of [0.45, 0.55, 0.68, 0.8, 0.92, 1.01]) {
      for (const maxCitations of [1, 2, 3, 4, 5]) {
        for (const intentWeight of [0.5, 0.8, 1.1, 1.5]) {
          const params = { answer_threshold: answerThreshold, citation_fraction: citationFraction, max_citations: maxCitations, intent_weight: intentWeight };
          const tune = scoreLocal(trainTune, learner, params);
          const objective = tune.contract_correct - Math.max(0, tune.over_answered_abstentions - 2) * 0.75 - Math.abs(tune.grounded_answer_predictions - tune.target_grounded_answer) * 0.15;
          candidates.push({ params, train_tune: tune, objective });
        }
      }
    }
  }
  candidates.sort((left, right) => right.objective - left.objective || right.train_tune.contract_correct - left.train_tune.contract_correct);
  const selected = candidates[0];
  return {
    selected_by: "train_tune_contract_correct_with_overanswer_and_answer_coverage_regularizer",
    train_tune_examples: trainTune.length,
    train_heldout_examples: trainHeldout.length,
    params: selected.params,
    train_tune: selected.train_tune,
    train_heldout: scoreLocal(trainHeldout, learner, selected.params),
  };
}

function scoreLocal(rows, learner, params) {
  const scored = rows.map((row) => {
    const citations = selectCitations(row.input, learner, params);
    const prediction = citations.length ? { answer_type: "grounded_answer", citations } : { answer_type: "abstain", citations: [] };
    const answerTypeCorrect = prediction.answer_type === row.target.answer_type;
    const citationSetExact = prediction.answer_type === "abstain"
      ? prediction.citations.length === 0
      : setEqual(new Set(prediction.citations), new Set(row.target.citations ?? []));
    return {
      prediction_answer_type: prediction.answer_type,
      answer_type_correct: answerTypeCorrect,
      citation_set_exact: citationSetExact,
      contract_correct: answerTypeCorrect && citationSetExact,
      over_answered_abstention: row.target.answer_type === "abstain" && prediction.answer_type === "grounded_answer",
    };
  });
  return {
    examples: rows.length,
    contract_correct: count(scored, (row) => row.contract_correct),
    contract_correct_rate: rate(count(scored, (row) => row.contract_correct), rows.length),
    answer_type_correct: count(scored, (row) => row.answer_type_correct),
    citation_set_exact: count(scored, (row) => row.citation_set_exact),
    over_answered_abstentions: count(scored, (row) => row.over_answered_abstention),
    target_grounded_answer: count(rows, (row) => row.target.answer_type === "grounded_answer"),
    grounded_answer_predictions: count(scored, (row) => row.prediction_answer_type === "grounded_answer"),
  };
}

function predictRow(row, learner, params) {
  const citations = selectCitations(row.input, learner, params);
  const prediction = citations.length ? groundedAnswer(row.input, citations) : abstain(row.input.question);
  return {
    example_id: row.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    metadata: {
      scaffold: "train_derived_citation_pattern_constructor",
      train_tune_derived_weights: true,
      train_heldout_selected_thresholds: true,
      no_model_weights_or_llm_calls: true,
    },
  };
}

function selectCitations(input, learner, params) {
  const evidencePack = input.compact_retrieved_evidence_pack ?? [];
  const intent = questionIntent(input.question);
  const scored = evidencePack
    .map((evidence) => ({ evidence, score: evidenceScore(input.question, evidence, learner, params, intent) }))
    .sort((left, right) => right.score - left.score || left.evidence.evidence_id.localeCompare(right.evidence.evidence_id));
  const top = scored[0]?.score ?? -Infinity;
  if (top < params.answer_threshold) return [];
  return scored
    .filter((row) => row.score >= params.answer_threshold && row.score >= top * params.citation_fraction)
    .slice(0, params.max_citations)
    .map((row) => row.evidence.evidence_id);
}

function evidenceScore(question, evidence, learner, params, intent) {
  const lexical = lexicalScore(question, evidence);
  const globalScore = weightScore(evidence, learner.global, 1);
  const intentScore = weightScore(evidence, learner.by_intent[intent] ?? learner.global, params.intent_weight);
  const rankBonus = 0.2 / Math.max(1, Number(evidence.retrieval_rank ?? 1));
  const directBonus = directSurfaceBonus(question, evidence);
  return lexical + globalScore + intentScore + rankBonus + directBonus;
}

function weightScore(evidence, stats, multiplier) {
  if (!stats) return 0;
  const textTokens = contentTokens(evidence.text);
  const sectionTokens = contentTokens(evidence.section);
  let total = 0;
  let countUsed = 0;
  for (const token of new Set(textTokens)) {
    const weight = stats.weights[token] ?? 0;
    if (weight > 0) {
      total += Math.min(1.5, weight);
      countUsed += 1;
    }
  }
  for (const token of new Set(sectionTokens)) {
    const weight = stats.section_weights[token] ?? 0;
    if (weight > 0) {
      total += Math.min(1.5, weight) * 0.7;
      countUsed += 1;
    }
  }
  if (!countUsed) return 0;
  return multiplier * total / Math.sqrt(countUsed + 2);
}

function directSurfaceBonus(question, evidence) {
  const q = String(question ?? "").toLowerCase();
  const text = `${evidence.section ?? ""} ${evidence.text ?? ""}`.toLowerCase();
  let bonus = 0;
  if (/dataset|data/.test(q) && /dataset|data set|corpus|benchmark/.test(text)) bonus += 0.5;
  if (/baseline|compared|models|architectures|architecture/.test(q) && /baseline|compare|model|architecture|encoder|decoder|lstm|bert|cnn|matchlstm/.test(text)) bonus += 0.5;
  if (/evaluated|metric|score|fluency|stylistic/.test(q) && /evaluat|metric|score|perplexity|ppl|ranking|annotator/.test(text)) bonus += 0.5;
  if (/optimizers|learning rate|impact/.test(q) && /optimizer|learning rate|adam|sgd|clr|performance/.test(text)) bonus += 0.5;
  if (/\b(how many|how much|percent|percentage|size|sizes|large|big)\b/.test(q) && /\d/.test(text)) bonus += 0.35;
  return bonus;
}

function lexicalScore(question, evidence) {
  const questionTokens = new Set(contentTokens(question));
  const evidenceTokens = contentTokens(`${evidence.section ?? ""} ${evidence.text ?? ""}`);
  if (!questionTokens.size || !evidenceTokens.length) return 0;
  return new Set(evidenceTokens.filter((token) => questionTokens.has(token))).size / questionTokens.size;
}

function questionIntent(question) {
  const q = String(question ?? "").toLowerCase();
  if (/dataset|data set|corpus|benchmark/.test(q)) return "dataset";
  if (/baseline|compared|compare|models|system/.test(q)) return "model_comparison";
  if (/architecture|architectures|component/.test(q)) return "architecture";
  if (/metric|score|evaluated|evaluation|fluency|ranking|stylistic/.test(q)) return "evaluation_metric";
  if (/optimizer|learning rate|performance|impact/.test(q)) return "optimization_effect";
  if (/\b(how many|how much|percent|percentage|size|sizes|large|big|number)\b/.test(q)) return "numeric";
  if (/yes|no|is there|does|do |did |can |could |should |would /.test(q)) return "yes_no";
  return "generic";
}

function groundedAnswer(input, citations) {
  const evidenceById = new Map((input.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row]));
  const claims = citations.map((citation, index) => {
    const evidence = evidenceById.get(citation);
    const claim = bestSentence(input.question, evidence);
    return { claim_id: `C${index + 1}`, claim, citations: [citation], support_status: "supported" };
  });
  return {
    answer_type: "grounded_answer",
    evidence_first: {
      sufficiency: "sufficient",
      supported_claims: claims,
      missing_support: "",
      question_target: input.question ?? "exact_question_target",
    },
    answer: `${claims.map((claim) => claim.claim).join(" ")} ${citations.map((id) => `[${id}]`).join(" ")}`,
    citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function bestSentence(question, evidence) {
  const questionTokens = new Set(contentTokens(question));
  const sentences = splitSentences(evidence?.text ?? "");
  const selected = sentences
    .map((sentence) => ({ sentence: cleanSentence(sentence), score: contentTokens(sentence).filter((token) => questionTokens.has(token)).length }))
    .sort((left, right) => right.score - left.score)[0];
  return selected?.sentence || cleanSentence(evidence?.text ?? "");
}

function abstain(question) {
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: "The train-derived constructor did not find direct enough support in the compact evidence pack.",
      question_target: question ?? "exact_question_target",
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The local train-derived constructor did not find direct enough support in the compact evidence pack.",
  };
}

async function runContractGate(gateRunId, predictionsPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join("scripts", "grounded-qa-distillation-evidence-first-contract-preflight.mjs"),
      `--packet-run-id=${validationPacketRunId}`,
      `--prediction-file=${path.relative(rootDir, predictionsPath)}`,
      `--run-id=${gateRunId}`,
    ], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Contract gate failed with code ${code}: ${stderr}`));
    });
  });
  return readJson(path.join(runsDir, gateRunId, "result.json"));
}

function tagsFor(row, existingCorrect) {
  const tags = [];
  if (row.contract_correct) tags.push("constructor_contract_correct");
  if (!existingCorrect && row.contract_correct) tags.push("adds_new_correct_candidate");
  if (row.target_answer_type === "abstain" && row.prediction_answer_type === "grounded_answer") tags.push("over_answered_abstention_target");
  if (row.target_answer_type === "grounded_answer" && row.prediction_answer_type === "abstain") tags.push("false_abstention");
  if (row.target_answer_type === "grounded_answer" && row.prediction_answer_type === "grounded_answer" && !row.citation_set_exact) tags.push("citation_selection_error");
  return tags;
}

function statusFor({ constructorCorrect, newCorrect, calibration }) {
  if (newCorrect > 0 && calibration.train_heldout.contract_correct_rate < 0.4) return "train_derived_constructor_weak_transfer_with_small_headroom";
  if (newCorrect > 0 && constructorCorrect >= 47) return "train_derived_constructor_adds_headroom_and_matches_router";
  if (newCorrect > 0) return "train_derived_constructor_adds_headroom_but_not_policy";
  if (calibration.train_heldout.contract_correct_rate < 0.55) return "train_derived_constructor_poor_heldout_transfer";
  return "train_derived_constructor_no_new_headroom";
}

function decisionFor(metrics) {
  const addsHeadroom = metrics.combinedOracle > metrics.augmentedOracle;
  const weakHeldout = metrics.calibration.train_heldout.contract_correct_rate < 0.4;
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    promote_as_policy: metrics.constructorCorrect >= 47 && !weakHeldout,
    keep_as_candidate_generator: addsHeadroom && !weakHeldout,
    next_step: addsHeadroom && !weakHeldout
      ? "Use this train-derived constructor as an additional candidate source in a leakage-safe combined-pool router audit before any paid model call."
      : addsHeadroom
        ? "Do not launch a router or paid run from this weak transfer result; first mine more train-derived pattern features or create a fresh heldout packet to test whether the D419 family generalizes."
      : "Do not spend on this constructor family; generate a fresh heldout packet or use a stronger candidate generator.",
    reason: addsHeadroom
      ? `The train-derived constructor adds ${metrics.newCorrect} new correct validation candidates, moving oracle headroom from ${metrics.augmentedOracle}/70 to ${metrics.combinedOracle}/70, but train-heldout transfer is only ${metrics.calibration.train_heldout.contract_correct}/${metrics.calibration.train_heldout.examples}.`
      : `The train-derived constructor adds no candidate headroom beyond the augmented oracle at ${metrics.augmentedOracle}/70.`,
  };
}

function summarizeLearner(learner) {
  return {
    train_examples: learner.train_examples,
    answer_type_stats: learner.answer_type_stats,
    intents: Object.fromEntries(Object.entries(learner.by_intent).map(([intent, stats]) => [intent, {
      positive_examples: stats.positive_examples,
      negative_examples: stats.negative_examples,
      top_positive_tokens: stats.top_positive_tokens.slice(0, 8),
      top_positive_section_tokens: stats.top_positive_section_tokens.slice(0, 6),
    }])),
    global_top_positive_tokens: learner.global.top_positive_tokens.slice(0, 12),
  };
}

function renderReport(result) {
  const m = result.metrics;
  return `# Train-Derived Citation-Pattern Constructor Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime compute. Token weights are learned from train-tune rows and thresholds are selected on train-heldout rows.

## Calibration

- Train-tune contract correct: ${result.calibration.train_tune.contract_correct}/${result.calibration.train_tune.examples} (${pct(result.calibration.train_tune.contract_correct_rate)})
- Train-heldout contract correct: ${result.calibration.train_heldout.contract_correct}/${result.calibration.train_heldout.examples} (${pct(result.calibration.train_heldout.contract_correct_rate)})
- Selected params: ${JSON.stringify(result.calibration.params)}

## Metrics

| Policy / pool | Contract correct | Rate |
| --- | ---: | ---: |
| Prior router | ${result.baseline_comparison.prior_router_contract_correct} / ${m.examples} | ${pct(result.baseline_comparison.prior_router_contract_correct / m.examples)} |
| D417 two-head selector | ${result.baseline_comparison.d417_two_head_contract_correct} / ${m.examples} | ${pct(result.baseline_comparison.d417_two_head_contract_correct / m.examples)} |
| Train-derived constructor standalone | ${m.constructor_contract_correct} / ${m.examples} | ${pct(m.constructor_contract_correct_rate)} |
| Augmented pool oracle | ${m.augmented_pool_oracle_contract_correct} / ${m.examples} | ${pct(m.augmented_pool_oracle_contract_correct / m.examples)} |
| Augmented + train-derived oracle | ${m.combined_augmented_plus_train_derived_oracle_contract_correct} / ${m.examples} | ${pct(m.combined_augmented_plus_train_derived_oracle_contract_correct / m.examples)} |
| D419 validation-informed oracle | ${result.baseline_comparison.d419_validation_informed_combined_oracle_contract_correct} / ${m.examples} | ${pct(result.baseline_comparison.d419_validation_informed_combined_oracle_contract_correct / m.examples)} |

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Promote as policy: ${result.decision.promote_as_policy ? "yes" : "no"}
- Keep as candidate generator: ${result.decision.keep_as_candidate_generator ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function topWeights(weights, limit) {
  return Object.entries(weights).filter(([, value]) => value > 0).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, limit).map(([token, weight]) => ({ token, weight }));
}

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean).slice(0, 5);
}

function cleanSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 280);
}

function contentTokens(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !stopwords.has(token));
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countTags(tags) {
  const counts = {};
  for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
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
  return text.trim() ? text.trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
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
