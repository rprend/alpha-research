import { WorkOS } from '@workos-inc/node'

const SESSION_COOKIE = 'ar_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const CLI_TOKEN_TTL_SECONDS = SESSION_MAX_AGE_SECONDS
const LOGIN_STATE_TTL_SECONDS = 60 * 10

function encodeBase64Url(input) {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (normalized.length % 4)) % 4
  return atob(`${normalized}${'='.repeat(padLength)}`)
}

function hexFromArrayBuffer(buffer) {
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function signValue(secret, value) {
  const key = await importHmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return hexFromArrayBuffer(signature)
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000)
}

export function getAuthConfig(env) {
  const apiKey = env.WORKOS_API_KEY
  const clientId = env.WORKOS_CLIENT_ID
  const secret = env.ALPHA_RESEARCH_SESSION_SECRET
  const allowedEmails = typeof env.ALPHA_RESEARCH_ALLOWED_EMAILS === 'string'
    ? env.ALPHA_RESEARCH_ALLOWED_EMAILS.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
    : []

  if (!apiKey || !clientId || !secret) {
    throw new Error('Missing WORKOS_API_KEY, WORKOS_CLIENT_ID, or ALPHA_RESEARCH_SESSION_SECRET')
  }

  return { apiKey, clientId, secret, allowedEmails }
}

export function getAdminEmails(env) {
  return typeof env.ALPHA_RESEARCH_ADMIN_EMAILS === 'string'
    ? env.ALPHA_RESEARCH_ADMIN_EMAILS.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
    : []
}

export function isAdminEmail(env, email) {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!normalized) return false
  return getAdminEmails(env).includes(normalized)
}

export function createWorkOS(env) {
  const { apiKey, clientId } = getAuthConfig(env)
  return new WorkOS(apiKey, { clientId })
}

export function parseCookies(request) {
  const header = request.headers.get('Cookie') ?? ''
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=')
        return index === -1 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]
      }),
  )
}

export function getRedirectUri(env, request) {
  if (env.WORKOS_REDIRECT_URI) {
    return env.WORKOS_REDIRECT_URI
  }
  const url = new URL(request.url)
  return `${url.origin}/api/auth/callback`
}

export function isAlphaResearchHost(hostname) {
  const normalized = hostname.trim().toLowerCase()
  return normalized === 'alpharesearch.nyc'
    || normalized.endsWith('.alpharesearch.nyc')
    || normalized === 'localhost'
    || normalized === '127.0.0.1'
}

function getSharedCookieDomain(requestOrUrl) {
  const url = typeof requestOrUrl === 'string'
    ? new URL(requestOrUrl)
    : new URL(requestOrUrl.url)
  const hostname = url.hostname.toLowerCase()

  if (isAlphaResearchHost(hostname) && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return 'alpharesearch.nyc'
  }

  return null
}

export function normalizeReturnTo(value, origin) {
  if (!value) {
    return '/'
  }

  if (value.startsWith('/')) {
    return value
  }

  try {
    const parsed = new URL(value)
    if (parsed.origin !== origin) {
      return '/'
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return '/'
  }
}

export function normalizeAlphaResearchReturnTo(value, origin) {
  if (!value) {
    return new URL('/', origin).toString()
  }

  if (value.startsWith('/')) {
    return new URL(value, origin).toString()
  }

  try {
    const parsed = new URL(value)
    if (!isAlphaResearchHost(parsed.hostname)) {
      return new URL('/', origin).toString()
    }
    return parsed.toString()
  } catch {
    return new URL('/', origin).toString()
  }
}

export async function createSignedToken(secret, payload) {
  const serialized = JSON.stringify(payload)
  const encoded = encodeBase64Url(serialized)
  const signature = await signValue(secret, encoded)
  return `${encoded}.${signature}`
}

export async function verifySignedToken(secret, token) {
  if (!token) {
    return null
  }

  const [encoded, providedSignature] = token.split('.')
  if (!encoded || !providedSignature) {
    return null
  }

  const expectedSignature = await signValue(secret, encoded)
  if (expectedSignature !== providedSignature) {
    return null
  }

  const payload = JSON.parse(decodeBase64Url(encoded))
  if (typeof payload.exp !== 'number' || payload.exp < nowInSeconds()) {
    return null
  }

  return payload
}

export async function createLoginState(secret, returnTo) {
  return createSignedToken(secret, {
    type: 'login_state',
    returnTo,
    exp: nowInSeconds() + LOGIN_STATE_TTL_SECONDS,
  })
}

export async function readLoginState(secret, token) {
  const payload = await verifySignedToken(secret, token)
  if (!payload || payload.type !== 'login_state' || typeof payload.returnTo !== 'string') {
    return null
  }
  return payload
}

export async function createSessionCookie(secret, email, requestOrUrl) {
  const token = await createSignedToken(secret, {
    type: 'session',
    email,
    exp: nowInSeconds() + SESSION_MAX_AGE_SECONDS,
  })
  const domain = getSharedCookieDomain(requestOrUrl)
  const domainAttribute = domain ? `; Domain=${domain}` : ''
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${domainAttribute}`
}

export function clearSessionCookie(requestOrUrl) {
  const domain = requestOrUrl ? getSharedCookieDomain(requestOrUrl) : null
  const domainAttribute = domain ? `; Domain=${domain}` : ''
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0${domainAttribute}`
}

export async function readSession(request, env) {
  const { secret } = getAuthConfig(env)
  const cookies = parseCookies(request)
  const token = cookies[SESSION_COOKIE]
  if (!token) {
    return null
  }
  const payload = await verifySignedToken(secret, token)
  if (!payload || payload.type !== 'session' || typeof payload.email !== 'string') {
    return null
  }
  return payload
}

export async function createCliToken(env, email) {
  const { secret } = getAuthConfig(env)
  return createSignedToken(secret, {
    type: 'cli',
    email,
    exp: nowInSeconds() + CLI_TOKEN_TTL_SECONDS,
  })
}

export async function readCliBearerToken(request, env) {
  const { secret } = getAuthConfig(env)
  const header = request.headers.get('Authorization') ?? ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) {
    return null
  }
  const payload = await verifySignedToken(secret, token)
  if (!payload || payload.type !== 'cli' || typeof payload.email !== 'string') {
    return null
  }
  return payload
}

export function isAllowedEmail(env, email) {
  const { allowedEmails } = getAuthConfig(env)
  if (allowedEmails.length === 0) {
    return true
  }
  return allowedEmails.includes(email.trim().toLowerCase())
}
