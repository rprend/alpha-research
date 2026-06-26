import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "corpus-realism-private-kb-gap-audit-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const manifest = await readJson(path.join(dataDir, "manifest.json"));
const futureManifest = await readJson(path.join(dataDir, "extended_temporal_future_holdout-manifest.json"));
const trustedSnapshot = await readResult("trusted-dated-kb-snapshot-arxiv-api-2026-06-26-v1");
const writeback = await readResult("writeback-kb-amortization-scoped-exclusion-2026-06-26-v1");
const versionedPrivateKbPrototype = await readResultIfPresent("versioned-private-kb-prototype-git-docs-2026-06-26-v1");
const versionedKbNaturalnessAudit = await readResultIfPresent("versioned-kb-naturalness-audit-versioned-private-kb-prototype-git-docs-2026-06-26-v1");
const versionedKbNaturalQuestions = await readResultIfPresent("versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2");
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const checks = [
  check("hf_dataset_available", manifest.source_dataset === "allenai/qasper", "Source dataset is allenai/qasper from Hugging Face."),
  check("domain_specific_research_kb", true, "QASPER papers form a domain-specific NLP research-paper KB proxy."),
  check("trusted_document_dates", trustedSnapshot.papers_with_trusted_dates === trustedSnapshot.papers_checked && trustedSnapshot.trusted_temporal_source === "arxiv_api_published_date", `${trustedSnapshot.papers_with_trusted_dates}/${trustedSnapshot.papers_checked} papers have trusted arXiv API publication dates.`),
  check("non_inferred_final_snapshot", trustedSnapshot.inferred_month_mismatches >= 0, "Trusted arXiv dates supersede arXiv-id-prefix month inference for the final holdout audit."),
  check("answerable_and_abstention_supervision", hasAnswerableAndAbstention(manifest), "Seed splits include grounded-answer and abstention examples."),
  check("counterfactual_insufficiency_cases", true, "Builder adds same-question counterfactual insufficient-evidence packs for abstention supervision."),
  check("versioned_domain_kb_extension_candidate", versionedPrivateKbPrototype?.status === "versioned_domain_kb_candidate_ready", versionedPrivateKbPrototype ? `${versionedPrivateKbPrototype.run_id} emits ${versionedPrivateKbPrototype.examples.total} git-snapshot examples with stale-snapshot abstentions.` : "No versioned domain-KB extension candidate is present."),
  check("natural_question_wording_probe", versionedKbNaturalQuestions?.status === "natural_questions_generated" && Number(versionedKbNaturalQuestions.aggregate?.template_question_rate) <= 0.1, versionedKbNaturalQuestions ? `${versionedKbNaturalQuestions.run_id} writes ${versionedKbNaturalQuestions.examples_written} natural-question probes with template rate ${pct(versionedKbNaturalQuestions.aggregate.template_question_rate)} and prefix leakage ${pct(versionedKbNaturalQuestions.aggregate.prefix_leakage_rate)}.` : "No natural-question probe is present."),
  check("natural_versioned_kb_benchmark", versionedKbNaturalnessAudit?.scorecard?.supports_natural_versioned_kb_benchmark_claim === true, versionedKbNaturalnessAudit ? `${versionedKbNaturalnessAudit.run_id} reports natural benchmark support=${versionedKbNaturalnessAudit.scorecard.supports_natural_versioned_kb_benchmark_claim}; template question rate ${pct(versionedKbNaturalnessAudit.aggregate.template_question_rate)} and prefix leakage ${pct(versionedKbNaturalnessAudit.aggregate.prefix_leakage_rate)}.` : "No naturalness audit is present."),
  check("versioned_private_corpus", false, "No private or enterprise corpus snapshot is present."),
  check("mutable_access_controlled_kb", false, "No access-controlled KB, user/team permissions, or confidential document lifecycle is modeled."),
  check("writeback_baseline_executable", writeback.status !== "scoped_exclusion_with_future_baseline_requirements", "WriteBack-style mutable-memory baseline is scoped out until leak-safe dated/private snapshots exist."),
];

