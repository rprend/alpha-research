import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "analog-aware-threshold-constructor-audit-frontier-repaired-v1";
const launchPacketRunId = args["launch-packet-run-id"] ?? "frontier-repaired-launch-packet-2026-06-29-v1";
const validationPacketRunId = args["validation-packet-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const augmentedRunId = args["augmented-router-run-id"] ?? "augmented-constructor-router-audit-frontier-repaired-v1";
const d420RunId = args["d420-run-id"] ?? "train-derived-citation-pattern-constructor-audit-frontier-repaired-v1";
const gapRunId = args["gap-run-id"] ?? "citation-pattern-generalization-gap-audit-frontier-repaired-v1";
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
const d420 = await readJson(path.join(runsDir, d420RunId, "result.json"));
const gap = await readJson(path.join(runsDir, gapRunId, "result.json"));

const trainRows = trainRowsRaw.map((row) => ({ example_id: row.example_id, input: row.input, target: row.target }));
const trainTune = trainRows.slice(0, 160);
const trainHeldout = trainRows.slice(160);
const validationTargetById = new Map(validationTargets.map((row) => [row.example_id, row.target]));
const validationRows = validationPrompts.map((row) => ({ example_id: row.example_id, input: row.input, target: validationTargetById.get(row.example_id) }));
const augmentedCorrectById = groupBy(candidateRows.filter((row) => row.label_contract_correct), (row) => row.example_id);

const learner = fitLearner(trainTune);
const analogIndex = buildAnalogIndex(trainTune);
const calibration = calibrate(trainTune, trainHeldout, learner, analogIndex);
const predictions = validationRows.map((row) => predictRow(row, learner, analogIndex, calibration.params));
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);

const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);
const scoredRows = await readJsonl(path.join(runsDir, gateRunId, "scored_predictions.jsonl"));
const auditRows = scoredRows.map((row) => {
  const existingCorrect = (augmentedCorrectById.get(row.example_id) ?? []).length > 0;
  const prediction = predictions.find((candidate) => candidate.example_id === row.example_id);
  return {
    example_id: row.example_id,
    target_answer_type: row.target_answer_type,
    prediction_answer_type: row.prediction_answer_type,
    prediction_citations: prediction?.prediction?.citations ?? [],
    analog_score: prediction?.metadata?.analog_score ?? 0,
    analog_intent: prediction?.metadata?.intent ?? null,
    analog_discount_applied: Boolean(prediction?.metadata?.analog_discount_applied),
    contract_correct: Boolean(row.contract_correct),
    answer_type_correct: Boolean(row.answer_type_correct),
    citation_set_exact: Boolean(row.citation_set_exact),
    existing_augmented_pool_correct: existingCorrect,
    adds_new_correct_candidate: !existingCorrect && Boolean(row.contract_correct),
    tags: tagsFor(row, existingCorrect, prediction),
  };
});

const constructorCorrect = count(auditRows, (row) => row.contract_correct);
const newCorrect = count(auditRows, (row) => row.adds_new_correct_candidate);
const augmentedOracle = Number(augmented.oracle?.repaired_validation_gate?.contract_correct ?? 0);
const combinedOracle = augmentedOracle + newCorrect;
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "analog_aware_threshold_constructor_audit",
  status: statusFor({ constructorCorrect, newCorrect, calibration }),
  purpose: "Test whether D421's thresholding diagnosis can be repaired by lowering answer thresholds only for examples with close grounded train analogs.",
  source_runs: {
    launch_packet: launchPacketRunId,
    validation_packet: validationPacketRunId,
    augmented_router: augmentedRunId,
    d420_train_derived_constructor: d420RunId,
    d421_generalization_gap: gapRunId,
    contract_gate: gateRunId,
  },
  leakage_note: "Learner weights and analog index are fit on train-tune rows only. Threshold and analog-discount parameters are selected on train-heldout rows. Validation targets are used only by the final contract gate and reporting.",
  calibration,
  predictions: {
    examples: predictions.length,
    grounded_answer: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstain: predictions.filter((row) => row.prediction.answer_type === "abstain").length,
    analog_discount_applied: predictions.filter((row) => row.metadata.analog_discount_applied).length,
  },
  metrics: {
    examples: auditRows.length,
    constructor_contract_correct: constructorCorrect,
    constructor_contract_correct_rate: rate(constructorCorrect, auditRows.length),
    constructor_answer_type_correct: count(auditRows, (row) => row.answer_type_correct),
    constructor_citation_set_exact: count(auditRows, (row) => row.citation_set_exact),
    new_correct_candidates_outside_augmented_pool: newCorrect,
    augmented_pool_oracle_contract_correct: augmentedOracle,
    combined_augmented_plus_analog_aware_oracle_contract_correct: combinedOracle,
    combined_oracle_delta: combinedOracle - augmentedOracle,
  },
  baseline_comparison: {
    prior_router_contract_correct: 47,
    d417_two_head_contract_correct: 47,
    augmented_pool_oracle_contract_correct: augmentedOracle,
    d420_constructor_standalone_contract_correct: Number(d420.metrics?.constructor_contract_correct ?? 0),
    d420_combined_oracle_contract_correct: Number(d420.metrics?.combined_augmented_plus_train_derived_oracle_contract_correct ?? 0),
    d421_d419_rescue_false_abstentions: Number(gap.summary?.d420_false_abstentions ?? 0),
    analog_aware_constructor_standalone_contract_correct: constructorCorrect,
    analog_aware_combined_oracle_contract_correct: combinedOracle,
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
  const stats = emptyStats();
  for (const row of rows) addRowStats(stats, row);
  return finalizeStats(stats);
}

