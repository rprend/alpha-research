import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const auditJsonPath = join(generatedDir, 'novelty-audit.json')
const auditMarkdownPath = join(experimentDir, 'NOVELTY_AUDIT.md')

const checkedDate = '2026-06-26'

const sources = [
  {
    id: 'occ-rag-2026',
    title: 'OCC-RAG: Optimal Cognitive Core for Faithful Question Answering',
    year: 2026,
    url: 'https://arxiv.org/html/2606.00683v1',
    covers: ['multi-hop synthesis', 'evidence insufficiency / abstention', 'source-grounded citation traces'],
    gap: 'Optimizes context QA models and synthetic training data for multi-hop, faithfulness, and abstention, but does not organize evaluation around research-document lifecycle, authority, stale/current, citation-overreach, and temporal snapshot failure modes in one benchmark.',
  },
  {
    id: 'chronoqa-2025',
    title: 'ChronoQA: A Question Answering Dataset for Temporal-Sensitive Retrieval-Augmented Generation',
    year: 2025,
    url: 'https://www.nature.com/articles/s41597-025-06098-y',
    covers: ['temporal questions: as of date X', 'multi-document temporal reasoning'],
    gap: 'Strong temporal RAG coverage, including multi-document temporal questions, but not a broad grounded-research taxonomy covering authority conflicts, appended document lifecycle, conclusion-support overreach, and abstention together.',
  },
  {
    id: 'bridge-2026',
    title: 'BRIDGE: Benchmark for multi-hop Reasoning In long multimodal Documents with Grounded Evidence',
    year: 2026,
    url: 'https://arxiv.org/html/2603.07931v1',
    covers: ['multi-hop synthesis', 'table + text reasoning', 'grounded evidence in scientific papers'],
    gap: 'Covers long scientific documents and text/table/figure evidence, but focuses on multimodal multi-hop reasoning rather than stale/current conflicts, source authority, insufficiency, citation-overreach, entity ambiguity, and cross-document contradiction as a unified failure taxonomy.',
  },
  {
    id: 'lit-ragbench-2026',
    title: 'LIT-RAGBench: Benchmarking Generator Capabilities of Large Language Models in Retrieval-Augmented Generation',
    year: 2026,
    url: 'https://arxiv.org/html/2603.06198v1',
    covers: ['evidence insufficiency / abstention', 'cross-document contradiction', 'incomplete chunks'],
    gap: 'Directly adjacent for insufficiency and contradiction, but smaller and aspect-based; it does not test document lifecycle, source authority hierarchy, as-of snapshot semantics, entity disambiguation, and citation support versus conclusion support in one large-corpus research QA suite.',
  },
  {
    id: 'longcite-2024',
    title: 'LongCite / LongBench-Cite',
    year: 2024,
    url: 'https://github.com/THUDM/LongCite',
    covers: ['fine-grained citations', 'long-context QA citation quality'],
    gap: 'Evaluates citation generation and correctness in long-context QA, but citation quality alone does not distinguish cases where a cited sentence supports a fact while failing to support the research conclusion.',
  },
  {
    id: '100-longbench-2025',
    title: '100-LongBench: Are de facto Long-Context Benchmarks Literally Evaluating Long-Context Ability?',
    year: 2025,
    url: 'https://aclanthology.org/2025.findings-acl.903/',
    covers: ['long-context evaluation', 'length-controllable tasks'],
    gap: 'Targets long-context measurement validity, not grounded research QA failure categories or evidence-use semantics.',
  },
]

