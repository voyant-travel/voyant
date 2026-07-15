import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL, URL } from "node:url"
import type { Alias, Plugin, PluginOption, ResolverFunction, UserConfig } from "vite"

/**
 * Force heavy vendor libs into their own chunks so they're only downloaded
 * when a route/component that uses them is reached (combined with React.lazy
 * at the consumer site). Without this, Vite hoists them into the shared entry
 * chunk because the @voyant-travel/ui barrel re-exports components that statically
 * import them, leaking the deps into every route's dep graph.
 *
 * React/JSX runtime + react-dom are pinned FIRST: without that, the bundler
 * can hoist the JSX runtime into another vendor chunk, forcing every
 * React-using chunk to import that chunk just to get `jsx`/`jsxs`.
 */
function isNodeModulePackage(id: string, packageName: string): boolean {
  return id.includes(`/node_modules/${packageName}/`)
}

export function voyantVendorChunk(id: string): string | undefined {
  const normalizedId = id.replaceAll("\\", "/")
  if (!normalizedId.includes("node_modules")) return undefined

  if (
    isNodeModulePackage(normalizedId, "react") ||
    isNodeModulePackage(normalizedId, "react-dom") ||
    isNodeModulePackage(normalizedId, "scheduler")
  ) {
    return "react"
  }
  if (normalizedId.includes("/clsx/") || normalizedId.includes("/tailwind-merge/")) {
    return "class-utils"
  }
  if (normalizedId.includes("/@tiptap/") || normalizedId.includes("/prosemirror-")) {
    return "tiptap"
  }
  if (normalizedId.includes("/recharts/")) return "recharts"
  if (normalizedId.includes("/pdf-lib/") || normalizedId.includes("/@pdf-lib/")) {
    return "pdf-lib"
  }
  return undefined
}

/**
 * Dependencies pre-bundled for the SSR environment so cold dev-server starts
 * don't pay per-module transform costs for the common runtime set.
 */
export const VOYANT_SSR_OPTIMIZE_DEPS: readonly string[] = [
  "react",
  "react-dom",
  "react-dom/server",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@tanstack/react-query",
  "@tanstack/react-router",
]

const VOYANT_CLIENT_OPTIMIZE_DEPS_EXCLUDE: readonly string[] = [
  "@voyant-travel/operator-standard",
  "@voyant-travel/operator-standard/standard-frontend",
]

const VOYANT_DEDUPE_DEPENDENCIES: readonly string[] = [
  "react",
  "react-dom",
  "@tanstack/react-query",
  "@tanstack/react-router",
]

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const

/**
 * Route-file ignore pattern for TanStack Start's file router: colocated
 * helpers (`_components`, `_hooks`, …) and page/section/dialog modules are
 * not route files. Pass to `tanstackStart({ router: { routeFileIgnorePattern } })`.
 */
export const VOYANT_ROUTE_FILE_IGNORE_PATTERN =
  "^(_components|_hooks|_stores|_sections|_contexts|_lib|_tabs|utils|types\\.ts|shop-product-detail-(?:content|accommodations|cruises|products)\\.(?:ts|tsx)|.*(?:^|[-])(shared|page(?:-[a-z0-9-]+)?|dialogs?(?:-[a-z0-9-]+)?|sections|service-row|day-row|version-row|contact-tab|questions-row|questions-tab|section-header|kanban|queries)\\.(?:ts|tsx))$"

export interface VoyantGeneratedRouteFile {
  readonly path: string
  readonly source: string
}

let generatedRouteWriteSequence = 0

function generatedRouteFiles(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? generatedRouteFiles(path) : [path]
  })
}

function removeEmptyGeneratedRouteDirectories(root: string, preserveRoot = true): void {
  if (!existsSync(root)) return
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      removeEmptyGeneratedRouteDirectories(join(root, entry.name), false)
    }
  }
  if (!preserveRoot) {
    try {
      rmdirSync(root)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== "ENOENT" && code !== "ENOTEMPTY") throw error
    }
  }
}

/**
 * Materialize package-owned route registrations into the ignored project graph.
 * TanStack's file router still receives physical files, while applications do
 * not copy standard product routes into their authored source tree.
 */
