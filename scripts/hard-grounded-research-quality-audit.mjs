import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const auditJsonPath = join(generatedDir, 'item-quality-audit.json')
const auditMarkdownPath = join(experimentDir, 'ITEM_QUALITY_AUDIT.md')

const categoriesRequiringChallenge = new Set([
  'stale-vs-current document conflicts',
  'appended document lifecycle changes',
  'source authority conflicts',
  'evidence insufficiency / abstention',
  'citation supports fact but not conclusion',
  'temporal questions: as of date X',
  'cross-document contradiction',
])

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

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function evidenceUnits(item) {
  return item.source_examples.flatMap((source) => source.evidence_units || [])
}

function sourceDatasets(item) {
  return unique(item.source_examples.map((source) => source.source_dataset))
}

function evidenceText(item) {
  return normalize(evidenceUnits(item).map((unit) => unit.text).join(' '))
}

function answerTokens(answer) {
  return normalize(answer)
    .split(/\s+/)
    .filter((token) => token.length > 2)
}

function answerSupportRisk(item) {
  const answer = normalize(item.expected_answer)
  if (!answer || answer === 'abstain' || answer === 'conflict') return null
  const text = evidenceText(item)
  if (text.includes(answer)) return null
  const tokens = answerTokens(answer)
  if (tokens.length === 0) return null
  const covered = tokens.filter((token) => text.includes(token)).length
  if (covered / tokens.length >= 0.8) return null
  return {
    code: 'expected_answer_not_lexically_visible',
    severity: 'medium',
    detail: 'Expected answer is not directly visible in the provided evidence text; reviewer should verify inference support.',
  }
}

function itemFindings(item) {
  const findings = []
  const evidenceCount = evidenceUnits(item).length
  const datasets = sourceDatasets(item)
  const challenge = item.challenge

  if (evidenceCount === 0) {
    findings.push({ code: 'no_evidence_units', severity: 'high', detail: 'Item has no evidence units.' })
  }
  if (evidenceCount < 2 && item.category !== 'appended document lifecycle changes') {
    findings.push({
      code: 'low_evidence_count',
      severity: 'medium',
      detail: `Item has only ${evidenceCount} evidence unit(s), which may under-test large-corpus grounding.`,
    })
  }
  if (categoriesRequiringChallenge.has(item.category) && !challenge) {
    findings.push({
      code: 'missing_challenge_payload',
      severity: 'high',
      detail: 'Hard category requires an explicit challenge payload.',
    })
  }
  if (challenge && item.transform !== 'adversarial_wrapper') {
    findings.push({
      code: 'challenge_without_adversarial_transform',
      severity: 'low',
      detail: 'Item has a challenge payload but transform metadata is not adversarial_wrapper.',
    })
  }
  if (item.construction === 'composed_corpus_suite' && datasets.length < 2) {
    findings.push({
      code: 'composed_without_multiple_datasets',
      severity: 'medium',
      detail: 'Composed construction should include evidence from at least two datasets.',
    })
  }
  if (datasets.length > 1 && item.transform === 'native_row') {
    findings.push({
      code: 'native_row_with_mixed_sources',
      severity: 'medium',
      detail: 'Native-row task mixes source datasets; reviewer should confirm the added source is necessary rather than a distractor artifact.',
    })
  }
  if (challenge?.type === 'document_lifecycle_appendix' && evidenceCount < 2) {
    findings.push({
      code: 'lifecycle_without_appendix_evidence',
      severity: 'high',
      detail: 'Lifecycle challenge should expose both original and appended/superseding evidence.',
    })
  }
  if (challenge?.type === 'stale_current_conflict' && !challenge.current_document?.synthetic_date) {
    findings.push({
      code: 'stale_current_missing_current_date',
      severity: 'high',
      detail: 'Stale/current challenge is missing the controlling current date.',
    })
  }
  const supportRisk = answerSupportRisk(item)
  if (supportRisk) findings.push(supportRisk)

  return findings
}

function priority(findings) {
  if (findings.some((finding) => finding.severity === 'high')) return 'repair_before_gold'
  if (findings.some((finding) => finding.severity === 'medium')) return 'review_carefully'
  return 'standard_review'
}

function summarize(items) {
  const auditedItems = items.map((item) => {
    const findings = itemFindings(item)
    return {
      item_id: item.id,
      category: item.category,
      construction: item.construction,
      transform: item.transform,
      challenge_type: item.challenge?.type || 'native_row',
      evidence_count: evidenceUnits(item).length,
      source_datasets: sourceDatasets(item),
      review_priority: priority(findings),
      findings,
    }
  })
  const byCategory = Object.fromEntries(
    unique(items.map((item) => item.category)).map((category) => {
      const categoryItems = auditedItems.filter((item) => item.category === category)
      return [
        category,
        {
          total: categoryItems.length,
          repair_before_gold: categoryItems.filter((item) => item.review_priority === 'repair_before_gold').length,
          review_carefully: categoryItems.filter((item) => item.review_priority === 'review_carefully').length,
          standard_review: categoryItems.filter((item) => item.review_priority === 'standard_review').length,
        },
      ]
    }),
  )
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    source_suite: 'generated/pilot-suite.json',
    total_items: auditedItems.length,
    repair_before_gold: auditedItems.filter((item) => item.review_priority === 'repair_before_gold').length,
    review_carefully: auditedItems.filter((item) => item.review_priority === 'review_carefully').length,
    standard_review: auditedItems.filter((item) => item.review_priority === 'standard_review').length,
    by_category: byCategory,
    findings_by_item: auditedItems,
  }
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function renderMarkdown(audit) {
  const categoryRows = Object.entries(audit.by_category).map(([category, summary]) => [
    category,
    String(summary.total),
    String(summary.repair_before_gold),
    String(summary.review_carefully),
    String(summary.standard_review),
  ])
  const repairRows = audit.findings_by_item
    .filter((item) => item.review_priority !== 'standard_review')
    .slice(0, 20)
    .map((item) => [
      item.item_id,
      item.category,
      item.review_priority,
      item.findings.map((finding) => `${finding.severity}:${finding.code}`).join('<br>'),
    ])

  return `# Hard Grounded Research Item Quality Audit

This audit is generated from \`generated/pilot-suite.json\`. It is a pre-adjudication repair queue, not a gold-data verdict.

## Summary

- Items: ${audit.total_items}
- Repair before gold: ${audit.repair_before_gold}
- Review carefully: ${audit.review_carefully}
- Standard review: ${audit.standard_review}

## Category Summary

${markdownTable(['Category', 'Items', 'Repair before gold', 'Review carefully', 'Standard review'], categoryRows)}

## Repair Queue

${markdownTable(['Item', 'Category', 'Priority', 'Findings'], repairRows)}

## Interpretation

Items marked \`repair_before_gold\` should not be promoted to gold labels until the cited issue is fixed or explicitly waived in reviewer notes. Items marked \`review_carefully\` can still become gold, but the reviewer should verify that the evidence really tests the intended hard-grounded category.
`
}

if (!existsSync(pilotSuitePath)) throw new Error(`Missing pilot suite: ${pilotSuitePath}`)
const pilotSuite = readJson(pilotSuitePath)
const audit = summarize(pilotSuite.items)
writeJson(auditJsonPath, audit)
writeText(auditMarkdownPath, renderMarkdown(audit))

console.log(`Wrote item quality audit JSON to ${auditJsonPath}`)
console.log(`Wrote item quality audit report to ${auditMarkdownPath}`)
