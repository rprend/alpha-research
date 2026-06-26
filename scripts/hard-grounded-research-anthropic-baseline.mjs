import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const calibrationSuitePath = join(generatedDir, 'calibration-suite.json')
const goldSuitePath = join(generatedDir, 'gold-suite.json')
const useCalibration = process.argv.includes('--calibration')
const useGold = process.argv.includes('--gold')
if (useCalibration && useGold) throw new Error('Use only one Anthropic baseline source: --calibration or --gold.')
const evaluationSource = useGold ? 'gold-suite' : useCalibration ? 'calibration-suite' : 'pilot-suite'
const suitePath = useGold ? goldSuitePath : useCalibration ? calibrationSuitePath : pilotSuitePath
const outputDir = join(
  experimentDir,
  'runs',
  useGold ? 'anthropic-grounded-baseline-v1-gold' : useCalibration ? 'anthropic-grounded-baseline-v1-calibration' : 'anthropic-grounded-baseline-v1',
)
const promptPacketPath = join(outputDir, 'prompt-packet.jsonl')
const runManifestPath = join(outputDir, 'run-manifest.json')
const submissionPath = join(outputDir, 'submission.json')
const reportPath = join(outputDir, 'report.json')

const shouldRun = process.argv.includes('--run')
const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'
const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonl(path, rows) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`)
}

function evidenceUnits(item) {
  if (Array.isArray(item.evidence_units)) return item.evidence_units
  return (item.source_examples || []).flatMap((source) => source.evidence_units || [])
}

function buildPrompt(item) {
  const evidence = evidenceUnits(item).map((unit) => ({
    id: unit.id,
    title: unit.title,
    locator: unit.locator,
    text: unit.text,
  }))
  return {
    custom_id: item.id || item.task_id,
    task_id: item.id || item.task_id,
    category: item.category,
    challenge_type: item.challenge?.type || 'native_row',
    evaluation_source: evaluationSource,
    system:
      'You are evaluating a grounded research QA benchmark. Use only the supplied evidence. Return strict JSON and do not include markdown.',
    user: {
      question: item.question,
      evidence,
      challenge: item.challenge || null,
      answer_schema: {
        answer: 'string; use ABSTAIN when evidence is insufficient and CONFLICT when evidence is irreconcilably contradictory',
        citations: 'array of evidence ids used directly by the answer',
        abstained: 'boolean',
        confidence: 'number from 0 to 1',
        evidence_assessment: 'short explanation of why the citations do or do not support the conclusion',
      },
      rules: [
        'Do not use facts outside the supplied evidence.',
        'Every non-abstention answer must cite evidence ids that directly support the conclusion.',
        'If evidence supports a related fact but not the requested conclusion, answer ABSTAIN.',
        'If documents conflict and the challenge does not define a controlling authority/date, answer CONFLICT.',
      ],
    },
  }
}

function parseJsonFromText(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) throw new Error('empty response')
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('response did not contain JSON object')
    return JSON.parse(match[0])
  }
}

function parseAnswer(taskId, text) {
  try {
    const parsed = parseJsonFromText(text)
    return {
      task_id: taskId,
      answer: String(parsed.answer ?? ''),
      citations: Array.isArray(parsed.citations) ? parsed.citations.map(String) : [],
      abstained: Boolean(parsed.abstained) || String(parsed.answer ?? '').toUpperCase() === 'ABSTAIN',
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
      evidence_assessment: 'Model response was not valid JSON.',
    }
  }
}

async function callMessagesApi(prompt) {
  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      system: prompt.system,
      messages: [{ role: 'user', content: JSON.stringify(prompt.user) }],
    }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Anthropic request failed for ${prompt.task_id}: ${response.status} ${body}`)
  }
  const json = await response.json()
  const text = (json.content || [])
    .filter((entry) => entry.type === 'text')
    .map((entry) => entry.text || '')
    .join('')
  return parseAnswer(prompt.task_id, text)
}

if (!existsSync(suitePath)) {
  throw new Error(`Missing ${evaluationSource}: ${suitePath}`)
}

const suite = readJson(suitePath)
const tasks = suite.task_examples || suite.items
const prompts = tasks.map(buildPrompt)
writeJsonl(promptPacketPath, prompts)

const manifest = {
  benchmark_id: 'hard-grounded-research-benchmark',
  system_id: 'anthropic-grounded-baseline-v1',
  evaluation_source: evaluationSource,
  model,
  base_url: baseUrl,
  suite_path: relative(root, suitePath),
  prompt_packet: relative(root, promptPacketPath),
  prompt_count: prompts.length,
  default_mode: 'dry_run',
  run_requested: shouldRun,
  api_key_present: Boolean(process.env.ANTHROPIC_API_KEY),
}
writeJson(runManifestPath, manifest)

if (!shouldRun) {
  console.log(`Wrote Anthropic prompt packet to ${promptPacketPath}`)
  console.log(`Wrote Anthropic run manifest to ${runManifestPath}`)
  console.log('Dry run only. Re-run with --run and ANTHROPIC_API_KEY to create a scored model submission.')
  process.exit(0)
}

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is required when --run is supplied. Use ~/.codex/scripts/ask-secret.sh; do not paste secrets into chat.')
}

const answers = []
for (const prompt of prompts) {
  answers.push(await callMessagesApi(prompt))
}

writeJson(submissionPath, {
  benchmark_id: 'hard-grounded-research-benchmark',
  system_id: 'anthropic-grounded-baseline-v1',
  description: `Anthropic Messages API grounded QA baseline using ${model}.`,
  answers,
})

const scorer = spawnSync(
  process.execPath,
  [
    'scripts/hard-grounded-research-evaluate.mjs',
    ...(useGold ? ['--gold'] : useCalibration ? ['--calibration'] : []),
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

console.log(`Wrote Anthropic model submission to ${submissionPath}`)
console.log(`Wrote Anthropic model report to ${reportPath}`)
process.stdout.write(scorer.stdout)
