import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet"] ?? "qwen-frontier-pool-support-packet-2026-06-28-v1";
const targetAuditRunId = args["target-audit"] ?? "both-fail-target-audit-qwen-frontier-pool-2026-06-28-v1";
const runId = args["run-id"] ?? "minimal-span-overexpansion-packet-qwen-frontier-pool-2026-06-28-v1";
const trainMaxSourceIndex = Number(args["train-max-source-index"] ?? 300);
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceResult = await readJson(path.join(runsDir, sourcePacketRunId, "result.json"));
const targetAudit = await readJson(path.join(runsDir, targetAuditRunId, "result.json"));
const labels = await readJsonl(path.join(runsDir, sourcePacketRunId, "support_labels.jsonl"));
const byRoot = groupBy(labels, (row) => row.root_example_id);

const rootAudits = [...byRoot.entries()].map(([rootExampleId, rows]) => auditRoot(rootExampleId, rows)).filter((row) => row.pairs.length > 0);
const pairs = rootAudits.flatMap((row) => row.pairs);
const generatedPairs = pairs.filter((row) => row.contrast_type === "generated_minimal_supported_vs_generated_overexpanded_unsupported");
const referenceFallbackPairs = pairs.filter((row) => row.contrast_type === "reference_minimal_supported_vs_generated_overexpanded_unsupported");
const trainPairs = pairs.filter((row) => row.source_index < trainMaxSourceIndex);
const validationPairs = pairs.filter((row) => row.source_index >= trainMaxSourceIndex);
const generatedTrainPairs = generatedPairs.filter((row) => row.source_index < trainMaxSourceIndex);
const generatedValidationPairs = generatedPairs.filter((row) => row.source_index >= trainMaxSourceIndex);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "minimal_span_overexpansion_packet",
  source_packet_run_id: sourcePacketRunId,
  target_audit_run_id: targetAuditRunId,
  purpose: "Mine leakage-safe non-final Qwen judged pools for minimal supported span vs overexpanded unsupported answer contrasts identified by D263.",
  counts: {
    source_labels: labels.length,
    source_roots: byRoot.size,
    roots_with_pairs: rootAudits.length,
    all_pairs: pairs.length,
    generated_candidate_pairs: generatedPairs.length,
    reference_fallback_pairs: referenceFallbackPairs.length,
    train_pairs: trainPairs.length,
    validation_pairs: validationPairs.length,
    generated_train_pairs: generatedTrainPairs.length,
    generated_validation_pairs: generatedValidationPairs.length,
    same_citation_pairs: pairs.filter((row) => row.tags.includes("same_citation_surface")).length,
    numeric_or_list_scope_pairs: pairs.filter((row) => row.tags.includes("numeric_or_list_scope_overclaim")).length,
    longer_unsupported_pairs: pairs.filter((row) => row.tags.includes("longer_unsupported_expansion")).length,
    unsupported_judge_claim_pairs: pairs.filter((row) => row.tags.includes("unsupported_judge_claim_available")).length,
  },
  target_alignment: {
    audited_final_failure_status: targetAudit.status,
    audited_final_mechanism_counts: targetAudit.summary?.mechanism_counts ?? {},
    mined_pair_tag_counts: countTags(pairs.flatMap((row) => row.tags)),
    note: "Final diagnostic labels are not used for training; they only define the target mechanism audited in D263.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    source_packet_final_window_labels_used_for_training: sourceResult.leakage_guard?.final_window_labels_used_for_training ?? false,
    training_use: "allowed_nonfinal_frontier_supervision",
    train_max_source_index: trainMaxSourceIndex,
    train_source_index_range: numericRange(trainPairs.map((row) => row.source_index)),
    validation_source_index_range: numericRange(validationPairs.map((row) => row.source_index)),
  },
  decision: decisionFromCounts(generatedTrainPairs, generatedValidationPairs, pairs),
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This packet builder reads existing non-final judged artifacts only.",
  },
  artifacts: {
    root_audits_jsonl: rel(path.join(outputDir, "root_audits.jsonl")),
    contrast_pairs_jsonl: rel(path.join(outputDir, "contrast_pairs.jsonl")),
    generated_contrast_pairs_jsonl: rel(path.join(outputDir, "generated_contrast_pairs.jsonl")),
    train_contrast_pairs_jsonl: rel(path.join(outputDir, "train_contrast_pairs.jsonl")),
    validation_contrast_pairs_jsonl: rel(path.join(outputDir, "validation_contrast_pairs.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "root_audits.jsonl"), rootAudits.map(({ pairs: _pairs, ...row }) => row));
await writeJsonl(path.join(outputDir, "contrast_pairs.jsonl"), pairs);
await writeJsonl(path.join(outputDir, "generated_contrast_pairs.jsonl"), generatedPairs);
await writeJsonl(path.join(outputDir, "train_contrast_pairs.jsonl"), trainPairs);
await writeJsonl(path.join(outputDir, "validation_contrast_pairs.jsonl"), validationPairs);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  counts: result.counts,
  decision: result.decision,
}, null, 2));

