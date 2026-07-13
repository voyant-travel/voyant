import { access, readFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { serveAdminHost } from "@voyant-travel/admin-host/serve"
import { createOperatorAuthNodeRuntime } from "@voyant-travel/auth/operator-node-runtime"
import type { EventEnvelope, VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { resolveNodeDatabase } from "@voyant-travel/db/runtime"
import type { VoyantGraphRuntimePorts } from "@voyant-travel/framework"
import type { VoyantGraphDeploymentRequirements } from "@voyant-travel/framework/deployment-graph"
import {
  createVoyantNodeEnv,
  createVoyantNodeRuntimeHostPrimitives,
  createVoyantNodeWorkflowDriver,
  loadVoyantNodeRuntime,
  type VoyantNodeRuntime,
  type VoyantNodeRuntimeEnv,
} from "@voyant-travel/framework/node-runtime"
import { consoleReporter } from "@voyant-travel/hono/observability/reporter"
import { createNodeServer, type NodeServerHandle } from "@voyant-travel/runtime-core"
import { enqueuePostgresWebhookEvent } from "@voyant-travel/webhook-delivery/postgres"
import { mountWorkflowRunsAdminRoutes, WorkflowRunnerRegistry } from "@voyant-travel/workflow-runs"
import { tsImport } from "tsx/esm/api"

import { requireVoyantAuthEnv } from "./auth-env.js"
import { resolveVoyantCloudAuthEmailSender } from "./cloud-auth-email.js"
import { createVoyantDeploymentResources } from "./deployment-resources.js"

export {
  type CreateVoyantDeploymentResourcesOptions,
  createVoyantDeploymentResources,
  type VoyantDeploymentResources,
} from "./deployment-resources.js"

const GENERATED_ARTIFACT_LAYOUTS = [".voyant", "dist/.voyant"] as const
const PROJECT_RUNTIME_ENTRY = "runtime/project-runtime.generated.ts"
const GRAPH_RUNTIME_ENTRY = "runtime/graph-runtime.generated.ts"
const PROJECT_LINKS_ENTRY = "runtime/project-links.generated.ts"
const PROJECT_GRAPH_ENTRY = "deployment-graph.generated.json"

export interface LoadVoyantProjectOptions {
  projectRoot?: string
  env?: Record<string, string | undefined>
  adminAssetsDir?: string
  preferBuiltAdminAssets?: boolean
  host?: {
    config?: Readonly<Record<string, unknown>>
    deliverEvent?: (event: unknown, bindings: unknown) => Promise<unknown>
  }
}

export interface VoyantProjectHost {
  projectRoot: string
  graphHash: string
  runtime: VoyantNodeRuntime
  runtimePorts: VoyantGraphRuntimePorts
  auth: VoyantProjectAuth
  fetch(request: Request): Response | Promise<Response>
  start(options?: { port?: number }): NodeServerHandle
}

export interface VoyantProjectAuth {
  getBootstrapStatusForRequest(request: Request, env: VoyantNodeRuntimeEnv): Promise<unknown>
  getCurrentUserForRequest(request: Request, env: VoyantNodeRuntimeEnv): Promise<unknown>
}

interface GeneratedProjectRuntime {
  kind: "application"
  graphHash: string
  deployment: {
    mode?: "local" | "managed-cloud" | "self-hosted"
    providers: Record<string, string>
  }
  graphRuntime: import("@voyant-travel/framework").VoyantGraphRuntime
  createRuntimePorts(host: {
    primitives: VoyantRuntimeHostPrimitives
  }): import("@voyant-travel/framework").VoyantGraphRuntimePorts
}

interface GeneratedProjectLinks {
  projectLinks?: readonly import("@voyant-travel/core").LinkDefinition[]
}

/** Load the generated graph and create the framework-owned Node/admin host. */
export async function loadVoyantProject(
  options: LoadVoyantProjectOptions = {},
): Promise<VoyantProjectHost> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd())
  const artifactRoot = await resolveGeneratedArtifactRoot(projectRoot)
  const generated = await loadGeneratedProjectRuntime(artifactRoot)
  const graph = await readGeneratedDeploymentGraph(artifactRoot, generated)
  const env = createVoyantNodeEnv(options.env ?? process.env)
  const workflowRunnerRegistry = new WorkflowRunnerRegistry()
  const primitives = createVoyantNodeRuntimeHostPrimitives({
    env,
    ...options.host,
    deliverEvent:
      options.host?.deliverEvent ??
      ((event, bindings) =>
        enqueuePostgresWebhookEvent(
          resolveNodeDatabase(bindings as Parameters<typeof resolveNodeDatabase>[0]) as Parameters<
            typeof enqueuePostgresWebhookEvent
          >[0],
          event as EventEnvelope,
        )),
  })
  const deploymentResources = createVoyantDeploymentResources({
    primitives,
    createRuntimePorts: generated.createRuntimePorts,
  })
  const projectLinks = await loadGeneratedProjectLinks(artifactRoot)
  const authRuntime = createOperatorAuthNodeRuntime({
    accessCatalog: generated.graphRuntime.accessCatalog,
    appName: path.basename(projectRoot),
    reporter: consoleReporter(),
    resolveEmailSender: resolveVoyantCloudAuthEmailSender,
  })
  const runtime = await loadVoyantNodeRuntime({
    applicationId: path.basename(projectRoot),
    graphRuntime: generated.graphRuntime,
    deployment: {
      mode: generated.deployment.mode ?? "self-hosted",
      providers: generated.deployment.providers,
    },
    deploymentRequirements: graph.requirements,
    runtimePorts: deploymentResources.ports,
    resources: deploymentResources.capabilities,
    outboundWebhooks: deploymentResources.outboundWebhooks,
    env,
    app: {
      linkDefinitions: projectLinks,
      auth: {
        handler: () => ({
          fetch: (request, requestEnv, ctx) =>
            authRuntime.handler.fetch(
              request,
              requireVoyantAuthEnv(requestEnv),
              toExecutionContext(ctx),
            ),
        }),
        resolve: ({ request, env: requestEnv }) =>
          authRuntime.resolveAuthRequest(request, requireVoyantAuthEnv(requestEnv)),
        hasPermission: ({ request, env: requestEnv }) =>
          authRuntime.hasAuthPermission(request, requireVoyantAuthEnv(requestEnv)),
        validateApiKey: ({ env: requestEnv, db, apiKey }) =>
          authRuntime.validateApiTokenAccess(requireVoyantAuthEnv(requestEnv), db, apiKey),
      },
      additionalRoutes: (app) => {
        mountWorkflowRunsAdminRoutes(app, {
          runners: workflowRunnerRegistry,
          resolveUserId: (context) => {
            const userId = (context as { get(key: string): unknown }).get("userId")
            return typeof userId === "string" ? userId : null
          },
        })
      },
    },
  })
  const clientAssetsDir = await resolveAdminAssetsDir(
    projectRoot,
    artifactRoot,
    options.adminAssetsDir,
    options.preferBuiltAdminAssets ??
      (options.env?.NODE_ENV ?? process.env.NODE_ENV) === "production",
  )
  const web = serveAdminHost<VoyantNodeRuntimeEnv>({
    clientAssetsDir,
    app: async (request, bindings, ctx) => {
      if (new URL(request.url).pathname.startsWith("/api")) {
        return runtime.app.fetch(rewriteLegacyMediaRequest(request), bindings, ctx)
      }
      const { createAdminSsrHandler } = await import("@voyant-travel/admin-host/ssr")
      return createAdminSsrHandler<VoyantNodeRuntimeEnv>()(request, bindings, ctx)
    },
  })

  const fetch = (request: Request) =>
    web.fetch(request, runtime.env, toExecutionContext(createNoopContext()))

  return {
    projectRoot,
    graphHash: generated.graphHash,
    runtime,
    runtimePorts: deploymentResources.ports,
    auth: {
      getBootstrapStatusForRequest: (request, requestEnv) =>
        authRuntime.getBootstrapStatusForRequest(request, requireVoyantAuthEnv(requestEnv)),
      getCurrentUserForRequest: (request, requestEnv) =>
        authRuntime.getCurrentUserForRequest(request, requireVoyantAuthEnv(requestEnv)),
    },
    fetch,
    start: ({ port } = {}) =>
      createNodeServer<VoyantNodeRuntimeEnv>({
        fetch: (request, env, ctx) => web.fetch(request, env, toExecutionContext(ctx)),
        scheduled: (event, bindings, ctx) =>
          dispatchScheduledProjectJob({
            event,
            bindings,
            ctx,
            graph,
            projectRoot,
            artifactRoot,
            runtime,
            runtimePorts: deploymentResources.ports,
          }),
        env: runtime.env,
        port,
        ...(runtime.env.ORIGIN_TRUST_SECRET
          ? { originTrustSecret: runtime.env.ORIGIN_TRUST_SECRET }
          : {}),
      }),
  }
}

