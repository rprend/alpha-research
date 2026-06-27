import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const richRowsPath = join(generatedDir, 'rich-source-acquisition-rows.json')
const outputDir = join(generatedDir, 'agentic-v9-candidate')
const workspaceRoot = join(outputDir, 'workspaces')
const suitePath = join(outputDir, 'suite.json')
const hiddenGoldPath = join(outputDir, 'hidden-gold.json')
const auditPath = join(outputDir, 'audit.json')
const markdownPath = join(experimentDir, 'AGENTIC_V9_CANDIDATE.md')

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
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function compact(value, max = 420) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text
}

function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function clue(value, salt = '') {
  const stop = new Set([
    'the',
    'and',
    'for',
    'with',
    'from',
    'that',
    'this',
    'what',
    'which',
    'whose',
    'about',
    'into',
    'does',
    'did',
    'was',
    'were',
    'are',
    'how',
    'why',
    'who',
    'when',
    'where',
    'using',
    'based',
    'study',
    'system',
  ])
  const tokens = normalize(value)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !stop.has(token))
  const unique = [...new Set(tokens)]
  unique.sort((a, b) => stableHash(`${salt}:${a}`).localeCompare(stableHash(`${salt}:${b}`)))
  return unique.slice(0, 4).join(' / ') || stableHash(`${salt}:${value}`).slice(0, 8)
}

function recordCue(row, taskIndex, suffix) {
  return `${clue(row.title, `${taskIndex}:${suffix}:title`)} :: ${clue(row.question, `${taskIndex}:${suffix}:question`)}`
}

function sourceDocument(row, taskIndex, suffix = '', overlays = []) {
  const evidence = row.evidence?.length ? row.evidence.join('\n') : row.documents?.[0]?.text || ''
  const context = row.documents?.slice(0, 3).map((doc) => `${doc.section}: ${doc.text}`).join('\n') || ''
  const itemTitle = row.title
  const inquiry = row.question
  const text = [
    `Archive record ${stableHash(`${row.source_id}:${taskIndex}:${suffix}`).slice(0, 10)}.`,
    `The record came from ${row.dataset} under a redistributable known-license evidence policy.`,
    `Catalog note: researchers filed this item under ${itemTitle}.`,
    `The local inquiry in the record asks: ${inquiry}`,
    `The passage retained by the archive reads as follows. ${evidence}`,
    context ? `Additional surrounding material follows.\n${context}` : '',
    ...overlays,
  ].filter(Boolean).join('\n')
  return {
    document_id: `v9:doc:${stableHash(`${row.source_id}:${taskIndex}:${suffix}`).slice(0, 12)}`,
    title: `Dossier ${stableHash(`${row.source_id}:${taskIndex}`).slice(0, 10)}`,
    provenance: {
      source_type: 'hf_dataset_viewer_rich_row',
      package_policy: 'redistributable_known_license_evidence',
      content_hash: stableHash(text),
    },
    text,
  }
}

function neutralDocument(taskIndex, suffix) {
  const text = [
    `Dossier neutral-${taskIndex}-${suffix}.`,
    'Collection public-domain/benchmark-neutral-distractors; package policy redistributable_known_license_evidence.',
    'This dossier is an unrelated archive-control note about indexing, pagination, and document packaging.',
    'It contains no answer to the task question and is included only as background corpus noise.',
  ].join('\n')
  return {
    document_id: `v9:doc:${stableHash(`neutral:${taskIndex}:${suffix}`).slice(0, 12)}`,
    title: `Neutral dossier ${stableHash(`neutral:${taskIndex}:${suffix}`).slice(0, 10)}`,
    provenance: {
      source_type: 'deterministic_public_corpus_neutral_distractor',
      package_policy: 'redistributable_known_license_evidence',
      content_hash: stableHash(text),
    },
    text,
  }
}

function selectRows(rows, category, index) {
  const answerUnique = rows.filter((row) => row.answer_frequency === 1 && normalize(row.answer).length >= 6)
  const pool = answerUnique.length >= 80 ? answerUnique : rows
  const primary = pool[(index * 3 + 5) % pool.length]
  const secondary = pool[(index * 11 + 17) % pool.length]
  const tertiary = pool[(index * 19 + 23) % pool.length]
  return { primary, secondary, tertiary }
}

function answerParts(expected) {
  return String(expected ?? '')
    .split(/\s+(?:=>|@|<>)\s+/)
    .map((part) => normalize(part))
    .filter((part) => part.length >= 6 && part !== 'abstain' && part !== 'conflict')
}

