# Alpha Research Codex Plugin Smoke Report

Date: 2026-05-04
Workspace: /Users/ryanprendergast/Documents/Zenobia Pay/alpha-research
Installed plugin: /Users/ryanprendergast/.codex/plugins/alpha-research
Bundled plugin source: /Users/ryanprendergast/Documents/Zenobia Pay/alpha-datasets/plugins/alpha-research

## Plugin Verification

- New Codex thread `019df474-f17a-7cf1-8f30-5b411d5c0c23` was started with a temporary `alpha-research` MCP config and successfully called `research_login_status`.
- MCP initialize returned server `alpha-research` version `0.1.0`.
- `tools/list` returned 15 tools.
- Direct launch without `ALPHA_RESEARCH_REPO_ROOT` fails because manual execution does not load the plugin `.mcp.json` environment. Launching through Codex plugin config or setting `ALPHA_RESEARCH_REPO_ROOT=/Users/ryanprendergast/Documents/Zenobia Pay/alpha-datasets` loads the CLI dist correctly.
- Sanitization scan passed for token, bearer, authorization, and presigned URL patterns. Raw JSONL captures were removed after the summarized report was written.

## Live Account Tool Transcript

| Step | MCP tool | Result |
| --- | --- | --- |
| 1 | `research_login_status` | Signed in to `https://alpharesearch.nyc` as the live account; no token fields returned. |
| 2 | `research_list_datasets` | Returned 15 datasets. `econ` is present. |
| 3 | `research_get_dataset` | `econ`: status `ready`, deployment `ready`, manifest `/mnt/alpha-research/datasets/econ/manifest.json`. |
| 4 | `research_list_runs` | Returned 105 recent runs. Most recent: `c101d29f-cfa0-4337-ad74-98bb3a6c43d0` (sociology, agent, ready). |
| 5 | `research_get_run_results` | Inspected `d53cee89-3aea-4103-9f15-968cc89d13f0`: status `ready`, artifacts 5, events 148. |
| 6 | `research_list_run_artifacts` | Listed 5 artifacts for `d53cee89-3aea-4103-9f15-968cc89d13f0`: remote_agent_summary:Remote Agent Summary, remote_agent_transcript:Remote Agent Transcript, structured_result:meta_summary.json, structured_result:result.json, file:summary.md. |
| 7 | `research_start_run` | Started tiny `analysis` smoke run `f6bd72f3-c4ff-4f36-a7d8-0f9a440136bd` on `econ` with manifest/profile-only prompt. |
| 8 | `research_wait_for_run` | Run reached terminal status `ready` at `2026-05-04T19:23:47.974Z`; output preview: "Remote agent run completed with 4 artifact(s).". |
| 9 | `research_list_run_artifacts` | Listed 4 artifacts for smoke run: remote_agent_summary:Remote Agent Summary, remote_agent_transcript:Remote Agent Transcript, structured_result:result.json, file:summary.md. |

## Notes

The live product run completed successfully. The only issue found during verification was redaction coverage: historical remote session payloads can include signed upload URLs inside nested transcript metadata. The plugin redactor now masks signed URL fields and presigned URLs embedded in strings before returning MCP tool output.
