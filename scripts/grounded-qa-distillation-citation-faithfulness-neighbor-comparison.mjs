import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "citation-faithfulness-neighbor-comparison-2026-06-27-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const novelty = await readResult("novelty-watchlist-2026-06-27-v2");
const candidateOracle = await readResult("candidate-pool-oracle-final-window-2026-06-27-v1");
const repairSignal = await readResult("repair-regeneration-signal-audit-joint-action-qwen3b-2026-06-27-v1");
const pareto = await readResult("cost-coverage-support-pareto-2026-06-26-v1");
const longcite = await readResult("longcite-style-citation-sft-comparison-2026-06-26-v1");
const citationMemory = await readResult("citation-grounding-memory-comparison-2026-06-27-v1");
const faithfulnessRankingControl = await readResult("faithfulness-ranking-control-final-window-2026-06-27-v1");

const neighborIds = [
  "qdrag_query_decomposition_citation_rag",
  "citerag_academic_citation_prediction",
  "faithfulness_aware_context_ranking",
  "generate_but_verify_rag_faithfulness",
];
const neighbors = neighborIds.map((id) => novelty.entries.find((row) => row.id === id)).filter(Boolean);
const direct = find(pareto.systems, "direct_mini_repair");
const guard = find(pareto.systems, "claim_entailment_guard");
const qwenTarget = {
  run_id: "joint-action-qwen3b-smoke-eval-v1",
  status: "missing_predictions",
  acceptance_target: ">=70% answer rate with answer support above direct baseline, citation support/recall, abstention support, and amortized cost reported together.",
};

const dimensions = [
  dimension("retrieval_side_decomposition", "Do query decomposition or reranking methods solve the same problem?", [
    row("qdrag_neighbor", "competing_retrieval_strategy", "QDRAG-style decomposition can improve citation RAG attribution, but it is an online retrieval/ranking strategy rather than amortized post-training into a deployed answerer/scaffold."),
    row("current_project", "not_proven", "Current compact evidence packs are fixed before answer generation; the project has not yet compared against query decomposition over the same evolving KB windows."),
  ]),
  dimension("academic_citation_prediction", "Are scientific citation-prediction benchmarks the same as answer-support citations?", [
    row("citerag_neighbor", "adjacent_not_equivalent", "CiteRAG predicts scholarly references for academic writing; this project uses evidence ids as support citations for answer claims inside a compact evidence pack."),
    row("current_project", "must_disambiguate", "Manuscript wording must distinguish source-support evidence citations from bibliography/reference recommendation."),
  ]),
  dimension("faithfulness_ranking", "Could support gains come from ranking/filtering rather than a trained student?", [
    metricRow("direct_mini_repair", direct.answer_support_rate, "Direct baseline answers many rows but support is incomplete."),
    metricRow("claim_entailment_guard", guard.answer_support_rate, "Current support-first guard improves support through filtering/ranking-like suppression but loses coverage."),
    metricRow("lexical_faithfulness_ranking_control", faithfulnessRankingControl.eval_metrics.answer_support_rate, `A train-selected lexical cited-evidence threshold made ${faithfulnessRankingControl.eval_metrics.suppressions} final-window suppressions and changed support-oracle correctness by ${faithfulnessRankingControl.eval_metrics.delta_correct} rows.`),
    row("faithfulness_aware_context_ranking_neighbor", "competing_retrieval_control", "Faithfulness-aware context ranking is a plausible retrieval-side baseline if the paper claims support preservation from data construction."),
  ]),
  dimension("generate_then_verify", "Does verification alone satisfy the final target?", [
    row("generate_but_verify_neighbor", "teacher_or_filtering_neighbor", "Generate-then-verify overlaps with the project's teacher repair and guard stages."),
    row("candidate_pool_oracle", "selection_limited", `Even oracle selection over existing verified candidates answers only ${candidateOracle.oracle.answered}/${candidateOracle.oracle.examples} (${pct(candidateOracle.oracle.answer_rate)}), below the 70% answer-rate target.`),
    row("repair_signal", "needed_for_generation", `The Qwen packet has ${repairSignal.aggregate.dpo_train.repair_grounded_chosen_rows} train repair contrasts for ${repairSignal.oracle_gap.examples_without_supported_answer_candidate} oracle-gap examples, so the next test is generation/repair, not only verification.`),
  ]),
  dimension("citation_syntax_vs_support", "Can citation metrics be satisfied by formatting alone?", [
    row("longcite_comparison", "syntax_not_support", `${longcite.run_id} and local citation-repair controls show citation syntax is not support evidence.`),
    row("citation_grounding_memory_comparison", "separate_metrics", `${citationMemory.run_id} requires citation existence, support/relevance, and temporal/update validity to be reported separately.`),
  ]),
  dimension("final_claim_boundary", "What claim survives these neighbors?", [
    row("qwen_target", "unproven_required", `The surviving claim requires the missing ${qwenTarget.run_id} predictions and paid judge result: ${qwenTarget.acceptance_target}`),
    row("allowed_framing", "narrow", "Data construction and evaluation for amortized grounded QA over evolving KB states, not first citation RAG, first verifier, first reranker, or first academic citation benchmark."),
  ]),
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  comparison_type: "citation_faithfulness_neighbor_positioning",
  related_work_framing: {
    neighbors: neighbors.map((paper) => ({
      id: paper.id,
      title: paper.title,
      url: paper.url,
      pressure: paper.pressure,
      overlap_axes: paper.overlap_axes,
    })),
    overlap: "The new close neighbors pressure citation RAG through query decomposition/reranking, academic citation prediction, faithfulness-aware context ranking, and generate-then-verify pipelines.",
    distinction: "The project survives only as update-heldout model/scaffold-side amortization with answer support, citation support, abstention support, coverage, temporal/update validity, and cost measured together.",
  },
  dimensions,
  current_project_evidence: {
    novelty_watchlist_run_id: novelty.run_id,
    candidate_pool_oracle_run_id: candidateOracle.run_id,
    repair_signal_audit_run_id: repairSignal.run_id,
    pareto_run_id: pareto.run_id,
    citation_sft_comparison_run_id: longcite.run_id,
    citation_grounding_memory_comparison_run_id: citationMemory.run_id,
    faithfulness_ranking_control_run_id: faithfulnessRankingControl.run_id,
  },
  retrieval_side_control: {
    run_id: faithfulnessRankingControl.run_id,
    control_type: faithfulnessRankingControl.control_type,
    selected_threshold: faithfulnessRankingControl.selected_threshold.threshold,
    train_delta_correct: faithfulnessRankingControl.selected_threshold.delta_correct,
    final_answer_rate: faithfulnessRankingControl.eval_metrics.answer_rate,
    final_answer_support_rate: faithfulnessRankingControl.eval_metrics.answer_support_rate,
    final_delta_correct: faithfulnessRankingControl.eval_metrics.delta_correct,
    suppressions: faithfulnessRankingControl.eval_metrics.suppressions,
    interpretation: faithfulnessRankingControl.paper_implication,
  },
  synthesis: {
    headline: "Retrieval-side citation faithfulness and verification pipelines are close enough that the paper must avoid broad citation-RAG claims.",
    claim_boundary: [
      "Do not claim first query-decomposition, reranking, or faithfulness-aware context-selection method for citation RAG.",
      "Do not claim academic citation prediction as the task; answer-support evidence citations are different.",
      "Do not present generate-then-verify as the deployed contribution unless the verification cost is included.",
      "The Qwen 3B result must demonstrate generation/repair beyond selection-only verification because the current candidate-pool oracle is coverage-limited.",
      "A lexical cited-evidence faithfulness ranking filter is not enough on the final window because the fixed train-selected threshold makes no final-window improvement.",
    ],
    required_after_qwen_smoke: [
      "Report whether trained Qwen improves support at >=70% answer rate compared with direct repair, guard/ranking-like filters, and the candidate-pool oracle boundary.",
      "If reviewers press on QDRAG/ranking, report the same-window lexical faithfulness-ranking control and, if Qwen is positive, consider a stronger retrieval-side decomposition/ranking baseline.",
      "If reviewers press on Generate-but-Verify, report online verification cost separately from amortized student/scaffold cost.",
    ],
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This comparison reads existing local artifacts and primary-source metadata already captured in the novelty watchlist.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  comparison_type: result.comparison_type,
  neighbors: result.related_work_framing.neighbors.map((paper) => paper.id),
  llm_budget: result.llm_budget,
}, null, 2));