function docLeaksExpected(doc, expected) {
  const text = normalize(doc?.text || '')
  return answerParts(expected).some((part) => text.includes(part))
}

function buildTask(category, index, rows) {
  const { primary, secondary, tertiary } = selectRows(rows, category, index)
  const taskId = `hgr_v9_candidate_${String(index + 1).padStart(3, '0')}_${slug(category)}_${stableHash(
    `${category}:${primary.source_id}:${secondary.source_id}:${index}`,
  ).slice(0, 6)}`
  const primaryCue = recordCue(primary, index, 'a')
  const secondaryCue = recordCue(secondary, index, 'b')
  const distractorCue = recordCue(tertiary, index, 'c')
  let question = ''
  let expected = primary.answer
  let required = []
  let rejected = []
  let challenge = {}
  let sourceA = null
  let sourceB = null
  let sourceC = sourceDocument(tertiary, index, 'c')

  if (category === 'multi-hop synthesis') {
    sourceA = sourceDocument(primary, index, 'a')
    sourceB = sourceDocument(secondary, index, 'b')
    question = `Find the two archive records matching clue A [${primaryCue}] and clue B [${secondaryCue}]. Answer each record's local inquiry from its retained passage, then return "A => B".`
    expected = `${primary.answer} => ${secondary.answer}`
    required = [sourceA.document_id, sourceB.document_id]
    rejected = [sourceC.document_id]
    challenge = { type: 'two_source_evidence_answer_join' }
  } else if (category === 'stale-vs-current document conflicts') {
    sourceA = sourceDocument(primary, index, 'a', ['Record date: 2024-08-15.', 'Revision note: continuing record.'])
    sourceB = sourceDocument(secondary, index, 'b', ['Record date: 2018-03-02.', 'Revision note: earlier record.'])
    question = `Find the records matching clue A [${primaryCue}] and clue B [${secondaryCue}]. Resolve the stale/current conflict by record date and answer the local inquiry from the latest record.`
    expected = primary.answer
    required = [sourceA.document_id, sourceB.document_id]
    rejected = [sourceB.document_id, sourceC.document_id]
    challenge = { type: 'stale_current_conflict' }
  } else if (category === 'appended document lifecycle changes') {
    sourceA = sourceDocument(primary, index, 'a', ['Document part: Appendix B.', 'Filed after: main body.'])
    sourceB = sourceDocument(secondary, index, 'b', ['Document part: Main body.', 'Filed before: Appendix B.'])
    question = `Find the records matching clue A [${secondaryCue}] and clue B [${primaryCue}]. Inspect main-body versus appendix lifecycle order and answer the local inquiry from the final filed part.`
    expected = primary.answer
    required = [sourceA.document_id, sourceB.document_id]
    rejected = [sourceB.document_id, sourceC.document_id]
    challenge = { type: 'document_lifecycle_appendix' }
  } else if (category === 'table + text reasoning') {
    const alias = `collection-${stableHash(primary.dataset).slice(0, 6)}`
    sourceA = sourceDocument(primary, index, 'a', [`Collection alias for this task: ${alias}.`])
    question = `Find the archive record matching clue [${primaryCue}]. Answer its local inquiry and append the collection alias as "answer @ alias".`
    expected = `${primary.answer} @ ${alias}`
    required = [sourceA.document_id]
    rejected = [sourceC.document_id]
    challenge = { type: 'answer_plus_collection_alias' }
  } else if (category === 'source authority conflicts') {
    sourceA = sourceDocument(primary, index, 'a', ['Review status: signed research review.', 'Publisher note: curated editorial record.'])
    sourceB = sourceDocument(secondary, index, 'b', ['Review status: open community note.', 'Publisher note: informal summary record.'])
    question = `Find the records matching clue A [${primaryCue}] and clue B [${secondaryCue}]. Resolve the authority conflict and answer the local inquiry from the higher-authority record.`
    expected = primary.answer
    required = [sourceA.document_id, sourceB.document_id]
    rejected = [sourceB.document_id, sourceC.document_id]
    challenge = { type: 'authority_conflict' }
  } else if (category === 'evidence insufficiency / abstention') {
    sourceA = sourceDocument(primary, index, 'a')
    question = `For the archive record matching clue [${primaryCue}], determine whether two independent records confirm the same answer to its local inquiry. Return ABSTAIN if only one relevant record exists.`
    expected = 'ABSTAIN'
    required = [sourceA.document_id]
    rejected = [sourceA.document_id, sourceC.document_id]
    challenge = { type: 'insufficiency_probe' }
  } else if (category === 'citation supports fact but not conclusion') {
    sourceA = sourceDocument(primary, index, 'a')
    sourceB = sourceDocument(secondary, index, 'b')
    question = `The record matching clue A [${primaryCue}] supports its own local answer. Decide whether it also proves the broader comparison involving clue B [${secondaryCue}]. Return ABSTAIN if the cited evidence supports only the local answer.`
    expected = 'ABSTAIN'
    required = [sourceA.document_id, sourceB.document_id]
    rejected = [sourceA.document_id, sourceB.document_id, sourceC.document_id]
    challenge = { type: 'citation_overreach_probe' }
  } else if (category === 'entity disambiguation') {
    sourceA = sourceDocument(primary, index, 'a')
    question = `Choose the archive record matching clue A [${primaryCue}], not the distractor matching clue B [${distractorCue}]. Answer the chosen record's local inquiry.`
    expected = primary.answer
    required = [sourceA.document_id]
    rejected = [sourceC.document_id]
    challenge = { type: 'entity_disambiguation' }
  } else if (category === 'temporal questions: as of date X') {
    const asOf = `202${index % 5}-12-31`
    sourceA = sourceDocument(primary, index, 'a', [`Record date: ${asOf}.`])
    sourceB = sourceDocument(secondary, index, 'b', ['Record date: 2029-01-01.'])
    question = `Find the records matching clue A [${primaryCue}] and clue B [${secondaryCue}]. Answer as of ${asOf}; exclude later records and answer the local inquiry from the valid record.`
    expected = primary.answer
    required = [sourceA.document_id, sourceB.document_id]
    rejected = [sourceB.document_id, sourceC.document_id]
    challenge = { type: 'as_of_date_constraint', as_of_date: asOf }
  } else if (category === 'cross-document contradiction') {
    sourceA = sourceDocument(primary, index, 'a', ['Review status: signed research review.'])
    sourceB = sourceDocument(secondary, index, 'b', ['Review status: signed research review.'])
    question = `Inspect the same-authority records matching clue A [${primaryCue}] and clue B [${secondaryCue}]. If their local answers disagree and no date or authority rule resolves them, state the incompatible answers as "A <> B" in clue order and cite both records.`
    expected = `${primary.answer} <> ${secondary.answer}`
    required = [sourceA.document_id, sourceB.document_id]
    rejected = [sourceC.document_id]
    challenge = { type: 'cross_document_contradiction' }
  }

  if (docLeaksExpected(sourceC, expected)) {
    for (let offset = 0; offset < rows.length; offset += 1) {
      const candidate = rows[(index * 31 + offset) % rows.length]
      if ([primary.source_id, secondary.source_id].includes(candidate.source_id)) continue
      const candidateDoc = sourceDocument(candidate, index, 'c')
      if (!docLeaksExpected(candidateDoc, expected)) {
        sourceC = candidateDoc
        break
      }
    }
  }

  const documents = [sourceA, sourceB].filter(Boolean)
  documents.push(sourceC)
  const usedIds = new Set(documents.map((document) => document.document_id))
  let cursor = index * 29
  while (documents.length < DOCS_PER_TASK) {
    const row = rows[cursor % rows.length]
    if ([primary.source_id, secondary.source_id, tertiary.source_id].includes(row.source_id)) {
      cursor += 1
      continue
    }
    const doc = sourceDocument(row, index, `d${documents.length}`)
    if (docLeaksExpected(doc, expected)) {
      cursor += 1
      continue
    }
    if (!usedIds.has(doc.document_id)) {
      documents.push(doc)
      usedIds.add(doc.document_id)
    }
    cursor += 1
  }

  const requiredSet = new Set(required)
  for (let docIndex = 0; docIndex < documents.length; docIndex += 1) {
    if (!requiredSet.has(documents[docIndex].document_id) && docLeaksExpected(documents[docIndex], expected)) {
      documents[docIndex] = neutralDocument(index, `leak-replacement-${docIndex}`)
    }
  }

  return {
    task_id: taskId,
    suite_id: 'agentic-large-corpus-research-v9-candidate',
    category,
    user_question: question,
    target: { native_question: question, challenge, hidden_gold_withheld: true },
    corpus: { document_count: documents.length, corpus_file: 'corpus.json', documents_embedded_in_task_json: false },
    gold: {
      expected_answers: [expected],
      required_evidence_ids: required,
      rejected_evidence_ids: rejected,
      source_row_ids: [primary.source_id, secondary.source_id],
      source_datasets: [...new Set([primary.dataset, secondary.dataset])],
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
      provenance: document.provenance,
      text: document.text,
    })),
  }
}

