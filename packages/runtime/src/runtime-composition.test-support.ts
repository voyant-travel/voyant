import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createVoyantGraphRuntime } from "@voyant-travel/framework/deployment-artifacts"
import { afterEach, beforeEach, type Mock, vi } from "vitest"

interface RuntimeCompositionMocks {
  adminHostOptions: Array<{
    clientAssetsDir: string
    app(request: Request, env: unknown, ctx: unknown): Promise<Response>
  }>
  authRuntimeOptions: Array<Record<string, unknown>>
  createNodeServer: Mock
  postgresEnqueue: Mock
  appEnqueue: Mock
  createAppWebhookDeliveryEnqueuer: Mock
  createAppWebhookDeliveryWorker: Mock
  createAppWebhookDeliveryLoop: Mock
  appWebhookDeliveryWorker: { drain: Mock; runNext: Mock }
  appWebhookDeliveryLoop: { poll: Mock; start: Mock; stop: Mock }
  createPostgresWebhookDeliveryEnqueuer: Mock
  deploymentProviders: Record<string, string>
  loadVoyantNodeRuntime: Mock
  loadVoyantNodeWorkflowRuntime: Mock
  nodeRuntime: {
    env: { DATABASE_URL: string }
    deployment: { mode: string; providers: Record<string, string> }
    app: {
      ready: Mock
      fetch: Mock<(request: Request) => Promise<Response>>
      services: { has: Mock; register: Mock; resolve: Mock }
      eventBus: { emit: Mock; subscribe: Mock }
    }
  }
  resolveNodeDatabase: Mock
  runtimePortHosts: Array<{
    primitives: unknown
    runtimePorts?: Readonly<Record<string, unknown>>
  }>
  runtimeFetch: Mock<(request: Request) => Promise<Response>>
  tsImport: Mock<(url: string) => Promise<unknown>>
  createVoyantNodeWorkflowDriver: Mock
  runScheduledWorkflow: Mock
  runtimePorts: Record<string, unknown>
  workflowGraphRuntime: Record<string, unknown>
}

const mocks: RuntimeCompositionMocks = vi.hoisted(() => {
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
    createNodeServer: vi.fn(
      (options: { residentServices?: Array<{ start(): void; stop(): void | Promise<void> }> }) => {
        for (const service of options.residentServices ?? []) service.start()
        return {
          close: vi.fn(async () => {
            await Promise.all((options.residentServices ?? []).map((service) => service.stop()))
          }),
          port: 8080,
        }
      },
    ),
    postgresEnqueue: vi.fn(async () => ["queued"]),
    appEnqueue: vi.fn(async () => ["app-queued"]),
    createAppWebhookDeliveryEnqueuer: vi.fn(),
    createAppWebhookDeliveryWorker: vi.fn(),
    createAppWebhookDeliveryLoop: vi.fn(),
    appWebhookDeliveryWorker: { drain: vi.fn(), runNext: vi.fn() },
    appWebhookDeliveryLoop: { poll: vi.fn(), start: vi.fn(), stop: vi.fn() },
    createPostgresWebhookDeliveryEnqueuer: vi.fn(),
    deploymentProviders: {
      adminAuth: "better-auth",
      customerAuth: "better-auth",
      outboundWebhooks: "postgres",
    } as Record<string, string>,
    loadVoyantNodeRuntime: vi.fn(async (_options: unknown) => nodeRuntime),
    loadVoyantNodeWorkflowRuntime: vi.fn(async (_options: unknown) => ({ workflows: [] })),
    nodeRuntime,
    resolveNodeDatabase: vi.fn(() => ({ kind: "database" })),
    runtimePortHosts: [] as Array<{
      primitives: unknown
      runtimePorts?: Readonly<Record<string, unknown>>
    }>,
    runtimeFetch,
    tsImport: vi.fn(),
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

export function getRuntimeCompositionMocks(): RuntimeCompositionMocks {
  return mocks
}

vi.mock("@voyant-travel/admin-host/serve", () => ({
  serveAdminHost: (options: (typeof mocks.adminHostOptions)[number]) => {
    mocks.adminHostOptions.push(options)
    return {
      fetch: (request: Request, env: unknown, ctx: unknown) => options.app(request, env, ctx),
    }
  },
}))

vi.mock("@voyant-travel/apps", () => ({
  appsWebhookDeliveryRuntimePort: {
    id: "apps.webhook-delivery",
    test: (runtime: { resolveSigningKey?: unknown }) => {
      if (typeof runtime?.resolveSigningKey !== "function") throw new Error("invalid app runtime")
    },
  },
  createAppWebhookDeliveryEnqueuer: mocks.createAppWebhookDeliveryEnqueuer,
  createAppWebhookDeliveryWorker: mocks.createAppWebhookDeliveryWorker,
}))

vi.mock("./app-webhook-delivery-loop.js", () => ({
  createAppWebhookDeliveryLoop: mocks.createAppWebhookDeliveryLoop,
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

vi.mock("./deployment-resources.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./deployment-resources.js")>()
  return {
    ...actual,
    resolveSelectedGraphProviderPorts: async (
      ...args: Parameters<typeof actual.resolveSelectedGraphProviderPorts>
    ) => {
      const resolved = await actual.resolveSelectedGraphProviderPorts(...args)
      if (args[2]?.excludedPorts?.includes("storage.object")) return resolved
      return { "storage.object": { resolve: () => null }, ...resolved }
    },
  }
})

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
  tsImport: mocks.tsImport,
}))

