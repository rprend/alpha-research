// @ts-expect-error Cloudflare Worker entrypoint imports JS auth handlers.
import { onRequestGet as startAuthGet, onRequestPost as startAuthPost } from '../functions/api/auth/start.js'
// @ts-expect-error Cloudflare Worker entrypoint imports JS auth handlers.
import { onRequestGet as authCallbackGet } from '../functions/api/auth/callback.js'
// @ts-expect-error Cloudflare Worker entrypoint imports JS auth handlers.
import { onRequestGet as authSessionGet } from '../functions/api/auth/session.js'
// @ts-expect-error Cloudflare Worker entrypoint imports JS auth handlers.
import { onRequestPost as authLogoutPost } from '../functions/api/auth/logout.js'
// @ts-expect-error Cloudflare Worker entrypoint imports JS auth handlers.
import { onRequestGet as authBridgeGet } from '../functions/api/auth/bridge.js'
// @ts-expect-error Cloudflare Worker entrypoint imports JS auth handlers.
import { onRequestGet as cliLoginGet } from '../functions/cli/login.js'
// @ts-expect-error Cloudflare Worker entrypoint imports JS auth handlers.
import { onRequestPost as cliPlanPost } from '../functions/cli/plan.js'
// @ts-expect-error Cloudflare Worker entrypoint imports JS auth helpers.
import { readCliBearerToken, readSession } from '../functions/_utils/auth.js'
import { ControlPlane } from './control-plane'
import { remoteAgentRunnerScript } from './remote-agent-runner-script'

type AssetFetcher = {
  fetch(request: Request): Promise<Response>
}

type DurableObjectStub = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

type DurableObjectNamespaceLike = {
  idFromName(name: string): unknown
  get(id: unknown): DurableObjectStub
}

type Env = {
  ASSETS: AssetFetcher
  WORKOS_API_KEY?: string
  WORKOS_CLIENT_ID?: string
  ALPHA_RESEARCH_SESSION_SECRET?: string
  ALPHA_RESEARCH_ALLOWED_EMAILS?: string
  WORKOS_REDIRECT_URI?: string
  OPENAI_API_KEY?: string
  RESEARCH_AGENT_MODEL?: string
  REMOTE_AGENT_MODEL?: string
  MODAL_AGENT_ENDPOINT_URL?: string
  MODAL_AGENT_SUBMIT_TOKEN?: string
  RESEARCH_CONTROL_ORIGIN?: string
  OBJECT_STORE_BUCKET?: string
  OBJECT_STORE_REGION?: string
  OBJECT_STORE_ACCESS_KEY_ID?: string
  OBJECT_STORE_SECRET_ACCESS_KEY?: string
  OBJECT_STORE_ENDPOINT?: string
  R2_BUCKET_NAME?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  R2_ENDPOINT?: string
  RESEARCH_INTERNAL_RUNNER_TOKEN?: string
  RESEARCH_DATASET_REPO_REF?: string
  EXA_API_KEY?: string
  CANONICAL_DATASET_SLACK_WEBHOOK_URL?: string
  SLACK_WEBHOOK_URL?: string
  CONTROL_PLANE: DurableObjectNamespaceLike
}

type HandlerContext = {
  request: Request
  env: Env
}

type AgentToolResult = {
  summary: string
  data?: unknown
}

type ResponseFunctionCall = {
  type: 'function_call'
  call_id?: string
  name?: string
  arguments?: string
}

type ResponseMessage = {
  type?: string
  content?: Array<{
    type?: string
    text?: string
  }>
}

type ResponsesApiPayload = {
  id?: string
  output_text?: string
  output?: Array<ResponseFunctionCall | ResponseMessage | Record<string, unknown>>
}

type AgentToolDefinition = {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (input: Record<string, unknown>, sessionId: string | null) => Promise<AgentToolResult>
}

const WEB_DASHBOARD_ORIGIN = 'https://dashboard.alpharesearch.nyc'
const DOCS_HOST = 'docs.alpharesearch.nyc'
const DOCS_PAGE_PATHS = new Set([
  '/',
  '/cli/authentication',
  '/cli/common-commands',
  '/cli/debug-runs',
  '/cli/index',
  '/cli/install',
  '/dashboard/datasets',
  '/dashboard/index',
  '/dashboard/runs',
  '/dashboard/terminal-sessions',
  '/index',
  '/product-tests-site',
  '/public-datasets/econ',
  '/public-datasets/index',
  '/reference/mintlify-deployment',
  '/ways-to-use/index',
  '/ways-to-use/local-development',
  '/ways-to-use/private-datasets',
  '/ways-to-use/public-datasets',
  '/ways-to-use/research-runs',
])
const DOCS_SECTION_INDEX_PATHS = new Set(['/cli', '/dashboard', '/public-datasets', '/ways-to-use'])
const MAX_TOOL_ROUNDS = 12
const ASYNC_RUN_START_TOOLS = new Set([
  'start_remote_run',
  'query_remote_dataset',
  'aggregate_remote_dataset',
  'fetch_public_data',
  'start_remote_agent_run',
  'continue_remote_agent_run',
  'run_remote_transformation',
  'run_remote_labeling',
])
const MODEL_HIDDEN_RESEARCH_AGENT_TOOLS = new Set([
  'fetch_public_data',
  'start_remote_agent_run',
  'run_remote_transformation',
  'run_remote_labeling',
])

const RESEARCH_AGENT_INSTRUCTIONS = [
  'You are RESEARCH, a CLI agent for helping knowledge workers work faster.',
  'You help them create and manage remote research environments with large datasets, design experiments, and get the results.',
  'You manage the creation, operation, and prompting of other agents on remote cloud environments.',
  '',
  'In the web app, act like the RESEARCH CLI running remotely for the signed-in user.',
  'Use tools only when the user is asking for a concrete action or factual state that requires remote data.',
  'If the user input is gibberish, a greeting, or too vague to identify a research/data action, do not call tools. Ask one concise clarifying question instead.',
  'When a dataset is named, implied, or attached to the current page/session, use the provided dataset context first. Do not ask the user for dataset ids, schema, coverage, or briefing facts that are already present in the prompt.',
  'If the request is underspecified but the dataset context supports a likely next step, propose one concrete default action with assumptions instead of asking a multi-question menu.',
  'Prefer lightweight dataset queries before launching heavy transforms or analyses when the user wants examples, top records, simple slices, schema checks, or field availability.',
  'Do not answer with generic numbered menus when you can inspect the user datasets or runs, use provided dataset context, and propose one concrete next action.',
  'Remote runs require explicit approval. When the user asks to launch remote work, call plan_remote_run first. That tool generates the exact prompt from this session\'s chat history. The dashboard will render an approval control for the generated prompt.',
  'Do not call start_remote_run unless the dashboard has recorded explicit approval for the latest generated remote-run prompt. After starting the run, do not wait for completion unless the user explicitly asks you to wait.',
  'Be concise. After tool work completes, summarize the result and current status.',
  'Ask the user a question when their intent is unclear or a required tool input cannot be resolved from prior context.',
].join('\n')

function createContext(request: Request, env: Env): HandlerContext {
  return { request, env }
}

function controlPlaneStub(env: Env) {
  return env.CONTROL_PLANE.get(env.CONTROL_PLANE.idFromName('alpha-research-control-plane'))
}

