import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const specPath = join(experimentDir, 'benchmark-spec.json')
const outDir = join(experimentDir, 'generated')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value)
}

function byId(items) {
  return new Map(items.map((item) => [item.id, item]))
}

function validateSpec(spec) {
  assert(spec.id === 'hard-grounded-research-benchmark', 'Unexpected benchmark id.')
  assert(Array.isArray(spec.categories) && spec.categories.length === 10, 'Expected exactly 10 hard categories.')
  assert(Array.isArray(spec.datasets) && spec.datasets.length >= 4, 'Expected at least four HF datasets.')
  assert(Array.isArray(spec.seed_tasks) && spec.seed_tasks.length >= spec.categories.length, 'Expected one seed task per category.')
  assert(Array.isArray(spec.approaches) && spec.approaches.length >= 3, 'Expected multiple benchmark construction approaches.')

  const categorySet = new Set(spec.categories)
  const datasetIds = new Set(spec.datasets.map((dataset) => dataset.id))
  const taskCategories = new Set(spec.seed_tasks.map((task) => task.category))

  for (const category of categorySet) {
    assert(taskCategories.has(category), `Missing seed task for category: ${category}`)
  }

  for (const dataset of spec.datasets) {
    assert(dataset.url?.startsWith('https://hf.co/datasets/'), `Dataset is not grounded in HF: ${dataset.id}`)
    assert(dataset.viewer?.config && dataset.viewer?.split, `Dataset is missing viewer config/split: ${dataset.id}`)
    assert(Array.isArray(dataset.covers) && dataset.covers.length > 0, `Dataset covers no categories: ${dataset.id}`)
    for (const category of dataset.covers) {
      assert(categorySet.has(category), `Dataset ${dataset.id} covers unknown category: ${category}`)
    }
  }

  for (const task of spec.seed_tasks) {
    assert(categorySet.has(task.category), `Task ${task.id} has unknown category.`)
    assert(Array.isArray(task.dataset_ids) && task.dataset_ids.length > 0, `Task ${task.id} has no datasets.`)
    for (const datasetId of task.dataset_ids) {
      assert(datasetIds.has(datasetId), `Task ${task.id} references unknown dataset: ${datasetId}`)
    }
    assert(task.question_template, `Task ${task.id} is missing question template.`)
    assert(task.expected_failure, `Task ${task.id} is missing expected failure.`)
    assert(Array.isArray(task.scoring_focus) && task.scoring_focus.length > 0, `Task ${task.id} has no scoring focus.`)
  }
}

function scoreApproaches(spec) {
  const datasetMap = byId(spec.datasets)
  const categorySet = new Set(spec.categories)

  return spec.approaches.map((approach) => {
    const taskMatches = spec.seed_tasks.filter((task) => {
      if (approach.id === 'reuse_native_labels') {
        return task.dataset_ids.every((id) => datasetMap.get(id)?.native_signals?.length)
      }
      if (approach.id === 'adversarial_transform') {
        return [
          'stale-vs-current document conflicts',
          'appended document lifecycle changes',
          'source authority conflicts',
          'evidence insufficiency / abstention',
          'citation supports fact but not conclusion',
          'temporal questions: as of date X',
          'cross-document contradiction',
        ].includes(task.category)
      }
      if (approach.id === 'composed_corpus_suite') {
        return task.dataset_ids.length > 1
      }
      return false
    })
    const covered = new Set(taskMatches.map((task) => task.category))
    return {
      id: approach.id,
      name: approach.name,
      covered_categories: [...covered],
      coverage_count: covered.size,
      coverage_rate: Number((covered.size / categorySet.size).toFixed(2)),
      seed_task_count: taskMatches.length,
    }
  }).sort((a, b) => b.coverage_count - a.coverage_count || b.seed_task_count - a.seed_task_count)
}

