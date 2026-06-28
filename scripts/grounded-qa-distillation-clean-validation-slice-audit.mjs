import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const baselineRunId = args["baseline-run"] ?? "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1";
const boundaryRunId = args["boundary-run"] ?? "filtered-boundary-selector-gpt4o-qwen-frontier-pool-2026-06-28-v1";
const runId = args["run-id"] ?? "clean-validation-slice-audit-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const stopwords = new Set([
  "the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "has", "have", "had", "but", "not", "can", "may", "its", "into", "than", "then", "also", "been", "their", "there", "which", "while", "using", "used", "use", "true", "false", "answer", "claim", "evidence", "support", "supported", "paper", "they", "did", "does", "what", "which", "how", "many", "much", "their", "these", "those", "model", "models", "dataset", "datasets", "results", "experiments",
]);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const validationPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "validation_pairwise.jsonl"));
const predictionSets = {
  d262_pool_pairwise: await readJsonl(path.join(runsDir, baselineRunId, "existing_validation_pair_predictions.jsonl")),
  d262_constrained: await readJsonl(path.join(runsDir, baselineRunId, "constrained_existing_validation_pair_predictions.jsonl")),
  boundary_only: await readJsonl(path.join(runsDir, boundaryRunId, "boundary_existing_validation_pair_predictions.jsonl")),
  selected_hybrid: await readJsonl(path.join(runsDir, boundaryRunId, "hybrid_existing_validation_pair_predictions.jsonl")),
};
const predictionsBySelector = Object.fromEntries(Object.entries(predictionSets).map(([selector, rows]) => [selector, indexBy(rows, "pair_id")]));

const examples = groupBy(validationPairs, (row) => row.example_id);
const exampleAudits = [...examples.entries()].map(([exampleId, rows]) => auditExample(exampleId, rows, predictionsBySelector));
const pairRows = validationPairs.flatMap((pair) => pairRowsFor(pair, exampleAudits.find((row) => row.example_id === pair.example_id), predictionsBySelector));
const selectorSummary = summarizeSelectorRows(pairRows);
const strataSummary = summarizeStrataRows(pairRows);
const tournamentSummary = summarizeTournament(exampleAudits);
const cleanExamples = exampleAudits.filter((row) => row.clean_eval_eligible);
const ambiguityRiskExamples = exampleAudits.filter((row) => row.ambiguity_risk.is_ambiguity_risk);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "clean_validation_slice_audit",
  purpose: "Build a zero-call non-final clean evaluation slice from existing validation pairwise labels and evaluate current selectors outside the noisy final diagnostic window.",
  source_runs: {
    pairwise_packet: pairwisePacketRunId,
    baseline_selector: baselineRunId,
    boundary_selector: boundaryRunId,
  },
  summary: {
    validation_examples: exampleAudits.length,
    validation_pairwise_rows: validationPairs.length,
    clean_eval_examples: cleanExamples.length,
    ambiguity_risk_examples: ambiguityRiskExamples.length,
    clean_eval_example_ids: cleanExamples.map((row) => row.example_id),
    ambiguity_risk_example_ids: ambiguityRiskExamples.map((row) => row.example_id),
  },
  selector_summary: selectorSummary,
  strata_summary: strataSummary,
  tournament_summary: tournamentSummary,
  diagnosis: diagnose({ selectorSummary, strataSummary, tournamentSummary, cleanExamples, ambiguityRiskExamples }),
  decision: {
    promote_clean_validation_slice_as_replacement_final_eval_now: true,
    integrate_boundary_selector_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    use_final_ambiguity_risk_rows_for_training: false,
    next_step: "Use the clean non-final validation slice as the immediate selector diagnostic, then mine or curate more clean held-out examples before any new paid label or GPU run.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_evaluation: false,
    validation_training_use: "allowed_validation_diagnostic_only",
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
    note: "This audit reads existing validation pairwise labels and selector predictions only.",
  },
  artifacts: {
    example_audits_jsonl: rel(path.join(outputDir, "example_audits.jsonl")),
    selector_pair_strata_jsonl: rel(path.join(outputDir, "selector_pair_strata.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "example_audits.jsonl"), exampleAudits);
await writeJsonl(path.join(outputDir, "selector_pair_strata.jsonl"), pairRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result, exampleAudits);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  summary: result.summary,
  selector_summary: result.selector_summary,
  tournament_summary: result.tournament_summary,
  diagnosis: result.diagnosis,
  decision: result.decision,
}, null, 2));

