# Modal Worker Migration

## Goal

Move Alpha Research remote Codex execution off DigitalOcean volumes and droplets onto Modal, with one shared Modal Volume for public datasets, isolated per-job scratch space, and per-job result directories.

The migration should preserve the existing control-plane and remote-runner contracts where possible. The first implementation should be a small provider integration, not a rewrite of dashboard state, run lifecycle, artifact callbacks, or Codex transcript handling.

## Current Shape

- `src/control-plane.ts` owns dataset and run state, then calls provider code to provision infrastructure.
- `src/digitalocean.ts` currently owns DigitalOcean volume creation, droplet launch, warm pool management, runner sizing, and bootstrap script generation.
- `scripts/run_remote_agent.py` already knows how to run `codex exec`, stream session entries, post status/events/artifacts, enforce required deliverables, and keep a transcript.
- `src/remote-agent-runner-script.ts` embeds the Python runner for Worker delivery.
- `docs/remote-agent-runner.md` is the runner contract and should remain the source of truth.

The important behavior to keep is: control plane creates a run, infrastructure starts a worker, worker calls back with events/status/artifacts/session entries, and final deliverables appear in the artifact directory.

## Target Modal Shape

- Modal Volume `agent-dataset` mounted at `/data`.
- Modal Volume `agent-results` mounted at `/results`.
- Each job runs in an isolated writable `/workspace`.
- Each job writes final deliverables and bookkeeping artifacts under `/results/<job_id>/`.
- Codex runs from `/workspace`, never from `/data`.
- Codex prompt explicitly says `/data` is read-only, `/workspace` is writable scratch, and final outputs belong in `/results/<job_id>/`.
- `OPENAI_API_KEY` and any future worker secrets come from Modal Secret `agent-keys`.
- Secrets are injected only as environment variables and never written into prompts, files, mounted volumes, transcripts, callback payloads, or logs.

## Non-Goals

- Do not redesign dashboard UX.
- Do not replace the Durable Object control plane.
- Do not move artifact/session callback semantics in the first pass.
- Do not give workers write access to the shared dataset for ordinary research jobs.
- Do not keep DigitalOcean warm pools as the default path after Modal is validated.

## Proposed Files

- `modal_workers/agent_worker.py`: Modal app, image definition, volumes, secret binding, and `run_codex_job`.
- `modal_workers/__init__.py`: package marker if needed.
- `scripts/submit_modal_job.py`: small local/programmatic submit helper for manual testing and external automation.
- `src/modal.ts`: TypeScript provider wrapper used by `src/control-plane.ts` to submit Modal jobs.
- `docs/remote-agent-runner.md`: update with Modal paths and read-only dataset rule.
- `docs/control-plane.md`: update provider/resource terminology from DigitalOcean-specific to provider-neutral where behavior changes.
- `package.json` and lockfile: add Modal-related scripts if useful; Modal itself is a Python dependency, so prefer a Python requirements file unless the existing package workflow needs a script.
- `requirements-modal.txt` or `modal_workers/requirements.txt`: pin `modal` and Python libraries needed by the Modal worker.

## Modal Worker Design

Create a Modal app with a stable name such as `alpha-research-agent-workers`.

The image should install:

- Python 3 runtime and `requests`
- Node.js and npm
- `@openai/codex` or the current Codex CLI package used by production
- `git`
- `ripgrep`
- `fd` or `findutils`
- `jq`
- any existing Python utilities needed by `scripts/run_remote_agent.py`

Conceptual shape:

```python
import modal

app = modal.App("alpha-research-agent-workers")

dataset_volume = modal.Volume.from_name("agent-dataset", create_if_missing=True)
results_volume = modal.Volume.from_name("agent-results", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git", "ripgrep", "fd-find", "jq", "curl", "ca-certificates", "nodejs", "npm")
    .pip_install("requests")
    .run_commands("npm install -g @openai/codex")
)

@app.function(
    image=image,
    volumes={
        "/data": dataset_volume,
        "/results": results_volume,
    },
    secrets=[modal.Secret.from_name("agent-keys")],
    cpu=4,
    memory=8192,
    timeout=3600,
)
def run_codex_job(job_id: str, prompt: str, extra_context: dict | None = None):
    ...
```

