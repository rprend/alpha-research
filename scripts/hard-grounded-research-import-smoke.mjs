import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const fixtureDir = join(generatedDir, 'fixtures')
const fixturePath = join(fixtureDir, 'model-import-smoke.jsonl')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const runDir = join(experimentDir, 'runs', 'fixture-model-import-smoke')
const manifestPath = join(runDir, 'import-manifest.json')
const reportPath = join(runDir, 'report.json')
const modelRunIndexPath = join(generatedDir, 'model-run-index.json')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonl(path, rows) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`)
}

function evidenceUnits(item) {
  return (item.source_examples || []).flatMap((source) => source.evidence_units || [])
}

function fixtureRows(pilotSuite) {
  return pilotSuite.items.map((item) => ({
    custom_id: item.id,
    output_text: JSON.stringify({
      answer: item.expected_answer,
      citations: evidenceUnits(item).map((unit) => unit.id),
      abstained: String(item.expected_answer).toUpperCase() === 'ABSTAIN',
      confidence: 0.91,
      evidence_assessment: 'Fixture answer generated from checked-in pilot expected answer and all evidence ids.',
    }),
  }))
}

rmSync(runDir, { recursive: true, force: true })
writeJsonl(fixturePath, fixtureRows(readJson(pilotSuitePath)))

const importer = spawnSync(
  process.execPath,
  [
    'scripts/hard-grounded-research-import-model-results.mjs',
    '--system-id=fixture-model-import-smoke',
    `--input=${relative(root, fixturePath)}`,
    '--suite=pilot',
    '--description=Fixture smoke test for imported model output parsing.',
  ],
  { cwd: root, encoding: 'utf8' },
)

if (importer.status !== 0) {
  process.stderr.write(importer.stdout)
  process.stderr.write(importer.stderr)
  process.exit(importer.status || 1)
}

const manifest = readJson(manifestPath)
writeJson(manifestPath, {
  ...manifest,
  fixture: true,
  fixture_purpose: 'non-release smoke test for imported model output parsing and scoring',
})

if (!readJson(reportPath).summary?.task_count) {
  throw new Error(`Import smoke did not produce a scored report: ${reportPath}`)
}

const indexer = spawnSync(process.execPath, ['scripts/hard-grounded-research-model-run-index.mjs'], {
  cwd: root,
  encoding: 'utf8',
})

if (indexer.status !== 0) {
  process.stderr.write(indexer.stdout)
  process.stderr.write(indexer.stderr)
  process.exit(indexer.status || 1)
}

const index = readJson(modelRunIndexPath)
const fixtureRun = index.runs.find((run) => run.run_id === 'fixture-model-import-smoke')
if (!fixtureRun) throw new Error('Model run index did not include fixture import smoke run.')
if (!fixtureRun.fixture) throw new Error('Fixture import smoke run was not marked as a fixture.')
if (fixtureRun.eligible_model_baseline) throw new Error('Fixture import smoke run must not count as an eligible model baseline.')

console.log(`Hard grounded model import smoke passed with ${fixtureRun.task_count} scored fixture tasks.`)
