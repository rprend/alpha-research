import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const evidenceJsonPath = join(generatedDir, 'novelty-evidence.json')
const evidenceMarkdownPath = join(experimentDir, 'NOVELTY_EVIDENCE.md')

const checkedDate = '2026-06-26'

const sources = [
  {
    id: 'occ-rag-2026',
    title: 'OCC-RAG: Optimal Cognitive Core for Faithful Question Answering',
    year: 2026,
    url: 'https://arxiv.org/html/2606.00683v1',
    source_type: 'paper',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['multi-hop synthesis', 'evidence insufficiency / abstention', 'citation faithfulness'],
    paper_use:
      'Cite as close work on faithful QA and multi-hop grounded answer generation; do not claim multi-hop or abstention alone as novel.',
  },
  {
    id: 'chronoqa-2025',
    title: 'ChronoQA: A Question Answering Dataset for Temporal-Sensitive Retrieval-Augmented Generation',
    year: 2025,
    url: 'https://www.nature.com/articles/s41597-025-06098-y',
    source_type: 'paper_and_dataset',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['temporal questions: as of date X', 'stale-vs-current document conflicts'],
    paper_use:
      'Cite as close temporal RAG work; position hard-grounded temporal tasks around document snapshot validity and source-state conflict, not generic temporal QA.',
  },
  {
    id: 'bridge-2026',
    title: 'BRIDGE: Benchmark for multi-hop Reasoning In long multimodal Documents with Grounded Evidence',
    year: 2026,
    url: 'https://arxiv.org/html/2603.07931v1',
    source_type: 'paper',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['multi-hop synthesis', 'table + text reasoning', 'grounded scientific evidence'],
    paper_use:
      'Cite as close work on long-document grounded evidence; separate our claim by source authority, lifecycle, stale/current, and conclusion-overreach categories.',
  },
  {
    id: 'lit-ragbench-2026',
    title: 'LIT-RAGBench: Benchmarking Generator Capabilities of Large Language Models in Retrieval-Augmented Generation',
    year: 2026,
    url: 'https://arxiv.org/html/2603.06198v1',
    source_type: 'paper',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['evidence insufficiency / abstention', 'cross-document contradiction'],
    paper_use:
      'Cite as close RAG generator benchmark; avoid claiming contradiction or insufficiency alone as novel.',
  },
  {
    id: 'longcite-2024',
    title: 'LongCite and LongBench-Cite',
    year: 2024,
    url: 'https://github.com/THUDM/LongCite',
    source_type: 'paper_dataset_code',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['citation supports fact but not conclusion', 'citation faithfulness', 'long-context QA'],
    paper_use:
      'Cite as close citation benchmark; define our differentiator as conclusion support rather than citation presence or localized attribution alone.',
  },
  {
    id: '100-longbench-2025',
    title: '100-LongBench: Are de facto Long-Context Benchmarks Literally Evaluating Long-Context Ability?',
    year: 2025,
    url: 'https://aclanthology.org/2025.findings-acl.903/',
    source_type: 'paper',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['long-context evaluation validity'],
    paper_use:
      'Cite for benchmark-design caution; use to justify controlled hard-grounded failure modes rather than context length as the central axis.',
  },
]

const claimGuidance = [
  {
    claim: 'Generic RAG benchmark',
    status: 'not_novel',
    reason: 'Adjacent RAG and long-context benchmarks are abundant.',
  },
  {
    claim: 'Temporal QA benchmark',
    status: 'not_novel_alone',
    reason: 'ChronoQA already targets temporal-sensitive RAG.',
  },
  {
    claim: 'Citation faithfulness benchmark',
    status: 'not_novel_alone',
    reason: 'LongCite and related citation benchmarks cover attribution quality.',
  },
  {
    claim: 'Unified hard-grounded research failure taxonomy',
    status: 'plausibly_differentiated_pending_final_audit',
    reason:
      'The combined bundle of lifecycle changes, authority hierarchy, stale/current snapshots, conclusion-overreach, insufficiency, disambiguation, and contradiction remains the defensible contribution if supported by reviewed data.',
  },
]

const categoryEvidence = [
  ['multi-hop synthesis', ['occ-rag-2026', 'bridge-2026'], 'high'],
  ['stale-vs-current document conflicts', ['chronoqa-2025'], 'medium'],
  ['appended document lifecycle changes', ['bridge-2026'], 'low'],
  ['table + text reasoning', ['bridge-2026'], 'high'],
  ['source authority conflicts', ['lit-ragbench-2026'], 'medium'],
  ['evidence insufficiency / abstention', ['occ-rag-2026', 'lit-ragbench-2026'], 'high'],
  ['citation supports fact but not conclusion', ['longcite-2024'], 'medium'],
  ['entity disambiguation', ['occ-rag-2026'], 'medium'],
  ['temporal questions: as of date X', ['chronoqa-2025'], 'high'],
  ['cross-document contradiction', ['lit-ragbench-2026'], 'high'],
].map(([category, sourceIds, noveltyRisk]) => ({
  category,
  source_ids: sourceIds,
  novelty_risk: noveltyRisk,
}))

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

function buildEvidence() {
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    checked_date: checkedDate,
    evidence_status: 'preliminary_registry_not_final_completion_audit',
    source_count: sources.length,
    completion_claim_allowed: false,
    sources,
    claim_guidance: claimGuidance,
    category_evidence: categoryEvidence,
  }
}

function renderMarkdown(evidence) {
  const sourceRows = evidence.sources.map((source) => [
    source.id,
    `[${source.title}](${source.url})`,
    String(source.year),
    source.benchmark_overlap.join('<br>'),
    source.paper_use,
  ])
  const claimRows = evidence.claim_guidance.map((claim) => [claim.claim, claim.status, claim.reason])
  const categoryRows = evidence.category_evidence.map((entry) => [
    entry.category,
    entry.novelty_risk,
    entry.source_ids.join('<br>'),
  ])

  return `# Hard Grounded Research Novelty Evidence

This generated registry records related-work evidence checked for the benchmark novelty argument. It is not a final completion audit and does not allow a novelty claim by itself.

## Summary

- Date checked: ${evidence.checked_date}
- Sources: ${evidence.source_count}
- Evidence status: ${evidence.evidence_status}
- Completion claim allowed: ${evidence.completion_claim_allowed}

## Source Registry

${markdownTable(['ID', 'Source', 'Year', 'Overlap', 'Paper-use note'], sourceRows)}

## Claim Guidance

${markdownTable(['Claim', 'Status', 'Reason'], claimRows)}

## Category Evidence Map

${markdownTable(['Category', 'Novelty risk', 'Closest source ids'], categoryRows)}
`
}

const evidence = buildEvidence()
writeJson(evidenceJsonPath, evidence)
writeText(evidenceMarkdownPath, renderMarkdown(evidence))

console.log(`Wrote hard grounded novelty evidence JSON to ${evidenceJsonPath}`)
console.log(`Wrote hard grounded novelty evidence report to ${evidenceMarkdownPath}`)
