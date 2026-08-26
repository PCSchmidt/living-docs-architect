import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  architectFromEvent,
  gateArchitectReport,
  proposeFor,
} from '../src/architect.js'
import { refuseGitHubWrite } from '../src/observe.js'

const LAYER = {
  id: 'F1',
  rule_id: 'LDA-LAYER',
  path: 'src/domain/score.js',
  evidence: '../ui/view.js',
  severity: 'high',
  confidence: 0.92,
  summary: 'src/domain/score.js imports UI from domain',
}

const TEST_GAP = {
  id: 'F3',
  rule_id: 'LDA-TEST',
  path: 'src/domain/pure.js',
  evidence: 'missing tests/pure.test.js',
  severity: 'medium',
  confidence: 0.7,
  summary: 'src/domain/pure.js has no tests/ sibling',
}

function eventWithScan(findings, changes) {
  return {
    schema: 'living-docs.change_event.v1',
    observed_at: '2026-08-26T12:00:00.000Z',
    repo: '/tmp/public-app',
    verdict: 'pass',
    git: { available: true, dirty: true },
    changes,
    js_changed: changes.some((row) => row.path.endsWith('.js')),
    scan_triggered: true,
    github_write: false,
    webhook_posted: false,
    scan: { root: '/tmp/public-app', findings, act_n: 0 },
  }
}

test('architect proposes only gated act findings on changed JS', () => {
  const report = architectFromEvent(eventWithScan(
    [LAYER, TEST_GAP],
    [{ status: 'M', path: 'src/domain/score.js' }],
  ))
  assert.equal(report.schema, 'living-docs.architect_report.v1')
  assert.equal(report.verdict, 'pass')
  assert.equal(report.act, false)
  assert.equal(report.proposal_n, 1)
  assert.equal(report.proposals[0].finding_id, 'F1')
  assert.equal(report.proposals[0].applied, false)
  assert.equal(report.proposals[0].kind, 'comment')
  assert.equal(report.architecture_written, false)
  assert.equal(report.github_write, false)
})

test('markdown-only dirt yields no proposals even if scan has findings', () => {
  const report = architectFromEvent(eventWithScan(
    [LAYER],
    [{ status: 'M', path: 'README.md' }],
  ))
  assert.equal(report.proposal_n, 0)
  assert.equal(report.findings.length, 0)
  assert.equal(report.verdict, 'pass')
})

test('failed change events skip architect findings', () => {
  const report = architectFromEvent({
    ...eventWithScan([LAYER], [{ status: 'M', path: 'src/domain/score.js' }]),
    verdict: 'fail',
  })
  assert.equal(report.proposal_n, 0)
  assert.equal(report.verdict, 'fail')
  assert.equal(report.act, false)
})

test('applied proposals and GitHub writes fail closed', () => {
  const applied = gateArchitectReport({
    schema: 'living-docs.architect_report.v1',
    findings: [],
    proposals: [{ finding_id: 'F1', applied: true, kind: 'comment', target: 'x', body: 'y' }],
    proposal_n: 1,
    github_write: false,
    architecture_written: false,
  })
  assert.equal(applied.verdict, 'fail')
  assert.equal(applied.act, false)

  const wrote = gateArchitectReport({
    schema: 'living-docs.architect_report.v1',
    findings: [],
    proposals: [],
    proposal_n: 0,
    github_write: false,
    architecture_written: true,
  })
  assert.equal(wrote.verdict, 'fail')
  assert.throws(() => architectFromEvent(eventWithScan([], []), { githubWrite: true }), /writes local files only/)
  assert.throws(() => refuseGitHubWrite('issue'), /writes local files only/)
})

test('medium findings do not get proposals', () => {
  const gated = { ...TEST_GAP, act: false, verdict: 'warn', issues: [] }
  assert.equal(proposeFor(gated), null)
})
