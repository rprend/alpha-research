import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "final-contrast-source-inventory-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const split = args.split ?? "extended_temporal_future_holdout";
const startIndex = Number(args.start ?? 320);
const endIndex = Number(args.end ?? 389);

await fs.mkdir(outputDir, { recursive: true });

const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const finalWindow = references.slice(startIndex, endIndex);
const finalIds = new Set(finalWindow.map((row) => row.example_id));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const runDirs = (await fs.readdir(runsDir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);

const predictionRuns = [];
for (const runDir of runDirs) {
  const filePath = path.join(runsDir, runDir, "predictions.jsonl");
  if (!await exists(filePath)) continue;
  const rows = (await readJsonl(filePath)).filter((row) => finalIds.has(row.example_id));
  if (rows.length !== finalWindow.length) continue;
  predictionRuns.push({
    run_id: runDir,
    rows,
  });
}

const judgmentsByPredictionRun = new Map();
for (const runDir of runDirs) {
  const filePath = path.join(runsDir, runDir, "judgments.jsonl");
  if (!await exists(filePath)) continue;
  const rows = (await readJsonl(filePath)).filter((row) => finalIds.has(row.example_id) && row.prediction_run);
  for (const row of rows) {
    if (!judgmentsByPredictionRun.has(row.prediction_run)) judgmentsByPredictionRun.set(row.prediction_run, []);
    judgmentsByPredictionRun.get(row.prediction_run).push({ ...row, judge_run_id: runDir });
  }
}

const supportLabels = [];
const sourceInventory = [];
for (const predictionRun of predictionRuns) {
  const judgments = judgmentsByPredictionRun.get(predictionRun.run_id) ?? [];
  const judgmentById = new Map(judgments.map((row) => [row.example_id, row]));
  let supportedAnswers = 0;
  let unsupportedAnswers = 0;
  let supportedAbstentions = 0;
  let judgedRows = 0;
  for (const row of predictionRun.rows) {
    const judgment = judgmentById.get(row.example_id);
    if (!judgment) continue;
    judgedRows += 1;
    const label = supportLabelRow(predictionRun.run_id, row, judgment);
    supportLabels.push(label);
    if (label.labels.supported_answer) supportedAnswers += 1;
    if (label.labels.unsupported_answer) unsupportedAnswers += 1;
    if (label.labels.supported_abstention) supportedAbstentions += 1;
  }
  sourceInventory.push({
    prediction_run_id: predictionRun.run_id,
    prediction_rows_321_389: predictionRun.rows.length,
    matched_judgment_rows_321_389: judgedRows,
    judge_run_ids: [...new Set(judgments.map((row) => row.judge_run_id))],
    supported_answers: supportedAnswers,
    unsupported_answers: unsupportedAnswers,
    supported_abstentions: supportedAbstentions,
    usable_for_answer_contrasts: judgedRows === finalWindow.length && (supportedAnswers > 0 || unsupportedAnswers > 0),
  });
}

const labelsByExample = groupBy(supportLabels, (row) => row.root_example_id);
const contrastRows = [];
const duplicateContrastRows = [];
const exampleSummaries = [];
for (const reference of finalWindow) {
  const rows = labelsByExample.get(reference.example_id) ?? [];
  const supported = dedupeCandidates(rows.filter((row) => row.labels.supported_answer));
  const unsupported = dedupeCandidates(rows.filter((row) => row.labels.unsupported_answer));
  let rawPairs = 0;
  let duplicatePairs = 0;
  let usablePairs = 0;
  for (const chosen of supported) {
    for (const rejected of unsupported) {
      rawPairs += 1;
      const pair = contrastPair(reference, chosen, rejected);
      if (pair.exact_duplicate_candidate) {
        duplicatePairs += 1;
        duplicateContrastRows.push(pair);
      } else {
        usablePairs += 1;
        contrastRows.push(pair);
      }
    }
  }
  exampleSummaries.push({
    example_id: reference.example_id,
    reference_answer_type: reference.output?.answer_type,
    judged_candidate_count: rows.length,
    unique_supported_answer_candidates: supported.length,
    unique_unsupported_answer_candidates: unsupported.length,
    raw_supported_vs_unsupported_pairs: rawPairs,
    exact_duplicate_pairs: duplicatePairs,
    usable_answer_contrast_pairs: usablePairs,
    source_runs_with_supported: [...new Set(supported.map((row) => row.prediction_run_id))],
    source_runs_with_unsupported: [...new Set(unsupported.map((row) => row.prediction_run_id))],
  });
}

const selectedSources = sourceInventory
  .filter((row) => row.usable_for_answer_contrasts)
  .sort((left, right) => (right.supported_answers + right.unsupported_answers) - (left.supported_answers + left.unsupported_answers));
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "final_contrast_source_inventory",
  purpose: "Mine existing judged 321-389 prediction families for genuinely non-duplicate supported-answer vs unsupported-answer contrasts before spending on more labels or GPU generation.",
  split,
  window: {
    start_index_inclusive: startIndex,
    end_index_exclusive: endIndex,
    examples: finalWindow.length,
  },
  summary: {
    prediction_runs_with_69_final_rows: predictionRuns.length,
    prediction_runs_with_full_judgments: sourceInventory.filter((row) => row.matched_judgment_rows_321_389 === finalWindow.length).length,
    support_labels: supportLabels.length,
    source_runs_usable_for_answer_contrasts: selectedSources.length,
    examples_with_usable_answer_contrasts: exampleSummaries.filter((row) => row.usable_answer_contrast_pairs > 0).length,
    usable_answer_contrast_pairs: contrastRows.length,
    exact_duplicate_answer_contrast_pairs: duplicateContrastRows.length,
  },
  best_sources: selectedSources.slice(0, 20),
  decision: {
    build_margin_compatible_candidate_packet_now: contrastRows.length >= 40,
    run_paid_adjudication_now: false,
    launch_gpu_now: false,
    reason: contrastRows.length >= 40
      ? "Existing judged final-window prediction families contain enough non-duplicate answer contrasts for a zero-call packet."
      : "Existing judged final-window prediction families do not contain enough non-duplicate answer contrasts for a reliable margin-compatible heldout.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    inventory_only: true,
    note: "This inventory mines final-window judgments only to decide whether a frozen heldout packet can be built; it does not fit selector weights.",
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
    note: "Inventory only; no new calls or compute.",
  },
};

