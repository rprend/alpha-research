import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const scaleSuitePath = join(generatedDir, 'derived-scale-suite.json')
const outputPath = join(generatedDir, 'agentic-research-suite.json')
const markdownPath = join(experimentDir, 'AGENTIC_RESEARCH_SUITE.md')

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

function compact(value, maxLength = 420) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text
}

function evidenceUnits(item) {
  return (item.source_examples || []).flatMap((source) =>
    (source.evidence_units || []).map((evidence) => ({
      ...evidence,
      source_dataset: source.source_dataset,
      source_row_id: source.source_row_id,
      benchmark_item_id: item.id,
      category: item.category,
    })),
  )
}

function categorySlug(category) {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function taskInstruction(category) {
  const shared =
    'Search the corpus manifest before answering. Return JSON with answer, cited_evidence_ids, rejected_evidence_ids, search_trace, and evidence_assessment.'
  const byCategory = {
    'multi-hop synthesis':
      'Find every required hop. A citation that supports only one hop is not enough.',
    'stale-vs-current document conflicts':
      'Prefer the current controlling document and explicitly reject stale evidence.',
    'appended document lifecycle changes':
      'Inspect appended updates before trusting the original document body.',
    'table + text reasoning':
      'Use table evidence and supporting text; arithmetic over the wrong column fails.',
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

function makeCorpusShard(category, categoryItems, distractorItems) {
  const answerItems = categoryItems.slice(0, 3)
  const distractors = distractorItems.slice(0, 97)
  const allItems = [...answerItems, ...distractors]
  const documents = allItems.flatMap((item) =>
    evidenceUnits(item).map((evidence) => ({
      document_id: evidence.id,
      title: evidence.title || evidence.source_dataset,
      source_dataset: evidence.source_dataset,
      source_row_id: evidence.source_row_id,
      benchmark_item_id: evidence.benchmark_item_id,
      category: evidence.category,
      locator: evidence.locator || '',
      text_preview: compact(evidence.text, 700),
    })),
  )

  return {
    shard_id: `agentic-corpus-${categorySlug(category)}`,
    document_count: documents.length,
    source_item_count: allItems.length,
    answer_item_ids: answerItems.map((item) => item.id),
    distractor_item_ids: distractors.map((item) => item.id),
    distractor_policy:
      'Distractors are real HF-derived evidence units from neighboring hard-grounded categories; agents must search and reject them, not assume all supplied documents are relevant.',
    documents,
  }
}

function buildAgenticTask(category, categoryItems, allItems, index) {
  const answerItems = categoryItems.slice(0, 3)
  const distractorItems = allItems.filter((item) => item.category !== category)
  const corpus = makeCorpusShard(category, categoryItems, distractorItems)
  const sourceDatasets = unique(answerItems.flatMap((item) => item.source_datasets || []))
  const requiredEvidenceIds = unique(answerItems.flatMap((item) => item.required_citation_ids || []))
  const expectedAnswers = unique(answerItems.map((item) => item.final_answer))
  const sourceRowIds = unique(answerItems.flatMap((item) => item.source_row_ids || []))

  return {
    task_id: `hgr_agentic_${String(index + 1).padStart(2, '0')}_${categorySlug(category)}`,
    benchmark_id: 'hard-grounded-research-benchmark',
    benchmark_layer: 'agentic-large-corpus-research',
    category,
    difficulty_target:
      'Designed for tool-using research agents, not single-call QA over a supplied evidence packet.',
    instruction: taskInstruction(category),
    user_question:
      `Using the corpus shard, answer the ${category} research task. ` +
      `You must search, cite exact evidence ids, reject misleading evidence, and obey the category-specific rule.`,
    corpus,
    gold: {
      expected_answers: expectedAnswers,
      required_evidence_ids: requiredEvidenceIds,
      source_row_ids: sourceRowIds,
      source_datasets: sourceDatasets,
      constant_time_scoring: true,
      scoring_rule:
        'A submitted answer is checked by normalized answer membership, required evidence-id recall, citation precision, abstention/conflict flags, and rejected-evidence accounting. No LLM judge is required for the primary score.',
    },
    required_agent_capabilities: [
      'filesystem_or_corpus_search',
      'multi_step_evidence_selection',
      'citation_id_tracking',
      'source_rejection',
      'structured_json_submission',
    ],
    failure_modes_under_test: [
      'retrieves plausible distractors',
      'answers from stale or lower-authority evidence',
      'cites a true fact for an unsupported conclusion',
      'fails to abstain or report conflict',
      'drops required evidence after a long search trace',
    ],
    anti_shortcut_controls: {
      hidden_gold_from_prompt: true,
      distractor_documents_present: corpus.distractor_item_ids.length,
      expected_answer_not_sufficient_without_citations: true,
      single_call_packet_baseline_allowed: false,
    },
  }
}

const scaleSuite = readJson(scaleSuitePath)
const items = scaleSuite.items || scaleSuite.task_examples || []
const categories = unique(items.map((item) => item.category))
const agenticTasks = categories.map((category, index) =>
  buildAgenticTask(
    category,
    items.filter((item) => item.category === category),
    items,
    index,
  ),
)

const suite = {
  benchmark_id: 'hard-grounded-research-benchmark',
  suite_id: 'agentic-large-corpus-research-v1',
  generated_from: 'generated/derived-scale-suite.json',
  task_count: agenticTasks.length,
  source_item_count: items.length,
  category_count: categories.length,
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
    current_frontier_agent_runs_present: false,
    completion_claim_allowed: false,
  },
  tasks: agenticTasks,
}

writeJson(outputPath, suite)

const rows = agenticTasks
  .map((task) =>
    [
      task.task_id,
      task.category,
      String(task.corpus.document_count),
      String(task.gold.required_evidence_ids.length),
      task.gold.expected_answers.join('<br>'),
      task.corpus.distractor_item_ids.length,
    ].join(' | '),
  )
  .join('\n| ')

writeText(
  markdownPath,
  `# Agentic Hard Grounded Research Suite

This suite is the pivot from packet QA to agentic large-corpus research. It wraps the HF-derived scale suite into corpus-search tasks intended for frontier tool-using agents such as Codex CLI, Claude Code, or equivalent systems using the strongest available model at run time.

## What Changed

- The system under test must search a corpus shard instead of receiving only the evidence packet.
- Each task contains answer-bearing documents plus real HF-derived distractor documents.
- The answer is not enough; the agent must cite exact evidence ids and reject misleading evidence.
- Primary scoring is deterministic after submission. An LLM judge is not required for the main score.
- Current single-call OpenAI/Anthropic pilot runs do not satisfy this agentic goal.

## Readiness

- Suite materialized: true
- Tasks: ${agenticTasks.length}
- Source scale items: ${items.length}
- Categories: ${categories.length}
- Frontier agent runs present: false
- Completion claim allowed: false

## Task Table

| Task | Category | Corpus docs | Required evidence ids | Expected answers | Distractor items |
| --- | --- | ---: | ---: | --- | ---: |
| ${rows} |

## Required Agent Run

An eligible run must execute a real tool-using agent over these corpus shards. The run manifest must name the agent surface, model, model version, date, tools enabled, command transcript path, and whether the agent had access to hidden gold. Runs over preselected evidence packets or single chat completions are diagnostic only.
`,
)

console.log(`Wrote ${outputPath}`)
console.log(`Wrote ${markdownPath}`)