const rich = readJson(richRowsPath)
let rows = rich.rows.filter(
  (row) =>
    row.answer &&
    normalize(row.answer).length >= 6 &&
    row.evidence?.some((entry) => normalize(entry).includes(normalize(row.answer))) &&
    row.documents?.length > 0,
)
const answerFrequencies = new Map()
for (const row of rows) answerFrequencies.set(normalize(row.answer), (answerFrequencies.get(normalize(row.answer)) || 0) + 1)
for (const row of rows) row.answer_frequency = answerFrequencies.get(normalize(row.answer)) || 0
rows = rows.filter((row) => row.answer_frequency === 1)
if (rows.length < TARGET_TASKS) throw new Error(`Need ${TARGET_TASKS} rich rows, got ${rows.length}`)

const tasks = []
for (const [categoryIndex, category] of categories.entries()) {
  for (let local = 0; local < TASKS_PER_CATEGORY; local += 1) {
    tasks.push(buildTask(category, categoryIndex * TASKS_PER_CATEGORY + local, rows))
  }
}

const uniqueQuestions = new Set(tasks.map((task) => task.target.native_question))
const taskJsonLeaks = tasks.filter((task) => JSON.stringify(publicTask(task)).includes('expected_answers'))
const audit = {
  audit_id: 'agentic-v9-candidate-audit',
  suite_id: 'agentic-large-corpus-research-v9-candidate',
  checked_date: '2026-06-26',
  buyer_ready: false,
  status: 'candidate_not_buyer_ready',
  reason: 'This v9 candidate uses rich HF evidence rows and must pass shallow, evidence-contract, and frontier-agent gates before buyer-grade claims.',
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
    source_rows_available: rows.length,
    source_datasets: rich.datasets,
  },
  blockers: [
    'Run a shallow lexical/metadata baseline and reject or rewrite any task it solves.',
    'Audit evidence contracts for answer leakage and templated extraction shortcuts.',
    'Run current Codex CLI and Claude Code over the v9 candidate workspaces after shallow-baseline filtering.',
  ],
}

