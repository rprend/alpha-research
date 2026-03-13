import './style.css'

const chartData = [
  { label: 'Feb 1', avg: 18, top: 28, bottom: 10 },
  { label: 'Feb 8', avg: 26, top: 42, bottom: 14 },
  { label: 'Feb 15', avg: 44, top: 72, bottom: 24 },
  { label: 'Feb 22', avg: 78, top: 126, bottom: 40 },
  { label: 'Mar 1', avg: 132, top: 205, bottom: 74 },
  { label: 'Mar 8', avg: 238, top: 372, bottom: 128 },
  { label: 'Mar 13', avg: 410, top: 655, bottom: 210 },
]

const workflowCards = [
  {
    quote: 'Market diligence in hours instead of weeks.',
    byline: 'Example workflow',
    detail: 'Strategy team',
  },
  {
    quote: 'Compare pricing hypotheses without rebuilding the data pipeline.',
    byline: 'Example workflow',
    detail: 'Revenue operations',
  },
  {
    quote: 'Trace every recommendation back to source evidence.',
    byline: 'Example workflow',
    detail: 'Investment research',
  },
]

const faqItems = [
  {
    question: 'Is it just retrieval with a nicer interface?',
    answer:
      'No. Retrieval is one primitive, but the platform is built around experiment design, branching research paths, side-by-side comparison, and decision-ready exports.',
  },
  {
    question: 'What kind of data can it handle?',
    answer:
      'Large datasets: warehouse tables, parquet files, document corpora, exports from internal systems, and mixed research inputs that are too large for spreadsheet workflows.',
  },
  {
    question: 'Is it open source?',
    answer:
      'Yes. We built alpha-research as an open-source research platform so teams can inspect the workflow, extend it, and keep their methodology under their own control.',
  },
  {
    question: 'Can we run it on our own infrastructure?',
    answer:
      'Yes. The platform is designed for self-hosting so data can stay close to the warehouse, lake, or private cloud boundary.',
  },
  {
    question: 'Who is this for?',
    answer:
      'Decision makers and the teams that support them: operators, strategists, investors, researchers, and product leaders who need more rigorous hypothesis testing before they act.',
  },
]

const workflowRows = [
  ['Market diligence', 'Workflow'],
  ['Pricing experiments', 'Workflow'],
  ['Vendor evaluation', 'Workflow'],
  ['Policy analysis', 'Workflow'],
  ['Decision memos', 'Workflow'],
  ['Competitive research', 'Workflow'],
]

const chartWidth = 560
const chartHeight = 250
const chartPadding = { top: 18, right: 8, bottom: 36, left: 42 }
const plotWidth = chartWidth - chartPadding.left - chartPadding.right
const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom
const maxValue = 700
const gridValues = [0, 200, 400, 600]

const chartPoint = (value: number, index: number) => {
  const x = chartPadding.left + (index * plotWidth) / (chartData.length - 1)
  const y = chartPadding.top + plotHeight - (value / maxValue) * plotHeight
  return `${x},${y}`
}

