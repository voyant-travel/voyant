import assert from "node:assert/strict"
import test from "node:test"

import {
  inspectFirstPartyToolOutputSchemas,
  isFirstPartyToolRuntimePath,
} from "../lib/first-party-tool-output-schemas.mjs"

test("recognizes first-party Tool runtime modules", () => {
  assert.equal(isFirstPartyToolRuntimePath("packages/bookings/src/tools.ts"), true)
  assert.equal(isFirstPartyToolRuntimePath("packages/inventory/src/extras-tools.ts"), true)
  assert.equal(isFirstPartyToolRuntimePath("packages/bookings/src/extras/tools.ts"), true)
  assert.equal(isFirstPartyToolRuntimePath("packages/bookings/src/tools.test.ts"), false)
  assert.equal(isFirstPartyToolRuntimePath("apps/operator/src/tools.ts"), false)
})

test("rejects z.custom and opaque top-level Tool outputs", () => {
  const failures = inspectFirstPartyToolOutputSchemas(
    new Map([
      [
        "packages/example/src/tools.ts",
        `const one = defineTool({ outputSchema: z.custom<Result>() })\n` +
          `const two = defineTool({ outputSchema: z.unknown() })`,
      ],
    ]),
  )

  assert.deepEqual(failures, [
    "packages/example/src/tools.ts:1 uses z.custom(); first-party Tool runtimes must expose structural Zod schemas",
    "packages/example/src/tools.ts:2 uses an opaque top-level outputSchema",
  ])
})

test("allows structural outputs with nested open payloads", () => {
  const failures = inspectFirstPartyToolOutputSchemas(
    new Map([
      [
        "packages/example/src/tools.ts",
        "const tool = defineTool({ outputSchema: z.object({ id: z.string(), payload: z.unknown() }) })",
      ],
    ]),
  )

  assert.deepEqual(failures, [])
})
