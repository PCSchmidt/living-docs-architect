import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runScan } from '../src/run.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = join(HERE, '..', 'fixtures', 'sample-app')

test('sample-app scan acts on high layering and import, not on missing tests', () => {
  const report = runScan(APP)
  const byRule = Object.fromEntries(report.findings.map((row) => [row.rule_id, row]))
  assert.equal(byRule['LDA-LAYER'].act, true)
  assert.equal(byRule['LDA-IMPORT'].act, true)
  assert.equal(byRule['LDA-TEST'].act, false)
  assert.equal(byRule['LDA-TEST'].severity, 'medium')
  assert.equal(report.act_n, 2)
})
