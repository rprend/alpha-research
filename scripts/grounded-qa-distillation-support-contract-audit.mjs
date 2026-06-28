import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runsDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "extended_temporal_future_holdout";
const predictionRun = requiredArg("prediction-run");
const judgeRun = requiredArg("judge-run");
const runId = args["run-id"] ?? `support-contract-audit-${predictionRun}`;
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const referencesById = new Map(references.map((row) => [row.example_id, row]));
const predictions = await readJsonl(path.join(runsDir, predictionRun, "predictions.jsonl"));
const judgments = await readJsonl(path.join(runsDir, judgeRun, "judgments.jsonl"));
const predictionsById = new Map(predictions.map((row) => [row.example_id, row]));

const rows = judgments
  .filter((judgment) => !judgment.skipped)
  .map((judgment) => auditRow({ judgment, predictionRow: predictionsById.get(judgment.example_id), reference: referencesById.get(judgment.example_id) }));

const answeredRows = rows.filter((row) => row.prediction_answer_type === "grounded_answer");
const invalidJudgmentRows = rows.filter((row) => row.judge_verdict === "invalid");
const invalidAnsweredRows = invalidJudgmentRows.filter((row) => row.prediction_answer_type === "grounded_answer");
const supportFailures = answeredRows.filter((row) => !row.supported_answer);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "support_contract_audit",
  status: statusFor({ rows, invalidAnsweredRows }),
  split,
  prediction_run: predictionRun,
  judge_run: judgeRun,
  examples: rows.length,
  answered: answeredRows.length,
  abstained: rows.length - answeredRows.length,
  invalid_judgments: invalidJudgmentRows.length,
  invalid_answered_judgments: invalidAnsweredRows.length,
  supported_answers: answeredRows.filter((row) => row.supported_answer).length,
  unsupported_or_invalid_answers: supportFailures.length,
  top_level_citation_contract: summarizeContract(answeredRows, "top_level"),
  inline_citation_contract: summarizeContract(answeredRows, "inline"),
  claim_table_citation_contract: summarizeContract(answeredRows, "claim_table"),
  invalid_judgment_explanation_counts: counts(invalidAnsweredRows.flatMap((row) => row.explanation_tags)),
  support_failure_explanation_counts: counts(supportFailures.flatMap((row) => row.explanation_tags)),
  rows,
  interpretation: {
    llm_budget: "No LLM calls. This audit deterministically joins existing predictions, paid judge outputs, and reference evidence packs.",
    main_read: "Invalid judge verdicts are evidence of output-contract/citation failures unless the prediction has complete valid top-level, inline, and claim-table citations.",
    next_step: "Do not spend on another GPU run until a deterministic pre-judge contract gate or training target suppresses claim-table/top-level citation mismatch and counterfactual answered rows.",
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
  },
};

await writeJsonl(path.join(outputDir, "rows.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  invalid_answered_judgments: result.invalid_answered_judgments,
  top_level_citation_contract: result.top_level_citation_contract,
  claim_table_citation_contract: result.claim_table_citation_contract,
  invalid_judgment_explanation_counts: result.invalid_judgment_explanation_counts,
}, null, 2));

