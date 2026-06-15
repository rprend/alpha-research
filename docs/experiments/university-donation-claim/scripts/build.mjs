import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outDir = join(root, 'artifacts')
mkdirSync(outDir, { recursive: true })

const claim = 'Despite being far wealthier in absolute terms than Vanderbilt or Carnegie or Stanford, and being directly positioned in an industry that could benefit from it, no tech elite has ever founded a university, and few have even given endowments.'

const cpi = {
  1997: 160.5,
  1999: 166.6,
  2000: 172.2,
  2001: 177.1,
  2004: 188.9,
  2009: 214.5,
  2010: 218.1,
  2011: 224.9,
  2012: 229.6,
  2014: 236.7,
  2016: 240.0,
  2018: 251.1,
  2019: 255.7,
  2022: 292.7,
  2025: 322.0,
}

const sources = [
  {
    id: 'caltech-moore-2001',
    title: 'Caltech receives two gifts totaling $600 million from Gordon and Betty Moore and their foundation',
    url: 'https://www.caltech.edu/about/news/caltech-receives-600-million-two-giftslargest-academic-donation-history-526',
    sourceType: 'university_press_release',
    observability: 'high',
  },
  {
    id: 'stanford-doerr-2022',
    title: 'Stanford announces $1.1 billion John and Ann Doerr gift for School of Sustainability',
    url: 'https://news.stanford.edu/stories/2022/05/stanford-doerr-school-sustainability-universitys-first-new-school-70-years-will-accelerate-solutions-global-climate-crisis',
    sourceType: 'university_press_release',
    observability: 'high',
  },
  {
    id: 'cambridge-gates-2000',
    title: 'University of Cambridge describes $210 million Gates Cambridge donation',
    url: 'https://www.cambridgestudents.cam.ac.uk/fees-and-funding/funding/cambridge-trusts-undergraduate-and-graduate/gates-cambridge-trust',
    sourceType: 'university_page',
    observability: 'high',
  },
  {
    id: 'illinois-siebel-cs-1999',
    title: 'University of Illinois says Thomas Siebel donated $32 million for Siebel Center for Computer Science',
    url: 'https://news.illinois.edu/thomas-m-siebel-endows-world-class-computer-science-facility-at-illinois/',
    sourceType: 'university_press_release',
    observability: 'high',
  },
  {
    id: 'illinois-siebel-design-2016',
    title: 'University of Illinois announces $25 million Siebel Center for Design lead gift',
    url: 'https://siebelschool.illinois.edu/news/alumnus-siebel-donates-25-million-innovative-design-center',
    sourceType: 'university_press_release',
    observability: 'high',
  },
  {
    id: 'ucsf-benioff-2010',
    title: 'UCSF announces $100 million Marc and Lynne Benioff children hospital gift',
    url: 'https://www.ucsf.edu/news/2010/06/100979/marc-benioff-announces-100-million-gift-build-new-childrens-hospital-mission',
    sourceType: 'university_press_release',
    observability: 'high',
  },
  {
    id: 'ucsf-benioff-2014',
    title: 'UCSF announces second $100 million Marc and Lynne Benioff gift',
    url: 'https://www.ucsf.edu/news/2014/04/113131/archive-ucsf-benioff-childrens-hospital-childrens-hospital-oakland-receive-100m',
    sourceType: 'university_press_release',
    observability: 'high',
  },
  {
    id: 'mit-mcgovern-2000',
    title: 'MIT announces $350 million Patrick and Lore Harp McGovern gift to establish brain research institute',
    url: 'https://news.mit.edu/2000/neurorelease',
    sourceType: 'university_press_release',
    observability: 'high',
  },
  {
    id: 'cmu-gates-2004',
    title: 'CMU records $20 million Gates Foundation gift for Gates Center for Computer Science',
    url: 'https://csd.cmu.edu/mission-history',
    sourceType: 'university_history',
    observability: 'high',
  },
  {
    id: 'berkeley-simons-2012',
    title: 'UC Berkeley announces $60 million Simons Foundation grant for theory of computing institute',
    url: 'https://vcresearch.berkeley.edu/news/simons-foundation-awards-uc-berkeley-60-million-theory-computing-institute',
    sourceType: 'university_press_release',
    observability: 'high',
  },
  {
    id: 'princeton-schmidt-2009',
    title: 'Princeton announces $25 million Eric and Wendy Schmidt Transformative Technology Fund',
    url: 'https://www.princeton.edu/news/2009/10/13/schmidt-fund-advance-science-through-support-transformative-technology',
    sourceType: 'university_press_release',
    observability: 'high',
  },
  {
    id: 'cornell-feeney-2011',
    title: 'Cornell identifies Chuck Feeney and Atlantic Philanthropies as $350 million Cornell Tech donor',
    url: 'https://news.cornell.edu/stories/2011/12/atlantic-philanthropies-revealed-tech-campus-donor',
    sourceType: 'university_press_release',
    observability: 'high',
  },
  {
    id: 'mit-schwarzman-2018',
    title: 'MIT announces $350 million Stephen Schwarzman gift for College of Computing',
    url: 'https://news.mit.edu/2018/mit-reshapes-itself-stephen-schwarzman-college-of-computing-1015',
    sourceType: 'university_press_release',
    observability: 'high',
  },
  {
    id: 'stanford-knight-2016',
    title: 'Stanford announces $400 million Phil Knight gift for Knight-Hennessy Scholars',
    url: 'https://news.stanford.edu/stories/2016/02/scholars-program-announce-022316',
    sourceType: 'university_press_release',
    observability: 'high',
  },
  {
    id: 'olin-founding-1997',
    title: 'Olin College describes F. W. Olin Foundation establishment of Olin College of Engineering',
    url: 'https://www.olin.edu/about/history/founding-precepts',
    sourceType: 'college_history',
    observability: 'high',
  },
  {
    id: 'bls-cpi',
    title: 'BLS CPI inflation calculator methodology uses CPI-U all items',
    url: 'https://www.bls.gov/data/inflation_calculator.htm',
    sourceType: 'government_data',
    observability: 'high',
  },
  {
    id: 'minneapolis-fed-cpi',
    title: 'Minneapolis Fed CPI table explains annual average CPI conversion formula',
    url: 'https://www.minneapolisfed.org/about-us/monetary-policy/inflation-calculator/consumer-price-index-1913-',
    sourceType: 'government_data',
    observability: 'high',
  },
]

