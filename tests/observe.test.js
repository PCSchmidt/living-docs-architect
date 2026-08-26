import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  classifyRemote,
  gateChangeEvent,
  observeLocal,
  parsePorcelain,
  refuseGitHubWrite,
  shouldScan,
} from '../src/observe.js'
import { runObserve } from '../src/run.js'

test('porcelain parser and js-change detection', () => {
  const changes = parsePorcelain(' M src/domain/score.js\n?? notes.md\n')
  assert.equal(changes.length, 2)
  assert.equal(changes[0].path, 'src/domain/score.js')
  assert.equal(shouldScan(changes), true)
  assert.equal(shouldScan([{ path: 'README.md', status: 'M' }]), false)
  assert.equal(classifyRemote('https://github.com/PCSchmidt/living-docs-architect.git'), 'github')
  assert.equal(classifyRemote('git@example.com:x.git'), 'other')
})

test('observeLocal snapshots dirty JS and never writes GitHub', () => {
  const event = observeLocal({
    repo: '/tmp/public-app',
    now: '2026-08-21T20:00:00.000Z',
    gitRunner: ({ args }) => {
      const cmd = args.join(' ')
      if (cmd === 'rev-parse --is-inside-work-tree') return { status: 0, stdout: 'true\n' }
      if (cmd === 'rev-parse HEAD') return { status: 0, stdout: 'abc123\n' }
      if (cmd === 'branch --show-current') return { status: 0, stdout: 'main\n' }
      if (cmd.startsWith('remote')) {
        return { status: 0, stdout: 'origin https://github.com/PCSchmidt/living-docs-architect.git (fetch)\n' }
      }
      if (cmd.startsWith('status')) return { status: 0, stdout: ' M src/domain/score.js\n' }
      return { status: 1, stdout: '' }
    },
  })
  assert.equal(event.verdict, 'pass')
  assert.equal(event.act, false)
  assert.equal(event.github_write, false)
  assert.equal(event.webhook_posted, false)
  assert.equal(event.js_changed, true)
  assert.equal(event.scan_triggered, true)
  assert.equal(event.git.remotes[0].kind, 'github')
  assert.equal(event.changes[0].path, 'src/domain/score.js')
})

test('non-git trees and ignored paths do not scan', () => {
  const missing = observeLocal({
    repo: '/tmp/not-git',
    now: '2026-08-21T20:00:00.000Z',
    gitRunner: () => ({ status: 128, stdout: '', stderr: 'not a git repository' }),
  })
  assert.equal(missing.git.available, false)
  assert.equal(missing.scan_triggered, false)
  assert.equal(missing.verdict, 'pass')

  const envOnly = observeLocal({
    repo: '/tmp/public-app',
    now: '2026-08-21T20:00:00.000Z',
    gitRunner: ({ args }) => {
      const cmd = args.join(' ')
      if (cmd === 'rev-parse --is-inside-work-tree') return { status: 0, stdout: 'true\n' }
      if (cmd === 'rev-parse HEAD') return { status: 0, stdout: 'abc123\n' }
      if (cmd === 'branch --show-current') return { status: 0, stdout: 'main\n' }
      if (cmd.startsWith('remote')) return { status: 0, stdout: '' }
      if (cmd.startsWith('status')) return { status: 0, stdout: '?? .env\n' }
      return { status: 1, stdout: '' }
    },
  })
  assert.equal(envOnly.changes.length, 0)
  assert.equal(envOnly.scan_triggered, false)
})

test('GitHub writes and program tokens fail closed', () => {
  assert.throws(() => refuseGitHubWrite('comment'), /does not write remediations/)
  const leaked = gateChangeEvent({
    schema: 'living-docs.change_event.v1',
    observed_at: '2026-08-21T20:00:00.000Z',
    repo: '/tmp/public-app',
    git: { available: true },
    changes: [{ status: 'M', path: 'src/domain/f35.js' }],
    js_changed: true,
    scan_triggered: true,
    github_write: false,
    webhook_posted: false,
    summary: 'F-35 overlay',
  })
  assert.equal(leaked.verdict, 'fail')
  assert.equal(leaked.act, false)

  const write = gateChangeEvent({
    schema: 'living-docs.change_event.v1',
    observed_at: '2026-08-21T20:00:00.000Z',
    repo: '/tmp/public-app',
    git: { available: true },
    changes: [],
    js_changed: false,
    scan_triggered: false,
    github_write: true,
    webhook_posted: false,
  })
  assert.equal(write.verdict, 'fail')
  assert.equal(write.act, false)
})

test('real git worktree: dirty JS triggers scan, markdown does not write GitHub', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lda-obs-'))
  const git = (args) => spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', windowsHide: true })
  try {
    git(['init'])
    git(['config', 'user.email', 'observer@example.com'])
    git(['config', 'user.name', 'Observer Fixture'])
    writeFileSync(join(dir, 'keep.js'), 'export const n = 1\n')
    git(['add', '.'])
    const committed = git(['commit', '-m', 'init'])
    if (committed.status !== 0) {
      assert.ok(true, 'skip if git commit unavailable')
      return
    }
    writeFileSync(join(dir, 'keep.js'), 'export const n = 2\n')
    const event = runObserve(dir, { now: '2026-08-21T20:00:00.000Z' })
    assert.equal(event.git.available, true)
    assert.equal(event.js_changed, true)
    assert.equal(event.github_write, false)
    assert.equal(event.act, false)
    assert.ok(event.scan)
    assert.equal(event.scan.root, dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