function auditRoot(rootExampleId, rows) {
  const first = rows[0];
  const positives = rows.filter((row) => row.labels.supported_answer && isMinimalSupported(row));
  const negatives = rows.filter((row) => row.labels.unsupported_answer && isOverexpandedUnsupported(row));
  const referencePositive = first.reference?.answer_type === "grounded_answer" ? referenceRow(first) : null;
  const pairs = [];
  for (const chosen of positives) {
    for (const rejected of negatives) {
      const pair = contrastPair(first, chosen, rejected, "generated_minimal_supported_vs_generated_overexpanded_unsupported");
      if (pair.tags.length) pairs.push(pair);
    }
  }
  if (referencePositive && !positives.length) {
    for (const rejected of negatives) {
      const pair = contrastPair(first, referencePositive, rejected, "reference_minimal_supported_vs_generated_overexpanded_unsupported");
      if (pair.tags.length) pairs.push(pair);
    }
  }
  return {
    root_example_id: rootExampleId,
    split: first.split,
    source_index: first.source_index,
    supported_minimal_candidates: positives.length,
    overexpanded_unsupported_candidates: negatives.length,
    reference_fallback_used: Boolean(referencePositive && !positives.length && negatives.length),
    pair_count: pairs.length,
    mechanism_counts: countTags(pairs.flatMap((row) => row.tags)),
    pairs,
  };
}

function contrastPair(first, chosenRow, rejectedRow, contrastType) {
  const chosen = normalizeCandidate(chosenRow, contrastType.startsWith("reference") ? "qasper_reference" : "qwen7b_nonfinal_frontier_pool");
  const rejected = normalizeCandidate(rejectedRow, "qwen7b_nonfinal_frontier_pool");
  const tags = pairTags(chosen, rejected);
  return {
    pair_id: `${contrastType}:${first.root_example_id}:${chosen.sample_index ?? "reference"}:${rejected.sample_index}`,
    root_example_id: first.root_example_id,
    split: first.split,
    source_index: first.source_index,
    source: "minimal_span_overexpansion_packet",
    contrast_type: contrastType,
    training_use: "allowed_nonfinal_frontier_supervision",
    train_split: first.source_index < trainMaxSourceIndex ? "train" : "validation",
    input: first.input,
    chosen,
    rejected,
    tags,
    feature_delta: {
      answer_token_delta: chosen.features.answer_tokens - rejected.features.answer_tokens,
      claim_token_delta: chosen.features.claim_tokens - rejected.features.claim_tokens,
      unsupported_claim_delta: chosen.features.unsupported_claim_count - rejected.features.unsupported_claim_count,
      citation_count_delta: chosen.features.citation_count - rejected.features.citation_count,
      numeric_token_delta: chosen.features.numeric_token_count - rejected.features.numeric_token_count,
      entityish_token_delta: chosen.features.entityish_token_count - rejected.features.entityish_token_count,
    },
  };
}

