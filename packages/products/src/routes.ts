import { Hono } from "hono"

import type { Env } from "./route-env.js"
import { productAssociationRoutes } from "./routes-associations.js"
import { productCatalogRoutes } from "./routes-catalog.js"
import { productComponentRoutes } from "./routes-components.js"
import { productConfigurationRoutes } from "./routes-configuration.js"
import { productCoreRoutes } from "./routes-core.js"
import { productItineraryRoutes } from "./routes-itinerary.js"
import { productMaintenanceRoutes } from "./routes-maintenance.js"
import { productMediaRoutes } from "./routes-media.js"
import { productMerchandisingRoutes } from "./routes-merchandising.js"
import { productOptionRoutes } from "./routes-options.js"
import { productTranslationRoutes } from "./routes-translations.js"

export type { Env } from "./route-env.js"

// Product route groups stay split by domain area; mount at root to preserve public paths.
export const productRoutes = new Hono<Env>()
  .route("/", productConfigurationRoutes)
  .route("/", productMerchandisingRoutes)
  .route("/", productComponentRoutes)
  .route("/", productOptionRoutes)
  .route("/", productTranslationRoutes)
  .route("/", productCatalogRoutes)
  .route("/", productMediaRoutes)
  .route("/", productItineraryRoutes)
  .route("/", productAssociationRoutes)
  .route("/", productMaintenanceRoutes)
  .route("/", productCoreRoutes)

export type ProductRoutes = typeof productRoutes
