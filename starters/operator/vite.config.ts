import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { standardOperatorRouteFiles } from "@voyant-travel/admin-host/standard-route-files"
import {
  createAnalyzePlugin,
  VOYANT_ROUTE_FILE_IGNORE_PATTERN,
  voyantGeneratedRoutes,
  voyantStartViteConfig,
} from "@voyant-travel/vite-config"
import { defineConfig } from "vite"

// The load-bearing build config (vendor chunking, SSR optimizeDeps, the Node SSR
// target/noExternal/resolve, `@` alias, dev-tunnel hosts) is versioned in
// @voyant-travel/vite-config; this file only instantiates the app's plugins.
//
// The operator is Node-only (voyant#2966): there is no `@cloudflare/vite-plugin`,
// so `nodeSsr` builds a plain Node bundle. `src/server.ts` runs the app's
// `fetch` under `createNodeServer` and serves the client build.
const generatedRoutes = voyantGeneratedRoutes({
  appRootUrl: import.meta.url,
  files: standardOperatorRouteFiles,
})

export default defineConfig(
  voyantStartViteConfig({
    appRootUrl: import.meta.url,
    nodeSsr: true,
    plugins: [
      generatedRoutes.plugin,
      devtools(),
      tailwindcss(),
      tanstackStart({
        router: {
          routesDirectory: generatedRoutes.routesDirectory,
          generatedRouteTree: generatedRoutes.generatedRouteTree,
          routeFileIgnorePattern: VOYANT_ROUTE_FILE_IGNORE_PATTERN,
        },
      }),
      viteReact(),
      // Opt-in: `ANALYZE=1 pnpm build` emits dist/stats.html with a treemap
      // of all client chunks.
      createAnalyzePlugin(import.meta.url),
    ],
  }),
)
