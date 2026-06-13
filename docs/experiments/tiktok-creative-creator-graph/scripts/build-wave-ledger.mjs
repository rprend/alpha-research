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

function splitList(value) {
  return String(value ?? '').split('|').map((item) => item.trim()).filter(Boolean)
}

function indexImportWaves(importWaves) {
  const byScaleWave = new Map()
  const byExecution = new Map()
  const byBatch = new Map()
  for (const importWave of importWaves) {
    for (const scaleWaveId of splitList(importWave.scale_wave_ids)) {
      const rows = byScaleWave.get(scaleWaveId) ?? []
      rows.push(importWave)
      byScaleWave.set(scaleWaveId, rows)
    }
    for (const executionId of splitList(importWave.execution_ids)) {
      const rows = byExecution.get(executionId) ?? []
      rows.push(importWave)
      byExecution.set(executionId, rows)
    }
    for (const batchId of splitList(importWave.batch_ids)) {
      const rows = byBatch.get(batchId) ?? []
      rows.push(importWave)
      byBatch.set(batchId, rows)
    }
  }
  return { byScaleWave, byExecution, byBatch }
}

function uniqueImportWaves(rows) {
  const seen = new Set()
  const unique = []
  for (const row of rows) {
    const key = row.wave_id || row.output_path
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(row)
  }
  return unique
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
  const importIndex = indexImportWaves(importWaves)
  const reviewSampleWaveIds = new Set(reviewSample.map((row) => row.import_wave_id).filter(Boolean))
  const liveHistory = acquisitionRunHistory.filter((row) => !row.dry_run)
  const zeroYieldRuns = liveHistory.filter((row) => Number(row.output_rows ?? 0) === 0 && Number(row.failed ?? 0) === 0)
  const latestRecordedRun = acquisitionRunHistory.at(-1)

  const ledger = waves.map((wave) => {
    const runs = runsByWave.get(wave.wave_id) ?? []
    const latestRun = runs.at(-1)
    const runRows = runs.reduce((sum, run) => sum + Number(run.output_rows ?? 0), 0)
    const runStatus = latestRun
      ? latestRun.failed > 0 ? 'failed' : latestRun.dry_run ? 'dry_run' : latestRun.succeeded > 0 ? 'succeeded' : 'attempted'
      : 'not_started'
    const importedViaWave = importIndex.byScaleWave.get(wave.wave_id) ?? []
    const importedViaExecutions = runs.flatMap((run) => importIndex.byExecution.get(run.execution_id) ?? [])
    const importedViaBatches = [wave.primary_task_id, wave.secondary_task_id].flatMap((batchId) => importIndex.byBatch.get(batchId) ?? [])
    const matchedImports = uniqueImportWaves([...importedViaWave, ...importedViaExecutions, ...importedViaBatches])
    const importedOutputAccounts = matchedImports.reduce((sum, row) => sum + Number(row.output_accounts ?? 0), 0)
    const importedInputRows = matchedImports.reduce((sum, row) => sum + Number(row.input_rows ?? 0), 0)
    const importedNormalizedRows = matchedImports.reduce((sum, row) => sum + Number(row.normalized_rows ?? 0), 0)
    const yieldRatio = Number(wave.target_candidate_accounts ?? 0) > 0
      ? importedOutputAccounts / Number(wave.target_candidate_accounts)
      : 0
    const imported = matchedImports.length > 0
    const needsReview = Number(wave.review_decision_target ?? 0) > 0 && !reviewSampleWaveIds.has(wave.wave_id)
    const liveRuns = runs.filter((run) => !run.dry_run)
    const dryRunOnly = runs.length > 0 && liveRuns.length === 0
    const latestLiveRun = liveRuns.at(-1)
    const liveRunStatus = latestLiveRun
      ? latestLiveRun.failed > 0 ? 'failed' : latestLiveRun.succeeded > 0 ? 'succeeded' : Number(latestLiveRun.zero_yield ?? 0) > 0 ? 'zero_yield' : 'attempted'
      : 'not_started'
    const status = imported
      ? importedOutputAccounts > 0 ? 'imported' : 'imported_empty'
      : latestLiveRun ? liveRunStatus : 'planned'
    return {
      wave_id: wave.wave_id,
      sequence: wave.sequence,
      status,
      run_status: runStatus,
      live_run_status: liveRunStatus,
      dry_run_only: dryRunOnly,
      run_attempts: runs.length,
      dry_run_attempts: runs.filter((run) => run.dry_run).length,
      live_run_attempts: liveRuns.length,
      imported,
      import_wave_ids: matchedImports.map((row) => row.wave_id).join('|'),
      import_output_paths: matchedImports.map((row) => row.output_path).filter(Boolean).join('|'),
      imported_input_rows: importedInputRows,
      imported_normalized_rows: importedNormalizedRows,
      imported_output_accounts: importedOutputAccounts,
      import_yield_ratio: Number(yieldRatio.toFixed(4)),
      import_yield_status: imported
        ? yieldRatio >= 0.8 ? 'strong'
          : yieldRatio >= 0.4 ? 'usable'
            : importedOutputAccounts > 0 ? 'under_yield'
              : 'empty'
        : '',
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
    dry_run_only: ledger.filter((row) => row.dry_run_only).length,
    succeeded: ledger.filter((row) => row.status === 'succeeded').length,
    imported: ledger.filter((row) => row.status === 'imported').length,
    imported_empty: ledger.filter((row) => row.status === 'imported_empty').length,
    failed: ledger.filter((row) => row.status === 'failed').length,
    imported_output_accounts: ledger.reduce((sum, row) => sum + Number(row.imported_output_accounts ?? 0), 0),
    under_yield_imports: ledger.filter((row) => row.import_yield_status === 'under_yield').length,
    empty_imports: ledger.filter((row) => row.import_yield_status === 'empty').length,
    run_attempts: ledger.reduce((sum, row) => sum + Number(row.run_attempts ?? 0), 0),
    dry_run_attempts: ledger.reduce((sum, row) => sum + Number(row.dry_run_attempts ?? 0), 0),
    live_run_attempts: ledger.reduce((sum, row) => sum + Number(row.live_run_attempts ?? 0), 0),
    zero_yield_live_runs: zeroYieldRuns.length,
    latest_recorded_provider: latestRecordedRun?.provider ?? '',
    latest_recorded_output_rows: latestRecordedRun?.output_rows ?? '',
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
- Dry-run only: ${summary.dry_run_only}
- Succeeded: ${summary.succeeded}
- Imported: ${summary.imported}
- Imported empty: ${summary.imported_empty}
- Failed: ${summary.failed}
- Imported output accounts: ${summary.imported_output_accounts}
- Under-yield imports: ${summary.under_yield_imports}
- Empty imports: ${summary.empty_imports}
- Run attempts: ${summary.run_attempts}
- Dry-run attempts: ${summary.dry_run_attempts}
- Live-run attempts: ${summary.live_run_attempts}
- Zero-yield live runs: ${summary.zero_yield_live_runs}
- Latest recorded provider: ${summary.latest_recorded_provider || 'none'}
- Latest recorded output rows: ${summary.latest_recorded_output_rows === '' ? 'n/a' : summary.latest_recorded_output_rows}
- Review needed: ${summary.review_needed}
- Latest run wave: ${summary.latest_run_wave || 'none'}
- Next ready wave: ${summary.next_ready_wave || 'none'}

Next command:

\`\`\`bash
${summary.next_ready_command || 'No planned waves remain.'}
\`\`\`

## First 20 Rows

| Seq | Wave | Status | Category | Surface | Query | Imported accounts | Yield | Review target |
| ---: | --- | --- | --- | --- | --- | ---: | --- | ---: |
${summary.first_rows.map((row) => `| ${row.sequence} | ${row.wave_id} | ${row.status} | ${row.primary_category} | ${row.primary_surface} | ${row.primary_query} | ${row.imported_output_accounts} | ${row.import_yield_status || 'n/a'} | ${row.review_decision_target} |`).join('\n')}

Full ledger: \`data/processed/wave_ledger.csv\`
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
