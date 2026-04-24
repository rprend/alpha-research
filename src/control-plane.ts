import { createPresignedSpacesUrl } from './spaces'
import {
  attachVolumeToDroplet,
  deleteDroplet,
  detachVolumeByDroplet,
  ensureDatasetVolume,
  ensureWarmResearchPool,
  inferResearchSizeClass,
  launchIngestDroplet,
  launchResearchDroplet,
  waitForVolumeDetachment,
} from './digitalocean'

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

type Env = {
  DIGITALOCEAN_API_TOKEN?: string
  DIGITALOCEAN_REGION?: string
  DIGITALOCEAN_VOLUME_SIZE_GIB?: string
  DIGITALOCEAN_VOLUME_MOUNT_ROOT?: string
  DIGITALOCEAN_INGEST_DROPLET_SIZE?: string
  DIGITALOCEAN_INGEST_IMAGE?: string
  DIGITALOCEAN_RESEARCH_RUNNER_IMAGE?: string
  DIGITALOCEAN_RESEARCH_DROPLET_SIZE_SMALL?: string
  DIGITALOCEAN_RESEARCH_DROPLET_SIZE_MEDIUM?: string
  DIGITALOCEAN_RESEARCH_DROPLET_SIZE_LARGE?: string
  DIGITALOCEAN_RESEARCH_WARM_POOL_SIZE_SMALL?: string
  DIGITALOCEAN_RESEARCH_WARM_POOL_SIZE_MEDIUM?: string
  DIGITALOCEAN_RESEARCH_WARM_POOL_SIZE_LARGE?: string
  RESEARCH_CONTROL_ORIGIN?: string
  DIGITALOCEAN_SSH_KEY_IDS?: string
  DIGITALOCEAN_PROJECT_ID?: string
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
  RESEARCH_INTERNAL_RUNNER_TOKEN?: string
  RESEARCH_DATASET_REPO_REF?: string
  OPENAI_API_KEY?: string
  RESEARCH_AGENT_MODEL?: string
  REMOTE_AGENT_MODEL?: string
  REMOTE_AGENT_EXECUTOR?: string
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
  updatedAt: string
}

