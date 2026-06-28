import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "generation-gap-curriculum-packet-d320-final-gaps-2026-06-28-v1";
const candidateAuditRunId = args["candidate-audit-run-id"] ?? "generation-gap-candidate-span-selector-audit-d334-2026-06-28-v1";
const verifierTransferRunId = args["verifier-transfer-run-id"] ?? "generation-gap-verifier-transfer-audit-d335-2026-06-28-v1";
const runId = args["run-id"] ?? "generation-gap-target-relevance-audit-d336-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const STOPWORDS = new Set([
  "the", "and", "for", "that", "with", "this", "are", "was", "were", "from", "have", "has", "had", "they", "their",
  "which", "what", "when", "where", "who", "how", "does", "did", "can", "into", "than", "then", "there", "these",
  "those", "under", "specific", "current", "approaches", "defining", "used", "experiments", "paper", "question",
]);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const packetDir = path.join(runsDir, packetRunId, "dataset");
const prompts = await readJsonl(path.join(packetDir, "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(packetDir, "eval_targets_diagnostic.jsonl"));
const targetById = new Map(targets.map((row) => [row.example_id, row.target]));
const candidateRows = await readJsonl(path.join(runsDir, candidateAuditRunId, "candidate_spans.jsonl"));
const verifierRows = await readOptionalJsonl(path.join(runsDir, verifierTransferRunId, "scored_candidates.jsonl"));
const verifierById = new Map(verifierRows.map((row) => [row.candidate_id, row]));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const enrichedCandidates = candidateRows.map((candidate) => enrichCandidate(candidate, prompts.find((row) => row.example_id === candidate.example_id), targetById.get(candidate.example_id), verifierById.get(candidate.candidate_id)));
const heuristicPredictions = prompts.map((prompt) => selectHeuristicPrediction(prompt, enrichedCandidates.filter((row) => row.example_id === prompt.example_id)));
const oraclePredictions = prompts.map((prompt) => selectDiagnosticOraclePrediction(prompt, enrichedCandidates.filter((row) => row.example_id === prompt.example_id), targetById.get(prompt.example_id)));
const heuristicSummary = summarizePredictions(heuristicPredictions);
const oracleSummary = summarizePredictions(oraclePredictions);
const oracleCeiling = summarizeOracle(enrichedCandidates, targetById);
const shapeEvalResults = await readShapeEvalResults(runId);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "generation_gap_target_relevance_audit",
  status: "target_relevance_audit_ready_for_shape_eval",
  purpose: "Separate deployable answer-target relevance selection from a diagnostic oracle ceiling over the D334 candidate span pool.",
  packet_run_id: packetRunId,
  candidate_audit_run_id: candidateAuditRunId,
  verifier_transfer_run_id: verifierTransferRunId,
  summary: {
    examples: prompts.length,
    candidate_spans: enrichedCandidates.length,
    heuristic: heuristicSummary,
    diagnostic_oracle: oracleSummary,
    oracle_ceiling: oracleCeiling,
    shape_eval_results: shapeEvalResults,
  },
  policies: {
    deployable_heuristic: {
      name: "question_focus_plus_support_score_gate",
      uses_final_targets: false,
      description: "Ranks candidates by question-focus overlap, direct anchors, risk penalties, and inherited verifier score; abstains when focus score is below threshold.",
    },
    diagnostic_oracle: {
      name: "target_answer_f1_citation_oracle",
      uses_final_targets: true,
      training_use: "forbidden_diagnostic_only",
      description: "Ranks candidates by token F1 with diagnostic target answer and citation overlap to estimate whether the candidate pool contains target-relevant spans.",
    },
  },
  decision: {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    next_step: shapeEvalResults
      ? "Build answer-construction and question-target relevance supervision before spending on another Prime generator run."
      : "Run D322 shape harnesses for heuristic_predictions.jsonl and diagnostic_oracle_predictions.jsonl, then use the gap to decide whether labels should target selection or candidate generation.",
    reason: shapeEvalResults
      ? "The deployable heuristic fails the generation-gap shape gate, while the diagnostic oracle ceiling shows the span pool still cannot construct yes/no and multi-span answers."
      : "D335 showed support-only scoring selects off-target spans. This audit explicitly measures target relevance without spending on new labels.",
  },
  leakage_guard: {
    deployable_heuristic_uses_final_targets: false,
    diagnostic_oracle_uses_final_targets: true,
    diagnostic_oracle_training_use: "forbidden_diagnostic_only",
    final_targets_used_for_threshold_selection: false,
    final_targets_used_for_model_training: false,
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
    note: "Local deterministic relevance audit only.",
  },
};

await writeJsonl(path.join(outputDir, "target_relevance_candidates.jsonl"), enrichedCandidates);
await writeJsonl(path.join(outputDir, "heuristic_predictions.jsonl"), heuristicPredictions);
await writeJsonl(path.join(outputDir, "diagnostic_oracle_predictions.jsonl"), oraclePredictions);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  summary: result.summary,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function enrichCandidate(candidate, prompt, target, verifierRow) {
  const question = prompt.input.question;
  const qTokens = contentTokens(question);
  const cTokens = contentTokens(candidate.text);
  const targetTokens = contentTokens(target?.answer ?? "");
  const targetCitations = new Set(target?.citations ?? []);
  const candidateCitations = new Set([candidate.evidence_id]);
  const relevance = {
    question_candidate_overlap: tokenCoverage(qTokens, cTokens),
    question_section_overlap: tokenCoverage(qTokens, contentTokens(candidate.section ?? "")),
    direct_anchor_count: candidate.features?.direct_anchors?.length ?? 0,
    risk_tag_count: candidate.features?.risk_tags?.length ?? 0,
    precision_blocked: candidate.features?.precision_blocked === true,
    verifier_claim_score: verifierRow?.verifier?.claim_score ?? null,
    target_answer_f1: target?.answer_type === "grounded_answer" ? tokenF1(candidate.text, target.answer) : null,
    target_citation_overlap: target?.answer_type === "grounded_answer" ? setOverlap(candidateCitations, targetCitations) : 0,
  };
  const focusScore = relevance.question_candidate_overlap
    + 0.3 * relevance.question_section_overlap
    + 0.25 * relevance.direct_anchor_count
    + 0.15 * Number(relevance.verifier_claim_score ?? 0)
    - 0.3 * relevance.risk_tag_count
    - (relevance.precision_blocked ? 0.4 : 0);
  const oracleScore = Number(relevance.target_answer_f1 ?? 0) + 0.25 * relevance.target_citation_overlap;
  return {
    ...candidate,
    relevance,
    focus_score: focusScore,
    diagnostic_oracle_score: oracleScore,
  };
}

function selectHeuristicPrediction(prompt, candidates) {
  const ranked = candidates
    .filter((candidate) => !candidate.relevance.precision_blocked)
    .filter((candidate) => candidate.focus_score >= 0.2 || candidate.relevance.direct_anchor_count > 0)
    .sort((left, right) => right.focus_score - left.focus_score || (right.relevance.verifier_claim_score ?? 0) - (left.relevance.verifier_claim_score ?? 0));
  return predictionRow(prompt.example_id, ranked[0], "heuristic");
}

function selectDiagnosticOraclePrediction(prompt, candidates, target) {
  if (target?.answer_type === "abstain") return predictionRow(prompt.example_id, null, "diagnostic_oracle_abstain_target");
  const ranked = candidates
    .filter((candidate) => candidate.relevance.target_answer_f1 >= 0.35)
    .sort((left, right) => right.diagnostic_oracle_score - left.diagnostic_oracle_score || right.focus_score - left.focus_score);
  return predictionRow(prompt.example_id, ranked[0], "diagnostic_oracle");
}

function predictionRow(exampleId, selected, policy) {
  const prediction = selected ? grounded(selected) : abstain(`No ${policy} candidate selected.`);
  return {
    example_id: exampleId,
    prediction,
    raw_output: JSON.stringify(prediction),
    relevance_metadata: {
      policy,
      selected_candidate_id: selected?.candidate_id ?? null,
      focus_score: selected?.focus_score ?? null,
      diagnostic_oracle_score: selected?.diagnostic_oracle_score ?? null,
      relevance: selected?.relevance ?? null,
    },
  };
}

function grounded(candidate) {
  return {
    answer_type: "grounded_answer",
    answer: `${candidate.text} [${candidate.evidence_id}]`,
    citations: [candidate.evidence_id],
    claim_table: [{ claim: candidate.text, support: "supported", citations: [candidate.evidence_id] }],
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

function summarizePredictions(rows) {
  return {
    grounded_answers: rows.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstentions: rows.filter((row) => row.prediction.answer_type === "abstain").length,
  };
}

function summarizeOracle(candidates, targetById) {
  const byExample = groupBy(candidates, (row) => row.example_id);
  const rows = [...targetById.entries()].map(([exampleId, target]) => {
    if (target.answer_type === "abstain") return { example_id: exampleId, target_answer_type: "abstain", recoverable: true, best_score: null };
    const ranked = (byExample.get(exampleId) ?? []).sort((left, right) => right.diagnostic_oracle_score - left.diagnostic_oracle_score);
    const best = ranked[0];
    return {
      example_id: exampleId,
      target_answer_type: "grounded_answer",
      recoverable: Number(best?.relevance?.target_answer_f1 ?? 0) >= 0.35,
      best_score: best?.diagnostic_oracle_score ?? 0,
      best_candidate_id: best?.candidate_id ?? null,
      best_f1: best?.relevance?.target_answer_f1 ?? 0,
      best_citation_overlap: best?.relevance?.target_citation_overlap ?? 0,
    };
  });
  const answerable = rows.filter((row) => row.target_answer_type === "grounded_answer");
  return {
    examples: rows.length,
    answerable_examples: answerable.length,
    answerable_recoverable: answerable.filter((row) => row.recoverable).length,
    answerable_recoverable_rate: rate(answerable.filter((row) => row.recoverable).length, answerable.length),
    rows,
  };
}

function contentTokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function tokenCoverage(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size) return 0;
  return [...left].filter((token) => right.has(token)).length / left.size;
}

function tokenF1(left, right) {
  const leftTokens = contentTokens(left);
  const rightTokens = contentTokens(right);
  if (!leftTokens.length || !rightTokens.length) return 0;
  const rightCounts = new Map();
  for (const token of rightTokens) rightCounts.set(token, (rightCounts.get(token) ?? 0) + 1);
  let overlap = 0;
  for (const token of leftTokens) {
    const count = rightCounts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      rightCounts.set(token, count - 1);
    }
  }
  if (!overlap) return 0;
  const precision = overlap / leftTokens.length;
  const recall = overlap / rightTokens.length;
  return (2 * precision * recall) / (precision + recall);
}

function setOverlap(left, right) {
  if (!left.size || !right.size) return 0;
  return [...left].filter((value) => right.has(value)).length / right.size;
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

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function renderReport(result) {
  const shape = result.summary.shape_eval_results;
  const shapeSection = shape ? `
## Shape Evaluation

- Heuristic overall shape: ${pct(shape.heuristic.metrics.overall_shape_correct_rate)}
- Heuristic answerable shape: ${pct(shape.heuristic.metrics.answerable_supported_shape_rate)}
- Heuristic abstention shape: ${pct(shape.heuristic.metrics.abstention_shape_rate)}
- Diagnostic oracle overall shape: ${pct(shape.diagnostic_oracle.metrics.overall_shape_correct_rate)}
- Diagnostic oracle answerable shape: ${pct(shape.diagnostic_oracle.metrics.answerable_supported_shape_rate)}
- Diagnostic oracle abstention shape: ${pct(shape.diagnostic_oracle.metrics.abstention_shape_rate)}
` : "";
  return `# Generation-Gap Target Relevance Audit

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime job.

## Summary

- Examples: ${result.summary.examples}
- Candidate spans: ${result.summary.candidate_spans}
- Heuristic grounded answers: ${result.summary.heuristic.grounded_answers}
- Heuristic abstentions: ${result.summary.heuristic.abstentions}
- Diagnostic oracle grounded answers: ${result.summary.diagnostic_oracle.grounded_answers}
- Diagnostic oracle abstentions: ${result.summary.diagnostic_oracle.abstentions}
- Oracle answerable recoverable rate: ${pct(result.summary.oracle_ceiling.answerable_recoverable_rate)}
${shapeSection}

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

async function readShapeEvalResults(baseRunId) {
  const shapeRuns = {
    heuristic: path.join(runsDir, "generation-gap-target-relevance-audit-d336-heuristic-shape-eval", "result.json"),
    diagnostic_oracle: path.join(runsDir, "generation-gap-target-relevance-audit-d336-oracle-shape-eval", "result.json"),
  };
  const results = {};
  for (const [key, file] of Object.entries(shapeRuns)) {
    try {
      const shape = await readJson(file);
      results[key] = {
        run_id: shape.run_id ?? path.basename(path.dirname(file)),
        status: shape.status,
        metrics: shape.metrics,
      };
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }
  return results;
}

function pct(value) {
  return `${(100 * Number(value || 0)).toFixed(1)}%`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  return (await fs.readFile(file, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function readOptionalJsonl(file) {
  try {
    return await readJsonl(file);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
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
