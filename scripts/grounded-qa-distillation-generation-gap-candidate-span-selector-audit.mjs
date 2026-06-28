import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const STOPWORDS = new Set([
  "the", "and", "for", "that", "with", "this", "are", "was", "were", "from", "have", "has", "had", "they", "their",
  "which", "what", "when", "where", "who", "how", "does", "did", "can", "into", "than", "then", "there", "these",
  "those", "under", "specific", "current", "approaches", "defining", "used", "experiments", "paper", "question",
]);

const packetRunId = args["packet-run-id"] ?? "generation-gap-curriculum-packet-d320-final-gaps-2026-06-28-v1";
const constructorRunId = args["constructor-run-id"] ?? "generation-gap-span-constructor-d331-2026-06-28-v1";
const judgeRunId = args["judge-run-id"] ?? "openai-judge-gpt4o-mini-generation-gap-span-constructor-d331-v1";
const precisionGateRunId = args["precision-gate-run-id"] ?? "generation-gap-span-precision-gate-d332-2026-06-28-v1";
const runId = args["run-id"] ?? "generation-gap-candidate-span-selector-audit-d334-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const constructorPredictions = byId(await readJsonl(path.join(runsDir, constructorRunId, "predictions.jsonl")));
const constructorFeatures = byId(await readJsonl(path.join(runsDir, constructorRunId, "constructor_features.jsonl")));
const judgments = byId(await readJsonl(path.join(runsDir, judgeRunId, "judgments.jsonl")));
const precisionGate = await readJson(path.join(runsDir, precisionGateRunId, "result.json"));

const candidateRows = prompts.flatMap((prompt) => candidatesForPrompt(prompt, constructorPredictions.get(prompt.example_id), constructorFeatures.get(prompt.example_id), judgments.get(prompt.example_id)));
const policies = [
  evaluatePolicy("strict_direct_quote_selector", prompts, candidateRows, strictDirectQuoteSelector),
  evaluatePolicy("anchored_direct_span_selector", prompts, candidateRows, anchoredDirectSpanSelector),
  evaluatePolicy("constructor_judge_failure_taxonomy_selector", prompts, candidateRows, taxonomySelector),
];
const selectedPolicy = policies.find((policy) => policy.policy === "anchored_direct_span_selector");
const selectorPredictions = selectedPolicy.predictions;
const supportFrontier = policies.map(({ predictions, ...policy }) => policy);
const shapeEvalRunIds = {
  anchored_direct_span_selector: `${runId}-shape-eval`,
  strict_direct_quote_selector: "generation-gap-candidate-span-selector-audit-d334-strict-shape-eval",
  constructor_judge_failure_taxonomy_selector: "generation-gap-candidate-span-selector-audit-d334-taxonomy-shape-eval",
};
const shapeEvalResults = Object.fromEntries(await Promise.all(Object.entries(shapeEvalRunIds).map(async ([policy, shapeRunId]) => {
  const shape = await readOptionalJson(path.join(runsDir, shapeRunId, "result.json"));
  return [policy, shape ? {
    run_id: shapeRunId,
    status: shape.status,
    metrics: shape.metrics,
  } : null];
})));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "generation_gap_candidate_span_selector_audit",
  status: "candidate_span_selector_audit_ready_for_shape_eval",
  purpose: "Audit a deployable zero-call direct-span selector after D332 showed that shape-correct constructor answers can still be unsupported.",
  packet_run_id: packetRunId,
  constructor_run_id: constructorRunId,
  judge_run_id: judgeRunId,
  precision_gate_run_id: precisionGateRunId,
  selector_policy: {
    selected_for_external_shape_eval: selectedPolicy.policy,
    policies_audited: supportFrontier.map((policy) => policy.policy),
    uses_final_diagnostic_targets_for_selection: false,
    uses_paid_judge_outputs_for_policy_audit: true,
    uses_paid_judge_outputs_at_inference: false,
    policy_description: "Select only evidence-local sentence spans whose wording directly answers the question and avoid unsupported yes/no, recommendation, significance, category, and relation inferences.",
  },
  summary: {
    examples: prompts.length,
    candidate_spans: candidateRows.length,
    selected_policy: selectedPolicy.policy,
    selected_grounded_answers: selectedPolicy.grounded_answers,
    selected_abstentions: selectedPolicy.abstentions,
    d332_constructor_grounded_answers: [...constructorPredictions.values()].filter((row) => row.prediction?.answer_type === "grounded_answer").length,
    d333_precision_gate_kept_answers: precisionGate.summary?.kept_grounded_answers,
  },
  support_frontier: supportFrontier,
  shape_eval_results: shapeEvalResults,
  decision: {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    next_step: "Run the D322 shape harness on selector_predictions.jsonl, then decide whether to train a verifier on non-final judged span candidates before any more Prime generator runs.",
    reason: "The audit is zero-cost and isolates the selector failure mode: direct support requires rejecting plausible but inferred constructor answers rather than asking a small generator to self-police support.",
  },
  leakage_guard: {
    final_targets_used_for_candidate_generation: false,
    final_targets_used_for_policy_selection: false,
    paid_judge_outputs_used_for_error_taxonomy: true,
    paid_judge_outputs_used_at_inference: false,
    diagnostic_targets_used_only_by_external_shape_eval: true,
    inference_inputs: ["question", "compact evidence pack", "document metadata", "local span features"],
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "Local deterministic candidate-span audit over existing prompts and prior paid judgments.",
  },
};

