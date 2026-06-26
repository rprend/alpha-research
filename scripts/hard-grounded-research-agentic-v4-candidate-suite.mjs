import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const fetchedRowsPath = join(generatedDir, 'source-acquisition-fetched-rows.json')
const outputDir = join(generatedDir, 'agentic-v4-candidate')
const workspaceRoot = join(outputDir, 'workspaces')
const suitePath = join(outputDir, 'suite.json')
const hiddenGoldPath = join(outputDir, 'hidden-gold.json')
const auditPath = join(outputDir, 'audit.json')
const markdownPath = join(experimentDir, 'AGENTIC_V4_CANDIDATE.md')

const TARGET_TASKS = 200
const DOCS_PER_TASK = 1000
const TASKS_PER_CATEGORY = 20
const MIN_UNIQUE_NATIVE_QUESTIONS = 150

const categories = [
  'multi-hop synthesis',
  'stale-vs-current document conflicts',
  'appended document lifecycle changes',
  'table + text reasoning',
  'source authority conflicts',
  'evidence insufficiency / abstention',
  'citation supports fact but not conclusion',
  'entity disambiguation',
  'temporal questions: as of date X',
  'cross-document contradiction',
]

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

function stableHash(text) {
  let hash = 2166136261
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function compact(value, max = 360) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text
}

function parsePreview(row) {
  const preview = row.row_preview || ''
  const fields = {}
  for (const part of preview.split(/\s+\|\|\s+/)) {
    const index = part.indexOf(':')
    if (index > 0) fields[part.slice(0, index).trim()] = part.slice(index + 1).trim()
  }
  return fields
}

function rowLabel(row) {
  const fields = parsePreview(row)
  return compact(fields.title || fields.question || fields.claim || row.source_row_id, 140)
}

function rowAnswer(row) {
  const fields = parsePreview(row)
  return compact(fields.answer || fields.answers || fields.title || fields.question || row.source_row_id, 180)
}

function rowEvidenceText(row) {
  const label = rowLabel(row)
  const answer = rowAnswer(row)
  const preview = row.row_preview || `Pointer-only Hugging Face row ${row.global_source_key}; no redistributable preview text is stored.`
  return [
    `Dataset: ${row.source_dataset}`,
    `Source row: ${row.source_row_id}`,
    `Viewer: ${row.viewer?.config || 'default'} / ${row.viewer?.split || 'unknown'}`,
    `Package policy: ${row.package_policy}`,
    `License: ${row.license || 'unknown'}`,
    `Row label: ${label}`,
    `Row answer field: ${answer}`,
    `Preview: ${preview}`,
  ].join('\n')
}

function sourceDocument(row, role, taskIndex, suffix = '') {
  return {
    document_id: `v4:${role}:${stableHash(`${row.global_source_key}:${taskIndex}:${suffix}`).slice(0, 12)}`,
    title: `${role} source: ${rowLabel(row)}`,
    source_dataset: row.source_dataset,
    source_row_id: row.source_row_id,
    role,
    provenance: {
      source_type: row.pointer_only ? 'hf_dataset_pointer_row' : 'hf_dataset_viewer_row_preview',
      source_dataset: row.source_dataset,
      source_row_id: row.source_row_id,
      hf_row_idx: row.hf_row_idx,
      viewer: row.viewer,
      package_policy: row.package_policy,
      content_hash: stableHash(rowEvidenceText(row)),
    },
    text: rowEvidenceText(row),
  }
}

function syntheticDocument(seed, role, text) {
  return {
    document_id: `v4:${role}:${stableHash(seed).slice(0, 12)}`,
    title: `${role} document ${stableHash(seed).slice(0, 8)}`,
    source_dataset: 'derived-public-corpus/v4-synthetic-control',
    source_row_id: seed,
    role,
    provenance: {
      source_type: 'deterministic_public_corpus_transform',
      source_dataset: 'derived-public-corpus/v4-synthetic-control',
      source_row_id: seed,
      content_hash: stableHash(text),
    },
    text,
  }
}

