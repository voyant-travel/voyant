import { serve } from "@hono/node-server"
import { config } from "dotenv"

import { createApp } from "./app.js"
import { createDb } from "./db.js"

// Only load this app's own `.env`. Don't fall through to the repo root —
// that's the operator starter's territory and would let the demo
// silently inherit the operator's `DATABASE_URL`.
config({ path: ".env" })

const databaseUrl = process.env.FLIGHTS_DEMO_DATABASE_URL ?? process.env.DATABASE_URL
if (!databaseUrl) {
  console.error(
    "[flights-demo-api] FLIGHTS_DEMO_DATABASE_URL (or DATABASE_URL) is required.\n" +
      "  Quickstart:\n" +
      "    docker compose up -d        # spins up Postgres on :5435\n" +
      "    pnpm db:migrate             # creates demo_flight_orders\n" +
      "    pnpm dev                    # starts the service",
  )
  process.exit(1)
}
const port = Number.parseInt(process.env.PORT ?? "3320", 10)

const { db, close } = createDb(databaseUrl)

// Fail fast if the configured Postgres isn't reachable, instead of
// surfacing a buried `ECONNREFUSED` on the first request.
try {
  await db.execute("select 1")
} catch (err) {
  const cause = err instanceof Error ? err.message : String(err)
  console.error(
    `[flights-demo-api] Cannot connect to Postgres at the configured URL.\n` +
      `  ${cause}\n` +
      "  Is the demo Postgres running? Try: docker compose up -d",
  )
  await close()
  process.exit(1)
}

const app = createApp(db)

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`flights-demo-api listening on http://localhost:${info.port}`)
})

const shutdown = async () => {
  console.log("flights-demo-api: shutting down")
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await close()
  process.exit(0)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
