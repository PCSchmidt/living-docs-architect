#!/usr/bin/env node
/**
 * Held-out gate eval for living-docs-architect.
 *   npm run eval
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { architectFromEvent, gateArchitectReport } from '../src/architect.js'
import { dogfood, gateDogfoodReport } from '../src/dogfood.js'
import { gateFinding } from '../src/gate.js'
import { gateChangeEvent } from '../src/observe.js'
import { gateRemediationReport, remediate } from '../src/remediate.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_CASES = join(HERE, 'cases.json')

function verdictMatches(expected, actual) {
  return Array.isArray(expected) ? expected.includes(actual) : expected === actual
}

export function loadCatalog(path = DEFAULT_CASES) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function runEval(catalog, opts = {}) {
  const rows = []
  let catchHits = 0
  let catchN = 0
  let agreementHits = 0
  let actHits = 0

  for (const testCase of catalog.cases) {
    const gated = testCase.dogfood_report
      ? gateDogfoodReport(testCase.dogfood_report)
      : testCase.dogfood
        ? dogfood({
          workspace: testCase.dogfood.workspace || '/tmp/AIEngineeringProjects',
          repos: testCase.dogfood.repos,
          now: '2026-08-27T12:00:00.000Z',
          dryRun: testCase.dogfood.dryRun !== false,
          fs: {
            readdirSync() {
              return (testCase.dogfood.family_names || []).map((name) => ({
                name,
                isDirectory: () => true,
              }))
            },
          },
          runOne() {
            return {
              schema: 'living-docs.remediation_report.v1',
              verdict: 'pass',
              act: false,
              applied_n: testCase.dogfood.applied_n || 0,
              skipped_n: 0,
              architect_verdict: 'pass',
              github_write: false,
            }
          },
        })
        : testCase.remediation
          ? gateRemediationReport(testCase.remediation)
          : testCase.remediate
            ? remediate(testCase.remediate.architect, {
              repo: testCase.remediate.repo || '/tmp/public-app',
              now: '2026-08-26T21:00:00.000Z',
              dryRun: testCase.remediate.dryRun === true,
              fs: {
                mkdirSync() {},
                readFileSync() {
                  const err = new Error('ENOENT')
                  err.code = 'ENOENT'
                  throw err
                },
                writeFileSync() {},
              },
            })
            : testCase.report
              ? gateArchitectReport(testCase.report)
              : testCase.architect_event
                ? architectFromEvent(testCase.architect_event)
                : testCase.event
                  ? gateChangeEvent(testCase.event)
                  : gateFinding(testCase.finding)
    let agreed = verdictMatches(testCase.expect_verdict, gated.verdict)
      && gated.act === testCase.expect_act
    if (testCase.expect_proposal_n != null) {
      agreed = agreed && gated.proposal_n === testCase.expect_proposal_n
    }
    if (testCase.expect_applied_n != null) {
      agreed = agreed && gated.applied_n === testCase.expect_applied_n
    }
    if (testCase.expect_target_n != null) {
      agreed = agreed && gated.target_n === testCase.expect_target_n
    }
    if (testCase.expect_refused_n != null) {
      agreed = agreed && (gated.refused || []).length === testCase.expect_refused_n
    }
    if (agreed) agreementHits += 1
    if (testCase.kind === 'bad') {
      catchN += 1
      if (gated.verdict === 'fail' || gated.verdict === 'warn') catchHits += 1
      if (gated.act === false) actHits += 1
    }
    rows.push({
      case_id: testCase.case_id,
      project: catalog.project,
      runtime: catalog.runtime,
      scores: {
        D3: testCase.kind === 'bad' && (gated.verdict === 'fail' || gated.verdict === 'warn') ? 10 : testCase.kind === 'bad' ? 0 : null,
      },
      gate_verdict: gated.verdict,
      act: gated.act,
      expected: testCase.expect_verdict,
      agreed,
      failure_mode: testCase.failure_mode,
    })
  }

  const n = catalog.cases.length
  const report = {
    project: catalog.project,
    runtime: catalog.runtime,
    rubric: catalog.rubric,
    generated_at: opts.now ?? new Date().toISOString(),
    golden_set_size: n,
    split: catalog.split,
    seed: null,
    model: 'mechanical-architect',
    metrics: {
      D3_gate_catch_rate: catchN ? catchHits / catchN : null,
      D3_n: catchN,
      verdict_agreement: n ? agreementHits / n : null,
      known_bad_no_act: catchN ? actHits / catchN : null,
    },
    target_gate_catch: catalog.target_gate_catch ?? 0.85,
    cases: rows,
    next: 'Next family: meridian-jspace. Do not start red/blue.',
  }
  report.ok = (report.metrics.D3_gate_catch_rate ?? 0) >= report.target_gate_catch
    && report.metrics.verdict_agreement === 1
    && report.metrics.known_bad_no_act === 1
    && n >= 12
  return report
}

function main() {
  const report = runEval(loadCatalog())
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (!report.ok) process.exitCode = 1
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invoked) main()