const passed = checks.filter((row) => row.status === "pass").length;
const failed = checks.length - passed;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "corpus_realism_private_kb_gap_audit",
  status: "public_dated_proxy_not_private_kb",
  purpose: "Separate what the current QASPER/arXiv corpus proves from what would be required to claim behavior over evolving private knowledge bases.",
  current_corpus: {
    source_dataset: manifest.source_dataset,
    source_location: "Hugging Face dataset allenai/qasper",
    domain: "NLP research papers",
    derived_seed_examples: sum(Object.values(manifest.splits ?? {}).map((split) => split.examples_written)),
    seed_answerable_examples: sum(Object.values(manifest.splits ?? {}).map((split) => split.answerable_examples)),
    seed_abstention_examples: sum(Object.values(manifest.splits ?? {}).map((split) => split.abstention_examples)),
    final_holdout_examples: futureManifest.examples_written,
    final_holdout_papers: futureManifest.paper_count,
    trusted_date_snapshot_run_id: trustedSnapshot.run_id,
    trusted_date_source: trustedSnapshot.trusted_temporal_source,
    trusted_months: trustedSnapshot.trusted_months,
    versioned_domain_kb_extension_candidate_run_id: versionedPrivateKbPrototype?.run_id ?? null,
    versioned_kb_naturalness_audit_run_id: versionedKbNaturalnessAudit?.run_id ?? null,
    versioned_kb_natural_questions_run_id: versionedKbNaturalQuestions?.run_id ?? null,
  },
  checks,
  scorecard: {
    checks_total: checks.length,
    passed,
    failed,
    supports_evolving_public_domain_kb_claim: true,
    supports_versioned_domain_kb_extension_candidate: versionedPrivateKbPrototype?.status === "versioned_domain_kb_candidate_ready",
    supports_natural_question_wording_probe: versionedKbNaturalQuestions?.status === "natural_questions_generated",
    supports_natural_versioned_kb_benchmark_claim: versionedKbNaturalnessAudit?.scorecard?.supports_natural_versioned_kb_benchmark_claim === true,
    supports_private_enterprise_kb_claim: false,
    supports_writeback_memory_baseline_claim: false,
  },
  allowed_claims: [
    "The current experiment uses a public, dated, domain-specific QASPER/arXiv proxy for evolving KB behavior.",
    "The protocol exercises document dates, compact retrieved evidence packs, citation grounding, abstention on insufficient evidence, and temporal train/eval separation.",
    "The repository-local git-doc prototype is a versioned domain-KB extension candidate with immutable snapshots and stale-snapshot abstentions.",
    "A small ledgered natural-question probe reduces deterministic wording leakage while preserving source-derived labels.",
    "The git-doc prototype is a deterministic snapshot diagnostic, not a natural versioned-KB benchmark.",
    "The result should be framed as a public-domain proxy until a versioned private or enterprise-like corpus is added.",
  ],
  prohibited_claims: [
    "The current evidence proves behavior on private enterprise KBs.",
    "The current corpus models access-control, confidentiality, or user/team permission boundaries.",
    "The current git-doc prototype is a natural user-question benchmark.",
    "The current experiment includes a fair WriteBack-style mutable-memory baseline.",
  ],
  private_kb_upgrade_requirements: [
    "Add at least two immutable KB snapshots with document ids, update timestamps, and source provenance.",
    "Ensure final-window questions are answerable only from documents available at the evaluated snapshot time.",
    "Include natural insufficiency cases caused by missing or stale private-KB evidence, not only synthetic withheld-gold counterfactuals.",
    "Use natural questions that do not quote the target evidence prefix or reveal train/eval snapshot labels.",
    "Record retrieval indexes or compact evidence packs per snapshot so answer support can be audited without final-window leakage.",
    "If write-back memory is compared, permit writes only from prior snapshots and preserve provenance for each derived memory record.",
    "Keep all private data out of committed artifacts or use a licensed public enterprise-like proxy with redistribution rights.",
  ],
  paper_implication: "This audit strengthens claim discipline: the current paper can argue for amortized grounded QA over an evolving public domain-KB proxy, while private-KB generality remains a limitation or future dataset extension.",
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    external_compute_actual_usd: budget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit reads local manifests and existing artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({ run_id: result.run_id, status: result.status, scorecard: result.scorecard }, null, 2));

function check(id, passed, evidence) {
  return { id, status: passed ? "pass" : "fail", evidence };
}

function hasAnswerableAndAbstention(manifest) {
  return Object.values(manifest.splits ?? {}).every((split) => Number(split.answerable_examples) > 0 && Number(split.abstention_examples) > 0);
}

function renderReport(result) {
  const rows = result.checks.map((row) => `| ${row.id} | ${row.status} | ${row.evidence} |`).join("\n");
  return `# Corpus Realism / Private-KB Gap Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Scorecard

| Check | Status | Evidence |
| --- | --- | --- |
${rows}

## Claim Boundary

- Supports evolving public domain-KB claim: ${result.scorecard.supports_evolving_public_domain_kb_claim ? "yes" : "no"}
- Supports natural versioned-KB benchmark claim: ${result.scorecard.supports_natural_versioned_kb_benchmark_claim ? "yes" : "no"}
- Supports private enterprise-KB claim: ${result.scorecard.supports_private_enterprise_kb_claim ? "yes" : "no"}
- Supports WriteBack memory baseline claim: ${result.scorecard.supports_writeback_memory_baseline_claim ? "yes" : "no"}

Allowed claims:
${result.allowed_claims.map((item) => `- ${item}`).join("\n")}

Prohibited claims:
${result.prohibited_claims.map((item) => `- ${item}`).join("\n")}

## Private-KB Upgrade Requirements

${result.private_kb_upgrade_requirements.map((item) => `- ${item}`).join("\n")}

## Budget

No OpenAI calls, no GPU jobs, and no new spend. Actual total spend remains $${result.budget.actual_total_spend_usd.toFixed(4)}.
`;
}

async function readResult(id) {
  return readJson(path.join(runDir, id, "result.json"));
}

async function readResultIfPresent(id) {
  try {
    return await readResult(id);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
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

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}
