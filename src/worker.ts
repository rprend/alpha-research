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
import { openAIUsageFromResponse, type BillingCheckResult } from './billing'
import { subscriptionRecordFromStripe, type StripeConfig, type SubscriptionRecord } from './stripe'
import Stripe from 'stripe'

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
  ALPHA_RESEARCH_ADMIN_TOKEN?: string
  ALPHA_RESEARCH_ALLOWED_EMAILS?: string
  WORKOS_REDIRECT_URI?: string
  OPENAI_API_KEY?: string
  RESEARCH_AGENT_MODEL?: string
  RESEARCH_AGENT_REASONING_EFFORT?: string
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
  STRIPE_SECRET_KEY?: string
  STRIPE_PUBLISHABLE_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  STRIPE_PRODUCT_ID?: string
  STRIPE_PRICE_ID?: string
  CONTROL_PLANE: DurableObjectNamespaceLike
  ARTIFACT_BUCKET?: unknown
}

type HandlerContext = {
  request: Request
  env: Env
}

type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
}

type AgentToolResult = {
  summary: string
  data?: unknown
  modelData?: unknown
  storedData?: unknown
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
  usage?: unknown
  output?: Array<ResponseFunctionCall | ResponseMessage | Record<string, unknown>>
}

type AssistantTrace = {
  id: string
  route: string
  startedAt: number
  marks: Array<{ name: string; elapsedMs: number; data?: Record<string, unknown> }>
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
const MAX_AGENT_TOOL_DATA_CHARS = 24_000
const MAX_STORED_TOOL_METADATA_CHARS = 12_000
const SESSION_CONTEXT_RECENT_ENTRY_LIMIT = 16
const SESSION_CONTEXT_TOTAL_LIMIT = 36_000
const SESSION_CONTEXT_ENTRY_LIMIT = 2_000
const REMOTE_RUN_CHAT_HISTORY_LIMIT = 32_000
const DATASET_INVENTORY_CONTEXT_LIMIT = 10_000
const ASYNC_RUN_START_TOOLS = new Set([
  'start_remote_run',
  'continue_remote_agent_run',
])

const RESEARCH_AGENT_INSTRUCTIONS = [
  'You are RESEARCH, a CLI agent for helping knowledge workers work faster.',
  'You help them create and manage remote research environments with large datasets, design experiments, and get the results.',
  'You manage the creation, operation, and prompting of other agents on remote cloud environments.',
  '',
  'In the web app, act like the RESEARCH CLI running remotely for the signed-in user.',
  'Use tools only when the user is asking for a concrete action or factual state that requires remote data.',
  'If the user input is gibberish, a greeting, or too vague to identify a research/data action, do not call tools. Ask one concise clarifying question instead.',
  'The prompt may include a static dataset inventory. Use that inventory as the first source for dataset names, ids, and one-sentence coverage summaries before calling list_remote_datasets.',
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

function createAssistantTrace(route: string): AssistantTrace {
  return {
    id: crypto.randomUUID(),
    route,
    startedAt: Date.now(),
    marks: [],
  }
}

function traceMark(trace: AssistantTrace | null, name: string, data?: Record<string, unknown>) {
  if (!trace) return
  trace.marks.push({
    name,
    elapsedMs: Date.now() - trace.startedAt,
    ...(data ? { data } : {}),
  })
}

function flushAssistantTrace(trace: AssistantTrace | null, status: 'ok' | 'error', data?: Record<string, unknown>) {
  if (!trace) return
  console.log(JSON.stringify({
    type: 'assistant_request_trace',
    traceId: trace.id,
    route: trace.route,
    status,
    totalMs: Date.now() - trace.startedAt,
    marks: trace.marks,
    ...(data ? { data } : {}),
  }))
}

function sseEncode(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function findSseEventBoundary(buffer: string) {
  const lf = buffer.indexOf('\n\n')
  const crlf = buffer.indexOf('\r\n\r\n')
  if (lf === -1) return crlf === -1 ? null : { index: crlf, length: 4 }
  if (crlf === -1) return { index: lf, length: 2 }
  return lf < crlf ? { index: lf, length: 2 } : { index: crlf, length: 4 }
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

function requireAdminToken(request: Request, env: Env) {
  const expected = env.ALPHA_RESEARCH_ADMIN_TOKEN?.trim()
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

function stripeConfig(env: Env): StripeConfig | null {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRODUCT_ID || !env.STRIPE_PRICE_ID) return null
  return {
    client: new Stripe(env.STRIPE_SECRET_KEY),
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    productId: env.STRIPE_PRODUCT_ID,
    priceId: env.STRIPE_PRICE_ID,
  }
}

async function billingSnapshot(env: Env, userId: string) {
  return proxyToControlPlaneJson<{ overview: BillingCheckResult; subscription: (SubscriptionRecord & { createdAt?: string }) | null }>(
    env,
    `/billing?userId=${encodeURIComponent(userId)}`,
    { method: 'GET' },
  )
}

async function billingOverview(env: Env, userId: string) {
  const { overview } = await billingSnapshot(env, userId)
  return overview
}

function billingLimitResponse(check: BillingCheckResult) {
  return json({
    error: 'Usage limit exceeded.',
    code: 'billing_limit_exceeded',
    tier: check.tier,
    subscriptionStatus: check.subscriptionStatus,
    limitCredits: check.limitCredits,
    usedCredits: check.usedCredits,
    remainingCredits: check.remainingCredits,
    spendUsd: check.spendUsd,
    windowStartedAt: check.windowStartedAt,
    windowEndsAt: check.windowEndsAt,
    checkoutEligible: check.checkoutEligible,
  }, 402)
}

async function requireBillingAllowance(env: Env, userId: string) {
  const check = await billingOverview(env, userId)
  return check.allowed ? null : billingLimitResponse(check)
}

async function trackOpenAIUsage(env: Env, args: {
  userId: string
  sessionId?: string | null
  runId?: string | null
  source: string
  operation: string
  model: string
  responsePayload: Record<string, unknown>
}) {
  const usage = openAIUsageFromResponse(args.responsePayload)
  if (!usage) return
  await proxyToControlPlane(env, '/billing/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: args.userId,
      sessionId: args.sessionId ?? null,
      runId: args.runId ?? null,
      source: args.source,
      event: {
        provider: 'openai',
        model: args.model,
        operation: args.operation,
        requestId: typeof args.responsePayload.id === 'string' ? args.responsePayload.id : null,
        responseJson: { id: args.responsePayload.id, usage: args.responsePayload.usage },
        ...usage,
      },
    }),
  }).catch(() => undefined)
}

function openAIUsagePayloadFromJson(payload: Record<string, unknown>) {
  return openAIUsageFromResponse(payload) ? payload : null
}

function openAIUsagePayloadFromEventStream(text: string) {
  let usagePayload: Record<string, unknown> | null = null
  for (const line of text.split(/\r?\n/u)) {
    if (!line.startsWith('data:')) continue
    const data = line.slice('data:'.length).trim()
    if (!data || data === '[DONE]') continue
    try {
      const parsed = JSON.parse(data) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
      const record = parsed as Record<string, unknown>
      if (openAIUsageFromResponse(record)) {
        usagePayload = record
        continue
      }
      const response = record.response
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        const responseRecord = response as Record<string, unknown>
        if (openAIUsageFromResponse(responseRecord)) {
          usagePayload = responseRecord
        }
      }
    } catch {
      continue
    }
  }
  return usagePayload
}

