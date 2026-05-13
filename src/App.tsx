import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { AssistantRuntimeProvider, useExternalStoreRuntime, type ThreadMessage } from '@assistant-ui/react'
import {
  AlertTriangle,
  Bot,
  Braces,
  CheckCircle2,
  ChevronRight,
  Database,
  ExternalLink,
  FileText,
  GripVertical,
  History,
  LoaderCircle,
  LogOut,
  MessageSquarePlus,
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
  isHarnessPreparedRunPrompt,
  launchHarnessPreparedRun,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
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
  inventoryCoverage?: string | null
  inventoryFreshness?: string | null
  inventoryLimitations?: string[] | null
  inventoryTopics?: string[] | null
  manifestPath?: string | null
  deploymentStatus: string
  status: string
  activeRunId?: string | null
  leaseAcquiredAt?: string | null
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
const DOCS_ORIGIN = 'https://docs.alpharesearch.nyc'

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

function stripMarkdownForInline(value: string) {
  return value
    .replace(/```[\s\S]*?```/gu, (block) => block.replace(/```[a-z0-9_-]*\n?/iu, '').replace(/```$/u, '').trim())
    .replace(/[#*_`>\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeRawToolOutput(value: string | null | undefined) {
  const text = value?.trim() ?? ''
  if (!text) return false
  return (
    text.includes('function_call_output') ||
    text.includes('"call_id"') ||
    text.includes('"{\\"ok\\":') ||
    text.startsWith('[ { "type":') ||
    text.startsWith('[{"type":') ||
    text.startsWith('{"ok":') ||
    text.startsWith('{ "ok":')
  )
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

function elapsedRunTime(value: string | null | undefined) {
  if (!value) return null
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return null
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (elapsedSeconds < 60) {
    return `Running for ${elapsedSeconds} second${elapsedSeconds === 1 ? '' : 's'}`
  }
  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  return `Running for ${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'}`
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
    return 'Worker Lost Connection'
  }
  if (normalized === 'uploading') {
    return 'Source Uploaded / Processing'
  }
  return value
    .replaceAll(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getRunPriorityMeta(run: RunRecord) {
  const normalized = run.status.toLowerCase()
  if (normalized === 'worker_unreachable') {
    return {
      rank: 0,
      label: 'Needs attention',
      summary: 'Worker stopped responding before the run finished.',
      detail: 'Open the session to inspect logs, partial output, or retry context.',
      actionLabel: 'Inspect recovery',
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
      actionLabel: hasArtifacts ? 'Inspect outputs' : 'Inspect run',
    }
  }
  return {
    rank: 3,
    label: 'Check status',
    summary: formatStatus(run.status),
    detail: 'Open the session for more detail.',
    actionLabel: 'Inspect run',
  }
}

function readableSessionTitle(value: string | null | undefined) {
  const normalized = (value ?? '')
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/^["'#\s]+|["'\s]+$/g, '')
    .replace(/^[-:;,.|/\\\s]+/g, '')
    .replace(/^RESEARCH CLI session$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (looksLikeRawToolOutput(normalized)) return 'Untitled chat'
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

function datasetDetailTrustState(dataset: DatasetRecord, hasBriefing: boolean) {
  const deploymentStatus = dataset.deploymentStatus.toLowerCase()
  const status = dataset.status.toLowerCase()
  const hasMountedData = Boolean(dataset.volume?.mountPath)
  const limitation = dataset.inventoryLimitations?.find((item) => item.trim())?.trim() ?? null

  if (deploymentStatus === 'ready' && status === 'ready') {
    return {
      badge: 'Ready to use',
      headline: 'Current enough to start analysis.',
      tone: 'success' as const,
      explanation: dataset.inventoryReadinessNote ?? 'This dataset is ready for research in its current deployed state.',
      actionState: hasBriefing ? 'Briefing ready' : 'Briefing recommended',
      actionDetail: hasBriefing
        ? 'The latest briefing is available below.'
        : 'Generate a briefing if you want a refreshed summary before analysis.',
    }
  }

  if (deploymentStatus === 'processing' || status === 'running' || status === 'uploading') {
    const blockedByInfrastructure = !hasMountedData
    const blockedReason = blockedByInfrastructure
      ? limitation
        ? `The deployed dataset files are not mounted yet, so the briefing and analysis remain blocked. ${limitation}`
        : 'The deployed dataset files are not mounted yet, so the briefing and analysis remain blocked.'
      : limitation
        ?? 'Schema, coverage, or records may still change while ingestion finishes.'
    return {
      badge: blockedByInfrastructure ? 'Not ready' : 'Processing',
      headline: blockedByInfrastructure ? 'Not ready for analysis yet.' : 'Still processing before it is safe to trust.',
      tone: 'warning' as const,
      explanation: blockedByInfrastructure
        ? 'Alpha Research is still preparing the deployed dataset environment, so the current data cannot be verified yet.'
        : dataset.inventoryReadinessNote ?? 'Alpha Research is still ingesting and validating this dataset.',
      actionState: blockedByInfrastructure ? 'Waiting on dataset environment' : 'Waiting on ingest completion',
      actionDetail: blockedReason,
    }
  }

  if (deploymentStatus === 'failed' || status === 'failed' || status === 'worker_unreachable') {
    return {
      badge: 'Needs review',
      headline: 'Do not trust this dataset until the failure is resolved.',
      tone: 'warning' as const,
      explanation: dataset.inventoryReadinessNote ?? 'Alpha Research hit a dataset preparation problem that needs attention.',
      actionState: 'Blocked by failure',
      actionDetail: limitation ?? 'Open developer details to inspect the failure state before retrying.',
    }
  }

  return {
    badge: 'Checking readiness',
    headline: 'Readiness is still being verified.',
    tone: 'neutral' as const,
    explanation: dataset.inventoryReadinessNote ?? 'Alpha Research is still determining whether this dataset is safe to use.',
    actionState: 'Readiness not confirmed',
    actionDetail: limitation ?? 'Wait for a completed readiness check before you rely on this dataset.',
  }
}

function isTerminalRunStatus(status: string) {
  return ['ready', 'completed', 'failed', 'cancelled', 'canceled', 'error', 'worker_unreachable'].includes(status.toLowerCase())
}

function datasetBlockingRun(dataset: DatasetRecord, runs: RunRecord[], describeRunId: string | null) {
  const activeRun = dataset.activeRunId
    ? runs.find((run) => run.id === dataset.activeRunId)
    : null
  if (activeRun && !isTerminalRunStatus(activeRun.status) && activeRun.id !== describeRunId) {
    return activeRun
  }

  return runs
    .filter((run) => run.datasetId === dataset.id && run.id !== describeRunId && !isTerminalRunStatus(run.status))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
}

function runStatusLabel(run: RunRecord) {
  if (run.type === 'public_environment' || run.type === 'research_environment' || run.type === 'deploy') {
    return 'Environment build in progress'
  }
  return `${formatStatus(run.status)} ${formatStatus(run.type)} run`
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

function datasetQuestionPrompts(dataset: DatasetRecord) {
  const columns = Array.isArray(profileRecord(dataset.profile, 'schema')?.columns)
    ? (profileRecord(dataset.profile, 'schema')?.columns as unknown[])
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .slice(0, 4)
    : []
  const basePrompts = [
    `What patterns should I look at first in ${dataset.name}?`,
    `What question is ${dataset.name} well suited to answer?`,
  ]
  if (columns.length >= 2) {
    basePrompts.unshift(`Using ${columns[0]} and ${columns[1]}, what is a strong first analysis?`)
  }
  return basePrompts.slice(0, 3)
}

function focusAssistantComposer(prompt?: string) {
  const composer = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message input"]')
  if (!composer) return
  composer.focus()
  if (typeof prompt !== 'string') return
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(composer, prompt)
  composer.dispatchEvent(new Event('input', { bubbles: true }))
  composer.setSelectionRange(prompt.length, prompt.length)
}

function normalizeTopicLabel(topic: string) {
  return topic
    .split(/[-_]+/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function topicKeywords(topic: string) {
  return topic
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((value) => value.trim())
    .filter((value) => value.length > 2)
}

function datasetTopicMatchScore(dataset: DatasetRecord, topic: string | null) {
  if (!topic) return 0
  const keywords = topicKeywords(topic)
  if (keywords.length === 0) return 0
  const haystack = [
    dataset.name,
    dataset.description,
    dataset.inventorySummary,
    dataset.inventoryUseCase,
    dataset.inventoryCoverage,
    dataset.inventoryFreshness,
    dataset.inventoryReadinessNote,
    ...(dataset.inventoryTopics ?? []),
    ...(dataset.inventoryLimitations ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  let score = 0
  for (const keyword of keywords) {
    if (haystack.includes(keyword)) score += 2
  }
  if (dataset.status.toLowerCase() === 'ready') score += 3
  if (dataset.deploymentStatus.toLowerCase() === 'ready') score += 2
  if (!isPublicDataset(dataset)) score += 1
  return score
}

function datasetRecommendationReason(dataset: DatasetRecord, topic: string | null) {
  const label = topic ? normalizeTopicLabel(topic) : 'this topic'
  const readiness = datasetInventoryStatus(dataset)
  const useCase = dataset.inventoryUseCase?.replace(/^Best for:\s*/i, '').trim()
  return [
    useCase ? `${useCase}.` : `${dataset.name} is the closest dataset match for ${label}.`,
    dataset.inventoryCoverage ? `Coverage: ${dataset.inventoryCoverage}.` : null,
    `Readiness: ${readiness.label.toLowerCase()}${readiness.detail ? `, ${readiness.detail.charAt(0).toLowerCase()}${readiness.detail.slice(1)}` : ''}`,
  ]
    .filter(Boolean)
    .join(' ')
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
    if (/validating requested fields against the dataset schema/iu.test(detail)) {
      return 'The runner preserved the launch specification and is checking the requested fields against the dataset schema before analysis starts.'
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

function summarizeRunningPhase(activity: string) {
  const trimmed = activity.trim().replace(/[.]+$/u, '')
  if (/fetching public data sources/iu.test(trimmed)) {
    return 'Fetching public data sources'
  }
  if (/validating requested fields/iu.test(trimmed)) {
    return 'Validating requested fields'
  }
  if (/preserved the launch specification/iu.test(trimmed)) {
    return 'Preserving launch specification'
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
  const phase = summarizeRunningPhase(currentActivity)
  const previousActivity = previousEvent ? summarizeActiveRunEvent(previousEvent.message, run) : null

  return {
    title: 'Run is alive',
    statusTitle: `${dataset?.name ?? 'This run'} is still running`,
    phase,
    currentActivity,
    lastActivityAt,
    lastEventLabel: lastEvent?.message?.trim() ?? currentActivity,
    previousActivity,
    statusDetail: `Last meaningful update ${relativeTime(lastActivityAt)}.`,
    actionLabel: artifactCountFromPayload(payload) > 0
      ? 'No action needed unless you want to inspect saved output.'
      : 'No action needed. Alpha Research is still working.',
  }
}

function artifactCountFromPayload(payload: RunResultsResponse | null) {
  return (payload?.artifacts ?? []).filter((artifact) => artifact.type !== 'remote_agent_session').length
}

function isUncertainRunStatus(status: string | null | undefined) {
  const normalized = status?.toLowerCase() ?? ''
  return normalized === 'worker_unreachable' || normalized === 'failed' || normalized === 'error'
}

function summarizeStuckRunEvidence(message: string, run: RunRecord) {
  const trimmed = message.trim()
  if (/worker_unreachable/iu.test(trimmed) || /stopped heartbeating/iu.test(trimmed)) {
    return {
      title: 'Worker lost connection',
      summary: 'The worker stopped responding before it reported whether the run finished.',
      evidence: 'Alpha Research stopped receiving worker heartbeats before any terminal result arrived.',
      recovery: 'This run is now stuck in an uncertain terminal state. Check artifacts or debug details, then retry if you still need the result.',
    }
  }
  if (/timed out/iu.test(trimmed)) {
    return {
      title: 'Run timed out',
      summary: 'The run hit a time limit before it could finish.',
      evidence: trimmed,
      recovery: 'Inspect any artifacts that were produced, then retry with a narrower request if needed.',
    }
  }
  if (run.status.toLowerCase() === 'failed') {
    return {
      title: 'Run failed',
      summary: 'The run stopped before producing a confirmed result.',
      evidence: trimmed,
      recovery: 'Use the debug details below to inspect the failure and retry once the cause is clear.',
    }
  }
  return {
    title: 'Run needs diagnosis',
    summary: run.outputPreview?.trim() || 'This run stopped before the dashboard could confirm a final result.',
    evidence: trimmed,
    recovery: 'Review the latest evidence below, then decide whether to retry or inspect the technical details.',
  }
}

function buildStuckRunSummary(
  run: RunRecord,
  payload: RunResultsResponse | null,
  dataset: DatasetRecord | undefined,
  artifactCount: number,
  expectedArtifactNames: string[],
) {
  const lastEvent = payload?.events.at(-1) ?? null
  const evidenceAt = lastEvent?.createdAt ?? run.updatedAt
  const evidence = lastEvent ? summarizeStuckRunEvidence(lastEvent.message, run) : {
    title: 'Run lost progress updates',
    summary: 'This run stopped updating before Alpha Research could confirm a result.',
    evidence: run.outputPreview?.trim() || 'No terminal evidence beyond the run status is available yet.',
    recovery: 'Inspect debug details, then retry if you still need the answer.',
  }
  const outputsLabel = artifactCount > 0
    ? `${artifactCount} artifact${artifactCount === 1 ? '' : 's'} attached`
    : 'No artifacts recorded'
  const outputsDetail = artifactCount > 0
    ? `You can inspect the saved output${artifactCount === 1 ? '' : 's'} before retrying.`
    : `Alpha Research did not record ${expectedArtifactNames.length === 1 ? expectedArtifactNames[0] : 'the expected outputs'} before the worker stopped responding.`
  const completedLabel = artifactCount > 0
    ? `${artifactCount} saved artifact${artifactCount === 1 ? '' : 's'}`
    : 'No requested outputs completed'
  const missingLabel = expectedArtifactNames.length > 0
    ? expectedArtifactNames.join(', ')
    : 'No expected outputs were listed for this run.'
  const trustLabel = artifactCount > 0
    ? 'Saved artifacts are durable, but the run did not confirm that the full request finished.'
    : 'No durable output was saved before the worker lost contact.'
  const nextStepLabel = artifactCount > 0
    ? 'Inspect the saved artifacts first, then retry only if the missing work still matters.'
    : `Retry the same request for ${dataset?.name ?? 'this dataset'} after reviewing the failure details.`

  return {
    title: evidence.title,
    summary: evidence.summary,
    evidence: evidence.evidence,
    recovery: evidence.recovery,
    evidenceAt,
    outputsLabel,
    outputsDetail,
    completedLabel,
    missingLabel,
    trustLabel,
    nextStepLabel,
    recommendation: artifactCount > 0
      ? 'Inspect the saved artifacts first, then retry only if they do not answer the question.'
      : `Safe next move: retry the same request for ${dataset?.name ?? 'this dataset'} after reviewing the latest evidence.`,
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
          ? <h1 key={`h-${nodes.length}`} className="mt-9 text-3xl font-semibold leading-tight tracking-normal first:mt-0 md:text-4xl">{text}</h1>
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
    plan_remote_run: 'Planned remote run',
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

function humanizeArgumentName(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatArgumentValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null || value === undefined) return 'None'
  if (Array.isArray(value)) {
    return value.map((item) => formatArgumentValue(item)).join(', ')
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${humanizeArgumentName(key)}: ${formatArgumentValue(item)}`)
      .join('; ')
  }
  return String(value)
}

function formatToolArguments(args: Record<string, unknown>) {
  const lines = Object.entries(args).map(([key, value]) => {
    return `- **${humanizeArgumentName(key)}:** ${formatArgumentValue(value)}`
  })
  return lines.length > 0 ? `\n\n**Arguments**\n\n${lines.join('\n')}` : ''
}

function getRequestedArtifacts(payload: RunResultsResponse | null) {
  return Array.isArray(payload?.metadata?.artifactSpec)
    ? (payload?.metadata?.artifactSpec as Array<Record<string, unknown>>)
    : []
}

function requestedArtifactName(artifact: Record<string, unknown>, fallbackIndex: number) {
  if (typeof artifact.title === 'string' && artifact.title.trim()) {
    return artifact.title.trim()
  }
  if (typeof artifact.type === 'string' && artifact.type.trim()) {
    return formatStatus(artifact.type)
  }
  return `Expected output ${fallbackIndex + 1}`
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

function hasArtifactText(artifact: RunArtifactRecord) {
  return typeof artifact.content?.text === 'string' && artifact.content.text.trim().length > 0
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
  if (extension === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension ?? '')) return 'image'
  if (extension === 'css') return 'css'
  return 'text'
}

function isHtmlArtifact(artifact: RunArtifactRecord) {
  const path = artifactPath(artifact).toLowerCase()
  return artifact.type === 'html_report' || path.endsWith('.html') || path.endsWith('.htm')
}

function isRootReportArtifact(artifact: RunArtifactRecord) {
  const path = artifactPath(artifact).replace(/\\/gu, '/').toLowerCase()
  const parts = path.split('/').filter(Boolean)
  const filename = parts.at(-1) ?? ''
  return filename === 'report.html' && artifact.title.toLowerCase() === 'report.html'
}

function isFrameworkTemplateArtifact(artifact: RunArtifactRecord) {
  const path = artifactPath(artifact).replace(/\\/gu, '/').toLowerCase()
  const text = hasArtifactText(artifact) ? artifactText(artifact).slice(0, 2000).toLowerCase() : ''
  return /(^|\/)templates?\//u.test(path)
    || /(^|\/)apps?\/.*\.html$/u.test(path)
    || text.includes('{% extends ')
    || text.includes('{{ formfields')
}

function isMarkdownArtifact(artifact: RunArtifactRecord) {
  const path = artifactPath(artifact).toLowerCase()
  if (artifact.type === 'markdown') return true
  return path.endsWith('.md') || path.endsWith('.markdown')
}

function getDatasetBriefingArtifact(artifacts: RunArtifactRecord[]) {
  const htmlArtifacts = artifacts.filter(isHtmlArtifact)
  const htmlArtifact =
    htmlArtifacts.find((artifact) => isRootReportArtifact(artifact) && (artifact.url || hasArtifactText(artifact)))
    ?? htmlArtifacts.find((artifact) => !isFrameworkTemplateArtifact(artifact) && (artifact.url || hasArtifactText(artifact)))
    ?? htmlArtifacts[0]
  if (htmlArtifact) return htmlArtifact

  return artifacts.find((artifact) => {
    if (!isMarkdownArtifact(artifact)) return false
    const title = artifact.title.toLowerCase()
    const path = artifactPath(artifact).toLowerCase()
    const text = artifactText(artifact)
    return title.includes('briefing') || path.includes('work.md') || text.includes('# Dataset Briefing')
  }) ?? null
}

function getDatasetProfileArtifact(artifacts: RunArtifactRecord[]) {
  return artifacts.find((artifact) => {
    const title = artifact.title.toLowerCase()
    const path = artifactPath(artifact).toLowerCase()
    return artifact.type === 'json' || artifact.type === 'structured_result' || title.includes('profile') || path.endsWith('result.json')
  }) ?? null
}

function artifactSortRank(
  artifact: RunArtifactRecord,
  primaryArtifactId: string | null,
  profileArtifactId: string | null,
) {
  if (artifact.id === primaryArtifactId) return 0
  if (artifact.id === profileArtifactId) return 1
  return 2
}

function artifactDownloadFilename(artifact: RunArtifactRecord) {
  const path = artifactPath(artifact).trim()
  if (path) {
    const parts = path.split('/').filter(Boolean)
    return parts[parts.length - 1] ?? artifact.title
  }
  return artifact.title || 'artifact'
}

function artifactDownloadHref(artifact: RunArtifactRecord) {
  if (artifact.url) return artifact.url
  const path = artifactPath(artifact)
  const language = artifactLanguage(path, artifact)
  if (language === 'pdf' || language === 'image') {
    const base64 = artifact.content?.base64
    if (typeof base64 === 'string' && base64.trim()) {
      const mimeType = typeof artifact.content?.mimeType === 'string'
        ? artifact.content.mimeType
        : language === 'pdf'
          ? 'application/pdf'
          : `image/${path.split('.').pop()?.toLowerCase() === 'jpg' ? 'jpeg' : path.split('.').pop()?.toLowerCase() || 'png'}`
      return `data:${mimeType};base64,${base64.trim()}`
    }
  }
  const body = language === 'json' ? artifactJsonPreview(artifact) : artifactText(artifact)
  const mimeType = language === 'json'
    ? 'application/json;charset=utf-8'
    : language === 'markdown'
      ? 'text/markdown;charset=utf-8'
      : language === 'html'
        ? 'text/html;charset=utf-8'
        : language === 'pdf'
          ? 'application/pdf'
          : language === 'image'
            ? 'application/octet-stream'
        : 'text/plain;charset=utf-8'
  return `data:${mimeType},${encodeURIComponent(body)}`
}

function artifactHtmlHref(artifact: RunArtifactRecord) {
  if (artifact.url) return artifact.url
  if (!hasArtifactText(artifact)) return null
  return artifactDownloadHref(artifact)
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

function stripRawFunctionCallOutputBlock(value: string) {
  if (!value.includes('function_call_output')) return value
  const markerIndex = value.indexOf('function_call_output')
  const blockStart = value.lastIndexOf('[', markerIndex)
  if (blockStart === -1) return value
  return value.slice(0, blockStart).trim()
}

const NAMED_RUN_ID_PATTERN = /\brun-[a-z0-9-]+\b/iu
const EXPLICIT_UUID_RUN_ID_PATTERN =
  /\b(?:run|run id|started run|open run|dashboard)\s*:?\s*(?:`|\[)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/iu

function extractRunIdFromText(value: string | null | undefined) {
  if (!value) return null
  const dashboardRunId = value.match(/[?&]runId=([^&\s)]+)/u)?.[1]
  if (dashboardRunId) {
    try {
      return decodeURIComponent(dashboardRunId)
    } catch {
      return dashboardRunId
    }
  }
  return value.match(NAMED_RUN_ID_PATTERN)?.[0] ?? value.match(EXPLICIT_UUID_RUN_ID_PATTERN)?.[1] ?? null
}

function inferSessionEntryRunId(entry: SessionEntry) {
  if (isRecord(entry.metadata)) {
    if (entry.metadata.plannedRemoteRun === true) {
      return null
    }
    if (typeof entry.metadata.runId === 'string' && entry.metadata.runId.trim()) {
      return entry.metadata.runId.trim()
    }
    const data = entry.metadata.data
    if (isRecord(data)) {
      const nestedRunId =
        isRecord(data.run) && typeof data.run.id === 'string'
          ? data.run.id
          : typeof data.runId === 'string'
            ? data.runId
            : null
      if (nestedRunId?.trim()) return nestedRunId.trim()
    }
  }
  return extractRunIdFromText(entry.body)
}

function formatSessionBody(entry: SessionEntry) {
  const body = stripRawFunctionCallOutputBlock(entry.body)
  const toolName = isRecord(entry.metadata) && typeof entry.metadata.name === 'string'
    ? entry.metadata.name
    : entry.title
  if (entry.title && entry.metadata && isRecord(entry.metadata)) {
    if (entry.title !== 'Assistant' && entry.metadata.name && entry.body.startsWith('Calling ')) {
      const args = isRecord(entry.metadata.arguments) ? entry.metadata.arguments : null
      const details = args ? formatToolArguments(args) : ''
      return `### ${humanizeToolName(String(toolName))}\n\nStarting tool call.${details}`
    }
    if (entry.metadata.error && typeof entry.metadata.error === 'string') {
      const args = isRecord(entry.metadata.arguments) ? entry.metadata.arguments : null
      const details = args ? formatToolArguments(args) : ''
      return `### ${humanizeToolName(String(toolName))} failed\n\n${entry.metadata.error}${details}`
    }
    if (entry.metadata.data !== undefined) {
      const data = entry.metadata.data
      const runId = isRecord(data) && isRecord(data.run) && typeof data.run.id === 'string'
        ? data.run.id
        : null
      const runLink = runId ? `\n\n[Open run](${dashboardOrigin}?view=runs&runId=${encodeURIComponent(runId)})` : ''
      return `### ${humanizeToolName(String(toolName))}\n\n${body}${runLink}`
    }
  }
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
    const metadataRunId = isRecord(entry.metadata) && typeof entry.metadata.runId === 'string'
      ? entry.metadata.runId
      : null
    const metadataStatus = isRecord(entry.metadata) && typeof entry.metadata.status === 'string'
      ? entry.metadata.status
      : null
    const metadataExpectedArtifacts = isRecord(entry.metadata) && typeof entry.metadata.expectedArtifacts === 'string'
      ? entry.metadata.expectedArtifacts
      : null
    const runId = metadataRunId ?? body.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu)?.[0]
    if (runId) {
      const metadataLines = [
        runId,
        metadataStatus,
        metadataExpectedArtifacts,
      ].filter(Boolean)
      return `### ${entry.title}\n\n${metadataLines.join('\n\n')}\n\n${body}`
    }
  }
  if (entry.title) {
    return `### ${entry.title}\n\n${body}`
  }
  return body
}

function toThreadMessage(entry: SessionEntry): ThreadMessage {
  const inferredRunId = inferSessionEntryRunId(entry)
  const metadataCustom = isRecord(entry.metadata)
    ? {
        title: entry.title,
        role: entry.role,
        ...entry.metadata,
        ...(inferredRunId ? { runId: inferredRunId } : {}),
      }
    : entry.title
      ? { title: entry.title, role: entry.role, ...(inferredRunId ? { runId: inferredRunId } : {}) }
      : { role: entry.role, ...(inferredRunId ? { runId: inferredRunId } : {}) }
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
      custom: metadataCustom,
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
  if (!isUncertainRunStatus(run.status)) {
    messages.push(
      createSessionEntry(
        `${run.id}-cli-summary`,
        'assistant',
        run.createdAt,
        `CLI orchestration session initialized.\n\n${details.join('\n')}`,
        'CLI session',
      ),
    )
  }

  if (payload?.metadata?.config && run.status.toLowerCase() !== 'running' && !isUncertainRunStatus(run.status)) {
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

function getDashboardAuthReturnUrl(options?: { loggedOut?: boolean }) {
  const returnUrl = new URL(window.location.href)
  returnUrl.searchParams.delete('login')
  returnUrl.searchParams.delete('auth_error')
  if (options?.loggedOut) {
    returnUrl.searchParams.set('logged_out', '1')
  } else {
    returnUrl.searchParams.delete('logged_out')
  }
  return returnUrl.toString()
}

function beginDashboardLogin() {
  const destination = new URL('/api/auth/start', rootOrigin)
  const bridgeReturn = `/api/auth/bridge?return_to=${encodeURIComponent(
    getDashboardAuthReturnUrl(),
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

function describeSignedOutDestination() {
  const route = getDashboardRoute()
  if (route.runId) {
    return 'your run'
  }
  if (route.datasetId) {
    return 'your dataset'
  }
  if (route.sessionId) {
    return 'your research session'
  }
  if (route.view === 'datasets') {
    return 'your datasets'
  }
  if (route.view === 'runs') {
    return 'your runs'
  }
  return 'your dashboard'
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

function extractStartedRunId(entries: StoredAssistantSessionEntry[]) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]
    if (!entry) continue
    if (entry.metadata && typeof entry.metadata === 'object') {
      const runId = (entry.metadata as { runId?: unknown }).runId
      if (typeof runId === 'string' && runId.trim()) {
        return runId
      }
    }
    const inlineRunId = extractRunIdFromText(entry.content)
    if (inlineRunId) {
      return inlineRunId
    }
  }
  return null
}

function sessionEntriesToThreadMessages(entries: StoredAssistantSessionEntry[]) {
  const renderedRunIds = new Set<string>()
  const messages: ThreadMessage[] = []
  for (const entry of entries) {
    const metadata = isRecord(entry.metadata) ? entry.metadata : null
    if (
      metadata?.name === 'plan_remote_run' &&
      entry.content.startsWith('Calling ')
    ) {
      continue
    }
    const sessionEntry = createSessionEntry(
      entry.id,
      entry.role === 'user' ? 'user' : entry.role === 'system' ? 'system' : entry.role === 'tool' ? 'tool' : 'assistant',
      entry.createdAt,
      entry.content,
      entry.title ?? formatStatus(entry.kind),
      entry.metadata,
    )
    const runId = sessionEntry.role !== 'user' ? inferSessionEntryRunId(sessionEntry) : null
    if (runId) {
      if (renderedRunIds.has(runId)) continue
      renderedRunIds.add(runId)
    }
    messages.push(toThreadMessage(sessionEntry))
  }
  return messages
}

async function postAssistantTurn(body: {
  input: string
  sessionId?: string | null
  datasetId?: string | null
  previousResponseId?: string | null
}) {
  if (isHarnessMode()) {
    if (isHarnessPreparedRunPrompt(body.input)) {
      const launched = launchHarnessPreparedRun(body.input)
      return {
        sessionId: launched.sessionId,
        previousResponseId: `harness-response-${Date.now()}`,
        reply: `Started ${launched.runId}.`,
      }
    }
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
      datasetId: body.datasetId ?? undefined,
      previousResponseId: body.previousResponseId ?? undefined,
    }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const parsed = text ? tryParseJson(text) : null
    const message = isRecord(parsed) && typeof parsed.error === 'string'
      ? parsed.error
      : text || `Request failed: ${response.status}`
    throw new Error(message)
  }
  return response.json() as Promise<AssistantTurnResponse>
}

async function approveRemoteRunPlan(sessionId: string) {
  const response = await fetch(`/api/cli/sessions/${encodeURIComponent(sessionId)}/remote-run-plan/approve`, {
    method: 'POST',
    credentials: 'same-origin',
  })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) {
    throw new Error(payload.error ?? 'Could not approve remote-run plan.')
  }
  return payload
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
    topic: url.searchParams.get('topic'),
    draft: url.searchParams.get('draft'),
  }
}

function updateDashboardRoute(next: {
  view?: DashboardView
  runId?: string | null
  datasetId?: string | null
  sessionId?: string | null
  draft?: string | null
}) {
  const url = new URL(window.location.href)
  url.searchParams.set('view', next.view ?? getDashboardRoute().view)
  if (next.runId) url.searchParams.set('runId', next.runId)
  else url.searchParams.delete('runId')
  if (next.datasetId) url.searchParams.set('datasetId', next.datasetId)
  else url.searchParams.delete('datasetId')
  if (next.sessionId) url.searchParams.set('sessionId', next.sessionId)
  else url.searchParams.delete('sessionId')
  if (typeof next.draft === 'string' && next.draft.trim()) url.searchParams.set('draft', next.draft)
  else url.searchParams.delete('draft')
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

const FIRST_DATASET_COMMAND = 'research datasets create --name "My first dataset" --file ./data.csv --description "What this data covers and the question I want to answer"'
const DASHBOARD_SUPPORT_URL = 'https://cal.com/ryan-prendergast-qsp5cw/30min'

function dashboardDataErrorSummary(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes('403') || message.includes('forbidden') || message.includes('permission')) {
      return 'Alpha Research could not verify that this account can access dashboard data right now.'
    }
    if (message.includes('401') || message.includes('unauthorized')) {
      return 'Your sign-in succeeded, but Alpha Research could not verify dashboard access right now.'
    }
  }
  return 'Alpha Research could not load dashboard data right now.'
}

function DatasetsEmptyState() {
  return (
    <Empty className="border-t border-dashed border-border px-6 py-14 text-left">
      <EmptyHeader className="max-w-3xl items-start gap-3">
        <EmptyMedia variant="icon">
          <Database />
        </EmptyMedia>
        <Badge variant="secondary" className="gap-2 text-emerald-700">
          <CheckCircle2 className="size-3.5" />
          Expected for a new workspace
        </Badge>
        <EmptyTitle className="text-left normal-case tracking-normal">Set up your first dataset</EmptyTitle>
        <EmptyDescription className="max-w-2xl text-left text-sm leading-7">
          Nothing failed here. To get to first value, register one file or source and add a short description of
          what it covers or what you want to analyze. The RESEARCH CLI will create the dataset and then it will show
          up in this dashboard.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-3xl items-stretch gap-4 text-left">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-[24px] border border-border/70 bg-card/80 py-0 shadow-none">
            <CardContent className="flex h-full flex-col gap-3 px-6 py-6">
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-normal">Fastest path</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Use the CLI if you already have a local file or source URL ready.
                </p>
              </div>
              <pre className="overflow-x-auto rounded-2xl border border-border/70 bg-muted/30 p-4 text-xs leading-6 text-foreground">
                <code>{FIRST_DATASET_COMMAND}</code>
              </pre>
              <p className="text-xs leading-6 text-muted-foreground">
                Replace the file path and description with your own source. The description should explain what the
                data contains or the question you want to research.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild>
                  <a href="/cli/">
                    Open CLI setup
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[24px] border border-border/70 bg-muted/25 py-0 shadow-none">
            <CardContent className="flex h-full flex-col gap-3 px-6 py-6">
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-normal">What you need</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  The first dataset setup only needs two inputs.
                </p>
              </div>
              <ol className="space-y-3 text-sm leading-6 text-foreground">
                <li>1. A file or source to ingest, such as a CSV, JSON export, or source URL.</li>
                <li>2. A short description of what the data covers and what you want to analyze.</li>
              </ol>
              <p className="text-xs leading-6 text-muted-foreground">
                After creation, the dataset appears here with readiness status so you can open it, inspect provenance,
                and launch research runs.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild variant="outline">
                  <a href="https://cal.com/ryan-prendergast-qsp5cw/30min" target="_blank" rel="noopener noreferrer">
                    Get setup help
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </EmptyContent>
    </Empty>
  )
}

function DatasetsDataErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <Card className="rounded-[28px] border border-destructive/30 bg-destructive/5 py-0 shadow-none">
      <CardContent className="flex flex-col gap-6 px-6 py-6 md:px-7">
        <div className="flex flex-col gap-4">
          <Badge variant="secondary" className="w-fit gap-2 text-destructive">
            <AlertTriangle className="size-3.5" />
            Data temporarily unavailable
          </Badge>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-normal">We could not load your datasets.</h2>
            <p className="max-w-3xl text-sm leading-7 text-foreground">
              {message} Your account is still signed in, but this page cannot confirm whether the workspace is empty,
              permission-restricted, or temporarily unavailable until the data request succeeds.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm leading-7 text-muted-foreground">
              Retry to fetch datasets again. If the problem continues, contact support so we can check service health
              or workspace access with you.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={onRetry}>
            Retry
          </Button>
          <Button asChild type="button" variant="outline">
            <a href={DASHBOARD_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
              Contact support
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DatasetFeed({
  datasets,
  topic,
  onSelectDataset,
  dataError,
  onRetry,
}: {
  datasets: DatasetRecord[]
  topic: string | null
  onSelectDataset: (dataset: DatasetRecord) => void
  dataError?: string | null
  onRetry?: () => void
}) {
  if (dataError) {
    return <DatasetsDataErrorState message={dataError} onRetry={onRetry ?? (() => {})} />
  }
  if (datasets.length === 0) {
    return <DatasetsEmptyState />
  }
  const publicDatasets = datasets.filter(isPublicDataset)
  const privateDatasets = datasets.filter((dataset) => !isPublicDataset(dataset))
  const rankedDatasets = [...datasets]
    .map((dataset) => ({ dataset, score: datasetTopicMatchScore(dataset, topic) }))
    .sort((left, right) => right.score - left.score)
  const recommendedDataset = rankedDatasets.find((entry) => entry.score > 0)?.dataset ?? null
  const topicLabel = topic ? normalizeTopicLabel(topic) : null

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-14">
      {topicLabel ? (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.9fr)]">
          <Card className="rounded-[28px] border border-border/70 bg-card py-0 shadow-sm">
            <CardContent className="flex flex-col gap-4 px-6 py-6 md:px-7">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Dataset guide
                </p>
                <h2 className="text-2xl font-semibold tracking-normal">Best datasets for {topicLabel}</h2>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                  Compare datasets by subject fit, coverage, freshness, and readiness. Start with one recommended
                  next action instead of guessing from dataset names alone.
                </p>
              </div>
              {recommendedDataset ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <RunPriorityBadge label="Recommended next step" tone="success" />
                    <span className="text-sm font-medium text-emerald-950">Open {recommendedDataset.name}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-emerald-950/90">
                    {datasetRecommendationReason(recommendedDataset, topic)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button type="button" onClick={() => onSelectDataset(recommendedDataset)}>
                      Open recommended dataset
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
                  <p className="text-sm leading-7 text-amber-950">
                    Alpha Research does not see a strong ready match for {topicLabel} yet. Ask the agent to find a
                    public source or upload a dataset that covers this topic.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-[28px] border border-border/70 bg-muted/20 py-0 shadow-none">
            <CardContent className="flex h-full flex-col gap-4 px-6 py-6">
              <h3 className="text-base font-semibold tracking-normal">How to compare datasets</h3>
              <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                <li>Subject fit: Does the summary clearly match {topicLabel.toLowerCase()}?</li>
                <li>Readiness: Ready now means you can open and analyze it immediately.</li>
                <li>Coverage: Check geography, time range, and whether it is public or private.</li>
                <li>Limitations: Use the gaps callout to decide whether to upload or ask for another source.</li>
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}
      <DatasetFeedSection
        title="Your datasets"
        summary={`${privateDatasets.length} private dataset${privateDatasets.length === 1 ? '' : 's'} visible only to your workspace.`}
        emptyMessage="No private datasets yet. Upload a source or create a research environment from the CLI and it will appear here."
        datasets={privateDatasets}
        topic={topic}
        onSelectDataset={onSelectDataset}
      />
      <DatasetFeedSection
        title="Public datasets"
        summary={`${publicDatasets.length} shared dataset${publicDatasets.length === 1 ? '' : 's'} available to explore without uploading your own files.`}
        action={
          <a
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline"
            href={`${DOCS_ORIGIN}/public-datasets`}
          >
            Dataset docs
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        }
        emptyMessage="No public datasets are available right now."
        datasets={publicDatasets}
        topic={topic}
        onSelectDataset={onSelectDataset}
      />
    </div>
  )
}

function DatasetFeedSection({
  title,
  summary,
  action,
  emptyMessage,
  datasets,
  topic,
  onSelectDataset,
}: {
  title: string
  summary: string
  action?: ReactNode
  emptyMessage: string
  datasets: DatasetRecord[]
  topic: string | null
  onSelectDataset: (dataset: DatasetRecord) => void
}) {
  const sortedDatasets = topic
    ? [...datasets].sort((left, right) => datasetTopicMatchScore(right, topic) - datasetTopicMatchScore(left, topic))
    : datasets

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-xl font-medium">{title}</div>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {datasets.length === 0 ? (
        <Card className="rounded-2xl border border-dashed bg-muted/25 shadow-none">
          <CardContent className="px-5 py-5 text-sm text-muted-foreground">{emptyMessage}</CardContent>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          {sortedDatasets.map((dataset) => {
            const description = datasetInventoryDescription(dataset)
            const useCase = datasetInventoryUseCase(dataset)
            const readiness = datasetInventoryStatus(dataset)
            const coverage = dataset.inventoryCoverage?.trim() ?? null
            const freshness = dataset.inventoryFreshness?.trim() ?? null
            const limitation = dataset.inventoryLimitations?.find((item) => item.trim())?.trim() ?? null
            const matchScore = datasetTopicMatchScore(dataset, topic)
            return (
              <button
                key={dataset.id}
                type="button"
                className="grid min-h-56 w-full min-w-0 grid-rows-[auto_1fr_auto] gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-5"
                onClick={() => onSelectDataset(dataset)}
              >
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex size-13 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Database className="size-6" />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="text-base font-semibold">{dataset.name}</div>
                      {useCase ? <p className="text-sm font-medium text-foreground/80">{useCase}</p> : null}
                    </div>
                  </div>
                  <div className="max-w-full sm:shrink-0">
                    <StatusBadge>{readiness.label}</StatusBadge>
                  </div>
                </div>
                <div className="min-w-0 space-y-3">
                  <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                  {matchScore > 0 && topic ? (
                    <p className="text-sm font-medium text-foreground">Relevant to {normalizeTopicLabel(topic)}</p>
                  ) : null}
                  <div className="grid min-w-0 gap-2 text-sm leading-6 text-foreground/80">
                    {coverage ? <p><span className="font-medium text-foreground">Coverage:</span> {coverage}</p> : null}
                    {freshness ? <p><span className="font-medium text-foreground">Freshness:</span> {freshness}</p> : null}
                    {limitation ? <p><span className="font-medium text-foreground">Limitation:</span> {limitation}</p> : null}
                  </div>
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

async function cancelRun(runId: string) {
  if (isHarnessMode()) {
    const run = harnessRuns.find((candidate) => candidate.id === runId)
    if (!run) {
      throw new Error('Harness run not found.')
    }
    run.status = 'cancelled'
    run.outputPreview = 'Cancelled by user. Saved artifacts and transcript evidence remain available.'
    run.updatedAt = new Date().toISOString()
    return { run: { ...run } }
  }

  const response = await fetch(`/api/cli/runs/${encodeURIComponent(runId)}/cancel`, {
    method: 'POST',
    credentials: 'same-origin',
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Cancel run failed: ${response.status}`)
  }
  return response.json() as Promise<{ run: RunRecord }>
}

function DatasetDetailPage({
  dataset,
  runs,
  onBack,
  onOpenRun,
  onAskDataset,
}: {
  dataset: DatasetRecord
  runs: RunRecord[]
  onBack: () => void
  onOpenRun: (run: RunRecord) => void
  onAskDataset: (dataset: DatasetRecord, prompt?: string) => void
}) {
  const [detail, setDetail] = useState<DatasetRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [startingDescribe, setStartingDescribe] = useState(false)
  const [cancellingBlockingRun, setCancellingBlockingRun] = useState(false)
  const [questionDraft, setQuestionDraft] = useState('')
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

  const blockingRun = datasetBlockingRun(current, runs, describeRun?.id ?? null)
  const canDescribe = current.deploymentStatus === 'ready' && current.status === 'ready' && !blockingRun
  const briefingMarkdown = current.profile?.briefingMarkdown || current.profile?.notes || ''
  const structuredProfile = current.profile?.profile
  const describedAt = current.profile?.describedAt ?? current.profile?.updatedAt ?? null
  const describeIsRunning = describeRun ? !['ready', 'failed', 'cancelled', 'canceled', 'worker_unreachable'].includes(describeRun.status.toLowerCase()) : false
  const limitationCount = profileArrayCount(structuredProfile, 'limitations')
  const profileSources = profileArray(structuredProfile, 'sources')
  const profileTables = profileArray(structuredProfile, 'tables')
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
  const profileSummary = profileText(structuredProfile, 'summary')
  const fitHeadline = current.inventoryUseCase?.replace(/^Best for:\s*/i, '').trim() || profileSummary
  const fitVerdict = limitationCount
    ? `Useful for ${fitHeadline ?? 'initial exploration'}, but review the known limits before trusting final results.`
    : `Ready for ${fitHeadline ?? 'research use'} with no major limits highlighted in the current profile.`
  const primaryTable = profileTables.find((item) => isRecord(item)) ?? null
  const primaryTableName = primaryTable ? profileText(primaryTable, 'name') ?? 'Primary table' : null
  const primaryTableRows = primaryTable && typeof primaryTable['rows'] === 'number'
    ? primaryTable['rows']
    : primaryTable && typeof primaryTable['rowCount'] === 'number'
      ? primaryTable['rowCount']
      : isRecord(current.ingestConfig) && typeof current.ingestConfig['rowCount'] === 'number'
        ? current.ingestConfig['rowCount']
        : null
  const validationSummary = primaryTableRows && schemaColumns.length > 0
    ? `${primaryTableRows.toLocaleString()} rows and ${schemaColumns.length} required fields are present in the current profile.`
    : primaryTableRows
      ? `${primaryTableRows.toLocaleString()} rows are present in the current profile.`
      : schemaColumns.length > 0
        ? `${schemaColumns.length} core fields are listed in the current profile.`
        : 'Validation summary is not available yet.'
  const schemaPreview = schemaColumns.length > 0
    ? `${schemaColumns.slice(0, 4).join(', ')}${schemaColumns.length > 4 ? `, +${schemaColumns.length - 4} more` : ''}`
    : 'Schema preview is not available yet.'
  const primaryLimitation = typeof profileLimitations[0] === 'string'
    ? profileLimitations[0]
    : current.inventoryLimitations?.[0] ?? 'No explicit limitations are summarized yet.'
  const transformationSummary = briefingMarkdown.toLowerCase().includes('transformations')
    ? 'Metadata is preserved and text references are normalized into stable paths.'
    : 'Transformation summary is not available yet.'
  const representativenessSummary = primaryLimitation.toLowerCase().includes('sample')
    ? 'This is a curated sample for fast exploration, not a full-corpus source of record.'
    : 'Representativeness notes are not available yet.'
  const trustSummaryItems = [
    {
      label: 'Source',
      value: primarySource ?? current.sourceFilename ?? 'Source not summarized yet.',
      detail: current.mode?.toLowerCase() === 'public' ? 'Public source dataset' : 'Workspace dataset',
    },
    {
      label: 'Validated',
      value: validationSummary,
      detail: primaryTableName ? `Checked against ${primaryTableName}.` : 'Checked against the current dataset profile.',
    },
    {
      label: 'Schema',
      value: schemaPreview,
      detail: 'Use this to confirm the core fields before analysis.',
    },
    {
      label: 'Caveat',
      value: primaryLimitation,
      detail: representativenessSummary,
    },
  ]
  const questionPrompts = datasetQuestionPrompts(current)
  const describeButtonLabel = briefingMarkdown ? 'Refresh briefing' : 'Describe dataset'
  const describeHelperText = briefingMarkdown
    ? 'Regenerate the briefing if the source data or profile has changed.'
    : 'Generate a plain-language briefing covering provenance, schema, coverage, and limits.'
  const describeDestinationText = briefingMarkdown
    ? 'Starts a fresh async run and opens the run view so you can watch progress, transcript updates, and the new briefing artifact.'
    : 'Starts an async run and opens the run view with progress, transcript updates, and the generated briefing artifact.'
  const trustState = datasetDetailTrustState(current, Boolean(briefingMarkdown))
  const sourceCoverage = current.inventoryCoverage?.trim() ?? 'Coverage summary is not available yet.'
  const freshnessSummary = current.inventoryFreshness?.trim() ?? (freshness ? `Last refreshed ${formatDateTime(freshness)}.` : 'Freshness summary is not available yet.')
  const sourceStatus = current.volume?.mountPath
    ? 'Deployed dataset files are mounted and available.'
    : 'Deployed dataset files are not mounted yet.'
  const briefingStatus = briefingMarkdown
    ? describedAt
      ? `Dataset briefing available. Last generated ${formatDateTime(describedAt)}.`
      : 'Dataset briefing available.'
    : blockingRun
      ? `New work is blocked until ${runStatusLabel(blockingRun).toLowerCase()} finishes or is cancelled.`
    : canDescribe
      ? 'No briefing yet. You can generate one now.'
      : 'No briefing yet because the dataset is not ready enough to describe.'
  const describeActionDetail = blockingRun
    ? `This dataset is locked by ${runStatusLabel(blockingRun).toLowerCase()}. Open that run to inspect progress, wait for it to finish, or cancel it if this work is no longer needed.`
    : !canDescribe
    ? trustState.actionDetail
    : briefingMarkdown
      ? 'Starts a fresh async run to refresh the briefing.'
      : 'Starts an async run to create the first briefing.'
  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <button type="button" className="w-fit text-sm text-muted-foreground hover:text-foreground" onClick={onBack}>
          Back to datasets
        </button>
        <section className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">{current.name}</h1>
            <p className="mt-3 max-w-3xl text-lg leading-8 text-muted-foreground">
              {current.description || current.sourceFilename || `A ${formatStatus(current.sourceType)} dataset registered in Alpha Research.`}
            </p>
          </div>
        </section>

        {error ? <div className="bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

        {blockingRun ? (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 px-6 py-6" aria-labelledby="dataset-busy-heading">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <RunPriorityBadge label="Dataset is busy" tone="warning" />
                  <RunPriorityBadge label={runStatusLabel(blockingRun)} tone="warning" />
                </div>
                <div className="space-y-2">
                  <h2 id="dataset-busy-heading" className="text-2xl font-semibold tracking-normal text-amber-950">
                    Another run is already using this dataset.
                  </h2>
                  <p className="max-w-3xl text-sm leading-7 text-amber-950/90">
                    Do not start duplicate work yet. Alpha Research already has active work on <span className="font-medium">{current.name}</span>, so new work stays blocked until that run finishes or is cancelled.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-amber-200 bg-background/90 px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-amber-900/70">Blocking run</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">{blockingRun.id}</div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{runStatusLabel(blockingRun)}</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-background/90 px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-amber-900/70">Last activity</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">{relativeTime(blockingRun.updatedAt)}</div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Started {formatDateTime(blockingRun.createdAt)}.
                    </p>
                  </div>
                </div>
                <p className="max-w-3xl text-sm leading-7 text-amber-950/90">
                  Next actions: inspect the blocking run, wait here and refresh status, or cancel the run if this build should stop. Queueing a follow-up run is not available from this screen yet.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-3">
                <Button type="button" onClick={() => onOpenRun(blockingRun)}>
                  View blocking run
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.dispatchEvent(new CustomEvent('alpha-research-dashboard-refresh'))}
                >
                  Refresh status
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={cancellingBlockingRun}
                  onClick={async () => {
                    setCancellingBlockingRun(true)
                    try {
                      await cancelRun(blockingRun.id)
                      window.dispatchEvent(new CustomEvent('alpha-research-dashboard-refresh'))
                    } catch (cancelError) {
                      setError(cancelError instanceof Error ? cancelError.message : 'Could not cancel blocking run.')
                    } finally {
                      setCancellingBlockingRun(false)
                    }
                  }}
                >
                  {cancellingBlockingRun ? 'Cancelling...' : 'Cancel blocking run'}
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid min-w-0 gap-4 rounded-2xl border border-border bg-muted/20 p-4 md:p-6">
          <div className="min-w-0 space-y-5">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Dataset inventory</div>
              <h2 className="text-2xl font-semibold tracking-normal">Inventory</h2>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                {current.inventorySummary?.trim() || profileSummary || current.description || 'Current dataset metadata and mounted source inventory.'}
              </p>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-background">
              <Table>
                <TableBody>
                  {[
                    ['Dataset ID', current.id],
                    ['Source type', formatStatus(current.sourceType)],
                    ['Source file', current.sourceFilename ?? 'Not recorded'],
                    ['Mode', current.mode ? formatStatus(current.mode) : 'Not recorded'],
                    ['Dataset status', formatStatus(current.status)],
                    ['Deployment status', formatStatus(current.deploymentStatus)],
                    ['Dataset size', formatBytes(current.sourceSizeBytes)],
                    ['Manifest path', current.manifestPath ?? 'Not recorded'],
                    ['Mounted volume', current.volume?.mountPath ?? 'Not mounted'],
                    ['Updated', formatDateTime(current.updatedAt)],
                    ['Profile updated', current.profile?.updatedAt ? formatDateTime(current.profile.updatedAt) : 'Not recorded'],
                    ['Described at', describedAt ? formatDateTime(describedAt) : 'Not recorded'],
                  ].map(([label, value]) => (
                    <TableRow key={label}>
                      <TableCell className="w-48 align-top text-sm font-medium text-muted-foreground">{label}</TableCell>
                      <TableCell className="break-words text-sm text-foreground">{value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {(current.inventoryUseCase || current.inventoryCoverage || current.inventoryFreshness || primaryLimitation) ? (
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                {current.inventoryUseCase ? (
                  <div className="min-w-0 rounded-xl border border-border bg-background/80 px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Use case</div>
                    <p className="mt-2 text-sm leading-6 text-foreground/85">{current.inventoryUseCase.replace(/^Best for:\s*/i, '')}</p>
                  </div>
                ) : null}
                {current.inventoryCoverage ? (
                  <div className="min-w-0 rounded-xl border border-border bg-background/80 px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Coverage</div>
                    <p className="mt-2 text-sm leading-6 text-foreground/85">{current.inventoryCoverage}</p>
                  </div>
                ) : null}
                {current.inventoryFreshness ? (
                  <div className="min-w-0 rounded-xl border border-border bg-background/80 px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Freshness</div>
                    <p className="mt-2 text-sm leading-6 text-foreground/85">{current.inventoryFreshness}</p>
                  </div>
                ) : null}
                {primaryLimitation ? (
                  <div className="min-w-0 rounded-xl border border-border bg-background/80 px-4 py-4">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Limitations</div>
                    <p className="mt-2 text-sm leading-6 text-foreground/85">{primaryLimitation}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {profileSources.length > 0 ? (
              <div className="min-w-0 rounded-xl border border-border bg-background/80 p-5">
                <h2 className="text-lg font-medium">Sources</h2>
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Detail</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profileSources.map((source, index) => (
                        <TableRow key={index}>
                          <TableCell>{profileText(source, 'name') ?? profileText(source, 'source') ?? `Source ${index + 1}`}</TableCell>
                          <TableCell>{profileText(source, 'provider') ?? '-'}</TableCell>
                          <TableCell>{profileText(source, 'description') ?? profileText(source, 'coverage') ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
            {profileTables.length > 0 ? (
              <div className="min-w-0 rounded-xl border border-border bg-background/80 p-5">
                <h2 className="text-lg font-medium">Tables</h2>
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Rows</TableHead>
                        <TableHead>Detail</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profileTables.map((table, index) => {
                        const rowCount = isRecord(table) && typeof table['rows'] === 'number'
                          ? table['rows']
                          : isRecord(table) && typeof table['rowCount'] === 'number'
                            ? table['rowCount']
                            : null
                        return (
                          <TableRow key={index}>
                            <TableCell>{profileText(table, 'name') ?? `Table ${index + 1}`}</TableCell>
                            <TableCell>{rowCount === null ? '-' : rowCount.toLocaleString()}</TableCell>
                            <TableCell>{profileText(table, 'description') ?? profileText(table, 'coverage') ?? '-'}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : primaryTableName || primaryTableRows ? (
              <div className="min-w-0 rounded-xl border border-border bg-background/80 px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Primary table</div>
                <p className="mt-2 text-sm leading-6 text-foreground/85">
                  {primaryTableName ?? 'Primary table'}{primaryTableRows ? `, ${primaryTableRows.toLocaleString()} rows` : ''}
                </p>
              </div>
            ) : null}
            {(schemaColumns.length > 0 || sampleRows.length > 0) ? (
              <div className="grid min-w-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                <div className="min-w-0 rounded-xl border border-border bg-background/80 p-5">
                  <h2 className="text-lg font-medium">Schema</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Core fields visible in the current profile.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {schemaColumns.map((column) => (
                      <span key={column} className="max-w-full break-words rounded-full border border-border px-3 py-1 text-sm text-foreground/85">
                        {column}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="min-w-0 rounded-xl border border-border bg-background/80 p-5">
                  <div>
                    <h2 className="text-lg font-medium">Sample rows</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Quick examples so you can confirm the dataset contains the kind of records you expect.
                    </p>
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
              </div>
            ) : null}
          </div>
          <div className="min-w-0 rounded-xl border border-border bg-background p-5 lg:flex lg:flex-col lg:justify-between lg:gap-4">
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
              <div className="rounded-xl border border-border bg-muted/25 px-4 py-3 text-sm text-foreground/85">
                <span className="font-medium text-foreground">Trust verdict:</span> {trustState.explanation}
              </div>
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  canDescribe
                    ? 'border-border bg-muted/25 text-muted-foreground'
                    : 'border-amber-300 bg-amber-50 text-amber-950'
                }`}
              >
                {describeActionDetail}
              </div>
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

        <section className="grid min-w-0 gap-4 rounded-3xl border border-border bg-background p-4 shadow-sm md:p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 space-y-5">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ask about this dataset</div>
              <h2 className="text-2xl font-semibold tracking-normal">Start a grounded question without re-explaining the data.</h2>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                Alpha Research will attach <span className="font-medium text-foreground">{current.name}</span> automatically, so you do not need to copy a dataset id or restate where you are starting from.
              </p>
            </div>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                onAskDataset(current, questionDraft)
              }}
            >
              <label htmlFor="dataset-question" className="text-sm font-medium text-foreground">
                Your research question
              </label>
              <Input
                id="dataset-question"
                value={questionDraft}
                onChange={(event) => setQuestionDraft(event.target.value)}
                placeholder={`Ask about ${current.name}, for example: which authors change the most over time?`}
                className="h-12"
              />
              <div className="flex flex-wrap gap-3">
                <Button type="submit">
                  Ask about {current.name}
                </Button>
                <Button type="button" variant="outline" onClick={() => onAskDataset(current)}>
                  Open dataset-scoped chat
                </Button>
              </div>
            </form>
            <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/25 p-4">
              <div className="text-sm font-semibold">Good first prompts</div>
              <div className="flex flex-wrap gap-2">
                {questionPrompts.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    className="h-auto max-w-full whitespace-normal rounded-xl px-4 py-2 text-left normal-case sm:rounded-full"
                    onClick={() => setQuestionDraft(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="min-w-0 rounded-2xl border border-border bg-muted/20 p-5 lg:flex lg:flex-col lg:gap-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">What happens next</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Broad questions stay in chat first. The assistant should clarify scope, outputs, or method before it starts expensive work.
              </p>
            </div>
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              If work starts, expect a scoped answer first, then a run with transcript and artifacts only when the request is specific enough.
            </div>
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              Expected outputs can include a written answer, a research plan, or run artifacts such as tables, charts, and summaries.
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 border-b border-border pb-3 md:flex-row md:items-center md:justify-between md:gap-4">
            <h2 className="text-xl font-medium">Dataset briefing</h2>
            <div className="text-sm text-muted-foreground">Read top to bottom for provenance, coverage, schema, and known gaps.</div>
          </div>
          <div className="rounded-lg border border-border p-5">
            {briefingMarkdown ? (
              <article className="max-w-none">{renderBriefingMarkdown(briefingMarkdown)}</article>
            ) : blockingRun ? (
              <div className="space-y-3">
                <p className="text-sm leading-7 text-muted-foreground">
                  Dataset briefing is blocked by an active run.
                </p>
                <p className="text-sm leading-7 text-muted-foreground">
                  Open <button type="button" className="font-medium text-foreground underline underline-offset-4" onClick={() => onOpenRun(blockingRun)}>{blockingRun.id}</button> to inspect the environment build, wait for it to finish, or cancel it before you retry describing this dataset.
                </p>
              </div>
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
              <div className="space-y-3">
                <p className="text-sm leading-7 text-muted-foreground">
                  No dataset briefing is available yet.
                </p>
                <p className="text-sm leading-7 text-muted-foreground">
                  {canDescribe
                    ? 'Generate one to get a plain-language summary of provenance, coverage, schema, and known gaps before analysis.'
                    : `${trustState.headline} ${trustState.actionDetail}`}
                </p>
              </div>
            )}
          </div>
        </section>

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
  onSelectRun,
}: {
  runs: RunRecord[]
  onSelectRun: (run: RunRecord) => void
}) {
  const sortedRuns = [...runs].sort((a, b) => {
    const priorityDelta = getRunPriorityMeta(a).rank - getRunPriorityMeta(b).rank
    if (priorityDelta !== 0) {
      return priorityDelta
    }
    return b.updatedAt.localeCompare(a.updatedAt)
  })
  return (
    <div className="flex flex-col">
      {sortedRuns.map((run) => {
        const normalizedStatus = run.status.toLowerCase()
        const isFailedRun = normalizedStatus === 'worker_unreachable' || normalizedStatus === 'failed' || normalizedStatus === 'error'
        const isActiveRun = normalizedStatus === 'running'
        const prompt =
          run.prompt?.trim() ||
          run.outputPreview?.trim() ||
          'No prompt recorded yet.'

        return (
          <button
            key={run.id}
            type="button"
            className="flex w-full min-w-0 items-center gap-2 px-1 py-2 text-left hover:bg-muted/35"
            onClick={() => onSelectRun(run)}
          >
            <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
              {isFailedRun ? (
                <X className="size-4 text-destructive" aria-label="Failed" />
              ) : isActiveRun ? (
                <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Running" />
              ) : (
                <span aria-hidden="true">-</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground" title={prompt}>
                {truncate(prompt, 180)}
              </span>
            </span>
          </button>
        )
      })}
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
    <div className="overflow-x-auto">
      <Table className="min-w-[36rem]">
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
    </div>
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
          className="h-auto max-w-full justify-start rounded-full px-3 py-2 text-left"
          onClick={() => onOpenArtifact(artifact.id)}
        >
          <span className="truncate">{artifactPath(artifact)}</span>
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

function useRunResultsById(runId: string | null) {
  const [payload, setPayload] = useState<RunResultsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!runId) {
      setPayload(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    let intervalId: number | undefined

    const load = async () => {
      setLoading(true)
      try {
        const response = await fetchJson<RunResultsResponse>(`/api/cli/runs/${encodeURIComponent(runId)}/results`)
        if (cancelled) return
        setPayload(response)
        setError(null)
        if (isTerminalRunStatus(response.run.status) && intervalId) {
          window.clearInterval(intervalId)
          intervalId = undefined
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load run.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    intervalId = window.setInterval(() => void load(), 5000)
    return () => {
      cancelled = true
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [runId])

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

function RemoteRunBlock({
  runId,
  initialStatus,
}: {
  runId: string
  initialStatus?: string | null
}) {
  const { payload, error, loading } = useRunResultsById(runId)
  const htmlFrameRef = useRef<HTMLIFrameElement | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const run = payload?.run ?? null
  const status = run?.status ?? initialStatus ?? 'running'
  const isRunning = !isTerminalRunStatus(status)
  const producedArtifacts = getProducedArtifacts(payload).filter((artifact) => artifact.type !== 'remote_agent_session')
  const primaryArtifact = getDatasetBriefingArtifact(producedArtifacts)
  const resultArtifact = getDatasetProfileArtifact(producedArtifacts)
  const primaryArtifactPath = primaryArtifact ? artifactPath(primaryArtifact) : ''
  const isPrimaryHtml = primaryArtifact
    ? artifactLanguage(primaryArtifactPath, primaryArtifact) === 'html'
    : false
  const primaryHtmlHref = primaryArtifact && isPrimaryHtml ? artifactHtmlHref(primaryArtifact) : null
  const latestLines = (payload?.events ?? [])
    .slice(-8)
    .map((event) => stripMarkdownForInline(event.message))
    .filter((line, index, lines) => line && lines.indexOf(line) === index)
    .slice(-5)
  const elapsedLabel = isRunning ? elapsedRunTime(run?.createdAt) : null

  const handleCancel = async () => {
    setCancelling(true)
    setCancelError(null)
    try {
      await cancelRun(runId)
      window.dispatchEvent(new CustomEvent('alpha-research-dashboard-refresh'))
    } catch (cancelRunError) {
      setCancelError(cancelRunError instanceof Error ? cancelRunError.message : 'Could not cancel run.')
    } finally {
      setCancelling(false)
    }
  }

  const handleFullscreen = () => {
    void htmlFrameRef.current?.requestFullscreen?.()
  }

  const runBlockClassName = isPrimaryHtml && primaryHtmlHref
    ? 'inline-html-run-block'
    : ''

  return (
    <section
      className={`my-3 w-full max-w-full overflow-hidden border border-border bg-background ${runBlockClassName}`}
      data-inline-run-block
    >
      <div className={primaryArtifact && isPrimaryHtml ? 'space-y-0' : 'space-y-3 px-4 py-4'}>
        {error ? (
          <div className="rounded-md bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Could not load inline run: {error}
          </div>
        ) : null}
        {cancelError ? (
          <div className="rounded-md bg-destructive/5 px-3 py-2 text-sm text-destructive">{cancelError}</div>
        ) : null}
        {loading && !payload ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            <span>Loading run...</span>
          </div>
        ) : null}
        {isRunning ? (
          <div className="space-y-4">
            {elapsedLabel ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                <span>{elapsedLabel}</span>
              </p>
            ) : null}
            <div className="space-y-2 text-sm leading-6">
              {latestLines.length > 0 ? (
                latestLines.map((line) => <p key={line}>{line}</p>)
              ) : (
                <p className="text-muted-foreground">Starting remote run...</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void handleCancel()} disabled={cancelling}>
                {cancelling ? 'Cancelling...' : 'Cancel'}
              </Button>
              <Button type="button" size="sm" variant="ghost" asChild>
                <a href={`${dashboardOrigin}?view=runs&runId=${encodeURIComponent(runId)}`}>Run logs</a>
              </Button>
            </div>
          </div>
        ) : primaryArtifact ? (
          <div className={isPrimaryHtml ? 'space-y-0' : 'space-y-3'}>
            {isPrimaryHtml ? (
              primaryHtmlHref ? (
                <>
                  <div className="flex flex-wrap justify-end gap-2 border-b border-border p-2">
                    <Button type="button" size="sm" variant="ghost" onClick={handleFullscreen}>
                      Fullscreen
                    </Button>
                    <Button type="button" size="sm" variant="ghost" asChild>
                      <a href={`${dashboardOrigin}?view=runs&runId=${encodeURIComponent(runId)}`}>Run logs</a>
                    </Button>
                    <Button type="button" size="sm" variant="ghost" asChild>
                      <a href={artifactDownloadHref(primaryArtifact)} download={artifactDownloadFilename(primaryArtifact)}>Download</a>
                    </Button>
                  </div>
                  <div className="inline-html-run-frame">
                    <iframe
                      ref={htmlFrameRef}
                      title={primaryArtifact.title}
                      src={primaryHtmlHref}
                      className="h-[78vh] min-h-[46rem] w-full bg-background"
                    />
                  </div>
                </>
              ) : (
                <div className="border border-border px-4 py-3 text-sm text-muted-foreground">
                  HTML report content was not captured for inline preview.
                </div>
              )
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">{primaryArtifactPath}</h3>
                  <Button type="button" size="sm" variant="outline" asChild>
                    <a href={artifactDownloadHref(primaryArtifact)} download={artifactDownloadFilename(primaryArtifact)}>Download</a>
                  </Button>
                </div>
                <article className="max-h-[34rem] overflow-auto border border-border px-4 py-4 text-sm leading-6">
                {renderPreviewMarkdown(artifactText(primaryArtifact))}
              </article>
              </>
            )}
          </div>
        ) : resultArtifact ? (
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Result</div>
            <pre className="mt-2 max-h-[28rem] overflow-auto rounded-md border border-border bg-muted/20 p-3 text-xs leading-5">
              {artifactJsonPreview(resultArtifact)}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            The run is {formatStatus(status).toLowerCase()}, but no human-readable artifact is attached yet.
          </p>
        )}
      </div>
    </section>
  )
}

function RemoteRunPlanApprovalBlock({
  datasetId,
  prompt,
  onApprove,
}: {
  datasetId: string
  prompt: string
  onApprove: () => Promise<void>
}) {
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async () => {
    setApproving(true)
    setError(null)
    try {
      await onApprove()
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : 'Could not approve remote-run plan.')
    } finally {
      setApproving(false)
    }
  }

  return (
    <section className="my-3 overflow-hidden rounded-lg border border-border bg-background">
      <div className="border-b border-border bg-muted/25 px-4 py-3">
        <div className="text-sm font-semibold">Remote run plan</div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">{datasetId}</div>
      </div>
      <div className="space-y-4">
        <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap px-4 py-4 text-sm leading-6">
          {prompt}
        </pre>
        {error ? (
          <div className="mx-4 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>
        ) : null}
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          <Button type="button" onClick={() => void handleApprove()} disabled={approving}>
            {approving ? 'Approving...' : 'Approve and start run'}
          </Button>
        </div>
      </div>
    </section>
  )
}

function ResearchAssistantPage({
  dataError,
  datasets,
}: {
  dataError?: string | null
  datasets: DatasetRecord[]
}) {
  const route = useDashboardRoute()
  const activeSessionId = route.sessionId ?? null
  const scopedDataset = route.datasetId ? datasets.find((dataset) => dataset.id === route.datasetId) ?? null : null
  const { session, error } = useSessionDetail(activeSessionId)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [composerError, setComposerError] = useState<string | null>(null)
  const [artifactsOpen, setArtifactsOpen] = useState(false)
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null)
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

  useEffect(() => {
    if (route.view !== 'assistant') return
    const frame = window.requestAnimationFrame(() => {
      focusAssistantComposer(!route.sessionId && route.draft ? route.draft : undefined)
    })
    const timeout = window.setTimeout(() => {
      focusAssistantComposer(!route.sessionId && route.draft ? route.draft : undefined)
    }, 150)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [route.draft, route.sessionId, route.view, session?.id])

  const activeAssistantRunId = useMemo(
    () => session?.runId ?? extractStartedRunId(session?.entries ?? []),
    [session],
  )
  const { payload: activeRunPayload } = useRunResultsById(activeAssistantRunId)
  const assistantArtifacts = useMemo(
    () => getProducedArtifacts(activeRunPayload).filter((artifact) => artifact.type !== 'remote_agent_session'),
    [activeRunPayload],
  )
  const primaryBriefingArtifact = useMemo(
    () => getDatasetBriefingArtifact(assistantArtifacts),
    [assistantArtifacts],
  )
  const primaryProfileArtifact = useMemo(
    () => getDatasetProfileArtifact(assistantArtifacts),
    [assistantArtifacts],
  )

  useEffect(() => {
    const selectedArtifactStillExists = assistantArtifacts.some(
      (artifact) => artifact.id === selectedArtifactId,
    )
    if (!selectedArtifactStillExists) {
      setSelectedArtifactId(assistantArtifacts[0]?.id ?? null)
    }
  }, [assistantArtifacts, selectedArtifactId])

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
          datasetId: scopedDataset?.id ?? null,
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
          const refreshed = await refreshSessionMessages(nextSessionId)
          window.dispatchEvent(new CustomEvent('alpha-research-dashboard-refresh'))
          const startedRunId = extractStartedRunId(refreshed.entries)
          if (startedRunId) {
            updateDashboardRoute({ view: 'assistant', sessionId: nextSessionId, runId: null })
            routeSessionIdRef.current = nextSessionId
          }
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
    <main className="dashboard-assistant-page">
      <section className="dashboard-assistant-thread">
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
        <AssistantRuntimeProvider runtime={runtime}>
          <Thread
            welcomeTitle="What do you want to research?"
            welcomeDescription=""
            welcomeImageSrc="/alpha-book-man.png"
            showWelcome={!activeSessionId}
            scrollToBottomKey={activeSessionId && messages.length > 0 ? `${activeSessionId}:${messages.length}` : null}
            datasets={datasets.map((dataset) => ({
              id: dataset.id,
              name: dataset.name,
              description: dataset.description || dataset.sourceFilename,
              status: dataset.status,
            }))}
            renderAssistantBlock={(custom) => {
              if (custom.plannedRemoteRun === true) {
                const datasetId = typeof custom.datasetId === 'string' ? custom.datasetId : null
                const prompt = typeof custom.prompt === 'string' ? custom.prompt : null
                const sessionId = conversationStateRef.current.sessionId ?? routeSessionIdRef.current
                if (datasetId && prompt && sessionId) {
                  return (
                    <RemoteRunPlanApprovalBlock
                      datasetId={datasetId}
                      prompt={prompt}
                      onApprove={async () => {
                        await approveRemoteRunPlan(sessionId)
                        const refreshed = await refreshSessionMessages(sessionId)
                        window.dispatchEvent(new CustomEvent('alpha-research-dashboard-refresh'))
                        const startedRunId = extractStartedRunId(refreshed.entries)
                        if (startedRunId) {
                          updateDashboardRoute({ view: 'assistant', sessionId, runId: null })
                          routeSessionIdRef.current = sessionId
                        }
                      }}
                    />
                  )
                }
              }
              const runId = typeof custom.runId === 'string' ? custom.runId : null
              if (!runId) return null
              return (
                <RemoteRunBlock
                  runId={runId}
                  initialStatus={typeof custom.status === 'string' ? custom.status : null}
                />
              )
            }}
          />
        </AssistantRuntimeProvider>
      </section>
      {assistantArtifacts.length > 0 ? (
        <RunOutputsRail
          artifacts={assistantArtifacts}
          selectedArtifactId={selectedArtifactId}
          onOpenArtifact={(artifactId) => {
            setSelectedArtifactId(artifactId)
            setArtifactsOpen(true)
          }}
        />
      ) : null}
      <RunArtifactsPanel
        open={artifactsOpen}
        onClose={() => setArtifactsOpen(false)}
        producedArtifacts={assistantArtifacts}
        selectedArtifactId={selectedArtifactId}
        onSelectArtifact={setSelectedArtifactId}
        primaryArtifactId={primaryBriefingArtifact?.id ?? null}
        profileArtifactId={primaryProfileArtifact?.id ?? null}
      />
    </main>
  )
}

function RunArtifactsPanel({
  open,
  onClose,
  producedArtifacts,
  selectedArtifactId,
  onSelectArtifact,
  primaryArtifactId,
  profileArtifactId,
}: {
  open: boolean
  onClose: () => void
  producedArtifacts: RunArtifactRecord[]
  selectedArtifactId: string | null
  onSelectArtifact: (artifactId: string) => void
  primaryArtifactId: string | null
  profileArtifactId: string | null
}) {
  const panelRef = useRef<HTMLElement | null>(null)
  const [panelWidth, setPanelWidth] = useState(900)
  const [treeWidth, setTreeWidth] = useState(360)
  const visibleArtifacts = producedArtifacts.filter(
    (artifact) => artifact.type !== 'remote_agent_session',
  )
  const orderedArtifacts = useMemo(
    () => [...visibleArtifacts].sort((a, b) => {
      const rankDelta = artifactSortRank(a, primaryArtifactId, profileArtifactId) - artifactSortRank(b, primaryArtifactId, profileArtifactId)
      if (rankDelta !== 0) return rankDelta
      return artifactPath(a).localeCompare(artifactPath(b))
    }),
    [primaryArtifactId, profileArtifactId, visibleArtifacts],
  )
  const selectedArtifact =
    orderedArtifacts.find((artifact) => artifact.id === selectedArtifactId) ??
    orderedArtifacts[0] ??
    null
  const selectedPath = selectedArtifact ? artifactPath(selectedArtifact) : null

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

  const renderArtifactButton = (artifact: RunArtifactRecord) => {
    const path = artifactPath(artifact)
    return (
      <button
        key={artifact.id}
        type="button"
        className={[
          'flex w-full min-w-0 items-center gap-3 px-5 py-3 text-left hover:bg-muted',
          selectedPath === path ? 'bg-muted font-semibold' : '',
        ].join(' ')}
        onClick={() => onSelectArtifact(artifact.id)}
      >
        {fileIconFor(path, artifact)}
        <span className="min-w-0 truncate text-sm">{path}</span>
      </button>
    )
  }

  if (!open) {
    return null
  }

  return (
    <aside
      ref={panelRef}
      className="absolute inset-y-0 right-0 z-40 flex h-full min-h-0 w-full shrink-0 bg-background shadow-2xl md:w-[var(--run-panel-width)]"
      style={{ '--run-panel-width': `${panelWidth}px` } as CSSProperties}
      aria-label="Run artifacts"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        className="absolute -left-1 top-0 z-20 hidden h-full w-2 cursor-col-resize items-center justify-center hover:bg-primary/10 md:flex"
        onPointerDown={beginPanelResize}
      >
        <GripVertical className="size-3 text-muted-foreground/50" />
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_8px_var(--tree-width)] md:grid-rows-none" style={{ '--tree-width': `${treeWidth}px` } as CSSProperties}>
        <FilePreview artifact={selectedArtifact} />
        <div
          role="separator"
          aria-orientation="vertical"
          className="hidden cursor-col-resize items-center justify-center bg-background hover:bg-primary/10 md:flex"
          onPointerDown={beginTreeResize}
        >
          <GripVertical className="size-3 text-muted-foreground/50" />
        </div>
        <div className="flex max-h-56 min-h-0 flex-col border-t border-border md:max-h-none md:border-t-0">
          <div className="flex h-12 shrink-0 items-center justify-end px-4">
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close files">
              <X className="size-5" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            {visibleArtifacts.length > 0 ? (
              <div>{orderedArtifacts.map((artifact) => renderArtifactButton(artifact))}</div>
            ) : (
              <div />
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}

function RunOutputsRail({
  artifacts,
  selectedArtifactId,
  onOpenArtifact,
}: {
  artifacts: RunArtifactRecord[]
  selectedArtifactId: string | null
  onOpenArtifact: (artifactId: string) => void
}) {
  return (
    <aside className="dashboard-outputs-rail" aria-label="Outputs">
      <div className="dashboard-outputs-toggle">
        <span className="dashboard-outputs-toggle-copy">
          <span className="dashboard-outputs-label">Outputs</span>
          <span className="dashboard-outputs-count">{artifacts.length}</span>
        </span>
      </div>
      <div className="dashboard-outputs-list" role="list">
        {artifacts.map((artifact) => {
          const path = artifactPath(artifact)
          return (
            <button
              key={artifact.id}
              type="button"
              className={[
                'dashboard-output-link',
                selectedArtifactId === artifact.id ? 'is-active' : '',
              ].join(' ')}
              role="listitem"
              onClick={() => onOpenArtifact(artifact.id)}
              title={path}
            >
              {fileIconFor(path, artifact)}
              <span className="dashboard-output-link-name">{path}</span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function FilePreview({
  artifact,
}: {
  artifact: RunArtifactRecord | null
}) {
  if (!artifact) {
    return <div className="min-h-0" />
  }

  const path = artifactPath(artifact)
  const language = artifactLanguage(path, artifact)
  const text = artifactText(artifact)
  const downloadHref = artifactDownloadHref(artifact)

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-4 px-5 py-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{path}</div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {language === 'pdf' || language === 'image' ? (
            <a
              href={downloadHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Open
            </a>
          ) : null}
          <a
            href={downloadHref}
            download={artifactDownloadFilename(artifact)}
            target={artifact.url ? '_blank' : undefined}
            rel={artifact.url ? 'noreferrer' : undefined}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            aria-label={`Download ${path}`}
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
      {language === 'image' && (typeof artifact.content?.base64 === 'string' || artifact.url) ? (
        <div className="min-h-0 flex-1 overflow-auto bg-muted/10 p-6">
          <img
            src={downloadHref}
            alt={artifact.title}
            className="mx-auto max-h-full max-w-full border border-border bg-background object-contain"
          />
        </div>
      ) : language === 'image' ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-6">
          <div className="max-w-md border border-border bg-muted/10 px-6 py-5 text-center">
            <FileText className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-base font-semibold">Image artifact</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This image was saved as an artifact, but its bytes were not captured for inline preview. Open or download it from the artifact controls.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button type="button" size="sm" variant="outline" asChild>
                <a href={downloadHref} target="_blank" rel="noreferrer">Open image</a>
              </Button>
              <Button type="button" size="sm" variant="ghost" asChild>
                <a href={downloadHref} download={artifactDownloadFilename(artifact)}>Download</a>
              </Button>
            </div>
          </div>
        </div>
      ) : language === 'pdf' ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-6">
          <div className="max-w-md border border-border bg-muted/10 px-6 py-5 text-center">
            <FileText className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-base font-semibold">PDF artifact</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              PDF files are saved as artifacts, but the dashboard does not inline them because browser PDF support is inconsistent in the embedded panel.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button type="button" size="sm" variant="outline" asChild>
                <a href={downloadHref} target="_blank" rel="noreferrer">Open PDF</a>
              </Button>
              <Button type="button" size="sm" variant="ghost" asChild>
                <a href={downloadHref} download={artifactDownloadFilename(artifact)}>Download</a>
              </Button>
            </div>
          </div>
        </div>
      ) : artifact.url ? (
        <iframe title={artifact.title} src={artifact.url} className="min-h-0 flex-1 bg-background" />
      ) : language === 'markdown' ? (
        <article className="min-h-0 flex-1 overflow-auto px-8 py-6">
          <div className="max-w-[38rem]">
            {renderPreviewMarkdown(text)}
          </div>
        </article>
      ) : language === 'html' ? (
        artifactHtmlHref(artifact) ? (
          <iframe title={artifact.title} src={artifactHtmlHref(artifact) ?? undefined} className="min-h-0 flex-1 bg-background" />
        ) : (
          <div className="min-h-0 flex-1 px-8 py-6 text-sm text-muted-foreground">
            HTML report content was not captured for this artifact. Re-run the report to regenerate the embedded HTML preview.
          </div>
        )
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
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancellingRun, setCancellingRun] = useState(false)
  const [currentRun, setCurrentRun] = useState(run)
  const hasRemoteLogs = useMemo(() => hasRemoteRunLogs(payload), [payload])
  const requestedArtifacts = useMemo(() => getRequestedArtifacts(payload), [payload])
  const producedArtifacts = useMemo(() => getProducedArtifacts(payload), [payload])
  const cliMessages = useMemo(() => buildCliTranscript(currentRun, dataset, payload), [currentRun, dataset, payload])
  const remoteMessages = useMemo(() => buildRemoteTranscript(currentRun, dataset, payload), [currentRun, dataset, payload])
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
      .map((artifact, index) => requestedArtifactName(artifact, index))
      .filter((value): value is string => Boolean(value))
    return requested.length > 0 ? requested : ['Dataset Briefing', 'Dataset Profile']
  }, [requestedArtifacts])
  const transcriptEntries = useMemo(
    () => (hasRemoteLogs ? [...observedProgressMessages, ...remoteMessages] : cliMessages),
    [cliMessages, hasRemoteLogs, observedProgressMessages, remoteMessages],
  )
  const artifactCount = visibleProducedArtifacts.length
  const isCompletedRun = isTerminalSuccessfulRun(currentRun)
  const isRunningRun = currentRun.status.toLowerCase() === 'running'
  const isUncertainRun = isUncertainRunStatus(currentRun.status)
  const runningSummary = useMemo(
    () => (isRunningRun ? buildRunningRunSummary(currentRun, payload, dataset) : null),
    [currentRun, dataset, isRunningRun, payload],
  )
  const stuckSummary = useMemo(
    () => (isUncertainRun ? buildStuckRunSummary(currentRun, payload, dataset, artifactCount, expectedArtifactNames) : null),
    [artifactCount, currentRun, dataset, expectedArtifactNames, isUncertainRun, payload],
  )
  useEffect(() => {
    setCurrentRun(run)
  }, [run])

  useEffect(() => {
    if (payload?.run) {
      setCurrentRun(payload.run)
    }
  }, [payload])

  const handleCancelRun = async () => {
    setCancellingRun(true)
    try {
      const response = await cancelRun(currentRun.id)
      setCurrentRun(response.run)
      setCancelDialogOpen(false)
    } catch (cancelError) {
      console.error(cancelError)
    } finally {
      setCancellingRun(false)
    }
  }

  useEffect(() => {
    const selectedArtifactStillExists = visibleProducedArtifacts.some(
      (artifact) => artifact.id === selectedArtifactId,
    )
    if (!selectedArtifactStillExists) {
      setSelectedArtifactId(visibleProducedArtifacts[0]?.id ?? null)
    }
  }, [selectedArtifactId, visibleProducedArtifacts])

  return (
    <div className="dashboard-run-detail flex min-h-0 flex-1 bg-background">
      <div className="relative min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8" data-run-detail-scroll>
        <div className="mx-auto flex w-full max-w-[52rem] flex-col">
          {artifactCount > 0 ? (
            <div className="dashboard-artifacts-action mb-4 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setArtifactsOpen(true)}>
                Artifacts
              </Button>
            </div>
          ) : null}
          {isCompletedRun && primaryBriefingArtifact ? (
            <section className="mb-6 flex flex-col gap-4 border-b border-border pb-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-normal">
                  {dataset?.name ?? 'Dataset'} · {formatStatus(currentRun.type)} run
                </h2>
                <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">Dataset briefing ready</h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  The durable briefing stays attached to this run as an artifact, alongside the generated dataset profile and supporting files.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    setSelectedArtifactId(primaryBriefingArtifact.id)
                    setArtifactsOpen(true)
                  }}
                >
                  Open briefing artifact
                </Button>
                {primaryProfileArtifact ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      setSelectedArtifactId(primaryProfileArtifact.id)
                      setArtifactsOpen(true)
                    }}
                  >
                    Open profile artifact
                  </Button>
                ) : null}
              </div>
            </section>
          ) : null}
          {isCompletedRun && primaryBriefingArtifact ? (
            <article className="mb-8 text-[0.95rem] leading-7 text-foreground">
              {artifactLanguage(artifactPath(primaryBriefingArtifact), primaryBriefingArtifact) === 'html' ? (
                artifactHtmlHref(primaryBriefingArtifact) ? (
                  <iframe
                    title={primaryBriefingArtifact.title}
                    src={artifactHtmlHref(primaryBriefingArtifact) ?? undefined}
                    className="h-[70vh] w-full border border-border bg-background"
                  />
                ) : (
                  <div className="border border-border px-6 py-5 text-sm text-muted-foreground">
                    HTML report content was not captured for this artifact. Re-run the report to regenerate the embedded HTML preview.
                  </div>
                )
              ) : (
                renderPreviewMarkdown(artifactText(primaryBriefingArtifact))
              )}
            </article>
          ) : null}
          {isRunningRun && runningSummary ? (
            <section className="mb-8 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <LoaderCircle className="mt-1 size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                <p className="text-sm leading-6 text-foreground/85">{runningSummary.currentActivity}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="destructive" onClick={() => setCancelDialogOpen(true)}>
                  Cancel
                </Button>
              </div>
            </section>
          ) : null}
          {isUncertainRun && stuckSummary ? (
            <section className="mb-8 flex flex-col gap-4">
              <p className="text-sm leading-6 text-foreground/85">{stuckSummary.summary}</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => updateDashboardRoute({
                    view: 'assistant',
                    datasetId: currentRun.datasetId,
                    runId: null,
                    sessionId: null,
                    draft: currentRun.prompt?.trim() || null,
                  })}
                >
                  Retry
                </Button>
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
            <AssistantTranscript
              entries={transcriptEntries}
              emptyTitle="No run transcript yet"
              emptyDescription="Persisted run turns and events will appear here."
              unframed
            />
          </section>
        </div>
      </div>
      {artifactCount > 0 ? (
        <RunOutputsRail
          artifacts={visibleProducedArtifacts}
          selectedArtifactId={selectedArtifactId}
          onOpenArtifact={(artifactId) => {
            setSelectedArtifactId(artifactId)
            setArtifactsOpen(true)
          }}
        />
      ) : null}

      <RunArtifactsPanel
        open={artifactsOpen}
        onClose={() => setArtifactsOpen(false)}
        producedArtifacts={producedArtifacts}
        selectedArtifactId={selectedArtifactId}
        onSelectArtifact={setSelectedArtifactId}
        primaryArtifactId={primaryBriefingArtifact?.id ?? null}
        profileArtifactId={primaryProfileArtifact?.id ?? null}
      />
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent aria-describedby="cancel-run-description">
          <DialogHeader>
            <DialogTitle>Cancel Run</DialogTitle>
            <DialogDescription id="cancel-run-description">
              Stop this job if it is wrong or no longer worth the time or cost. Cancellation cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-6 text-foreground/85">
            <p>What stays available after cancel:</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Any artifacts already saved to this run</li>
              <li>Observed progress and transcript evidence already recorded</li>
              <li>The cancelled run record for later review or handoff</li>
            </ul>
            <p className="text-muted-foreground">
              What stops immediately: active worker time, new artifacts, and further progress on this run.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancellingRun}>
              Keep running
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleCancelRun()} disabled={cancellingRun}>
              {cancellingRun ? 'Cancelling...' : 'Confirm cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      return path.endsWith('work.md') || path.endsWith('result.json')
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
        producedArtifacts={linkedArtifacts}
        selectedArtifactId={selectedArtifactId}
        onSelectArtifact={setSelectedArtifactId}
        primaryArtifactId={primaryArtifactCandidates.find((artifact) => artifactPath(artifact).endsWith('work.md'))?.id ?? null}
        profileArtifactId={primaryArtifactCandidates.find((artifact) => artifactPath(artifact).endsWith('result.json'))?.id ?? null}
      />
    </div>
  )
}

const DASHBOARD_BOOT_SESSION: SessionResponse = {
  authenticated: true,
  configured: true,
  user: { email: '' },
}

function DashboardSignedOut({
  session,
}: {
  session: SessionResponse
}) {
  const destinationLabel = describeSignedOutDestination()

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border px-4 py-4 md:px-8">
        <img
          className="block h-[29px] w-36 object-contain object-left"
          src="/alpha-research-wordmark.png"
          alt="Alpha Research"
          width="1505"
          height="300"
        />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8 md:px-8">
        <Empty className="w-full max-w-xl border-0 px-0 py-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Bot />
            </EmptyMedia>
            <EmptyTitle>Sign in to continue to {destinationLabel}</EmptyTitle>
            <EmptyDescription>
              {session.configured
                ? `You're signed out. Sign in to keep going, and we'll bring you back to ${destinationLabel} after login.`
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
  )
}

type DashboardRouteState = ReturnType<typeof getDashboardRoute>

function DashboardMobileHeader({
  route,
}: {
  route: DashboardRouteState
}) {
  const title =
    route.view === 'datasets'
      ? 'Datasets'
      : route.view === 'runs'
        ? 'Runs'
        : route.view === 'terminal-sessions'
          ? 'Sessions'
          : 'Research chat'

  return (
    <header className="dashboard-mobile-header flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-3 md:hidden">
      <SidebarTrigger className="size-10 shrink-0" aria-label="Open dashboard navigation" />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-muted-foreground">Alpha Research</div>
      </div>
    </header>
  )
}

function DashboardSidebar({
  route,
  session,
  datasets,
  runs,
  recentAssistantSessions,
  showResearchChats,
}: {
  route: DashboardRouteState
  session: SessionResponse
  datasets: DatasetRecord[]
  runs: RunRecord[]
  recentAssistantSessions: Array<StoredAssistantSession & {
    dataset?: DatasetRecord
    run?: RunRecord
  }>
  showResearchChats: boolean
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  const isActiveSessionRun = (chatSession: { run?: RunRecord }) =>
    Boolean(chatSession.run && !isTerminalRunStatus(chatSession.run.status))
  const navigate = (next: {
    view?: DashboardView
    datasetId?: string | null
    runId?: string | null
    sessionId?: string | null
    draft?: string | null
    topic?: string | null
  }) => {
    updateDashboardRoute(next)
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="dashboard-sidebar">
      <SidebarHeader className="dashboard-sidebar-header border-b border-sidebar-border px-3 py-4">
        <a href={rootOrigin} className="dashboard-wordmark-link flex items-center">
          <span className="dashboard-wordmark-text">alpha research</span>
        </a>
      </SidebarHeader>
      <SidebarContent className="dashboard-sidebar-content">
        {showResearchChats ? (
          <SidebarGroup className="dashboard-sidebar-group">
            <SidebarGroupContent>
              <SidebarMenu className="dashboard-sidebar-menu">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="dashboard-nav-button dashboard-new-chat"
                    isActive={route.view === 'assistant' && !route.sessionId}
                    onClick={() =>
                      navigate({
                        view: 'assistant',
                        runId: null,
                        sessionId: null,
                      })}
                  >
                    <MessageSquarePlus />
                    <span>New chat</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem className="dashboard-recents-heading">
                  <SidebarGroupLabel className="dashboard-sidebar-label">
                    <span>Recents</span>
                    <span>{recentAssistantSessions.length} chats</span>
                  </SidebarGroupLabel>
                </SidebarMenuItem>
                {recentAssistantSessions.map((chatSession) => (
                  <SidebarMenuItem key={chatSession.id}>
                    <SidebarMenuButton
                      className="dashboard-nav-button dashboard-recent-chat h-10 md:h-9"
                      isActive={route.view === 'assistant' && route.sessionId === chatSession.id}
                      onClick={() =>
                        navigate({
                          view: 'assistant',
                          runId: null,
                          sessionId: chatSession.id,
                        })}
                    >
                      {isActiveSessionRun(chatSession) ? (
                        <LoaderCircle
                          className="size-3.5 shrink-0 animate-spin text-muted-foreground"
                          aria-label="Active run"
                        />
                      ) : null}
                      <span className="min-w-0 truncate text-sm font-medium normal-case tracking-normal text-foreground">
                        {readableSessionTitle(chatSession.title)}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter className="dashboard-sidebar-footer border-t border-sidebar-border p-3">
        <SidebarMenu className="dashboard-sidebar-menu mb-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              className="dashboard-nav-button h-11 md:h-8"
              isActive={route.view === 'datasets'}
              onClick={() =>
                navigate({
                  view: 'datasets',
                  runId: null,
                  sessionId: null,
                })}
            >
              <Database />
              <span className="dashboard-nav-label">Datasets</span>
              <span className="dashboard-nav-count">
                {datasets.length}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="dashboard-nav-button h-11 md:h-8"
              tooltip="Runs"
              isActive={route.view === 'runs'}
              onClick={() =>
                navigate({
                  view: 'runs',
                  runId: null,
                  sessionId: null,
                })}
            >
              <History />
              <span className="dashboard-nav-label">Runs</span>
              <span className="dashboard-nav-count">
                {runs.length}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="dashboard-account-button flex h-auto w-full min-w-0 items-center justify-start overflow-hidden rounded-xl px-3 py-3 text-left hover:bg-sidebar-accent/60"
            >
              <div className="flex min-w-0 flex-col items-start">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Signed in
                </span>
                <span className="truncate text-base font-normal normal-case tracking-normal text-foreground/90">
                  {session.user?.email ?? 'Signed in'}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-none">
            <DropdownMenuItem
              onClick={async () => {
                await fetch('/api/auth/logout', {
                  method: 'POST',
                  credentials: 'same-origin',
                })
                window.location.assign(getDashboardAuthReturnUrl({ loggedOut: true }))
              }}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
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
  const showResearchChats = true

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
        onAskDataset={(selectedDataset, prompt) =>
          updateDashboardRoute({
            view: 'assistant',
            datasetId: selectedDataset.id,
            runId: null,
            sessionId: null,
            draft: prompt?.trim() || null,
          })}
      />
    )
  } else if (route.view === 'datasets' && route.datasetId && !dataError) {
    content = <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-8" />
  } else if (route.view === 'datasets') {
    const hasDatasets = datasets.length > 0
    content = (
      <main className="flex flex-1 min-w-0 flex-col gap-10 overflow-y-auto px-4 py-10 md:px-8">
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-normal">Datasets</h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            {dataError
              ? 'You are signed in, but Alpha Research cannot verify dataset availability until dashboard data loads successfully.'
              : hasDatasets
              ? 'See what data is available, what each dataset covers, and whether it is ready to use. Open any dataset for provenance, schema, profile details, and generated briefings.'
              : 'New workspaces start here. Add one file or source plus a short description, then come back here to inspect readiness, provenance, and the first research-ready dataset.'}
          </p>
        </section>
        <section>
          <DatasetFeed
            datasets={datasets}
            topic={route.topic}
            dataError={dataError}
            onRetry={() => window.dispatchEvent(new CustomEvent('alpha-research-dashboard-refresh'))}
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
      <main className="flex min-h-0 flex-1 min-w-0 flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8">
        {dataError ? (
          <Card className="rounded-none border border-destructive/25 bg-destructive/5 py-0 shadow-none">
            <CardContent className="px-6 py-4 text-sm text-destructive">{dataError}</CardContent>
          </Card>
        ) : null}
        <section className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <div className="px-1">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Runs
            </div>
          </div>
          <RunTable
            runs={runs}
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
      />
    )
  }

  return (
    <SidebarProvider defaultOpen className="dashboard-shell">
      <DashboardSidebar
        route={route}
        session={session}
        datasets={datasets}
        runs={runs}
        recentAssistantSessions={recentAssistantSessions}
        showResearchChats={showResearchChats}
      />

      <SidebarInset className="dashboard-main-inset min-h-0 overflow-hidden overscroll-none bg-background">
        <div className="dashboard-main-panel flex h-svh min-h-0 flex-col overflow-hidden overscroll-none">
          <DashboardMobileHeader route={route} />
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
          if (!loggedOut) {
            beginDashboardBridge()
            return
          }

          if (!cancelled) {
            setState({ type: 'signed-out', session })
          }
          return
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
                dashboardDataErrorSummary(error),
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
    return (
      <DashboardApp
        session={DASHBOARD_BOOT_SESSION}
        datasets={[]}
        runs={[]}
        sessions={[]}
      />
    )
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
              <a className="button-small ghost-button" href={DOCS_ORIGIN}>docs</a>
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
              <a href={DOCS_ORIGIN}>docs</a>
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