function normalizeCandidate(row, family) {
  const prediction = row.prediction ?? row.reference;
  const answer = String(prediction?.answer ?? "");
  const claimTable = Array.isArray(prediction?.claim_table) ? prediction.claim_table : [];
  const unsupportedClaims = Array.isArray(row.judge?.unsupported_claims) ? row.judge.unsupported_claims.map(String).filter(Boolean) : [];
  const citations = Array.isArray(prediction?.citations) ? prediction.citations.map(String) : [];
  return {
    id: row.example_id,
    family,
    sample_index: row.sample_index ?? null,
    answer_type: prediction?.answer_type === "abstain" ? "abstain" : "grounded_answer",
    answer,
    citations,
    claim_table: claimTable,
    unsupported_claims: unsupportedClaims,
    features: candidateFeatures(answer, claimTable, citations, unsupportedClaims),
  };
}

function referenceRow(first) {
  return {
    example_id: `${first.root_example_id}::reference`,
    root_example_id: first.root_example_id,
    sample_index: null,
    split: first.split,
    source_index: first.source_index,
    input: first.input,
    prediction: first.reference,
    reference: first.reference,
    labels: { supported_answer: true },
    judge: { unsupported_claims: [] },
    training_use: "allowed_nonfinal_frontier_supervision",
  };
}

function isMinimalSupported(row) {
  const prediction = row.prediction;
  if (prediction?.answer_type !== "grounded_answer") return false;
  const answerTokens = contentTokens(prediction.answer);
  const claims = Array.isArray(prediction.claim_table) ? prediction.claim_table : [];
  const claimTokens = claims.flatMap((claim) => contentTokens(claim.claim ?? ""));
  const shortAnswer = answerTokens.length <= 10;
  const claimNotMuchLonger = claimTokens.length <= Math.max(12, answerTokens.length + 8);
  return shortAnswer || claimNotMuchLonger;
}

function isOverexpandedUnsupported(row) {
  const prediction = row.prediction;
  if (prediction?.answer_type !== "grounded_answer") return false;
  const unsupportedClaims = Array.isArray(row.judge?.unsupported_claims) ? row.judge.unsupported_claims.filter(Boolean) : [];
  if (!unsupportedClaims.length) return false;
  const answer = String(prediction.answer ?? "");
  const claimText = (prediction.claim_table ?? []).map((claim) => claim.claim ?? "").join(" ");
  const unsupportedText = unsupportedClaims.join(" ");
  return hasNumberOrListScope(answer, claimText, unsupportedText)
    || contentTokens(answer).length >= 12
    || contentTokens(claimText).length > contentTokens(answer).length + 8;
}

function pairTags(chosen, rejected) {
  const tags = new Set();
  if (rejected.features.unsupported_claim_count > 0) tags.add("unsupported_judge_claim_available");
  if (rejected.features.numeric_token_count > chosen.features.numeric_token_count || hasListScopeText(rejected.answer) || hasListScopeText(rejected.unsupported_claims.join(" "))) tags.add("numeric_or_list_scope_overclaim");
  if (sameCitationSet(chosen.citations, rejected.citations)) tags.add("same_citation_surface");
  if (rejected.features.answer_tokens > chosen.features.answer_tokens + 4) tags.add("longer_unsupported_expansion");
  if (rejected.features.entityish_token_count > chosen.features.entityish_token_count + 1) tags.add("entity_scope_expansion");
  if (chosen.features.answer_tokens <= 8) tags.add("minimal_supported_span");
  return [...tags].sort();
}

function candidateFeatures(answer, claimTable, citations, unsupportedClaims) {
  const claimText = claimTable.map((claim) => String(claim.claim ?? "")).join(" ");
  return {
    answer_tokens: contentTokens(answer).length,
    claim_tokens: contentTokens(claimText).length,
    citation_count: citations.length,
    claim_count: claimTable.length,
    unsupported_claim_count: unsupportedClaims.length,
    numeric_token_count: numberTokens(`${answer} ${claimText}`).length,
    entityish_token_count: entityishTokens(`${answer} ${claimText}`).length,
    list_scope_term_count: listScopeTerms(`${answer} ${claimText} ${unsupportedClaims.join(" ")}`).length,
  };
}