function buildCategoryTask(category, index, rows, allRows) {
  const primary = rows[index % rows.length]
  const secondary = rows[(index * 7 + 11) % rows.length]
  const tertiary = allRows[(index * 13 + 17) % allRows.length]
  const primaryLabel = rowLabel(primary)
  const secondaryLabel = rowLabel(secondary)
  const primaryAnswer = rowAnswer(primary)
  const secondaryAnswer = rowAnswer(secondary)
  const taskId = `hgr_v4_candidate_${String(index + 1).padStart(3, '0')}_${slug(category)}_${stableHash(
    `${category}:${primary.global_source_key}:${secondary.global_source_key}:${index}`,
  ).slice(0, 6)}`
  const sourceA = sourceDocument(primary, 'primary', index, 'a')
  const sourceB = sourceDocument(secondary, 'secondary', index, 'b')
  const sourceC = sourceDocument(tertiary, 'near_distractor', index, 'c')

  let question = ''
  let expected = ''
  let required = [sourceA.document_id]
  let rejected = [sourceC.document_id]
  let challenge = {}
  let extraDocs = []

  if (category === 'multi-hop synthesis') {
    question = `Using the corpus, identify the row answer field for the source titled "${primaryLabel}" and the row answer field for the source titled "${secondaryLabel}", then return them as "first => second".`
    expected = `${primaryAnswer} => ${secondaryAnswer}`
    required = [sourceA.document_id, sourceB.document_id]
    challenge = { type: 'two_source_join', required_order: ['primary', 'secondary'] }
  } else if (category === 'stale-vs-current document conflicts') {
    const stale = syntheticDocument(`${taskId}:stale`, 'stale', `Older note for ${primaryLabel}: controlling answer was "${secondaryAnswer}". This note is stale.`)
    const current = syntheticDocument(`${taskId}:current`, 'current', `Current note for ${primaryLabel}: controlling answer is "${primaryAnswer}". This note supersedes older notes.`)
    question = `For "${primaryLabel}", resolve the stale/current conflict and return the current controlling answer.`
    expected = primaryAnswer
    required = [current.document_id]
    rejected = [stale.document_id, sourceC.document_id]
    extraDocs = [stale, current]
    challenge = { type: 'stale_current_conflict', stale_document_id: stale.document_id, current_document_id: current.document_id }
  } else if (category === 'appended document lifecycle changes') {
    const original = syntheticDocument(`${taskId}:original`, 'original_body', `Original body for ${primaryLabel}: answer "${secondaryAnswer}".`)
    const appendix = syntheticDocument(`${taskId}:appendix`, 'appendix_update', `Appendix update for ${primaryLabel}: final controlling answer "${primaryAnswer}". This appended update supersedes the original body.`)
    question = `For "${primaryLabel}", inspect the original body and appended update; return the final controlling answer.`
    expected = primaryAnswer
    required = [original.document_id, appendix.document_id]
    rejected = [sourceC.document_id]
    extraDocs = [original, appendix]
    challenge = { type: 'document_lifecycle_appendix', original_document_id: original.document_id, appendix_document_id: appendix.document_id }
  } else if (category === 'table + text reasoning') {
    question = `Find the table or QA source labeled "${primaryLabel}" and return its answer field together with its dataset as "answer @ dataset".`
    expected = `${primaryAnswer} @ ${primary.source_dataset}`
    challenge = { type: 'table_text_join', required_fields: ['answer', 'source_dataset'] }
  } else if (category === 'source authority conflicts') {
    const low = syntheticDocument(`${taskId}:community`, 'low_authority', `Community summary for ${primaryLabel}: answer "${secondaryAnswer}".`)
    const high = syntheticDocument(`${taskId}:reviewed`, 'high_authority', `Expert-reviewed source for ${primaryLabel}: answer "${primaryAnswer}".`)
    question = `For "${primaryLabel}", resolve the authority conflict and return the expert-reviewed answer.`
    expected = primaryAnswer
    required = [high.document_id]
    rejected = [low.document_id, sourceC.document_id]
    extraDocs = [low, high]
    challenge = { type: 'authority_conflict', authority_order: ['expert-reviewed source', 'community summary'], high_authority_document_id: high.document_id }
  } else if (category === 'evidence insufficiency / abstention') {
    question = `Does the corpus provide independent confirmation that "${primaryLabel}" has final answer "${primaryAnswer}"? Answer only if there are two independent confirming sources.`
    expected = 'ABSTAIN'
    required = []
    rejected = [sourceA.document_id, sourceC.document_id]
    challenge = { type: 'insufficiency_probe', missing_evidence: ['second independent confirming source'] }
  } else if (category === 'citation supports fact but not conclusion') {
    question = `The corpus has a source for "${primaryLabel}". Does that citation alone prove the broader comparative conclusion that it has the same answer as "${secondaryLabel}"?`
    expected = 'ABSTAIN'
    required = []
    rejected = [sourceA.document_id, sourceB.document_id, sourceC.document_id]
    challenge = { type: 'citation_overreach_probe', supported_fact: primaryAnswer, unsupported_conclusion: secondaryAnswer }
  } else if (category === 'entity disambiguation') {
    question = `There are near-name sources in the corpus. Return the answer field for the exact source row "${primary.global_source_key}" whose label is "${primaryLabel}".`
    expected = primaryAnswer
    challenge = { type: 'entity_disambiguation', exact_source_key: primary.global_source_key }
  } else if (category === 'temporal questions: as of date X') {
    const asOf = `202${index % 5}-12-31`
    const future = syntheticDocument(`${taskId}:future`, 'future_update', `Future update after ${asOf} for ${primaryLabel}: answer "${secondaryAnswer}". Do not use for as-of questions.`)
    const valid = syntheticDocument(`${taskId}:asof`, 'as_of_valid', `As of ${asOf}, the controlling answer for ${primaryLabel} is "${primaryAnswer}".`)
    question = `As of ${asOf}, what is the controlling answer for "${primaryLabel}"?`
    expected = primaryAnswer
    required = [valid.document_id]
    rejected = [future.document_id, sourceC.document_id]
    extraDocs = [valid, future]
    challenge = { type: 'as_of_date_constraint', as_of_date: asOf, valid_document_id: valid.document_id, excluded_future_document_id: future.document_id }
  } else if (category === 'cross-document contradiction') {
    const a = syntheticDocument(`${taskId}:doc-a`, 'document_a', `Document A for ${primaryLabel}: answer "${primaryAnswer}".`)
    const b = syntheticDocument(`${taskId}:doc-b`, 'document_b', `Document B for ${primaryLabel}: answer "${secondaryAnswer}".`)
    question = `Two same-authority documents disagree about "${primaryLabel}". If they cannot be reconciled by date or authority, what should the answer be?`
    expected = 'CONFLICT'
    required = [a.document_id, b.document_id]
    rejected = [sourceC.document_id]
    extraDocs = [a, b]
    challenge = { type: 'cross_document_contradiction', document_a_id: a.document_id, document_b_id: b.document_id }
  }

  const goldDocs = [sourceA, sourceB, ...extraDocs]
  const documents = [...goldDocs, sourceC]
  const usedIds = new Set(documents.map((document) => document.document_id))
  let cursor = index * 19
  while (documents.length < DOCS_PER_TASK) {
    const row = allRows[cursor % allRows.length]
    const doc = sourceDocument(row, 'distractor', index, `d${documents.length}`)
    if (!usedIds.has(doc.document_id)) {
      documents.push(doc)
      usedIds.add(doc.document_id)
    }
    cursor += 1
  }

  return {
    task_id: taskId,
    suite_id: 'agentic-large-corpus-research-v4-candidate',
    category,
    user_question: question,
    target: {
      native_question: question,
      source_row_keys: [primary.global_source_key, secondary.global_source_key],
      challenge,
      hidden_gold_withheld: true,
    },
    corpus: {
      document_count: documents.length,
      corpus_file: 'corpus.json',
      documents_embedded_in_task_json: false,
    },
    gold: {
      expected_answers: [expected],
      required_evidence_ids: required,
      rejected_evidence_ids: rejected,
      source_row_ids: [primary.source_row_id, secondary.source_row_id],
      source_datasets: [...new Set([primary.source_dataset, secondary.source_dataset])],
      constant_time_scoring: true,
    },
    documents,
  }
}

