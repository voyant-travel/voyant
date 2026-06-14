import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { relationshipsService } from "../service/index.js"
import {
  customFieldDefinitionListQuerySchema,
  customFieldValueListQuerySchema,
  insertCustomFieldDefinitionSchema,
  updateCustomFieldDefinitionSchema,
  upsertCustomFieldValueSchema,
} from "../validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const customFieldRoutes = new Hono<Env>()
  .get("/custom-fields", async (c) => {
    const query = await parseQuery(c, customFieldDefinitionListQuerySchema)
    return c.json(await relationshipsService.listCustomFieldDefinitions(c.get("db"), query))
  })
  .post("/custom-fields", async (c) => {
    return c.json(
      {
        data: await relationshipsService.createCustomFieldDefinition(
          c.get("db"),
          await parseJsonBody(c, insertCustomFieldDefinitionSchema),
        ),
      },
      201,
    )
  })
  .get("/custom-fields/:id", async (c) => {
    const row = await relationshipsService.getCustomFieldDefinitionById(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Custom field not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/custom-fields/:id", async (c) => {
    const row = await relationshipsService.updateCustomFieldDefinition(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateCustomFieldDefinitionSchema),
    )
    if (!row) return c.json({ error: "Custom field not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/custom-fields/:id", async (c) => {
    const row = await relationshipsService.deleteCustomFieldDefinition(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Custom field not found" }, 404)
    return c.json({ success: true })
  })
  .get("/custom-field-values", async (c) => {
    const query = await parseQuery(c, customFieldValueListQuerySchema)
    return c.json(await relationshipsService.listCustomFieldValues(c.get("db"), query))
  })
  .put("/custom-fields/:id/value", async (c) => {
    return c.json(
      {
        data: await relationshipsService.upsertCustomFieldValue(
          c.get("db"),
          c.req.param("id"),
          await parseJsonBody(c, upsertCustomFieldValueSchema),
        ),
      },
      200,
    )
  })
  .delete("/custom-field-values/:id", async (c) => {
    const row = await relationshipsService.deleteCustomFieldValue(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Custom field value not found" }, 404)
    return c.json({ success: true })
  })
