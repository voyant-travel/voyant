import { parseJsonBody, parseOptionalJsonBody, parseQuery } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { z } from "zod"
import { quotesService } from "../service/index.js"
import { QuoteVersionConflictError } from "../service/quote-versions.js"
import {
  acceptQuoteVersionSchema,
  applyTripSnapshotToQuoteVersionSchema,
  declineQuoteVersionSchema,
  expireQuoteVersionsSchema,
  insertQuoteVersionLineSchema,
  insertQuoteVersionSchema,
  quoteVersionListQuerySchema,
  sendQuoteVersionSchema,
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
    return c.json(await quotesService.listQuoteVersions(c.get("db"), query))
  })
  .post("/quotes/:id/versions", async (c) => {
    try {
      const body = await parseJsonBody(c, insertQuoteVersionSchema.omit({ quoteId: true }))
      return c.json(
        {
          data: await quotesService.createQuoteVersion(c.get("db"), {
            ...body,
            quoteId: c.req.param("id"),
          }),
        },
        201,
      )
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .patch("/quote-versions/:id/validity", async (c) => {
    const body = await parseJsonBody(c, z.object({ validUntil: z.string().date().nullable() }))
    const row = await quotesService.setQuoteVersionValidUntil(
      c.get("db"),
      c.req.param("id"),
      body.validUntil,
    )
    if (!row) return c.json({ error: "Quote version not found" }, 404)
    return c.json({ data: row })
  })
  .post("/quotes/:id/versions/snapshot", async (c) => {
    const version = await quotesService.createVersionSnapshotFromQuote(
      c.get("db"),
      c.req.param("id"),
    )
    if (!version) return c.json({ error: "Quote not found" }, 404)
    return c.json({ data: version }, 201)
  })
  .post("/quote-versions/expire", async (c) => {
    return c.json({
      data: await quotesService.expireQuoteVersions(
        c.get("db"),
        await parseOptionalJsonBody(c, expireQuoteVersionsSchema),
      ),
    })
  })
  .get("/quote-versions/:id", async (c) => {
    const row = await quotesService.getQuoteVersionById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Quote version not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/quote-versions/:id", async (c) => {
    try {
      const row = await quotesService.updateQuoteVersion(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, updateQuoteVersionSchema),
      )
      if (!row) return c.json({ error: "Quote version not found" }, 404)
      return c.json({ data: row })
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .delete("/quote-versions/:id", async (c) => {
    try {
      const row = await quotesService.deleteQuoteVersion(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Quote version not found" }, 404)
      return c.json({ success: true })
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .post("/quote-versions/:id/trip-snapshot", async (c) => {
    try {
      const row = await quotesService.applyTripSnapshotToQuoteVersion(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, applyTripSnapshotToQuoteVersionSchema),
      )
      if (!row) return c.json({ error: "Quote version not found" }, 404)
      return c.json({ data: row })
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .post("/quote-versions/:id/send", async (c) => {
    try {
      const row = await quotesService.sendQuoteVersion(
        c.get("db"),
        c.req.param("id"),
        await parseOptionalJsonBody(c, sendQuoteVersionSchema),
      )
      if (!row) return c.json({ error: "Quote version not found" }, 404)
      return c.json({ data: row })
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .post("/quote-versions/:id/view", async (c) => {
    const row = await quotesService.markQuoteVersionViewed(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Quote version not found" }, 404)
    return c.json({ data: row })
  })
  .post("/quote-versions/:id/accept", async (c) => {
    try {
      const row = await quotesService.acceptQuoteVersion(
        c.get("db"),
        c.req.param("id"),
        await parseOptionalJsonBody(c, acceptQuoteVersionSchema),
      )
      if (!row) return c.json({ error: "Quote version not found" }, 404)
      return c.json({ data: row })
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .post("/quote-versions/:id/decline", async (c) => {
    try {
      const row = await quotesService.declineQuoteVersion(
        c.get("db"),
        c.req.param("id"),
        await parseOptionalJsonBody(c, declineQuoteVersionSchema),
      )
      if (!row) return c.json({ error: "Quote version not found" }, 404)
      return c.json({ data: row })
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .get("/quote-versions/:id/lines", async (c) => {
    return c.json({
      data: await quotesService.listQuoteVersionLines(c.get("db"), c.req.param("id")),
    })
  })
  .post("/quote-versions/:id/lines", async (c) => {
    try {
      const row = await quotesService.createQuoteVersionLine(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, insertQuoteVersionLineSchema),
      )
      if (!row) return c.json({ error: "Quote version not found" }, 404)
      return c.json({ data: row }, 201)
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .patch("/quote-version-lines/:id", async (c) => {
    try {
      const row = await quotesService.updateQuoteVersionLine(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, updateQuoteVersionLineSchema),
      )
      if (!row) return c.json({ error: "Quote version line not found" }, 404)
      return c.json({ data: row })
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .delete("/quote-version-lines/:id", async (c) => {
    try {
      const row = await quotesService.deleteQuoteVersionLine(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Quote version line not found" }, 404)
      return c.json({ success: true })
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
