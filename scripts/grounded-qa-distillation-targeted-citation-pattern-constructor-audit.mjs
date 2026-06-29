import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "targeted-citation-pattern-constructor-audit-frontier-repaired-v1";
const validationPacketRunId = args["validation-packet-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const augmentedRunId = args["augmented-router-run-id"] ?? "augmented-constructor-router-audit-frontier-repaired-v1";
const gapRunId = args["gap-run-id"] ?? "two-head-gap-taxonomy-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model models dataset datasets task result results use uses is in on of to a an by as or be can it its we our you your over under through between among all three two one do".split(" "));

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const augmented = await readJson(path.join(runsDir, augmentedRunId, "result.json"));
const validationPrompts = await readJsonl(path.join(runsDir, validationPacketRunId, "dataset", "eval_prompts.jsonl"));
const candidateRows = await readJsonl(path.join(runsDir, augmentedRunId, "validation_candidate_rows.jsonl"));
const gapRows = await readJsonl(path.join(runsDir, gapRunId, "gap_rows.jsonl"));
const irrecoverableIds = new Set(gapRows.filter((row) => row.gap_class === "irrecoverable_construction_gap").map((row) => row.example_id));
const augmentedCorrectById = groupBy(candidateRows.filter((row) => row.label_contract_correct), (row) => row.example_id);

const predictions = validationPrompts.map((prompt) => predictPrompt(prompt));
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);

const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath, validationPacketRunId);
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
    d418_irrecoverable_construction_gap: irrecoverableIds.has(row.example_id),
    adds_new_correct_candidate: !existingCorrect && Boolean(row.contract_correct),
    repairs_d418_irrecoverable_gap: irrecoverableIds.has(row.example_id) && Boolean(row.contract_correct),
    tags: tagsFor(row, existingCorrect),
  };
});

const constructorCorrect = count(auditRows, (row) => row.contract_correct);
const newCorrect = count(auditRows, (row) => row.adds_new_correct_candidate);
const repairedD418 = count(auditRows, (row) => row.repairs_d418_irrecoverable_gap);
const augmentedOracle = Number(augmented.oracle?.repaired_validation_gate?.contract_correct ?? 0);
const combinedOracle = augmentedOracle + newCorrect;
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "targeted_citation_pattern_constructor_audit",
  status: statusFor(newCorrect, repairedD418),
  purpose: "Probe whether targeted citation-pattern construction can create correct grounded candidates on D418 irrecoverable rows without OpenAI calls or GPU jobs.",
  source_runs: {
    validation_packet: validationPacketRunId,
    augmented_router: augmentedRunId,
    gap_taxonomy: gapRunId,
    contract_gate: gateRunId,
  },
  leakage_note: "This is a validation-informed diagnostic probe built after inspecting D418 miss taxonomy and evidence surfaces. It is not a deployable policy and must be converted into train-derived features or a fresh heldout packet before paper claims.",
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
    d418_irrecoverable_construction_gaps: irrecoverableIds.size,
    constructor_correct_on_d418_irrecoverable_gaps: repairedD418,
    new_correct_candidates_outside_augmented_pool: newCorrect,
    augmented_pool_oracle_contract_correct: augmentedOracle,
    combined_augmented_plus_targeted_oracle_contract_correct: combinedOracle,
    combined_oracle_delta: combinedOracle - augmentedOracle,
  },
  baseline_comparison: {
    prior_router_contract_correct: 47,
    d417_two_head_contract_correct: 47,
    augmented_pool_oracle_contract_correct: augmentedOracle,
    targeted_constructor_standalone_contract_correct: constructorCorrect,
    combined_oracle_contract_correct: combinedOracle,
    combined_oracle_remaining_gap_to_70: 70 - combinedOracle,
  },
  row_tag_counts: countTags(auditRows.flatMap((row) => row.tags)),
  decision: decisionFor({ constructorCorrect, repairedD418, newCorrect, combinedOracle, augmentedOracle }),
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
    note: "This probe uses deterministic citation-pattern rules and the local contract gate only.",
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
  predictions: result.predictions,
  metrics: result.metrics,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function predictPrompt(prompt) {
  const citations = selectCitations(prompt.input);
  const prediction = citations.length ? groundedAnswer(prompt.input, citations) : abstain(prompt.input.question);
  return {
    example_id: prompt.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    metadata: {
      scaffold: "targeted_citation_pattern_constructor",
      validation_informed_diagnostic: true,
      no_model_weights_or_llm_calls: true,
    },
  };
}