function emptyStats() {
  return { positive: new Map(), negative: new Map(), sectionPositive: new Map(), sectionNegative: new Map() };
}

function addRowStats(stats, row) {
  const citations = new Set(row.target.citations ?? []);
  const grounded = row.target.answer_type === "grounded_answer";
  for (const evidence of row.input.compact_retrieved_evidence_pack ?? []) {
    const positive = grounded && citations.has(evidence.evidence_id);
    const tokenMap = positive ? stats.positive : stats.negative;
    const sectionMap = positive ? stats.sectionPositive : stats.sectionNegative;
    for (const token of new Set(contentTokens(evidence.text))) tokenMap.set(token, (tokenMap.get(token) ?? 0) + 1);
    for (const token of new Set(contentTokens(evidence.section))) sectionMap.set(token, (sectionMap.get(token) ?? 0) + 1);
  }
}

function finalizeStats(stats) {
  return {
    weights: finalizeWeights(stats.positive, stats.negative),
    section_weights: finalizeWeights(stats.sectionPositive, stats.sectionNegative),
  };
}

function finalizeWeights(positive, negative) {
  const weights = {};
  for (const token of new Set([...positive.keys(), ...negative.keys()])) {
    const weight = Math.log(((positive.get(token) ?? 0) + 1.5) / ((negative.get(token) ?? 0) + 1.5));
    if (Math.abs(weight) >= 0.1) weights[token] = weight;
  }
  return weights;
}

function buildAnalogIndex(rows) {
  return rows
    .filter((row) => row.target.answer_type === "grounded_answer")
    .map((row) => {
      const citations = new Set(row.target.citations ?? []);
      const cited = (row.input.compact_retrieved_evidence_pack ?? []).filter((evidence) => citations.has(evidence.evidence_id));
      return {
        example_id: row.example_id,
        intent: questionIntent(row.input.question),
        citation_shape: citationShape(citations.size),
        question_tokens: new Set(contentTokens(row.input.question)),
        cited_section_tokens: new Set(cited.flatMap((evidence) => contentTokens(evidence.section))),
        cited_text_tokens: new Set(cited.flatMap((evidence) => contentTokens(evidence.text))),
      };
    });
}

function calibrate(trainTune, trainHeldout, learner, analogIndex) {
  const candidates = [];
  for (const answerThreshold of [1.5, 2.1, 2.7]) {
    for (const citationFraction of [0.45, 0.68]) {
      for (const maxCitations of [2, 4]) {
        for (const analogMin of [0.42, 0.58]) {
          for (const analogDiscount of [0, 0.5, 1.0]) {
            const params = { answer_threshold: answerThreshold, citation_fraction: citationFraction, max_citations: maxCitations, analog_min: analogMin, analog_discount: analogDiscount };
            const tune = scoreLocal(trainTune, learner, analogIndex, params);
            const heldout = scoreLocal(trainHeldout, learner, analogIndex, params);
            const objective = heldout.contract_correct - Math.max(0, heldout.over_answered_abstentions - 4) * 0.9 - Math.max(0, heldout.citation_errors - 6) * 0.35;
            candidates.push({ params, train_tune: tune, train_heldout: heldout, objective });
          }
        }
      }
    }
  }
  candidates.sort((left, right) => right.objective - left.objective || right.train_heldout.contract_correct - left.train_heldout.contract_correct);
  const selected = candidates[0];
  return {
    selected_by: "train_heldout_contract_correct_with_overanswer_and_citation_error_penalties",
    train_tune_examples: trainTune.length,
    train_heldout_examples: trainHeldout.length,
    params: selected.params,
    train_tune: selected.train_tune,
    train_heldout: selected.train_heldout,
  };
}

