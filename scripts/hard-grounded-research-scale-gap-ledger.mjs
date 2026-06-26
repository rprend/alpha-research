import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const ledgerJsonPath = join(generatedDir, 'scale-gap-ledger.json')
const ledgerMarkdownPath = join(experimentDir, 'SCALE_GAP_LEDGER.md')

const inputs = {
  scalePlan: join(generatedDir, 'scale-plan.json'),
  scaleAdjudicationPlan: join(generatedDir, 'scale-adjudication-plan.json'),
  reviewIntakeValidator: join(generatedDir, 'review-intake-validator.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
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

function buildLedger({ scalePlan, scaleAdjudicationPlan, reviewIntakeValidator, releaseGate }) {
  const adjudicationByCategory = scaleAdjudicationPlan.by_category || {}
  const categories = scalePlan.categories.map((category) => {
    const adjudication = adjudicationByCategory[category.category] || {}
    const batches = scalePlan.expansion_batches.filter((batch) => batch.category === category.category)
    return {
      category: category.category,
      target_reviewed_items: category.target_reviewed_items,
      current_valid_reviewed_items: category.current_valid_reviewed_items,
      reviewed_item_deficit: Math.max(0, category.target_reviewed_items - category.current_valid_reviewed_items),
      planned_candidate_items: batches.reduce((sum, batch) => sum + batch.target_new_items, 0),
      planned_review_rows: batches.reduce((sum, batch) => sum + batch.review_rows_required, 0),
      first_wave_batches: adjudication.first_wave_batches || 0,
      merge_ready_items: adjudication.merge_ready_items || 0,
      missing_reviews: adjudication.missing_reviews || 0,
      scale_claim_status:
        category.current_valid_reviewed_items >= category.target_reviewed_items
          ? 'scale_claim_allowed'
          : 'blocked_until_reviewed_items_meet_target',
      required_next_actions: [
        'collect returned reviewer packets',
        'pass packet-level intake validation',
        'apply clean import dry-run',
        'resolve disagreements',
        'promote reviewed items into category-scale counts',
      ],
    }
  })
  const gates = ['category_scale_ready', 'expansion_review_preflight_ready', 'expansion_review_merge_ready'].map((id) =>
    releaseCheck(releaseGate, id),
  )
  const checks = [
    {
      id: 'all_categories_have_gap_rows',
      passed: categories.length === scalePlan.category_count,
      detail: `${categories.length}/${scalePlan.category_count} categories`,
    },
    {
      id: 'target_matches_power_plan_scale',
      passed: categories.every((category) => category.target_reviewed_items === scalePlan.target_reviewed_items_per_category),
      detail: `target=${scalePlan.target_reviewed_items_per_category}`,
    },
    {
      id: 'deficits_remain_visible',
      passed: categories.some((category) => category.reviewed_item_deficit > 0),
      detail: `${categories.reduce((sum, category) => sum + category.reviewed_item_deficit, 0)} reviewed items still needed`,
    },
    {
      id: 'intake_blocker_linked',
      passed: reviewIntakeValidator.summary?.blocked_packets > 0 && reviewIntakeValidator.summary?.completion_claim_allowed === false,
      detail: `${reviewIntakeValidator.summary?.blocked_packets ?? 0} blocked intake packets`,
    },
    {
      id: 'release_scale_gate_still_blocked',
      passed: gates.some((gate) => gate.id === 'category_scale_ready' && gate.passed === false),
      detail: releaseCheck(releaseGate, 'category_scale_ready').detail,
    },
  ]

  return {
    scale_gap_ledger_ready: checks.every((check) => check.passed),
    version: 'scale-gap-ledger-v1',
    completion_claim_allowed: false,
    generated_from: {
      scale_plan: 'generated/scale-plan.json',
      scale_adjudication_plan: 'generated/scale-adjudication-plan.json',
      review_intake_validator: 'generated/review-intake-validator.json',
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
      target_reviewed_items_per_category: scalePlan.target_reviewed_items_per_category,
      total_target_reviewed_items: scalePlan.total_target_reviewed_items,
      current_valid_reviewed_items: scalePlan.current_valid_reviewed_items,
      reviewed_item_deficit: categories.reduce((sum, category) => sum + category.reviewed_item_deficit, 0),
      planned_candidate_items: categories.reduce((sum, category) => sum + category.planned_candidate_items, 0),
      planned_review_rows: categories.reduce((sum, category) => sum + category.planned_review_rows, 0),
      blocked_intake_packets: reviewIntakeValidator.summary.blocked_packets,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(ledger) {
  const checkRows = ledger.checks.map((check) => [check.id, String(check.passed), check.detail])
  const gateRows = ledger.gates.map((gate) => [gate.id, String(gate.passed), gate.detail, gate.blocker])
  const categoryRows = ledger.categories.map((category) => [
    category.category,
    String(category.target_reviewed_items),
    String(category.current_valid_reviewed_items),
    String(category.reviewed_item_deficit),
    String(category.planned_candidate_items),
    String(category.planned_review_rows),
    category.scale_claim_status,
  ])

  return `# Hard Grounded Research Scale Gap Ledger

This generated ledger turns the paper's category-scale requirement into auditable deficits. It does not clear category-level, review, merge, novelty, or completion claims.

## Summary

- Scale gap ledger ready: ${ledger.scale_gap_ledger_ready}
- Version: ${ledger.version}
- Categories: ${ledger.summary.categories}
- Target reviewed items per category: ${ledger.summary.target_reviewed_items_per_category}
- Total target reviewed items: ${ledger.summary.total_target_reviewed_items}
- Current valid reviewed items: ${ledger.summary.current_valid_reviewed_items}
- Reviewed item deficit: ${ledger.summary.reviewed_item_deficit}
- Planned candidate items: ${ledger.summary.planned_candidate_items}
- Planned review rows: ${ledger.summary.planned_review_rows}
- Blocked intake packets: ${ledger.summary.blocked_intake_packets}
- Completion claim allowed: ${ledger.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Release Gates

${markdownTable(['Gate', 'Passed', 'Detail', 'Blocker'], gateRows)}

## Category Deficits

${markdownTable(['Category', 'Target reviewed', 'Current reviewed', 'Deficit', 'Planned candidates', 'Planned review rows', 'Scale claim status'], categoryRows)}
`
}

const ledger = buildLedger({
  scalePlan: readJson(inputs.scalePlan),
  scaleAdjudicationPlan: readJson(inputs.scaleAdjudicationPlan),
  reviewIntakeValidator: readJson(inputs.reviewIntakeValidator),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(ledgerJsonPath, ledger)
writeText(ledgerMarkdownPath, renderMarkdown(ledger))

console.log(`Wrote hard grounded scale gap ledger to ${ledgerJsonPath}`)
console.log(`Wrote hard grounded scale gap ledger report to ${ledgerMarkdownPath}`)
