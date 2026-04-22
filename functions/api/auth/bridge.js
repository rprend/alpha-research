import {
  createSessionCookie,
  getAuthConfig,
  normalizeAlphaResearchReturnTo,
  readSession,
} from '../../_utils/auth.js'

export async function onRequestGet(context) {
  let config
  try {
    config = getAuthConfig(context.env)
  } catch (error) {
    return Response.json({ error: error.message }, { status: 503 })
  }

  const url = new URL(context.request.url)
  const returnTo = normalizeAlphaResearchReturnTo(url.searchParams.get('return_to') ?? '/', url.origin)
  const session = await readSession(context.request, context.env).catch(() => null)

  if (session?.email) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: returnTo,
        'Set-Cookie': await createSessionCookie(config.secret, session.email, context.request),
      },
    })
  }

  const destination = new URL('/api/auth/start', url.origin)
  const bridgeReturn = new URL('/api/auth/bridge', url.origin)
  bridgeReturn.searchParams.set('return_to', returnTo)
  destination.searchParams.set('return_to', `${bridgeReturn.pathname}${bridgeReturn.search}`)

  return Response.redirect(destination.toString(), 302)
}
