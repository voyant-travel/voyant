import { Hono } from "hono"

import type { CatalogDemoDb } from "./db.js"
import { createRoutes } from "./routes.js"

export function createApp(db: CatalogDemoDb): Hono {
  const app = new Hono()

  app.onError((err, c) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[catalog-demo-api] ${c.req.method} ${c.req.path}: ${message}`)
    return c.json({ error: message }, 500)
  })

  // Permissive CORS — the operator template hits these endpoints from a
  // worker, and ops users hit /inventory from a browser tab. Real upstream
  // sources lock CORS down; the demo is a dev tool.
  app.use("*", async (c, next) => {
    await next()
    c.res.headers.set("Access-Control-Allow-Origin", "*")
    c.res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    c.res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  })
  app.options("*", (c) => c.body(null, 204))

  app.get("/", (c) =>
    c.json({
      service: "catalog-demo-api",
      message: "Demo SourceAdapter HTTP surface. See /health, /discover, /reserve, /cancel.",
    }),
  )
  app.route("/", createRoutes(db))
  return app
}
