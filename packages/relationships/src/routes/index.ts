import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { accountRoutes } from "./accounts.js"
import { activityRoutes } from "./activities.js"
import { customFieldRoutes } from "./custom-fields.js"
import { customerSignalRoutes } from "./customer-signals.js"
import { personDocumentRoutes } from "./person-documents.js"
import { personRelationshipRoutes } from "./person-relationships.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const relationshipsRoutes = new Hono<Env>()
  .route("/", accountRoutes)
  .route("/", personDocumentRoutes)
  .route("/", personRelationshipRoutes)
  .route("/", customerSignalRoutes)
  .route("/", activityRoutes)
  .route("/", customFieldRoutes)

export type RelationshipsRoutes = typeof relationshipsRoutes
