import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const graphRuntime = {
    modules: [],
    extensions: [],
    plugins: [],
    accessCatalog: { resources: [] },
  }
  const workflowGraphRuntime = { ...graphRuntime }
  const runtimePorts = { "voyant.workflow-services": [{ serviceId: "package.service" }] }
  const services = { has: vi.fn(() => false), register: vi.fn(), resolve: vi.fn() }
  const eventBus = { emit: vi.fn(), subscribe: vi.fn() }
  const runtimeFetch = vi.fn(async (request: Request) => new Response(request.url))
  const nodeRuntime = {
    env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    app: { ready: vi.fn(), fetch: runtimeFetch, services, eventBus },
  }

  return {
    adminHostOptions: [] as Array<{
      clientAssetsDir: string
      app(request: Request, env: unknown, ctx: unknown): Promise<Response>
    }>,
    authRuntimeOptions: [] as Array<Record<string, unknown>>,
    createNodeServer: vi.fn((_options: unknown) => ({ close: vi.fn(), port: 8080 })),
    enqueuePostgresWebhookEvent: vi.fn(async () => ["queued"]),
    loadVoyantNodeRuntime: vi.fn(async (_options: unknown) => nodeRuntime),
    loadVoyantNodeWorkflowRuntime: vi.fn(async (_options: unknown) => ({ workflows: [] })),
    nodeRuntime,
    resolveNodeDatabase: vi.fn(() => ({ kind: "database" })),
    runtimeFetch,
    runScheduledWorkflow: vi.fn(
      async (_job: unknown, _event: unknown, runtime: { load(): Promise<unknown> }) =>
        runtime.load(),
    ),
    runtimePorts,
    workflowGraphRuntime,
  }
})

vi.mock("@voyant-travel/admin-host/serve", () => ({
  serveAdminHost: (options: (typeof mocks.adminHostOptions)[number]) => {
    mocks.adminHostOptions.push(options)
    return {
      fetch: (request: Request, env: unknown, ctx: unknown) => options.app(request, env, ctx),
    }
  },
}))

vi.mock("@voyant-travel/auth/operator-node-runtime", () => ({
  createOperatorAuthNodeRuntime: (options: Record<string, unknown>) => {
    mocks.authRuntimeOptions.push(options)
    return {
      handler: vi.fn(),
      getBootstrapStatusForRequest: vi.fn(),
      getCurrentUserForRequest: vi.fn(),
      hasAuthPermission: vi.fn(),
      resolveAuthRequest: vi.fn(),
      validateApiTokenAccess: vi.fn(),
    }
  },
}))

vi.mock("@voyant-travel/cloud-sdk", () => ({
  getVoyantCloudClient: vi.fn(),
}))

vi.mock("@voyant-travel/db/runtime", () => ({
  resolveNodeDatabase: mocks.resolveNodeDatabase,
}))

vi.mock("@voyant-travel/framework/node-runtime", () => ({
  createVoyantNodeEnv: (env: Record<string, string | undefined>) => env,
  createVoyantNodeRuntimeHostPrimitives: (options: {
    env: Record<string, string | undefined>
    deliverEvent(event: unknown, bindings: unknown): Promise<unknown>
  }) => ({
    env: () => options.env,
    database: {},
    storage: {},
    config: {},
    events: { deliver: options.deliverEvent },
  }),
  createVoyantNodeWorkflowDriver: vi.fn(),
  loadVoyantNodeRuntime: mocks.loadVoyantNodeRuntime,
}))

vi.mock("@voyant-travel/framework/node-host", () => ({
  loadVoyantNodeWorkflowRuntime: mocks.loadVoyantNodeWorkflowRuntime,
}))

vi.mock("@voyant-travel/hono/observability/reporter", () => ({
  consoleReporter: () => ({}),
}))

vi.mock("@voyant-travel/runtime", () => ({
  createNodeServer: mocks.createNodeServer,
}))

vi.mock("@voyant-travel/webhook-delivery/postgres", () => ({
  enqueuePostgresWebhookEvent: mocks.enqueuePostgresWebhookEvent,
}))

vi.mock("@voyant-travel/workflow-runs", () => ({
  mountWorkflowRunsAdminRoutes: vi.fn(),
  WorkflowRunnerRegistry: class {},
}))

vi.mock("@voyant-travel/workflow-runs/scheduled-workflow", () => ({
  isGraphWorkflowScheduledJob: () => true,
  runScheduledWorkflow: mocks.runScheduledWorkflow,
}))

