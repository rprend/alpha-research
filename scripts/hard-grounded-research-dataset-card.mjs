import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const datasetCardPath = join(experimentDir, 'DATASET_CARD.md')

const inputPaths = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  coverageMatrix: join(generatedDir, 'coverage-matrix.json'),
  itemQualityAudit: join(generatedDir, 'item-quality-audit.json'),
  reviewMergeReport: join(generatedDir, 'review-merge-report.json'),
  goldSummary: join(generatedDir, 'gold-suite-summary.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
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

function datasetRows(spec) {
  return spec.datasets.map((dataset) => [
    dataset.id,
    dataset.license || 'unknown',
    dataset.url,
    dataset.covers.join('<br>'),
  ])
}

function categoryRows(coverageMatrix) {
  return coverageMatrix.map((row) => [
    row.category,
    String(row.dataset_count),
    String(row.task_count),
    row.datasets.join('<br>'),
  ])
}

function challengeRows(pilotSuite) {
  const counts = new Map()
  for (const item of pilotSuite.items) {
    const challengeType = item.challenge?.type || 'native_row'
    counts.set(challengeType, (counts.get(challengeType) || 0) + 1)
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([challengeType, count]) => [challengeType, String(count)])
}

function renderCard({ spec, pilotSuite, coverageMatrix, itemQualityAudit, reviewMergeReport, goldSummary, baselineAnalysis, releaseGate }) {
  return `# Hard Grounded Research Dataset Card

Status: pilot benchmark card generated from repository artifacts. This is not a final public release card until gold review is complete.

## Dataset Summary

Hard Grounded Research is a pilot benchmark for grounded research QA failure modes that go beyond simple fact lookup. Items are derived from public Hugging Face datasets and transformed into tasks that test document-state reasoning, source authority, temporal validity, evidence sufficiency, table/text interpretation, citation overreach, entity disambiguation, and contradiction handling.

- Benchmark id: \`${spec.id}\`
- Pilot items: ${pilotSuite.items.length}
- Categories: ${spec.categories.length}
- Source Hugging Face datasets: ${spec.datasets.length}
- Gold ready: ${goldSummary.gold_ready}
- Valid reviewed items: ${goldSummary.valid_reviewed_items}/${goldSummary.total_items}
- Release gate status: ${releaseGate.status}

## Intended Uses

- Evaluate grounded research QA systems under adversarial evidence-use conditions.
- Diagnose whether failures come from answer selection, citation coverage, conclusion support, abstention, temporal validity, or contradiction handling.
- Support a benchmark/position paper about what makes grounded research hard beyond lookup.

## Out-of-Scope Uses

- Do not treat the current pilot as final gold data.
- Do not use mechanically seeded labels as human-validated truth.
- Do not compare production systems as a leaderboard until double review, disagreement resolution, and novelty refresh are complete.

## Source Datasets

${markdownTable(['Dataset', 'License', 'HF URL', 'Benchmark roles'], datasetRows(spec))}

## Category Coverage

${markdownTable(['Category', 'Datasets', 'Seed tasks', 'Dataset ids'], categoryRows(coverageMatrix))}

## Challenge-Type Coverage

${markdownTable(['Challenge type', 'Pilot items'], challengeRows(pilotSuite))}

## Annotation And Review

- Review workbooks: \`generated/review-workbooks/*.jsonl\`
- Independent reviews required per item: 2
- Missing-review items: ${reviewMergeReport.missing_review_items}
- Disagreement items: ${reviewMergeReport.disagreement_items}
- Repair-before-gold items: ${itemQualityAudit.repair_before_gold}
- Review-carefully items: ${itemQualityAudit.review_carefully}
- Exact agreement rate: ${reviewMergeReport.agreement?.exact_agreement_rate ?? 'n/a'}
- Label agreement rate: ${reviewMergeReport.agreement?.label_agreement_rate ?? 'n/a'}

## Scoring

The evaluator reports answer correctness, evidence recall, citation precision, citation faithfulness, conclusion support, and abstention quality. Challenge-type diagnostics are present for ${baselineAnalysis.systems.length} scored baseline systems in \`generated/baseline-analysis.json\`.

## Data Provenance And Licensing Notes

This benchmark stores normalized evidence snippets and metadata from upstream Hugging Face datasets. Upstream dataset licenses are mixed and include unknown-license sources, so a public release must either preserve attribution and license notices, replace unknown-license sources, or release only pointers/transforms where required. The current pilot should be treated as research-internal until this license review is complete.

## Known Limitations

1. Current scale is ${pilotSuite.items.length} pilot items, not the target 30-50 reviewed items per category.
2. Gold labels are blocked until independent review and disagreement resolution are complete.
3. Some challenge items are synthetic transformations of existing rows and require human review before publication.
4. The novelty audit is preliminary and must be refreshed before any completion claim.
5. Unknown-license upstream datasets must be resolved before public redistribution.

## Release Gate

See \`RELEASE_GATE.md\` and \`generated/release-gate.json\`. Current blockers: ${releaseGate.blockers.length}.
`
}

for (const [name, path] of Object.entries(inputPaths)) {
  assert(existsSync(path), `Missing dataset card input ${name}: ${path}`)
}

writeText(
  datasetCardPath,
  renderCard({
    spec: readJson(inputPaths.spec),
    pilotSuite: readJson(inputPaths.pilotSuite),
    coverageMatrix: readJson(inputPaths.coverageMatrix),
    itemQualityAudit: readJson(inputPaths.itemQualityAudit),
    reviewMergeReport: readJson(inputPaths.reviewMergeReport),
    goldSummary: readJson(inputPaths.goldSummary),
    baselineAnalysis: readJson(inputPaths.baselineAnalysis),
    releaseGate: readJson(inputPaths.releaseGate),
  }),
)

console.log(`Wrote hard grounded research dataset card to ${datasetCardPath}`)