export function voyantGeneratedRoutes(options: {
  appRootUrl: string
  files: readonly VoyantGeneratedRouteFile[]
}): { plugin: Plugin; routesDirectory: string; generatedRouteTree: string } {
  const appRoot = fileURLToPath(new URL(".", options.appRootUrl))
  const routesDirectory = resolve(appRoot, ".voyant/routes")
  const generatedRouteTree = resolve(appRoot, ".voyant/routeTree.gen.ts")

  const generate = () => {
    const expected = new Map<string, string>()
    for (const file of options.files) {
      if (file.path.startsWith("/") || file.path.includes("..")) {
        throw new Error(`Invalid generated route path: ${file.path}`)
      }
      expected.set(resolve(routesDirectory, file.path), `${file.source.trim()}\n`)
    }

    mkdirSync(routesDirectory, { recursive: true })
    for (const [target, source] of expected) {
      if (existsSync(target) && readFileSync(target, "utf8") === source) continue

      mkdirSync(dirname(target), { recursive: true })
      const temporary = resolve(
        appRoot,
        `.voyant/.route-write-${process.pid}-${generatedRouteWriteSequence++}.tmp`,
      )
      try {
        writeFileSync(temporary, source)
        renameSync(temporary, target)
      } finally {
        rmSync(temporary, { force: true })
      }
    }

    for (const path of generatedRouteFiles(routesDirectory)) {
      if (!expected.has(path)) rmSync(path, { force: true })
    }
    removeEmptyGeneratedRouteDirectories(routesDirectory)
  }

  generate()
  return {
    routesDirectory,
    generatedRouteTree,
    plugin: {
      name: "voyant-generated-routes",
      enforce: "pre",
      buildStart: generate,
      configureServer(server) {
        server.watcher.add(options.files.map((file) => resolve(routesDirectory, file.path)))
      },
    },
  }
}

type VisualizerModule = {
  visualizer: (options: {
    filename: string
    template: "treemap"
    gzipSize: boolean
    brotliSize: boolean
  }) => PluginOption
}

/**
 * Opt-in bundle analysis: `ANALYZE=1 pnpm build` emits `dist/stats.html` with
 * a treemap of all client chunks. Off by default so normal builds stay clean.
 * Requires `rollup-plugin-visualizer` in the app's devDependencies; silently
 * disabled when absent.
 */
export function createAnalyzePlugin(importMetaUrl: string): PluginOption | false {
  if (process.env.ANALYZE !== "1") return false

  try {
    const require = createRequire(importMetaUrl)
    const { visualizer } = require("rollup-plugin-visualizer") as VisualizerModule
    return visualizer({
      filename: "dist/stats.html",
      template: "treemap",
      gzipSize: true,
      brotliSize: true,
    })
  } catch {
    return false
  }
}

export interface VoyantStartViteConfigOptions {
  /** `import.meta.url` of the app's `vite.config.ts` — anchors the `@` alias. */
  appRootUrl: string
  /**
   * App-supplied plugin instances (cloudflare, tailwindcss, tanstackStart,
   * react, devtools, …). Plugin packages stay app dependencies; this preset
   * only versions the load-bearing config.
   */
  plugins: PluginOption[]
  /**
   * Hosts allowed to reach the dev server. Defaults to `true` (allow all) so
   * Cloudflare-tunnel / ngrok webhooks work in dev; pass an explicit host
   * list to restrict.
   */
  allowedHosts?: true | string[]
  /** Additional chunking rules, consulted after the Voyant vendor rules. */
  extraManualChunks?: (id: string) => string | undefined
  /** Extra SSR optimizeDeps entries appended to the Voyant set. */
  ssrOptimizeDepsInclude?: readonly string[]
  /** Exact client aliases to physical ESM facades owned by the selected product BOM. */
  dependencyAliases?: Readonly<Record<string, string>>
  /** Stable product facade specifiers used when server bundles externalize frontend roots. */
  serverDependencyFacades?: Readonly<Record<string, string>>
  /**
   * Build the SSR/server environment for a Node runtime (voyant#2966: Voyant
   * deployments are Node-only — no `@cloudflare/vite-plugin`). Adds the
   * load-bearing Node-SSR config the app would otherwise hand-merge:
   *
   * - `ssr.target: "node"` so `node:` builtins the API graph uses resolve
   *   instead of being externalized for the browser;
   * - `ssr.noExternal` for `@voyant-travel/*` / `@pxmstudio/*` so workspace
   *   packages (whose `exports` point at `.js`-specifier TS source) are bundled
   *   into the server build rather than left unresolvable at runtime;
   * - `ssr.resolve.conditions` with `development` ahead of `node` so those
   *   packages resolve from `./src` and the app build stands alone (no
   *   prebuilt `dist` / `turbo ^build` needed).
   * - `ssr.external` for the CommonJS `pg` driver so Node loads its native
   *   constructor exports instead of bundling them into namespace objects.
   *
   * This is the config a Cloud-built hosted admin image would otherwise copy;
   * packaging it keeps it a version bump, not a copy (voyant#3044).
   */
  nodeSsr?: boolean
}

