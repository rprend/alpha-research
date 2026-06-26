import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const planJsonPath = join(generatedDir, 'control-ablation-plan.json')
const planMarkdownPath = join(experimentDir, 'CONTROL_ABLATION_PLAN.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  lookupContrastRegistry: join(generatedDir, 'lookup-contrast-registry.json'),
  statisticalReportingTemplate: join(generatedDir, 'statistical-reporting-template.json'),
  sourceLineageLedger: join(generatedDir, 'source-lineage-ledger.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
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

const categoryControls = {
  'multi-hop synthesis': {
    negative_control: 'single-hop variant containing one required entity fact and no bridge requirement',
    ablations: ['remove_second_hop_evidence', 'replace_distractor_with_same_entity_page', 'balance_source_count_to_two_documents'],
    diagnostic_question: 'Does performance drop only when the answer requires composing both hops rather than retrieving either fact?',
  },
  'stale-vs-current document conflicts': {
    negative_control: 'current-only variant with stale snapshot removed',
    ablations: ['remove_document_dates', 'swap_stale_and_current_order', 'balance_snapshot_count'],
    diagnostic_question: 'Does performance depend on temporal/source-state control rather than claim-text retrieval?',
  },
  'appended document lifecycle changes': {
    negative_control: 'original-body-only variant where no appendix or lifecycle update changes the answer',
    ablations: ['remove_appendix_update', 'hide_appendix_label', 'append_update_as_unlabeled_evidence'],
    diagnostic_question: 'Does performance drop when appended material supersedes or qualifies the original body?',
  },
  'table + text reasoning': {
    negative_control: 'table-cell lookup variant whose answer is entailed by the cell alone',
    ablations: ['remove_surrounding_text', 'remove_table_caption', 'shuffle_nonanswer_rows'],
    diagnostic_question: 'Does performance depend on integrating table denotation with surrounding text?',
  },
  'source authority conflicts': {
    negative_control: 'single-authority variant where all cited sources agree and have equal authority',
    ablations: ['remove_authority_metadata', 'reverse_source_order', 'balance_authority_source_count'],
    diagnostic_question: 'Does performance depend on authority ranking rather than selecting the clearest prose?',
  },
  'evidence insufficiency / abstention': {
    negative_control: 'sufficient-evidence variant with explicit entailment for the answer',
    ablations: ['add_related_but_nonentailed_premise', 'remove_insufficiency_label', 'balance_candidate_evidence_count'],
    diagnostic_question: 'Does performance distinguish related evidence from evidence that entails the conclusion?',
  },
  'citation supports fact but not conclusion': {
    negative_control: 'premise-and-conclusion variant where the citation entails both fact and conclusion',
    ablations: ['remove_conclusion_support_sentence', 'keep_true_premise_only', 'balance_citation_count'],
    diagnostic_question: 'Does performance separate premise support from conclusion support?',
  },
  'entity disambiguation': {
    negative_control: 'unambiguous entity variant with no same-name distractor',
    ablations: ['remove_disambiguating_context', 'add_same_surface_form_distractor', 'balance_entity_mention_count'],
    diagnostic_question: 'Does performance depend on resolving the intended entity rather than matching surface form?',
  },
  'temporal questions: as of date X': {
    negative_control: 'timeless variant where the same answer is valid before and after the as-of date',
    ablations: ['remove_as_of_date', 'add_future_evidence', 'balance_pre_and_post_date_evidence'],
    diagnostic_question: 'Does performance depend on applying the as-of date rather than retrieving the newest evidence?',
  },
  'cross-document contradiction': {
    negative_control: 'consensus variant where all documents support the same conclusion',
    ablations: ['remove_conflicting_document', 'hide_conflict_marker', 'balance_support_and_refute_source_count'],
    diagnostic_question: 'Does performance identify contradiction instead of smoothing evidence into consensus?',
  },
}

function buildPlan({
  spec,
  lookupContrastRegistry,
  statisticalReportingTemplate,
  sourceLineageLedger,
  baselineAnalysis,
  releaseGate,
  paperClaimLedger,
}) {
  const lineageByCategory = new Map()
  for (const row of sourceLineageLedger.lineage_rows) {
    lineageByCategory.set(row.category, (lineageByCategory.get(row.category) || 0) + 1)
  }
  const reportingByCategory = new Map(statisticalReportingTemplate.category_reporting_rows.map((row) => [row.category, row]))
  const controlRows = lookupContrastRegistry.rows.map((row) => {
    const controls = categoryControls[row.category]
    const reporting = reportingByCategory.get(row.category)
    return {
      category: row.category,
      simple_lookup_control: row.lookup_control,
      negative_control: controls.negative_control,
      ablations: controls.ablations,
      diagnostic_question: controls.diagnostic_question,
      primary_metrics: row.primary_metrics,
      required_reporting_columns: reporting.required_columns.filter((column) =>
        column.includes('_mean') || ['lookup_control_comparison', 'sensitivity_status', 'claim_status'].includes(column),
      ),
      lineage_rows_available: lineageByCategory.get(row.category) || 0,
      claim_status: row.claim_status,
    }
  })
  const gateIds = ['gold_review_complete', 'review_merge_ready', 'category_scale_ready', 'novelty_audit_final']
  const gates = gateIds.map((id) => releaseCheck(releaseGate, id))
  const checks = [
    {
      id: 'all_categories_have_negative_controls',
      passed: controlRows.length === spec.categories.length && controlRows.every((row) => row.negative_control && row.ablations.length >= 3),
      detail: `${controlRows.length}/${spec.categories.length} categories have negative controls and at least three ablations`,
    },
    {
      id: 'controls_link_lookup_and_reporting_contracts',
      passed: controlRows.every((row) => row.simple_lookup_control && row.required_reporting_columns.includes('lookup_control_comparison')),
      detail: `${controlRows.length} controls link lookup contrast and reporting columns`,
    },
    {
      id: 'controls_have_source_lineage_support',
      passed: controlRows.every((row) => row.lineage_rows_available >= 3),
      detail: `${controlRows.reduce((sum, row) => sum + row.lineage_rows_available, 0)} lineage rows across control categories`,
    },
    {
      id: 'claims_remain_diagnostic',
      passed:
        gates.some((gate) => !gate.passed) &&
        paperClaimLedger.completion_claim_allowed === false &&
        releaseGate.status === 'blocked',
      detail: `${gates.filter((gate) => !gate.passed).length}/${gates.length} confirmatory gates blocked; release status=${releaseGate.status}`,
    },
  ]

  return {
    control_ablation_plan_ready: checks.every((check) => check.passed),
    version: 'control-ablation-plan-v1',
    completion_claim_allowed: false,
    generated_from: {
      spec: 'benchmark-spec.json',
      lookup_contrast_registry: 'generated/lookup-contrast-registry.json',
      statistical_reporting_template: 'generated/statistical-reporting-template.json',
      source_lineage_ledger: 'generated/source-lineage-ledger.json',
      baseline_analysis: 'generated/baseline-analysis.json',
      release_gate: 'generated/release-gate.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
    },
    checks,
    control_rows: controlRows,
    claim_gates: gates.map((gate) => ({
      id: gate.id,
      passed: gate.passed,
      detail: gate.detail,
      blocker: gate.blocker,
    })),
    summary: {
      categories: controlRows.length,
      negative_controls: controlRows.length,
      ablation_conditions: controlRows.reduce((sum, row) => sum + row.ablations.length, 0),
      lineage_rows: controlRows.reduce((sum, row) => sum + row.lineage_rows_available, 0),
      blocked_claim_gates: gates.filter((gate) => !gate.passed).length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(plan) {
  const checkRows = plan.checks.map((check) => [check.id, String(check.passed), check.detail])
  const controlRows = plan.control_rows.map((row) => [
    row.category,
    row.negative_control,
    row.ablations.join('<br>'),
    row.diagnostic_question,
    row.primary_metrics.join('<br>'),
    row.claim_status,
  ])
  const gateRows = plan.claim_gates.map((gate) => [gate.id, String(gate.passed), gate.detail, gate.blocker])

  return `# Hard Grounded Research Control And Ablation Plan

This generated plan defines negative controls and ablations for each hard-grounded category. It is designed to test whether measured failures come from the intended hard-grounding mechanism rather than source count, prompt length, dataset identity, citation count, or surface-form retrieval.

## Summary

- Plan ready: ${plan.control_ablation_plan_ready}
- Version: ${plan.version}
- Categories: ${plan.summary.categories}
- Negative controls: ${plan.summary.negative_controls}
- Ablation conditions: ${plan.summary.ablation_conditions}
- Lineage rows linked: ${plan.summary.lineage_rows}
- Blocked claim gates: ${plan.summary.blocked_claim_gates}
- Completion claim allowed: ${plan.summary.completion_claim_allowed}

## Readiness Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Category Controls

${markdownTable(['Category', 'Negative control', 'Ablations', 'Diagnostic question', 'Primary metrics', 'Claim status'], controlRows)}

## Claim Gates

${markdownTable(['Gate', 'Passed', 'Detail', 'Blocker'], gateRows)}
`
}

const plan = buildPlan({
  spec: readJson(inputs.spec),
  lookupContrastRegistry: readJson(inputs.lookupContrastRegistry),
  statisticalReportingTemplate: readJson(inputs.statisticalReportingTemplate),
  sourceLineageLedger: readJson(inputs.sourceLineageLedger),
  baselineAnalysis: readJson(inputs.baselineAnalysis),
  releaseGate: readJson(inputs.releaseGate),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
})

writeJson(planJsonPath, plan)
writeText(planMarkdownPath, renderMarkdown(plan))

console.log(`Wrote hard grounded control ablation plan to ${planJsonPath}`)
console.log(`Wrote hard grounded control ablation plan report to ${planMarkdownPath}`)
