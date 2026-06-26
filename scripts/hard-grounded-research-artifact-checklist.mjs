import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const checklistJsonPath = join(generatedDir, 'artifact-checklist.json')
const checklistMarkdownPath = join(experimentDir, 'ARTIFACT_CHECKLIST.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  corpusAudit: join(generatedDir, 'corpus-audit.json'),
  sourceDiversityPlan: join(generatedDir, 'source-diversity-plan.json'),
  constructMap: join(generatedDir, 'construct-map.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
  noveltyEvidence: join(generatedDir, 'novelty-evidence.json'),
  licenseClearance: join(generatedDir, 'license-clearance.json'),
  packageManifest: join(generatedDir, 'public-package-manifest.json'),
  scaledPublicPackageSummary: join(generatedDir, 'public-package/scaled-summary.json'),
  modelRunIndex: join(generatedDir, 'model-run-index.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  paperTables: join(generatedDir, 'paper-tables.json'),
  analysisPlan: join(generatedDir, 'analysis-plan.json'),
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
  reviewProgress: join(generatedDir, 'review-progress.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
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

function artifactClass(id, status, evidence, blockers = []) {
  return {
    id,
    status: status ? 'ready' : 'blocked',
    ready: Boolean(status),
    evidence,
    blockers,
  }
}

function buildChecklist({
  spec,
  pilotSuite,
  corpusAudit,
  sourceDiversityPlan,
  constructMap,
  powerPlan,
  noveltyEvidence,
  licenseClearance,
  packageManifest,
  scaledPublicPackageSummary,
  modelRunIndex,
  baselineAnalysis,
  paperTables,
  analysisPlan,
  annotationExport,
  reviewProgress,
  releaseGate,
}) {
  const failedReleaseChecks = releaseGate.checks.filter((check) => !check.passed)
  const artifactClasses = [
    artifactClass('taxonomy_and_constructs', constructMap.construct_map_ready, `${constructMap.summary.ready_constructs}/${constructMap.summary.category_count} constructs mapped to rubrics, metrics, examples, novelty risk, and review status.`),
    artifactClass('corpus_and_public_package', corpusAudit.corpus_audit_ready && licenseClearance.public_redistribution_clearance_ready, `${corpusAudit.summary.scaled_public_items} scaled public items; ${corpusAudit.summary.scaled_public_evidence_units} evidence units; ${corpusAudit.summary.scaled_public_pointer_only_evidence_units} pointer-only evidence units.`),
    artifactClass('source_diversity_expansion', sourceDiversityPlan.source_diversity_plan_ready, `${sourceDiversityPlan.summary.current_distinct_source_rows}/${sourceDiversityPlan.summary.target_distinct_source_rows_total} target source rows; deficit=${sourceDiversityPlan.summary.source_row_deficit_total}.`),
    artifactClass('annotation_and_review_workflow', annotationExport.export_ready && reviewProgress.review_progress_ready, `${annotationExport.totals.row_count} exported review rows; ${reviewProgress.summary.reviewed_items_remaining} reviewed target items remaining.`),
    artifactClass('baselines_and_scoring', baselineAnalysis.systems.length >= 5 && modelRunIndex.eligible_model_baseline_count >= 2, `${baselineAnalysis.systems.length} scored systems; ${modelRunIndex.eligible_model_baseline_count} eligible external model baselines.`),
    artifactClass('statistics_and_scale', powerPlan.power_plan_ready, `${powerPlan.assumptions.target_reviewed_items_per_category} target reviewed items/category; ${powerPlan.current_state.reviewed_items_remaining} reviewed items remaining.`),
    artifactClass('paper_tables_and_figures', paperTables.paper_tables_ready, `${paperTables.summary.table_count} paper tables; ${paperTables.summary.challenge_rows} challenge rows; ${paperTables.summary.failure_modes} failure modes.`),
    artifactClass('analysis_plan', analysisPlan.analysis_plan_ready, `${analysisPlan.summary.hypotheses} hypotheses; ${analysisPlan.summary.model_families} model families; ${analysisPlan.summary.covariates} covariates.`),
    artifactClass('novelty_and_claim_boundaries', noveltyEvidence.completion_claim_allowed === false && noveltyEvidence.claim_boundaries.length >= 4, `${noveltyEvidence.source_count} related-work sources; ${noveltyEvidence.allowed_claim_count} allowed claims; ${noveltyEvidence.prohibited_claim_count} prohibited claims.`),
  ]

  const reproductionCommands = [
    { step: 'Generate benchmark seeds and pilot suite', command: 'node scripts/hard-grounded-research-benchmark.mjs' },
    { step: 'Run scorer smoke report', command: 'node scripts/hard-grounded-research-evaluate.mjs' },
    { step: 'Run local non-oracle baselines', command: 'node scripts/hard-grounded-research-runner.mjs && node scripts/hard-grounded-research-lexical-baseline.mjs && node scripts/hard-grounded-research-citation-verifier.mjs' },
    { step: 'Refresh aggregate baseline analysis', command: 'node scripts/hard-grounded-research-report.mjs' },
    { step: 'Refresh corpus, construct, and power artifacts', command: 'node scripts/hard-grounded-research-corpus-audit.mjs && node scripts/hard-grounded-research-construct-map.mjs && node scripts/hard-grounded-research-power-plan.mjs' },
    { step: 'Refresh source diversity plan', command: 'node scripts/hard-grounded-research-source-diversity-plan.mjs' },
    { step: 'Refresh paper tables and figure data', command: 'node scripts/hard-grounded-research-paper-tables.mjs' },
    { step: 'Refresh statistical analysis plan', command: 'node scripts/hard-grounded-research-analysis-plan.mjs' },
    { step: 'Refresh release and publication surfaces', command: 'node scripts/hard-grounded-research-release-gate.mjs && node scripts/hard-grounded-research-dataset-card.mjs && node scripts/hard-grounded-research-paper-draft.mjs' },
    { step: 'Validate harness integration', command: 'node scripts/validate-harness.mjs' },
    { step: 'Run app build and dashboard QA', command: 'node_modules/.bin/vite build && node scripts/qa-dashboard.mjs' },
    { step: 'Run full repository gates', command: 'pnpm build && pnpm test', caveat: 'Currently blocked in this workspace by pnpm ignored-build approvals for esbuild, sharp, and workerd.' },
  ]

  const paperReadiness = {
    status: releaseGate.status === 'release_ready' ? 'paper_ready' : 'blocked',
    release_gate_status: releaseGate.status,
    completion_claim_allowed: releaseGate.status === 'release_ready',
    blockers: failedReleaseChecks.map((check) => ({
      id: check.id,
      detail: check.detail,
      blocker: check.blocker,
    })),
  }

  const checklist = {
    artifact_checklist_ready: artifactClasses.every((entry) => entry.ready) && reproductionCommands.length >= 8,
    benchmark_id: spec.id,
    generated_from: {
      release_gate: 'generated/release-gate.json',
      corpus_audit: 'generated/corpus-audit.json',
      source_diversity_plan: 'generated/source-diversity-plan.json',
      construct_map: 'generated/construct-map.json',
      power_plan: 'generated/power-plan.json',
      novelty_evidence: 'generated/novelty-evidence.json',
      public_package_manifest: 'generated/public-package-manifest.json',
      scaled_public_package_summary: 'generated/public-package/scaled-summary.json',
      model_run_index: 'generated/model-run-index.json',
      baseline_analysis: 'generated/baseline-analysis.json',
      paper_tables: 'generated/paper-tables.json',
      analysis_plan: 'generated/analysis-plan.json',
      annotation_export: 'generated/annotation-export/manifest.json',
      review_progress: 'generated/review-progress.json',
    },
    summary: {
      categories: spec.categories.length,
      pilot_items: pilotSuite.items.length,
      scaled_public_items: scaledPublicPackageSummary.item_count,
      artifact_classes_ready: artifactClasses.filter((entry) => entry.ready).length,
      artifact_classes_total: artifactClasses.length,
      reproduction_commands: reproductionCommands.length,
      release_blockers: failedReleaseChecks.length,
    },
    artifact_classes: artifactClasses,
    reproduction_commands: reproductionCommands,
    paper_readiness: paperReadiness,
  }

  return checklist
}

function renderMarkdown(checklist) {
  const artifactRows = checklist.artifact_classes.map((entry) => [
    entry.id,
    entry.status,
    entry.evidence,
  ])
  const commandRows = checklist.reproduction_commands.map((entry) => [
    entry.step,
    `\`${entry.command}\`${entry.caveat ? `<br>${entry.caveat}` : ''}`,
  ])
  const blockerRows = checklist.paper_readiness.blockers.map((blocker) => [
    blocker.id,
    blocker.detail,
    blocker.blocker,
  ])

  return `# Hard Grounded Research Artifact Checklist

This generated checklist makes the benchmark package auditable as a research artifact. It records what can be regenerated, what is already packaged, and which paper-readiness claims remain blocked.

## Summary

- Checklist ready: ${checklist.artifact_checklist_ready}
- Benchmark id: \`${checklist.benchmark_id}\`
- Categories: ${checklist.summary.categories}
- Pilot items: ${checklist.summary.pilot_items}
- Scaled public items: ${checklist.summary.scaled_public_items}
- Artifact classes ready: ${checklist.summary.artifact_classes_ready}/${checklist.summary.artifact_classes_total}
- Reproduction commands: ${checklist.summary.reproduction_commands}
- Release blockers: ${checklist.summary.release_blockers}
- Paper readiness status: ${checklist.paper_readiness.status}
- Completion claim allowed: ${checklist.paper_readiness.completion_claim_allowed}

## Artifact Classes

${markdownTable(['Class', 'Status', 'Evidence'], artifactRows)}

## Reproduction Commands

${markdownTable(['Step', 'Command'], commandRows)}

## Paper-Readiness Blockers

${blockerRows.length ? markdownTable(['Check', 'Detail', 'Required action'], blockerRows) : 'No paper-readiness blockers are present.'}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing artifact checklist input ${name}: ${path}`)
}

const checklist = buildChecklist({
  spec: readJson(inputs.spec),
  pilotSuite: readJson(inputs.pilotSuite),
  corpusAudit: readJson(inputs.corpusAudit),
  sourceDiversityPlan: readJson(inputs.sourceDiversityPlan),
  constructMap: readJson(inputs.constructMap),
  powerPlan: readJson(inputs.powerPlan),
  noveltyEvidence: readJson(inputs.noveltyEvidence),
  licenseClearance: readJson(inputs.licenseClearance),
  packageManifest: readJson(inputs.packageManifest),
  scaledPublicPackageSummary: readJson(inputs.scaledPublicPackageSummary),
  modelRunIndex: readJson(inputs.modelRunIndex),
  baselineAnalysis: readJson(inputs.baselineAnalysis),
  paperTables: readJson(inputs.paperTables),
  analysisPlan: readJson(inputs.analysisPlan),
  annotationExport: readJson(inputs.annotationExport),
  reviewProgress: readJson(inputs.reviewProgress),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(checklistJsonPath, checklist)
writeText(checklistMarkdownPath, renderMarkdown(checklist))
console.log(`Wrote hard grounded research artifact checklist to ${checklistJsonPath}`)
console.log(`Wrote hard grounded research artifact checklist report to ${checklistMarkdownPath}`)
