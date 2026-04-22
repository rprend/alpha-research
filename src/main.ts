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
const authStatus = document.querySelector<HTMLElement>('[data-auth-status]')
const copyButtons = document.querySelectorAll<HTMLButtonElement>('[data-copy-target]')
const url = new URL(window.location.href)

function setAuthStatus(message: string, isError = false) {
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
  const next = returnUrl.searchParams.get('next')
  if (next) {
    returnUrl.searchParams.delete('next')
  }
  const returnTo = next || `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`
  const destination = new URL('/api/auth/start', window.location.origin)
  destination.searchParams.set('return_to', returnTo)
  window.location.assign(destination.toString())
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
  beginLogin()
})

void refreshAuthUi()

const authError = url.searchParams.get('auth_error')
if (authError) {
  setAuthStatus(authError, true)
}

if (url.searchParams.get('login') === '1') {
  beginLogin()
}

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
