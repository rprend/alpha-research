import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'reviewer-faq.json')
const reportMarkdownPath = join(experimentDir, 'REVIEWER_FAQ.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
  noveltyEvidence: join(generatedDir, 'novelty-evidence.json'),
  dataStatement: join(generatedDir, 'data-statement.json'),
  supplementIndex: join(generatedDir, 'supplement-index.json'),
  threatsValidity: join(generatedDir, 'threats-validity.json'),
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
  return releaseGate.checks.find((check) => check.id === id) || { id, passed: false, detail: 'missing' }
}

function buildFaq({ spec, releaseGate, paperClaimLedger, noveltyEvidence, dataStatement, supplementIndex, threatsValidity }) {
  const faq = [
    {
      id: 'is_this_gold_ready',
      question: 'Is the benchmark ready for final leaderboard or category-level claims?',
      answer: 'No. The package is intentionally gated: pilot and fixture results are diagnostic until human gold review, merge, category scale, and final novelty checks pass.',
      evidence: [
        releaseCheck(releaseGate, 'gold_review_complete').detail,
        releaseCheck(releaseGate, 'category_scale_ready').detail,
        `${paperClaimLedger.summary.prohibited_claims} paper claims prohibited until gates pass`,
      ],
    },
    {
      id: 'what_is_novel',
      question: 'What is the novelty claim relative to existing RAG and long-context benchmarks?',
      answer: 'The allowed claim is a taxonomy and package for hard grounded research failures beyond lookup, not that every component task type is new. Multi-hop and faithfulness are included only as parts of a broader document-lifecycle, authority, temporal, insufficiency, entity, contradiction, and conclusion-support surface.',
      evidence: [
        `${noveltyEvidence.allowed_claim_count} allowed novelty claims`,
        `${noveltyEvidence.prohibited_claim_count} prohibited or unsupported novelty framings`,
      ],
    },
    {
      id: 'why_large_corpus',
      question: 'Why is this framed as large-corpus research QA?',
      answer: 'The benchmark tracks source diversity, source acquisition, scaled public candidates, and pointer-only packaging separately from the 30-item pilot. The pilot proves harness mechanics; the scaled artifacts define the paper target and review queue.',
      evidence: [
        `${dataStatement.composition.scaled_public_items} scaled public items`,
        `${dataStatement.composition.source_acquisition_candidates} source acquisition candidates`,
      ],
    },
    {
      id: 'how_are_licenses_handled',
      question: 'How are upstream Hugging Face licenses handled?',
      answer: 'Known-license evidence can be redistributed under the package policy; unknown or mixed-license source text is pointer-only with hashes and locators. The data statement and public package manifest define this boundary.',
      evidence: [
        `${dataStatement.package_policy.pointer_only_items} pointer-only items`,
        `${dataStatement.package_policy.pointer_only_evidence_units} pointer-only evidence units`,
      ],
    },
    {
      id: 'what_should_reviewers_inspect',
      question: 'Which artifacts should reviewers inspect first?',
      answer: 'Start with the supplement index, paper claim ledger, paper tables, data statement, version manifest, and release gate. These map claims to evidence and make blocked claims explicit.',
      evidence: [
        `${supplementIndex.summary.sections} supplement sections`,
        `${supplementIndex.summary.paper_tables} paper tables`,
        `${releaseGate.checks.filter((check) => !check.passed).length} active release blockers`,
      ],
    },
    {
      id: 'main_risks',
      question: 'What are the main residual risks?',
      answer: 'The main risks are construct validity before human review, statistical power before category scale, external validity across source domains, novelty drift, and measurement validity for citation and conclusion support.',
      evidence: [
        `${threatsValidity.summary.threat_count} tracked validity threats`,
        `${threatsValidity.summary.high_severity_count} high-severity threats`,
      ],
    },
  ]

  return {
    benchmark_id: spec.id,
    reviewer_faq_ready:
      faq.length >= 6 &&
      releaseGate.checks.some((check) => !check.passed) &&
      paperClaimLedger.completion_claim_allowed === false &&
      noveltyEvidence.completion_claim_allowed === false,
    version: 'reviewer-faq-v1',
    generated_from: {
      release_gate: 'generated/release-gate.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
      novelty_evidence: 'generated/novelty-evidence.json',
      data_statement: 'generated/data-statement.json',
      supplement_index: 'generated/supplement-index.json',
      threats_validity: 'generated/threats-validity.json',
    },
    questions: faq,
    summary: {
      questions: faq.length,
      release_blockers: releaseGate.checks.filter((check) => !check.passed).length,
      prohibited_claims: paperClaimLedger.summary.prohibited_claims,
      high_severity_threats: threatsValidity.summary.high_severity_count,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(report) {
  const rows = report.questions.map((entry) => [
    entry.id,
    entry.question,
    entry.answer,
    entry.evidence.join('<br>'),
  ])

  return `# Hard Grounded Research Reviewer FAQ

This generated FAQ anticipates common reviewer objections and maps each answer to current artifacts. It is a reviewer-navigation artifact, not a claim that the benchmark is complete.

## Summary

- Reviewer FAQ ready: ${report.reviewer_faq_ready}
- Version: ${report.version}
- Questions: ${report.summary.questions}
- Active release blockers: ${report.summary.release_blockers}
- Prohibited claims: ${report.summary.prohibited_claims}
- High-severity threats: ${report.summary.high_severity_threats}
- Completion claim allowed: ${report.summary.completion_claim_allowed}

## Questions

${markdownTable(['ID', 'Question', 'Answer', 'Evidence'], rows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  if (!existsSync(path)) throw new Error(`Missing reviewer-faq input ${name}: ${path}`)
}

const report = buildFaq({
  spec: readJson(inputs.spec),
  releaseGate: readJson(inputs.releaseGate),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
  noveltyEvidence: readJson(inputs.noveltyEvidence),
  dataStatement: readJson(inputs.dataStatement),
  supplementIndex: readJson(inputs.supplementIndex),
  threatsValidity: readJson(inputs.threatsValidity),
})

writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded reviewer FAQ JSON to ${reportJsonPath}`)
console.log(`Wrote hard grounded reviewer FAQ report to ${reportMarkdownPath}`)
