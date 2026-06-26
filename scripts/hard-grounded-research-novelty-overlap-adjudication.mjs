import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'novelty-overlap-adjudication.json')
const reportMarkdownPath = join(experimentDir, 'NOVELTY_OVERLAP_ADJUDICATION.md')

const inputs = {
  noveltyReplacementCandidates: join(generatedDir, 'novelty-replacement-candidates.json'),
  noveltyClaimRevisionPlan: join(generatedDir, 'novelty-claim-revision-plan.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
}

const adjudicationRules = {
  'rag-evaluation-survey-2025': {
    overlap_scope: 'high',
    affected_claim_ids: ['taxonomy_scope_claim', 'novelty_completion_claim'],
    required_decision: 'must_cite_and_remove_generic_rag_novelty',
    boundary_language:
      'Cite the RAG evaluation survey as broad evaluation/taxonomy prior work and keep novelty limited to hard-grounded research-QA failure categories and HF-derived item construction.',
    reviewer_questions: [
      'Which RAG evaluation dimensions in the survey overlap with the hard-grounded category taxonomy?',
      'Does the survey identify any benchmark that already combines lifecycle, authority, temporal, insufficiency, citation-overreach, entity, table/text, multi-hop, and contradiction tasks?',
    ],
  },
  'faithfulness-qa-2026-verified': {
    overlap_scope: 'medium',
    affected_claim_ids: ['taxonomy_scope_claim', 'novelty_completion_claim'],
    required_decision: 'cite_and_narrow',
    boundary_language:
      'Position counterfactual-context faithfulness as adjacent to entity/state confusion, while keeping hard-grounded novelty limited to multi-source research evidence and conclusion-support failures.',
    reviewer_questions: [
      'Does Faithfulness-QA test document-state or entity confusion in a way that covers stale-vs-current and entity-disambiguation categories?',
      'Does its metric evaluate answer-level conclusion support, or context-faithfulness under counterfactual substitution?',
    ],
  },
  'faitheval-2024': {
    overlap_scope: 'medium',
    affected_claim_ids: ['taxonomy_scope_claim', 'novelty_completion_claim'],
    required_decision: 'cite_and_narrow',
    boundary_language:
      'Cite noisy-context faithfulness work and reserve novelty for the combined evidence sufficiency, source authority, and citation-overreach taxonomy.',
    reviewer_questions: [
      'Does FaithEval include abstention or insufficiency scoring that overlaps the evidence-insufficiency category?',
      'Does noisy-context faithfulness cover citation-support-overreach, or only context-grounded answer faithfulness?',
    ],
  },
  'confiqua-context-dpo-2024': {
    overlap_scope: 'medium',
    affected_claim_ids: ['taxonomy_scope_claim', 'novelty_completion_claim'],
    required_decision: 'cite_and_narrow',
    boundary_language:
      'Cite context-faithfulness alignment work and avoid claiming novelty for generic hallucination control in QA.',
    reviewer_questions: [
      'Does Context-DPO include benchmark tasks or only alignment data/methods for context faithfulness?',
      'Does it require source-level citation support or only context-consistent generation?',
    ],
  },
  'legalbench-rag-2024': {
    overlap_scope: 'medium',
    affected_claim_ids: ['taxonomy_scope_claim', 'hf_grounding_claim', 'novelty_completion_claim'],
    required_decision: 'cite_no_overlap_or_narrow',
    boundary_language:
      'Cite LegalBench-RAG as domain-specific legal RAG unless its source structure directly tests authority hierarchy or cross-document contradiction.',
    reviewer_questions: [
      'Does LegalBench-RAG encode legal source authority conflicts or only legal retrieval/answering?',
      'Does its evaluation separate citation support for facts from support for conclusions?',
    ],
  },
  'finegrained-rag-2026': {
    overlap_scope: 'high',
    affected_claim_ids: ['taxonomy_scope_claim', 'novelty_completion_claim'],
    required_decision: 'must_cite_and_remove_generic_rag_novelty',
    boundary_language:
      'Remove any generic fine-grained RAG benchmarking novelty claim; limit novelty to the hard-grounded research-QA construct and review/gold workflow.',
    reviewer_questions: [
      'Does the fine-grained RAG taxonomy subsume any hard-grounded categories?',
      'Which error-analysis claims must cite this work before submission?',
    ],
  },
  'grace-2026': {
    overlap_scope: 'high',
    affected_claim_ids: ['taxonomy_scope_claim', 'novelty_completion_claim'],
    required_decision: 'must_compare_before_final',
    boundary_language:
      'Compare GRACE against the multi-hop, contradiction, and temporal categories before claiming hard-grounded reasoning coverage.',
    reviewer_questions: [
      'Does GRACE directly cover temporal/as-of-date reasoning or cross-document contradiction?',
      'Does it evaluate large-corpus research QA evidence sufficiency and source authority, or contextual reasoning in RAG more broadly?',
    ],
  },
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

function buildReport({ noveltyReplacementCandidates, noveltyClaimRevisionPlan, paperClaimLedger }) {
  const claimIds = new Set((paperClaimLedger.claims || []).map((claim) => claim.id))
  const rows = noveltyReplacementCandidates.candidates.map((candidate) => {
    const rule = adjudicationRules[candidate.id]
    return {
      candidate_id: candidate.id,
      title: candidate.title,
      url: candidate.url,
      primary_source_status: candidate.primary_source_status,
      overlap_scope: rule?.overlap_scope || 'unmapped',
      affected_claim_ids: rule?.affected_claim_ids || [],
      required_decision: rule?.required_decision || 'must_map_before_review',
      boundary_language: rule?.boundary_language || 'No boundary language recorded.',
      reviewer_questions: rule?.reviewer_questions || [],
      final_disposition: 'pending_reviewer_overlap_adjudication',
    }
  })
  const checks = [
    {
      id: 'verified_candidates_loaded',
      passed: rows.length === noveltyReplacementCandidates.summary.candidates,
      detail: `${rows.length}/${noveltyReplacementCandidates.summary.candidates} replacement candidates loaded`,
    },
    {
      id: 'all_candidates_mapped',
      passed: rows.every((row) => row.overlap_scope !== 'unmapped'),
      detail: `${rows.filter((row) => row.overlap_scope !== 'unmapped').length}/${rows.length} candidates mapped to overlap scope`,
    },
    {
      id: 'claim_ids_exist',
      passed: rows.every((row) => row.affected_claim_ids.every((id) => claimIds.has(id))),
      detail: `${rows.flatMap((row) => row.affected_claim_ids).length} claim links checked`,
    },
    {
      id: 'final_claims_still_blocked',
      passed:
        noveltyReplacementCandidates.summary.final_novelty_claim_allowed === false &&
        noveltyClaimRevisionPlan.summary.completion_claim_allowed === false,
      detail: `final_allowed=${noveltyReplacementCandidates.summary.final_novelty_claim_allowed}; completion_allowed=${noveltyClaimRevisionPlan.summary.completion_claim_allowed}`,
    },
  ]
  return {
    novelty_overlap_adjudication_ready: checks.every((check) => check.passed),
    version: 'novelty-overlap-adjudication-v1',
    checked_date: '2026-06-26',
    completion_claim_allowed: false,
    final_novelty_claim_allowed: false,
    generated_from: {
      novelty_replacement_candidates: 'generated/novelty-replacement-candidates.json',
      novelty_claim_revision_plan: 'generated/novelty-claim-revision-plan.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
    },
    checks,
    adjudication_rows: rows,
    summary: {
      candidates: rows.length,
      high_overlap_candidates: rows.filter((row) => row.overlap_scope === 'high').length,
      medium_overlap_candidates: rows.filter((row) => row.overlap_scope === 'medium').length,
      pending_dispositions: rows.filter((row) => row.final_disposition === 'pending_reviewer_overlap_adjudication').length,
      affected_claims: new Set(rows.flatMap((row) => row.affected_claim_ids)).size,
      final_novelty_claim_allowed: false,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(report) {
  const checkRows = report.checks.map((check) => [check.id, String(check.passed), check.detail])
  const adjudicationRows = report.adjudication_rows.map((row) => [
    row.candidate_id,
    row.overlap_scope,
    row.affected_claim_ids.join('<br>'),
    row.required_decision,
    row.final_disposition,
  ])
  const questionRows = report.adjudication_rows.flatMap((row) =>
    row.reviewer_questions.map((question, index) => [row.candidate_id, String(index + 1), question]),
  )
  return `# Hard Grounded Research Novelty Overlap Adjudication

This generated worksheet maps verified replacement candidates to claim impacts, required boundary language, and reviewer questions. It does not resolve overlap and does not allow final novelty claims.

## Summary

- Adjudication ready: ${report.novelty_overlap_adjudication_ready}
- Version: ${report.version}
- Date checked: ${report.checked_date}
- Candidates: ${report.summary.candidates}
- High-overlap candidates: ${report.summary.high_overlap_candidates}
- Medium-overlap candidates: ${report.summary.medium_overlap_candidates}
- Pending dispositions: ${report.summary.pending_dispositions}
- Affected claims: ${report.summary.affected_claims}
- Final novelty claim allowed: ${report.summary.final_novelty_claim_allowed}
- Completion claim allowed: ${report.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Adjudication Rows

${markdownTable(['Candidate', 'Overlap scope', 'Affected claims', 'Required decision', 'Final disposition'], adjudicationRows)}

## Reviewer Questions

${markdownTable(['Candidate', '#', 'Question'], questionRows)}
`
}

const report = buildReport({
  noveltyReplacementCandidates: readJson(inputs.noveltyReplacementCandidates),
  noveltyClaimRevisionPlan: readJson(inputs.noveltyClaimRevisionPlan),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
})

writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded novelty overlap adjudication to ${reportJsonPath}`)
console.log(`Wrote hard grounded novelty overlap adjudication report to ${reportMarkdownPath}`)