const avgLine = chartData.map((point, index) => chartPoint(point.avg, index)).join(' ')
const topLine = chartData.map((point, index) => chartPoint(point.top, index)).join(' ')
const bottomLine = chartData.map((point, index) => chartPoint(point.bottom, index)).join(' ')
const lastPoint = chartData[chartData.length - 1]
const lastCoords = chartPoint(lastPoint.avg, chartData.length - 1).split(',')

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="site-shell">
    <header class="topbar">
      <a class="brand" href="#top" aria-label="alpha-research home">
        <span class="brand-mark">a</span>
      </a>
      <div class="top-links">
        <a href="#platform">platform</a>
        <a href="#workflow">workflow</a>
        <a href="#faq">faq</a>
        <a href="#about">about</a>
        <a class="top-button" href="#overview">overview</a>
      </div>
    </header>
  </div>

  <main class="page">
    <div class="page-inner">
      <section class="hero" id="top">
        <a class="announcement" href="#about">
          Large datasets, parallel runs, and citation-backed outputs. Need 100x more hypotheses per cycle? Read this.
          <span aria-hidden="true">↗</span>
        </a>

        <h1>The Alpha Research Company</h1>

        <p>
          We built an open-source research platform for large datasets. Need decision makers to test 100x
          more hypotheses before they act? You got it. Compare multiple lines of inquiry against the same
          evidence without closing the stack.
        </p>

        <p>
          Never force research into spreadsheet-scale workflows. We ingest large datasets, run experiments
          in parallel, and export memos with citations, rankings, and explicit reasoning.
        </p>

        <div class="hero-actions">
          <a class="primary-button" href="#workflow">
            Test 100x more hypotheses
            <span aria-hidden="true">→</span>
          </a>
          <p class="button-note">*Open-source research platform for large datasets.</p>
        </div>
      </section>

      <section class="chart-section" id="overview">
        <h2>Average hypotheses tested per decision cycle</h2>

        <div class="chart-legend">
          <div class="legend-item">
            <span class="legend-dot"></span>
            <span>410 average validated hypotheses per cycle</span>
          </div>
        </div>

        <div class="chart-wrap">
          <svg class="chart" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="Average hypotheses tested per decision cycle">
            ${gridValues
              .map((value) => {
                const y = chartPadding.top + plotHeight - (value / maxValue) * plotHeight
                return `
                  <line class="chart-grid" x1="${chartPadding.left}" y1="${y}" x2="${chartWidth - chartPadding.right}" y2="${y}"></line>
                  <text class="chart-y-label" x="${chartPadding.left - 10}" y="${y + 4}" text-anchor="end">${value}</text>
                `
              })
              .join('')}
            <polyline class="chart-range" points="${topLine}"></polyline>
            <polyline class="chart-range" points="${bottomLine}"></polyline>
            <polyline class="chart-average" points="${avgLine}"></polyline>
            <circle class="chart-point" cx="${lastCoords[0]}" cy="${lastCoords[1]}" r="4"></circle>
            ${chartData
              .map((point, index) => {
                const x = chartPadding.left + (index * plotWidth) / (chartData.length - 1)
                return `<text class="chart-x-label" x="${x}" y="${chartHeight - 10}" text-anchor="middle">${point.label}</text>`
              })
              .join('')}
          </svg>
        </div>
      </section>

      <section class="cli-section" id="workflow">
        <div class="section-header">
          <h2>A simple but powerful CLI</h2>
          <a class="small-button" href="#platform">Read flow</a>
        </div>

        <div class="terminal">
          <div class="terminal-bar">
            <div class="terminal-lights" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div class="terminal-path">~/decision-research</div>
          </div>

          <pre><code><span class="comment"># Define the question set and register the dataset</span>
$$ alpha datasets add warehouse.exec.q1
$$ alpha hypotheses create pricing-diligence --count 128

<span class="comment"># Run parallel branches and compare outcomes</span>
$$ alpha runs start --agents 16 --compare confidence,novelty,cost

<span class="comment"># Export a memo with sources and ranked recommendations</span>
$$ alpha memos export pricing-diligence --citations --top 12</code></pre>
        </div>
      </section>

      <section class="trust-section" id="platform">
        <h2>Built for strategy teams, operators and investors</h2>

        <div class="caps-row" aria-label="Team types">
          <span>strategy</span>
          <span>product</span>
          <span>ops</span>
          <span>investing</span>
          <span>research</span>
        </div>

        ${workflowCards
          .map(
            (card) => `
              <article class="story-card">
                <p class="story-quote">"${card.quote}"</p>
                <div class="story-meta">
                  <span class="story-avatar" aria-hidden="true"></span>
                  <span>${card.byline}, ${card.detail}</span>
                </div>
              </article>
            `,
          )
          .join('')}
      </section>

      <section class="faq-section" id="faq">
        <h2>FAQ</h2>

        <div class="faq-list">
          ${faqItems
            .map(
              (item) => `
                <article class="faq-item">
                  <h3>${item.question}</h3>
                  <p>${item.answer}</p>
                </article>
              `,
            )
            .join('')}
        </div>
      </section>

      <section class="roles-section">
        <div class="section-header">
          <h2>Common workflows</h2>
          <a class="small-button" href="#about">See all</a>
        </div>

        <div class="role-list">
          ${workflowRows
            .map(
              ([title, type]) => `
                <div class="role-row">
                  <div class="role-title">${title}</div>
                  <div class="role-rule" aria-hidden="true"></div>
                  <div class="role-type">${type}</div>
                </div>
              `,
            )
            .join('')}
        </div>
      </section>

      <section class="about-section" id="about">
        <div class="section-header">
          <h2>Who are we?</h2>
          <a class="small-button" href="#top">Read about AR</a>
        </div>

        <p>
          We built alpha-research for teams whose decisions are expensive and whose data is too large for
          ad hoc research. The platform is open-source, self-hostable, and designed to keep methodology
          inspectable from ingestion through final memo.
        </p>
      </section>
    </div>
  </main>

  <footer class="footer">
    <div class="footer-inner">
      <a class="brand footer-brand" href="#top" aria-label="alpha-research home">
        <span class="brand-mark">a</span>
      </a>
      <div class="footer-copy">
        <span>We enable decision makers to test 100x more hypotheses.</span>
        <div class="footer-links">
          <a href="#platform">platform</a>
          <a href="#workflow">workflow</a>
          <a href="#faq">faq</a>
        </div>
      </div>
    </div>
  </footer>
`
