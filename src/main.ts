import './style.css'

const stats = [
  { value: '100x', label: 'more hypotheses tested', note: 'Compress the full research loop into one reusable run.' },
  { value: 'Open', label: 'source core', note: 'Inspect the stack, self-host it, and extend it without lock-in.' },
  { value: 'Large', label: 'dataset ready', note: 'Designed for warehouses, lakes, and messy operational data.' },
]

const platformLines = [
  ['Dataset-native ingestion', 'Warehouses, parquet, tabular exports, and document corpora in one graph.'],
  ['Experiment orchestration', 'Parallel runs, versioned prompts, and explicit comparison across hypotheses.'],
  ['Evidence-backed outputs', 'Citations, source traces, tables, and memos built for executive review.'],
  ['Self-hosted by default', 'Bring your own infra, keep data residency, and avoid vendor lock-in.'],
]

const principles = [
  {
    title: 'Build conviction, not dashboards',
    body: 'alpha-research is meant for the last mile before a decision. Teams ask a question, run competing hypotheses against the same evidence, and keep a durable record of what actually changed their mind.',
  },
  {
    title: 'Make large data operational',
    body: 'The platform treats big, messy datasets as the raw material for research instead of forcing analysts into spreadsheet-scale workflows. Ingestion, retrieval, and synthesis are all part of the same system.',
  },
  {
    title: 'Keep the stack inspectable',
    body: 'Open-source primitives make the system debuggable. Internal teams can add their own evaluators, routing logic, and review steps without handing research process over to a closed box.',
  },
]

const outcomes = [
  ['New market thesis', 'Compare ten segments before the Monday meeting instead of picking one by intuition.'],
  ['Pricing counterfactual', 'Simulate alternative price moves across historical cohorts and current pipeline signals.'],
  ['Vendor diligence', 'Trace product claims back to source material and flag contradictions before procurement.'],
  ['Decision memo', 'Export a memo with citations, supporting tables, and the exact runs behind the recommendation.'],
]

const faqItems = [
  {
    question: 'Is alpha-research just another RAG layer?',
    answer:
      'No. Retrieval is one primitive in the stack, but the product is centered on experiment design, parallel comparison, evidence scoring, and decision-ready outputs.',
  },
  {
    question: 'Can teams run it on their own infrastructure?',
    answer:
      'Yes. The platform is designed for self-hosting so teams can keep sensitive data close to the warehouse, the lake, or their private cloud boundary.',
  },
  {
    question: 'What does open source mean here?',
    answer:
      'The research platform itself is built around open-source components and extensibility. Teams can inspect the core, add their own logic, and keep control over the workflow that produces decisions.',
  },
  {
    question: 'Who is it for?',
    answer:
      'It is for operators, investors, strategists, and research leads who need to test many more hypotheses without lowering the bar for rigor.',
  },
]

const chartLabels = ['Day 0', 'Day 2', 'Day 4', 'Day 6', 'Day 8', 'Day 10']
const baselineSeries = [5, 6, 6, 7, 8, 8]
const acceleratedSeries = [8, 24, 67, 180, 410, 800]

const chartWidth = 620
const chartHeight = 260
const chartPadding = { top: 18, right: 18, bottom: 34, left: 18 }
const chartInnerWidth = chartWidth - chartPadding.left - chartPadding.right
const chartInnerHeight = chartHeight - chartPadding.top - chartPadding.bottom
const maxValue = 800

const pointFor = (value: number, index: number) => {
  const x = chartPadding.left + (index * chartInnerWidth) / (chartLabels.length - 1)
  const y = chartPadding.top + chartInnerHeight - (value / maxValue) * chartInnerHeight
  return `${x},${y}`
}

