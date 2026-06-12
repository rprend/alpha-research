import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const acquisitionDir = join(processedDir, 'acquisition')
const reportsDir = join(experimentDir, 'reports')

const defaultWaveSize = 250
const targetUsefulCreators = 50000

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

function cycle(rows, index) {
  if (!rows.length) return null
  return rows[index % rows.length]
}

function taskScore(task) {
  const priorityScore = 10 - Number(task.priority || 5)
  const yieldScore = Number(task.yield_score || 0) / 10
  const gapScore = Math.min(10, Number(task.target_label_gap || 0) / 1000)
  return priorityScore + yieldScore + gapScore
}

function firstBatchId(candidate) {
  return String(candidate.source_batch_ids ?? '').split('|').map((item) => item.trim()).filter(Boolean)[0] ?? ''
}

function frontierTask(candidate, taskById) {
  const batchId = firstBatchId(candidate)
  const task = taskById.get(batchId)
  return {
    ...(task ?? {}),
    batch_id: batchId || task?.batch_id || '',
    acquisition_surface: candidate.acquisition_surface ?? task?.acquisition_surface ?? '',
    query: candidate.target ?? task?.query ?? '',
    priority: candidate.priority ?? task?.priority ?? 5,
    target_label: candidate.target_label ?? task?.target_label ?? '',
    target_label_gap: task?.target_label_gap ?? '',
    expected_output: candidate.expected_output ?? task?.expected_output ?? '',
    import_target: candidate.import_target ?? task?.import_target ?? '',
    frontier_rank: candidate.frontier_rank ?? '',
    frontier_score: candidate.frontier_score ?? '',
    target_kind: candidate.target_kind ?? '',
    source_batch_ids: candidate.source_batch_ids ?? '',
  }
}

