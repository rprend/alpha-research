import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BookCopy,
  Database,
  History,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Separator } from '@/components/ui/separator'
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

const ROOT_HOST = 'alpharesearch.nyc'
const DASHBOARD_HOST = 'dashboard.alpharesearch.nyc'
const INSTALL_COMMAND =
  'curl -fsSL https://raw.githubusercontent.com/zenobia-pay/alpha-research/codex/initial-substrate/scripts/install_alpha_research.sh | bash'

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

function CopyCommand({ text }: { text: string }) {
  const { copied, copy } = useCopy(text)

  return (
    <div className="rounded-none border border-border bg-muted/30">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Command
        </span>
        <Button size="xs" variant="outline" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-sm leading-6 text-foreground">
        <code>{text}</code>
      </pre>
    </div>
  )
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
}: {
  runs: RunRecord[]
  datasetLookup: Map<string, DatasetRecord>
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
            <TableRow key={run.id}>
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
              <TableCell>{relativeTime(run.updatedAt)}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
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
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="#cli">
                      <TerminalSquare />
                      <span>CLI</span>
                    </a>
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

          <main className="grid flex-1 gap-6 px-4 py-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
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
                        ? 'The dashboard uses the same Alpha Research auth session as the CLI and the main site.'
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

            <CliPanel />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function CliPanel() {
  return (
    <Card
      id="cli"
      className="rounded-none border border-border bg-muted/20 py-0 shadow-none"
    >
      <CardHeader className="border-b border-border px-6 py-5">
        <CardTitle className="text-sm">The RESEARCH CLI</CardTitle>
        <CardDescription>
          Install the CLI, authenticate in browser, and reopen datasets or runs from
          this dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 px-6 py-6">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Install
          </p>
          <CopyCommand text={INSTALL_COMMAND} />
        </div>
        <Separator />
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Start
          </p>
          <div className="rounded-none border border-border bg-background px-4 py-4 text-sm">
            <code>research</code>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t border-border px-6 py-4 text-sm leading-6 text-muted-foreground">
        This page reads from <code className="mx-1">/api/cli/datasets</code> and
        <code className="ml-1">/api/cli/runs</code>, the same control-plane records
        written by the RESEARCH CLI.
      </CardFooter>
    </Card>
  )
}

function DashboardApp({
  session,
  datasets,
  runs,
}: {
  session: SessionResponse
  datasets: DatasetRecord[]
  runs: RunRecord[]
}) {
  const datasetLookup = useMemo(
    () => new Map(datasets.map((dataset) => [dataset.id, dataset])),
    [datasets],
  )

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
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="#cli">
                      <TerminalSquare />
                      <span>CLI</span>
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
                  RESEARCH CLI control plane
                </span>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="#cli">
                  <TerminalSquare data-icon="inline-start" />
                  CLI install
                </a>
              </Button>
            </div>
          </header>

          <main className="grid flex-1 gap-6 px-4 py-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-w-0 flex-col gap-6">
              <section className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex max-w-3xl flex-col gap-3">
                  <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    Research workspace
                  </span>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                    Datasets and runs from your CLI session.
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                    This dashboard is a thin shell over the same records the RESEARCH CLI
                    writes. If a dataset or run exists in the API, it should exist here.
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

              <Card
                id="datasets"
                className="rounded-none border border-border bg-background py-0 shadow-none"
              >
                <CardHeader className="border-b border-border px-6 py-5">
                  <CardTitle className="text-sm">Datasets</CardTitle>
                  <CardDescription>
                    Private datasets and deployed research environments created from the
                    RESEARCH CLI.
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
                    Query, ingest, and analysis runs launched from the RESEARCH CLI.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <RunTable runs={runs} datasetLookup={datasetLookup} />
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-6">
              <CliPanel />
              <Card className="rounded-none border border-border bg-background py-0 shadow-none">
                <CardHeader className="border-b border-border px-6 py-5">
                  <CardTitle className="text-sm">Session</CardTitle>
                  <CardDescription>
                    Signed in through Alpha Research and reading live CLI-backed records.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 px-6 py-6 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">User</span>
                    <span className="truncate font-medium">
                      {session.user?.email ?? 'Signed in'}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">API status</span>
                    <StatusBadge>Connected</StatusBadge>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border px-6 py-4">
                  <Button variant="outline" size="sm" asChild>
                    <a href={rootOrigin}>
                      Open site
                      <ArrowUpRight data-icon="inline-end" />
                    </a>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </main>
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
            const [datasets, runs] = await Promise.all([
              fetchJson<DatasetRecord[]>('/api/cli/datasets'),
              fetchJson<RunRecord[]>('/api/cli/runs'),
            ])

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

        const [datasets, runs] = await Promise.all([
          fetchJson<DatasetRecord[]>('/api/cli/datasets'),
          fetchJson<RunRecord[]>('/api/cli/runs'),
        ])

        if (!cancelled) {
          setState({
            type: 'ready',
            session,
            datasets: [...datasets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
            runs: [...runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          })
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
    />
  )
}

function LandingPage() {
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [authError, setAuthError] = useState<string>('')
  const { copied, copy } = useCopy(INSTALL_COMMAND)

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
    <div className="min-h-svh bg-[#fbfbf9] text-[#1f1f1c]">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-5 md:px-8">
        <a href="/" className="shrink-0">
          <img
            className="h-auto w-[12rem]"
            src="/alpha-research-wordmark.png"
            alt="Alpha Research"
          />
        </a>
        <nav className="ml-auto flex flex-wrap items-center justify-end gap-4 text-sm text-muted-foreground">
          <a className="underline underline-offset-4" href="#cli">
            cli
          </a>
          <a className="underline underline-offset-4" href="#about">
            about
          </a>
          <a className="underline underline-offset-4" href="/blog/">
            blog
          </a>
          <button
            type="button"
            className="text-sm text-primary underline underline-offset-4"
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
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 pb-20 pt-10 md:px-8">
        <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
          <div className="flex flex-col gap-6">
            <div className="inline-flex w-fit items-center gap-2 border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              <Sparkles className="size-4" />
              Backed by Y Combinator
            </div>
            <div className="flex max-w-4xl flex-col gap-5">
              <h1 className="font-serif text-5xl leading-tight tracking-tight md:text-6xl">
                Open source, agentic knowledge bases for humanity&apos;s knowledge.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                Alpha Research builds open source agentic knowledge bases and the
                RESEARCH CLI to deploy your own datasets, reopen runs, and inspect the
                resulting research workspace in browser.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="rounded-none" onClick={beginMarketingLogin}>
                Bring your own dataset
              </Button>
              <Button
                variant="outline"
                className="rounded-none"
                data-cal-link="ryan-prendergast-qsp5cw/30min"
                data-cal-namespace="30min"
                data-cal-config='{"layout":"month_view","useSlotsViewOnSmallScreen":"true"}'
              >
                Want a custom integration?
              </Button>
            </div>
            {authError ? (
              <p className="text-sm text-destructive">{authError}</p>
            ) : null}
          </div>
          <div className="border border-border bg-background p-3">
            <img
              className="h-auto w-full"
              src="/alpha-research-man.png"
              alt="Illustration for Alpha Research"
            />
          </div>
        </section>

        <section id="cli" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <Card className="rounded-none border border-border bg-background py-0 shadow-none">
            <CardHeader className="border-b border-border px-6 py-5">
              <CardTitle className="text-sm">Bring your own dataset</CardTitle>
              <CardDescription>
                Install the RESEARCH CLI, sign in, and point it at a parquet, CSV,
                PDF, or text corpus.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 px-6 py-6">
              <CopyCommand text={INSTALL_COMMAND} />
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" onClick={copy}>
                  {copied ? 'Copied' : 'Copy install command'}
                </Button>
                <Button size="sm" onClick={beginMarketingLogin}>
                  Open dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="flex flex-col gap-4 border border-border bg-muted/20 p-6">
            <div className="flex items-center gap-3">
              <BookCopy className="size-5" />
              <h2 className="text-lg font-semibold tracking-tight">Browser dashboard</h2>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">
              After the CLI uploads or runs research, the browser dashboard shows the
              same datasets and past runs from the control plane.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href={dashboardOrigin}>
                Visit dashboard
                <ArrowUpRight data-icon="inline-end" />
              </a>
            </Button>
          </div>
        </section>

        <section
          id="about"
          className="max-w-4xl border-t border-border pt-10 text-sm leading-8 text-muted-foreground"
        >
          Knowledge work is bottlenecked in two key ways: finding evidence and
          testing hypotheses. Alpha Research extends keyword search and RAG with
          general coding agents and a browser workspace for inspecting CLI-created
          datasets and runs.
        </section>
      </main>
    </div>
  )
}

export default function App() {
  return isDashboardView ? <DashboardPage /> : <LandingPage />
}
