import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const manifestPath = join(generatedDir, 'expansion-manifest.json')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const candidatesJsonPath = join(generatedDir, 'expansion-candidates.json')
const candidatesMarkdownPath = join(experimentDir, 'EXPANSION_CANDIDATES.md')

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

function pilotItemsByCategory(pilotSuite) {
  const items = new Map()
  for (const item of pilotSuite.items) {
    const current = items.get(item.category) || []
    current.push(item)
    items.set(item.category, current)
  }
  return items
}

function candidateQuestion(batch, seedItem, candidateNumber) {
  return [
    batch.question_template,
    `Expansion batch ${batch.batch_id}, candidate ${candidateNumber}.`,
    `Generation instruction: ${batch.generator_instruction}`,
    `Native prompt: ${seedItem.source_examples[0]?.native_question || seedItem.question}`,
  ].join(' ')
}

function buildCandidates(manifest, pilotSuite) {
  const byCategory = pilotItemsByCategory(pilotSuite)
  const candidates = []
  const batchSummaries = []

  for (const batch of manifest.batches) {
    const seeds = byCategory.get(batch.category) || []
    if (seeds.length === 0) {
      throw new Error(`No pilot seed items available for expansion batch category: ${batch.category}`)
    }

    const batchCandidates = []
    for (let index = 0; index < batch.target_new_items; index += 1) {
      const seedItem = seeds[index % seeds.length]
      const candidateNumber = String(index + 1).padStart(3, '0')
      const candidate = {
        id: `${batch.batch_id}_candidate_${candidateNumber}`,
        batch_id: batch.batch_id,
        seed_item_id: seedItem.id,
        seed_task_id: batch.seed_task_id,
        category: batch.category,
        construction: 'expansion_candidate_from_review_manifest',
        transform: seedItem.transform,
        question: candidateQuestion(batch, seedItem, candidateNumber),
        source_examples: seedItem.source_examples,
        expected_answer: seedItem.expected_answer,
        expected_failure: batch.expected_failure,
        scoring_focus: batch.scoring_focus,
        hard_grounding_signals: [
          batch.category,
          'expansion_candidate',
          'requires_human_review_before_gold',
        ],
        provenance: {
          source_manifest: 'generated/expansion-manifest.json',
          source_pilot_suite: 'generated/pilot-suite.json',
          source_batch_id: batch.batch_id,
          source_seed_item_id: seedItem.id,
          source_row_ids: seedItem.source_examples.map((source) => ({
            dataset_id: source.source_dataset,
            source_row_id: source.source_row_id,
          })),
          transformation_note: 'Deterministic expansion candidate seeded from pilot evidence; wording must be reviewed before gold promotion.',
        },
        review_status: 'machine_expansion_needs_human_review',
        acceptance_status: 'pending_two_reviews_or_adjudication',
      }
      batchCandidates.push(candidate)
      candidates.push(candidate)
    }

    batchSummaries.push({
      batch_id: batch.batch_id,
      category: batch.category,
      candidate_count: batchCandidates.length,
      required_review_rows: batch.required_review_rows,
      review_status: 'machine_expansion_needs_human_review',
    })
  }

  return {
    benchmark_id: manifest.benchmark_id,
    source_manifest: 'generated/expansion-manifest.json',
    source_pilot_suite: 'generated/pilot-suite.json',
    candidate_count: candidates.length,
    batch_count: batchSummaries.length,
    required_review_rows: batchSummaries.reduce((sum, batch) => sum + batch.required_review_rows, 0),
    review_status: 'machine_expansion_needs_human_review',
    gold_promotion_allowed: false,
    batch_summaries: batchSummaries,
    candidates,
  }
}

function renderMarkdown(candidateSuite) {
  const rows = candidateSuite.batch_summaries.map((batch) => [
    batch.batch_id,
    batch.category,
    String(batch.candidate_count),
    String(batch.required_review_rows),
    batch.review_status,
  ])

  return `# Hard Grounded Research Expansion Candidates

This generated artifact materializes expansion-manifest batches into candidate benchmark items. These are machine-generated candidates, not gold data; promotion requires the normal two-review or adjudication path.

## Summary

- Source manifest: ${candidateSuite.source_manifest}
- Source pilot suite: ${candidateSuite.source_pilot_suite}
- Batches: ${candidateSuite.batch_count}
- Candidates: ${candidateSuite.candidate_count}
- Required review rows: ${candidateSuite.required_review_rows}
- Review status: ${candidateSuite.review_status}
- Gold promotion allowed: ${candidateSuite.gold_promotion_allowed}

## Batch Candidate Counts

${markdownTable(['Batch', 'Category', 'Candidates', 'Required review rows', 'Review status'], rows)}
`
}

const candidateSuite = buildCandidates(readJson(manifestPath), readJson(pilotSuitePath))
writeJson(candidatesJsonPath, candidateSuite)
writeText(candidatesMarkdownPath, renderMarkdown(candidateSuite))

console.log(`Wrote hard grounded expansion candidates to ${candidatesJsonPath}`)
console.log(`Wrote hard grounded expansion candidate report to ${candidatesMarkdownPath}`)
