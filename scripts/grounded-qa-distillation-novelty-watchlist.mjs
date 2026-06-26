import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "novelty-watchlist-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const rows = [
  {
    id: "drag_rag_distillation_slm",
    title: "DRAG: Distilling RAG for SLMs from LLMs to Transfer Knowledge and Mitigate Hallucination via Evidence and Graph-based Distillation",
    venue_or_status: "ACL 2025",
    url: "https://aclanthology.org/2025.acl-long.358/",
    overlap_axes: ["rag_to_slm_distillation", "evidence_distillation", "hallucination_mitigation"],
    pressure: "very_high",
    implication: "Generic RAG-to-small-model distillation is not novel. The grounded-QA project must claim update-aware, citation-grounded, abstention-calibrated data construction rather than generic RAG distillation.",
  },
  {
    id: "genground_instructional_grounding",
    title: "Generate-then-Ground in Retrieval-Augmented Generation for Multi-hop Question Answering",
    venue_or_status: "ACL 2024",
    url: "https://aclanthology.org/2024.acl-long.397/",
    overlap_axes: ["multi_step_rag", "grounding_corrections", "instructional_distillation_to_smaller_models"],
    pressure: "high",
    implication: "Multi-step generate/ground behavior and smaller-model grounding distillation already exist. The project needs a stronger distinction around evolving private KB snapshots, inline citation contracts, and amortized post-training examples.",
  },
  {
    id: "radio_rationale_distillation",
    title: "Bridging Relevance and Reasoning: Rationale Distillation in Retrieval-Augmented Generation",
    venue_or_status: "ACL Findings 2025",
    url: "https://aclanthology.org/2025.findings-acl.220/",
    overlap_axes: ["rationale_distillation", "reranker_alignment", "support_document_selection"],
    pressure: "high",
    implication: "Evidence/rationale selection alone is crowded. The project should keep selector baselines as controls, not the main contribution.",
  },
  {
    id: "longcite_citation_sft",
    title: "LongCite: Enabling LLMs to Generate Fine-grained Citations in Long-Context QA",
    venue_or_status: "ACL Findings 2025",
    url: "https://aclanthology.org/2025.findings-acl.264/",
    overlap_axes: ["citation_generation", "synthetic_sft_data", "long_context_qa"],
    pressure: "very_high",
    implication: "Citation-supervised SFT data is not novel. The project must evaluate citation-grounded correctness under compact evidence packs, abstention, and evolving-KB update amortization.",
  },
  {
    id: "dynaquest_dynamic_qa",
    title: "DynaQuest: A Dynamic Question Answering Dataset Reflecting Real-World Knowledge Updates",
    venue_or_status: "ACL Findings 2025",
    url: "https://aclanthology.org/2025.findings-acl.1380/",
    overlap_axes: ["dynamic_qa", "knowledge_updates", "time_sensitive_questions"],
    pressure: "high",
    implication: "Dynamic QA datasets already cover real-world knowledge updates. The grounded-QA project should not claim dynamic QA itself; it should claim amortized grounded-research training/evaluation over evolving private/domain KBs.",
  },
  {
    id: "grace_grounded_response_abstention",
    title: "GRACE: Reinforcement Learning for Grounded Response and Abstention under Contextual Evidence",
    venue_or_status: "arXiv 2026",
    url: "https://arxiv.org/html/2601.04525v1",
    overlap_axes: ["grounded_response", "abstention", "evidence_sufficiency", "rl_training"],
    pressure: "very_high",
    implication: "Joint answer/abstain training under contextual evidence is now a direct neighbor. The project should position joint-action SFT/DPO as a data-construction and amortization study, not as the first joint grounding-abstention objective.",
  },
  {
    id: "writeback_rag_evidence_distillation",
    title: "Training the Knowledge Base through Evidence Distillation and Write-Back Enrichment",
    venue_or_status: "arXiv 2026",
    url: "https://arxiv.org/abs/2603.25737",
    overlap_axes: ["evidence_distillation", "offline_preprocessing", "knowledge_base_training", "rag_transfer"],
    pressure: "high",
    implication: "Offline evidence distillation into the corpus is a close amortization alternative. The project should compare model/scaffold distillation against KB write-back or explicitly scope it as a different amortization target.",
  },
  {
    id: "lit_ragbench_generator_capabilities",
    title: "LIT-RAGBench: Benchmarking Generator Capabilities of Large Language Models in Retrieval-Augmented Generation",
    venue_or_status: "arXiv 2026",
    url: "https://arxiv.org/html/2603.06198v1",
    overlap_axes: ["rag_benchmarking", "evidence_integration", "abstention", "long_context"],
    pressure: "medium",
    implication: "Generator benchmarking for RAG includes abstention and evidence integration. The project needs a stronger evaluation claim around update robustness, cost per grounded answer, and citation-support correctness.",
  },
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  search_date: "2026-06-26",
  search_scope: {
    queries: [
      "grounded QA distillation RAG small language model citations abstention evidence pack",
      "RAG distillation small language models citation grounded correctness abstention 2025 2026",
      "evolving knowledge base RAG distillation update private knowledge base grounded QA citations",
      "dataset distillation grounded question answering citations evidence abstention LLM 2025",
    ],
    source_policy: "Primary sources preferred: ACL Anthology, arXiv, OpenReview, and project repositories when available.",
  },
  entries: rows,
  synthesis: {
    current_novelty_hypothesis: "The defensible contribution is not generic RAG distillation, citation SFT, dynamic QA, or abstention training. It is a measured data-construction and evaluation recipe for amortizing expensive grounded research behavior over evolving private/domain KBs, preserving inline citation support and abstention calibration under update splits.",
    claim_to_avoid: [
      "First RAG-to-small-model distillation method.",
      "First citation-grounded QA SFT dataset.",
      "First dynamic QA benchmark.",
      "First joint grounded-answer and abstention objective.",
      "First evidence-distillation amortization method for RAG.",
    ],
    required_before_paper_claim: [
      "Run the bounded Qwen 3B joint-action smoke and evaluate grounded correctness on the held-out future window.",
      "Compare against a generic DRAG-like RAG distillation baseline or clearly justify why the available implementation is not comparable.",
      "Compare against a LongCite-style citation SFT framing by reporting citation support, not just citation syntax.",
      "Add a KB-update baseline inspired by WriteBack-RAG or state why model-side amortization is the target.",
      "Use a trusted dated/private KB snapshot rather than only arXiv-id-inferred temporal splits.",
    ],
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "Novelty watchlist construction used web/literature inspection only; no OpenAI API calls and no GPU jobs.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function renderReport(result) {
  const table = result.entries.map((row) => `| ${row.title} | ${row.venue_or_status} | ${row.pressure} | ${row.overlap_axes.join(", ")} | [source](${row.url}) |`).join("\n");
  const implications = result.entries.map((row) => `- ${row.id}: ${row.implication}`).join("\n");
  return `# Grounded QA Novelty Watchlist

Search date: ${result.search_date}

This is a live novelty-pressure artifact, not a complete related-work section.

## Close Neighbors

| Work | Venue/status | Pressure | Overlap axes | Source |
| --- | --- | --- | --- | --- |
${table}

## Implications

${implications}

## Current Novelty Hypothesis

${result.synthesis.current_novelty_hypothesis}

## Claims To Avoid

${result.synthesis.claim_to_avoid.map((item) => `- ${item}`).join("\n")}

## Required Before Paper Claim

${result.synthesis.required_before_paper_claim.map((item) => `- ${item}`).join("\n")}

## Budget

No OpenAI API calls, no GPU jobs, and no new spend.
`;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
