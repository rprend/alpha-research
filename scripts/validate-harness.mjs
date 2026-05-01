import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const requiredDocs = [
  'AGENTS.md',
  'ARCHITECTURE.md',
  'docs/product/dashboard.md',
  'docs/control-plane.md',
  'docs/remote-agent-runner.md',
  'docs/observability.md',
  'docs/run-lifecycle.md',
  'docs/quality.md',
  'docs/dashboard-journey-eval.md',
  'docs/exec-plans/active/harness-engineering-foundation.md',
]

const requiredPackageScripts = [
  'build',
  'test',
  'test:harness',
  'qa:dashboard',
  'journey:dashboard:capture',
  'journey:dashboard:judge',
  'journey:dashboard:remediate',
  'cf:deploy:preview',
]

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

for (const doc of requiredDocs) {
  assert(existsSync(join(root, doc)), `Missing harness document: ${doc}`)
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
for (const script of requiredPackageScripts) {
  assert(packageJson.scripts?.[script], `Missing package script: ${script}`)
}

const appSource = readFileSync(join(root, 'src/App.tsx'), 'utf8')
assert(appSource.includes('isHarnessMode'), 'Dashboard is not wired to harness mode.')
assert(appSource.includes('harnessDatasets'), 'Dashboard does not expose harness datasets.')

const harnessSource = readFileSync(join(root, 'src/harness-data.ts'), 'utf8')
for (const token of [
  'harnessDatasets',
  'harnessRuns',
  'harnessSessions',
  'getHarnessRunResults',
  'getHarnessDebugView',
]) {
  assert(harnessSource.includes(token), `Missing harness export: ${token}`)
}

const controlPlaneSource = readFileSync(join(root, 'src/control-plane.ts'), 'utf8')
assert(controlPlaneSource.includes('/debug-view'), 'Run debug endpoint is missing.')

const dashboardJourneySource = readFileSync(join(root, 'scripts/dashboard-journeys.mjs'), 'utf8')
for (const token of [
  'DASHBOARD_JOURNEYS',
  'Dashboard Orientation',
  'Dataset Inventory',
  'Completed Run Transcript And Artifacts',
  'User Mind',
  'Choose The Right Dataset',
  'Mobile Run Check-In',
  'Public Homepage Product Understanding',
  'Privacy And Trust Before Data Use',
]) {
  assert(dashboardJourneySource.includes(token), `Missing dashboard journey coverage: ${token}`)
}

for (const script of [
  'scripts/dashboard-journey-capture.mjs',
  'scripts/dashboard-journey-judge.mjs',
  'scripts/dashboard-journey-report.mjs',
  'scripts/dashboard-journey-remediate.mjs',
]) {
  assert(existsSync(join(root, script)), `Missing dashboard journey script: ${script}`)
}

const launchPostSource = readFileSync(join(root, 'public/blog/launching-alpha-research/index.html'), 'utf8')
for (const token of [
  'Try Alpha Book',
  'Open Dashboard',
  'What to do next',
  'CLI (RResearch)',
  'How the product surfaces fit together',
  'Typical path:',
]) {
  assert(launchPostSource.includes(token), `Launch post is missing required journey steering copy: ${token}`)
}

console.log('Harness contract validation passed.')