/** Generic TanStack Start server entry used by a project-owned one-line bootstrap. */
export function createVoyantProjectServerEntry(options: LoadVoyantProjectOptions = {}) {
  let host: Promise<VoyantProjectHost> | undefined
  const load = () => (host ??= loadVoyantProject(options))
  return {
    fetch: (request: Request) => load().then((project) => project.fetch(request)),
    start: async (startOptions: { port?: number } = {}) => (await load()).start(startOptions),
  }
}

export async function startVoyantProject(
  options: LoadVoyantProjectOptions & { port?: number } = {},
): Promise<NodeServerHandle> {
  const host = await loadVoyantProject(options)
  return host.start({ port: options.port })
}

async function resolveGeneratedArtifactRoot(projectRoot: string): Promise<string> {
  for (const layout of GENERATED_ARTIFACT_LAYOUTS) {
    const artifactRoot = path.join(projectRoot, layout)
    if (
      (await pathExists(path.join(artifactRoot, PROJECT_GRAPH_ENTRY))) &&
      ((await pathExists(path.join(artifactRoot, PROJECT_RUNTIME_ENTRY))) ||
        (await pathExists(path.join(artifactRoot, GRAPH_RUNTIME_ENTRY))))
    ) {
      return artifactRoot
    }
  }
  throw new Error(
    `Generated Voyant project artifacts were not found under ${GENERATED_ARTIFACT_LAYOUTS.join(" or ")}. Run voyant build first.`,
  )
}

