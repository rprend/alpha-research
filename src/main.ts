import './style.css'

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
const INSTALL_COMMAND = 'curl -fsSL https://raw.githubusercontent.com/zenobia-pay/alpha-research/codex/initial-substrate/scripts/install_alpha_research.sh | bash'
const DASHBOARD_LABEL = 'Research Dashboard'
const url = new URL(window.location.href)
const isDashboardView = window.location.hostname === DASHBOARD_HOST || url.searchParams.get('view') === 'dashboard'
const rootOrigin = window.location.hostname === 'localhost' ? window.location.origin : `https://${ROOT_HOST}`
const dashboardOrigin = window.location.hostname === 'localhost' ? window.location.origin : `https://${DASHBOARD_HOST}`

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength - 1).trimEnd()}…`
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

function formatStatus(value: string | null | undefined) {
  if (!value) {
    return 'Unknown'
  }
  return value.replaceAll(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function countActiveRuns(runs: RunRecord[]) {
  return runs.filter((run) => !['ready', 'completed', 'failed', 'cancelled', 'canceled', 'error'].includes(run.status.toLowerCase())).length
}

function latestUpdate(items: Array<{ updatedAt: string }>) {
  if (items.length === 0) {
    return 'No recent activity'
  }
  return relativeTime(items.map((item) => item.updatedAt).sort().at(-1) ?? '')
}

function setAuthStatus(message: string, isError = false) {
  const authStatus = document.querySelector<HTMLElement>('[data-auth-status]')
  if (!authStatus) {
    return
  }
  authStatus.textContent = message
  authStatus.dataset.state = isError ? 'error' : 'neutral'
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

function beginDashboardBridge() {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const destination = new URL('/api/auth/bridge', rootOrigin)
  destination.searchParams.set('return_to', `${dashboardOrigin}${returnTo}`)
  window.location.assign(destination.toString())
}

function beginDashboardLogin() {
  const destination = new URL('/api/auth/start', rootOrigin)
  const bridgeReturn = `/api/auth/bridge?return_to=${encodeURIComponent(dashboardOrigin)}`
  destination.searchParams.set('return_to', bridgeReturn)
  window.location.assign(destination.toString())
}

function beginLogin() {
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

function bindCopyButtons() {
  const copyButtons = document.querySelectorAll<HTMLButtonElement>('[data-copy-target]')
  copyButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = button.dataset.copyTarget
      if (!targetId) {
        return
      }
      const target = document.getElementById(targetId)
      const text = target?.textContent?.trim()
      if (!text) {
        return
      }

      try {
        await navigator.clipboard.writeText(text)
        const previous = button.textContent
        button.textContent = 'Copied'
        window.setTimeout(() => {
          button.textContent = previous ?? 'Copy'
        }, 1600)
      } catch {
        if (!target) {
          return
        }
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(target)
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
    })
  })
}

async function refreshMarketingAuthUi() {
  const authButton = document.querySelector<HTMLElement>('[data-auth-action]')
  if (!authButton) {
    return
  }

  try {
    const session = await fetchSession()
    if (!session.configured) {
      authButton.textContent = 'auth offline'
      authButton.setAttribute('disabled', 'true')
      authButton.setAttribute('aria-disabled', 'true')
      setAuthStatus(session.error ?? 'Auth is not configured on this deployment.', true)
      return
    }

    authButton.removeAttribute('disabled')
    authButton.removeAttribute('aria-disabled')

    if (session.authenticated && session.user) {
      authButton.textContent = 'dashboard'
      authButton.dataset.state = 'authenticated'
      authButton.setAttribute('aria-label', `Open dashboard for ${session.user.email}`)
      setAuthStatus(`Signed in as ${session.user.email}`)
      return
    }

    authButton.textContent = 'login'
    authButton.dataset.state = 'anonymous'
    authButton.removeAttribute('aria-label')
    setAuthStatus('')
  } catch {
    authButton.textContent = 'login'
    authButton.dataset.state = 'anonymous'
    setAuthStatus('Could not reach auth service.', true)
  }
}

function bindMarketingAuth() {
  const authButton = document.querySelector<HTMLElement>('[data-auth-action]')
  authButton?.addEventListener('click', () => {
    if (authButton.dataset.state === 'authenticated' || window.location.hostname === ROOT_HOST) {
      beginDashboardBridge()
      return
    }

    beginLogin()
  })
}

function renderDatasetRows(datasets: DatasetRecord[]) {
  if (datasets.length === 0) {
    return `
      <div class="shad-empty-state">
        <h3>No datasets yet</h3>
        <p>Create one with the RESEARCH CLI and it will appear here automatically.</p>
      </div>
    `
  }

  return datasets.map((dataset) => {
    const description = dataset.description?.trim()
      || dataset.sourceFilename?.trim()
      || `Source type: ${dataset.sourceType}`

    return `
      <tr>
        <td>
          <div class="shad-table-main">
            <strong>${escapeHtml(dataset.name)}</strong>
            <span>${escapeHtml(truncate(description, 120))}</span>
          </div>
        </td>
        <td>${escapeHtml(formatStatus(dataset.mode ?? 'default'))}</td>
        <td><span class="shad-badge">${escapeHtml(formatStatus(dataset.status))}</span></td>
        <td>${escapeHtml(formatStatus(dataset.deploymentStatus))}</td>
        <td>${escapeHtml(relativeTime(dataset.updatedAt))}</td>
      </tr>
    `
  }).join('')
}

function renderRunRows(runs: RunRecord[], datasetLookup: Map<string, DatasetRecord>) {
  if (runs.length === 0) {
    return `
      <div class="shad-empty-state">
        <h3>No runs yet</h3>
        <p>Runs launched from the RESEARCH CLI will appear here with status and prompt history.</p>
      </div>
    `
  }

  return runs.map((run) => {
    const dataset = datasetLookup.get(run.datasetId)
    const prompt = run.prompt?.trim() || run.outputPreview?.trim() || 'No prompt recorded yet.'
    const runAnchor = `run-${run.id}`

    return `
      <tr id="${escapeHtml(runAnchor)}">
        <td>
          <div class="shad-table-main">
            <strong>${escapeHtml(dataset?.name ?? run.datasetId)}</strong>
            <span>${escapeHtml(truncate(prompt, 120))}</span>
            <span><a href="#${escapeHtml(runAnchor)}">Run ${escapeHtml(run.id.slice(0, 8))}</a></span>
          </div>
        </td>
        <td>${escapeHtml(formatStatus(run.type))}</td>
        <td><span class="shad-badge">${escapeHtml(formatStatus(run.status))}</span></td>
        <td>${escapeHtml(formatDateTime(run.createdAt))}</td>
        <td>${escapeHtml(relativeTime(run.updatedAt))}</td>
      </tr>
    `
  }).join('')
}

function renderCliPanel() {
  return `
    <section class="shad-card" id="cli">
      <div class="shad-card-header">
        <div class="shad-card-titleblock">
          <h3>The RESEARCH CLI</h3>
          <p>Install the CLI, authenticate in browser, and reopen datasets or runs from this dashboard.</p>
        </div>
      </div>
      <div class="shad-cli-list">
        <div class="shad-cli-row">
          <div>
            <p class="shad-inline-label">Install</p>
            <p>Bootstrap the CLI on a fresh machine.</p>
          </div>
          <button class="shad-secondary-button" type="button" data-copy-target="dash-install-command">Copy</button>
        </div>
        <pre class="shad-code" id="dash-install-command"><code>${escapeHtml(INSTALL_COMMAND)}</code></pre>

        <div class="shad-cli-row">
          <div>
            <p class="shad-inline-label">Start</p>
            <p>The CLI opens browser auth, registers the dataset, and creates runs you can reopen later here.</p>
          </div>
        </div>
        <pre class="shad-code"><code>research</code></pre>

        <div class="shad-note-list">
          <strong>Browser auth</strong>
          <span>The CLI uses <code>/cli/login</code> and the same Worker-backed session as this dashboard.</span>
          <strong>Data source</strong>
          <span>This page reads from <code>/api/cli/datasets</code> and <code>/api/cli/runs</code>, which are the same control-plane records written by the RESEARCH CLI.</span>
        </div>
      </div>
    </section>
  `
}

function renderDashboardFrame(content: string) {
  document.body.innerHTML = content
}

function renderDashboardLoading() {
  document.title = `${DASHBOARD_LABEL} | Alpha Research`
  renderDashboardFrame(`
    <div class="shad-shell">
      <aside class="shad-sidebar">
        <a class="shad-brand" href="${rootOrigin}/" aria-label="Alpha Research home">
          <img class="logo-wordmark" src="/alpha-research-wordmark.png" alt="Alpha Research logo" />
        </a>
        <nav class="shad-sidebar-group">
          <a class="shad-sidebar-link is-active" href="#home">Dashboard</a>
          <a class="shad-sidebar-link" href="#datasets">Datasets</a>
          <a class="shad-sidebar-link" href="#runs">Runs</a>
          <a class="shad-sidebar-link" href="#cli">CLI</a>
        </nav>
      </aside>
      <main class="shad-main">
        <div class="shad-topbar">
          <div>
            <p class="shad-kicker">Research</p>
            <h1>Loading dashboard</h1>
          </div>
        </div>
      </main>
    </div>
  `)
}

function renderDashboardSignedOut(session: SessionResponse) {
  document.title = `${DASHBOARD_LABEL} | Alpha Research`
  const message = session.configured
    ? 'Sign in to view the datasets and runs created by the RESEARCH CLI.'
    : (session.error ?? 'Auth is not configured on this deployment.')

  renderDashboardFrame(`
    <div class="shad-shell">
      <aside class="shad-sidebar">
        <a class="shad-brand" href="${rootOrigin}/" aria-label="Alpha Research home">
          <img class="logo-wordmark" src="/alpha-research-wordmark.png" alt="Alpha Research logo" />
        </a>
        <div class="shad-sidebar-label">Platform</div>
        <nav class="shad-sidebar-group">
          <a class="shad-sidebar-link is-active" href="#home">Dashboard</a>
          <a class="shad-sidebar-link" href="#cli">CLI</a>
        </nav>
      </aside>
      <main class="shad-main">
        <div class="shad-topbar">
          <div>
            <p class="shad-kicker">Dashboard</p>
            <h1>RESEARCH CLI workspace</h1>
          </div>
        </div>

        <section class="shad-card shad-empty-card" id="home">
          <div class="shad-card-header">
            <div class="shad-card-titleblock">
              <h2>Sign in required</h2>
              <p>${escapeHtml(message)}</p>
            </div>
            <button class="shad-primary-button" type="button" data-dashboard-login ${session.configured ? '' : 'disabled aria-disabled="true"'}>
                Sign in
            </button>
          </div>
        </section>

        <div class="shad-grid">
          ${renderCliPanel()}
        </div>
      </main>
    </div>
  `)

  document.querySelector<HTMLElement>('[data-dashboard-login]')?.addEventListener('click', () => {
    if (session.configured) {
      beginDashboardLogin()
    }
  })

  bindCopyButtons()
}

function renderDashboard(session: SessionResponse, datasets: DatasetRecord[], runs: RunRecord[]) {
  document.title = `${DASHBOARD_LABEL} | Alpha Research`
  const sortedDatasets = [...datasets].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const sortedRuns = [...runs].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const datasetLookup = new Map(sortedDatasets.map((dataset) => [dataset.id, dataset]))
  const privateDatasets = sortedDatasets.length
  const activeRuns = countActiveRuns(sortedRuns)

  renderDashboardFrame(`
    <div class="shad-shell">
      <aside class="shad-sidebar">
        <a class="shad-brand" href="${rootOrigin}/" aria-label="Alpha Research home">
          <img class="logo-wordmark" src="/alpha-research-wordmark.png" alt="Alpha Research logo" />
        </a>

        <div class="shad-sidebar-label">Platform</div>
        <nav class="shad-sidebar-group">
          <a class="shad-sidebar-link is-active" href="#home">Dashboard</a>
          <a class="shad-sidebar-link" href="#datasets">Datasets</a>
          <a class="shad-sidebar-link" href="#runs">Runs</a>
          <a class="shad-sidebar-link" href="#cli">CLI</a>
        </nav>

        <div class="shad-sidebar-footer">
          <span class="shad-user-email">${escapeHtml(session.user?.email ?? '')}</span>
          <button class="shad-ghost-button" type="button" data-dashboard-logout>Log out</button>
        </div>
      </aside>

      <main class="shad-main">
        <div class="shad-topbar" id="home">
          <div>
            <p class="shad-kicker">Dashboard</p>
            <h1>Research</h1>
          </div>
          <div class="shad-topbar-actions">
            <a class="shad-ghost-button" href="#cli">Quick Create</a>
          </div>
        </div>

        <section class="shad-metric-grid">
          <article class="shad-metric-card">
            <div class="shad-metric-head"><span>Datasets</span><span>Private</span></div>
            <strong>${privateDatasets}</strong>
            <p>Datasets registered through the RESEARCH CLI.</p>
          </article>
          <article class="shad-metric-card">
            <div class="shad-metric-head"><span>Active Runs</span><span>Live</span></div>
            <strong>${activeRuns}</strong>
            <p>Currently processing, ingesting, or deploying.</p>
          </article>
          <article class="shad-metric-card">
            <div class="shad-metric-head"><span>Total Runs</span><span>History</span></div>
            <strong>${sortedRuns.length}</strong>
            <p>Latest activity ${escapeHtml(latestUpdate(sortedRuns))}.</p>
          </article>
        </section>

        <div class="shad-grid">
          <section class="shad-card" id="datasets">
            <div class="shad-card-header">
              <div class="shad-card-titleblock">
                <h3>Datasets</h3>
                <p>Your private research datasets and environments.</p>
              </div>
            </div>
            <div class="shad-table-wrap">
              <table class="shad-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>Deployment</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderDatasetRows(sortedDatasets)}
                </tbody>
              </table>
            </div>
          </section>

          <section class="shad-card" id="runs">
            <div class="shad-card-header">
              <div class="shad-card-titleblock">
                <h3>Runs</h3>
                <p>Past research runs launched from the RESEARCH CLI.</p>
              </div>
            </div>
            <div class="shad-table-wrap">
              <table class="shad-table">
                <thead>
                  <tr>
                    <th>Dataset</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderRunRows(sortedRuns, datasetLookup)}
                </tbody>
              </table>
            </div>
          </section>

          <div class="shad-side-stack">
            ${renderCliPanel()}
          </div>
        </div>
      </main>
    </div>
  `)

  document.querySelector<HTMLElement>('[data-dashboard-logout]')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    })
    window.location.assign(`${dashboardOrigin}?logged_out=1`)
  })

  bindCopyButtons()
}

async function initDashboard() {
  renderDashboardLoading()

  const loggedOut = url.searchParams.get('logged_out') === '1'

  try {
    const session = await fetchSession()

    if (!session.configured) {
      renderDashboardSignedOut(session)
      return
    }

    if (!session.authenticated || !session.user) {
      if (!loggedOut) {
        beginDashboardBridge()
        return
      }

      try {
        const [datasets, runs] = await Promise.all([
          fetchJson<DatasetRecord[]>('/api/cli/datasets'),
          fetchJson<RunRecord[]>('/api/cli/runs'),
        ])

        renderDashboard({
          authenticated: true,
          configured: true,
          user: { email: 'Signed in' },
        }, datasets, runs)
        return
      } catch {
        renderDashboardSignedOut(session)
        return
      }
    }

    const [datasets, runs] = await Promise.all([
      fetchJson<DatasetRecord[]>('/api/cli/datasets'),
      fetchJson<RunRecord[]>('/api/cli/runs'),
    ])

    renderDashboard(session, datasets, runs)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load dashboard.'
    renderDashboardSignedOut({
      authenticated: false,
      configured: true,
      user: null,
      error: message,
    })
  }
}

async function initMarketingPage() {
  initCal()
  bindMarketingAuth()
  bindCopyButtons()
  await refreshMarketingAuthUi()

  const authError = url.searchParams.get('auth_error')
  if (authError) {
    setAuthStatus(authError, true)
  }

  if (url.searchParams.get('login') === '1') {
    beginDashboardLogin()
  }
}

if (isDashboardView) {
  void initDashboard()
} else {
  void initMarketingPage()
}
