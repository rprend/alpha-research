import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "extended_temporal_future_holdout";
const runId = args["run-id"] ?? "support-ranker-pairwise-packet-2026-06-28-v1";
const sourcePlan = args["source-plan"] ?? "baseline";
const frontierRunId = args["frontier-run"] ?? "qwen-switch-frontier-audit-2026-06-28-v1";
const contractPoolRunId = args["contract-pool-run"] ?? "contract-aware-candidate-selector-final-window-v1";
const outputDir = path.join(runsDir, runId);
const comparativeTerms = ["best", "better", "worse", "worst", "outperform", "outperformed", "outperforms", "higher", "lower", "more", "less", "fewer", "larger", "smaller", "shorter", "longer", "improve", "improved", "increase", "increased", "decrease", "decreased", "reduce", "reduced", "significant", "significantly"];

const trainWindow = {
  id: "160-240",
  start: 160,
  end: 240,
  candidates: [
    {
      id: "direct_mini_repair",
      family: "openai_mini_scaffold",
      predictionRunId: "citation-contract-repair-direct-mini-extended-future-holdout-160-240-v1",
      judgeRunId: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-160-240-v1",
    },
    {
      id: "balanced_risk_gate",
      family: "openai_mini_scaffold",
      predictionRunId: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1",
      judgeRunId: "openai-judge-gpt4o-risk-gate-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1",
    },
  ],
};

const validationWindow = {
  id: "240-320",
  start: 240,
  end: 320,
  candidates: [
    {
      id: "direct_mini_repair",
      family: "openai_mini_scaffold",
      predictionRunId: "citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
      judgeRunId: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
    },
    {
      id: "balanced_risk_gate",
      family: "openai_mini_scaffold",
      predictionRunId: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
      judgeRunId: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
    },
    {
      id: "claim_entailment_guard",
      family: "openai_mini_scaffold",
      predictionRunId: "claim-entailment-guard-balanced-risk-gate-240-389-v1",
      judgeRunId: "openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1",
      predictionFilter: (row) => row.window === "241-320",
    },
  ],
};

const earlyFutureHoldoutWindows = [
  {
    id: "extended_future_holdout_0-80",
    split: "extended_temporal_future_holdout",
    start: 0,
    end: 80,
    candidates: [
      {
        id: "direct_mini_repair",
        family: "openai_mini_scaffold",
        predictionRunId: "citation-contract-repair-direct-mini-extended-future-holdout-0-80-v1",
        judgeRunId: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-0-80-v1",
      },
      {
        id: "claim_pruned_rubric_repair",
        family: "openai_mini_scaffold",
        predictionRunId: "citation-contract-repair-claim-pruned-rubric-extended-future-holdout-0-80-v1",
        judgeRunId: "openai-judge-gpt4o-citation-contract-repair-claim-pruned-rubric-extended-future-holdout-0-80-v1",
      },
      {
        id: "claim_pruner_direct_repair",
        family: "openai_mini_scaffold",
        predictionRunId: "citation-contract-repair-claim-pruner-mini-direct-repair-extended-future-holdout-0-80-v1",
        judgeRunId: "openai-judge-gpt4o-citation-contract-repair-claim-pruner-mini-direct-repair-extended-future-holdout-0-80-v1",
      },
    ],
  },
  {
    id: "extended_future_holdout_80-160",
    split: "extended_temporal_future_holdout",
    start: 80,
    end: 160,
    candidates: [
      {
        id: "direct_mini_repair",
        family: "openai_mini_scaffold",
        predictionRunId: "citation-contract-repair-direct-mini-extended-future-holdout-80-160-v1",
        judgeRunId: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-80-160-v1",
      },
      {
        id: "claim_pruned_rubric_repair",
        family: "openai_mini_scaffold",
        predictionRunId: "citation-contract-repair-claim-pruned-rubric-extended-future-holdout-80-160-v1",
        judgeRunId: "openai-judge-gpt4o-citation-contract-repair-claim-pruned-rubric-extended-future-holdout-80-160-v1",
      },
      {
        id: "claim_pruner_direct_repair",
        family: "openai_mini_scaffold",
        predictionRunId: "citation-contract-repair-claim-pruner-mini-direct-repair-extended-future-holdout-80-160-v1",
        judgeRunId: "openai-judge-gpt4o-citation-contract-repair-claim-pruner-mini-direct-repair-extended-future-holdout-80-160-v1",
      },
    ],
  },
];

