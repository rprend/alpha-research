# Control Plane Contract

The control plane in `src/control-plane.ts` owns durable state for datasets, runs, artifacts, and assistant sessions.

## Required Run Debug Shape

`GET /runs/:id/debug-view` must return enough information for an agent to understand the run without needing dashboard-specific logic:

- run id, dataset id, type, status, prompt, timestamps
- requested artifacts
- produced artifact summaries
- event count and last event
- terminal status flag
- active/stale health signal
- remote Codex session id when available
- session kinds and entry counts

## State Transition Expectations

- New work starts as `queued` or `running`.
- Runner callbacks append events and update status.
- Terminal statuses are `ready`, `completed`, `failed`, `cancelled`, `canceled`, `error`, or `worker_unreachable`.
- Stale heartbeats mark the run `worker_unreachable` and release the dataset lease. They do not mark the product execution `failed` unless the worker reported `failed`.
- All state transitions that matter to a human should append a run event.

## Modal Runner Contract

Remote run metadata can include `config.resources`, but the control plane always submits execution to Modal. Modal jobs mount the shared public dataset volume at `/data`, use `/workspace` for writable scratch, and write final outputs plus worker state under `/results/<job id>/`.

- Ordinary analysis jobs receive `/data` as read-only and must write deliverables under `/results/<job id>/`.
- Dataset deploy and environment jobs may write normalized dataset files under `/data/datasets/<dataset id>`.
- Admin canonical dataset bootstrap jobs are service-owned `canonical-dataset-bootstrap` runs. They create or update platform-owned public dataset rows, write to `/data/datasets/<dataset id>`, and use `dataset_briefing.md` plus inventories/docs mirrors as the primary artifact contract instead of user research `report.html`.
- Failed public/research environment launches must move the dataset to `failed` so stale provisioning rows are visible and retryable.

## Boundary Rules

- External providers are accessed through provider modules, not UI code.
- Runner callbacks are authenticated with `RESEARCH_INTERNAL_RUNNER_TOKEN`.
- Browser admin overview access is session-authenticated and restricted to `ALPHA_RESEARCH_ADMIN_EMAILS`; token-only admin mutation routes still require `ALPHA_RESEARCH_ADMIN_TOKEN`.
- Remote Codex model traffic must go through the metered OpenAI proxy at `/api/internal/runs/:runId/openai/v1/*`. The Worker validates `RESEARCH_INTERNAL_RUNNER_TOKEN`, checks the run owner's allowance before model calls, forwards to OpenAI with the platform key, and records usage through `/internal/runs/:runId/billing-events`.
- Admin canonical dataset bootstrap requests and subscription grants are authenticated with `ALPHA_RESEARCH_ADMIN_TOKEN` and must not depend on a user CLI session.
- Artifacts are indexed through `run_artifacts`; completed artifact bytes are stored in the Cloudflare R2 artifact bucket and served back through authenticated dashboard routes. Transcripts should be captured as artifacts or assistant session entries. Modal result paths are worker staging paths, not browser-accessible artifact URLs.
- CLI list routes for runs and assistant sessions return recent records by default and accept a bounded `limit` query parameter; owner and dataset filtered run lists must stay backed by indexes ordered on `updated_at`.
- Remote Codex runners may receive `EXA_API_KEY` and `CANONICAL_DATASET_SLACK_WEBHOOK_URL` as environment variables for canonical dataset-improvement and bootstrap jobs. Modal mounts the canonical Slack webhook through a separate `canonical-dataset-slack` secret so dataset maintenance jobs can send or queue source-download alerts without depending on user sessions. Workers must not write credentials into prompts, logs, artifacts, or mounted volumes.
- Modal worker submission uses `MODAL_AGENT_ENDPOINT_URL` and optional `MODAL_AGENT_SUBMIT_TOKEN`. These values are control-plane secrets and must not be exposed to frontend code.

## Infrastructure Test Cases

Run the deterministic contract checks with `pnpm run test:infra`. Run the live deployed smoke test with `pnpm run smoke:infra:live` when a RESEARCH CLI session is available.

- Failed public/research environment launches update both dataset `deployment_status` and `status` to `failed`.
- Runner launch, status, event, and artifact callback routes remain wired.
- Remote Codex OpenAI proxying remains strict: missing usage or a failed billing write stops the run instead of allowing unmetered execution.
- Remote runner bootstrap forwards Exa and canonical Slack webhook secrets so dataset-improvement jobs can search the web and notify the owner without embedding credentials in prompts.
- Canonical dataset bootstrap is exposed through `/api/admin/canonical-datasets/bootstrap`, uses Modal writable dataset jobs, and requires `dataset_briefing.md` rather than `report.html`.
- Modal provider files exist and keep `/data` read-only for ordinary workers.
- Modal runner state and outputs are written under `/results/<job id>`, not under `/data`.
- Live canonical datasets `econ`, `sociology`, `philosophy`, `history`, `literature`, `political-science`, `anthropology`, `linguistics`, and `classics` are present and ready.
- Completed canonical runs have persisted events and artifacts.
