# Pool-Adjudicated Selector

Generated: 2026-06-28T10:31:10.424Z

Status: `pool_adjudicated_selector_partial_signal`

This run makes no new LLM calls. It trains on paid non-final GPT-4o pool adjudications and uses final-window labels only as forbidden diagnostics.

| Split | Items | Correct/selected | Rate |
| --- | ---: | ---: | ---: |
| Train pool choice | 14 | 10 | 71.4% |
| Adjudication validation pool choice | 6 | 5 | 83.3% |
| Existing validation pairwise | 24 | 20 | 83.3% |
| Final diagnostic pairwise | 61 | 35 | 57.4% |
| Final diagnostic selection | 8 | 3 | 37.5% |

## Decision

- Integrate selector now: no
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: Pool-adjudicated and hybrid selectors do not clear the final diagnostic selection threshold.
- Next step: Use pool adjudication as evidence that listwise labels are reliable, but inspect remaining final misses before buying more labels or launching GPU generation.
