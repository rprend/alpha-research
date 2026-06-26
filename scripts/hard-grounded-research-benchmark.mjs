import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const specPath = join(experimentDir, 'benchmark-spec.json')
const outDir = join(experimentDir, 'generated')
const viewerBaseUrl = 'https://datasets-server.huggingface.co'

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

function sequenceAt(value, index) {
  if (Array.isArray(value)) return value[index]
  return value
}

function compactText(value, maxLength = 700) {
  if (value === null || value === undefined) return ''
  const text = String(value).replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trim()}…`
}

function firstArrayValue(value) {
  if (Array.isArray(value)) return value[0]
  return value
}

function normalizeQasperAnswer(qas, index) {
  const answers = qas.answers?.[index]
  const answerGroup = firstArrayValue(answers?.answer)
  return {
    question: sequenceAt(qas.question, index),
    question_id: sequenceAt(qas.question_id, index),
    unanswerable: Boolean(answerGroup?.unanswerable),
    answer: compactText(
      answerGroup?.free_form_answer ||
        firstArrayValue(answerGroup?.extractive_spans) ||
        (answerGroup?.yes_no === null || answerGroup?.yes_no === undefined ? '' : answerGroup.yes_no),
      240,
    ),
    evidence: compactText(firstArrayValue(answerGroup?.highlighted_evidence) || firstArrayValue(answerGroup?.evidence), 700),
  }
}

function normalizeDatasetRows(dataset, rows) {
  return rows.slice(0, 3).map(({ row }, index) => {
    if (dataset.id === 'hotpotqa/hotpot_qa') {
      const supportTitles = row.supporting_facts?.title || []
      return {
        source_dataset: dataset.id,
        source_row_id: row.id,
        row_offset: index,
        native_question: row.question,
        native_answer: row.answer,
        evidence_units: supportTitles.map((title, evidenceIndex) => ({
          id: `${row.id}:support:${evidenceIndex}`,
          title,
          locator: `sentence ${row.supporting_facts?.sent_id?.[evidenceIndex] ?? 'unknown'}`,
          text: compactText(row.context?.sentences?.[row.context?.title?.indexOf(title)]?.join(' '), 500),
        })),
        hard_grounding_signals: ['multi-hop', 'distractor-context', row.type, row.level].filter(Boolean),
      }
    }

    if (dataset.id === 'allenai/qasper') {
      const normalized = normalizeQasperAnswer(row.qas || {}, 0)
      return {
        source_dataset: dataset.id,
        source_row_id: row.id,
        row_offset: index,
        paper_title: row.title,
        native_question: normalized.question,
        native_answer: normalized.unanswerable ? 'ABSTAIN' : normalized.answer,
        evidence_units: [
          {
            id: `${row.id}:${normalized.question_id || 'question'}:evidence:0`,
            title: row.title,
            locator: normalized.question_id,
            text: normalized.evidence || compactText(row.abstract, 500),
          },
        ],
        hard_grounding_signals: [
          'long-document',
          normalized.unanswerable ? 'unanswerable' : 'extractive-evidence',
          row.figures_and_tables?.caption?.length ? 'figures-or-tables' : '',
        ].filter(Boolean),
      }
    }

    if (dataset.id === 'danwakeem/wikitablequestions-wtq') {
      return {
        source_dataset: dataset.id,
        source_row_id: row.id,
        row_offset: index,
        native_question: row.question,
        native_answer: (row.answers || []).join('; '),
        evidence_units: [
          {
            id: `${row.id}:table`,
            title: row.table?.name || 'table',
            locator: row.answer_coordinates ? `answer_coordinates=${JSON.stringify(row.answer_coordinates)}` : 'table',
            text: compactText(
              [
                `header: ${(row.table?.header || []).join(' | ')}`,
                ...(row.table?.rows || []).slice(0, 3).map((tableRow) => `row: ${tableRow.join(' | ')}`),
              ].join(' / '),
              700,
            ),
          },
        ],
        hard_grounding_signals: ['table-denotation', row.aggregation_label ? `aggregation:${row.aggregation_label}` : 'no-aggregation'],
      }
    }

    if (dataset.id === 'tdiggelm/climate_fever') {
      const evidence = firstArrayValue(row.evidences) || {}
      return {
        source_dataset: dataset.id,
        source_row_id: row.claim_id,
        row_offset: index,
        native_question: `Verify this claim: ${row.claim}`,
        native_answer: row.claim_label,
        evidence_units: [
          {
            id: evidence.evidence_id || `${row.claim_id}:evidence:0`,
            title: evidence.article || 'evidence',
            locator: evidence.evidence_label || row.claim_label,
            text: compactText(evidence.evidence, 700),
          },
        ],
        hard_grounding_signals: ['claim-verification', row.claim_label, evidence.evidence_label].filter(Boolean),
      }
    }

    if (dataset.id === 'Pavithree/eli5') {
      const bestAnswerIndex = row.answers?.score?.reduce(
        (best, score, answerIndex) => (score > (row.answers?.score?.[best] ?? -Infinity) ? answerIndex : best),
        0,
      ) ?? 0
      return {
        source_dataset: dataset.id,
        source_row_id: row.q_id,
        row_offset: index,
        native_question: row.title,
        native_answer: compactText(row.answers?.text?.[bestAnswerIndex], 350),
        evidence_units: [
          {
            id: `${row.q_id}:answer:${row.answers?.a_id?.[bestAnswerIndex] || bestAnswerIndex}`,
            title: row.subreddit || 'explainlikeimfive',
            locator: row.url,
            text: compactText(row.answers?.text?.[bestAnswerIndex], 700),
          },
        ],
        hard_grounding_signals: ['long-form-explanation', 'community-answer', row.answers_urls?.[bestAnswerIndex]?.length ? 'linked-source' : 'no-linked-source'],
      }
    }

    return {
      source_dataset: dataset.id,
      source_row_id: row.id || row.q_id || row.claim_id || `row-${index}`,
      row_offset: index,
      native_question: row.question || row.title || row.claim || 'unknown',
      native_answer: row.answer || row.answers || row.claim_label || '',
      evidence_units: [],
      hard_grounding_signals: ['untyped-row'],
    }
  })
}

async function fetchFirstRows(dataset) {
  const params = new URLSearchParams({
    dataset: dataset.id,
    config: dataset.viewer.config,
    split: dataset.viewer.split,
  })
  const url = `${viewerBaseUrl}/first-rows?${params}`
  const response = await fetch(url)
  const payload = await response.json()
  if (!response.ok || payload.error) {
    throw new Error(`Dataset Viewer failed for ${dataset.id}: ${payload.error || response.statusText}`)
  }
  assert(Array.isArray(payload.rows) && payload.rows.length > 0, `Dataset Viewer returned no rows for ${dataset.id}`)
  return {
    dataset_id: dataset.id,
    viewer_url: url,
    config: dataset.viewer.config,
    split: dataset.viewer.split,
    features: (payload.features || []).map((feature) => feature.name),
    examples: normalizeDatasetRows(dataset, payload.rows),
  }
}

async function materializeLiveExamples(spec) {
  const materialized = []
  for (const dataset of spec.datasets) {
    materialized.push(await fetchFirstRows(dataset))
  }

  const examplesByDataset = new Map(materialized.map((entry) => [entry.dataset_id, entry.examples]))
  const taskExamples = spec.seed_tasks.map((task) => ({
    task_id: task.id,
    category: task.category,
    question_template: task.question_template,
    source_examples: task.dataset_ids.map((datasetId) => {
      const examples = examplesByDataset.get(datasetId) || []
      assert(examples.length > 0, `No materialized examples for ${task.id} from ${datasetId}`)
      return examples[0]
    }),
    expected_failure: task.expected_failure,
    scoring_focus: task.scoring_focus,
  }))

  return {
    source: 'Hugging Face Dataset Viewer first-rows API',
    materialized_datasets: materialized,
    task_examples: taskExamples,
  }
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

- \`DECISION_LOG.md\`: one-decision-per-iteration project decision log.
- \`NOVELTY_AUDIT.md\`: current literature comparison and novelty release gate.
- \`generated/seed-suite.json\`: runnable seed task contract.
- \`generated/coverage-matrix.json\`: category to dataset/task coverage.
- \`generated/approach-scores.json\`: comparison of construction approaches.
- \`generated/materialized-examples.json\`: concrete HF Dataset Viewer rows normalized into benchmark evidence examples.
- \`generated/baseline-submission.json\` and \`generated/baseline-report.json\`: deterministic scorer smoke artifacts from \`benchmark:hard-grounded:evaluate\`.

Run:

\`\`\`bash
pnpm run benchmark:hard-grounded
pnpm run benchmark:hard-grounded:evaluate
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
const materializedExamples = await materializeLiveExamples(spec)
writeJson(join(outDir, 'materialized-examples.json'), materializedExamples)
writeText(join(experimentDir, 'README.md'), renderReadme(spec, matrix, approaches))

console.log(`Validated ${spec.categories.length} categories across ${spec.datasets.length} Hugging Face datasets.`)
console.log(`Generated ${suite.length} seed tasks in ${outDir}.`)
console.log(`Materialized ${materializedExamples.task_examples.length} HF-grounded task examples.`)
console.log(`Best approach: ${approaches[0].name} (${approaches[0].coverage_count}/${spec.categories.length} categories).`)
