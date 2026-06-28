import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "extended_temporal_future_holdout";
const sourceRunId = requiredArg("source-run");
const sourceJudgeRunId = requiredArg("source-judge-run");
const contractAuditRunId = requiredArg("contract-audit-run");
const runId = args["run-id"] ?? `support-contract-gate-${sourceRunId}`;
const policy = args.policy ?? "strict";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const references = await readJsonl(path.join(experimentDir, "data", `${split}.jsonl`));
const referencesById = new Map(references.map((row) => [row.example_id, row]));
const sourcePredictions = await readJsonl(path.join(runsDir, sourceRunId, "predictions.jsonl"));
const sourceJudgments = byId(await readJsonl(path.join(runsDir, sourceJudgeRunId, "judgments.jsonl")));
const contractRows = byId(await readJsonl(path.join(runsDir, contractAuditRunId, "rows.jsonl")));

const rows = sourcePredictions.map((row) => gateRow(row));
const sourceMetrics = summarize(rows.map((row) => row.source_scored));
const gatedMetrics = summarize(rows.map((row) => row.gated_scored));
const suppressions = summarizeSuppressions(rows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "support_contract_gate",
  status: statusFor({ sourceMetrics, gatedMetrics, suppressions }),
  split,
  source_run_id: sourceRunId,
  source_judge_run_id: sourceJudgeRunId,
  contract_audit_run_id: contractAuditRunId,
  gate_policy: {
    name: policy,
    rules: policyRules(policy),
    scoring_note: "Kept answers inherit existing paid GPT-4o judgments. Forced abstentions are scored as supported only when the reference row is abstain, so this is a zero-cost diagnostic rather than a paid rejudge.",
  },
  examples: rows.length,
  source_metrics: sourceMetrics,
  gated_metrics: gatedMetrics,
  suppressions,
  conclusion: conclusionFor({ sourceMetrics, gatedMetrics, suppressions }),
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This gate reads existing predictions, paid judgments, references, and the deterministic contract audit only.",
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), rows.map((row) => ({
  example_id: row.example_id,
  source_run_id: sourceRunId,
  gate_decision: row.gate_decision,
  gate_reasons: row.gate_reasons,
  prediction: row.gated_prediction,
  source_prediction: row.source_prediction,
  scores: row.gated_scored,
  source_scores: row.source_scored,
  metadata: row.metadata,
})));
await writeJsonl(path.join(outputDir, "rows.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  source: pickMetrics(result.source_metrics),
  gated: pickMetrics(result.gated_metrics),
  suppressions: result.suppressions,
}, null, 2));

function gateRow(row) {
  const reference = referencesById.get(row.example_id);
  const judgment = sourceJudgments.get(row.example_id)?.judgment ?? {};
  const contract = contractRows.get(row.example_id) ?? {};
  const sourcePrediction = normalizePrediction(row.prediction ?? {});
  const sourceScored = scorePrediction({
    prediction: sourcePrediction,
    judgment,
    reference,
    syntheticForcedAbstention: false,
  });
  const gate = gateDecision({ sourcePrediction, reference, contract });
  const gatedPrediction = gate.suppress ? abstainPrediction(gate.reasons) : sourcePrediction;
  const gatedScored = scorePrediction({
    prediction: gatedPrediction,
    judgment,
    reference,
    syntheticForcedAbstention: gate.suppress,
  });
  return {
    example_id: row.example_id,
    question: reference?.input?.question ?? "",
    reference_answer_type: reference?.output?.answer_type ?? null,
    counterfactual: Boolean(reference?.input?.document_metadata?.counterfactual),
    gate_decision: gate.suppress ? "suppress_to_abstain" : "keep_source",
    gate_reasons: gate.reasons,
    source_prediction: sourcePrediction,
    gated_prediction: gatedPrediction,
    source_judgment: judgment,
    source_scored: sourceScored,
    gated_scored: gatedScored,
    contract_summary: {
      top_level: contract.top_level_contract ?? null,
      inline: contract.inline_contract ?? null,
      claim_table: contract.claim_table_contract ?? null,
      citation_channels_consistent: contract.citation_channels_consistent ?? null,
      explanation_tags: contract.explanation_tags ?? [],
    },
    metadata: {
      source_answer_tokens: contentTokens(sourcePrediction.answer).length,
      source_judge_verdict: judgment.verdict ?? null,
      synthetic_forced_abstention: gate.suppress,
    },
  };
}

