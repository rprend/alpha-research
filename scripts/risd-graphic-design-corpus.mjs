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
  course_site: 2,
  official_syllabus_guidance: 3,
  official_course_index: 4,
  official_program_page: 5,
  official_catalog_program: 6,
  official_student_work_story: 7,
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
  return uniq(text.match(/\b(?:GRAPH|GD|DS|GRAPH-W|GRAPH)\s*-?\s?[A-Z]?\d{2,4}[A-Z]?(?:-\d{2})?\b/gi) ?? [])
    .map((code) => code.replace(/\s+/g, '').replace(/GRAPHW/i, 'GRAPH-W').toUpperCase())
}

function extractOfficialCourseOfferings(text, sourceId) {
  const offerings = []
  const normalized = text.replace(/\r/g, '\n')
  const blocks = normalized.split(/(?=\n\s*(?:#{1,4}\s*)?GRAPH\s+\d{4}[A-Z]?(?:-\d{2})?\s*(?:\n|$))/i)
  for (const block of blocks) {
    const header = block.match(/(?:^|\n)\s*(?:#{1,4}\s*)?(GRAPH\s+\d{4}[A-Z]?(?:-\d{2})?)\s*(?:\n+)\s*([^\n]+?)\s*(?:\n+)/i)
    if (!header) continue
    const rawCode = header[1]
    const rawTitle = header[2]
    if (rawTitle.includes('-') || /^(Level|Subject|Period|Credits|Format)$/i.test(rawTitle.trim())) continue
    const level = block.match(/\bLevel\s+(Undergraduate|Graduate)\b/i)?.[1] ?? null
    const period = block.match(/\bPeriod\s+([^\n]+)/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
    const credits = block.match(/\bCredits\s+(\d+(?:\.\d+)?)\b/i)?.[1] ?? null
    const format = block.match(/\bFormat\s+([^\n]+)/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
    const instructor = block.match(/\bInstructor\(s\):\s*([^\n]+?)(?:\s+Location\(s\):|\s+Enrolled\s*\/|\n|$)/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
    const location = block.match(/\bLocation\(s\):\s*([^\n]+?)(?:\s+Enrolled\s*\/|\s+Status:|\n|$)/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
    const status = block.match(/\bStatus:\s*([A-Za-z]+)/i)?.[1] ?? null
    const startEnd = block.match(/\bStart and End\s+([^\n]+)/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
    const descriptionMatch = block.match(/(?:#{1,4}\s*)?SECTION DESCRIPTION\s+([\s\S]*?)(?=\n\s*(?:Elective|Major Requirement|Graduate Requirement|Required|## COURSE TAGS|Estimated Cost|#{1,4}\s*GRAPH\s+\d{4}|GRAPH\s+\d{4}|$))/i)
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
    unique.set(`${offering.course_code}_${offering.period}`, offering)
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
    const text = isPdf ? pdfText(fetched.buffer, seed.source_id) : stripHtml(fetched.buffer.toString('utf8'))
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
    }
  } catch (error) {
    return {
      source: {
        ...base,
        extraction_status: 'fetch_error',
        error: error.message,
      },
      text: '',
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

async function waybackCaptures(url) {
  const api = `https://web.archive.org/cdx?url=${encodeURIComponent(url)}&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&collapse=digest&limit=5`
  try {
    const response = await fetchWithTimeout(api, 20000)
    if (!response.ok) return []
    const rows = JSON.parse(response.buffer.toString('utf8'))
    if (!Array.isArray(rows) || rows.length < 2) return []
    return rows.slice(1).map(([timestamp, original, statuscode, mimetype, digest]) => ({
      timestamp,
      original,
      statuscode,
      mimetype,
      digest,
      memento_url: `https://web.archive.org/web/${timestamp}/${original}`,
    }))
  } catch {
    return []
  }
}

function buildCourses(inspected) {
  const byKey = new Map()
  for (const item of inspected) {
    const { source, text } = item
    if (source.extraction_status !== 'ok' || !text) continue
    if (source.source_type === 'official_course_index') {
      for (const offering of extractOfficialCourseOfferings(text, source.source_id)) {
        byKey.set(`${offering.course_code}_${offering.period}`, offering)
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

function buildSyllabi(inspected) {
  return inspected
    .filter(({ source, text }) => source.extraction_status === 'ok' && text && ['syllabus_pdf', 'syllabus_html', 'course_site', 'assignment_page'].includes(source.source_type))
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
      rows.push({
        assignment_id: `assign_${syllabus.syllabus_id}_${String(index + 1).padStart(2, '0')}`,
        course_code: syllabus.course_code,
        course_title: syllabus.course_title,
        syllabus_id: syllabus.syllabus_id,
        title: snippet.match(/\b(?:Project|Assignment|Exercise|Final)\s*[:#]?\s*([^.;]{0,80})/i)?.[0] ?? null,
        prompt_excerpt: snippet,
        constraints: [],
        deliverables: [],
        critique_format: /crit/i.test(snippet) ? 'critique referenced in source excerpt' : null,
        skills_trained: inferSkills(snippet),
        source_ids: syllabus.source_ids,
      })
    })
  }
  return rows
}

function buildReadings(syllabi) {
  const rows = []
  for (const syllabus of syllabi) {
    syllabus.readings.forEach((reading, index) => {
      rows.push({
        reading_id: `reading_${syllabus.syllabus_id}_${String(index + 1).padStart(2, '0')}`,
        course_code: syllabus.course_code,
        course_title: syllabus.course_title,
        syllabus_id: syllabus.syllabus_id,
        citation_excerpt: reading,
        required_or_recommended: /recommended/i.test(reading) ? 'recommended' : 'unknown',
        source_ids: syllabus.source_ids,
      })
    })
  }
  return rows
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

function validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, wayback }) {
  const sourceIds = new Set(sources.map((source) => source.source_id))
  const syllabusIds = new Set(syllabi.map((syllabus) => syllabus.syllabus_id))
  const failedSourceIds = new Set(sources.filter((source) => source.extraction_status !== 'ok').map((source) => source.source_id))
  const leakedFailedSyllabi = syllabi.filter((syllabus) => syllabus.source_ids.some((id) => failedSourceIds.has(id)))
  const missingSyllabusIdentity = syllabi.filter((syllabus) => !syllabus.course_code && !syllabus.course_title)
  const assignmentSourceErrors = assignments.filter((assignment) => !syllabusIds.has(assignment.syllabus_id) || assignment.source_ids.some((id) => !sourceIds.has(id)))
  const readingSourceErrors = readings.filter((reading) => !syllabusIds.has(reading.syllabus_id) || reading.source_ids.some((id) => !sourceIds.has(id)))
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
      id: 'readings_reference_valid_syllabi_and_sources',
      status: readingSourceErrors.length === 0 ? 'pass' : 'fail',
      detail: `${readingSourceErrors.length} reading reference errors.`,
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
      readings: readings.length,
      wayback: wayback.length,
    },
    checks,
  }
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
- Readings: ${validation.counts.readings}
- Wayback captures: ${validation.counts.wayback}

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
      courseReadings.slice(0, 8).forEach((reading) => lines.push(`  - ${reading.citation_excerpt}`))
    }
    if (courseAssignments.length) {
      lines.push('- Assignment/critique evidence:')
      courseAssignments.slice(0, 10).forEach((assignment) => lines.push(`  - ${assignment.prompt_excerpt}`))
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
  for (const seed of [...seeds, ...searchDiscoveredSources]) {
    if (seed.source_id === 'src_risd_graphic_design_courses') continue
    inspected.push(await inspectSeed(seed))
  }
  for (let page = 0; page < officialCourseMaxPages; page++) {
    const inspectedPage = await inspectOfficialCoursePage(page)
    if (inspectedPage.source.extraction_status !== 'ok') {
      inspected.push(inspectedPage)
      continue
    }
    const offerings = extractOfficialCourseOfferings(inspectedPage.text, inspectedPage.source.source_id)
    if (page > 0 && offerings.length === 0) break
    inspected.push(inspectedPage)
  }

  const wayback = []
  if (!skipWayback) {
    for (const seed of seeds) {
      const captures = await waybackCaptures(seed.url)
      captures.forEach((capture) => wayback.push({ source_id: seed.source_id, ...capture }))
    }
  }

  const sources = inspected.map(({ source }) => source)
  const courseInventory = buildCourseInventory(inspected)
  const courses = buildCourses(inspected)
  const syllabi = buildSyllabi(inspected)
  const assignments = buildAssignments(syllabi)
  const readings = buildReadings(syllabi)
  const studentWork = buildStudentWork(inspected)

  writeJsonl(join(outDir, 'sources.jsonl'), sources)
  writeJsonl(join(outDir, 'course_inventory.jsonl'), courseInventory.offerings)
  writeJsonl(join(outDir, 'courses.jsonl'), courses)
  writeJsonl(join(outDir, 'syllabi.jsonl'), syllabi)
  writeJsonl(join(outDir, 'assignments.jsonl'), assignments)
  writeJsonl(join(outDir, 'readings.jsonl'), readings)
  writeJsonl(join(outDir, 'student_work.jsonl'), studentWork)
  writeJsonl(join(outDir, 'wayback_captures.jsonl'), wayback)
  writeJsonl(join(outDir, 'search_results.jsonl'), buildSearchResults())
  writeJson(join(outDir, 'search_queries.json'), { generated_at: retrievedAt, queries: searchQueries })
  const validation = validateCorpus({ sources, courses, courseInventory, syllabi, assignments, readings, wayback })
  writeJson(join(outDir, 'validation.json'), validation)
  writeFileSync(join(outDir, 'validation.md'), validationMarkdown(validation))
  writeFileSync(join(outDir, 'course_reconstruction.md'), reconstructionMarkdown({ sources, courses, syllabi, assignments, readings, studentWork, wayback }))
  writeFileSync(join(outDir, 'source_audit.md'), auditMarkdown({ sources, searchQueries, wayback, validation }))
  writeFileSync(join(outDir, 'tacit_knowledge_memo.md'), tacitMemoMarkdown({ syllabi, assignments, studentWork }))

  console.log(`RISD corpus artifacts written to ${outDir}`)
  console.log(`sources=${sources.length} course_inventory=${courseInventory.offerings.length}/${courseInventory.displayed_count || '?'} courses=${courses.length} syllabi=${syllabi.length} assignments=${assignments.length} readings=${readings.length} student_work=${studentWork.length} wayback=${wayback.length} validation=${validation.status}`)
}

if (!existsSync(join(root, 'docs/research-plans/risd-graphic-design-syllabus-corpus-plan.md'))) {
  throw new Error('Run from repository root; plan file not found.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
