import './style.css'

const chartSeries = [
  { label: 'Feb 15', avg: 72, top: 180, bottom: 28 },
  { label: 'Feb 22', avg: 98, top: 210, bottom: 34 },
  { label: 'Mar 1', avg: 132, top: 280, bottom: 42 },
  { label: 'Mar 8', avg: 228, top: 430, bottom: 76 },
  { label: 'Mar 13', avg: 410, top: 690, bottom: 120 },
]

const testimonials = [
  {
    quote:
      'Having one workspace for branching hypotheses and evidence comparison makes it much easier to move from raw data to a real decision.',
    name: 'Strategy lead',
    company: 'Enterprise operations',
  },
  {
    quote:
      'The useful part is not just speed. It is being able to compare multiple lines of inquiry and keep the reasoning attached to the outcome.',
    name: 'Research director',
    company: 'Investment team',
  },
  {
    quote:
      'alpha-research lets us test far more market and pricing ideas without turning every question into a custom analytics project.',
    name: 'Operator',
    company: 'Growth and product',
  },
]

const faqs = [
  {
    question: 'Is it just retrieval with a nicer interface?',
    answer:
      'No. The platform is built around experiment design, branching research runs, evidence comparison, and exporting decision-ready memos with citations.',
  },
  {
    question: 'What data can it handle?',
    answer:
      'Large datasets: warehouse tables, parquet files, document corpora, internal exports, and mixed research inputs that break spreadsheet workflows.',
  },
  {
    question: 'Can we run it ourselves?',
    answer:
      'Yes. It is designed for self-hosting so data can stay close to your warehouse, lake, or private infrastructure boundary.',
  },
  {
    question: 'What support do you provide?',
    answer:
      'The platform is open source, so teams can inspect and extend it directly. We focus on making the workflow traceable from ingestion through final recommendation.',
  },
]

const workflowRows = [
  ['Market diligence', 'Workflow'],
  ['Pricing strategy research', 'Workflow'],
  ['Vendor evaluation', 'Workflow'],
  ['Policy analysis', 'Workflow'],
  ['Decision memo generation', 'Workflow'],
  ['Competitive intelligence', 'Workflow'],
]

const chartWidth = 576
const chartHeight = 268
const plot = { left: 52, top: 20, right: 24, bottom: 40 }
const maxY = 700
const gridValues = [0, 200, 400, 600]
const innerWidth = chartWidth - plot.left - plot.right
const innerHeight = chartHeight - plot.top - plot.bottom

const pointFor = (value: number, index: number) => {
  const x = plot.left + (index * innerWidth) / (chartSeries.length - 1)
  const y = plot.top + innerHeight - (value / maxY) * innerHeight
  return `${x},${y}`
}

const avgLine = chartSeries.map((item, index) => pointFor(item.avg, index)).join(' ')
const topLine = chartSeries.map((item, index) => pointFor(item.top, index)).join(' ')
const bottomLine = chartSeries.map((item, index) => pointFor(item.bottom, index)).join(' ')

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="landing-page">
    <div class="nav-shell">
      <div class="nav-wrap">
        <div class="topbar">
          <a class="logo-link" href="/" aria-label="alpha-research home">
            <div class="logo-mark">a</div>
          </a>

          <div class="top-links">
            <a class="underlined-link" href="#chart">prices</a>
            <a class="underlined-link" href="https://github.com/rprend/alpha-research" target="_blank" rel="noopener noreferrer">docs</a>
            <a class="underlined-link" href="#faq">contact us</a>
            <a class="underlined-link" href="#about">about</a>

            <div class="auth-links">
              <a class="button-small ghost-button" href="https://github.com/rprend/alpha-research" target="_blank" rel="noopener noreferrer">login</a>
              <a class="button-small primary-small" href="#workflow">sign up</a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="content-shell">
      <div class="content-wrap">
        <div class="hero-block">
          <a class="announcement-card" href="#workflow">
            <p>Large datasets are now queryable in alpha-research. Need to test 100x more hypotheses? <span>Read this</span>.</p>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="2" y="3" width="20" height="7" rx="2"></rect>
              <rect x="2" y="14" width="20" height="7" rx="2"></rect>
              <line x1="6" y1="6.5" x2="6.01" y2="6.5"></line>
              <line x1="6" y1="17.5" x2="6.01" y2="17.5"></line>
            </svg>
          </a>

          <h1>The Alpha Research Company</h1>

          <p class="hero-copy">
            We built an open-source research platform for large datasets. Need decision makers to test 100x
            more hypotheses before they act? You got it. Compare multiple lines of inquiry against the same
            evidence without getting locked into a closed workflow.
          </p>

          <p class="hero-copy">
            Never force research into spreadsheet-scale work. We ingest large datasets, run experiments in
            parallel, and export memos with citations, rankings, and explicit reasoning.
          </p>

          <div class="cta-wrap">
            <a class="hero-button" href="#workflow">
              Test 100x more hypotheses
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m12.75 15 3-3m0 0-3-3m3 3h-7.5"></path>
                <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path>
              </svg>
            </a>
            <p class="cta-note">*Open-source research platform for large datasets.</p>
          </div>
        </div>

        <div class="chart-block" id="chart">
          <h2>Average hypotheses tested per decision cycle</h2>

          <div class="chart-legend">
            <div class="chart-dot"></div>
            <span class="chart-avg">410</span>
            <span class="chart-note">average hypotheses</span>
          </div>

          <div class="chart-frame">
            <svg width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="Hypothesis chart">
              <g>
                ${gridValues
                  .map((value) => {
                    const y = plot.top + innerHeight - (value / maxY) * innerHeight
                    return `
                      <line class="grid-line" x1="${plot.left}" y1="${y}" x2="${chartWidth}" y2="${y}"></line>
                      <text class="axis-y" x="${plot.left - 8}" y="${y + 4}" text-anchor="end">${value}</text>
                    `
                  })
                  .join('')}
                <polyline class="range-line" points="${topLine}"></polyline>
                <polyline class="range-line" points="${bottomLine}"></polyline>
                <polyline class="avg-line" points="${avgLine}"></polyline>
                ${chartSeries
                  .map((item, index) => {
                    const x = plot.left + (index * innerWidth) / (chartSeries.length - 1)
                    return `<text class="axis-x" x="${x}" y="${chartHeight - 10}" text-anchor="middle">${item.label}</text>`
                  })
                  .join('')}
              </g>
            </svg>
          </div>
        </div>

        <div class="cli-block" id="workflow">
          <h2 class="split-heading">
            <span>A simple but powerful CLI</span>
            <a class="button-small ghost-button" href="https://github.com/rprend/alpha-research" target="_blank" rel="noopener noreferrer">
              Read docs
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m12.75 15 3-3m0 0-3-3m3 3h-7.5"></path>
                <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path>
              </svg>
            </a>
          </h2>

          <div class="terminal-outer">
            <div class="terminal-inner">
              <div class="terminal-top">
                <div class="lights">
                  <div class="light red"></div>
                  <div class="light yellow"></div>
                  <div class="light green"></div>
                </div>
                <div class="terminal-path">~/research</div>
              </div>

              <pre><code><span class="comment"># Register the dataset and define a question set</span>