/**
 * The versioned Vite config for Voyant TanStack Start apps: vendor chunking,
 * SSR dep pre-bundling, `@` alias, and dev-tunnel hosts. The app's
 * `vite.config.ts` shrinks to plugin instantiation + this call.
 */
export function voyantStartViteConfig(options: VoyantStartViteConfigOptions): UserConfig {
  const { appRootUrl, plugins, allowedHosts = true, extraManualChunks, nodeSsr } = options
  const resolvableSsrDependencies = resolvableAppRootDependencies(
    appRootUrl,
    VOYANT_SSR_OPTIMIZE_DEPS,
  )
  const serverDependencyFacades = options.serverDependencyFacades ?? {}
  const dependencyFacadePlugin = createDependencyFacadePlugin(serverDependencyFacades)
  const dependencyFacadeAliases = createDependencyFacadeAliases(
    options.dependencyAliases ?? {},
    serverDependencyFacades,
  )
  const nestedDependencyIncludes = createNestedDependencyIncludes(serverDependencyFacades)

  return {
    server: {
      allowedHosts,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            return voyantVendorChunk(id) ?? extraManualChunks?.(id)
          },
        },
      },
    },
    resolve: {
      alias: [
        { find: "@", replacement: fileURLToPath(new URL("./src", appRootUrl)) },
        ...dependencyFacadeAliases,
      ],
      dedupe: resolvableAppRootDependencies(appRootUrl, VOYANT_DEDUPE_DEPENDENCIES),
      tsconfigPaths: true,
    },
    optimizeDeps: {
      include: nestedDependencyIncludes,
      exclude: [...VOYANT_CLIENT_OPTIMIZE_DEPS_EXCLUDE],
      ...(Object.keys(serverDependencyFacades).length > 0 ? { holdUntilCrawlEnd: false } : {}),
    },
    ssr: {
      optimizeDeps: {
        include: [
          ...new Set([...resolvableSsrDependencies, ...(options.ssrOptimizeDepsInclude ?? [])]),
        ],
      },
      ...(nodeSsr
        ? {
            target: "node" as const,
            external: ["pg"],
            noExternal: [/^@voyant-travel\//, /^@pxmstudio\//],
            resolve: {
              conditions: ["development", "module", "node", "import", "default"],
            },
          }
        : {}),
    },
    plugins: [dependencyFacadePlugin, ...plugins],
  }
}

function createDependencyFacadePlugin(serverFacades: Readonly<Record<string, string>>): Plugin {
  const nestedDependencyIncludes = createNestedDependencyIncludes(serverFacades)
  const productBomId = productBomPackageName(serverFacades)
  return {
    name: "voyant:dependency-facades",
    enforce: "pre",
    configEnvironment: {
      order: "post",
      handler(_name, config) {
        if (config.consumer !== "client" || !productBomId) return
        const include = config.optimizeDeps?.include
        if (!include) return
        config.optimizeDeps!.include = [
          ...new Set(
            include.map((dependency) =>
              nestedDependencyIncludes.includes(dependency)
                ? dependency
                : qualifyFrontendSingletonInclude(dependency, productBomId),
            ),
          ),
        ]
      },
    },
    async resolveId(source, importer, options) {
      if (
        source.startsWith("#frontend/") &&
        importer &&
        this.environment.config.consumer === "server" &&
        this.environment.mode === "dev"
      ) {
        const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
        return resolved
          ? { ...resolved, id: pathToFileURL(resolved.id).href, external: true }
          : null
      }
      return null
    },
  }
}

