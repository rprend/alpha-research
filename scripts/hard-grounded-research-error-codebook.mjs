import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'error-codebook.json')
const reportMarkdownPath = join(experimentDir, 'ERROR_CODEBOOK.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  rubrics: join(experimentDir, 'rubrics.json'),
  failureAtlas: join(generatedDir, 'failure-atlas.json'),
  scoringContract: join(generatedDir, 'scoring-contract.json'),
  annotationQualityControl: join(generatedDir, 'annotation-quality-control.json'),
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

const codeDefinitions = {
  wrong_answer: {
    label: 'Wrong final answer',
    include: 'The final answer contradicts reviewed task labels, gives a value outside the valid answer set, or answers a different entity/date/scope.',
    exclude: 'Use a citation or evidence code instead when the answer is correct but the cited support is incomplete or misattached.',
    adjudication_note: 'If reviewers disagree, first decide answer correctness from gold labels before coding citation behavior.',
  },
  missing_required_evidence: {
    label: 'Missing required evidence',
    include: 'The answer omits at least one evidence unit needed to support the final conclusion, bridge hop, table interpretation, authority rule, or temporal scope.',
    exclude: 'Do not use this code for extra unsupported citations when all required evidence is already present; use citation_not_faithful_to_answer.',
    adjudication_note: 'Review against required_citation_ids, not against any plausible topical citation.',
  },
  citation_not_faithful_to_answer: {
    label: 'Citation not faithful to answer',
    include: 'A cited evidence unit does not directly support the answer sentence attached to it, even if the evidence is true or topically related.',
    exclude: 'If the cited evidence supports the sentence but not the final inference, use citation_does_not_support_conclusion.',
    adjudication_note: 'This is sentence-level attribution; it is stricter than document relevance.',
  },
  citation_does_not_support_conclusion: {
    label: 'Citation supports fact but not conclusion',
    include: 'The citation supports a premise, entity mention, or table cell but does not license the answer conclusion or comparison being made.',
    exclude: 'If the citation is irrelevant to both the premise and conclusion, use citation_not_faithful_to_answer.',
    adjudication_note: 'This code captures the benchmark distinction between grounded facts and grounded conclusions.',
  },
  bad_abstention_or_conflict_behavior: {
    label: 'Bad abstention or conflict behavior',
    include: 'The system answers when evidence is insufficient, abstains when evidence is sufficient, or fails to name unresolved conflict as the reason for refusing.',
    exclude: 'Do not apply only because the wording is cautious; the decision must be wrong under the insufficiency or conflict label.',
    adjudication_note: 'Check the abstained field and evidence_assessment together.',
  },
  contradiction_resolution_failure: {
    label: 'Contradiction resolution failure',
    include: 'The answer blends conflicting documents, averages incompatible claims, or fails to identify a contradiction that controls the task.',
    exclude: 'Use source authority or temporal scope codes when the apparent contradiction is resolved by an explicit source ranking or as-of date.',
    adjudication_note: 'Apply only to cross-document contradiction tasks or tasks with explicit contradictory evidence.',
  },
  authority_resolution_failure: {
    label: 'Authority resolution failure',
    include: 'The answer chooses lower-authority evidence, fails to state the authority rule, or treats equally topical sources as equally authoritative when the task defines a ranking.',
    exclude: 'Use temporal_scope_failure when the controlling distinction is document date rather than source authority.',
    adjudication_note: 'Authority is task-local and should come from source_type, provenance, or rubric fields.',
  },
  temporal_scope_failure: {
    label: 'Temporal scope failure',
    include: 'The answer uses evidence outside the requested as-of date, treats stale evidence as current, or ignores lifecycle/appended-document boundaries.',
    exclude: 'Use contradiction_resolution_failure if the central failure is unresolved conflict without a time boundary.',
    adjudication_note: 'Reviewers should cite the controlling document date, version marker, or appended-section boundary.',
  },
}

function codeForMode(mode) {
  const defaults = codeDefinitions[mode.failure_mode] || {
    label: mode.failure_mode.replaceAll('_', ' '),
    include: 'Apply when the failure mode is present under the task rubric.',
    exclude: 'Do not apply when a more specific code captures the defect.',
    adjudication_note: 'Escalate unclear cases during adjudication.',
  }

  return {
    id: mode.failure_mode,
    label: defaults.label,
    observed_cases: mode.case_count,
    systems: mode.system_count,
    categories: mode.category_count,
    include: defaults.include,
    exclude: defaults.exclude,
    adjudication_note: defaults.adjudication_note,
  }
}

function buildReport({ spec, rubrics, failureAtlas, scoringContract, annotationQualityControl }) {
  const codes = failureAtlas.failure_mode_summary.map(codeForMode)
  const categoryGuidance = spec.categories.map((category) => ({
    category,
    rubric_dimensions: rubrics.category_rubrics[category]?.required_dimensions || [],
    expected_error_codes: codes
      .filter((code) => {
        if (category.includes('contradiction')) return ['contradiction_resolution_failure', 'missing_required_evidence', 'citation_does_not_support_conclusion'].includes(code.id)
        if (category.includes('authority')) return ['authority_resolution_failure', 'missing_required_evidence', 'citation_does_not_support_conclusion'].includes(code.id)
        if (category.includes('temporal') || category.includes('stale') || category.includes('lifecycle')) return ['temporal_scope_failure', 'missing_required_evidence', 'citation_does_not_support_conclusion'].includes(code.id)
        if (category.includes('abstention')) return ['bad_abstention_or_conflict_behavior', 'wrong_answer', 'missing_required_evidence'].includes(code.id)
        if (category.includes('citation supports fact')) return ['citation_does_not_support_conclusion', 'citation_not_faithful_to_answer', 'missing_required_evidence'].includes(code.id)
        return ['wrong_answer', 'missing_required_evidence', 'citation_not_faithful_to_answer'].includes(code.id)
      })
      .map((code) => code.id),
  }))

  const reviewerRules = [
    'Assign all codes that apply; codes are not mutually exclusive.',
    'Code answer correctness before coding evidence behavior.',
    'Use citation_not_faithful_to_answer for sentence-level unsupported citations.',
    'Use citation_does_not_support_conclusion when evidence supports a true premise but not the final conclusion.',
    'Record abstention behavior from answer, abstained, and evidence_assessment fields together.',
    'Escalate disagreements to adjudication when reviewers differ on any primary error code.',
  ]

  return {
    benchmark_id: spec.id,
    error_codebook_ready:
      codes.length >= failureAtlas.summary.failure_mode_count &&
      categoryGuidance.length === spec.categories.length &&
      reviewerRules.length >= 6 &&
      scoringContract.scoring_contract_ready &&
      annotationQualityControl.annotation_quality_control_ready,
    version: 'error-codebook-v1',
    generated_from: {
      benchmark_spec: 'benchmark-spec.json',
      rubrics: 'rubrics.json',
      failure_atlas: 'generated/failure-atlas.json',
      scoring_contract: 'generated/scoring-contract.json',
      annotation_quality_control: 'generated/annotation-quality-control.json',
    },
    code_definitions: codes,
    category_guidance: categoryGuidance,
    reviewer_rules: reviewerRules,
    claim_limits: {
      completion_claim_allowed: false,
      qualitative_claims_allowed_now: 'pilot-diagnostic only',
      final_claims_blocked_until: ['gold_review_complete', 'review_merge_ready', 'category_scale_ready', 'novelty_audit_final'],
    },
    summary: {
      code_count: codes.length,
      categories: categoryGuidance.length,
      observed_failure_cases: failureAtlas.summary.failure_case_count,
      reviewer_rule_count: reviewerRules.length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(report) {
  const codeRows = report.code_definitions.map((code) => [
    code.id,
    code.label,
    String(code.observed_cases),
    code.include,
    code.exclude,
  ])
  const categoryRows = report.category_guidance.map((entry) => [
    entry.category,
    entry.rubric_dimensions.join(', '),
    entry.expected_error_codes.join(', '),
  ])
  const ruleRows = report.reviewer_rules.map((rule, index) => [String(index + 1), rule])

  return `# Hard Grounded Research Error Codebook

This generated codebook defines qualitative error codes for pilot and future gold analysis. It is diagnostic until human review, category scale, and final novelty gates pass.

## Summary

- Error codebook ready: ${report.error_codebook_ready}
- Version: ${report.version}
- Error codes: ${report.summary.code_count}
- Categories covered: ${report.summary.categories}
- Observed pilot failure cases: ${report.summary.observed_failure_cases}
- Completion claim allowed: ${report.claim_limits.completion_claim_allowed}
- Qualitative claims allowed now: ${report.claim_limits.qualitative_claims_allowed_now}

## Error Codes

${markdownTable(['Code', 'Label', 'Observed Cases', 'Include When', 'Exclude When'], codeRows)}

## Category Guidance

${markdownTable(['Category', 'Rubric Dimensions', 'Expected Error Codes'], categoryRows)}

## Reviewer Rules

${markdownTable(['#', 'Rule'], ruleRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  if (!existsSync(path)) throw new Error(`Missing error-codebook input ${name}: ${path}`)
}

const report = buildReport({
  spec: readJson(inputs.spec),
  rubrics: readJson(inputs.rubrics),
  failureAtlas: readJson(inputs.failureAtlas),
  scoringContract: readJson(inputs.scoringContract),
  annotationQualityControl: readJson(inputs.annotationQualityControl),
})

writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded error codebook JSON to ${reportJsonPath}`)
console.log(`Wrote hard grounded error codebook report to ${reportMarkdownPath}`)