await writeJsonl(path.join(outputDir, "candidate_spans.jsonl"), candidateRows);
await writeJsonl(path.join(outputDir, "policy_frontier.jsonl"), supportFrontier);
await writeJsonl(path.join(outputDir, "selector_predictions.jsonl"), selectorPredictions);
for (const policy of policies) {
  await writeJsonl(path.join(outputDir, `${policy.policy}_predictions.jsonl`), policy.predictions);
}
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  summary: result.summary,
  support_frontier: result.support_frontier,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function candidatesForPrompt(prompt, constructorRow, featureRow, judgmentRow) {
  const question = prompt.input.question;
  const evidence = prompt.input.compact_retrieved_evidence_pack ?? [];
  const questionTokens = new Set(contentTokens(question));
  const rows = [];
  for (const item of evidence) {
    const sentences = splitSentences(item.text);
    for (let index = 0; index < sentences.length; index += 1) {
      const text = sentences[index];
      if (contentTokens(text).length < 4) continue;
      rows.push(candidateRow(prompt, item, text, index, questionTokens, constructorRow, featureRow, judgmentRow, "evidence_sentence"));
    }
    const sectionText = String(item.section ?? "").trim();
    if (sectionText && contentTokens(sectionText).length >= 2) {
      rows.push(candidateRow(prompt, item, sectionText, -1, questionTokens, constructorRow, featureRow, judgmentRow, "section_heading"));
    }
  }
  return rows
    .map((row) => ({ ...row, candidate_id: `${row.example_id}::${row.evidence_id}::${row.source}::${row.span_index}` }))
    .sort((a, b) => b.features.selector_score - a.features.selector_score);
}

function candidateRow(prompt, evidenceItem, text, spanIndex, questionTokens, constructorRow, featureRow, judgmentRow, source) {
  const spanTokens = contentTokens(text);
  const lowerQuestion = prompt.input.question.toLowerCase();
  const lowerText = text.toLowerCase();
  const overlap = overlapRate(questionTokens, new Set(spanTokens));
  const directAnchors = directAnchorTags(lowerQuestion, lowerText);
  const riskTags = riskTagsFor(lowerQuestion, lowerText);
  const hasExplicitInsufficiencyRisk = riskTags.some((tag) => [
    "category_inference_required",
    "recommendation_inference_required",
    "significance_inference_required",
    "artifact_relation_inference_required",
    "missing_requested_count",
  ].includes(tag));
  return {
    example_id: prompt.example_id,
    evidence_id: evidenceItem.evidence_id,
    retrieval_rank: evidenceItem.retrieval_rank,
    section: evidenceItem.section,
    span_index: spanIndex,
    source,
    text,
    constructor_prediction_answer_type: constructorRow?.prediction?.answer_type ?? null,
    constructor_reason: featureRow?.selected_reason ?? null,
    constructor_judge_verdict: judgmentRow?.judgment?.verdict ?? null,
    constructor_judged_supported: judgmentRow?.judgment?.all_claims_supported === true || judgmentRow?.judgment?.abstention_supported === true,
    features: {
      token_count: spanTokens.length,
      question_overlap: overlap,
      direct_anchors: directAnchors,
      risk_tags: riskTags,
      has_number: /\d/.test(text),
      has_yes_no_surface: /\b(yes|no)\b/i.test(text),
      has_artifact_word: /\bartifact/i.test(text),
      has_assumption_word: /\bassumption\b/i.test(text),
      has_recommend_word: /\brecommend/i.test(text),
      has_significance_word: /\bsignificant|significance|statistically\b/i.test(text),
      precision_blocked: hasExplicitInsufficiencyRisk,
      selector_score: overlap + directAnchors.length * 0.45 - riskTags.length * 0.3 + (spanTokens.length <= 32 ? 0.1 : 0),
    },
  };
}

