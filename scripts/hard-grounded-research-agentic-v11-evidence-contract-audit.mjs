import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const candidateDir = join(experimentDir, 'generated/agentic-v11-candidate')
const workspaceRoot = join(candidateDir, 'workspaces')
const hiddenGoldPath = join(candidateDir, 'hidden-gold.json')
const auditPath = join(candidateDir, 'audit.json')
const outputPath = join(candidateDir, 'evidence-contract-audit.json')
const markdownPath = join(experimentDir, 'AGENTIC_V11_EVIDENCE_CONTRACT_AUDIT.md')
const candidateMarkdownPath = join(experimentDir, 'AGENTIC_V11_CANDIDATE.md')

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

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isSynthetic(doc) {
  return doc.provenance?.source_type === 'deterministic_public_corpus_transform'
}

function hasMarkerShortcut(text) {
  return /\bHGR-[a-f0-9]{8,12}\b/i.test(String(text)) || /Task marker:|Marker role:/i.test(String(text))
}

function visibleControlShortcutMatches(text) {
  const value = String(text)
  const patterns = [
    /\bDocument section:\s*(?:appendix update|original body)\b/i,
    /\bInstruction:\s*(?:appended update controls final answer|original body is superseded by appendix update)\b/i,
    /\bLifecycle note:\s*(?:latest record controls|superseded by a later record)\b/i,
    /\bAuthority tier:\s*(?:expert reviewed source|community summary)\b/i,
    /\bTemporal rule:\s*(?:valid as of requested date|exclude after)\b/i,
    /\bSame-authority document [AB]\b/i,
  ]
  return patterns.filter((pattern) => pattern.test(value)).map((pattern) => pattern.source)
}

function extractionFieldShortcutMatches(text) {
  const value = String(text)
  const patterns = [
    /^Locator hint:/im,
    /^Native response:/im,
    /^Evidence preview:/im,
    /\|\|\s*answer:/i,
    /\|\|\s*answers:/i,
    /^question:\s/im,
    /^answer:\s/im,
  ]
  return patterns.filter((pattern) => pattern.test(value)).map((pattern) => pattern.source)
}

function hasRawProvenanceLeak(doc) {
  const provenance = doc.provenance || {}
  return ['source_dataset', 'source_row_id', 'hf_row_idx', 'viewer'].some((key) => Object.hasOwn(provenance, key))
}

function answerLeakCount(corpus, gold) {
  const rawExpected = String(gold.expected_answers?.[0] ?? '')
  const expected = normalize(rawExpected)
  if (!expected || expected === 'abstain' || expected === 'conflict') return 0
  const required = new Set(gold.required_evidence_ids || [])
  const answerParts = rawExpected
    .split(/\s+(?:=>|@|<>)\s+/)
    .map((part) => normalize(part))
    .filter((part) => part.length >= 3)
  return corpus.documents.filter((doc) => {
    if (required.has(doc.document_id)) return false
    const text = normalize(doc.text)
    return answerParts.length > 0 ? answerParts.some((part) => text.includes(part)) : text.includes(expected)
  }).length
}

const hiddenGold = readJson(hiddenGoldPath)
const goldByTask = new Map(hiddenGold.tasks.map((entry) => [entry.task_id, entry.gold]))
const taskDirs = readdirSync(workspaceRoot).filter((name) => name.startsWith('hgr_v11_candidate_')).sort()
const taskAudits = []

