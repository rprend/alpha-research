import { getSessionConfig, readSession } from '../../_utils/auth.js'

export async function onRequestGet(context) {
  try {
    getSessionConfig(context.env)
  } catch (error) {
    return Response.json({
      authenticated: false,
      configured: false,
      error: error.message,
    }, { status: 503 })
  }

  const session = await readSession(context.request, context.env)
  return Response.json({
    authenticated: Boolean(session),
    configured: true,
    user: session ? { email: session.email } : null,
  })
}

