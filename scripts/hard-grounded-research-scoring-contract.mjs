import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'scoring-contract.json')
const reportMarkdownPath = join(experimentDir, 'SCORING_CONTRACT.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  rubrics: join(experimentDir, 'rubrics.json'),
  submissionContract: join(generatedDir, 'submission-contract.json'),
  annotationQualityControl: join(generatedDir, 'annotation-quality-control.json'),
  responsibleUse: join(generatedDir, 'responsible-use.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
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

function buildMetricDefinitions(spec) {
  const specMetricIds = new Set(spec.metrics.map((metric) => metric.id))
  const definitions = [
    {
      id: 'answer_correctness',
      unit: 'task',
      formula: '1 when the final answer matches the reviewed gold answer or correctly abstains; 0 otherwise.',
      required_fields: ['answer', 'abstained'],
      claim_boundary: 'Diagnostic on pilot labels; publishable only on reviewed gold.',
    },
    {
      id: 'evidence_recall',
      unit: 'task',
      formula: 'required_gold_evidence_units_cited / required_gold_evidence_units; abstentions with insufficient evidence use abstention_quality instead.',
      required_fields: ['citations'],
      claim_boundary: 'Requires reviewed gold evidence-unit labels.',
    },
    {
      id: 'citation_precision',
      unit: 'citation',
      formula: 'supported_citations / submitted_citations after rejecting citations outside the task evidence set.',
      required_fields: ['citations', 'answer'],
      claim_boundary: 'Requires citation-level support review before paper claims.',
    },
    {
      id: 'citation_faithfulness',
      unit: 'answer_sentence',
      formula: '1 only when each non-abstention answer sentence is directly supported by the cited evidence attached to it.',
      required_fields: ['answer', 'citations', 'evidence_assessment'],
      claim_boundary: 'Separates fact support from conclusion support; not a lexical-overlap metric.',
    },
    {
      id: 'conclusion_support',
      unit: 'task',
      formula: '1 when cited evidence supports the final conclusion, not merely a true premise or related fact.',
      required_fields: ['answer', 'citations', 'evidence_assessment'],
      claim_boundary: 'Primary metric for citation-supports-fact-but-not-conclusion failures.',
    },
    {
      id: 'conflict_handling',
      unit: 'task',
      formula: '1 when the answer names and resolves stale, contradictory, or lower-authority evidence according to the task rubric.',
      required_fields: ['answer', 'citations', 'evidence_assessment'],
      claim_boundary: 'Report by conflict category only after category-scale review passes.',
    },
    {
      id: 'temporal_validity',
      unit: 'task',
      formula: '1 when cited evidence is valid for the requested as-of date or explicitly excluded as later/stale contrast.',
      required_fields: ['answer', 'citations', 'evidence_assessment'],
      claim_boundary: 'Requires document-date and lifecycle labels.',
    },
    {
      id: 'abstention_quality',
      unit: 'task',
      formula: '1 when abstention is triggered by reviewed insufficiency or unresolved conflict and names the missing or conflicting evidence.',
      required_fields: ['answer', 'abstained', 'evidence_assessment'],
      claim_boundary: 'False abstentions are scored as answer errors, not cautious successes.',
    },
  ]

  return definitions.map((definition) => ({
    ...definition,
    in_benchmark_spec: specMetricIds.has(definition.id),
  }))
}

function buildReport({ spec, rubrics, submissionContract, annotationQualityControl, responsibleUse, paperClaimLedger }) {
  const metrics = buildMetricDefinitions(spec)
  const requiredMetricIds = ['answer_correctness', 'evidence_recall', 'citation_precision', 'citation_faithfulness', 'conclusion_support', 'abstention_quality']
  const requiredMetricSet = new Set(requiredMetricIds)
  const categoryRows = spec.categories.map((category) => ({
    category,
    rubric_dimensions: rubrics.category_rubrics[category]?.required_dimensions || [],
    primary_metrics: metrics
      .filter((metric) => {
        if (category.includes('abstention')) return ['abstention_quality', 'answer_correctness'].includes(metric.id)
        if (category.includes('citation supports fact')) return ['citation_faithfulness', 'conclusion_support'].includes(metric.id)
        if (category.includes('temporal') || category.includes('stale') || category.includes('lifecycle')) return ['temporal_validity', 'conflict_handling'].includes(metric.id)
        if (category.includes('authority') || category.includes('contradiction')) return ['conflict_handling', 'conclusion_support'].includes(metric.id)
        return ['answer_correctness', 'evidence_recall', 'citation_precision'].includes(metric.id)
      })
      .map((metric) => metric.id),
  }))

  const validationRules = [
    'Reject any non-abstention answer with zero citations before metric scoring.',
    'Reject citations that are not task evidence-unit ids under the submission contract.',
    'Score citation_faithfulness separately from answer_correctness so a true fact cannot launder an unsupported conclusion.',
    'Score abstention_quality only for tasks labeled insufficient, contradictory beyond resolution, or impossible under the as-of date.',
    'Macro-average by category after item-level scoring; do not publish category claims until category_scale_ready passes.',
    'Do not publish leaderboard rankings while responsible-use public_leaderboard_allowed is false.',
  ]

  return {
    benchmark_id: spec.id,
    scoring_contract_ready:
      requiredMetricIds.every((id) => metrics.some((metric) => metric.id === id)) &&
      validationRules.length >= 6 &&
      submissionContract.submission_contract_ready &&
      annotationQualityControl.annotation_quality_control_ready,
    version: 'scoring-contract-v1',
    generated_from: {
      benchmark_spec: 'benchmark-spec.json',
      rubrics: 'rubrics.json',
      submission_contract: 'generated/submission-contract.json',
      annotation_quality_control: 'generated/annotation-quality-control.json',
      responsible_use: 'generated/responsible-use.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
    },
    scoring_sources: submissionContract.scoring_sources,
    metric_definitions: metrics,
    required_metric_ids: requiredMetricIds,
    category_metric_map: categoryRows,
    aggregation: {
      item_score_source: 'reviewed gold labels once gold_review_complete and review_merge_ready pass',
      pilot_use: 'diagnostic-only smoke and qualitative failure analysis',
      macro_average: 'mean item score within category, then unweighted mean across categories for headline diagnostic summaries',
      confidence_intervals: 'bootstrap over reviewed items after the power plan target is met',
    },
    validation_rules: validationRules,
    claim_limits: {
      public_leaderboard_allowed: Boolean(responsibleUse.public_leaderboard_allowed),
      completion_claim_allowed: false,
      gold_required_for_leaderboard: true,
      category_claims_blocked_until: ['gold_review_complete', 'review_merge_ready', 'category_scale_ready', 'novelty_audit_final'],
      paper_claims_allowed_now: paperClaimLedger.summary?.allowed_claims ?? 0,
      paper_claims_prohibited_now: paperClaimLedger.summary?.prohibited_claims ?? 0,
    },
    summary: {
      metric_count: metrics.length,
      required_metric_count: metrics.filter((metric) => requiredMetricSet.has(metric.id)).length,
      category_count: categoryRows.length,
      validation_rule_count: validationRules.length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(report) {
  const metricRows = report.metric_definitions.map((metric) => [
    metric.id,
    metric.unit,
    metric.formula,
    metric.claim_boundary,
  ])
  const categoryRows = report.category_metric_map.map((entry) => [
    entry.category,
    entry.rubric_dimensions.join(', '),
    entry.primary_metrics.join(', '),
  ])
  const ruleRows = report.validation_rules.map((rule, index) => [String(index + 1), rule])

  return `# Hard Grounded Research Scoring Contract

This generated contract defines metric formulas, aggregation rules, and claim limits for scored submissions. It is intentionally stricter than the submission schema because the benchmark targets grounded research failures where a citation may support a fact but not the conclusion.

## Summary

- Scoring contract ready: ${report.scoring_contract_ready}
- Version: ${report.version}
- Metrics: ${report.summary.metric_count}
- Required metrics covered: ${report.summary.required_metric_count}/${report.required_metric_ids.length}
- Categories mapped: ${report.summary.category_count}
- Public leaderboard allowed: ${report.claim_limits.public_leaderboard_allowed}
- Completion claim allowed: ${report.claim_limits.completion_claim_allowed}

## Metric Definitions

${markdownTable(['Metric', 'Unit', 'Formula', 'Claim Boundary'], metricRows)}

## Category Metric Map

${markdownTable(['Category', 'Rubric Dimensions', 'Primary Metrics'], categoryRows)}

## Validation Rules

${markdownTable(['#', 'Rule'], ruleRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  if (!existsSync(path)) throw new Error(`Missing scoring-contract input ${name}: ${path}`)
}

const report = buildReport({
  spec: readJson(inputs.spec),
  rubrics: readJson(inputs.rubrics),
  submissionContract: readJson(inputs.submissionContract),
  annotationQualityControl: readJson(inputs.annotationQualityControl),
  responsibleUse: readJson(inputs.responsibleUse),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
})

writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded scoring contract JSON to ${reportJsonPath}`)
console.log(`Wrote hard grounded scoring contract report to ${reportMarkdownPath}`)
