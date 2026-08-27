# eval/

Held-out gate table for living-docs findings (portfolio-kit D3).

```sh
npm test
npm run eval
```

- No network, no GitHub writes, no LLM
- Cases: [cases.json](cases.json) (`LDA-001`–`LDA-039`)
- Known-bad findings, change events, architect reports, remediations, and dogfood reports must not `act`
- Phase 5 dogfood is dry-run on allowlisted family remotes; GitHub comments/issues/webhooks stay refused
