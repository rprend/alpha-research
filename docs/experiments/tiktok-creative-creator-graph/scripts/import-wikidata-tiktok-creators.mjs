import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const acquisitionResultsDir = join(experimentDir, 'data/raw/acquisition-results')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const maxRows = Number(args.get('--max-rows') ?? 5000)
const sparqlLimit = Number(args.get('--sparql-limit') ?? Math.min(20000, Math.max(1, maxRows * 4)))
const maxRetries = Number(args.get('--max-retries') ?? 3)
const dryRun = args.has('--dry-run')
const includeBroadPerformers = args.has('--include-broad-performers')
const includeCreatorNative = args.has('--include-creator-native')
const includeExpandedCreative = args.has('--include-expanded-creative')
const executionId = new Date().toISOString().replace(/[:.]/g, '-')
const provider = 'wikidata_sparql'

const occupationConfig = [
  { qid: 'Q2526255', label: 'film director', target_label: 'director' },
  { qid: 'Q2059704', label: 'television director', target_label: 'director' },
  { qid: 'Q28389', label: 'screenwriter', target_label: 'screenwriter' },
  { qid: 'Q222344', label: 'cinematographer', target_label: 'cinematographer' },
  { qid: 'Q7042855', label: 'film editor', target_label: 'editor' },
  { qid: 'Q7927905', label: 'video editor', target_label: 'editor' },
  { qid: 'Q266569', label: 'animator', target_label: 'vfx_animation' },
  { qid: 'Q21560152', label: 'special effects artist', target_label: 'vfx_animation' },
  { qid: 'Q3282637', label: 'film producer', target_label: 'filmmaker' },
  { qid: 'Q245068', label: 'comedian', target_label: 'sketch_comedian' },
  { qid: 'Q18545066', label: 'stand-up comedian', target_label: 'standup_comedian' },
  { qid: 'Q2405480', label: 'voice actor', target_label: 'actor_performer' },
]

const broadPerformerOccupationConfig = [
  { qid: 'Q33999', label: 'actor', target_label: 'actor_performer' },
  { qid: 'Q10800557', label: 'film actor', target_label: 'actor_performer' },
  { qid: 'Q2259451', label: 'stage actor', target_label: 'actor_performer' },
  { qid: 'Q5716684', label: 'dancer', target_label: 'actor_performer' },
]

const creatorNativeOccupationConfig = [
  { qid: 'Q17125263', label: 'YouTuber', target_label: 'film_educator' },
  { qid: 'Q94791573', label: 'TikToker', target_label: 'creative_technologist' },
  { qid: 'Q2045208', label: 'Internet celebrity', target_label: 'creative_technologist' },
  { qid: 'Q2906862', label: 'influencer', target_label: 'creative_technologist' },
  { qid: 'Q109459317', label: 'content creator', target_label: 'creative_technologist' },
  { qid: 'Q111263847', label: 'digital creator', target_label: 'creative_technologist' },
  { qid: 'Q4110598', label: 'vlogger', target_label: 'film_educator' },
  { qid: 'Q50279140', label: 'Twitch streamer', target_label: 'creative_technologist' },
  { qid: 'Q57414145', label: 'online streamer', target_label: 'creative_technologist' },
  { qid: 'Q118371929', label: 'web video producer', target_label: 'filmmaker' },
  { qid: 'Q1414443', label: 'filmmaker', target_label: 'filmmaker' },
  { qid: 'Q2737906', label: 'videographer', target_label: 'cinematographer' },
  { qid: 'Q1148872', label: 'impressionist', target_label: 'sketch_comedian' },
  { qid: 'Q18810049', label: 'cosplayer', target_label: 'actor_performer' },
  { qid: 'Q337084', label: 'drag queen', target_label: 'actor_performer' },
  { qid: 'Q126912755', label: 'drag performer', target_label: 'actor_performer' },
  { qid: 'Q483501', label: 'artist', target_label: 'vfx_animation' },
  { qid: 'Q3391743', label: 'visual artist', target_label: 'vfx_animation' },
  { qid: 'Q644687', label: 'illustrator', target_label: 'vfx_animation' },
  { qid: 'Q627325', label: 'graphic designer', target_label: 'vfx_animation' },
  { qid: 'Q5322166', label: 'designer', target_label: 'creative_technologist' },
  { qid: 'Q3501317', label: 'fashion designer', target_label: 'creative_technologist' },
  { qid: 'Q715301', label: 'comics artist', target_label: 'vfx_animation' },
  { qid: 'Q1028181', label: 'painter', target_label: 'vfx_animation' },
  { qid: 'Q15143191', label: 'science communicator', target_label: 'film_educator' },
  { qid: 'Q974144', label: 'educator', target_label: 'film_educator' },
  { qid: 'Q37226', label: 'teacher', target_label: 'film_educator' },
]

