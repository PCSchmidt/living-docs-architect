# AGENTS.md

## Read first

1. [README.md](README.md) and [STATUS.md](STATUS.md)
2. [CONTRACT.md](CONTRACT.md)
3. [portfolio-kit DATA_POLICY](https://github.com/PCSchmidt/portfolio-kit/blob/main/docs/DATA_POLICY.md)

## Do

- Keep finding JSON field names stable.
- Run `npm test` and `npm run eval` after rule or gate changes.
- Scan only public fixtures or the user's own public repos.

## Do not

- Start redteam-blue-gate.
- Open GitHub issues or post webhooks. Phase 4 writes local files only.
- Put JPO / F-35 content in fixtures except as known-bad eval strings.
- Add an LLM architect in Phase 4.
- Run `--apply` against employer or program-of-record trees.
