import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "manuscript-evidence-map-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const readiness = await readResult("paper-readiness-gate-2026-06-26-v1");
const trustedDates = await readResult("trusted-dated-kb-snapshot-arxiv-api-2026-06-26-v1");
const corpusRealism = await readResult("corpus-realism-private-kb-gap-audit-2026-06-26-v1");
const versionedKbPrototype = await readResult("versioned-private-kb-prototype-git-docs-2026-06-26-v1");
const versionedKbEval = await readResult("versioned-private-kb-eval-versioned-private-kb-prototype-git-docs-2026-06-26-v1");
const versionedWritebackDiagnostic = await readResult("versioned-kb-writeback-diagnostic-versioned-private-kb-prototype-git-docs-2026-06-26-v1");
const versionedKbNaturalnessAudit = await readResult("versioned-kb-naturalness-audit-versioned-private-kb-prototype-git-docs-2026-06-26-v1");
const versionedKbNaturalQuestions = await readResult("versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2");
const versionedKbNaturalQuestionEval = await readResult("versioned-kb-natural-question-eval-versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2");
const transfer = await readResult("risk-gate-transfer-synthesis-240-389-v1");
const guard = await readResult("claim-entailment-guard-validation-240-389-v1");
const miniVerifier = await readResult("mini-verifier-gate-balanced-risk-gate-240-389-v1");
const drag = await readResult("drag-like-rag-distillation-comparison-2026-06-26-v1");
const longcite = await readResult("longcite-style-citation-sft-comparison-2026-06-26-v1");
const writeback = await readResult("writeback-kb-amortization-scoped-exclusion-2026-06-26-v1");
const policyAblation = await readResult("post-training-policy-ablation-2026-06-26-v1");
const coverageFrontier = await readResult("coverage-constrained-support-frontier-2026-06-26-v1");
const modelScaleAudit = await readResult("model-scale-adequacy-audit-2026-06-26-v1");
const amortizationBreakEven = await readResult("amortization-break-even-qwen3b-2026-06-26-v1");
const distillationLossAccounting = await readResult("distillation-loss-accounting-2026-06-27-v1");
const packetQualityAudit = await readResult("joint-action-packet-quality-audit-2026-06-26-v1");
const scriptContractAudit = await readResult("joint-action-script-contract-audit-2026-06-26-v1");
const smokeLedgerFinalizer = await readResult("joint-action-smoke-ledger-finalizer-joint-action-qwen3b-smoke-eval-v1");
const primeRunbook = await readResult("prime-qwen3b-smoke-runbook-2026-06-26-v1");
const qwenResultIntegration = await readResult("qwen3b-result-integration-joint-action-smoke-2026-06-26-v1");
const qwenIntegrationFixtureAudit = await readResult("qwen3b-integration-fixture-audit-2026-06-26-v1");
const qwenSyntaxOnlyRejectionAudit = await readResult("qwen3b-syntax-only-rejection-audit-2026-06-26-v1");
const qwenLocalControlNonSubstitutionAudit = await readResult("qwen3b-local-control-non-substitution-audit-2026-06-26-v1");
const primeAuthPriceGate = await readResult("prime-auth-price-gate-qwen3b-smoke-2026-06-26-v1");
const qwenLaunch = await readResult("joint-action-launch-plan-prime-qwen3b-smoke-v1");
const qwenRemote = await readResult("joint-action-remote-smoke-plan-joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1");
const qwenPipeline = await readResult("qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1");
const abstentionReliability = await readResult("abstention-boundary-reliability-audit-2026-06-26-v1");
const judgeDisagreementTaxonomy = await readResult("judge-disagreement-taxonomy-judge-reliability-second-pass-run-2026-06-26-v2");
const remoteProvenanceGate = await readResult("qwen3b-remote-provenance-gate-joint-action-qwen3b-smoke-eval-v1");
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const futureHoldout = await readJson(path.join(experimentDir, "data", "extended_temporal_future_holdout-manifest.json"));