$$ alpha datasets add warehouse.exec.q1
$$ alpha hypotheses create pricing-review --count 128

<span class="comment"># Run parallel branches and compare evidence</span>
$$ alpha runs start --agents 16 --compare confidence,cost,novelty

<span class="comment"># Export a memo with citations and ranked outputs</span>
$$ alpha memos export pricing-review --citations --top 12</code></pre>
            </div>
          </div>
        </div>

        <div class="trust-block">
          <h2>Trusted by operators, strategists and research teams</h2>

          <div class="logo-row">
            <span>operators</span>
            <span>strategy</span>
            <span>research</span>
            <span>investing</span>
            <span>product</span>
          </div>

          ${testimonials
            .map(
              (item) => `
                <div class="quote-card">
                  <div>"${item.quote}"</div>
                  <div class="quote-meta">
                    <div class="quote-avatar"></div>
                    ${item.name}, ${item.company}
                  </div>
                </div>
              `,
            )
            .join('')}
        </div>

        <div class="faq-block" id="faq">
          <h2>FAQ</h2>

          <div class="faq-list">
            ${faqs
              .map(
                (item) => `
                  <div class="faq-row">
                    <h3>
                      <span class="faq-chevron">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M10.75 8.75 14.25 12l-3.5 3.25"></path>
                        </svg>
                      </span>
                      ${item.question}
                    </h3>
                    <p>${item.answer}</p>
                  </div>
                `,
              )
              .join('')}
          </div>
        </div>

        <div class="roles-block">
          <h2 class="split-heading">
            <span>Common workflows</span>
            <a class="button-small ghost-button" href="#about">
              See all
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m12.75 15 3-3m0 0-3-3m3 3h-7.5"></path>
                <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path>
              </svg>
            </a>
          </h2>

          ${workflowRows
            .map(
              ([title, type]) => `
                <div class="role-row">
                  <div class="role-title">${title}</div>
                  <div class="role-line"></div>
                  <div class="role-type">${type}</div>
                </div>
              `,
            )
            .join('')}
        </div>

        <div class="about-block" id="about">
          <h2 class="split-heading">
            <span>Who are we?</span>
            <a class="button-small ghost-button" href="#top">
              Read about AR
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m12.75 15 3-3m0 0-3-3m3 3h-7.5"></path>
                <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path>
              </svg>
            </a>
          </h2>

          <p>
            We built alpha-research for teams whose decisions are expensive and whose data is too large for
            ad hoc analysis. The platform is open-source, self-hostable, and designed to keep methodology
            inspectable from ingestion through final memo.
          </p>
        </div>
      </div>
    </div>

    <footer class="footer">
      <div class="footer-wrap">
        <a class="logo-link" href="/" aria-label="alpha-research home">
          <div class="logo-mark">a</div>
        </a>

        <div class="footer-copy">
          <div class="footer-links">
            <a href="https://github.com/rprend/alpha-research" target="_blank" rel="noopener noreferrer">blog</a>
            <a href="https://github.com/rprend/alpha-research/commits/main" target="_blank" rel="noopener noreferrer">changelog</a>
            <a href="https://github.com/rprend/alpha-research" target="_blank" rel="noopener noreferrer">privacy</a>
            <a href="https://github.com/rprend/alpha-research" target="_blank" rel="noopener noreferrer">terms</a>
          </div>

          <div class="status-row">
            <div class="status-dot"></div>
            <a href="https://alpha-research.pages.dev" target="_blank" rel="noopener noreferrer">all systems normal</a>
          </div>
        </div>

        <div class="footer-meta">
          <div>made with care in research</div>
          <div>© 2026 alpha-research</div>
        </div>
      </div>
    </footer>
  </div>
`
