import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import { buildTickSnapshotRecord, type TickSnapshotRecord } from "./control-plane.js"
import { createR2DispatchIntentStore, type DispatchIntentBucket } from "./dispatch-intent-store.js"
import {
  createR2TickSnapshotStore,
  type TickSnapshotBucket,
  type TickSnapshotStore,
} from "./tick-snapshot-store.js"

const tickSnapshot = {
  project: {
    owner: "voyant-travel",
    number: 1,
    title: "Voyant Engineering",
    url: "https://github.com/orgs/voyant-travel/projects/1",
  },
  repository: "voyant-travel/voyant",
  maxAgeDays: 1,
  eventLog: {
    path: "/repo/.agent-runs/events.jsonl",
    recentEvents: [
      {
        timestamp: "2026-05-12T05:00:00.000Z",
        type: "dispatch.completed",
        issue: { number: 579 },
      },
    ],
  },
  recommendations: [
    {
      action: "remote-bootstrap",
      command: "pnpm agent:queue:remote-bootstrap -- --issue 579 --repo voyant-travel/voyant --yes",
      issue: {
        number: 579,
        title: "Test agent project intake workflow",
        url: "https://github.com/voyant-travel/voyant/issues/579",
        repository: "voyant-travel/voyant",
        agentBrief: "Acceptance criteria and verification lane.",
        hasAgentBrief: true,
        labels: ["agent:ready", "ui"],
        state: "OPEN",
      },
      priority: 20,
      reason: "remote workspace is ready for repository bootstrap",
      state: "Ready",
    },
    {
      action: "remote-run-command",
      command:
        'pnpm agent:queue:remote-run-command -- --issue 580 --repo voyant-travel/voyant --command "<implementation-command>" --yes',
      issue: {
        number: 580,
        title: "Run implementation",
        url: "https://github.com/voyant-travel/voyant/issues/580",
        repository: "voyant-travel/voyant",
      },
      priority: 30,
      reason: "implementation execution remains explicit",
      state: "Planning",
    },
  ],
}

