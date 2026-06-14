import { describe, expect, it } from "vitest"

import { parseSpritePoolConfig } from "./remote-workspace-pool.js"
import { runSupervisorTick } from "./runner.js"

describe("agent runner remote workspace pool", () => {
  it("leases a Sprite pool slot before requesting remote bootstrap work", async () => {
    const controlPlaneCalls: Array<{ body: unknown; url: string }> = []
    const coordinatorCalls: Array<{ body: unknown; url: string }> = []
    const result = await runSupervisorTick({
      config: {
        allowedActions: ["remote-bootstrap"],
        controlPlaneConfigured: true,
        controlPlaneToken: "control-token",
        controlPlaneUrl: "https://control.example.com/",
        defaultAction: "remote-bootstrap",
        enabled: true,
        holder: "runner:cloudflare",
        remoteWorkspacePool: parseSpritePoolConfig("voyant-agent-01:2,voyant-agent-02:2"),
        repository: "voyant-travel/voyant",
      },
      coordinatorService: {
        fetch: async (input) => {
          const request = input instanceof Request ? input : new Request(input)
          const body = (await request.json()) as { holder: string; key: string }
          coordinatorCalls.push({ body, url: request.url })
          return new Response(
            JSON.stringify({
              acquired: true,
              lock: {
                acquiredAt: "2026-05-12T12:00:00.000Z",
                expiresAt: "2026-05-12T12:05:00.000Z",
                holder: body.holder,
                key: body.key,
              },
            }),
            { status: 201 },
          )
        },
      },
      fetchImpl: async (url, init) => {
        controlPlaneCalls.push({
          body: JSON.parse(String(init?.body)),
          url: String(url),
        })
        return new Response(
          JSON.stringify({
            intent: {
              id: "intent_579",
              plan: {
                action: "remote-bootstrap",
              },
              status: "leased",
            },
            reason: "leased",
          }),
          { status: 201 },
        )
      },
      request: {
        dryRun: false,
        ttlSeconds: 300,
      },
      source: "scheduled",
    })

    expect(result).toMatchObject({
      leased: true,
      reason: "leased",
      remoteWorkspaceLease: {
        key: "remote-workspace:sprite:voyant-agent-01-slot-1",
        slot: {
          sprite: "voyant-agent-01",
          workspaceReference: "sandbox:sprite:voyant-agent-01-slot-1",
        },
      },
    })
    expect(coordinatorCalls).toEqual([
      {
        body: {
          holder: "runner:cloudflare",
          key: "remote-workspace:sprite:voyant-agent-01-slot-1",
          ttlSeconds: 300,
        },
        url: "https://agent-runner-coordinator.internal/locks/acquire",
      },
    ])
    expect(controlPlaneCalls).toEqual([
      {
        body: {
          filters: {
            action: "start",
          },
          lease: {
            holder: "runner:cloudflare",
            ttlSeconds: 300,
          },
          options: {
            remoteWorkspace: "sandbox:sprite:voyant-agent-01-slot-1",
          },
          repository: "voyant-travel/voyant",
        },
        url: "https://control.example.com/api/dispatch-intents/latest",
      },
    ])
  })

  it("retries the next Sprite pool slot when the first workspace is already assigned", async () => {
    const controlPlaneCalls: Array<{ body: unknown; url: string }> = []
    const coordinatorCalls: Array<{ body: unknown; url: string }> = []
    const result = await runSupervisorTick({
      config: {
        allowedActions: ["remote-bootstrap"],
        controlPlaneConfigured: true,
        controlPlaneToken: "control-token",
        controlPlaneUrl: "https://control.example.com/",
        defaultAction: "remote-bootstrap",
        enabled: true,
        holder: "runner:cloudflare",
        remoteWorkspacePool: parseSpritePoolConfig("voyant-agent-01:2"),
        repository: "voyant-travel/voyant",
      },
      coordinatorService: {
        fetch: async (input) => {
          const request = input instanceof Request ? input : new Request(input)
          const body = (await request.json()) as { holder: string; key: string }
          coordinatorCalls.push({ body, url: request.url })
          if (request.url.endsWith("/locks/release")) {
            return new Response(JSON.stringify({ released: true }), { status: 200 })
          }
          return new Response(
            JSON.stringify({
              acquired: true,
              lock: {
                acquiredAt: "2026-05-12T12:00:00.000Z",
                expiresAt: "2026-05-12T12:05:00.000Z",
                holder: body.holder,
                key: body.key,
              },
            }),
            { status: 201 },
          )
        },
      },
      fetchImpl: async (url, init) => {
        const body = JSON.parse(String(init?.body))
        controlPlaneCalls.push({
          body,
          url: String(url),
        })
        if (body.options.remoteWorkspace === "sandbox:sprite:voyant-agent-01-slot-1") {
          return new Response(
            JSON.stringify({
              intent: null,
              reason: "remote workspace sandbox:sprite:voyant-agent-01-slot-1 is already assigned",
            }),
            { status: 200 },
          )
        }
        return new Response(
          JSON.stringify({
            intent: {
              id: "intent_580",
              plan: {
                action: "remote-bootstrap",
              },
              status: "leased",
            },
            reason: "leased",
          }),
          { status: 201 },
        )
      },
      request: {
        dryRun: false,
        ttlSeconds: 300,
      },
      source: "scheduled",
    })

    expect(result).toMatchObject({
      intent: {
        id: "intent_580",
      },
      leased: true,
      reason: "leased",
      remoteWorkspaceLease: {
        key: "remote-workspace:sprite:voyant-agent-01-slot-2",
        slot: {
          workspaceReference: "sandbox:sprite:voyant-agent-01-slot-2",
        },
      },
    })
    expect(coordinatorCalls).toEqual([
      {
        body: {
          holder: "runner:cloudflare",
          key: "remote-workspace:sprite:voyant-agent-01-slot-1",
          ttlSeconds: 300,
        },
        url: "https://agent-runner-coordinator.internal/locks/acquire",
      },
      {
        body: {
          holder: "runner:cloudflare",
          key: "remote-workspace:sprite:voyant-agent-01-slot-1",
        },
        url: "https://agent-runner-coordinator.internal/locks/release",
      },
      {
        body: {
          holder: "runner:cloudflare",
          key: "remote-workspace:sprite:voyant-agent-01-slot-2",
          ttlSeconds: 300,
        },
        url: "https://agent-runner-coordinator.internal/locks/acquire",
      },
    ])
    expect(controlPlaneCalls.map((call) => call.body)).toEqual([
      expect.objectContaining({
        options: {
          remoteWorkspace: "sandbox:sprite:voyant-agent-01-slot-1",
        },
      }),
      expect.objectContaining({
        options: {
          remoteWorkspace: "sandbox:sprite:voyant-agent-01-slot-2",
        },
      }),
    ])
  })

  it("stops Sprite pool retries when releasing an assigned slot fails", async () => {
    const controlPlaneCalls: Array<{ body: unknown; url: string }> = []
    const coordinatorCalls: Array<{ body: unknown; url: string }> = []
    const result = await runSupervisorTick({
      config: {
        allowedActions: ["remote-bootstrap"],
        controlPlaneConfigured: true,
        controlPlaneToken: "control-token",
        controlPlaneUrl: "https://control.example.com/",
        defaultAction: "remote-bootstrap",
        enabled: true,
        holder: "runner:cloudflare",
        remoteWorkspacePool: parseSpritePoolConfig("voyant-agent-01:2"),
        repository: "voyant-travel/voyant",
      },
      coordinatorService: {
        fetch: async (input) => {
          const request = input instanceof Request ? input : new Request(input)
          const body = (await request.json()) as { holder: string; key: string }
          coordinatorCalls.push({ body, url: request.url })
          if (request.url.endsWith("/locks/release")) {
            return new Response(JSON.stringify({ reason: "holder_mismatch", released: false }), {
              status: 409,
            })
          }
          return new Response(
            JSON.stringify({
              acquired: true,
              lock: {
                acquiredAt: "2026-05-12T12:00:00.000Z",
                expiresAt: "2026-05-12T12:05:00.000Z",
                holder: body.holder,
                key: body.key,
              },
            }),
            { status: 201 },
          )
        },
      },
      fetchImpl: async (url, init) => {
        const body = JSON.parse(String(init?.body))
        controlPlaneCalls.push({
          body,
          url: String(url),
        })
        return new Response(
          JSON.stringify({
            intent: null,
            reason: "remote workspace sandbox:sprite:voyant-agent-01-slot-1 is already assigned",
          }),
          { status: 200 },
        )
      },
      request: {
        dryRun: false,
        ttlSeconds: 300,
      },
      source: "scheduled",
    })

    expect(result).toMatchObject({
      intent: null,
      leased: false,
      reason: "remote_workspace_release_failed",
      remoteWorkspaceLease: {
        key: "remote-workspace:sprite:voyant-agent-01-slot-1",
      },
      remoteWorkspaceRelease: {
        released: false,
        response: {
          reason: "holder_mismatch",
          released: false,
        },
        status: 409,
      },
    })
    expect(coordinatorCalls).toEqual([
      {
        body: {
          holder: "runner:cloudflare",
          key: "remote-workspace:sprite:voyant-agent-01-slot-1",
          ttlSeconds: 300,
        },
        url: "https://agent-runner-coordinator.internal/locks/acquire",
      },
      {
        body: {
          holder: "runner:cloudflare",
          key: "remote-workspace:sprite:voyant-agent-01-slot-1",
        },
        url: "https://agent-runner-coordinator.internal/locks/release",
      },
    ])
    expect(controlPlaneCalls.map((call) => call.body)).toEqual([
      expect.objectContaining({
        options: {
          remoteWorkspace: "sandbox:sprite:voyant-agent-01-slot-1",
        },
      }),
    ])
  })
})
