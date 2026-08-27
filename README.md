# living-docs-architect

An observer + architect + remediation loop that treats architectural documentation as agent-managed state.

**Status:** Phase 5 — dogfood on own public family repos

Built on Meridian’s gate + independent Evaluator contracts. High-confidence findings only get `act: true`. Phase 5 runs the observer → architect → local remediate loop on allowlisted public family remotes. Default is dry-run. It never posts GitHub comments, issues, or webhooks.

## Relation to Meridian

Rules and change events feed an architect agent. The Evaluator / honesty gate decides whether a finding is real enough to act on. Optional later packaging as a dsh plugin.

## Shared contracts

- [GATE_CONTRACT.md](https://github.com/PCSchmidt/portfolio-kit/blob/main/docs/GATE_CONTRACT.md)
- [EVAL_RUBRIC_TEMPLATE.md](https://github.com/PCSchmidt/portfolio-kit/blob/main/docs/EVAL_RUBRIC_TEMPLATE.md)
- [MEMORY_SCHEMA.md](https://github.com/PCSchmidt/portfolio-kit/blob/main/docs/MEMORY_SCHEMA.md)
- [DATA_POLICY.md](https://github.com/PCSchmidt/portfolio-kit/blob/main/docs/DATA_POLICY.md)

## Architecture

```mermaid
flowchart LR
    Watch[Git / FS observer]
    Watch --> Change[Change event]
    Change --> Arch[Architect agent]
    Arch --> Gate[Evaluator / honesty gate]
    Gate -->|high confidence| Fix[Remediation: comment / issue / living docs]
    Fix --> Docs[Living docs store]
```

## Develop

```sh
npm test
npm run eval
npm run scan
npm run observe
npm run architect
npm run remediate
npm run remediate:apply
npm run dogfood
```

Requires Node.js 20+. No dependencies, no network. `npm run remediate` and `npm run dogfood` are dry-run. `npm run remediate:apply` writes local living-doc files on one repo. `--github-write`, `--comment`, and `--issue` are refused.

## Planned phasesports, required tests)
2. Local git observer
3. Architect agent → structured findings (mechanical, no LLM)
4. Remediation (local ARCHITECTURE.md / comment log)
5. Dogfood on own public family repos *(this increment)*
6. Later: Meridian / HardPowerIntelligence only if asked — not this increment
6. Dogfood on Meridian / this family — not HardPowerIntelligence until asked

## Public / unclassified data only

Fixture target is [fixtures/sample-app](fixtures/sample-app). No employer or program-of-record trees.

## Current tree

```
CONTRACT.md
SPEC.md
rules/rules.json
fixtures/sample-app/
src/scan.js
src/gate.js
src/observe.js
src/architect.js
src/remediate.js
src/dogfood.js
eval/cases.json
tests/
```
