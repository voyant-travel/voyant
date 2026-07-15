import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
  createGeneratedProject,
  getRuntimeCompositionMocks,
  loadVoyantProject,
  loadVoyantProjectWorkflowRuntime,
} from "./runtime-composition.test-support.js"

const mocks = getRuntimeCompositionMocks()

describe("Voyant workflow runtime composition", () => {
  it("leaves Workflow Runs route composition to the selected graph", async () => {
    const projectRoot = await createGeneratedProject()
    await loadVoyantProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    })

    const options = mocks.loadVoyantNodeRuntime.mock.calls[0]?.[0] as {
      app?: { additionalRoutes?: unknown }
    }
    expect(options.app?.additionalRoutes).toBeUndefined()
  })

  it("passes graph runtime ports into scheduled package workflow composition", async () => {
    const artifactRoot = path.join(await createGeneratedProject(), ".voyant")

    await loadVoyantProjectWorkflowRuntime({
      projectRoot: path.dirname(artifactRoot),
      artifactRoot,
      runtime: mocks.nodeRuntime as never,
      runtimePorts: mocks.runtimePorts,
    })

    const options = mocks.loadVoyantNodeWorkflowRuntime.mock.calls[0]?.[0] as {
      createServices(): Promise<unknown>
    }
    expect(options).toMatchObject({
      graphRuntime: mocks.workflowGraphRuntime,
      environment: mocks.nodeRuntime.env,
      runtimePorts: mocks.runtimePorts,
    })
    await expect(options.createServices()).resolves.toEqual({
      services: mocks.nodeRuntime.app.services,
      eventBus: mocks.nodeRuntime.app.eventBus,
    })
    expect(mocks.nodeRuntime.app.ready).toHaveBeenCalledWith(mocks.nodeRuntime.env)
  })

  it("passes resident graph ports from the Node schedule into workflow composition", async () => {
    const projectRoot = await createGeneratedProject([
      {
        id: "catalog-reap-expired-booking-drafts",
        cron: "0 * * * *",
        workflowId: "catalog.reap-expired-booking-drafts",
      },
    ])
    const project = await loadVoyantProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    })

    project.start()
    const serverOptions = mocks.createNodeServer.mock.calls[0]?.[0] as {
      scheduled(
        event: { scheduleId: string; scheduledTime: number },
        bindings: Record<string, string>,
        ctx: { waitUntil(promise: Promise<unknown>): void },
      ): Promise<void>
    }
    await serverOptions.scheduled(
      {
        scheduleId: "catalog-reap-expired-booking-drafts",
        scheduledTime: 1_783_661_445_000,
      },
      { DATABASE_URL: "postgres://example.invalid/voyant" },
      { waitUntil: vi.fn() },
    )

    expect(mocks.runScheduledWorkflow).toHaveBeenCalledOnce()
    expect(mocks.loadVoyantNodeWorkflowRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimePorts: expect.objectContaining({
          ...mocks.runtimePorts,
          "storage.object": expect.objectContaining({ resolve: expect.any(Function) }),
        }),
      }),
    )
    expect(mocks.createVoyantNodeWorkflowDriver).toHaveBeenCalledWith({
      deployment: mocks.nodeRuntime.deployment,
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
      defaultAppSlug: path.basename(projectRoot),
      oneShot: true,
    })
  })

  it("omits scheduled workflow execution when the resolved provider is none", async () => {
    mocks.nodeRuntime.deployment.providers.workflows = "none"
    const projectRoot = await createGeneratedProject([
      { id: "disabled-workflow", cron: "0 * * * *", workflowId: "workflow.disabled" },
    ])
    const project = await loadVoyantProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    })

    project.start()
    const serverOptions = mocks.createNodeServer.mock.calls[0]?.[0] as {
      scheduled(
        event: { scheduleId: string; scheduledTime: number },
        bindings: Record<string, string>,
        ctx: { waitUntil(promise: Promise<unknown>): void },
      ): Promise<void>
    }
    await serverOptions.scheduled(
      { scheduleId: "disabled-workflow", scheduledTime: 1 },
      { DATABASE_URL: "postgres://example.invalid/voyant" },
      { waitUntil: vi.fn() },
    )

    expect(mocks.runScheduledWorkflow).not.toHaveBeenCalled()
    expect(mocks.loadVoyantNodeWorkflowRuntime).not.toHaveBeenCalled()
  })
})
