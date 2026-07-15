import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { HonoModule } from "@voyant-travel/hono/module"

import { createEventCatalogHonoApp } from "./routes.js"

/** Compose the package API from the canonical catalog lowered into this graph runtime. */
export const createEventCatalogVoyantRuntime = defineGraphRuntimeFactory(
  ({ graph }): HonoModule => {
    if (!graph.eventCatalog) {
      throw new Error("The generated graph runtime did not provide an event catalog.")
    }
    return {
      module: { name: "event-catalog" },
      adminRoutes: createEventCatalogHonoApp(graph.eventCatalog),
    }
  },
)
