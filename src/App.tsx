import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { AssistantRuntimeProvider, useExternalStoreRuntime, type ThreadMessage } from '@assistant-ui/react'
import {
  Bot,
  Database,
  ExternalLink,
  History,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MoreHorizontal,
  TerminalSquare,
} from 'lucide-react'

import { Thread } from '@/components/assistant-ui/thread'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
  mode: string | null
  description: string | null
  deploymentStatus: string
  status: string
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

type SessionTranscriptKind = 'cli' | 'remote'
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
  locationUrl.searchParams.get('view') === 'dashboard'
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
  return value
    .replaceAll(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
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
    status ? `Status: ${status}` : null,
    deploymentStatus ? `Deployment: ${deploymentStatus}` : null,
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
  requestedArtifacts: Array<Record<string, unknown>>,
) {
  if (artifact.url || artifact.type === 'remote_agent_session') {
    return true
  }
  const requestedMatch = requestedArtifacts.some((requested) => {
    const requestedType = typeof requested.type === 'string' ? requested.type : null
    const requestedTitle = typeof requested.title === 'string' ? requested.title : null
    return requestedType === artifact.type && requestedTitle === artifact.title
  })
  return !requestedMatch
}

function getProducedArtifacts(payload: RunResultsResponse | null) {
  const requestedArtifacts = getRequestedArtifacts(payload)
  return (payload?.artifacts ?? []).filter((artifact) => isProducedArtifact(artifact, requestedArtifacts))
}

function getLatestRunEvent(payload: RunResultsResponse | null) {
  const events = payload?.events ?? []
  return events.length > 0 ? events[events.length - 1] : null
}

