import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'responsible-use.json')
const reportMarkdownPath = join(experimentDir, 'RESPONSIBLE_USE.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
  licenseClearance: join(generatedDir, 'license-clearance.json'),
  packageManifest: join(generatedDir, 'public-package-manifest.json'),
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

function releaseCheck(releaseGate, id) {
  return releaseGate.checks.find((check) => check.id === id) || { id, passed: false, detail: 'missing' }
}

function buildReport({ spec, releaseGate, paperClaimLedger, licenseClearance, packageManifest, annotationQualityControl }) {
  const policyRules = [
    {
      id: 'no_public_leaderboard_before_gold',
      rule: 'Do not publish a model leaderboard until gold review, merge, category scale, and final novelty gates pass.',
      status: 'active_restriction',
      evidence: [
        releaseCheck(releaseGate, 'gold_review_complete').detail,
        releaseCheck(releaseGate, 'category_scale_ready').detail,
      ],
    },
    {
      id: 'diagnostic_pilot_labeling',
      rule: 'Pilot and fixture results may be reported only as diagnostics, not as final benchmark rankings.',
      status: 'active_restriction',
      evidence: [`${paperClaimLedger.summary.diagnostic_only_claims} diagnostic-only paper claims`],
    },
    {
      id: 'license_sensitive_distribution',
      rule: 'Unknown-license evidence must remain pointer-only or be replaced before public redistribution.',
      status: licenseClearance.public_redistribution_clearance_ready ? 'packaged_clearance_ready' : 'active_restriction',
      evidence: [
        `${packageManifest.pointer_only_items} pointer-only items`,
        `${packageManifest.pointer_only_evidence_units} pointer-only evidence units`,
      ],
    },
    {
      id: 'citation_and_source_attribution',
      rule: 'Every public artifact must preserve upstream dataset IDs, source-row pointers, and license notes.',
      status: 'required',
      evidence: spec.datasets.map((dataset) => `${dataset.id}:${dataset.license || 'unknown'}`),
    },
    {
      id: 'no_high_stakes_decision_use',
      rule: 'The benchmark is for research evaluation of grounded QA systems, not for making medical, legal, financial, climate-policy, or safety decisions.',
      status: 'required',
      evidence: ['dataset card intended-use boundary', 'claim ledger completion_claim_allowed=false'],
    },
    {
      id: 'reviewer_quality_before_release',
      rule: 'Returned labels must satisfy calibration, double-review, citation-support, adjudication, and agreement-reporting controls before release.',
      status: 'required',
      evidence: [
        `${annotationQualityControl.qa_rules.length} annotation quality-control rules`,
        `allow_sentinel_rows_in_gold=${annotationQualityControl.thresholds.allow_sentinel_rows_in_gold}`,
      ],
    },
  ]

  return {
    benchmark_id: spec.id,
    responsible_use_ready: policyRules.length >= 6 && paperClaimLedger.completion_claim_allowed === false,
    completion_claim_allowed: false,
    public_leaderboard_allowed: false,
    generated_from: {
      release_gate: 'generated/release-gate.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
      license_clearance: 'generated/license-clearance.json',
      public_package_manifest: 'generated/public-package-manifest.json',
      annotation_quality_control: 'generated/annotation-quality-control.json',
    },
    summary: {
      policy_rules: policyRules.length,
      active_restrictions: policyRules.filter((rule) => rule.status === 'active_restriction').length,
      required_rules: policyRules.filter((rule) => rule.status === 'required').length,
      public_leaderboard_allowed: false,
      completion_claim_allowed: false,
    },
    policy_rules: policyRules,
  }
}

function renderMarkdown(report) {
  const rows = report.policy_rules.map((rule) => [
    rule.id,
    rule.status,
    rule.rule,
    rule.evidence.join('<br>'),
  ])

  return `# Hard Grounded Research Responsible Use

This generated policy records how the benchmark may be described, packaged, and used while review, scale, and final novelty gates remain incomplete. It is a release-surface guardrail, not evidence that the benchmark is complete.

## Summary

- Responsible-use policy ready: ${report.responsible_use_ready}
- Completion claim allowed: ${report.completion_claim_allowed}
- Public leaderboard allowed: ${report.public_leaderboard_allowed}
- Policy rules: ${report.summary.policy_rules}
- Active restrictions: ${report.summary.active_restrictions}

## Policy Rules

${markdownTable(['Rule id', 'Status', 'Rule', 'Evidence'], rows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  if (!existsSync(path)) throw new Error(`Missing responsible-use input ${name}: ${path}`)
}

const report = buildReport({
  spec: readJson(inputs.spec),
  releaseGate: readJson(inputs.releaseGate),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
  licenseClearance: readJson(inputs.licenseClearance),
  packageManifest: readJson(inputs.packageManifest),
  annotationQualityControl: readJson(inputs.annotationQualityControl),
})

writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded responsible-use JSON to ${reportJsonPath}`)
console.log(`Wrote hard grounded responsible-use report to ${reportMarkdownPath}`)