const gifts = [
  gift('gordon-moore-caltech-2001', 2001, 'Gordon and Betty Moore / Gordon and Betty Moore Foundation', 'Intel cofounder', 'tech_founder', 600, 'Caltech', 'whole_institution', 'unrestricted_institute_wide', 'unrestricted gifts; broad institute support', 'not_founded_university', 'caltech-moore-2001'),
  gift('patrick-mcgovern-mit-2000', 2000, 'Patrick and Lore Harp McGovern', 'IDG founder', 'tech_media_founder', 350, 'MIT', 'brain_research_institute', 'restricted_research_institute', 'establish institute inside university', 'not_founded_university', 'mit-mcgovern-2000'),
  gift('bill-gates-cambridge-2000', 2000, 'Bill & Melinda Gates Foundation', 'Microsoft founder wealth', 'tech_founder', 210, 'University of Cambridge', 'scholarships', 'restricted_scholarship_endowment', 'establish Gates Cambridge Scholarships', 'not_founded_university', 'cambridge-gates-2000'),
  gift('bill-gates-cmu-2004', 2004, 'Bill & Melinda Gates Foundation', 'Microsoft founder wealth', 'tech_founder', 20, 'Carnegie Mellon University', 'computer_science', 'restricted_building', 'Gates Center for Computer Science', 'not_founded_university', 'cmu-gates-2004'),
  gift('thomas-siebel-uiuc-cs-1999', 1999, 'Thomas M. Siebel', 'Siebel Systems founder', 'tech_founder', 32, 'University of Illinois Urbana-Champaign', 'computer_science', 'restricted_building', 'Siebel Center for Computer Science', 'not_founded_university', 'illinois-siebel-cs-1999'),
  gift('thomas-siebel-uiuc-design-2016', 2016, 'Thomas and Stacey Siebel Foundation', 'Siebel Systems founder wealth', 'tech_founder', 25, 'University of Illinois Urbana-Champaign', 'design_engineering', 'restricted_building_program', 'Siebel Center for Design', 'not_founded_university', 'illinois-siebel-design-2016'),
  gift('marc-benioff-ucsf-2010', 2010, 'Marc and Lynne Benioff', 'Salesforce founder', 'tech_founder', 100, 'UC San Francisco', 'medicine_pediatrics', 'restricted_hospital', 'children hospital construction', 'not_founded_university', 'ucsf-benioff-2010'),
  gift('marc-benioff-ucsf-2014', 2014, 'Marc and Lynne Benioff', 'Salesforce founder', 'tech_founder', 100, 'UC San Francisco', 'medicine_pediatrics', 'restricted_hospital', 'children hospitals and research', 'not_founded_university', 'ucsf-benioff-2014'),
  gift('john-doerr-stanford-2022', 2022, 'John and Ann Doerr', 'Kleiner Perkins venture capitalist', 'tech_vc', 1100, 'Stanford University', 'sustainability_school', 'restricted_new_school', 'Stanford Doerr School of Sustainability', 'founded_school_inside_university', 'stanford-doerr-2022'),
  gift('eric-schmidt-princeton-2009', 2009, 'Eric and Wendy Schmidt', 'Google CEO / Alphabet executive chairman', 'tech_executive', 25, 'Princeton University', 'technology_research', 'endowed_research_fund', 'Schmidt Transformative Technology Fund', 'not_founded_university', 'princeton-schmidt-2009'),
  gift('simons-berkeley-2012', 2012, 'Simons Foundation', 'quant finance founder; math/computing philanthropy', 'tech_adjacent_quant_finance', 60, 'UC Berkeley', 'theory_of_computing', 'restricted_research_institute', 'Simons Institute for the Theory of Computing', 'not_founded_university', 'berkeley-simons-2012'),
  gift('feeney-cornell-tech-2011', 2011, 'Chuck Feeney / Atlantic Philanthropies', 'Duty Free Shoppers founder', 'non_tech_founder', 350, 'Cornell University', 'applied_technology_campus', 'campus_and_endowment', 'Cornell Tech campus', 'founded_campus_inside_university', 'cornell-feeney-2011'),
  gift('schwarzman-mit-2018', 2018, 'Stephen A. Schwarzman', 'Blackstone cofounder', 'finance_founder', 350, 'MIT', 'computing_college', 'restricted_new_college', 'MIT Schwarzman College of Computing', 'founded_college_inside_university', 'mit-schwarzman-2018'),
  gift('knight-stanford-2016', 2016, 'Philip H. Knight', 'Nike cofounder', 'consumer_founder', 400, 'Stanford University', 'scholarships', 'restricted_scholarship_endowment', 'Knight-Hennessy Scholars', 'not_founded_university', 'stanford-knight-2016'),
  gift('olin-college-1997', 1997, 'F. W. Olin Foundation', 'industrial foundation', 'industrial_founder_legacy', 460, 'Olin College of Engineering', 'new_degree_granting_college', 'founded_college_endowment', 'established independent engineering college', 'founded_degree_granting_college', 'olin-founding-1997'),
]