`run_codex_job` should create:

- `/workspace/<job_id>` or `/workspace` as the writable working directory.
- `/results/<job_id>` as the artifact directory.
- `/results/<job_id>/codex-home` as `CODEX_HOME`, unless Codex works cleanly with an ephemeral home outside the mounted volumes.
- `/results/<job_id>/codex-transcript.log`.
- `/results/<job_id>/last-message.txt`.
- `/results/<job_id>/status.json`.

The worker should pass `DATASET_MOUNT_PATH=/data`, `WORKSPACE_DIR=/workspace`, and `ARTIFACT_DIR=/results/<job_id>` to the runner. If job-specific dataset subpaths are needed later, keep `/data` as the mount and pass a separate `DATASET_SUBPATH`.

## Runner Changes

Reuse `scripts/run_remote_agent.py`, but remove assumptions that worker status and scratch live under the dataset mount.

Required changes:

- Add optional `RUN_STATE_DIR` or `RUN_STATUS_PATH` environment support.
- Default `RUN_STATE_DIR` to `ARTIFACT_DIR/.remote-agent/state` when provided, not `<dataset>/.remote-agent/runs/<run id>` for Modal jobs.
- Keep `WORKSPACE_DIR`, `ARTIFACT_DIR`, `LAST_MESSAGE_PATH`, and `TRANSCRIPT_PATH` fully environment-driven.
- Make the prompt say the dataset is read-only when `DATASET_READ_ONLY=true`.
- For read-only runs, remove prompt language that tells Codex to create dataset files or write the manifest under `/data`.
- Keep deliverable enforcement unchanged: `report.html` for explicit HTML report requests, otherwise `summary.md`, plus `result.json` when useful.

This is the main compatibility gap: the existing runner writes durable status into `DATASET_MOUNT_PATH/.remote-agent/...`, which violates the Modal read-only dataset model. Move status into `/results/<job_id>/` for Modal before enforcing read-only datasets.

## Control Plane Integration

Add a provider boundary instead of threading Modal calls through UI code.

Recommended first pass:

- Add `src/modal.ts` with `launchModalResearchJob(env, params)` mirroring the useful parts of `launchResearchDroplet`.
- In `src/control-plane.ts`, route research runs to Modal when `REMOTE_AGENT_EXECUTOR=modal` or `RESEARCH_RUNNER_PROVIDER=modal`.
- Keep DigitalOcean available behind an explicit legacy setting during rollout.
- Preserve callback URL construction, run metadata, and artifact/session callback routes.
- Store returned Modal call/job identifiers in run metadata or events for debugging.
- Update stale heartbeat handling to release any logical dataset lease without assuming a DigitalOcean volume attachment.

The Cloudflare Worker cannot directly import Modal's Python SDK. The TypeScript provider should either:

- call a small Modal web endpoint/function exposed by `modal_workers/agent_worker.py`, or
- enqueue jobs through a thin server/API that has Modal credentials.

Use the smallest secure bridge. Do not put Modal tokens in frontend code or prompts.

## Programmatic Job Submission

Support a direct submit helper for local and automation use:

```bash
python scripts/submit_modal_job.py \
  --job-id test-run-001 \
  --prompt "Inspect /data and write /results/test-run-001/summary.md"
```

The helper should:

- import the Modal function or call its deployed endpoint
- accept `job_id`, `prompt`, and optional JSON `extra_context`
- avoid printing secrets
- return the Modal call id and result directory

For control-plane runs, the submit payload should include the existing callback URLs, runner token, run id, run type, dataset id, manifest path, config JSON, artifact spec JSON, and model.

## Dataset Migration

Treat public datasets as shared read-only data on one Modal Volume.

Plan:

