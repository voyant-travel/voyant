import path from "node:path"
import { pathToFileURL } from "node:url"

import { serveAdminHost } from "@voyant-travel/admin-host/serve"
import {
  type AppsWebhookDeliveryRuntime,
  appsWebhookDeliveryRuntimePort,
  createAppWebhookDeliveryEnqueuer,
} from "@voyant-travel/apps"
import {
  type CustomerBusinessAccountOnboardingRuntimeProvider,
  customerBusinessAccountOnboardingRuntimePort,
} from "@voyant-travel/auth/customer-business-onboarding-runtime-port"
import {
  type CustomerAuthRuntimeContext,
  createOperatorAuthNodeRuntime,
  type OperatorAuthEmailSender,
  type OperatorAuthNodeEnv,
} from "@voyant-travel/auth/node-runtime"
import type { EventEnvelope } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { resolveNodeDatabase } from "@voyant-travel/db/runtime"
import type { VoyantGraphRuntimePorts } from "@voyant-travel/framework"
import {
  createVoyantNodeEnv,
  createVoyantNodeRuntimeHostPrimitives,
  createVoyantNodeWorkflowDriver,
  loadVoyantNodeRuntime,
  resolveVoyantNodeProviderPlan,
  resolveVoyantNodeWorkflowProvider,
  type VoyantNodeRuntime,
  type VoyantNodeRuntimeEnv,
  validateVoyantNodeProviderPlanEnv,
} from "@voyant-travel/framework/node-runtime"
import { consoleReporter } from "@voyant-travel/hono/observability/reporter"
import { createNodeServer, type NodeServerHandle } from "@voyant-travel/runtime-core"
import type { StorageProviderResolver } from "@voyant-travel/storage/types"
import { resolveOutboundWebhookDeliveryEnqueuer } from "@voyant-travel/webhook-delivery"
import { createPostgresWebhookDeliveryEnqueuer } from "@voyant-travel/webhook-delivery/postgres"
import { tsImport } from "tsx/esm/api"

import { requireVoyantAuthEnv } from "./auth-env.js"
import { resolveVoyantCloudAuthEmailSender } from "./cloud-auth-email.js"
import {
  resolveAdmittedHostRuntimePorts as admitHostPorts,
  createVoyantDeploymentResources,
  resolveSelectedGraphProviderPorts,
} from "./deployment-resources.js"
import { resolveLocalStorageDir, withFilesystemPersistence } from "./filesystem-storage.js"
import {
  type GeneratedScheduledJob,
  loadGeneratedProjectLinks,
  loadGeneratedProjectRuntime,
  readGeneratedDeploymentGraph,
  resolveAdminAssetsDir,
  resolveGeneratedArtifactRoot,
} from "./project-artifacts.js"
import { loadBuiltProjectStart, startVoyantProjectWithDependencies } from "./project-start.js"
import { resolveCustomStorageResolver } from "./storage-resolver.js"

export {
  type CreateVoyantDeploymentResourcesOptions,
  createVoyantDeploymentResources,
  resolveSelectedGraphProviderPorts,
  type VoyantDeploymentResources,
} from "./deployment-resources.js"
export { resolveVoyantCloudAuthEmailSender }

