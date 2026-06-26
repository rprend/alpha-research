# Qwen 3B Syntax-Only Rejection Audit

Generated: 2026-06-26T23:27:50.099Z

Status: `syntax_only_result_rejected`

Source repair run: `local-qwen3b-citation-repair-local-qwen3b-base-control-joint-action-12-v1`

| Inline citation rate | Synthetic answer support | Synthetic overall correct | Expected integration status | Observed integration status |
| ---: | ---: | ---: | --- | --- |
| 100.0% | 40.0% | 30.0% | `qwen3b_negative_ready_for_pareto_update` | `qwen3b_negative_ready_for_pareto_update` |

## Conclusion

The integration gate rejected a fixture with 100% inline citation rate because support/correctness failed the direct-baseline target.

This audit makes no OpenAI calls, launches no GPU jobs, records no spend, and removes temporary fixture run directories.
