/**
 * MICE program admin routes. Mounted by the deployment under `/v1/admin/mice`.
 * Routes stay thin: validate, call `miceService`, serialize. See RFC voyant#1489.
 */

import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { createProgram, getProgram, listPrograms, updateProgram } from "./service.js"
import {
  createDelegate,
  enrollDelegate,
  getDelegate,
  listDelegates,
  updateDelegate,
} from "./service-delegates.js"
import {
  createRoomingAssignment,
  getRoomingAssignment,
  listRoomingAssignments,
  setRoomingDelegates,
  updateRoomingAssignment,
} from "./service-rooming.js"
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
  createDelegateSchema,
  delegateListQuerySchema,
  enrollDelegateSchema,
  updateDelegateSchema,
} from "./validation-delegates.js"
import {
  createRoomingAssignmentSchema,
  roomingListQuerySchema,
  setRoomingDelegatesSchema,
  updateRoomingAssignmentSchema,
} from "./validation-rooming.js"
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
  // Delegates + session enrollment (RFC voyant#1489 Phase 3).
  .get("/delegates", async (c) => {
    const query = await parseQuery(c, delegateListQuerySchema)
    return c.json(await listDelegates(c.get("db"), query))
  })
  .post("/delegates", async (c) => {
    const body = await parseJsonBody(c, createDelegateSchema)
    const outcome = await createDelegate(c.get("db"), body)
    if (outcome.status === "program_not_found") return c.json({ error: "Program not found" }, 404)
    return c.json({ data: outcome.delegate }, 201)
  })
  .get("/delegates/:id", async (c) => {
    const delegate = await getDelegate(c.get("db"), c.req.param("id"))
    if (!delegate) return c.json({ error: "Delegate not found" }, 404)
    return c.json({ data: delegate })
  })
  .patch("/delegates/:id", async (c) => {
    const body = await parseJsonBody(c, updateDelegateSchema)
    const delegate = await updateDelegate(c.get("db"), c.req.param("id"), body)
    if (!delegate) return c.json({ error: "Delegate not found" }, 404)
    return c.json({ data: delegate })
  })
  .post("/delegates/:id/enrollments", async (c) => {
    const body = await parseJsonBody(c, enrollDelegateSchema)
    const outcome = await enrollDelegate(c.get("db"), c.req.param("id"), body)
    switch (outcome.status) {
      case "ok":
        return c.json({ data: outcome.enrollment }, outcome.idempotent ? 200 : 201)
      case "delegate_not_found":
        return c.json({ error: "Delegate not found" }, 404)
      case "session_not_found":
        return c.json({ error: "Session not found" }, 404)
      case "program_mismatch":
        return c.json({ error: "Session belongs to a different program" }, 409)
    }
  })
  // Rooming manifest (RFC voyant#1489 Phase 3).
  .get("/rooming-assignments", async (c) => {
    const query = await parseQuery(c, roomingListQuerySchema)
    return c.json(await listRoomingAssignments(c.get("db"), query))
  })
  .post("/rooming-assignments", async (c) => {
    const body = await parseJsonBody(c, createRoomingAssignmentSchema)
    const outcome = await createRoomingAssignment(c.get("db"), body)
    if (outcome.status === "program_not_found") return c.json({ error: "Program not found" }, 404)
    return c.json({ data: outcome.assignment }, 201)
  })
  .get("/rooming-assignments/:id", async (c) => {
    const assignment = await getRoomingAssignment(c.get("db"), c.req.param("id"))
    if (!assignment) return c.json({ error: "Rooming assignment not found" }, 404)
    return c.json({ data: assignment })
  })
  .patch("/rooming-assignments/:id", async (c) => {
    const body = await parseJsonBody(c, updateRoomingAssignmentSchema)
    const assignment = await updateRoomingAssignment(c.get("db"), c.req.param("id"), body)
    if (!assignment) return c.json({ error: "Rooming assignment not found" }, 404)
    return c.json({ data: assignment })
  })
  .put("/rooming-assignments/:id/delegates", async (c) => {
    const { delegates } = await parseJsonBody(c, setRoomingDelegatesSchema)
    const outcome = await setRoomingDelegates(c.get("db"), c.req.param("id"), delegates)
    switch (outcome.status) {
      case "ok":
        return c.json({ data: outcome.delegates })
      case "assignment_not_found":
        return c.json({ error: "Rooming assignment not found" }, 404)
      case "delegate_not_found":
        return c.json({ error: "Delegate not found", detail: { missing: outcome.missing } }, 404)
      case "program_mismatch":
        return c.json(
          {
            error: "Delegate belongs to a different program",
            detail: { offending: outcome.offending },
          },
          409,
        )
    }
  })

export type MiceAdminRoutes = typeof miceAdminRoutes
