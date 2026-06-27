import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "faithful-context-qa-comparison-2026-06-27-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const novelty = await readResult("novelty-watchlist-2026-06-26-v1");
const longcite = await readResult("longcite-style-citation-sft-comparison-2026-06-26-v1");
const pareto = await readResult("cost-coverage-support-pareto-2026-06-26-v1");
const lossAccounting = await readResult("distillation-loss-accounting-2026-06-27-v1");
const modelScale = await readResult("model-scale-adequacy-audit-2026-06-26-v1");

const occ = novelty.entries.find((row) => row.id === "occ_rag_compact_faithful_context_qa");
const direct = find(pareto.systems, "direct_mini_repair");
const guard = find(pareto.systems, "claim_entailment_guard");
const span = find(pareto.systems, "zero_call_span_distilled_scaffold");
const qwen05b = find(pareto.systems, "local_qwen05b_sft_answer_repeat2");
const qwen3bRepair = find(modelScale.systems, "local_qwen3b_base_citation_repair");

const dimensions = [
  dimension("compact_context_qa_surface", "Does the system answer from a compact evidence pack?", [
    score("direct_mini_repair", true, "Direct compact-evidence QA baseline."),
    score("claim_entailment_guard", true, "Same compact evidence surface plus support-aware guard."),
    score("zero_call_span_distilled_scaffold", true, "Local scaffold selects from compact evidence."),
    score("local_qwen05b_sft_answer_repeat2", true, "Tiny SFT model uses compact evidence prompts."),
    score("local_qwen3b_base_citation_repair", true, "Local Qwen 3B base-control uses joint-action compact prompts but is untrained."),
  ]),
  dimension("faithfulness_support", "Does answer support survive judging?", [
    metricScore("direct_mini_repair", direct.answer_support_rate, "Moderate support but many unsupported answers."),
    metricScore("claim_entailment_guard", guard.answer_support_rate, "Best current support-first zero-extra-call point, with coverage loss."),
    metricScore("zero_call_span_distilled_scaffold", span.answer_support_rate, "Weak support despite high answer rate."),
    metricScore("local_qwen05b_sft_answer_repeat2", qwen05b.answer_support_rate, "Citation-format learning without support preservation."),
    score("local_qwen3b_base_citation_repair", false, "No paid support judge; syntax repair is not faithfulness evidence."),
  ]),
  dimension("citation_grounding", "Does citation evidence remain meaningful rather than just syntactically present?", [
    metricScore("direct_mini_repair", direct.citation_recall, "Reference citation recall is incomplete but non-trivial."),
    metricScore("claim_entailment_guard", guard.citation_recall, "Support improves while citation recall drops with coverage."),
    metricScore("zero_call_span_distilled_scaffold", span.citation_recall, "Span citation recall is not enough when support is weak."),
    metricScore("local_qwen05b_sft_answer_repeat2", qwen05b.citation_recall, "Low citation recall despite high inline citation syntax."),
    score("local_qwen3b_base_citation_repair", false, "Citation repair lifts inline syntax to 100% without changing cited evidence ids or support."),
  ]),
  dimension("safe_abstention", "Does the system abstain when evidence is insufficient?", [
    metricScore("direct_mini_repair", direct.abstention_support_rate, "Strong abstention support where it abstains."),
    metricScore("claim_entailment_guard", guard.abstention_support_rate, "Strong but not perfect abstention support."),
    metricScore("zero_call_span_distilled_scaffold", span.abstention_support_rate, "Strong abstentions but weak answered support."),
    metricScore("local_qwen05b_sft_answer_repeat2", qwen05b.abstention_support_rate, "Mostly good abstentions, weak answered support."),
    score("local_qwen3b_base_citation_repair", false, "Unjudged on abstention support; local syntax repair cannot establish safe abstention."),
  ]),
  dimension("evolving_kb_update_holdout", "Does the comparison test dated/update-heldout KB behavior?", [
    score("current_project_protocol", true, "Dated QASPER/arXiv proxy plus versioned git-doc diagnostic exist."),
    score("occ_style_baseline_needed", false, "A true compact faithful-context-QA baseline would need to run on the same dated/versioned splits."),
  ]),
  dimension("amortized_inference_cost", "Does cheaper inference avoid per-query LLM verification?", [
    metricScore("direct_mini_repair", 1 - Number(direct.online_openai_calls_per_query), "Still uses one online OpenAI call/query."),
    metricScore("claim_entailment_guard", 1 - Number(guard.online_openai_calls_per_query), "Adds no extra verifier call but still wraps an API student."),
    metricScore("zero_call_span_distilled_scaffold", 1, "Zero online OpenAI calls but quality is weak."),
    metricScore("local_qwen05b_sft_answer_repeat2", 1, "Zero online OpenAI calls but support is weak."),
    metricScore("planned_qwen3b_joint_action", 1, "Target is zero-call deployed inference after bounded offline GPU+judge spend."),
  ]),
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  comparison_type: "compact_faithful_context_qa_positioning",
  related_work_framing: {
    close_neighbor_id: occ?.id ?? "occ_rag_compact_faithful_context_qa",
    close_neighbor_title: occ?.title ?? "OCC-RAG: Optimal Cognitive Core for Faithful Question Answering",
    close_neighbor_url: occ?.url ?? "https://arxiv.org/html/2606.00683v1",
    overlap: "Compact models for faithful context QA with source citations and safe abstention are a close final-system surface.",
    distinction: "This project must be evaluated over evolving/update-heldout KB states with explicit answer support, citation support/recall, abstention boundaries, coverage, and amortized cost. Citation syntax or compact context QA alone is not novel enough.",
  },
  dimensions,
  current_project_evidence: {
    direct_mini_repair: pick(direct),
    claim_entailment_guard: pick(guard),
    zero_call_span_distilled_scaffold: pick(span),
    local_qwen05b_sft_answer_repeat2: pick(qwen05b),
    local_qwen3b_base_citation_repair: {
      answer_rate: qwen3bRepair.answer_rate,
      inline_citation_rate: qwen3bRepair.inline_citation_rate,
      verdict: qwen3bRepair.verdict,
    },
    syntax_support_gap_run_id: longcite.run_id,
    distillation_loss_accounting_run_id: lossAccounting.run_id,
  },
  synthesis: {
    headline: "Compact faithful-context QA is a close baseline family, but current evidence says citation syntax and safe-looking abstention are not enough.",
    claim_boundary: [
      "Do not claim the project is the first compact faithful-context-QA model.",
      "Do not claim citation syntax or source-citation formatting as grounded correctness.",
      "Claim only the narrower update-heldout amortization question after Qwen 3B is judged.",
    ],
    true_baseline_needed: [
      "Run an OCC-RAG-like compact faithful-context-QA model on the same compact evidence packs and final dated/versioned KB windows.",
      "Judge it with the same answer support, abstention support, citation recall, and coverage metrics.",
      "Report cost per query and whether any per-query verifier/teacher is used.",
      "Compare against the Qwen joint-action row after the trained Qwen smoke exists.",
    ],
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This comparison reads existing local artifacts and primary-source URLs from the novelty watchlist only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function dimension(id, question, rows) {
  return { id, question, rows };
}

function score(system_id, supported, evidence) {
  return { system_id, supported, metric: null, evidence };
}

function metricScore(system_id, metric, evidence) {
  return { system_id, supported: Number.isFinite(Number(metric)) ? Number(metric) >= 0.7 : false, metric: Number.isFinite(Number(metric)) ? Number(metric) : null, evidence };
}

function pick(row) {
  return {
    answer_rate: row.answer_rate,
    answer_support_rate: row.answer_support_rate,
    abstention_support_rate: row.abstention_support_rate,
    overall_judged_correct_rate: row.overall_judged_correct_rate,
    citation_recall: row.citation_recall,
    online_openai_calls_per_query: row.online_openai_calls_per_query,
  };
}

function find(rows, id) {
  return rows.find((row) => row.id === id) ?? {};
}

function renderReport(result) {
  return `# Compact Faithful Context QA Comparison

Generated: ${result.generated_at}

Close neighbor: [${result.related_work_framing.close_neighbor_title}](${result.related_work_framing.close_neighbor_url})

## Framing

- Overlap: ${result.related_work_framing.overlap}
- Distinction: ${result.related_work_framing.distinction}

## Dimensions

${result.dimensions.map((dimension) => `### ${dimension.id}

${dimension.question}

${dimension.rows.map((row) => `- ${row.system_id}: ${row.metric == null ? "" : `${pct(row.metric)}; `}${row.evidence}`).join("\n")}`).join("\n\n")}

## Claim Boundary

${result.synthesis.claim_boundary.map((item) => `- ${item}`).join("\n")}

## True Baseline Needed

${result.synthesis.true_baseline_needed.map((item) => `- ${item}`).join("\n")}

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
