import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const evidenceMapRunId = args["evidence-map-run-id"] ?? "manuscript-evidence-map-2026-06-26-v1";
const runId = args["run-id"] ?? "manuscript-draft-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const evidence = await readResult(evidenceMapRunId);
const readiness = await readResult(evidence.readiness.gate_run_id);

const title = "Amortized Grounded QA over Evolving Domain Knowledge Bases";
const subtitle = "Draft skeleton generated from current artifacts; not submission-ready until the Qwen 3B joint-action result is complete";
const sections = buildSections(evidence);
const tables = buildTables(evidence);
const todos = buildTodos(evidence);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "manuscript_draft",
  title,
  subtitle,
  evidence_map_run_id: evidence.run_id,
  readiness_gate_run_id: readiness.run_id,
  paper_ready: false,
  readiness_summary: readiness.summary,
  sections: sections.map((section) => ({
    id: section.id,
    title: section.title,
    status: section.status,
    evidence: section.evidence,
  })),
  tables: tables.map((table) => ({
    id: table.id,
    title: table.title,
    status: table.status,
    evidence: table.evidence,
  })),
  submission_blockers: evidence.readiness.blockers,
  todos,
  blocked_claims: evidence.qwen3b_required_final_result.blocked_claims,
  allowed_claims_now: evidence.allowed_claims_now,
  claims_to_avoid_until_qwen3b: evidence.claims_to_avoid_until_qwen3b,
  budget: evidence.budget,
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This draft generator reads local artifacts only.",
  },
};