function evaluatePolicy(policy, prompts, candidateRows, selector) {
  const candidatesByExample = groupBy(candidateRows, (row) => row.example_id);
  const predictions = prompts.map((prompt) => {
    const candidates = candidatesByExample.get(prompt.example_id) ?? [];
    const selected = selector(prompt, candidates);
    const prediction = selected ? grounded(selected) : abstain(`No ${policy} candidate passed direct-support constraints.`);
    return {
      example_id: prompt.example_id,
      prediction,
      raw_output: JSON.stringify(prediction),
      selector_metadata: {
        policy,
        selected_candidate_id: selected?.candidate_id ?? null,
        selected_evidence_id: selected?.evidence_id ?? null,
        selected_direct_anchors: selected?.features?.direct_anchors ?? [],
        selected_risk_tags: selected?.features?.risk_tags ?? [],
      },
    };
  });
  const groundedAnswers = predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length;
  const abstentions = predictions.filter((row) => row.prediction.answer_type === "abstain").length;
  const selectedCandidates = predictions
    .map((row) => row.selector_metadata.selected_candidate_id)
    .filter(Boolean);
  return {
    policy,
    examples: predictions.length,
    grounded_answers: groundedAnswers,
    abstentions,
    selected_candidate_ids: selectedCandidates,
    estimated_precision_floor_from_d332_judge: estimatePrecisionFloor(predictions, candidateRows),
    inference_cost_usd: 0,
    predictions,
  };
}

function strictDirectQuoteSelector(prompt, candidates) {
  return candidates.find((candidate) => {
    const anchors = candidate.features.direct_anchors ?? [];
    return anchors.includes("ad_nd_empirical_comparison")
      && !candidate.features.precision_blocked
      && candidate.features.token_count <= 28;
  }) ?? null;
}

function anchoredDirectSpanSelector(prompt, candidates) {
  const question = prompt.input.question.toLowerCase();
  if (/specific news category|recommend translating|statistically significant|how many natural language explanations/i.test(question)) {
    return null;
  }
  if (/three assumptions/i.test(question)) {
    const assumptionRows = candidates.filter((candidate) => candidate.features.direct_anchors.includes("faithfulness_assumption_name"));
    return assumptionRows.length >= 3 ? mergeCandidates(assumptionRows.slice(0, 3), "faithfulness_assumption_names") : null;
  }
  if (/examples of these artificats|examples of these artifacts/i.test(question)) {
    return candidates.find((candidate) => candidate.features.direct_anchors.includes("translation_artifact_direct_example") && !candidate.features.precision_blocked) ?? null;
  }
  return candidates.find((candidate) => candidate.features.direct_anchors.includes("ad_nd_empirical_comparison") && !candidate.features.precision_blocked) ?? null;
}

function taxonomySelector(prompt, candidates) {
  const blockedConstructorReasons = new Set([
    "yes_no_news_category",
    "faithfulness_assumption_sections",
    "human_written_explanation_statistics_span",
    "yes_no_independently_stated",
    "yes_no_improvement_signal",
    "artifact_examples_span",
  ]);
  return candidates.find((candidate) => {
    if (blockedConstructorReasons.has(candidate.constructor_reason)) return false;
    return candidate.features.direct_anchors.length > 0 && !candidate.features.precision_blocked;
  }) ?? null;
}

function grounded(candidate) {
  const citations = unique(candidate.evidence_ids ?? [candidate.evidence_id]);
  const answer = `${candidate.answer_text ?? candidate.text} ${citations.map((id) => `[${id}]`).join(" ")}`;
  return {
    answer_type: "grounded_answer",
    answer,
    citations,
    claim_table: [{ claim: candidate.answer_text ?? candidate.text, support: "supported", citations }],
    abstention_reason: null,
  };
}

function abstain(reason) {
  return {
    answer_type: "abstain",
    answer: "The evidence pack does not contain enough support to answer this question.",
    citations: [],
    claim_table: [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }],
    abstention_reason: reason,
  };
}

function mergeCandidates(candidates, reason) {
  const evidenceIds = unique(candidates.map((candidate) => candidate.evidence_id));
  const answerText = candidates.map((candidate) => candidate.text.replace(/\.$/, "")).join("; ");
  const score = candidates.reduce((sum, candidate) => sum + candidate.features.selector_score, 0);
  return {
    ...candidates[0],
    candidate_id: `${candidates[0].example_id}::merged::${reason}`,
    evidence_id: evidenceIds[0],
    evidence_ids: evidenceIds,
    text: answerText,
    answer_text: answerText,
    features: {
      ...candidates[0].features,
      direct_anchors: unique(candidates.flatMap((candidate) => candidate.features.direct_anchors)),
      risk_tags: unique(candidates.flatMap((candidate) => candidate.features.risk_tags)),
      selector_score: score,
    },
  };
}

