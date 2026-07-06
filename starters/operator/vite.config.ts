import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import {
  createAnalyzePlugin,
  VOYANT_ROUTE_FILE_IGNORE_PATTERN,
  voyantStartViteConfig,
} from "@voyant-travel/vite-config"
import { defineConfig } from "vite"

// Load-bearing build config (vendor chunking, SSR optimizeDeps, dev-tunnel
// hosts, `@` alias) is versioned in @voyant-travel/vite-config; this file only
// instantiates the app's plugins.
//
// The operator is Node-only (voyant#2966): there is no `@cloudflare/vite-plugin`,
// so the `ssr` environment builds a plain Node bundle. `src/server.ts` runs the
// app's `fetch` under `createNodeServer` and serves the client build.
const base = voyantStartViteConfig({
  appRootUrl: import.meta.url,
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart({
      router: {
        routeFileIgnorePattern: VOYANT_ROUTE_FILE_IGNORE_PATTERN,
      },
    }),
    viteReact(),
    // Opt-in: `ANALYZE=1 pnpm build` emits dist/stats.html with a treemap
    // of all client chunks.
    createAnalyzePlugin(import.meta.url),
  ],
})

export default defineConfig({
  ...base,
  ssr: {
    ...(base.ssr ?? {}),
    // Target the SSR/server environment at Node so `node:` builtins the API
    // graph uses (async_hooks, etc.) resolve instead of being externalized for
    // the browser. Previously `@cloudflare/vite-plugin` owned this (as workerd);
    // the operator is now Node-only (voyant#2966).
    target: "node",
    // Bundle the workspace packages into the server build. Their `exports` point
    // at TS source (`./src/*.ts`) using `.js`-extension specifiers that Node
    // cannot resolve at runtime without a loader; bundling resolves them at build
    // time. The old workerd build bundled everything for the same reason. A
    // resident Node process loads the graph once, so there is no cold-start cost.
    noExternal: [/^@voyant-travel\//, /^@pxmstudio\//],
  },
})
