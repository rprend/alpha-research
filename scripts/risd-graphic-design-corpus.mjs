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
const portfolioGateStatusImportPath = process.env.RISD_GD_PORTFOLIO_GATE_STATUS_IMPORTS ?? join(outDir, 'self_study_portfolio_gate_status_import.jsonl')
const portfolioReviewerFeedbackImportPath = process.env.RISD_GD_PORTFOLIO_REVIEWER_FEEDBACK_IMPORTS ?? join(outDir, 'self_study_portfolio_reviewer_feedback_import.jsonl')
const portfolioCollaboratorResponseSendLogImportPath = process.env.RISD_GD_COLLABORATOR_RESPONSE_SEND_LOG_IMPORTS ?? join(outDir, 'self_study_portfolio_collaborator_response_send_log_import.jsonl')
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
  if (/^readings?\s+(?:will|are|may|can|should)\b/i.test(rawCitation)) return true
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

function classifyReadingSemantics(reading) {
  const text = `${reading.raw_citation ?? ''} ${reading.title ?? ''} ${reading.publisher_or_source ?? ''}`.toLowerCase()
  let citationType = reading.resource_type ?? 'unknown'
  if (reading.linking_status === 'non_citation_fragment' || reading.resource_type === 'non_citation_fragment') citationType = 'non_reading_fragment'
  else if (['book', 'essay', 'article', 'video', 'website'].includes(reading.resource_type)) citationType = reading.resource_type
  else if (/youtube|vimeo|video|watch|film|lecture recording|ted\b/.test(text)) citationType = 'video'
  else if (/slides?|deck|presentation/.test(text)) citationType = 'slide_deck'
  else if (/documentation|docs|manual|api|html|css|javascript|github|figma|software|tool/.test(text)) citationType = 'tool_documentation'
  else if (/inspiration|reference|precedent|examples?|archive|collection|museum|gallery|printed matter|publishers?/.test(text)) citationType = 'inspiration_reference'
  else if (/journal|magazine|article/.test(text)) citationType = 'article'
  else if (/essay|manifesto|interview/.test(text)) citationType = 'essay'
  else if (/press|publisher|isbn|book/.test(text) || reading.canonical_work_id) citationType = 'book'
  else if (reading.resource_type && !['unknown', 'concept_resource', 'organization_resource', 'publisher_resource'].includes(reading.resource_type)) citationType = reading.resource_type
  else citationType = 'non-reading resource'

  let readingContext = reading.required_or_recommended === 'recommended' ? 'recommended' : 'unknown'
  if (/required|must read|read before|please read|assigned reading/.test(text)) readingContext = 'required'
  else if (/recommended|optional|suggested|further reading/.test(text)) readingContext = 'recommended'
  else if (/inspiration|precedent|reference|examples?|collection|archive/.test(text)) readingContext = 'inspiration'
  else if (/documentation|docs|manual|tutorial|api|html|css|javascript|github|figma|software|tool/.test(text)) readingContext = 'technical_reference'
  else if (/lecture|slides?|talk|screening|presentation/.test(text)) readingContext = 'lecture_support'
  else if (/assignment|project|brief|exercise|critique|crit|workshop|response/.test(text)) readingContext = 'assignment_resource'

  const semanticStatus = citationType === 'non_reading_fragment'
    ? 'non_citation_fragment'
    : ['book', 'article', 'essay'].includes(citationType)
      ? 'bibliographic'
      : 'resource'
  return { citation_type: citationType, reading_context: readingContext, semantic_status: semanticStatus }
}

function buildReadings(syllabi) {
  const rows = []
  for (const syllabus of syllabi) {
    syllabus.readings.forEach((reading, index) => {
      const normalized = normalizeCitation(reading)
      const semantics = classifyReadingSemantics(normalized)
      rows.push({
        reading_id: `reading_${syllabus.syllabus_id}_${String(index + 1).padStart(2, '0')}`,
        course_code: syllabus.course_code,
        course_title: syllabus.course_title,
        syllabus_id: syllabus.syllabus_id,
        citation_excerpt: normalized.raw_citation,
        ...normalized,
        ...semantics,
        required_or_recommended: /recommended/i.test(reading) ? 'recommended' : 'unknown',
        week_or_date: reading.match(/\b(?:week|class|session)\s+\d+\b/i)?.[0] ?? null,
        linked_assignment_ids: [],
        linked_schedule_ids: [],
        support_link_basis: [],
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
    Object.assign(merged, classifyReadingSemantics(merged))
    return merged
  })
}

function enrichReadingSupportLinks(readings, { assignments = [], scheduleRows = [] } = {}) {
  const assignmentsBySyllabus = new Map()
  for (const assignment of assignments) {
    const existing = assignmentsBySyllabus.get(assignment.syllabus_id) ?? []
    existing.push(assignment)
    assignmentsBySyllabus.set(assignment.syllabus_id, existing)
  }
  const scheduleRowsByReadingId = new Map()
  for (const row of scheduleRows) {
    for (const readingId of row.reading_ids ?? []) {
      const existing = scheduleRowsByReadingId.get(readingId) ?? []
      existing.push(row.schedule_id)
      scheduleRowsByReadingId.set(readingId, existing)
    }
  }
  return readings.map((reading) => {
    const text = `${reading.raw_citation ?? ''} ${reading.title ?? ''}`.toLowerCase()
    const supportLinkBasis = new Set(reading.support_link_basis ?? [])
    const linkedAssignmentIds = new Set(reading.linked_assignment_ids ?? [])
    const usableResource = reading.semantic_status !== 'non_citation_fragment'
    if (usableResource) {
      for (const assignment of assignmentsBySyllabus.get(reading.syllabus_id) ?? []) {
        const assignmentText = `${assignment.title ?? ''} ${assignment.prompt_excerpt ?? ''}`.toLowerCase()
        const title = (reading.title ?? '').toLowerCase()
        const raw = (reading.raw_citation ?? '').toLowerCase()
        if (!/(read|reading|resource|reference|inspiration|precedent|response|critique|assignment|project)/.test(assignmentText)) continue
        if (title && title.length >= 8 && assignmentText.includes(title)) {
          linkedAssignmentIds.add(assignment.assignment_id)
          supportLinkBasis.add('assignment_text_mentions_reading_title')
        } else if (raw && raw.length >= 18 && assignmentText.includes(raw)) {
          linkedAssignmentIds.add(assignment.assignment_id)
          supportLinkBasis.add('assignment_text_mentions_raw_citation')
        }
      }
    }
    const linkedScheduleIds = new Set(reading.linked_schedule_ids ?? [])
    if (usableResource) {
      for (const scheduleId of scheduleRowsByReadingId.get(reading.reading_id) ?? []) {
        linkedScheduleIds.add(scheduleId)
        supportLinkBasis.add('schedule_row_reading_ids')
      }
    }
    const enriched = {
      ...reading,
      ...classifyReadingSemantics(reading),
      linked_assignment_ids: [...linkedAssignmentIds].sort(),
      linked_schedule_ids: [...linkedScheduleIds].sort(),
      support_link_basis: [...supportLinkBasis].sort(),
    }
    if (enriched.linked_assignment_ids.length && enriched.reading_context === 'unknown') enriched.reading_context = 'assignment_resource'
    if (enriched.linked_schedule_ids.length && enriched.reading_context === 'unknown') enriched.reading_context = 'lecture_support'
    return enriched
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
      clusterType: 'exact_duplicate',
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
    .filter(({ source, text }) => source.extraction_status === 'ok' && text && text.length > 500 && !isGenericErrorPageSource(source, text))
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
        clusterType: 'near_duplicate',
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

  const archiveGroups = new Map()
  for (const { source } of inspected.filter(({ source, text }) => source.source_type === 'wayback_capture' && source.parent_source_id && sourceById.has(source.parent_source_id) && !isGenericErrorPageSource(source, text))) {
    const existing = archiveGroups.get(source.parent_source_id) ?? [source.parent_source_id]
    existing.push(source.source_id)
    archiveGroups.set(source.parent_source_id, existing)
  }
  for (const [parentSourceId, ids] of archiveGroups) {
    const sourceIds = uniq(ids)
    if (sourceIds.length < 2) continue
    clusters.push(makeSourceCluster({
      clusterIndex,
      clusterType: 'historical_version',
      sourceIds,
      sourceById,
      inspected,
      syllabi,
      readings,
      reason: `archive_parent:${parentSourceId}`,
      similarity: null,
    }))
    sourceIds.forEach((id) => clustered.add(id))
    clusterIndex += 1
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
      clusterType: 'related_family',
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

function isGenericErrorPageSource(source, text = '') {
  const title = String(source.title ?? '').toLowerCase()
  const normalized = normalizeTextForSimilarity(text).slice(0, 2000)
  if (/page not found|404|not found|access denied|forbidden/.test(title)) return true
  if (/^page not found/.test(normalized)) return true
  if (normalized.length < 150 && /not found|404|forbidden/.test(normalized)) return true
  return false
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
    collapse_recommendation: clusterType === 'exact_duplicate'
      ? 'collapse_cosmetic_duplicate'
      : clusterType === 'near_duplicate'
        ? 'manual_review_before_collapse'
        : clusterType === 'historical_version'
          ? 'keep_distinct_historical_version'
          : 'keep_distinct_related_sources',
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

function validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency = [], scheduleRows = null, searchCandidates = [], searchPromotions = null, commonCrawlCandidates = [], commonCrawlPromotions = [], archivePromotions = null, facultyProfileCandidates = [], faculty = [], facultyCourseEdges = [], studentWork = [], studentWorkAssignmentLinks = null, selfStudyModules = null, selfStudyPacingPlan = null, selfStudyPacingProfiles = null, selfStudyProgressLedger = null, selfStudyPortfolioProgressRollups = null, selfStudyPortfolioCompletionGates = null, selfStudyPortfolioGateStatusImports = null, selfStudyPortfolioGateStatusTemplate = null, selfStudyPortfolioGateStatusSummary = null, selfStudyPortfolioReviewIndex = null, selfStudyPortfolioReviewerHandoff = null, selfStudyPortfolioReviewerFeedbackTemplate = null, selfStudyPortfolioReviewerFeedbackImports = null, selfStudyPortfolioReviewerFeedbackSmokeFixture = null, selfStudyPortfolioReviewWorkflow = null, selfStudyPortfolioReviewAgendas = null, selfStudyPortfolioReviewDashboard = null, selfStudyPortfolioDecisionPackets = null, selfStudyPortfolioCompletionChecklists = null, selfStudyPortfolioArchiveManifests = null, selfStudyPortfolioArchiveAudit = null, selfStudyPortfolioOperationsSummary = null, selfStudyPortfolioCollaboratorHandoffPackets = null, selfStudyPortfolioCollaboratorResponseIntakeTemplate = null, selfStudyPortfolioCollaboratorResponseReconciliation = null, selfStudyPortfolioCollaboratorResponseActionQueue = null, selfStudyPortfolioCollaboratorResponseActionProgress = null, selfStudyPortfolioCollaboratorResponseReviewBriefs = null, selfStudyPortfolioCollaboratorResponseDistributionManifests = null, selfStudyPortfolioCollaboratorResponseDistributionStatus = null, selfStudyPortfolioCollaboratorResponseSendLogTemplate = null, selfStudyPortfolioCollaboratorResponseSendLogImports = null, selfStudyPortfolioCollaboratorResponseReminderQueue = null, selfStudyPortfolioCollaboratorResponseEvidenceRegister = null, selfStudyPortfolioRevisionQueue = null, selfStudyPortfolioGateStatusSuggestions = null, selfStudyPortfolioEvidenceAttachments = null, selfStudyPortfolioMilestones = null, selfStudyPortfolioBriefs = null, selfStudyPortfolioReferencePackets = null, selfStudyPortfolioExportManifests = null, selfStudyPortfolioSourceExcerptPackets = null, facultyPortfolioExamples = [], courseSitePages = null, assignmentBriefPages = null, archiveFetchTargets = null, sourceClusters = [], sourceVersions = [], wayback, reviewQueue = [], reviewDecisions = [], fieldConflicts = [], courseCoverage = [], coverageSearchQueries = [], facultySearchQueries = null }) {
  const effectiveSearchPromotions = searchPromotions ?? loadJsonl(join(outDir, 'search_promotions.jsonl'))
  const effectiveArchivePromotions = archivePromotions ?? loadJsonl(join(outDir, 'archive_promotions.jsonl'))
  const effectiveFacultySearchQueries = facultySearchQueries ?? loadJsonl(join(outDir, 'faculty_search_queries.jsonl'))
  const effectiveCourseSitePages = courseSitePages ?? loadJsonl(join(outDir, 'course_site_pages.jsonl'))
  const effectiveAssignmentBriefPages = assignmentBriefPages ?? loadJsonl(join(outDir, 'assignment_brief_pages.jsonl'))
  const effectiveStudentWorkAssignmentLinks = studentWorkAssignmentLinks ?? loadJsonl(join(outDir, 'student_work_assignment_links.jsonl'))
  const effectiveSelfStudyModules = selfStudyModules ?? loadJsonl(join(outDir, 'self_study_modules.jsonl'))
  const effectiveSelfStudyPacingPlan = selfStudyPacingPlan ?? []
  const effectiveSelfStudyPacingProfiles = selfStudyPacingProfiles ?? []
  const effectiveSelfStudyProgressLedger = selfStudyProgressLedger ?? []
  const effectiveSelfStudyPortfolioProgressRollups = selfStudyPortfolioProgressRollups ?? []
  const effectiveSelfStudyPortfolioCompletionGates = selfStudyPortfolioCompletionGates ?? []
  const effectiveSelfStudyPortfolioGateStatusImports = selfStudyPortfolioGateStatusImports ?? loadJsonl(portfolioGateStatusImportPath)
  const effectiveSelfStudyPortfolioGateStatusTemplate = selfStudyPortfolioGateStatusTemplate ?? []
  const effectiveSelfStudyPortfolioGateStatusSummary = selfStudyPortfolioGateStatusSummary ?? []
  const effectiveSelfStudyPortfolioReviewIndex = selfStudyPortfolioReviewIndex ?? []
  const effectiveSelfStudyPortfolioReviewerHandoff = selfStudyPortfolioReviewerHandoff ?? []
  const effectiveSelfStudyPortfolioReviewerFeedbackTemplate = selfStudyPortfolioReviewerFeedbackTemplate ?? []
  const effectiveSelfStudyPortfolioReviewerFeedbackImports = selfStudyPortfolioReviewerFeedbackImports ?? loadJsonl(portfolioReviewerFeedbackImportPath)
  const effectiveSelfStudyPortfolioReviewerFeedbackSmokeFixture = selfStudyPortfolioReviewerFeedbackSmokeFixture ?? []
  const effectiveSelfStudyPortfolioReviewWorkflow = selfStudyPortfolioReviewWorkflow ?? []
  const effectiveSelfStudyPortfolioReviewAgendas = selfStudyPortfolioReviewAgendas ?? []
  const effectiveSelfStudyPortfolioReviewDashboard = selfStudyPortfolioReviewDashboard ?? []
  const effectiveSelfStudyPortfolioDecisionPackets = selfStudyPortfolioDecisionPackets ?? []
  const effectiveSelfStudyPortfolioCompletionChecklists = selfStudyPortfolioCompletionChecklists ?? []
  const effectiveSelfStudyPortfolioArchiveManifests = selfStudyPortfolioArchiveManifests ?? []
  const effectiveSelfStudyPortfolioArchiveAudit = selfStudyPortfolioArchiveAudit ?? []
  const effectiveSelfStudyPortfolioOperationsSummary = selfStudyPortfolioOperationsSummary ?? []
  const effectiveSelfStudyPortfolioCollaboratorHandoffPackets = selfStudyPortfolioCollaboratorHandoffPackets ?? []
  const effectiveSelfStudyPortfolioCollaboratorResponseIntakeTemplate = selfStudyPortfolioCollaboratorResponseIntakeTemplate ?? []
  const effectiveSelfStudyPortfolioCollaboratorResponseReconciliation = selfStudyPortfolioCollaboratorResponseReconciliation ?? []
  const effectiveSelfStudyPortfolioCollaboratorResponseActionQueue = selfStudyPortfolioCollaboratorResponseActionQueue ?? []
  const effectiveSelfStudyPortfolioCollaboratorResponseActionProgress = selfStudyPortfolioCollaboratorResponseActionProgress ?? []
  const effectiveSelfStudyPortfolioCollaboratorResponseReviewBriefs = selfStudyPortfolioCollaboratorResponseReviewBriefs ?? []
  const effectiveSelfStudyPortfolioCollaboratorResponseDistributionManifests = selfStudyPortfolioCollaboratorResponseDistributionManifests ?? []
  const effectiveSelfStudyPortfolioCollaboratorResponseDistributionStatus = selfStudyPortfolioCollaboratorResponseDistributionStatus ?? []
  const effectiveSelfStudyPortfolioCollaboratorResponseSendLogTemplate = selfStudyPortfolioCollaboratorResponseSendLogTemplate ?? []
  const effectiveSelfStudyPortfolioCollaboratorResponseSendLogImports = selfStudyPortfolioCollaboratorResponseSendLogImports ?? loadJsonl(portfolioCollaboratorResponseSendLogImportPath)
  const effectiveSelfStudyPortfolioCollaboratorResponseReminderQueue = selfStudyPortfolioCollaboratorResponseReminderQueue ?? []
  const effectiveSelfStudyPortfolioCollaboratorResponseEvidenceRegister = selfStudyPortfolioCollaboratorResponseEvidenceRegister ?? []
  const effectiveSelfStudyPortfolioRevisionQueue = selfStudyPortfolioRevisionQueue ?? []
  const effectiveSelfStudyPortfolioGateStatusSuggestions = selfStudyPortfolioGateStatusSuggestions ?? []
  const effectiveSelfStudyPortfolioEvidenceAttachments = selfStudyPortfolioEvidenceAttachments ?? []
  const effectiveSelfStudyPortfolioMilestones = selfStudyPortfolioMilestones ?? []
  const effectiveSelfStudyPortfolioBriefs = selfStudyPortfolioBriefs ?? []
  const effectiveSelfStudyPortfolioReferencePackets = selfStudyPortfolioReferencePackets ?? []
  const effectiveSelfStudyPortfolioExportManifests = selfStudyPortfolioExportManifests ?? []
  const effectiveSelfStudyPortfolioSourceExcerptPackets = selfStudyPortfolioSourceExcerptPackets ?? []
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
  const assignmentIds = new Set(assignments.map((assignment) => assignment.assignment_id))
  const effectiveScheduleRowIds = new Set(effectiveScheduleRows.map((row) => row.schedule_id))
  const readingSourceErrors = readings.filter((reading) => !syllabusIds.has(reading.syllabus_id) || reading.source_ids.some((id) => !sourceIds.has(id)))
  const readingIds = new Set(readings.map((reading) => reading.reading_id))
  const normalizedReadingCount = readings.filter((reading) => reading.canonical_work_id).length
  const catalogReadingCount = readings.filter((reading) => reading.linking_status === 'local_catalog_match').length
  const externalCatalogReadingCount = readings.filter((reading) => reading.linking_status === 'external_catalog_match' || reading.external_link_status === 'matched').length
  const externalCatalogAttemptCount = readings.filter((reading) => reading.external_link_provider).length
  const externalCatalogErrors = readings.filter((reading) => reading.external_link_provider && (!reading.external_link_status || (reading.external_link_status === 'matched' && !reading.external_work_id)))
  const unresolvedReadingCount = readings.filter((reading) => reading.linking_status === 'unresolved').length
  const nonCitationReadingCount = readings.filter((reading) => reading.linking_status === 'non_citation_fragment').length
  const bibliographicReadingCount = readings.filter((reading) => reading.semantic_status === 'bibliographic').length
  const resourceReadingCount = readings.filter((reading) => reading.semantic_status === 'resource').length
  const readingContextCount = readings.filter((reading) => reading.reading_context && reading.reading_context !== 'unknown').length
  const assignmentLinkedReadingCount = readings.filter((reading) => reading.linked_assignment_ids?.length).length
  const scheduleLinkedReadingCount = readings.filter((reading) => reading.linked_schedule_ids?.length).length
  const readingSemanticErrors = readings.filter((reading) =>
    !reading.citation_type
      || !reading.semantic_status
      || !reading.reading_context
      || reading.linked_assignment_ids?.some((id) => !assignmentIds.has(id))
      || reading.linked_schedule_ids?.some((id) => !effectiveScheduleRowIds.has(id))
  )
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
  const allowedSourceClusterTypes = new Set(['exact_duplicate', 'near_duplicate', 'historical_version', 'related_family'])
  const sourceClusterErrors = sourceClusters.filter((cluster) => !cluster.representative_source_id || !cluster.source_ids?.length || cluster.source_ids.some((id) => !sourceIds.has(id)) || !allowedSourceClusterTypes.has(cluster.cluster_type))
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
  const exactSourceClusterCount = sourceClusters.filter((cluster) => cluster.cluster_type === 'exact_duplicate').length
  const nearDuplicateSourceClusterCount = sourceClusters.filter((cluster) => cluster.cluster_type === 'near_duplicate').length
  const historicalVersionSourceClusterCount = sourceClusters.filter((cluster) => cluster.cluster_type === 'historical_version').length
  const relatedSourceClusterCount = sourceClusters.filter((cluster) => cluster.cluster_type === 'related_family').length
  const clusteredSourceIds = new Set(sourceClusters.flatMap((cluster) => cluster.source_ids ?? []))
  const coursePacketsWithClusteredEvidence = courses.filter((course) => course.source_ids?.some((sourceId) => clusteredSourceIds.has(sourceId)) || syllabi.some((syllabus) => syllabus.source_ids?.some((sourceId) => clusteredSourceIds.has(sourceId)) && ((syllabus.course_code && course.course_code && syllabus.course_code === course.course_code) || (syllabus.course_title && course.course_title && syllabus.course_title === course.course_title) || syllabus.source_ids.some((id) => course.source_ids.includes(id))))).length
  const reviewDecisionErrors = reviewDecisions.filter((decision) => !decision.review_id || !decision.status || decision.source_ids?.some((id) => !sourceIds.has(id)))
  const resolvedReviewDecisionCount = reviewDecisions.filter((decision) => decision.status && decision.status !== 'pending_manual_review').length
  const conflictReviewQueueCount = reviewQueue.filter((row) => row.conflict_id).length
  const pendingConflictReviewDecisionCount = reviewDecisions.filter((decision) => decision.conflict_id && decision.status === 'pending_manual_review').length
  const fieldConflictErrors = fieldConflicts.filter((conflict) => !conflict.conflict_id || !conflict.field || !conflict.values?.length || conflict.source_ids?.some((id) => !sourceIds.has(id)))
  const generatedCurriculumModules = buildSelfStudyModules({ courses, syllabi, assignments, readings, scheduleRows: effectiveScheduleRows, studentWork, studentWorkAssignmentLinks: effectiveStudentWorkAssignmentLinks })
  const curriculumModules = effectiveSelfStudyModules.length ? effectiveSelfStudyModules : generatedCurriculumModules
  const generatedPacingPlan = buildSelfStudyPacingPlan(curriculumModules)
  const pacingPlan = effectiveSelfStudyPacingPlan.length ? effectiveSelfStudyPacingPlan : generatedPacingPlan
  const generatedProgressLedger = buildSelfStudyProgressLedger(curriculumModules, pacingPlan)
  const progressLedger = effectiveSelfStudyProgressLedger.length ? effectiveSelfStudyProgressLedger : generatedProgressLedger
  const generatedPacingProfiles = buildSelfStudyPacingProfiles(pacingPlan)
  const pacingProfiles = effectiveSelfStudyPacingProfiles.length ? effectiveSelfStudyPacingProfiles : generatedPacingProfiles
  const generatedPortfolioMilestones = buildSelfStudyPortfolioMilestones(curriculumModules, pacingPlan)
  const portfolioMilestones = effectiveSelfStudyPortfolioMilestones.length ? effectiveSelfStudyPortfolioMilestones : generatedPortfolioMilestones
  const generatedPortfolioBriefsWithoutGates = buildSelfStudyPortfolioBriefs(curriculumModules, pacingPlan, portfolioMilestones)
  const portfolioBriefsWithoutGates = effectiveSelfStudyPortfolioBriefs.length ? effectiveSelfStudyPortfolioBriefs : generatedPortfolioBriefsWithoutGates
  const generatedPortfolioReferencePackets = buildSelfStudyPortfolioReferencePackets(curriculumModules, portfolioMilestones, facultyPortfolioExamples)
  const portfolioReferencePackets = effectiveSelfStudyPortfolioReferencePackets.length ? effectiveSelfStudyPortfolioReferencePackets : generatedPortfolioReferencePackets
  const generatedPortfolioSourceExcerptPackets = buildSelfStudyPortfolioSourceExcerptPackets(curriculumModules, portfolioMilestones)
  const portfolioSourceExcerptPackets = effectiveSelfStudyPortfolioSourceExcerptPackets.length ? effectiveSelfStudyPortfolioSourceExcerptPackets : generatedPortfolioSourceExcerptPackets
  const generatedPortfolioExportManifests = buildSelfStudyPortfolioExportManifests(portfolioMilestones, portfolioBriefsWithoutGates, portfolioReferencePackets, portfolioSourceExcerptPackets)
  const portfolioExportManifests = effectiveSelfStudyPortfolioExportManifests.length ? effectiveSelfStudyPortfolioExportManifests : generatedPortfolioExportManifests
  const generatedPortfolioProgressRollups = buildSelfStudyPortfolioProgressRollups(portfolioMilestones, portfolioExportManifests, progressLedger)
  const portfolioProgressRollups = effectiveSelfStudyPortfolioProgressRollups.length ? effectiveSelfStudyPortfolioProgressRollups : generatedPortfolioProgressRollups
  const generatedBasePortfolioCompletionGates = buildSelfStudyPortfolioCompletionGates(portfolioProgressRollups)
  const generatedPortfolioGateStatusTemplate = buildSelfStudyPortfolioGateStatusTemplate(generatedBasePortfolioCompletionGates)
  const portfolioGateStatusTemplate = effectiveSelfStudyPortfolioGateStatusTemplate.length ? effectiveSelfStudyPortfolioGateStatusTemplate : generatedPortfolioGateStatusTemplate
  const generatedPortfolioCompletionGates = applySelfStudyPortfolioGateStatusImports(generatedBasePortfolioCompletionGates, effectiveSelfStudyPortfolioGateStatusImports)
  const portfolioCompletionGates = effectiveSelfStudyPortfolioCompletionGates.length ? effectiveSelfStudyPortfolioCompletionGates : generatedPortfolioCompletionGates
  const generatedPortfolioEvidenceAttachments = buildSelfStudyPortfolioEvidenceAttachments(portfolioMilestones, portfolioProgressRollups, portfolioCompletionGates, portfolioExportManifests)
  const portfolioEvidenceAttachments = effectiveSelfStudyPortfolioEvidenceAttachments.length ? effectiveSelfStudyPortfolioEvidenceAttachments : generatedPortfolioEvidenceAttachments
  const generatedPortfolioGateStatusSummary = buildSelfStudyPortfolioGateStatusSummary(generatedBasePortfolioCompletionGates, portfolioCompletionGates, effectiveSelfStudyPortfolioGateStatusImports)
  const portfolioGateStatusSummary = effectiveSelfStudyPortfolioGateStatusSummary.length ? effectiveSelfStudyPortfolioGateStatusSummary : generatedPortfolioGateStatusSummary
  const generatedPortfolioBriefs = buildSelfStudyPortfolioBriefs(curriculumModules, pacingPlan, portfolioMilestones, portfolioCompletionGates)
  const portfolioBriefs = effectiveSelfStudyPortfolioBriefs.length ? effectiveSelfStudyPortfolioBriefs : generatedPortfolioBriefs
  const generatedPortfolioReviewIndex = buildSelfStudyPortfolioReviewIndex(portfolioMilestones, portfolioBriefs, portfolioGateStatusSummary, portfolioReferencePackets, portfolioSourceExcerptPackets, portfolioExportManifests)
  const portfolioReviewIndex = effectiveSelfStudyPortfolioReviewIndex.length ? effectiveSelfStudyPortfolioReviewIndex : generatedPortfolioReviewIndex
  const generatedPortfolioReviewerHandoff = buildSelfStudyPortfolioReviewerHandoff(portfolioReviewIndex)
  const portfolioReviewerHandoff = effectiveSelfStudyPortfolioReviewerHandoff.length ? effectiveSelfStudyPortfolioReviewerHandoff : generatedPortfolioReviewerHandoff
  const generatedPortfolioReviewerFeedbackTemplate = buildSelfStudyPortfolioReviewerFeedbackTemplate(portfolioReviewerHandoff, portfolioEvidenceAttachments)
  const portfolioReviewerFeedbackTemplate = effectiveSelfStudyPortfolioReviewerFeedbackTemplate.length ? effectiveSelfStudyPortfolioReviewerFeedbackTemplate : generatedPortfolioReviewerFeedbackTemplate
  const generatedPortfolioReviewerFeedbackSmokeFixture = buildSelfStudyPortfolioReviewerFeedbackSmokeFixture(portfolioReviewerFeedbackTemplate)
  const portfolioReviewerFeedbackSmokeFixture = effectiveSelfStudyPortfolioReviewerFeedbackSmokeFixture.length ? effectiveSelfStudyPortfolioReviewerFeedbackSmokeFixture : generatedPortfolioReviewerFeedbackSmokeFixture
  const generatedPortfolioRevisionQueue = buildSelfStudyPortfolioRevisionQueue(portfolioReviewerHandoff, effectiveSelfStudyPortfolioReviewerFeedbackImports)
  const portfolioRevisionQueue = effectiveSelfStudyPortfolioRevisionQueue.length ? effectiveSelfStudyPortfolioRevisionQueue : generatedPortfolioRevisionQueue
  const generatedPortfolioGateStatusSuggestions = buildSelfStudyPortfolioGateStatusSuggestions(portfolioReviewerHandoff, effectiveSelfStudyPortfolioReviewerFeedbackImports, portfolioCompletionGates, portfolioRevisionQueue, portfolioEvidenceAttachments)
  const portfolioGateStatusSuggestions = effectiveSelfStudyPortfolioGateStatusSuggestions.length ? effectiveSelfStudyPortfolioGateStatusSuggestions : generatedPortfolioGateStatusSuggestions
  const portfolioSmokeRevisionQueue = buildSelfStudyPortfolioRevisionQueue(portfolioReviewerHandoff, portfolioReviewerFeedbackSmokeFixture)
  const portfolioSmokeGateStatusSuggestions = buildSelfStudyPortfolioGateStatusSuggestions(portfolioReviewerHandoff, portfolioReviewerFeedbackSmokeFixture, portfolioCompletionGates, portfolioSmokeRevisionQueue, portfolioEvidenceAttachments)
  const generatedPortfolioReviewWorkflow = buildSelfStudyPortfolioReviewWorkflow({ reviewIndex: portfolioReviewIndex, evidenceAttachments: portfolioEvidenceAttachments, feedbackTemplates: portfolioReviewerFeedbackTemplate, revisionQueue: portfolioRevisionQueue, gateStatusSuggestions: portfolioGateStatusSuggestions, gateStatusTemplate: portfolioGateStatusTemplate, smokeFixture: portfolioReviewerFeedbackSmokeFixture })
  const portfolioReviewWorkflow = effectiveSelfStudyPortfolioReviewWorkflow.length ? effectiveSelfStudyPortfolioReviewWorkflow : generatedPortfolioReviewWorkflow
  const generatedPortfolioReviewAgendas = buildSelfStudyPortfolioReviewAgendas(portfolioReviewWorkflow, portfolioReviewerHandoff)
  const portfolioReviewAgendas = effectiveSelfStudyPortfolioReviewAgendas.length ? effectiveSelfStudyPortfolioReviewAgendas : generatedPortfolioReviewAgendas
  const generatedPortfolioReviewDashboard = buildSelfStudyPortfolioReviewDashboard({ reviewIndex: portfolioReviewIndex, reviewWorkflow: portfolioReviewWorkflow, reviewAgendas: portfolioReviewAgendas, evidenceAttachments: portfolioEvidenceAttachments, revisionQueue: portfolioRevisionQueue, gateStatusSuggestions: portfolioGateStatusSuggestions, gateStatusSummary: portfolioGateStatusSummary })
  const portfolioReviewDashboard = effectiveSelfStudyPortfolioReviewDashboard.length ? effectiveSelfStudyPortfolioReviewDashboard : generatedPortfolioReviewDashboard
  const generatedPortfolioDecisionPackets = buildSelfStudyPortfolioDecisionPackets({ reviewDashboard: portfolioReviewDashboard, reviewAgendas: portfolioReviewAgendas, reviewerHandoffs: portfolioReviewerHandoff, feedbackTemplates: portfolioReviewerFeedbackTemplate, gateStatusSuggestions: portfolioGateStatusSuggestions })
  const portfolioDecisionPackets = effectiveSelfStudyPortfolioDecisionPackets.length ? effectiveSelfStudyPortfolioDecisionPackets : generatedPortfolioDecisionPackets
  const generatedPortfolioCompletionChecklists = buildSelfStudyPortfolioCompletionChecklists({ decisionPackets: portfolioDecisionPackets, reviewDashboard: portfolioReviewDashboard, revisionQueue: portfolioRevisionQueue })
  const portfolioCompletionChecklists = effectiveSelfStudyPortfolioCompletionChecklists.length ? effectiveSelfStudyPortfolioCompletionChecklists : generatedPortfolioCompletionChecklists
  const generatedPortfolioArchiveManifests = buildSelfStudyPortfolioArchiveManifests({ decisionPackets: portfolioDecisionPackets, completionChecklists: portfolioCompletionChecklists, portfolioBriefs, referencePackets: portfolioReferencePackets, sourceExcerptPackets: portfolioSourceExcerptPackets, exportManifests: portfolioExportManifests, gateStatusSummary: portfolioGateStatusSummary })
  const portfolioArchiveManifests = effectiveSelfStudyPortfolioArchiveManifests.length ? effectiveSelfStudyPortfolioArchiveManifests : generatedPortfolioArchiveManifests
  const generatedPortfolioArchiveAudit = buildSelfStudyPortfolioArchiveAudit(portfolioArchiveManifests)
  const portfolioArchiveAudit = effectiveSelfStudyPortfolioArchiveAudit.length ? effectiveSelfStudyPortfolioArchiveAudit : generatedPortfolioArchiveAudit
  const generatedPortfolioOperationsSummary = buildSelfStudyPortfolioOperationsSummary({ reviewDashboard: portfolioReviewDashboard, decisionPackets: portfolioDecisionPackets, completionChecklists: portfolioCompletionChecklists, archiveManifests: portfolioArchiveManifests, archiveAudit: portfolioArchiveAudit })
  const portfolioOperationsSummary = effectiveSelfStudyPortfolioOperationsSummary.length ? effectiveSelfStudyPortfolioOperationsSummary : generatedPortfolioOperationsSummary
  const generatedPortfolioCollaboratorHandoffPackets = buildSelfStudyPortfolioCollaboratorHandoffPackets({ operationsSummary: portfolioOperationsSummary, reviewerHandoffs: portfolioReviewerHandoff })
  const portfolioCollaboratorHandoffPackets = effectiveSelfStudyPortfolioCollaboratorHandoffPackets.length ? effectiveSelfStudyPortfolioCollaboratorHandoffPackets : generatedPortfolioCollaboratorHandoffPackets
  const generatedPortfolioCollaboratorResponseIntakeTemplate = buildSelfStudyPortfolioCollaboratorResponseIntakeTemplate({
    collaboratorHandoffPackets: portfolioCollaboratorHandoffPackets,
    reviewerFeedbackTemplates: portfolioReviewerFeedbackTemplate,
    decisionPackets: portfolioDecisionPackets,
    completionChecklists: portfolioCompletionChecklists,
  })
  const portfolioCollaboratorResponseIntakeTemplate = effectiveSelfStudyPortfolioCollaboratorResponseIntakeTemplate.length ? effectiveSelfStudyPortfolioCollaboratorResponseIntakeTemplate : generatedPortfolioCollaboratorResponseIntakeTemplate
  const generatedPortfolioCollaboratorResponseReconciliation = buildSelfStudyPortfolioCollaboratorResponseReconciliation({
    intakeTemplates: portfolioCollaboratorResponseIntakeTemplate,
    feedbackImports: effectiveSelfStudyPortfolioReviewerFeedbackImports,
    decisionPackets: portfolioDecisionPackets,
    completionChecklists: portfolioCompletionChecklists,
  })
  const portfolioCollaboratorResponseReconciliation = effectiveSelfStudyPortfolioCollaboratorResponseReconciliation.length ? effectiveSelfStudyPortfolioCollaboratorResponseReconciliation : generatedPortfolioCollaboratorResponseReconciliation
  const generatedPortfolioCollaboratorResponseActionQueue = buildSelfStudyPortfolioCollaboratorResponseActionQueue(portfolioCollaboratorResponseReconciliation)
  const portfolioCollaboratorResponseActionQueue = effectiveSelfStudyPortfolioCollaboratorResponseActionQueue.length ? effectiveSelfStudyPortfolioCollaboratorResponseActionQueue : generatedPortfolioCollaboratorResponseActionQueue
  const generatedPortfolioCollaboratorResponseActionProgress = buildSelfStudyPortfolioCollaboratorResponseActionProgress(portfolioCollaboratorResponseActionQueue)
  const portfolioCollaboratorResponseActionProgress = effectiveSelfStudyPortfolioCollaboratorResponseActionProgress.length ? effectiveSelfStudyPortfolioCollaboratorResponseActionProgress : generatedPortfolioCollaboratorResponseActionProgress
  const generatedPortfolioCollaboratorResponseReviewBriefs = buildSelfStudyPortfolioCollaboratorResponseReviewBriefs({
    actionProgress: portfolioCollaboratorResponseActionProgress,
    reconciliationRows: portfolioCollaboratorResponseReconciliation,
    handoffPackets: portfolioCollaboratorHandoffPackets,
  })
  const portfolioCollaboratorResponseReviewBriefs = effectiveSelfStudyPortfolioCollaboratorResponseReviewBriefs.length ? effectiveSelfStudyPortfolioCollaboratorResponseReviewBriefs : generatedPortfolioCollaboratorResponseReviewBriefs
  const generatedPortfolioCollaboratorResponseDistributionManifests = buildSelfStudyPortfolioCollaboratorResponseDistributionManifests(portfolioCollaboratorResponseReviewBriefs)
  const portfolioCollaboratorResponseDistributionManifests = effectiveSelfStudyPortfolioCollaboratorResponseDistributionManifests.length ? effectiveSelfStudyPortfolioCollaboratorResponseDistributionManifests : generatedPortfolioCollaboratorResponseDistributionManifests
  const generatedPortfolioCollaboratorResponseDistributionStatus = buildSelfStudyPortfolioCollaboratorResponseDistributionStatus(portfolioCollaboratorResponseDistributionManifests, effectiveSelfStudyPortfolioCollaboratorResponseSendLogImports)
  const portfolioCollaboratorResponseDistributionStatus = effectiveSelfStudyPortfolioCollaboratorResponseDistributionStatus.length ? effectiveSelfStudyPortfolioCollaboratorResponseDistributionStatus : generatedPortfolioCollaboratorResponseDistributionStatus
  const generatedPortfolioCollaboratorResponseSendLogTemplate = buildSelfStudyPortfolioCollaboratorResponseSendLogTemplate(portfolioCollaboratorResponseDistributionStatus)
  const portfolioCollaboratorResponseSendLogTemplate = effectiveSelfStudyPortfolioCollaboratorResponseSendLogTemplate.length ? effectiveSelfStudyPortfolioCollaboratorResponseSendLogTemplate : generatedPortfolioCollaboratorResponseSendLogTemplate
  const generatedPortfolioCollaboratorResponseReminderQueue = buildSelfStudyPortfolioCollaboratorResponseReminderQueue(portfolioCollaboratorResponseDistributionStatus, portfolioCollaboratorResponseDistributionManifests)
  const portfolioCollaboratorResponseReminderQueue = effectiveSelfStudyPortfolioCollaboratorResponseReminderQueue.length ? effectiveSelfStudyPortfolioCollaboratorResponseReminderQueue : generatedPortfolioCollaboratorResponseReminderQueue
  const generatedPortfolioCollaboratorResponseEvidenceRegister = buildSelfStudyPortfolioCollaboratorResponseEvidenceRegister(portfolioCollaboratorResponseDistributionStatus, portfolioCollaboratorResponseReminderQueue)
  const portfolioCollaboratorResponseEvidenceRegister = effectiveSelfStudyPortfolioCollaboratorResponseEvidenceRegister.length ? effectiveSelfStudyPortfolioCollaboratorResponseEvidenceRegister : generatedPortfolioCollaboratorResponseEvidenceRegister
  const progressLedgerWithPortfolioGateAnnotations = annotateSelfStudyProgressLedgerWithPortfolioGates(progressLedger, portfolioMilestones, portfolioCompletionGates)
  const curriculumModulesWithSourceIds = curriculumModules.filter((module) => module.source_ids?.length).length
  const curriculumModulesWithAssignments = curriculumModules.filter((module) => module.assignment_ids?.length).length
  const curriculumModulesWithReadings = curriculumModules.filter((module) => module.reading_ids?.length).length
  const curriculumModulesWithSchedule = curriculumModules.filter((module) => module.schedule_ids?.length).length
  const curriculumModulesWithComparison = curriculumModules.filter((module) => module.comparison_set?.length).length
  const curriculumModulesWithUnknowns = curriculumModules.filter((module) => module.missing_evidence_warnings?.length).length
  const curriculumModulesWithConfidence = curriculumModules.filter((module) =>
    Number.isFinite(module.module_confidence_score)
      && ['high', 'medium', 'low'].includes(module.module_confidence_band)
      && module.module_confidence_factors
      && module.module_confidence_explanation?.selection_reason
      && module.module_confidence_explanation?.strengths?.length
  ).length
  const curriculumModulesWithOrderingRationale = curriculumModules.filter((module) =>
    Number.isInteger(module.module_ordering_rationale?.global_rank)
      && Number.isInteger(module.module_ordering_rationale?.track_rank)
      && ['track_quota', 'global_backfill'].includes(module.module_ordering_rationale?.selection_phase)
      && module.module_ordering_rationale?.ordering_basis
      && module.module_ordering_rationale?.selected_reason
      && Array.isArray(module.module_ordering_rationale?.near_miss_candidates)
  ).length
  const curriculumModuleIds = new Set(curriculumModules.map((module) => module.module_id).filter(Boolean))
  const curriculumModulesWithDependencyMaps = curriculumModules.filter((module) =>
    ['foundation', 'intermediate_practice', 'advanced_synthesis'].includes(module.module_dependency_map?.dependency_stage)
      && Array.isArray(module.module_dependency_map?.prerequisite_module_ids)
      && Array.isArray(module.module_dependency_map?.enables_module_ids)
      && module.module_dependency_map?.dependency_basis?.length
      && module.module_dependency_map?.dependency_note
      && module.module_dependency_map.prerequisite_module_ids.every((id) => curriculumModuleIds.has(id))
      && module.module_dependency_map.enables_module_ids.every((id) => curriculumModuleIds.has(id))
  ).length
  const curriculumModuleReferenceErrors = curriculumModules.filter((module) =>
    !module.module_id
      || !module.source_ids?.length
      || module.source_ids?.some((id) => !sourceIds.has(id))
      || !module.assignment_ids?.length
      || module.assignment_ids?.some((id) => !assignmentIds.has(id))
      || module.reading_ids?.some((id) => !readingIds.has(id))
      || module.schedule_ids?.some((id) => !effectiveScheduleRowIds.has(id))
      || module.comparison_set?.some((comparison) => comparison.student_work_id && !studentWorkIds.has(comparison.student_work_id))
      || !module.practice_instruction?.assignment_id
      || module.practice_instruction?.assignment_id && !assignmentIds.has(module.practice_instruction.assignment_id)
      || !Number.isFinite(module.module_confidence_score)
      || !['high', 'medium', 'low'].includes(module.module_confidence_band)
      || !module.module_confidence_explanation?.selection_reason
      || !Number.isInteger(module.module_ordering_rationale?.global_rank)
      || !Number.isInteger(module.module_ordering_rationale?.track_rank)
      || !['track_quota', 'global_backfill'].includes(module.module_ordering_rationale?.selection_phase)
      || !module.module_ordering_rationale?.selected_reason
      || !['foundation', 'intermediate_practice', 'advanced_synthesis'].includes(module.module_dependency_map?.dependency_stage)
      || !Array.isArray(module.module_dependency_map?.prerequisite_module_ids)
      || !Array.isArray(module.module_dependency_map?.enables_module_ids)
      || !module.module_dependency_map?.dependency_basis?.length
      || module.module_dependency_map.prerequisite_module_ids.some((id) => !curriculumModuleIds.has(id))
      || module.module_dependency_map.enables_module_ids.some((id) => !curriculumModuleIds.has(id))
  )
  const pacingPlanReferenceErrors = pacingPlan.filter((row) =>
    !row.pacing_id
      || !Number.isInteger(row.week_number)
      || !curriculumModuleIds.has(row.module_id)
      || row.assignment_id && !assignmentIds.has(row.assignment_id)
      || row.reading_ids?.some((id) => !readingIds.has(id))
      || row.schedule_ids?.some((id) => !effectiveScheduleRowIds.has(id))
      || row.prerequisite_module_ids?.some((id) => !curriculumModuleIds.has(id))
      || !row.focus
      || !row.expected_output
      || !row.critique_checkpoint
      || !row.source_ids?.length
      || row.source_ids.some((id) => !sourceIds.has(id))
  )
  const pacingRowsWithAssignments = pacingPlan.filter((row) => row.assignment_id).length
  const pacingRowsWithReadings = pacingPlan.filter((row) => row.reading_ids?.length).length
  const pacingRowsWithPrerequisites = pacingPlan.filter((row) => row.prerequisite_module_ids?.length).length
  const pacingRowsWithWorkload = pacingPlan.filter((row) =>
    Number.isFinite(row.workload_estimate?.estimated_hours)
      && ['light', 'medium', 'heavy'].includes(row.workload_estimate?.workload_band)
      && row.workload_estimate?.estimate_basis?.length
  ).length
  const pacingModuleCoverage = new Set(pacingPlan.map((row) => row.module_id)).size
  const pacingIds = new Set(pacingPlan.map((row) => row.pacing_id))
  const progressLedgerErrors = progressLedger.filter((entry) =>
    !entry.ledger_id
      || !entry.pacing_id
      || !pacingIds.has(entry.pacing_id)
      || !curriculumModuleIds.has(entry.module_id)
      || !Number.isInteger(entry.week_number)
      || entry.assignment_id && !assignmentIds.has(entry.assignment_id)
      || entry.reading_ids?.some((id) => !readingIds.has(id))
      || !entry.output_checklist?.length
      || !entry.critique_revision_log?.length
      || !entry.evidence_warning_log
      || !Array.isArray(entry.unresolved_evidence_warnings)
      || !entry.source_ids?.length
      || entry.source_ids.some((id) => !sourceIds.has(id))
  )
  const progressLedgerGeneratedMismatch = effectiveSelfStudyProgressLedger.length > 0 && effectiveSelfStudyProgressLedger.length !== generatedProgressLedger.length
  const progressLedgerIds = new Set(progressLedger.map((entry) => entry.ledger_id))
  const pacingProfileErrors = pacingProfiles.filter((profile) =>
    !['compressed', 'standard', 'slow'].includes(profile.profile_id)
      || !Number.isFinite(profile.estimated_total_hours)
      || !Number.isInteger(profile.estimated_calendar_weeks)
      || !profile.weekly_groups?.length
      || profile.weekly_groups.some((group) =>
        !Number.isInteger(group.calendar_week)
          || !group.pacing_ids?.length
          || group.pacing_ids.some((id) => !pacingIds.has(id))
          || group.module_ids?.some((id) => !curriculumModuleIds.has(id))
          || !Number.isFinite(group.estimated_hours)
      )
  )
  const portfolioMilestoneErrors = portfolioMilestones.filter((milestone) =>
    !milestone.milestone_id
      || !['foundation', 'intermediate_practice', 'advanced_synthesis'].includes(milestone.milestone_stage)
      || !milestone.module_ids?.length
      || milestone.module_ids.some((id) => !curriculumModuleIds.has(id))
      || !milestone.pacing_ids?.length
      || milestone.pacing_ids.some((id) => !pacingIds.has(id))
      || milestone.assignment_ids?.some((id) => !assignmentIds.has(id))
      || milestone.reading_ids?.some((id) => !readingIds.has(id))
      || !milestone.week_range?.length
      || !Number.isFinite(milestone.estimated_hours)
      || !milestone.portfolio_outputs?.length
      || !milestone.review_prompts?.length
      || !milestone.source_ids?.length
      || milestone.source_ids.some((id) => !sourceIds.has(id))
  )
  const curriculumGeneratedMismatch = effectiveSelfStudyModules.length > 0 && effectiveSelfStudyModules.length !== generatedCurriculumModules.length
  const pacingGeneratedMismatch = effectiveSelfStudyPacingPlan.length > 0 && effectiveSelfStudyPacingPlan.length !== generatedPacingPlan.length
  const pacingProfilesGeneratedMismatch = effectiveSelfStudyPacingProfiles.length > 0 && effectiveSelfStudyPacingProfiles.length !== generatedPacingProfiles.length
  const portfolioMilestonesGeneratedMismatch = effectiveSelfStudyPortfolioMilestones.length > 0 && effectiveSelfStudyPortfolioMilestones.length !== generatedPortfolioMilestones.length
  const portfolioMilestoneIds = new Set(portfolioMilestones.map((milestone) => milestone.milestone_id))
  const portfolioBriefErrors = portfolioBriefs.filter((brief) =>
    !brief.brief_id
      || !brief.milestone_id
      || !portfolioMilestoneIds.has(brief.milestone_id)
      || !brief.output_path
      || !brief.title
      || !brief.review_package?.length
      || !brief.review_prompts?.length
      || !brief.source_ids?.length
      || brief.source_ids.some((id) => !sourceIds.has(id))
      || !brief.markdown?.includes('# ')
      || !brief.markdown?.includes('## Review Package')
      || !brief.markdown?.includes('## Evidence Boundary')
  )
  const portfolioBriefsGeneratedMismatch = effectiveSelfStudyPortfolioBriefs.length > 0 && effectiveSelfStudyPortfolioBriefs.length !== generatedPortfolioBriefs.length
  const facultyPortfolioExampleIds = new Set(facultyPortfolioExamples.map((example) => example.example_id))
  const portfolioReferencePacketErrors = portfolioReferencePackets.filter((packet) =>
    !packet.packet_id
      || !packet.milestone_id
      || !portfolioMilestoneIds.has(packet.milestone_id)
      || !packet.reference_groups?.length
      || !packet.reference_groups.every((group) => group.relationship_label && group.boundary_note && Array.isArray(group.items))
      || packet.reference_groups.flatMap((group) => group.items ?? []).some((item) =>
        !item.reference_id
          || !item.relationship_label
          || !item.url
          || item.source_ids?.some((id) => !sourceIds.has(id))
          || item.student_work_id && !studentWorkIds.has(item.student_work_id)
          || item.faculty_portfolio_example_id && !facultyPortfolioExampleIds.has(item.faculty_portfolio_example_id)
      )
  )
  const portfolioReferencePacketsGeneratedMismatch = effectiveSelfStudyPortfolioReferencePackets.length > 0 && effectiveSelfStudyPortfolioReferencePackets.length !== generatedPortfolioReferencePackets.length
  const portfolioBriefIds = new Set(portfolioBriefs.map((brief) => brief.brief_id))
  const portfolioReferencePacketIds = new Set(portfolioReferencePackets.map((packet) => packet.packet_id))
  const portfolioSourceExcerptPacketIds = new Set(portfolioSourceExcerptPackets.map((packet) => packet.packet_id))
  const portfolioSourceExcerptPacketErrors = portfolioSourceExcerptPackets.filter((packet) =>
    !packet.packet_id
      || !packet.milestone_id
      || !portfolioMilestoneIds.has(packet.milestone_id)
      || !packet.excerpt_groups?.length
      || !packet.excerpt_groups.every((group) => group.group_id && group.evidence_role && Array.isArray(group.items))
      || packet.excerpt_groups.flatMap((group) => group.items ?? []).some((item) =>
        !item.excerpt_id
          || !item.excerpt_text
          || !item.evidence_role
          || !item.source_ids?.length
          || item.source_ids.some((sourceId) => !sourceIds.has(sourceId))
          || item.assignment_id && !assignmentIds.has(item.assignment_id)
          || item.reading_id && !readingIds.has(item.reading_id)
          || item.schedule_id && !effectiveScheduleRowIds.has(item.schedule_id)
      )
      || !packet.source_ids?.length
      || packet.source_ids.some((sourceId) => !sourceIds.has(sourceId))
  )
  const portfolioSourceExcerptPacketsGeneratedMismatch = effectiveSelfStudyPortfolioSourceExcerptPackets.length > 0 && effectiveSelfStudyPortfolioSourceExcerptPackets.length !== generatedPortfolioSourceExcerptPackets.length
  const portfolioExportManifestErrors = portfolioExportManifests.filter((manifest) =>
    !manifest.manifest_id
      || !manifest.milestone_id
      || !portfolioMilestoneIds.has(manifest.milestone_id)
      || !manifest.brief_id
      || !portfolioBriefIds.has(manifest.brief_id)
      || !manifest.reference_packet_id
      || !portfolioReferencePacketIds.has(manifest.reference_packet_id)
      || !manifest.source_excerpt_packet_id
      || !portfolioSourceExcerptPacketIds.has(manifest.source_excerpt_packet_id)
      || !manifest.export_files?.length
      || !manifest.export_files.some((file) => file.file_role === 'portfolio_brief_markdown' && file.path)
      || !manifest.export_files.some((file) => file.file_role === 'reference_packet_jsonl_row' && file.path)
      || !manifest.export_files.some((file) => file.file_role === 'source_excerpt_packet_jsonl_row' && file.path)
      || !manifest.source_id_manifest?.length
      || manifest.source_id_manifest.some((sourceId) => !sourceIds.has(sourceId))
      || !manifest.print_packet_order?.length
      || !manifest.external_tool_payload?.milestone_id
      || manifest.external_tool_payload?.source_ids?.some((sourceId) => !sourceIds.has(sourceId))
  )
  const portfolioExportManifestsGeneratedMismatch = effectiveSelfStudyPortfolioExportManifests.length > 0 && effectiveSelfStudyPortfolioExportManifests.length !== generatedPortfolioExportManifests.length
  const portfolioExportManifestIds = new Set(portfolioExportManifests.map((manifest) => manifest.manifest_id))
  const portfolioProgressRollupErrors = portfolioProgressRollups.filter((rollup) =>
    !rollup.rollup_id
      || !rollup.milestone_id
      || !portfolioMilestoneIds.has(rollup.milestone_id)
      || !rollup.export_manifest_id
      || !portfolioExportManifestIds.has(rollup.export_manifest_id)
      || !rollup.ledger_ids?.length
      || rollup.ledger_ids.some((id) => !progressLedgerIds.has(id))
      || rollup.pacing_ids?.some((id) => !pacingIds.has(id))
      || rollup.module_ids?.some((id) => !curriculumModuleIds.has(id))
      || !rollup.portfolio_output_rollup?.length
      || !rollup.critique_revision_rollup?.length
      || !rollup.evidence_warning_rollup
      || !Number.isFinite(rollup.rollup_totals?.ledger_rows)
  )
  const portfolioProgressRollupsGeneratedMismatch = effectiveSelfStudyPortfolioProgressRollups.length > 0 && effectiveSelfStudyPortfolioProgressRollups.length !== generatedPortfolioProgressRollups.length
  const portfolioProgressRollupIds = new Set(portfolioProgressRollups.map((rollup) => rollup.rollup_id))
  const portfolioCompletionGateErrors = portfolioCompletionGates.filter((gate) =>
    !gate.gate_id
      || !gate.milestone_id
      || !portfolioMilestoneIds.has(gate.milestone_id)
      || !gate.progress_rollup_id
      || !portfolioProgressRollupIds.has(gate.progress_rollup_id)
      || !gate.export_manifest_id
      || !portfolioExportManifestIds.has(gate.export_manifest_id)
      || !['not_ready_template', 'ready_for_review'].includes(gate.current_readiness_status)
      || !gate.gate_checks?.length
      || gate.gate_checks.some((check) => !check.check_id || !check.label || !check.required_evidence?.length || !['pending', 'satisfied'].includes(check.current_status))
      || gate.current_readiness_status === 'not_ready_template' && !gate.blocking_conditions?.length
      || !gate.ready_when?.length
  )
  const portfolioCompletionGatesGeneratedMismatch = effectiveSelfStudyPortfolioCompletionGates.length > 0 && effectiveSelfStudyPortfolioCompletionGates.length !== generatedPortfolioCompletionGates.length
  const portfolioCompletionGateIds = new Set(portfolioCompletionGates.map((gate) => gate.gate_id))
  const portfolioCompletionGateCheckIds = new Set(portfolioCompletionGates.flatMap((gate) => (gate.gate_checks ?? []).map((check) => check.check_id)))
  const validEvidenceAttachmentRoles = new Set(['final_artifact', 'process_evidence', 'critique_notes', 'revision_proof', 'source_boundary_memo', 'export_package_file'])
  const validEvidenceAttachmentStatuses = new Set(['missing', 'attached'])
  const progressLedgerCritiqueLogIds = new Set(progressLedger.flatMap((entry) => (entry.critique_revision_log ?? []).map((log) => log.log_id)))
  const portfolioEvidenceAttachmentErrors = portfolioEvidenceAttachments.filter((manifest) =>
    !manifest.attachment_manifest_id
      || !manifest.milestone_id
      || !portfolioMilestoneIds.has(manifest.milestone_id)
      || !manifest.progress_rollup_id
      || !portfolioProgressRollupIds.has(manifest.progress_rollup_id)
      || !manifest.completion_gate_id
      || !portfolioCompletionGateIds.has(manifest.completion_gate_id)
      || !manifest.export_manifest_id
      || !portfolioExportManifestIds.has(manifest.export_manifest_id)
      || !manifest.attachment_slots?.length
      || new Set(manifest.attachment_slots.map((slot) => slot.slot_id)).size !== manifest.attachment_slots.length
      || manifest.attachment_slots.some((slot) =>
        !slot.slot_id
          || !validEvidenceAttachmentRoles.has(slot.slot_role)
          || !slot.required_for_gate_check_id
          || !portfolioCompletionGateCheckIds.has(slot.required_for_gate_check_id)
          || !validEvidenceAttachmentStatuses.has(slot.attachment_status)
          || slot.ledger_id && !progressLedgerIds.has(slot.ledger_id)
          || slot.critique_log_id && !progressLedgerCritiqueLogIds.has(slot.critique_log_id)
          || slot.attachment_status === 'attached' && !slot.local_path && !slot.attachment_uri
          || !slot.reviewer_evidence_ref
      )
      || !manifest.gate_check_coverage?.length
      || manifest.gate_check_coverage.some((coverage) => !coverage.check_id || !portfolioCompletionGateCheckIds.has(coverage.check_id) || !Array.isArray(coverage.slot_ids) || coverage.slot_ids.length === 0)
      || !Number.isInteger(manifest.manifest_totals?.slots)
      || manifest.manifest_totals.slots !== manifest.attachment_slots.length
      || !manifest.import_instructions?.length
  )
  const portfolioEvidenceAttachmentsGeneratedMismatch = effectiveSelfStudyPortfolioEvidenceAttachments.length > 0 && effectiveSelfStudyPortfolioEvidenceAttachments.length !== generatedPortfolioEvidenceAttachments.length
  const portfolioEvidenceAttachmentManifestIds = new Set(portfolioEvidenceAttachments.map((manifest) => manifest.attachment_manifest_id))
  const portfolioEvidenceAttachmentSlotIds = new Set(portfolioEvidenceAttachments.flatMap((manifest) => (manifest.attachment_slots ?? []).map((slot) => slot.slot_id)))
  const portfolioEvidenceAttachmentRefs = new Set(portfolioEvidenceAttachments.flatMap((manifest) => (manifest.attachment_slots ?? []).flatMap((slot) => [slot.slot_id, slot.reviewer_evidence_ref].filter(Boolean))))
  const portfolioGateStatusTemplateErrors = portfolioGateStatusTemplate.filter((row) =>
    !row.import_id
      || !row.gate_id
      || !portfolioCompletionGateIds.has(row.gate_id)
      || !row.check_updates?.length
      || row.check_updates.some((update) => !update.check_id || !portfolioCompletionGateCheckIds.has(update.check_id) || !['pending', 'satisfied'].includes(update.current_status) || !Array.isArray(update.evidence_refs))
      || !row.import_instructions?.length
  )
  const portfolioGateStatusImportErrors = effectiveSelfStudyPortfolioGateStatusImports.filter((row) =>
    !row.import_id
      || !row.gate_id
      || !portfolioCompletionGateIds.has(row.gate_id)
      || !['not_ready_template', 'ready_for_review'].includes(row.target_readiness_status)
      || !row.check_updates?.length
      || row.check_updates.some((update) => !update.check_id || !portfolioCompletionGateCheckIds.has(update.check_id) || !['pending', 'satisfied'].includes(update.current_status) || !Array.isArray(update.evidence_refs))
      || row.target_readiness_status === 'ready_for_review' && row.check_updates.some((update) => update.current_status !== 'satisfied')
  )
  const portfolioGateStatusSummaryErrors = portfolioGateStatusSummary.filter((summary) =>
    !summary.summary_id
      || !summary.gate_id
      || !portfolioCompletionGateIds.has(summary.gate_id)
      || !summary.milestone_id
      || !portfolioMilestoneIds.has(summary.milestone_id)
      || !['not_ready_template', 'ready_for_review'].includes(summary.readiness_after)
      || !Array.isArray(summary.check_summaries)
      || !Number.isInteger(summary.satisfied_check_count)
      || !Number.isInteger(summary.pending_check_count)
      || !summary.next_action
      || summary.check_summaries.some((check) => !check.check_id || !portfolioCompletionGateCheckIds.has(check.check_id) || !['pending', 'satisfied'].includes(check.after_status))
  )
  const portfolioGateStatusSummaryIds = new Set(portfolioGateStatusSummary.map((summary) => summary.summary_id))
  const validPortfolioReviewBlockerTypes = new Set(['missing_outputs', 'missing_critique_revisions', 'unresolved_evidence_warnings', 'missing_export_package', 'other_blocker'])
  const portfolioReviewIndexErrors = portfolioReviewIndex.filter((row) =>
    !row.index_id
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !['not_ready_template', 'ready_for_review'].includes(row.readiness_status)
      || !['not_ready_template', 'ready_for_review'].includes(row.dashboard_filters?.readiness)
      || !['foundation', 'intermediate_practice', 'advanced_synthesis'].includes(row.dashboard_filters?.stage)
      || !['import_applied', 'no_import'].includes(row.dashboard_filters?.import_state)
      || !Array.isArray(row.dashboard_filters?.blocker_types)
      || row.dashboard_filters.blocker_types.some((type) => !validPortfolioReviewBlockerTypes.has(type))
      || !['small', 'medium', 'large', 'unknown'].includes(row.dashboard_filters?.workload_band)
      || !['complete', 'incomplete'].includes(row.dashboard_filters?.artifact_completeness)
      || !['ready', 'blocked'].includes(row.dashboard_groups?.readiness_group)
      || !['foundation', 'intermediate_practice', 'advanced_synthesis'].includes(row.dashboard_groups?.stage_group)
      || !['learner_updated', 'template_only'].includes(row.dashboard_groups?.import_group)
      || !row.dashboard_groups?.blocker_group
      || !row.linked_artifacts?.portfolio_brief?.brief_id
      || !portfolioBriefIds.has(row.linked_artifacts.portfolio_brief.brief_id)
      || !row.linked_artifacts.portfolio_brief.path
      || !row.linked_artifacts?.gate_status_summary?.summary_id
      || !portfolioGateStatusSummaryIds.has(row.linked_artifacts.gate_status_summary.summary_id)
      || !row.linked_artifacts.gate_status_summary.path
      || !row.linked_artifacts?.source_excerpt_packet?.packet_id
      || !portfolioSourceExcerptPacketIds.has(row.linked_artifacts.source_excerpt_packet.packet_id)
      || !row.linked_artifacts.source_excerpt_packet.path
      || !row.linked_artifacts?.reference_packet?.packet_id
      || !portfolioReferencePacketIds.has(row.linked_artifacts.reference_packet.packet_id)
      || !row.linked_artifacts.reference_packet.path
      || !row.linked_artifacts?.export_manifest?.manifest_id
      || !portfolioExportManifestIds.has(row.linked_artifacts.export_manifest.manifest_id)
      || !row.linked_artifacts.export_manifest.path
      || !row.primary_next_action
  )
  const portfolioReviewIndexIds = new Set(portfolioReviewIndex.map((row) => row.index_id))
  const portfolioReviewerFeedbackTemplateIds = new Set(portfolioReviewerFeedbackTemplate.map((row) => row.feedback_id))
  const portfolioGateStatusTemplateImportIds = new Set(portfolioGateStatusTemplate.map((row) => row.import_id))
  const portfolioReviewerHandoffErrors = portfolioReviewerHandoff.filter((handoff) =>
    !handoff.handoff_id
      || !handoff.review_index_id
      || !portfolioReviewIndexIds.has(handoff.review_index_id)
      || !handoff.milestone_id
      || !portfolioMilestoneIds.has(handoff.milestone_id)
      || !['not_ready_template', 'ready_for_review'].includes(handoff.readiness_status)
      || !handoff.reviewer_context?.review_focus
      || !handoff.reviewer_context?.artifact_paths?.length
      || handoff.reviewer_context.artifact_paths.some((path) => !path)
      || !handoff.pre_review_checklist?.length
      || handoff.pre_review_checklist.some((item) => !item.item_id || !item.label || !item.required_artifact || item.status !== 'pending')
      || !handoff.live_review_actions?.length
      || !handoff.critique_prompts?.length
      || !handoff.post_review_followup?.length
      || !Array.isArray(handoff.blocking_focus)
  )
  const portfolioReviewerHandoffIds = new Set(portfolioReviewerHandoff.map((handoff) => handoff.handoff_id))
  const validFeedbackOutcomes = new Set(['not_reviewed', 'ready_for_review', 'needs_revision', 'blocked'])
  const validRevisionStatuses = new Set(['pending', 'resolved', 'deferred'])
  const validRevisionPriorities = new Set(['high', 'medium', 'low'])
  const portfolioReviewerFeedbackTemplateErrors = portfolioReviewerFeedbackTemplate.filter((row) =>
    !row.feedback_id
      || !row.handoff_id
      || !portfolioReviewerHandoffIds.has(row.handoff_id)
      || !row.review_index_id
      || !portfolioReviewIndexIds.has(row.review_index_id)
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !row.evidence_attachment_manifest_id
      || !portfolioEvidenceAttachmentManifestIds.has(row.evidence_attachment_manifest_id)
      || !validFeedbackOutcomes.has(row.outcome)
      || !Array.isArray(row.allowed_evidence_refs)
      || row.allowed_evidence_refs.some((ref) => !ref.slot_id || !portfolioEvidenceAttachmentSlotIds.has(ref.slot_id) || !ref.evidence_ref || !portfolioEvidenceAttachmentRefs.has(ref.evidence_ref))
      || !Array.isArray(row.status_updates)
      || row.status_updates.some((update) => !update.check_id || !portfolioCompletionGateCheckIds.has(update.check_id) || !Array.isArray(update.evidence_refs) || update.evidence_refs.some((ref) => !portfolioEvidenceAttachmentRefs.has(ref)))
      || !Array.isArray(row.revision_items)
      || row.revision_items.some((item) => !item.revision_id || !validPortfolioReviewBlockerTypes.has(item.blocker_type) || !validRevisionPriorities.has(item.priority) || !item.prompt || !Array.isArray(item.evidence_refs) || item.evidence_refs.some((ref) => !portfolioEvidenceAttachmentRefs.has(ref)) || !validRevisionStatuses.has(item.status))
      || !row.import_instructions?.length
  )
  const portfolioReviewerFeedbackImportErrors = effectiveSelfStudyPortfolioReviewerFeedbackImports.filter((row) =>
    !row.feedback_id
      || !row.handoff_id
      || !portfolioReviewerHandoffIds.has(row.handoff_id)
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !validFeedbackOutcomes.has(row.outcome)
      || row.status_updates?.some((update) => !update.check_id || !portfolioCompletionGateCheckIds.has(update.check_id) || !['pending', 'satisfied'].includes(update.current_status) || !Array.isArray(update.evidence_refs))
      || row.revision_items?.some((item) => !item.revision_id || !validPortfolioReviewBlockerTypes.has(item.blocker_type) || !validRevisionPriorities.has(item.priority) || !item.prompt || !Array.isArray(item.evidence_refs) || !validRevisionStatuses.has(item.status))
  )
  const portfolioReviewerFeedbackSmokeFixtureErrors = portfolioReviewerFeedbackSmokeFixture.filter((row) =>
    !row.feedback_id
      || !row.handoff_id
      || !portfolioReviewerHandoffIds.has(row.handoff_id)
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !row.evidence_attachment_manifest_id
      || !portfolioEvidenceAttachmentManifestIds.has(row.evidence_attachment_manifest_id)
      || row.outcome !== 'ready_for_review'
      || !row.status_updates?.length
      || row.status_updates.some((update) => !update.check_id || !portfolioCompletionGateCheckIds.has(update.check_id) || update.current_status !== 'satisfied' || !Array.isArray(update.evidence_refs) || update.evidence_refs.length === 0 || update.evidence_refs.some((ref) => !portfolioEvidenceAttachmentRefs.has(ref)))
      || !row.revision_items?.length
      || row.revision_items.some((item) => !item.revision_id || !validPortfolioReviewBlockerTypes.has(item.blocker_type) || !validRevisionPriorities.has(item.priority) || !item.prompt || !Array.isArray(item.evidence_refs) || item.evidence_refs.length === 0 || item.evidence_refs.some((ref) => !portfolioEvidenceAttachmentRefs.has(ref)) || item.status !== 'resolved')
  )
  const portfolioReviewerFeedbackSmokeFixtureIds = new Set(portfolioReviewerFeedbackSmokeFixture.map((row) => row.feedback_id))
  const portfolioRevisionQueueErrors = portfolioRevisionQueue.filter((row) =>
    !row.queue_id
      || !row.handoff_id
      || !portfolioReviewerHandoffIds.has(row.handoff_id)
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !validPortfolioReviewBlockerTypes.has(row.blocker_type)
      || !validRevisionPriorities.has(row.priority)
      || !validRevisionStatuses.has(row.status)
      || !row.revision_prompt
      || !Array.isArray(row.evidence_refs)
      || !['reviewer_feedback_import', 'generated_blocker_template'].includes(row.source)
      || !row.next_action
  )
  const portfolioRevisionQueueIds = new Set(portfolioRevisionQueue.map((row) => row.queue_id))
  const validGateStatusSuggestionStatuses = new Set(['awaiting_feedback', 'needs_more_evidence', 'partial_update', 'ready_to_copy'])
  const portfolioGateStatusSuggestionErrors = portfolioGateStatusSuggestions.filter((row) =>
    !row.suggestion_id
      || !row.handoff_id
      || !portfolioReviewerHandoffIds.has(row.handoff_id)
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !row.gate_id
      || !portfolioCompletionGateIds.has(row.gate_id)
      || !row.evidence_attachment_manifest_id
      || !portfolioEvidenceAttachmentManifestIds.has(row.evidence_attachment_manifest_id)
      || !Array.isArray(row.suggested_check_evidence_refs)
      || row.suggested_check_evidence_refs.some((entry) => !entry.check_id || !portfolioCompletionGateCheckIds.has(entry.check_id) || !Array.isArray(entry.suggested_evidence_refs) || entry.suggested_evidence_refs.some((ref) => !portfolioEvidenceAttachmentSlotIds.has(ref)))
      || !validGateStatusSuggestionStatuses.has(row.suggestion_status)
      || !Number.isInteger(row.imported_status_update_count)
      || !Number.isInteger(row.satisfied_check_count)
      || !Number.isInteger(row.satisfied_check_count_with_evidence)
      || !Number.isInteger(row.pending_check_count)
      || !Array.isArray(row.revision_queue_ids)
      || row.revision_queue_ids.some((id) => !portfolioRevisionQueueIds.has(id))
      || row.suggested_gate_status_import && (
        row.suggested_gate_status_import.gate_id !== row.gate_id
          || !['not_ready_template', 'ready_for_review'].includes(row.suggested_gate_status_import.target_readiness_status)
          || !row.suggested_gate_status_import.check_updates?.length
          || row.suggested_gate_status_import.check_updates.some((update) => !update.check_id || !portfolioCompletionGateCheckIds.has(update.check_id) || !['pending', 'satisfied'].includes(update.current_status) || !Array.isArray(update.evidence_refs) || update.evidence_refs.some((ref) => !portfolioEvidenceAttachmentRefs.has(ref)) || !Array.isArray(update.suggested_evidence_refs) || update.suggested_evidence_refs.some((ref) => !portfolioEvidenceAttachmentSlotIds.has(ref)))
          || row.suggested_gate_status_import.target_readiness_status === 'ready_for_review' && row.suggested_gate_status_import.check_updates.some((update) => update.current_status !== 'satisfied' || !update.evidence_refs.length)
      )
      || row.suggestion_status === 'ready_to_copy' && !row.suggested_gate_status_import
      || !row.next_action
  )
  const portfolioSmokeImportedRevisionQueue = portfolioSmokeRevisionQueue.filter((row) => row.source === 'reviewer_feedback_import')
  const portfolioSmokeRevisionQueueErrors = portfolioSmokeImportedRevisionQueue.filter((row) =>
    !row.queue_id
      || !row.handoff_id
      || !portfolioReviewerHandoffIds.has(row.handoff_id)
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || row.source !== 'reviewer_feedback_import'
      || row.status !== 'resolved'
      || !Array.isArray(row.evidence_refs)
      || row.evidence_refs.length === 0
      || row.evidence_refs.some((ref) => !portfolioEvidenceAttachmentRefs.has(ref))
  )
  const portfolioSmokeReadyGateSuggestions = portfolioSmokeGateStatusSuggestions.filter((row) => row.suggestion_status === 'ready_to_copy')
  const portfolioSmokeGateStatusSuggestionErrors = portfolioSmokeGateStatusSuggestions.filter((row) =>
    !row.suggestion_id
      || !row.handoff_id
      || !portfolioReviewerHandoffIds.has(row.handoff_id)
      || !row.gate_id
      || !portfolioCompletionGateIds.has(row.gate_id)
      || row.feedback_id && !row.suggested_gate_status_import
      || row.suggested_gate_status_import && (
        row.suggested_gate_status_import.target_readiness_status !== 'ready_for_review'
          || row.suggested_gate_status_import.check_updates.some((update) => update.current_status !== 'satisfied' || !update.evidence_refs?.length || update.evidence_refs.some((ref) => !portfolioEvidenceAttachmentRefs.has(ref)))
      )
  )
  const portfolioGateStatusSuggestionIds = new Set(portfolioGateStatusSuggestions.map((row) => row.suggestion_id))
  const portfolioReviewWorkflowIds = new Set(portfolioReviewWorkflow.map((row) => row.workflow_id))
  const validReviewWorkflowStepIds = ['open_review_packet', 'attach_evidence', 'capture_reviewer_feedback', 'regenerate_revision_queue', 'promote_gate_status', 'verify_ready_state']
  const portfolioReviewWorkflowErrors = portfolioReviewWorkflow.filter((workflow) =>
    !workflow.workflow_id
      || !workflow.milestone_id
      || !portfolioMilestoneIds.has(workflow.milestone_id)
      || !['not_ready_template', 'ready_for_review'].includes(workflow.readiness_status)
      || !workflow.linked_artifacts?.review_index_id
      || !portfolioReviewIndexIds.has(workflow.linked_artifacts.review_index_id)
      || !workflow.linked_artifacts.evidence_attachment_manifest_id
      || !portfolioEvidenceAttachmentManifestIds.has(workflow.linked_artifacts.evidence_attachment_manifest_id)
      || !workflow.linked_artifacts.reviewer_feedback_template_id
      || !portfolioReviewerFeedbackTemplateIds.has(workflow.linked_artifacts.reviewer_feedback_template_id)
      || workflow.linked_artifacts.reviewer_feedback_smoke_fixture_id && !portfolioReviewerFeedbackSmokeFixtureIds.has(workflow.linked_artifacts.reviewer_feedback_smoke_fixture_id)
      || !Array.isArray(workflow.linked_artifacts.revision_queue_ids)
      || workflow.linked_artifacts.revision_queue_ids.some((id) => !portfolioRevisionQueueIds.has(id))
      || !workflow.linked_artifacts.gate_status_suggestion_id
      || !portfolioGateStatusSuggestionIds.has(workflow.linked_artifacts.gate_status_suggestion_id)
      || !workflow.linked_artifacts.gate_status_template_import_id
      || !portfolioGateStatusTemplateImportIds.has(workflow.linked_artifacts.gate_status_template_import_id)
      || !workflow.ordered_steps?.length
      || workflow.ordered_steps.length !== validReviewWorkflowStepIds.length
      || workflow.ordered_steps.some((step, index) => step.step_number !== index + 1 || step.step_id !== validReviewWorkflowStepIds[index] || step.status !== 'not_started' || !step.action || !step.artifact_refs?.length)
      || !workflow.next_action
  )
  const portfolioReviewWorkflowGeneratedMismatch = effectiveSelfStudyPortfolioReviewWorkflow.length > 0 && effectiveSelfStudyPortfolioReviewWorkflow.length !== generatedPortfolioReviewWorkflow.length
  const validReviewAgendaBlockIds = ['setup', 'learner_presentation', 'constraint_and_source_check', 'critique_revision_review', 'evidence_gap_decision', 'feedback_capture', 'promotion_decision']
  const portfolioReviewAgendaErrors = portfolioReviewAgendas.filter((agenda) =>
    !agenda.agenda_id
      || !agenda.workflow_id
      || !portfolioReviewWorkflowIds.has(agenda.workflow_id)
      || !agenda.handoff_id
      || !portfolioReviewerHandoffIds.has(agenda.handoff_id)
      || !agenda.milestone_id
      || !portfolioMilestoneIds.has(agenda.milestone_id)
      || !Number.isInteger(agenda.target_duration_minutes)
      || agenda.target_duration_minutes <= 0
      || !agenda.required_artifacts?.length
      || !agenda.required_artifacts.includes(agenda.handoff_id)
      || !agenda.required_artifacts.some((artifact) => portfolioEvidenceAttachmentManifestIds.has(artifact))
      || !agenda.required_artifacts.some((artifact) => portfolioReviewerFeedbackTemplateIds.has(artifact))
      || !agenda.required_artifacts.some((artifact) => portfolioGateStatusSuggestionIds.has(artifact))
      || !Array.isArray(agenda.timed_blocks)
      || agenda.timed_blocks.length !== validReviewAgendaBlockIds.length
      || agenda.timed_blocks.reduce((sum, block) => sum + (block.duration_minutes ?? 0), 0) !== agenda.target_duration_minutes
      || agenda.timed_blocks.some((block, index) =>
        block.block_number !== index + 1
          || block.block_id !== validReviewAgendaBlockIds[index]
          || !Number.isInteger(block.duration_minutes)
          || block.duration_minutes <= 0
          || !block.objective
          || !block.prompts?.length
      )
      || !agenda.capture_outputs?.length
      || !agenda.post_session_actions?.length
      || !agenda.smoke_test_note
  )
  const portfolioReviewAgendasGeneratedMismatch = effectiveSelfStudyPortfolioReviewAgendas.length > 0 && effectiveSelfStudyPortfolioReviewAgendas.length !== generatedPortfolioReviewAgendas.length
  const portfolioReviewAgendaIds = new Set(portfolioReviewAgendas.map((agenda) => agenda.agenda_id))
  const portfolioReviewDashboardErrors = portfolioReviewDashboard.filter((row) =>
    !row.dashboard_id
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !row.review_index_id
      || !portfolioReviewIndexIds.has(row.review_index_id)
      || !row.workflow_id
      || !portfolioReviewWorkflowIds.has(row.workflow_id)
      || !row.agenda_id
      || !portfolioReviewAgendaIds.has(row.agenda_id)
      || !row.evidence_attachment_manifest_id
      || !portfolioEvidenceAttachmentManifestIds.has(row.evidence_attachment_manifest_id)
      || !row.gate_status_summary_id
      || !portfolioGateStatusSummaryIds.has(row.gate_status_summary_id)
      || !row.gate_status_suggestion_id
      || !portfolioGateStatusSuggestionIds.has(row.gate_status_suggestion_id)
      || !['ready_for_review', 'not_ready_template'].includes(row.readiness_status)
      || !['ready', 'blocked'].includes(row.dashboard_state)
      || !Number.isInteger(row.agenda_minutes)
      || row.agenda_minutes <= 0
      || !Number.isInteger(row.workflow_step_count)
      || row.workflow_step_count <= 0
      || !Number.isInteger(row.evidence_slots_total)
      || row.evidence_slots_total <= 0
      || !Number.isInteger(row.evidence_slots_missing)
      || row.evidence_slots_missing < 0
      || !Number.isInteger(row.revision_queue_pending)
      || row.revision_queue_pending < 0
      || !Number.isInteger(row.revision_queue_resolved)
      || row.revision_queue_resolved < 0
      || !['awaiting_feedback', 'needs_more_evidence', 'partial_update', 'ready_to_copy'].includes(row.gate_status_suggestion_status)
      || !row.primary_next_action
      || !row.rollup_links?.length
      || !row.rollup_links.some((link) => link.artifact_role === 'review_agenda' && link.artifact_id === row.agenda_id)
      || !row.rollup_links.some((link) => link.artifact_role === 'review_workflow' && link.artifact_id === row.workflow_id)
      || !row.rollup_links.some((link) => link.artifact_role === 'evidence_attachment_manifest' && link.artifact_id === row.evidence_attachment_manifest_id)
  )
  const portfolioReviewDashboardGeneratedMismatch = effectiveSelfStudyPortfolioReviewDashboard.length > 0 && effectiveSelfStudyPortfolioReviewDashboard.length !== generatedPortfolioReviewDashboard.length
  const portfolioReviewDashboardIds = new Set(portfolioReviewDashboard.map((row) => row.dashboard_id))
  const validDecisionPacketSectionIds = ['session_context', 'observed_strengths', 'revision_decisions', 'gate_status_decision', 'source_boundary_notes', 'followup_imports']
  const portfolioDecisionPacketErrors = portfolioDecisionPackets.filter((packet) =>
    !packet.decision_packet_id
      || !packet.milestone_id
      || !portfolioMilestoneIds.has(packet.milestone_id)
      || !packet.dashboard_id
      || !portfolioReviewDashboardIds.has(packet.dashboard_id)
      || !packet.agenda_id
      || !portfolioReviewAgendaIds.has(packet.agenda_id)
      || !packet.handoff_id
      || !portfolioReviewerHandoffIds.has(packet.handoff_id)
      || !packet.feedback_template_id
      || !portfolioReviewerFeedbackTemplateIds.has(packet.feedback_template_id)
      || !packet.gate_status_suggestion_id
      || !portfolioGateStatusSuggestionIds.has(packet.gate_status_suggestion_id)
      || !['ready_to_sign', 'blocked_until_review'].includes(packet.packet_status)
      || !Array.isArray(packet.note_sections)
      || packet.note_sections.length !== validDecisionPacketSectionIds.length
      || packet.note_sections.some((section, index) => section.section_number !== index + 1 || section.section_id !== validDecisionPacketSectionIds[index] || !section.prompt || !section.capture_field)
      || !packet.signature_fields?.length
      || packet.signature_fields.some((field) => !field.field_id || !field.label || field.status !== 'blank')
      || !packet.import_targets?.length
      || !packet.import_targets.some((target) => target.artifact === 'self_study_portfolio_reviewer_feedback_import.jsonl' && target.source_artifact_id === packet.feedback_template_id)
      || !packet.import_targets.some((target) => target.artifact === 'self_study_portfolio_gate_status_import.jsonl' && target.source_artifact_id === packet.gate_status_suggestion_id)
      || !packet.offline_review_note_template
      || !packet.primary_next_action
  )
  const portfolioDecisionPacketsGeneratedMismatch = effectiveSelfStudyPortfolioDecisionPackets.length > 0 && effectiveSelfStudyPortfolioDecisionPackets.length !== generatedPortfolioDecisionPackets.length
  const portfolioDecisionPacketIds = new Set(portfolioDecisionPackets.map((packet) => packet.decision_packet_id))
  const validCompletionChecklistActionIds = ['confirm_signed_packet', 'apply_feedback_import', 'resolve_revision_queue', 'copy_gate_status_import', 'regenerate_corpus', 'verify_review_dashboard']
  const portfolioCompletionChecklistErrors = portfolioCompletionChecklists.filter((checklist) =>
    !checklist.completion_checklist_id
      || !checklist.milestone_id
      || !portfolioMilestoneIds.has(checklist.milestone_id)
      || !checklist.decision_packet_id
      || !portfolioDecisionPacketIds.has(checklist.decision_packet_id)
      || !checklist.dashboard_id
      || !portfolioReviewDashboardIds.has(checklist.dashboard_id)
      || !['not_started', 'blocked_until_signed', 'ready_for_after_review'].includes(checklist.completion_status)
      || !Array.isArray(checklist.after_review_actions)
      || checklist.after_review_actions.length !== validCompletionChecklistActionIds.length
      || checklist.after_review_actions.some((action, index) =>
        action.action_number !== index + 1
          || action.action_id !== validCompletionChecklistActionIds[index]
          || action.status !== 'pending'
          || !action.learner_action
          || !action.verification
          || !action.artifact_refs?.length
      )
      || !checklist.blocking_conditions?.length
      || !checklist.final_verification_command
      || !checklist.primary_next_action
  )
  const portfolioCompletionChecklistsGeneratedMismatch = effectiveSelfStudyPortfolioCompletionChecklists.length > 0 && effectiveSelfStudyPortfolioCompletionChecklists.length !== generatedPortfolioCompletionChecklists.length
  const portfolioCompletionChecklistIds = new Set(portfolioCompletionChecklists.map((checklist) => checklist.completion_checklist_id))
  const validArchiveFileRoles = new Set(['decision_packet', 'completion_checklist', 'portfolio_brief', 'reference_packet', 'source_excerpt_packet', 'gate_status_summary', 'export_manifest'])
  const portfolioArchiveManifestErrors = portfolioArchiveManifests.filter((manifest) =>
    !manifest.archive_manifest_id
      || !manifest.milestone_id
      || !portfolioMilestoneIds.has(manifest.milestone_id)
      || !manifest.decision_packet_id
      || !portfolioDecisionPacketIds.has(manifest.decision_packet_id)
      || !manifest.completion_checklist_id
      || !portfolioCompletionChecklistIds.has(manifest.completion_checklist_id)
      || !manifest.portfolio_brief_id
      || !portfolioBriefIds.has(manifest.portfolio_brief_id)
      || !manifest.reference_packet_id
      || !portfolioReferencePacketIds.has(manifest.reference_packet_id)
      || !manifest.source_excerpt_packet_id
      || !portfolioSourceExcerptPacketIds.has(manifest.source_excerpt_packet_id)
      || !manifest.gate_status_summary_id
      || !portfolioGateStatusSummaryIds.has(manifest.gate_status_summary_id)
      || !manifest.export_manifest_id
      || !portfolioExportManifestIds.has(manifest.export_manifest_id)
      || !manifest.archive_files?.length
      || manifest.archive_files.length !== validArchiveFileRoles.size
      || manifest.archive_files.some((file) => !validArchiveFileRoles.has(file.file_role) || !file.artifact_id || !file.path || !['required', 'optional'].includes(file.archive_requirement))
      || !manifest.archive_files.some((file) => file.file_role === 'decision_packet' && file.artifact_id === manifest.decision_packet_id)
      || !manifest.archive_files.some((file) => file.file_role === 'completion_checklist' && file.artifact_id === manifest.completion_checklist_id)
      || !manifest.archive_files.some((file) => file.file_role === 'portfolio_brief' && file.artifact_id === manifest.portfolio_brief_id)
      || !manifest.retention_note
      || !manifest.archive_status
      || !['pending_signed_review', 'ready_to_archive'].includes(manifest.archive_status)
      || !manifest.primary_next_action
  )
  const portfolioArchiveManifestsGeneratedMismatch = effectiveSelfStudyPortfolioArchiveManifests.length > 0 && effectiveSelfStudyPortfolioArchiveManifests.length !== generatedPortfolioArchiveManifests.length
  const portfolioArchiveManifestIds = new Set(portfolioArchiveManifests.map((manifest) => manifest.archive_manifest_id))
  const validArchiveAuditStatuses = new Set(['ready_to_archive', 'blocked_missing_signed_review', 'blocked_incomplete_package'])
  const portfolioArchiveAuditErrors = portfolioArchiveAudit.filter((audit) =>
    !audit.audit_id
      || !audit.generated_at
      || !Number.isInteger(audit.audit_totals?.archives)
      || audit.audit_totals.archives !== portfolioArchiveManifests.length
      || !Number.isInteger(audit.audit_totals.ready_to_archive)
      || !Number.isInteger(audit.audit_totals.blocked)
      || audit.audit_totals.ready_to_archive + audit.audit_totals.blocked !== audit.audit_totals.archives
      || !Array.isArray(audit.milestone_audits)
      || audit.milestone_audits.length !== portfolioArchiveManifests.length
      || audit.milestone_audits.some((row) =>
        !row.milestone_id
          || !portfolioMilestoneIds.has(row.milestone_id)
          || !row.archive_manifest_id
          || !portfolioArchiveManifestIds.has(row.archive_manifest_id)
          || !validArchiveAuditStatuses.has(row.audit_status)
          || typeof row.missing_signed_review_evidence !== 'boolean'
          || !Array.isArray(row.blocking_reasons)
          || row.audit_status !== 'ready_to_archive' && row.blocking_reasons.length === 0
          || !row.next_action
      )
      || !audit.report_summary
      || !audit.primary_next_action
  )
  const portfolioArchiveAuditGeneratedMismatch = effectiveSelfStudyPortfolioArchiveAudit.length > 0 && effectiveSelfStudyPortfolioArchiveAudit.length !== generatedPortfolioArchiveAudit.length
  const portfolioOperationsSummaryErrors = portfolioOperationsSummary.filter((row) =>
    !row.operations_id
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !row.dashboard_id
      || !portfolioReviewDashboardIds.has(row.dashboard_id)
      || !row.decision_packet_id
      || !portfolioDecisionPacketIds.has(row.decision_packet_id)
      || !row.completion_checklist_id
      || !portfolioCompletionChecklistIds.has(row.completion_checklist_id)
      || !row.archive_manifest_id
      || !portfolioArchiveManifestIds.has(row.archive_manifest_id)
      || !row.archive_audit_id
      || !portfolioArchiveAudit.some((audit) => audit.audit_id === row.archive_audit_id)
      || !['review_not_started', 'review_in_progress', 'after_review_pending', 'archive_ready'].includes(row.operations_state)
      || !Array.isArray(row.current_blockers)
      || row.operations_state !== 'archive_ready' && row.current_blockers.length === 0
      || !row.next_command
      || !row.primary_artifacts?.length
      || !row.primary_artifacts.some((artifact) => artifact.artifact_role === 'review_dashboard' && artifact.artifact_id === row.dashboard_id)
      || !row.primary_artifacts.some((artifact) => artifact.artifact_role === 'decision_packet' && artifact.artifact_id === row.decision_packet_id)
      || !row.primary_artifacts.some((artifact) => artifact.artifact_role === 'archive_audit' && artifact.artifact_id === row.archive_audit_id)
  )
  const portfolioOperationsSummaryGeneratedMismatch = effectiveSelfStudyPortfolioOperationsSummary.length > 0 && effectiveSelfStudyPortfolioOperationsSummary.length !== generatedPortfolioOperationsSummary.length
  const portfolioOperationsSummaryIds = new Set(portfolioOperationsSummary.map((row) => row.operations_id))
  const portfolioCollaboratorHandoffPacketErrors = portfolioCollaboratorHandoffPackets.filter((packet) =>
    !packet.handoff_packet_id
      || !packet.milestone_id
      || !portfolioMilestoneIds.has(packet.milestone_id)
      || !packet.operations_id
      || !portfolioOperationsSummaryIds.has(packet.operations_id)
      || !packet.reviewer_handoff_id
      || !portfolioReviewerHandoffIds.has(packet.reviewer_handoff_id)
      || !packet.share_title
      || !packet.collaborator_role
      || !packet.requested_action
      || !packet.context_summary
      || !packet.acceptance_criteria?.length
      || !packet.primary_artifacts?.length
      || !packet.primary_artifacts.some((artifact) => artifact.artifact_role === 'operations_summary' && artifact.artifact_id === packet.operations_id)
      || !packet.primary_artifacts.some((artifact) => artifact.artifact_role === 'reviewer_handoff' && artifact.artifact_id === packet.reviewer_handoff_id)
      || !packet.collaborator_prompts?.length
      || !packet.response_template
      || !packet.next_owner_action
  )
  const portfolioCollaboratorHandoffPacketsGeneratedMismatch = effectiveSelfStudyPortfolioCollaboratorHandoffPackets.length > 0 && effectiveSelfStudyPortfolioCollaboratorHandoffPackets.length !== generatedPortfolioCollaboratorHandoffPackets.length
  const portfolioCollaboratorHandoffPacketIds = new Set(portfolioCollaboratorHandoffPackets.map((packet) => packet.handoff_packet_id))
  const portfolioCollaboratorResponseIntakeTemplateErrors = portfolioCollaboratorResponseIntakeTemplate.filter((row) =>
    !row.intake_template_id
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !row.handoff_packet_id
      || !portfolioCollaboratorHandoffPacketIds.has(row.handoff_packet_id)
      || !row.reviewer_feedback_template_id
      || !portfolioReviewerFeedbackTemplateIds.has(row.reviewer_feedback_template_id)
      || !row.decision_packet_id
      || !portfolioDecisionPacketIds.has(row.decision_packet_id)
      || !row.completion_checklist_id
      || !portfolioCompletionChecklistIds.has(row.completion_checklist_id)
      || !row.intake_status
      || !['ready_for_collaborator_response'].includes(row.intake_status)
      || !row.copy_targets?.length
      || !row.copy_targets.some((target) => target.artifact === 'self_study_portfolio_reviewer_feedback_import.jsonl' && target.source_artifact_id === row.reviewer_feedback_template_id)
      || !row.copy_targets.some((target) => target.artifact === 'self_study_portfolio_decision_packets.jsonl' && target.source_artifact_id === row.decision_packet_id)
      || !row.copy_targets.some((target) => target.artifact === 'self_study_portfolio_completion_checklists.jsonl' && target.source_artifact_id === row.completion_checklist_id)
      || !row.response_fields?.length
      || row.response_fields.some((field) => !field.field_id || !field.label || !field.target_artifact || !field.copy_instruction)
      || !row.feedback_import_draft
      || row.feedback_import_draft.feedback_id !== row.reviewer_feedback_template_id
      || row.feedback_import_draft.handoff_id && !portfolioReviewerHandoffIds.has(row.feedback_import_draft.handoff_id)
      || !Array.isArray(row.feedback_import_draft.status_updates)
      || !Array.isArray(row.feedback_import_draft.revision_items)
      || !row.decision_packet_notes_draft
      || !row.completion_checklist_update_draft
      || !row.intake_instructions?.length
      || !row.next_owner_action
  )
  const portfolioCollaboratorResponseIntakeTemplateGeneratedMismatch = effectiveSelfStudyPortfolioCollaboratorResponseIntakeTemplate.length > 0 && effectiveSelfStudyPortfolioCollaboratorResponseIntakeTemplate.length !== generatedPortfolioCollaboratorResponseIntakeTemplate.length
  const portfolioCollaboratorResponseIntakeTemplateIds = new Set(portfolioCollaboratorResponseIntakeTemplate.map((row) => row.intake_template_id))
  const validCollaboratorResponseReconciliationStatuses = new Set(['awaiting_response', 'response_imported', 'partial_follow_through', 'ready_for_archive_followup'])
  const portfolioCollaboratorResponseReconciliationErrors = portfolioCollaboratorResponseReconciliation.filter((row) =>
    !row.reconciliation_id
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !row.intake_template_id
      || !portfolioCollaboratorResponseIntakeTemplateIds.has(row.intake_template_id)
      || !row.handoff_packet_id
      || !portfolioCollaboratorHandoffPacketIds.has(row.handoff_packet_id)
      || !row.feedback_template_id
      || !portfolioReviewerFeedbackTemplateIds.has(row.feedback_template_id)
      || row.feedback_import_id && !effectiveSelfStudyPortfolioReviewerFeedbackImports.some((feedback) => feedback.feedback_id === row.feedback_import_id)
      || !row.decision_packet_id
      || !portfolioDecisionPacketIds.has(row.decision_packet_id)
      || !row.completion_checklist_id
      || !portfolioCompletionChecklistIds.has(row.completion_checklist_id)
      || !validCollaboratorResponseReconciliationStatuses.has(row.reconciliation_status)
      || typeof row.feedback_import_present !== 'boolean'
      || typeof row.decision_packet_ready !== 'boolean'
      || typeof row.completion_checklist_ready !== 'boolean'
      || !row.target_artifacts?.length
      || !row.target_artifacts.some((artifact) => artifact.artifact_role === 'intake_template' && artifact.artifact_id === row.intake_template_id)
      || !row.target_artifacts.some((artifact) => artifact.artifact_role === 'feedback_import' && artifact.artifact_id === (row.feedback_import_id ?? row.feedback_template_id))
      || !row.reconciliation_checks?.length
      || row.reconciliation_checks.some((check) => !check.check_id || !check.status || !['satisfied', 'pending'].includes(check.status) || !check.evidence)
      || !row.next_owner_action
  )
  const portfolioCollaboratorResponseReconciliationGeneratedMismatch = effectiveSelfStudyPortfolioCollaboratorResponseReconciliation.length > 0 && effectiveSelfStudyPortfolioCollaboratorResponseReconciliation.length !== generatedPortfolioCollaboratorResponseReconciliation.length
  const portfolioCollaboratorResponseReconciliationIds = new Set(portfolioCollaboratorResponseReconciliation.map((row) => row.reconciliation_id))
  const validCollaboratorResponseActionKinds = new Set(['paste_response_import', 'collect_signature', 'complete_after_review_checklist', 'regenerate_and_verify'])
  const validCollaboratorResponseActionStatuses = new Set(['pending', 'complete'])
  const portfolioCollaboratorResponseActionQueueErrors = portfolioCollaboratorResponseActionQueue.filter((row) =>
    !row.action_id
      || !row.reconciliation_id
      || !portfolioCollaboratorResponseReconciliationIds.has(row.reconciliation_id)
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !validCollaboratorResponseActionKinds.has(row.action_kind)
      || !validCollaboratorResponseActionStatuses.has(row.action_status)
      || !['learner', 'mentor_reviewer'].includes(row.owner)
      || !['high', 'medium', 'low'].includes(row.priority)
      || !Number.isInteger(row.action_order)
      || row.action_order <= 0
      || !row.learner_action
      || !row.verification
      || !row.target_artifacts?.length
      || row.target_artifacts.some((artifact) => !artifact.artifact_role || !artifact.artifact_id || !artifact.artifact_path)
      || !row.source_check_id
      || !row.next_command
      || !row.provenance_note
  )
  const portfolioCollaboratorResponseActionQueueGeneratedMismatch = effectiveSelfStudyPortfolioCollaboratorResponseActionQueue.length > 0 && effectiveSelfStudyPortfolioCollaboratorResponseActionQueue.length !== generatedPortfolioCollaboratorResponseActionQueue.length
  const portfolioCollaboratorResponseActionQueueIds = new Set(portfolioCollaboratorResponseActionQueue.map((row) => row.action_id))
  const portfolioCollaboratorResponseActionProgressErrors = portfolioCollaboratorResponseActionProgress.filter((row) =>
    !row.progress_id
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !Number.isInteger(row.total_actions)
      || !Number.isInteger(row.pending_actions)
      || !Number.isInteger(row.high_priority_actions)
      || !Number.isInteger(row.mentor_reviewer_actions)
      || !Number.isInteger(row.learner_actions)
      || row.pending_actions > row.total_actions
      || row.high_priority_actions > row.total_actions
      || !row.progress_status
      || !['no_actions', 'open_high_priority_work', 'open_work', 'complete'].includes(row.progress_status)
      || !Array.isArray(row.action_ids)
      || row.action_ids.some((id) => !portfolioCollaboratorResponseActionQueueIds.has(id))
      || !row.next_action
      || !row.next_command
      || !row.target_artifacts?.length
      || row.target_artifacts.some((artifact) => !artifact.artifact_role || !artifact.artifact_id || !artifact.artifact_path)
  )
  const portfolioCollaboratorResponseActionProgressGeneratedMismatch = effectiveSelfStudyPortfolioCollaboratorResponseActionProgress.length > 0 && effectiveSelfStudyPortfolioCollaboratorResponseActionProgress.length !== generatedPortfolioCollaboratorResponseActionProgress.length
  const portfolioCollaboratorResponseActionProgressIds = new Set(portfolioCollaboratorResponseActionProgress.map((row) => row.progress_id))
  const portfolioCollaboratorResponseReviewBriefErrors = portfolioCollaboratorResponseReviewBriefs.filter((brief) =>
    !brief.review_brief_id
      || !brief.milestone_id
      || !portfolioMilestoneIds.has(brief.milestone_id)
      || !brief.progress_id
      || !portfolioCollaboratorResponseActionProgressIds.has(brief.progress_id)
      || !brief.reconciliation_id
      || !portfolioCollaboratorResponseReconciliationIds.has(brief.reconciliation_id)
      || !brief.handoff_packet_id
      || !portfolioCollaboratorHandoffPacketIds.has(brief.handoff_packet_id)
      || !brief.share_title
      || !brief.current_state
      || !['awaiting_response', 'needs_followthrough', 'ready_for_archive_followup', 'complete'].includes(brief.current_state)
      || !brief.next_action
      || !brief.next_command
      || !brief.share_prompt
      || !brief.evidence_boundary_reminders?.length
      || !brief.target_artifacts?.length
      || brief.target_artifacts.some((artifact) => !artifact.artifact_role || !artifact.artifact_id || !artifact.artifact_path)
      || !brief.summary_bullets?.length
  )
  const portfolioCollaboratorResponseReviewBriefsGeneratedMismatch = effectiveSelfStudyPortfolioCollaboratorResponseReviewBriefs.length > 0 && effectiveSelfStudyPortfolioCollaboratorResponseReviewBriefs.length !== generatedPortfolioCollaboratorResponseReviewBriefs.length
  const portfolioCollaboratorResponseReviewBriefIds = new Set(portfolioCollaboratorResponseReviewBriefs.map((brief) => brief.review_brief_id))
  const portfolioCollaboratorResponseDistributionManifestErrors = portfolioCollaboratorResponseDistributionManifests.filter((manifest) =>
    !manifest.distribution_manifest_id
      || !manifest.milestone_id
      || !portfolioMilestoneIds.has(manifest.milestone_id)
      || !manifest.review_brief_id
      || !portfolioCollaboratorResponseReviewBriefIds.has(manifest.review_brief_id)
      || !manifest.recipient_role
      || !['mentor_reviewer', 'portfolio_collaborator'].includes(manifest.recipient_role)
      || !manifest.send_status
      || !['ready_to_send', 'sent', 'blocked'].includes(manifest.send_status)
      || !manifest.artifact_bundle?.length
      || manifest.artifact_bundle.some((artifact) => !artifact.artifact_role || !artifact.artifact_id || !artifact.artifact_path)
      || !manifest.send_checklist?.length
      || manifest.send_checklist.some((check) => !check.check_id || !check.label || !['pending', 'satisfied'].includes(check.status))
      || !manifest.follow_up_checks?.length
      || manifest.follow_up_checks.some((check) => !check.check_id || !check.label || !check.expected_evidence || !['pending', 'satisfied'].includes(check.status))
      || !manifest.message_subject
      || !manifest.message_body_template
      || !manifest.next_owner_action
  )
  const portfolioCollaboratorResponseDistributionManifestsGeneratedMismatch = effectiveSelfStudyPortfolioCollaboratorResponseDistributionManifests.length > 0 && effectiveSelfStudyPortfolioCollaboratorResponseDistributionManifests.length !== generatedPortfolioCollaboratorResponseDistributionManifests.length
  const portfolioCollaboratorResponseDistributionManifestIds = new Set(portfolioCollaboratorResponseDistributionManifests.map((manifest) => manifest.distribution_manifest_id))
  const portfolioCollaboratorResponseDistributionStatusErrors = portfolioCollaboratorResponseDistributionStatus.filter((row) =>
    !row.distribution_status_id
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !row.distribution_manifest_id
      || !portfolioCollaboratorResponseDistributionManifestIds.has(row.distribution_manifest_id)
      || !row.recipient_role
      || !['mentor_reviewer', 'portfolio_collaborator'].includes(row.recipient_role)
      || !row.current_status
      || !['ready_to_send', 'sent', 'blocked', 'overdue', 'closed'].includes(row.current_status)
      || !row.send_state
      || !['ready_to_send', 'sent', 'blocked'].includes(row.send_state)
      || typeof row.send_log_import_present !== 'boolean'
      || !Number.isFinite(row.follow_up_total)
      || !Number.isFinite(row.follow_up_pending)
      || !Number.isFinite(row.follow_up_satisfied)
      || !Number.isFinite(row.overdue_days)
      || !row.next_owner_action
      || !row.status_reason
      || !Array.isArray(row.blockers)
      || !row.source_artifact
      || row.source_artifact.artifact_id !== row.distribution_manifest_id
      || row.source_artifact.artifact_path !== 'self_study_portfolio_collaborator_response_distribution_manifests.jsonl'
  )
  const portfolioCollaboratorResponseDistributionStatusGeneratedMismatch = effectiveSelfStudyPortfolioCollaboratorResponseDistributionStatus.length > 0 && effectiveSelfStudyPortfolioCollaboratorResponseDistributionStatus.length !== generatedPortfolioCollaboratorResponseDistributionStatus.length
  const portfolioCollaboratorResponseDistributionStatusIds = new Set(portfolioCollaboratorResponseDistributionStatus.map((row) => row.distribution_status_id))
  const portfolioCollaboratorResponseSendLogTemplateErrors = portfolioCollaboratorResponseSendLogTemplate.filter((row) =>
    !row.send_log_template_id
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !row.distribution_manifest_id
      || !portfolioCollaboratorResponseDistributionManifestIds.has(row.distribution_manifest_id)
      || !row.distribution_status_id
      || !portfolioCollaboratorResponseDistributionStatusIds.has(row.distribution_status_id)
      || !row.recipient_role
      || !['mentor_reviewer', 'portfolio_collaborator'].includes(row.recipient_role)
      || !row.send_state
      || !['not_sent', 'sent', 'blocked'].includes(row.send_state)
      || !Array.isArray(row.allowed_channels)
      || !row.allowed_channels.length
      || !Array.isArray(row.required_fields)
      || !row.required_fields.includes('sent_at')
      || !row.required_fields.includes('recipient_handle')
      || !row.required_fields.includes('channel')
      || !row.required_fields.includes('message_artifact_id')
      || !row.message_subject
      || !row.message_artifact_id_placeholder
      || !row.import_target
      || row.import_target.artifact_path !== 'self_study_portfolio_collaborator_response_send_log_import.jsonl'
      || !row.source_artifact
      || row.source_artifact.artifact_id !== row.distribution_status_id
      || row.source_artifact.artifact_path !== 'self_study_portfolio_collaborator_response_distribution_status.jsonl'
      || !row.next_owner_action
  )
  const portfolioCollaboratorResponseSendLogTemplateGeneratedMismatch = effectiveSelfStudyPortfolioCollaboratorResponseSendLogTemplate.length > 0 && effectiveSelfStudyPortfolioCollaboratorResponseSendLogTemplate.length !== generatedPortfolioCollaboratorResponseSendLogTemplate.length
  const portfolioCollaboratorResponseSendLogImportErrors = effectiveSelfStudyPortfolioCollaboratorResponseSendLogImports.filter((row) =>
    !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !row.distribution_manifest_id
      || !portfolioCollaboratorResponseDistributionManifestIds.has(row.distribution_manifest_id)
      || !row.distribution_status_id
      || !portfolioCollaboratorResponseDistributionStatusIds.has(row.distribution_status_id)
      || !row.send_state
      || !['sent', 'blocked', 'not_sent'].includes(row.send_state)
      || row.send_state === 'sent' && (!row.sent_at || !row.recipient_handle || !row.channel || !row.message_artifact_id)
      || row.send_state === 'blocked' && !row.blocker_note
  )
  const portfolioCollaboratorResponseReminderQueueErrors = portfolioCollaboratorResponseReminderQueue.filter((row) =>
    !row.reminder_id
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !row.distribution_status_id
      || !portfolioCollaboratorResponseDistributionStatusIds.has(row.distribution_status_id)
      || !row.distribution_manifest_id
      || !portfolioCollaboratorResponseDistributionManifestIds.has(row.distribution_manifest_id)
      || !row.reminder_reason
      || !['not_sent', 'blocked', 'overdue'].includes(row.reminder_reason)
      || !row.priority
      || !['high', 'medium', 'low'].includes(row.priority)
      || !row.current_status
      || !['ready_to_send', 'blocked', 'overdue'].includes(row.current_status)
      || !row.message_subject
      || !row.reminder_copy
      || !row.next_owner_action
      || !row.source_artifact
      || row.source_artifact.artifact_path !== 'self_study_portfolio_collaborator_response_distribution_status.jsonl'
      || !row.artifact_bundle?.length
      || row.artifact_bundle.some((artifact) => !artifact.artifact_role || !artifact.artifact_id || !artifact.artifact_path)
  )
  const portfolioCollaboratorResponseReminderQueueGeneratedMismatch = effectiveSelfStudyPortfolioCollaboratorResponseReminderQueue.length > 0 && effectiveSelfStudyPortfolioCollaboratorResponseReminderQueue.length !== generatedPortfolioCollaboratorResponseReminderQueue.length
  const portfolioCollaboratorResponseReminderIds = new Set(portfolioCollaboratorResponseReminderQueue.map((row) => row.reminder_id))
  const portfolioCollaboratorResponseEvidenceRegisterErrors = portfolioCollaboratorResponseEvidenceRegister.filter((row) =>
    !row.evidence_register_id
      || !row.milestone_id
      || !portfolioMilestoneIds.has(row.milestone_id)
      || !row.distribution_status_id
      || !portfolioCollaboratorResponseDistributionStatusIds.has(row.distribution_status_id)
      || !row.distribution_manifest_id
      || !portfolioCollaboratorResponseDistributionManifestIds.has(row.distribution_manifest_id)
      || row.reminder_id && !portfolioCollaboratorResponseReminderIds.has(row.reminder_id)
      || !row.capture_status
      || !['awaiting_response', 'received_needs_import', 'imported', 'blocked'].includes(row.capture_status)
      || !Array.isArray(row.evidence_refs)
      || !Array.isArray(row.required_evidence_fields)
      || !row.required_evidence_fields.includes('response_artifact_id')
      || !row.required_evidence_fields.includes('evidence_ref')
      || !Array.isArray(row.import_targets)
      || row.import_targets.length === 0
      || row.import_targets.some((target) => !target.artifact_role || !target.artifact_id || !target.artifact_path)
      || !row.next_owner_action
      || !row.source_artifact
      || row.source_artifact.artifact_path !== 'self_study_portfolio_collaborator_response_distribution_status.jsonl'
  )
  const portfolioCollaboratorResponseEvidenceRegisterGeneratedMismatch = effectiveSelfStudyPortfolioCollaboratorResponseEvidenceRegister.length > 0 && effectiveSelfStudyPortfolioCollaboratorResponseEvidenceRegister.length !== generatedPortfolioCollaboratorResponseEvidenceRegister.length
  const portfolioBriefReadinessErrors = portfolioBriefs.filter((brief) =>
    !brief.completion_gate_id
      || !portfolioCompletionGateIds.has(brief.completion_gate_id)
      || !['not_ready_template', 'ready_for_review'].includes(brief.review_readiness?.status)
      || !brief.review_readiness?.gate_checks?.length
      || brief.review_readiness.status === 'not_ready_template' && !brief.review_readiness?.blocking_conditions?.length
      || !brief.review_readiness?.ready_when?.length
      || !brief.markdown?.includes('## Review Readiness Gate')
      || !brief.markdown?.includes(brief.completion_gate_id)
  )
  const progressLedgerPortfolioGateErrors = progressLedgerWithPortfolioGateAnnotations.filter((entry) =>
    !entry.portfolio_review
      || !entry.portfolio_review.milestone_id
      || !portfolioMilestoneIds.has(entry.portfolio_review.milestone_id)
      || !entry.portfolio_review.completion_gate_id
      || !portfolioCompletionGateIds.has(entry.portfolio_review.completion_gate_id)
      || !entry.portfolio_review.readiness_status
      || !['not_ready_template', 'ready_for_review'].includes(entry.portfolio_review.readiness_status)
  )
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
      id: 'readings_have_resource_semantics',
      status: readingSemanticErrors.length === 0 && (bibliographicReadingCount > 0 || resourceReadingCount > 0) ? 'pass' : readingSemanticErrors.length === 0 ? 'warn' : 'fail',
      detail: `${bibliographicReadingCount} bibliographic rows, ${resourceReadingCount} resource rows, ${readingContextCount} contextualized rows, ${assignmentLinkedReadingCount} assignment-linked rows, ${scheduleLinkedReadingCount} schedule-linked rows; ${readingSemanticErrors.length} semantic/link reference errors.`,
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
      detail: `${exactSourceClusterCount} exact duplicate clusters, ${nearDuplicateSourceClusterCount} near-duplicate clusters, ${historicalVersionSourceClusterCount} historical-version clusters, and ${relatedSourceClusterCount} related-family clusters.`,
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
      id: 'field_conflicts_route_to_review_queue',
      status: fieldConflicts.length === 0 ? 'warn' : conflictReviewQueueCount >= fieldConflicts.length && pendingConflictReviewDecisionCount >= fieldConflicts.length ? 'pass' : 'fail',
      detail: `${conflictReviewQueueCount} conflict review rows and ${pendingConflictReviewDecisionCount} pending conflict decisions for ${fieldConflicts.length} field conflicts.`,
    },
    {
      id: 'self_study_curriculum_modules_have_grounded_evidence',
      status: curriculumModuleReferenceErrors.length === 0 && !curriculumGeneratedMismatch && curriculumModules.length > 0 && curriculumModulesWithSourceIds === curriculumModules.length && curriculumModulesWithAssignments === curriculumModules.length ? 'pass' : curriculumModuleReferenceErrors.length === 0 && curriculumModules.length > 0 ? 'warn' : 'fail',
      detail: `${curriculumModules.length} modules; ${curriculumModulesWithAssignments} with filtered assignments, ${curriculumModulesWithReadings} with usable readings/resources, ${curriculumModulesWithSchedule} with schedule rhythm, ${curriculumModulesWithComparison} with comparison evidence, ${curriculumModulesWithUnknowns} with explicit unknowns, ${curriculumModulesWithConfidence} with confidence explanations, ${curriculumModulesWithOrderingRationale} with ordering rationales, ${curriculumModulesWithDependencyMaps} with dependency maps; ${curriculumModuleReferenceErrors.length} module reference errors; generated mismatch=${curriculumGeneratedMismatch}.`,
    },
    {
      id: 'self_study_pacing_plan_has_valid_weekly_sequence',
      status: pacingPlanReferenceErrors.length === 0 && pacingPlan.length > 0 && pacingModuleCoverage === curriculumModules.length && pacingRowsWithWorkload === pacingPlan.length && !pacingGeneratedMismatch ? 'pass' : pacingPlanReferenceErrors.length === 0 && pacingPlan.length > 0 ? 'warn' : 'fail',
      detail: `${pacingPlan.length} pacing rows for ${pacingModuleCoverage}/${curriculumModules.length} modules; ${pacingRowsWithAssignments} rows cite assignments, ${pacingRowsWithReadings} cite readings/resources, ${pacingRowsWithPrerequisites} cite prerequisite modules, ${pacingRowsWithWorkload} include workload estimates; ${pacingPlanReferenceErrors.length} pacing reference errors; generated mismatch=${pacingGeneratedMismatch}.`,
    },
    {
      id: 'self_study_pacing_profiles_have_valid_groupings',
      status: pacingProfileErrors.length === 0 && pacingProfiles.length === 3 && !pacingProfilesGeneratedMismatch ? 'pass' : pacingProfileErrors.length === 0 && pacingProfiles.length > 0 ? 'warn' : 'fail',
      detail: `${pacingProfiles.length} pacing profiles; ${pacingProfileErrors.length} profile reference errors; generated mismatch=${pacingProfilesGeneratedMismatch}.`,
    },
    {
      id: 'self_study_progress_ledger_tracks_outputs_revisions_and_warnings',
      status: progressLedgerErrors.length === 0 && progressLedger.length === pacingPlan.length && progressLedger.length > 0 && !progressLedgerGeneratedMismatch ? 'pass' : 'fail',
      detail: `${progressLedger.length} progress ledger rows for ${pacingPlan.length} pacing rows; ${progressLedgerErrors.length} ledger reference errors; generated mismatch=${progressLedgerGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_progress_rollups_connect_ledger_to_manifests',
      status: portfolioProgressRollupErrors.length === 0 && portfolioProgressRollups.length === portfolioMilestones.length && portfolioProgressRollups.length > 0 && !portfolioProgressRollupsGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioProgressRollups.length} portfolio progress rollups for ${portfolioMilestones.length} milestones; ${portfolioProgressRollupErrors.length} rollup reference errors; generated mismatch=${portfolioProgressRollupsGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_completion_gates_define_review_readiness',
      status: portfolioCompletionGateErrors.length === 0 && portfolioCompletionGates.length === portfolioMilestones.length && portfolioCompletionGates.length > 0 && !portfolioCompletionGatesGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioCompletionGates.length} portfolio completion gates for ${portfolioMilestones.length} milestones; ${portfolioCompletionGateErrors.length} gate reference errors; generated mismatch=${portfolioCompletionGatesGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_evidence_attachments_cover_gate_checks',
      status: portfolioEvidenceAttachmentErrors.length === 0 && portfolioEvidenceAttachments.length === portfolioMilestones.length && portfolioEvidenceAttachments.length > 0 && !portfolioEvidenceAttachmentsGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioEvidenceAttachments.length} evidence attachment manifests; ${portfolioEvidenceAttachments.reduce((sum, manifest) => sum + (manifest.manifest_totals?.slots ?? 0), 0)} attachment slots; ${portfolioEvidenceAttachmentErrors.length} manifest reference/coverage errors; generated mismatch=${portfolioEvidenceAttachmentsGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_gate_status_template_targets_valid_checks',
      status: portfolioGateStatusTemplateErrors.length === 0 && portfolioGateStatusTemplate.length === portfolioCompletionGates.length && portfolioGateStatusTemplate.length > 0 ? 'pass' : 'fail',
      detail: `${portfolioGateStatusTemplate.length} portfolio gate status template rows; ${portfolioGateStatusTemplateErrors.length} template reference errors.`,
    },
    {
      id: 'self_study_portfolio_gate_status_imports_are_safe_to_apply',
      status: portfolioGateStatusImportErrors.length === 0 ? 'pass' : 'fail',
      detail: `${effectiveSelfStudyPortfolioGateStatusImports.length} learner portfolio gate status import rows; ${portfolioGateStatusImportErrors.length} import reference/readiness errors.`,
    },
    {
      id: 'self_study_portfolio_gate_status_summary_explains_applied_imports',
      status: portfolioGateStatusSummaryErrors.length === 0 && portfolioGateStatusSummary.length === portfolioCompletionGates.length && portfolioGateStatusSummary.length > 0 ? 'pass' : 'fail',
      detail: `${portfolioGateStatusSummary.length} portfolio gate status summary rows; ${portfolioGateStatusSummary.filter((summary) => summary.import_applied).length} imports applied; ${portfolioGateStatusSummaryErrors.length} summary reference errors.`,
    },
    {
      id: 'self_study_portfolio_review_index_links_review_artifacts',
      status: portfolioReviewIndexErrors.length === 0 && portfolioReviewIndex.length === portfolioMilestones.length && portfolioReviewIndex.length > 0 ? 'pass' : 'fail',
      detail: `${portfolioReviewIndex.length} portfolio review index rows; ${portfolioReviewIndex.filter((row) => row.readiness_status === 'ready_for_review').length} ready; ${portfolioReviewIndexErrors.length} index reference errors.`,
    },
    {
      id: 'self_study_portfolio_reviewer_handoffs_define_critique_actions',
      status: portfolioReviewerHandoffErrors.length === 0 && portfolioReviewerHandoff.length === portfolioReviewIndex.length && portfolioReviewerHandoff.length > 0 ? 'pass' : 'fail',
      detail: `${portfolioReviewerHandoff.length} reviewer handoff rows; ${portfolioReviewerHandoff.filter((row) => row.readiness_status === 'ready_for_review').length} ready; ${portfolioReviewerHandoffErrors.length} handoff reference/action errors.`,
    },
    {
      id: 'self_study_portfolio_reviewer_feedback_templates_capture_outcomes',
      status: portfolioReviewerFeedbackTemplateErrors.length === 0 && portfolioReviewerFeedbackTemplate.length === portfolioReviewerHandoff.length && portfolioReviewerFeedbackTemplate.length > 0 ? 'pass' : 'fail',
      detail: `${portfolioReviewerFeedbackTemplate.length} reviewer feedback template rows; ${portfolioReviewerFeedbackTemplateErrors.length} template reference/action errors.`,
    },
    {
      id: 'self_study_portfolio_reviewer_feedback_imports_are_valid',
      status: portfolioReviewerFeedbackImportErrors.length === 0 ? 'pass' : 'fail',
      detail: `${effectiveSelfStudyPortfolioReviewerFeedbackImports.length} reviewer feedback import rows; ${portfolioReviewerFeedbackImportErrors.length} import reference/action errors.`,
    },
    {
      id: 'self_study_portfolio_reviewer_feedback_smoke_fixture_round_trips',
      status: portfolioReviewerFeedbackSmokeFixtureErrors.length === 0 && portfolioSmokeRevisionQueueErrors.length === 0 && portfolioSmokeGateStatusSuggestionErrors.length === 0 && portfolioReviewerFeedbackSmokeFixture.length > 0 && portfolioSmokeImportedRevisionQueue.length > 0 && portfolioSmokeReadyGateSuggestions.length > 0 ? 'pass' : 'fail',
      detail: `${portfolioReviewerFeedbackSmokeFixture.length} smoke fixture rows; ${portfolioSmokeImportedRevisionQueue.filter((row) => row.status === 'resolved').length} fixture-derived revision rows resolved; ${portfolioSmokeReadyGateSuggestions.length} smoke gate suggestions ready; ${portfolioReviewerFeedbackSmokeFixtureErrors.length + portfolioSmokeRevisionQueueErrors.length + portfolioSmokeGateStatusSuggestionErrors.length} smoke errors.`,
    },
    {
      id: 'self_study_portfolio_revision_queue_tracks_post_review_work',
      status: portfolioRevisionQueueErrors.length === 0 && portfolioRevisionQueue.length > 0 ? 'pass' : 'fail',
      detail: `${portfolioRevisionQueue.length} portfolio revision queue rows; ${portfolioRevisionQueue.filter((row) => row.status === 'pending').length} pending; ${portfolioRevisionQueueErrors.length} queue reference/action errors.`,
    },
    {
      id: 'self_study_portfolio_gate_status_suggestions_promote_reviewer_feedback',
      status: portfolioGateStatusSuggestionErrors.length === 0 && portfolioGateStatusSuggestions.length === portfolioReviewerHandoff.length && portfolioGateStatusSuggestions.length > 0 ? 'pass' : 'fail',
      detail: `${portfolioGateStatusSuggestions.length} gate status suggestion rows; ${portfolioGateStatusSuggestions.filter((row) => row.suggestion_status === 'ready_to_copy').length} ready to copy; ${portfolioGateStatusSuggestionErrors.length} suggestion reference/readiness errors.`,
    },
    {
      id: 'self_study_portfolio_review_workflow_sequences_review_steps',
      status: portfolioReviewWorkflowErrors.length === 0 && portfolioReviewWorkflow.length === portfolioMilestones.length && portfolioReviewWorkflow.length > 0 && !portfolioReviewWorkflowGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioReviewWorkflow.length} review workflow rows; ${portfolioReviewWorkflow.filter((row) => row.linked_artifacts?.reviewer_feedback_smoke_fixture_id).length} rows link smoke fixtures; ${portfolioReviewWorkflowErrors.length} workflow reference/sequence errors; generated mismatch=${portfolioReviewWorkflowGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_review_agendas_script_critique_sessions',
      status: portfolioReviewAgendaErrors.length === 0 && portfolioReviewAgendas.length === portfolioMilestones.length && portfolioReviewAgendas.length > 0 && !portfolioReviewAgendasGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioReviewAgendas.length} review agenda rows; ${portfolioReviewAgendas.reduce((sum, agenda) => sum + (agenda.target_duration_minutes ?? 0), 0)} planned critique minutes; ${portfolioReviewAgendaErrors.length} agenda reference/sequence errors; generated mismatch=${portfolioReviewAgendasGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_review_dashboard_rolls_up_review_state',
      status: portfolioReviewDashboardErrors.length === 0 && portfolioReviewDashboard.length === portfolioMilestones.length && portfolioReviewDashboard.length > 0 && !portfolioReviewDashboardGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioReviewDashboard.length} review dashboard rows; ${portfolioReviewDashboard.filter((row) => row.dashboard_state === 'ready').length} ready; ${portfolioReviewDashboard.reduce((sum, row) => sum + (row.revision_queue_pending ?? 0), 0)} pending revisions; ${portfolioReviewDashboardErrors.length} dashboard reference/rollup errors; generated mismatch=${portfolioReviewDashboardGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_decision_packets_prepare_signed_review_notes',
      status: portfolioDecisionPacketErrors.length === 0 && portfolioDecisionPackets.length === portfolioMilestones.length && portfolioDecisionPackets.length > 0 && !portfolioDecisionPacketsGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioDecisionPackets.length} decision packet rows; ${portfolioDecisionPackets.filter((packet) => packet.packet_status === 'ready_to_sign').length} ready to sign; ${portfolioDecisionPacketErrors.length} packet reference/section errors; generated mismatch=${portfolioDecisionPacketsGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_completion_checklists_sequence_after_review_actions',
      status: portfolioCompletionChecklistErrors.length === 0 && portfolioCompletionChecklists.length === portfolioMilestones.length && portfolioCompletionChecklists.length > 0 && !portfolioCompletionChecklistsGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioCompletionChecklists.length} completion checklist rows; ${portfolioCompletionChecklists.filter((row) => row.completion_status === 'ready_for_after_review').length} ready for after-review work; ${portfolioCompletionChecklistErrors.length} checklist reference/sequence errors; generated mismatch=${portfolioCompletionChecklistsGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_archive_manifests_package_review_evidence',
      status: portfolioArchiveManifestErrors.length === 0 && portfolioArchiveManifests.length === portfolioMilestones.length && portfolioArchiveManifests.length > 0 && !portfolioArchiveManifestsGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioArchiveManifests.length} review archive manifests; ${portfolioArchiveManifests.filter((row) => row.archive_status === 'ready_to_archive').length} ready to archive; ${portfolioArchiveManifestErrors.length} archive reference/package errors; generated mismatch=${portfolioArchiveManifestsGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_archive_audit_reports_archive_readiness',
      status: portfolioArchiveAuditErrors.length === 0 && portfolioArchiveAudit.length === 1 && portfolioArchiveAudit[0]?.audit_totals?.archives === portfolioMilestones.length && !portfolioArchiveAuditGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioArchiveAudit.length} archive audit reports; ${portfolioArchiveAudit[0]?.audit_totals?.ready_to_archive ?? 0} ready; ${portfolioArchiveAudit[0]?.audit_totals?.blocked ?? 0} blocked; ${portfolioArchiveAuditErrors.length} audit reference/coverage errors; generated mismatch=${portfolioArchiveAuditGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_operations_summary_commands_current_state',
      status: portfolioOperationsSummaryErrors.length === 0 && portfolioOperationsSummary.length === portfolioMilestones.length && portfolioOperationsSummary.length > 0 && !portfolioOperationsSummaryGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioOperationsSummary.length} operations summary rows; ${portfolioOperationsSummary.filter((row) => row.operations_state === 'archive_ready').length} archive ready; ${portfolioOperationsSummaryErrors.length} operations reference/state errors; generated mismatch=${portfolioOperationsSummaryGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_collaborator_handoff_packets_share_review_tasks',
      status: portfolioCollaboratorHandoffPacketErrors.length === 0 && portfolioCollaboratorHandoffPackets.length === portfolioMilestones.length && portfolioCollaboratorHandoffPackets.length > 0 && !portfolioCollaboratorHandoffPacketsGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioCollaboratorHandoffPackets.length} collaborator handoff packets; ${portfolioCollaboratorHandoffPackets.filter((packet) => packet.handoff_status === 'ready_to_share').length} ready to share; ${portfolioCollaboratorHandoffPacketErrors.length} packet reference/action errors; generated mismatch=${portfolioCollaboratorHandoffPacketsGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_collaborator_response_intake_templates_map_replies',
      status: portfolioCollaboratorResponseIntakeTemplateErrors.length === 0 && portfolioCollaboratorResponseIntakeTemplate.length === portfolioMilestones.length && portfolioCollaboratorResponseIntakeTemplate.length > 0 && !portfolioCollaboratorResponseIntakeTemplateGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioCollaboratorResponseIntakeTemplate.length} collaborator response intake templates; ${portfolioCollaboratorResponseIntakeTemplate.filter((row) => row.intake_status === 'ready_for_collaborator_response').length} ready for responses; ${portfolioCollaboratorResponseIntakeTemplateErrors.length} intake reference/target errors; generated mismatch=${portfolioCollaboratorResponseIntakeTemplateGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_collaborator_response_reconciliation_tracks_followthrough',
      status: portfolioCollaboratorResponseReconciliationErrors.length === 0 && portfolioCollaboratorResponseReconciliation.length === portfolioMilestones.length && portfolioCollaboratorResponseReconciliation.length > 0 && !portfolioCollaboratorResponseReconciliationGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioCollaboratorResponseReconciliation.length} collaborator response reconciliation rows; ${portfolioCollaboratorResponseReconciliation.filter((row) => row.feedback_import_present).length} with live feedback imports; ${portfolioCollaboratorResponseReconciliation.filter((row) => row.reconciliation_status === 'awaiting_response').length} awaiting responses; ${portfolioCollaboratorResponseReconciliationErrors.length} reconciliation reference/status errors; generated mismatch=${portfolioCollaboratorResponseReconciliationGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_collaborator_response_action_queue_turns_checks_into_tasks',
      status: portfolioCollaboratorResponseActionQueueErrors.length === 0 && portfolioCollaboratorResponseActionQueue.length > 0 && !portfolioCollaboratorResponseActionQueueGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioCollaboratorResponseActionQueue.length} collaborator response action rows; ${portfolioCollaboratorResponseActionQueue.filter((row) => row.action_status === 'pending').length} pending; ${portfolioCollaboratorResponseActionQueue.filter((row) => row.priority === 'high').length} high priority; ${portfolioCollaboratorResponseActionQueueErrors.length} action reference/task errors; generated mismatch=${portfolioCollaboratorResponseActionQueueGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_collaborator_response_action_progress_summarizes_open_work',
      status: portfolioCollaboratorResponseActionProgressErrors.length === 0 && portfolioCollaboratorResponseActionProgress.length === portfolioMilestones.length && portfolioCollaboratorResponseActionProgress.length > 0 && !portfolioCollaboratorResponseActionProgressGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioCollaboratorResponseActionProgress.length} collaborator response action progress rows; ${portfolioCollaboratorResponseActionProgress.filter((row) => row.progress_status === 'open_high_priority_work').length} with high-priority work; ${portfolioCollaboratorResponseActionProgress.reduce((sum, row) => sum + row.pending_actions, 0)} pending actions; ${portfolioCollaboratorResponseActionProgressErrors.length} progress reference/summary errors; generated mismatch=${portfolioCollaboratorResponseActionProgressGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_collaborator_response_review_briefs_are_shareable',
      status: portfolioCollaboratorResponseReviewBriefErrors.length === 0 && portfolioCollaboratorResponseReviewBriefs.length === portfolioMilestones.length && portfolioCollaboratorResponseReviewBriefs.length > 0 && !portfolioCollaboratorResponseReviewBriefsGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioCollaboratorResponseReviewBriefs.length} collaborator response review briefs; ${portfolioCollaboratorResponseReviewBriefs.filter((brief) => brief.current_state === 'awaiting_response').length} awaiting response; ${portfolioCollaboratorResponseReviewBriefErrors.length} brief reference/share errors; generated mismatch=${portfolioCollaboratorResponseReviewBriefsGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_collaborator_response_distribution_manifests_package_briefs',
      status: portfolioCollaboratorResponseDistributionManifestErrors.length === 0 && portfolioCollaboratorResponseDistributionManifests.length === portfolioMilestones.length && portfolioCollaboratorResponseDistributionManifests.length > 0 && !portfolioCollaboratorResponseDistributionManifestsGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioCollaboratorResponseDistributionManifests.length} collaborator response distribution manifests; ${portfolioCollaboratorResponseDistributionManifests.filter((manifest) => manifest.send_status === 'ready_to_send').length} ready to send; ${portfolioCollaboratorResponseDistributionManifestErrors.length} manifest package/send errors; generated mismatch=${portfolioCollaboratorResponseDistributionManifestsGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_collaborator_response_distribution_status_summarizes_send_state',
      status: portfolioCollaboratorResponseDistributionStatusErrors.length === 0 && portfolioCollaboratorResponseDistributionStatus.length === portfolioMilestones.length && portfolioCollaboratorResponseDistributionStatus.length > 0 && !portfolioCollaboratorResponseDistributionStatusGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioCollaboratorResponseDistributionStatus.length} collaborator response distribution status rows; ${portfolioCollaboratorResponseDistributionStatus.filter((row) => row.current_status === 'ready_to_send').length} ready to send; ${portfolioCollaboratorResponseDistributionStatus.filter((row) => row.current_status === 'sent').length} sent; ${portfolioCollaboratorResponseDistributionStatus.filter((row) => row.current_status === 'blocked').length} blocked; ${portfolioCollaboratorResponseDistributionStatus.filter((row) => row.current_status === 'overdue').length} overdue; ${portfolioCollaboratorResponseDistributionStatus.filter((row) => row.current_status === 'closed').length} closed; ${portfolioCollaboratorResponseDistributionStatusErrors.length} status reference/state errors; generated mismatch=${portfolioCollaboratorResponseDistributionStatusGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_collaborator_response_send_log_templates_capture_sends',
      status: portfolioCollaboratorResponseSendLogTemplateErrors.length === 0 && portfolioCollaboratorResponseSendLogTemplate.length === portfolioMilestones.length && portfolioCollaboratorResponseSendLogTemplate.length > 0 && !portfolioCollaboratorResponseSendLogTemplateGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioCollaboratorResponseSendLogTemplate.length} collaborator response send-log template rows; ${portfolioCollaboratorResponseSendLogTemplate.filter((row) => row.send_state === 'not_sent').length} not sent; ${portfolioCollaboratorResponseSendLogTemplateErrors.length} send-log template reference/field errors; generated mismatch=${portfolioCollaboratorResponseSendLogTemplateGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_collaborator_response_send_log_imports_update_distribution_status',
      status: portfolioCollaboratorResponseSendLogImportErrors.length === 0 && portfolioCollaboratorResponseDistributionStatus.filter((row) => row.send_log_import_present).length === effectiveSelfStudyPortfolioCollaboratorResponseSendLogImports.length ? 'pass' : 'fail',
      detail: `${effectiveSelfStudyPortfolioCollaboratorResponseSendLogImports.length} collaborator response send-log imports; ${portfolioCollaboratorResponseDistributionStatus.filter((row) => row.send_log_import_present).length} applied to distribution status; ${portfolioCollaboratorResponseSendLogImportErrors.length} send-log import reference/field errors.`,
    },
    {
      id: 'self_study_portfolio_collaborator_response_reminder_queue_tracks_unsent_blocked_overdue',
      status: portfolioCollaboratorResponseReminderQueueErrors.length === 0 && portfolioCollaboratorResponseReminderQueue.length > 0 && !portfolioCollaboratorResponseReminderQueueGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioCollaboratorResponseReminderQueue.length} collaborator response reminder rows; ${portfolioCollaboratorResponseReminderQueue.filter((row) => row.reminder_reason === 'not_sent').length} not sent; ${portfolioCollaboratorResponseReminderQueue.filter((row) => row.reminder_reason === 'blocked').length} blocked; ${portfolioCollaboratorResponseReminderQueue.filter((row) => row.reminder_reason === 'overdue').length} overdue; ${portfolioCollaboratorResponseReminderQueueErrors.length} reminder reference/copy errors; generated mismatch=${portfolioCollaboratorResponseReminderQueueGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_collaborator_response_evidence_registers_capture_received_refs',
      status: portfolioCollaboratorResponseEvidenceRegisterErrors.length === 0 && portfolioCollaboratorResponseEvidenceRegister.length === portfolioMilestones.length && portfolioCollaboratorResponseEvidenceRegister.length > 0 && !portfolioCollaboratorResponseEvidenceRegisterGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioCollaboratorResponseEvidenceRegister.length} collaborator response evidence register rows; ${portfolioCollaboratorResponseEvidenceRegister.filter((row) => row.capture_status === 'awaiting_response').length} awaiting response; ${portfolioCollaboratorResponseEvidenceRegisterErrors.length} evidence register reference/target errors; generated mismatch=${portfolioCollaboratorResponseEvidenceRegisterGeneratedMismatch}.`,
    },
    {
      id: 'self_study_progress_ledger_links_to_portfolio_completion_gates',
      status: progressLedgerPortfolioGateErrors.length === 0 && progressLedgerWithPortfolioGateAnnotations.length === progressLedger.length && progressLedger.length > 0 ? 'pass' : 'fail',
      detail: `${progressLedgerWithPortfolioGateAnnotations.length} progress ledger rows carry portfolio review gate annotations; ${progressLedgerPortfolioGateErrors.length} annotation reference errors.`,
    },
    {
      id: 'self_study_portfolio_briefs_embed_completion_gate_status',
      status: portfolioBriefReadinessErrors.length === 0 && portfolioBriefs.length === portfolioMilestones.length && portfolioBriefs.length > 0 ? 'pass' : 'fail',
      detail: `${portfolioBriefs.length} portfolio briefs embed completion gate status; ${portfolioBriefReadinessErrors.length} readiness reference/render errors.`,
    },
    {
      id: 'self_study_portfolio_milestones_have_valid_review_packages',
      status: portfolioMilestoneErrors.length === 0 && portfolioMilestones.length > 0 && !portfolioMilestonesGeneratedMismatch ? 'pass' : portfolioMilestoneErrors.length === 0 && portfolioMilestones.length > 0 ? 'warn' : 'fail',
      detail: `${portfolioMilestones.length} portfolio milestones; ${portfolioMilestoneErrors.length} milestone reference errors; generated mismatch=${portfolioMilestonesGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_briefs_render_independent_pages',
      status: portfolioBriefErrors.length === 0 && portfolioBriefs.length === portfolioMilestones.length && portfolioBriefs.length > 0 && !portfolioBriefsGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioBriefs.length} portfolio briefs for ${portfolioMilestones.length} milestones; ${portfolioBriefErrors.length} brief reference/render errors; generated mismatch=${portfolioBriefsGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_reference_packets_label_relationships',
      status: portfolioReferencePacketErrors.length === 0 && portfolioReferencePackets.length === portfolioMilestones.length && portfolioReferencePackets.length > 0 && !portfolioReferencePacketsGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioReferencePackets.length} portfolio reference packets for ${portfolioMilestones.length} milestones; ${portfolioReferencePacketErrors.length} packet reference errors; generated mismatch=${portfolioReferencePacketsGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_source_excerpt_packets_carry_evidence_context',
      status: portfolioSourceExcerptPacketErrors.length === 0 && portfolioSourceExcerptPackets.length === portfolioMilestones.length && portfolioSourceExcerptPackets.length > 0 && !portfolioSourceExcerptPacketsGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioSourceExcerptPackets.length} source excerpt packets for ${portfolioMilestones.length} milestones; ${portfolioSourceExcerptPacketErrors.length} packet reference errors; generated mismatch=${portfolioSourceExcerptPacketsGeneratedMismatch}.`,
    },
    {
      id: 'self_study_portfolio_export_manifests_package_briefs_and_sources',
      status: portfolioExportManifestErrors.length === 0 && portfolioExportManifests.length === portfolioMilestones.length && portfolioExportManifests.length > 0 && !portfolioExportManifestsGeneratedMismatch ? 'pass' : 'fail',
      detail: `${portfolioExportManifests.length} export manifests for ${portfolioMilestones.length} milestones; ${portfolioExportManifestErrors.length} manifest reference errors; generated mismatch=${portfolioExportManifestsGeneratedMismatch}.`,
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
      bibliographic_reading_rows: bibliographicReadingCount,
      resource_reading_rows: resourceReadingCount,
      contextualized_reading_rows: readingContextCount,
      assignment_linked_reading_rows: assignmentLinkedReadingCount,
      schedule_linked_reading_rows: scheduleLinkedReadingCount,
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
      historical_version_source_clusters: historicalVersionSourceClusterCount,
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
      conflict_review_queue_rows: conflictReviewQueueCount,
      pending_conflict_review_decisions: pendingConflictReviewDecisionCount,
      field_conflicts: fieldConflicts.length,
      self_study_curriculum_modules: curriculumModules.length,
      self_study_modules_with_filtered_assignments: curriculumModulesWithAssignments,
      self_study_modules_with_usable_readings: curriculumModulesWithReadings,
      self_study_modules_with_schedule: curriculumModulesWithSchedule,
      self_study_modules_with_comparison: curriculumModulesWithComparison,
      self_study_modules_with_unknowns: curriculumModulesWithUnknowns,
      self_study_modules_with_confidence_explanations: curriculumModulesWithConfidence,
      self_study_modules_with_ordering_rationales: curriculumModulesWithOrderingRationale,
      self_study_modules_with_dependency_maps: curriculumModulesWithDependencyMaps,
      self_study_pacing_rows: pacingPlan.length,
      self_study_pacing_rows_with_assignments: pacingRowsWithAssignments,
      self_study_pacing_rows_with_readings: pacingRowsWithReadings,
      self_study_pacing_rows_with_prerequisites: pacingRowsWithPrerequisites,
      self_study_pacing_rows_with_workload_estimates: pacingRowsWithWorkload,
      self_study_pacing_profiles: pacingProfiles.length,
      self_study_progress_ledger_rows: progressLedger.length,
      self_study_progress_ledger_rows_with_portfolio_gate: progressLedgerWithPortfolioGateAnnotations.filter((entry) => entry.portfolio_review?.completion_gate_id).length,
      self_study_portfolio_progress_rollups: portfolioProgressRollups.length,
      self_study_portfolio_completion_gates: portfolioCompletionGates.length,
      self_study_portfolio_evidence_attachment_manifests: portfolioEvidenceAttachments.length,
      self_study_portfolio_evidence_attachment_slots: portfolioEvidenceAttachments.reduce((sum, manifest) => sum + (manifest.manifest_totals?.slots ?? 0), 0),
      self_study_portfolio_missing_evidence_attachment_slots: portfolioEvidenceAttachments.reduce((sum, manifest) => sum + (manifest.manifest_totals?.missing_attachment_slots ?? 0), 0),
      self_study_portfolio_gate_status_template_rows: portfolioGateStatusTemplate.length,
      self_study_portfolio_gate_status_import_rows: effectiveSelfStudyPortfolioGateStatusImports.length,
      self_study_portfolio_gate_status_summary_rows: portfolioGateStatusSummary.length,
      self_study_portfolio_gate_status_summary_imports_applied: portfolioGateStatusSummary.filter((summary) => summary.import_applied).length,
      self_study_portfolio_review_index_rows: portfolioReviewIndex.length,
      self_study_portfolio_review_index_ready_rows: portfolioReviewIndex.filter((row) => row.readiness_status === 'ready_for_review').length,
      self_study_portfolio_review_index_filter_ready_rows: portfolioReviewIndex.filter((row) => row.dashboard_groups?.readiness_group === 'ready').length,
      self_study_portfolio_review_index_filter_blocked_rows: portfolioReviewIndex.filter((row) => row.dashboard_groups?.readiness_group === 'blocked').length,
      self_study_portfolio_reviewer_handoff_rows: portfolioReviewerHandoff.length,
      self_study_portfolio_reviewer_handoff_ready_rows: portfolioReviewerHandoff.filter((row) => row.readiness_status === 'ready_for_review').length,
      self_study_portfolio_reviewer_feedback_template_rows: portfolioReviewerFeedbackTemplate.length,
      self_study_portfolio_reviewer_feedback_import_rows: effectiveSelfStudyPortfolioReviewerFeedbackImports.length,
      self_study_portfolio_reviewer_feedback_smoke_fixture_rows: portfolioReviewerFeedbackSmokeFixture.length,
      self_study_portfolio_reviewer_feedback_smoke_ready_suggestions: portfolioSmokeReadyGateSuggestions.length,
      self_study_portfolio_revision_queue_rows: portfolioRevisionQueue.length,
      self_study_portfolio_revision_queue_pending_rows: portfolioRevisionQueue.filter((row) => row.status === 'pending').length,
      self_study_portfolio_gate_status_suggestion_rows: portfolioGateStatusSuggestions.length,
      self_study_portfolio_gate_status_suggestions_ready_to_copy: portfolioGateStatusSuggestions.filter((row) => row.suggestion_status === 'ready_to_copy').length,
      self_study_portfolio_review_workflow_rows: portfolioReviewWorkflow.length,
      self_study_portfolio_review_workflow_rows_with_smoke_fixture: portfolioReviewWorkflow.filter((row) => row.linked_artifacts?.reviewer_feedback_smoke_fixture_id).length,
      self_study_portfolio_review_agenda_rows: portfolioReviewAgendas.length,
      self_study_portfolio_review_agenda_total_minutes: portfolioReviewAgendas.reduce((sum, agenda) => sum + (agenda.target_duration_minutes ?? 0), 0),
      self_study_portfolio_review_dashboard_rows: portfolioReviewDashboard.length,
      self_study_portfolio_review_dashboard_ready_rows: portfolioReviewDashboard.filter((row) => row.dashboard_state === 'ready').length,
      self_study_portfolio_review_dashboard_pending_revisions: portfolioReviewDashboard.reduce((sum, row) => sum + (row.revision_queue_pending ?? 0), 0),
      self_study_portfolio_decision_packet_rows: portfolioDecisionPackets.length,
      self_study_portfolio_decision_packet_ready_to_sign_rows: portfolioDecisionPackets.filter((packet) => packet.packet_status === 'ready_to_sign').length,
      self_study_portfolio_completion_checklist_rows: portfolioCompletionChecklists.length,
      self_study_portfolio_completion_checklist_ready_rows: portfolioCompletionChecklists.filter((row) => row.completion_status === 'ready_for_after_review').length,
      self_study_portfolio_archive_manifest_rows: portfolioArchiveManifests.length,
      self_study_portfolio_archive_manifest_ready_rows: portfolioArchiveManifests.filter((row) => row.archive_status === 'ready_to_archive').length,
      self_study_portfolio_archive_audit_reports: portfolioArchiveAudit.length,
      self_study_portfolio_archive_audit_blocked_rows: portfolioArchiveAudit[0]?.audit_totals?.blocked ?? 0,
      self_study_portfolio_operations_summary_rows: portfolioOperationsSummary.length,
      self_study_portfolio_operations_summary_archive_ready_rows: portfolioOperationsSummary.filter((row) => row.operations_state === 'archive_ready').length,
      self_study_portfolio_collaborator_handoff_packet_rows: portfolioCollaboratorHandoffPackets.length,
      self_study_portfolio_collaborator_handoff_packet_ready_rows: portfolioCollaboratorHandoffPackets.filter((packet) => packet.handoff_status === 'ready_to_share').length,
      self_study_portfolio_collaborator_response_intake_template_rows: portfolioCollaboratorResponseIntakeTemplate.length,
      self_study_portfolio_collaborator_response_intake_template_ready_rows: portfolioCollaboratorResponseIntakeTemplate.filter((row) => row.intake_status === 'ready_for_collaborator_response').length,
      self_study_portfolio_collaborator_response_reconciliation_rows: portfolioCollaboratorResponseReconciliation.length,
      self_study_portfolio_collaborator_response_reconciliation_imported_rows: portfolioCollaboratorResponseReconciliation.filter((row) => row.feedback_import_present).length,
      self_study_portfolio_collaborator_response_reconciliation_awaiting_rows: portfolioCollaboratorResponseReconciliation.filter((row) => row.reconciliation_status === 'awaiting_response').length,
      self_study_portfolio_collaborator_response_action_queue_rows: portfolioCollaboratorResponseActionQueue.length,
      self_study_portfolio_collaborator_response_action_queue_pending_rows: portfolioCollaboratorResponseActionQueue.filter((row) => row.action_status === 'pending').length,
      self_study_portfolio_collaborator_response_action_queue_high_priority_rows: portfolioCollaboratorResponseActionQueue.filter((row) => row.priority === 'high').length,
      self_study_portfolio_collaborator_response_action_progress_rows: portfolioCollaboratorResponseActionProgress.length,
      self_study_portfolio_collaborator_response_action_progress_open_high_priority_rows: portfolioCollaboratorResponseActionProgress.filter((row) => row.progress_status === 'open_high_priority_work').length,
      self_study_portfolio_collaborator_response_action_progress_pending_actions: portfolioCollaboratorResponseActionProgress.reduce((sum, row) => sum + row.pending_actions, 0),
      self_study_portfolio_collaborator_response_review_brief_rows: portfolioCollaboratorResponseReviewBriefs.length,
      self_study_portfolio_collaborator_response_review_brief_awaiting_rows: portfolioCollaboratorResponseReviewBriefs.filter((brief) => brief.current_state === 'awaiting_response').length,
      self_study_portfolio_collaborator_response_distribution_manifest_rows: portfolioCollaboratorResponseDistributionManifests.length,
      self_study_portfolio_collaborator_response_distribution_manifest_ready_rows: portfolioCollaboratorResponseDistributionManifests.filter((manifest) => manifest.send_status === 'ready_to_send').length,
      self_study_portfolio_collaborator_response_distribution_status_rows: portfolioCollaboratorResponseDistributionStatus.length,
      self_study_portfolio_collaborator_response_distribution_status_ready_rows: portfolioCollaboratorResponseDistributionStatus.filter((row) => row.current_status === 'ready_to_send').length,
      self_study_portfolio_collaborator_response_distribution_status_closed_rows: portfolioCollaboratorResponseDistributionStatus.filter((row) => row.current_status === 'closed').length,
      self_study_portfolio_collaborator_response_send_log_template_rows: portfolioCollaboratorResponseSendLogTemplate.length,
      self_study_portfolio_collaborator_response_send_log_template_not_sent_rows: portfolioCollaboratorResponseSendLogTemplate.filter((row) => row.send_state === 'not_sent').length,
      self_study_portfolio_collaborator_response_send_log_import_rows: effectiveSelfStudyPortfolioCollaboratorResponseSendLogImports.length,
      self_study_portfolio_collaborator_response_send_log_import_applied_rows: portfolioCollaboratorResponseDistributionStatus.filter((row) => row.send_log_import_present).length,
      self_study_portfolio_collaborator_response_reminder_queue_rows: portfolioCollaboratorResponseReminderQueue.length,
      self_study_portfolio_collaborator_response_reminder_queue_not_sent_rows: portfolioCollaboratorResponseReminderQueue.filter((row) => row.reminder_reason === 'not_sent').length,
      self_study_portfolio_collaborator_response_evidence_register_rows: portfolioCollaboratorResponseEvidenceRegister.length,
      self_study_portfolio_collaborator_response_evidence_register_awaiting_rows: portfolioCollaboratorResponseEvidenceRegister.filter((row) => row.capture_status === 'awaiting_response').length,
      self_study_portfolio_milestones: portfolioMilestones.length,
      self_study_portfolio_briefs: portfolioBriefs.length,
      self_study_portfolio_briefs_with_completion_gate_status: portfolioBriefs.filter((brief) => brief.review_readiness?.status).length,
      self_study_portfolio_reference_packets: portfolioReferencePackets.length,
      self_study_portfolio_export_manifests: portfolioExportManifests.length,
      self_study_portfolio_source_excerpt_packets: portfolioSourceExcerptPackets.length,
    },
    checks,
  }
}

function buildReviewQueue({ sources, courseInventory, syllabi, readings, fieldConflicts = [] }) {
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
  for (const conflict of fieldConflicts.filter((row) => row.resolution_status === 'needs_review')) {
    const priority = conflict.severity === 'high' ? 'high' : conflict.record_kind === 'course_evidence' ? 'medium' : 'low'
    rows.push({
      review_id: `review_${conflict.conflict_id}`,
      priority,
      reason: `field_conflict_${conflict.field}`,
      conflict_id: conflict.conflict_id,
      record_kind: conflict.record_kind,
      entity_key: conflict.entity_key,
      field: conflict.field,
      values: conflict.values,
      record_ids: conflict.record_ids,
      source_ids: conflict.source_ids,
      review_prompt: reviewPromptForConflict(conflict),
      action: `Resolve ${conflict.field} conflict for ${conflict.entity_key}; ${conflict.resolution_hint}`,
    })
  }
  return rows.sort((a, b) => reviewPriorityRank(a.priority) - reviewPriorityRank(b.priority) || String(a.reason).localeCompare(String(b.reason)) || String(a.review_id).localeCompare(String(b.review_id)))
}

function reviewPromptForConflict(conflict) {
  const prompts = {
    assignment_titles: 'Which assignment titles are distinct prompts, historical versions, or parser fragments? Preserve distinct studio prompts and mark weak fragments for parser cleanup.',
    reading_set: 'Which reading/resource set belongs to which term, section, or assignment? Preserve source-specific reading evidence and mark non-readings for extraction cleanup.',
    schedule_pattern: 'Which weekly/session pattern belongs to which term or source version? Do not merge schedules across terms or archive versions without direct evidence.',
    assessment_evidence: 'Which grading/assessment text is authoritative for this course version? Preserve variant rubrics until term, section, and source authority are reconciled.',
    term: 'Which term label is authoritative, and which labels represent historical ranges or source-family summaries?',
    instructor: 'Which instructor attribution is source-supported, and which differences indicate separate sections, terms, or parser noise?',
    instructors: 'Which instructor list belongs to the cluster representative, and which values should remain source-specific?',
  }
  return prompts[conflict.field] ?? `Review ${conflict.field} variants and decide whether to preserve, split, merge, or fix parser extraction.`
}

function reviewPriorityRank(priority) {
  return { high: 0, medium: 1, low: 2 }[priority] ?? 3
}

function buildReviewDecisions(reviewQueue, { sources = [], syllabi = [], readings = [], fieldConflicts = [] } = {}) {
  const sourcesById = new Map(sources.map((source) => [source.source_id, source]))
  const syllabiById = new Map(syllabi.map((syllabus) => [syllabus.syllabus_id, syllabus]))
  const conflictsById = new Map(fieldConflicts.map((conflict) => [conflict.conflict_id, conflict]))
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

    if (row.conflict_id) {
      const conflict = conflictsById.get(row.conflict_id)
      return {
        ...base,
        conflict_id: row.conflict_id,
        record_ids: row.record_ids ?? [],
        status: 'pending_manual_review',
        reviewer: null,
        decided_at: null,
        decision: null,
        confidence: null,
        evidence_summary: conflict
          ? `${conflict.record_kind} ${conflict.field} conflict on ${conflict.entity_key}: ${(conflict.values ?? []).slice(0, 4).join(' | ')}`
          : `Conflict ${row.conflict_id} requires manual review.`,
        next_parser_action: row.review_prompt ?? 'Inspect source-specific evidence and decide whether to preserve variants, split records, merge duplicates, or improve parser extraction.',
        notes: 'Generated from field_conflicts.jsonl; keep generated pending until a human decision is recorded.',
      }
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

function buildFieldConflicts({ courses, syllabi, sourceClusters, assignments = [], readings = [], scheduleRows = [] }) {
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
  rows.push(...buildCourseEvidenceConflicts({ syllabi, assignments, readings, scheduleRows }))

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

function buildCourseEvidenceConflicts({ syllabi, assignments, readings, scheduleRows }) {
  const rows = []
  const assignmentsBySyllabus = groupBy(assignments, (assignment) => assignment.syllabus_id)
  const readingsBySyllabus = groupBy(readings, (reading) => reading.syllabus_id)
  const schedulesBySyllabus = groupBy(scheduleRows, (row) => row.syllabus_id)
  const syllabiByCourse = groupBy(syllabi, (syllabus) => courseEvidenceConflictKey(syllabus))

  for (const [courseKey, courseSyllabi] of syllabiByCourse) {
    const comparableSyllabi = courseSyllabi.filter((syllabus) => syllabus.syllabus_id)
    if (!courseKey || comparableSyllabi.length < 2) continue
    addEvidenceConflict(rows, {
      courseKey,
      field: 'assignment_titles',
      syllabi: comparableSyllabi,
      valueFn: (syllabus) => evidenceSetValue(assignmentsBySyllabus.get(syllabus.syllabus_id) ?? [], (assignment) => assignment.title),
      hint: 'Treat assignment-title differences as possible section, term, or historical prompt variants; preserve distinct prompts until the source boundary is reviewed.',
    })
    addEvidenceConflict(rows, {
      courseKey,
      field: 'reading_set',
      syllabi: comparableSyllabi,
      valueFn: (syllabus) => evidenceSetValue(readingsBySyllabus.get(syllabus.syllabus_id) ?? [], (reading) => reading.canonical_work_id ?? reading.raw_citation ?? reading.title),
      hint: 'Treat reading-set differences as possible section, term, or syllabus-version variants; prefer direct syllabus evidence for the same term.',
    })
    addEvidenceConflict(rows, {
      courseKey,
      field: 'schedule_pattern',
      syllabi: comparableSyllabi,
      valueFn: (syllabus) => evidenceSetValue(schedulesBySyllabus.get(syllabus.syllabus_id) ?? [], (row) => `${row.date ?? row.week_number ?? ''}|${row.session_title ?? ''}|${row.agenda_excerpt ?? ''}`),
      hint: 'Treat schedule differences as likely term, section, or archive-version variants; do not collapse weekly structures without matching term and source evidence.',
    })
    addEvidenceConflict(rows, {
      courseKey,
      field: 'assessment_evidence',
      syllabi: comparableSyllabi,
      valueFn: (syllabus) => evidenceTextValue([syllabus.grading_rubric, syllabus.assessment_strategy].filter(Boolean).join(' ')),
      hint: 'Treat grading and assessment differences as high-value syllabus variants; keep both until the term, section, and source authority are reconciled.',
    })
  }
  return rows
}

function addEvidenceConflict(rows, { courseKey, field, syllabi, valueFn, hint }) {
  const evidenceRows = syllabi
    .map((syllabus) => ({
      syllabus,
      value: valueFn(syllabus),
    }))
    .filter((row) => row.value)
  const values = uniq(evidenceRows.map((row) => row.value.summary))
  if (values.length < 2) return
  rows.push({
    conflict_id: `conflict_course_evidence_${slug(courseKey)}_${field}`,
    record_kind: 'course_evidence',
    entity_key: courseKey,
    field,
    values,
    record_ids: evidenceRows.map((row) => row.syllabus.syllabus_id),
    source_ids: uniq(evidenceRows.flatMap((row) => row.syllabus.source_ids ?? [])),
    severity: conflictSeverity(field, values),
    resolution_status: 'needs_review',
    resolution_hint: hint,
  })
}

function courseEvidenceConflictKey(syllabus) {
  return normalizeCourseKey(syllabus.course_code ?? null, syllabus.course_title ?? null)
}

function evidenceSetValue(rows, valueFn) {
  const values = uniq(rows.map(valueFn).map(normalizeConflictValue).filter(Boolean))
  if (!values.length) return null
  const hash = sha256(Buffer.from(values.slice().sort().join('\n'))).slice(0, 12)
  const samples = values.slice(0, 4).map((value) => value.length > 90 ? `${value.slice(0, 87)}...` : value)
  return {
    hash,
    summary: `${hash}:${values.length} items:${samples.join(' | ')}`,
  }
}

function evidenceTextValue(text) {
  const normalized = normalizeConflictValue(text)
  if (!normalized || normalized.length < 30) return null
  const compact = normalized.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim()
  if (!compact) return null
  const hash = sha256(Buffer.from(compact)).slice(0, 12)
  return {
    hash,
    summary: `${hash}:${normalized.slice(0, 160)}`,
  }
}

function groupBy(rows, keyFn) {
  const groups = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (!key) continue
    const existing = groups.get(key) ?? []
    existing.push(row)
    groups.set(key, existing)
  }
  return groups
}

function normalizeConflictValue(value) {
  if (value === null || value === undefined || value === '') return null
  if (Array.isArray(value)) return value.filter(Boolean).join(' | ') || null
  return String(value).replace(/\s+/g, ' ').trim() || null
}

function conflictSeverity(field, values) {
  if (['course_title', 'credits', 'term', 'assessment_evidence'].includes(field)) return 'high'
  if (['instructor', 'degree_level', 'class_time', 'assignment_titles', 'reading_set', 'schedule_pattern'].includes(field)) return 'medium'
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
    assignment_titles: 'Treat assignment-title differences as possible section, term, or historical prompt variants.',
    reading_set: 'Treat reading-set differences as possible section, term, or syllabus-version variants.',
    schedule_pattern: 'Treat schedule differences as likely term, section, or archive-version variants.',
    assessment_evidence: 'Treat grading and assessment differences as high-value syllabus variants.',
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
  const prompt = row.review_prompt ? ` Prompt: ${row.review_prompt}` : ''
  const values = row.values?.length ? ` Values: ${row.values.slice(0, 3).join(' | ')}` : ''
  return `- ${row.reason}: ${target}.${ids}${values} Action: ${row.action}${prompt}`
}

function reviewQueueMarkdown(rows) {
  return `# RISD Graphic Design Review Queue

Generated: ${retrievedAt}

Rows: ${rows.length}

${rows.map((row) => `- ${row.priority.toUpperCase()} ${row.reason}: ${row.course_title ?? row.entity_key ?? row.source_id ?? row.syllabus_id ?? row.review_id ?? row.action}${row.url ? ` (${row.url})` : ''}${row.review_prompt ? ` — ${row.review_prompt}` : ''}`).join('\n')}
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
- Bibliographic reading rows: ${validation.counts.bibliographic_reading_rows}
- Resource reading rows: ${validation.counts.resource_reading_rows}
- Contextualized reading rows: ${validation.counts.contextualized_reading_rows}
- Assignment-linked reading rows: ${validation.counts.assignment_linked_reading_rows}
- Schedule-linked reading rows: ${validation.counts.schedule_linked_reading_rows}
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
- Historical-version source clusters: ${validation.counts.historical_version_source_clusters}
- Related-family source clusters: ${validation.counts.related_source_clusters}
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
- Conflict review queue rows: ${validation.counts.conflict_review_queue_rows}
- Pending conflict review decisions: ${validation.counts.pending_conflict_review_decisions}
- Field conflicts: ${validation.counts.field_conflicts}
- Self-study curriculum modules: ${validation.counts.self_study_curriculum_modules}
- Self-study modules with filtered assignments: ${validation.counts.self_study_modules_with_filtered_assignments}
- Self-study modules with usable readings/resources: ${validation.counts.self_study_modules_with_usable_readings}
- Self-study modules with schedule rhythm: ${validation.counts.self_study_modules_with_schedule}
- Self-study modules with comparison evidence: ${validation.counts.self_study_modules_with_comparison}
- Self-study modules with explicit unknowns: ${validation.counts.self_study_modules_with_unknowns}
- Self-study modules with confidence explanations: ${validation.counts.self_study_modules_with_confidence_explanations}
- Self-study modules with ordering rationales: ${validation.counts.self_study_modules_with_ordering_rationales}
- Self-study modules with dependency maps: ${validation.counts.self_study_modules_with_dependency_maps}
- Self-study pacing rows: ${validation.counts.self_study_pacing_rows}
- Self-study pacing rows with assignments: ${validation.counts.self_study_pacing_rows_with_assignments}
- Self-study pacing rows with readings/resources: ${validation.counts.self_study_pacing_rows_with_readings}
- Self-study pacing rows with prerequisites: ${validation.counts.self_study_pacing_rows_with_prerequisites}
- Self-study pacing rows with workload estimates: ${validation.counts.self_study_pacing_rows_with_workload_estimates}
- Self-study pacing profiles: ${validation.counts.self_study_pacing_profiles}
- Self-study progress ledger rows: ${validation.counts.self_study_progress_ledger_rows}
- Self-study progress ledger rows with portfolio gate: ${validation.counts.self_study_progress_ledger_rows_with_portfolio_gate}
- Self-study portfolio progress rollups: ${validation.counts.self_study_portfolio_progress_rollups}
- Self-study portfolio completion gates: ${validation.counts.self_study_portfolio_completion_gates}
- Self-study portfolio gate status template rows: ${validation.counts.self_study_portfolio_gate_status_template_rows}
- Self-study portfolio gate status import rows: ${validation.counts.self_study_portfolio_gate_status_import_rows}
- Self-study portfolio gate status summary rows: ${validation.counts.self_study_portfolio_gate_status_summary_rows}
- Self-study portfolio gate status summary imports applied: ${validation.counts.self_study_portfolio_gate_status_summary_imports_applied}
- Self-study portfolio review index rows: ${validation.counts.self_study_portfolio_review_index_rows}
- Self-study portfolio review index ready rows: ${validation.counts.self_study_portfolio_review_index_ready_rows}
- Self-study portfolio review index filter ready rows: ${validation.counts.self_study_portfolio_review_index_filter_ready_rows}
- Self-study portfolio review index filter blocked rows: ${validation.counts.self_study_portfolio_review_index_filter_blocked_rows}
- Self-study portfolio reviewer handoff rows: ${validation.counts.self_study_portfolio_reviewer_handoff_rows}
- Self-study portfolio reviewer handoff ready rows: ${validation.counts.self_study_portfolio_reviewer_handoff_ready_rows}
- Self-study portfolio reviewer feedback template rows: ${validation.counts.self_study_portfolio_reviewer_feedback_template_rows}
- Self-study portfolio reviewer feedback import rows: ${validation.counts.self_study_portfolio_reviewer_feedback_import_rows}
- Self-study portfolio revision queue rows: ${validation.counts.self_study_portfolio_revision_queue_rows}
- Self-study portfolio revision queue pending rows: ${validation.counts.self_study_portfolio_revision_queue_pending_rows}
- Self-study portfolio milestones: ${validation.counts.self_study_portfolio_milestones}
- Self-study portfolio briefs: ${validation.counts.self_study_portfolio_briefs}
- Self-study portfolio briefs with completion gate status: ${validation.counts.self_study_portfolio_briefs_with_completion_gate_status}
- Self-study portfolio reference packets: ${validation.counts.self_study_portfolio_reference_packets}
- Self-study portfolio export manifests: ${validation.counts.self_study_portfolio_export_manifests}
- Self-study portfolio source excerpt packets: ${validation.counts.self_study_portfolio_source_excerpt_packets}

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

function tacitMemoMarkdown({ syllabi, assignments, studentWork, selfStudyModules = [] }) {
  const assignmentSkills = uniq(assignments.flatMap((assignment) => assignment.skills_trained))
  const critiqueEvidence = assignments.filter((assignment) => /crit/i.test(assignment.prompt_excerpt))
  const modulesByTrack = new Map()
  for (const module of selfStudyModules) {
    const existing = modulesByTrack.get(module.track_title) ?? []
    existing.push(module)
    modulesByTrack.set(module.track_title, existing)
  }
  const modulePracticeRows = selfStudyModules
    .filter((module) => module.practice_instruction?.instruction)
    .slice(0, 12)
  const critiqueModuleRows = selfStudyModules
    .filter((module) => module.assignments?.some((assignment) => assignment.critique_format || assignment.revision_expectation))
    .slice(0, 10)
  const comparisonRows = selfStudyModules
    .filter((module) => module.comparison_set?.length)
    .slice(0, 8)
  const confidenceRows = selfStudyModules
    .filter((module) => module.module_confidence_explanation?.selection_reason)
    .slice(0, 8)
  const orderingRows = selfStudyModules
    .filter((module) => module.module_ordering_rationale?.selected_reason)
    .slice(0, 8)
  const dependencyRows = selfStudyModules
    .filter((module) => module.module_dependency_map?.dependency_stage)
    .slice(0, 8)
  const allPacingRows = buildSelfStudyPacingPlan(selfStudyModules)
  const pacingRows = allPacingRows.slice(0, 12)
  const pacingProfiles = buildSelfStudyPacingProfiles(allPacingRows)
  const portfolioMilestones = buildSelfStudyPortfolioMilestones(selfStudyModules, allPacingRows)
  const missingEvidenceRows = selfStudyModules
    .filter((module) => module.missing_evidence_warnings?.length)
    .slice(0, 10)
  return `# RISD Graphic Design Tacit Knowledge Memo

Generated: ${retrievedAt}

## Current Evidence Base

This memo is generated from the first implemented corpus pass. It is strongest where public syllabi or course sites were found and weakest where only official catalog/program pages exist.

- Syllabus/course-site records: ${syllabi.length}
- Assignment evidence snippets: ${assignments.length}
- Critique-related snippets: ${critiqueEvidence.length}
- Student work records: ${studentWork.length}
- Self-study modules: ${selfStudyModules.length}

## Studio Norms Visible In The Corpus

- Public course artifacts emphasize making through projects, exercises, and critique rather than lecture-only learning.
- Course evidence points to graphic design as a sequence of material outputs: typography, image, publication, motion, interaction, and identity/system work.
- RISD's own syllabus guidance frames courses around learning outcomes, assignment design, and assessment clarity, which should be used as the reconstruction standard when a recovered syllabus is partial.

## Module-Derived Studio Loops

${selfStudyModules.length ? [...modulesByTrack.entries()].map(([trackTitle, modules]) => {
  const examples = modules.slice(0, 4).map((module) => `${module.course_title ?? module.course_code}: ${module.practice_instruction?.instruction ?? module.studio_loop}`).join('; ')
  return `- ${trackTitle}: ${examples}`
}).join('\n') : '- No self-study modules have been generated yet.'}

## Skill Signals

${assignmentSkills.length ? assignmentSkills.map((skill) => `- ${skill}`).join('\n') : '- Not enough assignment-level evidence has been extracted yet.'}

## Tangible Practice Instructions

${modulePracticeRows.length ? modulePracticeRows.map((module) => `- ${module.course_title ?? module.course_code}: ${module.practice_instruction.instruction}. Evidence: ${module.practice_instruction.assignment_id}; sources: ${module.source_ids.slice(0, 4).join(', ')}`).join('\n') : '- No module-level practice instructions have been generated yet.'}

## Module Confidence Boundaries

${confidenceRows.length ? confidenceRows.map((module) => {
  const strengths = module.module_confidence_explanation.strengths?.slice(0, 3).join('; ')
  const limits = module.module_confidence_explanation.limitations?.slice(0, 3).join('; ')
  return `- ${module.course_title ?? module.course_code}: ${module.module_confidence_band} (${module.module_confidence_score}/100). ${module.module_confidence_explanation.selection_reason}${strengths ? ` Strengths: ${strengths}.` : ''}${limits ? ` Limits: ${limits}.` : ''}`
}).join('\n') : '- No module-level confidence explanations have been generated yet.'}

## Module Ordering Boundaries

${orderingRows.length ? orderingRows.map((module) => {
  const nearMisses = module.module_ordering_rationale.near_miss_candidates?.slice(0, 2).map((candidate) => `${candidate.course_title ?? candidate.course_code} (${candidate.reason_not_selected})`).join('; ')
  return `- ${module.course_title ?? module.course_code}: ${module.module_ordering_rationale.selected_reason}${nearMisses ? ` Near misses: ${nearMisses}.` : ''}`
}).join('\n') : '- No module-level ordering rationales have been generated yet.'}

## Dependency Map Boundaries

${dependencyRows.length ? dependencyRows.map((module) => {
  const map = module.module_dependency_map
  const prereqs = map.prerequisite_module_ids?.length ? ` prerequisites: ${map.prerequisite_module_ids.join(', ')}` : ' starts a sequence'
  const enables = map.enables_module_ids?.length ? ` enables: ${map.enables_module_ids.join(', ')}` : ''
  return `- ${module.course_title ?? module.course_code}: ${map.dependency_stage}${prereqs}${enables}. Basis: ${map.dependency_basis?.slice(0, 3).join('; ')}`
}).join('\n') : '- No module-level dependency maps have been generated yet.'}

## Weekly Pacing Boundaries

${pacingRows.length ? pacingRows.map((row) => `- Week ${row.week_number}: ${row.focus} Output: ${row.expected_output}; workload: ${row.workload_estimate.estimated_hours}h ${row.workload_estimate.workload_band}; checkpoint: ${row.critique_checkpoint}`).join('\n') : '- No weekly pacing rows have been generated yet.'}

## Pacing Profile Boundaries

${pacingProfiles.length ? pacingProfiles.map((profile) => `- ${profile.label}: ${profile.estimated_calendar_weeks} calendar weeks at about ${profile.target_hours_per_week} target hours/week; ${profile.estimated_total_hours} estimated total hours.`).join('\n') : '- No pacing profiles have been generated yet.'}

## Portfolio Milestone Boundaries

${portfolioMilestones.length ? portfolioMilestones.map((milestone) => `- ${milestone.title}: weeks ${milestone.week_range.join('-')}, ${milestone.module_ids.length} modules, ${milestone.estimated_hours} estimated hours. Review focus: ${milestone.review_focus}`).join('\n') : '- No portfolio milestones have been generated yet.'}

## Critique And Revision

${critiqueModuleRows.length ? critiqueModuleRows.map((module) => {
  const critiqueAssignments = module.assignments.filter((assignment) => assignment.critique_format || assignment.revision_expectation).slice(0, 2)
  return `- ${module.course_title ?? module.course_code}: ${critiqueAssignments.map((assignment) => `${assignment.assignment_id} (${assignment.critique_format ?? assignment.revision_expectation})`).join('; ')}`
}).join('\n') : critiqueEvidence.length ? critiqueEvidence.slice(0, 8).map((assignment) => `- ${assignment.prompt_excerpt}`).join('\n') : '- Critique is expected in studio courses, but this corpus pass has limited direct critique-format evidence.'}

## Comparison Evidence Boundaries

${comparisonRows.length ? comparisonRows.map((module) => `- ${module.course_title ?? module.course_code}: ${module.comparison_set.map((comparison) => `${comparison.relationship_type} ${comparison.student_work_id}`).join('; ')}`).join('\n') : '- Public student-work comparisons are still sparse; do not treat visual examples as assignment facts unless the relationship type says so.'}

## Missing Evidence To Preserve

${missingEvidenceRows.length ? missingEvidenceRows.map((module) => `- ${module.course_title ?? module.course_code}: ${module.missing_evidence_warnings.join('; ')}`).join('\n') : '- No module-level missing evidence warnings were generated.'}

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

function selfStudyModuleId(packet, index) {
  return `self_study_module_${String(index + 1).padStart(2, '0')}_${curriculumPacketKey(packet)}`
}

function curriculumAssignmentCandidates(assignments) {
  const candidates = assignments
    .filter((assignment) =>
      ['high', 'medium'].includes(assignment.assignment_confidence)
        && !['fragment_too_short', 'weak_assignment_signal', 'contextual_course_fragment'].includes(assignment.boundary_status)
        && (assignment.deliverables?.length
          || assignment.constraints?.length
          || assignment.process_steps?.length
          || assignment.submission_requirements?.length
          || assignment.output_format
          || assignment.critique_format
          || assignment.revision_expectation
          || assignment.prompt_excerpt?.split(/\s+/).length >= 35)
    )
    .sort((a, b) => {
      const confidenceRank = { high: 0, medium: 1, low: 2 }
      return (confidenceRank[a.assignment_confidence] ?? 9) - (confidenceRank[b.assignment_confidence] ?? 9)
        || Number(Boolean(b.deliverables?.length)) - Number(Boolean(a.deliverables?.length))
        || Number(Boolean(b.critique_format || b.revision_expectation)) - Number(Boolean(a.critique_format || a.revision_expectation))
        || String(a.title ?? '').localeCompare(String(b.title ?? ''))
    })
  const byKey = new Map()
  for (const assignment of candidates) {
    const key = slug(`${assignment.title ?? ''}_${assignment.prompt_excerpt?.slice(0, 160) ?? ''}`)
    if (!byKey.has(key)) byKey.set(key, assignment)
  }
  return [...byKey.values()]
}

function curriculumReadingCandidates(readings) {
  const candidates = readings
    .filter((reading) => reading.semantic_status !== 'non_citation_fragment' && (reading.title || reading.raw_citation))
    .sort((a, b) => {
      const statusRank = { bibliographic: 0, resource: 1, non_citation_fragment: 9 }
      return (statusRank[a.semantic_status] ?? 5) - (statusRank[b.semantic_status] ?? 5)
        || Number(Boolean(b.linked_assignment_ids?.length || b.linked_schedule_ids?.length)) - Number(Boolean(a.linked_assignment_ids?.length || a.linked_schedule_ids?.length))
        || String(a.title ?? a.raw_citation ?? '').localeCompare(String(b.title ?? b.raw_citation ?? ''))
    })
  const byKey = new Map()
  for (const reading of candidates) {
    const key = reading.canonical_work_id ?? slug(`${reading.title ?? reading.raw_citation}_${reading.author ?? ''}`)
    if (!byKey.has(key)) byKey.set(key, reading)
  }
  return [...byKey.values()]
}

function curriculumScheduleCandidates(scheduleRows) {
  return scheduleRows
    .filter((row) =>
      row.date
        || row.week_number
        || row.due_assignment_ids?.length
        || row.reading_ids?.length
        || row.critique_signal
        || row.workshop_signal
        || row.schedule_source === 'syllabus_table_or_outline'
    )
    .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')) || Number(a.week_number ?? 999) - Number(b.week_number ?? 999) || String(a.schedule_id).localeCompare(String(b.schedule_id)))
}

function curriculumModuleUnknowns({ courseSyllabi, assignments, readings, scheduleRows, studentWorkLinks }) {
  const unknowns = []
  if (!courseSyllabi.some((syllabus) => syllabus.grading_rubric || syllabus.assessment_strategy)) unknowns.push('grading rubric or assessment strategy not recovered')
  if (!curriculumScheduleCandidates(scheduleRows).length) unknowns.push('ordered weekly schedule not recovered')
  if (!curriculumReadingCandidates(readings).length) unknowns.push('usable reading/resource list not recovered')
  if (!curriculumAssignmentCandidates(assignments).length) unknowns.push('complete project brief not recovered')
  if (!assignments.some((assignment) => assignment.critique_format || assignment.revision_expectation || assignment.critique_questions?.length)) unknowns.push('critique/revision format only partially evidenced')
  if (!studentWorkLinks.length) unknowns.push('public comparison work is course-context only or missing')
  return unknowns
}

function curriculumSelectedPackets(packets, limit = 24) {
  const strongPackets = packets.filter((packet) =>
    curriculumAssignmentCandidates(packet.courseAssignments).length
  )
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
    if (selected.length >= limit) break
  }
  return selected
}

function curriculumOrderingRationale({ packet, selected, packets, selectedIndex }) {
  const strongPackets = packets.filter((candidate) =>
    curriculumAssignmentCandidates(candidate.courseAssignments).length
  )
  const selectedKey = curriculumPacketKey(packet)
  const trackPackets = strongPackets.filter((candidate) => candidate.track.track_id === packet.track.track_id)
  const selectedTrackPackets = selected.filter((candidate) => candidate.track.track_id === packet.track.track_id)
  const trackRank = trackPackets.findIndex((candidate) => curriculumPacketKey(candidate) === selectedKey) + 1
  const selectedTrackRank = selectedTrackPackets.findIndex((candidate) => curriculumPacketKey(candidate) === selectedKey) + 1
  const selectedKeys = new Set(selected.map((candidate) => curriculumPacketKey(candidate)))
  const nearMisses = trackPackets
    .filter((candidate) => curriculumPacketKey(candidate) !== selectedKey && !selectedKeys.has(curriculumPacketKey(candidate)))
    .slice(0, 3)
    .map((candidate) => {
      const candidateAssignments = curriculumAssignmentCandidates(candidate.courseAssignments)
      const candidateReadings = curriculumReadingCandidates(candidate.courseReadings)
      const candidateSchedule = curriculumScheduleCandidates(candidate.courseScheduleRows)
      return {
        course_id: candidate.course.course_id ?? null,
        course_code: candidate.course.course_code ?? null,
        course_title: candidate.course.course_title ?? null,
        evidence_grade: candidate.course.evidence_grade ?? null,
        evidence_score: candidate.score,
        assignment_candidate_count: candidateAssignments.length,
        reading_candidate_count: candidateReadings.length,
        schedule_candidate_count: candidateSchedule.length,
        reason_not_selected: selectedTrackPackets.length >= 4
          ? 'track_slot_limit_reached'
          : selected.length >= 24
            ? 'global_module_limit_reached'
            : 'lower_ranked_after_selected_modules',
      }
    })
  const selectionPhase = selectedTrackRank <= 4
      ? 'track_quota'
      : 'global_backfill'
  const assignmentCount = curriculumAssignmentCandidates(packet.courseAssignments).length
  const readingCount = curriculumReadingCandidates(packet.courseReadings).length
  const scheduleCount = curriculumScheduleCandidates(packet.courseScheduleRows).length
  return {
    global_rank: selectedIndex + 1,
    track_rank: trackRank || null,
    selected_track_rank: selectedTrackRank || null,
    selection_phase: selectionPhase,
    track_slot_limit: 4,
    evidence_score: packet.score,
    ordering_basis: 'course_evidence_score_desc_then_course_title; first four qualifying modules per track are selected before global backfill',
    selected_reason: `Ranked ${trackRank || 'unknown'} among qualifying ${packet.track.title} packets by evidence score ${packet.score}; selected in ${selectionPhase.replace(/_/g, ' ')} with ${assignmentCount} assignment candidates, ${readingCount} reading/resource candidates, and ${scheduleCount} schedule candidates.`,
    near_miss_candidates: nearMisses,
  }
}

function curriculumDependencyStage({ packet, selectedTrackRank, moduleAssignments, moduleReadings, moduleScheduleRows }) {
  const assignmentText = moduleAssignments.map((assignment) => [
    assignment.prompt_excerpt,
    assignment.output_format,
    assignment.deliverables?.join(' '),
    assignment.process_steps?.join(' '),
  ].filter(Boolean).join(' ')).join(' ')
  const advancedSignal = /final|portfolio|system|identity|publication|book|website|interactive|motion|video|public|campaign|research/i.test(assignmentText)
  if (packet.track.track_id === 'foundation_studio' && selectedTrackRank <= 4) return 'foundation'
  if (advancedSignal && (moduleScheduleRows.length || moduleReadings.length) && selectedTrackRank > 2) return 'advanced_synthesis'
  return 'intermediate_practice'
}

function curriculumDependencyMap({ packet, selected, selectedIndex, moduleAssignments, moduleReadings, moduleScheduleRows }) {
  const moduleKey = curriculumPacketKey(packet)
  const selectedTrackPackets = selected.filter((candidate) => candidate.track.track_id === packet.track.track_id)
  const selectedTrackRank = selectedTrackPackets.findIndex((candidate) => curriculumPacketKey(candidate) === moduleKey) + 1
  const priorSameTrack = selected
    .slice(0, selectedIndex)
    .map((candidate, index) => ({ packet: candidate, index }))
    .filter((candidate) => candidate.packet.track.track_id === packet.track.track_id)
    .slice(-2)
  const foundationAnchor = packet.track.track_id === 'foundation_studio'
    ? []
    : selected
      .map((candidate, index) => ({ packet: candidate, index }))
      .filter((candidate) => candidate.packet.track.track_id === 'foundation_studio')
      .slice(0, 1)
  const prerequisiteCandidates = [...foundationAnchor, ...priorSameTrack]
  const seen = new Set()
  const prerequisiteModuleIds = prerequisiteCandidates
    .filter((candidate) => {
      const key = curriculumPacketKey(candidate.packet)
      if (key === moduleKey || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((candidate) => selfStudyModuleId(candidate.packet, candidate.index))
  const nextSameTrack = selected
    .map((candidate, index) => ({ packet: candidate, index }))
    .filter((candidate) => candidate.index > selectedIndex && candidate.packet.track.track_id === packet.track.track_id)
    .slice(0, 2)
    .map((candidate) => selfStudyModuleId(candidate.packet, candidate.index))
  const assignmentSkills = uniq(moduleAssignments.flatMap((assignment) => assignment.skills_trained ?? []))
  const outputFormats = uniq(moduleAssignments.map((assignment) => assignment.output_format).filter(Boolean))
  const deliverables = uniq(moduleAssignments.flatMap((assignment) => assignment.deliverables ?? [])).slice(0, 8)
  const stage = curriculumDependencyStage({ packet, selectedTrackRank, moduleAssignments, moduleReadings, moduleScheduleRows })
  const prerequisiteBasis = [
    prerequisiteModuleIds.length
      ? packet.track.track_id === 'foundation_studio'
        ? 'depends on earlier selected modules in the same track'
        : 'depends on the foundation anchor plus earlier selected modules in the same track'
      : 'starts the selected sequence for this track',
    assignmentSkills.length ? `skill signals: ${assignmentSkills.slice(0, 6).join(', ')}` : null,
    outputFormats.length ? `output formats: ${outputFormats.slice(0, 4).join(', ')}` : null,
    deliverables.length ? `deliverables: ${deliverables.slice(0, 6).join(', ')}` : null,
    moduleScheduleRows.length ? 'schedule rows indicate a repeatable studio rhythm' : null,
    moduleReadings.length ? 'reading/resource rows support independent preparation' : null,
  ].filter(Boolean)
  return {
    dependency_stage: stage,
    prerequisite_module_ids: prerequisiteModuleIds,
    enables_module_ids: nextSameTrack,
    dependency_basis: prerequisiteBasis,
    dependency_note: 'Generated for self-study sequencing from public corpus evidence; this is not an official RISD prerequisite map.',
  }
}

function curriculumPracticeInstruction(assignment) {
  return {
    assignment_id: assignment.assignment_id,
    instruction: [
      assignment.deliverables?.length ? `make ${assignment.deliverables.slice(0, 3).join(', ')}` : 'make the recovered artifact',
      assignment.constraints?.length ? `under constraints: ${assignment.constraints.slice(0, 3).join(', ')}` : null,
      assignment.critique_format || assignment.revision_expectation ? `critique/revise: ${assignment.critique_format ?? assignment.revision_expectation}` : 'write a critique memo and revise once',
      assignment.output_format ? `output: ${assignment.output_format}` : null,
    ].filter(Boolean).join('; '),
    evidence_basis: 'filtered_assignment_candidate',
  }
}

function selfStudyModuleConfidence({ course, courseSyllabi, moduleAssignments, moduleReadings, moduleScheduleRows, comparisonSet, moduleUnknowns }) {
  const evidenceGradePoints = { A: 35, B: 26, C: 16, D: 8, E: 3 }[course.evidence_grade] ?? 0
  const completeAssignmentCount = moduleAssignments.filter((assignment) => assignment.boundary_status === 'bounded_assignment_brief' || assignment.assignment_confidence === 'high').length
  const critiqueAssignmentCount = moduleAssignments.filter((assignment) => assignment.critique_format || assignment.revision_expectation || assignment.critique_questions?.length).length
  const sourceFamilyCount = new Set([
    ...(course.source_ids ?? []),
    ...courseSyllabi.flatMap((syllabus) => syllabus.source_ids ?? []),
    ...moduleAssignments.flatMap((assignment) => assignment.source_ids ?? []),
  ]).size
  const comparisonStrength = comparisonSet.some((comparison) => comparison.relationship_type === 'assignment_link')
    ? 'assignment_linked'
    : comparisonSet.some((comparison) => comparison.relationship_type === 'brief_page_link')
      ? 'brief_page_linked'
      : comparisonSet.length
        ? 'course_context_only'
        : 'missing'
  const scheduleStrength = moduleScheduleRows.some((row) => row.date || row.week_number || row.due_assignment_ids?.length || row.reading_ids?.length)
    ? 'ordered_or_linked'
    : moduleScheduleRows.length
      ? 'contextual'
      : 'missing'
  const score = Math.max(0, Math.min(100,
    evidenceGradePoints
      + Math.min(sourceFamilyCount * 2, 14)
      + Math.min(completeAssignmentCount * 7, 21)
      + Math.min(moduleReadings.length * 2, 12)
      + (scheduleStrength === 'ordered_or_linked' ? 10 : scheduleStrength === 'contextual' ? 4 : 0)
      + Math.min(critiqueAssignmentCount * 4, 8)
      + (comparisonStrength === 'assignment_linked' ? 8 : comparisonStrength === 'brief_page_linked' ? 5 : comparisonStrength === 'course_context_only' ? 2 : 0)
      - Math.min(moduleUnknowns.length * 4, 16)
  ))
  const confidenceBand = score >= 80 ? 'high' : score >= 55 ? 'medium' : 'low'
  const strengths = [
    course.evidence_grade ? `course evidence grade ${course.evidence_grade}` : null,
    sourceFamilyCount ? `${sourceFamilyCount} source IDs across course, syllabus, and selected assignment evidence` : null,
    completeAssignmentCount ? `${completeAssignmentCount} selected complete/high-confidence assignment brief${completeAssignmentCount === 1 ? '' : 's'}` : null,
    moduleReadings.length ? `${moduleReadings.length} usable reading/resource row${moduleReadings.length === 1 ? '' : 's'}` : null,
    scheduleStrength !== 'missing' ? `${scheduleStrength === 'ordered_or_linked' ? 'ordered or assignment-linked' : 'contextual'} schedule rhythm evidence` : null,
    critiqueAssignmentCount ? `${critiqueAssignmentCount} assignment row${critiqueAssignmentCount === 1 ? '' : 's'} with critique/revision evidence` : null,
    comparisonStrength !== 'missing' ? `${comparisonStrength.replace(/_/g, '-')} public comparison evidence` : null,
  ].filter(Boolean)
  const limitations = [
    ...moduleUnknowns.slice(0, 4),
    comparisonStrength === 'course_context_only' ? 'student-work comparison is not assignment-linked' : null,
    scheduleStrength === 'missing' ? 'no reusable schedule rows selected' : null,
  ].filter(Boolean)
  return {
    confidence_score: score,
    confidence_band: confidenceBand,
    confidence_factors: {
      source_family_count: sourceFamilyCount,
      complete_assignment_count: completeAssignmentCount,
      selected_assignment_count: moduleAssignments.length,
      selected_reading_count: moduleReadings.length,
      selected_schedule_count: moduleScheduleRows.length,
      critique_revision_assignment_count: critiqueAssignmentCount,
      comparison_strength: comparisonStrength,
      schedule_strength: scheduleStrength,
      missing_evidence_count: moduleUnknowns.length,
    },
    confidence_explanation: {
      selection_reason: `Selected for ${course.course_title ?? course.course_code ?? course.course_id} because it has ${completeAssignmentCount} reusable studio brief${completeAssignmentCount === 1 ? '' : 's'} and ${course.evidence_grade ?? 'unknown'}-grade course evidence in the ${course.evidence_grade === 'A' ? 'strongest' : 'available'} public corpus tier.`,
      strengths,
      limitations,
    },
  }
}

function buildSelfStudyModules({ courses, syllabi, assignments, readings, scheduleRows = [], studentWork, studentWorkAssignmentLinks = [] }) {
  const packets = curriculumCoursePackets({ courses, syllabi, assignments, readings, studentWork, studentWorkAssignmentLinks, scheduleRows })
  const selected = curriculumSelectedPackets(packets)
  const studentWorkById = new Map(studentWork.map((work) => [work.student_work_id, work]))
  return selected.map((packet, index) => {
    const { course, track, courseSyllabi, courseAssignments, courseReadings, courseScheduleRows, courseStudentWork, courseStudentWorkLinks } = packet
    const moduleAssignments = curriculumAssignmentCandidates(courseAssignments).slice(0, 6)
    const moduleReadings = curriculumReadingCandidates(courseReadings).slice(0, 8)
    const moduleScheduleRows = curriculumScheduleCandidates(courseScheduleRows).slice(0, 8)
    const moduleUnknowns = curriculumModuleUnknowns({ courseSyllabi, assignments: courseAssignments, readings: courseReadings, scheduleRows: courseScheduleRows, studentWorkLinks: courseStudentWorkLinks })
    const comparisonSet = courseStudentWorkLinks.length
      ? courseStudentWorkLinks.slice(0, 6).map((link) => ({
        relationship_type: link.relationship_type,
        student_work_id: link.student_work_id,
        student_work_url: link.student_work_url,
        assignment_id: link.assignment_id ?? null,
        brief_page_id: link.brief_page_id ?? null,
        comparison_use: link.comparison_use ?? [],
        evidence_grade: link.evidence_grade,
        source_ids: studentWorkById.get(link.student_work_id)?.source_ids ?? link.source_ids ?? [],
        relationship_note: link.assignment_title ? `assignment: ${link.assignment_title}` : link.brief_page_id ? `brief page: ${link.brief_page_id}` : 'course context',
      }))
      : courseStudentWork
        .filter((work) => work.course_code || work.course_title)
        .slice(0, 6)
        .map((work) => ({
          relationship_type: 'course_context_only',
          student_work_id: work.student_work_id,
          student_work_url: work.url,
          assignment_id: null,
          brief_page_id: null,
          comparison_use: ['visual_calibration'],
          evidence_grade: work.evidence_grade,
          source_ids: work.source_ids ?? [],
          relationship_note: 'course-context evidence only',
        }))
    const sourceIds = uniq([
      ...(course.source_ids ?? []),
      ...courseSyllabi.flatMap((syllabus) => syllabus.source_ids ?? []),
      ...moduleAssignments.flatMap((assignment) => assignment.source_ids ?? []),
      ...moduleReadings.flatMap((reading) => reading.source_ids ?? []),
      ...comparisonSet.flatMap((comparison) => studentWorkById.get(comparison.student_work_id)?.source_ids ?? []),
    ])
    const primaryAssignment = moduleAssignments[0]
    const confidence = selfStudyModuleConfidence({ course, courseSyllabi, moduleAssignments, moduleReadings, moduleScheduleRows, comparisonSet, moduleUnknowns })
    const orderingRationale = curriculumOrderingRationale({ packet, selected, packets, selectedIndex: index })
    const dependencyMap = curriculumDependencyMap({ packet, selected, selectedIndex: index, moduleAssignments, moduleReadings, moduleScheduleRows })
    return {
      module_id: selfStudyModuleId(packet, index),
      generated_at: retrievedAt,
      track_id: track.track_id,
      track_title: track.title,
      studio_loop: track.studio_loop,
      course_id: course.course_id ?? null,
      course_code: course.course_code ?? null,
      course_title: course.course_title ?? null,
      evidence_grade: course.evidence_grade ?? null,
      module_confidence_score: confidence.confidence_score,
      module_confidence_band: confidence.confidence_band,
      module_confidence_factors: confidence.confidence_factors,
      module_confidence_explanation: confidence.confidence_explanation,
      module_ordering_rationale: orderingRationale,
      module_dependency_map: dependencyMap,
      source_ids: sourceIds,
      syllabus_ids: courseSyllabi.map((syllabus) => syllabus.syllabus_id),
      instructor_evidence: uniq(courseSyllabi.map((syllabus) => syllabus.instructor).filter(Boolean)),
      tools_materials: uniq(courseSyllabi.flatMap((syllabus) => [...(syllabus.tools ?? []), ...(syllabus.materials ?? [])])).slice(0, 12),
      skill_targets: uniq([...(course.skills ?? []), ...moduleAssignments.flatMap((assignment) => assignment.skills_trained ?? [])]).slice(0, 12),
      assignment_ids: moduleAssignments.map((assignment) => assignment.assignment_id),
      assignments: moduleAssignments.map((assignment) => ({
        assignment_id: assignment.assignment_id,
        title: assignment.title,
        prompt_excerpt: assignment.prompt_excerpt,
        deliverables: assignment.deliverables ?? [],
        constraints: assignment.constraints ?? [],
        process_steps: assignment.process_steps ?? [],
        submission_requirements: assignment.submission_requirements ?? [],
        grading_criteria: assignment.grading_criteria ?? [],
        critique_format: assignment.critique_format ?? null,
        revision_expectation: assignment.revision_expectation ?? null,
        output_format: assignment.output_format ?? null,
        source_ids: assignment.source_ids ?? [],
        evidence_grade: assignment.evidence_grade ?? null,
      })),
      reading_ids: moduleReadings.map((reading) => reading.reading_id),
      readings: moduleReadings.map((reading) => ({
        reading_id: reading.reading_id,
        title: reading.title,
        raw_citation: reading.raw_citation,
        author: reading.author,
        citation_type: reading.citation_type,
        reading_context: reading.reading_context,
        semantic_status: reading.semantic_status,
        required_or_recommended: reading.required_or_recommended,
        linked_assignment_ids: reading.linked_assignment_ids ?? [],
        linked_schedule_ids: reading.linked_schedule_ids ?? [],
        source_ids: reading.source_ids ?? [],
      })),
      schedule_ids: moduleScheduleRows.map((row) => row.schedule_id),
      schedule_rows: moduleScheduleRows.map((row) => ({
        schedule_id: row.schedule_id,
        date: row.date,
        week_number: row.week_number,
        session_title: row.session_title,
        agenda_excerpt: row.agenda_excerpt,
        due_assignment_ids: row.due_assignment_ids ?? [],
        reading_ids: row.reading_ids ?? [],
        critique_signal: row.critique_signal,
        workshop_signal: row.workshop_signal,
        source_id: row.source_id,
      })),
      comparison_set: comparisonSet,
      practice_instruction: primaryAssignment ? curriculumPracticeInstruction(primaryAssignment) : null,
      missing_evidence_warnings: moduleUnknowns,
      provenance_note: 'Generated from public corpus artifacts only; private syllabi/readings/rubrics are not inferred.',
    }
  })
}

function buildSelfStudyPacingPlan(selfStudyModules) {
  const rows = []
  let weekNumber = 1
  for (const module of selfStudyModules) {
    const assignment = module.assignments?.[0] ?? null
    const secondAssignment = module.assignments?.[1] ?? null
    const readingIds = (module.reading_ids ?? []).slice(0, 4)
    const scheduleIds = (module.schedule_ids ?? []).slice(0, 3)
    const prerequisiteModuleIds = module.module_dependency_map?.prerequisite_module_ids ?? []
    const firstWorkload = estimatePacingWorkload({ module, assignment, readingCount: readingIds.length, phase: 'make' })
    rows.push({
      pacing_id: `pace_${String(weekNumber).padStart(2, '0')}_${module.module_id}`,
      week_number: weekNumber,
      module_id: module.module_id,
      module_stage: module.module_dependency_map?.dependency_stage ?? 'intermediate_practice',
      track_id: module.track_id,
      track_title: module.track_title,
      course_code: module.course_code,
      course_title: module.course_title,
      prerequisite_module_ids: prerequisiteModuleIds,
      focus: `Prepare ${module.course_title ?? module.course_code ?? module.module_id}: read, inspect evidence, and set up the first artifact.`,
      assignment_id: assignment?.assignment_id ?? module.practice_instruction?.assignment_id ?? null,
      reading_ids: readingIds,
      schedule_ids: scheduleIds,
      studio_actions: [
        readingIds.length ? 'read or skim the selected packet/resources' : 'inspect source excerpts and missing evidence warnings',
        assignment ? `start ${assignment.title ?? assignment.assignment_id}` : 'define the artifact from the recovered practice instruction',
        'collect constraints, output format, and critique questions in a one-page brief',
      ],
      expected_output: assignment?.deliverables?.length ? assignment.deliverables.slice(0, 3).join(', ') : 'brief, sketches, and first prototype',
      critique_checkpoint: 'End the week with a written self-critique against recovered constraints and evidence boundaries.',
      workload_estimate: firstWorkload,
      evidence_basis: 'module_dependency_map_and_selected_assignment',
      source_ids: module.source_ids?.slice(0, 8) ?? [],
    })
    weekNumber += 1
    const secondWorkload = estimatePacingWorkload({ module, assignment: secondAssignment ?? assignment, readingCount: readingIds.slice(0, 2).length, phase: 'revise' })
    rows.push({
      pacing_id: `pace_${String(weekNumber).padStart(2, '0')}_${module.module_id}`,
      week_number: weekNumber,
      module_id: module.module_id,
      module_stage: module.module_dependency_map?.dependency_stage ?? 'intermediate_practice',
      track_id: module.track_id,
      track_title: module.track_title,
      course_code: module.course_code,
      course_title: module.course_title,
      prerequisite_module_ids: prerequisiteModuleIds,
      focus: `Revise and present ${module.course_title ?? module.course_code ?? module.module_id}.`,
      assignment_id: secondAssignment?.assignment_id ?? assignment?.assignment_id ?? module.practice_instruction?.assignment_id ?? null,
      reading_ids: readingIds.slice(0, 2),
      schedule_ids: scheduleIds,
      studio_actions: [
        'revise the artifact once after critique',
        secondAssignment ? `optionally start adjacent brief ${secondAssignment.assignment_id}` : 'document before/after decisions',
        'compare against public student-work or source examples only within stated evidence boundaries',
      ],
      expected_output: secondAssignment?.deliverables?.length ? `revision plus ${secondAssignment.deliverables.slice(0, 3).join(', ')}` : 'revised artifact and critique memo',
      critique_checkpoint: 'Present the revision, list three decisions changed by critique, and record what remains unknown.',
      workload_estimate: secondWorkload,
      evidence_basis: 'module_dependency_map_and_revision_loop',
      source_ids: module.source_ids?.slice(0, 8) ?? [],
    })
    weekNumber += 1
  }
  return rows
}

function estimatePacingWorkload({ module, assignment, readingCount, phase }) {
  const stage = module.module_dependency_map?.dependency_stage ?? 'intermediate_practice'
  const deliverableCount = assignment?.deliverables?.length ?? 1
  const hasInteractiveOutput = /interactive|website|time_based|multi_page|publication|identity|system/i.test([assignment?.output_format, assignment?.deliverables?.join(' ')].filter(Boolean).join(' '))
  const stageHours = { foundation: 5, intermediate_practice: 7, advanced_synthesis: 9 }[stage] ?? 7
  const phaseHours = phase === 'revise' ? 3 : 5
  const readingHours = Math.min(readingCount * 1.5, 5)
  const deliverableHours = Math.min(deliverableCount * 1.5, 5)
  const complexityHours = hasInteractiveOutput ? 3 : 0
  const estimatedHours = Math.round(stageHours + phaseHours + readingHours + deliverableHours + complexityHours)
  return {
    estimated_hours: estimatedHours,
    workload_band: estimatedHours >= 18 ? 'heavy' : estimatedHours >= 12 ? 'medium' : 'light',
    estimate_basis: [
      `stage:${stage}`,
      `phase:${phase}`,
      `readings:${readingCount}`,
      `deliverables:${deliverableCount}`,
      hasInteractiveOutput ? 'complex_output:true' : 'complex_output:false',
    ],
  }
}

function buildSelfStudyPacingProfiles(pacingPlan) {
  const totalHours = pacingPlan.reduce((sum, row) => sum + (row.workload_estimate?.estimated_hours ?? 0), 0)
  const totalRows = pacingPlan.length
  const profileSpecs = [
    { profile_id: 'compressed', label: 'Compressed', rows_per_week: 2, target_hours_per_week: 38 },
    { profile_id: 'standard', label: 'Standard', rows_per_week: 1, target_hours_per_week: 19 },
    { profile_id: 'slow', label: 'Slow', rows_per_week: 0.5, target_hours_per_week: 10 },
  ]
  return profileSpecs.map((profile) => {
    const calendarWeeks = profile.rows_per_week >= 1
      ? Math.ceil(totalRows / profile.rows_per_week)
      : totalRows * Math.round(1 / profile.rows_per_week)
    return {
      profile_id: profile.profile_id,
      label: profile.label,
      generated_at: retrievedAt,
      pacing_row_count: totalRows,
      module_count: new Set(pacingPlan.map((row) => row.module_id)).size,
      estimated_total_hours: totalHours,
      target_hours_per_week: profile.target_hours_per_week,
      estimated_calendar_weeks: calendarWeeks,
      row_grouping_rule: profile.rows_per_week >= 1
        ? `${profile.rows_per_week} pacing row${profile.rows_per_week === 1 ? '' : 's'} per calendar week`
        : 'one pacing row every two calendar weeks',
      weekly_groups: groupPacingRowsForProfile(pacingPlan, profile),
      provenance_note: 'Generated from self_study_pacing_plan workload estimates; adjust manually when recovered syllabi include explicit workload expectations.',
    }
  })
}

function groupPacingRowsForProfile(pacingPlan, profile) {
  const groups = []
  if (profile.rows_per_week >= 1) {
    for (let index = 0; index < pacingPlan.length; index += profile.rows_per_week) {
      const rows = pacingPlan.slice(index, index + profile.rows_per_week)
      groups.push(pacingProfileGroup(groups.length + 1, rows))
    }
    return groups
  }
  let calendarWeek = 1
  for (const row of pacingPlan) {
    groups.push(pacingProfileGroup(calendarWeek, [row]))
    calendarWeek += 2
  }
  return groups
}

function pacingProfileGroup(calendarWeek, rows) {
  return {
    calendar_week: calendarWeek,
    pacing_ids: rows.map((row) => row.pacing_id),
    module_ids: uniq(rows.map((row) => row.module_id)),
    estimated_hours: rows.reduce((sum, row) => sum + (row.workload_estimate?.estimated_hours ?? 0), 0),
    focus: rows.map((row) => row.focus),
  }
}

function buildSelfStudyProgressLedger(selfStudyModules, pacingPlan) {
  const modulesById = new Map(selfStudyModules.map((module) => [module.module_id, module]))
  return pacingPlan.map((row) => {
    const module = modulesById.get(row.module_id)
    const unresolvedWarnings = module?.missing_evidence_warnings ?? []
    const assignment = module?.assignments?.find((item) => item.assignment_id === row.assignment_id) ?? module?.assignments?.[0] ?? null
    return {
      ledger_id: `ledger_${row.pacing_id}`,
      generated_at: retrievedAt,
      pacing_id: row.pacing_id,
      week_number: row.week_number,
      module_id: row.module_id,
      module_stage: row.module_stage,
      track_id: row.track_id,
      track_title: row.track_title,
      course_code: row.course_code ?? null,
      course_title: row.course_title ?? null,
      assignment_id: row.assignment_id ?? null,
      reading_ids: row.reading_ids ?? [],
      expected_output: row.expected_output,
      output_checklist: [
        {
          item_id: `${row.pacing_id}_artifact`,
          label: row.expected_output,
          status: 'not_started',
          evidence_to_attach: ['artifact file or URL', 'short process note'],
        },
        {
          item_id: `${row.pacing_id}_process`,
          label: 'process documentation',
          status: 'not_started',
          evidence_to_attach: ['sketches, drafts, screenshots, or prototype snapshots'],
        },
        {
          item_id: `${row.pacing_id}_source_boundary`,
          label: 'source boundary checked',
          status: 'not_started',
          evidence_to_attach: ['source IDs reviewed', 'unknowns copied into critique memo'],
        },
      ],
      critique_revision_log: [
        {
          log_id: `${row.pacing_id}_critique_01`,
          prompt: row.critique_checkpoint,
          revision_status: 'pending',
          revision_evidence_to_attach: ['before state', 'critique notes', 'after state', 'decision rationale'],
        },
      ],
      unresolved_evidence_warnings: unresolvedWarnings,
      evidence_warning_log: {
        status: unresolvedWarnings.length ? 'open_warnings_to_preserve' : 'no_module_warnings',
        action: unresolvedWarnings.length
          ? 'Copy these warnings into the module critique memo before marking the week complete.'
          : 'Keep checking source IDs; no module-level warning was generated for this row.',
      },
      completion_status: 'not_started',
      workload_estimate: row.workload_estimate,
      source_ids: uniq([...(row.source_ids ?? []), ...(assignment?.source_ids ?? []), ...(module?.source_ids?.slice(0, 4) ?? [])]),
      provenance_note: 'Learner-facing progress ledger generated from pacing rows and module evidence; completion fields are templates for self-study tracking, not observed student progress.',
    }
  })
}

function selfStudyProgressLedgerMarkdown(progressLedger) {
  const rowsByStage = groupBy(progressLedger, (row) => row.module_stage ?? 'unknown')
  const lines = [
    '# RISD Graphic Design Self-Study Progress Ledger',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'This ledger is a learner-facing tracking template generated from the public-evidence pacing plan. Status fields start as `not_started` or `pending`; update copies of this file during self-study rather than treating generated rows as completed work.',
    '',
    `- Ledger rows: ${progressLedger.length}`,
    `- Rows with unresolved warnings: ${progressLedger.filter((row) => row.unresolved_evidence_warnings?.length).length}`,
    '',
  ]
  for (const [stage, rows] of rowsByStage.entries()) {
    lines.push(`## ${stage.replace(/_/g, ' ')}`)
    lines.push('')
    for (const row of rows) {
      lines.push(`### Week ${row.week_number}: ${row.course_title ?? row.module_id}`)
      lines.push('')
      lines.push(`- Ledger ID: ${row.ledger_id}`)
      lines.push(`- Pacing row: ${row.pacing_id}`)
      lines.push(`- Expected output: ${row.expected_output}`)
      lines.push(`- Completion status: ${row.completion_status}`)
      if (row.portfolio_review) {
        lines.push(`- Portfolio milestone: ${row.portfolio_review.milestone_title} (${row.portfolio_review.milestone_id})`)
        lines.push(`- Portfolio completion gate: ${row.portfolio_review.completion_gate_id} (${row.portfolio_review.readiness_status})`)
      }
      lines.push(`- Critique prompt: ${row.critique_revision_log[0]?.prompt}`)
      lines.push(`- Source IDs: ${row.source_ids.slice(0, 8).join(', ')}`)
      lines.push('- Output checklist:')
      row.output_checklist.forEach((item) => lines.push(`  - [ ] ${item.label} (${item.evidence_to_attach.join('; ')})`))
      if (row.unresolved_evidence_warnings.length) {
        lines.push('- Evidence warnings to preserve:')
        row.unresolved_evidence_warnings.forEach((warning) => lines.push(`  - ${warning}`))
      }
      lines.push('')
    }
  }
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioProgressRollups(portfolioMilestones, portfolioExportManifests, progressLedger) {
  const manifestByMilestone = new Map(portfolioExportManifests.map((manifest) => [manifest.milestone_id, manifest]))
  const ledgerByPacing = new Map(progressLedger.map((entry) => [entry.pacing_id, entry]))
  return portfolioMilestones.map((milestone) => {
    const manifest = manifestByMilestone.get(milestone.milestone_id)
    const ledgerRows = (milestone.pacing_ids ?? []).map((id) => ledgerByPacing.get(id)).filter(Boolean)
    const outputRollup = ledgerRows.map((entry) => ({
      ledger_id: entry.ledger_id,
      week_number: entry.week_number,
      module_id: entry.module_id,
      expected_output: entry.expected_output,
      completion_status: entry.completion_status,
      checklist_item_ids: entry.output_checklist?.map((item) => item.item_id) ?? [],
    }))
    const critiqueRollup = ledgerRows.flatMap((entry) => (entry.critique_revision_log ?? []).map((log) => ({
      ledger_id: entry.ledger_id,
      log_id: log.log_id,
      prompt: log.prompt,
      revision_status: log.revision_status,
    })))
    const warningRows = ledgerRows.filter((entry) => entry.unresolved_evidence_warnings?.length)
    return {
      rollup_id: `progress_rollup_${milestone.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: milestone.milestone_id,
      export_manifest_id: manifest?.manifest_id ?? null,
      title: `${milestone.title} Progress Rollup`,
      ledger_ids: ledgerRows.map((entry) => entry.ledger_id),
      pacing_ids: ledgerRows.map((entry) => entry.pacing_id),
      module_ids: uniq(ledgerRows.map((entry) => entry.module_id)),
      portfolio_output_rollup: outputRollup,
      critique_revision_rollup: critiqueRollup,
      evidence_warning_rollup: {
        warning_ledger_ids: warningRows.map((entry) => entry.ledger_id),
        unresolved_warning_count: warningRows.reduce((sum, entry) => sum + (entry.unresolved_evidence_warnings?.length ?? 0), 0),
        warnings: uniq(warningRows.flatMap((entry) => entry.unresolved_evidence_warnings ?? [])),
        action: 'Before marking the portfolio milestone complete, copy unresolved warnings into the portfolio brief critique memo or resolve them with stronger public evidence.',
      },
      rollup_totals: {
        ledger_rows: ledgerRows.length,
        outputs_to_complete: outputRollup.length,
        critique_revisions_to_log: critiqueRollup.length,
        unresolved_warning_rows: warningRows.length,
      },
      source_ids: uniq(ledgerRows.flatMap((entry) => entry.source_ids ?? [])),
      provenance_note: 'Generated rollup connecting weekly self-study progress ledger rows to the portfolio milestone export manifest.',
    }
  })
}

function buildSelfStudyPortfolioCompletionGates(portfolioProgressRollups) {
  return portfolioProgressRollups.map((rollup) => {
    const outputCount = rollup.rollup_totals?.outputs_to_complete ?? rollup.portfolio_output_rollup?.length ?? 0
    const critiqueCount = rollup.rollup_totals?.critique_revisions_to_log ?? rollup.critique_revision_rollup?.length ?? 0
    const warningCount = rollup.evidence_warning_rollup?.unresolved_warning_count ?? 0
    const gateChecks = [
      {
        check_id: `${rollup.rollup_id}_outputs_complete`,
        label: 'All expected weekly outputs are complete and attached.',
        current_status: 'pending',
        required_evidence: rollup.portfolio_output_rollup.map((item) => `${item.ledger_id}: ${item.expected_output}`),
      },
      {
        check_id: `${rollup.rollup_id}_critique_revisions_logged`,
        label: 'Each weekly critique/revision log includes before, critique, after, and rationale evidence.',
        current_status: 'pending',
        required_evidence: rollup.critique_revision_rollup.map((item) => `${item.ledger_id}: ${item.prompt}`),
      },
      {
        check_id: `${rollup.rollup_id}_warnings_resolved_or_disclosed`,
        label: 'Unresolved evidence warnings are either resolved with public evidence or disclosed in the portfolio brief.',
        current_status: 'pending',
        required_evidence: rollup.evidence_warning_rollup?.warnings?.length
          ? rollup.evidence_warning_rollup.warnings
          : ['No unresolved warning rows generated for this milestone.'],
      },
      {
        check_id: `${rollup.rollup_id}_export_manifest_packaged`,
        label: 'Portfolio export manifest package contains the brief, reference packet, source excerpt packet, and source ID manifest.',
        current_status: 'pending',
        required_evidence: [rollup.export_manifest_id],
      },
    ]
    return {
      gate_id: `completion_gate_${rollup.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: rollup.milestone_id,
      progress_rollup_id: rollup.rollup_id,
      export_manifest_id: rollup.export_manifest_id,
      current_readiness_status: 'not_ready_template',
      gate_checks: gateChecks,
      blocking_conditions: [
        `${outputCount} output checklist row${outputCount === 1 ? '' : 's'} still need learner-supplied completion evidence.`,
        `${critiqueCount} critique/revision log${critiqueCount === 1 ? '' : 's'} still need learner-supplied before/after evidence.`,
        warningCount
          ? `${warningCount} unresolved evidence warning${warningCount === 1 ? '' : 's'} must be disclosed or resolved before review.`
          : 'No generated unresolved warnings block review, but source boundaries still need final confirmation.',
      ],
      ready_when: [
        'All gate checks are marked satisfied in the learner-maintained copy of the ledger.',
        'Every output in the rollup has attached artifact/process evidence.',
        'Every critique/revision log has before state, critique notes, after state, and decision rationale.',
        'Evidence warnings are copied into the portfolio brief or resolved with stronger public source evidence.',
      ],
      review_packet_targets: {
        ledger_ids: rollup.ledger_ids,
        export_manifest_id: rollup.export_manifest_id,
        source_ids: rollup.source_ids ?? [],
      },
      provenance_note: 'Generated readiness gate for self-study portfolio review; statuses are templates until the learner supplies completion evidence.',
    }
  })
}

function buildSelfStudyPortfolioEvidenceAttachments(portfolioMilestones, progressRollups, completionGates, exportManifests) {
  const rollupByMilestone = new Map(progressRollups.map((rollup) => [rollup.milestone_id, rollup]))
  const gateByMilestone = new Map(completionGates.map((gate) => [gate.milestone_id, gate]))
  const manifestByMilestone = new Map(exportManifests.map((manifest) => [manifest.milestone_id, manifest]))
  return portfolioMilestones.map((milestone) => {
    const rollup = rollupByMilestone.get(milestone.milestone_id)
    const gate = gateByMilestone.get(milestone.milestone_id)
    const manifest = manifestByMilestone.get(milestone.milestone_id)
    const outputSlots = (rollup?.portfolio_output_rollup ?? []).flatMap((item) => [
      portfolioEvidenceAttachmentSlot({
        milestoneId: milestone.milestone_id,
        ledgerId: item.ledger_id,
        slotRole: 'final_artifact',
        title: `Final artifact for week ${item.week_number}`,
        requiredForGateCheckId: `${rollup.rollup_id}_outputs_complete`,
        expectedEvidence: item.expected_output,
      }),
      portfolioEvidenceAttachmentSlot({
        milestoneId: milestone.milestone_id,
        ledgerId: item.ledger_id,
        slotRole: 'process_evidence',
        title: `Process evidence for week ${item.week_number}`,
        requiredForGateCheckId: `${rollup.rollup_id}_outputs_complete`,
        expectedEvidence: item.checklist_item_ids?.join(', ') ?? 'process checklist evidence',
      }),
    ])
    const critiqueSlots = (rollup?.critique_revision_rollup ?? []).flatMap((item) => [
      portfolioEvidenceAttachmentSlot({
        milestoneId: milestone.milestone_id,
        ledgerId: item.ledger_id,
        logId: item.log_id,
        slotRole: 'critique_notes',
        title: `Critique notes for ${item.log_id}`,
        requiredForGateCheckId: `${rollup.rollup_id}_critique_revisions_logged`,
        expectedEvidence: item.prompt,
      }),
      portfolioEvidenceAttachmentSlot({
        milestoneId: milestone.milestone_id,
        ledgerId: item.ledger_id,
        logId: item.log_id,
        slotRole: 'revision_proof',
        title: `Before/after revision proof for ${item.log_id}`,
        requiredForGateCheckId: `${rollup.rollup_id}_critique_revisions_logged`,
        expectedEvidence: 'before state, after state, and decision rationale',
      }),
    ])
    const warningSlots = (rollup?.evidence_warning_rollup?.warnings ?? []).map((warning, index) => portfolioEvidenceAttachmentSlot({
      milestoneId: milestone.milestone_id,
      slotRole: 'source_boundary_memo',
      title: `Evidence boundary memo ${index + 1}`,
      requiredForGateCheckId: `${rollup.rollup_id}_warnings_resolved_or_disclosed`,
      expectedEvidence: warning,
    }))
    const exportSlots = (manifest?.export_files ?? []).map((file) => portfolioEvidenceAttachmentSlot({
      milestoneId: milestone.milestone_id,
      slotRole: 'export_package_file',
      title: file.file_role,
      requiredForGateCheckId: `${rollup?.rollup_id}_export_manifest_packaged`,
      expectedEvidence: file.path,
      defaultPath: file.path,
    }))
    const attachmentSlots = [...outputSlots, ...critiqueSlots, ...warningSlots, ...exportSlots]
    return {
      attachment_manifest_id: `evidence_attachment_manifest_${milestone.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: milestone.milestone_id,
      progress_rollup_id: rollup?.rollup_id ?? null,
      completion_gate_id: gate?.gate_id ?? null,
      export_manifest_id: manifest?.manifest_id ?? null,
      title: `${milestone.title} Evidence Attachment Manifest`,
      attachment_slots: attachmentSlots,
      gate_check_coverage: (gate?.gate_checks ?? []).map((check) => ({
        check_id: check.check_id,
        label: check.label,
        slot_ids: attachmentSlots.filter((slot) => slot.required_for_gate_check_id === check.check_id).map((slot) => slot.slot_id),
      })),
      manifest_totals: {
        slots: attachmentSlots.length,
        missing_attachment_slots: attachmentSlots.filter((slot) => slot.attachment_status === 'missing').length,
        learner_supplied_slots: attachmentSlots.filter((slot) => slot.attachment_status === 'attached').length,
      },
      import_instructions: [
        'Copy this row into a learner-maintained evidence attachment tracker and fill attachment_uri or local_path for each slot.',
        'Use stable file paths or URLs that can be copied into reviewer feedback evidence_refs and gate status imports.',
        'Do not mark a completion gate ready until every required gate check has attached evidence slots.',
      ],
      provenance_note: 'Generated learner evidence attachment manifest from portfolio rollups, completion gates, and export manifests.',
    }
  })
}

function portfolioEvidenceAttachmentSlot({ milestoneId, ledgerId = null, logId = null, slotRole, title, requiredForGateCheckId, expectedEvidence, defaultPath = null }) {
  const contextId = [ledgerId, logId, slotRole, defaultPath ?? title].filter(Boolean).join('_') || slotRole
  const slotId = `attachment_${milestoneId}_${slug(contextId)}`
  return {
    slot_id: slotId,
    slot_role: slotRole,
    title,
    ledger_id: ledgerId,
    critique_log_id: logId,
    required_for_gate_check_id: requiredForGateCheckId,
    expected_evidence: expectedEvidence,
    attachment_status: defaultPath ? 'attached' : 'missing',
    attachment_uri: '',
    local_path: defaultPath ?? '',
    media_type: inferAttachmentMediaType(defaultPath),
    reviewer_evidence_ref: defaultPath ? `${slotId}:${defaultPath}` : slotId,
  }
}

function inferAttachmentMediaType(path) {
  if (!path) return 'unknown'
  if (/\.md$/i.test(path)) return 'text/markdown'
  if (/\.jsonl?$/i.test(path)) return 'application/json'
  if (/\.pdf$/i.test(path)) return 'application/pdf'
  if (/\.(png|jpg|jpeg|gif|webp)$/i.test(path)) return 'image/*'
  return 'application/octet-stream'
}

function buildSelfStudyPortfolioGateStatusTemplate(portfolioCompletionGates) {
  return portfolioCompletionGates.map((gate) => ({
    import_id: `status_import_${gate.gate_id}`,
    generated_at: retrievedAt,
    gate_id: gate.gate_id,
    milestone_id: gate.milestone_id,
    progress_rollup_id: gate.progress_rollup_id,
    target_readiness_status: gate.current_readiness_status,
    check_updates: (gate.gate_checks ?? []).map((check) => ({
      check_id: check.check_id,
      current_status: check.current_status,
      evidence_refs: [],
      learner_note: '',
    })),
    import_instructions: [
      'Copy this row into self_study_portfolio_gate_status_import.jsonl, then change individual check current_status values to satisfied only after attaching evidence_refs.',
      'Use target_readiness_status=ready_for_review only when every check_update current_status is satisfied.',
      'Do not edit generated portfolio briefs, ledgers, or completion gates directly; regenerate them after updating the import file.',
    ],
    provenance_note: 'Generated learner status import template for updating portfolio completion gates outside generated artifacts.',
  }))
}

function applySelfStudyPortfolioGateStatusImports(portfolioCompletionGates, statusImports = []) {
  const importsByGateId = new Map(statusImports.filter((row) => row.gate_id).map((row) => [row.gate_id, row]))
  return portfolioCompletionGates.map((gate) => {
    const imported = importsByGateId.get(gate.gate_id)
    if (!imported) return gate
    const updatesByCheckId = new Map((imported.check_updates ?? []).filter((update) => update.check_id).map((update) => [update.check_id, update]))
    const gateChecks = (gate.gate_checks ?? []).map((check) => {
      const update = updatesByCheckId.get(check.check_id)
      if (!update) return check
      return {
        ...check,
        current_status: update.current_status === 'satisfied' ? 'satisfied' : 'pending',
        learner_evidence_refs: update.evidence_refs ?? [],
        learner_note: update.learner_note ?? '',
      }
    })
    const allSatisfied = gateChecks.length > 0 && gateChecks.every((check) => check.current_status === 'satisfied')
    const importedReady = imported.target_readiness_status === 'ready_for_review' && allSatisfied
    return {
      ...gate,
      current_readiness_status: importedReady ? 'ready_for_review' : 'not_ready_template',
      gate_checks: gateChecks,
      blocking_conditions: allSatisfied ? [] : gateChecks
        .filter((check) => check.current_status !== 'satisfied')
        .map((check) => `${check.label} still needs learner-supplied evidence before review.`),
      applied_status_import_id: imported.import_id ?? null,
      learner_status_updated_at: imported.updated_at ?? imported.generated_at ?? null,
    }
  })
}

function buildSelfStudyPortfolioGateStatusSummary(baseGates, appliedGates, statusImports = []) {
  const baseByGateId = new Map(baseGates.map((gate) => [gate.gate_id, gate]))
  const importsByGateId = new Map(statusImports.filter((row) => row.gate_id).map((row) => [row.gate_id, row]))
  return appliedGates.map((gate) => {
    const baseGate = baseByGateId.get(gate.gate_id)
    const imported = importsByGateId.get(gate.gate_id) ?? null
    const baseChecksById = new Map((baseGate?.gate_checks ?? []).map((check) => [check.check_id, check]))
    const checkSummaries = (gate.gate_checks ?? []).map((check) => {
      const baseCheck = baseChecksById.get(check.check_id)
      return {
        check_id: check.check_id,
        label: check.label,
        before_status: baseCheck?.current_status ?? null,
        after_status: check.current_status,
        status_changed: Boolean(baseCheck && baseCheck.current_status !== check.current_status),
        evidence_refs: check.learner_evidence_refs ?? [],
        learner_note: check.learner_note ?? '',
      }
    })
    const changedChecks = checkSummaries.filter((check) => check.status_changed)
    return {
      summary_id: `gate_status_summary_${gate.gate_id}`,
      generated_at: retrievedAt,
      gate_id: gate.gate_id,
      milestone_id: gate.milestone_id,
      progress_rollup_id: gate.progress_rollup_id,
      applied_status_import_id: imported?.import_id ?? null,
      import_applied: Boolean(imported),
      readiness_before: baseGate?.current_readiness_status ?? null,
      readiness_after: gate.current_readiness_status,
      readiness_changed: Boolean(baseGate && baseGate.current_readiness_status !== gate.current_readiness_status),
      changed_check_count: changedChecks.length,
      satisfied_check_count: checkSummaries.filter((check) => check.after_status === 'satisfied').length,
      pending_check_count: checkSummaries.filter((check) => check.after_status === 'pending').length,
      changed_checks: changedChecks,
      blocking_conditions: gate.blocking_conditions ?? [],
      check_summaries: checkSummaries,
      next_action: gate.current_readiness_status === 'ready_for_review'
        ? 'Package the portfolio brief, source excerpt packet, reference packet, and learner evidence for review.'
        : imported
          ? 'Resolve remaining pending checks in the learner status import and regenerate the corpus.'
          : 'Copy the template row into self_study_portfolio_gate_status_import.jsonl, attach evidence_refs, update check statuses, and regenerate.',
      provenance_note: 'Generated applied-status summary comparing base completion gates with optional learner status imports.',
    }
  })
}

function selfStudyPortfolioGateStatusSummaryMarkdown(statusSummaries) {
  const lines = [
    '# RISD Graphic Design Portfolio Gate Status Summary',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'This report explains how optional learner status imports affected portfolio completion gates. It is generated from the gate template, optional import rows, and current completion gates.',
    '',
    `- Summary rows: ${statusSummaries.length}`,
    `- Imports applied: ${statusSummaries.filter((summary) => summary.import_applied).length}`,
    `- Gates ready for review: ${statusSummaries.filter((summary) => summary.readiness_after === 'ready_for_review').length}`,
    `- Gates still blocked: ${statusSummaries.filter((summary) => summary.readiness_after !== 'ready_for_review').length}`,
    '',
  ]
  for (const summary of statusSummaries) {
    lines.push(`## ${summary.milestone_id}`)
    lines.push('')
    lines.push(`- Gate: ${summary.gate_id}`)
    lines.push(`- Import applied: ${summary.import_applied ? summary.applied_status_import_id : 'none'}`)
    lines.push(`- Readiness: ${summary.readiness_before} -> ${summary.readiness_after}`)
    lines.push(`- Changed checks: ${summary.changed_check_count}`)
    lines.push(`- Satisfied checks: ${summary.satisfied_check_count}`)
    lines.push(`- Pending checks: ${summary.pending_check_count}`)
    lines.push(`- Next action: ${summary.next_action}`)
    if (summary.blocking_conditions.length) {
      lines.push('- Blocking conditions:')
      summary.blocking_conditions.forEach((condition) => lines.push(`  - ${condition}`))
    }
    lines.push('- Check status:')
    summary.check_summaries.forEach((check) => {
      const changed = check.status_changed ? 'changed' : 'unchanged'
      const evidence = check.evidence_refs.length ? `; evidence: ${check.evidence_refs.join(', ')}` : ''
      lines.push(`  - ${check.label}: ${check.before_status} -> ${check.after_status} (${changed}${evidence})`)
    })
    lines.push('')
  }
  return lines.map((line) => line.trimEnd()).join('\n')
}

function selfStudyPortfolioEvidenceAttachmentsMarkdown(manifests) {
  const lines = [
    '# RISD Graphic Design Portfolio Evidence Attachment Manifest',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'Use these rows as the stable evidence map for learner portfolio review. Fill missing attachment URIs or local paths before copying evidence refs into reviewer feedback or gate status imports.',
    '',
    `- Manifests: ${manifests.length}`,
    `- Attachment slots: ${manifests.reduce((sum, manifest) => sum + (manifest.manifest_totals?.slots ?? 0), 0)}`,
    `- Missing learner evidence slots: ${manifests.reduce((sum, manifest) => sum + (manifest.manifest_totals?.missing_attachment_slots ?? 0), 0)}`,
    '',
  ]
  for (const manifest of manifests) {
    lines.push(`## ${manifest.title}`)
    lines.push('')
    lines.push(`- Manifest ID: ${manifest.attachment_manifest_id}`)
    lines.push(`- Milestone: ${manifest.milestone_id}`)
    lines.push(`- Completion gate: ${manifest.completion_gate_id}`)
    lines.push(`- Export manifest: ${manifest.export_manifest_id}`)
    lines.push(`- Slots: ${manifest.manifest_totals.slots}`)
    lines.push(`- Missing attachment slots: ${manifest.manifest_totals.missing_attachment_slots}`)
    lines.push('- Gate check coverage:')
    manifest.gate_check_coverage.forEach((coverage) => lines.push(`  - ${coverage.check_id}: ${coverage.slot_ids.length} slot${coverage.slot_ids.length === 1 ? '' : 's'}`))
    lines.push('- Attachment slots:')
    manifest.attachment_slots.forEach((slot) => {
      const location = slot.local_path || slot.attachment_uri || 'missing'
      lines.push(`  - ${slot.slot_id}: ${slot.slot_role}; ${slot.attachment_status}; ${location}`)
    })
    lines.push('')
  }
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioReviewIndex(portfolioMilestones, portfolioBriefs, gateStatusSummaries, referencePackets, sourceExcerptPackets, exportManifests) {
  const briefByMilestone = new Map(portfolioBriefs.map((brief) => [brief.milestone_id, brief]))
  const summaryByMilestone = new Map(gateStatusSummaries.map((summary) => [summary.milestone_id, summary]))
  const referenceByMilestone = new Map(referencePackets.map((packet) => [packet.milestone_id, packet]))
  const excerptByMilestone = new Map(sourceExcerptPackets.map((packet) => [packet.milestone_id, packet]))
  const manifestByMilestone = new Map(exportManifests.map((manifest) => [manifest.milestone_id, manifest]))
  return portfolioMilestones.map((milestone) => {
    const brief = briefByMilestone.get(milestone.milestone_id)
    const summary = summaryByMilestone.get(milestone.milestone_id)
    const referencePacket = referenceByMilestone.get(milestone.milestone_id)
    const sourceExcerptPacket = excerptByMilestone.get(milestone.milestone_id)
    const exportManifest = manifestByMilestone.get(milestone.milestone_id)
    const blockerTypes = classifyPortfolioReviewBlockerTypes(summary?.blocking_conditions ?? [])
    const artifactCompleteness = [
      brief?.brief_id,
      summary?.summary_id,
      referencePacket?.packet_id,
      sourceExcerptPacket?.packet_id,
      exportManifest?.manifest_id,
    ].every(Boolean) ? 'complete' : 'incomplete'
    const workloadBand = portfolioReviewWorkloadBand(milestone.estimated_hours)
    return {
      index_id: `portfolio_review_index_${milestone.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: milestone.milestone_id,
      title: milestone.title,
      week_range: milestone.week_range ?? [],
      module_count: milestone.module_ids?.length ?? 0,
      estimated_hours: milestone.estimated_hours,
      readiness_status: summary?.readiness_after ?? 'not_ready_template',
      import_applied: summary?.import_applied ?? false,
      pending_check_count: summary?.pending_check_count ?? null,
      blocking_condition_count: summary?.blocking_conditions?.length ?? null,
      dashboard_filters: {
        readiness: summary?.readiness_after ?? 'not_ready_template',
        stage: milestone.milestone_stage ?? 'unknown',
        import_state: summary?.import_applied ? 'import_applied' : 'no_import',
        blocker_types: blockerTypes,
        workload_band: workloadBand,
        artifact_completeness: artifactCompleteness,
      },
      dashboard_groups: {
        readiness_group: summary?.readiness_after === 'ready_for_review' ? 'ready' : 'blocked',
        stage_group: milestone.milestone_stage ?? 'unknown',
        import_group: summary?.import_applied ? 'learner_updated' : 'template_only',
        blocker_group: blockerTypes.length ? blockerTypes.join('+') : 'no_blockers',
      },
      primary_next_action: summary?.next_action ?? 'Review generated portfolio packets and status gates.',
      linked_artifacts: {
        portfolio_brief: {
          brief_id: brief?.brief_id ?? null,
          path: brief?.output_path ?? null,
        },
        gate_status_summary: {
          summary_id: summary?.summary_id ?? null,
          path: 'self_study_portfolio_gate_status_summary.md',
          row_path: 'self_study_portfolio_gate_status_summary.jsonl',
        },
        source_excerpt_packet: {
          packet_id: sourceExcerptPacket?.packet_id ?? null,
          path: 'self_study_portfolio_source_excerpt_packets.jsonl',
        },
        reference_packet: {
          packet_id: referencePacket?.packet_id ?? null,
          path: 'self_study_portfolio_reference_packets.jsonl',
        },
        export_manifest: {
          manifest_id: exportManifest?.manifest_id ?? null,
          path: 'self_study_portfolio_export_manifests.jsonl',
        },
      },
      review_focus: milestone.review_focus,
      provenance_note: 'Generated compact index linking each portfolio milestone to its review packet, readiness summary, source context, references, and export manifest.',
    }
  })
}

function classifyPortfolioReviewBlockerTypes(blockingConditions) {
  return uniq(blockingConditions.map((condition) => {
    const lower = condition.toLowerCase()
    if (/\boutput|artifact|checklist\b/.test(lower)) return 'missing_outputs'
    if (/\bcritique|revision|before\/after\b/.test(lower)) return 'missing_critique_revisions'
    if (/\bwarning|source|evidence boundary|disclosed|resolved\b/.test(lower)) return 'unresolved_evidence_warnings'
    if (/\bmanifest|package|export\b/.test(lower)) return 'missing_export_package'
    return 'other_blocker'
  })).filter(Boolean)
}

function portfolioReviewWorkloadBand(estimatedHours) {
  if (!Number.isFinite(estimatedHours)) return 'unknown'
  if (estimatedHours >= 180) return 'large'
  if (estimatedHours >= 100) return 'medium'
  return 'small'
}

function selfStudyPortfolioReviewIndexMarkdown(reviewIndex) {
  const lines = [
    '# RISD Graphic Design Portfolio Review Index',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'This compact index links each self-study portfolio milestone to the artifacts needed for review. It is generated from public corpus evidence and learner status imports when present.',
    '',
    `- Milestones: ${reviewIndex.length}`,
    `- Ready for review: ${reviewIndex.filter((row) => row.readiness_status === 'ready_for_review').length}`,
    `- Still blocked: ${reviewIndex.filter((row) => row.readiness_status !== 'ready_for_review').length}`,
    '',
    '| Milestone | Readiness | Brief | Gate Status | Source Excerpts | References | Export Manifest | Next Action |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ]
  reviewIndex.forEach((row) => {
    const brief = row.linked_artifacts.portfolio_brief
    const summary = row.linked_artifacts.gate_status_summary
    const excerpts = row.linked_artifacts.source_excerpt_packet
    const references = row.linked_artifacts.reference_packet
    const manifest = row.linked_artifacts.export_manifest
    lines.push(`| ${row.title} | ${row.readiness_status} | ${brief.path ?? 'missing'} | ${summary.path}#${summary.summary_id ?? row.milestone_id} | ${excerpts.path}#${excerpts.packet_id ?? row.milestone_id} | ${references.path}#${references.packet_id ?? row.milestone_id} | ${manifest.path}#${manifest.manifest_id ?? row.milestone_id} | ${row.primary_next_action} |`)
  })
  lines.push('')
  reviewIndex.forEach((row) => {
    lines.push(`## ${row.title}`)
    lines.push('')
    lines.push(`- Milestone ID: ${row.milestone_id}`)
    lines.push(`- Weeks: ${row.week_range.length ? row.week_range.join('-') : 'unknown'}`)
    lines.push(`- Modules: ${row.module_count}`)
    lines.push(`- Estimated hours: ${row.estimated_hours}`)
    lines.push(`- Readiness: ${row.readiness_status}`)
    lines.push(`- Dashboard filters: readiness=${row.dashboard_filters.readiness}; stage=${row.dashboard_filters.stage}; import=${row.dashboard_filters.import_state}; blockers=${row.dashboard_filters.blocker_types.join(', ') || 'none'}; workload=${row.dashboard_filters.workload_band}; artifacts=${row.dashboard_filters.artifact_completeness}`)
    lines.push(`- Pending checks: ${row.pending_check_count}`)
    lines.push(`- Blocking conditions: ${row.blocking_condition_count}`)
    lines.push(`- Review focus: ${row.review_focus}`)
    lines.push('- Artifacts:')
    lines.push(`  - Brief: ${row.linked_artifacts.portfolio_brief.path}`)
    lines.push(`  - Gate status summary: ${row.linked_artifacts.gate_status_summary.path} (${row.linked_artifacts.gate_status_summary.summary_id})`)
    lines.push(`  - Source excerpt packet: ${row.linked_artifacts.source_excerpt_packet.path} (${row.linked_artifacts.source_excerpt_packet.packet_id})`)
    lines.push(`  - Reference packet: ${row.linked_artifacts.reference_packet.path} (${row.linked_artifacts.reference_packet.packet_id})`)
    lines.push(`  - Export manifest: ${row.linked_artifacts.export_manifest.path} (${row.linked_artifacts.export_manifest.manifest_id})`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioReviewerHandoff(reviewIndex) {
  return reviewIndex.map((row) => {
    const blockerTypes = row.dashboard_filters?.blocker_types ?? []
    const artifactList = [
      row.linked_artifacts.portfolio_brief.path,
      `${row.linked_artifacts.gate_status_summary.path}#${row.linked_artifacts.gate_status_summary.summary_id}`,
      `${row.linked_artifacts.source_excerpt_packet.path}#${row.linked_artifacts.source_excerpt_packet.packet_id}`,
      `${row.linked_artifacts.reference_packet.path}#${row.linked_artifacts.reference_packet.packet_id}`,
      `${row.linked_artifacts.export_manifest.path}#${row.linked_artifacts.export_manifest.manifest_id}`,
    ]
    return {
      handoff_id: `reviewer_handoff_${row.milestone_id}`,
      generated_at: retrievedAt,
      review_index_id: row.index_id,
      milestone_id: row.milestone_id,
      title: row.title,
      readiness_status: row.readiness_status,
      dashboard_filters: row.dashboard_filters,
      reviewer_context: {
        review_focus: row.review_focus,
        estimated_hours: row.estimated_hours,
        week_range: row.week_range,
        module_count: row.module_count,
        artifact_paths: artifactList,
      },
      pre_review_checklist: [
        {
          item_id: `${row.index_id}_pre_01`,
          label: 'Open the portfolio brief and confirm the evidence boundary is visible.',
          required_artifact: row.linked_artifacts.portfolio_brief.path,
          status: 'pending',
        },
        {
          item_id: `${row.index_id}_pre_02`,
          label: 'Open the gate status summary and identify unresolved blockers before the critique starts.',
          required_artifact: row.linked_artifacts.gate_status_summary.path,
          status: 'pending',
        },
        {
          item_id: `${row.index_id}_pre_03`,
          label: 'Open the source excerpt and reference packets for calibration without treating context-only examples as assignment facts.',
          required_artifact: `${row.linked_artifacts.source_excerpt_packet.path}; ${row.linked_artifacts.reference_packet.path}`,
          status: 'pending',
        },
      ],
      live_review_actions: [
        'Ask the learner to present the final artifacts before process evidence.',
        'Ask what changed after critique and require a before/after example.',
        'Check the work against the source-bound constraints and explicitly separate observed evidence from inference.',
        blockerTypes.includes('unresolved_evidence_warnings')
          ? 'Discuss each unresolved evidence warning and decide whether it is resolved, disclosed, or still blocking.'
          : 'Confirm there are no unresolved evidence warnings blocking the milestone.',
      ],
      critique_prompts: [
        'Which constraints are visible in the final artifacts?',
        'What changed after critique, and what evidence proves the change?',
        'Which source-grounded reading, schedule, or assignment detail changed a design decision?',
        'What remains uncertain because the public corpus lacks private classroom material?',
      ],
      post_review_followup: [
        row.readiness_status === 'ready_for_review'
          ? 'Package the export manifest and archive the review notes with the portfolio brief.'
          : row.primary_next_action,
        'Update the learner status import with satisfied checks, evidence refs, and notes before regenerating.',
        'Keep unresolved source boundaries in the next critique memo rather than smoothing them over.',
      ],
      blocking_focus: blockerTypes,
      provenance_note: 'Generated mentor handoff checklist from the portfolio review index; it is a self-study review aid, not an official RISD critique protocol.',
    }
  })
}

function selfStudyPortfolioReviewerHandoffMarkdown(handoffs) {
  const lines = [
    '# RISD Graphic Design Reviewer Handoff Checklist',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'Use this checklist to run an external critique or mentor review from the generated portfolio review index. It preserves evidence boundaries and turns each milestone into concrete review actions.',
    '',
    `- Handoffs: ${handoffs.length}`,
    `- Ready for review: ${handoffs.filter((row) => row.readiness_status === 'ready_for_review').length}`,
    `- Blocked/template reviews: ${handoffs.filter((row) => row.readiness_status !== 'ready_for_review').length}`,
    '',
  ]
  for (const handoff of handoffs) {
    lines.push(`## ${handoff.title}`)
    lines.push('')
    lines.push(`- Handoff ID: ${handoff.handoff_id}`)
    lines.push(`- Review index row: ${handoff.review_index_id}`)
    lines.push(`- Readiness: ${handoff.readiness_status}`)
    lines.push(`- Blocking focus: ${handoff.blocking_focus.length ? handoff.blocking_focus.join(', ') : 'none'}`)
    lines.push(`- Review focus: ${handoff.reviewer_context.review_focus}`)
    lines.push('- Required artifacts:')
    handoff.reviewer_context.artifact_paths.forEach((path) => lines.push(`  - ${path}`))
    lines.push('- Pre-review checklist:')
    handoff.pre_review_checklist.forEach((item) => lines.push(`  - [ ] ${item.label} (${item.required_artifact})`))
    lines.push('- Live review actions:')
    handoff.live_review_actions.forEach((action) => lines.push(`  - ${action}`))
    lines.push('- Critique prompts:')
    handoff.critique_prompts.forEach((prompt) => lines.push(`  - ${prompt}`))
    lines.push('- Post-review follow-up:')
    handoff.post_review_followup.forEach((action) => lines.push(`  - ${action}`))
    lines.push('')
  }
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioReviewerFeedbackTemplate(handoffs, evidenceAttachments = []) {
  const attachmentsByMilestone = new Map(evidenceAttachments.map((manifest) => [manifest.milestone_id, manifest]))
  return handoffs.map((handoff) => {
    const evidenceManifest = attachmentsByMilestone.get(handoff.milestone_id)
    const allowedEvidenceRefs = (evidenceManifest?.attachment_slots ?? []).map((slot) => ({
      evidence_ref: slot.reviewer_evidence_ref,
      slot_id: slot.slot_id,
      slot_role: slot.slot_role,
      required_for_gate_check_id: slot.required_for_gate_check_id,
      attachment_status: slot.attachment_status,
      expected_evidence: slot.expected_evidence,
    }))
    const evidenceRefsByBlocker = evidenceRefsForBlockerTypes(allowedEvidenceRefs)
    return {
      feedback_id: `feedback_${handoff.handoff_id}`,
      generated_at: retrievedAt,
      handoff_id: handoff.handoff_id,
      review_index_id: handoff.review_index_id,
      milestone_id: handoff.milestone_id,
      evidence_attachment_manifest_id: evidenceManifest?.attachment_manifest_id ?? null,
      reviewer_name: '',
      review_date: '',
      outcome: 'not_reviewed',
      allowed_evidence_refs: allowedEvidenceRefs,
      status_updates: (evidenceManifest?.gate_check_coverage ?? []).map((coverage) => ({
        check_id: coverage.check_id,
        current_status: 'pending',
        evidence_refs: coverage.slot_ids,
        reviewer_note: '',
      })),
      revision_items: handoff.blocking_focus.map((blockerType, index) => ({
        revision_id: `${handoff.handoff_id}_revision_${String(index + 1).padStart(2, '0')}`,
        blocker_type: blockerType,
        priority: blockerType === 'missing_outputs' ? 'high' : 'medium',
        prompt: reviewerRevisionPrompt(blockerType),
        evidence_refs: evidenceRefsByBlocker.get(blockerType) ?? [],
        owner: 'learner',
        status: 'pending',
      })),
      reviewer_notes: '',
      import_instructions: [
        'Copy this row into self_study_portfolio_reviewer_feedback_import.jsonl after review.',
        'Set outcome to ready_for_review, needs_revision, or blocked.',
        'Use only allowed_evidence_refs slot IDs or reviewer_evidence_ref values when filling status_updates and revision_items.',
        'Mark status_updates satisfied only for gate checks the reviewer can verify from evidence attachment refs.',
        'Keep revision_items that still need learner work; mark completed items resolved only with evidence refs.',
      ],
      provenance_note: 'Generated reviewer feedback capture template from portfolio reviewer handoff rows and evidence attachment manifests.',
    }
  })
}

function evidenceRefsForBlockerTypes(allowedEvidenceRefs) {
  const refsByRole = groupBy(allowedEvidenceRefs, (ref) => ref.slot_role)
  return new Map([
    ['missing_outputs', [...(refsByRole.get('final_artifact') ?? []), ...(refsByRole.get('process_evidence') ?? [])].map((ref) => ref.slot_id)],
    ['missing_critique_revisions', [...(refsByRole.get('critique_notes') ?? []), ...(refsByRole.get('revision_proof') ?? [])].map((ref) => ref.slot_id)],
    ['unresolved_evidence_warnings', (refsByRole.get('source_boundary_memo') ?? []).map((ref) => ref.slot_id)],
    ['missing_export_package', (refsByRole.get('export_package_file') ?? []).map((ref) => ref.slot_id)],
    ['other_blocker', allowedEvidenceRefs.map((ref) => ref.slot_id)],
  ])
}

function reviewerRevisionPrompt(blockerType) {
  if (blockerType === 'missing_outputs') return 'Attach final artifact/process evidence for every expected output named in the gate status summary.'
  if (blockerType === 'missing_critique_revisions') return 'Add before/after critique evidence and decision rationale for every pending critique/revision check.'
  if (blockerType === 'unresolved_evidence_warnings') return 'Resolve the evidence warning with stronger public evidence or disclose it in the critique memo.'
  if (blockerType === 'missing_export_package') return 'Package the brief, reference packet, source excerpt packet, and source IDs through the export manifest.'
  return 'Resolve the reviewer-identified blocker and attach evidence.'
}

function buildSelfStudyPortfolioReviewerFeedbackSmokeFixture(feedbackTemplates) {
  const template = feedbackTemplates[0]
  if (!template) return []
  return [{
    feedback_id: `smoke_${template.feedback_id}`,
    generated_at: retrievedAt,
    handoff_id: template.handoff_id,
    review_index_id: template.review_index_id,
    milestone_id: template.milestone_id,
    evidence_attachment_manifest_id: template.evidence_attachment_manifest_id,
    reviewer_name: 'Smoke fixture reviewer',
    review_date: retrievedAt,
    outcome: 'ready_for_review',
    status_updates: (template.status_updates ?? []).map((update) => ({
      check_id: update.check_id,
      current_status: 'satisfied',
      evidence_refs: update.evidence_refs ?? [],
      reviewer_note: 'Smoke fixture: verifies this gate check can be satisfied with evidence attachment slot refs.',
    })),
    revision_items: (template.revision_items ?? []).map((item) => ({
      revision_id: `smoke_${item.revision_id}`,
      blocker_type: item.blocker_type,
      priority: item.priority,
      prompt: item.prompt,
      evidence_refs: item.evidence_refs ?? [],
      owner: item.owner ?? 'learner',
      status: 'resolved',
    })),
    reviewer_notes: 'Smoke fixture generated from the feedback template to prove reviewer feedback imports can drive revision queue and gate status suggestions with real attachment refs.',
    smoke_fixture: true,
    provenance_note: 'Generated smoke fixture only; do not copy into the live reviewer feedback import unless intentionally testing with fixture data.',
  }]
}

function selfStudyPortfolioReviewerFeedbackSmokeMarkdown({ smokeFixture, smokeRevisionQueue, smokeGateStatusSuggestions }) {
  const readySuggestions = smokeGateStatusSuggestions.filter((row) => row.suggestion_status === 'ready_to_copy')
  const resolvedQueueRows = smokeRevisionQueue.filter((row) => row.status === 'resolved')
  const lines = [
    '# RISD Graphic Design Reviewer Feedback Import Smoke Fixture',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'This fixture exercises the reviewer feedback import path with real evidence attachment refs without changing the live learner import file.',
    '',
    `- Fixture import rows: ${smokeFixture.length}`,
    `- Smoke revision queue rows: ${smokeRevisionQueue.length}`,
    `- Smoke resolved revision rows: ${resolvedQueueRows.length}`,
    `- Smoke gate suggestions ready to copy: ${readySuggestions.length}`,
    '',
  ]
  smokeFixture.forEach((row) => {
    lines.push(`## ${row.feedback_id}`)
    lines.push('')
    lines.push(`- Milestone: ${row.milestone_id}`)
    lines.push(`- Handoff: ${row.handoff_id}`)
    lines.push(`- Evidence attachment manifest: ${row.evidence_attachment_manifest_id}`)
    lines.push(`- Outcome: ${row.outcome}`)
    lines.push(`- Satisfied status updates: ${row.status_updates.filter((update) => update.current_status === 'satisfied').length}`)
    lines.push(`- Resolved revision items: ${row.revision_items.filter((item) => item.status === 'resolved').length}`)
    lines.push('')
  })
  readySuggestions.forEach((row) => {
    lines.push(`## Ready Suggestion: ${row.suggestion_id}`)
    lines.push('')
    lines.push(`- Gate: ${row.gate_id}`)
    lines.push(`- Suggested import: ${row.suggested_gate_status_import?.import_id ?? 'missing'}`)
    lines.push(`- Target readiness: ${row.suggested_gate_status_import?.target_readiness_status ?? 'missing'}`)
    lines.push(`- Check updates: ${row.suggested_gate_status_import?.check_updates?.length ?? 0}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioReviewWorkflow({ reviewIndex, evidenceAttachments, feedbackTemplates, revisionQueue, gateStatusSuggestions, gateStatusTemplate, smokeFixture }) {
  const evidenceByMilestone = new Map(evidenceAttachments.map((row) => [row.milestone_id, row]))
  const feedbackByMilestone = new Map(feedbackTemplates.map((row) => [row.milestone_id, row]))
  const gateSuggestionByMilestone = new Map(gateStatusSuggestions.map((row) => [row.milestone_id, row]))
  const gateTemplateByMilestone = new Map(gateStatusTemplate.map((row) => [row.milestone_id, row]))
  const revisionRowsByMilestone = groupBy(revisionQueue, (row) => row.milestone_id)
  const smokeByMilestone = new Map(smokeFixture.map((row) => [row.milestone_id, row]))
  return reviewIndex.map((row) => {
    const evidence = evidenceByMilestone.get(row.milestone_id)
    const feedback = feedbackByMilestone.get(row.milestone_id)
    const suggestion = gateSuggestionByMilestone.get(row.milestone_id)
    const template = gateTemplateByMilestone.get(row.milestone_id)
    const revisionRows = revisionRowsByMilestone.get(row.milestone_id) ?? []
    const smoke = smokeByMilestone.get(row.milestone_id)
    return {
      workflow_id: `review_workflow_${row.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: row.milestone_id,
      title: row.title,
      readiness_status: row.readiness_status,
      linked_artifacts: {
        review_index_id: row.index_id,
        evidence_attachment_manifest_id: evidence?.attachment_manifest_id ?? null,
        reviewer_feedback_template_id: feedback?.feedback_id ?? null,
        reviewer_feedback_smoke_fixture_id: smoke?.feedback_id ?? null,
        revision_queue_ids: revisionRows.map((item) => item.queue_id),
        gate_status_suggestion_id: suggestion?.suggestion_id ?? null,
        gate_status_template_import_id: template?.import_id ?? null,
      },
      ordered_steps: [
        reviewWorkflowStep(1, 'open_review_packet', 'Open the portfolio review index row and linked brief/source/reference/export artifacts.', ['portfolio_review_index.jsonl', row.linked_artifacts?.portfolio_brief?.path, row.linked_artifacts?.source_excerpt_packet?.path, row.linked_artifacts?.reference_packet?.path, row.linked_artifacts?.export_manifest?.path].filter(Boolean)),
        reviewWorkflowStep(2, 'attach_evidence', 'Fill final artifact, process, critique, revision, source-boundary, and export package slots before review.', ['self_study_portfolio_evidence_attachments.jsonl', evidence?.attachment_manifest_id].filter(Boolean)),
        reviewWorkflowStep(3, 'capture_reviewer_feedback', 'Copy the reviewer feedback template row into the reviewer feedback import file and use only allowed evidence refs.', ['self_study_portfolio_reviewer_feedback_template.jsonl', 'self_study_portfolio_reviewer_feedback_import.jsonl', feedback?.feedback_id].filter(Boolean)),
        reviewWorkflowStep(4, 'regenerate_revision_queue', 'Regenerate the corpus so reviewer feedback imports become revision queue rows.', ['self_study_portfolio_revision_queue.jsonl', ...revisionRows.map((item) => item.queue_id)]),
        reviewWorkflowStep(5, 'promote_gate_status', 'Use gate status suggestions to copy verified satisfied checks into the learner gate status import.', ['self_study_portfolio_gate_status_suggestions.jsonl', 'self_study_portfolio_gate_status_import.jsonl', suggestion?.suggestion_id, template?.import_id].filter(Boolean)),
        reviewWorkflowStep(6, 'verify_ready_state', 'Regenerate and confirm gate status summary, review index, and portfolio brief reflect the updated readiness state.', ['self_study_portfolio_gate_status_summary.jsonl', 'self_study_portfolio_review_index.jsonl', 'self_study_portfolio_briefs/*.md']),
      ],
      smoke_test_note: smoke
        ? `Smoke fixture ${smoke.feedback_id} proves this milestone can round-trip through reviewer feedback, revision queue, and gate status suggestion artifacts.`
        : 'No smoke fixture row is generated for this milestone; use the foundation fixture as a reference before applying live imports.',
      next_action: suggestion?.suggestion_status === 'ready_to_copy'
        ? 'Copy the suggested gate status import, regenerate, and verify readiness.'
        : 'Complete evidence attachments and reviewer feedback import before expecting a ready gate status suggestion.',
      provenance_note: 'Generated learner-facing workflow checklist that sequences portfolio review artifacts without mutating live import files.',
    }
  })
}

function reviewWorkflowStep(stepNumber, step_id, action, artifact_refs) {
  return {
    step_number: stepNumber,
    step_id,
    status: 'not_started',
    action,
    artifact_refs,
  }
}

function selfStudyPortfolioReviewWorkflowMarkdown(workflows) {
  const lines = [
    '# RISD Graphic Design Portfolio Review Workflow',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'Use this checklist to move from evidence attachments to reviewer feedback, revisions, gate status suggestions, and final learner gate status imports.',
    '',
    `- Workflow rows: ${workflows.length}`,
    `- Rows with smoke fixture: ${workflows.filter((row) => row.linked_artifacts.reviewer_feedback_smoke_fixture_id).length}`,
    '',
  ]
  workflows.forEach((workflow) => {
    lines.push(`## ${workflow.title}`)
    lines.push('')
    lines.push(`- Workflow ID: ${workflow.workflow_id}`)
    lines.push(`- Milestone: ${workflow.milestone_id}`)
    lines.push(`- Readiness: ${workflow.readiness_status}`)
    lines.push(`- Evidence manifest: ${workflow.linked_artifacts.evidence_attachment_manifest_id}`)
    lines.push(`- Feedback template: ${workflow.linked_artifacts.reviewer_feedback_template_id}`)
    lines.push(`- Gate suggestion: ${workflow.linked_artifacts.gate_status_suggestion_id}`)
    lines.push(`- Gate status template: ${workflow.linked_artifacts.gate_status_template_import_id}`)
    lines.push(`- Smoke test: ${workflow.smoke_test_note}`)
    lines.push('- Steps:')
    workflow.ordered_steps.forEach((step) => {
      lines.push(`  - [ ] ${step.step_number}. ${step.action}`)
      lines.push(`    - Artifacts: ${step.artifact_refs.join('; ')}`)
    })
    lines.push(`- Next action: ${workflow.next_action}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioReviewAgendas(reviewWorkflows, reviewerHandoffs) {
  const handoffByMilestone = new Map(reviewerHandoffs.map((handoff) => [handoff.milestone_id, handoff]))
  return reviewWorkflows.map((workflow) => {
    const handoff = handoffByMilestone.get(workflow.milestone_id)
    const totalMinutes = 75
    return {
      agenda_id: `review_agenda_${workflow.milestone_id}`,
      generated_at: retrievedAt,
      workflow_id: workflow.workflow_id,
      handoff_id: handoff?.handoff_id ?? null,
      milestone_id: workflow.milestone_id,
      title: `${workflow.title} Session Agenda`,
      target_duration_minutes: totalMinutes,
      reviewer_role: 'external mentor or reviewer',
      learner_role: 'self-study portfolio presenter',
      required_artifacts: uniq([
        workflow.workflow_id,
        handoff?.handoff_id,
        workflow.linked_artifacts?.evidence_attachment_manifest_id,
        workflow.linked_artifacts?.reviewer_feedback_template_id,
        workflow.linked_artifacts?.gate_status_suggestion_id,
        workflow.linked_artifacts?.gate_status_template_import_id,
        ...(handoff?.reviewer_context?.artifact_paths ?? []),
      ].filter(Boolean)),
      timed_blocks: [
        reviewAgendaBlock(1, 'setup', 5, 'Open review packet and confirm evidence boundary.', [
          'Confirm the learner is presenting public-evidence-bounded work, not claiming private RISD assessment.',
          workflow.ordered_steps?.[0]?.action ?? 'Open the portfolio review packet.',
        ]),
        reviewAgendaBlock(2, 'learner_presentation', 12, 'Learner presents final artifacts before process evidence.', [
          handoff?.live_review_actions?.[0] ?? 'Ask the learner to present the final artifacts before process evidence.',
          'Stop after the artifact read; defer process explanation until reviewer has recorded first impressions.',
        ]),
        reviewAgendaBlock(3, 'constraint_and_source_check', 15, 'Check visible constraints against source-bound evidence.', [
          handoff?.live_review_actions?.[2] ?? 'Check the work against recovered constraints and separate observed evidence from inference.',
          ...(handoff?.critique_prompts ?? []).slice(0, 2),
        ]),
        reviewAgendaBlock(4, 'critique_revision_review', 18, 'Review critique notes, before/after revisions, and decision rationale.', [
          handoff?.live_review_actions?.[1] ?? 'Ask what changed after critique and require a before/after example.',
          ...(handoff?.critique_prompts ?? []).slice(2, 4),
        ]),
        reviewAgendaBlock(5, 'evidence_gap_decision', 10, 'Resolve, disclose, or keep each evidence warning as blocking.', [
          handoff?.live_review_actions?.[3] ?? 'Confirm unresolved evidence warnings are disclosed or still blocking.',
          workflow.ordered_steps?.[1]?.action ?? 'Check evidence attachment slots before promotion.',
        ]),
        reviewAgendaBlock(6, 'feedback_capture', 10, 'Fill reviewer feedback status updates and revision items.', [
          workflow.ordered_steps?.[2]?.action ?? 'Capture reviewer feedback with allowed evidence refs.',
          workflow.ordered_steps?.[3]?.action ?? 'Regenerate revision queue after feedback import.',
        ]),
        reviewAgendaBlock(7, 'promotion_decision', 5, 'Decide whether gate status can be promoted or remains blocked.', [
          workflow.ordered_steps?.[4]?.action ?? 'Promote verified gate status checks.',
          workflow.ordered_steps?.[5]?.action ?? 'Verify readiness state after regeneration.',
        ]),
      ],
      capture_outputs: [
        'reviewer feedback import row with evidence refs',
        'revision queue rows for unresolved work',
        'gate status suggestion decision',
        'learner gate status import update when all checks are satisfied',
      ],
      post_session_actions: handoff?.post_review_followup ?? [
        'Update reviewer feedback import and regenerate.',
        'Update learner gate status import only after evidence-backed checks are satisfied.',
      ],
      smoke_test_note: workflow.smoke_test_note,
      provenance_note: 'Generated time-boxed critique agenda from portfolio review workflow and reviewer handoff artifacts.',
    }
  })
}

function reviewAgendaBlock(blockNumber, block_id, duration_minutes, objective, prompts) {
  return {
    block_number: blockNumber,
    block_id,
    duration_minutes,
    objective,
    prompts: prompts.filter(Boolean),
  }
}

function selfStudyPortfolioReviewAgendasMarkdown(agendas) {
  const lines = [
    '# RISD Graphic Design Review Session Agendas',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'These agendas compress each portfolio workflow into a timed mentor/reviewer critique script.',
    '',
    `- Agendas: ${agendas.length}`,
    `- Total planned minutes: ${agendas.reduce((sum, agenda) => sum + (agenda.target_duration_minutes ?? 0), 0)}`,
    '',
  ]
  agendas.forEach((agenda) => {
    lines.push(`## ${agenda.title}`)
    lines.push('')
    lines.push(`- Agenda ID: ${agenda.agenda_id}`)
    lines.push(`- Workflow: ${agenda.workflow_id}`)
    lines.push(`- Handoff: ${agenda.handoff_id}`)
    lines.push(`- Duration: ${agenda.target_duration_minutes} minutes`)
    lines.push('- Required artifacts:')
    agenda.required_artifacts.forEach((artifact) => lines.push(`  - ${artifact}`))
    lines.push('- Timed script:')
    agenda.timed_blocks.forEach((block) => {
      lines.push(`  - ${block.block_number}. ${block.objective} (${block.duration_minutes} min)`)
      block.prompts.forEach((prompt) => lines.push(`    - ${prompt}`))
    })
    lines.push('- Capture outputs:')
    agenda.capture_outputs.forEach((output) => lines.push(`  - ${output}`))
    lines.push('- Post-session actions:')
    agenda.post_session_actions.forEach((action) => lines.push(`  - ${action}`))
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioReviewDashboard({ reviewIndex, reviewWorkflow, reviewAgendas, evidenceAttachments, revisionQueue, gateStatusSuggestions, gateStatusSummary }) {
  const workflowByMilestone = new Map(reviewWorkflow.map((row) => [row.milestone_id, row]))
  const agendaByMilestone = new Map(reviewAgendas.map((row) => [row.milestone_id, row]))
  const evidenceByMilestone = new Map(evidenceAttachments.map((row) => [row.milestone_id, row]))
  const gateSuggestionByMilestone = new Map(gateStatusSuggestions.map((row) => [row.milestone_id, row]))
  const gateSummaryByMilestone = new Map(gateStatusSummary.map((row) => [row.milestone_id, row]))
  const revisionRowsByMilestone = groupBy(revisionQueue, (row) => row.milestone_id)
  return reviewIndex.map((row) => {
    const workflow = workflowByMilestone.get(row.milestone_id)
    const agenda = agendaByMilestone.get(row.milestone_id)
    const evidence = evidenceByMilestone.get(row.milestone_id)
    const suggestion = gateSuggestionByMilestone.get(row.milestone_id)
    const summary = gateSummaryByMilestone.get(row.milestone_id)
    const revisions = revisionRowsByMilestone.get(row.milestone_id) ?? []
    const pendingRevisions = revisions.filter((item) => item.status === 'pending')
    const resolvedRevisions = revisions.filter((item) => item.status === 'resolved')
    const missingSlots = evidence?.manifest_totals?.missing_attachment_slots ?? evidence?.attachment_slots?.filter((slot) => slot.attachment_status !== 'attached').length ?? 0
    const totalSlots = evidence?.manifest_totals?.slots ?? evidence?.attachment_slots?.length ?? 0
    const ready = row.readiness_status === 'ready_for_review' && missingSlots === 0 && pendingRevisions.length === 0 && suggestion?.suggestion_status === 'ready_to_copy'
    return {
      dashboard_id: `review_dashboard_${row.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: row.milestone_id,
      title: row.title,
      review_index_id: row.index_id,
      workflow_id: workflow?.workflow_id ?? null,
      agenda_id: agenda?.agenda_id ?? null,
      evidence_attachment_manifest_id: evidence?.attachment_manifest_id ?? null,
      gate_status_summary_id: summary?.summary_id ?? null,
      gate_status_suggestion_id: suggestion?.suggestion_id ?? null,
      readiness_status: row.readiness_status,
      dashboard_state: ready ? 'ready' : 'blocked',
      agenda_minutes: agenda?.target_duration_minutes ?? 0,
      workflow_step_count: workflow?.ordered_steps?.length ?? 0,
      evidence_slots_total: totalSlots,
      evidence_slots_missing: missingSlots,
      revision_queue_pending: pendingRevisions.length,
      revision_queue_resolved: resolvedRevisions.length,
      gate_status_suggestion_status: suggestion?.suggestion_status ?? 'awaiting_feedback',
      blocker_summary: [
        missingSlots > 0 ? `${missingSlots} evidence attachment slots still missing` : 'Evidence attachment manifest has no missing slots',
        pendingRevisions.length > 0 ? `${pendingRevisions.length} revision queue items still pending` : 'No pending revision queue items',
        suggestion?.suggestion_status === 'ready_to_copy' ? 'Gate status suggestion is ready to copy' : `Gate status suggestion is ${suggestion?.suggestion_status ?? 'awaiting_feedback'}`,
        row.primary_next_action,
      ].filter(Boolean),
      rollup_links: [
        dashboardRollupLink('review_index', row.index_id, 'self_study_portfolio_review_index.jsonl'),
        dashboardRollupLink('review_workflow', workflow?.workflow_id, 'self_study_portfolio_review_workflow.jsonl'),
        dashboardRollupLink('review_agenda', agenda?.agenda_id, 'self_study_portfolio_review_agendas.jsonl'),
        dashboardRollupLink('evidence_attachment_manifest', evidence?.attachment_manifest_id, 'self_study_portfolio_evidence_attachments.jsonl'),
        dashboardRollupLink('gate_status_summary', summary?.summary_id, 'self_study_portfolio_gate_status_summary.jsonl'),
        dashboardRollupLink('gate_status_suggestion', suggestion?.suggestion_id, 'self_study_portfolio_gate_status_suggestions.jsonl'),
      ].filter((link) => link.artifact_id),
      primary_next_action: ready
        ? 'Copy the ready gate status suggestion into the learner gate status import and regenerate for final confirmation.'
        : suggestion?.next_action ?? row.primary_next_action,
      provenance_note: 'Generated milestone-level review dashboard rollup from review index, workflow, agenda, evidence attachment, revision queue, gate status summary, and gate status suggestion artifacts.',
    }
  })
}

function dashboardRollupLink(artifact_role, artifact_id, artifact_path) {
  return {
    artifact_role,
    artifact_id,
    artifact_path,
  }
}

function selfStudyPortfolioReviewDashboardMarkdown(rows) {
  const lines = [
    '# RISD Graphic Design Portfolio Review Dashboard',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'This milestone-level board rolls up review workflow, agenda, evidence attachment, revision queue, and gate status state for reviewer/learner follow-through.',
    '',
    `- Dashboard rows: ${rows.length}`,
    `- Ready rows: ${rows.filter((row) => row.dashboard_state === 'ready').length}`,
    `- Pending revisions: ${rows.reduce((sum, row) => sum + (row.revision_queue_pending ?? 0), 0)}`,
    '',
  ]
  rows.forEach((row) => {
    lines.push(`## ${row.title}`)
    lines.push('')
    lines.push(`- Dashboard ID: ${row.dashboard_id}`)
    lines.push(`- Milestone: ${row.milestone_id}`)
    lines.push(`- State: ${row.dashboard_state}`)
    lines.push(`- Readiness: ${row.readiness_status}`)
    lines.push(`- Agenda: ${row.agenda_id} (${row.agenda_minutes} min)`)
    lines.push(`- Workflow: ${row.workflow_id} (${row.workflow_step_count} steps)`)
    lines.push(`- Evidence slots: ${row.evidence_slots_total - row.evidence_slots_missing}/${row.evidence_slots_total} attached`)
    lines.push(`- Revisions: ${row.revision_queue_pending} pending; ${row.revision_queue_resolved} resolved`)
    lines.push(`- Gate suggestion: ${row.gate_status_suggestion_status}`)
    lines.push('- Blocker summary:')
    row.blocker_summary.forEach((item) => lines.push(`  - ${item}`))
    lines.push('- Rollup links:')
    row.rollup_links.forEach((link) => lines.push(`  - ${link.artifact_role}: ${link.artifact_id} (${link.artifact_path})`))
    lines.push(`- Next action: ${row.primary_next_action}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioDecisionPackets({ reviewDashboard, reviewAgendas, reviewerHandoffs, feedbackTemplates, gateStatusSuggestions }) {
  const agendaByMilestone = new Map(reviewAgendas.map((row) => [row.milestone_id, row]))
  const handoffByMilestone = new Map(reviewerHandoffs.map((row) => [row.milestone_id, row]))
  const feedbackByMilestone = new Map(feedbackTemplates.map((row) => [row.milestone_id, row]))
  const suggestionByMilestone = new Map(gateStatusSuggestions.map((row) => [row.milestone_id, row]))
  return reviewDashboard.map((dashboard) => {
    const agenda = agendaByMilestone.get(dashboard.milestone_id)
    const handoff = handoffByMilestone.get(dashboard.milestone_id)
    const feedback = feedbackByMilestone.get(dashboard.milestone_id)
    const suggestion = suggestionByMilestone.get(dashboard.milestone_id)
    const readyToSign = dashboard.dashboard_state === 'ready' || suggestion?.suggestion_status === 'ready_to_copy'
    return {
      decision_packet_id: `decision_packet_${dashboard.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: dashboard.milestone_id,
      title: `${dashboard.title} Post-Session Decision Packet`,
      dashboard_id: dashboard.dashboard_id,
      agenda_id: agenda?.agenda_id ?? null,
      handoff_id: handoff?.handoff_id ?? null,
      feedback_template_id: feedback?.feedback_id ?? null,
      gate_status_suggestion_id: suggestion?.suggestion_id ?? null,
      packet_status: readyToSign ? 'ready_to_sign' : 'blocked_until_review',
      note_sections: [
        decisionPacketSection(1, 'session_context', 'Record reviewer, learner, date, agenda used, and artifacts opened before critique.', 'session_context_notes'),
        decisionPacketSection(2, 'observed_strengths', 'Name the strongest visible outcomes and cite evidence refs rather than general impressions.', 'observed_strengths_notes'),
        decisionPacketSection(3, 'revision_decisions', 'List required revisions, owners, priorities, and evidence refs for before/after proof.', 'revision_decision_notes'),
        decisionPacketSection(4, 'gate_status_decision', 'Decide whether each gate check remains pending or can be copied from the gate status suggestion.', 'gate_status_decision_notes'),
        decisionPacketSection(5, 'source_boundary_notes', 'Preserve public-source uncertainty, missing classroom context, and unsupported inferences.', 'source_boundary_notes'),
        decisionPacketSection(6, 'followup_imports', 'Specify the exact feedback import and learner gate status import edits to make after signing.', 'followup_import_notes'),
      ],
      signature_fields: [
        decisionPacketSignatureField('reviewer_name', 'Reviewer name'),
        decisionPacketSignatureField('reviewer_signature', 'Reviewer signature'),
        decisionPacketSignatureField('learner_acknowledgement', 'Learner acknowledgement'),
        decisionPacketSignatureField('review_date', 'Review date'),
      ],
      import_targets: [
        {
          artifact: 'self_study_portfolio_reviewer_feedback_import.jsonl',
          source_artifact_id: feedback?.feedback_id ?? null,
          target_action: 'Copy the feedback template row, then replace blank outcome, status update notes, revision items, and evidence refs from the signed packet.',
        },
        {
          artifact: 'self_study_portfolio_gate_status_import.jsonl',
          source_artifact_id: suggestion?.suggestion_id ?? null,
          target_action: 'Copy only satisfied, evidence-backed checks from the gate status suggestion after reviewer signature.',
        },
      ],
      offline_review_note_template: [
        `Decision packet: decision_packet_${dashboard.milestone_id}`,
        `Agenda: ${agenda?.agenda_id ?? 'missing'}`,
        `Dashboard state before signature: ${dashboard.dashboard_state}`,
        'Reviewer decision:',
        'Evidence refs cited:',
        'Required revisions:',
        'Gate status updates approved:',
        'Source-boundary notes:',
        'Signatures:',
      ].join('\n'),
      dashboard_snapshot: {
        dashboard_state: dashboard.dashboard_state,
        readiness_status: dashboard.readiness_status,
        evidence_slots_missing: dashboard.evidence_slots_missing,
        revision_queue_pending: dashboard.revision_queue_pending,
        gate_status_suggestion_status: dashboard.gate_status_suggestion_status,
      },
      primary_next_action: readyToSign
        ? 'Collect signatures, apply approved import targets, regenerate, and confirm the dashboard stays ready.'
        : 'Run the agenda, complete reviewer feedback, resolve blocking revisions, then regenerate this packet before signing.',
      provenance_note: 'Generated offline decision packet from review dashboard, agenda, handoff, feedback template, and gate status suggestion artifacts.',
    }
  })
}

function decisionPacketSection(section_number, section_id, prompt, capture_field) {
  return {
    section_number,
    section_id,
    prompt,
    capture_field,
  }
}

function decisionPacketSignatureField(field_id, label) {
  return {
    field_id,
    label,
    status: 'blank',
  }
}

function selfStudyPortfolioDecisionPacketsMarkdown(packets) {
  const lines = [
    '# RISD Graphic Design Post-Session Decision Packets',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'These packets convert review dashboard state and critique agendas into offline notes, signature fields, and exact import targets.',
    '',
    `- Decision packets: ${packets.length}`,
    `- Ready to sign: ${packets.filter((packet) => packet.packet_status === 'ready_to_sign').length}`,
    '',
  ]
  packets.forEach((packet) => {
    lines.push(`## ${packet.title}`)
    lines.push('')
    lines.push(`- Packet ID: ${packet.decision_packet_id}`)
    lines.push(`- Status: ${packet.packet_status}`)
    lines.push(`- Dashboard: ${packet.dashboard_id}`)
    lines.push(`- Agenda: ${packet.agenda_id}`)
    lines.push(`- Handoff: ${packet.handoff_id}`)
    lines.push(`- Feedback template: ${packet.feedback_template_id}`)
    lines.push(`- Gate suggestion: ${packet.gate_status_suggestion_id}`)
    lines.push('- Note sections:')
    packet.note_sections.forEach((section) => lines.push(`  - ${section.section_number}. ${section.prompt} (${section.capture_field})`))
    lines.push('- Signature fields:')
    packet.signature_fields.forEach((field) => lines.push(`  - ${field.label}: ${field.status}`))
    lines.push('- Import targets:')
    packet.import_targets.forEach((target) => lines.push(`  - ${target.artifact}: ${target.target_action}`))
    lines.push('- Dashboard snapshot:')
    Object.entries(packet.dashboard_snapshot).forEach(([key, value]) => lines.push(`  - ${key}: ${value}`))
    lines.push(`- Next action: ${packet.primary_next_action}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioCompletionChecklists({ decisionPackets, reviewDashboard, revisionQueue }) {
  const dashboardByMilestone = new Map(reviewDashboard.map((row) => [row.milestone_id, row]))
  const revisionRowsByMilestone = groupBy(revisionQueue, (row) => row.milestone_id)
  return decisionPackets.map((packet) => {
    const dashboard = dashboardByMilestone.get(packet.milestone_id)
    const revisions = revisionRowsByMilestone.get(packet.milestone_id) ?? []
    const pendingRevisions = revisions.filter((row) => row.status === 'pending')
    const ready = packet.packet_status === 'ready_to_sign'
    return {
      completion_checklist_id: `completion_checklist_${packet.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: packet.milestone_id,
      title: `${packet.title} Learner Completion Checklist`,
      decision_packet_id: packet.decision_packet_id,
      dashboard_id: packet.dashboard_id,
      completion_status: ready ? 'ready_for_after_review' : 'blocked_until_signed',
      blocking_conditions: [
        packet.packet_status !== 'ready_to_sign' ? 'Decision packet is not ready to sign; complete the review session and reviewer feedback first.' : null,
        dashboard?.evidence_slots_missing > 0 ? `${dashboard.evidence_slots_missing} evidence attachment slots are still missing.` : null,
        pendingRevisions.length > 0 ? `${pendingRevisions.length} revision queue items are still pending.` : null,
      ].filter(Boolean),
      after_review_actions: [
        completionChecklistAction(1, 'confirm_signed_packet', 'Confirm reviewer signature, learner acknowledgement, review date, and source-boundary notes are present in the decision packet.', 'Signed decision packet exists with all signature fields filled.', [packet.decision_packet_id, packet.dashboard_id]),
        completionChecklistAction(2, 'apply_feedback_import', 'Copy the approved reviewer feedback import target from the signed packet into self_study_portfolio_reviewer_feedback_import.jsonl.', 'Feedback import row references the signed packet evidence refs and reviewer outcome.', ['self_study_portfolio_reviewer_feedback_import.jsonl', packet.feedback_template_id]),
        completionChecklistAction(3, 'resolve_revision_queue', 'Complete or defer each revision queue item named by the packet before promoting readiness.', 'Revision queue has no pending high-priority items for this milestone.', ['self_study_portfolio_revision_queue.jsonl', ...pendingRevisions.map((row) => row.queue_id)]),
        completionChecklistAction(4, 'copy_gate_status_import', 'Copy only evidence-backed satisfied checks from the gate status suggestion into self_study_portfolio_gate_status_import.jsonl.', 'Learner gate status import contains only approved satisfied checks and evidence refs.', ['self_study_portfolio_gate_status_import.jsonl', packet.gate_status_suggestion_id]),
        completionChecklistAction(5, 'regenerate_corpus', 'Run the RISD corpus renderer after applying feedback and gate status imports.', 'Derived artifacts regenerate without validation failures.', ['scripts/risd-graphic-design-corpus.mjs', 'docs/research-plans/risd-graphic-design-corpus/validation.md']),
        completionChecklistAction(6, 'verify_review_dashboard', 'Verify review dashboard, gate status summary, portfolio brief, and completion checklist reflect the final state.', 'Dashboard row is ready or names the remaining blocker explicitly.', ['self_study_portfolio_review_dashboard.jsonl', 'self_study_portfolio_gate_status_summary.jsonl', 'self_study_portfolio_briefs/*.md']),
      ],
      final_verification_command: 'node scripts/risd-graphic-design-corpus.mjs --render-derived-only',
      primary_next_action: ready
        ? 'Apply the signed packet import targets, regenerate, and verify the dashboard row becomes ready.'
        : 'Run the review agenda and complete the decision packet before starting after-review checklist actions.',
      provenance_note: 'Generated learner-facing after-review checklist from decision packet, dashboard state, and revision queue artifacts.',
    }
  })
}

function completionChecklistAction(action_number, action_id, learner_action, verification, artifact_refs) {
  return {
    action_number,
    action_id,
    status: 'pending',
    learner_action,
    verification,
    artifact_refs: artifact_refs.filter(Boolean),
  }
}

function selfStudyPortfolioCompletionChecklistsMarkdown(checklists) {
  const lines = [
    '# RISD Graphic Design Review Completion Checklists',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'These learner-facing checklists turn signed decision packets into exact after-review actions and verification steps.',
    '',
    `- Completion checklists: ${checklists.length}`,
    `- Ready for after-review work: ${checklists.filter((row) => row.completion_status === 'ready_for_after_review').length}`,
    '',
  ]
  checklists.forEach((checklist) => {
    lines.push(`## ${checklist.title}`)
    lines.push('')
    lines.push(`- Checklist ID: ${checklist.completion_checklist_id}`)
    lines.push(`- Status: ${checklist.completion_status}`)
    lines.push(`- Decision packet: ${checklist.decision_packet_id}`)
    lines.push(`- Dashboard: ${checklist.dashboard_id}`)
    lines.push('- Blocking conditions:')
    checklist.blocking_conditions.forEach((condition) => lines.push(`  - ${condition}`))
    lines.push('- After-review actions:')
    checklist.after_review_actions.forEach((action) => {
      lines.push(`  - [ ] ${action.action_number}. ${action.learner_action}`)
      lines.push(`    - Verification: ${action.verification}`)
      lines.push(`    - Artifacts: ${action.artifact_refs.join('; ')}`)
    })
    lines.push(`- Final verification command: \`${checklist.final_verification_command}\``)
    lines.push(`- Next action: ${checklist.primary_next_action}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioArchiveManifests({ decisionPackets, completionChecklists, portfolioBriefs, referencePackets, sourceExcerptPackets, exportManifests, gateStatusSummary }) {
  const checklistByMilestone = new Map(completionChecklists.map((row) => [row.milestone_id, row]))
  const briefByMilestone = new Map(portfolioBriefs.map((row) => [row.milestone_id, row]))
  const referenceByMilestone = new Map(referencePackets.map((row) => [row.milestone_id, row]))
  const excerptByMilestone = new Map(sourceExcerptPackets.map((row) => [row.milestone_id, row]))
  const exportByMilestone = new Map(exportManifests.map((row) => [row.milestone_id, row]))
  const summaryByMilestone = new Map(gateStatusSummary.map((row) => [row.milestone_id, row]))
  return decisionPackets.map((packet) => {
    const checklist = checklistByMilestone.get(packet.milestone_id)
    const brief = briefByMilestone.get(packet.milestone_id)
    const referencePacket = referenceByMilestone.get(packet.milestone_id)
    const excerptPacket = excerptByMilestone.get(packet.milestone_id)
    const exportManifest = exportByMilestone.get(packet.milestone_id)
    const summary = summaryByMilestone.get(packet.milestone_id)
    const ready = packet.packet_status === 'ready_to_sign' && checklist?.completion_status === 'ready_for_after_review'
    return {
      archive_manifest_id: `review_archive_${packet.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: packet.milestone_id,
      title: `${packet.title} Archive Manifest`,
      decision_packet_id: packet.decision_packet_id,
      completion_checklist_id: checklist?.completion_checklist_id ?? null,
      portfolio_brief_id: brief?.brief_id ?? null,
      reference_packet_id: referencePacket?.packet_id ?? null,
      source_excerpt_packet_id: excerptPacket?.packet_id ?? null,
      gate_status_summary_id: summary?.summary_id ?? null,
      export_manifest_id: exportManifest?.manifest_id ?? null,
      archive_status: ready ? 'ready_to_archive' : 'pending_signed_review',
      archive_files: [
        archiveManifestFile('decision_packet', packet.decision_packet_id, 'self_study_portfolio_decision_packets.jsonl', 'required'),
        archiveManifestFile('completion_checklist', checklist?.completion_checklist_id, 'self_study_portfolio_completion_checklists.jsonl', 'required'),
        archiveManifestFile('portfolio_brief', brief?.brief_id, brief?.output_path ?? 'self_study_portfolio_briefs/*.md', 'required'),
        archiveManifestFile('reference_packet', referencePacket?.packet_id, 'self_study_portfolio_reference_packets.jsonl', 'required'),
        archiveManifestFile('source_excerpt_packet', excerptPacket?.packet_id, 'self_study_portfolio_source_excerpt_packets.jsonl', 'required'),
        archiveManifestFile('gate_status_summary', summary?.summary_id, 'self_study_portfolio_gate_status_summary.jsonl', 'required'),
        archiveManifestFile('export_manifest', exportManifest?.manifest_id, 'self_study_portfolio_export_manifests.jsonl', 'required'),
      ],
      archive_order: [
        'decision_packet',
        'completion_checklist',
        'portfolio_brief',
        'gate_status_summary',
        'source_excerpt_packet',
        'reference_packet',
        'export_manifest',
      ],
      retention_note: 'Keep this archive manifest with signed review notes, final portfolio brief, source evidence packets, and status summaries so later portfolio review claims remain evidence-bounded.',
      primary_next_action: ready
        ? 'Copy the archive files into the learner portfolio evidence archive and retain this manifest with the signed packet.'
        : 'Complete the signed decision packet and after-review checklist before treating this archive as final evidence.',
      provenance_note: 'Generated review archive manifest from decision packet, completion checklist, portfolio brief, source/reference packets, gate status summary, and export manifest.',
    }
  })
}

function archiveManifestFile(file_role, artifact_id, path, archive_requirement) {
  return {
    file_role,
    artifact_id,
    path,
    archive_requirement,
  }
}

function selfStudyPortfolioArchiveManifestsMarkdown(manifests) {
  const lines = [
    '# RISD Graphic Design Review Archive Manifests',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'These manifests package signed-review evidence, learner completion checklists, final briefs, source packets, status summaries, and export manifests for long-term portfolio evidence.',
    '',
    `- Archive manifests: ${manifests.length}`,
    `- Ready to archive: ${manifests.filter((row) => row.archive_status === 'ready_to_archive').length}`,
    '',
  ]
  manifests.forEach((manifest) => {
    lines.push(`## ${manifest.title}`)
    lines.push('')
    lines.push(`- Archive manifest ID: ${manifest.archive_manifest_id}`)
    lines.push(`- Status: ${manifest.archive_status}`)
    lines.push(`- Decision packet: ${manifest.decision_packet_id}`)
    lines.push(`- Completion checklist: ${manifest.completion_checklist_id}`)
    lines.push(`- Portfolio brief: ${manifest.portfolio_brief_id}`)
    lines.push(`- Gate status summary: ${manifest.gate_status_summary_id}`)
    lines.push('- Archive files:')
    manifest.archive_files.forEach((file) => {
      lines.push(`  - ${file.file_role}: ${file.artifact_id} (${file.path}; ${file.archive_requirement})`)
    })
    lines.push(`- Archive order: ${manifest.archive_order.join(' -> ')}`)
    lines.push(`- Retention note: ${manifest.retention_note}`)
    lines.push(`- Next action: ${manifest.primary_next_action}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioArchiveAudit(archiveManifests) {
  const milestoneAudits = archiveManifests.map((manifest) => {
    const missingSignedReview = manifest.archive_status !== 'ready_to_archive'
    const missingRequiredFiles = (manifest.archive_files ?? []).filter((file) => file.archive_requirement === 'required' && (!file.artifact_id || !file.path))
    const auditStatus = manifest.archive_status === 'ready_to_archive'
      ? 'ready_to_archive'
      : missingRequiredFiles.length
        ? 'blocked_incomplete_package'
        : 'blocked_missing_signed_review'
    const blockingReasons = [
      missingSignedReview ? 'Signed decision packet and completed after-review checklist are not yet ready.' : null,
      ...missingRequiredFiles.map((file) => `Required archive file is incomplete: ${file.file_role}.`),
    ].filter(Boolean)
    return {
      milestone_id: manifest.milestone_id,
      archive_manifest_id: manifest.archive_manifest_id,
      archive_status: manifest.archive_status,
      audit_status: auditStatus,
      missing_signed_review_evidence: missingSignedReview,
      required_file_count: (manifest.archive_files ?? []).filter((file) => file.archive_requirement === 'required').length,
      missing_required_file_count: missingRequiredFiles.length,
      blocking_reasons: blockingReasons,
      next_action: auditStatus === 'ready_to_archive'
        ? 'Move the archive manifest and files into the learner portfolio evidence archive.'
        : manifest.primary_next_action,
    }
  })
  const readyCount = milestoneAudits.filter((row) => row.audit_status === 'ready_to_archive').length
  const blockedCount = milestoneAudits.length - readyCount
  return [{
    audit_id: 'portfolio_review_archive_audit',
    generated_at: retrievedAt,
    audit_totals: {
      archives: archiveManifests.length,
      ready_to_archive: readyCount,
      blocked: blockedCount,
      missing_signed_review_evidence: milestoneAudits.filter((row) => row.missing_signed_review_evidence).length,
      incomplete_packages: milestoneAudits.filter((row) => row.audit_status === 'blocked_incomplete_package').length,
    },
    milestone_audits: milestoneAudits,
    report_summary: `${readyCount} archives ready; ${blockedCount} blocked; ${milestoneAudits.filter((row) => row.missing_signed_review_evidence).length} missing signed-review evidence.`,
    primary_next_action: blockedCount
      ? 'Complete signed decision packets and after-review checklists before treating blocked archives as final portfolio evidence.'
      : 'Archive all milestone review packages and preserve this audit report with the evidence bundle.',
    provenance_note: 'Generated portfolio review archive audit from review archive manifests.',
  }]
}

function selfStudyPortfolioArchiveAuditMarkdown(reports) {
  const report = reports[0]
  const lines = [
    '# RISD Graphic Design Portfolio Review Archive Audit',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'This audit summarizes archive readiness, signed-review blockers, and incomplete evidence packages for each portfolio milestone.',
    '',
  ]
  if (!report) {
    lines.push('No archive audit report generated.')
    return lines.join('\n')
  }
  lines.push(`- Audit ID: ${report.audit_id}`)
  lines.push(`- Archives: ${report.audit_totals.archives}`)
  lines.push(`- Ready to archive: ${report.audit_totals.ready_to_archive}`)
  lines.push(`- Blocked: ${report.audit_totals.blocked}`)
  lines.push(`- Missing signed-review evidence: ${report.audit_totals.missing_signed_review_evidence}`)
  lines.push(`- Incomplete packages: ${report.audit_totals.incomplete_packages}`)
  lines.push(`- Summary: ${report.report_summary}`)
  lines.push('')
  report.milestone_audits.forEach((row) => {
    lines.push(`## ${row.milestone_id}`)
    lines.push('')
    lines.push(`- Archive manifest: ${row.archive_manifest_id}`)
    lines.push(`- Audit status: ${row.audit_status}`)
    lines.push(`- Missing signed-review evidence: ${row.missing_signed_review_evidence}`)
    lines.push(`- Required files: ${row.required_file_count - row.missing_required_file_count}/${row.required_file_count} complete`)
    lines.push('- Blocking reasons:')
    if (row.blocking_reasons.length) {
      row.blocking_reasons.forEach((reason) => lines.push(`  - ${reason}`))
    } else {
      lines.push('  - None')
    }
    lines.push(`- Next action: ${row.next_action}`)
    lines.push('')
  })
  lines.push(`Primary next action: ${report.primary_next_action}`)
  lines.push('')
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioOperationsSummary({ reviewDashboard, decisionPackets, completionChecklists, archiveManifests, archiveAudit }) {
  const dashboardByMilestone = new Map(reviewDashboard.map((row) => [row.milestone_id, row]))
  const checklistByMilestone = new Map(completionChecklists.map((row) => [row.milestone_id, row]))
  const archiveByMilestone = new Map(archiveManifests.map((row) => [row.milestone_id, row]))
  const audit = archiveAudit[0]
  const auditByMilestone = new Map((audit?.milestone_audits ?? []).map((row) => [row.milestone_id, row]))
  return decisionPackets.map((packet) => {
    const dashboard = dashboardByMilestone.get(packet.milestone_id)
    const checklist = checklistByMilestone.get(packet.milestone_id)
    const archive = archiveByMilestone.get(packet.milestone_id)
    const auditRow = auditByMilestone.get(packet.milestone_id)
    const operationsState = operationsStateFor({ dashboard, packet, checklist, archive })
    const blockers = uniq([
      ...(dashboard?.blocker_summary ?? []),
      ...(checklist?.blocking_conditions ?? []),
      ...(auditRow?.blocking_reasons ?? []),
    ].filter(Boolean))
    return {
      operations_id: `portfolio_ops_${packet.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: packet.milestone_id,
      title: packet.title.replace(' Post-Session Decision Packet', ' Operations Summary'),
      operations_state: operationsState,
      dashboard_id: dashboard?.dashboard_id ?? null,
      decision_packet_id: packet.decision_packet_id,
      completion_checklist_id: checklist?.completion_checklist_id ?? null,
      archive_manifest_id: archive?.archive_manifest_id ?? null,
      archive_audit_id: audit?.audit_id ?? null,
      state_snapshot: {
        dashboard_state: dashboard?.dashboard_state ?? 'unknown',
        decision_packet_status: packet.packet_status,
        completion_status: checklist?.completion_status ?? 'unknown',
        archive_status: archive?.archive_status ?? 'unknown',
        archive_audit_status: auditRow?.audit_status ?? 'unknown',
      },
      current_blockers: operationsState === 'archive_ready' ? [] : blockers,
      next_command: operationsNextCommand(operationsState),
      primary_artifacts: [
        operationsArtifact('review_dashboard', dashboard?.dashboard_id, 'self_study_portfolio_review_dashboard.jsonl'),
        operationsArtifact('decision_packet', packet.decision_packet_id, 'self_study_portfolio_decision_packets.jsonl'),
        operationsArtifact('completion_checklist', checklist?.completion_checklist_id, 'self_study_portfolio_completion_checklists.jsonl'),
        operationsArtifact('archive_manifest', archive?.archive_manifest_id, 'self_study_portfolio_review_archive_manifests.jsonl'),
        operationsArtifact('archive_audit', audit?.audit_id, 'self_study_portfolio_review_archive_audit.jsonl'),
      ].filter((artifact) => artifact.artifact_id),
      learner_prompt: 'Open this row first, follow next_command, and use primary_artifacts as the working set for the current portfolio milestone.',
      provenance_note: 'Generated learner command-center row from dashboard, decision packet, completion checklist, archive manifest, and archive audit artifacts.',
    }
  })
}

function operationsStateFor({ dashboard, packet, checklist, archive }) {
  if (archive?.archive_status === 'ready_to_archive') return 'archive_ready'
  if (checklist?.completion_status === 'ready_for_after_review') return 'after_review_pending'
  if (packet?.packet_status === 'ready_to_sign' || dashboard?.dashboard_state === 'ready') return 'review_in_progress'
  return 'review_not_started'
}

function operationsNextCommand(state) {
  if (state === 'archive_ready') return 'Archive the review bundle and retain the archive audit with the portfolio evidence.'
  if (state === 'after_review_pending') return 'Complete the after-review checklist actions, regenerate the corpus, and recheck the archive audit.'
  if (state === 'review_in_progress') return 'Collect signed reviewer decisions, apply approved import targets, and regenerate before after-review work.'
  return 'Start with the review agenda: attach missing evidence, run critique, and complete the reviewer feedback import.'
}

function operationsArtifact(artifact_role, artifact_id, artifact_path) {
  return {
    artifact_role,
    artifact_id,
    artifact_path,
  }
}

function selfStudyPortfolioOperationsSummaryMarkdown(rows) {
  const lines = [
    '# RISD Graphic Design Portfolio Operations Summary',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'This command center condenses dashboard, decision packet, completion checklist, archive manifest, and archive audit state into one current-action row per milestone.',
    '',
    `- Operations rows: ${rows.length}`,
    `- Archive ready: ${rows.filter((row) => row.operations_state === 'archive_ready').length}`,
    '',
  ]
  rows.forEach((row) => {
    lines.push(`## ${row.title}`)
    lines.push('')
    lines.push(`- Operations ID: ${row.operations_id}`)
    lines.push(`- State: ${row.operations_state}`)
    lines.push(`- Next command: ${row.next_command}`)
    lines.push('- State snapshot:')
    Object.entries(row.state_snapshot).forEach(([key, value]) => lines.push(`  - ${key}: ${value}`))
    lines.push('- Current blockers:')
    if (row.current_blockers.length) {
      row.current_blockers.forEach((blocker) => lines.push(`  - ${blocker}`))
    } else {
      lines.push('  - None')
    }
    lines.push('- Primary artifacts:')
    row.primary_artifacts.forEach((artifact) => lines.push(`  - ${artifact.artifact_role}: ${artifact.artifact_id} (${artifact.artifact_path})`))
    lines.push(`- Learner prompt: ${row.learner_prompt}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioCollaboratorHandoffPackets({ operationsSummary, reviewerHandoffs }) {
  const reviewerHandoffByMilestone = new Map(reviewerHandoffs.map((row) => [row.milestone_id, row]))
  return operationsSummary.map((row) => {
    const reviewerHandoff = reviewerHandoffByMilestone.get(row.milestone_id)
    return {
      handoff_packet_id: `collaborator_handoff_${row.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: row.milestone_id,
      share_title: `${row.title} Collaborator Handoff`,
      handoff_status: 'ready_to_share',
      operations_id: row.operations_id,
      reviewer_handoff_id: reviewerHandoff?.handoff_id ?? null,
      collaborator_role: row.operations_state === 'review_not_started' ? 'mentor reviewer' : 'portfolio evidence reviewer',
      requested_action: row.next_command,
      context_summary: `Current state is ${row.operations_state}. Use the operations summary and reviewer handoff to focus on the next unresolved review action without broadening beyond recovered public evidence.`,
      acceptance_criteria: [
        'Collaborator response cites the provided artifact IDs instead of introducing unsupported source claims.',
        'Collaborator identifies whether evidence, feedback import, signed decision, after-review checklist, or archive readiness is the immediate blocker.',
        'Collaborator returns concrete next edits or review notes that the learner can copy into the matching import/checklist artifact.',
      ],
      collaborator_prompts: [
        'What is the single next review action you need from the learner?',
        'Which artifact IDs prove the current blocker?',
        'What exact feedback, revision, or archive-readiness note should the learner record?',
      ],
      primary_artifacts: [
        operationsArtifact('operations_summary', row.operations_id, 'self_study_portfolio_operations_summary.jsonl'),
        operationsArtifact('reviewer_handoff', reviewerHandoff?.handoff_id, 'self_study_portfolio_reviewer_handoff.jsonl'),
        ...row.primary_artifacts,
      ].filter((artifact) => artifact.artifact_id),
      response_template: [
        `Handoff packet: collaborator_handoff_${row.milestone_id}`,
        `Milestone: ${row.milestone_id}`,
        'Immediate blocker:',
        'Artifact IDs cited:',
        'Recommended learner action:',
        'Evidence-boundary note:',
      ].join('\n'),
      next_owner_action: 'Send this packet with the linked artifacts to the collaborator, then copy their evidence-bounded response into the relevant decision packet, feedback import, or completion checklist.',
      provenance_note: 'Generated collaborator handoff packet from portfolio operations summary and reviewer handoff artifacts.',
    }
  })
}

function selfStudyPortfolioCollaboratorHandoffPacketsMarkdown(packets) {
  const lines = [
    '# RISD Graphic Design Collaborator Handoff Packets',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'These shareable packets compress each operations summary into one evidence-bounded task brief for a mentor, reviewer, or collaborator.',
    '',
    `- Handoff packets: ${packets.length}`,
    `- Ready to share: ${packets.filter((packet) => packet.handoff_status === 'ready_to_share').length}`,
    '',
  ]
  packets.forEach((packet) => {
    lines.push(`## ${packet.share_title}`)
    lines.push('')
    lines.push(`- Packet ID: ${packet.handoff_packet_id}`)
    lines.push(`- Status: ${packet.handoff_status}`)
    lines.push(`- Collaborator role: ${packet.collaborator_role}`)
    lines.push(`- Requested action: ${packet.requested_action}`)
    lines.push(`- Context: ${packet.context_summary}`)
    lines.push('- Acceptance criteria:')
    packet.acceptance_criteria.forEach((criterion) => lines.push(`  - ${criterion}`))
    lines.push('- Collaborator prompts:')
    packet.collaborator_prompts.forEach((prompt) => lines.push(`  - ${prompt}`))
    lines.push('- Primary artifacts:')
    packet.primary_artifacts.forEach((artifact) => lines.push(`  - ${artifact.artifact_role}: ${artifact.artifact_id} (${artifact.artifact_path})`))
    lines.push(`- Next owner action: ${packet.next_owner_action}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioCollaboratorResponseIntakeTemplate({ collaboratorHandoffPackets, reviewerFeedbackTemplates, decisionPackets, completionChecklists }) {
  const feedbackByMilestone = new Map(reviewerFeedbackTemplates.map((row) => [row.milestone_id, row]))
  const decisionByMilestone = new Map(decisionPackets.map((row) => [row.milestone_id, row]))
  const checklistByMilestone = new Map(completionChecklists.map((row) => [row.milestone_id, row]))
  return collaboratorHandoffPackets.map((packet) => {
    const feedback = feedbackByMilestone.get(packet.milestone_id)
    const decision = decisionByMilestone.get(packet.milestone_id)
    const checklist = checklistByMilestone.get(packet.milestone_id)
    return {
      intake_template_id: `collaborator_response_intake_${packet.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: packet.milestone_id,
      title: `${packet.share_title} Response Intake`,
      intake_status: 'ready_for_collaborator_response',
      handoff_packet_id: packet.handoff_packet_id,
      reviewer_feedback_template_id: feedback?.feedback_id ?? null,
      decision_packet_id: decision?.decision_packet_id ?? null,
      completion_checklist_id: checklist?.completion_checklist_id ?? null,
      response_fields: [
        responseIntakeField('immediate_blocker', 'Immediate blocker', 'self_study_portfolio_reviewer_feedback_import.jsonl', 'Copy into reviewer_notes and the relevant revision_items prompt/status.'),
        responseIntakeField('artifact_ids_cited', 'Artifact IDs cited', 'self_study_portfolio_reviewer_feedback_import.jsonl', 'Convert only valid evidence attachment refs into status_updates or revision_items evidence_refs.'),
        responseIntakeField('recommended_learner_action', 'Recommended learner action', 'self_study_portfolio_completion_checklists.jsonl', 'Copy into the matching after_review_actions note when it names a concrete learner action.'),
        responseIntakeField('decision_note', 'Decision note', 'self_study_portfolio_decision_packets.jsonl', 'Copy into the signed decision packet note section that matches the response content.'),
        responseIntakeField('evidence_boundary_note', 'Evidence-boundary note', 'self_study_portfolio_decision_packets.jsonl', 'Copy into source_boundary_notes when the collaborator flags uncertainty or unsupported inference.'),
      ],
      copy_targets: [
        responseIntakeTarget('self_study_portfolio_reviewer_feedback_import.jsonl', feedback?.feedback_id, 'Copy the feedback_import_draft row, then replace blank notes/outcomes with collaborator response text and verified evidence refs.'),
        responseIntakeTarget('self_study_portfolio_decision_packets.jsonl', decision?.decision_packet_id, 'Paste decision_packet_notes_draft into the offline note template before collecting signatures.'),
        responseIntakeTarget('self_study_portfolio_completion_checklists.jsonl', checklist?.completion_checklist_id, 'Use completion_checklist_update_draft to choose the next after-review action and verification target.'),
      ].filter((target) => target.source_artifact_id),
      feedback_import_draft: feedback ? {
        feedback_id: feedback.feedback_id,
        handoff_id: feedback.handoff_id,
        review_index_id: feedback.review_index_id,
        milestone_id: feedback.milestone_id,
        evidence_attachment_manifest_id: feedback.evidence_attachment_manifest_id,
        reviewer_name: '',
        review_date: '',
        outcome: 'not_reviewed',
        status_updates: feedback.status_updates,
        revision_items: feedback.revision_items,
        reviewer_notes: [
          `Source handoff packet: ${packet.handoff_packet_id}`,
          'Collaborator immediate blocker:',
          'Collaborator recommended learner action:',
          'Evidence-boundary note:',
        ].join('\n'),
      } : null,
      decision_packet_notes_draft: decision ? [
        `Decision packet: ${decision.decision_packet_id}`,
        `Source handoff packet: ${packet.handoff_packet_id}`,
        'Collaborator decision note:',
        'Evidence refs cited:',
        'Required revision or approval:',
        'Source-boundary notes:',
      ].join('\n') : null,
      completion_checklist_update_draft: checklist ? {
        completion_checklist_id: checklist.completion_checklist_id,
        next_action_candidates: (checklist.after_review_actions ?? []).map((action) => ({
          action_id: action.action_id,
          learner_action: action.learner_action,
          verification: action.verification,
          artifact_refs: action.artifact_refs,
        })),
      } : null,
      intake_instructions: [
        'Paste the collaborator response under response_fields before editing generated imports.',
        'Copy only evidence-bounded claims that cite provided artifact IDs or valid evidence attachment refs.',
        'Use the feedback import draft for critique outcomes; use the decision packet draft for signed notes; use the completion checklist draft for learner follow-through.',
        'Regenerate the RISD corpus after copying approved rows into the live import files.',
      ],
      next_owner_action: 'Send the collaborator handoff packet, paste the response into this intake template, then copy only verified fields into feedback imports, decision packets, or completion checklist updates.',
      provenance_note: 'Generated collaborator response intake template from collaborator handoff packets and portfolio review import targets.',
    }
  })
}

function responseIntakeField(field_id, label, target_artifact, copy_instruction) {
  return {
    field_id,
    label,
    value: '',
    target_artifact,
    copy_instruction,
  }
}

function responseIntakeTarget(artifact, source_artifact_id, target_action) {
  return {
    artifact,
    source_artifact_id,
    target_action,
  }
}

function selfStudyPortfolioCollaboratorResponseIntakeTemplateMarkdown(rows) {
  const lines = [
    '# RISD Graphic Design Collaborator Response Intake Templates',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'These templates turn collaborator handoff replies into bounded copy targets for reviewer feedback imports, decision packets, and completion checklists.',
    '',
    `- Intake templates: ${rows.length}`,
    `- Ready for collaborator responses: ${rows.filter((row) => row.intake_status === 'ready_for_collaborator_response').length}`,
    '',
  ]
  rows.forEach((row) => {
    lines.push(`## ${row.title}`)
    lines.push('')
    lines.push(`- Intake template ID: ${row.intake_template_id}`)
    lines.push(`- Status: ${row.intake_status}`)
    lines.push(`- Handoff packet: ${row.handoff_packet_id}`)
    lines.push(`- Feedback template: ${row.reviewer_feedback_template_id}`)
    lines.push(`- Decision packet: ${row.decision_packet_id}`)
    lines.push(`- Completion checklist: ${row.completion_checklist_id}`)
    lines.push('- Response fields:')
    row.response_fields.forEach((field) => lines.push(`  - ${field.label}: ${field.copy_instruction} (${field.target_artifact})`))
    lines.push('- Copy targets:')
    row.copy_targets.forEach((target) => lines.push(`  - ${target.artifact}: ${target.source_artifact_id} - ${target.target_action}`))
    lines.push('- Feedback import draft:')
    lines.push('```text')
    lines.push(row.feedback_import_draft?.reviewer_notes ?? 'No feedback import draft generated.')
    lines.push('```')
    lines.push('- Decision notes draft:')
    lines.push('```text')
    lines.push(row.decision_packet_notes_draft ?? 'No decision packet draft generated.')
    lines.push('```')
    lines.push('- Intake instructions:')
    row.intake_instructions.forEach((instruction) => lines.push(`  - ${instruction}`))
    lines.push(`- Next owner action: ${row.next_owner_action}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioCollaboratorResponseReconciliation({ intakeTemplates, feedbackImports, decisionPackets, completionChecklists }) {
  const feedbackImportByTemplate = new Map(feedbackImports.map((row) => [row.feedback_id, row]))
  const decisionByMilestone = new Map(decisionPackets.map((row) => [row.milestone_id, row]))
  const checklistByMilestone = new Map(completionChecklists.map((row) => [row.milestone_id, row]))
  return intakeTemplates.map((intake) => {
    const feedbackImport = feedbackImportByTemplate.get(intake.reviewer_feedback_template_id)
    const decision = decisionByMilestone.get(intake.milestone_id)
    const checklist = checklistByMilestone.get(intake.milestone_id)
    const feedbackImportPresent = Boolean(feedbackImport)
    const decisionPacketReady = decision?.packet_status === 'ready_to_sign'
    const completionChecklistReady = checklist?.completion_status === 'ready_for_after_review'
    const reconciliationStatus = collaboratorResponseReconciliationStatus({ feedbackImportPresent, decisionPacketReady, completionChecklistReady })
    return {
      reconciliation_id: `collaborator_response_reconciliation_${intake.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: intake.milestone_id,
      title: `${intake.title} Reconciliation`,
      intake_template_id: intake.intake_template_id,
      handoff_packet_id: intake.handoff_packet_id,
      feedback_template_id: intake.reviewer_feedback_template_id,
      feedback_import_id: feedbackImport?.feedback_id ?? null,
      decision_packet_id: intake.decision_packet_id,
      completion_checklist_id: intake.completion_checklist_id,
      reconciliation_status: reconciliationStatus,
      feedback_import_present: feedbackImportPresent,
      decision_packet_ready: decisionPacketReady,
      completion_checklist_ready: completionChecklistReady,
      target_artifacts: [
        reconciliationArtifact('intake_template', intake.intake_template_id, 'self_study_portfolio_collaborator_response_intake_template.jsonl'),
        reconciliationArtifact('handoff_packet', intake.handoff_packet_id, 'self_study_portfolio_collaborator_handoff_packets.jsonl'),
        reconciliationArtifact('feedback_import', feedbackImport?.feedback_id ?? intake.reviewer_feedback_template_id, feedbackImport ? 'self_study_portfolio_reviewer_feedback_import.jsonl' : 'self_study_portfolio_reviewer_feedback_template.jsonl'),
        reconciliationArtifact('decision_packet', intake.decision_packet_id, 'self_study_portfolio_decision_packets.jsonl'),
        reconciliationArtifact('completion_checklist', intake.completion_checklist_id, 'self_study_portfolio_completion_checklists.jsonl'),
      ].filter((artifact) => artifact.artifact_id),
      reconciliation_checks: [
        reconciliationCheck('collaborator_response_pasted', feedbackImportPresent ? 'satisfied' : 'pending', feedbackImportPresent ? `Live feedback import ${feedbackImport.feedback_id} exists.` : `No live feedback import found for ${intake.reviewer_feedback_template_id}.`),
        reconciliationCheck('decision_packet_followup_ready', decisionPacketReady ? 'satisfied' : 'pending', decisionPacketReady ? `${decision.decision_packet_id} is ready to sign.` : `${decision?.decision_packet_id ?? intake.decision_packet_id} is not ready to sign.`),
        reconciliationCheck('completion_checklist_followup_ready', completionChecklistReady ? 'satisfied' : 'pending', completionChecklistReady ? `${checklist.completion_checklist_id} is ready for after-review work.` : `${checklist?.completion_checklist_id ?? intake.completion_checklist_id} is not ready for after-review work.`),
      ],
      response_summary: feedbackImportPresent
        ? {
          outcome: feedbackImport.outcome,
          status_update_count: feedbackImport.status_updates?.length ?? 0,
          revision_item_count: feedbackImport.revision_items?.length ?? 0,
          reviewer_notes_present: Boolean(feedbackImport.reviewer_notes),
        }
        : {
          outcome: 'not_imported',
          status_update_count: 0,
          revision_item_count: 0,
          reviewer_notes_present: false,
        },
      next_owner_action: collaboratorResponseReconciliationNextAction(reconciliationStatus),
      provenance_note: 'Generated collaborator response reconciliation from response intake templates, live feedback imports, decision packets, and completion checklists.',
    }
  })
}

function collaboratorResponseReconciliationStatus({ feedbackImportPresent, decisionPacketReady, completionChecklistReady }) {
  if (!feedbackImportPresent) return 'awaiting_response'
  if (feedbackImportPresent && decisionPacketReady && completionChecklistReady) return 'ready_for_archive_followup'
  if (feedbackImportPresent) return 'partial_follow_through'
  return 'response_imported'
}

function collaboratorResponseReconciliationNextAction(status) {
  if (status === 'ready_for_archive_followup') return 'Proceed to archive follow-through after confirming signed decision and checklist evidence.'
  if (status === 'partial_follow_through') return 'Finish decision packet signing or completion checklist follow-through, then regenerate this reconciliation report.'
  if (status === 'response_imported') return 'Verify decision packet and completion checklist readiness after the imported response.'
  return 'Paste the collaborator response into the intake template, copy approved fields into the feedback import, and regenerate.'
}

function reconciliationArtifact(artifact_role, artifact_id, artifact_path) {
  return {
    artifact_role,
    artifact_id,
    artifact_path,
  }
}

function reconciliationCheck(check_id, status, evidence) {
  return {
    check_id,
    status,
    evidence,
  }
}

function selfStudyPortfolioCollaboratorResponseReconciliationMarkdown(rows) {
  const lines = [
    '# RISD Graphic Design Collaborator Response Reconciliation',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'This report checks whether collaborator handoff replies have been copied from intake templates into live feedback imports, decision packets, and completion checklist follow-through.',
    '',
    `- Reconciliation rows: ${rows.length}`,
    `- Live feedback imports: ${rows.filter((row) => row.feedback_import_present).length}`,
    `- Awaiting responses: ${rows.filter((row) => row.reconciliation_status === 'awaiting_response').length}`,
    '',
  ]
  rows.forEach((row) => {
    lines.push(`## ${row.title}`)
    lines.push('')
    lines.push(`- Reconciliation ID: ${row.reconciliation_id}`)
    lines.push(`- Status: ${row.reconciliation_status}`)
    lines.push(`- Intake template: ${row.intake_template_id}`)
    lines.push(`- Feedback import: ${row.feedback_import_id ?? 'missing'}`)
    lines.push(`- Decision packet ready: ${row.decision_packet_ready}`)
    lines.push(`- Completion checklist ready: ${row.completion_checklist_ready}`)
    lines.push('- Reconciliation checks:')
    row.reconciliation_checks.forEach((check) => lines.push(`  - ${check.check_id}: ${check.status} - ${check.evidence}`))
    lines.push('- Target artifacts:')
    row.target_artifacts.forEach((artifact) => lines.push(`  - ${artifact.artifact_role}: ${artifact.artifact_id} (${artifact.artifact_path})`))
    lines.push(`- Response summary: outcome=${row.response_summary.outcome}; status updates=${row.response_summary.status_update_count}; revisions=${row.response_summary.revision_item_count}; notes=${row.response_summary.reviewer_notes_present}`)
    lines.push(`- Next owner action: ${row.next_owner_action}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioCollaboratorResponseActionQueue(reconciliationRows) {
  return reconciliationRows.flatMap((row) => {
    const pendingChecks = (row.reconciliation_checks ?? []).filter((check) => check.status === 'pending')
    const actions = pendingChecks.map((check, index) => collaboratorResponseActionForCheck(row, check, index + 1))
    if (row.feedback_import_present && row.decision_packet_ready && row.completion_checklist_ready) {
      actions.push({
        action_id: `collaborator_response_action_${row.milestone_id}_04_regenerate_and_verify`,
        generated_at: retrievedAt,
        reconciliation_id: row.reconciliation_id,
        milestone_id: row.milestone_id,
        action_order: actions.length + 1,
        action_kind: 'regenerate_and_verify',
        action_status: 'pending',
        owner: 'learner',
        priority: 'low',
        source_check_id: 'all_reconciliation_checks_satisfied',
        learner_action: 'Regenerate the RISD corpus and verify dashboard, archive audit, and reconciliation reports remain consistent.',
        verification: 'Derived artifacts regenerate with validation=pass and the reconciliation row remains ready for archive follow-up.',
        target_artifacts: [
          reconciliationArtifact('generator', 'scripts/risd-graphic-design-corpus.mjs', 'scripts/risd-graphic-design-corpus.mjs'),
          reconciliationArtifact('validation', 'validation.md', 'self_study_portfolio_validation.md'),
          reconciliationArtifact('reconciliation', row.reconciliation_id, 'self_study_portfolio_collaborator_response_reconciliation.jsonl'),
        ],
        next_command: 'node scripts/risd-graphic-design-corpus.mjs --render-derived-only',
        provenance_note: 'Generated collaborator response action from satisfied reconciliation state.',
      })
    }
    return actions
  })
}

function collaboratorResponseActionForCheck(row, check, actionOrder) {
  if (check.check_id === 'collaborator_response_pasted') {
    return {
      action_id: `collaborator_response_action_${row.milestone_id}_01_paste_response_import`,
      generated_at: retrievedAt,
      reconciliation_id: row.reconciliation_id,
      milestone_id: row.milestone_id,
      action_order: actionOrder,
      action_kind: 'paste_response_import',
      action_status: 'pending',
      owner: 'learner',
      priority: 'high',
      source_check_id: check.check_id,
      learner_action: 'Paste the collaborator response into the intake template, copy approved fields into self_study_portfolio_reviewer_feedback_import.jsonl, and keep only evidence-bounded refs.',
      verification: 'A live reviewer feedback import exists for the feedback template named by the reconciliation row.',
      target_artifacts: [
        reconciliationArtifact('intake_template', row.intake_template_id, 'self_study_portfolio_collaborator_response_intake_template.jsonl'),
        reconciliationArtifact('feedback_import_or_template', row.feedback_import_id ?? row.feedback_template_id, row.feedback_import_id ? 'self_study_portfolio_reviewer_feedback_import.jsonl' : 'self_study_portfolio_reviewer_feedback_template.jsonl'),
        reconciliationArtifact('reconciliation', row.reconciliation_id, 'self_study_portfolio_collaborator_response_reconciliation.jsonl'),
      ],
      next_command: 'Copy approved intake fields into self_study_portfolio_reviewer_feedback_import.jsonl, then run node scripts/risd-graphic-design-corpus.mjs --render-derived-only.',
      provenance_note: 'Generated collaborator response action from pending response-pasted reconciliation check.',
    }
  }
  if (check.check_id === 'decision_packet_followup_ready') {
    return {
      action_id: `collaborator_response_action_${row.milestone_id}_02_collect_signature`,
      generated_at: retrievedAt,
      reconciliation_id: row.reconciliation_id,
      milestone_id: row.milestone_id,
      action_order: actionOrder,
      action_kind: 'collect_signature',
      action_status: 'pending',
      owner: 'mentor_reviewer',
      priority: row.feedback_import_present ? 'high' : 'medium',
      source_check_id: check.check_id,
      learner_action: 'Use the decision packet notes draft and imported feedback to collect reviewer signature, learner acknowledgement, review date, and source-boundary notes.',
      verification: 'The decision packet reaches ready_to_sign after feedback import and review decisions are recorded.',
      target_artifacts: [
        reconciliationArtifact('decision_packet', row.decision_packet_id, 'self_study_portfolio_decision_packets.jsonl'),
        reconciliationArtifact('handoff_packet', row.handoff_packet_id, 'self_study_portfolio_collaborator_handoff_packets.jsonl'),
        reconciliationArtifact('reconciliation', row.reconciliation_id, 'self_study_portfolio_collaborator_response_reconciliation.jsonl'),
      ],
      next_command: 'Complete the decision packet signature fields, then regenerate derived artifacts.',
      provenance_note: 'Generated collaborator response action from pending decision-packet reconciliation check.',
    }
  }
  return {
    action_id: `collaborator_response_action_${row.milestone_id}_03_complete_after_review_checklist`,
    generated_at: retrievedAt,
    reconciliation_id: row.reconciliation_id,
    milestone_id: row.milestone_id,
    action_order: actionOrder,
    action_kind: 'complete_after_review_checklist',
    action_status: 'pending',
    owner: 'learner',
    priority: row.decision_packet_ready ? 'high' : 'medium',
    source_check_id: check.check_id,
    learner_action: 'Complete the after-review checklist actions for feedback import, revision queue resolution, gate status import, regeneration, and dashboard verification.',
    verification: 'The completion checklist reaches ready_for_after_review and names no unresolved blocking condition for this milestone.',
    target_artifacts: [
      reconciliationArtifact('completion_checklist', row.completion_checklist_id, 'self_study_portfolio_completion_checklists.jsonl'),
      reconciliationArtifact('feedback_import_or_template', row.feedback_import_id ?? row.feedback_template_id, row.feedback_import_id ? 'self_study_portfolio_reviewer_feedback_import.jsonl' : 'self_study_portfolio_reviewer_feedback_template.jsonl'),
      reconciliationArtifact('reconciliation', row.reconciliation_id, 'self_study_portfolio_collaborator_response_reconciliation.jsonl'),
    ],
    next_command: 'Complete checklist follow-through, then run node scripts/risd-graphic-design-corpus.mjs --render-derived-only.',
    provenance_note: 'Generated collaborator response action from pending completion-checklist reconciliation check.',
  }
}

function selfStudyPortfolioCollaboratorResponseActionQueueMarkdown(rows) {
  const lines = [
    '# RISD Graphic Design Collaborator Response Action Queue',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'This queue turns pending collaborator response reconciliation checks into exact learner or mentor/reviewer follow-through tasks.',
    '',
    `- Action rows: ${rows.length}`,
    `- Pending: ${rows.filter((row) => row.action_status === 'pending').length}`,
    `- High priority: ${rows.filter((row) => row.priority === 'high').length}`,
    '',
  ]
  rows.forEach((row) => {
    lines.push(`## ${row.action_id}`)
    lines.push('')
    lines.push(`- Milestone: ${row.milestone_id}`)
    lines.push(`- Reconciliation: ${row.reconciliation_id}`)
    lines.push(`- Order: ${row.action_order}`)
    lines.push(`- Kind: ${row.action_kind}`)
    lines.push(`- Owner: ${row.owner}`)
    lines.push(`- Priority: ${row.priority}`)
    lines.push(`- Status: ${row.action_status}`)
    lines.push(`- Source check: ${row.source_check_id}`)
    lines.push(`- Learner action: ${row.learner_action}`)
    lines.push(`- Verification: ${row.verification}`)
    lines.push('- Target artifacts:')
    row.target_artifacts.forEach((artifact) => lines.push(`  - ${artifact.artifact_role}: ${artifact.artifact_id} (${artifact.artifact_path})`))
    lines.push(`- Next command: ${row.next_command}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioCollaboratorResponseActionProgress(actionRows) {
  const rowsByMilestone = groupBy(actionRows, (row) => row.milestone_id)
  return [...rowsByMilestone.entries()].map(([milestoneId, rows]) => {
    const pendingRows = rows.filter((row) => row.action_status === 'pending')
    const highPriorityRows = rows.filter((row) => row.priority === 'high')
    const mentorRows = rows.filter((row) => row.owner === 'mentor_reviewer')
    const learnerRows = rows.filter((row) => row.owner === 'learner')
    const nextRow = highPriorityRows.find((row) => row.action_status === 'pending') ?? pendingRows[0] ?? rows[0]
    return {
      progress_id: `collaborator_response_action_progress_${milestoneId}`,
      generated_at: retrievedAt,
      milestone_id: milestoneId,
      progress_status: collaboratorResponseActionProgressStatus({ total: rows.length, pending: pendingRows.length, highPriority: highPriorityRows.length }),
      total_actions: rows.length,
      pending_actions: pendingRows.length,
      high_priority_actions: highPriorityRows.length,
      mentor_reviewer_actions: mentorRows.length,
      learner_actions: learnerRows.length,
      action_ids: rows.map((row) => row.action_id),
      next_action_id: nextRow?.action_id ?? null,
      next_action: nextRow?.learner_action ?? 'No collaborator response follow-through actions are open for this milestone.',
      next_command: nextRow?.next_command ?? 'No command needed; collaborator response action queue is complete for this milestone.',
      target_artifacts: nextRow?.target_artifacts ?? [
        reconciliationArtifact('action_queue', 'self_study_portfolio_collaborator_response_action_queue.jsonl', 'self_study_portfolio_collaborator_response_action_queue.jsonl'),
      ],
      summary_note: `${pendingRows.length}/${rows.length} actions pending; ${highPriorityRows.length} high-priority; ${mentorRows.length} mentor/reviewer-owned; ${learnerRows.length} learner-owned.`,
      provenance_note: 'Generated collaborator response action progress summary from the collaborator response action queue.',
    }
  })
}

function collaboratorResponseActionProgressStatus({ total, pending, highPriority }) {
  if (total === 0) return 'no_actions'
  if (pending === 0) return 'complete'
  if (highPriority > 0) return 'open_high_priority_work'
  return 'open_work'
}

function selfStudyPortfolioCollaboratorResponseActionProgressMarkdown(rows) {
  const lines = [
    '# RISD Graphic Design Collaborator Response Action Progress',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'This summary rolls collaborator response action queue rows up by milestone so the learner can see open, high-priority, and owner-specific response follow-through work.',
    '',
    `- Progress rows: ${rows.length}`,
    `- High-priority milestones: ${rows.filter((row) => row.progress_status === 'open_high_priority_work').length}`,
    `- Pending actions: ${rows.reduce((sum, row) => sum + row.pending_actions, 0)}`,
    '',
  ]
  rows.forEach((row) => {
    lines.push(`## ${row.milestone_id}`)
    lines.push('')
    lines.push(`- Progress ID: ${row.progress_id}`)
    lines.push(`- Status: ${row.progress_status}`)
    lines.push(`- Actions: ${row.pending_actions}/${row.total_actions} pending`)
    lines.push(`- High priority: ${row.high_priority_actions}`)
    lines.push(`- Learner-owned: ${row.learner_actions}`)
    lines.push(`- Mentor/reviewer-owned: ${row.mentor_reviewer_actions}`)
    lines.push(`- Next action ID: ${row.next_action_id ?? 'none'}`)
    lines.push(`- Next action: ${row.next_action}`)
    lines.push(`- Next command: ${row.next_command}`)
    lines.push('- Target artifacts:')
    row.target_artifacts.forEach((artifact) => lines.push(`  - ${artifact.artifact_role}: ${artifact.artifact_id} (${artifact.artifact_path})`))
    lines.push(`- Summary: ${row.summary_note}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioCollaboratorResponseReviewBriefs({ actionProgress, reconciliationRows, handoffPackets }) {
  const reconciliationByMilestone = new Map(reconciliationRows.map((row) => [row.milestone_id, row]))
  const handoffByMilestone = new Map(handoffPackets.map((row) => [row.milestone_id, row]))
  return actionProgress.map((progress) => {
    const reconciliation = reconciliationByMilestone.get(progress.milestone_id)
    const handoff = handoffByMilestone.get(progress.milestone_id)
    const currentState = collaboratorResponseReviewBriefState({ progress, reconciliation })
    return {
      review_brief_id: `collaborator_response_review_brief_${progress.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: progress.milestone_id,
      share_title: `${handoff?.share_title ?? progress.milestone_id} Response Review Brief`,
      current_state: currentState,
      progress_id: progress.progress_id,
      reconciliation_id: reconciliation?.reconciliation_id ?? null,
      handoff_packet_id: handoff?.handoff_packet_id ?? null,
      summary_bullets: [
        `Current state: ${currentState.replace(/_/g, ' ')}.`,
        `${progress.pending_actions}/${progress.total_actions} response follow-through actions are pending.`,
        `${progress.high_priority_actions} high-priority action(s); next action is ${progress.next_action_id ?? 'none'}.`,
      ],
      next_action: progress.next_action,
      next_command: progress.next_command,
      share_prompt: [
        `Milestone: ${progress.milestone_id}`,
        `Current collaborator response state: ${currentState}`,
        `Next action: ${progress.next_action}`,
        `Please respond only with artifact IDs, evidence refs, and concrete edits that fit the linked intake/reconciliation artifacts.`,
      ].join('\n'),
      evidence_boundary_reminders: [
        'Do not introduce private RISD classroom claims or unsupported rubrics.',
        'Cite only the provided handoff, intake, reconciliation, feedback template/import, decision packet, or checklist IDs.',
        'If evidence is missing, record the blocker instead of marking the milestone ready.',
      ],
      target_artifacts: uniqueArtifacts([
        reconciliationArtifact('handoff_packet', handoff?.handoff_packet_id, 'self_study_portfolio_collaborator_handoff_packets.jsonl'),
        reconciliationArtifact('action_progress', progress.progress_id, 'self_study_portfolio_collaborator_response_action_progress.jsonl'),
        reconciliationArtifact('reconciliation', reconciliation?.reconciliation_id, 'self_study_portfolio_collaborator_response_reconciliation.jsonl'),
        ...(progress.target_artifacts ?? []),
      ].filter((artifact) => artifact.artifact_id)),
      provenance_note: 'Generated collaborator response review brief from action progress, reconciliation, and handoff packet artifacts.',
    }
  })
}

function uniqueArtifacts(artifacts) {
  const seen = new Set()
  return artifacts.filter((artifact) => {
    const key = `${artifact.artifact_role}:${artifact.artifact_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function collaboratorResponseReviewBriefState({ progress, reconciliation }) {
  if (reconciliation?.reconciliation_status === 'awaiting_response') return 'awaiting_response'
  if (reconciliation?.reconciliation_status === 'ready_for_archive_followup') return 'ready_for_archive_followup'
  if (progress.pending_actions > 0) return 'needs_followthrough'
  return 'complete'
}

function selfStudyPortfolioCollaboratorResponseReviewBriefsMarkdown(briefs) {
  const lines = [
    '# RISD Graphic Design Collaborator Response Review Briefs',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'These compact briefs summarize collaborator response state, next action, and evidence-boundary reminders for sharing or quick review.',
    '',
    `- Review briefs: ${briefs.length}`,
    `- Awaiting response: ${briefs.filter((brief) => brief.current_state === 'awaiting_response').length}`,
    '',
  ]
  briefs.forEach((brief) => {
    lines.push(`## ${brief.share_title}`)
    lines.push('')
    lines.push(`- Brief ID: ${brief.review_brief_id}`)
    lines.push(`- State: ${brief.current_state}`)
    lines.push(`- Progress: ${brief.progress_id}`)
    lines.push(`- Reconciliation: ${brief.reconciliation_id}`)
    lines.push(`- Handoff: ${brief.handoff_packet_id}`)
    lines.push('- Summary:')
    brief.summary_bullets.forEach((bullet) => lines.push(`  - ${bullet}`))
    lines.push(`- Next action: ${brief.next_action}`)
    lines.push(`- Next command: ${brief.next_command}`)
    lines.push('- Evidence-boundary reminders:')
    brief.evidence_boundary_reminders.forEach((reminder) => lines.push(`  - ${reminder}`))
    lines.push('- Share prompt:')
    lines.push('```text')
    lines.push(brief.share_prompt)
    lines.push('```')
    lines.push('- Target artifacts:')
    brief.target_artifacts.forEach((artifact) => lines.push(`  - ${artifact.artifact_role}: ${artifact.artifact_id} (${artifact.artifact_path})`))
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioCollaboratorResponseDistributionManifests(briefs) {
  return briefs.map((brief) => ({
    distribution_manifest_id: `collaborator_response_distribution_${brief.milestone_id}`,
    generated_at: retrievedAt,
    milestone_id: brief.milestone_id,
    review_brief_id: brief.review_brief_id,
    recipient_role: brief.current_state === 'awaiting_response' ? 'mentor_reviewer' : 'portfolio_collaborator',
    send_status: 'ready_to_send',
    message_subject: `${brief.share_title}: response needed`,
    message_body_template: [
      brief.share_prompt,
      '',
      'Evidence-boundary reminders:',
      ...brief.evidence_boundary_reminders.map((reminder) => `- ${reminder}`),
    ].join('\n'),
    artifact_bundle: [
      reconciliationArtifact('review_brief', brief.review_brief_id, 'self_study_portfolio_collaborator_response_review_briefs.jsonl'),
      ...brief.target_artifacts,
    ],
    send_checklist: [
      distributionCheck('brief_attached', 'Attach or paste the review brief.', 'pending'),
      distributionCheck('artifact_ids_visible', 'Include the linked artifact IDs and target artifact list.', 'pending'),
      distributionCheck('evidence_boundary_included', 'Include the evidence-boundary reminders in the message.', 'pending'),
    ],
    follow_up_checks: [
      distributionFollowUpCheck('response_received', 'Collaborator response is received and cites artifact IDs.', 'collaborator response with artifact IDs', 'pending'),
      distributionFollowUpCheck('response_imported', 'Approved response fields are copied into the reviewer feedback import or decision packet.', 'updated feedback import or decision packet row', 'pending'),
      distributionFollowUpCheck('corpus_regenerated', 'RISD derived artifacts are regenerated after import.', 'validation=pass render output', 'pending'),
    ],
    next_owner_action: 'Send this manifest bundle to the recipient, then use the response intake template and action queue to record follow-through.',
    provenance_note: 'Generated collaborator response distribution manifest from collaborator response review brief.',
  }))
}

function distributionCheck(check_id, label, status) {
  return { check_id, label, status }
}

function distributionFollowUpCheck(check_id, label, expected_evidence, status) {
  return { check_id, label, expected_evidence, status }
}

function selfStudyPortfolioCollaboratorResponseDistributionManifestsMarkdown(manifests) {
  const lines = [
    '# RISD Graphic Design Collaborator Response Distribution Manifests',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'These manifests package shareable collaborator response review briefs with recipient roles, send-state, artifact bundles, and follow-up checks.',
    '',
    `- Distribution manifests: ${manifests.length}`,
    `- Ready to send: ${manifests.filter((manifest) => manifest.send_status === 'ready_to_send').length}`,
    '',
  ]
  manifests.forEach((manifest) => {
    lines.push(`## ${manifest.distribution_manifest_id}`)
    lines.push('')
    lines.push(`- Milestone: ${manifest.milestone_id}`)
    lines.push(`- Review brief: ${manifest.review_brief_id}`)
    lines.push(`- Recipient role: ${manifest.recipient_role}`)
    lines.push(`- Send status: ${manifest.send_status}`)
    lines.push(`- Subject: ${manifest.message_subject}`)
    lines.push('- Artifact bundle:')
    manifest.artifact_bundle.forEach((artifact) => lines.push(`  - ${artifact.artifact_role}: ${artifact.artifact_id} (${artifact.artifact_path})`))
    lines.push('- Send checklist:')
    manifest.send_checklist.forEach((check) => lines.push(`  - ${check.check_id}: ${check.status} - ${check.label}`))
    lines.push('- Follow-up checks:')
    manifest.follow_up_checks.forEach((check) => lines.push(`  - ${check.check_id}: ${check.status} - ${check.label}; evidence: ${check.expected_evidence}`))
    lines.push('- Message body template:')
    lines.push('```text')
    lines.push(manifest.message_body_template)
    lines.push('```')
    lines.push(`- Next owner action: ${manifest.next_owner_action}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioCollaboratorResponseDistributionStatus(manifests, sendLogImports = []) {
  const importsByManifest = new Map(sendLogImports.filter((row) => row.distribution_manifest_id).map((row) => [row.distribution_manifest_id, row]))
  return manifests.map((manifest) => {
    const imported = importsByManifest.get(manifest.distribution_manifest_id)
    const sendState = imported?.send_state === 'sent' ? 'sent' : imported?.send_state === 'blocked' ? 'blocked' : manifest.send_status
    const followUpTotal = manifest.follow_up_checks.length
    const followUpSatisfied = manifest.follow_up_checks.filter((check) => check.status === 'satisfied').length
    const followUpPending = followUpTotal - followUpSatisfied
    const currentStatus = distributionCurrentStatus(sendState, followUpPending)
    return {
      distribution_status_id: `collaborator_response_distribution_status_${manifest.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: manifest.milestone_id,
      distribution_manifest_id: manifest.distribution_manifest_id,
      review_brief_id: manifest.review_brief_id,
      recipient_role: manifest.recipient_role,
      current_status: currentStatus,
      send_state: sendState,
      send_log_import_present: Boolean(imported),
      send_log_id: imported?.send_log_id ?? imported?.send_log_template_id ?? null,
      sent_at: imported?.sent_at ?? null,
      recipient_handle: imported?.recipient_handle ?? null,
      channel: imported?.channel ?? null,
      message_artifact_id: imported?.message_artifact_id ?? null,
      follow_up_total: followUpTotal,
      follow_up_pending: followUpPending,
      follow_up_satisfied: followUpSatisfied,
      overdue_days: 0,
      blockers: sendState === 'blocked' ? [imported?.blocker_note, ...manifest.send_checklist.filter((check) => check.status === 'pending').map((check) => check.check_id)].filter(Boolean) : [],
      ready_to_send: sendState === 'ready_to_send',
      sent: sendState === 'sent',
      blocked: sendState === 'blocked',
      overdue: currentStatus === 'overdue',
      closed: currentStatus === 'closed',
      status_reason: distributionStatusReason(sendState, currentStatus, followUpPending, Boolean(imported)),
      next_owner_action: distributionStatusNextAction(manifest, currentStatus),
      source_artifact: reconciliationArtifact('distribution_manifest', manifest.distribution_manifest_id, 'self_study_portfolio_collaborator_response_distribution_manifests.jsonl'),
      provenance_note: 'Generated distribution status from collaborator response distribution manifest. Later send-log imports should update send_state and follow-up closure.',
    }
  })
}

function distributionCurrentStatus(sendState, followUpPending) {
  if (sendState === 'blocked') return 'blocked'
  if (sendState === 'sent' && followUpPending === 0) return 'closed'
  if (sendState === 'sent') return 'sent'
  return 'ready_to_send'
}

function distributionStatusReason(sendState, currentStatus, followUpPending, importPresent) {
  if (currentStatus === 'closed') return 'Packet was sent and all follow-up checks are satisfied.'
  if (currentStatus === 'sent') return `${followUpPending} follow-up checks remain after send.`
  if (currentStatus === 'blocked') return 'Packet cannot be sent until pending send checklist blockers are resolved.'
  if (!importPresent && sendState === 'ready_to_send') return 'No send-log import is present; packet remains ready for the learner to send.'
  return 'Packet has a complete manifest and is ready for the learner to send.'
}

function distributionStatusNextAction(manifest, currentStatus) {
  if (currentStatus === 'closed') return 'Archive the closed collaborator response trail with the milestone review evidence.'
  if (currentStatus === 'sent') return 'Track response receipt, import approved response fields, and regenerate the RISD artifacts.'
  if (currentStatus === 'blocked') return 'Resolve the pending send checklist blockers before sending the packet.'
  return manifest.next_owner_action
}

function selfStudyPortfolioCollaboratorResponseDistributionStatusMarkdown(statusRows) {
  const counts = ['ready_to_send', 'sent', 'blocked', 'overdue', 'closed'].map((status) => ({
    status,
    count: statusRows.filter((row) => row.current_status === status).length,
  }))
  const lines = [
    '# RISD Graphic Design Collaborator Response Distribution Status',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'This status summary rolls collaborator response distribution manifests into a current send-state board for each portfolio milestone.',
    '',
    ...counts.map((row) => `- ${row.status}: ${row.count}`),
    '',
  ]
  statusRows.forEach((row) => {
    lines.push(`## ${row.distribution_status_id}`)
    lines.push('')
    lines.push(`- Milestone: ${row.milestone_id}`)
    lines.push(`- Manifest: ${row.distribution_manifest_id}`)
    lines.push(`- Review brief: ${row.review_brief_id}`)
    lines.push(`- Recipient role: ${row.recipient_role}`)
    lines.push(`- Current status: ${row.current_status}`)
    lines.push(`- Send state: ${row.send_state}`)
    lines.push(`- Send-log import present: ${row.send_log_import_present}`)
    if (row.sent_at) lines.push(`- Sent at: ${row.sent_at}`)
    if (row.recipient_handle) lines.push(`- Recipient handle: ${row.recipient_handle}`)
    if (row.channel) lines.push(`- Channel: ${row.channel}`)
    if (row.message_artifact_id) lines.push(`- Message artifact: ${row.message_artifact_id}`)
    lines.push(`- Follow-up checks: ${row.follow_up_satisfied}/${row.follow_up_total} satisfied; ${row.follow_up_pending} pending`)
    lines.push(`- Overdue days: ${row.overdue_days}`)
    lines.push(`- Status reason: ${row.status_reason}`)
    lines.push(`- Next owner action: ${row.next_owner_action}`)
    lines.push(`- Source artifact: ${row.source_artifact.artifact_id} (${row.source_artifact.artifact_path})`)
    if (row.blockers.length) {
      lines.push('- Blockers:')
      row.blockers.forEach((blocker) => lines.push(`  - ${blocker}`))
    }
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioCollaboratorResponseSendLogTemplate(statusRows) {
  return statusRows.map((row) => ({
    send_log_template_id: `collaborator_response_send_log_${row.milestone_id}`,
    generated_at: retrievedAt,
    milestone_id: row.milestone_id,
    distribution_manifest_id: row.distribution_manifest_id,
    distribution_status_id: row.distribution_status_id,
    review_brief_id: row.review_brief_id,
    recipient_role: row.recipient_role,
    send_state: row.sent ? 'sent' : row.blocked ? 'blocked' : 'not_sent',
    sent_at: null,
    recipient_handle: null,
    channel: null,
    message_artifact_id: null,
    blocker_note: row.blockers.length ? row.blockers.join('; ') : null,
    allowed_channels: ['email', 'slack', 'docs_comment', 'notion', 'other'],
    required_fields: ['sent_at', 'recipient_handle', 'channel', 'message_artifact_id'],
    message_subject: `Send log for ${row.distribution_manifest_id}`,
    message_artifact_id_placeholder: `message_artifact_${row.milestone_id}`,
    import_target: reconciliationArtifact('send_log_import', `send_log_import_${row.milestone_id}`, 'self_study_portfolio_collaborator_response_send_log_import.jsonl'),
    source_artifact: reconciliationArtifact('distribution_status', row.distribution_status_id, 'self_study_portfolio_collaborator_response_distribution_status.jsonl'),
    next_owner_action: 'After sending the collaborator response packet, copy this row to the send-log import file and fill sent_at, recipient_handle, channel, and message_artifact_id.',
    provenance_note: 'Generated send-log template from collaborator response distribution status.',
  }))
}

function selfStudyPortfolioCollaboratorResponseSendLogTemplateMarkdown(rows) {
  const lines = [
    '# RISD Graphic Design Collaborator Response Send Log Template',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'Copy rows from this template into `self_study_portfolio_collaborator_response_send_log_import.jsonl` after sending collaborator response packets. Do not edit generated manifests or status summaries directly.',
    '',
    `- Template rows: ${rows.length}`,
    `- Not sent: ${rows.filter((row) => row.send_state === 'not_sent').length}`,
    '',
  ]
  rows.forEach((row) => {
    lines.push(`## ${row.send_log_template_id}`)
    lines.push('')
    lines.push(`- Milestone: ${row.milestone_id}`)
    lines.push(`- Distribution manifest: ${row.distribution_manifest_id}`)
    lines.push(`- Distribution status: ${row.distribution_status_id}`)
    lines.push(`- Review brief: ${row.review_brief_id}`)
    lines.push(`- Recipient role: ${row.recipient_role}`)
    lines.push(`- Send state: ${row.send_state}`)
    lines.push(`- Allowed channels: ${row.allowed_channels.join(', ')}`)
    lines.push(`- Required fields: ${row.required_fields.join(', ')}`)
    lines.push(`- Message artifact placeholder: ${row.message_artifact_id_placeholder}`)
    lines.push(`- Import target: ${row.import_target.artifact_id} (${row.import_target.artifact_path})`)
    lines.push(`- Source artifact: ${row.source_artifact.artifact_id} (${row.source_artifact.artifact_path})`)
    if (row.blocker_note) lines.push(`- Blocker note: ${row.blocker_note}`)
    lines.push(`- Next owner action: ${row.next_owner_action}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioCollaboratorResponseReminderQueue(statusRows, manifests) {
  const manifestsById = new Map(manifests.map((manifest) => [manifest.distribution_manifest_id, manifest]))
  return statusRows
    .filter((row) => ['ready_to_send', 'blocked', 'overdue'].includes(row.current_status))
    .map((row) => {
      const manifest = manifestsById.get(row.distribution_manifest_id)
      const reminderReason = row.current_status === 'blocked' ? 'blocked' : row.current_status === 'overdue' ? 'overdue' : 'not_sent'
      return {
        reminder_id: `collaborator_response_reminder_${row.milestone_id}`,
        generated_at: retrievedAt,
        milestone_id: row.milestone_id,
        distribution_status_id: row.distribution_status_id,
        distribution_manifest_id: row.distribution_manifest_id,
        review_brief_id: row.review_brief_id,
        recipient_role: row.recipient_role,
        current_status: row.current_status,
        reminder_reason: reminderReason,
        priority: reminderReason === 'blocked' || reminderReason === 'overdue' ? 'high' : 'medium',
        message_subject: manifest?.message_subject ? `Reminder: ${manifest.message_subject}` : `Reminder: ${row.distribution_manifest_id}`,
        reminder_copy: collaboratorResponseReminderCopy(row, manifest, reminderReason),
        artifact_bundle: manifest?.artifact_bundle ?? [reconciliationArtifact('distribution_manifest', row.distribution_manifest_id, 'self_study_portfolio_collaborator_response_distribution_manifests.jsonl')],
        blockers: row.blockers ?? [],
        source_artifact: reconciliationArtifact('distribution_status', row.distribution_status_id, 'self_study_portfolio_collaborator_response_distribution_status.jsonl'),
        next_owner_action: reminderReason === 'blocked' ? 'Resolve the blocker note or send checklist before contacting the collaborator again.' : 'Send or resend the bounded reminder copy, then record the result in the send-log import file.',
        provenance_note: 'Generated collaborator response reminder from distribution status and manifest copy.',
      }
    })
}

function collaboratorResponseReminderCopy(row, manifest, reminderReason) {
  const lead = reminderReason === 'blocked'
    ? 'This collaborator response packet is blocked. Please resolve the blocker before sending.'
    : reminderReason === 'overdue'
      ? 'This collaborator response packet is overdue. Please send a bounded follow-up using the linked artifacts.'
      : 'This collaborator response packet is ready to send. Please send the bounded review request using the linked artifacts.'
  return [
    lead,
    `Milestone: ${row.milestone_id}`,
    `Distribution manifest: ${row.distribution_manifest_id}`,
    `Review brief: ${row.review_brief_id}`,
    manifest?.message_body_template ? `Original message:\n${manifest.message_body_template}` : null,
  ].filter(Boolean).join('\n\n')
}

function selfStudyPortfolioCollaboratorResponseReminderQueueMarkdown(rows) {
  const lines = [
    '# RISD Graphic Design Collaborator Response Reminder Queue',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'These reminders are bounded to generated distribution manifests and status rows. They cover unsent, blocked, or overdue collaborator response packets.',
    '',
    `- Reminder rows: ${rows.length}`,
    `- Not sent: ${rows.filter((row) => row.reminder_reason === 'not_sent').length}`,
    `- Blocked: ${rows.filter((row) => row.reminder_reason === 'blocked').length}`,
    `- Overdue: ${rows.filter((row) => row.reminder_reason === 'overdue').length}`,
    '',
  ]
  rows.forEach((row) => {
    lines.push(`## ${row.reminder_id}`)
    lines.push('')
    lines.push(`- Milestone: ${row.milestone_id}`)
    lines.push(`- Distribution status: ${row.distribution_status_id}`)
    lines.push(`- Distribution manifest: ${row.distribution_manifest_id}`)
    lines.push(`- Reason: ${row.reminder_reason}`)
    lines.push(`- Priority: ${row.priority}`)
    lines.push(`- Subject: ${row.message_subject}`)
    lines.push('- Artifact bundle:')
    row.artifact_bundle.forEach((artifact) => lines.push(`  - ${artifact.artifact_role}: ${artifact.artifact_id} (${artifact.artifact_path})`))
    if (row.blockers.length) {
      lines.push('- Blockers:')
      row.blockers.forEach((blocker) => lines.push(`  - ${blocker}`))
    }
    lines.push('- Reminder copy:')
    lines.push('```text')
    lines.push(row.reminder_copy)
    lines.push('```')
    lines.push(`- Next owner action: ${row.next_owner_action}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioCollaboratorResponseEvidenceRegister(statusRows, reminderRows) {
  const remindersByStatus = new Map(reminderRows.map((row) => [row.distribution_status_id, row]))
  return statusRows.map((row) => {
    const reminder = remindersByStatus.get(row.distribution_status_id)
    const sentButAwaiting = row.current_status === 'sent'
    const blocked = row.current_status === 'blocked'
    return {
      evidence_register_id: `collaborator_response_evidence_${row.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: row.milestone_id,
      distribution_status_id: row.distribution_status_id,
      distribution_manifest_id: row.distribution_manifest_id,
      review_brief_id: row.review_brief_id,
      reminder_id: reminder?.reminder_id ?? null,
      capture_status: blocked ? 'blocked' : sentButAwaiting ? 'awaiting_response' : 'awaiting_response',
      response_artifact_id: null,
      response_received_at: null,
      evidence_refs: [],
      required_evidence_fields: ['response_artifact_id', 'evidence_ref', 'received_at', 'import_target'],
      import_targets: [
        reconciliationArtifact('reviewer_feedback_import', `feedback_import_${row.milestone_id}`, 'self_study_portfolio_reviewer_feedback_import.jsonl'),
        reconciliationArtifact('decision_packet_notes', `decision_packet_${row.milestone_id}`, 'self_study_portfolio_decision_packets.jsonl'),
        reconciliationArtifact('completion_checklist_updates', `completion_checklist_${row.milestone_id}`, 'self_study_portfolio_completion_checklists.jsonl'),
      ],
      source_artifact: reconciliationArtifact('distribution_status', row.distribution_status_id, 'self_study_portfolio_collaborator_response_distribution_status.jsonl'),
      next_owner_action: 'When the collaborator replies, record the response artifact ID, evidence refs, received timestamp, and intended import target before copying any fields into downstream review artifacts.',
      provenance_note: 'Generated collaborator response evidence register from distribution status and reminder queue.',
    }
  })
}

function selfStudyPortfolioCollaboratorResponseEvidenceRegisterMarkdown(rows) {
  const lines = [
    '# RISD Graphic Design Collaborator Response Evidence Register',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'Use this register to capture received collaborator-response evidence before importing response fields into feedback templates, decision packet notes, or completion checklist updates.',
    '',
    `- Evidence register rows: ${rows.length}`,
    `- Awaiting response: ${rows.filter((row) => row.capture_status === 'awaiting_response').length}`,
    `- Received needs import: ${rows.filter((row) => row.capture_status === 'received_needs_import').length}`,
    `- Imported: ${rows.filter((row) => row.capture_status === 'imported').length}`,
    `- Blocked: ${rows.filter((row) => row.capture_status === 'blocked').length}`,
    '',
  ]
  rows.forEach((row) => {
    lines.push(`## ${row.evidence_register_id}`)
    lines.push('')
    lines.push(`- Milestone: ${row.milestone_id}`)
    lines.push(`- Distribution status: ${row.distribution_status_id}`)
    lines.push(`- Distribution manifest: ${row.distribution_manifest_id}`)
    if (row.reminder_id) lines.push(`- Reminder: ${row.reminder_id}`)
    lines.push(`- Capture status: ${row.capture_status}`)
    lines.push(`- Required evidence fields: ${row.required_evidence_fields.join(', ')}`)
    lines.push('- Import targets:')
    row.import_targets.forEach((target) => lines.push(`  - ${target.artifact_role}: ${target.artifact_id} (${target.artifact_path})`))
    lines.push(`- Source artifact: ${row.source_artifact.artifact_id} (${row.source_artifact.artifact_path})`)
    lines.push(`- Next owner action: ${row.next_owner_action}`)
    lines.push('')
  })
  return lines.map((line) => line.trimEnd()).join('\n')
}

function buildSelfStudyPortfolioRevisionQueue(handoffs, feedbackImports = []) {
  const importsByHandoff = new Map(feedbackImports.filter((row) => row.handoff_id).map((row) => [row.handoff_id, row]))
  return handoffs.flatMap((handoff) => {
    const imported = importsByHandoff.get(handoff.handoff_id)
    const revisionItems = imported?.revision_items?.length
      ? imported.revision_items
      : handoff.blocking_focus.map((blockerType, index) => ({
        revision_id: `${handoff.handoff_id}_revision_${String(index + 1).padStart(2, '0')}`,
        blocker_type: blockerType,
        priority: blockerType === 'missing_outputs' ? 'high' : 'medium',
        prompt: reviewerRevisionPrompt(blockerType),
        evidence_refs: [],
        owner: 'learner',
        status: 'pending',
      }))
    return revisionItems.map((item) => ({
      queue_id: `revision_queue_${item.revision_id}`,
      generated_at: retrievedAt,
      handoff_id: handoff.handoff_id,
      feedback_id: imported?.feedback_id ?? null,
      milestone_id: handoff.milestone_id,
      title: handoff.title,
      blocker_type: item.blocker_type ?? 'other_blocker',
      priority: item.priority ?? 'medium',
      revision_prompt: item.prompt ?? reviewerRevisionPrompt(item.blocker_type),
      evidence_refs: item.evidence_refs ?? [],
      owner: item.owner ?? 'learner',
      status: item.status ?? 'pending',
      source: imported ? 'reviewer_feedback_import' : 'generated_blocker_template',
      next_action: item.status === 'resolved'
        ? 'Confirm evidence refs are captured in the gate status import before marking the gate ready.'
        : 'Complete the revision, attach evidence refs, update reviewer feedback import, and regenerate.',
      provenance_note: 'Generated post-review revision queue from reviewer feedback imports when present, otherwise from handoff blocker focus.',
    }))
  })
}

function buildSelfStudyPortfolioGateStatusSuggestions(handoffs, feedbackImports = [], completionGates = [], revisionQueue = [], evidenceAttachments = []) {
  const importsByHandoff = new Map(feedbackImports.filter((row) => row.handoff_id).map((row) => [row.handoff_id, row]))
  const gatesByMilestone = new Map(completionGates.filter((gate) => gate.milestone_id).map((gate) => [gate.milestone_id, gate]))
  const revisionRowsByHandoff = groupBy(revisionQueue, (row) => row.handoff_id)
  const attachmentsByMilestone = new Map(evidenceAttachments.map((manifest) => [manifest.milestone_id, manifest]))
  return handoffs.map((handoff) => {
    const gate = gatesByMilestone.get(handoff.milestone_id)
    const imported = importsByHandoff.get(handoff.handoff_id)
    const evidenceManifest = attachmentsByMilestone.get(handoff.milestone_id)
    const evidenceSlotsByCheckId = groupBy(evidenceManifest?.attachment_slots ?? [], (slot) => slot.required_for_gate_check_id)
    const validCheckIds = new Set((gate?.gate_checks ?? []).map((check) => check.check_id))
    const importedUpdates = (imported?.status_updates ?? []).filter((update) => validCheckIds.has(update.check_id))
    const updatesByCheckId = new Map(importedUpdates.map((update) => [update.check_id, update]))
    const checkUpdates = (gate?.gate_checks ?? []).map((check) => {
      const importedUpdate = updatesByCheckId.get(check.check_id)
      const suggestedEvidenceRefs = (evidenceSlotsByCheckId.get(check.check_id) ?? []).map((slot) => slot.slot_id)
      return {
        check_id: check.check_id,
        current_status: importedUpdate?.current_status ?? check.current_status ?? 'pending',
        evidence_refs: importedUpdate?.evidence_refs ?? suggestedEvidenceRefs,
        suggested_evidence_refs: suggestedEvidenceRefs,
        learner_note: importedUpdate?.learner_note ?? importedUpdate?.reviewer_note ?? '',
      }
    })
    const suggestedCheckEvidenceRefs = checkUpdates.map((update) => ({
      check_id: update.check_id,
      suggested_evidence_refs: update.suggested_evidence_refs,
    }))
    const satisfiedWithEvidence = checkUpdates.filter((update) => update.current_status === 'satisfied' && update.evidence_refs.length > 0).length
    const allChecksSatisfiedWithEvidence = checkUpdates.length > 0 && satisfiedWithEvidence === checkUpdates.length
    const suggestionStatus = !imported
      ? 'awaiting_feedback'
      : importedUpdates.length === 0
        ? 'needs_more_evidence'
        : allChecksSatisfiedWithEvidence
          ? 'ready_to_copy'
          : 'partial_update'
    const suggestedGateStatusImport = gate && imported
      ? {
        import_id: `suggested_status_import_${gate.gate_id}`,
        generated_at: retrievedAt,
        source_feedback_id: imported.feedback_id,
        gate_id: gate.gate_id,
        milestone_id: gate.milestone_id,
        progress_rollup_id: gate.progress_rollup_id,
        target_readiness_status: allChecksSatisfiedWithEvidence ? 'ready_for_review' : 'not_ready_template',
        check_updates: checkUpdates,
        learner_note: imported.reviewer_notes ?? 'Generated from reviewer feedback import; verify evidence refs before copying into self_study_portfolio_gate_status_import.jsonl.',
      }
      : null
    const revisionRows = revisionRowsByHandoff.get(handoff.handoff_id) ?? []
    return {
      suggestion_id: `gate_status_suggestion_${handoff.handoff_id}`,
      generated_at: retrievedAt,
      handoff_id: handoff.handoff_id,
      feedback_id: imported?.feedback_id ?? null,
      milestone_id: handoff.milestone_id,
      gate_id: gate?.gate_id ?? null,
      evidence_attachment_manifest_id: evidenceManifest?.attachment_manifest_id ?? null,
      suggested_check_evidence_refs: suggestedCheckEvidenceRefs,
      suggestion_status: suggestionStatus,
      imported_status_update_count: importedUpdates.length,
      satisfied_check_count: checkUpdates.filter((update) => update.current_status === 'satisfied').length,
      satisfied_check_count_with_evidence: satisfiedWithEvidence,
      pending_check_count: checkUpdates.filter((update) => update.current_status !== 'satisfied').length,
      resolved_revision_count: (imported?.revision_items ?? []).filter((item) => item.status === 'resolved').length,
      revision_queue_ids: revisionRows.map((row) => row.queue_id),
      suggested_gate_status_import: suggestedGateStatusImport,
      next_action: portfolioGateStatusSuggestionNextAction(suggestionStatus),
      provenance_note: 'Generated from reviewer feedback imports and portfolio completion gates; copy suggested_gate_status_import only after evidence refs are verified.',
    }
  })
}

function portfolioGateStatusSuggestionNextAction(status) {
  if (status === 'ready_to_copy') return 'Copy suggested_gate_status_import into self_study_portfolio_gate_status_import.jsonl and regenerate.'
  if (status === 'partial_update') return 'Copy only verified satisfied checks, keep unresolved checks pending, and continue revision work.'
  if (status === 'needs_more_evidence') return 'Add reviewer status_updates with valid gate check IDs and evidence refs before promoting the gate.'
  return 'Complete a reviewer feedback import row after critique; regenerate to produce a copyable gate status import suggestion.'
}

function selfStudyPortfolioReviewerFeedbackTemplateMarkdown(feedbackTemplates) {
  const lines = [
    '# RISD Graphic Design Reviewer Feedback Template',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'Copy rows from the JSONL template into the reviewer feedback import file after a critique. Do not mark outcomes ready without evidence refs.',
    '',
    `- Feedback template rows: ${feedbackTemplates.length}`,
    '',
  ]
  for (const row of feedbackTemplates) {
    lines.push(`## ${row.milestone_id}`)
    lines.push('')
    lines.push(`- Feedback ID: ${row.feedback_id}`)
    lines.push(`- Handoff ID: ${row.handoff_id}`)
    lines.push(`- Evidence attachment manifest: ${row.evidence_attachment_manifest_id}`)
    lines.push(`- Allowed evidence refs: ${row.allowed_evidence_refs?.length ?? 0}`)
    lines.push(`- Outcome: ${row.outcome}`)
    lines.push('- Revision items:')
    row.revision_items.forEach((item) => lines.push(`  - ${item.revision_id}: ${item.prompt} (${item.priority}; ${item.status})`))
    lines.push('- Import instructions:')
    row.import_instructions.forEach((item) => lines.push(`  - ${item}`))
    lines.push('')
  }
  return lines.map((line) => line.trimEnd()).join('\n')
}

function selfStudyPortfolioGateStatusSuggestionsMarkdown(suggestions) {
  const lines = [
    '# RISD Graphic Design Gate Status Import Suggestions',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'This file turns reviewer feedback imports into conservative learner gate-status import suggestions. A suggestion is copyable only when every gate check is satisfied and carries evidence refs.',
    '',
    `- Suggestion rows: ${suggestions.length}`,
    `- Ready to copy: ${suggestions.filter((row) => row.suggestion_status === 'ready_to_copy').length}`,
    `- Partial updates: ${suggestions.filter((row) => row.suggestion_status === 'partial_update').length}`,
    `- Awaiting feedback: ${suggestions.filter((row) => row.suggestion_status === 'awaiting_feedback').length}`,
    '',
  ]
  for (const row of suggestions) {
    lines.push(`## ${row.suggestion_id}`)
    lines.push('')
    lines.push(`- Milestone: ${row.milestone_id}`)
    lines.push(`- Handoff: ${row.handoff_id}`)
    lines.push(`- Feedback: ${row.feedback_id ?? 'none yet'}`)
    lines.push(`- Gate: ${row.gate_id ?? 'missing'}`)
    lines.push(`- Evidence attachment manifest: ${row.evidence_attachment_manifest_id ?? 'missing'}`)
    lines.push(`- Status: ${row.suggestion_status}`)
    lines.push(`- Satisfied checks with evidence: ${row.satisfied_check_count_with_evidence}/${row.satisfied_check_count + row.pending_check_count}`)
    lines.push('- Suggested evidence refs by check:')
    row.suggested_check_evidence_refs.forEach((entry) => lines.push(`  - ${entry.check_id}: ${entry.suggested_evidence_refs.length} ref${entry.suggested_evidence_refs.length === 1 ? '' : 's'}`))
    lines.push(`- Revision queue rows: ${row.revision_queue_ids.length ? row.revision_queue_ids.join(', ') : 'none'}`)
    lines.push(`- Next action: ${row.next_action}`)
    if (row.suggested_gate_status_import) {
      lines.push('- Suggested import row:')
      lines.push('```json')
      lines.push(JSON.stringify(row.suggested_gate_status_import))
      lines.push('```')
    }
    lines.push('')
  }
  return lines.map((line) => line.trimEnd()).join('\n')
}

function selfStudyPortfolioRevisionQueueMarkdown(revisionQueue) {
  const lines = [
    '# RISD Graphic Design Portfolio Revision Queue',
    '',
    `Generated: ${retrievedAt}`,
    '',
    'This queue turns reviewer feedback or unresolved handoff blockers into learner revision work. Rows from generated blockers are templates until a reviewer feedback import supplies actual critique outcomes.',
    '',
    `- Revision rows: ${revisionQueue.length}`,
    `- Pending rows: ${revisionQueue.filter((row) => row.status === 'pending').length}`,
    `- Resolved rows: ${revisionQueue.filter((row) => row.status === 'resolved').length}`,
    '',
  ]
  for (const row of revisionQueue) {
    lines.push(`## ${row.queue_id}`)
    lines.push('')
    lines.push(`- Milestone: ${row.milestone_id}`)
    lines.push(`- Handoff: ${row.handoff_id}`)
    lines.push(`- Source: ${row.source}`)
    lines.push(`- Blocker type: ${row.blocker_type}`)
    lines.push(`- Priority: ${row.priority}`)
    lines.push(`- Status: ${row.status}`)
    lines.push(`- Revision: ${row.revision_prompt}`)
    lines.push(`- Evidence refs: ${row.evidence_refs.length ? row.evidence_refs.join(', ') : 'none yet'}`)
    lines.push(`- Next action: ${row.next_action}`)
    lines.push('')
  }
  return lines.map((line) => line.trimEnd()).join('\n')
}

function annotateSelfStudyProgressLedgerWithPortfolioGates(progressLedger, portfolioMilestones, portfolioCompletionGates) {
  const milestoneByPacingId = new Map()
  for (const milestone of portfolioMilestones) {
    for (const pacingId of milestone.pacing_ids ?? []) {
      milestoneByPacingId.set(pacingId, milestone)
    }
  }
  const gateByMilestoneId = new Map(portfolioCompletionGates.map((gate) => [gate.milestone_id, gate]))
  return progressLedger.map((entry) => {
    const milestone = milestoneByPacingId.get(entry.pacing_id)
    const gate = milestone ? gateByMilestoneId.get(milestone.milestone_id) : null
    return {
      ...entry,
      portfolio_review: milestone && gate ? {
        milestone_id: milestone.milestone_id,
        milestone_title: milestone.title,
        completion_gate_id: gate.gate_id,
        readiness_status: gate.current_readiness_status,
        blocking_conditions: gate.blocking_conditions ?? [],
        ready_when: gate.ready_when ?? [],
        provenance_note: 'Generated from portfolio completion gates so weekly ledger rows can be reconciled with review-readiness packages.',
      } : null,
    }
  })
}

function buildSelfStudyPortfolioMilestones(selfStudyModules, pacingPlan) {
  const specs = [
    {
      milestone_id: 'portfolio_milestone_01_foundation_methods',
      title: 'Foundation Methods Portfolio Review',
      stage: 'foundation',
      moduleFilter: (module) => module.module_dependency_map?.dependency_stage === 'foundation',
      review_focus: 'Evidence-backed fundamentals: visible constraints, form decisions, critique response, and revised artifacts.',
    },
    {
      milestone_id: 'portfolio_milestone_02_typography_systems',
      title: 'Typography And Systems Portfolio Review',
      stage: 'intermediate_practice',
      moduleFilter: (module) => module.module_dependency_map?.dependency_stage === 'intermediate_practice',
      review_focus: 'Intermediate systems: typographic control, publication or type artifacts, and documented iteration across related prompts.',
    },
    {
      milestone_id: 'portfolio_milestone_03_advanced_synthesis',
      title: 'Advanced Synthesis Portfolio Review',
      stage: 'advanced_synthesis',
      moduleFilter: (module) => module.module_dependency_map?.dependency_stage === 'advanced_synthesis',
      review_focus: 'Advanced synthesis: multi-part artifacts, public/contextual systems, technical or editorial constraints, and a portfolio-level critique narrative.',
    },
  ]
  const pacingByModule = new Map()
  for (const row of pacingPlan) {
    const existing = pacingByModule.get(row.module_id) ?? []
    existing.push(row)
    pacingByModule.set(row.module_id, existing)
  }
  return specs.map((spec) => {
    const modules = selfStudyModules.filter(spec.moduleFilter)
    const rows = modules.flatMap((module) => pacingByModule.get(module.module_id) ?? [])
    const assignmentIds = uniq(rows.map((row) => row.assignment_id).filter(Boolean))
    const readingIds = uniq(rows.flatMap((row) => row.reading_ids ?? []))
    const sourceIds = uniq(modules.flatMap((module) => module.source_ids ?? [])).slice(0, 16)
    return {
      milestone_id: spec.milestone_id,
      generated_at: retrievedAt,
      title: spec.title,
      milestone_stage: spec.stage,
      module_ids: modules.map((module) => module.module_id),
      pacing_ids: rows.map((row) => row.pacing_id),
      week_range: rows.length ? [Math.min(...rows.map((row) => row.week_number)), Math.max(...rows.map((row) => row.week_number))] : [],
      assignment_ids: assignmentIds,
      reading_ids: readingIds,
      estimated_hours: rows.reduce((sum, row) => sum + (row.workload_estimate?.estimated_hours ?? 0), 0),
      portfolio_outputs: uniq([
        ...rows.map((row) => row.expected_output).filter(Boolean),
        'before/after revision documentation',
        'one-page critique memo for each module',
      ]).slice(0, 12),
      review_focus: spec.review_focus,
      review_prompts: [
        'Which constraints are visible in the final artifacts?',
        'What changed after critique, and where is the evidence of that change?',
        'Which source-grounded readings/resources changed a design decision?',
        'Which missing evidence limits the confidence of this portfolio package?',
      ],
      evidence_basis: 'self_study_modules_and_pacing_rows',
      source_ids: sourceIds,
      provenance_note: 'Generated for self-study portfolio review from public corpus evidence; not an official RISD assessment rubric.',
    }
  }).filter((milestone) => milestone.module_ids.length)
}

function buildSelfStudyPortfolioBriefs(selfStudyModules, pacingPlan, portfolioMilestones, portfolioCompletionGates = []) {
  const modulesById = new Map(selfStudyModules.map((module) => [module.module_id, module]))
  const pacingById = new Map(pacingPlan.map((row) => [row.pacing_id, row]))
  const gateByMilestoneId = new Map(portfolioCompletionGates.map((gate) => [gate.milestone_id, gate]))
  return portfolioMilestones.map((milestone) => {
    const modules = milestone.module_ids.map((id) => modulesById.get(id)).filter(Boolean)
    const pacingRows = milestone.pacing_ids.map((id) => pacingById.get(id)).filter(Boolean)
    const completionGate = gateByMilestoneId.get(milestone.milestone_id) ?? null
    const fileName = `${milestone.milestone_id}.md`
    const reviewPackage = uniq([
      ...(milestone.portfolio_outputs ?? []),
      ...pacingRows.map((row) => row.expected_output).filter(Boolean),
    ]).slice(0, 14)
    const sourceIds = uniq([
      ...(milestone.source_ids ?? []),
      ...modules.flatMap((module) => module.source_ids ?? []),
      ...pacingRows.flatMap((row) => row.source_ids ?? []),
    ]).slice(0, 24)
    const markdown = portfolioBriefMarkdown({ milestone, modules, pacingRows, reviewPackage, sourceIds, completionGate })
    return {
      brief_id: `brief_${milestone.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: milestone.milestone_id,
      title: milestone.title,
      output_path: `self_study_portfolio_briefs/${fileName}`,
      reference_packet_id: `reference_packet_${milestone.milestone_id}`,
      week_range: milestone.week_range ?? [],
      module_ids: milestone.module_ids ?? [],
      pacing_ids: milestone.pacing_ids ?? [],
      assignment_ids: milestone.assignment_ids ?? [],
      reading_ids: milestone.reading_ids ?? [],
      estimated_hours: milestone.estimated_hours,
      review_package: reviewPackage,
      review_focus: milestone.review_focus,
      review_prompts: milestone.review_prompts ?? [],
      completion_gate_id: completionGate?.gate_id ?? null,
      review_readiness: completionGate ? {
        status: completionGate.current_readiness_status,
        gate_checks: completionGate.gate_checks ?? [],
        blocking_conditions: completionGate.blocking_conditions ?? [],
        ready_when: completionGate.ready_when ?? [],
      } : null,
      source_ids: sourceIds,
      markdown,
      provenance_note: 'Export-friendly markdown page generated from public corpus milestones; not an official RISD portfolio review sheet.',
    }
  })
}

function buildSelfStudyPortfolioReferencePackets(selfStudyModules, portfolioMilestones, facultyPortfolioExamples = []) {
  const modulesById = new Map(selfStudyModules.map((module) => [module.module_id, module]))
  return portfolioMilestones.map((milestone) => {
    const modules = milestone.module_ids.map((id) => modulesById.get(id)).filter(Boolean)
    const studentReferences = modules
      .flatMap((module) => (module.comparison_set ?? []).map((comparison) => ({
        reference_id: `student_${comparison.student_work_id}_${module.module_id}`,
        relationship_label: comparison.relationship_type,
        boundary_note: comparison.relationship_type === 'assignment_link'
          ? 'Public student work is linked to an assignment by recovered evidence.'
          : comparison.relationship_type === 'brief_page_link'
            ? 'Public student work is linked to a recovered brief page, not necessarily a complete assignment.'
            : 'Public student work has course context only; use for visual calibration, not as assignment fact.',
        module_id: module.module_id,
        course_title: module.course_title ?? null,
        student_work_id: comparison.student_work_id,
        faculty_portfolio_example_id: null,
        title: comparison.relationship_note ?? comparison.student_work_id,
        url: comparison.student_work_url,
        comparison_use: comparison.comparison_use ?? ['visual_calibration'],
        evidence_grade: comparison.evidence_grade ?? null,
        source_ids: comparison.source_ids ?? [],
      })))
      .filter((item) => item.url)
    const instructorNames = new Set(modules.flatMap((module) => module.instructor_evidence ?? []).map((name) => String(name).toLowerCase()))
    const stageTerms = milestone.milestone_stage === 'advanced_synthesis'
      ? /identity|system|publication|book|motion|interactive|website|politic|public/i
      : milestone.milestone_stage === 'intermediate_practice'
        ? /type|typography|book|publication|website|interactive|motion/i
        : /form|book|website|interface|animation|visual/i
    const facultyReferences = facultyPortfolioExamples
      .filter((example) =>
        instructorNames.has(String(example.faculty_name ?? '').toLowerCase())
          || stageTerms.test([example.title, example.medium, example.project_statement_excerpt].filter(Boolean).join(' '))
      )
      .slice(0, 8)
      .map((example) => ({
        reference_id: `faculty_${example.example_id}`,
        relationship_label: 'faculty_public_portfolio_example_context_only',
        boundary_note: 'Faculty portfolio example is public visual/professional calibration only; it is not student work and not course evidence unless another source says so.',
        module_id: null,
        course_title: null,
        student_work_id: null,
        faculty_portfolio_example_id: example.example_id,
        title: example.title ?? example.faculty_name,
        url: example.url,
        comparison_use: ['visual_calibration', 'professional_reference'],
        evidence_grade: example.evidence_grade ?? null,
        source_ids: example.source_ids ?? [],
      }))
    const referenceGroups = [
      {
        group_id: 'public_student_work',
        relationship_label: 'student_work_public_comparison',
        boundary_note: 'Use only according to each item relationship label; rejected weak matches are excluded.',
        items: dedupeReferences(studentReferences).slice(0, 10),
      },
      {
        group_id: 'faculty_portfolio_examples',
        relationship_label: 'faculty_portfolio_public_context',
        boundary_note: 'Faculty examples calibrate quality, medium, and public-facing presentation; they do not fill missing syllabi or assignments.',
        items: dedupeReferences(facultyReferences).slice(0, 8),
      },
    ]
    return {
      packet_id: `reference_packet_${milestone.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: milestone.milestone_id,
      title: `${milestone.title} Reference Packet`,
      relationship_policy: 'Public references are labeled by relationship strength and must not be promoted into course facts without corroborating source evidence.',
      reference_groups: referenceGroups,
      source_ids: uniq(referenceGroups.flatMap((group) => group.items.flatMap((item) => item.source_ids ?? []))),
      provenance_note: 'Generated from self-study module comparison sets and public faculty portfolio examples.',
    }
  })
}

function dedupeReferences(items) {
  const seen = new Set()
  return items.filter((item) => {
    const key = `${item.relationship_label}_${item.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildSelfStudyPortfolioSourceExcerptPackets(selfStudyModules, portfolioMilestones) {
  const modulesById = new Map(selfStudyModules.map((module) => [module.module_id, module]))
  return portfolioMilestones.map((milestone) => {
    const modules = milestone.module_ids.map((id) => modulesById.get(id)).filter(Boolean)
    const assignmentItems = modules.flatMap((module) => (module.assignments ?? []).slice(0, 4).map((assignment) => ({
      excerpt_id: `excerpt_${milestone.milestone_id}_${assignment.assignment_id}`,
      evidence_role: 'assignment_brief_excerpt',
      module_id: module.module_id,
      course_title: module.course_title ?? null,
      assignment_id: assignment.assignment_id,
      reading_id: null,
      schedule_id: null,
      source_ids: assignment.source_ids ?? [],
      excerpt_text: compactExcerpt(assignment.prompt_excerpt),
      evidence_note: [assignment.title, assignment.output_format, assignment.critique_format ?? assignment.revision_expectation].filter(Boolean).join('; ') || 'selected assignment evidence excerpt',
    })))
    const readingItems = modules.flatMap((module) => (module.readings ?? []).slice(0, 3).map((reading) => ({
      excerpt_id: `excerpt_${milestone.milestone_id}_${reading.reading_id}`,
      evidence_role: 'reading_resource_excerpt',
      module_id: module.module_id,
      course_title: module.course_title ?? null,
      assignment_id: null,
      reading_id: reading.reading_id,
      schedule_id: null,
      source_ids: reading.source_ids ?? [],
      excerpt_text: compactExcerpt(reading.title ?? reading.raw_citation),
      evidence_note: [reading.author, reading.citation_type, reading.reading_context].filter(Boolean).join('; ') || 'selected reading/resource evidence',
    })))
    const scheduleItems = modules.flatMap((module) => (module.schedule_rows ?? []).slice(0, 2).map((row) => ({
      excerpt_id: `excerpt_${milestone.milestone_id}_${row.schedule_id}`,
      evidence_role: 'schedule_rhythm_excerpt',
      module_id: module.module_id,
      course_title: module.course_title ?? null,
      assignment_id: null,
      reading_id: null,
      schedule_id: row.schedule_id,
      source_ids: [row.source_id].filter(Boolean),
      excerpt_text: compactExcerpt(row.agenda_excerpt ?? row.session_title),
      evidence_note: [row.date, row.week_number ? `week ${row.week_number}` : null, row.critique_signal ? 'critique signal' : null, row.workshop_signal ? 'workshop signal' : null].filter(Boolean).join('; ') || 'selected schedule evidence',
    })))
    const boundaryItems = modules.flatMap((module) => (module.missing_evidence_warnings ?? []).slice(0, 3).map((warning, index) => ({
      excerpt_id: `excerpt_${milestone.milestone_id}_${module.module_id}_boundary_${index + 1}`,
      evidence_role: 'missing_evidence_boundary',
      module_id: module.module_id,
      course_title: module.course_title ?? null,
      assignment_id: null,
      reading_id: null,
      schedule_id: null,
      source_ids: module.source_ids?.slice(0, 3) ?? [],
      excerpt_text: compactExcerpt(warning),
      evidence_note: 'explicit unknown preserved in generated module',
    })))
    const excerptGroups = [
      {
        group_id: 'assignment_brief_excerpts',
        evidence_role: 'assignment_brief_excerpt',
        boundary_note: 'Short excerpts from selected assignment evidence; use source IDs for full context.',
        items: dedupeExcerptItems(assignmentItems).slice(0, 18),
      },
      {
        group_id: 'reading_resource_excerpts',
        evidence_role: 'reading_resource_excerpt',
        boundary_note: 'Short reading/resource labels from selected module packets; not full copyrighted readings.',
        items: dedupeExcerptItems(readingItems).slice(0, 14),
      },
      {
        group_id: 'schedule_rhythm_excerpts',
        evidence_role: 'schedule_rhythm_excerpt',
        boundary_note: 'Short schedule excerpts showing studio rhythm, critique, or workshop signals.',
        items: dedupeExcerptItems(scheduleItems).slice(0, 10),
      },
      {
        group_id: 'missing_evidence_boundaries',
        evidence_role: 'missing_evidence_boundary',
        boundary_note: 'Generated unknowns that must remain visible in exported study packets.',
        items: dedupeExcerptItems(boundaryItems).slice(0, 12),
      },
    ].filter((group) => group.items.length)
    return {
      packet_id: `source_excerpt_packet_${milestone.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: milestone.milestone_id,
      title: `${milestone.title} Source Excerpt Packet`,
      excerpt_policy: 'Short source-context excerpts are included for study navigation only; reopen source IDs for complete context and do not infer missing private course material.',
      excerpt_groups: excerptGroups,
      source_ids: uniq(excerptGroups.flatMap((group) => group.items.flatMap((item) => item.source_ids ?? []))),
      provenance_note: 'Generated from selected self-study module assignments, readings, schedule rows, and explicit missing-evidence warnings.',
    }
  })
}

function compactExcerpt(value, limit = 360) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= limit) return text
  return `${text.slice(0, limit - 1).trim()}…`
}

function dedupeExcerptItems(items) {
  const seen = new Set()
  return items.filter((item) => {
    const key = `${item.evidence_role}_${item.excerpt_text}_${item.module_id}`
    if (!item.excerpt_text || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildSelfStudyPortfolioExportManifests(portfolioMilestones, portfolioBriefs, portfolioReferencePackets, portfolioSourceExcerptPackets = []) {
  const briefByMilestone = new Map(portfolioBriefs.map((brief) => [brief.milestone_id, brief]))
  const referencePacketByMilestone = new Map(portfolioReferencePackets.map((packet) => [packet.milestone_id, packet]))
  const sourceExcerptPacketByMilestone = new Map(portfolioSourceExcerptPackets.map((packet) => [packet.milestone_id, packet]))
  return portfolioMilestones.map((milestone) => {
    const brief = briefByMilestone.get(milestone.milestone_id)
    const referencePacket = referencePacketByMilestone.get(milestone.milestone_id)
    const sourceExcerptPacket = sourceExcerptPacketByMilestone.get(milestone.milestone_id)
    const sourceIds = uniq([
      ...(milestone.source_ids ?? []),
      ...(brief?.source_ids ?? []),
      ...(referencePacket?.source_ids ?? []),
      ...(sourceExcerptPacket?.source_ids ?? []),
    ])
    const assignmentIds = uniq([
      ...(milestone.assignment_ids ?? []),
      ...(brief?.assignment_ids ?? []),
    ])
    const readingIds = uniq([
      ...(milestone.reading_ids ?? []),
      ...(brief?.reading_ids ?? []),
    ])
    return {
      manifest_id: `export_manifest_${milestone.milestone_id}`,
      generated_at: retrievedAt,
      milestone_id: milestone.milestone_id,
      title: `${milestone.title} Export Manifest`,
      brief_id: brief?.brief_id ?? null,
      reference_packet_id: referencePacket?.packet_id ?? null,
      source_excerpt_packet_id: sourceExcerptPacket?.packet_id ?? null,
      export_files: [
        {
          file_role: 'portfolio_brief_markdown',
          path: brief?.output_path ?? null,
          media_type: 'text/markdown',
          use: 'print_or_export_as_primary_review_sheet',
        },
        {
          file_role: 'portfolio_brief_index_row',
          path: 'self_study_portfolio_briefs.jsonl',
          row_id: brief?.brief_id ?? null,
          media_type: 'application/jsonl',
          use: 'structured brief metadata for downstream tools',
        },
        {
          file_role: 'reference_packet_jsonl_row',
          path: 'self_study_portfolio_reference_packets.jsonl',
          row_id: referencePacket?.packet_id ?? null,
          media_type: 'application/jsonl',
          use: 'relationship-labeled public visual/reference examples',
        },
        {
          file_role: 'source_excerpt_packet_jsonl_row',
          path: 'self_study_portfolio_source_excerpt_packets.jsonl',
          row_id: sourceExcerptPacket?.packet_id ?? null,
          media_type: 'application/jsonl',
          use: 'short source-context excerpts for study navigation',
        },
      ],
      print_packet_order: [
        'portfolio_brief_markdown',
        'reference_packet_jsonl_row',
        'source_excerpt_packet_jsonl_row',
        'source_id_manifest',
      ],
      source_id_manifest: sourceIds,
      external_tool_payload: {
        milestone_id: milestone.milestone_id,
        title: milestone.title,
        brief_path: brief?.output_path ?? null,
        reference_packet_id: referencePacket?.packet_id ?? null,
        source_excerpt_packet_id: sourceExcerptPacket?.packet_id ?? null,
        week_range: milestone.week_range ?? [],
        module_ids: milestone.module_ids ?? [],
        assignment_ids: assignmentIds,
        reading_ids: readingIds,
        source_ids: sourceIds,
        review_prompts: milestone.review_prompts ?? [],
        evidence_boundary: 'Generated from public corpus evidence only; do not infer private RISD assessment, private readings, or missing assignment details.',
      },
      provenance_note: 'Generated export manifest for packaging a portfolio brief, its relationship-labeled reference packet, and source IDs for external study tools.',
    }
  })
}

function portfolioBriefMarkdown({ milestone, modules, pacingRows, reviewPackage, sourceIds, completionGate = null }) {
  const lines = []
  lines.push(`# ${milestone.title}`)
  lines.push('')
  lines.push(`Generated: ${retrievedAt}`)
  lines.push('')
  lines.push('## Evidence Boundary')
  lines.push('')
  lines.push('This is an export-friendly self-study portfolio brief generated from public RISD Graphic Design corpus evidence. It is not an official RISD assessment rubric, and missing private classroom details remain unknown.')
  lines.push('')
  lines.push(`- Milestone ID: ${milestone.milestone_id}`)
  lines.push(`- Stage: ${milestone.milestone_stage.replace(/_/g, ' ')}`)
  lines.push(`- Weeks: ${milestone.week_range?.length ? milestone.week_range.join('-') : 'unknown'}`)
  lines.push(`- Estimated workload: ${milestone.estimated_hours} hours`)
  lines.push(`- Reference packet: reference_packet_${milestone.milestone_id}`)
  lines.push(`- Source IDs: ${sourceIds.join(', ')}`)
  lines.push('')
  lines.push('## Review Focus')
  lines.push('')
  lines.push(milestone.review_focus)
  lines.push('')
  lines.push('## Review Readiness Gate')
  lines.push('')
  if (completionGate) {
    lines.push(`- Completion gate: ${completionGate.gate_id}`)
    lines.push(`- Current readiness: ${completionGate.current_readiness_status}`)
    lines.push('- Gate checks:')
    ;(completionGate.gate_checks ?? []).forEach((check) => {
      lines.push(`  - [ ] ${check.label} (${check.current_status})`)
      lines.push(`    - Required evidence: ${check.required_evidence.slice(0, 6).join('; ')}`)
    })
    if (completionGate.blocking_conditions?.length) {
      lines.push('- Blocking conditions:')
      completionGate.blocking_conditions.forEach((condition) => lines.push(`  - ${condition}`))
    }
    if (completionGate.ready_when?.length) {
      lines.push('- Ready when:')
      completionGate.ready_when.forEach((condition) => lines.push(`  - ${condition}`))
    }
  } else {
    lines.push('- No generated completion gate is linked to this milestone yet.')
  }
  lines.push('')
  lines.push('## Review Package')
  lines.push('')
  reviewPackage.forEach((item) => lines.push(`- ${item}`))
  lines.push('')
  lines.push('## Modules Included')
  lines.push('')
  modules.forEach((module) => {
    lines.push(`### ${module.course_title ?? module.course_code ?? module.module_id}`)
    lines.push('')
    lines.push(`- Module ID: ${module.module_id}`)
    lines.push(`- Track: ${module.track_title}`)
    lines.push(`- Confidence: ${module.module_confidence_band} (${module.module_confidence_score}/100)`)
    lines.push(`- Studio loop: ${module.studio_loop}`)
    if (module.practice_instruction?.instruction) lines.push(`- Practice instruction: ${module.practice_instruction.instruction}`)
    if (module.assignment_ids?.length) lines.push(`- Assignment IDs: ${module.assignment_ids.slice(0, 6).join(', ')}`)
    if (module.reading_ids?.length) lines.push(`- Reading/resource IDs: ${module.reading_ids.slice(0, 6).join(', ')}`)
    if (module.missing_evidence_warnings?.length) lines.push(`- Unknowns to preserve: ${module.missing_evidence_warnings.slice(0, 4).join('; ')}`)
    lines.push('')
  })
  lines.push('## Weekly Build Steps')
  lines.push('')
  pacingRows.forEach((row) => {
    lines.push(`- Week ${row.week_number}: ${row.focus}`)
    lines.push(`  - Output: ${row.expected_output}`)
    lines.push(`  - Critique checkpoint: ${row.critique_checkpoint}`)
    if (row.assignment_id) lines.push(`  - Assignment evidence: ${row.assignment_id}`)
  })
  lines.push('')
  lines.push('## Critique Prompts')
  lines.push('')
  ;(milestone.review_prompts ?? []).forEach((prompt) => lines.push(`- ${prompt}`))
  lines.push('')
  lines.push('## Reference Packet')
  lines.push('')
  lines.push(`Use \`reference_packet_${milestone.milestone_id}\` from \`self_study_portfolio_reference_packets.jsonl\` for public student-work and faculty-portfolio examples. Each item is relationship-labeled; do not treat context-only examples as assignment facts.`)
  lines.push('')
  lines.push('## Export Checklist')
  lines.push('')
  lines.push('- One folder containing final artifacts.')
  lines.push('- One process folder showing sketches, drafts, or prototypes.')
  lines.push('- One critique memo explaining constraints, changes after critique, and remaining unknowns.')
  lines.push('- Source ID list copied into the package so evidence boundaries stay visible.')
  lines.push('')
  return lines.map((line) => line.trimEnd()).join('\n')
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
  const selected = curriculumSelectedPackets(packets)
  const modules = buildSelfStudyModules({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks })
  const pacingPlan = buildSelfStudyPacingPlan(modules)
  const pacingProfiles = buildSelfStudyPacingProfiles(pacingPlan)
  const portfolioMilestones = buildSelfStudyPortfolioMilestones(modules, pacingPlan)

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
      const moduleAssignments = curriculumAssignmentCandidates(courseAssignments).slice(0, 6)
      const moduleReadings = curriculumReadingCandidates(courseReadings).slice(0, 8)
      const moduleScheduleRows = curriculumScheduleCandidates(courseScheduleRows).slice(0, 8)
      const moduleUnknowns = curriculumModuleUnknowns({ courseSyllabi, assignments: courseAssignments, readings: courseReadings, scheduleRows: courseScheduleRows, studentWorkLinks: courseStudentWorkLinks })
      const comparisonSet = courseStudentWorkLinks.length
        ? courseStudentWorkLinks.slice(0, 6).map((link) => ({
          relationship_type: link.relationship_type,
          student_work_id: link.student_work_id,
          student_work_url: link.student_work_url,
          assignment_id: link.assignment_id ?? null,
          brief_page_id: link.brief_page_id ?? null,
          comparison_use: link.comparison_use ?? [],
          evidence_grade: link.evidence_grade,
          relationship_note: link.assignment_title ? `assignment: ${link.assignment_title}` : link.brief_page_id ? `brief page: ${link.brief_page_id}` : 'course context',
        }))
        : courseStudentWork
          .filter((work) => work.course_code || work.course_title)
          .slice(0, 6)
          .map((work) => ({
            relationship_type: 'course_context_only',
            student_work_id: work.student_work_id,
            student_work_url: work.url,
            assignment_id: null,
            brief_page_id: null,
            comparison_use: ['visual_calibration'],
            evidence_grade: work.evidence_grade,
            relationship_note: 'course-context evidence only',
          }))
      const moduleConfidence = selfStudyModuleConfidence({ course, courseSyllabi, moduleAssignments, moduleReadings, moduleScheduleRows, comparisonSet, moduleUnknowns })
      const selectedIndex = selected.findIndex((candidate) => curriculumPacketKey(candidate) === curriculumPacketKey(packet))
      const orderingRationale = curriculumOrderingRationale({ packet, selected, packets, selectedIndex })
      const dependencyMap = curriculumDependencyMap({ packet, selected, selectedIndex, moduleAssignments, moduleReadings, moduleScheduleRows })
      lines.push(`#### ${course.course_title ?? course.course_code ?? course.course_id}`)
      lines.push('')
      lines.push(`- Evidence grade: ${course.evidence_grade}`)
      lines.push(`- Module confidence: ${moduleConfidence.confidence_band} (${moduleConfidence.confidence_score}/100)`)
      lines.push(`- Why this module was selected: ${moduleConfidence.confidence_explanation.selection_reason}`)
      if (moduleConfidence.confidence_explanation.strengths.length) lines.push(`- Confidence strengths: ${moduleConfidence.confidence_explanation.strengths.join('; ')}`)
      if (moduleConfidence.confidence_explanation.limitations.length) lines.push(`- Confidence limits: ${moduleConfidence.confidence_explanation.limitations.join('; ')}`)
      lines.push(`- Ordering rationale: ${orderingRationale.selected_reason}`)
      if (orderingRationale.near_miss_candidates.length) {
        lines.push('- Near-miss candidates in this track:')
        orderingRationale.near_miss_candidates.forEach((candidate) => {
          lines.push(`  - ${candidate.course_title ?? candidate.course_code ?? candidate.course_id}: score ${candidate.evidence_score}, ${candidate.assignment_candidate_count} assignment candidates, ${candidate.reason_not_selected.replace(/_/g, ' ')}`)
        })
      }
      lines.push(`- Dependency stage: ${dependencyMap.dependency_stage.replace(/_/g, ' ')}`)
      if (dependencyMap.prerequisite_module_ids.length) lines.push(`- Prerequisite modules: ${dependencyMap.prerequisite_module_ids.join(', ')}`)
      if (dependencyMap.enables_module_ids.length) lines.push(`- Enables next modules: ${dependencyMap.enables_module_ids.join(', ')}`)
      if (dependencyMap.dependency_basis.length) lines.push(`- Dependency basis: ${dependencyMap.dependency_basis.join('; ')}`)
      lines.push(`- Course code: ${course.course_code ?? 'unknown'}`)
      lines.push(`- Source IDs: ${course.source_ids.join(', ')}`)
      if (courseSyllabi.length) lines.push(`- Syllabus/course artifacts: ${courseSyllabi.map((syllabus) => syllabus.syllabus_id).join(', ')}`)
      const instructors = uniq(courseSyllabi.map((syllabus) => syllabus.instructor).filter(Boolean))
      if (instructors.length) lines.push(`- Instructor evidence: ${instructors.join(', ')}`)
      const tools = uniq(courseSyllabi.flatMap((syllabus) => syllabus.tools ?? [])).slice(0, 8)
      if (tools.length) lines.push(`- Tools/software/materials to practice: ${tools.join(', ')}`)
      const skills = uniq([...course.skills, ...courseAssignments.flatMap((assignment) => assignment.skills_trained ?? [])]).slice(0, 10)
      if (skills.length) lines.push(`- Skill targets: ${skills.join(', ')}`)
      if (moduleReadings.length) {
        lines.push('- Reading packet:')
        moduleReadings.slice(0, 6).forEach((reading) => {
          const title = reading.title ?? reading.raw_citation ?? reading.citation_excerpt
          const tags = [
            reading.required_or_recommended && reading.required_or_recommended !== 'unknown' ? reading.required_or_recommended : null,
            reading.citation_type,
            reading.reading_context && reading.reading_context !== 'unknown' ? reading.reading_context : null,
            reading.linked_schedule_ids?.length ? `schedule-linked: ${reading.linked_schedule_ids.slice(0, 2).join(', ')}` : null,
            reading.linked_assignment_ids?.length ? `assignment-linked: ${reading.linked_assignment_ids.slice(0, 2).join(', ')}` : null,
          ].filter(Boolean)
          lines.push(`  - ${title}${reading.author ? `, ${reading.author}` : ''}${tags.length ? ` (${tags.join('; ')})` : ''}`)
        })
      }
      if (moduleScheduleRows.length) {
        lines.push('- Schedule rhythm:')
        moduleScheduleRows.slice(0, 5).forEach((row) => lines.push(`  - ${row.date ?? row.session_title ?? row.schedule_source}: ${row.agenda_excerpt}`))
      }
      if (moduleAssignments.length) {
        lines.push('- Studio briefs to recreate:')
        moduleAssignments.slice(0, 6).forEach((assignment) => {
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
      if (moduleAssignments.length) {
        const practiceAssignment = moduleAssignments[0]
        const practiceDetails = [
          practiceAssignment.deliverables?.length ? `make ${practiceAssignment.deliverables.slice(0, 3).join(', ')}` : 'make the recovered artifact',
          practiceAssignment.constraints?.length ? `under constraints: ${practiceAssignment.constraints.slice(0, 3).join(', ')}` : null,
          practiceAssignment.critique_format || practiceAssignment.revision_expectation ? `critique/revise: ${practiceAssignment.critique_format ?? practiceAssignment.revision_expectation}` : 'write a critique memo and revise once',
          practiceAssignment.output_format ? `output: ${practiceAssignment.output_format}` : null,
        ].filter(Boolean)
        lines.push('- Practice loop:')
        lines.push(`  - ${practiceDetails.join('; ')}. Cite assignment ${practiceAssignment.assignment_id}.`)
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
      if (moduleUnknowns.length) {
        lines.push('- Missing evidence warnings:')
        moduleUnknowns.slice(0, 6).forEach((unknown) => lines.push(`  - ${unknown}`))
      }
      lines.push('- Mentor-style checkpoint:')
      lines.push('  - What exactly did you make, what constraints did you honor, what changed after critique, and what evidence shows the work improved?')
      lines.push('')
    }
  }
  lines.push('## Weekly Pacing Plan')
  lines.push('')
  lines.push('This pacing plan is generated from module dependencies and recovered studio evidence. It is a self-study calendar, not an official RISD schedule.')
  lines.push('')
  pacingPlan.forEach((row) => {
    const tags = [
      row.module_stage ? `stage: ${row.module_stage.replace(/_/g, ' ')}` : null,
      row.assignment_id ? `assignment: ${row.assignment_id}` : null,
      row.reading_ids?.length ? `readings/resources: ${row.reading_ids.slice(0, 3).join(', ')}` : null,
      row.prerequisite_module_ids?.length ? `prerequisites: ${row.prerequisite_module_ids.join(', ')}` : null,
      row.workload_estimate ? `${row.workload_estimate.estimated_hours}h ${row.workload_estimate.workload_band}` : null,
    ].filter(Boolean)
    lines.push(`- Week ${row.week_number}: ${row.focus}${tags.length ? ` (${tags.join('; ')})` : ''}`)
    lines.push(`  - Output: ${row.expected_output}`)
    lines.push(`  - Checkpoint: ${row.critique_checkpoint}`)
  })
  lines.push('')
  lines.push('## Pacing Profiles')
  lines.push('')
  pacingProfiles.forEach((profile) => {
    lines.push(`- ${profile.label}: ${profile.estimated_calendar_weeks} calendar weeks, about ${profile.target_hours_per_week} target hours/week, ${profile.estimated_total_hours} estimated total hours (${profile.row_grouping_rule}).`)
  })
  lines.push('')
  lines.push('## Portfolio Milestones')
  lines.push('')
  lines.push('These milestones bundle generated module outputs into reviewable bodies of work. They are self-study checkpoints, not official RISD assessment rubrics.')
  lines.push('')
  portfolioMilestones.forEach((milestone) => {
    lines.push(`- ${milestone.title}: weeks ${milestone.week_range.join('-')}, ${milestone.module_ids.length} modules, ${milestone.estimated_hours} estimated hours.`)
    lines.push(`  - Review focus: ${milestone.review_focus}`)
    lines.push(`  - Portfolio package: ${milestone.portfolio_outputs.slice(0, 5).join('; ')}`)
    lines.push(`  - Prompt: ${milestone.review_prompts[0]}`)
  })
  lines.push('')
  lines.push('## Gaps To Preserve')
  lines.push('')
  lines.push('- Do not invent missing rubrics, grades, private readings, or complete assignment sheets.')
  lines.push('- Prefer direct course-site and syllabus evidence over catalog descriptions when they disagree.')
  lines.push('- Use public student work as a comparison set only when the source provides course or assignment context.')
  lines.push('- Keep adding modules as search, faculty-profile, Wayback, and Common Crawl discovery recover more course artifacts.')
  lines.push('')
  return lines.map((line) => line.trimEnd()).join('\n')
}

function writeSelfStudyArtifacts({ courses, syllabi, assignments, readings, scheduleRows = [], studentWork, studentWorkAssignmentLinks = [], facultyPortfolioExamples = [] }) {
  const selfStudyModules = buildSelfStudyModules({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks })
  writeSelfStudyModuleArtifacts(selfStudyModules, facultyPortfolioExamples)
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks }))
  return selfStudyModules
}

function writeSelfStudyModuleArtifacts(selfStudyModules, facultyPortfolioExamples = []) {
  writeJsonl(join(outDir, 'self_study_modules.jsonl'), selfStudyModules)
  const pacingPlan = buildSelfStudyPacingPlan(selfStudyModules)
  const progressLedger = buildSelfStudyProgressLedger(selfStudyModules, pacingPlan)
  const portfolioMilestones = buildSelfStudyPortfolioMilestones(selfStudyModules, pacingPlan)
  const portfolioBriefsWithoutGates = buildSelfStudyPortfolioBriefs(selfStudyModules, pacingPlan, portfolioMilestones)
  const portfolioReferencePackets = buildSelfStudyPortfolioReferencePackets(selfStudyModules, portfolioMilestones, facultyPortfolioExamples)
  const portfolioSourceExcerptPackets = buildSelfStudyPortfolioSourceExcerptPackets(selfStudyModules, portfolioMilestones)
  const portfolioExportManifests = buildSelfStudyPortfolioExportManifests(portfolioMilestones, portfolioBriefsWithoutGates, portfolioReferencePackets, portfolioSourceExcerptPackets)
  const portfolioProgressRollups = buildSelfStudyPortfolioProgressRollups(portfolioMilestones, portfolioExportManifests, progressLedger)
  const basePortfolioCompletionGates = buildSelfStudyPortfolioCompletionGates(portfolioProgressRollups)
  const portfolioGateStatusTemplate = buildSelfStudyPortfolioGateStatusTemplate(basePortfolioCompletionGates)
  const portfolioGateStatusImports = loadJsonl(portfolioGateStatusImportPath)
  const portfolioCompletionGates = applySelfStudyPortfolioGateStatusImports(basePortfolioCompletionGates, portfolioGateStatusImports)
  const portfolioEvidenceAttachments = buildSelfStudyPortfolioEvidenceAttachments(portfolioMilestones, portfolioProgressRollups, portfolioCompletionGates, portfolioExportManifests)
  const portfolioGateStatusSummary = buildSelfStudyPortfolioGateStatusSummary(basePortfolioCompletionGates, portfolioCompletionGates, portfolioGateStatusImports)
  const progressLedgerWithPortfolioGateAnnotations = annotateSelfStudyProgressLedgerWithPortfolioGates(progressLedger, portfolioMilestones, portfolioCompletionGates)
  const portfolioBriefs = buildSelfStudyPortfolioBriefs(selfStudyModules, pacingPlan, portfolioMilestones, portfolioCompletionGates)
  const portfolioReviewIndex = buildSelfStudyPortfolioReviewIndex(portfolioMilestones, portfolioBriefs, portfolioGateStatusSummary, portfolioReferencePackets, portfolioSourceExcerptPackets, portfolioExportManifests)
  const portfolioReviewerHandoff = buildSelfStudyPortfolioReviewerHandoff(portfolioReviewIndex)
  const portfolioReviewerFeedbackTemplate = buildSelfStudyPortfolioReviewerFeedbackTemplate(portfolioReviewerHandoff, portfolioEvidenceAttachments)
  const portfolioReviewerFeedbackSmokeFixture = buildSelfStudyPortfolioReviewerFeedbackSmokeFixture(portfolioReviewerFeedbackTemplate)
  const portfolioReviewerFeedbackImports = loadJsonl(portfolioReviewerFeedbackImportPath)
  const portfolioRevisionQueue = buildSelfStudyPortfolioRevisionQueue(portfolioReviewerHandoff, portfolioReviewerFeedbackImports)
  const portfolioGateStatusSuggestions = buildSelfStudyPortfolioGateStatusSuggestions(portfolioReviewerHandoff, portfolioReviewerFeedbackImports, portfolioCompletionGates, portfolioRevisionQueue, portfolioEvidenceAttachments)
  const portfolioSmokeRevisionQueue = buildSelfStudyPortfolioRevisionQueue(portfolioReviewerHandoff, portfolioReviewerFeedbackSmokeFixture)
  const portfolioSmokeGateStatusSuggestions = buildSelfStudyPortfolioGateStatusSuggestions(portfolioReviewerHandoff, portfolioReviewerFeedbackSmokeFixture, portfolioCompletionGates, portfolioSmokeRevisionQueue, portfolioEvidenceAttachments)
  const portfolioReviewWorkflow = buildSelfStudyPortfolioReviewWorkflow({ reviewIndex: portfolioReviewIndex, evidenceAttachments: portfolioEvidenceAttachments, feedbackTemplates: portfolioReviewerFeedbackTemplate, revisionQueue: portfolioRevisionQueue, gateStatusSuggestions: portfolioGateStatusSuggestions, gateStatusTemplate: portfolioGateStatusTemplate, smokeFixture: portfolioReviewerFeedbackSmokeFixture })
  const portfolioReviewAgendas = buildSelfStudyPortfolioReviewAgendas(portfolioReviewWorkflow, portfolioReviewerHandoff)
  const portfolioReviewDashboard = buildSelfStudyPortfolioReviewDashboard({ reviewIndex: portfolioReviewIndex, reviewWorkflow: portfolioReviewWorkflow, reviewAgendas: portfolioReviewAgendas, evidenceAttachments: portfolioEvidenceAttachments, revisionQueue: portfolioRevisionQueue, gateStatusSuggestions: portfolioGateStatusSuggestions, gateStatusSummary: portfolioGateStatusSummary })
  const portfolioDecisionPackets = buildSelfStudyPortfolioDecisionPackets({ reviewDashboard: portfolioReviewDashboard, reviewAgendas: portfolioReviewAgendas, reviewerHandoffs: portfolioReviewerHandoff, feedbackTemplates: portfolioReviewerFeedbackTemplate, gateStatusSuggestions: portfolioGateStatusSuggestions })
  const portfolioCompletionChecklists = buildSelfStudyPortfolioCompletionChecklists({ decisionPackets: portfolioDecisionPackets, reviewDashboard: portfolioReviewDashboard, revisionQueue: portfolioRevisionQueue })
  const portfolioArchiveManifests = buildSelfStudyPortfolioArchiveManifests({ decisionPackets: portfolioDecisionPackets, completionChecklists: portfolioCompletionChecklists, portfolioBriefs, referencePackets: portfolioReferencePackets, sourceExcerptPackets: portfolioSourceExcerptPackets, exportManifests: portfolioExportManifests, gateStatusSummary: portfolioGateStatusSummary })
  const portfolioArchiveAudit = buildSelfStudyPortfolioArchiveAudit(portfolioArchiveManifests)
  const portfolioOperationsSummary = buildSelfStudyPortfolioOperationsSummary({ reviewDashboard: portfolioReviewDashboard, decisionPackets: portfolioDecisionPackets, completionChecklists: portfolioCompletionChecklists, archiveManifests: portfolioArchiveManifests, archiveAudit: portfolioArchiveAudit })
  const portfolioCollaboratorHandoffPackets = buildSelfStudyPortfolioCollaboratorHandoffPackets({ operationsSummary: portfolioOperationsSummary, reviewerHandoffs: portfolioReviewerHandoff })
  const portfolioCollaboratorResponseIntakeTemplate = buildSelfStudyPortfolioCollaboratorResponseIntakeTemplate({
    collaboratorHandoffPackets: portfolioCollaboratorHandoffPackets,
    reviewerFeedbackTemplates: portfolioReviewerFeedbackTemplate,
    decisionPackets: portfolioDecisionPackets,
    completionChecklists: portfolioCompletionChecklists,
  })
  const portfolioCollaboratorResponseReconciliation = buildSelfStudyPortfolioCollaboratorResponseReconciliation({
    intakeTemplates: portfolioCollaboratorResponseIntakeTemplate,
    feedbackImports: portfolioReviewerFeedbackImports,
    decisionPackets: portfolioDecisionPackets,
    completionChecklists: portfolioCompletionChecklists,
  })
  const portfolioCollaboratorResponseActionQueue = buildSelfStudyPortfolioCollaboratorResponseActionQueue(portfolioCollaboratorResponseReconciliation)
  const portfolioCollaboratorResponseActionProgress = buildSelfStudyPortfolioCollaboratorResponseActionProgress(portfolioCollaboratorResponseActionQueue)
  const portfolioCollaboratorResponseReviewBriefs = buildSelfStudyPortfolioCollaboratorResponseReviewBriefs({
    actionProgress: portfolioCollaboratorResponseActionProgress,
    reconciliationRows: portfolioCollaboratorResponseReconciliation,
    handoffPackets: portfolioCollaboratorHandoffPackets,
  })
  const portfolioCollaboratorResponseDistributionManifests = buildSelfStudyPortfolioCollaboratorResponseDistributionManifests(portfolioCollaboratorResponseReviewBriefs)
  const portfolioCollaboratorResponseSendLogImports = loadJsonl(portfolioCollaboratorResponseSendLogImportPath)
  const portfolioCollaboratorResponseDistributionStatus = buildSelfStudyPortfolioCollaboratorResponseDistributionStatus(portfolioCollaboratorResponseDistributionManifests, portfolioCollaboratorResponseSendLogImports)
  const portfolioCollaboratorResponseSendLogTemplate = buildSelfStudyPortfolioCollaboratorResponseSendLogTemplate(portfolioCollaboratorResponseDistributionStatus)
  const portfolioCollaboratorResponseReminderQueue = buildSelfStudyPortfolioCollaboratorResponseReminderQueue(portfolioCollaboratorResponseDistributionStatus, portfolioCollaboratorResponseDistributionManifests)
  const portfolioCollaboratorResponseEvidenceRegister = buildSelfStudyPortfolioCollaboratorResponseEvidenceRegister(portfolioCollaboratorResponseDistributionStatus, portfolioCollaboratorResponseReminderQueue)
  writeJsonl(join(outDir, 'self_study_pacing_plan.jsonl'), pacingPlan)
  writeJsonl(join(outDir, 'self_study_pacing_profiles.jsonl'), buildSelfStudyPacingProfiles(pacingPlan))
  writeJsonl(join(outDir, 'self_study_progress_ledger.jsonl'), progressLedgerWithPortfolioGateAnnotations)
  writeFileSync(join(outDir, 'self_study_progress_ledger.md'), selfStudyProgressLedgerMarkdown(progressLedgerWithPortfolioGateAnnotations))
  writeJsonl(join(outDir, 'self_study_portfolio_progress_rollups.jsonl'), portfolioProgressRollups)
  writeJsonl(join(outDir, 'self_study_portfolio_completion_gates.jsonl'), portfolioCompletionGates)
  writeJsonl(join(outDir, 'self_study_portfolio_evidence_attachments.jsonl'), portfolioEvidenceAttachments)
  writeFileSync(join(outDir, 'self_study_portfolio_evidence_attachments.md'), selfStudyPortfolioEvidenceAttachmentsMarkdown(portfolioEvidenceAttachments))
  writeJsonl(join(outDir, 'self_study_portfolio_gate_status_template.jsonl'), portfolioGateStatusTemplate)
  writeJsonl(join(outDir, 'self_study_portfolio_gate_status_summary.jsonl'), portfolioGateStatusSummary)
  writeFileSync(join(outDir, 'self_study_portfolio_gate_status_summary.md'), selfStudyPortfolioGateStatusSummaryMarkdown(portfolioGateStatusSummary))
  writeJsonl(join(outDir, 'self_study_portfolio_review_index.jsonl'), portfolioReviewIndex)
  writeFileSync(join(outDir, 'self_study_portfolio_review_index.md'), selfStudyPortfolioReviewIndexMarkdown(portfolioReviewIndex))
  writeJsonl(join(outDir, 'self_study_portfolio_reviewer_handoff.jsonl'), portfolioReviewerHandoff)
  writeFileSync(join(outDir, 'self_study_portfolio_reviewer_handoff.md'), selfStudyPortfolioReviewerHandoffMarkdown(portfolioReviewerHandoff))
  writeJsonl(join(outDir, 'self_study_portfolio_reviewer_feedback_template.jsonl'), portfolioReviewerFeedbackTemplate)
  writeFileSync(join(outDir, 'self_study_portfolio_reviewer_feedback_template.md'), selfStudyPortfolioReviewerFeedbackTemplateMarkdown(portfolioReviewerFeedbackTemplate))
  writeJsonl(join(outDir, 'self_study_portfolio_reviewer_feedback_smoke_fixture.jsonl'), portfolioReviewerFeedbackSmokeFixture)
  writeFileSync(join(outDir, 'self_study_portfolio_reviewer_feedback_smoke_fixture.md'), selfStudyPortfolioReviewerFeedbackSmokeMarkdown({ smokeFixture: portfolioReviewerFeedbackSmokeFixture, smokeRevisionQueue: portfolioSmokeRevisionQueue, smokeGateStatusSuggestions: portfolioSmokeGateStatusSuggestions }))
  writeJsonl(join(outDir, 'self_study_portfolio_revision_queue.jsonl'), portfolioRevisionQueue)
  writeFileSync(join(outDir, 'self_study_portfolio_revision_queue.md'), selfStudyPortfolioRevisionQueueMarkdown(portfolioRevisionQueue))
  writeJsonl(join(outDir, 'self_study_portfolio_gate_status_suggestions.jsonl'), portfolioGateStatusSuggestions)
  writeFileSync(join(outDir, 'self_study_portfolio_gate_status_suggestions.md'), selfStudyPortfolioGateStatusSuggestionsMarkdown(portfolioGateStatusSuggestions))
  writeJsonl(join(outDir, 'self_study_portfolio_review_workflow.jsonl'), portfolioReviewWorkflow)
  writeFileSync(join(outDir, 'self_study_portfolio_review_workflow.md'), selfStudyPortfolioReviewWorkflowMarkdown(portfolioReviewWorkflow))
  writeJsonl(join(outDir, 'self_study_portfolio_review_agendas.jsonl'), portfolioReviewAgendas)
  writeFileSync(join(outDir, 'self_study_portfolio_review_agendas.md'), selfStudyPortfolioReviewAgendasMarkdown(portfolioReviewAgendas))
  writeJsonl(join(outDir, 'self_study_portfolio_review_dashboard.jsonl'), portfolioReviewDashboard)
  writeFileSync(join(outDir, 'self_study_portfolio_review_dashboard.md'), selfStudyPortfolioReviewDashboardMarkdown(portfolioReviewDashboard))
  writeJsonl(join(outDir, 'self_study_portfolio_decision_packets.jsonl'), portfolioDecisionPackets)
  writeFileSync(join(outDir, 'self_study_portfolio_decision_packets.md'), selfStudyPortfolioDecisionPacketsMarkdown(portfolioDecisionPackets))
  writeJsonl(join(outDir, 'self_study_portfolio_completion_checklists.jsonl'), portfolioCompletionChecklists)
  writeFileSync(join(outDir, 'self_study_portfolio_completion_checklists.md'), selfStudyPortfolioCompletionChecklistsMarkdown(portfolioCompletionChecklists))
  writeJsonl(join(outDir, 'self_study_portfolio_review_archive_manifests.jsonl'), portfolioArchiveManifests)
  writeFileSync(join(outDir, 'self_study_portfolio_review_archive_manifests.md'), selfStudyPortfolioArchiveManifestsMarkdown(portfolioArchiveManifests))
  writeJsonl(join(outDir, 'self_study_portfolio_review_archive_audit.jsonl'), portfolioArchiveAudit)
  writeFileSync(join(outDir, 'self_study_portfolio_review_archive_audit.md'), selfStudyPortfolioArchiveAuditMarkdown(portfolioArchiveAudit))
  writeJsonl(join(outDir, 'self_study_portfolio_operations_summary.jsonl'), portfolioOperationsSummary)
  writeFileSync(join(outDir, 'self_study_portfolio_operations_summary.md'), selfStudyPortfolioOperationsSummaryMarkdown(portfolioOperationsSummary))
  writeJsonl(join(outDir, 'self_study_portfolio_collaborator_handoff_packets.jsonl'), portfolioCollaboratorHandoffPackets)
  writeFileSync(join(outDir, 'self_study_portfolio_collaborator_handoff_packets.md'), selfStudyPortfolioCollaboratorHandoffPacketsMarkdown(portfolioCollaboratorHandoffPackets))
  writeJsonl(join(outDir, 'self_study_portfolio_collaborator_response_intake_template.jsonl'), portfolioCollaboratorResponseIntakeTemplate)
  writeFileSync(join(outDir, 'self_study_portfolio_collaborator_response_intake_template.md'), selfStudyPortfolioCollaboratorResponseIntakeTemplateMarkdown(portfolioCollaboratorResponseIntakeTemplate))
  writeJsonl(join(outDir, 'self_study_portfolio_collaborator_response_reconciliation.jsonl'), portfolioCollaboratorResponseReconciliation)
  writeFileSync(join(outDir, 'self_study_portfolio_collaborator_response_reconciliation.md'), selfStudyPortfolioCollaboratorResponseReconciliationMarkdown(portfolioCollaboratorResponseReconciliation))
  writeJsonl(join(outDir, 'self_study_portfolio_collaborator_response_action_queue.jsonl'), portfolioCollaboratorResponseActionQueue)
  writeFileSync(join(outDir, 'self_study_portfolio_collaborator_response_action_queue.md'), selfStudyPortfolioCollaboratorResponseActionQueueMarkdown(portfolioCollaboratorResponseActionQueue))
  writeJsonl(join(outDir, 'self_study_portfolio_collaborator_response_action_progress.jsonl'), portfolioCollaboratorResponseActionProgress)
  writeFileSync(join(outDir, 'self_study_portfolio_collaborator_response_action_progress.md'), selfStudyPortfolioCollaboratorResponseActionProgressMarkdown(portfolioCollaboratorResponseActionProgress))
  writeJsonl(join(outDir, 'self_study_portfolio_collaborator_response_review_briefs.jsonl'), portfolioCollaboratorResponseReviewBriefs)
  writeFileSync(join(outDir, 'self_study_portfolio_collaborator_response_review_briefs.md'), selfStudyPortfolioCollaboratorResponseReviewBriefsMarkdown(portfolioCollaboratorResponseReviewBriefs))
  writeJsonl(join(outDir, 'self_study_portfolio_collaborator_response_distribution_manifests.jsonl'), portfolioCollaboratorResponseDistributionManifests)
  writeFileSync(join(outDir, 'self_study_portfolio_collaborator_response_distribution_manifests.md'), selfStudyPortfolioCollaboratorResponseDistributionManifestsMarkdown(portfolioCollaboratorResponseDistributionManifests))
  writeJsonl(join(outDir, 'self_study_portfolio_collaborator_response_distribution_status.jsonl'), portfolioCollaboratorResponseDistributionStatus)
  writeFileSync(join(outDir, 'self_study_portfolio_collaborator_response_distribution_status.md'), selfStudyPortfolioCollaboratorResponseDistributionStatusMarkdown(portfolioCollaboratorResponseDistributionStatus))
  writeJsonl(join(outDir, 'self_study_portfolio_collaborator_response_send_log_template.jsonl'), portfolioCollaboratorResponseSendLogTemplate)
  writeFileSync(join(outDir, 'self_study_portfolio_collaborator_response_send_log_template.md'), selfStudyPortfolioCollaboratorResponseSendLogTemplateMarkdown(portfolioCollaboratorResponseSendLogTemplate))
  writeJsonl(join(outDir, 'self_study_portfolio_collaborator_response_reminder_queue.jsonl'), portfolioCollaboratorResponseReminderQueue)
  writeFileSync(join(outDir, 'self_study_portfolio_collaborator_response_reminder_queue.md'), selfStudyPortfolioCollaboratorResponseReminderQueueMarkdown(portfolioCollaboratorResponseReminderQueue))
  writeJsonl(join(outDir, 'self_study_portfolio_collaborator_response_evidence_register.jsonl'), portfolioCollaboratorResponseEvidenceRegister)
  writeFileSync(join(outDir, 'self_study_portfolio_collaborator_response_evidence_register.md'), selfStudyPortfolioCollaboratorResponseEvidenceRegisterMarkdown(portfolioCollaboratorResponseEvidenceRegister))
  writeJsonl(join(outDir, 'self_study_portfolio_milestones.jsonl'), portfolioMilestones)
  writeJsonl(join(outDir, 'self_study_portfolio_reference_packets.jsonl'), portfolioReferencePackets)
  writeJsonl(join(outDir, 'self_study_portfolio_source_excerpt_packets.jsonl'), portfolioSourceExcerptPackets)
  writeJsonl(join(outDir, 'self_study_portfolio_export_manifests.jsonl'), portfolioExportManifests)
  writeSelfStudyPortfolioBriefFiles(portfolioBriefs)
}

function writeSelfStudyPortfolioBriefFiles(portfolioBriefs) {
  const briefDir = join(outDir, 'self_study_portfolio_briefs')
  rmSync(briefDir, { recursive: true, force: true })
  ensureDir(briefDir)
  writeJsonl(join(outDir, 'self_study_portfolio_briefs.jsonl'), portfolioBriefs.map((brief) => {
    const { markdown, ...row } = brief
    return row
  }))
  for (const brief of portfolioBriefs) {
    writeFileSync(join(outDir, brief.output_path), brief.markdown)
  }
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
  const facultyPortfolioExamples = loadJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'))
  const selfStudyModules = writeSelfStudyArtifacts({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks, facultyPortfolioExamples })
  console.log(`RISD self-study curriculum written to ${join(outDir, 'self_study_curriculum.md')}`)
  console.log(`courses=${courses.length} syllabi=${syllabi.length} assignments=${assignments.length} readings=${readings.length} student_work=${studentWork.length} self_study_modules=${selfStudyModules.length}`)
}

function renderDerivedArtifactsOnly() {
  ensureDir(outDir)
  const sources = loadJsonl(join(outDir, 'sources.jsonl'))
  const courseInventoryRows = loadJsonl(join(outDir, 'course_inventory.jsonl'))
  const courses = loadJsonl(join(outDir, 'courses.jsonl'))
  const syllabi = loadJsonl(join(outDir, 'syllabi.jsonl'))
  const assignments = buildAssignments(syllabi)
  let readings = mergeReadingExternalLinks(buildReadings(syllabi), loadJsonl(join(outDir, 'readings.jsonl')))
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
  const courseSitePages = buildCourseSitePages({ sources, syllabi, assignments, readings })
  const scheduleRows = buildScheduleRows({ syllabi, assignments, readings, courseSitePages })
  readings = enrichReadingSupportLinks(readings, { assignments, scheduleRows })
  const readingFrequency = buildReadingFrequency(readings)
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters, assignments, readings, scheduleRows })
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings, fieldConflicts })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings, fieldConflicts })
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
  const selfStudyModules = buildSelfStudyModules({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks })
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, scheduleRows, searchCandidates, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, studentWorkAssignmentLinks, selfStudyModules, facultyPortfolioExamples, courseSitePages, assignmentBriefPages, archiveFetchTargets, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries, facultySearchQueries })
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
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork, selfStudyModules }))
  writeSelfStudyModuleArtifacts(selfStudyModules, facultyPortfolioExamples)
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
  const scheduleRows = loadJsonl(join(outDir, 'schedule_rows.jsonl'))
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
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters, assignments, readings, scheduleRows })
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings, fieldConflicts })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings, fieldConflicts })
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork, scheduleRows })
  const coverageSearchQueries = buildCoverageSearchQueries(courseCoverage)
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, scheduleRows, searchCandidates, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, facultyPortfolioExamples, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries })
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
  const selfStudyModules = writeSelfStudyArtifacts({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks, facultyPortfolioExamples })
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork, selfStudyModules }))
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
  let readings = mergeReadingExternalLinks(buildReadings(syllabi), existingReadings)
  const { faculty, facultyCourseEdges } = buildFacultyGraph({ sources, courseInventory, syllabi })
  const studentWork = buildStudentWork(inspected)
  const facultyPortfolioExamples = loadJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'))
  const sourceClusters = buildSourceClusters(inspected, syllabi, readings)
  const wayback = loadJsonl(join(outDir, 'wayback_captures.jsonl'))
  const sourceVersions = buildSourceVersions(inspected, wayback)
  const courseSitePages = buildCourseSitePages({ sources, syllabi, assignments, readings })
  const scheduleRows = buildScheduleRows({ syllabi, assignments, readings, courseSitePages })
  readings = enrichReadingSupportLinks(readings, { assignments, scheduleRows })
  const readingFrequency = buildReadingFrequency(readings)
  const assignmentBriefPages = buildAssignmentBriefPages({ courseSitePages, assignments })
  const studentWorkAssignmentLinks = buildStudentWorkAssignmentLinks({ studentWork, assignmentBriefPages, assignments, courseSitePages })
  const archiveFetchTargets = buildArchiveFetchTargets({ sources, wayback, sourceVersions })
  const searchCandidates = loadJsonl(join(outDir, 'search_candidates.jsonl'))
  const searchPromotions = loadJsonl(join(outDir, 'search_promotions.jsonl'))
  const commonCrawlCandidates = loadJsonl(join(outDir, 'common_crawl_candidates.jsonl'))
  const commonCrawlPromotions = loadJsonl(join(outDir, 'common_crawl_promotions.jsonl'))
  const archivePromotions = loadJsonl(join(outDir, 'archive_promotions.jsonl'))
  const facultyProfileCandidates = loadJsonl(join(outDir, 'faculty_profile_candidates.jsonl'))
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters, assignments, readings, scheduleRows })
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings, fieldConflicts })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings, fieldConflicts })
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork, scheduleRows })
  const coverageSearchQueries = buildCoverageSearchQueries(courseCoverage)
  const facultySearchQueries = buildFacultySearchQueries(faculty, facultyCourseEdges)
  const selfStudyModules = buildSelfStudyModules({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks })
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, scheduleRows, searchCandidates, searchPromotions, commonCrawlCandidates, commonCrawlPromotions, archivePromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, studentWorkAssignmentLinks, selfStudyModules, facultyPortfolioExamples, courseSitePages, assignmentBriefPages, archiveFetchTargets, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries, facultySearchQueries })
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
  writeJsonl(join(outDir, 'course_site_pages.jsonl'), courseSitePages)
  writeJsonl(join(outDir, 'schedule_rows.jsonl'), scheduleRows)
  writeJsonl(join(outDir, 'assignment_brief_pages.jsonl'), assignmentBriefPages)
  writeJsonl(join(outDir, 'student_work_assignment_links.jsonl'), studentWorkAssignmentLinks)
  writeJsonl(join(outDir, 'archive_fetch_targets.jsonl'), archiveFetchTargets)
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
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork, selfStudyModules }))
  writeSelfStudyModuleArtifacts(selfStudyModules, facultyPortfolioExamples)
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks }))
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
  const scheduleRows = loadJsonl(join(outDir, 'schedule_rows.jsonl'))
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
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters, assignments, readings, scheduleRows })
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork, scheduleRows })
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
  let readings = mergeReadingExternalLinks(buildReadings(syllabi), existingReadings)
  const { faculty, facultyCourseEdges } = buildFacultyGraph({ sources, courseInventory, syllabi })
  const studentWork = buildStudentWork(inspected)
  const facultyPortfolioExamples = loadJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'))
  const sourceClusters = buildSourceClusters(inspected, syllabi, readings)
  const wayback = loadJsonl(join(outDir, 'wayback_captures.jsonl'))
  const sourceVersions = buildSourceVersions(inspected, wayback)
  const courseSitePages = buildCourseSitePages({ sources, syllabi, assignments, readings })
  const scheduleRows = buildScheduleRows({ syllabi, assignments, readings, courseSitePages })
  readings = enrichReadingSupportLinks(readings, { assignments, scheduleRows })
  const readingFrequency = buildReadingFrequency(readings)
  const assignmentBriefPages = buildAssignmentBriefPages({ courseSitePages, assignments })
  const studentWorkAssignmentLinks = buildStudentWorkAssignmentLinks({ studentWork, assignmentBriefPages, assignments, courseSitePages })
  const commonCrawlCandidates = loadJsonl(join(outDir, 'common_crawl_candidates.jsonl'))
  const commonCrawlPromotions = loadJsonl(join(outDir, 'common_crawl_promotions.jsonl'))
  const facultyProfileCandidates = loadJsonl(join(outDir, 'faculty_profile_candidates.jsonl'))
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters, assignments, readings, scheduleRows })
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings, fieldConflicts })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings, fieldConflicts })
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork, scheduleRows })
  const coverageSearchQueries = buildCoverageSearchQueries(courseCoverage)
  const selfStudyModules = buildSelfStudyModules({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks })
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, scheduleRows, searchCandidates: updatedSearchCandidates, searchPromotions: allSearchPromotions, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, studentWorkAssignmentLinks, selfStudyModules, facultyPortfolioExamples, courseSitePages, assignmentBriefPages, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries })

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
  writeJsonl(join(outDir, 'course_site_pages.jsonl'), courseSitePages)
  writeJsonl(join(outDir, 'schedule_rows.jsonl'), scheduleRows)
  writeJsonl(join(outDir, 'assignment_brief_pages.jsonl'), assignmentBriefPages)
  writeJsonl(join(outDir, 'student_work_assignment_links.jsonl'), studentWorkAssignmentLinks)
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
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork, selfStudyModules }))
  writeSelfStudyModuleArtifacts(selfStudyModules, facultyPortfolioExamples)
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks }))
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
  const scheduleRows = loadJsonl(join(outDir, 'schedule_rows.jsonl'))
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
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters, assignments, readings, scheduleRows })
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings, fieldConflicts })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings, fieldConflicts })
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork, scheduleRows })
  const coverageSearchQueries = buildCoverageSearchQueries(courseCoverage)
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, scheduleRows, searchCandidates, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, facultyPortfolioExamples, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries })

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
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters, assignments, readings, scheduleRows })
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings, fieldConflicts })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings, fieldConflicts })
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
  const selfStudyModules = writeSelfStudyArtifacts({ courses, syllabi, assignments, readings, studentWork, facultyPortfolioExamples })
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork, selfStudyModules }))
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
  let readings = mergeReadingExternalLinks(buildReadings(syllabi), loadJsonl(join(outDir, 'readings.jsonl')))
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
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters, assignments, readings, scheduleRows })
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings, fieldConflicts })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings, fieldConflicts })
  const courseCoverage = buildCourseCoverage({ courses, syllabi, assignments, readings, studentWork, scheduleRows })
  const coverageSearchQueries = buildCoverageSearchQueries(courseCoverage)
  const facultySearchQueries = buildFacultySearchQueries(faculty, facultyCourseEdges)
  const selfStudyModules = buildSelfStudyModules({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks })
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, scheduleRows, searchCandidates, searchPromotions, commonCrawlCandidates, commonCrawlPromotions, archivePromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, studentWorkAssignmentLinks, selfStudyModules, facultyPortfolioExamples, courseSitePages, assignmentBriefPages, archiveFetchTargets: refreshedArchiveFetchTargets, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries, facultySearchQueries })

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
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork, selfStudyModules }))
  writeSelfStudyModuleArtifacts(selfStudyModules, facultyPortfolioExamples)
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
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters, assignments, readings, scheduleRows })
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings, fieldConflicts })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings, fieldConflicts })
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
  const selfStudyModules = writeSelfStudyArtifacts({ courses, syllabi, assignments, readings, studentWork, facultyPortfolioExamples })
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork, selfStudyModules }))
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
  let readings = mergeReadingExternalLinks(buildReadings(syllabi), loadJsonl(join(outDir, 'readings.jsonl')))
  const { faculty, facultyCourseEdges } = buildFacultyGraph({ sources, courseInventory, syllabi })
  const studentWork = buildStudentWork(inspected)
  const facultyPortfolioExamples = loadJsonl(join(outDir, 'faculty_portfolio_examples.jsonl'))
  const sourceClusters = buildSourceClusters(inspected, syllabi, readings)
  const sourceVersions = buildSourceVersions(inspected, wayback)
  const archiveFetchTargets = buildArchiveFetchTargets({ sources, wayback, sourceVersions })
  const courseSitePages = buildCourseSitePages({ sources, syllabi, assignments, readings })
  const scheduleRows = buildScheduleRows({ syllabi, assignments, readings, courseSitePages })
  readings = enrichReadingSupportLinks(readings, { assignments, scheduleRows })
  const readingFrequency = buildReadingFrequency(readings)
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
  const fieldConflicts = buildFieldConflicts({ courses, syllabi, sourceClusters, assignments, readings, scheduleRows })
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings, fieldConflicts })
  const reviewDecisions = buildReviewDecisions(reviewQueue, { sources, syllabi, readings, fieldConflicts })
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
  const selfStudyModules = buildSelfStudyModules({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks })
  const validationWithSelfStudy = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, scheduleRows, searchCandidates, commonCrawlCandidates, commonCrawlPromotions, facultyProfileCandidates, faculty, facultyCourseEdges, studentWork, studentWorkAssignmentLinks, selfStudyModules, facultyPortfolioExamples, courseSitePages, assignmentBriefPages, archiveFetchTargets, sourceClusters, sourceVersions, wayback, reviewQueue, reviewDecisions, fieldConflicts, courseCoverage, coverageSearchQueries, facultySearchQueries })
  writeJson(join(outDir, 'validation.json'), validationWithSelfStudy)
  writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validationWithSelfStudy))
  writeFileSync(join(outDir, 'course_reconstruction.md'), reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks, wayback, sourceClusters }))
  writeFileSync(join(outDir, 'source_audit.md'), auditMarkdown({ sources, searchQueries, wayback, validation: validationWithSelfStudy }))
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork, selfStudyModules }))
  writeSelfStudyModuleArtifacts(selfStudyModules, facultyPortfolioExamples)
  writeFileSync(join(outDir, 'self_study_curriculum.md'), selfStudyCurriculumMarkdown({ courses, syllabi, assignments, readings, scheduleRows, studentWork, studentWorkAssignmentLinks }))

  console.log(`RISD corpus artifacts written to ${outDir}`)
  console.log(`sources=${sources.length} course_inventory=${courseInventory.offerings.length}/${courseInventory.displayed_count || '?'} courses=${courses.length} syllabi=${syllabi.length} assignments=${assignments.length} readings=${readings.length} canonical_reading_works=${readingFrequency.length} search_candidates=${searchCandidates.length} faculty=${faculty.length} faculty_course_edges=${facultyCourseEdges.length} student_work=${studentWork.length} source_clusters=${sourceClusters.length} source_versions=${sourceVersions.length} wayback=${wayback.length} review_queue=${reviewQueue.length} review_decisions=${reviewDecisions.length} field_conflicts=${fieldConflicts.length} self_study_modules=${selfStudyModules.length} validation=${validationWithSelfStudy.status}`)
}

if (!existsSync(join(root, 'docs/research-plans/risd-graphic-design-syllabus-corpus-plan.md'))) {
  throw new Error('Run from repository root; plan file not found.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
