import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const rubricsPath = join(experimentDir, 'rubrics.json')
const reviewWorkbookIndexPath = join(generatedDir, 'review-workbooks/index.json')
const expansionReviewWorkbookIndexPath = join(generatedDir, 'expansion-review-workbooks/index.json')
const protocolJsonPath = join(generatedDir, 'annotation-protocol.json')
const protocolMarkdownPath = join(experimentDir, 'ANNOTATION_PROTOCOL.md')

const finalLabels = [
  ['SUPPORTED', 'The supplied evidence directly supports the final answer and required conclusion.', 'At least one required citation id is required; cite every evidence unit needed for the conclusion.'],
  ['REFUTED', 'The supplied evidence directly contradicts the candidate answer or claim.', 'At least one required citation id is required; cite the refuting evidence.'],
  ['INSUFFICIENT', 'The supplied evidence may be relevant but does not establish the requested answer or conclusion.', 'Do not provide required citation ids; set insufficient_or_conflicting_evidence=true.'],
  ['CONFLICT', 'Supplied documents conflict and the task does not provide a controlling source, date, or authority.', 'Cite the conflicting evidence ids and set insufficient_or_conflicting_evidence=true.'],
  ['INVALID_ITEM', 'The benchmark item is malformed, impossible to review, off-category, or has unusable evidence.', 'Do not provide required citation ids unless the defect itself depends on specific evidence.'],
].map(([label, useWhen, citationRule]) => ({ label, use_when: useWhen, citation_rule: citationRule }))

const expansionFields = {
  category_fit: [
    ['IN_CATEGORY', 'The item tests the intended hard-grounded category.'],
    ['WRONG_CATEGORY', 'The item primarily tests a different category.'],
    ['AMBIGUOUS_CATEGORY', 'The item plausibly spans categories and needs adjudicator review.'],
  ].map(([value, meaning]) => ({ value, meaning })),
  generation_defect: [
    ['NONE', 'No machine-generation defect is visible.'],
    ['BAD_SOURCE_ROW', 'The source row is mismatched, unusable, or not the claimed provenance.'],
    ['BAD_EVIDENCE', 'Evidence units are missing, irrelevant, malformed, or insufficient for the item.'],
    ['BAD_QUESTION', 'The question is unclear, unanswerable for the wrong reason, or not grounded.'],
    ['BAD_EXPECTED_ANSWER', 'The expected answer is wrong or not supported by the evidence.'],
    ['DUPLICATE', 'The candidate duplicates another item too closely.'],
    ['OTHER', 'A defect exists but is not covered by the other codes; explain in notes.'],
  ].map(([value, meaning]) => ({ value, meaning })),
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

function buildProtocol(rubrics, reviewWorkbookIndex, expansionReviewWorkbookIndex) {
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    protocol_version: '0.1.0',
    source_rubrics: 'rubrics.json',
    source_review_workbooks: 'generated/review-workbooks/index.json',
    source_expansion_review_workbooks: 'generated/expansion-review-workbooks/index.json',
    annotation_protocol_ready: true,
    review_scope: {
      pilot_workbooks: reviewWorkbookIndex.workbook_count,
      pilot_review_rows: reviewWorkbookIndex.total_review_rows,
      expansion_workbooks: expansionReviewWorkbookIndex.workbook_count,
      expansion_review_rows: expansionReviewWorkbookIndex.total_review_rows,
      independent_reviews_per_item: 2,
      reviewer_fields_only: true,
    },
    required_reviewer_fields: [
      'final_label',
      'final_answer',
      'required_citation_ids',
      'insufficient_or_conflicting_evidence',
      'notes',
      'reviewer_confidence',
    ],
    expansion_only_fields: ['category_fit', 'generation_defect'],
    final_labels: finalLabels,
    expansion_fields: expansionFields,
    category_rubrics: Object.fromEntries(
      Object.entries(rubrics.category_rubrics).map(([category, rubric]) => [
        category,
        {
          required_dimensions: rubric.required_dimensions,
          strong_answer: rubric.strong_answer,
          near_miss: rubric.near_miss,
          hard_negative: rubric.hard_negative,
        },
      ]),
    ),
    adjudication_rules: [
      'Two independent complete reviews are required before merge.',
      'Exact agreement promotes an item to merge-ready if validation checks pass.',
      'Any disagreement in final_label, final_answer, required_citation_ids, or insufficiency/conflict flag requires adjudication.',
      'Expansion candidates cannot be promoted to paper-scale gold until expansion review preflight and merge both pass.',
      'INVALID_ITEM rows must be repaired, replaced, or explicitly excluded before final gold release.',
    ],
  }
}

function renderMarkdown(protocol) {
  const labelRows = protocol.final_labels.map((label) => [label.label, label.use_when, label.citation_rule])
  const categoryRows = Object.entries(protocol.category_rubrics).map(([category, rubric]) => [
    category,
    rubric.required_dimensions.join('<br>'),
    rubric.strong_answer,
    rubric.near_miss,
    rubric.hard_negative,
  ])
  const categoryFitRows = protocol.expansion_fields.category_fit.map((field) => [field.value, field.meaning])
  const defectRows = protocol.expansion_fields.generation_defect.map((field) => [field.value, field.meaning])

  return `# Hard Grounded Research Annotation Protocol

This generated protocol defines how pilot and expansion review workbooks should be completed. It is an instruction artifact, not completed review data.

## Summary

- Protocol version: ${protocol.protocol_version}
- Pilot workbooks: ${protocol.review_scope.pilot_workbooks}
- Pilot review rows: ${protocol.review_scope.pilot_review_rows}
- Expansion workbooks: ${protocol.review_scope.expansion_workbooks}
- Expansion review rows: ${protocol.review_scope.expansion_review_rows}
- Independent reviews per item: ${protocol.review_scope.independent_reviews_per_item}
- Annotation protocol ready: ${protocol.annotation_protocol_ready}

## Required Reviewer Fields

${protocol.required_reviewer_fields.map((field) => `- \`${field}\``).join('\n')}

Expansion candidate reviews additionally require:

${protocol.expansion_only_fields.map((field) => `- \`${field}\``).join('\n')}

## Final Labels

${markdownTable(['Label', 'Use when', 'Citation rule'], labelRows)}

## Expansion Category Fit

${markdownTable(['Value', 'Meaning'], categoryFitRows)}

## Expansion Generation Defects

${markdownTable(['Value', 'Meaning'], defectRows)}

## Category Rubrics

${markdownTable(['Category', 'Required dimensions', 'Strong answer', 'Near miss', 'Hard negative'], categoryRows)}

## Adjudication Rules

${protocol.adjudication_rules.map((rule) => `- ${rule}`).join('\n')}
`
}

for (const path of [rubricsPath, reviewWorkbookIndexPath, expansionReviewWorkbookIndexPath]) {
  if (!existsSync(path)) throw new Error(`Missing annotation protocol input: ${path}`)
}

const protocol = buildProtocol(
  readJson(rubricsPath),
  readJson(reviewWorkbookIndexPath),
  readJson(expansionReviewWorkbookIndexPath),
)
writeJson(protocolJsonPath, protocol)
writeText(protocolMarkdownPath, renderMarkdown(protocol))

console.log(`Wrote hard grounded annotation protocol JSON to ${protocolJsonPath}`)
console.log(`Wrote hard grounded annotation protocol report to ${protocolMarkdownPath}`)
