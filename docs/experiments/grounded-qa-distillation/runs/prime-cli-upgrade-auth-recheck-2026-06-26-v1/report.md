# Prime CLI Auth Recheck

Generated: 2026-06-26T19:26:03.693Z

Status: `auth_blocked_after_cli_upgrade`

Prime CLI version: `0.6.15`

## Checks

| Command | Exit | Status | Error |
| --- | ---: | --- | --- |
| `prime --version` | 0 | ok |  |
| `prime whoami` | 1 | failed | api_key_unauthorized |
| `prime teams list` | 1 | failed | api_key_unauthorized |
| `prime availability list` | 0 | failed | api_key_unauthorized |

## Conclusion

The Prime CLI upgrade succeeded, but authenticated account/team/availability commands still reject the saved key. This makes stale CLI version unlikely; a valid token or permissions repair is still required before balance, pricing, or GPU launch can be checked.

This recheck makes no OpenAI calls, launches no GPU jobs, and records no new spend.

Next step: Install a valid Prime API key through the hidden-input helper or complete browser login, then rerun this recheck before any pod creation.
