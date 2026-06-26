import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const outputJsonPath = join(generatedDir, 'novelty-source-identity-audit.json')
const outputMarkdownPath = join(experimentDir, 'NOVELTY_SOURCE_IDENTITY_AUDIT.md')

const inputs = {
  noveltyWatchlist: join(generatedDir, 'novelty-watchlist.json'),
  noveltyResolutionMatrix: join(generatedDir, 'novelty-resolution-matrix.json'),
}

const checkedDate = '2026-06-26'

const liveIdentityChecks = {
  'faithjudge-2026': {
    url_status: '404_not_found',
    observed_title: 'arXiv e-print repository',
    title_matches_watchlist: false,
    identity_verified: false,
    live_check_method: 'curl -L https://arxiv.org/html/2606.21923v1 returned HTTP 404; arXiv title search returned no exact result.',
    required_action: 'Replace with a verified source URL or remove from novelty pressure set before final related-work adjudication.',
  },
  'faithfulness-qa-2026': {
    url_status: '200_wrong_paper',
    observed_title: 'Using Reward Uncertainty to Induce Diverse Behaviour in Reinforcement Learning',
    title_matches_watchlist: false,
    identity_verified: false,
    live_check_method: 'curl -L https://arxiv.org/html/2606.03962v1 returned HTTP 200 but the page title is unrelated; arXiv title search returned no exact result.',
    required_action: 'Replace with the correct Faithfulness-QA source if it exists, otherwise remove it from final novelty pressure claims.',
  },
  'dora-2026': {
    url_status: '404_not_found',
    observed_title: 'arXiv e-print repository',
    title_matches_watchlist: false,
    identity_verified: false,
    live_check_method: 'curl -L https://arxiv.org/html/2601.10870v3 returned HTTP 404; arXiv title search returned no exact result.',
    required_action: 'Replace with a verified DORA/privacy-policy RAG source URL or remove from novelty pressure set before final related-work adjudication.',
  },
  'hierarag-2026': {
    url_status: '200_wrong_paper',
    observed_title: 'Grand-canonical phase diagram and chiral-current suppression at pi flux in a bosonic two-leg ladder',
    title_matches_watchlist: false,
    identity_verified: false,
    live_check_method: 'curl -L https://arxiv.org/html/2606.12159v1 returned HTTP 200 but the page title is an unrelated condensed-matter paper.',
    required_action: 'Replace with a verified hierarchical RAG review source or remove from novelty pressure set before final related-work adjudication.',
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

function buildAudit({ noveltyWatchlist, noveltyResolutionMatrix }) {
  const resolutionIds = new Set((noveltyResolutionMatrix.source_resolutions || []).map((source) => source.source_id))
  const sources = noveltyWatchlist.watchlist_sources.map((source) => {
    const identity = liveIdentityChecks[source.id] || {
      url_status: 'not_checked',
      observed_title: '',
      title_matches_watchlist: false,
      identity_verified: false,
      live_check_method: 'No source identity check registered.',
      required_action: 'Add a live source identity check before final related-work adjudication.',
    }
    return {
      source_id: source.id,
      watchlist_title: source.title,
      watchlist_url: source.url,
      novelty_risk: source.novelty_risk,
      in_resolution_matrix: resolutionIds.has(source.id),
      ...identity,
      final_audit_eligible: identity.identity_verified && resolutionIds.has(source.id),
    }
  })
  const invalidSources = sources.filter((source) => !source.identity_verified)
  const checks = [
    {
      id: 'watchlist_sources_checked',
      passed: sources.length === noveltyWatchlist.summary.watchlist_source_count,
      detail: `${sources.length}/${noveltyWatchlist.summary.watchlist_source_count} watchlist sources identity-checked`,
    },
    {
      id: 'resolution_matrix_linked',
      passed: sources.every((source) => source.in_resolution_matrix),
      detail: `${sources.filter((source) => source.in_resolution_matrix).length}/${sources.length} sources linked to resolution matrix`,
    },
    {
      id: 'invalid_sources_block_final_novelty',
      passed: invalidSources.length > 0,
      detail: `${invalidSources.length}/${sources.length} watchlist sources have unverified or mismatched identity`,
    },
    {
      id: 'completion_claim_blocked',
      passed: invalidSources.length > 0,
      detail: 'completion_claim_allowed=false until every final-audit source is identity-verified',
    },
  ]

  return {
    novelty_source_identity_audit_ready: checks.every((check) => check.passed),
    version: 'novelty-source-identity-audit-v1',
    checked_date: checkedDate,
    completion_claim_allowed: false,
    generated_from: {
      novelty_watchlist: 'generated/novelty-watchlist.json',
      novelty_resolution_matrix: 'generated/novelty-resolution-matrix.json',
      live_source_checks: 'curl and arXiv title search checks run on 2026-06-26',
    },
    checks,
    sources,
    required_final_actions: [
      'Replace or remove every watchlist source whose URL is missing or points to an unrelated paper.',
      'Do not use unverified watchlist sources as evidence for or against novelty claims.',
      'Regenerate novelty watchlist, resolution matrix, finalization preflight, paper claim ledger, and release gate after source repair.',
    ],
    summary: {
      watchlist_sources: sources.length,
      identity_verified_sources: sources.filter((source) => source.identity_verified).length,
      invalid_or_unverified_sources: invalidSources.length,
      final_audit_eligible_sources: sources.filter((source) => source.final_audit_eligible).length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(audit) {
  const checkRows = audit.checks.map((check) => [check.id, String(check.passed), check.detail])
  const sourceRows = audit.sources.map((source) => [
    source.source_id,
    `[${source.watchlist_title}](${source.watchlist_url})`,
    source.url_status,
    source.observed_title,
    String(source.identity_verified),
    source.required_action,
  ])
  const actionRows = audit.required_final_actions.map((action, index) => [String(index + 1), action])

  return `# Hard Grounded Research Novelty Source Identity Audit

This generated audit checks whether live-search novelty watchlist sources are actually identifiable before they can be used in final related-work adjudication. It intentionally blocks completion claims when watchlist URLs are missing, stale, or point to unrelated papers.

## Summary

- Audit ready: ${audit.novelty_source_identity_audit_ready}
- Version: ${audit.version}
- Date checked: ${audit.checked_date}
- Watchlist sources: ${audit.summary.watchlist_sources}
- Identity-verified sources: ${audit.summary.identity_verified_sources}
- Invalid or unverified sources: ${audit.summary.invalid_or_unverified_sources}
- Final-audit eligible sources: ${audit.summary.final_audit_eligible_sources}
- Completion claim allowed: ${audit.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Source Identity Checks

${markdownTable(['ID', 'Watchlist source', 'URL status', 'Observed title', 'Identity verified', 'Required action'], sourceRows)}

## Required Final Actions

${markdownTable(['#', 'Action'], actionRows)}
`
}

const audit = buildAudit({
  noveltyWatchlist: readJson(inputs.noveltyWatchlist),
  noveltyResolutionMatrix: readJson(inputs.noveltyResolutionMatrix),
})

writeJson(outputJsonPath, audit)
writeText(outputMarkdownPath, renderMarkdown(audit))

console.log(`Wrote hard grounded novelty source identity audit to ${outputJsonPath}`)
console.log(`Wrote hard grounded novelty source identity audit report to ${outputMarkdownPath}`)