async function requireAuthorizedSession(request: Request, env: Env) {
  const cliSession = await readCliBearerToken(request, env)
  if (cliSession) {
    return cliSession
  }

  const webSession = await readSession(request, env).catch(() => null)
  if (webSession) {
    return webSession
  }

  return null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function contentTypeForPath(pathname: string) {
  if (pathname.endsWith('.html')) return 'text/html; charset=utf-8'
  if (pathname.endsWith('.mintlify')) return 'text/html; charset=utf-8'
  if (pathname.endsWith('.css')) return 'text/css; charset=utf-8'
  if (pathname.endsWith('.js')) return 'application/javascript; charset=utf-8'
  if (pathname.endsWith('.svg')) return 'image/svg+xml'
  if (pathname.endsWith('.png')) return 'image/png'
  if (pathname.endsWith('.ico')) return 'image/x-icon'
  if (pathname.endsWith('.xml')) return 'application/xml; charset=utf-8'
  if (pathname.endsWith('.json') || pathname.endsWith('.webmanifest')) return 'application/json; charset=utf-8'
  return null
}

async function fetchDocsAsset(request: Request, env: Env, url: URL) {
  if (isUnknownPublicDatasetPath(url.pathname)) {
    return new Response('Not found.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  const candidates = docsAssetCandidates(url.pathname)
  for (const candidate of candidates) {
    const assetUrl = new URL(request.url)
    assetUrl.pathname = `/docs-site${candidate}`
    const response = await env.ASSETS.fetch(new Request(assetUrl, request))
    if (response.status !== 404) {
      const headers = new Headers(response.headers)
      const contentType = contentTypeForPath(candidate)
      if (contentType) {
        headers.set('Content-Type', contentType)
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }
  }
  const fallbackUrl = new URL(request.url)
  fallbackUrl.pathname = '/docs-site/index.html'
  return env.ASSETS.fetch(new Request(fallbackUrl, request))
}

function isUnknownPublicDatasetPath(pathname: string) {
  const normalized = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  if (!normalized.startsWith('/public-datasets/') || /\.[^/]+$/u.test(normalized)) {
    return false
  }
  return !DOCS_PAGE_PATHS.has(normalized) && !DOCS_PAGE_PATHS.has(`${normalized}/index`)
}

function docsAssetCandidates(pathname: string) {
  if (pathname === '/' || pathname === '') {
    return ['/', '/index.html', '/__page.mintlify', '/index/__page.mintlify']
  }
  const normalized = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  if (/\.[^/]+$/u.test(normalized)) {
    return [normalized]
  }
  if (DOCS_SECTION_INDEX_PATHS.has(normalized)) {
    return [`${normalized}/index/`, `${normalized}/index/index.html`, `${normalized}/index/__page.mintlify`]
  }
  if (DOCS_PAGE_PATHS.has(normalized)) {
    return [`${normalized}/`, `${normalized}/index.html`, `${normalized}/__page.mintlify`]
  }
  const indexPath = `${normalized}/index`
  if (DOCS_PAGE_PATHS.has(indexPath)) {
    return [`${indexPath}/`, `${indexPath}/index.html`, `${indexPath}/__page.mintlify`]
  }
  return ['/', '/index.html', '/__page.mintlify']
}

function requireInternalRunnerToken(request: Request, env: Env) {
  const expected = env.RESEARCH_INTERNAL_RUNNER_TOKEN?.trim()
  if (!expected) {
    return false
  }
  const authorization = request.headers.get('Authorization') ?? ''
  const actual = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : ''
  return actual === expected
}

async function proxyToControlPlane(env: Env, path: string, init: RequestInit) {
  const stub = controlPlaneStub(env)
  return stub.fetch(`https://control-plane${path}`, init)
}

async function proxyToControlPlaneJson<T>(env: Env, path: string, init: RequestInit) {
  const response = await proxyToControlPlane(env, path, init)
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Control plane request failed (${response.status}) for ${path}.${text ? ` ${text}` : ''}`)
  }
  if (!text) {
    return undefined as T
  }
  return JSON.parse(text) as T
}

function summarizeInput(input: unknown) {
  if (typeof input === 'string') {
    return input
  }
  return JSON.stringify(input, null, 2)
}

function normalizeGeneratedSessionTitle(value: string) {
  const normalized = value
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/^["'#\s]+|["'\s]+$/g, '')
    .replace(/^[-:;,.|/\\\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72)
    .trim()
  return normalized || null
}

function fallbackSessionTitleFromMessage(message: string) {
  const normalized = normalizeGeneratedSessionTitle(message)
  if (!normalized) {
    return 'Untitled chat'
  }
  return normalized.slice(0, 64).trim() || 'Untitled chat'
}

function extractResponseText(payload: Record<string, unknown>) {
  const outputText = typeof payload.output_text === 'string' ? payload.output_text.trim() : ''
  if (outputText) {
    return outputText
  }
  const output = Array.isArray(payload.output) ? payload.output : []
  const chunks: string[] = []
  for (const entry of output) {
    if (!entry || typeof entry !== 'object') continue
    const content = Array.isArray((entry as { content?: unknown[] }).content)
      ? (entry as { content: unknown[] }).content
      : []
    for (const item of content) {
      if (!item || typeof item !== 'object') continue
      if ((item as { type?: unknown }).type === 'output_text' && typeof (item as { text?: unknown }).text === 'string') {
        chunks.push((item as { text: string }).text)
      }
    }
  }
  return chunks.join('\n\n').trim()
}

function extractFunctionCalls(payload: ResponsesApiPayload) {
  return (payload.output ?? []).filter(
    (item): item is ResponseFunctionCall =>
      typeof item === 'object' && item !== null && (item as ResponseFunctionCall).type === 'function_call',
  )
}

async function closeToolCallResponse(
  env: Env,
  previousResponseId: string | null,
  toolOutput: { type: 'function_call_output'; call_id: string; output: string },
) {
  const response = await callResponsesApi(env, {
    previous_response_id: previousResponseId ?? undefined,
    input: [toolOutput],
    tool_choice: 'none',
  })
  const pendingFunctionCalls = extractFunctionCalls(response)
  if (pendingFunctionCalls.length > 0) {
    throw new Error('Responses API returned another function call while closing a tool-only assistant turn.')
  }
  return response.id ?? previousResponseId
}

function parseJsonArguments(rawArguments: string | undefined) {
  if (!rawArguments) {
    return {}
  }
  try {
    const parsed = JSON.parse(rawArguments)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // fall through
  }
  throw new Error(`Invalid tool arguments: ${rawArguments}`)
}

function buildToolSchema(tool: AgentToolDefinition) {
  return {
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }
}

function dashboardRunUrl(runId: string) {
  return `${WEB_DASHBOARD_ORIGIN}?view=runs&runId=${encodeURIComponent(runId)}`
}

function requireString(input: Record<string, unknown>, key: string) {
  const value = input[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required string: ${key}`)
  }
  return value.trim()
}

function sessionEntryToPlainText(entry: Record<string, unknown>) {
  const role = typeof entry.role === 'string' ? entry.role : 'entry'
  const title = typeof entry.title === 'string' && entry.title.trim() ? ` (${entry.title.trim()})` : ''
  const content = typeof entry.content === 'string' ? entry.content.trim() : ''
  if (!content) return ''
  return `${role}${title}:\n${content}`
}

function entriesToPlainTextChatHistory(entries: Array<Record<string, unknown>>) {
  return entries
    .filter((entry) => {
      const kind = typeof entry.kind === 'string' ? entry.kind : ''
      const content = typeof entry.content === 'string' ? entry.content : ''
      return kind !== 'tool_call' || content !== 'Calling plan_remote_run'
    })
    .map(sessionEntryToPlainText)
    .filter(Boolean)
    .join('\n\n')
}

const DATASET_PROMPT_SECTION_LIMIT = 12_000
const DATASET_PROMPT_TOTAL_LIMIT = 28_000

function truncatePromptSection(value: string, limit: number) {
  if (value.length <= limit) {
    return value
  }
  return `${value.slice(0, limit).trimEnd()}\n\n[Truncated to ${limit} characters for prompt context.]`
}

function promptContextValueToText(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string') {
    return value.trim()
  }
  return JSON.stringify(value, null, 2)
}

function datasetPromptSection(tag: string, value: unknown) {
  const text = promptContextValueToText(value)
  if (!text) {
    return ''
  }
  return [
    `<${tag}>`,
    truncatePromptSection(text, DATASET_PROMPT_SECTION_LIMIT),
    `</${tag}>`,
  ].join('\n')
}

async function datasetContentsForPrompt(env: Env, datasetId: string) {
  const payload = await proxyToControlPlaneJson<{ profile?: Record<string, unknown> | null }>(
    env,
    `/datasets/${encodeURIComponent(datasetId)}/profile`,
    { method: 'GET' },
  )
  const profile = payload.profile
  if (!profile) {
    return ''
  }
  const sections = [
    datasetPromptSection('dataset_briefing_markdown', profile.briefingMarkdown),
    datasetPromptSection('dataset_profile_json', profile.profile),
    datasetPromptSection('dataset_schema_json', profile.schema),
    datasetPromptSection('dataset_sample_rows_json', profile.sampleRows),
    datasetPromptSection('dataset_notes', profile.notes),
  ].filter(Boolean)

  if (sections.length === 0) {
    return ''
  }

  const contents = ['Dataset context files:', ...sections].join('\n\n')
  return truncatePromptSection(contents, DATASET_PROMPT_TOTAL_LIMIT)
}

async function buildRemoteRunPromptFromSessionHistory(env: Env, sessionId: string) {
  const payload = await proxyToControlPlaneJson<{ entries?: Array<Record<string, unknown>> }>(
    env,
    `/assistant-sessions/${encodeURIComponent(sessionId)}`,
    { method: 'GET' },
  )
  const chatHistory = entriesToPlainTextChatHistory(payload.entries ?? [])
  if (!chatHistory.trim()) {
    throw new Error('Cannot plan a remote run without chat history.')
  }
  const plannerPrompt = [
    'Write a prompt for a remote Alpha Research run based on this chat history.',
    '',
    'Return only the task-specific research request that should be appended after the standard Modal runner prompt.',
    'Preserve the user\'s intent and constraints, but do not add runtime boilerplate, dataset-environment framing, output-file requirements, or phrases like "You are operating inside".',
    'Do not mention work.md, report.html, /data, /workspace, /results, Modal, Codex, runner setup, manifests, or artifact directories; the runner prompt provides those instructions.',
    '',
    'Chat history:',
    '<chat_history>',
    chatHistory,
    '</chat_history>',
  ].join('\n')
  const response = await callResponsesApi(env, { input: plannerPrompt })
  const prompt = extractResponseText(response as Record<string, unknown>)
  if (!prompt) {
    throw new Error('Planner did not return a prompt.')
  }
  return { prompt, chatHistory }
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

async function hasApprovedRemoteRunPlan(env: Env, sessionId: string) {
  const payload = await proxyToControlPlaneJson<{ entries?: Array<Record<string, unknown>> }>(
    env,
    `/assistant-sessions/${encodeURIComponent(sessionId)}`,
    { method: 'GET' },
  )
  const entries = payload.entries ?? []
  const latestPlanIndex = entries.findLastIndex((entry) =>
    isRecordValue(entry.metadata) && entry.metadata.plannedRemoteRun === true,
  )
  if (latestPlanIndex === -1) {
    return false
  }
  return entries.slice(latestPlanIndex + 1).some((entry) =>
    entry.role === 'user' &&
    isRecordValue(entry.metadata) &&
    entry.metadata.approvedRemoteRunPlan === true,
  )
}

function latestRemoteRunPlan(entries: Array<Record<string, unknown>>) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]
    const metadata = isRecordValue(entry.metadata) ? entry.metadata : null
    if (!metadata || metadata.plannedRemoteRun !== true) continue
    const datasetId = typeof metadata.datasetId === 'string' ? metadata.datasetId : null
    const prompt = typeof metadata.prompt === 'string' ? metadata.prompt : null
    if (datasetId && prompt) {
      return { datasetId, prompt }
    }
  }
  return null
}