async function loadGeneratedProjectRuntime(artifactRoot: string): Promise<GeneratedProjectRuntime> {
  const entry = path.join(artifactRoot, PROJECT_RUNTIME_ENTRY)
  let generated: GeneratedProjectRuntime
  if (await pathExists(entry)) {
    const namespace = (await tsImport(pathToFileURL(entry).href, {
      parentURL: import.meta.url,
    })) as { createGeneratedProjectRuntime?: () => GeneratedProjectRuntime }
    if (typeof namespace.createGeneratedProjectRuntime !== "function") {
      throw new Error(`${PROJECT_RUNTIME_ENTRY} does not export createGeneratedProjectRuntime().`)
    }
    generated = namespace.createGeneratedProjectRuntime()
  } else {
    generated = await loadDeploymentGraphRuntime(artifactRoot)
  }
  if (generated.kind !== "application") {
    throw new Error(`${PROJECT_RUNTIME_ENTRY} is not a Voyant application runtime.`)
  }
  if (typeof generated.createRuntimePorts !== "function") {
    throw new Error(`${PROJECT_RUNTIME_ENTRY} does not expose static runtime port composition.`)
  }
  return generated
}

async function loadDeploymentGraphRuntime(artifactRoot: string): Promise<GeneratedProjectRuntime> {
  const entry = path.join(artifactRoot, GRAPH_RUNTIME_ENTRY)
  const namespace = (await tsImport(pathToFileURL(entry).href, {
    parentURL: import.meta.url,
  })) as {
    GENERATED_GRAPH_RUNTIME_HASH?: string
    createGeneratedGraphRuntime?: () => GeneratedProjectRuntime["graphRuntime"]
    createGeneratedGraphRuntimePorts?: GeneratedProjectRuntime["createRuntimePorts"]
  }
  const graph = JSON.parse(
    await readFile(path.join(artifactRoot, PROJECT_GRAPH_ENTRY), "utf8"),
  ) as {
    deployment?: { mode?: GeneratedProjectRuntime["deployment"]["mode"]; providers?: unknown }
  }
  if (
    typeof namespace.GENERATED_GRAPH_RUNTIME_HASH !== "string" ||
    typeof namespace.createGeneratedGraphRuntime !== "function" ||
    typeof namespace.createGeneratedGraphRuntimePorts !== "function" ||
    !graph.deployment ||
    !graph.deployment.providers ||
    typeof graph.deployment.providers !== "object"
  ) {
    throw new Error("Generated deployment graph runtime is missing or invalid.")
  }
  return {
    kind: "application",
    graphHash: namespace.GENERATED_GRAPH_RUNTIME_HASH,
    deployment: {
      mode: graph.deployment.mode,
      providers: graph.deployment.providers as Record<string, string>,
    },
    graphRuntime: namespace.createGeneratedGraphRuntime(),
    createRuntimePorts: namespace.createGeneratedGraphRuntimePorts,
  }
}

