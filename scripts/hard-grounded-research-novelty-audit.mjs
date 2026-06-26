import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const auditJsonPath = join(generatedDir, 'novelty-audit.json')
const auditMarkdownPath = join(experimentDir, 'NOVELTY_AUDIT.md')

const checkedDate = '2026-06-26'

const searchQueries = [
  '2025 2026 benchmark grounded research QA large corpus multi-hop citation faithfulness temporal conflicts RAG benchmark',
  '2025 2026 citation supports fact but not conclusion benchmark grounded QA RAG faithfulness',
  '2026 temporal question answering stale current document conflict benchmark RAG',
  'TEMPRAGEVAL temporal RAG benchmark 2025 arxiv',
  'MultiHop-RAG benchmark 2024 multi-hop retrieval augmented generation',
  'MAGIC benchmark multi-hop question answering RAG 2025',
]

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
    id: 't2-ragbench-2026',
    title: 'T2-RAGBench: Text-and-Table Benchmark for Evaluating Retrieval-Augmented Generation',
    year: 2026,
    url: 'https://huggingface.co/datasets/G4KMU/t2-ragbench',
    covers: ['table + text reasoning', 'retrieval over financial documents', 'numerical reasoning'],
    gap: 'Directly pressures text-and-table RAG over finance documents, but does not cover source authority conflicts, stale/current document snapshots, appended lifecycle changes, evidence insufficiency, conclusion-overreach, or cross-document contradiction as a unified research QA taxonomy.',
  },
  {
    id: 'citation-closure-2026',
    title: 'Citation-Closure Retrieval and Per-Rule Attribution for Real-World Compliance RAG',
    year: 2026,
    url: 'https://arxiv.org/html/2605.29742v1',
    covers: ['source authority conflicts', 'citation closure', 'regulatory traceability'],
    gap: 'Very close to authority-aware attribution, but targeted at regulatory rule closure rather than a benchmark taxonomy spanning lifecycle, temporal, insufficiency, entity ambiguity, and conclusion-support failure modes.',
  },
  {
    id: 'legal-claim-rag-2026',
    title: 'Fine-grained Claim-level RAG Benchmark for Law',
    year: 2026,
    url: 'https://arxiv.org/html/2605.21071v1',
    covers: ['claim-level RAG', 'contradicted claims', 'domain-specific legal evidence'],
    gap: 'Covers claim-level legal RAG and contradiction detection, but domain scope and claim granularity differ from broad research-document QA with explicit source lifecycle and citation-overreach categories.',
  },
  {
    id: 'enterprise-rag-bench-2026',
    title: 'EnterpriseRAG-Bench',
    year: 2026,
    url: 'https://huggingface.co/datasets/onyx-dot-app/EnterpriseRAG-Bench',
    covers: ['large-corpus enterprise RAG', 'realistic document retrieval', 'end-to-end QA'],
    gap: 'Covers realistic large enterprise corpora, but is not organized around controlled hard-grounded failure classes such as stale/current conflicts, authority hierarchy, appended lifecycle changes, and citation-support versus conclusion-support.',
  },
  {
    id: 'corpusqa-2026',
    title: 'CorpusQA: A 10 Million Token Benchmark for Corpus-Level Question Answering',
    year: 2026,
    url: 'https://arxiv.org/html/2601.14952v1',
    covers: ['corpus-level QA', 'global information synthesis', 'long-context and RAG failure'],
    gap: 'Tests corpus-scale synthesis difficulty, but does not isolate grounded research QA failure modes with per-item citation-support, authority, temporal, lifecycle, and contradiction rubrics.',
  },
  {
    id: 'longbench-pro-2026',
    title: 'LongBench Pro: A More Realistic and Comprehensive Bilingual Long-Context Evaluation Benchmark',
    year: 2026,
    url: 'https://huggingface.co/datasets/caskcsg/LongBench-Pro',
    covers: ['realistic long-context evaluation', 'deep reasoning across long inputs'],
    gap: 'Strengthens the crowded long-context benchmark landscape, but does not directly target large-corpus grounded research QA with explicit evidence sufficiency and conclusion-support labels.',
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
  {
    id: 'temprageval-2025',
    title: 'TEMPRAGEVAL: Temporal RAG Evaluation',
    year: 2025,
    url: 'https://arxiv.org/abs/2507.02457',
    covers: ['temporal RAG', 'time-sensitive retrieval', 'temporal questions: as of date X'],
    gap: 'Directly pressures temporal RAG, so the proposed benchmark must avoid claiming temporal QA novelty and instead focus on explicit stale/current document conflict plus citation snapshot validity.',
  },
  {
    id: 'multihop-rag-2024',
    title: 'MultiHop-RAG: Benchmarking Retrieval-Augmented Generation for Multi-Hop Queries',
    year: 2024,
    url: 'https://arxiv.org/abs/2401.15391',
    covers: ['multi-hop synthesis', 'multi-document retrieval-augmented generation'],
    gap: 'Directly covers multi-hop RAG, so multi-hop synthesis is only defensible as one failure mode inside the broader hard-grounded research taxonomy.',
  },
  {
    id: 'magic-2025',
    title: 'MAGIC: A Multi-Hop and Generation-Intensive Chinese Benchmark for LLM Evaluation',
    year: 2025,
    url: 'https://arxiv.org/abs/2506.05732',
    covers: ['multi-hop synthesis', 'generation-intensive question answering'],
    gap: 'Adds another close multi-hop/generation benchmark; the differentiator must be evidence semantics rather than generation difficulty.',
  },
  {
    id: 'faitheval-2024',
    title: 'FaithEval: Can Your Language Model Stay Faithful to Context, Even If "The Moon is Made of Marshmallows"?',
    year: 2024,
    url: 'https://arxiv.org/abs/2410.03727',
    covers: ['context faithfulness', 'evidence insufficiency / abstention', 'counterfactual context following'],
    gap: 'Close for context-faithfulness failures, but does not make conclusion-support overreach, source authority, and document lifecycle first-class research QA categories.',
  },
]

