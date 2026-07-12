import { readdir, readFile, stat } from "node:fs/promises"
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

const GENERATED_ARTIFACT_LAYOUTS = [".voyant", "dist/.voyant"] as const
const PROJECT_RUNTIME_ENTRY = "runtime/project-runtime.generated.ts"
const PROJECT_GRAPH_ENTRY = "deployment-graph.generated.json"

export type OperatorProjectLayoutErrorCode =
  | "MISSING_GENERATED_ARTIFACTS"
  | "MISSING_ADMIN_ASSETS"

export class OperatorProjectLayoutError extends Error {
  override readonly name = "OperatorProjectLayoutError"

  constructor(
    readonly code: OperatorProjectLayoutErrorCode,
    message: string,
  ) {
    super(message)
  }
}

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
  const artifacts = await resolveGeneratedArtifacts(projectRoot)
  const generated = await loadGeneratedProjectRuntime(artifacts.runtimeEntry)
  const graph = await readGeneratedDeploymentGraph(artifacts.graphEntry, generated)
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
  const clientAssetsDir = await resolveAdminAssetsDir(projectRoot, options.adminAssetsDir)
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

async function resolveGeneratedArtifacts(projectRoot: string): Promise<{
  runtimeEntry: string
  graphEntry: string
}> {
  const candidates = GENERATED_ARTIFACT_LAYOUTS.map((layout) => ({
    runtimeEntry: path.join(projectRoot, layout, PROJECT_RUNTIME_ENTRY),
    graphEntry: path.join(projectRoot, layout, PROJECT_GRAPH_ENTRY),
  }))

  for (const candidate of candidates) {
    if ((await isFile(candidate.runtimeEntry)) && (await isFile(candidate.graphEntry))) {
      return candidate
    }
  }

  throw new OperatorProjectLayoutError(
    "MISSING_GENERATED_ARTIFACTS",
    `Generated operator runtime artifacts were not found. Expected both runtime and graph files in one of: ${candidates
      .map(({ runtimeEntry, graphEntry }) => `${runtimeEntry} and ${graphEntry}`)
      .join("; ")}.`,
  )
}

async function loadGeneratedProjectRuntime(entry: string): Promise<GeneratedProjectRuntime> {
  const namespace = (await tsImport(pathToFileURL(entry).href, {
    parentURL: import.meta.url,
  })) as { createGeneratedProjectRuntime?: () => GeneratedProjectRuntime }
  if (typeof namespace.createGeneratedProjectRuntime !== "function") {
    throw new Error(`${entry} does not export createGeneratedProjectRuntime().`)
  }
  const generated = namespace.createGeneratedProjectRuntime()
  if (generated.kind !== "application") {
    throw new Error(`${entry} is not a Voyant application runtime.`)
  }
  if (typeof generated.createRuntimePorts !== "function") {
    throw new Error(`${entry} does not expose static runtime port composition.`)
  }
  return generated
}

async function readGeneratedDeploymentGraph(
  graphEntry: string,
  runtime: GeneratedProjectRuntime,
): Promise<{
  requirements: VoyantGraphDeploymentRequirements
}> {
  const graph = JSON.parse(await readFile(graphEntry, "utf8")) as {
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

async function resolveAdminAssetsDir(
  projectRoot: string,
  explicitAdminAssetsDir: string | undefined,
): Promise<string> {
  if (explicitAdminAssetsDir) {
    const explicit = path.resolve(explicitAdminAssetsDir)
    if (await directoryContainsFile(explicit)) {
      return explicit
    }
    throw new OperatorProjectLayoutError(
      "MISSING_ADMIN_ASSETS",
      `The configured operator admin assets directory is missing or empty: ${explicit}.`,
    )
  }

  const candidates = [
    path.join(projectRoot, "dist/client"),
    path.join(projectRoot, ".voyant/admin/client"),
  ]

  for (const candidate of candidates) {
    if (await directoryContainsFile(candidate)) {
      return candidate
    }
  }

  // API-only projects do not need to produce an admin bundle. The static host
  // treats this absent default directory as a miss and delegates to the API.
  return candidates.at(-1)!
}

async function isFile(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isFile()
  } catch {
    return false
  }
}

async function directoryContainsFile(directory: string): Promise<boolean> {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile()) {
        return true
      }
      if (entry.isDirectory() && (await directoryContainsFile(path.join(directory, entry.name)))) {
        return true
      }
    }
    return false
  } catch {
    return false
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
