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

// The ENTIRE load-bearing build config — vendor chunking, SSR optimizeDeps, the
// Node SSR target/noExternal/resolve (voyant#2966), `@` alias, dev-tunnel hosts
// — is versioned in `@voyant-travel/vite-config`. This source-free managed admin
// host copies NO build config: `vite.config.ts` is just plugin instantiation +
// `nodeSsr: true`, so a Cloud image tracks the framework version, not a copy
// (voyant#3044).
export default defineConfig(
  voyantStartViteConfig({
    appRootUrl: import.meta.url,
    nodeSsr: true,
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
  }),
)