const manuscript = renderManuscript({ title, subtitle, evidence, sections, tables, todos });

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "manuscript.md"), manuscript);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function buildSections(evidence) {
  return [
    {
      id: "abstract",
      title: "Abstract",
      status: "blocked_for_final_numbers",
      evidence: [evidence.run_id],
      body: [
        "We study amortized grounded question answering over a domain knowledge base that changes over time. The task is to replace expensive multi-step retrieval-and-generation behavior with cheaper post-trained students or scaffolds while preserving citation-grounded correctness, abstention behavior, and auditable claim support.",
        "Current evidence supports a conservative scaffold result on a dated public QASPER/arXiv proxy: support-aware gating and deterministic claim checks improve judged correctness over direct mini-model repair at a coverage cost. The final trained Qwen 3B joint-action student result is not yet available, so this abstract must be finalized only after that run and grounded judge complete.",
      ],
    },
    {
      id: "introduction",
      title: "Introduction",
      status: "draftable",
      evidence: ["README framing", "D101", evidence.related_work_positioning.drag_like.run_id],
      body: [
        "Many domain QA systems can answer questions only by repeatedly retrieving evidence, asking a strong model to reason over it, and post-checking citations. That behavior is expensive when the same domain is queried repeatedly. The central question is whether the expensive behavior can be amortized into post-training data for a smaller model or a cheap scaffold without losing the correctness guarantee that every answer claim is supported by cited evidence.",
        "This paper frames the problem more narrowly than generic RAG or generic citation generation. The input contains a question, a compact retrieved evidence pack, and document metadata including dates. The output must include an answer or abstention, inline evidence citations, and a claim table suitable for verification.",
        "The current draft should claim a public dated-domain proxy, not a private enterprise KB proof. A private-KB claim remains future work unless a private/versioned corpus is added.",
      ],
    },
    {
      id: "task_protocol",
      title: "Task and Evolving-KB Protocol",
      status: "draftable_with_caveat",
      evidence: [
        evidence.dataset_and_temporal_claims.trusted_snapshot_run_id,
        evidence.dataset_and_temporal_claims.versioned_domain_kb_extension_candidate_run_id,
        evidence.dataset_and_temporal_claims.versioned_writeback_diagnostic_run_id,
        evidence.dataset_and_temporal_claims.versioned_kb_naturalness_audit_run_id,
        evidence.dataset_and_temporal_claims.versioned_kb_natural_questions_run_id,
        evidence.dataset_and_temporal_claims.versioned_kb_natural_question_eval_run_id,
      ],
      body: [
        `The first knowledge base is QASPER, a collection of NLP research papers with questions, answers, and evidence spans. The final holdout contains ${evidence.dataset_and_temporal_claims.final_holdout_examples} examples over ${evidence.dataset_and_temporal_claims.final_holdout_papers} papers.`,
        `The temporal protocol uses a trusted arXiv API snapshot for the final public proxy: ${evidence.dataset_and_temporal_claims.trusted_papers_with_dates}/${evidence.dataset_and_temporal_claims.trusted_papers_checked} future-holdout papers have trusted dates spanning ${evidence.dataset_and_temporal_claims.trusted_months.first} to ${evidence.dataset_and_temporal_claims.trusted_months.last}.`,
        "This is an evolving-domain benchmark proxy. The claim is not that the benchmark itself is private, but that the protocol isolates temporally later evidence packs and records date provenance.",
        `As a concrete private/domain-KB upgrade path, ${evidence.dataset_and_temporal_claims.versioned_domain_kb_extension_candidate_run_id} builds ${evidence.dataset_and_temporal_claims.versioned_domain_kb_candidate_examples} deterministic examples from repository-local git document snapshots, including stale-snapshot abstentions. ${evidence.dataset_and_temporal_claims.versioned_domain_kb_eval_run_id} shows the stale-snapshot failure mode directly: naive citation-copy over-answers stale train-snapshot questions, while a snapshot-aware prefix retriever handles the deterministic slice. ${evidence.dataset_and_temporal_claims.versioned_writeback_diagnostic_run_id} adds a small write-back memory diagnostic over the same snapshots. ${evidence.dataset_and_temporal_claims.versioned_kb_naturalness_audit_run_id} keeps the boundary explicit: the original prototype is a deterministic snapshot diagnostic with template questions and prefix leakage. ${evidence.dataset_and_temporal_claims.versioned_kb_natural_questions_run_id} then probes the natural-question upgrade path with one ledgered question-authoring call while preserving deterministic answers and citations. ${evidence.dataset_and_temporal_claims.versioned_kb_natural_question_eval_run_id} evaluates that natural-question packet: naive citation-copy still fails stale train-snapshot abstentions, while the lexical snapshot guard reaches ${pct(evidence.current_main_results.versioned_kb_natural_question_eval.lexical_retriever_snapshot_guard.overall_correct_rate)} overall correctness with one stable-question retrieval miss.`,
      ],
    },
    {
      id: "method",
      title: "Post-Training Data Construction",
      status: "draftable",
      evidence: ["support-contrast-prep-judge-support-direct-repair-0-320-to-321-389-v1", evidence.qwen3b_required_final_result.launch_plan_run_id],
      body: [
        "The data construction pipeline creates positive and negative supervision from compact evidence packs. Accepted examples include grounded answers with inline citations and abstentions when evidence is insufficient. Rejected examples capture unsupported answers and overclaims.",
        "The planned Qwen 3B joint-action packet combines SFT rows and preference pairs so the student learns both answer formatting and support-sensitive action selection. The generated runner validates the dataset, performs bounded SFT/DPO, evaluates the saved adapter, and writes judge-ready predictions.",
        `The amortization accounting is explicit rather than implicit: ${evidence.current_main_results.amortization_break_even.run_id} estimates $${evidence.current_main_results.amortization_break_even.planned_offline_investment_usd.toFixed(6)} of planned GPU plus judge spend and $${evidence.current_main_results.amortization_break_even.estimated_total_after_qwen_smoke_and_judge_usd.toFixed(6)} total tracked spend after the smoke, still under the $100 cap. This is an economics precondition only; the trained model must still pass support, coverage, and citation-grounding gates.`,
        `${evidence.current_main_results.distillation_loss_accounting.run_id} makes the preservation target explicit: Qwen 3B must preserve answer support, citation support/recall, abstention boundaries, update robustness, coverage, and amortized cost. Existing cheap controls preserve only pieces of that contract, so the final result should be reported as a preservation/loss tradeoff rather than a single headline score.`,
      ],
    },
    {
      id: "experiments",
      title: "Experiments",
      status: "partial_results_available",
      evidence: ["risk-gate-transfer-synthesis-240-389-v1", "claim-entailment-guard-validation-240-389-v1"],
      body: [
        "The current complete empirical result is a scaffold result, not a trained-student result. Direct mini-model repair reaches 71.8% judged correctness on the transfer windows; a balanced zero-call risk gate reaches 79.9%; adding a deterministic claim-entailment guard reaches 83.2% while answering fewer examples.",
        "These results show that support-aware data and guards can improve citation-grounded correctness, but they also expose the coverage tradeoff that a trained student is meant to address.",
        "The cost table separates online call count from offline data/model construction. Existing zero-call local controls are cheaper but not good enough; therefore the amortization claim is conditioned on the missing Qwen 3B judged result, not on citation syntax or local inference alone.",
        `The distillation-loss table records why: ${evidence.current_main_results.distillation_loss_accounting.preservation_rows.find((row) => row.id === "local_qwen05b_sft_answer_repeat2")?.id} preserves zero-call inference and citation format but loses answer support, while ${evidence.current_main_results.distillation_loss_accounting.preservation_rows.find((row) => row.id === "claim_entailment_guard")?.id} preserves support by losing coverage.`,
      ],
    },
    {
      id: "related_work",
      title: "Related Work Positioning",
      status: "draftable",
      evidence: [
        evidence.related_work_positioning.drag_like.run_id,
        evidence.related_work_positioning.longcite_style.run_id,
        evidence.related_work_positioning.writeback_scope.run_id,
        evidence.related_work_positioning.writeback_scope.diagnostic_run_id,
      ],
      body: [
        "DRAG-like RAG distillation is the closest generic RAG-to-small-model family, but the comparison must be made on support, abstention, citation validity, and temporal splits rather than answer utility alone.",
        "LongCite-style citation SFT motivates citation-format baselines, but the current artifacts show that citation syntax is not support: one local student reaches 97.5% inline citation compliance with only 5.0% answer support.",
        `Write-back memory is a close competing amortization family. On the versioned git-doc diagnostic, train-only write-back reaches ${pct(evidence.related_work_positioning.writeback_scope.train_only_overall_correct_rate)} overall correctness but cannot answer eval updates, train write-back plus live snapshot reaches ${pct(evidence.related_work_positioning.writeback_scope.train_plus_live_overall_correct_rate)}, and a leaky eval-written memory answers ${pct(evidence.related_work_positioning.writeback_scope.leaky_stale_answer_rate)} of stale-snapshot queries incorrectly. A full natural-benchmark WriteBack baseline remains scoped out until dated/private snapshots prevent final-window leakage into retrieval.`,
      ],
    },
    {
      id: "limitations",
      title: "Limitations",
      status: "draftable",
      evidence: evidence.manuscript_outline.find((row) => row.section === "Limitations and Threat Model")?.evidence ?? [],
      body: [
        `The current benchmark is a public dated arXiv/QASPER proxy rather than a private enterprise KB. The git-doc extension is not yet a full natural benchmark: ${evidence.current_main_results.versioned_kb_naturalness_gap.run_id} finds ${pct(evidence.current_main_results.versioned_kb_naturalness_gap.template_question_rate)} template question wording and ${pct(evidence.current_main_results.versioned_kb_naturalness_gap.prefix_leakage_rate)} quoted-prefix leakage in the deterministic prototype. The v2 natural-question probe reduces those to ${pct(evidence.current_main_results.versioned_kb_natural_question_probe.template_question_rate)} and ${pct(evidence.current_main_results.versioned_kb_natural_question_probe.prefix_leakage_rate)} at a cost of $${evidence.current_main_results.versioned_kb_natural_question_probe.run_cost_usd.toFixed(6)}, but it is still question-authoring evidence rather than trained-student evidence. The support judge is model-based: a blind second-pass check reaches ${pct(evidence.judge_reliability_constraints.overall_exact_agreement_rate)} exact agreement on deliberately hard rows, and ${evidence.judge_reliability_constraints.disagreement_taxonomy_run_id} finds ${pct(evidence.judge_reliability_constraints.disagreement_rate)} disagreements, mostly abstention-boundary reversals. The questionable-abstention bucket is unstable at ${pct(evidence.judge_reliability_constraints.questionable_abstention_exact_agreement_rate)} exact agreement. The strongest completed results improve correctness by suppressing risky answers, so answer coverage and abstention-boundary disagreements remain central metrics.`,
        "The final trained-student claim is blocked until remote GPU execution produces Qwen 3B predictions and the grounded-correctness judge evaluates them.",
      ],
    },
  ];
}

