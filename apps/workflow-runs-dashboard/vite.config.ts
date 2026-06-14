import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Standalone workflow-runs dashboard.
 *
 * - In dev, the SPA proxies `/api/*` requests to the operator
 *   starter (default port 3300) so same-origin assumptions hold.
 *   The operator starter mounts its API behind `/api`, so the
 *   SPA's default API base of `/api` works as-is.
 *   Override via `VOYANT_API_TARGET` if the operator runs elsewhere.
 * - In prod, deploy the static `dist/` to any host. Pass
 *   `VITE_API_BASE` at build time to point the SPA at a non-same-origin
 *   API (e.g. https://operator.example.com/api).
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "esnext",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 3500,
    proxy: {
      // `localhost` (not 127.0.0.1) — vite often binds the operator
      // starter to IPv6 loopback only; resolving via localhost lets
      // Node fall back across address families.
      "/api": process.env.VOYANT_API_TARGET ?? "http://localhost:3300",
    },
  },
})