function gift(id, year, donor, donorDescription, donorSector, amountUsdMillions, institution, recipientUnit, restrictionType, purpose, foundingCategory, sourceId) {
  const inflationAdjustedUsdMillions = Math.round(amountUsdMillions * (cpi[2025] / cpi[year]) * 10) / 10
  return {
    id,
    year,
    donor,
    donorDescription,
    donorSector,
    amountUsdMillions,
    inflationAdjustedUsdMillions,
    institution,
    recipientUnit,
    restrictionType,
    purpose,
    foundingCategory,
    sourceId,
  }
}

const template = [
  {
    step: 'Literal claim',
    question: 'What would have to be true for the sentence to be literally accurate?',
    output: 'Atomic empirical claims plus definitional and normative residues.',
  },
  {
    step: 'Implied comparison',
    question: 'Compared to what baseline?',
    output: 'Explicit comparison classes and historical periods.',
  },
  {
    step: 'Hidden denominator',
    question: 'Few relative to what: people, wealth, total giving, historical precedent, or opportunity?',
    output: 'Denominators and rate definitions.',
  },
  {
    step: 'Operational definitions',
    question: 'What counts and what does not?',
    output: 'Inclusion/exclusion rules for donors, gifts, founding, endowments, and university support.',
  },
  {
    step: 'Observable proxies',
    question: 'What data could represent the claim, even imperfectly?',
    output: 'Proxy variables, source classes, and measurement caveats.',
  },
  {
    step: 'Failure modes',
    question: 'How could the claim be technically true but substantively misleading?',
    output: 'Narrow readings, missing data, and rhetorical overreach.',
  },
  {
    step: 'Opposite hypothesis',
    question: 'What would it look like if reality were backwards?',
    output: 'Evidence pattern that would show the claim is false.',
  },
  {
    step: 'Orthogonal hypothesis',
    question: 'What would it look like if the framing itself were wrong?',
    output: 'Evidence pattern showing the old category is not the live institutional form.',
  },
]

