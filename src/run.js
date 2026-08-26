#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { architectFromEvent } from './architect.js'
import { gateReport } from './gate.js'
import { observeLocal, refuseGitHubWrite } from './observe.js'
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

function parseArgs(argv) {
  const args = argv.slice(2)
  if (args.includes('--github-write') || args.includes('--comment') || args.includes('--issue')) {
    refuseGitHubWrite('cli')
  }
  const architect = args.includes('--architect')
  const observe = args.includes('--observe') || architect
  const rest = args.filter((arg) => arg !== '--observe' && arg !== '--architect')
  const root = rest[0] || (observe ? process.cwd() : join(HERE, '..', 'fixtures', 'sample-app'))
  return { architect, observe, root }
}

function main() {
  const { architect, observe, root } = parseArgs(process.argv)
  const report = architect ? runArchitect(root) : observe ? runObserve(root) : runScan(root)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invoked) main()
