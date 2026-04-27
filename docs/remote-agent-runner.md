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

Every successful run must produce at least one callback artifact. The preferred filesystem outputs are:

- `summary.md`
- `result.json` when structured data is appropriate
- optional tables, charts, scripts, and notebooks in `ARTIFACT_DIR`

## Heartbeats

Long-running work should send status and event heartbeats at least every `REMOTE_AGENT_HEARTBEAT_SECONDS` seconds. The control plane treats missing heartbeats as a failure signal.

## Failure Contract

On failure, the runner must:

- post an error-level run event
- post `failed` status with a short preview
- preserve transcript output when available
- avoid leaking presigned URLs or secrets into artifacts
