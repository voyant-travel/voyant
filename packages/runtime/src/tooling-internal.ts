import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { Generator, getConfig } from "@tanstack/router-generator"
import viteReact from "@vitejs/plugin-react"
import {
  createAnalyzePlugin,
  VOYANT_ROUTE_FILE_IGNORE_PATTERN,
  type VoyantGeneratedRouteFile,
  voyantGeneratedRoutes,
  voyantStartViteConfig,
} from "@voyant-travel/vite-config"
import { register } from "tsx/esm/api"
import {
  createServer as createViteServer,
  type InlineConfig,
  type PluginOption,
  type ViteDevServer,
  build as viteBuild,
} from "vite"

import type {
  BuildVoyantProjectOptions,
  DevelopVoyantProjectOptions,
  VoyantProjectDevelopmentServer,
} from "./tooling.js"

const DEFAULT_DEVELOPMENT_PORT = 3300
const PRODUCT_BOM_ARTIFACT = ".voyant/product-bom.generated.json"
const PRODUCT_ROUTE_FILES_EXPORT = "standard-route-files"

interface GeneratedRoutes {
  plugin: PluginOption
  routesDirectory: string
  generatedRouteTree: string
}

interface ProjectViteConfigOptions {
  appRootUrl: string
  generatedRoutes: GeneratedRoutes
  bootstrap: ProjectBootstrap
}

interface ProjectBootstrap {
  routerEntry?: string
  stylesEntry?: string
  aliases?: Readonly<Record<string, string>>
}

interface ProjectRouteGenerationOptions {
  projectRoot: string
  routesDirectory: string
  generatedRouteTree: string
}

interface ProjectViteServer {
  resolvedUrls: ViteDevServer["resolvedUrls"]
  listen(): Promise<unknown>
  close(): Promise<void>
}

export interface VoyantProjectToolingDependencies {
  loadStandardRouteFiles(projectRoot: string): Promise<readonly VoyantGeneratedRouteFile[]>
  prepareProjectBootstrap(projectRoot: string): Promise<ProjectBootstrap>
  materializeRoutes(options: {
    appRootUrl: string
    files: readonly VoyantGeneratedRouteFile[]
  }): GeneratedRoutes
  createViteConfig(options: ProjectViteConfigOptions): InlineConfig
  generateRouteTree(options: ProjectRouteGenerationOptions): Promise<void>
  buildVite(config: InlineConfig): Promise<unknown>
  createViteServer(config: InlineConfig): Promise<ProjectViteServer>
  replaceDirectory(source: string, destination: string): Promise<void>
}

const defaultDependencies: VoyantProjectToolingDependencies = {
  loadStandardRouteFiles,
  prepareProjectBootstrap,
  materializeRoutes: voyantGeneratedRoutes,
  createViteConfig: createProjectViteConfig,
  generateRouteTree,
  buildVite: viteBuild,
  createViteServer,
  replaceDirectory,
}

export async function buildVoyantProjectWithDependencies(
  options: BuildVoyantProjectOptions,
  dependencies: VoyantProjectToolingDependencies = defaultDependencies,
): Promise<void> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd())
  const config = await prepareProjectViteConfig(projectRoot, dependencies)

  await dependencies.buildVite({ ...config, root: projectRoot, configFile: false })
  await Promise.all([
    dependencies.replaceDirectory(
      path.join(projectRoot, ".voyant"),
      path.join(projectRoot, "dist/.voyant"),
    ),
    dependencies.replaceDirectory(
      path.join(projectRoot, ".voyant"),
      path.join(projectRoot, "dist/server/.voyant"),
    ),
  ])
}

export async function developVoyantProjectWithDependencies(
  options: DevelopVoyantProjectOptions,
  dependencies: VoyantProjectToolingDependencies = defaultDependencies,
): Promise<VoyantProjectDevelopmentServer> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd())
  const config = await prepareProjectViteConfig(projectRoot, dependencies)
  const port = options.port ?? DEFAULT_DEVELOPMENT_PORT
  const server = await dependencies.createViteServer({
    ...config,
    root: projectRoot,
    configFile: false,
    server: {
      ...config.server,
      ...(options.host === undefined ? {} : { host: options.host }),
      port,
    },
  })

  try {
    await server.listen()
  } catch (error) {
    await server.close().catch(() => undefined)
    throw error
  }

  let closed = false
  return {
    url: resolveDevelopmentUrl(server, options.host, port),
    close: async () => {
      if (closed) return
      closed = true
      await server.close()
    },
  }
}

