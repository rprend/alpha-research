import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const draftPath = join(experimentDir, 'PAPER_DRAFT.md')

const requiredInputs = {
  readme: join(experimentDir, 'README.md'),
  noveltyAudit: join(experimentDir, 'NOVELTY_AUDIT.md'),
  datasetCard: join(experimentDir, 'DATASET_CARD.md'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  spec: join(experimentDir, 'benchmark-spec.json'),
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  coverageMatrix: join(generatedDir, 'coverage-matrix.json'),
  approachScores: join(generatedDir, 'approach-scores.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  goldSummary: join(generatedDir, 'gold-suite-summary.json'),
  reviewMergeReport: join(generatedDir, 'review-merge-report.json'),
  itemQualityAudit: join(generatedDir, 'item-quality-audit.json'),
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

function metric(value) {
  if (value === null || value === undefined) return 'n/a'
  return Number(value).toFixed(4)
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function challengeDiagnosticRows(baselineAnalysis) {
  return baselineAnalysis.systems.flatMap((system) =>
    Object.entries(system.by_challenge_type || {}).map(([challengeType, summary]) => [
      system.system_id,
      challengeType,
      String(summary.task_count),
      metric(summary.macro.answer_correct),
      metric(summary.macro.evidence_recall),
      metric(summary.macro.citation_faithfulness),
      metric(summary.macro.conclusion_support),
    ]),
  )
}

function datasetRows(spec) {
  return spec.datasets.map((dataset) => [dataset.id, dataset.license || 'unknown', dataset.covers.join('<br>')])
}

function coverageRows(coverageMatrix) {
  return coverageMatrix.map((row) => [
    row.category,
    row.datasets.join('<br>'),
    (row.seed_tasks || row.tasks || []).join('<br>'),
  ])
}

function systemRows(baselineAnalysis) {
  return baselineAnalysis.systems.map((system) => [
    system.system_id,
    String(system.task_count),
    metric(system.macro.answer_correct),
    metric(system.macro.evidence_recall),
    metric(system.macro.citation_faithfulness),
    metric(system.macro.conclusion_support),
    metric(system.macro.abstention_quality),
  ])
}

function topApproachRows(approachScores) {
  return approachScores.map((approach) => [
    approach.name,
    `${approach.coverage_count}/10`,
    approach.covered_categories.join('<br>'),
  ])
}

function renderDraft({ spec, pilotSuite, coverageMatrix, approachScores, baselineAnalysis, goldSummary, reviewMergeReport, itemQualityAudit, releaseGate }) {
  const categoryCount = spec.categories.length
  const datasetCount = spec.datasets.length
  const pilotItemCount = pilotSuite.items.length
  const reviewedItems = goldSummary.valid_reviewed_items
  const reviewTotal = goldSummary.total_items
  const repairBeforeGold = itemQualityAudit.repair_before_gold
  const challengeTypeCount = new Set(pilotSuite.items.map((item) => item.challenge?.type || 'native_row')).size

  return `# Benchmarks for Hard Grounded Research: Paper Draft

Status: working paper scaffold generated from repository artifacts, not a submission-ready manuscript.

## Abstract Draft

Grounded research QA is often evaluated as retrieval plus answer correctness, but research failures frequently arise after the relevant text has already been retrieved. We introduce a benchmark scaffold for hard grounded research that tests ${categoryCount} failure categories across ${datasetCount} Hugging Face datasets and ${pilotItemCount} pilot items. The benchmark targets multi-hop synthesis, stale-vs-current document conflicts, appended document lifecycle changes, table-plus-text reasoning, source authority conflicts, evidence insufficiency, citation overreach, entity disambiguation, as-of-date questions, and cross-document contradiction. Early non-oracle baselines show that lexical evidence selection is insufficient: failures cluster by challenge type and include missing evidence, unsupported conclusions, abstention errors, and citation faithfulness gaps. Gold release is intentionally gated on double review, disagreement resolution, and item-quality checks.

## Central Claim

The benchmark should not be framed as another RAG or long-context leaderboard. The paper claim is narrower: grounded research is hard because systems must reason about document state, source authority, temporal validity, evidence sufficiency, and whether citations support conclusions rather than merely nearby facts.

## Contributions

1. A taxonomy of ${categoryCount} hard grounded research failure modes beyond simple lookup.
2. A Hugging Face-grounded pilot suite spanning ${datasetCount} public datasets and ${challengeTypeCount} challenge types.
3. A scoring contract with answer correctness, evidence recall, citation precision, citation faithfulness, conclusion support, and abstention quality.
4. A review workflow with double review, disagreement queues, reviewer agreement metrics, quality hints, and strict gold promotion gates.
5. A baseline analysis that reports macro, category, and challenge-type failures for oracle sanity, lexical, and citation-aware verifier systems.

## Dataset Grounding

${markdownTable(['Dataset', 'License', 'Benchmark roles'], datasetRows(spec))}

## Task Taxonomy

${markdownTable(['Category', 'HF datasets', 'Seed tasks'], coverageRows(coverageMatrix))}

## Construction Approaches

${markdownTable(['Approach', 'Coverage', 'Covered categories'], topApproachRows(approachScores))}

## Evaluation Contract

Systems submit one answer per task with citation ids and abstention state. The scorer reports:

- \`answer_correct\`: whether the answer matches the expected label or gold final answer.
- \`evidence_recall\`: required citation coverage.
- \`citation_precision\`: fraction of submitted citations that are required.
- \`citation_faithfulness\`: citation precision clipped when the answer is wrong.
- \`conclusion_support\`: explicit penalty for citation-overreach probes where evidence supports a fact but not the conclusion.
- \`abstention_quality\`: correct abstention on insufficient or conflicting evidence and non-abstention when an answer is warranted.

## Pilot Baselines

${markdownTable(
  ['System', 'Tasks', 'Answer', 'Evidence Recall', 'Citation Faithfulness', 'Conclusion Support', 'Abstention'],
  systemRows(baselineAnalysis),
)}

## Challenge-Type Results

${markdownTable(
  ['System', 'Challenge', 'Tasks', 'Answer', 'Evidence Recall', 'Citation Faithfulness', 'Conclusion Support'],
  challengeDiagnosticRows(baselineAnalysis),
)}

## Gold Data Gate

- Gold ready: ${goldSummary.gold_ready}
- Valid reviewed items: ${reviewedItems}/${reviewTotal}
- Missing-review items: ${reviewMergeReport.missing_review_items}
- Disagreement items: ${reviewMergeReport.disagreement_items}
- Exact agreement rate: ${metric(reviewMergeReport.agreement?.exact_agreement_rate)}
- Label agreement rate: ${metric(reviewMergeReport.agreement?.label_agreement_rate)}
- Repair-before-gold items: ${repairBeforeGold}
- Release gate status: ${releaseGate.status}
- Release blockers: ${releaseGate.blockers.length}

## Novelty Position

The novelty audit currently rejects broad claims such as "a RAG benchmark with citations" or "a contradiction benchmark." The defensible novelty position is the combined failure-mode bundle: document lifecycle, source authority, temporal validity, table/text interpretation, citation-overreach, insufficiency, disambiguation, and contradiction inside one executable grounded research QA harness.

## Required Before Submission

1. Scale from ${pilotItemCount} pilot items to at least 30-50 double-reviewed items per category.
2. Complete independent double review and adjudicate disagreements until gold promotion succeeds.
3. Run at least two frontier or open model baselines over the same scoring source.
4. Refresh the June 2026 novelty audit with paper citations immediately before any completion claim.
5. Convert this scaffold into a full manuscript with related work, annotation protocol, limitations, and statistical uncertainty.
`
}

for (const [name, path] of Object.entries(requiredInputs)) {
  assert(existsSync(path), `Missing paper draft input ${name}: ${path}`)
}

const draft = renderDraft({
  spec: readJson(requiredInputs.spec),
  pilotSuite: readJson(requiredInputs.pilotSuite),
  coverageMatrix: readJson(requiredInputs.coverageMatrix),
  approachScores: readJson(requiredInputs.approachScores),
  baselineAnalysis: readJson(requiredInputs.baselineAnalysis),
  goldSummary: readJson(requiredInputs.goldSummary),
  reviewMergeReport: readJson(requiredInputs.reviewMergeReport),
  itemQualityAudit: readJson(requiredInputs.itemQualityAudit),
  releaseGate: readJson(requiredInputs.releaseGate),
})

writeText(draftPath, draft)
console.log(`Wrote hard grounded research paper draft to ${draftPath}`)