function auditExample(exampleId, rows, predictionsBySelector) {
  const first = rows[0];
  const candidates = candidateRows(rows);
  const candidateAudits = candidates.map((candidate) => auditCandidate(candidate, first.input, first.reference));
  const supportedCandidateIds = new Set(candidateAudits.filter((row) => row.existing_judge_supported).map((row) => row.candidate_id));
  const ambiguityRisk = ambiguityRiskFor(first.input, first.reference, candidateAudits);
  const tournament = Object.fromEntries(Object.entries(predictionsBySelector).map(([selector, predictions]) => [selector, tournamentOutcome(rows, predictions, supportedCandidateIds)]));
  const difficultyTags = difficultyTagsFor(first, candidateAudits);
  const cleanEvalEligible = !ambiguityRisk.is_ambiguity_risk && rows.length >= 2 && candidates.length >= 3 && supportedCandidateIds.size >= 1;
  return {
    example_id: exampleId,
    paper_id: first.input.document_metadata?.paper_id ?? null,
    question: first.input.question,
    reference: first.reference,
    pairwise_rows: rows.length,
    candidate_count: candidates.length,
    supported_candidate_count: supportedCandidateIds.size,
    clean_eval_eligible: cleanEvalEligible,
    difficulty_tags: difficultyTags,
    ambiguity_risk: ambiguityRisk,
    tournament_outcomes: tournament,
    candidate_audits: candidateAudits,
  };
}

function candidateRows(pairs) {
  const byId = new Map();
  for (const pair of pairs) {
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const id = candidate.id ?? candidate.candidate_id;
      if (!byId.has(id)) {
        byId.set(id, { ...candidate, candidate_id: id, existing_judge_supported: role === "chosen" });
      } else if (role === "chosen") {
        byId.get(id).existing_judge_supported = true;
      }
    }
  }
  return [...byId.values()];
}

function auditCandidate(candidate, input, reference) {
  const answer = String(candidate.answer ?? "");
  const claimText = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? "")).join(" ");
  const answerClaimTerms = contentTokens(`${answer} ${claimText}`);
  const questionTerms = contentTokens(input.question);
  const referenceTerms = contentTokens(stripCitationMarkers(reference?.answer ?? ""));
  const citedText = citedEvidenceText(input, candidate);
  return {
    candidate_id: candidate.candidate_id,
    existing_judge_supported: Boolean(candidate.existing_judge_supported),
    answer_type: candidate.answer_type ?? "grounded_answer",
    answer_preview: preview(answer, 180),
    lexical_alignment: {
      question_term_overlap: overlap(questionTerms, answerClaimTerms),
      reference_term_overlap: overlap(referenceTerms, answerClaimTerms),
      answer_cited_coverage: overlap(contentTokens(answer), contentTokens(citedText)),
      claim_cited_coverage: overlap(contentTokens(claimText), contentTokens(citedText)),
    },
    unsupported_claim_count: (candidate.judgment?.unsupported_claims ?? []).length,
  };
}

