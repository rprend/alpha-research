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
const promoteSearchOnly = process.argv.includes('--promote-search-only')
const promoteArchiveOnly = process.argv.includes('--promote-archive-only')
const ingestFacultyProfilesOnly = process.argv.includes('--ingest-faculty-profiles-only')
const facultyPortfolioExamplesOnly = process.argv.includes('--faculty-portfolio-examples-only')
const linkReadingsOnly = process.argv.includes('--link-readings-only')
const reparseExistingSourcesOnly = process.argv.includes('--reparse-existing-sources-only')
const searchApiOnly = process.argv.includes('--search-api-only')
const officialCourseMaxPages = 12
const crawlMaxDepth = 1
const crawlMaxLinksPerHost = 20
const waybackMaxSources = 45
const commonCrawlMaxIndexes = Number(process.env.RISD_GD_CC_MAX_INDEXES ?? 3)
const commonCrawlMaxRowsPerQuery = Number(process.env.RISD_GD_CC_MAX_ROWS_PER_QUERY ?? 80)
const commonCrawlPromoteLimit = Number(process.env.RISD_GD_CC_PROMOTE_LIMIT ?? 8)
const commonCrawlIngestLimit = Number(process.env.RISD_GD_CC_INGEST_LIMIT ?? 8)
const facultyProfileIngestLimit = Number(process.env.RISD_GD_FACULTY_PROFILE_INGEST_LIMIT ?? 40)
const facultyPortfolioExampleLimit = Number(process.env.RISD_GD_FACULTY_PORTFOLIO_EXAMPLE_LIMIT ?? 60)
const readingLinkLimit = Number(process.env.RISD_GD_READING_LINK_LIMIT ?? 30)
const searchApiMaxQueries = Number(process.env.RISD_GD_SEARCH_API_MAX_QUERIES ?? 6)
const coverageSearchApiMaxQueries = Number(process.env.RISD_GD_COVERAGE_SEARCH_API_MAX_QUERIES ?? 6)
const facultySearchApiMaxQueries = Number(process.env.RISD_GD_FACULTY_SEARCH_API_MAX_QUERIES ?? 6)
const searchApiResultsPerQuery = Number(process.env.RISD_GD_SEARCH_API_RESULTS_PER_QUERY ?? 10)
const searchPromoteLimit = Number(process.env.RISD_GD_SEARCH_PROMOTE_LIMIT ?? 8)
const archivePromoteLimit = Number(process.env.RISD_GD_ARCHIVE_PROMOTE_LIMIT ?? 5)
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

function configuredSearchProvider() {
  if (process.env.BRAVE_SEARCH_API_KEY) {
    return {
      provider: 'brave',
      endpoint: 'https://api.search.brave.com/res/v1/web/search',
      key: process.env.BRAVE_SEARCH_API_KEY,
    }
  }
  if (process.env.BING_SEARCH_API_KEY) {
    return {
      provider: 'bing',
      endpoint: 'https://api.bing.microsoft.com/v7.0/search',
      key: process.env.BING_SEARCH_API_KEY,
    }
  }
  return null
}

async function querySearchProvider(query, providerConfig) {
  const endpoint = new URL(providerConfig.endpoint)
  endpoint.searchParams.set('q', query)
  if (providerConfig.provider === 'brave') {
    endpoint.searchParams.set('count', String(searchApiResultsPerQuery))
    endpoint.searchParams.set('search_lang', 'en')
  } else if (providerConfig.provider === 'bing') {
    endpoint.searchParams.set('count', String(searchApiResultsPerQuery))
    endpoint.searchParams.set('responseFilter', 'Webpages')
  }

  const headers = providerConfig.provider === 'brave'
    ? { Accept: 'application/json', 'X-Subscription-Token': providerConfig.key }
    : { Accept: 'application/json', 'Ocp-Apim-Subscription-Key': providerConfig.key }

  const fetched = await fetchWithRetry(endpoint.toString(), 2, headers)
  if (!fetched.ok) {
    return [{
      query,
      provider: providerConfig.provider,
      error: `http_${fetched.status}`,
    }]
  }
  const payload = JSON.parse(fetched.buffer.toString('utf8'))
  const rows = providerConfig.provider === 'brave'
    ? payload.web?.results ?? []
    : payload.webPages?.value ?? []
  return rows.map((row, index) => ({
    query,
    provider: providerConfig.provider,
    rank: index + 1,
    title: row.title ?? row.name ?? null,
    snippet: row.description ?? row.snippet ?? null,
    url: row.url,
    error: null,
  }))
}

