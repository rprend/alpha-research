import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { AssistantRuntimeProvider, useExternalStoreRuntime, type ThreadMessage } from '@assistant-ui/react'
import {
  Bot,
  Braces,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  GripVertical,
  History,
  LoaderCircle,
  LogOut,
  MoreHorizontal,
  Table2,
  TerminalSquare,
  Zap,
  X,
} from 'lucide-react'

import { Thread } from '@/components/assistant-ui/thread'
import {
  getHarnessDataset,
  getHarnessRunResults,
  getHarnessSession,
  harnessDatasets,
  harnessRuns,
  harnessSession,
  harnessSessions,
  isHarnessMode,
} from '@/harness-data'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { deriveRunProgress } from '@/user-progress'

declare global {
  interface Window {
    Cal?: ((...args: unknown[]) => void) & {
      loaded?: boolean
      ns?: Record<string, (...args: unknown[]) => void>
      q?: unknown[]
    }
  }
}

type SessionResponse = {
  authenticated: boolean
  configured: boolean
  user: { email: string } | null
  error?: string
}

type DatasetRecord = {
  id: string
  name: string
  sourceType: string
  sourceFilename: string | null
  sourceSizeBytes?: number | null
  mode: string | null
  description: string | null
  inventorySummary?: string | null
  inventoryUseCase?: string | null
  inventoryReadinessNote?: string | null
  manifestPath?: string | null
  deploymentStatus: string
  status: string
  volume?: { id: string; name: string; region: string | null; mountPath: string | null } | null
  ingestConfig?: unknown
  profile?: {
    schema?: unknown
    sampleRows?: unknown
    notes?: string | null
    briefingMarkdown?: string | null
    profile?: unknown
    briefingArtifactId?: string | null
    profileArtifactId?: string | null
    describedRunId?: string | null
    describedAt?: string | null
    updatedAt?: string
  } | null
  createdAt: string
  updatedAt: string
}

type RunRecord = {
  id: string
  datasetId: string
  type: string
  status: string
  prompt: string | null
  outputPreview: string | null
  artifactCount?: number
  sessionCount?: number
  createdAt: string
  updatedAt: string
}

type RunEventRecord = {
  id: string
  runId: string
  message: string
  level: string
  createdAt: string
}

type RunArtifactRecord = {
  id: string
  runId: string
  type: string
  title: string
  url?: string
  content?: Record<string, unknown>
  createdAt: string
}

type FileTreeNode = {
  name: string
  path: string
  children: Map<string, FileTreeNode>
  artifact?: RunArtifactRecord
}

type RunResultsResponse = {
  run: RunRecord
  metadata: {
    config: unknown
    artifactSpec: unknown
  } | null
  artifacts: RunArtifactRecord[]
  events: RunEventRecord[]
  sessions?: StoredAssistantSession[]
}

type SessionEntryRole = 'user' | 'assistant' | 'system' | 'tool'
type DashboardView = 'assistant' | 'datasets' | 'runs' | 'terminal-sessions'

type StoredAssistantSessionEntry = {
  id: string
  sessionId: string
  role: string
  kind: string
  title: string | null
  content: string
  metadata?: unknown
  createdAt: string
}

type StoredAssistantSession = {
  id: string
  kind: string
  title: string | null
  status: string
  datasetId?: string | null
  runId?: string | null
  createdAt: string
  updatedAt: string
  entries?: StoredAssistantSessionEntry[]
}

type SessionEntry = {
  id: string
  role: SessionEntryRole
  title?: string
  body: string
  metadata?: unknown
  createdAt: string
}

type AssistantTurnResponse = {
  sessionId: string | null
  previousResponseId: string | null
  reply: string
}

const ROOT_HOST = 'alpharesearch.nyc'
const DASHBOARD_HOST = 'dashboard.alpharesearch.nyc'

const locationUrl = new URL(window.location.href)
const isDashboardView =
  window.location.hostname === DASHBOARD_HOST ||
  locationUrl.searchParams.get('view') === 'dashboard' ||
  locationUrl.searchParams.get('harness') === '1'
const rootOrigin =
  window.location.hostname === 'localhost'
    ? window.location.origin
    : `https://${ROOT_HOST}`
const dashboardOrigin =
  window.location.hostname === 'localhost'
    ? window.location.origin
    : `https://${DASHBOARD_HOST}`

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength - 1).trimEnd()}…`
}

function compactInlineText(value: string, maxLength: number) {
  return truncate(value.replace(/\s+/g, ' ').trim(), maxLength)
}

function relativeTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const diffMs = date.getTime() - Date.now()
  const absSeconds = Math.round(Math.abs(diffMs) / 1000)
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  if (absSeconds < 60) {
    return formatter.format(Math.round(diffMs / 1000), 'second')
  }

  const absMinutes = Math.round(absSeconds / 60)
  if (absMinutes < 60) {
    return formatter.format(Math.round(diffMs / 60000), 'minute')
  }

  const absHours = Math.round(absMinutes / 60)
  if (absHours < 24) {
    return formatter.format(Math.round(diffMs / 3600000), 'hour')
  }

  return formatter.format(Math.round(diffMs / 86400000), 'day')
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatStatus(value: string | null | undefined) {
  if (!value) {
    return 'Unknown'
  }
  const normalized = value.toLowerCase()
  if (normalized === 'ready') {
    return 'Completed Successfully'
  }
  if (normalized === 'worker_unreachable') {
    return 'Worker Unreachable'
  }
  if (normalized === 'uploading') {
    return 'Source Uploaded / Processing'
  }
  return value
    .replaceAll(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getRunStatusTone(status: string | null | undefined) {
  const normalized = status?.toLowerCase() ?? ''
  if (normalized === 'ready') {
    return 'success'
  }
  if (normalized === 'running') {
    return 'active'
  }
  if (normalized === 'worker_unreachable' || normalized === 'failed' || normalized === 'error') {
    return 'warning'
  }
  return 'neutral'
}

function getRunPriorityMeta(run: RunRecord) {
  const normalized = run.status.toLowerCase()
  if (normalized === 'worker_unreachable') {
    return {
      rank: 0,
      label: 'Needs attention',
      summary: 'Worker stopped responding before the run finished.',
      detail: 'Open the session to inspect logs, partial output, or retry context.',
      actionLabel: 'Open recovery path',
    }
  }
  if (normalized === 'running') {
    return {
      rank: 1,
      label: 'Watch',
      summary: 'Still running.',
      detail: `Last activity ${relativeTime(run.updatedAt)}.`,
      actionLabel: 'Watch live run',
    }
  }
  if (normalized === 'ready') {
    const hasArtifacts = (run.artifactCount ?? 0) > 0
    return {
      rank: 2,
      label: hasArtifacts ? 'Ready to review' : 'Complete',
      summary: hasArtifacts ? 'Completed with outputs ready.' : 'Completed successfully.',
      detail: hasArtifacts
        ? `${run.artifactCount} artifact${run.artifactCount === 1 ? '' : 's'} available to inspect.`
        : 'Open the session for transcript and result details.',
      actionLabel: hasArtifacts ? 'Open outputs' : 'Open session',
    }
  }
  return {
    rank: 3,
    label: 'Check status',
    summary: formatStatus(run.status),
    detail: 'Open the session for more detail.',
    actionLabel: 'Open session',
  }
}

function getRunOutputSignal(run: RunRecord) {
  const artifactCount = run.artifactCount ?? 0
  if (artifactCount > 0) {
    return `${artifactCount} artifact${artifactCount === 1 ? '' : 's'} ready`
  }
  if (run.status.toLowerCase() === 'ready') {
    return 'No artifacts recorded yet'
  }
  if ((run.sessionCount ?? 0) > 0) {
    return `${run.sessionCount} session${run.sessionCount === 1 ? '' : 's'} attached`
  }
  return 'No outputs yet'
}

function getRunInventorySummary(runs: RunRecord[]) {
  const counts = {
    attention: 0,
    active: 0,
    complete: 0,
    outputs: 0,
  }
  for (const run of runs) {
    const normalized = run.status.toLowerCase()
    if (normalized === 'worker_unreachable' || normalized === 'failed' || normalized === 'error') {
      counts.attention += 1
    } else if (normalized === 'running') {
      counts.active += 1
    } else if (normalized === 'ready') {
      counts.complete += 1
    }
    if ((run.artifactCount ?? 0) > 0) {
      counts.outputs += 1
    }
  }
  return counts
}

function readableSessionTitle(value: string | null | undefined) {
  const normalized = (value ?? '')
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/^["'#\s]+|["'\s]+$/g, '')
    .replace(/^[-:;,.|/\\\s]+/g, '')
    .replace(/^RESEARCH CLI session$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || 'Untitled chat'
}

function readableSessionKind(kind: string | null | undefined) {
  if (!kind) return 'Chat'
  if (kind === 'cli_orchestration') return 'Chat'
  if (kind === 'remote_codex') return 'Remote session'
  return formatStatus(kind)
}

function sessionStatusDescription(status: string | null | undefined) {
  const normalized = status?.toLowerCase() ?? ''
  if (normalized === 'ready') return 'Transcript complete'
  if (normalized === 'running' || normalized === 'active' || normalized === 'booting') return 'Syncing transcript'
  if (normalized === 'failed' || normalized === 'error' || normalized === 'worker_unreachable') return 'Needs debugging'
  return formatStatus(status)
}

function sessionSummaryLine(
  session: StoredAssistantSession,
  dataset: DatasetRecord | undefined,
  run: RunRecord | undefined,
) {
  const kind = readableSessionKind(session.kind)
  const target = dataset?.name ?? (run ? formatStatus(run.type) : null)
  const updated = relativeTime(session.updatedAt)
  return [kind, target ? `about ${target}` : null, updated].filter(Boolean).join(' · ')
}

function formatBytes(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return 'Unknown'
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let amount = value
  let unitIndex = 0
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }
  return `${amount >= 10 || unitIndex === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unitIndex]}`
}

function isPublicDataset(dataset: DatasetRecord) {
  const mode = dataset.mode?.toLowerCase()
  if (mode === 'public') return true
  if (mode === 'private') return false
  const text = `${dataset.name} ${dataset.sourceType} ${dataset.description ?? ''}`.toLowerCase()
  return text.includes('public') || ['public_data', 'mixed_data', 'research_environment', 'public_corpus', 'public_api'].includes(dataset.sourceType)
}

function datasetInventoryStatus(dataset: DatasetRecord) {
  const deploymentStatus = dataset.deploymentStatus.toLowerCase()
  const status = dataset.status.toLowerCase()

  if (deploymentStatus === 'ready' && status === 'ready') {
    return {
      label: 'Ready for research',
      detail: dataset.inventoryReadinessNote ?? 'Open now for profiling, documentation, or analysis.',
    }
  }

  if (deploymentStatus === 'processing' || status === 'running' || status === 'uploading') {
    return {
      label: 'Still building',
      detail: dataset.inventoryReadinessNote ?? 'Ingestion is still running, so schema and records may change.',
    }
  }

  if (deploymentStatus === 'failed' || status === 'failed' || status === 'worker_unreachable') {
    return {
      label: 'Needs attention',
      detail: dataset.inventoryReadinessNote ?? 'This dataset needs a retry before it is safe to use.',
    }
  }

  return {
    label: 'Checking readiness',
    detail: dataset.inventoryReadinessNote ?? 'Alpha Research is still verifying whether this dataset is ready.',
  }
}

function datasetInventoryDescription(dataset: DatasetRecord) {
  const description = dataset.inventorySummary?.trim() || dataset.description?.trim()
  if (description) return description
  if (dataset.sourceFilename?.trim()) return `Uploaded from ${dataset.sourceFilename.trim()}.`
  return `A ${formatStatus(dataset.sourceType)} dataset in Alpha Research.`
}

function datasetInventoryUseCase(dataset: DatasetRecord) {
  const explicit = dataset.inventoryUseCase?.trim()
  if (explicit) return explicit
  const profileSummary = profileText(dataset.profile?.profile, 'summary')
  if (profileSummary) return `Best for: ${profileSummary}`
  return null
}

function formatCompactTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function summarizeActiveRunEvent(message: string, run: RunRecord) {
  const trimmed = message.trim()
  const heartbeatMatch = trimmed.match(/^Remote agent heartbeat:\s*(.+)$/iu)
  if (heartbeatMatch) {
    const detail = heartbeatMatch[1]?.trim().replace(/[.]+$/u, '') ?? ''
    if (/fetching public data sources/iu.test(detail) && run.type === 'public_environment') {
      return 'The runner is fetching public data sources and assembling the housing and labor environment.'
    }
    return detail
      ? `The runner is actively working: ${detail}.`
      : 'The runner is actively working on the current step.'
  }
  if (/^Assigned warm runner\b/iu.test(trimmed)) {
    return 'A research runner picked up this job and started working.'
  }
  return trimmed
}

function buildRunningRunSummary(
  run: RunRecord,
  payload: RunResultsResponse | null,
  dataset: DatasetRecord | undefined,
) {
  const progressEntries = deriveRunProgress(payload?.events ?? [])
  const lastProgress = progressEntries.at(-1) ?? null
  const lastEvent = payload?.events.at(-1) ?? null
  const previousEvent = payload?.events.length ? payload.events.at(-2) ?? null : null
  const lastActivityAt = lastProgress?.createdAt ?? lastEvent?.createdAt ?? run.updatedAt
  const currentActivity = lastProgress?.text
    ?? (lastEvent ? summarizeActiveRunEvent(lastEvent.message, run) : run.outputPreview?.trim())
    ?? 'Alpha Research is still working on this run.'
  const previousActivity = previousEvent ? summarizeActiveRunEvent(previousEvent.message, run) : null

  return {
    title: `${dataset?.name ?? 'This run'} is still running`,
    currentActivity,
    lastActivityAt,
    previousActivity,
    statusDetail: `Last meaningful update ${relativeTime(lastActivityAt)}.`,
  }
}

function codeBlock(label: string, value: unknown) {
  return `### ${label}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function profileArrayCount(profile: unknown, key: string) {
  if (!isRecord(profile)) return null
  const value = profile[key]
  return Array.isArray(value) ? value.length : null
}

function profileText(profile: unknown, key: string) {
  if (!isRecord(profile)) return null
  const value = profile[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function profileArray(profile: unknown, key: string) {
  if (!isRecord(profile)) return []
  const value = profile[key]
  return Array.isArray(value) ? value : []
}

function profileRecord(profile: unknown, key: string) {
  if (!isRecord(profile)) return null
  const value = profile[key]
  return isRecord(value) ? value : null
}

function formatList(value: string[]) {
  return value.filter(Boolean).join(', ')
}

function renderBriefingMarkdown(markdown: string) {
  const nodes: ReactNode[] = []
  let paragraph: string[] = []
  let bullets: string[] = []

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    nodes.push(
      <p key={`p-${nodes.length}`} className="my-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
        {paragraph.join('\n')}
      </p>,
    )
    paragraph = []
  }
  const flushBullets = () => {
    if (bullets.length === 0) return
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="my-3 list-disc space-y-1 pl-5 text-sm leading-7 text-muted-foreground">
        {bullets.map((item, index) => <li key={index}>{item}</li>)}
      </ul>,
    )
    bullets = []
  }

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushParagraph()
      flushBullets()
      continue
    }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/u)
    if (heading) {
      flushParagraph()
      flushBullets()
      const level = heading[1]?.length ?? 2
      const text = heading[2] ?? ''
      nodes.push(
        level === 1
          ? <h2 key={`h-${nodes.length}`} className="mt-6 text-2xl font-semibold first:mt-0">{text}</h2>
          : <h3 key={`h-${nodes.length}`} className="mt-5 text-lg font-semibold first:mt-0">{text}</h3>,
      )
      continue
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/u)
    if (bullet) {
      flushParagraph()
      bullets.push(bullet[1] ?? '')
      continue
    }
    flushBullets()
    paragraph.push(trimmed)
  }
  flushParagraph()
  flushBullets()
  return nodes
}

