import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "novelty-delta-matrix-2026-06-27-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const novelty = await readResult("novelty-watchlist-2026-06-27-v2");
const citationFaithfulness = await readResult("citation-faithfulness-neighbor-comparison-2026-06-27-v1");
const faithfulContext = await readResult("faithful-context-qa-comparison-2026-06-27-v1");
const citationMemory = await readResult("citation-grounding-memory-comparison-2026-06-27-v1");
const writeback = await readResult("writeback-kb-amortization-scoped-exclusion-2026-06-26-v1");
const corpusRealism = await readResult("corpus-realism-private-kb-gap-audit-2026-06-26-v1");
const distillationLoss = await readResult("distillation-loss-accounting-2026-06-27-v1");
const finalClaim = await readResult("final-claim-acceptance-matrix-2026-06-27-v1");
const finalChecklist = await readResult("final-evidence-checklist-qwen3b-2026-06-26-v1");

const entriesById = new Map(novelty.entries.map((row) => [row.id, row]));
const pressureGroups = {
  generic_rag_distillation: ["drag_rag_distillation_slm", "dgpo_compact_agentic_rag", "genground_instructional_grounding", "radio_rationale_distillation"],
  citation_training_and_grounding: ["longcite_citation_sft", "legal_citation_grounding_metric", "citation_enforced_fiscal_rag"],
  dynamic_or_evolving_benchmarks: ["dynaquest_dynamic_qa", "dragon_periodically_updated_rag", "dragon_domain_rag_data_generation"],
  agentic_research_and_routing: ["search_p1_agentic_rag_training", "infoseek_deep_research_data_synthesis", "deepsieve_agentic_knowledge_router", "agenticrag_enterprise_knowledge_bases"],
  compact_faithful_context_qa: ["occ_rag_compact_faithful_context_qa", "lit_ragbench_generator_capabilities"],
  memory_or_index_amortization: ["writeback_rag_evidence_distillation", "fd_rag_federated_compact_qa_memories", "groundedkg_rag_grounded_graph_index", "kohakurag_hierarchical_citation_rag"],
  retrieval_or_verification_faithfulness: ["qdrag_query_decomposition_citation_rag", "citerag_academic_citation_prediction", "faithfulness_aware_context_ranking", "generate_but_verify_rag_faithfulness"],
  distillation_loss_accounting: ["distillation_loss_statement"],
};