function normalizeSearchQueryText(query) {
  return String(query ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function coverageQueryMetadata(row) {
  return {
    query_id: row.query_id ?? null,
    query_source: 'coverage_gap_query',
    course_code: row.course_code ?? null,
    course_title: row.course_title ?? null,
    missing_requirement: row.missing_requirement ?? null,
    coverage_score: row.coverage_score ?? null,
    priority: row.priority ?? null,
    source_coverage_id: row.source_coverage_id ?? null,
  }
}

function facultyQueryMetadata(row) {
  return {
    query_id: row.query_id ?? null,
    query_source: 'faculty_teaching_query',
    faculty_id: row.faculty_id ?? null,
    faculty_name: row.faculty_name ?? null,
    course_code: row.course_code ?? null,
    course_title: row.course_title ?? null,
    term: row.term ?? null,
    query_intent: row.query_intent ?? null,
    priority: row.priority ?? null,
    source_edge_id: row.source_edge_id ?? null,
  }
}

function activeSearchQueryRows(coverageSearchQueries = [], facultySearchQueries = []) {
  const rows = []
  const seen = new Set()
  for (const [index, query] of searchQueries.slice(0, searchApiMaxQueries).entries()) {
    const key = normalizeSearchQueryText(query)
    if (!key || seen.has(key)) continue
    seen.add(key)
    rows.push({
      query,
      query_id: `static_search_query_${String(index + 1).padStart(2, '0')}`,
      query_source: 'static_search_query',
    })
  }
  for (const row of coverageSearchQueries.slice(0, coverageSearchApiMaxQueries)) {
    const key = normalizeSearchQueryText(row.query)
    if (!key || seen.has(key)) continue
    seen.add(key)
    rows.push({
      query: row.query,
      ...coverageQueryMetadata(row),
    })
  }
  for (const row of facultySearchQueries.slice(0, facultySearchApiMaxQueries)) {
    const key = normalizeSearchQueryText(row.query)
    if (!key || seen.has(key)) continue
    seen.add(key)
    rows.push({
      query: row.query,
      ...facultyQueryMetadata(row),
    })
  }
  return rows
}

function searchApiUnavailableRows(coverageSearchQueries = [], facultySearchQueries = []) {
  return activeSearchQueryRows(coverageSearchQueries, facultySearchQueries).map((queryRow, index) => ({
    query: queryRow.query,
    ...queryRow,
    rank: null,
    title: null,
    snippet: null,
    url: null,
    promoted_source_id: null,
    discovered_at: retrievedAt,
    source: 'live_search_api',
    provider: null,
    status: 'provider_unconfigured',
    error: 'Set BRAVE_SEARCH_API_KEY or BING_SEARCH_API_KEY in the environment; do not paste secrets into chat.',
    candidate_id: `live_search_unconfigured_${String(index + 1).padStart(2, '0')}_${sha256(Buffer.from(queryRow.query)).slice(0, 8)}`,
  }))
}

async function buildLiveSearchCandidates(coverageSearchQueries = [], facultySearchQueries = []) {
  const providerConfig = configuredSearchProvider()
  const queryRows = activeSearchQueryRows(coverageSearchQueries, facultySearchQueries)
  if (!providerConfig) return searchApiUnavailableRows(coverageSearchQueries, facultySearchQueries)

  const rawRows = []
  for (const [index, queryRow] of queryRows.entries()) {
    console.error(`live search ${providerConfig.provider} ${index + 1}/${queryRows.length}: ${queryRow.query}`)
    try {
      rawRows.push(...(await querySearchProvider(queryRow.query, providerConfig)).map((row) => ({
        ...row,
        ...queryRow,
      })))
    } catch (error) {
      rawRows.push({
        ...queryRow,
        provider: providerConfig.provider,
        rank: null,
        title: null,
        snippet: null,
        url: null,
        error: error.message,
      })
    }
  }

  const candidates = []
  for (const row of rawRows) {
    if (row.error || !row.url) {
      candidates.push({
        candidate_id: `live_search_${row.provider}_${sha256(Buffer.from(`${row.query}:${row.error ?? 'empty'}`)).slice(0, 10)}`,
        query: row.query,
        query_id: row.query_id ?? null,
        query_source: row.query_source ?? null,
        course_code: row.course_code ?? null,
        course_title: row.course_title ?? null,
        missing_requirement: row.missing_requirement ?? null,
        coverage_score: row.coverage_score ?? null,
        priority: row.priority ?? null,
        source_coverage_id: row.source_coverage_id ?? null,
        faculty_id: row.faculty_id ?? null,
        faculty_name: row.faculty_name ?? null,
        term: row.term ?? null,
        query_intent: row.query_intent ?? null,
        source_edge_id: row.source_edge_id ?? null,
        rank: row.rank,
        title: row.title,
        snippet: row.snippet,
        url: null,
        discovered_at: retrievedAt,
        source: 'live_search_api',
        provider: row.provider,
        status: 'query_failed',
        promoted_source_id: null,
        error: row.error ?? 'missing_url',
      })
      continue
    }
    const normalized = normalizeSearchCandidate({
      candidate_id: `live_search_${row.provider}_${sha256(Buffer.from(canonicalUrl(row.url))).slice(0, 10)}`,
      query: row.query,
      query_id: row.query_id ?? null,
      query_source: row.query_source ?? null,
      course_code: row.course_code ?? null,
      course_title: row.course_title ?? null,
      missing_requirement: row.missing_requirement ?? null,
      coverage_score: row.coverage_score ?? null,
      priority: row.priority ?? null,
      source_coverage_id: row.source_coverage_id ?? null,
      faculty_id: row.faculty_id ?? null,
      faculty_name: row.faculty_name ?? null,
      term: row.term ?? null,
      query_intent: row.query_intent ?? null,
      source_edge_id: row.source_edge_id ?? null,
      rank: row.rank,
      title: row.title,
      snippet: row.snippet,
      url: row.url,
      source: 'live_search_api',
      status: 'candidate_from_search_api',
      provider: row.provider,
      discovered_at: retrievedAt,
    })
    if (normalized) {
      candidates.push({
        ...normalized,
        query_id: row.query_id ?? null,
        query_source: row.query_source ?? null,
        course_code: row.course_code ?? null,
        course_title: row.course_title ?? null,
        missing_requirement: row.missing_requirement ?? null,
        coverage_score: row.coverage_score ?? null,
        priority: row.priority ?? null,
        source_coverage_id: row.source_coverage_id ?? null,
        faculty_id: row.faculty_id ?? null,
        faculty_name: row.faculty_name ?? null,
        term: row.term ?? null,
        query_intent: row.query_intent ?? null,
        source_edge_id: row.source_edge_id ?? null,
        source: 'live_search_api',
        provider: row.provider,
        status: 'candidate_from_search_api',
        error: null,
      })
    }
  }

  const seen = new Set()
  return candidates.filter((candidate) => {
    const key = candidate.url ? canonicalUrl(candidate.url) : candidate.candidate_id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildSearchCandidates(importedCandidates = [], promotedImported = [], liveSearchCandidates = [], coverageSearchQueries = [], facultySearchQueries = []) {
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
  for (const row of coverageSearchQueries) {
    rows.push({
      candidate_id: row.query_id,
      query: row.query,
      rank: null,
      title: null,
      snippet: null,
      url: null,
      discovered_at: row.generated_at ?? retrievedAt,
      source: 'coverage_query_backlog',
      status: row.status ?? 'pending_search_export_or_api',
      promoted_source_id: null,
      error: null,
      ...coverageQueryMetadata(row),
    })
  }
  for (const row of facultySearchQueries) {
    rows.push({
      candidate_id: row.query_id,
      query: row.query,
      rank: null,
      title: null,
      snippet: null,
      url: null,
      discovered_at: row.generated_at ?? retrievedAt,
      source: 'faculty_query_backlog',
      status: row.status ?? 'pending_search_export_or_api',
      promoted_source_id: null,
      error: null,
      ...facultyQueryMetadata(row),
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
  rows.push(...liveSearchCandidates)
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
    query_id: row.query_id ?? null,
    query_source: row.query_source ?? null,
    course_code: row.course_code ?? null,
    course_title: row.course_title ?? null,
    missing_requirement: row.missing_requirement ?? null,
    coverage_score: row.coverage_score ?? null,
    priority: row.priority ?? null,
    source_coverage_id: row.source_coverage_id ?? null,
    faculty_id: row.faculty_id ?? null,
  }
}

function sourceSeedFromSearchCandidate(candidate) {
  const sourceType = classifyLinkedSource(candidate.url, `${candidate.title ?? ''} ${candidate.snippet ?? ''}`) ?? 'course_site'
  const confidence = sourceType === 'syllabus_pdf' || sourceType === 'syllabus_html' ? 'A' : sourceType === 'student_work_archive' ? 'D' : 'B'
  return {
    source_id: sourceIdForUrl('src_search', candidate.url),
    url: candidate.url,
    source_type: sourceType,
    authority: candidate.source === 'live_search_api' ? 'live_search_result' : 'imported_search_result',
    confidence,
    discovery_query: candidate.query,
    discovery_rank: candidate.rank,
    course_code: candidate.course_code ?? null,
    course_title: candidate.course_title ?? null,
    notes: `${candidate.source === 'live_search_api' ? 'Live search result' : 'Imported search result'}${candidate.snippet ? `: ${candidate.snippet.slice(0, 240)}` : '.'}`,
  }
}

function isPromotableSearchCandidate(candidate, existingSourceUrls = new Set(), promotedCandidateIds = new Set()) {
  return evaluateSearchCandidatePromotion(candidate, existingSourceUrls, promotedCandidateIds).eligible
}

function evaluateSearchCandidatePromotion(candidate, existingSourceUrls = new Set(), promotedCandidateIds = new Set()) {
  if (!candidate.url) return { eligible: false, rejection_reason: 'missing_url' }
  if (candidate.promoted_source_id) return { eligible: false, rejection_reason: 'already_represented_by_corpus_source' }
  if (promotedCandidateIds.has(candidate.candidate_id)) return { eligible: false, rejection_reason: 'already_reviewed_in_search_promotions' }
  let url
  try {
    url = canonicalUrl(candidate.url)
  } catch {
    return { eligible: false, rejection_reason: 'invalid_url' }
  }
  if (existingSourceUrls.has(url)) return { eligible: false, rejection_reason: 'duplicate_existing_source_url' }
  if (candidate.status === 'promotion_rejected') return { eligible: false, rejection_reason: candidate.promotion_error ?? 'candidate_previously_rejected_before_fetch' }
  if (!['candidate_imported', 'candidate_from_search_api'].includes(candidate.status)) return { eligible: false, rejection_reason: `unsupported_status:${candidate.status ?? 'unknown'}` }
  const lower = url.toLowerCase()
  if (/login|canvas|blackboard|moodle|instructure|discord|slack|wp-admin|wp-login|signin|sign-in|auth|oauth/.test(lower)) return { eligible: false, rejection_reason: 'private_login_admin_or_auth_url' }
  return { eligible: true, rejection_reason: null }
}

function scoreSearchCandidateForPromotion(candidate) {
  const combined = `${candidate.url ?? ''} ${candidate.title ?? ''} ${candidate.snippet ?? ''} ${candidate.query ?? ''} ${candidate.missing_requirement ?? ''}`.toLowerCase()
  let score = 0
  if (/risd\.gd|risd\.edu|johncaserta\.com|htmlkitchen|practise\.studio/.test(combined)) score += 5
  if (/syllabus|course site|course|class/.test(combined)) score += 4
  if (/project|assignment|exercise|prompt|critique|schedule|week/.test(combined)) score += 5
  if (/reading|bibliography|resource|reference/.test(combined)) score += 2
  if (/graphic design|typography|type|poster|publication|web|motion|studio/.test(combined)) score += 3
  if (candidate.query_source === 'coverage_gap_query') score += 2
  if (candidate.source === 'live_search_api') score += 1
  if (/login|admin|feed|tag|author|wp-json/.test(combined)) score -= 6
  return score
}

function rejectedSearchPromotionRow(candidate, promotionScore, rejectionReason) {
  return {
    promotion_id: `search_promotion_${candidate.candidate_id}`,
    candidate_id: candidate.candidate_id,
    promoted_at: retrievedAt,
    promoted_source_id: null,
    url: candidate.url ?? null,
    query: candidate.query ?? null,
    query_id: candidate.query_id ?? null,
    query_source: candidate.query_source ?? null,
    course_code: candidate.course_code ?? null,
    course_title: candidate.course_title ?? null,
    missing_requirement: candidate.missing_requirement ?? null,
    promotion_score: promotionScore,
    source_type: null,
    authority: null,
    confidence: null,
    fetch_status: 'not_fetched',
    extraction_status: 'rejected_before_fetch',
    content_type: null,
    checksum: null,
    title: candidate.title ?? null,
    text_length: 0,
    notes: 'Search candidate rejected before public fetch; retained for promotion audit.',
    error: rejectionReason,
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

function sourceSeedFromArchiveTarget(target) {
  return {
    source_id: sourceIdForUrl('src_archive', `${target.original_url}@${target.capture_timestamp}`),
    url: target.memento_url,
    source_type: 'wayback_capture',
    authority: 'internet_archive',
    confidence: target.evidence_grade ?? 'B',
    parent_source_id: target.source_id,
    original_url: target.original_url,
    archive_capture_timestamp: target.capture_timestamp,
    archive_target_id: target.target_id,
    course_code: target.course_code ?? null,
    course_title: target.course_title ?? null,
    term: target.term ?? null,
    notes: `Wayback capture ${target.capture_timestamp} selected from archive target ${target.target_id}. Original URL: ${target.original_url}. Selection reason: ${target.selection_reason}`,
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
  if (/wp-login|wp-admin|\/author\/admin|\/login\b|signin|sign-in|\/auth\b|oauth/.test(combined)) return null
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

function isLikelyAssignmentHeading(line) {
  if (!line || line.length > 140) return false
  return /^(?:#{1,4}\s*)?(?:(?:project|assignment|exercise|brief|prompt|final|deliverables?|critique|presentation|workshop)\s*(?:[#:]?\s*\d+|[A-Z])?[:.\- ]|(?:week|class|session)\s+\d+\b.*\b(?:project|assignment|exercise|critique|due|present))/i.test(line)
}

function isLikelySectionHeading(line) {
  if (!line || line.length > 140) return false
  return /^(?:#{1,4}\s*)?(?:course description|overview|objectives|learning outcomes|grading|assessment|attendance|policies|schedule|calendar|readings?|texts?|resources?|materials?|tools|requirements?|assignments?|projects?|exercises?|final|critique|deliverables?)\b[:.\- ]?/i.test(line)
}

function cleanAssignmentBlock(value) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim()
    .slice(0, 1200)
}

function extractAssignmentBlocks(text, limit = 40) {
  const normalizedLines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const blocks = []
  for (let index = 0; index < normalizedLines.length; index += 1) {
    const line = normalizedLines[index]
    if (!isLikelyAssignmentHeading(line)) continue
    const blockLines = [line]
    for (let next = index + 1; next < normalizedLines.length && blockLines.length < 12; next += 1) {
      const nextLine = normalizedLines[next]
      if (isLikelyAssignmentHeading(nextLine)) break
      if (isLikelySectionHeading(nextLine) && blockLines.length > 2) break
      blockLines.push(nextLine)
      if (/\b(?:due|deliverables?|submit|present|critique|final|requirements?)\b/i.test(nextLine) && blockLines.length >= 4) {
        const following = normalizedLines[next + 1]
        if (!following || isLikelySectionHeading(following) || isLikelyAssignmentHeading(following)) break
      }
    }
    const block = cleanAssignmentBlock(blockLines.join(' '))
    if (block.split(/\s+/).length < 8) continue
    if (!/\b(?:project|assignment|exercise|brief|prompt|deliverables?|due|submit|present|critique|final|make|design|build|write|draw|create|print|prototype)\b/i.test(block)) continue
    blocks.push(block)
    if (blocks.length >= limit) break
  }
  return uniq(blocks)
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
    topic_outline: extractScheduleRows(text, source).map((row) => row.topic).filter(Boolean).slice(0, 30),
    assignment_schedule: extractScheduleRows(text, source).slice(0, 80),
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

function extractScheduleRows(text, source = {}) {
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
  const weekRow = extractWeekPageScheduleRow(text, source)
  if (weekRow && !out.some((row) => row.date === weekRow.date && row.topic === weekRow.topic)) {
    out.unshift(weekRow)
  }
  return out
}

function extractWeekPageScheduleRow(text, source = {}) {
  const title = `${source.title ?? ''} ${source.link_label ?? ''}`.replace(/\s+/g, ' ').trim()
  const url = source.url ?? ''
  const week = title.match(/\bWeek\s+\d+\b/i)?.[0] ?? url.match(/week[-_]?(\d+)/i)?.[0]?.replace(/week[-_]?/i, 'Week ')
  const classSession = title.match(/\bClass\s+\d+\b/i)?.[0]
  if (!week && !classSession) return null
  const normalized = text.replace(/\r/g, '\n')
  const date = normalized.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+(?:19|20)\d{2}\b/i)?.[0]
    ?? normalized.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+(?:19|20)\d{2}\b/i)?.[0]
    ?? url.match(/\/((?:19|20)\d{2})\/(\d{2})\/(\d{2})\//)?.slice(1).join('-')
    ?? week
    ?? classSession
  const scheduleLines = lines(text)
    .filter((line) => line.length > 4)
    .filter((line) => !/^(?:↘|index|syllabus|schedule|projects|exercises|readings|resources|colophon|quick links|web type|design & politics)$/i.test(line))
    .filter((line) => !/^Week\s+\d+$/i.test(line))
    .filter((line) => !/^(?:Unit|Lecture)\s+\d+$/i.test(line))
    .filter((line) => !/^\w+\s+\d{1,2},\s+(?:19|20)\d{2}$/i.test(line))
    .slice(0, 18)
  const topic = scheduleLines.join(' ').replace(/\s+/g, ' ').trim().slice(0, 360)
  if (!topic) return null
  return {
    date,
    topic,
    assignment_or_reading: topic.match(/\b(?:Project|Exercise|Reading|Due|Critique|Discussion|Lecture|Review|Activity|Workshop|Final)[^.]*/i)?.[0]?.slice(0, 260) ?? null,
    schedule_source: 'week_page',
  }
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

function cleanSourceTitle(title) {
  return (title ?? '')
    .replace(/\s+[—|-]\s+(?:WebType|RISD.*|Design Studio.*)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractAssignmentPageBrief(text, source = {}) {
  if (source.source_type !== 'assignment_page') return []
  const title = cleanSourceTitle(source.title) || cleanSourceTitle(source.link_label)
  const textLines = lines(text)
    .filter((line) => line.length > 16)
    .filter((line) => !/^(?:home|menu|previous|next|archive|copyright|rss|search|navigation)$/i.test(line))
    .filter((line) => !title || normalizeForMatch(line) !== normalizeForMatch(title))
  const introLines = textLines.filter((line) => /\b(?:in this project|for this project|in this assignment|for this assignment|in this exercise|for this exercise|you will|your assignment|your project|deliverables?|requirements?|design questions?|please post|please submit|due\b)\b/i.test(line)).slice(0, 8)
  if (title && introLines.length) {
    const introBrief = cleanAssignmentBlock(`${title}: ${introLines.join(' ')}`)
    if (introBrief.split(/\s+/).length >= 12) return [introBrief]
  }
  const scored = textLines
    .map((line, index) => {
      let score = 0
      if (/\b(?:project|assignment|exercise|brief|prompt|deliverables?|due|submit|present|critique|final)\b/i.test(line)) score += 5
      if (/\b(?:make|design|build|create|draw|write|print|prototype|document|revise|code)\b/i.test(line)) score += 3
      if (/\b(?:html|css|javascript|type|typography|poster|book|website|specimen|identity|animation)\b/i.test(line)) score += 2
      score += Math.max(0, 4 - Math.floor(index / 4))
      return { line, index, score }
    })
    .filter((row) => row.score >= 4)
    .slice(0, 6)
  if (!title && !scored.length) return []
  const startIndex = scored[0]?.index ?? 0
  const bodyLines = textLines.slice(startIndex, startIndex + 10)
  const body = bodyLines.join(' ')
  const brief = cleanAssignmentBlock([title, body].filter(Boolean).join(': '))
  if (brief.split(/\s+/).length < 12) return []
  if (!/\b(?:project|assignment|exercise|brief|prompt|deliverables?|due|submit|present|critique|final|make|design|build|create|code|prototype)\b/i.test(brief)) return []
  return [brief]
}

function extractAssignments(text, source = {}) {
  const assignmentTerms = ['assignment', 'project', 'exercise', 'critique', 'deliverable', 'final', 'portfolio', 'presentation']
  const pageBriefs = extractAssignmentPageBrief(text, source)
  const blocks = extractAssignmentBlocks(text, 35)
  const snippets = sentenceSnippets(text, assignmentTerms, 35)
  return uniq([...pageBriefs, ...blocks, ...snippets]).slice(0, 55)
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

async function fetchWithTimeout(url, timeoutMs = 25000, headers = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'alpha-research-risd-corpus/0.1 (+public research corpus; contact repository owner)',
        accept: '*/*',
        ...headers,
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

async function fetchWithRetry(url, attempts = 3, headers = {}) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetchWithTimeout(url, 25000, headers)
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
        assignments: extractAssignments(text, source),
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
      const assignmentTitle = snippet.match(/\b(?:Project|Assignment|Exercise|Final)\s*[:#]?\s*([^.;]{0,80})/i)?.[0] ?? null
      rows.push({
        assignment_id: `assign_${syllabus.syllabus_id}_${String(index + 1).padStart(2, '0')}`,
        course_code: syllabus.course_code,
        course_title: syllabus.course_title,
        syllabus_id: syllabus.syllabus_id,
        title: assignmentTitle,
        week_or_date: extractWeekOrDate(snippet),
        prompt_excerpt: snippet,
        constraints: assignmentSignals.constraints,
        deliverables: assignmentSignals.deliverables,
        materials: assignmentSignals.materials,
        tools: assignmentSignals.tools,
        process_steps: assignmentSignals.process_steps,
        submission_requirements: assignmentSignals.submission_requirements,
        grading_criteria: assignmentSignals.grading_criteria,
        assignment_type: assignmentSignals.assignment_type,
        studio_phases: assignmentSignals.studio_phases,
        critique_questions: assignmentSignals.critique_questions,
        output_format: assignmentSignals.output_format,
        evidence_limits: assignmentSignals.evidence_limits,
        critique_format: assignmentSignals.critique_format,
        revision_expectation: assignmentSignals.revision_expectation,
        skills_trained: inferSkills(snippet),
        tacit_goal: assignmentSignals.tacit_goal,
        assignment_confidence: assignmentSignals.assignment_confidence,
        boundary_status: assignmentSignals.boundary_status,
        assignment_boundary_evidence: assignmentBoundaryEvidence({ snippet, assignmentTitle, sourceIds: syllabus.source_ids, boundaryStatus: assignmentSignals.boundary_status }),
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
  const processSteps = []
  const submissionRequirements = []
  const gradingCriteria = []

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
  const processStepChecks = [
    ['research precedents or context', /\bresearch\b|\bprecedent\b|\binvestigate\b|\bcollect\b|\bgather\b/],
    ['sketch or draft alternatives', /\bsketch(?:es|ing)?\b|\bdraft(?:s|ing)?\b|\bthumbnail\b|\brough\b/],
    ['prototype or test behavior/form', /\bprototype\b|\bmockup\b|\btest\b|\bexperiment\b|\biteration\b|\bversion\b/],
    ['produce finished artifact', /\bmake\b|\bdesign\b|\bbuild\b|\bcompose\b|\bproduce\b|\bcreate\b|\bcode\b|\bprint\b/],
    ['present work for critique', /\bpresent(?:ation)?\b|\bpin[- ]?up\b|\bshow\b|\bshare\b|\bcrit(?:ique)?\b|\bfeedback\b|\breview\b/],
    ['document process or final work', /\bdocument(?:ation)?\b|\barchive\b|\bprocess book\b|\bportfolio\b/],
  ]
  for (const [label, pattern] of processStepChecks) {
    if (pattern.test(lower)) processSteps.push(label)
  }
  const submissionChecks = [
    ['due date or deadline present', /\bdue\b|\bdeadline\b|\bby\s+(?:mon|tues|wed|thurs|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)/i],
    ['submit or turn in work', /\bsubmit\b|\bturn(?:ed)? in\b|\bupload\b|\bpost\b|\bbring\b/],
    ['final presentation or critique', /\bfinal\b|\bpresent(?:ation)?\b|\bcrit(?:ique)?\b|\breview\b/],
    ['documentation required', /\bdocument(?:ation)?\b|\bprocess book\b|\bportfolio\b|\barchive\b/],
  ]
  for (const [label, pattern] of submissionChecks) {
    if (pattern.test(snippet)) submissionRequirements.push(label)
  }
  const gradingChecks = [
    ['craft and finish', /\bcraft\b|\bfinish\b|\bpolish\b|\bquality\b/],
    ['concept and critical thinking', /\bconcept\b|\bcritical\b|\bidea\b|\bmeaning\b|\brationale\b/],
    ['participation and critique contribution', /\bparticipation\b|\bcrit(?:ique)?\b|\bdiscussion\b|\bfeedback\b/],
    ['process and iteration', /\bprocess\b|\biteration\b|\bsketch\b|\bversion\b|\brevision\b/],
    ['timely completion', /\btimely\b|\bon time\b|\bdue\b|\bdeadline\b/],
    ['research depth', /\bresearch\b|\bprecedent\b|\binquiry\b/],
  ]
  for (const [label, pattern] of gradingChecks) {
    if (pattern.test(lower)) gradingCriteria.push(label)
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
  const boundary = inferAssignmentBoundaryStatus({
    snippet,
    lower,
    deliverables,
    constraints,
    materials,
    tools,
    studioPhases,
    critiqueQuestions,
    assignmentType,
    outputFormat,
    critiqueFormat,
    revisionExpectation,
    tacitGoal,
  })

  return {
    constraints: uniq(constraints),
    deliverables: uniq(deliverables),
    materials: uniq(materials),
    tools: uniq(tools),
    process_steps: uniq(processSteps),
    submission_requirements: uniq(submissionRequirements),
    grading_criteria: uniq(gradingCriteria),
    assignment_type: assignmentType,
    studio_phases: uniq(studioPhases),
    critique_questions: uniq(critiqueQuestions).slice(0, 4),
    output_format: outputFormat,
    evidence_limits: uniq(evidenceLimits),
    critique_format: critiqueFormat,
    revision_expectation: revisionExpectation,
    tacit_goal: tacitGoal,
    assignment_confidence: boundary.assignment_confidence,
    boundary_status: boundary.boundary_status,
    evidence_grade: boundary.assignment_confidence === 'high' ? 'A' : boundary.assignment_confidence === 'medium' ? 'B' : 'C',
  }
}

function assignmentBoundaryEvidence({ snippet, assignmentTitle, sourceIds, boundaryStatus }) {
  const heading = assignmentTitle ?? snippet.match(/^(?:[A-Z][^.;:]{3,80}:|(?:Project|Assignment|Exercise|Final)\b[^.;]{0,80})/i)?.[0]?.trim() ?? null
  const marker = snippet.match(/\b(?:Project|Assignment|Exercise|Final|Prompt|Brief|Deliverables?|Due|Submit|Critique|Review|Presentation|Prototype)\b/i)?.[0] ?? null
  return {
    heading_text: heading,
    boundary_marker: marker,
    source_excerpt: snippet.slice(0, 360),
    source_ids: sourceIds ?? [],
    boundary_status: boundaryStatus,
  }
}

function inferAssignmentBoundaryStatus({ snippet, lower, deliverables, constraints, materials, tools, studioPhases, critiqueQuestions, assignmentType, outputFormat, critiqueFormat, revisionExpectation, tacitGoal }) {
  const trimmed = snippet.trim()
  const words = trimmed.split(/\s+/).filter(Boolean)
  const hasBriefMarker = /\b(?:project|assignment|exercise|prompt|brief|core assignment|final|deliverables?|due|submit|present|critique|prototype|make|design|build|draw|write|code|print|document)\b/i.test(trimmed)
  const hasAdministrativeMarker = /\b(?:grade|grading|attendance|absence|policy|academic code|conduct|permit|hazard|damage|lateness|participation|office hours)\b/i.test(trimmed)
  const evidenceScore = [
    deliverables.length > 0,
    constraints.length > 0,
    materials.length > 0,
    tools.length > 0,
    studioPhases.length >= 2,
    critiqueQuestions.length > 0,
    Boolean(outputFormat),
    Boolean(critiqueFormat),
    Boolean(revisionExpectation),
    Boolean(tacitGoal),
    hasBriefMarker,
  ].filter(Boolean).length

  if (words.length <= 3 && !deliverables.length && !critiqueFormat) {
    return {
      assignment_confidence: 'low',
      boundary_status: 'fragment_too_short',
    }
  }
  if (hasAdministrativeMarker && evidenceScore < 4) {
    return {
      assignment_confidence: 'low',
      boundary_status: 'administrative_or_policy_fragment',
    }
  }
  if (/^(?:projects?|exercises?|core assignment|semester-long deliverables)$/i.test(trimmed)) {
    return {
      assignment_confidence: 'low',
      boundary_status: 'heading_only_fragment',
    }
  }
  if (assignmentType === 'reading_response' && evidenceScore < 4) {
    return {
      assignment_confidence: 'low',
      boundary_status: 'reading_or_discussion_fragment',
    }
  }
  if (deliverables.length || outputFormat || /^Assignment\s+\d|^Project\s+\d|^Final\b/i.test(trimmed)) {
    return {
      assignment_confidence: evidenceScore >= 4 ? 'high' : 'medium',
      boundary_status: 'bounded_assignment_brief',
    }
  }
  if (critiqueFormat || revisionExpectation || studioPhases.length >= 2 || constraints.length) {
    return {
      assignment_confidence: 'medium',
      boundary_status: 'partial_assignment_evidence',
    }
  }
  return {
    assignment_confidence: 'low',
    boundary_status: hasBriefMarker ? 'weak_assignment_signal' : 'contextual_course_fragment',
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
  { match: /shaping text|jan middendorp/i, title: 'Shaping Text', author: 'Jan Middendorp', resource_type: 'book' },
  { match: /thames and hudson manual of typography/i, title: 'The Thames and Hudson Manual of Typography', author: 'Ruari McLean', resource_type: 'book' },
  { match: /printed matter/i, title: 'Printed Matter', author: null, resource_type: 'organization_resource' },
  { match: /lars m[üu]ller publishers/i, title: 'Lars Muller Publishers', author: null, resource_type: 'publisher_resource' },
  { match: /how to draw a tree|munari/i, title: 'How to Draw a Tree', author: 'Bruno Munari', resource_type: 'book' },
  { match: /norman potter|what is a designer/i, title: 'What Is a Designer', author: 'Norman Potter', resource_type: 'book' },
  { match: /gestalt principles/i, title: 'Gestalt Principles', author: null, resource_type: 'concept_resource' },
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

function isNonCitationFragment(rawCitation) {
  if (!rawCitation) return true
  const lower = rawCitation.toLowerCase()
  if (rawCitation.length < 4) return true
  if (/-->|<--/.test(rawCitation)) return true
  if (/^(?:and|or|the|that|to|with|for|of|in|at|by)\b/i.test(rawCitation) && rawCitation.split(/\s+/).length < 9) return true
  if (/^(?:important websites?|semester-long deliverables|design studio \d{4}|in gd commons|for the class)$/i.test(rawCitation)) return true
  if (/\b(?:due|homework|hw|crit|critique|class|slack channel|feedback|revised|chief stanton|presentation board)\b/i.test(rawCitation) && !/\b(?:reading|book|essay|article|publisher|press|journal|magazine)\b/i.test(rawCitation)) return true
  if (/\b(?:supplement|provide historical context|help you with critique|technical challenges|contemporary art and design practices)\b/i.test(lower)) return true
  if (/^(?:comes from the credits|affects form|has been sent|which you really should|based on their own interests)\b/i.test(rawCitation)) return true
  return false
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
      canonical_work_id: `work_${slug(`${catalogHit.title}_${catalogHit.author ?? 'unknown'}`)}`,
      linking_status: 'local_catalog_match',
    }
  }
  if (isNonCitationFragment(rawCitation)) {
    return {
      raw_citation: rawCitation,
      title: null,
      author: null,
      publication_year: year,
      publisher_or_source: null,
      resource_type: 'non_citation_fragment',
      canonical_work_id: null,
      linking_status: 'non_citation_fragment',
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

const readingExternalLinkFields = [
  'external_work_id',
  'external_work_url',
  'external_link_provider',
  'external_link_status',
  'external_link_score',
  'external_title',
  'external_author',
  'external_first_publish_year',
  'external_publisher',
  'external_isbn',
  'external_edition_count',
]

function mergeReadingExternalLinks(readings, existingReadings = []) {
  const existingById = new Map(existingReadings.map((reading) => [reading.reading_id, reading]))
  return readings.map((reading) => {
    const existing = existingById.get(reading.reading_id)
    if (!existing?.external_link_status) return reading
    const merged = { ...reading }
    for (const field of readingExternalLinkFields) {
      if (existing[field] !== undefined) merged[field] = existing[field]
    }
    if (existing.external_link_status === 'matched') {
      merged.linking_status = reading.linking_status === 'unresolved' ? 'external_catalog_match' : reading.linking_status
      merged.canonical_work_id = reading.canonical_work_id ?? existing.canonical_work_id ?? null
      merged.title = reading.title ?? existing.title ?? existing.external_title ?? null
      merged.author = reading.author ?? existing.author ?? existing.external_author ?? null
      merged.publication_year = reading.publication_year ?? existing.publication_year ?? (existing.external_first_publish_year ? String(existing.external_first_publish_year) : null)
    }
    return merged
  })
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

function openLibraryQueryForReading(reading) {
  if (!reading || reading.linking_status === 'non_citation_fragment') return null
  const title = (reading.title ?? '').replace(/\s+/g, ' ').trim()
  const author = (reading.author ?? '').replace(/\s+/g, ' ').trim()
  const raw = (reading.raw_citation ?? '').replace(/\s+/g, ' ').trim()
  const queryText = title || raw
  if (!queryText || queryText.length < 8) return null
  if (/https?:\/\/|website|lecture|slides?|folder|canvas|moodle|blackboard/i.test(queryText)) return null
  const params = new URLSearchParams({
    limit: '3',
    fields: 'key,title,author_name,first_publish_year,publisher,isbn,edition_count',
  })
  if (title) {
    params.set('title', title)
    if (author) params.set('author', author)
  } else {
    params.set('q', queryText)
  }
  return `https://openlibrary.org/search.json?${params.toString()}`
}

function normalizeForMatch(value) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:the|a|an|and|of|in|on|for|to|with|by)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreOpenLibraryDoc(reading, doc) {
  const readingTitle = normalizeForMatch(reading.title ?? reading.raw_citation)
  const docTitle = normalizeForMatch(doc.title)
  const readingAuthor = normalizeForMatch(reading.author)
  const docAuthors = normalizeForMatch((doc.author_name ?? []).join(' '))
  if (!readingTitle || !docTitle) return 0
  let score = 0
  if (docTitle === readingTitle) score += 7
  if (docTitle.includes(readingTitle) || readingTitle.includes(docTitle)) score += 4
  const readingTokens = new Set(readingTitle.split(' ').filter((token) => token.length > 2))
  const docTokens = new Set(docTitle.split(' ').filter((token) => token.length > 2))
  const overlap = [...readingTokens].filter((token) => docTokens.has(token)).length
  score += overlap
  if (readingAuthor && docAuthors) {
    const authorTokens = readingAuthor.split(' ').filter((token) => token.length > 2)
    if (authorTokens.some((token) => docAuthors.includes(token))) score += 3
  }
  if (reading.publication_year && doc.first_publish_year && String(reading.publication_year) === String(doc.first_publish_year)) score += 1
  return score
}

function openLibraryMatchForReading(reading, payload) {
  const docs = Array.isArray(payload?.docs) ? payload.docs : []
  const candidates = docs
    .map((doc) => ({ doc, score: scoreOpenLibraryDoc(reading, doc) }))
    .filter((row) => row.score >= 5)
    .sort((a, b) => b.score - a.score)
  const best = candidates[0]
  if (!best) return null
  const workKey = best.doc.key?.startsWith('/works/') ? best.doc.key : null
  if (!workKey) return null
  return {
    external_work_id: `openlibrary:${workKey.replace('/works/', '')}`,
    external_work_url: `https://openlibrary.org${workKey}`,
    external_link_provider: 'openlibrary',
    external_link_status: 'matched',
    external_link_score: best.score,
    external_title: best.doc.title ?? null,
    external_author: Array.isArray(best.doc.author_name) ? best.doc.author_name.slice(0, 4).join('; ') : null,
    external_first_publish_year: best.doc.first_publish_year ?? null,
    external_publisher: Array.isArray(best.doc.publisher) ? best.doc.publisher[0] : null,
    external_isbn: Array.isArray(best.doc.isbn) ? best.doc.isbn[0] : null,
    external_edition_count: best.doc.edition_count ?? null,
  }
}

async function enrichReadingLinks(readings, limit = readingLinkLimit) {
  const enriched = []
  let attempted = 0
  let matched = 0
  for (const reading of readings) {
    const row = { ...reading }
    const queryUrl = openLibraryQueryForReading(row)
    if (!queryUrl || row.external_link_status === 'matched' || attempted >= limit) {
      enriched.push(row)
      continue
    }
    attempted += 1
    try {
      const response = await fetchWithTimeout(queryUrl, 20000)
      if (!response.ok) throw new Error(`Open Library HTTP ${response.status}`)
      const payload = JSON.parse(response.buffer.toString('utf8'))
      const match = openLibraryMatchForReading(row, payload)
      if (match) {
        Object.assign(row, match)
        row.linking_status = row.linking_status === 'unresolved' ? 'external_catalog_match' : row.linking_status
        row.canonical_work_id = row.canonical_work_id ?? `work_${slug(`${match.external_title ?? row.title ?? row.raw_citation}_${match.external_author ?? row.author ?? 'unknown'}`)}`
        if (!row.title && match.external_title) row.title = match.external_title
        if (!row.author && match.external_author) row.author = match.external_author
        if (!row.publication_year && match.external_first_publish_year) row.publication_year = String(match.external_first_publish_year)
        matched += 1
      } else {
        row.external_link_provider = 'openlibrary'
        row.external_link_status = 'no_confident_match'
      }
    } catch (error) {
      row.external_link_provider = 'openlibrary'
      row.external_link_status = 'lookup_error'
      row.external_link_error = error.message
    }
    enriched.push(row)
    if (attempted < limit) await new Promise((resolve) => setTimeout(resolve, 1100))
  }
  return { readings: enriched, attempted, matched }
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

function buildFacultySearchQueries(facultyRows = [], facultyCourseEdges = [], limit = 160) {
  const facultyById = new Map(facultyRows.map((row) => [row.faculty_id, row]))
  const queryRows = []
  const seen = new Set()
  const addQuery = ({ faculty, edge = null, query, queryIntent, priority = 'medium' }) => {
    const normalized = normalizeSearchQueryText(query)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    const edgeKey = edge?.edge_id ?? `faculty_${faculty.faculty_id}`
    const intentSlug = slug(queryIntent)
    queryRows.push({
      query_id: `faculty_query_${slug(edgeKey)}_${intentSlug}_${String(queryRows.length + 1).padStart(3, '0')}`,
      query,
      faculty_id: faculty.faculty_id,
      faculty_name: faculty.name,
      course_code: edge?.course_code ?? null,
      course_title: edge?.course_title ?? null,
      term: edge?.term ?? null,
      query_intent: queryIntent,
      priority,
      status: 'pending_search_export_or_api',
      generated_at: retrievedAt,
      source_edge_id: edge?.edge_id ?? null,
    })
  }

  const prioritizedEdges = facultyCourseEdges
    .filter((edge) => edge.faculty_id && facultyById.has(edge.faculty_id))
    .sort((a, b) => {
      const gradeRank = { A: 0, B: 1, C: 2, D: 3, E: 4 }
      return (gradeRank[a.evidence_grade] ?? 9) - (gradeRank[b.evidence_grade] ?? 9)
        || String(b.term ?? '').localeCompare(String(a.term ?? ''))
        || String(a.faculty_name).localeCompare(String(b.faculty_name))
        || String(a.course_title ?? '').localeCompare(String(b.course_title ?? ''))
    })

  for (const edge of prioritizedEdges) {
    const faculty = facultyById.get(edge.faculty_id)
    const coursePart = edge.course_code
      ? `("${edge.course_title ?? edge.course_code}" OR "${edge.course_code}")`
      : `"${edge.course_title}"`
    addQuery({
      faculty,
      edge,
      query: `"${faculty.name}" "RISD" "Graphic Design" ${coursePart} "syllabus"`,
      queryIntent: 'faculty course syllabus',
      priority: edge.evidence_grade === 'A' ? 'high' : 'medium',
    })
    addQuery({
      faculty,
      edge,
      query: `"${faculty.name}" "RISD" "Graphic Design" ${coursePart} "project"`,
      queryIntent: 'faculty course project brief',
      priority: edge.evidence_grade === 'A' ? 'high' : 'medium',
    })
    addQuery({
      faculty,
      edge,
      query: `"${faculty.name}" "RISD" "Graphic Design" ${coursePart} "assignment"`,
      queryIntent: 'faculty course assignment',
      priority: 'medium',
    })
    if (queryRows.length >= limit) break
  }

  for (const faculty of facultyRows.sort((a, b) => a.name.localeCompare(b.name))) {
    addQuery({
      faculty,
      query: `"${faculty.name}" "RISD" "Graphic Design" teaching`,
      queryIntent: 'faculty teaching page',
      priority: faculty.profile_urls?.length ? 'medium' : 'high',
    })
    addQuery({
      faculty,
      query: `"${faculty.name}" "RISD" "Graphic Design" studio`,
      queryIntent: 'faculty studio teaching artifact',
      priority: 'medium',
    })
    if (queryRows.length >= limit) break
  }

  return queryRows.slice(0, limit)
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

function isLikelyFacultyPortfolioLink(link, facultyName) {
  let url
  try {
    url = new URL(link.url)
  } catch {
    return false
  }
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  if (host.endsWith('risd.edu')) return false
  if ([
    'instagram.com',
    'linkedin.com',
    'facebook.com',
    'twitter.com',
    'x.com',
    'youtube.com',
    'vimeo.com',
    'google.com',
    'maps.google.com',
  ].some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) return false
  const label = (link.label ?? '').toLowerCase()
  const facultyTokens = facultyName.toLowerCase().split(/\s+/).filter((token) => token.length > 2)
  if (/\b(?:website|portfolio|personal site|studio|practice|work)\b/.test(label)) return true
  if (facultyTokens.some((token) => host.includes(token) || label.includes(token))) return true
  return false
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
    const officialProfileUrl = `${risdGraphicDesignFacultyUrl}/${sluggedName}`
    addCandidate({
      faculty,
      url: officialProfileUrl,
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

    try {
      const fetched = await fetchWithRetry(officialProfileUrl, 2)
      const links = extractLinks(fetched.buffer.toString('utf8'), fetched.finalUrl || officialProfileUrl)
      links
        .filter((link) => isLikelyFacultyPortfolioLink(link, faculty.name))
        .slice(0, 3)
        .forEach((link) => addCandidate({
          faculty,
          url: link.url,
          candidateSource: 'official_risd_profile_external_link',
          matchedOn: link.label ? `profile_link_label:${link.label.slice(0, 80)}` : 'profile_external_url',
        }))
    } catch {
      // Official profile links are opportunistic discovery; failed profile fetches are tracked during ingestion.
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
    const linkedItems = source.source_type === 'official_student_work_story'
      ? []
      : links.filter((link) => isLikelyStudentWorkLink(link)).slice(0, 20)

    if (linkedItems.length) {
      linkedItems.forEach((link, index) => {
        const label = link.label || titleFromUrl(link.url)
        const linkEvidence = `${label} ${link.url}`
        const courseContext = inferCourseContextFromStudentWork(`${source.title ?? ''} ${source.course_title ?? ''} ${linkEvidence} ${snippets.slice(0, 3).join(' ')}`)
        rows.push({
          student_work_id: `work_${source.source_id.replace(/^src_/, '')}_${String(index + 1).padStart(2, '0')}`,
          url: link.url,
          source_ids: [source.source_id],
          course_code: source.course_code ?? courseContext.course_code,
          course_title: source.course_title ?? courseContext.course_title ?? inferCourseTitleFromStudentWork(linkEvidence, ''),
          instructor: source.instructor ?? null,
          term: source.term ?? null,
          student_name_public: extractStudentNames(label)[0] ?? null,
          medium: inferStudentWorkMedium(linkEvidence) ?? medium,
          project_title: label || null,
          project_statement_excerpt: snippets[0] ?? null,
          assignment_link_confidence: classifyStudentWorkAssignmentLink(linkEvidence, ''),
          visual_standard_notes: visualStandardNotes([label, ...snippets.slice(0, 3)]),
          medium_evidence: snippets,
          course_inference_confidence: source.course_title || source.course_code ? 'source_metadata' : courseContext.inference_confidence,
          course_inference_basis: source.course_title || source.course_code ? 'student work source carries course metadata' : courseContext.inference_basis,
          confidence: source.source_type === 'official_student_work_story' ? 'D' : 'E',
          evidence_grade: source.source_type === 'official_student_work_story' ? 'D' : 'E',
        })
      })
    } else {
      const courseContext = inferCourseContextFromStudentWork(`${source.title ?? ''} ${source.course_title ?? ''} ${source.url} ${text}`)
      rows.push({
        student_work_id: `work_${source.source_id.replace(/^src_/, '')}`,
        url: source.url,
        source_ids: [source.source_id],
        course_code: source.course_code ?? courseContext.course_code,
        course_title: source.course_title ?? courseContext.course_title ?? inferCourseTitleFromStudentWork(source.title ?? '', text),
        instructor: source.instructor ?? null,
        term: source.term ?? null,
        student_name_public: studentNames[0] ?? null,
        medium,
        project_title: source.title ?? source.course_title ?? null,
        project_statement_excerpt: snippets[0] ?? null,
        assignment_link_confidence: classifyStudentWorkAssignmentLink(source.title ?? '', text),
        visual_standard_notes: visualStandardNotes(snippets),
        medium_evidence: snippets,
        course_inference_confidence: source.course_title || source.course_code ? 'source_metadata' : courseContext.inference_confidence,
        course_inference_basis: source.course_title || source.course_code ? 'student work source carries course metadata' : courseContext.inference_basis,
        confidence: source.source_type === 'official_student_work_story' ? 'D' : 'E',
        evidence_grade: source.source_type === 'official_student_work_story' ? 'D' : 'E',
      })
    }
  }
  return rows
}

function isExternalFacultyProfileSource(source) {
  if (source.source_type !== 'faculty_profile') return false
  try {
    return !new URL(source.url).hostname.endsWith('risd.edu')
  } catch {
    return false
  }
}

function isLikelyFacultyPortfolioExampleLink(link) {
  const combined = `${link.url} ${link.label ?? ''}`.toLowerCase()
  if (!link.label || link.label.length < 2) return false
  if (/about|contact|cv|resume|instagram|linkedin|facebook|twitter|privacy|newsletter|shop|cart|press|client|index|home\b/.test(combined)) return false
  return /project|work|archive|poster|book|publication|identity|type|letter|exhibition|studio|design|print|web|site|specimen|collection|gallery|20\d{2}/.test(combined)
}

function buildFacultyPortfolioExamples(inspected) {
  const rows = []
  for (const { source, text, links = [] } of inspected.filter(({ source, text }) => source.extraction_status === 'ok' && text && isExternalFacultyProfileSource(source))) {
    const snippets = sentenceSnippets(text, ['project', 'work', 'poster', 'book', 'publication', 'identity', 'type', 'exhibition', 'design'], 10)
    const medium = inferStudentWorkMedium(`${source.title ?? ''} ${text}`)
    const linkedItems = links.filter((link) => isLikelyFacultyPortfolioExampleLink(link)).slice(0, 12)
    if (!linkedItems.length && snippets.length) {
      rows.push({
        example_id: `faculty_portfolio_${source.source_id.replace(/^src_/, '')}`,
        faculty_name: source.instructor ?? null,
        url: source.url,
        source_ids: [source.source_id],
        title: source.title ?? null,
        medium,
        project_statement_excerpt: snippets[0],
        visual_standard_notes: visualStandardNotes(snippets),
        evidence_grade: 'E',
        relationship: 'faculty_public_portfolio_page',
      })
      continue
    }
    linkedItems.forEach((link, index) => {
      const label = link.label || titleFromUrl(link.url)
      const evidence = `${label} ${link.url}`
      rows.push({
        example_id: `faculty_portfolio_${source.source_id.replace(/^src_/, '')}_${String(index + 1).padStart(2, '0')}`,
        faculty_name: source.instructor ?? null,
        url: link.url,
        source_ids: [source.source_id],
        title: label,
        medium: inferStudentWorkMedium(evidence) ?? medium,
        project_statement_excerpt: snippets[0] ?? null,
        visual_standard_notes: visualStandardNotes([label, ...snippets.slice(0, 3)]),
        evidence_grade: 'E',
        relationship: 'faculty_public_portfolio_example',
      })
    })
  }
  const seen = new Set()
  return rows.filter((row) => {
    const key = `${row.faculty_name ?? ''}|${row.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, facultyPortfolioExampleLimit)
}

function buildCourseSitePages({ sources, syllabi, assignments, readings }) {
  const syllabusBySource = new Map()
  for (const syllabus of syllabi) {
    for (const sourceId of syllabus.source_ids ?? []) {
      const existing = syllabusBySource.get(sourceId) ?? { syllabus_ids: [], schedule_rows: 0, weekly_schedule_evidence_rows: 0 }
      existing.syllabus_ids.push(syllabus.syllabus_id)
      existing.schedule_rows += syllabus.assignment_schedule?.length ?? 0
      existing.weekly_schedule_evidence_rows += syllabus.weekly_schedule_evidence?.length ?? 0
      syllabusBySource.set(sourceId, existing)
    }
  }

  const assignmentsBySource = new Map()
  for (const assignment of assignments) {
    for (const sourceId of assignment.source_ids ?? []) {
      const existing = assignmentsBySource.get(sourceId) ?? { assignment_ids: [], long_assignment_briefs: 0, high_confidence_assignments: 0 }
      existing.assignment_ids.push(assignment.assignment_id)
      if ((assignment.prompt_excerpt?.split(/\s+/).length ?? 0) >= 45) existing.long_assignment_briefs += 1
      if (assignment.assignment_confidence === 'high') existing.high_confidence_assignments += 1
      assignmentsBySource.set(sourceId, existing)
    }
  }

  const readingsBySource = new Map()
  for (const reading of readings) {
    for (const sourceId of reading.source_ids ?? []) {
      const existing = readingsBySource.get(sourceId) ?? { reading_ids: [], normalized_readings: 0 }
      existing.reading_ids.push(reading.reading_id)
      if (reading.canonical_work_id) existing.normalized_readings += 1
      readingsBySource.set(sourceId, existing)
    }
  }

  return sources
    .filter((source) => ['syllabus_pdf', 'syllabus_html', 'course_site', 'assignment_page', 'schedule_page', 'reading_page', 'student_work_archive', 'wayback_capture'].includes(source.source_type))
    .map((source) => {
      const syllabusStats = syllabusBySource.get(source.source_id) ?? { syllabus_ids: [], schedule_rows: 0, weekly_schedule_evidence_rows: 0 }
      const assignmentStats = assignmentsBySource.get(source.source_id) ?? { assignment_ids: [], long_assignment_briefs: 0, high_confidence_assignments: 0 }
      const readingStats = readingsBySource.get(source.source_id) ?? { reading_ids: [], normalized_readings: 0 }
      const isExcludedInfrastructure = /wp-login|wp-admin|\/author\/admin|\/login\b|signin|sign-in|\/auth\b|oauth/.test(source.url.toLowerCase())
      const pageRole = isExcludedInfrastructure
        ? 'excluded_login_or_admin'
        : source.source_type === 'syllabus_pdf' || source.source_type === 'syllabus_html'
        ? 'syllabus'
        : source.source_type === 'assignment_page'
          ? 'project_or_assignment'
          : source.source_type === 'schedule_page'
            ? 'weekly_schedule'
            : source.source_type === 'reading_page'
              ? 'reading_or_resource'
              : source.source_type === 'student_work_archive'
                ? 'student_work'
                : source.source_type === 'wayback_capture'
                  ? 'archived_course_artifact'
                  : 'course_site'
      return {
        page_id: `course_site_page_${source.source_id}`,
        source_id: source.source_id,
        url: source.url,
        page_role: pageRole,
        source_type: source.source_type,
        course_code: source.course_code ?? null,
        course_title: source.course_title ?? null,
        term: source.term ?? null,
        instructor: source.instructor ?? null,
        parent_source_id: source.parent_source_id ?? null,
        crawl_depth: source.crawl_depth ?? 0,
        link_label: source.link_label ?? null,
        extraction_status: source.extraction_status,
        evidence_grade: source.confidence ?? null,
        syllabus_ids: uniq(syllabusStats.syllabus_ids),
        assignment_ids: uniq(assignmentStats.assignment_ids),
        reading_ids: uniq(readingStats.reading_ids),
        schedule_rows: syllabusStats.schedule_rows,
        weekly_schedule_evidence_rows: syllabusStats.weekly_schedule_evidence_rows,
        assignment_count: assignmentStats.assignment_ids.length,
        long_assignment_briefs: assignmentStats.long_assignment_briefs,
        high_confidence_assignments: assignmentStats.high_confidence_assignments,
        reading_count: readingStats.reading_ids.length,
        normalized_readings: readingStats.normalized_readings,
        has_classroom_artifact: !isExcludedInfrastructure && Boolean(syllabusStats.syllabus_ids.length || assignmentStats.assignment_ids.length || readingStats.reading_ids.length || source.source_type === 'student_work_archive'),
      }
    })
    .sort((a, b) => (sourceTypeRank[a.source_type] ?? 99) - (sourceTypeRank[b.source_type] ?? 99) || String(a.course_title ?? '').localeCompare(String(b.course_title ?? '')) || a.url.localeCompare(b.url))
}

function buildAssignmentBriefPages({ courseSitePages, assignments }) {
  const assignmentById = new Map(assignments.map((assignment) => [assignment.assignment_id, assignment]))
  return courseSitePages
    .filter((page) => page.page_role === 'project_or_assignment' || page.assignment_ids?.length)
    .map((page) => {
      const pageAssignments = (page.assignment_ids ?? []).map((id) => assignmentById.get(id)).filter(Boolean)
      const highConfidence = pageAssignments.filter((assignment) => assignment.assignment_confidence === 'high')
      const mediumConfidence = pageAssignments.filter((assignment) => assignment.assignment_confidence === 'medium')
      const lowConfidence = pageAssignments.filter((assignment) => assignment.assignment_confidence === 'low')
      const longBriefs = pageAssignments.filter((assignment) => (assignment.prompt_excerpt?.split(/\s+/).length ?? 0) >= 45)
      const critiqueAssignments = pageAssignments.filter((assignment) => assignment.critique_format || assignment.critique_questions?.length)
      const revisionAssignments = pageAssignments.filter((assignment) => assignment.revision_expectation)
      return {
        brief_page_id: `assignment_brief_page_${page.source_id}`,
        source_id: page.source_id,
        url: page.url,
        page_role: page.page_role,
        course_code: page.course_code,
        course_title: page.course_title,
        term: page.term,
        instructor: page.instructor,
        parent_source_id: page.parent_source_id,
        evidence_grade: page.evidence_grade,
        assignment_ids: pageAssignments.map((assignment) => assignment.assignment_id),
        assignment_count: pageAssignments.length,
        high_confidence_assignments: highConfidence.length,
        medium_confidence_assignments: mediumConfidence.length,
        low_confidence_assignments: lowConfidence.length,
        long_assignment_briefs: longBriefs.length,
        deliverables: uniq(pageAssignments.flatMap((assignment) => assignment.deliverables ?? [])).slice(0, 16),
        constraints: uniq(pageAssignments.flatMap((assignment) => assignment.constraints ?? [])).slice(0, 16),
        materials: uniq(pageAssignments.flatMap((assignment) => assignment.materials ?? [])).slice(0, 16),
        tools: uniq(pageAssignments.flatMap((assignment) => assignment.tools ?? [])).slice(0, 16),
        process_steps: uniq(pageAssignments.flatMap((assignment) => assignment.process_steps ?? [])).slice(0, 16),
        submission_requirements: uniq(pageAssignments.flatMap((assignment) => assignment.submission_requirements ?? [])).slice(0, 16),
        grading_criteria: uniq(pageAssignments.flatMap((assignment) => assignment.grading_criteria ?? [])).slice(0, 16),
        studio_phases: uniq(pageAssignments.flatMap((assignment) => assignment.studio_phases ?? [])).slice(0, 16),
        output_formats: uniq(pageAssignments.map((assignment) => assignment.output_format).filter(Boolean)).slice(0, 12),
        critique_assignment_count: critiqueAssignments.length,
        revision_assignment_count: revisionAssignments.length,
        tacit_goals: uniq(pageAssignments.map((assignment) => assignment.tacit_goal).filter(Boolean)).slice(0, 8),
        representative_assignment_ids: [...highConfidence, ...mediumConfidence, ...lowConfidence].slice(0, 6).map((assignment) => assignment.assignment_id),
        representative_prompts: [...longBriefs, ...highConfidence, ...mediumConfidence]
          .filter((assignment, index, rows) => rows.findIndex((row) => row.assignment_id === assignment.assignment_id) === index)
          .slice(0, 4)
          .map((assignment) => assignment.prompt_excerpt),
        has_complete_brief_signal: Boolean(highConfidence.length || longBriefs.length || pageAssignments.some((assignment) => assignment.boundary_status === 'bounded_assignment_brief')),
      }
    })
    .filter((page) => page.assignment_count > 0 || page.page_role === 'project_or_assignment')
    .sort((a, b) => b.high_confidence_assignments - a.high_confidence_assignments || b.long_assignment_briefs - a.long_assignment_briefs || String(a.course_title ?? '').localeCompare(String(b.course_title ?? '')) || a.url.localeCompare(b.url))
}

function buildScheduleRows({ syllabi, assignments, readings, courseSitePages }) {
  const pageBySourceId = new Map(courseSitePages.map((page) => [page.source_id, page]))
  const assignmentsBySyllabus = new Map()
  const readingsBySyllabus = new Map()
  for (const assignment of assignments) {
    const existing = assignmentsBySyllabus.get(assignment.syllabus_id) ?? []
    existing.push(assignment)
    assignmentsBySyllabus.set(assignment.syllabus_id, existing)
  }
  for (const reading of readings) {
    const existing = readingsBySyllabus.get(reading.syllabus_id) ?? []
    existing.push(reading)
    readingsBySyllabus.set(reading.syllabus_id, existing)
  }

  const rows = []
  for (const syllabus of syllabi) {
    const sourceId = syllabus.source_ids?.[0] ?? null
    const page = sourceId ? pageBySourceId.get(sourceId) : null
    const syllabusAssignments = assignmentsBySyllabus.get(syllabus.syllabus_id) ?? []
    const syllabusReadings = readingsBySyllabus.get(syllabus.syllabus_id) ?? []
    ;(syllabus.assignment_schedule ?? []).forEach((row, index) => {
      const agenda = cleanScheduleAgenda(`${row.topic ?? ''} ${row.assignment_or_reading ?? ''}`)
      const dueAssignmentIds = linkScheduleAssignments(agenda, syllabusAssignments)
      const readingIds = linkScheduleReadings(agenda, syllabusReadings)
      rows.push({
        schedule_id: `schedule_${slug(syllabus.syllabus_id)}_${String(index + 1).padStart(3, '0')}`,
        source_id: sourceId,
        page_id: page?.page_id ?? null,
        syllabus_id: syllabus.syllabus_id,
        course_code: syllabus.course_code ?? page?.course_code ?? null,
        course_title: syllabus.course_title ?? page?.course_title ?? null,
        term: syllabus.term ?? page?.term ?? null,
        instructor: syllabus.instructor ?? page?.instructor ?? null,
        week_number: inferScheduleWeekNumber(row.topic ?? row.assignment_or_reading ?? '', index),
        date: row.date ?? null,
        session_title: inferScheduleSessionTitle(row.topic ?? row.assignment_or_reading ?? ''),
        agenda_excerpt: agenda,
        due_assignment_ids: dueAssignmentIds,
        reading_ids: readingIds,
        critique_signal: /crit|critique|review|feedback|present/i.test(agenda),
        workshop_signal: /workshop|worktime|lab|exercise|tutorial|demo|in-class|activity/i.test(agenda),
        schedule_source: 'syllabus_table_or_outline',
        evidence_grade: syllabus.evidence_grade ?? page?.evidence_grade ?? null,
        boundary_status: row.date ? 'dated_schedule_row' : 'undated_schedule_row',
      })
    })
    ;(syllabus.weekly_schedule_evidence ?? []).forEach((snippet, index) => {
      if (!snippet || (syllabus.assignment_schedule?.length && index > 5)) return
      const agenda = cleanScheduleAgenda(snippet)
      if (isLowInformationScheduleSnippet(agenda)) return
      rows.push({
        schedule_id: `schedule_${slug(syllabus.syllabus_id)}_evidence_${String(index + 1).padStart(3, '0')}`,
        source_id: sourceId,
        page_id: page?.page_id ?? null,
        syllabus_id: syllabus.syllabus_id,
        course_code: syllabus.course_code ?? page?.course_code ?? null,
        course_title: syllabus.course_title ?? page?.course_title ?? null,
        term: syllabus.term ?? page?.term ?? null,
        instructor: syllabus.instructor ?? page?.instructor ?? null,
        week_number: inferScheduleWeekNumber(snippet, index),
        date: null,
        session_title: inferScheduleSessionTitle(snippet),
        agenda_excerpt: agenda,
        due_assignment_ids: linkScheduleAssignments(agenda, syllabusAssignments),
        reading_ids: linkScheduleReadings(agenda, syllabusReadings),
        critique_signal: /crit|critique|review|feedback|present/i.test(agenda),
        workshop_signal: /workshop|worktime|lab|exercise|tutorial|demo|in-class|activity/i.test(agenda),
        schedule_source: 'weekly_schedule_evidence_snippet',
        evidence_grade: bestEvidenceGrade([syllabus.evidence_grade, page?.evidence_grade, 'B']),
        boundary_status: 'partial_schedule_evidence',
      })
    })
  }
  return rows
    .filter((row) => row.source_id && row.agenda_excerpt)
    .sort((a, b) => String(a.course_title ?? '').localeCompare(String(b.course_title ?? '')) || String(a.date ?? '').localeCompare(String(b.date ?? '')) || a.schedule_id.localeCompare(b.schedule_id))
}

function isLowInformationScheduleSnippet(agenda) {
  const normalized = agenda.toLowerCase().trim()
  if (!normalized) return true
  if (/^(?:week|class|session)\s+\d{1,2}$/.test(normalized)) return true
  if (agenda.split(/\s+/).length < 5 && !/\b(?:due|read|crit|critique|review|workshop|lecture|tutorial|assignment|project|present|submit)\b/i.test(agenda)) return true
  return false
}

function cleanScheduleAgenda(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 600)
}

function inferScheduleWeekNumber(value, index) {
  const match = String(value ?? '').match(/\bweek\s+(\d{1,2})\b/i) ?? String(value ?? '').match(/\bclass\s+(\d{1,2})\b/i)
  return match ? Number(match[1]) : null
}

function inferScheduleSessionTitle(value) {
  const cleaned = cleanScheduleAgenda(value)
  if (!cleaned) return null
  const title = cleaned.split(/\s+(?:Due|HW|Homework|Reading|Read|Lecture|Tutorial|Critique)\b/i)[0]?.trim()
  return (title && title.length >= 4 ? title : cleaned).slice(0, 140)
}

function linkScheduleAssignments(agenda, assignments) {
  if (!/\b(?:due|hw|homework|assignment|project|critique|review|present|submit|final)\b/i.test(agenda)) return []
  const normalizedAgenda = normalizeForMatch(agenda)
  return assignments
    .map((assignment) => ({
      assignment,
      score: overlapScore(normalizedAgenda, normalizeForMatch(`${assignment.title ?? ''} ${assignment.prompt_excerpt ?? ''} ${(assignment.deliverables ?? []).join(' ')}`)),
    }))
    .filter(({ score, assignment }) => score >= 2 || (assignment.title && normalizedAgenda.includes(normalizeForMatch(assignment.title))))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ assignment }) => assignment.assignment_id)
}

function linkScheduleReadings(agenda, readings) {
  if (!/\b(?:read|reading|resources?|article|essay|book|chapter|lecture)\b/i.test(agenda)) return []
  const normalizedAgenda = normalizeForMatch(agenda)
  return readings
    .map((reading) => ({
      reading,
      score: overlapScore(normalizedAgenda, normalizeForMatch(`${reading.title ?? ''} ${reading.raw_citation ?? ''} ${reading.citation_excerpt ?? ''}`)),
    }))
    .filter(({ score, reading }) => score >= 2 || (reading.title && normalizedAgenda.includes(normalizeForMatch(reading.title))))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ reading }) => reading.reading_id)
}

function buildStudentWorkAssignmentLinks({ studentWork, assignmentBriefPages, assignments, courseSitePages }) {
  const assignmentById = new Map(assignments.map((assignment) => [assignment.assignment_id, assignment]))
  const briefById = new Map(assignmentBriefPages.map((page) => [page.brief_page_id, page]))
  const coursePageBySource = new Map(courseSitePages.map((page) => [page.source_id, page]))
  const briefPagesByCourse = new Map()
  const briefPagesByUrl = new Map()
  for (const page of assignmentBriefPages) {
    const courseKey = normalizeStudentWorkCourseKey(page.course_code, page.course_title)
    if (courseKey) {
      const existing = briefPagesByCourse.get(courseKey) ?? []
      existing.push(page)
      briefPagesByCourse.set(courseKey, existing)
    }
    if (page.url) briefPagesByUrl.set(canonicalUrl(page.url), page)
  }

  return studentWork.map((work) => {
    const exactBrief = work.url ? briefPagesByUrl.get(canonicalUrl(work.url)) : null
    const sourcePages = (work.source_ids ?? []).map((id) => coursePageBySource.get(id)).filter(Boolean)
    const courseKey = normalizeStudentWorkCourseKey(work.course_code, work.course_title)
    const courseBriefs = courseKey ? (briefPagesByCourse.get(courseKey) ?? []) : []
    const sourcePageBrief = sourcePages
      .map((page) => assignmentBriefPages.find((brief) => brief.source_id === page.source_id || brief.parent_source_id === page.source_id))
      .find(Boolean)
    const bestBrief = exactBrief ?? sourcePageBrief ?? bestBriefPageForStudentWork(work, courseBriefs)
    const bestAssignment = bestBrief
      ? bestStudentWorkAssignment(work, bestBrief, assignmentById)
      : null
    const explicitAssignment = work.assignment_link_confidence === 'explicit_assignment_reference'
    const assignmentReferenceOnly = isAssignmentReferenceOnlyStudentWork(work)
    const relationshipType = assignmentReferenceOnly
      ? 'rejected_weak_match'
      : bestAssignment && (explicitAssignment || exactBrief)
      ? 'assignment_link'
      : bestBrief
        ? 'brief_page_link'
        : courseKey
          ? 'course_context_link'
          : 'rejected_weak_match'
    const linkConfidence = relationshipType === 'assignment_link'
      ? 'high'
      : relationshipType === 'brief_page_link'
        ? (work.course_inference_confidence === 'high' || work.course_inference_confidence === 'source_metadata' ? 'medium' : 'low')
        : relationshipType === 'course_context_link'
          ? (work.course_inference_confidence === 'high' || work.course_inference_confidence === 'source_metadata' ? 'medium' : 'low')
          : 'rejected'
    const evidenceBasis = assignmentReferenceOnly
      ? 'link points to an assignment prompt/reference, not a public student output; not used as comparison evidence'
      : studentWorkLinkEvidenceBasis({ work, relationshipType, exactBrief, sourcePageBrief, bestBrief, bestAssignment })
    return {
      link_id: `student_work_link_${slug(work.student_work_id)}`,
      student_work_id: work.student_work_id,
      student_work_url: work.url,
      source_ids: work.source_ids ?? [],
      relationship_type: relationshipType,
      link_confidence: linkConfidence,
      evidence_basis: evidenceBasis,
      course_code: work.course_code ?? bestBrief?.course_code ?? null,
      course_title: work.course_title ?? bestBrief?.course_title ?? null,
      term: work.term ?? bestBrief?.term ?? null,
      instructor: work.instructor ?? bestBrief?.instructor ?? null,
      brief_page_id: bestBrief?.brief_page_id ?? null,
      assignment_id: relationshipType === 'assignment_link' ? bestAssignment?.assignment_id ?? null : null,
      assignment_title: relationshipType === 'assignment_link' ? bestAssignment?.title ?? null : null,
      brief_page_url: bestBrief?.url ?? null,
      assignment_source_ids: relationshipType === 'assignment_link' ? bestAssignment?.source_ids ?? [] : [],
      visual_standard_notes: work.visual_standard_notes ?? [],
      comparison_use: studentWorkComparisonUse(work, bestBrief, relationshipType),
      rejection_reason: relationshipType === 'rejected_weak_match'
        ? assignmentReferenceOnly
          ? 'assignment/reference link is not public student work output'
          : 'no explicit course, brief-page, or assignment evidence; title/visual similarity alone is not promoted'
        : null,
      evidence_grade: bestEvidenceGrade([work.evidence_grade, bestBrief?.evidence_grade, bestAssignment?.evidence_grade]) ?? work.evidence_grade ?? null,
    }
  }).sort((a, b) => a.relationship_type.localeCompare(b.relationship_type) || String(a.course_title ?? '').localeCompare(String(b.course_title ?? '')) || a.student_work_id.localeCompare(b.student_work_id))
}

function isAssignmentReferenceOnlyStudentWork(work) {
  const combined = `${work.project_title ?? ''} ${work.url ?? ''}`.toLowerCase()
  if (/\bsee (?:full )?assignments?\b|\bfull assignment\b|\bassignment-\d+\b|\bassignment[_-]?week\b|\bthe course website\b|\bcourse website\b/.test(combined)) return true
  try {
    const url = new URL(work.url)
    if (/\/assignments?\b|\/wiki\/assignment|\/unit\d+_overview|paper\.dropbox\.com\/doc\/type-iii-week/.test(`${url.hostname}${url.pathname}`.toLowerCase())) return true
  } catch {
    // Non-URL rows are handled by title evidence.
  }
  return false
}

function normalizeStudentWorkCourseKey(courseCode, courseTitle) {
  if (courseCode) return normalizeForMatch(courseCode)
  if (courseTitle) return normalizeForMatch(courseTitle)
  return null
}

function bestBriefPageForStudentWork(work, courseBriefs) {
  if (!courseBriefs.length) return null
  const workText = normalizeForMatch(`${work.project_title ?? ''} ${work.url ?? ''} ${(work.medium_evidence ?? []).slice(0, 3).join(' ')}`)
  const scored = courseBriefs.map((brief) => {
    const promptText = normalizeForMatch(`${brief.url ?? ''} ${(brief.representative_prompts ?? []).join(' ')} ${(brief.deliverables ?? []).join(' ')} ${(brief.tools ?? []).join(' ')}`)
    const tokenScore = overlapScore(workText, promptText)
    const completeScore = brief.has_complete_brief_signal ? 2 : 0
    const confidenceScore = (brief.high_confidence_assignments ?? 0) > 0 ? 2 : 0
    return { brief, score: tokenScore + completeScore + confidenceScore }
  }).sort((a, b) => b.score - a.score || (b.brief.high_confidence_assignments ?? 0) - (a.brief.high_confidence_assignments ?? 0))
  return scored[0]?.score > 0 ? scored[0].brief : courseBriefs[0]
}

function bestStudentWorkAssignment(work, brief, assignmentById) {
  const assignmentsForBrief = (brief.assignment_ids ?? []).map((id) => assignmentById.get(id)).filter(Boolean)
  if (!assignmentsForBrief.length) return null
  const workText = normalizeForMatch(`${work.project_title ?? ''} ${work.url ?? ''} ${(work.medium_evidence ?? []).slice(0, 4).join(' ')}`)
  return assignmentsForBrief
    .map((assignment) => ({
      assignment,
      score: overlapScore(workText, normalizeForMatch(`${assignment.title ?? ''} ${assignment.prompt_excerpt ?? ''} ${(assignment.deliverables ?? []).join(' ')} ${(assignment.tools ?? []).join(' ')}`))
        + (assignment.assignment_confidence === 'high' ? 3 : assignment.assignment_confidence === 'medium' ? 1 : 0)
        + ((assignment.prompt_excerpt?.split(/\s+/).length ?? 0) >= 45 ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0]?.assignment ?? null
}

function overlapScore(left, right) {
  const leftTokens = new Set(left.split(/\s+/).filter((token) => token.length >= 4))
  if (!leftTokens.size) return 0
  return right.split(/\s+/).filter((token) => leftTokens.has(token)).length
}

function studentWorkLinkEvidenceBasis({ work, relationshipType, exactBrief, sourcePageBrief, bestBrief, bestAssignment }) {
  if (relationshipType === 'assignment_link') {
    if (exactBrief) return `student work URL exactly matches recovered assignment/brief page ${exactBrief.brief_page_id}; linked representative assignment ${bestAssignment?.assignment_id ?? 'unknown'}`
    return `student work source marks an explicit assignment reference and course evidence links to ${bestBrief?.brief_page_id ?? 'a recovered brief page'}`
  }
  if (relationshipType === 'brief_page_link') {
    if (sourcePageBrief) return `student work source page connects to recovered assignment brief page ${sourcePageBrief.brief_page_id}`
    return `student work course context matches recovered assignment brief page ${bestBrief?.brief_page_id ?? 'unknown'}`
  }
  if (relationshipType === 'course_context_link') return work.course_inference_basis ?? 'student work row has course code/title context but no exact brief or assignment boundary'
  return 'no course, brief-page, or assignment boundary evidence available'
}

function studentWorkComparisonUse(work, brief, relationshipType) {
  if (relationshipType === 'rejected_weak_match') return []
  const uses = ['visual_calibration']
  const combined = `${work.medium ?? ''} ${(brief?.deliverables ?? []).join(' ')} ${(brief?.studio_phases ?? []).join(' ')}`.toLowerCase()
  if (/poster|book|website|identity|typeface|presentation|animation|video|interface/.test(combined)) uses.push('deliverable_reference')
  if (/sketch|process|prototype|research|document/.test(combined)) uses.push('process_reference')
  if (/critique|present|review/.test(combined)) uses.push('critique_reference')
  return uniq(uses)
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

function buildArchiveFetchTargets({ sources, wayback, sourceVersions }) {
  const sourceById = new Map(sources.map((source) => [source.source_id, source]))
  const versionBySourceId = new Map(sourceVersions.map((version) => [version.source_id, version]))
  const archiveSourcesByParent = new Map()
  for (const source of sources.filter((row) => row.source_type === 'wayback_capture' && row.parent_source_id)) {
    const existing = archiveSourcesByParent.get(source.parent_source_id) ?? []
    existing.push(source)
    archiveSourcesByParent.set(source.parent_source_id, existing)
  }
  const capturesBySource = new Map()
  for (const capture of wayback) {
    const existing = capturesBySource.get(capture.source_id) ?? []
    existing.push(capture)
    capturesBySource.set(capture.source_id, existing)
  }

  const targets = []
  for (const [sourceId, captures] of capturesBySource) {
    const source = sourceById.get(sourceId)
    const version = versionBySourceId.get(sourceId)
    if (!source || !version) continue
    const archiveSources = archiveSourcesByParent.get(sourceId) ?? []
    const ranked = captures
      .map((capture) => {
        const score = archiveCapturePriorityScore({ source, capture, version })
        return {
          capture,
          score,
          reason: archiveCaptureSelectionReason({ source, capture, version, score }),
        }
      })
      .sort((a, b) => b.score - a.score || a.capture.timestamp.localeCompare(b.capture.timestamp))
      .slice(0, 3)
    for (const { capture, score, reason } of ranked) {
      const alreadyFetched = archiveSources.some((archiveSource) => archiveSource.archive_capture_timestamp === capture.timestamp)
      targets.push({
        target_id: `archive_target_${slug(sourceId)}_${capture.timestamp}`,
        source_id: sourceId,
        current_url: source?.url ?? version?.current_url ?? null,
        current_status: source?.extraction_status ?? version?.current_status ?? null,
        source_type: source?.source_type ?? null,
        course_code: source?.course_code ?? null,
        course_title: source?.course_title ?? null,
        term: source?.term ?? null,
        capture_timestamp: capture.timestamp,
        capture_year: Number(String(capture.timestamp).slice(0, 4)) || null,
        capture_month: Number(String(capture.timestamp).slice(4, 6)) || null,
        original_url: capture.original,
        memento_url: capture.memento_url,
        replay_url: capture.replay_url,
        mimetype: capture.mimetype ?? null,
        digest: capture.digest ?? null,
        priority_score: score,
        priority: score >= 9 ? 'high' : score >= 6 ? 'medium' : 'low',
        selection_reason: reason,
        academic_term_start_aligned: isAcademicTermStartCapture(capture.timestamp),
        comparison_status: version?.comparison_status ?? null,
        existing_archive_source_ids: version?.fetched_archive_source_ids ?? [],
        target_status: alreadyFetched ? 'already_fetched_archive_source' : 'pending_archive_fetch',
        evidence_grade: source?.confidence ?? version?.evidence_grade ?? null,
      })
    }
  }
  return targets.sort((a, b) => b.priority_score - a.priority_score || a.source_id.localeCompare(b.source_id) || a.capture_timestamp.localeCompare(b.capture_timestamp))
}

function archiveCapturePriorityScore({ source, capture, version }) {
  const combined = `${source?.url ?? ''} ${source?.title ?? ''} ${source?.source_type ?? ''} ${source?.course_title ?? ''}`.toLowerCase()
  let score = 0
  if (isAcademicTermStartCapture(capture.timestamp)) score += 4
  if (/syllabus|assignment|project|schedule|week|course|studio|type|typography|graphic/.test(combined)) score += 3
  if (['syllabus_pdf', 'syllabus_html', 'assignment_page', 'schedule_page', 'course_site'].includes(source?.source_type)) score += 2
  if (version?.comparison_status === 'metadata_only') score += 2
  if (source?.extraction_status !== 'ok') score += 2
  if (/student|gallery|work/.test(combined)) score += 1
  return score
}

function archiveCaptureSelectionReason({ source, capture, version, score }) {
  const reasons = []
  if (isAcademicTermStartCapture(capture.timestamp)) reasons.push('capture near academic term start')
  if (version?.comparison_status === 'metadata_only') reasons.push('source has capture metadata but no fetched archive comparison')
  if (source?.extraction_status !== 'ok') reasons.push('current source extraction failed or was incomplete')
  if (['syllabus_pdf', 'syllabus_html', 'assignment_page', 'schedule_page', 'course_site'].includes(source?.source_type)) reasons.push(`classroom artifact source type: ${source.source_type}`)
  if (!reasons.length) reasons.push(`ranked by archive priority score ${score}`)
  return reasons.join('; ')
}

function isAcademicTermStartCapture(timestamp) {
  const month = Number(String(timestamp).slice(4, 6))
  return [1, 2, 5, 9].includes(month)
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
  if (/risd\.edu\/(?:academics|admissions|giving|news)(?:\/|$)|students\.risd\.edu|sfs\.risd\.edu|strategicplanning\.risd\.edu/.test(combined)) return false
  if (/^(?:academics|admissions|financial aid|giving|news and events|student hub|strategic planning|undergraduate study|graduate study|liberal arts|concentrations|search course listings|academic leadership|faculty|academic and creative partnerships)$/i.test(link.label.trim())) return false
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
    ?? inferCourseContextFromStudentWork(combined).course_title
    ?? combined.match(/\b(?:Design Studio 1|Typography III|Web Programming|Graphic Design for the Web|HTML Output)\b/i)?.[0]
    ?? null
}

function inferCourseContextFromStudentWork(evidence) {
  const combined = evidence.toLowerCase()
  if (/ds1618\.risd\.gd|design studio 2016|design studio 1|\bds1\b|unit\d+_overview/.test(combined)) {
    return {
      course_code: 'GRAPH-3210',
      course_title: 'Design Studio 1',
      inference_confidence: 'high',
      inference_basis: 'student work URL/title references public Design Studio 1 course archive',
    }
  }
  if (/wp1[56]|web programming|scandinavian flag|css drawings?|abstract shape|responsive animation|single page website|risd-gd\.github\.io\/wp/.test(combined)) {
    return {
      course_code: 'GRAPH-3188-03',
      course_title: 'Web Programming',
      inference_confidence: 'high',
      inference_basis: 'student work URL/title references public Web Programming assignment archive',
    }
  }
  if (/type[\s-]*iii|typography iii|type-iii|paper\.dropbox\.com\/doc\/type-iii/.test(combined)) {
    return {
      course_code: null,
      course_title: 'Typography III',
      inference_confidence: 'medium',
      inference_basis: 'student work URL/title references public Type III assignment context',
    }
  }
  if (/html output|typographic landscapes|htmloutput\.risd\.gd/.test(combined)) {
    return {
      course_code: null,
      course_title: 'HTML Output',
      inference_confidence: 'medium',
      inference_basis: 'student work URL/title references public HTML Output course domain',
    }
  }
  if (/in motion|video and animation|motion graphics/.test(combined)) {
    return {
      course_code: null,
      course_title: 'In Motion: Design for Video and Animation',
      inference_confidence: 'high',
      inference_basis: 'official RISD story names the course context',
    }
  }
  return {
    course_code: null,
    course_title: null,
    inference_confidence: null,
    inference_basis: null,
  }
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

function validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency = [], scheduleRows = null, searchCandidates = [], searchPromotions = null, commonCrawlCandidates = [], commonCrawlPromotions = [], archivePromotions = null, facultyProfileCandidates = [], faculty = [], facultyCourseEdges = [], studentWork = [], studentWorkAssignmentLinks = null, facultyPortfolioExamples = [], courseSitePages = null, assignmentBriefPages = null, archiveFetchTargets = null, sourceClusters = [], sourceVersions = [], wayback, reviewQueue = [], reviewDecisions = [], fieldConflicts = [], courseCoverage = [], coverageSearchQueries = [], facultySearchQueries = null }) {
  const effectiveSearchPromotions = searchPromotions ?? loadJsonl(join(outDir, 'search_promotions.jsonl'))
  const effectiveArchivePromotions = archivePromotions ?? loadJsonl(join(outDir, 'archive_promotions.jsonl'))
  const effectiveFacultySearchQueries = facultySearchQueries ?? loadJsonl(join(outDir, 'faculty_search_queries.jsonl'))
  const effectiveCourseSitePages = courseSitePages ?? loadJsonl(join(outDir, 'course_site_pages.jsonl'))
  const effectiveAssignmentBriefPages = assignmentBriefPages ?? loadJsonl(join(outDir, 'assignment_brief_pages.jsonl'))
  const effectiveStudentWorkAssignmentLinks = studentWorkAssignmentLinks ?? loadJsonl(join(outDir, 'student_work_assignment_links.jsonl'))
  const effectiveScheduleRows = scheduleRows ?? loadJsonl(join(outDir, 'schedule_rows.jsonl'))
  const effectiveArchiveFetchTargets = archiveFetchTargets ?? loadJsonl(join(outDir, 'archive_fetch_targets.jsonl'))
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
  const fieldStructuredAssignmentCount = assignments.filter((assignment) => assignment.process_steps?.length || assignment.submission_requirements?.length || assignment.grading_criteria?.length || assignment.assignment_boundary_evidence?.boundary_marker).length
  const highConfidenceAssignmentCount = assignments.filter((assignment) => assignment.assignment_confidence === 'high').length
  const mediumConfidenceAssignmentCount = assignments.filter((assignment) => assignment.assignment_confidence === 'medium').length
  const lowConfidenceAssignmentCount = assignments.filter((assignment) => assignment.assignment_confidence === 'low').length
  const longAssignmentBriefCount = assignments.filter((assignment) => (assignment.prompt_excerpt?.split(/\s+/).length ?? 0) >= 45).length
  const assignmentBoundaryErrors = assignments.filter((assignment) => !assignment.assignment_confidence || !assignment.boundary_status)
  const assignmentFieldEvidenceErrors = assignments.filter((assignment) =>
    !assignment.assignment_boundary_evidence
      || !assignment.assignment_boundary_evidence.boundary_status
      || assignment.assignment_boundary_evidence.source_ids?.some((id) => !sourceIds.has(id))
      || assignment.assignment_boundary_evidence.boundary_status !== assignment.boundary_status
  )
  const readingSourceErrors = readings.filter((reading) => !syllabusIds.has(reading.syllabus_id) || reading.source_ids.some((id) => !sourceIds.has(id)))
  const readingIds = new Set(readings.map((reading) => reading.reading_id))
  const normalizedReadingCount = readings.filter((reading) => reading.canonical_work_id).length
  const catalogReadingCount = readings.filter((reading) => reading.linking_status === 'local_catalog_match').length
  const externalCatalogReadingCount = readings.filter((reading) => reading.linking_status === 'external_catalog_match' || reading.external_link_status === 'matched').length
  const externalCatalogAttemptCount = readings.filter((reading) => reading.external_link_provider).length
  const externalCatalogErrors = readings.filter((reading) => reading.external_link_provider && (!reading.external_link_status || (reading.external_link_status === 'matched' && !reading.external_work_id)))
  const unresolvedReadingCount = readings.filter((reading) => reading.linking_status === 'unresolved').length
  const nonCitationReadingCount = readings.filter((reading) => reading.linking_status === 'non_citation_fragment').length
  const searchCandidateErrors = searchCandidates.filter((candidate) => !candidate.candidate_id || !candidate.status || candidate.promoted_source_id && !sourceIds.has(candidate.promoted_source_id))
  const promotedSearchCandidateCount = searchCandidates.filter((candidate) => candidate.promoted_source_id).length
  const importedSearchCandidateCount = searchCandidates.filter((candidate) => candidate.source === 'imported_search_export').length
  const liveSearchCandidateCount = searchCandidates.filter((candidate) => candidate.source === 'live_search_api').length
  const liveSearchProviderUnconfiguredCount = searchCandidates.filter((candidate) => candidate.source === 'live_search_api' && candidate.status === 'provider_unconfigured').length
  const coverageSearchBacklogCount = searchCandidates.filter((candidate) => candidate.source === 'coverage_query_backlog').length
  const liveCoverageSearchCandidateCount = searchCandidates.filter((candidate) => candidate.source === 'live_search_api' && candidate.query_source === 'coverage_gap_query').length
  const liveCoverageProviderUnconfiguredCount = searchCandidates.filter((candidate) => candidate.source === 'live_search_api' && candidate.query_source === 'coverage_gap_query' && candidate.status === 'provider_unconfigured').length
  const coverageIds = new Set(courseCoverage.map((row) => row.coverage_id))
  const coverageSearchBacklogErrors = searchCandidates.filter((candidate) =>
    candidate.source === 'coverage_query_backlog'
      && (!candidate.query_id || !candidate.query || !candidate.missing_requirement || !candidate.source_coverage_id || !coverageIds.has(candidate.source_coverage_id))
  )
  const liveCoverageSearchErrors = searchCandidates.filter((candidate) =>
    candidate.source === 'live_search_api'
      && candidate.query_source === 'coverage_gap_query'
      && (!candidate.query_id || !candidate.query || !candidate.missing_requirement || !candidate.source_coverage_id || !coverageIds.has(candidate.source_coverage_id))
  )
  const searchCandidateIds = new Set(searchCandidates.map((candidate) => candidate.candidate_id))
  const searchPromotionErrors = effectiveSearchPromotions.filter((promotion) =>
    !promotion.promotion_id
      || !promotion.candidate_id
      || !searchCandidateIds.has(promotion.candidate_id)
      || promotion.extraction_status !== 'rejected_before_fetch' && !promotion.promoted_source_id
      || promotion.extraction_status === 'rejected_before_fetch' && !promotion.error
      || promotion.extraction_status === 'ok' && !sourceIds.has(promotion.promoted_source_id)
  )
  const successfulSearchPromotions = effectiveSearchPromotions.filter((promotion) => promotion.extraction_status === 'ok').length
  const rejectedSearchPromotions = effectiveSearchPromotions.filter((promotion) => promotion.extraction_status === 'rejected_before_fetch').length
  const failedSearchPromotions = effectiveSearchPromotions.filter((promotion) => promotion.extraction_status && !['ok', 'rejected_before_fetch'].includes(promotion.extraction_status)).length
  const commonCrawlCandidateErrors = commonCrawlCandidates.filter((candidate) => !candidate.candidate_id || !candidate.query_id || !candidate.index_id || !candidate.candidate_status)
  const commonCrawlFetchCandidateCount = commonCrawlCandidates.filter((candidate) => candidate.candidate_status === 'candidate_for_public_fetch').length
  const ingestedCommonCrawlCandidateCount = commonCrawlCandidates.filter((candidate) => candidate.candidate_status === 'ingested_into_corpus').length
  const commonCrawlCandidateIds = new Set(commonCrawlCandidates.map((candidate) => candidate.candidate_id))
  const commonCrawlPromotionErrors = commonCrawlPromotions.filter((promotion) => !promotion.promotion_id || !promotion.candidate_id || !commonCrawlCandidateIds.has(promotion.candidate_id) || !promotion.promoted_source_id || !promotion.extraction_status)
  const successfulCommonCrawlPromotions = commonCrawlPromotions.filter((promotion) => promotion.extraction_status === 'ok').length
  const ingestedCommonCrawlPromotions = commonCrawlPromotions.filter((promotion) => promotion.ingestion_status === 'ingested_into_corpus').length
  const facultyIds = new Set(faculty.map((row) => row.faculty_id))
  const facultyCourseEdgeIds = new Set(facultyCourseEdges.map((row) => row.edge_id))
  const facultyProfileCandidateErrors = facultyProfileCandidates.filter((candidate) => !candidate.candidate_id || !candidate.faculty_id || !facultyIds.has(candidate.faculty_id) || !candidate.url || !candidate.status || candidate.promoted_source_id && !sourceIds.has(candidate.promoted_source_id))
  const ingestedFacultyProfileCandidateCount = facultyProfileCandidates.filter((candidate) => candidate.status === 'ingested_into_corpus').length
  const facultyRowsWithProfileUrls = faculty.filter((row) => row.profile_urls?.length).length
  const facultySourceErrors = faculty.filter((row) => !row.faculty_id || !row.name || row.source_ids?.some((id) => !sourceIds.has(id)))
  const facultyEdgeErrors = facultyCourseEdges.filter((edge) => !edge.edge_id || !facultyIds.has(edge.faculty_id) || edge.source_ids?.some((id) => !sourceIds.has(id)))
  const facultySearchQueryErrors = effectiveFacultySearchQueries.filter((row) => !row.query_id || !row.query || !row.faculty_id || !facultyIds.has(row.faculty_id) || row.source_edge_id && !facultyCourseEdgeIds.has(row.source_edge_id))
  const facultySearchBacklogCount = searchCandidates.filter((candidate) => candidate.source === 'faculty_query_backlog').length
  const facultySearchBacklogErrors = searchCandidates.filter((candidate) => candidate.source === 'faculty_query_backlog' && (!candidate.query_id || !candidate.query || !candidate.faculty_id || !facultyIds.has(candidate.faculty_id) || candidate.source_edge_id && !facultyCourseEdgeIds.has(candidate.source_edge_id)))
  const liveFacultySearchCandidateCount = searchCandidates.filter((candidate) => candidate.source === 'live_search_api' && candidate.query_source === 'faculty_teaching_query').length
  const liveFacultySearchErrors = searchCandidates.filter((candidate) => candidate.source === 'live_search_api' && candidate.query_source === 'faculty_teaching_query' && (!candidate.query_id || !candidate.query || !candidate.faculty_id || !facultyIds.has(candidate.faculty_id) || candidate.source_edge_id && !facultyCourseEdgeIds.has(candidate.source_edge_id)))
  const studentWorkSourceErrors = studentWork.filter((work) => work.source_ids.some((id) => !sourceIds.has(id)))
  const structuredStudentWorkCount = studentWork.filter((work) => work.url && (work.medium || work.project_title || work.project_statement_excerpt || work.assignment_link_confidence || work.visual_standard_notes?.length) && work.evidence_grade).length
  const courseLinkedStudentWorkCount = studentWork.filter((work) => work.course_code || work.course_title).length
  const studentWorkIds = new Set(studentWork.map((work) => work.student_work_id))
  const courseCoverageErrors = courseCoverage.filter((row) => row.source_ids?.some((id) => !sourceIds.has(id)) || !row.requirements || typeof row.coverage_score !== 'number')
  const highCoverageCourseCount = courseCoverage.filter((row) => row.coverage_score >= 80).length
  const lowCoverageCourseCount = courseCoverage.filter((row) => row.coverage_score < 40).length
  const coverageSearchQueryErrors = coverageSearchQueries.filter((row) => !row.query || !row.missing_requirement || !row.source_coverage_id)
  const facultyPortfolioExampleErrors = facultyPortfolioExamples.filter((example) => !example.example_id || !example.url || example.source_ids?.some((id) => !sourceIds.has(id)))
  const structuredFacultyPortfolioExampleCount = facultyPortfolioExamples.filter((example) => example.url && example.faculty_name && (example.medium || example.title || example.project_statement_excerpt || example.visual_standard_notes?.length)).length
  const courseSitePageErrors = effectiveCourseSitePages.filter((page) => !page.page_id || !page.source_id || !sourceIds.has(page.source_id) || !page.page_role || !page.source_type)
  const courseSitePagesWithClassroomArtifacts = effectiveCourseSitePages.filter((page) => page.has_classroom_artifact).length
  const courseSiteAssignmentPageCount = effectiveCourseSitePages.filter((page) => page.page_role === 'project_or_assignment').length
  const courseSiteSchedulePageCount = effectiveCourseSitePages.filter((page) => page.page_role === 'weekly_schedule').length
  const courseSiteSyllabusPageCount = effectiveCourseSitePages.filter((page) => page.page_role === 'syllabus').length
  const courseSitePagesWithLongBriefs = effectiveCourseSitePages.filter((page) => page.long_assignment_briefs > 0).length
  const assignmentIds = new Set(assignments.map((assignment) => assignment.assignment_id))
  const courseSitePageIds = new Set(effectiveCourseSitePages.map((page) => page.page_id))
  const scheduleRowErrors = effectiveScheduleRows.filter((row) =>
    !row.schedule_id
      || !row.source_id
      || !sourceIds.has(row.source_id)
      || row.page_id && !courseSitePageIds.has(row.page_id)
      || !row.syllabus_id
      || !syllabusIds.has(row.syllabus_id)
      || row.due_assignment_ids?.some((id) => !assignmentIds.has(id))
      || row.reading_ids?.some((id) => !readingIds.has(id))
      || !row.schedule_source
      || !row.boundary_status
  )
  const datedScheduleRowCount = effectiveScheduleRows.filter((row) => row.date).length
  const tableScheduleRowCount = effectiveScheduleRows.filter((row) => row.schedule_source === 'syllabus_table_or_outline').length
  const snippetScheduleRowCount = effectiveScheduleRows.filter((row) => row.schedule_source === 'weekly_schedule_evidence_snippet').length
  const scheduleRowsWithAssignmentLinks = effectiveScheduleRows.filter((row) => row.due_assignment_ids?.length).length
  const scheduleRowsWithReadingLinks = effectiveScheduleRows.filter((row) => row.reading_ids?.length).length
  const scheduleRowsWithCritiqueSignals = effectiveScheduleRows.filter((row) => row.critique_signal).length
  const assignmentBriefPageErrors = effectiveAssignmentBriefPages.filter((page) => !page.brief_page_id || !page.source_id || !sourceIds.has(page.source_id) || page.assignment_ids?.some((id) => !assignmentIds.has(id)))
  const assignmentBriefPagesWithCompleteSignals = effectiveAssignmentBriefPages.filter((page) => page.has_complete_brief_signal).length
  const assignmentBriefPagesWithCritique = effectiveAssignmentBriefPages.filter((page) => page.critique_assignment_count > 0).length
  const assignmentBriefPagesWithRevision = effectiveAssignmentBriefPages.filter((page) => page.revision_assignment_count > 0).length
  const assignmentBriefPageIds = new Set(effectiveAssignmentBriefPages.map((page) => page.brief_page_id))
  const studentWorkAssignmentLinkErrors = effectiveStudentWorkAssignmentLinks.filter((link) =>
    !link.link_id
      || !link.student_work_id
      || !studentWorkIds.has(link.student_work_id)
      || link.source_ids?.some((id) => !sourceIds.has(id))
      || link.assignment_id && !assignmentIds.has(link.assignment_id)
      || link.brief_page_id && !assignmentBriefPageIds.has(link.brief_page_id)
      || !link.relationship_type
      || !link.link_confidence
      || !link.evidence_grade
  )
  const studentWorkAssignmentLinkCount = effectiveStudentWorkAssignmentLinks.filter((link) => link.relationship_type === 'assignment_link').length
  const studentWorkBriefPageLinkCount = effectiveStudentWorkAssignmentLinks.filter((link) => link.relationship_type === 'brief_page_link').length
  const studentWorkCourseContextLinkCount = effectiveStudentWorkAssignmentLinks.filter((link) => link.relationship_type === 'course_context_link').length
  const studentWorkRejectedWeakLinkCount = effectiveStudentWorkAssignmentLinks.filter((link) => link.relationship_type === 'rejected_weak_match').length
  const sourceClusterErrors = sourceClusters.filter((cluster) => !cluster.representative_source_id || !cluster.source_ids?.length || cluster.source_ids.some((id) => !sourceIds.has(id)))
  const sourceVersionErrors = sourceVersions.filter((version) => !version.source_id || !version.version_id || version.current_source_id && !sourceIds.has(version.current_source_id) || version.fetched_archive_source_ids?.some((id) => !sourceIds.has(id)))
  const fetchedArchiveVersionCount = sourceVersions.filter((version) => version.comparison_status === 'fetched_archive_compared').length
  const metadataOnlyVersionCount = sourceVersions.filter((version) => version.comparison_status === 'metadata_only').length
  const sourceVersionIds = new Set(sourceVersions.map((version) => version.source_id))
  const archiveFetchTargetErrors = effectiveArchiveFetchTargets.filter((target) =>
    !target.target_id
      || !target.source_id
      || !sourceIds.has(target.source_id)
      || !sourceVersionIds.has(target.source_id)
      || !target.capture_timestamp
      || !target.memento_url
      || !target.replay_url
      || !target.selection_reason
      || !target.target_status
  )
  const highPriorityArchiveFetchTargetCount = effectiveArchiveFetchTargets.filter((target) => target.priority === 'high').length
  const pendingArchiveFetchTargetCount = effectiveArchiveFetchTargets.filter((target) => target.target_status === 'pending_archive_fetch').length
  const termAlignedArchiveFetchTargetCount = effectiveArchiveFetchTargets.filter((target) => target.academic_term_start_aligned).length
  const archiveFetchTargetIds = new Set(effectiveArchiveFetchTargets.map((target) => target.target_id))
  const successfulArchivePromotionCount = effectiveArchivePromotions.filter((promotion) => promotion.extraction_status === 'ok').length
  const failedArchivePromotionCount = effectiveArchivePromotions.filter((promotion) => promotion.extraction_status && promotion.extraction_status !== 'ok').length
  const archivePromotionErrors = effectiveArchivePromotions.filter((promotion) =>
    !promotion.promotion_id
      || !promotion.target_id
      || !archiveFetchTargetIds.has(promotion.target_id)
      || promotion.extraction_status === 'ok' && (!promotion.promoted_source_id || !sourceIds.has(promotion.promoted_source_id))
      || promotion.extraction_status !== 'ok' && !promotion.error
  )
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
      id: 'assignments_have_confidence_boundaries',
      status: assignmentBoundaryErrors.length === 0 && (highConfidenceAssignmentCount + mediumConfidenceAssignmentCount) > 0 ? 'pass' : assignmentBoundaryErrors.length === 0 ? 'warn' : 'fail',
      detail: `${highConfidenceAssignmentCount} high, ${mediumConfidenceAssignmentCount} medium, and ${lowConfidenceAssignmentCount} low confidence assignment rows; ${assignmentBoundaryErrors.length} boundary metadata errors.`,
    },
    {
      id: 'assignments_have_field_level_brief_evidence',
      status: assignmentFieldEvidenceErrors.length === 0 && fieldStructuredAssignmentCount > 0 ? 'pass' : assignmentFieldEvidenceErrors.length === 0 ? 'warn' : 'fail',
      detail: `${fieldStructuredAssignmentCount} assignment rows include process, submission, grading, or boundary-marker evidence; ${assignmentFieldEvidenceErrors.length} field-evidence reference errors.`,
    },
    {
      id: 'assignments_include_long_brief_blocks',
      status: longAssignmentBriefCount > 0 ? 'pass' : 'warn',
      detail: `${longAssignmentBriefCount} assignment records contain long prompt/brief blocks rather than only sentence snippets.`,
    },
    {
      id: 'readings_reference_valid_syllabi_and_sources',
      status: readingSourceErrors.length === 0 ? 'pass' : 'fail',
      detail: `${readingSourceErrors.length} reading reference errors.`,
    },
    {
      id: 'readings_have_normalized_work_links',
      status: normalizedReadingCount > 0 ? 'pass' : 'warn',
      detail: `${normalizedReadingCount} reading snippets linked to ${readingFrequency.length} canonical works; ${catalogReadingCount} local catalog matches, ${externalCatalogReadingCount} external catalog matches, ${unresolvedReadingCount} unresolved, ${nonCitationReadingCount} non-citation fragments.`,
    },
    {
      id: 'readings_external_links_have_metadata',
      status: externalCatalogErrors.length === 0 ? (externalCatalogAttemptCount > 0 ? 'pass' : 'warn') : 'fail',
      detail: `${externalCatalogAttemptCount} Open Library lookup attempts recorded; ${externalCatalogReadingCount} reading snippets have external catalog matches; ${externalCatalogErrors.length} external-link metadata errors.`,
    },
    {
      id: 'schedule_rows_reference_valid_records',
      status: scheduleRowErrors.length === 0 && effectiveScheduleRows.length > 0 ? 'pass' : scheduleRowErrors.length === 0 ? 'warn' : 'fail',
      detail: `${effectiveScheduleRows.length} schedule rows; ${scheduleRowErrors.length} source/page/syllabus/assignment/reading reference errors.`,
    },
    {
      id: 'schedule_rows_preserve_source_boundaries',
      status: tableScheduleRowCount > 0 || snippetScheduleRowCount > 0 ? 'pass' : 'warn',
      detail: `${tableScheduleRowCount} table/outline-derived rows, ${snippetScheduleRowCount} weekly-evidence snippet rows, ${datedScheduleRowCount} dated rows, ${scheduleRowsWithCritiqueSignals} critique/review rows.`,
    },
    {
      id: 'search_candidates_have_provenance',
      status: searchCandidateErrors.length === 0 && searchCandidates.length > 0 ? 'pass' : searchCandidateErrors.length === 0 ? 'warn' : 'fail',
      detail: `${searchCandidates.length} search candidates, ${promotedSearchCandidateCount} promoted, ${importedSearchCandidateCount} imported, ${liveSearchCandidateCount} live API rows (${liveSearchProviderUnconfiguredCount} provider-unconfigured); ${searchCandidateErrors.length} candidate reference errors.`,
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
      id: 'faculty_search_queries_have_provenance',
      status: facultySearchQueryErrors.length === 0 && effectiveFacultySearchQueries.length > 0 ? 'pass' : facultySearchQueryErrors.length === 0 ? 'warn' : 'fail',
      detail: `${effectiveFacultySearchQueries.length} faculty-derived search queries with ${facultySearchQueryErrors.length} provenance errors.`,
    },
    {
      id: 'faculty_search_backlog_is_executable',
      status: facultySearchBacklogErrors.length === 0 && facultySearchBacklogCount === effectiveFacultySearchQueries.length && facultySearchBacklogCount > 0 ? 'pass' : facultySearchBacklogErrors.length === 0 && facultySearchBacklogCount > 0 ? 'warn' : 'fail',
      detail: `${facultySearchBacklogCount} faculty query backlog rows for ${effectiveFacultySearchQueries.length} generated faculty queries; ${facultySearchBacklogErrors.length} backlog provenance errors.`,
    },
    {
      id: 'live_faculty_search_preserves_provenance',
      status: liveFacultySearchErrors.length === 0 && liveFacultySearchCandidateCount > 0 ? 'pass' : liveFacultySearchErrors.length === 0 ? 'warn' : 'fail',
      detail: `${liveFacultySearchCandidateCount} live faculty search rows; ${liveFacultySearchErrors.length} live faculty provenance errors.`,
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
      detail: `${structuredStudentWorkCount} student work rows include URL plus medium/project/evidence metadata; ${courseLinkedStudentWorkCount} rows include course code/title context.`,
    },
    {
      id: 'student_work_assignment_links_reference_valid_records',
      status: studentWorkAssignmentLinkErrors.length === 0 && effectiveStudentWorkAssignmentLinks.length > 0 ? 'pass' : studentWorkAssignmentLinkErrors.length === 0 ? 'warn' : 'fail',
      detail: `${effectiveStudentWorkAssignmentLinks.length} student-work relationship rows; ${studentWorkAssignmentLinkErrors.length} reference or boundary errors.`,
    },
    {
      id: 'student_work_assignment_links_preserve_confidence_boundaries',
      status: studentWorkAssignmentLinkCount > 0 || studentWorkBriefPageLinkCount > 0 || studentWorkCourseContextLinkCount > 0 ? 'pass' : 'warn',
      detail: `${studentWorkAssignmentLinkCount} assignment links, ${studentWorkBriefPageLinkCount} brief-page links, ${studentWorkCourseContextLinkCount} course-context links, and ${studentWorkRejectedWeakLinkCount} rejected weak matches.`,
    },
    {
      id: 'course_coverage_matrix_references_valid_sources',
      status: courseCoverageErrors.length === 0 && courseCoverage.length === courses.length ? 'pass' : courseCoverageErrors.length === 0 ? 'warn' : 'fail',
      detail: `${courseCoverage.length} course coverage rows for ${courses.length} courses; ${highCoverageCourseCount} at 80+ coverage, ${lowCoverageCourseCount} below 40 coverage, and ${courseCoverageErrors.length} coverage metadata/reference errors.`,
    },
    {
      id: 'coverage_search_queries_have_gap_provenance',
      status: coverageSearchQueryErrors.length === 0 && coverageSearchQueries.length > 0 ? 'pass' : coverageSearchQueryErrors.length === 0 ? 'warn' : 'fail',
      detail: `${coverageSearchQueries.length} coverage-derived search queries with ${coverageSearchQueryErrors.length} provenance errors.`,
    },
    {
      id: 'coverage_search_backlog_is_executable',
      status: coverageSearchBacklogErrors.length === 0 && coverageSearchBacklogCount === coverageSearchQueries.length && coverageSearchBacklogCount > 0 ? 'pass' : coverageSearchBacklogErrors.length === 0 && coverageSearchBacklogCount > 0 ? 'warn' : 'fail',
      detail: `${coverageSearchBacklogCount} coverage query backlog rows for ${coverageSearchQueries.length} generated coverage queries; ${coverageSearchBacklogErrors.length} backlog provenance errors.`,
    },
    {
      id: 'live_coverage_search_preserves_gap_provenance',
      status: liveCoverageSearchErrors.length === 0 && liveCoverageSearchCandidateCount > 0 ? 'pass' : liveCoverageSearchErrors.length === 0 ? 'warn' : 'fail',
      detail: `${liveCoverageSearchCandidateCount} live coverage search rows (${liveCoverageProviderUnconfiguredCount} provider-unconfigured); ${liveCoverageSearchErrors.length} live coverage provenance errors.`,
    },
    {
      id: 'search_promotions_reference_candidates_and_sources',
      status: searchPromotionErrors.length === 0 ? 'pass' : 'fail',
      detail: `${effectiveSearchPromotions.length} search promotion decisions, ${successfulSearchPromotions} successful public fetches, ${failedSearchPromotions} failed fetches, ${rejectedSearchPromotions} rejected before fetch; ${searchPromotionErrors.length} reference errors.`,
    },
    {
      id: 'faculty_portfolio_examples_reference_valid_sources',
      status: facultyPortfolioExampleErrors.length === 0 ? 'pass' : 'fail',
      detail: `${facultyPortfolioExampleErrors.length} faculty portfolio example reference errors across ${facultyPortfolioExamples.length} examples.`,
    },
    {
      id: 'faculty_portfolio_examples_have_structured_metadata',
      status: structuredFacultyPortfolioExampleCount > 0 ? 'pass' : 'warn',
      detail: `${structuredFacultyPortfolioExampleCount} faculty portfolio examples include faculty plus title/medium/statement/visual metadata.`,
    },
    {
      id: 'course_site_pages_reference_valid_sources',
      status: courseSitePageErrors.length === 0 && effectiveCourseSitePages.length > 0 ? 'pass' : courseSitePageErrors.length === 0 ? 'warn' : 'fail',
      detail: `${effectiveCourseSitePages.length} course-site page role rows; ${courseSitePageErrors.length} reference errors.`,
    },
    {
      id: 'course_site_pages_classify_artifact_roles',
      status: courseSiteAssignmentPageCount > 0 && courseSiteSchedulePageCount > 0 && courseSiteSyllabusPageCount > 0 ? 'pass' : 'warn',
      detail: `${courseSiteSyllabusPageCount} syllabus pages, ${courseSiteAssignmentPageCount} assignment/project pages, ${courseSiteSchedulePageCount} schedule pages, and ${courseSitePagesWithClassroomArtifacts} pages with classroom artifacts.`,
    },
    {
      id: 'assignment_brief_pages_reference_valid_assignments',
      status: assignmentBriefPageErrors.length === 0 && effectiveAssignmentBriefPages.length > 0 ? 'pass' : assignmentBriefPageErrors.length === 0 ? 'warn' : 'fail',
      detail: `${effectiveAssignmentBriefPages.length} assignment brief page rows; ${assignmentBriefPageErrors.length} assignment/source reference errors.`,
    },
    {
      id: 'assignment_brief_pages_surface_studio_signals',
      status: assignmentBriefPagesWithCompleteSignals > 0 && assignmentBriefPagesWithCritique > 0 ? 'pass' : 'warn',
      detail: `${assignmentBriefPagesWithCompleteSignals} pages have complete brief signals, ${assignmentBriefPagesWithCritique} include critique signals, and ${assignmentBriefPagesWithRevision} include revision signals.`,
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
      id: 'archive_fetch_targets_reference_valid_sources',
      status: archiveFetchTargetErrors.length === 0 && effectiveArchiveFetchTargets.length > 0 ? 'pass' : archiveFetchTargetErrors.length === 0 ? 'warn' : 'fail',
      detail: `${effectiveArchiveFetchTargets.length} archive fetch targets, ${pendingArchiveFetchTargetCount} pending, ${archiveFetchTargetErrors.length} target reference errors.`,
    },
    {
      id: 'archive_fetch_targets_prioritize_term_starts',
      status: termAlignedArchiveFetchTargetCount > 0 && highPriorityArchiveFetchTargetCount > 0 ? 'pass' : effectiveArchiveFetchTargets.length > 0 ? 'warn' : 'fail',
      detail: `${highPriorityArchiveFetchTargetCount} high-priority archive targets; ${termAlignedArchiveFetchTargetCount} captures align with January/February/May/September term-start months.`,
    },
    {
      id: 'archive_promotions_reference_targets_and_sources',
      status: archivePromotionErrors.length === 0 ? 'pass' : 'fail',
      detail: `${effectiveArchivePromotions.length} archive promotion attempts, ${successfulArchivePromotionCount} successful, ${failedArchivePromotionCount} failed, ${archivePromotionErrors.length} reference errors.`,
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
      field_structured_assignments: fieldStructuredAssignmentCount,
      high_confidence_assignments: highConfidenceAssignmentCount,
      medium_confidence_assignments: mediumConfidenceAssignmentCount,
      low_confidence_assignments: lowConfidenceAssignmentCount,
      long_assignment_briefs: longAssignmentBriefCount,
      readings: readings.length,
      normalized_readings: normalizedReadingCount,
      local_catalog_readings: catalogReadingCount,
      external_catalog_readings: externalCatalogReadingCount,
      external_catalog_attempts: externalCatalogAttemptCount,
      unresolved_readings: unresolvedReadingCount,
      non_citation_reading_fragments: nonCitationReadingCount,
      canonical_reading_works: readingFrequency.length,
      schedule_rows: effectiveScheduleRows.length,
      dated_schedule_rows: datedScheduleRowCount,
      table_schedule_rows: tableScheduleRowCount,
      snippet_schedule_rows: snippetScheduleRowCount,
      schedule_rows_with_assignment_links: scheduleRowsWithAssignmentLinks,
      schedule_rows_with_reading_links: scheduleRowsWithReadingLinks,
      schedule_rows_with_critique_signals: scheduleRowsWithCritiqueSignals,
      search_candidates: searchCandidates.length,
      promoted_search_candidates: promotedSearchCandidateCount,
      imported_search_candidates: importedSearchCandidateCount,
      live_search_candidates: liveSearchCandidateCount,
      live_search_provider_unconfigured: liveSearchProviderUnconfiguredCount,
      coverage_search_backlog_candidates: coverageSearchBacklogCount,
      live_coverage_search_candidates: liveCoverageSearchCandidateCount,
      live_coverage_search_provider_unconfigured: liveCoverageProviderUnconfiguredCount,
      search_promotions: effectiveSearchPromotions.length,
      successful_search_promotions: successfulSearchPromotions,
      failed_search_promotions: failedSearchPromotions,
      rejected_search_promotions: rejectedSearchPromotions,
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
      faculty_search_queries: effectiveFacultySearchQueries.length,
      faculty_search_backlog_candidates: facultySearchBacklogCount,
      live_faculty_search_candidates: liveFacultySearchCandidateCount,
      student_work: studentWork.length,
      structured_student_work: structuredStudentWorkCount,
      course_linked_student_work: courseLinkedStudentWorkCount,
      student_work_assignment_links: effectiveStudentWorkAssignmentLinks.length,
      student_work_assignment_linked_assignments: studentWorkAssignmentLinkCount,
      student_work_brief_page_links: studentWorkBriefPageLinkCount,
      student_work_course_context_links: studentWorkCourseContextLinkCount,
      student_work_rejected_weak_matches: studentWorkRejectedWeakLinkCount,
      course_coverage_rows: courseCoverage.length,
      high_coverage_courses: highCoverageCourseCount,
      low_coverage_courses: lowCoverageCourseCount,
      coverage_search_queries: coverageSearchQueries.length,
      faculty_portfolio_examples: facultyPortfolioExamples.length,
      structured_faculty_portfolio_examples: structuredFacultyPortfolioExampleCount,
      course_site_pages: effectiveCourseSitePages.length,
      course_site_pages_with_classroom_artifacts: courseSitePagesWithClassroomArtifacts,
      course_site_assignment_pages: courseSiteAssignmentPageCount,
      course_site_schedule_pages: courseSiteSchedulePageCount,
      course_site_syllabus_pages: courseSiteSyllabusPageCount,
      course_site_pages_with_long_briefs: courseSitePagesWithLongBriefs,
      assignment_brief_pages: effectiveAssignmentBriefPages.length,
      assignment_brief_pages_with_complete_signals: assignmentBriefPagesWithCompleteSignals,
      assignment_brief_pages_with_critique: assignmentBriefPagesWithCritique,
      assignment_brief_pages_with_revision: assignmentBriefPagesWithRevision,
      source_clusters: sourceClusters.length,
      exact_source_clusters: exactSourceClusterCount,
      near_duplicate_source_clusters: nearDuplicateSourceClusterCount,
      related_source_clusters: relatedSourceClusterCount,
      course_packets_with_clustered_evidence: coursePacketsWithClusteredEvidence,
      source_versions: sourceVersions.length,
      fetched_archive_source_versions: fetchedArchiveVersionCount,
      metadata_only_source_versions: metadataOnlyVersionCount,
      archive_fetch_targets: effectiveArchiveFetchTargets.length,
      high_priority_archive_fetch_targets: highPriorityArchiveFetchTargetCount,
      pending_archive_fetch_targets: pendingArchiveFetchTargetCount,
      term_aligned_archive_fetch_targets: termAlignedArchiveFetchTargetCount,
      archive_promotions: effectiveArchivePromotions.length,
      successful_archive_promotions: successfulArchivePromotionCount,
      failed_archive_promotions: failedArchivePromotionCount,
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
  const nonCitationReadings = readings.filter((reading) => reading.linking_status === 'non_citation_fragment')
  if (readings.length && unresolvedReadings.length / readings.length > 0.5) {
    rows.push({
      review_id: 'review_reading_normalization_backlog',
      priority: 'medium',
      reason: 'reading_normalization_low_confidence',
      action: `Review ${unresolvedReadings.length} unresolved reading snippets, after excluding ${nonCitationReadings.length} non-citation fragments, and expand the local catalog or tighten extraction patterns.`,
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
  const nonCitationReadings = readings.filter((reading) => reading.linking_status === 'non_citation_fragment')

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
        evidence_summary: `${unresolvedReadings.length} of ${readings.length} reading snippets remain unresolved after local catalog matching; ${nonCitationReadings.length} parser fragments are classified as non-citations.`,
        next_parser_action: 'Expand the local reading catalog for remaining unresolved snippets and keep excluding descriptive fragments that are not actual citations.',
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
- Field-structured assignment snippets: ${validation.counts.field_structured_assignments}
- High-confidence assignments: ${validation.counts.high_confidence_assignments}
- Medium-confidence assignments: ${validation.counts.medium_confidence_assignments}
- Low-confidence assignment fragments: ${validation.counts.low_confidence_assignments}
- Long assignment brief blocks: ${validation.counts.long_assignment_briefs}
- Readings: ${validation.counts.readings}
- Normalized reading snippets: ${validation.counts.normalized_readings}
- Canonical reading works: ${validation.counts.canonical_reading_works}
- Local catalog reading matches: ${validation.counts.local_catalog_readings}
- External catalog reading matches: ${validation.counts.external_catalog_readings}
- External catalog lookup attempts: ${validation.counts.external_catalog_attempts}
- Unresolved reading snippets: ${validation.counts.unresolved_readings}
- Non-citation reading fragments: ${validation.counts.non_citation_reading_fragments}
- Schedule rows: ${validation.counts.schedule_rows}
- Dated schedule rows: ${validation.counts.dated_schedule_rows}
- Table/outline schedule rows: ${validation.counts.table_schedule_rows}
- Schedule evidence snippet rows: ${validation.counts.snippet_schedule_rows}
- Schedule rows with assignment links: ${validation.counts.schedule_rows_with_assignment_links}
- Schedule rows with reading links: ${validation.counts.schedule_rows_with_reading_links}
- Schedule rows with critique signals: ${validation.counts.schedule_rows_with_critique_signals}
- Search candidates: ${validation.counts.search_candidates}
- Promoted search candidates: ${validation.counts.promoted_search_candidates}
- Imported search candidates: ${validation.counts.imported_search_candidates}
- Live search API candidates: ${validation.counts.live_search_candidates}
- Live search provider-unconfigured rows: ${validation.counts.live_search_provider_unconfigured}
- Coverage search backlog candidates: ${validation.counts.coverage_search_backlog_candidates}
- Live coverage search candidates: ${validation.counts.live_coverage_search_candidates}
- Live coverage provider-unconfigured rows: ${validation.counts.live_coverage_search_provider_unconfigured}
- Search promotions: ${validation.counts.search_promotions}
- Successful search promotions: ${validation.counts.successful_search_promotions}
- Failed search promotions: ${validation.counts.failed_search_promotions}
- Rejected search promotions: ${validation.counts.rejected_search_promotions}
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
- Faculty-derived search queries: ${validation.counts.faculty_search_queries}
- Faculty search backlog candidates: ${validation.counts.faculty_search_backlog_candidates}
- Live faculty search candidates: ${validation.counts.live_faculty_search_candidates}
- Student work rows: ${validation.counts.student_work}
- Structured student work rows: ${validation.counts.structured_student_work}
- Course-linked student work rows: ${validation.counts.course_linked_student_work}
- Student-work relationship rows: ${validation.counts.student_work_assignment_links}
- Student-work assignment links: ${validation.counts.student_work_assignment_linked_assignments}
- Student-work brief-page links: ${validation.counts.student_work_brief_page_links}
- Student-work course-context links: ${validation.counts.student_work_course_context_links}
- Student-work rejected weak matches: ${validation.counts.student_work_rejected_weak_matches}
- Course coverage rows: ${validation.counts.course_coverage_rows}
- Courses at 80+ coverage: ${validation.counts.high_coverage_courses}
- Courses below 40 coverage: ${validation.counts.low_coverage_courses}
- Coverage-derived search queries: ${validation.counts.coverage_search_queries}
- Faculty portfolio examples: ${validation.counts.faculty_portfolio_examples}
- Structured faculty portfolio examples: ${validation.counts.structured_faculty_portfolio_examples}
- Course-site page role rows: ${validation.counts.course_site_pages}
- Course-site pages with classroom artifacts: ${validation.counts.course_site_pages_with_classroom_artifacts}
- Course-site syllabus pages: ${validation.counts.course_site_syllabus_pages}
- Course-site assignment/project pages: ${validation.counts.course_site_assignment_pages}
- Course-site schedule pages: ${validation.counts.course_site_schedule_pages}
- Course-site pages with long briefs: ${validation.counts.course_site_pages_with_long_briefs}
- Assignment brief page summaries: ${validation.counts.assignment_brief_pages}
- Assignment brief pages with complete signals: ${validation.counts.assignment_brief_pages_with_complete_signals}
- Assignment brief pages with critique signals: ${validation.counts.assignment_brief_pages_with_critique}
- Assignment brief pages with revision signals: ${validation.counts.assignment_brief_pages_with_revision}
- Source clusters: ${validation.counts.source_clusters}
- Exact duplicate clusters: ${validation.counts.exact_source_clusters}
- Near-duplicate source clusters: ${validation.counts.near_duplicate_source_clusters}
- Related source-family clusters: ${validation.counts.related_source_clusters}
- Course packets with clustered evidence: ${validation.counts.course_packets_with_clustered_evidence}
- Source versions: ${validation.counts.source_versions}
- Fetched archive source comparisons: ${validation.counts.fetched_archive_source_versions}
- Metadata-only source versions: ${validation.counts.metadata_only_source_versions}
- Archive fetch targets: ${validation.counts.archive_fetch_targets}
- High-priority archive fetch targets: ${validation.counts.high_priority_archive_fetch_targets}
- Pending archive fetch targets: ${validation.counts.pending_archive_fetch_targets}
- Term-aligned archive fetch targets: ${validation.counts.term_aligned_archive_fetch_targets}
- Archive promotion attempts: ${validation.counts.archive_promotions}
- Successful archive promotions: ${validation.counts.successful_archive_promotions}
- Failed archive promotions: ${validation.counts.failed_archive_promotions}
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

function reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, scheduleRows = [], studentWork, studentWorkAssignmentLinks = [], wayback, sourceClusters = [] }) {
  const lines = []
  const sourcesById = new Map(sources.map((source) => [source.source_id, source]))
  const studentWorkById = new Map(studentWork.map((work) => [work.student_work_id, work]))
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
    const courseScheduleRows = scheduleRows.filter((row) => courseSyllabi.some((s) => s.syllabus_id === row.syllabus_id))
    const courseStudentWork = studentWork.filter((work) => (work.course_code && course.course_code && work.course_code === course.course_code) || (work.course_title && course.course_title && work.course_title === course.course_title) || work.source_ids.some((id) => course.source_ids.includes(id)))
    const courseStudentWorkLinks = studentWorkAssignmentLinks.filter((link) =>
      link.relationship_type !== 'rejected_weak_match'
        && ((link.course_code && course.course_code && link.course_code === course.course_code)
          || (link.course_title && course.course_title && link.course_title === course.course_title)
          || link.source_ids?.some((id) => course.source_ids.includes(id)))
    )
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
    if (courseScheduleRows.length) {
      lines.push('- Normalized schedule rows:')
      courseScheduleRows.slice(0, 8).forEach((row) => {
        const linked = [
          row.due_assignment_ids?.length ? `assignments: ${row.due_assignment_ids.join(', ')}` : null,
          row.reading_ids?.length ? `readings: ${row.reading_ids.join(', ')}` : null,
          row.critique_signal ? 'critique/review signal' : null,
        ].filter(Boolean)
        lines.push(`  - ${row.date ?? row.week_number ?? row.schedule_source}: ${row.agenda_excerpt}${linked.length ? ` (${linked.join('; ')})` : ''}`)
      })
    }
    if (courseAssignments.length) {
      lines.push('- Assignment/critique evidence:')
      courseAssignments.slice(0, 10).forEach((assignment) => {
        const structured = [
          assignment.deliverables?.length ? `deliverables: ${assignment.deliverables.join(', ')}` : null,
          assignment.constraints?.length ? `constraints: ${assignment.constraints.join(', ')}` : null,
          assignment.process_steps?.length ? `process: ${assignment.process_steps.join(', ')}` : null,
          assignment.submission_requirements?.length ? `submission: ${assignment.submission_requirements.join(', ')}` : null,
          assignment.grading_criteria?.length ? `criteria: ${assignment.grading_criteria.join(', ')}` : null,
          assignment.assignment_type ? `type: ${assignment.assignment_type}` : null,
          assignment.studio_phases?.length ? `phases: ${assignment.studio_phases.join(', ')}` : null,
          assignment.output_format ? `output: ${assignment.output_format}` : null,
          assignment.critique_format ? `critique: ${assignment.critique_format}` : null,
          assignment.revision_expectation ? `revision: ${assignment.revision_expectation}` : null,
          assignment.tacit_goal ? `tacit goal: ${assignment.tacit_goal}` : null,
          assignment.boundary_status ? `boundary: ${assignment.boundary_status}` : null,
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
    if (courseStudentWorkLinks.length) {
      lines.push('- Linked public comparison evidence:')
      courseStudentWorkLinks.slice(0, 6).forEach((link) => {
        const work = studentWorkById.get(link.student_work_id)
        const label = work?.project_title ?? link.student_work_url
        const target = link.assignment_id ? `assignment ${link.assignment_id}` : link.brief_page_id ? `brief page ${link.brief_page_id}` : 'course context'
        lines.push(`  - ${label}: ${link.student_work_url} (${link.relationship_type}, ${link.link_confidence}; ${target}; ${link.evidence_basis})`)
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

function curriculumCoursePackets({ courses, syllabi, assignments, readings, studentWork, studentWorkAssignmentLinks = [], scheduleRows = [] }) {
  return courses.map((course) => {
    const courseSyllabi = syllabi.filter((s) => (s.course_code && course.course_code && s.course_code === course.course_code) || (s.course_title && course.course_title && s.course_title === course.course_title) || s.source_ids.some((id) => course.source_ids.includes(id)))
    const courseAssignments = assignments.filter((a) => courseSyllabi.some((s) => s.syllabus_id === a.syllabus_id))
    const courseReadings = readings.filter((r) => courseSyllabi.some((s) => s.syllabus_id === r.syllabus_id))
    const courseScheduleRows = scheduleRows.filter((row) => courseSyllabi.some((s) => s.syllabus_id === row.syllabus_id))
    const courseStudentWork = studentWork.filter((work) => (work.course_code && course.course_code && work.course_code === course.course_code) || (work.course_title && course.course_title && work.course_title === course.course_title) || work.source_ids.some((id) => course.source_ids.includes(id)))
    const courseStudentWorkLinks = studentWorkAssignmentLinks.filter((link) =>
      link.relationship_type !== 'rejected_weak_match'
        && ((link.course_code && course.course_code && link.course_code === course.course_code)
          || (link.course_title && course.course_title && link.course_title === course.course_title)
          || link.source_ids?.some((id) => course.source_ids.includes(id)))
    )
    const track = curriculumTrackForCourse(course, courseAssignments, courseReadings)
    return {
      course,
      track,
      courseSyllabi,
      courseAssignments,
      courseReadings,
      courseScheduleRows,
      courseStudentWork,
      courseStudentWorkLinks,
      score: courseEvidenceScore({ course, courseSyllabi, courseAssignments, courseReadings, courseStudentWork }),
    }
  }).sort((a, b) => b.score - a.score || String(a.course.course_title ?? '').localeCompare(String(b.course.course_title ?? '')))
}

function curriculumPacketKey(packet) {
  const course = packet.course
  return slug(course.course_title ?? course.course_code ?? course.course_id)
}

const coverageRequirements = [
  ['course_identity', 'Course code/title/level/credits/term/instructor basics'],
  ['source_evidence', 'Source type, evidence grade, and source IDs'],
  ['syllabus_fields', 'Full syllabus fields when available'],
  ['weekly_schedule', 'Weekly topic and assignment schedule'],
  ['readings', 'Required/recommended readings'],
  ['project_briefs', 'Project briefs and deliverables'],
  ['critique_revision', 'Critique and revision format'],
  ['grading_assessment', 'Grading rubric or assessment strategy'],
  ['tools_materials', 'Tools, software, and materials'],
  ['student_work', 'Linked public student work examples'],
  ['tacit_skills', 'Tacit skill extraction'],
]

function requirementStatus(present, partial = false) {
  if (present) return 'present'
  if (partial) return 'partial'
  return 'missing'
}

function buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork, scheduleRows = [] }) {
  return curriculumCoursePackets({ courses, syllabi, assignments, readings, studentWork }).map((packet) => {
    const { course, courseSyllabi, courseAssignments, courseReadings, courseStudentWork } = packet
    const courseScheduleRows = scheduleRows.filter((row) => courseSyllabi.some((syllabus) => syllabus.syllabus_id === row.syllabus_id))
    const sourceIds = uniq([
      ...(course.source_ids ?? []),
      ...courseSyllabi.flatMap((syllabus) => syllabus.source_ids ?? []),
      ...courseAssignments.flatMap((assignment) => assignment.source_ids ?? []),
      ...courseReadings.flatMap((reading) => reading.source_ids ?? []),
      ...courseStudentWork.flatMap((work) => work.source_ids ?? []),
    ])
    const tools = uniq([
      ...courseSyllabi.flatMap((syllabus) => [...(syllabus.tools ?? []), ...(syllabus.materials ?? [])]),
      ...courseAssignments.flatMap((assignment) => [...(assignment.tools ?? []), ...(assignment.materials ?? [])]),
    ])
    const tacitSkills = uniq([
      ...(course.skills ?? []),
      ...courseAssignments.flatMap((assignment) => [...(assignment.skills_trained ?? []), assignment.tacit_goal].filter(Boolean)),
    ])
    const highValueAssignments = courseAssignments.filter((assignment) => ['high', 'medium'].includes(assignment.assignment_confidence))
    const longBriefAssignments = courseAssignments.filter((assignment) => (assignment.prompt_excerpt?.split(/\s+/).length ?? 0) >= 45)
    const critiqueAssignments = courseAssignments.filter((assignment) => assignment.critique_format || assignment.revision_expectation || assignment.critique_questions?.length || /critique|crit|feedback|revise|revision/i.test(assignment.prompt_excerpt ?? ''))
    const gradingSyllabi = courseSyllabi.filter((syllabus) => syllabus.grading_rubric || syllabus.assessment_strategy)
    const requirements = {
      course_identity: requirementStatus(Boolean(course.course_code && course.course_title && (course.degree_level || course.credits || course.term || course.instructor)), Boolean(course.course_code || course.course_title)),
      source_evidence: requirementStatus(Boolean(sourceIds.length && course.evidence_grade)),
      syllabus_fields: requirementStatus(courseSyllabi.some((syllabus) => syllabus.raw_excerpts?.length || syllabus.description || syllabus.learning_outcomes?.length), courseSyllabi.length > 0),
      weekly_schedule: requirementStatus(courseScheduleRows.length > 0, courseSyllabi.some((syllabus) => syllabus.assignment_schedule?.length || syllabus.topic_outline?.length || syllabus.weekly_schedule_evidence?.length)),
      readings: requirementStatus(courseReadings.some((reading) => reading.linking_status !== 'non_citation_fragment'), courseReadings.length > 0),
      project_briefs: requirementStatus(highValueAssignments.length > 0 && longBriefAssignments.length > 0, highValueAssignments.length > 0 || courseAssignments.length > 0),
      critique_revision: requirementStatus(critiqueAssignments.length > 0),
      grading_assessment: requirementStatus(gradingSyllabi.length > 0),
      tools_materials: requirementStatus(tools.length > 0),
      student_work: requirementStatus(courseStudentWork.length > 0),
      tacit_skills: requirementStatus(tacitSkills.length > 0),
    }
    const presentCount = Object.values(requirements).filter((status) => status === 'present').length
    const partialCount = Object.values(requirements).filter((status) => status === 'partial').length
    const missing = coverageRequirements.filter(([key]) => requirements[key] === 'missing').map(([, label]) => label)
    const coverageScore = Math.round(((presentCount + partialCount * 0.5) / coverageRequirements.length) * 100)
    return {
      coverage_id: `coverage_${slug(course.course_id ?? course.course_code ?? course.course_title ?? sourceIds.join('_'))}`,
      course_id: course.course_id ?? null,
      course_code: course.course_code ?? null,
      course_title: course.course_title ?? null,
      degree_level: course.degree_level ?? null,
      evidence_grade: course.evidence_grade ?? null,
      source_ids: sourceIds,
      syllabus_count: courseSyllabi.length,
      assignment_count: courseAssignments.length,
      high_or_medium_assignment_count: highValueAssignments.length,
      long_brief_assignment_count: longBriefAssignments.length,
      reading_count: courseReadings.length,
      student_work_count: courseStudentWork.length,
      coverage_score: coverageScore,
      requirements,
      missing_requirements: missing,
      unknowns: missing.map((label) => `${label} not yet recovered from public evidence.`),
    }
  })
}

function courseCoverageMarkdown(rows) {
  const sorted = [...rows].sort((a, b) => a.coverage_score - b.coverage_score || String(a.course_title ?? '').localeCompare(String(b.course_title ?? '')))
  const complete = rows.filter((row) => row.coverage_score >= 80).length
  const thin = rows.filter((row) => row.coverage_score < 40).length
  const lines = [
    '# RISD Graphic Design Course Coverage',
    '',
    `Generated: ${retrievedAt}`,
    '',
    '## Summary',
    '',
    `- Courses assessed: ${rows.length}`,
    `- Courses at 80+ coverage: ${complete}`,
    `- Courses below 40 coverage: ${thin}`,
    '',
    '## Lowest Coverage Courses',
    '',
  ]
  for (const row of sorted.slice(0, 25)) {
    lines.push(`- ${row.coverage_score}% ${row.course_title ?? row.course_code ?? row.course_id}: ${row.missing_requirements.slice(0, 5).join('; ') || 'No major missing requirements.'}`)
  }
  lines.push('')
  lines.push('## Requirement Legend')
  lines.push('')
  for (const [key, label] of coverageRequirements) {
    lines.push(`- ${key}: ${label}`)
  }
  lines.push('')
  return lines.join('\n')
}

function buildCoverageSearchQueries(courseCoverage, limit = 160) {
  const rows = []
  const queryForMissing = {
    'Full syllabus fields when available': ['syllabus', 'course site'],
    'Weekly topic and assignment schedule': ['schedule', 'week', 'calendar'],
    'Required/recommended readings': ['readings', 'bibliography'],
    'Project briefs and deliverables': ['assignment', 'project brief', 'deliverables'],
    'Critique and revision format': ['critique', 'review', 'feedback'],
    'Grading rubric or assessment strategy': ['rubric', 'grading', 'assessment'],
    'Tools, software, and materials': ['materials', 'tools', 'software'],
    'Linked public student work examples': ['student work', 'portfolio', 'archive'],
  }
  for (const row of [...courseCoverage].sort((a, b) => a.coverage_score - b.coverage_score || String(a.course_title ?? '').localeCompare(String(b.course_title ?? '')))) {
    const courseName = row.course_title ?? row.course_code
    if (!courseName) continue
    const courseCode = row.course_code ?? null
    for (const missing of row.missing_requirements ?? []) {
      const terms = queryForMissing[missing]
      if (!terms) continue
      for (const term of terms.slice(0, 2)) {
        const quotedCourse = `"${courseName.replace(/"/g, '')}"`
        const courseClause = courseCode ? `(${quotedCourse} OR "${courseCode}")` : quotedCourse
        const query = `"RISD" "Graphic Design" ${courseClause} "${term}"`
        rows.push({
          query_id: `coverage_query_${slug(`${row.coverage_id}_${missing}_${term}`)}`,
          query,
          course_code: courseCode,
          course_title: row.course_title ?? null,
          missing_requirement: missing,
          coverage_score: row.coverage_score,
          priority: row.coverage_score < 40 ? 'high' : row.coverage_score < 70 ? 'medium' : 'low',
          status: 'pending_search_export_or_api',
          generated_at: retrievedAt,
          source_coverage_id: row.coverage_id,
        })
        if (rows.length >= limit) return dedupeCoverageSearchQueries(rows)
      }
    }
  }
  return dedupeCoverageSearchQueries(rows)
}

function dedupeCoverageSearchQueries(rows) {
  const seen = new Set()
  return rows.filter((row) => {
    const key = row.query.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, scheduleRows = [], studentWork, studentWorkAssignmentLinks = [] }) {
  const packets = curriculumCoursePackets({ courses, syllabi, assignments, readings, studentWork, studentWorkAssignmentLinks, scheduleRows })
  const studentWorkById = new Map(studentWork.map((work) => [work.student_work_id, work]))
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
      const { course, courseSyllabi, courseAssignments, courseReadings, courseScheduleRows, courseStudentWork, courseStudentWorkLinks } = packet
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
      if (courseScheduleRows.length) {
        lines.push('- Schedule rhythm:')
        courseScheduleRows.slice(0, 5).forEach((row) => lines.push(`  - ${row.date ?? row.session_title ?? row.schedule_source}: ${row.agenda_excerpt}`))
      }
      if (courseAssignments.length) {
        lines.push('- Studio briefs to recreate:')
        courseAssignments.slice(0, 6).forEach((assignment) => {
          const assignmentTitle = assignment.title && assignment.title !== 'null' ? assignment.title : 'Recovered brief'
          const details = [
            assignment.deliverables?.length ? `deliverables: ${assignment.deliverables.join(', ')}` : null,
            assignment.constraints?.length ? `constraints: ${assignment.constraints.join(', ')}` : null,
            assignment.process_steps?.length ? `process: ${assignment.process_steps.join(', ')}` : null,
            assignment.submission_requirements?.length ? `submission: ${assignment.submission_requirements.join(', ')}` : null,
            assignment.grading_criteria?.length ? `criteria: ${assignment.grading_criteria.join(', ')}` : null,
            assignment.assignment_type ? `type: ${assignment.assignment_type}` : null,
            assignment.studio_phases?.length ? `phases: ${assignment.studio_phases.join(', ')}` : null,
            assignment.output_format ? `output: ${assignment.output_format}` : null,
            assignment.critique_format ? `critique: ${assignment.critique_format}` : null,
            assignment.revision_expectation ? `revision: ${assignment.revision_expectation}` : null,
            assignment.boundary_status ? `boundary: ${assignment.boundary_status}` : null,
          ].filter(Boolean)
          lines.push(`  - ${assignmentTitle}: ${assignment.prompt_excerpt}${details.length ? ` (${details.join('; ')})` : ''}`)
        })
      }
      if (courseStudentWorkLinks.length) {
        lines.push('- Public comparison set:')
        courseStudentWorkLinks.slice(0, 4).forEach((link) => {
          const work = studentWorkById.get(link.student_work_id)
          const label = work?.project_title ?? link.student_work_url
          const target = link.assignment_title ? `assignment: ${link.assignment_title}` : link.brief_page_id ? `brief page: ${link.brief_page_id}` : 'course context'
          lines.push(`  - ${label}: ${link.student_work_url} (${link.relationship_type}; ${target}; use: ${(link.comparison_use ?? []).join(', ') || 'visual_calibration'})`)
        })
      } else if (courseStudentWork.length) {
        lines.push('- Public comparison set:')
        courseStudentWork
          .filter((work) => work.course_code || work.course_title)
          .slice(0, 4)
          .forEach((work) => lines.push(`  - ${work.project_title ?? work.url}: ${work.url} (course-context evidence only)`))
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
  const scheduleRows = loadJsonl(join(outDir, 'schedule_rows.jsonl'))
  const studentWork = loadJsonl(join(outDir, 'student_work.jsonl'))
  const studentWorkAssignmentLinks = loadJsonl(join(outDir, 'student_work_assignment_links.jsonl'))
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks }))
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
  const readings = mergeReadingExternalLinks(buildReadings(syllabi), loadJsonl(join(outDir, 'readings.jsonl')))
  const readingFrequency = buildReadingFrequency(readings)
  let searchCandidates = loadJsonl(join(outDir, 'search_candidates.jsonl'))
  const commonCrawlCandidates = loadJsonl(join(outDir, 'common_crawl_candidates.jsonl'))
  const commonCrawlPromotions = loadJsonl(join(outDir, 'common_crawl_promotions.jsonl'))
  const facultyProfileCandidates = loadJsonl(join(outDir, 'faculty_profile_candidates.jsonl'))
  const faculty = loadJsonl(join(outDir, 'faculty.jsonl'))
  const facultyCourseEdges = loadJsonl(join(outDir, 'faculty_course_edges.jsonl'))
  const studentWork = loadJsonl(join(outDir, 'student_work.jsonl'))
  const facultyPortfolioExamples = loadJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'))
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
  const courseSitePages = buildCourseSitePages({ sources, syllabi, assignments, readings })
  const scheduleRows = buildScheduleRows({ syllabi, assignments, readings, courseSitePages })
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork, scheduleRows })
  const coverageSearchQueries = buildCoverageSearchQueries(courseCoverage)
  const facultySearchQueries = buildFacultySearchQueries(faculty, facultyCourseEdges)
  const assignmentBriefPages = buildAssignmentBriefPages({ courseSitePages, assignments })
  const studentWorkAssignmentLinks = buildStudentWorkAssignmentLinks({ studentWork, assignmentBriefPages, assignments, courseSitePages })
  const archiveFetchTargets = buildArchiveFetchTargets({ sources, wayback, sourceVersions })
  const retainedSearchCandidates = searchCandidates.filter((candidate) => !['coverage_query_backlog', 'faculty_query_backlog'].includes(candidate.source))
  const refreshedBacklogCandidates = buildSearchCandidates([], [], [], coverageSearchQueries, facultySearchQueries)
    .filter((candidate) => ['coverage_query_backlog', 'faculty_query_backlog'].includes(candidate.source))
  searchCandidates = mergeRowsByKey(retainedSearchCandidates, refreshedBacklogCandidates, (candidate) => candidate.candidate_id)
    .sort((a, b) => String(a.query ?? '').localeCompare(String(b.query ?? '')) || String(a.source ?? '').localeCompare(String(b.source ?? '')))
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, scheduleRows, searchCandidates, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, studentWorkAssignmentLinks, facultyPortfolioExamples, courseSitePages, assignmentBriefPages, archiveFetchTargets, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries, facultySearchQueries })
  writeJsonl(join(outDir, 'assignments.jsonl'), assignments)
  writeJsonl(join(outDir, 'readings.jsonl'), readings)
  writeJsonl(join(outDir, 'reading_frequency.jsonl'), readingFrequency)
  writeJsonl(join(outDir, 'review_queue.jsonl'), reviewQueue)
  writeJsonl(join(outDir, 'review_decisions.jsonl'), reviewDecisions)
  writeJsonl(join(outDir, 'field_conflicts.jsonl'), fieldConflicts)
  writeJsonl(join(outDir, 'course_coverage.jsonl'), courseCoverage)
  writeJsonl(join(outDir, 'coverage_search_queries.jsonl'), coverageSearchQueries)
  writeJsonl(join(outDir, 'faculty_search_queries.jsonl'), facultySearchQueries)
  writeJsonl(join(outDir, 'course_site_pages.jsonl'), courseSitePages)
  writeJsonl(join(outDir, 'schedule_rows.jsonl'), scheduleRows)
  writeJsonl(join(outDir, 'assignment_brief_pages.jsonl'), assignmentBriefPages)
  writeJsonl(join(outDir, 'student_work_assignment_links.jsonl'), studentWorkAssignmentLinks)
  writeJsonl(join(outDir, 'archive_fetch_targets.jsonl'), archiveFetchTargets)
  writeJsonl(join(outDir, 'search_candidates.jsonl'), searchCandidates)
  writeFileSync(join(outDir, 'course_coverage.md'), courseCoverageMarkdown(courseCoverage))
  writeFileSync(join(outDir, 'review_queue.md'), reviewQueueMarkdown(reviewQueue))
  writeFileSync(join(outDir, 'needs_followup.md'), needsFollowupMarkdown({ reviewQueue, reviewDecisions, fieldConflicts }))
  writeJson(join(outDir, 'validation.json'), validationWithReview)
  writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validationWithReview))
  writeFileSync(join(outDir, 'course_reconstruction.md'), reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks, wayback, sourceClusters }))
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork }))
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks }))
  console.log(`RISD derived artifacts written to ${outDir}`)
  console.log(`assignments=${assignments.length} phase_structured_assignments=${validationWithReview.counts.phase_structured_assignments} validation=${validationWithReview.status}`)
}

async function renderReadingLinksOnly() {
  ensureDir(outDir)
  const sources = loadJsonl(join(outDir, 'sources.jsonl'))
  const courseInventoryRows = loadJsonl(join(outDir, 'course_inventory.jsonl'))
  const courses = loadJsonl(join(outDir, 'courses.jsonl'))
  const syllabi = loadJsonl(join(outDir, 'syllabi.jsonl'))
  const assignments = loadJsonl(join(outDir, 'assignments.jsonl'))
  const existingReadings = loadJsonl(join(outDir, 'readings.jsonl'))
  const searchCandidates = loadJsonl(join(outDir, 'search_candidates.jsonl'))
  const commonCrawlCandidates = loadJsonl(join(outDir, 'common_crawl_candidates.jsonl'))
  const commonCrawlPromotions = loadJsonl(join(outDir, 'common_crawl_promotions.jsonl'))
  const facultyProfileCandidates = loadJsonl(join(outDir, 'faculty_profile_candidates.jsonl'))
  const faculty = loadJsonl(join(outDir, 'faculty.jsonl'))
  const facultyCourseEdges = loadJsonl(join(outDir, 'faculty_course_edges.jsonl'))
  const studentWork = loadJsonl(join(outDir, 'student_work.jsonl'))
  const facultyPortfolioExamples = loadJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'))
  const sourceClusters = loadJsonl(join(outDir, 'source_clusters.jsonl'))
  const sourceVersions = loadJsonl(join(outDir, 'source_versions.jsonl'))
  const wayback = loadJsonl(join(outDir, 'wayback_captures.jsonl'))
  const previousValidation = existsSync(join(outDir, 'validation.json')) ? JSON.parse(readFileSync(join(outDir, 'validation.json'), 'utf8')) : null
  const courseInventory = {
    offerings: courseInventoryRows,
    displayed_count: previousValidation?.counts?.official_course_displayed_count ?? courseInventoryRows.length,
  }
  const { readings, attempted, matched } = await enrichReadingLinks(existingReadings)
  const readingFrequency = buildReadingFrequency(readings)
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings })
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters })
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork })
  const coverageSearchQueries = buildCoverageSearchQueries(courseCoverage)
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, searchCandidates, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, facultyPortfolioExamples, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries })
  writeJsonl(join(outDir, 'readings.jsonl'), readings)
  writeJsonl(join(outDir, 'reading_frequency.jsonl'), readingFrequency)
  writeJsonl(join(outDir, 'review_queue.jsonl'), reviewQueue)
  writeJsonl(join(outDir, 'review_decisions.jsonl'), reviewDecisions)
  writeJsonl(join(outDir, 'field_conflicts.jsonl'), fieldConflicts)
  writeJsonl(join(outDir, 'course_coverage.jsonl'), courseCoverage)
  writeJsonl(join(outDir, 'coverage_search_queries.jsonl'), coverageSearchQueries)
  writeFileSync(join(outDir, 'course_coverage.md'), courseCoverageMarkdown(courseCoverage))
  writeFileSync(join(outDir, 'review_queue.md'), reviewQueueMarkdown(reviewQueue))
  writeFileSync(join(outDir, 'needs_followup.md'), needsFollowupMarkdown({ reviewQueue, reviewDecisions, fieldConflicts }))
  writeJson(join(outDir, 'validation.json'), validationWithReview)
  writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validationWithReview))
  writeFileSync(join(outDir, 'course_reconstruction.md'), reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, studentWork, studentWorkAssignmentLinks, wayback, sourceClusters }))
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork }))
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, studentWork, studentWorkAssignmentLinks }))
  console.log(`RISD reading links written to ${outDir}`)
  console.log(`attempted=${attempted} matched=${matched} external_catalog_readings=${validationWithReview.counts.external_catalog_readings} unresolved=${validationWithReview.counts.unresolved_readings} validation=${validationWithReview.status}`)
}

