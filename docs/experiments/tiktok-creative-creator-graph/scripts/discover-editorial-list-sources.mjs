import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const configDir = join(experimentDir, 'config')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')
const sourceConfigPath = join(configDir, 'editorial-list-sources.json')
const defaultIndexUrl = 'https://creators.feedspot.com/recent_changes_creators/'

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const indexUrl = String(args.get('--index-url') ?? defaultIndexUrl)
const maxCandidates = Number(args.get('--max-candidates') ?? 100)
const minScore = Number(args.get('--min-score') ?? 20)
const dryRun = args.has('--dry-run')

const labelRules = [
  ['vfx_animation', /\b(animation|anime|animator|digital art|illustrat|visual|vfx|3d|motion|comic|manga|character)\b/i],
  ['creative_technologist', /\b(ai|technology|tech|gaming|mobile gaming|game|vr|virtual|software|lego|chess|stem|robot|music technology)\b/i],
  ['screenwriter', /\b(book|fiction|author|writer|writing|novel|romance|thriller|crime|literary|story|children|middle grade)\b/i],
  ['actor_performer', /\b(actor|actress|performer|dance|dancer|music|singer|classical music|pop music|jazz|latin music|entertainment)\b/i],
  ['film_educator', /\b(review|education|teacher|learn|tutorial|analysis|explained|book review|movie review)\b/i],
  ['sketch_comedian', /\b(comedy|comedian|humor|funny|sketch|improv|entertainment)\b/i],
  ['filmmaker', /\b(movie|film|horror|cinema|travel|aviation|drone|video|documentary)\b/i],
  ['cinematographer', /\b(photography|camera|drone|aerial|travel|visual)\b/i],
  ['behind_the_scenes_creator', /\b(lego|craft|maker|build|process|contractor|production)\b/i],
]

const exclusionRules = [
  /\bonlyfans\b/i,
  /\badult\b/i,
  /\bbeauty\b/i,
  /\bfamily\b/i,
  /\bmom\b/i,
  /\bfitness\b/i,
  /\bhealth\b/i,
  /\bdiet\b/i,
  /\bpaleo\b/i,
  /\bchiropractic\b/i,
  /\bhair\b/i,
  /\bgardening\b/i,
  /\bairbnb\b/i,
  /\bvrbo\b/i,
  /\bscuba\b/i,
  /\bbeach\b/i,
  /\btravel\b/i,
  /\brunning\b/i,
  /\btrail\b/i,
  /\bfood\b/i,
  /\bfashion\b/i,
  /\bautomotive\b/i,
  /\bboard game\b/i,
  /\bchess\b/i,
  /\bcontractor\b/i,
  /\bcraft beer\b/i,
]

const bonusRules = [
  [25, /\b(movie|film|horror|cinema|comedy|comedian|animation|digital art|photography|ai|technology)\b/i],
  [18, /\b(book|fiction|author|writer|illustrated|children|anime|music|dance|gaming|lego)\b/i],
  [12, /\b(top\s+\d+)/i],
]

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''))
}

function writeCsv(path, rows) {
  if (!rows.length) {
    writeFileSync(path, '')
    return
  }
  const headers = Object.keys(rows[0])
  const escape = (value) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  writeFileSync(path, `${headers.join(',')}\n${rows.map((row) => headers.map((header) => escape(row[header])).join(',')).join('\n')}\n`)
}

