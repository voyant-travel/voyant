import { createRequire } from "node:module"
import { fileURLToPath, URL } from "node:url"
import type { PluginOption, UserConfig } from "vite"

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
  "clsx",
  "tailwind-merge",
  "react",
  "react-dom",
  "react-dom/server",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@tanstack/react-query",
  "@tanstack/react-router",
  "zustand",
  "zustand/react/shallow",
  "immer",
  "sonner",
  "lucide-react",
  "date-fns",
  "zod",
  "react-hook-form",
  "swr",
]

/**
 * Route-file ignore pattern for TanStack Start's file router: colocated
 * helpers (`_components`, `_hooks`, …) and page/section/dialog modules are
 * not route files. Pass to `tanstackStart({ router: { routeFileIgnorePattern } })`.
 */
export const VOYANT_ROUTE_FILE_IGNORE_PATTERN =
  "^(_components|_hooks|_stores|_sections|_contexts|_lib|_tabs|utils|types\\.ts|shop-product-detail-(?:content|accommodations|cruises|products)\\.(?:ts|tsx)|.*(?:^|[-])(shared|page(?:-[a-z0-9-]+)?|dialogs?(?:-[a-z0-9-]+)?|sections|service-row|day-row|version-row|contact-tab|questions-row|questions-tab|section-header|kanban|queries)\\.(?:ts|tsx))$"

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
      alias: {
        "@": fileURLToPath(new URL("./src", appRootUrl)),
      },
      tsconfigPaths: true,
    },
    ssr: {
      optimizeDeps: {
        include: [...VOYANT_SSR_OPTIMIZE_DEPS, ...(options.ssrOptimizeDepsInclude ?? [])],
      },
      ...(nodeSsr
        ? {
            target: "node" as const,
            noExternal: [/^@voyant-travel\//, /^@pxmstudio\//],
            resolve: {
              conditions: ["development", "module", "node", "import", "default"],
            },
          }
        : {}),
    },
    plugins,
  }
}
