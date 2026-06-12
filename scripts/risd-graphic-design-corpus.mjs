import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const outDir = join(root, 'docs/research-plans/risd-graphic-design-corpus')
const retrievedAt = new Date().toISOString().slice(0, 10)
const skipWayback = process.argv.includes('--skip-wayback')
const renderCurriculumOnly = process.argv.includes('--render-curriculum-only')
const renderDerivedOnly = process.argv.includes('--render-derived-only')
const commonCrawlOnly = process.argv.includes('--common-crawl-only')
const promoteCommonCrawlOnly = process.argv.includes('--promote-common-crawl-only')
const ingestCommonCrawlOnly = process.argv.includes('--ingest-common-crawl-only')
const ingestFacultyProfilesOnly = process.argv.includes('--ingest-faculty-profiles-only')
const officialCourseMaxPages = 12
const crawlMaxDepth = 1
const crawlMaxLinksPerHost = 20
const waybackMaxSources = 45
const commonCrawlMaxIndexes = Number(process.env.RISD_GD_CC_MAX_INDEXES ?? 3)
const commonCrawlMaxRowsPerQuery = Number(process.env.RISD_GD_CC_MAX_ROWS_PER_QUERY ?? 80)
const commonCrawlPromoteLimit = Number(process.env.RISD_GD_CC_PROMOTE_LIMIT ?? 8)
const commonCrawlIngestLimit = Number(process.env.RISD_GD_CC_INGEST_LIMIT ?? 8)
const facultyProfileIngestLimit = Number(process.env.RISD_GD_FACULTY_PROFILE_INGEST_LIMIT ?? 40)
const searchImportPath = process.env.RISD_GD_SEARCH_IMPORTS ?? join(outDir, 'search_imports.jsonl')
const risdGraphicDesignFacultyUrl = 'https://www.risd.edu/academics/graphic-design/faculty'

const seeds = [
  {
    source_id: 'src_risd_bfa_program',
    url: 'https://www.risd.edu/academics/graphic-design/bachelors-program',
    source_type: 'official_program_page',
    authority: 'official_risd',
    confidence: 'C',
    notes: 'Official RISD Graphic Design BFA program page.',
  },
  {
    source_id: 'src_risd_mfa_program',
    url: 'https://www.risd.edu/academics/graphic-design/masters-programs',
    source_type: 'official_program_page',
    authority: 'official_risd',
    confidence: 'C',
    notes: 'Official RISD Graphic Design MFA program page.',
  },
  {
    source_id: 'src_risd_graphic_design_courses',
    url: 'https://www.risd.edu/academics/graphic-design/courses',
    source_type: 'official_course_index',
    authority: 'official_risd',
    confidence: 'C',
    notes: 'Official RISD Graphic Design courses page.',
  },
  {
    source_id: 'src_risd_coursedog_bfa_graphic_design',
    url: 'https://risd.coursedog.com/programs/cfa6776e92151000bceb55330dc80000',
    source_type: 'official_catalog_program',
    authority: 'official_risd_coursedog',
    confidence: 'C',
    notes: 'RISD Coursedog BFA Graphic Design catalog record.',
  },
  {
    source_id: 'src_risd_syllabus_guidance',
    url: 'https://teachingandlearninglab.risd.edu/teaching-support/syllabus-and-course-design',
    source_type: 'official_syllabus_guidance',
    authority: 'official_risd',
    confidence: 'B',
    notes: 'RISD Teaching & Learning Lab syllabus and course design guidance.',
  },
  {
    source_id: 'src_adam_fein_intro_graphic_design_2021_pdf',
    url: 'https://ajfein.squarespace.com/s/AdamFein_IntroToGraphicDesign.pdf',
    source_type: 'syllabus_pdf',
    authority: 'public_faculty_course_artifact',
    confidence: 'A',
    course_code: 'GRAPH-W336-01',
    course_title: 'Introduction to Graphic Design',
    term: 'Wintersession 2021',
    instructor: 'Adam Fein',
    notes: 'Public RISD syllabus PDF hosted on instructor site.',
  },
  {
    source_id: 'src_john_caserta_design_studio_1_2016',
    url: 'https://johncaserta.com/ds1-2016.html',
    source_type: 'course_site',
    authority: 'public_faculty_course_artifact',
    confidence: 'A',
    course_title: 'Design Studio 1',
    term: '2016',
    instructor: 'John Caserta',
    notes: 'Public class page for RISD Design Studio 1.',
  },
  {
    source_id: 'src_ds1618_design_studio_archive',
    url: 'https://ds1618.risd.gd/',
    source_type: 'course_site',
    authority: 'public_course_archive',
    confidence: 'A',
    course_code: 'GRAPH-3210',
    course_title: 'Design Studio 1',
    term: '2016-2018',
    instructor: 'DS1 team',
    notes: 'Public RISD.gd archive for Design Studio 2016-18 with unit assignments and critique questions.',
  },
  {
    source_id: 'src_ds1618_make_book',
    url: 'https://ds1618.risd.gd/book.html',
    source_type: 'course_site',
    authority: 'public_course_archive',
    confidence: 'A',
    course_code: 'GRAPH-3210',
    course_title: 'Design Studio 1',
    term: '2016-2018',
    instructor: 'DS1 team',
    notes: 'Printable book view of the Design Studio 1 public archive.',
  },
  {
    source_id: 'src_type_two_2015_syllabus_pdf',
    url: 'https://typetwo15.risd.gd/wp-content/uploads/2015/02/Type-2-Syllabus.pdf',
    source_type: 'syllabus_pdf',
    authority: 'public_course_artifact',
    confidence: 'A',
    course_title: 'Type Two',
    term: '2015',
    instructor: null,
    notes: 'Public RISD Graphic Design Type Two syllabus PDF.',
  },
  {
    source_id: 'src_typography_iii_syllabus',
    url: 'https://type.practise.studio/syllabus/',
    source_type: 'syllabus_html',
    authority: 'public_course_artifact',
    confidence: 'A',
    course_title: 'Typography III',
    term: null,
    instructor: null,
    notes: 'Public Typography III syllabus site for RISD Graphic Design.',
  },
  {
    source_id: 'src_web_type_2022_syllabus',
    url: 'https://webtype.htmlkitchen.net/syllabus/',
    source_type: 'syllabus_html',
    authority: 'public_course_artifact',
    confidence: 'A',
    course_code: 'GRAPH-2313-01',
    course_title: 'Web Type',
    term: 'Spring 2022',
    instructor: 'Marie Otsuka',
    notes: 'Public Web Type syllabus site.',
  },
  {
    source_id: 'src_sp19_risd_gd_web',
    url: 'https://sp19.risd.gd/electives/graphic-design-for-the-web',
    source_type: 'course_site',
    authority: 'public_course_index',
    confidence: 'B',
    course_title: 'Graphic Design for the Web',
    term: 'Spring 2019',
    instructor: null,
    notes: 'Public RISD GD 2019 elective page linking course website and previous syllabus.',
  },
  {
    source_id: 'src_john_caserta_student_work',
    url: 'https://johncaserta.com/studentwork.html',
    source_type: 'student_work_archive',
    authority: 'public_faculty_student_work_archive',
    confidence: 'D',
    course_title: null,
    notes: 'Public faculty archive of RISD student work and course websites.',
  },
  {
    source_id: 'src_risd_in_motion_news',
    url: 'https://www.risd.edu/news/stories/risd-students-use-video-and-animation-techniques-bring-graphics-life',
    source_type: 'official_student_work_story',
    authority: 'official_risd',
    confidence: 'D',
    course_title: 'In Motion: Design for Video and Animation',
    notes: 'RISD story describing a Graphic Design studio and student outputs.',
  },
]

const searchQueries = [
  'site:risd.edu "Graphic Design" "syllabus" filetype:pdf',
  'site:risd.edu "GRAPH" "syllabus" filetype:pdf',
  'site:risd.edu "Typography" "syllabus" "RISD"',
  'site:digitalcommons.risd.edu "Graphic Design" "syllabus"',
  'site:coursedog.com "RISD" "GRAPH"',
  'site:johncaserta.com "RISD" "Graphic Design"',
  'site:*.squarespace.com "RISD" "Graphic Design" "syllabus"',
  'site:docs.google.com "RISD" "Graphic Design" "syllabus"',
  '"RISD" "Graphic Design" "assignment" "critique"',
  '"RISD" "Design Studio" "syllabus"',
  '"RISD" "Typography" "assignment" "Graphic Design"',
  '"RISD" "GRAPH-W" "syllabus"',
  '"RISD" "GRAPH-" "project"',
  '"RISD Graphic Design" "student work"',
  'site:behance.net "RISD" "Graphic Design" "Typography"',
  'site:github.com "RISD" "Graphic Design"',
  'site:vimeo.com "RISD" "Graphic Design" "motion"',
  'site:reddit.com/r/risd "graphic design"',
]

const searchDiscoveredSources = [
  {
    source_id: 'src_designandpolitics_2022_syllabus',
    url: 'https://designandpolitics.risd.gd/2022/02/18/syllabus.html',
    source_type: 'syllabus_html',
    authority: 'public_course_artifact',
    confidence: 'A',
    course_title: 'Design & Politics',
    term: 'Spring 2022',
    discovery_query: 'site:risd.gd syllabus RISD Graphic Design GRAPH',
    discovery_rank: 4,
    notes: 'Public RISD.gd Design & Politics syllabus with schedule.',
  },
  {
    source_id: 'src_grad_type_1_2014_syllabus_pdf',
    url: 'https://gradtype14.risd.gd/wp-content/uploads/2014/09/2014-GradType-Syllabus.pdf',
    source_type: 'syllabus_pdf',
    authority: 'public_course_artifact',
    confidence: 'A',
    course_title: 'Grad Type 1',
    term: 'Fall 2014',
    discovery_query: 'site:risd.gd "Typography" "RISD" "syllabus"',
    discovery_rank: 7,
    notes: 'Public RISD graduate typography syllabus PDF.',
  },
  {
    source_id: 'src_wp15_week_1_concrete_forms',
    url: 'https://wp15.risd.gd/category/outline/week-1-concrete-forms/',
    source_type: 'assignment_page',
    authority: 'public_course_artifact',
    confidence: 'B',
    course_title: 'Web Programming',
    term: '2015',
    discovery_query: 'site:risd.gd "GRAPH" "assignment" RISD',
    discovery_rank: 6,
    notes: 'Public RISD Web Programming assignment outline page.',
  },
  {
    source_id: 'src_sp19_design_for_publishing',
    url: 'https://sp19.risd.gd/electives/design-for-publishing',
    source_type: 'course_site',
    authority: 'public_course_index',
    confidence: 'B',
    course_title: 'Design for Publishing',
    term: 'Spring 2019',
    discovery_query: 'site:risd.gd RISD "Graphic Design" "syllabus"',
    discovery_rank: 8,
    notes: 'Public RISD GD 2019 elective page.',
  },
  {
    source_id: 'src_sp19_typography_for_nonmajors',
    url: 'https://sp19.risd.gd/electives/typography-for-nonmajors',
    source_type: 'course_site',
    authority: 'public_course_index',
    confidence: 'B',
    course_title: 'Typography for Nonmajors',
    term: 'Spring 2019',
    discovery_query: 'site:risd.gd RISD "Graphic Design" "syllabus"',
    discovery_rank: 9,
    notes: 'Public RISD GD 2019 elective page.',
  },
  {
    source_id: 'src_sp19_newly_formed',
    url: 'https://sp19.risd.gd/electives/newly-formed',
    source_type: 'course_site',
    authority: 'public_course_index',
    confidence: 'B',
    course_title: 'Newly Formed',
    term: 'Spring 2019',
    discovery_query: 'site:risd.gd RISD "Graphic Design" "syllabus"',
    discovery_rank: 10,
    notes: 'Public RISD GD 2019 elective page.',
  },
  {
    source_id: 'src_sp19_time_sequence_sound',
    url: 'https://sp19.risd.gd/electives/time-sequence-sound',
    source_type: 'course_site',
    authority: 'public_course_index',
    confidence: 'B',
    course_title: 'Time, Sequence, & Sound',
    term: 'Spring 2019',
    discovery_query: 'site:risd.gd RISD "Graphic Design" "syllabus"',
    discovery_rank: 13,
    notes: 'Public RISD GD 2019 elective page.',
  },
  {
    source_id: 'src_sp19_mapping_information',
    url: 'https://sp19.risd.gd/electives/mapping-information-2',
    source_type: 'course_site',
    authority: 'public_course_index',
    confidence: 'B',
    course_title: 'Mapping Information',
    term: 'Spring 2019',
    discovery_query: 'site:risd.gd RISD "Graphic Design" "syllabus"',
    discovery_rank: 14,
    notes: 'Public RISD GD 2019 elective page.',
  },
  {
    source_id: 'src_sp19_reframing_the_poster',
    url: 'https://sp19.risd.gd/electives/reframing-the-poster',
    source_type: 'course_site',
    authority: 'public_course_index',
    confidence: 'B',
    course_title: 'Reframing the Poster',
    term: 'Spring 2019',
    discovery_query: 'site:risd.gd RISD "Graphic Design" "syllabus"',
    discovery_rank: 15,
    notes: 'Public RISD GD 2019 elective page.',
  },
  {
    source_id: 'src_sp19_type_design',
    url: 'https://sp19.risd.gd/electives/type-design',
    source_type: 'course_site',
    authority: 'public_course_index',
    confidence: 'B',
    course_title: 'Type Design',
    term: 'Spring 2019',
    discovery_query: 'site:risd.gd RISD "Graphic Design" "syllabus"',
    discovery_rank: 16,
    notes: 'Public RISD GD 2019 elective page.',
  },
]

const sourceTypeRank = {
  syllabus_pdf: 1,
  syllabus_html: 1,
  assignment_page: 2,
  schedule_page: 2,
  reading_page: 2,
  course_site: 2,
  official_syllabus_guidance: 3,
  official_course_index: 4,
  official_program_page: 5,
  official_catalog_program: 6,
  official_student_work_story: 7,
  wayback_capture: 8,
}

function buildSearchResults() {
  return searchDiscoveredSources.map((source) => ({
    query: source.discovery_query,
    rank: source.discovery_rank,
    title: source.course_title,
    snippet: source.notes,
    url: source.url,
    promoted_source_id: source.source_id,
    discovered_at: retrievedAt,
    status: 'promoted_to_seed',
  }))
}

function buildSearchCandidates(importedCandidates = [], promotedImported = []) {
  const promotedByUrl = new Map(promotedImported.map((source) => [canonicalUrl(source.url), source.source_id]))
  const rows = []
  for (const source of searchDiscoveredSources) {
    rows.push({
      candidate_id: `search_${source.source_id.replace(/^src_/, '')}`,
      query: source.discovery_query,
      rank: source.discovery_rank,
      title: source.course_title,
      snippet: source.notes,
      url: source.url,
      discovered_at: retrievedAt,
      source: 'curated_search_seed',
      status: 'promoted_to_seed',
      promoted_source_id: source.source_id,
    })
  }
  for (const [index, query] of searchQueries.entries()) {
    rows.push({
      candidate_id: `query_backlog_${String(index + 1).padStart(2, '0')}`,
      query,
      rank: null,
      title: null,
      snippet: null,
      url: null,
      discovered_at: retrievedAt,
      source: 'query_backlog',
      status: 'pending_search_export_or_api',
      promoted_source_id: null,
    })
  }
  for (const candidate of importedCandidates) {
    const promotedSourceId = promotedByUrl.get(canonicalUrl(candidate.url)) ?? null
    rows.push({
      ...candidate,
      status: promotedSourceId ? 'promoted_after_public_fetch' : candidate.status,
      promoted_source_id: promotedSourceId,
    })
  }
  const seen = new Set()
  return rows.filter((row) => {
    const key = row.url ? `${row.source}:${canonicalUrl(row.url)}` : row.candidate_id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const commonCrawlQueries = [
  { query_id: 'risd_gd_all', url_pattern: '*.risd.gd/*', domain: 'risd.gd' },
  { query_id: 'risd_edu_graphic_design', url_pattern: 'www.risd.edu/academics/graphic-design/*', domain: 'risd.edu' },
  { query_id: 'john_caserta_teaching', url_pattern: 'johncaserta.com/teaching*', domain: 'johncaserta.com' },
  { query_id: 'webtype_course_site', url_pattern: 'webtype.htmlkitchen.net/*', domain: 'webtype.htmlkitchen.net' },
]

async function commonCrawlIndexes() {
  const fetched = await fetchWithRetry('https://index.commoncrawl.org/collinfo.json', 2)
  if (!fetched.ok) throw new Error(`Common Crawl index list returned ${fetched.status}`)
  const indexes = JSON.parse(fetched.buffer.toString('utf8'))
  return indexes
    .map((index) => ({ ...index, cdx_api: index.cdx_api ?? index['cdx-api'] }))
    .filter((index) => index.id && index.cdx_api)
    .sort((a, b) => String(b.id).localeCompare(String(a.id)))
    .slice(0, commonCrawlMaxIndexes)
}

async function queryCommonCrawlIndex(index, query) {
  const endpoint = new URL(index.cdx_api)
  endpoint.searchParams.set('url', query.url_pattern)
  endpoint.searchParams.set('output', 'json')
  endpoint.searchParams.set('fl', 'url,timestamp,status,mime,digest,length')
  endpoint.searchParams.set('filter', 'status:200')
  endpoint.searchParams.set('collapse', 'urlkey')
  endpoint.searchParams.set('limit', String(commonCrawlMaxRowsPerQuery))
  try {
    const fetched = await fetchWithRetry(endpoint.toString(), 2)
    if (!fetched.ok) {
      return [{
        query,
        index,
        error: `http_${fetched.status}`,
      }]
    }
    const raw = fetched.buffer.toString('utf8').trim()
    if (!raw) return []
    return raw.split('\n').filter(Boolean).map((line) => ({ query, index, row: JSON.parse(line) }))
  } catch (error) {
    return [{
      query,
      index,
      error: error.message,
    }]
  }
}

function scoreCommonCrawlUrl(url, mime = '') {
  const lower = url.toLowerCase()
  let score = 0
  if (/syllabus|course|class|studio|workshop/.test(lower)) score += 4
  if (/assignment|project|exercise|prompt|critique|schedule|week-\d+/.test(lower)) score += 5
  if (/reading|resource|bibliography|reference/.test(lower)) score += 2
  if (/student|work|archive|gallery/.test(lower)) score += 2
  if (/graphic|design|typography|type|web|motion|poster|publication/.test(lower)) score += 3
  if (lower.endsWith('.pdf') || /pdf/.test(mime)) score += 2
  if (/wp-login|login|admin|feed|comments|tag|author|wp-json|xmlrpc/.test(lower)) score -= 6
  return score
}

function normalizeCommonCrawlCandidate(result, index) {
  const { query, row, error } = result
  if (error) {
    return {
      candidate_id: `cc_${query.query_id}_${slug(result.index.id)}_${String(index + 1).padStart(3, '0')}`,
      query_id: query.query_id,
      url_pattern: query.url_pattern,
      index_id: result.index.id,
      index_name: result.index.name ?? null,
      discovered_at: retrievedAt,
      url: null,
      timestamp: null,
      status_code: null,
      mime: null,
      digest: null,
      length: null,
      source_type_hint: null,
      relevance_score: 0,
      candidate_status: 'query_failed',
      error,
    }
  }
  const url = canonicalUrl(row.url)
  const sourceType = classifyLinkedSource(url, '') ?? 'course_site'
  const relevanceScore = scoreCommonCrawlUrl(url, row.mime ?? '')
  return {
    candidate_id: `cc_${query.query_id}_${slug(result.index.id)}_${sha256(Buffer.from(url)).slice(0, 10)}`,
    query_id: query.query_id,
    url_pattern: query.url_pattern,
    index_id: result.index.id,
    index_name: result.index.name ?? null,
    discovered_at: retrievedAt,
    url,
    timestamp: row.timestamp ?? null,
    status_code: row.status ? Number(row.status) : null,
    mime: row.mime ?? null,
    digest: row.digest ?? null,
    length: row.length ? Number(row.length) : null,
    source_type_hint: sourceType,
    relevance_score: relevanceScore,
    candidate_status: relevanceScore >= 4 ? 'candidate_for_public_fetch' : 'low_relevance_archival_hit',
    error: null,
  }
}

async function buildCommonCrawlCandidates() {
  const indexes = await commonCrawlIndexes()
  const rawResults = []
  for (const index of indexes) {
    for (const query of commonCrawlQueries) {
      console.error(`common crawl ${index.id}: ${query.url_pattern}`)
      rawResults.push(...await queryCommonCrawlIndex(index, query))
    }
  }
  const rows = rawResults.map(normalizeCommonCrawlCandidate)
  const byUrl = new Map()
  const failures = []
  for (const row of rows) {
    if (!row.url) {
      failures.push(row)
      continue
    }
    const existing = byUrl.get(row.url)
    if (!existing || row.relevance_score > existing.relevance_score || String(row.timestamp ?? '').localeCompare(String(existing.timestamp ?? '')) > 0) {
      byUrl.set(row.url, row)
    }
  }
  return [...byUrl.values(), ...failures].sort((a, b) => b.relevance_score - a.relevance_score || String(a.url ?? '').localeCompare(String(b.url ?? '')))
}

async function promoteCommonCrawlCandidates() {
  const candidatesPath = join(outDir, 'common_crawl_candidates.jsonl')
  const candidates = loadJsonl(candidatesPath)
  const existingSources = loadJsonl(join(outDir, 'sources.jsonl'))
  const existingSourceUrls = new Set(existingSources.map((source) => canonicalUrl(source.url)))
  const existingPromotions = loadJsonl(join(outDir, 'common_crawl_promotions.jsonl'))
  const promotedCandidateIds = new Set(existingPromotions.map((promotion) => promotion.candidate_id))
  const selected = candidates
    .filter((candidate) => candidate.url && candidate.candidate_status === 'candidate_for_public_fetch')
    .filter((candidate) => !existingSourceUrls.has(canonicalUrl(candidate.url)))
    .filter((candidate) => !promotedCandidateIds.has(candidate.candidate_id))
    .sort((a, b) => b.relevance_score - a.relevance_score || String(b.timestamp ?? '').localeCompare(String(a.timestamp ?? '')))
    .slice(0, commonCrawlPromoteLimit)

  const newPromotions = []
  for (const [index, candidate] of selected.entries()) {
    console.error(`promote common crawl candidate ${index + 1}/${selected.length}: ${candidate.url}`)
    const seed = sourceSeedFromCommonCrawlCandidate(candidate)
    const inspected = await inspectSeed(seed)
    newPromotions.push({
      promotion_id: `promotion_${candidate.candidate_id}`,
      candidate_id: candidate.candidate_id,
      promoted_at: retrievedAt,
      promoted_source_id: inspected.source.source_id,
      url: inspected.source.url,
      source_type: inspected.source.source_type,
      authority: inspected.source.authority,
      confidence: inspected.source.confidence,
      fetch_status: inspected.source.fetch_status,
      extraction_status: inspected.source.extraction_status,
      content_type: inspected.source.content_type,
      checksum: inspected.source.checksum,
      title: inspected.source.title,
      text_length: inspected.source.text_length,
      notes: inspected.source.notes,
      error: inspected.source.error ?? null,
    })
  }

  const allPromotions = [...existingPromotions, ...newPromotions]
  const promotionByCandidateId = new Map(allPromotions.map((promotion) => [promotion.candidate_id, promotion]))
  const updatedCandidates = candidates.map((candidate) => {
    const promotion = promotionByCandidateId.get(candidate.candidate_id)
    if (!promotion) return candidate
    return {
      ...candidate,
      candidate_status: promotion.extraction_status === 'ok' ? 'promoted_after_public_fetch' : 'promotion_fetch_failed',
      promoted_source_id: promotion.promoted_source_id,
      promotion_fetch_status: promotion.fetch_status,
      promotion_extraction_status: promotion.extraction_status,
    }
  })

  writeJsonl(candidatesPath, updatedCandidates)
  writeJsonl(join(outDir, 'common_crawl_promotions.jsonl'), allPromotions)
  return { candidates: updatedCandidates, promotions: allPromotions, newPromotions }
}

function loadSearchImportCandidates(path = searchImportPath) {
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf8').trim()
  if (!raw) return []
  const parsedRows = path.endsWith('.json')
    ? JSON.parse(raw)
    : raw.split('\n').filter(Boolean).map((line) => JSON.parse(line))
  const rows = Array.isArray(parsedRows) ? parsedRows : parsedRows.results ?? []
  return rows.map(normalizeSearchCandidate).filter(Boolean)
}

function normalizeSearchCandidate(row, index) {
  const url = row.url ?? row.link
  if (!url) return null
  let canonical
  try {
    canonical = canonicalUrl(url)
  } catch {
    return null
  }
  return {
    candidate_id: row.candidate_id ?? `imported_search_${createHash('sha1').update(canonical).digest('hex').slice(0, 10)}`,
    query: row.query ?? row.search_query ?? null,
    rank: Number.isFinite(Number(row.rank ?? row.position)) ? Number(row.rank ?? row.position) : index + 1,
    title: row.title ?? null,
    snippet: row.snippet ?? row.description ?? null,
    url: canonical,
    discovered_at: row.discovered_at ?? retrievedAt,
    source: row.source ?? 'imported_search_export',
    status: 'candidate_imported',
    promoted_source_id: null,
  }
}

function sourceSeedFromSearchCandidate(candidate) {
  const sourceType = classifyLinkedSource(candidate.url, `${candidate.title ?? ''} ${candidate.snippet ?? ''}`) ?? 'course_site'
  const confidence = sourceType === 'syllabus_pdf' || sourceType === 'syllabus_html' ? 'A' : sourceType === 'student_work_archive' ? 'D' : 'B'
  return {
    source_id: sourceIdForUrl('src_search', candidate.url),
    url: candidate.url,
    source_type: sourceType,
    authority: 'imported_search_result',
    confidence,
    discovery_query: candidate.query,
    discovery_rank: candidate.rank,
    notes: `Imported search result${candidate.snippet ? `: ${candidate.snippet.slice(0, 240)}` : '.'}`,
  }
}

function sourceSeedFromCommonCrawlCandidate(candidate) {
  const sourceType = candidate.source_type_hint ?? classifyLinkedSource(candidate.url, '') ?? 'course_site'
  const confidence = sourceType === 'syllabus_pdf' || sourceType === 'syllabus_html'
    ? 'A'
    : sourceType === 'assignment_page' || sourceType === 'schedule_page'
      ? 'B'
      : sourceType === 'student_work_archive'
        ? 'D'
        : 'C'
  return {
    source_id: sourceIdForUrl('src_cc', candidate.url),
    url: candidate.url,
    source_type: sourceType,
    authority: 'common_crawl_candidate',
    confidence,
    discovery_query: candidate.url_pattern,
    discovery_rank: candidate.relevance_score,
    notes: `Promoted from Common Crawl ${candidate.index_id}${candidate.timestamp ? ` capture ${candidate.timestamp}` : ''}. Candidate ${candidate.candidate_id}.`,
  }
}

function courseTitleFromCommonCrawlUrl(url, fallbackTitle = null) {
  const lower = url.toLowerCase()
  if (lower.includes('wp15.risd.gd')) return 'Web Programming'
  if (lower.includes('designandpolitics.risd.gd')) return 'Design & Politics'
  if (lower.includes('webtype.htmlkitchen.net')) return 'Web Type'
  if (lower.includes('htmloutput.risd.gd')) return fallbackTitle ?? 'HTML Output'
  if (lower.includes('/academics/graphic-design/courses')) return 'Graphic Design Courses'
  return fallbackTitle
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''))
}

function mergeRowsByKey(existing, incoming, keyFn, mergeFn = (left, right) => ({ ...left, ...right })) {
  const byKey = new Map()
  for (const row of existing) byKey.set(keyFn(row), row)
  for (const row of incoming) {
    const key = keyFn(row)
    const current = byKey.get(key)
    byKey.set(key, current ? mergeFn(current, row) : row)
  }
  return [...byKey.values()]
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(?:br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|header|footer|li|h[1-6]|tr|table|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function titleFromHtml(html) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
}

function extractLinks(html, baseUrl) {
  const links = []
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1]
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue
    try {
      const url = new URL(href, baseUrl)
      url.hash = ''
      const label = stripHtml(match[2]).replace(/\s+/g, ' ').trim()
      links.push({ url: canonicalUrl(url.toString()), label })
    } catch {
      // Ignore malformed public links.
    }
  }
  return links
}

