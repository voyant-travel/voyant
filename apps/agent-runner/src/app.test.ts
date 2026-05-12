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
        source: "api",
      },
    })
  })
})