function scoreLocal(rows, learner, analogIndex, params) {
  const scored = rows.map((row) => {
    const selection = selectCitations(row.input, learner, analogIndex, params);
    const prediction = selection.citations.length ? { answer_type: "grounded_answer", citations: selection.citations } : { answer_type: "abstain", citations: [] };
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
      citation_error: row.target.answer_type === "grounded_answer" && prediction.answer_type === "grounded_answer" && !citationSetExact,
    };
  });
  return {
    examples: rows.length,
    contract_correct: count(scored, (row) => row.contract_correct),
    contract_correct_rate: rate(count(scored, (row) => row.contract_correct), rows.length),
    answer_type_correct: count(scored, (row) => row.answer_type_correct),
    citation_set_exact: count(scored, (row) => row.citation_set_exact),
    over_answered_abstentions: count(scored, (row) => row.over_answered_abstention),
    citation_errors: count(scored, (row) => row.citation_error),
    grounded_answer_predictions: count(scored, (row) => row.prediction_answer_type === "grounded_answer"),
  };
}

function predictRow(row, learner, analogIndex, params) {
  const selection = selectCitations(row.input, learner, analogIndex, params);
  const prediction = selection.citations.length ? groundedAnswer(row.input, selection.citations) : abstain(row.input.question);
  return {
    example_id: row.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    metadata: {
      scaffold: "analog_aware_threshold_constructor",
      analog_score: selection.analog_score,
      analog_discount_applied: selection.analog_discount_applied,
      effective_threshold: selection.effective_threshold,
      intent: selection.intent,
      no_model_weights_or_llm_calls: true,
    },
  };
}

function selectCitations(input, learner, analogIndex, params) {
  const intent = questionIntent(input.question);
  const analogScore = bestAnalogScore(input, analogIndex, intent);
  const analogDiscountApplied = analogScore >= params.analog_min;
  const effectiveThreshold = Math.max(0, params.answer_threshold - (analogDiscountApplied ? params.analog_discount : 0));
  const scored = (input.compact_retrieved_evidence_pack ?? [])
    .map((evidence) => ({ evidence, score: evidenceScore(input.question, evidence, learner, analogScore) }))
    .sort((left, right) => right.score - left.score || left.evidence.evidence_id.localeCompare(right.evidence.evidence_id));
  const top = scored[0]?.score ?? -Infinity;
  if (top < effectiveThreshold) return { citations: [], analog_score: analogScore, analog_discount_applied: analogDiscountApplied, effective_threshold: effectiveThreshold, intent };
  const citations = scored
    .filter((row) => row.score >= effectiveThreshold && row.score >= top * params.citation_fraction)
    .slice(0, params.max_citations)
    .map((row) => row.evidence.evidence_id);
  return { citations, analog_score: analogScore, analog_discount_applied: analogDiscountApplied, effective_threshold: effectiveThreshold, intent };
}

function evidenceScore(question, evidence, learner, analogScore) {
  const textTokens = new Set(contentTokens(evidence.text));
  const sectionTokens = new Set(contentTokens(evidence.section));
  let score = lexicalScore(question, evidence) + directSurfaceBonus(question, evidence) + analogScore * 0.35;
  let used = 0;
  for (const token of textTokens) {
    const weight = learner.weights[token] ?? 0;
    if (weight > 0) {
      score += Math.min(1.2, weight) / 4;
      used += 1;
    }
  }
  for (const token of sectionTokens) {
    const weight = learner.section_weights[token] ?? 0;
    if (weight > 0) {
      score += Math.min(1.2, weight) / 3;
      used += 1;
    }
  }
  return score + Math.min(0.7, used / 20);
}

