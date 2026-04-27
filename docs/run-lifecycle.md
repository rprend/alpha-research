# Run Lifecycle

## Lifecycle

1. User or assistant creates a run against a dataset.
2. Control plane records run metadata and requested artifacts.
3. A warm or new runner is assigned.
4. Runner sends events, session entries, artifacts, and status callbacks.
5. Dashboard polls run results and displays progress.
6. Terminal status releases dataset leases and makes artifacts inspectable.

## Terminal Statuses

- `ready`
- `completed`
- `failed`
- `cancelled`
- `canceled`
- `error`

## Agent Debug Checklist

- Fetch run results.
- Fetch debug view.
- Check latest event and timestamp.
- Check whether a remote session id exists.
- Check whether requested artifacts were produced.
- Check whether the run is terminal.
- If non-terminal, check heartbeat age and runner assignment.
