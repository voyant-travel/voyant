import { parseJsonBody } from "@voyant-travel/hono"
import type { Hono } from "hono"
import { z } from "zod"

import type { CruiseRoutesEnv as Env } from "./routes-env.js"
import { cruisesSearchService } from "./service-search.js"
import { insertSearchIndexSchema } from "./validation-search.js"

export function registerCruiseSearchIndexRoutes(app: Hono<Env>) {
  app
    // --- search-index management ---
    .put("/search-index/bulk", async (c) => {
      const payload = await parseJsonBody(
        c,
        z.object({
          entries: z.array(insertSearchIndexSchema),
        }),
      )
      const result = await cruisesSearchService.bulkUpsert(c.get("db"), payload.entries as never)
      return c.json({ data: result })
    })
    .delete("/search-index/:crsiId", async (c) => {
      const ok = await cruisesSearchService.removeEntry(c.get("db"), c.req.param("crsiId"))
      if (!ok) return c.json({ error: "not_found" }, 404)
      return c.body(null, 204)
    })
    .post("/search-index/rebuild", async (c) => {
      const result = await cruisesSearchService.rebuildAll(c.get("db"))
      return c.json({ data: result })
    })
}