async function readGeneratedDeploymentGraph(
  artifactRoot: string,
  runtime: GeneratedProjectRuntime,
): Promise<{
  requirements: VoyantGraphDeploymentRequirements
  scheduledJobs: readonly GeneratedScheduledJob[]
}> {
  const graph = JSON.parse(
    await readFile(path.join(artifactRoot, PROJECT_GRAPH_ENTRY), "utf8"),
  ) as {
    contentHash?: unknown
    requirements?: unknown
    provisioning?: { scheduledJobs?: unknown }
  }
  if (graph.contentHash !== runtime.graphHash) {
    throw new Error("Generated project runtime and deployment graph hashes do not match.")
  }
  if (
    !graph.requirements ||
    typeof graph.requirements !== "object" ||
    !("resources" in graph.requirements) ||
    !Array.isArray(graph.requirements.resources)
  ) {
    throw new Error("Generated deployment graph requirements are missing or invalid.")
  }
  return {
    requirements: graph.requirements as VoyantGraphDeploymentRequirements,
    scheduledJobs: Array.isArray(graph.provisioning?.scheduledJobs)
      ? (graph.provisioning.scheduledJobs as GeneratedScheduledJob[])
      : [],
  }
}

interface GeneratedScheduledJob {
  id: string
  cron: string
  workflowId?: string
}

async function loadGeneratedProjectLinks(artifactRoot: string) {
  const entry = path.join(artifactRoot, PROJECT_LINKS_ENTRY)
  try {
    const namespace = (await tsImport(pathToFileURL(entry).href, {
      parentURL: import.meta.url,
    })) as GeneratedProjectLinks
    return namespace.projectLinks ?? []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
}

async function resolveAdminAssetsDir(
  projectRoot: string,
  artifactRoot: string,
  explicit?: string,
  preferBuiltAssets = false,
): Promise<string> {
  if (explicit) return path.resolve(explicit)
  const sourceArtifactRoot = path.join(projectRoot, ".voyant")
  const builtArtifactRoot = path.join(projectRoot, "dist/.voyant")
  const builtClientDir = path.join(projectRoot, "dist/client")
  if (artifactRoot === builtArtifactRoot) return builtClientDir
  if (
    preferBuiltAssets &&
    artifactRoot === sourceArtifactRoot &&
    (await pathExists(builtClientDir)) &&
    (await generatedArtifactGraphsMatch(sourceArtifactRoot, builtArtifactRoot))
  ) {
    return builtClientDir
  }
  return path.join(artifactRoot, "admin/client")
}

async function generatedArtifactGraphsMatch(
  sourceArtifactRoot: string,
  builtArtifactRoot: string,
): Promise<boolean> {
  const [sourceHash, builtHash] = await Promise.all([
    readGeneratedArtifactGraphHash(sourceArtifactRoot),
    readGeneratedArtifactGraphHash(builtArtifactRoot),
  ])
  return sourceHash !== undefined && sourceHash === builtHash
}

async function readGeneratedArtifactGraphHash(artifactRoot: string): Promise<string | undefined> {
  try {
    const graph = JSON.parse(
      await readFile(path.join(artifactRoot, PROJECT_GRAPH_ENTRY), "utf8"),
    ) as { contentHash?: unknown }
    return typeof graph.contentHash === "string" ? graph.contentHash : undefined
  } catch {
    return undefined
  }
}

function rewriteLegacyMediaRequest(request: Request): Request {
  const url = new URL(request.url)
  if (!url.pathname.startsWith("/api/v1/media/")) return request
  url.pathname = url.pathname.replace("/api/v1/media/", "/api/v1/admin/media/")
  return new Request(url, request)
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await access(candidate)
    return true
  } catch {
    return false
  }
}

