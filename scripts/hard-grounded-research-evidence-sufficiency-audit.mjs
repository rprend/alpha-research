import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const auditJsonPath = join(generatedDir, 'evidence-sufficiency-audit.json')
const auditMarkdownPath = join(experimentDir, 'EVIDENCE_SUFFICIENCY_AUDIT.md')

const inputs = {
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  constructMap: join(generatedDir, 'construct-map.json'),
  difficultyMechanismLedger: join(generatedDir, 'difficulty-mechanism-ledger.json'),
  hypothesisTestMatrix: join(generatedDir, 'hypothesis-test-matrix.json'),
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

function evidenceUnits(item) {
  return item.source_examples.flatMap((example) => example.evidence_units || [])
}

function evidenceIds(item) {
  return evidenceUnits(item).map((unit) => unit.id)
}

function challengeType(item) {
  return item.challenge?.type || item.transform || 'native_row'
}

function hasDistractorOrControlSignal(item) {
  const challenge = item.challenge || {}
  return Boolean(
    challenge.trap ||
      challenge.older_document ||
      challenge.lower_authority_evidence_id ||
      challenge.excluded_future_evidence_ids?.length ||
      item.source_examples.some((example) => example.hard_grounding_signals?.includes('distractor-context')) ||
      item.expected_failure.toLowerCase().includes('distractor') ||
      item.expected_failure.toLowerCase().includes('stale') ||
      item.expected_failure.toLowerCase().includes('conflict') ||
      item.expected_failure.toLowerCase().includes('unsupported') ||
      item.expected_failure.toLowerCase().includes('does not support') ||
      item.expected_failure.toLowerCase().includes('merges entities') ||
      item.expected_failure.toLowerCase().includes('extracts the correct table cell'),
  )
}

function categoryFlags(item) {
  const type = challengeType(item)
  return {
    insufficiency_probe: type === 'insufficiency_probe',
    citation_overreach_probe: type === 'citation_overreach_probe',
    temporal_probe: type === 'as_of_date_constraint' || type === 'stale_current_conflict',
    contradiction_probe: type === 'cross_document_contradiction',
    lifecycle_probe: type === 'document_lifecycle_appendix',
    authority_probe: type === 'authority_conflict',
  }
}

function expectedContract(item) {
  const ids = evidenceIds(item)
  const challenge = item.challenge || {}
  const flags = categoryFlags(item)
  const required = new Set(ids)

  for (const key of [
    'candidate_evidence_id',
    'supported_fact_evidence_id',
    'high_authority_evidence_id',
    'lower_authority_evidence_id',
    'document_a_evidence_id',
    'document_b_evidence_id',
  ]) {
    if (challenge[key]) required.add(challenge[key])
  }
  for (const evidenceId of challenge.valid_evidence_ids || []) required.add(evidenceId)
  if (challenge.current_document?.evidence_id) required.add(challenge.current_document.evidence_id)
  if (challenge.original_body?.evidence_id) required.add(challenge.original_body.evidence_id)
  if (challenge.appended_update?.evidence_id) required.add(challenge.appended_update.evidence_id)

  const excluded = [
    ...(challenge.excluded_future_evidence_ids || []),
    challenge.older_document?.claim ? 'older_document_claim' : null,
  ].filter(Boolean)

  return {
    required_evidence_count: required.size,
    required_evidence_ids: [...required].sort(),
    excluded_or_control_evidence_count: excluded.length,
    excluded_or_control_evidence_ids: excluded,
    required_behavior: challenge.required_behavior || 'Cover every native supporting evidence unit required by the source dataset.',
    trap: challenge.trap || item.expected_failure,
    answer_policy: flags.insufficiency_probe
      ? 'abstain_unless_direct_conclusion_support_is_present'
      : flags.contradiction_probe
        ? 'report_conflict_when_evidence_cannot_be_reconciled'
        : flags.citation_overreach_probe
          ? 'separate_supported_fact_from_unsupported_conclusion'
          : 'answer_only_with_complete_supporting_evidence',
  }
}

function buildAudit({ pilotSuite, constructMap, difficultyMechanismLedger, hypothesisTestMatrix, paperClaimLedger }) {
  const rows = pilotSuite.items.map((item) => {
    const flags = categoryFlags(item)
    const contract = expectedContract(item)
    return {
      item_id: item.id,
      category: item.category,
      challenge_type: challengeType(item),
      review_status: item.review_status,
      required_evidence_count: contract.required_evidence_count,
      excluded_or_control_evidence_count: contract.excluded_or_control_evidence_count,
      evidence_contract_status: contract.required_evidence_count > 0 ? 'machine_contract_present_needs_human_review' : 'missing_required_evidence_contract',
      required_behavior: contract.required_behavior,
      trap: contract.trap,
      answer_policy: contract.answer_policy,
      has_distractor_or_control_signal: hasDistractorOrControlSignal(item),
      insufficiency_probe: flags.insufficiency_probe,
      citation_overreach_probe: flags.citation_overreach_probe,
      temporal_probe: flags.temporal_probe,
      contradiction_probe: flags.contradiction_probe,
      lifecycle_probe: flags.lifecycle_probe,
      authority_probe: flags.authority_probe,
      scoring_focus: item.scoring_focus,
      required_evidence_ids: contract.required_evidence_ids,
      excluded_or_control_evidence_ids: contract.excluded_or_control_evidence_ids,
      claim_status: 'diagnostic_only_until_review_scale_and_novelty_clear',
    }
  })

  const categoryRows = [...new Set(rows.map((row) => row.category))].map((category) => {
    const categoryItems = rows.filter((row) => row.category === category)
    const mechanism = difficultyMechanismLedger.categories.find((row) => row.category === category)
    const hypothesis = hypothesisTestMatrix.rows.find((row) => row.category === category)
    return {
      category,
      item_count: categoryItems.length,
      evidence_contracts_present: categoryItems.filter((row) => row.evidence_contract_status === 'machine_contract_present_needs_human_review').length,
      distractor_or_control_items: categoryItems.filter((row) => row.has_distractor_or_control_signal).length,
      insufficiency_items: categoryItems.filter((row) => row.insufficiency_probe).length,
      citation_overreach_items: categoryItems.filter((row) => row.citation_overreach_probe).length,
      temporal_items: categoryItems.filter((row) => row.temporal_probe).length,
      contradiction_items: categoryItems.filter((row) => row.contradiction_probe).length,
      difficulty_mechanism: mechanism?.mechanisms?.join('; ') || 'See difficulty mechanism ledger.',
      hypothesis: hypothesis?.hypothesis || 'See hypothesis test matrix.',
      claim_status: 'diagnostic_only_until_review_scale_and_novelty_clear',
    }
  })

  const checks = [
    {
      id: 'all_pilot_items_have_required_evidence_contract',
      passed: rows.length === pilotSuite.item_count && rows.every((row) => row.required_evidence_count > 0),
      detail: `${rows.filter((row) => row.required_evidence_count > 0).length}/${pilotSuite.item_count} pilot items have required evidence IDs`,
    },
    {
      id: 'hard_categories_have_distractor_or_control_signal',
      passed: categoryRows.every((row) => row.distractor_or_control_items > 0),
      detail: `${categoryRows.filter((row) => row.distractor_or_control_items > 0).length}/${categoryRows.length} categories expose a trap, distractor, conflict, or control signal`,
    },
    {
      id: 'insufficiency_and_overreach_probes_present',
      passed: rows.some((row) => row.insufficiency_probe) && rows.some((row) => row.citation_overreach_probe),
      detail: `${rows.filter((row) => row.insufficiency_probe).length} insufficiency probes; ${rows.filter((row) => row.citation_overreach_probe).length} citation-overreach probes`,
    },
    {
      id: 'temporal_and_contradiction_contracts_present',
      passed: rows.some((row) => row.temporal_probe) && rows.some((row) => row.contradiction_probe),
      detail: `${rows.filter((row) => row.temporal_probe).length} temporal probes; ${rows.filter((row) => row.contradiction_probe).length} contradiction probes`,
    },
    {
      id: 'claims_remain_gated',
      passed:
        paperClaimLedger.completion_claim_allowed === false &&
        rows.every((row) => row.claim_status === 'diagnostic_only_until_review_scale_and_novelty_clear'),
      detail: `completion_claim_allowed=${paperClaimLedger.completion_claim_allowed}; diagnostic_only_items=${rows.length}`,
    },
  ]

  return {
    evidence_sufficiency_audit_ready: checks.every((check) => check.passed),
    version: 'evidence-sufficiency-audit-v1',
    completion_claim_allowed: false,
    generated_from: {
      pilot_suite: 'generated/pilot-suite.json',
      construct_map: 'generated/construct-map.json',
      difficulty_mechanism_ledger: 'generated/difficulty-mechanism-ledger.json',
      hypothesis_test_matrix: 'generated/hypothesis-test-matrix.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
    },
    construct_map_version: constructMap.version,
    checks,
    category_rows: categoryRows,
    item_rows: rows,
    summary: {
      pilot_items: rows.length,
      categories: categoryRows.length,
      items_with_required_evidence_contract: rows.filter((row) => row.required_evidence_count > 0).length,
      items_with_distractor_or_control_signal: rows.filter((row) => row.has_distractor_or_control_signal).length,
      insufficiency_items: rows.filter((row) => row.insufficiency_probe).length,
      citation_overreach_items: rows.filter((row) => row.citation_overreach_probe).length,
      temporal_items: rows.filter((row) => row.temporal_probe).length,
      contradiction_items: rows.filter((row) => row.contradiction_probe).length,
      diagnostic_only_items: rows.length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(audit) {
  const checkRows = audit.checks.map((check) => [check.id, String(check.passed), check.detail])
  const categoryRows = audit.category_rows.map((row) => [
    row.category,
    String(row.item_count),
    `${row.evidence_contracts_present}/${row.item_count}`,
    String(row.distractor_or_control_items),
    `${row.insufficiency_items}/${row.citation_overreach_items}`,
    `${row.temporal_items}/${row.contradiction_items}`,
    row.claim_status,
  ])
  const itemRows = audit.item_rows.map((row) => [
    row.item_id,
    row.category,
    row.challenge_type,
    String(row.required_evidence_count),
    String(row.excluded_or_control_evidence_count),
    row.answer_policy,
    row.evidence_contract_status,
  ])

  return `# Hard Grounded Research Evidence Sufficiency Audit

This generated audit makes the benchmark's evidence contract explicit before human adjudication. It checks whether each pilot item has required evidence units, whether each hard category includes a trap or control signal, and whether insufficiency, citation-overreach, temporal, and contradiction probes are represented without allowing completion claims.

## Summary

- Audit ready: ${audit.evidence_sufficiency_audit_ready}
- Version: ${audit.version}
- Pilot items: ${audit.summary.pilot_items}
- Categories: ${audit.summary.categories}
- Items with required evidence contracts: ${audit.summary.items_with_required_evidence_contract}
- Items with distractor or control signals: ${audit.summary.items_with_distractor_or_control_signal}
- Insufficiency items: ${audit.summary.insufficiency_items}
- Citation-overreach items: ${audit.summary.citation_overreach_items}
- Temporal items: ${audit.summary.temporal_items}
- Contradiction items: ${audit.summary.contradiction_items}
- Diagnostic-only items: ${audit.summary.diagnostic_only_items}
- Completion claim allowed: ${audit.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Category Evidence Contracts

${markdownTable(['Category', 'Items', 'Evidence contracts', 'Trap/control items', 'Insufficiency/overreach', 'Temporal/contradiction', 'Claim status'], categoryRows)}

## Item Evidence Contracts

${markdownTable(['Item', 'Category', 'Challenge', 'Required evidence', 'Excluded/control evidence', 'Answer policy', 'Contract status'], itemRows)}
`
}

const audit = buildAudit({
  pilotSuite: readJson(inputs.pilotSuite),
  constructMap: readJson(inputs.constructMap),
  difficultyMechanismLedger: readJson(inputs.difficultyMechanismLedger),
  hypothesisTestMatrix: readJson(inputs.hypothesisTestMatrix),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
})

writeJson(auditJsonPath, audit)
writeText(auditMarkdownPath, renderMarkdown(audit))

console.log(`Wrote hard grounded evidence sufficiency audit to ${auditJsonPath}`)
console.log(`Wrote hard grounded evidence sufficiency audit report to ${auditMarkdownPath}`)