const temporalTestValidationWindows = [
  {
    id: "temporal_test_132-172",
    split: "temporal_test",
    start: 132,
    end: 172,
    candidates: [
      {
        id: "answer_recovery",
        family: "openai_mini_scaffold",
        predictionRunId: "citation-contract-repair-answer-recovery-temporal-test-132-172-v1",
        judgeRunId: "openai-judge-citation-contract-repair-answer-recovery-temporal-test-132-172-v1",
      },
      {
        id: "quote_extractive",
        family: "openai_mini_scaffold",
        predictionRunId: "citation-contract-repair-quote-extractive-temporal-test-132-172-v1",
        judgeRunId: "openai-judge-gpt4o-citation-contract-repair-quote-extractive-temporal-test-132-172-v1",
      },
      {
        id: "claim_pruner_gpt4o_quote",
        family: "openai_gpt4o_scaffold",
        predictionRunId: "citation-contract-repair-claim-pruner-gpt4o-quote-extractive-temporal-test-132-172-v1",
        judgeRunId: "openai-judge-gpt4o-citation-contract-repair-claim-pruner-gpt4o-quote-extractive-temporal-test-132-172-v1",
      },
      {
        id: "claim_pruner_mini_quote",
        family: "openai_mini_scaffold",
        predictionRunId: "citation-contract-repair-claim-pruner-mini-quote-extractive-temporal-test-132-172-v1",
        judgeRunId: "openai-judge-gpt4o-citation-contract-repair-claim-pruner-mini-quote-extractive-temporal-test-132-172-v1",
      },
    ],
  },
];

const temporalTestTrainWindows = [
  {
    id: "temporal_test_80-132",
    split: "temporal_test",
    start: 80,
    end: 132,
    candidates: [
      {
        id: "direct_mini_repair",
        family: "openai_mini_scaffold",
        predictionRunId: "citation-contract-repair-direct-mini-temporal-test-80-132-v1",
        judgeRunId: "openai-judge-gpt4o-citation-contract-repair-direct-mini-temporal-test-80-132-v1",
      },
      {
        id: "answer_recovery",
        family: "openai_mini_scaffold",
        predictionRunId: "citation-contract-repair-answer-recovery-temporal-test-80-132-v1",
        judgeRunId: "openai-judge-citation-contract-repair-answer-recovery-temporal-test-80-132-v1",
      },
    ],
  },
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const referencesById = new Map(references.map((row) => [row.example_id, row]));
const referenceCache = new Map([[split, references]]);
const finalWindowRows = references.slice(320, 389);
const finalWindowPaperIds = new Set(finalWindowRows.map((row) => row.input.document_metadata.paper_id));
const { trainWindows, validationWindows } = buildSourcePlan(sourcePlan);

const trainPairs = (await Promise.all(trainWindows.map((window) => buildWindowPairs(window, "train")))).flat();
const validationPairs = (await Promise.all(validationWindows.map((window) => buildWindowPairs(window, "validation")))).flat();
const diagnosticPairs = await buildFrontierDiagnosticPairs();

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "support_ranker_pairwise_packet",
  status: deriveStatus(trainPairs, validationPairs, diagnosticPairs),
  purpose: "Construct leakage-safe pairwise answer-support ranking data from existing judged candidates, with final-window Qwen switch frontier rows kept diagnostic-only.",
  source_runs: {
    frontier_audit: frontierRunId,
    contract_pool: contractPoolRunId,
  },
  split,
  source_plan: sourcePlan,
  windows: {
    train: summarizeWindows(trainWindows, trainPairs),
    validation: summarizeWindows(validationWindows, validationPairs),
    final_diagnostic: {
      source: frontierRunId,
      pairwise_rows: diagnosticPairs.length,
      training_use: "forbidden_diagnostic_only",
    },
  },
  aggregate: {
    train_pairs: trainPairs.length,
    validation_pairs: validationPairs.length,
    diagnostic_pairs: diagnosticPairs.length,
    train_examples_with_pairs: new Set(trainPairs.map((row) => row.example_id)).size,
    validation_examples_with_pairs: new Set(validationPairs.map((row) => row.example_id)).size,
    diagnostic_examples_with_pairs: new Set(diagnosticPairs.map((row) => row.example_id)).size,
    train_candidate_family_mix: groupCount(trainPairs.flatMap((row) => [row.chosen.family, row.rejected.family])),
    validation_candidate_family_mix: groupCount(validationPairs.flatMap((row) => [row.chosen.family, row.rejected.family])),
    diagnostic_candidate_family_mix: groupCount(diagnosticPairs.flatMap((row) => [row.chosen.family, row.rejected.family])),
  },
  leakage_guard: {
    final_window_ids_in_train: intersection(new Set(trainPairs.map((row) => row.example_id)), new Set(diagnosticPairs.map((row) => row.example_id))),
    final_window_papers_in_train_or_validation: intersection(new Set([...trainPairs, ...validationPairs].map((row) => row.input.document_metadata.paper_id)), finalWindowPaperIds),
    final_window_training_use: "forbidden",
    train_window: trainWindows.map((window) => window.id).join(","),
    validation_window: validationWindows.map((window) => window.id).join(","),
  },
  next_step_recommendation: nextStepRecommendation(trainPairs, validationPairs, diagnosticPairs),
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This packet reuses existing predictions and paid judgments only.",
  },
};