async function prepareProjectViteConfig(
  projectRoot: string,
  dependencies: VoyantProjectToolingDependencies,
): Promise<InlineConfig> {
  const appRootUrl = pathToFileURL(path.join(projectRoot, "generated-config-anchor.ts")).href
  const files = await dependencies.loadStandardRouteFiles(projectRoot)
  const bootstrap = await dependencies.prepareProjectBootstrap(projectRoot)
  const generatedRoutes = dependencies.materializeRoutes({ appRootUrl, files })

  await dependencies.generateRouteTree({
    projectRoot,
    routesDirectory: generatedRoutes.routesDirectory,
    generatedRouteTree: generatedRoutes.generatedRouteTree,
  })

  return dependencies.createViteConfig({ appRootUrl, generatedRoutes, bootstrap })
}

export function createProjectViteConfig(options: ProjectViteConfigOptions): InlineConfig {
  const config = voyantStartViteConfig({
    appRootUrl: options.appRootUrl,
    nodeSsr: true,
    plugins: [
      options.generatedRoutes.plugin,
      devtools(),
      tailwindcss(),
      tanstackStart({
        router: {
          ...(options.bootstrap.routerEntry
            ? {
                entry: `../${path.relative(path.dirname(fileURLToPath(options.appRootUrl)), options.bootstrap.routerEntry).replaceAll("\\", "/")}`,
              }
            : {}),
          routesDirectory: options.generatedRoutes.routesDirectory,
          generatedRouteTree: options.generatedRoutes.generatedRouteTree,
          routeFileIgnorePattern: VOYANT_ROUTE_FILE_IGNORE_PATTERN,
        },
      }),
      viteReact(),
      createAnalyzePlugin(options.appRootUrl),
    ],
  })
  if (options.bootstrap.stylesEntry || options.bootstrap.aliases) {
    const alias = config.resolve?.alias
    config.resolve = {
      ...config.resolve,
      alias: {
        ...options.bootstrap.aliases,
        ...(options.bootstrap.stylesEntry ? { "@/styles.css": options.bootstrap.stylesEntry } : {}),
        ...(alias && !Array.isArray(alias) ? alias : {}),
      },
    }
  }
  return config
}

export async function prepareProjectBootstrap(projectRoot: string): Promise<ProjectBootstrap> {
  const productBomId = await loadProductBomId(projectRoot)
  const generatedRoot = path.join(projectRoot, ".voyant/app")
  const bootstrap: ProjectBootstrap = {}
  const aliases = resolveProductDependencies(projectRoot, productBomId, [
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "react-dom/client",
    "react-dom/server",
    "@tanstack/react-query",
    "@tanstack/react-router",
    "react-dom",
    "react",
  ])
  if (Object.keys(aliases).length > 0) bootstrap.aliases = aliases

  if (!(await pathExists(path.join(projectRoot, "src/router.tsx")))) {
    bootstrap.routerEntry = path.join(generatedRoot, "router.tsx")
    await writeGeneratedFile(
      bootstrap.routerEntry,
      `import type { StandardOperatorRouterContext } from ${JSON.stringify(`${productBomId}/standard-frontend`)}
import { operatorFrontend } from "../routes/_lib/operator-frontend"
import { Route as workspaceRoute } from "../routes/_workspace/route"
import { routeTree } from "../routeTree.gen"

export type RouterContext = StandardOperatorRouterContext

export function getRouter() {
  return operatorFrontend.createRouter({ routeTree, workspaceRoute })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
`,
    )
  }

  if (!(await pathExists(path.join(projectRoot, "src/styles.css")))) {
    bootstrap.stylesEntry = path.join(generatedRoot, "styles.css")
    await writeGeneratedFile(
      bootstrap.stylesEntry,
      `@import ${JSON.stringify(`${productBomId}/standard-styles.css`)};\n`,
    )
  }
  return bootstrap
}

async function generateRouteTree(options: ProjectRouteGenerationOptions): Promise<void> {
  const config = getConfig(
    {
      target: "react",
      routesDirectory: options.routesDirectory,
      generatedRouteTree: options.generatedRouteTree,
      routeFileIgnorePattern: VOYANT_ROUTE_FILE_IGNORE_PATTERN,
      disableLogging: true,
    },
    options.projectRoot,
  )
  await new Generator({ config, root: options.projectRoot }).run()
}

