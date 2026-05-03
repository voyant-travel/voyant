import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Standalone workflow-runs dashboard.
 *
 * - In dev, the SPA proxies `/v1/admin` requests to the operator
 *   template (default port 3300) so the same-origin assumption holds.
 *   Override via `VOYANT_API_TARGET` if your API is elsewhere.
 * - In prod, deploy the static `dist/` to any host. Pass
 *   `VITE_API_BASE` at build time to point the SPA at a non-same-origin
 *   API (e.g. https://operator.example.com).
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 3500,
    proxy: {
      "/v1/admin": process.env.VOYANT_API_TARGET ?? "http://127.0.0.1:3300",
    },
  },
})
