import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import { runnerDispatchActions } from "./runner.js"
import type { SupervisorTickRecord, SupervisorTickStore } from "./supervisor-tick-store.js"

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
          policy: {
            allowedActions: Array.from(runnerDispatchActions).sort(),
            defaultAction: null,
            maxLeaseTtlSeconds: 900,
            requiresActionFilter: false,
          },
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

  it("applies runner action and lease TTL policy before calling the control plane", async () => {
    const calls: string[] = []
    const app = createApp({
      authTokens: ["token"],
      config: {
        allowedActions: ["sync-pr"],
        controlPlaneConfigured: true,
        controlPlaneToken: "control-token",
        controlPlaneUrl: "https://control.example.com/",
        enabled: true,
        holder: "runner:cloudflare",
        maxLeaseTtlSeconds: 120,
        repository: "voyantjs/voyant",
      },
      fetchImpl: async (url) => {
        calls.push(String(url))
        return new Response(JSON.stringify({ reason: "leased" }), { status: 201 })
      },
      now: () => new Date("2026-05-12T11:00:00.000Z"),
    })

    const missingAction = await app.request("/api/supervisor/ticks", {
      body: JSON.stringify({ dryRun: false }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })
    expect(missingAction.status).toBe(200)
    await expect(missingAction.json()).resolves.toMatchObject({
      result: {
        leased: false,
        plan: {
          accepted: false,
          blockers: ["runner policy requires an action filter"],
        },
        reason: "blocked",
      },
    })

    const blocked = await app.request("/api/supervisor/ticks", {
      body: JSON.stringify({ action: "cleanup", dryRun: false, ttlSeconds: 300 }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })
    expect(blocked.status).toBe(200)
    await expect(blocked.json()).resolves.toMatchObject({
      result: {
        leased: false,
        plan: {
          accepted: false,
          blockers: [
            "action cleanup is not allowed by runner policy",
            "lease TTL 300s exceeds runner policy maximum 120s",
          ],
        },
        reason: "blocked",
      },
    })
    expect(calls).toEqual([])
  })

  it("treats typoed full-length action allow-lists as restricted", async () => {
    const allowedActions = [
      ...runnerDispatchActions.filter((action) => action !== "cleanup"),
      "clean-up",
    ]
    expect(new Set(allowedActions).size).toBe(runnerDispatchActions.length)

    const app = createApp({
      authTokens: ["token"],
      config: {
        allowedActions,
        controlPlaneConfigured: true,
        controlPlaneToken: "control-token",
        controlPlaneUrl: "https://control.example.com/",
        enabled: true,
        holder: "runner:cloudflare",
        repository: "voyantjs/voyant",
      },
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
      result: {
        leased: false,
        plan: {
          accepted: false,
          policy: {
            requiresActionFilter: true,
          },
          blockers: ["runner policy requires an action filter"],
        },
        reason: "blocked",
      },
    })
  })

  it("uses the configured default action when scheduled ticks are action-restricted", async () => {
    const calls: Array<{ body: unknown; url: string }> = []
    const app = createApp({
      authTokens: ["token"],
      config: {
        allowedActions: ["sync-pr"],
        controlPlaneConfigured: true,
        controlPlaneToken: "control-token",
        controlPlaneUrl: "https://control.example.com/",
        defaultAction: "sync-pr",
        enabled: true,
        holder: "runner:cloudflare",
        repository: "voyantjs/voyant",
      },
      fetchImpl: async (url, init) => {
        calls.push({ body: JSON.parse(String(init?.body)), url: String(url) })
        return new Response(JSON.stringify({ reason: "idle" }), { status: 200 })
      },
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
      result: {
        leased: false,
        reason: "idle",
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
          },
          repository: "voyantjs/voyant",
        },
        url: "https://control.example.com/api/dispatch-intents/latest",
      },
    ])
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

    const recent = await app.request(
      "/api/supervisor/ticks/recent?repository=voyantjs%2Fvoyant&limit=5",
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
          repository: "voyantjs/voyant",
          result: {
            leased: false,
            reason: "dry_run",
          },
        },
      ],
      repository: "voyantjs/voyant",
    })
  })

  it("requires storage and repository before reading persisted supervisor ticks", async () => {
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

    const missingRecentRepository = await app.request("/api/supervisor/ticks/recent", {
      headers: {
        authorization: "Bearer token",
      },
    })
    expect(missingRecentRepository.status).toBe(400)
    await expect(missingRecentRepository.json()).resolves.toEqual({ error: "missing_repository" })

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
