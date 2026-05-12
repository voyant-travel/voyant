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

const tickSnapshot = {
  project: {
    owner: "voyantjs",
    number: 1,
    title: "Voyant Engineering",
    url: "https://github.com/orgs/voyantjs/projects/1",
  },
  repository: "voyantjs/voyant",
  maxAgeDays: 1,
  eventLog: {
    path: "/repo/.agent-runs/events.jsonl",
    recentEvents: [],
  },
  recommendations: [
    {
      action: "remote-bootstrap",
      command: "pnpm agent:queue:remote-bootstrap -- --issue 579 --repo voyantjs/voyant --yes",
      issue: {
        number: 579,
        title: "Test agent project intake workflow",
        url: "https://github.com/voyantjs/voyant/issues/579",
        repository: "voyantjs/voyant",
      },
      priority: 20,
      reason: "remote workspace is ready for repository bootstrap",
      state: "Ready",
    },
    {
      action: "remote-run-command",
      command:
        'pnpm agent:queue:remote-run-command -- --issue 580 --repo voyantjs/voyant --command "<implementation-command>" --yes',
      issue: {
        number: 580,
        title: "Run implementation",
        url: "https://github.com/voyantjs/voyant/issues/580",
        repository: "voyantjs/voyant",
      },
      priority: 30,
      reason: "implementation execution remains explicit",
      state: "Planning",
    },
  ],
}

describe("latest dispatch intents", () => {
  it("leases a dispatch intent from the latest stored tick snapshot", async () => {
    const intentStore = inMemoryDispatchIntentStore()
    const app = createApp({
      authTokens: ["secret"],
      createDispatchIntentId: () => "intent_579",
      dispatchIntentStore: intentStore,
      now: () => new Date("2026-05-12T05:30:00.000Z"),
      tickSnapshotStore: inMemoryTickSnapshotStore([
        buildTickSnapshotRecord(tickSnapshot, {
          acceptedAt: "2026-05-12T05:00:00.000Z",
        }),
      ]),
    })

    const response = await app.request("/api/dispatch-intents/latest", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({
        filters: {
          action: "remote-bootstrap",
          issueNumber: 579,
        },
        lease: {
          holder: "supervisor:test",
          ttlSeconds: 600,
        },
        options: {
          eventLog: ".agent-runs/supervisor.jsonl",
        },
        repository: "VoyantJS/Voyant",
      }),
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      reason: "leased",
      source: {
        acceptedAt: "2026-05-12T05:00:00.000Z",
        recommendationCount: 2,
        repository: "voyantjs/voyant",
        type: "latest_tick_snapshot",
      },
      storage: {
        activeKey: "active/voyantjs/voyant/579/remote-bootstrap.json",
        key: "intent_579.json",
        persisted: true,
      },
      intent: {
        createdAt: "2026-05-12T05:30:00.000Z",
        id: "intent_579",
        lease: {
          acquiredAt: "2026-05-12T05:30:00.000Z",
          expiresAt: "2026-05-12T05:40:00.000Z",
          holder: "supervisor:test",
          ttlSeconds: 600,
        },
        plan: {
          action: "remote-bootstrap",
          command: [
            "pnpm",
            "agent:queue:remote-bootstrap",
            "--",
            "--issue",
            "579",
            "--repo",
            "VoyantJS/Voyant",
            "--yes",
            "--event-log",
            ".agent-runs/supervisor.jsonl",
          ],
          issue: tickSnapshot.recommendations[0]?.issue,
          reason: "remote workspace is ready for repository bootstrap",
          repository: "VoyantJS/Voyant",
          requiresMutation: true,
        },
        source: {
          acceptedAt: "2026-05-12T05:00:00.000Z",
          recommendationCount: 2,
          repository: "voyantjs/voyant",
          type: "latest_tick_snapshot",
        },
        status: "leased",
      },
    })
  })

  it("does not create an intent when no dispatchable plan matches", async () => {
    const app = createApp({
      authTokens: ["secret"],
      createDispatchIntentId: () => "unused",
      dispatchIntentStore: inMemoryDispatchIntentStore(),
      tickSnapshotStore: inMemoryTickSnapshotStore([buildTickSnapshotRecord(tickSnapshot)]),
    })

    const response = await app.request("/api/dispatch-intents/latest", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({
        filters: {
          action: "remote-run-command",
        },
        lease: {
          holder: "supervisor:test",
        },
        repository: "voyantjs/voyant",
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      intent: null,
      reason: "action remote-run-command is not dispatchable",
      source: {
        repository: "voyantjs/voyant",
        type: "latest_tick_snapshot",
      },
    })
  })

  it("rejects an active lease for the same issue and action", async () => {
    const intentStore = inMemoryDispatchIntentStore()
    const app = createApp({
      authTokens: ["secret"],
      createDispatchIntentId: () => "new_intent",
      dispatchIntentStore: intentStore,
      now: () => new Date("2026-05-12T05:30:00.000Z"),
      tickSnapshotStore: inMemoryTickSnapshotStore([buildTickSnapshotRecord(tickSnapshot)]),
    })
    await intentStore.putIntent({
      createdAt: "2026-05-12T05:25:00.000Z",
      id: "active_intent",
      lease: {
        acquiredAt: "2026-05-12T05:25:00.000Z",
        expiresAt: "2026-05-12T05:35:00.000Z",
        holder: "supervisor:existing",
        ttlSeconds: 600,
      },
      plan: {
        action: "remote-bootstrap",
        command: ["pnpm", "agent:queue:remote-bootstrap"],
        issue: tickSnapshot.recommendations[0]!.issue,
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
    })

    const response = await app.request("/api/dispatch-intents/latest", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({
        lease: {
          holder: "supervisor:test",
        },
        repository: "voyantjs/voyant",
      }),
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: "dispatch_intent_already_active",
      intent: {
        id: "active_intent",
      },
    })
  })

  it("allows a new lease when the previous active intent is expired", async () => {
    const intentStore = inMemoryDispatchIntentStore()
    const app = createApp({
      authTokens: ["secret"],
      createDispatchIntentId: () => "replacement_intent",
      dispatchIntentStore: intentStore,
      now: () => new Date("2026-05-12T05:45:01.000Z"),
      tickSnapshotStore: inMemoryTickSnapshotStore([buildTickSnapshotRecord(tickSnapshot)]),
    })
    await intentStore.putIntent({
      createdAt: "2026-05-12T05:25:00.000Z",
      id: "expired_intent",
      lease: {
        acquiredAt: "2026-05-12T05:25:00.000Z",
        expiresAt: "2026-05-12T05:35:00.000Z",
        holder: "supervisor:existing",
        ttlSeconds: 600,
      },
      plan: {
        action: "remote-bootstrap",
        command: ["pnpm", "agent:queue:remote-bootstrap"],
        issue: tickSnapshot.recommendations[0]!.issue,
        reason: "expired lease",
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
    })

    const response = await app.request("/api/dispatch-intents/latest", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({
        lease: {
          holder: "supervisor:test",
        },
        repository: "voyantjs/voyant",
      }),
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      intent: {
        id: "replacement_intent",
        lease: {
          holder: "supervisor:test",
        },
      },
      reason: "leased",
    })
  })

  it("requires storage, a lease holder, and a stored snapshot", async () => {
    const noIntentStore = createApp({
      authTokens: ["secret"],
      tickSnapshotStore: inMemoryTickSnapshotStore([buildTickSnapshotRecord(tickSnapshot)]),
    })
    const noIntentStoreResponse = await noIntentStore.request("/api/dispatch-intents/latest", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({
        lease: {
          holder: "supervisor:test",
        },
        repository: "voyantjs/voyant",
      }),
    })
    expect(noIntentStoreResponse.status).toBe(503)
    await expect(noIntentStoreResponse.json()).resolves.toEqual({
      error: "dispatch_intent_storage_not_configured",
    })

    const app = createApp({
      authTokens: ["secret"],
      dispatchIntentStore: inMemoryDispatchIntentStore(),
      tickSnapshotStore: inMemoryTickSnapshotStore(),
    })
    const invalid = await app.request("/api/dispatch-intents/latest", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({
        repository: "voyantjs/voyant",
      }),
    })
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toMatchObject({
      error: "invalid_latest_dispatch_intent_request",
    })

    const missingSnapshot = await app.request("/api/dispatch-intents/latest", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({
        lease: {
          holder: "supervisor:test",
        },
        repository: "voyantjs/voyant",
      }),
    })
    expect(missingSnapshot.status).toBe(404)
    await expect(missingSnapshot.json()).resolves.toEqual({ error: "tick_snapshot_not_found" })
  })
})

