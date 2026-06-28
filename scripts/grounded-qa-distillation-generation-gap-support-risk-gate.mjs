import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "generation-gap-curriculum-packet-d320-final-gaps-2026-06-28-v1";
const sourceRunId = args["source-run"] ?? "generation-gap-citation-repair-qwen3b-sft-dpo-smoke-d321-v1";
const runId = args["run-id"] ?? `generation-gap-support-risk-gate-${sourceRunId}`;
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const sourceResult = await readJson(path.join(runsDir, sourceRunId, "result.json"));
const sourceRows = await readJsonl(path.join(runsDir, sourceRunId, "repaired_predictions.jsonl"));
const gatedRows = sourceRows.map((row) => gateRow(row, promptById.get(row.example_id)));
const featureRows = gatedRows.map((row) => row.gate_metadata);
const summary = summarize(sourceRows, gatedRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "generation_gap_support_risk_gate",
  status: "support_risk_gate_ready_for_shape_eval",
  purpose: "Apply a zero-call deployable support/abstention risk gate to repaired D321 generation-gap Qwen 3B predictions.",
  packet_run_id: packetRunId,
  source_run_id: sourceRunId,
  source_repair_summary: sourceResult.summary ?? null,
  gate_policy: {
    name: "conservative_answer_form_and_evidence_overlap_gate",
    uses_final_diagnostic_targets: false,
    changes_answer_text: false,
    allowed_actions: [
      "convert high-risk grounded answers to abstentions",
      "keep low-risk answer forms with inline citations unchanged",
      "compute lexical support features from source question, prediction, and compact evidence pack"
    ],
    keep_rules: [
      "yes/no answers with complete inline citations",
      "non-list answers with at least three answer tokens, evidence coverage at least 0.55, and no suspicious placeholder markers"
    ]
  },
  summary,
  decision: {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    next_step: "Run the D322 generation-gap shape harness on gated_predictions.jsonl. Only consider paid judging if the gate passes.",
    reason: "This is a zero-call abstention/support-risk scaffold; shape scoring must come before any paid grounded-correctness judging."
  },
  leakage_guard: {
    final_targets_used_for_gate: false,
    final_targets_used_for_threshold_selection: false,
    diagnostic_targets_used_only_by_shape_eval: true,
    source_predictions_and_eval_prompts_only: true
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "Local lexical gate only."
  }
};

await writeJsonl(path.join(outputDir, "gated_predictions.jsonl"), gatedRows.map(({ gate_metadata, ...row }) => row));
await writeJsonl(path.join(outputDir, "gate_features.jsonl"), featureRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  summary: result.summary,
  decision: result.decision,
  llm_budget: result.llm_budget
}, null, 2));

function gateRow(row, prompt) {
  const prediction = structuredClone(row.prediction);
  const features = featuresFor(row, prompt);
  const keep = shouldKeep(features);
  const gatedPrediction = keep ? prediction : abstain(features.reason);
  return {
    example_id: row.example_id,
    prediction: gatedPrediction,
    raw_output: JSON.stringify(gatedPrediction),
    gate_metadata: {
      example_id: row.example_id,
      source_run_id: sourceRunId,
      gate_policy: "conservative_answer_form_and_evidence_overlap_gate",
      decision: keep ? "keep_grounded_answer" : "convert_to_abstain",
      ...features
    }
  };
}

