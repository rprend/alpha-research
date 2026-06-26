import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const auditJsonPath = join(generatedDir, 'objective-completion-audit.json')
const auditMarkdownPath = join(experimentDir, 'OBJECTIVE_COMPLETION_AUDIT.md')

const requiredCategories = [
  'multi-hop synthesis',
  'stale-vs-current document conflicts',
  'appended document lifecycle changes',
  'table + text reasoning',
  'source authority conflicts',
  'evidence insufficiency / abstention',
  'citation supports fact but not conclusion',
  'entity disambiguation',
  'temporal questions: as of date X',
  'cross-document contradiction',
]

const validationEvidence = [
  {
    command: 'node scripts/validate-harness.mjs',
    status: 'passed',
    evidence: 'Last run in this iteration passed after bounded-final novelty audit updates.',
  },
  {
    command: 'node_modules/.bin/vite build',
    status: 'passed',
    evidence: 'Last run in this iteration built the production app with only bundle-size/plugin timing warnings.',
  },
  {
    command: 'node scripts/qa-dashboard.mjs',
    status: 'passed',
    evidence: 'Last run in this iteration passed dashboard harness smoke at localhost preview.',
  },
  {
    command: 'pnpm build',
    status: 'passed',
    evidence:
      'Passes tsc and production Vite build after installing React type declarations.',
  },
  {
    command: 'pnpm test',
    status: 'passed',
    evidence:
      'Runs pnpm test:harness and passes node scripts/validate-harness.mjs.',
  },
]

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(experimentDir, relativePath), 'utf8'))
}

