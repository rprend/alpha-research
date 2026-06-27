# Compact Faithful Context QA Comparison

Generated: 2026-06-27T00:33:35.687Z

Close neighbor: [OCC-RAG: Optimal Cognitive Core for Faithful Question Answering](https://arxiv.org/html/2606.00683v1)

## Framing

- Overlap: Compact models for faithful context QA with source citations and safe abstention are a close final-system surface.
- Distinction: This project must be evaluated over evolving/update-heldout KB states with explicit answer support, citation support/recall, abstention boundaries, coverage, and amortized cost. Citation syntax or compact context QA alone is not novel enough.

## Dimensions

### compact_context_qa_surface

Does the system answer from a compact evidence pack?

- direct_mini_repair: Direct compact-evidence QA baseline.
- claim_entailment_guard: Same compact evidence surface plus support-aware guard.
- zero_call_span_distilled_scaffold: Local scaffold selects from compact evidence.
- local_qwen05b_sft_answer_repeat2: Tiny SFT model uses compact evidence prompts.
- local_qwen3b_base_citation_repair: Local Qwen 3B base-control uses joint-action compact prompts but is untrained.

### faithfulness_support

Does answer support survive judging?

- direct_mini_repair: 64.1%; Moderate support but many unsupported answers.
- claim_entailment_guard: 74.1%; Best current support-first zero-extra-call point, with coverage loss.
- zero_call_span_distilled_scaffold: 19.2%; Weak support despite high answer rate.
- local_qwen05b_sft_answer_repeat2: 5.0%; Citation-format learning without support preservation.
- local_qwen3b_base_citation_repair: No paid support judge; syntax repair is not faithfulness evidence.

### citation_grounding

Does citation evidence remain meaningful rather than just syntactically present?

- direct_mini_repair: 70.4%; Reference citation recall is incomplete but non-trivial.
- claim_entailment_guard: 55.1%; Support improves while citation recall drops with coverage.
- zero_call_span_distilled_scaffold: 58.0%; Span citation recall is not enough when support is weak.
- local_qwen05b_sft_answer_repeat2: 30.7%; Low citation recall despite high inline citation syntax.
- local_qwen3b_base_citation_repair: Citation repair lifts inline syntax to 100% without changing cited evidence ids or support.

### safe_abstention

Does the system abstain when evidence is insufficient?

- direct_mini_repair: 100.0%; Strong abstention support where it abstains.
- claim_entailment_guard: 95.3%; Strong but not perfect abstention support.
- zero_call_span_distilled_scaffold: 100.0%; Strong abstentions but weak answered support.
- local_qwen05b_sft_answer_repeat2: 93.1%; Mostly good abstentions, weak answered support.
- local_qwen3b_base_citation_repair: Unjudged on abstention support; local syntax repair cannot establish safe abstention.

### evolving_kb_update_holdout

Does the comparison test dated/update-heldout KB behavior?

- current_project_protocol: Dated QASPER/arXiv proxy plus versioned git-doc diagnostic exist.
- occ_style_baseline_needed: A true compact faithful-context-QA baseline would need to run on the same dated/versioned splits.

### amortized_inference_cost

Does cheaper inference avoid per-query LLM verification?

- direct_mini_repair: 0.0%; Still uses one online OpenAI call/query.
- claim_entailment_guard: 0.0%; Adds no extra verifier call but still wraps an API student.
- zero_call_span_distilled_scaffold: 100.0%; Zero online OpenAI calls but quality is weak.
- local_qwen05b_sft_answer_repeat2: 100.0%; Zero online OpenAI calls but support is weak.
- planned_qwen3b_joint_action: 100.0%; Target is zero-call deployed inference after bounded offline GPU+judge spend.

## Claim Boundary

- Do not claim the project is the first compact faithful-context-QA model.
- Do not claim citation syntax or source-citation formatting as grounded correctness.
- Claim only the narrower update-heldout amortization question after Qwen 3B is judged.

## True Baseline Needed

- Run an OCC-RAG-like compact faithful-context-QA model on the same compact evidence packs and final dated/versioned KB windows.
- Judge it with the same answer support, abstention support, citation recall, and coverage metrics.
- Report cost per query and whether any per-query verifier/teacher is used.
- Compare against the Qwen joint-action row after the trained Qwen smoke exists.

No OpenAI calls, GPU jobs, or new spend were made for this artifact.