await writeJsonl(path.join(outputDir, "train_pairwise.jsonl"), trainPairs);
await writeJsonl(path.join(outputDir, "validation_pairwise.jsonl"), validationPairs);
await writeJsonl(path.join(outputDir, "diagnostic_frontier_pairwise.jsonl"), diagnosticPairs);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  aggregate: result.aggregate,
  next_step_recommendation: result.next_step_recommendation,
}, null, 2));

function buildSourcePlan(plan) {
  if (plan === "expanded") {
    return {
      trainWindows: [
        ...earlyFutureHoldoutWindows,
        trainWindow,
        ...temporalTestTrainWindows,
      ],
      validationWindows: [
        validationWindow,
        ...temporalTestValidationWindows,
      ],
    };
  }
  if (plan !== "baseline") throw new Error(`Unknown source plan: ${plan}`);
  return {
    trainWindows: [trainWindow],
    validationWindows: [validationWindow],
  };
}

async function buildWindowPairs(window, splitName) {
  const sourceReferences = await getReferences(window.split ?? split);
  const sourceReferencesById = new Map(sourceReferences.map((row) => [row.example_id, row]));
  const rows = sourceReferences
    .slice(window.start, window.end)
    .filter((row) => !finalWindowPaperIds.has(row.input.document_metadata.paper_id));
  const ids = rows.map((row) => row.example_id);
  const candidatesById = await loadWindowCandidates(window, new Set(ids), sourceReferencesById);
  const pairs = [];
  for (const id of ids) {
    const reference = sourceReferencesById.get(id);
    const candidates = candidatesById.get(id) ?? [];
    const chosen = candidates.filter((candidate) => candidate.supported_answer && candidate.answer_citation_complete);
    const rejected = candidates.filter((candidate) => candidate.unsupported_answer && candidate.answer_citation_complete);
    for (const chosenCandidate of chosen) {
      for (const rejectedCandidate of rejected) {
        pairs.push(pairRow({
          splitName,
          windowId: window.id,
          reference,
          chosen: chosenCandidate,
          rejected: rejectedCandidate,
          trainingUse: splitName === "train" ? "allowed_train" : "allowed_validation",
          source: "pre_final_scaffold_candidate_pair",
        }));
      }
    }
  }
  return pairs;
}

async function loadWindowCandidates(window, ids, sourceReferencesById) {
  const loaded = [];
  for (const spec of window.candidates) {
    let predictions = await readJsonl(path.join(runsDir, spec.predictionRunId, "predictions.jsonl"));
    predictions = predictions.filter(spec.predictionFilter ?? (() => true));
    const judgments = await readJsonl(path.join(runsDir, spec.judgeRunId, "judgments.jsonl"));
    loaded.push({
      ...spec,
      predictions: new Map(predictions.filter((row) => ids.has(row.example_id)).map((row) => [row.example_id, row])),
      judgments: new Map(judgments.filter((row) => ids.has(row.example_id)).map((row) => [row.example_id, row])),
    });
  }
  const byExample = new Map();
  for (const id of ids) {
    const reference = sourceReferencesById.get(id);
    const candidates = loaded.flatMap((spec) => {
      const predictionRow = spec.predictions.get(id);
      const judgmentRow = spec.judgments.get(id);
      if (!predictionRow || !judgmentRow) return [];
      return [candidateFromRows({ spec, reference, predictionRow, judgmentRow })];
    });
    byExample.set(id, candidates);
  }
  return byExample;
}

