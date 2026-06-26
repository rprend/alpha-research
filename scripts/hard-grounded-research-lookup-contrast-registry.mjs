import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const registryJsonPath = join(generatedDir, 'lookup-contrast-registry.json')
const registryMarkdownPath = join(experimentDir, 'LOOKUP_CONTRAST_REGISTRY.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  difficultyMechanismLedger: join(generatedDir, 'difficulty-mechanism-ledger.json'),
  hypothesisTestMatrix: join(generatedDir, 'hypothesis-test-matrix.json'),
  evidenceSufficiencyAudit: join(generatedDir, 'evidence-sufficiency-audit.json'),
  estimandRegistry: join(generatedDir, 'estimand-registry.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
}

const lookupContrastMap = {
  'multi-hop synthesis': {
    lookup_control: 'Retrieve one page or one sentence containing a relevant entity fact.',
    hard_operation: 'Compose two or more required hops and reject a topically relevant but nonessential page.',
    failure_if_lookup_only: 'The answer may be correct but the cited evidence misses one required hop or includes a distractor as if it were necessary.',
  },
  'stale-vs-current document conflicts': {
    lookup_control: 'Find a document that contains the requested claim text.',
    hard_operation: 'Select the controlling current snapshot and mark stale evidence as non-controlling.',
    failure_if_lookup_only: 'The answer blends old and current snapshots or treats stale evidence as equally valid.',
  },
  'appended document lifecycle changes': {
    lookup_control: 'Find the original paper body passage that states a relevant claim.',
    hard_operation: 'Detect appended or lifecycle material that narrows, qualifies, or supersedes the original body.',
    failure_if_lookup_only: 'The answer cites original-body evidence for a conclusion controlled by the appended material.',
  },
  'table + text reasoning': {
    lookup_control: 'Extract a table cell or caption fact.',
    hard_operation: 'Combine table denotation with surrounding text before drawing the conclusion.',
    failure_if_lookup_only: 'The answer extracts the right cell but draws a conclusion the text or caption does not support.',
  },
  'source authority conflicts': {
    lookup_control: 'Find a clear source that says a plausible answer.',
    hard_operation: 'Rank sources by authority and explain why lower-authority evidence is rejected.',
    failure_if_lookup_only: 'The answer chooses the clearest prose instead of the highest-authority source.',
  },
  'evidence insufficiency / abstention': {
    lookup_control: 'Find a related fact or candidate evidence passage.',
    hard_operation: 'Decide whether the evidence entails the requested conclusion and abstain when it does not.',
    failure_if_lookup_only: 'The answer supplies a plausible conclusion from evidence that supports only a related premise.',
  },
  'citation supports fact but not conclusion': {
    lookup_control: 'Find a citation that supports a true premise.',
    hard_operation: 'Separate premise support from conclusion support and reject unsupported inference.',
    failure_if_lookup_only: 'The answer uses a true citation as post-hoc support for a broader conclusion it does not entail.',
  },
  'entity disambiguation': {
    lookup_control: 'Find a fact about a name, title, place, or abbreviation.',
    hard_operation: 'Resolve the intended entity and reject same-name or same-title distractors.',
    failure_if_lookup_only: 'The answer merges entities that share a surface form.',
  },
  'temporal questions: as of date X': {
    lookup_control: 'Find the most salient or newest relevant evidence.',
    hard_operation: 'Filter evidence by the requested as-of date and exclude future or stale evidence.',
    failure_if_lookup_only: 'The answer leaks later evidence into an as-of answer or ignores the date constraint.',
  },
  'cross-document contradiction': {
    lookup_control: 'Find documents that mention the topic.',
    hard_operation: 'Partition incompatible evidence and report conflict or apply the stated control rule.',
    failure_if_lookup_only: 'The answer smooths contradictory evidence into a false consensus.',
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

function challengeType(item) {
  return item.challenge?.type || item.transform || 'native_row'
}

function buildRegistry({
  spec,
  pilotSuite,
  difficultyMechanismLedger,
  hypothesisTestMatrix,
  evidenceSufficiencyAudit,
  estimandRegistry,
  paperClaimLedger,
}) {
  const rows = spec.categories.map((category) => {
    const pilotItems = pilotSuite.items.filter((item) => item.category === category)
    const mechanism = difficultyMechanismLedger.categories.find((entry) => entry.category === category)
    const hypothesis = hypothesisTestMatrix.rows.find((entry) => entry.category === category)
    const evidenceContract = evidenceSufficiencyAudit.category_rows.find((entry) => entry.category === category)
    const estimand = estimandRegistry.estimands.find((entry) => entry.category === category)
    const contrast = lookupContrastMap[category]
    return {
      category,
      lookup_control: contrast.lookup_control,
      hard_grounding_operation: contrast.hard_operation,
      failure_if_lookup_only: contrast.failure_if_lookup_only,
      pilot_items: pilotItems.length,
      challenge_types: [...new Set(pilotItems.map(challengeType))].sort(),
      difficulty_mechanisms: mechanism?.mechanisms || [],
      hypothesis: hypothesis?.hypothesis || '',
      primary_metrics: hypothesis?.primary_metrics || [],
      estimand_id: estimand?.id || '',
      evidence_contracts_present: evidenceContract?.evidence_contracts_present || 0,
      trap_or_control_items: evidenceContract?.distractor_or_control_items || 0,
      claim_status: 'diagnostic_only_until_review_scale_and_novelty_clear',
    }
  })

  const checks = [
    {
      id: 'all_categories_have_lookup_contrast',
      passed: rows.length === spec.categories.length && rows.every((row) => row.lookup_control && row.hard_grounding_operation),
      detail: `${rows.length}/${spec.categories.length} categories define lookup controls and hard operations`,
    },
    {
      id: 'lookup_contrasts_link_to_hypotheses_and_estimands',
      passed: rows.every((row) => row.hypothesis && row.estimand_id && row.primary_metrics.length > 0),
      detail: `${rows.filter((row) => row.hypothesis && row.estimand_id).length}/${rows.length} rows link hypothesis and estimand`,
    },
    {
      id: 'lookup_contrasts_have_pilot_and_evidence_contracts',
      passed: rows.every((row) => row.pilot_items >= 3 && row.evidence_contracts_present === row.pilot_items),
      detail: `${rows.filter((row) => row.pilot_items >= 3 && row.evidence_contracts_present === row.pilot_items).length}/${rows.length} categories have pilot items with evidence contracts`,
    },
    {
      id: 'claims_remain_gated',
      passed:
        paperClaimLedger.completion_claim_allowed === false &&
        rows.every((row) => row.claim_status === 'diagnostic_only_until_review_scale_and_novelty_clear'),
      detail: `completion_claim_allowed=${paperClaimLedger.completion_claim_allowed}; diagnostic_only_categories=${rows.length}`,
    },
  ]

  return {
    lookup_contrast_registry_ready: checks.every((check) => check.passed),
    version: 'lookup-contrast-registry-v1',
    completion_claim_allowed: false,
    generated_from: {
      benchmark_spec: 'benchmark-spec.json',
      pilot_suite: 'generated/pilot-suite.json',
      difficulty_mechanism_ledger: 'generated/difficulty-mechanism-ledger.json',
      hypothesis_test_matrix: 'generated/hypothesis-test-matrix.json',
      evidence_sufficiency_audit: 'generated/evidence-sufficiency-audit.json',
      estimand_registry: 'generated/estimand-registry.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
    },
    checks,
    rows,
    summary: {
      categories: rows.length,
      pilot_items: rows.reduce((sum, row) => sum + row.pilot_items, 0),
      lookup_controls: rows.filter((row) => row.lookup_control).length,
      hard_grounding_operations: rows.filter((row) => row.hard_grounding_operation).length,
      hypothesis_links: rows.filter((row) => row.hypothesis).length,
      estimand_links: rows.filter((row) => row.estimand_id).length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(registry) {
  const checkRows = registry.checks.map((check) => [check.id, String(check.passed), check.detail])
  const contrastRows = registry.rows.map((row) => [
    row.category,
    row.lookup_control,
    row.hard_grounding_operation,
    row.failure_if_lookup_only,
    row.primary_metrics.join('<br>'),
    row.claim_status,
  ])

  return `# Hard Grounded Research Lookup Contrast Registry

This generated registry states the simple lookup control for every category and the additional grounded-research operation that the benchmark is designed to test. It makes the paper question auditable: failures should be interpreted as hard-grounding failures only when they exceed what a simple fact lookup control would require.

## Summary

- Registry ready: ${registry.lookup_contrast_registry_ready}
- Version: ${registry.version}
- Categories: ${registry.summary.categories}
- Pilot items: ${registry.summary.pilot_items}
- Lookup controls: ${registry.summary.lookup_controls}
- Hard grounding operations: ${registry.summary.hard_grounding_operations}
- Hypothesis links: ${registry.summary.hypothesis_links}
- Estimand links: ${registry.summary.estimand_links}
- Completion claim allowed: ${registry.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Lookup Contrasts

${markdownTable(['Category', 'Simple lookup control', 'Hard grounding operation', 'Expected lookup-only failure', 'Primary metrics', 'Claim status'], contrastRows)}
`
}

const registry = buildRegistry({
  spec: readJson(inputs.spec),
  pilotSuite: readJson(inputs.pilotSuite),
  difficultyMechanismLedger: readJson(inputs.difficultyMechanismLedger),
  hypothesisTestMatrix: readJson(inputs.hypothesisTestMatrix),
  evidenceSufficiencyAudit: readJson(inputs.evidenceSufficiencyAudit),
  estimandRegistry: readJson(inputs.estimandRegistry),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
})

writeJson(registryJsonPath, registry)
writeText(registryMarkdownPath, renderMarkdown(registry))

console.log(`Wrote hard grounded lookup contrast registry to ${registryJsonPath}`)
console.log(`Wrote hard grounded lookup contrast registry report to ${registryMarkdownPath}`)