mocks.tsImport.mockImplementation(async (url: string) => {
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
})

type RuntimeModule = typeof import("./index.js")

export async function loadVoyantProject(
  ...args: Parameters<RuntimeModule["loadVoyantProject"]>
): ReturnType<RuntimeModule["loadVoyantProject"]> {
  const runtime = await import("./index.js")
  const [options = {}] = args
  return runtime.loadVoyantProject({
    ...options,
    env: {
      BETTER_AUTH_ADMIN_SECRET: "admin-auth-secret-with-at-least-32-characters",
      BETTER_AUTH_CUSTOMER_SECRET: "customer-auth-secret-with-at-least-32-characters",
      SESSION_CLAIMS_ADMIN_SECRET: "admin-claims-secret-with-at-least-32-characters",
      SESSION_CLAIMS_CUSTOMER_SECRET: "customer-claims-secret-with-at-least-32-characters",
      VOYANT_CLOUD_DEPLOYMENT_ID: "dpl_test",
      VOYANT_CLOUD_ADMIN_AUTH_START_URL: "https://cloud.example/auth/start",
      VOYANT_CLOUD_ADMIN_AUTH_EXCHANGE_URL: "https://cloud.example/auth/exchange",
      VOYANT_CLOUD_ADMIN_AUTH_JWKS_URL: "https://cloud.example/.well-known/jwks.json",
      VOYANT_CLOUD_ADMIN_AUTH_REVALIDATE_URL: "https://cloud.example/auth/revalidate",
      VOYANT_CLOUD_ADMIN_AUTH_CLIENT_TOKEN: "client-token",
      ...options.env,
    },
  })
}

export async function loadVoyantProjectWorkflowRuntime(
  ...args: Parameters<RuntimeModule["loadVoyantProjectWorkflowRuntime"]>
): ReturnType<RuntimeModule["loadVoyantProjectWorkflowRuntime"]> {
  const runtime = await import("./index.js")
  return runtime.loadVoyantProjectWorkflowRuntime(...args)
}

const temporaryRoots: string[] = []

beforeEach(() => {
  vi.clearAllMocks()
  mocks.adminHostOptions.length = 0
  mocks.authRuntimeOptions.length = 0
  mocks.runtimePortHosts.length = 0
  mocks.nodeRuntime.deployment.providers.workflows = "self-hosted"
  mocks.deploymentProviders = {
    adminAuth: "better-auth",
    customerAuth: "better-auth",
    workflows: "self-hosted",
    outboundWebhooks: "postgres",
  }
  mocks.workflowGraphRuntime = {
    modules: [],
    extensions: [],
    plugins: [],
    accessCatalog: { resources: [] },
  }
  mocks.createPostgresWebhookDeliveryEnqueuer.mockReturnValue({
    enqueue: mocks.postgresEnqueue,
  })
  mocks.createAppWebhookDeliveryEnqueuer.mockReturnValue({ enqueue: mocks.appEnqueue })
  mocks.createAppWebhookDeliveryWorker.mockReturnValue(mocks.appWebhookDeliveryWorker)
  mocks.createAppWebhookDeliveryLoop.mockReturnValue(mocks.appWebhookDeliveryLoop)
})

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })))
})

export async function createGeneratedProject(
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

export function configureSearchProviderRuntime(
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

export function createTestIndexerProvider(source: string) {
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
