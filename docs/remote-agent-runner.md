# Remote Agent Runner Contract

`scripts/run_remote_agent.py` executes Codex inside a dataset-attached cloud workspace.

## Required Inputs

- `RUN_ID`
- `RUN_TYPE`
- `DATASET_ID`
- `PROMPT_B64`
- `DATASET_MOUNT_PATH`
- `MANIFEST_PATH`
- `WORKSPACE_DIR`
- `ARTIFACT_DIR`
- callback URLs for events, status, artifacts, and session entries
- `RUNNER_TOKEN`

## Required Outputs

Every successful run must produce deliverable files in `ARTIFACT_DIR`. Bookkeeping artifacts such as the remote agent summary, transcript, or session id prove that the worker ran, but they do not count as task completion.

The required primary filesystem output is:

- `report.html` when the prompt requests `report.html`, an HTML report, or a self-contained HTML output
- `summary.md` otherwise

- `result.json` when structured data is appropriate
- optional tables, charts, scripts, and notebooks in `ARTIFACT_DIR`

If Codex exits successfully but the required deliverable files are missing, the runner must mark the run `failed` rather than `ready`.

## Heartbeats

Long-running work should send status and event heartbeats at least every `REMOTE_AGENT_HEARTBEAT_SECONDS` seconds. Before posting each status callback, the runner writes `<dataset mount>/.remote-agent/runs/<run id>/status.json` so worker execution state survives callback outages.

The control plane treats missing heartbeats as `worker_unreachable`, not `failed`. That state means the backend lost contact with the worker before receiving a terminal execution result.

## Failure Contract

On failure, the runner must:

- write durable worker status `failed`
- post an error-level run event
- post `failed` status with a short preview
- preserve transcript output when available
- avoid leaking presigned URLs or secrets into artifacts

Callback delivery is reporting, not execution. Event, session, artifact, and status callbacks retry briefly; if they remain unavailable, the runner records the callback error in the durable worker status file and does not turn that reporting failure into a product run failure.
