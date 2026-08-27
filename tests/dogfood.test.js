import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  FAMILY_REPOS,
  classifyTarget,
  dogfood,
  gateDogfoodReport,
  listFamilyRepos,
  resolveWorkspaceRoot,
} from '../src/dogfood.js'
import { refuseGitHubWrite } from '../src/observe.js'

function stubRunOne(applied_n = 0) {
  return () => ({
    schema: 'living-docs.remediation_report.v1',
    verdict: 'pass',
    act: false,
    applied_n,
    skipped_n: 1,
    architect_verdict: 'pass',
    github_write: false,
  })
}

function memDir(names) {
  return {
    readdirSync() {
      return names.map((name) => ({ name, isDirectory: () => true }))
    },
  }
}

test('allowlist includes public family remotes only', () => {
  assert.ok(FAMILY_REPOS.includes('living-docs-architect'))
  assert.ok(FAMILY_REPOS.includes('portfolio-kit'))
  assert.equal(classifyTarget('/tmp/AIEngineeringProjects/living-docs-architect').allowed, true)
  assert.equal(classifyTarget('/tmp/AIEngineeringProjects/HardPowerIntelligence').allowed, false)
  assert.equal(classifyTarget('/tmp/Meridian/Meridian').allowed, false)
  assert.equal(classifyTarget('/tmp/deepseek-harness').allowed, false)
  assert.match(classifyTarget('/tmp/F-35-program').reason, /forbidden/)
})

test('workspace discovery lists family children', () => {
  const fs = memDir(['living-docs-architect', 'portfolio-kit', 'HardPowerIntelligence', 'node_modules'])
  const listed = listFamilyRepos('/tmp/AIEngineeringProjects', fs).map((p) => p.replace(/\\/g, '/'))
  assert.ok(listed.some((p) => p.endsWith('/living-docs-architect')))
  assert.ok(listed.some((p) => p.endsWith('/portfolio-kit')))
  assert.equal(listed.length, 2)
  assert.ok(resolveWorkspaceRoot('/tmp/AIEngineeringProjects/living-docs-architect', fs).replace(/\\/g, '/').endsWith('/AIEngineeringProjects'))
})

test('dogfood dry-run scans allowlisted family repos', () => {
  const fs = memDir(['living-docs-architect', 'dsh-plugin-honesty-gate'])
  const report = dogfood({
    workspace: '/tmp/AIEngineeringProjects',
    now: '2026-08-27T12:00:00.000Z',
    dryRun: true,
    fs,
    runOne: stubRunOne(0),
  })
  assert.equal(report.schema, 'living-docs.dogfood_report.v1')
  assert.equal(report.verdict, 'pass')
  assert.equal(report.act, false)
  assert.equal(report.dry_run, true)
  assert.equal(report.target_n, 2)
  assert.equal(report.applied_n, 0)
  assert.equal(report.github_write, false)
  assert.equal(report.refused.length, 0)
})

test('explicit HardPowerIntelligence and GitHub writes fail closed', () => {
  const refused = dogfood({
    workspace: '/tmp/AIEngineeringProjects',
    repos: ['/tmp/AIEngineeringProjects/HardPowerIntelligence'],
    dryRun: true,
    runOne: stubRunOne(0),
    fs: memDir(['HardPowerIntelligence']),
  })
  assert.equal(refused.verdict, 'fail')
  assert.equal(refused.act, false)
  assert.equal(refused.target_n, 0)
  assert.equal(refused.refused[0].reason, 'not_family')

  const gh = gateDogfoodReport({
    schema: 'living-docs.dogfood_report.v1',
    targets: [{ repo_id: 'living-docs-architect', allowed: true, applied_n: 0 }],
    target_n: 1,
    refused: [],
    github_write: true,
    comments_posted: true,
  })
  assert.equal(gh.verdict, 'fail')
  assert.throws(() => dogfood({ workspace: '/tmp/x', githubWrite: true, runOne: stubRunOne() }), /writes local files only/)
  assert.throws(() => refuseGitHubWrite('dogfood'), /writes local files only/)
})

test('dry-run must not apply; empty workspace fails closed', () => {
  const applied = gateDogfoodReport({
    schema: 'living-docs.dogfood_report.v1',
    dry_run: true,
    target_n: 1,
    requested_n: 0,
    refused: [],
    targets: [{ repo_id: 'living-docs-architect', allowed: true, applied_n: 2 }],
    github_write: false,
  })
  assert.equal(applied.verdict, 'fail')
  assert.ok(applied.issues.some((row) => row.code === 'dry_run_applied'))

  const empty = dogfood({
    workspace: '/tmp/empty-ws',
    dryRun: true,
    fs: memDir(['CloakBrowser']),
    runOne: stubRunOne(0),
  })
  assert.equal(empty.verdict, 'fail')
  assert.ok(empty.issues.some((row) => row.code === 'no_family_targets'))
})
