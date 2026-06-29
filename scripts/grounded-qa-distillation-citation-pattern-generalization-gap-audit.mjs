import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "citation-pattern-generalization-gap-audit-frontier-repaired-v1";
const launchPacketRunId = args["launch-packet-run-id"] ?? "frontier-repaired-launch-packet-2026-06-29-v1";
const validationPacketRunId = args["validation-packet-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const d419RunId = args["d419-run-id"] ?? "targeted-citation-pattern-constructor-audit-frontier-repaired-v1";
const d420RunId = args["d420-run-id"] ?? "train-derived-citation-pattern-constructor-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model models dataset datasets task result results use uses is in on of to a an by as or be can it its we our you your over under through between among all three two one do has have had not no yes where when who why".split(" "));

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const trainRows = (await readJsonl(path.join(runsDir, launchPacketRunId, "dataset", "sft_train.jsonl")))
  .map((row) => ({ example_id: row.example_id, input: row.input, target: row.target }));
const validationPrompts = await readJsonl(path.join(runsDir, validationPacketRunId, "dataset", "eval_prompts.jsonl"));
const validationTargets = await readJsonl(path.join(runsDir, validationPacketRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const d419Rows = await readJsonl(path.join(runsDir, d419RunId, "rows.jsonl"));
const d419Predictions = await readJsonl(path.join(runsDir, d419RunId, "predictions.jsonl"));
const d420Rows = await readJsonl(path.join(runsDir, d420RunId, "rows.jsonl"));
const d420Predictions = await readJsonl(path.join(runsDir, d420RunId, "predictions.jsonl"));
const d419 = await readJson(path.join(runsDir, d419RunId, "result.json"));
const d420 = await readJson(path.join(runsDir, d420RunId, "result.json"));

const validationPromptById = new Map(validationPrompts.map((row) => [row.example_id, row]));
const validationTargetById = new Map(validationTargets.map((row) => [row.example_id, row.target]));
const d419PredictionById = new Map(d419Predictions.map((row) => [row.example_id, row.prediction]));
const d420PredictionById = new Map(d420Predictions.map((row) => [row.example_id, row.prediction]));
const d420RowById = new Map(d420Rows.map((row) => [row.example_id, row]));
const groundedTrainRows = trainRows.filter((row) => row.target.answer_type === "grounded_answer");

const rescueRows = d419Rows
  .filter((row) => row.adds_new_correct_candidate)
  .map((row) => analyzeRescue(row))
  .sort((left, right) => left.d420_outcome.localeCompare(right.d420_outcome) || left.analog_class.localeCompare(right.analog_class) || left.example_id.localeCompare(right.example_id));

const summary = summarize(rescueRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "citation_pattern_generalization_gap_audit",
  status: statusFor(summary),
  purpose: "Explain why D419's validation-informed citation-pattern constructor repaired 12 construction gaps while the train-derived D420 version repaired only 2.",
  source_runs: {
    launch_packet: launchPacketRunId,
    validation_packet: validationPacketRunId,
    validation_informed_constructor: d419RunId,
    train_derived_constructor: d420RunId,
  },
  leakage_note: "This audit inspects validation rows after D419/D420 to diagnose generalization. It makes no policy-selection claim and must not be used to tune validation thresholds.",
  comparison: {
    d419_new_correct_candidates: Number(d419.metrics?.new_correct_candidates_outside_augmented_pool ?? 0),
    d419_combined_oracle: Number(d419.metrics?.combined_augmented_plus_targeted_oracle_contract_correct ?? 0),
    d420_new_correct_candidates: Number(d420.metrics?.new_correct_candidates_outside_augmented_pool ?? 0),
    d420_combined_oracle: Number(d420.metrics?.combined_augmented_plus_train_derived_oracle_contract_correct ?? 0),
    d420_train_heldout_contract_correct: Number(d420.calibration?.train_heldout?.contract_correct ?? 0),
    d420_train_heldout_examples: Number(d420.calibration?.train_heldout?.examples ?? 0),
  },
  summary,
  decision: decisionFor(summary),
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
    note: "Local deterministic audit over existing run artifacts.",
  },
  artifacts: {
    rescue_rows_jsonl: rel(path.join(outputDir, "rescue_rows.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "rescue_rows.jsonl"), rescueRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  comparison: result.comparison,
  summary: result.summary,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function analyzeRescue(d419Row) {
  const prompt = validationPromptById.get(d419Row.example_id);
  const target = validationTargetById.get(d419Row.example_id);
  const d419Prediction = d419PredictionById.get(d419Row.example_id);
  const d420Prediction = d420PredictionById.get(d419Row.example_id);
  const d420Row = d420RowById.get(d419Row.example_id);
  const citations = normalizeCitations(d419Prediction?.citations);
  const citedEvidence = citations.map((id) => (prompt?.input?.compact_retrieved_evidence_pack ?? []).find((evidence) => evidence.evidence_id === id)).filter(Boolean);
  const signature = rowSignature(prompt?.input, target, citations, citedEvidence);
  const analogs = groundedTrainRows
    .map((trainRow) => ({ ...trainAnalogScore(signature, trainRow), example_id: trainRow.example_id, question: trainRow.input.question, target_citations: normalizeCitations(trainRow.target.citations) }))
    .sort((left, right) => right.score - left.score || left.example_id.localeCompare(right.example_id));
  const strongAnalogs = analogs.filter((row) => row.score >= 0.62);
  const weakAnalogs = analogs.filter((row) => row.score >= 0.42);
  const sameIntent = groundedTrainRows.filter((row) => questionIntent(row.input.question) === signature.intent);
  const sameIntentSameShape = sameIntent.filter((row) => citationShape(normalizeCitations(row.target.citations).length) === signature.citation_shape);
  const d420Citations = normalizeCitations(d420Prediction?.citations);
  const d420Outcome = d420Row?.contract_correct
    ? "recovered_by_d420"
    : d420Prediction?.answer_type === "abstain"
      ? "d420_false_abstention"
      : setOverlap(new Set(d420Citations), new Set(citations)) > 0
        ? "d420_partial_citation"
        : "d420_wrong_answer";
  return {
    example_id: d419Row.example_id,
    question: prompt?.input?.question ?? "",
    intent: signature.intent,
    citation_count: citations.length,
    citation_shape: signature.citation_shape,
    d419_citations: citations,
    d420_outcome: d420Outcome,
    d420_citations: d420Citations,
    target_citations: normalizeCitations(target?.citations),
    same_intent_train_grounded: sameIntent.length,
    same_intent_same_shape_train_grounded: sameIntentSameShape.length,
    strong_train_analogs: strongAnalogs.length,
    weak_train_analogs: weakAnalogs.length,
    analog_class: strongAnalogs.length ? "strong_train_analog" : weakAnalogs.length ? "weak_train_analog_only" : "no_close_train_analog",
    best_train_analogs: analogs.slice(0, 5).map((row) => ({
      example_id: row.example_id,
      score: row.score,
      intent_match: row.intent_match,
      citation_shape_match: row.citation_shape_match,
      question_jaccard: row.question_jaccard,
      section_jaccard: row.section_jaccard,
      target_evidence_token_jaccard: row.target_evidence_token_jaccard,
      question: row.question,
      target_citations: row.target_citations,
    })),
    tags: tagsFor({ signature, d420Outcome, strongAnalogs, weakAnalogs, sameIntentSameShape }),
  };
}

function rowSignature(input, target, citations, citedEvidence) {
  return {
    intent: questionIntent(input?.question),
    citation_shape: citationShape(citations.length),
    question_tokens: new Set(contentTokens(input?.question)),
    cited_section_tokens: new Set(citedEvidence.flatMap((evidence) => contentTokens(evidence.section))),
    cited_evidence_tokens: new Set(citedEvidence.flatMap((evidence) => contentTokens(evidence.text))),
    answer_tokens: new Set(contentTokens(target?.answer)),
  };
}

function trainAnalogScore(signature, trainRow) {
  const citations = normalizeCitations(trainRow.target.citations);
  const citedEvidence = citations.map((id) => (trainRow.input.compact_retrieved_evidence_pack ?? []).find((evidence) => evidence.evidence_id === id)).filter(Boolean);
  const trainSignature = rowSignature(trainRow.input, trainRow.target, citations, citedEvidence);
  const intentMatch = signature.intent === trainSignature.intent;
  const citationShapeMatch = signature.citation_shape === trainSignature.citation_shape;
  const questionJaccard = jaccard(signature.question_tokens, trainSignature.question_tokens);
  const sectionJaccard = jaccard(signature.cited_section_tokens, trainSignature.cited_section_tokens);
  const targetEvidenceTokenJaccard = jaccard(signature.cited_evidence_tokens, trainSignature.cited_evidence_tokens);
  const answerJaccard = jaccard(signature.answer_tokens, trainSignature.answer_tokens);
  return {
    score: (intentMatch ? 0.25 : 0) + (citationShapeMatch ? 0.18 : 0) + questionJaccard * 0.28 + sectionJaccard * 0.16 + targetEvidenceTokenJaccard * 0.1 + answerJaccard * 0.03,
    intent_match: intentMatch,
    citation_shape_match: citationShapeMatch,
    question_jaccard: questionJaccard,
    section_jaccard: sectionJaccard,
    target_evidence_token_jaccard: targetEvidenceTokenJaccard,
    answer_jaccard: answerJaccard,
  };
}

function summarize(rows) {
  return {
    d419_rescue_rows: rows.length,
    d420_recovered: count(rows, (row) => row.d420_outcome === "recovered_by_d420"),
    d420_false_abstentions: count(rows, (row) => row.d420_outcome === "d420_false_abstention"),
    d420_partial_citation: count(rows, (row) => row.d420_outcome === "d420_partial_citation"),
    d420_wrong_answer: count(rows, (row) => row.d420_outcome === "d420_wrong_answer"),
    by_intent: countBy(rows, (row) => row.intent),
    by_citation_shape: countBy(rows, (row) => row.citation_shape),
    by_analog_class: countBy(rows, (row) => row.analog_class),
    recovered_by_analog_class: countBy(rows.filter((row) => row.d420_outcome === "recovered_by_d420"), (row) => row.analog_class),
    failed_by_analog_class: countBy(rows.filter((row) => row.d420_outcome !== "recovered_by_d420"), (row) => row.analog_class),
    rows_with_same_intent_same_shape_train_support: count(rows, (row) => row.same_intent_same_shape_train_grounded > 0),
    rows_without_same_intent_same_shape_train_support: count(rows, (row) => row.same_intent_same_shape_train_grounded === 0),
    failure_tag_counts: countTags(rows.flatMap((row) => row.tags)),
  };
}

function statusFor(summary) {
  if (summary.d420_false_abstentions >= summary.d419_rescue_rows / 2 && summary.rows_with_same_intent_same_shape_train_support >= summary.d419_rescue_rows / 2) return "generalization_gap_thresholding_not_coverage";
  if (summary.rows_without_same_intent_same_shape_train_support >= summary.d419_rescue_rows / 2) return "generalization_gap_train_coverage";
  return "generalization_gap_mixed";
}

function decisionFor(summary) {
  if (summary.status === "unused") throw new Error("unreachable");
  const thresholding = summary.d420_false_abstentions >= summary.d419_rescue_rows / 2 && summary.rows_with_same_intent_same_shape_train_support >= summary.d419_rescue_rows / 2;
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    use_saved_openai_key_now: false,
    next_step: thresholding
      ? "Run a leakage-safe threshold/feature audit over train-heldout analog classes before creating new paid labels or renting GPUs."
      : "Create a fresh heldout packet or mine more train analogs before investing in a learned constructor.",
    reason: thresholding
      ? `${summary.d420_false_abstentions}/${summary.d419_rescue_rows} D419 rescues become D420 false abstentions, while ${summary.rows_with_same_intent_same_shape_train_support}/${summary.d419_rescue_rows} have same-intent/same-shape grounded train support. This points first to thresholding/features, not missing training coverage.`
      : `${summary.rows_without_same_intent_same_shape_train_support}/${summary.d419_rescue_rows} D419 rescues lack same-intent/same-shape grounded train support, so more training coverage or a fresh heldout test is needed before paid work.`,
  };
}

function tagsFor({ signature, d420Outcome, strongAnalogs, weakAnalogs, sameIntentSameShape }) {
  const tags = [d420Outcome, signature.intent, signature.citation_shape];
  if (strongAnalogs.length) tags.push("has_strong_train_analog");
  else if (weakAnalogs.length) tags.push("has_weak_train_analog");
  else tags.push("no_close_train_analog");
  if (sameIntentSameShape.length) tags.push("same_intent_same_shape_train_support");
  else tags.push("no_same_intent_same_shape_train_support");
  return tags;
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

function renderReport(result) {
  const s = result.summary;
  return `# Citation Pattern Generalization Gap Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls and launches no Prime compute.

## D419 vs D420

- D419 new correct candidates: ${result.comparison.d419_new_correct_candidates}
- D419 combined oracle: ${result.comparison.d419_combined_oracle}/70
- D420 new correct candidates: ${result.comparison.d420_new_correct_candidates}
- D420 combined oracle: ${result.comparison.d420_combined_oracle}/70
- D420 train-heldout: ${result.comparison.d420_train_heldout_contract_correct}/${result.comparison.d420_train_heldout_examples}

## Rescue Breakdown

- D419 rescue rows inspected: ${s.d419_rescue_rows}
- Recovered by D420: ${s.d420_recovered}
- D420 false abstentions: ${s.d420_false_abstentions}
- D420 partial citation errors: ${s.d420_partial_citation}
- D420 wrong answers: ${s.d420_wrong_answer}
- Rows with same-intent/same-shape grounded train support: ${s.rows_with_same_intent_same_shape_train_support}
- Rows without same-intent/same-shape grounded train support: ${s.rows_without_same_intent_same_shape_train_support}
- By intent: ${JSON.stringify(s.by_intent)}
- By citation shape: ${JSON.stringify(s.by_citation_shape)}
- By analog class: ${JSON.stringify(s.by_analog_class)}
- Failure tags: ${JSON.stringify(s.failure_tag_counts)}

## Decision

- Use saved OpenAI key now: ${result.decision.use_saved_openai_key_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation)).filter(Boolean);
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

function setOverlap(left, right) {
  let overlap = 0;
  for (const value of left) if (right.has(value)) overlap += 1;
  return overlap;
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countBy(rows, keyFn) {
  const counts = {};
  for (const row of rows) {
    const key = keyFn(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function countTags(tags) {
  const counts = {};
  for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
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