async function approveLatestRemoteRunPlan(env: Env, ownerEmail: string, sessionId: string) {
  const sessionPayload = await proxyToControlPlaneJson<{ entries?: Array<Record<string, unknown>> }>(
    env,
    `/assistant-sessions/${encodeURIComponent(sessionId)}`,
    { method: 'GET' },
  )
  const plan = latestRemoteRunPlan(sessionPayload.entries ?? [])
  if (!plan) {
    throw new Error('No pending remote-run plan found for this session.')
  }
  await appendAssistantSessionEntry(env, sessionId, {
    role: 'user',
    kind: 'approval',
    title: 'Approved remote run plan',
    content: 'Approved remote run plan.',
    metadata: {
      approvedRemoteRunPlan: true,
      datasetId: plan.datasetId,
      prompt: plan.prompt,
    },
  })
  const payload = await proxyToControlPlaneJson<{ run: { id: string } }>(
    env,
    `/datasets/${encodeURIComponent(plan.datasetId)}/runs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerEmail,
        callbackOrigin: WEB_DASHBOARD_ORIGIN,
        sessionId,
        prompt: plan.prompt,
      }),
    },
  )
  const summary = `Started run ${payload.run.id} on ${plan.datasetId}. Dashboard: ${dashboardRunUrl(payload.run.id)}`
  await appendAssistantSessionEntry(env, sessionId, {
    role: 'system',
    kind: 'tool_result',
    title: 'start_remote_run',
    content: summary,
    metadata: { name: 'start_remote_run', data: payload },
  })
  await appendAssistantSessionEntry(env, sessionId, {
    role: 'assistant',
    kind: 'local_summary',
    title: 'Assistant',
    content: summary,
    metadata: { approvedRemoteRunPlan: true, runId: payload.run.id },
  })
  return { ...payload, summary }
}

async function appendAssistantSessionEntry(env: Env, sessionId: string, body: Record<string, unknown>) {
  await proxyToControlPlane(env, `/assistant-sessions/${encodeURIComponent(sessionId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function proxyToResponsesApi(request: Request, env: Env) {
  const cliSession = await requireAuthorizedSession(request, env)
  if (!cliSession) {
    return json({ error: 'Unauthorized' }, 401)
  }
  if (!env.OPENAI_API_KEY) {
    return json({ error: 'Missing OPENAI_API_KEY on alpha-research worker' }, 502)
  }
  const body = await request.json().catch(() => ({}))
  const requestedSessionId = request.headers.get('X-Research-Session-Id')
  const previousResponseId =
    body && typeof body === 'object' && typeof (body as { previous_response_id?: unknown }).previous_response_id === 'string'
      ? String((body as { previous_response_id: string }).previous_response_id)
      : null
  const datasetId =
    body && typeof body === 'object' && typeof (body as { datasetId?: unknown }).datasetId === 'string'
      ? String((body as { datasetId: string }).datasetId)
      : null
  const sessionTitle =
    requestedSessionId || previousResponseId
      ? undefined
      : fallbackSessionTitleFromMessage(
          summarizeInput(body && typeof body === 'object' ? (body as { input?: unknown }).input ?? body : body),
        )
  const resolvedSessionResponse = await proxyToControlPlane(env, '/assistant-sessions/resolve-cli', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ownerEmail: cliSession.email,
      datasetId,
      sessionId: requestedSessionId,
      previousResponseId,
      title: sessionTitle,
    }),
  })
  const resolvedSessionPayload = await resolvedSessionResponse.json().catch(() => ({})) as {
    session?: { id?: string }
  }
  const assistantSessionId = resolvedSessionPayload.session?.id
  if (assistantSessionId) {
    await appendAssistantSessionEntry(env, assistantSessionId, {
      role: 'user',
      kind: 'request',
      title: 'CLI request',
      content: summarizeInput(body && typeof body === 'object' ? (body as { input?: unknown }).input ?? body : body),
      metadata: body,
    })
  }
  const payload = buildResponsesPayload(env, body)

  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  const text = await upstream.text()
  const headers = new Headers({
    'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
  })
  if (assistantSessionId) {
    headers.set('X-Research-Session-Id', assistantSessionId)
  }
  if (upstream.ok && assistantSessionId) {
    const upstreamPayload = JSON.parse(text) as Record<string, unknown>
    const responseId =
      typeof upstreamPayload.id === 'string'
        ? upstreamPayload.id
        : typeof upstreamPayload.response_id === 'string'
          ? upstreamPayload.response_id
          : null
    await appendAssistantSessionEntry(env, assistantSessionId, {
      role: 'assistant',
      kind: 'response',
      title: 'CLI response',
      content: extractResponseText(upstreamPayload) || JSON.stringify(upstreamPayload, null, 2),
      metadata: upstreamPayload,
    })
    if (responseId) {
      await proxyToControlPlane(env, '/assistant-sessions/link-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId, sessionId: assistantSessionId }),
      })
    }
  }
  return new Response(text, {
    status: upstream.status,
    headers,
  })
}

async function callResponsesApi(env: Env, body: Record<string, unknown>) {
  if (!env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY on alpha-research worker')
  }

  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(buildResponsesPayload(env, body)),
  })

  const text = await upstream.text()
  if (!upstream.ok) {
    throw new Error(`Responses API request failed (${upstream.status}).${text ? ` ${text}` : ''}`)
  }

  return JSON.parse(text) as ResponsesApiPayload
}

function buildResponsesPayload(env: Env, body: unknown) {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  return {
    model: env.RESEARCH_AGENT_MODEL ?? 'gpt-5',
    reasoning: { effort: 'low' },
    text: { verbosity: 'low' },
    max_output_tokens: 4096,
    ...input,
  }
}