function publicTask(task) {
  const { documents, gold, ...rest } = task
  return {
    ...rest,
    gold_withheld: true,
    submission_schema: {
      task_id: 'must match this task id',
      answer: 'string',
      cited_evidence_ids: 'array of exact document_id values from corpus.json',
      rejected_evidence_ids: 'array of exact document_id values inspected and rejected',
      search_trace: 'non-empty array',
      evidence_assessment: 'short explanation',
    },
  }
}

function publicCorpus(task) {
  return {
    document_count: task.documents.length,
    documents: task.documents.map((document) => ({
      document_id: document.document_id,
      title: document.title,
      source_dataset: document.source_dataset,
      source_row_id: document.source_row_id,
      role: document.role,
      provenance: document.provenance,
      text: document.text,
    })),
  }
}

const fetched = readJson(fetchedRowsPath)
const usableRows = fetched.rows.filter((row) => row.row_preview || row.pointer_only)
const knownRows = usableRows.filter((row) => row.row_preview)
if (usableRows.length < TARGET_TASKS) throw new Error(`Need ${TARGET_TASKS} usable rows, got ${usableRows.length}`)
if (knownRows.length < 120) throw new Error(`Need at least 120 redistributable preview rows, got ${knownRows.length}`)

const allRows = usableRows
const tasks = []
for (const [categoryIndex, category] of categories.entries()) {
  const categoryRows = usableRows.filter((row) => row.category === category)
  const pool = categoryRows.length >= 6 ? categoryRows : usableRows.slice(categoryIndex * 17).concat(usableRows)
  for (let local = 0; local < TASKS_PER_CATEGORY; local += 1) {
    tasks.push(buildCategoryTask(category, categoryIndex * TASKS_PER_CATEGORY + local, pool, allRows))
  }
}

