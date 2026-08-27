#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { architectFromEvent } from './architect.js'
import { dogfood } from './dogfood.js'
import { gateReport } from './gate.js'
import { observeLocal, refuseGitHubWrite } from './observe.js'
import { remediate } from './remediate.js'
import { scanWorkspace } from './scan.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const RULES = join(HERE, '..', 'rules', 'rules.json')

export function loadRules(path = RULES) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function runScan(root, catalog = loadRules()) {
  const scan = scanWorkspace(resolve(root), catalog)
  return gateReport(scan, { act_min_confidence: catalog.act_min_confidence })
}

export function runObserve(repo, opts = {}) {
  const catalog = opts.catalog ?? loadRules()
  return observeLocal({
    repo: resolve(repo),
    now: opts.now,
    gitRunner: opts.gitRunner,
    scanFn: (root) => runScan(root, catalog),
  })
}

export function runArchitect(repo, opts = {}) {
  const event = runObserve(repo, opts)
  return architectFromEvent(event, { act_min_confidence: (opts.catalog ?? loadRules()).act_min_confidence })
}

export function runRemediate(repo, opts = {}) {
  const architect = runArchitect(repo, opts)
  return remediate(architect, {
    repo: resolve(repo),
    now: opts.now,
    dryRun: opts.dryRun !== false && opts.apply !== true,
    fs: opts.fs,
  })
}

export function runDogfood(workspace, opts = {}) {
  return dogfood({
    workspace: resolve(workspace),
    repos: opts.repos,
    now: opts.now,
    dryRun: opts.dryRun !== false && opts.apply !== true,
    apply: opts.apply,
    fs: opts.fs,
    runOne: opts.runOne || ((repo, inner) => runRemediate(repo, inner)),
  })
}

function parseArgs(argv) {
  const args = argv.slice(2)
  if (args.includes('--github-write') || args.includes('--comment') || args.includes('--issue')) {
    refuseGitHubWrite('cli')
  }
  const apply = args.includes('--apply')
  const dogfoodFlag = args.includes('--dogfood')
  const remediateFlag = args.includes('--remediate')
  const architect = args.includes('--architect')
  const observe = args.includes('--observe') || architect || remediateFlag
  const rest = args.filter((arg) => !['--observe', '--architect', '--remediate', '--dogfood', '--apply', '--dry-run'].includes(arg))
  const defaultRoot = dogfoodFlag
    ? join(HERE, '..', '..')
    : observe
      ? process.cwd()
      : join(HERE, '..', 'fixtures', 'sample-app')
  const root = rest[0] || defaultRoot
  return { architect, observe, remediate: remediateFlag, dogfood: dogfoodFlag, apply, root, repos: rest.slice(1) }
}

function main() {
  const { architect, observe, remediate: doRemediate, dogfood: doDogfood, apply, root, repos } = parseArgs(process.argv)
  const report = doDogfood
    ? runDogfood(root, { dryRun: !apply, apply, repos: repos.length ? repos : undefined })
    : doRemediate
      ? runRemediate(root, { dryRun: !apply, apply })
      : architect
        ? runArchitect(root)
        : observe
          ? runObserve(root)
          : runScan(root)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invoked) main()