function canonicalUrl(url) {
  const parsed = new URL(url)
  parsed.hash = ''
  if (parsed.hostname.endsWith('risd.gd') || ['johncaserta.com', 'webtype.htmlkitchen.net'].includes(parsed.hostname)) {
    parsed.protocol = 'https:'
  }
  if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1)
  }
  return parsed.toString()
}

function classifyLinkedSource(url, label = '') {
  const combined = `${url} ${label}`.toLowerCase()
  if (combined.endsWith('.pdf') || combined.includes('/uploads/') && combined.includes('.pdf')) return 'syllabus_pdf'
  if (/\bsyllabus\b/.test(combined)) return 'syllabus_html'
  if (/\b(project|assignment|exercise|prompt|critique|outline|week-\d+)/.test(combined)) return 'assignment_page'
  if (/\b(schedule|calendar|class-\d+|week\s*\d+)/.test(combined)) return 'schedule_page'
  if (/\b(reading|resource|reference|links|bibliography)\b/.test(combined)) return 'reading_page'
  if (/\b(student|gallery|archive|work)\b/.test(combined)) return 'student_work_archive'
  return null
}

function shouldCrawlHost(url) {
  const host = new URL(url).hostname
  return host.endsWith('risd.gd') || ['johncaserta.com', 'webtype.htmlkitchen.net'].includes(host)
}

function sourceIdForUrl(prefix, url) {
  const parsed = new URL(url)
  const slug = `${parsed.hostname}${parsed.pathname}`.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 90)
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 8)
  return `${prefix}_${slug}_${hash}`
}

function lines(text) {
  return text.split(/\r?\n|(?<=\.)\s+(?=[A-Z][a-z])/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

function sentenceSnippets(text, terms, limit = 8) {
  const lowTerms = terms.map((term) => term.toLowerCase())
  const out = []
  for (const line of lines(text)) {
    const lower = line.toLowerCase()
    if (lowTerms.some((term) => lower.includes(term))) {
      out.push(line.slice(0, 700))
    }
    if (out.length >= limit) break
  }
  return out
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))]
}

function extractCourseCodes(text) {
  return uniq(text.match(/\b(?:GRAPH|GD|DS|GRAPH-W|GRAPH)\s*-?\s?[A-Z]?\d{2,4}[A-Z]?(?:-\d{2})?\b|\bGRAPH\s+\d{3,4}[A-Z](?:-\d{2})?\b/gi) ?? [])
    .map((code) => code.replace(/\s+/g, '').replace(/GRAPHW/i, 'GRAPH-W').toUpperCase())
    .filter((code) => !/^GD20\d{2}$/.test(code))
}

function extractOfficialCourseOfferings(text, sourceId) {
  const offerings = []
  const normalized = text.replace(/\r/g, '\n')
  const officialCodePattern = 'GRAPH\\s+\\d{3,4}[A-Z]?(?:-\\d{2})?'
  const blocks = normalized.split(new RegExp(`(?=\\n\\s*(?:#{1,4}\\s*)?${officialCodePattern}\\s*(?:\\n|$))`, 'i'))
  for (const block of blocks) {
    const header = block.match(new RegExp(`(?:^|\\n)\\s*(?:#{1,4}\\s*)?(${officialCodePattern})\\s*(?:\\n+)\\s*([^\\n]+?)\\s*(?:\\n+)`, 'i'))
    if (!header) continue
    const rawCode = header[1]
    const rawTitle = header[2]
    if (/^(?:-|Level|Subject|Period|Credits|Format)$/i.test(rawTitle.trim())) continue
    const level = block.match(/\bLevel\s+(Undergraduate|Graduate)\b/i)?.[1] ?? null
    const period = block.match(/\bPeriod\s+([^\n]+)/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
    const credits = block.match(/\bCredits\s+(\d+(?:\.\d+)?)\b/i)?.[1] ?? null
    const format = block.match(/\bFormat\s+([^\n]+)/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
    const instructor = block.match(/\bInstructor\(s\):\s*([^\n]+?)(?:\s+Location\(s\):|\s+Enrolled\s*\/|\n|$)/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
    const location = block.match(/\bLocation\(s\):\s*([^\n]+?)(?:\s+Enrolled\s*\/|\s+Status:|\n|$)/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
    const status = block.match(/\bStatus:\s*([A-Za-z]+)/i)?.[1] ?? null
    const startEnd = block.match(/\bStart and End\s+([^\n]+)/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
    const descriptionMatch = block.match(new RegExp(`(?:#{1,4}\\s*)?SECTION DESCRIPTION\\s+([\\s\\S]*?)(?=\\n\\s*(?:Elective|Major Requirement|Graduate Requirement|Required|## COURSE TAGS|Estimated Cost|#{1,4}\\s*${officialCodePattern}|${officialCodePattern}|$))`, 'i'))
    const cleanDescription = (descriptionMatch?.[1] ?? '').replace(/\s+/g, ' ').trim()
    const title = rawTitle.replace(/\s+/g, ' ').trim()
    if (!title || !level || !period || !credits || !format || cleanDescription.length < 20) continue
    offerings.push({
      course_id: `${rawCode}_${period}`.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      school: 'Rhode Island School of Design',
      department: 'Graphic Design',
      course_code: rawCode.replace(/\s+/, ' '),
      course_title: title,
      degree_level: level,
      credits: Number(credits),
      format,
      period,
      start_end: startEnd,
      instructor,
      location,
      status,
      description: cleanDescription,
      prerequisites: [],
      source_ids: [sourceId],
      evidence_grade: 'C',
      skills: inferSkills(cleanDescription),
    })
  }
  const unique = new Map()
  for (const offering of offerings) {
    unique.set(`${offering.course_code}_${offering.period}_${offering.start_end ?? ''}_${offering.instructor ?? ''}_${offering.location ?? ''}_${offering.status ?? ''}`, offering)
  }
  return [...unique.values()]
}

function displayedOfficialCourseCount(text) {
  return Number(text.match(/\bShowing\s+(\d+)\s+Results\b/i)?.[1] ?? 0)
}

function extractSpanFields(text, source = {}) {
  const compact = text.replace(/\s+/g, ' ').trim()
  const meeting = compact.match(/\b(?:Mondays?|Tuesdays?|Wednesdays?|Thursdays?|Fridays?|Saturdays?|Sundays?|M|T|W|Th|F)\b[^.]{0,80}?\b\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?\s*[–-]\s*\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?/i)?.[0] ?? null
  const credits = compact.match(/\b(\d+(?:\.\d+)?)\s+credits?\b/i)?.[1] ?? null
  const location = compact.match(/\b(?:Design Center|DC)\s*,?\s*(?:Room\s*)?\d{2,4}\b/i)?.[0] ?? null
  const officeHours = compact.match(/\bOffice Hours?:?\s*[^.]{0,160}/i)?.[0] ?? null
  const instructor = source.instructor ?? compact.match(/\bInstructor(?:\(s\))?:?\s*([A-Z][A-Za-z.' -]+(?:,\s*[A-Z][A-Za-z.' -]+)*)/)?.[1]?.trim() ?? null
  const code = source.course_code ?? extractCourseCodes(text)[0] ?? null
  const title = source.course_title ?? titleFromSyllabusText(text)
  const date = source.term ?? compact.match(/\b(?:Fall|Spring|Wintersession|Winter|Summer)\s+20\d{2}\b/i)?.[0] ?? compact.match(/\b20\d{2}(?:[–-]\d{2,4})?\b/)?.[0] ?? null
  return {
    title,
    code,
    section: code?.match(/-(\d{2})$/)?.[1] ?? null,
    date,
    class_days: meeting,
    class_time: meeting,
    class_location: location,
    instructor,
    office_hours: officeHours,
    credits: credits ? Number(credits) : null,
    description: extractSection(text, ['course description', 'overview'], ['course objectives', 'learning objectives', 'goals', 'schedule', 'projects', 'grading']),
    learning_outcomes: extractBulletsAfter(text, ['learning objectives', 'course objectives', 'course goals'], ['grading', 'schedule', 'projects', 'assignments']),
    grading_rubric: extractSection(text, ['grading', 'evaluation critera', 'evaluation criteria'], ['attendance', 'policies', 'schedule', 'projects']),
    assessment_strategy: extractSection(text, ['assessment', 'evaluation', 'grading'], ['attendance', 'policies', 'schedule']),
    topic_outline: extractScheduleRows(text).map((row) => row.topic).filter(Boolean).slice(0, 30),
    assignment_schedule: extractScheduleRows(text).slice(0, 80),
  }
}

function titleFromSyllabusText(text) {
  const candidates = lines(text).slice(0, 12)
  return candidates.find((line) => /\b(?:Typography|Graphic Design|Design Studio|Web Type|Type)\b/i.test(line) && line.length < 120) ?? null
}

function extractSection(text, starts, ends) {
  const normalized = text.replace(/\r/g, '')
  for (const start of starts) {
    const startRe = new RegExp(`(?:^|\\n)\\s*(?:#{1,3}\\s*)?${escapeRegExp(start)}\\s*:?\\s*`, 'i')
    const match = startRe.exec(normalized)
    if (!match) continue
    const rest = normalized.slice(match.index + match[0].length)
    let endIndex = rest.length
    for (const end of ends) {
      const endRe = new RegExp(`\\n\\s*(?:#{1,3}\\s*)?${escapeRegExp(end)}\\s*:?\\s*`, 'i')
      const endMatch = endRe.exec(rest)
      if (endMatch) endIndex = Math.min(endIndex, endMatch.index)
    }
    return rest.slice(0, endIndex).replace(/\s+/g, ' ').trim().slice(0, 2000) || null
  }
  return null
}

function extractBulletsAfter(text, starts, ends) {
  const section = extractSection(text, starts, ends)
  if (!section) return []
  return uniq(section.split(/(?:\s*[•*-]\s+|\.\s+(?=[A-Z]))/).map((item) => item.trim()).filter((item) => item.length > 12)).slice(0, 20)
}

function extractScheduleRows(text) {
  const out = []
  const normalized = text.replace(/\r/g, '\n')
  const rowPattern = /\b((?:Mon|Tues|Tue|Weds|Wed|Thurs|Thu|Fri|Sat|Sun)[a-z]*,?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2})\b([^]*?)(?=\b(?:Mon|Tues|Tue|Weds|Wed|Thurs|Thu|Fri|Sat|Sun)[a-z]*,?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}\b|$)/gi
  let match
  while ((match = rowPattern.exec(normalized))) {
    const body = match[2].replace(/\s+/g, ' ').trim()
    out.push({
      date: match[1].replace(/\s+/g, ' ').trim(),
      topic: body.slice(0, 260),
      assignment_or_reading: body.match(/\b(?:Project|Exercise|Reading|Due|Critique|Discussion|Lecture)[^.]*/i)?.[0]?.slice(0, 260) ?? null,
    })
  }
  return out
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractLikelyReadings(text) {
  const readings = []
  const patterns = [
    /(?:required|recommended)?\s*(?:readings?|texts?|books?)[:\s]+([^.\n]{12,220})/gi,
    /\b(?:Lupton|Bringhurst|M[üu]ller-Brockmann|Berger|Albers|Meggs|Munari|Hara|Drucker|Tufte|Norman|McLuhan|Bierut)\b[^.\n]{0,180}/gi,
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text))) {
      readings.push(match[1] ? match[1].trim() : match[0].trim())
    }
  }
  return uniq(readings).slice(0, 40)
}

function extractAssignments(text) {
  const assignmentTerms = ['assignment', 'project', 'exercise', 'critique', 'deliverable', 'final', 'portfolio', 'presentation']
  return sentenceSnippets(text, assignmentTerms, 30)
}

function inferSkills(text) {
  const checks = [
    ['typography', ['typography', 'type', 'letterform', 'typesetting']],
    ['publication design', ['book', 'publication', 'magazine', 'editorial']],
    ['identity systems', ['identity', 'branding', 'logo']],
    ['motion design', ['motion', 'animation', 'after effects', 'video']],
    ['interaction design', ['website', 'web', 'ux', 'interface', 'interactive']],
    ['critique and revision', ['critique', 'crit', 'revision', 'feedback']],
    ['research methods', ['research', 'analysis', 'methodolog']],
    ['image making', ['image', 'photography', 'illustration']],
  ]
  const lower = text.toLowerCase()
  return checks.filter(([, terms]) => terms.some((term) => lower.includes(term))).map(([skill]) => skill)
}

async function fetchWithTimeout(url, timeoutMs = 25000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'alpha-research-risd-corpus/0.1 (+public research corpus; contact repository owner)',
        accept: '*/*',
      },
    })
    const arrayBuffer = await response.arrayBuffer()
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      finalUrl: response.url,
      buffer: Buffer.from(arrayBuffer),
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetchWithTimeout(url)
    } catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(750 * attempt)
    }
  }
  throw lastError
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pdfText(buffer, sourceId) {
  const temp = mkdtempSync(join(tmpdir(), 'risd-pdf-'))
  try {
    const pdfPath = join(temp, `${sourceId}.pdf`)
    const txtPath = join(temp, `${sourceId}.txt`)
    writeFileSync(pdfPath, buffer)
    execFileSync('pdftotext', ['-layout', pdfPath, txtPath], { stdio: 'ignore' })
    return readFileSync(txtPath, 'utf8').replace(/\s+\n/g, '\n').trim()
  } catch {
    return ''
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

async function inspectSeed(seed) {
  const base = {
    ...seed,
    retrieved_at: retrievedAt,
    access: 'public_web',
    fetch_status: null,
    content_type: null,
    checksum: null,
    title: null,
    text_length: 0,
    extraction_status: 'pending',
  }

  try {
    const fetched = await fetchWithRetry(seed.url)
    const isPdf = fetched.contentType.includes('pdf') || seed.url.toLowerCase().endsWith('.pdf')
    const html = isPdf ? '' : fetched.buffer.toString('utf8')
    const text = isPdf ? pdfText(fetched.buffer, seed.source_id) : stripHtml(html)
    return {
      source: {
        ...base,
        url: fetched.finalUrl || seed.url,
        fetch_status: fetched.status,
        content_type: fetched.contentType,
        checksum: sha256(fetched.buffer),
        title: isPdf ? seed.course_title ?? basename(seed.url) : titleFromHtml(fetched.buffer.toString('utf8')),
        text_length: text.length,
        extraction_status: text.length ? 'ok' : 'empty_text',
      },
      text,
      links: isPdf ? [] : extractLinks(html, fetched.finalUrl || seed.url),
    }
  } catch (error) {
    return {
      source: {
        ...base,
        extraction_status: 'fetch_error',
        error: error.message,
      },
      text: '',
      links: [],
    }
  }
}

async function inspectOfficialCoursePage(page) {
  const url = `https://www.risd.edu/academics/graphic-design/courses?page=${page}`
  const seed = {
    source_id: page === 0 ? 'src_risd_graphic_design_courses_page_0' : `src_risd_graphic_design_courses_page_${page}`,
    url,
    source_type: 'official_course_index',
    authority: 'official_risd',
    confidence: 'C',
    notes: `Official RISD Graphic Design courses page ${page + 1}.`,
  }
  return inspectSeed(seed)
}

function discoverCrawlSeeds(inspected) {
  const discovered = []
  const seen = new Set([...seeds, ...searchDiscoveredSources].map((source) => canonicalUrl(source.url)))
  const perHost = new Map()
  const crawlableSources = inspected.filter(({ source, links }) => source.extraction_status === 'ok' && links?.length && shouldCrawlHost(source.url))
  for (const item of crawlableSources) {
    const baseHost = new URL(item.source.url).hostname
    for (const link of item.links) {
      let parsed
      try {
        parsed = new URL(link.url)
      } catch {
        continue
      }
      if (parsed.hostname !== baseHost) continue
      if (!['http:', 'https:'].includes(parsed.protocol)) continue
      if (seen.has(link.url)) continue
      const linkedType = classifyLinkedSource(link.url, link.label)
      if (!linkedType) continue
      const count = perHost.get(baseHost) ?? 0
      if (count >= crawlMaxLinksPerHost) continue
      perHost.set(baseHost, count + 1)
      seen.add(link.url)
      discovered.push({
        source_id: sourceIdForUrl('src_crawl', link.url),
        url: link.url,
        source_type: linkedType,
        authority: 'public_course_site_link',
        confidence: linkedType === 'syllabus_pdf' || linkedType === 'syllabus_html' ? 'A' : 'B',
        course_title: item.source.course_title ?? null,
        term: item.source.term ?? null,
        instructor: item.source.instructor ?? null,
        parent_source_id: item.source.source_id,
        crawl_depth: 1,
        link_label: link.label,
        notes: `Discovered from ${item.source.source_id}.`,
      })
    }
  }
  return discovered
}

async function waybackCaptures(url) {
  const urls = [url]
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:') {
      parsed.protocol = 'http:'
      urls.push(parsed.toString())
    }
  } catch {
    // Keep the original URL-only lookup when URL parsing fails.
  }
  for (const candidate of urls) {
    const api = `https://web.archive.org/cdx?url=${encodeURIComponent(candidate)}&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&collapse=digest&limit=5`
    try {
      const response = await fetchWithTimeout(api, 20000)
      if (!response.ok) continue
      const rows = JSON.parse(response.buffer.toString('utf8'))
      if (!Array.isArray(rows) || rows.length < 2) continue
      return rows.slice(1).map(([timestamp, original, statuscode, mimetype, digest]) => ({
        timestamp,
        original,
        statuscode,
        mimetype,
        digest,
        memento_url: `https://web.archive.org/web/${timestamp}id_/${original}`,
        replay_url: `https://web.archive.org/web/${timestamp}/${original}`,
      }))
    } catch {
      continue
    }
  }
  return []
}