1. Create or reference `agent-dataset`.
2. Create or reference `agent-results`.
3. Build a one-time ingestion/sync path from the DigitalOcean volume into Modal Volume. Prefer a Modal function or local script that can use `rsync`, `rclone`, `tar`, or provider snapshots without exposing credentials in logs.
4. Lay out public datasets under stable subdirectories, for example `/data/datasets/<dataset_id>/`.
5. Put manifests next to datasets only during controlled ingest/maintenance jobs, not ordinary agent runs.
6. After sync, run a Modal validation job that lists expected canonical datasets and checks manifests.
7. Freeze DigitalOcean writes, run a final sync, switch new jobs to Modal, then decommission DigitalOcean volumes/droplets after a rollback window.

Read-only enforcement:

- Prompt-level: tell Codex `/data` is read-only.
- Filesystem-level: mount the Modal Volume read-only if Modal supports that mode for the chosen API. If not, run jobs as a non-root user and make `/data` unwritable in the image/bootstrap where possible.
- Contract-level: tests should fail if `ARTIFACT_DIR`, `WORKSPACE_DIR`, or status paths resolve under `/data` for Modal jobs.

## Secret Handling

- Create Modal Secret `agent-keys` with `OPENAI_API_KEY`.
- Add optional `EXA_API_KEY` and Slack webhook values to the same secret only if the job type needs them.
- Never include secret values in `extra_context`, prompt text, run config artifacts, transcripts, or callback payloads.
- Keep `OPENAI_API_KEY` as an environment variable available to Codex CLI.
- Mask or omit environment dumps in worker logs.
- Update docs to state that Modal Secrets replace DigitalOcean cloud-init environment injection for Modal workers.

## Validation

Add deterministic checks before live rollout:

- Existing `pnpm build`.
- Existing `pnpm test`.
- Existing `pnpm run qa:dashboard`.
- Extend `scripts/validate-infrastructure-contract.mjs` to assert:
  - Modal provider files exist.
  - Modal jobs use `/data`, `/workspace`, and `/results/<job_id>`.
  - Modal runner state is not written under `/data`.
  - Secret names are referenced, but secret values are absent from source.
  - `REMOTE_AGENT_EXECUTOR=modal` or provider equivalent is documented.

Live checks:

- Deploy Modal app.
- Run a small smoke job against a tiny dataset in `agent-dataset`.
- Confirm `/results/<job_id>/summary.md` exists.
- Confirm transcript and last-message artifacts are captured.
- Confirm dashboard run status reaches `ready`.
- Confirm no files are created or modified under `/data` by a normal worker.
- Run a parallel smoke with multiple jobs against the same dataset.

## Rollout Plan

1. Build Modal worker module and direct submit helper.
2. Adjust `scripts/run_remote_agent.py` for Modal-compatible state, scratch, and read-only dataset prompts.
3. Add provider-neutral control-plane routing with `REMOTE_AGENT_EXECUTOR=modal`.
4. Add infrastructure contract tests.
5. Deploy Modal app and create `agent-keys`, `agent-dataset`, and `agent-results`.
6. Sync public datasets from DigitalOcean to Modal.
7. Run live smoke jobs outside the dashboard.
8. Enable Modal for one internal dashboard run.
9. Enable Modal by default for research jobs.
10. Disable DigitalOcean warm pool creation.
11. After the rollback window, delete DigitalOcean volumes/droplets and remove DigitalOcean-only paths that are no longer needed.

## Rollback

Keep DigitalOcean launch code available until Modal has passed:

- one direct Modal smoke job
- one dashboard-triggered Modal job
- one parallel run test
- one real canonical public dataset run

Rollback is setting `REMOTE_AGENT_EXECUTOR=digitalocean` or the chosen legacy provider value and redeploying the Worker. Do not delete DigitalOcean resources until the rollback window is closed.

## Acceptance Criteria

- Modal dependency and worker files are present.
- `agent-dataset` mounts at `/data`.
- `agent-results` mounts at `/results`.
- Workers run Codex CLI from `/workspace`.
- Normal workers do not write to `/data`.
- Deliverables land in `/results/<job_id>/`.
- `OPENAI_API_KEY` is provided by Modal Secret `agent-keys`.
- Programmatic job submission works without dashboard interaction.
- Control-plane runs can use Modal through a provider flag.
- Existing build, harness, and dashboard QA pass.
- A live Modal smoke job completes and produces `summary.md`.
