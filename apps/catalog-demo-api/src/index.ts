import { serve } from "@hono/node-server"
import { config } from "dotenv"

import { createApp } from "./app.js"
import { createDb } from "./db.js"
import { defaultDemoInventory, seedInventory } from "./seed.js"
import * as store from "./store.js"

// Only load this app's own `.env`. Don't fall through to the repo root —
// that's the operator template's territory and would let the demo
// silently inherit the operator's `DATABASE_URL`.
config({ path: ".env" })

const databaseUrl = process.env.CATALOG_DEMO_DATABASE_URL ?? process.env.DATABASE_URL
if (!databaseUrl) {
  console.error(
    "[catalog-demo-api] CATALOG_DEMO_DATABASE_URL (or DATABASE_URL) is required.\n" +
      "  Quickstart:\n" +
      "    docker compose up -d        # spins up Postgres on :5437\n" +
      "    pnpm db:migrate             # creates catalog_demo_inventory + catalog_demo_orders\n" +
      "    pnpm dev                    # starts the service",
  )
  process.exit(1)
}

const port = Number.parseInt(process.env.PORT ?? "3330", 10)
const autoSeed = process.env.AUTO_SEED === "true"

const { db, close } = createDb(databaseUrl)

try {
  await db.execute("select 1")
} catch (err) {
  const cause = err instanceof Error ? err.message : String(err)
  console.error(
    `[catalog-demo-api] Cannot connect to Postgres at the configured URL.\n` +
      `  ${cause}\n` +
      "  Is the demo Postgres running? Try: docker compose up -d",
  )
  await close()
  process.exit(1)
}

if (autoSeed) {
  const existing = await store.listInventory(db, { limit: 1 })
  if (existing.rows.length === 0) {
    const inserted = await seedInventory(db, defaultDemoInventory)
    console.log(`[catalog-demo-api] auto-seeded ${inserted.length} inventory rows`)
  }
}

const app = createApp(db)

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`catalog-demo-api listening on http://localhost:${info.port}`)
})

const shutdown = async () => {
  console.log("catalog-demo-api: shutting down")
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await close()
  process.exit(0)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
