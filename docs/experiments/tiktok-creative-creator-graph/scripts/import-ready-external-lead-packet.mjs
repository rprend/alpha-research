import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')
const completedDir = join(experimentDir, 'data/raw/external-leads/completed')
const ledgerPath = join(processedDir, 'external_lead_packet_imports.jsonl')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const dryRun = args.has('--dry-run')
const force = args.has('--force')
const maxFiles = Number(args.get('--max-files') ?? 1000)

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
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

function fileSha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function rel(path) {
  return path.replace(`${root}/`, '')
}

function importFile(row) {
  const output = execFileSync('node', [
    'docs/experiments/tiktok-creative-creator-graph/scripts/import-external-lead-list.mjs',
    `--input=${row.completed_path}`,
    `--source-name=External lead packet ${row.assignment_id}`,
    `--target-label=${row.target_label}`,
    `--source-query=${row.source_query}`,
  ], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(output)
}

function main() {
  ensureDir(processedDir)
  ensureDir(reportsDir)
  ensureDir(completedDir)

  const statusRows = readJsonl(join(processedDir, 'external_lead_packet_status.jsonl'))
  const importLedger = readJsonl(ledgerPath)
  const importedKeys = new Set(importLedger
    .filter((row) => row.status === 'imported')
    .map((row) => `${row.completed_file_name}:${row.sha256}`))

  const readyRows = statusRows
    .filter((row) => row.import_ready && row.completed_path && existsSync(join(root, row.completed_path)))
    .map((row) => {
      const absolutePath = join(root, row.completed_path)
      const stat = statSync(absolutePath)
      const sha256 = fileSha256(absolutePath)
      return {
        ...row,
        sha256,
        file_size_bytes: stat.size,
        already_imported: importedKeys.has(`${row.completed_file_name}:${sha256}`),
      }
    })

  const pendingRows = readyRows
    .filter((row) => force || !row.already_imported)
    .slice(0, maxFiles)

  const results = []
  for (const row of pendingRows) {
    if (dryRun) {
      results.push({
        assignment_id: row.assignment_id,
        completed_file_name: row.completed_file_name,
        completed_path: row.completed_path,
        sha256: row.sha256,
        status: 'dry_run',
        output_rows: Number(row.valid_rows ?? 0),
        output_path: '',
      })
      continue
    }

    try {
      const imported = importFile(row)
      results.push({
        assignment_id: row.assignment_id,
        completed_file_name: row.completed_file_name,
        completed_path: row.completed_path,
        sha256: row.sha256,
        file_size_bytes: row.file_size_bytes,
        status: 'imported',
        generated_at: new Date().toISOString(),
        output_rows: imported.output_rows,
        output_path: imported.output_path,
        target_label_counts: imported.target_label_counts,
      })
    } catch (error) {
      results.push({
        assignment_id: row.assignment_id,
        completed_file_name: row.completed_file_name,
        completed_path: row.completed_path,
        sha256: row.sha256,
        file_size_bytes: row.file_size_bytes,
        status: 'failed',
        generated_at: new Date().toISOString(),
        error: error.message,
        stdout_tail: String(error.stdout ?? '').split('\n').filter(Boolean).slice(-20),
        stderr_tail: String(error.stderr ?? '').split('\n').filter(Boolean).slice(-20),
      })
    }
  }

  if (!dryRun && results.length) writeJsonl(ledgerPath, [...importLedger, ...results])

  const summary = {
    generated_at: new Date().toISOString(),
    dry_run: dryRun,
    force,
    max_files: maxFiles,
    status_rows: statusRows.length,
    ready_files: readyRows.length,
    already_imported_ready_files: readyRows.filter((row) => row.already_imported).length,
    pending_files: pendingRows.length,
    imported_files: results.filter((row) => row.status === 'imported').length,
    failed_files: results.filter((row) => row.status === 'failed').length,
    output_rows: results.reduce((sum, row) => sum + Number(row.output_rows ?? 0), 0),
    ledger_path: rel(ledgerPath),
    results,
    next_command: 'node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs && node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs',
  }

  writeJson(join(reportsDir, 'external-lead-packet-import.json'), summary)
  writeFileSync(join(reportsDir, 'external-lead-packet-import.md'), `# External Lead Packet Import

Generated: ${summary.generated_at}

- Dry run: ${summary.dry_run}
- Ready files: ${summary.ready_files}
- Already imported ready files: ${summary.already_imported_ready_files}
- Pending files: ${summary.pending_files}
- Imported files: ${summary.imported_files}
- Failed files: ${summary.failed_files}
- Output rows: ${summary.output_rows}
- Ledger: \`${summary.ledger_path}\`

## Results

| Assignment | File | Status | Rows | Output |
| --- | --- | --- | ---: | --- |
${summary.results.map((row) => `| ${row.assignment_id} | ${row.completed_file_name} | ${row.status} | ${row.output_rows ?? 0} | ${row.output_path ?? ''} |`).join('\n') || '| none | none | none | 0 | none |'}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (summary.failed_files > 0) process.exitCode = 1
}

main()
