import {
  createSessionCookie,
  createWorkOS,
  getAuthConfig,
  isAllowedEmail,
  normalizeReturnTo,
  readLoginState,
} from '../../_utils/auth.js'

function errorRedirect(requestUrl, message) {
  const url = new URL(requestUrl)
  const destination = new URL('/', url.origin)
  destination.searchParams.set('auth_error', message)
  return new Response(null, {
    status: 302,
    headers: {
      Location: destination.toString(),
    },
  })
}

export async function onRequestGet(context) {
  let config
  try {
    config = getAuthConfig(context.env)
  } catch (error) {
    return Response.json({ error: error.message }, { status: 503 })
  }

  const url = new URL(context.request.url)
  const code = url.searchParams.get('code')
  const stateToken = url.searchParams.get('state')

  if (!code || !stateToken) {
    return errorRedirect(context.request.url, 'Missing login callback parameters.')
  }

  const state = await readLoginState(config.secret, stateToken)
  if (!state) {
    return errorRedirect(context.request.url, 'The login session expired. Please try again.')
  }

  try {
    const workos = createWorkOS(context.env)
    const authentication = await workos.userManagement.authenticateWithCode({
      clientId: config.clientId,
      code,
      ipAddress: context.request.headers.get('CF-Connecting-IP') ?? undefined,
      userAgent: context.request.headers.get('user-agent') ?? undefined,
    })

    const email = typeof authentication.user.email === 'string'
      ? authentication.user.email.trim().toLowerCase()
      : ''

    if (!email) {
      return errorRedirect(context.request.url, 'No email was returned by WorkOS.')
    }

    if (!isAllowedEmail(context.env, email)) {
      return errorRedirect(context.request.url, 'This account is not allowed to access Alpha Research.')
    }

    const returnTo = normalizeReturnTo(state.returnTo, url.origin)
    const destination = new URL(returnTo, url.origin)
    return new Response(null, {
      status: 302,
      headers: {
        Location: destination.toString(),
        'Set-Cookie': await createSessionCookie(config.secret, email),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'WorkOS login failed.'
    return errorRedirect(context.request.url, message)
  }
}
