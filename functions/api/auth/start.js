import { createLoginState, createWorkOS, getAuthConfig, getRedirectUri, normalizeReturnTo } from '../../_utils/auth.js'

export async function onRequestGet(context) {
  let config
  try {
    config = getAuthConfig(context.env)
  } catch (error) {
    return Response.json({ error: error.message }, { status: 503 })
  }

  const url = new URL(context.request.url)
  const returnTo = normalizeReturnTo(url.searchParams.get('return_to') ?? '/', url.origin)
  const state = await createLoginState(config.secret, returnTo)
  const redirectUri = getRedirectUri(context.env, context.request)
  const workos = createWorkOS(context.env)
  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    provider: 'authkit',
    clientId: config.clientId,
    redirectUri,
    state,
  })

  return Response.redirect(authorizationUrl, 302)
}

export async function onRequestPost(context) {
  return onRequestGet(context)
}
