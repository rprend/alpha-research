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

type PublicEnvironment = {
  name: string
  access: string
  coverage: string
  description: string
  href?: string
  state?: string
}

const ROOT_HOST = 'alpharesearch.nyc'
const DASHBOARD_HOST = 'dashboard.alpharesearch.nyc'
const url = new URL(window.location.href)
const isDashboardView = window.location.hostname === DASHBOARD_HOST || url.searchParams.get('view') === 'dashboard'
const dashboardOrigin = window.location.hostname === 'localhost' ? window.location.origin : `https://${DASHBOARD_HOST}`

const publicEnvironments: PublicEnvironment[] = [
  {
    name: 'Alpha Book',
    access: 'Public',
    coverage: '75,000 books',
    description: 'Project Gutenberg mirror for literary and historical primary-source research.',
    href: 'https://alpha-book.org/',
  },
  {
    name: 'Scene Wiki',
    access: 'Public',
    coverage: 'Community corpus',
    description: 'A research environment built from scraped online community data and labeled canon.',
    href: 'https://scenewiki.net/',
  },
  {
    name: 'Alpha Econ',
    access: 'Public soon',
    coverage: 'Census, BLS, NBER',
    description: 'Economic indicators, housing data, and working papers prepared for agentic analysis.',
    state: 'Coming soon',
  },
]

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

function setAuthStatus(message: string, isError = false) {
  const authStatus = document.querySelector<HTMLElement>('[data-auth-status]')
  if (!authStatus) {
    return
  }
  authStatus.textContent = message
  authStatus.dataset.state = isError ? 'error' : 'neutral'
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
  authButton?.addEventListener('click', async () => {
    if (authButton.dataset.state === 'authenticated') {
      window.location.assign(dashboardOrigin)
      return
    }

    if (window.location.hostname === ROOT_HOST) {
      const destination = new URL(dashboardOrigin)
      destination.searchParams.set('login', '1')
      window.location.assign(destination.toString())
      return
    }

    beginLogin()
  })
}

function renderPublicEnvironmentCards() {
  return publicEnvironments.map((environment) => {
    const title = escapeHtml(environment.name)
    const access = escapeHtml(environment.access)
    const coverage = escapeHtml(environment.coverage)
    const description = escapeHtml(environment.description)
    const state = environment.state
      ? `<span class="dashboard-chip dashboard-chip-muted">${escapeHtml(environment.state)}</span>`
      : ''

    const body = `
      <article class="dashboard-card dashboard-card-public">
        <div class="dashboard-card-head">
          <div>
            <p class="dashboard-card-kicker">${access}</p>
            <h3>${title}</h3>
          </div>
          ${state}
        </div>
        <p class="dashboard-card-meta">${coverage}</p>
        <p class="dashboard-card-copy">${description}</p>
      </article>
    `

    if (!environment.href) {
      return body
    }

    return `
      <a class="dashboard-card-link" href="${escapeHtml(environment.href)}" target="_blank" rel="noopener noreferrer">
        ${body}
      </a>
    `
  }).join('')
}

