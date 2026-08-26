/**
 * Phase 3 mechanical architect.
 * Turns a gated change event + scan into structured findings and
 * unapplied remediation proposals. Never writes GitHub or ARCHITECTURE.md.
 */

import { FORBIDDEN, STUB, gateFinding } from './gate.js'
import { isJsPath, refuseGitHubWrite } from './observe.js'

export const ARCHITECT_SCHEMA = 'living-docs.architect_report.v1'

const PROPOSALS = {
  'LDA-LAYER': (finding) => ({
    kind: 'comment',
    target: finding.path,
    body: `Remove UI import from domain (${finding.evidence})`,
  }),
  'LDA-IMPORT': (finding) => ({
    kind: 'comment',
    target: finding.path,
    body: `Remove forbidden import ${finding.evidence} from domain`,
  }),
  'LDA-TEST': (finding) => ({
    kind: 'architecture_md',
    target: 'ARCHITECTURE.md',
    body: `Document missing tests for ${finding.path}`,
  }),
}

export function changedJsPaths(event) {
  return (event?.changes || [])
    .map((row) => String(row.path || '').replace(/\\/g, '/'))
    .filter((path) => isJsPath(path))
}

export function findingsForEvent(event, opts = {}) {
  const min = opts.act_min_confidence ?? 0.8
  const raw = event?.scan?.findings || []
  const jsPaths = changedJsPaths(event)
  const scoped = jsPaths.length
    ? raw.filter((row) => jsPaths.includes(String(row.path || '').replace(/\\/g, '/')))
    : []
  return scoped.map((row) => gateFinding(row, { act_min_confidence: min }))
}

export function proposeFor(finding) {
  if (!finding?.act) return null
  const factory = PROPOSALS[finding.rule_id]
  const draft = factory
    ? factory(finding)
    : { kind: 'comment', target: finding.path, body: finding.summary || finding.id }
  return {
    finding_id: finding.id,
    rule_id: finding.rule_id,
    applied: false,
    ...draft,
  }
}

export function gateArchitectReport(report) {
  const issues = []
  const blob = JSON.stringify(report || {})
  if (report?.schema !== ARCHITECT_SCHEMA) {
    issues.push({ severity: 'high', code: 'bad_schema', message: 'Architect report schema mismatch' })
  }
  if (report?.github_write || report?.comments_posted || report?.issues_opened) {
    issues.push({ severity: 'high', code: 'github_write', message: 'Architect must not write to GitHub' })
  }
  if (report?.webhook_posted) {
    issues.push({ severity: 'high', code: 'webhook_posted', message: 'Architect must not post webhooks' })
  }
  if (report?.architecture_written) {
    issues.push({ severity: 'high', code: 'architecture_written', message: 'Architect must not write ARCHITECTURE.md' })
  }
  if ((report?.proposals || []).some((row) => row.applied)) {
    issues.push({ severity: 'high', code: 'proposal_applied', message: 'Phase 3 proposals must stay unapplied' })
  }
  if (FORBIDDEN.test(blob)) {
    issues.push({ severity: 'high', code: 'extra_entity', message: 'Forbidden program token in architect report' })
  }
  if (STUB.test(blob)) {
    issues.push({ severity: 'high', code: 'stub_as_done', message: 'Stub language in architect report' })
  }
  if (report?.event_verdict === 'fail') {
    issues.push({ severity: 'high', code: 'event_fail', message: 'Change event failed; architect skipped' })
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
 * @param {object} event gated change event (may include scan)
 * @param {object} [opts]
 */
export function architectFromEvent(event, opts = {}) {
  if (opts.post === true || opts.githubWrite === true || opts.writeArchitecture === true) {
    refuseGitHubWrite('architect')
  }

  const findings = event?.verdict === 'fail' ? [] : findingsForEvent(event, opts)
  const proposals = findings.map(proposeFor).filter(Boolean)
  const report = {
    schema: ARCHITECT_SCHEMA,
    observed_at: event?.observed_at,
    repo: event?.repo,
    event_verdict: event?.verdict || 'pass',
    model: 'mechanical-architect',
    findings,
    proposals,
    proposal_n: proposals.length,
    github_write: false,
    webhook_posted: false,
    comments_posted: false,
    issues_opened: false,
    architecture_written: false,
  }
  return gateArchitectReport(report)
}
