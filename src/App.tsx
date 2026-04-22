import { useEffect, useMemo, useState } from 'react'
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

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
}

type SessionTranscriptKind = 'cli' | 'remote'
type SessionEntryRole = 'user' | 'assistant' | 'system'

type SessionEntry = {
  id: string
  role: SessionEntryRole
  title?: string
  body: string
  createdAt: string
}

const ROOT_HOST = 'alpharesearch.nyc'
const DASHBOARD_HOST = 'dashboard.alpharesearch.nyc'
const INSTALL_COMMAND =
  'curl -fsSL https://raw.githubusercontent.com/zenobia-pay/alpha-research/codex/initial-substrate/scripts/install_alpha_research.sh | bash'
const AGENT_PROMPT = `Install the RESEARCH CLI and deploy my dataset.

Run:
${INSTALL_COMMAND}

Then run:
research

Sign in if needed. Based on my description, choose the dataset name, id, mode, and path. Create the dataset, deploy it, and then tell me the dataset id, run id, and current status.

Dataset description:
`

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

function createSessionEntry(
  id: string,
  role: SessionEntryRole,
  createdAt: string,
  body: string,
  title?: string,
): SessionEntry {
  return { id, role, createdAt, body, title }
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

  const nonSessionArtifacts = (payload?.artifacts ?? []).filter(
    (artifact) => artifact.type !== 'remote_agent_session',
  )
  if (nonSessionArtifacts.length > 0) {
    const lines = nonSessionArtifacts.map((artifact) => {
      const link = artifact.url ? ` ([open artifact](${artifact.url}))` : ''
      return `- **${artifact.title}** · ${formatStatus(artifact.type)}${link}`
    })
    messages.push(
      createSessionEntry(
        `${run.id}-cli-artifacts`,
        'system',
        nonSessionArtifacts.at(-1)?.createdAt ?? run.updatedAt,
        `### Artifacts\n\n${lines.join('\n')}`,
        'Artifacts',
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

function TranscriptBubble({
  entry,
}: {
  entry: SessionEntry
}) {
  const isUser = entry.role === 'user'
  const isSystem = entry.role === 'system'

  return (
    <article
      className={[
        'flex flex-col gap-2 rounded-2xl px-5 py-4',
        isUser
          ? 'ml-auto max-w-3xl bg-foreground text-background'
          : isSystem
            ? 'max-w-4xl border border-border bg-muted/30'
            : 'max-w-4xl bg-background ring-1 ring-border/80',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={isUser ? 'text-background/85' : 'text-muted-foreground'}
          >
            {entry.title ?? formatStatus(entry.role)}
          </Badge>
        </div>
        <span
          className={[
            'text-xs',
            isUser ? 'text-background/70' : 'text-muted-foreground',
          ].join(' ')}
        >
          {formatDateTime(entry.createdAt)}
        </span>
      </div>
      <div
        className={[
          'prose prose-neutral max-w-none whitespace-pre-wrap break-words text-sm leading-7',
          isUser ? 'prose-invert text-background' : 'text-foreground',
        ].join(' ')}
      >
        {entry.body}
      </div>
    </article>
  )
}

function RunTranscript({
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

  return (
    <div className="flex min-h-[28rem] flex-col gap-4 rounded-3xl border border-border bg-muted/20 p-6">
      {entries.map((entry) => (
        <TranscriptBubble key={entry.id} entry={entry} />
      ))}
    </div>
  )
}

function countActiveRuns(runs: RunRecord[]) {
  return runs.filter(
    (run) =>
      ![
        'ready',
        'completed',
        'failed',
        'cancelled',
        'canceled',
        'error',
      ].includes(run.status.toLowerCase()),
  ).length
}

function latestUpdate(items: Array<{ updatedAt: string }>) {
  if (items.length === 0) {
    return 'No recent activity'
  }
  return relativeTime(items.map((item) => item.updatedAt).sort().at(-1) ?? '')
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

function useCopy(text: string) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return { copied, copy }
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

function RunSessionSheet({
  run,
  dataset,
  open,
  onOpenChange,
}: {
  run: RunRecord | null
  dataset: DatasetRecord | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [payload, setPayload] = useState<RunResultsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<SessionTranscriptKind>('cli')

  useEffect(() => {
    if (!open || !run) {
      return
    }

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
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Could not load run transcript.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    if (
      ![
        'ready',
        'completed',
        'failed',
        'cancelled',
        'canceled',
        'error',
      ].includes(run.status.toLowerCase())
    ) {
      intervalId = window.setInterval(() => {
        void load()
      }, 5000)
    }

    return () => {
      cancelled = true
      if (intervalId) {
        window.clearInterval(intervalId)
      }
    }
  }, [open, run])

  useEffect(() => {
    setView('cli')
  }, [run?.id])

  const remoteSessionId = getRemoteSessionId(payload?.artifacts ?? [])
  const cliMessages = useMemo(
    () => (run ? buildCliTranscript(run, dataset, payload) : []),
    [dataset, payload, run],
  )
  const remoteMessages = useMemo(
    () => (run ? buildRemoteTranscript(run, dataset, payload) : []),
    [dataset, payload, run],
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[min(88rem,92vw)]">
        <SheetHeader className="gap-4 border-b border-border px-8 py-6">
          <div className="flex items-start justify-between gap-4 pr-10">
            <div className="flex min-w-0 flex-col gap-2">
              <SheetTitle className="text-left tracking-[0.08em]">
                {run ? dataset?.name ?? run.datasetId : 'Run session'}
              </SheetTitle>
              <SheetDescription className="max-w-3xl">
                {run
                  ? `${formatStatus(run.type)} run ${run.id}.`
                  : 'View run logs as an assistant session.'}
              </SheetDescription>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Refreshing
              </div>
            ) : null}
          </div>

          {run ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <StatusBadge>{formatStatus(run.status)}</StatusBadge>
              <StatusBadge>{formatStatus(run.type)}</StatusBadge>
              <span className="text-sm text-muted-foreground">
                Started {formatDateTime(run.createdAt)}
              </span>
              {remoteSessionId ? (
                <span className="text-sm text-muted-foreground">
                  Remote session {remoteSessionId}
                </span>
              ) : null}
            </div>
          ) : null}
        </SheetHeader>

        <div className="flex flex-1 min-h-0 flex-col bg-muted/15">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-8 py-4">
            <div className="flex items-center gap-2">
              <Button
                variant={view === 'cli' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('cli')}
              >
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

          <div className="flex-1 overflow-auto px-8 py-6">
            {error ? (
              <Card className="rounded-xl border border-destructive/30 bg-destructive/5 py-0 shadow-none">
                <CardContent className="px-6 py-4 text-sm text-destructive">
                  Could not load run transcript: {error}
                </CardContent>
              </Card>
            ) : null}

            {!run ? null : view === 'remote' ? (
              remoteSessionId ? (
                <RunTranscript
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

                <RunTranscript
                  entries={cliMessages}
                  emptyTitle="No CLI transcript yet"
                  emptyDescription="Persisted run config, events, and artifacts from the RESEARCH CLI will appear here."
                />

                {payload?.artifacts?.length ? (
                  <section className="rounded-3xl border border-border bg-background px-6 py-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Artifacts
                    </div>
                    <Separator className="my-4" />
                    <div className="space-y-3">
                      {payload.artifacts.map((artifact) => (
                        <div key={artifact.id} className="flex flex-wrap items-center gap-3">
                          <span className="font-medium">{artifact.title}</span>
                          <span className="text-sm text-muted-foreground">
                            {formatStatus(artifact.type)}
                          </span>
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
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
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
      <SidebarInset className="bg-background">
        <div className="flex min-h-svh flex-col">
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
      <SidebarInset className="bg-background">
        <div className="flex min-h-svh flex-col">
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
  dataError,
}: {
  session: SessionResponse
  datasets: DatasetRecord[]
  runs: RunRecord[]
  dataError?: string | null
}) {
  const datasetLookup = useMemo(
    () => new Map(datasets.map((dataset) => [dataset.id, dataset])),
    [datasets],
  )
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null)

  const initials = (session.user?.email ?? 'AR')
    .split('@')[0]
    .slice(0, 2)
    .toUpperCase()

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
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="#datasets">
                      <Database />
                      <span>Datasets</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="#runs">
                      <History />
                      <span>Runs</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto justify-start gap-3 px-2 py-2">
                <Avatar className="size-9 rounded-none border border-sidebar-border">
                  <AvatarFallback className="rounded-none bg-sidebar-accent text-xs font-semibold tracking-[0.22em]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col items-start">
                  <span className="truncate text-xs font-semibold uppercase tracking-[0.2em]">
                    Account
                  </span>
                  <span className="truncate text-sm font-normal normal-case tracking-normal text-muted-foreground">
                    {session.user?.email ?? 'Signed in'}
                  </span>
                </div>
                <MoreHorizontal />
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

      <SidebarInset className="bg-background">
        <div className="flex min-h-svh flex-col">
          <header className="flex h-16 items-center gap-3 border-b border-border px-4 md:px-8">
            <SidebarTrigger variant="ghost" size="icon-sm" />
            <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col">
                <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Dashboard
                </span>
                <span className="truncate text-sm font-medium">
                  Research workspace
                </span>
              </div>
            </div>
          </header>

          <main className="flex flex-1 min-w-0 flex-col gap-6 px-4 py-6 md:px-8">
              <section className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex max-w-3xl flex-col gap-3">
                  <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    Research workspace
                  </span>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                    Datasets and runs from your workspace.
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                    Your private datasets and research runs live here.
                  </p>
                </div>
                <div className="grid min-w-[16rem] grid-cols-3 gap-3">
                  <div className="border border-border bg-muted/20 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Datasets
                    </div>
                    <div className="mt-2 text-2xl font-semibold">{datasets.length}</div>
                  </div>
                  <div className="border border-border bg-muted/20 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Active
                    </div>
                    <div className="mt-2 text-2xl font-semibold">
                      {countActiveRuns(runs)}
                    </div>
                  </div>
                  <div className="border border-border bg-muted/20 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Latest
                    </div>
                    <div className="mt-2 text-sm font-medium">{latestUpdate(runs)}</div>
                  </div>
                </div>
              </section>

              {dataError ? (
                <Card className="rounded-none border border-destructive/25 bg-destructive/5 py-0 shadow-none">
                  <CardContent className="px-6 py-4 text-sm text-destructive">
                    {dataError}
                  </CardContent>
                </Card>
              ) : null}

              <Card
                id="datasets"
                className="rounded-none border border-border bg-background py-0 shadow-none"
              >
                <CardHeader className="border-b border-border px-6 py-5">
                  <CardTitle className="text-sm">Datasets</CardTitle>
                  <CardDescription>
                    Your private datasets and deployed research environments.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <DatasetTable datasets={datasets} />
                </CardContent>
              </Card>

              <Card
                id="runs"
                className="rounded-none border border-border bg-background py-0 shadow-none"
              >
                <CardHeader className="border-b border-border px-6 py-5">
                  <CardTitle className="text-sm">Past runs</CardTitle>
                  <CardDescription>
                    Query, ingest, and analysis runs.
                  </CardDescription>
                </CardHeader>
              <CardContent className="px-0">
                  <RunTable
                    runs={runs}
                    datasetLookup={datasetLookup}
                    onSelectRun={setSelectedRun}
                  />
                </CardContent>
              </Card>
          </main>
        </div>

        <RunSessionSheet
          run={selectedRun}
          dataset={selectedRun ? datasetLookup.get(selectedRun.datasetId) : undefined}
          open={Boolean(selectedRun)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedRun(null)
            }
          }}
        />
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
            const [datasetsPayload, runsPayload] = await Promise.all([
              fetchJson<DatasetRecord[] | { datasets: DatasetRecord[] }>('/api/cli/datasets'),
              fetchJson<RunRecord[] | { runs: RunRecord[] }>('/api/cli/runs'),
            ])
            const datasets = normalizeDatasetsPayload(datasetsPayload)
            const runs = normalizeRunsPayload(runsPayload)

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
          const [datasetsPayload, runsPayload] = await Promise.all([
            fetchJson<DatasetRecord[] | { datasets: DatasetRecord[] }>('/api/cli/datasets'),
            fetchJson<RunRecord[] | { runs: RunRecord[] }>('/api/cli/runs'),
          ])
          const datasets = normalizeDatasetsPayload(datasetsPayload)
          const runs = normalizeRunsPayload(runsPayload)

          if (!cancelled) {
            setState({
              type: 'ready',
              session,
              datasets: [...datasets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
              runs: [...runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
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
      dataError={state.dataError}
    />
  )
}

function LandingPage() {
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [authError, setAuthError] = useState<string>('')
  const installCopy = useCopy(INSTALL_COMMAND)
  const promptCopy = useCopy(AGENT_PROMPT)

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

  const authLabel = session?.configured
    ? session.authenticated && session.user
      ? session.user.email
      : 'login'
    : 'auth offline'

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
              />
            </a>

            <nav className="top-links" aria-label="Primary">
              <a className="underlined-link" href="#cli">cli</a>
              <a className="underlined-link" href="#powering">powering</a>
              <a className="underlined-link" href="#faq">faq</a>
              <a className="underlined-link" href="#about">about</a>
              <a className="button-small ghost-button" href="/blog/">blog</a>
              <button
                className="button-small ghost-button auth-button"
                type="button"
                data-state={session?.authenticated ? 'authenticated' : 'anonymous'}
                disabled={!session?.configured}
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
              <a className="hero-button hero-button-secondary" href="#cli">
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

          <section className="cli-block" id="cli">
            <p className="section-kicker">For Your Own Corpus</p>
            <h2>Bring your own dataset</h2>
            <p className="cli-lede">
              Install the RESEARCH CLI, sign in, and point it at a parquet, CSV, PDF, or text
              corpus. The CLI uploads the raw source, normalizes it remotely, and gives you a run
              you can reopen later.
            </p>

            <div className="cli-card">
              <div className="cli-card-head">
                <div>
                  <p className="cli-card-label">Install</p>
                  <p className="cli-card-copy">Run this yourself or hand it to your agent.</p>
                </div>
                <button className="ghost-button cli-copy-button" type="button" onClick={installCopy.copy}>
                  {installCopy.copied ? 'Copied command' : 'Copy command'}
                </button>
              </div>
              <pre className="cli-pre"><code>{INSTALL_COMMAND}</code></pre>
            </div>

            <div className="cli-card">
              <div className="cli-card-head">
                <div>
                  <p className="cli-card-label">Prompt Your Agent</p>
                  <p className="cli-card-copy">Paste this into Codex or Claude Code and describe the dataset at the bottom.</p>
                </div>
                <button className="ghost-button cli-copy-button" type="button" onClick={promptCopy.copy}>
                  {promptCopy.copied ? 'Copied prompt' : 'Copy prompt'}
                </button>
              </div>
              <pre className="cli-pre"><code>{AGENT_PROMPT}</code></pre>
            </div>

            <div className="cli-grid">
              <article className="cli-mini-card">
                <p className="cli-card-label">Formats</p>
                <p>
                  Parquet, CSV, JSON, markdown, HTML, PDFs, and other research corpora that need
                  normalization before search and analysis.
                </p>
              </article>
              <article className="cli-mini-card">
                <p className="cli-card-label">Runs</p>
                <p>
                  Upload starts a remote run. Alpha Research provisions storage and compute,
                  normalizes the dataset, and keeps the run visible when you reopen the CLI.
                </p>
              </article>
            </div>
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
