import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
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

function canonicalUrl(value) {
  try {
    const url = new URL(String(value).trim())
    url.hash = ''
    url.search = ''
    url.hostname = url.hostname.replace(/^www\./, '').toLowerCase()
    url.pathname = url.pathname.replace(/\/+$/, '')
    return url.toString()
  } catch {
    return ''
  }
}

function normalizeHandle(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const fromUrl = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1]
  const handle = (fromUrl ?? raw).replace(/^@/, '').toLowerCase()
  return handle ? `@${handle}` : ''
}

function externalKey(value) {
  const url = canonicalUrl(value)
  if (!url) return ''
  try {
    const parsed = new URL(url)
    const path = parsed.pathname.toLowerCase()
    if (['linktr.ee', 'beacons.ai', 'carrd.co', 'vimeo.com', 'youtube.com', 'instagram.com', 'imdb.com', 'github.com'].some((host) => parsed.hostname.endsWith(host))) {
      return `${parsed.hostname}${path}`
    }
    return `${parsed.hostname}${path}`
  } catch {
    return ''
  }
}

function slugName(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim()
}

class UnionFind {
  constructor(items) {
    this.parent = new Map(items.map((item) => [item, item]))
  }

  find(item) {
    if (!this.parent.has(item)) this.parent.set(item, item)
    const parent = this.parent.get(item)
    if (parent === item) return item
    const root = this.find(parent)
    this.parent.set(item, root)
    return root
  }

  union(a, b) {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) this.parent.set(rootB, rootA)
  }
}

function identityId(keys) {
  const hash = createHash('sha1').update(keys.sort().join('|')).digest('hex').slice(0, 12)
  return `creator_identity_${hash}`
}

function main() {
  ensureDir(processedDir)
  ensureDir(reportsDir)

  const accounts = readJsonl(join(processedDir, 'creator_accounts.jsonl'))
  const scores = readJsonl(join(processedDir, 'creator_scores_reviewed.jsonl')).length
    ? readJsonl(join(processedDir, 'creator_scores_reviewed.jsonl'))
    : readJsonl(join(processedDir, 'creator_scores.jsonl'))
  const classifications = readJsonl(join(processedDir, 'creator_classifications.jsonl'))
  const scoreByCreator = new Map(scores.map((score) => [score.creator_id, score]))
  const classByCreator = new Map(classifications.map((classification) => [classification.creator_id, classification]))
  const uf = new UnionFind(accounts.map((account) => account.id))
  const evidenceRows = []
  const keyToCreator = new Map()

  function observe(account, keyType, key, confidence, evidence) {
    if (!key) return
    evidenceRows.push({
      creator_id: account.id,
      handle: account.handle,
      key_type: keyType,
      key,
      confidence,
      evidence,
    })
    if (keyToCreator.has(key)) {
      uf.union(account.id, keyToCreator.get(key))
    } else {
      keyToCreator.set(key, account.id)
    }
  }

  for (const account of accounts) {
    observe(account, 'tiktok_handle', normalizeHandle(account.handle), 1, account.profile_url)
    observe(account, 'tiktok_profile_url', canonicalUrl(account.profile_url), 1, account.profile_url)
    observe(account, 'display_name_slug', slugName(account.display_name), 0.35, account.display_name)
    for (const link of account.bio_links ?? []) {
      observe(account, 'external_link', externalKey(link), 0.85, link)
    }
  }

  const clusters = new Map()
  for (const account of accounts) {
    const rootId = uf.find(account.id)
    if (!clusters.has(rootId)) clusters.set(rootId, [])
    clusters.get(rootId).push(account)
  }

  const identities = []
  const membership = []
  const duplicateRisks = []
  for (const clusterAccounts of clusters.values()) {
    const clusterKeys = clusterAccounts.flatMap((account) => [
      normalizeHandle(account.handle),
      canonicalUrl(account.profile_url),
      ...(account.bio_links ?? []).map(externalKey),
    ]).filter(Boolean)
    const id = identityId(clusterKeys.length ? clusterKeys : clusterAccounts.map((account) => account.id))
    const bestAccount = [...clusterAccounts].sort((a, b) => {
      const scoreA = Number(scoreByCreator.get(a.id)?.overall_usefulness ?? 0)
      const scoreB = Number(scoreByCreator.get(b.id)?.overall_usefulness ?? 0)
      return scoreB - scoreA || Number(b.follower_count ?? 0) - Number(a.follower_count ?? 0)
    })[0]
    const identityScores = clusterAccounts.map((account) => Number(scoreByCreator.get(account.id)?.overall_usefulness ?? 0))
    const labels = Array.from(new Set(clusterAccounts.map((account) => classByCreator.get(account.id)?.primary_label).filter(Boolean)))
    identities.push({
      identity_id: id,
      canonical_creator_id: bestAccount.id,
      canonical_handle: bestAccount.handle,
      account_count: clusterAccounts.length,
      handles: clusterAccounts.map((account) => account.handle).join('; '),
      external_links: Array.from(new Set(clusterAccounts.flatMap((account) => account.bio_links ?? []))).join('; '),
      primary_labels: labels.join('; '),
      max_usefulness: Math.max(...identityScores),
      duplicate_risk: clusterAccounts.length > 1 ? 'high' : 'low',
    })
    for (const account of clusterAccounts) {
      membership.push({
        identity_id: id,
        creator_id: account.id,
        handle: account.handle,
        canonical_creator_id: bestAccount.id,
        is_canonical: account.id === bestAccount.id,
      })
    }
    if (clusterAccounts.length > 1) {
      duplicateRisks.push({
        identity_id: id,
        account_count: clusterAccounts.length,
        handles: clusterAccounts.map((account) => account.handle).join('; '),
        reason: 'shared identity key',
      })
    }
  }

  const sortedIdentities = identities.sort((a, b) => b.max_usefulness - a.max_usefulness || a.canonical_handle.localeCompare(b.canonical_handle))
  writeJsonl(join(processedDir, 'creator_identities.jsonl'), sortedIdentities)
  writeCsv(join(processedDir, 'creator_identities.csv'), sortedIdentities)
  writeJsonl(join(processedDir, 'creator_identity_membership.jsonl'), membership)
  writeJsonl(join(processedDir, 'identity_evidence.jsonl'), evidenceRows)
  writeJsonl(join(processedDir, 'duplicate_risk_queue.jsonl'), duplicateRisks)

  const summary = {
    generated_at: new Date().toISOString(),
    accounts: accounts.length,
    identities: sortedIdentities.length,
    duplicate_risks: duplicateRisks.length,
    identity_evidence_rows: evidenceRows.length,
    high_confidence_external_links: evidenceRows.filter((row) => row.key_type === 'external_link' && row.confidence >= 0.85).length,
  }
  writeJson(join(reportsDir, 'identity-resolution.json'), summary)
  writeFileSync(join(reportsDir, 'identity-resolution.md'), `# Identity Resolution

Generated: ${summary.generated_at}

- Accounts: ${summary.accounts}
- Identities: ${summary.identities}
- Duplicate risk clusters: ${summary.duplicate_risks}
- Identity evidence rows: ${summary.identity_evidence_rows}
- High-confidence external links: ${summary.high_confidence_external_links}

## Duplicate Risk Queue

| Identity | Accounts | Handles | Reason |
| --- | ---: | --- | --- |
${duplicateRisks.slice(0, 25).map((row) => `| ${row.identity_id} | ${row.account_count} | ${row.handles} | ${row.reason} |`).join('\n')}
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
