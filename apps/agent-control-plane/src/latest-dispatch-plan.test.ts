import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import { buildTickSnapshotRecord, type TickSnapshotRecord } from "./control-plane.js"
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

describe("latest dispatch planning", () => {
  it("plans dispatch from the latest stored tick snapshot", async () => {
    const app = createApp({
      authTokens: ["secret"],
      tickSnapshotStore: inMemoryTickSnapshotStore([
        buildTickSnapshotRecord(tickSnapshot, {
          acceptedAt: "2026-05-12T05:00:00.000Z",
        }),
      ]),
    })

    const response = await app.request("/api/dispatch-plans/latest", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({
        filters: {
          action: "remote-bootstrap",
          issueNumber: 579,
        },
        options: {
          eventLog: ".agent-runs/supervisor.jsonl",
        },
        repository: "VoyantJS/Voyant",
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      reason: "matched",
      source: {
        acceptedAt: "2026-05-12T05:00:00.000Z",
        recommendationCount: 2,
        repository: "voyantjs/voyant",
        type: "latest_tick_snapshot",
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
    })
  })

  it("requires explicit implementation commands for stored implementation recommendations", async () => {
    const app = createApp({
      authTokens: ["secret"],
      tickSnapshotStore: inMemoryTickSnapshotStore([buildTickSnapshotRecord(tickSnapshot)]),
    })

    const response = await app.request("/api/dispatch-plans/latest", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({
        filters: {
          action: "remote-run-command",
        },
        repository: "voyantjs/voyant",
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      reason: "remote-run-command requires remote implementation command",
      plan: null,
      source: {
        repository: "voyantjs/voyant",
        type: "latest_tick_snapshot",
      },
    })

    const concrete = await app.request("/api/dispatch-plans/latest", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({
        filters: {
          action: "remote-run-command",
        },
        options: {
          remoteImplementationCommand: "agent-exec remote smoke",
        },
        repository: "voyantjs/voyant",
      }),
    })

    expect(concrete.status).toBe(200)
    await expect(concrete.json()).resolves.toMatchObject({
      reason: "matched",
      plan: {
        action: "remote-run-command",
        command: [
          "pnpm",
          "agent:queue:remote-run-command",
          "--",
          "--issue",
          "580",
          "--repo",
          "voyantjs/voyant",
          "--command",
          "agent-exec remote smoke",
          "--yes",
        ],
      },
    })
  })

  it("requires storage, a repository, and a stored snapshot", async () => {
    const noStore = createApp({ authTokens: ["secret"] })
    const noStoreResponse = await noStore.request("/api/dispatch-plans/latest", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({ repository: "voyantjs/voyant" }),
    })
    expect(noStoreResponse.status).toBe(503)
    await expect(noStoreResponse.json()).resolves.toEqual({
      error: "tick_snapshot_storage_not_configured",
    })

    const app = createApp({
      authTokens: ["secret"],
      tickSnapshotStore: inMemoryTickSnapshotStore(),
    })
    const invalid = await app.request("/api/dispatch-plans/latest", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toMatchObject({
      error: "invalid_latest_dispatch_plan_request",
    })

    const missingSnapshot = await app.request("/api/dispatch-plans/latest", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({ repository: "voyantjs/voyant" }),
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
