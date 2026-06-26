import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'review-return-preflight.json')
const reportMarkdownPath = join(experimentDir, 'REVIEW_RETURN_PREFLIGHT.md')

const inputs = {
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
  reviewReturnContract: join(generatedDir, 'review-return-contract.json'),
  annotationImport: join(generatedDir, 'annotation-import/report.json'),
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

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function expectedReturnName(exportFile) {
  return exportFile.split('/').pop().replace(/\.jsonl$/, '.returned.jsonl')
}

function buildPreflight({ annotationExport, reviewReturnContract, annotationImport }) {
  const inputDirRelative = reviewReturnContract.return_contract.input_dir
  const inputDir = join(root, inputDirRelative)
  const returnedDirExists = existsSync(inputDir)
  const actualNames = returnedDirExists
    ? readdirSync(inputDir).filter((name) => name.endsWith('.jsonl')).sort()
    : []
  const actualNameSet = new Set(actualNames)
  const expectedFiles = annotationExport.files.map((file) => {
    const expectedName = expectedReturnName(file.file)
    const returnedPath = join(inputDir, expectedName)
    const present = actualNameSet.has(expectedName)
    return {
      expected_return_file: expectedName,
      source_export_file: file.file,
      scope: file.scope,
      category: file.category,
      reviewer_slot: file.reviewer_slot,
      expected_rows: file.expected_return_row_count,
      present,
      returned_sha256: present ? sha256File(returnedPath) : null,
      preflight_status: present ? 'ready_for_import_dry_run' : 'missing_return',
    }
  })
  const expectedNameSet = new Set(expectedFiles.map((file) => file.expected_return_file))
  const unexpectedFiles = actualNames.filter((name) => !expectedNameSet.has(name))
  const missingFiles = expectedFiles.filter((file) => !file.present)
  const presentFiles = expectedFiles.filter((file) => file.present)
  const expectedRows = expectedFiles.reduce((sum, file) => sum + file.expected_rows, 0)
  const presentRows = presentFiles.reduce((sum, file) => sum + file.expected_rows, 0)
  const checks = [
    {
      id: 'return_directory_present',
      passed: returnedDirExists,
      detail: returnedDirExists ? inputDirRelative : `missing ${inputDirRelative}`,
    },
    {
      id: 'expected_return_files_present',
      passed: missingFiles.length === 0,
      detail: `${presentFiles.length}/${expectedFiles.length} expected returned files present`,
    },
    {
      id: 'no_unexpected_return_files',
      passed: unexpectedFiles.length === 0,
      detail: unexpectedFiles.length ? unexpectedFiles.join(', ') : 'no unexpected JSONL files',
    },
    {
      id: 'import_report_matches_current_returns',
      passed:
        annotationImport.returned_files_found === presentFiles.length &&
        annotationImport.expected_files === expectedFiles.length,
      detail: `${annotationImport.returned_files_found}/${annotationImport.expected_files} files in latest import report; ${presentFiles.length}/${expectedFiles.length} files on disk`,
    },
  ]

  return {
    review_return_preflight_ready:
      reviewReturnContract.review_return_contract_ready === true &&
      expectedFiles.length === reviewReturnContract.summary.expected_return_files &&
      expectedRows === reviewReturnContract.summary.expected_return_rows &&
      checks.length === 4,
    version: 'review-return-preflight-v1',
    completion_claim_allowed: false,
    generated_from: {
      annotation_export: 'generated/annotation-export/manifest.json',
      review_return_contract: 'generated/review-return-contract.json',
      annotation_import: 'generated/annotation-import/report.json',
    },
    input_dir: inputDirRelative,
    commands: {
      dry_run: reviewReturnContract.return_contract.dry_run_command,
      apply_after_clean_dry_run: reviewReturnContract.return_contract.apply_command,
    },
    checks,
    expected_files: expectedFiles,
    missing_files: missingFiles.map((file) => file.expected_return_file),
    unexpected_files: unexpectedFiles,
    summary: {
      expected_return_files: expectedFiles.length,
      present_return_files: presentFiles.length,
      missing_return_files: missingFiles.length,
      unexpected_return_files: unexpectedFiles.length,
      expected_return_rows: expectedRows,
      present_return_rows: presentRows,
      latest_import_ready: Boolean(annotationImport.annotation_import_ready),
      latest_import_findings: annotationImport.finding_count,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(report) {
  const checkRows = report.checks.map((check) => [
    check.id,
    String(check.passed),
    check.detail,
  ])
  const fileRows = report.expected_files.map((file) => [
    file.expected_return_file,
    file.scope,
    file.category,
    file.reviewer_slot,
    String(file.expected_rows),
    String(file.present),
    file.preflight_status,
  ])

  return `# Hard Grounded Research Review Return Preflight

This generated preflight records whether real reviewer-return packets are present before import or apply. It is an operational readiness report, not evidence that human review, merge, gold promotion, scale, or novelty gates are complete.

## Summary

- Review return preflight ready: ${report.review_return_preflight_ready}
- Version: ${report.version}
- Input directory: \`${report.input_dir}\`
- Expected return files: ${report.summary.expected_return_files}
- Present return files: ${report.summary.present_return_files}
- Missing return files: ${report.summary.missing_return_files}
- Unexpected return files: ${report.summary.unexpected_return_files}
- Expected return rows: ${report.summary.expected_return_rows}
- Present return rows: ${report.summary.present_return_rows}
- Latest import ready: ${report.summary.latest_import_ready}
- Latest import findings: ${report.summary.latest_import_findings}
- Completion claim allowed: ${report.summary.completion_claim_allowed}

## Commands

- Dry run: \`${report.commands.dry_run}\`
- Apply after clean dry run: \`${report.commands.apply_after_clean_dry_run}\`

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Expected Return Files

${markdownTable(['Return file', 'Scope', 'Category', 'Reviewer', 'Rows', 'Present', 'Status'], fileRows)}
`
}

const report = buildPreflight({
  annotationExport: readJson(inputs.annotationExport),
  reviewReturnContract: readJson(inputs.reviewReturnContract),
  annotationImport: readJson(inputs.annotationImport),
})

writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded review return preflight to ${reportJsonPath}`)
console.log(`Wrote hard grounded review return preflight report to ${reportMarkdownPath}`)
