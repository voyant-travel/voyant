# @voyant-travel/vite-config

Versioned Vite build preset for Voyant TanStack Start apps: vendor chunking
(cold-start tuning), SSR dependency pre-bundling, the route-file ignore
pattern, and the `@` alias — delivered as a dependency instead of a copied
`vite.config.ts`.

Part of the Packaged Admin direction (`docs/architecture/packaged-admin-rfc.md`,
Phase 0): chunking and cold-start fixes ship as a version bump.

## Usage

```ts
// vite.config.ts
import { cloudflare } from "@cloudflare/vite-plugin"
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

export default defineConfig(
  voyantStartViteConfig({
    appRootUrl: import.meta.url,
    plugins: [
      devtools(),
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tailwindcss(),
      tanstackStart({
        router: { routeFileIgnorePattern: VOYANT_ROUTE_FILE_IGNORE_PATTERN },
      }),
      viteReact(),
      createAnalyzePlugin(import.meta.url),
    ],
  }),
)
```

Plugin packages stay app dependencies — the preset versions only the
load-bearing config (manual chunks, SSR optimizeDeps, ignore pattern, alias,
dev-tunnel hosts).

À-la-carte exports: `voyantVendorChunk`, `VOYANT_SSR_OPTIMIZE_DEPS`,
`VOYANT_ROUTE_FILE_IGNORE_PATTERN`, `createAnalyzePlugin`.

## License

Apache-2.0
