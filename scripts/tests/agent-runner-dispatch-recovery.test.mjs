import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  expiredActiveDispatchIntent,
  releaseExpiredActiveDispatchIntent,
} from "../lib/agent-runner-dispatch-recovery.mjs"

describe("agent runner dispatch recovery", () => {
  it("extracts expired active intents from control-plane lease conflicts", () => {
    const error = conflictError({ expiresAt: "2026-05-12T12:00:00.000Z" })

    assert.equal(
      expiredActiveDispatchIntent(error, {
        now: new Date("2026-05-12T12:01:00.000Z"),
      }).id,
      "intent_579",
    )
    assert.equal(
      expiredActiveDispatchIntent(error, {
        now: new Date("2026-05-12T11:59:00.000Z"),
      }),
      null,
    )
  })

  it("finishes expired active intents as released using the stored holder", async () => {
    const calls = []
    const result = await releaseExpiredActiveDispatchIntent({
      config: {
        token: "tok",
        url: "https://control.example.com",
      },
      error: conflictError({ expiresAt: "2026-05-12T12:00:00.000Z" }),
      finishDispatchIntent: async (call) => {
        calls.push(call)
        return { intent: { id: call.id, status: "released" } }
      },
      log: () => {},
      now: new Date("2026-05-12T12:01:00.000Z"),
    })

    assert.equal(result.released, true)
    assert.deepEqual(calls, [
      {
        id: "intent_579",
        request: {
          holder: "executor:old",
          reason: "released expired dispatch intent before executor retry",
          status: "released",
        },
        token: "tok",
        url: "https://control.example.com",
      },
    ])
  })
})

function conflictError({ expiresAt }) {
  return {
    body: {
      intent: {
        id: "intent_579",
        lease: {
          expiresAt,
          holder: "executor:old",
        },
        plan: {
          action: "run-command",
        },
        status: "leased",
      },
    },
    status: 409,
  }
}
