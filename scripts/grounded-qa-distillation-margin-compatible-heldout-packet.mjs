import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "extended_temporal_future_holdout";
const runId = args["run-id"] ?? "margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const startIndex = Number(args.start ?? 320);
const endIndex = Number(args.end ?? 389);

const sourceRuns = {
  direct: {
    predictionRunId: "citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
    judgeRunId: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
    family: "direct_mini_repair",
  },
  risk: {
    predictionRunId: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    judgeRunId: "openai-judge-mini-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    family: "risk_gate_balanced_claim_pruner",
  },
  claim_entailment_guard: {
    predictionRunId: "claim-entailment-guard-balanced-risk-gate-240-389-v1",
    judgeRunId: "openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1",
    family: "claim_entailment_guard",
  },
};

await fs.mkdir(outputDir, { recursive: true });

const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const finalWindow = references.slice(startIndex, endIndex);
const finalIds = new Set(finalWindow.map((row) => row.example_id));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const sourceData = {};
for (const [policy, source] of Object.entries(sourceRuns)) {
  const predictions = (await readJsonl(path.join(runsDir, source.predictionRunId, "predictions.jsonl")))
    .filter((row) => finalIds.has(row.example_id));
  const judgments = (await readJsonl(path.join(runsDir, source.judgeRunId, "judgments.jsonl")))
    .filter((row) => finalIds.has(row.example_id));
  sourceData[policy] = {
    ...source,
    predictionsById: new Map(predictions.map((row) => [row.example_id, row])),
    judgmentsById: new Map(judgments.map((row) => [row.example_id, row])),
    prediction_count: predictions.length,
    judgment_count: judgments.length,
  };
}

const supportLabels = [];
const exampleSummaries = [];
const rawPairRows = [];

for (let sourceIndex = startIndex; sourceIndex < endIndex; sourceIndex += 1) {
  const reference = references[sourceIndex];
  const candidates = [];
  for (const [policy, source] of Object.entries(sourceData)) {
    const predictionRow = source.predictionsById.get(reference.example_id);
    const judgmentRow = source.judgmentsById.get(reference.example_id);
    if (!predictionRow || !judgmentRow) continue;
    const label = supportLabelRow({ policy, source, predictionRow, judgmentRow, reference, sourceIndex });
    supportLabels.push(label);
    candidates.push(label);
  }
  const supported = candidates.filter((row) => row.labels.supported_answer);
  const unsupported = candidates.filter((row) => row.labels.unsupported_answer);
  for (const chosen of supported) {
    for (const rejected of unsupported) {
      rawPairRows.push(contrastPair({ reference, sourceIndex, chosen, rejected }));
    }
  }
  exampleSummaries.push({
    example_id: reference.example_id,
    source_index: sourceIndex,
    reference_answer_type: reference.output?.answer_type,
    candidate_count: candidates.length,
    supported_answer_candidates: supported.length,
    unsupported_answer_candidates: unsupported.length,
    supported_vs_unsupported_pairs: supported.length * unsupported.length,
    policies_present: candidates.map((row) => row.policy),
  });
}

const pairRows = rawPairRows.filter((row) => !row.exact_duplicate_candidate);
const duplicatePairRows = rawPairRows.filter((row) => row.exact_duplicate_candidate);
const nliUnits = buildNliUnits(pairRows);
const missingExistingNli = await compareExistingNliCoverage(nliUnits);
const status = deriveStatus(pairRows, nliUnits, missingExistingNli);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "margin_compatible_heldout_packet",
  status,
  purpose: "Materialize a 321-389 heldout candidate-pair packet with the same pair and claim-NLI key surface required by the D280 hard-negative pairwise selector.",
  split,
  window: {
    start_index_inclusive: startIndex,
    end_index_exclusive: endIndex,
    examples: finalWindow.length,
    answerable: finalWindow.filter((row) => row.output?.answer_type === "grounded_answer").length,
    abstain: finalWindow.filter((row) => row.output?.answer_type === "abstain").length,
  },
  source_runs: Object.fromEntries(Object.entries(sourceRuns).map(([policy, source]) => [policy, {
    prediction_run_id: source.predictionRunId,
    judge_run_id: source.judgeRunId,
    prediction_count: sourceData[policy].prediction_count,
    judgment_count: sourceData[policy].judgment_count,
  }])),
  counts: {
    support_labels: supportLabels.length,
    examples_with_three_candidates: exampleSummaries.filter((row) => row.candidate_count === 3).length,
    examples_with_supported_and_unsupported_answers: exampleSummaries.filter((row) => row.supported_vs_unsupported_pairs > 0).length,
    raw_supported_vs_unsupported_pairs: rawPairRows.length,
    exact_duplicate_pairs: duplicatePairRows.length,
    heldout_pair_rows: pairRows.length,
    nli_units_required: nliUnits.length,
    existing_nli_units_missing: missingExistingNli.length,
  },
  compatibility: {
    pair_schema_matches_hard_negative_selector: true,
    nli_key_schema_matches_claim_nli_verifier: true,
    existing_claim_nli_cache_covers_all_units: missingExistingNli.length === 0,
    ready_for_d280_scoring_without_new_nli: missingExistingNli.length === 0 && pairRows.length > 0,
    ready_for_local_nli_scoring: nliUnits.length > 0,
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    training_use: "frozen_d280_heldout_only",
    note: "Rows are heldout-only inputs for evaluating a previously frozen hypothesis; they must not be used to fit D280 coefficients.",
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
    note: "This packet reuses existing paid judgments and makes no new calls.",
  },
  decision: {
    score_local_nli_next: nliUnits.length > 0 && missingExistingNli.length > 0,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    promote_d280_now: false,
    reason: pairRows.length
      ? "A heldout pair packet exists, but D280 scoring still needs local claim-NLI scores for the new candidate claims."
      : rawPairRows.length
        ? "All supported-vs-unsupported answer contrasts are exact duplicate candidate texts, so they cannot validate a feature-based margin selector."
        : "No supported-vs-unsupported answer contrasts were available in the heldout window.",
  },
};

