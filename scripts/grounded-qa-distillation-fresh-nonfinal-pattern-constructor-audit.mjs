import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "fresh-nonfinal-pattern-constructor-audit-v1";
const packetRunId = args["packet-run-id"] ?? "frontier-full-nonfinal-packet-2026-06-29-v1";
const d419RunId = args["d419-run-id"] ?? "targeted-citation-pattern-constructor-audit-frontier-repaired-v1";
const d420RunId = args["d420-run-id"] ?? "train-derived-citation-pattern-constructor-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model models dataset datasets task result results use uses is in on of to a an by as or be can it its we our you your over under through between among all three two one do has have had not no yes where when who why".split(" "));

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const d419 = await readJson(path.join(runsDir, d419RunId, "result.json"));
const d420 = await readJson(path.join(runsDir, d420RunId, "result.json"));
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const predictions = prompts.map((prompt) => predictPrompt(prompt));
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);

const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);
const scoredRows = await readJsonl(path.join(runsDir, gateRunId, "scored_predictions.jsonl"));
const auditRows = scoredRows.map((row) => {
  const prediction = predictions.find((candidate) => candidate.example_id === row.example_id);
  return {
    example_id: row.example_id,
    source_split: prompts.find((prompt) => prompt.example_id === row.example_id)?.source_split ?? null,
    target_answer_type: row.target_answer_type,
    prediction_answer_type: row.prediction_answer_type,
    prediction_citations: prediction?.prediction?.citations ?? [],
    intent: prediction?.metadata?.intent ?? null,
    top_score: prediction?.metadata?.top_score ?? null,
    selected_count: prediction?.prediction?.citations?.length ?? 0,
    contract_correct: Boolean(row.contract_correct),
    answer_type_correct: Boolean(row.answer_type_correct),
    citation_set_exact: Boolean(row.citation_set_exact),
    tags: tagsFor(row, prediction),
  };
});

