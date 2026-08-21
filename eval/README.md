# eval/

Held-out gate table for living-docs findings (portfolio-kit D3).

```sh
npm test
npm run eval
```

- No network, no GitHub writes, no LLM
- Cases: [cases.json](cases.json) (`LDA-001`–`LDA-018`)
- Known-bad findings and change events must not `act`
- Phase 2 events never set `github_write` or `webhook_posted` on a passing row