function renderPreviewMarkdown(markdown: string) {
  const nodes: ReactNode[] = []
  let paragraph: string[] = []
  let bullets: string[] = []

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    nodes.push(
      <p key={`p-${nodes.length}`} className="my-4 whitespace-pre-wrap text-[1.18rem] leading-[1.7] text-neutral-600">
        {paragraph.join('\n')}
      </p>,
    )
    paragraph = []
  }
  const flushBullets = () => {
    if (bullets.length === 0) return
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="my-4 list-disc space-y-3 pl-7 text-[1.18rem] leading-[1.7] text-neutral-600">
        {bullets.map((item, index) => <li key={index}>{item}</li>)}
      </ul>,
    )
    bullets = []
  }

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushParagraph()
      flushBullets()
      continue
    }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/u)
    if (heading) {
      flushParagraph()
      flushBullets()
      const level = heading[1]?.length ?? 2
      const text = heading[2] ?? ''
      nodes.push(
        level === 1
          ? <h1 key={`h-${nodes.length}`} className="mt-9 text-4xl font-semibold leading-tight tracking-normal first:mt-0">{text}</h1>
          : <h2 key={`h-${nodes.length}`} className="mt-8 text-2xl font-semibold leading-tight tracking-normal first:mt-0">{text}</h2>,
      )
      continue
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/u)
    if (bullet) {
      flushParagraph()
      bullets.push(bullet[1] ?? '')
      continue
    }
    flushBullets()
    paragraph.push(trimmed)
  }
  flushParagraph()
  flushBullets()
  return nodes
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function summarizeDatasetRecord(value: unknown) {
  if (!isRecord(value)) return null
  const id = typeof value.id === 'string' ? value.id : null
  const name = typeof value.name === 'string' ? value.name : null
  const status = typeof value.status === 'string' ? formatStatus(value.status) : null
  const deploymentStatus =
    typeof value.deploymentStatus === 'string' ? formatStatus(value.deploymentStatus) : null
  if (!id && !name) return null
  return [
    name ? `Dataset: **${name}**` : id ? `Dataset: \`${id}\`` : null,
    deploymentStatus ? `Environment: ${deploymentStatus}` : null,
    status ? `Source state: ${status}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function humanizeToolName(name: string) {
  const labels: Record<string, string> = {
    aggregate_remote_dataset: 'Started remote aggregation',
    query_remote_dataset: 'Started remote query',
    get_run_results: 'Checked current run status',
    list_run_artifacts: 'Checked produced artifacts',
    inspect_remote_dataset: 'Inspected dataset',
    list_remote_datasets: 'Listed datasets',
    start_remote_agent_run: 'Started remote Codex run',
    continue_remote_agent_run: 'Continued remote Codex run',
    start_remote_run: 'Started remote run',
    deploy_remote_dataset: 'Started dataset deploy',
    fetch_public_data: 'Planned public-data fetch',
    run_remote_transformation: 'Planned transformation',
    run_remote_labeling: 'Planned labeling run',
    compare_remote_datasets: 'Compared datasets',
  }

  if (labels[name]) return labels[name]
  return `Called \`${name}\``
}

function getRequestedArtifacts(payload: RunResultsResponse | null) {
  return Array.isArray(payload?.metadata?.artifactSpec)
    ? (payload?.metadata?.artifactSpec as Array<Record<string, unknown>>)
    : []
}

function isProducedArtifact(
  artifact: RunArtifactRecord,
  _requestedArtifacts: Array<Record<string, unknown>>,
) {
  if (artifact.type === 'remote_agent_summary') {
    return false
  }
  if (artifact.url || artifact.type === 'remote_agent_session') {
    return true
  }
  if (typeof artifact.content?.path === 'string' && artifact.content.path.trim().length > 0) {
    return true
  }
  return Boolean(artifact.content)
}

function getProducedArtifacts(payload: RunResultsResponse | null) {
  const requestedArtifacts = getRequestedArtifacts(payload)
  return (payload?.artifacts ?? []).filter((artifact) => isProducedArtifact(artifact, requestedArtifacts))
}

function artifactPath(artifact: RunArtifactRecord) {
  const path = artifact.content?.path
  if (typeof path === 'string' && path.trim()) {
    return path.replace(/^.*\/artifacts\//u, '').replace(/^\/+/u, '')
  }
  return artifact.title
}

function artifactText(artifact: RunArtifactRecord) {
  const text = artifact.content?.text
  if (typeof text === 'string') return text
  const preview = artifact.content?.preview
  if (typeof preview === 'string') return preview
  if (typeof artifact.content === 'string') return artifact.content
  return JSON.stringify(artifact.content ?? {}, null, 2)
}

function artifactJsonPreview(artifact: RunArtifactRecord) {
  if (typeof artifact.content === 'string') return artifact.content
  if (artifact.content?.text && typeof artifact.content.text === 'string') {
    return JSON.stringify(tryParseJson(artifact.content.text) ?? artifact.content.text, null, 2)
  }
  if (artifact.content && typeof artifact.content === 'object') {
    const { path: _path, ...rest } = artifact.content
    return JSON.stringify(rest, null, 2)
  }
  return JSON.stringify(artifact.content ?? {}, null, 2)
}

function artifactLanguage(path: string, artifact: RunArtifactRecord) {
  const extension = path.split('.').pop()?.toLowerCase()
  if (artifact.type === 'structured_result' || extension === 'json') return 'json'
  if (extension === 'md' || extension === 'markdown') return 'markdown'
  if (extension === 'py') return 'python'
  if (extension === 'ts' || extension === 'tsx') return 'typescript'
  if (extension === 'js' || extension === 'jsx') return 'javascript'
  if (extension === 'sql') return 'sql'
  if (extension === 'csv') return 'csv'
  if (extension === 'sh') return 'bash'
  if (extension === 'html') return 'html'
  if (extension === 'css') return 'css'
  return 'text'
}

function isMarkdownArtifact(artifact: RunArtifactRecord) {
  const path = artifactPath(artifact).toLowerCase()
  if (artifact.type === 'markdown') return true
  return path.endsWith('.md') || path.endsWith('.markdown')
}

function getDatasetBriefingArtifact(artifacts: RunArtifactRecord[]) {
  return artifacts.find((artifact) => {
    if (!isMarkdownArtifact(artifact)) return false
    const title = artifact.title.toLowerCase()
    const path = artifactPath(artifact).toLowerCase()
    const text = artifactText(artifact)
    return title.includes('briefing') || path.includes('summary.md') || text.includes('# Dataset Briefing')
  }) ?? null
}

function getDatasetProfileArtifact(artifacts: RunArtifactRecord[]) {
  return artifacts.find((artifact) => {
    const title = artifact.title.toLowerCase()
    const path = artifactPath(artifact).toLowerCase()
    return artifact.type === 'json' || artifact.type === 'structured_result' || title.includes('profile') || path.endsWith('result.json')
  }) ?? null
}

function artifactRoleMeta(
  artifact: RunArtifactRecord,
  primaryArtifactId: string | null,
  profileArtifactId: string | null,
) {
  if (artifact.id === primaryArtifactId) {
    return {
      label: 'Answer',
      description: 'User-facing result to read first.',
    }
  }
  if (artifact.id === profileArtifactId) {
    return {
      label: 'Structured',
      description: 'Machine-readable companion for downstream tooling.',
    }
  }
  return {
    label: 'Support',
    description: 'Supporting file captured during the run.',
  }
}

function isTerminalSuccessfulRun(run: RunRecord) {
  return ['ready', 'completed'].includes(run.status.toLowerCase())
}

function fileIconFor(path: string, artifact?: RunArtifactRecord) {
  const language = artifact ? artifactLanguage(path, artifact) : path.split('.').pop()?.toLowerCase()
  if (language === 'markdown') {
    return (
      <span
        aria-hidden="true"
        className="flex w-7 shrink-0 items-center justify-center font-mono text-[0.95rem] font-bold leading-none text-emerald-600"
      >
        M
      </span>
    )
  }
  if (language === 'json') return <Braces className="size-5 w-7 shrink-0 text-orange-600" />
  if (language === 'csv') return <Table2 className="size-5 w-7 shrink-0 text-amber-600" />
  if (language === 'typescript' || language === 'javascript') return <Zap className="size-5 w-7 shrink-0 text-violet-600" />
  if (language === 'python' || language === 'sql' || language === 'bash') {
    return <TerminalSquare className="size-5 w-7 shrink-0 text-blue-600" />
  }
  if (language === 'html' || language === 'css') {
    return (
      <span
        aria-hidden="true"
        className="flex w-7 shrink-0 items-center justify-center font-mono text-[1rem] font-bold leading-none text-orange-500"
      >
        #
      </span>
    )
  }
  return <FileText className="size-5 w-7 shrink-0 text-muted-foreground" />
}

function buildArtifactFileTree(artifacts: RunArtifactRecord[]) {
  const root: FileTreeNode = { name: 'All files', path: '', children: new Map() }
  for (const artifact of artifacts) {
    const parts = artifactPath(artifact).split('/').filter(Boolean)
    if (parts.length === 0) continue
    let cursor = root
    parts.forEach((part, index) => {
      const path = [...parts.slice(0, index), part].join('/')
      const existing = cursor.children.get(part)
      const next: FileTreeNode = existing ?? { name: part, path, children: new Map() }
      if (index === parts.length - 1) {
        next.artifact = artifact
      }
      cursor.children.set(part, next)
      cursor = next
    })
  }
  return root
}

function summarizeRunRecord(value: unknown) {
  if (!isRecord(value)) return null
  const id = typeof value.id === 'string' ? value.id : null
  const datasetId = typeof value.datasetId === 'string' ? value.datasetId : null
  const type = typeof value.type === 'string' ? formatStatus(value.type) : null
  const status = typeof value.status === 'string' ? formatStatus(value.status) : null
  const prompt = typeof value.prompt === 'string' ? value.prompt : null
  if (!id) return null
  return [
    `Run: \`${id}\``,
    datasetId ? `Dataset: \`${datasetId}\`` : null,
    type ? `Type: ${type}` : null,
    status ? `Status: ${status}` : null,
    prompt ? `Prompt: ${compactInlineText(prompt, 320)}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function summarizeRunData(value: unknown) {
  if (!isRecord(value)) return null

  const sections: string[] = []
  const runSummary = summarizeRunRecord(value.run)
  if (runSummary) sections.push(runSummary)

  const events = Array.isArray(value.events) ? value.events : []
  const recentEvents = events
    .slice(-3)
    .map((event) =>
      isRecord(event) && typeof event.message === 'string' ? truncate(event.message, 220) : null,
    )
    .filter((event): event is string => Boolean(event))
  if (recentEvents.length > 0) {
    sections.push(`Recent activity:\n${recentEvents.map((event) => `- ${event}`).join('\n')}`)
  }

  const metadata = isRecord(value.metadata) ? value.metadata : null
  const requestedArtifacts = Array.isArray(metadata?.artifactSpec) ? metadata?.artifactSpec as Array<Record<string, unknown>> : []
  if (requestedArtifacts.length > 0) {
    const titles = requestedArtifacts
      .slice(0, 4)
      .map((artifact) =>
        typeof artifact.title === 'string' ? artifact.title : typeof artifact.type === 'string' ? artifact.type : null,
      )
      .filter((title): title is string => Boolean(title))
    if (titles.length > 0) {
      sections.push(`Requested artifacts: ${titles.join(', ')}`)
    }
  }

  const artifacts = Array.isArray(value.artifacts) ? value.artifacts : []
  const producedArtifacts = artifacts.filter((artifact) => {
    if (!isRecord(artifact)) return false
    const type = typeof artifact.type === 'string' ? artifact.type : null
    const title = typeof artifact.title === 'string' ? artifact.title : null
    const url = typeof artifact.url === 'string' ? artifact.url : null
    if (url || type === 'remote_agent_session') return true
    return !requestedArtifacts.some((requested) => {
      const requestedType = typeof requested.type === 'string' ? requested.type : null
      const requestedTitle = typeof requested.title === 'string' ? requested.title : null
      return requestedType === type && requestedTitle === title
    })
  })
  if (producedArtifacts.length > 0) {
    const titles = producedArtifacts
      .slice(0, 4)
      .map((artifact) =>
        isRecord(artifact) && typeof artifact.title === 'string' ? artifact.title : null,
      )
      .filter((title): title is string => Boolean(title))
    if (titles.length > 0) {
      sections.push(`Produced artifacts: ${titles.join(', ')}`)
    }
  }

  return sections.length > 0 ? sections.join('\n\n') : null
}

function summarizeFunctionCallOutput(item: Record<string, unknown>) {
  const rawOutput = typeof item.output === 'string' ? item.output : ''
  const parsedOutput = rawOutput ? tryParseJson(rawOutput) : null
  if (isRecord(parsedOutput)) {
    const summary =
      typeof parsedOutput.summary === 'string'
        ? compactInlineText(parsedOutput.summary, 220)
        : null
    const data = isRecord(parsedOutput.data) ? parsedOutput.data : null
    const runSummary = data ? summarizeRunData(data) : null
    const datasetSummary = data ? summarizeDatasetRecord(data.dataset) : null
    const lines = [summary, runSummary, datasetSummary].filter(Boolean) as string[]
    if (lines.length > 0) {
      return lines.join('\n\n')
    }
  }

  if (rawOutput) {
    return compactInlineText(rawOutput, 320)
  }

  return null
}

function summarizeRequestArray(items: unknown[]) {
  const parts = items
    .map((item) => {
      if (!isRecord(item)) return null
      if (item.type !== 'function_call_output') return null
      return summarizeFunctionCallOutput(item)
    })
    .filter((value): value is string => Boolean(value))

  if (parts.length > 0) {
    return parts.join('\n\n')
  }

  return codeBlock('Request payload', items)
}

function summarizeFunctionCall(item: Record<string, unknown>) {
  const name = typeof item.name === 'string' ? item.name : 'tool'
  const parsedArgs =
    typeof item.arguments === 'string' ? tryParseJson(item.arguments) : item.arguments

  if (isRecord(parsedArgs)) {
    const datasetId = typeof parsedArgs.datasetId === 'string' ? parsedArgs.datasetId : null
    const runId = typeof parsedArgs.runId === 'string' ? parsedArgs.runId : null
    const prompt = typeof parsedArgs.prompt === 'string' ? parsedArgs.prompt : null
    const sourceDescription =
      typeof parsedArgs.sourceDescription === 'string' ? parsedArgs.sourceDescription : null
    const type = typeof parsedArgs.type === 'string' ? formatStatus(parsedArgs.type) : null

    const lines = [
      humanizeToolName(name),
      datasetId ? `Dataset: \`${datasetId}\`` : null,
      runId ? `Run: \`${runId}\`` : null,
      type ? `Run type: ${type}` : null,
      sourceDescription ? `Source: ${compactInlineText(sourceDescription, 220)}` : null,
      prompt ? `Prompt: ${compactInlineText(prompt, 320)}` : null,
    ].filter(Boolean)

    return lines.join('\n')
  }

  return humanizeToolName(name)
}

function summarizeResponseObject(value: Record<string, unknown>) {
  const output = Array.isArray(value.output) ? value.output : []
  const reasoningCount = output.filter((item) => isRecord(item) && item.type === 'reasoning').length
  const calls = output
    .filter((item) => isRecord(item) && item.type === 'function_call')
    .map((item) => summarizeFunctionCall(item as Record<string, unknown>))
    .filter(Boolean)

  if (calls.length > 0) {
    if (calls.length === 1) {
      return calls[0]
    }

    return [
      reasoningCount > 0 ? `Next step${reasoningCount > 1 ? 's' : ''}:` : 'Planned actions:',
      calls.join('\n\n'),
    ].join('\n\n')
  }

  const outputText = typeof value.output_text === 'string' ? value.output_text.trim() : ''
  if (outputText) {
    return outputText
  }

  return codeBlock('Response payload', value)
}

function formatSessionBody(entry: SessionEntry) {
  const parsed = tryParseJson(entry.body)
  if (Array.isArray(parsed)) {
    return summarizeRequestArray(parsed)
  }
  if (isRecord(parsed) && parsed.object === 'response') {
    return summarizeResponseObject(parsed)
  }
  if (parsed !== null) {
    return codeBlock(entry.title ?? 'Payload', parsed)
  }
  if (entry.title === 'Run started') {
    const runId = entry.body.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu)?.[0]
    if (runId) {
      return `### ${entry.title}\n\n${entry.body}\n\n[Open run](${dashboardOrigin}?view=runs&runId=${encodeURIComponent(runId)})`
    }
  }
  if (entry.title) {
    return `### ${entry.title}\n\n${entry.body}`
  }
  return entry.body
}

