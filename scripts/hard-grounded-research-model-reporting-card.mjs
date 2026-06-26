import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'model-reporting-card.json')
const reportMarkdownPath = join(experimentDir, 'MODEL_REPORTING_CARD.md')

const inputs = {
  modelRunIndex: join(generatedDir, 'model-run-index.json'),
  modelBaselinePackets: join(generatedDir, 'model-baseline-packets.json'),
  submissionContract: join(generatedDir, 'submission-contract.json'),
  scoringContract: join(generatedDir, 'scoring-contract.json'),
  responsibleUse: join(generatedDir, 'responsible-use.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
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

function metric(value) {
  if (value === null || value === undefined) return 'n/a'
  return Number(value).toFixed(4)
}

function buildCard({ modelRunIndex, modelBaselinePackets, submissionContract, scoringContract, responsibleUse, releaseGate }) {
  const runs = (modelRunIndex.runs || []).map((run) => ({
    system_id: run.system_id,
    eligible_model_baseline: Boolean(run.eligible_model_baseline),
    evaluation_source: run.evaluation_source,
    task_count: run.task_count,
    macro_answer_correct: run.macro_answer_correct ?? null,
    report_present: Boolean(run.report_path),
    import_manifest_present: Boolean(run.import_manifest_path),
  }))
  const eligibleRuns = runs.filter((run) => run.eligible_model_baseline)
  const activeBlockers = releaseGate.checks
    .filter((check) => !check.passed)
    .map((check) => check.id)

  const requiredReportingFields = [
    'system_id',
    'model_family',
    'model_version_or_checkpoint',
    'inference_date',
    'prompt_packet_hash_or_manifest',
    'submission_contract_version',
    'scoring_contract_version',
    'evaluation_source',
    'task_count',
    'abstention_policy',
    'citation_policy',
  ]

  const reportingRules = [
    'Do not publish a public leaderboard while responsible-use public_leaderboard_allowed is false.',
    'Treat pilot scores as diagnostic until reviewed gold, merge, scale, and final novelty gates pass.',
    'Report prompt-packet provenance and scored-report provenance with every model result.',
    'Report abstention, citation-faithfulness, conclusion-support, and answer metrics together.',
    'Do not make category-level model claims until category_scale_ready passes.',
  ]

  return {
    model_reporting_card_ready:
      runs.length > 0 &&
      eligibleRuns.length === modelRunIndex.eligible_model_baseline_count &&
      modelBaselinePackets.packets_ready === true &&
      submissionContract.submission_contract_ready === true &&
      scoringContract.scoring_contract_ready === true &&
      responsibleUse.public_leaderboard_allowed === false,
    version: 'model-reporting-card-v1',
    generated_from: {
      model_run_index: 'generated/model-run-index.json',
      model_baseline_packets: 'generated/model-baseline-packets.json',
      submission_contract: 'generated/submission-contract.json',
      scoring_contract: 'generated/scoring-contract.json',
      responsible_use: 'generated/responsible-use.json',
      release_gate: 'generated/release-gate.json',
    },
    eligible_model_baselines: eligibleRuns.length,
    reported_systems: runs,
    required_reporting_fields: requiredReportingFields,
    reporting_rules: reportingRules,
    prompt_packet_policy: {
      packet_count: modelBaselinePackets.packet_count,
      packets_ready: Boolean(modelBaselinePackets.packets_ready),
      scored_reports_ready: Boolean(modelBaselinePackets.scored_reports_ready),
      require_packet_manifest_for_reported_result: true,
    },
    contract_versions: {
      submission_contract_version: submissionContract.version,
      scoring_contract_version: scoringContract.version,
      required_answer_fields: submissionContract.schema.answer_required_fields,
      required_metric_ids: scoringContract.required_metric_ids,
    },
    claim_limits: {
      public_leaderboard_allowed: Boolean(responsibleUse.public_leaderboard_allowed),
      completion_claim_allowed: false,
      category_level_model_claims_allowed: activeBlockers.includes('category_scale_ready') ? false : releaseGate.status === 'release_ready',
      blocked_until: activeBlockers,
    },
    summary: {
      systems_reported: runs.length,
      eligible_model_baselines: eligibleRuns.length,
      required_reporting_fields: requiredReportingFields.length,
      reporting_rules: reportingRules.length,
      active_release_blockers: activeBlockers.length,
      public_leaderboard_allowed: Boolean(responsibleUse.public_leaderboard_allowed),
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(card) {
  const runRows = card.reported_systems.map((run) => [
    run.system_id,
    run.eligible_model_baseline ? 'yes' : 'no',
    run.evaluation_source,
    String(run.task_count),
    metric(run.macro_answer_correct),
    run.report_present ? 'yes' : 'no',
  ])
  const fieldRows = card.required_reporting_fields.map((field, index) => [String(index + 1), field])
  const ruleRows = card.reporting_rules.map((rule, index) => [String(index + 1), rule])

  return `# Hard Grounded Research Model Reporting Card

This generated card defines how model results may be reported for the benchmark package. It is a reporting policy, not a public leaderboard authorization.

## Status

- Ready: ${card.model_reporting_card_ready}
- Version: ${card.version}
- Eligible model baselines: ${card.eligible_model_baselines}
- Public leaderboard allowed: ${card.claim_limits.public_leaderboard_allowed}
- Completion claim allowed: ${card.claim_limits.completion_claim_allowed}
- Active release blockers: ${card.summary.active_release_blockers}

## Reported Systems

${markdownTable(['System', 'Eligible', 'Evaluation source', 'Tasks', 'Macro answer correct', 'Report present'], runRows)}

## Required Reporting Fields

${markdownTable(['#', 'Field'], fieldRows)}

## Reporting Rules

${markdownTable(['#', 'Rule'], ruleRows)}

## Prompt Packet Policy

- Packet count: ${card.prompt_packet_policy.packet_count}
- Packets ready: ${card.prompt_packet_policy.packets_ready}
- Scored reports ready: ${card.prompt_packet_policy.scored_reports_ready}
- Require packet manifest for reported result: ${card.prompt_packet_policy.require_packet_manifest_for_reported_result}

## Contract Versions

- Submission contract: ${card.contract_versions.submission_contract_version}
- Scoring contract: ${card.contract_versions.scoring_contract_version}
- Required answer fields: ${card.contract_versions.required_answer_fields.join(', ')}
- Required metric ids: ${card.contract_versions.required_metric_ids.join(', ')}

## Claim Limits

Public leaderboards, completion claims, and category-level model claims remain blocked until the release gate passes. Current blockers: ${card.claim_limits.blocked_until.join(', ')}.
`
}

const card = buildCard({
  modelRunIndex: readJson(inputs.modelRunIndex),
  modelBaselinePackets: readJson(inputs.modelBaselinePackets),
  submissionContract: readJson(inputs.submissionContract),
  scoringContract: readJson(inputs.scoringContract),
  responsibleUse: readJson(inputs.responsibleUse),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(reportJsonPath, card)
writeText(reportMarkdownPath, renderMarkdown(card))
console.log(`Wrote hard grounded research model reporting card to ${reportJsonPath}`)
console.log(`Wrote hard grounded research model reporting card report to ${reportMarkdownPath}`)