async function reparseExistingSourcesOnlyMode() {
  ensureDir(outDir)
  const existingSources = loadJsonl(join(outDir, 'sources.jsonl'))
  const existingReadings = loadJsonl(join(outDir, 'readings.jsonl'))
  const inspected = []
  for (const [index, source] of existingSources.entries()) {
    console.log(`reparse source ${index + 1}/${existingSources.length}: ${source.source_id}`)
    inspected.push(await inspectSeed(source))
  }
  const sources = inspected.map(({ source }) => source)
  const courseInventory = buildCourseInventory(inspected)
  const courses = buildCourses(inspected)
  const syllabi = buildSyllabi(inspected)
  const assignments = buildAssignments(syllabi)
  const readings = mergeReadingExternalLinks(buildReadings(syllabi), existingReadings)
  const readingFrequency = buildReadingFrequency(readings)
  const { faculty, facultyCourseEdges } = buildFacultyGraph({ sources, courseInventory, syllabi })
  const studentWork = buildStudentWork(inspected)
  const facultyPortfolioExamples = loadJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'))
  const sourceClusters = buildSourceClusters(inspected, syllabi, readings)
  const wayback = loadJsonl(join(outDir, 'wayback_captures.jsonl'))
  const sourceVersions = buildSourceVersions(inspected, wayback)
  const searchCandidates = loadJsonl(join(outDir, 'search_candidates.jsonl'))
  const commonCrawlCandidates = loadJsonl(join(outDir, 'common_crawl_candidates.jsonl'))
  const commonCrawlPromotions = loadJsonl(join(outDir, 'common_crawl_promotions.jsonl'))
  const facultyProfileCandidates = loadJsonl(join(outDir, 'faculty_profile_candidates.jsonl'))
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings })
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters })
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork })
  const coverageSearchQueries = buildCoverageSearchQueries(courseCoverage)
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, searchCandidates, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, facultyPortfolioExamples, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries })
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
  writeJsonl(join(outDir, 'review_queue.jsonl'), reviewQueue)
  writeJsonl(join(outDir, 'review_decisions.jsonl'), reviewDecisions)
  writeJsonl(join(outDir, 'field_conflicts.jsonl'), fieldConflicts)
  writeJsonl(join(outDir, 'course_coverage.jsonl'), courseCoverage)
  writeJsonl(join(outDir, 'coverage_search_queries.jsonl'), coverageSearchQueries)
  writeFileSync(join(outDir, 'course_coverage.md'), courseCoverageMarkdown(courseCoverage))
  writeFileSync(join(outDir, 'review_queue.md'), reviewQueueMarkdown(reviewQueue))
  writeFileSync(join(outDir, 'needs_followup.md'), needsFollowupMarkdown({ reviewQueue, reviewDecisions, fieldConflicts }))
  writeJson(join(outDir, 'validation.json'), validationWithReview)
  writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validationWithReview))
  writeFileSync(join(outDir, 'course_reconstruction.md'), reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, studentWork, studentWorkAssignmentLinks, wayback, sourceClusters }))
  writeFileSync(join(outDir, 'source_audit.md'), auditMarkdown({ sources, searchQueries, wayback, validation: validationWithReview }))
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork }))
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, studentWork, studentWorkAssignmentLinks }))
  console.log(`RISD existing sources reparsed into ${outDir}`)
  console.log(`sources=${sources.length} syllabi=${syllabi.length} assignments=${assignments.length} long_assignment_briefs=${validationWithReview.counts.long_assignment_briefs} external_catalog_readings=${validationWithReview.counts.external_catalog_readings} validation=${validationWithReview.status}`)
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

