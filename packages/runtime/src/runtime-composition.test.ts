import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createVoyantGraphRuntime } from "@voyant-travel/framework/deployment-artifacts"
import { tsImport } from "tsx/esm/api"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const graphRuntime = {
    modules: [],
    extensions: [],
    plugins: [],
    accessCatalog: { resources: [] },
  }
  const workflowGraphRuntime: Record<string, unknown> = { ...graphRuntime }
  const runtimePorts = { "voyant.workflow-services": [{ serviceId: "package.service" }] }
  const services = { has: vi.fn(() => false), register: vi.fn(), resolve: vi.fn() }
  const eventBus = { emit: vi.fn(), subscribe: vi.fn() }
  const runtimeFetch = vi.fn(async (request: Request) => new Response(request.url))
  const nodeRuntime = {
    env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    deployment: { mode: "self-hosted", providers: { workflows: "self-hosted" } },
    app: { ready: vi.fn(), fetch: runtimeFetch, services, eventBus },
  }
  const workflowDriver = { kind: "workflow-driver" }

  return {
    adminHostOptions: [] as Array<{
      clientAssetsDir: string
      app(request: Request, env: unknown, ctx: unknown): Promise<Response>
    }>,
    authRuntimeOptions: [] as Array<Record<string, unknown>>,
    createNodeServer: vi.fn((_options: unknown) => ({ close: vi.fn(), port: 8080 })),
    postgresEnqueue: vi.fn(async () => ["queued"]),
    createPostgresWebhookDeliveryEnqueuer: vi.fn(),
    deploymentProviders: { outboundWebhooks: "postgres" } as Record<string, string>,
    loadVoyantNodeRuntime: vi.fn(async (_options: unknown) => nodeRuntime),
    loadVoyantNodeWorkflowRuntime: vi.fn(async (_options: unknown) => ({ workflows: [] })),
    nodeRuntime,
    resolveNodeDatabase: vi.fn(() => ({ kind: "database" })),
    runtimePortHosts: [] as Array<{
      primitives: unknown
      runtimePorts?: Readonly<Record<string, unknown>>
    }>,
    runtimeFetch,
    createVoyantNodeWorkflowDriver: vi.fn(() => () => workflowDriver),
    runScheduledWorkflow: vi.fn(
      async (
        _job: unknown,
        _event: unknown,
        runtime: {
          load(): Promise<{ services: unknown }>
          createDriver(dependencies: unknown): unknown
        },
      ) => {
        const loaded = await runtime.load()
        return runtime.createDriver({ services: loaded.services, logger: vi.fn() })
      },
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

vi.mock("@voyant-travel/auth/node-runtime", () => ({
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
  createVoyantNodeStorageResolver: () => ({ resolve: () => null }),
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
  createVoyantNodeWorkflowDriver: mocks.createVoyantNodeWorkflowDriver,
  loadVoyantNodeRuntime: mocks.loadVoyantNodeRuntime,
  resolveVoyantNodeProviderPlan: () => ({
    storage: "memory",
    cache: "memory",
    sharedState: "memory",
    rateLimit: "memory",
  }),
  resolveVoyantNodeWorkflowProvider: (value: unknown) => {
    if (value === "voyant-cloud" || value === "self-hosted" || value === "none") return value
    throw new Error("unsupported workflow provider")
  },
  validateVoyantNodeProviderPlanEnv: () => [],
}))

vi.mock("@voyant-travel/framework/node-host", () => ({
  loadVoyantNodeWorkflowRuntime: mocks.loadVoyantNodeWorkflowRuntime,
}))

vi.mock("@voyant-travel/hono/observability/reporter", () => ({
  consoleReporter: () => ({}),
}))

vi.mock("@voyant-travel/runtime-core", () => ({
  createNodeServer: mocks.createNodeServer,
}))

vi.mock("@voyant-travel/webhook-delivery/postgres", () => ({
  createPostgresWebhookDeliveryEnqueuer: mocks.createPostgresWebhookDeliveryEnqueuer,
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
          deployment: { mode: "self-hosted", providers: mocks.deploymentProviders },
          graphRuntime: mocks.workflowGraphRuntime,
          createRuntimePorts: (host: (typeof mocks.runtimePortHosts)[number]) => {
            mocks.runtimePortHosts.push(host)
            return { ...host.runtimePorts, ...mocks.runtimePorts }
          },
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

import { loadVoyantProject, loadVoyantProjectWorkflowRuntime } from "./index.js"

const temporaryRoots: string[] = []

beforeEach(() => {
  vi.clearAllMocks()
  mocks.adminHostOptions.length = 0
  mocks.authRuntimeOptions.length = 0
  mocks.runtimePortHosts.length = 0
  mocks.nodeRuntime.deployment.providers.workflows = "self-hosted"
  mocks.deploymentProviders = { workflows: "self-hosted", outboundWebhooks: "postgres" }
  mocks.workflowGraphRuntime = {
    modules: [],
    extensions: [],
    plugins: [],
    accessCatalog: { resources: [] },
  }
  mocks.createPostgresWebhookDeliveryEnqueuer.mockReturnValue({
    enqueue: mocks.postgresEnqueue,
  })
})

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })))
})

