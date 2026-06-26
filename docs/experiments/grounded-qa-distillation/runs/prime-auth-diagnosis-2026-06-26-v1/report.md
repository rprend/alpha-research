# Prime Auth Diagnosis

The local Prime CLI has a saved production config with an API key and a team context for `Dolphin Made`, but authenticated commands fail with `API key unauthorized`.

This means the current blocker is credential validity or permissions. It is not yet evidence of insufficient Prime funds, because the CLI cannot reach team, billing, pricing, or GPU availability endpoints before auth fails. A browser-login challenge was opened locally, but it did not complete during the run.

No GPU job was created, no OpenAI calls were made, and external compute spend remains `$0`.

Next step: create or refresh a Prime token in the browser, install it through the hidden-input helper or `prime config set-api-key`, verify `prime whoami`, then query balance/pricing before launching the bounded Qwen 3B smoke job.
