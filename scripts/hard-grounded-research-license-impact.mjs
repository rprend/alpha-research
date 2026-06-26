import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const licenseReviewPath = join(generatedDir, 'license-review.json')
const expansionCandidatesPath = join(generatedDir, 'expansion-candidates.json')
const impactJsonPath = join(generatedDir, 'license-impact.json')
const impactMarkdownPath = join(experimentDir, 'LICENSE_IMPACT.md')

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

function sourceDatasets(candidate) {
  return [...new Set(candidate.source_examples.map((source) => source.source_dataset))]
}

function buildImpact(licenseReview, expansionCandidates) {
  const blockerIds = new Set((licenseReview.blockers || []).map((blocker) => blocker.dataset_id))
  const impactedCandidates = expansionCandidates.candidates
    .map((candidate) => {
      const blockedDatasets = sourceDatasets(candidate).filter((datasetId) => blockerIds.has(datasetId))
      return {
        candidate_id: candidate.id,
        batch_id: candidate.batch_id,
        category: candidate.category,
        blocked_datasets: blockedDatasets,
        source_row_ids: candidate.provenance.source_row_ids.filter((row) => blockerIds.has(row.dataset_id)),
        recommended_action: blockedDatasets.length
          ? 'replace_source_or_pointer_only_before_public_release'
          : 'redistributable_under_current_metadata',
      }
    })
    .filter((candidate) => candidate.blocked_datasets.length > 0)

  const byDataset = Object.fromEntries(
    [...blockerIds].map((datasetId) => {
      const rows = impactedCandidates.filter((candidate) => candidate.blocked_datasets.includes(datasetId))
      return [
        datasetId,
        {
          candidate_count: rows.length,
          categories: [...new Set(rows.map((candidate) => candidate.category))],
          batches: [...new Set(rows.map((candidate) => candidate.batch_id))],
        },
      ]
    }),
  )

  const byCategory = Object.fromEntries(
    [...new Set(impactedCandidates.map((candidate) => candidate.category))].map((category) => {
      const rows = impactedCandidates.filter((candidate) => candidate.category === category)
      return [
        category,
        {
          candidate_count: rows.length,
          blocked_datasets: [...new Set(rows.flatMap((candidate) => candidate.blocked_datasets))],
        },
      ]
    }),
  )

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    source_license_review: 'generated/license-review.json',
    source_expansion_candidates: 'generated/expansion-candidates.json',
    blocker_dataset_count: blockerIds.size,
    expansion_candidate_count: expansionCandidates.candidate_count,
    impacted_candidate_count: impactedCandidates.length,
    unaffected_candidate_count: expansionCandidates.candidate_count - impactedCandidates.length,
    public_release_ready: impactedCandidates.length === 0,
    replacement_or_pointer_only_required: impactedCandidates.length > 0,
    by_dataset: byDataset,
    by_category: byCategory,
    impacted_candidates: impactedCandidates,
  }
}

function renderMarkdown(impact) {
  const datasetRows = Object.entries(impact.by_dataset).map(([datasetId, summary]) => [
    datasetId,
    String(summary.candidate_count),
    summary.categories.join('<br>') || 'none',
    summary.batches.join('<br>') || 'none',
  ])
  const categoryRows = Object.entries(impact.by_category).map(([category, summary]) => [
    category,
    String(summary.candidate_count),
    summary.blocked_datasets.join('<br>'),
  ])
  const sampleRows = impact.impacted_candidates.slice(0, 40).map((candidate) => [
    candidate.candidate_id,
    candidate.category,
    candidate.batch_id,
    candidate.blocked_datasets.join('<br>'),
    candidate.recommended_action,
  ])

  return `# Hard Grounded Research License Impact

This generated report maps unknown-license upstream sources to scaled expansion candidates. It turns the license blocker into an actionable replacement or pointer-only work queue.

## Summary

- Source license review: ${impact.source_license_review}
- Source expansion candidates: ${impact.source_expansion_candidates}
- Blocker datasets: ${impact.blocker_dataset_count}
- Expansion candidates: ${impact.expansion_candidate_count}
- Impacted candidates: ${impact.impacted_candidate_count}
- Unaffected candidates: ${impact.unaffected_candidate_count}
- Public release ready: ${impact.public_release_ready}
- Replacement or pointer-only required: ${impact.replacement_or_pointer_only_required}

## Impact By Dataset

${markdownTable(['Dataset', 'Candidates', 'Categories', 'Batches'], datasetRows)}

## Impact By Category

${categoryRows.length ? markdownTable(['Category', 'Candidates', 'Blocked datasets'], categoryRows) : 'No categories are impacted by unknown-license sources.'}

## Sample Impact Queue

${sampleRows.length ? markdownTable(['Candidate', 'Category', 'Batch', 'Blocked datasets', 'Recommended action'], sampleRows) : 'No expansion candidates require license remediation.'}
`
}

const impact = buildImpact(readJson(licenseReviewPath), readJson(expansionCandidatesPath))
writeJson(impactJsonPath, impact)
writeText(impactMarkdownPath, renderMarkdown(impact))

console.log(`Wrote hard grounded license impact to ${impactJsonPath}`)
console.log(`Wrote hard grounded license impact report to ${impactMarkdownPath}`)