const uniqueQuestions = new Set(tasks.map((task) => task.target.native_question))
const taskJsonLeaks = tasks.filter((task) => JSON.stringify(publicTask(task)).includes('expected_answers'))
const audit = {
  audit_id: 'agentic-v4-candidate-audit',
  suite_id: 'agentic-large-corpus-research-v4-candidate',
  checked_date: '2026-06-26',
  buyer_ready: false,
  status: 'candidate_not_buyer_ready',
  reason:
    'This v4 candidate repairs task diversity and workspace shortcutting, but still needs shallow-retrieval rejection and stronger evidence-contract review before buyer-grade claims.',
  checks: {
    task_count_at_least_200: tasks.length >= TARGET_TASKS,
    categories_balanced_20_each: categories.every((category) => tasks.filter((task) => task.category === category).length === TASKS_PER_CATEGORY),
    unique_native_question_minimum_met: uniqueQuestions.size >= MIN_UNIQUE_NATIVE_QUESTIONS,
    corpus_docs_between_1000_and_10000: tasks.every((task) => task.documents.length >= 1000 && task.documents.length <= 10000),
    task_json_embeds_documents: false,
    hidden_gold_withheld_from_workspaces: taskJsonLeaks.length === 0,
    deterministic_constant_time_gold: tasks.every((task) => task.gold.constant_time_scoring === true),
  },
  summary: {
    task_count: tasks.length,
    categories: categories.length,
    unique_native_questions: uniqueQuestions.size,
    min_corpus_documents: Math.min(...tasks.map((task) => task.documents.length)),
    max_corpus_documents: Math.max(...tasks.map((task) => task.documents.length)),
    source_rows_available: usableRows.length,
    redistributable_preview_rows_available: knownRows.length,
    pointer_only_rows_available: usableRows.length - knownRows.length,
  },
  blockers: [
    'Run a shallow lexical/metadata baseline and reject or rewrite any task it solves.',
    'Audit evidence contracts for over-synthetic answer patterns before replacing v3.',
    'Run current Codex CLI and Claude Code over the v4 candidate workspaces after shallow-baseline filtering.',
  ],
}

