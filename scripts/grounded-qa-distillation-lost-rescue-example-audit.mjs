import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const exampleId = args["example-id"] ?? "2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137";
const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const baselineRunId = args["baseline-run"] ?? "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1";
const boundaryRunId = args["boundary-run"] ?? "filtered-boundary-selector-gpt4o-qwen-frontier-pool-2026-06-28-v1";
const tradeoffRunId = args["tradeoff-run"] ?? "boundary-hybrid-tradeoff-audit-gpt4o-qwen-frontier-pool-2026-06-28-v1";
const runId = args["run-id"] ?? "lost-rescue-example-audit-2004-03090-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const stopwords = new Set(["the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "has", "have", "had", "but", "not", "can", "may", "its", "into", "than", "then", "also", "been", "their", "there", "which", "while", "using", "used", "use", "true", "false", "answer", "claim", "evidence", "support", "supported", "paper", "they", "did", "what", "which", "news", "outlets", "focus", "focused"]);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const diagnosticPairs = (await readJsonl(path.join(runsDir, pairwisePacketRunId, "diagnostic_frontier_pairwise.jsonl"))).filter((row) => row.example_id === exampleId);
if (!diagnosticPairs.length) throw new Error(`No diagnostic pairs found for ${exampleId}.`);
const input = diagnosticPairs[0].input;
const reference = diagnosticPairs[0].reference;
const candidates = candidateRows(diagnosticPairs);
const d262Selection = await findSelection(path.join(runsDir, baselineRunId, "constrained_final_diagnostic_selections.jsonl"), exampleId);
const boundarySelection = await findSelection(path.join(runsDir, boundaryRunId, "boundary_final_diagnostic_selections.jsonl"), exampleId);
const hybridSelection = await findSelection(path.join(runsDir, boundaryRunId, "hybrid_final_diagnostic_selections.jsonl"), exampleId);
const lostRescue = await findSelection(path.join(runsDir, tradeoffRunId, "hybrid_lost_rescues.jsonl"), exampleId);

const questionTerms = contentTokens(input.question);
const candidateAudits = candidates.map((candidate) => auditCandidate(candidate, input, reference, questionTerms, {
  d262: d262Selection,
  boundary: boundarySelection,
  hybrid: hybridSelection,
}));
const supported = candidateAudits.filter((row) => row.existing_judge_supported);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "lost_rescue_example_audit",
  example_id: exampleId,
  purpose: "Audit the single D273 lost-rescue final diagnostic example to decide whether it is a ranking-margin, generation, or label-quality problem.",
  question: input.question,
  reference,
  evidence_summary: evidenceSummary(input),
  selector_summary: {
    d262_selected: summarizeSelection(d262Selection),
    boundary_only_selected: summarizeSelection(boundarySelection),
    selected_hybrid_selected: summarizeSelection(hybridSelection),
    alpha_needed_for_boundary_rescue: lostRescue?.hybrid_alpha_needed_to_match_boundary_selection ?? null,
  },
  candidate_summary: {
    candidates: candidateAudits.length,
    existing_judge_supported_candidates: supported.length,
    supported_candidate_ids: supported.map((row) => row.candidate_id),
    d262_selected_candidate_id: d262Selection?.selected_candidate_id,
    boundary_selected_candidate_id: boundarySelection?.selected_candidate_id,
    hybrid_selected_candidate_id: hybridSelection?.selected_candidate_id,
  },
  diagnosis: diagnose(candidateAudits, reference, input.question),
  decision: decisionFor(candidateAudits, reference, input.question),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_diagnostic_use: "forbidden_diagnostic_audit_only",
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
    note: "This audit reads existing final diagnostic artifacts only.",
  },
  artifacts: {
    candidate_audits_jsonl: rel(path.join(outputDir, "candidate_audits.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "candidate_audits.jsonl"), candidateAudits);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result, candidateAudits);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  diagnosis: result.diagnosis,
  decision: result.decision,
}, null, 2));

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

function auditCandidate(candidate, input, reference, questionTerms, selections) {
  const answer = String(candidate.answer ?? "");
  const claimText = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? "")).join(" ");
  const citedText = citedEvidenceText(input, candidate);
  const answerTerms = contentTokens(answer);
  const claimTerms = contentTokens(claimText);
  const referenceTerms = contentTokens(reference?.answer ?? "");
  return {
    candidate_id: candidate.candidate_id,
    family: candidate.family,
    answer_preview: preview(answer, 240),
    citations: candidate.citations ?? [],
    claim_table: candidate.claim_table ?? [],
    existing_judge_supported: Boolean(candidate.existing_judge_supported),
    existing_judge_verdict: candidate.judgment?.verdict ?? null,
    unsupported_claims: candidate.judgment?.unsupported_claims ?? [],
    selector_ranks: {
      d262_rank: rankOf(selections.d262, candidate.candidate_id),
      boundary_rank: rankOf(selections.boundary, candidate.candidate_id),
      hybrid_rank: rankOf(selections.hybrid, candidate.candidate_id),
      d262_score: scoreOf(selections.d262, candidate.candidate_id),
      boundary_score: scoreOf(selections.boundary, candidate.candidate_id),
      hybrid_score: scoreOf(selections.hybrid, candidate.candidate_id),
    },
    lexical_alignment: {
      question_term_overlap: overlap(questionTerms, [...answerTerms, ...claimTerms]),
      reference_term_overlap: overlap(referenceTerms, [...answerTerms, ...claimTerms]),
      answer_cited_coverage: overlap(answerTerms, contentTokens(citedText)),
      claim_cited_coverage: overlap(claimTerms, contentTokens(citedText)),
    },
    failure_tags: failureTags(candidate, input, reference, questionTerms),
  };
}