describe("Voyant project runtime composition", () => {
  it("selects admin assets from the same generated artifact layout", async () => {
    const developmentRoot = await createGeneratedProject()
    await mkdir(path.join(developmentRoot, ".voyant/admin/client"), { recursive: true })
    await mkdir(path.join(developmentRoot, "dist/client"), { recursive: true })
    await loadVoyantProject({
      projectRoot: developmentRoot,
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    })
    expect(mocks.adminHostOptions[0]?.clientAssetsDir).toBe(
      path.join(developmentRoot, ".voyant/admin/client"),
    )

    const distributionRoot = await createGeneratedProject([], "dist/.voyant")
    await mkdir(path.join(distributionRoot, ".voyant/admin/client"), { recursive: true })
    await mkdir(path.join(distributionRoot, "dist/client"), { recursive: true })
    await loadVoyantProject({
      projectRoot: distributionRoot,
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    })
    expect(mocks.adminHostOptions[1]?.clientAssetsDir).toBe(
      path.join(distributionRoot, "dist/client"),
    )
  })

  it("uses current source runtime artifacts with matching built admin assets in production", async () => {
    const projectRoot = await createGeneratedProject()
    const builtArtifactRoot = path.join(projectRoot, "dist/.voyant")
    await mkdir(builtArtifactRoot, { recursive: true })
    await writeFile(
      path.join(builtArtifactRoot, "deployment-graph.generated.json"),
      JSON.stringify({
        contentHash: "graph-hash",
        requirements: { resources: [] },
        provisioning: { scheduledJobs: [] },
      }),
    )
    await mkdir(path.join(projectRoot, "dist/client"), { recursive: true })

    const project = await loadVoyantProject({
      projectRoot,
      env: { DATABASE_URL: "postgres://example.invalid/voyant", NODE_ENV: "production" },
    })

    expect(project.graphHash).toBe("graph-hash")
    expect(mocks.adminHostOptions[0]?.clientAssetsDir).toBe(path.join(projectRoot, "dist/client"))
    expect(vi.mocked(tsImport).mock.calls[0]?.[0]).toContain(
      path.join(projectRoot, ".voyant/runtime/project-runtime.generated.ts"),
    )
  })

  it("does not serve built admin assets from a stale deployment graph", async () => {
    const projectRoot = await createGeneratedProject()
    const builtArtifactRoot = path.join(projectRoot, "dist/.voyant")
    await mkdir(builtArtifactRoot, { recursive: true })
    await writeFile(
      path.join(builtArtifactRoot, "deployment-graph.generated.json"),
      JSON.stringify({ contentHash: "stale-graph-hash" }),
    )
    await mkdir(path.join(projectRoot, "dist/client"), { recursive: true })

    await loadVoyantProject({
      projectRoot,
      env: { DATABASE_URL: "postgres://example.invalid/voyant", NODE_ENV: "production" },
    })

    expect(mocks.adminHostOptions[0]?.clientAssetsDir).toBe(
      path.join(projectRoot, ".voyant/admin/client"),
    )
  })

  it("rewrites persisted legacy media URLs before API dispatch", async () => {
    const projectRoot = await createGeneratedProject()
    const project = await loadVoyantProject({
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
    await loadVoyantProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    })

    expect(mocks.authRuntimeOptions[0]).toMatchObject({
      resolveEmailSender: expect.any(Function),
    })
  })

  it("ignores a catalog.indexer host override when search is none", async () => {
    const graph = configureSearchProviderRuntime("none", ["typesense"])
    const hostIndexer = createTestIndexerProvider("host")
    const projectRoot = await createGeneratedProject()

    const project = await loadVoyantProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
      host: { runtimePorts: { "catalog.indexer": hostIndexer } },
    })

    expect(project.runtimePorts["catalog.indexer"]).toBeUndefined()
    expect(graph.typesense!.importProvider).not.toHaveBeenCalled()
  })

  it.each([
    "typesense",
    "algolia",
    "postgres",
  ])("keeps selected %s search authoritative over a catalog.indexer host override", async (search) => {
    const graph = configureSearchProviderRuntime(search, [search])
    const hostIndexer = createTestIndexerProvider("host")
    const projectRoot = await createGeneratedProject()

    const project = await loadVoyantProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
      host: { runtimePorts: { "catalog.indexer": hostIndexer } },
    })

    expect(project.runtimePorts["catalog.indexer"]).toBe(graph[search]?.port)
    expect(graph[search]?.importProvider).toHaveBeenCalledOnce()
  })

  it("gives a custom catalog.indexer host port precedence over a graph custom provider", async () => {
    const graph = configureSearchProviderRuntime("custom", ["custom"])
    const hostIndexer = createTestIndexerProvider("host")
    const projectRoot = await createGeneratedProject()

    const project = await loadVoyantProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
      host: { runtimePorts: { "catalog.indexer": hostIndexer } },
    })

    expect(project.runtimePorts["catalog.indexer"]).toBe(hostIndexer)
    expect(graph.custom!.importProvider).not.toHaveBeenCalled()
  })

  it("rejects a selected search provider that is missing from the graph", async () => {
    const graph = configureSearchProviderRuntime("algolia", ["typesense"])
    const projectRoot = await createGeneratedProject()

    await expect(
      loadVoyantProject({
        projectRoot,
        adminAssetsDir: path.join(projectRoot, "admin"),
        env: { DATABASE_URL: "postgres://example.invalid/voyant" },
        host: { runtimePorts: { "catalog.indexer": createTestIndexerProvider("host") } },
      }),
    ).rejects.toThrow(/VOYANT_GRAPH_RUNTIME_PROVIDER_MISSING.*catalog\.indexer/s)
    expect(graph.typesense!.importProvider).not.toHaveBeenCalled()
    expect(mocks.loadVoyantNodeRuntime).not.toHaveBeenCalled()
  })

  it("rejects mismatched generated search authority before admitting a custom host port", async () => {
    const graph = configureSearchProviderRuntime("typesense", ["typesense"])
    mocks.deploymentProviders.search = "custom"
    const projectRoot = await createGeneratedProject()

    await expect(
      loadVoyantProject({
        projectRoot,
        adminAssetsDir: path.join(projectRoot, "admin"),
        env: { DATABASE_URL: "postgres://example.invalid/voyant" },
        host: { runtimePorts: { "catalog.indexer": createTestIndexerProvider("host") } },
      }),
    ).rejects.toThrow(
      /deployment\.providers\.search="custom".*providerSelections\.search="typesense"/,
    )
    expect(graph.typesense!.importProvider).not.toHaveBeenCalled()
    expect(mocks.loadVoyantNodeRuntime).not.toHaveBeenCalled()
  })

  it("uses the explicitly selected Postgres provider", async () => {
    const projectRoot = await createGeneratedProject()
    await loadVoyantProject({
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
    expect(mocks.createPostgresWebhookDeliveryEnqueuer).toHaveBeenCalledOnce()
    expect(mocks.postgresEnqueue).toHaveBeenCalledWith(event, bindings)
  })

  it("uses an explicitly selected host enqueuer", async () => {
    mocks.deploymentProviders = { outboundWebhooks: "host" }
    const deliverEvent = vi.fn(async () => ["hosted"])
    const projectRoot = await createGeneratedProject()
    await loadVoyantProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
      host: { deliverEvent },
    })

    const options = mocks.loadVoyantNodeRuntime.mock.calls[0]?.[0] as {
      outboundWebhooks: { enqueue(event: unknown, bindings: unknown): Promise<unknown> }
    }
    const event = { name: "catalog.entity.updated" }
    const bindings = { DATABASE_URL: "postgres://example.invalid/voyant" }
    await expect(options.outboundWebhooks.enqueue(event, bindings)).resolves.toEqual(["hosted"])
    expect(deliverEvent).toHaveBeenCalledWith(event, bindings)
    expect(mocks.createPostgresWebhookDeliveryEnqueuer).not.toHaveBeenCalled()
  })

  it("does not let a host callback override the explicitly selected Postgres provider", async () => {
    const deliverEvent = vi.fn(async () => ["hosted"])
    const projectRoot = await createGeneratedProject()
    await loadVoyantProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
      host: { deliverEvent },
    })

    const options = mocks.loadVoyantNodeRuntime.mock.calls[0]?.[0] as {
      outboundWebhooks: { enqueue(event: unknown, bindings: unknown): Promise<unknown> }
    }
    await expect(options.outboundWebhooks.enqueue({ name: "event" }, {})).resolves.toEqual([
      "queued",
    ])
    expect(mocks.createPostgresWebhookDeliveryEnqueuer).toHaveBeenCalledOnce()
    expect(deliverEvent).not.toHaveBeenCalled()
  })

  it("does not let Postgres credentials select outbound webhooks when the provider is none", async () => {
    mocks.deploymentProviders = { outboundWebhooks: "none" }
    const projectRoot = await createGeneratedProject()
    await loadVoyantProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    })

    const options = mocks.loadVoyantNodeRuntime.mock.calls[0]?.[0] as {
      outboundWebhooks?: unknown
    }
    expect(options.outboundWebhooks).toBeUndefined()
    expect(mocks.createPostgresWebhookDeliveryEnqueuer).not.toHaveBeenCalled()
  })

  it("rejects unsupported outbound webhook providers before server start", async () => {
    mocks.deploymentProviders = { outboundWebhooks: "external-queue" }
    const projectRoot = await createGeneratedProject()

    await expect(
      loadVoyantProject({
        projectRoot,
        adminAssetsDir: path.join(projectRoot, "admin"),
        env: { DATABASE_URL: "postgres://example.invalid/voyant" },
      }),
    ).rejects.toThrow(/outboundWebhooks=.*is not supported/)
    expect(mocks.loadVoyantNodeRuntime).not.toHaveBeenCalled()
  })

  it("rejects a missing outbound webhook provider before server start", async () => {
    mocks.deploymentProviders = {}
    const projectRoot = await createGeneratedProject()

    await expect(
      loadVoyantProject({
        projectRoot,
        adminAssetsDir: path.join(projectRoot, "admin"),
        env: { DATABASE_URL: "postgres://example.invalid/voyant" },
      }),
    ).rejects.toThrow(/outboundWebhooks must be explicitly selected/)
    expect(mocks.loadVoyantNodeRuntime).not.toHaveBeenCalled()
  })

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
      expect.objectContaining({ runtimePorts: mocks.runtimePorts }),
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