await writeJsonl(path.join(outputDir, "source_inventory.jsonl"), sourceInventory);
await writeJsonl(path.join(outputDir, "support_labels.jsonl"), supportLabels);
await writeJsonl(path.join(outputDir, "example_summary.jsonl"), exampleSummaries);
await writeJsonl(path.join(outputDir, "usable_answer_contrasts.jsonl"), contrastRows);
await writeJsonl(path.join(outputDir, "exact_duplicate_answer_contrasts.jsonl"), duplicateContrastRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  summary: result.summary,
  decision: result.decision,
}, null, 2));

function supportLabelRow(predictionRunId, predictionRow, judgmentRow) {
  const prediction = normalizeOutput(predictionRow.prediction);
  const judgment = normalizeJudgment(judgmentRow.judgment);
  const isAnswer = prediction.answer_type === "grounded_answer";
  const isSupportedAnswer = isAnswer
    && judgment.verdict === "supported"
    && judgment.all_claims_supported === true
    && judgment.citation_ids_valid === true;
  const isSupportedAbstention = prediction.answer_type === "abstain"
    && (judgment.abstention_supported === true || judgment.verdict === "correct_abstention");
  return {
    example_id: `${predictionRow.example_id}::${predictionRunId}`,
    root_example_id: predictionRow.example_id,
    prediction_run_id: predictionRunId,
    judge_run_id: judgmentRow.judge_run_id,
    input: finalWindow.find((row) => row.example_id === predictionRow.example_id)?.input ?? null,
    prediction,
    labels: {
      supported_answer: isSupportedAnswer,
      unsupported_answer: isAnswer && !isSupportedAnswer,
      supported_abstention: isSupportedAbstention,
      citation_ids_valid: judgment.citation_ids_valid === true,
      all_claims_supported: judgment.all_claims_supported === true,
      abstention_supported: judgment.abstention_supported === true,
    },
    judge: judgment,
  };
}

function dedupeCandidates(rows) {
  const bySignature = new Map();
  for (const row of rows) {
    const signature = candidateSignature(row.prediction);
    if (!bySignature.has(signature)) bySignature.set(signature, row);
  }
  return [...bySignature.values()];
}

function contrastPair(reference, chosen, rejected) {
  return {
    pair_id: `${reference.example_id}:${chosen.prediction_run_id}:over:${rejected.prediction_run_id}`,
    example_id: reference.example_id,
    split,
    source_index: startIndex + finalWindow.findIndex((row) => row.example_id === reference.example_id),
    source: "final_contrast_source_inventory",
    contrast_type: "existing_judged_supported_vs_unsupported_answer",
    training_use: "frozen_heldout_inventory_only",
    input: reference.input,
    chosen: {
      id: chosen.example_id,
      family: familyForRun(chosen.prediction_run_id),
      prediction_run_id: chosen.prediction_run_id,
      ...chosen.prediction,
    },
    rejected: {
      id: rejected.example_id,
      family: familyForRun(rejected.prediction_run_id),
      prediction_run_id: rejected.prediction_run_id,
      ...rejected.prediction,
      unsupported_claims: rejected.judge.unsupported_claims,
    },
    exact_duplicate_candidate: candidateSignature(chosen.prediction) === candidateSignature(rejected.prediction),
  };
}

function familyForRun(runId) {
  if (runId.includes("qwen7b")) return "qwen7b";
  if (runId.includes("qwen3b")) return "qwen3b";
  if (runId.includes("qwen05b")) return "qwen05b";
  if (runId.includes("openai") || runId.includes("direct-mini") || runId.includes("risk-gate") || runId.includes("claim-entailment")) return "openai_scaffold";
  return "other";
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
      claim: String(claim?.claim ?? "").trim(),
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

function candidateSignature(candidate) {
  return JSON.stringify({
    answer_type: candidate.answer_type,
    answer: candidate.answer.replace(/\s+/g, " ").trim().toLowerCase(),
    citations: candidate.citations,
    claims: candidate.claim_table.map((row) => row.claim.replace(/\s+/g, " ").trim().toLowerCase()),
  });
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

function renderReport(result) {
  return `# Final Contrast Source Inventory

Generated: ${result.generated_at}

This is a zero-call inventory of existing judged 321-389 prediction families.

## Summary

- Prediction runs with 69 final rows: ${result.summary.prediction_runs_with_69_final_rows}
- Prediction runs with full judgments: ${result.summary.prediction_runs_with_full_judgments}
- Support labels: ${result.summary.support_labels}
- Source runs usable for answer contrasts: ${result.summary.source_runs_usable_for_answer_contrasts}
- Examples with usable answer contrasts: ${result.summary.examples_with_usable_answer_contrasts}
- Usable non-duplicate answer contrast pairs: ${result.summary.usable_answer_contrast_pairs}
- Exact duplicate answer contrast pairs: ${result.summary.exact_duplicate_answer_contrast_pairs}

## Decision

- Build margin-compatible candidate packet now: ${result.decision.build_margin_compatible_candidate_packet_now ? "yes" : "no"}
- Run paid adjudication now: ${result.decision.run_paid_adjudication_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
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
