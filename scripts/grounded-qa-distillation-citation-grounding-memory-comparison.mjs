import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "citation-grounding-memory-comparison-2026-06-27-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const novelty = await readResult("novelty-watchlist-2026-06-26-v1");
const longcite = await readResult("longcite-style-citation-sft-comparison-2026-06-26-v1");
const faithfulContextQa = await readResult("faithful-context-qa-comparison-2026-06-27-v1");
const writeback = await readResult("writeback-kb-amortization-scoped-exclusion-2026-06-26-v1");
const versionedWriteback = await readResult("versioned-kb-writeback-diagnostic-versioned-private-kb-prototype-git-docs-2026-06-26-v1");
const versionedKbEval = await readResult("versioned-kb-natural-question-eval-versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2");
const modelScale = await readResult("model-scale-adequacy-audit-2026-06-26-v1");
const lossAccounting = await readResult("distillation-loss-accounting-2026-06-27-v1");

const neighbors = ["citation_enforced_fiscal_rag", "legal_citation_grounding_metric", "fd_rag_federated_compact_qa_memories"]
  .map((id) => novelty.entries.find((row) => row.id === id))
  .filter(Boolean);

const qwen3bRepair = modelScale.systems.find((row) => row.id === "local_qwen3b_base_citation_repair") ?? {};
const qwen05bLoss = lossAccounting.preservation_rows.find((row) => row.id === "local_qwen05b_sft_answer_repeat2") ?? {};
const directLoss = lossAccounting.preservation_rows.find((row) => row.id === "direct_mini_repair") ?? {};
const claimGuardLoss = lossAccounting.preservation_rows.find((row) => row.id === "claim_entailment_guard") ?? {};
const naturalCopy = versionedKbEval.systems.find((row) => row.id === "copy_first_evidence") ?? {};
const naturalLexical = versionedKbEval.systems.find((row) => row.id === "lexical_retriever_snapshot_guard") ?? {};
const writebackTrainOnly = versionedWriteback.systems.find((row) => row.id === "leak_safe_train_writeback_only") ?? {};
const writebackTrainLive = versionedWriteback.systems.find((row) => row.id === "leak_safe_train_writeback_plus_live_snapshot") ?? {};

