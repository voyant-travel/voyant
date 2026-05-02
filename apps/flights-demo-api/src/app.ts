import { Hono } from "hono"

import type { DemoFlightsDb } from "./db.js"
import { createRoutes } from "./routes.js"

export function createApp(db: DemoFlightsDb): Hono {
  const app = new Hono()

  // Always return JSON on errors — the plugin client (and any other
  // caller) reads `application/json`; HTML 500 bodies surface as
  // "Unexpected token 'I'" parse errors at the call site.
  app.onError((err, c) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[flights-demo-api] ${c.req.method} ${c.req.path}: ${message}`)
    return c.json({ error: message }, 500)
  })

  app.get("/", (c) =>
    c.json({
      service: "flights-demo-api",
      message: "Demo FlightConnectorAdapter HTTP surface. See /health.",
    }),
  )
  app.route("/", createRoutes(db))
  return app
}
