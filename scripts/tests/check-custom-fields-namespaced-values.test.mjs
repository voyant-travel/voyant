import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { resolve } from "node:path"
import test from "node:test"

test("namespaced custom-field values keep runtime identity and package-owned migrations", () => {
  assert.match(
    execFileSync("node", [resolve("scripts/check-custom-fields-namespaced-values.mjs")], {
      encoding: "utf8",
    }),
    /OK/,
  )
})
