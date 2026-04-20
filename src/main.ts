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

const authButton = document.querySelector<HTMLElement>('[data-auth-action]')
const authBackdrop = document.querySelector<HTMLElement>('[data-auth-backdrop]')
const authForm = document.querySelector<HTMLFormElement>('[data-auth-form]')
const authClose = document.querySelector<HTMLElement>('[data-auth-close]')
const authStatus = document.querySelector<HTMLElement>('[data-auth-status]')
const url = new URL(window.location.href)

function setAuthStatus(message: string, isError = false) {
  if (!authStatus) {
    return
  }
  authStatus.textContent = message
  authStatus.dataset.state = isError ? 'error' : 'neutral'
}

function setModalOpen(open: boolean) {
  if (!authBackdrop) {
    return
  }
  authBackdrop.classList.toggle('hidden', !open)
  if (open) {
    const input = authForm?.querySelector<HTMLInputElement>('input[name="email"]')
    input?.focus()
  }
}

async function fetchSession() {
  const response = await fetch('/api/auth/session', {
    credentials: 'same-origin',
  })
  return response.json() as Promise<SessionResponse>
}

async function refreshAuthUi() {
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
      authButton.textContent = session.user.email
      authButton.dataset.state = 'authenticated'
      setAuthStatus(`Signed in as ${session.user.email}`)
      return
    }
    authButton.textContent = 'login'
    authButton.dataset.state = 'anonymous'
    setAuthStatus('')
  } catch {
    authButton.textContent = 'login'
    authButton.dataset.state = 'anonymous'
    setAuthStatus('Could not reach auth service.', true)
  }
}

authButton?.addEventListener('click', async () => {
  if (authButton.dataset.state === 'authenticated') {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    })
    await refreshAuthUi()
    return
  }
  setModalOpen(true)
})

authClose?.addEventListener('click', () => setModalOpen(false))
authBackdrop?.addEventListener('click', (event) => {
  if (event.target === authBackdrop) {
    setModalOpen(false)
  }
})

authForm?.addEventListener('submit', async (event) => {
  event.preventDefault()
  const formData = new FormData(authForm)
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  setAuthStatus('Signing in...')
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    setAuthStatus(payload.error ?? 'Login failed.', true)
    return
  }
  setAuthStatus('Signed in.')
  await refreshAuthUi()
  const next = url.searchParams.get('next')
  setModalOpen(false)
  authForm.reset()
  if (next) {
    window.location.assign(next)
    return
  }
})

if (url.searchParams.get('login') === '1') {
  setModalOpen(true)
}

void refreshAuthUi()
