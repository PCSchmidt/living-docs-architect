/**
 * Phase 4 gated local remediation.
 * Applies unapplied architect proposals to local living-docs files.
 * Never posts GitHub comments, issues, or webhooks.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { FORBIDDEN, STUB } from './gate.js'
import { refuseGitHubWrite } from './observe.js'

export const REMEDIATION_SCHEMA = 'living-docs.remediation_report.v1'
export const LOCAL_COMMENTS = '.living-docs/comments.jsonl'
export const ARCHITECTURE_FILE = 'ARCHITECTURE.md'

function posix(path) {
  return String(path || '').replace(/\\/g, '/')
}

export function isSafeRelPath(path) {
  const rel = posix(path)
  if (!rel || rel.startsWith('/') || /^[a-zA-Z]:/.test(rel)) return false
  if (rel.split('/').some((part) => part === '..')) return false
  return true
}

function io(fsApi) {
  return {
    read(path) {
      try {
        return (fsApi?.readFileSync || readFileSync)(path, 'utf8')
      } catch {
        return ''
      }
    },
    write(path, data) {
      const mkdir = fsApi?.mkdirSync || mkdirSync
      mkdir(dirname(path), { recursive: true })
      ;(fsApi?.writeFileSync || writeFileSync)(path, data, 'utf8')
    },
  }
}

export function architectureBlock(proposal) {
  return [
    '',
    `## Finding ${proposal.finding_id} (${proposal.rule_id})`,
    '',
    proposal.body,
    '',
  ].join('\n')
}

export function commentLine(proposal, now) {
  return `${JSON.stringify({
    finding_id: proposal.finding_id,
    rule_id: proposal.rule_id,
    target: proposal.target,
    body: proposal.body,
    written_at: now,
    github: false,
  })}\n`
}

function applyOne(root, proposal, now, files, dryRun) {
  const kind = proposal.kind
  const target = kind === 'architecture_md' ? ARCHITECTURE_FILE : posix(proposal.target || LOCAL_COMMENTS)
  if (kind === 'comment' && !isSafeRelPath(proposal.target || '')) {
    return { ...proposal, applied: false, skip: 'unsafe_path' }
  }
  if (kind === 'architecture_md' && !isSafeRelPath(ARCHITECTURE_FILE)) {
    return { ...proposal, applied: false, skip: 'unsafe_path' }
  }
  if (kind !== 'architecture_md' && kind !== 'comment') {
    return { ...proposal, applied: false, skip: 'unknown_kind' }
  }

  const written_path = kind === 'architecture_md' ? ARCHITECTURE_FILE : LOCAL_COMMENTS
  const abs = join(root, written_path.split('/').join(sep))
  if (dryRun) {
    return { ...proposal, applied: false, dry_run: true, written_path }
  }

  if (kind === 'architecture_md') {
    const prior = files.read(abs)
    const next = prior.includes(`Finding ${proposal.finding_id}`)
      ? prior
      : `${prior.trimEnd()}${architectureBlock(proposal)}`
    files.write(abs, next.endsWith('\n') ? next : `${next}\n`)
  } else {
    files.write(abs, files.read(abs) + commentLine(proposal, now))
  }
  return { ...proposal, applied: true, written_path }
}

export function gateRemediationReport(report) {
  const issues = []
  const blob = JSON.stringify(report || {})
  if (report?.schema !== REMEDIATION_SCHEMA) {
    issues.push({ severity: 'high', code: 'bad_schema', message: 'Remediation report schema mismatch' })
  }
  if (report?.github_write || report?.comments_posted || report?.issues_opened) {
    issues.push({ severity: 'high', code: 'github_write', message: 'Remediation must not write to GitHub' })
  }
  if (report?.webhook_posted) {
    issues.push({ severity: 'high', code: 'webhook_posted', message: 'Remediation must not post webhooks' })
  }
  if (FORBIDDEN.test(blob)) {
    issues.push({ severity: 'high', code: 'extra_entity', message: 'Forbidden program token in remediation report' })
  }
  if (STUB.test(blob)) {
    issues.push({ severity: 'high', code: 'stub_as_done', message: 'Stub language in remediation report' })
  }
  if (report?.architect_verdict === 'fail') {
    issues.push({ severity: 'high', code: 'architect_fail', message: 'Failed architect report; remediation skipped' })
  }
  if (report?.dry_run && (report?.applied || []).some((row) => row.applied)) {
    issues.push({ severity: 'high', code: 'dry_run_applied', message: 'Dry-run must not apply writes' })
  }
  if ((report?.applied || []).some((row) => row.skip === 'unsafe_path')) {
    issues.push({ severity: 'high', code: 'unsafe_path', message: 'Proposal target escaped the repo' })
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
 * @param {object} architectReport
 * @param {object} [opts]
 */
export function remediate(architectReport, opts = {}) {
  if (opts.post === true || opts.githubWrite === true || opts.comment === true || opts.issue === true) {
    refuseGitHubWrite('remediate')
  }

  const now = opts.now ?? new Date().toISOString()
  const dryRun = opts.dryRun === true
  const root = resolve(opts.repo || architectReport?.repo || '.')
  const files = io(opts.fs)
  const proposals = architectReport?.verdict === 'fail' ? [] : (architectReport?.proposals || [])
  const applied = proposals.map((row) => applyOne(root, row, now, files, dryRun))
  const written = applied.filter((row) => row.applied)
  const report = {
    schema: REMEDIATION_SCHEMA,
    observed_at: now,
    repo: root,
    architect_verdict: architectReport?.verdict || 'pass',
    dry_run: dryRun,
    applied,
    applied_n: written.length,
    skipped_n: applied.length - written.length,
    architecture_written: written.some((row) => row.kind === 'architecture_md'),
    local_comments_n: written.filter((row) => row.kind === 'comment').length,
    github_write: false,
    webhook_posted: false,
    comments_posted: false,
    issues_opened: false,
  }
  return gateRemediationReport(report)
}
