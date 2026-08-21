# SPEC.md

Features as `##` headings, in priority order.

## Feature: Frozen rule set

**Gate:** confirmed
**Acceptance:**

- [x] Three rules: LDA-LAYER, LDA-IMPORT, LDA-TEST
- [x] Rules live in [rules/rules.json](rules/rules.json)
- [x] Fixture tree is public synthetic JS only

**Out of scope for this feature:** git diffs.

## Feature: Mechanical scan

**Gate:** tests_passing
**Acceptance:**

- [x] Walk `*.js` under a workspace root
- [x] Layering: `src/domain` must not import `src/ui`
- [x] Forbidden import: `child_process` inside `src/domain`
- [x] Required tests: each `src/**/*.js` (except `index.js`) has a `tests/` sibling basename

**Out of scope for this feature:** TypeScript, Python.

## Feature: Gated act

**Gate:** evaluated
**Acceptance:**

- [x] Finding JSON includes `act` boolean
- [x] `act` is true only for high + confidence ≥ 0.8 after the gate
- [x] Stub language or F-35/JPO tokens force `act` false and verdict fail

**Out of scope for this feature:** posting the act.

## Feature: Golden set

**Gate:** evaluated
**Acceptance:**

- [x] [eval/cases.json](eval/cases.json) 12+ cases
- [x] `npm run eval` D3 catch ≥ 0.85 and agreement 1.0

**Out of scope for this feature:** observer / remediation phases.