function hasNumberOrListScope(...values) {
  return values.some((value) => numberTokens(value).length || hasListScopeText(value));
}

function hasListScopeText(value) {
  const text = String(value ?? "").toLowerCase();
  return /\b(dataset|datasets|tasks|settings|modes|classes|annotators|models|corpora|benchmarks)\b/.test(text)
    || listScopeTerms(text).length > 0
    || text.includes(",");
}

function listScopeTerms(value) {
  const text = String(value ?? "").toLowerCase();
  return ["dataset", "datasets", "tasks", "settings", "modes", "classes", "annotators", "models", "corpora", "benchmarks"].filter((term) => new RegExp(`\\b${term}\\b`).test(text));
}

function sameCitationSet(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && [...leftSet].every((item) => rightSet.has(item));
}

function decisionFromCounts(generatedTrainPairs, generatedValidationPairs, allPairs) {
  if (generatedTrainPairs.length >= 12 && generatedValidationPairs.length >= 4) {
    return {
      train_selector_now: true,
      launch_gpu_now: false,
      buy_more_openai_labels_now: false,
      reason: "The packet contains enough generated-vs-generated non-final overexpansion contrasts to test a selector before more paid labels.",
      next_step: "Train a zero-cost overexpansion-aware selector and require final diagnostic gains over D262 before any paid batch.",
    };
  }
  if (allPairs.length >= 12) {
    return {
      train_selector_now: true,
      launch_gpu_now: false,
      buy_more_openai_labels_now: false,
      reason: "Generated-only validation is thin, but the packet has enough total non-final span-vs-overexpansion contrasts for a diagnostic selector.",
      next_step: "Use generated pairs preferentially and reference fallback as auxiliary supervision; treat final results as diagnostic only.",
    };
  }
  return {
    train_selector_now: false,
    launch_gpu_now: false,
    buy_more_openai_labels_now: false,
    reason: "The existing judged pool does not contain enough span-vs-overexpansion contrasts; audit coverage before buying targeted labels.",
    next_step: "Inspect roots without pairs and decide whether a small paid targeted batch is justified.",
  };
}

function renderReport(result) {
  const tagRows = Object.entries(result.target_alignment.mined_pair_tag_counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => `| \`${tag}\` | ${count} |`)
    .join("\n");
  return `# Minimal Span Overexpansion Packet

Generated: ${result.generated_at}

This packet makes no OpenAI calls and launches no compute. It uses non-final judged Qwen pool artifacts only.

| Item | Count |
| --- | ---: |
| Roots with pairs | ${result.counts.roots_with_pairs} |
| All pairs | ${result.counts.all_pairs} |
| Generated candidate pairs | ${result.counts.generated_candidate_pairs} |
| Reference fallback pairs | ${result.counts.reference_fallback_pairs} |
| Train pairs | ${result.counts.train_pairs} |
| Validation pairs | ${result.counts.validation_pairs} |
| Same-citation pairs | ${result.counts.same_citation_pairs} |
| Numeric/list scope pairs | ${result.counts.numeric_or_list_scope_pairs} |

## Pair Tags

| Tag | Count |
| --- | ---: |
${tagRows}

## Decision

- Train selector now: ${result.decision.train_selector_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function contentTokens(value) {
  return String(value ?? "").replace(/\[[^\]]+\]/g, " ").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
}

function numberTokens(value) {
  return String(value ?? "").match(/[-+]?\d+(?:[.,]\d+)*(?:%| percent)?/gi) ?? [];
}

function entityishTokens(value) {
  return String(value ?? "").match(/\b[A-Z][A-Za-z0-9.-]*(?:-[A-Za-z0-9.]+)?\b/g) ?? [];
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

function countTags(tags) {
  const counts = {};
  for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return counts;
}

function numericRange(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? [Math.min(...finite), Math.max(...finite)] : [null, null];
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
