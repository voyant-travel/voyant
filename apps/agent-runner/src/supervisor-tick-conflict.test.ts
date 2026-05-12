import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"

describe("agent runner supervisor tick conflicts", () => {
  it("surfaces active control-plane lease details when a tick conflicts", async () => {
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
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: "dispatch_intent_already_active",
            intent: {
              id: "intent_active",
              lease: {
                expiresAt: "2026-05-12T12:10:00.000Z",
                holder: "runner:other",
              },
              plan: {
                action: "sync-pr",
                issue: {
                  number: 579,
                  title: "Test agent project intake workflow",
                },
              },
              status: "leased",
            },
          }),
          { status: 409 },
        ),
    })

    const response = await app.request("/api/supervisor/ticks", {
      body: JSON.stringify({
        action: "sync-pr",
        dryRun: false,
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
          activeIntent: {
            id: "intent_active",
            lease: {
              expiresAt: "2026-05-12T12:10:00.000Z",
              holder: "runner:other",
            },
            plan: {
              action: "sync-pr",
              issue: {
                number: 579,
              },
            },
          },
          error: "dispatch_intent_already_active",
          status: 409,
        },
        leased: false,
        reason: "control_plane_rejected",
      },
    })
  })
})
