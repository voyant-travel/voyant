import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { accountRoutes } from "./accounts.js"
import { activityRoutes } from "./activities.js"
import { customFieldRoutes } from "./custom-fields.js"
import { opportunityRoutes } from "./opportunities.js"
import { personDocumentRoutes } from "./person-documents.js"
import { pipelineRoutes } from "./pipelines.js"
import { quoteRoutes } from "./quotes.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const crmRoutes = new Hono<Env>()
  .route("/", accountRoutes)
  .route("/", personDocumentRoutes)
  .route("/", pipelineRoutes)
  .route("/", opportunityRoutes)
  .route("/", quoteRoutes)
  .route("/", activityRoutes)
  .route("/", customFieldRoutes)

export type CrmRoutes = typeof crmRoutes
