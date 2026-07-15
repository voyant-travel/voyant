import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import {
  VOYANT_EVENT_CATALOG_SCHEMA_VERSION,
  type VoyantGraphEventCatalog,
} from "@voyant-travel/core/project"

const EVENT_CATALOG_API_ID = "@voyant-travel/event-catalog#api.admin"

const eventCatalogEntrySchema = z.object({
  key: z.string(),
  id: z.string(),
  unitId: z.string(),
  packageName: z.string(),
  eventType: z.string(),
  version: z.string(),
  payloadSchema: z.record(z.string(), z.unknown()),
  visibility: z.enum(["internal", "external"]),
  audit: z.object({
    sourceModule: z.string(),
    category: z.enum(["domain", "internal"]),
  }),
  redactedFields: z.array(z.string()).readonly(),
})

const eventCatalogSchema = z.object({
  schemaVersion: z.literal(VOYANT_EVENT_CATALOG_SCHEMA_VERSION),
  events: z.array(eventCatalogEntrySchema).readonly(),
})

const getEventCatalogRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "getSelectedEventCatalog",
  summary: "Get selected event contracts",
  tags: ["Event catalog"],
  "x-voyant-api-id": EVENT_CATALOG_API_ID,
  responses: {
    200: {
      description: "Versioned event contracts selected for this deployment.",
      content: {
        "application/json": {
          schema: z.object({ data: eventCatalogSchema }),
        },
      },
    },
  },
})

/** Build the read-only admin API over one generated selected-graph catalog. */
export function createEventCatalogHonoApp(eventCatalog: VoyantGraphEventCatalog): OpenAPIHono {
  return new OpenAPIHono().openapi(getEventCatalogRoute, (context) =>
    context.json({ data: eventCatalog }, 200),
  )
}
