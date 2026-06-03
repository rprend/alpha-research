import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

const root = process.cwd()
const runDir = join('docs/experiments/gutenberg-semantic-benchmark/high_recall/mock-openai-smoke')
const candidatePool = join(runDir, 'candidate_pool.jsonl')
const labels = join(runDir, 'llm_labels.jsonl')
const verifications = join(runDir, 'llm_verifications.jsonl')

function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
    })
  })
}

const server = createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== '/v1/responses') {
    response.writeHead(404)
    response.end()
    return
  }
  let body = ''
  request.on('data', (chunk) => {
    body += chunk
  })
  request.on('end', () => {
    const payload = JSON.parse(body)
    const schemaName = payload.text?.format?.name
    const output =
      schemaName === 'gutenberg_label_verification'
        ? {
            verdict: 'needs_human_review',
            corrected_label: 'ambiguous',
            corrected_relevance: 2,
            quote_supported: true,
            false_positive_risk: 'medium',
            false_negative_risk: 'medium',
            rationale: 'Mock verifier response exercising the real OpenAI response parser.',
            adjudication_priority: 'high',
          }
        : {
            label: 'ambiguous',
            relevance: 2,
            evidence_quote: 'Mock evidence quote.',
            rationale: 'Mock label response exercising the real OpenAI response parser.',
            near_miss_analysis: 'Mock near miss analysis.',
            confidence: 0.5,
            needs_more_context: false,
            suggested_query_terms: ['mock', 'query'],
            verdict_notes: 'mock_openai_smoke',
          }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ output_text: JSON.stringify(output) }))
  })
})

server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address()
  const env = {
    OPENAI_API_KEY: 'mock-key',
    OPENAI_BASE_URL: `http://127.0.0.1:${port}/v1`,
    OPENAI_LABEL_MODEL: 'gpt-5.5',
    OPENAI_VERIFY_MODEL: 'gpt-5.5',
  }
  try {
    await run('node', ['scripts/gutenberg-high-recall-candidates.mjs', '--run-id=mock-openai-smoke', '--max-works=10', '--per-task=2', '--top-k=4', '--smoke'])
    await run('node', ['scripts/gutenberg-openai-label-candidates.mjs', `--input=${candidatePool}`, `--output=${labels}`, '--limit=3'], env)
    await run('node', ['scripts/gutenberg-openai-verify-labels.mjs', `--labels=${labels}`, `--candidates=${candidatePool}`, `--output=${verifications}`, '--limit=3'], env)
    await run('node', ['scripts/gutenberg-synthesize-high-recall-results.mjs', `--run-dir=${runDir}`])
    console.log('Mock OpenAI Gutenberg high-recall smoke passed.')
  } finally {
    server.close()
  }
})