function bestAnalogScore(input, analogIndex, intent) {
  const questionTokens = new Set(contentTokens(input.question));
  const evidencePack = input.compact_retrieved_evidence_pack ?? [];
  const sectionTokens = new Set(evidencePack.flatMap((evidence) => contentTokens(evidence.section)));
  const textTokens = new Set(evidencePack.flatMap((evidence) => contentTokens(evidence.text)));
  let best = 0;
  for (const analog of analogIndex) {
    const score = (analog.intent === intent ? 0.32 : 0) +
      jaccard(questionTokens, analog.question_tokens) * 0.34 +
      jaccard(sectionTokens, analog.cited_section_tokens) * 0.18 +
      jaccard(textTokens, analog.cited_text_tokens) * 0.08 +
      (analog.citation_shape === "single_citation" ? 0.04 : 0);
    best = Math.max(best, score);
  }
  return best;
}

function questionIntent(question) {
  const q = String(question ?? "").toLowerCase();
  if (/dataset|data set|corpus|benchmark/.test(q)) return "dataset";
  if (/baseline|compared|compare|models|system/.test(q)) return "model_comparison";
  if (/architecture|architectures|component|cooperate|chains/.test(q)) return "architecture_or_chain";
  if (/metric|score|evaluated|evaluation|fluency|ranking|stylistic/.test(q)) return "evaluation_metric";
  if (/optimizer|learning rate|performance|impact/.test(q)) return "optimization_effect";
  if (/\b(how many|how much|percent|percentage|size|sizes|large|big|number|vocabulary)\b/.test(q)) return "numeric";
  if (/is there|does|do |did |can |could |should |would /.test(q)) return "yes_no";
  return "generic";
}

function citationShape(countValue) {
  if (countValue <= 1) return "single_citation";
  if (countValue === 2) return "two_citation";
  return "multi_citation";
}

function lexicalScore(question, evidence) {
  const questionTokens = new Set(contentTokens(question));
  const evidenceTokens = contentTokens(`${evidence.section ?? ""} ${evidence.text ?? ""}`);
  if (!questionTokens.size || !evidenceTokens.length) return 0;
  return new Set(evidenceTokens.filter((token) => questionTokens.has(token))).size / questionTokens.size;
}