const decomposedClaims = [
  subclaim('C1', 'Modern tech elites are richer in absolute or inflation-adjusted terms than Vanderbilt, Carnegie, Stanford, and similar Gilded Age institution builders.', 'partially_observable', 'Wealth estimates are available but cross-era net-worth comparisons depend on method and selected comparator set.', ['Forbes/wealth lists', 'historical wealth estimates'], ['wealth_usd_2025', 'wealth_share_of_gdp']),
  subclaim('C2', 'Because tech benefits from university research and talent, tech elites are especially positioned to benefit from giving to universities.', 'partly_normative', 'Industry dependence is observable, but the “should give” premise is normative and cannot be settled by gift data alone.', ['labor pipelines', 'research funding links', 'patent/citation data'], ['share_of_company_recruits_from_universities', 'university_research_citations']),
  subclaim('C3', 'No tech elite has founded a university.', 'highly_observable_for_major_us_degree_granting_cases', 'Founding an accredited degree-granting university is visible; edge cases include campuses, schools, institutes, online programs, and non-US ventures.', ['accreditation histories', 'university histories', 'donor biographies'], ['new_degree_granting_institution_count']),
  subclaim('C4', 'Few tech elites have given endowments to universities.', 'partially_observable', 'Public major endowments and named funds are visible; anonymous, donor-advised, below-threshold, and foundation pass-through gifts are incomplete.', ['university gift announcements', 'campaign reports', 'Form 990s'], ['major_endowment_gift_count', 'major_endowment_gift_usd_2025']),
  subclaim('C5', 'Few tech elites donate to universities at all.', 'observable_only_for_disclosed_major_gifts', 'This pilot can falsify strong “few donate” rhetoric among public major gifts, but cannot estimate all donations.', ['university press releases', 'philanthropy databases'], ['public_major_gift_count', 'public_major_gift_usd_2025']),
  subclaim('C6', 'Tech giving goes somewhere other than universities.', 'partially_observable', 'Can be studied via foundation grants and philanthropic portfolios, but this case study only maps university-side gifts.', ['foundation grants databases', 'IRS Form 990', 'DAF disclosures when available'], ['share_of_philanthropy_to_universities']),
  subclaim('C7', 'Tech elites give differently: restricted, technical, medical, institute, school, and building gifts rather than unrestricted general endowments.', 'observable_for_public_major_gifts', 'Purpose and recipient unit are usually visible in major announcements, though restriction details can be vague.', ['university announcements', 'campaign reports'], ['recipient_unit', 'restriction_type', 'technical_destination_flag']),
]

function subclaim(id, text, observability, note, sourceClasses, proxies) {
  return { id, text, observability, note, sourceClasses, proxies }
}

const definitions = [
  ['tech elite', 'Founder, controlling early executive, or venture investor whose wealth and public identity are primarily tied to software, internet, semiconductors, enterprise tech, or adjacent computing infrastructure. The pilot keeps tech founders, tech executives, and tech VCs separate.'],
  ['founded a university', 'Created a new accredited degree-granting university or college. Schools, institutes, buildings, campuses, scholarship programs, and research centers inside existing universities are coded separately.'],
  ['endowment', 'A permanent or quasi-permanent fund supporting scholarships, professorships, research, or institutional operations. The pilot also tracks restricted capital gifts because public discourse often uses “endowment” imprecisely.'],
  ['few', 'Not directly meaningful without a denominator. The workflow tests counts, inflation-adjusted dollars, share of major gifts, share of donor wealth when available, and comparison to non-tech major donors.'],
  ['university donation', 'A gift to an accredited university, college, medical campus, school, institute, or university-controlled hospital. Gifts to non-university education nonprofits are outside this pilot but listed as a follow-up data need.'],
]

const studyDesign = {
  population: 'Publicly disclosed major higher-education gifts from modern tech elites and selected comparison donors.',
  pilotThreshold: '$20 million or larger, with a few institution-founding comparators.',
  timeRange: '1997-2022 in the seed dataset; workflow generalizes to 1990-present or other windows.',
  unitOfAnalysis: ['gift', 'donor', 'institution', 'recipient unit', 'claim subcomponent'],
  primaryOutcomes: [
    'public major gift count by donor sector',
    'inflation-adjusted public major gift dollars by donor sector',
    'recipient-unit distribution',
    'restriction/founding category',
    'degree-granting university founding count',
    'H1/H2/H3 claim rating',
  ],
  comparisons: [
    'tech founders vs tech executives/VCs',
    'tech-linked donors vs non-tech founders/finance/industrial comparators',
    'founding full universities vs founding schools, institutes, campuses, and scholarship programs',
    'unrestricted gifts vs restricted technical/medical/programmatic gifts',
  ],
}

const techRows = gifts.filter((row) => row.donorSector.startsWith('tech_'))
const techDollars = sum(techRows, 'inflationAdjustedUsdMillions')
const allDollars = sum(gifts, 'inflationAdjustedUsdMillions')
const techTechnicalDollars = sum(techRows.filter((row) => technicalUnit(row.recipientUnit)), 'inflationAdjustedUsdMillions')
const foundedDegreeTech = techRows.filter((row) => row.foundingCategory === 'founded_degree_granting_college')
const foundedInsideTech = techRows.filter((row) => row.foundingCategory.includes('founded_') && row.foundingCategory !== 'not_founded_university')
const endowedOrUnrestrictedTech = techRows.filter((row) => /endowment|endowed|unrestricted/u.test(row.restrictionType))

function sum(rows, key) {
  return Math.round(rows.reduce((total, row) => total + row[key], 0) * 10) / 10
}

function technicalUnit(unit) {
  return /computer|computing|technology|engineering|design|sustainability|research|medicine|pediatrics|brain/u.test(unit)
}