const baselinePolyline = baselineSeries.map(pointFor).join(' ')
const acceleratedPolyline = acceleratedSeries.map(pointFor).join(' ')
const baselineFinalPoint = pointFor(baselineSeries[baselineSeries.length - 1], baselineSeries.length - 1)
const acceleratedFinalPoint = pointFor(
  acceleratedSeries[acceleratedSeries.length - 1],
  acceleratedSeries.length - 1,
)

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="topbar reveal" style="--delay: 0.05s">
    <a class="brand" href="#top" aria-label="alpha-research home">
      <span class="brand-mark">a</span>
      <span class="brand-copy">
        <strong>alpha-research</strong>
        <span>Open-source research platform</span>
      </span>
    </a>
    <nav class="nav" aria-label="Primary">
      <a href="#platform">platform</a>
      <a href="#workflow">workflow</a>
      <a href="#faq">faq</a>
      <a class="nav-cta" href="#source">why open</a>
    </nav>
  </header>

  <main>
    <section class="section hero reveal" id="top" style="--delay: 0.12s">
      <a class="announcement" href="#source">Built for large datasets. Open-source core. Decision-ready outputs.</a>
      <h1>Enable decision makers to test 100x more hypotheses.</h1>
      <p class="lead">
        alpha-research is a research platform for teams that need conviction before they move capital,
        policy, product, or strategy.
      </p>
      <p class="body-copy">
        We built an open-source system that ingests large datasets, runs competing lines of inquiry in
        parallel, and turns the result into evidence-backed recommendations.
      </p>
      <div class="actions">
        <a class="button button-primary" href="#workflow">See the research loop</a>
        <a class="button button-secondary" href="#faq">Read the FAQ</a>
      </div>
      <dl class="stats-grid">
        ${stats
          .map(
            (stat) => `
              <div class="stat-card">
                <dt>${stat.value}</dt>
                <dd>
                  <strong>${stat.label}</strong>
                  <span>${stat.note}</span>
                </dd>
              </div>
            `,
          )
          .join('')}
      </dl>
    </section>

    <div class="section-divider" aria-hidden="true"></div>

    <section class="section reveal" style="--delay: 0.2s">
      <div class="section-heading">
        <h2>Hypothesis throughput over a ten-day decision cycle</h2>
        <p>
          Baseline teams spend most of the cycle waiting on extraction, cleanup, and debate. alpha-research
          keeps the question, data, and comparison framework in one place.
        </p>
      </div>
      <div class="chart-card">
        <div class="chart-meta">
          <div class="legend">
            <span class="legend-item">
              <span class="legend-swatch legend-swatch-muted"></span>
              Typical workflow
            </span>
            <span class="legend-item">
              <span class="legend-swatch legend-swatch-accent"></span>
              alpha-research
            </span>
          </div>
          <div class="chart-callout">
            <strong>800</strong>
            <span>ranked and traceable hypotheses by Day 10</span>
          </div>
        </div>
        <svg class="throughput-chart" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="Chart comparing hypothesis throughput between a typical workflow and alpha-research">
          <defs>
            <linearGradient id="alpha-line" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stop-color="rgba(117, 152, 63, 0.55)"></stop>
              <stop offset="100%" stop-color="#365221"></stop>
            </linearGradient>
          </defs>
          ${[0, 200, 400, 600, 800]
            .map((value) => {
              const y = chartPadding.top + chartInnerHeight - (value / maxValue) * chartInnerHeight
              return `
                <line class="grid-line" x1="${chartPadding.left}" y1="${y}" x2="${chartWidth - chartPadding.right}" y2="${y}"></line>
                <text class="grid-label" x="${chartPadding.left}" y="${y - 6}">${value}</text>
              `
            })
            .join('')}
          <polyline class="series-muted" points="${baselinePolyline}"></polyline>
          <polyline class="series-accent" points="${acceleratedPolyline}"></polyline>
          <circle class="series-point-muted" cx="${baselineFinalPoint.split(',')[0]}" cy="${baselineFinalPoint.split(',')[1]}" r="4"></circle>
          <circle class="series-point-accent" cx="${acceleratedFinalPoint.split(',')[0]}" cy="${acceleratedFinalPoint.split(',')[1]}" r="5"></circle>
          ${chartLabels
            .map((label, index) => {
              const [x] = pointFor(0, index).split(',')
              return `<text class="axis-label" x="${x}" y="${chartHeight - 8}" text-anchor="middle">${label}</text>`
            })
            .join('')}
        </svg>
      </div>
    </section>

    <div class="section-divider" aria-hidden="true"></div>

    <section class="section workflow reveal" id="workflow" style="--delay: 0.28s">
      <div class="section-heading">
        <h2>A simple but durable research loop</h2>
        <p>
          The goal is not a prettier notebook. The goal is a repeatable operating system for research:
          ingest, branch, compare, decide.
        </p>
      </div>
      <div class="terminal-card">
        <div class="terminal-bar">
          <span class="terminal-dots" aria-hidden="true">
            <span></span><span></span><span></span>
          </span>
          <span class="terminal-path">~/alpha-research</span>
        </div>
        <pre><code><span class="comment"># register a large dataset and define a question set</span>
