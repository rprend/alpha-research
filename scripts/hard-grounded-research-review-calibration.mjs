import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const specPath = join(experimentDir, 'benchmark-spec.json')
const calibrationJsonPath = join(generatedDir, 'review-calibration.json')
const calibrationMarkdownPath = join(experimentDir, 'REVIEW_CALIBRATION.md')

const expectedLabels = ['SUPPORTED', 'REFUTED', 'INSUFFICIENT', 'CONFLICT', 'INVALID_ITEM']

const sentinelTemplates = {
  'multi-hop synthesis': {
    expected_label: 'SUPPORTED',
    expected_answer: 'Use both hops: the method appears in Paper A and the evaluation target appears in Paper B.',
    required_dimensions: ['required_hop_coverage', 'citation_minimality'],
    evidence_units: [
      { id: 'cal_multi_hop:a', title: 'Calibration Paper A', locator: 'abstract', text: 'Paper A introduces the retrieval method used by the system.' },
      { id: 'cal_multi_hop:b', title: 'Calibration Paper B', locator: 'results', text: 'Paper B evaluates that retrieval method on biomedical questions.' },
    ],
    reviewer_trap: 'Citing only one hop should fail calibration.',
    required_citation_ids: ['cal_multi_hop:a', 'cal_multi_hop:b'],
  },
  'stale-vs-current document conflicts': {
    expected_label: 'SUPPORTED',
    expected_answer: 'As of the newer document date, the newer statement controls and the older statement is stale.',
    required_dimensions: ['temporal_grounding', 'stale_evidence_rejection'],
    evidence_units: [
      { id: 'cal_stale:old', title: 'Calibration 2021 note', locator: 'body', text: 'The policy threshold is 10 units as of 2021.' },
      { id: 'cal_stale:new', title: 'Calibration 2024 update', locator: 'revision', text: 'The policy threshold is 15 units as of 2024 and replaces the 2021 threshold.' },
    ],
    reviewer_trap: 'Treating the older threshold as current should fail calibration.',
    required_citation_ids: ['cal_stale:new'],
  },
  'appended document lifecycle changes': {
    expected_label: 'SUPPORTED',
    expected_answer: 'The appendix update controls the answer and must be cited with the original body evidence.',
    required_dimensions: ['section_provenance', 'supersession_detection'],
    evidence_units: [
      { id: 'cal_appendix:body', title: 'Calibration Paper Body', locator: 'section 3', text: 'The experiment used baseline X.' },
      { id: 'cal_appendix:update', title: 'Calibration Appendix', locator: 'erratum', text: 'The erratum says baseline Y supersedes baseline X for the final experiment.' },
    ],
    reviewer_trap: 'Accepting body-only evidence should fail calibration.',
    required_citation_ids: ['cal_appendix:body', 'cal_appendix:update'],
  },
  'table + text reasoning': {
    expected_label: 'SUPPORTED',
    expected_answer: 'The table gives the numeric value and the text defines which row is in scope.',
    required_dimensions: ['table_cell_grounding', 'text_scope_grounding'],
    evidence_units: [
      { id: 'cal_table:cell', title: 'Calibration Table', locator: 'row model B, column accuracy', text: 'Model B accuracy = 82.' },
      { id: 'cal_table:text', title: 'Calibration Caption', locator: 'caption', text: 'Only validation rows should be used for the reported accuracy.' },
    ],
    reviewer_trap: 'Using the table without the scoping text should fail calibration.',
    required_citation_ids: ['cal_table:cell', 'cal_table:text'],
  },
  'source authority conflicts': {
    expected_label: 'REFUTED',
    expected_answer: 'The low-authority source claim is refuted by the higher-authority primary document.',
    required_dimensions: ['authority_ordering', 'conflict_resolution'],
    evidence_units: [
      { id: 'cal_authority:blog', title: 'Calibration Blog', locator: 'paragraph 2', text: 'The trial was cancelled.' },
      { id: 'cal_authority:registry', title: 'Calibration Registry', locator: 'status field', text: 'The trial status is completed.' },
    ],
    reviewer_trap: 'Letting the lower-authority source decide the answer should fail calibration.',
    required_citation_ids: ['cal_authority:registry'],
  },
  'evidence insufficiency / abstention': {
    expected_label: 'INSUFFICIENT',
    expected_answer: 'Insufficient evidence: the provided sources do not answer the requested comparison.',
    required_dimensions: ['abstention_quality', 'missing_evidence_detection'],
    evidence_units: [
      { id: 'cal_insufficient:a', title: 'Calibration Abstract', locator: 'abstract', text: 'The paper reports a dataset but no baseline comparison.' },
    ],
    reviewer_trap: 'Inferring a comparison from absent evidence should fail calibration.',
    required_citation_ids: [],
  },
  'citation supports fact but not conclusion': {
    expected_label: 'INVALID_ITEM',
    expected_answer: 'The citation supports a premise but not the requested conclusion.',
    required_dimensions: ['conclusion_support', 'citation_scope'],
    evidence_units: [
      { id: 'cal_overreach:fact', title: 'Calibration Result', locator: 'table 1', text: 'Model C improves exact match by 2 points on one dataset.' },
    ],
    reviewer_trap: 'Accepting a broad superiority conclusion from a narrow fact should fail calibration.',
    required_citation_ids: [],
  },
  'entity disambiguation': {
    expected_label: 'SUPPORTED',
    expected_answer: 'The answer must use the entity matching the date and domain, not the same-named distractor.',
    required_dimensions: ['entity_resolution', 'distractor_rejection'],
    evidence_units: [
      { id: 'cal_entity:target', title: 'Jordan River dataset', locator: 'metadata', text: 'Jordan River is the hydrology dataset released in 2022.' },
      { id: 'cal_entity:distractor', title: 'Jordan River person', locator: 'biography', text: 'Jordan River is also the name of a fictional athlete.' },
    ],
    reviewer_trap: 'Following the same-name distractor should fail calibration.',
    required_citation_ids: ['cal_entity:target'],
  },
  'temporal questions: as of date X': {
    expected_label: 'SUPPORTED',
    expected_answer: 'The answer must be evaluated as of 2020-01-01, not from later evidence.',
    required_dimensions: ['as_of_date_scope', 'future_evidence_rejection'],
    evidence_units: [
      { id: 'cal_temporal:before', title: 'Calibration 2019 Report', locator: 'summary', text: 'As of 2019, the project was pending approval.' },
      { id: 'cal_temporal:after', title: 'Calibration 2022 Report', locator: 'summary', text: 'In 2022, the project was approved.' },
    ],
    reviewer_trap: 'Using future evidence for an as-of question should fail calibration.',
    required_citation_ids: ['cal_temporal:before'],
  },
  'cross-document contradiction': {
    expected_label: 'CONFLICT',
    expected_answer: 'The documents conflict and the provided corpus does not resolve which claim is correct.',
    required_dimensions: ['contradiction_detection', 'non_resolution'],
    evidence_units: [
      { id: 'cal_contradiction:a', title: 'Calibration Source A', locator: 'claim', text: 'The reported sample size is 400.' },
      { id: 'cal_contradiction:b', title: 'Calibration Source B', locator: 'claim', text: 'The reported sample size is 450.' },
    ],
    reviewer_trap: 'Choosing one side without a resolution source should fail calibration.',
    required_citation_ids: ['cal_contradiction:a', 'cal_contradiction:b'],
  },
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value)
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function buildCalibration(spec) {
  const categories = spec.categories || []
  const sentinels = categories.map((category, index) => {
    const template = sentinelTemplates[category]
    if (!template) throw new Error(`Missing calibration sentinel template for category: ${category}`)
    return {
      sentinel_id: `hgr_calibration_${String(index + 1).padStart(2, '0')}`,
      category,
      question: `Calibration check for ${category}: assign the final label, answer, and required citations using only the calibration evidence.`,
      expected_label: template.expected_label,
      expected_answer: template.expected_answer,
      expected_required_citation_ids: template.required_citation_ids,
      expected_insufficient_or_conflicting_evidence: ['INSUFFICIENT', 'CONFLICT'].includes(template.expected_label),
      required_dimensions: template.required_dimensions,
      reviewer_trap: template.reviewer_trap,
      evidence_units: template.evidence_units,
      gold_promotion_allowed: false,
    }
  })

  const labelCounts = Object.fromEntries(expectedLabels.map((label) => [label, sentinels.filter((item) => item.expected_label === label).length]))
  return {
    benchmark_id: spec.id,
    review_calibration_ready: sentinels.length === categories.length && expectedLabels.every((label) => labelCounts[label] > 0),
    calibration_scope: 'reviewer_screening_only',
    gold_promotion_allowed: false,
    category_count: categories.length,
    sentinel_count: sentinels.length,
    label_counts: labelCounts,
    acceptance_policy: {
      minimum_accuracy: 0.9,
      must_pass_before_review_batch_assignment: true,
      failed_sentinels_trigger_retraining: true,
      sentinel_labels_are_not_benchmark_gold: true,
    },
    generated_from: {
      benchmark_spec: 'benchmark-spec.json',
    },
    sentinels,
  }
}

