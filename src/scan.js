/**
 * Mechanical architectural scan. No network, no LLM.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, relative, sep } from 'node:path'

function walkJs(root, dir = root, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      walkJs(root, full, out)
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full)
    }
  }
  return out
}

function rel(root, file) {
  return relative(root, file).split(sep).join('/')
}

function importsOf(source) {
  const found = []
  const re = /(?:import\s+[\s\S]*?from\s+|require\s*\(\s*)['"]([^'"]+)['"]/g
  let match
  while ((match = re.exec(source))) found.push(match[1])
  return found
}

function testPathFor(root, file) {
  const name = basename(file, '.js')
  return join(root, 'tests', `${name}.test.js`)
}

/**
 * @param {string} root
 * @param {object} catalog
 */
export function scanWorkspace(root, catalog) {
  const files = walkJs(root)
  const findings = []
  let n = 1

  for (const file of files) {
    const path = rel(root, file)
    const source = readFileSync(file, 'utf8')
    const imports = importsOf(source)
    const dir = dirname(path)

    for (const rule of catalog.rules) {
      if (rule.id === 'LDA-LAYER' && dir.startsWith(rule.from)) {
        const hit = imports.some((spec) => spec.includes('../ui/') || spec.includes('src/ui'))
        if (hit) {
          findings.push({
            id: `F${n++}`,
            rule_id: rule.id,
            path,
            evidence: imports.join(', '),
            severity: rule.severity,
            confidence: rule.confidence,
            summary: `${path} imports UI from domain`,
          })
        }
      }
      if (rule.id === 'LDA-IMPORT' && dir.startsWith(rule.from)) {
        const hit = imports.includes(rule.forbid_module)
        if (hit) {
          findings.push({
            id: `F${n++}`,
            rule_id: rule.id,
            path,
            evidence: rule.forbid_module,
            severity: rule.severity,
            confidence: rule.confidence,
            summary: `${path} imports ${rule.forbid_module}`,
          })
        }
      }
      if (rule.id === 'LDA-TEST' && dir.startsWith(rule.source_glob)) {
        if (rule.skip?.includes(basename(file))) continue
        try {
          readFileSync(testPathFor(root, file), 'utf8')
        } catch {
          findings.push({
            id: `F${n++}`,
            rule_id: rule.id,
            path,
            evidence: `missing tests/${basename(file, '.js')}.test.js`,
            severity: rule.severity,
            confidence: rule.confidence,
            summary: `${path} has no tests/ sibling`,
          })
        }
      }
    }
  }

  return { root, findings }
}
