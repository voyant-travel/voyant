import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"

test("workflow services reuse package-bootstrapped app services", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/check-operator-workflow-service-authority.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  )
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Operator workflow service authority/)
})
