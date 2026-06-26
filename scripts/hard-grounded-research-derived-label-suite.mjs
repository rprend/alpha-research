import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const outputJsonPath = join(generatedDir, 'derived-label-suite.json')
const outputMarkdownPath = join(experimentDir, 'DERIVED_LABEL_SUITE.md')

const highTrustNativeCategories = new Set([
  'multi-hop synthesis',
  'table + text reasoning',
  'entity disambiguation',
])

const deterministicTransformCategories = new Set([
  'stale-vs-current document conflicts',
  'appended document lifecycle changes',
  'source authority conflicts',
  'evidence insufficiency / abstention',
  'citation supports fact but not conclusion',
  'temporal questions: as of date X',
  'cross-document contradiction',
])

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

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function allEvidenceUnits(item) {
  return (item.source_examples || []).flatMap((source) => source.evidence_units || [])
}

function sourceEvidenceIds(source) {
  return (source.evidence_units || []).map((evidence) => evidence.id).filter(Boolean)
}

function primaryEvidenceIds(item) {
  return sourceEvidenceIds((item.source_examples || [])[0] || {})
}

function nativeDatasets(item) {
  return unique((item.source_examples || []).map((source) => source.source_dataset))
}

function nativeRowIds(item) {
  return unique((item.source_examples || []).map((source) => source.source_row_id))
}

function hasAnswer(item) {
  return String(item.expected_answer || '').trim().length > 0
}

function challengeType(item) {
  return item.challenge?.type || 'native_row'
}

function derivedCitationIds(item) {
  const challenge = item.challenge || {}
  if (challenge.type === 'document_lifecycle_appendix') {
    return unique([
      challenge.original_body?.evidence_id,
      challenge.appended_update?.evidence_id,
    ])
  }
  if (challenge.type === 'stale_current_conflict') return unique([challenge.current_document?.evidence_id])
  if (challenge.type === 'authority_conflict') return unique([challenge.high_authority_evidence_id])
  if (challenge.type === 'as_of_date_constraint') return unique(challenge.valid_evidence_ids || [])
  if (challenge.type === 'insufficiency_probe') return []
  if (challenge.type === 'citation_overreach_probe') return []
  if (challenge.type === 'cross_document_contradiction') {
    return unique([challenge.document_a_evidence_id, challenge.document_b_evidence_id])
  }
  return primaryEvidenceIds(item)
}

function derivedAnswer(item) {
  const type = challengeType(item)
  if (type === 'insufficiency_probe') return 'ABSTAIN'
  if (type === 'citation_overreach_probe') return 'ABSTAIN'
  if (type === 'cross_document_contradiction') return 'CONFLICT'
  return item.expected_answer
}

function finalLabel(item) {
  const answer = derivedAnswer(item)
  if (answer === 'ABSTAIN') return 'INSUFFICIENT'
  if (answer === 'CONFLICT') return 'CONFLICT'
  const native = String((item.source_examples || [])[0]?.native_answer || '').toUpperCase()
  if (['SUPPORTS', 'REFUTES'].includes(native)) return native
  return 'SUPPORTED'
}

function labelPolicy(item) {
  const type = challengeType(item)
  if (type === 'native_row') {
    return {
      tier: highTrustNativeCategories.has(item.category) ? 'hf_native_gold' : 'hf_native_label',
      rule: 'Use the primary Hugging Face row answer and native evidence ids.',
    }
  }
  if (type === 'insufficiency_probe' || type === 'citation_overreach_probe') {
    return {
      tier: 'deterministic_transform_gold',
      rule: 'The wrapper asks for a conclusion not entailed by the supplied evidence, so the benchmark answer is ABSTAIN with no required citations.',
    }
  }
  if (type === 'document_lifecycle_appendix') {
    return {
      tier: 'deterministic_transform_gold',
      rule: 'The synthetic appendix explicitly states that it controls the final answer and must be cited with the original evidence.',
    }
  }
  if (type === 'stale_current_conflict' || type === 'authority_conflict' || type === 'as_of_date_constraint') {
    return {
      tier: 'deterministic_transform_gold',
      rule: 'The challenge metadata names the controlling source ids; derive the answer from the primary HF-native label and cite only controlling evidence.',
    }
  }
  if (type === 'cross_document_contradiction') {
    return {
      tier: 'deterministic_transform_gold',
      rule: 'The challenge explicitly requires CONFLICT rather than a smoothed synthesized answer.',
    }
  }
  return {
    tier: 'needs_derivation_rule',
    rule: `No derivation rule registered for ${type}.`,
  }
}