function gateDecision({ sourcePrediction, reference, contract }) {
  const reasons = [];
  if (sourcePrediction.answer_type !== "grounded_answer") return { suppress: false, reasons };
  if (reference?.input?.document_metadata?.counterfactual) reasons.push("counterfactual_or_insufficient_evidence_metadata");
  if (contract.top_level_contract?.valid !== true) reasons.push("top_level_citation_contract_failed");
  if (contract.inline_contract?.valid !== true) reasons.push("inline_citation_contract_failed");
  if (policy === "strict") {
    if (contract.claim_table_contract?.valid !== true) reasons.push("claim_table_citation_contract_failed");
    if (contract.citation_channels_consistent !== true) reasons.push("citation_channels_inconsistent");
  } else if (policy !== "answer_citations") {
    throw new Error(`Unknown support contract gate policy: ${policy}`);
  }
  return { suppress: reasons.length > 0, reasons: [...new Set(reasons)] };
}

function policyRules(selectedPolicy) {
  const shared = [
    "Keep source abstentions.",
    "Suppress grounded answers on counterfactual/insufficient-evidence rows.",
    "Suppress grounded answers missing valid top-level citations.",
    "Suppress grounded answers missing valid inline citations.",
  ];
  if (selectedPolicy === "answer_citations") {
    return [
      ...shared,
      "Do not require claim-table citations; this tests whether the answer-level citation contract alone is a useful pre-judge gate.",
    ];
  }
  if (selectedPolicy === "strict") {
    return [
      ...shared,
      "Suppress grounded answers missing valid claim-table citations.",
      "Suppress grounded answers when top-level, inline, and claim-table citation channels disagree.",
    ];
  }
  throw new Error(`Unknown support contract gate policy: ${selectedPolicy}`);
}

function abstainPrediction(reasons) {
  return {
    answer_type: "abstain",
    answer: "The evidence pack does not contain enough support to answer this question.",
    citations: [],
    claim_table: [
      {
        claim: "Answer suppressed by deterministic citation-contract gate.",
        support: "abstention",
        citations: [],
      },
    ],
    abstention_reason: `Suppressed source grounded answer: ${reasons.join("; ")}`,
  };
}

function scorePrediction({ prediction, judgment, reference, syntheticForcedAbstention }) {
  const answered = prediction.answer_type === "grounded_answer";
  const answerSupported = answered
    && judgment.verdict === "supported"
    && judgment.all_claims_supported === true
    && judgment.citation_ids_valid !== false;
  const abstentionSupported = answered
    ? false
    : syntheticForcedAbstention
      ? reference?.output?.answer_type === "abstain"
      : judgment.verdict === "correct_abstention" || judgment.abstention_supported === true;
  return {
    answered,
    abstained: !answered,
    supported_answer: answerSupported,
    supported_abstention: abstentionSupported,
    overall_correct: answerSupported || abstentionSupported,
    synthetic_forced_abstention: syntheticForcedAbstention,
  };
}

function summarize(scoredRows) {
  const answered = scoredRows.filter((row) => row.answered);
  const abstained = scoredRows.filter((row) => row.abstained);
  const supportedAnswers = answered.filter((row) => row.supported_answer);
  const supportedAbstentions = abstained.filter((row) => row.supported_abstention);
  return {
    examples: scoredRows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, scoredRows.length),
    supported_answers: supportedAnswers.length,
    unsupported_answers: answered.length - supportedAnswers.length,
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    supported_abstentions: supportedAbstentions.length,
    abstention_support_rate: ratio(supportedAbstentions.length, abstained.length),
    overall_correct: supportedAnswers.length + supportedAbstentions.length,
    overall_correct_rate: ratio(supportedAnswers.length + supportedAbstentions.length, scoredRows.length),
  };
}

function summarizeSuppressions(rows) {
  const suppressed = rows.filter((row) => row.gate_decision === "suppress_to_abstain");
  const reasonCounts = {};
  for (const row of suppressed) {
    for (const reason of row.gate_reasons) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  }
  return {
    total: suppressed.length,
    useful_unsupported_answer_suppressions: suppressed.filter((row) => row.source_scored.answered && !row.source_scored.supported_answer && row.gated_scored.supported_abstention).length,
    harmful_supported_answer_suppressions: suppressed.filter((row) => row.source_scored.supported_answer && !row.gated_scored.supported_abstention).length,
    harmful_answerable_suppressions: suppressed.filter((row) => row.reference_answer_type === "grounded_answer").length,
    counterfactual_suppressions: suppressed.filter((row) => row.counterfactual).length,
    reason_counts: reasonCounts,
    example_ids: suppressed.map((row) => row.example_id),
  };
}

