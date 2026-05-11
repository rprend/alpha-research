# Remote Agent Runner Contract

`scripts/run_remote_agent.py` executes Codex inside a dataset-attached cloud workspace. It is used by the legacy DigitalOcean runner and by Modal workers.

## Required Inputs

- `RUN_ID`
- `RUN_TYPE`
- `DATASET_ID`
- `PROMPT_B64`
- `DATASET_MOUNT_PATH`
- `MANIFEST_PATH`
- `WORKSPACE_DIR`
- `ARTIFACT_DIR`
- optional `RUN_STATE_DIR` or `RUN_STATUS_PATH`
- optional `DATASET_READ_ONLY=true`
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

Long-running work should send status and event heartbeats at least every `REMOTE_AGENT_HEARTBEAT_SECONDS` seconds. Before posting each status callback, the runner writes durable worker status to `RUN_STATUS_PATH` when provided, otherwise `<dataset mount>/.remote-agent/runs/<run id>/status.json` for legacy DigitalOcean runs.

Modal runs must set `RUN_STATE_DIR` or `RUN_STATUS_PATH` under `/results/<job id>/` because the shared dataset volume is read-only.

The control plane treats missing heartbeats as `worker_unreachable`, not `failed`. That state means the backend lost contact with the worker before receiving a terminal execution result.

## Failure Contract

On failure, the runner must:

- write durable worker status `failed`
- post an error-level run event
- post `failed` status with a short preview
- preserve transcript output when available
- avoid leaking presigned URLs or secrets into artifacts

Callback delivery is reporting, not execution. Event, session, artifact, and status callbacks retry briefly; if they remain unavailable, the runner records the callback error in the durable worker status file and does not turn that reporting failure into a product run failure.

## Modal Runner Contract

Modal workers mount public datasets at `/data`, results at `/results`, and use `/workspace` for writable scratch. Ordinary agent workers treat `/data` as read-only and must not write manifests, status files, temporary files, transcripts, or outputs there.

For Modal jobs:

- `DATASET_MOUNT_PATH=/data`
- `DATASET_READ_ONLY=true`
- `WORKSPACE_DIR=/workspace/<job id>` or `/workspace`
- `ARTIFACT_DIR=/results/<job id>`
- `RUN_STATE_DIR=/results/<job id>/.remote-agent/state`
- `LAST_MESSAGE_PATH=/results/<job id>/last-message.txt`
- `TRANSCRIPT_PATH=/results/<job id>/codex-transcript.log`

Secrets come from Modal Secrets, especially `OPENAI_API_KEY` in `agent-keys`. Secrets are environment variables only and must not be written into prompts, logs, callback payloads, artifacts, transcripts, or mounted volumes.

Use `pnpm modal:deploy` to deploy the Modal app, `pnpm modal:submit -- --job-id <id> --prompt <prompt>` for direct smoke jobs, and `pnpm modal:sync-dataset -- --dataset-id <id> --source <local path>` to upload public datasets into `agent-dataset:/datasets/<id>/`.
