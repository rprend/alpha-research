import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const SOURCE_DIR = path.join(ROOT, 'curriculum', 'daily')
const CURRICULUM_SOURCE_DIR = path.join(ROOT, 'curriculum')
const CURRICULUM_OUTPUT_DIR = path.join(ROOT, 'public', 'docs-site', 'curriculum')
const OUTPUT_DIR = path.join(ROOT, 'public', 'docs-site', 'curriculum', 'daily')
const GUIDE_FILES = [
  ['README.md', 'index.html', 'AI Research Curriculum'],
  ['00-foundations.md', '00-foundations.html', 'Foundations'],
  ['01-the-transformer.md', '01-the-transformer.html', 'The Transformer'],
  ['02-training-at-scale.md', '02-training-at-scale.html', 'Training at scale'],
  ['03-post-training.md', '03-post-training.html', 'Post-training'],
  ['04-inference-and-evals.md', '04-inference-and-evals.html', 'Inference and evals'],
  ['05-interpretability.md', '05-interpretability.html', 'Interpretability'],
  ['06-research-practice.md', '06-research-practice.html', 'Research practice'],
  ['paper-ladder.md', 'paper-ladder.html', 'Paper ladder'],
]
const FILES = [
  ['README.md', 'index.html', 'Daily packets'],
  ['phase-0.md', 'phase-0.html', 'Phase 0'],
  ['phase-1.md', 'phase-1.html', 'Phase 1'],
  ['phase-2.md', 'phase-2.html', 'Phase 2'],
  ['phase-3.md', 'phase-3.html', 'Phase 3'],
  ['phase-4.md', 'phase-4.html', 'Phase 4'],
  ['phase-5.md', 'phase-5.html', 'Phase 5'],
  ['phase-6.md', 'phase-6.html', 'Phase 6'],
]

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function localHref(href, currentKind) {
  if (/^https?:\/\//.test(href) || href.startsWith('#')) return href
  const clean = href.replace(/^\.\//, '')
  if (clean === '../README.md') return '/curriculum'
  if (clean.startsWith('../')) return clean.replace('../', '/curriculum/').replace(/\.md$/, '')
  if (currentKind === 'guide') {
    if (clean.startsWith('daily/')) return `/curriculum/${clean.replace(/\.md$/, '')}`.replace('/README', '')
    return `/curriculum/${clean.replace(/\.md$/, '')}`.replace('/README', '')
  }
  return `/curriculum/daily/${clean.replace(/\.md$/, '')}`.replace('/README', '')
}

function inlineMarkdown(value, currentKind) {
  let html = escapeHtml(value)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const target = escapeHtml(localHref(href, currentKind))
    return `<a href="${target}">${label}</a>`
  })
  return html
}

function renderMarkdown(markdown, currentKind) {
  const lines = markdown.split(/\r?\n/)
  const output = []
  let paragraph = []
  let list = null
  let table = []

  function flushParagraph() {
    if (!paragraph.length) return
    output.push(`<p>${inlineMarkdown(paragraph.join(' '), currentKind)}</p>`)
    paragraph = []
  }

  function closeList() {
    if (!list) return
    output.push(`</${list}>`)
    list = null
  }

  function flushTable() {
    if (!table.length) return
    const rows = table
      .filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line))
      .map((line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()))
    if (rows.length) {
      const [head, ...body] = rows
      output.push('<div class="table-scroll"><table>')
      output.push(`<thead><tr>${head.map((cell) => `<th>${inlineMarkdown(cell, currentKind)}</th>`).join('')}</tr></thead>`)
      if (body.length) {
        output.push('<tbody>')
        for (const row of body) {
          output.push(`<tr>${row.map((cell) => `<td>${inlineMarkdown(cell, currentKind)}</td>`).join('')}</tr>`)
        }
        output.push('</tbody>')
      }
      output.push('</table></div>')
    }
    table = []
  }

  function openList(tag) {
    if (list === tag) return
    closeList()
    output.push(`<${tag}>`)
    list = tag
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line.trim()) {
      flushParagraph()
      closeList()
      flushTable()
      continue
    }

    if (/^\|.+\|$/.test(line.trim())) {
      flushParagraph()
      closeList()
      table.push(line.trim())
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      closeList()
      flushTable()
      const level = heading[1].length
      const text = inlineMarkdown(heading[2], currentKind)
      output.push(`<h${level} id="${slugify(heading[2])}">${text}</h${level}>`)
      continue
    }

    if (line === '---') {
      flushParagraph()
      closeList()
      flushTable()
      output.push('<hr>')
      continue
    }

    const quote = line.match(/^>\s?(.+)$/)
    if (quote) {
      flushParagraph()
      closeList()
      flushTable()
      output.push(`<blockquote>${inlineMarkdown(quote[1], currentKind)}</blockquote>`)
      continue
    }

    const checkbox = line.match(/^- \[( |x)\] (.+)$/)
    if (checkbox) {
      flushParagraph()
      flushTable()
      openList('ul')
      const checked = checkbox[1] === 'x' ? ' checked' : ''
      output.push(`<li class="task"><input type="checkbox" disabled${checked}> <span>${inlineMarkdown(checkbox[2], currentKind)}</span></li>`)
      continue
    }

    const bullet = line.match(/^- (.+)$/)
    if (bullet) {
      flushParagraph()
      flushTable()
      openList('ul')
      output.push(`<li>${inlineMarkdown(bullet[1], currentKind)}</li>`)
      continue
    }

    const numbered = line.match(/^\d+\. (.+)$/)
    if (numbered) {
      flushParagraph()
      flushTable()
      openList('ol')
      output.push(`<li>${inlineMarkdown(numbered[1], currentKind)}</li>`)
      continue
    }

    paragraph.push(line.trim())
  }

  flushParagraph()
  closeList()
  flushTable()
  return output.join('\n')
}

