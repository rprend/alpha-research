import { clearSessionCookie } from '../../_utils/auth.js'

export async function onRequestPost() {
  const response = Response.json({ authenticated: false })
  response.headers.append('Set-Cookie', clearSessionCookie())
  return response
}

