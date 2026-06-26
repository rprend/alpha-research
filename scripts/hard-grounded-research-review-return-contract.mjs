import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const contractJsonPath = join(generatedDir, 'review-return-contract.json')
const contractMarkdownPath = join(experimentDir, 'REVIEW_RETURN_CONTRACT.md')

const inputs = {
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
  annotationImport: join(generatedDir, 'annotation-import/report.json'),
  annotationImportSmoke: join(generatedDir, 'annotation-import-smoke/report.json'),
  reviewerHandoff: join(generatedDir, 'reviewer-handoff.json'),
  reviewPacketAudit: join(generatedDir, 'review-packet-audit.json'),
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

function returnedName(exportFile) {
  return exportFile.split('/').pop().replace(/\.jsonl$/, '.returned.jsonl')
}

function buildContract({
  annotationExport,
  annotationImport,
  annotationImportSmoke,
  reviewerHandoff,
  reviewPacketAudit,
}) {
  const requiredFields = annotationExport.import_contract.required_fields
  const files = annotationExport.files.map((file) => ({
    export_file: file.file,
    expected_return_file: returnedName(file.file),
    scope: file.scope,
    workbook_id: file.workbook_id,
    reviewer_slot: file.reviewer_slot,
    category: file.category,
    expected_rows: file.expected_return_row_count,
    required_reviewer_fields: file.required_return_fields,
    expansion_required_fields: file.scope === 'expansion_review' ? ['category_fit', 'generation_defect'] : [],
  }))
  const rejectionRules = [
    {
      id: 'missing_or_extra_return_file',
      rejects: 'Any missing expected returned file, unexpected filename, or changed row count.',
    },
    {
      id: 'immutable_field_changed',
      rejects: 'Any change outside reviewer_fields, including item metadata, evidence units, rubric, quality findings, or source workbook identity.',
    },
    {
      id: 'missing_required_reviewer_field',
      rejects: `Any row missing one of: ${requiredFields.join(', ')}.`,
    },
    {
      id: 'invalid_label_or_citation_policy',
      rejects: 'Unsupported final_label values, unsupported citations, missing citations for supported/refuted/conflict labels, or citations on insufficient/invalid labels.',
    },
    {
      id: 'fixture_annotation_rejected',
      rejects: 'Fixture rows in real returned packets; fixtures require --allow-fixture and must never be applied.',
    },
    {
      id: 'expansion_field_missing',
      rejects: 'Expansion rows missing category_fit or generation_defect.',
    },
  ]

  const findings = []
  if (!annotationExport.export_ready) findings.push('annotation export is not ready')
  if (!annotationExport.return_readiness?.ready) findings.push('annotation export return readiness is not ready')
  if (!reviewerHandoff.handoff_ready) findings.push('reviewer handoff is not ready')
  if (!reviewPacketAudit.review_packet_audit_ready) findings.push('review packet audit is not ready')
  if (!annotationImport.annotation_import_ready) findings.push('annotation import dry-run path is not ready')
  if (annotationImport.apply_requested) findings.push('annotation import report unexpectedly requested apply')
  if (!annotationImportSmoke.smoke_ready && !annotationImportSmoke.annotation_import_smoke_ready) findings.push('annotation import smoke is not ready')
  if (files.length !== annotationExport.return_readiness.expected_files) findings.push('return file count does not match export return readiness')
  if (files.reduce((sum, file) => sum + file.expected_rows, 0) !== annotationExport.return_readiness.expected_rows) findings.push('return row count does not match export return readiness')

  return {
    review_return_contract_ready: findings.length === 0,
    version: 'review-return-contract-v1',
    completion_claim_allowed: false,
    generated_from: {
      annotation_export: 'generated/annotation-export/manifest.json',
      annotation_import: 'generated/annotation-import/report.json',
      annotation_import_smoke: 'generated/annotation-import-smoke/report.json',
      reviewer_handoff: 'generated/reviewer-handoff.json',
      review_packet_audit: 'generated/review-packet-audit.json',
    },
    return_contract: {
      input_dir: 'docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns',
      dry_run_command: 'node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns',
      apply_command: 'node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns --apply',
      editable_path: annotationExport.import_contract.editable_path,
      required_reviewer_fields: requiredFields,
      reviewer_must_not_edit: annotationExport.import_contract.reviewer_must_not_edit,
      expected_return_files: annotationExport.return_readiness.expected_files,
      expected_return_rows: annotationExport.return_readiness.expected_rows,
    },
    rejection_rules: rejectionRules,
    expected_files: files,
    findings,
    summary: {
      expected_return_files: files.length,
      expected_return_rows: files.reduce((sum, file) => sum + file.expected_rows, 0),
      pilot_return_files: files.filter((file) => file.scope === 'pilot_review').length,
      pilot_return_rows: files.filter((file) => file.scope === 'pilot_review').reduce((sum, file) => sum + file.expected_rows, 0),
      expansion_return_files: files.filter((file) => file.scope === 'expansion_review').length,
      expansion_return_rows: files.filter((file) => file.scope === 'expansion_review').reduce((sum, file) => sum + file.expected_rows, 0),
      rejection_rule_count: rejectionRules.length,
      finding_count: findings.length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(contract) {
  const fileRows = contract.expected_files.map((file) => [
    file.expected_return_file,
    file.scope,
    file.category,
    file.reviewer_slot,
    String(file.expected_rows),
    file.expansion_required_fields.length ? file.expansion_required_fields.join(', ') : 'n/a',
  ])
  const ruleRows = contract.rejection_rules.map((rule) => [rule.id, rule.rejects])
  const findingRows = contract.findings.map((finding) => ['finding', finding])

  return `# Hard Grounded Research Review Return Contract

This generated contract defines the required shape of real returned reviewer packets before they can be imported into pilot or expansion review workbooks. It does not contain returned human labels and does not clear review, merge, gold, scale, or novelty blockers.

## Summary

- Review return contract ready: ${contract.review_return_contract_ready}
- Version: ${contract.version}
- Expected return files: ${contract.summary.expected_return_files}
- Expected return rows: ${contract.summary.expected_return_rows}
- Pilot return files/rows: ${contract.summary.pilot_return_files}/${contract.summary.pilot_return_rows}
- Expansion return files/rows: ${contract.summary.expansion_return_files}/${contract.summary.expansion_return_rows}
- Rejection rules: ${contract.summary.rejection_rule_count}
- Findings: ${contract.summary.finding_count}
- Completion claim allowed: ${contract.summary.completion_claim_allowed}

## Commands

- Dry run: \`${contract.return_contract.dry_run_command}\`
- Apply after clean dry run: \`${contract.return_contract.apply_command}\`

## Field Contract

- Editable path: \`${contract.return_contract.editable_path}\`
- Required reviewer fields: ${contract.return_contract.required_reviewer_fields.join(', ')}
- Reviewers must not edit: ${contract.return_contract.reviewer_must_not_edit.join(', ')}

## Expected Return Files

${markdownTable(['Return file', 'Scope', 'Category', 'Reviewer', 'Rows', 'Expansion-only fields'], fileRows)}

## Rejection Rules

${markdownTable(['Rule', 'Rejects'], ruleRows)}

## Findings

${findingRows.length ? markdownTable(['Type', 'Finding'], findingRows) : 'No review return contract findings.'}
`
}

const contract = buildContract({
  annotationExport: readJson(inputs.annotationExport),
  annotationImport: readJson(inputs.annotationImport),
  annotationImportSmoke: readJson(inputs.annotationImportSmoke),
  reviewerHandoff: readJson(inputs.reviewerHandoff),
  reviewPacketAudit: readJson(inputs.reviewPacketAudit),
})

writeJson(contractJsonPath, contract)
writeText(contractMarkdownPath, renderMarkdown(contract))
