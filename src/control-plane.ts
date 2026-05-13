import { createPresignedObjectStoreUrl } from './spaces'
import { launchModalResearchJob } from './modal'
import {
  FREE_MONTHLY_CREDITS,
  STUDIO_MONTHLY_CREDITS,
  billingWindow,
  computeUsageCostUsd,
  creditsFromUsd,
  hasPaidAccess,
  type BillingUsageEventInput,
} from './billing'
import type { SubscriptionRecord } from './stripe'

type DurableObjectStateLike = {
  storage: {
    sql: {
      exec(query: string, ...bindings: unknown[]): Iterable<Record<string, unknown>>
    }
  }
  blockConcurrencyWhile(callback: () => Promise<void> | void): Promise<void>
}

type SqlStorage = DurableObjectStateLike['storage'] & {
  sql: {
    exec(query: string, ...bindings: unknown[]): Iterable<Record<string, unknown>>
  }
}

type R2ObjectBodyLike = {
  body: ReadableStream<Uint8Array> | null
  httpMetadata?: {
    contentType?: string
  }
  writeHttpMetadata(headers: Headers): void
}

type R2BucketLike = {
  get(key: string): Promise<R2ObjectBodyLike | null>
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
}

const ASSISTANT_SESSION_CONTENT_STORAGE_LIMIT = 60_000
const ASSISTANT_SESSION_METADATA_STORAGE_LIMIT = 24_000

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function truncateStoredText(value: string, limit: number) {
  if (value.length <= limit) return value
  return `${value.slice(0, limit).trimEnd()}\n\n[Truncated by control-plane storage guard at ${limit} characters.]`
}

function boundedMetadataForStorage(value: unknown) {
  if (value === undefined) return undefined
  const json = JSON.stringify(value)
  if (json.length <= ASSISTANT_SESSION_METADATA_STORAGE_LIMIT) return value
  return {
    truncated: true,
    originalSizeBytes: json.length,
    preview: truncateStoredText(json, ASSISTANT_SESSION_METADATA_STORAGE_LIMIT),
  }
}

function artifactPathFromContent(content: unknown, fallback: string) {
  if (isPlainRecord(content) && typeof content.path === 'string' && content.path.trim()) {
    return content.path.trim()
  }
  return fallback
}

function artifactExtension(path: string) {
  const filename = path.split(/[\\/]/u).filter(Boolean).at(-1) ?? path
  const index = filename.lastIndexOf('.')
  return index >= 0 ? filename.slice(index).toLowerCase() : ''
}

function artifactMimeType(type: string, title: string, content: unknown) {
  if (isPlainRecord(content) && typeof content.mimeType === 'string' && content.mimeType.trim()) {
    return content.mimeType.trim()
  }
  const extension = artifactExtension(artifactPathFromContent(content, title))
  if (type === 'structured_result' || extension === '.json') return 'application/json; charset=utf-8'
  if (extension === '.html' || extension === '.htm') return 'text/html; charset=utf-8'
  if (extension === '.md' || extension === '.markdown') return 'text/markdown; charset=utf-8'
  if (extension === '.csv') return 'text/csv; charset=utf-8'
  if (extension === '.txt') return 'text/plain; charset=utf-8'
  if (extension === '.svg') return 'image/svg+xml; charset=utf-8'
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.gif') return 'image/gif'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.pdf') return 'application/pdf'
  return 'application/octet-stream'
}

function artifactCanUseUrl(type: string, title: string, content: unknown) {
  const mimeType = artifactMimeType(type, title, content).toLowerCase()
  return mimeType.startsWith('text/html')
    || mimeType.startsWith('image/')
    || mimeType.startsWith('application/pdf')
}

