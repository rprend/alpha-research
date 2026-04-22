import { getAuthConfig, readSession } from '../../_utils/auth.js'

export async function onRequestGet(context) {
  try {
    getAuthConfig(context.env)
  } catch (error) {
    return new Response(JSON.stringify({
      authenticated: false,
      configured: false,
      error: error.message,
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  }

  const session = await readSession(context.request, context.env)
  return new Response(JSON.stringify({
    authenticated: Boolean(session),
    configured: true,
    user: session ? { email: session.email } : null,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