function dimension(id, question, rows) {
  return { id, question, rows };
}

function row(system_id, status, evidence) {
  return { system_id, status, metric: null, evidence };
}

function metricRow(system_id, metric, evidence) {
  return { system_id, status: Number(metric) >= 0.7 ? "passes_threshold" : "below_threshold", metric: Number.isFinite(Number(metric)) ? Number(metric) : null, evidence };
}

function find(rows, id) {
  return rows.find((row) => row.id === id) ?? {};
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

function renderReport(result) {
  return `# Citation Faithfulness Neighbor Comparison

Generated: ${result.generated_at}

## Close Neighbors

${result.related_work_framing.neighbors.map((paper) => `- [${paper.title}](${paper.url}) (${paper.pressure})`).join("\n")}

## Framing

- Overlap: ${result.related_work_framing.overlap}
- Distinction: ${result.related_work_framing.distinction}

## Dimensions

${result.dimensions.map((dimension) => `### ${dimension.id}

${dimension.question}

${dimension.rows.map((entry) => `- ${entry.system_id}: ${entry.metric == null ? "" : `${pct(entry.metric)}; `}${entry.evidence}`).join("\n")}`).join("\n\n")}

## Claim Boundary

${result.synthesis.claim_boundary.map((item) => `- ${item}`).join("\n")}

## Required After Qwen Smoke

${result.synthesis.required_after_qwen_smoke.map((item) => `- ${item}`).join("\n")}

No OpenAI calls, GPU jobs, or new spend were made for this artifact.
`;
}

async function readResult(id) {
  return JSON.parse(await fs.readFile(path.join(runDir, id, "result.json"), "utf8"));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
