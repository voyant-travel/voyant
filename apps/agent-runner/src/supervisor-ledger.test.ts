import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import { createInMemoryAgentRunnerLedgerStore } from "./run-ledger-store.js"
import type { SupervisorTickStore } from "./supervisor-tick-store.js"

describe("agent runner supervisor ledger", () => {
  it("reports run-ledger capabilities and status", async () => {
    const runLedgerStore = createInMemoryAgentRunnerLedgerStore()
    await runLedgerStore.recordSupervisorLease({
      leasedAt: "2026-05-12T12:00:00.000Z",
      repository: "voyantjs/voyant",
      result: leasedResult(),
      supervisorLeaseId: "lease_1",
    })
    const app = createApp({
      authTokens: ["token"],
      config: {
        controlPlaneConfigured: true,
        enabled: true,
        repository: "voyantjs/voyant",
      },
      coordinatorConfigured: true,
      runLedgerStore,
    })

    const capabilities = await app.request("/api/capabilities", {
      headers: {
        authorization: "Bearer token",
      },
    })
    expect(capabilities.status).toBe(200)
    await expect(capabilities.json()).resolves.toMatchObject({
      coordinator: {
        configured: true,
        mode: "durable-object",
      },
      runLedger: {
        configured: true,
        persistence: "d1",
      },
    })

    const status = await app.request("/api/supervisor/status?limit=1", {
      headers: {
        authorization: "Bearer token",
      },
    })
    expect(status.status).toBe(200)
    await expect(status.json()).resolves.toMatchObject({
      runLedger: {
        recentLeases: [
          {
            id: "lease_1",
            status: "leased",
          },
        ],
        recentRuns: [
          {
            id: "intent_579",
            status: "leased",
          },
        ],
        status: {
          recentLeaseCount: 1,
          recentRunCount: 1,
        },
        storage: {
          configured: true,
          persistence: "d1",
        },
      },
    })
  })

  it("records leased supervisor ticks into the run ledger", async () => {
    const runLedgerStore = createInMemoryAgentRunnerLedgerStore()
    const app = createApp({
      authTokens: ["token"],
      config: {
        controlPlaneConfigured: true,
        controlPlaneToken: "control-token",
        controlPlaneUrl: "https://control.example.com",
        enabled: true,
        holder: "runner:cloudflare",
        repository: "voyantjs/voyant",
      },
      fetchImpl: async () => new Response(JSON.stringify(leasedResult()), { status: 201 }),
      now: () => new Date("2026-05-12T12:00:00.000Z"),
      runLedgerStore,
      supervisorTickStore: inMemorySupervisorTickStore(),
    })

    const response = await app.request("/api/supervisor/ticks", {
      body: JSON.stringify({ dryRun: false }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      storage: {
        runLedger: {
          persisted: true,
        },
      },
    })
    await expect(runLedgerStore.listRecentLeases("voyantjs/voyant")).resolves.toHaveLength(1)
    await expect(runLedgerStore.listRecentRuns("voyantjs/voyant")).resolves.toMatchObject([
      {
        id: "intent_579",
        status: "leased",
      },
    ])
  })

  it("requires a configured run ledger before serving ledger endpoints", async () => {
    const app = createApp({ authTokens: ["token"] })
    const response = await app.request("/api/ledger/status?repository=voyantjs%2Fvoyant", {
      headers: {
        authorization: "Bearer token",
      },
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: "run_ledger_not_configured" })
  })
})

function leasedResult() {
  return {
    intent: {
      id: "intent_579",
      lease: {
        expiresAt: "2026-05-12T12:15:00.000Z",
        holder: "runner:cloudflare",
      },
      plan: {
        action: "sync-pr",
        issue: {
          number: 579,
        },
      },
      status: "leased",
    },
    leased: true,
    reason: "leased",
  }
}

function inMemorySupervisorTickStore(): SupervisorTickStore {
  return {
    async getLatest() {
      return null
    },
    async listLeases() {
      return []
    },
    async listRecent() {
      return []
    },
    async putLease() {
      return { key: "lease.json" }
    },
    async putLatest() {
      return { key: "latest.json" }
    },
  }
}