function buildTables(evidence) {
  const current = evidence.current_main_results;
  return [
    {
      id: "main_scaffold_results",
      title: "Current support-aware scaffold results on dated future windows",
      status: "complete",
      evidence: [current.zero_call_risk_gate_transfer.run_id, current.deterministic_claim_entailment_guard.run_id],
      rows: [
        ["Direct mini + citation repair", pct(current.deterministic_claim_entailment_guard.direct_correct_rate), pct(current.zero_call_risk_gate_transfer.direct_answer_support_rate), "117"],
        ["Balanced zero-call risk gate", pct(current.deterministic_claim_entailment_guard.gate_correct_rate), pct(current.zero_call_risk_gate_transfer.gate_answer_support_rate), "90"],
        ["Risk gate + deterministic claim-entailment guard", pct(current.deterministic_claim_entailment_guard.guard_correct_rate), pct(current.deterministic_claim_entailment_guard.guard_answer_support_rate), String(current.deterministic_claim_entailment_guard.guard_answered)],
      ],
    },
    {
      id: "related_work_baselines",
      title: "Related-work pressure points",
      status: "complete",
      evidence: [evidence.related_work_positioning.drag_like.run_id, evidence.related_work_positioning.longcite_style.run_id],
      rows: [
        ["DRAG-like direct mini RAG", pct(evidence.related_work_positioning.drag_like.closest_direct_correct_rate), "Generic RAG student baseline"],
        ["DRAG-like risk-gated scaffold", pct(evidence.related_work_positioning.drag_like.risk_gate_correct_rate), "Improves support by suppressing answers"],
        ["Citation syntax/support gap", pct(evidence.related_work_positioning.longcite_style.key_gap[1]?.syntax_minus_support), "Citation syntax can be far above support"],
      ],
    },
    {
      id: "qwen3b_todo",
      title: "Required trained-student result",
      status: "blocked",
      evidence: [evidence.qwen3b_required_final_result.remote_smoke_plan_run_id, evidence.qwen3b_required_final_result.post_smoke_pipeline_run_id, evidence.qwen3b_required_final_result.amortization_break_even_run_id, evidence.qwen3b_required_final_result.distillation_loss_accounting_run_id],
      rows: [
        ["Base model", evidence.qwen3b_required_final_result.base_model],
        ["Pipeline status", evidence.qwen3b_required_final_result.current_pipeline_status],
        ["Planned offline investment", `$${evidence.qwen3b_required_final_result.planned_offline_investment_usd.toFixed(4)}`],
        ["Loss-accounting contract", evidence.qwen3b_required_final_result.distillation_loss_accounting_run_id],
        ["Estimated total after smoke + judge", `$${evidence.qwen3b_required_final_result.estimated_total_after_smoke_and_judge_usd.toFixed(4)}`],
      ],
    },
  ];
}