const claimBoundaries = [
  {
    claim: 'Generic RAG benchmark',
    allowed: false,
    basis: 'RAG benchmarks, long-context benchmarks, and domain RAG benchmarks are already abundant.',
  },
  {
    claim: 'Multi-hop RAG benchmark',
    allowed: false,
    basis: 'MultiHop-RAG, BRIDGE, MAGIC, and OCC-RAG make this crowded as a standalone claim.',
  },
  {
    claim: 'Temporal RAG benchmark',
    allowed: false,
    basis: 'ChronoQA, TEMPRAGEVAL, TDBench, and knowledge-drift work already cover temporal QA/RAG.',
  },
  {
    claim: 'Citation faithfulness benchmark',
    allowed: false,
    basis: 'LongCite, step-context faithfulness, RAG faithfulness metrics, and FaithEval cover nearby citation/context faithfulness space.',
  },
  {
    claim: 'Unified hard-grounded research QA failure taxonomy beyond fact lookup',
    allowed: true,
    basis:
      'Allowed only if the paper presents reviewed items spanning lifecycle, authority, stale/current snapshots, conclusion overreach, insufficiency, entity ambiguity, table/text, multi-hop, temporal, and contradiction categories.',
  },
  {
    claim: 'Paper-ready and genuinely novel as of June 2026',
    allowed: false,
    basis: 'Not allowed until human review, category scale, and final refreshed novelty audit are complete.',
  },
]

const categoryCoverage = [
  {
    category: 'multi-hop synthesis',
    closest_sources: ['multihop-rag-2024', 'occ-rag-2026', 'bridge-2026', 'magic-2025'],
    novelty_risk: 'high',
    differentiator: 'Must be framed as one slice inside a broader hard-grounded research taxonomy, not as a standalone multi-hop benchmark.',
  },
  {
    category: 'stale-vs-current document conflicts',
    closest_sources: ['chronoqa-2025', 'temprageval-2025', 'knowledge-drift-2025', 'faitheval-2024'],
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
    closest_sources: ['bridge-2026', 't2-ragbench-2026', 'occ-rag-2026'],
    novelty_risk: 'high',
    differentiator: 'Needs to stress cross-format evidence use inside research QA rather than claim novelty over text/table reasoning itself.',
  },
  {
    category: 'source authority conflicts',
    closest_sources: ['citation-closure-2026', 'legal-claim-rag-2026', 'lit-ragbench-2026'],
    novelty_risk: 'medium',
    differentiator: 'Authority hierarchy is distinct from arbitrary contradiction when the benchmark encodes which source controls the conclusion.',
  },
  {
    category: 'evidence insufficiency / abstention',
    closest_sources: ['occ-rag-2026', 'lit-ragbench-2026', 'faitheval-2024'],
    novelty_risk: 'high',
    differentiator: 'Abstention is not novel alone; contribution depends on pairing it with citation-overreach, authority, lifecycle, and temporal constraints.',
  },
  {
    category: 'citation supports fact but not conclusion',
    closest_sources: ['longcite-2024', 'lit-ragbench-2026', 'faitheval-2024'],
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
    closest_sources: ['chronoqa-2025', 'temprageval-2025', 'tdbench-2025'],
    novelty_risk: 'high',
    differentiator: 'Should be scoped to document snapshot validity and citation dates, not broad temporal QA.',
  },
  {
    category: 'cross-document contradiction',
    closest_sources: ['lit-ragbench-2026', 'legal-claim-rag-2026'],
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
    search_queries: searchQueries,
    allowed_claim_count: claimBoundaries.filter((claim) => claim.allowed).length,
    prohibited_claim_count: claimBoundaries.filter((claim) => !claim.allowed).length,
    claim_boundaries: claimBoundaries,
    novelty_position:
      'Plausibly differentiated only as a unified hard-grounded research QA failure taxonomy; not novel as generic RAG, citation, temporal, contradiction, or multi-hop QA.',
    high_novelty_risk_categories: highRisk,
    sources,
    category_coverage: categoryCoverage,
    release_gate_instruction:
      'Do not claim novelty until this audit is refreshed after human review completion with final June 2026 source checks and the category-level comparison table is paper-ready.',
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
  const queryRows = audit.search_queries.map((query) => [query])
  const boundaryRows = audit.claim_boundaries.map((claim) => [
    claim.claim,
    claim.allowed ? 'allowed with evidence' : 'prohibited / not yet supported',
    claim.basis,
  ])

  return `# Novelty Audit

Status: ${audit.status} literature and internet scan, not a completion claim.

Date checked: ${audit.checked_date}

## Question

Is the hard grounded research benchmark genuinely novel relative to current RAG, grounded QA, citation faithfulness, temporal conflict, and long-context benchmarks?

## Current Position

${audit.novelty_position}

Completion claim allowed: ${audit.completion_claim_allowed}

Allowed claims: ${audit.allowed_claim_count}

Prohibited or unsupported claims: ${audit.prohibited_claim_count}

## June 2026 Search Provenance

${markdownTable(['Query'], queryRows)}

## Claim Boundaries

${markdownTable(['Claim', 'Status', 'Basis'], boundaryRows)}

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
