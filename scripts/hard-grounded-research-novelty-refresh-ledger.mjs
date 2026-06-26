import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const ledgerJsonPath = join(generatedDir, 'novelty-refresh-ledger.json')
const ledgerMarkdownPath = join(experimentDir, 'NOVELTY_REFRESH_LEDGER.md')

const checkedDate = '2026-06-26'

const searchQueries = [
  {
    query: '2026 benchmark grounded research QA large corpus RAG citation faithfulness temporal conflict benchmark arxiv',
    purpose: 'Refresh broad overlap against large-corpus grounded QA and RAG benchmark work.',
  },
  {
    query: '2026 RAG benchmark evidence sufficiency abstention citation faithfulness large corpus QA',
    purpose: 'Refresh evidence sufficiency, abstention, and citation-faithfulness overlap.',
  },
  {
    query: '2026 temporal RAG benchmark stale current documents as of date question answering',
    purpose: 'Refresh temporal, stale/current, and as-of-date overlap.',
  },
  {
    query: '2026 source authority conflict citation benchmark RAG',
    purpose: 'Refresh source-authority, contradiction, and citation-traceability overlap.',
  },
  {
    query: '2026 cited RAG evidence force benchmark citation supports claim conclusion',
    purpose: 'Refresh citation-support, evidence-force, and conclusion-overreach overlap.',
  },
  {
    query: '2026 table text RAG benchmark abstention integration benchmark',
    purpose: 'Refresh table-text, integration, and abstention benchmark overlap.',
  },
]

const sources = [
  {
    id: 'conflictrag-2025',
    title: 'ConflictRAG: Detecting and Resolving Knowledge Conflicts in Retrieval Augmented Generation',
    year: 2026,
    url: 'https://arxiv.org/abs/2605.17301',
    overlap: ['cross-document contradiction', 'stale-vs-current document conflicts', 'source authority conflicts'],
    novelty_action:
      'Treat contradiction and conflict detection as crowded; preserve novelty only for controlled research QA combinations with authority hierarchy, lifecycle, temporal snapshot, insufficiency, and conclusion-support labels.',
  },
  {
    id: 'inter-context-conflicts-2025',
    title: 'Retrieval-Augmented Generation with Conflicting Evidence',
    year: 2025,
    url: 'https://arxiv.org/abs/2504.13079',
    overlap: ['cross-document contradiction', 'source authority conflicts', 'evidence insufficiency / abstention'],
    novelty_action:
      'Do not claim conflict resolution alone. Use this as evidence that hard-grounded research needs explicit conflict provenance and answerability rubrics.',
  },
  {
    id: 'citerag-2026',
    title: 'What Should I Cite? A RAG Benchmark for Academic Citation Prediction',
    year: 2026,
    url: 'https://arxiv.org/abs/2601.14949',
    overlap: ['citation supports fact but not conclusion', 'citation faithfulness', 'grounded evidence'],
    novelty_action:
      'Frame citation-overreach as conclusion-support semantics, not as citation generation or citation recall.',
  },
  {
    id: 'sufficient-context-2025',
    title: 'Sufficient Context: A New Lens on Retrieval Augmented Generation Systems',
    year: 2025,
    url: 'https://arxiv.org/abs/2411.06037',
    overlap: ['evidence insufficiency / abstention', 'answerability', 'retrieval sufficiency'],
    novelty_action:
      'Keep abstention claims narrow; require hard-grounded items to distinguish insufficient evidence from wrong citation use and conclusion overreach.',
  },
  {
    id: 'mudabench-2026',
    title: 'MuDABench: A Benchmark for Multi-Document Analytical QA',
    year: 2026,
    url: 'https://arxiv.org/abs/2604.22239',
    overlap: ['multi-hop synthesis', 'table + text reasoning', 'large-corpus research QA'],
    novelty_action:
      'Avoid claiming atypical-document RAG novelty; position the benchmark around cross-category failure mechanisms.',
  },
  {
    id: 'globalqa-2025',
    title: 'Towards Global Retrieval Augmented Generation: A Benchmark for Global QA',
    year: 2025,
    url: 'https://arxiv.org/abs/2510.26205',
    overlap: ['multi-hop synthesis', 'large-corpus QA', 'global information synthesis'],
    novelty_action:
      'Treat large-scale synthesis as adjacent; require contribution language to emphasize evidence semantics and controlled failure categories.',
  },
  {
    id: 'ragchecker-2024',
    title: 'RAGChecker: A Fine-grained Framework for Diagnosing Retrieval-Augmented Generation',
    year: 2024,
    url: 'https://arxiv.org/abs/2408.08067',
    overlap: ['citation faithfulness', 'retrieval diagnostics', 'answer support'],
    novelty_action:
      'Cite diagnostic metric work separately from benchmark construction; do not claim fine-grained RAG diagnosis as novel.',
  },
  {
    id: 'ragbench-2024',
    title: 'RAGBench: Explainable Benchmark for Retrieval-Augmented Generation Systems',
    year: 2024,
    url: 'https://arxiv.org/abs/2407.11005',
    overlap: ['large-corpus retrieval', 'domain-grounded documents', 'answer support'],
    novelty_action:
      'Use as older background for retrieval/context selection, not as a central novelty risk.',
  },
  {
    id: 'lit-ragbench-2026',
    title: 'LIT-RAGBench: A Benchmark for Evaluating Language Models as Integrated Tabular and Textual Retrieval-Augmented Generation Systems',
    year: 2026,
    url: 'https://arxiv.org/abs/2606.14079',
    overlap: ['table + text reasoning', 'evidence insufficiency / abstention', 'large-corpus research QA'],
    novelty_action:
      'Cite as a high-pressure integration and abstention comparator; preserve novelty only for the full hard-grounded research taxonomy and HF-derived lifecycle/authority/citation-overreach construction.',
  },
  {
    id: 'forcebench-2026',
    title: 'Is This Snippet Worth Citing? Towards Evidence Force in Cited-RAG',
    year: 2026,
    url: 'https://arxiv.org/abs/2605.16117',
    overlap: ['citation supports fact but not conclusion', 'evidence insufficiency / abstention', 'source authority conflicts'],
    novelty_action:
      'Treat evidence-force and citation-worthiness as crowded; narrow citation-overreach claims to conclusion-level support in multi-document research QA.',
  },
  {
    id: 't2-ragbench-2026',
    title: 'T2-RAGBench: Benchmarking Retrieval-Augmented Generation over Text-and-Table Data',
    year: 2026,
    url: 'https://aclanthology.org/2026.eacl-main.121/',
    overlap: ['table + text reasoning', 'multi-hop synthesis', 'large-corpus research QA'],
    novelty_action:
      'Cite as a text-table RAG benchmark and avoid claiming table-text reasoning novelty except as one category in the broader hard-grounded research QA failure suite.',
  },
]

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

