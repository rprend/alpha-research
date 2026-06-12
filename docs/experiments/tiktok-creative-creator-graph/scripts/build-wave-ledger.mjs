import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''))
}

function writeCsv(path, rows) {
  if (!rows.length) {
    writeFileSync(path, '')
    return
  }
  const headers = Object.keys(rows[0])
  const escape = (value) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  writeFileSync(path, `${headers.join(',')}\n${rows.map((row) => headers.map((header) => escape(row[header])).join(',')).join('\n')}\n`)
}

function main() {
  const waves = readJsonl(join(processedDir, 'scale_waves.jsonl'))
  const acquisitionRun = readJson(join(reportsDir, 'acquisition-run.json'), null)
  const acquisitionRunHistory = readJsonl(join(processedDir, 'acquisition_run_history.jsonl'))
  const importWaves = readJsonl(join(processedDir, 'acquisition_import_waves.jsonl'))
  const reviewSample = readJsonl(join(processedDir, 'review_sample.jsonl'))

  const latestRunWave = acquisitionRun?.wave_id || ''
  const runsByWave = new Map()
  for (const run of acquisitionRunHistory.filter((row) => row.wave_id)) {
    const rows = runsByWave.get(run.wave_id) ?? []
    rows.push(run)
    runsByWave.set(run.wave_id, rows)
  }
  const importedBatchIds = new Set(importWaves.flatMap((wave) => String(wave.source_files ?? '').split('|').filter(Boolean)))
  const reviewSampleWaveIds = new Set(reviewSample.map((row) => row.import_wave_id).filter(Boolean))

  const ledger = waves.map((wave) => {
    const runs = runsByWave.get(wave.wave_id) ?? []
    const latestRun = runs.at(-1)
    const runRows = runs.reduce((sum, run) => sum + Number(run.output_rows ?? 0), 0)
    const runStatus = latestRun
      ? latestRun.failed > 0 ? 'failed' : latestRun.dry_run ? 'dry_run' : latestRun.succeeded > 0 ? 'succeeded' : 'attempted'
      : 'not_started'
    const imported = importedBatchIds.has(`${wave.wave_id}.jsonl`) || importedBatchIds.has(wave.wave_id)
    const needsReview = Number(wave.review_decision_target ?? 0) > 0 && !reviewSampleWaveIds.has(wave.wave_id)
    const status = imported ? 'imported' : latestRun ? runStatus : 'planned'
    return {
      wave_id: wave.wave_id,
      sequence: wave.sequence,
      status,
      run_status: runStatus,
      run_attempts: runs.length,
      dry_run_attempts: runs.filter((run) => run.dry_run).length,
      live_run_attempts: runs.filter((run) => !run.dry_run).length,
      imported,
      needs_review_sample: needsReview,
      target_candidate_accounts: wave.target_candidate_accounts,
      expected_useful_creators: wave.expected_useful_creators,
      review_decision_target: wave.review_decision_target,
      primary_category: wave.primary_category,
      primary_task_id: wave.primary_task_id,
      primary_surface: wave.primary_surface,
      primary_query: wave.primary_query,
      secondary_task_id: wave.secondary_task_id,
      secondary_surface: wave.secondary_surface,
      secondary_query: wave.secondary_query,
      latest_execution_id: latestRun?.execution_id ?? '',
      latest_output_rows: runRows,
      run_command: wave.run_command,
      after_import_command: wave.after_import_command,
    }
  })

  const nextReady = ledger.find((row) => row.status === 'planned')
  const summary = {
    generated_at: new Date().toISOString(),
    waves: ledger.length,
    planned: ledger.filter((row) => row.status === 'planned').length,
    dry_run: ledger.filter((row) => row.status === 'dry_run').length,
    succeeded: ledger.filter((row) => row.status === 'succeeded').length,
    imported: ledger.filter((row) => row.status === 'imported').length,
    failed: ledger.filter((row) => row.status === 'failed').length,
    run_attempts: ledger.reduce((sum, row) => sum + Number(row.run_attempts ?? 0), 0),
    dry_run_attempts: ledger.reduce((sum, row) => sum + Number(row.dry_run_attempts ?? 0), 0),
    live_run_attempts: ledger.reduce((sum, row) => sum + Number(row.live_run_attempts ?? 0), 0),
    review_needed: ledger.filter((row) => row.needs_review_sample).length,
    latest_run_wave: latestRunWave,
    next_ready_wave: nextReady?.wave_id ?? '',
    next_ready_command: nextReady?.run_command ?? '',
    first_rows: ledger.slice(0, 20),
  }

  writeJson(join(reportsDir, 'wave-ledger.json'), summary)
  writeJsonl(join(processedDir, 'wave_ledger.jsonl'), ledger)
  writeCsv(join(processedDir, 'wave_ledger.csv'), ledger)
  writeFileSync(join(reportsDir, 'wave-ledger.md'), `# Wave Ledger

Generated: ${summary.generated_at}

- Waves: ${summary.waves}
- Planned: ${summary.planned}
- Dry-run: ${summary.dry_run}
- Succeeded: ${summary.succeeded}
- Imported: ${summary.imported}
- Failed: ${summary.failed}
- Run attempts: ${summary.run_attempts}
- Dry-run attempts: ${summary.dry_run_attempts}
- Live-run attempts: ${summary.live_run_attempts}
- Review needed: ${summary.review_needed}
- Latest run wave: ${summary.latest_run_wave || 'none'}
- Next ready wave: ${summary.next_ready_wave || 'none'}

Next command:

\`\`\`bash
${summary.next_ready_command || 'No planned waves remain.'}
\`\`\`

## First 20 Rows

| Seq | Wave | Status | Category | Surface | Query | Review target |
| ---: | --- | --- | --- | --- | --- | ---: |
${summary.first_rows.map((row) => `| ${row.sequence} | ${row.wave_id} | ${row.status} | ${row.primary_category} | ${row.primary_surface} | ${row.primary_query} | ${row.review_decision_target} |`).join('\n')}

Full ledger: \`data/processed/wave_ledger.csv\`
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