for (const taskDir of taskDirs) {
  const task = readJson(join(workspaceRoot, taskDir, 'task.json'))
  const corpus = readJson(join(workspaceRoot, taskDir, 'corpus.json'))
  const gold = goldByTask.get(task.task_id)
  const required = new Set(gold.required_evidence_ids || [])
  const requiredDocs = corpus.documents.filter((doc) => required.has(doc.document_id))
  const markerShortcutDocs = corpus.documents.filter((doc) => hasMarkerShortcut(doc.text))
  const controlShortcutDocs = corpus.documents
    .map((doc) => ({ doc, matches: visibleControlShortcutMatches(doc.text) }))
    .filter((entry) => entry.matches.length > 0)
  const extractionShortcutDocs = corpus.documents
    .map((doc) => ({ doc, matches: extractionFieldShortcutMatches(doc.text) }))
    .filter((entry) => entry.matches.length > 0)
  const rawProvenanceLeakDocs = corpus.documents.filter(hasRawProvenanceLeak)
  const syntheticRequiredDocs = requiredDocs.filter(isSynthetic)
  const rawExpected = String(gold.expected_answers?.[0] ?? '')
  const expected = normalize(rawExpected)
  const expectedParts = rawExpected
    .split(/\s+(?:=>|@|<>)\s+/)
    .map((part) => normalize(part))
    .filter((part) => part.length >= 3)
  const requiredDocsContainExpected =
    expected === 'abstain' || expected === 'conflict'
      ? true
      : expectedParts.length > 0
        ? expectedParts.every((part) => requiredDocs.some((doc) => normalize(doc.text).includes(part)))
        : requiredDocs.some((doc) => normalize(doc.text).includes(expected.split(' ').slice(0, 8).join(' ')))
  const leaks = answerLeakCount(corpus, gold)

  const findings = []
  if (hasMarkerShortcut(task.user_question)) findings.push('question_contains_marker_shortcut')
  if (markerShortcutDocs.length > 0) findings.push('corpus_contains_marker_or_role_shortcut')
  if (visibleControlShortcutMatches(task.user_question).length > 0) findings.push('question_contains_visible_control_shortcut')
  if (controlShortcutDocs.length > 0) findings.push('corpus_contains_visible_control_shortcut')
  if (extractionFieldShortcutMatches(task.user_question).length > 0) findings.push('question_contains_extraction_field_shortcut')
  if (extractionShortcutDocs.length > 0) findings.push('corpus_contains_extraction_field_shortcut')
  if (rawProvenanceLeakDocs.length > 0) findings.push('public_raw_provenance_leak')
  if (syntheticRequiredDocs.length > 0) findings.push('required_evidence_uses_synthetic_control_document')
  if (!requiredDocsContainExpected) findings.push('required_evidence_does_not_contain_answer_surface')
  if (leaks > 0) findings.push('expected_answer_appears_in_non_required_documents')

  taskAudits.push({
    task_id: task.task_id,
    category: task.category,
    corpus_documents: corpus.documents.length,
    marker_shortcut_document_count: markerShortcutDocs.length,
    visible_control_shortcut_document_count: controlShortcutDocs.length,
    extraction_field_shortcut_document_count: extractionShortcutDocs.length,
    visible_control_shortcut_examples: controlShortcutDocs.slice(0, 5).map((entry) => ({
      document_id: entry.doc.document_id,
      matches: entry.matches,
    })),
    required_evidence_count: required.size,
    required_synthetic_count: syntheticRequiredDocs.length,
    public_raw_provenance_leak_count: rawProvenanceLeakDocs.length,
    non_required_exact_answer_leak_count: leaks,
    findings,
    pass: findings.length === 0,
  })
}

const byCategory = Object.fromEntries(
  [...new Set(taskAudits.map((task) => task.category))].map((category) => {
    const rows = taskAudits.filter((task) => task.category === category)
    const syntheticRequired = rows.reduce((sum, row) => sum + row.required_synthetic_count, 0)
    const required = rows.reduce((sum, row) => sum + row.required_evidence_count, 0)
    return [
      category,
      {
        task_count: rows.length,
        pass_count: rows.filter((row) => row.pass).length,
        finding_count: rows.reduce((sum, row) => sum + row.findings.length, 0),
        required_synthetic_rate: required === 0 ? 0 : Number((syntheticRequired / required).toFixed(4)),
      },
    ]
  }),
)

const findingCounts = {}
for (const row of taskAudits) {
  for (const finding of row.findings) findingCounts[finding] = (findingCounts[finding] || 0) + 1
}

const report = {
  report_id: 'agentic-v11-candidate-evidence-contract-audit',
  suite_id: hiddenGold.suite_id,
  checked_date: '2026-06-27',
  task_count: taskAudits.length,
  pass_count: taskAudits.filter((row) => row.pass).length,
  fail_count: taskAudits.filter((row) => !row.pass).length,
  buyer_gate_passed: taskAudits.every((row) => row.pass),
  gates: {
    no_public_raw_provenance_leaks: taskAudits.every((row) => row.public_raw_provenance_leak_count === 0),
    no_public_marker_or_role_shortcuts: taskAudits.every((row) => row.marker_shortcut_document_count === 0),
    no_public_visible_control_shortcuts: taskAudits.every((row) => row.visible_control_shortcut_document_count === 0),
    no_public_extraction_field_shortcuts: taskAudits.every((row) => row.extraction_field_shortcut_document_count === 0),
    no_required_synthetic_control_documents: taskAudits.every((row) => row.required_synthetic_count === 0),
    no_non_required_exact_answer_leaks: taskAudits.every((row) => row.non_required_exact_answer_leak_count === 0),
  },
  finding_counts: findingCounts,
  by_category: byCategory,
  failing_task_ids: taskAudits.filter((row) => !row.pass).map((row) => row.task_id),
  task_audits: taskAudits,
}

