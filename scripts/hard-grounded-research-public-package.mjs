import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const publicPackageDir = join(generatedDir, 'public-package')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const manifestPath = join(generatedDir, 'public-package-manifest.json')
const publicSuitePath = join(publicPackageDir, 'hard-grounded-research-public-suite.json')
const publicJsonlPath = join(publicPackageDir, 'hard-grounded-research-public-suite.jsonl')
const summaryPath = join(publicPackageDir, 'summary.json')

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

function manifestIndex(manifest) {
  const index = new Map()
  for (const item of manifest.items) {
    for (const unit of item.evidence_units) {
      index.set(`${item.item_id}\u0000${unit.evidence_id}\u0000${unit.dataset_id}`, unit)
    }
  }
  return index
}

function publicEvidenceUnit(itemId, sourceDataset, unit, evidenceIndex) {
  const policy = evidenceIndex.get(`${itemId}\u0000${unit.id}\u0000${sourceDataset}`)
  if (!policy) {
    throw new Error(`Missing public package policy for ${itemId} / ${sourceDataset} / ${unit.id}`)
  }

  const base = {
    id: unit.id,
    title: unit.title,
    locator: unit.locator,
    package_policy: policy.package_policy,
    text_included_in_public_package: policy.text_included_in_public_package,
    text_sha256: policy.text_sha256,
    text_length: policy.text_length,
    license_status: policy.license_status,
  }

  if (policy.text_included_in_public_package) {
    return { ...base, text: unit.text }
  }

  return base
}

function publicSourceExample(itemId, source, evidenceIndex) {
  return {
    source_dataset: source.source_dataset,
    source_row_id: source.source_row_id,
    row_offset: source.row_offset,
    native_question: source.native_question,
    native_answer: source.native_answer,
    hard_grounding_signals: source.hard_grounding_signals,
    evidence_units: (source.evidence_units || []).map((unit) =>
      publicEvidenceUnit(itemId, source.source_dataset, unit, evidenceIndex),
    ),
  }
}

function publicItem(item, evidenceIndex) {
  const sourceExamples = item.source_examples.map((source) => publicSourceExample(item.id, source, evidenceIndex))
  const pointerOnlyEvidenceUnits = sourceExamples.reduce(
    (sum, source) => sum + source.evidence_units.filter((unit) => !unit.text_included_in_public_package).length,
    0,
  )
  return {
    id: item.id,
    seed_task_id: item.seed_task_id,
    category: item.category,
    construction: item.construction,
    transform: item.transform,
    challenge: item.challenge,
    question: item.question,
    source_examples: sourceExamples,
    expected_answer: item.expected_answer,
    expected_failure: item.expected_failure,
    review_status: item.review_status,
    scoring_focus: item.scoring_focus,
    public_package: {
      pointer_only_evidence_units: pointerOnlyEvidenceUnits,
      package_ready: pointerOnlyEvidenceUnits === 0,
    },
  }
}

function buildPublicSuite(pilotSuite, manifest) {
  const evidenceIndex = manifestIndex(manifest)
  const items = pilotSuite.items.map((item) => publicItem(item, evidenceIndex))
  return {
    benchmark_id: manifest.benchmark_id,
    source_suite: manifest.source_suite,
    public_package_manifest: 'generated/public-package-manifest.json',
    public_package_policy: manifest.public_package_policy,
    item_count: items.length,
    package_ready_items: items.filter((item) => item.public_package.package_ready).length,
    pointer_only_items: items.filter((item) => !item.public_package.package_ready).length,
    pointer_only_evidence_units: items.reduce((sum, item) => sum + item.public_package.pointer_only_evidence_units, 0),
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

if (!existsSync(pilotSuitePath)) throw new Error(`Missing pilot suite: ${pilotSuitePath}`)
if (!existsSync(manifestPath)) throw new Error(`Missing public package manifest: ${manifestPath}`)

const publicSuite = buildPublicSuite(readJson(pilotSuitePath), readJson(manifestPath))
assertPointerOnlyTextStripped(publicSuite)

writeJson(publicSuitePath, publicSuite)
writeText(publicJsonlPath, `${publicSuite.items.map((item) => JSON.stringify(item)).join('\n')}\n`)
writeJson(summaryPath, {
  benchmark_id: publicSuite.benchmark_id,
  item_count: publicSuite.item_count,
  package_ready_items: publicSuite.package_ready_items,
  pointer_only_items: publicSuite.pointer_only_items,
  pointer_only_evidence_units: publicSuite.pointer_only_evidence_units,
  public_suite: 'generated/public-package/hard-grounded-research-public-suite.json',
  public_jsonl: 'generated/public-package/hard-grounded-research-public-suite.jsonl',
})

console.log(`Wrote hard grounded public suite to ${publicSuitePath}`)
console.log(`Wrote hard grounded public JSONL to ${publicJsonlPath}`)
console.log(`Wrote hard grounded public package summary to ${summaryPath}`)