async function renderSearchApiOnly() {
  ensureDir(outDir)
  const sources = loadJsonl(join(outDir, 'sources.jsonl'))
  const courseInventoryRows = loadJsonl(join(outDir, 'course_inventory.jsonl'))
  const courses = loadJsonl(join(outDir, 'courses.jsonl'))
  const syllabi = loadJsonl(join(outDir, 'syllabi.jsonl'))
  const assignments = loadJsonl(join(outDir, 'assignments.jsonl'))
  const readings = loadJsonl(join(outDir, 'readings.jsonl'))
  const readingFrequency = loadJsonl(join(outDir, 'reading_frequency.jsonl'))
  const commonCrawlCandidates = loadJsonl(join(outDir, 'common_crawl_candidates.jsonl'))
  const commonCrawlPromotions = loadJsonl(join(outDir, 'common_crawl_promotions.jsonl'))
  const facultyProfileCandidates = loadJsonl(join(outDir, 'faculty_profile_candidates.jsonl'))
  const faculty = loadJsonl(join(outDir, 'faculty.jsonl'))
  const facultyCourseEdges = loadJsonl(join(outDir, 'faculty_course_edges.jsonl'))
  const studentWork = loadJsonl(join(outDir, 'student_work.jsonl'))
  const facultyPortfolioExamples = loadJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'))
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
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork })
  const coverageSearchQueries = buildCoverageSearchQueries(courseCoverage)
  const facultySearchQueries = buildFacultySearchQueries(faculty, facultyCourseEdges)
  const liveSearchCandidates = await buildLiveSearchCandidates(coverageSearchQueries, facultySearchQueries)
  const existingSearchCandidates = loadJsonl(join(outDir, 'search_candidates.jsonl'))
  const retainedCandidates = existingSearchCandidates.filter((candidate) => candidate.source !== 'live_search_api' && candidate.source !== 'coverage_query_backlog' && candidate.source !== 'faculty_query_backlog')
  const generatedBacklogCandidates = buildSearchCandidates([], [], [], coverageSearchQueries, facultySearchQueries)
    .filter((candidate) => ['coverage_query_backlog', 'faculty_query_backlog'].includes(candidate.source))
  const searchCandidates = mergeRowsByKey([...retainedCandidates, ...generatedBacklogCandidates], liveSearchCandidates, (candidate) => candidate.candidate_id)
    .sort((a, b) => String(a.query ?? '').localeCompare(String(b.query ?? '')) || Number(a.rank ?? 9999) - Number(b.rank ?? 9999) || String(a.url ?? '').localeCompare(String(b.url ?? '')))
  const searchResults = [
    ...buildSearchResults(),
    ...liveSearchCandidates.map((candidate) => ({
      query: candidate.query,
      query_id: candidate.query_id ?? null,
      query_source: candidate.query_source ?? null,
      course_code: candidate.course_code ?? null,
      course_title: candidate.course_title ?? null,
      missing_requirement: candidate.missing_requirement ?? null,
      coverage_score: candidate.coverage_score ?? null,
      priority: candidate.priority ?? null,
      source_coverage_id: candidate.source_coverage_id ?? null,
      faculty_id: candidate.faculty_id ?? null,
      faculty_name: candidate.faculty_name ?? null,
      term: candidate.term ?? null,
      query_intent: candidate.query_intent ?? null,
      source_edge_id: candidate.source_edge_id ?? null,
      rank: candidate.rank,
      title: candidate.title,
      snippet: candidate.snippet,
      url: candidate.url,
      promoted_source_id: candidate.promoted_source_id ?? null,
      discovered_at: candidate.discovered_at,
      status: candidate.status,
      source: candidate.source,
      provider: candidate.provider ?? null,
      error: candidate.error ?? null,
    })),
  ]
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, searchCandidates, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, facultyPortfolioExamples, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries, facultySearchQueries })

  writeJsonl(join(outDir, 'search_candidates.jsonl'), searchCandidates)
  writeJsonl(join(outDir, 'search_results.jsonl'), searchResults)
  writeJsonl(join(outDir, 'review_queue.jsonl'), reviewQueue)
  writeJsonl(join(outDir, 'review_decisions.jsonl'), reviewDecisions)
  writeJsonl(join(outDir, 'field_conflicts.jsonl'), fieldConflicts)
  writeJsonl(join(outDir, 'course_coverage.jsonl'), courseCoverage)
  writeJsonl(join(outDir, 'coverage_search_queries.jsonl'), coverageSearchQueries)
  writeJsonl(join(outDir, 'faculty_search_queries.jsonl'), facultySearchQueries)
  writeFileSync(join(outDir, 'course_coverage.md'), courseCoverageMarkdown(courseCoverage))
  writeFileSync(join(outDir, 'review_queue.md'), reviewQueueMarkdown(reviewQueue))
  writeFileSync(join(outDir, 'needs_followup.md'), needsFollowupMarkdown({ reviewQueue, reviewDecisions, fieldConflicts }))
  writeJson(join(outDir, 'validation.json'), validationWithReview)
  writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validationWithReview))
  console.log(`RISD live search candidates written to ${join(outDir, 'search_candidates.jsonl')}`)
  console.log(`live_search_candidates=${liveSearchCandidates.length} total_search_candidates=${searchCandidates.length} validation=${validationWithReview.status}`)
}

