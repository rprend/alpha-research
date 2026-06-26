import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const planJsonPath = join(generatedDir, 'novelty-claim-revision-plan.json')
const planMarkdownPath = join(experimentDir, 'NOVELTY_CLAIM_REVISION_PLAN.md')

const inputs = {
  noveltySourceReviewPackets: join(generatedDir, 'novelty-source-review-packets.json'),
  noveltyResolutionMatrix: join(generatedDir, 'novelty-resolution-matrix.json'),
  noveltyFinalizationPreflight: join(generatedDir, 'novelty-finalization-preflight.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeReport(path, value) {
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

function claimAction(packet) {
  if (packet.source_id === 'hierarag-2026') {
    return {
      claim_ids: ['taxonomy_scope_claim', 'novelty_completion_claim'],
      manuscript_action: 'Cite as a broad RAG benchmarking review and remove any generic RAG benchmark novelty framing.',
      boundary_language:
        'Novelty is limited to the hard-grounded failure taxonomy and executable review harness, not to RAG benchmarking in general.',
      disposition_required: 'cite_and_narrow',
    }
  }
  if (packet.pressure_points.includes('citation supports fact but not conclusion')) {
    return {
      claim_ids: ['taxonomy_scope_claim', 'novelty_completion_claim'],
      manuscript_action: 'Compare against faithfulness/citation work and keep the claim to conclusion-support overreach.',
      boundary_language:
        'The category tests cases where cited evidence supports an intermediate fact but not the answer-level conclusion.',
      disposition_required: 'cite_and_narrow',
    }
  }
  if (packet.pressure_points.includes('source authority conflicts')) {
    return {
      claim_ids: ['taxonomy_scope_claim', 'hf_grounding_claim', 'novelty_completion_claim'],
      manuscript_action: 'Cite as domain RAG unless it explicitly tests authority hierarchy among conflicting sources.',
      boundary_language:
        'Authority-conflict novelty requires source hierarchy or authority disagreement, not only domain-specific retrieval.',
      disposition_required: 'cite_no_overlap_or_narrow',
    }
  }
  return {
    claim_ids: ['novelty_completion_claim'],
    manuscript_action: 'Resolve overlap and revise related work before final novelty audit.',
    boundary_language: 'No final novelty claim may be made until this source has a recorded disposition.',
    disposition_required: 'must_resolve_before_final',
  }
}

function buildPlan({ noveltySourceReviewPackets, noveltyResolutionMatrix, noveltyFinalizationPreflight, paperClaimLedger }) {
  const claimById = new Map((paperClaimLedger.claims || []).map((claim) => [claim.id, claim]))
  const revisions = noveltySourceReviewPackets.packets.map((packet) => {
    const action = claimAction(packet)
    return {
      packet_id: packet.packet_id,
      source_id: packet.source_id,
      novelty_risk: packet.novelty_risk,
      impacted_claim_ids: action.claim_ids,
      impacted_claim_statuses: action.claim_ids.map((id) => claimById.get(id)?.status || 'missing'),
      manuscript_action: action.manuscript_action,
      required_boundary_language: action.boundary_language,
      disposition_required: action.disposition_required,
      source_review_required_outputs: packet.required_reviewer_outputs,
    }
  })
  const checks = [
    {
      id: 'packets_loaded',
      passed: revisions.length === noveltySourceReviewPackets.summary.packets,
      detail: `${revisions.length}/${noveltySourceReviewPackets.summary.packets} source packets mapped to claim revisions`,
    },
    {
      id: 'unresolved_sources_matched',
      passed: revisions.length === noveltyResolutionMatrix.summary.unresolved_sources,
      detail: `${revisions.length}/${noveltyResolutionMatrix.summary.unresolved_sources} unresolved sources matched`,
    },
    {
      id: 'claim_ids_exist',
      passed: revisions.every((revision) => revision.impacted_claim_statuses.every((status) => status !== 'missing')),
      detail: `${revisions.flatMap((revision) => revision.impacted_claim_ids).length} claim links checked`,
    },
    {
      id: 'final_claims_still_blocked',
      passed:
        noveltyFinalizationPreflight.summary?.final_novelty_claim_allowed === false &&
        paperClaimLedger.summary?.prohibited_claims >= 3,
      detail: `final_allowed=${noveltyFinalizationPreflight.summary?.final_novelty_claim_allowed}; prohibited_claims=${paperClaimLedger.summary?.prohibited_claims}`,
    },
  ]

  return {
    novelty_claim_revision_plan_ready: checks.every((check) => check.passed),
    version: 'novelty-claim-revision-plan-v1',
    checked_date: noveltySourceReviewPackets.checked_date,
    completion_claim_allowed: false,
    final_novelty_claim_allowed: false,
    generated_from: {
      novelty_source_review_packets: 'generated/novelty-source-review-packets.json',
      novelty_resolution_matrix: 'generated/novelty-resolution-matrix.json',
      novelty_finalization_preflight: 'generated/novelty-finalization-preflight.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
    },
    checks,
    revisions,
    summary: {
      revisions: revisions.length,
      high_risk_revisions: revisions.filter((revision) => revision.novelty_risk === 'high').length,
      linked_claims: new Set(revisions.flatMap((revision) => revision.impacted_claim_ids)).size,
      prohibited_claims_preserved: paperClaimLedger.summary?.prohibited_claims ?? 0,
      final_novelty_claim_allowed: false,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(plan) {
  const checkRows = plan.checks.map((check) => [check.id, String(check.passed), check.detail])
  const revisionRows = plan.revisions.map((revision) => [
    revision.packet_id,
    revision.source_id,
    revision.novelty_risk,
    revision.impacted_claim_ids.join('<br>'),
    revision.manuscript_action,
    revision.disposition_required,
  ])

  return `# Hard Grounded Research Novelty Claim Revision Plan

This generated plan maps unresolved related-work packets to manuscript claim revisions. It does not perform final novelty adjudication and does not allow completion claims.

## Summary

- Plan ready: ${plan.novelty_claim_revision_plan_ready}
- Version: ${plan.version}
- Date checked: ${plan.checked_date}
- Revisions: ${plan.summary.revisions}
- High-risk revisions: ${plan.summary.high_risk_revisions}
- Linked claims: ${plan.summary.linked_claims}
- Prohibited claims preserved: ${plan.summary.prohibited_claims_preserved}
- Final novelty claim allowed: ${plan.summary.final_novelty_claim_allowed}
- Completion claim allowed: ${plan.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Claim Revisions

${markdownTable(['Packet', 'Source', 'Risk', 'Impacted claims', 'Manuscript action', 'Required disposition'], revisionRows)}
`
}

const plan = buildPlan({
  noveltySourceReviewPackets: readJson(inputs.noveltySourceReviewPackets),
  noveltyResolutionMatrix: readJson(inputs.noveltyResolutionMatrix),
  noveltyFinalizationPreflight: readJson(inputs.noveltyFinalizationPreflight),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
})

writeJson(planJsonPath, plan)
writeReport(planMarkdownPath, renderMarkdown(plan))

console.log(`Wrote hard grounded novelty claim revision plan to ${planJsonPath}`)
console.log(`Wrote hard grounded novelty claim revision plan report to ${planMarkdownPath}`)
