import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const specPath = join(experimentDir, 'benchmark-spec.json')
const scalePlanPath = join(generatedDir, 'scale-plan.json')
const manifestJsonPath = join(generatedDir, 'expansion-manifest.json')
const manifestMarkdownPath = join(experimentDir, 'EXPANSION_MANIFEST.md')

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

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function datasetMap(spec) {
  return new Map(spec.datasets.map((dataset) => [dataset.id, dataset]))
}

function seedTaskMap(spec) {
  return new Map(spec.seed_tasks.map((task) => [task.id, task]))
}

function generatorInstructionFor(category) {
  const instructions = {
    'multi-hop synthesis': 'Generate questions where at least two cited documents are jointly necessary; include one plausible but nonessential distractor citation.',
    'stale-vs-current document conflicts': 'Generate paired older/newer evidence snapshots and require the answer to reject stale claims under the newer date.',
    'appended document lifecycle changes': 'Generate long-document examples where an appendix, erratum, or lifecycle note changes the controlling answer.',
    'table + text reasoning': 'Generate questions that cannot be answered from the table alone or text alone; both must be cited in the rationale.',
    'source authority conflicts': 'Generate examples with a lower-authority source and a higher-authority source that disagree; mark the controlling authority.',
    'evidence insufficiency / abstention': 'Generate answerable-looking contexts where one required fact is absent; the correct answer must abstain.',
    'citation supports fact but not conclusion': 'Generate examples where cited evidence supports true subfacts but not the requested conclusion.',
    'entity disambiguation': 'Generate same-name or near-name entity traps and require the answer to identify the intended referent from evidence.',
    'temporal questions: as of date X': 'Generate as-of-date questions with earlier and later snapshots; the answer must be scoped to the requested date.',
    'cross-document contradiction': 'Generate evidence sets that explicitly contradict each other and require either conflict reporting or a documented controlling rule.',
  }
  return instructions[category] || 'Generate hard grounded research QA items that preserve explicit evidence ids and answer provenance.'
}

function buildManifest(spec, scalePlan) {
  const datasetsById = datasetMap(spec)
  const tasksById = seedTaskMap(spec)
  const batches = scalePlan.expansion_batches.map((batch) => {
    const seedTask = tasksById.get(batch.seed_task_id)
    return {
      batch_id: batch.batch_id,
      category: batch.category,
      status: 'ready_for_generation',
      target_new_items: batch.target_new_items,
      required_review_rows: batch.review_rows_required,
      seed_task_id: batch.seed_task_id,
      question_template: seedTask?.question_template || null,
      expected_failure: seedTask?.expected_failure || null,
      scoring_focus: seedTask?.scoring_focus || [],
      source_datasets: batch.source_datasets.map((datasetId) => {
        const dataset = datasetsById.get(datasetId)
        return {
          dataset_id: datasetId,
          url: dataset?.url || null,
          viewer: dataset?.viewer || null,
          license: dataset?.license || 'unknown',
          construction_role: dataset?.construction_role || null,
        }
      }),
      generator_instruction: generatorInstructionFor(batch.category),
      required_output_schema: {
        item_id: 'stable id prefixed by batch_id',
        category: batch.category,
        question: 'research QA prompt with explicit grounding constraints',
        expected_answer: 'answer string or ABSTAIN/CONFLICT as appropriate',
        source_examples: 'one or more source dataset rows with source_row_id and evidence_units',
        evidence_units: 'minimal cited passages/tables needed for the gold answer',
        hard_grounding_signals: 'category-specific tags explaining why this is not simple lookup',
        provenance: 'dataset id, split/config, row offset or stable source id, and transformation notes',
      },
      acceptance_checks: [
        'Every generated item has at least one source dataset row with a stable source_row_id.',
        'Every answer is supported by cited evidence or explicitly marked ABSTAIN/CONFLICT.',
        'The stated hard-grounding signal matches the category definition.',
        'No item is promoted without two independent reviews or adjudication.',
      ],
    }
  })

  return {
    benchmark_id: scalePlan.benchmark_id,
    manifest_id: 'hard-grounded-expansion-manifest-v1',
    source_scale_plan: 'generated/scale-plan.json',
    batch_count: batches.length,
    target_new_items: batches.reduce((sum, batch) => sum + batch.target_new_items, 0),
    required_review_rows: batches.reduce((sum, batch) => sum + batch.required_review_rows, 0),
    status: batches.length > 0 ? 'ready_for_generation' : 'complete',
    batches,
  }
}

function renderMarkdown(manifest) {
  const rows = manifest.batches.map((batch) => [
    batch.batch_id,
    batch.category,
    String(batch.target_new_items),
    String(batch.required_review_rows),
    batch.source_datasets.map((dataset) => dataset.dataset_id).join('<br>'),
  ])

  return `# Hard Grounded Research Expansion Manifest

This generated manifest converts the scale plan into deterministic generation contracts. Each batch is ready for item generation, reviewer workbook creation, and later adjudication.

## Summary

- Manifest id: ${manifest.manifest_id}
- Source scale plan: ${manifest.source_scale_plan}
- Status: ${manifest.status}
- Batches: ${manifest.batch_count}
- Target new items: ${manifest.target_new_items}
- Required review rows: ${manifest.required_review_rows}

## Batch Contracts

${markdownTable(['Batch', 'Category', 'Target new items', 'Required review rows', 'Source datasets'], rows)}

## Required Output Schema

Each generated item must include a stable \`item_id\`, \`category\`, \`question\`, \`expected_answer\`, \`source_examples\`, minimal \`evidence_units\`, \`hard_grounding_signals\`, and row-level \`provenance\`.
`
}

const manifest = buildManifest(readJson(specPath), readJson(scalePlanPath))
writeJson(manifestJsonPath, manifest)
writeText(manifestMarkdownPath, renderMarkdown(manifest))

console.log(`Wrote hard grounded expansion manifest to ${manifestJsonPath}`)
console.log(`Wrote hard grounded expansion manifest report to ${manifestMarkdownPath}`)
