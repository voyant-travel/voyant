import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { crmService } from "../service/index.js"
import {
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
    return c.json(await crmService.listQuotes(c.get("db"), query))
  })
  .post("/quotes", async (c) => {
    return c.json(
      {
        data: await crmService.createQuote(c.get("db"), await parseJsonBody(c, insertQuoteSchema)),
      },
      201,
    )
  })
  .get("/quotes/:id", async (c) => {
    const row = await crmService.getQuoteById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Quote not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/quotes/:id", async (c) => {
    const row = await crmService.updateQuote(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateQuoteSchema),
    )
    if (!row) return c.json({ error: "Quote not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/quotes/:id", async (c) => {
    const row = await crmService.deleteQuote(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Quote not found" }, 404)
    return c.json({ success: true })
  })
  .get("/quotes/:id/participants", async (c) => {
    return c.json({
      data: await crmService.listQuoteParticipants(c.get("db"), c.req.param("id")),
    })
  })
  .post("/quotes/:id/participants", async (c) => {
    return c.json(
      {
        data: await crmService.createQuoteParticipant(
          c.get("db"),
          c.req.param("id"),
          await parseJsonBody(c, insertQuoteParticipantSchema),
        ),
      },
      201,
    )
  })
  .delete("/quote-participants/:id", async (c) => {
    const row = await crmService.deleteQuoteParticipant(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Quote participant not found" }, 404)
    return c.json({ success: true })
  })
  .get("/quotes/:id/products", async (c) => {
    return c.json({
      data: await crmService.listQuoteProducts(c.get("db"), c.req.param("id")),
    })
  })
  .post("/quotes/:id/products", async (c) => {
    return c.json(
      {
        data: await crmService.createQuoteProduct(
          c.get("db"),
          c.req.param("id"),
          await parseJsonBody(c, insertQuoteProductSchema),
        ),
      },
      201,
    )
  })
  .patch("/quote-products/:id", async (c) => {
    const row = await crmService.updateQuoteProduct(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateQuoteProductSchema),
    )
    if (!row) return c.json({ error: "Quote product not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/quote-products/:id", async (c) => {
    const row = await crmService.deleteQuoteProduct(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Quote product not found" }, 404)
    return c.json({ success: true })
  })
