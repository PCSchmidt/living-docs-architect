import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadCatalog, runEval } from '../eval/run.js'
import { gateFinding } from '../src/gate.js'

test('golden set is at least 12 cases with good and bad rows', () => {
  const catalog = loadCatalog()
  assert.ok(catalog.cases.length >= 12)
  assert.ok(catalog.cases.some((row) => row.kind === 'good'))
  assert.ok(catalog.cases.some((row) => row.kind === 'bad'))
  assert.equal(catalog.cases[0].case_id, 'LDA-001')
})

test('held-out eval meets gate-catch and agreement', () => {
  const report = runEval(loadCatalog(), { now: '2026-08-21T18:00:00.000Z' })
  assert.equal(report.metrics.verdict_agreement, 1)
  assert.ok(report.metrics.D3_gate_catch_rate >= report.target_gate_catch)
  assert.equal(report.metrics.known_bad_no_act, 1)
  assert.equal(report.ok, true)
})

test('gate blocks F-35 findings from acting', () => {
  const gated = gateFinding({
    id: 'F',
    rule_id: 'LDA-LAYER',
    path: 'src/domain/score.js',
    evidence: 'F-35',
    severity: 'high',
    confidence: 0.99,
    summary: 'F-35 overlay',
  })
  assert.equal(gated.act, false)
  assert.equal(gated.verdict, 'fail')
})