function ambiguityRiskFor(input, reference, candidateAudits) {
  const questionTerms = contentTokens(input.question);
  const referenceTerms = contentTokens(stripCitationMarkers(reference?.answer ?? ""));
  const isAbstentionReference = /does not contain enough support|insufficient/i.test(reference?.answer ?? "");
  const isYesNoReference = /^(yes|no)\b/i.test(stripCitationMarkers(reference?.answer ?? "").trim());
  const citedReferenceText = citedEvidenceText(input, { citations: reference?.citations ?? [] });
  const supported = candidateAudits.filter((row) => row.existing_judge_supported);
  const tags = [];
  const questionReferenceOverlap = overlap(questionTerms, referenceTerms);
  const referenceCitedCoverage = reference?.citations?.length ? overlap(referenceTerms, contentTokens(citedReferenceText)) : isAbstentionReference ? 1 : 0;
  const maxSupportedReferenceOverlap = max(supported.map((row) => row.lexical_alignment.reference_term_overlap));
  const maxSupportedQuestionOverlap = max(supported.map((row) => row.lexical_alignment.question_term_overlap));
  if (questionReferenceOverlap === 0 && !isYesNoReference && !isAbstentionReference) tags.push("zero_question_reference_overlap");
  if (referenceCitedCoverage < 0.5 && !isYesNoReference && !isAbstentionReference) tags.push("low_reference_cited_coverage");
  if (supported.length && maxSupportedReferenceOverlap < 0.25 && !isAbstentionReference) tags.push("supported_candidates_low_reference_alignment");
  if (/existing baseline models/i.test(input.question) && /Generative Approaches|Retrieval-Based Approaches/i.test(reference?.answer ?? "")) tags.push("long_reference_list_scope_risk");
  if (/annotators familiar/i.test(input.question) && /non-expert|trained experts/i.test(reference?.answer ?? "")) tags.push("question_reference_polarity_scope_risk");
  const highRiskTags = tags.filter((tag) => [
    "low_reference_cited_coverage",
    "supported_candidates_low_reference_alignment",
    "long_reference_list_scope_risk",
    "question_reference_polarity_scope_risk",
  ].includes(tag));
  return {
    is_ambiguity_risk: highRiskTags.length > 0,
    tags,
    high_risk_tags: highRiskTags,
    question_reference_overlap: round(questionReferenceOverlap),
    reference_cited_coverage: round(referenceCitedCoverage),
    max_supported_reference_overlap: round(maxSupportedReferenceOverlap),
    max_supported_question_overlap: round(maxSupportedQuestionOverlap),
  };
}

function difficultyTagsFor(pair, candidateAudits) {
  const tags = [];
  const referenceAnswer = pair.reference?.answer ?? "";
  if (/does not contain enough support|insufficient/i.test(referenceAnswer)) tags.push("abstention");
  if (/\d/.test(referenceAnswer)) tags.push("numeric");
  if (/;|,/.test(referenceAnswer) && contentTokens(referenceAnswer).length >= 5) tags.push("list_or_multi_part");
  if (candidateAudits.some((row) => row.unsupported_claim_count > 0)) tags.push("unsupported_distractor");
  if (candidateAudits.some((row) => row.lexical_alignment.reference_term_overlap >= 0.8 && !row.existing_judge_supported)) tags.push("near_miss_unsupported");
  return tags;
}

function tournamentOutcome(pairs, predictions, supportedCandidateIds) {
  const scores = new Map();
  const margins = new Map();
  for (const pair of pairs) {
    const prediction = predictions.get(pair.pair_id);
    if (!prediction) continue;
    const chosenId = pair.chosen.id ?? pair.chosen.candidate_id;
    const rejectedId = pair.rejected.id ?? pair.rejected.candidate_id;
    const predictedWinner = prediction.predicted_preferred === "chosen" ? chosenId : rejectedId;
    const predictedLoser = prediction.predicted_preferred === "chosen" ? rejectedId : chosenId;
    scores.set(predictedWinner, (scores.get(predictedWinner) ?? 0) + 1);
    scores.set(predictedLoser, (scores.get(predictedLoser) ?? 0) - 1);
    margins.set(predictedWinner, (margins.get(predictedWinner) ?? 0) + Math.abs(Number(prediction.margin ?? 0)));
  }
  const ranked = [...scores.entries()].sort((a, b) => (b[1] - a[1]) || ((margins.get(b[0]) ?? 0) - (margins.get(a[0]) ?? 0)) || a[0].localeCompare(b[0]));
  const selectedCandidateId = ranked[0]?.[0] ?? null;
  return {
    selected_candidate_id: selectedCandidateId,
    selected_supported_answer: selectedCandidateId ? supportedCandidateIds.has(selectedCandidateId) : false,
    tournament_score: ranked[0]?.[1] ?? null,
  };
}

