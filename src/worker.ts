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
  DIGITALOCEAN_API_TOKEN?: string
  DIGITALOCEAN_REGION?: string
  DIGITALOCEAN_VOLUME_SIZE_GIB?: string
  DIGITALOCEAN_VOLUME_MOUNT_ROOT?: string
  DIGITALOCEAN_INGEST_DROPLET_SIZE?: string
  DIGITALOCEAN_INGEST_IMAGE?: string
  DIGITALOCEAN_SSH_KEY_IDS?: string
  DIGITALOCEAN_PROJECT_ID?: string
  DO_SPACES_BUCKET?: string
  DO_SPACES_REGION?: string
  DO_SPACES_ACCESS_KEY_ID?: string
  DO_SPACES_SECRET_ACCESS_KEY?: string
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
  CONTROL_PLANE: DurableObjectNamespaceLike
}

type HandlerContext = {
  request: Request
  env: Env
}

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

async function proxyToControlPlane(env: Env, path: string, init: RequestInit) {
  const stub = controlPlaneStub(env)
  return stub.fetch(`https://control-plane${path}`, init)
}

function summarizeInput(input: unknown) {
  if (typeof input === 'string') {
    return input
  }
  return JSON.stringify(input, null, 2)
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
  const resolvedSessionResponse = await proxyToControlPlane(env, '/assistant-sessions/resolve-cli', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ownerEmail: cliSession.email,
      datasetId,
      sessionId: requestedSessionId,
      previousResponseId,
      title: 'RESEARCH CLI session',
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
  const payload = typeof body === 'object' && body
    ? {
        model: env.RESEARCH_AGENT_MODEL ?? 'gpt-5',
        ...body,
      }
    : {
        model: env.RESEARCH_AGENT_MODEL ?? 'gpt-5',
      }

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
