# CONTRACT.md

**Project:** living-docs-architect
**Owner:** Chris Schmidt
**Date:** 2026-08-21
**Reliability layer:** Meridian contracts via [portfolio-kit](https://github.com/PCSchmidt/portfolio-kit) 0.1.0

---

## Scope

Scan a **public fixture tree** with a small architectural rule set. Produce structured findings. A Meridian-style gate decides which findings are allowed to **act** (would-be comment / issue / living-doc edit). Phase 5 dogfoods the observer → architect → local remediate loop on **own public family remotes**. Default is dry-run. It does not open GitHub issues or post webhooks.

### In scope

- Rules: layering, forbidden imports, required tests
- One public synthetic app under `fixtures/sample-app/`
- Finding JSON: `id`, `rule_id`, `path`, `evidence`, `severity`, `confidence`
- Gate: act only when `severity=high` and `confidence >= 0.8` and no extra-entity / stub language
- Local git observer: porcelain snapshot → `living-docs.change_event.v1`
- Scan trigger when observed JS files change
- Mechanical architect: change event + gated scan → `living-docs.architect_report.v1` with unapplied proposals
- Gated local remediation: `living-docs.remediation_report.v1` writes `ARCHITECTURE.md` and `.living-docs/comments.jsonl` only when the architect report passed
- Dogfood: `living-docs.dogfood_report.v1` allowlists public family remotes; refuses HardPowerIntelligence, Meridian, upstream harness, and program trees
- Portfolio-kit D3 on known-bad architect outputs, change events, architect reports, remediation reports, and dogfood reports

### Out of scope

- JPO / F-35 / employer trees
- Replacing Claude Code / Cursor / Copilot
- GitHub webhooks / GitHub comments / issues *(never live; local comment log only)*
- LLM architect *(mechanical rules only)*
- redteam-blue-gate
- Dogfood on HardPowerIntelligence

---

## Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node 20+ stdlib |
| Reliability | Mechanical gate + portfolio-kit verdict shape |
| Models | None |
| Deploy | Local `npm test` / `npm run eval` |

---

## Acceptance criteria

1. Happy path works against SPEC.md
2. `npm test` and `npm run eval` exit 0
3. Low-confidence or medium findings do not `act`
4. Eval table uses portfolio-kit D3
5. Data policy grep is clean

---

## Known constraints

- Fixture app is synthetic public-style JS. Not a live clone of Meridian.
- Windows host via Git Bash.