function featuresFor(row, prompt) {
  const prediction = row.prediction ?? {};
  const answerNoCitations = stripCitations(prediction.answer ?? "");
  const answerTokens = contentTokens(answerNoCitations);
  const questionTokens = contentTokens(prompt?.input?.question ?? "");
  const evidenceById = new Map((prompt?.input?.compact_retrieved_evidence_pack ?? []).map((item) => [item.evidence_id, item]));
  const citedEvidence = (prediction.citations ?? []).map((id) => evidenceById.get(id)).filter(Boolean);
  const citedEvidenceText = citedEvidence.map((item) => `${item.section ?? ""} ${item.text ?? ""}`).join("\n");
  const citedTokens = contentTokens(citedEvidenceText);
  const answerEvidenceCoverage = coverage(answerTokens, citedTokens);
  const answerQuestionOverlap = jaccard(answerTokens, questionTokens);
  const citationInlineComplete = (prediction.citations ?? []).length > 0
    && (prediction.citations ?? []).every((id) => String(prediction.answer ?? "").includes(`[${id}]`));
  const yesNoAnswer = /^(yes|no)\.?$/i.test(answerNoCitations.trim());
  const listLikeAnswer = /^\s*\[/.test(answerNoCitations) || /',\s*'/.test(answerNoCitations);
  const placeholderAnswer = /\b(ROOT|N\/A|unknown|null)\b/i.test(answerNoCitations);
  const tooShortNonBoolean = answerTokens.length < 3 && !yesNoAnswer;
  const tooManyCitations = (prediction.citations ?? []).length > 4;
  const genericClaimTable = (prediction.claim_table ?? []).some((claim) => /model answer/i.test(String(claim.claim ?? "")));
  const reason = riskReason({
    citationInlineComplete,
    yesNoAnswer,
    listLikeAnswer,
    placeholderAnswer,
    tooShortNonBoolean,
    tooManyCitations,
    genericClaimTable,
    answerEvidenceCoverage
  });
  return {
    answer_tokens: answerTokens.length,
    citation_count: (prediction.citations ?? []).length,
    citation_inline_complete: citationInlineComplete,
    yes_no_answer: yesNoAnswer,
    list_like_answer: listLikeAnswer,
    placeholder_answer: placeholderAnswer,
    too_short_non_boolean: tooShortNonBoolean,
    too_many_citations: tooManyCitations,
    generic_claim_table: genericClaimTable,
    answer_evidence_coverage: answerEvidenceCoverage,
    answer_question_jaccard: answerQuestionOverlap,
    reason
  };
}

function shouldKeep(features) {
  if (!features.citation_inline_complete) return false;
  if (features.placeholder_answer || features.list_like_answer || features.too_many_citations) return false;
  if (features.yes_no_answer) return true;
  if (features.too_short_non_boolean) return false;
  if (features.generic_claim_table && features.answer_evidence_coverage < 0.7) return false;
  return features.answer_evidence_coverage >= 0.55;
}

function riskReason(features) {
  if (!features.citationInlineComplete) return "citations are not inline-complete";
  if (features.placeholderAnswer) return "answer contains placeholder-like text";
  if (features.listLikeAnswer) return "answer is list-like or malformed";
  if (features.tooManyCitations) return "answer cites too many evidence ids for a compact claim";
  if (features.yesNoAnswer) return "low-risk yes/no answer with inline citation";
  if (features.tooShortNonBoolean) return "answer is too short to be a supported non-boolean claim";
  if (features.genericClaimTable && features.answerEvidenceCoverage < 0.7) return "generic claim table with weak cited-evidence coverage";
  if (features.answerEvidenceCoverage < 0.55) return "answer tokens have weak cited-evidence coverage";
  return "passed conservative support-risk gate";
}

function abstain(reason) {
  return {
    answer_type: "abstain",
    answer: "The evidence pack does not contain enough support to answer this question.",
    citations: [],
    claim_table: [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }],
    abstention_reason: reason
  };
}

function summarize(sourceRows, gatedRows) {
  const kept = gatedRows.filter((row) => row.gate_metadata.decision === "keep_grounded_answer");
  const suppressed = gatedRows.filter((row) => row.gate_metadata.decision === "convert_to_abstain");
  return {
    examples: gatedRows.length,
    source_answered: sourceRows.filter((row) => row.prediction?.answer_type === "grounded_answer").length,
    kept_grounded_answers: kept.length,
    converted_to_abstain: suppressed.length,
    answer_decision_changed_rows: suppressed.length,
    kept_yes_no_answers: kept.filter((row) => row.gate_metadata.yes_no_answer).length,
    mean_kept_evidence_coverage: mean(kept.map((row) => row.gate_metadata.answer_evidence_coverage)),
    mean_suppressed_evidence_coverage: mean(suppressed.map((row) => row.gate_metadata.answer_evidence_coverage))
  };
}

function stripCitations(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, " ").trim();
}

function contentTokens(text) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why"]);
  return String(text ?? "").toLowerCase().split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stop.has(token));
}

function coverage(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (!leftSet.size) return 0;
  return [...leftSet].filter((token) => rightSet.has(token)).length / leftSet.size;
}

function jaccard(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);
  if (!union.size) return 0;
  return [...leftSet].filter((token) => rightSet.has(token)).length / union.size;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value), 0) / values.length : null;
}

function renderReport(result) {
  return `# Generation-Gap Support-Risk Gate

Status: \`${result.status}\`

Source run: \`${result.source_run_id}\`

This run makes no OpenAI calls and launches no Prime job.

## Summary

| Examples | Source answered | Kept answers | Converted to abstain | Kept yes/no | Mean kept coverage | Mean suppressed coverage |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.summary.examples} | ${result.summary.source_answered} | ${result.summary.kept_grounded_answers} | ${result.summary.converted_to_abstain} | ${result.summary.kept_yes_no_answers} | ${fmt(result.summary.mean_kept_evidence_coverage)} | ${fmt(result.summary.mean_suppressed_evidence_coverage)} |

## Decision

- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function fmt(value) {
  return value == null ? "n/a" : value.toFixed(3);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
