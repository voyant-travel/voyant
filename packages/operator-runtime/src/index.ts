import { mkdir, readFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { serveAdminHost } from "@voyant-travel/admin-host/serve"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { VoyantGraphDeploymentRequirements } from "@voyant-travel/framework/deployment-graph"
import {
  createVoyantNodeEnv,
  createVoyantNodeRuntimeHostPrimitives,
  loadVoyantNodeRuntime,
  type VoyantNodeRuntime,
  type VoyantNodeRuntimeEnv,
} from "@voyant-travel/framework/node-runtime"
import { createNodeServer, type NodeServerHandle } from "@voyant-travel/runtime"
import { tsImport } from "tsx/esm/api"

export {
  type CreateOperatorDeploymentResourcesOptions,
  createOperatorDeploymentResources,
  type OperatorDeploymentResources,
} from "./deployment-resources.js"

const PROJECT_RUNTIME_ENTRY = ".voyant/runtime/project-runtime.generated.ts"
const PROJECT_GRAPH_ENTRY = ".voyant/deployment-graph.generated.json"

export interface LoadOperatorProjectOptions {
  projectRoot?: string
  env?: Record<string, string | undefined>
  adminAssetsDir?: string
  host?: {
    config?: Readonly<Record<string, unknown>>
    deliverEvent?: (event: unknown, bindings: unknown) => Promise<unknown>
  }
}

export interface OperatorProjectHost {
  projectRoot: string
  graphHash: string
  runtime: VoyantNodeRuntime
  start(options?: { port?: number }): NodeServerHandle
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

/** Load the generated graph and create the framework-owned Node/admin host. */
export async function loadOperatorProject(
  options: LoadOperatorProjectOptions = {},
): Promise<OperatorProjectHost> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd())
  const generated = await loadGeneratedProjectRuntime(projectRoot)
  const graph = await readGeneratedDeploymentGraph(projectRoot, generated)
  const env = createVoyantNodeEnv(options.env ?? process.env)
  const primitives = createVoyantNodeRuntimeHostPrimitives({
    env,
    ...options.host,
  })
  const runtime = await loadVoyantNodeRuntime({
    applicationId: path.basename(projectRoot),
    graphRuntime: generated.graphRuntime,
    deployment: {
      mode: generated.deployment.mode ?? "self-hosted",
      providers: generated.deployment.providers,
    },
    deploymentRequirements: graph.requirements,
    runtimePorts: generated.createRuntimePorts({ primitives }),
    env,
  })
  const clientAssetsDir = path.resolve(
    options.adminAssetsDir ?? path.join(projectRoot, ".voyant/admin/client"),
  )
  await mkdir(clientAssetsDir, { recursive: true })
  const web = serveAdminHost<VoyantNodeRuntimeEnv>({
    clientAssetsDir,
    app: (request, env, ctx) => runtime.app.fetch(request, env, ctx),
  })

  return {
    projectRoot,
    graphHash: generated.graphHash,
    runtime,
    start: ({ port } = {}) =>
      createNodeServer<VoyantNodeRuntimeEnv>({
        fetch: (request, env, ctx) => web.fetch(request, env, toExecutionContext(ctx)),
        env: runtime.env,
        port,
        ...(runtime.env.ORIGIN_TRUST_SECRET
          ? { originTrustSecret: runtime.env.ORIGIN_TRUST_SECRET }
          : {}),
      }),
  }
}

export async function startOperatorProject(
  options: LoadOperatorProjectOptions & { port?: number } = {},
): Promise<NodeServerHandle> {
  const host = await loadOperatorProject(options)
  return host.start({ port: options.port })
}

async function loadGeneratedProjectRuntime(projectRoot: string): Promise<GeneratedProjectRuntime> {
  const entry = path.join(projectRoot, PROJECT_RUNTIME_ENTRY)
  const namespace = (await tsImport(pathToFileURL(entry).href, {
    parentURL: import.meta.url,
  })) as { createGeneratedProjectRuntime?: () => GeneratedProjectRuntime }
  if (typeof namespace.createGeneratedProjectRuntime !== "function") {
    throw new Error(`${PROJECT_RUNTIME_ENTRY} does not export createGeneratedProjectRuntime().`)
  }
  const generated = namespace.createGeneratedProjectRuntime()
  if (generated.kind !== "application") {
    throw new Error(`${PROJECT_RUNTIME_ENTRY} is not a Voyant application runtime.`)
  }
  if (typeof generated.createRuntimePorts !== "function") {
    throw new Error(`${PROJECT_RUNTIME_ENTRY} does not expose static runtime port composition.`)
  }
  return generated
}

async function readGeneratedDeploymentGraph(
  projectRoot: string,
  runtime: GeneratedProjectRuntime,
): Promise<{
  requirements: VoyantGraphDeploymentRequirements
}> {
  const graph = JSON.parse(await readFile(path.join(projectRoot, PROJECT_GRAPH_ENTRY), "utf8")) as {
    contentHash?: unknown
    requirements?: unknown
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
  }
}

function toExecutionContext(
  ctx: import("@voyant-travel/runtime").ExecutionContextLike,
): import("hono").ExecutionContext {
  return {
    waitUntil: (promise) => ctx.waitUntil(promise),
    passThroughOnException: () => ctx.passThroughOnException?.(),
    props: undefined,
  }
}