vi.mock("tsx/esm/api", () => ({
  tsImport: vi.fn(async (url: string) => {
    if (url.includes("project-runtime.generated.ts")) {
      return {
        createGeneratedProjectRuntime: () => ({
          kind: "application",
          graphHash: "graph-hash",
          deployment: { mode: "self-hosted", providers: {} },
          graphRuntime: mocks.workflowGraphRuntime,
          createRuntimePorts: () => mocks.runtimePorts,
        }),
      }
    }
    if (url.includes("project-package-workflows.generated.ts")) {
      return { createGeneratedWorkflowRuntime: () => mocks.workflowGraphRuntime }
    }
    if (url.includes("project-links.generated.ts")) return { projectLinks: [] }
    throw new Error(`Unexpected generated import: ${url}`)
  }),
}))

import { loadOperatorProject, loadOperatorProjectWorkflowRuntime } from "./index.js"

const temporaryRoots: string[] = []

beforeEach(() => {
  vi.clearAllMocks()
  mocks.adminHostOptions.length = 0
  mocks.authRuntimeOptions.length = 0
})

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })))
})

describe("Operator runtime composition", () => {
  it("selects admin assets from the same generated artifact layout", async () => {
    const developmentRoot = await createGeneratedProject()
    await mkdir(path.join(developmentRoot, ".voyant/admin/client"), { recursive: true })
    await mkdir(path.join(developmentRoot, "dist/client"), { recursive: true })
    await loadOperatorProject({
      projectRoot: developmentRoot,
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    })
    expect(mocks.adminHostOptions[0]?.clientAssetsDir).toBe(
      path.join(developmentRoot, ".voyant/admin/client"),
    )

    const distributionRoot = await createGeneratedProject([], "dist/.voyant")
    await mkdir(path.join(distributionRoot, ".voyant/admin/client"), { recursive: true })
    await mkdir(path.join(distributionRoot, "dist/client"), { recursive: true })
    await loadOperatorProject({
      projectRoot: distributionRoot,
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    })
    expect(mocks.adminHostOptions[1]?.clientAssetsDir).toBe(
      path.join(distributionRoot, "dist/client"),
    )
  })

  it("rewrites persisted legacy media URLs before API dispatch", async () => {
    const projectRoot = await createGeneratedProject()
    const project = await loadOperatorProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    })

    await project.fetch(
      new Request("http://localhost:3300/api/v1/media/uploads/example.pdf?download=1"),
    )

    const dispatched = mocks.runtimeFetch.mock.calls[0]?.[0] as Request
    expect(new URL(dispatched.url)).toMatchObject({
      pathname: "/api/v1/admin/media/uploads/example.pdf",
      search: "?download=1",
    })
  })

  it("provides the standard cloud email resolver to the auth runtime", async () => {
    const projectRoot = await createGeneratedProject()
    await loadOperatorProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    })

    expect(mocks.authRuntimeOptions[0]).toMatchObject({
      resolveEmailSender: expect.any(Function),
    })
  })

  it("wires graph outbound webhooks through the neutral Node delivery helper", async () => {
    const projectRoot = await createGeneratedProject()
    await loadOperatorProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    })

    const options = mocks.loadVoyantNodeRuntime.mock.calls[0]?.[0] as {
      outboundWebhooks: { enqueue(event: unknown, bindings: unknown): Promise<unknown> }
    }
    expect(options).toMatchObject({
      runtimePorts: mocks.runtimePorts,
      resources: {},
      outboundWebhooks: { enqueue: expect.any(Function) },
    })

    const event = { name: "catalog.entity.updated" }
    const bindings = { DATABASE_URL: "postgres://example.invalid/voyant" }
    await expect(options?.outboundWebhooks.enqueue(event, bindings)).resolves.toEqual(["queued"])
    expect(mocks.resolveNodeDatabase).toHaveBeenCalledWith(bindings)
    expect(mocks.enqueuePostgresWebhookEvent).toHaveBeenCalledWith({ kind: "database" }, event)
  })

  it("passes graph runtime ports into scheduled package workflow composition", async () => {
    const artifactRoot = path.join(await createGeneratedProject(), ".voyant")

    await loadOperatorProjectWorkflowRuntime({
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
    await expect(options?.createServices()).resolves.toEqual({
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
    const project = await loadOperatorProject({
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
      expect.objectContaining({ runtimePorts: mocks.runtimePorts }),
    )
  })
})

async function createGeneratedProject(
  scheduledJobs: readonly Readonly<Record<string, unknown>>[] = [],
  layout = ".voyant",
): Promise<string> {
  const projectRoot = await mkdtemp(path.join(tmpdir(), "voyant-operator-runtime-"))
  temporaryRoots.push(projectRoot)
  const artifactRoot = path.join(projectRoot, layout)
  const runtimeDir = path.join(artifactRoot, "runtime")
  await mkdir(runtimeDir, { recursive: true })
  await writeFile(path.join(runtimeDir, "project-runtime.generated.ts"), "export {}\n")
  await writeFile(
    path.join(artifactRoot, "deployment-graph.generated.json"),
    JSON.stringify({
      contentHash: "graph-hash",
      requirements: { resources: [] },
      provisioning: { scheduledJobs },
    }),
  )
  return projectRoot
}