async function inspectWaybackFallbacks(inspected, wayback) {
  const recovered = []
  const capturesBySource = new Map()
  for (const capture of wayback) {
    const existing = capturesBySource.get(capture.source_id) ?? []
    existing.push(capture)
    capturesBySource.set(capture.source_id, existing)
  }
  const failedSources = inspected
    .map(({ source }) => source)
    .filter((source) => source.extraction_status !== 'ok' && capturesBySource.has(source.source_id))

  for (const [index, source] of failedSources.entries()) {
    const captures = capturesBySource.get(source.source_id).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    console.error(`inspect wayback fallback ${index + 1}/${failedSources.length}: ${source.source_id}`)
    let recoveredSource = null
    for (const capture of captures.slice(0, 5)) {
      const urls = uniq([capture.memento_url, capture.replay_url])
      for (const [urlIndex, url] of urls.entries()) {
        const inspected = await inspectSeed({
          source_id: `src_wayback_${source.source_id.replace(/^src_/, '')}_${capture.timestamp}${urlIndex ? `_replay_${urlIndex + 1}` : ''}`,
          url,
          source_type: 'wayback_capture',
          authority: 'internet_archive',
          confidence: source.confidence,
          course_code: source.course_code ?? null,
          course_title: source.course_title ?? null,
          term: source.term ?? null,
          instructor: source.instructor ?? null,
          parent_source_id: source.source_id,
          original_url: source.url,
          archive_timestamp: capture.timestamp,
          notes: `Internet Archive fallback for failed source ${source.source_id}.`,
        })
        if (inspected.source.extraction_status === 'ok') {
          recoveredSource = inspected
          break
        }
      }
      if (recoveredSource) break
    }
    if (recoveredSource) recovered.push(recoveredSource)
  }
  return recovered
}

function buildCourses(inspected) {
  const byKey = new Map()
  for (const item of inspected) {
    const { source, text } = item
    if (source.extraction_status !== 'ok' || !text) continue
    if (source.source_type === 'official_course_index') {
      for (const offering of extractOfficialCourseOfferings(text, source.source_id)) {
        byKey.set(offering.course_id, offering)
      }
    }
    const seedTitle = source.course_title
    const codes = extractCourseCodes(text)
    const titles = uniq([
      seedTitle,
      ...sentenceSnippets(text, ['Typography', 'Design Studio', 'Graphic Design', 'In Motion', 'Introduction to'], 20)
        .map((snippet) => snippet.match(/\b(?:Introduction to Graphic Design|Design Studio [1234]|Typography\s*[IVX]*|In Motion: Design for Video and Animation)\b/i)?.[0]),
    ])

    if (seedTitle || codes.length) {
      const detectedCode = source.course_code ?? codes[0] ?? null
      const key = normalizeCourseKey(detectedCode, seedTitle ?? titles[0] ?? source.source_id)
      const existing = byKey.get(key) ?? {
        course_id: key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
        school: 'Rhode Island School of Design',
        department: 'Graphic Design',
        course_code: detectedCode,
        course_title: seedTitle ?? titles[0] ?? null,
        degree_level: source.url.includes('masters') ? 'MFA' : source.url.includes('bachelors') ? 'BFA' : 'unknown',
        credits: null,
        prerequisites: [],
        source_ids: [],
        evidence_grade: source.confidence,
        skills: [],
      }
      existing.source_ids = uniq([...existing.source_ids, source.source_id])
      existing.skills = uniq([...existing.skills, ...inferSkills(text)])
      if (!existing.course_title && titles[0]) existing.course_title = titles[0]
      byKey.set(key, existing)
    }
  }
  return [...byKey.values()].sort((a, b) => (a.course_title ?? '').localeCompare(b.course_title ?? ''))
}

function normalizeCourseKey(code, title) {
  if (code) return code.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function buildSyllabi(inspected) {
  return inspected
    .filter(({ source, text }) => source.extraction_status === 'ok' && text && ['syllabus_pdf', 'syllabus_html', 'course_site', 'assignment_page', 'schedule_page', 'reading_page', 'wayback_capture'].includes(source.source_type))
    .map(({ source, text }) => {
      const spans = extractSpanFields(text, source)
      const term = source.term ?? spans.date ?? null
      const { semester, year } = splitTerm(term)
      const readings = extractLikelyReadings(text)
      const tools = inferTools(text)
      const materials = inferMaterials(text)
      return {
        syllabus_id: `syl_${source.source_id.replace(/^src_/, '')}`,
        course_code: source.course_code ?? spans.code ?? extractCourseCodes(text)[0] ?? null,
        course_title: source.course_title ?? spans.title ?? null,
        section: spans.section,
        term,
        year,
        semester,
        instructor: source.instructor ?? spans.instructor,
        class_days: spans.class_days,
        class_time: spans.class_time,
        class_location: spans.class_location,
        office_hours: spans.office_hours,
        credits: spans.credits,
        description: spans.description,
        learning_outcomes: spans.learning_outcomes,
        required_readings: readings.filter((reading) => !/recommended/i.test(reading)),
        recommended_readings: readings.filter((reading) => /recommended/i.test(reading)),
        grading_rubric: spans.grading_rubric,
        assessment_strategy: spans.assessment_strategy,
        topic_outline: spans.topic_outline,
        assignment_schedule: spans.assignment_schedule,
        policies: extractPolicies(text),
        tools,
        materials,
        raw_excerpts: buildRawExcerpts(text, spans),
        evidence_grade: source.confidence,
        source_ids: [source.source_id],
        spans,
        meeting_pattern: sentenceSnippets(text, ['Mon', 'Tues', 'Wed', 'Thurs', 'Friday', 'Office Hours'], 5),
        platforms: tools,
        readings,
        assignments: extractAssignments(text),
        weekly_schedule_evidence: sentenceSnippets(text, ['week', 'class', 'session', 'schedule'], 20),
        grading_evidence: sentenceSnippets(text, ['grade', 'grading', 'attendance', 'participation', 'evaluation'], 12),
      }
    })
}

function splitTerm(term) {
  if (!term) return { semester: null, year: null }
  const semester = term.match(/\b(Fall|Spring|Wintersession|Winter|Summer)\b/i)?.[1] ?? null
  const year = term.match(/\b(19|20)\d{2}\b/)?.[0] ?? null
  return {
    semester: semester ? semester[0].toUpperCase() + semester.slice(1).toLowerCase() : null,
    year: year ? Number(year) : null,
  }
}

function inferTools(text) {
  const lower = text.toLowerCase()
  const checks = [
    ['Canvas', /\bcanvas\b/],
    ['Slack', /\bslack\b/],
    ['Zoom', /\bzoom\b/],
    ['Adobe', /\badobe\b/],
    ['Adobe Photoshop', /\bphotoshop\b/],
    ['Adobe Illustrator', /\billustrator\b/],
    ['Adobe InDesign', /\bindesign\b/],
    ['After Effects', /\bafter effects\b/],
    ['Figma', /\bfigma\b/],
    ['HTML/CSS', /\bhtml\b|\bcss\b/],
    ['JavaScript', /\bjavascript\b|\bjs\b/],
    ['Google Drive', /\bgoogle drive\b/],
    ['Keynote', /\bkeynote\b/],
  ]
  return checks.filter(([, pattern]) => pattern.test(lower)).map(([tool]) => tool)
}

function inferMaterials(text) {
  const lower = text.toLowerCase()
  const checks = [
    ['paper', /\bpaper\b|\bpapers\b/],
    ['presentation board', /\bpresentation board\b/],
    ['tracing paper', /\btracing paper\b/],
    ['sketchbook', /\bsketchbook\b/],
    ['binder', /\bbinder\b/],
    ['print output', /\bprinting\b|\bprint(?:s|ed)?\b/],
    ['photography', /\bphotography\b|\bphotos?\b|\bimages?\b/],
    ['physical studies', /\bphysical studies\b|\bmaterials provided\b/],
    ['risograph', /\brisograph\b|\briso\b/],
    ['book binding', /\bbinding\b|\bbindery\b/],
  ]
  return checks.filter(([, pattern]) => pattern.test(lower)).map(([material]) => material)
}

function extractPolicies(text) {
  return sentenceSnippets(text, ['attendance', 'absence', 'late', 'academic code', 'conduct', 'accommodation', 'policy', 'plagiarism'], 12)
}

function buildRawExcerpts(text, spans) {
  return uniq([
    spans.description,
    spans.grading_rubric,
    spans.assessment_strategy,
    ...spans.learning_outcomes.slice(0, 3),
    ...spans.topic_outline.slice(0, 3),
  ]).filter(Boolean).map((excerpt) => excerpt.slice(0, 700))
}

function buildAssignments(syllabi) {
  const rows = []
  for (const syllabus of syllabi) {
    syllabus.assignments.forEach((snippet, index) => {
      const assignmentSignals = inferAssignmentSignals(snippet)
      rows.push({
        assignment_id: `assign_${syllabus.syllabus_id}_${String(index + 1).padStart(2, '0')}`,
        course_code: syllabus.course_code,
        course_title: syllabus.course_title,
        syllabus_id: syllabus.syllabus_id,
        title: snippet.match(/\b(?:Project|Assignment|Exercise|Final)\s*[:#]?\s*([^.;]{0,80})/i)?.[0] ?? null,
        week_or_date: extractWeekOrDate(snippet),
        prompt_excerpt: snippet,
        constraints: assignmentSignals.constraints,
        deliverables: assignmentSignals.deliverables,
        materials: assignmentSignals.materials,
        tools: assignmentSignals.tools,
        assignment_type: assignmentSignals.assignment_type,
        studio_phases: assignmentSignals.studio_phases,
        critique_questions: assignmentSignals.critique_questions,
        output_format: assignmentSignals.output_format,
        evidence_limits: assignmentSignals.evidence_limits,
        critique_format: assignmentSignals.critique_format,
        revision_expectation: assignmentSignals.revision_expectation,
        skills_trained: inferSkills(snippet),
        tacit_goal: assignmentSignals.tacit_goal,
        evidence_grade: assignmentSignals.evidence_grade,
        source_ids: syllabus.source_ids,
      })
    })
  }
  return rows
}

function extractWeekOrDate(snippet) {
  return snippet.match(/\b(?:week|class|session)\s+\d+\b/i)?.[0]
    ?? snippet.match(/\b(?:Mon|Tues|Tue|Weds|Wed|Thurs|Thu|Fri|Sat|Sun)[a-z]*,?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}\b/i)?.[0]
    ?? snippet.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}\b/i)?.[0]
    ?? null
}

function inferAssignmentSignals(snippet) {
  const lower = snippet.toLowerCase()
  const deliverables = []
  const constraints = []
  const materials = []
  const tools = []
  const studioPhases = []
  const critiqueQuestions = []
  const evidenceLimits = []

  const deliverableChecks = [
    ['logo', /\blogo\b/],
    ['poster', /\bposter\b/],
    ['booklet', /\bbooklet\b/],
    ['book', /\bbook\b/],
    ['visual identity system', /\bvisual identity\b|\bidentity system\b/],
    ['catalogue', /\bcatalog(?:ue)?\b/],
    ['presentation', /\bpresentation\b|\bpresent\b/],
    ['portfolio', /\bportfolio\b/],
    ['documentation', /\bdocumentation\b|\bdocument work\b/],
    ['pdf', /\bpdf\b/],
    ['website', /\bwebsite\b|\bweb\s?page\b|\bclass site\b/],
    ['prototype', /\bprototype\b|\bmockup\b/],
    ['animation', /\banimation\b|\bmotion\b|\bvideo\b/],
    ['typeface', /\btypeface\b|\bfont\b/],
    ['risograph print', /\brisograph\b|\briso\b/],
  ]
  for (const [label, pattern] of deliverableChecks) {
    if (pattern.test(lower)) deliverables.push(label)
  }

  const constraintChecks = [
    ['deadline or due date referenced', /\bdue\b|\bdeadline\b|\bby\s+(?:mon|tues|wed|thurs|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)/i],
    ['must follow stated requirements', /\bmust\b|\brequired\b|\brequirements?\b|\babide\b/],
    ['safety or damage restriction', /\bhazard\b|\bphysical harm\b|\bdamage\b|\bpermit\b/],
    ['process documentation required', /\bprocess\b|\biterations?\b|\bsketch(?:es)?\b|\bversions?\b/],
    ['research required', /\bresearch\b|\bwell-researched\b/],
    ['timely completion expected', /\btimely\b|\bon time\b|\bdeadline\b/],
  ]
  for (const [label, pattern] of constraintChecks) {
    if (pattern.test(snippet)) constraints.push(label)
  }

  const materialChecks = [
    ['paper', /\bpaper\b/],
    ['printing', /\bprint(?:ing)?\b|\bprinter\b/],
    ['binding', /\bbind(?:ing|ery)?\b/],
    ['photography', /\bphoto(?:graphy|graphs?)\b|\bimages?\b/],
    ['sketches', /\bsketch(?:es)?\b/],
    ['physical installation', /\binstallation\b|\bsite\b/],
    ['risograph', /\brisograph\b|\briso\b/],
  ]
  for (const [label, pattern] of materialChecks) {
    if (pattern.test(lower)) materials.push(label)
  }

  const toolChecks = [
    ['Adobe InDesign', /\bindesign\b/],
    ['Adobe Illustrator', /\billustrator\b/],
    ['Adobe Photoshop', /\bphotoshop\b/],
    ['Figma', /\bfigma\b/],
    ['HTML/CSS', /\bhtml\b|\bcss\b/],
    ['JavaScript', /\bjavascript\b|\bjs\b/],
    ['After Effects', /\bafter effects\b/],
    ['Zoom', /\bzoom\b/],
    ['Slack', /\bslack\b/],
    ['Google Drive', /\bgoogle drive\b/],
  ]
  for (const [label, pattern] of toolChecks) {
    if (pattern.test(lower)) tools.push(label)
  }

  const assignmentType = inferAssignmentType(lower)
  const outputFormat = inferOutputFormat({ deliverables, materials, tools, lower })

  const phaseChecks = [
    ['research', /\bresearch\b|\binvestigate\b|\bcollect\b|\bgather\b|\banaly[sz]e\b|\bprecedent\b/],
    ['sketch', /\bsketch(?:es|ing)?\b|\bdraft(?:s|ing)?\b|\bthumbnail\b|\brough\b/],
    ['prototype', /\bprototype\b|\bmockup\b|\btest\b|\bexperiment\b|\biteration\b|\bversion\b/],
    ['make', /\bmake\b|\bdesign\b|\bbuild\b|\bcompose\b|\bproduce\b|\bcreate\b|\bcode\b|\bprint\b/],
    ['present', /\bpresent(?:ation)?\b|\bpin[- ]?up\b|\bshow\b|\bshare\b/],
    ['critique', /\bcrit(?:ique)?\b|\bfeedback\b|\breview\b|\bdiscussion\b/],
    ['revise', /\brev(?:ise|ision)\b|\brework\b|\biterate\b|\bimprov(?:e|ement)\b|\brefine\b/],
    ['submit', /\bsubmit\b|\bturn(?:ed)? in\b|\bdue\b|\bdeadline\b|\bfinal\b/],
    ['document', /\bdocument(?:ation)?\b|\barchive\b|\bprocess book\b|\bportfolio\b/],
  ]
  for (const [label, pattern] of phaseChecks) {
    if (pattern.test(lower)) studioPhases.push(label)
  }

  if (/what|why|how|\?/.test(snippet)) {
    const questions = snippet
      .split(/(?<=\?)\s+|\n+/)
      .map((part) => part.trim())
      .filter((part) => /\?$/.test(part) || /^(?:what|why|how|when|where|who)\b/i.test(part))
      .map((part) => part.slice(0, 220))
    critiqueQuestions.push(...questions)
  }
  if (/hierarchy|composition|form|scale|contrast|sequence|pace|readability|legibility|audience|context|material|craft/i.test(snippet)) {
    critiqueQuestions.push('How do form, hierarchy, material, audience, and context change the reading of the work?')
  }
  if (/source excerpt|snippet|partial|unknown|not enough|limited/i.test(snippet)) {
    evidenceLimits.push('assignment reconstructed from partial source excerpt')
  }
  if (!/due|deliver|submit|final|present|crit|project|assignment|exercise/i.test(snippet)) {
    evidenceLimits.push('assignment boundary inferred from nearby course language')
  }

  const critiqueFormat = /critique|critiques|crit\b/i.test(snippet)
    ? /group|class/i.test(snippet)
      ? 'group/class critique referenced in source excerpt'
      : /one-on-one|individual/i.test(snippet)
        ? 'individual critique referenced in source excerpt'
        : 'critique referenced in source excerpt'
    : /feedback|review/i.test(snippet)
      ? 'feedback/review referenced in source excerpt'
      : null

  const revisionExpectation = /re-?work|revise|revision|improv|iterations?|versions?|progress/i.test(snippet)
    ? 'revision or iterative improvement expected'
    : null

  const tacitGoal = inferTacitGoal(snippet)

  return {
    constraints: uniq(constraints),
    deliverables: uniq(deliverables),
    materials: uniq(materials),
    tools: uniq(tools),
    assignment_type: assignmentType,
    studio_phases: uniq(studioPhases),
    critique_questions: uniq(critiqueQuestions).slice(0, 4),
    output_format: outputFormat,
    evidence_limits: uniq(evidenceLimits),
    critique_format: critiqueFormat,
    revision_expectation: revisionExpectation,
    tacit_goal: tacitGoal,
    evidence_grade: deliverables.length || constraints.length || critiqueFormat || revisionExpectation ? 'A' : 'B',
  }
}

function inferAssignmentType(lower) {
  if (/\bfinal\b|\bcapstone\b|\bportfolio\b/.test(lower)) return 'final_project'
  if (/\bcrit(?:ique)?\b|\bpin[- ]?up\b|\breview\b/.test(lower)) return 'critique_session'
  if (/\bexercises?\b|\bwarm[- ]?ups?\b|\bworkshops?\b/.test(lower)) return 'exercise'
  if (/\bread(?:ing)?s?\b|\bresponses?\b|\bdiscussions?\b/.test(lower)) return 'reading_response'
  if (/\bpresentation\b|\bpresent\b/.test(lower)) return 'presentation'
  if (/\bprojects?\b|\bassignments?\b|\bbriefs?\b|\bprompts?\b/.test(lower)) return 'project_brief'
  return 'studio_activity'
}

function inferOutputFormat({ deliverables, materials, tools, lower }) {
  if (deliverables.includes('website') || tools.includes('HTML/CSS') || tools.includes('JavaScript')) return 'interactive_web_artifact'
  if (deliverables.includes('animation')) return 'time_based_screen_artifact'
  if (deliverables.some((item) => ['book', 'booklet', 'catalogue', 'portfolio'].includes(item))) return 'multi_page_publication'
  if (deliverables.some((item) => ['poster', 'logo', 'visual identity system'].includes(item))) return 'static_visual_system'
  if (materials.some((item) => ['printing', 'binding', 'risograph'].includes(item))) return 'printed_physical_artifact'
  if (/\bessay\b|\bwriting\b|\bstatement\b|\bresponse\b/.test(lower)) return 'written_response'
  if (/\bpresentation\b|\bpresent\b/.test(lower)) return 'presentation'
  return null
}

function inferTacitGoal(snippet) {
  const lower = snippet.toLowerCase()
  if (/critique|feedback|present|articulate|discussion/.test(lower)) return 'practice explaining and defending design decisions in critique'
  if (/research|references|precedent/.test(lower)) return 'ground visual decisions in research and precedent'
  if (/process|iterations?|versions?|sketch/.test(lower)) return 'develop iterative process habits rather than only final outputs'
  if (/craft|detail|polish|presentation/.test(lower)) return 'build attention to craft, finish, and presentation quality'
  if (/identity|system|brand/.test(lower)) return 'translate a concept into a coherent visual system'
  if (/type|typography|letterform|typesetting/.test(lower)) return 'train typographic judgment through form, hierarchy, and spacing'
  if (/poster|book|publication|catalog/.test(lower)) return 'compose visual hierarchy within a concrete graphic format'
  if (/website|html|css|interactive|prototype|figma/.test(lower)) return 'prototype interactive form and user-facing structure'
  return null
}

const readingCatalog = [
  { match: /meggs|history of graphic design/i, title: "Meggs' History of Graphic Design", author: 'Philip B. Meggs', resource_type: 'book' },
  { match: /bringhurst|elements of typographic style/i, title: 'The Elements of Typographic Style', author: 'Robert Bringhurst', resource_type: 'book' },
  { match: /lupton|thinking with type|ellen lupton/i, title: 'Thinking with Type', author: 'Ellen Lupton', resource_type: 'book' },
  { match: /detail in typography|hochuli/i, title: 'Detail in Typography', author: 'Jost Hochuli', resource_type: 'book' },
  { match: /m[üu]ller[-\s]brockmann|grid systems/i, title: 'Grid Systems in Graphic Design', author: 'Josef Muller-Brockmann', resource_type: 'book' },
  { match: /anatomy of type|stephen coles/i, title: 'The Anatomy of Type', author: 'Stephen Coles', resource_type: 'book' },
  { match: /text in the book format|keith smith/i, title: 'Text in the Book Format', author: 'Keith A. Smith', resource_type: 'book' },
  { match: /how to draw a tree|munari/i, title: 'How to Draw a Tree', author: 'Bruno Munari', resource_type: 'book' },
  { match: /norman potter|what is a designer/i, title: 'What Is a Designer', author: 'Norman Potter', resource_type: 'book' },
  { match: /web.?s grain|frank chimero/i, title: "The Web's Grain", author: 'Frank Chimero', resource_type: 'essay' },
  { match: /handmade web|j\.?\s*r\.?\s*carpenter/i, title: 'A Handmade Web', author: 'J. R. Carpenter', resource_type: 'essay' },
  { match: /letterform of the age|bo[-\s]?won keum/i, title: 'On the Letterform of the Age', author: 'Bo-Won Keum', resource_type: 'essay' },
  { match: /typeface as programme|j[üu]rg lehni/i, title: 'Typeface as Programme', author: 'Jurg Lehni', resource_type: 'essay' },
  { match: /\bthe cube\b|erik van blokland/i, title: 'The Cube', author: 'Erik van Blokland', resource_type: 'essay' },
  { match: /letter\s*&\s*spirit|dexter sinister/i, title: 'Letter & Spirit', author: 'Dexter Sinister', resource_type: 'essay' },
  { match: /function as narrative|weiyi li/i, title: 'Function as Narrative', author: 'Weiyi Li', resource_type: 'essay' },
  { match: /poetry of tools|mindy seu/i, title: 'Poetry of Tools', author: 'Mindy Seu', resource_type: 'essay' },
  { match: /shifting house|laurel schwulst/i, title: 'My Website is a Shifting House Next to a River of Knowledge', author: 'Laurel Schwulst', resource_type: 'essay' },
  { match: /software as ideology|american artist|sfpc/i, title: 'Software as Ideology', author: 'School for Poetic Computation with American Artist', resource_type: 'essay' },
]

function cleanCitationExcerpt(value) {
  return value.replace(/[❧•]+/g, ' ').replace(/\s+/g, ' ').replace(/\s+[,;:.]$/g, '').trim()
}

