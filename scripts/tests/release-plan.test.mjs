import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test from "node:test"

const require = createRequire(import.meta.url)
const { getReleaseMode } = require("../release-plan.cjs")

test("release PR creation takes priority over pending publication", () => {
  assert.equal(getReleaseMode(true, true), "version")
})

test("pending packages publish after all changesets are applied", () => {
  assert.equal(getReleaseMode(false, true), "publish")
})

test("an up-to-date repository needs no release action", () => {
  assert.equal(getReleaseMode(false, false), "none")
})