function inMemoryTickSnapshotStore(records: TickSnapshotRecord[] = []): TickSnapshotStore {
  const latest = new Map(
    records.map((record) => [record.snapshot.repository.toLowerCase(), record]),
  )

  return {
    async getLatest(repository) {
      return latest.get(repository.toLowerCase()) ?? null
    },
    async listRecent(repository) {
      const record = latest.get(repository.toLowerCase())
      return record ? [record] : []
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
      const key = activeIntentKey({
        action: record.plan.action,
        issueNumber: record.plan.issue.number,
        repository: record.plan.repository,
      })
      const existing = active.get(key)
      if (existing && isDispatchIntentActive(existing, now)) {
        return { acquired: false, activeIntent: existing }
      }

      active.set(key, record)
      byId.set(record.id, record)
      return {
        acquired: true,
        write: {
          activeKey: key,
          key: `${record.id}.json`,
        },
      }
    },
    async finishIntent({ id, now, request }) {
      const intent = byId.get(id)
      if (!intent) {
        return { finished: false, reason: "not_found" }
      }
      if (intent.status !== "leased") {
        return { finished: false, intent, reason: "intent_not_active" }
      }
      if (intent.lease.holder !== request.holder) {
        return { finished: false, intent, reason: "holder_mismatch" }
      }

      const finishedIntent = finishDispatchIntent({ intent, now, request })
      const activeKey = activeIntentKey({
        action: intent.plan.action,
        issueNumber: intent.plan.issue.number,
        repository: intent.plan.repository,
      })
      byId.set(id, finishedIntent)
      const activeUpdated = active.get(activeKey)?.id === id
      if (activeUpdated) {
        active.set(activeKey, finishedIntent)
      }

      return {
        finished: true,
        intent: finishedIntent,
        write: {
          activeKey,
          activeUpdated,
          key: `${intent.id}.json`,
        },
      }
    },
    async getActive(reference) {
      return active.get(activeIntentKey(reference)) ?? null
    },
    async putIntent(record) {
      byId.set(record.id, record)
      active.set(
        activeIntentKey({
          action: record.plan.action,
          issueNumber: record.plan.issue.number,
          repository: record.plan.repository,
        }),
        record,
      )
      return {
        activeKey: activeIntentKey({
          action: record.plan.action,
          issueNumber: record.plan.issue.number,
          repository: record.plan.repository,
        }),
        key: `${record.id}.json`,
      }
    },
  }
}

function activeIntentKey({
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
