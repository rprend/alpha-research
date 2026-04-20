import { createSessionCookie, getSessionConfig } from '../../_utils/auth.js'

export async function onRequestPost(context) {
  let body = {}
  try {
    body = await context.request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  let config
  try {
    config = getSessionConfig(context.env)
  } catch (error) {
    return Response.json({ error: error.message }, { status: 503 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (email !== config.email.trim().toLowerCase() || password !== config.password) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const response = Response.json({
    authenticated: true,
    user: { email: config.email },
  })
  response.headers.append('Set-Cookie', await createSessionCookie(config.secret, config.email))
  return response
}

