import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { pipelineRoutes } from "./pipelines.js"
import { quoteVersionRoutes } from "./quote-versions.js"
import { quoteRoutes } from "./quotes.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const quotesRoutes = new Hono<Env>()
  .route("/", pipelineRoutes)
  .route("/", quoteRoutes)
  .route("/", quoteVersionRoutes)

export type QuotesRoutes = typeof quotesRoutes
