import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const expansionCandidatesPath = join(generatedDir, 'expansion-candidates.json')
const remediationPlanPath = join(generatedDir, 'license-remediation-plan.json')
const remediatedJsonPath = join(generatedDir, 'license-remediated-expansion-candidates.json')
const remediatedMarkdownPath = join(experimentDir, 'LICENSE_REMEDIATED_EXPANSION_CANDIDATES.md')

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

function buildRemediatedSuite(expansionCandidates, remediationPlan) {
  const planByCategory = new Map(remediationPlan.category_plans.map((plan) => [plan.category, plan]))
  const remediatedCandidates = []
  const skippedPointerOnlyCandidates = []
  const skippedNoBlockedSourceCandidates = []
  const categorySummaries = new Map()

  for (const candidate of expansionCandidates.candidates) {
    const plan = planByCategory.get(candidate.category)
    if (!plan) {
      skippedNoBlockedSourceCandidates.push(candidate.id)
      continue
    }

    if (plan.recommended_policy !== 'replace_blocked_sources_with_known_license_sources') {
      skippedPointerOnlyCandidates.push(candidate.id)
      continue
    }

    const blockedDatasets = new Set(plan.blocked_datasets)
    const replacementDatasetIds = new Set(plan.replacement_datasets.map((dataset) => dataset.dataset_id))
    const retainedSourceExamples = candidate.source_examples.filter((sourceExample) => !blockedDatasets.has(sourceExample.source_dataset))
    const replacementSourceExamples = retainedSourceExamples.filter((sourceExample) => replacementDatasetIds.has(sourceExample.source_dataset))

    if (replacementSourceExamples.length === 0) {
      skippedPointerOnlyCandidates.push(candidate.id)
      continue
    }

    const remediatedCandidate = {
      ...candidate,
      id: `${candidate.id}_license_remediated`,
      construction: 'license_remediated_expansion_candidate',
      source_examples: retainedSourceExamples,
      hard_grounding_signals: [
        ...candidate.hard_grounding_signals.filter((signal) => signal !== 'requires_human_review_before_gold'),
        'license_remediated_candidate',
        'known_license_sources_only',
        'requires_human_review_before_gold',
      ],
      provenance: {
        ...candidate.provenance,
        source_expansion_candidate_id: candidate.id,
        source_license_remediation_plan: 'generated/license-remediation-plan.json',
        removed_blocked_datasets: [...blockedDatasets],
        replacement_dataset_ids: [...replacementDatasetIds],
        transformation_note: 'Blocked-license source examples were removed under the category remediation plan; retained known-license evidence requires human review before gold promotion.',
      },
      review_status: 'machine_license_remediated_needs_human_review',
      acceptance_status: 'pending_two_reviews_or_adjudication',
    }

    remediatedCandidates.push(remediatedCandidate)
    const summary = categorySummaries.get(candidate.category) || {
      category: candidate.category,
      remediated_candidate_count: 0,
      removed_blocked_datasets: new Set(),
      replacement_datasets: new Set(),
    }
    summary.remediated_candidate_count += 1
    for (const datasetId of blockedDatasets) summary.removed_blocked_datasets.add(datasetId)
    for (const datasetId of replacementDatasetIds) summary.replacement_datasets.add(datasetId)
    categorySummaries.set(candidate.category, summary)
  }

  const categorySummaryRows = [...categorySummaries.values()].map((summary) => ({
    category: summary.category,
    remediated_candidate_count: summary.remediated_candidate_count,
    removed_blocked_datasets: [...summary.removed_blocked_datasets].sort(),
    replacement_datasets: [...summary.replacement_datasets].sort(),
  }))

  return {
    benchmark_id: expansionCandidates.benchmark_id,
    source_expansion_candidates: 'generated/expansion-candidates.json',
    source_license_remediation_plan: 'generated/license-remediation-plan.json',
    source_candidate_count: expansionCandidates.candidate_count,
    remediated_candidate_count: remediatedCandidates.length,
    pointer_only_candidate_count: skippedPointerOnlyCandidates.length,
    unaffected_candidate_count: skippedNoBlockedSourceCandidates.length,
    gold_promotion_allowed: false,
    review_status: 'machine_license_remediated_needs_human_review',
    category_summaries: categorySummaryRows,
    pointer_only_candidate_ids: skippedPointerOnlyCandidates,
    remediated_candidates: remediatedCandidates,
  }
}

function renderMarkdown(remediatedSuite) {
  const rows = remediatedSuite.category_summaries.map((summary) => [
    summary.category,
    String(summary.remediated_candidate_count),
    summary.removed_blocked_datasets.join('<br>'),
    summary.replacement_datasets.join('<br>'),
  ])

  return `# Hard Grounded Research License-Remediated Expansion Candidates

This generated artifact materializes the replacement-source part of the license remediation plan. It does not promote candidates to gold; every remediated candidate still requires the normal two-review or adjudication path.

## Summary

- Source expansion candidates: ${remediatedSuite.source_expansion_candidates}
- Source license remediation plan: ${remediatedSuite.source_license_remediation_plan}
- Source candidates: ${remediatedSuite.source_candidate_count}
- License-remediated candidates: ${remediatedSuite.remediated_candidate_count}
- Pointer-only candidates not rewritten: ${remediatedSuite.pointer_only_candidate_count}
- Unaffected candidates not copied into this replacement suite: ${remediatedSuite.unaffected_candidate_count}
- Review status: ${remediatedSuite.review_status}
- Gold promotion allowed: ${remediatedSuite.gold_promotion_allowed}

## Replacement Summary

${markdownTable(['Category', 'Remediated candidates', 'Removed blocked datasets', 'Replacement datasets'], rows)}
`
}

const remediatedSuite = buildRemediatedSuite(readJson(expansionCandidatesPath), readJson(remediationPlanPath))
writeJson(remediatedJsonPath, remediatedSuite)
writeText(remediatedMarkdownPath, renderMarkdown(remediatedSuite))

console.log(`Wrote hard grounded license-remediated expansion candidates to ${remediatedJsonPath}`)
console.log(`Wrote hard grounded license-remediated expansion report to ${remediatedMarkdownPath}`)
