import type { ServerResponse } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// `voyant workflows serve` / `voyant dev` locate this app's `dist/`
// via `findDashboardDir()` and serve it as a static site. Output is
// kept at `dist/` with `index.html` at the root so that discovery
// continues to work without extra wiring.
export default defineConfig({
  plugins: [react(), tailwindcss(), emptyWorkflowApiPlugin()],
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
    // Stand-alone dev preview: `vite dev` hits the voyant API at 3232.
    proxy: {
      "/api": "http://127.0.0.1:3232",
      "/sse": "http://127.0.0.1:3232",
    },
  },
})

function emptyWorkflowApiPlugin(): Plugin {
  return {
    name: "voyant-workflows-empty-api",
    apply: "serve",
    configureServer(server) {
      if (process.env.VOYANT_WORKFLOWS_DASHBOARD_EMPTY_API !== "1") return

      server.middlewares.use((request, response, next) => {
        const requestPath = request.url?.split("?")[0]

        if (request.method !== "GET" || !requestPath) {
          next()
          return
        }

        if (requestPath === "/api/runs") {
          writeJson(response, { runs: [] })
          return
        }

        if (requestPath === "/api/workflows") {
          writeJson(response, { workflows: [] })
          return
        }

        if (requestPath === "/api/schedules") {
          writeJson(response, { schedules: [] })
          return
        }

        if (requestPath === "/api/runs/stream") {
          writeEventStream(response, {
            event: "snapshot",
            data: { runs: [] },
          })
          return
        }

        next()
      })
    },
  }
}

function writeJson(response: ServerResponse, body: unknown) {
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" })
  response.end(`${JSON.stringify(body)}\n`)
}

function writeEventStream(response: ServerResponse, event: { event: string; data: unknown }) {
  response.writeHead(200, {
    "cache-control": "no-cache",
    "content-type": "text/event-stream; charset=utf-8",
  })
  response.end(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`)
}
