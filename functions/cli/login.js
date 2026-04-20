import { createCliToken, readSession } from '../_utils/auth.js'

export async function onRequestGet(context) {
  const url = new URL(context.request.url)
  const state = url.searchParams.get('state')
  const redirectUri = url.searchParams.get('redirect_uri')

  if (!state || !redirectUri) {
    return new Response('Missing state or redirect_uri', { status: 400 })
  }

  const session = await readSession(context.request, context.env)
  if (!session) {
    const loginUrl = new URL('/api/auth/login', url.origin)
    loginUrl.searchParams.set('return_to', url.pathname + url.search)
    return Response.redirect(loginUrl.toString(), 302)
  }

  let callback
  try {
    callback = new URL(redirectUri)
  } catch {
    return new Response('Invalid redirect_uri', { status: 400 })
  }

  if (!['http:', 'https:'].includes(callback.protocol)) {
    return new Response('Unsupported redirect_uri protocol', { status: 400 })
  }

  const cliToken = await createCliToken(context.env, session.email)
  callback.searchParams.set('state', state)
  callback.searchParams.set('token', cliToken)
  return Response.redirect(callback.toString(), 302)
}
