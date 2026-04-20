const SESSION_COOKIE = 'ar_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const CLI_TOKEN_TTL_SECONDS = 60 * 10

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

export function getSessionConfig(env) {
  const email = env.ALPHA_RESEARCH_OWNER_EMAIL
  const password = env.ALPHA_RESEARCH_OWNER_PASSWORD
  const secret = env.ALPHA_RESEARCH_SESSION_SECRET
  if (!email || !password || !secret) {
    throw new Error('Missing ALPHA_RESEARCH_OWNER_EMAIL, ALPHA_RESEARCH_OWNER_PASSWORD, or ALPHA_RESEARCH_SESSION_SECRET')
  }
  return { email, password, secret }
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
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    return null
  }
  return payload
}

export async function createSessionCookie(secret, email) {
  const token = await createSignedToken(secret, {
    type: 'session',
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  })
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

export async function readSession(request, env) {
  const { secret } = getSessionConfig(env)
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
  const { secret } = getSessionConfig(env)
  return createSignedToken(secret, {
    type: 'cli',
    email,
    exp: Math.floor(Date.now() / 1000) + CLI_TOKEN_TTL_SECONDS,
  })
}

