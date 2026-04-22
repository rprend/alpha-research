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
  })
  return response.json() as Promise<SessionResponse>
}

async function fetchJson<T>(input: string) {
  const response = await fetch(input, {
    credentials: 'same-origin',
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

function renderDatasetCards(datasets: DatasetRecord[]) {
  if (datasets.length === 0) {
    return `
      <article class="dash-empty">
        <h3>No private datasets yet</h3>
        <p>Create a dataset from the RESEARCH CLI and it will appear here automatically.</p>
      </article>
    `
  }

  return datasets.map((dataset) => {
    const description = dataset.description?.trim()
      || dataset.sourceFilename?.trim()
      || `Source type: ${dataset.sourceType}`

    return `
      <article class="dash-card">
        <div class="dash-card-top">
          <div>
            <p class="dash-label">Private dataset</p>
            <h3>${escapeHtml(dataset.name)}</h3>
          </div>
          <span class="dash-badge">${escapeHtml(formatStatus(dataset.status))}</span>
        </div>
        <p class="dash-card-copy">${escapeHtml(truncate(description, 180))}</p>
        <dl class="dash-definition-grid">
          <div>
            <dt>ID</dt>
            <dd>${escapeHtml(dataset.id)}</dd>
          </div>
          <div>
            <dt>Deployment</dt>
            <dd>${escapeHtml(formatStatus(dataset.deploymentStatus))}</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>${escapeHtml(formatStatus(dataset.mode ?? 'default'))}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>${escapeHtml(relativeTime(dataset.updatedAt))}</dd>
          </div>
        </dl>
      </article>
    `
  }).join('')
}

function renderRunRows(runs: RunRecord[], datasetLookup: Map<string, DatasetRecord>) {
  if (runs.length === 0) {
    return `
      <article class="dash-empty dash-empty-compact">
        <h3>No research runs yet</h3>
        <p>Runs launched from the RESEARCH CLI will appear here with status and prompt history.</p>
      </article>
    `
  }

  return runs.map((run) => {
    const dataset = datasetLookup.get(run.datasetId)
    const prompt = run.prompt?.trim() || run.outputPreview?.trim() || 'No prompt recorded yet.'

    return `
      <article class="dash-run-row">
        <div class="dash-run-main">
          <div class="dash-run-head">
            <div>
              <p class="dash-label">Dataset</p>
              <h3>${escapeHtml(dataset?.name ?? run.datasetId)}</h3>
            </div>
            <span class="dash-badge">${escapeHtml(formatStatus(run.status))}</span>
          </div>
          <p class="dash-run-copy">${escapeHtml(truncate(prompt, 240))}</p>
        </div>
        <dl class="dash-run-meta">
          <div>
            <dt>Run ID</dt>
            <dd>${escapeHtml(run.id)}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>${escapeHtml(formatStatus(run.type))}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>${escapeHtml(formatDateTime(run.createdAt))}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>${escapeHtml(relativeTime(run.updatedAt))}</dd>
          </div>
        </dl>
      </article>
    `
  }).join('')
}

function renderCliCard() {
  return `
    <section class="dash-panel" id="cli">
      <div class="dash-panel-head">
        <div>
          <p class="dash-label">RESEARCH CLI</p>
          <h2>Connect and reopen your work</h2>
        </div>
      </div>
      <div class="dash-cli-card">
        <div class="dash-cli-row">
          <div>
            <p class="dash-cli-label">Install</p>
            <p class="dash-cli-copy">Bootstrap the CLI on a fresh machine.</p>
          </div>
          <button class="dash-inline-button" type="button" data-copy-target="dash-install-command">Copy</button>
        </div>
        <pre class="dash-code" id="dash-install-command"><code>${escapeHtml(INSTALL_COMMAND)}</code></pre>
      </div>
      <div class="dash-cli-card">
        <div class="dash-cli-row">
          <div>
            <p class="dash-cli-label">Start a dataset</p>
            <p class="dash-cli-copy">The CLI opens browser auth, registers the dataset, then creates runs you can reopen later here.</p>
          </div>
        </div>
        <pre class="dash-code"><code>research</code></pre>
      </div>
      <div class="dash-cli-notes">
        <div class="dash-note">
          <strong>Browser auth</strong>
          <span>The CLI uses <code>/cli/login</code> and the same Worker-backed session as this dashboard.</span>
        </div>
        <div class="dash-note">
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
    <div class="dash-app">
      <aside class="dash-sidebar">
        <a class="dash-brand" href="${rootOrigin}/" aria-label="Alpha Research home">
          <img class="logo-wordmark" src="/alpha-research-wordmark.png" alt="Alpha Research logo" />
        </a>
      </aside>
      <main class="dash-main">
        <section class="dash-hero-card dash-hero-card-loading">
          <div>
            <p class="dash-label">Research CLI</p>
            <h1>Loading your dashboard</h1>
            <p class="dash-hero-copy">Fetching datasets, runs, and account state.</p>
          </div>
        </section>
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
    <div class="dash-app">
      <aside class="dash-sidebar">
        <a class="dash-brand" href="${rootOrigin}/" aria-label="Alpha Research home">
          <img class="logo-wordmark" src="/alpha-research-wordmark.png" alt="Alpha Research logo" />
        </a>
        <nav class="dash-sidebar-nav">
          <a class="dash-sidebar-item is-active" href="#home">Home</a>
          <a class="dash-sidebar-item" href="#cli">CLI</a>
        </nav>
      </aside>
      <main class="dash-main">
        <section class="dash-hero-card" id="home">
          <div class="dash-hero-copyblock">
            <p class="dash-label">Research dashboard</p>
            <h1>Datasets and runs from the RESEARCH CLI</h1>
            <p class="dash-hero-copy">${escapeHtml(message)}</p>
            <div class="dash-hero-actions">
              <button class="dash-primary-button" type="button" data-dashboard-login ${session.configured ? '' : 'disabled aria-disabled="true"'}>
                Sign in
              </button>
              <a class="dash-secondary-button" href="${rootOrigin}/#cli">View CLI docs</a>
            </div>
          </div>
          <div class="dash-stat-grid">
            <article class="dash-stat-card">
              <span class="dash-stat-label">Private datasets</span>
              <strong>Sign in</strong>
            </article>
            <article class="dash-stat-card">
              <span class="dash-stat-label">Past runs</span>
              <strong>Sign in</strong>
            </article>
            <article class="dash-stat-card">
              <span class="dash-stat-label">CLI session</span>
              <strong>Sign in</strong>
            </article>
          </div>
        </section>

        <section class="dash-content-grid">
          ${renderCliCard()}
        </section>
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
    <div class="dash-app">
      <aside class="dash-sidebar">
        <a class="dash-brand" href="${rootOrigin}/" aria-label="Alpha Research home">
          <img class="logo-wordmark" src="/alpha-research-wordmark.png" alt="Alpha Research logo" />
        </a>

        <nav class="dash-sidebar-nav">
          <a class="dash-sidebar-item is-active" href="#home">Home</a>
          <a class="dash-sidebar-item" href="#datasets">Datasets</a>
          <a class="dash-sidebar-item" href="#runs">Runs</a>
          <a class="dash-sidebar-item" href="#cli">CLI</a>
        </nav>

        <div class="dash-sidebar-section">
          <p class="dash-sidebar-heading">Account</p>
          <div class="dash-sidebar-card">
            <span class="dash-sidebar-email">${escapeHtml(session.user?.email ?? '')}</span>
            <span class="dash-sidebar-hint">Shared session for site + CLI</span>
            <button class="dash-sidebar-logout" type="button" data-dashboard-logout>Log out</button>
          </div>
        </div>

        <div class="dash-sidebar-links">
          <a href="${rootOrigin}/#cli">Documentation</a>
          <a href="${rootOrigin}/blog/">Blog</a>
        </div>
      </aside>

      <main class="dash-main">
        <section class="dash-hero-card" id="home">
          <div class="dash-hero-copyblock">
            <p class="dash-label">Research dashboard</p>
            <h1>RESEARCH CLI datasets and runs</h1>
            <p class="dash-hero-copy">
              This view is backed by the same Worker control plane the RESEARCH CLI writes to. Private datasets come from <code>/api/cli/datasets</code> and run history comes from <code>/api/cli/runs</code>.
            </p>
            <div class="dash-hero-actions">
              <a class="dash-primary-button" href="#datasets">View datasets</a>
              <a class="dash-secondary-button" href="#runs">View runs</a>
            </div>
          </div>
          <div class="dash-stat-grid">
            <article class="dash-stat-card">
              <span class="dash-stat-label">Private datasets</span>
              <strong>${privateDatasets}</strong>
              <span class="dash-stat-foot">Owned by your CLI session</span>
            </article>
            <article class="dash-stat-card">
              <span class="dash-stat-label">Active runs</span>
              <strong>${activeRuns}</strong>
              <span class="dash-stat-foot">Currently processing or deploying</span>
            </article>
            <article class="dash-stat-card">
              <span class="dash-stat-label">Past runs</span>
              <strong>${sortedRuns.length}</strong>
              <span class="dash-stat-foot">Latest activity ${escapeHtml(latestUpdate(sortedRuns))}</span>
            </article>
          </div>
        </section>

        <section class="dash-content-grid">
          <div class="dash-column">
            <section class="dash-panel" id="datasets">
              <div class="dash-panel-head">
                <div>
                  <p class="dash-label">Private</p>
                  <h2>Your datasets</h2>
                </div>
              </div>
              <div class="dash-stack">
                ${renderDatasetCards(sortedDatasets)}
              </div>
            </section>

            <section class="dash-panel" id="runs">
              <div class="dash-panel-head">
                <div>
                  <p class="dash-label">Run history</p>
                  <h2>Past research runs</h2>
                </div>
              </div>
              <div class="dash-stack">
                ${renderRunRows(sortedRuns, datasetLookup)}
              </div>
            </section>
          </div>

          ${renderCliCard()}
        </section>
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
      if (!loggedOut && document.referrer.includes(ROOT_HOST)) {
        beginDashboardBridge()
        return
      }
      renderDashboardSignedOut(session)
      return
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