function renderMarkdown(report) {
  const rows = report.sentinels.map((sentinel) => [
    sentinel.sentinel_id,
    sentinel.category,
    sentinel.expected_label,
    sentinel.expected_required_citation_ids.length ? sentinel.expected_required_citation_ids.join('<br>') : 'none',
    sentinel.reviewer_trap,
  ])

  return `# Hard Grounded Research Review Calibration

This generated packet defines reviewer-screening sentinel items for the hard-grounded benchmark. The sentinels are controlled calibration checks, not benchmark gold items, and they must not be used for paper task scores.

## Summary

- Calibration ready: ${report.review_calibration_ready}
- Scope: ${report.calibration_scope}
- Sentinels: ${report.sentinel_count}
- Categories covered: ${report.category_count}
- Gold promotion allowed: ${report.gold_promotion_allowed}
- Minimum reviewer calibration accuracy: ${report.acceptance_policy.minimum_accuracy}
- Must pass before review batch assignment: ${report.acceptance_policy.must_pass_before_review_batch_assignment}

## Expected Label Coverage

${markdownTable(['Label', 'Sentinels'], Object.entries(report.label_counts).map(([label, count]) => [label, String(count)]))}

## Sentinel Matrix

${markdownTable(['Sentinel', 'Category', 'Expected label', 'Expected citations', 'Reviewer trap'], rows)}
`
}

if (!existsSync(specPath)) throw new Error(`Missing benchmark spec: ${specPath}`)

const report = buildCalibration(readJson(specPath))
writeJson(calibrationJsonPath, report)
writeText(calibrationMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded review calibration JSON to ${calibrationJsonPath}`)
console.log(`Wrote hard grounded review calibration report to ${calibrationMarkdownPath}`)
