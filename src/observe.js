/**
 * Phase 2 local git observer.
 * Emits a change event from `git status`. Never writes to GitHub.
 */

import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { FORBIDDEN, STUB } from './gate.js'

const IGNORED = /(?:^|\/)(?:\.env(?:\..+)?|node_modules\/|\.git\/|github-recovery-codes|session\.json)(?:$|\/)/i

export function parsePorcelain(stdout) {
  const changes = []
  for (const line of String(stdout || '').split(/\r?\n/)) {
    if (!line) continue
    const xy = line.slice(0, 2)
    const rest = line.slice(3)
    if (xy.includes('R') || xy.includes('C')) {
      const parts = rest.split(' -> ')
      const to = parts[parts.length - 1]
      changes.push({ status: xy.trim() || xy, path: to.replace(/\\/g, '/'), from: parts[0]?.replace(/\\/g, '/') })
      continue
    }
    changes.push({ status: xy.trim() || xy, path: rest.replace(/\\/g, '/') })
  }
  return changes
}

export function classifyRemote(url) {
  if (!url) return 'none'
  if (/github\.com/i.test(url)) return 'github'
  return 'other'
}

export function parseRemotes(stdout) {
  const byName = new Map()
  for (const line of String(stdout || '').split(/\r?\n/)) {
    const match = line.match(/^(\S+)\s+(\S+)/)
    if (!match) continue
    const [, name, url] = match
    if (!byName.has(name)) {
      byName.set(name, { name, url, kind: classifyRemote(url) })
    }
  }
  return [...byName.values()]
}

export function isIgnoredPath(path) {
  return IGNORED.test(String(path || '').replace(/\\/g, '/'))
}

export function isJsPath(path) {
  return /\.(?:js|mjs|cjs)$/i.test(String(path || ''))
}

export function shouldScan(changes) {
  return (changes || []).some((row) => isJsPath(row.path) && !isIgnoredPath(row.path))
}

function git(repo, args, runner) {
  if (runner) return runner({ repo, args })
  const result = spawnSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  })
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error,
  }
}

function gitText(repo, args, runner) {
  const result = git(repo, args, runner)
  if (result.error || result.status !== 0) return null
  return String(result.stdout || '').trim()
}

/**
 * Block any GitHub write API. Phase 3 still does not post.
 * @param {string} [action]
 */
export function refuseGitHubWrite(action = 'write') {
  const error = new Error(`GitHub ${action} refused: living-docs Phase 3 does not write remediations`)
  error.code = 'github_write_refused'
  throw error
}

export function gateChangeEvent(event) {
  const issues = []
  const blob = JSON.stringify(event || {})
  if (event?.github_write) {
    issues.push({ severity: 'high', code: 'github_write', message: 'Observer must not write to GitHub' })
  }
  if (event?.webhook_posted) {
    issues.push({ severity: 'high', code: 'webhook_posted', message: 'Observer must not post webhooks' })
  }
  if (FORBIDDEN.test(blob)) {
    issues.push({ severity: 'high', code: 'extra_entity', message: 'Forbidden program token in change event' })
  }
  if (STUB.test(blob)) {
    issues.push({ severity: 'high', code: 'stub_as_done', message: 'Stub language in change event' })
  }
  if (event && event.schema !== 'living-docs.change_event.v1') {
    issues.push({ severity: 'high', code: 'bad_schema', message: 'Change event schema mismatch' })
  }
  const highIssue = issues.some((row) => row.severity === 'high')
  return {
    ...event,
    issues,
    verdict: highIssue ? 'fail' : 'pass',
    act: false,
  }
}

/**
 * @param {object} opts
 * @param {string} opts.repo
 * @param {string} [opts.now]
 * @param {(ctx: {repo: string, args: string[]}) => {status: number, stdout: string, stderr?: string, error?: Error}} [opts.gitRunner]
 * @param {(root: string) => object} [opts.scanFn]
 */
export function observeLocal(opts) {
  const repo = resolve(opts.repo)
  const now = opts.now ?? new Date().toISOString()
  const runner = opts.gitRunner

  if (FORBIDDEN.test(repo)) {
    return gateChangeEvent({
      schema: 'living-docs.change_event.v1',
      observed_at: now,
      repo,
      git: { available: false, reason: 'forbidden_path' },
      changes: [],
      js_changed: false,
      scan_triggered: false,
      github_write: false,
      webhook_posted: false,
    })
  }

  const inside = gitText(repo, ['rev-parse', '--is-inside-work-tree'], runner)
  if (inside !== 'true') {
    return gateChangeEvent({
      schema: 'living-docs.change_event.v1',
      observed_at: now,
      repo,
      git: { available: false, reason: 'not_a_git_repository' },
      changes: [],
      js_changed: false,
      scan_triggered: false,
      github_write: false,
      webhook_posted: false,
    })
  }

  const head = gitText(repo, ['rev-parse', 'HEAD'], runner)
  const branch = gitText(repo, ['branch', '--show-current'], runner) || 'HEAD'
  const remotes = parseRemotes(git(repo, ['remote', '-v'], runner).stdout || '')
  const porcelain = git(repo, ['status', '--porcelain=v1', '-uall'], runner)
  const raw = parsePorcelain(porcelain.stdout || '')
  const changes = raw.filter((row) => !isIgnoredPath(row.path))
  const js_changed = shouldScan(changes)
  const event = {
    schema: 'living-docs.change_event.v1',
    observed_at: now,
    repo,
    git: {
      available: true,
      head,
      branch,
      dirty: changes.length > 0,
      remotes,
    },
    changes,
    js_changed,
    scan_triggered: js_changed,
    github_write: false,
    webhook_posted: false,
  }

  if (opts.post === true || opts.githubWrite === true) {
    refuseGitHubWrite('comment')
  }

  if (js_changed && typeof opts.scanFn === 'function') {
    event.scan = opts.scanFn(repo)
  }

  return gateChangeEvent(event)
}
