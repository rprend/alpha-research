import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const packetsJsonPath = join(generatedDir, 'novelty-source-review-packets.json')
const packetsMarkdownPath = join(experimentDir, 'NOVELTY_SOURCE_REVIEW_PACKETS.md')

const inputs = {
  noveltyEvidence: join(generatedDir, 'novelty-evidence.json'),
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

function reviewQuestions(source) {
  const questions = [
    'Does this source benchmark the same hard-grounded category, or only adjacent RAG/QA behavior?',
    'Which manuscript claims must cite, narrow, or remove this source before final submission?',
    'Does the source include executable data, metrics, or review protocol that overlaps this benchmark?',
  ]
  if (source.pressure_points.includes('citation supports fact but not conclusion')) {
    questions.push('Does it test conclusion-level support, or only attribution/span/context faithfulness?')
  }
  if (source.pressure_points.includes('source authority conflicts')) {
    questions.push('Does it encode authority hierarchy, or only domain-specific retrieval and answer correctness?')
  }
  if (source.pressure_points.includes('benchmark taxonomy framing')) {
    questions.push('Does its taxonomy subsume this paper, or only require the paper to avoid generic RAG-benchmark novelty claims?')
  }
  return questions
}

function buildPackets({ noveltyEvidence, noveltyResolutionMatrix, noveltyFinalizationPreflight, paperClaimLedger }) {
  const registryIds = new Set((noveltyEvidence.sources || []).map((source) => source.id))
  const unresolvedSources = noveltyResolutionMatrix.source_resolutions.filter((source) =>
    source.final_audit_disposition !== 'resolved' || !source.already_in_registry,
  )
  const packets = unresolvedSources.map((source, index) => ({
    packet_id: `novelty_source_review_${String(index + 1).padStart(2, '0')}`,
    source_id: source.source_id,
    title: source.title,
    url: source.url,
    year: source.year,
    novelty_risk: source.novelty_risk,
    already_in_registry: registryIds.has(source.source_id),
    pressure_points: source.pressure_points,
    impacted_claims: source.impacted_claims,
    required_resolution: source.required_resolution,
    required_boundary_change: source.required_boundary_change,
    final_audit_disposition: source.final_audit_disposition,
    required_reviewer_outputs: [
      'overlap_assessment',
      'claim_boundary_update',
      'citation_action',
      'evidence_registry_action',
      'final_disposition',
      'notes',
    ],
    review_questions: reviewQuestions(source),
    acceptance_criteria: [
      'Source has been read or explicitly ruled out with date and reason.',
      'Impacted manuscript claims are updated in the paper claim ledger or marked unchanged with justification.',
      'Evidence registry action is recorded before novelty_audit_final can pass.',
      'Final disposition is one of: cite_and_narrow, cite_no_overlap, out_of_scope, subsumes_claim_remove_claim.',
    ],
  }))
  const checks = [
    {
      id: 'unresolved_sources_packetized',
      passed: packets.length === noveltyResolutionMatrix.summary.unresolved_sources,
      detail: `${packets.length}/${noveltyResolutionMatrix.summary.unresolved_sources} unresolved sources packetized`,
    },
    {
      id: 'high_risk_source_present',
      passed: packets.some((packet) => packet.novelty_risk === 'high'),
      detail: `${packets.filter((packet) => packet.novelty_risk === 'high').length} high-risk packets`,
    },
    {
      id: 'review_outputs_required',
      passed: packets.every((packet) => packet.required_reviewer_outputs.length >= 6 && packet.review_questions.length >= 3),
      detail: `${packets.length} packets with output schema and review questions`,
    },
    {
      id: 'claim_boundaries_preserved',
      passed:
        noveltyEvidence.completion_claim_allowed === false &&
        paperClaimLedger.summary?.prohibited_claims >= 3 &&
        noveltyFinalizationPreflight.summary?.completion_claim_allowed === false,
      detail: `${paperClaimLedger.summary?.prohibited_claims ?? 0} prohibited claims; completion blocked`,
    },
  ]

  return {
    novelty_source_review_packets_ready: checks.every((check) => check.passed),
    version: 'novelty-source-review-packets-v1',
    checked_date: noveltyFinalizationPreflight.checked_date,
    completion_claim_allowed: false,
    final_novelty_claim_allowed: false,
    generated_from: {
      novelty_evidence: 'generated/novelty-evidence.json',
      novelty_resolution_matrix: 'generated/novelty-resolution-matrix.json',
      novelty_finalization_preflight: 'generated/novelty-finalization-preflight.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
    },
    checks,
    packets,
    summary: {
      packets: packets.length,
      unresolved_sources: unresolvedSources.length,
      high_risk_packets: packets.filter((packet) => packet.novelty_risk === 'high').length,
      medium_risk_packets: packets.filter((packet) => packet.novelty_risk === 'medium').length,
      registry_sources: noveltyEvidence.source_count,
      required_reviewer_outputs: packets[0]?.required_reviewer_outputs.length ?? 0,
      final_novelty_claim_allowed: false,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(report) {
  const checkRows = report.checks.map((check) => [check.id, String(check.passed), check.detail])
  const packetRows = report.packets.map((packet) => [
    packet.packet_id,
    `[${packet.source_id}](${packet.url})`,
    packet.novelty_risk,
    packet.pressure_points.join('<br>'),
    packet.impacted_claims.join('<br>'),
    packet.final_audit_disposition,
  ])
  const questionRows = report.packets.flatMap((packet) =>
    packet.review_questions.map((question, index) => [packet.packet_id, String(index + 1), question]),
  )

  return `# Hard Grounded Research Novelty Source Review Packets

This generated packet set turns unresolved related-work sources into review tasks. It does not perform final novelty adjudication and does not allow completion claims.

## Summary

- Packets ready: ${report.novelty_source_review_packets_ready}
- Version: ${report.version}
- Date checked: ${report.checked_date}
- Packets: ${report.summary.packets}
- High-risk packets: ${report.summary.high_risk_packets}
- Medium-risk packets: ${report.summary.medium_risk_packets}
- Registry sources: ${report.summary.registry_sources}
- Final novelty claim allowed: ${report.summary.final_novelty_claim_allowed}
- Completion claim allowed: ${report.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Source Packets

${markdownTable(['Packet', 'Source', 'Risk', 'Pressure points', 'Impacted claims', 'Final-audit disposition'], packetRows)}

## Review Questions

${markdownTable(['Packet', '#', 'Question'], questionRows)}
`
}

const report = buildPackets({
  noveltyEvidence: readJson(inputs.noveltyEvidence),
  noveltyResolutionMatrix: readJson(inputs.noveltyResolutionMatrix),
  noveltyFinalizationPreflight: readJson(inputs.noveltyFinalizationPreflight),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
})

writeJson(packetsJsonPath, report)
writeText(packetsMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded novelty source review packets to ${packetsJsonPath}`)
console.log(`Wrote hard grounded novelty source review packets report to ${packetsMarkdownPath}`)