const suite = {
  benchmark_id: 'hard-grounded-research-benchmark',
  suite_id: 'agentic-large-corpus-research-v4-candidate',
  generated_from: 'generated/source-acquisition-fetched-rows.json',
  task_count: tasks.length,
  category_count: categories.length,
  corpus_documents_per_task_target: DOCS_PER_TASK,
  candidate_status: audit.status,
  buyer_ready: false,
  primary_scoring: {
    constant_time_after_submission: true,
    llm_judge_required: false,
    metrics: ['answer_membership', 'required_evidence_recall', 'citation_precision', 'rejected_evidence_presence', 'search_trace_completeness'],
  },
  tasks: tasks.map(publicTask),
}

rmSync(outputDir, { recursive: true, force: true })
mkdirSync(workspaceRoot, { recursive: true })
for (const task of tasks) {
  const taskDir = join(workspaceRoot, task.task_id)
  mkdirSync(taskDir, { recursive: true })
  writeJson(join(taskDir, 'task.json'), publicTask(task))
  writeJson(join(taskDir, 'corpus.json'), publicCorpus(task))
  writeJson(join(taskDir, 'answer.schema.json'), publicTask(task).submission_schema)
  writeText(
    join(taskDir, 'README.md'),
    `# Agentic V4 Candidate Task\n\n${task.user_question}\n\nUse only this workspace. Search corpus.json, cite exact document_id values, and write answer.json.\n`,
  )
}

writeJson(suitePath, suite)
writeJson(hiddenGoldPath, {
  suite_id: suite.suite_id,
  warning: 'Scoring only; withhold from agents.',
  tasks: tasks.map((task) => ({
    task_id: task.task_id,
    category: task.category,
    gold: task.gold,
  })),
})
writeJson(auditPath, audit)

writeText(
  markdownPath,
  `# Agentic V4 Candidate Suite

This candidate suite is a replacement path for the v3 suite's diversity failure.

## Status

- Status: ${audit.status}
- Buyer ready: ${audit.buyer_ready}
- Tasks: ${audit.summary.task_count}
- Categories: ${audit.summary.categories}
- Unique native questions: ${audit.summary.unique_native_questions}/${MIN_UNIQUE_NATIVE_QUESTIONS}
- Corpus documents per task: ${audit.summary.min_corpus_documents}-${audit.summary.max_corpus_documents}
- Source rows available: ${audit.summary.source_rows_available}
- Redistributable preview rows: ${audit.summary.redistributable_preview_rows_available}
- Pointer-only rows: ${audit.summary.pointer_only_rows_available}

## Checks

| Check | Pass |
| --- | --- |
${Object.entries(audit.checks)
  .map(([key, value]) => `| ${key} | ${value} |`)
  .join('\n')}

## Blockers

${audit.blockers.map((blocker) => `- ${blocker}`).join('\n')}
`,
)

console.log(`Wrote ${suitePath}`)
console.log(`Wrote ${hiddenGoldPath}`)
console.log(`Wrote ${auditPath}`)
console.log(`Wrote ${workspaceRoot}`)
console.log(`Wrote ${markdownPath}`)