function normalizeCitation(raw) {
  const rawCitation = cleanCitationExcerpt(raw)
  const catalogHit = readingCatalog.find((entry) => entry.match.test(rawCitation))
  const year = rawCitation.match(/\b(19|20)\d{2}\b/)?.[0] ?? null
  if (catalogHit) {
    return {
      raw_citation: rawCitation,
      title: catalogHit.title,
      author: catalogHit.author,
      publication_year: year,
      publisher_or_source: null,
      resource_type: catalogHit.resource_type,
      canonical_work_id: `work_${slug(`${catalogHit.title}_${catalogHit.author}`)}`,
      linking_status: 'local_catalog_match',
    }
  }

  const byMatch = rawCitation.match(/^(.{4,120}?)\s+by\s+(.{3,80})$/i)
  const title = byMatch ? byMatch[1].trim() : null
  const author = byMatch ? byMatch[2].trim() : null
  const looksLikeTitle = /^[A-Z0-9][A-Za-z0-9'&,: -]{8,120}$/.test(rawCitation) && rawCitation.split(/\s+/).length >= 3
  return {
    raw_citation: rawCitation,
    title: title ?? (looksLikeTitle ? rawCitation : null),
    author,
    publication_year: year,
    publisher_or_source: rawCitation.match(/\b(?:Publishers?|Press|Journal|Magazine|Communication Arts)\b/i)?.[0] ?? null,
    resource_type: /https?:\/\/|website|web/i.test(rawCitation) ? 'website' : 'unknown',
    canonical_work_id: title || looksLikeTitle ? `work_${slug(`${title ?? rawCitation}_${author ?? 'unknown'}`)}` : null,
    linking_status: title || looksLikeTitle ? 'heuristic_title' : 'unresolved',
  }
}

function buildReadings(syllabi) {
  const rows = []
  for (const syllabus of syllabi) {
    syllabus.readings.forEach((reading, index) => {
      const normalized = normalizeCitation(reading)
      rows.push({
        reading_id: `reading_${syllabus.syllabus_id}_${String(index + 1).padStart(2, '0')}`,
        course_code: syllabus.course_code,
        course_title: syllabus.course_title,
        syllabus_id: syllabus.syllabus_id,
        citation_excerpt: normalized.raw_citation,
        ...normalized,
        required_or_recommended: /recommended/i.test(reading) ? 'recommended' : 'unknown',
        week_or_date: reading.match(/\b(?:week|class|session)\s+\d+\b/i)?.[0] ?? null,
        source_ids: syllabus.source_ids,
      })
    })
  }
  return rows
}

function buildReadingFrequency(readings) {
  const byWork = new Map()
  for (const reading of readings.filter((row) => row.canonical_work_id)) {
    const existing = byWork.get(reading.canonical_work_id) ?? {
      canonical_work_id: reading.canonical_work_id,
      title: reading.title,
      author: reading.author,
      resource_type: reading.resource_type,
      linking_status: reading.linking_status,
      occurrence_count: 0,
      course_codes: [],
      course_titles: [],
      syllabus_ids: [],
      source_ids: [],
      raw_citations: [],
    }
    existing.occurrence_count += 1
    existing.course_codes = uniq([...existing.course_codes, reading.course_code].filter(Boolean))
    existing.course_titles = uniq([...existing.course_titles, reading.course_title].filter(Boolean))
    existing.syllabus_ids = uniq([...existing.syllabus_ids, reading.syllabus_id])
    existing.source_ids = uniq([...existing.source_ids, ...reading.source_ids])
    existing.raw_citations = uniq([...existing.raw_citations, reading.raw_citation]).slice(0, 8)
    byWork.set(reading.canonical_work_id, existing)
  }
  return [...byWork.values()].sort((a, b) => b.occurrence_count - a.occurrence_count || a.title.localeCompare(b.title))
}

function buildFacultyGraph({ sources, courseInventory, syllabi }) {
  const facultyByName = new Map()
  const edges = []
  const addFaculty = ({ name, sourceIds = [], profileUrl = null, courseCode = null, courseTitle = null, term = null, evidenceGrade = null }) => {
    for (const facultyName of splitInstructorNames(name)) {
      const facultyId = `faculty_${slug(facultyName)}`
      const existing = facultyByName.get(facultyName) ?? {
        faculty_id: facultyId,
        name: facultyName,
        affiliation: 'Rhode Island School of Design',
        department: 'Graphic Design',
        profile_urls: [],
        source_ids: [],
        course_codes: [],
        course_titles: [],
        terms: [],
        evidence_grade: evidenceGrade ?? 'C',
      }
      existing.source_ids = uniq([...existing.source_ids, ...sourceIds])
      existing.profile_urls = uniq([...existing.profile_urls, profileUrl].filter(Boolean))
      existing.course_codes = uniq([...existing.course_codes, courseCode].filter(Boolean))
      existing.course_titles = uniq([...existing.course_titles, courseTitle].filter(Boolean))
      existing.terms = uniq([...existing.terms, term].filter(Boolean))
      existing.evidence_grade = bestEvidenceGrade([existing.evidence_grade, evidenceGrade])
      facultyByName.set(facultyName, existing)

      if (courseCode || courseTitle || term) {
        edges.push({
          edge_id: `edge_${facultyId}_${slug(`${courseCode ?? courseTitle ?? 'course'}_${term ?? 'unknown'}`)}`,
          faculty_id: facultyId,
          faculty_name: facultyName,
          course_code: courseCode,
          course_title: courseTitle,
          term,
          source_ids: sourceIds,
          relationship: 'instructor_or_course_artifact_attribution',
          evidence_grade: evidenceGrade ?? 'C',
        })
      }
    }
  }

  for (const offering of courseInventory.offerings) {
    addFaculty({
      name: offering.instructor,
      sourceIds: offering.source_ids,
      courseCode: offering.course_code,
      courseTitle: offering.course_title,
      term: offering.period,
      evidenceGrade: offering.evidence_grade,
    })
  }
  for (const syllabus of syllabi) {
    addFaculty({
      name: syllabus.instructor,
      sourceIds: syllabus.source_ids,
      courseCode: syllabus.course_code,
      courseTitle: syllabus.course_title,
      term: syllabus.term,
      evidenceGrade: syllabus.evidence_grade,
    })
  }
  for (const source of sources) {
    addFaculty({
      name: source.instructor,
      sourceIds: [source.source_id],
      profileUrl: source.source_type === 'faculty_profile' ? source.url : null,
      courseCode: source.course_code ?? null,
      courseTitle: source.course_title ?? null,
      term: source.term ?? null,
      evidenceGrade: source.confidence,
    })
  }

  const dedupedEdges = new Map()
  for (const edge of edges) {
    const key = `${edge.faculty_id}|${edge.course_code ?? ''}|${edge.course_title ?? ''}|${edge.term ?? ''}|${edge.relationship}`
    const existing = dedupedEdges.get(key)
    if (existing) {
      existing.source_ids = uniq([...existing.source_ids, ...edge.source_ids])
      existing.evidence_grade = bestEvidenceGrade([existing.evidence_grade, edge.evidence_grade])
    } else {
      dedupedEdges.set(key, edge)
    }
  }

  return {
    faculty: [...facultyByName.values()].sort((a, b) => a.name.localeCompare(b.name)),
    facultyCourseEdges: [...dedupedEdges.values()].sort((a, b) => a.faculty_name.localeCompare(b.faculty_name) || (a.course_title ?? '').localeCompare(b.course_title ?? '')),
  }
}

function splitInstructorNames(name) {
  if (!name) return []
  const cleaned = String(name)
    .replace(/\b(?:Instructor\(s\):|Instructor:)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned || /^(?:TBA|Staff|Faculty|DS1 team|DC|Metcalf Auditorium|Auditorium)$/i.test(cleaned) || /^Design Center\b/i.test(cleaned)) return []
  return uniq(cleaned
    .split(/\s*(?:,|;|\/|&|\band\b)\s*/i)
    .map((part) => part.replace(/\([^)]*\)/g, '').trim())
    .filter((part) => !/^(?:Design Center|DC|Metcalf Auditorium|Auditorium)\b/i.test(part) && !/\bLocation$/i.test(part))
    .filter((part) => /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}$/.test(part)))
}

const facultyProfileHints = new Map([
  ['Anther Kiley', ['https://www.risd.edu/academics/graphic-design/faculty/anther-kiley', 'https://antherkiley.com/info.html']],
  ['John Caserta', ['https://johncaserta.com/']],
  ['Marie Otsuka', ['https://motsuka.com/']],
  ['Minkyoung Kim', ['https://minkyoungkim.com/']],
  ['Paul Soulellis', ['https://www.risd.edu/academics/graphic-design/faculty/paul-soulellis', 'https://soulellis.com/about.html']],
  ['Pouya Ahmadi', ['https://www.risd.edu/academics/graphic-design/faculty/pouya-ahmadi', 'https://www.pouyaahmadi.com/']],
])

function facultySlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function facultyProfileCandidateId(facultyId, url) {
  return `faculty_profile_candidate_${facultyId}_${createHash('sha1').update(url).digest('hex').slice(0, 8)}`
}

async function discoverFacultyProfileCandidates(facultyRows, existingCandidates = []) {
  const byKey = new Map(existingCandidates.map((candidate) => [`${candidate.faculty_id}|${canonicalUrl(candidate.url)}`, candidate]))
  const addCandidate = ({ faculty, url, candidateSource, matchedOn }) => {
    const normalizedUrl = canonicalUrl(url)
    const key = `${faculty.faculty_id}|${normalizedUrl}`
    if (byKey.has(key)) return
    byKey.set(key, {
      candidate_id: facultyProfileCandidateId(faculty.faculty_id, normalizedUrl),
      faculty_id: faculty.faculty_id,
      faculty_name: faculty.name,
      url: normalizedUrl,
      candidate_source: candidateSource,
      matched_on: matchedOn,
      status: 'candidate_for_public_fetch',
      promoted_source_id: null,
      extraction_status: null,
      discovered_at: retrievedAt,
      ingested_at: null,
    })
  }

  let indexLinks = []
  try {
    const fetched = await fetchWithRetry(risdGraphicDesignFacultyUrl)
    indexLinks = extractLinks(fetched.buffer.toString('utf8'), fetched.finalUrl || risdGraphicDesignFacultyUrl)
  } catch {
    indexLinks = []
  }

  for (const faculty of facultyRows) {
    const sluggedName = facultySlug(faculty.name)
    addCandidate({
      faculty,
      url: `${risdGraphicDesignFacultyUrl}/${sluggedName}`,
      candidateSource: 'official_risd_faculty_url_pattern',
      matchedOn: 'faculty_name_slug',
    })

    for (const link of indexLinks) {
      const linkSlug = facultySlug(link.label || link.url)
      const pathSlug = link.url.split('/').filter(Boolean).pop()?.toLowerCase() ?? ''
      if (link.url.startsWith(risdGraphicDesignFacultyUrl) && (linkSlug.includes(sluggedName) || pathSlug === sluggedName)) {
        addCandidate({
          faculty,
          url: link.url,
          candidateSource: 'official_risd_faculty_index',
          matchedOn: link.label ? 'link_label_or_slug' : 'url_slug',
        })
      }
    }

    for (const hintedUrl of facultyProfileHints.get(faculty.name) ?? []) {
      addCandidate({
        faculty,
        url: hintedUrl,
        candidateSource: hintedUrl.includes('risd.edu') ? 'curated_official_profile_hint' : 'curated_public_profile_hint',
        matchedOn: 'curated_faculty_name_map',
      })
    }
  }

  return [...byKey.values()].sort((a, b) => a.faculty_name.localeCompare(b.faculty_name) || a.url.localeCompare(b.url))
}

function bestEvidenceGrade(grades) {
  const order = ['A', 'B', 'C', 'D', 'E']
  return grades.filter(Boolean).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] ?? null
}

function buildStudentWork(inspected) {
  const rows = []
  for (const { source, text, links = [] } of inspected.filter(({ source, text }) => source.extraction_status === 'ok' && text && ['official_student_work_story', 'student_work_archive'].includes(source.source_type))) {
    const snippets = sentenceSnippets(text, ['animation', 'video', 'poster', 'book', 'website', 'identity', 'project', 'student', 'assignment'], 14)
    const studentNames = extractStudentNames(text)
    const medium = inferStudentWorkMedium(`${source.title ?? ''} ${text}`)
    const linkedItems = links.filter((link) => isLikelyStudentWorkLink(link)).slice(0, 20)

    if (linkedItems.length) {
      linkedItems.forEach((link, index) => {
        const label = link.label || titleFromUrl(link.url)
        const linkEvidence = `${label} ${link.url}`
        rows.push({
          student_work_id: `work_${source.source_id.replace(/^src_/, '')}_${String(index + 1).padStart(2, '0')}`,
          url: link.url,
          source_ids: [source.source_id],
          course_code: source.course_code ?? null,
          course_title: source.course_title ?? inferCourseTitleFromStudentWork(linkEvidence, ''),
          instructor: source.instructor ?? null,
          term: source.term ?? null,
          student_name_public: extractStudentNames(label)[0] ?? null,
          medium: inferStudentWorkMedium(linkEvidence) ?? medium,
          project_title: label || null,
          project_statement_excerpt: snippets[0] ?? null,
          assignment_link_confidence: classifyStudentWorkAssignmentLink(linkEvidence, ''),
          visual_standard_notes: visualStandardNotes([label, ...snippets.slice(0, 3)]),
          medium_evidence: snippets,
          confidence: source.source_type === 'official_student_work_story' ? 'D' : 'E',
          evidence_grade: source.source_type === 'official_student_work_story' ? 'D' : 'E',
        })
      })
    } else {
      rows.push({
        student_work_id: `work_${source.source_id.replace(/^src_/, '')}`,
        url: source.url,
        source_ids: [source.source_id],
        course_code: source.course_code ?? null,
        course_title: source.course_title ?? inferCourseTitleFromStudentWork(source.title ?? '', text),
        instructor: source.instructor ?? null,
        term: source.term ?? null,
        student_name_public: studentNames[0] ?? null,
        medium,
        project_title: source.title ?? source.course_title ?? null,
        project_statement_excerpt: snippets[0] ?? null,
        assignment_link_confidence: classifyStudentWorkAssignmentLink(source.title ?? '', text),
        visual_standard_notes: visualStandardNotes(snippets),
        medium_evidence: snippets,
        confidence: source.source_type === 'official_student_work_story' ? 'D' : 'E',
        evidence_grade: source.source_type === 'official_student_work_story' ? 'D' : 'E',
      })
    }
  }
  return rows
}

function buildSourceClusters(inspected, syllabi, readings) {
  const sourceById = new Map(inspected.map(({ source }) => [source.source_id, source]))
  const clusters = []
  const clustered = new Set()

  const exactGroups = new Map()
  for (const { source } of inspected) {
    if (!source.url && !source.checksum) continue
    const exactKeys = [
      source.url ? `url:${canonicalUrl(source.url)}` : null,
      source.checksum ? `checksum:${source.checksum}` : null,
    ].filter(Boolean)
    for (const key of exactKeys) {
      const existing = exactGroups.get(key) ?? []
      existing.push(source.source_id)
      exactGroups.set(key, existing)
    }
  }

  let clusterIndex = 1
  for (const [key, ids] of exactGroups) {
    const uniqueIds = uniq(ids)
    if (uniqueIds.length < 2) continue
    const cluster = makeSourceCluster({
      clusterIndex,
      clusterType: key.startsWith('url:') ? 'exact_url' : 'exact_checksum',
      sourceIds: uniqueIds,
      sourceById,
      inspected,
      syllabi,
      readings,
      reason: key,
      similarity: 1,
    })
    clusters.push(cluster)
    cluster.source_ids.forEach((id) => clustered.add(id))
    clusterIndex += 1
  }

  const comparable = inspected
    .filter(({ source, text }) => source.extraction_status === 'ok' && text && text.length > 500)
    .map((item) => ({
      ...item,
      family_key: sourceFamilyKey(item.source),
      course_key: normalizeCourseKey(item.source.course_code ?? null, item.source.course_title ?? sourceTitleFamily(item.source)),
      shingles: textShingles(item.text),
    }))
    .filter((item) => item.shingles.size >= 20)

  const buckets = new Map()
  for (const item of comparable) {
    const key = `${item.family_key}|${item.course_key}`
    const existing = buckets.get(key) ?? []
    existing.push(item)
    buckets.set(key, existing)
  }

  for (const [bucketKey, items] of buckets) {
    if (items.length < 2) continue
    const parent = new Map(items.map((item) => [item.source.source_id, item.source.source_id]))
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const similarity = jaccard(items[i].shingles, items[j].shingles)
        if (similarity >= 0.82) union(parent, items[i].source.source_id, items[j].source.source_id)
      }
    }
    const groups = new Map()
    for (const item of items) {
      const root = findParent(parent, item.source.source_id)
      const existing = groups.get(root) ?? []
      existing.push(item.source.source_id)
      groups.set(root, existing)
    }
    for (const ids of groups.values()) {
      const sourceIds = uniq(ids).filter((id) => !clustered.has(id))
      if (sourceIds.length < 2) continue
      const pairSimilarities = []
      for (let i = 0; i < sourceIds.length; i += 1) {
        for (let j = i + 1; j < sourceIds.length; j += 1) {
          const left = comparable.find((item) => item.source.source_id === sourceIds[i])
          const right = comparable.find((item) => item.source.source_id === sourceIds[j])
          if (left && right) pairSimilarities.push(jaccard(left.shingles, right.shingles))
        }
      }
      clusters.push(makeSourceCluster({
        clusterIndex,
        clusterType: 'near_duplicate_text',
        sourceIds,
        sourceById,
        inspected,
        syllabi,
        readings,
        reason: `bucket:${bucketKey}`,
        similarity: pairSimilarities.length ? Number((pairSimilarities.reduce((sum, value) => sum + value, 0) / pairSimilarities.length).toFixed(3)) : null,
      }))
      sourceIds.forEach((id) => clustered.add(id))
      clusterIndex += 1
    }
  }

  const relatedGroups = new Map()
  for (const { source } of inspected.filter(({ source }) => source.extraction_status === 'ok')) {
    if (clustered.has(source.source_id)) continue
    const key = `${sourceFamilyKey(source)}|${normalizeCourseKey(source.course_code ?? null, source.course_title ?? sourceTitleFamily(source))}`
    const existing = relatedGroups.get(key) ?? []
    existing.push(source.source_id)
    relatedGroups.set(key, existing)
  }
  for (const [key, ids] of relatedGroups) {
    const sourceIds = uniq(ids)
    if (sourceIds.length < 2) continue
    clusters.push(makeSourceCluster({
      clusterIndex,
      clusterType: 'related_source_family',
      sourceIds,
      sourceById,
      inspected,
      syllabi,
      readings,
      reason: `bucket:${key}`,
      similarity: null,
    }))
    sourceIds.forEach((id) => clustered.add(id))
    clusterIndex += 1
  }

  return clusters.sort((a, b) => b.source_ids.length - a.source_ids.length || a.cluster_id.localeCompare(b.cluster_id))
}

function buildSourceVersions(inspected, wayback) {
  const sourceById = new Map(inspected.map(({ source }) => [source.source_id, source]))
  const textById = new Map(inspected.map(({ source, text }) => [source.source_id, text ?? '']))
  const capturesBySource = new Map()
  for (const capture of wayback) {
    const existing = capturesBySource.get(capture.source_id) ?? []
    existing.push(capture)
    capturesBySource.set(capture.source_id, existing)
  }
  const archiveSourcesByParent = new Map()
  for (const { source } of inspected.filter(({ source }) => source.source_type === 'wayback_capture' && source.parent_source_id)) {
    const existing = archiveSourcesByParent.get(source.parent_source_id) ?? []
    existing.push(source)
    archiveSourcesByParent.set(source.parent_source_id, existing)
  }

  const rows = []
  for (const [sourceId, captures] of capturesBySource) {
    const current = sourceById.get(sourceId)
    const archiveSources = archiveSourcesByParent.get(sourceId) ?? []
    const sortedCaptures = captures.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    const currentText = current ? textById.get(current.source_id) ?? '' : ''
    const archiveTextRows = archiveSources.map((source) => ({
      source,
      text: textById.get(source.source_id) ?? '',
    })).filter((row) => row.text)
    const bestArchive = archiveTextRows
      .slice()
      .sort((a, b) => b.text.length - a.text.length)[0]
    const currentKeywords = versionKeywords(currentText)
    const archiveKeywords = bestArchive ? versionKeywords(bestArchive.text) : []
    const addedKeywords = bestArchive ? archiveKeywords.filter((keyword) => !currentKeywords.includes(keyword)) : []
    const removedKeywords = bestArchive ? currentKeywords.filter((keyword) => !archiveKeywords.includes(keyword)) : []
    const similarity = bestArchive && currentText ? Number(jaccard(textShingles(currentText), textShingles(bestArchive.text)).toFixed(3)) : null
    rows.push({
      version_id: `version_${sourceId.replace(/^src_/, '')}`,
      source_id: sourceId,
      current_source_id: current?.source_id ?? null,
      current_url: current?.url ?? sortedCaptures.at(-1)?.original ?? null,
      current_status: current?.extraction_status ?? 'not_fetched_current_run',
      archive_capture_count: sortedCaptures.length,
      oldest_capture_timestamp: sortedCaptures[0]?.timestamp ?? null,
      newest_capture_timestamp: sortedCaptures.at(-1)?.timestamp ?? null,
      fetched_archive_source_ids: archiveSources.map((source) => source.source_id),
      fetched_archive_count: archiveSources.length,
      comparison_status: bestArchive ? 'fetched_archive_compared' : sortedCaptures.length ? 'metadata_only' : 'no_archive',
      current_text_length: current?.text_length ?? 0,
      archive_text_length: bestArchive?.source.text_length ?? 0,
      normalized_text_similarity: similarity,
      current_keywords: currentKeywords,
      archive_keywords: archiveKeywords,
      added_archive_keywords: addedKeywords,
      removed_archive_keywords: removedKeywords,
      substantive_change_hint: bestArchive ? versionChangeHint({ similarity, addedKeywords, removedKeywords, currentText, archiveText: bestArchive.text }) : null,
      evidence_grade: bestArchive ? current?.confidence ?? bestArchive.source.confidence ?? null : current?.confidence ?? null,
    })
  }
  return rows.sort((a, b) => a.source_id.localeCompare(b.source_id))
}

function versionKeywords(text) {
  const lower = text.toLowerCase()
  const checks = [
    ['syllabus', /\bsyllabus\b/],
    ['schedule', /\bschedule\b|\bcalendar\b|\bweek\b/],
    ['assignment', /\bassignment\b|\bproject\b|\bexercise\b|\bprompt\b/],
    ['critique', /\bcritique\b|\bcrit\b|\bfeedback\b/],
    ['reading', /\breadings?\b|\btexts?\b|\bbibliography\b/],
    ['grading', /\bgrading\b|\bgrade\b|\bevaluation\b|\bassessment\b/],
    ['tools', /\bphotoshop\b|\billustrator\b|\bindesign\b|\bfigma\b|\bhtml\b|\bcss\b|\bjavascript\b|\bafter effects\b/],
    ['student_work', /\bstudent work\b|\bgallery\b|\bportfolio\b/],
  ]
  return checks.filter(([, pattern]) => pattern.test(lower)).map(([keyword]) => keyword)
}

function versionChangeHint({ similarity, addedKeywords, removedKeywords, currentText, archiveText }) {
  const keywordChanges = [...addedKeywords, ...removedKeywords]
  if (similarity !== null && similarity < 0.65 && keywordChanges.length) return 'likely_substantive_version_change'
  if (similarity !== null && similarity < 0.4 && Math.abs(currentText.length - archiveText.length) > 1000) return 'likely_substantive_version_change'
  if (keywordChanges.length) return 'possible_scope_change'
  if (similarity !== null && similarity > 0.9) return 'mostly_cosmetic_or_same_content'
  return 'needs_manual_version_review'
}

