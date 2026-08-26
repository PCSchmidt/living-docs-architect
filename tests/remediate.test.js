import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ARCHITECTURE_FILE,
  LOCAL_COMMENTS,
  gateRemediationReport,
  remediate,
} from '../src/remediate.js'
import { refuseGitHubWrite } from '../src/observe.js'

function memFs(store = {}) {
  return {
    store,
    mkdirSync() {},
    readFileSync(path) {
      if (!(path in store)) {
        const err = new Error('ENOENT')
        err.code = 'ENOENT'
        throw err
      }
      return store[path]
    },
    writeFileSync(path, data) {
      store[path] = String(data)
    },
  }
}

const architectPass = {
  schema: 'living-docs.architect_report.v1',
  verdict: 'pass',
  repo: '/tmp/public-app',
  proposals: [{
    finding_id: 'F1',
    rule_id: 'LDA-LAYER',
    kind: 'comment',
    target: 'src/domain/score.js',
    body: 'Remove UI import from domain (../ui/view.js)',
    applied: false,
  }],
}

test('apply writes local comments, not GitHub', () => {
  const fs = memFs()
  const report = remediate(architectPass, {
    repo: '/tmp/public-app',
    now: '2026-08-26T21:00:00.000Z',
    apply: true,
    dryRun: false,
    fs,
  })
  assert.equal(report.schema, 'living-docs.remediation_report.v1')
  assert.equal(report.verdict, 'pass')
  assert.equal(report.act, false)
  assert.equal(report.applied_n, 1)
  assert.equal(report.github_write, false)
  assert.equal(report.comments_posted, false)
  assert.equal(report.local_comments_n, 1)
  const written = Object.keys(fs.store).find((path) => path.replace(/\\/g, '/').endsWith(LOCAL_COMMENTS))
  assert.ok(written)
  assert.match(fs.store[written], /"github":false/)
  assert.match(fs.store[written], /Remove UI import/)
})

test('architecture_md proposals append ARCHITECTURE.md', () => {
  const fs = memFs()
  const report = remediate({
    ...architectPass,
    proposals: [{
      finding_id: 'F3',
      rule_id: 'LDA-TEST',
      kind: 'architecture_md',
      target: 'ARCHITECTURE.md',
      body: 'Document missing tests for src/domain/pure.js',
      applied: false,
    }],
  }, { repo: '/tmp/public-app', now: '2026-08-26T21:00:00.000Z', dryRun: false, fs })
  assert.equal(report.architecture_written, true)
  const written = Object.keys(fs.store).find((path) => path.replace(/\\/g, '/').endsWith(ARCHITECTURE_FILE))
  assert.match(fs.store[written], /Finding F3/)
})

test('dry-run does not write', () => {
  const fs = memFs()
  const report = remediate(architectPass, {
    repo: '/tmp/public-app',
    dryRun: true,
    fs,
  })
  assert.equal(report.applied_n, 0)
  assert.equal(report.dry_run, true)
  assert.equal(Object.keys(fs.store).length, 0)
  assert.equal(report.applied[0].dry_run, true)
})

test('failed architect and GitHub flags fail closed', () => {
  const skipped = remediate({ ...architectPass, verdict: 'fail' }, {
    repo: '/tmp/public-app',
    dryRun: false,
    fs: memFs(),
  })
  assert.equal(skipped.applied_n, 0)
  assert.equal(skipped.verdict, 'fail')

  const gh = gateRemediationReport({
    schema: 'living-docs.remediation_report.v1',
    applied: [],
    applied_n: 0,
    github_write: true,
    comments_posted: true,
  })
  assert.equal(gh.verdict, 'fail')
  assert.throws(() => remediate(architectPass, { githubWrite: true }), /writes local files only/)
  assert.throws(() => refuseGitHubWrite('comment'), /writes local files only/)
})

test('unsafe relative paths do not write', () => {
  const fs = memFs()
  const report = remediate({
    ...architectPass,
    proposals: [{
      finding_id: 'F9',
      rule_id: 'LDA-LAYER',
      kind: 'comment',
      target: '../secret.js',
      body: 'escape',
      applied: false,
    }],
  }, { repo: '/tmp/public-app', dryRun: false, fs })
  assert.equal(report.applied_n, 0)
  assert.equal(report.verdict, 'fail')
  assert.equal(Object.keys(fs.store).length, 0)
})