const expandedCreativeOccupationConfig = [
  { qid: 'Q36180', label: 'writer', target_label: 'screenwriter' },
  { qid: 'Q482980', label: 'author', target_label: 'screenwriter' },
  { qid: 'Q49757', label: 'poet', target_label: 'screenwriter' },
  { qid: 'Q177220', label: 'singer', target_label: 'actor_performer' },
  { qid: 'Q639669', label: 'musician', target_label: 'actor_performer' },
  { qid: 'Q488205', label: 'singer-songwriter', target_label: 'actor_performer' },
  { qid: 'Q753110', label: 'songwriter', target_label: 'screenwriter' },
  { qid: 'Q36834', label: 'composer', target_label: 'actor_performer' },
  { qid: 'Q2252262', label: 'rapper', target_label: 'actor_performer' },
  { qid: 'Q183945', label: 'record producer', target_label: 'creative_technologist' },
  { qid: 'Q55960555', label: 'recording artist', target_label: 'actor_performer' },
  { qid: 'Q130857', label: 'disc jockey', target_label: 'creative_technologist' },
  { qid: 'Q3922505', label: 'DJ producer', target_label: 'creative_technologist' },
  { qid: 'Q855091', label: 'guitarist', target_label: 'actor_performer' },
  { qid: 'Q486748', label: 'pianist', target_label: 'actor_performer' },
  { qid: 'Q822146', label: 'lyricist', target_label: 'screenwriter' },
  { qid: 'Q60723829', label: 'pop singer', target_label: 'actor_performer' },
  { qid: 'Q947873', label: 'television presenter', target_label: 'behind_the_scenes_creator' },
  { qid: 'Q13590141', label: 'presenter', target_label: 'behind_the_scenes_creator' },
  { qid: 'Q15077007', label: 'podcaster', target_label: 'film_educator' },
  { qid: 'Q44508716', label: 'television personality', target_label: 'actor_performer' },
  { qid: 'Q33231', label: 'photographer', target_label: 'cinematographer' },
  { qid: 'Q2490358', label: 'choreographer', target_label: 'actor_performer' },
  { qid: 'Q3455803', label: 'director', target_label: 'director' },
  { qid: 'Q483501', label: 'artist', target_label: 'vfx_animation' },
  { qid: 'Q8246794', label: 'blogger', target_label: 'film_educator' },
  { qid: 'Q12330954', label: 'owarai tarento', target_label: 'sketch_comedian' },
  { qid: 'Q622807', label: 'seiyu', target_label: 'actor_performer' },
]

const exclusionRules = [
  /\bpornographic\b/i,
  /\badult film\b/i,
  /\bpolitician\b/i,
  /\bpolitical\b/i,
  /\bgovernment\b/i,
]

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''))
}

function normalizeHandle(value) {
  const raw = String(value ?? '').trim()
  const fromUrl = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1]
  const fromHandle = raw.match(/^@?([A-Za-z0-9._-]+)$/)?.[1]
  const handle = (fromUrl ?? fromHandle ?? '').toLowerCase()
  if (!handle || handle.includes('.com')) return ''
  return `@${handle}`
}

function occupationConfigs() {
  return [
    ...occupationConfig,
    ...(includeBroadPerformers ? broadPerformerOccupationConfig : []),
    ...(includeCreatorNative ? creatorNativeOccupationConfig : []),
    ...(includeExpandedCreative ? expandedCreativeOccupationConfig : []),
  ].filter((occupation, index, occupations) => occupations.findIndex((item) => item.qid === occupation.qid) === index)
}

function sparqlQuery() {
  const values = occupationConfigs().map((occupation) => `wd:${occupation.qid}`).join(' ')
  return `SELECT ?item ?itemLabel ?description ?tiktok ?occupation ?occupationLabel WHERE {
  VALUES ?occupation { ${values} }
  ?item wdt:P31 wd:Q5;
    wdt:P7085 ?tiktok;
    wdt:P106 ?occupation.
  OPTIONAL { ?item schema:description ?description FILTER(LANG(?description) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT ${Math.max(1, sparqlLimit)}`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchRows() {
  const url = new URL('https://query.wikidata.org/sparql')
  url.searchParams.set('format', 'json')
  url.searchParams.set('query', sparqlQuery())
  let lastError = null
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'alpha-research-tiktok-creator-graph/1.0 (research; github.com/rprend/alpha-research)',
          accept: 'application/sparql-results+json',
        },
      })
      if (!response.ok) throw new Error(`Wikidata SPARQL request failed ${response.status}`)
      const payload = await response.json()
      return payload.results?.bindings ?? []
    } catch (error) {
      lastError = error
      if (attempt < maxRetries) await sleep(1000 * attempt)
    }
  }
  throw lastError
}

function bindingValue(binding, key) {
  return binding[key]?.value ?? ''
}

