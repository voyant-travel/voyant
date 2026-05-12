import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import { buildTickSnapshotRecord, type TickSnapshotRecord } from "./control-plane.js"
import {
  createR2TickSnapshotStore,
  type TickSnapshotBucket,
  type TickSnapshotStore,
} from "./tick-snapshot-store.js"

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
      command: "pnpm agent:queue:remote-bootstrap -- --issue 579 --repo voyantjs/voyant --yes",
      issue: {
        number: 579,
        title: "Test agent project intake workflow",
        url: "https://github.com/voyantjs/voyant/issues/579",
        repository: "voyantjs/voyant",
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
        dispatchableRecommendationCount: 1,
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
        key: "latest/voyantjs/voyant.json",
        persisted: true,
      },
    })

    const latest = await app.request("/api/tick-snapshots/latest?repository=voyantjs%2Fvoyant", {
      headers: { authorization: "Bearer secret" },
    })
    expect(latest.status).toBe(200)
    await expect(latest.json()).resolves.toMatchObject({
      snapshot: {
        repository: "voyantjs/voyant",
      },
      summary: {
        dispatchableRecommendationCount: 1,
        recommendationCount: 2,
      },
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

  it("requires repository and configured storage for latest tick snapshots", async () => {
    const noStore = createApp({ authTokens: ["secret"] })
    const noStoreResponse = await noStore.request(
      "/api/tick-snapshots/latest?repository=voyantjs%2Fvoyant",
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

    const missingSnapshot = await app.request(
      "/api/tick-snapshots/latest?repository=voyantjs%2Fvoyant",
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

    await expect(store.putLatest(record)).resolves.toEqual({
      key: "supervisor/tick-snapshots/latest/voyantjs%2Fvoyant.json",
    })
    await expect(store.getLatest("VoyantJS/Voyant")).resolves.toEqual(record)
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

    await expect(store.putLatest(buildTickSnapshotRecord(tickSnapshot))).resolves.toEqual({
      key: "tick-snapshots/latest/voyantjs%2Fvoyant.json",
    })
  })
})

function inMemoryTickSnapshotStore(): TickSnapshotStore {
  const latest = new Map<string, TickSnapshotRecord>()

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
