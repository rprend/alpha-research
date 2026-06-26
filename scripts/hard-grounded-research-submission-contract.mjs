import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'submission-contract.json')
const reportMarkdownPath = join(experimentDir, 'SUBMISSION_CONTRACT.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  modelBaselinePackets: join(generatedDir, 'model-baseline-packets.json'),
  responsibleUse: join(generatedDir, 'responsible-use.json'),
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

function buildReport({ spec, pilotSuite, modelBaselinePackets, responsibleUse }) {
  const taskIds = pilotSuite.items.map((item) => item.id)
  const answerFields = [
    {
      field: 'task_id',
      type: 'string',
      required: true,
      rule: 'Must match exactly one released task id.',
    },
    {
      field: 'answer',
      type: 'string',
      required: true,
      rule: 'Natural language final answer or ABSTAIN.',
    },
    {
      field: 'citations',
      type: 'array<string>',
      required: true,
      rule: 'Citation ids must come from the task evidence units; empty only for abstention or invalid output.',
    },
    {
      field: 'abstained',
      type: 'boolean',
      required: true,
      rule: 'True only when the system intentionally refuses to answer due to insufficient or conflicting evidence.',
    },
    {
      field: 'confidence',
      type: 'number',
      required: false,
      rule: 'Optional calibrated confidence in [0, 1].',
    },
    {
      field: 'evidence_assessment',
      type: 'string',
      required: true,
      rule: 'Short explanation of why the cited evidence supports the answer or why evidence is insufficient.',
    },
  ]

  const validationRules = [
    'Reject submissions with missing task ids, duplicate task ids, or task ids outside the scoring source.',
    'Reject citation ids that are not present in the corresponding task evidence units.',
    'Allow abstention with empty citations only when evidence_assessment explains insufficiency or conflict.',
    'Score parse failures as invalid model outputs, not as missing benchmark labels.',
    'Do not publish leaderboard rankings while responsible-use public_leaderboard_allowed is false.',
  ]

  return {
    benchmark_id: spec.id,
    submission_contract_ready: taskIds.length > 0 && answerFields.length >= 6 && validationRules.length >= 5,
    version: 'submission-contract-v1',
    scoring_sources: {
      pilot: {
        task_count: taskIds.length,
        source: 'generated/pilot-suite.json',
        allowed_for_public_leaderboard: false,
      },
      gold: {
        task_count: 0,
        source: 'generated/gold-suite.json',
        allowed_for_public_leaderboard: false,
        blocked_until: ['gold_review_complete', 'review_merge_ready', 'category_scale_ready', 'novelty_audit_final'],
      },
    },
    generated_from: {
      benchmark_spec: 'benchmark-spec.json',
      pilot_suite: 'generated/pilot-suite.json',
      model_baseline_packets: 'generated/model-baseline-packets.json',
      responsible_use: 'generated/responsible-use.json',
    },
    schema: {
      top_level_required_fields: ['system_id', 'answers'],
      answer_required_fields: answerFields.filter((field) => field.required).map((field) => field.field),
      answer_fields: answerFields,
      example: {
        system_id: 'example-system-v1',
        answers: [
          {
            task_id: taskIds[0] || 'hgr_example_task',
            answer: 'ABSTAIN',
            citations: [],
            abstained: true,
            confidence: 0,
            evidence_assessment: 'The provided evidence is insufficient for the requested conclusion.',
          },
        ],
      },
    },
    validation_rules: validationRules,
    packet_alignment: {
      packet_count: modelBaselinePackets.packet_count,
      scored_reports_ready: Boolean(modelBaselinePackets.scored_reports_ready),
      expected_output_template_present: true,
    },
    public_leaderboard_allowed: Boolean(responsibleUse.public_leaderboard_allowed),
    completion_claim_allowed: false,
  }
}

function renderMarkdown(report) {
  const fieldRows = report.schema.answer_fields.map((field) => [
    field.field,
    field.type,
    field.required ? 'yes' : 'no',
    field.rule,
  ])
  const sourceRows = Object.entries(report.scoring_sources).map(([source, value]) => [
    source,
    value.source,
    String(value.task_count),
    String(value.allowed_for_public_leaderboard),
  ])
  const ruleRows = report.validation_rules.map((rule, index) => [String(index + 1), rule])

  return `# Hard Grounded Research Submission Contract

This generated contract defines the external model prediction format and validation policy for the benchmark. It is a reproducibility artifact, not permission to publish a leaderboard while review and novelty gates remain incomplete.

## Summary

- Submission contract ready: ${report.submission_contract_ready}
- Version: ${report.version}
- Public leaderboard allowed: ${report.public_leaderboard_allowed}
- Completion claim allowed: ${report.completion_claim_allowed}
- Baseline packet count: ${report.packet_alignment.packet_count}

## Scoring Sources

${markdownTable(['Source', 'Path', 'Tasks', 'Leaderboard allowed'], sourceRows)}

## Answer Fields

${markdownTable(['Field', 'Type', 'Required', 'Rule'], fieldRows)}

## Validation Rules

${markdownTable(['#', 'Rule'], ruleRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  if (!existsSync(path)) throw new Error(`Missing submission-contract input ${name}: ${path}`)
}

const report = buildReport({
  spec: readJson(inputs.spec),
  pilotSuite: readJson(inputs.pilotSuite),
  modelBaselinePackets: readJson(inputs.modelBaselinePackets),
  responsibleUse: readJson(inputs.responsibleUse),
})

writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded submission contract JSON to ${reportJsonPath}`)
console.log(`Wrote hard grounded submission contract report to ${reportMarkdownPath}`)
