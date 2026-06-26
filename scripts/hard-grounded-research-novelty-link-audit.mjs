import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const auditJsonPath = join(generatedDir, 'novelty-link-audit.json')
const auditMarkdownPath = join(experimentDir, 'NOVELTY_LINK_AUDIT.md')

const inputs = {
  noveltyWatchlist: join(generatedDir, 'novelty-watchlist.json'),
  noveltySourceReviewPackets: join(generatedDir, 'novelty-source-review-packets.json'),
  noveltyClaimRevisionPlan: join(generatedDir, 'novelty-claim-revision-plan.json'),
}

const manualChecks = {
  'faithjudge-2026': {
    expected_title: 'FaithJudge: Evaluating Intrinsic and Extrinsic Hallucinations in Retrieval-Augmented Generation',
    checked_url: 'https://arxiv.org/html/2606.21923v1',
    observed_status: 'not_found',
    observed_title: null,
    verification_evidence: 'Manual web check on 2026-06-26 found the referenced arXiv HTML URL unavailable for the expected title.',
    action: 'quarantine_until_primary_source_found',
  },
  'faithfulness-qa-2026': {
    expected_title: 'Faithfulness-QA: Evaluating Long-Context Large Language Models Through Counterfactual Contexts',
    checked_url: 'https://arxiv.org/html/2606.03962v1',
    observed_status: 'title_mismatch',
    observed_title: 'Using Reward Uncertainty to Optimize LLM Time to Think',
    verification_evidence: 'Manual web check on 2026-06-26 found the URL resolves to a different arXiv paper than the expected Faithfulness-QA title.',
    action: 'replace_url_before_adjudication',
  },
  'dora-2026': {
    expected_title: 'Benchmarking Domain-Specific Retrieval-Augmented Generation for Real-World Question Answering in Privacy Policies',
    checked_url: 'https://arxiv.org/html/2601.10870v3',
    observed_status: 'unverified_primary_source',
    observed_title: null,
    verification_evidence: 'Manual web search on 2026-06-26 did not establish a primary source for the expected title at the recorded URL.',
    action: 'quarantine_until_primary_source_found',
  },
  'hierarag-2026': {
    expected_title: 'RAG Benchmarking: A Hierarchical Review of Methods and Evaluation Perspectives',
    checked_url: 'https://arxiv.org/html/2606.12159v1',
    observed_status: 'unverified_primary_source',
    observed_title: null,
    verification_evidence: 'Manual web search on 2026-06-26 did not establish a primary source for the expected title at the recorded URL.',
    action: 'quarantine_until_primary_source_found',
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

function buildAudit({ noveltyWatchlist, noveltySourceReviewPackets, noveltyClaimRevisionPlan }) {
  const packetBySource = new Map(noveltySourceReviewPackets.packets.map((packet) => [packet.source_id, packet]))
  const revisionBySource = new Map(noveltyClaimRevisionPlan.revisions.map((revision) => [revision.source_id, revision]))
  const sources = Object.entries(manualChecks).map(([sourceId, check]) => {
    const packet = packetBySource.get(sourceId)
    const revision = revisionBySource.get(sourceId)
    return {
      source_id: sourceId,
      packet_id: packet?.packet_id || null,
      novelty_risk: packet?.novelty_risk || 'unknown',
      expected_title: check.expected_title,
      checked_url: check.checked_url,
      observed_status: check.observed_status,
      observed_title: check.observed_title,
      verification_evidence: check.verification_evidence,
      action: check.action,
      quarantined: check.observed_status !== 'primary_source_verified',
      impacted_claim_ids: revision?.impacted_claim_ids || [],
      required_disposition: revision?.disposition_required || 'must_resolve_before_final',
    }
  })
  const checks = [
    {
      id: 'all_watchlist_sources_checked',
      passed: sources.length === noveltyWatchlist.summary.watchlist_source_count,
      detail: `${sources.length}/${noveltyWatchlist.summary.watchlist_source_count} watchlist sources have link-audit entries`,
    },
    {
      id: 'all_packets_linked',
      passed: sources.every((source) => source.packet_id),
      detail: `${sources.filter((source) => source.packet_id).length}/${sources.length} source packets linked`,
    },
    {
      id: 'quarantine_preserved',
      passed: sources.some((source) => source.quarantined) && noveltyClaimRevisionPlan.summary.completion_claim_allowed === false,
      detail: `${sources.filter((source) => source.quarantined).length} sources quarantined; completion_claim_allowed=${noveltyClaimRevisionPlan.summary.completion_claim_allowed}`,
    },
  ]
  return {
    novelty_link_audit_ready: checks.every((check) => check.passed),
    version: 'novelty-link-audit-v1',
    checked_date: '2026-06-26',
    completion_claim_allowed: false,
    final_novelty_claim_allowed: false,
    generated_from: {
      novelty_watchlist: 'generated/novelty-watchlist.json',
      novelty_source_review_packets: 'generated/novelty-source-review-packets.json',
      novelty_claim_revision_plan: 'generated/novelty-claim-revision-plan.json',
      manual_web_check: '2026-06-26 web verification of recorded novelty source URLs and titles',
    },
    checks,
    sources,
    summary: {
      checked_sources: sources.length,
      quarantined_sources: sources.filter((source) => source.quarantined).length,
      title_mismatches: sources.filter((source) => source.observed_status === 'title_mismatch').length,
      not_found_sources: sources.filter((source) => source.observed_status === 'not_found').length,
      unverified_primary_sources: sources.filter((source) => source.observed_status === 'unverified_primary_source').length,
      final_novelty_claim_allowed: false,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(audit) {
  const sourceRows = audit.sources.map((source) => [
    source.source_id,
    source.novelty_risk,
    source.observed_status,
    source.quarantined ? 'yes' : 'no',
    source.checked_url,
    source.action,
  ])
  const checkRows = audit.checks.map((check) => [check.id, String(check.passed), check.detail])
  return `# Hard Grounded Research Novelty Link Audit

This generated audit records whether unresolved novelty-watchlist links point to the expected primary sources. It does not resolve novelty; it quarantines invalid or unverified related-work sources until a primary source and title match are established.

## Summary

- Audit ready: ${audit.novelty_link_audit_ready}
- Version: ${audit.version}
- Date checked: ${audit.checked_date}
- Checked sources: ${audit.summary.checked_sources}
- Quarantined sources: ${audit.summary.quarantined_sources}
- Title mismatches: ${audit.summary.title_mismatches}
- Not-found sources: ${audit.summary.not_found_sources}
- Unverified primary sources: ${audit.summary.unverified_primary_sources}
- Final novelty claim allowed: ${audit.summary.final_novelty_claim_allowed}
- Completion claim allowed: ${audit.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Source Link Status

${markdownTable(['Source', 'Risk', 'Observed status', 'Quarantined', 'Checked URL', 'Action'], sourceRows)}
`
}

const audit = buildAudit({
  noveltyWatchlist: readJson(inputs.noveltyWatchlist),
  noveltySourceReviewPackets: readJson(inputs.noveltySourceReviewPackets),
  noveltyClaimRevisionPlan: readJson(inputs.noveltyClaimRevisionPlan),
})

writeJson(auditJsonPath, audit)
writeText(auditMarkdownPath, renderMarkdown(audit))

console.log(`Wrote hard grounded novelty link audit to ${auditJsonPath}`)
console.log(`Wrote hard grounded novelty link audit report to ${auditMarkdownPath}`)