function openAIUsagePayloadFromText(text: string, contentType: string | null) {
  if (contentType?.includes('text/event-stream')) {
    return openAIUsagePayloadFromEventStream(text)
  }
  try {
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return openAIUsagePayloadFromJson(parsed as Record<string, unknown>)
  } catch {
    return null
  }
}

function remoteOpenAIOperation(pathname: string) {
  if (pathname.endsWith('/responses')) return 'responses.create'
  if (pathname.endsWith('/chat/completions')) return 'chat.completions.create'
  if (pathname.endsWith('/embeddings')) return 'embeddings.create'
  return `openai.${pathname.split('/v1/')[1]?.replaceAll('/', '.') || 'request'}`
}

function isMeteredOpenAIRequest(pathname: string, method: string) {
  return method === 'POST'
    && (
      pathname.endsWith('/responses')
      || pathname.endsWith('/chat/completions')
      || pathname.endsWith('/embeddings')
    )
}

function normalizeOpenAIProxyPath(proxyPath: string) {
  const trimmed = proxyPath.replace(/^\/+/, '')
  return trimmed.startsWith('v1/') ? trimmed : `v1/${trimmed}`
}

async function trackRemoteOpenAIUsage(env: Env, args: {
  runId: string
  source: string
  operation: string
  model: string
  requestPayload: Record<string, unknown> | null
  responsePayload: Record<string, unknown>
}) {
  const usage = openAIUsageFromResponse(args.responsePayload)
  if (!usage) return false
  const responseId = typeof args.responsePayload.id === 'string'
    ? args.responsePayload.id
    : typeof args.responsePayload.response_id === 'string'
      ? args.responsePayload.response_id
      : null
  const responseModel = typeof args.responsePayload.model === 'string' ? args.responsePayload.model : null
  const response = await proxyToControlPlane(
    env,
    `/internal/runs/${encodeURIComponent(args.runId)}/billing-events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: args.source,
        event: {
          provider: 'openai',
          model: responseModel ?? args.model,
          operation: args.operation,
          requestId: responseId,
          requestJson: args.requestPayload,
          responseJson: { id: args.responsePayload.id, usage: args.responsePayload.usage },
          metadata: { strictMeteredProxy: true },
          ...usage,
        },
      }),
    },
  )
  return response.ok
}

async function postInternalRunEvent(env: Env, runId: string, message: string, level = 'info') {
  await proxyToControlPlane(env, `/internal/runs/${encodeURIComponent(runId)}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'X-Run-Level': level },
    body: message,
  }).catch(() => undefined)
}