function toThreadMessage(entry: SessionEntry): ThreadMessage {
  if (entry.role === 'user') {
    return {
      id: entry.id,
      role: 'user',
      createdAt: new Date(entry.createdAt),
      content: [{ type: 'text', text: entry.body }],
      attachments: [],
      metadata: { custom: {} },
    } as ThreadMessage
  }

  return {
    id: entry.id,
    role: entry.role === 'tool' ? 'tool' : 'assistant',
    createdAt: new Date(entry.createdAt),
    content: [{ type: 'text', text: formatSessionBody(entry) }],
    attachments: [],
    status: { type: 'complete', reason: 'stop' },
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: entry.title ? { title: entry.title, role: entry.role } : { role: entry.role },
    },
  } as ThreadMessage
}

function createSessionEntry(
  id: string,
  role: SessionEntryRole,
  createdAt: string,
  body: string,
  title?: string,
  metadata?: unknown,
): SessionEntry {
  return { id, role, createdAt, body, title, metadata }
}

function getRemoteSessionId(artifacts: RunArtifactRecord[]) {
  const artifact = artifacts.find((item) => item.type === 'remote_agent_session')
  const sessionId = artifact?.content?.sessionId
  return typeof sessionId === 'string' ? sessionId : null
}

function hasRemoteRunLogs(payload: RunResultsResponse | null) {
  const remoteSession = payload?.sessions?.find((session) => session.kind === 'remote_codex')
  if (remoteSession?.entries?.length) {
    return true
  }
  return (payload?.artifacts ?? []).some(
    (artifact) => artifact.type === 'remote_agent_transcript',
  ) || Boolean(getRemoteSessionId(payload?.artifacts ?? []) && payload?.events.length)
}

function getRemoteAgentTranscriptArtifact(payload: RunResultsResponse | null) {
  const artifact = (payload?.artifacts ?? []).find(
    (artifact) => artifact.type === 'remote_agent_transcript',
  )
  const text = artifact?.content?.text
  if (!artifact || typeof text !== 'string' || !text.trim()) {
    return null
  }
  return { artifact, text }
}

function getRemoteAgentSummaryArtifact(payload: RunResultsResponse | null) {
  const artifact = (payload?.artifacts ?? []).find(
    (artifact) => artifact.type === 'remote_agent_summary',
  )
  const text = artifact?.content?.text
  if (!artifact || typeof text !== 'string' || !text.trim()) {
    return null
  }
  return { artifact, text }
}

function buildCliTranscript(
  run: RunRecord,
  dataset: DatasetRecord | undefined,
  payload: RunResultsResponse | null,
): SessionEntry[] {
  const storedSession = payload?.sessions?.find((session) => session.kind === 'cli_orchestration')
  if (storedSession?.entries?.length) {
    const hasStructuredCliEntries = storedSession.entries.some((entry) =>
      [
        'local_user',
        'local_assistant',
        'tool_call',
        'tool_result',
        'local_summary',
        'run_launch',
        'dataset_summary',
        'run_summary',
      ].includes(entry.kind),
    )
    const visibleEntries = hasStructuredCliEntries
      ? storedSession.entries.filter((entry) => !['request', 'response'].includes(entry.kind))
      : storedSession.entries
    return visibleEntries.map((entry) =>
      createSessionEntry(
        entry.id,
        entry.role === 'user' ? 'user' : entry.role === 'system' ? 'system' : entry.role === 'tool' ? 'tool' : 'assistant',
        entry.createdAt,
        entry.content,
        entry.title ?? formatStatus(entry.kind),
        entry.metadata,
      ),
    )
  }

  const messages: SessionEntry[] = []
  const details = [
    `Run id: \`${run.id}\``,
    `Dataset: \`${dataset?.name ?? run.datasetId}\``,
    `Type: ${formatStatus(run.type)}`,
    `Status: ${formatStatus(run.status)}`,
  ]

  const prompt = run.prompt?.trim()
  const kickoff = prompt
    ? `Start a ${run.type} research run against \`${dataset?.name ?? run.datasetId}\`.\n\n${prompt}`
    : `Start a ${run.type} research run against \`${dataset?.name ?? run.datasetId}\`.`

  messages.push(
    createSessionEntry(`${run.id}-cli-user`, 'user', run.createdAt, kickoff, 'Run request'),
  )
  messages.push(
    createSessionEntry(
      `${run.id}-cli-summary`,
      'assistant',
      run.createdAt,
      `CLI orchestration session initialized.\n\n${details.join('\n')}`,
      'CLI session',
    ),
  )

  if (payload?.metadata?.config && run.status.toLowerCase() !== 'running') {
    messages.push(
      createSessionEntry(
        `${run.id}-cli-config`,
        'system',
        run.createdAt,
        codeBlock('Run config', payload.metadata.config),
        'Stored config',
      ),
    )
  }

  for (const event of payload?.events ?? []) {
    const icon =
      event.level === 'error' ? 'ERROR' : event.level === 'warning' ? 'WARN' : 'INFO'
    messages.push(
      createSessionEntry(
        event.id,
        event.level === 'error' ? 'system' : 'assistant',
        event.createdAt,
        `**${icon} · ${formatCompactTime(event.createdAt)}**\n\n${event.message}`,
        'Event',
      ),
    )
  }

  const producedArtifacts = getProducedArtifacts(payload).filter(
    (artifact) => artifact.type !== 'remote_agent_session',
  )
  if (producedArtifacts.length > 0) {
    const lines = producedArtifacts.map((artifact) => {
      const link = artifact.url ? ` ([open artifact](${artifact.url}))` : ''
      return `- **${artifact.title}** · ${formatStatus(artifact.type)}${link}`
    })
    messages.push(
      createSessionEntry(
        `${run.id}-cli-artifacts`,
        'system',
        producedArtifacts.at(-1)?.createdAt ?? run.updatedAt,
        `### Produced artifacts\n\n${lines.join('\n')}`,
        'Produced artifacts',
      ),
    )
  }

  return messages
}

function buildRemoteTranscript(
  run: RunRecord,
  dataset: DatasetRecord | undefined,
  payload: RunResultsResponse | null,
): SessionEntry[] {
  const storedSession = payload?.sessions?.find((session) => session.kind === 'remote_codex')
  if (storedSession?.entries?.length) {
    const entries = storedSession.entries.map((entry) =>
      createSessionEntry(
        entry.id,
        entry.role === 'user' ? 'user' : entry.role === 'system' ? 'system' : entry.role === 'tool' ? 'tool' : 'assistant',
        entry.createdAt,
        entry.content,
        entry.title ?? formatStatus(entry.kind),
        entry.metadata,
      ),
    )
    const hasSynthesis = storedSession.entries.some((entry) => entry.kind === 'final_summary')
    const summaryArtifact = getRemoteAgentSummaryArtifact(payload)
    if (!hasSynthesis && summaryArtifact) {
      entries.push(
        createSessionEntry(
          `${run.id}-remote-summary-artifact`,
          'assistant',
          summaryArtifact.artifact.createdAt,
          summaryArtifact.text,
          'Synthesis',
        ),
      )
    }
    return entries
  }

  const transcriptArtifact = getRemoteAgentTranscriptArtifact(payload)
  const summaryArtifact = getRemoteAgentSummaryArtifact(payload)
  if (transcriptArtifact) {
    const entries = [
      createSessionEntry(
        `${run.id}-remote-transcript-artifact`,
        'assistant',
        transcriptArtifact.artifact.createdAt,
        codeBlock('Remote Codex stdout', transcriptArtifact.text),
        transcriptArtifact.artifact.title,
      ),
    ]
    if (summaryArtifact) {
      entries.push(
        createSessionEntry(
          `${run.id}-remote-summary-artifact`,
          'assistant',
          summaryArtifact.artifact.createdAt,
          summaryArtifact.text,
          'Synthesis',
        ),
      )
    }
    return entries
  }

  const messages: SessionEntry[] = []
  const remoteSessionId = getRemoteSessionId(payload?.artifacts ?? [])
  const prompt = run.prompt?.trim()

  messages.push(
    createSessionEntry(
      `${run.id}-remote-user`,
      'user',
      run.createdAt,
      [
        `Execute the remote Codex run for dataset \`${dataset?.name ?? run.datasetId}\`.`,
        prompt ? `\n\n${prompt}` : '',
      ].join(''),
      'Remote run request',
    ),
  )

  messages.push(
    createSessionEntry(
      `${run.id}-remote-session`,
      'assistant',
      run.createdAt,
      [
        `Remote agent session attached to run \`${run.id}\`.`,
        remoteSessionId ? `\n\nSession id: \`${remoteSessionId}\`` : '',
      ].join(''),
      'Remote session',
    ),
  )

  for (const event of payload?.events ?? []) {
    messages.push(
      createSessionEntry(
        `${event.id}-remote`,
        'assistant',
        event.createdAt,
        `**${formatCompactTime(event.createdAt)}**\n\n${event.message}`,
        'Remote event',
      ),
    )
  }

  if (!payload?.events.length) {
    messages.push(
      createSessionEntry(
        `${run.id}-remote-empty`,
        'system',
        run.updatedAt,
        'No remote event log has been persisted for this run yet.',
        'Remote log',
      ),
    )
  }

  return messages
}

function buildObservedProgressTranscript(payload: RunResultsResponse | null): SessionEntry[] {
  return deriveRunProgress(payload?.events ?? []).map((entry) =>
    createSessionEntry(
      `progress-${entry.id}`,
      entry.level === 'error' ? 'system' : 'assistant',
      entry.createdAt,
      `**${formatCompactTime(entry.createdAt)}**\n\n${entry.text}`,
      formatStatus(entry.kind),
    ),
  )
}

function AssistantTranscript({
  entries,
  emptyTitle,
  emptyDescription,
  unframed = false,
}: {
  entries: SessionEntry[]
  emptyTitle: string
  emptyDescription: string
  unframed?: boolean
}) {
  const messages = useMemo(() => entries.map(toThreadMessage), [entries])
  const runtime = useExternalStoreRuntime({
    isRunning: false,
    messages,
    onNew: async () => {},
  })

  if (entries.length === 0) {
    return (
      <div className={unframed ? 'flex min-h-[28rem] items-center justify-center px-8 py-16' : 'flex min-h-[28rem] items-center justify-center rounded-3xl border border-dashed border-border bg-background px-8 py-16'}>
        <div className="max-w-xl text-center">
          <div className="text-lg font-semibold">{emptyTitle}</div>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{emptyDescription}</p>
        </div>
      </div>
    )
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className={unframed ? 'flex min-h-0 flex-1 flex-col' : 'flex min-h-0 flex-1 flex-col rounded-3xl border border-border bg-background'}>
        <Thread
          readOnly
          welcomeTitle={emptyTitle}
          welcomeDescription={emptyDescription}
        />
      </div>
    </AssistantRuntimeProvider>
  )
}

function beginDashboardBridge() {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const destination = new URL('/api/auth/bridge', rootOrigin)
  destination.searchParams.set('return_to', `${dashboardOrigin}${returnTo}`)
  window.location.assign(destination.toString())
}

function beginDashboardLogin() {
  const destination = new URL('/api/auth/start', rootOrigin)
  const bridgeReturn = `/api/auth/bridge?return_to=${encodeURIComponent(
    dashboardOrigin,
  )}`
  destination.searchParams.set('return_to', bridgeReturn)
  window.location.assign(destination.toString())
}

function beginMarketingLogin() {
  const returnUrl = new URL(window.location.href)
  returnUrl.searchParams.delete('login')
  returnUrl.searchParams.delete('auth_error')
  const returnTo = `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`
  const destination = new URL('/api/auth/start', window.location.origin)
  destination.searchParams.set('return_to', returnTo || '/')
  window.location.assign(destination.toString())
}

