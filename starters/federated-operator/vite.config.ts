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
        router: {
          routeFileIgnorePattern: VOYANT_ROUTE_FILE_IGNORE_PATTERN,
        },
      }),
      viteReact(),
      createAnalyzePlugin(import.meta.url),
    ],
  }),
)
