import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "frontier-replay-audit-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const frontierPairFile = path.join(runsDir, "qwen-contrast-verifier-frontier-pool-2026-06-28-v1", "frontier_pool_contrast_pairs.jsonl");
const hardBaselineFile = path.join(runsDir, "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1", "baseline_nonfinal_validation_predictions.jsonl");
const boundaryResultFile = path.join(runsDir, "filtered-boundary-selector-gpt4o-qwen-frontier-pool-2026-06-28-v1", "result.json");
const budgetFile = path.join(experimentDir, "spend", "budget.json");

const featureNames = [
  "answer_tokens",
  "claim_tokens",
  "citation_count",
  "inline_complete",
  "answer_cited_coverage",
  "claim_cited_coverage",
  "unsupported_number_count",
  "unsupported_list_scope_count",
  "extra_entity_count",
  "short_answer_bonus",
  "claim_answer_gap",
];
const listTerms = ["both", "all", "including", "include", "includes", "and", "or", "respectively", "average", "total", "multiple", "several", "various"];
const stopwords = new Set(["the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "has", "have", "had", "but", "not", "can", "may", "its", "into", "than", "then", "also", "been", "their", "there", "which", "while", "using", "used", "use", "true", "false", "answer", "claim", "evidence", "support", "supported"]);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(budgetFile);
const boundaryResult = await readJson(boundaryResultFile);
const frontierPairs = (await readJsonl(frontierPairFile)).filter((row) => row.train_split === "validation");
const hardBaselineRows = await readJsonl(hardBaselineFile);
const hardBaselineByPair = new Map(hardBaselineRows.map((row) => [row.pair_id, row]));
const boundaryModel = modelFromBoundaryResult(boundaryResult);
const alpha = Number(boundaryResult.metrics?.selected_hybrid?.alpha_boundary_weight ?? boundaryResult.tuning?.selected_policy?.alpha_boundary_weight ?? 0.3);

const replayRows = frontierPairs.map((pair) => replayPair(pair, hardBaselineByPair.get(pair.pair_id), boundaryModel, alpha));
const selectorRows = replayRows.flatMap((row) => row.selector_results);
const selectorSummary = summarizeSelectorRows(selectorRows);
const disagreementRows = replayRows.filter((row) => row.selector_results.some((result) => result.selector === "d272_frontier_replay_boundary_only" && result.correct !== row.selector_results.find((item) => item.selector === "d262_proxy_hard_negative_baseline")?.correct));
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "frontier_replay_audit",
  purpose: "Replay D272 boundary scoring and a D272-style hybrid on the same non-final frontier-pool validation rows covered by the hard-negative D262 proxy.",
  source_runs: {
    frontier_pairs: "qwen-contrast-verifier-frontier-pool-2026-06-28-v1",
    d262_proxy_predictions: "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1",
    boundary_selector: "filtered-boundary-selector-gpt4o-qwen-frontier-pool-2026-06-28-v1",
  },
  summary: {
    frontier_validation_pairs: frontierPairs.length,
    alpha_boundary_weight: alpha,
    selector_count: Object.keys(selectorSummary).length,
    boundary_vs_d262_disagreements: disagreementRows.length,
  },
  selector_summary: selectorSummary,
  diagnosis: diagnose(selectorSummary),
  decision: {
    promote_selected_hybrid_now: false,
    integrate_boundary_only_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Use the hard-negative/frontier replay signal to design a comparable-coverage hybrid only if it preserves existing validation and beats D262 on frontier validation without relying on final rows.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_evaluation: false,
    frontier_validation_training_use: "allowed_nonfinal_frontier_supervision",
    audit_is_zero_call: true,
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
    note: "This audit replays local features over existing judged frontier validation pairs only.",
  },
  artifacts: {
    pair_replay_jsonl: rel(path.join(outputDir, "pair_replay.jsonl")),
    selector_rows_jsonl: rel(path.join(outputDir, "selector_rows.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "pair_replay.jsonl"), replayRows);
await writeJsonl(path.join(outputDir, "selector_rows.jsonl"), selectorRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  summary: result.summary,
  selector_summary: result.selector_summary,
  diagnosis: result.diagnosis,
  decision: result.decision,
}, null, 2));

function replayPair(pair, d262Proxy, boundaryModel, alpha) {
  if (!d262Proxy) throw new Error(`Missing D262 proxy prediction for ${pair.pair_id}`);
  const chosenFeatures = candidateFeatures(pair.input, pair.chosen);
  const rejectedFeatures = candidateFeatures(pair.input, pair.rejected);
  const boundaryMargin = scoreCandidate(chosenFeatures, boundaryModel) - scoreCandidate(rejectedFeatures, boundaryModel);
  const d262Margin = Number(d262Proxy.margin ?? 0);
  const hybridMargin = d262Margin + alpha * boundaryMargin;
  const selectorResults = [
    selectorResult(pair, "d262_proxy_hard_negative_baseline", d262Margin),
    selectorResult(pair, "d272_frontier_replay_boundary_only", boundaryMargin),
    selectorResult(pair, "d272_frontier_replay_selected_hybrid", hybridMargin),
  ];
  return {
    pair_id: pair.pair_id,
    example_id: pair.root_example_id,
    source_index: pair.source_index,
    contrast_type: pair.contrast_type,
    chosen_id: pair.chosen.id,
    rejected_id: pair.rejected.id,
    d262_proxy_margin: round(d262Margin),
    boundary_margin: round(boundaryMargin),
    hybrid_margin: round(hybridMargin),
    chosen_boundary_features: chosenFeatures,
    rejected_boundary_features: rejectedFeatures,
    selector_results: selectorResults,
  };
}

function selectorResult(pair, selector, margin) {
  return {
    pair_id: pair.pair_id,
    example_id: pair.root_example_id,
    source_index: pair.source_index,
    contrast_type: pair.contrast_type,
    selector,
    predicted_preferred: margin >= 0 ? "chosen" : "rejected",
    correct: margin >= 0,
    margin: round(margin),
    chosen_id: pair.chosen.id,
    rejected_id: pair.rejected.id,
    training_use: pair.training_use,
  };
}

function modelFromBoundaryResult(result) {
  const weights = result.learned_selector?.weights ?? {};
  const scalerRows = result.learned_selector?.scaler ?? [];
  const scaler = new Map(scalerRows.map((row) => [row.name, row]));
  return {
    weights,
    scaler,
  };
}

function scoreCandidate(features, model) {
  let score = 0;
  for (const name of featureNames) {
    const scale = model.scaler.get(name) ?? { mean: 0, std: 1 };
    score += Number(model.weights[name] ?? 0) * ((Number(features[name] ?? 0) - Number(scale.mean ?? 0)) / Number(scale.std || 1));
  }
  return score;
}

function candidateFeatures(input, candidate) {
  if (candidate.answer_type === "abstain") return Object.fromEntries(featureNames.map((name) => [name, name === "short_answer_bonus" ? 0 : -3]));
  const answer = String(candidate.answer ?? "");
  const claimText = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? "")).join(" ");
  const citedText = citedEvidenceText(input, candidate);
  const answerTokens = contentTokens(answer);
  const claimTokens = contentTokens(claimText);
  const citedTokens = contentTokens(citedText);
  return {
    answer_tokens: Math.log1p(answerTokens.length),
    claim_tokens: Math.log1p(claimTokens.length),
    citation_count: Math.log1p((candidate.citations ?? []).length),
    inline_complete: inlineComplete(candidate) ? 1 : 0,
    answer_cited_coverage: tokenCoverage(answerTokens, citedTokens),
    claim_cited_coverage: tokenCoverage(claimTokens, citedTokens),
    unsupported_number_count: Math.log1p(unsupportedNumbers(`${answer} ${claimText}`, citedText).length),
    unsupported_list_scope_count: Math.log1p(unsupportedTerms(`${answer} ${claimText}`, citedText, listTerms).length),
    extra_entity_count: Math.log1p(extraEntityTokens(`${answer} ${claimText}`, citedText).length),
    short_answer_bonus: answerTokens.length <= 8 ? 1 : 0,
    claim_answer_gap: Math.max(0, Math.log1p(claimTokens.length) - Math.log1p(answerTokens.length || 1)),
  };
}

function summarizeSelectorRows(rows) {
  return Object.fromEntries([...groupBy(rows, (row) => row.selector).entries()].map(([selector, selectorRows]) => {
    const correct = selectorRows.filter((row) => row.correct).length;
    return [selector, {
      pairs: selectorRows.length,
      correct,
      accuracy: round(correct / Math.max(1, selectorRows.length)),
      mean_margin: round(mean(selectorRows.map((row) => Number(row.margin)))),
      mean_abs_margin: round(mean(selectorRows.map((row) => Math.abs(Number(row.margin))))),
    }];
  }));
}

function diagnose(selectorSummary) {
  const d262 = selectorSummary.d262_proxy_hard_negative_baseline;
  const boundary = selectorSummary.d272_frontier_replay_boundary_only;
  const hybrid = selectorSummary.d272_frontier_replay_selected_hybrid;
  const hybridDelta = Number(hybrid?.correct ?? 0) - Number(d262?.correct ?? 0);
  return {
    primary_finding: hybridDelta > 0 ? "frontier_replay_hybrid_beats_d262_proxy" : "frontier_replay_does_not_justify_hybrid_promotion",
    d262_proxy_correct: d262?.correct ?? null,
    boundary_only_correct: boundary?.correct ?? null,
    selected_hybrid_correct: hybrid?.correct ?? null,
    selected_hybrid_delta_vs_d262_proxy: hybridDelta,
    interpretation: hybridDelta > 0
      ? "The boundary hybrid improves over the hard-negative D262 proxy on same-row frontier validation, but must still be checked against existing validation before promotion."
      : "Same-row frontier replay does not justify promoting the D272 selected hybrid over the stronger hard-negative D262 proxy.",
  };
}

function renderReport(result) {
  return `# Frontier Replay Audit

Generated: ${result.generated_at}

This is a zero-call frontier replay audit. It recomputes D272 boundary features on non-final frontier-pool validation pairs and uses no final-window labels for training, tuning, or evaluation.

## Summary

- Frontier validation pairs: ${result.summary.frontier_validation_pairs}
- Alpha boundary weight: ${result.summary.alpha_boundary_weight}
- Boundary vs D262 disagreements: ${result.summary.boundary_vs_d262_disagreements}

## Selector Accuracy

${Object.entries(result.selector_summary).map(([selector, value]) => `- ${selector}: ${value.correct}/${value.pairs} correct, accuracy ${value.accuracy}, mean margin ${value.mean_margin}`).join("\n")}

## Diagnosis

- Primary finding: ${result.diagnosis.primary_finding}
- Interpretation: ${result.diagnosis.interpretation}

## Decision

- Promote selected hybrid now: ${result.decision.promote_selected_hybrid_now ? "yes" : "no"}
- Integrate boundary-only now: ${result.decision.integrate_boundary_only_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
`;
}

function citedEvidenceText(input, candidate) {
  const ids = new Set(candidate.citations ?? []);
  return (input.compact_retrieved_evidence_pack ?? []).filter((item) => ids.has(item.evidence_id)).map((item) => item.text).join(" ");
}

function inlineComplete(candidate) {
  const answer = String(candidate.answer ?? "");
  return (candidate.citations ?? []).every((id) => answer.includes(`[${id}]`));
}

function tokenCoverage(tokens, evidenceTokens) {
  if (!tokens.length) return 1;
  const evidence = new Set(evidenceTokens);
  return tokens.filter((token) => evidence.has(token)).length / tokens.length;
}

function unsupportedNumbers(answer, evidence) {
  const evidenceNumbers = new Set(String(evidence ?? "").match(/\d+(?:[.,]\d+)*(?:%|k)?/gi) ?? []);
  return [...new Set(String(answer ?? "").match(/\d+(?:[.,]\d+)*(?:%|k)?/gi) ?? [])].filter((number) => !evidenceNumbers.has(number));
}

function unsupportedTerms(answer, evidence, terms) {
  const answerLower = String(answer ?? "").toLowerCase();
  const evidenceLower = String(evidence ?? "").toLowerCase();
  return terms.filter((term) => answerLower.includes(term) && !evidenceLower.includes(term));
}

function extraEntityTokens(answer, evidence) {
  const answerEntities = new Set(String(answer ?? "").match(/\b[A-Z][A-Za-z0-9-]{2,}\b/g) ?? []);
  const evidenceText = String(evidence ?? "");
  return [...answerEntities].filter((entity) => !evidenceText.includes(entity));
}

function contentTokens(value) {
  return String(value ?? "").toLowerCase().match(/[a-z][a-z0-9-]{2,}|\d+(?:[.,]\d+)*(?:k|%)?/g)?.filter((token) => !stopwords.has(token)) ?? [];
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

function groupBy(rows, fn) {
  const grouped = new Map();
  for (const row of rows) {
    const key = fn(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value), 0) / values.length;
}

function rel(file) {
  return path.relative(rootDir, file);
}

function round(value, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}
