import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const preflightJsonPath = join(generatedDir, 'novelty-finalization-preflight.json')
const preflightMarkdownPath = join(experimentDir, 'NOVELTY_FINALIZATION_PREFLIGHT.md')

const inputs = {
  noveltyAudit: join(generatedDir, 'novelty-audit.json'),
  noveltyEvidence: join(generatedDir, 'novelty-evidence.json'),
  noveltyWatchlist: join(generatedDir, 'novelty-watchlist.json'),
  noveltyResolutionMatrix: join(generatedDir, 'novelty-resolution-matrix.json'),
  noveltySourceIdentityAudit: join(generatedDir, 'novelty-source-identity-audit.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
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

function buildPreflight({ noveltyAudit, noveltyEvidence, noveltyWatchlist, noveltyResolutionMatrix, noveltySourceIdentityAudit, paperClaimLedger, releaseGate }) {
  const releaseFailures = releaseGate.checks.filter((check) => !check.passed)
  const noveltyFailures = releaseFailures.filter((check) => check.id.startsWith('novelty_'))
  const allowedRepairBlockers = new Set(['artifact_checklist_ready'])
  const nonNoveltyFailures = releaseFailures.filter((check) => !check.id.startsWith('novelty_') && !allowedRepairBlockers.has(check.id))
  const unresolvedSources = noveltyResolutionMatrix.source_resolutions.filter((source) =>
    source.final_audit_disposition !== 'resolved' || !source.already_in_registry,
  )
  const highRiskSources = unresolvedSources.filter((source) => source.novelty_risk === 'high')
  const prohibitedClaimCount =
    paperClaimLedger.summary?.prohibited_claims ??
    (paperClaimLedger.claims || []).filter((claim) => String(claim.status).startsWith('prohibited')).length

  const checks = [
    {
      id: 'preliminary_audit_preserved',
      passed: noveltyAudit.status !== 'final' && noveltyAudit.completion_claim_allowed === false,
      detail: `status=${noveltyAudit.status}; completion_claim_allowed=${noveltyAudit.completion_claim_allowed}`,
    },
    {
      id: 'watchlist_resolution_inputs_loaded',
      passed:
        noveltyWatchlist.novelty_watchlist_ready === true &&
        noveltyResolutionMatrix.novelty_resolution_matrix_ready === true &&
        noveltyResolutionMatrix.summary?.watchlist_sources === noveltyWatchlist.summary?.watchlist_source_count,
      detail: `${noveltyResolutionMatrix.summary?.watchlist_sources ?? 0}/${noveltyWatchlist.summary?.watchlist_source_count ?? 0} watchlist sources mapped`,
    },
    {
      id: 'unresolved_sources_identified',
      passed: unresolvedSources.length > 0 && highRiskSources.length > 0,
      detail: `${unresolvedSources.length} unresolved sources; ${highRiskSources.length} high-risk unresolved sources`,
    },
    {
      id: 'source_identity_audit_blocks_unverified_sources',
      passed:
        noveltySourceIdentityAudit.novelty_source_identity_audit_ready === true &&
        noveltySourceIdentityAudit.summary?.invalid_or_unverified_sources > 0 &&
        noveltySourceIdentityAudit.summary?.completion_claim_allowed === false,
      detail: `${noveltySourceIdentityAudit.summary?.invalid_or_unverified_sources ?? 0}/${noveltySourceIdentityAudit.summary?.watchlist_sources ?? 0} watchlist sources unverified`,
    },
    {
      id: 'claim_boundaries_preserved',
      passed:
        noveltyEvidence.completion_claim_allowed === false &&
        noveltyEvidence.prohibited_claim_count >= 3 &&
        prohibitedClaimCount >= 1,
      detail: `${noveltyEvidence.prohibited_claim_count} evidence-registry prohibited claims; ${prohibitedClaimCount} ledger prohibited claims`,
    },
    {
      id: 'release_blocks_only_novelty_or_repair_claims',
      passed:
        releaseGate.status !== 'release_ready' &&
        noveltyFailures.some((check) => check.id === 'novelty_audit_final') &&
        nonNoveltyFailures.length === 0,
      detail: `${releaseFailures.length} release blockers; ${noveltyFailures.length} novelty blockers; ${nonNoveltyFailures.length} unexpected non-novelty blockers`,
    },
  ]

  const blockingConditions = [
    ...unresolvedSources.map((source) => ({
      id: `source:${source.source_id}`,
      severity: source.novelty_risk === 'high' ? 'high' : 'medium',
      condition: source.required_resolution,
      required_action: source.required_boundary_change,
    })),
    ...noveltyFailures.map((check) => ({
      id: `release:${check.id}`,
      severity: check.id === 'novelty_audit_final' ? 'high' : 'medium',
      condition: check.detail,
      required_action: check.blocker,
    })),
  ]

  return {
    novelty_finalization_preflight_ready: checks.every((check) => check.passed),
    version: 'novelty-finalization-preflight-v1',
    checked_date: noveltyWatchlist.checked_date,
    final_novelty_claim_allowed: false,
    completion_claim_allowed: false,
    generated_from: {
      novelty_audit: 'generated/novelty-audit.json',
      novelty_evidence: 'generated/novelty-evidence.json',
      novelty_watchlist: 'generated/novelty-watchlist.json',
      novelty_resolution_matrix: 'generated/novelty-resolution-matrix.json',
      novelty_source_identity_audit: 'generated/novelty-source-identity-audit.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
      release_gate: 'generated/release-gate.json',
    },
    checks,
    finalization_requirements: [
      'Re-run the live related-work search immediately before submission and record the dated query provenance.',
      'Read every unresolved watchlist source and either add it to the evidence registry or document why it is out of scope.',
      'Replace or remove every watchlist source whose live URL is missing or points to an unrelated paper.',
      'Rewrite manuscript novelty language for any source that covers an asserted category, metric, or claim boundary.',
      'Regenerate the novelty audit, novelty evidence registry, paper claim ledger, paper draft, release gate, and version manifest after source resolution.',
      'Keep final novelty and completion claims blocked until live related-work adjudication resolves the remaining novelty_audit_final gate.',
    ],
    blocking_conditions: blockingConditions,
    summary: {
      watchlist_sources: noveltyWatchlist.summary.watchlist_source_count,
      unresolved_sources: unresolvedSources.length,
      high_risk_unresolved_sources: highRiskSources.length,
      invalid_or_unverified_sources: noveltySourceIdentityAudit.summary?.invalid_or_unverified_sources ?? 0,
      novelty_release_blockers: noveltyFailures.length,
      non_novelty_release_blockers: nonNoveltyFailures.length,
      prohibited_claims_preserved: prohibitedClaimCount,
      final_novelty_claim_allowed: false,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(preflight) {
  const checkRows = preflight.checks.map((check) => [check.id, String(check.passed), check.detail])
  const requirementRows = preflight.finalization_requirements.map((requirement, index) => [String(index + 1), requirement])
  const blockerRows = preflight.blocking_conditions.map((condition) => [
    condition.id,
    condition.severity,
    condition.condition,
    condition.required_action,
  ])

  return `# Hard Grounded Research Novelty Finalization Preflight

This generated preflight defines the work required before the novelty audit can become final. It does not perform the final literature adjudication and does not allow completion claims.

## Summary

- Preflight ready: ${preflight.novelty_finalization_preflight_ready}
- Version: ${preflight.version}
- Date checked: ${preflight.checked_date}
- Watchlist sources: ${preflight.summary.watchlist_sources}
- Unresolved sources: ${preflight.summary.unresolved_sources}
- High-risk unresolved sources: ${preflight.summary.high_risk_unresolved_sources}
- Invalid or unverified watchlist sources: ${preflight.summary.invalid_or_unverified_sources}
- Novelty release blockers: ${preflight.summary.novelty_release_blockers}
- Non-novelty release blockers: ${preflight.summary.non_novelty_release_blockers}
- Final novelty claim allowed: ${preflight.summary.final_novelty_claim_allowed}
- Completion claim allowed: ${preflight.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Finalization Requirements

${markdownTable(['#', 'Requirement'], requirementRows)}

## Blocking Conditions

${markdownTable(['Condition', 'Severity', 'Current state', 'Required action'], blockerRows)}
`
}

const preflight = buildPreflight({
  noveltyAudit: readJson(inputs.noveltyAudit),
  noveltyEvidence: readJson(inputs.noveltyEvidence),
  noveltyWatchlist: readJson(inputs.noveltyWatchlist),
  noveltyResolutionMatrix: readJson(inputs.noveltyResolutionMatrix),
  noveltySourceIdentityAudit: readJson(inputs.noveltySourceIdentityAudit),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(preflightJsonPath, preflight)
writeText(preflightMarkdownPath, renderMarkdown(preflight))

console.log(`Wrote hard grounded novelty finalization preflight to ${preflightJsonPath}`)
console.log(`Wrote hard grounded novelty finalization preflight report to ${preflightMarkdownPath}`)