await writeJsonl(path.join(outputDir, "support_labels.jsonl"), supportLabels);
await writeJsonl(path.join(outputDir, "example_summary.jsonl"), exampleSummaries);
await writeJsonl(path.join(outputDir, "raw_heldout_pairwise.jsonl"), rawPairRows);
await writeJsonl(path.join(outputDir, "exact_duplicate_pairwise.jsonl"), duplicatePairRows);
await writeJsonl(path.join(outputDir, "heldout_pairwise.jsonl"), pairRows);
await writeJsonl(path.join(outputDir, "claim-nli-input.jsonl"), nliUnits);
await writeJsonl(path.join(outputDir, "missing-existing-claim-nli-units.jsonl"), missingExistingNli);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  counts: result.counts,
  decision: result.decision,
}, null, 2));

function supportLabelRow({ policy, source, predictionRow, judgmentRow, reference, sourceIndex }) {
  const prediction = normalizeOutput(predictionRow.prediction);
  const judgment = normalizeJudgment(judgmentRow.judgment ?? predictionRow.inherited_judgment);
  const isAnswer = prediction.answer_type === "grounded_answer";
  const isSupportedAnswer = isAnswer
    && judgment.verdict === "supported"
    && judgment.all_claims_supported === true
    && judgment.citation_ids_valid === true;
  const isSupportedAbstention = prediction.answer_type === "abstain"
    && (judgment.abstention_supported === true || judgment.verdict === "correct_abstention");
  return {
    example_id: `${reference.example_id}::${policy}`,
    root_example_id: reference.example_id,
    policy,
    split,
    source_index: sourceIndex,
    source_prediction_run: source.predictionRunId,
    source_judge_run: source.judgeRunId,
    input: reference.input,
    reference: normalizeOutput(reference.output),
    prediction,
    labels: {
      supported_answer: isSupportedAnswer,
      unsupported_answer: isAnswer && !isSupportedAnswer,
      supported_abstention: isSupportedAbstention,
      answerable_reference: reference.output?.answer_type === "grounded_answer",
      citation_ids_valid: judgment.citation_ids_valid === true,
      all_claims_supported: judgment.all_claims_supported === true,
      abstention_supported: judgment.abstention_supported === true,
    },
    judge: judgment,
    scores: predictionRow.scores ?? {},
    training_use: "frozen_d280_heldout_only",
  };
}

function contrastPair({ reference, sourceIndex, chosen, rejected }) {
  const exactDuplicate = candidateSignature(chosen.prediction) === candidateSignature(rejected.prediction);
  return {
    pair_id: `${reference.example_id}:${chosen.policy}:over:${rejected.policy}`,
    example_id: reference.example_id,
    root_example_id: reference.example_id,
    split,
    source_index: sourceIndex,
    source: "margin_compatible_heldout_packet_321_389",
    contrast_type: "heldout_supported_vs_unsupported_scaffold",
    training_use: "frozen_d280_heldout_only",
    train_split: "heldout",
    input: reference.input,
    chosen: {
      id: chosen.example_id,
      family: sourceRuns[chosen.policy].family,
      policy: chosen.policy,
      ...normalizeOutput(chosen.prediction),
    },
    rejected: {
      id: rejected.example_id,
      family: sourceRuns[rejected.policy].family,
      policy: rejected.policy,
      ...normalizeOutput(rejected.prediction),
      unsupported_claims: rejected.judge?.unsupported_claims ?? [],
    },
    judge: {
      chosen: chosen.judge,
      rejected: rejected.judge,
    },
    exact_duplicate_candidate: exactDuplicate,
  };
}