async function dispatchScheduledProjectJob(input: {
  event: { cron?: string; scheduledTime: number; scheduleId?: string }
  bindings: VoyantNodeRuntimeEnv
  ctx: import("@voyant-travel/runtime-core").ExecutionContextLike
  graph: { scheduledJobs: readonly GeneratedScheduledJob[] }
  projectRoot: string
  artifactRoot: string
  runtime: VoyantNodeRuntime
  runtimePorts: VoyantGraphRuntimePorts
}): Promise<void> {
  const job = input.graph.scheduledJobs.find(
    (candidate) =>
      candidate.id === input.event.scheduleId ||
      (!input.event.scheduleId && candidate.cron === input.event.cron),
  )
  if (!job?.workflowId) return
  const { runScheduledWorkflow, isGraphWorkflowScheduledJob } = await import(
    "@voyant-travel/workflow-runs/scheduled-workflow"
  )
  if (!isGraphWorkflowScheduledJob(job)) {
    throw new Error(`Invalid generated workflow schedule ${job.id}`)
  }
  const workflowRuntime = await loadVoyantProjectWorkflowRuntime({
    projectRoot: input.projectRoot,
    artifactRoot: input.artifactRoot,
    runtime: input.runtime,
    runtimePorts: input.runtimePorts,
  })
  await runScheduledWorkflow(
    job,
    { scheduledTime: input.event.scheduledTime },
    {
      projectId: input.bindings.VOYANT_CLOUD_APP_SLUG ?? path.basename(input.projectRoot),
      environment: input.bindings.VOYANT_CLOUD_ENVIRONMENT ?? "development",
      load: async () => workflowRuntime,
      createDriver: (dependencies) =>
        createVoyantNodeWorkflowDriver(
          input.bindings,
          path.basename(input.projectRoot),
        )(dependencies),
    },
  )
}

export async function loadVoyantProjectWorkflowRuntime(
  options: {
    projectRoot?: string
    artifactRoot?: string
    runtime?: VoyantNodeRuntime
    runtimePorts?: VoyantGraphRuntimePorts
  } = {},
) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd())
  const host =
    options.runtime && options.runtimePorts ? undefined : await loadVoyantProject({ projectRoot })
  const runtime = options.runtime ?? host?.runtime
  const runtimePorts = options.runtimePorts ?? host?.runtimePorts
  if (!runtime || !runtimePorts) {
    throw new Error("The workflow runtime requires the resident runtime and graph ports.")
  }
  const artifactRoot = options.artifactRoot ?? (await resolveGeneratedArtifactRoot(projectRoot))
  const entry = path.join(artifactRoot, "runtime/project-package-workflows.generated.ts")
  const generated = (await tsImport(pathToFileURL(entry).href, {
    parentURL: import.meta.url,
  })) as { createGeneratedWorkflowRuntime(): import("@voyant-travel/framework").VoyantGraphRuntime }
  const { loadVoyantNodeWorkflowRuntime } = await import("@voyant-travel/framework/node-host")
  return loadVoyantNodeWorkflowRuntime({
    graphRuntime: generated.createGeneratedWorkflowRuntime(),
    environment: runtime.env,
    runtimePorts,
    createServices: async () => {
      await runtime.app.ready(runtime.env)
      return {
        services: runtime.app.services,
        eventBus: runtime.app.eventBus,
      }
    },
  })
}

function createNoopContext(): import("@voyant-travel/runtime-core").ExecutionContextLike {
  return { waitUntil: () => undefined }
}

let defaultProject: Promise<VoyantProjectHost> | undefined

function loadDefaultProject(): Promise<VoyantProjectHost> {
  if (!defaultProject) defaultProject = loadVoyantProject()
  return defaultProject
}

export async function getVoyantProjectBootstrapStatus(request: Request, env: VoyantNodeRuntimeEnv) {
  return (await loadDefaultProject()).auth.getBootstrapStatusForRequest(request, env)
}

export async function getVoyantProjectCurrentUser(request: Request, env: VoyantNodeRuntimeEnv) {
  return (await loadDefaultProject()).auth.getCurrentUserForRequest(request, env)
}

function toExecutionContext(
  ctx?:
    | import("@voyant-travel/runtime-core").ExecutionContextLike
    | import("@voyant-travel/hono").VoyantExecutionContext,
): import("hono").ExecutionContext {
  return {
    waitUntil: (promise) => ctx?.waitUntil?.(promise),
    passThroughOnException: () => ctx?.passThroughOnException?.(),
    props: undefined,
  }
}