async function fetchSession() {
  if (isHarnessMode()) {
    return harnessSession
  }
  const response = await fetch('/api/auth/session', {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  return response.json() as Promise<SessionResponse>
}

async function fetchJson<T>(input: string) {
  if (isHarnessMode()) {
    const harnessScenario = new URL(window.location.href).searchParams.get('scenario')
    if (harnessScenario === 'data-error' && (
      input === '/api/cli/datasets' ||
      input === '/api/cli/runs' ||
      input.startsWith('/api/cli/sessions?')
    )) {
      throw new Error('Harness scenario: dashboard data could not load.')
    }
    if (input === '/api/cli/datasets') {
      if (harnessScenario === 'empty') {
        return { datasets: [] } as T
      }
      return { datasets: harnessDatasets } as T
    }
    if (input === '/api/cli/runs') {
      if (harnessScenario === 'empty') {
        return { runs: [] } as T
      }
      return { runs: harnessRuns } as T
    }
    if (input.startsWith('/api/cli/sessions?')) {
      if (harnessScenario === 'empty') {
        return { sessions: [] } as T
      }
      return { sessions: harnessSessions } as T
    }
    const datasetMatch = input.match(/^\/api\/cli\/datasets\/([^/]+)$/u)
    if (datasetMatch) {
      const dataset = getHarnessDataset(decodeURIComponent(datasetMatch[1] ?? ''))
      if (!dataset) throw new Error('Harness dataset not found.')
      return { dataset } as T
    }
    const runResultsMatch = input.match(/^\/api\/cli\/runs\/([^/]+)\/results$/u)
    if (runResultsMatch) {
      return getHarnessRunResults(decodeURIComponent(runResultsMatch[1] ?? '')) as T
    }
    const sessionMatch = input.match(/^\/api\/cli\/sessions\/([^/]+)$/u)
    if (sessionMatch) {
      const session = getHarnessSession(decodeURIComponent(sessionMatch[1] ?? ''))
      if (!session) throw new Error('Harness session not found.')
      return { session, entries: session.entries ?? [] } as T
    }
  }

  const response = await fetch(input, {
    credentials: 'same-origin',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

function normalizeDatasetsPayload(payload: unknown): DatasetRecord[] {
  if (Array.isArray(payload)) {
    return payload as DatasetRecord[]
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'datasets' in payload &&
    Array.isArray((payload as { datasets?: unknown }).datasets)
  ) {
    return (payload as { datasets: DatasetRecord[] }).datasets
  }

  return []
}

function normalizeRunsPayload(payload: unknown): RunRecord[] {
  if (Array.isArray(payload)) {
    return payload as RunRecord[]
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'runs' in payload &&
    Array.isArray((payload as { runs?: unknown }).runs)
  ) {
    return (payload as { runs: RunRecord[] }).runs
  }

  return []
}

function normalizeSessionsPayload(payload: unknown): StoredAssistantSession[] {
  if (Array.isArray(payload)) {
    return payload as StoredAssistantSession[]
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'sessions' in payload &&
    Array.isArray((payload as { sessions?: unknown }).sessions)
  ) {
    return (payload as { sessions: StoredAssistantSession[] }).sessions
  }

  return []
}

function extractAppendMessageText(message: {
  content?: Array<{ type?: string; text?: string }>
}) {
  return (message.content ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

function extractPreviousResponseId(entries: StoredAssistantSessionEntry[]) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]
    if (!entry) continue
    if (!entry.metadata || typeof entry.metadata !== 'object') continue
    const previousResponseId = (entry.metadata as { previousResponseId?: unknown }).previousResponseId
    if (typeof previousResponseId === 'string' && previousResponseId) {
      return previousResponseId
    }
  }
  return null
}

function sessionEntriesToThreadMessages(entries: StoredAssistantSessionEntry[]) {
  return entries.map((entry) =>
    toThreadMessage(
      createSessionEntry(
        entry.id,
        entry.role === 'user' ? 'user' : entry.role === 'system' ? 'system' : 'assistant',
        entry.createdAt,
        entry.content,
        entry.title ?? formatStatus(entry.kind),
        entry.metadata,
      ),
    ),
  )
}

async function postAssistantTurn(body: {
  input: string
  sessionId?: string | null
  previousResponseId?: string | null
}) {
  if (isHarnessMode()) {
    return {
      sessionId: body.sessionId ?? 'session-harness-cli',
      previousResponseId: `harness-response-${Date.now()}`,
      reply: 'Harness mode recorded the request without calling the production assistant.',
    }
  }

  const response = await fetch('/api/cli/assistant/respond', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: body.input,
      sessionId: body.sessionId ?? undefined,
      previousResponseId: body.previousResponseId ?? undefined,
    }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Request failed: ${response.status}`)
  }
  return response.json() as Promise<AssistantTurnResponse>
}

function getDashboardRoute() {
  const url = new URL(window.location.href)
  const candidate = url.searchParams.get('view')
  const view: DashboardView =
    candidate === 'assistant' ||
    candidate === 'datasets' ||
    candidate === 'runs' ||
    candidate === 'terminal-sessions'
      ? candidate
      : 'assistant'

  return {
    view,
    runId: url.searchParams.get('runId'),
    datasetId: url.searchParams.get('datasetId'),
    sessionId: url.searchParams.get('sessionId'),
  }
}

function updateDashboardRoute(next: {
  view?: DashboardView
  runId?: string | null
  datasetId?: string | null
  sessionId?: string | null
}) {
  const url = new URL(window.location.href)
  url.searchParams.set('view', next.view ?? getDashboardRoute().view)
  if (next.runId) url.searchParams.set('runId', next.runId)
  else url.searchParams.delete('runId')
  if (next.datasetId) url.searchParams.set('datasetId', next.datasetId)
  else url.searchParams.delete('datasetId')
  if (next.sessionId) url.searchParams.set('sessionId', next.sessionId)
  else url.searchParams.delete('sessionId')
  window.history.pushState({}, '', url.toString())
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function initCal() {
  ;((C, A, L) => {
    const push = (api: { q?: unknown[] }, args: IArguments | unknown[]) => {
      api.q = api.q || []
      api.q.push(args)
    }

    const d = C.document
    C.Cal =
      C.Cal ||
      function () {
        const cal = C.Cal!
        const args = arguments

        if (!cal.loaded) {
          cal.ns = {}
          cal.q = cal.q || []
          d.head.appendChild(d.createElement('script')).src = A
          cal.loaded = true
        }

        if (args[0] === L) {
          const namespace = args[1]
          const api: { (...args: unknown[]): void; q?: unknown[] } = function () {
            push(api, arguments)
          }

          api.q = api.q || []

          if (typeof namespace === 'string') {
            cal.ns![namespace] = cal.ns![namespace] || api
            push(cal.ns![namespace] as { q?: unknown[] }, args)
            push(cal, ['initNamespace', namespace])
          } else {
            push(cal, args)
          }

          return
        }

        push(cal, args)
      }
  })(window, 'https://app.cal.com/embed/embed.js', 'init')

  window.Cal?.('init', '30min', { origin: 'https://app.cal.com' })
  window.Cal?.ns?.['30min']?.('ui', {
    hideEventTypeDetails: false,
    layout: 'month_view',
  })
}

function useDashboardRoute() {
  const [route, setRoute] = useState(getDashboardRoute())

  useEffect(() => {
    const sync = () => setRoute(getDashboardRoute())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  return route
}

function StatusBadge({ children }: { children: string }) {
  return (
    <Badge
      variant="outline"
      className="rounded-none border-border bg-background px-2.5 py-1 text-[11px] tracking-[0.18em]"
    >
      {children}
    </Badge>
  )
}

function RunPriorityBadge({ label, tone }: { label: string; tone: 'success' | 'active' | 'warning' | 'neutral' }) {
  const classes = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    active: 'border-sky-200 bg-sky-50 text-sky-900',
    warning: 'border-amber-300 bg-amber-100 text-amber-950',
    neutral: 'border-border bg-muted/40 text-foreground',
  }
  return (
    <Badge
      variant="outline"
      className={`rounded-none px-2.5 py-1 text-[11px] tracking-[0.12em] ${classes[tone]}`}
    >
      {label}
    </Badge>
  )
}

function DatasetFeed({
  datasets,
  onSelectDataset,
}: {
  datasets: DatasetRecord[]
  onSelectDataset: (dataset: DatasetRecord) => void
}) {
  if (datasets.length === 0) {
    return (
      <Empty className="border-t border-dashed border-border px-6 py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Database />
          </EmptyMedia>
          <EmptyTitle>No datasets yet</EmptyTitle>
          <EmptyDescription>
            Create a dataset with the RESEARCH CLI and it will appear here automatically.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  const publicDatasets = datasets.filter(isPublicDataset)
  const privateDatasets = datasets.filter((dataset) => !isPublicDataset(dataset))

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-14">
      <DatasetFeedSection
        title="Your datasets"
        summary={`${privateDatasets.length} private dataset${privateDatasets.length === 1 ? '' : 's'} visible only to your workspace.`}
        emptyMessage="No private datasets yet. Upload a source or create a research environment from the CLI and it will appear here."
        datasets={privateDatasets}
        onSelectDataset={onSelectDataset}
      />
      <DatasetFeedSection
        title="Public datasets"
        summary={`${publicDatasets.length} shared dataset${publicDatasets.length === 1 ? '' : 's'} available to explore without uploading your own files.`}
        emptyMessage="No public datasets are available right now."
        datasets={publicDatasets}
        onSelectDataset={onSelectDataset}
      />
    </div>
  )
}

function DatasetFeedSection({
  title,
  summary,
  emptyMessage,
  datasets,
  onSelectDataset,
}: {
  title: string
  summary: string
  emptyMessage: string
  datasets: DatasetRecord[]
  onSelectDataset: (dataset: DatasetRecord) => void
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 border-b border-border pb-3">
        <div className="text-xl font-medium">{title}</div>
        <p className="text-sm text-muted-foreground">{summary}</p>
      </div>
      {datasets.length === 0 ? (
        <Card className="rounded-2xl border border-dashed bg-muted/25 shadow-none">
          <CardContent className="px-5 py-5 text-sm text-muted-foreground">{emptyMessage}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {datasets.map((dataset) => {
            const description = datasetInventoryDescription(dataset)
            const useCase = datasetInventoryUseCase(dataset)
            const readiness = datasetInventoryStatus(dataset)
            return (
              <button
                key={dataset.id}
                type="button"
                className="grid min-h-56 grid-rows-[auto_1fr_auto] gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onSelectDataset(dataset)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex size-13 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Database className="size-6" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-base font-semibold">{dataset.name}</div>
                      {useCase ? <p className="text-sm font-medium text-foreground/80">{useCase}</p> : null}
                    </div>
                  </div>
                  <StatusBadge>{readiness.label}</StatusBadge>
                </div>
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                  <p className="text-sm text-foreground/75">{readiness.detail}</p>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm font-medium text-foreground">
                  <span>View dataset details</span>
                  <ChevronRight className="size-4" aria-hidden="true" />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

async function startDatasetDescribeRun(datasetId: string) {
  if (isHarnessMode()) {
    const run = harnessRuns.find((candidate) => candidate.datasetId === datasetId) ?? harnessRuns[0]
    return { run }
  }

  const response = await fetch(`/api/cli/datasets/${encodeURIComponent(datasetId)}/runs`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'describe',
      prompt: [
        `Describe dataset ${datasetId}.`,
        'Produce a durable documentation briefing for humans. Do not include query instructions, starter analyses, or suggestions for how to use agents; this is a dataset documentation task only.',
        'Inspect mounted files, manifests, source registries, table catalogs, Parquet/CSV/JSON/DuckDB files, README files, data dictionaries, QA reports, schemas, sample rows, provenance, source URLs, formats, time coverage, geography coverage, transformations, validation status, limitations, and known gaps.',
        'Create Dataset Briefing markdown with sections: Overview; Data Inventory; Sources; Schemas; Time Coverage; Geography Coverage; Formats; Transformations & Derived Fields; Quality & Validation; Limitations & Known Gaps.',
        'Create Dataset Profile JSON with summary, sources, tables, schemas/columns, timeCoverage, geographyCoverage, formats, transformations, quality, limitations, and generatedAt.',
      ].join('\n'),
      artifacts: [
        { type: 'markdown', title: 'Dataset Briefing' },
        { type: 'json', title: 'Dataset Profile' },
      ],
      config: { describeDataset: true },
    }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Describe run failed: ${response.status}`)
  }
  return response.json() as Promise<{ run: RunRecord }>
}

function DatasetDetailPage({
  dataset,
  runs,
  onBack,
  onOpenRun,
}: {
  dataset: DatasetRecord
  runs: RunRecord[]
  onBack: () => void
  onOpenRun: (run: RunRecord) => void
}) {
  const [detail, setDetail] = useState<DatasetRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [startingDescribe, setStartingDescribe] = useState(false)
  const describeRun = runs.find((run) => run.datasetId === dataset.id && run.type === 'describe') ?? null
  const current = detail ?? dataset

  useEffect(() => {
    let cancelled = false
    setError(null)
    void fetchJson<{ dataset: DatasetRecord }>(`/api/cli/datasets/${encodeURIComponent(dataset.id)}`)
      .then((payload) => {
        if (!cancelled) setDetail(payload.dataset)
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : 'Could not load dataset.')
      })
    return () => {
      cancelled = true
    }
  }, [dataset.id])

  const canDescribe = current.deploymentStatus === 'ready' && current.status === 'ready'
  const briefingMarkdown = current.profile?.briefingMarkdown || current.profile?.notes || ''
  const structuredProfile = current.profile?.profile
  const describedAt = current.profile?.describedAt ?? current.profile?.updatedAt ?? null
  const describeIsRunning = describeRun ? !['ready', 'failed', 'cancelled', 'canceled', 'worker_unreachable'].includes(describeRun.status.toLowerCase()) : false
  const sourceCount = profileArrayCount(structuredProfile, 'sources')
  const tableCount = profileArrayCount(structuredProfile, 'tables')
  const formatCount = profileArrayCount(structuredProfile, 'formats')
  const limitationCount = profileArrayCount(structuredProfile, 'limitations')
  const profileSources = profileArray(structuredProfile, 'sources')
  const profileTables = profileArray(structuredProfile, 'tables')
  const profileFormats = profileArray(structuredProfile, 'formats')
  const profileLimitations = profileArray(structuredProfile, 'limitations')
  const schemaRecord = profileRecord(current.profile, 'schema')
  const schemaColumns = Array.isArray(schemaRecord?.columns)
    ? schemaRecord.columns.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : []
  const sampleRows = Array.isArray(current.profile?.sampleRows)
    ? current.profile.sampleRows.filter((row): row is Record<string, unknown> => isRecord(row)).slice(0, 3)
    : []
  const primarySource = profileSources
    .map((item) => profileText(item, 'provider') ?? profileText(item, 'name') ?? profileText(item, 'source'))
    .find(Boolean) ?? null
  const freshness = describedAt ?? current.updatedAt
  const profileMetrics = [
    {
      label: 'Source',
      value: sourceCount ? `${sourceCount} source${sourceCount === 1 ? '' : 's'}` : 'No source summary',
      detail: primarySource ?? 'Provider not summarized yet.',
    },
    {
      label: 'Tables',
      value: tableCount ? `${tableCount} table${tableCount === 1 ? '' : 's'}` : 'No tables listed',
      detail: profileTables
        .map((item) => {
          const name = profileText(item, 'name') ?? 'Unnamed table'
          const rows = typeof item.rowCount === 'number'
            ? item.rowCount
            : typeof item.rows === 'number'
              ? item.rows
              : null
          return rows ? `${name} (${rows.toLocaleString()} rows)` : name
        })
        .filter(Boolean)
        .join(', ') || 'Table inventory not summarized yet.',
    },
    {
      label: 'Formats',
      value: formatCount ? `${formatCount} format${formatCount === 1 ? '' : 's'}` : 'No formats listed',
      detail: formatList(profileFormats.map((item) => (typeof item === 'string' ? item.toUpperCase() : '')).filter(Boolean)) || 'Format summary not available yet.',
    },
    {
      label: 'Limitations',
      value: limitationCount ? `${limitationCount} known limit${limitationCount === 1 ? '' : 's'}` : 'No limitations listed',
      detail: typeof profileLimitations[0] === 'string' ? profileLimitations[0] : 'No explicit limitation summary yet.',
    },
  ]
  const profileSummary = profileText(structuredProfile, 'summary')
  const fitHeadline = current.inventoryUseCase?.replace(/^Best for:\s*/i, '').trim() || profileSummary
  const fitVerdict = limitationCount
    ? `Useful for ${fitHeadline ?? 'initial exploration'}, but review the known limits before trusting final results.`
    : `Ready for ${fitHeadline ?? 'research use'} with no major limits highlighted in the current profile.`
  const describeButtonLabel = briefingMarkdown ? 'Refresh briefing' : 'Describe dataset'
  const describeHelperText = briefingMarkdown
    ? 'Regenerate the briefing if the source data or profile has changed.'
    : 'Generate a plain-language briefing covering provenance, schema, coverage, and limits.'
  const describeDestinationText = briefingMarkdown
    ? 'Starts a fresh async run and opens the run view so you can watch progress, transcript updates, and the new briefing artifact.'
    : 'Starts an async run and opens the run view with progress, transcript updates, and the generated briefing artifact.'
  const provenanceItems = [
    {
      label: 'Source provenance',
      value: primarySource
        ? `${primarySource}${current.mode?.toLowerCase() === 'public' ? ' public dataset' : ' dataset'}`
        : current.sourceFilename
          ? `Imported from ${current.sourceFilename}`
          : 'Provenance summary not available yet.',
    },
    {
      label: 'Last refreshed',
      value: freshness ? formatDateTime(freshness) : 'Unknown',
    },
    {
      label: 'Coverage and completeness',
      value: profileLimitations.length > 0
        ? String(profileLimitations[0])
        : current.ingestConfig && isRecord(current.ingestConfig) && typeof current.ingestConfig.rowCount === 'number'
          ? `${current.ingestConfig.rowCount.toLocaleString()} rows summarized in the current profile.`
          : 'Coverage notes are not available yet.',
    },
  ]

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <button type="button" className="w-fit text-sm text-muted-foreground hover:text-foreground" onClick={onBack}>
          Back to datasets
        </button>
        <section className="flex flex-col gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-normal">{current.name}</h1>
            <p className="mt-3 max-w-3xl text-lg leading-8 text-muted-foreground">
              {current.description || current.sourceFilename || `A ${formatStatus(current.sourceType)} dataset registered in Alpha Research.`}
            </p>
          </div>
        </section>

        {error ? <div className="bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

        <section className="grid gap-4 rounded-2xl border border-border bg-muted/20 p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Trust summary</div>
              <h2 className="text-2xl font-semibold tracking-normal">{fitVerdict}</h2>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                {profileSummary ?? 'Open the dataset briefing to review what is inside, where it came from, and what could make it a poor fit.'}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {provenanceItems.map((item) => (
                <div key={item.label} className="rounded-xl border border-border bg-background/80 px-4 py-4">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{item.label}</div>
                  <div className="mt-2 text-sm leading-6 text-foreground/85">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-background p-5">
            <div className="space-y-2">
              <h2 className="text-sm font-medium">Dataset briefing</h2>
              <p className="text-sm leading-6 text-muted-foreground">{describeHelperText}</p>
              {describedAt ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="size-4" />
                  <span>Last generated {formatDateTime(describedAt)}</span>
                  {describeIsRunning ? <StatusBadge>Refreshing</StatusBadge> : null}
                </div>
              ) : null}
              <p className="text-sm leading-6 text-muted-foreground">{describeDestinationText}</p>
              <div className="rounded-xl border border-dashed border-border bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
                Expected artifacts: <span className="font-medium text-foreground">Dataset Briefing</span> and <span className="font-medium text-foreground">Dataset Profile</span>.
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!canDescribe || startingDescribe}
              onClick={async () => {
                setStartingDescribe(true)
                try {
                  const payload = await startDatasetDescribeRun(current.id)
                  window.dispatchEvent(new CustomEvent('alpha-research-dashboard-refresh'))
                  onOpenRun(payload.run)
                } catch (describeError) {
                  setError(describeError instanceof Error ? describeError.message : 'Could not start describe job.')
                } finally {
                  setStartingDescribe(false)
                }
              }}
            >
              {startingDescribe ? 'Starting...' : describeButtonLabel}
            </Button>
          </div>
        </section>

        {profileMetrics.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {profileMetrics.map((metric) => (
              <div key={metric.label} className="rounded-xl border border-border px-5 py-4">
                <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">{metric.label}</div>
                <div className="mt-2 break-words text-lg font-semibold">{metric.value}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{metric.detail}</p>
              </div>
            ))}
          </section>
        ) : null}

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <h2 className="text-xl font-medium">Dataset briefing</h2>
            <div className="text-sm text-muted-foreground">Read top to bottom for provenance, coverage, schema, and known gaps.</div>
          </div>
          <div className="rounded-lg border border-border p-5">
            {briefingMarkdown ? (
              <article className="max-w-none">{renderBriefingMarkdown(briefingMarkdown)}</article>
            ) : describeRun ? (
              <button type="button" className="text-left" onClick={() => onOpenRun(describeRun)}>
                <div className="font-medium">
                  {describeIsRunning ? 'Generating dataset briefing...' : `${formatStatus(describeRun.status)} describe job`}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {describeIsRunning
                    ? 'The remote Codex agent is inspecting files, sources, schemas, time coverage, geography coverage, formats, QA, and limitations. Raw executor logs are hidden here.'
                    : describeRun.status === 'ready'
                      ? 'Describe completed but no Dataset Briefing artifact has been persisted yet. Open the run to inspect artifacts.'
                      : describeRun.outputPreview || `Updated ${relativeTime(describeRun.updatedAt)}`}
                </div>
              </button>
            ) : (
              <p className="text-sm leading-7 text-muted-foreground">
                No briefing has been generated yet. A describe job launches a remote Codex agent to inspect the mounted dataset and write a detailed document covering data inventory, sources, schemas, time coverage, geography coverage, formats, transformations, QA status, limitations, and known gaps.
                {!canDescribe ? ' This dataset needs a ready deployed environment before the describe workflow can run.' : ''}
              </p>
            )}
          </div>
        </section>

        {(schemaColumns.length > 0 || sampleRows.length > 0) ? (
          <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-xl border border-border p-5">
              <h2 className="text-lg font-medium">Schema</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Core fields visible in the current profile.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {schemaColumns.map((column) => (
                  <span key={column} className="rounded-full border border-border px-3 py-1 text-sm text-foreground/85">
                    {column}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Sample rows</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Quick examples so you can confirm the dataset contains the kind of records you expect.
                  </p>
                </div>
              </div>
              {sampleRows.length > 0 ? (
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(sampleRows[0] ?? {}).map((column) => (
                          <TableHead key={column}>{column}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sampleRows.map((row, index) => (
                        <TableRow key={index}>
                          {Object.keys(sampleRows[0] ?? {}).map((column) => (
                            <TableCell key={column}>{String(row[column] ?? '—')}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <details className="rounded-lg border border-border p-5">
          <summary className="cursor-pointer text-sm font-medium">Developer details</summary>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Lifecycle metadata and raw payloads used for debugging dataset ingestion and describe runs.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {[
              ['Source file', current.sourceFilename ?? 'Unknown'],
              ['Manifest path', current.manifestPath ?? 'Not available'],
              ['Mounted volume', current.volume?.mountPath ?? 'Not mounted'],
              ['Dataset size', formatBytes(current.sourceSizeBytes)],
              ['Dataset updated', formatDateTime(current.updatedAt)],
              ['Describe run', describeRun?.id ?? current.profile?.describedRunId ?? 'None'],
              ['Briefing artifact', current.profile?.briefingArtifactId ?? 'None'],
              ['Profile artifact', current.profile?.profileArtifactId ?? 'None'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/40 px-4 py-3">
                <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">{label}</div>
                <div className="mt-2 break-words text-sm">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <pre className="max-h-96 overflow-auto rounded-lg border border-border p-4 text-xs text-muted-foreground">{JSON.stringify(current.profile ?? {}, null, 2)}</pre>
            <pre className="max-h-96 overflow-auto rounded-lg border border-border p-4 text-xs text-muted-foreground">{JSON.stringify(current.ingestConfig ?? {}, null, 2)}</pre>
          </div>
        </details>
      </div>
    </main>
  )
}

function RunTable({
  runs,
  datasetLookup,
  onSelectRun,
}: {
  runs: RunRecord[]
  datasetLookup: Map<string, DatasetRecord>
  onSelectRun: (run: RunRecord) => void
}) {
  if (runs.length === 0) {
    return (
      <Empty className="border-t border-dashed border-border px-6 py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History />
          </EmptyMedia>
          <EmptyTitle>No runs yet</EmptyTitle>
          <EmptyDescription>
            Runs launched from the RESEARCH CLI will appear here with status and prompt history.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const sortedRuns = [...runs].sort((a, b) => {
    const priorityDelta = getRunPriorityMeta(a).rank - getRunPriorityMeta(b).rank
    if (priorityDelta !== 0) {
      return priorityDelta
    }
    return b.updatedAt.localeCompare(a.updatedAt)
  })
  const summary = getRunInventorySummary(sortedRuns)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="rounded-none border-border shadow-none">
          <CardContent className="px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Needs attention</div>
            <div className="mt-2 text-3xl font-semibold">{summary.attention}</div>
            <p className="mt-1 text-sm text-muted-foreground">Runs that stopped or need recovery.</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border shadow-none">
          <CardContent className="px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Running now</div>
            <div className="mt-2 text-3xl font-semibold">{summary.active}</div>
            <p className="mt-1 text-sm text-muted-foreground">Active work still worth watching.</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border shadow-none">
          <CardContent className="px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Completed</div>
            <div className="mt-2 text-3xl font-semibold">{summary.complete}</div>
            <p className="mt-1 text-sm text-muted-foreground">Runs that reached a terminal success state.</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border shadow-none">
          <CardContent className="px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Outputs ready</div>
            <div className="mt-2 text-3xl font-semibold">{summary.outputs}</div>
            <p className="mt-1 text-sm text-muted-foreground">Completed work with artifacts available.</p>
          </CardContent>
        </Card>
      </div>
      <div className="rounded-none border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>What needs attention</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Next step</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRuns.map((run) => {
              const priority = getRunPriorityMeta(run)
              const statusTone = getRunStatusTone(run.status)
              const prompt =
                run.prompt?.trim() ||
                run.outputPreview?.trim() ||
                'No prompt recorded yet.'

              return (
                <TableRow
                  key={run.id}
                  className="cursor-pointer align-top"
                  onClick={() => onSelectRun(run)}
                >
                  <TableCell className="align-top">
                    <div className="flex min-w-0 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <RunPriorityBadge label={priority.label} tone={statusTone} />
                        <span className="font-medium">{priority.summary}</span>
                      </div>
                      <span className="truncate font-medium">
                        {datasetLookup.get(run.datasetId)?.name ?? run.datasetId}
                      </span>
                      <span className="max-w-[38rem] text-sm whitespace-normal text-foreground/85">
                        {truncate(prompt, 180)}
                      </span>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>{priority.detail}</span>
                        <span aria-hidden="true">•</span>
                        <span>{getRunOutputSignal(run)}</span>
                        {run.sessionCount ? (
                          <>
                            <span aria-hidden="true">•</span>
                            <span>{run.sessionCount} linked session{run.sessionCount === 1 ? '' : 's'}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatStatus(run.type)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <StatusBadge>{formatStatus(run.status)}</StatusBadge>
                      {run.status.toLowerCase() === 'worker_unreachable' ? (
                        <span className="max-w-48 text-sm leading-5 text-muted-foreground">
                          The worker stopped responding before reporting a final result.
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{formatDateTime(run.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex min-w-28 flex-col gap-1">
                      <span>{relativeTime(run.updatedAt)}</span>
                      <span className="text-sm text-muted-foreground">{formatDateTime(run.updatedAt)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-none border-foreground/20 px-3 font-medium"
                      onClick={(event) => {
                        event.stopPropagation()
                        onSelectRun(run)
                      }}
                    >
                      {priority.actionLabel}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function SessionTable({
  sessions,
  onSelectSession,
}: {
  sessions: StoredAssistantSession[]
  onSelectSession: (session: StoredAssistantSession) => void
}) {
  if (sessions.length === 0) {
    return (
      <Empty className="border-t border-dashed border-border px-6 py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TerminalSquare />
          </EmptyMedia>
          <EmptyTitle>No terminal sessions yet</EmptyTitle>
          <EmptyDescription>
            New RESEARCH CLI sessions will appear here as they are proxied through Alpha Research.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Session</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => (
          <TableRow
            key={session.id}
            className="cursor-pointer"
            onClick={() => onSelectSession(session)}
          >
            <TableCell className="align-top">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate font-medium">
                  {readableSessionTitle(session.title)}
                </span>
                <span className="text-sm text-muted-foreground">{session.id}</span>
              </div>
            </TableCell>
            <TableCell>
              <StatusBadge>{formatStatus(session.status)}</StatusBadge>
            </TableCell>
            <TableCell>{relativeTime(session.updatedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function SessionArtifactLinks({
  artifacts,
  onOpenArtifact,
}: {
  artifacts: RunArtifactRecord[]
  onOpenArtifact: (artifactId: string) => void
}) {
  if (artifacts.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {artifacts.map((artifact) => (
        <Button
          key={artifact.id}
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-none"
          onClick={() => onOpenArtifact(artifact.id)}
        >
          {artifactPath(artifact)}
        </Button>
      ))}
    </div>
  )
}

function useRunResults(run: RunRecord | null) {
  const [payload, setPayload] = useState<RunResultsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!run) return
    let cancelled = false
    let intervalId: number | undefined

    const load = async () => {
      setLoading(true)
      try {
        const response = await fetchJson<RunResultsResponse>(`/api/cli/runs/${run.id}/results`)
        if (!cancelled) {
          setPayload(response)
          setError(null)
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load run transcript.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    if (!['ready', 'completed', 'failed', 'cancelled', 'canceled', 'error', 'worker_unreachable'].includes(run.status.toLowerCase())) {
      intervalId = window.setInterval(() => void load(), 5000)
    }
    return () => {
      cancelled = true
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [run])

  return { payload, error, loading }
}

function useSessionDetail(sessionId: string | null) {
  const [session, setSession] = useState<StoredAssistantSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sessionId) {
      setSession(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchJson<{ session: StoredAssistantSession; entries: StoredAssistantSessionEntry[] }>(
      `/api/cli/sessions/${sessionId}`,
    )
      .then((response) => {
        if (cancelled) return
        setSession({ ...response.session, entries: response.entries })
        setError(null)
      })
      .catch((fetchError) => {
        if (cancelled) return
        setError(fetchError instanceof Error ? fetchError.message : 'Could not load session.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  return { session, error, loading }
}

function ResearchAssistantPage({
  dataError,
  datasets,
  sessionUser,
  recentSessions,
  onOpenDatasets,
  onOpenRecentWork,
}: {
  dataError?: string | null
  datasets: DatasetRecord[]
  sessionUser: SessionResponse['user']
  recentSessions: Array<{
    id: string
    title: string
    kind: string
    summary: string
  }>
  onOpenDatasets: () => void
  onOpenRecentWork: (sessionId: string) => void
}) {
  const route = useDashboardRoute()
  const activeSessionId = route.sessionId ?? null
  const { session, error, loading } = useSessionDetail(activeSessionId)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [composerError, setComposerError] = useState<string | null>(null)
  const [conversationState, setConversationState] = useState<{
    sessionId: string | null
    previousResponseId: string | null
  }>({
    sessionId: activeSessionId,
    previousResponseId: null,
  })
  const conversationStateRef = useRef(conversationState)
  const routeSessionIdRef = useRef(route.sessionId)
  const refreshSessionMessages = async (sessionId: string) => {
    const response = await fetchJson<{ session: StoredAssistantSession; entries: StoredAssistantSessionEntry[] }>(
      `/api/cli/sessions/${sessionId}`,
    )
    setMessages(sessionEntriesToThreadMessages(response.entries))
    updateConversationState({
      sessionId,
      previousResponseId: extractPreviousResponseId(response.entries),
    })
    return response
  }

  useEffect(() => {
    routeSessionIdRef.current = route.sessionId
  }, [route.sessionId])

  const updateConversationState = (next: {
    sessionId: string | null
    previousResponseId: string | null
  }) => {
    conversationStateRef.current = next
    setConversationState(next)
  }

  useEffect(() => {
    setMessages(sessionEntriesToThreadMessages(session?.entries ?? []))
    updateConversationState({
      sessionId: session?.id ?? activeSessionId,
      previousResponseId: extractPreviousResponseId(session?.entries ?? []),
    })
  }, [activeSessionId, session])

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    onNew: async (message) => {
      const input = extractAppendMessageText(message as unknown as { content?: Array<{ type?: string; text?: string }> })
      if (!input) return

      const optimisticUser: ThreadMessage = {
        id: `local-user-${Date.now()}`,
        role: 'user',
        createdAt: new Date(),
        content: [{ type: 'text', text: input }],
        attachments: [],
        metadata: { custom: {} },
      } as unknown as ThreadMessage

      setMessages((current) => [...current, optimisticUser])
      setIsRunning(true)
      setComposerError(null)

      try {
        const currentConversation = conversationStateRef.current
        const currentSessionId = currentConversation.sessionId ?? routeSessionIdRef.current
        let refreshInterval: number | null = null
        if (currentSessionId) {
          refreshInterval = window.setInterval(() => {
            void refreshSessionMessages(currentSessionId).catch(() => undefined)
          }, 1200)
        }
        const result = await postAssistantTurn({
          input,
          sessionId: currentSessionId,
          previousResponseId: currentConversation.previousResponseId,
        }).finally(() => {
          if (refreshInterval) {
            window.clearInterval(refreshInterval)
          }
        })
        const nextSessionId = result.sessionId ?? currentSessionId
        updateConversationState({
          sessionId: nextSessionId,
          previousResponseId: result.previousResponseId,
        })
        if (nextSessionId) {
          await refreshSessionMessages(nextSessionId)
          window.dispatchEvent(new CustomEvent('alpha-research-dashboard-refresh'))
          if (routeSessionIdRef.current !== nextSessionId) {
            updateDashboardRoute({ view: 'assistant', sessionId: nextSessionId, runId: null })
            routeSessionIdRef.current = nextSessionId
          }
        }
      } catch (submitError) {
        const messageText =
          submitError instanceof Error ? submitError.message : 'Could not reach the RESEARCH backend.'
        setComposerError(messageText)
        const failureMessage: ThreadMessage = {
          id: `local-assistant-error-${Date.now()}`,
          role: 'assistant',
          createdAt: new Date(),
          content: [{ type: 'text', text: messageText }],
          attachments: [],
          status: { type: 'complete', reason: 'unknown' },
          metadata: { custom: {} },
        } as unknown as ThreadMessage
        setMessages((current) => [...current, failureMessage])
      } finally {
        setIsRunning(false)
      }
    },
  })

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-6 md:px-8">
      {dataError ? (
        <Card className="mb-4 rounded-none border border-destructive/25 bg-destructive/5 py-0 shadow-none">
          <CardContent className="px-6 py-4 text-sm text-destructive">{dataError}</CardContent>
        </Card>
      ) : null}
      {composerError ? (
        <Card className="mb-4 rounded-none border border-destructive/25 bg-destructive/5 py-0 shadow-none">
          <CardContent className="px-6 py-4 text-sm text-destructive">{composerError}</CardContent>
        </Card>
      ) : null}
      {error && !session ? (
        <Card className="mb-4 rounded-none border border-destructive/25 bg-destructive/5 py-0 shadow-none">
          <CardContent className="px-6 py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}
      <div className="min-h-0 flex-1 overflow-hidden">
        <AssistantRuntimeProvider runtime={runtime}>
          <div className="h-full min-h-0">
            <Thread
              welcomeTitle={loading ? '' : 'Research workspace'}
              welcomeDescription={loading ? '' : 'Start with chat, browse datasets, or reopen recent work.'}
              welcomePanel={loading ? null : (
                <AssistantOrientationPanel
                  email={sessionUser?.email ?? 'Signed in'}
                  datasetCount={datasets.length}
                  recentSessions={recentSessions}
                  onOpenDatasets={onOpenDatasets}
                  onOpenRecentWork={onOpenRecentWork}
                />
              )}
              composerPlaceholder="Start a new research chat by asking a question or describing the data you need..."
              datasets={datasets.map((dataset) => ({
                id: dataset.id,
                name: dataset.name,
                description: dataset.description || dataset.sourceFilename,
                status: dataset.status,
              }))}
            />
          </div>
        </AssistantRuntimeProvider>
      </div>
    </main>
  )
}

function AssistantOrientationPanel({
  email,
  datasetCount,
  recentSessions,
  onOpenDatasets,
  onOpenRecentWork,
}: {
  email: string
  datasetCount: number
  recentSessions: Array<{
    id: string
    title: string
    kind: string
    summary: string
  }>
  onOpenDatasets: () => void
  onOpenRecentWork: (sessionId: string) => void
}) {
  const topSessions = recentSessions.slice(0, 2)

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <Badge variant="secondary" className="gap-2 text-emerald-700">
          <CheckCircle2 className="size-3.5" />
          Signed in
        </Badge>
        <span>{email}</span>
      </div>
      <div className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
          Start a new research chat.
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
          Ask a question in chat when you want the assistant to plan research, inspect data, or propose the next run. Use datasets to inspect source material. Reopen recent work when you want to continue something you already started.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="rounded-[24px] border border-border/70 bg-card/80 py-0 shadow-none">
          <CardContent className="flex flex-col gap-5 px-6 py-6">
            <div className="space-y-2">
              <Badge variant="secondary">Start here</Badge>
              <h2 className="text-2xl font-semibold tracking-normal">Ask the assistant to help you research</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                The chat below is the main entry point. Start with a question, a topic, or the dataset you want help with. The assistant can clarify the task before it launches work.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label=\"Message input\"]')?.focus()}
              >
                Start a new research chat
              </Button>
              <Button type="button" variant="outline" onClick={onOpenDatasets}>
                Browse datasets
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Card className="rounded-[24px] border border-border/70 bg-card/80 py-0 shadow-none">
            <CardContent className="px-6 py-6">
              <div className="flex items-start gap-3">
                <Database className="mt-0.5 size-5 text-muted-foreground" />
                <div className="space-y-2">
                  <h2 className="text-base font-semibold tracking-normal">Datasets</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {datasetCount} dataset{datasetCount === 1 ? '' : 's'} available. Use datasets to inspect source material, readiness, and briefings before you ask a deeper question.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[24px] border border-border/70 bg-card/80 py-0 shadow-none">
            <CardContent className="px-6 py-6">
              <div className="flex items-start gap-3">
                <History className="mt-0.5 size-5 text-muted-foreground" />
                <div className="min-w-0 flex-1 space-y-2">
                  <h2 className="text-base font-semibold tracking-normal">Recent work</h2>
                  {topSessions.length > 0 ? (
                    <div className="space-y-3">
                      {topSessions.map((recentSession) => (
                        <button
                          key={recentSession.id}
                          type="button"
                          className="block w-full rounded-xl border border-border/70 px-3 py-3 text-left transition-colors hover:bg-muted/50"
                          onClick={() => onOpenRecentWork(recentSession.id)}
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{readableSessionKind(recentSession.kind)}</Badge>
                            <span className="truncate text-sm font-medium text-foreground">{recentSession.title}</span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{recentSession.summary}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-muted-foreground">
                      No prior work yet. Start with chat or browse datasets for source material.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

function RunArtifactsPanel({
  open,
  onClose,
  requestedArtifacts,
  producedArtifacts,
  selectedArtifactId,
  onSelectArtifact,
  remoteSessionId,
  primaryArtifactId,
  profileArtifactId,
}: {
  open: boolean
  onClose: () => void
  requestedArtifacts: Array<Record<string, unknown>>
  producedArtifacts: RunArtifactRecord[]
  selectedArtifactId: string | null
  onSelectArtifact: (artifactId: string) => void
  remoteSessionId: string | null
  primaryArtifactId: string | null
  profileArtifactId: string | null
}) {
  const panelRef = useRef<HTMLElement | null>(null)
  const [panelWidth, setPanelWidth] = useState(900)
  const [treeWidth, setTreeWidth] = useState(360)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(['']))
  const visibleArtifacts = producedArtifacts.filter(
    (artifact) => artifact.type !== 'remote_agent_session',
  )
  const tree = useMemo(() => buildArtifactFileTree(visibleArtifacts), [visibleArtifacts])
  const selectedArtifact =
    visibleArtifacts.find((artifact) => artifact.id === selectedArtifactId) ??
    visibleArtifacts[0] ??
    null
  const selectedPath = selectedArtifact ? artifactPath(selectedArtifact) : null

  useEffect(() => {
    setExpandedPaths((current) => {
      const next = new Set(current)
      for (const artifact of visibleArtifacts) {
        const parts = artifactPath(artifact).split('/').filter(Boolean)
        if (parts.length <= 1) continue
        for (let index = 1; index < parts.length; index += 1) {
          next.add(parts.slice(0, index).join('/'))
        }
      }
      return next
    })
  }, [visibleArtifacts])

  const beginPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelWidth
    const onPointerMove = (moveEvent: PointerEvent) => {
      const next = Math.min(Math.max(startWidth - (moveEvent.clientX - startX), 600), window.innerWidth - 280)
      setPanelWidth(next)
    }
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const beginTreeResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = treeWidth
    const onPointerMove = (moveEvent: PointerEvent) => {
      const containerWidth = panelRef.current?.clientWidth ?? panelWidth
      const next = Math.min(Math.max(startWidth - (moveEvent.clientX - startX), 260), containerWidth - 360)
      setTreeWidth(next)
    }
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const toggleExpanded = (path: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const renderTreeNode = (node: FileTreeNode, depth = 0): ReactNode => {
    const children = Array.from(node.children.values()).sort((a, b) => {
      if (a.artifact && !b.artifact) return 1
      if (!a.artifact && b.artifact) return -1
      return a.name.localeCompare(b.name)
    })
    const isExpanded = expandedPaths.has(node.path)
    const isDirectory = children.length > 0 && !node.artifact
    if (node.path === '') {
      return children.map((child) => renderTreeNode(child, depth))
    }
    if (isDirectory) {
      return (
        <div key={node.path}>
          <button
            type="button"
            className="flex h-10 w-full min-w-0 items-center gap-3 px-2 text-left text-[1.08rem] leading-none hover:bg-muted"
            style={{ paddingLeft: `${20 + depth * 18}px` }}
            onClick={() => toggleExpanded(node.path)}
          >
            {isExpanded ? <ChevronDown className="size-5 text-muted-foreground" /> : <ChevronRight className="size-5 text-muted-foreground" />}
            {isExpanded ? <FolderOpen className="size-5 text-muted-foreground" /> : <Folder className="size-5 text-muted-foreground" />}
            <span className="truncate">{node.name}</span>
          </button>
          {isExpanded ? children.map((child) => renderTreeNode(child, depth + 1)) : null}
        </div>
      )
    }
    return (
      <button
        key={node.path}
        type="button"
        className={[
          'flex min-h-14 w-full min-w-0 items-center gap-4 px-3 py-2 text-left hover:bg-muted',
          selectedPath === node.path ? 'bg-primary/10 font-semibold ring-1 ring-primary/20' : '',
        ].join(' ')}
        style={{ paddingLeft: `${24 + depth * 18}px` }}
        onClick={() => node.artifact && onSelectArtifact(node.artifact.id)}
      >
        {fileIconFor(node.path, node.artifact)}
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[1rem] leading-5">{node.name}</div>
            {node.artifact ? (
              <div className="truncate text-xs text-muted-foreground">
                {artifactRoleMeta(node.artifact, primaryArtifactId, profileArtifactId).description}
              </div>
            ) : null}
          </div>
          {node.artifact ? (
            <Badge
              variant={selectedPath === node.path ? 'default' : 'secondary'}
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] tracking-[0.12em]"
            >
              {artifactRoleMeta(node.artifact, primaryArtifactId, profileArtifactId).label}
            </Badge>
          ) : null}
        </div>
      </button>
    )
  }

  if (!open) {
    return null
  }

  return (
    <aside
      ref={panelRef}
      className="relative flex h-full min-h-0 w-full shrink-0 border-l border-border bg-background md:w-[var(--run-panel-width)]"
      style={{ '--run-panel-width': `${panelWidth}px` } as CSSProperties}
      aria-label="Run artifacts"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        className="absolute -left-1 top-0 z-20 flex h-full w-2 cursor-col-resize items-center justify-center hover:bg-primary/10"
        onPointerDown={beginPanelResize}
      >
        <GripVertical className="size-3 text-muted-foreground/50" />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_8px_var(--tree-width)]" style={{ '--tree-width': `${treeWidth}px` } as CSSProperties}>
        <FilePreview
          artifact={selectedArtifact}
          remoteSessionId={remoteSessionId}
          primaryArtifactId={primaryArtifactId}
          profileArtifactId={profileArtifactId}
        />
        <div
          role="separator"
          aria-orientation="vertical"
          className="flex cursor-col-resize items-center justify-center border-x border-border bg-background hover:bg-primary/10"
          onPointerDown={beginTreeResize}
        >
          <GripVertical className="size-3 text-muted-foreground/50" />
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-7">
            <div>
              <div className="truncate text-xl font-semibold tracking-normal">Artifacts</div>
              <div className="text-xs text-muted-foreground">Answer first, then structured and supporting files.</div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {requestedArtifacts.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {visibleArtifacts.length}/{requestedArtifacts.length}
                </span>
              ) : null}
              <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close files">
                <X className="size-5" />
              </Button>
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto py-5">
            {visibleArtifacts.length > 0 ? renderTreeNode(tree) : (
              <div className="px-7 py-3 text-sm text-muted-foreground">No produced files yet.</div>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}

function FilePreview({
  artifact,
  remoteSessionId,
  primaryArtifactId,
  profileArtifactId,
}: {
  artifact: RunArtifactRecord | null
  remoteSessionId: string | null
  primaryArtifactId: string | null
  profileArtifactId: string | null
}) {
  if (!artifact) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-7">
          <div className="flex min-w-0 items-center gap-3 text-muted-foreground">
            <FileText className="size-5" />
            <span className="text-lg">No file selected</span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Select a file to preview it here.
        </div>
      </div>
    )
  }

  const path = artifactPath(artifact)
  const language = artifactLanguage(path, artifact)
  const text = artifactText(artifact)
  const role = artifactRoleMeta(artifact, primaryArtifactId, profileArtifactId)

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <div className="truncate text-base font-semibold">{path}</div>
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] tracking-[0.12em]">
              {role.label}
            </Badge>
          </div>
          <div className="truncate text-xs text-muted-foreground">{role.description}</div>
        </div>
        {remoteSessionId ? (
          <a
            href={`https://chatgpt.com/codex/s/${remoteSessionId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Remote session
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
      {artifact.url ? (
        <iframe title={artifact.title} src={artifact.url} className="min-h-0 flex-1 bg-background" />
      ) : language === 'markdown' ? (
        <article className="min-h-0 flex-1 overflow-auto px-8 py-8">
          <div className="max-w-[38rem]">
            {renderPreviewMarkdown(text)}
          </div>
        </article>
      ) : (
        <pre className="min-h-0 flex-1 overflow-auto px-8 py-6 text-[0.9rem] leading-6 text-neutral-700">
          {language === 'json' ? artifactJsonPreview(artifact) : text}
        </pre>
      )}
    </div>
  )
}

function RunDetailPage({
  run,
  dataset,
}: {
  run: RunRecord
  dataset: DatasetRecord | undefined
}) {
  const { payload, error, loading } = useRunResults(run)
  const [artifactsOpen, setArtifactsOpen] = useState(false)
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null)
  const remoteSessionId = getRemoteSessionId(payload?.artifacts ?? [])
  const hasRemoteLogs = useMemo(() => hasRemoteRunLogs(payload), [payload])
  const requestedArtifacts = useMemo(() => getRequestedArtifacts(payload), [payload])
  const producedArtifacts = useMemo(() => getProducedArtifacts(payload), [payload])
  const cliMessages = useMemo(() => buildCliTranscript(run, dataset, payload), [run, dataset, payload])
  const remoteMessages = useMemo(() => buildRemoteTranscript(run, dataset, payload), [run, dataset, payload])
  const observedProgressMessages = useMemo(() => buildObservedProgressTranscript(payload), [payload])
  const visibleProducedArtifacts = useMemo(
    () => producedArtifacts.filter((artifact) => artifact.type !== 'remote_agent_session'),
    [producedArtifacts],
  )
  const primaryBriefingArtifact = useMemo(
    () => getDatasetBriefingArtifact(visibleProducedArtifacts),
    [visibleProducedArtifacts],
  )
  const primaryProfileArtifact = useMemo(
    () => getDatasetProfileArtifact(visibleProducedArtifacts),
    [visibleProducedArtifacts],
  )
  const expectedArtifactNames = useMemo(() => {
    const requested = requestedArtifacts
      .map((artifact) =>
        typeof artifact.title === 'string'
          ? artifact.title
          : typeof artifact.type === 'string'
            ? formatStatus(artifact.type)
            : null,
      )
      .filter((value): value is string => Boolean(value))
    return requested.length > 0 ? requested : ['Dataset Briefing', 'Dataset Profile']
  }, [requestedArtifacts])
  const transcriptEntries = useMemo(
    () => (hasRemoteLogs ? [...observedProgressMessages, ...remoteMessages] : cliMessages),
    [cliMessages, hasRemoteLogs, observedProgressMessages, remoteMessages],
  )
  const artifactCount = visibleProducedArtifacts.length
  const isDescribeRun = run.type === 'describe'
  const isCompletedRun = isTerminalSuccessfulRun(run)
  const isRunningRun = run.status.toLowerCase() === 'running'
  const runningSummary = useMemo(
    () => (isRunningRun ? buildRunningRunSummary(run, payload, dataset) : null),
    [dataset, isRunningRun, payload, run],
  )
  const supportingArtifactCount = visibleProducedArtifacts.filter(
    (artifact) => artifact.id !== primaryBriefingArtifact?.id && artifact.id !== primaryProfileArtifact?.id,
  ).length
  const primaryArtifactName = primaryBriefingArtifact ? artifactPath(primaryBriefingArtifact) : null
  const describeStatusTitle = run.status === 'running'
    ? 'Generating dataset briefing'
    : ['ready', 'completed'].includes(run.status)
      ? 'Dataset briefing ready'
      : `${formatStatus(run.status)} dataset briefing run`
  const describeStatusCopy = run.status === 'running'
    ? 'Alpha Research is inspecting the dataset and writing durable documentation. Stay on this run to watch progress and open the generated briefing when it lands.'
    : ['ready', 'completed'].includes(run.status)
      ? 'The documentation run finished. Open the briefing artifact for the durable write-up, then use the profile artifact for the structured summary.'
      : run.outputPreview || 'This describe run did not complete normally. Inspect the transcript and artifacts for recovery details.'

  useEffect(() => {
    const selectedArtifactStillExists = visibleProducedArtifacts.some(
      (artifact) => artifact.id === selectedArtifactId,
    )
    if (!selectedArtifactStillExists) {
      setSelectedArtifactId(visibleProducedArtifacts[0]?.id ?? null)
    }
  }, [selectedArtifactId, visibleProducedArtifacts])

  return (
    <div className="flex min-h-0 flex-1 bg-background">
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden px-4 py-6 md:px-8">
        {!artifactsOpen && artifactCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="absolute right-4 top-4 z-30 gap-2 bg-background/95 shadow-sm backdrop-blur md:right-6 md:top-6"
            onClick={() => setArtifactsOpen(true)}
            aria-label={`Open artifacts (${artifactCount})`}
          >
            <FileText className="size-5" />
            <span>Open artifacts ({artifactCount})</span>
          </Button>
        ) : null}

        <div className="mx-auto flex min-h-0 w-full max-w-[46rem] flex-1 flex-col">
          {isCompletedRun && artifactCount > 0 ? (
            <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="size-5 text-emerald-700" aria-hidden="true" />
                  <h2 className="text-xl font-semibold tracking-normal">Run finished</h2>
                  <StatusBadge>{formatStatus(run.status)}</StatusBadge>
                </div>
                <p className="text-sm leading-6 text-foreground/80">
                  {primaryArtifactName
                    ? `Read ${primaryArtifactName} for the answer first. ${primaryProfileArtifact ? `${artifactPath(primaryProfileArtifact)} is the machine-readable companion.` : 'Supporting files stay attached to this run as artifacts.'}`
                    : 'Artifacts from the finished run are attached here.'}
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-emerald-200 bg-background px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Primary result</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">{primaryArtifactName ?? 'No primary answer file detected yet.'}</div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-background px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Structured companion</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">
                      {primaryProfileArtifact ? artifactPath(primaryProfileArtifact) : 'No machine-readable companion detected.'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-background px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Supporting files</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">
                      {supportingArtifactCount} supporting file{supportingArtifactCount === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {primaryBriefingArtifact ? (
                    <Button
                      type="button"
                      onClick={() => {
                        setSelectedArtifactId(primaryBriefingArtifact.id)
                        setArtifactsOpen(true)
                      }}
                    >
                      Open answer
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" onClick={() => setArtifactsOpen(true)}>
                    Open artifacts ({artifactCount})
                  </Button>
                </div>
              </div>
            </section>
          ) : null}
          {isRunningRun && runningSummary ? (
            <section className="mb-6 rounded-2xl border border-sky-200 bg-sky-50/70 p-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <LoaderCircle className="size-5 animate-spin text-sky-700" aria-hidden="true" />
                    <h2 className="text-xl font-semibold tracking-normal">{runningSummary.title}</h2>
                    <StatusBadge>{formatStatus(run.status)}</StatusBadge>
                  </div>
                  <p className="text-sm leading-6 text-foreground/80">
                    {runningSummary.currentActivity}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-sky-200 bg-background px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Last update</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">{relativeTime(runningSummary.lastActivityAt)}</div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {formatDateTime(runningSummary.lastActivityAt)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-sky-200 bg-background px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Refresh</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">Auto-refreshing every 5 seconds</div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      You do not need to refresh this page manually.
                    </p>
                  </div>
                  <div className="rounded-xl border border-sky-200 bg-background px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Action needed</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">None right now</div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Safe to leave this open while the run continues.
                    </p>
                  </div>
                </div>
                {runningSummary.previousActivity ? (
                  <div className="rounded-xl border border-sky-200 bg-background px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Just before this</div>
                    <p className="mt-2 text-sm leading-6 text-foreground/85">{runningSummary.previousActivity}</p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
          {isDescribeRun ? (
            <section className="mb-6 rounded-2xl border border-border bg-muted/20 p-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold tracking-normal">{describeStatusTitle}</h2>
                    <StatusBadge>{formatStatus(run.status)}</StatusBadge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{describeStatusCopy}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Destination</div>
                    <p className="mt-2 text-sm leading-6 text-foreground/85">
                      The durable briefing stays attached to this run as an artifact and also updates the dataset detail page.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Expected artifacts</div>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-foreground/85">
                      {expectedArtifactNames.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {primaryBriefingArtifact ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedArtifactId(primaryBriefingArtifact.id)
                        setArtifactsOpen(true)
                      }}
                    >
                      Open briefing artifact
                    </Button>
                  ) : null}
                  {primaryProfileArtifact ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedArtifactId(primaryProfileArtifact.id)
                        setArtifactsOpen(true)
                      }}
                    >
                      Open profile artifact
                    </Button>
                  ) : null}
                  {!primaryBriefingArtifact && artifactCount > 0 ? (
                    <Button type="button" variant="outline" onClick={() => setArtifactsOpen(true)}>
                      Open artifacts
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}
          {error ? (
            <div className="mb-4 w-full bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Could not load run transcript: {error}
            </div>
          ) : null}
          {loading ? (
            <div className="mb-2 flex justify-end text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-label="Refreshing run" />
            </div>
          ) : null}
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Observed progress and transcript</h2>
                <p className="text-sm text-muted-foreground">
                  {isCompletedRun
                    ? 'These entries show how the run executed. The answer and file outputs are summarized above.'
                    : isRunningRun && runningSummary
                      ? `${runningSummary.statusDetail} Technical details stay below while artifacts and final results are still being produced.`
                      : 'Watch run progress here while artifacts and final results are still being produced.'}
                </p>
              </div>
            </div>
            <AssistantTranscript
              entries={transcriptEntries}
              emptyTitle="No run transcript yet"
              emptyDescription="Persisted run turns and events will appear here."
              unframed
            />
          </section>
        </div>
      </div>

      <RunArtifactsPanel
        open={artifactsOpen}
        onClose={() => setArtifactsOpen(false)}
        requestedArtifacts={requestedArtifacts}
        producedArtifacts={producedArtifacts}
        selectedArtifactId={selectedArtifactId}
        onSelectArtifact={setSelectedArtifactId}
        remoteSessionId={remoteSessionId}
        primaryArtifactId={primaryBriefingArtifact?.id ?? null}
        profileArtifactId={primaryProfileArtifact?.id ?? null}
      />
    </div>
  )
}

function SessionDetailPage({
  sessionId,
  run,
  dataset,
}: {
  sessionId: string
  run: RunRecord | null
  dataset: DatasetRecord | undefined
}) {
  const { session, error, loading } = useSessionDetail(sessionId)
  const { payload } = useRunResults(run)
  const [artifactsOpen, setArtifactsOpen] = useState(false)
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null)
  const entries = (session?.entries ?? []).map((entry) =>
    createSessionEntry(
      entry.id,
      entry.role === 'user' ? 'user' : entry.role === 'system' ? 'system' : 'assistant',
      entry.createdAt,
      entry.content,
      entry.title ?? formatStatus(entry.kind),
      entry.metadata,
    ),
  )
  const sessionRun = payload?.run ?? run ?? null
  const linkedArtifacts = useMemo(
    () => (payload?.artifacts ?? []).filter((artifact) => artifact.type !== 'remote_agent_session'),
    [payload?.artifacts],
  )
  const primaryArtifactCandidates = useMemo(
    () => linkedArtifacts.filter((artifact) => {
      const path = artifactPath(artifact)
      return path.endsWith('summary.md') || path.endsWith('result.json')
    }),
    [linkedArtifacts],
  )

  useEffect(() => {
    if (selectedArtifactId) return
    if (primaryArtifactCandidates.length === 0) return
    setSelectedArtifactId(primaryArtifactCandidates[0]?.id ?? null)
  }, [primaryArtifactCandidates, selectedArtifactId])

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 md:px-8">
        {error ? (
          <div className="mx-auto mb-4 w-full max-w-[46rem] bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Could not load terminal session: {error}
          </div>
        ) : null}

        <div className="mx-auto flex w-full max-w-[46rem] flex-1 flex-col">
          <section className="mb-5 rounded-none border border-border/70 bg-muted/20 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{readableSessionKind(session?.kind ?? 'remote_codex')}</Badge>
                  <StatusBadge>{sessionStatusDescription(session?.status ?? run?.status ?? null)}</StatusBadge>
                </div>
                <h1 className="mt-3 text-xl font-semibold tracking-normal">
                  {readableSessionTitle(session?.title ?? 'Remote session')}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {sessionRun
                    ? `This transcript belongs to the ${formatStatus(sessionRun.type)} run${dataset ? ` for ${dataset.name}` : ''}. Review the command trail here and open artifacts when you need the durable outputs.`
                    : 'This transcript shows the persisted command trail for a remote research session.'}
                </p>
              </div>
              <div className="min-w-[12rem] space-y-2 text-sm">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Last activity</div>
                  <div className="mt-1 font-medium text-foreground">{relativeTime(session?.updatedAt ?? run?.updatedAt ?? '')}</div>
                  <div className="text-muted-foreground">{formatDateTime(session?.updatedAt ?? run?.updatedAt ?? '')}</div>
                </div>
                {sessionRun ? (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Run</div>
                    <div className="mt-1 font-medium text-foreground">{formatStatus(sessionRun.type)}</div>
                  </div>
                ) : null}
              </div>
            </div>
            {primaryArtifactCandidates.length > 0 ? (
              <div className="mt-4 border-t border-border/70 pt-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Outputs from this session
                </div>
                <SessionArtifactLinks artifacts={primaryArtifactCandidates} onOpenArtifact={(artifactId) => {
                  setSelectedArtifactId(artifactId)
                  setArtifactsOpen(true)
                }} />
              </div>
            ) : null}
          </section>
          {loading ? (
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-label="Loading terminal session" />
              <span>Syncing transcript…</span>
            </div>
          ) : null}
          <AssistantTranscript
            entries={entries}
            emptyTitle="Transcript syncing"
            emptyDescription="This session is connected to a run and is still collecting terminal turns. Check back here for command output and agent updates."
            unframed
          />
        </div>
      </div>
      <RunArtifactsPanel
        open={artifactsOpen}
        onClose={() => setArtifactsOpen(false)}
        requestedArtifacts={[]}
        producedArtifacts={linkedArtifacts}
        selectedArtifactId={selectedArtifactId}
        onSelectArtifact={setSelectedArtifactId}
        remoteSessionId={null}
        primaryArtifactId={primaryArtifactCandidates.find((artifact) => artifactPath(artifact).endsWith('summary.md'))?.id ?? null}
        profileArtifactId={primaryArtifactCandidates.find((artifact) => artifactPath(artifact).endsWith('result.json'))?.id ?? null}
      />
    </div>
  )
}

function DashboardLoading() {
  return (
    <DashboardApp
      session={{
        authenticated: true,
        configured: true,
        user: { email: 'Signed in' },
      }}
      datasets={[]}
      runs={[]}
      sessions={[]}
    />
  )
}

function DashboardSignedOut({
  session,
}: {
  session: SessionResponse
}) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
          <img
            className="block h-[29px] w-36 object-contain object-left"
            src="/alpha-research-wordmark.png"
            alt="Alpha Research"
            width="1505"
            height="300"
          />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Chats</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    <span>New chat</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Database />
                <span>Datasets</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-hidden overscroll-none bg-background">
        <div className="flex h-svh min-h-0 flex-col overflow-hidden overscroll-none">
          <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-6 md:px-8">
            <Empty className="border-0 px-8 py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bot />
                </EmptyMedia>
                <EmptyTitle>Sign in to open your workspace</EmptyTitle>
                <EmptyDescription>
                  {session.configured
                    ? 'Sign in to start a RESEARCH CLI session and view your datasets, runs, and terminal history.'
                    : session.error ?? 'Auth is not configured on this deployment.'}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={beginDashboardLogin} disabled={!session.configured}>
                  Sign in
                </Button>
              </EmptyContent>
            </Empty>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function DashboardApp({
  session,
  datasets,
  runs,
  sessions,
  dataError,
}: {
  session: SessionResponse
  datasets: DatasetRecord[]
  runs: RunRecord[]
  sessions: StoredAssistantSession[]
  dataError?: string | null
}) {
  const datasetLookup = useMemo(
    () => new Map(datasets.map((dataset) => [dataset.id, dataset])),
    [datasets],
  )
  const runLookup = useMemo(
    () => new Map(runs.map((run) => [run.id, run])),
    [runs],
  )
  const route = useDashboardRoute()
  const recentAssistantSessions = useMemo(
    () => sessions.map((currentSession) => ({
      ...currentSession,
      dataset: currentSession.datasetId ? datasetLookup.get(currentSession.datasetId) : undefined,
      run: currentSession.runId ? runLookup.get(currentSession.runId) : undefined,
    })),
    [datasetLookup, runLookup, sessions],
  )

  const activeRun = route.runId ? runs.find((run) => run.id === route.runId) ?? null : null
  const activeDataset = route.datasetId ? datasets.find((dataset) => dataset.id === route.datasetId) ?? null : null
  const showResearchChats = !(
    (route.view === 'datasets' && activeDataset) ||
    (route.view === 'runs' && !activeRun)
  )

  let content: ReactNode

  if (route.view === 'runs' && activeRun) {
    content = <RunDetailPage run={activeRun} dataset={datasetLookup.get(activeRun.datasetId)} />
  } else if (route.view === 'terminal-sessions' && route.sessionId) {
    const activeSession = sessions.find((currentSession) => currentSession.id === route.sessionId) ?? null
    const activeSessionRun = activeSession?.runId ? runLookup.get(activeSession.runId) ?? null : null
    const activeSessionDataset = activeSession?.datasetId ? datasetLookup.get(activeSession.datasetId) : undefined
    content = <SessionDetailPage sessionId={route.sessionId} run={activeSessionRun} dataset={activeSessionDataset} />
  } else if (route.view === 'datasets' && activeDataset) {
    content = (
      <DatasetDetailPage
        dataset={activeDataset}
        runs={runs}
        onBack={() => updateDashboardRoute({ view: 'datasets', datasetId: null, runId: null, sessionId: null })}
        onOpenRun={(run) => updateDashboardRoute({ view: 'runs', runId: run.id, datasetId: null, sessionId: null })}
      />
    )
  } else if (route.view === 'datasets' && route.datasetId && !dataError) {
    content = <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-8" />
  } else if (route.view === 'datasets') {
    content = (
      <main className="flex flex-1 min-w-0 flex-col gap-10 overflow-y-auto px-4 py-10 md:px-8">
        {dataError ? (
          <Card className="rounded-none border border-destructive/25 bg-destructive/5 py-0 shadow-none">
            <CardContent className="px-6 py-4 text-sm text-destructive">{dataError}</CardContent>
          </Card>
        ) : null}
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-normal">Datasets</h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            See what data is available, what each dataset covers, and whether it is ready to use. Open any dataset for provenance, schema, profile details, and generated briefings.
          </p>
        </section>
        <section>
          <DatasetFeed
            datasets={datasets}
            onSelectDataset={(dataset) =>
              updateDashboardRoute({
                view: 'datasets',
                datasetId: dataset.id,
                runId: null,
                sessionId: null,
              })}
          />
        </section>
      </main>
    )
  } else if (route.view === 'runs') {
    content = (
      <main className="flex flex-1 min-w-0 flex-col gap-6 px-4 py-6 md:px-8">
        {dataError ? (
          <Card className="rounded-none border border-destructive/25 bg-destructive/5 py-0 shadow-none">
            <CardContent className="px-6 py-4 text-sm text-destructive">{dataError}</CardContent>
          </Card>
        ) : null}
        <section className="flex flex-col gap-3">
          <div className="px-1">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Runs
            </div>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Triage recent work across datasets. Runs that need attention or still have live activity float to the top so you can decide what to open next.
            </p>
          </div>
          <RunTable
            runs={runs}
            datasetLookup={datasetLookup}
            onSelectRun={(run) => updateDashboardRoute({ view: 'runs', runId: run.id, sessionId: null })}
          />
        </section>
      </main>
    )
  } else if (route.view === 'terminal-sessions') {
    content = (
      <main className="flex flex-1 min-w-0 flex-col gap-6 px-4 py-6 md:px-8">
        {dataError ? (
          <Card className="rounded-none border border-destructive/25 bg-destructive/5 py-0 shadow-none">
            <CardContent className="px-6 py-4 text-sm text-destructive">{dataError}</CardContent>
          </Card>
        ) : null}
        <section className="flex flex-col gap-3">
          <div className="px-1">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Terminal sessions
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Persisted RESEARCH CLI sessions proxied through Alpha Research.
            </p>
          </div>
          <SessionTable
            sessions={sessions}
            onSelectSession={(selected) =>
              updateDashboardRoute({
                view: 'terminal-sessions',
                sessionId: selected.id,
                runId: null,
              })}
          />
        </section>
      </main>
    )
  } else {
    content = (
      <ResearchAssistantPage
        dataError={dataError}
        datasets={datasets}
        sessionUser={session.user}
        recentSessions={recentAssistantSessions.map((currentSession) => ({
          id: currentSession.id,
          title: readableSessionTitle(currentSession.title),
          kind: currentSession.kind,
          summary: sessionSummaryLine(currentSession, currentSession.dataset, currentSession.run),
        }))}
        onOpenDatasets={() =>
          updateDashboardRoute({
            view: 'datasets',
            datasetId: null,
            runId: null,
            sessionId: null,
          })}
        onOpenRecentWork={(sessionId) =>
          updateDashboardRoute({
            view: 'assistant',
            sessionId,
            runId: null,
          })}
      />
    )
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
          <a href={rootOrigin} className="flex items-center">
            <img
              className="block h-[29px] w-36 object-contain object-left"
              src="/alpha-research-wordmark.png"
              alt="Alpha Research"
              width="1505"
              height="300"
            />
          </a>
        </SidebarHeader>
        <SidebarContent>
          {showResearchChats ? (
            <SidebarGroup>
              <SidebarGroupLabel>Research chats</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={route.view === 'assistant' && !route.sessionId}
                      onClick={() =>
                        updateDashboardRoute({
                          view: 'assistant',
                          runId: null,
                          sessionId: null,
                        })}
                    >
                      <span>New chat</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {recentAssistantSessions.map((chatSession) => {
                    return (
                      <SidebarMenuItem key={chatSession.id}>
                        <SidebarMenuButton
                          className="h-auto items-start py-2"
                          isActive={route.view === 'assistant' && route.sessionId === chatSession.id}
                          onClick={() =>
                            updateDashboardRoute({
                              view: 'assistant',
                              runId: null,
                              sessionId: chatSession.id,
                            })}
                        >
                          <span className="flex min-w-0 flex-col items-start gap-1">
                            <span className="flex items-center gap-2">
                              <Badge variant="secondary">{readableSessionKind(chatSession.kind)}</Badge>
                              <span className="truncate">
                                {readableSessionTitle(chatSession.title)}
                              </span>
                            </span>
                            <span className="truncate text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
                              {sessionSummaryLine(chatSession, chatSession.dataset, chatSession.run)}
                            </span>
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <SidebarMenu className="mb-2">
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={route.view === 'datasets'}
                onClick={() =>
                  updateDashboardRoute({
                    view: 'datasets',
                    runId: null,
                    sessionId: null,
                  })}
              >
                <Database />
                <span>Datasets</span>
                <span className="ml-auto text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
                  {datasets.length}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="grid h-auto w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-left hover:bg-sidebar-accent/60"
              >
                <div className="flex min-w-0 flex-col items-start pr-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    Signed in
                  </span>
                  <span className="truncate text-base font-normal normal-case tracking-normal text-foreground/90">
                    {session.user?.email ?? 'Signed in'}
                  </span>
                </div>
                <MoreHorizontal className="size-4 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-none">
              <DropdownMenuItem
                onClick={async () => {
                  await fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'same-origin',
                  })
                  window.location.assign(`${dashboardOrigin}?logged_out=1`)
                }}
              >
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-h-0 overflow-hidden overscroll-none bg-background">
        <div className="flex h-svh min-h-0 flex-col overflow-hidden overscroll-none">
          {content}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function useDashboardState() {
  const [state, setState] = useState<
    | { type: 'loading' }
    | { type: 'signed-out'; session: SessionResponse }
    | {
        type: 'ready'
        session: SessionResponse
        datasets: DatasetRecord[]
        runs: RunRecord[]
        sessions: StoredAssistantSession[]
        dataError?: string | null
      }
  >({ type: 'loading' })

  useEffect(() => {
    let cancelled = false
    const loggedOut = locationUrl.searchParams.get('logged_out') === '1'

    async function load() {
      try {
        const session = await fetchSession()

        if (!session.configured) {
          if (!cancelled) {
            setState({ type: 'signed-out', session })
          }
          return
        }

        if (!session.authenticated || !session.user) {
          try {
            const [datasetsPayload, runsPayload, sessionsPayload] = await Promise.all([
              fetchJson<DatasetRecord[] | { datasets: DatasetRecord[] }>('/api/cli/datasets'),
              fetchJson<RunRecord[] | { runs: RunRecord[] }>('/api/cli/runs'),
              fetchJson<StoredAssistantSession[] | { sessions: StoredAssistantSession[] }>(
                '/api/cli/sessions?kind=cli_orchestration',
              ),
            ])
            const datasets = normalizeDatasetsPayload(datasetsPayload)
            const runs = normalizeRunsPayload(runsPayload)
            const sessions = normalizeSessionsPayload(sessionsPayload)

            if (!cancelled) {
              setState({
                type: 'ready',
                session: {
                  authenticated: true,
                  configured: true,
                  user: { email: session.user?.email ?? 'Signed in' },
                },
                datasets: [...datasets].sort((a, b) =>
                  b.updatedAt.localeCompare(a.updatedAt),
                ),
                runs: [...runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
                sessions: [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
              })
            }
            return
          } catch {
            if (!loggedOut) {
              beginDashboardBridge()
              return
            }

            if (!cancelled) {
              setState({ type: 'signed-out', session })
            }
            return
          }
        }

        try {
          const [datasetsPayload, runsPayload, sessionsPayload] = await Promise.all([
            fetchJson<DatasetRecord[] | { datasets: DatasetRecord[] }>('/api/cli/datasets'),
            fetchJson<RunRecord[] | { runs: RunRecord[] }>('/api/cli/runs'),
            fetchJson<StoredAssistantSession[] | { sessions: StoredAssistantSession[] }>(
              '/api/cli/sessions?kind=cli_orchestration',
            ),
          ])
          const datasets = normalizeDatasetsPayload(datasetsPayload)
          const runs = normalizeRunsPayload(runsPayload)
          const sessions = normalizeSessionsPayload(sessionsPayload)

          if (!cancelled) {
            setState({
              type: 'ready',
              session,
              datasets: [...datasets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
              runs: [...runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
              sessions: [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
              dataError: null,
            })
          }
        } catch (error) {
          if (!cancelled) {
            setState({
              type: 'ready',
              session,
              datasets: [],
              runs: [],
              sessions: [],
              dataError:
                error instanceof Error
                  ? `Signed in, but dashboard data could not load: ${error.message}`
                  : 'Signed in, but dashboard data could not load.',
            })
          }
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            type: 'signed-out',
            session: {
              authenticated: false,
              configured: true,
              user: null,
              error:
                error instanceof Error ? error.message : 'Could not load dashboard.',
            },
          })
        }
      }
    }

    void load()
    const handleRefresh = () => {
      void load()
    }
    window.addEventListener('alpha-research-dashboard-refresh', handleRefresh)

    return () => {
      cancelled = true
      window.removeEventListener('alpha-research-dashboard-refresh', handleRefresh)
    }
  }, [])

  return state
}

function DashboardPage() {
  const state = useDashboardState()

  useEffect(() => {
    document.title = 'Research Dashboard | Alpha Research'
    document.documentElement.classList.add('dashboard-scroll-lock')
    document.body.classList.add('dashboard-scroll-lock')

    return () => {
      document.documentElement.classList.remove('dashboard-scroll-lock')
      document.body.classList.remove('dashboard-scroll-lock')
    }
  }, [])

  if (state.type === 'loading') {
    return <DashboardLoading />
  }

  if (state.type === 'signed-out') {
    return <DashboardSignedOut session={state.session} />
  }

  return (
    <DashboardApp
      session={state.session}
      datasets={state.datasets}
      runs={state.runs}
      sessions={state.sessions}
      dataError={state.dataError}
    />
  )
}

function LandingPage() {
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [authError, setAuthError] = useState<string>('')

  useEffect(() => {
    document.title = 'Alpha Research: Open source knowledge bases for all humanity'
    initCal()
    void fetchSession()
      .then((result) => setSession(result))
      .catch(() => setAuthError('Could not reach auth service.'))

    const authErrorParam = locationUrl.searchParams.get('auth_error')
    if (authErrorParam) {
      setAuthError(authErrorParam)
    }

    if (locationUrl.searchParams.get('login') === '1') {
      beginDashboardLogin()
    }
  }, [])

  const authLabel = session?.authenticated && session.user ? 'Dashboard' : 'login'

  return (
    <div className="landing-page">
      <header className="nav-shell">
        <div className="page-wrap nav-wrap">
          <div className="topbar">
            <a className="logo-link" href="/" aria-label="Alpha Research home">
              <img
                className="logo-wordmark"
                src="/alpha-research-wordmark.png"
                alt="Alpha Research logo"
                width="1505"
                height="300"
              />
            </a>

            <nav className="top-links" aria-label="Primary">
              <a className="underlined-link" href="/cli/">RResearch</a>
              <a className="button-small ghost-button" href="/blog/">blog</a>
              <button
                className="button-small ghost-button auth-button"
                type="button"
                data-state={session?.authenticated ? 'authenticated' : 'anonymous'}
                disabled={session?.configured === false}
                onClick={() => {
                  if (session?.authenticated) {
                    beginDashboardBridge()
                  } else {
                    beginMarketingLogin()
                  }
                }}
              >
                {authLabel}
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="content-shell">
        <div className="page-wrap content-wrap">
          <section className="hero-block">
            <div className="backed-by">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/b/b2/Y_Combinator_logo.svg"
                alt="Y Combinator logo"
                className="yc-logo"
              />
              <span>Backed by YCombinator</span>
            </div>

            <h1>Open source, agentic knowledge bases for all of humanity&apos;s knowledge</h1>

            <img
              className="hero-figure-image"
              src="/alpha-research-man.png"
              alt="Illustration for Alpha Research"
              width="1456"
              height="816"
            />

            <div className="hero-lede">
              <p>
                Alpha Research builds open source agentic knowledge bases. Our mission is to help
                knowledge workers work 100x faster. We launched and{' '}
                <a href="https://github.com/zenobia-pay/alphabook" target="_blank" rel="noopener noreferrer">
                  open sourced
                </a>{' '}
                our first platform,{' '}
                <a href="https://alpha-book.org/" target="_blank" rel="noopener noreferrer">
                  Alpha Book
                </a>{' '}
                on a mirror of the Project Gutenberg dataset (75,000 books).
              </p>
              <p>
                Knowledge work is bottlenecked in two key ways: finding evidence and testing
                hypotheses. We make both 100x faster. We extend keyword search and RAG with general
                coding agents, which use filesystem tools like ripgrep and reason iteratively to
                find broad evidence. Coding agents also write ad-hoc scripts to label datasets and
                test hypotheses.
              </p>
              <p>
                Our timeline is simple: repeat Alpha Book across every public dataset of humanity&apos;s
                knowledge. Next we&apos;ll launch Alpha Econ with US Census, BLS, NBER, etc datasets.
                Alpha Justice with US Supreme Court Cases, and so on. We support museums, research
                libraries, historical societies, and archives. We also do custom integration work
                for enterprise.
              </p>
            </div>

            <div className="hero-links">
              <a className="hero-button hero-button-secondary" href="/cli/">
                Bring your own dataset
              </a>
              <button
                type="button"
                className="hero-button"
                data-cal-link="ryan-prendergast-qsp5cw/30min"
                data-cal-namespace="30min"
                data-cal-config='{"layout":"month_view","useSlotsViewOnSmallScreen":"true"}'
              >
                Want a custom integration? Book a call
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m12.75 15 3-3m0 0-3-3m3 3h-7.5"></path>
                  <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path>
                </svg>
              </button>
            </div>
            {authError ? <p className="auth-status" data-state="error">{authError}</p> : null}
          </section>

          <section className="powering-block" id="powering">
            <h2 className="split-heading">
              <span>Powering</span>
            </h2>

            <div className="powering-list">
              <a className="list-row" href="https://alpha-book.org" target="_blank" rel="noopener noreferrer">
                <div className="list-row-top">
                  <span className="list-row-title">Alpha Book</span>
                  <span className="list-row-meta">75,000 public domain books</span>
                </div>
                <span className="list-row-subline">
                  Mirror of Project Gutenberg with 75,000 public domain books and primary sources.
                  Useful for literary research.
                </span>
              </a>

              <a className="list-row" href="https://scenewiki.net" target="_blank" rel="noopener noreferrer">
                <div className="list-row-top">
                  <span className="list-row-title">Scene Wiki</span>
                </div>
                <span className="list-row-subline">
                  Scrape and label an online community and build a wiki for it.
                </span>
              </a>

              <div className="list-row list-row-static">
                <div className="list-row-top">
                  <span className="list-row-title">AlphaEcon</span>
                  <span className="list-row-meta">coming soon</span>
                </div>
                <span className="list-row-subline">
                  Agentic search and test over U.S. Census Bureau, Fannie Mae, BLS, NBER.
                </span>
              </div>

              <div className="list-row list-row-static">
                <div className="list-row-top">
                  <span className="list-row-title">Alpha Justice</span>
                  <span className="list-row-meta">coming soon</span>
                </div>
                <span className="list-row-subline">Every U.S. Supreme Court case.</span>
              </div>
            </div>
          </section>

          <section className="quote-block" id="quote">
            <p className="section-kicker">Knowledge bases allow agents to work like knowledge workers</p>
            <article className="tweet-card">
              <div className="tweet-card-header">
                <img
                  className="tweet-avatar-image"
                  src="https://pbs.twimg.com/profile_images/1296667294148382721/9Pr6XrPB_400x400.jpg"
                  alt="Andrej Karpathy profile photo"
                />
                <div className="tweet-meta">
                  <span className="tweet-author">Andrej Karpathy</span>
                  <a
                    className="tweet-handle"
                    href="https://x.com/karpathy/status/2039805659525644595"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @karpathy
                  </a>
                </div>
              </div>

              <div className="tweet-body">
                <p>
                  Something I&apos;m finding very useful recently: using LLMs to build personal
                  knowledge bases for various topics of research interest. In this way, a large
                  fraction of my recent token throughput is going less into manipulating code, and
                  more into manipulating knowledge (stored as markdown and images)...
                </p>
              </div>
            </article>
          </section>

          <section className="about-block" id="about">
            <h2>When to use Alpha Research</h2>
            <ol className="about-list">
              <li>
                <span className="about-list-title">Search.</span> Looking for evidence? We compile and
                index public plaintext and image datasets for you to access.
              </li>
              <li>
                <span className="about-list-title">Hypothesis testing.</span> Suppose you&apos;re a
                historian. You are writing a thesis on grief in 19th century fiction. Alpha
                Research finds evidence for you. Suppose you&apos;re an economist. You might have a
                thesis &quot;Periods of compressed time-to-sale in housing correlate with above-ask
                transactions and predict mean reversion within 18 months.&quot; Alpha Research runs that
                experiment for you.
              </li>
              <li>
                <span className="about-list-title">Agentic knowledge workers.</span> Autonomous
                research loops that plan → retrieve → filter → synthesize → verify
              </li>
              <li>
                <span className="about-list-title">Fandom, wikis.</span> Online communities have years
                of canon. Drive higher quality engagement and help onboard new members to your
                community by building a knowledge base for a Substack or a podcast.
              </li>
              <li>
                <span className="about-list-title">Alpha Search is open source.</span> We are proud to
                support research institutes, museums, presidential libraries, historical societies,
                and enterprise.
              </li>
            </ol>
          </section>

          <section className="faq-block" id="faq">
            <h2>FAQ</h2>

            <div className="faq-list">
              <details className="faq-item">
                <summary>
                  <span className="faq-summary-copy">What does Alpha Research do?</span>
                  <span className="faq-summary-icon" aria-hidden="true">+</span>
                </summary>
                <p>
                  We build open source tooling for knowledge workers to work faster. The Alpha
                  Research platform enables agentic search and hypothesis testing over large
                  databases. Starting with Project Gutenberg, we are expanding to add datasets in
                  law, economics, history, and every other archived dataset. Our mission is to
                  enable a new wave of quantitative humanities research.
                </p>
              </details>

              <details className="faq-item">
                <summary>
                  <span className="faq-summary-copy">Can I use this on my private dataset?</span>
                  <span className="faq-summary-icon" aria-hidden="true">+</span>
                </summary>
                <p>
                  Yes. Install the RESEARCH CLI above and point it at your own dataset, or book a
                  call <a href="https://cal.com/ryan-prendergast-qsp5cw/30min" target="_blank" rel="noopener noreferrer">here</a> if you want us to help with setup.
                </p>
              </details>

              <details className="faq-item">
                <summary>
                  <span className="faq-summary-copy">What kind of data is it for?</span>
                  <span className="faq-summary-icon" aria-hidden="true">+</span>
                </summary>
                <p>
                  Large datasets of reference text and images. Books, papers, films, photos,
                  scans. Primary sources and archival datasets.
                </p>
              </details>

              <details className="faq-item">
                <summary>
                  <span className="faq-summary-copy">Who do you work with?</span>
                  <span className="faq-summary-icon" aria-hidden="true">+</span>
                </summary>
                <p>
                  Individual researchers can sign up, ask questions, and test hypotheses. We are
                  also proud to support research institutes, museums, presidential libraries,
                  historical societies, and enterprises.
                </p>
              </details>

              <details className="faq-item">
                <summary>
                  <span className="faq-summary-copy">Can my agent use Alpha Book?</span>
                  <span className="faq-summary-icon" aria-hidden="true">+</span>
                </summary>
                <p>
                  Yes! Copy prompt{' '}
                  <code>Go to https://alpha-book.org/skill.md and follow the instructions there.</code>
                </p>
              </details>
            </div>
          </section>
        </div>
      </main>

      <footer className="footer">
        <div className="page-wrap footer-wrap">
          <a className="logo-link" href="/" aria-label="Alpha Research home">
            <img
              className="logo-mark"
              src="/newalpharesearchlogo/apple-touch-icon.png"
              alt="Alpha Research logo"
            />
          </a>

          <div className="footer-copy">
            <div className="footer-links">
              <a href="/cli/">RResearch</a>
              <a href="/blog/">blog</a>
              <a href="/privacy/">privacy</a>
              <a href="/terms/">terms</a>
            </div>
          </div>

          <div className="footer-meta">
            <div>© 2026 Alpha Research</div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  return isDashboardView ? <DashboardPage /> : <LandingPage />
}
