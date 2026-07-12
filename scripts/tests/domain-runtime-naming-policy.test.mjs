import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { findDomainRuntimeNamingViolations } from "../lib/domain-runtime-naming-policy.mjs"

function fixture({ exports = {}, kind = "module", source = "export function createRuntime() {}" }) {
  const root = mkdtempSync(path.join(tmpdir(), "voyant-domain-runtime-naming-"))
  const packageRoot = path.join(root, "packages/example")
  mkdirSync(path.join(packageRoot, "src"), { recursive: true })
  writeFileSync(
    path.join(packageRoot, "package.json"),
    JSON.stringify({ name: "@voyant-travel/example", voyant: { kind }, exports }),
  )
  writeFileSync(path.join(packageRoot, "src/runtime.ts"), source)
  return root
}

test("accepts neutral runtime APIs in first-party domain modules", () => {
  assert.deepEqual(
    findDomainRuntimeNamingViolations(fixture({ exports: { "./runtime": "./src/runtime.ts" } })),
    [],
  )
})

test("rejects target-labelled domain exports", () => {
  assert.deepEqual(
    findDomainRuntimeNamingViolations(
      fixture({ exports: { "./standard-node": "./src/runtime.ts" } }),
    ),
    ["@voyant-travel/example must not export a target-labelled /standard-node API"],
  )
})

test("rejects target-labelled runtime API names", () => {
  assert.deepEqual(
    findDomainRuntimeNamingViolations(
      fixture({ source: "export function createExampleStandardNodeRuntime() {}" }),
    ),
    ["packages/example/src/runtime.ts must not declare a StandardNode runtime API name"],
  )
})

test("does not apply domain-module policy to framework libraries", () => {
  assert.deepEqual(
    findDomainRuntimeNamingViolations(
      fixture({ kind: "library", source: "export function buildStandardNodeStarter() {}" }),
    ),
    [],
  )
})
