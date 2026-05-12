import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { planDispatchIntentRelease } from "../lib/agent-runner-dispatch-release.mjs"

describe("agent runner dispatch release helpers", () => {
  it("builds a release request for expired active dispatch intents", () => {
    const plan = planDispatchIntentRelease({
      activeResult: {
        active: false,
        intent: dispatchIntent({
          expiresAt: "2026-05-12T11:59:00.000Z",
        }),
      },
      now: new Date("2026-05-12T12:00:00.000Z"),
    })

    assert.deepEqual(plan, {
      expired: true,
      id: "intent_579",
      intent: dispatchIntent({
        expiresAt: "2026-05-12T11:59:00.000Z",
      }),
      release: true,
      request: {
        holder: "runner:cloudflare",
        reason: "released expired dispatch intent",
        status: "released",
      },
    })
  })

  it("refuses active dispatch intents unless forced", () => {
    const activeResult = {
      active: true,
      intent: dispatchIntent({
        expiresAt: "2026-05-12T12:15:00.000Z",
      }),
    }

    assert.deepEqual(
      planDispatchIntentRelease({
        activeResult,
        now: new Date("2026-05-12T12:00:00.000Z"),
      }),
      {
        expired: false,
        intent: activeResult.intent,
        release: false,
        reason: "intent_still_active",
      },
    )

    assert.deepEqual(
      planDispatchIntentRelease({
        activeResult,
        force: true,
        now: new Date("2026-05-12T12:00:00.000Z"),
        reason: "operator override",
      }),
      {
        expired: false,
        id: "intent_579",
        intent: activeResult.intent,
        release: true,
        request: {
          holder: "runner:cloudflare",
          reason: "operator override",
          status: "released",
        },
      },
    )
  })

  it("trusts the server active flag over local lease expiry", () => {
    const activeResult = {
      active: true,
      intent: dispatchIntent({
        expiresAt: "2026-05-12T11:59:00.000Z",
      }),
    }

    assert.deepEqual(
      planDispatchIntentRelease({
        activeResult,
        now: new Date("2026-05-12T12:00:00.000Z"),
      }),
      {
        expired: true,
        intent: activeResult.intent,
        release: false,
        reason: "intent_still_active",
      },
    )
  })

  it("refuses missing or already-terminal intents", () => {
    assert.deepEqual(planDispatchIntentRelease({ activeResult: {} }), {
      release: false,
      reason: "missing_intent",
    })

    const terminalIntent = dispatchIntent({
      status: "completed",
    })
    assert.deepEqual(
      planDispatchIntentRelease({
        activeResult: {
          active: false,
          intent: terminalIntent,
        },
      }),
      {
        intent: terminalIntent,
        release: false,
        reason: "intent_not_leased",
      },
    )
  })
})

function dispatchIntent({ expiresAt = "2026-05-12T12:15:00.000Z", status = "leased" } = {}) {
  return {
    createdAt: "2026-05-12T12:00:00.000Z",
    id: "intent_579",
    lease: {
      acquiredAt: "2026-05-12T12:00:00.000Z",
      expiresAt,
      holder: "runner:cloudflare",
      ttlSeconds: 900,
    },
    plan: {
      action: "sync-pr",
      command: ["pnpm", "agent:queue:sync-pr"],
      issue: {
        number: 579,
        repository: "voyantjs/voyant",
        title: "Test issue",
        url: "https://github.com/voyantjs/voyant/issues/579",
      },
      reason: "ready",
      repository: "voyantjs/voyant",
      requiresMutation: true,
    },
    source: {
      acceptedAt: "2026-05-12T11:59:00.000Z",
      recommendationCount: 1,
      repository: "voyantjs/voyant",
      type: "latest_tick_snapshot",
    },
    status,
  }
}