async function getReferences(sourceSplit) {
  if (!referenceCache.has(sourceSplit)) {
    referenceCache.set(sourceSplit, await readJsonl(path.join(dataDir, `${sourceSplit}.jsonl`)));
  }
  return referenceCache.get(sourceSplit);
}

async function buildFrontierDiagnosticPairs() {
  const frontierRows = await readJsonl(path.join(runsDir, frontierRunId, "rows.jsonl"));
  const contractRows = byId(await readJsonl(path.join(runsDir, contractPoolRunId, "rows.jsonl")));
  const pairs = [];
  for (const frontierRow of frontierRows) {
    if (!frontierRow.frontier_eligible) continue;
    const contractRow = contractRows.get(frontierRow.example_id);
    const reference = referencesById.get(frontierRow.example_id);
    if (!contractRow || !reference) continue;
    const candidates = contractRow.candidates
      .filter((candidate) => candidate.family?.startsWith("qwen"))
      .filter((candidate) => candidate.answered)
      .filter((candidate) => candidate.contract?.answer_citation_complete === true)
      .map((candidate) => candidateFromContractCandidate(candidate));
    const supported = candidates.filter((candidate) => candidate.supported_answer);
    const unsupported = candidates.filter((candidate) => candidate.unsupported_answer);
    for (const chosen of supported) {
      for (const rejected of unsupported) {
        pairs.push(pairRow({
          splitName: "diagnostic_final_window",
          windowId: "321-389",
          reference,
          chosen,
          rejected,
          trainingUse: "forbidden_diagnostic_only",
          source: "qwen_switch_frontier_pair",
        }));
      }
    }
  }
  return pairs;
}

function candidateFromRows({ spec, reference, predictionRow, judgmentRow }) {
  const prediction = normalizePrediction(predictionRow.prediction ?? {});
  const judgment = judgmentRow.judgment ?? {};
  const supported = prediction.answer_type === "grounded_answer" && isSupportedAnswer(judgment);
  const unsupported = prediction.answer_type === "grounded_answer" && !supported;
  return {
    id: spec.id,
    family: spec.family,
    prediction_run_id: spec.predictionRunId,
    judge_run_id: spec.judgeRunId,
    prediction,
    judgment,
    supported_answer: supported,
    unsupported_answer: unsupported,
    answer_citation_complete: answerCitationComplete(reference, prediction),
    features: supportFeatures(reference, prediction),
  };
}

function candidateFromContractCandidate(candidate) {
  return {
    id: candidate.id,
    family: candidate.family,
    prediction_run_id: candidate.prediction_run_id,
    judge_run_id: candidate.judge_run_id,
    prediction: normalizePrediction(candidate.prediction ?? {}),
    judgment: candidate.judgment ?? {},
    supported_answer: candidate.supported_answer === true,
    unsupported_answer: candidate.answered === true && candidate.supported_answer !== true,
    answer_citation_complete: candidate.contract?.answer_citation_complete === true,
    features: {
      ...candidate.scores,
      heuristic_score: candidate.heuristic_score,
      answer_tokens: contentTokens(candidate.prediction?.answer).length,
      citation_count: candidate.prediction?.citations?.length ?? 0,
      claim_count: candidate.prediction?.claim_table?.length ?? 0,
    },
  };
}

