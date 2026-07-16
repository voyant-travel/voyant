import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("standard frontend authority remains package-owned", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/check-operator-frontend-shell-authority.mjs"],
    { encoding: "utf8" },
  )
  assert.match(output, /Operator frontend shell authority: OK \(13 starter src files\)/)
})
