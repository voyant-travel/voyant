/**
 * MICE program admin routes. Mounted by the deployment under `/v1/admin/mice`.
 * Routes stay thin: validate, call `miceService`, serialize. See RFC voyant#1489.
 */

import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { createProgram, getProgram, listPrograms, updateProgram } from "./service.js"
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  setSessionInclusions,
  updateSession,
} from "./service-sessions.js"
import { createProgramSchema, programListQuerySchema, updateProgramSchema } from "./validation.js"
import {
  createSessionSchema,
  sessionListQuerySchema,
  setSessionInclusionsSchema,
  updateSessionSchema,
} from "./validation-sessions.js"

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
  // Agenda sessions (RFC voyant#1489 Phase 2).
  .get("/sessions", async (c) => {
    const query = await parseQuery(c, sessionListQuerySchema)
    return c.json(await listSessions(c.get("db"), query))
  })
  .post("/sessions", async (c) => {
    const body = await parseJsonBody(c, createSessionSchema)
    const outcome = await createSession(c.get("db"), body)
    if (outcome.status === "program_not_found") return c.json({ error: "Program not found" }, 404)
    return c.json({ data: outcome.session }, 201)
  })
  .get("/sessions/:id", async (c) => {
    const session = await getSession(c.get("db"), c.req.param("id"))
    if (!session) return c.json({ error: "Session not found" }, 404)
    return c.json({ data: session })
  })
  .patch("/sessions/:id", async (c) => {
    const body = await parseJsonBody(c, updateSessionSchema)
    const session = await updateSession(c.get("db"), c.req.param("id"), body)
    if (!session) return c.json({ error: "Session not found" }, 404)
    return c.json({ data: session })
  })
  .delete("/sessions/:id", async (c) => {
    const ok = await deleteSession(c.get("db"), c.req.param("id"))
    if (!ok) return c.json({ error: "Session not found" }, 404)
    return c.json({ success: true })
  })
  .put("/sessions/:id/inclusions", async (c) => {
    const id = c.req.param("id")
    const session = await getSession(c.get("db"), id)
    if (!session) return c.json({ error: "Session not found" }, 404)
    const { inclusions } = await parseJsonBody(c, setSessionInclusionsSchema)
    return c.json({ data: await setSessionInclusions(c.get("db"), id, inclusions) })
  })

export type MiceAdminRoutes = typeof miceAdminRoutes