function pairRow({ splitName, windowId, reference, chosen, rejected, trainingUse, source }) {
  return {
    pair_id: `${reference.example_id}:${chosen.id}:over:${rejected.id}`,
    example_id: reference.example_id,
    split: splitName,
    window: windowId,
    source,
    training_use: trainingUse,
    input: {
      question: reference.input.question,
      compact_retrieved_evidence_pack: reference.input.compact_retrieved_evidence_pack,
      document_metadata: reference.input.document_metadata,
    },
    reference: {
      answer_type: reference.output.answer_type,
      answer: reference.output.answer,
      citations: (reference.output.citations ?? []).map((citation) => citation.evidence_id),
    },
    chosen: stripCandidate(chosen),
    rejected: stripCandidate(rejected),
    label: {
      preferred: "chosen",
      reason: "chosen answer is supported by existing GPT-4o judgment and rejected answer is unsupported while both satisfy the answer-citation contract",
    },
    feature_delta: featureDelta(chosen.features, rejected.features),
  };
}

function stripCandidate(candidate) {
  return {
    id: candidate.id,
    family: candidate.family,
    prediction_run_id: candidate.prediction_run_id,
    judge_run_id: candidate.judge_run_id,
    answer: candidate.prediction.answer,
    citations: candidate.prediction.citations,
    claim_table: candidate.prediction.claim_table,
    judgment: {
      verdict: candidate.judgment.verdict ?? null,
      all_claims_supported: candidate.judgment.all_claims_supported ?? null,
      citation_ids_valid: candidate.judgment.citation_ids_valid ?? null,
      unsupported_claims: candidate.judgment.unsupported_claims ?? [],
    },
    features: candidate.features,
  };
}

function supportFeatures(reference, prediction) {
  const evidenceById = new Map(reference.input.compact_retrieved_evidence_pack.map((row) => [row.evidence_id, row]));
  const citedText = prediction.citations.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  const answerTokens = contentTokens(prediction.answer);
  const citedTokens = contentTokens(citedText);
  const packTokens = contentTokens(reference.input.compact_retrieved_evidence_pack.map((row) => row.text).join(" "));
  const questionTokens = contentTokens(reference.input.question);
  const claimTexts = prediction.claim_table.map((claim) => `${claim.claim ?? ""} ${claim.support ?? ""} ${claim.evidence ?? ""}`);
  const claimCoverages = claimTexts.map((claim) => tokenCoverage(contentTokens(claim), citedTokens));
  return {
    answer_cited_token_coverage: tokenCoverage(answerTokens, citedTokens),
    answer_pack_token_coverage: tokenCoverage(answerTokens, packTokens),
    question_answer_overlap: tokenCoverage(questionTokens, answerTokens),
    question_cited_overlap: tokenCoverage(questionTokens, citedTokens),
    claim_min_cited_coverage: claimCoverages.length ? Math.min(...claimCoverages) : 0,
    claim_mean_cited_coverage: mean(claimCoverages),
    answer_tokens: answerTokens.length,
    citation_count: prediction.citations.length,
    claim_count: prediction.claim_table.length,
    unsupported_number_count: unsupportedCount(numberTokens(prediction.answer), `${citedText} ${reference.input.question}`),
    unsupported_comparative_count: unsupportedCount(matchedTerms(prediction.answer, comparativeTerms), `${citedText} ${reference.input.question}`),
  };
}

function featureDelta(chosenFeatures, rejectedFeatures) {
  const keys = new Set([...Object.keys(chosenFeatures ?? {}), ...Object.keys(rejectedFeatures ?? {})]);
  return Object.fromEntries([...keys].sort().map((key) => [key, Number(chosenFeatures?.[key] ?? 0) - Number(rejectedFeatures?.[key] ?? 0)]));
}

function deriveStatus(trainPairs, validationPairs, diagnosticPairs) {
  if (trainPairs.length >= 50 && validationPairs.length >= 20 && diagnosticPairs.length >= 1) return "pairwise_packet_ready_for_ranker_training";
  if (trainPairs.length > 0 && validationPairs.length > 0 && diagnosticPairs.length > 0) return "pairwise_signal_present_but_sparse";
  return "pairwise_signal_insufficient";
}

function nextStepRecommendation(trainPairs, validationPairs, diagnosticPairs) {
  if (trainPairs.length + validationPairs.length < 25) {
    return {
      should_train_ranker_now: false,
      should_launch_gpu_now: false,
      reason: "Existing pre-final judged candidates produce too few supported-vs-unsupported answer pairs for a reliable ranker. Add or mine more pre-final candidate diversity before training.",
      needed: "Generate or reuse more non-final candidate variants with GPT-4o support judgments, then rebuild this packet with at least 50 train pairs and 20 validation pairs.",
    };
  }
  return {
    should_train_ranker_now: true,
    should_launch_gpu_now: false,
    reason: "The packet has enough non-final pairwise rows for a local ranker experiment; train/evaluate that before any additional GPU generation run.",
    diagnostic_frontier_pairs: diagnosticPairs.length,
  };
}

