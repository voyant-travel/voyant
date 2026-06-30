import { OpenAPIHono } from "@hono/zod-openapi"
import type { EventBus } from "@voyant-travel/core"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { QuotesRouteRuntime } from "../route-runtime.js"
import { pipelineRoutes } from "./pipelines.js"
import { quoteVersionRoutes } from "./quote-versions.js"
import { createQuoteRoutes } from "./quotes.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
    eventBus?: EventBus
  }
}

export function createQuotesRoutes(runtime: QuotesRouteRuntime = {}) {
  return new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .route("/", pipelineRoutes)
    .route("/", createQuoteRoutes(runtime))
    .route("/", quoteVersionRoutes)
}

export const quotesRoutes = createQuotesRoutes()

export type QuotesRoutes = typeof quotesRoutes
