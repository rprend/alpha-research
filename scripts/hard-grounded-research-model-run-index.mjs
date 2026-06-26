import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const runsDir = join(experimentDir, 'runs')
const indexJsonPath = join(generatedDir, 'model-run-index.json')
const indexMarkdownPath = join(experimentDir, 'MODEL_RUN_INDEX.md')

const heuristicSystems = new Set(['local-rule-agent-v1', 'lexical-evidence-baseline-v1', 'citation-aware-verifier-v1'])

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

function relativePath(path) {
  return path.replace(`${root}/`, '')
}

function manifestForRun(runDir) {
  const importManifestPath = join(runDir, 'import-manifest.json')
  const runManifestPath = join(runDir, 'run-manifest.json')
  if (existsSync(importManifestPath)) return { type: 'import_manifest', path: importManifestPath, manifest: readJson(importManifestPath) }
  if (existsSync(runManifestPath)) return { type: 'run_manifest', path: runManifestPath, manifest: readJson(runManifestPath) }
  return null
}

function discoverRuns() {
  if (!existsSync(runsDir)) return []
  return readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const runId = entry.name
      const runDir = join(runsDir, runId)
      const reportPath = join(runDir, 'report.json')
      const submissionPath = join(runDir, 'submission.json')
      const manifest = manifestForRun(runDir)
      const report = existsSync(reportPath) ? readJson(reportPath) : null
      const systemId = report?.system_id || manifest?.manifest?.system_id || runId
      const fixtureRun = Boolean(manifest?.manifest?.fixture)
      const eligibleModelBaseline =
        Boolean(report) &&
        Boolean(manifest) &&
        !fixtureRun &&
        !heuristicSystems.has(systemId) &&
        (manifest.type === 'import_manifest' || manifest.manifest?.run_requested === true)

      return {
        run_id: runId,
        system_id: systemId,
        report_present: Boolean(report),
        submission_present: existsSync(submissionPath),
        manifest_type: manifest?.type || 'none',
        manifest_path: manifest ? relativePath(manifest.path) : null,
        report_path: existsSync(reportPath) ? relativePath(reportPath) : null,
        evaluation_source: report?.evaluation_source || manifest?.manifest?.suite || manifest?.manifest?.evaluation_source || 'unknown',
        fixture: fixtureRun,
        task_count: report?.summary?.task_count || 0,
        macro_answer_correct: report?.summary?.macro?.answer_correct ?? null,
        eligible_model_baseline: eligibleModelBaseline,
      }
    })
    .sort((left, right) => left.run_id.localeCompare(right.run_id))
}

function buildIndex() {
  const runs = discoverRuns()
  const eligibleRuns = runs.filter((run) => run.eligible_model_baseline)
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    generated_from: 'docs/experiments/hard-grounded-research-benchmark/runs',
    heuristic_systems: [...heuristicSystems],
    run_count: runs.length,
    eligible_model_baseline_count: eligibleRuns.length,
    eligible_model_baselines: eligibleRuns.map((run) => run.run_id),
    readiness: {
      required_model_baselines: 2,
      ready: eligibleRuns.length >= 2,
    },
    runs,
  }
}

function renderMarkdown(index) {
  const rows = index.runs.map((run) => [
    run.run_id,
    run.system_id,
    run.report_present ? 'yes' : 'no',
    run.manifest_type,
    run.evaluation_source,
    run.fixture ? 'yes' : 'no',
    run.eligible_model_baseline ? 'yes' : 'no',
  ])

  return `# Hard Grounded Research Model Run Index

This generated index separates heuristic diagnostic systems from externally imported or directly executed model baselines. Release readiness requires at least ${index.readiness.required_model_baselines} eligible model baselines with scored reports and provenance manifests.

## Summary

- Runs: ${index.run_count}
- Eligible model baselines: ${index.eligible_model_baseline_count}
- Ready: ${index.readiness.ready}

## Runs

${markdownTable(['Run', 'System', 'Report', 'Manifest', 'Evaluation source', 'Fixture', 'Eligible model baseline'], rows)}
`
}

const index = buildIndex()
writeJson(indexJsonPath, index)
writeText(indexMarkdownPath, renderMarkdown(index))

console.log(`Wrote hard grounded model run index to ${indexJsonPath}`)
console.log(`Wrote hard grounded model run index report to ${indexMarkdownPath}`)