function pairRowsFor(pair, exampleAudit, predictionsBySelector) {
  return Object.entries(predictionsBySelector).map(([selector, predictions]) => {
    const prediction = predictions.get(pair.pair_id);
    return {
      pair_id: pair.pair_id,
      example_id: pair.example_id,
      selector,
      stratum: exampleAudit.clean_eval_eligible ? "clean_eval" : exampleAudit.ambiguity_risk.is_ambiguity_risk ? "ambiguity_risk" : "other_validation",
      difficulty_tags: exampleAudit.difficulty_tags,
      predicted_preferred: prediction?.predicted_preferred ?? null,
      correct: Boolean(prediction?.correct),
      margin: round(prediction?.margin ?? 0),
      training_use: pair.training_use,
    };
  });
}

function summarizeSelectorRows(rows) {
  return Object.fromEntries([...groupBy(rows, (row) => row.selector).entries()].map(([selector, selectorRows]) => [selector, summarizePairRows(selectorRows)]));
}

function summarizeStrataRows(rows) {
  return Object.fromEntries([...groupBy(rows, (row) => `${row.stratum}:${row.selector}`).entries()].map(([key, keyRows]) => [key, summarizePairRows(keyRows)]));
}

function summarizePairRows(rows) {
  const correct = rows.filter((row) => row.correct).length;
  return {
    pairs: rows.length,
    correct,
    accuracy: round(correct / Math.max(1, rows.length)),
    mean_abs_margin: round(mean(rows.map((row) => Math.abs(Number(row.margin ?? 0))))),
  };
}

function summarizeTournament(exampleAudits) {
  const rows = [];
  for (const example of exampleAudits) {
    for (const [selector, outcome] of Object.entries(example.tournament_outcomes)) {
      rows.push({
        selector,
        stratum: example.clean_eval_eligible ? "clean_eval" : example.ambiguity_risk.is_ambiguity_risk ? "ambiguity_risk" : "other_validation",
        selected_supported_answer: outcome.selected_supported_answer,
      });
    }
  }
  return Object.fromEntries([...groupBy(rows, (row) => `${row.stratum}:${row.selector}`).entries()].map(([key, keyRows]) => {
    const selectedSupported = keyRows.filter((row) => row.selected_supported_answer).length;
    return [key, {
      examples: keyRows.length,
      selected_supported: selectedSupported,
      selected_supported_rate: round(selectedSupported / Math.max(1, keyRows.length)),
    }];
  }));
}

