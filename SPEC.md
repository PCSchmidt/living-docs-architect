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

## Feature: Local git observer

**Gate:** evaluated
**Acceptance:**

- [x] `observeLocal` reads `git status --porcelain` in a worktree
- [x] Emits `living-docs.change_event.v1` with `changes`, `js_changed`, `scan_triggered`
- [x] Ignored paths (`.env`, `node_modules`, recovery codes) are dropped
- [x] GitHub remotes are classified but never written
- [x] `refuseGitHubWrite` throws; `--github-write` / `--comment` / `--issue` CLI flags fail closed
- [x] Dirty JS may attach a gated scan; markdown-only dirt does not scan
- [x] Eval cases `LDA-013`–`LDA-018` cover good events and write/token/schema failures

**Out of scope for this feature:** GitHub webhooks, ARCHITECTURE.md writes.

## Feature: Architect structured findings

**Gate:** evaluated
**Acceptance:**

- [x] `architectFromEvent` emits `living-docs.architect_report.v1`
- [x] Findings are scoped to changed JS paths on a passing change event
- [x] Proposals exist only for gated `act` findings and stay `applied: false`
- [x] GitHub writes, webhooks, and ARCHITECTURE.md writes fail closed
- [x] Eval cases `LDA-019`–`LDA-025` cover proposals and known-bad reports

**Out of scope for this feature:** posting comments/issues or writing ARCHITECTURE.md.
