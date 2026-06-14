import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import type {
  SupervisorLeaseRecord,
  SupervisorTickRecord,
  SupervisorTickStore,
} from "./supervisor-tick-store.js"

describe("agent runner supervisor lease budget", () => {
  it("refuses real leases when a configured daily budget has no storage", async () => {
    const calls: string[] = []
    const app = createApp({
      authTokens: ["token"],
      config: {
        controlPlaneConfigured: true,
        controlPlaneToken: "control-token",
        controlPlaneUrl: "https://control.example.com/",
        enabled: true,
        holder: "runner:cloudflare",
        maxDailyLeases: 3,
        repository: "voyant-travel/voyant",
      },
      fetchImpl: async (url) => {
        calls.push(String(url))
        return new Response(JSON.stringify({ reason: "leased" }), { status: 201 })
      },
      now: () => new Date("2026-05-12T12:00:00.000Z"),
    })

    const response = await app.request("/api/supervisor/ticks", {
      body: JSON.stringify({ action: "sync-pr", dryRun: false }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      result: {
        budget: {
          blocked: true,
          maxDailyLeases: 3,
          reason: "lease budget requires supervisor lease history storage",
          remainingLeases: 0,
        },
        leased: false,
        reason: "lease_budget_exhausted",
      },
      storage: {
        persisted: false,
        reason: "supervisor_tick_storage_not_configured",
      },
    })
    expect(calls).toEqual([])
  })

  it("counts recent successful leases before leasing from the control plane", async () => {
    const calls: string[] = []
    const app = createApp({
      authTokens: ["token"],
      config: {
        controlPlaneConfigured: true,
        controlPlaneToken: "control-token",
        controlPlaneUrl: "https://control.example.com/",
        enabled: true,
        holder: "runner:cloudflare",
        maxDailyLeases: 1,
        repository: "voyant-travel/voyant",
      },
      fetchImpl: async (url) => {
        calls.push(String(url))
        return new Response(JSON.stringify({ reason: "leased" }), { status: 201 })
      },
      now: () => new Date("2026-05-12T12:00:00.000Z"),
      supervisorTickStore: inMemorySupervisorTickStore({
        leases: [
          {
            id: "lease_1",
            leasedAt: "2026-05-12T11:30:00.000Z",
            repository: "voyant-travel/voyant",
            result: {
              leased: true,
              reason: "leased",
            },
          },
        ],
        ticks: Array.from({ length: 50 }, (_, index) => ({
          recordedAt: `2026-05-12T11:${String(index).padStart(2, "0")}:00.000Z`,
          repository: "voyant-travel/voyant",
          result: {
            leased: false,
            reason: "lease_budget_exhausted",
          },
        })),
      }),
    })

    const response = await app.request("/api/supervisor/ticks", {
      body: JSON.stringify({ action: "sync-pr", dryRun: false }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      result: {
        budget: {
          blocked: true,
          maxDailyLeases: 1,
          reason: "daily lease budget exhausted",
          remainingLeases: 0,
          usedLeases: 1,
        },
        leased: false,
        reason: "lease_budget_exhausted",
      },
      storage: {
        persisted: true,
      },
    })
    expect(calls).toEqual([])
  })

  it("records successful leases in lease-specific history", async () => {
    const store = inMemorySupervisorTickStore()
    const app = createApp({
      authTokens: ["token"],
      config: {
        controlPlaneConfigured: true,
        controlPlaneToken: "control-token",
        controlPlaneUrl: "https://control.example.com/",
        enabled: true,
        holder: "runner:cloudflare",
        maxDailyLeases: 2,
        repository: "voyant-travel/voyant",
      },
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            intent: {
              id: "intent_579",
              plan: {
                action: "sync-pr",
              },
              status: "leased",
            },
            reason: "leased",
          }),
          { status: 201 },
        ),
      now: () => new Date("2026-05-12T12:00:00.000Z"),
      supervisorTickStore: store,
    })

    const response = await app.request("/api/supervisor/ticks", {
      body: JSON.stringify({ action: "sync-pr", dryRun: false }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      result: {
        budget: {
          blocked: false,
          maxDailyLeases: 2,
          remainingLeases: 1,
          usedLeases: 1,
        },
        leased: true,
        reason: "leased",
      },
    })
    await expect(
      store.listLeases?.("voyant-travel/voyant", { since: "2026-05-11T12:00:00.000Z" }),
    ).resolves.toMatchObject([
      {
        leasedAt: "2026-05-12T12:00:00.000Z",
        repository: "voyant-travel/voyant",
      },
    ])
  })
})

function inMemorySupervisorTickStore({
  leases = [],
  ticks = [],
}: {
  leases?: SupervisorLeaseRecord[]
  ticks?: SupervisorTickRecord[]
} = {}): SupervisorTickStore {
  const latest = new Map<string, SupervisorTickRecord>()
  const recent: SupervisorTickRecord[] = [...ticks]
  const leaseHistory: SupervisorLeaseRecord[] = [...leases]
  for (const record of ticks) {
    latest.set(record.repository.toLowerCase(), record)
  }

  return {
    async getLatest(repository) {
      return latest.get(repository.toLowerCase()) ?? null
    },
    async listRecent(repository) {
      return recent.filter((record) => record.repository.toLowerCase() === repository.toLowerCase())
    },
    async listLeases(repository, options = {}) {
      return leaseHistory
        .filter(
          (record) =>
            record.repository.toLowerCase() === repository.toLowerCase() &&
            (!options.since || record.leasedAt >= options.since),
        )
        .slice(0, options.limit)
    },
    async putLease(record) {
      leaseHistory.unshift(record)
      return { key: `leases/${record.repository.toLowerCase()}/${record.id}.json` }
    },
    async putLatest(record) {
      latest.set(record.repository.toLowerCase(), record)
      recent.unshift(record)
      return { key: `latest/${record.repository.toLowerCase()}.json` }
    },
  }
}