async function promoteSearchCandidatesOnlyMode() {
  ensureDir(outDir)
  const existingSources = loadJsonl(join(outDir, 'sources.jsonl'))
  const existingSourceUrls = new Set(existingSources.map((source) => canonicalUrl(source.url)))
  const existingSearchCandidates = loadJsonl(join(outDir, 'search_candidates.jsonl'))
  const existingSearchPromotions = loadJsonl(join(outDir, 'search_promotions.jsonl'))
  const promotedCandidateIds = new Set(existingSearchPromotions.map((promotion) => promotion.candidate_id))
  const urlBearingCandidates = existingSearchCandidates.filter((candidate) => candidate.url && !promotedCandidateIds.has(candidate.candidate_id))
  const reviewedCandidates = urlBearingCandidates.map((candidate) => {
    const promotionScore = scoreSearchCandidateForPromotion(candidate)
    const decision = evaluateSearchCandidatePromotion(candidate, existingSourceUrls, promotedCandidateIds)
    const rejectionReason = decision.eligible && promotionScore < 4 ? 'promotion_score_below_threshold' : decision.rejection_reason
    return {
      ...candidate,
      promotion_score: promotionScore,
      promotion_eligible: decision.eligible && promotionScore >= 4,
      promotion_rejection_reason: rejectionReason,
    }
  })
  const rejectedPromotions = reviewedCandidates
    .filter((candidate) => !candidate.promotion_eligible)
    .map((candidate) => rejectedSearchPromotionRow(candidate, candidate.promotion_score, candidate.promotion_rejection_reason))
  const selectedCandidates = reviewedCandidates
    .filter((candidate) => candidate.promotion_eligible)
    .sort((a, b) => b.promotion_score - a.promotion_score || Number(a.rank ?? 9999) - Number(b.rank ?? 9999) || String(a.url).localeCompare(String(b.url)))
    .slice(0, searchPromoteLimit)

  const inspectedPromotions = []
  for (const [index, candidate] of selectedCandidates.entries()) {
    console.error(`promote search candidate ${index + 1}/${selectedCandidates.length}: ${candidate.url}`)
    const seed = sourceSeedFromSearchCandidate(candidate)
    const inspected = await inspectSeed(seed)
    inspectedPromotions.push({ candidate, inspected })
  }

  const newPromotions = inspectedPromotions.map(({ candidate, inspected }) => ({
    promotion_id: `search_promotion_${candidate.candidate_id}`,
    candidate_id: candidate.candidate_id,
    promoted_at: retrievedAt,
    promoted_source_id: inspected.source.source_id,
    url: inspected.source.url,
    query: candidate.query ?? null,
    query_id: candidate.query_id ?? null,
    query_source: candidate.query_source ?? null,
    course_code: candidate.course_code ?? null,
    course_title: candidate.course_title ?? null,
    missing_requirement: candidate.missing_requirement ?? null,
    promotion_score: candidate.promotion_score,
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
  }))
  const allSearchPromotions = mergeRowsByKey(existingSearchPromotions, [...rejectedPromotions, ...newPromotions], (promotion) => promotion.promotion_id)
  const promotionByCandidateId = new Map(allSearchPromotions.map((promotion) => [promotion.candidate_id, promotion]))
  const updatedSearchCandidates = existingSearchCandidates.map((candidate) => {
    const promotion = promotionByCandidateId.get(candidate.candidate_id)
    if (!promotion) return candidate
    return {
      ...candidate,
      status: promotion.extraction_status === 'ok'
        ? 'promoted_after_public_fetch'
        : promotion.extraction_status === 'rejected_before_fetch'
          ? 'promotion_rejected'
          : 'promotion_fetch_failed',
      promoted_source_id: promotion.extraction_status === 'ok' ? promotion.promoted_source_id : null,
      promotion_fetch_status: promotion.fetch_status,
      promotion_extraction_status: promotion.extraction_status,
      promotion_error: promotion.error ?? null,
    }
  })

  if (inspectedPromotions.length === 0) {
    const sources = existingSources
    const courseInventoryRows = loadJsonl(join(outDir, 'course_inventory.jsonl'))
    const previousValidation = existsSync(join(outDir, 'validation.json')) ? JSON.parse(readFileSync(join(outDir, 'validation.json'), 'utf8')) : null
    const courseInventory = {
      offerings: courseInventoryRows,
      displayed_count: previousValidation?.counts?.official_course_displayed_count ?? courseInventoryRows.length,
    }
    const courses = loadJsonl(join(outDir, 'courses.jsonl'))
    const syllabi = loadJsonl(join(outDir, 'syllabi.jsonl'))
    const assignments = loadJsonl(join(outDir, 'assignments.jsonl'))
    const readings = loadJsonl(join(outDir, 'readings.jsonl'))
    const readingFrequency = loadJsonl(join(outDir, 'reading_frequency.jsonl'))
    const faculty = loadJsonl(join(outDir, 'faculty.jsonl'))
    const facultyCourseEdges = loadJsonl(join(outDir, 'faculty_course_edges.jsonl'))
    const studentWork = loadJsonl(join(outDir, 'student_work.jsonl'))
    const facultyPortfolioExamples = loadJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'))
    const sourceClusters = loadJsonl(join(outDir, 'source_clusters.jsonl'))
    const sourceVersions = loadJsonl(join(outDir, 'source_versions.jsonl'))
    const wayback = loadJsonl(join(outDir, 'wayback_captures.jsonl'))
    const commonCrawlCandidates = loadJsonl(join(outDir, 'common_crawl_candidates.jsonl'))
    const commonCrawlPromotions = loadJsonl(join(outDir, 'common_crawl_promotions.jsonl'))
    const facultyProfileCandidates = loadJsonl(join(outDir, 'faculty_profile_candidates.jsonl'))
    const reviewQueue = loadJsonl(join(outDir, 'review_queue.jsonl'))
    const reviewDecisions = loadJsonl(join(outDir, 'review_decisions.jsonl'))
    const fieldConflicts = loadJsonl(join(outDir, 'field_conflicts.jsonl'))
    const courseCoverage = loadJsonl(join(outDir, 'course_coverage.jsonl'))
    const coverageSearchQueries = loadJsonl(join(outDir, 'coverage_search_queries.jsonl'))
    const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, searchCandidates: updatedSearchCandidates, searchPromotions: allSearchPromotions, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, facultyPortfolioExamples, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries })
    writeJsonl(join(outDir, 'search_candidates.jsonl'), updatedSearchCandidates)
    writeJsonl(join(outDir, 'search_promotions.jsonl'), allSearchPromotions)
    writeJson(join(outDir, 'validation.json'), validationWithReview)
    writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validationWithReview))
    console.log(`RISD search promotions written to ${join(outDir, 'search_promotions.jsonl')}`)
    console.log(`new_promotions=0 successful_promotions=0 total_search_promotions=${allSearchPromotions.length} validation=${validationWithReview.status}`)
    return
  }

  const successfulPromotionSources = inspectedPromotions
    .filter(({ inspected }) => inspected.source.extraction_status === 'ok')
    .map(({ inspected }) => inspected.source)
  const sourcesForReparse = mergeRowsByKey(existingSources, successfulPromotionSources, (source) => source.source_id)
  const existingReadings = loadJsonl(join(outDir, 'readings.jsonl'))
  const inspected = []
  for (const [index, source] of sourcesForReparse.entries()) {
    console.error(`reparse promoted-search corpus source ${index + 1}/${sourcesForReparse.length}: ${source.source_id}`)
    inspected.push(await inspectSeed(source))
  }

  const sources = inspected.map(({ source }) => source)
  const courseInventory = buildCourseInventory(inspected)
  const courses = buildCourses(inspected)
  const syllabi = buildSyllabi(inspected)
  const assignments = buildAssignments(syllabi)
  const readings = mergeReadingExternalLinks(buildReadings(syllabi), existingReadings)
  const readingFrequency = buildReadingFrequency(readings)
  const { faculty, facultyCourseEdges } = buildFacultyGraph({ sources, courseInventory, syllabi })
  const studentWork = buildStudentWork(inspected)
  const facultyPortfolioExamples = loadJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'))
  const sourceClusters = buildSourceClusters(inspected, syllabi, readings)
  const wayback = loadJsonl(join(outDir, 'wayback_captures.jsonl'))
  const sourceVersions = buildSourceVersions(inspected, wayback)
  const commonCrawlCandidates = loadJsonl(join(outDir, 'common_crawl_candidates.jsonl'))
  const commonCrawlPromotions = loadJsonl(join(outDir, 'common_crawl_promotions.jsonl'))
  const facultyProfileCandidates = loadJsonl(join(outDir, 'faculty_profile_candidates.jsonl'))
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings })
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters })
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork })
  const coverageSearchQueries = buildCoverageSearchQueries(courseCoverage)
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, searchCandidates: updatedSearchCandidates, searchPromotions: allSearchPromotions, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, facultyPortfolioExamples, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries })

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
  writeJsonl(join(outDir, 'search_candidates.jsonl'), updatedSearchCandidates)
  writeJsonl(join(outDir, 'search_promotions.jsonl'), allSearchPromotions)
  writeJsonl(join(outDir, 'review_queue.jsonl'), reviewQueue)
  writeJsonl(join(outDir, 'review_decisions.jsonl'), reviewDecisions)
  writeJsonl(join(outDir, 'field_conflicts.jsonl'), fieldConflicts)
  writeJsonl(join(outDir, 'course_coverage.jsonl'), courseCoverage)
  writeJsonl(join(outDir, 'coverage_search_queries.jsonl'), coverageSearchQueries)
  writeFileSync(join(outDir, 'course_coverage.md'), courseCoverageMarkdown(courseCoverage))
  writeFileSync(join(outDir, 'review_queue.md'), reviewQueueMarkdown(reviewQueue))
  writeFileSync(join(outDir, 'needs_followup.md'), needsFollowupMarkdown({ reviewQueue, reviewDecisions, fieldConflicts }))
  writeJson(join(outDir, 'validation.json'), validationWithReview)
  writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validationWithReview))
  writeFileSync(join(outDir, 'course_reconstruction.md'), reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, studentWork, wayback, sourceClusters }))
  writeFileSync(join(outDir, 'source_audit.md'), auditMarkdown({ sources, searchQueries, wayback, validation: validationWithReview }))
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork }))
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, studentWork }))
  console.log(`RISD search promotions written to ${join(outDir, 'search_promotions.jsonl')}`)
  console.log(`new_promotions=${newPromotions.length} successful_promotions=${newPromotions.filter((row) => row.extraction_status === 'ok').length} total_search_promotions=${allSearchPromotions.length} validation=${validationWithReview.status}`)
}