function directSurfaceBonus(question, evidence) {
  const q = String(question ?? "").toLowerCase();
  const text = `${evidence.section ?? ""} ${evidence.text ?? ""}`.toLowerCase();
  let bonus = 0;
  if (/dataset|data/.test(q) && /dataset|data set|corpus|benchmark|europarl|craigslist|reuters|bloomberg/.test(text)) bonus += 0.55;
  if (/baseline|compared|models|architectures|architecture/.test(q) && /baseline|compare|model|architecture|encoder|decoder|lstm|bert|cnn|matchlstm/.test(text)) bonus += 0.55;
  if (/evaluated|metric|score|fluency|stylistic/.test(q) && /evaluat|metric|score|perplexity|ppl|ranking|annotator/.test(text)) bonus += 0.55;
  if (/optimizers|learning rate|impact/.test(q) && /optimizer|learning rate|adam|sgd|clr|performance/.test(text)) bonus += 0.55;
  if (/\b(how many|how much|percent|percentage|size|sizes|large|big|vocabulary)\b/.test(q) && /\d/.test(text)) bonus += 0.35;
  return bonus;
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
    evidence_first: { sufficiency: "sufficient", supported_claims: claims, missing_support: "", question_target: input.question ?? "exact_question_target" },
    answer: `${claims.map((claim) => claim.claim).join(" ")} ${citations.map((id) => `[${id}]`).join(" ")}`,
    citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function bestSentence(question, evidence) {
  const questionTokens = new Set(contentTokens(question));
  const selected = splitSentences(evidence?.text ?? "")
    .map((sentence) => ({ sentence: cleanSentence(sentence), score: contentTokens(sentence).filter((token) => questionTokens.has(token)).length }))
    .sort((left, right) => right.score - left.score)[0];
  return selected?.sentence || cleanSentence(evidence?.text ?? "");
}

function abstain(question) {
  return {
    answer_type: "abstain",
    evidence_first: { sufficiency: "insufficient", supported_claims: [], missing_support: "The analog-aware constructor did not find direct enough support in the compact evidence pack.", question_target: question ?? "exact_question_target" },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The local analog-aware constructor did not find direct enough support in the compact evidence pack.",
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

function tagsFor(row, existingCorrect, prediction) {
  const tags = [];
  if (row.contract_correct) tags.push("constructor_contract_correct");
  if (!existingCorrect && row.contract_correct) tags.push("adds_new_correct_candidate");
  if (prediction?.metadata?.analog_discount_applied) tags.push("analog_discount_applied");
  if (row.target_answer_type === "abstain" && row.prediction_answer_type === "grounded_answer") tags.push("over_answered_abstention_target");
  if (row.target_answer_type === "grounded_answer" && row.prediction_answer_type === "abstain") tags.push("false_abstention");
  if (row.target_answer_type === "grounded_answer" && row.prediction_answer_type === "grounded_answer" && !row.citation_set_exact) tags.push("citation_selection_error");
  return tags;
}

function statusFor({ constructorCorrect, newCorrect, calibration }) {
  if (newCorrect > Number(d420.metrics?.new_correct_candidates_outside_augmented_pool ?? 0) && constructorCorrect >= 47) return "analog_threshold_adds_headroom_and_matches_router";
  if (newCorrect > Number(d420.metrics?.new_correct_candidates_outside_augmented_pool ?? 0)) return "analog_threshold_adds_headroom_but_not_policy";
  if (calibration.train_heldout.contract_correct <= Number(d420.calibration?.train_heldout?.contract_correct ?? 0)) return "analog_threshold_no_heldout_gain";
  return "analog_threshold_no_validation_headroom_gain";
}

function decisionFor(metrics) {
  const d420New = Number(d420.metrics?.new_correct_candidates_outside_augmented_pool ?? 0);
  const d420Heldout = Number(d420.calibration?.train_heldout?.contract_correct ?? 0);
  const improvedHeadroom = metrics.newCorrect > d420New;
  const improvedHeldout = metrics.calibration.train_heldout.contract_correct > d420Heldout;
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    promote_as_policy: metrics.constructorCorrect >= 47 && improvedHeldout,
    keep_as_candidate_generator: improvedHeadroom && improvedHeldout,
    next_step: improvedHeadroom && improvedHeldout
      ? "Add the analog-aware constructor to a leakage-safe combined-pool router audit."
      : "Reject this analog-threshold repair and create a fresh heldout packet or stronger constructor features before any paid run.",
    reason: improvedHeadroom && improvedHeldout
      ? `Analog-aware thresholding improves train-heldout from ${d420Heldout} to ${metrics.calibration.train_heldout.contract_correct} and new validation headroom from ${d420New} to ${metrics.newCorrect}.`
      : `Analog-aware thresholding does not improve both train-heldout (${metrics.calibration.train_heldout.contract_correct} vs ${d420Heldout}) and new validation headroom (${metrics.newCorrect} vs ${d420New}).`,
  };
}

function renderReport(result) {
  const m = result.metrics;
  return `# Analog-Aware Threshold Constructor Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime compute.

## Calibration

- Train-heldout contract correct: ${result.calibration.train_heldout.contract_correct}/${result.calibration.train_heldout.examples} (${pct(result.calibration.train_heldout.contract_correct_rate)})
- Train-heldout over-answered abstentions: ${result.calibration.train_heldout.over_answered_abstentions}
- Train-heldout citation errors: ${result.calibration.train_heldout.citation_errors}
- Selected params: ${JSON.stringify(result.calibration.params)}

## Metrics

| Policy / pool | Contract correct | Rate |
| --- | ---: | ---: |
| Prior router | ${result.baseline_comparison.prior_router_contract_correct} / ${m.examples} | ${pct(result.baseline_comparison.prior_router_contract_correct / m.examples)} |
| D420 constructor standalone | ${result.baseline_comparison.d420_constructor_standalone_contract_correct} / ${m.examples} | ${pct(result.baseline_comparison.d420_constructor_standalone_contract_correct / m.examples)} |
| Analog-aware constructor standalone | ${m.constructor_contract_correct} / ${m.examples} | ${pct(m.constructor_contract_correct_rate)} |
| D420 combined oracle | ${result.baseline_comparison.d420_combined_oracle_contract_correct} / ${m.examples} | ${pct(result.baseline_comparison.d420_combined_oracle_contract_correct / m.examples)} |
| Analog-aware combined oracle | ${m.combined_augmented_plus_analog_aware_oracle_contract_correct} / ${m.examples} | ${pct(m.combined_augmented_plus_analog_aware_oracle_contract_correct / m.examples)} |

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Promote as policy: ${result.decision.promote_as_policy ? "yes" : "no"}
- Keep as candidate generator: ${result.decision.keep_as_candidate_generator ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
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

function jaccard(left, right) {
  if (!left.size && !right.size) return 0;
  let overlap = 0;
  for (const value of left) if (right.has(value)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
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
