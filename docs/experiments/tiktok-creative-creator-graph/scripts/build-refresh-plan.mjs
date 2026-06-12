import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
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

function daysSince(value) {
  if (!value) return Infinity
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return Infinity
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)))
}

function cadenceFor(status, score) {
  if (status === 'excellent') return 'weekly'
  if (status === 'useful' || Number(score.overall_usefulness ?? 0) >= 70) return 'monthly'
  if (status === 'reject') return 'quarterly'
  return 'monthly'
}

function dueDaysFor(cadence) {
  if (cadence === 'weekly') return 7
  if (cadence === 'monthly') return 30
  return 90
}

function main() {
  ensureDir(processedDir)
  ensureDir(reportsDir)

  const accounts = readJsonl(join(processedDir, 'creator_accounts.jsonl'))
  const scores = readJsonl(join(processedDir, 'creator_scores_reviewed.jsonl')).length
    ? readJsonl(join(processedDir, 'creator_scores_reviewed.jsonl'))
    : readJsonl(join(processedDir, 'creator_scores.jsonl'))
  const classifications = readJsonl(join(processedDir, 'creator_classifications.jsonl'))
  const scoreByCreator = new Map(scores.map((score) => [score.creator_id, score]))
  const classByCreator = new Map(classifications.map((row) => [row.creator_id, row]))

  const tasks = accounts.map((account) => {
    const score = scoreByCreator.get(account.id) ?? {}
    const classification = classByCreator.get(account.id) ?? {}
    const status = score.reviewed_status || score.status || 'unknown'
    const cadence = cadenceFor(status, score)
    const lastSeenDays = daysSince(account.last_seen_at)
    const lastPostDays = daysSince(account.last_post_at)
    const due = lastSeenDays >= dueDaysFor(cadence)
    const priority = status === 'excellent' ? 1 : status === 'useful' ? 2 : due ? 3 : 4
    return {
      creator_id: account.id,
      handle: account.handle,
      profile_url: account.profile_url,
      primary_label: classification.primary_label ?? '',
      reviewed_status: status,
      overall_usefulness: score.overall_usefulness ?? '',
      cadence,
      due,
      priority,
      last_seen_days: Number.isFinite(lastSeenDays) ? lastSeenDays : '',
      last_post_days: Number.isFinite(lastPostDays) ? lastPostDays : '',
      refresh_surface: 'tiktok_profile_export',
      expected_output: 'profile metadata and recent public videos',
    }
  }).sort((a, b) => a.priority - b.priority || Number(b.overall_usefulness || 0) - Number(a.overall_usefulness || 0))

  const dueTasks = tasks.filter((task) => task.due || task.priority <= 2)
  writeJsonl(join(processedDir, 'refresh_tasks.jsonl'), tasks)
  writeCsv(join(processedDir, 'refresh_tasks.csv'), tasks)

  const summary = {
    generated_at: new Date().toISOString(),
    accounts: accounts.length,
    refresh_tasks: tasks.length,
    due_or_high_value_tasks: dueTasks.length,
    cadence_counts: tasks.reduce((acc, task) => {
      acc[task.cadence] = (acc[task.cadence] ?? 0) + 1
      return acc
    }, {}),
    priority_counts: tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] ?? 0) + 1
      return acc
    }, {}),
  }

  writeJson(join(reportsDir, 'refresh-plan.json'), summary)
  writeFileSync(join(reportsDir, 'refresh-plan.md'), `# Refresh Plan

Generated: ${summary.generated_at}

- Accounts: ${summary.accounts}
- Refresh tasks: ${summary.refresh_tasks}
- Due or high-value tasks: ${summary.due_or_high_value_tasks}

## Cadence Counts

${Object.entries(summary.cadence_counts).map(([cadence, count]) => `- ${cadence}: ${count}`).join('\n')}

## Priority Counts

${Object.entries(summary.priority_counts).map(([priority, count]) => `- P${priority}: ${count}`).join('\n')}

Task files: \`data/processed/refresh_tasks.jsonl\`, \`data/processed/refresh_tasks.csv\`
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