function selectCitations(input) {
  const question = String(input.question ?? "");
  const lowerQuestion = question.toLowerCase();
  const evidencePack = input.compact_retrieved_evidence_pack ?? [];
  const evidenceById = new Map(evidencePack.map((evidence) => [evidence.evidence_id, evidence]));

  const exactPattern = exactPatternCitations(lowerQuestion, evidenceById);
  if (exactPattern.length) return exactPattern;

  const ranked = evidencePack
    .map((evidence) => ({ ...evidence, pattern_score: patternScore(lowerQuestion, evidence), lexical_score: lexicalScore(lowerQuestion, evidence) }))
    .sort((left, right) => (right.pattern_score + right.lexical_score) - (left.pattern_score + left.lexical_score) || left.evidence_id.localeCompare(right.evidence_id));
  const top = (ranked[0]?.pattern_score ?? 0) + (ranked[0]?.lexical_score ?? 0);
  if (top < 4) return [];
  const selected = ranked
    .filter((row) => row.pattern_score > 0 && row.pattern_score + row.lexical_score >= Math.max(4, top - 2.5))
    .filter((row) => !isLowInformationDuplicate(row))
    .slice(0, maxCitationsFor(lowerQuestion))
    .map((row) => row.evidence_id);
  return selected;
}

function exactPatternCitations(lowerQuestion, evidenceById) {
  const has = (id, pattern) => pattern.test(`${evidenceById.get(id)?.section ?? ""} ${evidenceById.get(id)?.text ?? ""}`.toLowerCase());
  if (/which models.*compared|compared to/.test(lowerQuestion)) return ids(["E4"], has, /word-lstm|word-cnn|bert|text classification models/);
  if (/existing baseline models/.test(lowerQuestion)) return ids(["E1", "E2", "E5", "E6"], has, /seq2seq|gpt2-ft|generative approaches|retrieval-based|model comparison/);
  if (/cooperate.*confident chains/.test(lowerQuestion)) return ids(["E2", "E3"], has, /ranker|reasoner|passage scoring|cooperative/);
  if (/two models.*architectures|architectures.*proposed solution/.test(lowerQuestion)) return ids(["E4", "E1", "E2", "E6", "E5"], has, /passage ranking model|cooperative reasoner|matchlstm|ranker model/);
  if (/news-driven stock movement/.test(lowerQuestion)) return ids(["E1"], has, /reuters|bloomberg|s&p|financial news/);
  if (/fluency automatically evaluated/.test(lowerQuestion)) return ids(["E3"], has, /perplexity|ppl|gpt-2/);
  if (/architectures used for the three tasks/.test(lowerQuestion)) return ids(["E1", "E3", "E5"], has, /lemmatization|morphological analysis|inflectional realization|encoder-decoder/);
  if (/datasets do they look at/.test(lowerQuestion)) return ids(["E4"], has, /europarl|newstest|parallel data/);
  if (/vocabulary sizes/.test(lowerQuestion)) return ids(["E2"], has, /8k|32k|target vocabulary|source vocabulary/);
  if (/datasets are used/.test(lowerQuestion)) return ids(["E2", "E4"], has, /craigslist bargaining|cb dataset/);
  if (/optimizers.*learning rate|learning rate.*optimizers/.test(lowerQuestion)) return ids(["E2", "E3"], has, /clr|learning rate|adam|sgd|inverse square root|positive impacts/);
  if (/metric.*stylistic response|rewards good stylistic/.test(lowerQuestion)) return ids(["E1"], has, /ranking|style expression|content quality/);
  return [];
}

function ids(candidateIds, has, pattern) {
  return candidateIds.filter((id) => has(id, pattern));
}

function patternScore(lowerQuestion, evidence) {
  const text = `${evidence.section ?? ""} ${evidence.text ?? ""}`.toLowerCase();
  let score = 0;
  if (/dataset|data/.test(lowerQuestion) && /dataset|data set|corpus|benchmark|europarl|craigslist|reuters|bloomberg/.test(text)) score += 5;
  if (/baseline|compared|models/.test(lowerQuestion) && /baseline|compare|model comparison|seq2seq|gpt2-ft|word-lstm|word-cnn|bert|retrieval-based/.test(text)) score += 5;
  if (/architectures|architecture/.test(lowerQuestion) && /architecture|encoder-decoder|bilstm|matchlstm|ranker model|reasoner|lemmatization|morphological analysis|inflectional/.test(text)) score += 5;
  if (/cooperate|confident chains/.test(lowerQuestion) && /ranker|reasoner|distribution|selected passages|cooperative/.test(text)) score += 5;
  if (/evaluated|metric|score|fluency|stylistic/.test(lowerQuestion) && /evaluation|metric|perplexity|ppl|ranking|annotators|style expression/.test(text)) score += 5;
  if (/impact|optimizers|learning rate/.test(lowerQuestion) && /clr|learning rate|adam|sgd|inverse square root|performance|positive impacts/.test(text)) score += 5;
  return score;
}

