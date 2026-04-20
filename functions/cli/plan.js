import { readCliBearerToken } from '../_utils/auth.js'

const DEFAULT_MODEL = 'gpt-5-mini'

function plannerPrompt(input) {
  return [
    'You are the RESEARCH CLI planner.',
    'Pick exactly one action for the user request.',
    'Prefer concrete actions over commentary.',
    'If the user asks to create or ingest a dataset, choose ingestAndDeploy.',
    'If the user is asking for runs, choose startRun or listTrackedRuns as appropriate.',
    'Return JSON only.',
    '{"action":{"type":"reply|question|login|listLocalDatasets|listRemoteDatasets|listTrackedRuns|ingestAndDeploy|deployInstance|startRun","...":"..."}}',
    `User request: ${input}`,
  ].join('\n')
}

async function createPlan(env, input) {
  if (!env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY on alpha-research worker')
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.RESEARCH_AGENT_MODEL || DEFAULT_MODEL,
      input: plannerPrompt(input),
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`OpenAI planner request failed (${response.status}) ${detail}`.trim())
  }

  const payload = await response.json()
  const outputText = typeof payload.output_text === 'string' ? payload.output_text : ''
  return JSON.parse(outputText)
}

export async function onRequestPost(context) {
  const cliSession = await readCliBearerToken(context.request, context.env)
  if (!cliSession) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await context.request.json().catch(() => ({}))
  const input = typeof body.input === 'string' ? body.input.trim() : ''
  if (!input) {
    return Response.json({ error: 'Missing input' }, { status: 400 })
  }

  try {
    const payload = await createPlan(context.env, input)
    return Response.json(payload)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Planner failed.' },
      { status: 502 },
    )
  }
}
