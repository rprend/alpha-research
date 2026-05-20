import { readCliBearerToken } from '../_utils/auth.js'

const DEFAULT_MODEL = 'gpt-5-mini'

const ACTION_SCHEMA = {
  name: 'research_cli_plan',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      action: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: {
            type: 'string',
            enum: [
              'reply',
              'question',
              'login',
              'listLocalDatasets',
              'listRemoteDatasets',
              'listTrackedRuns',
              'ingestAndDeploy',
              'deployInstance',
              'startRun',
            ],
          },
          message: { type: 'string' },
          input: { type: 'string' },
          mode: { type: 'string', enum: ['auto', 'tabular', 'unstructured'] },
          name: { type: 'string' },
          datasetId: { type: 'string' },
          instanceId: { type: 'string' },
          runInput: { type: 'string' },
        },
        required: ['type', 'message', 'input', 'mode', 'name', 'datasetId', 'instanceId', 'runInput'],
      },
    },
    required: ['action'],
  },
}

function plannerPrompt(input) {
  return [
    'You are the RESEARCH CLI planner.',
    'Pick exactly one action for the user request.',
    'Prefer concrete actions over commentary, but do not start work prematurely.',
    'If the user asks to create or ingest a dataset, choose ingestAndDeploy.',
    'If the user is asking for runs, choose startRun or listTrackedRuns as appropriate.',
    'If the request is broad, vague, exploratory, or missing a clear dataset, outcome metric, or output artifact, do not choose startRun.',
    'For those underspecified requests, choose question and ask the user to confirm a scoped plan with a likely dataset, primary metric, and expected output.',
    'Only choose startRun when the request is operationally specific enough to execute without a costly guess.',
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
      text: {
        format: {
          type: 'json_schema',
          ...ACTION_SCHEMA,
        },
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`OpenAI planner request failed (${response.status}) ${detail}`.trim())
  }

  const payload = await response.json()
  const outputParsed =
    payload?.output_parsed ??
    payload?.output?.find?.((entry) => entry?.type === 'message')?.content?.find?.(
      (content) => content?.type === 'output_text' && content?.parsed,
    )?.parsed

  if (outputParsed && typeof outputParsed === 'object') {
    return outputParsed
  }

  const outputText =
    (typeof payload.output_text === 'string' && payload.output_text.trim()) ||
    payload?.output
      ?.find?.((entry) => entry?.type === 'message')
      ?.content?.find?.((content) => content?.type === 'output_text' && typeof content?.text === 'string')
      ?.text?.trim?.() ||
    ''
  if (!outputText) {
    throw new Error('Planner returned no JSON output')
  }
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