export async function loadStandardRouteFiles(
  projectRoot: string,
): Promise<readonly VoyantGeneratedRouteFile[]> {
  const productBomId = await loadProductBomId(projectRoot)
  const routeFilesExport = `${productBomId}/${PRODUCT_ROUTE_FILES_EXPORT}`
  const resolveFromProject = createRequire(path.join(projectRoot, "package.json"))
  let resolved: string
  try {
    resolved = resolveFromProject.resolve(routeFilesExport)
  } catch (error) {
    throw new Error(
      `Voyant product BOM ${productBomId} does not provide ${routeFilesExport}: ${errorMessage(error)}`,
      { cause: error },
    )
  }

  const module = (await importProjectModule(resolved)) as {
    standardOperatorRouteFiles?: unknown
  }

  if (!isGeneratedRouteFileArray(module.standardOperatorRouteFiles)) {
    throw new TypeError(`${routeFilesExport} must export standardOperatorRouteFiles as an array`)
  }
  return module.standardOperatorRouteFiles
}

export async function loadProductBomId(projectRoot: string): Promise<string> {
  const artifactPath = path.join(projectRoot, PRODUCT_BOM_ARTIFACT)
  let source: string
  try {
    source = await readFile(artifactPath, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `Voyant product BOM artifact is missing at ${artifactPath}. Run voyant build first.`,
        {
          cause: error,
        },
      )
    }
    throw error
  }

  let artifact: unknown
  try {
    artifact = JSON.parse(source)
  } catch (error) {
    throw new Error(`Voyant product BOM artifact at ${artifactPath} is not valid JSON.`, {
      cause: error,
    })
  }

  const productBomId = (artifact as { productBom?: { id?: unknown } })?.productBom?.id
  if (typeof productBomId !== "string" || !isPackageName(productBomId)) {
    throw new TypeError(
      `Voyant product BOM artifact at ${artifactPath} must declare productBom.id as a canonical package name.`,
    )
  }
  return productBomId
}

async function pathExists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

async function writeGeneratedFile(file: string, source: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, source)
}

async function importProjectModule(resolved: string): Promise<unknown> {
  const moduleUrl = pathToFileURL(resolved).href
  if (/\.[cm]?tsx?$/.test(resolved)) {
    const unregister = register()
    try {
      return await import(moduleUrl)
    } finally {
      await unregister()
    }
  }
  return import(moduleUrl)
}

function resolveProductDependencies(
  projectRoot: string,
  productBomId: string,
  dependencies: readonly string[],
): Readonly<Record<string, string>> {
  try {
    const projectRequire = createRequire(path.join(projectRoot, "package.json"))
    const productEntry = projectRequire.resolve(`${productBomId}/standard-frontend`)
    const productRequire = createRequire(productEntry)
    return Object.fromEntries(
      dependencies.flatMap((dependency) => {
        try {
          return [[dependency, productRequire.resolve(dependency)]]
        } catch {
          return []
        }
      }),
    )
  } catch {
    return {}
  }
}

function isPackageName(value: string): boolean {
  return (
    /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/.test(value) ||
    /^[a-z0-9][a-z0-9._-]*$/.test(value)
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isGeneratedRouteFileArray(value: unknown): value is readonly VoyantGeneratedRouteFile[] {
  return (
    Array.isArray(value) &&
    value.every(
      (file) =>
        typeof file === "object" &&
        file !== null &&
        typeof (file as { path?: unknown }).path === "string" &&
        typeof (file as { source?: unknown }).source === "string",
    )
  )
}

async function replaceDirectory(source: string, destination: string): Promise<void> {
  await rm(destination, { recursive: true, force: true })
  await mkdir(path.dirname(destination), { recursive: true })
  await cp(source, destination, { recursive: true })
}

function resolveDevelopmentUrl(
  server: Pick<ProjectViteServer, "resolvedUrls">,
  host: string | undefined,
  port: number,
): string {
  const resolved = server.resolvedUrls?.local[0] ?? server.resolvedUrls?.network[0]
  if (resolved) return resolved

  const fallbackHost = host && host !== "0.0.0.0" && host !== "::" ? host : "localhost"
  return `http://${formatUrlHost(fallbackHost)}:${port}`
}

function formatUrlHost(host: string): string {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host
}
