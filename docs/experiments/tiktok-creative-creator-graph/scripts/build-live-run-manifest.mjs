import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line)
    } catch (error) {
      throw new Error(`Could not parse ${path}:${index + 1}: ${error.message}`)
    }
  })
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

function waveNumber(waveId) {
  return String(waveId ?? '').replace(/^scale_wave_/, '').replace(/^0+/, '') || ''
}

function groupByWave(rows) {
  const grouped = new Map()
  for (const row of rows) {
    const group = grouped.get(row.wave_id) ?? []
    group.push(row)
    grouped.set(row.wave_id, group)
  }
  return grouped
}

function main() {
  ensureDir(processedDir)
  ensureDir(reportsDir)

  const preflight = readJson(join(reportsDir, 'provider-preflight.json'), {})
  const preflightRows = readJsonl(join(processedDir, 'provider_preflight.jsonl'))
  const waveLedger = readJsonl(join(processedDir, 'wave_ledger.jsonl'))
  const readiness = readJson(join(reportsDir, 'readiness.json'), {})
  const provider = preflight.provider ?? 'apify'
  const readyByWave = groupByWave(preflightRows.filter((row) => row.ready))
  const blockedByWave = groupByWave(preflightRows.filter((row) => !row.ready))
  const ledgerByWave = new Map(waveLedger.map((row) => [row.wave_id, row]))

  const rows = Array.from(readyByWave.entries()).map(([waveId, tasks]) => {
    const ledger = ledgerByWave.get(waveId) ?? {}
    const blockedTasks = blockedByWave.get(waveId) ?? []
    const wave = waveNumber(waveId)
    const estimatedCost = tasks.reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0)
    const estimatedRows = tasks.reduce((sum, row) => sum + Number(row.estimated_result_rows ?? 0), 0)
    const maxTasks = tasks.length
    return {
      wave_id: waveId,
      sequence: ledger.sequence ?? tasks[0]?.sequence ?? '',
      provider,
      ready: blockedTasks.length === 0 && tasks.length > 0,
      blocked_tasks: blockedTasks.length,
      task_count: tasks.length,
      batch_ids: tasks.map((row) => row.batch_id).join('|'),
      surfaces: Array.from(new Set(tasks.map((row) => row.acquisition_surface))).join('|'),
      target_labels: Array.from(new Set(tasks.map((row) => row.target_label).filter(Boolean))).join('|'),
      estimated_result_rows: estimatedRows,
      estimated_cost_usd: Number(estimatedCost.toFixed(2)),
      dry_run_command: `node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --dry-run --max-tasks=${maxTasks} --priority-max=2 --wave=${wave}`,
      live_command: `node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --live --confirm-live --max-tasks=${maxTasks} --priority-max=2 --wave=${wave}`,
      import_command: 'node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs',
      rebuild_command: 'node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs',
      first_query: tasks[0]?.query ?? '',
      second_query: tasks[1]?.query ?? '',
    }
  }).sort((a, b) => Number(a.sequence) - Number(b.sequence))

  const totalCost = rows.reduce((sum, row) => sum + Number(row.estimated_cost_usd), 0)
  const totalRows = rows.reduce((sum, row) => sum + Number(row.estimated_result_rows), 0)
  const runnableRows = rows.filter((row) => row.ready)
  const summary = {
    generated_at: new Date().toISOString(),
    provider,
    readiness_complete: Boolean(readiness.complete),
    preflight_within_budget: Boolean(preflight.within_budget),
    preflight_blocked_tasks: Number(preflight.blocked_tasks ?? 0),
    manifest_waves: rows.length,
    runnable_waves: runnableRows.length,
    blocked_waves: rows.length - runnableRows.length,
    task_rows: rows.reduce((sum, row) => sum + Number(row.task_count), 0),
    estimated_result_rows: totalRows,
    estimated_cost_usd: Number(totalCost.toFixed(2)),
    budget_usd: preflight.pricing_assumption?.budget_usd ?? '',
    within_budget: preflight.within_budget === true && totalCost <= Number(preflight.pricing_assumption?.budget_usd ?? Number.POSITIVE_INFINITY),
    next_wave: runnableRows[0]?.wave_id ?? '',
    next_dry_run_command: runnableRows[0]?.dry_run_command ?? '',
    next_live_command: runnableRows[0]?.live_command ?? '',
    after_live_commands: [
      'node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs',
      'node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs',
    ],
    rows,
  }

  writeJson(join(reportsDir, 'live-run-manifest.json'), summary)
  writeJsonl(join(processedDir, 'live_run_manifest.jsonl'), rows)
  writeCsv(join(processedDir, 'live_run_manifest.csv'), rows)
  writeFileSync(join(reportsDir, 'live-run-manifest.md'), `# Live Run Manifest

Generated: ${summary.generated_at}

- Provider: ${summary.provider}
- Runnable waves: ${summary.runnable_waves}
- Blocked waves: ${summary.blocked_waves}
- Task rows: ${summary.task_rows}
- Estimated result rows: ${summary.estimated_result_rows}
- Estimated cost: $${summary.estimated_cost_usd}
- Budget: $${summary.budget_usd}
- Within budget: ${summary.within_budget}
- Next wave: ${summary.next_wave || 'none'}

## Next Commands

\`\`\`bash
${summary.next_dry_run_command || 'No runnable dry-run command.'}
${summary.next_live_command || 'No runnable live command.'}
${summary.after_live_commands.join('\n')}
\`\`\`

## Waves

| Seq | Wave | Tasks | Cost | Rows | Surfaces | Labels | First query |
| ---: | --- | ---: | ---: | ---: | --- | --- | --- |
${rows.map((row) => `| ${row.sequence} | ${row.wave_id} | ${row.task_count} | $${row.estimated_cost_usd} | ${row.estimated_result_rows} | ${row.surfaces} | ${row.target_labels} | ${row.first_query.replaceAll('|', '\\|')} |`).join('\n')}

Queue: \`data/processed/live_run_manifest.csv\`
`)

  console.log(JSON.stringify(summary, null, 2))
  if (!summary.within_budget || summary.blocked_waves > 0) process.exitCode = 1
}

main()