async function renderFacultyPortfolioExamplesOnly() {
  ensureDir(outDir)
  const sources = loadJsonl(join(outDir, 'sources.jsonl'))
  const externalProfileSources = sources
    .filter(isExternalFacultyProfileSource)
    .slice(0, facultyPortfolioExampleLimit)
  const inspected = []
  for (const [index, source] of externalProfileSources.entries()) {
    console.error(`inspect faculty portfolio ${index + 1}/${externalProfileSources.length}: ${source.url}`)
    inspected.push(await inspectSeed(source))
  }
  const facultyPortfolioExamples = buildFacultyPortfolioExamples(inspected)
  const courseInventoryRows = loadJsonl(join(outDir, 'course_inventory.jsonl'))
  const courses = loadJsonl(join(outDir, 'courses.jsonl'))
  const syllabi = loadJsonl(join(outDir, 'syllabi.jsonl'))
  const assignments = loadJsonl(join(outDir, 'assignments.jsonl'))
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
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork })
  const coverageSearchQueries = buildCoverageSearchQueries(courseCoverage)
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, searchCandidates, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, facultyPortfolioExamples, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries })

  writeJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'), facultyPortfolioExamples)
  writeJson(join(outDir, 'validation.json'), validationWithReview)
  writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validationWithReview))
  console.log(`RISD faculty portfolio examples written to ${join(outDir, 'faculty_portfolio_examples.jsonl')}`)
  console.log(`faculty_portfolio_examples=${facultyPortfolioExamples.length} validation=${validationWithReview.status}`)
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
  const facultyPortfolioExamples = loadJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'))
  const { faculty, facultyCourseEdges } = buildFacultyGraph({ sources, courseInventory, syllabi })
  const searchCandidates = loadJsonl(join(outDir, 'search_candidates.jsonl'))
  const sourceClusters = loadJsonl(join(outDir, 'source_clusters.jsonl'))
  const sourceVersions = loadJsonl(join(outDir, 'source_versions.jsonl'))
  const wayback = loadJsonl(join(outDir, 'wayback_captures.jsonl'))
  const facultyProfileCandidates = loadJsonl(join(outDir, 'faculty_profile_candidates.jsonl'))
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings })
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters })
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork })
  const coverageSearchQueries = buildCoverageSearchQueries(courseCoverage)
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, searchCandidates, commonCrawlCandidates: updatedCandidates, commonCrawlPromotions: updatedPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, facultyPortfolioExamples, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries })

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
  writeJsonl(join(outDir, 'course_coverage.jsonl'), courseCoverage)
  writeJsonl(join(outDir, 'coverage_search_queries.jsonl'), coverageSearchQueries)
  writeFileSync(join(outDir, 'course_coverage.md'), courseCoverageMarkdown(courseCoverage))
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