const passed = readiness.summary.passed;
const failed = readiness.summary.failed;
const blockers = readiness.top_blockers.map((row) => row.id);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "manuscript_evidence_map",
  purpose: "Map current grounded-QA distillation artifacts to manuscript claims, tables, and blocked claims without overclaiming missing Qwen 3B results.",
  readiness: {
    gate_run_id: readiness.run_id,
    passed_requirements: passed,
    failed_requirements: failed,
    status: readiness.summary.current_status,
    blockers,
  },
  dataset_and_temporal_claims: {
    source_dataset: "allenai/qasper",
    domain: "NLP research papers",
    final_holdout_examples: futureHoldout.examples_written,
    final_holdout_papers: futureHoldout.paper_count,
    trusted_snapshot_run_id: trustedDates.run_id,
    trusted_papers_checked: trustedDates.papers_checked,
    trusted_papers_with_dates: trustedDates.papers_with_trusted_dates,
    trusted_months: trustedDates.trusted_months,
    corpus_realism_audit_run_id: corpusRealism.run_id,
    versioned_domain_kb_extension_candidate_run_id: versionedKbPrototype.run_id,
    versioned_domain_kb_eval_run_id: versionedKbEval.run_id,
    versioned_writeback_diagnostic_run_id: versionedWritebackDiagnostic.run_id,
    versioned_kb_naturalness_audit_run_id: versionedKbNaturalnessAudit.run_id,
    versioned_kb_natural_questions_run_id: versionedKbNaturalQuestions.run_id,
    versioned_kb_natural_question_eval_run_id: versionedKbNaturalQuestionEval.run_id,
    versioned_domain_kb_candidate_examples: versionedKbPrototype.examples.total,
    supports_natural_versioned_kb_benchmark_claim: versionedKbNaturalnessAudit.scorecard.supports_natural_versioned_kb_benchmark_claim,
    supports_private_enterprise_kb_claim: corpusRealism.scorecard.supports_private_enterprise_kb_claim,
    allowed_claim: "The final evaluation window is a public, dated arXiv/QASPER proxy for an evolving domain KB, not a private enterprise KB.",
  },
  current_main_results: {
    zero_call_risk_gate_transfer: {
      run_id: transfer.run_id,
      scope: transfer.scope,
      direct_correct_rate: transfer.aggregate.direct.overall_judged_correct_rate,
      gate_correct_rate: transfer.aggregate.gate.overall_judged_correct_rate,
      direct_answer_support_rate: transfer.aggregate.direct.answer_support_rate,
      gate_answer_support_rate: transfer.aggregate.gate.answer_support_rate,
      answered_delta: transfer.deltas.answered_delta,
      interpretation: "Support-aware zero-call gating improves judged correctness and answer support over direct mini repair, but trades off answer coverage and recall.",
    },
    deterministic_claim_entailment_guard: {
      run_id: guard.run_id,
      direct_correct_rate: guard.policies.direct_mini_repair.overall_judged_correct_rate,
      gate_correct_rate: guard.policies.balanced_risk_gate.overall_judged_correct_rate,
      guard_correct_rate: guard.policies.claim_entailment_guard.overall_judged_correct_rate,
      guard_answer_support_rate: guard.policies.claim_entailment_guard.answer_support_rate,
      guard_answered: guard.policies.claim_entailment_guard.answered,
      suppressed_unsupported_answers: guard.guard_summary.suppressed_unsupported_answers,
      harmful_suppressed_supported_answers: guard.guard_summary.harmful_suppressed_supported_answers,
      interpretation: "A deterministic claim/evidence guard adds a small support gain over the balanced gate, again by suppressing answers.",
    },
    mini_verifier_teacher_step: {
      run_id: miniVerifier.run_id,
      source_mini_judge_calls: miniVerifier.source_mini_judge_calls,
      source_mini_judge_cost_usd: miniVerifier.source_mini_judge_cost_usd,
      combined_correct_rate: miniVerifier.aggregate.combined_verifier_gate.correct_rate,
      interpretation: "The mini verifier is useful as a label-construction or teacher step, not as the final amortized student because it adds per-query LLM calls.",
    },
    post_training_policy_ablation: {
      run_id: policyAblation.run_id,
      status: policyAblation.status,
      best_current_family: policyAblation.ranking_by_weighted_overall_judged_correctness[0],
      direct_answer_rate: policyAblation.families.find((row) => row.id === "direct_compact_rag_student_with_citation_repair")?.aggregate.answer_rate,
      direct_answer_support_rate: policyAblation.families.find((row) => row.id === "direct_compact_rag_student_with_citation_repair")?.aggregate.answer_support_rate,
      risk_gate_answer_rate: policyAblation.families.find((row) => row.id === "support_risk_gated_labels")?.aggregate.answer_rate,
      risk_gate_answer_support_rate: policyAblation.families.find((row) => row.id === "support_risk_gated_labels")?.aggregate.answer_support_rate,
      qwen3b_acceptance_metric: policyAblation.qwen3b_training_implication.acceptance_metric,
      interpretation: "Historical judged ablation says support-risk contrast is the strongest data-construction direction, but the final trained student must recover coverage rather than only learning to abstain.",
    },
    coverage_constrained_frontier: {
      run_id: coverageFrontier.run_id,
      status: coverageFrontier.status,
      direct_baseline: coverageFrontier.qwen3b_acceptance_target.direct_baseline,
      seventy_percent_operating_point: coverageFrontier.coverage_constrained_operating_points.find((row) => row.min_answer_rate === 0.7)?.selected,
      current_gate_floor: coverageFrontier.qwen3b_acceptance_target.current_gate_floor,
      qwen3b_recommended_minimum: coverageFrontier.qwen3b_acceptance_target.recommended_minimum,
      interpretation: "The support/coverage tradeoff is binding; Qwen 3B should be compared against a 70% answer-rate frontier, not only against the low-coverage support-first gate.",
    },
    model_scale_adequacy: {
      run_id: modelScaleAudit.run_id,
      status: modelScaleAudit.status,
      qwen05b_answer_support_rate: modelScaleAudit.systems.find((row) => row.id === "local_qwen05b_sft_answer_repeat2")?.answer_support_rate,
      qwen05b_inline_citation_rate: modelScaleAudit.systems.find((row) => row.id === "local_qwen05b_sft_answer_repeat2")?.inline_citation_rate,
      qwen3b_base_answer_rate: modelScaleAudit.systems.find((row) => row.id === "local_qwen3b_base_control")?.answer_rate,
      qwen3b_base_inline_citation_rate: modelScaleAudit.systems.find((row) => row.id === "local_qwen3b_base_control")?.inline_citation_rate,
      qwen3b_base_valid_json_rate: modelScaleAudit.systems.find((row) => row.id === "local_qwen3b_base_control")?.valid_json_rate,
      qwen3b_repaired_inline_citation_rate: modelScaleAudit.systems.find((row) => row.id === "local_qwen3b_base_citation_repair")?.inline_citation_rate,
      rent_gpu_for_bounded_qwen3b_smoke: modelScaleAudit.decision.rent_gpu_for_bounded_qwen3b_smoke,
      rent_cutting_edge_large_gpu_model_now: modelScaleAudit.decision.rent_cutting_edge_large_gpu_model_now,
      interpretation: "Tiny/local students are negative controls: they can learn citation shape or abstain, but they do not preserve support. Local Qwen 3B base inference is feasible but still weak on the citation/JSON contract, and deterministic citation repair fixes syntax without proving support. The next credible trained-student evidence is the bounded Qwen 3B joint-action LoRA smoke, not an open-ended larger GPU experiment.",
    },
    amortization_break_even: {
      run_id: amortizationBreakEven.run_id,
      status: amortizationBreakEven.status,
      planned_offline_investment_usd: amortizationBreakEven.qwen3b_plan.planned_offline_investment_usd,
      estimated_total_after_qwen_smoke_and_judge_usd: amortizationBreakEven.qwen3b_plan.estimated_total_after_qwen_smoke_and_judge_usd,
      within_100_usd_budget: amortizationBreakEven.qwen3b_plan.within_100_usd_budget,
      historical_break_even_rows: amortizationBreakEven.break_even_against_historical_baselines,
      sensitivity_rows: amortizationBreakEven.break_even_sensitivity,
      interpretation: "The Qwen 3B smoke plus judge remains affordable under the $100 cap, and the amortization argument is now explicit as break-even accounting. It is still conditional on passing the grounded-correctness and coverage gates.",
    },
    distillation_loss_accounting: {
      run_id: distillationLossAccounting.run_id,
      status: distillationLossAccounting.status,
      preservation_rows: distillationLossAccounting.preservation_rows.map((row) => ({
        id: row.id,
        family: row.family,
        preserves: row.preserves,
        loses: row.loses,
        answer_rate: row.answer_rate,
        answer_support_rate: row.answer_support_rate,
        overall_judged_correct_rate: row.overall_judged_correct_rate,
      })),
      qwen_acceptance_dimensions: distillationLossAccounting.qwen_acceptance_contract.must_preserve_or_improve.map((row) => row.dimension),
      interpretation: "The current student/scaffold evidence is now framed as preservation and loss: cheap systems preserve some syntax, cost, or support dimensions but lose either coverage, judged support, or contract reliability. The Qwen 3B row must be judged against this contract.",
    },
    corpus_realism_private_kb_gap: {
      run_id: corpusRealism.run_id,
      status: corpusRealism.status,
      supports_evolving_public_domain_kb_claim: corpusRealism.scorecard.supports_evolving_public_domain_kb_claim,
      supports_versioned_domain_kb_extension_candidate: corpusRealism.scorecard.supports_versioned_domain_kb_extension_candidate,
      supports_private_enterprise_kb_claim: corpusRealism.scorecard.supports_private_enterprise_kb_claim,
      supports_writeback_memory_baseline_claim: corpusRealism.scorecard.supports_writeback_memory_baseline_claim,
      interpretation: "The current corpus is an evolving public domain-KB proxy with trusted document dates, not a private enterprise KB. Private-KB generality remains a limitation until a versioned private or enterprise-like corpus is added.",
    },
    versioned_domain_kb_extension_candidate: {
      run_id: versionedKbPrototype.run_id,
      status: versionedKbPrototype.status,
      train_snapshot: versionedKbPrototype.snapshots.train,
      eval_snapshot: versionedKbPrototype.snapshots.eval,
      examples: versionedKbPrototype.examples,
      claim_boundary: versionedKbPrototype.claim_boundary,
      interpretation: "The git-doc prototype shows how to instantiate immutable train/eval KB snapshots with line-citation examples and stale-snapshot abstentions, but it remains deterministic and not private-enterprise proof.",
    },
    versioned_domain_kb_eval: {
      run_id: versionedKbEval.run_id,
      status: versionedKbEval.status,
      naive_copy_first: versionedKbEval.systems.find((row) => row.id === "copy_first_evidence"),
      prefix_retriever_snapshot_guard: versionedKbEval.systems.find((row) => row.id === "prefix_retriever_snapshot_guard"),
      interpretation: "On the deterministic git-doc prototype, naive citation-copy over-answers stale snapshot queries, while a snapshot-aware prefix retriever handles both update answers and stale abstentions.",
    },
    versioned_writeback_diagnostic: {
      run_id: versionedWritebackDiagnostic.run_id,
      status: versionedWritebackDiagnostic.status,
      train_only_writeback: versionedWritebackDiagnostic.systems.find((row) => row.id === "leak_safe_train_writeback_only"),
      train_writeback_plus_live_snapshot: versionedWritebackDiagnostic.systems.find((row) => row.id === "leak_safe_train_writeback_plus_live_snapshot"),
      leaky_eval_writeback_upper_bound: versionedWritebackDiagnostic.systems.find((row) => row.id === "leaky_eval_writeback_upper_bound"),
      interpretation: versionedWritebackDiagnostic.key_result.interpretation,
    },
    versioned_kb_naturalness_gap: {
      run_id: versionedKbNaturalnessAudit.run_id,
      status: versionedKbNaturalnessAudit.status,
      template_question_rate: versionedKbNaturalnessAudit.aggregate.template_question_rate,
      prefix_leakage_rate: versionedKbNaturalnessAudit.aggregate.prefix_leakage_rate,
      synthesis_question_rate: versionedKbNaturalnessAudit.aggregate.synthesis_question_rate,
      supports_natural_versioned_kb_benchmark_claim: versionedKbNaturalnessAudit.scorecard.supports_natural_versioned_kb_benchmark_claim,
      required_upgrade_artifacts: versionedKbNaturalnessAudit.required_upgrade_artifacts,
      interpretation: versionedKbNaturalnessAudit.paper_implication,
    },
    versioned_kb_natural_question_probe: {
      run_id: versionedKbNaturalQuestions.run_id,
      status: versionedKbNaturalQuestions.status,
      examples_written: versionedKbNaturalQuestions.examples_written,
      openai_calls: versionedKbNaturalQuestions.llm_budget.openai_llm_calls,
      run_cost_usd: versionedKbNaturalQuestions.run_cost_usd,
      template_question_rate: versionedKbNaturalQuestions.aggregate.template_question_rate,
      prefix_leakage_rate: versionedKbNaturalQuestions.aggregate.prefix_leakage_rate,
      snapshot_label_rate: versionedKbNaturalQuestions.aggregate.snapshot_label_rate,
      synthesis_question_rate: versionedKbNaturalQuestions.aggregate.synthesis_question_rate,
      interpretation: "A single ledgered question-authoring pass removes most deterministic wording leakage while keeping answers/citations anchored to source snapshot labels; it is a benchmark-construction probe, not model evidence.",
    },
    versioned_kb_natural_question_eval: {
      run_id: versionedKbNaturalQuestionEval.run_id,
      status: versionedKbNaturalQuestionEval.status,
      naturalness_surface: versionedKbNaturalQuestionEval.source_question_metrics,
      copy_first_evidence: versionedKbNaturalQuestionEval.systems.find((row) => row.id === "copy_first_evidence"),
      lexical_retriever_snapshot_guard: versionedKbNaturalQuestionEval.systems.find((row) => row.id === "lexical_retriever_snapshot_guard"),
      key_result: versionedKbNaturalQuestionEval.key_result,
      interpretation: "After natural-question rewriting, naive citation-copy still fails every stale train-snapshot abstention, while a lexical snapshot-aware guard preserves the stale-KB diagnostic with one remaining stable-question retrieval miss.",
    },
    joint_action_packet_quality: {
      run_id: packetQualityAudit.run_id,
      status: packetQualityAudit.status,
      sft_rows: packetQualityAudit.aggregate.sft.rows,
      dpo_rows: packetQualityAudit.aggregate.dpo.rows,
      dpo_chosen_grounded_answer_rows: packetQualityAudit.aggregate.dpo.chosen_grounded_answer_rows,
      dpo_chosen_abstain_rows: packetQualityAudit.aggregate.dpo.chosen_abstain_rows,
      train_eval_paper_overlap: packetQualityAudit.aggregate.train_eval_paper_overlap.length,
      interpretation: "The Qwen 3B packet passes a zero-cost pre-launch audit for repair/abstain preference coverage, inline citations, and train/eval paper separation.",
    },
    joint_action_script_contract: {
      run_id: scriptContractAudit.run_id,
      status: scriptContractAudit.status,
      command_count: scriptContractAudit.commands.length,
      smoke_command: scriptContractAudit.smoke_command,
      expected_artifacts: scriptContractAudit.expected_artifacts,
      interpretation: "The Qwen 3B smoke scripts pass zero-cost local compile, dataset-validator, runner-syntax, bounded-command, and judge-ready-artifact checks before paid GPU launch.",
    },
    joint_action_smoke_cost_accounting: {
      run_id: smokeLedgerFinalizer.run_id,
      status: smokeLedgerFinalizer.status,
      ledger_action: smokeLedgerFinalizer.ledger.action,
      total_if_recorded_usd: smokeLedgerFinalizer.budget_gate.total_if_recorded_usd,
      interpretation: "The post-smoke cost finalizer is ready to record actual external compute spend only after smoke artifacts exist and the $100 budget gate passes.",
    },
    prime_smoke_runbook: {
      run_id: primeRunbook.run_id,
      status: primeRunbook.status,
      bootstrap_script: primeRunbook.bootstrap_script.path,
      runbook_steps: primeRunbook.runbook_steps.map((row) => row.id),
      interpretation: "The Prime handoff now has explicit auth, live-price, pod-create, sync, bootstrap, fetch, cost-finalize, and terminate steps, but it still cannot run until Prime auth succeeds.",
    },
    prime_auth_price_gate: {
      run_id: primeAuthPriceGate.run_id,
      status: primeAuthPriceGate.status,
      checks: primeAuthPriceGate.checks.map((row) => ({ id: row.id, status: row.status })),
      interpretation: "The live backend gate is now executable; it currently fails closed on Prime auth before wallet or GPU price can be verified.",
    },
    qwen3b_result_integration_gate: {
      run_id: qwenResultIntegration.run_id,
      status: qwenResultIntegration.status,
      target: qwenResultIntegration.baseline_targets.minimum_acceptance,
      qwen_metrics_available: Boolean(qwenResultIntegration.qwen_metrics),
      fixture_audit_run_id: qwenIntegrationFixtureAudit.run_id,
      fixture_audit_status: qwenIntegrationFixtureAudit.status,
      syntax_only_rejection_run_id: qwenSyntaxOnlyRejectionAudit.run_id,
      syntax_only_rejection_status: qwenSyntaxOnlyRejectionAudit.status,
      local_control_non_substitution_run_id: qwenLocalControlNonSubstitutionAudit.run_id,
      local_control_non_substitution_status: qwenLocalControlNonSubstitutionAudit.status,
      interpretation: "The final Qwen result now has a fail-closed integration gate that will compare it against the direct baseline and 70% coverage-constrained frontier before any Pareto or paper claim. A 100% inline-citation syntax-only fixture is explicitly rejected, and local base/repaired Qwen controls are rejected as final trained-smoke substitutes.",
    },
    qwen3b_remote_provenance_gate: {
      run_id: remoteProvenanceGate.run_id,
      status: remoteProvenanceGate.status,
      core_artifacts_complete: remoteProvenanceGate.checks.core_artifacts_complete,
      provenance_artifacts_complete: remoteProvenanceGate.checks.provenance_artifacts_complete,
      required_remote_provenance: remoteProvenanceGate.required_remote_provenance,
      interpretation: "A trained-student result is not judge-ready until it includes Prime pod status, remote environment, bootstrap manifest, and bounded smoke manifest provenance.",
    },
  },
  related_work_positioning: {
    drag_like: {
      run_id: drag.run_id,
      closest_direct_correct_rate: drag.systems.find((row) => row.id === "direct_mini_rag_student")?.support_metrics?.overall_judged_correct_rate,
      risk_gate_correct_rate: drag.systems.find((row) => row.id === "zero_call_risk_gate_over_direct_student")?.support_metrics?.overall_judged_correct_rate,
      claim: drag.synthesis.conclusion_for_paper,
    },
    longcite_style: {
      run_id: longcite.run_id,
      headline: longcite.synthesis.headline,
      key_gap: longcite.synthesis.syntax_support_gap,
    },
    writeback_scope: {
      run_id: writeback.run_id,
      status: writeback.status,
      scoped_reason: writeback.related_work_framing.exclusion_reason,
      diagnostic_run_id: versionedWritebackDiagnostic.run_id,
      train_only_overall_correct_rate: versionedWritebackDiagnostic.systems.find((row) => row.id === "leak_safe_train_writeback_only")?.overall_correct_rate,
      train_plus_live_overall_correct_rate: versionedWritebackDiagnostic.systems.find((row) => row.id === "leak_safe_train_writeback_plus_live_snapshot")?.overall_correct_rate,
      leaky_stale_answer_rate: versionedWritebackDiagnostic.systems.find((row) => row.id === "leaky_eval_writeback_upper_bound")?.by_type?.stale_snapshot_abstention?.answer_rate,
    },
  },
  qwen3b_required_final_result: {
    launch_plan_run_id: qwenLaunch.run_id,
    remote_smoke_plan_run_id: qwenRemote.run_id,
    post_smoke_pipeline_run_id: qwenPipeline.run_id,
    base_model: qwenLaunch.base_model,
    planned_gpu_estimate_usd: amortizationBreakEven.qwen3b_plan.planned_gpu_estimate_usd,
    planned_judge_estimate_usd: amortizationBreakEven.qwen3b_plan.planned_judge_estimate_usd,
    estimated_total_after_smoke_and_judge_usd: amortizationBreakEven.qwen3b_plan.estimated_total_after_qwen_smoke_and_judge_usd,
    smoke_ledger_finalizer_run_id: smokeLedgerFinalizer.run_id,
    prime_runbook_run_id: primeRunbook.run_id,
    qwen_result_integration_run_id: qwenResultIntegration.run_id,
    prime_auth_price_gate_run_id: primeAuthPriceGate.run_id,
    remote_provenance_gate_run_id: remoteProvenanceGate.run_id,
    model_scale_audit_run_id: modelScaleAudit.run_id,
    qwen_integration_fixture_audit_run_id: qwenIntegrationFixtureAudit.run_id,
    qwen_syntax_only_rejection_audit_run_id: qwenSyntaxOnlyRejectionAudit.run_id,
    qwen_local_control_non_substitution_audit_run_id: qwenLocalControlNonSubstitutionAudit.run_id,
    amortization_break_even_run_id: amortizationBreakEven.run_id,
    distillation_loss_accounting_run_id: distillationLossAccounting.run_id,
    planned_offline_investment_usd: amortizationBreakEven.qwen3b_plan.planned_offline_investment_usd,
    current_pipeline_status: qwenPipeline.conclusion.status,
    local_control_substitution_status: qwenLocalControlNonSubstitutionAudit.status,
    blocked_claims: [
      "A trained Qwen 3B joint-action student improves citation-grounded correctness.",
      "Joint-action SFT/DPO preserves support better than the zero-call scaffold baselines.",
      "The final system is NeurIPS-ready.",
    ],
    unblock_commands: {
      smoke: qwenRemote.command,
      post_smoke_default: qwenPipeline.commands.integrity_gate,
      post_smoke_pipeline: `node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=${qwenPipeline.prediction_run_id} --packet-run-id=${qwenPipeline.packet_run_id} --run-id=${qwenPipeline.run_id} --model=${qwenPipeline.model} --split=${qwenPipeline.split} --max-budget-usd=100`,
      paid_pipeline: `node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=${qwenPipeline.prediction_run_id} --packet-run-id=${qwenPipeline.packet_run_id} --run-id=${qwenPipeline.run_id} --model=${qwenPipeline.model} --split=${qwenPipeline.split} --max-budget-usd=100 --run-paid=true`,
    },
  },
  judge_reliability_constraints: {
    run_id: abstentionReliability.run_id,
    source_second_pass_run_id: abstentionReliability.source_second_pass_run_id,
    overall_exact_agreement_rate: abstentionReliability.overall_exact_agreement_rate,
    unstable_buckets: abstentionReliability.unstable_buckets,
    questionable_abstention_exact_agreement_rate: abstentionReliability.by_audit_type.questionable_abstention.exact_agreement_rate,
    disagreement_taxonomy_run_id: judgeDisagreementTaxonomy.run_id,
    disagreement_rate: judgeDisagreementTaxonomy.source_summary.disagreement_rate,
    disagreement_taxonomy: judgeDisagreementTaxonomy.taxonomy,
    constraints: abstentionReliability.manuscript_constraints,
    interpretation: "The second-pass judge supports reporting unsupported-answer checks, but the disagreement taxonomy shows abstention-boundary reversals dominate the remaining disagreements, so abstention-boundary claims remain unstable and must be caveated.",
  },
  manuscript_outline: [
    {
      section: "Introduction",
      evidence: ["Problem framing from README", "D101 novelty narrowing", "novelty-watchlist-2026-06-26-v1"],
      current_status: "draftable",
    },
    {
      section: "Dataset and Evolving-KB Protocol",
      evidence: [trustedDates.run_id, versionedKbPrototype.run_id, versionedKbEval.run_id, versionedWritebackDiagnostic.run_id, versionedKbNaturalnessAudit.run_id, versionedKbNaturalQuestions.run_id, versionedKbNaturalQuestionEval.run_id, "extended_temporal_future_holdout-manifest.json"],
      audit: corpusRealism.run_id,
      current_status: "draftable_with_public_proxy_caveat",
    },
    {
      section: "Post-Training Data Construction",
      evidence: ["teacher/repaired label exports", policyAblation.run_id, coverageFrontier.run_id, distillationLossAccounting.run_id, packetQualityAudit.run_id, "support-contrast-prep-judge-support-direct-repair-0-320-to-321-389-v1", qwenLaunch.packet_run_id],
      current_status: "draftable",
    },
    {
      section: "Baselines and Ablations",
      evidence: [drag.run_id, longcite.run_id, writeback.run_id, versionedWritebackDiagnostic.run_id, transfer.run_id, guard.run_id, amortizationBreakEven.run_id],
      current_status: "draftable",
    },
    {
      section: "Final Trained Student Result",
      evidence: [qwenRemote.expected_artifacts.predictions_jsonl, qwenPipeline.paid_judge_run_id],
      current_status: "blocked_until_qwen3b_smoke_and_judge",
    },
    {
      section: "Limitations and Threat Model",
      evidence: ["public arXiv proxy, not private KB", abstentionReliability.run_id, judgeDisagreementTaxonomy.run_id, "coverage/support tradeoff", "remote GPU auth blocker"],
      current_status: "draftable",
    },
  ],
  allowed_claims_now: [
    "Support-aware local scaffolds can improve judged correctness over direct mini repair on dated QASPER/arXiv future windows, at a clear coverage cost.",
    "Citation formatting alone is insufficient: high inline citation compliance can coexist with very low judged answer support.",
    "A blind second-pass judge agrees with the original support judge on many hard unsupported-answer and sanity-check cases; a disagreement taxonomy shows remaining disagreements are mostly abstention-boundary reversals.",
    "The current protocol has a trusted dated public-KB proxy and explicit budget accounting, but not yet the final trained Qwen 3B student result.",
    "The planned Qwen 3B smoke and judge have explicit break-even accounting under the $100 cap, conditioned on the missing quality gate.",
  ],
  claims_to_avoid_until_qwen3b: [
    "A smaller trained model has been shown to preserve citation-grounded correctness.",
    "Joint-action SFT/DPO beats the existing scaffolds.",
    "The work is ready as a NeurIPS submission.",
    "The evaluation proves behavior over private enterprise KBs rather than a public dated proxy.",
    "The git-doc prototype is a natural versioned-KB benchmark rather than a deterministic snapshot diagnostic.",
  ],
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    external_compute_actual_usd: budget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This manuscript evidence map reads local artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