async function proxyRemoteOpenAIRequest(request: Request, env: Env, runId: string, proxyPath: string) {
  if (!requireInternalRunnerToken(request, env)) {
    return json({ error: 'Unauthorized' }, 401)
  }
  if (!env.OPENAI_API_KEY) {
    return json({ error: 'Missing OPENAI_API_KEY on alpha-research worker' }, 502)
  }

  const url = new URL(request.url)
  const isMetered = isMeteredOpenAIRequest(url.pathname, request.method)
  if (isMetered) {
    const billingResponse = await proxyToControlPlane(
      env,
      `/internal/runs/${encodeURIComponent(runId)}/billing-check`,
      { method: 'GET' },
    )
    const billingText = await billingResponse.text()
    if (!billingResponse.ok) {
      return json({ error: billingText || 'Billing check failed.' }, billingResponse.status)
    }
    const billing = billingText ? JSON.parse(billingText) as { overview?: BillingCheckResult } : {}
    if (billing.overview && !billing.overview.allowed) {
      return billingLimitResponse(billing.overview)
    }
  }

  const requestText = request.method === 'GET' || request.method === 'HEAD'
    ? null
    : await request.text()
  let requestPayload: Record<string, unknown> | null = null
  if (requestText) {
    try {
      const parsed = JSON.parse(requestText) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        requestPayload = parsed as Record<string, unknown>
      }
    } catch {}
  }

  const upstreamUrl = new URL(`https://api.openai.com/${normalizeOpenAIProxyPath(proxyPath)}`)
  upstreamUrl.search = url.search
  const upstreamHeaders = new Headers(request.headers)
  upstreamHeaders.set('Authorization', `Bearer ${env.OPENAI_API_KEY}`)
  upstreamHeaders.delete('Host')
  upstreamHeaders.delete('Content-Length')
  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: upstreamHeaders,
    body: requestText,
  })
  const responseHeaders = new Headers(upstream.headers)
  responseHeaders.delete('content-encoding')
  responseHeaders.delete('content-length')

  const contentType = upstream.headers.get('Content-Type')
  if (contentType?.includes('text/event-stream') && upstream.body) {
    if (!isMetered || !upstream.ok) {
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      })
    }
    const chunks: string[] = []
    const decoder = new TextDecoder()
    const requestModel = typeof requestPayload?.model === 'string' ? requestPayload.model : env.REMOTE_AGENT_MODEL ?? env.RESEARCH_AGENT_MODEL ?? 'gpt-5-codex'
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(decoder.decode(value, { stream: true }))
            controller.enqueue(value)
          }
          chunks.push(decoder.decode())
          const responseText = chunks.join('')
          const usagePayload = openAIUsagePayloadFromText(responseText, contentType)
          if (!usagePayload) {
            await postInternalRunEvent(
              env,
              runId,
              `Remote Codex metering failed: OpenAI ${remoteOpenAIOperation(url.pathname)} stream did not include usage.`,
              'error',
            )
          } else {
            const tracked = await trackRemoteOpenAIUsage(env, {
              runId,
              source: 'remote_codex_runner',
              operation: remoteOpenAIOperation(url.pathname),
              model: requestModel,
              requestPayload,
              responsePayload: usagePayload,
            })
            if (!tracked) {
              await postInternalRunEvent(
                env,
                runId,
                `Remote Codex metering failed: billing event could not be recorded for ${remoteOpenAIOperation(url.pathname)} stream.`,
                'error',
              )
            }
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        } finally {
          reader.releaseLock()
        }
      },
    })
    return new Response(stream, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  }

  const responseText = await upstream.text()
  if (!isMetered || !upstream.ok) {
    return new Response(responseText, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  }

  const usagePayload = openAIUsagePayloadFromText(responseText, upstream.headers.get('Content-Type'))
  if (!usagePayload) {
    await postInternalRunEvent(
      env,
      runId,
      `Remote Codex metering failed: OpenAI ${remoteOpenAIOperation(url.pathname)} response did not include usage.`,
      'error',
    )
    return json({
      error: 'Remote Codex metering failed because the OpenAI response did not include usage.',
      code: 'remote_codex_metering_failed',
    }, 502)
  }

  const requestModel = typeof requestPayload?.model === 'string' ? requestPayload.model : env.REMOTE_AGENT_MODEL ?? env.RESEARCH_AGENT_MODEL ?? 'gpt-5-codex'
  const tracked = await trackRemoteOpenAIUsage(env, {
    runId,
    source: 'remote_codex_runner',
    operation: remoteOpenAIOperation(url.pathname),
    model: requestModel,
    requestPayload,
    responsePayload: usagePayload,
  })
  if (!tracked) {
    await postInternalRunEvent(
      env,
      runId,
      `Remote Codex metering failed: billing event could not be recorded for ${remoteOpenAIOperation(url.pathname)}.`,
      'error',
    )
    return json({
      error: 'Remote Codex metering failed because the billing event could not be recorded.',
      code: 'remote_codex_metering_failed',
    }, 502)
  }

  return new Response(responseText, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

function publicBillingResponse(snapshot: { overview: BillingCheckResult; subscription: (SubscriptionRecord & { createdAt?: string }) | null }) {
  return {
    subscription: {
      tier: snapshot.overview.tier,
      status: snapshot.overview.subscriptionStatus,
      checkoutEligible: snapshot.overview.checkoutEligible,
      cancelAtPeriodEnd: snapshot.subscription?.cancelAtPeriodEnd ?? false,
      currentPeriodStart: snapshot.subscription?.currentPeriodStart ?? null,
      currentPeriodEnd: snapshot.subscription?.currentPeriodEnd ?? null,
    },
    usage: {
      usedCredits: snapshot.overview.usedCredits,
      monthlyCredits: snapshot.overview.limitCredits,
      remainingCredits: snapshot.overview.remainingCredits,
      windowStartedAt: snapshot.overview.windowStartedAt,
      windowEndsAt: snapshot.overview.windowEndsAt,
    },
  }
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

function clampSessionTitleWords(value: string) {
  const normalized = normalizeGeneratedSessionTitle(value)
  if (!normalized) return null
  const words = normalized
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 4)
  return words.join(' ').trim() || null
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

function prependStringInputContext(input: unknown, context: string) {
  if (!context.trim()) return input
  if (typeof input === 'string') {
    return `${context}\n\n${input}`
  }
  if (Array.isArray(input)) {
    return [
      {
        role: 'system',
        content: context,
      },
      ...input,
    ]
  }
  return input
}

async function addDatasetInventoryToResponsesBody(env: Env, ownerEmail: string, body: unknown, trace?: AssistantTrace | null) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body
  const record = { ...(body as Record<string, unknown>) }
  const context = await datasetsInventoryForPrompt(env, ownerEmail, trace)
  record.input = prependStringInputContext(record.input, context)
  return record
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

function entryCountsByKind(entries: Array<Record<string, unknown>>) {
  const counts: Record<string, number> = {}
  for (const entry of entries) {
    const kind = typeof entry.kind === 'string' && entry.kind.trim() ? entry.kind.trim() : 'message'
    counts[kind] = (counts[kind] ?? 0) + 1
  }
  return counts
}

function contextEntryText(entry: Record<string, unknown>, entryLimit = SESSION_CONTEXT_ENTRY_LIMIT) {
  return truncatePromptSection(sessionEntryToPlainText(entry), entryLimit)
}

function compactSessionChatHistory(
  entries: Array<Record<string, unknown>>,
  options: {
    totalLimit: number
    recentEntryLimit: number
    entryLimit?: number
    includeToolResults?: boolean
  },
) {
  const includeToolResults = options.includeToolResults ?? true
  const eligibleEntries = entries
    .filter((entry) => {
      const kind = typeof entry.kind === 'string' ? entry.kind : ''
      const content = typeof entry.content === 'string' ? entry.content : ''
      if (kind === 'tool_call') return false
      if (!includeToolResults && (kind === 'tool_result' || kind === 'tool_error')) return false
      return content !== 'Calling plan_remote_run'
    })
  const recentEntries = eligibleEntries.slice(-options.recentEntryLimit)
  const omittedEntries = eligibleEntries.slice(0, Math.max(0, eligibleEntries.length - recentEntries.length))
  const sections: string[] = []
  if (omittedEntries.length > 0) {
    sections.push([
      `Earlier session context omitted from this model view: ${omittedEntries.length} entr${omittedEntries.length === 1 ? 'y' : 'ies'}.`,
      `Omitted entry kinds: ${JSON.stringify(entryCountsByKind(omittedEntries))}.`,
    ].join('\n'))
  }
  sections.push(...recentEntries.map((entry) => contextEntryText(entry, options.entryLimit)))
  return {
    text: truncatePromptSection(sections.filter(Boolean).join('\n\n'), options.totalLimit),
    totalEntries: eligibleEntries.length,
    includedEntries: recentEntries.length,
    omittedEntries: omittedEntries.length,
    truncated: omittedEntries.length > 0 || sections.join('\n\n').length > options.totalLimit,
  }
}

function entriesToPlainTextChatHistory(entries: Array<Record<string, unknown>>) {
  return compactSessionChatHistory(entries, {
    totalLimit: REMOTE_RUN_CHAT_HISTORY_LIMIT,
    recentEntryLimit: SESSION_CONTEXT_RECENT_ENTRY_LIMIT,
    includeToolResults: false,
  }).text
}

async function assistantSessionEntriesForContext(env: Env, sessionId: string) {
  const payload = await proxyToControlPlaneJson<{ entries?: Array<Record<string, unknown>> }>(
    env,
    `/assistant-sessions/${encodeURIComponent(sessionId)}`,
    { method: 'GET' },
  )
  return payload.entries ?? []
}

async function datasetHeaderForPrompt(env: Env, datasetId: string) {
  const datasetPayload = await proxyToControlPlaneJson<{ dataset?: Record<string, unknown> }>(
    env,
    `/datasets/${encodeURIComponent(datasetId)}`,
    { method: 'GET' },
  )
  const dataset = datasetPayload.dataset
  const datasetName = dataset && typeof dataset.name === 'string' ? dataset.name : datasetId
  const datasetDescription = dataset && typeof dataset.description === 'string' ? dataset.description.trim() : ''
  const datasetPromptContents = await datasetContentsForPrompt(env, datasetId)
  return [
    `Current dataset context: ${datasetName} (${datasetId}).`,
    datasetDescription ? `Dataset summary: ${datasetDescription}` : null,
    'Treat this dataset as the session context and do not ask the user to restate the dataset id.',
    datasetPromptContents,
    'Use the dataset context above before asking the user for schema, coverage, field availability, briefing, or dataset identity details.',
    'If the request is broad or ambiguous, propose a concrete scoped next step with assumptions before asking for more information.',
  ].filter(Boolean).join('\n')
}

function datasetSummaryLine(dataset: Record<string, unknown>) {
  const id = typeof dataset.id === 'string' ? dataset.id : 'unknown'
  const name = typeof dataset.name === 'string' && dataset.name.trim() ? dataset.name.trim() : id
  const description = typeof dataset.description === 'string' ? dataset.description.trim() : ''
  const status = typeof dataset.status === 'string'
    ? dataset.status
    : typeof dataset.deploymentStatus === 'string'
      ? dataset.deploymentStatus
      : null
  const summary = description || 'Registered Alpha Research dataset.'
  return `${name} (${id})${status ? ` [${status}]` : ''}: ${summary.replace(/\s+/g, ' ')}`
}

async function datasetsInventoryForPrompt(env: Env, ownerEmail: string, trace?: AssistantTrace | null) {
  const startedAt = Date.now()
  const payload = await proxyToControlPlaneJson<{ datasets?: Array<Record<string, unknown>> }>(
    env,
    `/datasets?ownerEmail=${encodeURIComponent(ownerEmail)}`,
    { method: 'GET' },
  )
  const datasets = payload.datasets ?? []
  traceMark(trace ?? null, 'datasets_inventory_loaded', {
    datasetCount: datasets.length,
    elapsedMs: Date.now() - startedAt,
  })
  if (datasets.length === 0) {
    return 'Available datasets:\n<datasets>\nNo datasets are registered for this account.\n</datasets>'
  }
  const body = datasets.map(datasetSummaryLine).join('\n')
  return [
    'Available datasets. Use these summaries before calling dataset-listing tools:',
    '<datasets>',
    truncatePromptSection(body, DATASET_INVENTORY_CONTEXT_LIMIT),
    '</datasets>',
  ].join('\n')
}

async function buildAssistantModelContext(params: {
  env: Env
  ownerEmail: string
  sessionId: string | null
  datasetId: string | null
  userInput: string
  previousResponseId: string | null
  trace?: AssistantTrace | null
}) {
  const sections: string[] = []
  const decisions: Record<string, unknown> = {
    usedPreviousResponseId: Boolean(params.previousResponseId),
    resetPreviousResponseId: false,
    reason: 'direct_thread',
  }
  sections.push(await datasetsInventoryForPrompt(params.env, params.ownerEmail, params.trace))
  if (params.datasetId) {
    const startedAt = Date.now()
    sections.push(await datasetHeaderForPrompt(params.env, params.datasetId))
    traceMark(params.trace ?? null, 'session_dataset_context_loaded', {
      datasetId: params.datasetId,
      elapsedMs: Date.now() - startedAt,
    })
  }
  if (params.sessionId) {
    const startedAt = Date.now()
    const entries = await assistantSessionEntriesForContext(params.env, params.sessionId)
    traceMark(params.trace ?? null, 'session_entries_loaded', {
      sessionId: params.sessionId,
      entryCount: entries.length,
      elapsedMs: Date.now() - startedAt,
    })
    const lastEntry = entries.at(-1)
    const historyEntries =
      lastEntry &&
      lastEntry.role === 'user' &&
      typeof lastEntry.content === 'string' &&
      lastEntry.content.trim() === params.userInput.trim()
        ? entries.slice(0, -1)
        : entries
    const compactHistory = compactSessionChatHistory(historyEntries, {
      totalLimit: SESSION_CONTEXT_TOTAL_LIMIT,
      recentEntryLimit: SESSION_CONTEXT_RECENT_ENTRY_LIMIT,
    })
    decisions.sessionEntries = compactHistory.totalEntries
    decisions.includedSessionEntries = compactHistory.includedEntries
    decisions.omittedSessionEntries = compactHistory.omittedEntries
    decisions.compactedSessionHistory = compactHistory.truncated
    if (compactHistory.text) {
      sections.push([
        'Compact assistant session context:',
        '<assistant_session_context>',
        compactHistory.text,
        '</assistant_session_context>',
      ].join('\n'))
    }
    if (params.previousResponseId && compactHistory.truncated) {
      decisions.usedPreviousResponseId = false
      decisions.resetPreviousResponseId = true
      decisions.reason = 'compacted_session_history'
    }
  }
  sections.push(`User request: ${params.userInput}`)
  const input = sections.filter(Boolean).join('\n\n')
  traceMark(params.trace ?? null, 'model_context_built', {
    inputChars: input.length,
    usedPreviousResponseId: Boolean(params.previousResponseId),
    resetPreviousResponseId: decisions.resetPreviousResponseId,
  })
  return {
    input,
    previousResponseId: decisions.resetPreviousResponseId ? null : params.previousResponseId,
    decisions,
  }
}

function entriesToPlainTextChatHistoryForPlanner(entries: Array<Record<string, unknown>>) {
  return entriesToPlainTextChatHistory(entries)
}

const DATASET_PROMPT_SECTION_LIMIT = 12_000
const DATASET_PROMPT_TOTAL_LIMIT = 28_000

function truncatePromptSection(value: string, limit: number) {
  if (value.length <= limit) {
    return value
  }
  return `${value.slice(0, limit).trimEnd()}\n\n[Truncated to ${limit} characters for prompt context.]`
}

function truncateJsonPreview(value: unknown, limit = MAX_AGENT_TOOL_DATA_CHARS) {
  return JSON.stringify(value, null, 2).slice(0, limit)
}

function compactRun(run: unknown) {
  if (!isRecordValue(run)) return run
  return {
    id: run.id,
    datasetId: run.datasetId,
    type: run.type,
    status: run.status,
    title: run.title,
    description: run.description,
    outputPreview: run.outputPreview,
    artifactCount: run.artifactCount,
    sessionCount: run.sessionCount,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  }
}

function compactRunEvent(event: unknown) {
  if (!isRecordValue(event)) return event
  return {
    id: event.id,
    runId: event.runId,
    level: event.level,
    message: event.message,
    createdAt: event.createdAt,
  }
}

function compactArtifact(artifact: unknown) {
  if (!isRecordValue(artifact)) return artifact
  const content = isRecordValue(artifact.content) ? artifact.content : null
  return {
    id: artifact.id,
    runId: artifact.runId,
    type: artifact.type,
    title: artifact.title,
    url: artifact.url,
    createdAt: artifact.createdAt,
    content: content
      ? {
          path: content.path,
          mimeType: content.mimeType,
          sizeBytes: content.sizeBytes,
          truncated: content.truncated,
          note: content.note,
        }
      : undefined,
  }
}

function compactSession(session: unknown) {
  if (!isRecordValue(session)) return session
  const entries = Array.isArray(session.entries) ? session.entries : []
  return {
    id: session.id,
    kind: session.kind,
    status: session.status,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    entryCount: entries.length,
    lastEntries: entries.slice(-8).map((entry) => {
      if (!isRecordValue(entry)) return entry
      const content = typeof entry.content === 'string' ? entry.content : ''
      return {
        id: entry.id,
        role: entry.role,
        kind: entry.kind,
        title: entry.title,
        content: truncatePromptSection(content, 1200),
        createdAt: entry.createdAt,
      }
    }),
  }
}

function compactRunsPayload(payload: unknown) {
  if (!isRecordValue(payload)) return payload
  const runs = Array.isArray(payload.runs) ? payload.runs : []
  return {
    ...payload,
    runs: runs.slice(0, 25).map(compactRun),
    totalRuns: runs.length,
    truncated: runs.length > 25,
  }
}

function compactRunResultsPayload(payload: unknown) {
  if (!isRecordValue(payload)) return payload
  const events = Array.isArray(payload.events) ? payload.events : []
  const artifacts = Array.isArray(payload.artifacts) ? payload.artifacts : []
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : []
  return {
    run: compactRun(payload.run),
    metadata: payload.metadata,
    events: events.slice(-20).map(compactRunEvent),
    artifacts: artifacts.map(compactArtifact),
    sessions: sessions.map(compactSession),
    eventCount: events.length,
  }
}

function boundedToolData(value: unknown, limit: number) {
  if (value === undefined) return undefined
  const json = JSON.stringify(value)
  if (json.length <= limit) return value
  return {
    truncated: true,
    originalSizeBytes: json.length,
    preview: truncateJsonPreview(value, limit),
  }
}

function toolModelData(result: AgentToolResult) {
  return boundedToolData(result.modelData !== undefined ? result.modelData : result.data, MAX_AGENT_TOOL_DATA_CHARS)
}

function toolStoredData(result: AgentToolResult) {
  return boundedToolData(result.storedData !== undefined ? result.storedData : toolModelData(result), MAX_STORED_TOOL_METADATA_CHARS)
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

async function buildRemoteRunPromptFromSessionHistory(env: Env, sessionId: string, datasetId: string) {
  const payload = await proxyToControlPlaneJson<{ entries?: Array<Record<string, unknown>> }>(
    env,
    `/assistant-sessions/${encodeURIComponent(sessionId)}`,
    { method: 'GET' },
  )
  const chatHistory = entriesToPlainTextChatHistoryForPlanner(payload.entries ?? [])
  if (!chatHistory.trim()) {
    throw new Error('Cannot plan a remote run without chat history.')
  }
  const datasetPromptContents = await datasetContentsForPrompt(env, datasetId)
  const plannerPrompt = [
    'Write a prompt for a remote Alpha Research run based on this chat history.',
    '',
    `The run will execute against dataset ${datasetId}.`,
    datasetPromptContents,
    '',
    'The remote run prompt must mention the dataset and require checking the mounted dataset files, schema, samples, and briefing before drawing conclusions.',
    '',
    'Return only the task-specific research request that should be appended after the standard Modal runner prompt.',
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
  const billingBlock = await requireBillingAllowance(env, ownerEmail)
  if (billingBlock) {
    throw new Error('Usage limit exceeded. Upgrade to Pro to start another remote run.')
  }
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

async function updateAssistantSessionTitle(env: Env, sessionId: string, title: string) {
  await proxyToControlPlane(env, `/assistant-sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

function scheduleAssistantSessionTitleUpdate(
  ctx: WorkerExecutionContext | null,
  env: Env,
  sessionId: string,
  userMessage: string,
  assistantResponse: string,
) {
  const task = generateAssistantSessionTitle(env, userMessage, assistantResponse)
    .then((generatedTitle) => generatedTitle ? updateAssistantSessionTitle(env, sessionId, generatedTitle) : undefined)
    .catch(() => undefined)
  if (ctx) {
    ctx.waitUntil(task)
  }
  return task
}

async function generateAssistantSessionTitle(env: Env, userMessage: string, assistantResponse: string) {
  const prompt = [
    'Create a concise title for this chat.',
    'Use fewer than 5 words.',
    'Return only the title. No punctuation unless needed.',
    '',
    'First user message:',
    userMessage,
    '',
    'First assistant response:',
    assistantResponse,
  ].join('\n')
  const response = await callResponsesApi(env, {
    input: prompt,
    tool_choice: 'none',
  })
  return clampSessionTitleWords(extractResponseText(response as Record<string, unknown>))
}

async function proxyToResponsesApi(request: Request, env: Env, ctx: WorkerExecutionContext | null = null) {
  const trace = createAssistantTrace('/api/cli/responses')
  const cliSession = await requireAuthorizedSession(request, env)
  traceMark(trace, 'authorized', { ok: Boolean(cliSession) })
  if (!cliSession) {
    flushAssistantTrace(trace, 'error', { error: 'unauthorized' })
    return json({ error: 'Unauthorized' }, 401)
  }
  if (!env.OPENAI_API_KEY) {
    flushAssistantTrace(trace, 'error', { error: 'missing_openai_key' })
    return json({ error: 'Missing OPENAI_API_KEY on alpha-research worker' }, 502)
  }
  const billingBlock = await requireBillingAllowance(env, cliSession.email)
  traceMark(trace, 'billing_checked')
  if (billingBlock) {
    flushAssistantTrace(trace, 'error', { error: 'billing_limit' })
    return billingBlock
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
  const isNewSession = !requestedSessionId && !previousResponseId
  const initialUserMessage = summarizeInput(body && typeof body === 'object' ? (body as { input?: unknown }).input ?? body : body)
  const sessionTitle =
    isNewSession
      ? fallbackSessionTitleFromMessage(initialUserMessage)
      : undefined
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
  traceMark(trace, 'session_resolved', { sessionId: resolvedSessionPayload.session?.id ?? null, isNewSession })
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
  const enrichedBody = await addDatasetInventoryToResponsesBody(env, cliSession.email, body, trace)
  const payload = buildResponsesPayload(env, enrichedBody)

  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  const headers = new Headers({
    'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
  })
  if (assistantSessionId) {
    headers.set('X-Research-Session-Id', assistantSessionId)
  }
  if (headers.get('Content-Type')?.includes('text/event-stream') && upstream.body) {
    const decoder = new TextDecoder()
    const chunks: string[] = []
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(decoder.decode(value, { stream: true }))
            controller.enqueue(value)
          }
          chunks.push(decoder.decode())
          const text = chunks.join('')
          const usagePayload = openAIUsagePayloadFromText(text, headers.get('Content-Type'))
          if (upstream.ok && assistantSessionId && usagePayload) {
            await trackOpenAIUsage(env, {
              userId: cliSession.email,
              sessionId: assistantSessionId,
              source: 'cli_responses_proxy',
              operation: 'responses.create',
              model: typeof payload.model === 'string' ? payload.model : env.RESEARCH_AGENT_MODEL ?? 'gpt-5',
              responsePayload: usagePayload,
            })
            const responseId =
              typeof usagePayload.id === 'string'
                ? usagePayload.id
                : typeof usagePayload.response_id === 'string'
                  ? usagePayload.response_id
                  : null
            const assistantResponseText = extractResponseText(usagePayload)
            await appendAssistantSessionEntry(env, assistantSessionId, {
              role: 'assistant',
              kind: 'response',
              title: 'CLI response',
              content: assistantResponseText || JSON.stringify(usagePayload, null, 2),
              metadata: usagePayload,
            })
            if (isNewSession && assistantResponseText) {
              scheduleAssistantSessionTitleUpdate(ctx, env, assistantSessionId, initialUserMessage, assistantResponseText)
            }
            if (responseId) {
              await proxyToControlPlane(env, '/assistant-sessions/link-response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ responseId, sessionId: assistantSessionId }),
              })
            }
          }
          traceMark(trace, 'openai_stream_completed', {
            responseId: typeof usagePayload?.id === 'string' ? usagePayload.id : null,
          })
          flushAssistantTrace(trace, upstream.ok ? 'ok' : 'error', { streamed: true })
          controller.close()
        } catch (error) {
          flushAssistantTrace(trace, 'error', { error: error instanceof Error ? error.message : String(error), streamed: true })
          controller.error(error)
        } finally {
          reader.releaseLock()
        }
      },
    })
    return new Response(stream, {
      status: upstream.status,
      headers,
    })
  }

  const text = await upstream.text()
  if (upstream.ok && assistantSessionId) {
    const upstreamPayload = JSON.parse(text) as Record<string, unknown>
    await trackOpenAIUsage(env, {
      userId: cliSession.email,
      sessionId: assistantSessionId,
      source: 'cli_responses_proxy',
      operation: 'responses.create',
      model: typeof payload.model === 'string' ? payload.model : env.RESEARCH_AGENT_MODEL ?? 'gpt-5',
      responsePayload: upstreamPayload,
    })
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
    const assistantResponseText = extractResponseText(upstreamPayload)
    if (isNewSession && assistantResponseText) {
      scheduleAssistantSessionTitleUpdate(ctx, env, assistantSessionId, initialUserMessage, assistantResponseText)
    }
    if (responseId) {
      await proxyToControlPlane(env, '/assistant-sessions/link-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId, sessionId: assistantSessionId }),
      })
    }
  }
  flushAssistantTrace(trace, upstream.ok ? 'ok' : 'error', { streamed: false, status: upstream.status })
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

async function callResponsesApiStreaming(
  env: Env,
  body: Record<string, unknown>,
  onTextDelta: (delta: string) => void | Promise<void>,
  trace?: AssistantTrace | null,
) {
  if (!env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY on alpha-research worker')
  }

  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(buildResponsesPayload(env, { ...body, stream: true })),
  })

  if (!upstream.ok) {
    const text = await upstream.text()
    throw new Error(`Responses API request failed (${upstream.status}).${text ? ` ${text}` : ''}`)
  }
  if (!upstream.body) {
    throw new Error('Responses API streaming response did not include a body.')
  }

  const decoder = new TextDecoder()
  const reader = upstream.body.getReader()
  let buffer = ''
  let firstDelta = false
  let completed: ResponsesApiPayload | null = null
  let lastResponse: ResponsesApiPayload | null = null

  const handleEventData = async (data: string) => {
    if (!data || data === '[DONE]') return
    const parsed = JSON.parse(data) as Record<string, unknown>
    const type = typeof parsed.type === 'string' ? parsed.type : ''
    const delta = typeof parsed.delta === 'string'
      ? parsed.delta
      : typeof parsed.text === 'string' && type.endsWith('.delta')
        ? parsed.text
        : ''
    if (delta) {
      if (!firstDelta) {
        firstDelta = true
        traceMark(trace ?? null, 'openai_first_text_delta')
      }
      await onTextDelta(delta)
    }
    const response = parsed.response
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      lastResponse = response as ResponsesApiPayload
      if (type === 'response.completed') {
        completed = response as ResponsesApiPayload
      }
    }
  }

  const drainBuffer = async (flush = false) => {
    while (true) {
      const boundary = findSseEventBoundary(buffer)
      if (!boundary) break
      const rawEvent = buffer.slice(0, boundary.index)
      buffer = buffer.slice(boundary.index + boundary.length)
      const dataLines = rawEvent
        .split(/\r?\n/u)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trimStart())
      if (dataLines.length > 0) {
        await handleEventData(dataLines.join('\n'))
      }
    }
    if (flush && buffer.trim()) {
      const dataLines = buffer
        .split(/\r?\n/u)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trimStart())
      if (dataLines.length > 0) {
        await handleEventData(dataLines.join('\n'))
      }
      buffer = ''
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      await drainBuffer()
    }
    buffer += decoder.decode()
    await drainBuffer(true)
  } finally {
    reader.releaseLock()
  }

  const response = completed ?? lastResponse
  if (!response) {
    throw new Error('Responses API streaming response did not include a completed response.')
  }
  return response
}

function isContextLengthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('context_length_exceeded') || message.includes('exceeds the context window')
}

function buildResponsesPayload(env: Env, body: unknown) {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const model = typeof input.model === 'string' ? input.model : env.RESEARCH_AGENT_MODEL ?? 'gpt-5.5'
  const configuredEffort = env.RESEARCH_AGENT_REASONING_EFFORT?.trim()
  const reasoningEffort = configuredEffort || (model.includes('gpt-5.5') || model.includes('gpt-5.2') || model.includes('gpt-5.1') ? 'none' : 'minimal')
  return {
    model,
    reasoning: { effort: reasoningEffort },
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
          modelData: compactRunsPayload(payload),
          storedData: compactRunsPayload(payload),
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
        const { prompt, chatHistory } = await buildRemoteRunPromptFromSessionHistory(env, sessionId, datasetId)
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
          modelData: compactRunResultsPayload(payload),
          storedData: compactRunResultsPayload(payload),
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

async function runResearchAssistantTurn(request: Request, env: Env, ctx: WorkerExecutionContext | null = null) {
  const trace = createAssistantTrace('/api/cli/assistant/respond')
  const wantsStream = request.headers.get('Accept')?.includes('text/event-stream')
  const cliSession = await requireAuthorizedSession(request, env)
  traceMark(trace, 'authorized', { ok: Boolean(cliSession) })
  if (!cliSession) {
    flushAssistantTrace(trace, 'error', { error: 'unauthorized' })
    return json({ error: 'Unauthorized' }, 401)
  }
  const billingBlock = await requireBillingAllowance(env, cliSession.email)
  traceMark(trace, 'billing_checked')
  if (billingBlock) {
    flushAssistantTrace(trace, 'error', { error: 'billing_limit' })
    return billingBlock
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
    flushAssistantTrace(trace, 'error', { error: 'missing_input' })
    return json({ error: 'Missing input' }, 400)
  }

  if (wantsStream) {
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder()
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(sseEncode(event, data)))
        }
        try {
          const result = await runResearchAssistantTurnCore({
            env,
            ctx,
            cliSession,
            input,
            requestedSessionId: typeof body.sessionId === 'string' ? body.sessionId : null,
            datasetId: typeof body.datasetId === 'string' ? body.datasetId : null,
            previousResponseId:
              typeof body.previousResponseId === 'string'
                ? body.previousResponseId
                : typeof body.previous_response_id === 'string'
                  ? body.previous_response_id
                  : null,
            trace,
            onEvent: send,
            onTextDelta: (delta) => send('text_delta', { delta }),
          })
          send('final', result)
          flushAssistantTrace(trace, 'ok', {
            sessionId: result.sessionId,
            previousResponseId: result.previousResponseId,
            streamed: true,
          })
          controller.close()
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Research assistant request failed'
          send('error', { error: message })
          flushAssistantTrace(trace, 'error', { error: message, streamed: true })
          controller.close()
        }
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  }

  try {
    const result = await runResearchAssistantTurnCore({
      env,
      ctx,
      cliSession,
      input,
      requestedSessionId: typeof body.sessionId === 'string' ? body.sessionId : null,
      datasetId: typeof body.datasetId === 'string' ? body.datasetId : null,
      previousResponseId:
        typeof body.previousResponseId === 'string'
          ? body.previousResponseId
          : typeof body.previous_response_id === 'string'
            ? body.previous_response_id
            : null,
      trace,
    })
    flushAssistantTrace(trace, 'ok', {
      sessionId: result.sessionId,
      previousResponseId: result.previousResponseId,
      streamed: false,
    })
    return json(result)
  } catch (error) {
    flushAssistantTrace(trace, 'error', { error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}

async function runResearchAssistantTurnCore(params: {
  env: Env
  ctx: WorkerExecutionContext | null
  cliSession: { email: string }
  input: string
  requestedSessionId: string | null
  datasetId: string | null
  previousResponseId: string | null
  trace: AssistantTrace
  onEvent?: (event: string, data: unknown) => void
  onTextDelta?: (delta: string) => void | Promise<void>
}) {
  const { env, ctx, cliSession, input, requestedSessionId, datasetId, trace } = params
  let previousResponseId = params.previousResponseId

  const isNewSession = !requestedSessionId && !previousResponseId
  const sessionTitle = isNewSession ? fallbackSessionTitleFromMessage(input) : undefined

  const resolveStartedAt = Date.now()
  const resolvedSession = await proxyToControlPlaneJson<{ session?: { id?: string; datasetId?: string | null } }>(
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
  traceMark(trace, 'session_resolved', {
    elapsedMs: Date.now() - resolveStartedAt,
    requestedSessionId,
    resolvedSessionId: resolvedSession.session?.id ?? null,
    datasetId: resolvedSession.session?.datasetId ?? null,
    isNewSession,
  })
  const sessionId = resolvedSession.session?.id ?? requestedSessionId ?? null
  const sessionDatasetId = resolvedSession.session?.datasetId ?? null
  params.onEvent?.('session_resolved', { sessionId, datasetId: sessionDatasetId, traceId: trace.id })
  if (sessionId) {
    await appendAssistantSessionEntry(env, sessionId, {
      role: 'user',
      kind: 'request',
      title: 'Web request',
      content: input,
      metadata: { datasetId: sessionDatasetId },
    })
    traceMark(trace, 'user_entry_appended', { sessionId })
  }

  const contextBuild = await buildAssistantModelContext({
    env,
    ownerEmail: cliSession.email,
    sessionId,
    datasetId: sessionDatasetId,
    userInput: input,
    previousResponseId,
    trace,
  })
  const assistantInput = contextBuild.input
  const contextDecisions = { ...contextBuild.decisions }
  previousResponseId = contextBuild.previousResponseId

  const tools = createResearchAgentTools(env, cliSession.email)
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]))
  let response: ResponsesApiPayload
  try {
    const requestBody = {
      instructions: RESEARCH_AGENT_INSTRUCTIONS,
      input: assistantInput,
      previous_response_id: previousResponseId ?? undefined,
      tools: tools.map(buildToolSchema),
      parallel_tool_calls: false,
    }
    traceMark(trace, 'openai_request_started', { operation: 'responses.create' })
    response = params.onTextDelta
      ? await callResponsesApiStreaming(env, requestBody, params.onTextDelta, trace)
      : await callResponsesApi(env, requestBody)
    traceMark(trace, 'openai_response_completed', { responseId: response.id ?? null })
  } catch (error) {
    if (!previousResponseId || !isContextLengthError(error)) {
      throw error
    }
    previousResponseId = null
    contextDecisions.usedPreviousResponseId = false
    contextDecisions.resetPreviousResponseId = true
    contextDecisions.reason = 'openai_context_length_retry'
    const retryBody = {
      instructions: RESEARCH_AGENT_INSTRUCTIONS,
      input: [
        'The prior Responses thread became too large to continue directly. Continue using the current assistant session, dataset context, and tools.',
        '',
        assistantInput,
      ].join('\n'),
      tools: tools.map(buildToolSchema),
      parallel_tool_calls: false,
    }
    response = params.onTextDelta
      ? await callResponsesApiStreaming(env, retryBody, params.onTextDelta, trace)
      : await callResponsesApi(env, retryBody)
    traceMark(trace, 'openai_context_retry_completed', { responseId: response.id ?? null })
  }
  await trackOpenAIUsage(env, {
    userId: cliSession.email,
    sessionId,
    source: 'research_assistant',
    operation: 'responses.create',
    model: env.RESEARCH_AGENT_MODEL ?? 'gpt-5',
    responsePayload: response as Record<string, unknown>,
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
          metadata: { previousResponseId, context: contextDecisions },
        })
        if (isNewSession) {
          scheduleAssistantSessionTitleUpdate(ctx, env, sessionId, input, reply)
        }
      }
      return {
        sessionId,
        previousResponseId,
        reply,
      }
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
      params.onEvent?.('tool_call', { name: tool.name, arguments: parsedArguments })
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
            metadata: { previousResponseId, error: message, toolName: tool.name, context: contextDecisions },
          })
        }
        throw error
      }
      if (sessionId) {
        const storedData = toolStoredData(result)
        await appendAssistantSessionEntry(env, sessionId, {
          role: 'system',
          kind: 'tool_result',
          title: tool.name,
          content: result.summary,
          metadata: storedData === undefined ? { name: tool.name } : { name: tool.name, data: storedData },
        })
      }
      params.onEvent?.('tool_result', { name: tool.name, summary: result.summary })
      const modelData = toolModelData(result)
      const toolOutput = {
        type: 'function_call_output' as const,
        call_id: call.call_id ?? tool.name,
        output: JSON.stringify({
          ok: true,
          summary: result.summary,
          data: modelData,
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
              metadata: { previousResponseId, approvalRequired: true, context: contextDecisions },
            })
            if (isNewSession) {
              scheduleAssistantSessionTitleUpdate(ctx, env, sessionId, input, result.summary)
            }
          }
          return {
            sessionId,
            previousResponseId,
            reply: result.summary,
          }
        }
        if (sessionId) {
          await appendAssistantSessionEntry(env, sessionId, {
            role: 'assistant',
            kind: 'local_summary',
            title: 'Assistant',
            content: result.summary,
            metadata: { previousResponseId, context: contextDecisions },
          })
          if (isNewSession) {
            scheduleAssistantSessionTitleUpdate(ctx, env, sessionId, input, result.summary)
          }
        }
        return {
          sessionId,
          previousResponseId,
          reply: result.summary,
        }
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
              context: contextDecisions,
              plannedRemoteRun: true,
              ...(isRecordValue(result.data) ? result.data : {}),
            },
          })
          if (isNewSession) {
            scheduleAssistantSessionTitleUpdate(ctx, env, sessionId, input, result.summary)
          }
        }
        return {
          sessionId,
          previousResponseId,
          reply: result.summary,
        }
      }
      toolOutputs.push(toolOutput)
    }

    const followupBody = {
      previous_response_id: previousResponseId ?? undefined,
      input: toolOutputs,
      tools: tools.map(buildToolSchema),
      parallel_tool_calls: false,
    }
    response = params.onTextDelta
      ? await callResponsesApiStreaming(env, followupBody, params.onTextDelta, trace)
      : await callResponsesApi(env, followupBody)
    await trackOpenAIUsage(env, {
      userId: cliSession.email,
      sessionId,
      source: 'research_assistant',
      operation: 'responses.tool_followup',
      model: env.RESEARCH_AGENT_MODEL ?? 'gpt-5',
      responsePayload: response as Record<string, unknown>,
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
  async fetch(request: Request, env: Env, ctx: WorkerExecutionContext): Promise<Response> {
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
      const response = await authSessionGet(createContext(request, env))
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null
      if (!payload || response.status !== 200 || payload.authenticated !== true || !isRecordValue(payload.user)) {
        return json(payload ?? { authenticated: false }, response.status)
      }
      const email = typeof payload.user.email === 'string' ? payload.user.email : ''
      const billing = email ? publicBillingResponse(await billingSnapshot(env, email)) : null
      return json({ ...payload, billing }, response.status)
    }

    if (pathname === '/api/billing' && request.method === 'GET') {
      const session = await requireAuthorizedSession(request, env)
      if (!session) return json({ error: 'Unauthorized' }, 401)
      return json(publicBillingResponse(await billingSnapshot(env, session.email)))
    }

    if (pathname === '/api/billing/checkout' && request.method === 'POST') {
      const session = await requireAuthorizedSession(request, env)
      if (!session) return json({ error: 'Unauthorized' }, 401)
      const stripe = stripeConfig(env)
      if (!stripe) return json({ error: 'Stripe billing is not configured.' }, 501)
      const snapshot = await billingSnapshot(env, session.email)
      if (!snapshot.overview.checkoutEligible) return json({ error: 'This account already has a paid subscription.' }, 400)
      const checkout = await stripe.client.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: stripe.priceId, quantity: 1 }],
        success_url: `${new URL(request.url).origin}?view=dashboard&checkout=success`,
        cancel_url: `${new URL(request.url).origin}?view=dashboard&checkout=canceled`,
        allow_promotion_codes: true,
        client_reference_id: session.email,
        customer: snapshot.subscription?.stripeCustomerId ?? undefined,
        customer_email: snapshot.subscription?.stripeCustomerId ? undefined : session.email,
        metadata: { userId: session.email },
        subscription_data: { metadata: { userId: session.email } },
      })
      await proxyToControlPlane(env, '/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.email,
          stripeCustomerId: typeof checkout.customer === 'string' ? checkout.customer : snapshot.subscription?.stripeCustomerId ?? null,
          stripeSubscriptionId: typeof checkout.subscription === 'string' ? checkout.subscription : snapshot.subscription?.stripeSubscriptionId ?? null,
          stripeProductId: stripe.productId,
          stripePriceId: stripe.priceId,
          checkoutSessionId: checkout.id,
          tier: snapshot.subscription?.tier ?? 'free',
          status: snapshot.subscription?.status ?? 'incomplete',
          cancelAtPeriodEnd: snapshot.subscription?.cancelAtPeriodEnd ?? false,
          currentPeriodStart: snapshot.subscription?.currentPeriodStart ?? null,
          currentPeriodEnd: snapshot.subscription?.currentPeriodEnd ?? null,
          metadata: { ...(snapshot.subscription?.metadata ?? {}), lastCheckoutSessionId: checkout.id },
          createdAt: snapshot.subscription?.createdAt,
        }),
      })
      return json({ url: checkout.url })
    }

    if (pathname === '/api/billing/manage' && request.method === 'POST') {
      const session = await requireAuthorizedSession(request, env)
      if (!session) return json({ error: 'Unauthorized' }, 401)
      const stripe = stripeConfig(env)
      if (!stripe) return json({ error: 'Stripe billing is not configured.' }, 501)
      const snapshot = await billingSnapshot(env, session.email)
      const stripeCustomerId = snapshot.subscription?.stripeCustomerId ?? null
      if (!stripeCustomerId) return json({ error: 'This account does not have a billable subscription to manage.' }, 400)
      const portal = await stripe.client.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${new URL(request.url).origin}?view=dashboard`,
      })
      return json({ url: portal.url })
    }

    if (pathname === '/api/stripe/webhook' && request.method === 'POST') {
      const stripe = stripeConfig(env)
      if (!stripe?.webhookSecret) return json({ error: 'Stripe webhook signing secret is not configured.' }, 501)
      const signature = request.headers.get('stripe-signature')
      if (!signature) return json({ error: 'Missing Stripe signature.' }, 400)
      const rawBody = await request.text()
      let event: Stripe.Event
      try {
        event = stripe.client.webhooks.constructEvent(rawBody, signature, stripe.webhookSecret)
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Invalid Stripe signature.' }, 400)
      }
      if (event.type === 'checkout.session.completed') {
        const checkout = event.data.object
        const userId = checkout.metadata?.userId ?? checkout.client_reference_id ?? null
        if (checkout.mode === 'subscription' && userId && typeof checkout.subscription === 'string') {
          const subscription = await stripe.client.subscriptions.retrieve(checkout.subscription)
          await proxyToControlPlane(env, '/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscriptionRecordFromStripe({
              userId,
              subscription,
              config: stripe,
              stripeCustomerId: typeof checkout.customer === 'string' ? checkout.customer : null,
              checkoutSessionId: checkout.id,
              metadata: { webhookEvent: event.type },
            })),
          })
        }
      }
      if (
        event.type === 'customer.subscription.created'
        || event.type === 'customer.subscription.updated'
        || event.type === 'customer.subscription.deleted'
      ) {
        const subscription = event.data.object
        const existingBySubscription = await proxyToControlPlaneJson<{ subscription: (SubscriptionRecord & { createdAt?: string }) | null }>(
          env,
          `/subscriptions/lookup?stripeSubscriptionId=${encodeURIComponent(subscription.id)}`,
          { method: 'GET' },
        )
        const existingByCustomer = typeof subscription.customer === 'string'
          ? await proxyToControlPlaneJson<{ subscription: (SubscriptionRecord & { createdAt?: string }) | null }>(
              env,
              `/subscriptions/lookup?stripeCustomerId=${encodeURIComponent(subscription.customer)}`,
              { method: 'GET' },
            )
          : { subscription: null }
        const existing = existingBySubscription.subscription ?? existingByCustomer.subscription
        const userId = subscription.metadata.userId ?? existing?.userId ?? null
        if (userId) {
          await proxyToControlPlane(env, '/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...subscriptionRecordFromStripe({
                userId,
                subscription,
                config: stripe,
                stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : existing?.stripeCustomerId ?? null,
                checkoutSessionId: existing?.checkoutSessionId ?? null,
                metadata: { ...(existing?.metadata ?? {}), webhookEvent: event.type },
              }),
              createdAt: existing?.createdAt,
            }),
          })
        }
      }
      return json({ received: true })
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
      return proxyToResponsesApi(request, env, ctx)
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
      return runResearchAssistantTurn(request, env, ctx).catch((error) => {
        const message = error instanceof Error ? error.message : 'Research assistant request failed'
        return json({ error: message }, 500)
      })
    }

    if (pathname === '/api/admin/canonical-datasets/bootstrap' && request.method === 'POST') {
      if (!requireAdminToken(request, env)) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const body = await request.json().catch(() => ({}))
      return proxyToControlPlane(env, '/admin/canonical-datasets/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          callbackOrigin: url.origin,
        }),
      })
    }

    if (pathname === '/api/admin/subscriptions/grant' && request.method === 'POST') {
      if (!requireAdminToken(request, env)) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const body = await request.json().catch(() => ({})) as Record<string, unknown>
      const userId = typeof body.userId === 'string'
        ? body.userId.trim().toLowerCase()
        : typeof body.email === 'string'
          ? body.email.trim().toLowerCase()
          : ''
      if (!userId) {
        return json({ error: 'Missing userId or email' }, 400)
      }
      const now = new Date()
      const currentPeriodEnd = new Date(now)
      currentPeriodEnd.setUTCFullYear(currentPeriodEnd.getUTCFullYear() + 1)
      return proxyToControlPlane(env, '/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripeProductId: env.STRIPE_PRODUCT_ID ?? null,
          stripePriceId: env.STRIPE_PRICE_ID ?? null,
          checkoutSessionId: null,
          tier: 'studio',
          status: 'active',
          cancelAtPeriodEnd: false,
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: currentPeriodEnd.toISOString(),
          metadata: {
            source: 'admin_grant',
            grantedBy: 'ALPHA_RESEARCH_ADMIN_TOKEN',
            grantedAt: now.toISOString(),
          },
        }),
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
      const billingBlock = await requireBillingAllowance(env, cliSession.email)
      if (billingBlock) return billingBlock
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

    const artifactContentMatch = pathname.match(/^\/api\/cli\/artifacts\/([^/]+)\/content$/u)
    if (artifactContentMatch && request.method === 'GET') {
      return forwardCliRequest(
        request,
        env,
        `/artifacts/${encodeURIComponent(artifactContentMatch[1] ?? '')}/content`,
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

    const internalOpenAIMatch = pathname.match(/^\/api\/internal\/runs\/([^/]+)\/openai\/(.+)$/u)
    if (internalOpenAIMatch) {
      return proxyRemoteOpenAIRequest(
        request,
        env,
        decodeURIComponent(internalOpenAIMatch[1] ?? ''),
        internalOpenAIMatch[2] ?? '',
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