function buildNliUnits(pairs) {
  const units = new Map();
  for (const pair of pairs) {
    for (const candidate of [pair.chosen, pair.rejected]) {
      for (const claim of claimTexts(candidate)) {
        const unitKey = nliKeyForCandidateClaim(pair, candidate, claim);
        if (units.has(unitKey)) continue;
        units.set(unitKey, {
          unit_key: unitKey,
          premise: truncate(citedText(pair.input, candidate), 3600),
          hypothesis: truncate(claim, 700),
          source: "heldout_candidate_pair_claim",
          example_id: pair.example_id,
          candidate_id: candidate.id,
        });
      }
    }
  }
  return [...units.values()];
}

async function compareExistingNliCoverage(units) {
  const existingPath = path.join(runsDir, "claim-nli-support-verifier-qwen-frontier-pool-2026-06-28-v1", "claim-nli-scores.jsonl");
  const existing = new Set((await readJsonl(existingPath)).map((row) => row.unit_key));
  return units.filter((row) => !existing.has(row.unit_key));
}

function deriveStatus(pairs, nliUnits, missingExistingNli) {
  if (!pairs.length) return "no_heldout_pair_signal";
  if (!nliUnits.length) return "heldout_pairs_missing_claim_units";
  if (missingExistingNli.length) return "heldout_pair_packet_ready_needs_local_nli";
  return "heldout_pair_packet_ready_for_d280_scoring";
}

function candidateSignature(candidate) {
  const normalized = normalizeOutput(candidate);
  return JSON.stringify({
    answer_type: normalized.answer_type,
    answer: normalized.answer.replace(/\s+/g, " ").trim(),
    citations: normalized.citations,
    claims: normalized.claim_table.map((row) => row.claim.replace(/\s+/g, " ").trim()),
  });
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
    const citations = Array.isArray(claim?.citations) ? claim.citations : [];
    return {
      claim: String(claim?.claim ?? "").trim(),
      support: claim?.support ?? null,
      citations: citations.map(String),
    };
  }).filter((claim) => claim.claim);
}

function normalizeJudgment(value) {
  return {
    verdict: value?.verdict ?? "unknown",
    all_claims_supported: value?.all_claims_supported === true,
    citation_ids_valid: value?.citation_ids_valid === true,
    abstention_supported: value?.abstention_supported === true,
    unsupported_claims: Array.isArray(value?.unsupported_claims) ? value.unsupported_claims.filter(Boolean).map(String) : [],
    missing_citations: Array.isArray(value?.missing_citations) ? value.missing_citations : [],
    notes: value?.notes ?? "",
  };
}

function nliKeyForCandidateClaim(pair, candidate, claim) {
  return `candidate::${pair.example_id ?? pair.root_example_id}::${candidate.id}::${hashString(claim)}`;
}

function citedText(input, candidate) {
  const evidenceById = new Map((input.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row]));
  const citedIds = (candidate.citations ?? []).map((id) => String(id).replace(/^\[/, "").replace(/\]$/, ""));
  return citedIds.map((id) => evidenceById.get(id)?.text ?? "").filter(Boolean).join(" ");
}

function claimTexts(candidate) {
  const claims = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? "").trim()).filter(Boolean);
  const answer = stripCitations(candidate.answer).trim();
  if (!claims.length && answer) return [answer];
  if (answer && answer.length <= 180 && !claims.some((claim) => normalizedText(claim) === normalizedText(answer))) {
    return [answer, ...claims];
  }
  return claims;
}

function stripCitations(value) {
  return String(value ?? "").replace(/\[[^\]]+\]/g, " ");
}

function normalizedText(value) {
  return stripCitations(value).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2).join(" ");
}

function truncate(value, maxLength) {
  const text = String(value ?? "");
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function hashString(value) {
  let hash = 0;
  for (const char of String(value)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash).toString(36);
}

function renderReport(result) {
  return `# Margin-Compatible Heldout Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

This packet makes no OpenAI calls and launches no compute. It converts existing 321-389 direct/risk/guard judgments into heldout-only pair rows with the same claim-NLI key surface used by the D280 hard-negative selector.

## Counts

- Window examples: ${result.window.examples}
- Support labels: ${result.counts.support_labels}
- Raw supported-vs-unsupported pairs: ${result.counts.raw_supported_vs_unsupported_pairs}
- Exact duplicate pairs removed: ${result.counts.exact_duplicate_pairs}
- Heldout pair rows: ${result.counts.heldout_pair_rows}
- Required claim-NLI units: ${result.counts.nli_units_required}
- Missing from existing claim-NLI cache: ${result.counts.existing_nli_units_missing}

## Decision

- Score local NLI next: ${result.decision.score_local_nli_next ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Promote D280 now: ${result.decision.promote_d280_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
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
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
