import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const externalLeadsDir = join(experimentDir, 'data/raw/external-leads')
const reportsDir = join(experimentDir, 'reports')

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function parseCsvLine(line) {
  const values = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  values.push(current)
  return values
}

function readCsv(path) {
  if (!existsSync(path)) return []
  const lines = readFileSync(path, 'utf8').split('\n').filter((line) => line.trim())
  if (!lines.length) return []
  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
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

function splitSourceUrls(assignment) {
  const urls = String(assignment.source_urls || assignment.primary_source_url || '')
    .split('|')
    .map((url) => url.trim())
    .filter(Boolean)
  return urls.length ? urls : [assignment.source_target || assignment.source_query || '']
}

function sourceKind(url) {
  if (url.includes('tiktok.com/tag/')) return 'tiktok_hashtag'
  if (url.includes('tiktok.com/search/user')) return 'tiktok_user_search'
  if (url.includes('tiktok.com/search/video')) return 'tiktok_video_search'
  if (url.includes('google.com/search')) return 'google_search'
  if (url.includes('bing.com/search')) return 'bing_search'
  return 'source_page'
}

function buildRows(assignments) {
  return assignments.flatMap((assignment, assignmentIndex) => {
    const sourceUrls = splitSourceUrls(assignment)
    const leadTarget = Number(assignment.lead_target || 0)
    const baseQuota = Math.floor(leadTarget / sourceUrls.length)
    const remainder = leadTarget % sourceUrls.length
    return sourceUrls.map((sourceUrl, sourceIndex) => {
      const quota = baseQuota + (sourceIndex < remainder ? 1 : 0)
      return {
        work_item_id: `external_source_${String(assignmentIndex + 1).padStart(4, '0')}_${String(sourceIndex + 1).padStart(2, '0')}`,
        assignment_id: assignment.assignment_id,
        wave_id: assignment.wave_id,
        priority: assignment.priority,
        target_label: assignment.target_label,
        acquisition_surface: assignment.acquisition_surface,
        source_kind: sourceKind(sourceUrl),
        source_url: sourceUrl,
        source_query: assignment.source_query,
        query_hints: assignment.query_hints,
        lead_quota: quota,
        completed_file_name: assignment.completed_file_name,
        completed_file_path: `docs/experiments/tiktok-creative-creator-graph/data/raw/external-leads/completed/${assignment.completed_file_name}`,
        template_path: `docs/experiments/tiktok-creative-creator-graph/data/raw/external-leads/templates/${assignment.completed_file_name}`,
        acceptance_rubric: assignment.acceptance_rubric,
        import_command: assignment.import_command,
        status: 'not_started',
      }
    })
  })
}

function main() {
  ensureDir(externalLeadsDir)
  ensureDir(reportsDir)

  const assignments = readCsv(join(externalLeadsDir, 'acquisition-packet.csv'))
  const rows = buildRows(assignments)
  const byKind = rows.reduce((acc, row) => {
    acc[row.source_kind] = (acc[row.source_kind] ?? 0) + 1
    return acc
  }, {})
  const byLabel = rows.reduce((acc, row) => {
    acc[row.target_label] = (acc[row.target_label] ?? 0) + Number(row.lead_quota || 0)
    return acc
  }, {})

  const csvPath = join(externalLeadsDir, 'source-worklist.csv')
  const jsonlPath = join(externalLeadsDir, 'source-worklist.jsonl')
  writeCsv(csvPath, rows)
  writeJsonl(jsonlPath, rows)

  const summary = {
    generated_at: new Date().toISOString(),
    purpose: 'Per-source external lead collection worklist derived from the token-free acquisition packet.',
    assignment_rows: assignments.length,
    work_items: rows.length,
    total_lead_quota: rows.reduce((sum, row) => sum + Number(row.lead_quota || 0), 0),
    source_kind_counts: byKind,
    label_lead_quotas: byLabel,
    outputs: {
      source_worklist_csv: csvPath.replace(`${root}/`, ''),
      source_worklist_jsonl: jsonlPath.replace(`${root}/`, ''),
    },
    first_work_items: rows.slice(0, 25),
  }

  writeJson(join(reportsDir, 'external-lead-worklist.json'), summary)
  writeFileSync(join(reportsDir, 'external-lead-worklist.md'), `# External Lead Source Worklist

Generated: ${summary.generated_at}

This breaks the token-free acquisition packet into smaller source-level collection units. Work items point to a specific TikTok/search URL, a target label, a quota, and the completed file where accepted leads should land.

## Summary

- Assignment rows: ${summary.assignment_rows}
- Work items: ${summary.work_items}
- Total lead quota: ${summary.total_lead_quota}
- Source worklist CSV: \`${summary.outputs.source_worklist_csv}\`
- Source worklist JSONL: \`${summary.outputs.source_worklist_jsonl}\`

## Source Kinds

${Object.entries(summary.source_kind_counts).map(([kind, count]) => `- ${kind}: ${count}`).join('\n')}

## First Work Items

| Work item | Assignment | Label | Source kind | Lead quota | Source URL | Completed file |
| --- | --- | --- | --- | ---: | --- | --- |
${summary.first_work_items.map((row) => `| ${row.work_item_id} | ${row.assignment_id} | ${row.target_label} | ${row.source_kind} | ${row.lead_quota} | ${row.source_url} | ${row.completed_file_name} |`).join('\n')}

Full worklist: \`data/raw/external-leads/source-worklist.csv\`
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