function makeSourceCluster({ clusterIndex, clusterType, sourceIds, sourceById, inspected, syllabi, readings, reason, similarity }) {
  const sources = sourceIds.map((id) => sourceById.get(id)).filter(Boolean)
  const representative = sources
    .slice()
    .sort((a, b) => (sourceTypeRank[a.source_type] ?? 99) - (sourceTypeRank[b.source_type] ?? 99) || (b.text_length ?? 0) - (a.text_length ?? 0))[0]
  const sourceIdSet = new Set(sourceIds)
  const clusterSyllabi = syllabi.filter((syllabus) => syllabus.source_ids.some((id) => sourceIdSet.has(id)))
  const clusterReadings = readings.filter((reading) => reading.source_ids.some((id) => sourceIdSet.has(id)))
  const clusterTexts = inspected.filter(({ source }) => sourceIdSet.has(source.source_id)).map(({ text }) => text).filter(Boolean)
  return {
    cluster_id: `cluster_${String(clusterIndex).padStart(3, '0')}`,
    cluster_type: clusterType,
    representative_source_id: representative?.source_id ?? sourceIds[0],
    source_ids: sourceIds,
    source_count: sourceIds.length,
    course_codes: uniq([...sources.map((source) => source.course_code), ...clusterSyllabi.map((syllabus) => syllabus.course_code)]),
    course_titles: uniq([...sources.map((source) => source.course_title), ...clusterSyllabi.map((syllabus) => syllabus.course_title)]),
    instructors: uniq([...sources.map((source) => source.instructor), ...clusterSyllabi.map((syllabus) => syllabus.instructor)]),
    terms: uniq([...sources.map((source) => source.term), ...clusterSyllabi.map((syllabus) => syllabus.term)]),
    source_url_families: uniq(sources.map((source) => sourceFamilyKey(source))),
    assignment_schedule_hash: sha256(Buffer.from(clusterSyllabi.flatMap((syllabus) => syllabus.assignment_schedule ?? []).map((row) => `${row.date ?? ''}|${row.topic ?? ''}|${row.assignment_or_reading ?? ''}`).join('\n'))),
    reading_set_hash: sha256(Buffer.from(clusterReadings.map((reading) => reading.canonical_work_id ?? reading.raw_citation).sort().join('\n'))),
    normalized_text_hashes: uniq(clusterTexts.map((text) => sha256(Buffer.from(normalizeTextForSimilarity(text).slice(0, 20000))))),
    similarity,
    reason,
    collapse_recommendation: clusterType.startsWith('exact') ? 'collapse_cosmetic_duplicate' : clusterType === 'near_duplicate_text' ? 'manual_review_before_collapse' : 'keep_distinct_related_sources',
    evidence_grade: sources.map((source) => source.confidence).sort()[0] ?? null,
  }
}

function sourceFamilyKey(source) {
  try {
    const parsed = new URL(source.original_url ?? source.url)
    const host = parsed.hostname.replace(/^www\./, '')
    const pathParts = parsed.pathname.split('/').filter(Boolean).slice(0, 2)
    return `${host}/${pathParts.join('/')}`
  } catch {
    return source.authority ?? source.source_type
  }
}

function sourceTitleFamily(source) {
  return source.course_title ?? source.title ?? source.source_type ?? source.source_id
}

function normalizeTextForSimilarity(text) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(?:the|and|for|with|from|this|that|you|your|are|will|have|class|course)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function textShingles(text, size = 5) {
  const tokens = normalizeTextForSimilarity(text).split(' ').filter((token) => token.length > 2)
  const shingles = new Set()
  for (let index = 0; index <= tokens.length - size; index += 1) {
    shingles.add(tokens.slice(index, index + size).join(' '))
  }
  return shingles
}

function jaccard(left, right) {
  let intersection = 0
  for (const value of left) {
    if (right.has(value)) intersection += 1
  }
  const unionSize = left.size + right.size - intersection
  return unionSize ? intersection / unionSize : 0
}

function findParent(parent, id) {
  const next = parent.get(id)
  if (next === id) return id
  const root = findParent(parent, next)
  parent.set(id, root)
  return root
}

function union(parent, left, right) {
  const leftRoot = findParent(parent, left)
  const rightRoot = findParent(parent, right)
  if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot)
}

function isLikelyStudentWorkLink(link) {
  const combined = `${link.url} ${link.label}`.toLowerCase()
  if (!link.label || link.label.length < 3) return false
  if (/teaching archive|archive|syllabus|curriculum|resume|cv|index|home|contact|about/.test(combined)) return false
  return /student|work|project|assignment|html|poster|book|animation|identity|logo|website|output|studio|class|risd|20\d{2}/.test(combined)
}

function titleFromUrl(url) {
  const parsed = new URL(url)
  return parsed.pathname.split('/').filter(Boolean).pop()?.replace(/[-_]+/g, ' ') ?? parsed.hostname
}

function extractStudentNames(text) {
  const names = []
  for (const match of text.matchAll(/\b(?:student|grad student|undergrad|senior|junior)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\b/g)) {
    names.push(match[1].replace(/\s+/g, ' ').trim())
  }
  for (const match of text.matchAll(/\b([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2})\s+(?:BFA|MFA)\s*\d{2}\s+GD\b/g)) {
    names.push(match[1].replace(/\s+/g, ' ').trim())
  }
  return uniq(names).slice(0, 6)
}

function inferStudentWorkMedium(text) {
  const lower = text.toLowerCase()
  const checks = [
    ['animation/video', /\banimation\b|\bvideo\b|\bmotion\b|\bafter effects\b|\bpremiere\b|\bstop-motion\b/],
    ['website/interface', /\bwebsite\b|\bweb\b|\binterface\b|\bhtml\b|\bcss\b|\bjavascript\b|\bapp\b/],
    ['identity/logo', /\bidentity\b|\blogo\b|\bemblem\b|\bsymbol\b/],
    ['poster/print', /\bposter\b|\bprint\b|\brisograph\b/],
    ['publication/book', /\bbook\b|\bpublication\b|\bcatalog(?:ue)?\b|\bspreads?\b/],
    ['typography/type specimen', /\btypography\b|\btypeface\b|\bletterform\b|\bfont\b/],
  ]
  return checks.find(([, pattern]) => pattern.test(lower))?.[0] ?? null
}

function inferCourseTitleFromStudentWork(label, text) {
  const combined = `${label} ${text}`
  return combined.match(/\bIn Motion: Design for Video and Animation\b/i)?.[0]
    ?? combined.match(/\b(?:Design Studio 1|Typography III|Web Programming|Graphic Design for the Web|HTML Output)\b/i)?.[0]
    ?? null
}

function classifyStudentWorkAssignmentLink(label, text) {
  const combined = `${label} ${text}`.toLowerCase()
  if (/full assignment|assignment can be seen|course website|project prompt/.test(combined)) return 'explicit_assignment_reference'
  if (/course|class|studio|assignment|project/.test(combined)) return 'course_context_only'
  return 'unlinked_public_example'
}

function visualStandardNotes(snippets) {
  const joined = snippets.join(' ')
  return uniq([
    /best practices|techniques|hands-on/i.test(joined) ? 'source describes technique training or best-practice expectations' : null,
    /freedom to explore|range of possibilities|experimentation/i.test(joined) ? 'source emphasizes exploration and range' : null,
    /user-centered|government information|prototype|interface/i.test(joined) ? 'source emphasizes user-centered/interface clarity' : null,
    /symbol|meaning|logo|emblem|identity/i.test(joined) ? 'source emphasizes symbolic meaning and identity systems' : null,
    /animation|video|motion|sequence/i.test(joined) ? 'source emphasizes time-based graphic sequencing' : null,
  ])
}

function buildCourseInventory(inspected) {
  const coursePages = inspected.filter(({ source }) => source.source_type === 'official_course_index' && source.extraction_status === 'ok')
  if (!coursePages.length) {
    return { displayed_count: 0, offerings: [] }
  }
  const displayedCount = Math.max(...coursePages.map((page) => displayedOfficialCourseCount(page.text)))
  const byKey = new Map()
  for (const coursePage of coursePages) {
    for (const offering of extractOfficialCourseOfferings(coursePage.text, coursePage.source.source_id)) {
      byKey.set(`${offering.course_code}_${offering.period}_${offering.start_end ?? ''}_${offering.instructor ?? ''}_${offering.location ?? ''}_${offering.status ?? ''}`, offering)
    }
  }
  return {
    displayed_count: displayedCount,
    offerings: [...byKey.values()].sort((a, b) => `${a.period} ${a.course_code}`.localeCompare(`${b.period} ${b.course_code}`)),
  }
}

function validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency = [], searchCandidates = [], commonCrawlCandidates = [], commonCrawlPromotions = [], facultyProfileCandidates = [], faculty = [], facultyCourseEdges = [], studentWork = [], sourceClusters = [], sourceVersions = [], wayback, reviewQueue = [], reviewDecisions = [], fieldConflicts = [] }) {
  const sourceIds = new Set(sources.map((source) => source.source_id))
  const syllabusIds = new Set(syllabi.map((syllabus) => syllabus.syllabus_id))
  const failedSourceIds = new Set(sources.filter((source) => source.extraction_status !== 'ok').map((source) => source.source_id))
  const leakedFailedSyllabi = syllabi.filter((syllabus) => syllabus.source_ids.some((id) => failedSourceIds.has(id)))
  const missingSyllabusIdentity = syllabi.filter((syllabus) => !syllabus.course_code && !syllabus.course_title)
  const structuredSyllabusCount = syllabi.filter((syllabus) =>
    syllabus.section
      || syllabus.year
      || syllabus.semester
      || syllabus.class_days
      || syllabus.class_time
      || syllabus.class_location
      || syllabus.office_hours
      || syllabus.credits
      || syllabus.description
      || syllabus.learning_outcomes?.length
      || syllabus.required_readings?.length
      || syllabus.recommended_readings?.length
      || syllabus.grading_rubric
      || syllabus.assessment_strategy
      || syllabus.topic_outline?.length
      || syllabus.assignment_schedule?.length
      || syllabus.policies?.length
      || syllabus.tools?.length
      || syllabus.materials?.length
      || syllabus.raw_excerpts?.length
      || syllabus.evidence_grade
  ).length
  const assignmentSourceErrors = assignments.filter((assignment) => !syllabusIds.has(assignment.syllabus_id) || assignment.source_ids.some((id) => !sourceIds.has(id)))
  const structuredAssignmentCount = assignments.filter((assignment) =>
    assignment.deliverables?.length
      || assignment.constraints?.length
      || assignment.materials?.length
      || assignment.tools?.length
      || assignment.assignment_type
      || assignment.studio_phases?.length
      || assignment.critique_questions?.length
      || assignment.output_format
      || assignment.critique_format
      || assignment.revision_expectation
      || assignment.tacit_goal
  ).length
  const phaseStructuredAssignmentCount = assignments.filter((assignment) => assignment.studio_phases?.length || assignment.assignment_type || assignment.output_format).length
  const readingSourceErrors = readings.filter((reading) => !syllabusIds.has(reading.syllabus_id) || reading.source_ids.some((id) => !sourceIds.has(id)))
  const normalizedReadingCount = readings.filter((reading) => reading.canonical_work_id).length
  const catalogReadingCount = readings.filter((reading) => reading.linking_status === 'local_catalog_match').length
  const searchCandidateErrors = searchCandidates.filter((candidate) => !candidate.candidate_id || !candidate.status || candidate.promoted_source_id && !sourceIds.has(candidate.promoted_source_id))
  const promotedSearchCandidateCount = searchCandidates.filter((candidate) => candidate.promoted_source_id).length
  const importedSearchCandidateCount = searchCandidates.filter((candidate) => candidate.source === 'imported_search_export').length
  const commonCrawlCandidateErrors = commonCrawlCandidates.filter((candidate) => !candidate.candidate_id || !candidate.query_id || !candidate.index_id || !candidate.candidate_status)
  const commonCrawlFetchCandidateCount = commonCrawlCandidates.filter((candidate) => candidate.candidate_status === 'candidate_for_public_fetch').length
  const ingestedCommonCrawlCandidateCount = commonCrawlCandidates.filter((candidate) => candidate.candidate_status === 'ingested_into_corpus').length
  const commonCrawlCandidateIds = new Set(commonCrawlCandidates.map((candidate) => candidate.candidate_id))
  const commonCrawlPromotionErrors = commonCrawlPromotions.filter((promotion) => !promotion.promotion_id || !promotion.candidate_id || !commonCrawlCandidateIds.has(promotion.candidate_id) || !promotion.promoted_source_id || !promotion.extraction_status)
  const successfulCommonCrawlPromotions = commonCrawlPromotions.filter((promotion) => promotion.extraction_status === 'ok').length
  const ingestedCommonCrawlPromotions = commonCrawlPromotions.filter((promotion) => promotion.ingestion_status === 'ingested_into_corpus').length
  const facultyIds = new Set(faculty.map((row) => row.faculty_id))
  const facultyProfileCandidateErrors = facultyProfileCandidates.filter((candidate) => !candidate.candidate_id || !candidate.faculty_id || !facultyIds.has(candidate.faculty_id) || !candidate.url || !candidate.status || candidate.promoted_source_id && !sourceIds.has(candidate.promoted_source_id))
  const ingestedFacultyProfileCandidateCount = facultyProfileCandidates.filter((candidate) => candidate.status === 'ingested_into_corpus').length
  const facultyRowsWithProfileUrls = faculty.filter((row) => row.profile_urls?.length).length
  const facultySourceErrors = faculty.filter((row) => !row.faculty_id || !row.name || row.source_ids?.some((id) => !sourceIds.has(id)))
  const facultyEdgeErrors = facultyCourseEdges.filter((edge) => !edge.edge_id || !facultyIds.has(edge.faculty_id) || edge.source_ids?.some((id) => !sourceIds.has(id)))
  const studentWorkSourceErrors = studentWork.filter((work) => work.source_ids.some((id) => !sourceIds.has(id)))
  const structuredStudentWorkCount = studentWork.filter((work) => work.url && (work.medium || work.project_title || work.project_statement_excerpt || work.assignment_link_confidence || work.visual_standard_notes?.length) && work.evidence_grade).length
  const sourceClusterErrors = sourceClusters.filter((cluster) => !cluster.representative_source_id || !cluster.source_ids?.length || cluster.source_ids.some((id) => !sourceIds.has(id)))
  const sourceVersionErrors = sourceVersions.filter((version) => !version.source_id || !version.version_id || version.current_source_id && !sourceIds.has(version.current_source_id) || version.fetched_archive_source_ids?.some((id) => !sourceIds.has(id)))
  const fetchedArchiveVersionCount = sourceVersions.filter((version) => version.comparison_status === 'fetched_archive_compared').length
  const metadataOnlyVersionCount = sourceVersions.filter((version) => version.comparison_status === 'metadata_only').length
  const exactSourceClusterCount = sourceClusters.filter((cluster) => cluster.cluster_type.startsWith('exact')).length
  const nearDuplicateSourceClusterCount = sourceClusters.filter((cluster) => cluster.cluster_type === 'near_duplicate_text').length
  const relatedSourceClusterCount = sourceClusters.filter((cluster) => cluster.cluster_type === 'related_source_family').length
  const clusteredSourceIds = new Set(sourceClusters.flatMap((cluster) => cluster.source_ids ?? []))
  const coursePacketsWithClusteredEvidence = courses.filter((course) => course.source_ids?.some((sourceId) => clusteredSourceIds.has(sourceId)) || syllabi.some((syllabus) => syllabus.source_ids?.some((sourceId) => clusteredSourceIds.has(sourceId)) && ((syllabus.course_code && course.course_code && syllabus.course_code === course.course_code) || (syllabus.course_title && course.course_title && syllabus.course_title === course.course_title) || syllabus.source_ids.some((id) => course.source_ids.includes(id))))).length
  const reviewDecisionErrors = reviewDecisions.filter((decision) => !decision.review_id || !decision.status || decision.source_ids?.some((id) => !sourceIds.has(id)))
  const resolvedReviewDecisionCount = reviewDecisions.filter((decision) => decision.status && decision.status !== 'pending_manual_review').length
  const fieldConflictErrors = fieldConflicts.filter((conflict) => !conflict.conflict_id || !conflict.field || !conflict.values?.length || conflict.source_ids?.some((id) => !sourceIds.has(id)))
  const courseInventoryReconciled = courseInventory.displayed_count > 0 && courseInventory.offerings.length === courseInventory.displayed_count
  const checks = [
    {
      id: 'sources_have_required_metadata',
      status: sources.every((source) => source.source_id && source.url && source.retrieved_at && source.source_type && source.extraction_status) ? 'pass' : 'fail',
      detail: `${sources.length} sources inspected.`,
    },
    {
      id: 'failed_fetches_do_not_create_syllabi',
      status: leakedFailedSyllabi.length === 0 ? 'pass' : 'fail',
      detail: `${leakedFailedSyllabi.length} syllabus rows reference failed sources.`,
    },
    {
      id: 'syllabi_have_course_identity',
      status: missingSyllabusIdentity.length === 0 ? 'pass' : 'warn',
      detail: `${missingSyllabusIdentity.length} syllabus rows lack both course code and title.`,
    },
    {
      id: 'syllabi_have_structured_top_level_fields',
      status: structuredSyllabusCount > 0 ? 'pass' : 'warn',
      detail: `${structuredSyllabusCount} syllabus rows include top-level schema fields for schedule, readings, policies, tools, materials, evidence, or raw excerpts.`,
    },
    {
      id: 'assignments_reference_valid_syllabi_and_sources',
      status: assignmentSourceErrors.length === 0 ? 'pass' : 'fail',
      detail: `${assignmentSourceErrors.length} assignment reference errors.`,
    },
    {
      id: 'assignments_have_structured_signals',
      status: structuredAssignmentCount > 0 ? 'pass' : 'warn',
      detail: `${structuredAssignmentCount} assignment snippets include inferred deliverables, constraints, tools, critique, revision, or tacit goals.`,
    },
    {
      id: 'assignments_have_studio_phase_signals',
      status: phaseStructuredAssignmentCount > 0 ? 'pass' : 'warn',
      detail: `${phaseStructuredAssignmentCount} assignment snippets include assignment type, studio phase, or output-format signals.`,
    },
    {
      id: 'readings_reference_valid_syllabi_and_sources',
      status: readingSourceErrors.length === 0 ? 'pass' : 'fail',
      detail: `${readingSourceErrors.length} reading reference errors.`,
    },
    {
      id: 'readings_have_normalized_work_links',
      status: normalizedReadingCount > 0 ? 'pass' : 'warn',
      detail: `${normalizedReadingCount} reading snippets linked to ${readingFrequency.length} canonical works; ${catalogReadingCount} local catalog matches.`,
    },
    {
      id: 'search_candidates_have_provenance',
      status: searchCandidateErrors.length === 0 && searchCandidates.length > 0 ? 'pass' : searchCandidateErrors.length === 0 ? 'warn' : 'fail',
      detail: `${searchCandidates.length} search candidates, ${promotedSearchCandidateCount} promoted, ${importedSearchCandidateCount} imported; ${searchCandidateErrors.length} candidate reference errors.`,
    },
    {
      id: 'common_crawl_candidates_have_provenance',
      status: commonCrawlCandidateErrors.length === 0 && commonCrawlCandidates.length > 0 ? 'pass' : commonCrawlCandidateErrors.length === 0 ? 'warn' : 'fail',
      detail: `${commonCrawlCandidates.length} Common Crawl candidates, ${commonCrawlFetchCandidateCount} fetch candidates, ${ingestedCommonCrawlCandidateCount} ingested; ${commonCrawlCandidateErrors.length} provenance errors.`,
    },
    {
      id: 'common_crawl_promotions_reference_candidates',
      status: commonCrawlPromotionErrors.length === 0 ? 'pass' : 'fail',
      detail: `${commonCrawlPromotions.length} Common Crawl promotions, ${successfulCommonCrawlPromotions} successful, ${ingestedCommonCrawlPromotions} ingested; ${commonCrawlPromotionErrors.length} reference errors.`,
    },
    {
      id: 'faculty_graph_references_valid_sources',
      status: facultySourceErrors.length === 0 && facultyEdgeErrors.length === 0 ? 'pass' : 'fail',
      detail: `${faculty.length} faculty rows and ${facultyCourseEdges.length} faculty-course edges; ${facultySourceErrors.length + facultyEdgeErrors.length} reference errors.`,
    },
    {
      id: 'faculty_profile_candidates_have_provenance',
      status: facultyProfileCandidateErrors.length === 0 && facultyProfileCandidates.length > 0 ? 'pass' : facultyProfileCandidateErrors.length === 0 ? 'warn' : 'fail',
      detail: `${facultyProfileCandidates.length} faculty profile candidates, ${ingestedFacultyProfileCandidateCount} ingested, ${facultyRowsWithProfileUrls} faculty rows with profile URLs; ${facultyProfileCandidateErrors.length} reference errors.`,
    },
    {
      id: 'student_work_reference_valid_sources',
      status: studentWorkSourceErrors.length === 0 ? 'pass' : 'fail',
      detail: `${studentWorkSourceErrors.length} student work source reference errors.`,
    },
    {
      id: 'student_work_has_structured_public_examples',
      status: structuredStudentWorkCount > 0 ? 'pass' : 'warn',
      detail: `${structuredStudentWorkCount} student work rows include URL plus medium/project/evidence metadata.`,
    },
    {
      id: 'source_clusters_reference_valid_sources',
      status: sourceClusterErrors.length === 0 ? 'pass' : 'fail',
      detail: `${sourceClusterErrors.length} source cluster reference errors across ${sourceClusters.length} clusters.`,
    },
    {
      id: 'source_clusters_include_dedup_signals',
      status: sourceClusters.length > 0 ? 'pass' : 'warn',
      detail: `${exactSourceClusterCount} exact duplicate clusters, ${nearDuplicateSourceClusterCount} near-duplicate text clusters, and ${relatedSourceClusterCount} related source-family clusters.`,
    },
    {
      id: 'source_clusters_are_used_for_packet_grouping',
      status: sourceClusters.length > 0 && coursePacketsWithClusteredEvidence > 0 ? 'pass' : sourceClusters.length > 0 ? 'warn' : 'fail',
      detail: `${coursePacketsWithClusteredEvidence} course packets include source-cluster grouped evidence families.`,
    },
    {
      id: 'source_versions_reference_valid_sources',
      status: sourceVersionErrors.length === 0 ? 'pass' : 'fail',
      detail: `${sourceVersionErrors.length} source version reference errors across ${sourceVersions.length} version rows.`,
    },
    {
      id: 'source_versions_record_wayback_comparisons',
      status: sourceVersions.length > 0 && fetchedArchiveVersionCount > 0 ? 'pass' : sourceVersions.length > 0 ? 'warn' : 'fail',
      detail: `${fetchedArchiveVersionCount} fetched archive comparisons and ${metadataOnlyVersionCount} metadata-only version rows.`,
    },
    {
      id: 'manual_review_artifacts_have_valid_references',
      status: reviewDecisionErrors.length === 0 && fieldConflictErrors.length === 0 ? 'pass' : 'fail',
      detail: `${resolvedReviewDecisionCount} generated review decisions resolved, ${reviewDecisionErrors.length} review decision reference errors, and ${fieldConflictErrors.length} field conflict reference errors.`,
    },
    {
      id: 'official_course_inventory_reconciled',
      status: courseInventoryReconciled ? 'pass' : 'warn',
      detail: `${courseInventory.offerings.length} official offerings parsed; RISD page displays ${courseInventory.displayed_count || 'unknown'} results.`,
    },
    {
      id: 'wayback_captures_recorded',
      status: wayback.length > 0 ? 'pass' : 'warn',
      detail: `${wayback.length} Wayback capture records.`,
    },
    {
      id: 'course_records_created',
      status: courses.length > 0 ? 'pass' : 'fail',
      detail: `${courses.length} course records created.`,
    },
  ]
  const failed = checks.filter((check) => check.status === 'fail')
  const warnings = checks.filter((check) => check.status === 'warn')
  return {
    generated_at: retrievedAt,
    status: failed.length ? 'fail' : warnings.length ? 'warn' : 'pass',
    counts: {
      sources: sources.length,
      courses: courses.length,
      official_course_inventory: courseInventory.offerings.length,
      official_course_displayed_count: courseInventory.displayed_count,
      syllabi: syllabi.length,
      structured_syllabi: structuredSyllabusCount,
      assignments: assignments.length,
      structured_assignments: structuredAssignmentCount,
      phase_structured_assignments: phaseStructuredAssignmentCount,
      readings: readings.length,
      normalized_readings: normalizedReadingCount,
      local_catalog_readings: catalogReadingCount,
      canonical_reading_works: readingFrequency.length,
      search_candidates: searchCandidates.length,
      promoted_search_candidates: promotedSearchCandidateCount,
      imported_search_candidates: importedSearchCandidateCount,
      common_crawl_candidates: commonCrawlCandidates.length,
      common_crawl_fetch_candidates: commonCrawlFetchCandidateCount,
      ingested_common_crawl_candidates: ingestedCommonCrawlCandidateCount,
      common_crawl_promotions: commonCrawlPromotions.length,
      successful_common_crawl_promotions: successfulCommonCrawlPromotions,
      ingested_common_crawl_promotions: ingestedCommonCrawlPromotions,
      faculty_profile_candidates: facultyProfileCandidates.length,
      ingested_faculty_profile_candidates: ingestedFacultyProfileCandidateCount,
      faculty_rows_with_profile_urls: facultyRowsWithProfileUrls,
      faculty: faculty.length,
      faculty_course_edges: facultyCourseEdges.length,
      student_work: studentWork.length,
      structured_student_work: structuredStudentWorkCount,
      source_clusters: sourceClusters.length,
      exact_source_clusters: exactSourceClusterCount,
      near_duplicate_source_clusters: nearDuplicateSourceClusterCount,
      related_source_clusters: relatedSourceClusterCount,
      course_packets_with_clustered_evidence: coursePacketsWithClusteredEvidence,
      source_versions: sourceVersions.length,
      fetched_archive_source_versions: fetchedArchiveVersionCount,
      metadata_only_source_versions: metadataOnlyVersionCount,
      wayback: wayback.length,
      review_queue: reviewQueue.length,
      review_decisions: reviewDecisions.length,
      resolved_review_decisions: resolvedReviewDecisionCount,
      field_conflicts: fieldConflicts.length,
    },
    checks,
  }
}