function createResearchAgentTools(env: Env, ownerEmail: string): AgentToolDefinition[] {
  return [
    {
      name: 'list_remote_datasets',
      description: 'List datasets registered on the remote Alpha Research control plane.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
      async execute() {
        const payload = await proxyToControlPlaneJson<{ datasets: Array<Record<string, unknown>> }>(
          env,
          `/datasets?ownerEmail=${encodeURIComponent(ownerEmail)}`,
          { method: 'GET' },
        )
        const count = payload.datasets.length
        return {
          summary: count > 0 ? `Found ${count} remote dataset${count === 1 ? '' : 's'}.` : 'No remote datasets found.',
          data: payload,
        }
      },
    },
    {
      name: 'inspect_remote_dataset',
      description: 'Inspect a remote dataset including ingest config, deployment metadata, schema profile, and sample rows when available.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: { datasetId: { type: 'string' } },
        required: ['datasetId'],
      },
      async execute(input) {
        const datasetId = requireString(input, 'datasetId')
        const payload = await proxyToControlPlaneJson<{ dataset: Record<string, unknown> }>(
          env,
          `/datasets/${encodeURIComponent(datasetId)}`,
          { method: 'GET' },
        )
        return {
          summary: `Inspected remote dataset ${datasetId}.`,
          data: payload,
        }
      },
    },
    {
      name: 'compare_remote_datasets',
      description: 'Compare multiple remote datasets by schema, ingest config, deployment status, and profile metadata.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          datasetIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 2,
          },
        },
        required: ['datasetIds'],
      },
      async execute(input) {
        const datasetIds = Array.isArray(input.datasetIds) ? input.datasetIds.map(String) : []
        const datasets = await Promise.all(
          datasetIds.map(async (datasetId) => {
            const payload = await proxyToControlPlaneJson<{ dataset: Record<string, unknown> }>(
              env,
              `/datasets/${encodeURIComponent(datasetId)}`,
              { method: 'GET' },
            )
            return payload.dataset
          }),
        )
        return {
          summary: `Compared ${datasets.length} remote datasets.`,
          data: { datasets },
        }
      },
    },
    {
      name: 'list_tracked_runs',
      description: 'List RESEARCH runs for the signed-in account, including in-progress deploy or query runs.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
      async execute() {
        const payload = await proxyToControlPlaneJson<{ runs: Array<Record<string, unknown>> }>(
          env,
          `/runs?ownerEmail=${encodeURIComponent(ownerEmail)}`,
          { method: 'GET' },
        )
        return {
          summary:
            payload.runs.length > 0
              ? `Found ${payload.runs.length} tracked run${payload.runs.length === 1 ? '' : 's'}.`
              : 'No tracked runs yet.',
          data: payload,
        }
      },
    },
    {
      name: 'list_research_specs',
      description: 'List saved research specs or hypothesis plans for a dataset or account.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: { datasetId: { type: 'string' } },
      },
      async execute(input) {
        const datasetId = typeof input.datasetId === 'string' ? input.datasetId : null
        const suffix = datasetId ? `&datasetId=${encodeURIComponent(datasetId)}` : ''
        const payload = await proxyToControlPlaneJson<{ specs: Array<Record<string, unknown>> }>(
          env,
          `/research-specs?ownerEmail=${encodeURIComponent(ownerEmail)}${suffix}`,
          { method: 'GET' },
        )
        return {
          summary:
            payload.specs.length > 0
              ? `Found ${payload.specs.length} research spec${payload.specs.length === 1 ? '' : 's'}.`
              : 'No research specs found.',
          data: payload,
        }
      },
    },
    {
      name: 'create_research_spec',
      description: 'Create a structured research or hypothesis plan for a dataset, including subset, shaping, labeling, and result artifact requirements.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          datasetId: { type: 'string' },
          hypothesis: { type: 'string' },
          spec: { type: 'object' },
          status: { type: 'string' },
        },
        required: ['datasetId', 'hypothesis'],
      },
      async execute(input) {
        const payload = await proxyToControlPlaneJson<{ spec: Record<string, unknown> }>(env, '/research-specs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownerEmail,
            datasetId: requireString(input, 'datasetId'),
            hypothesis: requireString(input, 'hypothesis'),
            spec: input.spec && typeof input.spec === 'object' ? input.spec : undefined,
            status: typeof input.status === 'string' ? input.status : undefined,
          }),
        })
        return {
          summary: `Created research spec ${String(payload.spec.id ?? 'unknown')}.`,
          data: payload,
        }
      },
    },
    {
      name: 'update_remote_dataset_profile',
      description: 'Attach schema, sample rows, and notes to a remote dataset so future hypothesis planning can inspect the dataset content.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          datasetId: { type: 'string' },
          schema: {},
          sampleRows: {},
          notes: { type: 'string' },
        },
        required: ['datasetId'],
      },
      async execute(input) {
        const datasetId = requireString(input, 'datasetId')
        const payload = await proxyToControlPlaneJson<{ profile: Record<string, unknown> }>(
          env,
          `/datasets/${encodeURIComponent(datasetId)}/profile`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ownerEmail,
              schema: input.schema,
              sampleRows: input.sampleRows,
              notes: typeof input.notes === 'string' ? input.notes : undefined,
            }),
          },
        )
        return {
          summary: `Updated profile for remote dataset ${datasetId}.`,
          data: payload,
        }
      },
    },
    {
      name: 'deploy_remote_dataset',
      description: 'Provision remote infrastructure and start normalization for a registered dataset.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: { datasetId: { type: 'string' } },
        required: ['datasetId'],
      },
      async execute(input, sessionId) {
        const datasetId = requireString(input, 'datasetId')
        const payload = await proxyToControlPlaneJson<Record<string, unknown>>(
          env,
          `/datasets/${encodeURIComponent(datasetId)}/deploy`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ownerEmail,
              callbackOrigin: WEB_DASHBOARD_ORIGIN,
              sessionId,
            }),
          },
        )
        return {
          summary: `Started deployment for ${datasetId}.`,
          data: payload,
        }
      },
    },
    {
      name: 'plan_remote_run',
      description: 'Generate a draft remote-run prompt from the current chat history for user review. This does not start a run.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          datasetId: { type: 'string' },
        },
        required: ['datasetId'],
      },
      async execute(input, sessionId) {
        if (!sessionId) {
          throw new Error('Cannot plan a remote run without an assistant session.')
        }
        const datasetId = requireString(input, 'datasetId')
        const { prompt, chatHistory } = await buildRemoteRunPromptFromSessionHistory(env, sessionId)
        return {
          summary: `Prepared a remote run prompt for ${datasetId}. Review it below, then use the approval control to start the run.\n\n${prompt}`,
          data: {
            datasetId,
            prompt,
            chatHistoryLength: chatHistory.length,
          },
        }
      },
    },
    {
      name: 'start_remote_run',
      description: 'Start a structured remote agent run using a prompt the user has already reviewed and approved.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          datasetId: { type: 'string' },
          prompt: { type: 'string' },
        },
        required: ['datasetId', 'prompt'],
      },
      async execute(input, sessionId) {
        if (!sessionId || !(await hasApprovedRemoteRunPlan(env, sessionId))) {
          return {
            summary: 'I need to show you the planned remote-run prompt and get explicit approval before I can start the run.',
            data: { approvalRequired: true },
          }
        }
        const datasetId = requireString(input, 'datasetId')
        const prompt = requireString(input, 'prompt')
        const payload = await proxyToControlPlaneJson<{ run: { id: string } }>(
          env,
          `/datasets/${encodeURIComponent(datasetId)}/runs`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ownerEmail,
              callbackOrigin: WEB_DASHBOARD_ORIGIN,
              sessionId,
              prompt,
            }),
          },
        )
        return {
          summary: `Started run ${payload.run.id} on ${datasetId}. Dashboard: ${dashboardRunUrl(payload.run.id)}`,
          data: payload,
        }
      },
    },
    {
      name: 'query_remote_dataset',
      description: 'Run a lightweight remote query against a deployed dataset and return immediately with a run id and dashboard link.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          datasetId: { type: 'string' },
          prompt: { type: 'string' },
        },
        required: ['datasetId', 'prompt'],
      },
      async execute(input, sessionId) {
        const datasetId = requireString(input, 'datasetId')
        const prompt = requireString(input, 'prompt')
        const payload = await proxyToControlPlaneJson<{ run: { id: string } }>(
          env,
          `/datasets/${encodeURIComponent(datasetId)}/runs`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ownerEmail,
              callbackOrigin: WEB_DASHBOARD_ORIGIN,
              sessionId,
              prompt,
              type: 'query',
              artifacts: [{ type: 'query_result', title: 'Query Result' }],
            }),
          },
        )
        return {
          summary: `Started query run ${payload.run.id}. Dashboard: ${dashboardRunUrl(payload.run.id)}`,
          data: payload,
        }
      },
    },
    {
      name: 'aggregate_remote_dataset',
      description: 'Run a lightweight remote aggregation against a deployed dataset and return immediately with a run id and dashboard link.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          datasetId: { type: 'string' },
          prompt: { type: 'string' },
        },
        required: ['datasetId', 'prompt'],
      },
      async execute(input, sessionId) {
        const datasetId = requireString(input, 'datasetId')
        const prompt = requireString(input, 'prompt')
        const payload = await proxyToControlPlaneJson<{ run: { id: string } }>(
          env,
          `/datasets/${encodeURIComponent(datasetId)}/runs`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ownerEmail,
              callbackOrigin: WEB_DASHBOARD_ORIGIN,
              sessionId,
              prompt,
              type: 'query',
              artifacts: [{ type: 'aggregate_result', title: 'Aggregate Result' }],
            }),
          },
        )
        return {
          summary: `Started aggregate run ${payload.run.id}. Dashboard: ${dashboardRunUrl(payload.run.id)}`,
          data: payload,
        }
      },
    },
    {
      name: 'fetch_public_data',
      description: 'Queue a remote public-data acquisition run that fetches internet data into a research environment.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          datasetId: { type: 'string' },
          sourceDescription: { type: 'string' },
          prompt: { type: 'string' },
        },
        required: ['datasetId', 'sourceDescription'],
      },
      async execute(input, sessionId) {
        const datasetId = requireString(input, 'datasetId')
        const sourceDescription = requireString(input, 'sourceDescription')
        const payload = await proxyToControlPlaneJson<{ run: { id: string } }>(
          env,
          `/datasets/${encodeURIComponent(datasetId)}/runs`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ownerEmail,
              callbackOrigin: WEB_DASHBOARD_ORIGIN,
              sessionId,
              prompt: typeof input.prompt === 'string' ? input.prompt : `Fetch public data: ${sourceDescription}`,
              type: 'fetch',
              config: { sourceDescription },
            }),
          },
        )
        return {
          summary: `Queued public-data fetch run ${payload.run.id}. Dashboard: ${dashboardRunUrl(payload.run.id)}`,
          data: payload,
        }
      },
    },
    {
      name: 'start_remote_agent_run',
      description: 'Start a remote agent run on a dataset-attached cloud environment and track its results.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          datasetId: { type: 'string' },
          prompt: { type: 'string' },
          artifacts: { type: 'array', items: { type: 'object' } },
        },
        required: ['datasetId', 'prompt'],
      },
      async execute(input, sessionId) {
        const datasetId = requireString(input, 'datasetId')
        const prompt = requireString(input, 'prompt')
        const payload = await proxyToControlPlaneJson<{ run: { id: string } }>(
          env,
          `/datasets/${encodeURIComponent(datasetId)}/runs`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ownerEmail,
              callbackOrigin: WEB_DASHBOARD_ORIGIN,
              sessionId,
              prompt,
              type: 'agent',
              artifacts: Array.isArray(input.artifacts) ? input.artifacts : undefined,
            }),
          },
        )
        return {
          summary: `Queued remote agent run ${payload.run.id}. Dashboard: ${dashboardRunUrl(payload.run.id)}`,
          data: payload,
        }
      },
    },
    {
      name: 'continue_remote_agent_run',
      description: 'Continue a previous remote agent run by resuming its remote agent session with a follow-up prompt.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          runId: { type: 'string' },
          prompt: { type: 'string' },
          artifacts: { type: 'array', items: { type: 'object' } },
        },
        required: ['runId', 'prompt'],
      },
      async execute(input, sessionId) {
        const runId = requireString(input, 'runId')
        const previous = await proxyToControlPlaneJson<{
          run: { datasetId: string }
          artifacts: Array<{ type: string; content?: Record<string, unknown> }>
        }>(env, `/runs/${encodeURIComponent(runId)}/results`, { method: 'GET' })
        const sessionArtifact = previous.artifacts.find((artifact) => artifact.type === 'remote_agent_session')
        const remoteAgentSessionId =
          sessionArtifact && sessionArtifact.content && typeof sessionArtifact.content.sessionId === 'string'
            ? sessionArtifact.content.sessionId
            : ''
        if (!remoteAgentSessionId) {
          throw new Error(`Run ${runId} does not have a resumable remote agent session.`)
        }
        const payload = await proxyToControlPlaneJson<{ run: { id: string } }>(
          env,
          `/datasets/${encodeURIComponent(previous.run.datasetId)}/runs`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ownerEmail,
              callbackOrigin: WEB_DASHBOARD_ORIGIN,
              sessionId,
              prompt: requireString(input, 'prompt'),
              type: 'agent',
              config: { remoteAgentSessionId, parentRunId: runId },
              artifacts: Array.isArray(input.artifacts) ? input.artifacts : undefined,
            }),
          },
        )
        return {
          summary: `Queued continuation of remote agent session ${remoteAgentSessionId} as run ${payload.run.id}. Dashboard: ${dashboardRunUrl(payload.run.id)}`,
          data: payload,
        }
      },
    },
    {
      name: 'run_remote_transformation',
      description: 'Queue a remote transformation run that reshapes or filters data inside an existing research environment.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          datasetId: { type: 'string' },
          prompt: { type: 'string' },
          scriptOutline: { type: 'string' },
        },
        required: ['datasetId', 'prompt'],
      },
      async execute(input, sessionId) {
        const datasetId = requireString(input, 'datasetId')
        const payload = await proxyToControlPlaneJson<{ run: { id: string } }>(
          env,
          `/datasets/${encodeURIComponent(datasetId)}/runs`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ownerEmail,
              callbackOrigin: WEB_DASHBOARD_ORIGIN,
              sessionId,
              prompt: requireString(input, 'prompt'),
              type: 'transform',
              config: {
                scriptOutline: typeof input.scriptOutline === 'string' ? input.scriptOutline : undefined,
              },
            }),
          },
        )
        return {
          summary: `Queued transformation run ${payload.run.id}. Dashboard: ${dashboardRunUrl(payload.run.id)}`,
          data: payload,
        }
      },
    },
    {
      name: 'run_remote_labeling',
      description: 'Queue a remote labeling or enrichment run, including the explicit LLM prompt to use for labeling data points.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          datasetId: { type: 'string' },
          prompt: { type: 'string' },
          labelingPrompt: { type: 'string' },
        },
        required: ['datasetId', 'labelingPrompt'],
      },
      async execute(input, sessionId) {
        const datasetId = requireString(input, 'datasetId')
        const labelingPrompt = requireString(input, 'labelingPrompt')
        const payload = await proxyToControlPlaneJson<{ run: { id: string } }>(
          env,
          `/datasets/${encodeURIComponent(datasetId)}/runs`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ownerEmail,
              callbackOrigin: WEB_DASHBOARD_ORIGIN,
              sessionId,
              prompt: typeof input.prompt === 'string' ? input.prompt : `Run labeling job: ${labelingPrompt}`,
              type: 'label',
              config: { labelingPrompt },
            }),
          },
        )
        return {
          summary: `Queued labeling run ${payload.run.id}. Dashboard: ${dashboardRunUrl(payload.run.id)}`,
          data: payload,
        }
      },
    },
    {
      name: 'get_run_results',
      description: 'Retrieve a finished or in-progress run together with structured metadata, artifact requests, and accumulated events.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: { runId: { type: 'string' } },
        required: ['runId'],
      },
      async execute(input) {
        const runId = requireString(input, 'runId')
        const payload = await proxyToControlPlaneJson<Record<string, unknown>>(
          env,
          `/runs/${encodeURIComponent(runId)}/results`,
          { method: 'GET' },
        )
        const status =
          payload && typeof payload === 'object' && payload.run && typeof (payload.run as { status?: unknown }).status === 'string'
            ? String((payload.run as { status: string }).status)
            : 'unknown'
        return {
          summary: `Fetched results for run ${runId}. Status: ${status}.`,
          data: payload,
        }
      },
    },
    {
      name: 'list_run_artifacts',
      description: 'List requested or completed artifacts for a run, such as charts, tables, or result bundles.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: { runId: { type: 'string' } },
        required: ['runId'],
      },
      async execute(input) {
        const runId = requireString(input, 'runId')
        const payload = await proxyToControlPlaneJson<Record<string, unknown>>(
          env,
          `/runs/${encodeURIComponent(runId)}/artifacts`,
          { method: 'GET' },
        )
        return {
          summary: `Checked produced artifacts for run ${runId}.`,
          data: payload,
        }
      },
    },
    {
      name: 'cancel_remote_run',
      description: 'Cancel an in-progress remote run and release its dataset lease.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: { runId: { type: 'string' } },
        required: ['runId'],
      },
      async execute(input) {
        const runId = requireString(input, 'runId')
        const payload = await proxyToControlPlaneJson<Record<string, unknown>>(
          env,
          `/runs/${encodeURIComponent(runId)}/cancel`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ownerEmail }),
          },
        )
        return {
          summary: `Cancelled remote run ${runId}.`,
          data: payload,
        }
      },
    },
  ]
}