function failureTags(candidate, input, reference, questionTerms) {
  const tags = [];
  const answerClaim = `${candidate.answer ?? ""} ${(candidate.claim_table ?? []).map((claim) => claim.claim ?? "").join(" ")}`;
  const citedText = citedEvidenceText(input, candidate);
  if ((candidate.judgment?.unsupported_claims ?? []).length) tags.push("existing_unsupported_claim");
  if (contentTokens(answerClaim).length > 20) tags.push("verbose_answer");
  if (overlap(questionTerms, contentTokens(answerClaim)) < 0.34) tags.push("low_question_alignment");
  if (overlap(contentTokens(reference?.answer ?? ""), contentTokens(answerClaim)) < 0.34) tags.push("low_reference_alignment");
  if (overlap(contentTokens(answerClaim), contentTokens(citedText)) < 0.5) tags.push("low_cited_coverage");
  if (/dataset|settings|role|roles|conversational/.test(answerClaim.toLowerCase()) && /news outlets/i.test(input.question)) tags.push("question_entity_mismatch");
  return tags;
}

function diagnose(candidateAudits, reference, question) {
  const selectedUnsupported = candidateAudits.filter((row) => row.selector_ranks.d262_rank === 1 || row.selector_ranks.hybrid_rank === 1).filter((row) => !row.existing_judge_supported);
  const supported = candidateAudits.find((row) => row.existing_judge_supported);
  const questionReferenceMismatch = overlap(contentTokens(question), contentTokens(reference?.answer ?? "")) === 0;
  return {
    primary_failure: questionReferenceMismatch ? "ambiguous_question_reference_mismatch_plus_ranking_margin" : "ranking_margin_failure",
    question_reference_mismatch: questionReferenceMismatch,
    selected_unsupported_candidates: selectedUnsupported.map((row) => row.candidate_id),
    only_supported_candidate: supported?.candidate_id ?? null,
    supported_candidate_is_not_reference_match: supported ? supported.lexical_alignment.reference_term_overlap < 0.34 : null,
    interpretation: questionReferenceMismatch
      ? "The final example is not a clean training target: the question asks for news outlets, the reference answer is 'natural dialog', and the candidate-pool judge marks a dataset-list answer as supported."
      : "The selector over-ranks unsupported verbose candidates over a concise supported candidate.",
  };
}

function decisionFor(candidateAudits, reference, question) {
  const diagnosis = diagnose(candidateAudits, reference, question);
  return {
    use_example_for_training_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    reason: diagnosis.question_reference_mismatch
      ? "The lost rescue is label-ambiguous and should not drive selector training or policy thresholds."
      : "The lost rescue requires a targeted generation/ranking-margin fix, not more broad labels.",
    next_step: diagnosis.question_reference_mismatch
      ? "Quarantine this final diagnostic as a label-quality risk and audit whether final-window support metrics should separately track ambiguous-question examples."
      : "Construct non-final examples with verbose unsupported over-answer versus concise supported answer, then test a ranking-margin penalty.",
  };
}

function evidenceSummary(input) {
  return (input.compact_retrieved_evidence_pack ?? []).map((item) => ({
    evidence_id: item.evidence_id,
    section: item.section,
    preview: preview(item.text, 260),
  }));
}

async function findSelection(file, id) {
  return (await readJsonl(file)).find((row) => row.example_id === id) ?? null;
}

function rankOf(selection, candidateId) {
  const index = (selection?.ranked_candidates ?? []).findIndex((row) => row.candidate_id === candidateId);
  return index >= 0 ? index + 1 : null;
}

function scoreOf(selection, candidateId) {
  const row = (selection?.ranked_candidates ?? []).find((item) => item.candidate_id === candidateId);
  return row ? round(row.score) : null;
}

function summarizeSelection(selection) {
  return {
    selected_candidate_id: selection?.selected_candidate_id ?? null,
    selected_supported_answer: Boolean(selection?.selected_supported_answer),
    selected_score: round(selection?.selected_score),
  };
}

function citedEvidenceText(input, candidate) {
  const ids = new Set(candidate.citations ?? []);
  return (input.compact_retrieved_evidence_pack ?? []).filter((item) => ids.has(item.evidence_id)).map((item) => item.text).join(" ");
}

function contentTokens(value) {
  return String(value ?? "").toLowerCase().match(/[a-z][a-z0-9-]{2,}|\d+(?:[.,]\d+)*(?:k|%)?/g)?.filter((token) => !stopwords.has(token)) ?? [];
}

function overlap(source, target) {
  if (!source.length) return 0;
  const targetSet = new Set(target);
  return source.filter((token) => targetSet.has(token)).length / source.length;
}

function renderReport(result, candidateAudits) {
  return `# Lost-Rescue Example Audit

Generated: ${result.generated_at}

This is a zero-call final-diagnostic audit. It uses final-window labels only as forbidden diagnostics and makes no training decision from them.

Question: ${result.question}

Reference answer: ${result.reference.answer}

## Diagnosis

- Primary failure: ${result.diagnosis.primary_failure}
- Interpretation: ${result.diagnosis.interpretation}
- D262 selected: ${result.selector_summary.d262_selected.selected_candidate_id}
- Boundary-only selected: ${result.selector_summary.boundary_only_selected.selected_candidate_id}
- Hybrid selected: ${result.selector_summary.selected_hybrid_selected.selected_candidate_id}

## Candidates

${candidateAudits.map((row) => `- ${row.candidate_id}: supported=${row.existing_judge_supported}, ranks D262/boundary/hybrid=${row.selector_ranks.d262_rank}/${row.selector_ranks.boundary_rank}/${row.selector_ranks.hybrid_rank}, tags=${row.failure_tags.join(",") || "none"}`).join("\n")}

## Decision

- Use example for training now: ${result.decision.use_example_for_training_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
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