type RunRecord = {
  id: string
  datasetId: string
  ownerEmail: string
  type: string
  status: string
  prompt: string | null
  outputPreview: string | null
  dropletId: string | null
  dropletName: string | null
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

type RunnerPoolRecord = {
  dropletId: string
  dropletName: string
  sizeClass: string
  region: string | null
  status: string
  assignedRunId: string | null
  lastHeartbeatAt: string
  createdAt: string
  updatedAt: string
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

function encodeBase64(value: string) {
  return btoa(unescape(encodeURIComponent(value)))
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
}

function isVolumeBusyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('storage already associated with another droplet')
}

const RUN_HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000
const RUNNER_POOL_HEARTBEAT_TIMEOUT_MS = 90 * 1000

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
        prompt TEXT,
        output_preview TEXT,
        droplet_id TEXT,
        droplet_name TEXT,
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
      CREATE TABLE IF NOT EXISTS response_session_links (
        response_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL
      );
    `)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS runner_pool (
        droplet_id TEXT PRIMARY KEY,
        droplet_name TEXT NOT NULL,
        size_class TEXT NOT NULL,
        status TEXT NOT NULL,
        region TEXT,
        assigned_run_id TEXT,
        last_heartbeat_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
    try { this.sql.exec('ALTER TABLE runner_pool ADD COLUMN region TEXT') } catch {}
    try { this.sql.exec('ALTER TABLE datasets ADD COLUMN active_run_id TEXT') } catch {}
    try { this.sql.exec('ALTER TABLE datasets ADD COLUMN lease_acquired_at TEXT') } catch {}
  }

  private rows(query: string, ...bindings: unknown[]) {
    return [...this.sql.exec(query, ...bindings)] as Array<Record<string, unknown>>
  }

  private async expireStaleRun(run: RunRecord) {
    if (!isStaleActiveRun(run)) {
      return false
    }
    this.appendRunEvent(
      run.id,
      'Run marked failed because the remote droplet stopped heartbeating.',
      'error',
    )
    this.sql.exec(
      `UPDATE runs SET status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
      'failed',
      'Run marked failed because the remote droplet stopped heartbeating.',
      nowIso(),
      run.id,
    )
    this.releaseDatasetLease(run.datasetId, run.id)
    if (run.dropletId) {
      try {
        const dataset = this.getDataset(run.datasetId)
        const pooledRunner = this.getRunnerPoolEntry(run.dropletId)
        if (pooledRunner) {
          if (dataset?.volumeId) {
            await detachVolumeByDroplet(this.env, dataset.volumeId, run.dropletId, dataset.volumeRegion ?? this.env.DIGITALOCEAN_REGION).catch(() => undefined)
            await waitForVolumeDetachment(this.env, dataset.volumeId).catch(() => undefined)
          }
          this.clearRunnerPoolEntryAssignment(run.dropletId)
          this.appendRunEvent(run.id, `Released pooled runner ${pooledRunner.dropletName}.`, 'warning')
        } else {
          await deleteDroplet(this.env, run.dropletId)
          if (dataset?.volumeId) {
            await waitForVolumeDetachment(this.env, dataset.volumeId).catch(() => undefined)
          }
          this.appendRunEvent(run.id, `Deleted stale droplet ${run.dropletName ?? run.dropletId}.`, 'warning')
        }
      } catch (error) {
        this.appendRunEvent(
          run.id,
          `Failed to clean up stale runner ${run.dropletName ?? run.dropletId}: ${error instanceof Error ? error.message : String(error)}`,
          'error',
        )
      }
    }
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

  private getActiveRunsForDataset(datasetId: string) {
    return this.rows(
      'SELECT * FROM runs WHERE dataset_id = ? ORDER BY created_at DESC',
      datasetId,
    )
      .map((row) => this.parseRunRow(row))
      .filter((run) => !isTerminalStatus(run.status))
  }

  private parseRunnerPoolRow(row: Record<string, unknown>): RunnerPoolRecord {
    return {
      dropletId: String(row.droplet_id ?? row.dropletId),
      dropletName: String(row.droplet_name ?? row.dropletName),
      sizeClass: String(row.size_class ?? row.sizeClass),
      region: row.region ? String(row.region) : null,
      status: String(row.status),
      assignedRunId: row.assigned_run_id ?? row.assignedRunId ? String(row.assigned_run_id ?? row.assignedRunId) : null,
      lastHeartbeatAt: String(row.last_heartbeat_at ?? row.lastHeartbeatAt),
      createdAt: String(row.created_at ?? row.createdAt),
      updatedAt: String(row.updated_at ?? row.updatedAt),
    }
  }

  private getRunnerPoolEntry(dropletId: string) {
    const row = this.rows('SELECT * FROM runner_pool WHERE droplet_id = ? LIMIT 1', dropletId)[0]
    return row ? this.parseRunnerPoolRow(row) : null
  }

  private isRunnerPoolAlive(entry: RunnerPoolRecord) {
    const lastHeartbeat = Date.parse(entry.lastHeartbeatAt)
    return Number.isFinite(lastHeartbeat) && (Date.now() - lastHeartbeat) <= RUNNER_POOL_HEARTBEAT_TIMEOUT_MS
  }

  private registerRunnerPoolHeartbeat(dropletId: string, dropletName: string, sizeClass: string, region: string | null) {
    const now = nowIso()
    const existing = this.getRunnerPoolEntry(dropletId)
    if (existing) {
      this.sql.exec(
        `UPDATE runner_pool
           SET droplet_name = ?, size_class = ?, region = ?, status = ?, last_heartbeat_at = ?, updated_at = ?
         WHERE droplet_id = ?`,
        dropletName,
        sizeClass,
        region,
        existing.assignedRunId ? 'busy' : 'idle',
        now,
        now,
        dropletId,
      )
      return
    }
    this.sql.exec(
      `INSERT INTO runner_pool (
         droplet_id, droplet_name, size_class, region, status, assigned_run_id, last_heartbeat_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      dropletId,
      dropletName,
      sizeClass,
      region,
      'idle',
      null,
      now,
      now,
      now,
    )
  }

  private findIdleRunnerPoolEntry(sizeClass: string) {
    const region = this.env.DIGITALOCEAN_REGION ?? 'nyc3'
    const entries = this.rows(
      `SELECT * FROM runner_pool
       WHERE size_class = ? AND region = ? AND (assigned_run_id IS NULL OR assigned_run_id = '')
       ORDER BY updated_at ASC`,
      sizeClass,
      region,
    ).map((row) => this.parseRunnerPoolRow(row))
    return entries.find((entry) => this.isRunnerPoolAlive(entry)) ?? null
  }

  private assignRunnerPoolEntry(dropletId: string, runId: string) {
    this.sql.exec(
      `UPDATE runner_pool
         SET assigned_run_id = ?, status = ?, updated_at = ?
       WHERE droplet_id = ?`,
      runId,
      'busy',
      nowIso(),
      dropletId,
    )
  }

  private clearRunnerPoolEntryAssignment(dropletId: string) {
    this.sql.exec(
      `UPDATE runner_pool
         SET assigned_run_id = NULL, status = ?, updated_at = ?
       WHERE droplet_id = ?`,
      'idle',
      nowIso(),
      dropletId,
    )
  }

  private datasetRowToJson(row: Record<string, unknown>) {
    const dataset = this.parseDatasetRow(row)
    return {
      id: dataset.id,
      name: dataset.name,
      status: dataset.status,
      deploymentStatus: dataset.deploymentStatus,
      createdAt: dataset.createdAt,
      updatedAt: dataset.updatedAt,
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
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      prompt: run.prompt ?? undefined,
      outputPreview: run.outputPreview ?? undefined,
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
      prompt: row.prompt ? String(row.prompt) : null,
      outputPreview: get('output_preview', 'outputPreview') ? String(get('output_preview', 'outputPreview')) : null,
      dropletId: get('droplet_id', 'dropletId') ? String(get('droplet_id', 'dropletId')) : null,
      dropletName: get('droplet_name', 'dropletName') ? String(get('droplet_name', 'dropletName')) : null,
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

  private createRunArtifact(runId: string, type: string, title: string, content?: unknown, url?: string | null) {
    this.sql.exec(
      `INSERT INTO run_artifacts (id, run_id, type, title, url, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      runId,
      type,
      title,
      url ?? null,
      content === undefined ? null : JSON.stringify(content),
      nowIso(),
    )
  }

  private getDataset(id: string) {
    const row = this.rows('SELECT * FROM datasets WHERE id = ? LIMIT 1', id)[0]
    return row ? this.parseDatasetRow(row) : undefined
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
    this.sql.exec(
      `INSERT INTO runs (id, dataset_id, owner_email, type, status, prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      datasetId,
      ownerEmail,
      type,
      'queued',
      prompt ?? null,
      timestamp,
      timestamp,
    )
    return id
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
    this.sql.exec(
      `INSERT INTO assistant_session_entries (id, session_id, role, kind, title, content, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      params.sessionId,
      params.role,
      params.kind,
      params.title ?? null,
      params.content,
      params.metadata === undefined ? null : JSON.stringify(params.metadata),
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

    if (pathname === '/datasets' && request.method === 'GET') {
      const ownerEmail = url.searchParams.get('ownerEmail')
      if (!ownerEmail) {
        return respondJson({ error: 'Missing ownerEmail' }, 400)
      }
      const rows = this.rows(
        `SELECT * FROM datasets WHERE owner_email = ? ORDER BY updated_at DESC`,
        ownerEmail,
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
        `INSERT INTO dataset_profiles (dataset_id, schema_json, sample_rows_json, notes, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(dataset_id) DO UPDATE SET
           schema_json = excluded.schema_json,
           sample_rows_json = excluded.sample_rows_json,
           notes = excluded.notes,
           updated_at = excluded.updated_at`,
        datasetId,
        body.schema ? JSON.stringify(body.schema) : null,
        body.sampleRows ? JSON.stringify(body.sampleRows) : null,
        body.notes ? String(body.notes) : null,
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
      const upload = await createPresignedSpacesUrl(this.env, { method: 'PUT', key: objectKey, expiresSeconds: 60 * 60 * 4 })
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
              droplet_id: blockingRun.dropletId,
              droplet_name: blockingRun.dropletName,
              created_at: blockingRun.createdAt,
              updated_at: blockingRun.updatedAt,
            })],
          }, 409)
        }
        if (dataset.volumeId) {
          await waitForVolumeDetachment(this.env, dataset.volumeId).catch(() => undefined)
        }
        const volume = await ensureDatasetVolume(this.env, datasetId)
        const getUrl = await createPresignedSpacesUrl(this.env, {
          method: 'GET',
          key: dataset.sourceObjectKey,
          expiresSeconds: 60 * 60 * 24,
        })
        const runId = this.createRun(datasetId, ownerEmail, 'deploy')
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
        this.appendRunEvent(runId, 'Provisioning DigitalOcean volume and ingest droplet.')
        this.sql.exec(
          `UPDATE datasets
             SET volume_id = ?, volume_name = ?, volume_region = ?, volume_mount_path = ?, deployment_status = ?, status = ?, updated_at = ?
           WHERE id = ?`,
          volume.id,
          volume.name,
          volume.region,
          volume.datasetMountPath,
          'provisioning',
          'deploying',
          nowIso(),
          datasetId,
        )
        const ingestConfig = dataset.ingestConfigJson ? JSON.parse(dataset.ingestConfigJson) as Record<string, string> : {}
        const ingestArgs: string[] = []
        if (ingestConfig.entityType) ingestArgs.push('--entity-type', String(ingestConfig.entityType))
        if (ingestConfig.titleField) ingestArgs.push('--title-field', String(ingestConfig.titleField))
        if (ingestConfig.summaryField) ingestArgs.push('--summary-field', String(ingestConfig.summaryField))
        if (ingestConfig.textFields) ingestArgs.push('--text-fields', String(ingestConfig.textFields))
        if (ingestConfig.dateField) ingestArgs.push('--date-field', String(ingestConfig.dateField))
        const droplet = await launchIngestDroplet(this.env, {
          datasetId,
          instanceId: datasetId,
          runId,
          volumeName: volume.name,
          volumeId: volume.id,
          sourceDownloadUrl: getUrl.url,
          sourceFilename: dataset.sourceFilename ?? 'source-input',
          outputRoot: `${volume.mountRoot}/data/instances`,
          productName: dataset.name,
          mode: dataset.mode ?? 'auto',
          ingestArgs,
          callbackOrigin,
        })
        this.sql.exec(
          `UPDATE runs SET droplet_id = ?, droplet_name = ?, status = ?, updated_at = ? WHERE id = ?`,
          droplet.id,
          droplet.name,
          'booting',
          nowIso(),
          runId,
        )
        this.appendRunEvent(runId, `Ingest droplet ${droplet.name} launched in ${droplet.region}.`)
        const row = this.getDataset(datasetId)
        return respondJson({
          deployment: {
            datasetId,
            status: 'running',
            volume,
            droplet,
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
        if (!dataset || dataset.ownerEmail !== ownerEmail) {
          return respondJson({ error: 'Dataset not found' }, 404)
        }
        const prompt = String(body.prompt ?? '')
        const runType = String(body.type ?? 'analysis')
        const cliSessionId = body.sessionId ? String(body.sessionId) : null
        const config = body.config && typeof body.config === 'object' ? body.config : null
        const artifactSpec = Array.isArray(body.artifacts) ? body.artifacts : []
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
              droplet_id: blockingRun.dropletId,
              droplet_name: blockingRun.dropletName,
              created_at: blockingRun.createdAt,
              updated_at: blockingRun.updatedAt,
            })],
          }, 409)
        }
        if (dataset.volumeId) {
          await waitForVolumeDetachment(this.env, dataset.volumeId).catch(() => undefined)
        }
        runId = this.createRun(datasetId, ownerEmail, runType, prompt)
        this.acquireDatasetLease(datasetId, runId)
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
        if (!dataset.volumeId || !dataset.volumeName || !dataset.volumeMountPath || !dataset.manifestPath) {
          this.appendRunEvent(runId, 'Dataset is not deployed to a runnable volume yet.', 'error')
          this.sql.exec('UPDATE runs SET status = ?, updated_at = ? WHERE id = ?', 'failed', nowIso(), runId)
          return respondJson({ error: 'Dataset is not deployed and runnable yet' }, 400)
        }
        const remoteAgentConfig = config && typeof config === 'object'
          ? (config as Record<string, unknown>)
          : null
        this.appendRunEvent(runId, 'Preparing remote agent droplet launch.')
        this.sql.exec(
          `UPDATE runs SET status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
          'booting',
          'Preparing remote agent droplet launch.',
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
          volumeName: dataset.volumeName,
          volumeId: dataset.volumeId,
          callbackOrigin: String(body.callbackOrigin ?? ''),
          datasetMountPath: dataset.volumeMountPath,
          manifestPath: dataset.manifestPath,
          sourceSizeBytes: dataset.sourceSizeBytes,
        }
        const sizeClass = inferResearchSizeClass(launchParams)
        let assignedPoolRunner = this.findIdleRunnerPoolEntry(sizeClass)
        if (!assignedPoolRunner) {
          await ensureWarmResearchPool(this.env, sizeClass)
          assignedPoolRunner = this.findIdleRunnerPoolEntry(sizeClass)
        }
        if (assignedPoolRunner) {
          await attachVolumeToDroplet(this.env, dataset.volumeId, assignedPoolRunner.dropletId, dataset.volumeRegion ?? this.env.DIGITALOCEAN_REGION)
          this.assignRunnerPoolEntry(assignedPoolRunner.dropletId, runId)
          this.appendRunEvent(runId, `Assigned warm runner ${assignedPoolRunner.dropletName} (${assignedPoolRunner.sizeClass}).`)
          this.sql.exec(
            `UPDATE runs SET droplet_id = ?, droplet_name = ?, status = ?, updated_at = ? WHERE id = ?`,
            assignedPoolRunner.dropletId,
            assignedPoolRunner.dropletName,
            'booting',
            nowIso(),
            runId,
          )
          void ensureWarmResearchPool(this.env, sizeClass).catch(() => undefined)
        } else {
          const droplet = await launchResearchDroplet(this.env, launchParams)
          this.appendRunEvent(runId, `Remote agent droplet ${droplet.name} launched in ${droplet.region} (${droplet.size}).`)
          this.sql.exec(
            `UPDATE runs SET droplet_id = ?, droplet_name = ?, status = ?, updated_at = ? WHERE id = ?`,
            droplet.id,
            droplet.name,
            'booting',
            nowIso(),
            runId,
          )
          void ensureWarmResearchPool(this.env, sizeClass).catch(() => undefined)
        }
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
        if (isVolumeBusyError(error)) {
          const datasetId = decodeURIComponent(runCreateMatch[1] ?? '')
          const activeRuns = this.getActiveRunsForDataset(datasetId)
          return respondJson({
            error: `Dataset ${datasetId} is busy because its DigitalOcean volume is attached to another droplet.`,
            runId,
            activeRuns: activeRuns.map((run) => ({
              id: run.id,
              datasetId: run.datasetId,
              status: run.status,
              prompt: run.prompt,
              createdAt: run.createdAt,
              updatedAt: run.updatedAt,
            })),
          }, 409)
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
      try {
        const datasetId = decodeURIComponent(publicEnvironmentMatch[1] ?? '')
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
          const download = await createPresignedSpacesUrl(this.env, {
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
              droplet_id: blockingRun.dropletId,
              droplet_name: blockingRun.dropletName,
              created_at: blockingRun.createdAt,
              updated_at: blockingRun.updatedAt,
            })],
          }, 409)
        }
        const datasetBeforeVolume = this.getDataset(datasetId)
        if (datasetBeforeVolume?.volumeId) {
          await waitForVolumeDetachment(this.env, datasetBeforeVolume.volumeId).catch(() => undefined)
        }
        const volume = await ensureDatasetVolume(this.env, datasetId)
        const manifestPath = `${volume.datasetMountPath}/manifest.json`
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
          volume.id,
          volume.name,
          volume.region,
          volume.datasetMountPath,
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
          `Provisioning research environment volume and remote agent (${publicSourceCount} public source hint${publicSourceCount === 1 ? '' : 's'}, ${privateSourceCount} private upload${privateSourceCount === 1 ? '' : 's'}).`,
        )
        this.sql.exec(
          `UPDATE runs SET status = ?, output_preview = ?, updated_at = ? WHERE id = ?`,
          'booting',
          'Provisioning public-data research environment.',
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
          volumeName: volume.name,
          volumeId: volume.id,
          callbackOrigin,
          datasetMountPath: volume.datasetMountPath,
          manifestPath,
          sourceSizeBytes: null,
        }
        const sizeClass = inferResearchSizeClass(launchParams)
        let assignedPoolRunner = this.findIdleRunnerPoolEntry(sizeClass)
        if (!assignedPoolRunner) {
          await ensureWarmResearchPool(this.env, sizeClass)
          assignedPoolRunner = this.findIdleRunnerPoolEntry(sizeClass)
        }
        if (assignedPoolRunner) {
          await attachVolumeToDroplet(this.env, volume.id, assignedPoolRunner.dropletId, volume.region)
          this.assignRunnerPoolEntry(assignedPoolRunner.dropletId, runId)
          this.appendRunEvent(runId, `Assigned warm runner ${assignedPoolRunner.dropletName} (${assignedPoolRunner.sizeClass}).`)
          this.sql.exec(
            `UPDATE runs SET droplet_id = ?, droplet_name = ?, status = ?, updated_at = ? WHERE id = ?`,
            assignedPoolRunner.dropletId,
            assignedPoolRunner.dropletName,
            'booting',
            nowIso(),
            runId,
          )
          void ensureWarmResearchPool(this.env, sizeClass).catch(() => undefined)
        } else {
          const droplet = await launchResearchDroplet(this.env, launchParams)
          this.appendRunEvent(runId, `Remote agent droplet ${droplet.name} launched in ${droplet.region} (${droplet.size}).`)
          this.sql.exec(
            `UPDATE runs SET droplet_id = ?, droplet_name = ?, status = ?, updated_at = ? WHERE id = ?`,
            droplet.id,
            droplet.name,
            'booting',
            nowIso(),
            runId,
          )
          void ensureWarmResearchPool(this.env, sizeClass).catch(() => undefined)
        }
        const row = this.getDataset(datasetId)
        return respondJson({
          dataset: row ? this.datasetRowToJson(row as unknown as Record<string, unknown>) : null,
          environment: {
            datasetId,
            status: 'running',
            volume,
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
      if (run.dropletId) {
        try {
          const dataset = this.getDataset(run.datasetId)
          const pooledRunner = this.getRunnerPoolEntry(run.dropletId)
          if (pooledRunner) {
            if (dataset?.volumeId) {
              await detachVolumeByDroplet(this.env, dataset.volumeId, run.dropletId, dataset.volumeRegion ?? this.env.DIGITALOCEAN_REGION).catch(() => undefined)
              await waitForVolumeDetachment(this.env, dataset.volumeId).catch(() => undefined)
            }
            this.clearRunnerPoolEntryAssignment(run.dropletId)
            this.appendRunEvent(runId, `Cancelled run and released pooled runner ${pooledRunner.dropletName}.`, 'warning')
          } else {
            await deleteDroplet(this.env, run.dropletId)
            if (dataset?.volumeId) {
              await waitForVolumeDetachment(this.env, dataset.volumeId).catch(() => undefined)
            }
            this.appendRunEvent(runId, `Cancelled run and deleted droplet ${run.dropletName ?? run.dropletId}.`, 'warning')
          }
        } catch (error) {
          this.appendRunEvent(
            runId,
            `Cancel requested but droplet delete failed: ${error instanceof Error ? error.message : String(error)}`,
            'error',
          )
        }
      } else {
        this.appendRunEvent(runId, 'Cancelled run before droplet launch.', 'warning')
      }
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
      const artifacts = this.listRunArtifacts(runId)
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
      return respondJson({
        run,
        debugView: {
          remoteSessionId,
          hasRemoteLogs,
          defaultView: hasRemoteLogs ? 'remote' : 'cli',
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

    if (pathname === '/internal/runner-pool/heartbeat' && request.method === 'POST') {
      const body = await request.json() as Record<string, unknown>
      const dropletId = String(body.dropletId ?? '')
      const dropletName = String(body.dropletName ?? '')
      const sizeClass = String(body.sizeClass ?? '')
      const region = body.region ? String(body.region) : null
      if (!dropletId || !dropletName || !sizeClass) {
        return respondJson({ error: 'Missing dropletId, dropletName, or sizeClass' }, 400)
      }
      this.registerRunnerPoolHeartbeat(dropletId, dropletName, sizeClass, region)
      return respondJson({ ok: true })
    }

    const poolAssignmentMatch = pathname.match(/^\/internal\/runner-pool\/droplets\/([^/]+)\/assignment$/u)
    if (poolAssignmentMatch && request.method === 'GET') {
      const dropletId = decodeURIComponent(poolAssignmentMatch[1] ?? '')
      const runner = this.getRunnerPoolEntry(dropletId)
      if (!runner) {
        return respondJson({ assignment: null })
      }
      this.registerRunnerPoolHeartbeat(dropletId, runner.dropletName, runner.sizeClass, runner.region)
      if (!runner.assignedRunId) {
        return respondJson({ assignment: null })
      }
      const runRow = this.rows('SELECT * FROM runs WHERE id = ? LIMIT 1', runner.assignedRunId)[0]
      if (!runRow) {
        this.clearRunnerPoolEntryAssignment(dropletId)
        return respondJson({ assignment: null })
      }
      const run = this.parseRunRow(runRow)
      if (isTerminalStatus(run.status)) {
        this.clearRunnerPoolEntryAssignment(dropletId)
        return respondJson({ assignment: null })
      }
      const dataset = this.getDataset(run.datasetId)
      if (!dataset?.volumeName || !dataset.volumeMountPath || !dataset.manifestPath) {
        return respondJson({ assignment: null })
      }
      const metadata = this.getRunMetadata(run.id)
      const config = metadata?.config ?? {}
      const artifacts = metadata?.artifactSpec ?? []
      const remoteAgentSessionId = typeof (config as Record<string, unknown>).remoteAgentSessionId === 'string'
        ? String((config as Record<string, unknown>).remoteAgentSessionId)
        : ''
      return respondJson({
        assignment: {
          runId: run.id,
          runType: run.type,
          datasetId: run.datasetId,
          prompt: run.prompt ?? '',
          promptB64: encodeBase64(run.prompt ?? ''),
          configB64: encodeBase64(JSON.stringify(config ?? {})),
          artifactSpecB64: encodeBase64(JSON.stringify(artifacts ?? [])),
          remoteAgentSessionId,
          volumeName: dataset.volumeName,
          datasetMountPath: dataset.volumeMountPath,
          manifestPath: dataset.manifestPath,
        },
      })
    }

    const poolCompleteMatch = pathname.match(/^\/internal\/runner-pool\/droplets\/([^/]+)\/complete$/u)
    if (poolCompleteMatch && request.method === 'POST') {
      const dropletId = decodeURIComponent(poolCompleteMatch[1] ?? '')
      const body = await request.json() as Record<string, unknown>
      const runId = String(body.runId ?? '')
      const runner = this.getRunnerPoolEntry(dropletId)
      if (runner && (!runId || runner.assignedRunId === runId)) {
        this.clearRunnerPoolEntryAssignment(dropletId)
      }
      return respondJson({ ok: true })
    }

    const internalEventMatch = pathname.match(/^\/internal\/runs\/([^/]+)\/events$/u)
    if (internalEventMatch && request.method === 'POST') {
      const runId = decodeURIComponent(internalEventMatch[1] ?? '')
      const level = request.headers.get('X-Run-Level') ?? 'info'
      const message = await request.text()
      this.appendRunEvent(runId, message, level)
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
      this.createRunArtifact(
        runId,
        String(body.type ?? 'artifact'),
        String(body.title ?? 'artifact'),
        body.content,
        body.url ? String(body.url) : null,
      )
      return respondJson({ ok: true })
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
      if ((status === 'ready' || status === 'failed') && run.dropletId) {
        try {
          const dataset = this.getDataset(run.datasetId)
          const pooledRunner = this.getRunnerPoolEntry(run.dropletId)
          if (pooledRunner) {
            if (dataset?.volumeId) {
              await detachVolumeByDroplet(this.env, dataset.volumeId, run.dropletId, dataset.volumeRegion ?? this.env.DIGITALOCEAN_REGION).catch(() => undefined)
              await waitForVolumeDetachment(this.env, dataset.volumeId).catch(() => undefined)
            }
            this.clearRunnerPoolEntryAssignment(run.dropletId)
          } else {
            await deleteDroplet(this.env, run.dropletId)
            if (dataset?.volumeId) {
              await waitForVolumeDetachment(this.env, dataset.volumeId).catch(() => undefined)
            }
          }
        } catch {
          // Best-effort cleanup; keep terminal run state even if droplet deletion fails.
        }
      }
      if (isTerminalStatus(status)) {
        this.releaseDatasetLease(run.datasetId, runId)
      }
      return respondJson({ ok: true })
    }

    return respondJson({ error: 'Not found' }, 404)
  }
}
