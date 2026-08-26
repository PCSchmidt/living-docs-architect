# eval/

Held-out gate table for living-docs findings (portfolio-kit D3).

```sh
npm test
npm run eval
```

- No network, no GitHub writes, no LLM
- Cases: [cases.json](cases.json) (`LDA-001`–`LDA-032`)
- Known-bad findings, change events, architect reports, and remediations must not `act`
- Phase 4 may apply local files; GitHub comments/issues/webhooks stay refused