describe("tick snapshot storage", () => {
  it("builds durable tick snapshot records", () => {
    expect(
      buildTickSnapshotRecord(tickSnapshot, {
        acceptedAt: "2026-05-12T05:00:00.000Z",
      }),
    ).toMatchObject({
      acceptedAt: "2026-05-12T05:00:00.000Z",
      snapshot: tickSnapshot,
      summary: {
        dispatchableRecommendationCount: 2,
        firstDispatchableAction: "remote-bootstrap",
        firstDispatchableIssueNumber: 579,
        recentEventCount: 1,
        recommendationCount: 2,
      },
    })
  })

  it("persists and reads latest tick snapshots when storage is configured", async () => {
    const store = inMemoryTickSnapshotStore()
    const app = createApp({ authTokens: ["secret"], tickSnapshotStore: store })
    const response = await app.request("/api/tick-snapshots", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify(tickSnapshot),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      accepted: true,
      storage: {
        key: "latest/voyant-travel/voyant.json",
        persisted: true,
      },
    })

    const latest = await app.request(
      "/api/tick-snapshots/latest?repository=voyant-travel%2Fvoyant",
      {
        headers: { authorization: "Bearer secret" },
      },
    )
    expect(latest.status).toBe(200)
    await expect(latest.json()).resolves.toMatchObject({
      snapshot: {
        repository: "voyant-travel/voyant",
      },
      summary: {
        dispatchableRecommendationCount: 2,
        recommendationCount: 2,
      },
    })

    const recent = await app.request(
      "/api/tick-snapshots/recent?repository=voyant-travel%2Fvoyant&limit=10",
      {
        headers: { authorization: "Bearer secret" },
      },
    )
    expect(recent.status).toBe(200)
    await expect(recent.json()).resolves.toMatchObject({
      records: [
        {
          snapshot: {
            repository: "voyant-travel/voyant",
          },
          summary: {
            dispatchableRecommendationCount: 2,
            recommendationCount: 2,
          },
        },
      ],
      repository: "voyant-travel/voyant",
    })

    const capabilities = await app.request("/api/capabilities", {
      headers: { authorization: "Bearer secret" },
    })
    await expect(capabilities.json()).resolves.toMatchObject({
      snapshotContracts: {
        tick: {
          persistence: "latest",
        },
      },
    })
  })

  it("requires repository and configured storage for persisted tick snapshots", async () => {
    const noStore = createApp({ authTokens: ["secret"] })
    const noStoreResponse = await noStore.request(
      "/api/tick-snapshots/latest?repository=voyant-travel%2Fvoyant",
      {
        headers: { authorization: "Bearer secret" },
      },
    )
    expect(noStoreResponse.status).toBe(503)
    await expect(noStoreResponse.json()).resolves.toEqual({
      error: "tick_snapshot_storage_not_configured",
    })

    const app = createApp({
      authTokens: ["secret"],
      tickSnapshotStore: inMemoryTickSnapshotStore(),
    })
    const missingRepository = await app.request("/api/tick-snapshots/latest", {
      headers: { authorization: "Bearer secret" },
    })
    expect(missingRepository.status).toBe(400)
    await expect(missingRepository.json()).resolves.toEqual({ error: "missing_repository" })

    const missingRecentRepository = await app.request("/api/tick-snapshots/recent", {
      headers: { authorization: "Bearer secret" },
    })
    expect(missingRecentRepository.status).toBe(400)
    await expect(missingRecentRepository.json()).resolves.toEqual({ error: "missing_repository" })

    const missingSnapshot = await app.request(
      "/api/tick-snapshots/latest?repository=voyant-travel%2Fvoyant",
      {
        headers: { authorization: "Bearer secret" },
      },
    )
    expect(missingSnapshot.status).toBe(404)
    await expect(missingSnapshot.json()).resolves.toEqual({ error: "tick_snapshot_not_found" })
  })

  it("stores latest tick snapshots in R2-compatible object storage", async () => {
    const objects = new Map<string, string>()
    const store = createR2TickSnapshotStore({
      bucket: {
        async get(key: string) {
          const text = objects.get(key)
          return text
            ? ({
                text: async () => text,
              } as R2ObjectBody)
            : null
        },
        async list({ prefix }: { prefix?: string } = {}) {
          return {
            objects: Array.from(objects.keys())
              .filter((key) => !prefix || key.startsWith(prefix))
              .sort()
              .map((key) => ({ key })),
          }
        },
        async put(key: string, value: string) {
          objects.set(key, String(value))
          return null
        },
      } satisfies TickSnapshotBucket,
      keyPrefix: "/supervisor/",
    })

    const record = buildTickSnapshotRecord(tickSnapshot, {
      acceptedAt: "2026-05-12T05:00:00.000Z",
    })

    await expect(store.putLatest(record)).resolves.toMatchObject({
      historyKey:
        "supervisor/tick-snapshots/history/voyant-travel%2Fvoyant/9005420692740991-2026-05-12T05%3A00%3A00.000Z.json",
      key: "supervisor/tick-snapshots/latest/voyant-travel%2Fvoyant.json",
    })
    await expect(store.getLatest("Voyant-Travel/Voyant")).resolves.toEqual(record)
    await expect(store.listRecent("Voyant-Travel/Voyant")).resolves.toEqual([record])
  })

  it("stores snapshots without a leading slash when the key prefix is empty", async () => {
    const objects = new Map<string, string>()
    const store = createR2TickSnapshotStore({
      bucket: {
        async get(_key: string) {
          return null
        },
        async put(key: string, value: string) {
          objects.set(key, String(value))
          return null
        },
      } satisfies TickSnapshotBucket,
      keyPrefix: "",
    })

    await expect(store.putLatest(buildTickSnapshotRecord(tickSnapshot))).resolves.toMatchObject({
      key: "tick-snapshots/latest/voyant-travel%2Fvoyant.json",
    })
  })

  it("stores active dispatch intents in R2-compatible object storage", async () => {
    const objects = new Map<string, { etag: string; value: string }>()
    const store = createR2DispatchIntentStore({
      bucket: {
        async get(key: string) {
          const object = objects.get(key)
          return object
            ? ({
                etag: object.etag,
                text: async () => object.value,
              } satisfies Awaited<ReturnType<DispatchIntentBucket["get"]>>)
            : null
        },
        async put(key: string, value: string, options) {
          const object = objects.get(key)
          if (options?.onlyIf?.etagDoesNotMatch === "*" && object) {
            return null
          }
          if (options?.onlyIf?.etagMatches && object?.etag !== options.onlyIf.etagMatches) {
            return null
          }

          objects.set(key, { etag: `${key}:${String(value).length}`, value: String(value) })
          return {}
        },
      } satisfies DispatchIntentBucket,
      keyPrefix: "/supervisor/",
    })
    const intent = {
      createdAt: "2026-05-12T05:30:00.000Z",
      id: "intent_579",
      lease: {
        acquiredAt: "2026-05-12T05:30:00.000Z",
        expiresAt: "2026-05-12T05:45:00.000Z",
        holder: "supervisor:test",
        ttlSeconds: 900,
      },
      plan: {
        action: "remote-bootstrap" as const,
        command: ["pnpm", "agent:queue:remote-bootstrap"],
        issue: tickSnapshot.recommendations[0]!.issue,
        reason: "remote workspace is ready for repository bootstrap",
        repository: "voyant-travel/voyant",
        requiresMutation: true as const,
      },
      source: {
        acceptedAt: "2026-05-12T05:00:00.000Z",
        recommendationCount: 2,
        repository: "voyant-travel/voyant",
        type: "latest_tick_snapshot" as const,
      },
      status: "leased" as const,
    }

    await expect(store.putIntent(intent)).resolves.toEqual({
      activeKey:
        "supervisor/dispatch-intents/active/voyant-travel%2Fvoyant/579/remote-bootstrap.json",
      key: "supervisor/dispatch-intents/by-id/intent_579.json",
    })
    await expect(
      store.getActive({
        action: "remote-bootstrap",
        issueNumber: 579,
        repository: "Voyant-Travel/Voyant",
      }),
    ).resolves.toEqual(intent)

    await expect(
      store.acquireIntent(
        {
          ...intent,
          id: "intent_580",
          lease: {
            ...intent.lease,
            expiresAt: "2026-05-12T05:50:00.000Z",
          },
        },
        { now: new Date("2026-05-12T05:40:00.000Z") },
      ),
    ).resolves.toMatchObject({
      acquired: false,
      activeIntent: {
        id: "intent_579",
      },
    })

    await expect(
      store.finishIntent({
        id: "intent_579",
        now: new Date("2026-05-12T05:41:00.000Z"),
        request: {
          holder: "supervisor:test",
          reason: "command completed",
          status: "completed",
        },
      }),
    ).resolves.toMatchObject({
      finished: true,
      intent: {
        id: "intent_579",
        resolution: {
          finishedAt: "2026-05-12T05:41:00.000Z",
          holder: "supervisor:test",
          reason: "command completed",
        },
        status: "completed",
      },
      write: {
        activeUpdated: true,
      },
    })

    await expect(
      store.acquireIntent(
        {
          ...intent,
          id: "intent_580",
          lease: {
            ...intent.lease,
            holder: "supervisor:next",
          },
        },
        { now: new Date("2026-05-12T05:42:00.000Z") },
      ),
    ).resolves.toMatchObject({
      acquired: true,
      write: {
        activeKey:
          "supervisor/dispatch-intents/active/voyant-travel%2Fvoyant/579/remote-bootstrap.json",
        key: "supervisor/dispatch-intents/by-id/intent_580.json",
      },
    })
  })
})

function inMemoryTickSnapshotStore(): TickSnapshotStore {
  const latest = new Map<string, TickSnapshotRecord>()
  const recent: TickSnapshotRecord[] = []

  return {
    async getLatest(repository) {
      return latest.get(repository.toLowerCase()) ?? null
    },
    async listRecent(repository) {
      return recent.filter(
        (record) => record.snapshot.repository.toLowerCase() === repository.toLowerCase(),
      )
    },
    async putLatest(record) {
      latest.set(record.snapshot.repository.toLowerCase(), record)
      recent.unshift(record)
      return { key: `latest/${record.snapshot.repository.toLowerCase()}.json` }
    },
  }
}