const rows = [
  claimRow({
    id: "not_generic_rag_to_slm_distillation",
    proposed_claim: "We introduce RAG-to-small-model distillation.",
    status: "rejected_as_not_novel",
    pressure_group: "generic_rag_distillation",
    surviving_delta: "Only a narrower claim can survive: data construction and evaluation for citation-grounded answer/abstention behavior on compact evidence packs under update-heldout KB states.",
    required_evidence: ["Qwen 3B judged result", "DRAG/DGPO positioning", "coverage/support/cost table"],
  }),
  claimRow({
    id: "not_citation_sft_or_citation_metric",
    proposed_claim: "We train models to cite evidence.",
    status: "rejected_as_not_novel",
    pressure_group: "citation_training_and_grounding",
    surviving_delta: "Citation syntax must be treated as a contract surface; novelty can only rest on preserving citation support, abstention support, temporal validity, and cost under amortized deployment.",
    required_evidence: ["citation support metrics", "syntax-vs-support negative controls", "paid grounded-correctness judge"],
  }),
  claimRow({
    id: "not_dynamic_qa_or_updated_corpus_benchmark",
    proposed_claim: "We evaluate QA over changing knowledge.",
    status: "rejected_as_not_novel",
    pressure_group: "dynamic_or_evolving_benchmarks",
    surviving_delta: "The benchmark story must be subordinated to amortized post-training/scaffold behavior; updated-corpus benchmark construction is already crowded.",
    required_evidence: ["trusted dated snapshot", "Qwen or scaffold result on update-heldout window", "private/domain-KB caveat"],
  }),
  claimRow({
    id: "not_online_agentic_rag_training",
    proposed_claim: "We distill agentic RAG or deep-research search behavior.",
    status: "rejected_as_not_novel",
    pressure_group: "agentic_research_and_routing",
    surviving_delta: "The deployed artifact must be a cheaper answer/scaffold policy over retrieved evidence packs, not an online search/routing agent; online agentic costs must remain a teacher or baseline.",
    required_evidence: ["per-query cost accounting", "offline/online boundary", "Qwen/scaffold predictions without online LLM calls"],
  }),
  claimRow({
    id: "not_compact_faithful_context_qa",
    proposed_claim: "We build a compact faithful context-QA model with citations and abstention.",
    status: "rejected_as_not_novel",
    pressure_group: "compact_faithful_context_qa",
    surviving_delta: "The paper must show why evolving-KB update splits, amortized teacher/scaffold data, and support/cost preservation are the contribution beyond compact faithful context QA.",
    required_evidence: ["faithful context QA comparison", "Qwen result or negative result", "update-heldout/cost framing"],
  }),
  claimRow({
    id: "not_memory_or_index_only_amortization",
    proposed_claim: "We amortize RAG by changing the KB, memory, or index.",
    status: "rejected_or_scoped_out",
    pressure_group: "memory_or_index_amortization",
    surviving_delta: "Model/scaffold-side amortization remains distinct only if write-back, compact-memory, and grounded-index approaches are treated as competing or scoped amortization targets.",
    required_evidence: ["writeback scoped exclusion", "citation-memory comparison", "leakage-safe future baseline if Qwen is positive"],
  }),
  claimRow({
    id: "not_retrieval_side_faithfulness_or_generate_verify",
    proposed_claim: "We improve citation faithfulness using retrieval/ranking or generate-then-verify.",
    status: "rejected_as_not_novel",
    pressure_group: "retrieval_or_verification_faithfulness",
    surviving_delta: "Retrieval-side decomposition/ranking and online verification are neighbors; the project can only claim that the final cheap model/scaffold preserves support after those expensive teacher/filtering steps are amortized.",
    required_evidence: ["citation-faithfulness comparison", "faithfulness-ranking control", "online verifier cost separation"],
  }),
  claimRow({
    id: "surviving_conditional_core_claim",
    proposed_claim: "We provide a measured recipe for amortized grounded QA over evolving domain/private-KB states.",
    status: finalClaim.status === "final_claim_blocked" ? "conditionally_survives_but_blocked" : "ready_for_submission_audit",
    pressure_group: null,
    surviving_delta: "The defensible core is a conjunction: post-training/scaffold data construction, compact evidence packs, inline citations as support contracts, abstention on insufficient evidence, update-heldout KB evaluation, and explicit cost amortization.",
    required_evidence: [
      "trained Qwen 3B predictions or a clearly negative trained-student result",
      "paid grounded-correctness judge",
      "70% coverage-constrained support comparison",
      "remote provenance and actual cost ledger",
      "final novelty refresh immediately before submission",
    ],
  }),
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "novelty_delta_matrix",
  status: "surviving_claim_conditional_on_qwen3b_and_judge",
  purpose: "Convert the June 2026 novelty watchlist into executable claim deltas: broad claims are rejected, and the only surviving core claim is explicitly conditional on the missing trained-student and grounded-judge evidence.",
  source_runs: {
    novelty_watchlist_run_id: novelty.run_id,
    citation_faithfulness_neighbor_comparison_run_id: citationFaithfulness.run_id,
    faithful_context_qa_comparison_run_id: faithfulContext.run_id,
    citation_grounding_memory_comparison_run_id: citationMemory.run_id,
    writeback_scope_run_id: writeback.run_id,
    corpus_realism_audit_run_id: corpusRealism.run_id,
    distillation_loss_accounting_run_id: distillationLoss.run_id,
    final_claim_acceptance_matrix_run_id: finalClaim.run_id,
    final_evidence_checklist_run_id: finalChecklist.run_id,
  },
  pressure_groups: Object.fromEntries(Object.entries(pressureGroups).map(([key, ids]) => [
    key,
    ids.map((id) => ({
      id,
      title: entriesById.get(id)?.title,
      pressure: entriesById.get(id)?.pressure,
      url: entriesById.get(id)?.url,
    })),
  ])),
  matrix: rows,
  summary: {
    broad_claims_rejected: rows.filter((row) => row.status.startsWith("rejected")).length,
    surviving_claims: rows.filter((row) => row.status.includes("survives") || row.status === "ready_for_submission_audit").length,
    surviving_core_blocked_by: finalClaim.summary?.blocking_failures ?? [],
    final_evidence_status: finalChecklist.status,
    private_enterprise_kb_claim_allowed: corpusRealism.scorecard?.supports_private_enterprise_kb_claim === true,
  },
  allowed_claim_now: "A scoped, conditional novelty hypothesis survives: amortized model/scaffold-side grounded QA over update-heldout domain KB states may be novel if the trained Qwen 3B result and paid grounded judge show support preservation with explicit cost accounting. The current artifacts do not yet prove that claim.",
  prohibited_claims_now: [
    "First RAG-to-SLM distillation method.",
    "First citation SFT, citation-grounding metric, or citation-enforced RAG system.",
    "First dynamic QA, updated-corpus RAG benchmark, or domain RAG data-generation method.",
    "First compact faithful context-QA model with citations and abstention.",
    "First online agentic RAG or enterprise-KB agentic retrieval system.",
    "First memory/index/write-back amortization method for RAG.",
    "First retrieval-side citation-faithfulness ranking or generate-then-verify RAG strategy.",
    "A private enterprise-KB proof.",
  ],
  required_before_submission_claim: [
    "Run or report the bounded Qwen 3B joint-action trained-student smoke.",
    "Run the paid grounded-correctness judge and report support/abstention/citation slices.",
    "Update the cost/coverage/support Pareto table with actual GPU and judge spend.",
    "Refresh novelty search at submission time and update this matrix if any close neighbor changes.",
    "Keep the private-KB claim scoped unless a real versioned private/domain KB benchmark is added.",
  ],
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This matrix reads local novelty and comparison artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  broad_claims_rejected: result.summary.broad_claims_rejected,
  surviving_claims: result.summary.surviving_claims,
  blockers: result.summary.surviving_core_blocked_by,
}, null, 2));

function claimRow({ id, proposed_claim, status, pressure_group, surviving_delta, required_evidence }) {
  return {
    id,
    proposed_claim,
    status,
    pressure_group,
    neighbor_ids: pressure_group ? pressureGroups[pressure_group] : [],
    surviving_delta,
    required_evidence,
  };
}

function renderReport(result) {
  const rows = result.matrix.map((row) => `| ${row.id} | ${row.status} | ${row.proposed_claim} | ${row.surviving_delta} |`).join("\n");
  return `# Novelty Delta Matrix

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Matrix

| Claim ID | Status | Broad Claim | Surviving Delta |
| --- | --- | --- | --- |
${rows}

## Allowed Claim Now

${result.allowed_claim_now}

## Prohibited Claims Now

${result.prohibited_claims_now.map((item) => `- ${item}`).join("\n")}

## Required Before Submission Claim

${result.required_before_submission_claim.map((item) => `- ${item}`).join("\n")}

No OpenAI calls, GPU jobs, or new spend were made for this matrix.
`;
}

async function readResult(id) {
  return readJson(path.join(runDir, id, "result.json"));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
