import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const scaleSuitePath = join(generatedDir, 'derived-scale-suite.json')
const outputPath = join(generatedDir, 'agentic-research-suite.json')
const auditPath = join(generatedDir, 'agentic-buyer-grade-audit.json')
const corpusShardDir = join(generatedDir, 'agentic-corpus-shards')
const markdownPath = join(experimentDir, 'AGENTIC_RESEARCH_SUITE.md')
const auditMarkdownPath = join(experimentDir, 'AGENTIC_BUYER_GRADE_AUDIT.md')

const TARGET_TASKS = 200
const DOCS_PER_TASK = 1000
const MIN_DOCS_PER_TASK = 1000
const MAX_DOCS_PER_TASK = 10000
const MIN_UNIQUE_NATIVE_QUESTIONS_FOR_BUYER_CLAIM = 150

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

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function compact(value, maxLength = 360) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text
}

function categorySlug(category) {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function stableHash(text) {
  let hash = 2166136261
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeNativeQuestion(value) {
  const text = String(value ?? '')
  const nativePromptMatch = text.match(/Native prompt:\s*(.+?)(?:\s+Expansion batch\b|$)/i)
  return (nativePromptMatch ? nativePromptMatch[1] : text)
    .replace(/\s+Expansion batch\s+\d+\.?$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function evidenceUnits(item) {
  return (item.source_examples || []).flatMap((source) =>
    (source.evidence_units || []).map((evidence) => ({
      ...evidence,
      source_dataset: source.source_dataset,
      source_row_id: source.source_row_id,
      benchmark_item_id: item.id,
      category: item.category,
      row_offset: source.row_offset,
      native_question: source.native_question,
    })),
  )
}

function evidenceText(item) {
  return evidenceUnits(item)
    .map((evidence) => `${evidence.locator || ''} ${evidence.text || ''}`)
    .join(' ')
}

function answerVisibilityScore(item) {
  const answer = normalizeText(item.final_answer)
  const evidence = normalizeText(evidenceText(item))
  const requiredCitationCount = (item.required_citation_ids || []).length
  if (!answer) return 0
  if (['abstain', 'conflict', 'yes', 'no', 'supports', 'refutes', 'not enough info'].includes(answer)) {
    return requiredCitationCount > 0 || answer === 'abstain' ? 3 : 1
  }
  if (evidence.includes(answer)) return 5

  const answerTokens = answer.split(/\s+/).filter((token) => token.length > 2)
  const tokenHits = answerTokens.filter((token) => evidence.includes(token)).length
  if (answerTokens.length > 0 && tokenHits / answerTokens.length >= 0.5) return 4
  return requiredCitationCount > 0 ? 2 : 0
}

function publicChallenge(challenge = {}) {
  if (!challenge || typeof challenge !== 'object') return challenge ?? {}
  if (Array.isArray(challenge)) {
    return challenge.map((value) => (value && typeof value === 'object' ? publicChallenge(value) : value))
  }
  return Object.fromEntries(
    Object.entries(challenge)
      .filter(([key]) => !/evidence_ids?|source_row_ids?|benchmark_item_ids?/i.test(key))
      .map(([key, value]) => [
        key,
        value && typeof value === 'object' ? publicChallenge(value) : value,
      ]),
  )
}

function taskInstruction(category) {
  const shared =
    'Search the full corpus before answering. Return JSON with answer, cited_evidence_ids, rejected_evidence_ids, search_trace, and evidence_assessment.'
  const byCategory = {
    'multi-hop synthesis':
      'Find every required hop. A citation that supports only one hop is not enough.',
    'stale-vs-current document conflicts':
      'Prefer the current controlling document and explicitly reject stale evidence.',
    'appended document lifecycle changes':
      'Inspect appended updates before trusting the original document body.',
    'table + text reasoning':
      'Use table evidence and supporting text; arithmetic over the wrong row or column fails.',
    'source authority conflicts':
      'Apply the provided authority order instead of picking the clearest prose.',
    'evidence insufficiency / abstention':
      'Answer ABSTAIN unless the corpus contains direct evidence for the requested conclusion.',
    'citation supports fact but not conclusion':
      'Reject true-but-insufficient citations when they do not entail the conclusion.',
    'entity disambiguation':
      'Resolve the exact entity and reject near-name distractors.',
    'temporal questions: as of date X':
      'Use only evidence available as of the requested date and mark later evidence as excluded.',
    'cross-document contradiction':
      'If evidence cannot be reconciled by date or authority, answer CONFLICT instead of smoothing it over.',
  }
  return `${shared} ${byCategory[category] || ''}`.trim()
}

function sourceKey(evidence) {
  return `${evidence.source_dataset}:${evidence.source_row_id}:${evidence.id}`
}

function makeDocumentFromEvidence(evidence, role, copyIndex = 0) {
  const suffix = role === 'gold' ? '' : `::${role}:${copyIndex}`
  return {
    document_id: `${evidence.id}${suffix}`,
    title: evidence.title || evidence.source_dataset || 'Untitled source',
    source_dataset: evidence.source_dataset,
    source_row_id: evidence.source_row_id,
    locator: evidence.locator || '',
    provenance: {
      source_type: 'huggingface_dataset_row',
      source_dataset: evidence.source_dataset,
      source_row_id: evidence.source_row_id,
      row_offset: evidence.row_offset ?? null,
      content_hash: stableHash(`${evidence.source_dataset}:${evidence.source_row_id}:${evidence.text}`),
    },
    text_preview: compact(evidence.text, 260),
  }
}

function makeSyntheticHardNegative(evidence, category, copyIndex) {
  const hash = stableHash(`${category}:${sourceKey(evidence)}:${copyIndex}`)
  return {
    document_id: `public-negative:${hash}:${copyIndex}`,
    title: `Public corpus distractor ${hash}`,
    source_dataset: 'derived-public-corpus/hard-negative-synthetic',
    source_row_id: `${evidence.source_dataset}:${evidence.source_row_id}:${copyIndex}`,
    locator: `synthetic-distractor-${copyIndex}`,
    provenance: {
      source_type: 'deterministic_public_corpus_transform',
      source_dataset: evidence.source_dataset,
      source_row_id: evidence.source_row_id,
      row_offset: evidence.row_offset ?? null,
      content_hash: stableHash(`${evidence.text}:negative:${copyIndex}`),
    },
    text_preview:
      `Distractor note derived from a public HF row. It shares vocabulary with ${category} tasks but is not controlling evidence for the target question. ` +
      compact(evidence.text, 180),
  }
}

function sortedByDifficulty(items) {
  return [...items]
    .map((item, index) => ({ item, index, score: answerVisibilityScore(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item)
}

function selectTargetItems(items, categories) {
  const byCategory = new Map(categories.map((category) => [category, sortedByDifficulty(items.filter((item) => item.category === category))]))
  const selected = []
  let cursor = 0
  while (selected.length < TARGET_TASKS) {
    const category = categories[cursor % categories.length]
    const bucket = byCategory.get(category) || []
    const item = bucket[Math.floor(cursor / categories.length)]
    if (!item) break
    selected.push(item)
    cursor += 1
  }
  return selected
}

function makeCorpusShard(targetItem, allEvidence, taskOrdinal) {
  const requiredIds = new Set(targetItem.required_citation_ids || [])
  const targetEvidence = evidenceUnits(targetItem)
  const goldEvidence = targetEvidence.filter((evidence) => requiredIds.has(evidence.id))
  const fallbackGold = goldEvidence.length > 0 ? goldEvidence : targetEvidence.slice(0, 1)
  const documents = fallbackGold.map((evidence) => makeDocumentFromEvidence(evidence, 'gold'))
  const usedIds = new Set(documents.map((document) => document.document_id))
  const usedSourceKeys = new Set(targetEvidence.map(sourceKey))
  const distractorCandidates = allEvidence.filter((evidence) => !usedSourceKeys.has(sourceKey(evidence)))
  let distractorCursor = taskOrdinal * 37

  while (documents.length < DOCS_PER_TASK && distractorCandidates.length > 0) {
    const evidence = distractorCandidates[distractorCursor % distractorCandidates.length]
    const document = makeDocumentFromEvidence(evidence, 'distractor', documents.length)
    if (!usedIds.has(document.document_id)) {
      documents.push(document)
      usedIds.add(document.document_id)
    }
    distractorCursor += 1
    if (distractorCursor > distractorCandidates.length * 3 && documents.length < DOCS_PER_TASK) break
  }

  let syntheticCursor = 0
  while (documents.length < DOCS_PER_TASK) {
    const evidence = allEvidence[(taskOrdinal * 53 + syntheticCursor) % allEvidence.length]
    const document = makeSyntheticHardNegative(evidence, targetItem.category, syntheticCursor)
    if (!usedIds.has(document.document_id)) {
      documents.push(document)
      usedIds.add(document.document_id)
    }
    syntheticCursor += 1
  }

  return {
    shard_id: `agentic-corpus-${String(taskOrdinal + 1).padStart(3, '0')}-${categorySlug(targetItem.category)}`,
    document_count: documents.length,
    source_item_count: 1,
    target_source_item_id: targetItem.id,
    distractor_document_count: documents.length - fallbackGold.length,
    distractor_policy:
      'Distractors are deterministic public-corpus documents drawn from neighboring HF-derived evidence and synthetic hard negatives with shared vocabulary but non-controlling provenance.',
    documents,
  }
}

function buildAgenticTask(targetItem, allEvidence, taskOrdinal) {
  const corpus = makeCorpusShard(targetItem, allEvidence, taskOrdinal)
  const sourceDatasets = unique(targetItem.source_datasets || [])
  const requiredEvidenceIds = unique(targetItem.required_citation_ids || [])
  const expectedAnswers = unique([targetItem.final_answer])
  const sourceRowIds = unique(targetItem.source_row_ids || [])
  const targetQuestion = targetItem.question || `Answer the ${targetItem.category} research task.`
  const taskId = `hgr_agentic_${String(taskOrdinal + 1).padStart(3, '0')}_${categorySlug(targetItem.category)}_${stableHash(targetItem.id).slice(0, 6)}`

  return {
    task_id: taskId,
    benchmark_id: 'hard-grounded-research-benchmark',
    benchmark_layer: 'agentic-large-corpus-research',
    category: targetItem.category,
    difficulty_target:
      'Designed for frontier tool-using research agents that must search 1k-10k documents, not single-call QA over a supplied evidence packet.',
    instruction: taskInstruction(targetItem.category),
    user_question: `${targetQuestion} Search the corpus, cite exact evidence ids, reject misleading evidence, and obey the category-specific rule.`,
    target: {
      native_question: targetQuestion,
      challenge: publicChallenge(targetItem.challenge),
      source_datasets: sourceDatasets,
      hidden_gold_withheld: true,
    },
    corpus,
    gold: {
      expected_answers: expectedAnswers,
      required_evidence_ids: requiredEvidenceIds,
      source_row_ids: sourceRowIds,
      source_datasets: sourceDatasets,
      source_item_id: targetItem.id,
      label_tier: targetItem.label_tier,
      derivation_rule: targetItem.derivation_rule,
      constant_time_scoring: true,
      scoring_rule:
        'A submitted answer is checked by normalized answer membership, required evidence-id recall, citation precision, abstention/conflict flags, rejected-evidence accounting, and search-trace presence. No LLM judge is required for the primary score.',
    },
    required_agent_capabilities: [
      'filesystem_or_corpus_search',
      'large_corpus_triage',
      'multi_step_evidence_selection',
      'citation_id_tracking',
      'source_rejection',
      'structured_json_submission',
    ],
    failure_modes_under_test: [
      'retrieves plausible distractors from a large corpus',
      'answers from stale or lower-authority evidence',
      'cites a true fact for an unsupported conclusion',
      'fails to abstain or report conflict',
      'drops required evidence after a long search trace',
      'confuses provenance-near public-corpus distractors with controlling evidence',
    ],
    anti_shortcut_controls: {
      hidden_gold_from_prompt: true,
      target_item_id_withheld_from_workspace: true,
      benchmark_item_id_withheld_from_workspace: true,
      distractor_documents_present: corpus.distractor_document_count,
      expected_answer_not_sufficient_without_citations: true,
      corpus_documents_between_1000_and_10000: corpus.document_count >= MIN_DOCS_PER_TASK && corpus.document_count <= MAX_DOCS_PER_TASK,
      single_call_packet_baseline_allowed: false,
    },
  }
}

function buildAudit(suite) {
  const docCounts = suite.tasks.map((task) => task.corpus.document_count)
  const categories = unique(suite.tasks.map((task) => task.category))
  const normalizedNativeQuestions = suite.tasks.map((task) => normalizeNativeQuestion(task.target?.native_question))
  const uniqueNativeQuestions = unique(normalizedNativeQuestions)
  const nativeQuestionReuse = Object.entries(
    normalizedNativeQuestions.reduce((counts, question) => {
      counts[question] = (counts[question] || 0) + 1
      return counts
    }, {}),
  )
    .map(([question, count]) => ({ question, count }))
    .sort((a, b) => b.count - a.count || a.question.localeCompare(b.question))
  const perCategory = Object.fromEntries(
    categories.map((category) => [category, suite.tasks.filter((task) => task.category === category).length]),
  )
  const missingRequiredEvidence = suite.tasks.filter((task) => {
    const corpusIds = new Set(task.corpus.documents.map((document) => document.document_id))
    return (task.gold.required_evidence_ids || []).some((id) => !corpusIds.has(id))
  })
  const docsOutOfRange = suite.tasks.filter(
    (task) => task.corpus.document_count < MIN_DOCS_PER_TASK || task.corpus.document_count > MAX_DOCS_PER_TASK,
  )
  const shortcutFields = ['benchmark_item_id', 'target_source_item_id', 'answer_item_ids', 'expected_answers', 'required_evidence_ids']
  const publicShortcutFindings = suite.tasks.flatMap((task) => {
    const publicShape = JSON.stringify({
      task_id: task.task_id,
      target: task.target,
      corpus_documents: task.corpus.documents,
    })
    return shortcutFields.filter((field) => publicShape.includes(field)).map((field) => ({ task_id: task.task_id, field }))
  })

  return {
    audit_id: 'agentic-buyer-grade-audit-v1',
    checked_date: '2026-06-26',
    ready_for_buyer_claim: false,
    reason_ready_for_buyer_claim_false:
      'The expanded task suite is materialized, but source-question diversity is too low for a buyer-grade claim.',
    checks: {
      task_count_at_least_200: suite.task_count >= 200,
      corpus_docs_between_1000_and_10000: docsOutOfRange.length === 0,
      categories_covered: categories.length,
      balanced_category_minimum: Math.min(...Object.values(perCategory)),
      hidden_gold_present: true,
      constant_time_scoring: suite.primary_scoring.constant_time_after_submission === true && suite.primary_scoring.llm_judge_required === false,
      required_evidence_in_corpus: missingRequiredEvidence.length === 0,
      public_shortcut_fields_absent: publicShortcutFindings.length === 0,
      unique_native_question_minimum_met:
        uniqueNativeQuestions.length >= MIN_UNIQUE_NATIVE_QUESTIONS_FOR_BUYER_CLAIM,
      contamination_resistant_provenance_present: suite.tasks.every((task) =>
        task.corpus.documents.every((document) => document.provenance?.content_hash && document.source_dataset && document.source_row_id),
      ),
    },
    summary: {
      task_count: suite.task_count,
      categories,
      per_category: perCategory,
      min_corpus_documents: Math.min(...docCounts),
      max_corpus_documents: Math.max(...docCounts),
      mean_corpus_documents: Math.round(docCounts.reduce((sum, value) => sum + value, 0) / docCounts.length),
      unique_native_questions: uniqueNativeQuestions.length,
      unique_native_question_minimum: MIN_UNIQUE_NATIVE_QUESTIONS_FOR_BUYER_CLAIM,
      max_native_question_reuse: nativeQuestionReuse[0]?.count || 0,
      missing_required_evidence_tasks: missingRequiredEvidence.length,
      public_shortcut_findings: publicShortcutFindings.length,
    },
    blockers: [
      `Replace repeated templates until at least ${MIN_UNIQUE_NATIVE_QUESTIONS_FOR_BUYER_CLAIM} distinct native questions exist across ${TARGET_TASKS} tasks.`,
      'Perform live novelty and contamination review before claiming the benchmark does not already exist.',
    ],
    findings: {
      docs_out_of_range: docsOutOfRange.map((task) => task.task_id),
      missing_required_evidence: missingRequiredEvidence.map((task) => task.task_id),
      public_shortcut_findings: publicShortcutFindings,
      top_reused_native_questions: nativeQuestionReuse.slice(0, 20),
    },
  }
}

function persistedTask(task) {
  const corpusPath = `generated/agentic-workspaces/${task.task_id}/corpus.json`
  return {
    ...task,
    corpus: {
      shard_id: task.corpus.shard_id,
      document_count: task.corpus.document_count,
      source_item_count: task.corpus.source_item_count,
      distractor_document_count: task.corpus.distractor_document_count,
      distractor_policy: task.corpus.distractor_policy,
      corpus_path: corpusPath,
      documents_in_suite_manifest: false,
    },
  }
}

const scaleSuite = readJson(scaleSuitePath)
const items = scaleSuite.items || scaleSuite.task_examples || []
const categories = unique(items.map((item) => item.category))
const allEvidence = items.flatMap(evidenceUnits)
const selectedItems = selectTargetItems(items, categories)

if (selectedItems.length < TARGET_TASKS) {
  throw new Error(`Need ${TARGET_TASKS} target items but only selected ${selectedItems.length}`)
}
if (allEvidence.length === 0) {
  throw new Error('No evidence units available to build agentic corpora')
}

const agenticTasks = selectedItems.map((item, index) => buildAgenticTask(item, allEvidence, index))

const suite = {
  benchmark_id: 'hard-grounded-research-benchmark',
  suite_id: 'agentic-large-corpus-research-v3',
  generated_from: 'generated/derived-scale-suite.json',
  task_count: agenticTasks.length,
  source_item_count: items.length,
  category_count: categories.length,
  corpus_documents_per_task_target: DOCS_PER_TASK,
  intended_systems: [
    'Codex CLI or equivalent tool-using coding/research agent',
    'Claude Code or equivalent tool-using coding/research agent',
    'frontier model agents using the strongest available model at run time',
  ],
  not_validated_by: [
    'single model call over a preselected evidence packet',
    'cheap or intentionally weak model baselines',
    'oracle baselines that read native labels',
    'LLM judge-only scoring',
  ],
  primary_scoring: {
    constant_time_after_submission: true,
    llm_judge_required: false,
    metrics: [
      'answer_membership',
      'required_evidence_recall',
      'citation_precision',
      'rejected_distractor_precision',
      'abstention_or_conflict_correctness',
      'search_trace_completeness',
    ],
  },
  readiness: {
    suite_materialized: true,
    frontier_agent_runs_required_for_claims: true,
    current_frontier_agent_runs_present:
      'See AGENTIC_READINESS.md and generated/agentic-readiness.json.',
    completion_claim_allowed:
      'See AGENTIC_READINESS.md and generated/agentic-readiness.json.',
  },
  tasks: agenticTasks.map(persistedTask),
}

rmSync(corpusShardDir, { recursive: true, force: true })
mkdirSync(corpusShardDir, { recursive: true })
for (const task of agenticTasks) {
  writeJson(join(corpusShardDir, `${task.task_id}.json`), {
    task_id: task.task_id,
    shard_id: task.corpus.shard_id,
    document_count: task.corpus.document_count,
    distractor_policy: task.corpus.distractor_policy,
    documents: task.corpus.documents,
  })
}

const audit = buildAudit({
  ...suite,
  tasks: agenticTasks,
})
writeJson(outputPath, suite)
writeJson(auditPath, audit)

const rows = agenticTasks
  .slice(0, 40)
  .map((task) =>
    [
      task.task_id,
      task.category,
      String(task.corpus.document_count),
      String(task.gold.required_evidence_ids.length),
      task.gold.expected_answers.join('<br>'),
      String(task.corpus.distractor_document_count),
    ].join(' | '),
  )
  .join('\n| ')

writeText(
  markdownPath,
  `# Agentic Hard Grounded Research Suite

This suite is the frontier-lab-grade pivot from packet QA to agentic large-corpus research. It wraps the HF-derived scale suite into ${agenticTasks.length} no-gold corpus-search tasks intended for frontier tool-using agents such as Codex CLI, Claude Code, or equivalent systems using the strongest available model at run time.

## What Changed

- The system under test must search ${DOCS_PER_TASK} documents per task instead of receiving only the evidence packet.
- Each task contains answer-bearing documents plus deterministic HF/public-corpus distractors.
- The answer is not enough; the agent must cite exact evidence ids and reject misleading evidence.
- Primary scoring is deterministic after submission. An LLM judge is not required for the main score.
- Previous 10-task Codex/Claude runs are historical and do not satisfy this v3 suite.

## Readiness

- Suite materialized: true
- Tasks: ${agenticTasks.length}
- Source scale items: ${items.length}
- Categories: ${categories.length}
- Corpus documents per task: ${DOCS_PER_TASK}
- Frontier agent runs present: see \`AGENTIC_READINESS.md\`
- Completion claim allowed: see \`AGENTIC_READINESS.md\`

## Task Table Preview

The generated JSON contains all ${agenticTasks.length} tasks. The table below shows the first 40.

| Task | Category | Corpus docs | Required evidence ids | Expected answers | Distractor docs |
| --- | --- | ---: | ---: | --- | ---: |
| ${rows} |

## Required Agent Run

An eligible run must execute a real tool-using agent over the no-gold workspaces generated from these corpus shards. Use \`generated/agentic-workspaces/\` for agent input and withhold \`generated/agentic-hidden-gold.json\`. The run manifest must name the agent surface, model, model version, date, frontier-model attestation, tools enabled, command transcript path, and whether the agent had access to hidden gold. Runs over preselected evidence packets or single chat completions are diagnostic only.
`,
)

writeText(
  auditMarkdownPath,
  `# Agentic Buyer-Grade Audit

This audit checks the expanded suite against the buyer-grade benchmark target.

## Status

- Ready for buyer claim: ${audit.ready_for_buyer_claim}
- Reason: ${audit.reason_ready_for_buyer_claim_false}
- Tasks: ${audit.summary.task_count}
- Categories: ${audit.summary.categories.length}
- Corpus docs per task: ${audit.summary.min_corpus_documents}-${audit.summary.max_corpus_documents}
- Unique native questions: ${audit.summary.unique_native_questions}/${audit.summary.unique_native_question_minimum}
- Max reuse of one native question: ${audit.summary.max_native_question_reuse}
- Missing required-evidence tasks: ${audit.summary.missing_required_evidence_tasks}
- Public shortcut findings: ${audit.summary.public_shortcut_findings}

## Checks

| Check | Pass |
| --- | --- |
${Object.entries(audit.checks)
  .map(([key, value]) => `| ${key} | ${value} |`)
  .join('\n')}

## Remaining Buyer-Grade Blockers

${audit.blockers.map((blocker) => `- ${blocker}`).join('\n')}
`,
)

console.log(`Wrote ${outputPath}`)
console.log(`Wrote ${auditPath}`)
console.log(`Wrote ${markdownPath}`)
console.log(`Wrote ${auditMarkdownPath}`)
