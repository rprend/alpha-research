import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'final-novelty-adjudication.json')
const reportMarkdownPath = join(experimentDir, 'FINAL_NOVELTY_ADJUDICATION.md')

const inputs = {
  noveltyRefreshLedger: join(generatedDir, 'novelty-refresh-ledger.json'),
  noveltyOverlapAdjudication: join(generatedDir, 'novelty-overlap-adjudication.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
}

const sourceDispositions = {
  'conflictrag-2025': {
    disposition: 'cite_and_narrow',
    overlap_scope: 'high',
    claim_action:
      'Do not claim novelty for conflict detection or conflict resolution; cite as adjacent contradiction/conflict RAG work.',
  },
  'inter-context-conflicts-2025': {
    disposition: 'cite_and_narrow',
    overlap_scope: 'high',
    claim_action:
      'Treat conflicting-evidence RAG as prior work and reserve novelty for explicit research-QA evidence contracts across multiple failure categories.',
  },
  'citerag-2026': {
    disposition: 'cite_and_narrow',
    overlap_scope: 'medium',
    claim_action:
      'Separate academic citation prediction from conclusion-support-overreach scoring; cite for citation-related overlap.',
  },
  'sufficient-context-2025': {
    disposition: 'cite_and_narrow',
    overlap_scope: 'medium',
    claim_action:
      'Do not claim abstention or context sufficiency as novel; claim only the combined insufficiency/citation-overreach/research-QA packaging.',
  },
  'mudabench-2026': {
    disposition: 'cite_and_narrow',
    overlap_scope: 'high',
    claim_action:
      'Cite multi-document analytical QA as close prior work; narrow novelty to hard-grounded failure taxonomy and HF-derived provenance.',
  },
  'globalqa-2025': {
    disposition: 'cite_background',
    overlap_scope: 'medium',
    claim_action:
      'Use as large-scale/global QA background and avoid broad large-corpus QA novelty claims.',
  },
  'ragchecker-2024': {
    disposition: 'cite_background',
    overlap_scope: 'medium',
    claim_action:
      'Cite diagnostic RAG evaluation; keep this benchmark claim focused on dataset/task construction rather than metric novelty.',
  },
  'ragbench-2024': {
    disposition: 'cite_background',
    overlap_scope: 'medium',
    claim_action:
      'Cite explainable RAG benchmarking as background and avoid generic RAG benchmark novelty claims.',
  },
  'lit-ragbench-2026': {
    disposition: 'must_cite_and_narrow',
    overlap_scope: 'high',
    claim_action:
      'Do not claim table-text RAG or abstention benchmark novelty; position table-text as one category within the unified hard-grounded suite.',
  },
  'forcebench-2026': {
    disposition: 'must_cite_and_narrow',
    overlap_scope: 'high',
    claim_action:
      'Do not claim evidence-force or citation-worthiness novelty; claim conclusion-support-overreach only as part of the cross-category research-QA benchmark.',
  },
  't2-ragbench-2026': {
    disposition: 'must_cite_and_narrow',
    overlap_scope: 'high',
    claim_action:
      'Do not claim text-table RAG novelty; cite as direct table-text prior work and keep novelty at the combined suite level.',
  },
}

const allowedContributionBoundary = {
  allowed_claim:
    'Hard Grounded Research contributes an HF-derived, script-reproducible benchmark suite for large-corpus research QA that combines multi-hop synthesis, stale/current conflicts, lifecycle changes, table-text reasoning, authority conflicts, insufficiency/abstention, citation-overreach, entity disambiguation, as-of-date temporal reasoning, and cross-document contradiction under common evidence contracts.',
  prohibited_claims: [
    'First RAG benchmark.',
    'First table-text RAG benchmark.',
    'First evidence insufficiency or abstention benchmark.',
    'First citation-faithfulness or evidence-force benchmark.',
    'First contradiction/conflict RAG benchmark.',
    'Novelty for any single category independent of the unified hard-grounded research-QA suite.',
  ],
  required_manuscript_moves: [
    'Cite or contrast every high-overlap source in the final related-work section.',
    'State that individual subproblems are crowded and the contribution is the combined HF-derived research-QA stress suite.',
    'Keep human review framed as optional audit rather than primary data generation.',
    'Keep final novelty and completion claims blocked until the final novelty audit incorporates this adjudication.',
  ],
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

function buildReport({ noveltyRefreshLedger, noveltyOverlapAdjudication, paperClaimLedger }) {
  const refreshedRows = noveltyRefreshLedger.sources.map((source) => {
    const disposition = sourceDispositions[source.id]
    return {
      source_id: source.id,
      title: source.title,
      url: source.url,
      year: source.year,
      overlap: source.overlap,
      disposition: disposition?.disposition || 'unmapped',
      overlap_scope: disposition?.overlap_scope || 'unmapped',
      claim_action: disposition?.claim_action || 'No final-adjudication action recorded.',
    }
  })
  const replacementRows = noveltyOverlapAdjudication.adjudication_rows.map((row) => ({
    source_id: row.candidate_id,
    title: row.title,
    url: row.url,
    overlap: row.affected_claim_ids,
    disposition: row.required_decision,
    overlap_scope: row.overlap_scope,
    claim_action: row.boundary_language,
  }))
  const rows = [...refreshedRows, ...replacementRows]
  const highOverlapRows = rows.filter((row) => row.overlap_scope === 'high')
  const prohibitedClaims = paperClaimLedger.claims.filter((claim) => claim.status?.includes('prohibited'))
  const checks = [
    {
      id: 'all_refreshed_sources_adjudicated',
      passed: refreshedRows.every((row) => row.disposition !== 'unmapped'),
      detail: `${refreshedRows.filter((row) => row.disposition !== 'unmapped').length}/${refreshedRows.length} refreshed sources adjudicated`,
    },
    {
      id: 'all_replacement_sources_carried_forward',
      passed: replacementRows.length === noveltyOverlapAdjudication.summary.candidates,
      detail: `${replacementRows.length}/${noveltyOverlapAdjudication.summary.candidates} replacement-candidate rows carried forward`,
    },
    {
      id: 'high_overlap_sources_force_claim_narrowing',
      passed: highOverlapRows.every((row) => /narrow|cite|compare|remove/i.test(row.disposition)),
      detail: `${highOverlapRows.length} high-overlap rows require cite/narrow/compare action`,
    },
    {
      id: 'completion_claim_still_blocked',
      passed:
        noveltyRefreshLedger.summary.final_novelty_claim_allowed === false &&
        noveltyOverlapAdjudication.summary.final_novelty_claim_allowed === false &&
        prohibitedClaims.length >= 1,
      detail: `final_allowed=${noveltyRefreshLedger.summary.final_novelty_claim_allowed}; prohibited_claims=${prohibitedClaims.length}`,
    },
  ]
  return {
    final_novelty_adjudication_ready: checks.every((check) => check.passed),
    version: 'final-novelty-adjudication-v1',
    checked_date: '2026-06-26',
    completion_claim_allowed: false,
    final_novelty_claim_allowed: false,
    generated_from: {
      novelty_refresh_ledger: 'generated/novelty-refresh-ledger.json',
      novelty_overlap_adjudication: 'generated/novelty-overlap-adjudication.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
    },
    contribution_boundary: allowedContributionBoundary,
    checks,
    adjudication_rows: rows,
    summary: {
      refreshed_sources: refreshedRows.length,
      replacement_candidate_sources: replacementRows.length,
      adjudication_rows: rows.length,
      high_overlap_rows: highOverlapRows.length,
      prohibited_claims: allowedContributionBoundary.prohibited_claims.length,
      required_manuscript_moves: allowedContributionBoundary.required_manuscript_moves.length,
      final_novelty_claim_allowed: false,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(report) {
  const checkRows = report.checks.map((check) => [check.id, String(check.passed), check.detail])
  const adjudicationRows = report.adjudication_rows.map((row) => [
    row.source_id,
    row.overlap_scope,
    row.disposition,
    row.claim_action,
    row.url,
  ])
  const prohibitedRows = report.contribution_boundary.prohibited_claims.map((claim, index) => [String(index + 1), claim])
  const moveRows = report.contribution_boundary.required_manuscript_moves.map((move, index) => [String(index + 1), move])

  return `# Hard Grounded Research Final Novelty Adjudication

This generated artifact converts the June 2026 novelty refresh into source-by-source claim boundaries. It is an input to the final novelty audit, not a completion claim.

## Summary

- Adjudication ready: ${report.final_novelty_adjudication_ready}
- Version: ${report.version}
- Date checked: ${report.checked_date}
- Refreshed sources: ${report.summary.refreshed_sources}
- Replacement candidate sources: ${report.summary.replacement_candidate_sources}
- Adjudication rows: ${report.summary.adjudication_rows}
- High-overlap rows: ${report.summary.high_overlap_rows}
- Final novelty claim allowed: ${report.summary.final_novelty_claim_allowed}
- Completion claim allowed: ${report.summary.completion_claim_allowed}

## Allowed Contribution Boundary

${report.contribution_boundary.allowed_claim}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Source Adjudications

${markdownTable(['Source', 'Overlap scope', 'Disposition', 'Claim action', 'URL'], adjudicationRows)}

## Prohibited Claims

${markdownTable(['#', 'Claim'], prohibitedRows)}

## Required Manuscript Moves

${markdownTable(['#', 'Move'], moveRows)}
`
}

const report = buildReport({
  noveltyRefreshLedger: readJson(inputs.noveltyRefreshLedger),
  noveltyOverlapAdjudication: readJson(inputs.noveltyOverlapAdjudication),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
})

writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded final novelty adjudication to ${reportJsonPath}`)
console.log(`Wrote hard grounded final novelty adjudication report to ${reportMarkdownPath}`)