const hypothesisRatings = [
  {
    hypothesisId: 'H1',
    label: 'Broad claim basically supported',
    rating: 'weak_support_only_for_full-university-founding',
    rationale: 'The pilot found no tech founder in the seed set who founded a new independent degree-granting university. That narrow founding claim remains plausible under current public evidence, but the rest of the broad claim is not supported by the major-gift evidence.',
    evidenceRefs: ['C3', 'founding-comparison', 'gift-dataset'],
    limitations: ['The pilot is not an exhaustive accreditation search across all countries and online institutions.'],
  },
  {
    hypothesisId: 'H2',
    label: 'Technically narrow or partly supported but misleading',
    rating: 'strongest_current_rating',
    rationale: `The claim becomes misleading once “endowments” is read as major university support. The seed dataset contains ${techRows.length} tech-linked public major gifts totaling about $${techDollars.toLocaleString()}M in 2025 dollars, including unrestricted institute-wide support, scholarship endowments, research funds, buildings, hospitals, and new schools inside universities.`,
    evidenceRefs: ['caltech-moore-2001', 'stanford-doerr-2022', 'cambridge-gates-2000', 'illinois-siebel-cs-1999', 'ucsf-benioff-2010'],
    limitations: ['Public major gifts are easier to observe than all gifts; source coverage is intentionally high-confidence but incomplete.'],
  },
  {
    hypothesisId: 'H3',
    label: 'Wrong frame or orthogonal reality',
    rating: 'substantial_support',
    rationale: 'Modern tech-linked giving often builds schools, institutes, centers, scholarship programs, hospitals, and computing or sustainability infrastructure inside existing universities instead of founding standalone universities. The claim’s full-university benchmark is historically real but institutionally stale.',
    evidenceRefs: ['stanford-doerr-2022', 'mit-mcgovern-2000', 'berkeley-simons-2012', 'cmu-gates-2004', 'illinois-siebel-design-2016'],
    limitations: ['A broader knowledge-philanthropy portfolio study is needed to compare universities against non-university research labs, fellowships, online education, and foundations.'],
  },
]

const result = {
  answer: 'H2 is the best rating for the original claim, with H3 as an important explanatory frame. The narrow statement that modern tech elites rarely found standalone degree-granting universities is plausible in this pilot. The broader connotation that tech elites rarely support universities or give endowments is contradicted by visible major gifts, especially to technical, medical, scholarship, and institute-like university units.',
  confidence: 'medium for public major gifts; low for all-giving and wealth-share comparisons without proprietary or paid philanthropy databases',
  sourceDatasetIds: ['university-donation-claim-public-major-gifts-seed'],
  claims: decomposedClaims,
  evidence: sources,
  limitations: [
    'This is a seed public-major-gift dataset, not a census of all university giving.',
    'Anonymous gifts, donor-advised funds, gifts below announcement thresholds, and ambiguous foundation pass-through grants are underobserved.',
    'Gift amount, restriction status, and endowment status are coded from public language and need campaign-report or accounting confirmation for publication-grade estimates.',
    'The historical comparison to Vanderbilt, Carnegie, and Stanford requires a separate cross-era wealth and institution-founding dataset.',
  ],
  claimAdjudication: {
    originalClaim: claim,
    template,
    decomposedClaims,
    definitions: Object.fromEntries(definitions),
    dataSourcePlan: [
      { sourceClass: 'university announcements', observability: 'high for major gifts', use: 'gift amount, donor identity, purpose, recipient unit' },
      { sourceClass: 'campaign reports and annual giving reports', observability: 'medium', use: 'restriction and endowment confirmation' },
      { sourceClass: 'IRS Form 990 / foundation grants', observability: 'medium', use: 'foundation-origin grants and non-university alternatives' },
      { sourceClass: 'accreditation and institution histories', observability: 'high for degree-granting founding', use: 'full university founding tests' },
      { sourceClass: 'wealth lists and historical wealth estimates', observability: 'medium-low', use: 'wealth denominator and cross-era comparison' },
      { sourceClass: 'BLS/FRED CPI', observability: 'high', use: 'inflation adjustment' },
    ],
    observabilityAssessment: decomposedClaims.map(({ id, text, observability, note, sourceClasses, proxies }) => ({ id, text, observability, note, sourceClasses, proxies })),
    studyDesign,
    outcomeVariables: studyDesign.primaryOutcomes,
    alternativeExplanations: [
      'Founding universities was more plausible during periods when the higher-education sector was less mature.',
      'Modern donors can buy more marginal impact by funding schools, institutes, scholarships, laboratories, or medical centers inside existing universities.',
      'Accreditation, regulation, faculty labor markets, and capital requirements make new universities harder to found.',
      'Tech donors may prefer restricted technical gifts because they seek measurable, field-specific outputs rather than general institutional support.',
      'Some knowledge philanthropy now flows through non-university labs, fellowships, open-source ecosystems, AI/biosecurity institutes, or online education.',
    ],
    failureModes: [
      'The claim is true if “founded a university” means only new independent degree-granting universities.',
      'The claim is misleading if “given endowments” is used to imply little university support while excluding endowed scholarships, endowed funds, and restricted gifts.',
      'The claim is unsupported if “few donate” is interpreted against publicly disclosed major gifts.',
      'The claim is not answerable from public announcements alone if it means all donations or share of total philanthropy.',
    ],
    oppositeHypothesis: 'If reality were backwards, tech-linked donors would appear frequently among public major university gifts, with large inflation-adjusted sums and repeated support for technical schools, institutes, scholarships, and medical/research units.',
    orthogonalHypothesis: 'If the frame is wrong, tech-linked philanthropy would avoid founding standalone universities while still building university-adjacent or university-internal knowledge institutions.',
    hypothesisRatings,
    finalRating: 'H2',
  },
  tables: [
    { id: 'gift_seed', path: 'artifacts/gifts.csv', rows: gifts.length },
    { id: 'sources', path: 'artifacts/sources.csv', rows: sources.length },
  ],
  charts: [
    { id: 'sector_dollars', path: 'artifacts/sector-dollars.svg' },
    { id: 'tech_destination', path: 'artifacts/tech-destination.svg' },
    { id: 'founding_categories', path: 'artifacts/founding-categories.svg' },
  ],
}