async function runResearchAssistantTurn(request: Request, env: Env) {
  const cliSession = await requireAuthorizedSession(request, env)
  if (!cliSession) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const body = await request.json().catch(() => ({})) as {
    input?: unknown
    sessionId?: unknown
    datasetId?: unknown
    previousResponseId?: unknown
    previous_response_id?: unknown
  }
  const input = typeof body.input === 'string' ? body.input.trim() : ''
  if (!input) {
    return json({ error: 'Missing input' }, 400)
  }

  const requestedSessionId = typeof body.sessionId === 'string' ? body.sessionId : null
  const datasetId = typeof body.datasetId === 'string' ? body.datasetId : null
  let previousResponseId =
    typeof body.previousResponseId === 'string'
      ? body.previousResponseId
      : typeof body.previous_response_id === 'string'
        ? body.previous_response_id
        : null
  const sessionTitle = requestedSessionId || previousResponseId ? undefined : fallbackSessionTitleFromMessage(input)

  const resolvedSession = await proxyToControlPlaneJson<{ session?: { id?: string } }>(
    env,
    '/assistant-sessions/resolve-cli',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerEmail: cliSession.email,
        datasetId,
        sessionId: requestedSessionId,
        previousResponseId,
        title: sessionTitle,
      }),
    },
  )
  const sessionId = resolvedSession.session?.id ?? requestedSessionId ?? null
  if (sessionId) {
    await appendAssistantSessionEntry(env, sessionId, {
      role: 'user',
      kind: 'request',
      title: 'Web request',
      content: input,
      metadata: { datasetId },
    })
  }

  let assistantInput = input
  if (datasetId) {
    try {
      const datasetPayload = await proxyToControlPlaneJson<{ dataset?: Record<string, unknown> }>(
        env,
        `/datasets/${encodeURIComponent(datasetId)}`,
        { method: 'GET' },
      )
      const dataset = datasetPayload.dataset
      const datasetName = dataset && typeof dataset.name === 'string' ? dataset.name : datasetId
      const datasetDescription = dataset && typeof dataset.description === 'string' ? dataset.description.trim() : ''
      const datasetPromptContents = await datasetContentsForPrompt(env, datasetId)
      assistantInput = [
        `Current dataset context: ${datasetName} (${datasetId}).`,
        datasetDescription ? `Dataset summary: ${datasetDescription}` : null,
        'The user started from this dataset page, so treat this dataset as the default context and do not ask them to restate the dataset id.',
        datasetPromptContents || null,
        'Use the dataset context above before asking the user for schema, coverage, field availability, briefing, or dataset identity details.',
        'If the request is broad or ambiguous, propose a concrete scoped next step with assumptions before asking for more information.',
        '',
        `User request: ${input}`,
      ].filter(Boolean).join('\n')
    } catch {
      assistantInput = [
        `Current dataset context: ${datasetId}.`,
        'The user started from this dataset page, so treat this dataset as the default context and do not ask them to restate the dataset id.',
        'If the request is broad or ambiguous, propose a concrete scoped next step with assumptions before asking for more information.',
        '',
        `User request: ${input}`,
      ].join('\n')
    }
  }

  const tools = createResearchAgentTools(env, cliSession.email).filter(
    (tool) => !MODEL_HIDDEN_RESEARCH_AGENT_TOOLS.has(tool.name),
  )
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]))
  let response = await callResponsesApi(env, {
    instructions: RESEARCH_AGENT_INSTRUCTIONS,
    input: assistantInput,
    previous_response_id: previousResponseId ?? undefined,
    tools: tools.map(buildToolSchema),
    parallel_tool_calls: false,
  })

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    if (response.id) {
      previousResponseId = response.id
    }
    const functionCalls = extractFunctionCalls(response)
    if (functionCalls.length === 0) {
      const reply = extractResponseText(response as Record<string, unknown>) || 'Done.'
      if (sessionId) {
        await appendAssistantSessionEntry(env, sessionId, {
          role: 'assistant',
          kind: 'local_summary',
          title: 'Assistant',
          content: reply,
          metadata: { previousResponseId },
        })
      }
      return json({
        sessionId,
        previousResponseId,
        reply,
      })
    }

    const toolOutputs: Array<{ type: 'function_call_output'; call_id: string; output: string }> = []
    for (const call of functionCalls) {
      const toolName = typeof call.name === 'string' ? call.name : ''
      const tool = toolsByName.get(toolName)
      if (!tool) {
        throw new Error(`Model requested unknown tool: ${toolName}`)
      }
      const parsedArguments = parseJsonArguments(call.arguments)
      if (sessionId) {
        await appendAssistantSessionEntry(env, sessionId, {
          role: 'system',
          kind: 'tool_call',
          title: tool.name,
          content: `Calling ${tool.name}`,
          metadata: { name: tool.name, arguments: parsedArguments },
        })
      }
      let result: AgentToolResult
      try {
        result = await tool.execute(parsedArguments, sessionId)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tool call failed'
        if (sessionId) {
          await appendAssistantSessionEntry(env, sessionId, {
            role: 'system',
            kind: 'tool_error',
            title: tool.name,
            content: message,
            metadata: { name: tool.name, arguments: parsedArguments, error: message },
          })
          await appendAssistantSessionEntry(env, sessionId, {
            role: 'assistant',
            kind: 'local_summary',
            title: 'Assistant',
            content: `I could not complete ${tool.name}: ${message}`,
            metadata: { previousResponseId, error: message, toolName: tool.name },
          })
        }
        throw error
      }
      if (sessionId) {
        await appendAssistantSessionEntry(env, sessionId, {
          role: 'system',
          kind: 'tool_result',
          title: tool.name,
          content: result.summary,
          metadata: { name: tool.name, data: result.data },
        })
      }
      const toolOutput = {
        type: 'function_call_output' as const,
        call_id: call.call_id ?? tool.name,
        output: JSON.stringify({
          ok: true,
          summary: result.summary,
          data: result.data,
        }),
      }
      if (ASYNC_RUN_START_TOOLS.has(tool.name)) {
        previousResponseId = await closeToolCallResponse(env, previousResponseId, toolOutput)
        if (
          tool.name === 'start_remote_run' &&
          isRecordValue(result.data) &&
          result.data.approvalRequired === true
        ) {
          if (sessionId) {
            await appendAssistantSessionEntry(env, sessionId, {
              role: 'assistant',
              kind: 'local_summary',
              title: 'Assistant',
              content: result.summary,
              metadata: { previousResponseId, approvalRequired: true },
            })
          }
          return json({
            sessionId,
            previousResponseId,
            reply: result.summary,
          })
        }
        if (sessionId) {
          await appendAssistantSessionEntry(env, sessionId, {
            role: 'assistant',
            kind: 'local_summary',
            title: 'Assistant',
            content: result.summary,
            metadata: { previousResponseId },
          })
        }
        return json({
          sessionId,
          previousResponseId,
          reply: result.summary,
        })
      }
      if (tool.name === 'plan_remote_run') {
        previousResponseId = await closeToolCallResponse(env, previousResponseId, toolOutput)
        if (sessionId) {
          await appendAssistantSessionEntry(env, sessionId, {
            role: 'assistant',
            kind: 'local_summary',
            title: 'Assistant',
            content: result.summary,
            metadata: {
              previousResponseId,
              plannedRemoteRun: true,
              ...(isRecordValue(result.data) ? result.data : {}),
            },
          })
        }
        return json({
          sessionId,
          previousResponseId,
          reply: result.summary,
        })
      }
      toolOutputs.push(toolOutput)
    }

    response = await callResponsesApi(env, {
      previous_response_id: previousResponseId ?? undefined,
      input: toolOutputs,
      tools: tools.map(buildToolSchema),
      parallel_tool_calls: false,
    })
  }

  throw new Error('Research assistant hit the tool round limit.')
}

