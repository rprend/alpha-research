# Run Lifecycle

## Lifecycle

1. User or assistant creates a run against a dataset.
2. Control plane records run metadata and requested artifacts.
3. A warm or new runner is assigned.
4. Runner sends events, session entries, artifacts, and status callbacks.
5. Runner also writes durable worker state at `<dataset mount>/.remote-agent/runs/<run id>/status.json` before posting status callbacks.
6. Dashboard polls run results and displays progress in any linked assistant session as an inline run block.
7. Research runners validate the artifact bundle before reporting success.
8. Terminal status releases dataset leases and makes artifacts inspectable.
9. If a completed run has a primary HTML report, the assistant-session run block renders it inline; otherwise it falls back to markdown briefing or structured result preview.

## Terminal Statuses

- `ready`
- `completed`
- `failed`
- `cancelled`
- `canceled`
- `error`
- `worker_unreachable`

`failed` means the worker reported that execution failed. `worker_unreachable` means the control plane stopped receiving heartbeats before any terminal execution result arrived; it is a transport/worker lifecycle state, not proof that the product task failed.

## Source Of Truth

The control plane is the source of truth for dashboard run rows, events, artifacts, and dataset leases. The worker's durable status file is the execution-side source of truth when callback delivery is interrupted. Callback delivery should not change a successful execution into a failed run.

## Assistant Session Surface

Assistant session entries with `metadata.runId` are treated as live run anchors. The dashboard should keep the user in the session after launch, poll `/api/cli/runs/<run id>/results`, show recent remote session/tool activity, and render final human-readable output inline. The full run page remains available for audit and debugging deep links.

Assistant sessions are the source of truth for conversational context. When a turn resolves to a session, prompt construction should use that resolved session's `datasetId` and include dataset profile context before answering or planning a remote run.

Remote execution from the assistant must go through the remote-run planning and approval flow. Duplicate direct-execution tools such as query, aggregation, fetch, transformation, labeling, and generic agent-run launchers should not be registered as assistant tools.

Cancelling a run moves it to a terminal status. Later runner status callbacks for that run are ignored so a heartbeat or completion callback cannot move a cancelled run back to running or ready.

## Context Lifecycle

The control plane stores durable session and run records. Those records are not the model context. Assistant turns must build an explicit model view in the Worker before calling Responses.

For every assistant turn, `runResearchAssistantTurn` resolves the session, appends the user request, then calls `buildAssistantModelContext`. That builder decides what enters the model prompt:

- Current user request.
- Static dataset inventory for the signed-in account, with dataset ids, names, status, and one-sentence summaries.
- Dataset header and bounded dataset profile sections when the session has a dataset.
- Compact assistant session history with recent entries included and older entries represented by counts.
- A reset decision for `previous_response_id`.

`previous_response_id` is an optimization for short continuity, not the source of truth. If the compact session view had to omit or truncate prior entries, the Worker proactively drops `previous_response_id` and reconstructs context from durable session records. If OpenAI still reports a context-length error, the Worker retries once without `previous_response_id` and records that decision in the local summary metadata.

Tool results must expose bounded model/storage views. Full run results, artifacts, transcripts, and debug payloads remain available through run/debug endpoints, but tool output sent back to Responses uses compact result data. Assistant session entry metadata is also bounded before storage so remote callbacks or future tools cannot persist unbounded model-adjacent state.

Compact run-result tool data must include an artifact summary that identifies the primary answer (`report.html`), structured result (`result.json`), work log (`work.md`), missing required files, supporting files, and debug artifacts. The summary is structural and bounded; full artifact contents stay behind artifact routes.

Remote-run planning uses the same compact chat-history policy. The planner receives a bounded, recent session view plus dataset context, not the full assistant entry table or run transcript.

## Assistant Streaming And Tracing

The dashboard assistant endpoint supports `Accept: text/event-stream`. It streams session resolution, text deltas, tool calls/results, and a final payload while still storing the durable assistant entry after the turn completes. The generic CLI Responses proxy preserves OpenAI event streams instead of buffering them before returning, so CLI clients can receive first-token output promptly.

Assistant routes emit structured `assistant_request_trace` logs with timing marks for auth, billing, session resolution, dataset inventory/profile loading, context construction, OpenAI response timing, and completion/error status. Trace logs must not include secrets or full prompts.

## Agent Debug Checklist

- Fetch run results.
- Fetch debug view.
- Check latest event and timestamp.
- Check whether a remote session id exists.
- Check whether requested artifacts were produced.
- Check whether the run is terminal.
- If non-terminal, check heartbeat age and runner assignment.
- If `worker_unreachable`, inspect the durable worker status file and mounted artifacts before classifying the product outcome.
