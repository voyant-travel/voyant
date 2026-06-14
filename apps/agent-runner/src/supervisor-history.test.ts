import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import type {
  SupervisorLeaseRecord,
  SupervisorTickRecord,
  SupervisorTickStore,
} from "./supervisor-tick-store.js"

type InMemorySupervisorTickStore = SupervisorTickStore & {
  lastLeaseListOptions?: { limit?: number; since?: string }
}

describe("agent runner supervisor history", () => {
  it("reads persisted supervisor tick and lease history", async () => {
    const supervisorTickStore = inMemorySupervisorTickStore()
    const app = createApp({
      authTokens: ["token"],
      config: {
        controlPlaneConfigured: true,
        controlPlaneUrl: "https://control.example.com",
        enabled: true,
        holder: "runner:cloudflare",
        repository: "voyant-travel/voyant",
      },
      now: () => new Date("2026-05-12T12:00:00.000Z"),
      supervisorTickStore,
    })

    const tick = await app.request("/api/supervisor/ticks", {
      body: JSON.stringify({ dryRun: true }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })
    expect(tick.status).toBe(200)

    const latest = await app.request(
      "/api/supervisor/ticks/latest?repository=voyant-travel%2Fvoyant",
      {
        headers: {
          authorization: "Bearer token",
        },
      },
    )

    expect(latest.status).toBe(200)
    await expect(latest.json()).resolves.toMatchObject({
      recordedAt: "2026-05-12T12:00:00.000Z",
      repository: "voyant-travel/voyant",
      result: {
        leased: false,
        reason: "dry_run",
      },
    })

    const recent = await app.request(
      "/api/supervisor/ticks/recent?repository=voyant-travel%2Fvoyant&limit=5",
      {
        headers: {
          authorization: "Bearer token",
        },
      },
    )

    expect(recent.status).toBe(200)
    await expect(recent.json()).resolves.toMatchObject({
      records: [
        {
          recordedAt: "2026-05-12T12:00:00.000Z",
          repository: "voyant-travel/voyant",
          result: {
            leased: false,
            reason: "dry_run",
          },
        },
      ],
      repository: "voyant-travel/voyant",
    })

    const leases = await app.request(
      "/api/supervisor/leases/recent?repository=voyant-travel%2Fvoyant&limit=5",
      {
        headers: {
          authorization: "Bearer token",
        },
      },
    )

    expect(leases.status).toBe(200)
    await expect(leases.json()).resolves.toMatchObject({
      records: [],
      repository: "voyant-travel/voyant",
    })

    const defaultLimited = await app.request(
      "/api/supervisor/leases/recent?repository=voyant-travel%2Fvoyant",
      {
        headers: {
          authorization: "Bearer token",
        },
      },
    )

    expect(defaultLimited.status).toBe(200)
    expect(supervisorTickStore.lastLeaseListOptions).toEqual({ limit: 20, since: undefined })
  })

  it("includes recent lease-budget history in supervisor status", async () => {
    const supervisorTickStore = inMemorySupervisorTickStore()
    await supervisorTickStore.putLease?.(leaseRecord())
    const app = createApp({
      authTokens: ["token"],
      config: {
        controlPlaneConfigured: true,
        enabled: true,
        repository: "voyant-travel/voyant",
      },
      supervisorTickStore,
    })

    const response = await app.request(
      "/api/supervisor/status?repository=voyant-travel%2Fvoyant&limit=2",
      {
        headers: {
          authorization: "Bearer token",
        },
      },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      capabilities: {
        supervisorTicks: {
          leaseBudgetHistory: true,
        },
      },
      supervisorLeases: {
        recent: [leaseRecord()],
        storage: {
          configured: true,
          persistence: "history",
        },
      },
    })
  })

  it("requires storage and repository before reading persisted supervisor history", async () => {
    const noStore = createApp({ authTokens: ["token"] })
    const noStoreResponse = await noStore.request(
      "/api/supervisor/ticks/latest?repository=voyant-travel%2Fvoyant",
      {
        headers: {
          authorization: "Bearer token",
        },
      },
    )
    expect(noStoreResponse.status).toBe(503)
    await expect(noStoreResponse.json()).resolves.toEqual({
      error: "supervisor_tick_storage_not_configured",
    })

    const noLeaseStoreResponse = await noStore.request(
      "/api/supervisor/leases/recent?repository=voyant-travel%2Fvoyant",
      {
        headers: {
          authorization: "Bearer token",
        },
      },
    )
    expect(noLeaseStoreResponse.status).toBe(503)
    await expect(noLeaseStoreResponse.json()).resolves.toEqual({
      error: "supervisor_lease_storage_not_configured",
    })

    const app = createApp({
      authTokens: ["token"],
      supervisorTickStore: inMemorySupervisorTickStore(),
    })
    const missingRepository = await app.request("/api/supervisor/ticks/latest", {
      headers: {
        authorization: "Bearer token",
      },
    })
    expect(missingRepository.status).toBe(400)
    await expect(missingRepository.json()).resolves.toEqual({ error: "missing_repository" })

    const missingRecentRepository = await app.request("/api/supervisor/ticks/recent", {
      headers: {
        authorization: "Bearer token",
      },
    })
    expect(missingRecentRepository.status).toBe(400)
    await expect(missingRecentRepository.json()).resolves.toEqual({ error: "missing_repository" })

    const missingLeaseRepository = await app.request("/api/supervisor/leases/recent", {
      headers: {
        authorization: "Bearer token",
      },
    })
    expect(missingLeaseRepository.status).toBe(400)
    await expect(missingLeaseRepository.json()).resolves.toEqual({ error: "missing_repository" })

    const invalidSince = await app.request(
      "/api/supervisor/leases/recent?repository=voyant-travel%2Fvoyant&since=not-a-date",
      {
        headers: {
          authorization: "Bearer token",
        },
      },
    )
    expect(invalidSince.status).toBe(400)
    await expect(invalidSince.json()).resolves.toEqual({ error: "invalid_since" })

    const missingTick = await app.request(
      "/api/supervisor/ticks/latest?repository=voyant-travel%2Fvoyant",
      {
        headers: {
          authorization: "Bearer token",
        },
      },
    )
    expect(missingTick.status).toBe(404)
    await expect(missingTick.json()).resolves.toEqual({ error: "supervisor_tick_not_found" })
  })
})

