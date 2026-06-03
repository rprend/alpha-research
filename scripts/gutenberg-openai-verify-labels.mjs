import { basename, dirname, join } from 'node:path'
import {
  appendJsonl,
  readJsonl,
  taskPath,
  valueForArg,
  writeJson,
} from './gutenberg-pipeline-lib.mjs'

const labelsPath = valueForArg('--labels')
const candidatesPath = valueForArg('--candidates')
if (!labelsPath || !candidatesPath) throw new Error('Usage: --labels=PATH --candidates=PATH [--output=PATH] [--limit=N] [--dry-run]')
const outputPath = valueForArg('--output') ?? join(dirname(labelsPath), 'llm_verifications.jsonl')
const limit = Number(valueForArg('--limit', '0'))
const concurrency = Number(valueForArg('--concurrency', '4'))
const dryRun = process.argv.includes('--dry-run')
const verifyAll = process.argv.includes('--all')
const model = process.env.OPENAI_VERIFY_MODEL ?? 'gpt-5.5'
const openaiBaseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
const tasks = new Map(readJsonl(taskPath).map((task) => [task.id, task]))
const candidates = new Map(readJsonl(candidatesPath).map((row) => [row.candidate_id, row]))
const existing = new Set(readJsonl(outputPath).map((row) => row.candidate_id))
const labels = readJsonl(labelsPath)
  .filter((row) => !existing.has(row.candidate_id))
  .filter((row) => verifyAll || ['positive', 'ambiguous', 'hard_negative'].includes(row.label))
  .slice(0, limit || undefined)

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'corrected_label', 'corrected_relevance', 'quote_supported', 'false_positive_risk', 'false_negative_risk', 'rationale', 'adjudication_priority'],
  properties: {
    verdict: { type: 'string', enum: ['accept', 'reject', 'needs_human_review'] },
    corrected_label: { type: 'string', enum: ['positive', 'hard_negative', 'ambiguous', 'miss'] },
    corrected_relevance: { type: 'integer', minimum: 0, maximum: 3 },
    quote_supported: { type: 'boolean' },
    false_positive_risk: { type: 'string', enum: ['low', 'medium', 'high'] },
    false_negative_risk: { type: 'string', enum: ['low', 'medium', 'high'] },
    rationale: { type: 'string' },
    adjudication_priority: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
}

function dryVerify(label) {
  return {
    verdict: label.label === 'ambiguous' ? 'needs_human_review' : 'accept',
    corrected_label: label.label,
    corrected_relevance: label.relevance,
    quote_supported: Boolean(label.evidence_quote),
    false_positive_risk: label.label === 'positive' ? 'medium' : 'low',
    false_negative_risk: ['hard_negative', 'miss'].includes(label.label) ? 'medium' : 'low',
    rationale: 'Dry-run verifier for pipeline validation only; replace with a real OpenAI verification run.',
    adjudication_priority: label.label === 'ambiguous' ? 'high' : 'medium',
  }
}

async function callOpenAI(label) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required unless --dry-run is set.')
  const candidate = candidates.get(label.candidate_id)
  const task = tasks.get(label.task_id)
  const response = await fetch(`${openaiBaseUrl.replace(/\/$/, '')}/responses`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        { role: 'system', content: 'You are an adversarial verifier for a high-recall Project Gutenberg benchmark. Prefer human review when evidence is subtle or incomplete.' },
        { role: 'user', content: JSON.stringify({ task, candidate, first_pass_label: label }) },
      ],
      text: { format: { type: 'json_schema', name: 'gutenberg_label_verification', strict: true, schema } },
    }),
  })
  if (!response.ok) throw new Error(`OpenAI verify call failed: ${response.status} ${await response.text()}`)
  const json = await response.json()
  const text = json.output_text ?? json.output?.flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text
  return JSON.parse(text)
}

let written = 0
async function verifyWithRetry(label) {
  const attempts = Number(valueForArg('--retries', '3'))
  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return dryRun ? dryVerify(label) : await callOpenAI(label)
    } catch (error) {
      lastError = error
      const delayMs = 1000 * attempt * attempt
      console.warn(`Verify retry ${attempt}/${attempts} for ${label.candidate_id}: ${error.message}`)
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  return {
    verdict: 'needs_human_review',
    corrected_label: label.label === 'miss' ? 'ambiguous' : label.label,
    corrected_relevance: Math.max(1, label.relevance ?? 1),
    quote_supported: Boolean(label.evidence_quote),
    false_positive_risk: 'medium',
    false_negative_risk: 'medium',
    rationale: `Automatic review fallback: verifier failed after all retries: ${lastError?.message ?? 'unknown error'}`,
    adjudication_priority: 'high',
  }
}

async function verifyLabel(label) {
  const verification = await verifyWithRetry(label)
  appendJsonl(outputPath, {
    run_id: basename(dirname(labelsPath)),
    model: dryRun ? 'dry-run-heuristic' : model,
    verified_at: new Date().toISOString(),
    candidate_id: label.candidate_id,
    task_id: label.task_id,
    ...verification,
  })
  written += 1
  if (written % 25 === 0 || written === labels.length) {
    console.log(`Verified ${written}/${labels.length} labels.`)
  }
}

const workers = Array.from({ length: Math.max(1, concurrency) }, async (_, workerIndex) => {
  for (let index = workerIndex; index < labels.length; index += Math.max(1, concurrency)) {
    await verifyLabel(labels[index])
  }
})
await Promise.all(workers)

writeJson(join(dirname(outputPath), 'llm_verification_summary.json'), {
  labels: labelsPath,
  output: outputPath,
  model: dryRun ? 'dry-run-heuristic' : model,
  skipped_existing: existing.size,
  newly_verified: written,
  concurrency,
})

console.log(`Wrote ${written} verifications to ${outputPath}`)
