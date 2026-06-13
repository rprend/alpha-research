import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const acquisitionResultsDir = join(experimentDir, 'data/raw/acquisition-results')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const maxProfiles = Number(args.get('--max-profiles') ?? 100)
const minUsefulness = Number(args.get('--min-usefulness') ?? 35)
const dryRun = args.has('--dry-run')
const includeAttempted = args.has('--include-attempted')
const executionId = new Date().toISOString().replace(/[:.]/g, '-')
const provider = 'tiktok_public_profile_html'

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line)
    } catch (error) {
      throw new Error(`Could not parse ${path}:${index + 1}: ${error.message}`)
    }
  })
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

function normalizeHandle(value) {
  const raw = String(value ?? '').trim()
  const fromUrl = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1]
  const handle = (fromUrl ?? raw).replace(/^@/, '').toLowerCase()
  return handle ? `@${handle}` : ''
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function scrubContactText(value) {
  return String(value ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/[A-Z0-9._%+-]+@\s*(?:gmail|yahoo|hotmail|outlook|icloud|protonmail)\b(?:\.[A-Z]{2,})?/gi, '')
    .replace(/\b[A-Z0-9._%+-]+\s+at\s+(?:gmail|yahoo|hotmail|outlook|icloud|protonmail)\s+dot\s+[A-Z]{2,}\b/gi, '')
    .replace(/(?:^|[^\d])(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}(?=$|[^\d])/g, ' ')
    .replace(/\b(?:all\s+)?(?:business|contact|email|inquiries?|enquiries?|booking|bookings?|manager)\s*:?\s*/gi, '')
    .replace(/[📧✉️]+\s*:?\s*/gu, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function publicBioLinks(user) {
  return [user.bioLink?.link]
    .filter(Boolean)
    .filter((link) => !/[A-Z0-9._%+-]+@[A-Z0-9.-]+(?:\.[A-Z]{2,})?/i.test(String(link)))
}

function attemptedHandles() {
  if (includeAttempted || !existsSync(acquisitionResultsDir)) return new Set()
  const handles = new Set()
  for (const file of readdirSync(acquisitionResultsDir)) {
    if (!file.endsWith('-public-profile-enrichment.jsonl')) continue
    for (const row of readJsonl(join(acquisitionResultsDir, file))) {
      const handle = normalizeHandle(row.handle ?? row.profile_url)
      if (handle) handles.add(handle)
    }
  }
  const reportPath = join(reportsDir, 'public-profile-enrichment.json')
  if (existsSync(reportPath)) {
    try {
      const report = JSON.parse(readFileSync(reportPath, 'utf8'))
      for (const row of report.profiles ?? []) {
        const handle = normalizeHandle(row.handle)
        if (handle) handles.add(handle)
      }
    } catch {
      // Ignore stale or partial reports; raw acquisition rows are authoritative.
    }
  }
  return handles
}

function selectedProfiles() {
  const accounts = readJsonl(join(processedDir, 'creator_accounts.jsonl'))
  const reviewQueue = readJsonl(join(processedDir, 'review_queue.jsonl'))
  const classifications = new Map(readJsonl(join(processedDir, 'creator_classifications.jsonl')).map((row) => [row.creator_id, row]))
  const accountByHandle = new Map(accounts.map((account) => [normalizeHandle(account.handle), account]))
  const selected = new Map()
  const attempted = attemptedHandles()

  const reviewRows = reviewQueue
    .filter((row) => toNumber(row.overall_usefulness) >= minUsefulness)
    .sort((a, b) => toNumber(a.review_priority, 9) - toNumber(b.review_priority, 9) || toNumber(b.overall_usefulness) - toNumber(a.overall_usefulness))

  for (const row of reviewRows) {
    const handle = normalizeHandle(row.handle)
    const account = accountByHandle.get(handle)
    if (!handle || !account) continue
    if (attempted.has(handle)) continue
    selected.set(handle, {
      handle,
      creator_id: account.id,
      profile_url: account.profile_url || `https://www.tiktok.com/${handle}`,
      target_label: classifications.get(account.id)?.primary_label ?? row.primary_label ?? '',
      prior_usefulness: toNumber(row.overall_usefulness),
      selection_reason: `review_queue_priority_${row.review_priority}`,
    })
    if (selected.size >= maxProfiles) return Array.from(selected.values())
  }

  for (const account of accounts) {
    const handle = normalizeHandle(account.handle)
    if (!handle || selected.has(handle)) continue
    if (attempted.has(handle)) continue
    if (account.bio && toNumber(account.follower_count) > 0) continue
    selected.set(handle, {
      handle,
      creator_id: account.id,
      profile_url: account.profile_url || `https://www.tiktok.com/${handle}`,
      target_label: classifications.get(account.id)?.primary_label ?? '',
      prior_usefulness: 0,
      selection_reason: 'missing_public_profile_metadata',
    })
    if (selected.size >= maxProfiles) break
  }

  return Array.from(selected.values())
}

function extractUniversalData(html) {
  const marker = '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">'
  const start = html.indexOf(marker)
  if (start < 0) return null
  const end = html.indexOf('</script>', start)
  if (end < 0) return null
  return JSON.parse(html.slice(start + marker.length, end))
}

function profileInfoFromUniversalData(data) {
  return data?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo ?? null
}

async function fetchProfile(profile) {
  const response = await fetch(profile.profile_url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!response.ok) throw new Error(`profile request failed ${response.status}`)
  const html = await response.text()
  const info = profileInfoFromUniversalData(extractUniversalData(html))
  if (!info?.user?.uniqueId) throw new Error('profile hydration data missing userInfo')
  return info
}

function rowFromProfile(profile, info) {
  const user = info.user ?? {}
  const stats = info.statsV2 ?? info.stats ?? {}
  const handle = normalizeHandle(user.uniqueId ?? profile.handle)
  return {
    handle,
    display_name: user.nickname ?? handle.slice(1),
    bio: scrubContactText(user.signature),
    profile_url: `https://www.tiktok.com/${handle}`,
    avatar_url: user.avatarMedium ?? user.avatarThumb ?? '',
    follower_count: toNumber(stats.followerCount ?? info.stats?.followerCount),
    following_count: toNumber(stats.followingCount ?? info.stats?.followingCount),
    likes_count: toNumber(stats.heartCount ?? stats.heart ?? info.stats?.heartCount),
    verified: Boolean(user.verified),
    bio_links: publicBioLinks(user),
    source_type: 'public_profile_enrichment',
    source_name: 'TikTok public profile hydration',
    source_query: profile.selection_reason,
    source_url: `https://www.tiktok.com/${handle}`,
    target_label: profile.target_label,
    source_target_labels: [profile.target_label].filter(Boolean),
    provider,
    provider_execution_id: executionId,
    batch_id: `public_profile_enrichment_${executionId}`,
    videos: [],
    public_profile_video_count: toNumber(stats.videoCount ?? info.stats?.videoCount),
    prior_usefulness: profile.prior_usefulness,
  }
}

async function main() {
  ensureDir(acquisitionResultsDir)
  ensureDir(processedDir)
  ensureDir(reportsDir)

  const profiles = selectedProfiles()
  const outputRows = []
  const profileReports = []

  for (const profile of profiles) {
    const startedAt = new Date().toISOString()
    try {
      const info = dryRun ? null : await fetchProfile(profile)
      if (!dryRun) outputRows.push(rowFromProfile(profile, info))
      profileReports.push({
        handle: profile.handle,
        status: dryRun ? 'dry_run' : 'succeeded',
        selection_reason: profile.selection_reason,
        prior_usefulness: profile.prior_usefulness,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      })
    } catch (error) {
      profileReports.push({
        handle: profile.handle,
        status: 'failed',
        error: error.message,
        selection_reason: profile.selection_reason,
        prior_usefulness: profile.prior_usefulness,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      })
    }
  }

  const outputPath = join(acquisitionResultsDir, `${executionId}-public-profile-enrichment.jsonl`)
  if (!dryRun && outputRows.length) writeJsonl(outputPath, outputRows)
  writeJsonl(join(processedDir, 'public_profile_enrichment_results.jsonl'), outputRows)
  writeCsv(join(processedDir, 'public_profile_enrichment_results.csv'), outputRows)

  const summary = {
    generated_at: new Date().toISOString(),
    execution_id: executionId,
    provider,
    dry_run: dryRun,
    include_attempted: includeAttempted,
    selected_profiles: profiles.length,
    output_rows: outputRows.length,
    output_path: dryRun || !outputRows.length ? '' : outputPath.replace(`${root}/`, ''),
    succeeded_profiles: profileReports.filter((row) => row.status === 'succeeded').length,
    failed_profiles: profileReports.filter((row) => row.status === 'failed').length,
    first_rows: outputRows.slice(0, 25),
    profiles: profileReports,
  }

  writeJson(join(reportsDir, 'public-profile-enrichment.json'), summary)
  writeFileSync(join(reportsDir, 'public-profile-enrichment.md'), `# Public Profile Enrichment

Generated: ${summary.generated_at}

- Provider: ${summary.provider}
- Dry run: ${summary.dry_run}
- Selected profiles: ${summary.selected_profiles}
- Output rows: ${summary.output_rows}
- Output path: ${summary.output_path || 'none'}
- Succeeded profiles: ${summary.succeeded_profiles}
- Failed profiles: ${summary.failed_profiles}

## Profiles

${profileReports.slice(0, 100).map((row) => `- ${row.handle}: ${row.status}, ${row.selection_reason}, prior ${row.prior_usefulness}`).join('\n') || '- None'}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (!summary.output_rows && summary.failed_profiles) process.exitCode = 1
}

main()
