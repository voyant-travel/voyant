import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { quotesService } from "../service/index.js"
import {
  insertQuoteMediaSchema,
  insertQuoteParticipantSchema,
  insertQuoteProductSchema,
  insertQuoteSchema,
  quoteListQuerySchema,
  updateQuoteProductSchema,
  updateQuoteSchema,
} from "../validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const quoteRoutes = new Hono<Env>()
  .get("/quotes", async (c) => {
    const query = await parseQuery(c, quoteListQuerySchema)
    return c.json(await quotesService.listQuotes(c.get("db"), query))
  })
  .post("/quotes", async (c) => {
    return c.json(
      {
        data: await quotesService.createQuote(
          c.get("db"),
          await parseJsonBody(c, insertQuoteSchema),
          c.get("userId") ?? null,
        ),
      },
      201,
    )
  })
  .get("/quotes/:id", async (c) => {
    const row = await quotesService.getQuoteById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Quote not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/quotes/:id", async (c) => {
    const row = await quotesService.updateQuote(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateQuoteSchema),
      c.get("userId") ?? null,
    )
    if (!row) return c.json({ error: "Quote not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/quotes/:id", async (c) => {
    const row = await quotesService.deleteQuote(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Quote not found" }, 404)
    return c.json({ success: true })
  })
  .get("/quotes/:id/participants", async (c) => {
    return c.json({
      data: await quotesService.listQuoteParticipants(c.get("db"), c.req.param("id")),
    })
  })
  .post("/quotes/:id/participants", async (c) => {
    return c.json(
      {
        data: await quotesService.createQuoteParticipant(
          c.get("db"),
          c.req.param("id"),
          await parseJsonBody(c, insertQuoteParticipantSchema),
        ),
      },
      201,
    )
  })
  .delete("/quote-participants/:id", async (c) => {
    const row = await quotesService.deleteQuoteParticipant(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Quote participant not found" }, 404)
    return c.json({ success: true })
  })
  .get("/quotes/:id/products", async (c) => {
    return c.json({
      data: await quotesService.listQuoteProducts(c.get("db"), c.req.param("id")),
    })
  })
  .post("/quotes/:id/products", async (c) => {
    return c.json(
      {
        data: await quotesService.createQuoteProduct(
          c.get("db"),
          c.req.param("id"),
          await parseJsonBody(c, insertQuoteProductSchema),
          c.get("userId") ?? null,
        ),
      },
      201,
    )
  })
  .patch("/quote-products/:id", async (c) => {
    const row = await quotesService.updateQuoteProduct(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateQuoteProductSchema),
      c.get("userId") ?? null,
    )
    if (!row) return c.json({ error: "Quote product not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/quote-products/:id", async (c) => {
    const row = await quotesService.deleteQuoteProduct(
      c.get("db"),
      c.req.param("id"),
      c.get("userId") ?? null,
    )
    if (!row) return c.json({ error: "Quote product not found" }, 404)
    return c.json({ success: true })
  })
  .get("/quotes/:id/media", async (c) => {
    return c.json({
      data: await quotesService.listQuoteMedia(c.get("db"), c.req.param("id")),
    })
  })
  .post("/quotes/:id/media", async (c) => {
    return c.json(
      {
        data: await quotesService.createQuoteMedia(
          c.get("db"),
          c.req.param("id"),
          await parseJsonBody(c, insertQuoteMediaSchema),
        ),
      },
      201,
    )
  })
  .delete("/quote-media/:id", async (c) => {
    const row = await quotesService.deleteQuoteMedia(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Quote media not found" }, 404)
    return c.json({ success: true })
  })
