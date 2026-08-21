#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gateReport } from './gate.js'
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

function main() {
  const root = process.argv[2] || join(HERE, '..', 'fixtures', 'sample-app')
  const report = runScan(root)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invoked) main()
