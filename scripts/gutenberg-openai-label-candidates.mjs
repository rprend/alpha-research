import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import {
  appendJsonl,
  ensureDir,
  highRecallDir,
  readJsonl,
  taskPath,
  valueForArg,
  writeJson,
} from './gutenberg-pipeline-lib.mjs'

const model = process.env.OPENAI_LABEL_MODEL ?? 'gpt-5.5'
const openaiBaseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
const inputPath = valueForArg('--input') ?? join(highRecallDir, valueForArg('--run-id') ?? '', 'candidate_pool.jsonl')
const outputPath = valueForArg('--output') ?? join(dirname(inputPath), 'llm_labels.jsonl')
const limit = Number(valueForArg('--limit', '0'))
const dryRun = process.argv.includes('--dry-run')
const tasks = new Map(readJsonl(taskPath).map((task) => [task.id, task]))
const existing = new Set(readJsonl(outputPath).map((row) => row.candidate_id))
const candidates = readJsonl(inputPath).filter((row) => !existing.has(row.candidate_id)).slice(0, limit || undefined)

if (!existsSync(inputPath)) throw new Error(`Candidate pool not found: ${inputPath}`)
ensureDir(dirname(outputPath))

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'relevance', 'evidence_quote', 'rationale', 'near_miss_analysis', 'confidence', 'needs_more_context', 'suggested_query_terms', 'verdict_notes'],
  properties: {
    label: { type: 'string', enum: ['positive', 'hard_negative', 'ambiguous', 'miss'] },
    relevance: { type: 'integer', minimum: 0, maximum: 3 },
    evidence_quote: { type: 'string' },
    rationale: { type: 'string' },
    near_miss_analysis: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    needs_more_context: { type: 'boolean' },
    suggested_query_terms: { type: 'array', items: { type: 'string' } },
    verdict_notes: { type: 'string' },
  },
}

function dryLabel(candidate) {
  const task = tasks.get(candidate.task_id)
  const text = `${candidate.quote} ${candidate.discovery_path}`.toLowerCase()
  const signals = task.rubric.strong_match.toLowerCase().split(/\W+/).filter((word) => word.length > 5)
  const hits = signals.filter((word) => text.includes(word)).length
  const label = hits >= 2 || candidate.method_count >= 3 ? 'ambiguous' : 'hard_negative'
  return {
    label,
    relevance: label === 'ambiguous' ? 2 : 1,
    evidence_quote: candidate.quote.slice(0, 220),
    rationale: 'Dry-run heuristic label for pipeline validation only; replace with a real OpenAI labeling run.',
    near_miss_analysis: task.rubric.near_miss,
    confidence: 0.35,
    needs_more_context: false,
    suggested_query_terms: candidate.query_variant_text.split(/\s+/).slice(0, 8),
    verdict_notes: 'dry_run',
  }
}

async function callOpenAI(candidate) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required unless --dry-run is set.')
  const task = tasks.get(candidate.task_id)
  const response = await fetch(`${openaiBaseUrl.replace(/\/$/, '')}/responses`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content:
            'You are building a high-recall literary benchmark from Project Gutenberg. Label generously for possible positives, but require textual evidence for positives.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: { id: task.id, query: task.query, family: task.family, rubric: task.rubric },
            candidate: {
              title: candidate.title,
              author: candidate.author,
              gutenberg_id: candidate.gutenberg_id,
              discovery_path: candidate.discovery_path,
              passage: candidate.quote,
            },
          }),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'gutenberg_candidate_label',
          strict: true,
          schema,
        },
      },
    }),
  })
  if (!response.ok) throw new Error(`OpenAI label call failed: ${response.status} ${await response.text()}`)
  const json = await response.json()
  const text = json.output_text ?? json.output?.flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text
  return JSON.parse(text)
}

let written = 0
for (const candidate of candidates) {
  const label = dryRun ? dryLabel(candidate) : await callOpenAI(candidate)
  appendJsonl(outputPath, {
    run_id: basename(dirname(inputPath)),
    model: dryRun ? 'dry-run-heuristic' : model,
    labeled_at: new Date().toISOString(),
    candidate_id: candidate.candidate_id,
    task_id: candidate.task_id,
    passage_id: candidate.passage_id,
    work_id: candidate.work_id,
    ...label,
  })
  written += 1
}

writeJson(join(dirname(outputPath), 'llm_label_summary.json'), {
  input: inputPath,
  output: outputPath,
  model: dryRun ? 'dry-run-heuristic' : model,
  skipped_existing: existing.size,
  newly_labeled: written,
  remaining_after_run: Math.max(0, readJsonl(inputPath).length - existing.size - written),
})

console.log(`Wrote ${written} labels to ${outputPath}`)
