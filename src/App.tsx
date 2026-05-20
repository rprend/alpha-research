import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { AssistantRuntimeProvider, useExternalStoreRuntime, type ThreadMessage } from '@assistant-ui/react'
import {
  Bot,
  Braces,
  ChevronDown,
  ChevronRight,
  CircleArrowOutUpRight,
  Download,
  Database,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  GripVertical,
  History,
  LoaderCircle,
  LogOut,
  Orbit,
  MoreHorizontal,
  PanelRightOpen,
  Rocket,
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
  CardDescription,
  CardHeader,
  CardTitle,
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

type DatasetFreshnessSummary = {
  trustLabel: string
  trustTone: 'default' | 'secondary' | 'destructive' | 'outline'
  headline: string
  reason: string
  actionLabel: string
  actionHint: string
  sourceCoverage: string
  ingestFreshness: string
  deploymentReadiness: string
  knownGaps: string
}

type RunRecord = {
  id: string
  datasetId: string
  type: string
  status: string
  prompt: string | null
  outputPreview: string | null
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
  const text = `${dataset.name} ${dataset.sourceType} ${dataset.description ?? ''}`.toLowerCase()
  return text.includes('public') || ['public_data', 'mixed_data', 'research_environment'].includes(dataset.sourceType)
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

function ingestText(config: unknown, key: string) {
  if (!isRecord(config)) return null
  const value = config[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function ingestStringArray(config: unknown, key: string) {
  if (!isRecord(config)) return []
  const value = config[key]
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

function statusTone(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ready':
      return 'default'
    case 'blocked':
      return 'destructive'
    case 'processing':
      return 'secondary'
    default:
      return 'outline'
  }
}

function datasetFreshnessSummary(
  dataset: DatasetRecord,
  canDescribe: boolean,
  describeIsRunning: boolean,
  describedAt: string | null,
): DatasetFreshnessSummary {
  const sourceDateRange = ingestText(dataset.ingestConfig, 'sourceDateRange') ?? profileText(dataset.profile?.profile, 'timeCoverage')
  const coverageSummary = ingestText(dataset.ingestConfig, 'coverageSummary')
  const knownGaps = ingestText(dataset.ingestConfig, 'knownGaps') ?? profileText(dataset.profile?.profile, 'coverageGaps')
  const readyForAnalysis = canDescribe && Boolean(dataset.profile?.briefingMarkdown)
  const deploymentBlocked = dataset.deploymentStatus !== 'ready'
  const processing = describeIsRunning || ['running', 'processing', 'queued', 'uploading'].includes(dataset.status.toLowerCase()) || ['running', 'processing', 'queued'].includes(dataset.deploymentStatus.toLowerCase())
  const blocked = !readyForAnalysis && deploymentBlocked
  const trustStatus = readyForAnalysis ? 'ready' : blocked ? 'blocked' : processing ? 'processing' : 'review'
  const publicSources = ingestStringArray(dataset.ingestConfig, 'publicSources')
  const sourceCoverage =
    sourceDateRange && coverageSummary
      ? `${sourceDateRange}. ${coverageSummary}`
      : sourceDateRange
        ? sourceDateRange
        : coverageSummary
          ? coverageSummary
          : publicSources.length > 0
            ? `Includes ${publicSources.map((source) => source.toUpperCase()).join(' and ')} public sources.`
            : 'Source coverage has not been documented yet.'
  const ingestFreshness = describedAt
    ? `Last dataset briefing: ${formatDateTime(describedAt)}`
    : `Last dataset update: ${formatDateTime(dataset.updatedAt)}`
  const deploymentReadiness = dataset.deploymentStatus === 'ready'
    ? 'Environment is deployed and the dataset can be inspected.'
    : processing
      ? 'Environment setup is still running, so readiness checks are incomplete.'
      : 'Environment is not deployed, so the dashboard cannot verify readiness yet.'
  const actionLabel = canDescribe ? 'Describe dataset' : 'Describe unavailable'
  const actionHint = canDescribe
    ? 'Generate or refresh the dataset briefing.'
    : processing
      ? 'Wait for processing to finish before generating the briefing.'
      : 'Deploy the dataset environment before generating the briefing.'

  if (trustStatus === 'ready') {
    return {
      trustLabel: 'Ready to use',
      trustTone: statusTone(trustStatus),
      headline: 'Current enough for analysis',
      reason: 'Freshness, source coverage, and the latest briefing are available on this page.',
      actionLabel,
      actionHint,
      sourceCoverage,
      ingestFreshness,
      deploymentReadiness,
      knownGaps: knownGaps ?? 'No critical gaps are called out in the current briefing.',
    }
  }
  if (trustStatus === 'blocked') {
    return {
      trustLabel: 'Not ready',
      trustTone: statusTone(trustStatus),
      headline: 'Trust decision is blocked',
      reason: 'The dataset environment is not deployed, so Alpha Research cannot confirm whether this data is current enough to use.',
      actionLabel,
      actionHint,
      sourceCoverage,
      ingestFreshness,
      deploymentReadiness,
      knownGaps: knownGaps ?? 'Coverage gaps cannot be verified until the dataset environment is available.',
    }
  }
  if (trustStatus === 'processing') {
    return {
      trustLabel: 'Processing',
      trustTone: statusTone(trustStatus),
      headline: 'Freshness check still in progress',
      reason: 'The dataset was updated recently, but readiness checks are still running.',
      actionLabel,
      actionHint,
      sourceCoverage,
      ingestFreshness,
      deploymentReadiness,
      knownGaps: knownGaps ?? 'Coverage and limitations will appear after processing completes.',
    }
  }
  return {
    trustLabel: 'Needs review',
    trustTone: statusTone(trustStatus),
    headline: 'Review before using this dataset',
    reason: 'Some readiness information is present, but the dashboard cannot yet make a clean trust recommendation.',
    actionLabel,
    actionHint,
    sourceCoverage,
    ingestFreshness,
    deploymentReadiness,
    knownGaps: knownGaps ?? 'Known gaps have not been documented yet.',
  }
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

function isBrowsableArtifact(artifact: RunArtifactRecord) {
  return artifact.type !== 'remote_agent_summary' && artifact.type !== 'remote_agent_transcript'
}

function getProducedArtifacts(payload: RunResultsResponse | null) {
  return (payload?.artifacts ?? []).filter((artifact) => isBrowsableArtifact(artifact))
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

function artifactRequestMatch(
  artifact: RunArtifactRecord,
  requestedArtifacts: Array<Record<string, unknown>>,
) {
  return requestedArtifacts.find((requested) => {
    const requestedType = typeof requested.type === 'string' ? requested.type : null
    const requestedTitle = typeof requested.title === 'string' ? requested.title : null
    return requestedType === artifact.type && requestedTitle === artifact.title
  }) ?? null
}

function isPrimaryArtifact(artifact: RunArtifactRecord) {
  const path = artifactPath(artifact).toLowerCase()
  return path === 'summary.md' || artifact.title.toLowerCase() === 'summary.md'
}

function artifactRoleLabel(
  artifact: RunArtifactRecord,
  requestedArtifacts: Array<Record<string, unknown>>,
) {
  if (isPrimaryArtifact(artifact)) return 'Final result'
  if (artifactRequestMatch(artifact, requestedArtifacts)) return 'Requested output'
  if (artifact.type === 'structured_result') return 'Supporting data'
  if (artifact.type === 'table' || artifact.type === 'chart') return 'Supporting output'
  if (artifact.type === 'script') return 'Supporting script'
  return 'Produced file'
}

function choosePrimaryArtifact(artifacts: RunArtifactRecord[]) {
  return artifacts.find((artifact) => isPrimaryArtifact(artifact))
    ?? artifacts.find((artifact) => artifact.type === 'structured_result')
    ?? artifacts.find((artifact) => artifact.type !== 'script')
    ?? artifacts[0]
    ?? null
}

function downloadArtifact(artifact: RunArtifactRecord) {
  if (typeof document === 'undefined') return
  const path = artifactPath(artifact)
  const language = artifactLanguage(path, artifact)
  const content = language === 'json' ? artifactJsonPreview(artifact) : artifactText(artifact)
  const blob = new Blob([content], { type: language === 'json' ? 'application/json' : 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = path.split('/').pop() || artifact.title
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
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
  const producedArtifacts = artifacts.filter((artifact) => isRecord(artifact)
    && typeof artifact.type === 'string'
    && typeof artifact.title === 'string'
    && isBrowsableArtifact(artifact as RunArtifactRecord))
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

  if (payload?.metadata?.config) {
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

function StatusBadge({
  children,
  variant = 'outline',
}: {
  children: string
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}) {
  return (
    <Badge
      variant={variant}
      className="rounded-none border-border bg-background px-2.5 py-1 text-[11px] tracking-[0.18em]"
    >
      {children}
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
      <DatasetFeedSection title="Your datasets" datasets={privateDatasets} onSelectDataset={onSelectDataset} />
      <DatasetFeedSection title="Public datasets" datasets={publicDatasets} onSelectDataset={onSelectDataset} />
    </div>
  )
}

function DatasetFeedSection({
  title,
  datasets,
  onSelectDataset,
}: {
  title: string
  datasets: DatasetRecord[]
  onSelectDataset: (dataset: DatasetRecord) => void
}) {
  if (datasets.length === 0) {
    return null
  }
  return (
    <section className="flex flex-col gap-4">
      <div className="border-b border-border pb-3 text-xl font-medium">{title}</div>
      <div className="grid gap-x-16 gap-y-7 md:grid-cols-2">
        {datasets.map((dataset) => {
          const description =
            dataset.description?.trim() ||
            dataset.sourceFilename?.trim() ||
            `Source type: ${formatStatus(dataset.sourceType)}`
          return (
            <button
              key={dataset.id}
              type="button"
              className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-4 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/70"
              onClick={() => onSelectDataset(dataset)}
            >
              <div className="flex size-13 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Database className="size-6" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">{dataset.name}</div>
                <div className="truncate text-sm text-muted-foreground">{description}</div>
              </div>
              <StatusBadge>{formatStatus(dataset.deploymentStatus)}</StatusBadge>
            </button>
          )
        })}
      </div>
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
  const profileMetrics = [
    ['Sources', sourceCount],
    ['Tables', tableCount],
    ['Formats', formatCount],
    ['Limitations', limitationCount],
  ].filter((entry): entry is [string, number] => typeof entry[1] === 'number')
  const profileSummary = profileText(structuredProfile, 'summary')
  const freshness = datasetFreshnessSummary(current, canDescribe, describeIsRunning, describedAt)
  const sourceDateRange = ingestText(current.ingestConfig, 'sourceDateRange')
  const coverageSummary = ingestText(current.ingestConfig, 'coverageSummary')
  const knownGaps = ingestText(current.ingestConfig, 'knownGaps')

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

        <section className="rounded-xl border border-border bg-muted/20 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge variant={freshness.trustTone}>{freshness.trustLabel}</StatusBadge>
                <span className="text-sm text-muted-foreground">{freshness.ingestFreshness}</span>
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-normal">{freshness.headline}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{freshness.reason}</p>
              </div>
            </div>
            <div className="min-w-0 rounded-lg border border-border bg-background px-4 py-3 text-sm">
              <div className="font-medium">{freshness.actionLabel}</div>
              <div className="mt-1 text-muted-foreground">{freshness.actionHint}</div>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['Source date coverage', freshness.sourceCoverage],
              ['Deployment status', freshness.deploymentReadiness],
              ['Known gaps', freshness.knownGaps],
              ['Dataset size', formatBytes(current.sourceSizeBytes)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border bg-background px-4 py-3">
                <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">{label}</div>
                <div className="mt-2 text-sm leading-6 text-foreground/90">{value}</div>
              </div>
            ))}
          </div>
        </section>

        {error ? <div className="bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

        {profileMetrics.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-4">
            {profileMetrics.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border px-5 py-4">
                <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">{label}</div>
                <div className="mt-2 break-words text-2xl font-semibold">{value.toLocaleString()}</div>
              </div>
            ))}
          </section>
        ) : null}

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <div className="text-xl font-medium">Dataset briefing</div>
            <Button
              type="button"
              variant="outline"
              disabled={!canDescribe || startingDescribe}
              aria-label={canDescribe ? 'Describe dataset' : `${freshness.actionLabel}: ${freshness.actionHint}`}
              title={!canDescribe ? freshness.actionHint : undefined}
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
              {startingDescribe ? 'Starting...' : 'Describe dataset'}
            </Button>
          </div>
          {!canDescribe ? (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              {freshness.actionHint}
            </div>
          ) : null}
          {describedAt ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <FileText className="size-4" />
              <span>Briefing generated {formatDateTime(describedAt)}</span>
              {describeIsRunning ? <StatusBadge>Refreshing</StatusBadge> : null}
            </div>
          ) : null}
          {profileSummary ? (
            <div className="rounded-lg border border-border bg-muted/30 p-5 text-sm leading-7 text-muted-foreground">
              {profileSummary}
            </div>
          ) : null}
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
              <div className="space-y-2">
                <p className="text-sm leading-7 text-muted-foreground">
                  No dataset briefing has been generated yet.
                </p>
                <p className="text-sm leading-7 text-muted-foreground">
                  {canDescribe
                    ? 'Run Describe dataset to generate a plain-language briefing with freshness, source coverage, limitations, and analysis readiness.'
                    : freshness.reason}
                </p>
              </div>
            )}
          </div>
        </section>

        <details className="rounded-lg border border-border p-5">
          <summary className="cursor-pointer text-sm font-medium">Developer details</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {[
              ['Source file', current.sourceFilename ?? 'Unknown'],
              ['Mode', formatStatus(current.mode ?? 'default')],
              ['Manifest', current.manifestPath ?? 'Not available'],
              ['Source date coverage', sourceDateRange ?? 'Not available'],
              ['Coverage summary', coverageSummary ?? 'Not available'],
              ['Known gaps', knownGaps ?? 'Not available'],
              ['Dataset mount', current.volume?.mountPath ?? 'Not mounted'],
              ['Size', formatBytes(current.sourceSizeBytes)],
              ['Updated', formatDateTime(current.updatedAt)],
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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dataset</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => {
          const prompt =
            run.prompt?.trim() ||
            run.outputPreview?.trim() ||
            'No prompt recorded yet.'

          return (
            <TableRow
              key={run.id}
              className="cursor-pointer"
              onClick={() => onSelectRun(run)}
            >
              <TableCell className="align-top">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-medium">
                    {datasetLookup.get(run.datasetId)?.name ?? run.datasetId}
                  </span>
                  <span className="max-w-[30rem] text-sm whitespace-normal text-muted-foreground">
                    {truncate(prompt, 120)}
                  </span>
                </div>
              </TableCell>
              <TableCell>{formatStatus(run.type)}</TableCell>
              <TableCell>
                <StatusBadge>{formatStatus(run.status)}</StatusBadge>
              </TableCell>
              <TableCell>{formatDateTime(run.createdAt)}</TableCell>
              <TableCell>
                <div className="flex items-center justify-between gap-3">
                  <span>{relativeTime(run.updatedAt)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelectRun(run)
                    }}
                  >
                    View session
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
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
  runs,
}: {
  dataError?: string | null
  datasets: DatasetRecord[]
  runs: RunRecord[]
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

  const readyDatasets = useMemo(
    () => datasets.filter((dataset) => dataset.status.toLowerCase() === 'ready'),
    [datasets],
  )
  const launchDataset = readyDatasets[0] ?? datasets[0] ?? null
  const launchProfile = launchDataset?.profile?.profile
  const launchSchema = isRecord(launchDataset?.profile?.schema)
    ? launchDataset?.profile?.schema
    : null
  const launchColumns = Array.isArray(launchSchema?.columns)
    ? launchSchema.columns.filter((value): value is string => typeof value === 'string').slice(0, 4)
    : []
  const launchTables = profileArrayCount(launchProfile, 'tables')
  const launchFormats = Array.isArray((launchProfile as Record<string, unknown> | null)?.formats)
    ? ((launchProfile as Record<string, unknown>).formats as string[]).slice(0, 3)
    : []
  const latestDatasetRun = launchDataset
    ? runs
      .filter((run) => run.datasetId === launchDataset.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
    : null

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
              welcomeTitle={loading ? '' : 'Launch a research run'}
              welcomeDescription={loading ? '' : 'Start from a complete spec. Alpha Research preserves the request, asks only for field mismatches, and then moves into a traceable run.'}
              welcome={
                loading ? null : (
                  <AssistantLaunchWelcome
                    dataset={launchDataset}
                    latestDatasetRun={latestDatasetRun}
                    columnPreview={launchColumns}
                    launchTables={launchTables}
                    launchFormats={launchFormats}
                  />
                )
              }
              composerPlaceholder="Describe the run to launch: dataset, variables, time window, method, and outputs"
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

function AssistantLaunchWelcome({
  dataset,
  latestDatasetRun,
  columnPreview,
  launchTables,
  launchFormats,
}: {
  dataset: DatasetRecord | null
  latestDatasetRun: RunRecord | null
  columnPreview: string[]
  launchTables: number | null
  launchFormats: string[]
}) {
  return (
    <div className="my-auto flex w-full flex-col gap-6 py-8">
      <div className="max-w-3xl px-2">
        <Badge variant="secondary" className="mb-3 text-[0.68rem] tracking-[0.18em]">
          Prepared Run
        </Badge>
        <h1 className="text-3xl font-semibold tracking-normal text-foreground">
          Launch a well-specified run
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          Enter the full analysis request once. Alpha Research will preserve the dataset, variables,
          time window, method, and output expectations, then move the work into a traceable async run.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="gap-5 border border-border/70 bg-background/95 py-6 shadow-none">
          <CardHeader className="gap-2 px-6">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold uppercase tracking-[0.16em] text-foreground">
                Active Dataset
              </CardTitle>
              {dataset ? <StatusBadge>{formatStatus(dataset.status)}</StatusBadge> : null}
            </div>
            <CardDescription className="text-sm leading-6">
              Confirm the dataset once, then launch from the composer below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-6">
            {dataset ? (
              <>
                <div>
                  <div className="text-lg font-medium text-foreground">{dataset.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {dataset.description ?? dataset.sourceFilename ?? dataset.id}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <LaunchFact
                    icon={<Database className="size-4" />}
                    label="Dataset id"
                    value={dataset.id}
                  />
                  <LaunchFact
                    icon={<Table2 className="size-4" />}
                    label="Tables"
                    value={launchTables ? String(launchTables) : 'Profile ready'}
                  />
                  <LaunchFact
                    icon={<Braces className="size-4" />}
                    label="Fields"
                    value={columnPreview.length > 0 ? columnPreview.join(', ') : 'Open dataset to inspect fields'}
                  />
                  <LaunchFact
                    icon={<FileText className="size-4" />}
                    label="Formats"
                    value={launchFormats.length > 0 ? launchFormats.join(', ') : 'Structured dataset'}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateDashboardRoute({
                        view: 'datasets',
                        datasetId: dataset.id,
                        runId: null,
                        sessionId: null,
                      })}
                  >
                    Inspect dataset
                  </Button>
                  {latestDatasetRun ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updateDashboardRoute({
                          view: 'runs',
                          runId: latestDatasetRun.id,
                          datasetId: null,
                          sessionId: null,
                        })}
                    >
                      Open latest run
                    </Button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                Attach or select a dataset before launching a run.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-5 border border-border/70 bg-muted/20 py-6 shadow-none">
          <CardHeader className="gap-2 px-6">
            <CardTitle className="text-base font-semibold uppercase tracking-[0.16em] text-foreground">
              After You Launch
            </CardTitle>
            <CardDescription className="text-sm leading-6">
              The next state should be visible immediately instead of hiding behind generic chat copy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-6 text-sm leading-6 text-muted-foreground">
            <LaunchChecklist
              icon={<Rocket className="size-4 text-foreground" />}
              label="Run id and status"
              detail="A run starts quickly or the assistant asks only for unresolved field mappings."
            />
            <LaunchChecklist
              icon={<FileText className="size-4 text-foreground" />}
              label="Expected artifacts"
              detail="The run will track outputs like summary.md, result.json, tables, and charts."
            />
            <LaunchChecklist
              icon={<PanelRightOpen className="size-4 text-foreground" />}
              label="Destination"
              detail="Open the run view to monitor progress and inspect produced files."
            />
            <LaunchChecklist
              icon={<CircleArrowOutUpRight className="size-4 text-foreground" />}
              label="Requirement preservation"
              detail="Dataset, variables, time window, method, and output intent stay attached to the run."
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 px-2 text-sm text-muted-foreground md:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-border/70 px-4 py-3">
          <Orbit className="mt-0.5 size-4 shrink-0 text-foreground" />
          <p>Use the composer below to launch the run. If any field names do not match, the assistant should resolve only those mismatches.</p>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-border/70 px-4 py-3">
          <History className="mt-0.5 size-4 shrink-0 text-foreground" />
          <p>Past chats stay available, but they should not obscure the current run state once new work starts.</p>
        </div>
      </div>
    </div>
  )
}

function LaunchFact({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
      <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm leading-6 text-foreground">{value}</div>
    </div>
  )
}

function LaunchChecklist({
  icon,
  label,
  detail,
}: {
  icon: ReactNode
  label: string
  detail: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <div className="font-medium text-foreground">{label}</div>
        <div>{detail}</div>
      </div>
    </div>
  )
}

function RunArtifactsPanel({
  open,
  onClose,
  runPrompt,
  requestedArtifacts,
  producedArtifacts,
  selectedArtifactId,
  onSelectArtifact,
  remoteSessionId,
}: {
  open: boolean
  onClose: () => void
  runPrompt: string | null
  requestedArtifacts: Array<Record<string, unknown>>
  producedArtifacts: RunArtifactRecord[]
  selectedArtifactId: string | null
  onSelectArtifact: (artifactId: string) => void
  remoteSessionId: string | null
}) {
  const panelRef = useRef<HTMLElement | null>(null)
  const [panelWidth, setPanelWidth] = useState(900)
  const [treeWidth, setTreeWidth] = useState(360)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(['']))
  const visibleArtifacts = producedArtifacts.filter(
    (artifact) => artifact.type !== 'remote_agent_session',
  )
  const primaryArtifact = useMemo(() => choosePrimaryArtifact(visibleArtifacts), [visibleArtifacts])
  const tree = useMemo(() => buildArtifactFileTree(visibleArtifacts), [visibleArtifacts])
  const selectedArtifact =
    visibleArtifacts.find((artifact) => artifact.id === selectedArtifactId) ??
    primaryArtifact ??
    null
  const selectedPath = selectedArtifact ? artifactPath(selectedArtifact) : null
  const fulfilledRequestedCount = useMemo(
    () => requestedArtifacts.filter((requested) => {
      const requestedType = typeof requested.type === 'string' ? requested.type : null
      const requestedTitle = typeof requested.title === 'string' ? requested.title : null
      return visibleArtifacts.some((artifact) => artifact.type === requestedType && artifact.title === requestedTitle)
    }).length,
    [requestedArtifacts, visibleArtifacts],
  )

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
          'flex h-11 w-full min-w-0 items-center gap-4 px-2 text-left text-[1.08rem] leading-none hover:bg-muted',
          selectedPath === node.path ? 'bg-muted/80 font-semibold' : '',
        ].join(' ')}
        style={{ paddingLeft: `${24 + depth * 18}px` }}
        onClick={() => node.artifact && onSelectArtifact(node.artifact.id)}
      >
        {fileIconFor(node.path, node.artifact)}
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate">{node.name}</span>
          {node.artifact ? (
            <Badge variant={selectedPath === node.path ? 'default' : 'secondary'} className="shrink-0">
              {artifactRoleLabel(node.artifact, requestedArtifacts)}
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
          requestedArtifacts={requestedArtifacts}
          runPrompt={runPrompt}
          isPrimary={selectedArtifact ? selectedArtifact.id === primaryArtifact?.id : false}
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
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-7 py-5">
            <div className="min-w-0">
              <div className="truncate text-xl font-semibold tracking-normal">Research outputs</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {primaryArtifact
                  ? `${artifactPath(primaryArtifact)} is the canonical answer for this completed run.`
                  : 'Produced artifacts will appear here when the run finishes.'}
              </p>
              {requestedArtifacts.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Fulfilled requested outputs: {fulfilledRequestedCount}/{requestedArtifacts.length}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3">
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
  requestedArtifacts,
  runPrompt,
  isPrimary,
}: {
  artifact: RunArtifactRecord | null
  remoteSessionId: string | null
  requestedArtifacts: Array<Record<string, unknown>>
  runPrompt: string | null
  isPrimary: boolean
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
  const role = artifactRoleLabel(artifact, requestedArtifacts)

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate text-sm font-semibold">{path}</div>
            <Badge variant={isPrimary ? 'default' : 'secondary'}>{role}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPrimary
              ? 'This preview is the final answer for the run.'
              : 'This file supports the final answer or explains how it was produced.'}
          </p>
          {runPrompt ? (
            <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
              Requested: {compactInlineText(runPrompt, 220)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => downloadArtifact(artifact)}>
            <Download className="size-4" />
            Download
          </Button>
          {remoteSessionId ? (
            <a
              href={`https://chatgpt.com/codex/s/${remoteSessionId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Session
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
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
  const transcriptEntries = useMemo(
    () => (hasRemoteLogs ? [...observedProgressMessages, ...remoteMessages] : cliMessages),
    [cliMessages, hasRemoteLogs, observedProgressMessages, remoteMessages],
  )
  const artifactCount = visibleProducedArtifacts.length

  useEffect(() => {
    const selectedArtifactStillExists = visibleProducedArtifacts.some(
      (artifact) => artifact.id === selectedArtifactId,
    )
    if (!selectedArtifactStillExists) {
      setSelectedArtifactId(choosePrimaryArtifact(visibleProducedArtifacts)?.id ?? null)
    }
  }, [selectedArtifactId, visibleProducedArtifacts])

  return (
    <div className="flex min-h-0 flex-1 bg-background">
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden px-4 py-6 md:px-8">
        {!artifactsOpen ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute right-4 top-4 z-30 gap-2 bg-background/95 shadow-sm backdrop-blur md:right-6 md:top-6"
            onClick={() => setArtifactsOpen(true)}
            aria-label="Open artifacts"
          >
            <FileText className="size-5" />
            <span>Open artifacts</span>
            {artifactCount > 0 ? (
              <span className="flex min-w-5 items-center justify-center bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                {artifactCount}
              </span>
            ) : null}
          </Button>
        ) : null}

        <div className="mx-auto flex min-h-0 w-full max-w-[46rem] flex-1 flex-col">
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
          <AssistantTranscript
            entries={transcriptEntries}
            emptyTitle="No run transcript yet"
            emptyDescription="Persisted run turns and events will appear here."
            unframed
          />
        </div>
      </div>

      <RunArtifactsPanel
        open={artifactsOpen}
        onClose={() => setArtifactsOpen(false)}
        runPrompt={run.prompt}
        requestedArtifacts={requestedArtifacts}
        producedArtifacts={producedArtifacts}
        selectedArtifactId={selectedArtifactId}
        onSelectArtifact={setSelectedArtifactId}
        remoteSessionId={remoteSessionId}
      />
    </div>
  )
}

function SessionDetailPage({ sessionId }: { sessionId: string }) {
  const { session, error, loading } = useSessionDetail(sessionId)
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

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 md:px-8">
        {error ? (
          <div className="mx-auto mb-4 w-full max-w-[46rem] bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Could not load terminal session: {error}
          </div>
        ) : null}

        <div className="mx-auto flex w-full max-w-[46rem] flex-1 flex-col">
          {loading ? (
            <div className="mb-2 flex justify-end text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-label="Loading terminal session" />
            </div>
          ) : null}
          <AssistantTranscript
            entries={entries}
            emptyTitle="No terminal session turns yet"
            emptyDescription="This session exists, but no turns have been recorded yet."
            unframed
          />
        </div>
      </div>
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
  const route = useDashboardRoute()

  const activeRun = route.runId ? runs.find((run) => run.id === route.runId) ?? null : null
  const activeDataset = route.datasetId ? datasets.find((dataset) => dataset.id === route.datasetId) ?? null : null

  let content: ReactNode

  if (route.view === 'runs' && activeRun) {
    content = <RunDetailPage run={activeRun} dataset={datasetLookup.get(activeRun.datasetId)} />
  } else if (route.view === 'terminal-sessions' && route.sessionId) {
    content = <SessionDetailPage sessionId={route.sessionId} />
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
            Browse private research environments and public datasets. Open a dataset for structure, size, provenance, profile details, and generated briefings.
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
            <p className="mt-2 text-sm text-muted-foreground">
              Remote runs across your datasets.
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
    content = <ResearchAssistantPage dataError={dataError} datasets={datasets} runs={runs} />
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
          <SidebarGroup>
            <SidebarGroupLabel>Chats</SidebarGroupLabel>
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
                {sessions.map((chatSession) => {
                  return (
                    <SidebarMenuItem key={chatSession.id}>
                      <SidebarMenuButton
                        isActive={route.view === 'assistant' && route.sessionId === chatSession.id}
                        onClick={() =>
                          updateDashboardRoute({
                            view: 'assistant',
                            runId: null,
                            sessionId: chatSession.id,
                          })}
                      >
                        <span className="truncate">
                          {readableSessionTitle(chatSession.title)}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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
