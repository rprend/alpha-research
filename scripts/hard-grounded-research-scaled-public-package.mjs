import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const publicPackageDir = join(generatedDir, 'public-package')
const expansionCandidatesPath = join(generatedDir, 'expansion-candidates.json')
const remediatedCandidatesPath = join(generatedDir, 'license-remediated-expansion-candidates.json')
const remediationPlanPath = join(generatedDir, 'license-remediation-plan.json')
const licenseReviewPath = join(generatedDir, 'license-review.json')
const scaledPublicSuitePath = join(publicPackageDir, 'hard-grounded-research-scaled-public-suite.json')
const scaledPublicJsonlPath = join(publicPackageDir, 'hard-grounded-research-scaled-public-suite.jsonl')
const scaledSummaryPath = join(publicPackageDir, 'scaled-summary.json')
const scaledMarkdownPath = join(experimentDir, 'SCALED_PUBLIC_PACKAGE.md')

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

function sha256(value) {
  return createHash('sha256').update(String(value || '')).digest('hex')
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function licenseMap(licenseReview) {
  return new Map(licenseReview.datasets.map((dataset) => [dataset.dataset_id, dataset]))
}

function pointerOnlyCategories(remediationPlan) {
  return new Set(
    remediationPlan.category_plans
      .filter((plan) => plan.recommended_policy === 'pointer_only_public_package_until_source_replacement')
      .map((plan) => plan.category),
  )
}

function replacementCategories(remediationPlan) {
  return new Set(
    remediationPlan.category_plans
      .filter((plan) => plan.recommended_policy === 'replace_blocked_sources_with_known_license_sources')
      .map((plan) => plan.category),
  )
}

function sourceDatasets(candidate) {
  return [...new Set(candidate.source_examples.map((source) => source.source_dataset))]
}

function itemPackageMode(candidate, blockerIds, pointerOnlyCategorySet) {
  const blockedDatasets = sourceDatasets(candidate).filter((datasetId) => blockerIds.has(datasetId))
  if (candidate.construction === 'license_remediated_expansion_candidate') return 'license_remediated_replacement'
  if (blockedDatasets.length > 0 || pointerOnlyCategorySet.has(candidate.category)) return 'pointer_only_unknown_license_evidence'
  return 'redistributable_known_license_evidence'
}

function publicEvidenceUnit(sourceDataset, unit, licenseByDataset) {
  const license = licenseByDataset.get(sourceDataset)
  const pointerOnly = Boolean(license?.blocks_public_release)
  const base = {
    id: unit.id,
    title: unit.title,
    locator: unit.locator,
    package_policy: pointerOnly ? 'pointer_only_no_text' : 'redistribute_text_with_attribution',
    text_included_in_public_package: !pointerOnly,
    text_sha256: sha256(unit.text),
    text_length: String(unit.text || '').length,
    license_status: license?.observed_license || 'unknown',
  }

  if (base.text_included_in_public_package) return { ...base, text: unit.text }
  return base
}

function publicSourceExample(source, licenseByDataset) {
  return {
    source_dataset: source.source_dataset,
    source_row_id: source.source_row_id,
    row_offset: source.row_offset,
    native_question: source.native_question,
    native_answer: source.native_answer,
    hard_grounding_signals: source.hard_grounding_signals,
    evidence_units: (source.evidence_units || []).map((unit) => publicEvidenceUnit(source.source_dataset, unit, licenseByDataset)),
  }
}

function publicCandidate(candidate, licenseByDataset, blockerIds, pointerOnlyCategorySet) {
  const sourceExamples = candidate.source_examples.map((source) => publicSourceExample(source, licenseByDataset))
  const pointerOnlyEvidenceUnits = sourceExamples.reduce(
    (sum, source) => sum + source.evidence_units.filter((unit) => !unit.text_included_in_public_package).length,
    0,
  )
  return {
    id: candidate.id,
    source_expansion_candidate_id: candidate.provenance?.source_expansion_candidate_id || candidate.id,
    seed_task_id: candidate.seed_task_id,
    category: candidate.category,
    construction: candidate.construction,
    transform: candidate.transform,
    question: candidate.question,
    source_examples: sourceExamples,
    expected_answer: candidate.expected_answer,
    expected_failure: candidate.expected_failure,
    scoring_focus: candidate.scoring_focus,
    review_status: candidate.review_status,
    acceptance_status: candidate.acceptance_status,
    public_package: {
      package_mode: itemPackageMode(candidate, blockerIds, pointerOnlyCategorySet),
      pointer_only_evidence_units: pointerOnlyEvidenceUnits,
      package_ready: pointerOnlyEvidenceUnits === 0,
    },
  }
}

function selectScaledCandidates(expansionCandidates, remediatedCandidates, remediationPlan, licenseReview) {
  const blockerIds = new Set((licenseReview.blockers || []).map((blocker) => blocker.dataset_id))
  const pointerOnlyCategorySet = pointerOnlyCategories(remediationPlan)
  const replacementCategorySet = replacementCategories(remediationPlan)
  const remediatedBySourceCandidateId = new Map(
    remediatedCandidates.remediated_candidates.map((candidate) => [candidate.provenance.source_expansion_candidate_id, candidate]),
  )

  const selected = []
  const replacementOriginalsSkipped = []
  for (const candidate of expansionCandidates.candidates) {
    const blockedDatasets = sourceDatasets(candidate).filter((datasetId) => blockerIds.has(datasetId))
    const replacementCandidate = remediatedBySourceCandidateId.get(candidate.id)
    if (replacementCandidate) {
      selected.push(replacementCandidate)
      replacementOriginalsSkipped.push(candidate.id)
      continue
    }

    if (blockedDatasets.length > 0 && replacementCategorySet.has(candidate.category)) {
      throw new Error(`Missing remediated replacement for ${candidate.id}`)
    }

    selected.push(candidate)
  }

  return {
    selected,
    replacementOriginalsSkipped,
    pointerOnlyCategorySet,
    blockerIds,
  }
}

function buildScaledPublicSuite(expansionCandidates, remediatedCandidates, remediationPlan, licenseReview) {
  const licenseByDataset = licenseMap(licenseReview)
  const { selected, replacementOriginalsSkipped, pointerOnlyCategorySet, blockerIds } = selectScaledCandidates(
    expansionCandidates,
    remediatedCandidates,
    remediationPlan,
    licenseReview,
  )
  const items = selected.map((candidate) => publicCandidate(candidate, licenseByDataset, blockerIds, pointerOnlyCategorySet))
  const packageModeCounts = Object.fromEntries(
    [...new Set(items.map((item) => item.public_package.package_mode))].sort().map((mode) => [
      mode,
      items.filter((item) => item.public_package.package_mode === mode).length,
    ]),
  )

  return {
    benchmark_id: expansionCandidates.benchmark_id,
    source_expansion_candidates: 'generated/expansion-candidates.json',
    source_license_remediated_expansion_candidates: 'generated/license-remediated-expansion-candidates.json',
    source_license_remediation_plan: 'generated/license-remediation-plan.json',
    source_license_review: 'generated/license-review.json',
    item_count: items.length,
    replacement_originals_skipped: replacementOriginalsSkipped.length,
    package_ready_items: items.filter((item) => item.public_package.package_ready).length,
    pointer_only_items: items.filter((item) => !item.public_package.package_ready).length,
    pointer_only_evidence_units: items.reduce((sum, item) => sum + item.public_package.pointer_only_evidence_units, 0),
    package_mode_counts: packageModeCounts,
    public_package_policy:
      'Scaled public package includes unaffected known-license candidates, known-license replacement candidates, and pointer-only metadata plus hashes for categories without replacement sources.',
    items,
  }
}

function assertPointerOnlyTextStripped(publicSuite) {
  for (const item of publicSuite.items) {
    for (const source of item.source_examples) {
      for (const unit of source.evidence_units) {
        if (!unit.text_included_in_public_package && Object.hasOwn(unit, 'text')) {
          throw new Error(`Pointer-only evidence leaked text: ${item.id} / ${unit.id}`)
        }
      }
    }
  }
}

function renderMarkdown(publicSuite) {
  const rows = Object.entries(publicSuite.package_mode_counts).map(([mode, count]) => [mode, String(count)])

  return `# Hard Grounded Research Scaled Public Package

This generated package is the public-release view of scaled expansion candidates. It keeps the original raw expansion suite intact, swaps in known-license remediated replacements where available, and strips text from unknown-license evidence that must remain pointer-only.

## Summary

- Source expansion candidates: ${publicSuite.source_expansion_candidates}
- Source remediated candidates: ${publicSuite.source_license_remediated_expansion_candidates}
- Items: ${publicSuite.item_count}
- Package-ready items without pointer-only evidence: ${publicSuite.package_ready_items}
- Items requiring pointer-only evidence packaging: ${publicSuite.pointer_only_items}
- Pointer-only evidence units: ${publicSuite.pointer_only_evidence_units}
- Replacement originals skipped in favor of remediated candidates: ${publicSuite.replacement_originals_skipped}
- Policy: ${publicSuite.public_package_policy}

## Package Modes

${markdownTable(['Mode', 'Items'], rows)}
`
}

for (const path of [expansionCandidatesPath, remediatedCandidatesPath, remediationPlanPath, licenseReviewPath]) {
  if (!existsSync(path)) throw new Error(`Missing scaled public package input: ${path}`)
}

const publicSuite = buildScaledPublicSuite(
  readJson(expansionCandidatesPath),
  readJson(remediatedCandidatesPath),
  readJson(remediationPlanPath),
  readJson(licenseReviewPath),
)
assertPointerOnlyTextStripped(publicSuite)

writeJson(scaledPublicSuitePath, publicSuite)
writeText(scaledPublicJsonlPath, `${publicSuite.items.map((item) => JSON.stringify(item)).join('\n')}\n`)
writeJson(scaledSummaryPath, {
  benchmark_id: publicSuite.benchmark_id,
  item_count: publicSuite.item_count,
  package_ready_items: publicSuite.package_ready_items,
  pointer_only_items: publicSuite.pointer_only_items,
  pointer_only_evidence_units: publicSuite.pointer_only_evidence_units,
  replacement_originals_skipped: publicSuite.replacement_originals_skipped,
  package_mode_counts: publicSuite.package_mode_counts,
  public_suite: 'generated/public-package/hard-grounded-research-scaled-public-suite.json',
  public_jsonl: 'generated/public-package/hard-grounded-research-scaled-public-suite.jsonl',
})
writeText(scaledMarkdownPath, renderMarkdown(publicSuite))

console.log(`Wrote hard grounded scaled public suite to ${scaledPublicSuitePath}`)
console.log(`Wrote hard grounded scaled public JSONL to ${scaledPublicJsonlPath}`)
console.log(`Wrote hard grounded scaled public package summary to ${scaledSummaryPath}`)
console.log(`Wrote hard grounded scaled public package report to ${scaledMarkdownPath}`)
