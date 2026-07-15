import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { createWorkflowRunsVoyantRuntime } from "../../src/api-runtime.js"
import { WorkflowRunnerRegistry } from "../../src/runner.js"
import { workflowRunnerRegistryRuntimePort } from "../../src/runtime-port.js"

describe("Workflow Runs selected graph runtime", () => {
  it("dispatches through the graph-provided registry and preserves the request actor", async () => {
    const registry = new WorkflowRunnerRegistry()
    const trigger = vi.fn(async () => ({ runId: "run_selected" }))
    registry.register({
      name: "selected-workflow",
      idempotency: "safe",
      trigger,
      rerun: async () => ({ runId: "run_rerun" }),
      resume: async () => ({ runId: "run_resume" }),
    })
    const getPort = vi.fn(async () => registry)
    const runtime = await createWorkflowRunsVoyantRuntime({
      getPort,
      graph: { providerSelections: { workflows: "self-hosted" } },
    } as never)
    const routes = await runtime.lazyRoutes?.load()
    if (!routes) throw new Error("Workflow Runs graph runtime did not expose lazy routes")

    const app = new Hono()
    app.use("*", async (context, next) => {
      context.set("userId" as never, "user_selected")
      await next()
    })
    app.route("/", routes)

    const response = await app.request("/v1/admin/workflows/selected-workflow/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: { bookingId: "booking_1" } }),
    })

    expect(response.status).toBe(202)
    expect(getPort).toHaveBeenCalledWith(workflowRunnerRegistryRuntimePort)
    expect(trigger).toHaveBeenCalledWith(
      { bookingId: "booking_1" },
      expect.objectContaining({ triggeredByUserId: "user_selected" }),
    )
  })

  it.each([
    ["voyant-cloud", "cloud"],
    ["none", "disabled"],
  ] as const)("maps the %s provider to the %s admin surface", async (provider, surface) => {
    const registry = new WorkflowRunnerRegistry()
    const trigger = vi.fn(async () => ({ runId: "run_blocked" }))
    registry.register({
      name: "selected-workflow",
      idempotency: "safe",
      trigger,
      rerun: async () => ({ runId: "run_rerun" }),
      resume: async () => ({ runId: "run_resume" }),
    })
    const runtime = await createWorkflowRunsVoyantRuntime({
      getPort: async () => registry,
      graph: { providerSelections: { workflows: provider } },
    } as never)
    const routes = await runtime.lazyRoutes?.load()
    if (!routes) throw new Error("Workflow Runs graph runtime did not expose lazy routes")

    const app = new Hono()
    app.route("/", routes)
    const response = await app.request("/v1/admin/workflows/selected-workflow/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: {} }),
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: "workflow_admin_surface_restricted",
      surface,
    })
    expect(trigger).not.toHaveBeenCalled()
  })

  it("rejects an unsupported graph-selected workflow provider", async () => {
    await expect(
      createWorkflowRunsVoyantRuntime({
        getPort: async () => new WorkflowRunnerRegistry(),
        graph: { providerSelections: { workflows: "memory" } },
      } as never),
    ).rejects.toThrow("Unsupported deployment.providers.workflows")
  })
})
