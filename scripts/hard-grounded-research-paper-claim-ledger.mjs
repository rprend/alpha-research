import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const claimLedgerJsonPath = join(generatedDir, 'paper-claim-ledger.json')
const claimLedgerMarkdownPath = join(experimentDir, 'PAPER_CLAIM_LEDGER.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  analysisPlan: join(generatedDir, 'analysis-plan.json'),
  noveltyAudit: join(generatedDir, 'novelty-audit.json'),
  noveltyEvidence: join(generatedDir, 'novelty-evidence.json'),
  corpusAudit: join(generatedDir, 'corpus-audit.json'),
  sourceDiversityPlan: join(generatedDir, 'source-diversity-plan.json'),
  sourceAcquisitionFetchedRows: join(generatedDir, 'source-acquisition-fetched-rows.json'),
  reviewProgress: join(generatedDir, 'review-progress.json'),
  annotationQualityControl: join(generatedDir, 'annotation-quality-control.json'),
  modelRunIndex: join(generatedDir, 'model-run-index.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value)
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function check(releaseGate, id) {
  return releaseGate.checks.find((entry) => entry.id === id) || { id, passed: false, detail: 'missing' }
}

function buildClaim({ id, claim, status, evidence, blocked_by = [], required_before_submission = [] }) {
  return {
    id,
    claim,
    status,
    completion_claim_allowed: status === 'allowed',
    evidence,
    blocked_by,
    required_before_submission,
  }
}

function buildLedger({
  spec,
  releaseGate,
  analysisPlan,
  noveltyAudit,
  noveltyEvidence,
  corpusAudit,
  sourceDiversityPlan,
  sourceAcquisitionFetchedRows,
  reviewProgress,
  annotationQualityControl,
  modelRunIndex,
  baselineAnalysis,
}) {
  const failedIds = new Set(releaseGate.checks.filter((entry) => !entry.passed).map((entry) => entry.id))
  const derivedItemsCurrent = analysisPlan.summary?.hf_derived_items_current || 0
  const derivedItemsTarget = analysisPlan.summary?.hf_derived_items_target || 0
  const noveltyFinal = check(releaseGate, 'novelty_audit_final')
  const categoryScale = check(releaseGate, 'category_scale_ready')
  const derivedLabels = check(releaseGate, 'hf_derived_label_suite_ready')

  const claims = [
    buildClaim({
      id: 'taxonomy_scope_claim',
      claim: `The benchmark operationalizes ${spec.categories.length} hard-grounded research categories beyond simple fact lookup.`,
      status: check(releaseGate, 'construct_map_ready').passed ? 'allowed' : 'blocked',
      evidence: ['generated/construct-map.json', 'benchmark-spec.json', check(releaseGate, 'construct_map_ready').detail],
      blocked_by: check(releaseGate, 'construct_map_ready').passed ? [] : ['construct_map_ready'],
    }),
    buildClaim({
      id: 'hf_grounding_claim',
      claim: `The benchmark is grounded in Hugging Face datasets and fetched source rows rather than only hand-written toy examples.`,
      status: check(releaseGate, 'source_acquisition_fetch_full_ready').passed ? 'allowed' : 'blocked',
      evidence: [
        `${corpusAudit.summary.source_dataset_count} source datasets`,
        `${sourceAcquisitionFetchedRows.summary.distinct_source_rows} fetched acquisition source rows`,
        check(releaseGate, 'source_acquisition_fetch_full_ready').detail,
      ],
      blocked_by: check(releaseGate, 'source_acquisition_fetch_full_ready').passed ? [] : ['source_acquisition_fetch_full_ready'],
    }),
    buildClaim({
      id: 'large_corpus_design_claim',
      claim: 'The current artifacts define a large-corpus source-diversity target and executable acquisition substrate.',
      status: check(releaseGate, 'source_acquisition_review_preflight_report_ready').passed ? 'diagnostic_only' : 'blocked',
      evidence: [
        `${sourceDiversityPlan.summary.current_distinct_source_rows}/${sourceDiversityPlan.summary.target_distinct_source_rows_total} target source rows before acquisition`,
        check(releaseGate, 'source_acquisition_review_preflight_report_ready').detail,
      ],
      blocked_by: ['source acquisition reviews are not complete'],
      required_before_submission: ['complete source-acquisition review preflight', 'merge/adjudicate source-acquisition candidates into paper-scale gold'],
    }),
    buildClaim({
      id: 'baseline_diagnostic_claim',
      claim: 'Pilot baselines expose qualitative failure modes that motivate the hard-grounded taxonomy.',
      status: check(releaseGate, 'failure_atlas_ready').passed && modelRunIndex.eligible_model_baseline_count >= 2 ? 'diagnostic_only' : 'blocked',
      evidence: [
        `${baselineAnalysis.systems.length} scored systems`,
        `${modelRunIndex.eligible_model_baseline_count} eligible external model baselines`,
        check(releaseGate, 'failure_atlas_ready').detail,
      ],
      blocked_by: ['pilot-only baselines are diagnostic until rerun on the HF-derived scale suite'],
      required_before_submission: ['rerun baselines on the HF-derived scale suite or clearly label pilot-only diagnostics'],
    }),
    buildClaim({
      id: 'category_effect_claim',
      claim: 'Category-level differences identify which grounded-research tasks are hardest.',
      status: categoryScale.passed && !noveltyFinal.passed ? 'diagnostic_only_until_novelty_final' : 'prohibited_until_gates_pass',
      evidence: [`${derivedItemsCurrent}/${derivedItemsTarget} HF-derived target items`, categoryScale.detail],
      blocked_by: ['category_scale_ready', 'novelty_audit_final'].filter((id) => failedIds.has(id)),
      required_before_submission: ['30 HF-derived paper-eligible items per category', 'final novelty audit', 'eligible scale-suite model baselines'],
    }),
    buildClaim({
      id: 'publishable_gold_claim',
      claim: 'The benchmark has HF-derived labels for paper-scale evaluation.',
      status: derivedLabels.passed && categoryScale.passed ? 'allowed' : 'prohibited_until_gates_pass',
      evidence: [derivedLabels.detail, categoryScale.detail, 'human review retained as optional audit'],
      blocked_by: ['hf_derived_label_suite_ready', 'category_scale_ready'].filter((id) => failedIds.has(id)),
      required_before_submission: ['maintain deterministic derivation rules', 'keep optional audit issues separate from primary labels'],
    }),
    buildClaim({
      id: 'annotation_quality_claim',
      claim: 'The annotation workflow has pre-registered quality-control rules for reviewer eligibility and label admissibility.',
      status: check(releaseGate, 'annotation_quality_control_ready').passed ? 'allowed' : 'blocked',
      evidence: [
        `${annotationQualityControl.qa_rules.length} QA rules`,
        `${annotationQualityControl.workload.total_review_rows} governed review rows`,
        check(releaseGate, 'annotation_quality_control_ready').detail,
      ],
      blocked_by: check(releaseGate, 'annotation_quality_control_ready').passed ? [] : ['annotation_quality_control_ready'],
    }),
    buildClaim({
      id: 'novelty_completion_claim',
      claim: 'The benchmark is genuinely novel as of June 2026 and ready for completion/submission.',
      status: 'prohibited_until_gates_pass',
      evidence: [
        `novelty status=${noveltyAudit.status}`,
        `${noveltyEvidence.source_count} related-work sources registered`,
        noveltyFinal.detail,
      ],
      blocked_by: ['novelty_audit_final'],
      required_before_submission: ['final June 2026 literature refresh', 'replace preliminary novelty gate', 'complete review and scale gates'],
    }),
  ]

  return {
    benchmark_id: spec.id,
    paper_claim_ledger_ready: claims.length >= 8 && claims.some((claim) => claim.status === 'prohibited_until_gates_pass'),
    completion_claim_allowed: false,
    generated_from: {
      release_gate: 'generated/release-gate.json',
      analysis_plan: 'generated/analysis-plan.json',
      novelty_audit: 'generated/novelty-audit.json',
      novelty_evidence: 'generated/novelty-evidence.json',
      corpus_audit: 'generated/corpus-audit.json',
      source_diversity_plan: 'generated/source-diversity-plan.json',
      source_acquisition_fetched_rows: 'generated/source-acquisition-fetched-rows.json',
      review_progress: 'generated/review-progress.json',
      annotation_quality_control: 'generated/annotation-quality-control.json',
      model_run_index: 'generated/model-run-index.json',
      baseline_analysis: 'generated/baseline-analysis.json',
    },
    summary: {
      claims: claims.length,
      allowed_claims: claims.filter((claim) => claim.status === 'allowed').length,
      diagnostic_only_claims: claims.filter((claim) => claim.status === 'diagnostic_only').length,
      prohibited_claims: claims.filter((claim) => claim.status === 'prohibited_until_gates_pass').length,
      blocked_claims: claims.filter((claim) => claim.status === 'blocked').length,
      failed_release_checks: failedIds.size,
    },
    claims,
  }
}

function renderMarkdown(ledger) {
  const rows = ledger.claims.map((claim) => [
    claim.id,
    claim.status,
    claim.claim,
    claim.blocked_by.length ? claim.blocked_by.join('<br>') : 'none',
  ])

  return `# Hard Grounded Research Paper Claim Ledger

This generated ledger maps paper claims to current evidence and release gates. It is designed to prevent the manuscript from implying completion while human review, category scale, or final novelty gates remain blocked.

## Summary

- Claim ledger ready: ${ledger.paper_claim_ledger_ready}
- Completion claim allowed: ${ledger.completion_claim_allowed}
- Claims: ${ledger.summary.claims}
- Allowed claims: ${ledger.summary.allowed_claims}
- Diagnostic-only claims: ${ledger.summary.diagnostic_only_claims}
- Prohibited claims: ${ledger.summary.prohibited_claims}
- Blocked claims: ${ledger.summary.blocked_claims}

## Claim Status

${markdownTable(['Claim id', 'Status', 'Claim', 'Blocked by'], rows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  if (!existsSync(path)) throw new Error(`Missing paper claim ledger input ${name}: ${path}`)
}

const ledger = buildLedger({
  spec: readJson(inputs.spec),
  releaseGate: readJson(inputs.releaseGate),
  analysisPlan: readJson(inputs.analysisPlan),
  noveltyAudit: readJson(inputs.noveltyAudit),
  noveltyEvidence: readJson(inputs.noveltyEvidence),
  corpusAudit: readJson(inputs.corpusAudit),
  sourceDiversityPlan: readJson(inputs.sourceDiversityPlan),
  sourceAcquisitionFetchedRows: readJson(inputs.sourceAcquisitionFetchedRows),
  reviewProgress: readJson(inputs.reviewProgress),
  annotationQualityControl: readJson(inputs.annotationQualityControl),
  modelRunIndex: readJson(inputs.modelRunIndex),
  baselineAnalysis: readJson(inputs.baselineAnalysis),
})

writeJson(claimLedgerJsonPath, ledger)
writeText(claimLedgerMarkdownPath, renderMarkdown(ledger))

console.log(`Wrote hard grounded paper claim ledger JSON to ${claimLedgerJsonPath}`)
console.log(`Wrote hard grounded paper claim ledger report to ${claimLedgerMarkdownPath}`)
