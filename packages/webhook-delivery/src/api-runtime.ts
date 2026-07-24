import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { ApiModule } from "@voyant-travel/hono/module"

import { createOperatorWebhookAdminRoutes } from "./admin-routes.js"

/** Compose operator webhook settings from the graph-selected external event catalog. */
export const createOperatorWebhookVoyantRuntime = defineGraphRuntimeFactory(
  ({ graph }): ApiModule => ({
    module: { name: "webhooks" },
    adminRoutes: createOperatorWebhookAdminRoutes({
      contracts: (graph.eventCatalog?.events ?? [])
        .filter((event) => event.visibility === "external")
        .map((event) => ({
          eventId: event.id,
          eventType: event.eventType,
          eventVersion: event.version,
          payloadSchema: event.payloadSchema,
        })),
    }),
  }),
)