function lexicalScore(lowerQuestion, evidence) {
  const questionTokens = new Set(contentTokens(lowerQuestion));
  const evidenceTokens = contentTokens(`${evidence.section ?? ""} ${evidence.text ?? ""}`);
  if (!questionTokens.size || !evidenceTokens.length) return 0;
  return new Set(evidenceTokens.filter((token) => questionTokens.has(token))).size / questionTokens.size;
}

function maxCitationsFor(lowerQuestion) {
  if (/architectures|baseline|cooperate|optimizers/.test(lowerQuestion)) return 5;
  if (/datasets are used/.test(lowerQuestion)) return 2;
  return 3;
}

function isLowInformationDuplicate(evidence) {
  const text = String(evidence.text ?? "").replace(/\s+/g, " ").trim();
  return text.length < 40 && !/seq2seq|gpt2-ft|passage ranking model|cooperative reasoner|ranking/.test(text.toLowerCase());
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
      missing_support: "The citation-pattern constructor did not find a direct enough evidence pattern.",
      question_target: question ?? "exact_question_target",
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The local constructor did not find direct enough support in the compact evidence pack.",
  };
}

async function runContractGate(gateRunId, predictionsPath, validationRunId) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join("scripts", "grounded-qa-distillation-evidence-first-contract-preflight.mjs"),
      `--packet-run-id=${validationRunId}`,
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

function statusFor(newCorrect, repairedD418) {
  if (newCorrect >= 8 && repairedD418 >= 8) return "targeted_constructor_closes_most_construction_gaps";
  if (newCorrect > 0) return "targeted_constructor_adds_candidate_headroom";
  return "targeted_constructor_negative";
}

function decisionFor(metrics) {
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    promote_as_policy: false,
    keep_as_diagnostic_candidate_family: metrics.newCorrect > 0,
    next_step: metrics.newCorrect > 0
      ? "Convert the successful citation-pattern rules into train-derived features or generate a fresh heldout packet before spending on a learned constructor."
      : "Reject this citation-pattern family and move to a stronger candidate generator.",
    reason: `The validation-informed constructor adds ${metrics.newCorrect} new correct candidates, repairing ${metrics.repairedD418} D418 construction gaps and moving oracle headroom from ${metrics.augmentedOracle}/70 to ${metrics.combinedOracle}/70. Because it was designed after inspecting validation misses, it is diagnostic only.`,
  };
}

function renderReport(result) {
  const m = result.metrics;
  return `# Targeted Citation-Pattern Constructor Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime compute.

## Metrics

| Policy / pool | Contract correct | Rate |
| --- | ---: | ---: |
| Prior router | ${result.baseline_comparison.prior_router_contract_correct} / ${m.examples} | ${pct(result.baseline_comparison.prior_router_contract_correct / m.examples)} |
| D417 two-head selector | ${result.baseline_comparison.d417_two_head_contract_correct} / ${m.examples} | ${pct(result.baseline_comparison.d417_two_head_contract_correct / m.examples)} |
| Targeted constructor standalone | ${m.constructor_contract_correct} / ${m.examples} | ${pct(m.constructor_contract_correct_rate)} |
| Augmented pool oracle | ${m.augmented_pool_oracle_contract_correct} / ${m.examples} | ${pct(m.augmented_pool_oracle_contract_correct / m.examples)} |
| Augmented + targeted oracle | ${m.combined_augmented_plus_targeted_oracle_contract_correct} / ${m.examples} | ${pct(m.combined_augmented_plus_targeted_oracle_contract_correct / m.examples)} |

## Construction Gap

- D418 irrecoverable construction gaps: ${m.d418_irrecoverable_construction_gaps}
- Correct on D418 irrecoverable gaps: ${m.constructor_correct_on_d418_irrecoverable_gaps}
- New correct candidates outside augmented pool: ${m.new_correct_candidates_outside_augmented_pool}
- Combined oracle delta: +${m.combined_oracle_delta}
- Combined oracle remaining gap to 70: ${result.baseline_comparison.combined_oracle_remaining_gap_to_70}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Promote as policy: ${result.decision.promote_as_policy ? "yes" : "no"}
- Keep as diagnostic candidate family: ${result.decision.keep_as_diagnostic_candidate_family ? "yes" : "no"}
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
