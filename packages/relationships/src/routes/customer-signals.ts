import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { relationshipsService } from "../service/index.js"
import {
  customerSignalListQuerySchema,
  insertCustomerSignalSchema,
  resolveCustomerSignalSchema,
  updateCustomerSignalSchema,
} from "../validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const customerSignalRoutes = new Hono<Env>()
  .get("/customer-signals", async (c) => {
    const query = parseQuery(c, customerSignalListQuerySchema)
    return c.json(await relationshipsService.listCustomerSignals(c.get("db"), query))
  })
  .post("/customer-signals", async (c) => {
    const row = await relationshipsService.createCustomerSignal(
      c.get("db"),
      await parseJsonBody(c, insertCustomerSignalSchema),
    )
    if (!row) return c.json({ error: "Person not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .get("/customer-signals/:id", async (c) => {
    const row = await relationshipsService.getCustomerSignal(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Signal not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/customer-signals/:id", async (c) => {
    const row = await relationshipsService.updateCustomerSignal(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateCustomerSignalSchema),
    )
    if (!row) return c.json({ error: "Signal not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/customer-signals/:id", async (c) => {
    const row = await relationshipsService.deleteCustomerSignal(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Signal not found" }, 404)
    return c.json({ success: true })
  })
  .post("/customer-signals/:id/resolve", async (c) => {
    const body = await parseJsonBody(c, resolveCustomerSignalSchema)
    const row = await relationshipsService.resolveCustomerSignalToBooking(
      c.get("db"),
      c.req.param("id"),
      body.bookingId,
    )
    if (!row) return c.json({ error: "Signal not found" }, 404)
    return c.json({ data: row })
  })
  .get("/people/:id/signals", async (c) => {
    return c.json({
      data: await relationshipsService.listSignalsForPerson(c.get("db"), c.req.param("id")),
    })
  })
