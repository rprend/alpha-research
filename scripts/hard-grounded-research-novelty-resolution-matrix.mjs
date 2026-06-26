import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const matrixJsonPath = join(generatedDir, 'novelty-resolution-matrix.json')
const matrixMarkdownPath = join(experimentDir, 'NOVELTY_RESOLUTION_MATRIX.md')

const inputs = {
  noveltyAudit: join(generatedDir, 'novelty-audit.json'),
  noveltyEvidence: join(generatedDir, 'novelty-evidence.json'),
  noveltyWatchlist: join(generatedDir, 'novelty-watchlist.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
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
    `| ${headers.map(() => '---').join(' | ') } |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function claimImpact(source) {
  if (source.id === 'hierarag-2026') {
    return {
      impacted_claims: ['generic RAG benchmark claim', 'benchmark taxonomy framing'],
      required_boundary_change:
        'Do not claim generic RAG benchmark novelty; frame the contribution as a hard-grounded failure taxonomy and executable review harness.',
      final_audit_disposition: 'must_cite_or_rule_out_before_final',
    }
  }
  if (source.pressure_points.includes('citation supports fact but not conclusion')) {
    return {
      impacted_claims: ['citation faithfulness evaluation', 'conclusion-support overreach'],
      required_boundary_change:
        'Keep citation novelty limited to conclusion-support overreach rather than span attribution or hallucination detection.',
      final_audit_disposition: 'must_compare_before_final',
    }
  }
  if (source.pressure_points.includes('source authority conflicts')) {
    return {
      impacted_claims: ['source authority conflicts', 'domain-specific RAG'],
      required_boundary_change:
        'Confirm whether authority hierarchy is actually benchmarked; otherwise cite as domain RAG rather than authority-conflict coverage.',
      final_audit_disposition: 'must_compare_before_final',
    }
  }
  return {
    impacted_claims: source.pressure_points,
    required_boundary_change:
      'Resolve overlap in related work and update the final claim boundary before any completion or novelty claim.',
    final_audit_disposition: 'must_resolve_before_final',
  }
}

function buildMatrix({ noveltyAudit, noveltyEvidence, noveltyWatchlist, paperClaimLedger }) {
  const registryIds = new Set((noveltyEvidence.sources || []).map((source) => source.id))
  const prohibitedClaimCount =
    paperClaimLedger.summary?.prohibited_claims ??
    (paperClaimLedger.claims || []).filter((claim) => String(claim.status).startsWith('prohibited')).length
  const rows = noveltyWatchlist.watchlist_sources.map((source) => {
    const impact = claimImpact(source)
    return {
      source_id: source.id,
      title: source.title,
      url: source.url,
      year: source.year,
      novelty_risk: source.novelty_risk,
      already_in_registry: registryIds.has(source.id),
      pressure_points: source.pressure_points,
      required_resolution: source.required_resolution,
      impacted_claims: impact.impacted_claims,
      required_boundary_change: impact.required_boundary_change,
      final_audit_disposition: impact.final_audit_disposition,
    }
  })
  const unresolvedRows = rows.filter((row) => !row.already_in_registry || row.final_audit_disposition !== 'resolved')
  const highRiskRows = rows.filter((row) => row.novelty_risk === 'high')
  const checks = [
    {
      id: 'watchlist_loaded',
      passed: rows.length === noveltyWatchlist.summary.watchlist_source_count,
      detail: `${rows.length}/${noveltyWatchlist.summary.watchlist_source_count} watchlist sources mapped`,
    },
    {
      id: 'claim_impacts_mapped',
      passed: rows.every((row) => row.impacted_claims.length > 0 && row.required_boundary_change),
      detail: `${rows.filter((row) => row.impacted_claims.length > 0).length}/${rows.length} sources with claim impacts`,
    },
    {
      id: 'bounded_final_audit_preserved',
      passed:
        ['refreshed_preliminary', 'final_bounded'].includes(noveltyAudit.status) &&
        noveltyAudit.completion_claim_allowed === false,
      detail: `novelty status=${noveltyAudit.status}; final_novelty_claim_allowed=${noveltyAudit.final_novelty_claim_allowed ?? false}; completion_claim_allowed=${noveltyAudit.completion_claim_allowed}`,
    },
    {
      id: 'prohibited_claims_preserved',
      passed: prohibitedClaimCount >= 1,
      detail: `${prohibitedClaimCount} prohibited paper claims remain in the claim ledger`,
    },
  ]

  return {
    novelty_resolution_matrix_ready: checks.every((check) => check.passed),
    version: 'novelty-resolution-matrix-v1',
    checked_date: noveltyWatchlist.checked_date,
    completion_claim_allowed: false,
    generated_from: {
      novelty_audit: 'generated/novelty-audit.json',
      novelty_evidence: 'generated/novelty-evidence.json',
      novelty_watchlist: 'generated/novelty-watchlist.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
    },
    checks,
    source_resolutions: rows,
    final_audit_requirements: [
      'Read or re-check every watchlist source immediately before final submission.',
      'Move any directly overlapping source into generated/novelty-evidence.json before final novelty claims.',
      'Rewrite paper claims if a watchlist source covers a proposed hard-grounded category as a standalone contribution.',
      'Keep completion_claim_allowed false until review, scale, and final novelty gates all pass.',
    ],
    summary: {
      watchlist_sources: rows.length,
      unresolved_sources: unresolvedRows.length,
      high_risk_sources: highRiskRows.length,
      prohibited_claims_preserved: prohibitedClaimCount,
      registry_sources: noveltyEvidence.source_count,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(matrix) {
  const checkRows = matrix.checks.map((check) => [check.id, String(check.passed), check.detail])
  const sourceRows = matrix.source_resolutions.map((source) => [
    source.source_id,
    `[${source.title}](${source.url})`,
    source.novelty_risk,
    source.pressure_points.join('<br>'),
    source.impacted_claims.join('<br>'),
    source.final_audit_disposition,
  ])
  const requirementRows = matrix.final_audit_requirements.map((requirement, index) => [String(index + 1), requirement])

  return `# Hard Grounded Research Novelty Resolution Matrix

This generated matrix turns the live novelty watchlist into source-level related-work resolution tasks. It is not a final novelty audit and does not allow completion claims.

## Summary

- Matrix ready: ${matrix.novelty_resolution_matrix_ready}
- Version: ${matrix.version}
- Date checked: ${matrix.checked_date}
- Watchlist sources: ${matrix.summary.watchlist_sources}
- Unresolved sources: ${matrix.summary.unresolved_sources}
- High-risk sources: ${matrix.summary.high_risk_sources}
- Registry sources: ${matrix.summary.registry_sources}
- Prohibited claims preserved: ${matrix.summary.prohibited_claims_preserved}
- Completion claim allowed: ${matrix.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Source Resolution Matrix

${markdownTable(['Source', 'Title', 'Risk', 'Pressure points', 'Impacted claims', 'Final-audit disposition'], sourceRows)}

## Final Audit Requirements

${markdownTable(['#', 'Requirement'], requirementRows)}
`
}

const matrix = buildMatrix({
  noveltyAudit: readJson(inputs.noveltyAudit),
  noveltyEvidence: readJson(inputs.noveltyEvidence),
  noveltyWatchlist: readJson(inputs.noveltyWatchlist),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
})

writeJson(matrixJsonPath, matrix)
writeText(matrixMarkdownPath, renderMarkdown(matrix))

console.log(`Wrote hard grounded novelty resolution matrix to ${matrixJsonPath}`)
console.log(`Wrote hard grounded novelty resolution matrix report to ${matrixMarkdownPath}`)
