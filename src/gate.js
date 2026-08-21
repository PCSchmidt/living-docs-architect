/**
 * Act gate: only high-confidence, high-severity findings may act.
 * Fail-closed on stub language and forbidden program tokens.
 */

export const FORBIDDEN = /\b(F-?35|JPO|ITAR|CUI|classified)\b|employer inventory/i
export const STUB = /\b(TODO|TBD|placeholder|coming soon)\b/i

function blobOf(finding) {
  return `${finding.summary || ''} ${finding.evidence || ''} ${finding.path || ''}`
}

export function gateFinding(finding, opts = {}) {
  const min = opts.act_min_confidence ?? 0.8
  const issues = []
  const text = blobOf(finding)

  if (FORBIDDEN.test(text)) {
    issues.push({ severity: 'high', code: 'extra_entity', message: 'Forbidden program token' })
  }
  if (STUB.test(text)) {
    issues.push({ severity: 'high', code: 'stub_as_done', message: 'Stub language in finding' })
  }
  if (!finding.id) {
    issues.push({ severity: 'high', code: 'missing_id', message: 'Finding is missing id' })
  }
  if (!finding.rule_id) {
    issues.push({ severity: 'high', code: 'missing_rule', message: 'Finding is missing rule_id' })
  }
  if (finding.confidence == null || finding.confidence < 0 || finding.confidence > 1) {
    issues.push({ severity: 'high', code: 'confidence_out_of_range', message: 'Confidence must be 0–1' })
  }

  const highIssue = issues.some((row) => row.severity === 'high')
  const act = !highIssue
    && finding.severity === 'high'
    && (finding.confidence ?? 0) >= min

  return {
    ...finding,
    act,
    issues,
    verdict: highIssue ? 'fail' : act ? 'pass' : 'warn',
  }
}

export function gateReport(scan, opts = {}) {
  const findings = (scan.findings || []).map((row) => gateFinding(row, opts))
  const act_n = findings.filter((row) => row.act).length
  return {
    root: scan.root,
    findings,
    act_n,
    act_ids: findings.filter((row) => row.act).map((row) => row.id),
  }
}
