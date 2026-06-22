/**
 * MICE program admin routes. Mounted by the deployment under `/v1/admin/mice`.
 * Routes stay thin: validate, call `miceService`, serialize. See RFC voyant#1489.
 */

import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { createProgram, getProgram, listPrograms, updateProgram } from "./service.js"
import { createProgramSchema, programListQuerySchema, updateProgramSchema } from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const miceAdminRoutes = new Hono<Env>()
  .get("/programs", async (c) => {
    const query = await parseQuery(c, programListQuerySchema)
    return c.json(await listPrograms(c.get("db"), query))
  })
  .post("/programs", async (c) => {
    const body = await parseJsonBody(c, createProgramSchema)
    return c.json({ data: await createProgram(c.get("db"), body) }, 201)
  })
  .get("/programs/:id", async (c) => {
    const program = await getProgram(c.get("db"), c.req.param("id"))
    if (!program) return c.json({ error: "Program not found" }, 404)
    return c.json({ data: program })
  })
  .patch("/programs/:id", async (c) => {
    const body = await parseJsonBody(c, updateProgramSchema)
    const program = await updateProgram(c.get("db"), c.req.param("id"), body)
    if (!program) return c.json({ error: "Program not found" }, 404)
    return c.json({ data: program })
  })

export type MiceAdminRoutes = typeof miceAdminRoutes