function pageShell({ title, body, currentFile, currentKind }) {
  const navItems = [
    ['guide', 'README.md', 'index.html', 'Guide'],
    ...FILES.map((item) => ['daily', ...item]),
    ['guide', 'paper-ladder.md', 'paper-ladder.html', 'Papers'],
  ]
  const nav = navItems.map(([kind, source, output, label]) => {
    const isDaily = kind === 'daily'
    const href = output === 'index.html' ? '/curriculum/daily' : `/curriculum/daily/${output.replace(/\.html$/, '')}`
    const guideHref = output === 'index.html' ? '/curriculum' : `/curriculum/${output.replace(/\.html$/, '')}`
    const current = source === currentFile && kind === currentKind ? ' aria-current="page"' : ''
    return `<a href="${isDaily ? href : guideHref}"${current}>${label}</a>`
  }).join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - Alpha Research Curriculum</title>
  <style>
    :root { color-scheme: light; --ink:#171717; --muted:#666; --line:#e5e5e5; --paper:#fff; --soft:#f7f7f5; --accent:#0f766e; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:var(--paper); line-height:1.62; }
    header { border-bottom:1px solid var(--line); background:rgba(255,255,255,.96); position:sticky; top:0; z-index:2; }
    .bar { max-width:1040px; margin:0 auto; padding:14px 18px 10px; }
    .brand { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:10px; }
    .brand a { color:var(--ink); text-decoration:none; font-weight:750; }
    .brand span { color:var(--muted); font-size:13px; }
    nav { display:flex; gap:8px; overflow-x:auto; padding-bottom:6px; scrollbar-width:none; }
    nav a { flex:0 0 auto; border:1px solid var(--line); color:#333; text-decoration:none; border-radius:999px; padding:7px 11px; font-size:14px; background:#fff; }
    nav a[aria-current="page"] { border-color:var(--accent); color:#064e47; background:#ecfdf9; }
    main { max-width:820px; margin:0 auto; padding:28px 18px 72px; }
    h1 { font-size:clamp(31px, 7vw, 52px); line-height:1.04; letter-spacing:0; margin:10px 0 18px; }
    h2 { font-size:clamp(24px, 5vw, 34px); line-height:1.14; letter-spacing:0; margin:44px 0 14px; padding-top:10px; border-top:1px solid var(--line); }
    h3 { font-size:22px; line-height:1.22; letter-spacing:0; margin:34px 0 10px; }
    h4 { font-size:18px; margin:24px 0 8px; }
    p, li { font-size:17px; }
    p { margin:0 0 18px; }
    ul, ol { padding-left:23px; margin:0 0 22px; }
    li { margin:8px 0; }
    a { color:#0f766e; text-underline-offset:3px; }
    blockquote { margin:24px 0; padding:13px 16px; border-left:4px solid var(--accent); background:#f1fbf8; border-radius:0 8px 8px 0; }
    blockquote p { margin:0; }
    .table-scroll { overflow-x:auto; margin:22px 0 28px; border:1px solid var(--line); border-radius:8px; }
    table { width:100%; border-collapse:collapse; min-width:640px; font-size:15px; line-height:1.45; }
    th, td { text-align:left; vertical-align:top; padding:10px 12px; border-bottom:1px solid var(--line); }
    th { background:var(--soft); font-weight:750; }
    tr:last-child td { border-bottom:0; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:.92em; background:var(--soft); border:1px solid var(--line); border-radius:6px; padding:1px 5px; overflow-wrap:anywhere; }
    hr { border:0; border-top:1px solid var(--line); margin:30px 0; }
    .task { list-style:none; margin-left:-23px; display:flex; align-items:flex-start; gap:9px; }
    .task input { margin-top:7px; width:16px; height:16px; flex:0 0 auto; }
    @media (max-width: 560px) {
      .bar { padding-inline:14px; }
      main { padding:22px 16px 56px; }
      p, li { font-size:16px; }
      nav a { font-size:13px; padding:7px 10px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="bar">
      <div class="brand"><a href="/curriculum/daily">AI Research Curriculum</a><span>133 daily packets</span></div>
      <nav aria-label="Curriculum phases">${nav}</nav>
    </div>
  </header>
  <main>${body}</main>
</body>
</html>
`
}

await mkdir(CURRICULUM_OUTPUT_DIR, { recursive: true })
await mkdir(OUTPUT_DIR, { recursive: true })

for (const [source, output, title] of GUIDE_FILES) {
  const markdown = await readFile(path.join(CURRICULUM_SOURCE_DIR, source), 'utf8')
  const html = pageShell({
    title,
    body: renderMarkdown(markdown, 'guide'),
    currentFile: source,
    currentKind: 'guide',
  })
  await writeFile(path.join(CURRICULUM_OUTPUT_DIR, output), html)
}

for (const [source, output, title] of FILES) {
  const markdown = await readFile(path.join(SOURCE_DIR, source), 'utf8')
  const html = pageShell({
    title,
    body: renderMarkdown(markdown, 'daily'),
    currentFile: source,
    currentKind: 'daily',
  })
  await writeFile(path.join(OUTPUT_DIR, output), html)
}
