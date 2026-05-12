import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"

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
})