function csv(rows) {
  const headers = Object.keys(rows[0])
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(',')),
  ].join('\n') + '\n'
}

function csvValue(value) {
  if (Array.isArray(value)) return csvValue(value.join('; '))
  if (value && typeof value === 'object') return csvValue(JSON.stringify(value))
  const text = String(value ?? '')
  return /[",\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text
}

function groupSum(rows, key, valueKey) {
  const groups = new Map()
  for (const row of rows) groups.set(row[key], Math.round(((groups.get(row[key]) ?? 0) + row[valueKey]) * 10) / 10)
  return [...groups].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

function barSvg(title, rows, options = {}) {
  const width = 980
  const rowHeight = 34
  const left = 260
  const top = 58
  const height = top + rows.length * rowHeight + 46
  const max = Math.max(...rows.map((row) => row.value), 1)
  const color = options.color ?? '#2563eb'
  const bars = rows.map((row, index) => {
    const y = top + index * rowHeight
    const barWidth = Math.round((row.value / max) * (width - left - 140))
    return [
      `<text x="24" y="${y + 20}" font-size="14" fill="#111827">${escapeXml(row.label)}</text>`,
      `<rect x="${left}" y="${y}" width="${barWidth}" height="22" fill="${color}" />`,
      `<text x="${left + barWidth + 8}" y="${y + 17}" font-size="13" fill="#374151">$${Math.round(row.value).toLocaleString()}M</text>`,
    ].join('\n')
  }).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">
  <rect width="100%" height="100%" fill="#ffffff" />
  <text x="24" y="34" font-size="22" font-weight="700" fill="#111827">${escapeXml(title)}</text>
  <text x="${left}" y="52" font-size="12" fill="#6b7280">Inflation-adjusted 2025 USD, seed public-major-gift dataset</text>
  ${bars}
</svg>
`
}

function countSvg(title, rows) {
  const width = 980
  const rowHeight = 34
  const left = 300
  const top = 58
  const height = top + rows.length * rowHeight + 46
  const max = Math.max(...rows.map((row) => row.value), 1)
  const bars = rows.map((row, index) => {
    const y = top + index * rowHeight
    const barWidth = Math.round((row.value / max) * (width - left - 140))
    return [
      `<text x="24" y="${y + 20}" font-size="14" fill="#111827">${escapeXml(row.label)}</text>`,
      `<rect x="${left}" y="${y}" width="${barWidth}" height="22" fill="#059669" />`,
      `<text x="${left + barWidth + 8}" y="${y + 17}" font-size="13" fill="#374151">${row.value}</text>`,
    ].join('\n')
  }).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">
  <rect width="100%" height="100%" fill="#ffffff" />
  <text x="24" y="34" font-size="22" font-weight="700" fill="#111827">${escapeXml(title)}</text>
  ${bars}
</svg>
`
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/gu, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]))
}

const sectorDollars = groupSum(gifts, 'donorSector', 'inflationAdjustedUsdMillions')
const techDestination = groupSum(techRows, 'recipientUnit', 'inflationAdjustedUsdMillions')
const foundingCategories = [...gifts.reduce((map, row) => map.set(row.foundingCategory, (map.get(row.foundingCategory) ?? 0) + 1), new Map())]
  .map(([label, value]) => ({ label, value }))
  .sort((a, b) => b.value - a.value)

