import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import {
  buildTickSnapshotRecord,
  type DispatchIntentRecord,
  finishDispatchIntent,
  isDispatchIntentActive,
  type TickSnapshotRecord,
} from "./control-plane.js"
import type { DispatchIntentStore } from "./dispatch-intent-store.js"
import type { TickSnapshotStore } from "./tick-snapshot-store.js"

const issue = {
  number: 579,
  repository: "voyantjs/voyant",
  title: "Test agent project intake workflow",
  url: "https://github.com/voyantjs/voyant/issues/579",
}

const tickSnapshot = {
  eventLog: {
    path: "/repo/.agent-runs/events.jsonl",
    recentEvents: [],
  },
  maxAgeDays: 1,
  project: {
    number: 1,
    owner: "voyantjs",
    title: "Voyant Engineering",
    url: "https://github.com/orgs/voyantjs/projects/1",
  },
  recommendations: [
    {
      action: "remote-bootstrap",
      command: "pnpm agent:queue:remote-bootstrap -- --issue 579 --repo voyantjs/voyant --yes",
      issue,
      priority: 20,
      reason: "remote workspace is ready for repository bootstrap",
      state: "Ready",
    },
  ],
  repository: "voyantjs/voyant",
}

describe("dispatch intent finish lifecycle", () => {
  it("finishes a leased dispatch intent and allows the next lease immediately", async () => {
    const intentStore = inMemoryDispatchIntentStore()
    const app = createApp({
      authTokens: ["secret"],
      createDispatchIntentId: () => "replacement_intent",
      dispatchIntentStore: intentStore,
      now: () => new Date("2026-05-12T05:32:00.000Z"),
      tickSnapshotStore: inMemoryTickSnapshotStore([buildTickSnapshotRecord(tickSnapshot)]),
    })
    await intentStore.putIntent(leasedIntent())

    const finished = await app.request("/api/dispatch-intents/intent_579/finish", {
      body: JSON.stringify({
        holder: "supervisor:test",
        reason: "command finished",
        status: "completed",
      }),
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      method: "POST",
    })

    expect(finished.status).toBe(200)
    await expect(finished.json()).resolves.toMatchObject({
      intent: {
        id: "intent_579",
        resolution: {
          finishedAt: "2026-05-12T05:32:00.000Z",
          holder: "supervisor:test",
          reason: "command finished",
        },
        status: "completed",
      },
      storage: {
        activeUpdated: true,
        persisted: true,
      },
    })

    const response = await app.request("/api/dispatch-intents/latest", {
      body: JSON.stringify({
        lease: {
          holder: "supervisor:next",
        },
        repository: "voyantjs/voyant",
      }),
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      method: "POST",
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      intent: {
        id: "replacement_intent",
        lease: {
          holder: "supervisor:next",
        },
      },
    })
  })

  it("rejects finishing intents for the wrong holder or missing storage", async () => {
    const intentStore = inMemoryDispatchIntentStore()
    const app = createApp({
      authTokens: ["secret"],
      dispatchIntentStore: intentStore,
      now: () => new Date("2026-05-12T05:32:00.000Z"),
      tickSnapshotStore: inMemoryTickSnapshotStore([buildTickSnapshotRecord(tickSnapshot)]),
    })
    await intentStore.putIntent(leasedIntent())

    const holderMismatch = await app.request("/api/dispatch-intents/intent_579/finish", {
      body: JSON.stringify({
        holder: "supervisor:other",
        status: "released",
      }),
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      method: "POST",
    })
    expect(holderMismatch.status).toBe(409)
    await expect(holderMismatch.json()).resolves.toMatchObject({
      error: "dispatch_intent_holder_mismatch",
      intent: {
        id: "intent_579",
      },
    })

    const notFound = await app.request("/api/dispatch-intents/missing/finish", {
      body: JSON.stringify({
        holder: "supervisor:test",
        status: "released",
      }),
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      method: "POST",
    })
    expect(notFound.status).toBe(404)
    await expect(notFound.json()).resolves.toEqual({ error: "dispatch_intent_not_found" })

    const noIntentStore = createApp({ authTokens: ["secret"] })
    const noStore = await noIntentStore.request("/api/dispatch-intents/intent_579/finish", {
      body: JSON.stringify({
        holder: "supervisor:test",
        status: "released",
      }),
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      method: "POST",
    })
    expect(noStore.status).toBe(503)
    await expect(noStore.json()).resolves.toEqual({
      error: "dispatch_intent_storage_not_configured",
    })
  })
})

function leasedIntent(): DispatchIntentRecord {
  return {
    createdAt: "2026-05-12T05:30:00.000Z",
    id: "intent_579",
    lease: {
      acquiredAt: "2026-05-12T05:30:00.000Z",
      expiresAt: "2026-05-12T05:45:00.000Z",
      holder: "supervisor:test",
      ttlSeconds: 900,
    },
    plan: {
      action: "remote-bootstrap",
      command: ["pnpm", "agent:queue:remote-bootstrap"],
      issue,
      reason: "leased command",
      repository: "voyantjs/voyant",
      requiresMutation: true,
    },
    source: {
      acceptedAt: "2026-05-12T05:00:00.000Z",
      recommendationCount: 1,
      repository: "voyantjs/voyant",
      type: "latest_tick_snapshot",
    },
    status: "leased",
  }
}

function inMemoryTickSnapshotStore(records: TickSnapshotRecord[]): TickSnapshotStore {
  const latest = new Map(
    records.map((record) => [record.snapshot.repository.toLowerCase(), record]),
  )

  return {
    async getLatest(repository) {
      return latest.get(repository.toLowerCase()) ?? null
    },
    async putLatest(record) {
      latest.set(record.snapshot.repository.toLowerCase(), record)
      return { key: `latest/${record.snapshot.repository.toLowerCase()}.json` }
    },
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
