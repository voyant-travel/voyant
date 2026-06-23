/**
 * MICE program admin routes. Mounted by the deployment under `/v1/admin/mice`.
 * Routes stay thin: validate, call `miceService`, serialize. See RFC voyant#1489.
 */

import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { createProgram, getProgram, listPrograms, updateProgram } from "./service.js"
import { commercialsService } from "./service-commercials.js"
import {
  createDelegate,
  enrollDelegate,
  getDelegate,
  listDelegates,
  updateDelegate,
} from "./service-delegates.js"
import { rfpService } from "./service-rfp.js"
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
  addBidEvaluationSchema,
  awardRfpSchema,
  createBidSchema,
  createRfpSchema,
  inviteSupplierSchema,
  rfpListQuerySchema,
  setBidLinesSchema,
  updateBidSchema,
  updateRfpSchema,
} from "./validation-rfp.js"
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
  // Consolidated commercials — program cost sheet / P&L (Phase 5).
  .get("/programs/:id/cost-sheet", async (c) => {
    const id = c.req.param("id")
    const program = await getProgram(c.get("db"), id)
    if (!program) return c.json({ error: "Program not found" }, 404)
    return c.json({ data: await commercialsService.getProgramCostSheet(c.get("db"), id) })
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
  // Sourcing funnel: RFP → invitations → bids → evaluation → award (Phase 4).
  .get("/rfps", async (c) => {
    const query = await parseQuery(c, rfpListQuerySchema)
    return c.json(await rfpService.listRfps(c.get("db"), query))
  })
  .post("/rfps", async (c) => {
    const body = await parseJsonBody(c, createRfpSchema)
    const outcome = await rfpService.createRfp(c.get("db"), body)
    if (outcome.status === "program_not_found") return c.json({ error: "Program not found" }, 404)
    return c.json({ data: outcome.rfp }, 201)
  })
  .get("/rfps/:id", async (c) => {
    const rfp = await rfpService.getRfp(c.get("db"), c.req.param("id"))
    if (!rfp) return c.json({ error: "RFP not found" }, 404)
    return c.json({ data: rfp })
  })
  .patch("/rfps/:id", async (c) => {
    const body = await parseJsonBody(c, updateRfpSchema)
    const rfp = await rfpService.updateRfp(c.get("db"), c.req.param("id"), body)
    if (!rfp) return c.json({ error: "RFP not found" }, 404)
    return c.json({ data: rfp })
  })
  .post("/rfps/:id/invitations", async (c) => {
    const body = await parseJsonBody(c, inviteSupplierSchema)
    const outcome = await rfpService.inviteSupplier(c.get("db"), c.req.param("id"), body)
    if (outcome.status === "rfp_not_found") return c.json({ error: "RFP not found" }, 404)
    return c.json({ data: outcome.invitation }, outcome.idempotent ? 200 : 201)
  })
  .post("/rfps/:id/bids", async (c) => {
    const body = await parseJsonBody(c, createBidSchema)
    const outcome = await rfpService.createBid(c.get("db"), c.req.param("id"), body)
    if (outcome.status === "rfp_not_found") return c.json({ error: "RFP not found" }, 404)
    return c.json({ data: outcome.bid }, 201)
  })
  .post("/rfps/:id/award", async (c) => {
    const { bidId } = await parseJsonBody(c, awardRfpSchema)
    const outcome = await rfpService.awardRfp(c.get("db"), c.req.param("id"), bidId)
    switch (outcome.status) {
      case "ok":
        return c.json({ data: { rfp: outcome.rfp, bid: outcome.bid } })
      case "rfp_not_found":
        return c.json({ error: "RFP not found" }, 404)
      case "bid_not_found":
        return c.json({ error: "Bid not found on this RFP" }, 404)
      case "already_awarded":
        return c.json({ error: "RFP is already awarded" }, 409)
    }
  })
  .get("/bids/:id", async (c) => {
    const bid = await rfpService.getBid(c.get("db"), c.req.param("id"))
    if (!bid) return c.json({ error: "Bid not found" }, 404)
    return c.json({ data: bid })
  })
  .patch("/bids/:id", async (c) => {
    const body = await parseJsonBody(c, updateBidSchema)
    const bid = await rfpService.updateBid(c.get("db"), c.req.param("id"), body)
    if (!bid) return c.json({ error: "Bid not found" }, 404)
    return c.json({ data: bid })
  })
  .put("/bids/:id/lines", async (c) => {
    const { lines } = await parseJsonBody(c, setBidLinesSchema)
    const outcome = await rfpService.setBidLines(c.get("db"), c.req.param("id"), lines)
    if (outcome.status === "bid_not_found") return c.json({ error: "Bid not found" }, 404)
    return c.json({ data: outcome.lines })
  })
  .post("/bids/:id/evaluations", async (c) => {
    const body = await parseJsonBody(c, addBidEvaluationSchema)
    const outcome = await rfpService.addBidEvaluation(c.get("db"), c.req.param("id"), body)
    if (outcome.status === "bid_not_found") return c.json({ error: "Bid not found" }, 404)
    return c.json({ data: outcome.evaluation }, 201)
  })

export type MiceAdminRoutes = typeof miceAdminRoutes
