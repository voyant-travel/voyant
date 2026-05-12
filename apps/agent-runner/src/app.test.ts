import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import {
  createR2SupervisorTickStore,
  type SupervisorTickBucket,
  type SupervisorTickRecord,
  type SupervisorTickStore,
} from "./supervisor-tick-store.js"

describe("agent runner app", () => {
  it("serves public health without runner auth", async () => {
    const response = await createApp().request("/health")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, service: "agent-runner" })
  })

  it("requires auth before returning runner capabilities", async () => {
    const response = await createApp().request("/api/capabilities")

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: "runner_auth_not_configured" })
  })

  it("reports disabled execution until the runner is explicitly enabled", async () => {
    const response = await createApp({ authTokens: ["token"] }).request("/api/capabilities", {
      headers: {
        authorization: "Bearer token",
      },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      execution: {
        enabled: false,
        mode: "disabled",
      },
      service: "agent-runner",
    })
  })

  it("plans supervisor ticks without mutating work", async () => {
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
      now: () => new Date("2026-05-12T11:00:00.000Z"),
    })

    const response = await app.request("/api/supervisor/ticks", {
      body: JSON.stringify({ iterations: 3 }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      plannedAt: "2026-05-12T11:00:00.000Z",
      result: {
        leased: false,
        plan: {
          accepted: true,
          blockers: [],
          command: [
            "pnpm",
            "agent:queue:control-plane-loop",
            "--",
            "--repo",
            "voyantjs/voyant",
            "--holder",
            "runner:cloudflare",
            "--iterations",
            "3",
            "--yes",
            "--control-plane-url",
            "https://control.example.com",
          ],
          dryRun: true,
          iterations: 3,
          mode: "lease-only",
          source: "api",
        },
        reason: "dry_run",
      },
      storage: {
        persisted: false,
        reason: "supervisor_tick_storage_not_configured",
      },
    })
  })

  it("leases one dispatch intent from the control plane when explicitly enabled", async () => {
    const calls: Array<{ body: unknown; headers: Headers; method: string; url: string }> = []
    const app = createApp({
      authTokens: ["token"],
      config: {
        controlPlaneConfigured: true,
        controlPlaneToken: "control-token",
        controlPlaneUrl: "https://control.example.com/",
        enabled: true,
        holder: "runner:cloudflare",
        repository: "voyantjs/voyant",
      },
      fetchImpl: async (url, init) => {
        calls.push({
          body: JSON.parse(String(init?.body)),
          headers: new Headers(init?.headers),
          method: init?.method ?? "GET",
          url: String(url),
        })
        return new Response(
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
        )
      },
      now: () => new Date("2026-05-12T11:00:00.000Z"),
      supervisorTickStore: inMemorySupervisorTickStore(),
    })

    const response = await app.request("/api/supervisor/ticks", {
      body: JSON.stringify({
        action: "sync-pr",
        dryRun: false,
        eventLog: ".agent-runs/cloudflare.jsonl",
        ttlSeconds: 120,
      }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      result: {
        controlPlane: {
          status: 201,
        },
        intent: {
          id: "intent_579",
          status: "leased",
        },
        leased: true,
        reason: "leased",
      },
      storage: {
        key: "latest/voyantjs/voyant.json",
        persisted: true,
      },
    })
    expect(calls).toEqual([
      {
        body: {
          filters: {
            action: "sync-pr",
          },
          lease: {
            holder: "runner:cloudflare",
            ttlSeconds: 120,
          },
          options: {
            eventLog: ".agent-runs/cloudflare.jsonl",
          },
          repository: "voyantjs/voyant",
        },
        headers: expect.any(Headers),
        method: "POST",
        url: "https://control.example.com/api/dispatch-intents/latest",
      },
    ])
    expect(calls[0]?.headers.get("authorization")).toBe("Bearer control-token")
  })

  it("reads the latest persisted supervisor tick", async () => {
    const supervisorTickStore = inMemorySupervisorTickStore()
    const app = createApp({
      authTokens: ["token"],
      config: {
        controlPlaneConfigured: true,
        controlPlaneUrl: "https://control.example.com",
        enabled: true,
        holder: "runner:cloudflare",
        repository: "voyantjs/voyant",
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

    const latest = await app.request("/api/supervisor/ticks/latest?repository=voyantjs%2Fvoyant", {
      headers: {
        authorization: "Bearer token",
      },
    })

    expect(latest.status).toBe(200)
    await expect(latest.json()).resolves.toMatchObject({
      recordedAt: "2026-05-12T12:00:00.000Z",
      repository: "voyantjs/voyant",
      result: {
        leased: false,
        reason: "dry_run",
      },
    })
  })

  it("requires storage and repository before reading latest supervisor ticks", async () => {
    const noStore = createApp({ authTokens: ["token"] })
    const noStoreResponse = await noStore.request(
      "/api/supervisor/ticks/latest?repository=voyantjs%2Fvoyant",
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

    const missingTick = await app.request(
      "/api/supervisor/ticks/latest?repository=voyantjs%2Fvoyant",
      {
        headers: {
          authorization: "Bearer token",
        },
      },
    )
    expect(missingTick.status).toBe(404)
    await expect(missingTick.json()).resolves.toEqual({ error: "supervisor_tick_not_found" })
  })

  it("stores latest supervisor ticks in R2-compatible object storage", async () => {
    const objects = new Map<string, string>()
    const store = createR2SupervisorTickStore({
      bucket: {
        async get(key: string) {
          const text = objects.get(key)
          return text ? { text: async () => text } : null
        },
        async put(key: string, value: string) {
          objects.set(key, String(value))
          return null
        },
      } satisfies SupervisorTickBucket,
      keyPrefix: "/runner/",
    })
    const record: SupervisorTickRecord = {
      recordedAt: "2026-05-12T12:00:00.000Z",
      repository: "voyantjs/voyant",
      result: {
        leased: false,
        reason: "dry_run",
      },
    }

    await expect(store.putLatest(record)).resolves.toEqual({
      key: "runner/supervisor-ticks/latest/voyantjs%2Fvoyant.json",
    })
    await expect(store.getLatest("VoyantJS/Voyant")).resolves.toEqual(record)
  })
})

function inMemorySupervisorTickStore(): SupervisorTickStore {
  const latest = new Map<string, SupervisorTickRecord>()

  return {
    async getLatest(repository) {
      return latest.get(repository.toLowerCase()) ?? null
    },
    async putLatest(record) {
      latest.set(record.repository.toLowerCase(), record)
      return { key: `latest/${record.repository.toLowerCase()}.json` }
    },
  }
}