function buildReviewQueue({ sources, courseInventory, syllabi, readings }) {
  const rows = []
  const recoveredSourceIds = new Set(sources.filter((source) => source.extraction_status === 'ok' && source.parent_source_id).map((source) => source.parent_source_id))
  for (const source of sources.filter((source) => source.extraction_status !== 'ok')) {
    if (recoveredSourceIds.has(source.source_id)) continue
    rows.push({
      review_id: `review_${source.source_id}`,
      priority: 'high',
      reason: 'fetch_or_extraction_failed',
      source_id: source.source_id,
      url: source.url,
      action: 'Verify URL manually, check Wayback, or replace with a reachable public source.',
    })
  }
  if (courseInventory.displayed_count && courseInventory.offerings.length !== courseInventory.displayed_count) {
    rows.push({
      review_id: 'review_official_course_inventory_gap',
      priority: 'high',
      reason: 'official_inventory_not_reconciled',
      source_id: 'src_risd_graphic_design_courses_pages',
      url: 'https://www.risd.edu/academics/graphic-design/courses',
      action: `Find the remaining ${courseInventory.displayed_count - courseInventory.offerings.length} public official offerings via Drupal view state, Coursedog, or registrar exports.`,
    })
  }
  const unresolvedReadings = readings.filter((reading) => reading.linking_status === 'unresolved')
  if (readings.length && unresolvedReadings.length / readings.length > 0.5) {
    rows.push({
      review_id: 'review_reading_normalization_backlog',
      priority: 'medium',
      reason: 'reading_normalization_low_confidence',
      action: `Review ${unresolvedReadings.length} unresolved reading snippets and expand the local catalog or tighten extraction patterns.`,
    })
  }
  for (const syllabus of syllabi) {
    const hasSchedule = syllabus.assignment_schedule?.length || syllabus.weekly_schedule_evidence?.length
    const hasAssignments = syllabus.assignments?.length
    const isHighValue = ['syllabus_pdf', 'syllabus_html', 'assignment_page', 'schedule_page'].some((type) => syllabus.source_ids.some((id) => id.includes(type)))
    if (!hasSchedule || !hasAssignments) {
      rows.push({
        review_id: `review_${syllabus.syllabus_id}`,
        priority: isHighValue ? 'medium' : 'low',
        reason: !hasSchedule ? 'missing_schedule_evidence' : 'missing_assignment_evidence',
        syllabus_id: syllabus.syllabus_id,
        source_ids: syllabus.source_ids,
        course_title: syllabus.course_title,
        action: 'Inspect source manually and improve parser or source classification if classroom detail is present.',
      })
    }
  }
  return rows
}

function buildReviewDecisions(reviewQueue, { sources = [], syllabi = [], readings = [] } = {}) {
  const sourcesById = new Map(sources.map((source) => [source.source_id, source]))
  const syllabiById = new Map(syllabi.map((syllabus) => [syllabus.syllabus_id, syllabus]))
  const unresolvedReadings = readings.filter((reading) => reading.linking_status === 'unresolved')

  return reviewQueue.map((row) => {
    const sourceIds = row.source_ids ?? (row.source_id ? [row.source_id] : [])
    const sourceTypes = uniq(sourceIds.map((id) => sourcesById.get(id)?.source_type).filter(Boolean))
    const syllabus = row.syllabus_id ? syllabiById.get(row.syllabus_id) : null
    const base = {
      decision_id: `decision_${row.review_id.replace(/^review_/, '')}`,
      review_id: row.review_id,
      priority: row.priority,
      reason: row.reason,
      source_ids: sourceIds,
      syllabus_id: row.syllabus_id ?? null,
      proposed_action: row.action,
      reviewer: 'corpus_generator',
      decided_at: retrievedAt,
    }

    if (row.reason === 'reading_normalization_low_confidence') {
      return {
        ...base,
        status: 'generated_decision',
        decision: 'parser_backlog_confirmed',
        confidence: 'medium',
        evidence_summary: `${unresolvedReadings.length} of ${readings.length} reading snippets remain unresolved after local catalog matching.`,
        next_parser_action: 'Expand the local reading catalog and add filters for descriptive fragments that are not actual citations.',
        notes: 'Generated from current readings.jsonl linking_status counts; no private source inspection implied.',
      }
    }

    if (row.reason === 'fetch_or_extraction_failed') {
      return {
        ...base,
        status: 'pending_manual_review',
        reviewer: null,
        decided_at: null,
        decision: null,
        confidence: null,
        evidence_summary: `Fetch or extraction is still failed for ${sourceIds.join(', ')}.`,
        next_parser_action: 'Try Wayback fallback, replace URL, or manually verify public access.',
        notes: 'Requires public-source inspection before a generator decision is appropriate.',
      }
    }

    if (!syllabus) {
      return {
        ...base,
        status: 'pending_manual_review',
        reviewer: null,
        decided_at: null,
        decision: null,
        confidence: null,
        evidence_summary: 'No syllabus row is available for this review item.',
        next_parser_action: 'Inspect source manually and decide whether a parser or seed change is required.',
        notes: 'Generated queue item lacks enough structured evidence for automatic resolution.',
      }
    }

    const scheduleEvidenceCount = (syllabus.assignment_schedule?.length ?? 0) + (syllabus.weekly_schedule_evidence?.length ?? 0)
    const assignmentEvidenceCount = syllabus.assignments?.length ?? 0
    const sourceTypeSummary = sourceTypes.length ? sourceTypes.join(', ') : 'unknown source type'

    if (row.reason === 'missing_schedule_evidence') {
      return {
        ...base,
        status: 'generated_decision',
        decision: scheduleEvidenceCount ? 'superseded_by_current_schedule_extraction' : 'keep_schedule_unknown_for_now',
        confidence: scheduleEvidenceCount ? 'high' : 'medium',
        evidence_summary: scheduleEvidenceCount
          ? `${scheduleEvidenceCount} schedule evidence rows are now present on ${syllabus.syllabus_id}.`
          : `${syllabus.syllabus_id} from ${sourceTypeSummary} has ${assignmentEvidenceCount} assignment snippets but no schedule rows in current public evidence.`,
        next_parser_action: scheduleEvidenceCount
          ? 'Remove this row on the next review-queue generation if it recurs.'
          : 'Do not invent schedule structure; search for a companion syllabus, calendar, or archived course page.',
        notes: 'Generated from structured syllabus fields and source metadata.',
      }
    }

    if (row.reason === 'missing_assignment_evidence') {
      return {
        ...base,
        status: 'generated_decision',
        decision: assignmentEvidenceCount ? 'superseded_by_current_assignment_extraction' : 'keep_assignment_unknown_for_now',
        confidence: assignmentEvidenceCount ? 'high' : 'medium',
        evidence_summary: assignmentEvidenceCount
          ? `${assignmentEvidenceCount} assignment snippets are now present on ${syllabus.syllabus_id}.`
          : `${syllabus.syllabus_id} from ${sourceTypeSummary} has ${scheduleEvidenceCount} schedule evidence rows but no assignment prompt snippets in current public evidence.`,
        next_parser_action: assignmentEvidenceCount
          ? 'Remove this row on the next review-queue generation if it recurs.'
          : 'Do not infer prompts from course title alone; search for assignment, project, or critique pages linked to this source family.',
        notes: 'Generated from structured syllabus fields and source metadata.',
      }
    }

    return {
      ...base,
      status: 'pending_manual_review',
      reviewer: null,
      decided_at: null,
      decision: null,
      confidence: null,
      evidence_summary: `No automatic decision rule for ${row.reason}.`,
      next_parser_action: 'Inspect source manually and update the generator if the row is mechanically resolvable.',
      notes: 'Generated fallback pending decision.',
    }
  })
}

function buildFieldConflicts({ courses, syllabi, sourceClusters }) {
  const rows = []
  const addConflicts = (records, recordKind, keyFn, fields) => {
    const groups = new Map()
    for (const record of records) {
      const key = keyFn(record)
      if (!key) continue
      const existing = groups.get(key) ?? []
      existing.push(record)
      groups.set(key, existing)
    }
    for (const [key, group] of groups) {
      if (group.length < 2) continue
      for (const field of fields) {
        const values = uniq(group.map((record) => normalizeConflictValue(record[field])))
        if (values.length < 2) continue
        rows.push({
          conflict_id: `conflict_${recordKind}_${slug(key)}_${field}`,
          record_kind: recordKind,
          entity_key: key,
          field,
          values,
          record_ids: group.map((record) => record.syllabus_id ?? record.course_id ?? record.cluster_id).filter(Boolean),
          source_ids: uniq(group.flatMap((record) => record.source_ids ?? [])),
          severity: conflictSeverity(field, values),
          resolution_status: 'needs_review',
          resolution_hint: conflictResolutionHint(field, values),
        })
      }
    }
  }

  addConflicts(courses, 'course', (course) => course.course_code ?? course.course_title, ['course_title', 'degree_level', 'credits'])
  addConflicts(syllabi, 'syllabus', (syllabus) => syllabus.course_code ?? syllabus.course_title, ['course_title', 'instructor', 'term', 'credits', 'class_time', 'class_location'])

  for (const cluster of sourceClusters) {
    const fieldChecks = [
      ['course_titles', cluster.course_titles],
      ['instructors', cluster.instructors],
      ['terms', cluster.terms],
    ]
    for (const [field, values] of fieldChecks) {
      const normalized = uniq(values.map(normalizeConflictValue))
      if (normalized.length < 2) continue
      rows.push({
        conflict_id: `conflict_source_cluster_${cluster.cluster_id}_${field}`,
        record_kind: 'source_cluster',
        entity_key: cluster.cluster_id,
        field,
        values: normalized,
        record_ids: [cluster.cluster_id],
        source_ids: cluster.source_ids,
        severity: 'medium',
        resolution_status: 'needs_review',
        resolution_hint: 'Inspect related source-family pages before merging or using cluster-level attribution.',
      })
    }
  }

  return rows.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.conflict_id.localeCompare(b.conflict_id))
}

function normalizeConflictValue(value) {
  if (value === null || value === undefined || value === '') return null
  if (Array.isArray(value)) return value.filter(Boolean).join(' | ') || null
  return String(value).replace(/\s+/g, ' ').trim() || null
}

function conflictSeverity(field, values) {
  if (['course_title', 'credits', 'term'].includes(field)) return 'high'
  if (['instructor', 'degree_level', 'class_time'].includes(field)) return 'medium'
  return values.length > 2 ? 'medium' : 'low'
}

function conflictResolutionHint(field) {
  const hints = {
    course_title: 'Prefer official course inventory for current titles; keep historical title variants when source term differs.',
    credits: 'Prefer official course inventory credits unless a full syllabus for the same term contradicts it.',
    term: 'Do not merge records across terms unless they are explicitly the same archived course version.',
    instructor: 'Treat instructor differences as likely section or term variants until corroborated.',
    class_time: 'Treat meeting-time differences as section or term variants.',
    class_location: 'Treat location differences as section or term variants.',
    degree_level: 'Prefer official course inventory level.',
  }
  return hints[field] ?? 'Inspect sources and preserve variants unless the difference is cosmetic.'
}

function severityRank(severity) {
  return { high: 0, medium: 1, low: 2 }[severity] ?? 3
}

function needsFollowupMarkdown({ reviewQueue, reviewDecisions, fieldConflicts }) {
  const highPriority = reviewQueue.filter((row) => row.priority === 'high')
  const mediumPriority = reviewQueue.filter((row) => row.priority === 'medium')
  const unresolvedConflicts = fieldConflicts.filter((row) => row.resolution_status === 'needs_review')
  return `# RISD Graphic Design Needs Follow-Up

Generated: ${retrievedAt}

## Summary

- Review queue rows: ${reviewQueue.length}
- Pending review decisions: ${reviewDecisions.filter((row) => row.status === 'pending_manual_review').length}
- Field conflicts: ${fieldConflicts.length}
- High-priority reviews: ${highPriority.length}
- Medium-priority reviews: ${mediumPriority.length}

## High-Priority Reviews

${highPriority.length ? highPriority.map(formatFollowupReview).join('\n') : '- None'}

## Medium-Priority Reviews

${mediumPriority.length ? mediumPriority.map(formatFollowupReview).join('\n') : '- None'}

## Field Conflicts

${unresolvedConflicts.length ? unresolvedConflicts.map((conflict) => `- ${conflict.severity.toUpperCase()} ${conflict.field} on ${conflict.entity_key}: ${conflict.values.join(' | ')}. ${conflict.resolution_hint}`).join('\n') : '- None'}

## Review Protocol

1. Open the public source URL or source IDs listed in the review row.
2. Decide whether the artifact contains recoverable syllabus, schedule, assignment, reading, critique, grading, or student-work evidence.
3. Update \`review_decisions.jsonl\` with the decision, reviewer, date, and notes.
4. If a parser improvement is needed, change the generator and regenerate the corpus instead of editing derived artifacts by hand.
`
}

function formatFollowupReview(row) {
  const target = row.course_title ?? row.source_id ?? row.syllabus_id ?? row.review_id
  const ids = row.source_ids?.length ? ` sources: ${row.source_ids.join(', ')}` : row.source_id ? ` source: ${row.source_id}` : ''
  return `- ${row.reason}: ${target}.${ids} Action: ${row.action}`
}

function reviewQueueMarkdown(rows) {
  return `# RISD Graphic Design Review Queue

Generated: ${retrievedAt}

Rows: ${rows.length}

${rows.map((row) => `- ${row.priority.toUpperCase()} ${row.reason}: ${row.course_title ?? row.source_id ?? row.syllabus_id ?? row.review_id ?? row.action}${row.url ? ` (${row.url})` : ''}`).join('\n')}
`
}

function validationMarkdown(validation) {
  return `# RISD Graphic Design Corpus Validation

Generated: ${validation.generated_at}

Overall status: ${validation.status}

## Counts

- Sources: ${validation.counts.sources}
- Courses: ${validation.counts.courses}
- Official course inventory: ${validation.counts.official_course_inventory}
- RISD displayed course count: ${validation.counts.official_course_displayed_count || 'unknown'}
- Syllabi/course artifacts: ${validation.counts.syllabi}
- Structured syllabus records: ${validation.counts.structured_syllabi}
- Assignments: ${validation.counts.assignments}
- Structured assignment snippets: ${validation.counts.structured_assignments}
- Studio-phase assignment snippets: ${validation.counts.phase_structured_assignments}
- Readings: ${validation.counts.readings}
- Normalized reading snippets: ${validation.counts.normalized_readings}
- Canonical reading works: ${validation.counts.canonical_reading_works}
- Local catalog reading matches: ${validation.counts.local_catalog_readings}
- Search candidates: ${validation.counts.search_candidates}
- Promoted search candidates: ${validation.counts.promoted_search_candidates}
- Imported search candidates: ${validation.counts.imported_search_candidates}
- Common Crawl candidates: ${validation.counts.common_crawl_candidates}
- Common Crawl fetch candidates: ${validation.counts.common_crawl_fetch_candidates}
- Ingested Common Crawl candidates: ${validation.counts.ingested_common_crawl_candidates}
- Common Crawl promotions: ${validation.counts.common_crawl_promotions}
- Successful Common Crawl promotions: ${validation.counts.successful_common_crawl_promotions}
- Ingested Common Crawl promotions: ${validation.counts.ingested_common_crawl_promotions}
- Faculty profile candidates: ${validation.counts.faculty_profile_candidates}
- Ingested faculty profile candidates: ${validation.counts.ingested_faculty_profile_candidates}
- Faculty rows with profile URLs: ${validation.counts.faculty_rows_with_profile_urls}
- Faculty rows: ${validation.counts.faculty}
- Faculty-course edges: ${validation.counts.faculty_course_edges}
- Student work rows: ${validation.counts.student_work}
- Structured student work rows: ${validation.counts.structured_student_work}
- Source clusters: ${validation.counts.source_clusters}
- Exact duplicate clusters: ${validation.counts.exact_source_clusters}
- Near-duplicate source clusters: ${validation.counts.near_duplicate_source_clusters}
- Related source-family clusters: ${validation.counts.related_source_clusters}
- Course packets with clustered evidence: ${validation.counts.course_packets_with_clustered_evidence}
- Source versions: ${validation.counts.source_versions}
- Fetched archive source comparisons: ${validation.counts.fetched_archive_source_versions}
- Metadata-only source versions: ${validation.counts.metadata_only_source_versions}
- Wayback captures: ${validation.counts.wayback}
- Review queue rows: ${validation.counts.review_queue}
- Review decision rows: ${validation.counts.review_decisions}
- Resolved generated review decisions: ${validation.counts.resolved_review_decisions}
- Field conflicts: ${validation.counts.field_conflicts}

## Checks

${validation.checks.map((check) => `- ${check.status.toUpperCase()} ${check.id}: ${check.detail}`).join('\n')}
`
}

function buildClusterLookups(sourceClusters) {
  const clusterBySourceId = new Map()
  const clusterById = new Map()
  for (const cluster of sourceClusters ?? []) {
    clusterById.set(cluster.cluster_id, cluster)
    for (const sourceId of cluster.source_ids ?? []) {
      clusterBySourceId.set(sourceId, cluster)
    }
  }
  return { clusterBySourceId, clusterById }
}

function clusteredEvidenceFamilies({ sourceIds, sourcesById, clusterBySourceId }) {
  const families = new Map()
  for (const sourceId of sourceIds) {
    const cluster = clusterBySourceId.get(sourceId)
    const key = cluster?.cluster_id ?? `single_${sourceId}`
    const existing = families.get(key) ?? {
      cluster_id: cluster?.cluster_id ?? null,
      cluster_type: cluster?.cluster_type ?? 'single_source',
      representative_source_id: cluster?.representative_source_id ?? sourceId,
      collapse_recommendation: cluster?.collapse_recommendation ?? 'single_source',
      source_ids: [],
      source_types: [],
      source_titles: [],
    }
    existing.source_ids = uniq([...existing.source_ids, sourceId])
    const source = sourcesById.get(sourceId)
    existing.source_types = uniq([...existing.source_types, source?.source_type].filter(Boolean))
    existing.source_titles = uniq([...existing.source_titles, source?.title ?? source?.course_title].filter(Boolean)).slice(0, 4)
    families.set(key, existing)
  }
  return [...families.values()].sort((a, b) => b.source_ids.length - a.source_ids.length || a.representative_source_id.localeCompare(b.representative_source_id))
}

function reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, studentWork, wayback, sourceClusters = [] }) {
  const lines = []
  const sourcesById = new Map(sources.map((source) => [source.source_id, source]))
  const { clusterBySourceId } = buildClusterLookups(sourceClusters)
  lines.push('# RISD Graphic Design Corpus Reconstruction')
  lines.push('')
  lines.push(`Generated: ${retrievedAt}`)
  lines.push('')
  lines.push('## Coverage Summary')
  lines.push('')
  lines.push(`- Sources inspected: ${sources.length}`)
  lines.push(`- Course records created: ${courses.length}`)
  lines.push(`- Syllabus/course-site records: ${syllabi.length}`)
  lines.push(`- Assignment evidence snippets: ${assignments.length}`)
  lines.push(`- Reading evidence snippets: ${readings.length}`)
  lines.push(`- Student work evidence records: ${studentWork.length}`)
  lines.push(`- Source clusters used for packet grouping: ${sourceClusters.length}`)
  lines.push(`- Wayback capture records: ${wayback.length}`)
  lines.push('')
  lines.push('## Reconstructed Course Packets')
  lines.push('')

  for (const course of courses) {
    const courseSyllabi = syllabi.filter((s) => (s.course_code && course.course_code && s.course_code === course.course_code) || (s.course_title && course.course_title && s.course_title === course.course_title) || s.source_ids.some((id) => course.source_ids.includes(id)))
    const courseAssignments = assignments.filter((a) => courseSyllabi.some((s) => s.syllabus_id === a.syllabus_id))
    const courseReadings = readings.filter((r) => courseSyllabi.some((s) => s.syllabus_id === r.syllabus_id))
    const courseStudentWork = studentWork.filter((work) => (work.course_code && course.course_code && work.course_code === course.course_code) || (work.course_title && course.course_title && work.course_title === course.course_title) || work.source_ids.some((id) => course.source_ids.includes(id)))
    const packetSourceIds = uniq([
      ...course.source_ids,
      ...courseSyllabi.flatMap((s) => s.source_ids),
      ...courseAssignments.flatMap((a) => a.source_ids),
      ...courseReadings.flatMap((r) => r.source_ids),
      ...courseStudentWork.flatMap((work) => work.source_ids),
    ])
    const evidenceFamilies = clusteredEvidenceFamilies({ sourceIds: packetSourceIds, sourcesById, clusterBySourceId })
    const clusteredFamilyCount = evidenceFamilies.filter((family) => family.cluster_id).length
    lines.push(`### ${(course.course_title ?? course.course_code ?? course.course_id).trim()}`)
    lines.push('')
    lines.push(`- Evidence grade: ${course.evidence_grade}`)
    lines.push(`- Course code: ${course.course_code ?? 'unknown'}`)
    lines.push(`- Degree level: ${course.degree_level}`)
    lines.push(`- Source IDs: ${course.source_ids.join(', ')}`)
    if (evidenceFamilies.length) {
      lines.push(`- Evidence families: ${evidenceFamilies.length}${clusteredFamilyCount ? ` (${clusteredFamilyCount} source-cluster grouped)` : ''}`)
      evidenceFamilies.slice(0, 6).forEach((family) => {
        const label = family.cluster_id
          ? `${family.cluster_id}; representative ${family.representative_source_id}; ${family.source_ids.length} packet source${family.source_ids.length === 1 ? '' : 's'}; ${family.collapse_recommendation}`
          : `${family.representative_source_id}; single source`
        const titles = family.source_titles.length ? `; ${family.source_titles.join(' / ')}` : ''
        lines.push(`  - ${label}${titles}`)
      })
    }
    if (course.skills.length) lines.push(`- Extracted skill signals: ${course.skills.join(', ')}`)
    if (courseSyllabi.length) {
      for (const syllabus of courseSyllabi) {
        lines.push(`- Syllabus/course artifact: ${syllabus.syllabus_id}`)
        if (syllabus.instructor) lines.push(`- Instructor: ${syllabus.instructor}`)
        if (syllabus.term) lines.push(`- Term: ${syllabus.term}`)
        if (syllabus.tools.length) lines.push(`- Tools mentioned: ${syllabus.tools.join(', ')}`)
        if (syllabus.materials.length) lines.push(`- Materials mentioned: ${syllabus.materials.join(', ')}`)
        if (syllabus.policies.length) lines.push(`- Policy evidence: ${syllabus.policies.slice(0, 3).join(' / ')}`)
        if (syllabus.description) lines.push(`- Description evidence: ${syllabus.description.slice(0, 500)}`)
        if (syllabus.learning_outcomes?.length) {
          lines.push('- Learning outcomes:')
          syllabus.learning_outcomes.slice(0, 5).forEach((outcome) => lines.push(`  - ${outcome}`))
        }
        if (syllabus.grading_rubric) lines.push(`- Grading/assessment evidence: ${syllabus.grading_rubric.slice(0, 500)}`)
        if (syllabus.assignment_schedule?.length) {
          lines.push('- Schedule rows:')
          syllabus.assignment_schedule.slice(0, 6).forEach((row) => lines.push(`  - ${row.date}: ${row.assignment_or_reading ?? row.topic}`))
        }
        if (syllabus.weekly_schedule_evidence.length) {
          lines.push('- Weekly/class structure evidence:')
          syllabus.weekly_schedule_evidence.slice(0, 6).forEach((snippet) => lines.push(`  - ${snippet}`))
        }
      }
    }
    if (courseReadings.length) {
      lines.push('- Reading evidence:')
      courseReadings.slice(0, 8).forEach((reading) => lines.push(`  - ${reading.title ? `${reading.title}${reading.author ? `, ${reading.author}` : ''}` : reading.citation_excerpt} (${reading.linking_status})`))
    }
    if (courseAssignments.length) {
      lines.push('- Assignment/critique evidence:')
      courseAssignments.slice(0, 10).forEach((assignment) => {
        const structured = [
          assignment.deliverables?.length ? `deliverables: ${assignment.deliverables.join(', ')}` : null,
          assignment.constraints?.length ? `constraints: ${assignment.constraints.join(', ')}` : null,
          assignment.assignment_type ? `type: ${assignment.assignment_type}` : null,
          assignment.studio_phases?.length ? `phases: ${assignment.studio_phases.join(', ')}` : null,
          assignment.output_format ? `output: ${assignment.output_format}` : null,
          assignment.critique_format ? `critique: ${assignment.critique_format}` : null,
          assignment.revision_expectation ? `revision: ${assignment.revision_expectation}` : null,
          assignment.tacit_goal ? `tacit goal: ${assignment.tacit_goal}` : null,
        ].filter(Boolean)
        lines.push(`  - ${assignment.prompt_excerpt}${structured.length ? ` (${structured.join('; ')})` : ''}`)
      })
    }
    if (courseStudentWork.length) {
      lines.push('- Public student work examples:')
      courseStudentWork.slice(0, 6).forEach((work) => {
        const notes = [
          work.medium ? `medium: ${work.medium}` : null,
          work.assignment_link_confidence ? `assignment link: ${work.assignment_link_confidence}` : null,
          work.visual_standard_notes?.length ? `visual notes: ${work.visual_standard_notes.join('; ')}` : null,
        ].filter(Boolean)
        lines.push(`  - ${work.project_title ?? work.url}: ${work.url}${notes.length ? ` (${notes.join('; ')})` : ''}`)
      })
    }
    lines.push('- Tacit reconstruction:')
    lines.push(`  - Direct evidence currently supports ${courseSyllabi.length ? 'a course-specific classroom reconstruction' : 'program/catalog-level placement only'}.`)
    lines.push(`  - Skill training signals: ${course.skills.length ? course.skills.join(', ') : 'not enough course-specific evidence yet'}.`)
    lines.push('  - Any missing weekly schedule, grading rubric, or assignment sequence must remain marked as unknown until another syllabus/course artifact is found.')
    lines.push('')
  }

  lines.push('## Source Index')
  lines.push('')
  for (const source of sources.sort((a, b) => (sourceTypeRank[a.source_type] ?? 99) - (sourceTypeRank[b.source_type] ?? 99))) {
    lines.push(`- ${source.source_id} (${source.confidence}, ${source.source_type}): ${source.url}`)
  }
  lines.push('')
  return lines.map((line) => line.trimEnd()).join('\n')
}

function auditMarkdown({ sources, searchQueries, wayback, validation }) {
  const ok = sources.filter((source) => source.extraction_status === 'ok')
  const failed = sources.filter((source) => source.extraction_status !== 'ok')
  return `# RISD Graphic Design Source Audit

Generated: ${retrievedAt}

## Fetch Results

- Successful extractions: ${ok.length}
- Failed or empty extractions: ${failed.length}
- Wayback captures recorded: ${wayback.length}
- Wayback source cap for this run: ${waybackMaxSources}
- Validation status: ${validation.status}

## Failed Or Empty Sources

${failed.length ? failed.map((source) => `- ${source.source_id}: ${source.extraction_status}${source.error ? ` (${source.error})` : ''}`).join('\n') : '- None'}

## Search Query Backlog

These queries define the next discovery pass. They are intentionally stored because generic search results are not reproducible unless captured.

${searchQueries.map((query) => `- \`${query}\``).join('\n')}

## Access Boundaries

- Only public web URLs were fetched.
- No login-only LMS, Canvas, Blackboard, private Google Drive, private student group, or paywalled content was accessed.
- Raw PDFs/HTML are not committed by this script; committed artifacts are structured source metadata, excerpts, and reconstructions.
- Student/social evidence is treated as low-confidence unless corroborated by official or course-artifact sources.
`
}

function tacitMemoMarkdown({ syllabi, assignments, studentWork }) {
  const assignmentSkills = uniq(assignments.flatMap((assignment) => assignment.skills_trained))
  const critiqueEvidence = assignments.filter((assignment) => /crit/i.test(assignment.prompt_excerpt))
  return `# RISD Graphic Design Tacit Knowledge Memo

Generated: ${retrievedAt}

## Current Evidence Base

This memo is generated from the first implemented corpus pass. It is strongest where public syllabi or course sites were found and weakest where only official catalog/program pages exist.

- Syllabus/course-site records: ${syllabi.length}
- Assignment evidence snippets: ${assignments.length}
- Critique-related snippets: ${critiqueEvidence.length}
- Student work records: ${studentWork.length}

## Studio Norms Visible In The Corpus

- Public course artifacts emphasize making through projects, exercises, and critique rather than lecture-only learning.
- Course evidence points to graphic design as a sequence of material outputs: typography, image, publication, motion, interaction, and identity/system work.
- RISD's own syllabus guidance frames courses around learning outcomes, assignment design, and assessment clarity, which should be used as the reconstruction standard when a recovered syllabus is partial.

## Skill Signals

${assignmentSkills.length ? assignmentSkills.map((skill) => `- ${skill}`).join('\n') : '- Not enough assignment-level evidence has been extracted yet.'}

## Critique And Revision

${critiqueEvidence.length ? critiqueEvidence.slice(0, 8).map((assignment) => `- ${assignment.prompt_excerpt}`).join('\n') : '- Critique is expected in studio courses, but this corpus pass has limited direct critique-format evidence.'}

## Reconstruction Rule

For self-study, convert every recovered assignment into a three-part loop:

1. Produce the assigned object under the original constraints.
2. Compare it against public RISD student work or faculty examples when available.
3. Revise with a written critique focused on form, hierarchy, material choice, concept, and execution.
`
}

const curriculumTracks = [
  {
    track_id: 'foundation_studio',
    title: 'Foundation Studio And Design Process',
    match: /design studio|introduction to graphic design|intro|form|composition|visual/i,
    studio_loop: 'Make a constrained visual system, present it for critique, revise it from formal and conceptual feedback, and document the before/after decision trail.',
  },
  {
    track_id: 'typography',
    title: 'Typography And Reading Systems',
    match: /type|typography|letter|text|publication/i,
    studio_loop: 'Set text under explicit hierarchy, spacing, scale, and sequencing constraints; test readability; revise based on optical and semantic clarity.',
  },
  {
    track_id: 'publication_editorial',
    title: 'Publication, Editorial, And Sequencing',
    match: /publication|publishing|book|editorial|magazine|print/i,
    studio_loop: 'Turn source material into a paced artifact with spreads, image/text relationships, production constraints, and a defensible editorial position.',
  },
  {
    track_id: 'interaction_web',
    title: 'Interaction, Web, And Computational Form',
    match: /web|programming|interaction|interface|html|css|javascript|code/i,
    studio_loop: 'Build a working browser artifact, critique the behavior as design material, and revise both interface and code structure.',
  },
  {
    track_id: 'motion_time',
    title: 'Motion, Time, And Screen-Based Design',
    match: /motion|video|animation|time|screen/i,
    studio_loop: 'Design a time-based sequence with typography, image, pacing, and sound or silence treated as compositional constraints.',
  },
  {
    track_id: 'systems_identity',
    title: 'Identity, Systems, And Public Context',
    match: /identity|brand|system|politic|public|social|campaign/i,
    studio_loop: 'Define a visual system that can survive multiple contexts, then test it through applications and critique the social reading of the system.',
  },
]

function curriculumTrackForCourse(course, courseAssignments, courseReadings) {
  const haystack = [
    course.course_title,
    course.course_code,
    course.skills?.join(' '),
    courseAssignments.map((assignment) => assignment.prompt_excerpt).join(' '),
    courseReadings.map((reading) => `${reading.title ?? ''} ${reading.raw_citation ?? ''}`).join(' '),
  ].filter(Boolean).join(' ')
  return curriculumTracks.find((track) => track.match.test(haystack)) ?? curriculumTracks[0]
}

function courseEvidenceScore({ course, courseSyllabi, courseAssignments, courseReadings, courseStudentWork }) {
  const gradeScore = { A: 80, B: 60, C: 35, D: 15 }[course.evidence_grade] ?? 0
  return gradeScore
    + Math.min(courseSyllabi.length * 8, 24)
    + Math.min(courseAssignments.length * 2, 30)
    + Math.min(courseReadings.length, 12)
    + Math.min(courseStudentWork.length * 3, 12)
}

function curriculumCoursePackets({ courses, syllabi, assignments, readings, studentWork }) {
  return courses.map((course) => {
    const courseSyllabi = syllabi.filter((s) => (s.course_code && course.course_code && s.course_code === course.course_code) || (s.course_title && course.course_title && s.course_title === course.course_title) || s.source_ids.some((id) => course.source_ids.includes(id)))
    const courseAssignments = assignments.filter((a) => courseSyllabi.some((s) => s.syllabus_id === a.syllabus_id))
    const courseReadings = readings.filter((r) => courseSyllabi.some((s) => s.syllabus_id === r.syllabus_id))
    const courseStudentWork = studentWork.filter((work) => (work.course_code && course.course_code && work.course_code === course.course_code) || (work.course_title && course.course_title && work.course_title === course.course_title) || work.source_ids.some((id) => course.source_ids.includes(id)))
    const track = curriculumTrackForCourse(course, courseAssignments, courseReadings)
    return {
      course,
      track,
      courseSyllabi,
      courseAssignments,
      courseReadings,
      courseStudentWork,
      score: courseEvidenceScore({ course, courseSyllabi, courseAssignments, courseReadings, courseStudentWork }),
    }
  }).sort((a, b) => b.score - a.score || String(a.course.course_title ?? '').localeCompare(String(b.course.course_title ?? '')))
}

function curriculumPacketKey(packet) {
  const course = packet.course
  return slug(course.course_title ?? course.course_code ?? course.course_id)
}

function selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, studentWork }) {
  const packets = curriculumCoursePackets({ courses, syllabi, assignments, readings, studentWork })
  const strongPackets = packets.filter((packet) => packet.courseAssignments.length || packet.courseReadings.length || packet.courseSyllabi.some((syllabus) => syllabus.assignment_schedule?.length))
  const selected = []
  const selectedKeys = new Set()
  for (const track of curriculumTracks) {
    const trackPackets = strongPackets.filter((packet) => packet.track.track_id === track.track_id)
    for (const packet of trackPackets) {
      const key = curriculumPacketKey(packet)
      if (selectedKeys.has(key)) continue
      selected.push(packet)
      selectedKeys.add(key)
      if (selected.filter((selectedPacket) => selectedPacket.track.track_id === track.track_id).length >= 4) break
    }
  }
  for (const packet of strongPackets) {
    const key = curriculumPacketKey(packet)
    if (selectedKeys.has(key)) continue
    selected.push(packet)
    selectedKeys.add(key)
    if (selected.length >= 24) break
  }

  const lines = []
  lines.push('# RISD Graphic Design Self-Study Curriculum')
  lines.push('')
  lines.push(`Generated: ${retrievedAt}`)
  lines.push('')
  lines.push('## Evidence Boundary')
  lines.push('')
  lines.push('This curriculum is generated from public RISD Graphic Design corpus artifacts. It is not an official RISD program map and it does not infer private classroom content. Each module names the source-grounded course evidence it uses, then translates recovered assignments, readings, student work, and critique signals into a self-study studio loop.')
  lines.push('')
  lines.push(`- Course records considered: ${courses.length}`)
  lines.push(`- Syllabus/course-site records considered: ${syllabi.length}`)
  lines.push(`- Assignment evidence snippets considered: ${assignments.length}`)
  lines.push(`- Reading evidence snippets considered: ${readings.length}`)
  lines.push(`- Public student-work records considered: ${studentWork.length}`)
  lines.push(`- Curriculum modules generated: ${selected.length}`)
  lines.push('')
  lines.push('## How To Use This')
  lines.push('')
  lines.push('1. Treat each module as a studio brief, not a lecture topic.')
  lines.push('2. Produce visible artifacts every week: sketches, type studies, prototypes, publications, motion tests, or systems.')
  lines.push('3. Write a critique memo after each artifact using the recovered constraints and skill signals.')
  lines.push('4. Revise the artifact once before moving on; the revision is part of the assignment.')
  lines.push('5. Keep unknowns explicit when the corpus lacks a schedule, rubric, or complete brief.')
  lines.push('')
  lines.push('## Studio Tracks')
  lines.push('')
  for (const track of curriculumTracks) {
    const trackPackets = selected.filter((packet) => packet.track.track_id === track.track_id)
    if (!trackPackets.length) continue
    lines.push(`### ${track.title}`)
    lines.push('')
    lines.push(`Studio loop: ${track.studio_loop}`)
    lines.push('')
    for (const packet of trackPackets) {
      const { course, courseSyllabi, courseAssignments, courseReadings, courseStudentWork } = packet
      lines.push(`#### ${course.course_title ?? course.course_code ?? course.course_id}`)
      lines.push('')
      lines.push(`- Evidence grade: ${course.evidence_grade}`)
      lines.push(`- Course code: ${course.course_code ?? 'unknown'}`)
      lines.push(`- Source IDs: ${course.source_ids.join(', ')}`)
      if (courseSyllabi.length) lines.push(`- Syllabus/course artifacts: ${courseSyllabi.map((syllabus) => syllabus.syllabus_id).join(', ')}`)
      const instructors = uniq(courseSyllabi.map((syllabus) => syllabus.instructor).filter(Boolean))
      if (instructors.length) lines.push(`- Instructor evidence: ${instructors.join(', ')}`)
      const tools = uniq(courseSyllabi.flatMap((syllabus) => syllabus.tools ?? [])).slice(0, 8)
      if (tools.length) lines.push(`- Tools/software/materials to practice: ${tools.join(', ')}`)
      const skills = uniq([...course.skills, ...courseAssignments.flatMap((assignment) => assignment.skills_trained ?? [])]).slice(0, 10)
      if (skills.length) lines.push(`- Skill targets: ${skills.join(', ')}`)
      if (courseReadings.length) {
        lines.push('- Reading packet:')
        courseReadings.slice(0, 6).forEach((reading) => {
          const title = reading.title ?? reading.raw_citation ?? reading.citation_excerpt
          lines.push(`  - ${title}${reading.author ? `, ${reading.author}` : ''}${reading.required_or_recommended ? ` (${reading.required_or_recommended})` : ''}`)
        })
      }
      if (courseAssignments.length) {
        lines.push('- Studio briefs to recreate:')
        courseAssignments.slice(0, 6).forEach((assignment) => {
          const assignmentTitle = assignment.title && assignment.title !== 'null' ? assignment.title : 'Recovered brief'
          const details = [
            assignment.deliverables?.length ? `deliverables: ${assignment.deliverables.join(', ')}` : null,
            assignment.constraints?.length ? `constraints: ${assignment.constraints.join(', ')}` : null,
            assignment.assignment_type ? `type: ${assignment.assignment_type}` : null,
            assignment.studio_phases?.length ? `phases: ${assignment.studio_phases.join(', ')}` : null,
            assignment.output_format ? `output: ${assignment.output_format}` : null,
            assignment.critique_format ? `critique: ${assignment.critique_format}` : null,
            assignment.revision_expectation ? `revision: ${assignment.revision_expectation}` : null,
          ].filter(Boolean)
          lines.push(`  - ${assignmentTitle}: ${assignment.prompt_excerpt}${details.length ? ` (${details.join('; ')})` : ''}`)
        })
      }
      if (courseStudentWork.length) {
        lines.push('- Public comparison set:')
        courseStudentWork.slice(0, 4).forEach((work) => lines.push(`  - ${work.project_title ?? work.url}: ${work.url}`))
      }
      lines.push('- Mentor-style checkpoint:')
      lines.push('  - What exactly did you make, what constraints did you honor, what changed after critique, and what evidence shows the work improved?')
      lines.push('')
    }
  }
  lines.push('## Gaps To Preserve')
  lines.push('')
  lines.push('- Do not invent missing rubrics, grades, private readings, or complete assignment sheets.')
  lines.push('- Prefer direct course-site and syllabus evidence over catalog descriptions when they disagree.')
  lines.push('- Use public student work as a comparison set only when the source provides course or assignment context.')
  lines.push('- Keep adding modules as search, faculty-profile, Wayback, and Common Crawl discovery recover more course artifacts.')
  lines.push('')
  return lines.map((line) => line.trimEnd()).join('\n')
}

function loadJsonl(path) {
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf8').trim()
  if (!raw) return []
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

function renderSelfStudyCurriculumOnly() {
  ensureDir(outDir)
  const courses = loadJsonl(join(outDir, 'courses.jsonl'))
  const syllabi = loadJsonl(join(outDir, 'syllabi.jsonl'))
  const assignments = loadJsonl(join(outDir, 'assignments.jsonl'))
  const readings = loadJsonl(join(outDir, 'readings.jsonl'))
  const studentWork = loadJsonl(join(outDir, 'student_work.jsonl'))
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, studentWork }))
  console.log(`RISD self-study curriculum written to ${join(outDir, 'self_study_curriculum.md')}`)
  console.log(`courses=${courses.length} syllabi=${syllabi.length} assignments=${assignments.length} readings=${readings.length} student_work=${studentWork.length}`)
}

function renderDerivedArtifactsOnly() {
  ensureDir(outDir)
  const sources = loadJsonl(join(outDir, 'sources.jsonl'))
  const courseInventoryRows = loadJsonl(join(outDir, 'course_inventory.jsonl'))
  const courses = loadJsonl(join(outDir, 'courses.jsonl'))
  const syllabi = loadJsonl(join(outDir, 'syllabi.jsonl'))
  const assignments = buildAssignments(syllabi)
  const readings = loadJsonl(join(outDir, 'readings.jsonl'))
  const readingFrequency = loadJsonl(join(outDir, 'reading_frequency.jsonl'))
  const searchCandidates = loadJsonl(join(outDir, 'search_candidates.jsonl'))
  const commonCrawlCandidates = loadJsonl(join(outDir, 'common_crawl_candidates.jsonl'))
  const commonCrawlPromotions = loadJsonl(join(outDir, 'common_crawl_promotions.jsonl'))
  const facultyProfileCandidates = loadJsonl(join(outDir, 'faculty_profile_candidates.jsonl'))
  const faculty = loadJsonl(join(outDir, 'faculty.jsonl'))
  const facultyCourseEdges = loadJsonl(join(outDir, 'faculty_course_edges.jsonl'))
  const studentWork = loadJsonl(join(outDir, 'student_work.jsonl'))
  const sourceClusters = loadJsonl(join(outDir, 'source_clusters.jsonl'))
  const sourceVersions = loadJsonl(join(outDir, 'source_versions.jsonl'))
  const wayback = loadJsonl(join(outDir, 'wayback_captures.jsonl'))
  const previousValidation = existsSync(join(outDir, 'validation.json')) ? JSON.parse(readFileSync(join(outDir, 'validation.json'), 'utf8')) : null
  const courseInventory = {
    offerings: courseInventoryRows,
    displayed_count: previousValidation?.counts?.official_course_displayed_count ?? courseInventoryRows.length,
  }
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings })
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters })
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, searchCandidates, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts })
  writeJsonl(join(outDir, 'assignments.jsonl'), assignments)
  writeJsonl(join(outDir, 'review_queue.jsonl'), reviewQueue)
  writeJsonl(join(outDir, 'review_decisions.jsonl'), reviewDecisions)
  writeJsonl(join(outDir, 'field_conflicts.jsonl'), fieldConflicts)
  writeFileSync(join(outDir, 'review_queue.md'), reviewQueueMarkdown(reviewQueue))
  writeFileSync(join(outDir, 'needs_followup.md'), needsFollowupMarkdown({ reviewQueue, reviewDecisions, fieldConflicts }))
  writeJson(join(outDir, 'validation.json'), validationWithReview)
  writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validationWithReview))
  writeFileSync(join(outDir, 'course_reconstruction.md'), reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, studentWork, wayback, sourceClusters }))
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork }))
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, studentWork }))
  console.log(`RISD derived artifacts written to ${outDir}`)
  console.log(`assignments=${assignments.length} phase_structured_assignments=${validationWithReview.counts.phase_structured_assignments} validation=${validationWithReview.status}`)
}

