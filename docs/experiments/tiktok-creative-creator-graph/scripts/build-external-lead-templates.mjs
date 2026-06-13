import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const externalLeadsDir = join(experimentDir, 'data/raw/external-leads')
const templateDir = join(externalLeadsDir, 'templates')
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

function templateRows(assignment) {
  const rows = []
  const targetRows = Number(assignment.lead_target || 250)
  for (let index = 0; index < targetRows; index += 1) {
    rows.push({
      handle: '',
      profile_url: '',
      display_name: '',
      bio: '',
      target_label: assignment.target_label,
      source_name: `External lead packet ${assignment.assignment_id}`,
      source_url: assignment.source_target,
      source_query: assignment.source_query,
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
  ensureDir(reportsDir)

  const assignments = readCsv(join(externalLeadsDir, 'acquisition-packet.csv'))
  const rows = assignments.map((assignment) => {
    const outputPath = join(templateDir, assignment.completed_file_name)
    const csvRows = templateRows(assignment)
    writeCsv(outputPath, csvRows, leadColumns)
    return {
      assignment_id: assignment.assignment_id,
      target_label: assignment.target_label,
      source_query: assignment.source_query,
      lead_target: Number(assignment.lead_target || 0),
      minimum_accepted_leads: Number(assignment.minimum_accepted_leads || 0),
      template_path: outputPath.replace(`${root}/`, ''),
      completed_path: `docs/experiments/tiktok-creative-creator-graph/data/raw/external-leads/completed/${assignment.completed_file_name}`,
    }
  })

  const summary = {
    generated_at: new Date().toISOString(),
    templates: rows.length,
    total_template_rows: rows.reduce((sum, row) => sum + row.lead_target, 0),
    template_dir: templateDir.replace(`${root}/`, ''),
    completed_dir: join(externalLeadsDir, 'completed').replace(`${root}/`, ''),
    first_templates: rows.slice(0, 20),
  }

  writeJson(join(reportsDir, 'external-lead-templates.json'), summary)
  writeFileSync(join(reportsDir, 'external-lead-templates.md'), `# External Lead Templates

Generated: ${summary.generated_at}

- Templates: ${summary.templates}
- Total template rows: ${summary.total_template_rows}
- Template directory: \`${summary.template_dir}\`
- Completed directory: \`${summary.completed_dir}\`

Copy a template from \`data/raw/external-leads/templates/\` to \`data/raw/external-leads/completed/\`, fill handles/profile details, then run the full workflow.

## First Templates

| Assignment | Label | Rows | Template | Completed file |
| --- | --- | ---: | --- | --- |
${summary.first_templates.map((row) => `| ${row.assignment_id} | ${row.target_label} | ${row.lead_target} | \`${row.template_path}\` | \`${row.completed_path}\` |`).join('\n')}
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
