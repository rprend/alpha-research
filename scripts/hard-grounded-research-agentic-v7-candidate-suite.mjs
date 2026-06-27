import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const fetchedRowsPath = join(generatedDir, 'source-acquisition-fetched-rows.json')
const outputDir = join(generatedDir, 'agentic-v7-candidate')
const workspaceRoot = join(outputDir, 'workspaces')
const suitePath = join(outputDir, 'suite.json')
const hiddenGoldPath = join(outputDir, 'hidden-gold.json')
const auditPath = join(outputDir, 'audit.json')
const markdownPath = join(experimentDir, 'AGENTIC_V7_CANDIDATE.md')

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

function normalizedAnswer(row) {
  return String(rowAnswer(row))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function rowEvidenceText(row) {
  const label = rowLabel(row)
  const answer = rowAnswer(row)
  const preview = naturalPreview(row)
  return [
    `Dossier ${stableHash(row.global_source_key).slice(0, 10)}.`,
    `The material comes from the ${row.source_dataset} collection under the ${row.package_policy} packaging policy.`,
    preview,
    `For this dossier, the short result recorded by the source is ${JSON.stringify(answer)}.`,
    `Search phrase: ${JSON.stringify(label)}.`,
  ].join('\n')
}

function naturalPreview(row) {
  if (!row.row_preview) {
    return `Only a pointer to Hugging Face row ${row.global_source_key} is stored here; no redistributable body text is available in this package.`
  }
  const fields = parsePreview(row)
  if (fields.title && fields.abstract) {
    return `The work is titled ${JSON.stringify(fields.title)}. Its abstract begins: ${compact(fields.abstract, 420)}`
  }
  if (fields.question && fields.answer) {
    return `The source card asks ${JSON.stringify(fields.question)}. The recorded short result is ${JSON.stringify(fields.answer)}.`
  }
  if (fields.claim) {
    return `The source item discusses this claim: ${JSON.stringify(fields.claim)}.`
  }
  return `The source row summary reads: ${compact(row.row_preview.replace(/\s+\|\|\s+/g, '; '), 520)}`
}

function sourceDocument(row, role, taskIndex, suffix = '') {
  return {
    document_id: `v7:doc:${stableHash(`${row.global_source_key}:${taskIndex}:${suffix}`).slice(0, 12)}`,
    title: `Archive record ${stableHash(`${row.global_source_key}:${taskIndex}`).slice(0, 10)}`,
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
    document_id: `v7:doc:${stableHash(seed).slice(0, 12)}`,
    title: `Archive record ${stableHash(seed).slice(0, 10)}`,
    source_dataset: 'derived-public-corpus/v7-synthetic-control',
    source_row_id: seed,
    role,
    provenance: {
      source_type: 'deterministic_public_corpus_transform',
      source_dataset: 'derived-public-corpus/v7-synthetic-control',
      source_row_id: seed,
      content_hash: stableHash(text),
    },
    text,
  }
}

function buildCategoryTask(category, index, rows, allRows) {
  const uniqueAnswerCategories = new Set([
    'stale-vs-current document conflicts',
    'source authority conflicts',
    'entity disambiguation',
    'temporal questions: as of date X',
  ])
  const uniqueRows = rows.filter((row) => normalizedAnswer(row).length >= 12 && row.answer_frequency === 1)
  const globalUniqueRows = allRows.filter((row) => normalizedAnswer(row).length >= 12 && row.answer_frequency === 1)
  const selectionRows =
    uniqueAnswerCategories.has(category) && uniqueRows.length >= 4
      ? uniqueRows
      : uniqueAnswerCategories.has(category) && globalUniqueRows.length >= 40
        ? globalUniqueRows
        : rows
  const primary = selectionRows[index % selectionRows.length]
  const secondary = selectionRows[(index * 7 + 11) % selectionRows.length]
  const tertiary = allRows[(index * 13 + 17) % allRows.length]
  const primaryLabel = rowLabel(primary)
  const secondaryLabel = rowLabel(secondary)
  const primaryAnswer = rowAnswer(primary)
  const secondaryAnswer = rowAnswer(secondary)
  const taskId = `hgr_v7_candidate_${String(index + 1).padStart(3, '0')}_${slug(category)}_${stableHash(
    `${category}:${primary.global_source_key}:${secondary.global_source_key}:${index}`,
  ).slice(0, 6)}`
  const sourceA = sourceDocument(primary, 'primary', index, 'a')
  const sourceB = sourceDocument(secondary, 'secondary', index, 'b')
  const sourceC = sourceDocument(tertiary, 'near_distractor', index, 'c')
  const primaryClue = compact(primaryLabel, 110)
  const secondaryClue = compact(secondaryLabel, 110)
  const distractorClue = compact(rowLabel(tertiary), 110)

  let question = ''
  let expected = ''
  let required = [sourceA.document_id]
  let rejected = [sourceC.document_id]
  let challenge = {}
  let extraDocs = []

  if (category === 'multi-hop synthesis') {
    question = `Find the two dossiers whose search phrases are about "${primaryClue}" and "${secondaryClue}". Return their short results as "first => second", in that clue order.`
    expected = `${primaryAnswer} => ${secondaryAnswer}`
    required = [sourceA.document_id, sourceB.document_id]
    challenge = { type: 'two_source_join', required_order: ['primary', 'secondary'] }
  } else if (category === 'stale-vs-current document conflicts') {
    sourceA.text = `${sourceA.text}\nRecord date: 2024-08-15.\nRevision: continuing archive entry.`
    sourceB.text = `${sourceB.text}\nRecord date: 2018-03-02.\nRevision: earlier archive entry.`
    question = `Two dossiers match these search phrases: "${primaryClue}" and "${secondaryClue}". Resolve the stale/current conflict and return the latest controlling short result.`
    expected = primaryAnswer
    required = [sourceA.document_id, sourceB.document_id]
    rejected = [sourceB.document_id, sourceC.document_id]
    challenge = { type: 'stale_current_conflict', rule: 'newer dated record controls over superseded older record' }
  } else if (category === 'appended document lifecycle changes') {
    sourceA.text = `${sourceA.text}\nDocument part: Appendix B.\nFiled after: main body.`
    sourceB.text = `${sourceB.text}\nDocument part: Main body.\nFiled before: Appendix B.`
    question = `Two dossiers match these search phrases: "${secondaryClue}" and "${primaryClue}". Inspect the original body and appended update; return the final controlling short result.`
    expected = primaryAnswer
    required = [sourceA.document_id, sourceB.document_id]
    rejected = [sourceB.document_id, sourceC.document_id]
    challenge = { type: 'document_lifecycle_appendix', rule: 'appendix update controls over original body' }
  } else if (category === 'table + text reasoning') {
    sourceA.text = `${sourceA.text}\nDataset alias for task: collection-${stableHash(primary.source_dataset).slice(0, 6)}.`
    question = `Find the table or QA dossier whose search phrase is about "${primaryClue}" and return "short result @ collection alias".`
    expected = `${primaryAnswer} @ collection-${stableHash(primary.source_dataset).slice(0, 6)}`
    challenge = { type: 'table_text_join', required_fields: ['answer', 'source_dataset'] }
  } else if (category === 'source authority conflicts') {
    sourceA.text = `${sourceA.text}\nReview status: signed research review.\nPublisher note: curated editorial record.`
    sourceB.text = `${sourceB.text}\nReview status: open community note.\nPublisher note: informal summary record.`
    question = `Two dossiers match these search phrases: "${primaryClue}" and "${secondaryClue}". Resolve the authority conflict and return the short result from the highest-authority source.`
    expected = primaryAnswer
    required = [sourceA.document_id, sourceB.document_id]
    rejected = [sourceB.document_id, sourceC.document_id]
    challenge = { type: 'authority_conflict', authority_order: ['expert reviewed source', 'community summary'] }
  } else if (category === 'evidence insufficiency / abstention') {
    question = `For the search phrase "${primaryClue}", determine whether two independent dossiers confirm the same short result. Return ABSTAIN if only one relevant dossier exists, and cite the inspected relevant dossier.`
    expected = 'ABSTAIN'
    required = [sourceA.document_id]
    rejected = [sourceA.document_id, sourceC.document_id]
    challenge = { type: 'insufficiency_probe', missing_evidence: ['second independent confirming source'] }
  } else if (category === 'citation supports fact but not conclusion') {
    question = `The dossier about "${primaryClue}" supports a local fact. Decide whether it proves a broader comparison with the dossier about "${secondaryClue}". Return ABSTAIN if the citation supports only the local fact, and cite inspected dossiers.`
    expected = 'ABSTAIN'
    required = [sourceA.document_id, sourceB.document_id]
    rejected = [sourceA.document_id, sourceB.document_id, sourceC.document_id]
    challenge = { type: 'citation_overreach_probe', supported_fact: primaryAnswer, unsupported_conclusion: secondaryAnswer }
  } else if (category === 'entity disambiguation') {
    question = `Choose the dossier whose search phrase is about "${primaryClue}", not nearby distractors such as "${distractorClue}". Return its short result.`
    expected = primaryAnswer
    challenge = { type: 'entity_disambiguation', rule: 'choose locator-matching record, reject distractors' }
  } else if (category === 'temporal questions: as of date X') {
    const asOf = `202${index % 5}-12-31`
    sourceA.text = `${sourceA.text}\nRecord date: ${asOf}.`
    sourceB.text = `${sourceB.text}\nRecord date: 2029-01-01.`
    question = `Two dossiers match these search phrases: "${primaryClue}" and "${secondaryClue}". Answer as of ${asOf}; exclude later records.`
    expected = primaryAnswer
    required = [sourceA.document_id, sourceB.document_id]
    rejected = [sourceB.document_id, sourceC.document_id]
    challenge = { type: 'as_of_date_constraint', as_of_date: asOf, rule: 'exclude records after the as-of date' }
  } else if (category === 'cross-document contradiction') {
    sourceA.text = `${sourceA.text}\nReview status: signed research review.`
    sourceB.text = `${sourceB.text}\nReview status: signed research review.`
    question = `Inspect the same-authority dossiers matching search phrases "${primaryClue}" and "${secondaryClue}". If their short results disagree and no date or authority rule resolves them, return CONFLICT and cite both dossiers.`
    expected = 'CONFLICT'
    required = [sourceA.document_id, sourceB.document_id]
    rejected = [sourceC.document_id]
    challenge = { type: 'cross_document_contradiction', rule: 'same-authority disagreement requires CONFLICT' }
  }

  const goldDocs = [sourceA, sourceB, ...extraDocs]
  const documents = [...goldDocs, sourceC]
  const usedIds = new Set(documents.map((document) => document.document_id))
  let cursor = index * 19
  while (documents.length < DOCS_PER_TASK) {
    const row = allRows[cursor % allRows.length]
    if (row.global_source_key === primary.global_source_key || row.global_source_key === secondary.global_source_key || row.global_source_key === tertiary.global_source_key) {
      cursor += 1
      continue
    }
    const doc = sourceDocument(row, 'distractor', index, `d${documents.length}`)
    if (!usedIds.has(doc.document_id)) {
      documents.push(doc)
      usedIds.add(doc.document_id)
    }
    cursor += 1
  }

  return {
    task_id: taskId,
    suite_id: 'agentic-large-corpus-research-v7-candidate',
    category,
    user_question: question,
    target: {
      native_question: question,
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
      provenance: {
        source_type: document.provenance.source_type,
        package_policy: document.provenance.package_policy,
        content_hash: document.provenance.content_hash,
        provenance_hash: stableHash(
          [
            document.provenance.source_dataset,
            document.provenance.source_row_id,
            document.provenance.hf_row_idx,
            document.provenance.viewer,
          ].join('|'),
        ),
      },
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
const answerFrequencies = new Map()
for (const row of allRows) {
  const answer = normalizedAnswer(row)
  if (!answer) continue
  answerFrequencies.set(answer, (answerFrequencies.get(answer) || 0) + 1)
}
for (const row of allRows) row.answer_frequency = answerFrequencies.get(normalizedAnswer(row)) || 0
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
  audit_id: 'agentic-v7-candidate-audit',
  suite_id: 'agentic-large-corpus-research-v7-candidate',
  checked_date: '2026-06-26',
  buyer_ready: false,
  status: 'candidate_not_buyer_ready',
  reason:
    'This v7 candidate removes v4 marker/role shortcuts, but still needs shallow-retrieval rejection, evidence-contract review, and frontier-agent reruns before buyer-grade claims.',
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
    'Run current Codex CLI and Claude Code over the v7 candidate workspaces after shallow-baseline filtering.',
  ],
}

const suite = {
  benchmark_id: 'hard-grounded-research-benchmark',
  suite_id: 'agentic-large-corpus-research-v7-candidate',
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
    `# Agentic V7 Candidate Task\n\n${task.user_question}\n\nUse only this workspace. Search corpus.json, cite exact document_id values, and write answer.json.\n`,
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
  `# Agentic V7 Candidate Suite

This candidate suite removes the v4 exact marker and public role-label shortcuts.

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
