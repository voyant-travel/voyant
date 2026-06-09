import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { crmService } from "../service/index.js"
import {
  applyTripSnapshotToQuoteVersionSchema,
  insertQuoteVersionLineSchema,
  insertQuoteVersionSchema,
  quoteVersionListQuerySchema,
  updateQuoteVersionLineSchema,
  updateQuoteVersionSchema,
} from "../validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const quoteVersionRoutes = new Hono<Env>()
  .get("/quote-versions", async (c) => {
    const query = await parseQuery(c, quoteVersionListQuerySchema)
    return c.json(await crmService.listQuoteVersions(c.get("db"), query))
  })
  .post("/quotes/:id/versions", async (c) => {
    const body = await parseJsonBody(c, insertQuoteVersionSchema.omit({ quoteId: true }))
    return c.json(
      {
        data: await crmService.createQuoteVersion(c.get("db"), {
          ...body,
          quoteId: c.req.param("id"),
        }),
      },
      201,
    )
  })
  .get("/quote-versions/:id", async (c) => {
    const row = await crmService.getQuoteVersionById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Quote version not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/quote-versions/:id", async (c) => {
    const row = await crmService.updateQuoteVersion(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateQuoteVersionSchema),
    )
    if (!row) return c.json({ error: "Quote version not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/quote-versions/:id", async (c) => {
    const row = await crmService.deleteQuoteVersion(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Quote version not found" }, 404)
    return c.json({ success: true })
  })
  .post("/quote-versions/:id/trip-snapshot", async (c) => {
    const row = await crmService.applyTripSnapshotToQuoteVersion(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, applyTripSnapshotToQuoteVersionSchema),
    )
    if (!row) return c.json({ error: "Quote version not found" }, 404)
    return c.json({ data: row })
  })
  .get("/quote-versions/:id/lines", async (c) => {
    return c.json({
      data: await crmService.listQuoteVersionLines(c.get("db"), c.req.param("id")),
    })
  })
  .post("/quote-versions/:id/lines", async (c) => {
    return c.json(
      {
        data: await crmService.createQuoteVersionLine(
          c.get("db"),
          c.req.param("id"),
          await parseJsonBody(c, insertQuoteVersionLineSchema),
        ),
      },
      201,
    )
  })
  .patch("/quote-version-lines/:id", async (c) => {
    const row = await crmService.updateQuoteVersionLine(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateQuoteVersionLineSchema),
    )
    if (!row) return c.json({ error: "Quote version line not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/quote-version-lines/:id", async (c) => {
    const row = await crmService.deleteQuoteVersionLine(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Quote version line not found" }, 404)
    return c.json({ success: true })
  })
