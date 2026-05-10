import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { normalizeLoopOptions, shouldContinueLoop } from "../lib/agent-runner-loop.mjs"

describe("agent runner loop helpers", () => {
  it("normalizes bounded loop options", () => {
    assert.deepEqual(normalizeLoopOptions({ iterations: "3", sleepSeconds: "0" }), {
      iterations: 3,
      sleepMs: 0,
    })
    assert.deepEqual(normalizeLoopOptions(), {
      iterations: 1,
      sleepMs: 60_000,
    })
  })

  it("rejects unbounded or invalid loop options", () => {
    assert.throws(
      () => normalizeLoopOptions({ iterations: "0" }),
      /invalid iterations: 0; expected 1..100/,
    )
    assert.throws(
      () => normalizeLoopOptions({ iterations: "101" }),
      /invalid iterations: 101; expected 1..100/,
    )
    assert.throws(
      () => normalizeLoopOptions({ sleepSeconds: "-1" }),
      /invalid sleep seconds: -1; expected 0..3600/,
    )
  })

  it("continues only after successful non-final iterations", () => {
    assert.equal(shouldContinueLoop({ iteration: 1, iterations: 3, status: 0 }), true)
    assert.equal(shouldContinueLoop({ iteration: 3, iterations: 3, status: 0 }), false)
    assert.equal(shouldContinueLoop({ iteration: 1, iterations: 3, status: 1 }), false)
  })
})