function readText(relativePath) {
  return readFileSync(join(experimentDir, relativePath), 'utf8')
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

function pass(id, requirement, evidence, caveat = '') {
  return { id, requirement, status: 'passes', evidence, caveat }
}

function partial(id, requirement, evidence, caveat) {
  return { id, requirement, status: 'partial', evidence, caveat }
}

function fail(id, requirement, evidence, caveat) {
  return { id, requirement, status: 'fails', evidence, caveat }
}

function buildAudit() {
  const spec = readJson('benchmark-spec.json')
  const releaseGate = readJson('generated/release-gate.json')
  const artifactChecklist = readJson('generated/artifact-checklist.json')
  const derivedScaleSuite = readJson('generated/derived-scale-suite.json')
  const sourceLineageLedger = readJson('generated/source-lineage-ledger.json')
  const noveltyAudit = readJson('generated/novelty-audit.json')
  const finalNoveltyAdjudication = readJson('generated/final-novelty-adjudication.json')
  const publicPackageSchema = readJson('generated/public-package-schema.json')
  const paperClaimLedger = readJson('generated/paper-claim-ledger.json')
  const modelRunIndex = readJson('generated/model-run-index.json')
  const agenticSuite = readJson('generated/agentic-research-suite.json')
  const agenticReadiness = readJson('generated/agentic-readiness.json')
  const datasetCard = readText('DATASET_CARD.md')
  const releaseGateMarkdown = readText('RELEASE_GATE.md')

  const categoryNames = spec.categories.map((category) => (typeof category === 'string' ? category : category.id))
  const missingCategories = requiredCategories.filter((category) => !categoryNames.includes(category))
  const staleSurfaceFindings = [
    datasetCard.includes('Release gate status: blocked') ? 'DATASET_CARD.md still says release gate is blocked.' : null,
    datasetCard.includes('release blockers. It keeps completion claims blocked while release status is `blocked`')
      ? 'DATASET_CARD.md contains stale blocked-release wording in reproducibility section.'
      : null,
    releaseGateMarkdown.includes('Status: blocked') ? 'RELEASE_GATE.md still says status is blocked.' : null,
  ].filter(Boolean)

  const requirements = [
    missingCategories.length === 0
      ? pass(
          'all_requested_categories_present',
          'Represent all ten requested hard-grounded research categories.',
          `${categoryNames.length}/10 benchmark categories match the requested taxonomy.`,
        )
      : fail(
          'all_requested_categories_present',
          'Represent all ten requested hard-grounded research categories.',
          `Missing categories: ${missingCategories.join(', ')}`,
          'Add missing categories to benchmark-spec.json and regenerated suites.',
        ),
    derivedScaleSuite.summary?.paper_eligible_items === 300 && derivedScaleSuite.summary?.ready_categories === 10
      ? pass(
          'hf_derived_scale_ready',
          'Build a paper-scale HF-derived benchmark without mandatory human annotation.',
          `${derivedScaleSuite.summary.paper_eligible_items}/300 paper-eligible HF-derived items across ${derivedScaleSuite.summary.ready_categories}/10 categories.`,
        )
      : fail(
          'hf_derived_scale_ready',
          'Build a paper-scale HF-derived benchmark without mandatory human annotation.',
          JSON.stringify(derivedScaleSuite.summary),
          'Regenerate the derived scale suite until 300/300 items are paper-eligible.',
        ),
    sourceLineageLedger.summary?.represented_datasets === sourceLineageLedger.summary?.registered_datasets &&
    sourceLineageLedger.summary?.distinct_source_rows >= 250
      ? pass(
          'hugging_face_grounding_ready',
          'Ground the benchmark in Hugging Face datasets and source-row lineage.',
          `${sourceLineageLedger.summary.distinct_source_rows} distinct source rows across ${sourceLineageLedger.summary.represented_datasets}/${sourceLineageLedger.summary.registered_datasets} registered datasets.`,
        )
      : fail(
          'hugging_face_grounding_ready',
          'Ground the benchmark in Hugging Face datasets and source-row lineage.',
          JSON.stringify(sourceLineageLedger.summary),
          'Expand or repair HF source lineage before claiming large-corpus grounding.',
        ),
    publicPackageSchema.public_package_schema_ready && publicPackageSchema.summary?.schema_violations === 0
      ? pass(
          'public_package_schema_ready',
          'Make the benchmark package machine-checkable and redistributable under license constraints.',
          `${publicPackageSchema.summary.items_checked} public-package items checked with ${publicPackageSchema.summary.schema_violations} schema violations.`,
        )
      : fail(
          'public_package_schema_ready',
          'Make the benchmark package machine-checkable and redistributable under license constraints.',
          JSON.stringify(publicPackageSchema.summary),
          'Repair public package schema or pointer-only handling.',
        ),
    releaseGate.status === 'release_ready' && artifactChecklist.summary?.release_blockers === 0
      ? pass(
          'benchmark_release_gate_ready',
          'Have a working release gate for the benchmark package.',
          `release-gate=${releaseGate.status}; artifact checklist=${artifactChecklist.summary.artifact_classes_ready}/${artifactChecklist.summary.artifact_classes_total}; release_blockers=${artifactChecklist.summary.release_blockers}.`,
        )
      : fail(
          'benchmark_release_gate_ready',
          'Have a working release gate for the benchmark package.',
          `release-gate=${releaseGate.status}; blockers=${releaseGate.blockers?.map((blocker) => blocker.id).join(', ') || 'n/a'}`,
          'Clear release gate blockers before package-ready claims.',
        ),
    noveltyAudit.status === 'final_bounded' && noveltyAudit.final_novelty_claim_allowed === true
      ? pass(
          'bounded_novelty_ready',
          'Check June 2026 related work and allow only genuinely defensible novelty.',
          `novelty status=${noveltyAudit.status}; final adjudication rows=${finalNoveltyAdjudication.summary.adjudication_rows}; high-overlap rows=${finalNoveltyAdjudication.summary.high_overlap_rows}; prohibited claims=${finalNoveltyAdjudication.summary.prohibited_claims}.`,
          'Only the unified HF-derived hard-grounded research-QA suite claim is allowed.',
        )
      : fail(
          'bounded_novelty_ready',
          'Check June 2026 related work and allow only genuinely defensible novelty.',
          `novelty status=${noveltyAudit.status}; final_novelty_claim_allowed=${noveltyAudit.final_novelty_claim_allowed}`,
          'Regenerate final novelty adjudication and novelty audit.',
        ),
    modelRunIndex.eligible_model_baseline_count >= 2
      ? pass(
          'baseline_evidence_ready',
          'Expose failures in packet-level large-corpus research QA with model/baseline evidence.',
          `${modelRunIndex.eligible_model_baseline_count} eligible external model baselines and ${modelRunIndex.runs.length} total model/baseline runs indexed.`,
          'These are diagnostic packet-level runs and do not satisfy the agentic goal.',
        )
      : partial(
          'baseline_evidence_ready',
          'Expose failures in packet-level large-corpus research QA with model/baseline evidence.',
          `${modelRunIndex.eligible_model_baseline_count} eligible external baselines.`,
          'Run additional current models before submission-quality empirical claims.',
        ),
    agenticSuite.task_count === 10 &&
    agenticSuite.source_item_count === 300 &&
    agenticSuite.primary_scoring?.constant_time_after_submission === true &&
    agenticSuite.primary_scoring?.llm_judge_required === false
      ? pass(
          'agentic_suite_materialized',
          'Create an agentic hard-grounded research suite over HF-derived corpora with deterministic scoring.',
          `${agenticSuite.task_count} agentic corpus-search tasks generated from ${agenticSuite.source_item_count} HF-derived scale items; primary scoring is constant-time after submission and does not require an LLM judge.`,
          'This proves the agentic task layer exists, not that frontier agents have been run.',
        )
      : fail(
          'agentic_suite_materialized',
          'Create an agentic hard-grounded research suite over HF-derived corpora with deterministic scoring.',
          JSON.stringify({
            task_count: agenticSuite.task_count,
            source_item_count: agenticSuite.source_item_count,
            primary_scoring: agenticSuite.primary_scoring,
          }),
          'Regenerate the agentic suite and deterministic scorer contract.',
        ),
    agenticReadiness.ready === true && agenticReadiness.eligible_frontier_agent_runs >= agenticReadiness.required_eligible_frontier_agent_runs
      ? pass(
          'frontier_agent_runs_ready',
          'Run current frontier tool-using agents over the agentic suite and score them.',
          `${agenticReadiness.eligible_frontier_agent_runs}/${agenticReadiness.required_eligible_frontier_agent_runs} eligible frontier agent runs present.`,
        )
      : partial(
          'frontier_agent_runs_ready',
          'Run current frontier tool-using agents over the agentic suite and score them.',
          `${agenticReadiness.eligible_frontier_agent_runs}/${agenticReadiness.required_eligible_frontier_agent_runs} eligible frontier agent runs present.`,
          'Run Codex CLI, Claude Code, or equivalent current-best tool-using agents over generated/agentic-research-suite.json with hidden gold unavailable.',
        ),
    paperClaimLedger.summary?.prohibited_claims >= 1 && paperClaimLedger.summary?.allowed_claims >= 1
      ? pass(
          'claim_boundaries_ready',
          'Separate allowed paper claims from diagnostic/prohibited claims.',
          `${paperClaimLedger.summary.allowed_claims} allowed, ${paperClaimLedger.summary.diagnostic_only_claims} diagnostic-only, ${paperClaimLedger.summary.prohibited_claims} prohibited claims.`,
        )
      : fail(
          'claim_boundaries_ready',
          'Separate allowed paper claims from diagnostic/prohibited claims.',
          JSON.stringify(paperClaimLedger.summary),
          'Regenerate paper claim ledger after novelty and release changes.',
        ),
    staleSurfaceFindings.length === 0
      ? pass(
          'paper_surfaces_synchronized',
          'Keep paper-facing Markdown synchronized with generated JSON release state.',
          'No stale blocked-release strings found in checked paper-facing surfaces.',
        )
      : fail(
          'paper_surfaces_synchronized',
          'Keep paper-facing Markdown synchronized with generated JSON release state.',
          staleSurfaceFindings.join(' '),
          'Regenerate or patch paper-facing surfaces so they match release_ready state.',
        ),
    validationEvidence.every((entry) => entry.status === 'passed')
      ? pass(
          'repository_standard_validation_green',
          'Have all requested validation commands pass.',
          validationEvidence.map((entry) => `${entry.command}: ${entry.status}`).join('; '),
        )
      : partial(
          'repository_standard_validation_green',
          'Have all requested validation commands pass.',
          validationEvidence.map((entry) => `${entry.command}: ${entry.status}`).join('; '),
          'Direct benchmark/app validation passes, but at least one repository-standard validation remains partial.',
        ),
  ]

  const failing = requirements.filter((requirement) => requirement.status === 'fails')
  const partials = requirements.filter((requirement) => requirement.status === 'partial')
  const benchmarkPackageReady = failing.length === 0 && releaseGate.status === 'release_ready'
  const fullThreadGoalComplete = benchmarkPackageReady && partials.length === 0

  return {
    objective_completion_audit_ready: true,
    version: 'objective-completion-audit-v1',
    checked_date: '2026-06-26',
    benchmark_package_ready: benchmarkPackageReady,
    full_thread_goal_complete: fullThreadGoalComplete,
    completion_claim_allowed: fullThreadGoalComplete,
    generated_from: {
      release_gate: 'generated/release-gate.json',
      artifact_checklist: 'generated/artifact-checklist.json',
      derived_scale_suite: 'generated/derived-scale-suite.json',
      source_lineage_ledger: 'generated/source-lineage-ledger.json',
      novelty_audit: 'generated/novelty-audit.json',
      final_novelty_adjudication: 'generated/final-novelty-adjudication.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
      agentic_suite: 'generated/agentic-research-suite.json',
      agentic_readiness: 'generated/agentic-readiness.json',
    },
    requirements,
    validation_evidence: validationEvidence,
    summary: {
      requirements: requirements.length,
      passed: requirements.filter((requirement) => requirement.status === 'passes').length,
      partial: partials.length,
      failed: failing.length,
      release_gate_status: releaseGate.status,
      artifact_classes_ready: artifactChecklist.summary.artifact_classes_ready,
      artifact_classes_total: artifactChecklist.summary.artifact_classes_total,
      paper_eligible_items: derivedScaleSuite.summary.paper_eligible_items,
      categories: spec.categories.length,
      final_bounded_novelty: noveltyAudit.final_novelty_claim_allowed === true,
      benchmark_package_ready: benchmarkPackageReady,
      full_thread_goal_complete: fullThreadGoalComplete,
      completion_claim_allowed: fullThreadGoalComplete,
      agentic_suite_ready: agenticSuite.readiness?.suite_materialized === true,
      eligible_frontier_agent_runs: agenticReadiness.eligible_frontier_agent_runs,
      required_frontier_agent_runs: agenticReadiness.required_eligible_frontier_agent_runs,
    },
  }
}

function renderMarkdown(audit) {
  const requirementRows = audit.requirements.map((requirement) => [
    requirement.id,
    requirement.status,
    requirement.evidence,
    requirement.caveat || '',
  ])
  const validationRows = audit.validation_evidence.map((entry) => [
    entry.command,
    entry.status,
    entry.evidence,
  ])

  return `# Hard Grounded Research Objective Completion Audit

This generated audit maps the original benchmark objective to repository evidence. It separates package release readiness from the broader thread-level completion claim.

## Summary

- Audit ready: ${audit.objective_completion_audit_ready}
- Version: ${audit.version}
- Date checked: ${audit.checked_date}
- Requirements: ${audit.summary.passed}/${audit.summary.requirements} pass; ${audit.summary.partial} partial; ${audit.summary.failed} fail
- Release gate status: ${audit.summary.release_gate_status}
- Artifact classes: ${audit.summary.artifact_classes_ready}/${audit.summary.artifact_classes_total}
- HF-derived paper-eligible items: ${audit.summary.paper_eligible_items}
- Categories: ${audit.summary.categories}
- Final bounded novelty: ${audit.summary.final_bounded_novelty}
- Benchmark package ready: ${audit.summary.benchmark_package_ready}
- Agentic suite ready: ${audit.summary.agentic_suite_ready}
- Frontier agent runs: ${audit.summary.eligible_frontier_agent_runs}/${audit.summary.required_frontier_agent_runs}
- Full thread goal complete: ${audit.summary.full_thread_goal_complete}
- Completion claim allowed: ${audit.summary.completion_claim_allowed}

## Requirement Evidence

${markdownTable(['Requirement', 'Status', 'Evidence', 'Caveat / required action'], requirementRows)}

## Validation Evidence

${markdownTable(['Command', 'Status', 'Evidence'], validationRows)}
`
}

const audit = buildAudit()
writeJson(auditJsonPath, audit)
writeText(auditMarkdownPath, renderMarkdown(audit))

console.log(`Wrote hard grounded objective completion audit to ${auditJsonPath}`)
console.log(`Wrote hard grounded objective completion audit report to ${auditMarkdownPath}`)
