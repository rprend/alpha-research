type SpacesEnv = {
  DO_SPACES_BUCKET?: string
  DO_SPACES_REGION?: string
  DO_SPACES_ACCESS_KEY_ID?: string
  DO_SPACES_SECRET_ACCESS_KEY?: string
  OBJECT_STORE_BUCKET?: string
  OBJECT_STORE_REGION?: string
  OBJECT_STORE_ACCESS_KEY_ID?: string
  OBJECT_STORE_SECRET_ACCESS_KEY?: string
  OBJECT_STORE_ENDPOINT?: string
  R2_BUCKET_NAME?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  R2_ENDPOINT?: string
}

type PresignOptions = {
  method: 'GET' | 'PUT'
  key: string
  expiresSeconds?: number
}

const DEFAULT_EXPIRY_SECONDS = 60 * 60

function requireSpacesConfig(env: SpacesEnv) {
  const bucket = env.OBJECT_STORE_BUCKET ?? env.DO_SPACES_BUCKET ?? env.R2_BUCKET_NAME
  const region = env.OBJECT_STORE_REGION ?? env.DO_SPACES_REGION ?? 'auto'
  const accessKeyId = env.OBJECT_STORE_ACCESS_KEY_ID ?? env.DO_SPACES_ACCESS_KEY_ID ?? env.R2_ACCESS_KEY_ID
  const secretAccessKey = env.OBJECT_STORE_SECRET_ACCESS_KEY ?? env.DO_SPACES_SECRET_ACCESS_KEY ?? env.R2_SECRET_ACCESS_KEY
  const endpoint = env.OBJECT_STORE_ENDPOINT ?? env.R2_ENDPOINT ?? (bucket && region && env.DO_SPACES_BUCKET ? `https://${bucket}.${region}.digitaloceanspaces.com` : undefined)
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing object store bucket or access credentials')
  }
  return { bucket, region, accessKeyId, secretAccessKey, endpoint }
}

function isoBasic(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function shortDate(date: Date) {
  return isoBasic(date).slice(0, 8)
}

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256(key: ArrayBuffer | string, value: string) {
  const rawKey = typeof key === 'string' ? new TextEncoder().encode(key) : new Uint8Array(key)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value))
}

async function signingKey(secretAccessKey: string, dateStamp: string, region: string) {
  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, 's3')
  return hmacSha256(kService, 'aws4_request')
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (match) => `%${match.charCodeAt(0).toString(16).toUpperCase()}`)
}

function canonicalUri(key: string) {
  return `/${key.split('/').map((segment) => encodeRfc3986(segment)).join('/')}`
}

export async function createPresignedSpacesUrl(env: SpacesEnv, options: PresignOptions) {
  const { bucket, region, accessKeyId, secretAccessKey } = requireSpacesConfig(env)
  const { endpoint } = requireSpacesConfig(env)
  const expiresSeconds = options.expiresSeconds ?? DEFAULT_EXPIRY_SECONDS
  const now = new Date()
  const amzDate = isoBasic(now)
  const dateStamp = shortDate(now)
  const endpointUrl = endpoint ? new URL(endpoint) : new URL(`https://${bucket}.${region}.digitaloceanspaces.com`)
  const host = endpointUrl.host
  const pathPrefix = endpoint ? `/${bucket}` : ''
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const credential = `${accessKeyId}/${credentialScope}`
  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
  })
  const canonicalQuery = [...query.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&')
  const canonicalRequest = [
    options.method,
    `${pathPrefix}${canonicalUri(options.key)}`,
    canonicalQuery,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n')
  const signatureBytes = await hmacSha256(await signingKey(secretAccessKey, dateStamp, region), stringToSign)
  const signature = [...new Uint8Array(signatureBytes)].map((value) => value.toString(16).padStart(2, '0')).join('')
  query.set('X-Amz-Signature', signature)

  return {
    bucket,
    region,
    key: options.key,
    url: `${endpointUrl.protocol}//${host}${pathPrefix}${canonicalUri(options.key)}?${query.toString()}`,
  }
}