function inMemorySupervisorTickStore(
  records: SupervisorTickRecord[] = [],
): InMemorySupervisorTickStore {
  const latest = new Map<string, SupervisorTickRecord>()
  const leases: SupervisorLeaseRecord[] = []
  const recent: SupervisorTickRecord[] = [...records]
  for (const record of records) {
    latest.set(record.repository.toLowerCase(), record)
  }

  const store: InMemorySupervisorTickStore = {
    lastLeaseListOptions: undefined as { limit?: number; since?: string } | undefined,
    async getLatest(repository) {
      return latest.get(repository.toLowerCase()) ?? null
    },
    async listRecent(repository) {
      return recent.filter((record) => record.repository.toLowerCase() === repository.toLowerCase())
    },
    async listLeases(repository, options = {}) {
      this.lastLeaseListOptions = options
      return leases
        .filter((record) => record.repository.toLowerCase() === repository.toLowerCase())
        .filter((record) => !options.since || record.leasedAt >= options.since)
        .slice(0, options.limit)
    },
    async putLease(record) {
      leases.unshift(record)
      return { key: `leases/${record.repository.toLowerCase()}/${record.id}.json` }
    },
    async putLatest(record) {
      latest.set(record.repository.toLowerCase(), record)
      recent.unshift(record)
      return { key: `latest/${record.repository.toLowerCase()}.json` }
    },
  }
  return store
}

function leaseRecord(): SupervisorLeaseRecord {
  return {
    id: "lease_579",
    leasedAt: "2026-05-12T12:00:00.000Z",
    repository: "voyant-travel/voyant",
    result: {
      intent: {
        id: "intent_579",
      },
      leased: true,
      reason: "leased",
    },
  }
}
