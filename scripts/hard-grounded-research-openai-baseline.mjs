import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const outputDir = join(experimentDir, 'runs/openai-grounded-baseline-v1')
const promptPacketPath = join(outputDir, 'prompt-packet.jsonl')
const runManifestPath = join(outputDir, 'run-manifest.json')
const submissionPath = join(outputDir, 'submission.json')
const reportPath = join(outputDir, 'report.json')

const shouldRun = process.argv.includes('--run')
const model = process.env.OPENAI_MODEL || 'gpt-5.5'
const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

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
  return item.source_examples.flatMap((source) => source.evidence_units || [])
}

function buildPrompt(item) {
  const evidence = evidenceUnits(item).map((unit) => ({
    id: unit.id,
    title: unit.title,
    locator: unit.locator,
    text: unit.text,
  }))
  return {
    task_id: item.id,
    category: item.category,
    challenge_type: item.challenge?.type || 'native_row',
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

function parseAnswer(taskId, text) {
  try {
    const parsed = JSON.parse(text)
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

async function callResponsesApi(prompt) {
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: JSON.stringify(prompt.user) },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'hard_grounded_answer',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['answer', 'citations', 'abstained', 'confidence', 'evidence_assessment'],
            properties: {
              answer: { type: 'string' },
              citations: { type: 'array', items: { type: 'string' } },
              abstained: { type: 'boolean' },
              confidence: { type: 'number' },
              evidence_assessment: { type: 'string' },
            },
          },
        },
      },
    }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenAI request failed for ${prompt.task_id}: ${response.status} ${body}`)
  }
  const json = await response.json()
  const text =
    json.output_text ||
    json.output?.flatMap((entry) => entry.content || [])?.find((content) => content.type === 'output_text')?.text ||
    ''
  return parseAnswer(prompt.task_id, text)
}

const pilotSuite = readJson(pilotSuitePath)
const prompts = pilotSuite.items.map(buildPrompt)
writeJsonl(promptPacketPath, prompts)

const manifest = {
  benchmark_id: 'hard-grounded-research-benchmark',
  system_id: 'openai-grounded-baseline-v1',
  model,
  base_url: baseUrl,
  prompt_packet: relative(root, promptPacketPath),
  prompt_count: prompts.length,
  default_mode: 'dry_run',
  run_requested: shouldRun,
  api_key_present: Boolean(process.env.OPENAI_API_KEY),
}
writeJson(runManifestPath, manifest)

if (!shouldRun) {
  console.log(`Wrote OpenAI prompt packet to ${promptPacketPath}`)
  console.log(`Wrote OpenAI run manifest to ${runManifestPath}`)
  console.log('Dry run only. Re-run with --run and OPENAI_API_KEY to create a scored model submission.')
  process.exit(0)
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required when --run is supplied. Use ~/.codex/scripts/ask-secret.sh; do not paste secrets into chat.')
}

const answers = []
for (const prompt of prompts) {
  answers.push(await callResponsesApi(prompt))
}

writeJson(submissionPath, {
  benchmark_id: 'hard-grounded-research-benchmark',
  system_id: 'openai-grounded-baseline-v1',
  description: `OpenAI Responses API grounded QA baseline using ${model}.`,
  answers,
})

const scorer = spawnSync(
  process.execPath,
  ['scripts/hard-grounded-research-evaluate.mjs', `--submission=${relative(root, submissionPath)}`, `--report=${relative(root, reportPath)}`],
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

console.log(`Wrote OpenAI model submission to ${submissionPath}`)
console.log(`Wrote OpenAI model report to ${reportPath}`)
process.stdout.write(scorer.stdout)