function auditRow({ judgment, predictionRow, reference }) {
  const prediction = normalizePrediction(predictionRow?.prediction ?? {});
  const evidenceIds = new Set((reference?.input?.compact_retrieved_evidence_pack ?? []).map((row) => row.evidence_id).filter(Boolean));
  const inlineIds = extractInlineCitationIds(prediction.answer);
  const claimTableIds = extractClaimTableCitationIds(prediction.claim_table);
  const topLevel = citationContract(prediction.citations, evidenceIds);
  const inline = citationContract(inlineIds, evidenceIds);
  const claimTable = citationContract(claimTableIds, evidenceIds);
  const judgePayload = judgment.judgment ?? {};
  const supportedAnswer = prediction.answer_type === "grounded_answer"
    && judgePayload.verdict === "supported"
    && judgePayload.all_claims_supported === true
    && judgePayload.citation_ids_valid !== false;
  const tags = explanationTags({
    prediction,
    reference,
    judgePayload,
    topLevel,
    inline,
    claimTable,
  });
  return {
    example_id: judgment.example_id,
    prediction_answer_type: prediction.answer_type,
    reference_answer_type: reference?.output?.answer_type ?? null,
    counterfactual: Boolean(reference?.input?.document_metadata?.counterfactual),
    judge_verdict: String(judgePayload.verdict ?? "missing"),
    supported_answer: supportedAnswer,
    top_level_citations: prediction.citations,
    inline_citations: inlineIds,
    claim_table_citations: claimTableIds,
    top_level_contract: topLevel,
    inline_contract: inline,
    claim_table_contract: claimTable,
    citation_channels_consistent: setEquals(new Set(prediction.citations), new Set(claimTableIds))
      && (inlineIds.length === 0 || setSubset(new Set(inlineIds), new Set(prediction.citations))),
    explanation_tags: tags,
    unsupported_claims: Array.isArray(judgePayload.unsupported_claims) ? judgePayload.unsupported_claims : [],
    judge_notes: String(judgePayload.notes ?? ""),
    answer_preview: preview(prediction.answer),
  };
}

function explanationTags({ prediction, reference, judgePayload, topLevel, inline, claimTable }) {
  const tags = [];
  if (prediction.answer_type === "abstain") {
    if (judgePayload.verdict === "correct_abstention") tags.push("correct_abstention");
    else tags.push("abstention_not_supported");
    return tags;
  }
  if (reference?.input?.document_metadata?.counterfactual) tags.push("counterfactual_answered");
  if (!topLevel.count) tags.push("missing_top_level_citations");
  if (topLevel.invalid.length) tags.push("invalid_top_level_citation_id");
  if (inline.count === 0) tags.push("missing_inline_citations");
  if (inline.invalid.length) tags.push("invalid_inline_citation_id");
  if (!claimTable.count) tags.push("missing_claim_table_citations");
  if (claimTable.invalid.length) tags.push("invalid_claim_table_citation_id");
  const topSet = new Set(prediction.citations);
  const claimSet = new Set(extractClaimTableCitationIds(prediction.claim_table));
  if (!setEquals(topSet, claimSet)) tags.push("top_level_claim_table_mismatch");
  const inlineSet = new Set(extractInlineCitationIds(prediction.answer));
  if (inlineSet.size && !setSubset(inlineSet, topSet)) tags.push("inline_not_declared_top_level");
  const text = [
    prediction.answer,
    judgePayload.notes,
    ...(Array.isArray(judgePayload.unsupported_claims) ? judgePayload.unsupported_claims : []),
  ].join(" ").toLowerCase();
  if (/\bnot mention|does not mention|no evidence|not state|not specify|not directly supported\b/.test(text)) tags.push("missing_direct_evidence");
  if (/\btask|experiment|benchmark|speaker|role|detection|modeling|prediction\b/.test(text)) tags.push("unsupported_task_or_experiment");
  if (contentTokens(prediction.answer).length <= 2) tags.push("too_short_or_yes_no");
  if (!tags.length && judgePayload.verdict !== "supported") tags.push("unsupported_claim_content");
  if (!tags.length) tags.push("contract_clean_supported");
  return [...new Set(tags)];
}

function citationContract(ids, evidenceIds) {
  const normalized = [...new Set(ids.filter(Boolean))];
  const invalid = normalized.filter((id) => !evidenceIds.has(id));
  return {
    count: normalized.length,
    valid: normalized.length > 0 && invalid.length === 0,
    invalid,
  };
}

function summarizeContract(rows, channel) {
  const key = `${channel}_contract`;
  return {
    answered_rows: rows.length,
    rows_with_any: rows.filter((row) => row[key].count > 0).length,
    rows_all_valid: rows.filter((row) => row[key].valid).length,
    rows_with_invalid_ids: rows.filter((row) => row[key].invalid.length > 0).length,
    rows_missing: rows.filter((row) => row[key].count === 0).length,
  };
}