function buildItem(item) {
  const policy = labelPolicy(item)
  const requiredCitationIds = derivedCitationIds(item)
  const evidenceIds = new Set(allEvidenceUnits(item).map((evidence) => evidence.id))
  const findings = []
  if (!hasAnswer(item)) findings.push('missing_native_or_derived_answer')
  for (const id of requiredCitationIds) {
    if (!evidenceIds.has(id)) findings.push(`required_citation_missing_from_evidence:${id}`)
  }
  if (!highTrustNativeCategories.has(item.category) && !deterministicTransformCategories.has(item.category)) {
    findings.push('category_has_no_derivation_policy')
  }
  if (challengeType(item) === 'cross_document_contradiction' && requiredCitationIds.length < 2) {
    findings.push('cross_document_contradiction_requires_two_document_ids')
  }
  if (challengeType(item) === 'document_lifecycle_appendix' && requiredCitationIds.length < 2) {
    findings.push('lifecycle_label_requires_original_and_appendix_ids')
  }

  return {
    id: item.id,
    category: item.category,
    construction: item.construction,
    transform: item.transform,
    challenge_type: challengeType(item),
    label_tier: policy.tier,
    derivation_rule: policy.rule,
    final_label: finalLabel(item),
    final_answer: derivedAnswer(item),
    required_citation_ids: requiredCitationIds,
    insufficient_or_conflicting_evidence: ['INSUFFICIENT', 'CONFLICT'].includes(finalLabel(item)),
    source_datasets: nativeDatasets(item),
    source_row_ids: nativeRowIds(item),
    source_examples: item.source_examples,
    challenge: item.challenge,
    question: item.question,
    scoring_focus: item.scoring_focus,
    expected_failure: item.expected_failure,
    derivation_findings: findings,
    paper_eligible: findings.length === 0 && ['hf_native_gold', 'deterministic_transform_gold'].includes(policy.tier),
  }
}

