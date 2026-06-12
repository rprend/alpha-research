import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const reportsDir = join(experimentDir, 'reports')

const args = new Set(process.argv.slice(2))
const skipAcquisitionImport = args.has('--skip-acquisition-import')
const skipReview = args.has('--skip-review')

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function runStep(id, command, args = []) {
  const startedAt = new Date().toISOString()
  const commandText = [command, ...args].join(' ')
  try {
    const stdout = execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return {
      id,
      command: commandText,
      status: 'pass',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      output_tail: stdout.split('\n').filter(Boolean).slice(-20),
    }
  } catch (error) {
    return {
      id,
      command: commandText,
      status: 'fail',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      error: error.message,
      stdout_tail: String(error.stdout ?? '').split('\n').filter(Boolean).slice(-20),
      stderr_tail: String(error.stderr ?? '').split('\n').filter(Boolean).slice(-20),
    }
  }
}

function main() {
  ensureDir(reportsDir)

  const steps = []
  if (!skipAcquisitionImport) {
    const acquisitionDir = join(experimentDir, 'data/raw/acquisition-results')
    if (existsSync(acquisitionDir)) {
      steps.push(['preview_acquisition_import', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs', '--preview']])
      steps.push(['import_acquisition_results', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs']])
    }
  }

  steps.push(['run_pipeline', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/run-pipeline.mjs']])

  if (!skipReview) {
    const reviewDir = join(experimentDir, 'data/raw/review-decisions')
    if (existsSync(reviewDir)) {
      steps.push(['apply_review_decisions', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/apply-review-decisions.mjs']])
    }
  }

  steps.push(['analyze_source_yield', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/analyze-source-yield.mjs']])
  steps.push(['resolve_identities', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/resolve-identities.mjs']])
  steps.push(['build_category_coverage', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/build-category-coverage.mjs']])
  steps.push(['build_review_sample', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/build-review-sample.mjs']])
  steps.push(['build_review_packet', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/build-review-packet.mjs']])
  steps.push(['build_review_plan', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/build-review-plan.mjs']])
  steps.push(['build_acquisition_batches', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/build-acquisition-batches.mjs']])
  steps.push(['build_candidate_frontier', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/build-candidate-frontier.mjs']])
  steps.push(['build_release_package', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/build-release-package.mjs']])
  steps.push(['verify_release_package', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/verify-release-package.mjs']])
  steps.push(['build_scale_plan', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/build-scale-plan.mjs']])
  steps.push(['build_scale_waves', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/build-scale-waves.mjs']])
  steps.push(['build_wave_ledger', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/build-wave-ledger.mjs']])
  steps.push(['build_provider_preflight', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/build-provider-preflight.mjs']])
  steps.push(['build_live_run_manifest', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/build-live-run-manifest.mjs']])
  steps.push(['run_live_manifest_dry_run', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/run-live-manifest.mjs', '--max-waves=1', '--max-cost-usd=1', '--skip-import', '--skip-rebuild']])
  steps.push(['build_refresh_plan', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/build-refresh-plan.mjs']])
  steps.push(['build_publication_handoff', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/build-publication-handoff.mjs']])
  steps.push(['check_readiness', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/check-readiness.mjs']])

  const results = []
  for (const [id, command, stepArgs] of steps) {
    const result = runStep(id, command, stepArgs)
    results.push(result)
    if (result.status === 'fail') break
  }

  const summary = {
    generated_at: new Date().toISOString(),
    complete: results.every((result) => result.status === 'pass'),
    steps: results,
  }

  writeFileSync(join(reportsDir, 'full-workflow.json'), `${JSON.stringify(summary, null, 2)}\n`)
  writeFileSync(join(reportsDir, 'full-workflow.md'), `# Full Workflow

Generated: ${summary.generated_at}

Complete: ${summary.complete}

## Steps

${summary.steps.map((step) => `- ${step.id}: ${step.status} (\`${step.command}\`)`).join('\n')}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (!summary.complete) process.exit(1)
}

main()