function sanitizeObjectKeySegment(value: string) {
  return value.replace(/[^A-Za-z0-9._/-]+/gu, '-').replace(/\/+/gu, '/').replace(/^\/+|\/+$/gu, '') || 'artifact'
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function artifactBodyBytes(type: string, title: string, content: unknown) {
  if (isPlainRecord(content) && typeof content.base64 === 'string' && content.base64.trim()) {
    return base64ToBytes(content.base64.trim())
  }
  if (isPlainRecord(content) && typeof content.text === 'string') {
    return new TextEncoder().encode(content.text)
  }
  if (isPlainRecord(content) && typeof content.preview === 'string') {
    return new TextEncoder().encode(content.preview)
  }
  if (typeof content === 'string') {
    return new TextEncoder().encode(content)
  }
  if (type === 'structured_result' || artifactExtension(title) === '.json') {
    return new TextEncoder().encode(JSON.stringify(content ?? {}, null, 2))
  }
  return null
}

function artifactPreviewContent(content: unknown) {
  if (!isPlainRecord(content)) return content
  const { base64: _base64, ...rest } = content
  return rest
}

function formatRunType(value: string) {
  return value
    .replace(/[_-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
    || 'Remote'
}

type ResponsesApiPayload = {
  id?: string
  output_text?: string
  output?: Array<Record<string, unknown>>
}

type Env = {
  RESEARCH_CONTROL_ORIGIN?: string
  OBJECT_STORE_BUCKET?: string
  OBJECT_STORE_REGION?: string
  OBJECT_STORE_ACCESS_KEY_ID?: string
  OBJECT_STORE_SECRET_ACCESS_KEY?: string
  OBJECT_STORE_ENDPOINT?: string
  R2_BUCKET_NAME?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  R2_ENDPOINT?: string
  RESEARCH_INTERNAL_RUNNER_TOKEN?: string
  RESEARCH_DATASET_REPO_REF?: string
  OPENAI_API_KEY?: string
  RESEARCH_AGENT_MODEL?: string
  REMOTE_AGENT_MODEL?: string
  MODAL_AGENT_ENDPOINT_URL?: string
  MODAL_AGENT_SUBMIT_TOKEN?: string
  EXA_API_KEY?: string
  CANONICAL_DATASET_SLACK_WEBHOOK_URL?: string
  SLACK_WEBHOOK_URL?: string
  ARTIFACT_BUCKET?: R2BucketLike
}

const PLATFORM_DATASET_OWNER_EMAIL = 'platform@alpharesearch.nyc'
const CANONICAL_BOOTSTRAP_REQUIRED_ARTIFACTS = [
  'dataset_briefing.md',
  'improvement_plan.md',
  'improvement_result.json',
  'candidate_sources.csv',
  'source_inventory.json',
  'slack_briefing.md',
  'docs_mirror_manifest.json',
]

function normalizeGeneratedRunTitle(value: string) {
  return value
    .replace(/^["'`]+|["'`.]+$/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
}

function clampGeneratedRunTitle(value: string) {
  const normalized = normalizeGeneratedRunTitle(value)
  if (!normalized) return null
  const words = normalized
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 8)
  return words.join(' ').trim() || null
}

function clampGeneratedRunDescription(value: string) {
  const normalized = value
    .replace(/^["'`]+|["'`]+$/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
  if (!normalized) return null
  const firstSentence = normalized.match(/^.+?[.!?](?:\s|$)/u)?.[0]?.trim() ?? normalized
  return firstSentence.length > 180 ? `${firstSentence.slice(0, 179).trimEnd()}…` : firstSentence
}

function extractResponseText(payload: ResponsesApiPayload) {
  const outputText = typeof payload.output_text === 'string' ? payload.output_text.trim() : ''
  if (outputText) return outputText
  const output = Array.isArray(payload.output) ? payload.output : []
  const chunks: string[] = []
  for (const entry of output) {
    const content = Array.isArray(entry.content) ? entry.content : []
    for (const item of content) {
      if (!item || typeof item !== 'object') continue
      if ((item as { type?: unknown }).type === 'output_text' && typeof (item as { text?: unknown }).text === 'string') {
        chunks.push((item as { text: string }).text)
      }
    }
  }
  return chunks.join('\n\n').trim()
}

async function callResponsesApi(env: Env, body: Record<string, unknown>) {
  if (!env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY on alpha-research control plane')
  }
  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.RESEARCH_AGENT_MODEL ?? 'gpt-5',
      reasoning: { effort: 'low' },
      text: { verbosity: 'low' },
      max_output_tokens: 512,
      ...body,
    }),
  })
  const text = await upstream.text()
  if (!upstream.ok) {
    throw new Error(`Responses API request failed (${upstream.status}).${text ? ` ${text}` : ''}`)
  }
  return JSON.parse(text) as ResponsesApiPayload
}

type DatasetRecord = {
  id: string
  name: string
  ownerEmail: string
  sourceType: string
  sourceFilename: string | null
  sourceObjectKey: string | null
  sourceSizeBytes: number | null
  mode: string | null
  description: string | null
  instanceId: string | null
  manifestPath: string | null
  deploymentStatus: string
  status: string
  volumeId: string | null
  volumeName: string | null
  volumeRegion: string | null
  volumeMountPath: string | null
  ingestConfigJson: string | null
  activeRunId: string | null
  leaseAcquiredAt: string | null
  createdAt: string
  updatedAt: string
}

type DatasetProfileRecord = {
  datasetId: string
  schemaJson: string | null
  sampleRowsJson: string | null
  notes: string | null
  briefingMarkdown: string | null
  profileJson: string | null
  briefingArtifactId: string | null
  profileArtifactId: string | null
  describedRunId: string | null
  describedAt: string | null
  updatedAt: string
}

type RunRecord = {
  id: string
  datasetId: string
  ownerEmail: string
  type: string
  status: string
  title: string | null
  description: string | null
  prompt: string | null
  outputPreview: string | null
  workerId: string | null
  workerName: string | null
  createdAt: string
  updatedAt: string
}

type ResearchSpecRecord = {
  id: string
  ownerEmail: string
  datasetId: string
  hypothesis: string
  specJson: string | null
  status: string
  createdAt: string
  updatedAt: string
}

type AssistantSessionRecord = {
  id: string
  ownerEmail: string
  datasetId: string | null
  runId: string | null
  kind: string
  title: string | null
  status: string
  metadataJson: string | null
  createdAt: string
  updatedAt: string
}

type AssistantSessionEntryRecord = {
  id: string
  sessionId: string
  role: string
  kind: string
  title: string | null
  content: string
  metadataJson: string | null
  createdAt: string
}

function nowIso() {
  return new Date().toISOString()
}

function respondJson(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63) || 'dataset'
}

function isTerminalStatus(status: string | null | undefined) {
  if (!status) {
    return false
  }
  const normalized = status.toLowerCase()
  return normalized === 'ready'
    || normalized === 'failed'
    || normalized === 'cancelled'
    || normalized === 'canceled'
    || normalized === 'completed'
    || normalized === 'error'
    || normalized === 'worker_unreachable'
}

const RUN_HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000

function isStaleActiveRun(run: RunRecord) {
  if (isTerminalStatus(run.status)) {
    return false
  }
  const updatedAt = Date.parse(run.updatedAt)
  if (Number.isNaN(updatedAt)) {
    return false
  }
  return (Date.now() - updatedAt) > RUN_HEARTBEAT_TIMEOUT_MS
}

export class ControlPlane {
  private readonly sql: SqlStorage['sql']
  private readonly state: DurableObjectStateLike
  private readonly env: Env

  constructor(state: DurableObjectStateLike, env: Env) {
    this.state = state
    this.env = env
    this.sql = (state.storage as SqlStorage).sql
    this.state.blockConcurrencyWhile(async () => {
      this.init()
    })
  }

  private init() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_email TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_filename TEXT,
        source_object_key TEXT,
        source_size_bytes INTEGER,
        mode TEXT,
        description TEXT,
        instance_id TEXT,
        manifest_path TEXT,
        deployment_status TEXT NOT NULL,
        status TEXT NOT NULL,
        volume_id TEXT,
        volume_name TEXT,
        volume_region TEXT,
        volume_mount_path TEXT,
        ingest_config_json TEXT,
        active_run_id TEXT,
        lease_acquired_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        owner_email TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT,
        description TEXT,
        prompt TEXT,
        output_preview TEXT,
        worker_id TEXT,
        worker_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS run_events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        run_id TEXT NOT NULL,
        message TEXT NOT NULL,
        level TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS dataset_profiles (
        dataset_id TEXT PRIMARY KEY,
        schema_json TEXT,
        sample_rows_json TEXT,
        notes TEXT,
        briefing_markdown TEXT,
        profile_json TEXT,
        briefing_artifact_id TEXT,
        profile_artifact_id TEXT,
        described_run_id TEXT,
        described_at TEXT,
        updated_at TEXT NOT NULL
      );
    `)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS research_specs (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        dataset_id TEXT NOT NULL,
        hypothesis TEXT NOT NULL,
        spec_json TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS run_metadata (
        run_id TEXT PRIMARY KEY,
        config_json TEXT,
        artifact_spec_json TEXT
      );
    `)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS run_artifacts (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT,
        content_json TEXT,
        created_at TEXT NOT NULL
      );
    `)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS assistant_sessions (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        dataset_id TEXT,
        run_id TEXT,
        kind TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS assistant_session_entries (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );
    `)
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_assistant_sessions_owner_kind_updated
      ON assistant_sessions (owner_email, kind, updated_at DESC);
    `)
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_assistant_sessions_owner_kind_run_updated
      ON assistant_sessions (owner_email, kind, run_id, updated_at DESC);
    `)
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_assistant_sessions_owner_kind_dataset_updated
      ON assistant_sessions (owner_email, kind, dataset_id, updated_at DESC);
    `)
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_assistant_sessions_run_kind_created
      ON assistant_sessions (run_id, kind, created_at ASC);
    `)
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_assistant_session_entries_session_seq
      ON assistant_session_entries (session_id, seq ASC);
    `)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS response_session_links (
        response_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL
      );
    `)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        user_id TEXT PRIMARY KEY,
        stripe_customer_id TEXT UNIQUE,
        stripe_subscription_id TEXT UNIQUE,
        stripe_product_id TEXT,
        stripe_price_id TEXT,
        checkout_session_id TEXT,
        tier TEXT NOT NULL,
        status TEXT NOT NULL,
        cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
        current_period_start TEXT,
        current_period_end TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS billing_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT,
        run_id TEXT,
        source TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        operation TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        cached_input_tokens INTEGER NOT NULL,
        cost_usd REAL NOT NULL,
        request_id TEXT,
        request_json TEXT,
        response_json TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
    `)
    try { this.sql.exec('ALTER TABLE datasets ADD COLUMN active_run_id TEXT') } catch {}
    try { this.sql.exec('ALTER TABLE datasets ADD COLUMN lease_acquired_at TEXT') } catch {}
    try { this.sql.exec('ALTER TABLE runs ADD COLUMN worker_id TEXT') } catch {}
    try { this.sql.exec('ALTER TABLE runs ADD COLUMN worker_name TEXT') } catch {}
    try { this.sql.exec('ALTER TABLE runs ADD COLUMN title TEXT') } catch {}
    try { this.sql.exec('ALTER TABLE runs ADD COLUMN description TEXT') } catch {}
    try { this.sql.exec('ALTER TABLE dataset_profiles ADD COLUMN briefing_markdown TEXT') } catch {}
    try { this.sql.exec('ALTER TABLE dataset_profiles ADD COLUMN profile_json TEXT') } catch {}
    try { this.sql.exec('ALTER TABLE dataset_profiles ADD COLUMN briefing_artifact_id TEXT') } catch {}
    try { this.sql.exec('ALTER TABLE dataset_profiles ADD COLUMN profile_artifact_id TEXT') } catch {}
    try { this.sql.exec('ALTER TABLE dataset_profiles ADD COLUMN described_run_id TEXT') } catch {}
    try { this.sql.exec('ALTER TABLE dataset_profiles ADD COLUMN described_at TEXT') } catch {}
    this.sql.exec(`
      UPDATE datasets
         SET volume_id = 'agent-dataset',
             volume_name = 'agent-dataset',
             volume_region = 'modal',
             volume_mount_path = '/data/datasets/' || id,
             manifest_path = '/data/datasets/' || id || '/manifest.json',
             updated_at = ?
       WHERE manifest_path IS NOT NULL
         AND manifest_path NOT LIKE '/data/%'
    `, nowIso())
  }

  private rows(query: string, ...bindings: unknown[]) {
    return [...this.sql.exec(query, ...bindings)] as Array<Record<string, unknown>>
  }

  private subscriptionRowToJson(row: Record<string, unknown>): SubscriptionRecord & { createdAt: string; updatedAt: string } {
    return {
      userId: String(row.user_id ?? row.userId ?? ''),
      stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
      stripeSubscriptionId: row.stripe_subscription_id ? String(row.stripe_subscription_id) : null,
      stripeProductId: row.stripe_product_id ? String(row.stripe_product_id) : null,
      stripePriceId: row.stripe_price_id ? String(row.stripe_price_id) : null,
      checkoutSessionId: row.checkout_session_id ? String(row.checkout_session_id) : null,
      tier: row.tier === 'studio' ? 'studio' : 'free',
      status: String(row.status ?? 'free') as SubscriptionRecord['status'],
      cancelAtPeriodEnd: Number(row.cancel_at_period_end ?? 0) === 1,
      currentPeriodStart: row.current_period_start ? String(row.current_period_start) : null,
      currentPeriodEnd: row.current_period_end ? String(row.current_period_end) : null,
      metadata: row.metadata_json ? JSON.parse(String(row.metadata_json)) : {},
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    }
  }

  private getSubscriptionByUserId(userId: string) {
    const row = this.rows('SELECT * FROM subscriptions WHERE user_id = ? LIMIT 1', userId)[0]
    return row ? this.subscriptionRowToJson(row) : null
  }

  private getSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string) {
    const row = this.rows('SELECT * FROM subscriptions WHERE stripe_subscription_id = ? LIMIT 1', stripeSubscriptionId)[0]
    return row ? this.subscriptionRowToJson(row) : null
  }

  private getSubscriptionByStripeCustomerId(stripeCustomerId: string) {
    const row = this.rows('SELECT * FROM subscriptions WHERE stripe_customer_id = ? LIMIT 1', stripeCustomerId)[0]
    return row ? this.subscriptionRowToJson(row) : null
  }

  private upsertSubscription(input: SubscriptionRecord & { createdAt?: string; updatedAt?: string }) {
    const existing = this.getSubscriptionByUserId(input.userId)
    const createdAt = input.createdAt ?? existing?.createdAt ?? nowIso()
    const updatedAt = input.updatedAt ?? nowIso()
    this.sql.exec(
      `INSERT INTO subscriptions (
         user_id, stripe_customer_id, stripe_subscription_id, stripe_product_id, stripe_price_id, checkout_session_id,
         tier, status, cancel_at_period_end, current_period_start, current_period_end, metadata_json, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         stripe_customer_id = excluded.stripe_customer_id,
         stripe_subscription_id = excluded.stripe_subscription_id,
         stripe_product_id = excluded.stripe_product_id,
         stripe_price_id = excluded.stripe_price_id,
         checkout_session_id = excluded.checkout_session_id,
         tier = excluded.tier,
         status = excluded.status,
         cancel_at_period_end = excluded.cancel_at_period_end,
         current_period_start = excluded.current_period_start,
         current_period_end = excluded.current_period_end,
         metadata_json = excluded.metadata_json,
         updated_at = excluded.updated_at`,
      input.userId,
      input.stripeCustomerId,
      input.stripeSubscriptionId,
      input.stripeProductId,
      input.stripePriceId,
      input.checkoutSessionId,
      input.tier,
      input.status,
      input.cancelAtPeriodEnd ? 1 : 0,
      input.currentPeriodStart,
      input.currentPeriodEnd,
      JSON.stringify(input.metadata ?? {}),
      createdAt,
      updatedAt,
    )
    return this.getSubscriptionByUserId(input.userId)
  }

  private billingOverview(userId: string, now = Date.now()) {
    const window = billingWindow(now)
    const subscription = this.getSubscriptionByUserId(userId)
    const paid = hasPaidAccess(subscription, now)
    const tier = paid ? 'studio' : 'free'
    const monthlyCredits = paid ? STUDIO_MONTHLY_CREDITS : FREE_MONTHLY_CREDITS
    const spendRow = this.rows(
      'SELECT COALESCE(SUM(cost_usd), 0) AS total_cost_usd, COUNT(*) AS event_count FROM billing_events WHERE user_id = ? AND created_at >= ?',
      userId,
      window.startedAt,
    )[0]
    const spendUsd = Number(spendRow?.total_cost_usd ?? 0)
    const usedCredits = creditsFromUsd(Number.isFinite(spendUsd) ? spendUsd : 0)
    return {
      allowed: usedCredits <= monthlyCredits,
      tier,
      subscriptionStatus: subscription?.status ?? 'free',
      limitCredits: monthlyCredits,
      usedCredits,
      remainingCredits: Math.max(0, monthlyCredits - usedCredits),
      spendUsd,
      windowStartedAt: window.startedAt,
      windowEndsAt: window.endsAt,
      checkoutEligible: !paid,
    }
  }

  private billingOverviewForRun(run: RunRecord, now = Date.now()) {
    if (run.ownerEmail === PLATFORM_DATASET_OWNER_EMAIL && run.type === 'canonical-dataset-bootstrap') {
      const window = billingWindow(now)
      const spendRow = this.rows(
        'SELECT COALESCE(SUM(cost_usd), 0) AS total_cost_usd FROM billing_events WHERE user_id = ? AND created_at >= ?',
        run.ownerEmail,
        window.startedAt,
      )[0]
      const spendUsd = Number(spendRow?.total_cost_usd ?? 0)
      const usedCredits = creditsFromUsd(Number.isFinite(spendUsd) ? spendUsd : 0)
      return {
        allowed: true,
        tier: 'studio' as const,
        subscriptionStatus: 'active' as const,
        limitCredits: Number.MAX_SAFE_INTEGER,
        usedCredits,
        remainingCredits: Number.MAX_SAFE_INTEGER,
        spendUsd,
        windowStartedAt: window.startedAt,
        windowEndsAt: window.endsAt,
        checkoutEligible: false,
      }
    }
    return this.billingOverview(run.ownerEmail, now)
  }

  private trackBillingEvent(userId: string, event: BillingUsageEventInput & { sessionId?: string | null; runId?: string | null; source?: string | null }) {
    const inputTokens = Math.max(0, Math.trunc(event.inputTokens ?? 0))
    const outputTokens = Math.max(0, Math.trunc(event.outputTokens ?? 0))
    const cachedInputTokens = Math.max(0, Math.trunc(event.cachedInputTokens ?? 0))
    const totalTokens = Math.max(0, Math.trunc(event.totalTokens ?? inputTokens + outputTokens))
    this.sql.exec(
      `INSERT OR IGNORE INTO billing_events (
         id, user_id, session_id, run_id, source, provider, model, operation, input_tokens, output_tokens, total_tokens,
         cached_input_tokens, cost_usd, request_id, request_json, response_json, metadata_json, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      event.eventId ?? crypto.randomUUID(),
      userId,
      event.sessionId ?? null,
      event.runId ?? null,
      event.source ?? 'dashboard',
      event.provider,
      event.model,
      event.operation,
      inputTokens,
      outputTokens,
      totalTokens,
      cachedInputTokens,
      computeUsageCostUsd({ ...event, inputTokens, outputTokens, totalTokens, cachedInputTokens }),
      event.requestId ?? null,
      event.requestJson ? JSON.stringify(event.requestJson) : null,
      event.responseJson ? JSON.stringify(event.responseJson) : null,
      JSON.stringify(event.metadata ?? {}),
      event.createdAt ?? nowIso(),
    )
  }

  private async expireStaleRun(run: RunRecord) {
    if (!isStaleActiveRun(run)) {
      return false
    }
    this.appendRunEvent(
      run.id,
      'Run marked worker_unreachable because the Modal worker stopped heartbeating before reporting a terminal result.',
      'warning',
    )
    this.sql.exec(
      `UPDATE runs SET status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
      'worker_unreachable',
      'Worker heartbeat timed out before the run reported a terminal result.',
      nowIso(),
      run.id,
    )
    this.releaseDatasetLease(run.datasetId, run.id)
    return true
  }

  private async expireStaleRunsForDataset(datasetId: string) {
    const dataset = this.getDataset(datasetId)
    if (!dataset?.activeRunId) {
      return
    }
    const row = this.rows('SELECT * FROM runs WHERE id = ? LIMIT 1', dataset.activeRunId)[0]
    if (!row) {
      this.releaseDatasetLease(datasetId, dataset.activeRunId)
      return
    }
    await this.expireStaleRun(this.parseRunRow(row))
  }

  private getLeaseBlockingRun(datasetId: string) {
    const dataset = this.getDataset(datasetId)
    if (!dataset?.activeRunId) {
      return null
    }
    const row = this.rows('SELECT * FROM runs WHERE id = ? LIMIT 1', dataset.activeRunId)[0]
    return row ? this.parseRunRow(row) : null
  }

  private getRun(runId: string) {
    const row = this.rows('SELECT * FROM runs WHERE id = ? LIMIT 1', runId)[0]
    return row ? this.parseRunRow(row) : null
  }

  private datasetRowToJson(row: Record<string, unknown>) {
    const dataset = this.parseDatasetRow(row)
    return {
      id: dataset.id,
      name: dataset.name,
      sourceType: dataset.sourceType,
      sourceFilename: dataset.sourceFilename,
      sourceSizeBytes: dataset.sourceSizeBytes,
      mode: dataset.mode,
      description: dataset.description,
      status: dataset.status,
      deploymentStatus: dataset.deploymentStatus,
      createdAt: dataset.createdAt,
      updatedAt: dataset.updatedAt,
      activeRunId: dataset.activeRunId,
      leaseAcquiredAt: dataset.leaseAcquiredAt,
      volume: dataset.volumeId ? {
        id: dataset.volumeId,
        name: dataset.volumeName,
        region: dataset.volumeRegion,
        mountPath: dataset.volumeMountPath,
      } : null,
      manifestPath: dataset.manifestPath,
    }
  }

  private parseDatasetRow(row: Record<string, unknown>): DatasetRecord {
    const get = (snake: string, camel: string) => row[snake] ?? row[camel]
    return {
      id: String(row.id),
      name: String(row.name),
      ownerEmail: String(get('owner_email', 'ownerEmail')),
      sourceType: String(get('source_type', 'sourceType')),
      sourceFilename: get('source_filename', 'sourceFilename') ? String(get('source_filename', 'sourceFilename')) : null,
      sourceObjectKey: get('source_object_key', 'sourceObjectKey') ? String(get('source_object_key', 'sourceObjectKey')) : null,
      sourceSizeBytes: typeof get('source_size_bytes', 'sourceSizeBytes') === 'number' ? Number(get('source_size_bytes', 'sourceSizeBytes')) : get('source_size_bytes', 'sourceSizeBytes') ? Number(get('source_size_bytes', 'sourceSizeBytes')) : null,
      mode: row.mode ? String(row.mode) : null,
      description: row.description ? String(row.description) : null,
      instanceId: get('instance_id', 'instanceId') ? String(get('instance_id', 'instanceId')) : null,
      manifestPath: get('manifest_path', 'manifestPath') ? String(get('manifest_path', 'manifestPath')) : null,
      deploymentStatus: String(get('deployment_status', 'deploymentStatus')),
      status: String(row.status),
      volumeId: get('volume_id', 'volumeId') ? String(get('volume_id', 'volumeId')) : null,
      volumeName: get('volume_name', 'volumeName') ? String(get('volume_name', 'volumeName')) : null,
      volumeRegion: get('volume_region', 'volumeRegion') ? String(get('volume_region', 'volumeRegion')) : null,
      volumeMountPath: get('volume_mount_path', 'volumeMountPath') ? String(get('volume_mount_path', 'volumeMountPath')) : null,
      ingestConfigJson: get('ingest_config_json', 'ingestConfigJson') ? String(get('ingest_config_json', 'ingestConfigJson')) : null,
      activeRunId: get('active_run_id', 'activeRunId') ? String(get('active_run_id', 'activeRunId')) : null,
      leaseAcquiredAt: get('lease_acquired_at', 'leaseAcquiredAt') ? String(get('lease_acquired_at', 'leaseAcquiredAt')) : null,
      createdAt: String(get('created_at', 'createdAt')),
      updatedAt: String(get('updated_at', 'updatedAt')),
    }
  }

  private runRowToJson(row: Record<string, unknown>) {
    const run = this.parseRunRow(row)
    return {
      id: run.id,
      datasetId: run.datasetId,
      type: run.type,
      status: run.status,
      title: run.title ?? undefined,
      description: run.description ?? undefined,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      prompt: run.prompt ?? undefined,
      outputPreview: run.outputPreview ?? undefined,
      artifactCount: this.getRunArtifactCount(run.id),
      sessionCount: this.getRunSessionCount(run.id),
    }
  }

  private parseRunRow(row: Record<string, unknown>): RunRecord {
    const get = (snake: string, camel: string) => row[snake] ?? row[camel]
    return {
      id: String(row.id),
      datasetId: String(get('dataset_id', 'datasetId')),
      ownerEmail: String(get('owner_email', 'ownerEmail')),
      type: String(row.type),
      status: String(row.status),
      title: row.title ? String(row.title) : null,
      description: row.description ? String(row.description) : null,
      prompt: row.prompt ? String(row.prompt) : null,
      outputPreview: get('output_preview', 'outputPreview') ? String(get('output_preview', 'outputPreview')) : null,
      workerId: get('worker_id', 'workerId') ? String(get('worker_id', 'workerId')) : null,
      workerName: get('worker_name', 'workerName') ? String(get('worker_name', 'workerName')) : null,
      createdAt: String(get('created_at', 'createdAt')),
      updatedAt: String(get('updated_at', 'updatedAt')),
    }
  }

  private getDatasetProfile(datasetId: string) {
    const row = this.rows('SELECT * FROM dataset_profiles WHERE dataset_id = ? LIMIT 1', datasetId)[0]
    if (!row) {
      return null
    }
    const get = (snake: string, camel: string) => row[snake] ?? row[camel]
    return {
      datasetId: String(get('dataset_id', 'datasetId')),
      schemaJson: get('schema_json', 'schemaJson') ? String(get('schema_json', 'schemaJson')) : null,
      sampleRowsJson: get('sample_rows_json', 'sampleRowsJson') ? String(get('sample_rows_json', 'sampleRowsJson')) : null,
      notes: row.notes ? String(row.notes) : null,
      briefingMarkdown: get('briefing_markdown', 'briefingMarkdown') ? String(get('briefing_markdown', 'briefingMarkdown')) : null,
      profileJson: get('profile_json', 'profileJson') ? String(get('profile_json', 'profileJson')) : null,
      briefingArtifactId: get('briefing_artifact_id', 'briefingArtifactId') ? String(get('briefing_artifact_id', 'briefingArtifactId')) : null,
      profileArtifactId: get('profile_artifact_id', 'profileArtifactId') ? String(get('profile_artifact_id', 'profileArtifactId')) : null,
      describedRunId: get('described_run_id', 'describedRunId') ? String(get('described_run_id', 'describedRunId')) : null,
      describedAt: get('described_at', 'describedAt') ? String(get('described_at', 'describedAt')) : null,
      updatedAt: String(get('updated_at', 'updatedAt')),
    } satisfies DatasetProfileRecord
  }

  private datasetProfileToJson(profile: DatasetProfileRecord | null) {
    if (!profile) {
      return null
    }
    return {
      datasetId: profile.datasetId,
      schema: profile.schemaJson ? JSON.parse(profile.schemaJson) : null,
      sampleRows: profile.sampleRowsJson ? JSON.parse(profile.sampleRowsJson) : null,
      notes: profile.notes,
      briefingMarkdown: profile.briefingMarkdown,
      profile: profile.profileJson ? JSON.parse(profile.profileJson) : null,
      briefingArtifactId: profile.briefingArtifactId,
      profileArtifactId: profile.profileArtifactId,
      describedRunId: profile.describedRunId,
      describedAt: profile.describedAt,
      updatedAt: profile.updatedAt,
    }
  }

  private parseResearchSpecRow(row: Record<string, unknown>): ResearchSpecRecord {
    const get = (snake: string, camel: string) => row[snake] ?? row[camel]
    return {
      id: String(row.id),
      ownerEmail: String(get('owner_email', 'ownerEmail')),
      datasetId: String(get('dataset_id', 'datasetId')),
      hypothesis: String(row.hypothesis),
      specJson: get('spec_json', 'specJson') ? String(get('spec_json', 'specJson')) : null,
      status: String(row.status),
      createdAt: String(get('created_at', 'createdAt')),
      updatedAt: String(get('updated_at', 'updatedAt')),
    }
  }

  private parseAssistantSessionRow(row: Record<string, unknown>): AssistantSessionRecord {
    const get = (snake: string, camel: string) => row[snake] ?? row[camel]
    return {
      id: String(row.id),
      ownerEmail: String(get('owner_email', 'ownerEmail')),
      datasetId: get('dataset_id', 'datasetId') ? String(get('dataset_id', 'datasetId')) : null,
      runId: get('run_id', 'runId') ? String(get('run_id', 'runId')) : null,
      kind: String(row.kind),
      title: row.title ? String(row.title) : null,
      status: String(row.status),
      metadataJson: get('metadata_json', 'metadataJson') ? String(get('metadata_json', 'metadataJson')) : null,
      createdAt: String(get('created_at', 'createdAt')),
      updatedAt: String(get('updated_at', 'updatedAt')),
    }
  }

  private assistantSessionToJson(session: AssistantSessionRecord) {
    return {
      id: session.id,
      ownerEmail: session.ownerEmail,
      datasetId: session.datasetId,
      runId: session.runId,
      kind: session.kind,
      title: session.title,
      status: session.status,
      metadata: session.metadataJson ? JSON.parse(session.metadataJson) : null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }
  }

  private parseAssistantSessionEntryRow(row: Record<string, unknown>): AssistantSessionEntryRecord {
    const get = (snake: string, camel: string) => row[snake] ?? row[camel]
    return {
      id: String(row.id),
      sessionId: String(get('session_id', 'sessionId')),
      role: String(row.role),
      kind: String(row.kind),
      title: row.title ? String(row.title) : null,
      content: String(row.content),
      metadataJson: get('metadata_json', 'metadataJson') ? String(get('metadata_json', 'metadataJson')) : null,
      createdAt: String(get('created_at', 'createdAt')),
    }
  }

  private assistantSessionEntryToJson(entry: AssistantSessionEntryRecord) {
    return {
      id: entry.id,
      sessionId: entry.sessionId,
      role: entry.role,
      kind: entry.kind,
      title: entry.title,
      content: entry.content,
      metadata: entry.metadataJson ? JSON.parse(entry.metadataJson) : null,
      createdAt: entry.createdAt,
    }
  }

  private researchSpecToJson(row: Record<string, unknown>) {
    const spec = this.parseResearchSpecRow(row)
    return {
      id: spec.id,
      datasetId: spec.datasetId,
      hypothesis: spec.hypothesis,
      spec: spec.specJson ? JSON.parse(spec.specJson) : null,
      status: spec.status,
      createdAt: spec.createdAt,
      updatedAt: spec.updatedAt,
    }
  }

  private getRunMetadata(runId: string) {
    const row = this.rows('SELECT * FROM run_metadata WHERE run_id = ? LIMIT 1', runId)[0]
    if (!row) {
      return null
    }
    return {
      config: row.config_json ? JSON.parse(String(row.config_json)) : null,
      artifactSpec: row.artifact_spec_json ? JSON.parse(String(row.artifact_spec_json)) : null,
    }
  }

  private listRunArtifacts(runId: string) {
    const rows = this.rows('SELECT * FROM run_artifacts WHERE run_id = ? ORDER BY created_at ASC', runId)
    return rows.map((row) => ({
      id: String(row.id),
      runId: String(row.run_id),
      type: String(row.type),
      title: String(row.title),
      url: row.url ? String(row.url) : undefined,
      content: row.content_json ? JSON.parse(String(row.content_json)) : undefined,
      createdAt: String(row.created_at),
    }))
  }

  private getRunArtifactCount(runId: string) {
    const row = this.rows('SELECT COUNT(*) AS count FROM run_artifacts WHERE run_id = ?', runId)[0]
    return Number(row?.count ?? 0)
  }

  private getRunSessionCount(runId: string) {
    const row = this.rows('SELECT COUNT(*) AS count FROM assistant_sessions WHERE run_id = ?', runId)[0]
    return Number(row?.count ?? 0)
  }

  private async createStoredRunArtifact(runId: string, type: string, title: string, content?: unknown, url?: string | null) {
    const artifactId = crypto.randomUUID()
    const mimeType = artifactMimeType(type, title, content)
    const body = artifactBodyBytes(type, title, content)
    let storedContent = artifactPreviewContent(content)
    let artifactUrl = url ?? null

    if (!artifactUrl && this.env.ARTIFACT_BUCKET && body) {
      const sourcePath = artifactPathFromContent(content, title)
      const filename = sourcePath.split(/[\\/]/u).filter(Boolean).at(-1) ?? title
      const key = `runs/${sanitizeObjectKeySegment(runId)}/artifacts/${artifactId}/${sanitizeObjectKeySegment(filename)}`
      await this.env.ARTIFACT_BUCKET.put(key, body, { httpMetadata: { contentType: mimeType } })
      const sizeBytes = body.byteLength
      const baseContent = isPlainRecord(storedContent) ? storedContent : {}
      storedContent = {
        ...baseContent,
        path: artifactPathFromContent(content, title),
        mimeType,
        sizeBytes,
        storage: {
          provider: 'cloudflare-r2',
          bucket: 'ARTIFACT_BUCKET',
          key,
        },
      }
      if (artifactCanUseUrl(type, title, content)) {
        artifactUrl = `/api/cli/artifacts/${encodeURIComponent(artifactId)}/content`
      }
    }

    this.sql.exec(
      `INSERT INTO run_artifacts (id, run_id, type, title, url, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      artifactId,
      runId,
      type,
      title,
      artifactUrl,
      storedContent === undefined ? null : JSON.stringify(storedContent),
      nowIso(),
    )
    this.persistDescribeArtifactToDatasetProfile(runId, artifactId, type, title, storedContent)
    return artifactId
  }

  private persistDescribeArtifactToDatasetProfile(
    runId: string,
    artifactId: string,
    _type: string,
    title: string,
    content: unknown,
  ) {
    const run = this.getRun(runId)
    if (!run || run.type !== 'describe') {
      return
    }
    const normalizedTitle = title.trim().toLowerCase()
    const textContent = isPlainRecord(content) && typeof content.text === 'string'
      ? content.text
      : typeof content === 'string'
        ? content
        : null
    const isBriefing =
      normalizedTitle === 'dataset briefing' ||
      normalizedTitle === 'dataset briefing.md' ||
      normalizedTitle === 'dataset_briefing.md' ||
      normalizedTitle === 'work.md'
    const isProfile =
      normalizedTitle === 'dataset profile' ||
      normalizedTitle === 'dataset profile.json' ||
      normalizedTitle === 'result.json'

    if (!isBriefing && !isProfile) {
      return
    }

    const existing = this.getDatasetProfile(run.datasetId)
    const briefingMarkdown = isBriefing && textContent
      ? textContent
      : existing?.briefingMarkdown ?? null
    const profileJson = isProfile && content !== undefined
      ? JSON.stringify(content)
      : existing?.profileJson ?? null
    const timestamp = nowIso()
    this.sql.exec(
      `INSERT INTO dataset_profiles (
         dataset_id,
         schema_json,
         sample_rows_json,
         notes,
         briefing_markdown,
         profile_json,
         briefing_artifact_id,
         profile_artifact_id,
         described_run_id,
         described_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(dataset_id) DO UPDATE SET
         schema_json = excluded.schema_json,
         sample_rows_json = excluded.sample_rows_json,
         notes = excluded.notes,
         briefing_markdown = excluded.briefing_markdown,
         profile_json = excluded.profile_json,
         briefing_artifact_id = excluded.briefing_artifact_id,
         profile_artifact_id = excluded.profile_artifact_id,
         described_run_id = excluded.described_run_id,
         described_at = excluded.described_at,
         updated_at = excluded.updated_at`,
      run.datasetId,
      existing?.schemaJson ?? null,
      existing?.sampleRowsJson ?? null,
      existing?.notes ?? null,
      briefingMarkdown,
      profileJson,
      isBriefing ? artifactId : existing?.briefingArtifactId ?? null,
      isProfile ? artifactId : existing?.profileArtifactId ?? null,
      runId,
      timestamp,
      timestamp,
    )
  }

  private getDataset(id: string) {
    const row = this.rows('SELECT * FROM datasets WHERE id = ? LIMIT 1', id)[0]
    return row ? this.parseDatasetRow(row) : undefined
  }

  private canOwnerRunDataset(dataset: DatasetRecord, ownerEmail: string) {
    return dataset.ownerEmail === ownerEmail ||
      (dataset.ownerEmail === PLATFORM_DATASET_OWNER_EMAIL && dataset.mode === 'canonical_public')
  }

  private acquireDatasetLease(datasetId: string, runId: string) {
    const dataset = this.getDataset(datasetId)
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found`)
    }
    if (dataset.activeRunId && dataset.activeRunId !== runId) {
      throw new Error(`Dataset ${datasetId} already has an active run holding its volume.`)
    }
    const timestamp = nowIso()
    this.sql.exec(
      `UPDATE datasets SET active_run_id = ?, lease_acquired_at = ?, updated_at = ? WHERE id = ?`,
      runId,
      timestamp,
      timestamp,
      datasetId,
    )
  }

  private releaseDatasetLease(datasetId: string, runId: string) {
    const dataset = this.getDataset(datasetId)
    if (!dataset || dataset.activeRunId !== runId) {
      return
    }
    this.sql.exec(
      `UPDATE datasets SET active_run_id = NULL, lease_acquired_at = NULL, updated_at = ? WHERE id = ?`,
      nowIso(),
      datasetId,
    )
  }

  private createRun(datasetId: string, ownerEmail: string, type: string, prompt?: string | null) {
    const id = crypto.randomUUID()
    const timestamp = nowIso()
    const title = this.fallbackRunTitle(type, prompt)
    const description = this.fallbackRunDescription(type, prompt)
    this.sql.exec(
      `INSERT INTO runs (id, dataset_id, owner_email, type, status, title, description, prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      datasetId,
      ownerEmail,
      type,
      'queued',
      title,
      description,
      prompt ?? null,
      timestamp,
      timestamp,
    )
    return id
  }

  private fallbackRunTitle(type: string, prompt?: string | null) {
    const normalizedPrompt = prompt?.replace(/\s+/gu, ' ').trim()
    if (normalizedPrompt) {
      return clampGeneratedRunTitle(normalizedPrompt) ?? `${formatRunType(type)} run`
    }
    return `${formatRunType(type)} run`
  }

  private fallbackRunDescription(type: string, prompt?: string | null) {
    const normalizedPrompt = prompt?.replace(/\s+/gu, ' ').trim()
    if (normalizedPrompt) {
      return clampGeneratedRunDescription(normalizedPrompt)
    }
    return `Remote ${formatRunType(type).toLowerCase()} run queued for this dataset.`
  }

  private async generateRunLabel(runId: string) {
    if (!this.env.OPENAI_API_KEY) return
    const row = this.rows('SELECT * FROM runs WHERE id = ? LIMIT 1', runId)[0]
    const run = row ? this.parseRunRow(row) : null
    if (!run) return
    const dataset = this.getDataset(run.datasetId)
    const artifacts = this.listRunArtifacts(runId)
    const events = this.runEventsForRun(runId).slice(-8)
    const happened = [
      `Dataset: ${dataset?.name ?? run.datasetId}`,
      `Run type: ${formatRunType(run.type)}`,
      `Status: ${formatRunType(run.status)}`,
      run.prompt ? `Original request: ${run.prompt}` : null,
      run.outputPreview ? `Latest result: ${run.outputPreview}` : null,
      artifacts.length > 0 ? `Artifacts: ${artifacts.map((artifact) => artifact.title).join(', ')}` : null,
      events.length > 0 ? `Recent timeline: ${events.map((event) => event.message).join(' | ')}` : null,
    ].filter(Boolean).join('\n')
    const prompt = [
      'Add a title for this run based on what happened:',
      happened,
      '',
      'Return compact JSON with keys "title" and "description".',
      'The title should be fewer than 8 words.',
      'The description should be one sentence in plain user language.',
      'Do not include ids unless they are the subject of the work.',
    ].join('\n')
    const response = await callResponsesApi(this.env, {
      input: prompt,
      tool_choice: 'none',
    })
    const text = extractResponseText(response)
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(text) as Record<string, unknown>
    } catch {
      parsed = null
    }
    const titleSource = typeof parsed?.title === 'string' ? parsed.title : text
    const descriptionSource = typeof parsed?.description === 'string' ? parsed.description : ''
    const title = clampGeneratedRunTitle(titleSource)
    const description = clampGeneratedRunDescription(descriptionSource)
    if (!title && !description) return
    this.sql.exec(
      `UPDATE runs
          SET title = COALESCE(?, title),
              description = COALESCE(?, description),
              updated_at = ?
        WHERE id = ?`,
      title,
      description,
      nowIso(),
      runId,
    )
  }

  private getAssistantSession(id: string) {
    const row = this.rows('SELECT * FROM assistant_sessions WHERE id = ? LIMIT 1', id)[0]
    return row ? this.parseAssistantSessionRow(row) : null
  }

  private listAssistantSessionsForRun(runId: string) {
    return this.rows(
      'SELECT * FROM assistant_sessions WHERE run_id = ? ORDER BY created_at ASC',
      runId,
    ).map((row) => this.parseAssistantSessionRow(row))
  }

  private listAssistantSessions(params: {
    ownerEmail: string
    kind?: string | null
    runId?: string | null
    datasetId?: string | null
  }) {
    const clauses = ['owner_email = ?']
    const bindings: unknown[] = [params.ownerEmail]
    if (params.kind) {
      clauses.push('kind = ?')
      bindings.push(params.kind)
    }
    if (params.runId) {
      clauses.push('run_id = ?')
      bindings.push(params.runId)
    }
    if (params.datasetId) {
      clauses.push('dataset_id = ?')
      bindings.push(params.datasetId)
    }
    return this.rows(
      `SELECT * FROM assistant_sessions WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC`,
      ...bindings,
    ).map((row) => this.parseAssistantSessionRow(row))
  }

  private listAssistantSessionEntries(sessionId: string) {
    return this.rows(
      'SELECT * FROM assistant_session_entries WHERE session_id = ? ORDER BY seq ASC',
      sessionId,
    ).map((row) => this.parseAssistantSessionEntryRow(row))
  }

  private runEventsForRun(runId: string) {
    return this.rows(
      'SELECT id, run_id, message, level, created_at FROM run_events WHERE run_id = ? ORDER BY seq ASC',
      runId,
    ).map((row) => ({
      id: String(row.id),
      runId: String(row.run_id),
      message: String(row.message),
      level: String(row.level),
      createdAt: String(row.created_at),
    }))
  }

  private collectRunIdsFromSession(session: AssistantSessionRecord, entries: ReturnType<ControlPlane['assistantSessionEntryToJson']>[]) {
    const runIds = new Set<string>()
    if (session.runId) {
      runIds.add(session.runId)
    }
    for (const entry of entries) {
      const metadata = entry.metadata
      if (isPlainRecord(metadata)) {
        const data = metadata.data
        if (isPlainRecord(data) && isPlainRecord(data.run) && typeof data.run.id === 'string') {
          runIds.add(data.run.id)
        }
        if (typeof metadata.runId === 'string') {
          runIds.add(metadata.runId)
        }
      }
      const matches = String(entry.content ?? '').matchAll(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/giu)
      for (const match of matches) {
        const candidate = match[0]
        const row = this.rows('SELECT id FROM runs WHERE id = ? LIMIT 1', candidate)[0]
        if (row) {
          runIds.add(candidate)
        }
      }
    }
    return [...runIds]
  }

  private createAssistantSession(params: {
    id?: string
    ownerEmail: string
    datasetId?: string | null
    runId?: string | null
    kind: string
    title?: string | null
    status?: string
    metadata?: unknown
  }) {
    const id = params.id ?? crypto.randomUUID()
    const timestamp = nowIso()
    this.sql.exec(
      `INSERT OR IGNORE INTO assistant_sessions (id, owner_email, dataset_id, run_id, kind, title, status, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      params.ownerEmail,
      params.datasetId ?? null,
      params.runId ?? null,
      params.kind,
      params.title ?? null,
      params.status ?? 'active',
      params.metadata === undefined ? null : JSON.stringify(params.metadata),
      timestamp,
      timestamp,
    )
    return this.getAssistantSession(id)
  }

  private updateAssistantSession(id: string, updates: {
    datasetId?: string | null
    runId?: string | null
    title?: string | null
    status?: string
    metadata?: unknown
  }) {
    const existing = this.getAssistantSession(id)
    if (!existing) {
      return null
    }
    const metadataJson =
      updates.metadata === undefined
        ? existing.metadataJson
        : updates.metadata === null
          ? null
          : JSON.stringify(updates.metadata)
    this.sql.exec(
      `UPDATE assistant_sessions
       SET dataset_id = ?, run_id = ?, title = ?, status = ?, metadata_json = ?, updated_at = ?
       WHERE id = ?`,
      updates.datasetId === undefined ? existing.datasetId : updates.datasetId,
      updates.runId === undefined ? existing.runId : updates.runId,
      updates.title === undefined ? existing.title : updates.title,
      updates.status ?? existing.status,
      metadataJson,
      nowIso(),
      id,
    )
    return this.getAssistantSession(id)
  }

  private appendAssistantSessionEntry(params: {
    sessionId: string
    role: string
    kind: string
    title?: string | null
    content: string
    metadata?: unknown
    createdAt?: string
  }) {
    const id = crypto.randomUUID()
    const content = truncateStoredText(params.content, ASSISTANT_SESSION_CONTENT_STORAGE_LIMIT)
    const metadata = boundedMetadataForStorage(params.metadata)
    this.sql.exec(
      `INSERT INTO assistant_session_entries (id, session_id, role, kind, title, content, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      params.sessionId,
      params.role,
      params.kind,
      params.title ?? null,
      content,
      metadata === undefined ? null : JSON.stringify(metadata),
      params.createdAt ?? nowIso(),
    )
    this.sql.exec(`UPDATE assistant_sessions SET updated_at = ? WHERE id = ?`, nowIso(), params.sessionId)
    return id
  }

  private resolveCliAssistantSession(params: {
    ownerEmail: string
    datasetId?: string | null
    requestedSessionId?: string | null
    previousResponseId?: string | null
    title?: string | null
    metadata?: unknown
  }) {
    if (params.requestedSessionId) {
      const existing = this.getAssistantSession(params.requestedSessionId)
      if (existing) {
        return this.updateAssistantSession(existing.id, {
          datasetId: params.datasetId ?? existing.datasetId,
          title: params.title ?? existing.title,
          metadata: params.metadata,
        })
      }
      return this.createAssistantSession({
        id: params.requestedSessionId,
        ownerEmail: params.ownerEmail,
        datasetId: params.datasetId ?? null,
        kind: 'cli_orchestration',
        title: params.title ?? 'RESEARCH CLI session',
        metadata: params.metadata,
      })
    }

    if (params.previousResponseId) {
      const row = this.rows(
        'SELECT session_id FROM response_session_links WHERE response_id = ? LIMIT 1',
        params.previousResponseId,
      )[0]
      if (row?.session_id) {
        const existing = this.getAssistantSession(String(row.session_id))
        if (existing) {
          return this.updateAssistantSession(existing.id, {
            datasetId: params.datasetId ?? existing.datasetId,
            title: params.title ?? existing.title,
            metadata: params.metadata,
          })
        }
      }
      const recent = this.findRecentCliAssistantSession(params.ownerEmail, params.datasetId)
      if (recent) {
        return this.updateAssistantSession(recent.id, {
          datasetId: params.datasetId ?? recent.datasetId,
          title: params.title ?? recent.title,
          metadata: params.metadata,
        })
      }
    }

    return this.createAssistantSession({
      ownerEmail: params.ownerEmail,
      datasetId: params.datasetId ?? null,
      kind: 'cli_orchestration',
      title: params.title ?? 'RESEARCH CLI session',
      metadata: params.metadata,
    })
  }

  private findRecentCliAssistantSession(ownerEmail: string, datasetId?: string | null) {
    const withDataset = datasetId
      ? this.rows(
          `SELECT * FROM assistant_sessions
           WHERE owner_email = ? AND kind = 'cli_orchestration' AND run_id IS NULL
             AND (dataset_id = ? OR dataset_id IS NULL)
           ORDER BY updated_at DESC
           LIMIT 1`,
          ownerEmail,
          datasetId,
        )[0]
      : null
    const row =
      withDataset ??
      this.rows(
        `SELECT * FROM assistant_sessions
         WHERE owner_email = ? AND kind = 'cli_orchestration' AND run_id IS NULL
         ORDER BY updated_at DESC
         LIMIT 1`,
        ownerEmail,
      )[0]
    return row ? this.parseAssistantSessionRow(row) : null
  }

  private linkResponseToSession(responseId: string, sessionId: string) {
    this.sql.exec(
      `INSERT OR REPLACE INTO response_session_links (response_id, session_id) VALUES (?, ?)`,
      responseId,
      sessionId,
    )
  }

  private ensureRunAssistantSession(run: RunRecord, kind: string, defaults?: {
    title?: string | null
    metadata?: unknown
  }) {
    const existing = this.rows(
      'SELECT * FROM assistant_sessions WHERE run_id = ? AND kind = ? ORDER BY created_at ASC LIMIT 1',
      run.id,
      kind,
    )[0]
    if (existing) {
      return this.parseAssistantSessionRow(existing)
    }
    return this.createAssistantSession({
      ownerEmail: run.ownerEmail,
      datasetId: run.datasetId,
      runId: run.id,
      kind,
      title: defaults?.title ?? null,
      metadata: defaults?.metadata,
    })
  }

  private appendRunEvent(runId: string, message: string, level = 'info') {
    const id = crypto.randomUUID()
    const timestamp = nowIso()
    this.sql.exec(
      `INSERT INTO run_events (id, run_id, message, level, created_at) VALUES (?, ?, ?, ?, ?)`,
      id,
      runId,
      message,
      level,
      timestamp,
    )
    this.sql.exec(
      `UPDATE runs SET updated_at = ? WHERE id = ?`,
      timestamp,
      runId,
    )
    return id
  }

  async fetch(request: Request) {
    const url = new URL(request.url)
    const pathname = url.pathname

    if (pathname === '/billing' && request.method === 'GET') {
      const userId = url.searchParams.get('userId')
      if (!userId) return respondJson({ error: 'Missing userId' }, 400)
      const overview = this.billingOverview(userId)
      const subscription = this.getSubscriptionByUserId(userId)
      return respondJson({ overview, subscription })
    }

    if (pathname === '/billing/track' && request.method === 'POST') {
      const body = await request.json() as Record<string, unknown>
      const userId = typeof body.userId === 'string' ? body.userId : ''
      const event = isPlainRecord(body.event) ? body.event as BillingUsageEventInput : null
      if (!userId || !event) return respondJson({ error: 'Missing userId or event' }, 400)
      this.trackBillingEvent(userId, {
        ...event,
        sessionId: typeof body.sessionId === 'string' ? body.sessionId : null,
        runId: typeof body.runId === 'string' ? body.runId : null,
        source: typeof body.source === 'string' ? body.source : 'dashboard',
      })
      return respondJson({ ok: true })
    }

    if (pathname === '/subscriptions' && request.method === 'POST') {
      const body = await request.json() as SubscriptionRecord & { createdAt?: string; updatedAt?: string }
      if (!body.userId) return respondJson({ error: 'Missing userId' }, 400)
      return respondJson({ subscription: this.upsertSubscription(body) })
    }

    if (pathname === '/subscriptions/lookup' && request.method === 'GET') {
      const userId = url.searchParams.get('userId')
      const stripeCustomerId = url.searchParams.get('stripeCustomerId')
      const stripeSubscriptionId = url.searchParams.get('stripeSubscriptionId')
      const subscription = userId
        ? this.getSubscriptionByUserId(userId)
        : stripeSubscriptionId
          ? this.getSubscriptionByStripeSubscriptionId(stripeSubscriptionId)
          : stripeCustomerId
            ? this.getSubscriptionByStripeCustomerId(stripeCustomerId)
            : null
      return respondJson({ subscription })
    }

    if (pathname === '/datasets' && request.method === 'GET') {
      const ownerEmail = url.searchParams.get('ownerEmail')
      if (!ownerEmail) {
        return respondJson({ error: 'Missing ownerEmail' }, 400)
      }
      const rows = this.rows(
        `SELECT * FROM datasets
         WHERE owner_email = ?
            OR (owner_email = ? AND mode = ?)
         ORDER BY updated_at DESC`,
        ownerEmail,
        PLATFORM_DATASET_OWNER_EMAIL,
        'canonical_public',
      )
      return respondJson({ datasets: rows.map((row) => this.datasetRowToJson(row)) })
    }

    if (pathname === '/assistant-sessions/resolve-cli' && request.method === 'POST') {
      const body = await request.json() as Record<string, unknown>
      const ownerEmail = String(body.ownerEmail ?? '')
      if (!ownerEmail) {
        return respondJson({ error: 'Missing ownerEmail' }, 400)
      }
      const session = this.resolveCliAssistantSession({
        ownerEmail,
        datasetId: body.datasetId ? String(body.datasetId) : null,
        requestedSessionId: body.sessionId ? String(body.sessionId) : null,
        previousResponseId: body.previousResponseId ? String(body.previousResponseId) : null,
        title: body.title ? String(body.title) : null,
        metadata: body.metadata,
      })
      return respondJson({ session: session ? this.assistantSessionToJson(session) : null })
    }

    if (pathname === '/assistant-sessions' && request.method === 'GET') {
      const ownerEmail = url.searchParams.get('ownerEmail')
      if (!ownerEmail) {
        return respondJson({ error: 'Missing ownerEmail' }, 400)
      }
      const kind = url.searchParams.get('kind')
      const runId = url.searchParams.get('runId')
      const datasetId = url.searchParams.get('datasetId')
      return respondJson({
        sessions: this.listAssistantSessions({
          ownerEmail,
          kind,
          runId,
          datasetId,
        }).map((session) => this.assistantSessionToJson(session)),
      })
    }

    if (pathname === '/admin/canonical-datasets/bootstrap' && request.method === 'POST') {
      let runId: string | null = null
      let canonicalDatasetId: string | null = null
      try {
        const body = await request.json().catch(() => ({})) as Record<string, unknown>
        const datasetId = slugify(String(body.datasetId ?? body.id ?? body.name ?? ''))
        canonicalDatasetId = datasetId
        const name = String(body.name ?? datasetId)
        const callbackOrigin = String(body.callbackOrigin ?? '')
        const starterPrompt = String(body.starterPrompt ?? body.prompt ?? '').trim()
        const fieldBrief = body.fieldBrief ? String(body.fieldBrief) : ''
        const sourceType = String(body.sourceType ?? 'public_data')
        const resources = body.resources && typeof body.resources === 'object' ? body.resources : {}
        const requiredEnvironment = Array.isArray(body.requiredEnvironment)
          ? body.requiredEnvironment.map((value) => String(value)).filter(Boolean)
          : ['CANONICAL_DATASET_SLACK_WEBHOOK_URL']
        const optionalEnvironment = Array.isArray(body.optionalEnvironment)
          ? body.optionalEnvironment.map((value) => String(value)).filter(Boolean)
          : ['EXA_API_KEY']
        const requiredArtifacts = Array.isArray(body.requiredArtifacts) && body.requiredArtifacts.length > 0
          ? body.requiredArtifacts.map((value) => String(value)).filter(Boolean)
          : CANONICAL_BOOTSTRAP_REQUIRED_ARTIFACTS
        const docsMirrors = Array.isArray(body.docsMirrors) ? body.docsMirrors : []
        if (!datasetId) {
          return respondJson({ error: 'Missing datasetId' }, 400)
        }
        if (!starterPrompt) {
          return respondJson({ error: 'Missing prompt or starterPrompt' }, 400)
        }
        if (!callbackOrigin) {
          return respondJson({ error: 'Missing callbackOrigin' }, 400)
        }
        const timestamp = nowIso()
        const datasetMountPath = `/data/datasets/${datasetId}`
        const manifestPath = `${datasetMountPath}/manifest.json`
        const description = body.description
          ? String(body.description)
          : fieldBrief || `Canonical public ${name} dataset maintained by Alpha Research.`
        const existingDataset = this.getDataset(datasetId)
        if (existingDataset && existingDataset.ownerEmail !== PLATFORM_DATASET_OWNER_EMAIL) {
          return respondJson({ error: 'Dataset already exists for another owner' }, 409)
        }
        if (existingDataset) {
          await this.expireStaleRunsForDataset(datasetId)
          const blockingRun = this.getLeaseBlockingRun(datasetId)
          if (blockingRun && !isTerminalStatus(blockingRun.status)) {
            return respondJson({
              error: `Dataset ${datasetId} already has active canonical bootstrap run ${blockingRun.id}.`,
              activeRuns: [this.runRowToJson({
                id: blockingRun.id,
                dataset_id: blockingRun.datasetId,
                owner_email: blockingRun.ownerEmail,
                type: blockingRun.type,
                status: blockingRun.status,
                prompt: blockingRun.prompt,
                output_preview: blockingRun.outputPreview,
                worker_id: blockingRun.workerId,
                worker_name: blockingRun.workerName,
                created_at: blockingRun.createdAt,
                updated_at: blockingRun.updatedAt,
              })],
            }, 409)
          }
          this.sql.exec(
            `UPDATE datasets
             SET name = ?, description = ?, source_type = ?, source_filename = ?, mode = ?, manifest_path = ?, updated_at = ?
             WHERE id = ?`,
            name,
            description,
            sourceType,
            'canonical-public-sources',
            'canonical_public',
            manifestPath,
            timestamp,
            datasetId,
          )
        } else {
          this.sql.exec(
            `INSERT INTO datasets (
               id, name, owner_email, source_type, source_filename, mode, description, instance_id, manifest_path,
               deployment_status, status, volume_id, volume_name, volume_region, volume_mount_path, ingest_config_json,
               created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            datasetId,
            name,
            PLATFORM_DATASET_OWNER_EMAIL,
            sourceType,
            'canonical-public-sources',
            'canonical_public',
            description,
            null,
            manifestPath,
            'draft',
            'created',
            null,
            null,
            null,
            null,
            null,
            timestamp,
            timestamp,
          )
        }

        const prompt = [
          `Bootstrap the canonical public dataset "${name}" (${datasetId}) in ${datasetMountPath}.`,
          'This is platform dataset maintenance, not an end-user research report.',
          `Dataset brief: ${fieldBrief || description}`,
          '',
          'Use provider-native public files when license-compatible. Classify every candidate source as active_fetchable, deferred_fetchable, license_review, credential_required, or reject.',
          'Write raw files, source registries, inventories, docs mirrors, and durable dataset briefing files under the dataset directory.',
          `Write the manifest at ${manifestPath}.`,
          `Write these deliverable artifacts to ARTIFACT_DIR: ${requiredArtifacts.join(', ')}.`,
          'Send a concise Slack briefing if CANONICAL_DATASET_SLACK_WEBHOOK_URL is present. Do not write secrets into prompts, logs, artifacts, transcripts, or the dataset volume.',
          '',
          'Starter instructions:',
          starterPrompt,
        ].join('\n')
        const requestedExecution = isPlainRecord(body.execution) ? body.execution : {}
        const config = {
          environmentBootstrap: true,
          canonicalDatasetBootstrap: true,
          sourceDescription: description,
          publicSources: Array.isArray(body.publicSources) ? body.publicSources : [],
          manifestPath,
          callbackOrigin,
          resources,
          requiredEnvironment,
          optionalEnvironment,
          requiredArtifacts,
          docsMirrors,
          execution: {
            provider: 'modal',
            jobKind: 'canonical-dataset-bootstrap',
            codexRunOwner: 'service',
            userSessionRequired: false,
            ...requestedExecution,
          },
        }
        const artifactSpec = requiredArtifacts.map((artifactName) => ({
          type: artifactName.endsWith('.json')
            ? 'json'
            : artifactName.endsWith('.csv')
              ? 'table'
              : 'markdown',
          title: artifactName,
        }))
        runId = this.createRun(datasetId, PLATFORM_DATASET_OWNER_EMAIL, 'canonical-dataset-bootstrap', prompt)
        this.acquireDatasetLease(datasetId, runId)
        this.sql.exec(
          `INSERT INTO run_metadata (run_id, config_json, artifact_spec_json) VALUES (?, ?, ?)`,
          runId,
          JSON.stringify(config),
          JSON.stringify(artifactSpec),
        )
        this.sql.exec(
          `UPDATE datasets
             SET volume_id = ?, volume_name = ?, volume_region = ?, volume_mount_path = ?, manifest_path = ?, deployment_status = ?, status = ?, updated_at = ?
           WHERE id = ?`,
          'agent-dataset',
          'agent-dataset',
          'modal',
          datasetMountPath,
          manifestPath,
          'provisioning',
          'deploying',
          nowIso(),
          datasetId,
        )
        this.appendRunEvent(runId, 'Submitting service-owned canonical dataset bootstrap job to Modal.')
        this.sql.exec(
          `UPDATE runs SET status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
          'booting',
          'Submitting Modal canonical dataset bootstrap job.',
          nowIso(),
          runId,
        )
        const modalJob = await launchModalResearchJob(this.env, {
          datasetId,
          runId,
          runType: 'canonical-dataset-bootstrap',
          prompt,
          configJson: JSON.stringify(config),
          artifactSpecJson: JSON.stringify(artifactSpec),
          callbackOrigin,
          datasetMountPath,
          manifestPath,
          datasetReadOnly: false,
          extraContext: {
            serviceOwned: true,
            userSessionRequired: false,
          },
        })
        this.appendRunEvent(runId, `Modal canonical dataset bootstrap job ${modalJob.id} submitted; results will be written to ${modalJob.resultPath}.`)
        this.sql.exec(
          `UPDATE runs SET worker_id = ?, worker_name = ?, status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
          modalJob.id,
          modalJob.name,
          'booting',
          'Modal canonical dataset bootstrap job submitted.',
          nowIso(),
          runId,
        )
        const dataset = this.getDataset(datasetId)
        return respondJson({
          dataset: dataset ? this.datasetRowToJson(dataset as unknown as Record<string, unknown>) : null,
          run: this.runRowToJson(this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]!),
          modal: {
            provider: 'modal',
            jobId: modalJob.id,
            resultPath: modalJob.resultPath,
            callId: modalJob.callId,
          },
          dashboardUrl: `${callbackOrigin}?view=runs&runId=${encodeURIComponent(runId)}`,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Canonical dataset bootstrap launch failed'
        if (runId) {
          this.appendRunEvent(runId, `Canonical dataset bootstrap launch failed: ${message}`, 'error')
          this.sql.exec(
            `UPDATE runs SET status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
            'failed',
            message,
            nowIso(),
            runId,
          )
          const failedRun = this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]
          if (failedRun) {
            this.releaseDatasetLease(this.parseRunRow(failedRun).datasetId, runId)
          }
        }
        if (canonicalDatasetId) {
          this.sql.exec(
            `UPDATE datasets SET deployment_status = ?, status = ?, updated_at = ? WHERE id = ?`,
            'failed',
            'failed',
            nowIso(),
            canonicalDatasetId,
          )
        }
        return respondJson({ error: message, runId }, 500)
      }
    }

    if (pathname === '/datasets' && request.method === 'POST') {
      const body = await request.json() as Record<string, unknown>
      const ownerEmail = String(body.ownerEmail ?? '')
      const datasetId = slugify(String(body.datasetId ?? ''))
      if (!ownerEmail || !datasetId) {
        return respondJson({ error: 'Missing ownerEmail or datasetId' }, 400)
      }
      const timestamp = nowIso()
      const sourceFilename = body.sourceFilename ? String(body.sourceFilename) : null
      const mode = body.mode ? String(body.mode) : null
      const existing = this.getDataset(datasetId)
      if (existing && existing.ownerEmail !== ownerEmail) {
        return respondJson({ error: 'Dataset already exists for another owner' }, 409)
      }
      if (existing) {
        this.sql.exec(
          `UPDATE datasets
             SET name = ?, description = ?, source_type = ?, source_filename = ?, mode = ?, ingest_config_json = ?, updated_at = ?
           WHERE id = ?`,
          String(body.name ?? datasetId),
          body.description ? String(body.description) : null,
          String(body.sourceType ?? 'uploaded_source'),
          sourceFilename,
          mode,
          body.ingestConfig ? JSON.stringify(body.ingestConfig) : null,
          timestamp,
          datasetId,
        )
      } else {
        this.sql.exec(
          `INSERT INTO datasets (
             id, name, owner_email, source_type, source_filename, mode, description, instance_id, manifest_path,
             deployment_status, status, volume_id, volume_name, volume_region, volume_mount_path, ingest_config_json,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          datasetId,
          String(body.name ?? datasetId),
          ownerEmail,
          String(body.sourceType ?? 'uploaded_source'),
          sourceFilename,
          mode,
          body.description ? String(body.description) : null,
          body.instanceId ? String(body.instanceId) : null,
          body.manifestPath ? String(body.manifestPath) : null,
          'draft',
          'created',
          null,
          null,
          null,
          null,
          body.ingestConfig ? JSON.stringify(body.ingestConfig) : null,
          timestamp,
          timestamp,
        )
      }
      const dataset = this.getDataset(datasetId)
      return respondJson({ dataset: this.datasetRowToJson(dataset as unknown as Record<string, unknown>) })
    }

    const datasetMatch = pathname.match(/^\/datasets\/([^/]+)$/u)
    if (datasetMatch && request.method === 'DELETE') {
      const datasetId = decodeURIComponent(datasetMatch[1] ?? '')
      const ownerEmail = url.searchParams.get('ownerEmail')
      if (!ownerEmail) {
        return respondJson({ error: 'Missing ownerEmail' }, 400)
      }
      const dataset = this.getDataset(datasetId)
      if (!dataset) {
        return respondJson({ ok: true, deleted: false })
      }
      if (dataset.ownerEmail !== ownerEmail) {
        return respondJson({ error: 'Dataset not found' }, 404)
      }
      await this.expireStaleRunsForDataset(datasetId)
      const blockingRun = this.getLeaseBlockingRun(datasetId)
      if (blockingRun && !isTerminalStatus(blockingRun.status)) {
        return respondJson({
          error: `Dataset ${datasetId} has active run ${blockingRun.id}. Cancel it before deleting the dataset.`,
          activeRuns: [this.runRowToJson({
            id: blockingRun.id,
            dataset_id: blockingRun.datasetId,
            owner_email: blockingRun.ownerEmail,
            type: blockingRun.type,
            status: blockingRun.status,
            prompt: blockingRun.prompt,
            output_preview: blockingRun.outputPreview,
            worker_id: blockingRun.workerId,
            worker_name: blockingRun.workerName,
            created_at: blockingRun.createdAt,
            updated_at: blockingRun.updatedAt,
          })],
        }, 409)
      }
      this.sql.exec('DELETE FROM response_session_links WHERE session_id IN (SELECT id FROM assistant_sessions WHERE dataset_id = ?)', datasetId)
      this.sql.exec('DELETE FROM assistant_session_entries WHERE session_id IN (SELECT id FROM assistant_sessions WHERE dataset_id = ?)', datasetId)
      this.sql.exec('DELETE FROM assistant_sessions WHERE dataset_id = ?', datasetId)
      this.sql.exec('DELETE FROM research_specs WHERE dataset_id = ?', datasetId)
      this.sql.exec('DELETE FROM dataset_profiles WHERE dataset_id = ?', datasetId)
      this.sql.exec('DELETE FROM run_artifacts WHERE run_id IN (SELECT id FROM runs WHERE dataset_id = ?)', datasetId)
      this.sql.exec('DELETE FROM run_metadata WHERE run_id IN (SELECT id FROM runs WHERE dataset_id = ?)', datasetId)
      this.sql.exec('DELETE FROM run_events WHERE run_id IN (SELECT id FROM runs WHERE dataset_id = ?)', datasetId)
      this.sql.exec('DELETE FROM runs WHERE dataset_id = ?', datasetId)
      this.sql.exec('DELETE FROM datasets WHERE id = ?', datasetId)
      return respondJson({ ok: true, deleted: true, datasetId })
    }
    if (datasetMatch && request.method === 'GET') {
      const datasetId = decodeURIComponent(datasetMatch[1] ?? '')
      const row = this.getDataset(datasetId)
      if (!row) {
        return respondJson({ error: 'Dataset not found' }, 404)
      }
      return respondJson({
        dataset: {
          ...this.datasetRowToJson(row as unknown as Record<string, unknown>),
          ingestConfig: row.ingestConfigJson ? JSON.parse(row.ingestConfigJson) : null,
          sourceFilename: row.sourceFilename,
          sourceType: row.sourceType,
          profile: this.datasetProfileToJson(this.getDatasetProfile(datasetId)),
        },
      })
    }

    const profileMatch = pathname.match(/^\/datasets\/([^/]+)\/profile$/u)
    if (profileMatch && request.method === 'GET') {
      const datasetId = decodeURIComponent(profileMatch[1] ?? '')
      return respondJson({ profile: this.datasetProfileToJson(this.getDatasetProfile(datasetId)) })
    }

    if (profileMatch && request.method === 'POST') {
      const datasetId = decodeURIComponent(profileMatch[1] ?? '')
      const body = await request.json() as Record<string, unknown>
      const timestamp = nowIso()
      this.sql.exec(
        `INSERT INTO dataset_profiles (
           dataset_id,
           schema_json,
           sample_rows_json,
           notes,
           briefing_markdown,
           profile_json,
           briefing_artifact_id,
           profile_artifact_id,
           described_run_id,
           described_at,
           updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(dataset_id) DO UPDATE SET
           schema_json = excluded.schema_json,
           sample_rows_json = excluded.sample_rows_json,
           notes = excluded.notes,
           briefing_markdown = excluded.briefing_markdown,
           profile_json = excluded.profile_json,
           briefing_artifact_id = excluded.briefing_artifact_id,
           profile_artifact_id = excluded.profile_artifact_id,
           described_run_id = excluded.described_run_id,
           described_at = excluded.described_at,
           updated_at = excluded.updated_at`,
        datasetId,
        body.schema ? JSON.stringify(body.schema) : null,
        body.sampleRows ? JSON.stringify(body.sampleRows) : null,
        body.notes ? String(body.notes) : null,
        body.briefingMarkdown ? String(body.briefingMarkdown) : null,
        body.profile && typeof body.profile === 'object' ? JSON.stringify(body.profile) : null,
        body.briefingArtifactId ? String(body.briefingArtifactId) : null,
        body.profileArtifactId ? String(body.profileArtifactId) : null,
        body.describedRunId ? String(body.describedRunId) : null,
        body.describedAt ? String(body.describedAt) : null,
        timestamp,
      )
      return respondJson({ profile: this.datasetProfileToJson(this.getDatasetProfile(datasetId)) })
    }

    const sourceUploadMatch = pathname.match(/^\/datasets\/([^/]+)\/source-upload$/u)
    if (sourceUploadMatch && request.method === 'POST') {
      const datasetId = decodeURIComponent(sourceUploadMatch[1] ?? '')
      const body = await request.json() as Record<string, unknown>
      const ownerEmail = String(body.ownerEmail ?? '')
      const dataset = this.getDataset(datasetId)
      if (!dataset || dataset.ownerEmail !== ownerEmail) {
        return respondJson({ error: 'Dataset not found' }, 404)
      }
      const sourceFilename = body.filename ? String(body.filename) : dataset.sourceFilename ?? 'dataset.bin'
      const objectKey = `uploads/${datasetId}/${Date.now()}-${sourceFilename.replace(/[^A-Za-z0-9._-]/g, '-')}`
      const upload = await createPresignedObjectStoreUrl(this.env, { method: 'PUT', key: objectKey, expiresSeconds: 60 * 60 * 4 })
      this.sql.exec(
        `UPDATE datasets SET source_filename = ?, source_object_key = ?, status = ?, updated_at = ? WHERE id = ?`,
        sourceFilename,
        objectKey,
        'uploading',
        nowIso(),
        datasetId,
      )
      return respondJson({
        upload: {
          method: 'PUT',
          url: upload.url,
          key: objectKey,
        },
      })
    }

    const sourceCompleteMatch = pathname.match(/^\/datasets\/([^/]+)\/source-complete$/u)
    if (sourceCompleteMatch && request.method === 'POST') {
      const datasetId = decodeURIComponent(sourceCompleteMatch[1] ?? '')
      const body = await request.json() as Record<string, unknown>
      const ownerEmail = String(body.ownerEmail ?? '')
      const dataset = this.getDataset(datasetId)
      if (!dataset || dataset.ownerEmail !== ownerEmail) {
        return respondJson({ error: 'Dataset not found' }, 404)
      }
      this.sql.exec(
        `UPDATE datasets SET source_size_bytes = ?, status = ?, deployment_status = ?, updated_at = ? WHERE id = ?`,
        typeof body.sizeBytes === 'number' ? body.sizeBytes : null,
        'uploaded',
        'upload_ready',
        nowIso(),
        datasetId,
      )
      return respondJson({ ok: true })
    }

    const deployMatch = pathname.match(/^\/datasets\/([^/]+)\/deploy$/u)
    if (deployMatch && request.method === 'POST') {
      try {
        const datasetId = decodeURIComponent(deployMatch[1] ?? '')
        const body = await request.json().catch(() => ({})) as Record<string, unknown>
        const ownerEmail = String(body.ownerEmail ?? '')
        const callbackOrigin = String(body.callbackOrigin ?? '')
        const dataset = this.getDataset(datasetId)
        if (!dataset || dataset.ownerEmail !== ownerEmail) {
          return respondJson({ error: 'Dataset not found' }, 404)
        }
        if (!dataset.sourceObjectKey) {
          return respondJson({ error: 'Dataset source has not been uploaded yet' }, 400)
        }
        if (!callbackOrigin) {
          return respondJson({ error: 'Missing callbackOrigin' }, 400)
        }
        const getUrl = await createPresignedObjectStoreUrl(this.env, {
          method: 'GET',
          key: dataset.sourceObjectKey,
          expiresSeconds: 60 * 60 * 24,
        })
        const runId = this.createRun(datasetId, ownerEmail, 'deploy')
        const datasetMountPath = `/data/datasets/${datasetId}`
        const manifestPath = `${datasetMountPath}/manifest.json`
        this.sql.exec(
          `INSERT INTO run_metadata (run_id, config_json, artifact_spec_json) VALUES (?, ?, ?)`,
          runId,
          JSON.stringify({
            callbackOrigin,
            datasetDescribeCandidate: true,
            sourceDownloadUrl: getUrl.url,
            sourceFilename: dataset.sourceFilename ?? 'source-input',
            mode: dataset.mode ?? 'auto',
            manifestPath,
          }),
          null,
        )
        const cliSession = body.sessionId
          ? this.updateAssistantSession(String(body.sessionId), {
              datasetId,
              runId,
              status: 'active',
            })
          : this.findRecentCliAssistantSession(ownerEmail, datasetId)
        if (cliSession && !body.sessionId) {
          this.updateAssistantSession(cliSession.id, {
            datasetId,
            runId,
            status: 'active',
          })
        }
        const linkedCliSessionId = body.sessionId
          ? String(body.sessionId)
          : cliSession?.id
        if (linkedCliSessionId) {
          this.appendAssistantSessionEntry({
            sessionId: linkedCliSessionId,
            role: 'assistant',
            kind: 'run_launch',
            title: 'Deploy started',
            content: `Started deploy run ${runId} for dataset ${datasetId}.`,
          })
        }
        this.appendRunEvent(runId, 'Submitting Modal dataset deploy job.')
        this.sql.exec(
          `UPDATE datasets
             SET volume_id = ?, volume_name = ?, volume_region = ?, volume_mount_path = ?, manifest_path = ?, deployment_status = ?, status = ?, updated_at = ?
           WHERE id = ?`,
          'agent-dataset',
          'agent-dataset',
          'modal',
          datasetMountPath,
          manifestPath,
          'provisioning',
          'deploying',
          nowIso(),
          datasetId,
        )
        const prompt = [
          `Deploy dataset ${datasetId} into ${datasetMountPath}.`,
          `Download the source file from run_config.json sourceDownloadUrl to ${datasetMountPath}/sources/raw/${dataset.sourceFilename ?? 'source-input'}.`,
          'Normalize or profile the source into useful files under the dataset directory.',
          `Write a manifest at ${manifestPath}.`,
          'Write work.md in the artifact directory describing what was deployed, and report.html as the primary human-readable output.',
          'Do not write secrets or presigned URLs into dataset files or artifacts.',
        ].join('\n')
        const modalJob = await launchModalResearchJob(this.env, {
          datasetId,
          runId,
          runType: 'deploy',
          prompt,
          configJson: JSON.stringify({
            sourceDownloadUrl: getUrl.url,
            sourceFilename: dataset.sourceFilename ?? 'source-input',
            mode: dataset.mode ?? 'auto',
            ingestConfig: dataset.ingestConfigJson ? JSON.parse(dataset.ingestConfigJson) : null,
            manifestPath,
          }),
          callbackOrigin,
          datasetMountPath,
          manifestPath,
          datasetReadOnly: false,
        })
        this.sql.exec(
          `UPDATE runs SET worker_id = ?, worker_name = ?, status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
          modalJob.id,
          modalJob.name,
          'booting',
          'Modal dataset deploy job submitted.',
          nowIso(),
          runId,
        )
        this.appendRunEvent(runId, `Modal dataset deploy job ${modalJob.id} submitted.`)
        const row = this.getDataset(datasetId)
        return respondJson({
          deployment: {
            datasetId,
            status: 'running',
            provider: 'modal',
            resultPath: modalJob.resultPath,
          },
          run: this.runRowToJson(this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]!),
          dataset: row ? this.datasetRowToJson(row as unknown as Record<string, unknown>) : null,
        })
      } catch (error) {
        return respondJson({
          error: error instanceof Error ? error.message : 'Deploy failed',
        }, 500)
      }
    }

    if (pathname === '/runs' && request.method === 'GET') {
      const ownerEmail = url.searchParams.get('ownerEmail')
      const datasetId = url.searchParams.get('datasetId')
      if (!ownerEmail) {
        return respondJson({ error: 'Missing ownerEmail' }, 400)
      }
      const rows = datasetId
        ? this.rows('SELECT * FROM runs WHERE owner_email = ? AND dataset_id = ? ORDER BY updated_at DESC', ownerEmail, datasetId)
        : this.rows('SELECT * FROM runs WHERE owner_email = ? ORDER BY updated_at DESC', ownerEmail)
      return respondJson({ runs: rows.map((row) => this.runRowToJson(row)) })
    }

    const runCreateMatch = pathname.match(/^\/datasets\/([^/]+)\/runs$/u)
    if (runCreateMatch && request.method === 'POST') {
      let runId: string | null = null
      try {
        const datasetId = decodeURIComponent(runCreateMatch[1] ?? '')
        const body = await request.json() as Record<string, unknown>
        const ownerEmail = String(body.ownerEmail ?? '')
        const dataset = this.getDataset(datasetId)
        if (!dataset || !this.canOwnerRunDataset(dataset, ownerEmail)) {
          return respondJson({ error: 'Dataset not found' }, 404)
        }
        const prompt = String(body.prompt ?? '')
        const runType = String(body.type ?? 'analysis')
        const cliSessionId = body.sessionId ? String(body.sessionId) : null
        const config = body.config && typeof body.config === 'object' ? body.config : null
        const artifactSpec = Array.isArray(body.artifacts) ? body.artifacts : []
        runId = this.createRun(datasetId, ownerEmail, runType, prompt)
        const linkedCliSession = cliSessionId
          ? this.updateAssistantSession(cliSessionId, {
              datasetId,
              runId,
              status: 'active',
            })
          : this.findRecentCliAssistantSession(ownerEmail, datasetId)
        if (linkedCliSession && !cliSessionId) {
          this.updateAssistantSession(linkedCliSession.id, {
            datasetId,
            runId,
            status: 'active',
          })
        }
        const linkedCliSessionId = cliSessionId ?? linkedCliSession?.id ?? null
        if (linkedCliSessionId) {
          this.appendAssistantSessionEntry({
            sessionId: linkedCliSessionId,
            role: 'assistant',
            kind: 'run_launch',
            title: 'Run started',
            content: `Started ${runType} run ${runId} for dataset ${datasetId}.`,
          })
        }
        this.sql.exec(
          `INSERT INTO run_metadata (run_id, config_json, artifact_spec_json) VALUES (?, ?, ?)`,
          runId,
          config ? JSON.stringify(config) : null,
          artifactSpec.length > 0 ? JSON.stringify(artifactSpec) : null,
        )
        const remoteAgentConfig = config && typeof config === 'object'
          ? (config as Record<string, unknown>)
          : null
        this.appendRunEvent(runId, 'Preparing Modal agent job.')
        this.sql.exec(
          `UPDATE runs SET status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
          'booting',
          'Preparing Modal agent job.',
          nowIso(),
          runId,
        )
        const launchParams = {
          datasetId,
          runId,
          runType,
          prompt,
          configJson: config ? JSON.stringify(config) : undefined,
          artifactSpecJson: artifactSpec.length > 0 ? JSON.stringify(artifactSpec) : undefined,
          remoteAgentSessionId: typeof remoteAgentConfig?.remoteAgentSessionId === 'string'
            ? remoteAgentConfig.remoteAgentSessionId
            : undefined,
          callbackOrigin: String(body.callbackOrigin ?? ''),
          datasetMountPath: `/data/datasets/${datasetId}`,
          manifestPath: dataset.manifestPath?.startsWith('/data/') ? dataset.manifestPath : `/data/datasets/${datasetId}/manifest.json`,
          datasetReadOnly: true,
        }
        this.appendRunEvent(runId, 'Submitting remote agent job to Modal.')
        const modalJob = await launchModalResearchJob(this.env, launchParams)
        this.appendRunEvent(runId, `Modal agent job ${modalJob.id} submitted; results will be written to ${modalJob.resultPath}.`)
        this.sql.exec(
          `UPDATE runs SET worker_id = ?, worker_name = ?, status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
          modalJob.id,
          modalJob.name,
          'booting',
          'Modal agent job submitted.',
          nowIso(),
          runId,
        )
        return respondJson({ run: this.runRowToJson(this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]!) })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Run launch failed'
        if (runId) {
          this.appendRunEvent(runId, `Remote agent run launch failed: ${message}`, 'error')
          this.sql.exec(
            `UPDATE runs SET status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
            'failed',
            message,
            nowIso(),
            runId,
          )
          const failedRun = this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]
          if (failedRun) {
            this.releaseDatasetLease(this.parseRunRow(failedRun).datasetId, runId)
          }
        }
        return respondJson({
          error: message,
          runId,
        }, 500)
      }
    }

    const publicEnvironmentMatch = pathname.match(/^\/datasets\/([^/]+)\/(?:public-environment|research-environment)$/u)
    if (publicEnvironmentMatch && request.method === 'POST') {
      let runId: string | null = null
      let environmentDatasetId: string | null = null
      try {
        const datasetId = decodeURIComponent(publicEnvironmentMatch[1] ?? '')
        environmentDatasetId = datasetId
        const body = await request.json().catch(() => ({})) as Record<string, unknown>
        const ownerEmail = String(body.ownerEmail ?? '')
        const callbackOrigin = String(body.callbackOrigin ?? '')
        const name = body.name ? String(body.name) : datasetId
        const description = body.description ? String(body.description) : null
        const sourceDescription = String(body.sourceDescription ?? '')
        const prompt = String(body.prompt ?? sourceDescription)
        const artifactSpec = Array.isArray(body.artifacts) ? body.artifacts : []
        const publicSources = Array.isArray(body.publicSources) ? body.publicSources : []
        const uploadedSourceInputs = Array.isArray(body.privateSources)
          ? body.privateSources
          : Array.isArray(body.uploadedSources)
            ? body.uploadedSources
            : []
        if (!ownerEmail || !datasetId) {
          return respondJson({ error: 'Missing ownerEmail or datasetId' }, 400)
        }
        if (!prompt || (!sourceDescription && publicSources.length === 0 && uploadedSourceInputs.length === 0)) {
          return respondJson({ error: 'Missing sourceDescription, publicSources, privateSources, or prompt' }, 400)
        }
        if (!callbackOrigin) {
          return respondJson({ error: 'Missing callbackOrigin' }, 400)
        }
        const privateSources = []
        for (const source of uploadedSourceInputs) {
          if (!source || typeof source !== 'object') continue
          const inputSource = source as Record<string, unknown>
          const key = String(inputSource.key ?? '')
          if (!key.startsWith(`uploads/${datasetId}/`)) {
            return respondJson({ error: `Invalid private source key for dataset ${datasetId}` }, 400)
          }
          const download = await createPresignedObjectStoreUrl(this.env, {
            method: 'GET',
            key,
            expiresSeconds: 60 * 60 * 24 * 7,
          })
          privateSources.push({
            key,
            filename: inputSource.filename ? String(inputSource.filename) : key.split('/').pop() ?? 'source',
            sizeBytes: typeof inputSource.sizeBytes === 'number' ? inputSource.sizeBytes : null,
            description: inputSource.description ? String(inputSource.description) : null,
            downloadUrl: download.url,
          })
        }
        const sourceType = privateSources.length > 0 && (publicSources.length > 0 || sourceDescription)
          ? 'mixed_data'
          : privateSources.length > 0
            ? 'private_data'
            : 'public_data'
        const sourceFilename = sourceType === 'mixed_data'
          ? 'mixed'
          : sourceType === 'private_data'
            ? 'private-uploads'
            : 'internet'
        const existingDataset = this.getDataset(datasetId)
        if (existingDataset && existingDataset.ownerEmail !== ownerEmail) {
          return respondJson({ error: 'Dataset already exists for another owner' }, 409)
        }
        const timestamp = nowIso()
        if (existingDataset) {
          this.sql.exec(
            `UPDATE datasets
             SET name = ?, description = ?, source_type = ?, source_filename = ?, mode = ?, updated_at = ?
             WHERE id = ?`,
            name,
            description,
            sourceType,
            sourceFilename,
            'tabular',
            timestamp,
            datasetId,
          )
        } else {
          this.sql.exec(
            `INSERT INTO datasets (
               id, name, owner_email, source_type, source_filename, mode, description, instance_id, manifest_path,
               deployment_status, status, volume_id, volume_name, volume_region, volume_mount_path, ingest_config_json,
               created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            datasetId,
            name,
            ownerEmail,
            sourceType,
            sourceFilename,
            'tabular',
            description,
            null,
            null,
            'draft',
            'created',
            null,
            null,
            null,
            null,
            null,
            timestamp,
            timestamp,
          )
        }
        await this.expireStaleRunsForDataset(datasetId)
        const blockingRun = this.getLeaseBlockingRun(datasetId)
        if (blockingRun && !isTerminalStatus(blockingRun.status)) {
          return respondJson({
            error: `Dataset ${datasetId} already has an active run holding its volume.`,
            activeRuns: [this.runRowToJson({
              id: blockingRun.id,
              dataset_id: blockingRun.datasetId,
              owner_email: blockingRun.ownerEmail,
              type: blockingRun.type,
              status: blockingRun.status,
              prompt: blockingRun.prompt,
              output_preview: blockingRun.outputPreview,
              worker_id: blockingRun.workerId,
              worker_name: blockingRun.workerName,
              created_at: blockingRun.createdAt,
              updated_at: blockingRun.updatedAt,
            })],
          }, 409)
        }
        const datasetMountPath = `/data/datasets/${datasetId}`
        const manifestPath = `${datasetMountPath}/manifest.json`
        runId = this.createRun(datasetId, ownerEmail, 'environment', prompt)
        this.acquireDatasetLease(datasetId, runId)
        const cliSession = body.sessionId
          ? this.updateAssistantSession(String(body.sessionId), {
              datasetId,
              runId,
              status: 'active',
            })
          : this.findRecentCliAssistantSession(ownerEmail, datasetId)
        if (cliSession && !body.sessionId) {
          this.updateAssistantSession(cliSession.id, {
            datasetId,
            runId,
            status: 'active',
          })
        }
        const linkedCliSessionId = body.sessionId ? String(body.sessionId) : cliSession?.id
        if (linkedCliSessionId) {
          this.appendAssistantSessionEntry({
            sessionId: linkedCliSessionId,
            role: 'assistant',
            kind: 'run_launch',
            title: 'Environment build started',
            content: `Started public-data environment run ${runId} for dataset ${datasetId}.`,
          })
        }
        const config = {
          environmentBootstrap: true,
          sourceDescription,
          publicSources,
          privateSources,
          manifestPath,
          callbackOrigin,
          ...(body.resources && typeof body.resources === 'object'
            ? { resources: body.resources }
            : {}),
        }
        this.sql.exec(
          `INSERT INTO run_metadata (run_id, config_json, artifact_spec_json) VALUES (?, ?, ?)`,
          runId,
          JSON.stringify(config),
          artifactSpec.length > 0 ? JSON.stringify(artifactSpec) : null,
        )
        this.sql.exec(
          `UPDATE datasets
             SET volume_id = ?, volume_name = ?, volume_region = ?, volume_mount_path = ?, manifest_path = ?, deployment_status = ?, status = ?, updated_at = ?
           WHERE id = ?`,
          'agent-dataset',
          'agent-dataset',
          'modal',
          datasetMountPath,
          manifestPath,
          'provisioning',
          'deploying',
          nowIso(),
          datasetId,
        )
        const privateSourceCount = privateSources.length
        const publicSourceCount = publicSources.length
        this.appendRunEvent(
          runId,
          `Submitting Modal research environment job (${publicSourceCount} public source hint${publicSourceCount === 1 ? '' : 's'}, ${privateSourceCount} private upload${privateSourceCount === 1 ? '' : 's'}).`,
        )
        this.sql.exec(
          `UPDATE runs SET status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
          'booting',
          'Submitting Modal public-data research environment job.',
          nowIso(),
          runId,
        )
        const launchParams = {
          datasetId,
          runId,
          runType: 'environment',
          prompt,
          configJson: JSON.stringify(config),
          artifactSpecJson: artifactSpec.length > 0 ? JSON.stringify(artifactSpec) : undefined,
          callbackOrigin,
          datasetMountPath,
          manifestPath,
          datasetReadOnly: false,
        }
        const modalJob = await launchModalResearchJob(this.env, launchParams)
        this.appendRunEvent(runId, `Modal environment job ${modalJob.id} submitted; results will be written to ${modalJob.resultPath}.`)
        this.sql.exec(
          `UPDATE runs SET worker_id = ?, worker_name = ?, status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
          modalJob.id,
          modalJob.name,
          'booting',
          'Modal environment job submitted.',
          nowIso(),
          runId,
        )
        const row = this.getDataset(datasetId)
        return respondJson({
          dataset: row ? this.datasetRowToJson(row as unknown as Record<string, unknown>) : null,
          environment: {
            datasetId,
            status: 'running',
            provider: 'modal',
            manifestPath,
          },
          run: this.runRowToJson(this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]!),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Public-data environment launch failed'
        if (runId) {
          this.appendRunEvent(runId, `Public-data environment launch failed: ${message}`, 'error')
          this.sql.exec(
            `UPDATE runs SET status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
            'failed',
            message,
            nowIso(),
            runId,
          )
          const failedRun = this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]
          if (failedRun) {
            this.releaseDatasetLease(this.parseRunRow(failedRun).datasetId, runId)
          }
        }
        if (environmentDatasetId) {
          this.sql.exec(
            `UPDATE datasets SET deployment_status = ?, status = ?, updated_at = ? WHERE id = ?`,
            'failed',
            'failed',
            nowIso(),
            environmentDatasetId,
          )
        }
        return respondJson({ error: message, runId }, 500)
      }
    }

    const runMatch = pathname.match(/^\/runs\/([^/]+)$/u)
    if (runMatch && request.method === 'GET') {
      const runId = decodeURIComponent(runMatch[1] ?? '')
      const row = this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]
      if (!row) {
        return respondJson({ error: 'Run not found' }, 404)
      }
      return respondJson({ run: this.runRowToJson(row) })
    }

    const assistantSessionMatch = pathname.match(/^\/assistant-sessions\/([^/]+)$/u)
    if (assistantSessionMatch && request.method === 'GET') {
      const sessionId = decodeURIComponent(assistantSessionMatch[1] ?? '')
      const session = this.getAssistantSession(sessionId)
      if (!session) {
        return respondJson({ error: 'Session not found' }, 404)
      }
      return respondJson({
        session: this.assistantSessionToJson(session),
        entries: this.listAssistantSessionEntries(sessionId).map((entry) =>
          this.assistantSessionEntryToJson(entry),
        ),
      })
    }

    if (assistantSessionMatch && request.method === 'POST') {
      const sessionId = decodeURIComponent(assistantSessionMatch[1] ?? '')
      const session = this.getAssistantSession(sessionId)
      if (!session) {
        return respondJson({ error: 'Session not found' }, 404)
      }
      const body = await request.json() as Record<string, unknown>
      const content = String(body.content ?? '')
      if (!content) {
        return respondJson({ error: 'Missing content' }, 400)
      }
      const entryId = this.appendAssistantSessionEntry({
        sessionId,
        role: String(body.role ?? 'assistant'),
        kind: String(body.kind ?? 'message'),
        title: body.title ? String(body.title) : null,
        content,
        metadata: body.metadata,
        createdAt: body.createdAt ? String(body.createdAt) : undefined,
      })
      return respondJson({ id: entryId })
    }

    if (assistantSessionMatch && request.method === 'PATCH') {
      const sessionId = decodeURIComponent(assistantSessionMatch[1] ?? '')
      const session = this.getAssistantSession(sessionId)
      if (!session) {
        return respondJson({ error: 'Session not found' }, 404)
      }
      const body = await request.json() as Record<string, unknown>
      const updated = this.updateAssistantSession(sessionId, {
        datasetId: body.datasetId === undefined ? undefined : body.datasetId ? String(body.datasetId) : null,
        runId: body.runId === undefined ? undefined : body.runId ? String(body.runId) : null,
        title: body.title === undefined ? undefined : body.title ? String(body.title) : null,
        status: body.status === undefined ? undefined : String(body.status),
        metadata: body.metadata,
      })
      return respondJson({ session: updated ? this.assistantSessionToJson(updated) : null })
    }

    const assistantSessionDebugViewMatch = pathname.match(/^\/assistant-sessions\/([^/]+)\/debug-view$/u)
    if (assistantSessionDebugViewMatch && request.method === 'GET') {
      const sessionId = decodeURIComponent(assistantSessionDebugViewMatch[1] ?? '')
      const session = this.getAssistantSession(sessionId)
      if (!session) {
        return respondJson({ error: 'Session not found' }, 404)
      }
      const entries = this.listAssistantSessionEntries(sessionId).map((entry) =>
        this.assistantSessionEntryToJson(entry),
      )
      const attachedRunIds = this.collectRunIdsFromSession(session, entries)
      const attachedRuns = attachedRunIds.map((runId) => {
        const runRow = this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]
        if (!runRow) {
          return null
        }
        return {
          run: this.runRowToJson(runRow),
          metadata: this.getRunMetadata(runId),
          events: this.runEventsForRun(runId),
          artifacts: this.listRunArtifacts(runId),
          sessions: this.listAssistantSessionsForRun(runId).map((attachedSession) => ({
            ...this.assistantSessionToJson(attachedSession),
            entries: this.listAssistantSessionEntries(attachedSession.id).map((entry) =>
              this.assistantSessionEntryToJson(entry),
            ),
          })),
        }
      }).filter((run): run is NonNullable<typeof run> => run !== null)
      const run = attachedRuns[0]?.run ?? null
      const runEvents = attachedRuns.flatMap((attachedRun) => attachedRun.events)
      const errorEntries = entries.filter((entry) => {
        const content = String(entry.content ?? '')
        return entry.role === 'system'
          || entry.kind.includes('error')
          || entry.kind.includes('tool_result')
          || /(?:^|\b)(error|failed|409|holding its volume|busy|unauthorized)(?:\b|$)/iu.test(content)
      })
      const lastErrorEntry = errorEntries.at(-1) ?? null
      const lastRunError = runEvents.filter((event) => event.level === 'error').at(-1) ?? null
      return respondJson({
        session: this.assistantSessionToJson(session),
        entries,
        chatHistory: entries,
        run,
        runEvents,
        attachedRuns,
        debugView: {
          linkedRunId: session.runId,
          attachedRunIds,
          attachedRunCount: attachedRuns.length,
          entryCount: entries.length,
          errorEntryCount: errorEntries.length,
          latestError: lastErrorEntry
            ? {
                source: 'assistant_session',
                entryId: lastErrorEntry.id,
                kind: lastErrorEntry.kind,
                title: lastErrorEntry.title,
                content: lastErrorEntry.content,
                metadata: lastErrorEntry.metadata,
                createdAt: lastErrorEntry.createdAt,
              }
            : lastRunError
              ? {
                  source: 'run_event',
                  eventId: lastRunError.id,
                  content: lastRunError.message,
                  createdAt: lastRunError.createdAt,
                }
              : null,
          runEventCount: runEvents.length,
          lastRunEvent: runEvents.at(-1) ?? null,
        },
      })
    }

    if (pathname === '/assistant-sessions/link-response' && request.method === 'POST') {
      const body = await request.json() as Record<string, unknown>
      const responseId = String(body.responseId ?? '')
      const sessionId = String(body.sessionId ?? '')
      if (!responseId || !sessionId) {
        return respondJson({ error: 'Missing responseId or sessionId' }, 400)
      }
      this.linkResponseToSession(responseId, sessionId)
      return respondJson({ ok: true })
    }

    const runCancelMatch = pathname.match(/^\/runs\/([^/]+)\/cancel$/u)
    if (runCancelMatch && request.method === 'POST') {
      const runId = decodeURIComponent(runCancelMatch[1] ?? '')
      const row = this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]
      if (!row) {
        return respondJson({ error: 'Run not found' }, 404)
      }
      const run = this.parseRunRow(row)
      if (isTerminalStatus(run.status)) {
        return respondJson({ run: this.runRowToJson(row) })
      }
      this.appendRunEvent(runId, 'Cancelled Modal run by user.', 'warning')
      const timestamp = nowIso()
      this.sql.exec(
        `UPDATE runs SET status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
        'cancelled',
        'Cancelled by user.',
        timestamp,
        runId,
      )
      this.releaseDatasetLease(run.datasetId, runId)
      if (run.type === 'deploy') {
        this.sql.exec(
          `UPDATE datasets SET deployment_status = ?, status = ?, updated_at = ? WHERE id = ?`,
          'cancelled',
          'created',
          timestamp,
          run.datasetId,
        )
      }
      return respondJson({ run: this.runRowToJson(this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]!) })
    }

    const runEventsMatch = pathname.match(/^\/runs\/([^/]+)\/events$/u)
    if (runEventsMatch && request.method === 'GET') {
      const runId = decodeURIComponent(runEventsMatch[1] ?? '')
      const after = url.searchParams.get('after')
      let rows
      if (after) {
        const afterRow = this.rows('SELECT seq FROM run_events WHERE id = ? LIMIT 1', after)[0]
        const afterSeq = afterRow ? Number(afterRow.seq) : 0
        rows = this.rows('SELECT id, run_id, message, level, created_at FROM run_events WHERE run_id = ? AND seq > ? ORDER BY seq ASC', runId, afterSeq)
      } else {
        rows = this.rows('SELECT id, run_id, message, level, created_at FROM run_events WHERE run_id = ? ORDER BY seq ASC', runId)
      }
      return respondJson({
        events: rows.map((row) => ({
          id: String(row.id),
          runId: String(row.run_id),
          message: String(row.message),
          level: String(row.level) as 'info' | 'warning' | 'error',
          createdAt: String(row.created_at),
        })),
      })
    }

    const artifactContentMatch = pathname.match(/^\/artifacts\/([^/]+)\/content$/u)
    if (artifactContentMatch && request.method === 'GET') {
      const artifactId = decodeURIComponent(artifactContentMatch[1] ?? '')
      const row = this.rows('SELECT * FROM run_artifacts WHERE id = ? LIMIT 1', artifactId)[0]
      if (!row) {
        return respondJson({ error: 'Artifact not found' }, 404)
      }
      const content = row.content_json ? JSON.parse(String(row.content_json)) : null
      const storage = isPlainRecord(content) && isPlainRecord(content.storage) ? content.storage : null
      const key = storage && typeof storage.key === 'string' ? storage.key : null
      if (!key || !this.env.ARTIFACT_BUCKET) {
        return respondJson({ error: 'Artifact content is not available in object storage' }, 404)
      }
      const object = await this.env.ARTIFACT_BUCKET.get(key)
      if (!object || !object.body) {
        return respondJson({ error: 'Artifact object not found' }, 404)
      }
      const headers = new Headers()
      object.writeHttpMetadata(headers)
      if (!headers.has('Content-Type')) {
        const mimeType = isPlainRecord(content) && typeof content.mimeType === 'string'
          ? content.mimeType
          : 'application/octet-stream'
        headers.set('Content-Type', mimeType)
      }
      headers.set('Cache-Control', 'private, max-age=300')
      return new Response(object.body, { headers })
    }

    const runArtifactsMatch = pathname.match(/^\/runs\/([^/]+)\/artifacts$/u)
    if (runArtifactsMatch && request.method === 'GET') {
      const runId = decodeURIComponent(runArtifactsMatch[1] ?? '')
      return respondJson({ artifacts: this.listRunArtifacts(runId) })
    }

    const runResultsMatch = pathname.match(/^\/runs\/([^/]+)\/results$/u)
    if (runResultsMatch && request.method === 'GET') {
      const runId = decodeURIComponent(runResultsMatch[1] ?? '')
      const runRow = this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]
      if (!runRow) {
        return respondJson({ error: 'Run not found' }, 404)
      }
      const events = this.rows(
        'SELECT id, run_id, message, level, created_at FROM run_events WHERE run_id = ? ORDER BY seq ASC',
        runId,
      ).map((row) => ({
        id: String(row.id),
        runId: String(row.run_id),
        message: String(row.message),
        level: String(row.level),
        createdAt: String(row.created_at),
      }))
      return respondJson({
        run: this.runRowToJson(runRow),
        metadata: this.getRunMetadata(runId),
        artifacts: this.listRunArtifacts(runId),
        events,
        sessions: this.listAssistantSessionsForRun(runId).map((session) => ({
          ...this.assistantSessionToJson(session),
          entries: this.listAssistantSessionEntries(session.id).map((entry) =>
            this.assistantSessionEntryToJson(entry),
          ),
        })),
      })
    }

    const runDebugViewMatch = pathname.match(/^\/runs\/([^/]+)\/debug-view$/u)
    if (runDebugViewMatch && request.method === 'GET') {
      const runId = decodeURIComponent(runDebugViewMatch[1] ?? '')
      const runRow = this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]
      if (!runRow) {
        return respondJson({ error: 'Run not found' }, 404)
      }
      const run = this.runRowToJson(runRow)
      const metadata = this.getRunMetadata(runId)
      const artifacts = this.listRunArtifacts(runId)
      const events = this.rows(
        'SELECT id, run_id, message, level, created_at FROM run_events WHERE run_id = ? ORDER BY seq ASC',
        runId,
      ).map((row) => ({
        id: String(row.id),
        runId: String(row.run_id),
        message: String(row.message),
        level: String(row.level),
        createdAt: String(row.created_at),
      }))
      const sessions = this.listAssistantSessionsForRun(runId).map((session) => ({
        ...this.assistantSessionToJson(session),
        entries: this.listAssistantSessionEntries(session.id).map((entry) =>
          this.assistantSessionEntryToJson(entry),
        ),
      }))
      const remoteSessionArtifact = artifacts.find((artifact) => artifact.type === 'remote_agent_session')
      const remoteSessionId =
        remoteSessionArtifact && typeof remoteSessionArtifact.content?.sessionId === 'string'
          ? remoteSessionArtifact.content.sessionId
          : null
      const hasRemoteLogs =
        sessions.some((session) => session.kind === 'remote_codex' && (session.entries?.length ?? 0) > 0)
        || artifacts.some((artifact) => artifact.type === 'remote_agent_transcript' || artifact.type === 'remote_agent_session')
      const lastEvent = events.at(-1) ?? null
      const updatedAtMs = Date.parse(String(run.updatedAt))
      const heartbeatAgeSeconds = Number.isFinite(updatedAtMs)
        ? Math.max(0, Math.round((Date.now() - updatedAtMs) / 1000))
        : null
      const terminal = isTerminalStatus(String(run.status))
      return respondJson({
        run,
        debugView: {
          remoteSessionId,
          hasRemoteLogs,
          defaultView: hasRemoteLogs ? 'remote' : 'cli',
          terminal,
          health: terminal
            ? String(run.status).toLowerCase()
            : heartbeatAgeSeconds !== null && heartbeatAgeSeconds > Math.round(RUN_HEARTBEAT_TIMEOUT_MS / 1000)
              ? 'stale'
              : 'active',
          heartbeatAgeSeconds,
          eventCount: events.length,
          lastEvent,
          requestedArtifacts: Array.isArray(metadata?.artifactSpec) ? metadata.artifactSpec : [],
          producedArtifacts: artifacts.map((artifact) => ({
            id: artifact.id,
            title: artifact.title,
            type: artifact.type,
            createdAt: artifact.createdAt,
          })),
          artifactTypes: artifacts.map((artifact) => ({
            id: artifact.id,
            title: artifact.title,
            type: artifact.type,
          })),
          sessionKinds: sessions.map((session) => ({
            id: session.id,
            kind: session.kind,
            status: session.status,
            entryCount: session.entries?.length ?? 0,
          })),
        },
      })
    }

    if (pathname === '/research-specs' && request.method === 'GET') {
      const ownerEmail = url.searchParams.get('ownerEmail')
      const datasetId = url.searchParams.get('datasetId')
      if (!ownerEmail) {
        return respondJson({ error: 'Missing ownerEmail' }, 400)
      }
      const rows = datasetId
        ? this.rows('SELECT * FROM research_specs WHERE owner_email = ? AND dataset_id = ? ORDER BY updated_at DESC', ownerEmail, datasetId)
        : this.rows('SELECT * FROM research_specs WHERE owner_email = ? ORDER BY updated_at DESC', ownerEmail)
      return respondJson({ specs: rows.map((row) => this.researchSpecToJson(row)) })
    }

    if (pathname === '/research-specs' && request.method === 'POST') {
      const body = await request.json() as Record<string, unknown>
      const ownerEmail = String(body.ownerEmail ?? '')
      const datasetId = String(body.datasetId ?? '')
      const hypothesis = String(body.hypothesis ?? '')
      if (!ownerEmail || !datasetId || !hypothesis) {
        return respondJson({ error: 'Missing ownerEmail, datasetId, or hypothesis' }, 400)
      }
      const id = crypto.randomUUID()
      const timestamp = nowIso()
      this.sql.exec(
        `INSERT INTO research_specs (id, owner_email, dataset_id, hypothesis, spec_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        ownerEmail,
        datasetId,
        hypothesis,
        body.spec ? JSON.stringify(body.spec) : null,
        String(body.status ?? 'draft'),
        timestamp,
        timestamp,
      )
      return respondJson({ spec: this.researchSpecToJson(this.rows('SELECT * FROM research_specs WHERE id = ?', id)[0]!) })
    }

    const researchSpecMatch = pathname.match(/^\/research-specs\/([^/]+)$/u)
    if (researchSpecMatch && request.method === 'GET') {
      const id = decodeURIComponent(researchSpecMatch[1] ?? '')
      const row = this.rows('SELECT * FROM research_specs WHERE id = ?', id)[0]
      if (!row) {
        return respondJson({ error: 'Research spec not found' }, 404)
      }
      return respondJson({ spec: this.researchSpecToJson(row) })
    }

    const internalEventMatch = pathname.match(/^\/internal\/runs\/([^/]+)\/events$/u)
    if (internalEventMatch && request.method === 'POST') {
      const runId = decodeURIComponent(internalEventMatch[1] ?? '')
      const level = request.headers.get('X-Run-Level') ?? 'info'
      const message = await request.text()
      this.appendRunEvent(runId, message, level)
      return respondJson({ ok: true })
    }

    const internalBillingCheckMatch = pathname.match(/^\/internal\/runs\/([^/]+)\/billing-check$/u)
    if (internalBillingCheckMatch && request.method === 'GET') {
      const runId = decodeURIComponent(internalBillingCheckMatch[1] ?? '')
      const runRow = this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]
      const run = runRow ? this.parseRunRow(runRow) : null
      if (!run) {
        return respondJson({ error: 'Run not found' }, 404)
      }
      return respondJson({ overview: this.billingOverviewForRun(run) })
    }

    const internalBillingEventMatch = pathname.match(/^\/internal\/runs\/([^/]+)\/billing-events$/u)
    if (internalBillingEventMatch && request.method === 'POST') {
      const runId = decodeURIComponent(internalBillingEventMatch[1] ?? '')
      const runRow = this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]
      const run = runRow ? this.parseRunRow(runRow) : null
      if (!run) {
        return respondJson({ error: 'Run not found' }, 404)
      }
      const body = await request.json() as Record<string, unknown>
      const event = isPlainRecord(body.event) ? body.event as BillingUsageEventInput : null
      if (!event) {
        return respondJson({ error: 'Missing event' }, 400)
      }
      const session = this.listAssistantSessionsForRun(run.id)[0] ?? null
      this.trackBillingEvent(run.ownerEmail, {
        ...event,
        sessionId: session?.id ?? null,
        runId: run.id,
        source: typeof body.source === 'string' ? body.source : 'remote_codex_runner',
      })
      return respondJson({ ok: true })
    }

    const internalSessionEntryMatch = pathname.match(/^\/internal\/runs\/([^/]+)\/session-entries$/u)
    if (internalSessionEntryMatch && request.method === 'POST') {
      const runId = decodeURIComponent(internalSessionEntryMatch[1] ?? '')
      const runRow = this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]
      const run = runRow ? this.parseRunRow(runRow) : null
      if (!run) {
        return respondJson({ error: 'Run not found' }, 404)
      }
      const body = await request.json() as Record<string, unknown>
      const session = this.ensureRunAssistantSession(run, String(body.sessionKind ?? 'remote_codex'), {
        title: body.sessionTitle ? String(body.sessionTitle) : 'Remote Codex session',
      })
      const content = String(body.content ?? '')
      if (!session || !content) {
        return respondJson({ error: 'Missing session or content' }, 400)
      }
      const id = this.appendAssistantSessionEntry({
        sessionId: session.id,
        role: String(body.role ?? 'assistant'),
        kind: String(body.kind ?? 'message'),
        title: body.title ? String(body.title) : null,
        content,
        metadata: body.metadata,
        createdAt: body.createdAt ? String(body.createdAt) : undefined,
      })
      return respondJson({ id })
    }

    const internalArtifactMatch = pathname.match(/^\/internal\/runs\/([^/]+)\/artifacts$/u)
    if (internalArtifactMatch && request.method === 'POST') {
      const runId = decodeURIComponent(internalArtifactMatch[1] ?? '')
      const body = await request.json() as Record<string, unknown>
      const id = await this.createStoredRunArtifact(
        runId,
        String(body.type ?? 'artifact'),
        String(body.title ?? 'artifact'),
        body.content,
        body.url ? String(body.url) : null,
      )
      return respondJson({ ok: true, id })
    }

    const internalStatusMatch = pathname.match(/^\/internal\/runs\/([^/]+)\/status$/u)
    if (internalStatusMatch && request.method === 'POST') {
      const runId = decodeURIComponent(internalStatusMatch[1] ?? '')
      const body = await request.json() as Record<string, unknown>
      const runRow = this.rows('SELECT * FROM runs WHERE id = ?', runId)[0]
      const run = runRow ? this.parseRunRow(runRow) : null
      if (!run) {
        return respondJson({ error: 'Run not found' }, 404)
      }
      if (isTerminalStatus(run.status)) {
        return respondJson({ run: this.runRowToJson(runRow!), ignored: true })
      }
      const timestamp = nowIso()
      const status = String(body.status ?? 'running')
      this.sql.exec(
        `UPDATE runs SET status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
        status,
        body.outputPreview ? String(body.outputPreview) : null,
        timestamp,
        runId,
      )
      if (status === 'booting' || status === 'running') {
        this.acquireDatasetLease(run.datasetId, runId)
      }
      if (['ready', 'failed', 'cancelled', 'worker_unreachable'].includes(status)) {
        await this.generateRunLabel(runId).catch((error) => {
          this.appendRunEvent(
            runId,
            `Run label generation skipped: ${error instanceof Error ? error.message : 'unknown error'}`,
            'warning',
          )
        })
      }
      if (body.deploymentStatus || body.manifestPath || body.volumeMountPath) {
        this.sql.exec(
          `UPDATE datasets SET deployment_status = ?, manifest_path = COALESCE(?, manifest_path), volume_mount_path = COALESCE(?, volume_mount_path), status = ?, updated_at = ?
           WHERE id = ?`,
           body.deploymentStatus ? String(body.deploymentStatus) : 'running',
          body.manifestPath ? String(body.manifestPath) : null,
          body.volumeMountPath ? String(body.volumeMountPath) : null,
          status === 'ready' ? 'ready' : status === 'failed' ? 'failed' : 'deploying',
          timestamp,
          run.datasetId,
        )
      }
      const metadata = this.getRunMetadata(runId)
      const config = metadata?.config && typeof metadata.config === 'object'
        ? metadata.config as Record<string, unknown>
        : null
      if (config?.environmentBootstrap && (status === 'ready' || status === 'failed')) {
        const dataset = this.getDataset(run.datasetId)
        const manifestPath = typeof config.manifestPath === 'string'
          ? config.manifestPath
          : dataset?.manifestPath ?? (dataset?.volumeMountPath ? `${dataset.volumeMountPath}/manifest.json` : null)
        this.sql.exec(
          `UPDATE datasets SET deployment_status = ?, status = ?, manifest_path = COALESCE(?, manifest_path), updated_at = ? WHERE id = ?`,
          status === 'ready' ? 'ready' : 'failed',
          status === 'ready' ? 'ready' : 'failed',
          manifestPath,
          timestamp,
          run.datasetId,
        )
      }
      if (isTerminalStatus(status)) {
        this.releaseDatasetLease(run.datasetId, runId)
      }
      if (
        status === 'ready' &&
        run.type !== 'describe' &&
        (run.type === 'deploy' || config?.environmentBootstrap) &&
        typeof config?.callbackOrigin === 'string' &&
        config.callbackOrigin
      ) {
        const existingDescribe = this.rows(
          `SELECT id FROM runs
           WHERE dataset_id = ? AND type = ? AND created_at >= ?
           LIMIT 1`,
          run.datasetId,
          'describe',
          run.createdAt,
        )[0]
        if (!existingDescribe) {
          const describePrompt = [
            `Describe dataset ${run.datasetId}.`,
            'Produce a durable documentation briefing for humans. Do not include query instructions, starter analyses, or suggestions for how to use agents; this is a dataset documentation task only.',
            'Inspect mounted files, manifests, source registries, table catalogs, Parquet/CSV/JSON/DuckDB files, README files, data dictionaries, QA reports, schemas, sample rows, provenance, source URLs, formats, time coverage, geography coverage, transformations, validation status, limitations, and known gaps.',
            'Create Dataset Briefing markdown with sections: Overview; Data Inventory; Sources; Schemas; Time Coverage; Geography Coverage; Formats; Transformations & Derived Fields; Quality & Validation; Limitations & Known Gaps.',
            'Create Dataset Profile JSON with summary, sources, tables, schemas/columns, timeCoverage, geographyCoverage, formats, transformations, quality, limitations, and generatedAt.',
          ].join('\n')
          await this.fetch(new Request(`https://control-plane.local/datasets/${encodeURIComponent(run.datasetId)}/runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ownerEmail: run.ownerEmail,
              callbackOrigin: config.callbackOrigin,
              type: 'describe',
              prompt: describePrompt,
              artifacts: [
                { type: 'markdown', title: 'Dataset Briefing' },
                { type: 'json', title: 'Dataset Profile' },
              ],
              config: { describeDataset: true, callbackOrigin: config.callbackOrigin },
            }),
          }))
        }
      }
      return respondJson({ ok: true })
    }

    return respondJson({ error: 'Not found' }, 404)
  }
}
