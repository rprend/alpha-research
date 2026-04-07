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

const faqItems = [
  {
    question: 'What does Alpha Research do?',
    answer:
      'Alpha Research builds swarm research agents for large datasets. The goal is to help teams find primary sources and answer research questions much faster than a manual workflow.',
  },
  {
    question: 'What kind of data is it for?',
    answer:
      'Large datasets: archives, public-domain corpora, structured exports, research collections, and other datasets that are too large to work through manually.',
  },
  {
    question: 'What is alpha-book.org?',
    answer:
      'alpha-book.org is a mirror of 75,000 public domain books that is indexed and searchable. It is linked on this page because it is a concrete example of the kind of large corpus Alpha Research can help explore.',
  },
  {
    question: 'Is Alpha Research open source?',
    answer:
      'Yes. Alpha Research is presented here as an open-source research system for working with large datasets and source-heavy corpora.',
  },
]

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="landing-page">
    <div class="nav-shell">
      <div class="page-wrap nav-wrap">
        <div class="topbar">
          <a class="logo-link" href="/" aria-label="Alpha Research home">
            <img
              class="logo-wordmark"
              src="/alpha-research-wordmark.png"
              alt="Alpha Research logo"
            />
          </a>

          <div class="top-links">
            <a class="underlined-link" href="#powering">powering</a>
            <a class="underlined-link" href="#faq">faq</a>
            <a class="underlined-link" href="#about">about</a>
            <a class="button-small ghost-button" href="/blog/">blog</a>
          </div>
        </div>
      </div>
    </div>

    <div class="content-shell">
      <div class="page-wrap content-wrap">
        <div class="hero-block">
          <div class="backed-by">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/b/b2/Y_Combinator_logo.svg"
              alt="Y Combinator logo"
              class="yc-logo"
            />
            <span>Backed by YCombinator</span>
          </div>

          <h1>Alpha Research</h1>

          <p class="hero-lede">
            Open source knowledge bases for agents. We help agents work like knowledge workers and knowledge workers work faster. Need to find evidence of different types of humor in 19th century literature? Search all the books. Need to test an economics hypothesis against Census, BLS, NBER, etc data? Run that.
          </p>

          <div class="hero-links">
            <a
              class="hero-button"
              href="https://cal.com/ryan-prendergast-qsp5cw/30min"
              data-cal-link="ryan-prendergast-qsp5cw/30min"
              data-cal-namespace="30min"
              data-cal-config='{"layout":"month_view","useSlotsViewOnSmallScreen":"true"}'
            >
              Want a custom integration? Book a call
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m12.75 15 3-3m0 0-3-3m3 3h-7.5"></path>
                <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path>
              </svg>
            </a>
          </div>
        </div>

        <div class="powering-block" id="powering">
          <h2 class="split-heading">
            <span>Powering</span>
          </h2>

          <div class="powering-list">
            <a class="list-row" href="https://alpha-book.org" target="_blank" rel="noopener noreferrer">
              <div class="list-row-top">
                <span class="list-row-title">Alpha Book</span>
                <span class="list-row-meta">75,000 public domain books</span>
              </div>
              <span class="list-row-subline">
                Mirror of Project Gutenberg with 75,000 public domain books and primary sources.
                Useful for literary research.
              </span>
            </a>

            <a class="list-row" href="https://scenewiki.net" target="_blank" rel="noopener noreferrer">
              <div class="list-row-top">
                <span class="list-row-title">Scene Wiki</span>
              </div>
              <span class="list-row-subline">
                Scrape and label an online community and build a wiki for it.
              </span>
            </a>

            <div class="list-row list-row-static">
              <div class="list-row-top">
                <span class="list-row-title">AlphaEcon</span>
                <span class="list-row-meta">coming soon</span>
              </div>
              <span class="list-row-subline">
                Agentic search and test over U.S. Census Bureau, Fannie Mae, BLS, NBER.
              </span>
            </div>
          </div>
        </div>

        <div class="quote-block" id="quote">
          <h2>Quote</h2>

          <article class="tweet-card">
            <div class="tweet-card-header">
              <div class="tweet-avatar" aria-hidden="true">AK</div>
              <div class="tweet-meta">
                <span class="tweet-author">Andrej Karpathy</span>
                <a
                  class="tweet-handle"
                  href="https://x.com/karpathy/status/2039805659525644595"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @karpathy
                </a>
              </div>
            </div>

            <div class="tweet-body">
              <p class="tweet-title">LLM Knowledge Bases</p>
              <p>
                Something I'm finding very useful recently: using LLMs to build personal
                knowledge bases for various topics of research interest. In this way, a
                large fraction of my recent token throughput is going less into manipulating
                code, and more into manipulating knowledge (stored as markdown and images).
              </p>
            </div>
          </article>
        </div>

        <div class="about-block" id="about">
          <h2>When to use Alpha Research</h2>
          <ol class="about-list">
            <li>
              <span class="about-list-title">Search.</span> Looking for evidence? We compile
              and index public plaintext and image datasets for you to access.
            </li>
            <li>
              <span class="about-list-title">Hypothesis testing.</span> Suppose you're a
              historian. You have an idea. Suppose you're an economist. You might have an
              idea that.
            </li>
            <li>
              <span class="about-list-title">Agentic knowledge workers.</span>
            </li>
            <li>
              <span class="about-list-title">Fandom, wikis.</span> Online communities have
              years of canon. Higher quality engagement and helps onboard new members to your
              community.
            </li>
            <li>
              <span class="about-list-title">Your own knowledge base.</span> Alpha Search is
              open source. We are proud to support research institutes, museums, presidential
              libraries, historical societies, and enterprise.
            </li>
          </ol>
        </div>

        <div class="faq-block" id="faq">
          <h2>FAQ</h2>

          <div class="faq-list">
            ${faqItems
              .map(
                (item) => `
                  <details class="faq-item">
                    <summary>
                      <span class="faq-summary-copy">${item.question}</span>
                      <span class="faq-summary-icon" aria-hidden="true">+</span>
                    </summary>
                    <p>${item.answer}</p>
                  </details>
                `,
              )
              .join('')}
          </div>
        </div>
      </div>
    </div>

    <footer class="footer">
      <div class="page-wrap footer-wrap">
        <a class="logo-link" href="/" aria-label="Alpha Research home">
          <img
            class="logo-mark"
            src="/newalpharesearchlogo/apple-touch-icon.png"
            alt="Alpha Research logo"
          />
        </a>

        <div class="footer-copy">
          <div class="footer-links">
            <a href="/blog/">blog</a>
            <a href="/privacy/">privacy</a>
            <a href="/terms/">terms</a>
          </div>
        </div>

        <div class="footer-meta">
          <div>© 2026 Alpha Research</div>
        </div>
      </div>
    </footer>
  </div>
`

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
