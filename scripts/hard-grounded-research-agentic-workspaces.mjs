import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const suitePath = join(generatedDir, 'agentic-research-suite.json')
const workspaceRoot = join(generatedDir, 'agentic-workspaces')
const hiddenGoldPath = join(generatedDir, 'agentic-hidden-gold.json')
const manifestPath = join(generatedDir, 'agentic-workspaces-manifest.json')
const markdownPath = join(experimentDir, 'AGENTIC_WORKSPACES.md')

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

function publicTask(task) {
  const generationShardPath = join(generatedDir, 'agentic-corpus-shards', `${task.task_id}.json`)
  const corpus = readJson(generationShardPath)
  const publicDocuments = corpus.documents.map((document) => ({
    document_id: document.document_id,
    title: document.title,
    source_dataset: document.source_dataset,
    source_row_id: document.source_row_id,
    locator: document.locator,
    text_preview: document.text_preview,
  }))
  return {
    task_id: task.task_id,
    benchmark_id: task.benchmark_id,
    benchmark_layer: task.benchmark_layer,
    category: task.category,
    difficulty_target: task.difficulty_target,
    instruction: task.instruction,
    user_question: task.user_question,
    target: task.target,
    corpus: {
      shard_id: task.corpus.shard_id,
      document_count: task.corpus.document_count,
      source_item_count: task.corpus.source_item_count,
      distractor_policy: task.corpus.distractor_policy,
      corpus_path: task.corpus.corpus_path,
      documents: publicDocuments,
    },
    required_agent_capabilities: task.required_agent_capabilities,
    failure_modes_under_test: task.failure_modes_under_test,
    anti_shortcut_controls: {
      hidden_gold_from_prompt: true,
      expected_answer_not_sufficient_without_citations: true,
      single_call_packet_baseline_allowed: false,
    },
    submission_schema: {
      task_id: 'string; must equal this task id',
      answer: 'string; use ABSTAIN or CONFLICT when required',
      cited_evidence_ids: 'array of exact document_id strings used directly by the answer',
      rejected_evidence_ids: 'array of exact document_id strings inspected and rejected as misleading or irrelevant',
      search_trace:
        'array of objects recording searches, files inspected, terms used, and why candidates were kept or rejected',
      evidence_assessment: 'short explanation tying the answer to citations and rejected evidence',
    },
  }
}

function taskPrompt(task) {
  return `# Agentic Hard Grounded Research Task

You are evaluating a frontier tool-using research agent. Use only files in this task workspace.

## Task

${task.user_question}

## Rule

${task.instruction}

## Required Output

Write a JSON file named \`answer.json\` in this directory with:

\`\`\`json
{
  "task_id": "${task.task_id}",
  "answer": "...",
  "cited_evidence_ids": ["..."],
  "rejected_evidence_ids": ["..."],
  "search_trace": [
    {
      "query_or_action": "...",
      "files_or_evidence_ids": ["..."],
      "decision": "kept | rejected | inspected"
    }
  ],
  "evidence_assessment": "..."
}
\`\`\`

You must search \`corpus.json\` and cite exact \`document_id\` values. Do not use hidden gold, previous benchmark reports, or generated scorer outputs. Do not answer from memory.
`
}

const suite = readJson(suitePath)
rmSync(workspaceRoot, { recursive: true, force: true })
mkdirSync(workspaceRoot, { recursive: true })

const manifestTasks = []
const hiddenGold = {
  benchmark_id: suite.benchmark_id,
  suite_id: suite.suite_id,
  warning: 'This file is for scoring only. Do not place it in an agent workspace.',
  tasks: [],
}

for (const task of suite.tasks) {
  const taskDir = join(workspaceRoot, task.task_id)
  const publicTaskData = publicTask(task)
  mkdirSync(taskDir, { recursive: true })
  writeJson(join(taskDir, 'task.json'), publicTaskData)
  writeJson(join(taskDir, 'corpus.json'), publicTaskData.corpus)
  writeText(join(taskDir, 'README.md'), taskPrompt(task))
  writeJson(join(taskDir, 'answer.schema.json'), publicTaskData.submission_schema)
  manifestTasks.push({
    task_id: task.task_id,
    category: task.category,
    workspace: `generated/agentic-workspaces/${task.task_id}`,
    corpus_documents: task.corpus.document_count,
    source_items: task.corpus.source_item_count,
  })
  hiddenGold.tasks.push({
    task_id: task.task_id,
    category: task.category,
    expected_answers: task.gold.expected_answers,
    required_evidence_ids: task.gold.required_evidence_ids,
    source_row_ids: task.gold.source_row_ids,
    source_datasets: task.gold.source_datasets,
    source_item_id: task.gold.source_item_id,
    label_tier: task.gold.label_tier,
    derivation_rule: task.gold.derivation_rule,
  })
}

const manifest = {
  benchmark_id: suite.benchmark_id,
  suite_id: suite.suite_id,
  workspace_root: 'generated/agentic-workspaces',
  task_count: manifestTasks.length,
  hidden_gold_path: 'generated/agentic-hidden-gold.json',
  hidden_gold_must_be_withheld_from_agents: true,
  tasks: manifestTasks,
}

writeJson(manifestPath, manifest)
writeJson(hiddenGoldPath, hiddenGold)

const rows = manifestTasks
  .map((task) =>
    [
      task.task_id,
      task.category,
      task.workspace,
      String(task.corpus_documents),
      String(task.source_items),
    ].join(' | '),
  )
  .join('\n| ')

writeText(
  markdownPath,
  `# Agentic Workspaces

These are no-gold workspaces for real tool-using agent runs. Give an agent one workspace directory at a time, or the full \`generated/agentic-workspaces\` directory, but do not include \`generated/agentic-hidden-gold.json\`.

## Files

- \`task.json\`: public task metadata and corpus pointer.
- \`corpus.json\`: searchable evidence documents with exact \`document_id\` values.
- \`README.md\`: natural-language task prompt.
- \`answer.schema.json\`: required answer shape.
- \`answer.json\`: file the agent must create during a run.

## Hidden Gold

\`generated/agentic-hidden-gold.json\` is for deterministic scoring only and must be withheld from agents.

## Workspaces

| Task | Category | Workspace | Corpus docs | Source items |
| --- | --- | --- | ---: | ---: |
| ${rows} |
`,
)

console.log(`Wrote ${manifestPath}`)
console.log(`Wrote ${hiddenGoldPath}`)
console.log(`Wrote ${workspaceRoot}`)
console.log(`Wrote ${markdownPath}`)
