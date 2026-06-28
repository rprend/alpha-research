import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const args = parseArgs(process.argv.slice(2));

const predictionRunId = args["prediction-run"] ?? "joint-action-qwen7b-nonfinal-frontier-pool-v2-citation-repair";
const judgeRunId = args["judge-run"] ?? "openai-judge-gpt4o-joint-action-qwen7b-nonfinal-frontier-pool-v2-citation-repair";
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen7b-nonfinal-frontier-pool-v2";
const runId = args["run-id"] ?? "qwen-frontier-pool-support-packet-2026-06-28-v1";
const split = args.split ?? "extended_temporal_future_holdout";
const trainMaxSourceIndex = Number(args["train-max-source-index"] ?? 300);
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const referencesById = new Map(references.map((row, sourceIndex) => [row.example_id, { row, sourceIndex }]));
const predictions = await readJsonl(path.join(runsDir, predictionRunId, "predictions.jsonl"));
const judgments = await readJsonl(path.join(runsDir, judgeRunId, "judgments.jsonl"));
const judgmentsById = new Map(judgments.map((row) => [row.example_id, row]));
const predictionResult = await readJson(path.join(runsDir, predictionRunId, "result.json"));
const judgeResult = await readJson(path.join(runsDir, judgeRunId, "result.json"));
const packetResult = await readJson(path.join(runsDir, packetRunId, "result.json"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const supportLabels = predictions.map((predictionRow) => supportLabelRow(predictionRow)).filter(Boolean);
const groups = groupBy(supportLabels, (row) => row.root_example_id);
const rootSummaries = [...groups.entries()].map(([rootExampleId, rows]) => rootSummaryRow(rootExampleId, rows));
const frontierPairs = rootSummaries.flatMap((summary) => contrastPairsForSummary(summary));
const trainPairs = frontierPairs.filter((pair) => pair.source_index < trainMaxSourceIndex);
const validationPairs = frontierPairs.filter((pair) => pair.source_index >= trainMaxSourceIndex);
const generatedCandidatePairs = frontierPairs.filter((pair) => pair.contrast_type === "generated_supported_vs_generated_unsupported");
const referenceFallbackPairs = frontierPairs.filter((pair) => pair.contrast_type === "reference_supported_vs_generated_unsupported");

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen_frontier_pool_support_packet",
  prediction_run_id: predictionRunId,
  judge_run_id: judgeRunId,
  packet_run_id: packetRunId,
  split,
  purpose: "Convert a paid non-final multi-sample Qwen frontier pool plus GPT-4o support judgments into leakage-safe support labels and candidate-level contrast pairs.",
  counts: {
    predictions: predictions.length,
    judgments: judgments.length,
    support_labels: supportLabels.length,
    roots: rootSummaries.length,
    answered_labels: supportLabels.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstained_labels: supportLabels.filter((row) => row.prediction.answer_type === "abstain").length,
    supported_answers: supportLabels.filter((row) => row.labels.supported_answer).length,
    unsupported_answers: supportLabels.filter((row) => row.labels.unsupported_answer).length,
    supported_abstentions: supportLabels.filter((row) => row.labels.supported_abstention).length,
    invalid_or_partial_answers: supportLabels.filter((row) => row.labels.invalid_or_partial_answer).length,
    roots_with_generated_supported_and_unsupported_answers: rootSummaries.filter((row) => row.supported_answer_candidates > 0 && row.unsupported_answer_candidates > 0).length,
    roots_with_reference_fallback_pairs: rootSummaries.filter((row) => row.reference_fallback_pair_count > 0).length,
    frontier_contrast_pairs: frontierPairs.length,
    generated_candidate_contrast_pairs: generatedCandidatePairs.length,
    reference_fallback_contrast_pairs: referenceFallbackPairs.length,
    train_pairs: trainPairs.length,
    validation_pairs: validationPairs.length,
  },
  metrics_inherited: {
    prediction: predictionResult.metrics,
    judge: judgeResult.metrics,
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    source_index_min: min(supportLabels.map((row) => row.source_index)),
    source_index_max: max(supportLabels.map((row) => row.source_index)),
    train_source_index_range: numericRange(trainPairs.map((row) => row.source_index)),
    validation_source_index_range: numericRange(validationPairs.map((row) => row.source_index)),
    train_max_source_index: trainMaxSourceIndex,
    training_use: "allowed_nonfinal_frontier_supervision",
    packet_training_source: packetResult.leakage_guard ?? packetResult.training_source ?? null,
  },
  decision: decisionFromCounts(generatedCandidatePairs, validationPairs),
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    inherited_openai_cost_usd: judgeResult.run_cost_usd,
    inherited_external_compute_cost_usd: 0.22,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This packet builder makes no API calls and launches no compute. It reuses the paid prediction, Prime, and judge artifacts recorded in their source ledgers.",
  },
  artifacts: {
    support_labels_jsonl: rel(path.join(outputDir, "support_labels.jsonl")),
    root_group_summary_jsonl: rel(path.join(outputDir, "root_group_summary.jsonl")),
    frontier_contrast_pairs_jsonl: rel(path.join(outputDir, "frontier_contrast_pairs.jsonl")),
    train_contrast_pairs_jsonl: rel(path.join(outputDir, "train_contrast_pairs.jsonl")),
    validation_contrast_pairs_jsonl: rel(path.join(outputDir, "validation_contrast_pairs.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "support_labels.jsonl"), supportLabels);
await writeJsonl(path.join(outputDir, "root_group_summary.jsonl"), rootSummaries);
await writeJsonl(path.join(outputDir, "frontier_contrast_pairs.jsonl"), frontierPairs);
await writeJsonl(path.join(outputDir, "train_contrast_pairs.jsonl"), trainPairs);
await writeJsonl(path.join(outputDir, "validation_contrast_pairs.jsonl"), validationPairs);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({ run_id: runId, counts: result.counts, decision: result.decision, budget: result.budget }, null, 2));

function supportLabelRow(predictionRow) {
  const rootExampleId = predictionRow.root_example_id ?? predictionRow.example_id;
  const reference = referencesById.get(rootExampleId);
  const judge = judgmentsById.get(predictionRow.example_id);
  if (!reference || !judge) return null;
  const prediction = normalizeOutput(predictionRow.prediction);
  const judgment = normalizeJudgment(judge.judgment);
  const isAnswer = prediction.answer_type === "grounded_answer";
  const isSupportedAnswer = isAnswer
    && judgment.verdict === "supported"
    && judgment.all_claims_supported === true
    && judgment.citation_ids_valid === true;
  const isSupportedAbstention = prediction.answer_type === "abstain"
    && (judgment.abstention_supported === true || judgment.verdict === "correct_abstention");
  const isInvalidOrPartialAnswer = isAnswer
    && (judgment.verdict === "invalid_json" || judgment.verdict === "partial" || judgment.all_claims_supported == null);
  return {
    example_id: predictionRow.example_id,
    root_example_id: rootExampleId,
    sample_index: predictionRow.sample_index ?? null,
    split,
    source_index: reference.sourceIndex,
    source_prediction_run: predictionRunId,
    source_judge_run: judgeRunId,
    input: reference.row.input,
    reference: normalizeOutput(reference.row.output),
    prediction,
    labels: {
      supported_answer: isSupportedAnswer,
      unsupported_answer: isAnswer && !isSupportedAnswer,
      supported_abstention: isSupportedAbstention,
      invalid_or_partial_answer: isInvalidOrPartialAnswer,
      answerable_reference: reference.row.output?.answer_type === "grounded_answer",
      citation_ids_valid: judgment.citation_ids_valid === true,
      all_claims_supported: judgment.all_claims_supported === true,
      abstention_supported: judgment.abstention_supported === true,
    },
    judge: judgment,
    scores: predictionRow.scores ?? {},
    training_use: "allowed_nonfinal_frontier_supervision",
  };
}

function rootSummaryRow(rootExampleId, rows) {
  const first = rows[0];
  const supportedAnswers = rows.filter((row) => row.labels.supported_answer);
  const unsupportedAnswers = rows.filter((row) => row.labels.unsupported_answer);
  const supportedAbstentions = rows.filter((row) => row.labels.supported_abstention);
  const referenceIsGrounded = first.reference.answer_type === "grounded_answer";
  const referenceFallbackPairCount = referenceIsGrounded && supportedAnswers.length === 0 ? unsupportedAnswers.length : 0;
  return {
    root_example_id: rootExampleId,
    split,
    source_index: first.source_index,
    input: first.input,
    reference: first.reference,
    sample_count: rows.length,
    answered_candidates: rows.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstained_candidates: rows.filter((row) => row.prediction.answer_type === "abstain").length,
    supported_answer_candidates: supportedAnswers.length,
    unsupported_answer_candidates: unsupportedAnswers.length,
    supported_abstention_candidates: supportedAbstentions.length,
    invalid_or_partial_answer_candidates: rows.filter((row) => row.labels.invalid_or_partial_answer).length,
    generated_pair_count: supportedAnswers.length * unsupportedAnswers.length,
    reference_fallback_pair_count: referenceFallbackPairCount,
    labels: rows.map((row) => ({
      example_id: row.example_id,
      sample_index: row.sample_index,
      prediction: row.prediction,
      labels: row.labels,
      judge: row.judge,
    })),
  };
}

function contrastPairsForSummary(summary) {
  const rows = summary.labels;
  const supportedGenerated = rows.filter((row) => row.labels.supported_answer);
  const unsupportedGenerated = rows.filter((row) => row.labels.unsupported_answer);
  const pairs = [];
  for (const chosen of supportedGenerated) {
    for (const rejected of unsupportedGenerated) {
      pairs.push(contrastPair(summary, chosen, rejected, "generated_supported_vs_generated_unsupported"));
    }
  }
  if (!supportedGenerated.length && summary.reference.answer_type === "grounded_answer") {
    for (const rejected of unsupportedGenerated) {
      pairs.push(contrastPair(summary, { example_id: `${summary.root_example_id}::reference`, sample_index: null, prediction: summary.reference, labels: { supported_answer: true }, judge: null }, rejected, "reference_supported_vs_generated_unsupported"));
    }
  }
  return pairs;
}

function contrastPair(summary, chosenRow, rejectedRow, contrastType) {
  return {
    pair_id: `${contrastType}:${summary.root_example_id}:${chosenRow.sample_index ?? "reference"}:${rejectedRow.sample_index}`,
    root_example_id: summary.root_example_id,
    split,
    source_index: summary.source_index,
    source: "qwen_frontier_pool_support_packet",
    contrast_type: contrastType,
    training_use: "allowed_nonfinal_frontier_supervision",
    train_split: summary.source_index < trainMaxSourceIndex ? "train" : "validation",
    input: summary.input,
    chosen: {
      id: chosenRow.example_id,
      family: contrastType.startsWith("reference") ? "qasper_reference" : "qwen7b_nonfinal_frontier_pool",
      sample_index: chosenRow.sample_index,
      ...normalizeOutput(chosenRow.prediction),
    },
    rejected: {
      id: rejectedRow.example_id,
      family: "qwen7b_nonfinal_frontier_pool",
      sample_index: rejectedRow.sample_index,
      ...normalizeOutput(rejectedRow.prediction),
      unsupported_claims: rejectedRow.judge?.unsupported_claims ?? [],
    },
    judge: {
      chosen: chosenRow.judge,
      rejected: rejectedRow.judge,
    },
  };
}

function normalizeOutput(value) {
  const answerType = value?.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value?.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id ?? citation?.citation).filter(Boolean).map(String)
    : [];
  return {
    answer_type: answerType,
    answer: String(value?.answer ?? ""),
    citations,
    claim_table: normalizeClaimTable(value?.claim_table),
    abstention_reason: value?.abstention_reason ?? null,
  };
}

function normalizeClaimTable(value) {
  if (!Array.isArray(value)) return [];
  return value.map((claim) => {
    const citations = Array.isArray(claim?.citations)
      ? claim.citations
      : Array.isArray(claim?.evidence)
        ? claim.evidence.map((row) => row?.citation).filter(Boolean)
        : [];
    return {
      claim: String(claim?.claim ?? ""),
      support: claim?.support ?? null,
      citations: citations.map(String),
    };
  });
}

function normalizeJudgment(value) {
  return {
    verdict: value?.verdict ?? "invalid_judgment",
    all_claims_supported: value?.all_claims_supported ?? null,
    citation_ids_valid: value?.citation_ids_valid ?? null,
    abstention_supported: value?.abstention_supported ?? null,
    unsupported_claims: Array.isArray(value?.unsupported_claims) ? value.unsupported_claims : [],
    missing_citations: Array.isArray(value?.missing_citations) ? value.missing_citations : [],
    notes: String(value?.notes ?? ""),
  };
}

function decisionFromCounts(generatedPairs, validationPairs) {
  if (generatedPairs.length >= 24 && validationPairs.length >= 6) {
    return {
      train_verifier_now: true,
      launch_gpu_now: false,
      buy_more_openai_labels_now: false,
      reason: "The judged pool contains enough within-Qwen generated supported-vs-unsupported contrasts to test a zero-cost verifier before more paid generation.",
      next_step: "Train a pool-contrast verifier and require held-out non-final plus final diagnostic gains before launching another GPU run.",
    };
  }
  return {
    train_verifier_now: generatedPairs.length > 0,
    launch_gpu_now: false,
    buy_more_openai_labels_now: false,
    reason: "The judged pool has limited distribution-matched generated contrasts; use it as an audit packet and avoid more generator spend until verifier gains are shown.",
    next_step: "Run the cheapest verifier diagnostic available, then decide whether a small targeted label batch is justified.",
  };
}

function renderReport(result) {
  return `# Qwen Frontier Pool Support Packet

Generated: ${result.generated_at}

This packet makes no new API calls and launches no compute. It reuses \`${result.prediction_run_id}\` and \`${result.judge_run_id}\`.

| Item | Count |
| --- | ---: |
| Predictions | ${result.counts.predictions} |
| Support labels | ${result.counts.support_labels} |
| Supported answers | ${result.counts.supported_answers} |
| Unsupported answers | ${result.counts.unsupported_answers} |
| Supported abstentions | ${result.counts.supported_abstentions} |
| Roots with generated supported and unsupported answers | ${result.counts.roots_with_generated_supported_and_unsupported_answers} |
| Generated candidate contrast pairs | ${result.counts.generated_candidate_contrast_pairs} |
| Reference fallback contrast pairs | ${result.counts.reference_fallback_contrast_pairs} |
| Train pairs | ${result.counts.train_pairs} |
| Validation pairs | ${result.counts.validation_pairs} |

## Decision

- Train verifier now: ${result.decision.train_verifier_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}

## Budget

Total tracked spend remains $${result.budget.actual_total_spend_usd}. This script adds $0.
`;
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

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function rel(file) {
  return path.relative(rootDir, file);
}

function min(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.min(...finite) : null;
}

function max(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.max(...finite) : null;
}

function numericRange(values) {
  return [min(values), max(values)];
}
