import assert from "node:assert/strict"
import test from "node:test"

import { sourceImportsOwnPackage } from "../lib/package-self-imports.mjs"

const ownName = "@voyant-travel/runtime"

test("ignores package imports written inside generated source templates", () => {
  const source = `
const generated = \`import type { RuntimeOptions } from "@voyant-travel/runtime"
import { createRuntime } from "@voyant-travel/runtime"\`
`

  assert.equal(sourceImportsOwnPackage(source, ownName), false)
})

test("detects actual package imports and re-exports", () => {
  assert.equal(
    sourceImportsOwnPackage('import { createRuntime } from "@voyant-travel/runtime"', ownName),
    true,
  )
  assert.equal(
    sourceImportsOwnPackage(
      'export { createRuntime } from "@voyant-travel/runtime/server"',
      ownName,
    ),
    true,
  )
})

test("does not confuse a package-name prefix with a self import", () => {
  assert.equal(
    sourceImportsOwnPackage('import { createRuntime } from "@voyant-travel/runtime-core"', ownName),
    false,
  )
})
