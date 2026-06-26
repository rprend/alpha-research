import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const evidenceJsonPath = join(generatedDir, 'novelty-evidence.json')
const evidenceMarkdownPath = join(experimentDir, 'NOVELTY_EVIDENCE.md')

const checkedDate = '2026-06-26'

const searchQueries = [
  {
    query: '2025 2026 benchmark grounded research QA large corpus multi-hop citation faithfulness temporal conflicts RAG benchmark',
    purpose:
      'Find broad large-corpus and grounded-research QA benchmarks that could subsume the proposed contribution.',
  },
  {
    query: '2025 2026 citation supports fact but not conclusion benchmark grounded QA RAG faithfulness',
    purpose:
      'Stress-test the citation-overreach category against citation faithfulness and context-faithfulness benchmarks.',
  },
  {
    query: '2026 temporal question answering stale current document conflict benchmark RAG',
    purpose:
      'Stress-test as-of-date and stale/current document conflict tasks against temporal RAG and knowledge-drift work.',
  },
  {
    query: 'TEMPRAGEVAL temporal RAG benchmark 2025 arxiv',
    purpose:
      'Check for temporal RAG benchmarks specifically named around time-sensitive retrieval and generation.',
  },
  {
    query: 'MultiHop-RAG benchmark 2024 multi-hop retrieval augmented generation',
    purpose:
      'Check whether multi-hop synthesis is already covered by dedicated RAG benchmarks.',
  },
  {
    query: 'MAGIC benchmark multi-hop question answering RAG 2025',
    purpose:
      'Check newer multi-hop and inference-heavy QA benchmarks that may overlap with the proposed taxonomy.',
  },
]

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
    id: 't2-ragbench-2026',
    title: 'T2-RAGBench: Text-and-Table Benchmark for Evaluating Retrieval-Augmented Generation',
    year: 2026,
    url: 'https://huggingface.co/datasets/G4KMU/t2-ragbench',
    source_type: 'paper_and_dataset',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['table + text reasoning', 'financial document RAG', 'retrieval plus numerical reasoning'],
    paper_use:
      'Cite as close text-and-table RAG work; frame our table tasks as one category inside a broader hard-grounded research failure taxonomy.',
  },
  {
    id: 'citation-closure-2026',
    title: 'Citation-Closure Retrieval and Per-Rule Attribution for Real-World Compliance RAG',
    year: 2026,
    url: 'https://arxiv.org/html/2605.29742v1',
    source_type: 'paper',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['source authority conflicts', 'citation closure', 'authority traceability'],
    paper_use:
      'Cite as close authority/citation-closure work; distinguish our contribution by evaluating authority conflicts alongside lifecycle, temporal, insufficiency, contradiction, and citation-overreach categories.',
  },
  {
    id: 'legal-claim-rag-2026',
    title: 'Fine-grained Claim-level RAG Benchmark for Law',
    year: 2026,
    url: 'https://arxiv.org/html/2605.21071v1',
    source_type: 'paper',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['claim-level RAG', 'contradicted claims', 'legal evidence grounding'],
    paper_use:
      'Cite as close contradiction and claim-level RAG work; avoid claiming contradiction detection alone as novel.',
  },
  {
    id: 'enterprise-rag-bench-2026',
    title: 'EnterpriseRAG-Bench',
    year: 2026,
    url: 'https://huggingface.co/datasets/onyx-dot-app/EnterpriseRAG-Bench',
    source_type: 'paper_and_dataset',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['large-corpus enterprise RAG', 'realistic document QA'],
    paper_use:
      'Cite as close large-corpus RAG work; position our benchmark around controlled failure categories rather than corpus realism alone.',
  },
  {
    id: 'corpusqa-2026',
    title: 'CorpusQA: A 10 Million Token Benchmark for Corpus-Level Question Answering',
    year: 2026,
    url: 'https://arxiv.org/html/2601.14952v1',
    source_type: 'paper',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['corpus-level QA', 'global information synthesis', 'RAG collapse under scale'],
    paper_use:
      'Cite as close corpus-level QA work; keep our novelty claim centered on hard-grounded evidence semantics, not corpus length alone.',
  },
  {
    id: 'longbench-pro-2026',
    title: 'LongBench Pro: A More Realistic and Comprehensive Bilingual Long-Context Evaluation Benchmark',
    year: 2026,
    url: 'https://huggingface.co/datasets/caskcsg/LongBench-Pro',
    source_type: 'paper_and_dataset',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['long-context evaluation', 'realistic reasoning tasks'],
    paper_use:
      'Cite as close long-context evaluation work; use it to avoid overclaiming novelty from long inputs or hard examples alone.',
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
  {
    id: 'step-context-faithfulness-2026',
    title: 'A Benchmark for Evaluating Step-by-Step Context Faithfulness in Retrieval-Augmented Language Models',
    year: 2026,
    url: 'https://arxiv.org/html/2601.09414v2',
    source_type: 'paper',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['citation supports fact but not conclusion', 'evidence insufficiency / abstention', 'intermediate-step faithfulness'],
    paper_use:
      'Cite as close work on faithfulness of reasoning steps to retrieved context; distinguish our conclusion-overreach category by requiring citations that support a fact but not the final research conclusion.',
  },
  {
    id: 'ragbench-leaderboard-2025',
    title: 'Evaluation of RAG Metrics for Question Answering in the Telecom Domain',
    year: 2025,
    url: 'https://arxiv.org/html/2503.06887v2',
    source_type: 'paper',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['RAG faithfulness metrics', 'answer relevance', 'domain QA'],
    paper_use:
      'Cite as evidence that RAG faithfulness and answer-quality metrics are already benchmarked; position our contribution as task construction for hard grounded research failures rather than another metric leaderboard.',
  },
  {
    id: 'tdbench-2025',
    title: 'TDBench: A Benchmark for Temporal Database Question Answering',
    year: 2025,
    url: 'https://openreview.net/forum?id=qJmLk5mSZz',
    source_type: 'paper',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['temporal questions: as of date X', 'temporal database QA', 'time-aware retrieval'],
    paper_use:
      'Cite as close temporal QA work; distinguish hard-grounded as-of-date tasks by evidence snapshot validity, stale/current document conflict, and citation-grounded abstention rather than database temporal querying alone.',
  },
  {
    id: 'knowledge-drift-2025',
    title: 'Has Your Knowledge Been Updated or Still Outdated? Understanding and Detecting Knowledge Drift in Large Language Models',
    year: 2025,
    url: 'https://arxiv.org/html/2504.08700v1',
    source_type: 'paper',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['stale-vs-current document conflicts', 'knowledge drift', 'temporal validity'],
    paper_use:
      'Cite as close knowledge-drift work; keep the benchmark claim focused on document-grounded conflict resolution where both stale and current evidence are visible.',
  },
  {
    id: 'decaf-2025',
    title: 'Claim-Aware RAG: Truthful & Reliable Long-Form Generation with Dynamic Evidence Trees',
    year: 2025,
    url: 'https://arxiv.org/html/2502.20129v1',
    source_type: 'paper',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['claim-level RAG', 'citation faithfulness', 'long-form grounded generation'],
    paper_use:
      'Cite as close claim-aware RAG work; distinguish this benchmark by evaluating failure categories across research QA items rather than proposing a generation architecture.',
  },
  {
    id: 'entitymatch-2025',
    title: 'EntityMatch: Evaluating Entity Ambiguity in Visual Language Models',
    year: 2025,
    url: 'https://openreview.net/forum?id=8mF1lKKDEi',
    source_type: 'paper',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['entity disambiguation', 'ambiguous named entities'],
    paper_use:
      'Cite as evidence that entity ambiguity is an active benchmark dimension; frame our entity-disambiguation tasks around textual corpus-grounded research QA and citation requirements.',
  },
  {
    id: 'temprageval-2025',
    title: 'TEMPRAGEVAL: Temporal RAG Evaluation',
    year: 2025,
    url: 'https://arxiv.org/abs/2507.02457',
    source_type: 'paper',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['temporal questions: as of date X', 'temporal RAG', 'time-sensitive retrieval'],
    paper_use:
      'Cite as close temporal RAG evaluation; avoid claiming temporal robustness as novel and distinguish by visible stale/current source conflicts and as-of-date citation semantics.',
  },
  {
    id: 'multihop-rag-2024',
    title: 'MultiHop-RAG: Benchmarking Retrieval-Augmented Generation for Multi-Hop Queries',
    year: 2024,
    url: 'https://arxiv.org/abs/2401.15391',
    source_type: 'paper_and_dataset',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['multi-hop synthesis', 'RAG retrieval over multiple documents'],
    paper_use:
      'Cite as close multi-hop RAG work; do not claim multi-hop RAG as novel except as one category inside the hard-grounded research taxonomy.',
  },
  {
    id: 'magic-2025',
    title: 'MAGIC: A Multi-Hop and Generation-Intensive Chinese Benchmark for LLM Evaluation',
    year: 2025,
    url: 'https://arxiv.org/abs/2506.05732',
    source_type: 'paper',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['multi-hop synthesis', 'generation-intensive QA'],
    paper_use:
      'Cite as another multi-hop/generation benchmark; keep the claim boundary on grounded evidence semantics rather than generation difficulty alone.',
  },
  {
    id: 'faitheval-2024',
    title: 'FaithEval: Can Your Language Model Stay Faithful to Context, Even If "The Moon is Made of Marshmallows"?',
    year: 2024,
    url: 'https://arxiv.org/abs/2410.03727',
    source_type: 'paper_and_dataset',
    evidence_status: 'web_checked_2026_06_26',
    benchmark_overlap: ['context faithfulness', 'evidence insufficiency / abstention', 'stale-vs-current document conflicts'],
    paper_use:
      'Cite as close context-faithfulness work; distinguish the benchmark by research QA categories where the cited evidence may support local facts but not final conclusions.',
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
  {
    claim: 'A paper-ready benchmark with reliable labels',
    status: 'not_yet_supported',
    reason:
      'Human review, adjudication, category scale, and final novelty checks are still release blockers.',
  },
]

const claimBoundaries = [
  {
    paper_claim: 'We introduce a generic RAG benchmark.',
    allowed: false,
    reason: 'Too broad and already covered by many RAG, long-context, and domain QA benchmarks.',
    supporting_source_ids: ['lit-ragbench-2026', 'enterprise-rag-bench-2026', 'corpusqa-2026'],
  },
  {
    paper_claim: 'We introduce a multi-hop RAG benchmark.',
    allowed: false,
    reason: 'Multi-hop RAG is already directly benchmarked; this can only be a component category.',
    supporting_source_ids: ['multihop-rag-2024', 'bridge-2026', 'occ-rag-2026', 'magic-2025'],
  },
  {
    paper_claim: 'We introduce a temporal RAG benchmark.',
    allowed: false,
    reason: 'Temporal RAG and temporal QA already have dedicated benchmarks.',
    supporting_source_ids: ['chronoqa-2025', 'tdbench-2025', 'temprageval-2025', 'knowledge-drift-2025'],
  },
  {
    paper_claim: 'We introduce citation faithfulness evaluation.',
    allowed: false,
    reason: 'Citation and context faithfulness are already benchmarked; our narrower claim must be conclusion-support overreach.',
    supporting_source_ids: ['longcite-2024', 'step-context-faithfulness-2026', 'faitheval-2024'],
  },
  {
    paper_claim: 'We benchmark a unified taxonomy of hard grounded research QA failures beyond fact lookup.',
    allowed: true,
    reason:
      'This is the defensible claim if the paper shows reviewed items spanning lifecycle, authority, stale/current, conclusion-overreach, insufficiency, entity ambiguity, table/text, multi-hop, temporal, and contradiction categories.',
    supporting_source_ids: ['citation-closure-2026', 'chronoqa-2025', 'longcite-2024', 'lit-ragbench-2026', 'corpusqa-2026'],
  },
  {
    paper_claim: 'The benchmark is paper-ready and genuinely novel as of June 2026.',
    allowed: false,
    reason: 'This requires completed human review, category scale, and a final refreshed novelty audit.',
    supporting_source_ids: [],
  },
]

const categoryEvidence = [
  ['multi-hop synthesis', ['multihop-rag-2024', 'occ-rag-2026', 'bridge-2026', 'magic-2025', 'decaf-2025'], 'high'],
  ['stale-vs-current document conflicts', ['chronoqa-2025', 'temprageval-2025', 'knowledge-drift-2025', 'faitheval-2024'], 'medium'],
  ['appended document lifecycle changes', ['bridge-2026'], 'low'],
  ['table + text reasoning', ['bridge-2026', 't2-ragbench-2026'], 'high'],
  ['source authority conflicts', ['citation-closure-2026', 'legal-claim-rag-2026', 'lit-ragbench-2026', 'decaf-2025'], 'medium'],
  ['evidence insufficiency / abstention', ['occ-rag-2026', 'lit-ragbench-2026', 'step-context-faithfulness-2026', 'faitheval-2024'], 'high'],
  ['citation supports fact but not conclusion', ['longcite-2024', 'step-context-faithfulness-2026', 'ragbench-leaderboard-2025', 'faitheval-2024'], 'medium'],
  ['entity disambiguation', ['occ-rag-2026', 'entitymatch-2025'], 'medium'],
  ['temporal questions: as of date X', ['chronoqa-2025', 'tdbench-2025', 'temprageval-2025', 'knowledge-drift-2025'], 'high'],
  ['cross-document contradiction', ['lit-ragbench-2026', 'legal-claim-rag-2026'], 'high'],
].map(([category, sourceIds, noveltyRisk]) => ({
  category,
  source_ids: sourceIds,
  novelty_risk: noveltyRisk,
}))

const comparisonDimensions = [
  {
    dimension: 'Context length or corpus realism',
    closest_source_ids: ['corpusqa-2026', 'longbench-pro-2026', 'enterprise-rag-bench-2026'],
    novelty_position:
      'Not novel alone; use these sources to avoid overclaiming scale and to motivate controlled failure categories inside large-corpus research QA.',
  },
  {
    dimension: 'Temporal validity',
    closest_source_ids: ['chronoqa-2025', 'tdbench-2025', 'temprageval-2025', 'knowledge-drift-2025'],
    novelty_position:
      'Not novel alone; hard-grounded research should focus on as-of-date citation semantics, stale/current document conflict, and visible evidence-state changes.',
  },
  {
    dimension: 'Citation faithfulness',
    closest_source_ids: ['longcite-2024', 'step-context-faithfulness-2026', 'ragbench-leaderboard-2025', 'faitheval-2024'],
    novelty_position:
      'Not novel alone; the benchmark must test whether citations support the final conclusion, not merely whether cited spans are relevant to local facts.',
  },
  {
    dimension: 'Source authority and claim-level evidence',
    closest_source_ids: ['citation-closure-2026', 'legal-claim-rag-2026', 'decaf-2025'],
    novelty_position:
      'Partly covered elsewhere; the defensible angle is combining authority conflicts with lifecycle, temporal, insufficiency, and contradiction tasks under one annotation protocol.',
  },
  {
    dimension: 'Entity ambiguity',
    closest_source_ids: ['entitymatch-2025', 'occ-rag-2026'],
    novelty_position:
      'Not novel as a standalone phenomenon; include it because large-corpus research QA frequently fails by citing the right-looking source for the wrong entity.',
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

function buildEvidence() {
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    checked_date: checkedDate,
    evidence_status: 'preliminary_registry_not_final_completion_audit',
    search_queries: searchQueries,
    source_count: sources.length,
    completion_claim_allowed: false,
    allowed_claim_count: claimBoundaries.filter((claim) => claim.allowed).length,
    prohibited_claim_count: claimBoundaries.filter((claim) => !claim.allowed).length,
    sources,
    claim_guidance: claimGuidance,
    claim_boundaries: claimBoundaries,
    category_evidence: categoryEvidence,
    comparison_dimensions: comparisonDimensions,
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
  const queryRows = evidence.search_queries.map((query) => [query.query, query.purpose])
  const boundaryRows = evidence.claim_boundaries.map((claim) => [
    claim.paper_claim,
    claim.allowed ? 'allowed with evidence' : 'prohibited / not yet supported',
    claim.reason,
    claim.supporting_source_ids.length > 0 ? claim.supporting_source_ids.join('<br>') : 'n/a',
  ])
  const categoryRows = evidence.category_evidence.map((entry) => [
    entry.category,
    entry.novelty_risk,
    entry.source_ids.join('<br>'),
  ])
  const comparisonRows = evidence.comparison_dimensions.map((entry) => [
    entry.dimension,
    entry.closest_source_ids.join('<br>'),
    entry.novelty_position,
  ])

  return `# Hard Grounded Research Novelty Evidence

This generated registry records related-work evidence checked for the benchmark novelty argument. It is not a final completion audit and does not allow a novelty claim by itself.

## Summary

- Date checked: ${evidence.checked_date}
- Sources: ${evidence.source_count}
- Evidence status: ${evidence.evidence_status}
- Completion claim allowed: ${evidence.completion_claim_allowed}
- Allowed claims: ${evidence.allowed_claim_count}
- Prohibited or unsupported claims: ${evidence.prohibited_claim_count}

## June 2026 Search Provenance

${markdownTable(['Query', 'Purpose'], queryRows)}

## Source Registry

${markdownTable(['ID', 'Source', 'Year', 'Overlap', 'Paper-use note'], sourceRows)}

## Claim Guidance

${markdownTable(['Claim', 'Status', 'Reason'], claimRows)}

## Paper Claim Boundaries

${markdownTable(['Paper claim', 'Status', 'Reason', 'Relevant source ids'], boundaryRows)}

## Category Evidence Map

${markdownTable(['Category', 'Novelty risk', 'Closest source ids'], categoryRows)}

## Adversarial Novelty Comparison

${markdownTable(['Dimension', 'Closest source ids', 'Position to defend'], comparisonRows)}
`
}

const evidence = buildEvidence()
writeJson(evidenceJsonPath, evidence)
writeText(evidenceMarkdownPath, renderMarkdown(evidence))

console.log(`Wrote hard grounded novelty evidence JSON to ${evidenceJsonPath}`)
console.log(`Wrote hard grounded novelty evidence report to ${evidenceMarkdownPath}`)