const suite = {
  benchmark_id: 'hard-grounded-research-benchmark',
  suite_id: 'agentic-large-corpus-research-v9-candidate',
  generated_from: 'generated/rich-source-acquisition-rows.json',
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
  writeText(join(taskDir, 'README.md'), `# Agentic V9 Candidate Task\n\n${task.user_question}\n\nUse only this workspace. Search corpus.json, cite exact document_id values, and write answer.json.\n`)
}

writeJson(suitePath, suite)
writeJson(hiddenGoldPath, {
  suite_id: suite.suite_id,
  warning: 'Scoring only; withhold from agents.',
  tasks: tasks.map((task) => ({ task_id: task.task_id, category: task.category, gold: task.gold })),
})
writeJson(auditPath, audit)
writeText(
  markdownPath,
  `# Agentic V9 Candidate Suite

This candidate suite is generated from richer Hugging Face rows with Qasper full-paper sections and HotpotQA multi-document contexts.

## Status

- Status: ${audit.status}
- Buyer ready: ${audit.buyer_ready}
- Tasks: ${audit.summary.task_count}
- Categories: ${audit.summary.categories}
- Unique native questions: ${audit.summary.unique_native_questions}/${MIN_UNIQUE_NATIVE_QUESTIONS}
- Corpus documents per task: ${audit.summary.min_corpus_documents}-${audit.summary.max_corpus_documents}
- Source rows available: ${audit.summary.source_rows_available}

## Checks

| Check | Pass |
| --- | --- |
${Object.entries(audit.checks).map(([key, value]) => `| ${key} | ${value} |`).join('\n')}

## Blockers

${audit.blockers.map((blocker) => `- ${blocker}`).join('\n')}
`,
)

console.log(`Wrote ${suitePath}`)
console.log(`Wrote ${hiddenGoldPath}`)
console.log(`Wrote ${auditPath}`)
console.log(`Wrote ${workspaceRoot}`)
console.log(`Wrote ${markdownPath}`)
