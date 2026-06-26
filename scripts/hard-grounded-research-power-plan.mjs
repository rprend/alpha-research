import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const powerPlanJsonPath = join(generatedDir, 'power-plan.json')
const powerPlanMarkdownPath = join(experimentDir, 'POWER_PLAN.md')

const inputs = {
  scalePlan: join(generatedDir, 'scale-plan.json'),
  baselineUncertainty: join(generatedDir, 'baseline-uncertainty.json'),
  reviewProgress: join(generatedDir, 'review-progress.json'),
  corpusAudit: join(generatedDir, 'corpus-audit.json'),
  goldSummary: join(generatedDir, 'gold-suite-summary.json'),
}

const z95 = 1.96
const z80 = 0.84
const worstCaseP = 0.5

function assert(condition, message) {
  if (!condition) throw new Error(message)
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

function round(value) {
  return Number(value.toFixed(4))
}

function ciHalfWidth(n, p = worstCaseP) {
  if (!n) return null
  return round(z95 * Math.sqrt((p * (1 - p)) / n))
}

function detectableDelta(n, p = worstCaseP) {
  if (!n) return null
  return round((z95 + z80) * Math.sqrt((2 * p * (1 - p)) / n))
}

function metricRanges(baselineUncertainty) {
  const metrics = baselineUncertainty.metric_names || []
  return metrics.map((metricName) => {
    const intervals = baselineUncertainty.systems
      .map((system) => system.metrics?.[metricName])
      .filter(Boolean)
    return {
      metric: metricName,
      min_mean: round(Math.min(...intervals.map((interval) => interval.mean))),
      max_mean: round(Math.max(...intervals.map((interval) => interval.mean))),
      max_current_ci_half_width: round(Math.max(...intervals.map((interval) => (interval.ci95_high - interval.ci95_low) / 2))),
      systems: intervals.length,
    }
  })
}

function buildPlan({ scalePlan, baselineUncertainty, reviewProgress, corpusAudit, goldSummary }) {
  const targetPerCategory = scalePlan.target_reviewed_items_per_category
  const categoryCount = scalePlan.category_count
  const targetTotal = scalePlan.total_target_reviewed_items
  const currentPilotItems = scalePlan.current_pilot_items
  const currentReviewedItems = goldSummary.valid_reviewed_items || 0
  const currentPilotPerCategory = currentPilotItems / categoryCount

  const sampleSizes = [
    {
      scope: 'current_pilot_overall',
      reviewed_items: currentReviewedItems,
      available_pilot_items: currentPilotItems,
      planning_n: currentPilotItems,
      ci95_half_width_worst_case: ciHalfWidth(currentPilotItems),
      conservative_detectable_delta_80_power: detectableDelta(currentPilotItems),
      interpretation: 'Descriptive pilot diagnostics only; not enough for category-level paper claims.',
    },
    {
      scope: 'current_pilot_per_category',
      reviewed_items: 0,
      available_pilot_items: currentPilotPerCategory,
      planning_n: currentPilotPerCategory,
      ci95_half_width_worst_case: ciHalfWidth(currentPilotPerCategory),
      conservative_detectable_delta_80_power: detectableDelta(currentPilotPerCategory),
      interpretation: 'Too wide for category-level claims; each category currently has only pilot seeds.',
    },
    {
      scope: 'paper_target_per_category',
      reviewed_items: targetPerCategory,
      available_pilot_items: targetPerCategory,
      planning_n: targetPerCategory,
      ci95_half_width_worst_case: ciHalfWidth(targetPerCategory),
      conservative_detectable_delta_80_power: detectableDelta(targetPerCategory),
      interpretation: 'Minimum category-level descriptive target; still reports uncertainty, not a fine-grained leaderboard.',
    },
    {
      scope: 'paper_target_overall',
      reviewed_items: targetTotal,
      available_pilot_items: targetTotal,
      planning_n: targetTotal,
      ci95_half_width_worst_case: ciHalfWidth(targetTotal),
      conservative_detectable_delta_80_power: detectableDelta(targetTotal),
      interpretation: 'Overall benchmark-level estimates become substantially tighter after all categories are reviewed.',
    },
  ]

  const categoryRows = scalePlan.categories.map((category) => ({
    category: category.category,
    target_reviewed_items: category.target_reviewed_items,
    current_valid_reviewed_items: category.current_valid_reviewed_items,
    reviewed_gap: category.additional_reviewed_items_needed,
    ci95_half_width_at_target: ciHalfWidth(category.target_reviewed_items),
    conservative_detectable_delta_at_target: detectableDelta(category.target_reviewed_items),
    scale_ready: category.scale_ready,
  }))

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    power_plan_ready: true,
    generated_from: {
      scale_plan: 'generated/scale-plan.json',
      baseline_uncertainty: 'generated/baseline-uncertainty.json',
      review_progress: 'generated/review-progress.json',
      corpus_audit: 'generated/corpus-audit.json',
      gold_summary: 'generated/gold-suite-summary.json',
    },
    method:
      'Normal-approximation planning intervals for bounded task metrics. Detectable deltas are conservative independent-binomial approximations for two-sided alpha=0.05 and 80% power; paired model comparisons may be tighter once reviewed labels exist.',
    assumptions: {
      alpha: 0.05,
      power: 0.8,
      worst_case_metric_rate: worstCaseP,
      independent_reviews_per_item: 2,
      target_reviewed_items_per_category: targetPerCategory,
      target_reviewed_items_total: targetTotal,
    },
    current_state: {
      current_pilot_items: currentPilotItems,
      current_valid_reviewed_items: currentReviewedItems,
      current_hf_derived_items: scalePlan.current_hf_derived_items,
      pilot_complete_review_rows: reviewProgress.summary.pilot_complete_review_rows,
      expansion_complete_review_rows: reviewProgress.summary.expansion_complete_review_rows,
      scaled_public_items: corpusAudit.summary.scaled_public_items,
      reviewed_items_remaining: reviewProgress.summary.reviewed_items_remaining,
      category_scale_ready: scalePlan.scale_ready,
    },
    sample_size_scenarios: sampleSizes,
    metric_ranges_from_current_pilot: metricRanges(baselineUncertainty),
    category_targets: categoryRows,
    paper_claim_guidance: [
      'Use current 30-item pilot only for diagnostic examples, scorer checks, and baseline smoke comparisons.',
      'Require 30 HF-derived paper-eligible items per category before reporting category-level benchmark results; human review is optional audit.',
      'Report confidence intervals for every metric and avoid fine-grained leaderboard rankings when intervals overlap.',
      'Treat the 300-item HF-derived target as the minimum paper release threshold, not as evidence that all small deltas are detectable.',
    ],
  }
}

