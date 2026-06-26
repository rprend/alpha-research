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
  derivedScaleSuite: join(generatedDir, 'derived-scale-suite.json'),
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

function buildLedger({ scalePlan, scaleAdjudicationPlan, reviewIntakeValidator, releaseGate, derivedScaleSuite }) {
  const adjudicationByCategory = scaleAdjudicationPlan.by_category || {}
  const categories = scalePlan.categories.map((category) => {
    const adjudication = adjudicationByCategory[category.category] || {}
    const batches = scalePlan.expansion_batches.filter((batch) => batch.category === category.category)
    return {
      category: category.category,
      target_reviewed_items: category.target_reviewed_items,
      target_hf_derived_items: category.target_hf_derived_items,
      current_valid_reviewed_items: category.current_valid_reviewed_items,
      current_hf_derived_items: category.current_hf_derived_items,
      reviewed_item_deficit: Math.max(0, category.target_reviewed_items - category.current_valid_reviewed_items),
      hf_derived_item_deficit: Math.max(0, category.target_hf_derived_items - category.current_hf_derived_items),
      planned_candidate_items: batches.reduce((sum, batch) => sum + batch.target_new_items, 0),
      planned_review_rows: batches.reduce((sum, batch) => sum + batch.review_rows_required, 0),
      first_wave_batches: adjudication.first_wave_batches || 0,
      merge_ready_items: adjudication.merge_ready_items || 0,
      missing_reviews: adjudication.missing_reviews || 0,
      scale_claim_status:
        category.current_hf_derived_items >= category.target_hf_derived_items
          ? 'scale_claim_allowed'
          : 'blocked_until_hf_derived_items_meet_target',
      required_next_actions: [
        'keep reviewer packets available as optional audit material',
        'use HF-derived labels as the primary category-scale source',
        'run packet-level intake validation only for applied audit returns',
        'record audit disagreements as error-analysis findings',
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
      id: 'hf_derived_deficits_resolved',
      passed: categories.every((category) => category.hf_derived_item_deficit === 0) && derivedScaleSuite.derived_scale_suite_ready === true,
      detail: `${categories.reduce((sum, category) => sum + category.hf_derived_item_deficit, 0)} HF-derived items still needed`,
    },
    {
      id: 'intake_blocker_linked',
      passed: reviewIntakeValidator.summary?.blocked_packets > 0 && reviewIntakeValidator.summary?.completion_claim_allowed === false,
      detail: `${reviewIntakeValidator.summary?.blocked_packets ?? 0} blocked intake packets`,
    },
    {
      id: 'release_scale_gate_passed',
      passed: gates.some((gate) => gate.id === 'category_scale_ready' && gate.passed === true),
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
      derived_scale_suite: 'generated/derived-scale-suite.json',
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
      target_hf_derived_items_per_category: scalePlan.target_hf_derived_items_per_category,
      total_target_hf_derived_items: scalePlan.total_target_hf_derived_items,
      current_hf_derived_items: scalePlan.current_hf_derived_items,
      hf_derived_item_deficit: categories.reduce((sum, category) => sum + category.hf_derived_item_deficit, 0),
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
    String(category.target_hf_derived_items),
    String(category.current_hf_derived_items),
    String(category.hf_derived_item_deficit),
    String(category.planned_candidate_items),
    String(category.planned_review_rows),
    category.scale_claim_status,
  ])

  return `# Hard Grounded Research Scale Gap Ledger

This generated ledger turns the paper's category-scale requirement into auditable HF-derived item counts. Human review rows remain optional audit infrastructure and do not define the primary labels.

## Summary

- Scale gap ledger ready: ${ledger.scale_gap_ledger_ready}
- Version: ${ledger.version}
- Categories: ${ledger.summary.categories}
- Target HF-derived items per category: ${ledger.summary.target_hf_derived_items_per_category}
- Total target HF-derived items: ${ledger.summary.total_target_hf_derived_items}
- Current HF-derived items: ${ledger.summary.current_hf_derived_items}
- HF-derived item deficit: ${ledger.summary.hf_derived_item_deficit}
- Planned candidate items: ${ledger.summary.planned_candidate_items}
- Planned optional audit review rows: ${ledger.summary.planned_review_rows}
- Blocked intake packets: ${ledger.summary.blocked_intake_packets}
- Completion claim allowed: ${ledger.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Release Gates

${markdownTable(['Gate', 'Passed', 'Detail', 'Blocker'], gateRows)}

## Category Deficits

${markdownTable(['Category', 'Target derived', 'Current derived', 'Deficit', 'Planned candidates', 'Optional audit rows', 'Scale claim status'], categoryRows)}
`
}

const ledger = buildLedger({
  scalePlan: readJson(inputs.scalePlan),
  scaleAdjudicationPlan: readJson(inputs.scaleAdjudicationPlan),
  reviewIntakeValidator: readJson(inputs.reviewIntakeValidator),
  releaseGate: readJson(inputs.releaseGate),
  derivedScaleSuite: readJson(inputs.derivedScaleSuite),
})

writeJson(ledgerJsonPath, ledger)
writeText(ledgerMarkdownPath, renderMarkdown(ledger))

console.log(`Wrote hard grounded scale gap ledger to ${ledgerJsonPath}`)
console.log(`Wrote hard grounded scale gap ledger report to ${ledgerMarkdownPath}`)