export interface LoadVoyantProjectOptions {
  projectRoot?: string
  env?: Record<string, string | undefined>
  adminAssetsDir?: string
  preferBuiltAdminAssets?: boolean
  host?: {
    config?: Readonly<Record<string, unknown>>
    deliverEvent?: (event: unknown, bindings: unknown) => Promise<unknown>
    /** Project-owned provider overrides keyed by their published runtime-port id. */
    runtimePorts?: VoyantGraphRuntimePorts
    storage?: StorageProviderResolver
    /** Resolve a canonical storefront auth origin and server-side provider credentials. */
    resolveCustomerAuthContext?: (
      env: OperatorAuthNodeEnv,
      request: Request,
    ) => CustomerAuthRuntimeContext | Promise<CustomerAuthRuntimeContext>
    /**
     * Authorize a customer-realm cross-origin request for dynamic CORS. Returns
     * the exact request origin to echo, or `null` for static-allowlist fallback.
     */
    resolveCustomerCorsOrigin?: (
      env: OperatorAuthNodeEnv,
      request: Request,
    ) => Promise<string | null>
    /** Project-owned transport for verification codes and password resets. */
    resolveAuthEmailSender?: (env: OperatorAuthNodeEnv) => OperatorAuthEmailSender | null
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

/** Load the generated graph and create the framework-owned Node/admin host. */
export async function loadVoyantProject(
  options: LoadVoyantProjectOptions = {},
): Promise<VoyantProjectHost> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd())
  const artifactRoot = await resolveGeneratedArtifactRoot(projectRoot)
  const generated = await loadGeneratedProjectRuntime(artifactRoot)
  const graph = await readGeneratedDeploymentGraph(artifactRoot, generated)
  const adminAuthProvider = generated.deployment.providers.adminAuth
  const customerAuthProvider = selectedCustomerAuthProvider(
    generated.deployment.providers.customerAuth,
  )
  const authMode = selectedOperatorAuthMode(adminAuthProvider)
  const providerPlan = resolveVoyantNodeProviderPlan(generated.deployment.providers)
  const rawEnv = Object.fromEntries(Object.entries(options.env ?? process.env))
  const providerIssues = validateVoyantNodeProviderPlanEnv(providerPlan, rawEnv)
  if (providerIssues.length > 0) {
    throw new Error(
      `Voyant Node provider plan is not ready:\n${providerIssues.map((issue) => `- ${issue}`).join("\n")}`,
    )
  }
  const env = createVoyantNodeEnv(rawEnv, providerPlan)
  const authEnv = requireVoyantAuthEnv(env, authMode, customerAuthProvider)
  const explicitRuntimePorts = admitHostPorts(options.host?.runtimePorts ?? {}, generated)
  const selectedProviderPorts = await resolveSelectedGraphProviderPorts(
    generated.graphRuntime,
    rawEnv,
    {
      excludedPorts: [
        ...Object.keys(explicitRuntimePorts),
        ...(providerPlan.storage === "custom" && options.host?.storage ? ["storage.object"] : []),
      ],
      deploymentValueAliases: { DATABASE_URL: ["DATABASE_URL_DIRECT"] },
    },
  )
  const providerPorts = { ...selectedProviderPorts, ...explicitRuntimePorts }
  let storage = resolveCustomStorageResolver(
    providerPlan.storage === "custom"
      ? (options.host?.storage ?? providerPorts["storage.object"])
      : providerPorts["storage.object"],
  )
  // The local `memory` storage plan keeps bytes in a per-process Map, so uploads
  // vanish on restart while their Postgres rows persist. Mirror them to disk so a
  // self-hosted operator without a configured bucket keeps its media across
  // restarts. (Node-only; the isomorphic storage package must not touch node:fs.)
  if (providerPlan.storage === "memory") {
    storage = withFilesystemPersistence(storage, resolveLocalStorageDir(rawEnv))
  }
  const runtimeProviderPorts = { ...providerPorts, "storage.object": storage }
  const hostDeliverEvent = options.host?.deliverEvent
  const outboundWebhooks = resolveOutboundWebhookDeliveryEnqueuer({
    provider: generated.deployment.providers.outboundWebhooks,
    createPostgres: () =>
      createPostgresWebhookDeliveryEnqueuer({
        resolveDatabase: (bindings) =>
          resolveNodeDatabase(
            bindings as Parameters<typeof resolveNodeDatabase>[0],
          ) as AnyDrizzleDb,
      }),
    ...(hostDeliverEvent
      ? {
          host: {
            enqueue: (event: EventEnvelope, bindings: unknown) => hostDeliverEvent(event, bindings),
          },
        }
      : {}),
  })
  const appWebhookRuntime = providerPorts[appsWebhookDeliveryRuntimePort.id] as
    | AppsWebhookDeliveryRuntime
    | undefined
  const appsSelected = generated.graphRuntime.modules.some(
    (unit) => unit.id === "@voyant-travel/apps" || unit.packageName === "@voyant-travel/apps",
  )
  if (appWebhookRuntime) await appsWebhookDeliveryRuntimePort.test(appWebhookRuntime)
  const appWebhooks =
    appsSelected && appWebhookRuntime
      ? createAppWebhookDeliveryEnqueuer({
          contracts: (generated.graphRuntime.eventCatalog?.events ?? [])
            .filter((event) => event.visibility === "external")
            .map((event) => ({
              eventId: event.id,
              eventType: event.eventType,
              eventVersion: event.version,
              payloadSchema: event.payloadSchema,
            })),
          resolveDatabase: (bindings) =>
            resolveNodeDatabase(
              bindings as Parameters<typeof resolveNodeDatabase>[0],
            ) as AnyDrizzleDb,
          resolveSigningKey: appWebhookRuntime.resolveSigningKey,
        })
      : undefined
  const primitives = createVoyantNodeRuntimeHostPrimitives({
    ...options.host,
    config: {
      ...options.host?.config,
      "deployment.providers.adminAuth": adminAuthProvider,
      "deployment.providers.customerAuth": customerAuthProvider,
    },
    env: authEnv,
    storage,
    deliverEvent: outboundWebhooks
      ? (event, bindings) => outboundWebhooks.enqueue(event as EventEnvelope, bindings)
      : undefined,
  })
  const deploymentResources = createVoyantDeploymentResources({
    primitives,
    providerPorts: runtimeProviderPorts,
    createRuntimePorts: generated.createRuntimePorts,
    outboundWebhooks,
  })
  const customerBusinessAccountOnboarding = deploymentResources.ports[
    customerBusinessAccountOnboardingRuntimePort.id
  ] as CustomerBusinessAccountOnboardingRuntimeProvider | undefined
  if (customerBusinessAccountOnboarding) {
    await customerBusinessAccountOnboardingRuntimePort.test(customerBusinessAccountOnboarding)
  }
  const projectLinks = await loadGeneratedProjectLinks(artifactRoot)
  const authRuntime = createOperatorAuthNodeRuntime({
    accessCatalog: generated.graphRuntime.accessCatalog,
    activeModules: generated.graphRuntime.modules.map((unit) => unit.localId ?? unit.id),
    appName: path.basename(projectRoot),
    authMode,
    reporter: consoleReporter(),
    ...(customerBusinessAccountOnboarding ? { customerBusinessAccountOnboarding } : {}),
    resolveEmailSender: options.host?.resolveAuthEmailSender ?? resolveVoyantCloudAuthEmailSender,
    ...(options.host?.resolveCustomerAuthContext
      ? { resolveCustomerAuthContext: options.host.resolveCustomerAuthContext }
      : {}),
    ...(options.host?.resolveCustomerCorsOrigin
      ? { resolveCustomerCorsOrigin: options.host.resolveCustomerCorsOrigin }
      : {}),
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
    appWebhooks,
    env: authEnv,
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
        resolveCorsOrigin: ({ request, env: requestEnv }) =>
          authRuntime.resolveCustomerCorsOrigin(request, requireVoyantAuthEnv(requestEnv)),
        validateApiKey: ({ env: requestEnv, db, apiKey }) =>
          authRuntime.validateApiTokenAccess(requireVoyantAuthEnv(requestEnv), db, apiKey),
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

function selectedOperatorAuthMode(provider: unknown): "local" | "voyant-cloud" {
  if (provider === "better-auth") return "local"
  if (provider === "voyant-cloud") return "voyant-cloud"
  throw new Error(
    `Unsupported deployment.providers.adminAuth value ${JSON.stringify(provider)}. Expected "better-auth" or "voyant-cloud".`,
  )
}

function selectedCustomerAuthProvider(provider: unknown): "better-auth" | "disabled" {
  if (provider === "better-auth" || provider === "disabled") return provider
  throw new Error(
    `Unsupported deployment.providers.customerAuth value ${JSON.stringify(provider)}. Expected "better-auth" or "disabled".`,
  )
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
  return startVoyantProjectWithDependencies(options, {
    loadBuiltStart: loadBuiltProjectStart,
    loadProject: loadVoyantProject,
  })
}

function rewriteLegacyMediaRequest(request: Request): Request {
  const url = new URL(request.url)
  if (!url.pathname.startsWith("/api/v1/media/")) return request
  url.pathname = url.pathname.replace("/api/v1/media/", "/api/v1/admin/media/")
  return new Request(url, request)
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
  const workflowProvider = resolveVoyantNodeWorkflowProvider(
    input.runtime.deployment.providers.workflows,
  )
  if (workflowProvider === "none") return
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
      createDriver: (dependencies) => {
        const factory = createVoyantNodeWorkflowDriver({
          deployment: input.runtime.deployment,
          env: input.bindings,
          defaultAppSlug: path.basename(input.projectRoot),
          oneShot: true,
        })
        if (!factory) {
          throw new Error("Scheduled workflow dispatch requires an enabled workflow provider.")
        }
        return factory(dependencies)
      },
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