function renderMarkdown(plan) {
  const scenarioRows = plan.sample_size_scenarios.map((scenario) => [
    scenario.scope,
    String(scenario.planning_n),
    String(scenario.ci95_half_width_worst_case),
    String(scenario.conservative_detectable_delta_80_power),
    scenario.interpretation,
  ])
  const metricRows = plan.metric_ranges_from_current_pilot.map((metric) => [
    metric.metric,
    String(metric.systems),
    String(metric.min_mean),
    String(metric.max_mean),
    String(metric.max_current_ci_half_width),
  ])
  const categoryRows = plan.category_targets.map((category) => [
    category.category,
    String(category.target_reviewed_items),
    String(category.current_valid_reviewed_items),
    String(category.reviewed_gap),
    String(category.ci95_half_width_at_target),
    String(category.conservative_detectable_delta_at_target),
    category.scale_ready ? 'yes' : 'no',
  ])
  const guidanceRows = plan.paper_claim_guidance.map((guidance, index) => [String(index + 1), guidance])

  return `# Hard Grounded Research Power Plan

This generated plan justifies the paper-scale review target and records what the current pilot can and cannot support. It is planning evidence, not final statistical proof, because gold labels and category-scale review are still incomplete.

## Summary

- Power plan ready: ${plan.power_plan_ready}
- Method: ${plan.method}
- Target reviewed items per category: ${plan.assumptions.target_reviewed_items_per_category}
- Target reviewed items total: ${plan.assumptions.target_reviewed_items_total}
- Current pilot items: ${plan.current_state.current_pilot_items}
- Current valid reviewed items: ${plan.current_state.current_valid_reviewed_items}
- Reviewed items remaining: ${plan.current_state.reviewed_items_remaining}
- Scaled public items available for review: ${plan.current_state.scaled_public_items}
- Category scale ready: ${plan.current_state.category_scale_ready}

## Sample-Size Scenarios

${markdownTable(['Scope', 'Planning n', 'Worst-case 95% half-width', 'Conservative detectable delta', 'Interpretation'], scenarioRows)}

## Current Pilot Metric Ranges

${markdownTable(['Metric', 'Systems', 'Min mean', 'Max mean', 'Max current CI half-width'], metricRows)}

## Category Targets

${markdownTable(['Category', 'Target reviewed', 'Valid reviewed', 'Reviewed gap', 'Target 95% half-width', 'Target detectable delta', 'Ready'], categoryRows)}

## Paper Claim Guidance

${markdownTable(['#', 'Guidance'], guidanceRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing power-plan input ${name}: ${path}`)
}

const plan = buildPlan({
  scalePlan: readJson(inputs.scalePlan),
  baselineUncertainty: readJson(inputs.baselineUncertainty),
  reviewProgress: readJson(inputs.reviewProgress),
  corpusAudit: readJson(inputs.corpusAudit),
  goldSummary: readJson(inputs.goldSummary),
})

writeJson(powerPlanJsonPath, plan)
writeText(powerPlanMarkdownPath, renderMarkdown(plan))

console.log(`Wrote hard grounded power plan to ${powerPlanJsonPath}`)
console.log(`Wrote hard grounded power report to ${powerPlanMarkdownPath}`)
