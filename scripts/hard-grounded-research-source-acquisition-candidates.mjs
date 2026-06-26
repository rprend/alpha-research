import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const candidatesJsonPath = join(generatedDir, 'source-acquisition-candidates.json')
const candidatesJsonlPath = join(generatedDir, 'source-acquisition-candidates.jsonl')
const candidatesMarkdownPath = join(experimentDir, 'SOURCE_ACQUISITION_CANDIDATES.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  fetchedRows: join(generatedDir, 'source-acquisition-fetched-rows.json'),
}

const categoryInstructions = {
  'multi-hop synthesis': 'Write a question that requires combining at least two evidence facts from the source row or its native context; mark any single-hop answer as insufficient.',
  'stale-vs-current document conflicts': 'Write a question that asks for the answer under a specified document snapshot and requires rejecting stale or conflicting evidence.',
  'appended document lifecycle changes': 'Write a question where later sections, appendices, errata, or updates change how an earlier statement should be interpreted.',
  'table + text reasoning': 'Write a question that requires using table structure plus surrounding row, title, section, or page metadata rather than a single cell lookup.',
  'source authority conflicts': 'Write a question where sources may disagree and the answer must follow an explicit authority hierarchy.',
  'evidence insufficiency / abstention': 'Write a question where the correct behavior may be abstention if the fetched row lacks enough evidence for the requested conclusion.',
  'citation supports fact but not conclusion': 'Write a question where a citation may support a local fact but not the broader conclusion; require reviewers to flag conclusion overreach.',
  'entity disambiguation': 'Write a question that distinguishes same-name or near-name entities using row-local identifiers, titles, or table metadata.',
  'temporal questions: as of date X': 'Write an as-of-date question and require citations whose document timing supports the requested date.',
  'cross-document contradiction': 'Write a question that should surface contradiction across evidence units and require the answer to report the conflict rather than average it away.',
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
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

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function candidateQuestion(row) {
  const instruction = categoryInstructions[row.category] || 'Write a hard grounded research QA item from this fetched source row.'
  const preview = row.row_preview ? ` Source preview: ${row.row_preview}` : ' Source text is pointer-only; use only the row id, field keys, and upstream locator until license clearance.'
  return `${instruction} Dataset: ${row.source_dataset}. Source row: ${row.source_row_id}.${preview}`
}

function evidencePolicy(row) {
  return row.pointer_only
    ? 'pointer_only_metadata_until_license_clearance'
    : 'known_license_preview_available_for_reviewer_drafting'
}

function buildCandidates({ spec, fetchedRows }) {
  assert(fetchedRows.source_acquisition_fetch_ready, 'Fetched source rows must be complete before materializing candidates.')
  const categories = new Set(spec.categories)
  const candidates = fetchedRows.rows.map((row, index) => ({
    id: `hgr_acquired_${String(index + 1).padStart(4, '0')}_${slug(row.category)}`,
    acquisition_id: row.acquisition_id,
    batch_id: row.batch_id,
    category: row.category,
    source_dataset: row.source_dataset,
    source_row_id: row.source_row_id,
    global_source_key: row.global_source_key,
    construction: 'source_acquisition_candidate_from_fetched_row',
    question_draft: candidateQuestion(row),
    task_generation_instruction: categoryInstructions[row.category] || 'Draft a hard grounded research QA item.',
    evidence_policy: evidencePolicy(row),
    package_policy: row.package_policy,
    pointer_only: row.pointer_only,
    license: row.license,
    reviewer_visible_fields: row.pointer_only
      ? ['category', 'source_dataset', 'source_row_id', 'hf_row_idx', 'field_keys', 'task_generation_instruction']
      : ['category', 'source_dataset', 'source_row_id', 'hf_row_idx', 'field_keys', 'row_preview', 'task_generation_instruction'],
    source_locator: {
      hf_dataset: row.source_dataset,
      config: row.viewer.config,
      split: row.viewer.split,
      row_idx: row.hf_row_idx,
      source_row_id: row.source_row_id,
    },
    source_preview: row.row_preview,
    field_keys: row.field_keys,
    hard_grounding_signals: [
      row.category,
      'fetched_distinct_source_row',
      'requires_task_materialization',
      'requires_two_independent_reviews_before_gold',
    ],
    review_status: 'candidate_materialized_from_source_row_needs_review_workbook',
    gold_promotion_allowed: false,
  }))

  const byCategory = new Map()
  for (const candidate of candidates) {
    const current = byCategory.get(candidate.category) || {
      category: candidate.category,
      candidates: 0,
      known_license_candidates: 0,
      pointer_only_candidates: 0,
      datasets: new Set(),
    }
    current.candidates += 1
    current.datasets.add(candidate.source_dataset)
    if (candidate.pointer_only) current.pointer_only_candidates += 1
    else current.known_license_candidates += 1
    byCategory.set(candidate.category, current)
  }

  const category_summaries = [...byCategory.values()].map((entry) => ({
    ...entry,
    datasets: [...entry.datasets].sort(),
    category_in_spec: categories.has(entry.category),
  }))

  const pointerOnly = candidates.filter((candidate) => candidate.pointer_only).length
  return {
    source_acquisition_candidates_ready:
      candidates.length === fetchedRows.summary.fetched_rows &&
      category_summaries.length === spec.categories.length &&
      category_summaries.every((entry) => entry.category_in_spec) &&
      candidates.every((candidate) => candidate.review_status === 'candidate_materialized_from_source_row_needs_review_workbook') &&
      candidates.every((candidate) => candidate.gold_promotion_allowed === false),
    benchmark_id: spec.id,
    generated_from: {
      benchmark_spec: 'benchmark-spec.json',
      source_acquisition_fetched_rows: 'generated/source-acquisition-fetched-rows.json',
    },
    summary: {
      candidates: candidates.length,
      categories: category_summaries.length,
      source_datasets: new Set(candidates.map((candidate) => candidate.source_dataset)).size,
      known_license_candidates: candidates.length - pointerOnly,
      pointer_only_candidates: pointerOnly,
      required_review_rows: candidates.length * 2,
      completion_claim_allowed: false,
    },
    category_summaries,
    candidates,
  }
}

function renderMarkdown(candidateSuite) {
  const categoryRows = candidateSuite.category_summaries.map((entry) => [
    entry.category,
    String(entry.candidates),
    entry.datasets.join('<br>'),
    String(entry.known_license_candidates),
    String(entry.pointer_only_candidates),
  ])

  return `# Source Acquisition Candidates

This generated artifact turns fetched Hugging Face source rows into review-pending hard-grounded task candidates. It is not gold data: every candidate still requires task editing, reviewer workbook export, two independent reviews, and adjudication before it can support paper claims.

## Summary

- Source acquisition candidates ready: ${candidateSuite.source_acquisition_candidates_ready}
- Candidates: ${candidateSuite.summary.candidates}
- Categories: ${candidateSuite.summary.categories}
- Source datasets: ${candidateSuite.summary.source_datasets}
- Known-license candidates: ${candidateSuite.summary.known_license_candidates}
- Pointer-only candidates: ${candidateSuite.summary.pointer_only_candidates}
- Required review rows: ${candidateSuite.summary.required_review_rows}
- Completion claim allowed: ${candidateSuite.summary.completion_claim_allowed}

## Category Summary

${markdownTable(['Category', 'Candidates', 'Datasets', 'Known-license', 'Pointer-only'], categoryRows)}

## Required Next Work

1. Convert each question draft into a finalized task with evidence units and expected label.
2. Export the task candidates into reviewer workbooks.
3. Complete two independent reviews and adjudication.
4. Promote only reviewed, agreement-resolved items into gold.
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing source acquisition candidate input ${name}: ${path}`)
}

const candidateSuite = buildCandidates({
  spec: readJson(inputs.spec),
  fetchedRows: readJson(inputs.fetchedRows),
})

writeJson(candidatesJsonPath, candidateSuite)
writeText(candidatesJsonlPath, candidateSuite.candidates.map((candidate) => JSON.stringify(candidate)).join('\n') + '\n')
writeText(candidatesMarkdownPath, renderMarkdown(candidateSuite))

console.log(`Wrote hard grounded source acquisition candidates to ${candidatesJsonPath}`)
console.log(`Wrote hard grounded source acquisition candidate JSONL to ${candidatesJsonlPath}`)
console.log(`Wrote hard grounded source acquisition candidate report to ${candidatesMarkdownPath}`)
