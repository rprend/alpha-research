import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const configDir = join(experimentDir, 'config')
const rawImportDir = join(experimentDir, 'data/raw/imports')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const runId = String(args.get('--run-id') ?? new Date().toISOString().replace(/[:.]/g, '-'))
const inputPath = args.get('--input') ? join(root, String(args.get('--input'))) : null
const usefulTarget = Number(args.get('--target') ?? 50000)
const smoke = args.has('--smoke')

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line)
    } catch (error) {
      throw new Error(`Could not parse JSONL ${path}:${index + 1}: ${error.message}`)
    }
  })
}

function parseCsvLine(line) {
  const values = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  values.push(current)
  return values
}

function readCsv(path) {
  const lines = readFileSync(path, 'utf8').split('\n').filter((line) => line.trim())
  if (!lines.length) return []
  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
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
  if (!raw) return null
  const fromUrl = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1]
  const handle = (fromUrl ?? raw).replace(/^@/, '').toLowerCase()
  return handle ? `@${handle}` : null
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item != null && item !== '')
  if (value == null || value === '') return []
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed)
      } catch {
        return [trimmed]
      }
    }
    return trimmed.split(/[|;]/).map((item) => item.trim()).filter(Boolean)
  }
  return [value]
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function extractHashtags(text) {
  return Array.from(new Set(String(text ?? '').match(/#[\p{L}\p{N}_-]+/gu)?.map((tag) => tag.slice(1).toLowerCase()) ?? []))
}

function extractMentions(text) {
  return Array.from(new Set(String(text ?? '').match(/@[A-Za-z0-9._-]+/g)?.map(normalizeHandle).filter(Boolean) ?? []))
}

function daysSince(dateText) {
  const date = new Date(dateText)
  if (Number.isNaN(date.getTime())) return Infinity
  return Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

function tokenize(text) {
  return String(text ?? '').toLowerCase().match(/[a-z][a-z0-9+-]*/g) ?? []
}

function compactText(account, videos) {
  return [
    account.display_name,
    account.bio,
    ...asArray(account.source_labels),
    ...asArray(account.source_names),
    ...asArray(account.source_queries),
    ...videos.map((video) => video.caption),
    ...videos.flatMap((video) => video.hashtags),
    ...asArray(account.bio_links),
  ].join(' ').toLowerCase()
}

function keywordHits(text, keywords) {
  return keywords.filter((keyword) => text.includes(keyword.toLowerCase()))
}

function loadInputRows() {
  const paths = []
  if (inputPath) {
    paths.push(inputPath)
  } else {
    for (const file of readdirSync(rawImportDir).sort()) {
      const path = join(rawImportDir, file)
      if (['.jsonl', '.json', '.csv'].includes(extname(path))) paths.push(path)
    }
  }

  const rows = []
  for (const path of paths) {
    const extension = extname(path)
    const sourceFile = basename(path)
    const parsed = extension === '.jsonl'
      ? readJsonl(path)
      : extension === '.json'
        ? asArray(readJson(path))
        : readCsv(path)
    for (const row of parsed) rows.push({ ...row, _source_file: sourceFile })
  }
  return rows
}

function normalizeRows(rows) {
  const accountMap = new Map()
  const videos = []
  const sources = []

  for (const row of rows) {
    const handle = normalizeHandle(row.handle ?? row.username ?? row.profile_url ?? row.url)
    if (!handle) continue
    const account = accountMap.get(handle) ?? {
      id: handle.slice(1),
      platform: 'tiktok',
      handle,
      display_name: row.display_name ?? row.name ?? '',
      bio: row.bio ?? row.description ?? '',
      profile_url: row.profile_url ?? `https://www.tiktok.com/${handle}`,
      avatar_url: row.avatar_url ?? row.avatar ?? '',
      follower_count: toNumber(row.follower_count ?? row.followers),
      following_count: toNumber(row.following_count ?? row.following),
      likes_count: toNumber(row.likes_count ?? row.hearts ?? row.likes),
      video_count: toNumber(row.video_count ?? row.public_profile_video_count ?? row.videos_count),
      verified: Boolean(row.verified === true || row.verified === 'true'),
      bio_links: asArray(row.bio_links ?? row.external_links ?? row.link),
      status: 'candidate',
      last_seen_at: new Date().toISOString(),
      last_post_at: null,
      source_files: new Set(),
      source_labels: new Set(),
      source_names: new Set(),
      source_queries: new Set(),
      best_source_rank: Infinity,
    }

    account.display_name ||= row.display_name ?? row.name ?? ''
    account.bio ||= row.bio ?? row.description ?? ''
    account.avatar_url ||= row.avatar_url ?? row.avatar ?? ''
    account.follower_count = Math.max(account.follower_count, toNumber(row.follower_count ?? row.followers))
    account.likes_count = Math.max(account.likes_count, toNumber(row.likes_count ?? row.hearts ?? row.likes))
    account.video_count = Math.max(toNumber(account.video_count), toNumber(row.video_count ?? row.public_profile_video_count ?? row.videos_count))
    account.bio_links = Array.from(new Set([...account.bio_links, ...asArray(row.bio_links ?? row.external_links ?? row.link)]))
    account.source_files.add(row._source_file)
    const sourceLabels = [
      ...asArray(row.target_label ?? row.primary_label),
      ...asArray(row.source_target_labels ?? row.target_labels),
    ]
    for (const label of sourceLabels.map((item) => String(item).trim()).filter(Boolean)) {
      account.source_labels.add(label)
    }
    if (row.source_name) account.source_names.add(String(row.source_name))
    if (row.source_query) account.source_queries.add(String(row.source_query))
    const sourceRank = toNumber(row.rank, Infinity)
    if (sourceRank > 0) account.best_source_rank = Math.min(account.best_source_rank, sourceRank)
    accountMap.set(handle, account)

    sources.push({
      creator_id: account.id,
      source_type: row.source_type ?? 'import',
      source_name: row.source_name ?? row._source_file,
      source_query: row.source_query ?? '',
      source_url: row.source_url ?? row.profile_url ?? account.profile_url,
      discovered_at: new Date().toISOString(),
      discovery_run_id: runId,
    })

    const rowVideos = asArray(row.videos)
    for (const [index, video] of rowVideos.entries()) {
      const caption = video.caption ?? video.description ?? ''
      const hashtags = Array.from(new Set([...asArray(video.hashtags).map((tag) => String(tag).replace(/^#/, '').toLowerCase()), ...extractHashtags(caption)]))
      const mentions = Array.from(new Set([...asArray(video.mentions).map(normalizeHandle).filter(Boolean), ...extractMentions(caption)].filter((mention) => mention !== handle)))
      const videoRow = {
        id: `${account.id}_${videos.length + index + 1}`,
        creator_id: account.id,
        url: video.url ?? video.video_url ?? '',
        caption,
        posted_at: video.posted_at ?? video.create_time ?? video.date ?? null,
        view_count: toNumber(video.view_count ?? video.views),
        like_count: toNumber(video.like_count ?? video.likes),
        comment_count: toNumber(video.comment_count ?? video.comments),
        share_count: toNumber(video.share_count ?? video.shares),
        hashtags,
        mentions,
        sound_id: video.sound_id ?? video.music_id ?? '',
        sound_title: video.sound_title ?? video.music_title ?? '',
      }
      videos.push(videoRow)
      if (videoRow.posted_at && (!account.last_post_at || new Date(videoRow.posted_at) > new Date(account.last_post_at))) {
        account.last_post_at = videoRow.posted_at
      }
    }
  }

  const accounts = Array.from(accountMap.values()).map((account) => ({
    ...account,
    source_files: Array.from(account.source_files),
    source_labels: Array.from(account.source_labels),
    source_names: Array.from(account.source_names),
    source_queries: Array.from(account.source_queries),
    best_source_rank: account.best_source_rank === Infinity ? '' : account.best_source_rank,
  }))

  return { accounts, videos, sources }
}

function buildEdges(accounts, videos, rubric) {
  const handleToId = new Map(accounts.map((account) => [account.handle, account.id]))
  const lowSignal = new Set(rubric.low_signal_hashtags)
  const edges = []

  for (const account of accounts) {
    for (const link of account.bio_links) {
      edges.push({
        source_creator_id: account.id,
        target_type: 'external_profile',
        target_id: String(link),
        edge_type: 'external_link',
        evidence_url: account.profile_url,
        confidence: 0.8,
      })
    }
  }

  for (const video of videos) {
    for (const hashtag of video.hashtags) {
      if (!lowSignal.has(hashtag)) {
        edges.push({
          source_creator_id: video.creator_id,
          target_type: 'hashtag',
          target_id: hashtag,
          edge_type: 'uses_hashtag',
          evidence_url: video.url,
          confidence: 0.7,
        })
      }
    }
    for (const mention of video.mentions) {
      edges.push({
        source_creator_id: video.creator_id,
        target_type: handleToId.has(mention) ? 'creator' : 'unresolved_creator',
        target_id: handleToId.get(mention) ?? mention,
        edge_type: 'mentions_creator',
        evidence_url: video.url,
        confidence: 0.75,
      })
    }
    if (video.sound_id) {
      edges.push({
        source_creator_id: video.creator_id,
        target_type: 'sound',
        target_id: video.sound_id,
        edge_type: 'uses_sound',
        evidence_url: video.url,
        confidence: 0.45,
      })
    }
  }

  const deduped = new Map()
  for (const edge of edges) {
    const key = [edge.source_creator_id, edge.target_type, edge.target_id, edge.edge_type, edge.evidence_url].join('|')
    deduped.set(key, edge)
  }
  return Array.from(deduped.values())
}

function classifyAndScore(accounts, videos, edges, rubric) {
  const videosByCreator = Map.groupBy(videos, (video) => video.creator_id)
  const edgesByCreator = Map.groupBy(edges, (edge) => edge.source_creator_id)
  const classifications = []
  const scores = []

  for (const account of accounts) {
    const creatorVideos = videosByCreator.get(account.id) ?? []
    const creatorEdges = edgesByCreator.get(account.id) ?? []
    const text = compactText(account, creatorVideos)
    const rejectHits = keywordHits(text, rubric.reject_keywords)
    const labelHits = Object.entries(rubric.category_keywords).map(([label, keywords]) => ({
      label,
      hits: keywordHits(text, keywords),
    })).sort((a, b) => b.hits.length - a.hits.length)
    const best = labelHits[0]
    const sourceLabels = asArray(account.source_labels).filter((label) => rubric.primary_labels.includes(label) && !['unclear', 'reject'].includes(label))
    const sourcePrimaryLabel = sourceLabels[0] ?? ''
    const primaryLabel = rejectHits.length ? 'reject' : best?.hits.length ? best.label : sourcePrimaryLabel || 'unclear'
    const secondaryLabels = labelHits.filter((entry) => entry.label !== primaryLabel && entry.hits.length > 0).slice(0, 4).map((entry) => entry.label)
    const totalRelevantHits = labelHits.reduce((sum, entry) => sum + entry.hits.length, 0)
    const originalSignals = ['original', 'my short', 'i shot', 'i made', 'directed', 'breakdown', 'behind the scenes', 'bts', 'tutorial', 'camera test']
    const crossPlatform = account.bio_links.length
    const sourceCount = asArray(account.source_names).length
    const bestSourceRank = toNumber(account.best_source_rank, Infinity)
    const rankedEditorialSource = bestSourceRank !== Infinity
    const highRankSource = rankedEditorialSource && bestSourceRank <= 25
    const midRankSource = rankedEditorialSource && bestSourceRank <= 75
    const hasAudienceEvidence = Number(account.follower_count ?? 0) > 0
    const publicProfileVideoCount = toNumber(account.video_count)
    const hasPublicProfileActivity = publicProfileVideoCount > 0
    const recentDays = account.last_post_at ? daysSince(account.last_post_at) : Infinity
    const videoCount = creatorVideos.length
    const uniqueHashtags = new Set(creatorVideos.flatMap((video) => video.hashtags).filter((tag) => !rubric.low_signal_hashtags.includes(tag))).size
    const creativeHits = keywordHits(text, [
      'breakdown',
      'short film',
      'shortfilm',
      'sketch',
      'lighting',
      'editing',
      'directed',
      'cinematography',
      'vfx',
      'animation',
      'character',
      'standup',
      'compositing',
      'camera',
      'story',
      'writer',
      'author',
      'illustrator',
      'artist',
      'producer',
      'composer',
      'dancer',
      'performer',
      'tech',
      'ai',
      'game',
      'lego',
      'book',
    ])

    const categoryFit = primaryLabel === 'reject'
      ? 0
      : Math.min(100, totalRelevantHits * 16 + (best?.hits.length ?? 0) * 12 + (sourcePrimaryLabel ? 32 : 0) + Math.min(18, sourceCount * 4))
    const originality = primaryLabel === 'reject'
      ? Math.max(0, 25 - rejectHits.length * 10)
      : Math.min(100, 45 + keywordHits(text, originalSignals).length * 12 + (creatorVideos.some((video) => String(video.sound_id).startsWith('original')) ? 12 : 0) + (highRankSource ? 8 : 0))
    const creativeSignal = primaryLabel === 'reject' ? 8 : Math.min(100, creativeHits.length * 12 + uniqueHashtags * 5 + Math.min(20, videoCount * 5) + (sourcePrimaryLabel ? 14 : 0) + (highRankSource ? 12 : midRankSource ? 6 : 0))
    const consistency = Math.min(100, videoCount * 28 + Math.min(42, publicProfileVideoCount / 12) + (rankedEditorialSource ? 18 : 0) + (sourceCount > 1 ? 10 : 0))
    const recency = recentDays === Infinity ? 0 : Math.max(0, Math.min(100, 100 - (recentDays / rubric.thresholds.recent_days) * 100))
    const graphValue = Math.min(100, creatorEdges.length * 11 + creatorVideos.flatMap((video) => video.mentions).length * 8 + (sourceCount > 1 ? 16 : 0))
    const crossPlatformEvidence = Math.min(100, crossPlatform * 35)
    const publicSourceEvidence = primaryLabel === 'reject'
      ? 0
      : Math.min(100, (rankedEditorialSource ? 35 : 0) + (highRankSource ? 20 : 0) + Math.min(25, sourceCount * 8) + (hasAudienceEvidence ? 8 : 0) + (hasPublicProfileActivity ? 16 : 0))
    const repostRisk = Math.min(100, rejectHits.length * 35 + (text.includes('credit to owner') ? 45 : 0) + (/\bclips?\b/i.test(text) ? 30 : 0))
    const weighted = (
      creativeSignal * rubric.weights.creative_signal
      + categoryFit * rubric.weights.category_fit
      + originality * rubric.weights.originality
      + graphValue * rubric.weights.graph_value
      + consistency * rubric.weights.consistency
      + recency * rubric.weights.recency
      + crossPlatformEvidence * rubric.weights.cross_platform_evidence
      + publicSourceEvidence * (rubric.weights.public_source_evidence ?? 0)
    )
    const overallUsefulness = Math.max(0, Math.min(100, weighted - repostRisk * 0.35))
    const status = primaryLabel === 'reject'
      ? 'reject'
      : overallUsefulness >= rubric.thresholds.excellent
        ? 'excellent'
        : overallUsefulness >= rubric.thresholds.useful
          ? 'useful'
          : 'needs_review'

    classifications.push({
      creator_id: account.id,
      primary_label: primaryLabel,
      secondary_labels: secondaryLabels,
      confidence: Math.min(0.95, 0.35 + (best?.hits.length ?? 0) * 0.12 + secondaryLabels.length * 0.04),
      evidence: {
        best_keyword_hits: best?.hits ?? [],
        source_labels: sourceLabels,
        reject_hits: rejectHits,
        source_files: account.source_files,
      },
      model_version: `rubric-${rubric.version}`,
      classified_at: new Date().toISOString(),
    })

    scores.push({
      creator_id: account.id,
      category_fit: Math.round(categoryFit),
      originality: Math.round(originality),
      creative_signal: Math.round(creativeSignal),
      recency: Math.round(recency),
      consistency: Math.round(consistency),
      depth: Math.round(Math.min(100, videoCount * 25 + uniqueHashtags * 5)),
      graph_value: Math.round(graphValue),
      cross_platform_evidence: Math.round(crossPlatformEvidence),
      public_source_evidence: Math.round(publicSourceEvidence),
      public_profile_video_count: publicProfileVideoCount,
      repost_risk: Math.round(repostRisk),
      overall_usefulness: Math.round(overallUsefulness),
      status,
      should_expand_from: status !== 'reject' && overallUsefulness >= rubric.thresholds.expand_from,
      model_version: `rubric-${rubric.version}`,
      scored_at: new Date().toISOString(),
    })
  }

  return { classifications, scores }
}

function buildReviewQueue(accounts, classifications, scores) {
  const byClass = new Map(classifications.map((row) => [row.creator_id, row]))
  const byScore = new Map(scores.map((row) => [row.creator_id, row]))
  return accounts.map((account) => {
    const classification = byClass.get(account.id)
    const score = byScore.get(account.id)
    const reasons = []
    if (score.status === 'excellent') reasons.push('benchmark_candidate')
    if (score.status === 'needs_review') reasons.push('threshold_borderline')
    if (classification.primary_label === 'unclear') reasons.push('unclear_category')
    if (score.graph_value >= 35 && score.overall_usefulness < 70) reasons.push('high_graph_value_uncertain_quality')
    if (score.public_source_evidence >= 55 && score.overall_usefulness >= 35) reasons.push('strong_public_source_candidate')
    if (score.repost_risk >= 35) reasons.push('repost_risk')
    return {
      creator_id: account.id,
      handle: account.handle,
      display_name: account.display_name,
      primary_label: classification.primary_label,
      overall_usefulness: score.overall_usefulness,
      status: score.status,
      review_priority: score.status === 'excellent' ? 1 : reasons.includes('repost_risk') ? 2 : reasons.length ? 3 : 5,
      review_reasons: reasons,
      profile_url: account.profile_url,
    }
  }).filter((row) => row.review_reasons.length || row.status === 'excellent').sort((a, b) => a.review_priority - b.review_priority || b.overall_usefulness - a.overall_usefulness)
}

function buildExpansionQueue(accounts, classifications, scores, edges) {
  const byClass = new Map(classifications.map((row) => [row.creator_id, row]))
  const byScore = new Map(scores.map((row) => [row.creator_id, row]))
  const unresolvedMentions = edges.filter((edge) => edge.target_type === 'unresolved_creator')
  const mentionCounts = new Map()
  for (const edge of unresolvedMentions) mentionCounts.set(edge.target_id, (mentionCounts.get(edge.target_id) ?? 0) + 1)

  const sourceRows = accounts.map((account) => {
    const score = byScore.get(account.id)
    const classification = byClass.get(account.id)
    return {
      expansion_type: 'expand_from_creator',
      source_creator_id: account.id,
      target: account.handle,
      priority: score.should_expand_from ? 1 : 4,
      reason: score.should_expand_from ? 'high_usefulness_source' : 'monitor_only',
      primary_label: classification.primary_label,
      overall_usefulness: score.overall_usefulness,
    }
  }).filter((row) => row.priority === 1)

  const mentionRows = Array.from(mentionCounts.entries()).map(([target, count]) => ({
    expansion_type: 'resolve_mentioned_creator',
    source_creator_id: '',
    target,
    priority: count > 1 ? 1 : 2,
    reason: `mentioned_${count}_time${count === 1 ? '' : 's'}`,
    primary_label: '',
    overall_usefulness: '',
  }))

  return [...sourceRows, ...mentionRows].sort((a, b) => a.priority - b.priority)
}

function summarize(accounts, videos, edges, classifications, scores, reviewQueue, expansionQueue) {
  const countBy = (rows, field) => rows.reduce((acc, row) => {
    acc[row[field]] = (acc[row[field]] ?? 0) + 1
    return acc
  }, {})
  const usefulCount = scores.filter((score) => ['useful', 'excellent'].includes(score.status)).length
  const excellentCount = scores.filter((score) => score.status === 'excellent').length
  return {
    run_id: runId,
    generated_at: new Date().toISOString(),
    target_useful_accounts: usefulTarget,
    smoke,
    counts: {
      accounts: accounts.length,
      videos: videos.length,
      edges: edges.length,
      useful_accounts: usefulCount,
      excellent_accounts: excellentCount,
      review_queue: reviewQueue.length,
      expansion_queue: expansionQueue.length,
    },
    status_counts: countBy(scores, 'status'),
    primary_label_counts: countBy(classifications, 'primary_label'),
    readiness: {
      seed_intake_ready: accounts.length > 0,
      graph_expansion_ready: expansionQueue.length > 0,
      scoring_ready: scores.length === accounts.length,
      target_met: usefulCount >= usefulTarget,
      next_gap: usefulCount >= usefulTarget ? 'target_met' : `${usefulTarget - usefulCount} more useful accounts needed`,
    },
  }
}

function buildMarkdownReport(summary, accounts, classifications, scores, reviewQueue, expansionQueue) {
  const byClass = new Map(classifications.map((row) => [row.creator_id, row]))
  const topRows = [...scores].sort((a, b) => b.overall_usefulness - a.overall_usefulness).slice(0, 20)
  const byAccount = new Map(accounts.map((row) => [row.id, row]))

  return `# TikTok Creative Creator Graph Run

Generated: ${summary.generated_at}

## Summary

- Accounts: ${summary.counts.accounts}
- Videos: ${summary.counts.videos}
- Graph edges: ${summary.counts.edges}
- Useful accounts: ${summary.counts.useful_accounts}
- Excellent accounts: ${summary.counts.excellent_accounts}
- Review queue: ${summary.counts.review_queue}
- Expansion queue: ${summary.counts.expansion_queue}
- Target: ${summary.target_useful_accounts}
- Target status: ${summary.readiness.target_met ? 'met' : summary.readiness.next_gap}

## Status Counts

${Object.entries(summary.status_counts).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

## Primary Labels

${Object.entries(summary.primary_label_counts).map(([label, count]) => `- ${label}: ${count}`).join('\n')}

## Top Accounts

| Handle | Label | Score | Status |
| --- | --- | ---: | --- |
${topRows.map((score) => {
  const account = byAccount.get(score.creator_id)
  const classification = byClass.get(score.creator_id)
  return `| ${account?.handle ?? score.creator_id} | ${classification?.primary_label ?? ''} | ${score.overall_usefulness} | ${score.status} |`
}).join('\n')}

## Next Expansion Targets

| Type | Target | Priority | Reason |
| --- | --- | ---: | --- |
${expansionQueue.slice(0, 25).map((row) => `| ${row.expansion_type} | ${row.target} | ${row.priority} | ${row.reason} |`).join('\n')}

## Human Review Queue

| Handle | Label | Score | Reasons |
| --- | --- | ---: | --- |
${reviewQueue.slice(0, 25).map((row) => `| ${row.handle} | ${row.primary_label} | ${row.overall_usefulness} | ${row.review_reasons.join('; ')} |`).join('\n')}
`
}

function main() {
  ensureDir(processedDir)
  ensureDir(reportsDir)

  const rubric = readJson(join(configDir, 'category-rubric.json'))
  const rows = loadInputRows()
  const { accounts, videos, sources } = normalizeRows(rows)
  const edges = buildEdges(accounts, videos, rubric)
  const { classifications, scores } = classifyAndScore(accounts, videos, edges, rubric)
  const reviewQueue = buildReviewQueue(accounts, classifications, scores)
  const expansionQueue = buildExpansionQueue(accounts, classifications, scores, edges)
  const summary = summarize(accounts, videos, edges, classifications, scores, reviewQueue, expansionQueue)

  writeJsonl(join(processedDir, 'creator_accounts.jsonl'), accounts)
  writeJsonl(join(processedDir, 'creator_videos.jsonl'), videos)
  writeJsonl(join(processedDir, 'creator_edges.jsonl'), edges)
  writeJsonl(join(processedDir, 'creator_sources.jsonl'), sources)
  writeJsonl(join(processedDir, 'creator_classifications.jsonl'), classifications)
  writeJsonl(join(processedDir, 'creator_scores.jsonl'), scores)
  writeJsonl(join(processedDir, 'review_queue.jsonl'), reviewQueue)
  writeJsonl(join(processedDir, 'expansion_queue.jsonl'), expansionQueue)
  writeCsv(join(processedDir, 'creator_scores.csv'), scores)
  writeCsv(join(processedDir, 'review_queue.csv'), reviewQueue)
  writeCsv(join(processedDir, 'expansion_queue.csv'), expansionQueue)
  writeJson(join(reportsDir, 'result.json'), summary)
  writeJson(join(reportsDir, 'pipeline-run.json'), {
    run_id: runId,
    args: Object.fromEntries(args.entries()),
    input_files: inputPath ? [inputPath] : readdirSync(rawImportDir).sort(),
    outputs: [
      'data/processed/creator_accounts.jsonl',
      'data/processed/creator_videos.jsonl',
      'data/processed/creator_edges.jsonl',
      'data/processed/creator_scores.jsonl',
      'data/processed/review_queue.jsonl',
      'data/processed/expansion_queue.jsonl',
      'reports/result.json',
      'reports/work.md',
      'reports/readiness.md',
    ],
  })
  writeFileSync(join(reportsDir, 'work.md'), buildMarkdownReport(summary, accounts, classifications, scores, reviewQueue, expansionQueue))
  writeFileSync(join(reportsDir, 'readiness.md'), `# Readiness

- Seed intake ready: ${summary.readiness.seed_intake_ready}
- Graph expansion ready: ${summary.readiness.graph_expansion_ready}
- Scoring ready: ${summary.readiness.scoring_ready}
- Target met: ${summary.readiness.target_met}
- Gap: ${summary.readiness.next_gap}

This run proves the local graph/scoring workflow. Production-scale completion requires importing enough public TikTok/search/paid-provider exports to meet the 50,000 useful-account target.
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
