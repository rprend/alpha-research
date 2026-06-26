import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'annotation-quality-control.json')
const reportMarkdownPath = join(experimentDir, 'ANNOTATION_QUALITY_CONTROL.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
  reviewCalibration: join(generatedDir, 'review-calibration.json'),
  reviewPreflight: join(generatedDir, 'review-preflight.json'),
  expansionReviewPreflight: join(generatedDir, 'expansion-review-preflight.json'),
  sourceAcquisitionReviewPreflight: join(generatedDir, 'source-acquisition-review-preflight.json'),
  annotatorAgreement: join(generatedDir, 'annotator-agreement.json'),
  adjudicationReadiness: join(generatedDir, 'adjudication-readiness.json'),
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

function buildReport({
  spec,
  annotationExport,
  reviewCalibration,
  reviewPreflight,
  expansionReviewPreflight,
  sourceAcquisitionReviewPreflight,
  annotatorAgreement,
  adjudicationReadiness,
}) {
  const pilotRows = reviewPreflight.total_review_rows || 0
  const expansionRows = expansionReviewPreflight.total_review_rows || 0
  const sourceAcquisitionRows = sourceAcquisitionReviewPreflight.total_review_rows || 0
  const totalReviewRows = pilotRows + expansionRows + sourceAcquisitionRows
  const sentinelCount = reviewCalibration.sentinel_count || 0
  const sentinelInsertionRate = totalReviewRows ? Number((sentinelCount / totalReviewRows).toFixed(4)) : null
  const blindOverlapRows = annotationExport.totals?.row_count || pilotRows + expansionRows

  const qaRules = [
    {
      id: 'calibration_before_assignment',
      threshold: `reviewer calibration accuracy >= ${reviewCalibration.acceptance_policy?.minimum_accuracy}`,
      enforcement: 'Reviewers who miss calibration sentinels are retrained before receiving benchmark rows.',
    },
    {
      id: 'double_blind_overlap',
      threshold: '2 independent reviews for every pilot, expansion, and source-acquisition candidate before promotion',
      enforcement: 'Single-reviewed rows remain in preflight queues and cannot be promoted.',
    },
    {
      id: 'citation_support_check',
      threshold: 'required citation ids must exist and support the final label, not only a nearby fact',
      enforcement: 'Citation id, label, answer, and insufficiency/conflict mismatches go to adjudication or repair.',
    },
    {
      id: 'adjudication_sampling',
      threshold: '100% of disagreements plus any invalid/calibration-failed reviewer batch',
      enforcement: 'Adjudication readiness must be regenerated before release after returned labels are imported.',
    },
    {
      id: 'agreement_claim_gate',
      threshold: 'agreement claims require completed reviewer pairs and non-null agreement metrics',
      enforcement: 'The paper must report unavailable agreement as unavailable while reviewer pairs are incomplete.',
    },
  ]

  return {
    benchmark_id: spec.id,
    annotation_quality_control_ready: Boolean(reviewCalibration.review_calibration_ready) && qaRules.length >= 5,
    completion_claim_allowed: false,
    generated_from: {
      annotation_export: 'generated/annotation-export/manifest.json',
      review_calibration: 'generated/review-calibration.json',
      review_preflight: 'generated/review-preflight.json',
      expansion_review_preflight: 'generated/expansion-review-preflight.json',
      source_acquisition_review_preflight: 'generated/source-acquisition-review-preflight.json',
      annotator_agreement: 'generated/annotator-agreement.json',
      adjudication_readiness: 'generated/adjudication-readiness.json',
    },
    workload: {
      categories: spec.categories.length,
      exported_review_rows: annotationExport.totals?.row_count || 0,
      pilot_review_rows: pilotRows,
      expansion_review_rows: expansionRows,
      source_acquisition_review_rows: sourceAcquisitionRows,
      total_review_rows: totalReviewRows,
      blind_overlap_rows: blindOverlapRows,
      calibration_sentinels: sentinelCount,
      sentinel_insertion_rate: sentinelInsertionRate,
    },
    thresholds: {
      minimum_calibration_accuracy: reviewCalibration.acceptance_policy?.minimum_accuracy,
      required_reviews_per_item: 2,
      adjudicate_disagreements: true,
      allow_gold_without_completed_preflight: false,
      allow_agreement_claim_without_completed_pairs: false,
      allow_sentinel_rows_in_gold: false,
    },
    current_state: {
      completed_metric_pairs: annotatorAgreement.summary?.completed_metric_pairs || 0,
      agreement_claim_allowed: Boolean(annotatorAgreement.summary?.agreement_claim_allowed),
      adjudication_release_promotion_allowed: Boolean(adjudicationReadiness.release_promotion_allowed),
      review_rows_complete: {
        pilot: reviewPreflight.complete_review_rows || 0,
        expansion: expansionReviewPreflight.complete_review_rows || 0,
        source_acquisition: sourceAcquisitionReviewPreflight.complete_review_rows || 0,
      },
    },
    qa_rules: qaRules,
  }
}

function renderMarkdown(report) {
  const workloadRows = Object.entries(report.workload).map(([key, value]) => [key, String(value)])
  const ruleRows = report.qa_rules.map((rule) => [rule.id, rule.threshold, rule.enforcement])

  return `# Hard Grounded Research Annotation Quality Control

This generated plan defines the quality-control rules for collecting labels. It is not evidence that review is complete; it is the pre-registered acceptance policy that returned labels must satisfy before gold promotion or paper claims.

## Summary

- Quality-control plan ready: ${report.annotation_quality_control_ready}
- Completion claim allowed: ${report.completion_claim_allowed}
- Required reviews per item: ${report.thresholds.required_reviews_per_item}
- Minimum calibration accuracy: ${report.thresholds.minimum_calibration_accuracy}
- Allow sentinel rows in gold: ${report.thresholds.allow_sentinel_rows_in_gold}
- Allow gold without completed preflight: ${report.thresholds.allow_gold_without_completed_preflight}

## Workload

${markdownTable(['Field', 'Value'], workloadRows)}

## Quality Rules

${markdownTable(['Rule', 'Threshold', 'Enforcement'], ruleRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  if (!existsSync(path)) throw new Error(`Missing annotation quality-control input ${name}: ${path}`)
}

const report = buildReport({
  spec: readJson(inputs.spec),
  annotationExport: readJson(inputs.annotationExport),
  reviewCalibration: readJson(inputs.reviewCalibration),
  reviewPreflight: readJson(inputs.reviewPreflight),
  expansionReviewPreflight: readJson(inputs.expansionReviewPreflight),
  sourceAcquisitionReviewPreflight: readJson(inputs.sourceAcquisitionReviewPreflight),
  annotatorAgreement: readJson(inputs.annotatorAgreement),
  adjudicationReadiness: readJson(inputs.adjudicationReadiness),
})

writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded annotation quality-control JSON to ${reportJsonPath}`)
console.log(`Wrote hard grounded annotation quality-control report to ${reportMarkdownPath}`)