const metrics = summarizeRows(auditRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "fresh_nonfinal_pattern_constructor_audit",
  status: statusFor(metrics),
  purpose: "Evaluate whether the D419 citation-pattern family generalizes to a fresh full nonfinal packet when validation-specific exact-question rules are removed.",
  source_runs: {
    fresh_packet: packetRunId,
    validation_informed_constructor: d419RunId,
    train_derived_constructor: d420RunId,
    contract_gate: gateRunId,
  },
  leakage_note: "This audit uses generic intent/surface rules only. It excludes the D419 exact validation question-to-EID branches. Fresh packet targets are used only by the final contract gate.",
  predictions: {
    examples: predictions.length,
    grounded_answer: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstain: predictions.filter((row) => row.prediction.answer_type === "abstain").length,
  },
  metrics,
  baseline_context: {
    d419_repaired_validation_standalone_contract_correct: Number(d419.metrics?.constructor_contract_correct ?? 0),
    d419_repaired_validation_combined_oracle: Number(d419.metrics?.combined_augmented_plus_targeted_oracle_contract_correct ?? 0),
    d420_repaired_validation_standalone_contract_correct: Number(d420.metrics?.constructor_contract_correct ?? 0),
    d420_repaired_validation_combined_oracle: Number(d420.metrics?.combined_augmented_plus_train_derived_oracle_contract_correct ?? 0),
    note: "These repaired-validation numbers are context only; the fresh nonfinal packet has 315 examples and no augmented candidate-pool oracle in this audit.",
  },
  row_tag_counts: countTags(auditRows.flatMap((row) => row.tags)),
  decision: decisionFor(metrics),
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
    note: "This audit uses local deterministic rules and the local contract gate only.",
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
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function predictPrompt(prompt) {
  const selection = selectCitations(prompt.input);
  const prediction = selection.citations.length ? groundedAnswer(prompt.input, selection.citations) : abstain(prompt.input.question);
  return {
    example_id: prompt.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    metadata: {
      scaffold: "fresh_nonfinal_generic_pattern_constructor",
      validation_specific_exact_rules_removed: true,
      intent: selection.intent,
      top_score: selection.top_score,
      no_model_weights_or_llm_calls: true,
    },
  };
}

function selectCitations(input) {
  const question = String(input.question ?? "");
  const lowerQuestion = question.toLowerCase();
  const intent = questionIntent(question);
  const ranked = (input.compact_retrieved_evidence_pack ?? [])
    .map((evidence) => ({ ...evidence, pattern_score: patternScore(lowerQuestion, evidence, intent), lexical_score: lexicalScore(lowerQuestion, evidence) }))
    .sort((left, right) => (right.pattern_score + right.lexical_score) - (left.pattern_score + left.lexical_score) || left.evidence_id.localeCompare(right.evidence_id));
  const top = (ranked[0]?.pattern_score ?? 0) + (ranked[0]?.lexical_score ?? 0);
  if (top < thresholdFor(intent, lowerQuestion)) return { citations: [], intent, top_score: top };
  const citations = ranked
    .filter((row) => row.pattern_score > 0 && row.pattern_score + row.lexical_score >= Math.max(thresholdFor(intent, lowerQuestion), top - slackFor(intent)))
    .filter((row) => !isLowInformationDuplicate(row))
    .slice(0, maxCitationsFor(intent, lowerQuestion))
    .map((row) => row.evidence_id);
  return { citations, intent, top_score: top };
}

function questionIntent(question) {
  const q = String(question ?? "").toLowerCase();
  if (/dataset|data set|corpus|benchmark|look at|used/.test(q)) return "dataset";
  if (/baseline|compared|compare|models|system/.test(q)) return "model_comparison";
  if (/architecture|architectures|component|cooperate|chains|approach/.test(q)) return "architecture_or_method";
  if (/metric|score|evaluated|evaluation|fluency|ranking|stylistic|measured/.test(q)) return "evaluation_metric";
  if (/optimizer|learning rate|performance|impact|improve|state-of-the-art/.test(q)) return "optimization_effect";
  if (/\b(how many|how much|percent|percentage|size|sizes|large|big|number|vocabulary)\b/.test(q)) return "numeric";
  if (/is there|does|do |did |can |could |should |would /.test(q)) return "yes_no";
  return "generic";
}

function patternScore(lowerQuestion, evidence, intent) {
  const text = `${evidence.section ?? ""} ${evidence.text ?? ""}`.toLowerCase();
  let score = 0;
  if (intent === "dataset" && /dataset|data set|corpus|benchmark|europarl|craigslist|reuters|bloomberg|cnn\/dm|hotpotqa|medhop|wmt|ontonotes|squad/.test(text)) score += 5;
  if (intent === "model_comparison" && /baseline|compare|model comparison|seq2seq|gpt2|bert|lstm|cnn|retrieval-based|state-of-the-art/.test(text)) score += 5;
  if (intent === "architecture_or_method" && /architecture|encoder|decoder|attention|bilstm|matchlstm|ranker|reasoner|module|framework|method|approach|algorithm/.test(text)) score += 5;
  if (intent === "evaluation_metric" && /evaluation|metric|score|perplexity|ppl|ranking|annotator|rouge|bleu|accuracy|f1|human evaluation/.test(text)) score += 5;
  if (intent === "optimization_effect" && /improvement|improves|outperform|performance|learning rate|optimizer|adam|sgd|clr|state of the art|rouge|bleu/.test(text)) score += 5;
  if (intent === "numeric" && /\d/.test(text)) score += 4;
  if (intent === "yes_no" && /show|evidence|yes|no|can|could|whether|is possible|demonstrate|include/.test(text)) score += 3;
  if (intent === "generic" && lexicalScore(lowerQuestion, evidence) >= 0.2) score += 2;
  return score;
}

function thresholdFor(intent, lowerQuestion) {
  if (intent === "yes_no") return 3.3;
  if (intent === "numeric" && /\b(by how much|percentage|percent)\b/.test(lowerQuestion)) return 4.6;
  if (intent === "generic") return 2.5;
  return 4.2;
}

function slackFor(intent) {
  if (intent === "architecture_or_method" || intent === "model_comparison") return 2.6;
  if (intent === "dataset" || intent === "evaluation_metric") return 2.0;
  return 1.5;
}

function maxCitationsFor(intent, lowerQuestion) {
  if (intent === "architecture_or_method" || intent === "model_comparison") return 5;
  if (/all|both|three|list|which/.test(lowerQuestion)) return 4;
  if (intent === "dataset") return 3;
  return 2;
}

function lexicalScore(lowerQuestion, evidence) {
  const questionTokens = new Set(contentTokens(lowerQuestion));
  const evidenceTokens = contentTokens(`${evidence.section ?? ""} ${evidence.text ?? ""}`);
  if (!questionTokens.size || !evidenceTokens.length) return 0;
  return new Set(evidenceTokens.filter((token) => questionTokens.has(token))).size / questionTokens.size;
}

function isLowInformationDuplicate(evidence) {
  const text = String(evidence.text ?? "").replace(/\s+/g, " ").trim();
  return text.length < 40 && !/seq2seq|gpt2|bert|ranking|rouge|bleu|dataset/.test(text.toLowerCase());
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
    evidence_first: { sufficiency: "insufficient", supported_claims: [], missing_support: "The generic pattern constructor did not find direct enough support in the compact evidence pack.", question_target: question ?? "exact_question_target" },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The local generic pattern constructor did not find direct enough support in the compact evidence pack.",
  };
}