const reportMd = `# University Donation Claim Adjudication

## Executive Summary

**Final rating: H2, with substantial H3 support.** The original claim is strongest only under a narrow definition of founding a new independent degree-granting university. It becomes misleading when it implies that tech elites rarely support universities or rarely give university endowments. In this seed public-major-gift dataset, tech-linked donors account for ${techRows.length} observed major gifts totaling about **$${techDollars.toLocaleString()} million in 2025 dollars**. Those gifts are heavily concentrated in schools, institutes, computer science, medicine, sustainability, scholarships, buildings, and endowed or unrestricted funds inside existing universities.

The result is not a census of all philanthropy. It is a high-confidence pilot over publicly disclosed major gifts. That data availability constraint matters: this study can test the visible-major-gift version of the claim much better than anonymous gifts, donor-advised-fund gifts, gifts below announcement thresholds, or share-of-net-worth comparisons.

## Original Claim

> ${claim}

## Reusable Workflow

${template.map((item, index) => `${index + 1}. **${item.step}.** ${item.question} Output: ${item.output}`).join('\n')}

## Literal Decomposition

${decomposedClaims.map((item) => `- **${item.id}.** ${item.text} Observability: ${item.observability}. ${item.note}`).join('\n')}

## Definitions

${definitions.map(([term, definition]) => `- **${term}:** ${definition}`).join('\n')}

## Data Availability

| Claim area | Availability | Practical consequence |
|---|---:|---|
| Publicly announced major gifts | High | Good enough for a pilot and strong counterexamples. |
| Full universe of donations | Low-medium | Needs paid philanthropy databases, university reports, DAF visibility, and Form 990 matching. |
| Endowment vs restricted capital accounting | Medium | Public language is useful but not always accounting-grade. |
| New accredited university founding | High | Institution histories and accreditation records are visible. |
| Cross-era wealth denominator | Low-medium | Requires historical wealth estimates and denominator choices. |
| Normative “should give” premise | Not directly observable | Treat as argument framing, not an empirical outcome. |

## Study Design

- **Population:** ${studyDesign.population}
- **Pilot threshold:** ${studyDesign.pilotThreshold}
- **Time range:** ${studyDesign.timeRange}
- **Unit of analysis:** ${studyDesign.unitOfAnalysis.join(', ')}
- **Comparisons:** ${studyDesign.comparisons.join('; ')}
- **Outcome variables:** ${studyDesign.primaryOutcomes.join('; ')}

## Evidence Summary

- Tech-linked public major gifts in this seed: **${techRows.length}**.
- Tech-linked inflation-adjusted dollars in this seed: **$${techDollars.toLocaleString()}M**.
- Tech-linked dollars going to technical, scientific, medical, or research units: **$${techTechnicalDollars.toLocaleString()}M**.
- Tech-linked full independent university foundings observed: **${foundedDegreeTech.length}**.
- Tech-linked schools/campuses/institutes/programs founded inside universities: **${foundedInsideTech.length}**.
- Tech-linked gifts coded as endowed or unrestricted: **${endowedOrUnrestrictedTech.length}**.

## Visualizations

![Inflation-adjusted dollars by donor sector](artifacts/sector-dollars.svg)

![Tech-linked dollars by recipient unit](artifacts/tech-destination.svg)

![Founding categories](artifacts/founding-categories.svg)

## Source Inventory

${sources.map((source) => `- **${source.id}:** [${source.title}](${source.url}) (${source.sourceType}; observability: ${source.observability})`).join('\n')}

## H1/H2/H3

${hypothesisRatings.map((item) => `### ${item.hypothesisId}: ${item.label}\n\n**Rating:** ${item.rating}\n\n${item.rationale}\n\n**Limits:** ${item.limitations.join('; ')}`).join('\n\n')}

## Alternative Explanations

${result.claimAdjudication.alternativeExplanations.map((item) => `- ${item}`).join('\n')}

## Failure Modes

${result.claimAdjudication.failureModes.map((item) => `- ${item}`).join('\n')}

## Interpretation

The connotative claim points at a real contrast: modern tech wealth rarely appears to found standalone universities in the Carnegie/Stanford/Vanderbilt mold. But the stronger implication, that tech elites do not donate to universities or avoid endowing university work, is not defensible from visible major-gift evidence. The more accurate statement is narrower: modern tech-linked donors tend to build inside existing universities through restricted schools, institutes, scholarships, hospitals, buildings, and research funds rather than founding new degree-granting universities.

## Next Data Work

1. Expand the public-major-gift dataset to 1990-present across Chronicle of Philanthropy, university campaign reports, and Form 990 grants.
2. Add a denominator table of tech elites and comparable non-tech elites by liquidity event, wealth, alma mater, and foundation.
3. Add a founding table of new accredited universities, colleges, campuses, and university-adjacent institutes by founder sector.
4. Separate unrestricted endowment, restricted endowment, capital gift, current-use program gift, foundation grant, and DAF-origin gifts.
5. Compare university giving against non-university knowledge philanthropy.
`

const reportHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>University Donation Claim Adjudication</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #111827; background: #fff; }
    main { max-width: 980px; margin: 0 auto; padding: 40px 24px 72px; line-height: 1.55; }
    h1, h2, h3 { line-height: 1.2; }
    h1 { font-size: 34px; margin-bottom: 8px; }
    h2 { border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px; }
    blockquote { border-left: 4px solid #9ca3af; margin-left: 0; padding-left: 16px; color: #374151; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f9fafb; }
    img { max-width: 100%; border: 1px solid #e5e7eb; }
    code { background: #f3f4f6; padding: 2px 4px; border-radius: 4px; }
  </style>
</head>
<body>
<main>
${markdownToHtml(reportMd)}
</main>
</body>
</html>
`