function decodeEntities(value) {
  return String(value ?? '')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function stripTags(value) {
  return decodeEntities(String(value ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function slugFromUrl(url) {
  return String(url).match(/creators\.feedspot\.com\/([^/?#]+)\//i)?.[1] ?? ''
}

function titleCase(value) {
  return String(value ?? '')
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

function idForSlug(slug) {
  return `feedspot_${slug.replace(/_?(?:tiktok_)?(?:influencers|creators)$/i, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase()}_tiktok_2026`
}

function labelFor(title, slug) {
  const text = `${title} ${slug}`.toLowerCase()
  for (const [label, pattern] of labelRules) {
    if (pattern.test(text)) return label
  }
  return ''
}

function fallbackLabelFor(label) {
  return {
    vfx_animation: 'creative_technologist',
    creative_technologist: 'film_educator',
    screenwriter: 'film_educator',
    actor_performer: 'behind_the_scenes_creator',
    film_educator: 'filmmaker',
    sketch_comedian: 'standup_comedian',
    filmmaker: 'film_educator',
    cinematographer: 'filmmaker',
    behind_the_scenes_creator: 'vfx_animation',
  }[label] ?? label
}

function scoreFor(title, slug, label) {
  const text = `${title} ${slug}`
  if (!label) return 0
  if (exclusionRules.some((pattern) => pattern.test(text))) return 0
  let score = 10
  for (const [bonus, pattern] of bonusRules) {
    if (pattern.test(text)) score += bonus
  }
  if (/creators/i.test(title)) score += 5
  if (/influencers/i.test(title)) score += 2
  return score
}

function extractCandidateLinks(html) {
  const rows = []
  const seen = new Set()
  const linkPattern = /<a\s+[^>]*href="(https:\/\/creators\.feedspot\.com\/[^"?/#]+\/)(?:\?[^"]*)?"[^>]*>([\s\S]*?)<\/a>/gi
  for (const match of html.matchAll(linkPattern)) {
    const url = match[1]
    const title = stripTags(match[2])
    if (!/TikTok (?:Influencers|Creators)/i.test(title)) continue
    const slug = slugFromUrl(url)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    rows.push({ slug, title, url })
  }
  return rows
}

function sourceFromCandidate(candidate) {
  const label = labelFor(candidate.title, candidate.slug)
  const score = scoreFor(candidate.title, candidate.slug, label)
  return {
    ...candidate,
    id: idForSlug(candidate.slug),
    score,
    target_label: label,
    fallback_label: fallbackLabelFor(label),
    source_query: candidate.title.replace(/^Top\s+/, 'FeedSpot Top '),
    source_name: `FeedSpot ${titleCase(candidate.slug.replace(/_tiktok_(influencers|creators)$/i, ''))} TikTokers`,
  }
}

async function fetchIndex() {
  const response = await fetch(indexUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; alpha-research-editorial-source-discovery/1.0)',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!response.ok) throw new Error(`Source index request failed ${response.status}`)
  return response.text()
}

async function main() {
  ensureDir(processedDir)
  ensureDir(reportsDir)

  const existingSources = existsSync(sourceConfigPath) ? readJson(sourceConfigPath) : []
  const existingIds = new Set(existingSources.map((source) => source.id))
  const existingUrls = new Set(existingSources.map((source) => source.url))
  const html = dryRun ? '' : await fetchIndex()
  const extracted = dryRun ? [] : extractCandidateLinks(html)
  const discovered = extracted
    .map(sourceFromCandidate)
    .map((candidate) => ({
      ...candidate,
      already_configured: existingIds.has(candidate.id) || existingUrls.has(candidate.url),
    }))
  const candidates = discovered
    .filter((candidate) => !candidate.already_configured)
    .filter((candidate) => candidate.score >= minScore)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, maxCandidates)
  const suggestedSources = candidates.map((candidate) => ({
    id: candidate.id,
    url: candidate.url,
    source_query: candidate.source_query,
    target_label: candidate.target_label,
    fallback_label: candidate.fallback_label,
    source_name: candidate.source_name,
  }))

  writeJsonl(join(processedDir, 'editorial_source_candidates.jsonl'), candidates)
  writeCsv(join(processedDir, 'editorial_source_candidates.csv'), candidates)
  writeJson(join(configDir, 'editorial-list-source-candidates.json'), suggestedSources)

  const summary = {
    generated_at: new Date().toISOString(),
    index_url: indexUrl,
    dry_run: dryRun,
    extracted_links: extracted.length,
    configured_sources: existingSources.length,
    discovered_relevant_sources: discovered.filter((row) => row.score >= minScore).length,
    new_candidate_sources: candidates.length,
    min_score: minScore,
    max_candidates: maxCandidates,
    label_counts: candidates.reduce((acc, row) => {
      acc[row.target_label] = (acc[row.target_label] ?? 0) + 1
      return acc
    }, {}),
    top_candidates: candidates.slice(0, 25),
    outputs: {
      candidates_jsonl: 'data/processed/editorial_source_candidates.jsonl',
      candidates_csv: 'data/processed/editorial_source_candidates.csv',
      source_config_json: 'config/editorial-list-source-candidates.json',
    },
  }

  writeJson(join(reportsDir, 'editorial-source-discovery.json'), summary)
  writeFileSync(join(reportsDir, 'editorial-source-discovery.md'), `# Editorial Source Discovery

Generated: ${summary.generated_at}

- Index URL: ${summary.index_url}
- Dry run: ${summary.dry_run}
- Extracted TikTok list links: ${summary.extracted_links}
- Existing configured sources: ${summary.configured_sources}
- New candidate sources: ${summary.new_candidate_sources}
- Minimum score: ${summary.min_score}

## Label Counts

${Object.entries(summary.label_counts).map(([label, count]) => `- ${label}: ${count}`).join('\n') || '- None'}

## Top Candidates

${summary.top_candidates.map((row) => `- ${row.id}: ${row.score}, ${row.target_label}, ${row.title}, ${row.url}`).join('\n') || '- None'}

Candidate config: \`${summary.outputs.source_config_json}\`
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