async function createGeneratedProject(
  scheduledJobs: readonly Readonly<Record<string, unknown>>[] = [],
  layout = ".voyant",
): Promise<string> {
  const projectRoot = await mkdtemp(path.join(tmpdir(), "voyant-runtime-"))
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

function configureSearchProviderRuntime(
  selection: string,
  declarations: readonly string[],
): Record<string, { importProvider: ReturnType<typeof vi.fn>; port: unknown }> {
  const configured: Record<string, { importProvider: ReturnType<typeof vi.fn>; port: unknown }> = {}
  const entries: Record<string, () => Promise<unknown>> = {}
  const references = declarations.map((value) => {
    const importEntry = `@acme/search-${value}/provider`
    const port = createTestIndexerProvider(`graph:${value}`)
    const createProvider = vi.fn(() => port)
    const importProvider = vi.fn(async () => ({ createProvider }))
    configured[value] = { importProvider, port }
    entries[importEntry] = importProvider
    return {
      id: `search-${value}-provider`,
      unitId: "@acme/search",
      facet: "providers.runtime" as const,
      entityId: `search.${value}`,
      runtime: { entry: "./provider", export: "createProvider" },
      importEntry,
    }
  })

  mocks.deploymentProviders.search = selection
  mocks.workflowGraphRuntime = {
    ...createVoyantGraphRuntime({
      graphHash: `sha256:search-${selection}`,
      providerSelections: { search: selection },
      entries,
      modules: [
        {
          id: "@acme/search",
          kind: "module",
          packageName: "@acme/search",
          order: 0,
          references,
          providers: declarations.map((value, index) => ({
            unitId: "@acme/search",
            declaration: {
              id: `search.${value}`,
              port: "catalog.indexer",
              selection: { role: "search", value },
              runtime: { entry: "./provider", export: "createProvider" },
            },
            referenceId: references[index]?.id ?? "",
          })),
          selectedIds: { routes: [], tools: [], workflows: [], events: [], webhooks: [] },
          routes: [],
        },
      ],
      plugins: [],
    }),
  }
  return configured
}

function createTestIndexerProvider(source: string) {
  return {
    create: vi.fn(() => ({
      capabilities: {
        supportsKeywordSearch: true,
        supportsHybridSearch: false,
        supportsVectorFields: false,
        vectorDimensions: null,
        maxVectorsPerDocument: null,
        supportsCrossAudienceFederation: false,
        supportsAdminDenormalization: false,
      },
      ensureCollection: vi.fn(async () => undefined),
      upsert: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
      search: vi.fn(async () => ({ hits: [], total: 0 })),
      bulkReindex: vi.fn(async () => undefined),
    })),
    source,
  }
}
