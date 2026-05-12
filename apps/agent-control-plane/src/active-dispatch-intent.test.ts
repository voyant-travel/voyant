import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import {
  type DispatchIntentRecord,
  finishDispatchIntent,
  isDispatchIntentActive,
} from "./control-plane.js"
import type { DispatchIntentStore } from "./dispatch-intent-store.js"

const issue = {
  number: 579,
  repository: "voyantjs/voyant",
  title: "Test agent project intake workflow",
  url: "https://github.com/voyantjs/voyant/issues/579",
}

describe("active dispatch intent reads", () => {
  it("returns the active lease for an issue and action without mutating it", async () => {
    const intentStore = inMemoryDispatchIntentStore()
    const app = createApp({
      authTokens: ["secret"],
      dispatchIntentStore: intentStore,
      now: () => new Date("2026-05-12T05:30:00.000Z"),
    })
    await intentStore.putIntent(leasedIntent({ id: "active_intent" }))

    const response = await app.request(
      "/api/dispatch-intents/active?repository=VoyantJS/Voyant&issue=579&action=remote-bootstrap",
      {
        headers: { authorization: "Bearer secret" },
      },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      active: true,
      intent: {
        id: "active_intent",
        lease: {
          holder: "supervisor:existing",
        },
        plan: {
          action: "remote-bootstrap",
          issue: {
            number: 579,
          },
        },
      },
    })
  })

  it("reports expired active pointers without treating them as active leases", async () => {
    const intentStore = inMemoryDispatchIntentStore()
    const app = createApp({
      authTokens: ["secret"],
      dispatchIntentStore: intentStore,
      now: () => new Date("2026-05-12T05:45:01.000Z"),
    })
    await intentStore.putIntent(leasedIntent({ id: "expired_intent" }))

    const response = await app.request(
      "/api/dispatch-intents/active?repository=voyantjs/voyant&issueNumber=579&action=remote-bootstrap",
      {
        headers: { authorization: "Bearer secret" },
      },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      active: false,
      intent: {
        id: "expired_intent",
      },
    })
  })

  it("validates active lease reads before accessing storage", async () => {
    const app = createApp({
      authTokens: ["secret"],
      dispatchIntentStore: inMemoryDispatchIntentStore(),
    })

    const invalid = await app.request(
      "/api/dispatch-intents/active?repository=voyantjs/voyant&issue=579&action=remote-run-command",
      {
        headers: { authorization: "Bearer secret" },
      },
    )
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toMatchObject({
      error: "invalid_active_dispatch_intent_request",
    })

    const missing = await app.request(
      "/api/dispatch-intents/active?repository=voyantjs/voyant&issue=579&action=remote-bootstrap",
      {
        headers: { authorization: "Bearer secret" },
      },
    )
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toEqual({ error: "dispatch_intent_not_found" })
  })
})

function leasedIntent({ id }: { id: string }): DispatchIntentRecord {
  return {
    createdAt: "2026-05-12T05:25:00.000Z",
    id,
    lease: {
      acquiredAt: "2026-05-12T05:25:00.000Z",
      expiresAt: "2026-05-12T05:35:00.000Z",
      holder: "supervisor:existing",
      ttlSeconds: 600,
    },
    plan: {
      action: "remote-bootstrap",
      command: ["pnpm", "agent:queue:remote-bootstrap"],
      issue,
      reason: "existing lease",
      repository: "voyantjs/voyant",
      requiresMutation: true,
    },
    source: {
      acceptedAt: "2026-05-12T05:00:00.000Z",
      recommendationCount: 2,
      repository: "voyantjs/voyant",
      type: "latest_tick_snapshot",
    },
    status: "leased",
  }
}

function inMemoryDispatchIntentStore(): DispatchIntentStore {
  const active = new Map<string, DispatchIntentRecord>()
  const byId = new Map<string, DispatchIntentRecord>()

  return {
    async acquireIntent(record, { now }) {
      const key = activeIntentKey(record)
      const existing = active.get(key)
      if (existing && isDispatchIntentActive(existing, now)) {
        return { acquired: false, activeIntent: existing }
      }

      active.set(key, record)
      byId.set(record.id, record)
      return { acquired: true, write: { activeKey: key, key: `${record.id}.json` } }
    },
    async finishIntent({ id, now, request }) {
      const intent = byId.get(id)
      if (!intent) return { finished: false, reason: "not_found" }
      if (intent.status !== "leased")
        return { finished: false, intent, reason: "intent_not_active" }
      if (intent.lease.holder !== request.holder) {
        return { finished: false, intent, reason: "holder_mismatch" }
      }

      const finishedIntent = finishDispatchIntent({ intent, now, request })
      const activeKey = activeIntentKey(intent)
      byId.set(id, finishedIntent)
      active.set(activeKey, finishedIntent)
      return {
        finished: true,
        intent: finishedIntent,
        write: { activeKey, activeUpdated: true, key: `${intent.id}.json` },
      }
    },
    async getActive(reference) {
      return active.get(activeIntentReferenceKey(reference)) ?? null
    },
    async putIntent(record) {
      const activeKey = activeIntentKey(record)
      byId.set(record.id, record)
      active.set(activeKey, record)
      return { activeKey, key: `${record.id}.json` }
    },
  }
}

function activeIntentKey(record: DispatchIntentRecord) {
  return activeIntentReferenceKey({
    action: record.plan.action,
    issueNumber: record.plan.issue.number,
    repository: record.plan.repository,
  })
}

function activeIntentReferenceKey({
  action,
  issueNumber,
  repository,
}: {
  action: string
  issueNumber: number
  repository: string
}) {
  return `active/${repository.toLowerCase()}/${issueNumber}/${action.toLowerCase()}.json`
}
