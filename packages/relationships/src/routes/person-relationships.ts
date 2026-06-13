import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { relationshipsService } from "../service/index.js"
import {
  insertPersonRelationshipSchema,
  personRelationshipListQuerySchema,
  updatePersonRelationshipSchema,
} from "../validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const personRelationshipRoutes = new Hono<Env>()
  .get("/people/:id/relationships", async (c) => {
    const query = parseQuery(c, personRelationshipListQuerySchema)
    return c.json({
      data: await relationshipsService.listPersonRelationships(
        c.get("db"),
        c.req.param("id"),
        query,
      ),
    })
  })
  .post("/people/:id/relationships", async (c) => {
    const row = await relationshipsService.createPersonRelationship(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertPersonRelationshipSchema),
    )
    if (!row) {
      return c.json({ error: "Person not found or self-relationship rejected" }, 400)
    }
    return c.json({ data: row }, 201)
  })
  .get("/person-relationships/:id", async (c) => {
    const row = await relationshipsService.getPersonRelationship(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Relationship not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/person-relationships/:id", async (c) => {
    const row = await relationshipsService.updatePersonRelationship(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updatePersonRelationshipSchema),
    )
    if (!row) return c.json({ error: "Relationship not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/person-relationships/:id", async (c) => {
    const row = await relationshipsService.deletePersonRelationship(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Relationship not found" }, 404)
    return c.json({ success: true })
  })
