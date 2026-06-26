import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const watchlistJsonPath = join(generatedDir, 'novelty-watchlist.json')
const watchlistMarkdownPath = join(experimentDir, 'NOVELTY_WATCHLIST.md')

const inputs = {
  noveltyAudit: join(generatedDir, 'novelty-audit.json'),
  noveltyEvidence: join(generatedDir, 'novelty-evidence.json'),
}

const checkedDate = '2026-06-26'

const watchlistSources = [
  {
    id: 'faithjudge-2026',
    title: 'FaithJudge: Evaluating Intrinsic and Extrinsic Hallucinations in Retrieval-Augmented Generation',
    year: 2026,
    url: 'https://arxiv.org/html/2606.21923v1',
    live_search_query: 'RAG benchmark 2026 citation faithfulness source authority contradiction temporal QA',
    pressure_points: ['citation supports fact but not conclusion', 'evidence insufficiency / abstention'],
    novelty_risk: 'medium',
    required_resolution:
      'Confirm whether FaithJudge evaluates conclusion-level support or only retrieved-context faithfulness and hallucination detection.',
  },
  {
    id: 'faithfulness-qa-2026',
    title: 'Faithfulness-QA: Evaluating Long-Context Large Language Models Through Counterfactual Contexts',
    year: 2026,
    url: 'https://arxiv.org/html/2606.03962v1',
    live_search_query: 'Novelty Benchmarks for RAG 2026 arxiv grounded QA benchmark citation faithfulness',
    pressure_points: ['entity disambiguation', 'stale-vs-current document conflicts', 'citation supports fact but not conclusion'],
    novelty_risk: 'medium',
    required_resolution:
      'Check whether counterfactual entity substitution overlaps the proposed same-name entity and stale/current evidence categories.',
  },
  {
    id: 'dora-2026',
    title: 'Benchmarking Domain-Specific Retrieval-Augmented Generation for Real-World Question Answering in Privacy Policies',
    year: 2026,
    url: 'https://arxiv.org/html/2601.10870v3',
    live_search_query: 'RAG benchmark 2026 citation faithfulness source authority contradiction temporal QA',
    pressure_points: ['source authority conflicts', 'evidence insufficiency / abstention', 'large-corpus research QA'],
    novelty_risk: 'medium',
    required_resolution:
      'Verify whether domain-specific legal/privacy RAG covers authority hierarchy or only domain-grounded retrieval and answer correctness.',
  },
  {
    id: 'hierarag-2026',
    title: 'RAG Benchmarking: A Hierarchical Review of Methods and Evaluation Perspectives',
    year: 2026,
    url: 'https://arxiv.org/html/2606.12159v1',
    live_search_query: 'Novelty Benchmarks for RAG 2026 arxiv grounded QA benchmark citation faithfulness',
    pressure_points: ['generic RAG benchmark claim', 'benchmark taxonomy framing'],
    novelty_risk: 'high',
    required_resolution:
      'Use the review taxonomy to ensure the paper does not claim generic RAG benchmark novelty and instead names the hard-grounded failure taxonomy contribution.',
  },
]

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

function buildWatchlist({ noveltyAudit, noveltyEvidence }) {
  const existingIds = new Set((noveltyEvidence.sources || []).map((source) => source.id))
  const unresolvedSources = watchlistSources.filter((source) => !existingIds.has(source.id))
  const highRiskSources = watchlistSources.filter((source) => source.novelty_risk === 'high')

  return {
    novelty_watchlist_ready: true,
    version: 'novelty-watchlist-v1',
    checked_date: checkedDate,
    completion_claim_allowed: false,
    generated_from: {
      novelty_audit: 'generated/novelty-audit.json',
      novelty_evidence: 'generated/novelty-evidence.json',
      live_search_queries: [
        'Novelty Benchmarks for RAG 2026 arxiv grounded QA benchmark citation faithfulness',
        'RAG benchmark 2026 citation faithfulness source authority contradiction temporal QA',
      ],
    },
    watchlist_sources: watchlistSources,
    final_audit_requirements: [
      'Decide whether each watchlist source is already covered by novelty-evidence or must be added to the final related-work table.',
      'Update claim boundaries if any watchlist source directly covers document lifecycle, source authority, citation-overreach, or unified hard-grounded taxonomy claims.',
      'Keep completion_claim_allowed false until human review, category scale, and final novelty audit all pass.',
    ],
    summary: {
      checked_date: checkedDate,
      watchlist_source_count: watchlistSources.length,
      unresolved_source_count: unresolvedSources.length,
      high_risk_source_count: highRiskSources.length,
      existing_registry_source_count: noveltyEvidence.source_count,
      novelty_audit_status: noveltyAudit.status,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(watchlist) {
  const sourceRows = watchlist.watchlist_sources.map((source) => [
    source.id,
    `[${source.title}](${source.url})`,
    String(source.year),
    source.novelty_risk,
    source.pressure_points.join('<br>'),
    source.required_resolution,
  ])
  const requirementRows = watchlist.final_audit_requirements.map((requirement, index) => [
    String(index + 1),
    requirement,
  ])

  return `# Hard Grounded Research Novelty Watchlist

This generated watchlist records live-search related work that must be resolved before the novelty audit can become final. It is a surveillance artifact, not a completion claim.

## Summary

- Watchlist ready: ${watchlist.novelty_watchlist_ready}
- Version: ${watchlist.version}
- Date checked: ${watchlist.checked_date}
- Watchlist sources: ${watchlist.summary.watchlist_source_count}
- Unresolved against existing registry: ${watchlist.summary.unresolved_source_count}
- High-risk sources: ${watchlist.summary.high_risk_source_count}
- Existing registry sources: ${watchlist.summary.existing_registry_source_count}
- Novelty audit status: ${watchlist.summary.novelty_audit_status}
- Completion claim allowed: ${watchlist.summary.completion_claim_allowed}

## Watchlist Sources

${markdownTable(['ID', 'Source', 'Year', 'Risk', 'Pressure points', 'Required resolution'], sourceRows)}

## Final Audit Requirements

${markdownTable(['#', 'Requirement'], requirementRows)}
`
}

const watchlist = buildWatchlist({
  noveltyAudit: readJson(inputs.noveltyAudit),
  noveltyEvidence: readJson(inputs.noveltyEvidence),
})

writeJson(watchlistJsonPath, watchlist)
writeText(watchlistMarkdownPath, renderMarkdown(watchlist))