function main() {
  const scalePlan = readJson(join(reportsDir, 'scale-plan.json'), {})
  const reviewPlan = readJson(join(reportsDir, 'review-plan.json'), {})
  const readiness = readJson(join(reportsDir, 'readiness.json'), {})
  const tasks = readJsonl(join(acquisitionDir, 'acquisition_tasks.jsonl'))
  const taskById = new Map(tasks.map((task) => [task.batch_id, task]))
  const frontier = readJsonl(join(processedDir, 'candidate_frontier.jsonl'))
  const categoryPlan = readJsonl(join(processedDir, 'review_plan_categories.jsonl'))

  const waveCount = Math.max(1, Number(scalePlan?.estimated_work?.import_batches_needed ?? 0))
  const usefulGap = Number(readiness?.remaining?.useful_accounts ?? targetUsefulCreators)
  const reviewGap = Number(readiness?.remaining?.reviewed_accounts ?? reviewPlan?.review_gap ?? 0)
  const planningUsefulRate = Number(scalePlan?.planning_assumptions?.planning_useful_rate ?? 0.2)
  const estimatedUsefulPerWave = Math.max(1, Math.floor(defaultWaveSize * planningUsefulRate))
  const reviewRowsPerWave = Math.ceil(reviewGap / waveCount)

  const sortedTasks = [...tasks].sort((a, b) => taskScore(b) - taskScore(a) || a.batch_id.localeCompare(b.batch_id))
  const highPriorityTasks = sortedTasks.filter((task) => Number(task.priority) <= 2)
  const frontierTasks = frontier
    .filter((row) => !row.known_account)
    .map((row) => frontierTask(row, taskById))
    .filter((task) => task.batch_id && task.acquisition_surface)
  const fallbackTasks = frontierTasks.length ? frontierTasks : (highPriorityTasks.length ? highPriorityTasks : sortedTasks)
  const categories = [...categoryPlan].sort((a, b) => Number(a.priority) - Number(b.priority) || Number(b.review_gap) - Number(a.review_gap))
  const categoryByLabel = new Map(categoryPlan.map((row) => [row.label, row]))

  const waves = Array.from({ length: waveCount }).map((_, index) => {
    const primaryTask = cycle(fallbackTasks, index)
    const secondaryTask = cycle(fallbackTasks, index + Math.ceil(fallbackTasks.length / 3))
    const category = categoryByLabel.get(primaryTask?.target_label) ?? cycle(categories, index)
    const remainingUsefulGapBeforeWave = Math.max(0, usefulGap - (index * estimatedUsefulPerWave))
    const expectedUseful = Math.min(estimatedUsefulPerWave, remainingUsefulGapBeforeWave || estimatedUsefulPerWave)
    const reviewTarget = Math.min(reviewRowsPerWave, Math.max(0, reviewGap - (index * reviewRowsPerWave)))
    return {
      wave_id: `scale_wave_${String(index + 1).padStart(4, '0')}`,
      sequence: index + 1,
      status: 'planned',
      target_candidate_accounts: defaultWaveSize,
      expected_useful_creators: expectedUseful,
      review_decision_target: reviewTarget,
      primary_category: primaryTask?.target_label || category?.label || '',
      category_useful_gap: primaryTask?.target_label_gap || category?.useful_gap || '',
      primary_task_id: primaryTask?.batch_id ?? '',
      primary_surface: primaryTask?.acquisition_surface ?? '',
      primary_query: primaryTask?.query ?? '',
      primary_frontier_rank: primaryTask?.frontier_rank ?? '',
      primary_frontier_score: primaryTask?.frontier_score ?? '',
      primary_target_kind: primaryTask?.target_kind ?? '',
      secondary_task_id: secondaryTask?.batch_id ?? '',
      secondary_surface: secondaryTask?.acquisition_surface ?? '',
      secondary_query: secondaryTask?.query ?? '',
      secondary_frontier_rank: secondaryTask?.frontier_rank ?? '',
      secondary_frontier_score: secondaryTask?.frontier_score ?? '',
      secondary_target_kind: secondaryTask?.target_kind ?? '',
      import_target: primaryTask?.import_target ?? 'data/raw/acquisition-results/',
      run_command: `node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --max-tasks=8 --priority-max=2 --wave=${String(index + 1).padStart(4, '0')}`,
      after_import_command: 'node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs',
    }
  })

  const summary = {
    generated_at: new Date().toISOString(),
    target_useful_creators: targetUsefulCreators,
    current_useful_creators: Number(readiness?.counts?.useful_accounts ?? 0),
    useful_gap: usefulGap,
    planned_waves: waves.length,
    wave_candidate_accounts: defaultWaveSize,
    total_candidate_accounts: waves.length * defaultWaveSize,
    estimated_useful_per_wave: estimatedUsefulPerWave,
    estimated_total_useful_creators: waves.reduce((sum, row) => sum + Number(row.expected_useful_creators), 0),
    review_gap: reviewGap,
    review_rows_per_wave: reviewRowsPerWave,
    source_tasks_available: tasks.length,
    frontier_targets_available: frontier.length,
    frontier_targets_used: frontierTasks.length,
    high_priority_source_tasks: highPriorityTasks.length,
    category_focus_rows: categories.length,
    first_waves: waves.slice(0, 20),
  }

  writeJson(join(reportsDir, 'scale-waves.json'), summary)
  writeJsonl(join(processedDir, 'scale_waves.jsonl'), waves)
  writeCsv(join(processedDir, 'scale_waves.csv'), waves)
  writeFileSync(join(reportsDir, 'scale-waves.md'), `# Scale Waves

Generated: ${summary.generated_at}

- Planned waves: ${summary.planned_waves}
- Candidate accounts per wave: ${summary.wave_candidate_accounts}
- Total candidate accounts: ${summary.total_candidate_accounts}
- Estimated useful creators per wave: ${summary.estimated_useful_per_wave}
- Estimated total useful creators: ${summary.estimated_total_useful_creators}
- Review gap: ${summary.review_gap}
- Review rows per wave: ${summary.review_rows_per_wave}
- Source tasks available: ${summary.source_tasks_available}
- Frontier targets available: ${summary.frontier_targets_available}
- Frontier targets used: ${summary.frontier_targets_used}
- High-priority source tasks: ${summary.high_priority_source_tasks}
- Category focus rows: ${summary.category_focus_rows}

## First 20 Waves

| Seq | Wave | Category | Candidates | Expected useful | Review target | Rank | Score | Surface | Query |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
${summary.first_waves.map((row) => `| ${row.sequence} | ${row.wave_id} | ${row.primary_category} | ${row.target_candidate_accounts} | ${row.expected_useful_creators} | ${row.review_decision_target} | ${row.primary_frontier_rank || ''} | ${row.primary_frontier_score || ''} | ${row.primary_surface} | ${row.primary_query} |`).join('\n')}

Full queue: \`data/processed/scale_waves.csv\`
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
