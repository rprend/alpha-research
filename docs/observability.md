# Observability

Alpha Research needs observability that Codex can query and reason about.

## Current Signals

- Control plane run events
- Run statuses and timestamps
- Remote Codex session entries
- Run artifacts, including transcript artifacts
- Runner pool heartbeat timestamps

## Target Signals

- Structured JSON logs from Worker routes and runner scripts
- Metrics for run queue time, launch time, duration, failures, stale heartbeats, artifact count, and runner pool health
- Trace ids propagated across dashboard, Worker, control plane, and remote runner callbacks
- Local dev observability stack for agent QA

## Debug Endpoint

`/api/cli/runs/:id/debug-view` is the current machine-readable debug surface. It should stay stable and grow as new signals are added.

`/api/cli/sessions/:id/debug-view` is the session-scoped debug surface. Use it when a dashboard URL only has a `sessionId`; it returns the stored assistant entries, the linked run when present, run events, and a `debugView.latestError` summary extracted from session entries or run errors.

## Local Harness

Harness mode provides deterministic synthetic observability data so agents can validate UI and debug panels without live infrastructure.
