import { OpenAPIHono } from "@hono/zod-openapi"
import type { EventBus } from "@voyant-travel/core"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { pipelineRoutes } from "./pipelines.js"
import { quoteVersionRoutes } from "./quote-versions.js"
import { quoteRoutes } from "./quotes.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
    eventBus?: EventBus
  }
}

export const quotesRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .route("/", pipelineRoutes)
  .route("/", quoteRoutes)
  .route("/", quoteVersionRoutes)

export type QuotesRoutes = typeof quotesRoutes