const dimensions = [
  dimension("citation_existence", "Can cited source ids be made syntactically/existentially valid?", [
    row("citation_repaired_qwen3b_base", true, qwen3bRepair.inline_citation_rate, "Deterministic citation repair reaches perfect inline citation syntax on the local Qwen 3B control."),
    row("local_qwen05b_sft_answer_repeat2", true, qwen05bLoss.inline_citation_rate ?? null, "Tiny SFT preserves citation format but not support."),
    row("longcite_style_comparison", true, null, `${longcite.run_id} shows citation-SFT framing is necessary but insufficient.`),
  ]),
  dimension("citation_support_relevance", "Are claims supported by the cited evidence, not just cited?", [
    row("direct_mini_repair", metricPass(directLoss.answer_support_rate), directLoss.answer_support_rate, "Direct compact-RAG answers have meaningful but incomplete answer support."),
    row("claim_entailment_guard", metricPass(claimGuardLoss.answer_support_rate), claimGuardLoss.answer_support_rate, "The current support-first guard improves support by losing coverage."),
    row("citation_repaired_qwen3b_base", false, null, "Syntax repair changes citation formatting but provides no judged support evidence."),
  ]),
  dimension("temporal_validity", "Does the system respect dated/update-heldout KB state?", [
    row("copy_first_evidence_versioned_natural_questions", false, naturalCopy.by_type?.stale_snapshot_abstention?.overall_correct_rate, "A naive cited-answer baseline fails stale-snapshot abstentions despite inline citation syntax."),
    row("lexical_retriever_snapshot_guard", true, naturalLexical.by_type?.stale_snapshot_abstention?.overall_correct_rate, "A simple snapshot-aware retriever solves the deterministic stale-snapshot diagnostic but is not a trained student."),
    row("legal_citation_grounding_neighbor", false, null, "Legal citation grounding makes temporal validity a first-class citation metric; this project must report analogous update validity instead of syntax alone."),
  ]),
  dimension("memory_side_amortization", "Could the same economics be explained by compact memory or write-back instead of a distilled model/scaffold?", [
    row("leak_safe_train_writeback_only", false, writebackTrainOnly.by_type?.eval_update_grounded_answer?.overall_correct_rate, "Train-only write-back cannot answer eval updates on the versioned diagnostic."),
    row("leak_safe_train_writeback_plus_live_snapshot", true, writebackTrainLive.overall_correct_rate, "Live snapshot retrieval plus train write-back can solve the toy diagnostic, so memory-side amortization remains a real baseline family."),
    row("fd_rag_compact_qa_memories_neighbor", false, null, "FD-RAG-style compact QA memories are a close memory-side amortization neighbor that needs comparison or explicit scoping."),
  ]),
  dimension("model_scaffold_amortization_target", "What is the paper target if citation grounding and compact memory already exist?", [
    row("current_target", false, null, "The target remains unproven until trained Qwen 3B predictions and paid grounded judging exist."),
    row("faithful_context_qa_positioning", true, null, `${faithfulContextQa.run_id} scopes compact faithful-context QA as a close final-system baseline.`),
    row("writeback_scope", true, null, `${writeback.run_id} scopes memory-side write-back as a competing amortization route, not the current claim.`),
  ]),
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  comparison_type: "citation_grounding_and_memory_amortization_positioning",
  related_work_framing: {
    neighbors: neighbors.map((paper) => ({
      id: paper.id,
      title: paper.title,
      url: paper.url,
      pressure: paper.pressure,
      overlap_axes: paper.overlap_axes,
    })),
    overlap: "Citation-enforced domain RAG, citation-grounding metrics, and compact QA memories overlap with the project's citation and amortization story.",
    distinction: "The project must claim only update-heldout model/scaffold-side amortization from expensive grounded behavior, with citation existence, support/relevance, temporal validity, abstention support, coverage, and cost reported together.",
  },
  dimensions,
  current_project_evidence: {
    syntax_support_gap_run_id: longcite.run_id,
    faithful_context_qa_run_id: faithfulContextQa.run_id,
    writeback_scope_run_id: writeback.run_id,
    versioned_writeback_diagnostic_run_id: versionedWriteback.run_id,
    versioned_natural_question_eval_run_id: versionedKbEval.run_id,
    loss_accounting_run_id: lossAccounting.run_id,
  },
  synthesis: {
    headline: "Citation grounding and compact memory are close enough that the paper must separate citation syntax, citation support, temporal validity, and amortization target.",
    claim_boundary: [
      "Do not claim citation-enforced domain RAG as new.",
      "Do not claim citation grounding or citation-hallucination detection as new.",
      "Do not claim compact-memory or federated RAG amortization as the contribution.",
      "Claim model/scaffold-side amortization only after the trained Qwen 3B row passes support, coverage, temporal/update, and cost gates.",
    ],
    true_baseline_or_scope_needed: [
      "Report citation existence, citation support/relevance, and temporal/update validity separately.",
      "Compare against a compact-memory/write-back baseline on the final update-heldout window, or explicitly scope it as memory-side amortization with leakage risks.",
      "For any legal/fiscal citation-grounding comparison, explain domain-graph availability differences instead of implying direct comparability.",
      "After Qwen 3B smoke, add the trained row to this comparison and the distillation-loss accounting table.",
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
console.log(JSON.stringify(result, null, 2));

function dimension(id, question, rows) {
  return { id, question, rows };
}

function row(system_id, supported, metric, evidence) {
  const normalizedMetric = metric == null ? null : metric;
  return {
    system_id,
    supported,
    metric: Number.isFinite(Number(normalizedMetric)) ? Number(normalizedMetric) : null,
    evidence,
  };
}

function metricPass(metric) {
  return Number.isFinite(Number(metric)) && Number(metric) >= 0.7;
}

function renderReport(result) {
  return `# Citation Grounding And Compact Memory Comparison

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

## True Baseline Or Scope Needed

${result.synthesis.true_baseline_or_scope_needed.map((item) => `- ${item}`).join("\n")}

No OpenAI calls, GPU jobs, or new spend were made for this artifact.
`;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
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
