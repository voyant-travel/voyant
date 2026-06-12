import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { Hono } from "hono"

import type { SourceRef } from "./adapters/index.js"
import { listCruiseAdapters } from "./adapters/registry.js"
import type { CruiseRoutesEnv as Env } from "./routes-env.js"
import { makeExternalKey } from "./routes-keying.js"
import { cruisesService } from "./service.js"
import { cruiseListQuerySchema, insertCruiseSchema } from "./validation-core.js"

export function registerCruiseCoreRoutes(app: Hono<Env>) {
  app
    // --- list / unified detail ---
    .get("/", async (c) => {
      const query = parseQuery(c, cruiseListQuerySchema)
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
            error:
              outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
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
      return c.json({
        data: [...localItems, ...adapterItems],
        total: local.total + adapterItems.length,
        localTotal: local.total,
        adapterCount: adapters.length,
        adapterErrors,
        limit: local.limit,
        offset: local.offset,
      })
    })
    .post("/", async (c) => {
      const data = await parseJsonBody(c, insertCruiseSchema)
      const row = await cruisesService.createCruise(c.get("db"), data, {
        eventBus: c.get("eventBus"),
      })
      return c.json({ data: row }, 201)
    })
}
