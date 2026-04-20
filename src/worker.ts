// @ts-expect-error Cloudflare Worker entrypoint imports JS auth handlers.
import { onRequestGet as startAuthGet, onRequestPost as startAuthPost } from '../functions/api/auth/start.js'
// @ts-expect-error Cloudflare Worker entrypoint imports JS auth handlers.
import { onRequestGet as authCallbackGet } from '../functions/api/auth/callback.js'
// @ts-expect-error Cloudflare Worker entrypoint imports JS auth handlers.
import { onRequestGet as authSessionGet } from '../functions/api/auth/session.js'
// @ts-expect-error Cloudflare Worker entrypoint imports JS auth handlers.
import { onRequestPost as authLogoutPost } from '../functions/api/auth/logout.js'
// @ts-expect-error Cloudflare Worker entrypoint imports JS auth handlers.
import { onRequestGet as cliLoginGet } from '../functions/cli/login.js'
// @ts-expect-error Cloudflare Worker entrypoint imports JS auth handlers.
import { onRequestPost as cliPlanPost } from '../functions/cli/plan.js'

type AssetFetcher = {
  fetch(request: Request): Promise<Response>
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
}

type HandlerContext = {
  request: Request
  env: Env
}

function createContext(request: Request, env: Env): HandlerContext {
  return { request, env }
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

    if (pathname === '/api/auth/logout' && request.method === 'POST') {
      return authLogoutPost(createContext(request, env))
    }

    if (pathname === '/cli/login' && request.method === 'GET') {
      return cliLoginGet(createContext(request, env))
    }

    if (pathname === '/api/cli/plan' && request.method === 'POST') {
      return cliPlanPost(createContext(request, env))
    }

    return env.ASSETS.fetch(request)
  },
}
