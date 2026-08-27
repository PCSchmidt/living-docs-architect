/**
 * Phase 5 dogfood on own public family repos.
 * Default is dry-run. Never posts GitHub comments, issues, or webhooks.
 * Refuses HardPowerIntelligence, Meridian, upstream harness, and program trees.
 */

import { readdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { FORBIDDEN, STUB } from './gate.js'
import { refuseGitHubWrite } from './observe.js'

export const DOGFOOD_SCHEMA = 'living-docs.dogfood_report.v1'

export const FAMILY_REPOS = Object.freeze([
  'portfolio-kit',
  'dsh-plugin-honesty-gate',
  'agent-framework-bakeoff',
  'living-docs-architect',
  'meridian-jspace',
  'gate-enforced-rag',
  'redteam-blue-gate',
])

function posix(path) {
  return String(path || '').replace(/\\/g, '/')
}

export function repoLeaf(absPath) {
  return basename(posix(absPath).replace(/\/+$/, ''))
}

export function classifyTarget(absPath) {
  const p = posix(absPath)
  if (!p) return { allowed: false, reason: 'empty_path' }
  if (FORBIDDEN.test(p)) return { allowed: false, reason: 'forbidden_token' }
  if (/HardPowerIntelligence/i.test(p)) return { allowed: false, reason: 'not_family' }
  if (/deepseek-harness/i.test(p)) return { allowed: false, reason: 'upstream_not_family' }
  if (/(?:^|\/)Meridian(?:\/|$)/i.test(p)) return { allowed: false, reason: 'meridian_not_in_phase5' }
  const leaf = repoLeaf(p)
  if (!FAMILY_REPOS.includes(leaf)) return { allowed: false, reason: 'not_family' }
  return { allowed: true, reason: null, repo_id: leaf }
}

export function resolveWorkspaceRoot(start, fsApi = { readdirSync }) {
  const abs = resolve(start)
  if (FAMILY_REPOS.includes(repoLeaf(abs))) return dirname(abs)
  try {
    const kids = (fsApi.readdirSync || readdirSync)(abs, { withFileTypes: true })
    if (kids.some((entry) => entry.isDirectory() && FAMILY_REPOS.includes(entry.name))) {
      return abs
    }
  } catch {
    /* not a readable workspace */
  }
  return abs
}

export function listFamilyRepos(workspace, fsApi = { readdirSync }) {
  const root = resolve(workspace)
  let entries = []
  try {
    entries = (fsApi.readdirSync || readdirSync)(root, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((entry) => entry.isDirectory() && FAMILY_REPOS.includes(entry.name))
    .map((entry) => join(root, entry.name))
}

export function gateDogfoodReport(report) {
  const issues = []
  const blob = JSON.stringify(report || {})
  if (report?.schema !== DOGFOOD_SCHEMA) {
    issues.push({ severity: 'high', code: 'bad_schema', message: 'Dogfood report schema mismatch' })
  }
  if (report?.github_write || report?.comments_posted || report?.issues_opened) {
    issues.push({ severity: 'high', code: 'github_write', message: 'Dogfood must not write to GitHub' })
  }
  if (report?.webhook_posted) {
    issues.push({ severity: 'high', code: 'webhook_posted', message: 'Dogfood must not post webhooks' })
  }
  if (FORBIDDEN.test(blob)) {
    issues.push({ severity: 'high', code: 'extra_entity', message: 'Forbidden program token in dogfood report' })
  }
  if (STUB.test(blob)) {
    issues.push({ severity: 'high', code: 'stub_as_done', message: 'Stub language in dogfood report' })
  }
  if ((report?.targets || []).some((row) => row.allowed && !FAMILY_REPOS.includes(row.repo_id))) {
    issues.push({ severity: 'high', code: 'not_family', message: 'Dogfood targeted a non-family repo' })
  }
  if ((report?.refused || []).length > 0 && (report?.requested_n || 0) > 0) {
    issues.push({ severity: 'high', code: 'refused_target', message: 'Requested target is not an allowed family repo' })
  }
  if (report?.dry_run && (report?.targets || []).some((row) => row.applied_n > 0)) {
    issues.push({ severity: 'high', code: 'dry_run_applied', message: 'Dry-run must not apply writes' })
  }
  if (report?.target_n === 0 && (report?.refused || []).length === 0) {
    issues.push({ severity: 'high', code: 'no_family_targets', message: 'No allowlisted family repos found' })
  }
  const highIssue = issues.some((row) => row.severity === 'high')
  return {
    ...report,
    issues,
    verdict: highIssue ? 'fail' : 'pass',
    act: false,
  }
}

/**
 * @param {object} opts
 * @param {string} opts.workspace
 * @param {string[]} [opts.repos]
 * @param {boolean} [opts.dryRun]
 * @param {boolean} [opts.apply]
 * @param {(repo: string, inner: object) => object} [opts.runOne]
 * @param {object} [opts.fs]
 * @param {string} [opts.now]
 */
export function dogfood(opts = {}) {
  if (opts.post === true || opts.githubWrite === true || opts.comment === true || opts.issue === true) {
    refuseGitHubWrite('dogfood')
  }

  const now = opts.now ?? new Date().toISOString()
  const dryRun = opts.dryRun !== false && opts.apply !== true
  const fsApi = opts.fs
  const workspace = resolveWorkspaceRoot(opts.workspace || '.', fsApi)
  const requested = (opts.repos && opts.repos.length)
    ? opts.repos.map((row) => resolve(row))
    : listFamilyRepos(workspace, fsApi)

  const refused = []
  const allowed = []
  for (const repo of requested) {
    const classified = classifyTarget(repo)
    if (!classified.allowed) {
      refused.push({ repo, repo_id: repoLeaf(repo), reason: classified.reason })
      continue
    }
    allowed.push({ repo, repo_id: classified.repo_id })
  }

  const runOne = opts.runOne || (() => {
    throw new Error('dogfood requires runOne')
  })

  const targets = allowed.map((row) => {
    const remediation = runOne(row.repo, { now, dryRun, apply: !dryRun, fs: fsApi })
    return {
      repo: row.repo,
      repo_id: row.repo_id,
      allowed: true,
      dry_run: dryRun,
      applied_n: remediation?.applied_n ?? 0,
      skipped_n: remediation?.skipped_n ?? 0,
      architect_verdict: remediation?.architect_verdict || remediation?.verdict,
      remediation_verdict: remediation?.verdict,
      github_write: Boolean(remediation?.github_write),
    }
  })

  const report = {
    schema: DOGFOOD_SCHEMA,
    observed_at: now,
    workspace,
    dry_run: dryRun,
    requested_n: opts.repos?.length || 0,
    target_n: targets.length,
    refused,
    targets,
    applied_n: targets.reduce((sum, row) => sum + (row.applied_n || 0), 0),
    github_write: false,
    webhook_posted: false,
    comments_posted: false,
    issues_opened: false,
  }
  return gateDogfoodReport(report)
}
