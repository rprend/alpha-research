import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const specPath = join(experimentDir, 'benchmark-spec.json')
const reviewJsonPath = join(generatedDir, 'license-review.json')
const reviewMarkdownPath = join(experimentDir, 'LICENSE_REVIEW.md')

const hubLicenseEvidence = {
  'tdiggelm/climate_fever': {
    checked_date: '2026-06-26',
    source: 'https://huggingface.co/datasets/tdiggelm/climate_fever',
    observed_license: 'unknown',
    evidence: 'Hugging Face dataset page and Hub API report license: unknown.',
  },
  'Pavithree/eli5': {
    checked_date: '2026-06-26',
    source: 'https://huggingface.co/datasets/Pavithree/eli5',
    observed_license: 'missing',
    evidence: 'Hugging Face Hub API returned no license tag or cardData license field.',
  },
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

function reviewDataset(dataset) {
  const evidence = hubLicenseEvidence[dataset.id]
  const observedLicense = evidence?.observed_license || dataset.license || 'unknown'
  const licenseKnown = dataset.license && dataset.license !== 'unknown' && observedLicense !== 'unknown' && observedLicense !== 'missing'
  return {
    dataset_id: dataset.id,
    hf_url: dataset.url,
    spec_license: dataset.license || 'unknown',
    observed_license: observedLicense,
    checked_date: evidence?.checked_date || '2026-06-26',
    evidence_source: evidence?.source || dataset.url,
    evidence_note: evidence?.evidence || 'License comes from local benchmark spec metadata.',
    package_policy: licenseKnown ? 'redistribute_with_attribution' : 'pointer_only_or_replace_before_public_release',
    blocks_public_release: !licenseKnown,
  }
}

function buildReview(spec) {
  const datasets = spec.datasets.map(reviewDataset)
  const blockers = datasets.filter((dataset) => dataset.blocks_public_release)
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    checked_date: '2026-06-26',
    status: blockers.length ? 'blocked' : 'clear',
    datasets,
    blockers: blockers.map((dataset) => ({
      dataset_id: dataset.dataset_id,
      observed_license: dataset.observed_license,
      required_action: 'Resolve upstream license, remove stored snippets, switch to pointer-only packaging, or replace this source before public redistribution.',
    })),
  }
}

function renderMarkdown(review) {
  const rows = review.datasets.map((dataset) => [
    dataset.dataset_id,
    dataset.spec_license,
    dataset.observed_license,
    dataset.package_policy,
    dataset.blocks_public_release ? 'yes' : 'no',
  ])

  return `# Hard Grounded Research License Review

This generated review records release-facing license status for upstream Hugging Face datasets. It is intentionally conservative: unknown or missing license metadata blocks public redistribution of stored evidence snippets.

## Summary

- Status: ${review.status}
- Checked date: ${review.checked_date}
- Datasets reviewed: ${review.datasets.length}
- Public-release blockers: ${review.blockers.length}

## Dataset Review

${markdownTable(['Dataset', 'Spec license', 'Observed license', 'Package policy', 'Blocks release'], rows)}

## Blockers

${review.blockers.length ? review.blockers.map((blocker) => `- ${blocker.dataset_id}: ${blocker.required_action} (observed license: ${blocker.observed_license})`).join('\n') : 'No license blockers are present.'}

## Evidence Notes

${review.datasets.map((dataset) => `- ${dataset.dataset_id}: ${dataset.evidence_note} Source: ${dataset.evidence_source}`).join('\n')}
`
}

if (!existsSync(specPath)) throw new Error(`Missing benchmark spec: ${specPath}`)
const review = buildReview(readJson(specPath))
writeJson(reviewJsonPath, review)
writeText(reviewMarkdownPath, renderMarkdown(review))
console.log(`Wrote hard grounded research license review to ${reviewJsonPath}`)
console.log(`Wrote hard grounded research license review report to ${reviewMarkdownPath}`)