function buildSuite(spec) {
  const datasetMap = byId(spec.datasets)
  return spec.seed_tasks.map((task) => ({
    id: task.id,
    category: task.category,
    question_template: task.question_template,
    answer_contract: {
      required_fields: [
        'answer',
        'citations',
        'evidence_assessment',
        'confidence',
      ],
      citation_rule: 'Every non-abstention answer sentence must cite evidence that directly supports that sentence.',
      abstention_rule: 'If required evidence is missing, answer must be ABSTAIN and list missing evidence.',
    },
    source_plan: task.dataset_ids.map((id) => {
      const dataset = datasetMap.get(id)
      return {
        dataset_id: id,
        url: dataset.url,
        viewer: dataset.viewer,
        native_signals: dataset.native_signals,
        role: dataset.construction_role,
      }
    }),
    expected_failure: task.expected_failure,
    scoring_focus: task.scoring_focus,
  }))
}

function coverageMatrix(spec) {
  return spec.categories.map((category) => {
    const datasets = spec.datasets.filter((dataset) => dataset.covers.includes(category)).map((dataset) => dataset.id)
    const tasks = spec.seed_tasks.filter((task) => task.category === category).map((task) => task.id)
    return {
      category,
      dataset_count: datasets.length,
      datasets,
      task_count: tasks.length,
      tasks,
    }
  })
}

function renderReadme(spec, matrix, approaches) {
  const datasetLines = spec.datasets
    .map((dataset) => `| ${dataset.id} | ${dataset.license} | ${dataset.covers.join('; ')} |`)
    .join('\n')
  const matrixLines = matrix
    .map((row) => `| ${row.category} | ${row.datasets.join('<br>')} | ${row.tasks.join('<br>')} |`)
    .join('\n')
  const approachLines = approaches
    .map((approach) => `| ${approach.name} | ${approach.coverage_count}/10 | ${approach.covered_categories.join('; ')} |`)
    .join('\n')

  return `# ${spec.title}

This benchmark asks: **${spec.paper_question}**

The working artifact is a seed suite for large-corpus grounded research QA. It is intentionally not another simple fact lookup benchmark: every item targets a failure where the answer may be easy to state but hard to justify with the right evidence.

## Hugging Face Grounding

| Dataset | License | Benchmark role |
| --- | --- | --- |
${datasetLines}

## Construction Approaches Tried

| Approach | Category coverage | Covered categories |
| --- | ---: | --- |
${approachLines}

The current recommendation is to ship the composed corpus suite as the paper benchmark frame, use native labels for smoke tests and baselines, and use adversarial transforms for the hard slices that native datasets do not expose directly.

## Category Matrix

| Category | HF datasets | Seed tasks |
| --- | --- | --- |
${matrixLines}

## Generated Files

- \`generated/seed-suite.json\`: runnable seed task contract.
- \`generated/coverage-matrix.json\`: category to dataset/task coverage.
- \`generated/approach-scores.json\`: comparison of construction approaches.

Run:

\`\`\`bash
pnpm run benchmark:hard-grounded
\`\`\`
`
}

const spec = readJson(specPath)
validateSpec(spec)

const matrix = coverageMatrix(spec)
const approaches = scoreApproaches(spec)
const suite = buildSuite(spec)

for (const row of matrix) {
  assert(row.dataset_count > 0, `No dataset covers category: ${row.category}`)
  assert(row.task_count > 0, `No task covers category: ${row.category}`)
}

writeJson(join(outDir, 'coverage-matrix.json'), matrix)
writeJson(join(outDir, 'approach-scores.json'), approaches)
writeJson(join(outDir, 'seed-suite.json'), suite)
writeText(join(experimentDir, 'README.md'), renderReadme(spec, matrix, approaches))

console.log(`Validated ${spec.categories.length} categories across ${spec.datasets.length} Hugging Face datasets.`)
console.log(`Generated ${suite.length} seed tasks in ${outDir}.`)
console.log(`Best approach: ${approaches[0].name} (${approaches[0].coverage_count}/${spec.categories.length} categories).`)