function renderDatasetCards(datasets: DatasetRecord[]) {
  if (datasets.length === 0) {
    return `
      <article class="dashboard-empty">
        <h3>No private environments yet</h3>
        <p>Create one through the RESEARCH CLI and it will show up here automatically.</p>
      </article>
    `
  }

  return datasets.map((dataset) => {
    const description = dataset.description?.trim()
      || dataset.sourceFilename?.trim()
      || `Source type: ${dataset.sourceType}`

    return `
      <article class="dashboard-card">
        <div class="dashboard-card-head">
          <div>
            <p class="dashboard-card-kicker">Private environment</p>
            <h3>${escapeHtml(dataset.name)}</h3>
          </div>
          <span class="dashboard-chip">${escapeHtml(formatStatus(dataset.status))}</span>
        </div>
        <p class="dashboard-card-copy">${escapeHtml(truncate(description, 180))}</p>
        <dl class="dashboard-meta-grid">
          <div>
            <dt>Dataset ID</dt>
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
      <article class="dashboard-empty dashboard-empty-wide">
        <h3>No research runs yet</h3>
        <p>Runs started through the RESEARCH CLI will appear here with their latest status and prompt.</p>
      </article>
    `
  }

  return runs.map((run) => {
    const dataset = datasetLookup.get(run.datasetId)
    const prompt = run.prompt?.trim() || run.outputPreview?.trim() || 'No prompt recorded yet.'
    return `
      <article class="run-row">
        <div class="run-row-primary">
          <div class="run-row-titleline">
            <h3>${escapeHtml(dataset?.name ?? run.datasetId)}</h3>
            <span class="dashboard-chip">${escapeHtml(formatStatus(run.status))}</span>
          </div>
          <p class="run-row-copy">${escapeHtml(truncate(prompt, 220))}</p>
        </div>
        <dl class="run-row-meta">
          <div>
            <dt>Run</dt>
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

function renderDashboardFrame(content: string) {
  document.body.innerHTML = content
}

function renderDashboardLoading() {
  document.title = 'Dashboard | Alpha Research'
  renderDashboardFrame(`
    <div class="dashboard-page">
      <header class="dashboard-nav-shell">
        <div class="dashboard-shell dashboard-nav">
          <a class="logo-link" href="https://${ROOT_HOST}/" aria-label="Alpha Research home">
            <img class="logo-wordmark" src="/alpha-research-wordmark.png" alt="Alpha Research logo" />
          </a>
          <div class="dashboard-nav-actions">
            <a class="dashboard-nav-link" href="https://${ROOT_HOST}/#cli">CLI</a>
            <button class="dashboard-nav-button" type="button" data-dashboard-login>Sign in</button>
          </div>
        </div>
      </header>
      <main class="dashboard-main">
        <div class="dashboard-shell">
          <section class="dashboard-hero dashboard-hero-loading">
            <p class="dashboard-kicker">Research CLI</p>
            <h1>Loading your dashboard</h1>
            <p class="dashboard-hero-copy">Fetching datasets, research environments, and recent runs.</p>
          </section>
        </div>
      </main>
    </div>
  `)

  document.querySelector<HTMLElement>('[data-dashboard-login]')?.addEventListener('click', () => {
    beginLogin()
  })
}

function renderDashboardSignedOut(session: SessionResponse) {
  document.title = 'Dashboard | Alpha Research'
  const message = session.configured
    ? 'Sign in to view your private datasets, shared research environments, and previous runs.'
    : (session.error ?? 'Auth is not configured on this deployment.')

  renderDashboardFrame(`
    <div class="dashboard-page">
      <header class="dashboard-nav-shell">
        <div class="dashboard-shell dashboard-nav">
          <a class="logo-link" href="https://${ROOT_HOST}/" aria-label="Alpha Research home">
            <img class="logo-wordmark" src="/alpha-research-wordmark.png" alt="Alpha Research logo" />
          </a>
          <div class="dashboard-nav-actions">
            <a class="dashboard-nav-link" href="https://${ROOT_HOST}/">Marketing site</a>
            <button class="dashboard-nav-button" type="button" data-dashboard-login ${session.configured ? '' : 'disabled aria-disabled="true"'}>
              Sign in
            </button>
          </div>
        </div>
      </header>
      <main class="dashboard-main">
        <div class="dashboard-shell">
          <section class="dashboard-hero">
            <div class="dashboard-hero-copywrap">
              <p class="dashboard-kicker">Research dashboard</p>
              <h1>Datasets, environments, and runs in one place</h1>
              <p class="dashboard-hero-copy">${escapeHtml(message)}</p>
            </div>
            <div class="dashboard-stat-grid">
              <article class="dashboard-stat-card">
                <span class="dashboard-stat-label">Public environments</span>
                <strong>${publicEnvironments.length}</strong>
              </article>
              <article class="dashboard-stat-card">
                <span class="dashboard-stat-label">Private environments</span>
                <strong>Sign in</strong>
              </article>
              <article class="dashboard-stat-card">
                <span class="dashboard-stat-label">Past runs</span>
                <strong>Sign in</strong>
              </article>
            </div>
          </section>

          <section class="dashboard-section">
            <div class="dashboard-section-head">
              <div>
                <p class="dashboard-section-kicker">Public</p>
                <h2>Shared research environments</h2>
              </div>
            </div>
            <div class="dashboard-card-grid dashboard-card-grid-public">
              ${renderPublicEnvironmentCards()}
            </div>
          </section>
        </div>
      </main>
    </div>
  `)

  document.querySelector<HTMLElement>('[data-dashboard-login]')?.addEventListener('click', () => {
    if (session.configured) {
      beginLogin()
    }
  })
}

function renderDashboard(session: SessionResponse, datasets: DatasetRecord[], runs: RunRecord[]) {
  document.title = 'Dashboard | Alpha Research'
  const sortedDatasets = [...datasets].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const sortedRuns = [...runs].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const datasetLookup = new Map(sortedDatasets.map((dataset) => [dataset.id, dataset]))

  renderDashboardFrame(`
    <div class="dashboard-page">
      <header class="dashboard-nav-shell">
        <div class="dashboard-shell dashboard-nav">
          <a class="logo-link" href="https://${ROOT_HOST}/" aria-label="Alpha Research home">
            <img class="logo-wordmark" src="/alpha-research-wordmark.png" alt="Alpha Research logo" />
          </a>
          <div class="dashboard-nav-actions">
            <a class="dashboard-nav-link" href="https://${ROOT_HOST}/#cli">CLI docs</a>
            <span class="dashboard-user-pill">${escapeHtml(session.user?.email ?? '')}</span>
            <button class="dashboard-nav-button dashboard-nav-button-secondary" type="button" data-dashboard-logout>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main class="dashboard-main">
        <div class="dashboard-shell">
          <section class="dashboard-hero">
            <div class="dashboard-hero-copywrap">
              <p class="dashboard-kicker">Research dashboard</p>
              <h1>Your datasets, research environments, and past runs</h1>
              <p class="dashboard-hero-copy">
                Public environments stay visible alongside your own private corpora, so the RESEARCH CLI has a clear logged-in home.
              </p>
            </div>
            <div class="dashboard-stat-grid">
              <article class="dashboard-stat-card">
                <span class="dashboard-stat-label">Public environments</span>
                <strong>${publicEnvironments.length}</strong>
              </article>
              <article class="dashboard-stat-card">
                <span class="dashboard-stat-label">Private environments</span>
                <strong>${sortedDatasets.length}</strong>
              </article>
              <article class="dashboard-stat-card">
                <span class="dashboard-stat-label">Active runs</span>
                <strong>${countActiveRuns(sortedRuns)}</strong>
              </article>
              <article class="dashboard-stat-card">
                <span class="dashboard-stat-label">Past runs</span>
                <strong>${sortedRuns.length}</strong>
              </article>
            </div>
          </section>

          <div class="dashboard-grid">
            <section class="dashboard-section">
              <div class="dashboard-section-head">
                <div>
                  <p class="dashboard-section-kicker">Public</p>
                  <h2>Shared research environments</h2>
                </div>
              </div>
              <div class="dashboard-card-grid dashboard-card-grid-public">
                ${renderPublicEnvironmentCards()}
              </div>
            </section>

            <section class="dashboard-section">
              <div class="dashboard-section-head">
                <div>
                  <p class="dashboard-section-kicker">Private</p>
                  <h2>Your datasets and environments</h2>
                </div>
              </div>
              <div class="dashboard-card-grid">
                ${renderDatasetCards(sortedDatasets)}
              </div>
            </section>
          </div>

          <section class="dashboard-section dashboard-section-runs">
            <div class="dashboard-section-head">
              <div>
                <p class="dashboard-section-kicker">History</p>
                <h2>Past research runs</h2>
              </div>
            </div>
            <div class="run-list">
              ${renderRunRows(sortedRuns, datasetLookup)}
            </div>
          </section>
        </div>
      </main>
    </div>
  `)

  document.querySelector<HTMLElement>('[data-dashboard-logout]')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    })
    window.location.assign(`https://${ROOT_HOST}/`)
  })
}

async function initDashboard() {
  renderDashboardLoading()

  try {
    const session = await fetchSession()
    if (!session.configured || !session.authenticated || !session.user) {
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
    beginLogin()
  }
}

if (isDashboardView) {
  void initDashboard()
} else {
  void initMarketingPage()
}
