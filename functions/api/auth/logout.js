import { clearSessionCookie } from '../../_utils/auth.js'

export async function onRequestPost(context) {
  return new Response(JSON.stringify({ authenticated: false }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(context.request),
    },
  })
}