function buildLedger() {
  const categoryRisks = new Map()
  for (const source of sources) {
    for (const category of source.overlap) {
      categoryRisks.set(category, (categoryRisks.get(category) || 0) + 1)
    }
  }

  return {
    novelty_refresh_ledger_ready: true,
    version: 'novelty-refresh-ledger-v1',
    checked_date: checkedDate,
    completion_claim_allowed: false,
    final_novelty_claim_allowed: false,
    generated_from: {
      live_search: 'web search performed 2026-06-26',
      novelty_audit: 'NOVELTY_AUDIT.md',
      novelty_finalization_preflight: 'generated/novelty-finalization-preflight.json',
    },
    search_queries: searchQueries,
    sources,
    category_risks: [...categoryRisks.entries()].map(([category, overlapping_sources]) => ({
      category,
      overlapping_sources,
      implication:
        overlapping_sources >= 2
          ? 'High overlap: claim only as part of the unified hard-grounded research taxonomy.'
          : 'Moderate overlap: keep category-specific novelty caveated until final source review.',
    })),
    required_final_actions: [
      'Re-run these queries immediately before submission and add any new 2026-2027 sources.',
      'Read every source in this ledger and either cite it, mark it out of scope with evidence, or narrow affected claims.',
      'Update the novelty audit from preliminary to final only after human review, category scale, and source-overlap adjudication pass.',
      'Keep completion blocked while final_novelty_claim_allowed is false.',
    ],
    summary: {
      query_count: searchQueries.length,
      source_count: sources.length,
      category_risk_count: categoryRisks.size,
      high_overlap_categories: [...categoryRisks.values()].filter((count) => count >= 2).length,
      completion_claim_allowed: false,
      final_novelty_claim_allowed: false,
    },
  }
}

function renderMarkdown(ledger) {
  const queryRows = ledger.search_queries.map((query) => [query.query, query.purpose])
  const sourceRows = ledger.sources.map((source) => [
    source.id,
    `${source.title} (${source.year})`,
    source.overlap.join('<br>'),
    source.novelty_action,
  ])
  const riskRows = ledger.category_risks.map((risk) => [
    risk.category,
    String(risk.overlapping_sources),
    risk.implication,
  ])
  const actionRows = ledger.required_final_actions.map((action, index) => [String(index + 1), action])

  return `# Hard Grounded Research Novelty Refresh Ledger

This generated ledger records the June 26, 2026 live-search refresh that must be adjudicated before any final novelty claim. It is not a completion claim.

## Summary

- Ledger ready: ${ledger.novelty_refresh_ledger_ready}
- Version: ${ledger.version}
- Date checked: ${ledger.checked_date}
- Queries: ${ledger.summary.query_count}
- Sources: ${ledger.summary.source_count}
- Category risks: ${ledger.summary.category_risk_count}
- High-overlap categories: ${ledger.summary.high_overlap_categories}
- Final novelty claim allowed: ${ledger.summary.final_novelty_claim_allowed}
- Completion claim allowed: ${ledger.summary.completion_claim_allowed}

## Search Queries

${markdownTable(['Query', 'Purpose'], queryRows)}

## Refreshed Adjacent Sources

${markdownTable(['Source', 'Title', 'Overlap', 'Required novelty action'], sourceRows)}

## Category Risk Updates

${markdownTable(['Category', 'Overlapping sources', 'Implication'], riskRows)}

## Required Final Actions

${markdownTable(['#', 'Action'], actionRows)}
`
}

const ledger = buildLedger()
writeJson(ledgerJsonPath, ledger)
writeText(ledgerMarkdownPath, renderMarkdown(ledger))

console.log(`Wrote hard grounded novelty refresh ledger to ${ledgerJsonPath}`)
console.log(`Wrote hard grounded novelty refresh ledger report to ${ledgerMarkdownPath}`)