function buildTodos(evidence) {
  return [
    {
      id: "run_qwen3b_smoke",
      status: "blocked_by_remote_auth_or_credits",
      command: evidence.qwen3b_required_final_result.unblock_commands.smoke,
    },
    {
      id: "run_post_smoke_pipeline_default",
      status: "waiting_for_predictions",
      command: evidence.qwen3b_required_final_result.unblock_commands.post_smoke_pipeline,
    },
    {
      id: "run_paid_judge",
      status: "waiting_for_integrity_and_dry_judge",
      command: evidence.qwen3b_required_final_result.unblock_commands.paid_pipeline,
    },
    {
      id: "refresh_novelty_audit_before_submission",
      status: "required_before_completion",
      command: "Refresh web/paper search at final submission time and update novelty-watchlist artifacts.",
    },
  ];
}

function renderManuscript({ title, subtitle, evidence, sections, tables, todos }) {
  return `# ${title}

_${subtitle}_

## Submission Status

This draft is **not submission-ready**. The current readiness gate is \`${evidence.readiness.status}\` with ${evidence.readiness.passed_requirements}/12 requirements passing. The missing blockers are ${evidence.readiness.blockers.map((item) => `\`${item}\``).join(" and ")}.

## Abstract

${sections.find((section) => section.id === "abstract").body.join("\n\n")}

${sections.filter((section) => section.id !== "abstract").map((section) => renderSection(section)).join("\n\n")}

## Result Tables

${tables.map(renderTable).join("\n\n")}

## Submission Blockers

${todos.map((todo) => `- \`${todo.id}\` (${todo.status}): ${todo.command}`).join("\n")}

## Claims Allowed Now

${evidence.allowed_claims_now.map((claim) => `- ${claim}`).join("\n")}

## Claims To Avoid Until Qwen 3B Completes

${evidence.claims_to_avoid_until_qwen3b.map((claim) => `- ${claim}`).join("\n")}
`;
}

function renderSection(section) {
  return `## ${section.title}

Status: \`${section.status}\`

${section.body.join("\n\n")}

Evidence: ${section.evidence.map((item) => `\`${item}\``).join(", ")}`;
}

function renderTable(table) {
  if (table.id === "main_scaffold_results") {
    return `### ${table.title}

Status: \`${table.status}\`

| System | Overall judged correctness | Answer support | Answered |
| --- | ---: | ---: | ---: |
${table.rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}`;
  }
  if (table.id === "related_work_baselines") {
    return `### ${table.title}

Status: \`${table.status}\`

| Baseline / gap | Metric | Note |
| --- | ---: | --- |
${table.rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}`;
  }
  return `### ${table.title}

Status: \`${table.status}\`

| Item | Value |
| --- | --- |
${table.rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}`;
}

async function readResult(runId) {
  return JSON.parse(await fs.readFile(path.join(runDir, runId, "result.json"), "utf8"));
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

function renderReport(result) {
  return `# Manuscript Draft Artifact

Generated: ${result.generated_at}

Status: \`not_submission_ready\`

Sections: ${result.sections.length}

Tables: ${result.tables.length}

Submission blockers:
${result.todos.map((todo) => `- ${todo.id}: ${todo.status}`).join("\n")}

This draft makes no OpenAI calls, launches no GPU jobs, and records no spend.
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