function normalizeBinding(binding) {
  const handle = normalizeHandle(bindingValue(binding, 'tiktok'))
  if (!handle) return null
  const description = bindingValue(binding, 'description')
  if (exclusionRules.some((pattern) => pattern.test(description))) return null
  const itemUrl = bindingValue(binding, 'item')
  const occupationQid = bindingValue(binding, 'occupation').split('/').pop()
  const mappedOccupation = occupationConfigs().find((occupation) => occupation.qid === occupationQid)
  const targetLabel = mappedOccupation?.target_label ?? 'unclassified'
  const occupationLabel = bindingValue(binding, 'occupationLabel') || mappedOccupation?.label || occupationQid
  return {
    handle,
    profile_url: `https://www.tiktok.com/${handle}`,
    display_name: bindingValue(binding, 'itemLabel') || handle.slice(1),
    bio: description,
    follower_count: 0,
    likes_count: 0,
    video_count: 0,
    verified: false,
    source_type: 'wikidata_profile',
    source_name: 'Wikidata TikTok username property P7085',
    source_url: itemUrl,
    source_query: occupationLabel,
    target_label: targetLabel,
    source_target_labels: [targetLabel],
    acquisition_surface: 'structured_public_profile_graph',
    provider,
    provider_execution_id: executionId,
    batch_id: `wikidata_${occupationQid}`,
    external_ids: itemUrl,
    rank: 0,
  }
}

function mergeRows(existing, candidate) {
  if (!existing) return candidate
  const labels = Array.from(new Set([...existing.source_target_labels, ...candidate.source_target_labels]))
  const queries = Array.from(new Set(`${existing.source_query}|${candidate.source_query}`.split('|').filter(Boolean)))
  const sourceUrls = Array.from(new Set(`${existing.source_url}|${candidate.source_url}`.split('|').filter(Boolean)))
  const batchIds = Array.from(new Set(`${existing.batch_id}|${candidate.batch_id}`.split('|').filter(Boolean)))
  return {
    ...existing,
    target_label: existing.target_label || candidate.target_label,
    source_target_labels: labels,
    source_query: queries.join('|'),
    source_url: sourceUrls.join('|'),
    batch_id: batchIds.join('|'),
    external_ids: sourceUrls.join('|'),
  }
}

async function main() {
  ensureDir(acquisitionResultsDir)
  ensureDir(reportsDir)

  const bindings = await fetchRows()
  const byHandle = new Map()
  let skippedRows = 0
  for (const binding of bindings) {
    const normalized = normalizeBinding(binding)
    if (!normalized) {
      skippedRows += 1
      continue
    }
    byHandle.set(normalized.handle, mergeRows(byHandle.get(normalized.handle), normalized))
    if (byHandle.size >= maxRows) break
  }

  const outputRows = Array.from(byHandle.values()).map((row, index) => ({ ...row, rank: index + 1 }))
  const outputPath = join(acquisitionResultsDir, `${executionId}-wikidata-tiktok-creators.jsonl`)
  if (!dryRun && outputRows.length) writeJsonl(outputPath, outputRows)

  const summary = {
    generated_at: new Date().toISOString(),
    execution_id: executionId,
    provider,
    dry_run: dryRun,
    source_url: 'https://www.wikidata.org/wiki/Property:P7085',
    source_license: 'CC0-1.0',
    source_use_note: 'Wikidata statements are public structured leads; verify TikTok profile activity and creator fit before production release.',
    include_broad_performers: includeBroadPerformers,
    include_creator_native: includeCreatorNative,
    include_expanded_creative: includeExpandedCreative,
    occupation_qids: occupationConfigs().map((occupation) => occupation.qid),
    sparql_limit: sparqlLimit,
    max_retries: maxRetries,
    input_rows: bindings.length,
    output_rows: outputRows.length,
    skipped_rows: skippedRows,
    output_path: dryRun || !outputRows.length ? '' : outputPath.replace(`${root}/`, ''),
    target_label_counts: outputRows.reduce((acc, row) => {
      acc[row.target_label || 'unclassified'] = (acc[row.target_label || 'unclassified'] ?? 0) + 1
      return acc
    }, {}),
    first_rows: outputRows.slice(0, 25),
  }

  writeJson(join(reportsDir, 'wikidata-tiktok-creators-import.json'), summary)
  writeFileSync(join(reportsDir, 'wikidata-tiktok-creators-import.md'), `# Wikidata TikTok Creators Import

Generated: ${summary.generated_at}

- Provider: ${summary.provider}
- Dry run: ${summary.dry_run}
- Source URL: ${summary.source_url}
- Source license: ${summary.source_license}
- Source use note: ${summary.source_use_note}
- Broad performers included: ${summary.include_broad_performers}
- Creator-native occupations included: ${summary.include_creator_native}
- Expanded creative occupations included: ${summary.include_expanded_creative}
- Input rows: ${summary.input_rows}
- Output creator rows: ${summary.output_rows}
- Skipped rows: ${summary.skipped_rows}
- Output path: ${summary.output_path || 'none'}

## Target Labels

${Object.entries(summary.target_label_counts).map(([label, count]) => `- ${label}: ${count}`).join('\n') || '- None'}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (!summary.output_rows) process.exitCode = 1
}

main()
