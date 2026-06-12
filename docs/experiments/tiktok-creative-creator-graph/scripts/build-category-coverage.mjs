import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const configDir = join(experimentDir, 'config')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

const targetQuotas = {
  filmmaker: 8000,
  sketch_comedian: 7000,
  cinematographer: 5000,
  editor: 5000,
  vfx_animation: 5000,
  standup_comedian: 4000,
  actor_performer: 4000,
  director: 4000,
  film_educator: 3000,
  behind_the_scenes_creator: 3000,
  creative_technologist: 2000,
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

function csvEscape(value) {
  const text = String(value ?? '')
  if (!/[",\n]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

function writeCsv(path, rows) {
  if (rows.length === 0) {
    writeFileSync(path, '')
    return
  }
  const columns = Object.keys(rows[0])
  const lines = [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')),
  ]
  writeFileSync(path, `${lines.join('\n')}\n`)
}

function main() {
  const rubric = readJson(join(configDir, 'category-rubric.json'))
  const classifications = readJsonl(join(processedDir, 'creator_classifications.jsonl'))
  const scores = readJsonl(join(processedDir, 'creator_scores_reviewed.jsonl'))
  const reviewDecisions = readJsonl(join(processedDir, 'review_decisions.jsonl'))
  const scoreByCreator = new Map(scores.map((score) => [score.creator_id, score]))

  const inScopeLabels = rubric.primary_labels.filter((label) => label !== 'unclear' && label !== 'reject')
  const rows = inScopeLabels.map((label) => {
    const primary = classifications.filter((row) => row.primary_label === label)
    const secondary = classifications.filter((row) => row.secondary_labels?.includes(label))
    const primaryUseful = primary.filter((row) => {
      const score = scoreByCreator.get(row.creator_id)
      return ['useful', 'excellent'].includes(score?.reviewed_status ?? score?.status)
    })
    const primaryExcellent = primary.filter((row) => {
      const score = scoreByCreator.get(row.creator_id)
      return (score?.reviewed_status ?? score?.status) === 'excellent'
    })
    const reviewCoverage = primary.filter((row) => scoreByCreator.get(row.creator_id)?.review_decision).length
    const target = targetQuotas[label] ?? 0

    return {
      label,
      target_useful_creators: target,
      current_primary_accounts: primary.length,
      useful_primary_accounts: primaryUseful.length,
      excellent_primary_accounts: primaryExcellent.length,
      secondary_mentions: secondary.length,
      reviewed_primary_accounts: reviewCoverage,
      useful_gap: Math.max(0, target - primaryUseful.length),
      recommended_priority: primaryUseful.length >= target ? 5 : primaryUseful.length === 0 ? 1 : 2,
    }
  })

  const summary = {
    generated_at: new Date().toISOString(),
    target_useful_creators: Object.values(targetQuotas).reduce((sum, value) => sum + value, 0),
    labels: rows.length,
    covered_labels: rows.filter((row) => row.useful_primary_accounts > 0).length,
    uncovered_labels: rows.filter((row) => row.useful_primary_accounts === 0).map((row) => row.label),
    review_decisions: reviewDecisions.length,
    total_useful_primary_accounts: rows.reduce((sum, row) => sum + row.useful_primary_accounts, 0),
    total_useful_gap: rows.reduce((sum, row) => sum + row.useful_gap, 0),
    rows,
  }

  writeFileSync(join(processedDir, 'category_coverage.jsonl'), `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`)
  writeCsv(join(processedDir, 'category_coverage.csv'), rows)
  writeFileSync(join(reportsDir, 'category-coverage.json'), `${JSON.stringify(summary, null, 2)}\n`)
  writeFileSync(join(reportsDir, 'category-coverage.md'), buildMarkdown(summary))
  console.log(JSON.stringify(summary, null, 2))
}

function buildMarkdown(summary) {
  return `# Category Coverage

Generated: ${summary.generated_at}

Target useful creators: ${summary.target_useful_creators}
Covered labels: ${summary.covered_labels}/${summary.labels}
Total useful primary accounts: ${summary.total_useful_primary_accounts}
Total useful gap: ${summary.total_useful_gap}

## Uncovered Labels

${summary.uncovered_labels.length > 0 ? summary.uncovered_labels.map((label) => `- ${label}`).join('\n') : '- None'}

## Quotas

| Label | Target | Useful Primary | Excellent Primary | Secondary Mentions | Reviewed Primary | Gap | Priority |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${summary.rows.map((row) => `| ${row.label} | ${row.target_useful_creators} | ${row.useful_primary_accounts} | ${row.excellent_primary_accounts} | ${row.secondary_mentions} | ${row.reviewed_primary_accounts} | ${row.useful_gap} | ${row.recommended_priority} |`).join('\n')}
`
}

main()
