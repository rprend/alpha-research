import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const matrixJsonPath = join(generatedDir, 'hypothesis-test-matrix.json')
const matrixMarkdownPath = join(experimentDir, 'HYPOTHESIS_TEST_MATRIX.md')

const inputs = {
  difficultyMechanismLedger: join(generatedDir, 'difficulty-mechanism-ledger.json'),
  analysisPlan: join(generatedDir, 'analysis-plan.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  failureAtlas: join(generatedDir, 'failure-atlas.json'),
  scaleGapLedger: join(generatedDir, 'scale-gap-ledger.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
}

const mechanismHypotheses = {
  'multi-hop synthesis': {
    hypothesis: 'Models will retrieve individually relevant hops but lose answer correctness or conclusion support when the final answer requires evidence composition.',
    contrast: 'multi-hop synthesis vs native single-row or first-evidence baselines',
    primary_metrics: ['answer_correct', 'evidence_recall', 'conclusion_support'],
    expected_failure_signature: ['missing_evidence', 'unsupported_conclusion'],
  },
  'stale-vs-current document conflicts': {
    hypothesis: 'Models will overuse plausible stale evidence unless the scoring source forces recency-conditioned citation and answer selection.',
    contrast: 'stale evidence distractors vs current controlling evidence',
    primary_metrics: ['answer_correct', 'citation_faithfulness', 'conclusion_support'],
    expected_failure_signature: ['stale_evidence_used', 'temporal_scope_error'],
  },
  'appended document lifecycle changes': {
    hypothesis: 'Models will treat appended or corrective text as additive context instead of a document-state transition that can supersede earlier content.',
    contrast: 'body-only evidence vs appended lifecycle evidence',
    primary_metrics: ['answer_correct', 'evidence_recall', 'conclusion_support'],
    expected_failure_signature: ['lifecycle_state_missed', 'unsupported_conclusion'],
  },
  'table + text reasoning': {
    hypothesis: 'Models will cite the correct table cell while failing the prose qualifier or interpretation required to make the answer grounded.',
    contrast: 'table-only extraction vs table-plus-text interpretation',
    primary_metrics: ['answer_correct', 'citation_precision', 'conclusion_support'],
    expected_failure_signature: ['table_text_join_error', 'unsupported_conclusion'],
  },
  'source authority conflicts': {
    hypothesis: 'Models will synthesize lower- and higher-authority sources unless the task requires an explicit authority hierarchy.',
    contrast: 'authority-ranked evidence vs locally plausible lower-authority evidence',
    primary_metrics: ['answer_correct', 'citation_faithfulness', 'abstention_quality'],
    expected_failure_signature: ['authority_resolution_error', 'contradiction_missed'],
  },
  'evidence insufficiency / abstention': {
    hypothesis: 'Models will answer from near-miss evidence instead of abstaining when relevance is present but sufficiency is absent.',
    contrast: 'near-miss evidence vs sufficient evidence',
    primary_metrics: ['abstention_quality', 'conclusion_support', 'citation_faithfulness'],
    expected_failure_signature: ['abstention_error', 'unsupported_conclusion'],
  },
  'citation supports fact but not conclusion': {
    hypothesis: 'Models will cite true premises and still make unsupported comparative, causal, or interpretive conclusions.',
    contrast: 'premise-supported citation vs conclusion-supported citation',
    primary_metrics: ['conclusion_support', 'citation_faithfulness', 'answer_correct'],
    expected_failure_signature: ['citation_overreach', 'unsupported_conclusion'],
  },
  'entity disambiguation': {
    hypothesis: 'Models will retrieve or cite same-name evidence while answering about the wrong referent.',
    contrast: 'intended entity evidence vs same-name distractor evidence',
    primary_metrics: ['answer_correct', 'evidence_recall', 'citation_precision'],
    expected_failure_signature: ['entity_binding_error', 'wrong_evidence'],
  },
  'temporal questions: as of date X': {
    hypothesis: 'Models will answer using globally current or generally true evidence rather than the requested as-of date.',
    contrast: 'as-of-date snapshot vs outside-window evidence',
    primary_metrics: ['answer_correct', 'citation_faithfulness', 'abstention_quality'],
    expected_failure_signature: ['temporal_scope_error', 'stale_evidence_used'],
  },
  'cross-document contradiction': {
    hypothesis: 'Models will merge incompatible documents into a single unsupported answer instead of reporting conflict or applying a control rule.',
    contrast: 'conflicting evidence bundle vs non-conflicting bundle',
    primary_metrics: ['abstention_quality', 'conclusion_support', 'citation_faithfulness'],
    expected_failure_signature: ['contradiction_missed', 'unsupported_conclusion'],
  },
}

const failureModeAliases = {
  missing_evidence: ['missing_required_evidence'],
  unsupported_conclusion: ['citation_does_not_support_conclusion'],
  stale_evidence_used: ['citation_does_not_support_conclusion', 'missing_required_evidence'],
  temporal_scope_error: ['wrong_answer', 'bad_abstention_or_conflict_behavior'],
  lifecycle_state_missed: ['missing_required_evidence', 'wrong_answer'],
  table_text_join_error: ['wrong_answer', 'citation_does_not_support_conclusion'],
  authority_resolution_error: ['wrong_answer', 'citation_does_not_support_conclusion'],
  contradiction_missed: ['bad_abstention_or_conflict_behavior', 'citation_does_not_support_conclusion'],
  abstention_error: ['bad_abstention_or_conflict_behavior'],
  citation_overreach: ['citation_does_not_support_conclusion', 'citation_not_faithful_to_answer'],
  entity_binding_error: ['wrong_answer', 'citation_not_faithful_to_answer'],
  wrong_evidence: ['missing_required_evidence', 'citation_not_faithful_to_answer'],
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

function releaseCheck(releaseGate, id) {
  return releaseGate.checks.find((check) => check.id === id) || {
    id,
    passed: false,
    detail: 'missing release check',
    blocker: 'missing release check',
  }
}

function categoryBaselineRows(baselineAnalysis, failureAtlas, category) {
  const fromWeakest = baselineAnalysis.systems
    .map((system) => {
      const summary = system.weakest_categories?.find((row) => row.category === category)
      if (!summary) return null
      return {
        system_id: system.system_id,
        task_count: null,
        answer_correct: summary.answer_correct,
        evidence_recall: summary.evidence_recall,
        citation_faithfulness: summary.citation_faithfulness,
        conclusion_support: summary.conclusion_support,
        abstention_quality: summary.abstention_quality,
      }
    })
    .filter(Boolean)
  const fromFailures = (failureAtlas.by_category?.[category]?.representative_cases || []).map((entry) => ({
    system_id: entry.system_id,
    task_count: 1,
    answer_correct: entry.metrics.answer_correct,
    evidence_recall: entry.metrics.evidence_recall,
    citation_faithfulness: entry.metrics.citation_faithfulness,
    conclusion_support: entry.metrics.conclusion_support,
    abstention_quality: entry.metrics.abstention_quality,
  }))
  const seen = new Set()
  return [...fromWeakest, ...fromFailures].filter((row) => {
    const key = `${row.system_id}:${row.answer_correct}:${row.evidence_recall}:${row.citation_faithfulness}:${row.conclusion_support}:${row.abstention_quality}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function metricRange(rows, metric) {
  const values = rows.map((row) => row[metric]).filter((value) => Number.isFinite(value))
  if (!values.length) return null
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    spread: Math.max(...values) - Math.min(...values),
  }
}

function buildMatrix({ difficultyMechanismLedger, analysisPlan, baselineAnalysis, failureAtlas, scaleGapLedger, releaseGate }) {
  const failureByCategory = failureAtlas.by_category || {}
  const scaleByCategory = new Map(scaleGapLedger.categories.map((category) => [category.category, category]))
  const rows = difficultyMechanismLedger.categories.map((category) => {
    const config = mechanismHypotheses[category.category]
    const baselineRows = categoryBaselineRows(baselineAnalysis, failureAtlas, category.category)
    const metric_ranges = Object.fromEntries(config.primary_metrics.map((metric) => [metric, metricRange(baselineRows, metric)]))
    const failure = failureByCategory[category.category] || {}
    const scale = scaleByCategory.get(category.category) || {}
    const observedModes = new Set([
      ...(failure.top_failure_modes || []),
      ...(failure.representative_cases || []).flatMap((entry) => entry.failure_modes || []),
    ])
    const expectedObserved = config.expected_failure_signature.filter((mode) =>
      (failureModeAliases[mode] || [mode]).some((alias) => observedModes.has(alias)),
    )
    return {
      category: category.category,
      mechanisms: category.mechanisms,
      hypothesis: config.hypothesis,
      contrast: config.contrast,
      primary_metrics: config.primary_metrics,
      expected_failure_signature: config.expected_failure_signature,
      observed_expected_failure_modes: expectedObserved,
      observed_failure_cases: category.observed_failure_cases,
      baseline_systems_with_category_results: new Set(baselineRows.map((row) => row.system_id)).size,
      metric_ranges,
      reviewed_item_deficit: scale.reviewed_item_deficit ?? category.reviewed_item_deficit,
      claim_status:
        (scale.reviewed_item_deficit ?? category.reviewed_item_deficit) === 0
          ? 'testable_after_final_novelty_audit'
          : 'diagnostic_only_until_review_scale_and_novelty_clear',
    }
  })

  const claimGates = ['gold_review_complete', 'category_scale_ready', 'review_merge_ready', 'novelty_audit_final'].map((id) =>
    releaseCheck(releaseGate, id),
  )
  const checks = [
    {
      id: 'all_categories_have_testable_hypotheses',
      passed: rows.length === difficultyMechanismLedger.summary.categories && rows.every((row) => row.hypothesis && row.primary_metrics.length >= 3),
      detail: `${rows.length}/${difficultyMechanismLedger.summary.categories} categories mapped to hypotheses and metrics`,
    },
    {
      id: 'baseline_results_linked',
      passed: rows.every((row) => row.baseline_systems_with_category_results >= 2),
      detail: `${baselineAnalysis.systems.length} baseline systems; minimum category systems=${Math.min(...rows.map((row) => row.baseline_systems_with_category_results))}`,
    },
    {
      id: 'failure_signatures_partly_observed',
      passed: rows.filter((row) => row.observed_expected_failure_modes.length > 0).length >= 8,
      detail: `${rows.filter((row) => row.observed_expected_failure_modes.length > 0).length}/${rows.length} categories show at least one expected failure signature in pilot failure atlas`,
    },
    {
      id: 'statistical_claims_blocked',
      passed: claimGates.some((gate) => !gate.passed) && rows.every((row) => row.claim_status.startsWith('diagnostic_only')),
      detail: `${claimGates.filter((gate) => !gate.passed).length}/${claimGates.length} claim gates still blocked`,
    },
  ]

  return {
    hypothesis_test_matrix_ready: checks.every((check) => check.passed),
    version: 'hypothesis-test-matrix-v1',
    completion_claim_allowed: false,
    generated_from: {
      difficulty_mechanism_ledger: 'generated/difficulty-mechanism-ledger.json',
      analysis_plan: 'generated/analysis-plan.json',
      baseline_analysis: 'generated/baseline-analysis.json',
      failure_atlas: 'generated/failure-atlas.json',
      scale_gap_ledger: 'generated/scale-gap-ledger.json',
      release_gate: 'generated/release-gate.json',
    },
    analysis_plan_alignment: {
      hypotheses: analysisPlan.summary.hypotheses,
      claim_gates: analysisPlan.summary.claim_gates,
      reviewed_items_current: analysisPlan.summary.reviewed_items_current,
      reviewed_items_target: analysisPlan.summary.reviewed_items_target,
    },
    checks,
    claim_gates: claimGates.map((gate) => ({
      id: gate.id,
      passed: gate.passed,
      detail: gate.detail,
      blocker: gate.blocker,
    })),
    rows,
    summary: {
      categories: rows.length,
      hypotheses: rows.length,
      categories_with_observed_expected_failure_modes: rows.filter((row) => row.observed_expected_failure_modes.length > 0).length,
      observed_failure_cases: rows.reduce((sum, row) => sum + row.observed_failure_cases, 0),
      reviewed_item_deficit: rows.reduce((sum, row) => sum + row.reviewed_item_deficit, 0),
      diagnostic_only_categories: rows.filter((row) => row.claim_status.startsWith('diagnostic_only')).length,
      completion_claim_allowed: false,
    },
  }
}

function renderMetricRanges(metricRanges) {
  return Object.entries(metricRanges)
    .map(([metric, range]) => (range ? `${metric}: ${range.min.toFixed(3)}-${range.max.toFixed(3)}` : `${metric}: n/a`))
    .join('<br>')
}

function renderMarkdown(matrix) {
  const checkRows = matrix.checks.map((check) => [check.id, String(check.passed), check.detail])
  const hypothesisRows = matrix.rows.map((row) => [
    row.category,
    row.hypothesis,
    row.primary_metrics.join('<br>'),
    row.expected_failure_signature.join('<br>'),
    row.observed_expected_failure_modes.join('<br>') || 'none yet',
    renderMetricRanges(row.metric_ranges),
    row.claim_status,
  ])
  const gateRows = matrix.claim_gates.map((gate) => [gate.id, String(gate.passed), gate.detail, gate.blocker])

  return `# Hard Grounded Research Hypothesis Test Matrix

This generated matrix turns the benchmark's difficulty mechanisms into testable empirical predictions. It is a paper-planning artifact: current rows are diagnostic because human review, category scale, and final novelty gates are still blocked.

## Summary

- Matrix ready: ${matrix.hypothesis_test_matrix_ready}
- Version: ${matrix.version}
- Categories: ${matrix.summary.categories}
- Hypotheses: ${matrix.summary.hypotheses}
- Categories with observed expected failure modes: ${matrix.summary.categories_with_observed_expected_failure_modes}
- Observed failure cases: ${matrix.summary.observed_failure_cases}
- Reviewed item deficit: ${matrix.summary.reviewed_item_deficit}
- Diagnostic-only categories: ${matrix.summary.diagnostic_only_categories}
- Completion claim allowed: ${matrix.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Hypothesis Rows

${markdownTable(['Category', 'Hypothesis', 'Primary metrics', 'Expected failure signature', 'Observed expected modes', 'Pilot metric ranges', 'Claim status'], hypothesisRows)}

## Claim Gates

${markdownTable(['Gate', 'Passed', 'Detail', 'Blocker'], gateRows)}
`
}

const matrix = buildMatrix({
  difficultyMechanismLedger: readJson(inputs.difficultyMechanismLedger),
  analysisPlan: readJson(inputs.analysisPlan),
  baselineAnalysis: readJson(inputs.baselineAnalysis),
  failureAtlas: readJson(inputs.failureAtlas),
  scaleGapLedger: readJson(inputs.scaleGapLedger),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(matrixJsonPath, matrix)
writeText(matrixMarkdownPath, renderMarkdown(matrix))

console.log(`Wrote hard grounded hypothesis test matrix to ${matrixJsonPath}`)
console.log(`Wrote hard grounded hypothesis test matrix report to ${matrixMarkdownPath}`)
