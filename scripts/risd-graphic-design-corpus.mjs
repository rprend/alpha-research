import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const outDir = join(root, 'docs/research-plans/risd-graphic-design-corpus')
const retrievedAt = new Date().toISOString().slice(0, 10)
const skipWayback = process.argv.includes('--skip-wayback')
const officialCourseMaxPages = 12
const crawlMaxDepth = 1
const crawlMaxLinksPerHost = 20
const waybackMaxSources = 45

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
    url: source.url,
    promoted_source_id: source.source_id,
    discovered_at: retrievedAt,
    status: 'promoted_to_seed',
  }))
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
    const capture = captures[0]
    console.error(`inspect wayback fallback ${index + 1}/${failedSources.length}: ${source.source_id}`)
    const inspected = await inspectSeed({
      source_id: `src_wayback_${source.source_id.replace(/^src_/, '')}_${capture.timestamp}`,
      url: capture.memento_url,
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
    if (inspected.source.extraction_status === 'ok') recovered.push(inspected)
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
    .map(({ source, text }) => ({
      syllabus_id: `syl_${source.source_id.replace(/^src_/, '')}`,
      course_code: source.course_code ?? extractCourseCodes(text)[0] ?? null,
      course_title: source.course_title ?? null,
      term: source.term ?? null,
      instructor: source.instructor ?? null,
      source_ids: [source.source_id],
      spans: extractSpanFields(text, source),
      meeting_pattern: sentenceSnippets(text, ['Mon', 'Tues', 'Wed', 'Thurs', 'Friday', 'Office Hours'], 5),
      platforms: uniq(['Canvas', 'Slack', 'Zoom', 'Adobe', 'After Effects', 'Illustrator', 'Photoshop'].filter((term) => text.toLowerCase().includes(term.toLowerCase()))),
      readings: extractLikelyReadings(text),
      assignments: extractAssignments(text),
      weekly_schedule_evidence: sentenceSnippets(text, ['week', 'class', 'session', 'schedule'], 20),
      grading_evidence: sentenceSnippets(text, ['grade', 'grading', 'attendance', 'participation', 'evaluation'], 12),
    }))
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
    critique_format: critiqueFormat,
    revision_expectation: revisionExpectation,
    tacit_goal: tacitGoal,
    evidence_grade: deliverables.length || constraints.length || critiqueFormat || revisionExpectation ? 'A' : 'B',
  }
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

function buildStudentWork(inspected) {
  return inspected
    .filter(({ source, text }) => source.extraction_status === 'ok' && text && ['official_student_work_story', 'student_work_archive'].includes(source.source_type))
    .map(({ source, text }) => ({
      student_work_id: `work_${source.source_id.replace(/^src_/, '')}`,
      course_title: source.course_title ?? null,
      source_ids: [source.source_id],
      medium_evidence: sentenceSnippets(text, ['animation', 'video', 'poster', 'book', 'website', 'identity', 'project'], 10),
      confidence: source.source_type === 'official_student_work_story' ? 'D' : 'E',
    }))
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

function validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency = [], wayback, reviewQueue = [] }) {
  const sourceIds = new Set(sources.map((source) => source.source_id))
  const syllabusIds = new Set(syllabi.map((syllabus) => syllabus.syllabus_id))
  const failedSourceIds = new Set(sources.filter((source) => source.extraction_status !== 'ok').map((source) => source.source_id))
  const leakedFailedSyllabi = syllabi.filter((syllabus) => syllabus.source_ids.some((id) => failedSourceIds.has(id)))
  const missingSyllabusIdentity = syllabi.filter((syllabus) => !syllabus.course_code && !syllabus.course_title)
  const assignmentSourceErrors = assignments.filter((assignment) => !syllabusIds.has(assignment.syllabus_id) || assignment.source_ids.some((id) => !sourceIds.has(id)))
  const structuredAssignmentCount = assignments.filter((assignment) =>
    assignment.deliverables?.length
      || assignment.constraints?.length
      || assignment.materials?.length
      || assignment.tools?.length
      || assignment.critique_format
      || assignment.revision_expectation
      || assignment.tacit_goal
  ).length
  const readingSourceErrors = readings.filter((reading) => !syllabusIds.has(reading.syllabus_id) || reading.source_ids.some((id) => !sourceIds.has(id)))
  const normalizedReadingCount = readings.filter((reading) => reading.canonical_work_id).length
  const catalogReadingCount = readings.filter((reading) => reading.linking_status === 'local_catalog_match').length
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
      assignments: assignments.length,
      structured_assignments: structuredAssignmentCount,
      readings: readings.length,
      normalized_readings: normalizedReadingCount,
      local_catalog_readings: catalogReadingCount,
      canonical_reading_works: readingFrequency.length,
      wayback: wayback.length,
      review_queue: reviewQueue.length,
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
    const hasSchedule = syllabus.spans?.assignment_schedule?.length || syllabus.weekly_schedule_evidence?.length
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
- Assignments: ${validation.counts.assignments}
- Structured assignment snippets: ${validation.counts.structured_assignments}
- Readings: ${validation.counts.readings}
- Normalized reading snippets: ${validation.counts.normalized_readings}
- Canonical reading works: ${validation.counts.canonical_reading_works}
- Local catalog reading matches: ${validation.counts.local_catalog_readings}
- Wayback captures: ${validation.counts.wayback}
- Review queue rows: ${validation.counts.review_queue}

## Checks

${validation.checks.map((check) => `- ${check.status.toUpperCase()} ${check.id}: ${check.detail}`).join('\n')}
`
}

function reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, studentWork, wayback }) {
  const lines = []
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
  lines.push(`- Wayback capture records: ${wayback.length}`)
  lines.push('')
  lines.push('## Reconstructed Course Packets')
  lines.push('')

  for (const course of courses) {
    const courseSyllabi = syllabi.filter((s) => (s.course_code && course.course_code && s.course_code === course.course_code) || (s.course_title && course.course_title && s.course_title === course.course_title) || s.source_ids.some((id) => course.source_ids.includes(id)))
    const courseAssignments = assignments.filter((a) => courseSyllabi.some((s) => s.syllabus_id === a.syllabus_id))
    const courseReadings = readings.filter((r) => courseSyllabi.some((s) => s.syllabus_id === r.syllabus_id))
    lines.push(`### ${(course.course_title ?? course.course_code ?? course.course_id).trim()}`)
    lines.push('')
    lines.push(`- Evidence grade: ${course.evidence_grade}`)
    lines.push(`- Course code: ${course.course_code ?? 'unknown'}`)
    lines.push(`- Degree level: ${course.degree_level}`)
    lines.push(`- Source IDs: ${course.source_ids.join(', ')}`)
    if (course.skills.length) lines.push(`- Extracted skill signals: ${course.skills.join(', ')}`)
    if (courseSyllabi.length) {
      for (const syllabus of courseSyllabi) {
        lines.push(`- Syllabus/course artifact: ${syllabus.syllabus_id}`)
        if (syllabus.instructor) lines.push(`- Instructor: ${syllabus.instructor}`)
        if (syllabus.term) lines.push(`- Term: ${syllabus.term}`)
        if (syllabus.platforms.length) lines.push(`- Platforms/tools mentioned: ${syllabus.platforms.join(', ')}`)
        if (syllabus.spans?.description) lines.push(`- Description evidence: ${syllabus.spans.description.slice(0, 500)}`)
        if (syllabus.spans?.learning_outcomes?.length) {
          lines.push('- Learning outcomes:')
          syllabus.spans.learning_outcomes.slice(0, 5).forEach((outcome) => lines.push(`  - ${outcome}`))
        }
        if (syllabus.spans?.grading_rubric) lines.push(`- Grading/assessment evidence: ${syllabus.spans.grading_rubric.slice(0, 500)}`)
        if (syllabus.spans?.assignment_schedule?.length) {
          lines.push('- Schedule rows:')
          syllabus.spans.assignment_schedule.slice(0, 6).forEach((row) => lines.push(`  - ${row.date}: ${row.assignment_or_reading ?? row.topic}`))
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
          assignment.critique_format ? `critique: ${assignment.critique_format}` : null,
          assignment.revision_expectation ? `revision: ${assignment.revision_expectation}` : null,
          assignment.tacit_goal ? `tacit goal: ${assignment.tacit_goal}` : null,
        ].filter(Boolean)
        lines.push(`  - ${assignment.prompt_excerpt}${structured.length ? ` (${structured.join('; ')})` : ''}`)
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

async function main() {
  ensureDir(outDir)
  const inspected = []
  const initialSeeds = [...seeds, ...searchDiscoveredSources]
  for (const [index, seed] of initialSeeds.entries()) {
    if (seed.source_id === 'src_risd_graphic_design_courses') continue
    console.error(`inspect seed ${index + 1}/${initialSeeds.length}: ${seed.source_id}`)
    inspected.push(await inspectSeed(seed))
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
  const studentWork = buildStudentWork(inspected)

  writeJsonl(join(outDir, 'sources.jsonl'), sources)
  writeJsonl(join(outDir, 'course_inventory.jsonl'), courseInventory.offerings)
  writeJsonl(join(outDir, 'courses.jsonl'), courses)
  writeJsonl(join(outDir, 'syllabi.jsonl'), syllabi)
  writeJsonl(join(outDir, 'assignments.jsonl'), assignments)
  writeJsonl(join(outDir, 'readings.jsonl'), readings)
  writeJsonl(join(outDir, 'reading_frequency.jsonl'), readingFrequency)
  writeJsonl(join(outDir, 'student_work.jsonl'), studentWork)
  writeJsonl(join(outDir, 'wayback_captures.jsonl'), wayback)
  writeJsonl(join(outDir, 'crawl_sources.jsonl'), crawlSeeds)
  writeJsonl(join(outDir, 'search_results.jsonl'), buildSearchResults())
  writeJson(join(outDir, 'search_queries.json'), { generated_at: retrievedAt, queries: searchQueries })
  const reviewQueue = buildReviewQueue({ sources, courseInventory, syllabi, readings })
  const validationWithReview = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, readingFrequency, wayback, reviewQueue })
  writeJsonl(join(outDir, 'review_queue.jsonl'), reviewQueue)
  writeFileSync(join(outDir, 'review_queue.md'), reviewQueueMarkdown(reviewQueue))
  writeJson(join(outDir, 'validation.json'), validationWithReview)
  writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validationWithReview))
  writeFileSync(join(outDir, 'course_reconstruction.md'), reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, studentWork, wayback }))
  writeFileSync(join(outDir, 'source_audit.md'), auditMarkdown({ sources, searchQueries, wayback, validation: validationWithReview }))
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork }))

  console.log(`RISD corpus artifacts written to ${outDir}`)
  console.log(`sources=${sources.length} course_inventory=${courseInventory.offerings.length}/${courseInventory.displayed_count || '?'} courses=${courses.length} syllabi=${syllabi.length} assignments=${assignments.length} readings=${readings.length} canonical_reading_works=${readingFrequency.length} student_work=${studentWork.length} wayback=${wayback.length} review_queue=${reviewQueue.length} validation=${validationWithReview.status}`)
}

if (!existsSync(join(root, 'docs/research-plans/risd-graphic-design-syllabus-corpus-plan.md'))) {
  throw new Error('Run from repository root; plan file not found.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