writeJson(outputPath, report)

const audit = readJson(auditPath)
audit.evidence_contract_audit = {
  report_path: 'generated/agentic-v11-candidate/evidence-contract-audit.json',
  pass_count: report.pass_count,
  fail_count: report.fail_count,
  buyer_gate_passed: report.buyer_gate_passed,
  gates: report.gates,
}
audit.checks.evidence_contract_audit_passed = report.buyer_gate_passed
audit.status = report.buyer_gate_passed ? audit.status : 'candidate_not_buyer_ready'
audit.reason = report.buyer_gate_passed
  ? audit.reason
  : 'This v11 candidate still fails automated evidence-contract audit gates.'
audit.blockers = [
  ...(report.buyer_gate_passed
    ? []
    : [
        `Rewrite ${report.fail_count} v11 tasks that fail the evidence-contract audit.`,
      ]),
  ...audit.blockers.filter((blocker) => !blocker.startsWith('Audit evidence contracts')),
].filter((blocker) => !report.buyer_gate_passed || !/^Rewrite \d+ v11 tasks that fail the evidence-contract audit\./.test(blocker))
writeJson(auditPath, audit)

writeText(
  markdownPath,
  `# Agentic V11 Evidence Contract Audit

This audit checks whether v11 task workspaces have inspectable evidence contracts without leaking hidden gold, marker-role shortcuts, visible control-label shortcuts, or synthetic required evidence.

## Result

- Tasks: ${report.task_count}
- Passed: ${report.pass_count}
- Failed: ${report.fail_count}
- Buyer gate passed: ${report.buyer_gate_passed}

## Gates

| Gate | Pass |
| --- | --- |
${Object.entries(report.gates)
  .map(([key, value]) => `| ${key} | ${value} |`)
  .join('\n')}

## Finding Counts

| Finding | Count |
| --- | ---: |
${Object.entries(report.finding_counts)
  .map(([key, value]) => `| ${key} | ${value} |`)
  .join('\n')}

## By Category

| Category | Tasks | Passed | Findings | Required synthetic rate |
| --- | ---: | ---: | ---: | ---: |
${Object.entries(report.by_category)
  .map(([category, row]) => `| ${category} | ${row.task_count} | ${row.pass_count} | ${row.finding_count} | ${row.required_synthetic_rate} |`)
  .join('\n')}
`,
)

writeText(
  candidateMarkdownPath,
  `# Agentic V11 Candidate Suite

This candidate suite removes the v4 exact marker and public role-label shortcuts.

## Status

- Status: ${audit.status}
- Buyer ready: ${audit.buyer_ready}
- Tasks: ${audit.summary.task_count}
- Categories: ${audit.summary.categories}
- Unique native questions: ${audit.summary.unique_native_questions}/150
- Corpus documents per task: ${audit.summary.min_corpus_documents}-${audit.summary.max_corpus_documents}
- Source rows available: ${audit.summary.source_rows_available}
- Redistributable preview rows: ${audit.summary.redistributable_preview_rows_available}
- Pointer-only rows: ${audit.summary.pointer_only_rows_available}
- Shallow baseline solved: ${audit.shallow_baseline?.solved_count ?? 'not run'}/${audit.summary.task_count}
- Evidence contract audit failed: ${report.fail_count}/${report.task_count}

## Checks

| Check | Pass |
| --- | --- |
${Object.entries(audit.checks)
  .map(([key, value]) => `| ${key} | ${value} |`)
  .join('\n')}

## Blockers

${audit.blockers.map((blocker) => `- ${blocker}`).join('\n')}
`,
)

console.log(`Wrote ${outputPath}`)
console.log(`Updated ${auditPath}`)
console.log(`Wrote ${markdownPath}`)
console.log(`Updated ${candidateMarkdownPath}`)