function summarizeWindow(window, pairs) {
  return {
    id: window.id,
    source_range: [window.start, window.end],
    candidate_ids: window.candidates.map((row) => row.id),
    pairwise_rows: pairs.length,
    examples_with_pairs: new Set(pairs.map((row) => row.example_id)).size,
  };
}

function summarizeWindows(windows, pairs) {
  if (windows.length === 1) return summarizeWindow(windows[0], pairs);
  return {
    id: windows.map((window) => window.id).join(","),
    source_ranges: windows.map((window) => ({
      id: window.id,
      split: window.split ?? split,
      source_range: [window.start, window.end],
      candidate_ids: window.candidates.map((row) => row.id),
      pairwise_rows: pairs.filter((row) => row.window === window.id).length,
      examples_with_pairs: new Set(pairs.filter((row) => row.window === window.id).map((row) => row.example_id)).size,
    })),
    candidate_ids: [...new Set(windows.flatMap((window) => window.candidates.map((row) => row.id)))],
    pairwise_rows: pairs.length,
    examples_with_pairs: new Set(pairs.map((row) => row.example_id)).size,
  };
}

function answerCitationComplete(reference, prediction) {
  if (prediction.answer_type !== "grounded_answer") return true;
  const evidenceIds = new Set(reference.input.compact_retrieved_evidence_pack.map((row) => row.evidence_id));
  const top = prediction.citations;
  const inline = extractInlineCitationIds(prediction.answer);
  return top.length > 0 && inline.length > 0 && top.every((id) => evidenceIds.has(id)) && inline.every((id) => evidenceIds.has(id));
}

function isSupportedAnswer(judgment) {
  return judgment?.verdict === "supported" && judgment?.all_claims_supported === true && judgment?.citation_ids_valid !== false;
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

function renderReport(result) {
  return `# Support Ranker Pairwise Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no compute. It constructs pairwise ranking data from existing paid judgments.

## Pair Counts

| Split | Window | Pairs | Examples with pairs | Training use |
| --- | --- | ---: | ---: | --- |
| Train | ${result.windows.train.id} | ${result.windows.train.pairwise_rows} | ${result.windows.train.examples_with_pairs} | allowed |
| Validation | ${result.windows.validation.id} | ${result.windows.validation.pairwise_rows} | ${result.windows.validation.examples_with_pairs} | allowed |
| Diagnostic | 321-389 | ${result.windows.final_diagnostic.pairwise_rows} | ${result.aggregate.diagnostic_examples_with_pairs} | forbidden diagnostic only |

## Recommendation

- Train ranker now: ${result.next_step_recommendation.should_train_ranker_now ? "yes" : "no"}
- Launch GPU now: ${result.next_step_recommendation.should_launch_gpu_now ? "yes" : "no"}
- Reason: ${result.next_step_recommendation.reason}
`;
}

function extractInlineCitationIds(answer) {
  return [...String(answer ?? "").matchAll(/\[([^\]]+)\]/g)]
    .flatMap((match) => match[1].split(/[,;\s]+/))
    .map((id) => id.trim())
    .filter((id) => /^E\d+$/i.test(id))
    .map((id) => id.toUpperCase());
}

function matchedTerms(value, terms) {
  const text = ` ${String(value ?? "").toLowerCase()} `;
  return terms.filter((term) => text.includes(` ${term} `));
}

function numberTokens(value) {
  return String(value ?? "").match(/[-+]?\d+(?:[.,]\d+)*(?:%| percent)?/gi) ?? [];
}

function unsupportedCount(values, supportText) {
  const support = String(supportText ?? "").toLowerCase();
  return values.filter((value) => !support.includes(String(value).toLowerCase())).length;
}

function contentTokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function tokenCoverage(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size) return 0;
  return [...left].filter((token) => right.has(token)).length / left.size;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function groupCount(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function intersection(left, right) {
  return [...left].filter((value) => right.has(value));
}

function byId(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
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

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : true;
  }
  return parsed;
}
