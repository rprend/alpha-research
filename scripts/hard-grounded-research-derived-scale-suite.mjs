import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const expansionCandidatesPath = join(generatedDir, 'expansion-candidates.json')
const outputJsonPath = join(generatedDir, 'derived-scale-suite.json')
const outputMarkdownPath = join(experimentDir, 'DERIVED_SCALE_SUITE.md')

const targetItemsPerCategory = 30

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

const derivedChallengeTypeByCategory = {
  'stale-vs-current document conflicts': 'stale_current_conflict',
  'appended document lifecycle changes': 'document_lifecycle_appendix',
  'source authority conflicts': 'authority_conflict',
  'evidence insufficiency / abstention': 'insufficiency_probe',
  'citation supports fact but not conclusion': 'citation_overreach_probe',
  'temporal questions: as of date X': 'as_of_date_constraint',
  'cross-document contradiction': 'cross_document_contradiction',
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

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function allEvidenceUnits(item) {
  return (item.source_examples || []).flatMap((source) => source.evidence_units || [])
}

function evidenceIds(item) {
  return allEvidenceUnits(item).map((evidence) => evidence.id).filter(Boolean)
}

function sourceDatasets(item) {
  return unique((item.source_examples || []).map((source) => source.source_dataset))
}

function sourceRowIds(item) {
  return unique((item.source_examples || []).map((source) => source.source_row_id))
}

function challengeType(item) {
  return item.challenge?.type || derivedChallengeTypeByCategory[item.category] || 'native_row'
}

function derivedCitationIds(item) {
  const type = challengeType(item)
  const ids = evidenceIds(item)
  if (type === 'insufficiency_probe' || type === 'citation_overreach_probe') return []
  if (item.challenge?.original_body || item.challenge?.appended_update) {
    return unique([
      item.challenge.original_body?.evidence_id,
      item.challenge.appended_update?.evidence_id,
    ])
  }
  if (item.challenge?.current_document?.evidence_id) return [item.challenge.current_document.evidence_id]
  if (item.challenge?.high_authority_evidence_id) return [item.challenge.high_authority_evidence_id]
  if (item.challenge?.valid_evidence_ids) return item.challenge.valid_evidence_ids
  if (type === 'cross_document_contradiction') return ids.slice(0, Math.max(2, Math.min(ids.length, 3)))
  return ids.slice(0, Math.min(ids.length, 2))
}

function derivedAnswer(item) {
  const type = challengeType(item)
  if (type === 'insufficiency_probe' || type === 'citation_overreach_probe') return 'ABSTAIN'
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

function labelTier(item) {
  if (highTrustNativeCategories.has(item.category)) return 'hf_native_gold'
  if (deterministicTransformCategories.has(item.category)) return 'deterministic_transform_gold'
  return 'needs_derivation_rule'
}

function derivationRule(item) {
  const type = challengeType(item)
  if (type === 'native_row') return 'Use the Hugging Face row answer and source evidence ids.'
  if (type === 'insufficiency_probe' || type === 'citation_overreach_probe') {
    return 'The derived task asks for a conclusion not entailed by the supplied evidence, so the benchmark answer is ABSTAIN with no required citations.'
  }
  if (type === 'cross_document_contradiction') {
    return 'The derived task presents incompatible evidence and requires CONFLICT rather than a smoothed synthesized answer.'
  }
  return 'Use the deterministic benchmark category rule to identify the controlling Hugging Face evidence while preserving the native answer.'
}

function buildScaleItem(item, sourceSplit) {
  const requiredCitationIds = derivedCitationIds(item)
  const availableEvidenceIds = new Set(evidenceIds(item))
  const findings = []
  if (!String(derivedAnswer(item) || '').trim()) findings.push('missing_native_or_derived_answer')
  for (const id of requiredCitationIds) {
    if (!availableEvidenceIds.has(id)) findings.push(`required_citation_missing_from_evidence:${id}`)
  }
  if (labelTier(item) === 'needs_derivation_rule') findings.push('category_has_no_derivation_policy')
  if (challengeType(item) === 'cross_document_contradiction' && requiredCitationIds.length < 2) {
    findings.push('cross_document_contradiction_requires_two_document_ids')
  }

  return {
    id: item.id,
    source_split: sourceSplit,
    category: item.category,
    construction: item.construction,
    transform: item.transform,
    challenge_type: challengeType(item),
    label_tier: labelTier(item),
    derivation_rule: derivationRule(item),
    final_label: finalLabel(item),
    final_answer: derivedAnswer(item),
    required_citation_ids: requiredCitationIds,
    source_datasets: sourceDatasets(item),
    source_row_ids: sourceRowIds(item),
    question: item.question,
    source_examples: item.source_examples,
    challenge: item.challenge || null,
    expected_failure: item.expected_failure,
    scoring_focus: item.scoring_focus,
    audit_status: item.review_status || 'optional_audit_not_required_for_primary_label',
    derivation_findings: findings,
    paper_eligible: findings.length === 0 && ['hf_native_gold', 'deterministic_transform_gold'].includes(labelTier(item)),
  }
}

function buildSuite(pilotSuite, expansionCandidates) {
  const combined = [
    ...pilotSuite.items.map((item) => buildScaleItem(item, 'pilot')),
    ...expansionCandidates.candidates.map((item) => buildScaleItem(item, 'expansion')),
  ]
  const categories = unique(combined.map((item) => item.category))
  const byCategory = Object.fromEntries(
    categories.map((category) => {
      const scoped = combined.filter((item) => item.category === category)
      const paperEligible = scoped.filter((item) => item.paper_eligible)
      return [
        category,
        {
          target_items: targetItemsPerCategory,
          items: scoped.length,
          pilot_items: scoped.filter((item) => item.source_split === 'pilot').length,
          expansion_items: scoped.filter((item) => item.source_split === 'expansion').length,
          paper_eligible_items: paperEligible.length,
          hf_native_gold_items: paperEligible.filter((item) => item.label_tier === 'hf_native_gold').length,
          deterministic_transform_gold_items: paperEligible.filter((item) => item.label_tier === 'deterministic_transform_gold').length,
          finding_count: scoped.reduce((sum, item) => sum + item.derivation_findings.length, 0),
          ready: paperEligible.length >= targetItemsPerCategory,
        },
      ]
    }),
  )
  const findings = combined.flatMap((item) =>
    item.derivation_findings.map((finding) => ({
      item_id: item.id,
      category: item.category,
      finding,
    })),
  )
  const paperEligibleItems = combined.filter((item) => item.paper_eligible)
  const datasetIds = unique(combined.flatMap((item) => item.source_datasets))
  const ready = findings.length === 0 && Object.values(byCategory).every((category) => category.ready)

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    version: 'hf-derived-scale-suite-v1',
    derived_scale_suite_ready: ready,
    target_items_per_category: targetItemsPerCategory,
    generated_from: {
      pilot_suite: 'generated/pilot-suite.json',
      expansion_candidates: 'generated/expansion-candidates.json',
      source: 'Hugging Face dataset-native supervision plus deterministic category transforms; human review is optional audit only.',
    },
    summary: {
      items: combined.length,
      paper_eligible_items: paperEligibleItems.length,
      categories: categories.length,
      ready_categories: Object.values(byCategory).filter((category) => category.ready).length,
      datasets: datasetIds.length,
      source_rows: unique(combined.flatMap((item) => item.source_row_ids)).length,
      pilot_items: combined.filter((item) => item.source_split === 'pilot').length,
      expansion_items: combined.filter((item) => item.source_split === 'expansion').length,
      hf_native_gold_items: paperEligibleItems.filter((item) => item.label_tier === 'hf_native_gold').length,
      deterministic_transform_gold_items: paperEligibleItems.filter((item) => item.label_tier === 'deterministic_transform_gold').length,
      finding_count: findings.length,
    },
    by_category: byCategory,
    findings,
    items: combined,
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
    ['Suite ready', String(suite.derived_scale_suite_ready)],
    ['Items', String(suite.summary.items)],
    ['Paper-eligible items', String(suite.summary.paper_eligible_items)],
    ['Categories', String(suite.summary.categories)],
    ['Ready categories', String(suite.summary.ready_categories)],
    ['HF datasets', String(suite.summary.datasets)],
    ['HF source rows', String(suite.summary.source_rows)],
    ['Pilot items', String(suite.summary.pilot_items)],
    ['Expansion items', String(suite.summary.expansion_items)],
    ['HF-native gold items', String(suite.summary.hf_native_gold_items)],
    ['Deterministic transform gold items', String(suite.summary.deterministic_transform_gold_items)],
    ['Findings', String(suite.summary.finding_count)],
  ]
  const categoryRows = Object.entries(suite.by_category).map(([category, row]) => [
    category,
    String(row.target_items),
    String(row.items),
    String(row.paper_eligible_items),
    String(row.pilot_items),
    String(row.expansion_items),
    row.ready ? 'yes' : 'no',
  ])
  const findingRows = suite.findings.map((finding) => [finding.item_id, finding.category, finding.finding])

  return `# Hard Grounded Research Derived Scale Suite

This generated suite combines the 30-item pilot with 270 expansion candidates and promotes labels from Hugging Face dataset-native supervision plus deterministic benchmark category transforms. Human review is retained as an optional audit layer, not a prerequisite label source.

## Summary

${markdownTable(['Field', 'Value'], summaryRows)}

## Category Coverage

${markdownTable(['Category', 'Target', 'Items', 'Paper-eligible', 'Pilot', 'Expansion', 'Ready'], categoryRows)}

## Findings

${findingRows.length ? markdownTable(['Item', 'Category', 'Finding'], findingRows) : 'No derivation findings.'}
`
}

const suite = buildSuite(readJson(pilotSuitePath), readJson(expansionCandidatesPath))
writeJson(outputJsonPath, suite)
writeText(outputMarkdownPath, renderMarkdown(suite))

console.log(`Wrote hard grounded derived scale suite to ${outputJsonPath}`)
console.log(`Wrote hard grounded derived scale suite report to ${outputMarkdownPath}`)