function qualifyFrontendSingletonInclude(dependency: string, productBomId: string): string {
  const rootPackage = packageNameForSubpath(dependency.split(">")[0]!.trim())
  return VOYANT_DEDUPE_DEPENDENCIES.includes(rootPackage)
    ? `${productBomId} > ${dependency}`
    : dependency
}

function createDependencyFacadeAliases(
  aliases: Readonly<Record<string, string>>,
  serverFacades: Readonly<Record<string, string>>,
): Alias[] {
  return Object.entries(aliases).map(([specifier, replacement]) => {
    const facade = serverFacades[specifier]
    if (!facade) {
      throw new Error(`Missing server dependency facade for ${specifier}`)
    }
    // Vite 8 applies aliases before user `resolveId` hooks. Its alias custom resolver
    // type is synchronous even though the implementation awaits resolver promises.
    // Keep this bridge until Vite exposes environment-specific aliases.
    const customResolver = async function (
      this: ThisParameterType<ResolverFunction>,
      updatedId: Parameters<ResolverFunction>[0],
      importer: Parameters<ResolverFunction>[1],
      options: Parameters<ResolverFunction>[2],
    ) {
      if (this.environment.config.consumer !== "server") {
        const dependencyImporter = importer?.replaceAll("\\", "/").includes("/node_modules/")
        return this.resolve(dependencyImporter ? specifier : updatedId, importer, {
          ...options,
          skipSelf: true,
        })
      }
      if (this.environment.mode !== "dev") return { id: facade, external: true }
      const resolved = await this.resolve(facade, undefined, { ...options, skipSelf: true })
      return resolved ? { ...resolved, id: pathToFileURL(resolved.id).href, external: true } : null
    }

    return {
      find: new RegExp(`^${escapeRegExp(specifier)}$`),
      replacement,
      customResolver: customResolver as never,
    }
  })
}

function createNestedDependencyIncludes(facades: Readonly<Record<string, string>>): string[] {
  const productBomId = productBomPackageName(facades)
  if (!productBomId) return []

  const reactStore = `${productBomId} > @tanstack/react-router > @tanstack/react-store`
  return [reactStore, `${reactStore} > use-sync-external-store/shim/with-selector`]
}

function productBomPackageName(facades: Readonly<Record<string, string>>): string | undefined {
  const routerFacade = facades["@tanstack/react-router"]
  return routerFacade ? packageNameForSubpath(routerFacade) : undefined
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function resolvableAppRootDependencies(
  appRootUrl: string,
  candidates: readonly string[],
): string[] {
  const packageJsonPath = fileURLToPath(new URL("./package.json", appRootUrl))
  let parsedManifest: unknown
  try {
    parsedManifest = JSON.parse(readFileSync(packageJsonPath, "utf8"))
  } catch {
    return []
  }
  if (typeof parsedManifest !== "object" || parsedManifest === null) return []
  const manifest = parsedManifest as Record<string, unknown>

  const declaredDependencies = new Set<string>()
  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = manifest[field]
    if (typeof dependencies !== "object" || dependencies === null) continue
    for (const dependency of Object.keys(dependencies)) declaredDependencies.add(dependency)
  }

  const resolveFromApp = createRequire(packageJsonPath)
  return candidates.filter((dependency) => {
    if (!declaredDependencies.has(packageNameForSubpath(dependency))) return false
    try {
      resolveFromApp.resolve(dependency)
      return true
    } catch {
      return false
    }
  })
}

function packageNameForSubpath(specifier: string): string {
  const segments = specifier.split("/")
  return specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0]!
}