function statusFor({ rows, invalidAnsweredRows }) {
  const judgeArtifacts = invalidAnsweredRows.filter((row) =>
    row.top_level_contract.valid && row.inline_contract.valid && row.claim_table_contract.valid && row.citation_channels_consistent
  );
  if (judgeArtifacts.length) return "needs_judge_prompt_review";
  if (invalidAnsweredRows.length) return "contract_failures_explain_invalid_judgments";
  if (rows.some((row) => row.explanation_tags.includes("counterfactual_answered"))) return "counterfactual_answering_remains";
  return "contract_clean";
}

function renderReport(result) {
  const invalidRows = result.rows
    .filter((row) => row.judge_verdict === "invalid" && row.prediction_answer_type === "grounded_answer")
    .slice(0, 10)
    .map((row) => `- \`${row.example_id}\` (${row.explanation_tags.join(", ")}): ${escapeMarkdown(row.answer_preview)}`);
  const tagRows = Object.entries(result.invalid_judgment_explanation_counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => `| \`${tag}\` | ${count} |`);
  return `# Support Contract Audit

## Setup

- Prediction run: \`${result.prediction_run}\`
- Judge run: \`${result.judge_run}\`
- Split: \`${result.split}\`
- LLM calls: 0
- Run cost: $0

## Summary

| Answered | Supported answers | Unsupported/invalid answers | Invalid answered judgments | Status |
| ---: | ---: | ---: | ---: | --- |
| ${result.answered} | ${result.supported_answers} | ${result.unsupported_or_invalid_answers} | ${result.invalid_answered_judgments} | \`${result.status}\` |

## Citation Contract

| Channel | Rows with any | Rows all valid | Rows missing | Rows with invalid ids |
| --- | ---: | ---: | ---: | ---: |
| Top-level citations | ${result.top_level_citation_contract.rows_with_any} | ${result.top_level_citation_contract.rows_all_valid} | ${result.top_level_citation_contract.rows_missing} | ${result.top_level_citation_contract.rows_with_invalid_ids} |
| Inline answer citations | ${result.inline_citation_contract.rows_with_any} | ${result.inline_citation_contract.rows_all_valid} | ${result.inline_citation_contract.rows_missing} | ${result.inline_citation_contract.rows_with_invalid_ids} |
| Claim-table citations | ${result.claim_table_citation_contract.rows_with_any} | ${result.claim_table_citation_contract.rows_all_valid} | ${result.claim_table_citation_contract.rows_missing} | ${result.claim_table_citation_contract.rows_with_invalid_ids} |

## Invalid Judgment Tags

| Tag | Count |
| --- | ---: |
${tagRows.join("\n")}

## Invalid Judgment Examples

${invalidRows.join("\n")}

${result.interpretation.main_read}
`;
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
  };
}

function extractInlineCitationIds(answer) {
  return [...String(answer ?? "").matchAll(/\[([^\]]+)\]/g)]
    .flatMap((match) => match[1].split(/[,;\s]+/))
    .map((id) => id.trim())
    .filter((id) => /^E\d+$/i.test(id))
    .map((id) => id.toUpperCase());
}

function extractClaimTableCitationIds(claimTable) {
  const ids = [];
  for (const row of Array.isArray(claimTable) ? claimTable : []) {
    const values = [row.evidence_citation, row.evidence_id, row.citation, row.citations, row.supporting_evidence];
    for (const value of values) {
      if (Array.isArray(value)) ids.push(...value);
      else if (typeof value === "string") ids.push(...value.split(/[,;\s]+/));
    }
  }
  return [...new Set(ids.map((id) => String(id).trim()).filter((id) => /^E\d+$/i.test(id)).map((id) => id.toUpperCase()))];
}

function setEquals(a, b) {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

function setSubset(a, b) {
  return [...a].every((value) => b.has(value));
}

function counts(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function contentTokens(value) {
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function preview(value, length = 220) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function escapeMarkdown(value) {
  return String(value).replaceAll("|", "\\|");
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function requiredArg(name) {
  const value = args[name];
  if (!value) throw new Error(`Missing --${name}=...`);
  return value;
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