function statusFor({ sourceMetrics, gatedMetrics, suppressions }) {
  if (gatedMetrics.answer_rate < 0.7 && gatedMetrics.answer_support_rate > sourceMetrics.answer_support_rate) {
    return "contract_gate_improves_support_but_collapses_coverage";
  }
  if (suppressions.harmful_supported_answer_suppressions > 0) {
    return "contract_gate_too_strict_drops_supported_answers";
  }
  if (gatedMetrics.answer_rate >= 0.7 && gatedMetrics.answer_support_rate > sourceMetrics.answer_support_rate) {
    return "contract_gate_viable_for_selector";
  }
  return "contract_gate_no_support_gain";
}

function conclusionFor({ sourceMetrics, gatedMetrics, suppressions }) {
  return {
    support_delta: gatedMetrics.answer_support_rate - sourceMetrics.answer_support_rate,
    answer_rate_delta: gatedMetrics.answer_rate - sourceMetrics.answer_rate,
    overall_correct_delta: gatedMetrics.overall_correct_rate - sourceMetrics.overall_correct_rate,
    key_findings: [
      `Answer support changes from ${pct(sourceMetrics.answer_support_rate)} to ${pct(gatedMetrics.answer_support_rate)}.`,
      `Answer rate changes from ${pct(sourceMetrics.answer_rate)} to ${pct(gatedMetrics.answer_rate)}.`,
      `The gate suppresses ${suppressions.total} source answers, including ${suppressions.harmful_supported_answer_suppressions} supported answers and ${suppressions.harmful_answerable_suppressions} answerable rows.`,
      `It performs ${suppressions.useful_unsupported_answer_suppressions} useful unsupported-answer suppressions on reference-abstain rows.`,
    ],
    next_intervention: gatedMetrics.answer_rate < 0.7
      ? "Use the contract gate as a pre-judge safety filter and training diagnostic, not as the final policy. The generator still needs contract-complete supported answers for answerable rows."
      : "Promote the contract features into a deployable selector and evaluate on a fresh temporal window before another GPU run.",
  };
}

function renderReport(result) {
  return `# Support Contract Gate

Generated: ${result.generated_at}

Source run: \`${result.source_run_id}\`

## Metrics

| Surface | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| Source | ${pct(result.source_metrics.answer_rate)} | ${pct(result.source_metrics.answer_support_rate)} | ${pct(result.source_metrics.overall_correct_rate)} | ${result.source_metrics.supported_answers} | ${result.source_metrics.unsupported_answers} |
| Contract-gated | ${pct(result.gated_metrics.answer_rate)} | ${pct(result.gated_metrics.answer_support_rate)} | ${pct(result.gated_metrics.overall_correct_rate)} | ${result.gated_metrics.supported_answers} | ${result.gated_metrics.unsupported_answers} |

## Suppressions

| Total | Useful unsupported suppressions | Harmful supported suppressions | Harmful answerable suppressions | Counterfactual suppressions |
| ---: | ---: | ---: | ---: | ---: |
| ${result.suppressions.total} | ${result.suppressions.useful_unsupported_answer_suppressions} | ${result.suppressions.harmful_supported_answer_suppressions} | ${result.suppressions.harmful_answerable_suppressions} | ${result.suppressions.counterfactual_suppressions} |

Reason counts:

${Object.entries(result.suppressions.reason_counts).map(([reason, count]) => `- ${reason}: ${count}`).join("\n")}

## Conclusion

Status: \`${result.status}\`

${result.conclusion.key_findings.map((line) => `- ${line}`).join("\n")}

${result.conclusion.next_intervention}

This gate makes no LLM calls and launches no compute.
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
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? "") : null,
  };
}

function pickMetrics(metrics) {
  return {
    answer_rate: metrics.answer_rate,
    answer_support_rate: metrics.answer_support_rate,
    overall_correct_rate: metrics.overall_correct_rate,
    supported_answers: metrics.supported_answers,
    unsupported_answers: metrics.unsupported_answers,
  };
}

function contentTokens(value) {
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function byId(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
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