async function forwardCliRequest(request: Request, env: Env, path: string, init: RequestInit = {}) {
  const cliSession = await requireAuthorizedSession(request, env)
  if (!cliSession) {
    return json({ error: 'Unauthorized' }, 401)
  }
  return proxyToControlPlane(env, path, init.method || init.body
    ? {
        ...init,
        headers: { 'Content-Type': 'application/json' },
      }
    : init)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname

    if (url.hostname === DOCS_HOST) {
      return fetchDocsAsset(request, env, url)
    }

    if (pathname === '/api/auth/start') {
      return request.method === 'POST'
        ? startAuthPost(createContext(request, env))
        : startAuthGet(createContext(request, env))
    }

    if (pathname === '/api/auth/callback' && request.method === 'GET') {
      return authCallbackGet(createContext(request, env))
    }

    if (pathname === '/api/auth/session' && request.method === 'GET') {
      return authSessionGet(createContext(request, env))
    }

    if (pathname === '/api/auth/bridge' && request.method === 'GET') {
      return authBridgeGet(createContext(request, env))
    }

    if (pathname === '/api/auth/logout' && request.method === 'POST') {
      return authLogoutPost(createContext(request, env))
    }

    if (pathname === '/cli/login' && request.method === 'GET') {
      return cliLoginGet(createContext(request, env))
    }

    if (pathname === '/api/cli/plan' && request.method === 'POST') {
      return cliPlanPost(createContext(request, env))
    }

    if (pathname === '/api/cli/respond' && request.method === 'POST') {
      return proxyToResponsesApi(request, env)
    }

    if (pathname === '/api/internal/runner-scripts/remote-agent.py' && request.method === 'GET') {
      if (!requireInternalRunnerToken(request, env)) {
        return new Response('Unauthorized', { status: 401 })
      }
      return new Response(remoteAgentRunnerScript, {
        status: 200,
        headers: { 'Content-Type': 'text/x-python; charset=utf-8' },
      })
    }

    if (pathname === '/api/cli/assistant/respond' && request.method === 'POST') {
      return runResearchAssistantTurn(request, env).catch((error) => {
        const message = error instanceof Error ? error.message : 'Research assistant request failed'
        return json({ error: message }, 500)
      })
    }

    if (pathname === '/api/cli/me' && request.method === 'GET') {
      const cliSession = await requireAuthorizedSession(request, env)
      if (!cliSession) {
        return json({ error: 'Unauthorized' }, 401)
      }
      return json({ user: { id: cliSession.email, email: cliSession.email } })
    }

    if (pathname === '/api/cli/datasets' && request.method === 'GET') {
      const cliSession = await requireAuthorizedSession(request, env)
      if (!cliSession) {
        return json({ error: 'Unauthorized' }, 401)
      }
      return proxyToControlPlane(
        env,
        `/datasets?ownerEmail=${encodeURIComponent(cliSession.email)}`,
        { method: 'GET' },
      )
    }

    if (pathname === '/api/cli/datasets' && request.method === 'POST') {
      const cliSession = await requireAuthorizedSession(request, env)
      if (!cliSession) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const body = await request.json().catch(() => ({}))
      return proxyToControlPlane(env, '/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, ownerEmail: cliSession.email }),
      })
    }

    const datasetMatch = pathname.match(/^\/api\/cli\/datasets\/([^/]+)$/u)
    if (datasetMatch && request.method === 'GET') {
      return forwardCliRequest(request, env, `/datasets/${encodeURIComponent(datasetMatch[1] ?? '')}`, { method: 'GET' })
    }
    if (datasetMatch && request.method === 'DELETE') {
      const cliSession = await requireAuthorizedSession(request, env)
      if (!cliSession) {
        return json({ error: 'Unauthorized' }, 401)
      }
      return proxyToControlPlane(
        env,
        `/datasets/${encodeURIComponent(datasetMatch[1] ?? '')}?ownerEmail=${encodeURIComponent(cliSession.email)}`,
        { method: 'DELETE' },
      )
    }

    const profileMatch = pathname.match(/^\/api\/cli\/datasets\/([^/]+)\/profile$/u)
    if (profileMatch && request.method === 'GET') {
      return forwardCliRequest(request, env, `/datasets/${encodeURIComponent(profileMatch[1] ?? '')}/profile`, { method: 'GET' })
    }
    if (profileMatch && request.method === 'POST') {
      const cliSession = await requireAuthorizedSession(request, env)
      if (!cliSession) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const body = await request.json().catch(() => ({}))
      return proxyToControlPlane(env, `/datasets/${encodeURIComponent(profileMatch[1] ?? '')}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, ownerEmail: cliSession.email }),
      })
    }

    const uploadMatch = pathname.match(/^\/api\/cli\/datasets\/([^/]+)\/source-upload$/u)
    if (uploadMatch && request.method === 'POST') {
      const cliSession = await requireAuthorizedSession(request, env)
      if (!cliSession) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const body = await request.json().catch(() => ({}))
      return proxyToControlPlane(env, `/datasets/${encodeURIComponent(uploadMatch[1] ?? '')}/source-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, ownerEmail: cliSession.email }),
      })
    }

    const uploadCompleteMatch = pathname.match(/^\/api\/cli\/datasets\/([^/]+)\/source-complete$/u)
    if (uploadCompleteMatch && request.method === 'POST') {
      const cliSession = await requireAuthorizedSession(request, env)
      if (!cliSession) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const body = await request.json().catch(() => ({}))
      return proxyToControlPlane(env, `/datasets/${encodeURIComponent(uploadCompleteMatch[1] ?? '')}/source-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, ownerEmail: cliSession.email }),
      })
    }

    const deployMatch = pathname.match(/^\/api\/cli\/datasets\/([^/]+)\/deploy$/u)
    if (deployMatch && request.method === 'POST') {
      const cliSession = await requireAuthorizedSession(request, env)
      if (!cliSession) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const body = await request.json().catch(() => ({}))
      return proxyToControlPlane(env, `/datasets/${encodeURIComponent(deployMatch[1] ?? '')}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          ownerEmail: cliSession.email,
          callbackOrigin: url.origin,
          sessionId: request.headers.get('X-Research-Session-Id') ?? body.sessionId,
        }),
      })
    }

    const publicEnvironmentMatch = pathname.match(/^\/api\/cli\/datasets\/([^/]+)\/(?:public-environment|research-environment)$/u)
    if (publicEnvironmentMatch && request.method === 'POST') {
      const cliSession = await requireAuthorizedSession(request, env)
      if (!cliSession) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const body = await request.json().catch(() => ({}))
      const endpoint = pathname.endsWith('/research-environment') ? 'research-environment' : 'public-environment'
      return proxyToControlPlane(env, `/datasets/${encodeURIComponent(publicEnvironmentMatch[1] ?? '')}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          ownerEmail: cliSession.email,
          callbackOrigin: url.origin,
          sessionId: request.headers.get('X-Research-Session-Id') ?? body.sessionId,
        }),
      })
    }

    if (pathname === '/api/cli/runs' && request.method === 'GET') {
      const cliSession = await requireAuthorizedSession(request, env)
      if (!cliSession) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const datasetId = url.searchParams.get('datasetId')
      const suffix = datasetId ? `&datasetId=${encodeURIComponent(datasetId)}` : ''
      return proxyToControlPlane(env, `/runs?ownerEmail=${encodeURIComponent(cliSession.email)}${suffix}`, {
        method: 'GET',
      })
    }

    if (pathname === '/api/cli/sessions' && request.method === 'GET') {
      const cliSession = await requireAuthorizedSession(request, env)
      if (!cliSession) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const kind = url.searchParams.get('kind')
      const runId = url.searchParams.get('runId')
      const datasetId = url.searchParams.get('datasetId')
      const params = new URLSearchParams({ ownerEmail: cliSession.email })
      if (kind) params.set('kind', kind)
      if (runId) params.set('runId', runId)
      if (datasetId) params.set('datasetId', datasetId)
      return proxyToControlPlane(env, `/assistant-sessions?${params.toString()}`, {
        method: 'GET',
      })
    }

    const runCreateMatch = pathname.match(/^\/api\/cli\/datasets\/([^/]+)\/runs$/u)
    if (runCreateMatch && request.method === 'POST') {
      const cliSession = await requireAuthorizedSession(request, env)
      if (!cliSession) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const body = await request.json().catch(() => ({}))
      return proxyToControlPlane(env, `/datasets/${encodeURIComponent(runCreateMatch[1] ?? '')}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          ownerEmail: cliSession.email,
          callbackOrigin: url.origin,
          sessionId: request.headers.get('X-Research-Session-Id') ?? body.sessionId,
        }),
      })
    }

    const runMatch = pathname.match(/^\/api\/cli\/runs\/([^/]+)$/u)
    if (runMatch && request.method === 'GET') {
      return forwardCliRequest(request, env, `/runs/${encodeURIComponent(runMatch[1] ?? '')}`, { method: 'GET' })
    }

    const sessionMatch = pathname.match(/^\/api\/cli\/sessions\/([^/]+)$/u)
    if (sessionMatch && request.method === 'GET') {
      return forwardCliRequest(request, env, `/assistant-sessions/${encodeURIComponent(sessionMatch[1] ?? '')}`, {
        method: 'GET',
      })
    }

    const sessionRemoteRunApprovalMatch = pathname.match(/^\/api\/cli\/sessions\/([^/]+)\/remote-run-plan\/approve$/u)
    if (sessionRemoteRunApprovalMatch && request.method === 'POST') {
      const cliSession = await requireAuthorizedSession(request, env)
      if (!cliSession) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const sessionId = decodeURIComponent(sessionRemoteRunApprovalMatch[1] ?? '')
      return approveLatestRemoteRunPlan(env, cliSession.email, sessionId)
        .then((payload) => json(payload))
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Could not approve remote-run plan'
          return json({ error: message }, 400)
        })
    }

    const sessionDebugViewMatch = pathname.match(/^\/api\/cli\/sessions\/([^/]+)\/debug-view$/u)
    if (sessionDebugViewMatch && request.method === 'GET') {
      return forwardCliRequest(
        request,
        env,
        `/assistant-sessions/${encodeURIComponent(sessionDebugViewMatch[1] ?? '')}/debug-view`,
        { method: 'GET' },
      )
    }

    const runCancelMatch = pathname.match(/^\/api\/cli\/runs\/([^/]+)\/cancel$/u)
    if (runCancelMatch && request.method === 'POST') {
      return forwardCliRequest(request, env, `/runs/${encodeURIComponent(runCancelMatch[1] ?? '')}/cancel`, { method: 'POST' })
    }

    const runEventsMatch = pathname.match(/^\/api\/cli\/runs\/([^/]+)\/events$/u)
    if (runEventsMatch && request.method === 'GET') {
      const after = url.searchParams.get('after')
      const suffix = after ? `?after=${encodeURIComponent(after)}` : ''
      return forwardCliRequest(
        request,
        env,
        `/runs/${encodeURIComponent(runEventsMatch[1] ?? '')}/events${suffix}`,
        { method: 'GET' },
      )
    }

    const runArtifactsMatch = pathname.match(/^\/api\/cli\/runs\/([^/]+)\/artifacts$/u)
    if (runArtifactsMatch && request.method === 'GET') {
      return forwardCliRequest(
        request,
        env,
        `/runs/${encodeURIComponent(runArtifactsMatch[1] ?? '')}/artifacts`,
        { method: 'GET' },
      )
    }

    const cliSessionEntryMatch = pathname.match(/^\/api\/cli\/sessions\/([^/]+)\/entries$/u)
    if (cliSessionEntryMatch && request.method === 'POST') {
      return forwardCliRequest(
        request,
        env,
        `/assistant-sessions/${encodeURIComponent(cliSessionEntryMatch[1] ?? '')}`,
        {
          method: 'POST',
          body: await request.text(),
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const runResultsMatch = pathname.match(/^\/api\/cli\/runs\/([^/]+)\/results$/u)
    if (runResultsMatch && request.method === 'GET') {
      return forwardCliRequest(
        request,
        env,
        `/runs/${encodeURIComponent(runResultsMatch[1] ?? '')}/results`,
        { method: 'GET' },
      )
    }

    const runDebugViewMatch = pathname.match(/^\/api\/cli\/runs\/([^/]+)\/debug-view$/u)
    if (runDebugViewMatch && request.method === 'GET') {
      return forwardCliRequest(
        request,
        env,
        `/runs/${encodeURIComponent(runDebugViewMatch[1] ?? '')}/debug-view`,
        { method: 'GET' },
      )
    }

    if (pathname === '/api/cli/research-specs' && request.method === 'GET') {
      const cliSession = await requireAuthorizedSession(request, env)
      if (!cliSession) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const datasetId = url.searchParams.get('datasetId')
      const suffix = datasetId ? `&datasetId=${encodeURIComponent(datasetId)}` : ''
      return proxyToControlPlane(env, `/research-specs?ownerEmail=${encodeURIComponent(cliSession.email)}${suffix}`, {
        method: 'GET',
      })
    }

    if (pathname === '/api/cli/research-specs' && request.method === 'POST') {
      const cliSession = await requireAuthorizedSession(request, env)
      if (!cliSession) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const body = await request.json().catch(() => ({}))
      return proxyToControlPlane(env, '/research-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, ownerEmail: cliSession.email }),
      })
    }

    const researchSpecMatch = pathname.match(/^\/api\/cli\/research-specs\/([^/]+)$/u)
    if (researchSpecMatch && request.method === 'GET') {
      return forwardCliRequest(
        request,
        env,
        `/research-specs/${encodeURIComponent(researchSpecMatch[1] ?? '')}`,
        { method: 'GET' },
      )
    }

    const internalEventMatch = pathname.match(/^\/api\/internal\/runs\/([^/]+)\/events$/u)
    if (internalEventMatch && request.method === 'POST') {
      const bearer = request.headers.get('Authorization') ?? ''
      if (bearer !== `Bearer ${env.RESEARCH_INTERNAL_RUNNER_TOKEN ?? ''}`) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const body = await request.text()
      return proxyToControlPlane(env, `/internal/runs/${encodeURIComponent(internalEventMatch[1] ?? '')}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', 'X-Run-Level': request.headers.get('X-Run-Level') ?? 'info' },
        body,
      })
    }

    const internalStatusMatch = pathname.match(/^\/api\/internal\/runs\/([^/]+)\/status$/u)
    if (internalStatusMatch && request.method === 'POST') {
      const bearer = request.headers.get('Authorization') ?? ''
      if (bearer !== `Bearer ${env.RESEARCH_INTERNAL_RUNNER_TOKEN ?? ''}`) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const body = await request.text()
      return proxyToControlPlane(env, `/internal/runs/${encodeURIComponent(internalStatusMatch[1] ?? '')}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    }

    const internalArtifactMatch = pathname.match(/^\/api\/internal\/runs\/([^/]+)\/artifacts$/u)
    if (internalArtifactMatch && request.method === 'POST') {
      const bearer = request.headers.get('Authorization') ?? ''
      if (bearer !== `Bearer ${env.RESEARCH_INTERNAL_RUNNER_TOKEN ?? ''}`) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const body = await request.text()
      return proxyToControlPlane(env, `/internal/runs/${encodeURIComponent(internalArtifactMatch[1] ?? '')}/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    }

    const internalSessionEntryMatch = pathname.match(/^\/api\/internal\/runs\/([^/]+)\/session-entries$/u)
    if (internalSessionEntryMatch && request.method === 'POST') {
      const bearer = request.headers.get('Authorization') ?? ''
      if (bearer !== `Bearer ${env.RESEARCH_INTERNAL_RUNNER_TOKEN ?? ''}`) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const body = await request.text()
      return proxyToControlPlane(env, `/internal/runs/${encodeURIComponent(internalSessionEntryMatch[1] ?? '')}/session-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    }

    return env.ASSETS.fetch(request)
  },
}

export { ControlPlane }
