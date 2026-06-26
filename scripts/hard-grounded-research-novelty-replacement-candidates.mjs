import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'novelty-replacement-candidates.json')
const reportMarkdownPath = join(experimentDir, 'NOVELTY_REPLACEMENT_CANDIDATES.md')

const inputs = {
  noveltyLinkAudit: join(generatedDir, 'novelty-link-audit.json'),
  noveltyClaimRevisionPlan: join(generatedDir, 'novelty-claim-revision-plan.json'),
}

const verifiedCandidates = [
  {
    id: 'faithfulness-qa-2026-verified',
    title: 'Faithfulness-QA: A Counterfactual Entity Substitution Dataset for Training Context-Faithful RAG Models',
    url: 'https://arxiv.org/abs/2604.25313',
    primary_source_status: 'verified_title_match',
    observed_title: 'Faithfulness-QA: A Counterfactual Entity Substitution Dataset for Training Context-Faithful RAG Models',
    replaces_or_supplements: ['faithfulness-qa-2026'],
    pressure_points: ['entity disambiguation', 'stale-vs-current document conflicts', 'citation supports fact but not conclusion'],
    audit_role: 'Replace the mismatched Faithfulness-QA URL before claim revision or citation.',
    required_review: 'Compare counterfactual-context faithfulness against this benchmark category taxonomy and conclusion-support scoring.',
  },
  {
    id: 'faitheval-2024',
    title: 'FaithEval: Can Your Language Model Stay Faithful to Context, Even If Context Is Noisy?',
    url: 'https://arxiv.org/abs/2410.03727',
    primary_source_status: 'verified_title_match',
    observed_title: 'FaithEval: Can Your Language Model Stay Faithful to Context, Even If "The Moon is Made of Marshmallows"',
    replaces_or_supplements: ['faithjudge-2026'],
    pressure_points: ['citation supports fact but not conclusion', 'evidence insufficiency / abstention'],
    audit_role: 'Use as a verified faithfulness/noisy-context adjacent benchmark if FaithJudge remains unverified.',
    required_review: 'Determine whether noisy-context faithfulness overlaps conclusion-level support failures or remains an adjacent context-faithfulness benchmark.',
  },
  {
    id: 'confiqua-context-dpo-2024',
    title: 'Context-DPO: Aligning Language Models for Context-Faithfulness',
    url: 'https://arxiv.org/abs/2412.15280',
    primary_source_status: 'verified_title_match',
    observed_title: 'Context-DPO: Aligning Language Models for Context-Faithfulness',
    replaces_or_supplements: ['faithjudge-2026'],
    pressure_points: ['evidence insufficiency / abstention', 'citation supports fact but not conclusion'],
    audit_role: 'Use as a verified QA hallucination-control comparator for abstention and unsupported-answer claims.',
    required_review: 'Check whether its unsupported-answer control covers the same abstention/evidence-insufficiency construct.',
  },
  {
    id: 'legalbench-rag-2024',
    title: 'LegalBench-RAG: A Benchmark for Retrieval-Augmented Generation in the Legal Domain',
    url: 'https://arxiv.org/abs/2408.10343',
    primary_source_status: 'verified_title_match',
    observed_title: 'LegalBench-RAG: A Benchmark for Retrieval-Augmented Generation in the Legal Domain',
    replaces_or_supplements: ['dora-2026'],
    pressure_points: ['source authority conflicts', 'large-corpus research QA'],
    audit_role: 'Use as a verified legal-domain RAG comparator for domain-specific QA and source-grounded citation behavior.',
    required_review: 'Determine whether legal-domain citation retrieval overlaps source-authority conflict tasks or remains domain-specific RAG.',
  },
  {
    id: 'rag-evaluation-survey-2025',
    title: 'Retrieval Augmented Generation Evaluation in the Era of Large Language Models: A Comprehensive Survey',
    url: 'https://arxiv.org/abs/2504.14891',
    primary_source_status: 'verified_title_match',
    observed_title: 'Retrieval Augmented Generation Evaluation in the Era of Large Language Models: A Comprehensive Survey',
    replaces_or_supplements: ['hierarag-2026'],
    pressure_points: ['generic RAG benchmark claim', 'benchmark taxonomy framing'],
    audit_role: 'Use as the verified generic RAG evaluation survey comparator before making taxonomy novelty claims.',
    required_review: 'Compare its RAG evaluation taxonomy against the hard-grounded category taxonomy and remove generic RAG-benchmark novelty language.',
  },
  {
    id: 'finegrained-rag-2026',
    title: 'Benchmarking Fine-Grained RAG: Granular Assessment and Error Analysis in Retrieval-Augmented Generation',
    url: 'https://arxiv.org/abs/2605.07471',
    primary_source_status: 'candidate_title_conflict',
    observed_title: 'Transfer Learning Across Fast- and Full-Simulation Domains in High-Energy Physics',
    replaces_or_supplements: ['hierarag-2026'],
    pressure_points: ['generic RAG benchmark claim', 'benchmark taxonomy framing'],
    audit_role: 'Use as a verified generic/fine-grained RAG benchmark comparator before making taxonomy novelty claims.',
    required_review: 'Compare its retrieval/generation error taxonomy against hard-grounded categories and remove generic RAG-benchmark novelty language.',
  },
  {
    id: 'grace-2026',
    title: 'GRACE: A Diagnostic Benchmark for Contextual Reasoning in Retrieval-Augmented Generation',
    url: 'https://arxiv.org/abs/2606.11418',
    primary_source_status: 'candidate_title_conflict',
    observed_title: 'Classification of rotational zero modes in 2D micropolar solids',
    replaces_or_supplements: ['hierarag-2026'],
    pressure_points: ['multi-hop synthesis', 'cross-document contradiction', 'temporal questions: as of date X'],
    audit_role: 'Use as a verified contextual-reasoning RAG comparator before finalizing hard-grounded reasoning novelty claims.',
    required_review: 'Determine whether its contextual reasoning tasks subsume any hard-grounded categories or only overlap at the broad RAG-diagnostic level.',
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

function buildReport({ noveltyLinkAudit, noveltyClaimRevisionPlan }) {
  const quarantinedIds = new Set(noveltyLinkAudit.sources.filter((source) => source.quarantined).map((source) => source.source_id))
  const replacementCoverage = new Map([...quarantinedIds].map((id) => [id, 0]))
  for (const candidate of verifiedCandidates) {
    if (candidate.primary_source_status !== 'verified_title_match') continue
    for (const sourceId of candidate.replaces_or_supplements) {
      if (replacementCoverage.has(sourceId)) replacementCoverage.set(sourceId, replacementCoverage.get(sourceId) + 1)
    }
  }
  const checks = [
    {
      id: 'quarantined_sources_loaded',
      passed: quarantinedIds.size === noveltyLinkAudit.summary.quarantined_sources,
      detail: `${quarantinedIds.size}/${noveltyLinkAudit.summary.quarantined_sources} quarantined source ids loaded`,
    },
    {
      id: 'replacement_candidates_present',
      passed: verifiedCandidates.filter((candidate) => candidate.primary_source_status === 'verified_title_match').length >= quarantinedIds.size,
      detail: `${verifiedCandidates.filter((candidate) => candidate.primary_source_status === 'verified_title_match').length} verified replacement/supplement candidates for ${quarantinedIds.size} quarantined sources`,
    },
    {
      id: 'quarantined_sources_covered',
      passed: [...replacementCoverage.values()].every((count) => count > 0),
      detail: [...replacementCoverage.entries()].map(([id, count]) => `${id}=${count}`).join('; '),
    },
    {
      id: 'final_claims_still_blocked',
      passed: noveltyClaimRevisionPlan.summary.completion_claim_allowed === false,
      detail: `completion_claim_allowed=${noveltyClaimRevisionPlan.summary.completion_claim_allowed}; final_novelty_claim_allowed=${noveltyClaimRevisionPlan.summary.final_novelty_claim_allowed}`,
    },
  ]
  return {
    novelty_replacement_candidates_ready: checks.every((check) => check.passed),
    version: 'novelty-replacement-candidates-v1',
    checked_date: '2026-06-26',
    completion_claim_allowed: false,
    final_novelty_claim_allowed: false,
    generated_from: {
      novelty_link_audit: 'generated/novelty-link-audit.json',
      novelty_claim_revision_plan: 'generated/novelty-claim-revision-plan.json',
      web_search: '2026-06-26 verified primary-source candidate search for quarantined novelty links',
    },
    checks,
    candidates: verifiedCandidates,
    summary: {
      quarantined_sources: quarantinedIds.size,
      candidates: verifiedCandidates.length,
      verified_title_match_candidates: verifiedCandidates.filter((candidate) => candidate.primary_source_status === 'verified_title_match').length,
      candidate_title_conflicts: verifiedCandidates.filter((candidate) => candidate.primary_source_status === 'candidate_title_conflict').length,
      covered_quarantined_sources: [...replacementCoverage.values()].filter((count) => count > 0).length,
      final_novelty_claim_allowed: false,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(report) {
  const checkRows = report.checks.map((check) => [check.id, String(check.passed), check.detail])
  const candidateRows = report.candidates.map((candidate) => [
    candidate.id,
    candidate.primary_source_status,
    candidate.observed_title,
    candidate.replaces_or_supplements.join('<br>'),
    candidate.url,
    candidate.audit_role,
  ])
  return `# Hard Grounded Research Novelty Replacement Candidates

This generated report lists verified or explicitly caveated related-work candidates for quarantined novelty-watchlist sources. It does not resolve overlap or allow final novelty claims; it gives reviewers concrete primary-source candidates to adjudicate.

## Summary

- Candidates ready: ${report.novelty_replacement_candidates_ready}
- Version: ${report.version}
- Date checked: ${report.checked_date}
- Quarantined sources: ${report.summary.quarantined_sources}
- Candidates: ${report.summary.candidates}
- Verified title-match candidates: ${report.summary.verified_title_match_candidates}
- Candidate title conflicts: ${report.summary.candidate_title_conflicts}
- Covered quarantined sources: ${report.summary.covered_quarantined_sources}
- Final novelty claim allowed: ${report.summary.final_novelty_claim_allowed}
- Completion claim allowed: ${report.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Candidates

${markdownTable(['Candidate', 'Primary-source status', 'Observed title', 'Replaces or supplements', 'URL', 'Audit role'], candidateRows)}
`
}

const report = buildReport({
  noveltyLinkAudit: readJson(inputs.noveltyLinkAudit),
  noveltyClaimRevisionPlan: readJson(inputs.noveltyClaimRevisionPlan),
})

writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded novelty replacement candidates to ${reportJsonPath}`)
console.log(`Wrote hard grounded novelty replacement candidates report to ${reportMarkdownPath}`)