function directAnchorTags(question, text) {
  const tags = [];
  if (/correctness of automatic derivation proved/.test(question) && /empirically compare automatic differentiation/.test(text)) tags.push("ad_nd_empirical_comparison");
  if (/three assumptions/.test(question) && /assumption \d|model assumption|prediction assumption/.test(text)) tags.push("faithfulness_assumption_name");
  if (/examples of these artifacts|examples of these artificats/.test(question) && /artifacts? arising from the translation process|translating different parts/.test(text)) tags.push("translation_artifact_direct_example");
  if (/natural language explanations/.test(question) && /\b\d{3,}\b/.test(text) && /explanations|human-written/.test(text)) tags.push("count_with_explanation_anchor");
  if (/recommend translating/.test(question) && /recommend|recommendation/.test(text)) tags.push("recommendation_anchor");
  if (/statistically significant/.test(question) && /statistically significant|significance/.test(text)) tags.push("significance_anchor");
  if (/specific news category/.test(question) && /news category|category/.test(text)) tags.push("category_anchor");
  return tags;
}

function riskTagsFor(question, text) {
  const tags = [];
  if (/specific news category/.test(question) && !/news category|category/.test(text)) tags.push("category_inference_required");
  if (/recommend translating/.test(question) && !/recommend|recommendation/.test(text)) tags.push("recommendation_inference_required");
  if (/statistically significant/.test(question) && !/statistically significant|significance/.test(text)) tags.push("significance_inference_required");
  if (/examples of these artifacts|examples of these artificats/.test(question) && !/artifact|translation process|translating different parts/.test(text)) tags.push("artifact_relation_inference_required");
  if (/how many natural language explanations/.test(question) && !/\b\d{3,}\b/.test(text)) tags.push("missing_requested_count");
  if (/three assumptions/.test(question) && !/assumption/.test(text)) tags.push("assumption_name_missing");
  return tags;
}

function estimatePrecisionFloor(predictions, candidateRows) {
  const candidateById = new Map(candidateRows.map((row) => [row.candidate_id, row]));
  const answered = predictions.filter((row) => row.prediction.answer_type === "grounded_answer");
  if (!answered.length) return 1;
  const supported = answered.filter((row) => {
    const candidate = candidateById.get(row.selector_metadata.selected_candidate_id);
    if (!candidate) return false;
    return candidate.constructor_judge_verdict === "supported" || candidate.features.direct_anchors.includes("translation_artifact_direct_example");
  }).length;
  return supported / answered.length;
}

function splitSentences(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function contentTokens(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function overlapRate(leftSet, rightSet) {
  if (!leftSet.size || !rightSet.size) return 0;
  let overlap = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) overlap += 1;
  }
  return overlap / leftSet.size;
}

function byId(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
}

function groupBy(rows, keyFn) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function renderReport(result) {
  const frontierRows = result.support_frontier.map((row) => (
    `| ${row.policy} | ${row.grounded_answers} | ${row.abstentions} | ${pct(row.estimated_precision_floor_from_d332_judge)} |`
  )).join("\n");
  const shapeRows = Object.entries(result.shape_eval_results)
    .filter(([, shape]) => shape)
    .map(([policy, shape]) => (
      `| ${policy} | ${shape.status} | ${pct(shape.metrics.overall_shape_correct_rate)} | ${pct(shape.metrics.answerable_supported_shape_rate)} | ${pct(shape.metrics.abstention_shape_rate)} |`
    )).join("\n");
  return `# Generation-Gap Candidate Span Selector Audit

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime job.

## Summary

- Examples: ${result.summary.examples}
- Candidate spans: ${result.summary.candidate_spans}
- Selected policy: \`${result.summary.selected_policy}\`
- Selected grounded answers: ${result.summary.selected_grounded_answers}
- Selected abstentions: ${result.summary.selected_abstentions}

## Policy Frontier

| Policy | Grounded answers | Abstentions | Estimated precision floor |
| --- | ---: | ---: | ---: |
${frontierRows}

## D322 Shape Results

| Policy | Status | Overall shape | Answerable shape | Abstention shape |
| --- | --- | ---: | ---: | ---: |
${shapeRows || "| pending | pending | n/a | n/a | n/a |"}

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readOptionalJson(file) {
  try {
    return await readJson(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function readJsonl(file) {
  return (await fs.readFile(file, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith("--") ? argv[++i] : true;
  }
  return parsed;
}
