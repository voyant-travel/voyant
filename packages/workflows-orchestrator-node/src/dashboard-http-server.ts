import type { IncomingMessage, Server, ServerResponse } from "node:http"
import { handleRequest } from "./dashboard-request.js"
import { handleRunSseStream, handleSseStream } from "./dashboard-sse.js"
import { createStaticReader, urlPath } from "./dashboard-static.js"
import type { ServeDeps, ServeHandle } from "./dashboard-types.js"
import { createStoreStream, type StoreStream } from "./store-stream.js"

function closeAllConnections(server: Server): void {
  if ("closeAllConnections" in server && typeof server.closeAllConnections === "function") {
    server.closeAllConnections()
  }
}

export async function startServer(
  options: { port: number; host: string },
  deps: ServeDeps,
): Promise<ServeHandle> {
  const readStatic =
    deps.readStatic ?? (deps.staticDir ? createStaticReader(deps.staticDir) : undefined)
  const hasStaticDashboard = Boolean(readStatic)

  let storeStream: StoreStream | undefined
  const getStoreStream = (): StoreStream => {
    if (!storeStream) storeStream = createStoreStream(deps.store)
    return storeStream
  }

  const server: Server = deps.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const method = (req.method ?? "GET").toUpperCase()
    const url = req.url ?? "/"

    if ((method === "GET" || method === "HEAD") && urlPath(url) === "/api/runs/stream") {
      handleSseStream(res, getStoreStream(), deps.chunkBus)
      return
    }

    const perRunMatch = urlPath(url).match(/^\/api\/runs\/([^/]+)\/stream$/)
    if ((method === "GET" || method === "HEAD") && perRunMatch) {
      const runId = decodeURIComponent(perRunMatch[1]!)
      handleRunSseStream(res, runId, getStoreStream(), deps.chunkBus, deps.store)
      return
    }

    try {
      const body = method === "POST" ? await readRequestBody(req) : undefined
      const response = await handleRequest(
        { method, url, body },
        {
          store: deps.store,
          healthCheck: deps.healthCheck,
          readinessCheck: deps.readinessCheck,
          collectMetrics: deps.collectMetrics,
          readStatic,
          hasStaticDashboard,
          triggerRun: deps.triggerRun,
          resumeRun: deps.resumeRun,
          listWorkflows: deps.listWorkflows,
          injectWaitpoint: deps.injectWaitpoint,
          listSchedules: deps.listSchedules,
          cancelRun: deps.cancelRun,
        },
      )
      res.writeHead(response.status, response.headers)
      res.end(response.body)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      res.writeHead(500, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: "internal_error", message }))
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(options.port, options.host, () => {
      server.off("error", reject)
      resolve()
    })
  })

  deps.scheduler?.start()

  return {
    url: `http://${options.host}:${options.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        deps.scheduler?.stop()
        storeStream?.stop()
        closeAllConnections(server)
        server.close((err) => {
          if (err) {
            reject(err)
            return
          }
          Promise.resolve(deps.shutdown?.()).then(() => resolve(), reject)
        })
      }),
  }
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const maxBytes = 1_000_000
  return new Promise((resolve, reject) => {
    let total = 0
    const chunks: Uint8Array[] = []
    req.on("data", (chunk: Uint8Array) => {
      total += chunk.length
      if (total > maxBytes) {
        req.destroy(new Error("request body exceeds 1MB"))
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"))
    })
    req.on("error", reject)
  })
}
