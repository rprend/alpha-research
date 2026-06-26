import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const ledgerJsonPath = join(generatedDir, 'difficulty-mechanism-ledger.json')
const ledgerMarkdownPath = join(experimentDir, 'DIFFICULTY_MECHANISM_LEDGER.md')

const inputs = {
  constructMap: join(generatedDir, 'construct-map.json'),
  failureAtlas: join(generatedDir, 'failure-atlas.json'),
  scaleGapLedger: join(generatedDir, 'scale-gap-ledger.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
}

const mechanismMap = {
  'multi-hop synthesis': [
    'requires evidence composition across separate facts',
    'distractors can support one hop without supporting the final answer',
  ],
  'stale-vs-current document conflicts': [
    'requires rejecting plausible stale evidence',
    'requires selecting the controlling current document snapshot',
  ],
  'appended document lifecycle changes': [
    'requires tracking document state after appendices or errata',
    'requires recognizing when later appended material supersedes body text',
  ],
  'table + text reasoning': [
    'requires joining structured table cells with textual qualifiers',
    'requires numeric or tabular grounding plus prose interpretation',
  ],
  'source authority conflicts': [
    'requires resolving evidence by authority hierarchy',
    'requires ignoring lower-authority evidence that is locally plausible',
  ],
  'evidence insufficiency / abstention': [
    'requires distinguishing relevant context from sufficient evidence',
    'requires abstaining when citations are near misses',
  ],
  'citation supports fact but not conclusion': [
    'requires checking whether cited facts license the final conclusion',
    'requires detecting conclusion overreach despite faithful subfact citation',
  ],
  'entity disambiguation': [
    'requires binding evidence to the intended referent',
    'requires resisting same-name or near-name distractors',
  ],
  'temporal questions: as of date X': [
    'requires answering relative to an explicit date',
    'requires excluding evidence outside the requested temporal snapshot',
  ],
  'cross-document contradiction': [
    'requires reporting conflict or applying a control rule',
    'requires avoiding synthesis across incompatible documents',
  ],
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

function releaseCheck(releaseGate, id) {
  return releaseGate.checks.find((check) => check.id === id) || {
    id,
    passed: false,
    detail: 'missing release check',
    blocker: 'missing release check',
  }
}

function buildLedger({ constructMap, failureAtlas, scaleGapLedger, paperClaimLedger, releaseGate }) {
  const failureByCategory = failureAtlas.by_category || {}
  const scaleByCategory = new Map(scaleGapLedger.categories.map((category) => [category.category, category]))
  const categories = constructMap.constructs.map((construct) => {
    const failure = failureByCategory[construct.category] || {}
    const scale = scaleByCategory.get(construct.category) || {}
    const mechanisms = mechanismMap[construct.category] || ['requires grounded evidence use beyond fact lookup']
    return {
      category: construct.category,
      mechanisms,
      construct_ready: construct.construct_ready,
      target_metrics: construct.target_metrics,
      observed_failure_cases: failure.case_count || 0,
      observed_failure_modes: failure.top_failure_modes || [],
      pilot_items: construct.pilot_items,
      reviewed_item_deficit: scale.reviewed_item_deficit ?? construct.review_status.reviewed_gap,
      novelty_risk: construct.novelty_risk,
      claim_status:
        (scale.reviewed_item_deficit ?? construct.review_status.reviewed_gap) === 0
          ? 'eligible_after_final_novelty_audit'
          : 'blocked_until_review_scale_and_novelty_clear',
    }
  })
  const gates = ['category_scale_ready', 'novelty_audit_final', 'review_merge_ready'].map((id) => releaseCheck(releaseGate, id))
  const prohibitedClaims =
    paperClaimLedger.summary?.prohibited_claims ??
    (paperClaimLedger.claims || []).filter((claim) => String(claim.status).startsWith('prohibited')).length
  const checks = [
    {
      id: 'all_constructs_have_mechanisms',
      passed: categories.length === constructMap.summary.category_count && categories.every((category) => category.mechanisms.length >= 2),
      detail: `${categories.length}/${constructMap.summary.category_count} categories mapped`,
    },
    {
      id: 'failure_atlas_linked',
      passed: categories.every((category) => category.observed_failure_cases > 0) && failureAtlas.summary.failure_mode_count >= 5,
      detail: `${failureAtlas.summary.failure_case_count} failure cases; ${failureAtlas.summary.failure_mode_count} failure modes`,
    },
    {
      id: 'scale_deficits_linked',
      passed: categories.reduce((sum, category) => sum + category.reviewed_item_deficit, 0) === scaleGapLedger.summary.reviewed_item_deficit,
      detail: `${scaleGapLedger.summary.reviewed_item_deficit} reviewed items still needed`,
    },
    {
      id: 'paper_claims_still_blocked',
      passed: prohibitedClaims >= 3 && releaseGate.status !== 'release_ready',
      detail: `${prohibitedClaims} prohibited claims; release=${releaseGate.status}`,
    },
  ]

  return {
    difficulty_mechanism_ledger_ready: checks.every((check) => check.passed),
    version: 'difficulty-mechanism-ledger-v1',
    completion_claim_allowed: false,
    generated_from: {
      construct_map: 'generated/construct-map.json',
      failure_atlas: 'generated/failure-atlas.json',
      scale_gap_ledger: 'generated/scale-gap-ledger.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
      release_gate: 'generated/release-gate.json',
    },
    checks,
    gates: gates.map((gate) => ({
      id: gate.id,
      passed: gate.passed,
      detail: gate.detail,
      blocker: gate.blocker,
    })),
    categories,
    summary: {
      categories: categories.length,
      mechanisms: categories.reduce((sum, category) => sum + category.mechanisms.length, 0),
      observed_failure_cases: categories.reduce((sum, category) => sum + category.observed_failure_cases, 0),
      reviewed_item_deficit: categories.reduce((sum, category) => sum + category.reviewed_item_deficit, 0),
      blocked_claim_categories: categories.filter((category) => category.claim_status !== 'eligible_after_final_novelty_audit').length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(ledger) {
  const checkRows = ledger.checks.map((check) => [check.id, String(check.passed), check.detail])
  const categoryRows = ledger.categories.map((category) => [
    category.category,
    category.mechanisms.join('<br>'),
    category.target_metrics.join('<br>'),
    String(category.observed_failure_cases),
    category.observed_failure_modes.join('<br>'),
    String(category.reviewed_item_deficit),
    category.claim_status,
  ])
  const gateRows = ledger.gates.map((gate) => [gate.id, String(gate.passed), gate.detail, gate.blocker])

  return `# Hard Grounded Research Difficulty Mechanism Ledger

This generated ledger connects each benchmark category to the hypothesized mechanism that makes grounded research hard, observed failure signals from current baselines, and the claim blockers that prevent overclaiming.

## Summary

- Ledger ready: ${ledger.difficulty_mechanism_ledger_ready}
- Version: ${ledger.version}
- Categories: ${ledger.summary.categories}
- Mechanisms: ${ledger.summary.mechanisms}
- Observed failure cases: ${ledger.summary.observed_failure_cases}
- Reviewed item deficit: ${ledger.summary.reviewed_item_deficit}
- Blocked claim categories: ${ledger.summary.blocked_claim_categories}
- Completion claim allowed: ${ledger.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Category Mechanisms

${markdownTable(['Category', 'Mechanisms', 'Target metrics', 'Failure cases', 'Observed modes', 'Reviewed deficit', 'Claim status'], categoryRows)}

## Blocking Gates

${markdownTable(['Gate', 'Passed', 'Detail', 'Blocker'], gateRows)}
`
}

const ledger = buildLedger({
  constructMap: readJson(inputs.constructMap),
  failureAtlas: readJson(inputs.failureAtlas),
  scaleGapLedger: readJson(inputs.scaleGapLedger),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(ledgerJsonPath, ledger)
writeText(ledgerMarkdownPath, renderMarkdown(ledger))

console.log(`Wrote hard grounded difficulty mechanism ledger to ${ledgerJsonPath}`)
console.log(`Wrote hard grounded difficulty mechanism ledger report to ${ledgerMarkdownPath}`)
