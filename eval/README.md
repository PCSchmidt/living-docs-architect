# eval/

Held-out gate table for living-docs findings (portfolio-kit D3).

```sh
npm test
npm run eval
```

- No network, no GitHub writes, no LLM
- Cases: [cases.json](cases.json) (`LDA-001`–`LDA-025`)
- Known-bad findings, change events, and architect reports must not `act`
- Phase 3 proposals stay `applied: false`; no GitHub or ARCHITECTURE.md writes
