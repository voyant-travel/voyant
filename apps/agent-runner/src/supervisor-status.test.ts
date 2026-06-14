import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import type { SupervisorTickRecord, SupervisorTickStore } from "./supervisor-tick-store.js"

describe("agent runner supervisor status", () => {
  it("combines capabilities with latest and recent supervisor ticks", async () => {
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
      supervisorTickStore: inMemorySupervisorTickStore(),
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

    const response = await app.request("/api/supervisor/status?repository=voyant-travel%2Fvoyant", {
      headers: {
        authorization: "Bearer token",
      },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      capabilities: {
        execution: {
          enabled: true,
          mode: "lease-only",
        },
        supervisorTicks: {
          history: true,
          persistence: "latest",
        },
      },
      repository: "voyant-travel/voyant",
      service: "agent-runner",
      supervisorTicks: {
        latest: {
          recordedAt: "2026-05-12T12:00:00.000Z",
          result: {
            reason: "dry_run",
          },
        },
        recent: [
          {
            recordedAt: "2026-05-12T12:00:00.000Z",
            result: {
              reason: "dry_run",
            },
          },
        ],
        storage: {
          configured: true,
          persistence: "latest",
        },
      },
    })
  })

  it("reports supervisor status without tick storage", async () => {
    const app = createApp({
      authTokens: ["token"],
      config: {
        controlPlaneConfigured: false,
        enabled: false,
        repository: "voyant-travel/voyant",
      },
    })

    const response = await app.request("/api/supervisor/status", {
      headers: {
        authorization: "Bearer token",
      },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      capabilities: {
        execution: {
          enabled: false,
          mode: "disabled",
        },
        supervisorTicks: {
          history: false,
          persistence: "none",
        },
      },
      repository: "voyant-travel/voyant",
      service: "agent-runner",
      supervisorTicks: {
        latest: null,
        recent: [],
        storage: {
          configured: false,
          persistence: "none",
        },
      },
    })
  })
})

function inMemorySupervisorTickStore(): SupervisorTickStore {
  const latest = new Map<string, SupervisorTickRecord>()
  const recent: SupervisorTickRecord[] = []

  return {
    async getLatest(repository) {
      return latest.get(repository.toLowerCase()) ?? null
    },
    async listRecent(repository) {
      return recent.filter((record) => record.repository.toLowerCase() === repository.toLowerCase())
    },
    async putLatest(record) {
      latest.set(record.repository.toLowerCase(), record)
      recent.unshift(record)
      return { key: `latest/${record.repository.toLowerCase()}.json` }
    },
  }
}