$ alpha ingest s3://warehouse/market-intel/2026-q1
$ alpha design --brief pricing-sensitivity --hypotheses 120

<span class="comment"># run competing research branches against the same evidence</span>
$ alpha run --agents 16 --compare confidence,cost,novelty

<span class="comment"># export a memo with citations and the winning recommendation</span>
$ alpha export memo --with-sources --top 12</code></pre>
      </div>
    </section>

    <div class="section-divider" aria-hidden="true"></div>

    <section class="section reveal" id="platform" style="--delay: 0.36s">
      <div class="section-heading">
        <h2>What ships with the platform</h2>
        <p>
          Every part of the stack is designed to reduce research latency without hiding how the answer was
          produced.
        </p>
      </div>
      <div class="rail-list">
        ${platformLines
          .map(
            ([title, body]) => `
              <article class="rail-item">
                <h3>${title}</h3>
                <div class="rail-rule" aria-hidden="true"></div>
                <p>${body}</p>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>

    <div class="section-divider" aria-hidden="true"></div>

    <section class="section reveal" id="source" style="--delay: 0.44s">
      <div class="section-heading">
        <h2>Why the stack stays open</h2>
        <p>
          Decision systems are only useful if teams can trust, inspect, and adapt them. Closed research
          tooling turns methodology into guesswork.
        </p>
      </div>
      <div class="principles-grid">
        ${principles
          .map(
            (item) => `
              <article class="principle-card">
                <h3>${item.title}</h3>
                <p>${item.body}</p>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>

    <div class="section-divider" aria-hidden="true"></div>

    <section class="section reveal" style="--delay: 0.52s">
      <div class="section-heading">
        <h2>What changes when teams can test 100x more ideas</h2>
        <p>
          More hypotheses only matter when they end in clearer action. The platform is built to make the
          output legible to decision makers, not only to researchers.
        </p>
      </div>
      <div class="outcomes-grid">
        ${outcomes
          .map(
            ([title, body]) => `
              <article class="outcome-card">
                <h3>${title}</h3>
                <p>${body}</p>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>

    <div class="section-divider" aria-hidden="true"></div>

    <section class="section reveal" id="faq" style="--delay: 0.6s">
      <div class="section-heading">
        <h2>FAQ</h2>
        <p>
          The product is opinionated about rigor, scale, and traceability. These are the questions teams
          ask most often when they evaluate the system.
        </p>
      </div>
      <div class="faq-list">
        ${faqItems
          .map(
            (item) => `
              <details class="faq-item">
                <summary>${item.question}</summary>
                <p>${item.answer}</p>
              </details>
            `,
          )
          .join('')}
      </div>
    </section>
  </main>

  <footer class="footer reveal" style="--delay: 0.68s">
    <p>
      alpha-research exists to help serious teams move from raw data to defensible action faster.
    </p>
    <div class="footer-links">
      <a href="#platform">platform</a>
      <a href="#workflow">workflow</a>
      <a href="#faq">faq</a>
    </div>
  </footer>
`
