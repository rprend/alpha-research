import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')

function option(name, fallback = null) {
  const prefix = `--${name}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : fallback
}

const systemId = option('system-id')
const inputPath = option('input')
const suite = option('suite', 'pilot')
const description = option('description', systemId ? `Imported external model results for ${systemId}.` : null)

if (!systemId) throw new Error('Missing --system-id=<id>.')
if (!inputPath) throw new Error('Missing --input=<model-output.jsonl>.')
if (!['pilot', 'calibration', 'gold'].includes(suite)) throw new Error('--suite must be pilot, calibration, or gold.')

const outputDir = join(experimentDir, 'runs', systemId)
const submissionPath = join(outputDir, 'submission.json')
const reportPath = join(outputDir, 'report.json')
const manifestPath = join(outputDir, 'import-manifest.json')

function readJsonl(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(`Invalid JSONL at ${path}:${index + 1}: ${error.message}`)
      }
    })
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function parseContent(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry
        if (entry?.type === 'output_text' || entry?.type === 'text') return entry.text || ''
        return ''
      })
      .join('')
  }
  return ''
}

function outputText(row) {
  if (typeof row.output_text === 'string') return row.output_text
  if (typeof row.text === 'string') return row.text
  if (typeof row.completion === 'string') return row.completion
  if (typeof row.response?.output_text === 'string') return row.response.output_text
  if (typeof row.response?.body?.output_text === 'string') return row.response.body.output_text

  const output = row.response?.body?.output || row.response?.output || row.output
  if (Array.isArray(output)) {
    return output
      .flatMap((entry) => entry.content || [])
      .map(parseContent)
      .join('')
  }

  const choices = row.response?.body?.choices || row.choices
  if (Array.isArray(choices)) {
    return choices.map((choice) => choice.message?.content || choice.text || '').join('')
  }

  return ''
}

function rowTaskId(row) {
  return String(row.custom_id || row.task_id || row.id || row.request?.custom_id || '').trim()
}

function parseAnswer(taskId, rawText) {
  try {
    const parsed = JSON.parse(rawText)
    const answer = String(parsed.answer ?? '')
    return {
      task_id: taskId,
      answer,
      citations: Array.isArray(parsed.citations) ? parsed.citations.map(String) : [],
      abstained: Boolean(parsed.abstained) || answer.toUpperCase() === 'ABSTAIN',
      confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0,
      evidence_assessment: String(parsed.evidence_assessment ?? ''),
    }
  } catch {
    return {
      task_id: taskId,
      answer: 'ABSTAIN',
      citations: [],
      abstained: true,
      confidence: 0,
      evidence_assessment: 'Imported model output was not valid benchmark JSON.',
      raw_output_parse_error: true,
    }
  }
}

function buildSubmission(rows) {
  const answers = rows.map((row, index) => {
    const taskId = rowTaskId(row)
    if (!taskId) throw new Error(`Model output row ${index + 1} has no custom_id/task_id/id.`)
    return parseAnswer(taskId, outputText(row))
  })

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    system_id: systemId,
    description,
    imported_from: relative(root, inputPath),
    answers,
  }
}

if (!existsSync(inputPath)) throw new Error(`Missing model output file: ${inputPath}`)

const rows = readJsonl(inputPath)
const submission = buildSubmission(rows)
writeJson(submissionPath, submission)
writeJson(manifestPath, {
  benchmark_id: 'hard-grounded-research-benchmark',
  system_id: systemId,
  suite,
  input: relative(root, inputPath),
  submission: relative(root, submissionPath),
  report: relative(root, reportPath),
  row_count: rows.length,
  parse_error_count: submission.answers.filter((answer) => answer.raw_output_parse_error).length,
})

const scorer = spawnSync(
  process.execPath,
  [
    'scripts/hard-grounded-research-evaluate.mjs',
    ...(suite === 'gold' ? ['--gold'] : suite === 'calibration' ? ['--calibration'] : []),
    `--submission=${relative(root, submissionPath)}`,
    `--report=${relative(root, reportPath)}`,
  ],
  {
    cwd: root,
    encoding: 'utf8',
  },
)

if (scorer.status !== 0) {
  process.stderr.write(scorer.stdout)
  process.stderr.write(scorer.stderr)
  process.exit(scorer.status || 1)
}

console.log(`Wrote imported model submission to ${submissionPath}`)
console.log(`Wrote imported model report to ${reportPath}`)
process.stdout.write(scorer.stdout)