async function renderCommonCrawlOnly() {
  ensureDir(outDir)
  const commonCrawlCandidates = await buildCommonCrawlCandidates()
  writeJsonl(join(outDir, 'common_crawl_candidates.jsonl'), commonCrawlCandidates)
  console.log(`RISD Common Crawl candidates written to ${join(outDir, 'common_crawl_candidates.jsonl')}`)
  console.log(`common_crawl_candidates=${commonCrawlCandidates.length} fetch_candidates=${commonCrawlCandidates.filter((row) => row.candidate_status === 'candidate_for_public_fetch').length}`)
}

async function renderCommonCrawlPromotionOnly() {
  ensureDir(outDir)
  const { candidates, promotions, newPromotions } = await promoteCommonCrawlCandidates()
  console.log(`RISD Common Crawl promotions written to ${join(outDir, 'common_crawl_promotions.jsonl')}`)
  console.log(`new_promotions=${newPromotions.length} total_promotions=${promotions.length} successful_promotions=${promotions.filter((row) => row.extraction_status === 'ok').length} remaining_fetch_candidates=${candidates.filter((row) => row.candidate_status === 'candidate_for_public_fetch').length}`)
}

async function ingestCommonCrawlPromotionsOnly() {
  ensureDir(outDir)
  const existingSources = loadJsonl(join(outDir, 'sources.jsonl'))
  const sourceIds = new Set(existingSources.map((source) => source.source_id))
  const promotions = loadJsonl(join(outDir, 'common_crawl_promotions.jsonl'))
  const candidates = loadJsonl(join(outDir, 'common_crawl_candidates.jsonl'))
  const selectedPromotions = promotions
    .filter((promotion) => promotion.extraction_status === 'ok' && promotion.promoted_source_id && !promotion.ingestion_status)
    .filter((promotion) => !sourceIds.has(promotion.promoted_source_id))
    .slice(0, commonCrawlIngestLimit)

  const inspected = []
  for (const [index, promotion] of selectedPromotions.entries()) {
    console.error(`ingest common crawl promotion ${index + 1}/${selectedPromotions.length}: ${promotion.url}`)
    inspected.push(await inspectSeed({
      source_id: promotion.promoted_source_id,
      url: promotion.url,
      source_type: promotion.source_type,
      authority: promotion.authority,
      confidence: promotion.confidence,
      course_title: courseTitleFromCommonCrawlUrl(promotion.url, promotion.title),
      notes: promotion.notes,
    }))
  }

  const successfulInspections = inspected.filter(({ source }) => source.extraction_status === 'ok')
  const failedInspections = inspected.filter(({ source }) => source.extraction_status !== 'ok')
  const ingestedSourceIds = new Set(successfulInspections.map(({ source }) => source.source_id))
  const failedSourceIds = new Set(failedInspections.map(({ source }) => source.source_id))
  const updatedPromotions = promotions.map((promotion) => ingestedSourceIds.has(promotion.promoted_source_id)
    ? { ...promotion, ingestion_status: 'ingested_into_corpus', ingested_at: retrievedAt }
    : failedSourceIds.has(promotion.promoted_source_id)
      ? { ...promotion, ingestion_status: 'ingestion_fetch_failed', ingested_at: retrievedAt }
    : promotion)

  const updatedCandidates = candidates.map((candidate) => {
    const promotion = updatedPromotions.find((row) => row.candidate_id === candidate.candidate_id && row.ingestion_status)
    if (!promotion) return candidate
    return promotion.ingestion_status === 'ingested_into_corpus'
      ? { ...candidate, candidate_status: 'ingested_into_corpus', ingested_source_id: promotion.promoted_source_id }
      : { ...candidate, candidate_status: 'ingestion_fetch_failed', ingested_source_id: null }
  })

  const newSources = successfulInspections.map(({ source }) => source)
  const sources = mergeRowsByKey(existingSources, newSources, (source) => source.source_id)
  const courseInventoryRows = loadJsonl(join(outDir, 'course_inventory.jsonl'))
  const previousValidation = existsSync(join(outDir, 'validation.json')) ? JSON.parse(readFileSync(join(outDir, 'validation.json'), 'utf8')) : null
  const courseInventory = {
    offerings: courseInventoryRows,
    displayed_count: previousValidation?.counts?.official_course_displayed_count ?? courseInventoryRows.length,
  }
  const existingCourses = loadJsonl(join(outDir, 'courses.jsonl'))
  const existingSyllabi = loadJsonl(join(outDir, 'syllabi.jsonl'))
  const existingAssignments = loadJsonl(join(outDir, 'assignments.jsonl'))
  const existingReadings = loadJsonl(join(outDir, 'readings.jsonl'))
  const existingStudentWork = loadJsonl(join(outDir, 'student_work.jsonl'))
  const newCourses = buildCourses(successfulInspections)
  const newSyllabi = buildSyllabi(successfulInspections)
  const newAssignments = buildAssignments(newSyllabi)
  const newReadings = buildReadings(newSyllabi)
  const newStudentWork = buildStudentWork(successfulInspections)
  const courses = mergeRowsByKey(existingCourses, newCourses, (course) => course.course_id, (left, right) => ({
    ...left,
    ...right,
    source_ids: uniq([...(left.source_ids ?? []), ...(right.source_ids ?? [])]),
    skills: uniq([...(left.skills ?? []), ...(right.skills ?? [])]),
  })).sort((a, b) => (a.course_title ?? '').localeCompare(b.course_title ?? ''))
  const syllabi = mergeRowsByKey(existingSyllabi, newSyllabi, (syllabus) => syllabus.syllabus_id)
  const assignments = mergeRowsByKey(existingAssignments, newAssignments, (assignment) => assignment.assignment_id)
  const readings = mergeRowsByKey(existingReadings, newReadings, (reading) => reading.reading_id)
  const readingFrequency = buildReadingFrequency(readings)
  const studentWork = mergeRowsByKey(existingStudentWork, newStudentWork, (work) => work.student_work_id)
  const { faculty, facultyCourseEdges } = buildFacultyGraph({ sources, courseInventory, syllabi })
  const searchCandidates = loadJsonl(join(outDir, 'search_candidates.jsonl'))
  const sourceClusters = loadJsonl(join(outDir, 'source_clusters.jsonl'))
  const sourceVersions = loadJsonl(join(outDir, 'source_versions.jsonl'))
  const wayback = loadJsonl(join(outDir, 'wayback_captures.jsonl'))
  const facultyProfileCandidates = loadJsonl(join(outDir, 'faculty_profile_candidates.jsonl'))
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings })
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters })
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, searchCandidates, commonCrawlCandidates: updatedCandidates, commonCrawlPromotions: updatedPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts })

  writeJsonl(join(outDir, 'sources.jsonl'), sources)
  writeJsonl(join(outDir, 'courses.jsonl'), courses)
  writeJsonl(join(outDir, 'syllabi.jsonl'), syllabi)
  writeJsonl(join(outDir, 'assignments.jsonl'), assignments)
  writeJsonl(join(outDir, 'readings.jsonl'), readings)
  writeJsonl(join(outDir, 'reading_frequency.jsonl'), readingFrequency)
  writeJsonl(join(outDir, 'faculty.jsonl'), faculty)
  writeJsonl(join(outDir, 'faculty_course_edges.jsonl'), facultyCourseEdges)
  writeJsonl(join(outDir, 'student_work.jsonl'), studentWork)
  writeJsonl(join(outDir, 'common_crawl_candidates.jsonl'), updatedCandidates)
  writeJsonl(join(outDir, 'common_crawl_promotions.jsonl'), updatedPromotions)
  writeJsonl(join(outDir, 'review_queue.jsonl'), reviewQueue)
  writeJsonl(join(outDir, 'review_decisions.jsonl'), reviewDecisions)
  writeJsonl(join(outDir, 'field_conflicts.jsonl'), fieldConflicts)
  writeFileSync(join(outDir, 'review_queue.md'), reviewQueueMarkdown(reviewQueue))
  writeFileSync(join(outDir, 'needs_followup.md'), needsFollowupMarkdown({ reviewQueue, reviewDecisions, fieldConflicts }))
  writeJson(join(outDir, 'validation.json'), validationWithReview)
  writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validationWithReview))
  writeFileSync(join(outDir, 'course_reconstruction.md'), reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, studentWork, wayback, sourceClusters }))
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork }))
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, studentWork }))
  console.log(`RISD Common Crawl promotions ingested into ${outDir}`)
  console.log(`new_sources=${newSources.length} sources=${sources.length} syllabi=${syllabi.length} assignments=${assignments.length} readings=${readings.length} validation=${validationWithReview.status}`)
}

async function ingestFacultyProfilesOnlyMode() {
  ensureDir(outDir)
  const existingSources = loadJsonl(join(outDir, 'sources.jsonl'))
  const courseInventoryRows = loadJsonl(join(outDir, 'course_inventory.jsonl'))
  const courses = loadJsonl(join(outDir, 'courses.jsonl'))
  const syllabi = loadJsonl(join(outDir, 'syllabi.jsonl'))
  const assignments = loadJsonl(join(outDir, 'assignments.jsonl'))
  const readings = loadJsonl(join(outDir, 'readings.jsonl'))
  const readingFrequency = loadJsonl(join(outDir, 'reading_frequency.jsonl'))
  const existingCandidates = loadJsonl(join(outDir, 'faculty_profile_candidates.jsonl'))
  const existingSourceUrls = new Set(existingSources.map((source) => canonicalUrl(source.url)))
  const previousValidation = existsSync(join(outDir, 'validation.json')) ? JSON.parse(readFileSync(join(outDir, 'validation.json'), 'utf8')) : null
  const courseInventory = {
    offerings: courseInventoryRows,
    displayed_count: previousValidation?.counts?.official_course_displayed_count ?? courseInventoryRows.length,
  }

  const seedFaculty = buildFacultyGraph({ sources: existingSources, courseInventory, syllabi }).faculty
  const seedFacultyIds = new Set(seedFaculty.map((row) => row.faculty_id))
  const retainedCandidates = existingCandidates.filter((candidate) => seedFacultyIds.has(candidate.faculty_id))
  const discoveredCandidates = await discoverFacultyProfileCandidates(seedFaculty, retainedCandidates)
  const candidatesById = new Map(discoveredCandidates.map((candidate) => [candidate.candidate_id, candidate]))
  const selectedCandidates = discoveredCandidates
    .filter((candidate) => candidate.status === 'candidate_for_public_fetch')
    .filter((candidate) => !existingSourceUrls.has(canonicalUrl(candidate.url)))
    .slice(0, facultyProfileIngestLimit)

  const inspected = []
  for (const [index, candidate] of selectedCandidates.entries()) {
    console.error(`inspect faculty profile ${index + 1}/${selectedCandidates.length}: ${candidate.faculty_name} ${candidate.url}`)
    const sourceId = sourceIdForUrl('src_faculty_profile', candidate.url)
    inspected.push({
      candidate,
      inspected: await inspectSeed({
        source_id: sourceId,
        url: candidate.url,
        source_type: 'faculty_profile',
        authority: candidate.candidate_source.includes('official') ? 'official_risd' : 'public_faculty_profile',
        confidence: candidate.candidate_source.includes('official') ? 'B' : 'C',
        instructor: candidate.faculty_name,
        notes: `Public faculty profile candidate discovered via ${candidate.candidate_source}.`,
      }),
    })
  }

  const successfulInspections = inspected.filter(({ inspected }) => inspected.source.extraction_status === 'ok')
  const inspectedByCandidateId = new Map(inspected.map(({ candidate, inspected: result }) => [candidate.candidate_id, result.source]))
  for (const candidate of discoveredCandidates) {
    const inspectedSource = inspectedByCandidateId.get(candidate.candidate_id)
    if (!inspectedSource) continue
    candidatesById.set(candidate.candidate_id, {
      ...candidate,
      status: inspectedSource.extraction_status === 'ok' ? 'ingested_into_corpus' : 'fetch_failed',
      promoted_source_id: inspectedSource.extraction_status === 'ok' ? inspectedSource.source_id : null,
      extraction_status: inspectedSource.extraction_status,
      ingested_at: retrievedAt,
    })
  }

  const newSources = successfulInspections.map(({ inspected }) => inspected.source)
  const sources = mergeRowsByKey(existingSources, newSources, (source) => source.source_id)
  const { faculty, facultyCourseEdges } = buildFacultyGraph({ sources, courseInventory, syllabi })
  const studentWork = loadJsonl(join(outDir, 'student_work.jsonl'))
  const sourceClusters = loadJsonl(join(outDir, 'source_clusters.jsonl'))
  const sourceVersions = loadJsonl(join(outDir, 'source_versions.jsonl'))
  const wayback = loadJsonl(join(outDir, 'wayback_captures.jsonl'))
  const searchCandidates = loadJsonl(join(outDir, 'search_candidates.jsonl'))
  const commonCrawlCandidates = loadJsonl(join(outDir, 'common_crawl_candidates.jsonl'))
  const commonCrawlPromotions = loadJsonl(join(outDir, 'common_crawl_promotions.jsonl'))
  const facultyProfileCandidates = [...candidatesById.values()].sort((a, b) => a.faculty_name.localeCompare(b.faculty_name) || a.url.localeCompare(b.url))
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings })
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters })
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, searchCandidates, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts })

  writeJsonl(join(outDir, 'sources.jsonl'), sources)
  writeJsonl(join(outDir, 'faculty.jsonl'), faculty)
  writeJsonl(join(outDir, 'faculty_course_edges.jsonl'), facultyCourseEdges)
  writeJsonl(join(outDir, 'faculty_profile_candidates.jsonl'), facultyProfileCandidates)
  writeJsonl(join(outDir, 'review_queue.jsonl'), reviewQueue)
  writeJsonl(join(outDir, 'review_decisions.jsonl'), reviewDecisions)
  writeJsonl(join(outDir, 'field_conflicts.jsonl'), fieldConflicts)
  writeFileSync(join(outDir, 'review_queue.md'), reviewQueueMarkdown(reviewQueue))
  writeFileSync(join(outDir, 'needs_followup.md'), needsFollowupMarkdown({ reviewQueue, reviewDecisions, fieldConflicts }))
  writeJson(join(outDir, 'validation.json'), validationWithReview)
  writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validationWithReview))
  writeFileSync(join(outDir, 'course_reconstruction.md'), reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, studentWork, wayback, sourceClusters }))
  writeFileSync(join(outDir, 'source_audit.md'), auditMarkdown({ sources, searchQueries, wayback, validation: validationWithReview }))
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork }))
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, studentWork }))
  console.log(`RISD faculty profile candidates ingested into ${outDir}`)
  console.log(`new_sources=${newSources.length} candidates=${facultyProfileCandidates.length} ingested_candidates=${facultyProfileCandidates.filter((row) => row.status === 'ingested_into_corpus').length} faculty_profile_rows=${faculty.filter((row) => row.profile_urls?.length).length} validation=${validationWithReview.status}`)
}

async function main() {
  ensureDir(outDir)
  if (ingestFacultyProfilesOnly) {
    await ingestFacultyProfilesOnlyMode()
    return
  }
  if (ingestCommonCrawlOnly) {
    await ingestCommonCrawlPromotionsOnly()
    return
  }
  if (promoteCommonCrawlOnly) {
    await renderCommonCrawlPromotionOnly()
    return
  }
  if (commonCrawlOnly) {
    await renderCommonCrawlOnly()
    return
  }
  if (renderDerivedOnly) {
    renderDerivedArtifactsOnly()
    return
  }
  if (renderCurriculumOnly) {
    renderSelfStudyCurriculumOnly()
    return
  }
  const inspected = []
  const importedSearchCandidates = loadSearchImportCandidates()
  const initialSeeds = [...seeds, ...searchDiscoveredSources]
  for (const [index, seed] of initialSeeds.entries()) {
    if (seed.source_id === 'src_risd_graphic_design_courses') continue
    console.error(`inspect seed ${index + 1}/${initialSeeds.length}: ${seed.source_id}`)
    inspected.push(await inspectSeed(seed))
  }
  const seededUrls = new Set(initialSeeds.map((seed) => canonicalUrl(seed.url)))
  const importedSearchSeeds = importedSearchCandidates
    .filter((candidate) => candidate.url && !seededUrls.has(canonicalUrl(candidate.url)))
    .map(sourceSeedFromSearchCandidate)
  const promotedImportedSearchSources = []
  for (const [index, seed] of importedSearchSeeds.entries()) {
    console.error(`inspect imported search candidate ${index + 1}/${importedSearchSeeds.length}: ${seed.source_id}`)
    const inspectedCandidate = await inspectSeed(seed)
    if (inspectedCandidate.source.extraction_status === 'ok') {
      inspected.push(inspectedCandidate)
      promotedImportedSearchSources.push(inspectedCandidate.source)
    }
  }
  for (let page = 0; page < officialCourseMaxPages; page++) {
    console.error(`inspect official course page ${page + 1}/${officialCourseMaxPages}`)
    const inspectedPage = await inspectOfficialCoursePage(page)
    if (inspectedPage.source.extraction_status !== 'ok') {
      inspected.push(inspectedPage)
      continue
    }
    const offerings = extractOfficialCourseOfferings(inspectedPage.text, inspectedPage.source.source_id)
    if (page > 0 && offerings.length === 0) break
    inspected.push(inspectedPage)
  }
  const crawlSeeds = discoverCrawlSeeds(inspected).slice(0, 80)
  for (const [index, seed] of crawlSeeds.entries()) {
    console.error(`inspect crawl seed ${index + 1}/${crawlSeeds.length}: ${seed.source_id}`)
    inspected.push(await inspectSeed(seed))
  }

  const wayback = []
  if (!skipWayback) {
    const waybackSeeds = [...seeds, ...searchDiscoveredSources, ...crawlSeeds].slice(0, waybackMaxSources)
    for (const [index, seed] of waybackSeeds.entries()) {
      console.error(`inspect wayback ${index + 1}/${waybackSeeds.length}: ${seed.source_id}`)
      const captures = await waybackCaptures(seed.url)
      captures.forEach((capture) => wayback.push({ source_id: seed.source_id, ...capture }))
    }
    const waybackFallbacks = await inspectWaybackFallbacks(inspected, wayback)
    inspected.push(...waybackFallbacks)
  }

  const sources = inspected.map(({ source }) => source)
  const courseInventory = buildCourseInventory(inspected)
  const courses = buildCourses(inspected)
  const syllabi = buildSyllabi(inspected)
  const assignments = buildAssignments(syllabi)
  const readings = buildReadings(syllabi)
  const readingFrequency = buildReadingFrequency(readings)
  const { faculty, facultyCourseEdges } = buildFacultyGraph({ sources, courseInventory, syllabi })
  const studentWork = buildStudentWork(inspected)
  const sourceClusters = buildSourceClusters(inspected, syllabi, readings)
  const sourceVersions = buildSourceVersions(inspected, wayback)
  const searchCandidates = buildSearchCandidates(importedSearchCandidates, promotedImportedSearchSources)
  const commonCrawlCandidates = loadJsonl(join(outDir, 'common_crawl_candidates.jsonl'))
  const commonCrawlPromotions = loadJsonl(join(outDir, 'common_crawl_promotions.jsonl'))
  const facultyProfileCandidates = loadJsonl(join(outDir, 'faculty_profile_candidates.jsonl'))

  writeJsonl(join(outDir, 'sources.jsonl'), sources)
  writeJsonl(join(outDir, 'course_inventory.jsonl'), courseInventory.offerings)
  writeJsonl(join(outDir, 'courses.jsonl'), courses)
  writeJsonl(join(outDir, 'syllabi.jsonl'), syllabi)
  writeJsonl(join(outDir, 'assignments.jsonl'), assignments)
  writeJsonl(join(outDir, 'readings.jsonl'), readings)
  writeJsonl(join(outDir, 'reading_frequency.jsonl'), readingFrequency)
  writeJsonl(join(outDir, 'faculty.jsonl'), faculty)
  writeJsonl(join(outDir, 'faculty_course_edges.jsonl'), facultyCourseEdges)
  writeJsonl(join(outDir, 'student_work.jsonl'), studentWork)
  writeJsonl(join(outDir, 'source_clusters.jsonl'), sourceClusters)
  writeJsonl(join(outDir, 'source_versions.jsonl'), sourceVersions)
  writeJsonl(join(outDir, 'wayback_captures.jsonl'), wayback)
  writeJsonl(join(outDir, 'crawl_sources.jsonl'), crawlSeeds)
  writeJsonl(join(outDir, 'search_results.jsonl'), buildSearchResults())
  writeJsonl(join(outDir, 'search_candidates.jsonl'), searchCandidates)
  writeJsonl(join(outDir, 'common_crawl_candidates.jsonl'), commonCrawlCandidates)
  writeJsonl(join(outDir, 'common_crawl_promotions.jsonl'), commonCrawlPromotions)
  writeJsonl(join(outDir, 'faculty_profile_candidates.jsonl'), facultyProfileCandidates)
  writeJson(join(outDir, 'search_queries.json'), { generated_at: retrievedAt, queries: searchQueries })
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings })
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters })
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, searchCandidates, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts })
  writeJsonl(join(outDir, 'review_queue.jsonl'), reviewQueue)
  writeJsonl(join(outDir, 'review_decisions.jsonl'), reviewDecisions)
  writeJsonl(join(outDir, 'field_conflicts.jsonl'), fieldConflicts)
  writeFileSync(join(outDir, 'review_queue.md'), reviewQueueMarkdown(reviewQueue))
  writeFileSync(join(outDir, 'needs_followup.md'), needsFollowupMarkdown({ reviewQueue, reviewDecisions, fieldConflicts }))
  writeJson(join(outDir, 'validation.json'), validationWithReview)
  writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validationWithReview))
  writeFileSync(join(outDir, 'course_reconstruction.md'), reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, studentWork, wayback, sourceClusters }))
  writeFileSync(join(outDir, 'source_audit.md'), auditMarkdown({ sources, searchQueries, wayback, validation: validationWithReview }))
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork }))
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, studentWork }))

  console.log(`RISD corpus artifacts written to ${outDir}`)
  console.log(`sources=${sources.length} course_inventory=${courseInventory.offerings.length}/${courseInventory.displayed_count || '?'} courses=${courses.length} syllabi=${syllabi.length} assignments=${assignments.length} readings=${readings.length} canonical_reading_works=${readingFrequency.length} search_candidates=${searchCandidates.length} faculty=${faculty.length} faculty_course_edges=${facultyCourseEdges.length} student_work=${studentWork.length} source_clusters=${sourceClusters.length} source_versions=${sourceVersions.length} wayback=${wayback.length} review_queue=${reviewQueue.length} review_decisions=${reviewDecisions.length} field_conflicts=${fieldConflicts.length} validation=${validationWithReview.status}`)
}

if (!existsSync(join(root, 'docs/research-plans/risd-graphic-design-syllabus-corpus-plan.md'))) {
  throw new Error('Run from repository root; plan file not found.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