function markdownToHtml(markdown) {
  return markdown
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${inline(line.slice(2))}</h1>`
      if (line.startsWith('## ')) return `<h2>${inline(line.slice(3))}</h2>`
      if (line.startsWith('### ')) return `<h3>${inline(line.slice(4))}</h3>`
      if (line.startsWith('> ')) return `<blockquote>${inline(line.slice(2))}</blockquote>`
      if (line.startsWith('- ')) return `<p>${inline(line)}</p>`
      if (/^\d+\. /u.test(line)) return `<p>${inline(line)}</p>`
      if (line.startsWith('|')) return `<p><code>${escapeXml(line)}</code></p>`
      if (line.startsWith('![')) {
        const match = line.match(/^!\[(.*?)\]\((.*?)\)$/u)
        return match ? `<figure><img src="${escapeXml(match[2])}" alt="${escapeXml(match[1])}"></figure>` : ''
      }
      return line.trim() ? `<p>${inline(line)}</p>` : ''
    })
    .join('\n')
}

function inline(value) {
  return escapeXml(value)
    .replace(/\*\*(.*?)\*\*/gu, '<strong>$1</strong>')
    .replace(/`(.*?)`/gu, '<code>$1</code>')
}

writeFileSync(join(outDir, 'gifts.csv'), csv(gifts))
writeFileSync(join(outDir, 'sources.csv'), csv(sources))
writeFileSync(join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
writeFileSync(join(root, 'workflow.md'), workflowMarkdown())
writeFileSync(join(root, 'report.md'), reportMd)
writeFileSync(join(root, 'report.html'), reportHtml)
writeFileSync(join(outDir, 'sector-dollars.svg'), barSvg('Major Gift Dollars by Donor Sector', sectorDollars, { color: '#2563eb' }))
writeFileSync(join(outDir, 'tech-destination.svg'), barSvg('Tech-Linked Major Gift Dollars by Destination', techDestination, { color: '#7c3aed' }))
writeFileSync(join(outDir, 'founding-categories.svg'), countSvg('Gift/Founding Categories in Seed Dataset', foundingCategories))

function workflowMarkdown() {
  return `# Generic Claim Adjudication Workflow

This workflow converts an arbitrary connotative claim into testable components, checks data availability before overclaiming, and rates the claim using H1/H2/H3.

## Inputs

- Original claim in native wording.
- Claimed or implied population.
- Suspected comparison baseline.
- Candidate data sources or permission to search for them.
- Desired decision: disprove, narrow, explain, or quantify.

## Steps

${template.map((item, index) => `${index + 1}. **${item.step}.** ${item.question}\n   - Deliverable: ${item.output}`).join('\n')}

## Data Availability Gate

For every decomposed subclaim, assign:

- **Highly observable:** public records or structured datasets directly measure the thing.
- **Partially observable:** proxies exist, but coverage, joins, or definitions are incomplete.
- **Weakly observable:** mostly interpretive, hidden, anonymous, or costly to observe.
- **Non-observable/normative:** cannot be settled by data without additional value premises.

Do not let weakly observable or normative components drive a statistical rating. Keep them in the limitations and interpretation.

## H1/H2/H3 Rating

- **H1:** The broad claim is basically supported.
- **H2:** The claim is technically narrow or partly supported but substantively misleading.
- **H3:** The claim uses the wrong frame or is contradicted/orthogonal to the observed reality.

Each rating must include:

- Rating strength.
- Rationale.
- Evidence references.
- Limitations.
- What data could change the rating.

## Required Output Shape

\`\`\`json
{
  "claimAdjudication": {
    "originalClaim": "...",
    "decomposedClaims": [],
    "dataSourcePlan": [],
    "observabilityAssessment": [],
    "studyDesign": {},
    "outcomeVariables": [],
    "alternativeExplanations": [],
    "failureModes": [],
    "oppositeHypothesis": "...",
    "orthogonalHypothesis": "...",
    "hypothesisRatings": [
      { "hypothesisId": "H1", "rating": "...", "rationale": "...", "evidenceRefs": [], "limitations": [] },
      { "hypothesisId": "H2", "rating": "...", "rationale": "...", "evidenceRefs": [], "limitations": [] },
      { "hypothesisId": "H3", "rating": "...", "rationale": "...", "evidenceRefs": [], "limitations": [] }
    ],
    "finalRating": "H1|H2|H3"
  }
}
\`\`\`
`
}

console.log(`Wrote ${gifts.length} gift rows, ${sources.length} sources, and report artifacts to ${root}`)