async function readResult(runId) {
  return readJson(path.join(runDir, runId, "result.json"));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

function renderReport(result) {
  return `# Manuscript Evidence Map

Generated: ${result.generated_at}

Status: \`${result.readiness.status}\` (${result.readiness.passed_requirements}/${result.readiness.passed_requirements + result.readiness.failed_requirements} readiness requirements passing)

## What Can Be Claimed Now

${result.allowed_claims_now.map((claim) => `- ${claim}`).join("\n")}

## Claims To Avoid

${result.claims_to_avoid_until_qwen3b.map((claim) => `- ${claim}`).join("\n")}

## Main Current Result

| System | Overall judged correctness | Answer support | Answered |
| --- | ---: | ---: | ---: |
| Direct mini + citation repair | ${pct(result.current_main_results.deterministic_claim_entailment_guard.direct_correct_rate)} | ${pct(result.current_main_results.zero_call_risk_gate_transfer.direct_answer_support_rate)} | ${guardNumber(guard.policies.direct_mini_repair.answered)} |
| Balanced zero-call risk gate | ${pct(result.current_main_results.deterministic_claim_entailment_guard.gate_correct_rate)} | ${pct(result.current_main_results.zero_call_risk_gate_transfer.gate_answer_support_rate)} | ${guardNumber(guard.policies.balanced_risk_gate.answered)} |
| Risk gate + deterministic claim-entailment guard | ${pct(result.current_main_results.deterministic_claim_entailment_guard.guard_correct_rate)} | ${pct(result.current_main_results.deterministic_claim_entailment_guard.guard_answer_support_rate)} | ${guardNumber(result.current_main_results.deterministic_claim_entailment_guard.guard_answered)} |

## Required Final Result

- Base model: \`${result.qwen3b_required_final_result.base_model}\`
- Current pipeline status: \`${result.qwen3b_required_final_result.current_pipeline_status}\`
- Local control substitution status: \`${result.qwen3b_required_final_result.local_control_substitution_status}\`
- Estimated total after GPU smoke and judge: $${result.qwen3b_required_final_result.estimated_total_after_smoke_and_judge_usd.toFixed(4)}

The Qwen 3B result and its grounded-correctness judge are still missing. The manuscript must not claim a trained-student win until those artifacts exist.

## Manuscript Outline Status

| Section | Status | Evidence |
| --- | --- | --- |
${result.manuscript_outline.map((row) => `| ${row.section} | ${row.current_status} | ${row.evidence.join("<br>")} |`).join("\n")}

## Budget

- Actual total spend: $${result.budget.actual_total_spend_usd.toFixed(6)}
- External compute spend: $${result.budget.external_compute_actual_usd.toFixed(6)}
- Remaining: $${result.budget.remaining_budget_usd.toFixed(6)}

This evidence map makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

function guardNumber(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : "n/a";
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
