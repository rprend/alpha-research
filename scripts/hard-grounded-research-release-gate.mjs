import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const runsDir = join(experimentDir, 'runs')
const releaseGateJsonPath = join(generatedDir, 'release-gate.json')
const releaseGateMarkdownPath = join(experimentDir, 'RELEASE_GATE.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  noveltyAudit: join(experimentDir, 'NOVELTY_AUDIT.md'),
  goldSummary: join(generatedDir, 'gold-suite-summary.json'),
  reviewMergeReport: join(generatedDir, 'review-merge-report.json'),
  itemQualityAudit: join(generatedDir, 'item-quality-audit.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readText(path) {
  return readFileSync(path, 'utf8')
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

function existingScoredModelRuns() {
  return [
    'openai-grounded-baseline-v1',
    'openai-grounded-baseline-v1-calibration',
  ].filter((runId) => existsSync(join(runsDir, runId, 'report.json')))
}

function noveltyAuditStatus(noveltyAudit) {
  return {
    checked_date: noveltyAudit.match(/^Date checked:\s*(.+)$/m)?.[1] || '',
    preliminary: /Status:\s*preliminary/i.test(noveltyAudit),
    says_do_not_claim_novelty: /Do not claim novelty yet/i.test(noveltyAudit),
  }
}

function buildGate({ spec, noveltyAudit, goldSummary, reviewMergeReport, itemQualityAudit, baselineAnalysis }) {
  const unknownLicenseDatasets = spec.datasets.filter((dataset) => !dataset.license || dataset.license === 'unknown')
  const scoredModelRuns = existingScoredModelRuns()
  const novelty = noveltyAuditStatus(noveltyAudit)
  const checks = [
    {
      id: 'gold_review_complete',
      passed: Boolean(goldSummary.gold_ready),
      detail: `${goldSummary.valid_reviewed_items}/${goldSummary.total_items} valid reviewed items`,
      blocker: 'Complete double review, resolve disagreements, and promote reviewed gold.',
    },
    {
      id: 'review_merge_ready',
      passed: Boolean(reviewMergeReport.merge_ready),
      detail: `${reviewMergeReport.merge_ready_items}/${reviewMergeReport.unique_items} merge-ready items`,
      blocker: 'Fill reviewer workbooks until strict review merge succeeds.',
    },
    {
      id: 'unknown_license_resolved',
      passed: unknownLicenseDatasets.length === 0,
      detail: unknownLicenseDatasets.length
        ? unknownLicenseDatasets.map((dataset) => dataset.id).join(', ')
        : 'all source dataset licenses known',
      blocker: 'Resolve, replace, or pointer-only package unknown-license sources before public redistribution.',
    },
    {
      id: 'repair_queue_clear',
      passed: itemQualityAudit.repair_before_gold === 0,
      detail: `${itemQualityAudit.repair_before_gold} repair-before-gold items`,
      blocker: 'Repair or explicitly waive all repair-before-gold items.',
    },
    {
      id: 'frontier_or_open_model_results_present',
      passed: scoredModelRuns.length >= 2,
      detail: scoredModelRuns.length ? scoredModelRuns.join(', ') : 'no scored model reports present',
      blocker: 'Run and score at least two frontier or open model baselines over the release scoring source.',
    },
    {
      id: 'novelty_audit_final',
      passed: !novelty.preliminary && !novelty.says_do_not_claim_novelty,
      detail: `checked=${novelty.checked_date || 'unknown'} preliminary=${novelty.preliminary}`,
      blocker: 'Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion.',
    },
  ]

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    status: checks.every((check) => check.passed) ? 'release_ready' : 'blocked',
    generated_from: {
      spec: 'benchmark-spec.json',
      novelty_audit: 'NOVELTY_AUDIT.md',
      gold_summary: 'generated/gold-suite-summary.json',
      review_merge_report: 'generated/review-merge-report.json',
      item_quality_audit: 'generated/item-quality-audit.json',
      baseline_analysis: 'generated/baseline-analysis.json',
    },
    pilot_item_count: goldSummary.total_items,
    scored_system_count: baselineAnalysis.systems.length,
    checks,
    blockers: checks.filter((check) => !check.passed).map((check) => ({
      id: check.id,
      detail: check.detail,
      blocker: check.blocker,
    })),
  }
}

function renderMarkdown(gate) {
  const checkRows = gate.checks.map((check) => [
    check.id,
    check.passed ? 'yes' : 'no',
    check.detail,
    check.passed ? '' : check.blocker,
  ])

  return `# Hard Grounded Research Release Gate

This generated gate is intentionally conservative. It prevents the pilot benchmark from being treated as paper-ready or public-release-ready until review, licensing, model baselines, and novelty evidence are complete.

## Summary

- Status: ${gate.status}
- Pilot items: ${gate.pilot_item_count}
- Scored systems in baseline analysis: ${gate.scored_system_count}
- Blockers: ${gate.blockers.length}

## Checks

${markdownTable(['Check', 'Passed', 'Detail', 'Blocker if failed'], checkRows)}

## Current Blockers

${gate.blockers.length ? gate.blockers.map((blocker) => `- ${blocker.id}: ${blocker.blocker} (${blocker.detail})`).join('\n') : 'No release blockers are present.'}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing release gate input ${name}: ${path}`)
}

const gate = buildGate({
  spec: readJson(inputs.spec),
  noveltyAudit: readText(inputs.noveltyAudit),
  goldSummary: readJson(inputs.goldSummary),
  reviewMergeReport: readJson(inputs.reviewMergeReport),
  itemQualityAudit: readJson(inputs.itemQualityAudit),
  baselineAnalysis: readJson(inputs.baselineAnalysis),
})

writeJson(releaseGateJsonPath, gate)
writeText(releaseGateMarkdownPath, renderMarkdown(gate))
console.log(`Wrote hard grounded research release gate to ${releaseGateJsonPath}`)
console.log(`Wrote hard grounded research release gate report to ${releaseGateMarkdownPath}`)
