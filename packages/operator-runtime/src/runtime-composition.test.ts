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
  const nodeRuntime = {
    env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    app: { ready: vi.fn(), services, eventBus },
  }

  return {
    enqueuePostgresWebhookEvent: vi.fn(async () => ["queued"]),
    loadVoyantNodeRuntime: vi.fn(async (_options: unknown) => nodeRuntime),
    loadVoyantNodeWorkflowRuntime: vi.fn(async (_options: unknown) => ({ workflows: [] })),
    nodeRuntime,
    resolveNodeDatabase: vi.fn(() => ({ kind: "database" })),
    runtimePorts,
    workflowGraphRuntime,
  }
})

vi.mock("@voyant-travel/admin-host/serve", () => ({
  serveAdminHost: () => ({ fetch: vi.fn(async () => new Response("ok")) }),
}))

vi.mock("@voyant-travel/auth/operator-node-runtime", () => ({
  createOperatorAuthNodeRuntime: () => ({
    handler: vi.fn(),
    getBootstrapStatusForRequest: vi.fn(),
    getCurrentUserForRequest: vi.fn(),
    hasAuthPermission: vi.fn(),
    resolveAuthRequest: vi.fn(),
    validateApiTokenAccess: vi.fn(),
  }),
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
  createNodeServer: vi.fn(),
}))

vi.mock("@voyant-travel/webhook-delivery/postgres", () => ({
  enqueuePostgresWebhookEvent: mocks.enqueuePostgresWebhookEvent,
}))

vi.mock("@voyant-travel/workflow-runs", () => ({
  mountWorkflowRunsAdminRoutes: vi.fn(),
  WorkflowRunnerRegistry: class {},
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
})

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })))
})

describe("Operator runtime composition", () => {
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
})

async function createGeneratedProject(): Promise<string> {
  const projectRoot = await mkdtemp(path.join(tmpdir(), "voyant-operator-runtime-"))
  temporaryRoots.push(projectRoot)
  const runtimeDir = path.join(projectRoot, ".voyant", "runtime")
  await mkdir(runtimeDir, { recursive: true })
  await writeFile(path.join(runtimeDir, "project-runtime.generated.ts"), "export {}\n")
  await writeFile(
    path.join(projectRoot, ".voyant", "deployment-graph.generated.json"),
    JSON.stringify({
      contentHash: "graph-hash",
      requirements: { resources: [] },
      provisioning: { scheduledJobs: [] },
    }),
  )
  return projectRoot
}
