# Prime CLI Auth Recheck

Generated: 2026-06-27T01:14:50.410Z

Status: `auth_blocked_current_key`

Prime CLI version: `0.6.15`

## Checks

| Command | Exit | Status | Error |
| --- | ---: | --- | --- |
| `prime --version` | 0 | ok |  |
| `prime whoami` | 1 | failed | api_key_unauthorized |
| `prime teams list` | 1 | failed | api_key_unauthorized |
| `prime availability list` | 0 | failed | api_key_unauthorized |

## Conclusion

Authenticated account/team/availability commands still reject the saved key. The current blocker is a valid token or permissions repair; balance, pricing, and GPU launch readiness cannot be checked until Prime auth succeeds.

This recheck makes no OpenAI calls, launches no GPU jobs, and records no new spend.

Next step: Install a valid Prime API key through the hidden-input helper or complete browser login, then rerun this recheck before any pod creation.