const categoryCoverage = [
  {
    category: 'multi-hop synthesis',
    closest_sources: ['occ-rag-2026', 'bridge-2026'],
    novelty_risk: 'high',
    differentiator: 'Must be framed as one slice inside a broader hard-grounded research taxonomy, not as a standalone multi-hop benchmark.',
  },
  {
    category: 'stale-vs-current document conflicts',
    closest_sources: ['chronoqa-2025', 'occ-rag-2026'],
    novelty_risk: 'medium',
    differentiator: 'Focus on conflicting document snapshots and explicit stale-evidence rejection rather than generic temporal reasoning or counterfactual context faithfulness.',
  },
  {
    category: 'appended document lifecycle changes',
    closest_sources: ['bridge-2026'],
    novelty_risk: 'low',
    differentiator: 'Document-state changes from appendices, errata, or later sections remain underrepresented in adjacent RAG benchmarks.',
  },
  {
    category: 'table + text reasoning',
    closest_sources: ['bridge-2026', 'occ-rag-2026'],
    novelty_risk: 'high',
    differentiator: 'Needs to stress cross-format evidence use inside research QA rather than claim novelty over text/table reasoning itself.',
  },
  {
    category: 'source authority conflicts',
    closest_sources: ['lit-ragbench-2026'],
    novelty_risk: 'medium',
    differentiator: 'Authority hierarchy is distinct from arbitrary contradiction when the benchmark encodes which source controls the conclusion.',
  },
  {
    category: 'evidence insufficiency / abstention',
    closest_sources: ['occ-rag-2026', 'lit-ragbench-2026'],
    novelty_risk: 'high',
    differentiator: 'Abstention is not novel alone; contribution depends on pairing it with citation-overreach, authority, lifecycle, and temporal constraints.',
  },
  {
    category: 'citation supports fact but not conclusion',
    closest_sources: ['longcite-2024', 'lit-ragbench-2026'],
    novelty_risk: 'medium',
    differentiator: 'The key distinction is conclusion support, not whether the cited text is real or relevant to a subfact.',
  },
  {
    category: 'entity disambiguation',
    closest_sources: ['occ-rag-2026'],
    novelty_risk: 'medium',
    differentiator: 'Needs adversarial same-name or near-name entities where citations must identify the right referent.',
  },
  {
    category: 'temporal questions: as of date X',
    closest_sources: ['chronoqa-2025'],
    novelty_risk: 'high',
    differentiator: 'Should be scoped to document snapshot validity and citation dates, not broad temporal QA.',
  },
  {
    category: 'cross-document contradiction',
    closest_sources: ['lit-ragbench-2026'],
    novelty_risk: 'high',
    differentiator: 'Contradiction is crowded; benchmark value comes from combining contradiction with source authority and research conclusions.',
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

function buildAudit() {
  const highRisk = categoryCoverage.filter((entry) => entry.novelty_risk === 'high').length
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    status: 'preliminary',
    checked_date: checkedDate,
    completion_claim_allowed: false,
    novelty_position:
      'Plausibly differentiated only as a unified hard-grounded research QA failure taxonomy; not novel as generic RAG, citation, temporal, contradiction, or multi-hop QA.',
    high_novelty_risk_categories: highRisk,
    sources,
    category_coverage: categoryCoverage,
    release_gate_instruction:
      'Do not claim novelty until this audit is refreshed with a final June 2026 literature scan and at least two real model baselines are scored.',
  }
}

function renderMarkdown(audit) {
  const sourceRows = audit.sources.map((source) => [
    `[${source.title}](${source.url})`,
    String(source.year),
    source.covers.join('<br>'),
    source.gap,
  ])
  const categoryRows = audit.category_coverage.map((entry) => [
    entry.category,
    entry.novelty_risk,
    entry.closest_sources.join('<br>'),
    entry.differentiator,
  ])

  return `# Novelty Audit

Status: ${audit.status} literature and internet scan, not a completion claim.

Date checked: ${audit.checked_date}

## Question

Is the hard grounded research benchmark genuinely novel relative to current RAG, grounded QA, citation faithfulness, temporal conflict, and long-context benchmarks?

## Current Position

${audit.novelty_position}

Completion claim allowed: ${audit.completion_claim_allowed}

## Adjacent Work Found

${markdownTable(['Representative source', 'Year', 'What it already covers', 'Gap / implication for this benchmark'], sourceRows)}

## Category-Level Novelty Risk

${markdownTable(['Category', 'Novelty risk', 'Closest sources', 'Differentiator required'], categoryRows)}

## Required Work Before Paper-Worthy

1. Convert seed examples into a larger sampled/adversarial suite with at least 30-50 reviewed items per category.
2. Add explicit rubrics for conclusion-support, source authority, document lifecycle, and as-of-date validity.
3. Add at least three non-oracle baselines: lexical retrieval plus answer extraction, native-context LLM answerer, and citation-aware verifier.
4. Run at least two frontier or open models and report category-level failure profiles.
5. Complete human review/adjudication fields for synthetic lifecycle, authority, and stale/current perturbations.
6. Re-run this novelty audit before any completion claim and update it with newly found June 2026 papers.

## Decision

Do not claim novelty yet. Treat novelty as a release gate that requires evidence from the broader benchmark literature and a category-by-category comparison table in the paper draft.
`
}

const audit = buildAudit()
writeJson(auditJsonPath, audit)
writeText(auditMarkdownPath, renderMarkdown(audit))

console.log(`Wrote hard grounded novelty audit JSON to ${auditJsonPath}`)
console.log(`Wrote hard grounded novelty audit report to ${auditMarkdownPath}`)