async function runContractGate(gateRunId, predictionsPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join("scripts", "grounded-qa-distillation-evidence-first-contract-preflight.mjs"),
      `--packet-run-id=${packetRunId}`,
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

function summarizeRows(rows) {
  const correct = count(rows, (row) => row.contract_correct);
  return {
    examples: rows.length,
    contract_correct: correct,
    contract_correct_rate: rate(correct, rows.length),
    answer_type_correct: count(rows, (row) => row.answer_type_correct),
    citation_set_exact: count(rows, (row) => row.citation_set_exact),
    target_grounded_answer: count(rows, (row) => row.target_answer_type === "grounded_answer"),
    predicted_grounded_answer: count(rows, (row) => row.prediction_answer_type === "grounded_answer"),
    false_abstentions: count(rows, (row) => row.target_answer_type === "grounded_answer" && row.prediction_answer_type === "abstain"),
    over_answered_abstentions: count(rows, (row) => row.target_answer_type === "abstain" && row.prediction_answer_type === "grounded_answer"),
    citation_errors_on_grounded_predictions: count(rows, (row) => row.target_answer_type === "grounded_answer" && row.prediction_answer_type === "grounded_answer" && !row.citation_set_exact),
    by_intent: summarizeBy(rows, (row) => row.intent),
    by_source_split: summarizeBy(rows, (row) => row.source_split ?? "unknown"),
  };
}

function summarizeBy(rows, keyFn) {
  const out = {};
  for (const row of rows) {
    const key = keyFn(row);
    if (!out[key]) out[key] = { examples: 0, contract_correct: 0, predicted_grounded_answer: 0, target_grounded_answer: 0 };
    out[key].examples += 1;
    if (row.contract_correct) out[key].contract_correct += 1;
    if (row.prediction_answer_type === "grounded_answer") out[key].predicted_grounded_answer += 1;
    if (row.target_answer_type === "grounded_answer") out[key].target_grounded_answer += 1;
  }
  return out;
}

function tagsFor(row, prediction) {
  const tags = [prediction?.metadata?.intent ?? "unknown_intent"];
  if (row.contract_correct) tags.push("contract_correct");
  if (row.target_answer_type === "grounded_answer" && row.prediction_answer_type === "abstain") tags.push("false_abstention");
  if (row.target_answer_type === "abstain" && row.prediction_answer_type === "grounded_answer") tags.push("over_answered_abstention_target");
  if (row.target_answer_type === "grounded_answer" && row.prediction_answer_type === "grounded_answer" && !row.citation_set_exact) tags.push("citation_selection_error");
  return tags;
}

function statusFor(metrics) {
  if (metrics.contract_correct_rate >= 0.7 && metrics.over_answered_abstentions <= metrics.false_abstentions) return "generic_pattern_constructor_transfers_to_fresh_nonfinal";
  if (metrics.contract_correct_rate >= 0.55) return "generic_pattern_constructor_partial_fresh_transfer";
  return "generic_pattern_constructor_fails_fresh_transfer";
}

function decisionFor(metrics) {
  const transfers = metrics.contract_correct_rate >= 0.55;
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    promote_constructor_family: false,
    keep_as_fresh_transfer_signal: transfers,
    next_step: transfers
      ? "Mine the fresh nonfinal successes/failures into train-derived citation-set features before any paid model run."
      : "Do not continue hand-built pattern constructors; move to a learned citation-set predictor or a small paid teacher-label packet.",
    reason: transfers
      ? `The generic D419-style constructor reaches ${metrics.contract_correct}/${metrics.examples} on fresh nonfinal without validation-specific rules, enough for feature mining but not promotion.`
      : `The generic D419-style constructor reaches only ${metrics.contract_correct}/${metrics.examples} on fresh nonfinal, so the validation-informed D419 success does not transfer as a standalone rule family.`,
  };
}

function renderReport(result) {
  const m = result.metrics;
  return `# Fresh Nonfinal Pattern Constructor Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime compute. It removes the D419 validation-specific exact-question rules and evaluates generic pattern construction on a fresh nonfinal packet.

## Metrics

- Examples: ${m.examples}
- Contract correct: ${m.contract_correct}/${m.examples} (${pct(m.contract_correct_rate)})
- Answer-type correct: ${m.answer_type_correct}/${m.examples}
- Citation-set exact: ${m.citation_set_exact}/${m.examples}
- Target grounded answers: ${m.target_grounded_answer}
- Predicted grounded answers: ${m.predicted_grounded_answer}
- False abstentions: ${m.false_abstentions}
- Over-answered abstentions: ${m.over_answered_abstentions}
- Citation errors on grounded predictions: ${m.citation_errors_on_grounded_predictions}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Promote constructor family: ${result.decision.promote_constructor_family ? "yes" : "no"}
- Keep as fresh transfer signal: ${result.decision.keep_as_fresh_transfer_signal ? "yes" : "no"}
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
