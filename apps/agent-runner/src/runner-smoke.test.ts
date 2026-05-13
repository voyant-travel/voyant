import { describe, expect, it } from "vitest"

import { parseSpritePoolConfig } from "./remote-workspace-pool.js"
import { runSupervisorTick } from "./runner.js"

describe("agent runner smoke ticks", () => {
  it("validates the control-plane read path without leasing work", async () => {
    const calls: Array<{ body: unknown; headers: Headers; method: string; url: string }> = []
    const result = await runSupervisorTick({
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
            plan: {
              action: "sync-pr",
              issue: {
                number: 777,
              },
            },
            reason: "matched",
          }),
          { status: 200 },
        )
      },
      request: {
        action: "sync-pr",
        dryRun: true,
        eventLog: ".agent-runs/cloudflare.jsonl",
        validateControlPlane: true,
      },
      source: "api",
    })

    expect(result).toMatchObject({
      controlPlane: {
        status: 200,
      },
      dispatchPlan: {
        action: "sync-pr",
      },
      leased: false,
      reason: "dry_run",
    })
    expect(calls).toEqual([
      {
        body: {
          filters: {
            action: "sync-pr",
          },
          options: {
            eventLog: ".agent-runs/cloudflare.jsonl",
          },
          repository: "voyantjs/voyant",
        },
        headers: expect.any(Headers),
        method: "POST",
        url: "https://control.example.com/api/dispatch-plans/latest",
      },
    ])
    expect(calls[0]?.headers.get("authorization")).toBe("Bearer control-token")
  })

  it("uses the control-plane service binding when configured", async () => {
    const calls: Array<{ body: unknown; headers: Headers; method: string; url: string }> = []
    const result = await runSupervisorTick({
      config: {
        controlPlaneConfigured: true,
        controlPlaneService: {
          fetch: async (input) => {
            const request = input instanceof Request ? input : new Request(input)
            calls.push({
              body: await request.json(),
              headers: request.headers,
              method: request.method,
              url: request.url,
            })
            return new Response(
              JSON.stringify({
                plan: null,
                reason: "no dispatchable recommendation matched",
              }),
              { status: 200 },
            )
          },
        },
        controlPlaneToken: "control-token",
        controlPlaneUrl: "https://control.example.com/",
        enabled: true,
        holder: "runner:cloudflare",
        repository: "voyantjs/voyant",
      },
      request: {
        action: "sync-pr",
        dryRun: true,
        validateControlPlane: true,
      },
      source: "api",
    })

    expect(result).toMatchObject({
      controlPlane: {
        status: 200,
      },
      dispatchPlan: null,
      leased: false,
      reason: "dry_run",
    })
    expect(calls).toEqual([
      {
        body: {
          filters: {
            action: "sync-pr",
          },
          repository: "voyantjs/voyant",
        },
        headers: expect.any(Headers),
        method: "POST",
        url: "https://agent-control-plane.internal/api/dispatch-plans/latest",
      },
    ])
    expect(calls[0]?.headers.get("authorization")).toBe("Bearer control-token")
  })

  it("surfaces read-only control-plane smoke failures", async () => {
    const result = await runSupervisorTick({
      config: {
        controlPlaneConfigured: true,
        controlPlaneToken: "control-token",
        controlPlaneUrl: "https://control.example.com/",
        enabled: true,
        holder: "runner:cloudflare",
        repository: "voyantjs/voyant",
      },
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: "tick_snapshot_not_found" }), {
          status: 404,
        }),
      request: {
        dryRun: true,
        validateControlPlane: true,
      },
      source: "api",
    })

    expect(result).toMatchObject({
      controlPlane: {
        error: "tick_snapshot_not_found",
        status: 404,
      },
      leased: false,
      reason: "control_plane_rejected",
    })
  })

  it("keeps CI repair actions out of the default deployed runner policy", async () => {
    const calls: string[] = []
    const result = await runSupervisorTick({
      config: {
        controlPlaneConfigured: true,
        controlPlaneToken: "control-token",
        controlPlaneUrl: "https://control.example.com/",
        enabled: true,
        holder: "runner:cloudflare",
        repository: "voyantjs/voyant",
      },
      fetchImpl: async (url) => {
        calls.push(String(url))
        return new Response(JSON.stringify({ reason: "leased" }), { status: 201 })
      },
      request: {
        action: "repair-ci",
        dryRun: false,
      },
      source: "scheduled",
    })

    expect(result).toMatchObject({
      leased: false,
      plan: {
        accepted: false,
        blockers: ["action repair-ci is not allowed by runner policy"],
        policy: {
          allowedActions: expect.not.arrayContaining(["repair-ci", "remote-repair-ci"]),
          requiresActionFilter: false,
        },
      },
      reason: "blocked",
    })
    expect(calls).toEqual([])
  })

  it.each([
    "repair-ci",
    "remote-repair-ci",
  ] as const)("allows deployed supervisors to lease %s when policy permits it", async (action) => {
    const calls: Array<{ body: unknown; url: string }> = []
    const result = await runSupervisorTick({
      config: {
        allowedActions: [action],
        controlPlaneConfigured: true,
        controlPlaneToken: "control-token",
        controlPlaneUrl: "https://control.example.com/",
        defaultAction: action,
        enabled: true,
        holder: "runner:cloudflare",
        repository: "voyantjs/voyant",
      },
      fetchImpl: async (url, init) => {
        calls.push({
          body: JSON.parse(String(init?.body)),
          url: String(url),
        })
        return new Response(
          JSON.stringify({
            intent: {
              id: `intent_${action}`,
              plan: {
                action,
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
      },
      source: "scheduled",
    })

    expect(result).toMatchObject({
      intent: {
        plan: {
          action,
        },
        status: "leased",
      },
      leased: true,
      reason: "leased",
    })
    expect(calls).toEqual([
      {
        body: {
          filters: {
            action,
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
        repository: "voyantjs/voyant",
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
          repository: "voyantjs/voyant",
        },
        url: "https://control.example.com/api/dispatch-intents/latest",
      },
    ])
  })
})
