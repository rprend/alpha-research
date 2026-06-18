# Remote Agent Runner Contract

`scripts/run_remote_agent.py` executes Codex inside a Modal worker with the shared dataset mounted at `/data`.
By default it uses `codex exec` for non-interactive research runs. Canonical bootstrap configs may request `execution.codexMode = "tui"`; in that mode the runner launches the interactive Codex TUI under a PTY with `--dangerously-bypass-approvals-and-sandbox` and sends the configured `/goal` envelope plus the full bootstrap prompt as the initial prompt.

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
- `OPENAI_PROXY_BASE_URL`
- `RUNNER_TOKEN`

## Required Outputs

Every successful run must produce deliverable files in `ARTIFACT_DIR`. Bookkeeping artifacts such as the remote agent summary, transcript, or session id prove that the worker ran, but they do not count as task completion. The Modal results volume is a staging area only; completed artifacts are copied into the Cloudflare R2 artifact bucket through the control-plane artifact callback and indexed in `run_artifacts`.

The required filesystem outputs for user-facing research and describe runs are:

- `report.html` as the primary human-readable deliverable
- `result.json` as the machine-readable answer
- `work.md` as the agent-facing work log
- `dataset_coverage.json` as the dataset availability and gap log
- optional supporting files such as `analysis.py`, `figures/*.png`, `tables/*.csv`, and `queries/*.sql`

If Codex exits successfully but the required deliverable files are missing or invalid, the runner must mark the run `failed` rather than `ready`.

`report.html` is the user-facing research deliverable. It must read like a polished applied research report or expert memo for a senior stakeholder. It must include recognizable sections for executive summary, data/methods, evidence, limitations, and next steps. It should make liberal use of tables and figures to summarize data, compare estimates, show uncertainty, display robustness checks, and make the empirical logic easy to inspect. File lists, implementation notes, and command logs belong in `work.md` unless they directly support a research finding.

`result.json` must parse as a JSON object with `answer`, `claims`, `evidence`, `confidence`, `limitations`, `sourceDatasetIds`, `datasetCoverage`, `missingDatasets`, `provisionalWebSources`, `claimsAllowedToDriveConclusion`, and `claimsNotAnswerableFromMountedData`. `tables` and `charts` are optional arrays for companion metadata. Claims should reference evidence records so agents can inspect why the answer is trustworthy without reading the whole report.

All ordinary research runs are dataset-grounded. The remote agent must inventory the mounted dataset before answering, map each empirical/comparative/causal claim to the required dataset or table, and cite dataset id, path, table, columns, filters, and row counts when local data is used. Public web sources can discover datasets, verify simple event facts, document source meaning, or provide clearly labeled provisional context, but they do not satisfy the grounding requirement unless the run saves source data as an artifact with provenance.

`dataset_coverage.json` must parse as a JSON object with `requiredDatasets`, an array of per-claim dataset coverage records. Each record must include `claimId`, `datasetNeed`, `status`, and `canDriveConclusion`. `status` must be one of `available`, `partial`, `missing`, `inaccessible`, or `not-data-answerable`. Missing or insufficient datasets should include candidate source names, URLs when known, access constraints, priority, and acquisition notes so future canonical dataset jobs can close the gap.

ResearchVagueClaim workflow runs use the same artifact bundle, with an additional structured contract inside `result.json`. When a user asks Alpha Research to test, rate, decompose, fact-check, or adjudicate a broad claim, the runner prompt requires dataset-first decomposition: preserve the native claim, define the exact data needed for each empirical/comparative/causal subclaim, inventory the mounted dataset, analyze local data when present, log missing datasets when absent, and assign H1/H2/H3 only from dataset-grounded evidence. The `ResearchVagueClaim` object must include:

- `originalClaim`: the claim in its native wording.
- `decomposedClaims`: falsifiable empirical subclaims, plus any definitional, normative, or non-observable residues.
- `dataSourcePlan`: candidate sources, observable proxies, joins, transformations, and expected limits for each subclaim.
- `observabilityAssessment`: per-subclaim ratings that separate highly observable, partially observable, and non-observable issues.
- `hypothesisRatings`: ratings for H1, H2, and H3, each with rationale, evidence references, and limitations.
- `finalRating`: one of H1, H2, or H3.

The hypothesis scale is intentionally generic: H1 means the broad claim is basically supported, H2 means it is technically narrow or partly supported but substantively misleading, and H3 means the claim uses the wrong frame or is contradicted/orthogonal to the observed reality.

`work.md` must include commands run, an intermediate reasoning summary, blockers, and reproduction notes. It is the compact agent artifact for recovery and follow-up work, not the primary human answer.

`canonical-dataset-bootstrap` jobs are the exception to the user-facing report contract. They are employee-side dataset maintenance jobs and must complete with `dataset_briefing.md`, source inventories, docs mirror manifests, and any required JSON/CSV artifacts specified in run config. `work.md` is optional bookkeeping for bootstrap jobs, not a completion gate. They should not write `report.html` unless the bootstrap prompt explicitly asks for one.

After upload, the dashboard reads artifact metadata from the control plane and artifact bytes from the authenticated `/api/cli/artifacts/:artifactId/content` route. Dashboard rendering must not depend on the Modal worker or a live Modal container after a run reaches `ready`.

## Resume Contract

A run is resumable only when the runner captured a Codex session id and uploaded a `remote_agent_session` artifact with `content.sessionId`. Continuation starts a new control-plane run with `config.remoteAgentSessionId` and invokes `codex resume` against that session.

Partial artifacts, transcripts, session entries, and run events are salvage context, but they are not proof that the original Codex session can be resumed. When a failed run has no `remote_agent_session` artifact, the assistant and dashboard should describe it as retryable from saved context rather than resumable.

## Heartbeats

Long-running work should send status and event heartbeats at least every `REMOTE_AGENT_HEARTBEAT_SECONDS` seconds. Before posting each status callback, the runner writes durable worker status to `RUN_STATUS_PATH` when provided.

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

## Billing Contract

Remote Codex model traffic must go through the metered OpenAI proxy at `OPENAI_PROXY_BASE_URL`. The runner must fail before starting Codex if `OPENAI_PROXY_BASE_URL` or `RUNNER_TOKEN` is missing. Codex uses `RUNNER_TOKEN` as its API key and a named OpenAI-compatible Responses provider with `supports_websockets=false`; the real OpenAI API key stays on the Cloudflare Worker. Do not point remote runs at Codex's default OpenAI provider with only `openai_base_url`, because Codex may attempt the Responses WebSocket transport and the Alpha Research metering proxy only supports HTTP Responses requests.

The proxy checks the run owner's billing allowance before each model request. Successful model responses must include OpenAI usage and must be recorded as `remote_codex_runner` billing events against the run owner. If usage cannot be extracted or the billing event cannot be recorded, the proxy returns a metering failure and the run stops instead of continuing unmetered.

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

Secrets come from Modal Secrets. Remote Codex runs do not receive the real OpenAI API key; they receive only the runner token and the metered proxy URL. Secrets are environment variables only and must not be written into prompts, logs, callback payloads, artifacts, transcripts, or mounted volumes.

Use `pnpm modal:deploy` to deploy the Modal app, `pnpm modal:submit -- --job-id <id> --prompt <prompt>` for direct smoke jobs, and `pnpm modal:sync-dataset -- --dataset-id <id> --source <local path>` to upload public datasets into `agent-dataset:/datasets/<id>/`.
