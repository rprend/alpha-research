import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const externalLeadsDir = join(experimentDir, 'data/raw/external-leads')
const templateDir = join(externalLeadsDir, 'work-item-templates')
const completedDir = join(externalLeadsDir, 'work-items-completed')
const reportsDir = join(experimentDir, 'reports')

const leadColumns = [
  'handle',
  'profile_url',
  'display_name',
  'bio',
  'target_label',
  'source_name',
  'source_url',
  'source_query',
  'follower_count',
  'likes_count',
  'video_count',
  'verified',
]

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

function writeCsv(path, rows, headers = Object.keys(rows[0] ?? {})) {
  const escape = (value) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  writeFileSync(path, `${headers.join(',')}\n${rows.map((row) => headers.map((header) => escape(row[header])).join(',')).join('\n')}\n`)
}

function templateRows(workItem) {
  const rows = []
  const targetRows = Number(workItem.lead_quota || 1)
  for (let index = 0; index < targetRows; index += 1) {
    rows.push({
      handle: '',
      profile_url: '',
      display_name: '',
      bio: '',
      target_label: workItem.target_label,
      source_name: `External source work item ${workItem.work_item_id}`,
      source_url: workItem.source_url,
      source_query: workItem.source_query,
      follower_count: '',
      likes_count: '',
      video_count: '',
      verified: '',
    })
  }
  return rows
}

function main() {
  ensureDir(templateDir)
  ensureDir(completedDir)
  ensureDir(reportsDir)

  const workItems = readCsv(join(externalLeadsDir, 'source-worklist.csv'))
  const rows = workItems.map((workItem) => {
    const fileName = `${workItem.work_item_id}.csv`
    const outputPath = join(templateDir, fileName)
    writeCsv(outputPath, templateRows(workItem), leadColumns)
    return {
      work_item_id: workItem.work_item_id,
      assignment_id: workItem.assignment_id,
      target_label: workItem.target_label,
      source_kind: workItem.source_kind,
      source_url: workItem.source_url,
      source_query: workItem.source_query,
      lead_quota: Number(workItem.lead_quota || 0),
      template_path: outputPath.replace(`${root}/`, ''),
      completed_path: join(completedDir, fileName).replace(`${root}/`, ''),
      assignment_completed_file: workItem.completed_file_name,
    }
  })

  const byKind = rows.reduce((acc, row) => {
    acc[row.source_kind] = (acc[row.source_kind] ?? 0) + 1
    return acc
  }, {})
  const summary = {
    generated_at: new Date().toISOString(),
    templates: rows.length,
    total_template_rows: rows.reduce((sum, row) => sum + row.lead_quota, 0),
    template_dir: templateDir.replace(`${root}/`, ''),
    completed_dir: completedDir.replace(`${root}/`, ''),
    source_kind_counts: byKind,
    first_templates: rows.slice(0, 25),
  }

  writeJson(join(reportsDir, 'external-lead-work-item-templates.json'), summary)
  writeFileSync(join(reportsDir, 'external-lead-work-item-templates.md'), `# External Lead Work Item Templates

Generated: ${summary.generated_at}

These are small, source-specific templates derived from \`source-worklist.csv\`. Fill a template and save it with the same filename under \`data/raw/external-leads/work-items-completed/\`; the merge step will assemble assignment-level completed files.

- Templates: ${summary.templates}
- Total template rows: ${summary.total_template_rows}
- Template directory: \`${summary.template_dir}\`
- Completed directory: \`${summary.completed_dir}\`

## Source Kinds

${Object.entries(summary.source_kind_counts).map(([kind, count]) => `- ${kind}: ${count}`).join('\n')}

## First Templates

| Work item | Label | Source kind | Rows | Template | Completed file |
| --- | --- | --- | ---: | --- | --- |
${summary.first_templates.map((row) => `| ${row.work_item_id} | ${row.target_label} | ${row.source_kind} | ${row.lead_quota} | \`${row.template_path}\` | \`${row.completed_path}\` |`).join('\n')}
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