function inferRunPhase(run: RunRecord, payload: RunResultsResponse | null) {
  const status = run.status.toLowerCase()
  if (status === 'queued') return 'Queued'
  if (status === 'booting') return 'Booting'
  if (status === 'running') return 'Running'
  if (status === 'ready' || status === 'completed' || status === 'succeeded') return 'Done'
  if (status === 'failed' || status === 'error') return 'Failed'
  if (status === 'cancelled' || status === 'canceled') return 'Cancelled'
  const latestEvent = getLatestRunEvent(payload)
  return latestEvent ? truncate(latestEvent.message, 120) : formatStatus(run.status)
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
      content: [{ type: 'text', text: formatSessionBody(entry) }],
      attachments: [],
      metadata: { custom: entry.title ? { title: entry.title } : {} },
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

function buildCliTranscript(
  run: RunRecord,
  dataset: DatasetRecord | undefined,
  payload: RunResultsResponse | null,
): SessionEntry[] {
  const storedSession = payload?.sessions?.find((session) => session.kind === 'cli_orchestration')
  if (storedSession?.entries?.length) {
    const hasLocalCliEntries = storedSession.entries.some((entry) =>
      ['local_user', 'local_assistant', 'tool_call', 'tool_result', 'local_summary'].includes(entry.kind),
    )
    const visibleEntries = hasLocalCliEntries
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
    return storedSession.entries.map((entry) =>
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

function AssistantTranscript({
  entries,
  emptyTitle,
  emptyDescription,
}: {
  entries: SessionEntry[]
  emptyTitle: string
  emptyDescription: string
}) {
  if (entries.length === 0) {
    return (
      <div className="flex min-h-[28rem] items-center justify-center rounded-3xl border border-dashed border-border bg-background px-8 py-16">
        <div className="max-w-xl text-center">
          <div className="text-lg font-semibold">{emptyTitle}</div>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{emptyDescription}</p>
        </div>
      </div>
    )
  }

  const messages = useMemo(() => entries.map(toThreadMessage), [entries])
  const runtime = useExternalStoreRuntime({
    isRunning: false,
    messages,
    onNew: async () => {},
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="min-h-[28rem] rounded-3xl border border-border bg-background">
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
  const response = await fetch('/api/auth/session', {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  return response.json() as Promise<SessionResponse>
}

async function fetchJson<T>(input: string) {
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

async function postAssistantTurn(body: {
  input: string
  sessionId?: string | null
  previousResponseId?: string | null
}) {
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
    sessionId: url.searchParams.get('sessionId'),
  }
}

function updateDashboardRoute(next: {
  view?: DashboardView
  runId?: string | null
  sessionId?: string | null
}) {
  const url = new URL(window.location.href)
  url.searchParams.set('view', next.view ?? getDashboardRoute().view)
  if (next.runId) url.searchParams.set('runId', next.runId)
  else url.searchParams.delete('runId')
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

function DatasetTable({ datasets }: { datasets: DatasetRecord[] }) {
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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Mode</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Deploy</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {datasets.map((dataset) => {
          const description =
            dataset.description?.trim() ||
            dataset.sourceFilename?.trim() ||
            `Source type: ${dataset.sourceType}`

          return (
            <TableRow key={dataset.id}>
              <TableCell className="align-top">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-medium">{dataset.name}</span>
                  <span className="max-w-[30rem] text-sm whitespace-normal text-muted-foreground">
                    {truncate(description, 120)}
                  </span>
                </div>
              </TableCell>
              <TableCell>{formatStatus(dataset.mode ?? 'default')}</TableCell>
              <TableCell>
                <StatusBadge>{formatStatus(dataset.status)}</StatusBadge>
              </TableCell>
              <TableCell>{formatStatus(dataset.deploymentStatus)}</TableCell>
              <TableCell>{relativeTime(dataset.updatedAt)}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
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
                  {session.title ?? 'RESEARCH CLI session'}
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
    if (!['ready', 'completed', 'failed', 'cancelled', 'canceled', 'error'].includes(run.status.toLowerCase())) {
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
    if (!sessionId) return
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
  sessions,
  dataError,
}: {
  sessions: StoredAssistantSession[]
  dataError?: string | null
}) {
  const route = useDashboardRoute()
  const activeSessionId = route.sessionId ?? sessions[0]?.id ?? null
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

  useEffect(() => {
    const entries = (session?.entries ?? []).map((entry) =>
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
    setMessages(entries)
    setConversationState({
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
        const result = await postAssistantTurn({
          input,
          sessionId: conversationState.sessionId,
          previousResponseId: conversationState.previousResponseId,
        })
        const nextSessionId = result.sessionId ?? conversationState.sessionId
        setConversationState({
          sessionId: nextSessionId,
          previousResponseId: result.previousResponseId,
        })
        if (nextSessionId) {
          if (route.sessionId !== nextSessionId) {
            updateDashboardRoute({ view: 'assistant', sessionId: nextSessionId, runId: null })
          } else {
            const response = await fetchJson<{ session: StoredAssistantSession; entries: StoredAssistantSessionEntry[] }>(
              `/api/cli/sessions/${nextSessionId}`,
            )
            setMessages(
              response.entries.map((entry) =>
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
              ),
            )
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
              welcomeTitle="RESEARCH CLI"
              welcomeDescription={
                loading
                  ? 'Loading your current research session...'
                  : 'Run the signed-in RESEARCH CLI from the browser. Inspect datasets, launch runs, and manage remote Codex sessions.'
              }
            />
          </div>
        </AssistantRuntimeProvider>
      </div>
    </main>
  )
}

function DetailHeader({
  eyebrow,
  title,
  description,
  children,
  onBack,
}: {
  eyebrow: string
  title: string
  description: string
  children?: ReactNode
  onBack: () => void
}) {
  return (
    <section className="flex flex-col gap-5 border-b border-border px-6 py-6 md:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-4xl flex-col gap-2">
          <button
            type="button"
            onClick={onBack}
            className="w-fit text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            Back
          </button>
          <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
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
  const [view, setView] = useState<SessionTranscriptKind>('cli')
  const remoteSessionId = getRemoteSessionId(payload?.artifacts ?? [])
  const requestedArtifacts = useMemo(() => getRequestedArtifacts(payload), [payload])
  const producedArtifacts = useMemo(() => getProducedArtifacts(payload), [payload])
  const latestEvent = useMemo(() => getLatestRunEvent(payload), [payload])
  const phase = inferRunPhase(run, payload)
  const cliMessages = useMemo(() => buildCliTranscript(run, dataset, payload), [run, dataset, payload])
  const remoteMessages = useMemo(() => buildRemoteTranscript(run, dataset, payload), [run, dataset, payload])

  useEffect(() => {
    setView('cli')
  }, [run.id])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DetailHeader
        eyebrow="Run"
        title={dataset?.name ?? run.datasetId}
        description={`${formatStatus(run.type)} run ${run.id}.`}
        onBack={() => updateDashboardRoute({ view: 'runs', runId: null, sessionId: null })}
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <StatusBadge>{formatStatus(run.status)}</StatusBadge>
          <StatusBadge>{formatStatus(run.type)}</StatusBadge>
          <StatusBadge>{phase}</StatusBadge>
          <span className="text-sm text-muted-foreground">Started {formatDateTime(run.createdAt)}</span>
          {remoteSessionId ? (
            <span className="text-sm text-muted-foreground">Remote session {remoteSessionId}</span>
          ) : null}
          {loading ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Refreshing
            </span>
          ) : null}
        </div>
      </DetailHeader>

      <div className="flex flex-1 min-h-0 flex-col gap-6 bg-muted/15 px-6 py-6 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant={view === 'cli' ? 'default' : 'ghost'} size="sm" onClick={() => setView('cli')}>
              <TerminalSquare />
              CLI orchestration
            </Button>
            <Button
              variant={view === 'remote' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('remote')}
              disabled={!remoteSessionId}
            >
              <Bot />
              Remote Codex
            </Button>
          </div>
          {remoteSessionId ? (
            <a
              href={`https://chatgpt.com/codex/s/${remoteSessionId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Open remote session
              <ExternalLink className="size-4" />
            </a>
          ) : null}
        </div>

        <section className="rounded-3xl border border-border bg-background px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Phase</div>
              <div className="mt-2 text-sm">{phase}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Last event</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {latestEvent ? truncate(latestEvent.message, 180) : 'No run events yet'}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Requested artifacts</div>
              <div className="mt-2 text-sm">{requestedArtifacts.length}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Produced artifacts</div>
              <div className="mt-2 text-sm">{producedArtifacts.filter((artifact) => artifact.type !== 'remote_agent_session').length}</div>
            </div>
          </div>
          {latestEvent?.createdAt ? (
            <div className="mt-4 text-sm text-muted-foreground">Updated {formatDateTime(latestEvent.createdAt)}</div>
          ) : null}
        </section>

        {error ? (
          <Card className="rounded-xl border border-destructive/30 bg-destructive/5 py-0 shadow-none">
            <CardContent className="px-6 py-4 text-sm text-destructive">
              Could not load run transcript: {error}
            </CardContent>
          </Card>
        ) : null}

        {view === 'remote' ? (
          remoteSessionId ? (
            <AssistantTranscript
              entries={remoteMessages}
              emptyTitle="No remote session log"
              emptyDescription="This run has a remote session id but there are no persisted remote events yet."
            />
          ) : (
            <Card className="rounded-xl border border-border bg-background py-0 shadow-none">
              <CardContent className="px-6 py-6 text-sm text-muted-foreground">
                This run does not have a persisted remote agent session id yet.
              </CardContent>
            </Card>
          )
        ) : (
          <div className="flex flex-col gap-6">
            {run.prompt?.trim() ? (
              <section className="rounded-3xl border border-border bg-background px-6 py-5">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Prompt
                </div>
                <p className="mt-3 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-foreground">
                  {run.prompt}
                </p>
              </section>
            ) : null}
            <AssistantTranscript
              entries={cliMessages}
              emptyTitle="No CLI transcript yet"
              emptyDescription="Persisted run config, events, and artifacts from the RESEARCH CLI will appear here."
            />
          </div>
        )}

        {(requestedArtifacts.length > 0 || producedArtifacts.length > 0) ? (
          <section className="rounded-3xl border border-border bg-background px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Artifacts
            </div>
            <Separator className="my-4" />
            <div className="space-y-6">
              {requestedArtifacts.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Requested
                  </div>
                  {requestedArtifacts.map((artifact, index) => {
                    const type = typeof artifact.type === 'string' ? artifact.type : 'artifact'
                    const title =
                      typeof artifact.title === 'string' ? artifact.title : formatStatus(type)
                    const produced = producedArtifacts.some((candidate) => candidate.type === type && candidate.title === title)
                    return (
                      <div key={`${type}-${title}-${index}`} className="flex flex-wrap items-center gap-3">
                        <span className="font-medium">{title}</span>
                        <span className="text-sm text-muted-foreground">{formatStatus(type)}</span>
                        <StatusBadge>{produced ? 'Produced' : 'Pending'}</StatusBadge>
                      </div>
                    )
                  })}
                </div>
              ) : null}
              {producedArtifacts.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Produced
                  </div>
                  {producedArtifacts.map((artifact) => (
                    <div key={artifact.id} className="flex flex-wrap items-center gap-3">
                      <span className="font-medium">{artifact.title}</span>
                      <span className="text-sm text-muted-foreground">{formatStatus(artifact.type)}</span>
                      {artifact.url ? (
                        <a
                          href={artifact.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                          Open
                          <ExternalLink className="size-4" />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
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
    <div className="flex min-h-0 flex-1 flex-col">
      <DetailHeader
        eyebrow="Terminal Session"
        title={session?.title ?? sessionId}
        description="Persisted RESEARCH CLI orchestration turns."
        onBack={() => updateDashboardRoute({ view: 'terminal-sessions', sessionId: null, runId: null })}
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <StatusBadge>{formatStatus(session?.status ?? 'active')}</StatusBadge>
          {session ? (
            <span className="text-sm text-muted-foreground">Updated {formatDateTime(session.updatedAt)}</span>
          ) : null}
          {session?.runId ? (
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => updateDashboardRoute({ view: 'runs', runId: session.runId, sessionId })}
            >
              Open related run
            </button>
          ) : null}
          {loading ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading
            </span>
          ) : null}
        </div>
      </DetailHeader>

      <div className="flex flex-1 min-h-0 flex-col gap-6 bg-muted/15 px-6 py-6 md:px-10">
        {error ? (
          <Card className="rounded-xl border border-destructive/30 bg-destructive/5 py-0 shadow-none">
            <CardContent className="px-6 py-4 text-sm text-destructive">
              Could not load terminal session: {error}
            </CardContent>
          </Card>
        ) : null}

        <AssistantTranscript
          entries={entries}
          emptyTitle="No terminal session turns yet"
          emptyDescription="This session exists, but no turns have been recorded yet."
        />
      </div>
    </div>
  )
}

function DashboardLoading() {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
          <img
            className="h-auto w-36"
            src="/alpha-research-wordmark.png"
            alt="Alpha Research"
          />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-hidden bg-background">
        <div className="flex h-svh min-h-0 flex-col overflow-hidden">
          <header className="flex h-16 items-center gap-3 border-b border-border px-4 md:px-8">
            <SidebarTrigger variant="ghost" size="icon-sm" />
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Dashboard
              </span>
              <span className="text-sm font-medium">Loading research workspace</span>
            </div>
          </header>
          <div className="grid flex-1 gap-6 px-4 py-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex flex-col gap-6">
              <Skeleton className="h-16 rounded-none" />
              <Skeleton className="h-[22rem] rounded-none" />
              <Skeleton className="h-[22rem] rounded-none" />
            </div>
            <Skeleton className="h-[18rem] rounded-none" />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function DashboardSignedOut({
  session,
}: {
  session: SessionResponse
}) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
          <img
            className="h-auto w-36"
            src="/alpha-research-wordmark.png"
            alt="Alpha Research"
          />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-hidden bg-background">
        <div className="flex h-svh min-h-0 flex-col overflow-hidden">
          <header className="flex h-16 items-center gap-3 border-b border-border px-4 md:px-8">
            <SidebarTrigger variant="ghost" size="icon-sm" />
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Dashboard
              </span>
              <span className="text-sm font-medium">RESEARCH CLI workspace</span>
            </div>
          </header>

          <main className="flex flex-1 px-4 py-6 md:px-8">
            <Card className="min-h-[30rem] rounded-none border border-border bg-background py-0 shadow-none">
              <CardContent className="flex h-full px-0">
                <Empty className="border-0 px-8 py-16">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <LayoutDashboard />
                    </EmptyMedia>
                    <EmptyTitle>Sign in to open your workspace</EmptyTitle>
                    <EmptyDescription>
                      {session.configured
                        ? 'Sign in to view your datasets and runs.'
                        : session.error ?? 'Auth is not configured on this deployment.'}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button onClick={beginDashboardLogin} disabled={!session.configured}>
                      Sign in
                    </Button>
                  </EmptyContent>
                </Empty>
              </CardContent>
            </Card>
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

  const initials = (session.user?.email ?? 'AR')
    .split('@')[0]
    .slice(0, 2)
    .toUpperCase()

  const activeRun = route.runId ? runs.find((run) => run.id === route.runId) ?? null : null

  const navItems: Array<{ view: DashboardView; label: string; icon: typeof Bot }> = [
    { view: 'assistant', label: 'Assistant', icon: Bot },
    { view: 'datasets', label: 'Datasets', icon: Database },
    { view: 'runs', label: 'Runs', icon: History },
    { view: 'terminal-sessions', label: 'Terminal Sessions', icon: TerminalSquare },
  ]

  let title = 'RESEARCH CLI'
  let eyebrow = 'Assistant'
  let content: ReactNode

  if (route.view === 'runs' && activeRun) {
    title = 'Run detail'
    eyebrow = 'Runs'
    content = <RunDetailPage run={activeRun} dataset={datasetLookup.get(activeRun.datasetId)} />
  } else if (route.view === 'terminal-sessions' && route.sessionId) {
    title = 'Terminal session'
    eyebrow = 'Terminal Sessions'
    content = <SessionDetailPage sessionId={route.sessionId} />
  } else if (route.view === 'datasets') {
    title = 'Datasets'
    eyebrow = 'Datasets'
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
              Datasets
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Your private datasets and deployed research environments.
            </p>
          </div>
          <DatasetTable datasets={datasets} />
        </section>
      </main>
    )
  } else if (route.view === 'runs') {
    title = 'Runs'
    eyebrow = 'Runs'
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
    title = 'Terminal Sessions'
    eyebrow = 'Terminal Sessions'
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
    content = <ResearchAssistantPage sessions={sessions} dataError={dataError} />
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
          <a href={rootOrigin} className="flex items-center">
            <img
              className="h-auto w-36"
              src="/alpha-research-wordmark.png"
              alt="Alpha Research"
            />
          </a>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.view}>
                      <SidebarMenuButton
                        isActive={route.view === item.view}
                        onClick={() =>
                          updateDashboardRoute({
                            view: item.view,
                            runId: null,
                            sessionId: null,
                          })}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="grid h-auto w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-left hover:bg-sidebar-accent/60"
              >
                <Avatar className="size-10 shrink-0 border-0 shadow-none after:hidden">
                  <AvatarFallback className="bg-muted text-sm font-medium tracking-[0.08em] text-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col items-start pr-2">
                  <span className="truncate text-[0.7rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    Account
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

      <SidebarInset className="min-h-0 overflow-hidden bg-background">
        <div className="flex h-svh min-h-0 flex-col overflow-hidden">
          <header className="flex h-16 items-center gap-3 border-b border-border px-4 md:px-8">
            <SidebarTrigger variant="ghost" size="icon-sm" />
            <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col">
                <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  {eyebrow}
                </span>
                <span className="truncate text-sm font-medium">{title}</span>
              </div>
            </div>
          </header>
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

    return () => {
      cancelled = true
    }
  }, [])

  return state
}

function DashboardPage() {
  const state = useDashboardState()

  useEffect(() => {
    document.title = 'Research Dashboard | Alpha Research'
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
              <a className="underlined-link" href="/cli/">CLI</a>
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
              <a href="/cli/">CLI</a>
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
