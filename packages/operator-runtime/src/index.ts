import { mkdir, readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { serveManagedProfileAdmin } from "@voyant-travel/admin-host/serve"
import { createVoyantGraphRuntimePortStubs } from "@voyant-travel/framework"
import {
  loadManagedProfileRuntime,
  type ManagedProfileRuntime,
  type ManagedProfileRuntimeEnv,
} from "@voyant-travel/framework/managed-runtime"
import { createNodeServer, type NodeServerHandle } from "@voyant-travel/runtime"
import { tsImport } from "tsx/esm/api"

const PROJECT_RUNTIME_ENTRY = ".voyant/runtime/project-runtime.generated.ts"
const PROJECT_GRAPH_ENTRY = ".voyant/deployment-graph.generated.json"

export interface LoadOperatorProjectOptions {
  projectRoot?: string
  env?: Record<string, string | undefined>
  adminAssetsDir?: string
}

export interface OperatorProjectHost {
  projectRoot: string
  graphHash: string
  runtime: ManagedProfileRuntime
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
}

/** Load the generated graph and create the framework-owned Node/admin host. */
export async function loadOperatorProject(
  options: LoadOperatorProjectOptions = {},
): Promise<OperatorProjectHost> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd())
  const generated = await loadGeneratedProjectRuntime(projectRoot)
  await assertGraphHash(projectRoot, generated)
  const runtime = await loadManagedProfileRuntime({
    project: {
      schemaVersion: "voyant.managed-profile.v1",
      profile: "operator",
      frameworkVersion: resolveFrameworkVersion(),
      mode: generated.deployment.mode ?? "self-hosted",
      modules: [],
      plugins: [],
      settings: {},
      providers: generated.deployment.providers,
      admin: { enabled: true, path: "/app" },
    },
    deployment: {
      mode: generated.deployment.mode ?? "self-hosted",
      providers: generated.deployment.providers,
    },
    graphRuntime: generated.graphRuntime,
    runtimePorts: createVoyantGraphRuntimePortStubs(generated.graphRuntime),
    env: options.env,
  })
  const clientAssetsDir = path.resolve(
    options.adminAssetsDir ?? path.join(projectRoot, ".voyant/admin/client"),
  )
  await mkdir(clientAssetsDir, { recursive: true })
  const web = serveManagedProfileAdmin<ManagedProfileRuntimeEnv>({
    clientAssetsDir,
    app: (request, env, ctx) => runtime.app.fetch(request, env, ctx),
  })

  return {
    projectRoot,
    graphHash: generated.graphHash,
    runtime,
    start: ({ port } = {}) =>
      createNodeServer<ManagedProfileRuntimeEnv>({
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
  return generated
}

async function assertGraphHash(
  projectRoot: string,
  runtime: GeneratedProjectRuntime,
): Promise<void> {
  const graph = JSON.parse(await readFile(path.join(projectRoot, PROJECT_GRAPH_ENTRY), "utf8")) as {
    contentHash?: unknown
  }
  if (graph.contentHash !== runtime.graphHash) {
    throw new Error("Generated project runtime and deployment graph hashes do not match.")
  }
}

function resolveFrameworkVersion(): string {
  const require = createRequire(import.meta.url)
  const entry = require.resolve("@voyant-travel/framework")
  let directory = path.dirname(entry)
  while (directory !== path.dirname(directory)) {
    try {
      const packageJson = require(path.join(directory, "package.json")) as {
        name?: string
        version?: string
      }
      if (packageJson.name === "@voyant-travel/framework" && packageJson.version) {
        return packageJson.version
      }
    } catch {}
    directory = path.dirname(directory)
  }
  throw new Error("Unable to resolve @voyant-travel/framework version.")
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
