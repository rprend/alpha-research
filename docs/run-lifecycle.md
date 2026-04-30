# Run Lifecycle

## Lifecycle

1. User or assistant creates a run against a dataset.
2. Control plane records run metadata and requested artifacts.
3. A warm or new runner is assigned.
4. Runner sends events, session entries, artifacts, and status callbacks.
5. Runner also writes durable worker state at `<dataset mount>/.remote-agent/runs/<run id>/status.json` before posting status callbacks.
6. Dashboard polls run results and displays progress.
7. Terminal status releases dataset leases and makes artifacts inspectable.

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

## Agent Debug Checklist

- Fetch run results.
- Fetch debug view.
- Check latest event and timestamp.
- Check whether a remote session id exists.
- Check whether requested artifacts were produced.
- Check whether the run is terminal.
- If non-terminal, check heartbeat age and runner assignment.
- If `worker_unreachable`, inspect the durable worker status file and mounted artifacts before classifying the product outcome.
