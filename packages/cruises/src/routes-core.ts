import { type OpenAPIHono, z } from "@hono/zod-openapi"

import type { SourceRef } from "./adapters/index.js"
import { listCruiseAdapters } from "./adapters/registry.js"
import type { CruiseRoutesEnv as Env } from "./routes-env.js"
import { makeExternalKey } from "./routes-keying.js"
import { createCruisesAdminRoute as createRoute } from "./routes-openapi.js"
import { cruiseRowSchema, dataEnvelope } from "./routes-openapi-schemas.js"
import { cruisesService } from "./service.js"
import { cruiseListQuerySchema, insertCruiseSchema } from "./validation-core.js"

/**
 * A single unified list item. `cruise` is the local DB row (for `source:
 * "local"`) or a provider-defined adapter entry (for `source: "external"`), so
 * it is documented as an opaque pass-through (bounded effort per voyant#2114).
 */
const cruiseListItemSchema = z.object({
  source: z.string(),
  sourceProvider: z.string().nullable(),
  sourceRef: z.unknown().nullable(),
  key: z.string(),
  cruise: z.unknown(),
})

/**
 * The unified cruise-list envelope. NOT the canonical `listResponseSchema`:
 * the handler fans out to every registered adapter and reports adapter counts
 * and per-adapter errors alongside the merged local + external rows.
 */
const cruiseListResponseSchema = z.object({
  data: z.array(cruiseListItemSchema),
  total: z.number().int(),
  localTotal: z.number().int(),
  adapterCount: z.number().int(),
  adapterErrors: z.array(z.object({ adapter: z.string(), error: z.string() })),
  limit: z.number().int(),
  offset: z.number().int(),
})

const listCruisesRoute = createRoute({
  method: "get",
  path: "/",
  request: { query: cruiseListQuerySchema },
  responses: {
    200: {
      description: "Local cruises merged with every registered adapter's entries",
      content: { "application/json": { schema: cruiseListResponseSchema } },
    },
  },
})

const createCruiseRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: { required: true, content: { "application/json": { schema: insertCruiseSchema } } },
  },
  responses: {
    201: {
      description: "The created cruise",
      content: { "application/json": { schema: dataEnvelope(cruiseRowSchema) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
})

export function registerCruiseCoreRoutes(app: OpenAPIHono<Env>) {
  // --- list (local + fan-out to every registered adapter) ---
  app.openapi(listCruisesRoute, async (c) => {
    const query = c.req.valid("query")
    const local = await cruisesService.listCruises(c.get("db"), query)
    const localItems = local.data.map((c) => ({
      source: "local" as const,
      sourceProvider: null,
      sourceRef: null,
      key: c.id,
      cruise: c,
    }))
    // Fan out to every registered adapter in parallel via Promise.allSettled —
    // one slow or failing adapter doesn't block the rest. Each adapter's call
    // is independent so there's no concurrency-control concern at this layer
    // (adapters that need rate limiting handle it inside their own implementation).
    const adapters = listCruiseAdapters()
    const settled = await Promise.allSettled(
      adapters.map((adapter) =>
        adapter
          .listEntries({ limit: query.limit })
          .then((result) => ({ adapter, result }) as const),
      ),
    )
    const adapterItems: Array<{
      source: "external"
      sourceProvider: string
      sourceRef: SourceRef
      key: string
      cruise: unknown
    }> = []
    const adapterErrors: Array<{ adapter: string; error: string }> = []
    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i]
      const adapter = adapters[i]
      if (!outcome || !adapter) continue
      if (outcome.status === "rejected") {
        adapterErrors.push({
          adapter: adapter.name,
          error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
        })
        continue
      }
      for (const entry of outcome.value.result.entries) {
        adapterItems.push({
          source: "external",
          sourceProvider: adapter.name,
          sourceRef: entry.sourceRef,
          key: makeExternalKey(adapter, entry.sourceRef),
          cruise: entry,
        })
      }
    }
    return c.json(
      {
        data: [...localItems, ...adapterItems],
        total: local.total + adapterItems.length,
        localTotal: local.total,
        adapterCount: adapters.length,
        adapterErrors,
        limit: local.limit,
        offset: local.offset,
      },
      200,
    )
  })
  // --- create ---
  app.openapi(createCruiseRoute, async (c) => {
    const data = c.req.valid("json")
    const row = await cruisesService.createCruise(c.get("db"), data, {
      eventBus: c.get("eventBus"),
    })
    return c.json({ data: row }, 201)
  })
}
