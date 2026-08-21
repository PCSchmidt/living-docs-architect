# CONTRACT.md

**Project:** living-docs-architect
**Owner:** Chris Schmidt
**Date:** 2026-08-21
**Reliability layer:** Meridian contracts via [portfolio-kit](https://github.com/PCSchmidt/portfolio-kit) 0.1.0

---

## Scope

Scan a **public fixture tree** with a small architectural rule set. Produce structured findings. A Meridian-style gate decides which findings are allowed to **act** (would-be comment / issue / living-doc edit). Phase 1 freezes rules, finding JSON, and the gate. It does not watch git, open GitHub issues, or edit ARCHITECTURE.md.

### In scope

- Rules: layering, forbidden imports, required tests
- One public synthetic app under `fixtures/sample-app/`
- Finding JSON: `id`, `rule_id`, `path`, `evidence`, `severity`, `confidence`
- Gate: act only when `severity=high` and `confidence >= 0.8` and no extra-entity / stub language
- Portfolio-kit D3 on known-bad architect outputs

### Out of scope

- JPO / F-35 / employer trees
- Replacing Claude Code / Cursor / Copilot
- Git observer / GitHub webhooks *(Phase 2)*
- Writing comments, issues, or ARCHITECTURE.md *(Phase 4)*
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
