import { describe, expect, it } from "vitest"

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
})