function diagnose({ selectorSummary, strataSummary, tournamentSummary, cleanExamples, ambiguityRiskExamples }) {
  const cleanD262 = strataSummary["clean_eval:d262_constrained"] ?? strataSummary["clean_eval:d262_pool_pairwise"];
  const cleanBoundary = strataSummary["clean_eval:boundary_only"];
  const cleanHybrid = strataSummary["clean_eval:selected_hybrid"];
  return {
    primary_finding: "clean_nonfinal_validation_slice_is_available",
    clean_eval_examples: cleanExamples.length,
    ambiguity_risk_examples: ambiguityRiskExamples.length,
    clean_pair_accuracy: {
      d262_constrained: cleanD262?.accuracy ?? null,
      boundary_only: cleanBoundary?.accuracy ?? null,
      selected_hybrid: cleanHybrid?.accuracy ?? null,
    },
    clean_tournament: {
      d262_constrained: tournamentSummary["clean_eval:d262_constrained"] ?? null,
      boundary_only: tournamentSummary["clean_eval:boundary_only"] ?? null,
      selected_hybrid: tournamentSummary["clean_eval:selected_hybrid"] ?? null,
    },
    interpretation: cleanBoundary && cleanD262 && cleanBoundary.accuracy <= cleanD262.accuracy
      ? "The clean non-final validation slice does not support promoting boundary-only scoring over D262; it should replace the noisy final diagnostic for immediate selector decisions."
      : "The clean non-final validation slice shows a possible boundary gain, but it should be expanded before selector integration.",
  };
}

function citedEvidenceText(input, candidate) {
  const ids = new Set(candidate.citations ?? []);
  return (input.compact_retrieved_evidence_pack ?? []).filter((item) => ids.has(item.evidence_id)).map((item) => item.text).join(" ");
}

function contentTokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .match(/[a-z][a-z0-9-]{2,}|\d+(?:[.,]\d+)*(?:k|%)?/g)
    ?.map(normalizeToken)
    .filter((token) => token && !stopwords.has(token)) ?? [];
}

function normalizeToken(token) {
  if (/^\d[\d,]*(?:\.\d+)?(?:k|%)?$/.test(token)) return token.replace(/,/g, "");
  return token;
}

function stripCitationMarkers(value) {
  return String(value ?? "").replace(/\[[^\]]+\]/g, " ");
}

function overlap(source, target) {
  if (!source.length) return 0;
  const targetSet = new Set(target);
  return source.filter((token) => targetSet.has(token)).length / source.length;
}

function renderReport(result, exampleAudits) {
  return `# Clean Validation Slice Audit

Generated: ${result.generated_at}

This is a zero-call non-final validation audit. It uses no final-window labels for training, tuning, or evaluation.

## Summary

- Validation examples: ${result.summary.validation_examples}
- Validation pairwise rows: ${result.summary.validation_pairwise_rows}
- Clean eval examples: ${result.summary.clean_eval_examples}
- Ambiguity-risk examples: ${result.summary.ambiguity_risk_examples}
- Clean eval ids: ${result.summary.clean_eval_example_ids.join(", ") || "none"}

## Pair Accuracy

${Object.entries(result.strata_summary).map(([key, value]) => `- ${key}: ${value.correct}/${value.pairs} correct, accuracy ${value.accuracy}, mean abs margin ${value.mean_abs_margin}`).join("\n")}

## Tournament Selection

${Object.entries(result.tournament_summary).map(([key, value]) => `- ${key}: ${value.selected_supported}/${value.examples} selected supported`).join("\n")}

## Examples

${exampleAudits.map((row) => `- ${row.example_id}: clean=${row.clean_eval_eligible}, risk=${row.ambiguity_risk.is_ambiguity_risk}, pairs=${row.pairwise_rows}, candidates=${row.candidate_count}, difficulty=${row.difficulty_tags.join(",") || "none"}`).join("\n")}

## Diagnosis

- Primary finding: ${result.diagnosis.primary_finding}
- Interpretation: ${result.diagnosis.interpretation}

## Decision

- Promote clean validation slice as replacement final eval now: ${result.decision.promote_clean_validation_slice_as_replacement_final_eval_now ? "yes" : "no"}
- Integrate boundary selector now: ${result.decision.integrate_boundary_selector_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
`;
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

function indexBy(rows, key) {
  return new Map(rows.map((row) => [row[key], row]));
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

function max(values) {
  const finite = values.filter((value) => Number.isFinite(Number(value)));
  return finite.length ? Math.max(...finite) : 0;
}

function rel(file) {
  return path.relative(rootDir, file);
}

function preview(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

function round(value, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}