function buildSuite(pilotSuite) {
  const items = pilotSuite.items.map(buildItem)
  const byCategory = Object.fromEntries(
    unique(items.map((item) => item.category)).map((category) => {
      const scoped = items.filter((item) => item.category === category)
      return [
        category,
        {
          items: scoped.length,
          paper_eligible_items: scoped.filter((item) => item.paper_eligible).length,
          hf_native_gold_items: scoped.filter((item) => item.label_tier === 'hf_native_gold').length,
          deterministic_transform_gold_items: scoped.filter((item) => item.label_tier === 'deterministic_transform_gold').length,
          finding_count: scoped.reduce((sum, item) => sum + item.derivation_findings.length, 0),
        },
      ]
    }),
  )
  const findings = items.flatMap((item) =>
    item.derivation_findings.map((finding) => ({
      item_id: item.id,
      category: item.category,
      finding,
    })),
  )
  const datasetIds = unique(items.flatMap((item) => item.source_datasets))
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    version: 'hf-derived-label-suite-v1',
    derived_label_suite_ready: findings.length === 0 && items.every((item) => item.paper_eligible),
    completion_claim_allowed: false,
    generated_from: {
      pilot_suite: 'generated/pilot-suite.json',
      source: 'Hugging Face native answers, native evidence ids, and deterministic challenge metadata',
    },
    claim_boundary: {
      primary_truth_source: 'Hugging Face dataset-native supervision plus deterministic transformations',
      human_annotation_role: 'optional audit and error analysis only; not the primary label source',
      remaining_release_blockers: [
        'scale the HF-derived item pool by category',
        'run baseline systems against the derived suite',
        'complete final June 2026 novelty audit before paper completion claims',
      ],
    },
    summary: {
      items: items.length,
      paper_eligible_items: items.filter((item) => item.paper_eligible).length,
      categories: Object.keys(byCategory).length,
      datasets: datasetIds.length,
      source_rows: unique(items.flatMap((item) => item.source_row_ids)).length,
      hf_native_gold_items: items.filter((item) => item.label_tier === 'hf_native_gold').length,
      deterministic_transform_gold_items: items.filter((item) => item.label_tier === 'deterministic_transform_gold').length,
      finding_count: findings.length,
      completion_claim_allowed: false,
    },
    by_category: byCategory,
    findings,
    items,
  }
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function renderMarkdown(suite) {
  const summaryRows = [
    ['Suite ready', String(suite.derived_label_suite_ready)],
    ['Items', String(suite.summary.items)],
    ['Paper-eligible items', String(suite.summary.paper_eligible_items)],
    ['Categories', String(suite.summary.categories)],
    ['HF datasets', String(suite.summary.datasets)],
    ['HF source rows', String(suite.summary.source_rows)],
    ['HF-native gold items', String(suite.summary.hf_native_gold_items)],
    ['Deterministic transform gold items', String(suite.summary.deterministic_transform_gold_items)],
    ['Findings', String(suite.summary.finding_count)],
    ['Completion claim allowed', String(suite.summary.completion_claim_allowed)],
  ]
  const categoryRows = Object.entries(suite.by_category).map(([category, row]) => [
    category,
    String(row.items),
    String(row.paper_eligible_items),
    String(row.hf_native_gold_items),
    String(row.deterministic_transform_gold_items),
    String(row.finding_count),
  ])
  const itemRows = suite.items.map((item) => [
    item.id,
    item.category,
    item.challenge_type,
    item.label_tier,
    item.final_label,
    String(item.required_citation_ids.length),
    String(item.paper_eligible),
  ])
  const findingRows = suite.findings.map((finding) => [
    finding.item_id,
    finding.category,
    finding.finding,
  ])

  return `# Hard Grounded Research Derived Label Suite

This generated suite promotes benchmark labels from Hugging Face dataset-native answers, native evidence ids, and deterministic challenge metadata. Human annotation is not the primary label source; it remains an optional audit layer for spot-checking and qualitative error analysis.

## Summary

${markdownTable(['Field', 'Value'], summaryRows)}

## Claim Boundary

- Primary truth source: ${suite.claim_boundary.primary_truth_source}
- Human annotation role: ${suite.claim_boundary.human_annotation_role}
- Completion claim allowed: ${suite.summary.completion_claim_allowed}

## Category Coverage

${markdownTable(['Category', 'Items', 'Paper-eligible', 'HF-native gold', 'Deterministic transform gold', 'Findings'], categoryRows)}

## Items

${markdownTable(['Item', 'Category', 'Challenge', 'Tier', 'Final label', 'Required citations', 'Paper eligible'], itemRows)}

## Findings

${findingRows.length ? markdownTable(['Item', 'Category', 'Finding'], findingRows) : 'No derivation findings.'}
`
}

const pilotSuite = readJson(pilotSuitePath)
const suite = buildSuite(pilotSuite)
writeJson(outputJsonPath, suite)
writeText(outputMarkdownPath, renderMarkdown(suite))

console.log(`Wrote hard grounded derived label suite to ${outputJsonPath}`)
console.log(`Wrote hard grounded derived label suite report to ${outputMarkdownPath}`)