async function promoteArchiveTargetsOnlyMode() {
  ensureDir(outDir)
  const existingSources = loadJsonl(join(outDir, 'sources.jsonl'))
  const existingSourceUrls = new Set(existingSources.map((source) => canonicalUrl(source.url)))
  const existingArchivePromotions = loadJsonl(join(outDir, 'archive_promotions.jsonl'))
  const promotedTargetIds = new Set(existingArchivePromotions.map((promotion) => promotion.target_id))
  const archiveFetchTargets = loadJsonl(join(outDir, 'archive_fetch_targets.jsonl'))
  const selectedTargets = archiveFetchTargets
    .filter((target) => target.target_status === 'pending_archive_fetch')
    .filter((target) => !promotedTargetIds.has(target.target_id))
    .filter((target) => target.memento_url && !existingSourceUrls.has(canonicalUrl(target.memento_url)))
    .sort((a, b) => b.priority_score - a.priority_score || String(a.capture_timestamp).localeCompare(String(b.capture_timestamp)))
    .slice(0, archivePromoteLimit)

  const inspectedPromotions = []
  for (const [index, target] of selectedTargets.entries()) {
    console.error(`promote archive target ${index + 1}/${selectedTargets.length}: ${target.memento_url}`)
    const seed = sourceSeedFromArchiveTarget(target)
    inspectedPromotions.push({ target, inspected: await inspectSeed(seed) })
  }

  const newPromotions = inspectedPromotions.map(({ target, inspected }) => ({
    promotion_id: `archive_promotion_${target.target_id}`,
    target_id: target.target_id,
    source_id: target.source_id,
    promoted_at: retrievedAt,
    promoted_source_id: inspected.source.extraction_status === 'ok' ? inspected.source.source_id : null,
    original_url: target.original_url,
    memento_url: target.memento_url,
    replay_url: target.replay_url,
    capture_timestamp: target.capture_timestamp,
    priority_score: target.priority_score,
    priority: target.priority,
    selection_reason: target.selection_reason,
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
    error: inspected.source.error ?? (inspected.source.extraction_status === 'ok' ? null : `archive_fetch_${inspected.source.extraction_status}`),
  }))
  const archivePromotions = mergeRowsByKey(existingArchivePromotions, newPromotions, (promotion) => promotion.promotion_id)
  const newSources = inspectedPromotions
    .filter(({ inspected }) => inspected.source.extraction_status === 'ok')
    .map(({ inspected }) => inspected.source)
  const sourcesForReparse = mergeRowsByKey(existingSources, newSources, (source) => source.source_id)

  const inspected = []
  for (const [index, source] of sourcesForReparse.entries()) {
    console.error(`reparse archive corpus source ${index + 1}/${sourcesForReparse.length}: ${source.source_id}`)
    inspected.push(await inspectSeed(source))
  }

  const sources = inspected.map(({ source }) => source)
  const courseInventoryRows = loadJsonl(join(outDir, 'course_inventory.jsonl'))
  const previousValidation = existsSync(join(outDir, 'validation.json')) ? JSON.parse(readFileSync(join(outDir, 'validation.json'), 'utf8')) : null
  const courseInventory = {
    offerings: courseInventoryRows,
    displayed_count: previousValidation?.counts?.official_course_displayed_count ?? courseInventoryRows.length,
  }
  const courses = buildCourses(inspected)
  const syllabi = buildSyllabi(inspected)
  const assignments = buildAssignments(syllabi)
  const readings = mergeReadingExternalLinks(buildReadings(syllabi), loadJsonl(join(outDir, 'readings.jsonl')))
  const readingFrequency = buildReadingFrequency(readings)
  const { faculty, facultyCourseEdges } = buildFacultyGraph({ sources, courseInventory, syllabi })
  const studentWork = buildStudentWork(inspected)
  const facultyPortfolioExamples = loadJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'))
  const sourceClusters = buildSourceClusters(inspected, syllabi, readings)
  const wayback = loadJsonl(join(outDir, 'wayback_captures.jsonl'))
  const sourceVersions = buildSourceVersions(inspected, wayback)
  const courseSitePages = buildCourseSitePages({ sources, syllabi, assignments, readings })
  const scheduleRows = buildScheduleRows({ syllabi, assignments, readings, courseSitePages })
  const assignmentBriefPages = buildAssignmentBriefPages({ courseSitePages, assignments })
  const studentWorkAssignmentLinks = buildStudentWorkAssignmentLinks({ studentWork, assignmentBriefPages, assignments, courseSitePages })
  const refreshedArchiveFetchTargets = buildArchiveFetchTargets({ sources, wayback, sourceVersions })
  const searchCandidates = loadJsonl(join(outDir, 'search_candidates.jsonl'))
  const searchPromotions = loadJsonl(join(outDir, 'search_promotions.jsonl'))
  const commonCrawlCandidates = loadJsonl(join(outDir, 'common_crawl_candidates.jsonl'))
  const commonCrawlPromotions = loadJsonl(join(outDir, 'common_crawl_promotions.jsonl'))
  const facultyProfileCandidates = loadJsonl(join(outDir, 'faculty_profile_candidates.jsonl'))
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings })
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters })
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork, scheduleRows })
  const coverageSearchQueries = buildCoverageSearchQueries(courseCoverage)
  const facultySearchQueries = buildFacultySearchQueries(faculty, facultyCourseEdges)
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, scheduleRows, searchCandidates, searchPromotions, commonCrawlCandidates, commonCrawlPromotions, archivePromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, studentWorkAssignmentLinks, facultyPortfolioExamples, courseSitePages, assignmentBriefPages, archiveFetchTargets: refreshedArchiveFetchTargets, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries, facultySearchQueries })

  writeJsonl(join(outDir, 'sources.jsonl'), sources)
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
  writeJsonl(join(outDir, 'course_site_pages.jsonl'), courseSitePages)
  writeJsonl(join(outDir, 'schedule_rows.jsonl'), scheduleRows)
  writeJsonl(join(outDir, 'assignment_brief_pages.jsonl'), assignmentBriefPages)
  writeJsonl(join(outDir, 'student_work_assignment_links.jsonl'), studentWorkAssignmentLinks)
  writeJsonl(join(outDir, 'archive_fetch_targets.jsonl'), refreshedArchiveFetchTargets)
  writeJsonl(join(outDir, 'archive_promotions.jsonl'), archivePromotions)
  writeJsonl(join(outDir, 'review_queue.jsonl'), reviewQueue)
  writeJsonl(join(outDir, 'review_decisions.jsonl'), reviewDecisions)
  writeJsonl(join(outDir, 'field_conflicts.jsonl'), fieldConflicts)
  writeJsonl(join(outDir, 'course_coverage.jsonl'), courseCoverage)
  writeJsonl(join(outDir, 'coverage_search_queries.jsonl'), coverageSearchQueries)
  writeJsonl(join(outDir, 'faculty_search_queries.jsonl'), facultySearchQueries)
  writeFileSync(join(outDir, 'course_coverage.md'), courseCoverageMarkdown(courseCoverage))
  writeFileSync(join(outDir, 'review_queue.md'), reviewQueueMarkdown(reviewQueue))
  writeFileSync(join(outDir, 'needs_followup.md'), needsFollowupMarkdown({ reviewQueue, reviewDecisions, fieldConflicts }))
  writeJson(join(outDir, 'validation.json'), validationWithReview)
  writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validationWithReview))
  writeFileSync(join(outDir, 'course_reconstruction.md'), reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks, wayback, sourceClusters }))
  writeFileSync(join(outDir, 'source_audit.md'), auditMarkdown({ sources, searchQueries, wayback, validation: validationWithReview }))
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork }))
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks }))
  console.log(`RISD archive promotions written to ${join(outDir, 'archive_promotions.jsonl')}`)
  console.log(`new_archive_promotions=${newPromotions.length} successful_archive_promotions=${newPromotions.filter((row) => row.extraction_status === 'ok').length} sources=${sources.length} validation=${validationWithReview.status}`)
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
  const facultyPortfolioExamples = loadJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'))
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings })
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters })
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork })
  const coverageSearchQueries = buildCoverageSearchQueries(courseCoverage)
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, searchCandidates, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, facultyPortfolioExamples, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries })

  writeJsonl(join(outDir, 'sources.jsonl'), sources)
  writeJsonl(join(outDir, 'faculty.jsonl'), faculty)
  writeJsonl(join(outDir, 'faculty_course_edges.jsonl'), facultyCourseEdges)
  writeJsonl(join(outDir, 'faculty_profile_candidates.jsonl'), facultyProfileCandidates)
  writeJsonl(join(outDir, 'review_queue.jsonl'), reviewQueue)
  writeJsonl(join(outDir, 'review_decisions.jsonl'), reviewDecisions)
  writeJsonl(join(outDir, 'field_conflicts.jsonl'), fieldConflicts)
  writeJsonl(join(outDir, 'course_coverage.jsonl'), courseCoverage)
  writeJsonl(join(outDir, 'coverage_search_queries.jsonl'), coverageSearchQueries)
  writeFileSync(join(outDir, 'course_coverage.md'), courseCoverageMarkdown(courseCoverage))
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
  if (searchApiOnly) {
    await renderSearchApiOnly()
    return
  }
  if (facultyPortfolioExamplesOnly) {
    await renderFacultyPortfolioExamplesOnly()
    return
  }
  if (ingestFacultyProfilesOnly) {
    await ingestFacultyProfilesOnlyMode()
    return
  }
  if (ingestCommonCrawlOnly) {
    await ingestCommonCrawlPromotionsOnly()
    return
  }
  if (promoteSearchOnly) {
    await promoteSearchCandidatesOnlyMode()
    return
  }
  if (promoteArchiveOnly) {
    await promoteArchiveTargetsOnlyMode()
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
  if (linkReadingsOnly) {
    await renderReadingLinksOnly()
    return
  }
  if (reparseExistingSourcesOnly) {
    await reparseExistingSourcesOnlyMode()
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
  const readings = mergeReadingExternalLinks(buildReadings(syllabi), loadJsonl(join(outDir, 'readings.jsonl')))
  const readingFrequency = buildReadingFrequency(readings)
  const { faculty, facultyCourseEdges } = buildFacultyGraph({ sources, courseInventory, syllabi })
  const studentWork = buildStudentWork(inspected)
  const facultyPortfolioExamples = loadJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'))
  const sourceClusters = buildSourceClusters(inspected, syllabi, readings)
  const sourceVersions = buildSourceVersions(inspected, wayback)
  const archiveFetchTargets = buildArchiveFetchTargets({ sources, wayback, sourceVersions })
  const courseSitePages = buildCourseSitePages({ sources, syllabi, assignments, readings })
  const scheduleRows = buildScheduleRows({ syllabi, assignments, readings, courseSitePages })
  const assignmentBriefPages = buildAssignmentBriefPages({ courseSitePages, assignments })
  const studentWorkAssignmentLinks = buildStudentWorkAssignmentLinks({ studentWork, assignmentBriefPages, assignments, courseSitePages })
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork, scheduleRows })
  const coverageSearchQueries = buildCoverageSearchQueries(courseCoverage)
  const facultySearchQueries = buildFacultySearchQueries(faculty, facultyCourseEdges)
  const existingSearchCandidates = loadJsonl(join(outDir, 'search_candidates.jsonl'))
  const existingLiveSearchCandidates = existingSearchCandidates.filter((candidate) => candidate.source === 'live_search_api')
  const searchCandidates = buildSearchCandidates(importedSearchCandidates, promotedImportedSearchSources, existingLiveSearchCandidates, coverageSearchQueries, facultySearchQueries)
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
  writeJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'), facultyPortfolioExamples)
  writeJsonl(join(outDir, 'source_clusters.jsonl'), sourceClusters)
  writeJsonl(join(outDir, 'source_versions.jsonl'), sourceVersions)
  writeJsonl(join(outDir, 'archive_fetch_targets.jsonl'), archiveFetchTargets)
  writeJsonl(join(outDir, 'wayback_captures.jsonl'), wayback)
  writeJsonl(join(outDir, 'crawl_sources.jsonl'), crawlSeeds)
  const existingSearchResults = loadJsonl(join(outDir, 'search_results.jsonl')).filter((row) => row.source === 'live_search_api')
  writeJsonl(join(outDir, 'search_results.jsonl'), [...buildSearchResults(), ...existingSearchResults])
  writeJsonl(join(outDir, 'search_candidates.jsonl'), searchCandidates)
  writeJsonl(join(outDir, 'common_crawl_candidates.jsonl'), commonCrawlCandidates)
  writeJsonl(join(outDir, 'common_crawl_promotions.jsonl'), commonCrawlPromotions)
  writeJsonl(join(outDir, 'faculty_profile_candidates.jsonl'), facultyProfileCandidates)
  writeJson(join(outDir, 'search_queries.json'), { generated_at: retrievedAt, queries: searchQueries })
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings })
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters })
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, scheduleRows, searchCandidates, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, studentWorkAssignmentLinks, facultyPortfolioExamples, courseSitePages, assignmentBriefPages, archiveFetchTargets, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries, facultySearchQueries })
  writeJsonl(join(outDir, 'review_queue.jsonl'), reviewQueue)
  writeJsonl(join(outDir, 'review_decisions.jsonl'), reviewDecisions)
  writeJsonl(join(outDir, 'field_conflicts.jsonl'), fieldConflicts)
  writeJsonl(join(outDir, 'course_site_pages.jsonl'), courseSitePages)
  writeJsonl(join(outDir, 'schedule_rows.jsonl'), scheduleRows)
  writeJsonl(join(outDir, 'assignment_brief_pages.jsonl'), assignmentBriefPages)
  writeJsonl(join(outDir, 'student_work_assignment_links.jsonl'), studentWorkAssignmentLinks)
  writeJsonl(join(outDir, 'course_coverage.jsonl'), courseCoverage)
  writeJsonl(join(outDir, 'coverage_search_queries.jsonl'), coverageSearchQueries)
  writeJsonl(join(outDir, 'faculty_search_queries.jsonl'), facultySearchQueries)
  writeFileSync(join(outDir, 'course_coverage.md'), courseCoverageMarkdown(courseCoverage))
  writeFileSync(join(outDir, 'review_queue.md'), reviewQueueMarkdown(reviewQueue))
  writeFileSync(join(outDir, 'needs_followup.md'), needsFollowupMarkdown({ reviewQueue, reviewDecisions, fieldConflicts }))
  writeJson(join(outDir, 'validation.json'), validationWithReview)
  writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validationWithReview))
  writeFileSync(join(outDir, 'course_reconstruction.md'), reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks, wayback, sourceClusters }))
  writeFileSync(join(outDir, 'source_audit.md'), auditMarkdown({ sources, searchQueries, wayback, validation: validationWithReview }))
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork }))
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks }))

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
