# precheck

`precheck` helps an engineer prepare for a GitHub PR review by learning a reviewer profile from historical PR review comments.

Install:

```sh
curl -fsSL https://alpharesearch.nyc/precheck/install.sh | sh
```

Then run from inside a GitHub repository:

```sh
precheck
```

The CLI uses local `git`, `gh`, and `claude` authentication. It does not implement GitHub OAuth and does not ask for or store GitHub tokens.

Generated data is written under:

```text
~/.precheck/repos/<owner>__<repo>/reviewers/<reviewer>/
```

Raw GitHub data is stored in `raw/`. Claude-generated reviewer artifacts are stored in `synthesized/`:

- `evidence-map.md`: evidence-first map of review moves, mechanisms, triggers, and representative cases.
- `reviewer-patterns.md`: synthesized reviewer patterns with representative examples.
- `filtered-patterns.md`: anti-generic ranked patterns.
- `reviewer-profile.md`: final reviewer profile.
- `claude-reviewer.md`: reusable Claude Code review instructions.
- `review-prompt.md`: copy-paste prompt for a future branch review.
